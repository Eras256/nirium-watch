import type { EndpointTarget } from './types.js';

const DISCOVERY_URL = 'https://testnet.rail402.dev/discovery/resources';
const MAX_DISCOVERED = 3;

interface BazaarItem {
  resource: string;
  accepts: Array<{ network: string }>;
}

/** Pull a few live endpoints from the Rail402 Bazaar discovery feed, capped so the buyer doesn't burn money. */
export async function discoverRail402Targets(): Promise<EndpointTarget[]> {
  const res = await fetch(DISCOVERY_URL);
  if (!res.ok) throw new Error(`discovery feed returned ${res.status}`);
  const data = (await res.json()) as { items: BazaarItem[] };

  return data.items
    .filter((item) => item.accepts.some((a) => a.network === 'stellar:testnet'))
    .slice(0, MAX_DISCOVERED)
    .map((item) => ({
      name: `discovered: ${item.resource}`,
      url: item.resource,
      facilitator: 'rail402 (discovered)',
    }));
}
