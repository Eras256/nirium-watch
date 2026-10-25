import { Keypair } from '@stellar/stellar-sdk';
import { writeFileSync, existsSync } from 'node:fs';

const envPath = '.env';
if (existsSync(envPath)) {
  console.error('.env already exists — refusing to overwrite. Delete it first if you want fresh keys.');
  process.exit(1);
}

const buyer = Keypair.random();
const monitor = Keypair.random();

console.log('Buyer public:  ', buyer.publicKey());
console.log('Monitor public:', monitor.publicKey());

const friendbotRes = await fetch(`https://friendbot.stellar.org?addr=${buyer.publicKey()}`);
if (!friendbotRes.ok) {
  console.error('Friendbot funding failed:', friendbotRes.status, await friendbotRes.text());
  process.exit(1);
}
console.log('Buyer funded with testnet XLM via friendbot.');

writeFileSync(
  envPath,
  [
    `STELLAR_SECRET=${buyer.secret()}`,
    `STELLAR_PUBLIC=${buyer.publicKey()}`,
    `MONITOR_SECRET=${monitor.secret()}`,
    `MONITOR_PUBLIC=${monitor.publicKey()}`,
    '',
  ].join('\n'),
);
console.log('Wrote .env (gitignored).');
