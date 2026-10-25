import 'dotenv/config';
import { probe } from './probe.js';
import { pay } from './pay.js';

const url = process.argv[2] ?? 'https://nirium-agent.fly.dev/api/v1/premium/market';

const probed = await probe(url);
console.log('probe:', probed);

if (!probed.ok) {
  console.error('probe failed, not paying');
  process.exit(1);
}

const paid = await pay(url);
console.log('pay:', paid);
