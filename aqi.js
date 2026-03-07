// api/aqi.js — WAQI proxy
// Key lives in Vercel env var: WAQI_API_KEY
// Never exposed to the browser

export default async function handler(req, res) {
  // Handle CORS preflight
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
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
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.status !== "ok" || !data.data) return null;
    // WAQI returns aqi as string OR number; also returns "-" when no data
    const raw = data.data.aqi;
    if (raw === undefined || raw === null || raw === "-") return null;
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed) || parsed < 0) return null;
    return parsed;
  }

  try {
    // Try exact city name first, then try just first word (e.g. "New York" -> "New")
    // WAQI handles city names well but sometimes needs the simpler form
    let aqi = await tryFetch(city);

    // If not found, try without country suffix (e.g. "Mumbai, India" -> "Mumbai")
    if (aqi === null && city.includes(",")) {
      aqi = await tryFetch(city.split(",")[0].trim());
    }

    // If still not found, try search endpoint which is more forgiving
    if (aqi === null) {
      const searchUrl = "https://api.waqi.info/search/?token=" + key + "&keyword=" + encodeURIComponent(city);
      const searchRes = await fetch(searchUrl);
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.status === "ok" && searchData.data && searchData.data.length > 0) {
          const best = searchData.data[0];
          const raw = best.aqi;
          if (raw && raw !== "-") {
            const parsed = parseInt(raw, 10);
            if (!isNaN(parsed) && parsed >= 0) aqi = parsed;
          }
        }
      }
    }

    if (aqi !== null) {
      return res.status(200).json({ aqi });
    } else {
      return res.status(404).json({ error: "No AQI data available for this city" });
    }
  } catch (e) {
    return res.status(500).json({ error: "Request failed", detail: e.message });
  }
}
