const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');  // 用于解析和生成 YAML 文件

const BASE_FILE = path.join(__dirname, '..', 'clash.yaml');  // 基础配置文件路径
const USERS_FILE = path.join(__dirname, '..', 'users.txt');  // 用户信息文件路径
const SUBS_DIR = path.join(__dirname, '..', 'clash');  // 存放用户订阅文件的目录

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

// 更新第一个节点的 name 为用户的到期时间
function updateFirstNodeName(yamlContent, expireAt) {
  // 解析 YAML 内容
  let parsedYaml;
  try {
    parsedYaml = yaml.load(yamlContent);
  } catch (e) {
    console.error("YAML 解析错误:", e);
    return yamlContent;  // 如果解析失败，则直接返回原始内容
  }

  // 确保 proxies 数组存在且至少有一个元素
  if (Array.isArray(parsedYaml.proxies) && parsedYaml.proxies.length > 0) {
    // 将第一个节点的 `name` 替换为用户的到期时间
    parsedYaml.proxies[0].name = `用户到期时间: ${expireAt.split('T')[0]}`;  // 第一个节点 `name` 改为到期时间
  } else {
    console.error('YAML 格式不正确，或者 proxies 数组为空');
    return yamlContent;  // 如果 "proxies" 数组不存在或为空，则返回原始内容
  }

  // 重新生成 YAML 内容
  const updatedYaml = yaml.dump(parsedYaml);

  return updatedYaml;
}

// 主逻辑
function main() {
  const baseContent = loadBase();  // 加载 clash.yaml 配置
  let users = loadUsers();  // 加载 users.txt 文件
  ensureSubsDir();  // 确保 clash 目录存在

  // 处理每个用户的订阅文件
  for (const user of users) {
    const token = user.token;
    const expireAt = user.expireAt;
    const filePath = path.join(SUBS_DIR, `${token}.yaml`);

    if (fs.existsSync(filePath)) {
      let yamlContent = fs.readFileSync(filePath, 'utf8');
      
      // 更新 YAML 内容中的第一个节点的 `name` 为用户的到期时间
      const updatedYamlContent = updateFirstNodeName(yamlContent, expireAt);
      
      // 将更新后的 YAML 内容写回文件
      fs.writeFileSync(filePath, updatedYamlContent, 'utf8');
      console.log(`已更新用户 ${token} 的订阅文件，将第一个节点的 name 更新为到期时间`);
    } else {
      console.log(`订阅文件不存在: ${token}.yaml`);
    }
  }
}

main();
