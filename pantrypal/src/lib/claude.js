// All text calls route through the Vite dev server proxy (/api/claude),
// which uses the claude CLI and your subscription — no API key needed.
// Image calls (receipt scanning) go direct and need VITE_ANTHROPIC_API_KEY.

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

// Returns { text, usage } — callers destructure as needed.
export async function callClaude(userPrompt, systemPrompt = 'You are a helpful kitchen assistant.', imageData = null) {
  if (!imageData) {
    return callClaudeProxy(userPrompt, systemPrompt);
  }

  // Image path: direct API call for receipt scanning
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: imageData.mediaType, data: imageData.data } },
            { type: 'text', text: userPrompt },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Claude API error');
  }

  const data = await response.json();
  const text = data.content?.map((b) => b.text || '').join('') || '';
  const usage = data.usage
    ? { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens,
        cacheReadTokens: 0, cacheWriteTokens: 0, costUSD: null, durationMs: null,
        model: 'claude-haiku-4-5' }
    : null;
  return { text, usage };
}

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

// Returns { meal, usage }
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
