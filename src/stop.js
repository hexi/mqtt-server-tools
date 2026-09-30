const { execSync } = require('child_process');
const port = process.env.WEB_PORT || 3000;

try {
  const result = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf8' });
  const lines = result.trim().split('\n').filter(Boolean);
  const pids = [...new Set(lines.map(line => line.trim().split(/\s+/).pop()))];

  if (pids.length === 0) {
    console.log(`端口 ${port} 上没有运行中的服务`);
    process.exit(0);
  }

  for (const pid of pids) {
    console.log(`正在停止进程 PID ${pid} ...`);
    execSync(`taskkill /PID ${pid} /F`, { encoding: 'utf8' });
  }
  console.log('服务已停止');
} catch (e) {
  if (e.message.includes('找不到') || e.message.includes('not found')) {
    console.log(`端口 ${port} 上没有运行中的服务`);
  } else {
    console.error('停止服务失败:', e.message);
    process.exit(1);
  }
}
