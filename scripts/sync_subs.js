const fs = require('fs');
const path = require('path');

const BASE_FILE = path.join(__dirname, '..', 'clash.yaml');  // 改为 clash.yaml
const USERS_FILE = path.join(__dirname, '..', 'users.json');
const SUBS_DIR = path.join(__dirname, '..', 'clash');  // 改为 clash 目录

function loadBase() {
  if (!fs.existsSync(BASE_FILE)) {
    throw new Error('clash.yaml 不存在，请先创建 clash.yaml');
  }
  return fs.readFileSync(BASE_FILE, 'utf8');
}

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    return [];
  }
  const raw = fs.readFileSync(USERS_FILE, 'utf8');
  if (!raw.trim()) return [];
  return JSON.parse(raw);
}

function ensureSubsDir() {
  if (!fs.existsSync(SUBS_DIR)) {
    fs.mkdirSync(SUBS_DIR, { recursive: true });
  }
}

function isExpired(expireAt) {
  const now = new Date();
  const exp = new Date(expireAt);
  return exp.getTime() <= now.getTime();
}

function main() {
  const baseContent = loadBase();
  const users = loadUsers();
  ensureSubsDir();

  const existingFiles = new Set(
    fs.readdirSync(SUBS_DIR)
      .filter(f => f.endsWith('.yaml'))
  );

  let created = 0;
  let deleted = 0;

  for (const user of users) {
    const token = user.token;
    const expireAt = user.expireAt;
    if (!token || !expireAt) continue;

    const filename = `${token}.yaml`;
    const filePath = path.join(SUBS_DIR, filename);
    const expired = isExpired(expireAt);

    if (expired) {
      // 过期：如果文件还在，删掉
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`删除过期订阅文件: ${filename}`);
        deleted++;
      }
      existingFiles.delete(filename);
    } else {
      // 未过期：保证文件存在
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, baseContent, 'utf8');
        console.log(`创建订阅文件: ${filename}`);
        created++;
      }
      existingFiles.delete(filename);
    }
  }

  // existingFiles 里剩下的是：clash 目录里有，但 users.json 已经删掉的
  for (const filename of existingFiles) {
    const filePath = path.join(SUBS_DIR, filename);
    fs.unlinkSync(filePath);
    console.log(`清理无主订阅文件: ${filename}`);
    deleted++;
  }

  console.log(`同步完成：创建 ${created} 个，删除 ${deleted} 个`);
}

main();
