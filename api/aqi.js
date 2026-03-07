// api/aqi.js — WAQI proxy (server-side, key never exposed)
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const key = process.env.WAQI_API_KEY;
  if (!key) return res.status(500).json({ error: "WAQI_API_KEY not set in Vercel env vars" });

  const { city } = req.query;
  if (!city) return res.status(400).json({ error: "Missing city param" });

  async function tryCity(q) {
    try {
      const r = await fetch(`https://api.waqi.info/feed/${encodeURIComponent(q)}/?token=${key}`);
      if (!r.ok) return null;
      const d = await r.json();
      if (d.status !== "ok" || !d.data) return null;
      const val = parseInt(d.data.aqi, 10);
      return isNaN(val) || val < 0 ? null : val;
    } catch { return null; }
  }

  // Try city name, then first word only
  let aqi = await tryCity(city);
  if (aqi === null && city.includes(",")) aqi = await tryCity(city.split(",")[0].trim());

  if (aqi !== null) return res.status(200).json({ aqi });

  // Fallback: search API
  try {
    const r = await fetch(`https://api.waqi.info/search/?token=${key}&keyword=${encodeURIComponent(city)}`);
    if (r.ok) {
      const d = await r.json();
      if (d.status === "ok" && d.data?.length > 0) {
        const val = parseInt(d.data[0].aqi, 10);
        if (!isNaN(val) && val >= 0) return res.status(200).json({ aqi: val });
      }
    }
  } catch {}

  return res.status(404).json({ error: "AQI not found" });
}
