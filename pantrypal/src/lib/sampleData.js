import { estimateExpiration } from "./expiration";

const today = new Date().toISOString().split("T")[0];

export const SAMPLE_INVENTORY = [
  { id: 1,  name: "Chicken Breast",   category: "Meat",     quantity: 2,  unit: "lbs",    location: "Fridge",  purchased: today, expiration: estimateExpiration("chicken") },
  { id: 2,  name: "Whole Milk",       category: "Dairy",    quantity: 1,  unit: "gal",    location: "Fridge",  purchased: today, expiration: estimateExpiration("milk") },
  { id: 3,  name: "Greek Yogurt",     category: "Dairy",    quantity: 4,  unit: "cups",   location: "Fridge",  purchased: today, expiration: estimateExpiration("yogurt") },
  { id: 4,  name: "Cheddar Cheese",   category: "Dairy",    quantity: 8,  unit: "oz",     location: "Fridge",  purchased: today, expiration: estimateExpiration("cheese") },
  { id: 5,  name: "Eggs",             category: "Dairy",    quantity: 12, unit: "count",  location: "Fridge",  purchased: today, expiration: estimateExpiration("eggs") },
  { id: 6,  name: "Broccoli",         category: "Produce",  quantity: 1,  unit: "head",   location: "Fridge",  purchased: today, expiration: estimateExpiration("broccoli") },
  { id: 7,  name: "Spinach",          category: "Produce",  quantity: 5,  unit: "oz",     location: "Fridge",  purchased: today, expiration: estimateExpiration("spinach") },
  { id: 8,  name: "Pasta",            category: "Pantry",   quantity: 16, unit: "oz",     location: "Pantry",  purchased: today, expiration: estimateExpiration("pasta") },
  { id: 9,  name: "Olive Oil",        category: "Pantry",   quantity: 1,  unit: "bottle", location: "Pantry",  purchased: today, expiration: estimateExpiration("olive oil") },
  { id: 10, name: "Rice",             category: "Pantry",   quantity: 2,  unit: "lbs",    location: "Pantry",  purchased: today, expiration: estimateExpiration("rice") },
  { id: 11, name: "Garlic",           category: "Produce",  quantity: 3,  unit: "cloves", location: "Pantry",  purchased: today, expiration: estimateExpiration("garlic") },
  { id: 12, name: "Onion",            category: "Produce",  quantity: 2,  unit: "count",  location: "Pantry",  purchased: today, expiration: estimateExpiration("onion") },
  { id: 13, name: "Salmon",           category: "Seafood",  quantity: 1,  unit: "lbs",    location: "Fridge",  purchased: today, expiration: estimateExpiration("salmon") },
  { id: 14, name: "Butter",           category: "Dairy",    quantity: 1,  unit: "stick",  location: "Fridge",  purchased: today, expiration: estimateExpiration("butter") },
  { id: 15, name: "Lemon",            category: "Produce",  quantity: 3,  unit: "count",  location: "Fridge",  purchased: today, expiration: estimateExpiration("lemon") },
];

export const CATEGORIES = ["Produce", "Dairy", "Meat", "Seafood", "Pantry", "Frozen", "Beverages", "Other"];
export const LOCATIONS  = ["Fridge", "Freezer", "Pantry", "Counter"];
export const UNITS      = ["count", "lbs", "oz", "gal", "cups", "bottle", "head", "cloves", "bag", "box", "can", "jar", "bunch", "stick"];
export const DIETARY    = ["Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free", "Low-Carb", "Nut-Free"];

export const CATEGORY_EMOJI = {
  Produce: "🥦", Dairy: "🥛", Meat: "🥩", Seafood: "🐟",
  Pantry: "🥫", Frozen: "🧊", Beverages: "🧃", Other: "📦",
};
