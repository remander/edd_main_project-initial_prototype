const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

const buildMealPrompt = (inventory, preferences = {}) => {
  const {
    mealType            = "any",
    dietaryRestrictions = [],
    cuisine             = "any",
    servings            = 2,
  } = preferences;

  const prioritized = [...inventory]
    .sort((a, b) => {
      if (!a.expiration) return 1;
      if (!b.expiration) return -1;
      return new Date(a.expiration) - new Date(b.expiration);
    })
    .slice(0, 20);

  const inventoryList = prioritized
    .map((item) => `- ${item.name}: ${item.quantity} ${item.unit}`)
    .join("\n");

  const restrictions =
    dietaryRestrictions.length > 0
      ? `Dietary restrictions: ${dietaryRestrictions.join(", ")}.`
      : "No dietary restrictions.";

  return `
You are a helpful chef assistant. Based on the following food inventory, suggest ONE complete meal recipe.

INVENTORY:
${inventoryList}

PREFERENCES:
- Meal type: ${mealType}
- Cuisine: ${cuisine}
- Servings: ${servings}
- ${restrictions}

INSTRUCTIONS:
- Only use ingredients that are available in the inventory above
- You may assume the user has basic pantry staples (salt, pepper, oil, water)
- Respond ONLY with a valid JSON object in this exact format (no markdown, no extra text):

{
  "mealName": "Name of the meal",
  "description": "A one-sentence description of the dish",
  "servings": 2,
  "prepTime": "10 minutes",
  "cookTime": "20 minutes",
  "ingredientsUsed": [
    { "name": "ingredient name", "amount": "1 cup" }
  ],
  "steps": [
    "Step 1 description",
    "Step 2 description"
  ],
  "tips": "Optional chef tip or substitution suggestion"
}
`.trim();
};

export const generateMealWithOpenAI = async (apiKey, inventory, preferences) => {
  const prompt = buildMealPrompt(inventory, preferences);

  let response;
  try {
    response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
        max_tokens: 1000,
      }),
    });
  } catch {
    throw new Error("Couldn't reach the AI service. Check your internet connection.");
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (response.status === 401)
      throw new Error("Your API key is invalid. Please check it and try again.");
    if (response.status === 429)
      throw new Error("You've hit your OpenAI rate limit. Wait a moment and try again.");
    throw new Error(err?.error?.message ?? "OpenAI request failed. Please try again.");
  }

  const data = await response.json();
  const rawText = data.choices?.[0]?.message?.content ?? "";
  const cleaned = rawText.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("The AI returned an unexpected response format. Please try again.");
  }
};
