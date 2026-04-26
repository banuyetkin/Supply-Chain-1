export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { suppliers, demand } = req.body;
  if (!suppliers?.length || !demand) return res.status(400).json({ error: "Missing data" });
  const sorted = [...suppliers].sort((a, b) => a.distance_km - b.distance_km);
  const prompt = `You are a procurement expert. Select optimal suppliers to fulfil ${demand} units. Minimise weighted distance while meeting demand and not exceeding capacity. Supplier data: ${JSON.stringify(sorted)}. Return ONLY valid JSON no markdown: {"selected":[{"name":"","distance_km":0,"transport":0,"purchase":0,"capacity":0,"allocated_units":0,"reason":""}],"all_ranked":[{"name":"","distance_km":0,"transport":0,"purchase":0,"capacity":0}],"demand_covered":0,"total_distance_km":0,"avg_cost_per_unit":0,"strategy":"","risks":""}`;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 2000, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await response.json();
    const text = (data.content || []).map(c => c.text || "").join("");
    return res.status(200).json(JSON.parse(text.replace(/```json|```/g, "").trim()));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
