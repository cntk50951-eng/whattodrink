-- UR D.6 附件存儲 RLS（buckets 本體由用戶 Dashboard 建，見下）。
-- 兩個私有桶：`chat-images`（10MB）、`chat-voice`（2MB）。
-- 路徑約定：`<sender_uid>/<conversation_id>/<uuid>.<ext>`（首段＝上傳者，
-- RLS 只認首段；會話歸屬校驗在 API 層做，不在 storage policy 表達）。
-- Dashboard SQL Editor 貼上執行（可重放）。

-- 1. 上傳：登入態＋兩桶＋首段是自己（防 A 傳到 B 名下）
DROP POLICY IF EXISTS "chat uploads self folder" ON storage.objects;
CREATE POLICY "chat uploads self folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id IN ('chat-images', 'chat-voice')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2. 更新／刪除：只許首段是自己（覆寫／清殘片；讀一律走服務端簽名 URL，不開 SELECT）
DROP POLICY IF EXISTS "chat objects self update" ON storage.objects;
CREATE POLICY "chat objects self update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id IN ('chat-images', 'chat-voice')
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id IN ('chat-images', 'chat-voice')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
DROP POLICY IF EXISTS "chat objects self delete" ON storage.objects;
CREATE POLICY "chat objects self delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id IN ('chat-images', 'chat-voice')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
-- SELECT 不開（讀全走 `POST /uploads/view` 簽名短鏈，60–120s 過期；陌生人無任何直讀口）。
