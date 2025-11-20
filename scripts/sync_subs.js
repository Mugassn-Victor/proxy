const fs = require('fs');
const path = require('path');

const BASE_FILE = path.join(__dirname, '..', 'clash.yaml');  // 基础配置
const USERS_FILE = path.join(__dirname, '..', 'users.txt');  // 使用简洁格式的用户文件
const SUBS_DIR = path.join(__dirname, '..', 'clash');  // 存放用户订阅文件的目录

function loadBase() {
  if (!fs.existsSync(BASE_FILE)) {
    throw new Error('clash.yaml 不存在，请先创建 clash.yaml');
  }
  return fs.readFileSync(BASE_FILE, 'utf8');
}

// 读取用户文件并解析
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    return [];
  }
  
  const data = fs.readFileSync(USERS_FILE, 'utf8');
  const lines = data.split('\n');
  
  const users = lines.map(line => {
    const [token, expireAt] = line.split(' ').map(item => item.trim());
    if (token && expireAt) {
      return { token, expireAt: `${expireAt}T00:00:00Z` };  // 将 expireAt 转换为 ISO 8601 格式
    }
    return null;
  }).filter(user => user !== null);

  return users;
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

function removeExpiredUserFromFile(users, token) {
  // 删除已过期用户的行
  return users.filter(user => user.token !== token);
}

function main() {
  const baseContent = loadBase();
  let users = loadUsers();
  ensureSubsDir();

  const existingFiles = new Set(
    fs.readdirSync(SUBS_DIR)
      .filter(f => f.endsWith('.yaml'))
  );

  let created = 0;
  let deleted = 0;

  // 处理每个用户
  for (const user of users) {
    const token = user.token;
    const expireAt = user.expireAt;
    if (!token || !expireAt) continue;

    const filename = `${token}.yaml`;
    const filePath = path.join(SUBS_DIR, filename);
    const expired = isExpired(expireAt);

    if (expired) {
      // 过期：删除订阅文件和删除 users.txt 中对应的行
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`删除过期订阅文件: ${filename}`);
        deleted++;
      }
      // 删除 users.txt 中的该行
      users = removeExpiredUserFromFile(users, token);
      existingFiles.delete(filename);
    } else {
      // 未过期：确保订阅文件存在
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, baseContent, 'utf8');
        console.log(`创建订阅文件: ${filename}`);
        created++;
      }
      existingFiles.delete(filename);
    }
  }

  // 清理掉 `clash/` 中存在，但 `users.txt` 中已没有的订阅文件
  for (const filename of existingFiles) {
    const filePath = path.join(SUBS_DIR, filename);
    fs.unlinkSync(filePath);
    console.log(`清理无主订阅文件: ${filename}`);
    deleted++;
  }

  // 将更新后的用户列表写回 `users.txt` 文件
  fs.writeFileSync(USERS_FILE, users.map(user => `${user.token} ${user.expireAt.split('T')[0]}`).join('\n'), 'utf8');

  console.log(`同步完成：创建 ${created} 个，删除 ${deleted} 个`);
}

main();
