import { useState } from "react";
import { Clock, Users, BookmarkPlus, Check } from "lucide-react";
import { saveMeal } from "../../lib/userProfile";

export default function MealCard({ meal, userId, onSaved }) {
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const mealWithId = {
        ...meal,
        id: String(Date.now()),
        savedAt: new Date().toISOString(),
      };
      await saveMeal(userId, mealWithId);
      setSaved(true);
      if (onSaved) onSaved(mealWithId);
    } catch {
      setError("Failed to save recipe. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-gray-800">{meal.mealName}</h3>
          <p className="text-sm text-gray-500 mt-1">{meal.description}</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || saved}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 border border-emerald-300 text-emerald-700 rounded-xl text-sm font-semibold hover:bg-emerald-50 transition-colors disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
        >
          {saved ? <Check className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
          {saved ? "Saved" : saving ? "Saving…" : "Save"}
        </button>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
        <span className="flex items-center gap-1.5">
          <Users className="w-4 h-4 text-emerald-500" />
          {meal.servings} serving{meal.servings !== 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-emerald-500" />
          Prep {meal.prepTime}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-amber-500" />
          Cook {meal.cookTime}
        </span>
      </div>

      <div className="border-t border-gray-100" />

      {/* Ingredients */}
      <div>
        <h4 className="text-sm font-bold text-gray-700 mb-2">Ingredients</h4>
        <ul className="space-y-1">
          {meal.ingredientsUsed.map((ing, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="text-emerald-500 mt-0.5">•</span>
              <span><strong>{ing.amount}</strong> {ing.name}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-gray-100" />

      {/* Steps */}
      <div>
        <h4 className="text-sm font-bold text-gray-700 mb-2">Instructions</h4>
        <ol className="space-y-2">
          {meal.steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-gray-600">
              <span className="shrink-0 w-5 h-5 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-xs font-bold">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Tips */}
      {meal.tips && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-800">
          <strong>Chef's Tip:</strong> {meal.tips}
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
