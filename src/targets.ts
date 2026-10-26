import type { EndpointTarget } from './types.js';
import { discoverRail402Targets } from './discovery.js';

export const STATIC_TARGETS: EndpointTarget[] = [
  {
    name: 'Nirium market',
    url: 'https://nirium-agent.fly.dev/api/v1/premium/market',
    facilitator: 'OpenZeppelin (via Nirium testnet agent)',
  },
  {
    name: 'Nirium signals',
    url: 'https://nirium-agent.fly.dev/api/v1/premium/signals',
    facilitator: 'OpenZeppelin (via Nirium testnet agent)',
  },
  {
    name: 'Rail402 weather',
    url: 'https://demo.rail402.dev/weather?city=Istanbul',
    facilitator: 'Rail402 (fees sponsored)',
  },
  {
    name: 'AgentSmith weather (our seller)',
    url: 'https://nirium-watch-agentsmith-seller.fly.dev/premium/weather?city=Lisbon',
    facilitator: 'AgentSmith (our seller, their facilitator)',
  },
];

/** Static targets plus whatever the Rail402 Bazaar discovery feed currently lists (best effort). */
export async function allTargets(): Promise<EndpointTarget[]> {
  try {
    const discovered = await discoverRail402Targets();
    const seen = new Set(STATIC_TARGETS.map((t) => t.url));
    return [...STATIC_TARGETS, ...discovered.filter((t) => !seen.has(t.url))];
  } catch (err) {
    console.error('discovery feed failed, using static targets only:', err);
    return STATIC_TARGETS;
  }
}
