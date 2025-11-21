const fs = require('fs');
const path = require('path');

const BASE_FILE = path.join(__dirname, '..', 'clash.yaml');  // 基础配置文件路径
const USERS_FILE = path.join(__dirname, '..', 'users.txt');  // 用户信息文件路径
const SUBS_DIR = path.join(__dirname, '..', 'clash');  // 存放用户订阅文件的目录
const EXPIRED_LOG_FILE = path.join(__dirname, '..', 'expired_users.txt');  // 过期用户日志文件路径

// 加载 clash.yaml 配置文件
function loadBase() {
  if (!fs.existsSync(BASE_FILE)) {
    throw new Error('clash.yaml 不存在，请先创建 clash.yaml');
  }
  return fs.readFileSync(BASE_FILE, 'utf8');
}

// 读取 users.txt 文件并解析用户数据
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    return [];
  }

  const data = fs.readFileSync(USERS_FILE, 'utf8');
  const lines = data.split('\n');

  const users = lines.map(line => {
    const [token, expireAt] = line.split(' ').map(item => item.trim());
    if (token && expireAt) {
      return { token, expireAt: `${expireAt}T00:00:00Z` };  // 将 expireAt 转换为 ISO 格式
    }
    return null;
  }).filter(user => user !== null);

  return users;
}

// 确保 clash 目录存在
function ensureSubsDir() {
  if (!fs.existsSync(SUBS_DIR)) {
    fs.mkdirSync(SUBS_DIR, { recursive: true });
  }
}

// 判断一个用户是否过期（基于中国时间）
function isExpired(expireAt) {
  const now = new Date();
  const chinaTimeOffset = 8 * 60 * 60 * 1000;  // 中国时间偏移（8小时）

  // 将当前时间转换为中国时间
  const chinaTime = new Date(now.getTime() + chinaTimeOffset);

  // 将 expireAt 转换为 Date 对象，确保是中国时间
  const exp = new Date(expireAt);

  // 比较用户的到期时间和当前的中国时间
  return exp.getTime() <= chinaTime.getTime();  // 如果到期时间 <= 当前时间，返回 true，表示已过期
}

// 从 users.txt 中删除已过期用户
function removeExpiredUserFromFile(users, token) {
  return users.filter(user => user.token !== token);
}

// 写入过期用户日志
function logExpiredUser(token, expireAt) {
  const logMessage = `用户 ${token} 已过期，过期时间：${expireAt.split('T')[0]}\n`;
  fs.appendFileSync(EXPIRED_LOG_FILE, logMessage, 'utf8');
}

// 主逻辑
function main() {
  const baseContent = loadBase();  // 加载 clash.yaml 配置
  let users = loadUsers();  // 加载 users.txt 文件
  ensureSubsDir();  // 确保 clash 目录存在

  const existingFiles = new Set(
    fs.readdirSync(SUBS_DIR)
      .filter(f => f.endsWith('.yaml'))  // 获取所有以 .yaml 结尾的文件
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
    const expired = isExpired(expireAt);  // 判断是否过期

    if (expired) {
      // 如果用户过期，删除订阅文件并从 users.txt 中删除该用户
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`删除过期订阅文件: ${filename}`);
        deleted++;
      }

      // 记录过期用户
      logExpiredUser(token, expireAt);
      
      // 从 users.txt 中删除该行
      users = removeExpiredUserFromFile(users, token);
      existingFiles.delete(filename);
    } else {
      // 用户未过期，确保订阅文件存在
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
