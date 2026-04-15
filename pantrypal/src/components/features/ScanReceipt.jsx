import { useState, useRef } from "react";
import { callClaude } from "../../lib/claude";
import { estimateExpiration } from "../../lib/expiration";
import { CATEGORIES, UNITS } from "../../lib/sampleData";
import LoadingSpinner from "../ui/LoadingSpinner";

const SYSTEM_PROMPT = `You are a grocery receipt parser. Extract only food and beverage items from the receipt. Return ONLY valid JSON with no markdown, no explanation. Format:
[
  { "name": "item name", "quantity": 1, "unit": "count", "category": "Produce|Dairy|Meat|Seafood|Pantry|Frozen|Beverages|Other" }
]
Infer reasonable quantities and units from context. Ignore non-food items, store names, totals, taxes, and discounts.`;

export default function ScanReceipt({ addItems, addToast }) {
  const [mode, setMode] = useState("text");
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const fileRef = useRef();

  const handleImageChange = (file) => {
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const scan = async () => {
    if (mode === "text" && !text.trim()) {
      addToast("Please paste receipt text first.", "warning");
      return;
    }
    if (mode === "image" && !imageFile) {
      addToast("Please upload a receipt image first.", "warning");
      return;
    }

    setLoading(true);
    setResults(null);
    try {
      let raw;
      if (mode === "image") {
        const dataUrl = imagePreview;
        const [header, base64] = dataUrl.split(",");
        const mediaType = header.match(/:(.*?);/)[1];
        raw = await callClaude(
          "Parse this grocery receipt and return only the food items as JSON.",
          SYSTEM_PROMPT,
          { mediaType, data: base64 }
        );
      } else {
        raw = await callClaude(
          `Parse this grocery receipt text and return only the food items as JSON:\n\n${text}`,
          SYSTEM_PROMPT
        );
      }

      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);

      if (!Array.isArray(parsed) || parsed.length === 0) {
        addToast("No food items detected. Try a clearer image or more complete text.", "warning");
        return;
      }

      const withExpiry = parsed.map((item, i) => ({
        ...item,
        id: `scan_${Date.now()}_${i}`,
        quantity: item.quantity || 1,
        unit: item.unit || "count",
        category: item.category || "Other",
        location: "Fridge",
        expiration: estimateExpiration(item.name),
        purchased: new Date().toISOString().split("T")[0],
      }));

      setResults(withExpiry);
    } catch (err) {
      addToast(`Scan failed: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const updateResult = (id, field, value) => {
    setResults((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const removeResult = (id) => {
    setResults((prev) => prev.filter((item) => item.id !== id));
  };

  const addAll = () => {
    if (!results || results.length === 0) return;
    addItems(results);
    addToast(`Added ${results.length} items to inventory!`, "success");
    setResults(null);
    setText("");
    setImageFile(null);
    setImagePreview(null);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="glass p-6">
        <h2 className="text-2xl font-extrabold text-gray-900 mb-1">📷 Scan Receipt</h2>
        <p className="text-gray-500 text-sm mb-5">Upload a receipt photo or paste the text — AI will extract the food items.</p>

        {/* Mode Tabs */}
        <div className="flex gap-2 mb-5">
          {["image", "text"].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`cursor-pointer px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                mode === m ? "nav-active" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {m === "image" ? "📸 Upload Image" : "📝 Paste Text"}
            </button>
          ))}
        </div>

        {mode === "image" ? (
          <div
            className="border-2 border-dashed border-emerald-300 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/50 transition-all"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleImageChange(e.dataTransfer.files[0]);
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleImageChange(e.target.files[0])}
            />
            {imagePreview ? (
              <img src={imagePreview} alt="Receipt" className="max-h-48 mx-auto rounded-lg object-contain" />
            ) : (
              <>
                <p className="text-4xl mb-2">📷</p>
                <p className="text-gray-600 font-medium">Drop image here or click to browse</p>
                <p className="text-xs text-gray-400 mt-1">Supports JPG, PNG, WEBP</p>
              </>
            )}
          </div>
        ) : (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your receipt text here..."
            className="w-full h-40 p-4 border border-gray-200 rounded-xl text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        )}

        <button
          onClick={scan}
          disabled={loading}
          className="cursor-pointer mt-4 w-full py-3 bg-linear-to-r from-emerald-500 to-cyan-500 text-white rounded-xl font-bold text-sm shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? "Analyzing..." : "🔍 Scan Receipt"}
        </button>

        {loading && <LoadingSpinner message="Analyzing receipt with AI..." />}
      </div>

      {/* Results */}
      {results && (
        <div className="glass p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">
              Found {results.length} items — review before adding
            </h3>
            <button
              onClick={addAll}
              className="px-5 py-2 bg-emerald-500 text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition-colors"
            >
              ✅ Add All to Inventory
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-semibold">Name</th>
                  <th className="pb-2 font-semibold">Category</th>
                  <th className="pb-2 font-semibold">Qty</th>
                  <th className="pb-2 font-semibold">Unit</th>
                  <th className="pb-2 font-semibold">Expires</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {results.map((item) => (
                  <tr key={item.id} className="hover:bg-emerald-50/30">
                    <td className="py-2 pr-2">
                      <input
                        value={item.name}
                        onChange={(e) => updateResult(item.id, "name", e.target.value)}
                        className="w-full bg-transparent border-b border-transparent hover:border-gray-200 focus:border-emerald-400 focus:outline-none px-1 py-0.5"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <select
                        value={item.category}
                        onChange={(e) => updateResult(item.id, "category", e.target.value)}
                        className="bg-transparent text-sm focus:outline-none"
                      >
                        {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        min="0"
                        value={item.quantity}
                        onChange={(e) => updateResult(item.id, "quantity", Number(e.target.value))}
                        className="w-16 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-emerald-400 focus:outline-none px-1"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <select
                        value={item.unit}
                        onChange={(e) => updateResult(item.id, "unit", e.target.value)}
                        className="bg-transparent text-sm focus:outline-none"
                      >
                        {UNITS.map((u) => <option key={u}>{u}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="date"
                        value={item.expiration}
                        onChange={(e) => updateResult(item.id, "expiration", e.target.value)}
                        className="bg-transparent text-sm border-b border-transparent hover:border-gray-200 focus:border-emerald-400 focus:outline-none"
                      />
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => removeResult(item.id)}
                        className="text-red-400 hover:text-red-600 transition-colors text-xs"
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
