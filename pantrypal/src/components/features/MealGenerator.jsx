import { useState, useEffect } from "react";
import { Sparkles, Settings, Trash2 } from "lucide-react";
import { loadOpenAiApiKey, saveOpenAiApiKey } from "../../lib/userProfile";
import { generateMealWithOpenAI } from "../../lib/gemini";
import ApiKeySetup from "./ApiKeySetup";
import MealCard from "./MealCard";
import LoadingSpinner from "../ui/LoadingSpinner";

const MEAL_TYPES        = ["Any", "Breakfast", "Lunch", "Dinner", "Snack", "Dessert"];
const CUISINES          = ["Any", "Italian", "Mexican", "Asian", "Mediterranean", "American", "Indian"];
const DIETARY_OPTIONS   = ["Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free", "Nut-Free"];

export default function MealGenerator({ user, inventory }) {
  const [apiKey, setApiKey]           = useState(null);
  const [loadingKey, setLoadingKey]   = useState(true);

  const [mealType, setMealType]                     = useState("Any");
  const [cuisine, setCuisine]                       = useState("Any");
  const [servings, setServings]                     = useState(2);
  const [dietaryRestrictions, setDietaryRestrictions] = useState([]);

  const [generating, setGenerating]   = useState(false);
  const [generatedMeal, setGeneratedMeal] = useState(null);
  const [error, setError]             = useState(null);
  const [savedConfirm, setSavedConfirm] = useState(false);

  useEffect(() => {
    loadOpenAiApiKey(user.uid)
      .then(setApiKey)
      .finally(() => setLoadingKey(false));
  }, [user.uid]);

  const toggleDietary = (option) => {
    setDietaryRestrictions((prev) =>
      prev.includes(option) ? prev.filter((d) => d !== option) : [...prev, option]
    );
  };

  const handleGenerate = async () => {
    if (!inventory || inventory.length === 0) {
      setError("Your inventory is empty. Add some food items first!");
      return;
    }
    setGenerating(true);
    setError(null);
    setGeneratedMeal(null);
    setSavedConfirm(false);
    try {
      const meal = await generateMealWithOpenAI(apiKey, inventory, {
        mealType:            mealType === "Any" ? "any" : mealType,
        cuisine:             cuisine  === "Any" ? "any" : cuisine,
        servings,
        dietaryRestrictions,
      });
      setGeneratedMeal(meal);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleRemoveKey = async () => {
    await saveOpenAiApiKey(user.uid, "");
    setApiKey(null);
    setGeneratedMeal(null);
    setError(null);
  };

  if (loadingKey) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  if (!apiKey) {
    return <ApiKeySetup userId={user.uid} onKeySaved={(key) => setApiKey(key)} />;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-500" />
            AI Meal Generator
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {inventory.length} item{inventory.length !== 1 ? "s" : ""} available in your inventory
          </p>
        </div>
        <button
          onClick={handleRemoveKey}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 border border-gray-200 rounded-xl transition-colors cursor-pointer"
          title="Remove API key"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Remove Key
        </button>
      </div>

      {/* Preferences */}
      <div className="glass p-5 space-y-4">
        <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Settings className="w-4 h-4 text-emerald-500" /> Preferences
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Meal Type</label>
            <select
              value={mealType}
              onChange={(e) => setMealType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white cursor-pointer"
            >
              {MEAL_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Cuisine</label>
            <select
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white cursor-pointer"
            >
              {CUISINES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Servings</label>
          <input
            type="number"
            min={1}
            max={12}
            value={servings}
            onChange={(e) => setServings(Number(e.target.value))}
            className="w-24 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2">Dietary Restrictions</label>
          <div className="flex flex-wrap gap-2">
            {DIETARY_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => toggleDietary(opt)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                  dietaryRestrictions.includes(opt)
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "bg-white text-gray-600 border-gray-200 hover:border-emerald-300"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {generating ? (
          <>
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Generating your meal…
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Generate Meal
          </>
        )}
      </button>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {savedConfirm && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700 font-semibold">
          ✓ Recipe saved to your account!
        </div>
      )}

      {generatedMeal && (
        <MealCard
          meal={generatedMeal}
          userId={user.uid}
          onSaved={() => setSavedConfirm(true)}
        />
      )}
    </div>
  );
}
