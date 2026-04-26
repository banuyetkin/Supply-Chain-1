export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { messages, result, demand } = req.body;
  const system = `You are an AI assistant in a supplier selection tool. Current result: ${JSON.stringify(result)}. Original demand: ${demand} units. Help the user refine results. If they change demand, filters or goals, return an updated result in <updated_result>JSON</updated_result> tags. Always explain in <reply>text</reply> tags first.`;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 2000, system, messages: messages.map(m => ({ role: m.role, content: m.content })) }),
    });
    const data = await response.json();
    const raw = (data.content || []).map(c => c.text || "").join("");
    const replyMatch = raw.match(/<reply>([\s\S]*?)<\/reply>/);
    const reply = replyMatch ? replyMatch[1].trim() : raw.replace(/<updated_result>[\s\S]*?<\/updated_result>/g, "").trim();
    const resultMatch = raw.match(/<updated_result>([\s\S]*?)<\/updated_result>/);
    let updatedResult = null;
    if (resultMatch) { try { updatedResult = JSON.parse(resultMatch[1].trim()); } catch(e) {} }
    return res.status(200).json({ reply, updatedResult });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
