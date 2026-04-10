# 系統架構總覽

## 概述
WMSM 麥頭印標系統採用前後端分離架構：
- 前端 React SPA 透過 Vite proxy 呼叫後端 REST API
- 後端 Express 負責商品查詢、列印作業管理、Excel 匯入驗證、角色型帳號管理
- PostgreSQL 儲存所有業務資料

## 架構圖

```
瀏覽器 (localhost:5173)
    │  Vite Dev Server
    │  proxy /api/* → localhost:3000
    ▼
┌────────────────────────────────────────────┐
│            React SPA (TSX)                 │
│  LoginPage（未登入時顯示）                  │
│  WMSM020 │ WMSM030 │ History │ AccountAdmin│
│  UATConfirm（草稿暫存 + 主管簽核）          │
│  UATHistory（簽核記錄查詢）                 │
│  TopBar（角色徽章 + 🔑 變更密碼）          │
│  SideBar（依角色動態顯示選單）              │
│  api/client.ts（JWT + PATCH helper）        │
└─────────────────┬──────────────────────────┘
                  │ HTTP REST + Bearer JWT
┌─────────────────▼──────────────────────────┐
│         Express API (port 3000)            │
│  routes/index.ts                           │
│  middleware/auth.ts                        │
│    requireAuth（JWT 驗證）                 │
│    requireRole(...roles)（角色守衛）        │
│  controllers/                              │
│    auth │ users │ products                 │
│    purchaseOrders │ printJobs              │
│    imports │ uat                           │
└─────────────────┬──────────────────────────┘
                  │ node-postgres (pg)
┌─────────────────▼──────────────────────────┐
│           PostgreSQL (wmsm)                │
│  users │ products │ purchase_orders        │
│  po_items │ print_jobs                     │
│  print_job_items │ import_batches          │
│  uat_confirmations │ uat_drafts            │
│  import_batch_items │ uat_…               │
│  v_duplicate_prints │ v_print_…           │
└────────────────────────────────────────────┘
```

## 資料表關聯

```
users ──────────────────────────────┐（operator / created_by）
                                    │
suppliers ──┐                       │
            │ supplier_id (nullable)│
purchase_orders ──────────────┐     │
    │ po_id                   │     │
po_items                      │ po_id (nullable)
                         print_jobs ──────────────┐
                              │ job_id             │
                         print_job_items    import_batches
                                                   │ batch_id
                                            import_batch_items
```

## 關鍵設計決策

### 1. Trigger 產生流水號（重要陷阱）
`print_jobs.job_no` 與 `import_batches.batch_no` 使用 BEFORE INSERT Trigger 產生，
而非 DEFAULT 子句。原因：PostgreSQL 在 CREATE TABLE 時會 parse-time 解析 `nextval(regclass)`，
sequence 必須事先存在才不會報錯，trigger 則是 execution-time。

**⚠️ 陷阱：** INSERT 時 **不可傳入** 這兩個欄位，否則 trigger 仍會覆寫。
**必須用 `RETURNING batch_no` / `RETURNING job_no`** 取回 trigger 產生的實際值。
若應用層自行產生 ID 然後帶入 INSERT，回應給前端的值與 DB 儲存的值將不一致，
造成後續查詢永遠 404（見已修正的 `imports.ts` bug）。

### 2. pg Pool 設定
`db.ts` 讀取個別環境變數（`DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD`），
而非單一 `DATABASE_URL`，與 `.env` 格式對齊。

### 3. Pool 連線管理
所有使用 `pool.connect()` 的 controller 將 `connect()` 置於 `try` 內，
並在 `finally` 使用 `client?.release()` 避免連線洩漏。

### 4. 前端錯誤防護
`api/client.ts` 使用 `res.text()` 先讀取 response body，再嘗試 `JSON.parse`，
避免空 body 或非 JSON 回應造成 `SyntaxError`。

### 5. Vite Proxy
開發時前端 proxy `/api/*` 至 `http://localhost:3000`（後端 port），
生產環境需自行設定 Nginx/reverse proxy。

### 6. JWT 驗證與角色型存取控制（RBAC）
使用 `jsonwebtoken`，密碼以 `bcrypt(SHA256(plaintext))` 儲存（SHA256 先固定長度避免 bcrypt 72-byte 截斷）。
Token 有效期 8h，Payload 包含 `{ userId, username, displayName, role }`。

角色分四級：`admin > supervisor > operator > viewer`
- `requireAuth`：驗證 JWT，附加 `req.user`
- `requireRole(...roles)`：檢查 `req.user.role` 是否在允許清單，否則回傳 403
- 公開路由（`/auth/login`、`/auth/forgot-password`）置於 guard 之前

**密碼變更雙軌機制：**
- 使用者自行變更：`POST /api/auth/change-password`（需驗舊密碼，任何登入者）
- 管理員重設：`POST /api/users/:id/reset-password`（admin only，不需舊密碼）

### 7. 優雅關閉（Graceful Shutdown）
`app.ts` 監聽 `SIGTERM` / `SIGINT`（Ctrl+C），執行：
1. `server.close()` — 停止接受新連線，等待現有請求完成
2. `pool.end()` — 釋放資料庫連線池

同時監聽 `server.on('error')`，`EADDRINUSE` 時印出 port kill 指令後退出，
避免誤以為是程式 bug。

## 效期計算邏輯（WMSM020）

三個欄位（製造日期、有效日期、保存期限）填任意兩個，第三個自動計算：

```
mfg + shelf → exp  = addDays(mfg, shelf)
mfg + exp   → shelf = diffDays(mfg, exp)
exp + shelf → mfg  = addDays(exp, -shelf)
```

此邏輯實作於前端 `pages/WMSM020/index.tsx: handleExpiryChange()`。

## Excel 匯入驗證流程（WMSM030）

```
上傳 .xlsx
  → XLSX.read() 解析
  → 逐列驗證（品號存在、數量 > 0、總箱數核算）
  → 分級：ok / warn / error
  → 存入 import_batches + import_batch_items（status: preview）
  → 回傳預覽結果

確認執行
  → 檢查 err_rows = 0
  → 批次 INSERT print_jobs + print_job_items
  → UPDATE import_batches status = executed
```

## UAT 確認簽核流程（UATConfirm + UATHistory）

```
Operator 登入
  → 確認簽核頁面：逐項勾選 + 填寫逐項意見（expandable textarea）
  → 系統自動偵測變動（3 秒 debounce）→ POST /api/uat/draft 暫存草稿
  → 或手動點「立即暫存」
  → 頁面進入時自動 GET /api/uat/draft/latest 載入最新草稿

Supervisor / Admin 登入
  → 確認簽核頁面自動載入 operator 草稿（check_items + item_remarks）
  → 查看意見摘要（紫色區塊列出全部有意見項目）
  → 填寫總體備註、確認人員、日期、結果
  → 點「儲存簽核」→ POST /api/uat/confirm
  → 成功後：清空所有表單，顯示「簽核完成」成功畫面（摘要卡片 + 開始新一輪按鈕）

任何角色
  → 「簽核記錄」頁面（GET /api/uat/history）
  → 可依結果篩選（通過 / 條件通過 / 不通過）
  → 點列展開逐項確認明細與意見
```

**資料表分離設計：**
- `uat_drafts`：operator 草稿，可多次覆寫，不進稽核紀錄
- `uat_confirmations`：supervisor/admin 正式簽核，不可刪改，為稽核依據

## 帳號管理流程（AccountAdmin）

```
admin 登入
  → SideBar 顯示「系統管理 > 帳號管理」
  → GET /api/users 載入帳號列表
  
新增帳號：POST /api/auth/register（role 限 supervisor/operator/viewer）
編輯帳號：PATCH /api/users/:id（display_name / role，不可改 admin 角色）
停用帳號：PATCH /api/users/:id/toggle-active（不可停用自己或 admin）
重設密碼：POST /api/users/:id/reset-password（admin 強制重設，不需舊密碼）

自行變更密碼（任何角色，TopBar 入口）：
  → POST /api/auth/change-password（需驗舊密碼 + 新密碼強度指示）
```
