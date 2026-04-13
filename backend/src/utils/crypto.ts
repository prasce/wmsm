import crypto from 'crypto';

/** SHA-256 hex digest（供密碼前置雜湊使用） */
export function sha256hex(plain: string): string {
  return crypto.createHash('sha256').update(plain, 'utf8').digest('hex');
}
