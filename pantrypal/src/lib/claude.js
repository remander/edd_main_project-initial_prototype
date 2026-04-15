export async function callClaude(userPrompt, systemPrompt = "You are a helpful kitchen assistant.", imageData = null) {
  const content = [];

  if (imageData) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: imageData.mediaType,
        data: imageData.data,
      },
    });
  }

  content.push({ type: "text", text: userPrompt });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content }],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Claude API error");
  }

  const data = await response.json();
  return data.content?.map((b) => b.text || "").join("") || "";
}
