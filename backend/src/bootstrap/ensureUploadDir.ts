import fs from 'node:fs';
import path from 'node:path';
import type { Env } from '../config/env.js';

export function ensureUploadDir(env: Env): string {
  const abs = path.resolve(process.cwd(), env.UPLOAD_DIR);
  fs.mkdirSync(abs, { recursive: true });
  return abs;
}
