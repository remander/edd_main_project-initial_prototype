export const SHELF_LIFE_DAYS = {
  // Produce
  apple: 30, banana: 7, orange: 21, lemon: 21, lime: 14, grape: 7,
  strawberry: 5, blueberry: 7, mango: 7, pineapple: 5, avocado: 4,
  tomato: 7, potato: 30, "sweet potato": 30, onion: 30, garlic: 60,
  carrot: 21, celery: 14, broccoli: 7, spinach: 7, lettuce: 7,
  kale: 7, cucumber: 7, pepper: 14, mushroom: 7, corn: 3,
  // Dairy
  milk: 10, cheese: 21, "cream cheese": 14, butter: 60, yogurt: 14,
  "greek yogurt": 14, egg: 35, eggs: 35, cream: 7, "sour cream": 21,
  // Meat & Seafood
  chicken: 3, beef: 3, "ground beef": 2, pork: 3, fish: 2,
  salmon: 2, shrimp: 2, turkey: 3, bacon: 7, ham: 7,
  // Bread & Bakery
  bread: 7, bagel: 7, tortilla: 14, muffin: 5,
  // Pantry (long shelf life)
  pasta: 730, rice: 730, flour: 365, sugar: 730, salt: 1825,
  oil: 365, "olive oil": 365, cereal: 180, oatmeal: 180,
  coffee: 180, tea: 365, honey: 1825, "peanut butter": 180,
  jam: 365, sauce: 180, ketchup: 180, mayo: 180, mustard: 365,
  vinegar: 1825, "soy sauce": 365, soup: 730, beans: 730,
  lentils: 730, tuna: 730,
  // Frozen
  "ice cream": 60, "frozen pizza": 180, "frozen vegetables": 365,
};

export function estimateExpiration(itemName) {
  const lower = itemName.toLowerCase();
  for (const [keyword, days] of Object.entries(SHELF_LIFE_DAYS)) {
    if (lower.includes(keyword)) {
      const date = new Date();
      date.setDate(date.getDate() + days);
      return date.toISOString().split("T")[0];
    }
  }
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return date.toISOString().split("T")[0];
}

export function daysUntilExpiry(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(dateStr);
  return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
}

export function expiryStatus(days) {
  if (days < 0) return "expired";
  if (days <= 3) return "critical";
  if (days <= 7) return "warning";
  return "good";
}
