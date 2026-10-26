import express from 'express';
import { x402Serve } from 'nirium';

const app = express();

// Our own seller, charging through AgentSmith's (57Blocks) public testnet
// facilitator — not an AgentSmith product, no partnership implied.
app.use(
  '/premium',
  x402Serve({
    payTo: 'GBGDRJC4XNYSIF27LQE3QE2R6S76KSR73FCG44XZLJ4IXP2P7PJ363FG',
    routes: { 'GET /weather': '$0.001' },
    network: 'stellar:testnet',
    facilitatorUrl: 'https://testnet.agentsmith.xyz/facilitator',
    appName: 'nirium-watch-agentsmith-seller',
  }),
);

app.get('/premium/weather', (req, res) => {
  const city = req.query.city ?? 'Lisbon';
  res.json({ city, tempC: 18, source: 'nirium-watch test seller (AgentSmith facilitator)' });
});

export default app;
