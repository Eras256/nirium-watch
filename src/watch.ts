import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const INTERVAL_MS = 15 * 60 * 1000;

async function run(cmd: string, args: string[]): Promise<void> {
  try {
    const { stdout, stderr } = await exec(cmd, args, { shell: true });
    if (stdout) console.log(stdout.trim());
    if (stderr) console.error(stderr.trim());
  } catch (err) {
    console.error(`command failed: ${cmd} ${args.join(' ')}`, err instanceof Error ? err.message : err);
  }
}

async function tick(): Promise<void> {
  console.log(`\n=== watch tick ${new Date().toISOString()} ===`);
  await run('npx', ['tsx', 'src/check.ts']);

  await run('git', ['add', 'data/history.json']);
  const { stdout: status } = await exec('git', ['status', '--porcelain', 'data/history.json'], { shell: true });
  if (!status.trim()) {
    console.log('no history change, skipping commit');
    return;
  }
  await run('git', ['commit', '-m', `Update history.json (${new Date().toISOString()})`]);
  await run('git', [
    '-c',
    'credential.helper=',
    '-c',
    'credential.helper=!gh auth git-credential',
    'push',
  ]);
}

async function main() {
  console.log(`nirium-watch: checking every ${INTERVAL_MS / 60000} minutes. Ctrl+C to stop.`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await tick();
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
}

main();
