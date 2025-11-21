const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const USERS_FILE = path.join(__dirname, '..', 'users.txt');  // 用户信息文件路径
const SUBS_DIR = path.join(__dirname, '..', 'clash');  // 存放用户订阅文件的目录

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

// 判断一个用户是否过期（基于当前时间）
function isExpired(expireAt) {
  const now = new Date();
  const expireDate = new Date(expireAt);
  
  // 比较用户的到期时间和当前时间
  return expireDate.getTime() <= now.getTime();  // 如果到期时间 <= 当前时间，返回 true，表示已过期
}

// 从 users.txt 中删除已过期用户
function removeExpiredUsers(users) {
  return users.filter(user => !isExpired(user.expireAt));  // 保留未过期的用户
}

// 更新 users.txt 文件
function updateUsersFile(users) {
  const updatedUsersData = users.map(user => `${user.token} ${user.expireAt.split('T')[0]}`).join('\n');
  fs.writeFileSync(USERS_FILE, updatedUsersData, 'utf8');
}

// 主逻辑：删除过期用户
function main() {
  let users = loadUsers();  // 加载 users.txt 文件
  users = removeExpiredUsers(users);  // 删除过期用户
  
  // 更新 users.txt 文件
  updateUsersFile(users);
  console.log('已删除过期用户，更新了 users.txt 文件');
}

main();
