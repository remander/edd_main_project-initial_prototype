import { useState, useEffect } from "react";
import { estimateExpiration } from "../lib/expiration";
import { subscribeToInventory, saveInventoryItem, deleteInventoryItem } from "../lib/firebase";

export function useInventory(userId) {
  const [inventory, setInventory] = useState([]);

  useEffect(() => {
    if (!userId) {
      setInventory([]);
      return;
    }
    const unsubscribe = subscribeToInventory(userId, setInventory);
    return unsubscribe;
  }, [userId]);

  const addItems = async (items) => {
    const newItems = items.map((item, i) => ({
      ...item,
      id: String(Date.now() + i),
      purchased: item.purchased || new Date().toISOString().split("T")[0],
      expiration: item.expiration || estimateExpiration(item.name),
    }));
    await Promise.all(newItems.map((item) => saveInventoryItem(userId, item)));
  };

  const updateItem = async (id, updates) => {
    const item = inventory.find((i) => i.id === id);
    if (!item) return;
    await saveInventoryItem(userId, { ...item, ...updates });
  };

  const deleteItem = async (id) => {
    await deleteInventoryItem(userId, id);
  };

  return { inventory, addItems, updateItem, deleteItem };
}
