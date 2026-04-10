# WMSM 麥頭印標系統

倉儲管理系統模組（WMSM）— 進貨麥頭標籤套印、Excel 批次匯入、列印紀錄查詢、角色型帳號管理。
已配置 Claude Code 常駐工程師環境。

---

## 技術堆疊

| 層次 | 技術 |
|------|------|
| 前端 | React 18 + TypeScript + Vite |
| 後端 | Node.js + Express + TypeScript |
| 資料庫 | PostgreSQL |
| 標籤機 | Zebra ZT230（條碼列印） |

---

## 快速啟動

### 1. 建立資料庫

```bash
createdb wmsm
psql wmsm -f database/schema.sql
psql wmsm -f database/migrations/001_add_users.sql
psql wmsm -f database/migrations/002_add_import_print_batch.sql
psql wmsm -f database/migrations/003_add_supervisor_role.sql
psql wmsm -f database/migrations/004_add_uat_item_remarks.sql
psql wmsm -f database/migrations/005_add_uat_drafts.sql
```

### 2. 後端

```bash
cd backend
cp .env.example .env        # 填入 DB_PASSWORD 與 JWT_SECRET
npm install
npm run dev                  # 啟動於 http://localhost:3000
```

### 3. 前端

```bash
cd frontend
npm install
npm run dev                  # 啟動於 http://localhost:5173
```

> Vite 自動 proxy `/api/*` → `http://localhost:3000`

---

## 功能模組

| 模組 | 入口 | 可用角色 | 說明 |
|------|------|---------|------|
| WMSM020 | SideBar → 進貨作業 | admin / supervisor / operator | 手動套印（PO 查詢、效期三選二、品項明細） |
| WMSM030 | SideBar → 進貨作業 | admin / supervisor / operator | Excel 批次匯入（.xlsx 驗證預覽） |
| 標籤預覽 | SideBar → 標籤與紀錄 | 全角色 | 8×11cm 標籤樣式確認 |
| 列印紀錄 | SideBar → 標籤與紀錄 | 全角色 | 歷史查詢、重複列印偵測 |
| 確認簽核 | SideBar → 驗收 | 全角色（簽核限 admin/supervisor）| UAT 逐項確認 + 草稿自動暫存 + 主管簽核 |
| 簽核記錄 | SideBar → 驗收 | 全角色 | 查詢歷史 UAT 簽核（篩選 / 展開逐項明細） |
| 帳號管理 | SideBar → 系統管理 | admin | 建立/編輯/停用帳號、重設密碼 |
| 變更密碼 | TopBar 帳號名稱 🔑 | 全角色 | 使用者自行變更密碼（需驗舊密碼） |

---

## 角色系統

| 角色 | 說明 |
|------|------|
| `admin` | 全部功能 + 帳號管理（種子帳號，不可透過 API 建立）|
| `supervisor` | 查看所有資料 + UAT 確認簽核 |
| `operator` | 查看 + 建立列印作業 + Excel 匯入 |
| `viewer` | 唯讀：僅可查看標籤與列印紀錄 |

---

## API 端點

### 公開（不需 Token）
| Method | 路徑 | 說明 |
|--------|------|------|
| POST | `/api/auth/login` | 登入，回傳 JWT |
| POST | `/api/auth/forgot-password` | 密碼提示（Stub） |

### 已登入（需 Bearer JWT）
| Method | 路徑 | 最低角色 | 說明 |
|--------|------|---------|------|
| POST | `/api/auth/change-password` | 全角色 | 自行變更密碼（需驗舊密碼） |
| POST | `/api/auth/register` | admin | 建立新帳號 |
| GET | `/api/users` | admin | 列出所有帳號 |
| PATCH | `/api/users/:id` | admin | 更新顯示名稱 / 角色 |
| PATCH | `/api/users/:id/toggle-active` | admin | 啟用 / 停用帳號 |
| POST | `/api/users/:id/reset-password` | admin | 強制重設他人密碼 |
| GET | `/api/products/:code` | 全角色 | 查詢商品 |
| GET | `/api/products/search?q=` | 全角色 | 模糊搜尋商品 |
| GET | `/api/purchase-orders/:poNo` | 全角色 | 查詢採購單含明細 |
| POST | `/api/print-jobs` | operator+ | 建立列印作業 |
| GET | `/api/print-history` | 全角色 | 列印歷史（篩選、分頁） |
| GET | `/api/print-stats` | 全角色 | 本月 / 今日統計 |
| GET | `/api/operators` | 全角色 | 操作人員清單 |
| POST | `/api/import/preview` | operator+ | 上傳 .xlsx 驗證預覽 |
| POST | `/api/import/execute` | operator+ | 執行批次列印 |
| POST | `/api/uat/confirm` | supervisor+ | 儲存 UAT 簽核 |
| POST | `/api/uat/draft` | 全角色 | 儲存 UAT 草稿（確認進度暫存）|
| GET | `/api/uat/draft/latest` | 全角色 | 取得最新一筆 UAT 草稿 |
| GET | `/api/uat/history` | 全角色 | 查詢 UAT 簽核紀錄（最近 100 筆）|
| GET | `/api/db-check` | 全角色 | DB 連線診斷 |
| GET | `/health` | 公開 | 服務健康檢查 |

---

## Claude Code 指令

```
/code-review    程式碼審查
/refactor       重構建議
/release        準備發布
```

---

## 專案文件

- [架構總覽](docs/architecture.md)
- [架構決策紀錄](docs/decisions/)
- [操作手冊](docs/runbooks/)
- [快速啟動](docs/runbooks/quickstart.md)
