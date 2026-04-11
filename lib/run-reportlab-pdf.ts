import { spawn } from 'child_process';

function spawnPythonPdf(cmd: string, args: string[], jsonPayload: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    proc.stdout.on('data', (d) => chunks.push(Buffer.from(d)));
    proc.stderr.on('data', (d) => errChunks.push(Buffer.from(d)));
    proc.on('error', (e) => reject(e));
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `Python (${cmd}) exited ${code}: ${Buffer.concat(errChunks).toString('utf8').slice(0, 800) || 'no stderr'}`
          )
        );
        return;
      }
      resolve(Buffer.concat(chunks));
    });
    proc.stdin.write(jsonPayload, 'utf8');
    proc.stdin.end();
  });
}

/**
 * Tries several ways to run Python on Windows, Linux, and macOS.
 */
export async function runReportLabPdfScript(scriptPath: string, jsonPayload: string): Promise<Buffer> {
  const tried: string[] = [];
  const candidates: { cmd: string; args: string[] }[] = [];

  const envPath = process.env.PYTHON_PATH?.trim();
  if (envPath) {
    candidates.push({ cmd: envPath, args: [scriptPath] });
  }

  if (process.platform === 'win32') {
    candidates.push(
      { cmd: 'py', args: ['-3', scriptPath] },
      { cmd: 'python', args: [scriptPath] },
      { cmd: 'python3', args: [scriptPath] }
    );
  } else {
    candidates.push(
      { cmd: 'python3', args: [scriptPath] },
      { cmd: 'python', args: [scriptPath] }
    );
  }

  let lastError: Error | null = null;
  for (const { cmd, args } of candidates) {
    const label = `${cmd} ${args.join(' ')}`.trim();
    if (tried.includes(label)) continue;
    tried.push(label);
    try {
      return await spawnPythonPdf(cmd, args, jsonPayload);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const code = (e as NodeJS.ErrnoException)?.code;
      if (code === 'ENOENT') {
        continue;
      }
      throw lastError;
    }
  }

  const hint =
    process.platform === 'win32'
      ? 'Install Python from python.org (check "Add to PATH") or set PYTHON_PATH to your python.exe, e.g. C:\\\\Users\\\\You\\\\AppData\\\\Local\\\\Programs\\\\Python\\\\Python312\\\\python.exe. Then: pip install -r python\\\\requirements.txt'
      : 'Install python3 and reportlab: pip install -r python/requirements.txt. Or set PYTHON_PATH to the python binary.';

  throw new Error(
    `Could not find Python (${tried.join(' → ')} all failed). ${lastError?.message || ''} ${hint}`
  );
}
