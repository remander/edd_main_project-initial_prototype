import { Bell } from "lucide-react";
import { daysUntilExpiry } from "../../lib/expiration";

export default function Header({ inventory, user, onSignOut }) {
  const criticalCount = inventory.filter(
    (item) => daysUntilExpiry(item.expiration) <= 3
  ).length;

  return (
    <header className="sticky top-0 z-40 glass border-b border-white/60">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🥗</span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent leading-none">
              PantryPal
            </h1>
            <p className="text-xs text-gray-500 font-medium">Smart Kitchen Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 font-medium hidden sm:block">
            {inventory.length} items
          </span>
          <div className="relative">
            <Bell className="w-6 h-6 text-gray-500" />
            {criticalCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {criticalCount}
              </span>
            )}
          </div>
          <span className="text-sm font-semibold text-gray-700 hidden sm:block">👤 {user?.email}</span>
          <button
            onClick={onSignOut}
            className="px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
