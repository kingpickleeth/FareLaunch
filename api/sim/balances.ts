// /api/sim/balances.ts
const ALLOW_ORIGIN = process.env.NODE_ENV === 'production'
  ? 'https://farelaunch.com' // TODO: set your prod domain
  : 'http://localhost:5173';

export default async function handler(req: any, res: any) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
    return;
  }

  try {
    if (req.method !== 'GET') {
      res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { address, chain_ids = '33139', debug } = req.query || {};
    if (typeof address !== 'string' || !address) {
      res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
      return res.status(400).json({ error: 'Missing address' });
    }

    const apiKey = process.env.SIM_API_KEY || '';
    if (!apiKey) {
      res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
      return res.status(500).json({ error: 'Missing SIM_API_KEY env' });
    }

    const url = `https://api.sim.dune.com/v1/evm/balances/${address}?chain_ids=${chain_ids}`;
    const upstream: any = await fetch(url, { headers: { 'X-Sim-Api-Key': apiKey } });
    const ct = upstream?.headers?.get?.('content-type') || '';
    const text = await upstream.text();

    // Debug branch
    if (debug) {
      res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
      return res.status(200).json({
        sentHeader: !!apiKey,
        upstreamStatus: upstream?.status,
        upstreamCT: ct,
        preview: text.slice(0, 500),
      });
    }

    // Non-JSON upstream
    if (!ct.includes('application/json')) {
      res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
      return res.status(upstream?.status || 502).json({
        error: 'Upstream returned non-JSON',
        status: upstream?.status,
        preview: text.slice(0, 200),
      });
    }

    const data = JSON.parse(text);
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=60');
    res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
    return res.status(upstream.status).json(data);
  } catch (e: any) {
    res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
    return res.status(500).json({ error: 'Proxy failed', detail: String(e?.message || e) });
  }
}
