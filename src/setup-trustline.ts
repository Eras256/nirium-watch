import { Keypair, Horizon, TransactionBuilder, Operation, Asset, Networks } from '@stellar/stellar-sdk';
import { readFileSync } from 'node:fs';
import 'dotenv/config';

const horizon = new Horizon.Server('https://horizon-testnet.stellar.org');
const USDC = new Asset('USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'); // Circle testnet issuer

const secret = process.env.STELLAR_SECRET;
if (!secret) {
  console.error('STELLAR_SECRET not set — run `npm run setup-keys` first.');
  process.exit(1);
}
const kp = Keypair.fromSecret(secret);

const account = await horizon.loadAccount(kp.publicKey());
const tx = new TransactionBuilder(account, { fee: '1000', networkPassphrase: Networks.TESTNET }).addOperation(
  Operation.changeTrust({ asset: USDC }),
);

const toAsset = (a: { asset_type: string; asset_code?: string; asset_issuer?: string }) =>
  a.asset_type === 'native' ? Asset.native() : new Asset(a.asset_code!, a.asset_issuer!);

const [route] = (await horizon.strictSendPaths(Asset.native(), '20', [USDC]).call()).records;
if (!route) {
  console.log('No DEX route to USDC right now. Trustline will still be created.');
  console.log('Ask for testnet USDC manually at https://faucet.circle.com (choose Stellar).');
} else {
  tx.addOperation(
    Operation.pathPaymentStrictSend({
      sendAsset: Asset.native(),
      sendAmount: '20',
      destination: kp.publicKey(),
      destAsset: USDC,
      destMin: (Number(route.destination_amount) * 0.9).toFixed(7),
      path: route.path.map(toAsset),
    }),
  );
}

const built = tx.setTimeout(60).build();
built.sign(kp);
const result = await horizon.submitTransaction(built);
console.log('Transaction:', result.hash);

const refreshed = await horizon.loadAccount(kp.publicKey());
console.log('Buyer balances:');
for (const b of refreshed.balances) {
  console.log(`  ${(b as { asset_code?: string }).asset_code ?? 'XLM'}: ${b.balance}`);
}
