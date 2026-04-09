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
0326wome/
├── CLAUDE.md                       ← 專案記憶（你在這裡）
├── README.md                       ← 快速啟動指南
├── database/
│   ├── schema.sql                  ← PostgreSQL DDL + 種子資料
│   └── migrations/
│       └── 001_add_users.sql       ← users 資料表
├── backend/                        ← Express + TypeScript
│   ├── .env                        ← DB + JWT 設定（已建立）
│   ├── .env.example
│   ├── src/
│   │   ├── app.ts                  ← 入口 + 全域錯誤 middleware（JWT_SECRET 防呆）
│   │   ├── db.ts                   ← pg Pool（讀 DB_HOST/USER/PASSWORD）
│   │   ├── types/index.ts
│   │   ├── routes/index.ts         ← 公開路由 + requireAuth guard
│   │   ├── middleware/
│   │   │   └── auth.ts             ← requireAuth JWT middleware
│   │   └── controllers/
│   │       ├── auth.ts             ← login / register / forgotPassword
│   │       ├── products.ts
│   │       ├── purchaseOrders.ts
│   │       ├── printJobs.ts
│   │       ├── imports.ts          ← xlsx 解析 + 驗證
│   │       └── uat.ts
│   └── package.json
├── frontend/                       ← React + TSX + Vite
│   ├── public/
│   │   └── WMSM030_template.xlsx   ← Excel 範本（靜態檔案）
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx                 ← authUser 狀態 + LoginPage guard
│   │   ├── types/index.ts
│   │   ├── api/client.ts           ← fetch 封裝（JWT token store + 401 自動登出）
│   │   ├── components/             ← TopBar / StepNav / SideBar / Toast
│   │   ├── pages/
│   │   │   ├── Login/index.tsx     ← 登入頁（左白右綠分割版面）
│   │   │   ├── WMSM020/index.tsx   ← 手動套印
│   │   │   ├── WMSM030/index.tsx   ← Excel 批次匯入（含下載範本 + 標籤預覽）
│   │   │   ├── LabelPreview/index.tsx
│   │   │   ├── PrintHistory/index.tsx
│   │   │   └── UATConfirm/index.tsx
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

## 已知重要修正
| 問題 | 根因 | 解法 |
|------|------|------|
| schema.sql 報 `relation does not exist` | `DEFAULT nextval()` 在 parse time 解析 regclass | 改用 BEFORE INSERT Trigger |
| 後端 500 空 body | `pool.connect()` 在 try 外，unhandled rejection | 移進 try，改用 `let client` + `client?.release()` |
| 前端 SyntaxError empty JSON | `res.json()` 無防護 | 改用 `res.text()` + try JSON.parse |
| API 全部 500 | Vite proxy 指向 port 3001，後端在 3000 | `vite.config.ts` 改為 port 3000 |
| WMSM030 execute 永遠 404 | `import_batches` BEFORE INSERT Trigger 覆寫 `batch_no`，TS 自產的值從未進 DB | INSERT 不傳 `batch_no`，改用 `RETURNING id, batch_no` 取回 trigger 產生值 |
| 標籤列印一頁出現 4 張 | `printLabels.ts` 使用 A4 尺寸排版 | 改為 `@page { size: 8cm 11cm; margin: 0 }`，每張 label `page-break-after: always` |

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
  -d '{"username":"user1","password":"Pass@1234","displayName":"倉儲人員"}'
```
