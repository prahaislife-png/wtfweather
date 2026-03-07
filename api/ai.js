// api/ai.js — Perplexity proxy (server-side, key never exposed)
export default async function handler(req, res) {
  // CORS headers first (handles OPTIONS preflight too)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return res.status(500).json({ error: "PERPLEXITY_API_KEY not set in Vercel env vars" });

  let body;
  try { body = req.body; } catch(e) { return res.status(400).json({ error: "Bad request body" }); }

  const { prompt, system } = body || {};
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  try {
    const r = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + key
      },
      body: JSON.stringify({
        model: "sonar",
        max_tokens: 300,
        temperature: 0.7,
        messages: [
          { role: "system", content: system || "You are a practical weather advisor." },
          { role: "user",   content: prompt }
        ]
      })
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error("Perplexity error:", r.status, errText);
      return res.status(r.status).json({ error: "Perplexity API error", detail: errText });
    }

    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content || "";
    return res.status(200).json({ text });

  } catch (e) {
    console.error("ai.js exception:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
