// api/ai.js — Perplexity proxy
// Key lives in Vercel env var: PERPLEXITY_API_KEY
// Never exposed to the browser

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "API key not configured" });
  }

  const { prompt, system, max_tokens } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }

  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + key,
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: system || "You are a practical weather advisor." },
          { role: "user", content: prompt },
        ],
        max_tokens: max_tokens || 200,
        temperature: 0.72,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: "Upstream error", detail: err });
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || null;
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: "Request failed", detail: e.message });
  }
}
