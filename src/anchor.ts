import { Agent } from 'nirium';
import { Keypair } from '@stellar/stellar-sdk';
import { createHash } from 'node:crypto';

let agent: Agent | undefined;
function getAgent(): Agent {
  agent ??= new Agent({ baseUrl: 'https://nirium-agent.fly.dev' });
  return agent;
}

/**
 * Sign a check result with the monitor key and anchor it to the Nirium
 * Audit Trail, tagged `nirium-watch` so it's excluded from any aggregate
 * Nirium reporting (these are our own self-generated monitoring receipts,
 * not organic traffic).
 */
export async function anchor(result: unknown): Promise<{ cid: string }> {
  const secret = process.env.MONITOR_SECRET;
  if (!secret) throw new Error('MONITOR_SECRET not set — run `npm run setup-keys` first.');
  const monitorKp = Keypair.fromSecret(secret);

  const sha = createHash('sha256').update(JSON.stringify(result)).digest('hex');
  const signature = Buffer.from(monitorKp.sign(Buffer.from(`nirium-audit-v1:${sha}`))).toString('base64');

  return getAgent().anchorAuditRecord({
    hash: sha,
    tag: 'nirium-watch',
    agent: { key: monitorKp.publicKey(), signature },
  });
}
