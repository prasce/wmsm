-- Migration 002: 為 WMSM030 匯入列印紀錄增加 IN-YYYYMMDD-NNN 批次號
-- 執行方式：psql -U postgres -d wmsm -f database/migrations/002_add_import_print_batch.sql

-- 1. 新增流水號 sequence
CREATE SEQUENCE IF NOT EXISTS import_print_seq START 1;

-- 2. 在 print_jobs 增加 print_batch_no 欄位
ALTER TABLE print_jobs
  ADD COLUMN IF NOT EXISTS print_batch_no VARCHAR(30) DEFAULT NULL;

-- 3. 建立 BEFORE INSERT trigger：WMSM030 自動產生 IN-YYYYMMDD-NNN
CREATE OR REPLACE FUNCTION fn_gen_print_batch_no()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.source_module = 'WMSM030' THEN
    NEW.print_batch_no := 'IN-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-'
                       || LPAD(nextval('import_print_seq')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_print_jobs_print_batch_no
  BEFORE INSERT ON print_jobs
  FOR EACH ROW EXECUTE FUNCTION fn_gen_print_batch_no();

-- 4. 更新 v_print_history view（加入 print_batch_no 作為 WMSM030 的 batch_no 來源）
CREATE OR REPLACE VIEW v_print_history AS
SELECT
  pji.id,
  pj.printed_at,
  pji.product_code,
  pji.product_name,
  COALESCE(po.po_no, pj.print_batch_no) AS batch_no,
  pji.print_copies AS copies,
  pj.operator,
  pj.source_module AS module,
  pj.status,
  EXISTS (
    SELECT 1 FROM v_duplicate_prints dp
    WHERE dp.product_code = pji.product_code
      AND dp.po_id = pj.po_id
  ) AS is_duplicate
FROM print_job_items pji
JOIN print_jobs pj ON pj.id = pji.job_id
LEFT JOIN purchase_orders po ON po.id = pj.po_id
ORDER BY pj.printed_at DESC NULLS LAST;
