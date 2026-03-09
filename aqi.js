// api/aqi.js — WAQI proxy (optimized)
// Key lives in Vercel env var: WAQI_API_KEY

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
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

  async function tryFetch(query) {
    const url = "https://api.waqi.info/feed/" + encodeURIComponent(query) + "/?token=" + key;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) return null;
      const data = await response.json();
      if (data.status !== "ok" || !data.data) return null;
      const raw = data.data.aqi;
      if (raw === undefined || raw === null || raw === "-") return null;
      const parsed = parseInt(raw, 10);
      if (isNaN(parsed) || parsed < 0) return null;
      return parsed;
    } catch {
      clearTimeout(timeout);
      return null;
    }
  }

  try {
    let aqi = await tryFetch(city);

    if (aqi === null && city.includes(",")) {
      aqi = await tryFetch(city.split(",")[0].trim());
    }

    if (aqi === null) {
      const searchUrl = "https://api.waqi.info/search/?token=" + key + "&keyword=" + encodeURIComponent(city);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const searchRes = await fetch(searchUrl, { signal: controller.signal });
        clearTimeout(timeout);
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData.status === "ok" && searchData.data && searchData.data.length > 0) {
            const raw = searchData.data[0].aqi;
            if (raw && raw !== "-") {
              const parsed = parseInt(raw, 10);
              if (!isNaN(parsed) && parsed >= 0) aqi = parsed;
            }
          }
        }
      } catch {
        clearTimeout(timeout);
      }
    }

    if (aqi !== null) {
      // Cache AQI for 15 min
      res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=600");
      return res.status(200).json({ aqi });
    } else {
      return res.status(404).json({ error: "No AQI data available for this city" });
    }
  } catch (e) {
    return res.status(500).json({ error: "Request failed", detail: e.message });
  }
}
