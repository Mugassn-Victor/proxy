const fs = require('fs');
const path = require('path');

const BASE_FILE = path.join(__dirname, '..', 'clash.yaml');  // 基础配置文件路径
const USERS_FILE = path.join(__dirname, '..', 'users.txt');  // 用户信息文件路径
const SUBS_DIR = path.join(__dirname, '..', 'clash');        // 存放用户订阅文件的目录
const LOG_FILE = path.join(__dirname, '..', 'log.txt');      // 目前没用到，但保留变量不影响

// ========== 工具函数 ==========

// 加载 clash.yaml 配置文件
function loadBase() {
  if (!fs.existsSync(BASE_FILE)) {
    throw new Error('clash.yaml 不存在，请先创建 clash.yaml');
  }
  return fs.readFileSync(BASE_FILE, 'utf8');
}

// 读取 users.txt 文件并解析用户数据
// 格式：token 20251128
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    return [];
  }

  const data = fs.readFileSync(USERS_FILE, 'utf8');
  const lines = data.split('\n');

  const users = lines
    .map(line => line.trim())
    .filter(line => line.length > 0) // 去掉空行
    .map(line => {
      const [token, expireAt] = line.split(/\s+/); // 按空格/多个空格分割
      if (token && expireAt) {
        // 保持原始 yyyyMMdd 格式
        return { token, expireAt };
      }
      return null;
    })
    .filter(u => u !== null);

  return users;
}

// 确保 clash 目录存在
function ensureSubsDir() {
  if (!fs.existsSync(SUBS_DIR)) {
    fs.mkdirSync(SUBS_DIR, { recursive: true });
  }
}

// 按中国时间（UTC+8）判断一个用户是否过期
// expireAt 为 'yyyyMMdd'，例如 '20251128'
function isExpired(expireAt) {
  if (!/^\d{8}$/.test(expireAt)) {
    // 格式不对就当作未过期，避免脚本直接抛错
    return false;
  }

  const now = new Date();
  const chinaTimeOffset = 8 * 60 * 60 * 1000;
  const chinaNow = new Date(now.getTime() + chinaTimeOffset);

  const year = chinaNow.getUTCFullYear();
  const month = chinaNow.getUTCMonth() + 1;
  const day = chinaNow.getUTCDate();

  const mm = month < 10 ? '0' + month : '' + month;
  const dd = day < 10 ? '0' + day : '' + day;
  const todayStr = `${year}${mm}${dd}`; // 比如 20251121

  // 到期日 <= 今天，则认为已过期
  return expireAt <= todayStr;
}

// 从 users 数组中删除指定 token 的用户
function removeExpiredUserFromFile(users, token) {
  return users.filter(user => user.token !== token);
}

// 把 20251128 转成 2025-11-28 用来显示
function formatExpireDate(expireAt) {
  if (/^\d{8}$/.test(expireAt)) {
    return `${expireAt.slice(0, 4)}-${expireAt.slice(4, 6)}-${expireAt.slice(6, 8)}`;
  }
  return expireAt;
}

// 在 clash.yaml 文本里：
// 第 1 个 name: "xxx" → name: "到期: 2025-11-28"
// 第 2 个 name: "xxx" → name: "客服微信:Mugassn"
function applyExpireToYaml(baseContent, expireAt) {
  const dateStr = formatExpireDate(expireAt);

  // 匹配所有 name: "xxxx"
  const re = /(^\s*name:\s*")(.*?)(")/gm;
  let count = 0;

  const result = baseContent.replace(re, (match, p1, p2, p3) => {
    count++;
    if (count === 1) {
      // 第一个 name：显示到期时间
      return `${p1}到期: ${dateStr}${p3}`;
    } else if (count === 2) {
      // 第二个 name：显示客服微信
      return `${p1}客服微信:Mugassn${p3}`;
    }
    // 其他 name 不动
    return match;
  });

  return result;
}

// ========== 主逻辑 ==========

function main() {
  const baseContent = loadBase(); // 上游 clash.yaml 内容
  let users = loadUsers();        // users.txt 用户列表
  ensureSubsDir();                // 确保 clash/ 目录存在

  const existingFiles = new Set(
    fs.readdirSync(SUBS_DIR)
      .filter(f => f.endsWith('.yaml'))  // clash 目录中现有的 .yaml 文件
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
    const expired = isExpired(expireAt);  // 判断是否过期（中国时间）

    if (expired) {
      // 过期：删订阅文件 + 从 users 列表中移除
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        deleted++;
      }

      users = removeExpiredUserFromFile(users, token);
      existingFiles.delete(filename);
    } else {
      // 未过期：根据当前 clash.yaml 生成用户订阅，
      // 并把第一个 name 改为到期时间，第二个 name 改为客服微信
      const userYaml = applyExpireToYaml(baseContent, expireAt);
      const existedBefore = fs.existsSync(filePath);

      fs.writeFileSync(filePath, userYaml, 'utf8');
      if (!existedBefore) {
        created++;
      }

      existingFiles.delete(filename);
    }
  }

  // 清理掉 clash/ 中有文件，但 users.txt 里已经没这个用户的情况
  for (const filename of existingFiles) {
    const filePath = path.join(SUBS_DIR, filename);
    fs.unlinkSync(filePath);
    deleted++;
  }

  // 把更新后的用户列表写回 users.txt（保持 yyyyMMdd 格式）
  fs.writeFileSync(
    USERS_FILE,
    users.map(user => `${user.token} ${user.expireAt}`).join('\n'),
    'utf8'
  );

  console.log(`同步完成：创建或更新 ${created} 个，删除 ${deleted} 个`);
}

main();
