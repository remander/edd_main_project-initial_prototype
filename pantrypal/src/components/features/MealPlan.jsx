import { useState } from "react";
import { callClaude } from "../../lib/claude";
import { daysUntilExpiry } from "../../lib/expiration";
import { DIETARY } from "../../lib/sampleData";
import LoadingSpinner from "../ui/LoadingSpinner";
import MealGenerator from "./MealGenerator";

const SYSTEM_PROMPT = `You are a meal planning chef assistant. Generate practical, delicious meal plans using primarily the provided inventory. Return ONLY valid JSON, no markdown, no explanation.`;

const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner"];

export default function MealPlan({ user, inventory, mealPlans, setMealPlans, addToast }) {
  const [days, setDays] = useState(5);
  const [selectedMeals, setSelectedMeals] = useState(["Breakfast", "Lunch", "Dinner"]);
  const [dietary, setDietary] = useState([]);
  const [prioritizeExpiring, setPrioritizeExpiring] = useState(true);
  const [loading, setLoading] = useState(false);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [activeTab, setActiveTab] = useState("generate");
  const [expandedSaved, setExpandedSaved] = useState(null);

  const toggleMeal = (meal) => {
    setSelectedMeals((prev) =>
      prev.includes(meal) ? prev.filter((m) => m !== meal) : [...prev, meal]
    );
  };

  const toggleDietary = (d) => {
    setDietary((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  };

  const expiring = inventory.filter((item) => {
    const d = daysUntilExpiry(item.expiration);
    return d >= 0 && d <= 7;
  });

  const generate = async () => {
    if (selectedMeals.length === 0) {
      addToast("Select at least one meal type.", "warning");
      return;
    }
    setLoading(true);
    setCurrentPlan(null);

    const prompt = `Generate a ${days}-day meal plan with ${selectedMeals.join(", ")} per day.
Dietary restrictions: ${dietary.length ? dietary.join(", ") : "None"}
Prioritize expiring items: ${prioritizeExpiring}

Current inventory:
${JSON.stringify(inventory.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit })))}

Expiring soon (use first):
${JSON.stringify(expiring.map((i) => ({ name: i.name, daysLeft: daysUntilExpiry(i.expiration) })))}

Return format:
{
  "days": [
    {
      "day": "Day 1",
      "meals": [
        {
          "type": "Breakfast",
          "name": "Recipe Name",
          "ingredients": [
            { "name": "ingredient", "inInventory": true, "quantity": "1 cup" }
          ],
          "instructions": "Brief 2-3 sentence cooking instructions.",
          "prepTime": "15 mins",
          "usesExpiring": false
        }
      ]
    }
  ]
}`;

    try {
      const raw = await callClaude(prompt, SYSTEM_PROMPT);
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      setCurrentPlan(parsed);
    } catch (err) {
      addToast(`Failed to generate plan: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const savePlan = () => {
    if (!currentPlan) return;
    const saved = {
      id: Date.now(),
      savedAt: new Date().toLocaleDateString(),
      plan: currentPlan,
    };
    setMealPlans((prev) => [saved, ...prev]);
    addToast("Meal plan saved!", "success");
  };

  const deleteSaved = (id) => {
    setMealPlans((prev) => prev.filter((p) => p.id !== id));
    if (expandedSaved === id) setExpandedSaved(null);
    addToast("Plan deleted.", "info");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { id: "generate", label: "✨ Meal Plan" },
          { id: "recipe",   label: "🍽️ Recipe Generator" },
          { id: "saved",    label: `📋 Saved Plans (${mealPlans.length})` },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`cursor-pointer px-5 py-2 rounded-xl font-semibold text-sm transition-all ${
              activeTab === id ? "nav-active" : "bg-white/70 text-gray-600 hover:bg-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "recipe" ? (
        <MealGenerator user={user} inventory={inventory} />
      ) : activeTab === "generate" ? (
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Preferences */}
          <div className="lg:col-span-2 glass p-5 space-y-5">
            <h2 className="text-lg font-bold text-gray-900">🎛️ Preferences</h2>

            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-2">
                Number of Days: <span className="text-emerald-600">{days}</span>
              </label>
              <input
                type="range" min={1} max={7} value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>1</span><span>7</span>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Meals per Day</p>
              <div className="flex gap-2 flex-wrap">
                {MEAL_TYPES.map((m) => (
                  <button
                    key={m}
                    onClick={() => toggleMeal(m)}
                    className={`cursor-pointer px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      selectedMeals.includes(m)
                        ? "bg-emerald-500 text-white border-emerald-500"
                        : "bg-white border-gray-200 text-gray-600 hover:border-emerald-300"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Dietary Restrictions</p>
              <div className="flex flex-wrap gap-2">
                {DIETARY.map((d) => (
                  <button
                    key={d}
                    onClick={() => toggleDietary(d)}
                    className={`cursor-pointer px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      dietary.includes(d)
                        ? "bg-cyan-500 text-white border-cyan-500"
                        : "bg-white border-gray-200 text-gray-600 hover:border-cyan-300"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">Prioritize Expiring Items</p>
              <button
                onClick={() => setPrioritizeExpiring((v) => !v)}
                className={`cursor-pointer w-11 h-6 rounded-full transition-colors ${
                  prioritizeExpiring ? "bg-emerald-500" : "bg-gray-200"
                }`}
              >
                <span
                  className={`block w-4 h-4 bg-white rounded-full shadow mx-1 transition-transform ${
                    prioritizeExpiring ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>

            <button
              onClick={generate}
              disabled={loading}
              className={`w-full py-3 bg-linear-to-r from-emerald-500 to-cyan-500 text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 ${ loading ? "cursor-not-allowed" : "cursor-pointer"}`}
            >
              {loading ? "Generating..." : "✨ Generate Meal Plan"}
            </button>
          </div>

          {/* Result */}
          <div className="lg:col-span-3">
            {loading ? (
              <div className="glass p-8">
                <LoadingSpinner message="Creating your personalized meal plan..." />
              </div>
            ) : currentPlan ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-gray-900">Your {days}-Day Plan</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={generate}
                      className="px-4 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors"
                    >
                      🔄 Regenerate
                    </button>
                    <button
                      onClick={savePlan}
                      className="px-4 py-2 text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl transition-colors"
                    >
                      📋 Save Plan
                    </button>
                  </div>
                </div>
                {currentPlan.days?.map((dayData) => (
                  <DayCard key={dayData.day} dayData={dayData} />
                ))}
              </div>
            ) : (
              <div className="glass p-12 text-center text-gray-400">
                <p className="text-5xl mb-4">🍳</p>
                <p className="font-semibold text-lg">Ready to plan your meals?</p>
                <p className="text-sm mt-1">Adjust your preferences and hit Generate.</p>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === "saved" ? (
        <div className="space-y-3">
          {mealPlans.length === 0 ? (
            <div className="glass p-12 text-center text-gray-400">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-semibold">No saved plans yet</p>
              <p className="text-sm mt-1">Generate a plan and save it!</p>
            </div>
          ) : (
            mealPlans.map((saved) => (
              <div key={saved.id} className="glass p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-gray-900">
                      {saved.plan.days?.length}-Day Plan
                    </p>
                    <p className="text-xs text-gray-500">Saved {saved.savedAt}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setExpandedSaved(expandedSaved === saved.id ? null : saved.id)}
                      className="px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors"
                    >
                      {expandedSaved === saved.id ? "▲ Hide" : "▼ View"}
                    </button>
                    <button
                      onClick={() => deleteSaved(saved.id)}
                      className="px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      🗑 Delete
                    </button>
                  </div>
                </div>
                {expandedSaved === saved.id && (
                  <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                    {saved.plan.days?.map((dayData) => (
                      <DayCard key={dayData.day} dayData={dayData} />
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function DayCard({ dayData }) {
  return (
    <div className="glass p-4">
      <h4 className="font-bold text-gray-900 mb-3 text-base">{dayData.day}</h4>
      <div className="space-y-3">
        {dayData.meals?.map((meal, i) => (
          <div key={i} className="bg-white/70 rounded-xl p-3 border border-white/60">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wide">{meal.type}</span>
              <div className="flex items-center gap-2">
                {meal.usesExpiring && (
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">⚡ Uses expiring</span>
                )}
                <span className="text-xs text-gray-400">⏱ {meal.prepTime}</span>
              </div>
            </div>
            <p className="font-bold text-gray-800 text-sm mb-1">{meal.name}</p>
            <p className="text-xs text-gray-600 mb-2">{meal.instructions}</p>
            <div className="flex flex-wrap gap-1">
              {meal.ingredients?.map((ing, j) => (
                <span
                  key={j}
                  className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                    ing.inInventory
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-600"
                  }`}
                >
                  {ing.inInventory ? "✅" : "🔴"} {ing.quantity} {ing.name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
