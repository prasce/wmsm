-- Migration 005: uat_drafts — 儲存 operator 的逐項確認進度（草稿）
-- 與 uat_confirmations（正式簽核）分開，避免污染稽核紀錄

CREATE TABLE IF NOT EXISTS uat_drafts (
  id           SERIAL      PRIMARY KEY,
  saved_by     VARCHAR(50) NOT NULL,
  saved_role   VARCHAR(20) NOT NULL,
  check_items  JSONB       NOT NULL DEFAULT '{}'::JSONB,
  item_remarks JSONB       NOT NULL DEFAULT '{}'::JSONB,
  saved_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  uat_drafts            IS 'UAT 確認進度草稿（operator 存檔，supervisor 載入預填）';
COMMENT ON COLUMN uat_drafts.saved_by   IS '儲存者顯示名稱';
COMMENT ON COLUMN uat_drafts.saved_role IS '儲存者角色';
COMMENT ON COLUMN uat_drafts.check_items  IS '勾選狀態 {item_key: boolean}';
COMMENT ON COLUMN uat_drafts.item_remarks IS '逐項意見 {item_key: remark_string}';
