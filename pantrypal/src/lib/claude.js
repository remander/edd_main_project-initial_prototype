// All text calls route through the Vite dev server proxy (/api/claude),
// which uses the claude CLI and your subscription — no API key needed.
// Image calls (receipt scanning) go direct and need VITE_ANTHROPIC_API_KEY.

// Sends a text-only prompt to the Vite dev server proxy, which invokes the Claude CLI
async function callClaudeProxy(prompt, system) {
  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, system, model: 'claude-haiku-4-5' }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Claude request failed');
  }

  // Returns { text, usage: { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, costUSD, durationMs, model } }
  return response.json();
}

// Unified Claude entry point — routes text calls through the proxy and image calls through the vision endpoint
export async function callClaude(userPrompt, systemPrompt = 'You are a helpful kitchen assistant.', imageData = null, model = 'claude-haiku-4-5') {
  if (!imageData) {
    return callClaudeProxy(userPrompt, systemPrompt);
  }

  // Image path: route through Vite proxy so no API key is needed
  const response = await fetch('/api/claude-vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: userPrompt, system: systemPrompt, model, imageData }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Claude vision request failed');
  }

  return response.json();
}

// Builds the structured prompt for single-recipe generation, prioritising items closest to expiry
const buildMealPrompt = (inventory, preferences = {}) => {
  const {
    mealType            = 'any',
    dietaryRestrictions = [],
    cuisine             = 'any',
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
    .join('\n');

  const restrictions =
    dietaryRestrictions.length > 0
      ? `Dietary restrictions: ${dietaryRestrictions.join(', ')}.`
      : 'No dietary restrictions.';

  return `Based on the following food inventory, suggest ONE complete meal recipe.

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
}`;
};

// Calls Claude with the meal prompt and parses the JSON recipe response; returns { meal, usage }
export const generateMealWithClaude = async (inventory, preferences) => {
  const prompt = buildMealPrompt(inventory, preferences);
  const { text: rawText, usage } = await callClaudeProxy(
    prompt,
    'You are a helpful chef assistant. Respond ONLY with valid JSON, no markdown, no extra text.'
  );
  const cleaned = rawText.replace(/```json|```/g, '').trim();

  try {
    return { meal: JSON.parse(cleaned), usage };
  } catch {
    throw new Error('The AI returned an unexpected response format. Please try again.');
  }
};
