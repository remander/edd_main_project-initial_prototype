import { useState } from "react";
import { daysUntilExpiry } from "../../lib/expiration";
import { CATEGORIES, LOCATIONS } from "../../lib/sampleData";
import ItemCard from "./ItemCard";
import ItemEditModal from "./ItemEditModal";

export default function Inventory({ inventory, addItems, updateItem, deleteItem, addToast }) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [locationFilter, setLocationFilter] = useState("All");
  const [sortBy, setSortBy] = useState("Expiration Date");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [dismissedAlert, setDismissedAlert] = useState(false);

  const critical = inventory.filter((item) => {
    const d = daysUntilExpiry(item.expiration);
    return d >= 0 && d <= 3;
  });

  const filtered = inventory
    .filter((item) => {
      const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === "All" || item.category === categoryFilter;
      const matchLoc = locationFilter === "All" || item.location === locationFilter;
      return matchSearch && matchCat && matchLoc;
    })
    .sort((a, b) => {
      if (sortBy === "Name") return a.name.localeCompare(b.name);
      if (sortBy === "Expiration Date") return new Date(a.expiration) - new Date(b.expiration);
      if (sortBy === "Category") return a.category.localeCompare(b.category);
      if (sortBy === "Date Added") return b.id - a.id;
      return 0;
    });

  const openAdd = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleSave = (form) => {
    if (editingItem) {
      updateItem(editingItem.id, form);
      addToast(`Updated "${form.name}"`, "success");
    } else {
      addItems([form]);
      addToast(`Added "${form.name}" to inventory!`, "success");
    }
  };

  const handleDelete = (id) => {
    const item = inventory.find((i) => i.id === id);
    if (!window.confirm(`Delete "${item?.name}"?`)) return;
    deleteItem(id);
    addToast(`Removed "${item?.name}"`, "info");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      {/* Critical alert */}
      {critical.length > 0 && !dismissedAlert && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-800">
          <span className="text-sm font-semibold">
            ⚠️ {critical.length} item{critical.length > 1 ? "s" : ""} expire{critical.length === 1 ? "s" : ""} within 3 days! Review them below.
          </span>
          <button
            onClick={() => setDismissedAlert(true)}
            className="text-amber-600 hover:text-amber-800 text-sm font-bold ml-4 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="glass p-4">
        <div className="flex flex-wrap gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search items..."
            className="flex-1 min-w-40 px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white cursor-pointer"
          >
            <option>All</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white cursor-pointer"
          >
            <option>All</option>
            {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white cursor-pointer"
          >
            {["Name", "Expiration Date", "Category", "Date Added"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={openAdd}
            className="px-5 py-2 bg-linear-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity whitespace-nowrap cursor-pointer"
          >
            ➕ Add Item
          </button>
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="glass p-12 text-center text-gray-400">
          <p className="text-4xl mb-3">📦</p>
          <p className="font-semibold">No items found</p>
          <p className="text-sm mt-1">Try adjusting your filters or add a new item.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <ItemEditModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        item={editingItem}
        onSave={handleSave}
      />
    </div>
  );
}
