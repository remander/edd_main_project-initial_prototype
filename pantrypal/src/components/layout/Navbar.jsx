import { Home, ScanLine, Package, ChefHat } from "lucide-react";

const TABS = [
  { id: "dashboard", label: "Dashboard",    icon: Home },
  { id: "scan",      label: "Scan Receipt", icon: ScanLine },
  { id: "inventory", label: "Inventory",    icon: Package },
  { id: "mealplan",  label: "Meal Plan",    icon: ChefHat },
];

export default function Navbar({ page, setPage }) {
  return (
    <nav className="glass border-b border-white/60 sticky top-[57px] z-30">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex gap-1 py-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setPage(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                page === id
                  ? "nav-active"
                  : "text-gray-600 hover:bg-emerald-50 hover:text-emerald-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:block">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
