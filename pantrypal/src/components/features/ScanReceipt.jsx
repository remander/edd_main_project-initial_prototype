import { useState, useRef } from "react";
import { callClaude } from "../../lib/claude";
import { parseReceiptText } from "../../lib/receiptParser";
import { estimateExpiration } from "../../lib/expiration";
import { CATEGORIES, UNITS } from "../../lib/sampleData";
import LoadingSpinner from "../ui/LoadingSpinner";

const SYSTEM_PROMPT = `You are an expert grocery receipt parser with knowledge of all major store formats (Costco, Aldi, Walmart, Kroger, Trader Joe's, Whole Foods, etc.).

Extract EVERY food and beverage item from the receipt — do not skip any, even if the name is abbreviated or partially visible.

Rules:
- Expand abbreviations into readable names (e.g. "CHKN BRST" → "Chicken Breast", "ORG BABY SPNCH" → "Organic Baby Spinach", "2% MLKFAT" → "2% Milk")
- If a single item spans multiple lines, combine them into one entry
- Include the quantity and weight/unit shown on the receipt; if missing, default to quantity 1 and unit "count"
- Assign one category: Produce, Dairy, Meat, Seafood, Pantry, Frozen, Beverages, or Other
- IGNORE: store name, address, phone number, cashier/operator info, transaction/order ID, subtotal, tax, total, change, payment method, discounts, coupons, rewards points, and membership fees

Return ONLY a valid JSON array with no markdown fences and no extra text:
[
  { "name": "item name", "quantity": 1, "unit": "count", "category": "Produce|Dairy|Meat|Seafood|Pantry|Frozen|Beverages|Other" }
]`;

// Robustly extract a JSON array from a model response that may contain surrounding prose,
// markdown fences, or non-standard whitespace. Tries three strategies in order.
function extractJSONArray(raw) {
  // 1. Strip markdown fences and try a direct parse
  const stripped = raw.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
  try { const r = JSON.parse(stripped); if (Array.isArray(r)) return r; } catch {}

  // 2. Slice from the first '[' to the last ']' and parse that substring
  const start = stripped.indexOf("[");
  const end   = stripped.lastIndexOf("]");
  if (start !== -1 && end > start) {
    try { const r = JSON.parse(stripped.slice(start, end + 1)); if (Array.isArray(r)) return r; } catch {}
  }

  // 3. Normalize unicode/non-breaking whitespace then retry slice
  const normalized = stripped.replace(/[  -​  　]/g, " ");
  const s2 = normalized.indexOf("[");
  const e2 = normalized.lastIndexOf("]");
  if (s2 !== -1 && e2 > s2) {
    try { const r = JSON.parse(normalized.slice(s2, e2 + 1)); if (Array.isArray(r)) return r; } catch {}
  }

  throw new Error("Could not parse receipt items from AI response. Try scanning again.");
}

// Resize and JPEG-compress an image file to keep the base64 payload manageable.
// Max dimension 1800px is plenty for reading receipt text; quality 0.88 keeps it sharp.
function compressImage(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve(dataUrl.split(",")[1]);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

const MODELS = [
  {
    id: "claude-haiku-4-5",
    name: "Haiku",
    tag: "Fast & Affordable",
    description: "Good for clear, well-lit receipts. Fastest response, lowest cost.",
    costHint: "~$0.001 per scan",
    accent: "emerald",
  },
  {
    id: "claude-sonnet-4-6",
    name: "Sonnet",
    tag: "Accurate & Thorough",
    description: "Best for busy, blurry, or abbreviated receipts. Expands truncated names and misses fewer items.",
    costHint: "~$0.01 per scan",
    accent: "violet",
    recommended: true,
  },
];

export default function ScanReceipt({ addItems, addToast, addUsageLog }) {
  const [mode, setMode] = useState("text");
  const [selectedModel, setSelectedModel] = useState("claude-sonnet-4-6");
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [pendingScan, setPendingScan] = useState(null);
  const fileRef = useRef();

  // Stores the selected file and generates a local preview URL for display before upload
  const handleImageChange = (file) => {
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
  };

  // Compresses the image (or parses pasted text), sends to Claude, and shows extracted items for review
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
    const scanStart = performance.now();
    try {
      if (mode === "image") {
        // Compress before sending — original images can be 3–7 MB which overwhelms the CLI stdin buffer
        const imageBase64 = await compressImage(imageFile, 1800, 0.88);

        const { text: raw, usage } = await callClaude(
          "Carefully read every line of this receipt image and extract all food and beverage items. Do not skip any item even if the name is abbreviated or truncated.",
          SYSTEM_PROMPT,
          { mediaType: "image/jpeg", data: imageBase64 },
          selectedModel
        );

        const parsed = extractJSONArray(raw);

        if (!Array.isArray(parsed) || parsed.length === 0) {
          addToast("No food items detected. Try a clearer image.", "warning");
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
        setSelected(new Set(withExpiry.map((item) => item.id)));
        if (addUsageLog && usage) {
          setPendingScan({
            usage,
            itemsExtracted: withExpiry.length,
            extractedItems: withExpiry.map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit })),
            model: MODELS.find(m => m.id === selectedModel)?.name ?? selectedModel,
            filename: imageFile.name || 'receipt image',
            clientDurationMs: Math.round(performance.now() - scanStart),
            timestamp: Date.now(),
          });
        }
        return;
      } else {
        const parsed = parseReceiptText(text);

        if (parsed.length === 0) {
          addToast("No food items detected. Try pasting more of the receipt text.", "warning");
          return;
        }

        const withExpiry = parsed.map((item) => ({
          ...item,
          expiration: estimateExpiration(item.name),
        }));

        setResults(withExpiry);
        setSelected(new Set(withExpiry.map((item) => item.id)));
        return;
      }
    } catch (err) {
      addToast(`Scan failed: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // Allows the user to inline-edit a single field on any scanned item before confirming
  const updateResult = (id, field, value) => {
    setResults((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Permanently removes an item from the results list and deselects it
  const removeResult = (id) => {
    setResults((prev) => prev.filter((item) => item.id !== id));
    setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
  };

  // Toggles one item's checkbox without affecting the rest of the selection
  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Selects all items if any are unselected; clears all if everything is already selected
  const toggleSelectAll = () => {
    if (!results) return;
    setSelected(selected.size === results.length ? new Set() : new Set(results.map((i) => i.id)));
  };

  // Adds confirmed items to inventory, fires the deferred usage log with accuracy data, and resets the form
  const addSelected = () => {
    if (!results || selected.size === 0) {
      addToast("No items selected.", "warning");
      return;
    }
    const toAdd = results.filter((item) => selected.has(item.id));
    addItems(toAdd);
    if (addUsageLog && pendingScan) {
      const { usage, itemsExtracted, extractedItems, model, filename, clientDurationMs, timestamp } = pendingScan;
      addUsageLog({
        task: 'receipt-scan',
        description: `${toAdd.length}/${itemsExtracted} items added · ${model} · ${filename}`,
        ...usage,
        itemsExtracted,
        itemsAdded: toAdd.length,
        extractedItems,
        addedItems: toAdd.map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit })),
        clientDurationMs,
        timestamp,
      });
    }
    addToast(`Added ${toAdd.length} item${toAdd.length !== 1 ? "s" : ""} to inventory!`, "success");
    setResults(null);
    setSelected(new Set());
    setText("");
    setImageFile(null);
    setImagePreview(null);
    setPendingScan(null);
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

        {/* Model selector — only relevant for image mode */}
        {mode === "image" && (
          <div className="mb-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Scan Quality</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {MODELS.map((m) => {
                const isActive = selectedModel === m.id;
                const ring = m.accent === "violet"
                  ? "border-violet-400 bg-violet-50"
                  : "border-emerald-400 bg-emerald-50";
                const badge = m.accent === "violet"
                  ? "bg-violet-100 text-violet-700"
                  : "bg-emerald-100 text-emerald-700";
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedModel(m.id)}
                    className={`cursor-pointer text-left rounded-xl border-2 p-4 transition-all ${
                      isActive ? ring : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${
                          isActive
                            ? m.accent === "violet" ? "border-violet-500 bg-violet-500" : "border-emerald-500 bg-emerald-500"
                            : "border-gray-300"
                        }`} />
                        <span className="font-bold text-sm text-gray-800">{m.name}</span>
                        {m.recommended && (
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Recommended</span>
                        )}
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isActive ? badge : "bg-gray-100 text-gray-500"}`}>
                        {m.costHint}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-gray-600 ml-5">{m.tag}</p>
                    <p className="text-xs text-gray-400 mt-0.5 ml-5">{m.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

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

        {loading && <LoadingSpinner message={mode === "image" ? "Analyzing receipt with AI..." : "Parsing receipt..."} />}
      </div>

      {/* Results */}
      {results && (
        <div className="glass p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">
              Found {results.length} items —{" "}
              <span className="text-emerald-600">{selected.size} selected</span>
            </h3>
            <button
              onClick={addSelected}
              disabled={selected.size === 0}
              className="px-5 py-2 bg-emerald-500 text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ✅ Add Selected to Inventory
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 pr-2">
                    <input
                      type="checkbox"
                      checked={selected.size === results.length}
                      onChange={toggleSelectAll}
                      className="accent-emerald-500"
                      title="Select all / none"
                    />
                  </th>
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
                  <tr key={item.id} className={`hover:bg-emerald-50/30 ${!selected.has(item.id) ? "opacity-40" : ""}`}>
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="accent-emerald-500"
                      />
                    </td>
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
