import { useState, useEffect } from "react";
import { estimateExpiration } from "../lib/expiration";
import { subscribeToInventory, saveInventoryItem, deleteInventoryItem } from "../lib/firebase";

// Custom hook that syncs inventory state with Firestore in real time and exposes CRUD helpers
export function useInventory(userId) {
  const [inventory, setInventory] = useState([]);

  // Subscribe to the user's Firestore inventory; clears local state when signed out
  useEffect(() => {
    if (!userId) {
      setInventory([]);
      return;
    }
    const unsubscribe = subscribeToInventory(userId, setInventory);
    return unsubscribe;
  }, [userId]);

  // Assigns IDs and purchase/expiry dates to new items, then writes them all to Firestore in parallel
  const addItems = async (items) => {
    const newItems = items.map((item, i) => ({
      ...item,
      id: String(Date.now() + i),
      purchased: item.purchased || new Date().toISOString().split("T")[0],
      expiration: item.expiration || estimateExpiration(item.name),
    }));
    await Promise.all(newItems.map((item) => saveInventoryItem(userId, item)));
  };

  // Merges partial updates into an existing item and overwrites the Firestore document
  const updateItem = async (id, updates) => {
    const item = inventory.find((i) => i.id === id);
    if (!item) return;
    await saveInventoryItem(userId, { ...item, ...updates });
  };

  // Removes an item from Firestore; the real-time listener will update local state automatically
  const deleteItem = async (id) => {
    await deleteInventoryItem(userId, id);
  };

  return { inventory, addItems, updateItem, deleteItem };
}
