import { daysUntilExpiry } from "../../lib/expiration";
import ExpiryBadge from "../ui/ExpiryBadge";
import { CATEGORY_EMOJI } from "../../lib/sampleData";

const CATEGORY_COLORS = {
  Produce: "bg-green-500", Dairy: "bg-blue-400", Meat: "bg-red-400",
  Seafood: "bg-cyan-500", Pantry: "bg-amber-400", Frozen: "bg-indigo-400",
  Beverages: "bg-purple-400", Other: "bg-gray-400",
};

export default function Dashboard({ inventory, setPage }) {
  const expiringSoon = inventory
    .filter((item) => {
      const d = daysUntilExpiry(item.expiration);
      return d >= 0 && d <= 7;
    })
    .sort((a, b) => daysUntilExpiry(a.expiration) - daysUntilExpiry(b.expiration));

  const critical = inventory.filter((item) => {
    const d = daysUntilExpiry(item.expiration);
    return d >= 0 && d <= 3;
  });

  const fresh = inventory.filter((item) => daysUntilExpiry(item.expiration) > 7);

  // Category breakdown
  const categories = inventory.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});

  const total = inventory.length || 1;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Items" value={inventory.length} color="text-gray-800" bg="bg-white/80" />
        <StatCard label="Expiring Soon" value={expiringSoon.length} color="text-yellow-700" bg="bg-yellow-50" />
        <StatCard label="Critical" value={critical.length} color="text-red-700" bg="bg-red-50" />
        <StatCard label="Fresh Items" value={fresh.length} color="text-emerald-700" bg="bg-emerald-50" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Use These First */}
        <div className="glass p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-3">⚡ Use These First</h2>
          {expiringSoon.length === 0 ? (
            <div className="text-center py-8 text-emerald-600 font-semibold">
              All items are fresh! 🎉
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {expiringSoon.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-white/70 rounded-xl border border-white/60">
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.quantity} {item.unit} &middot; {item.location}</p>
                  </div>
                  <ExpiryBadge expiration={item.expiration} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="glass p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-3">📊 By Category</h2>
          <div className="space-y-2">
            {Object.entries(categories).map(([cat, count]) => (
              <div key={cat}>
                <div className="flex justify-between text-sm font-medium text-gray-700 mb-1">
                  <span>{CATEGORY_EMOJI[cat] || "📦"} {cat}</span>
                  <span>{count}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${CATEGORY_COLORS[cat] || "bg-gray-400"} transition-all duration-500`}
                    style={{ width: `${(count / total) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {Object.keys(categories).length === 0 && (
              <p className="text-gray-400 text-sm text-center py-4">No items yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="glass p-5">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <ActionButton emoji="📷" label="Scan Receipt"    onClick={() => setPage("scan")} />
          <ActionButton emoji="🍽️" label="Generate Meal Plan" onClick={() => setPage("mealplan")} />
          <ActionButton emoji="📦" label="View Inventory"  onClick={() => setPage("inventory")} />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, bg }) {
  return (
    <div className={`glass p-4 ${bg}`}>
      <p className="text-3xl font-extrabold tracking-tight text-gray-900">{value}</p>
      <p className={`text-sm font-semibold mt-1 ${color}`}>{label}</p>
    </div>
  );
}

function ActionButton({ emoji, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-5 py-2.5 bg-linear-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200 cursor-pointer"
    >
      <span>{emoji}</span>
      {label}
    </button>
  );
}
