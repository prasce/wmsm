import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db';
import { ApiResponse } from '../types';
import { AuthPayload } from '../middleware/auth';

const BCRYPT_ROUNDS = 12;

function sha256hex(plain: string): string {
  return crypto.createHash('sha256').update(plain, 'utf8').digest('hex');
}

// POST /api/auth/login
export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ success: false, error: '請輸入帳號與密碼' } satisfies ApiResponse);
    return;
  }

  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      `SELECT id, username, display_name, role, password_hash, active
       FROM users WHERE username = $1`,
      [username.trim()]
    );

    const user = result.rows[0];

    // 相同錯誤訊息，防止帳號枚舉
    if (!user || !user.active) {
      res.status(401).json({ success: false, error: '帳號或密碼錯誤' } satisfies ApiResponse);
      return;
    }

    const sha256Password = sha256hex(password);
    const passwordMatch = await bcrypt.compare(sha256Password, user.password_hash);

    if (!passwordMatch) {
      res.status(401).json({ success: false, error: '帳號或密碼錯誤' } satisfies ApiResponse);
      return;
    }

    // Fix C2: 使用 pool.query 而非 client.query，避免在 client.release() 後使用同一連線
    pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]).catch((e) => {
      console.error('[Auth/login] last_login_at 更新失敗', e);
    });

    const payload: AuthPayload = {
      userId: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: (process.env.JWT_EXPIRES_IN ?? '8h') as jwt.SignOptions['expiresIn'],
    });

    res.json({
      success: true,
      data: { token, user: payload },
      message: '登入成功',
    } satisfies ApiResponse);
  } catch (err) {
    // Fix W3: 不洩漏內部錯誤細節
    console.error('[Auth/login Error]', err);
    res.status(500).json({ success: false, error: '伺服器錯誤，請稍後再試' } satisfies ApiResponse);
  } finally {
    client?.release();
  }
}

// POST /api/auth/register（需要 admin JWT，Fix W1 + C1）
export async function register(req: Request, res: Response): Promise<void> {
  // Fix W1: 只有 admin 可建立帳號
  if (req.user?.role !== 'admin') {
    res.status(403).json({ success: false, error: '僅系統管理員可建立帳號' } satisfies ApiResponse);
    return;
  }

  const { username, password, displayName, role } = req.body as {
    username?: string;
    password?: string;
    displayName?: string;
    role?: string;
  };

  if (!username || !password) {
    res.status(400).json({ success: false, error: '帳號與密碼為必填' } satisfies ApiResponse);
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ success: false, error: '密碼至少 8 個字元' } satisfies ApiResponse);
    return;
  }

  // Fix C1: 只允許 operator / viewer，admin 帳號不可由 API 建立
  const allowedRoles = ['operator', 'viewer'];
  const userRole = allowedRoles.includes(role ?? '') ? role : 'operator';

  let client;
  try {
    client = await pool.connect();

    const exists = await client.query('SELECT id FROM users WHERE username = $1', [username.trim()]);
    if ((exists.rowCount ?? 0) > 0) {
      res.status(409).json({ success: false, error: '帳號已存在' } satisfies ApiResponse);
      return;
    }

    const sha256Password = sha256hex(password);
    const hash = await bcrypt.hash(sha256Password, BCRYPT_ROUNDS);

    const result = await client.query(
      `INSERT INTO users (username, display_name, role, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, display_name, role, created_at`,
      [username.trim(), displayName?.trim() ?? username.trim(), userRole, hash]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: '帳號建立成功',
    } satisfies ApiResponse);
  } catch (err) {
    console.error('[Auth/register Error]', err);
    res.status(500).json({ success: false, error: '伺服器錯誤，請稍後再試' } satisfies ApiResponse);
  } finally {
    client?.release();
  }
}

// POST /api/auth/forgot-password（Stub — 無 Email 基礎設施）
export async function forgotPassword(_req: Request, res: Response): Promise<void> {
  // 固定回傳 200，防止帳號枚舉
  res.json({
    success: true,
    message: '若帳號存在，請聯絡系統管理員重置密碼。',
  } satisfies ApiResponse);
}
