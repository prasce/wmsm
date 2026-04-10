import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import routes from './routes';
import pool from './db';
import { requireAuth } from './middleware/auth';

dotenv.config();

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET 環境變數未設定，拒絕啟動');
}

const app = express();
const PORT = process.env.PORT ?? 3000;

// 開發模式允許 Vite dev server 跨來源；生產模式同 port 不需 CORS
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? []
  : ['http://localhost:5173', 'http://localhost:3000'];
app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : false,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 診斷：測試 DB 連線 + 列出所有資料表（需要 JWT）
app.get('/api/db-check', requireAuth, async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    res.json({
      status: 'connected',
      tables: result.rows.map((r) => r.table_name),
      db: process.env.DB_NAME,
      user: process.env.DB_USER,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: String(err) });
  }
});

// 生產模式：Express 同時服務前端靜態檔（React SPA）
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
  app.use(express.static(frontendDist));
  // SPA fallback — 所有非 /api 路由都回傳 index.html（交給 React Router）
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// 全域錯誤 middleware — 確保所有未捕捉的錯誤都回傳 JSON（不回傳空 body）
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Unhandled Error]', err);
  res.status(500).json({ success: false, error: '伺服器內部錯誤' });
});

const server = app.listen(PORT, () => {
  console.log(`WMSM Backend 啟動於 http://localhost:${PORT}`);
});

// 優雅關閉：SIGTERM / SIGINT（Ctrl+C）時等現有連線處理完再退出
const shutdown = (signal: string) => {
  console.log(`\n[${signal}] 準備關閉伺服器...`);
  server.close(() => {
    console.log('伺服器已關閉，資料庫連線池釋放中...');
    pool.end().then(() => {
      console.log('資料庫連線池已關閉，程序結束');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// EADDRINUSE：清楚提示 port 衝突，避免誤以為是程式 bug
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[錯誤] Port ${PORT} 已被佔用！`);
    console.error(`請執行以下指令找出並結束佔用程序：`);
    console.error(`  Windows: netstat -ano | findstr :${PORT}  → taskkill /PID <PID> /F`);
    console.error(`  Mac/Linux: lsof -ti:${PORT} | xargs kill -9`);
    process.exit(1);
  } else {
    throw err;
  }
});

export default app;
