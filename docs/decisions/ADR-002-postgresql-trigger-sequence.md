# ADR-002：使用 BEFORE INSERT Trigger 產生流水號

**日期：** 2026-03-25
**狀態：** 已採納

## 背景
`print_jobs.job_no` 與 `import_batches.batch_no` 需要格式化流水號（如 `PJ-20260325-001`）。
最初嘗試在 `DEFAULT` 子句使用 `nextval('print_job_seq')`，但執行 `psql -f schema.sql` 時報錯：

```
ERROR: relation "print_job_seq" does not exist
LINE 73: ... nextval('print_job_seq')::TEXT ...
```

## 根因
PostgreSQL 在執行 `CREATE TABLE` 時，會在 **parse time** 將 DEFAULT 子句中的字串常數強制轉型為 `regclass`，並立即查找 pg_class catalog。即使 sequence 定義在同一個 SQL 檔案的前幾行，若 parser 已經解析到 DEFAULT 子句時 sequence 尚未建立（或因 transaction 時序問題），就會直接報錯。

## 決策
改用 **BEFORE INSERT Trigger**：

```sql
CREATE OR REPLACE FUNCTION fn_gen_job_no()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.job_no := 'PJ-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-'
             || LPAD(nextval('print_job_seq')::TEXT, 3, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_print_jobs_job_no
  BEFORE INSERT ON print_jobs
  FOR EACH ROW EXECUTE FUNCTION fn_gen_job_no();
```

PL/pgSQL 函式體在 **execution time** 才解析 `nextval('print_job_seq')`，此時 sequence 已存在，不會報錯。

## 後果
**正面：**
- 完全解決 parse-time regclass 解析問題
- 邏輯集中在 trigger，應用層無需傳入 job_no / batch_no
- 可透過 `RETURNING job_no` / `RETURNING id, batch_no` 取回 trigger 產生的值

**負面：**
- 需要額外維護 trigger function
- 單元測試需考慮 trigger 是否觸發

## ⚠️ 已發現陷阱（2026-04-09）

**問題：** `imports.ts` 原始實作在 TypeScript 自行產生 `batchNo`，
並將其帶入 INSERT 的 `batch_no` 欄位，再於 response 中直接使用這個 TS 產生的值。
但 BEFORE INSERT Trigger 會**覆寫** `NEW.batch_no`，導致 DB 儲存的是 trigger 產生的序號值，
而前端收到的卻是 TS 產生的時間戳值——兩者不同，executeImport 因此永遠 404。

**修正：**
```typescript
// 錯誤做法：INSERT 時傳入自產的 batchNo
INSERT INTO import_batches (batch_no, file_name, ...) VALUES ($1, $2, ...) RETURNING id
// TS 產生的 batchNo 被 trigger 覆寫，但 response 仍用 TS 版本 → 不一致

// 正確做法：不傳 batch_no，用 RETURNING 取回 trigger 產生的值
INSERT INTO import_batches (file_name, ...) VALUES ($1, ...) RETURNING id, batch_no
const actualBatchNo = batchResult.rows[0].batch_no; // 使用 DB 的值
```

**教訓：** 凡有 BEFORE INSERT Trigger 覆寫的欄位，INSERT 時一律省略該欄位，
並透過 `RETURNING` 取回實際儲存值後再回傳給前端。
