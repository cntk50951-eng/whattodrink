-- 第九／十輪審核 §3.1：大話骰同意入房申請與佔位原子化（0086）。
-- 在單一 PostgreSQL 交易內鎖定 game_rooms 與 game_join_requests，一次完成：
--   1) 校驗房間未結束、未過期（expires_at > now()）、呼叫者仍為當前 host_id；
--   2) 校驗申請未超過 5 分鐘有效窗（超時標記 expired）；
--   3) 校驗 lobby 狀態、未踢出、未滿員，寫入 game_room_players、遞增 game_rooms.version 並續期 expires_at + 2h、更新申請為 approved。
-- 嚴格對齊 0042_game_rooms.sql 與 0055_game_open_chat.sql 欄位（game_rooms 無 updated_at）。
-- 遷移 0086 尚未套用時應用層退回原有流程（不阻斷上線）。可重放：CREATE OR REPLACE。
CREATE OR REPLACE FUNCTION game_room_approve_request(p_room uuid, p_request uuid, p_host uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  r game_rooms%ROWTYPE;
  jr game_join_requests%ROWTYPE;
  me game_room_players%ROWTYPE;
  has_me boolean;
  n int;
  top int;
  s int;
  did_insert boolean := false;
  next_ver int;
BEGIN
  SELECT * INTO r FROM game_rooms WHERE id = p_room AND status <> 'ended' FOR UPDATE;
  IF NOT FOUND OR r.expires_at <= now() THEN
    RETURN jsonb_build_object('result', 'room_not_found');
  END IF;

  IF r.host_id <> p_host THEN
    RETURN jsonb_build_object('result', 'not_host');
  END IF;

  SELECT * INTO jr FROM game_join_requests WHERE id = p_request AND room_id = p_room FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('result', 'not_found');
  END IF;

  SELECT * INTO me FROM game_room_players WHERE room_id = p_room AND user_id = jr.user_id;
  has_me := FOUND;

  IF jr.status = 'approved' THEN
    IF has_me AND me.status = 'active' THEN
      RETURN jsonb_build_object('result', 'already_approved', 'version', r.version, 'seat', me.seat);
    END IF;
    -- 若先前批准後未成功佔位，允許房主重按批准時在同一交易內補佔席位
  ELSIF jr.status = 'pending' THEN
    IF jr.created_at <= now() - make_interval(mins => 5) THEN
      UPDATE game_join_requests SET status = 'expired' WHERE id = p_request;
      RETURN jsonb_build_object('result', 'not_pending', 'status', 'expired', 'version', r.version);
    END IF;
  ELSE
    RETURN jsonb_build_object('result', 'not_pending', 'status', jr.status, 'version', r.version);
  END IF;

  IF r.status <> 'lobby' THEN
    RETURN jsonb_build_object('result', 'room_started');
  END IF;

  IF has_me AND me.status <> 'active' THEN
    RETURN jsonb_build_object('result', 'kicked');
  END IF;

  IF has_me AND me.status = 'active' THEN
    s := me.seat;
    did_insert := false;
    next_ver := r.version;
  ELSE
    SELECT count(*), COALESCE(max(seat), -1) INTO n, top
      FROM game_room_players WHERE room_id = p_room AND status = 'active';
    IF n >= r.max_players THEN
      RETURN jsonb_build_object('result', 'room_full');
    END IF;
    s := top + 1;
    INSERT INTO game_room_players (room_id, user_id, seat, ready, status)
    VALUES (p_room, jr.user_id, s, false, 'active');
    did_insert := true;
    UPDATE game_rooms
       SET version = r.version + 1,
           expires_at = now() + make_interval(hours => 2)
     WHERE id = p_room
     RETURNING version INTO next_ver;
  END IF;

  UPDATE game_join_requests
     SET status = 'approved', decided_at = now(), decided_by = p_host
   WHERE id = p_request;

  RETURN jsonb_build_object(
    'result', 'ok',
    'seat', s,
    'inserted', did_insert,
    'version', next_ver,
    'applicant_id', jr.user_id
  );
END;
$$;
REVOKE ALL ON FUNCTION game_room_approve_request(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION game_room_approve_request(uuid, uuid, uuid) TO service_role;
