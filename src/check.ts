import 'dotenv/config';
import { probe } from './probe.js';
import { pay } from './pay.js';
import { verify } from './verify.js';
import { anchor } from './anchor.js';
import { appendHistory } from './history.js';
import { allTargets } from './targets.js';
import type { CheckState, EndpointTarget, HistoryRecord } from './types.js';

function classify(http402: boolean, paid: boolean, verified: boolean): CheckState {
  if (http402 && paid && verified) return 'ok';
  if (http402) return 'degraded';
  return 'down';
}

export async function checkOne(target: EndpointTarget): Promise<HistoryRecord> {
  const start = Date.now();
  const ts = new Date().toISOString();

  const probed = await probe(target.url);
  if (!probed.ok || !probed.requirement) {
    const record: HistoryRecord = {
      ts,
      endpoint: target.url,
      facilitator: target.facilitator,
      http402: probed.status === 402,
      paid: false,
      tx: null,
      verified: false,
      state: classify(probed.status === 402, false, false),
      latencyMs: Date.now() - start,
      error: probed.error ?? 'probe failed',
      cid: null,
    };
    await safeAnchorAndAppend(record);
    return record;
  }

  const paid = await pay(target.url);
  if (!paid.ok || !paid.tx) {
    const record: HistoryRecord = {
      ts,
      endpoint: target.url,
      facilitator: target.facilitator,
      http402: true,
      paid: false,
      tx: null,
      verified: false,
      state: classify(true, false, false),
      latencyMs: Date.now() - start,
      error: paid.error ?? 'payment failed',
      cid: null,
    };
    await safeAnchorAndAppend(record);
    return record;
  }

  const verified = await verify(paid.tx, probed.requirement);
  const record: HistoryRecord = {
    ts,
    endpoint: target.url,
    facilitator: target.facilitator,
    http402: true,
    paid: true,
    tx: paid.tx,
    verified: verified.verified,
    state: classify(true, true, verified.verified),
    latencyMs: Date.now() - start,
    error: verified.verified ? null : verified.reason,
    cid: null,
  };
  await safeAnchorAndAppend(record);
  return record;
}

async function safeAnchorAndAppend(record: HistoryRecord): Promise<void> {
  try {
    const { cid } = await anchor(record);
    record.cid = cid;
  } catch (err) {
    console.error(`anchor failed for ${record.endpoint}:`, err instanceof Error ? err.message : err);
  }
  await appendHistory(record);
}

async function main() {
  const targets = await allTargets();
  for (const target of targets) {
    const record = await checkOne(target);
    console.log(`[${record.state.toUpperCase()}] ${target.name} — ${record.error ?? 'settled'} tx=${record.tx ?? '-'} cid=${record.cid ?? '-'}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
