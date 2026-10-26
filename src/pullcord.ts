import { createHmac } from 'node:crypto';
import type { HistoryRecord } from './types.js';

const ALERTS_URL = 'https://pullcord-notify.fly.dev/v1/alerts/external';

export function sign(secret: string, rawBody: string): string {
  const t = Math.floor(Date.now() / 1000);
  const hex = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return `t=${t},v1=${hex}`;
}

interface AlertPayload {
  source: 'nirium-watch';
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  data?: Record<string, unknown>;
}

async function sendAlert(payload: AlertPayload): Promise<void> {
  const secret = process.env.PULLCORD_ALERT_SECRET;
  if (!secret) {
    console.error('PULLCORD_ALERT_SECRET not set — skipping alert.');
    return;
  }
  const rawBody = JSON.stringify(payload);
  const res = await fetch(ALERTS_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Pullcord-Signature': sign(secret, rawBody),
    },
    body: rawBody,
  });
  if (!res.ok) {
    console.error(`Pullcord alert failed: ${res.status} ${await res.text()}`);
  }
}

/**
 * Fire a Pullcord alert if this endpoint's state changed from settled to
 * failing, or from failing back to recovered. Called once per check with the
 * previous and current record, so it's naturally rate-limited to one alert
 * per endpoint per state change.
 */
export async function alertOnStateChange(
  previous: HistoryRecord | undefined,
  current: HistoryRecord,
): Promise<void> {
  if (!previous || previous.state === current.state) return;

  const settledToFailing = previous.state === 'ok' && current.state !== 'ok';
  const failingToRecovered = previous.state !== 'ok' && current.state === 'ok';
  if (!settledToFailing && !failingToRecovered) return;

  await sendAlert({
    source: 'nirium-watch',
    type: settledToFailing ? 'endpoint.failing' : 'endpoint.recovered',
    message: settledToFailing
      ? `${current.endpoint} went from settled to ${current.state}: ${current.error ?? 'unknown'}`
      : `${current.endpoint} recovered (was ${previous.state}, now settled)`,
    severity: settledToFailing ? 'warning' : 'info',
    data: {
      endpoint: current.endpoint,
      facilitator: current.facilitator,
      previousState: previous.state,
      state: current.state,
      tx: current.tx,
      cid: current.cid,
    },
  });
}
