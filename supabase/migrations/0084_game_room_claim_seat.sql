-- 第七輪審核 §3.4：遊戲房容量／席號原子化（0084）。
-- 問題：join／bump-join／同意入房申請都是「讀 active 成員 → 算 max(seat)+1 → insert」三步獨立操作，
--   schema 只保證 (room_id,user_id) 唯一；兩人同時加入最後一個空位會同時超員，也會拿到同一個席號。
-- 解法：單一 RPC，先 SELECT … FOR UPDATE 鎖住 game_rooms 那一行，再在鎖內數人、算席號、寫入。
--   所有入房路徑改走它（lib/games/rooms.ts claimRoomSeat）；沒跑本遷移時 claimRoomSeat 退回舊的三步寫法，不阻斷上線。
-- 不加 UNIQUE(room_id, seat)：既有資料可能已有重複席號，要先清理（見文末核對查詢）才能加。
-- 可重放：CREATE OR REPLACE。Dashboard 貼跑，成功 "Success. No rows returned"。
CREATE OR REPLACE FUNCTION game_room_claim_seat(p_room uuid, p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  r game_rooms%ROWTYPE;
  me game_room_players%ROWTYPE;
  has_me boolean;
  n int;
  top int;
  s int;
BEGIN
  SELECT * INTO r FROM game_rooms WHERE id = p_room AND status <> 'ended' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('result', 'room_not_found');
  END IF;
  SELECT * INTO me FROM game_room_players WHERE room_id = p_room AND user_id = p_user;
  has_me := FOUND;
  IF has_me AND me.status = 'active' THEN
    RETURN jsonb_build_object('result', 'already', 'seat', me.seat);
  END IF;
  IF r.status <> 'lobby' THEN
    RETURN jsonb_build_object('result', 'room_started');
  END IF;
  IF has_me AND me.status = 'kicked' THEN
    RETURN jsonb_build_object('result', 'kicked');
  END IF;
  SELECT count(*), COALESCE(max(seat), -1) INTO n, top
    FROM game_room_players WHERE room_id = p_room AND status = 'active';
  IF n >= r.max_players THEN
    RETURN jsonb_build_object('result', 'room_full');
  END IF;
  s := top + 1;
  IF has_me THEN
    UPDATE game_room_players
       SET status = 'active', seat = s, ready = false, last_seen_at = now()
     WHERE room_id = p_room AND user_id = p_user;
  ELSE
    INSERT INTO game_room_players (room_id, user_id, seat, ready, status)
    VALUES (p_room, p_user, s, false, 'active');
  END IF;
  RETURN jsonb_build_object('result', 'ok', 'seat', s);
END;
$$;
REVOKE ALL ON FUNCTION game_room_claim_seat(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION game_room_claim_seat(uuid, uuid) TO service_role;

-- 上線前核對既有重複席號（有結果就先人工整理，再考慮加唯一索引）：
--   SELECT room_id, seat, count(*) FROM game_room_players WHERE status = 'active'
--   GROUP BY room_id, seat HAVING count(*) > 1;
