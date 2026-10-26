import 'dotenv/config';
import { probe } from './probe.js';
import { pay } from './pay.js';
import { verify } from './verify.js';
import { anchor } from './anchor.js';
import { appendHistoryBatch, readHistory, latestByEndpoint } from './history.js';
import { allTargets } from './targets.js';
import { alertOnStateChange } from './pullcord.js';
import type { CheckState, EndpointTarget, HistoryRecord } from './types.js';

function classify(http402: boolean, paid: boolean, verified: boolean): CheckState {
  if (http402 && paid && verified) return 'ok';
  if (http402) return 'degraded';
  return 'down';
}

/** Probe, pay, and verify one target. Does not anchor or append — that happens once per round. */
export async function checkOne(target: EndpointTarget): Promise<HistoryRecord> {
  const start = Date.now();
  const ts = new Date().toISOString();

  const probed = await probe(target.url);
  if (!probed.ok || !probed.requirement) {
    return {
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
  }

  const paid = await pay(target.url);
  if (!paid.ok || !paid.tx) {
    return {
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
  }

  const verified = await verify(paid.tx, probed.requirement);
  return {
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
}

async function main() {
  const targets = await allTargets();
  const previousByEndpoint = latestByEndpoint(await readHistory());

  const records: HistoryRecord[] = [];
  for (const target of targets) {
    const record = await checkOne(target);
    records.push(record);
    console.log(`[${record.state.toUpperCase()}] ${target.name} — ${record.error ?? 'settled'} tx=${record.tx ?? '-'}`);
  }

  // One signed receipt covers every result in this round, instead of one
  // per endpoint — keeps our own Pinata account's pin count low.
  try {
    const { cid } = await anchor(records);
    for (const record of records) record.cid = cid;
    console.log(`round anchored: cid=${cid}`);
  } catch (err) {
    console.error('anchor failed for this round:', err instanceof Error ? err.message : err);
  }

  await appendHistoryBatch(records);

  for (const record of records) {
    const previous = previousByEndpoint.get(record.endpoint);
    await alertOnStateChange(previous, record);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
