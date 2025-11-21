const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'log.txt');  // 日志文件路径

// 输出 GitHub Actions 服务器的当前时间
function logServerTime() {
  const now = new Date();
  const chinaTimeOffset = 8 * 60 * 60 * 1000;  // 中国时间偏移（8小时）
  const chinaTime = new Date(now.getTime() + chinaTimeOffset);

  const logMessage = `GitHub Actions 服务器当前时间 (UTC): ${now.toISOString()}\n` +
                     `GitHub Actions 服务器当前时间 (中国时间 CST, UTC+8): ${chinaTime.toISOString()}\n\n`;

  // 将时间输出到日志文件
  fs.appendFileSync(LOG_FILE, logMessage, 'utf8');
  console.log(logMessage);  // 控制台输出
}

// 主逻辑
function main() {
  logServerTime();  // 输出服务器时间，调试用

  console.log('仅输出服务器时间，无其他操作。');
}

main();
