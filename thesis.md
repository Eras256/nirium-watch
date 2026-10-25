# Nirium Watch: uptime and settlement checks for x402 APIs on Stellar.

**Problem.** An x402 endpoint that answers `402 Payment Required` proves nothing about whether you can actually get paid. A facilitator can stay broken for weeks while every endpoint behind it keeps returning a perfect 402. On Stellar this already happened: OpenZeppelin facilitator issue #47 (~32-day outage) was diagnosed by hand by four separate integrators. We were burned ourselves: a payment method we listed as "live" had zero settled payments, and nothing caught it.

**Users.** x402 sellers (is my API getting paid?), agent builders (should my agent pay this seller?), facilitators (is my settlement path healthy?). Three Stellar x402 facilitators were just funded in SCF #45.

**What it does.** Pays each endpoint the way an agent would, on testnet, then confirms on-chain that the money actually moved to the right `payTo` for the right amount. Every result is a signed, independently verifiable receipt (Nirium Audit Trail, IPFS CID). A public status page shows it per endpoint and per facilitator.

**Nearest prior art:** `carstenjacobsen/x402-testing-tool` (Stellar Hacks: Agents), which mocks endpoints and clients while you develop. Nirium Watch checks live endpoints continuously and verifies settlement on chain. Neighbours, not duplicates.

**Prior work (disclosed):** Nirium SDK `nirium@0.16.1` (npm) and the Nirium Audit Trail testnet node. Everything in this repo was written during HackMeridian.
