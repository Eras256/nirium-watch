import { Keypair } from '@stellar/stellar-sdk';
import { createHash } from 'node:crypto';

const PINATA_UPLOAD_URL = 'https://uploads.pinata.cloud/v3/files';

export interface SignedRecord {
  version: 'nirium-audit-v1';
  content_sha256: string;
  agent: { key: string; alg: 'ed25519'; statement: string; signature: string };
  network: string;
  tag: string;
  node: string;
  anchoredAt: string;
}

export function buildSignedRecord(content: unknown, monitorKp: Keypair): SignedRecord {
  const sha = createHash('sha256').update(JSON.stringify(content)).digest('hex');
  const statement = `nirium-audit-v1:${sha}`;
  const signature = Buffer.from(monitorKp.sign(Buffer.from(statement))).toString('base64');
  return {
    version: 'nirium-audit-v1',
    content_sha256: sha,
    agent: { key: monitorKp.publicKey(), alg: 'ed25519', statement, signature },
    network: 'stellar:testnet',
    tag: 'nirium-watch',
    node: 'nirium-watch',
    anchoredAt: new Date().toISOString(),
  };
}

/**
 * Sign a round's results with the monitor key (same nirium-audit-v1 record
 * format the Nirium Audit Trail used) and pin it directly to our own
 * Pinata account — one file per round, not per endpoint, so we don't fill
 * up Nirium's shared free-tier Pinata account. `node: "nirium-watch"`
 * distinguishes these from records anchored through an actual Nirium node.
 */
export async function anchor(content: unknown): Promise<{ cid: string }> {
  const monitorSecret = process.env.MONITOR_SECRET;
  if (!monitorSecret) throw new Error('MONITOR_SECRET not set — run `npm run setup-keys` first.');
  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error('PINATA_JWT not set — add it to .env.');

  const monitorKp = Keypair.fromSecret(monitorSecret);
  const record = buildSignedRecord(content, monitorKp);

  const blob = new Blob([JSON.stringify(record)], { type: 'application/json' });
  const form = new FormData();
  form.append('file', blob, 'nirium-watch-record.json');
  form.append('network', 'public');
  form.append('name', `nirium-watch-${record.content_sha256.slice(0, 16)}.json`);

  const res = await fetch(PINATA_UPLOAD_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Pinata upload failed: ${res.status} ${await res.text()}`);
  }
  const { data } = (await res.json()) as { data: { cid: string } };
  return { cid: data.cid };
}
