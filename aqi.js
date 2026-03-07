// api/aqi.js — WAQI proxy
// Key lives in Vercel env var: WAQI_API_KEY
// Never exposed to the browser

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const key = process.env.WAQI_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "API key not configured" });
  }

  const { city } = req.query;
  if (!city) {
    return res.status(400).json({ error: "Missing city parameter" });
  }

  try {
    const response = await fetch(
      "https://api.waqi.info/feed/" + encodeURIComponent(city) + "/?token=" + key
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: "Upstream error" });
    }

    const data = await response.json();

    if (data.status === "ok" && data.data && data.data.aqi) {
      return res.status(200).json({ aqi: parseInt(data.data.aqi, 10) });
    } else {
      return res.status(404).json({ error: "City not found or no AQI data" });
    }
  } catch (e) {
    return res.status(500).json({ error: "Request failed", detail: e.message });
  }
}
