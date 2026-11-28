-- DEF-20261128-015 止血：登入身分不能把自己的會話成員行改到別的會話（或改成別人）。
-- 2026-11-28 用戶已在 Dashboard 執行（含自我測試，回 trigger_count = 1）。Replayable。
-- 只擋 anon／authenticated 改 conversation_id／user_id；已讀水位等欄位照常，服務端與資料庫函數不受影響。
-- 回退：drop trigger if exists guard_conversation_member_keys on public.conversation_members;
--       drop function if exists public.guard_conversation_member_keys();
begin;
create or replace function public.guard_conversation_member_keys() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('anon','authenticated')
     and (new.conversation_id is distinct from old.conversation_id or new.user_id is distinct from old.user_id) then
    raise exception 'conversation membership cannot be moved' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.guard_conversation_member_keys() from public, anon, authenticated;
drop trigger if exists guard_conversation_member_keys on public.conversation_members;
create trigger guard_conversation_member_keys before update on public.conversation_members
  for each row execute function public.guard_conversation_member_keys();
do $$
declare m record;
begin
  select conversation_id, user_id into m from public.conversation_members limit 1;
  if not found then return; end if; -- 空庫（新環境）沒有可測的行
  perform set_config('request.jwt.claim.sub', m.user_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', m.user_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.conversation_members set last_read_at = last_read_at
    where conversation_id = m.conversation_id and user_id = m.user_id;
  if not found then raise exception 'self test: normal update failed'; end if;
  begin
    update public.conversation_members set conversation_id = gen_random_uuid()
      where conversation_id = m.conversation_id and user_id = m.user_id;
    raise exception 'self test: move was allowed';
  exception when insufficient_privilege then
    if sqlerrm <> 'conversation membership cannot be moved' then raise; end if;
  end;
  reset role;
end $$;
commit;
