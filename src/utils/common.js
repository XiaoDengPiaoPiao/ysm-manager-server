import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export function fixFilenameEncoding(filename) {
  try {
    return decodeURIComponent(escape(filename));
  } catch (e) {
    try {
      const buffer = Buffer.from(filename, 'latin1');
      return buffer.toString('utf8');
    } catch (e2) {
      return filename;
    }
  }
}

export function generateRandomString(length) {
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

export function generateToken(username) {
  const randomString = generateRandomString(16);
  const timestamp = Date.now().toString();
  const rawToken = `${username}:${randomString}:${timestamp}`;
  return crypto.createHash('md5').update(rawToken).digest('hex');
}

export function generateRandomPassword() {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const allChars = uppercase + lowercase + numbers;
  let password = '';

  password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
  password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
  password += numbers.charAt(Math.floor(Math.random() * numbers.length));

  for (let i = 0; i < 5; i++) {
    password += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }

  return password.split('').sort(() => 0.5 - Math.random()).join('');
}

export function calculateFileHash(fileBuffer) {
  return crypto.createHash('md5').update(fileBuffer).digest('hex');
}

export function parseYsmMetadata(fileBuffer) {
  const content = fileBuffer.toString('utf8');
  const metadata = {
    name: '',
    free: false,
    hash: ''
  };

  const nameMatch = content.match(/<name>\s*(.+?)\s*(?:\n|$)/);
  if (nameMatch) {
    metadata.name = nameMatch[1].trim();
  }

  const freeMatch = content.match(/<free>\s*(true|false)\s*/i);
  if (freeMatch) {
    metadata.free = freeMatch[1].toLowerCase() === 'true';
  }

  metadata.hash = calculateFileHash(fileBuffer);

  return metadata;
}

export async function saveYsmFile(fileBuffer, fileName, dirType = 'custom') {
  const baseDir = process.env.YSM_MODEL_DIR || './ysm_models';
  const targetDir = path.join(baseDir, dirType);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const filePath = path.join(targetDir, fileName);
  fs.writeFileSync(filePath, fileBuffer);

  return filePath;
}

export function success(res, data, message = '操作成功') {
  return res.json({
    code: 200,
    message,
    data,
    timestamp: new Date().toISOString()
  });
}

export function error(res, message = '操作失败', code = 400) {
  return res.status(code).json({
    code,
    message,
    timestamp: new Date().toISOString()
  });
}

export function sanitizeInput(input) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
