-- Migration 004: Add item_remarks column to uat_confirmations
-- Stores per-item operator remarks (e.g., {po_find: "欄位名稱建議改為..."})

ALTER TABLE uat_confirmations
  ADD COLUMN IF NOT EXISTS item_remarks JSONB NOT NULL DEFAULT '{}'::JSONB;

COMMENT ON COLUMN uat_confirmations.item_remarks IS '逐項意見 {item_key: remark_string}';
