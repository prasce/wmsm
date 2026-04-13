import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import pool from '../db';
import { ApiResponse } from '../types';
import { UserRole } from '../middleware/auth';
import { sha256hex } from '../utils/crypto';

const BCRYPT_ROUNDS = 12;

export interface UserRow {
  id: number;
  username: string;
  display_name: string;
  role: UserRole;
  email: string | null;
  active: boolean;
  last_login_at: string | null;
  created_at: string;
}

// GET /api/users — 列出所有帳號（admin only）
export async function listUsers(_req: Request, res: Response): Promise<void> {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query<UserRow>(
      `SELECT id, username, display_name, role, email, active, last_login_at, created_at
       FROM users
       ORDER BY created_at ASC`
    );
    res.json({ success: true, data: result.rows } satisfies ApiResponse<UserRow[]>);
  } catch (err) {
    console.error('[Users/list Error]', err);
    res.status(500).json({ success: false, error: '伺服器錯誤，請稍後再試' } satisfies ApiResponse);
  } finally {
    client?.release();
  }
}

// PATCH /api/users/:id — 更新 display_name / role（admin only）
export async function updateUser(req: Request, res: Response): Promise<void> {
  const targetId = Number(req.params.id);
  const { display_name, role, email } = req.body as {
    display_name?: string;
    role?: string;
    email?: string | null;
  };

  if (!display_name && !role && email === undefined) {
    res.status(400).json({ success: false, error: '請提供 display_name、role 或 email' } satisfies ApiResponse);
    return;
  }

  // email 格式驗證
  if (email !== undefined) {
    const trimmed = email?.trim() ?? null;
    if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      res.status(400).json({ success: false, error: 'email 格式不正確' } satisfies ApiResponse);
      return;
    }
  }

  // 不允許透過 API 將任何人升為 admin
  const allowedRoles: UserRole[] = ['supervisor', 'operator', 'viewer'];
  if (role && !allowedRoles.includes(role as UserRole)) {
    res.status(400).json({ success: false, error: 'role 只允許設為 supervisor / operator / viewer' } satisfies ApiResponse);
    return;
  }

  let client;
  try {
    client = await pool.connect();

    // 確認目標帳號存在
    const check = await client.query('SELECT id, role FROM users WHERE id = $1', [targetId]);
    if ((check.rowCount ?? 0) === 0) {
      res.status(404).json({ success: false, error: '帳號不存在' } satisfies ApiResponse);
      return;
    }

    // 不允許修改 admin 帳號的角色
    if (role && check.rows[0].role === 'admin') {
      res.status(403).json({ success: false, error: '不可變更 admin 帳號的角色' } satisfies ApiResponse);
      return;
    }

    const setClauses: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let idx = 1;

    if (display_name) { setClauses.push(`display_name = $${idx++}`); values.push(display_name.trim()); }
    if (role)         { setClauses.push(`role = $${idx++}`);         values.push(role); }
    if (email !== undefined) {
      const trimmedEmail = email?.trim() ?? null;
      setClauses.push(`email = $${idx++}`);
      values.push(trimmedEmail || null);  // 空字串轉 NULL
    }
    values.push(targetId);

    const result = await client.query<UserRow>(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${idx}
       RETURNING id, username, display_name, role, email, active, last_login_at, created_at`,
      values
    );

    res.json({ success: true, data: result.rows[0], message: '帳號已更新' } satisfies ApiResponse<UserRow>);
  } catch (err) {
    console.error('[Users/update Error]', err);
    res.status(500).json({ success: false, error: '伺服器錯誤，請稍後再試' } satisfies ApiResponse);
  } finally {
    client?.release();
  }
}

// PATCH /api/users/:id/toggle-active — 啟用 / 停用帳號（admin only，不可停用自己）
export async function toggleActive(req: Request, res: Response): Promise<void> {
  const targetId = Number(req.params.id);
  const operatorId = req.user!.userId;

  if (targetId === operatorId) {
    res.status(400).json({ success: false, error: '不可停用自己的帳號' } satisfies ApiResponse);
    return;
  }

  let client;
  try {
    client = await pool.connect();

    const check = await client.query('SELECT id, role, active FROM users WHERE id = $1', [targetId]);
    if ((check.rowCount ?? 0) === 0) {
      res.status(404).json({ success: false, error: '帳號不存在' } satisfies ApiResponse);
      return;
    }

    // 不允許停用其他 admin
    if (check.rows[0].role === 'admin') {
      res.status(403).json({ success: false, error: '不可停用 admin 帳號' } satisfies ApiResponse);
      return;
    }

    const newActive = !check.rows[0].active;
    const result = await client.query<UserRow>(
      `UPDATE users SET active = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, username, display_name, role, email, active, last_login_at, created_at`,
      [newActive, targetId]
    );

    res.json({
      success: true,
      data: result.rows[0],
      message: newActive ? '帳號已啟用' : '帳號已停用',
    } satisfies ApiResponse<UserRow>);
  } catch (err) {
    console.error('[Users/toggleActive Error]', err);
    res.status(500).json({ success: false, error: '伺服器錯誤，請稍後再試' } satisfies ApiResponse);
  } finally {
    client?.release();
  }
}

// POST /api/users/:id/reset-password — 管理員強制重設他人密碼（admin only）
export async function resetPassword(req: Request, res: Response): Promise<void> {
  const targetId = Number(req.params.id);
  const { new_password } = req.body as { new_password?: string };

  if (!new_password || new_password.length < 8) {
    res.status(400).json({ success: false, error: '新密碼至少 8 個字元' } satisfies ApiResponse);
    return;
  }

  let client;
  try {
    client = await pool.connect();

    const check = await client.query('SELECT id, role FROM users WHERE id = $1', [targetId]);
    if ((check.rowCount ?? 0) === 0) {
      res.status(404).json({ success: false, error: '帳號不存在' } satisfies ApiResponse);
      return;
    }

    // W1 修正：不可重設 admin 帳號密碼（防止 admin 互相覆蓋）
    if (check.rows[0].role === 'admin') {
      res.status(403).json({ success: false, error: '不可重設 admin 帳號密碼' } satisfies ApiResponse);
      return;
    }

    const newHash = await bcrypt.hash(sha256hex(new_password), BCRYPT_ROUNDS);
    await client.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, targetId]
    );

    res.json({ success: true, message: '密碼已重設' } satisfies ApiResponse);
  } catch (err) {
    console.error('[Users/resetPassword Error]', err);
    res.status(500).json({ success: false, error: '伺服器錯誤，請稍後再試' } satisfies ApiResponse);
  } finally {
    client?.release();
  }
}
