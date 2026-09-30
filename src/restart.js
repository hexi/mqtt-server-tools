const { execSync } = require('child_process');
const port = process.env.WEB_PORT || 3000;

try {
  const result = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf8' });
  const lines = result.trim().split('\n').filter(Boolean);
  const pids = [...new Set(lines.map(line => line.trim().split(/\s+/).pop()))];

  for (const pid of pids) {
    console.log(`正在停止进程 PID ${pid} ...`);
    execSync(`taskkill /PID ${pid} /F`, { stdio: 'pipe' });
  }
  console.log('旧服务已停止');
} catch (e) {
  console.log('没有找到运行中的服务，直接启动');
}

console.log('正在启动新服务...\n');
require('./server.js');
