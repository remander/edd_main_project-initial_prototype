import ExpiryBadge from "../ui/ExpiryBadge";
import { CATEGORY_EMOJI } from "../../lib/sampleData";

export default function ItemCard({ item, onEdit, onDelete }) {
  return (
    <div className="glass p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{CATEGORY_EMOJI[item.category] || "📦"}</span>
          <div>
            <h3 className="font-bold text-gray-900 text-sm leading-tight">{item.name}</h3>
            <p className="text-xs text-gray-500">{item.category}</p>
          </div>
        </div>
        <ExpiryBadge expiration={item.expiration} />
      </div>

      <div className="mt-3 space-y-1 text-xs text-gray-600">
        <div className="flex justify-between">
          <span className="font-medium">Quantity</span>
          <span>{item.quantity} {item.unit}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">Location</span>
          <span className="px-2 py-0.5 bg-gray-100 rounded-full">{item.location}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">Purchased</span>
          <span>{item.purchased}</span>
        </div>
      </div>

      <div className="mt-3 flex gap-2 pt-3 border-t border-gray-100">
        <button
          onClick={() => onEdit(item)}
          className="flex-1 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
        >
          ✏️ Edit
        </button>
        <button
          onClick={() => onDelete(item.id)}
          className="flex-1 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
        >
          🗑️ Delete
        </button>
      </div>
    </div>
  );
}
