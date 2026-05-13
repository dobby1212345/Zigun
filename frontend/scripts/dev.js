const { execSync, spawn } = require('child_process');

function findPidOnPort(port) {
  try {
    const output = execSync(`netstat -ano -p tcp | findstr :${port}`, { encoding: 'utf8' });
    const lines = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      if (!line.includes('LISTENING')) {
        continue;
      }

      const match = line.match(/\s(\d+)$/);
      if (match) {
        return Number(match[1]);
      }
    }
  } catch {
    return null;
  }

  return null;
}

function killPid(pid) {
  if (!pid) {
    return;
  }

  try {
    execSync(`taskkill /PID ${pid} /F`, { stdio: 'inherit' });
  } catch {
    // Ignore if the process already exited.
  }
}

const port = 3000;
const pid = findPidOnPort(port);

if (pid && pid !== process.pid) {
  console.log(`Stopping existing dev server on port ${port} (PID ${pid})...`);
  killPid(pid);
}

const child = spawn(
  'cmd.exe',
  ['/d', '/s', '/c', 'npx next dev'],
  {
    stdio: 'inherit',
    windowsHide: true,
  }
);

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
