import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const INTERVAL_MS = 30 * 60 * 1000;

async function run(cmd: string, args: string[]): Promise<boolean> {
  try {
    const { stdout, stderr } = await exec(cmd, args);
    if (stdout) console.log(stdout.trim());
    if (stderr) console.error(stderr.trim());
    return true;
  } catch (err) {
    console.error(`command failed: ${cmd} ${args.join(' ')}`, err instanceof Error ? err.message : err);
    return false;
  }
}

const PUSH_ARGS = ['-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential'];

async function tick(): Promise<void> {
  console.log(`\n=== watch tick ${new Date().toISOString()} ===`);

  // Sync to the latest remote state before computing anything, so this
  // tick's commit always starts from current origin/main. We're the only
  // writer to this repo's history.json; resetting here means the push
  // below is always a trivial fast-forward, instead of risking a rebase
  // conflict on an append-only JSON file (which git tends to flag as
  // "both modified" right at the closing bracket).
  await run('git', [...PUSH_ARGS, 'fetch', 'origin', 'main']);
  await run('git', ['reset', '--hard', 'origin/main']);

  await run('npx', ['tsx', 'src/check.ts']);

  await run('git', ['add', 'data/history.json']);
  const { stdout: status } = await exec('git', ['status', '--porcelain', 'data/history.json']);
  if (!status.trim()) {
    console.log('no history change, skipping commit');
    return;
  }
  const committed = await run('git', ['commit', '-m', `Update history.json (${new Date().toISOString()})`]);
  if (!committed) return;
  await run('git', [...PUSH_ARGS, 'push']);
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
