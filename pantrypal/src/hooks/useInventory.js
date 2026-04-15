import { useState, useEffect } from "react";
import { SAMPLE_INVENTORY } from "../lib/sampleData";
import { estimateExpiration } from "../lib/expiration";

export function useInventory() {
  const [inventory, setInventory] = useState(() => {
    try {
      const saved = localStorage.getItem("pantrypal_inventory");
      return saved ? JSON.parse(saved) : SAMPLE_INVENTORY;
    } catch {
      return SAMPLE_INVENTORY;
    }
  });

  useEffect(() => {
    localStorage.setItem("pantrypal_inventory", JSON.stringify(inventory));
  }, [inventory]);

  const addItems = (items) => {
    const newItems = items.map((item, i) => ({
      ...item,
      id: Date.now() + i,
      purchased: item.purchased || new Date().toISOString().split("T")[0],
      expiration: item.expiration || estimateExpiration(item.name),
    }));
    setInventory((prev) => [...prev, ...newItems]);
  };

  const updateItem = (id, updates) => {
    setInventory((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const deleteItem = (id) => {
    setInventory((prev) => prev.filter((item) => item.id !== id));
  };

  return { inventory, addItems, updateItem, deleteItem };
}
