# PantryPal — Project Structure & React Architecture

---

## File Structure

```
pantrypal/src/
├── main.jsx                        # React entry point — mounts <App /> into the DOM
├── App.jsx                         # Root component — owns auth, inventory, usage logs, page routing
│
├── lib/                            # Pure logic, no JSX
│   ├── claude.js                   # Claude API wrapper (proxy calls + prompt builder)
│   ├── firebase.js                 # All Firestore and Firebase Auth helpers
│   ├── userProfile.js              # User-specific Firestore ops (API key, saved meals)
│   ├── expiration.js               # Shelf-life lookup, days-until-expiry, status labels
│   ├── receiptParser.js            # Local text parser for pasted receipt content (no AI)
│   ├── sampleData.js               # Static constants: CATEGORIES, UNITS, LOCATIONS, DIETARY
│   └── gemini.js                   # Legacy OpenAI wrapper (not currently active)
│
├── hooks/                          # Reusable state logic shared across components
│   ├── useInventory.js             # Firestore-synced inventory + CRUD operations
│   └── useToast.js                 # Timed notification queue
│
└── components/
    ├── layout/                     # Structural chrome — rendered unconditionally once logged in
    │   ├── Header.jsx              # Sticky top bar: logo, item count, bell badge, sign out
    │   ├── Navbar.jsx              # Tab bar for page navigation (Dashboard, Scan, Inventory, etc.)
    │   └── Footer.jsx              # Static copyright footer
    │
    ├── features/                   # Full page views — swapped in/out by App.jsx based on `page` state
    │   ├── LoginPage.jsx           # Sign-in / sign-up form using Firebase Auth
    │   ├── Dashboard.jsx           # Overview: expiring items, category breakdown, quick actions
    │   ├── ScanReceipt.jsx         # Receipt image/text scanning with Claude + inline item review
    │   ├── Inventory.jsx           # Filterable, sortable item grid with add/edit/delete
    │   ├── ItemCard.jsx            # Single inventory item display card
    │   ├── ItemEditModal.jsx       # Add/edit item form inside a modal overlay
    │   ├── MealPlan.jsx            # Multi-day plan generator + saved plans list (tabbed)
    │   ├── MealGenerator.jsx       # Single-recipe generator with preference controls
    │   ├── MealCard.jsx            # Displays a generated recipe with save-to-account button
    │   ├── InfoTab.jsx             # Usage stats, cost tracking, admin export — "Usage" tab
    │   └── ApiKeySetup.jsx         # One-time OpenAI API key setup form (legacy)
    │
    └── ui/                         # Reusable micro-components
        ├── ExpiryBadge.jsx         # Coloured pill showing days remaining / expired
        ├── LoadingSpinner.jsx      # Spinning indicator with a message string
        ├── Modal.jsx               # Generic backdrop + dialog container
        └── Toast.jsx               # Fixed-position notification stack
```

---

## How the React Structure Works When You Run the App

### 1. Entry Point

`main.jsx` calls `ReactDOM.createRoot().render(<App />)`. Every component in the app descends from here.

---

### 2. Auth Gate

`App.jsx` immediately starts listening to Firebase via `onAuthStateChanged`. The `user` state has three possible values:

| Value | Meaning | What renders |
|---|---|---|
| `undefined` | Firebase still resolving | Fullscreen spinner |
| `null` | Not signed in | `<LoginPage />` |
| object | Signed in | Full app shell |

---

### 3. App Shell (once logged in)

```
<Header />        ← always visible — logo, item count, bell badge, sign out button
<Navbar />        ← always visible — sets the `page` state on click
<main>            ← swaps the active page component
<Footer />        ← always visible — static copyright bar
<Toast />         ← fixed overlay — driven by useToast()
```

---

### 4. Page Switching

There is **no router**. `Navbar` calls `setPage()` in `App.jsx`, which stores a string like `"dashboard"` or `"scan"`. The `<main>` block uses a series of conditional renders:

```jsx
{page === "dashboard" && <Dashboard ... />}
{page === "scan"      && <ScanReceipt ... />}
{page === "inventory" && <Inventory ... />}
{page === "mealplan"  && <MealPlan ... />}
{page === "info"      && <InfoTab ... />}
```

Only one page component is mounted at a time.

---

### 5. Data Flow

`App.jsx` is the **single source of truth** for shared state:

| State | Hook / Source | Passed to |
|---|---|---|
| `inventory` | `useInventory(user.uid)` | All feature pages |
| `usageLogs` | Firestore `onSnapshot` | `InfoTab` |
| `mealPlans` | `localStorage` + `useState` | `MealPlan` |
| `toasts` | `useToast()` | `Toast` overlay |

Child components **never write to Firestore directly**. They call handler functions passed down as props (`addItems`, `updateItem`, `deleteItem`, `addUsageLog`), which live in `App.jsx` and perform the actual writes.

---

### 6. Real-Time Sync

`useInventory` and the usage log `useEffect` in `App.jsx` both hold open Firestore `onSnapshot` listeners for the duration of the session. When any client writes a document, every open session receives the update instantly — no polling or page refresh required.

---

### 7. Claude API Flow

All AI calls go through the Vite dev server proxy rather than hitting the Anthropic API directly from the browser:

```
Component (fetch /api/claude or /api/claude-vision)
    ↓
vite.config.js plugin (spawns Claude CLI subprocess)
    ↓
Claude CLI (uses your subscription)
    ↓
Returns { text, usage } back to the component
```

Usage data (tokens, cost, duration) is then passed to `addUsageLog` in `App.jsx`, which writes it to both the user's private Firestore subcollection and the shared `globalUsageLogs` collection for admin viewing.
