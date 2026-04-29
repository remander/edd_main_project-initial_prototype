// Local receipt text parser — no API required.
// Designed for pasted OCR output. Returns items in the same shape as the Claude parser.

const SKIP_PATTERNS = [
  /total|subtotal|tax|balance|change|savings|discount|coupon|rewards|points/i,
  /cash|credit|debit|visa|mastercard|amex|discover|payment|tender/i,
  /thank\s*you|welcome|receipt|invoice|order|transaction|approval/i,
  /store|manager|cashier|operator|terminal|register/i,
  /phone|address|www\.|\.com|\.net|@/i,
  /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/,   // dates
  /^\(\d{3}\)\s*\d{3}[-\s]\d{4}/,           // phone numbers
  /^[*\-=#+]{2,}/,                           // separator lines
  /^[\d\s.,*#$%()-]{0,2}$/,                 // lines with no real text
];

const CATEGORY_MAP = {
  Produce: [
    'apple', 'banana', 'orange', 'grape', 'berry', 'berries', 'melon', 'mango',
    'peach', 'pear', 'plum', 'cherry', 'lettuce', 'spinach', 'kale', 'arugula',
    'broccoli', 'carrot', 'celery', 'cucumber', 'tomato', 'potato', 'onion',
    'garlic', 'pepper', 'mushroom', 'zucchini', 'squash', 'corn', 'avocado',
    'lemon', 'lime', 'grapefruit', 'strawberry', 'blueberry', 'raspberry',
    'herb', 'cilantro', 'parsley', 'basil', 'mint', 'ginger', 'beet', 'radish',
    'artichoke', 'asparagus', 'cauliflower', 'cabbage', 'leek', 'scallion',
    'pineapple', 'watermelon', 'cantaloupe', 'fig', 'date', 'produce', 'veggie',
    'vegetable', 'fruit',
  ],
  Dairy: [
    'milk', 'cheese', 'yogurt', 'butter', 'cream', 'egg', 'eggs', 'cottage',
    'sour cream', 'whipped', 'half and half', 'cheddar', 'mozzarella',
    'parmesan', 'brie', 'gouda', 'provolone', 'ricotta', 'kefir', 'ghee',
    'creamer', 'half & half',
  ],
  Meat: [
    'chicken', 'beef', 'pork', 'turkey', 'steak', 'ground', 'sausage', 'bacon',
    'ham', 'salami', 'pepperoni', 'lamb', 'veal', 'brisket', 'rib', 'wing',
    'breast', 'thigh', 'drumstick', 'roast', 'chop', 'tenderloin', 'sirloin',
    'chuck', 'loin', 'cutlet', 'meatball', 'hot dog', 'deli', 'bologna',
    'pastrami', 'prosciutto',
  ],
  Seafood: [
    'fish', 'salmon', 'tuna', 'shrimp', 'cod', 'tilapia', 'crab', 'lobster',
    'clam', 'oyster', 'scallop', 'halibut', 'mahi', 'trout', 'catfish', 'bass',
    'anchovy', 'sardine', 'squid', 'octopus', 'mussel', 'crawfish',
  ],
  Frozen: [
    'frozen', 'ice cream', 'gelato', 'sorbet', 'popsicle', 'pizza', 'nugget',
    'waffle', 'burrito', 'edamame', 'pot pie',
  ],
  Beverages: [
    'juice', 'water', 'soda', 'coffee', 'tea', 'lemonade', 'wine', 'beer',
    'ale', 'lager', 'cider', 'kombucha', 'smoothie', 'sports drink', 'gatorade',
    'powerade', 'energy drink', 'sparkling', 'coconut water', 'almond milk',
    'oat milk', 'soy milk',
  ],
  Pantry: [
    'bread', 'pasta', 'rice', 'flour', 'sugar', 'oil', 'vinegar', 'sauce',
    'soup', 'cereal', 'oat', 'oatmeal', 'cracker', 'chip', 'tortilla', 'wrap',
    'nut', 'peanut', 'almond', 'walnut', 'cashew', 'honey', 'syrup', 'jam',
    'jelly', 'ketchup', 'mustard', 'mayo', 'mayonnaise', 'dressing', 'spice',
    'salt', 'pepper', 'baking', 'vanilla', 'chocolate', 'cocoa', 'noodle',
    'lentil', 'bean', 'chickpea', 'canned', 'can of', 'jar of', 'box of',
    'ramen', 'quinoa', 'couscous', 'barley', 'granola', 'protein bar',
    'peanut butter', 'almond butter', 'tahini',
  ],
};

const CATEGORY_PRIORITY = ['Seafood', 'Meat', 'Dairy', 'Produce', 'Frozen', 'Beverages', 'Pantry'];

const UNIT_PATTERNS = [
  { re: /(\d+(?:\.\d+)?)\s*lbs?\b/i,   unit: 'lbs' },
  { re: /(\d+(?:\.\d+)?)\s*oz\b/i,     unit: 'oz' },
  { re: /(\d+(?:\.\d+)?)\s*gal\b/i,    unit: 'gal' },
  { re: /(\d+(?:\.\d+)?)\s*fl\s*oz\b/i,unit: 'oz' },
  { re: /(\d+(?:\.\d+)?)\s*l\b/i,      unit: 'count' },
  { re: /(\d+(?:\.\d+)?)\s*ml\b/i,     unit: 'count' },
  { re: /(\d+(?:\.\d+)?)\s*ct\b/i,     unit: 'count' },
  { re: /(\d+(?:\.\d+)?)\s*pk\b/i,     unit: 'count' },
  { re: /(\d+(?:\.\d+)?)\s*ea\b/i,     unit: 'count' },
  { re: /^(\d+)\s*x\s+/i,              unit: 'count' },
];

function guessCategory(name) {
  const lower = name.toLowerCase();
  for (const cat of CATEGORY_PRIORITY) {
    if (CATEGORY_MAP[cat].some((kw) => lower.includes(kw))) return cat;
  }
  return 'Other';
}

function extractQuantityAndUnit(raw) {
  let quantity = 1;
  let unit = 'count';

  for (const { re, unit: u } of UNIT_PATTERNS) {
    const m = raw.match(re);
    if (m) {
      quantity = parseFloat(m[1]);
      unit = u;
      break;
    }
  }

  return { quantity, unit };
}

function cleanName(line) {
  return line
    .replace(/\$[\d,.]+/g, '')          // strip prices like $4.99
    .replace(/\b\d+\.\d{2}\b/g, '')     // strip bare prices like 4.99
    .replace(/\b[A-Z0-9]{6,}\b/g, '')   // strip SKU-like codes
    .replace(/\s{2,}/g, ' ')            // collapse whitespace
    .replace(/[^a-zA-Z0-9%&'\- ]/g, ' ')
    .trim()
    // Title-case
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function shouldSkip(line) {
  if (line.length < 3) return true;
  if (!/[a-zA-Z]{2,}/.test(line)) return true;   // needs at least 2 letters
  return SKIP_PATTERNS.some((re) => re.test(line));
}

export function parseReceiptText(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const items = [];

  for (const line of lines) {
    if (shouldSkip(line)) continue;

    const { quantity, unit } = extractQuantityAndUnit(line);
    const name = cleanName(line);

    if (!name || name.length < 2) continue;

    items.push({
      id: `scan_${Date.now()}_${items.length}`,
      name,
      quantity,
      unit,
      category: guessCategory(name),
      location: 'Fridge',
      purchased: new Date().toISOString().split('T')[0],
      expiration: '',
    });
  }

  return items;
}
