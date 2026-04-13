-- Migration 006: UAT 草稿通知功能 — 收件人查詢 partial index
-- 加速 fetchRecipients() 查詢（supervisor/admin 且 email 已設定且帳號啟用）

CREATE INDEX IF NOT EXISTS idx_users_notify_recipients
  ON users (role, email)
  WHERE active = TRUE AND email IS NOT NULL;

COMMENT ON INDEX idx_users_notify_recipients
  IS 'Speeds up fetchRecipients() query for UAT draft email notifications';
