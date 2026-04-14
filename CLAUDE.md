# 專案記憶 — CLAUDE.md

## 專案概覽
**WMSM 麥頭印標系統** — 倉儲進貨標籤套印管理系統。

- 前端：React 18 + TypeScript（Vite，port 5173）
- 後端：Express + TypeScript（ts-node-dev，port 3000）
- 資料庫：PostgreSQL（DB 名稱：`wmsm`）
- 標籤機：Zebra ZT230

## 工作守則
- 所有架構決策記錄於 `docs/decisions/`
- 需要對外操作（push、PR、刪除）一律先確認
- 修改程式碼前必須先讀取相關檔案
- 不過度設計，只做當下需要的事
- `pool.connect()` 必須放在 `try` 內，搭配 `client?.release()` 防止連線洩漏

## 目錄結構
```
wmsm/
├── CLAUDE.md                       ← 專案記憶（你在這裡）
├── README.md                       ← 快速啟動指南
├── database/
│   ├── schema.sql                  ← PostgreSQL DDL + 種子資料
│   └── migrations/
│       ├── 001_add_users.sql           ← users 資料表
│       ├── 002_add_import_print_batch.sql
│       ├── 003_add_supervisor_role.sql ← 新增 supervisor 角色
│       ├── 004_add_uat_item_remarks.sql ← uat_confirmations 加入 item_remarks JSONB
│       ├── 005_add_uat_drafts.sql      ← uat_drafts 草稿資料表
│       └── 006_email_notify_index.sql  ← 收件人查詢 partial index
├── backend/                        ← Express + TypeScript
│   ├── .env                        ← DB + JWT 設定（已建立）
│   ├── .env.example
│   ├── src/
│   │   ├── app.ts                  ← 入口 + 全域錯誤 middleware + 優雅關閉（SIGINT/SIGTERM）
│   │   ├── db.ts                   ← pg Pool（讀 DB_HOST/USER/PASSWORD）
│   │   ├── types/index.ts
│   │   ├── routes/index.ts         ← 公開路由 + requireAuth + requireRole 守衛
│   │   ├── middleware/
│   │   │   └── auth.ts             ← requireAuth JWT + requireRole(...roles) middleware
│   │   └── controllers/
│   │       ├── auth.ts             ← login / register / forgotPassword / changePassword
│   │       ├── products.ts
│   │       ├── purchaseOrders.ts
│   │       ├── printJobs.ts
│   │       ├── imports.ts          ← xlsx 解析 + 驗證
│   │       ├── users.ts            ← listUsers / updateUser / toggleActive / resetPassword
│   │       └── uat.ts              ← saveUATConfirmation / saveDraft（暫存前刪舊草稿）/ getLatestDraft / getUATHistory
│   └── package.json
├── frontend/                       ← React + TSX + Vite
│   ├── public/
│   │   └── WMSM030_template.xlsx   ← Excel 範本（靜態檔案）
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx                 ← authUser 狀態 + LoginPage guard + AccountAdmin 路由
│   │   ├── types/index.ts          ← UserRole / ROLE_LABEL / UserAccount 型別
│   │   ├── api/client.ts           ← fetch 封裝（JWT + PATCH helper + 帳號管理 API）
│   │   ├── components/
│   │   │   ├── TopBar.tsx          ← 角色徽章 + 🔑 帳號變更密碼入口
│   │   │   ├── SideBar.tsx         ← 依角色動態顯示選單項目
│   │   │   ├── ChangePasswordModal.tsx ← 共用變更/重設密碼 Modal（密碼強度指示器）
│   │   │   ├── StepNav.tsx
│   │   │   └── Toast.tsx
│   │   ├── pages/
│   │   │   ├── Login/index.tsx     ← 登入頁（右側「請洽倉儲管理部門」）
│   │   │   ├── WMSM020/index.tsx   ← 手動套印
│   │   │   ├── WMSM030/index.tsx   ← Excel 批次匯入（含下載範本 + 標籤預覽）
│   │   │   ├── LabelPreview/index.tsx
│   │   │   ├── PrintHistory/index.tsx
│   │   │   ├── UATConfirm/index.tsx    ← 確認簽核（草稿自動存擋 + draftJustLoaded ref + 主管簽核 + 完成成功畫面）
│   │   │   ├── UATHistory/index.tsx   ← 簽核記錄查詢（篩選 / 展開逐項明細）
│   │   │   └── AccountAdmin/index.tsx ← 帳號管理（列表 / 新增 / 編輯 / 停用 / 重設密碼）
│   │   ├── utils/
│   │   │   └── printLabels.ts      ← 8cm×11cm 標籤列印（每頁一張）
│   │   └── styles/globals.css
│   └── vite.config.ts              ← proxy /api → localhost:3000
├── docs/
│   ├── architecture.md
│   ├── decisions/                  ← ADR 架構決策紀錄
│   └── runbooks/                   ← 操作手冊
└── .claude/skills/                 ← /code-review /refactor /release
```

## 角色權限矩陣
| 功能 | admin | supervisor | operator | viewer |
|------|:---:|:---:|:---:|:---:|
| 建立列印 / Excel 匯入 | ✅ | ✅ | ✅ | ❌ |
| UAT 頁面填寫確認項目 | ✅ | ✅ | ✅ | ❌ |
| UAT 草稿暫存（儲存確認進度）| ✅ | ✅ | ✅ | ❌ |
| UAT 主管簽核（提交）| ✅ | ✅ | ❌ | ❌ |
| 查看簽核記錄 | ✅ | ✅ | ✅ | ✅ |
| 查看歷史 / 標籤 | ✅ | ✅ | ✅ | ✅ |
| 帳號管理頁面 | ✅ | ❌ | ❌ | ❌ |
| 建立帳號（API register）| ✅ | ❌ | ❌ | ❌ |
| 自行變更密碼 | ✅ | ✅ | ✅ | ✅ |
| 重設他人密碼 | ✅ | ❌ | ❌ | ❌ |

> supervisor 可進入 WMSM020/030 操作功能，方便在簽核前親自驗證 operator 反映的問題。

## 帳號管理政策
- 帳號由 admin 透過 `POST /api/auth/register` 建立，**不提供公開自助註冊**
- `admin` 帳號為種子資料，不可由 API 建立（`allowedRoles` 強制排除）
- 停用 / 角色變更不可針對 `admin` 帳號（controller 層防護）
- 密碼儲存：`bcrypt(SHA256(plaintext))`，BCRYPT_ROUNDS = 12

## 已知重要修正
| 問題 | 根因 | 解法 |
|------|------|------|
| schema.sql 報 `relation does not exist` | `DEFAULT nextval()` 在 parse time 解析 regclass | 改用 BEFORE INSERT Trigger |
| 後端 500 空 body | `pool.connect()` 在 try 外，unhandled rejection | 移進 try，改用 `let client` + `client?.release()` |
| 前端 SyntaxError empty JSON | `res.json()` 無防護 | 改用 `res.text()` + try JSON.parse |
| API 全部 500 | Vite proxy 指向 port 3001，後端在 3000 | `vite.config.ts` 改為 port 3000 |
| WMSM030 execute 永遠 404 | `import_batches` BEFORE INSERT Trigger 覆寫 `batch_no` | INSERT 不傳 `batch_no`，改用 `RETURNING id, batch_no` |
| 標籤列印一頁出現 4 張 | `printLabels.ts` 使用 A4 尺寸排版 | 改為 `@page { size: 8cm 11cm; margin: 0 }` |
| EADDRINUSE port 衝突 | process 未正常關閉 | `server.on('error')` 攔截並印出 kill 指令；SIGINT/SIGTERM 優雅關閉 |
| UAT 草稿暫存 500 | `uat_drafts` 資料表未建立 | 執行 Migration 005；controller 加入 "relation does not exist" 偵測給出明確提示 |
| 郵件內容 HTML injection | `buildHtml` 直接嵌入使用者輸入（remark / savedBy）| `email.ts` 加入 `escapeHtml()`，套用所有使用者欄位 |
| SMTP To header injection | `display_name` 拼接為字串傳入 `to` | 改傳 `{ name, address }[]` 物件陣列，由 nodemailer 安全處理 |
| 草稿載入後立即觸發自動暫存 | `setChecked / setItemRemarks` 觸發 auto-save `useEffect` | 加入 `draftJustLoaded` ref，草稿載入後跳過當次觸發 |
| `uat_drafts` 無限累積 | 每次暫存新增一列，從未清除 | `saveDraft` 前先 `DELETE FROM uat_drafts WHERE saved_by = $1` |

## ⚠️ Trigger 產生欄位注意事項
`print_jobs.job_no` 與 `import_batches.batch_no` 均由 **BEFORE INSERT Trigger** 自動產生，
應用層 **不可** 在 INSERT 語句中傳入這兩個欄位。
取回 trigger 產生的值必須使用 `RETURNING job_no` / `RETURNING id, batch_no`。

## 環境設定（backend/.env）
```
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=wmsm
DB_USER=postgres
DB_PASSWORD=（你的密碼）
JWT_SECRET=（32 bytes random hex，見 .env）
JWT_EXPIRES_IN=8h
```

## 常用指令
```bash
# 後端開發
cd backend && npm run dev

# 前端開發
cd frontend && npm run dev

# DB 診斷
curl http://localhost:3000/api/db-check

# 取得 JWT（登入）
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@1234"}'

# 建立使用者帳號（需 admin JWT）
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"username":"user1","password":"Pass@1234","displayName":"王小明","role":"operator"}'

# 套用 Migration 003（新增 supervisor 角色）
psql -U postgres -d wmsm -f database/migrations/003_add_supervisor_role.sql

# 套用 Migration 004（UAT 逐項意見欄位）
psql -U postgres -d wmsm -f database/migrations/004_add_uat_item_remarks.sql

# 套用 Migration 005（UAT 草稿資料表）
psql -U postgres -d wmsm -f database/migrations/005_add_uat_drafts.sql

# 套用 Migration 006（UAT 通知郵件收件人 index）
psql -U postgres -d wmsm -f database/migrations/006_email_notify_index.sql
```
