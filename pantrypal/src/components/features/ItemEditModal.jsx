import { useState, useEffect, useRef } from "react";
import Modal from "../ui/Modal";
import { estimateExpiration } from "../../lib/expiration";
import { CATEGORIES, LOCATIONS, UNITS } from "../../lib/sampleData";

const today = new Date().toISOString().split("T")[0];

const BLANK = {
  name: "", category: "Produce", quantity: 1, unit: "count",
  location: "Fridge", purchased: today, expiration: "",
};

export default function ItemEditModal({ isOpen, onClose, item, onSave }) {
  const [form, setForm] = useState(BLANK);
  const expiryManuallySet = useRef(false);

  useEffect(() => {
    if (item) {
      setForm({ ...item });
      expiryManuallySet.current = true;
    } else {
      setForm({ ...BLANK, purchased: today });
      expiryManuallySet.current = false;
    }
  }, [item, isOpen]);

  const set = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "expiration") expiryManuallySet.current = true;
    if (field === "name" && !expiryManuallySet.current) {
      const est = estimateExpiration(value);
      setForm((prev) => ({ ...prev, name: value, expiration: est }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={item ? "✏️ Edit Item" : "➕ Add Item"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Name *">
          <input
            required
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Chicken Breast"
            className="input-field"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <select value={form.category} onChange={(e) => set("category", e.target.value)} className="input-field">
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Location">
            <select value={form.location} onChange={(e) => set("location", e.target.value)} className="input-field">
              {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity">
            <input
              type="number" min="0" step="any"
              value={form.quantity}
              onChange={(e) => set("quantity", e.target.value)}
              className="input-field"
            />
          </Field>
          <Field label="Unit">
            <select value={form.unit} onChange={(e) => set("unit", e.target.value)} className="input-field">
              {UNITS.map((u) => <option key={u}>{u}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Purchase Date">
            <input
              type="date"
              value={form.purchased}
              onChange={(e) => set("purchased", e.target.value)}
              className="input-field"
            />
          </Field>
          <Field label="Expiration Date">
            <input
              type="date"
              value={form.expiration}
              onChange={(e) => set("expiration", e.target.value)}
              className="input-field"
            />
          </Field>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button type="submit" className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity">
            {item ? "Save Changes" : "Add Item"}
          </button>
        </div>
      </form>

      <style>{`
        .input-field {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.15s;
        }
        .input-field:focus {
          border-color: #10b981;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
        }
      `}</style>
    </Modal>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
