# Nirium Watch

**Uptime and settlement checks for x402 APIs on Stellar.**

Live status page: **https://nirium-watch.vercel.app**
Built remotely during HackMeridian 2026 as a non-competing showcase, testnet only (see [Eligibility](#eligibility)).

## HackMeridian submission

- **Submitted:** 26-oct-2026, about 04:40 Mexico time. Genesis track, built remotely, non-competing. The portal closed at 06:00 Mexico time.
- **Demo video:** [youtu.be/EsRlyNw33n8](https://youtu.be/EsRlyNw33n8). About 3 minutes, in English, with the founder's voice.
- **Pitch deck:** [docs/pitch-deck.pdf](docs/pitch-deck.pdf), the PDF we submitted.
- **Numbers:** the submitted form said 87 checks and 72 settled payments. That was a snapshot from 26-oct 09:17 UTC. The status page shows live numbers. For reference, at 17:05 UTC the same history had 199 checks and 165 settled payments verified on chain (168 had a tx hash; 3 were not yet visible to the RPC and stayed degraded).

## Problem

An x402 endpoint that answers `402 Payment Required` proves nothing about whether you can actually get paid. A facilitator can stay broken for weeks while every endpoint behind it keeps returning a perfect 402. On Stellar this already happened: the OpenZeppelin facilitator's issue #47 (~32-day outage) was diagnosed by hand by four separate integrators. We were burned ourselves: a payment method we listed as "live" had zero settled payments, and nothing caught it.

## Users

- **x402 sellers:** is my API actually getting paid?
- **Agent builders:** should my agent trust this seller and this facilitator?
- **Facilitators:** is my settlement path healthy, end to end?

Three Stellar x402 facilitators were just funded in SCF round 45 (Rail402, AgentSmith and Rumble Fish), so this problem is about to matter to more people, not fewer. We check Rail402 and AgentSmith, plus OpenZeppelin's facilitator. Rumble Fish is not checked yet: on 26-oct-2026 its public repo (`rumblefishdev/stellar-x402`) was still marked as a skeleton, with no testnet facilitator to call. We'll add it when one is live.

## What it does

Nirium Watch pays each endpoint the way an agent would, on **testnet**, then confirms **on chain** that the money actually moved to the right `payTo` for the right amount. Every check round produces a signed, independently verifiable receipt: signed with our monitor key and pinned to IPFS in the Nirium Audit Trail record format (`nirium-audit-v1`). A public status page shows it per endpoint and per facilitator.

```
endpoints (static list + Rail402 Bazaar discovery)
   |
   v
probe:  GET without payment --> expect 402 + parse requirements (scheme, network, asset, amount, payTo)
   |
   v
pay:    Nirium x402 client, testnet buyer key --> expect 200 + payment-response header (tx hash)
   |
   v
verify: Stellar RPC getTransaction(hash) --> SUCCESS? SAC transfer event to payTo for amount?
   |
   v
record: round's results -> sha256 -> signed with the monitor key -> pinned to IPFS, nirium-audit-v1 record (CID)
   |
   v
data/history.json --> status page (web/) on Vercel, fetched live from this repo
```

`npm run watch` runs this every 30 minutes and commits + pushes `data/history.json` itself, with no GitHub Actions dependency. In production it runs as a small worker on Fly.io (`nirium-watch`, Dockerfile at the repo root, see `fly.toml`), not on anyone's laptop. The AgentSmith seller (below) is a second, separate Fly app (`nirium-watch-agentsmith-seller`, Dockerfile + `fly.toml` in `agentsmith-seller/`).

### Phase 2: Pullcord alerts

On a state change per endpoint (settled to failing, failing to recovered), Nirium Watch posts a signed alert to Pullcord's external alert intake (`POST /v1/alerts/external`, HMAC-SHA256 over `<timestamp>.<rawBody>` in the `Pullcord-Signature` header). One alert per endpoint per state change, with no repeats while a failure persists. See `src/pullcord.ts`.

Alerts have been live in the Fly worker since 2026-10-26 06:45 UTC. The status page's **Alerts** section recomputes, from `data/history.json`, every state change since then that triggered an alert; delivery itself is logged on Pullcord's side, not in this repo. An endpoint that was already failing when alerts went live (e.g. a discovered route we can't call) does not trigger one until it changes state.

## Endpoints checked

| Endpoint | Facilitator | Price |
|---|---|---|
| `nirium-agent.fly.dev/api/v1/premium/market` | OpenZeppelin (via Nirium testnet agent) | 0.05 testnet USDC |
| `nirium-agent.fly.dev/api/v1/premium/signals` | OpenZeppelin (via Nirium testnet agent) | varies |
| `demo.rail402.dev/weather?city=Istanbul` | Rail402 (fees sponsored) | 0.001 USDC |
| `nirium-watch-agentsmith-seller.fly.dev/premium/weather?city=Lisbon` | AgentSmith (57Blocks) testnet facilitator | 0.001 USDC |
| + up to 3 more, pulled live from the Rail402 Bazaar discovery feed | Rail402 | varies |

Discovery source: `GET https://testnet.rail402.dev/discovery/resources`, capped at 3 extra endpoints per run.

The AgentSmith endpoint is **our own seller** (`agentsmith-seller/`, written during the event, deployed on Fly as `nirium-watch-agentsmith-seller`). It charges through AgentSmith's (57Blocks) public testnet x402 facilitator so we have a third facilitator to monitor. It is not an AgentSmith product and there is no partnership: we just call their public testnet facilitator, like any other seller could.

An endpoint that is replaced (for example, the temporary tunnel the AgentSmith seller used before it moved to Fly) keeps its history on the status page, greyed out and labeled as retired.

Stellar testnet constants used throughout:
- USDC (SAC): `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`
- Stellar RPC: `https://soroban-testnet.stellar.org`

## Setup

```
npm install
npm run setup-keys               # creates .env with buyer + monitor Stellar testnet keys, funds buyer via friendbot (refuses if .env exists)
                                 # then add PINATA_JWT (and optionally PULLCORD_ALERT_SECRET) to .env by hand, see .env.example
npx tsx src/setup-trustline.ts   # USDC trustline + DEX swap (or faucet.circle.com if no DEX route)
npm run check                    # one pass over all targets
npm run watch                    # repeats every 30 min, commits + pushes data/history.json
npm test                         # unit tests: 402 parsing, on-chain verify (recorded fixture), history, receipt signature, Pullcord signature
```

### Env vars (never committed; `.env` is gitignored)

| Var | Set by | Purpose |
|---|---|---|
| `STELLAR_SECRET` | `setup-keys` | buyer key: holds testnet USDC, pays each endpoint |
| `MONITOR_SECRET` | `setup-keys` | monitor key: signs each round's receipt before pinning, holds no funds |
| `PINATA_JWT` | you | your own Pinata account, used to pin each round's signed receipt to IPFS (see [Receipts](#receipts)) |
| `PULLCORD_ALERT_SECRET` | you | per-source HMAC secret for Pullcord's alert intake (phase 2; optional, alerts are skipped if unset) |

In production these are Fly secrets on the `nirium-watch` app.

## Design

Dark background, teal accent, monospace hashes. Three states per endpoint: **OK** (settled and verified on chain), **degraded** (402 OK but payment or settlement failed), **down** (no 402 or request error). See [design.md](design.md).

## Prior art

Nearest prior art we found: [`carstenjacobsen/x402-testing-tool`](https://github.com/carstenjacobsen/x402-testing-tool) (Stellar Hacks: Agents), which mocks endpoints and clients for development. Nirium Watch checks **live** endpoints continuously and verifies **settlement on chain**: a neighbour, not a duplicate.

## Prior work (disclosed)

Everything in this repo (`src/`, `web/`, `test/`, `agentsmith-seller/`) was written during HackMeridian. It depends on, but does not copy from, two earlier projects by the same team:

- **Nirium** (our own prior work):
  - [`nirium`](https://www.npmjs.com/package/nirium) `0.16.1`, Nirium's x402 client library for Stellar, used for `Agent.x402Fetch`.
  - The Nirium Audit Trail record format (`nirium-audit-v1`): same shape of signed record, same field names. We no longer call the Audit Trail's `anchorAuditRecord` service; see [Receipts](#receipts) for why.
  - The Nirium testnet agent (`nirium-agent.fly.dev`), used as one of the endpoints checked.
- **Pullcord** (our own earlier project): its alert service receives the phase 2 alerts. The external alert intake route (`POST /v1/alerts/external`) was added to Pullcord's own repo during HackMeridian (Pullcord commit `4f131f2`, 25-oct-2026) so Nirium Watch could send alerts to it. That code lives in Pullcord's repo, not here; this repo only calls the route with a per-source secret.

## Receipts

Each check round's results are signed with our monitor key and pinned directly to our own Pinata account, in the same signed-record format the Nirium Audit Trail uses (`nirium-audit-v1`: `content_sha256`, an ed25519 `agent` signature over `nirium-audit-v1:<sha256>`, `network`, `tag`, and `node: "nirium-watch"` so it's never confused with an actual Nirium node). One receipt covers the whole round (all endpoints checked that tick), not one per endpoint.

Receipts up to **2026-10-26 08:09 UTC** were anchored through Nirium's Audit Trail service (`anchorAuditRecord`, one per endpoint check). From the 08:11 UTC round on, we pin directly, one receipt per round. The reason is pin volume on a shared account: Nirium's Audit Trail pins every anchored receipt to Nirium's own Pinata account, and at one-per-endpoint-per-15-minutes across all our monitored endpoints we were on pace to push that shared account toward its pin limit. That would have broken anchoring for everyone using the Audit Trail, not just us. Pinning to our own account, once per round, at a 30-minute interval, fixes that.

## Honest limits

- **All payments are ours.** The buyer key is our own team key. This is not adoption, not customers, not external traffic.
- **No partnerships.** We have no relationship with OpenZeppelin, Rail402 or AgentSmith/57Blocks beyond calling their public testnet endpoints and facilitators. The AgentSmith seller is ours; AgentSmith only provides the facilitator. Nirium and Pullcord are our own earlier projects (see [Prior work](#prior-work-disclosed)).
- **A failed check is not proof a facilitator is "down."** One failure just means one failed check at one timestamp; the status page shows history, not verdicts.
- **Testnet only.** No mainnet secret exists anywhere in this project.
- **Rail402 Bazaar discovery is called literally.** Discovered resources are requested exactly as listed, without special-casing. If one doesn't answer with a 402 (e.g. `/translate` returned 404 on 26-oct-2026), it shows up honestly as `down`.

## Challenges

- **Proving settlement from the transaction itself.** A 200 response or a facilitator's reply is not proof. We read the Stellar transaction back from RPC and check the SAC transfer event: the asset, the recipient and the amount.
- **AgentSmith had a public facilitator but no demo seller.** So we wrote our own. It first failed on Vercel serverless with `ERR_REQUIRE_ESM` inside an ESM-only dependency, so it runs on Fly.io.
- **Receipt volume.** We moved from one anchored receipt per endpoint to one signed receipt per round, on our own Pinata account, at a 30-minute interval. The record format is the same. The cutover (08:09 / 08:11 UTC) is explained under [Receipts](#receipts).
- **Stale and synthetic results.** Replaced endpoints are kept as "retired", and test alerts are collapsed. The page should never show an old failure or a synthetic one as if it were real.

## What's next

- Add Rumble Fish when its facilitator is live. Its repo was a skeleton on 26-oct.
- Find the first external users. Today there are none.
- Alerts to people who opt in, through Pullcord.
- A daily signed digest and an embeddable status badge.
- Wire-format conformance checks per facilitator.

## How it was built (AI tooling)

Claude Code (Claude Opus and Claude Sonnet) wrote most of the TypeScript (probe, pay, verify, receipts, alerts), the tests and the status page. A second Claude Code session helped with the landing redesign and the AgentSmith seller. The humans chose the scope, checked every claim against the chain and the live endpoints, and reviewed the changes. The landing redesign came in as a reviewed pull request. AI co-authorship is recorded in the commit trailers (`Co-Authored-By`).

## Eligibility

HackMeridian is in person only, with no remote track. We built remotely, were not in Lisbon, and told the organizers on 26-oct-2026 that this submission is **non-competing**: please treat it as a showcase of what we built that weekend, not as a prize entry.

## License

MIT, see [LICENSE](LICENSE).
