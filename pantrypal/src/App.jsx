import { useState, useEffect } from "react";
import { auth, onAuthStateChanged, firebaseSignOut, saveUsageLog, subscribeToUserUsageLogs, clearUserUsageLogs, deleteUsageLog } from "./lib/firebase";
import { useInventory } from "./hooks/useInventory";
import { useToast } from "./hooks/useToast";
import Header from "./components/layout/Header";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import Toast from "./components/ui/Toast";
import Dashboard from "./components/features/Dashboard";
import ScanReceipt from "./components/features/ScanReceipt";
import Inventory from "./components/features/Inventory";
import MealPlan from "./components/features/MealPlan";
import InfoTab from "./components/features/InfoTab";
import LoginPage from "./components/features/LoginPage";

export default function App() {
  const [user, setUser]       = useState(undefined);
  const [page, setPage]       = useState("dashboard");
  const { inventory, addItems, updateItem, deleteItem } = useInventory(user?.uid);
  const { toasts, addToast }  = useToast();

  // Parse comma-separated admin emails from the env var; used to gate the admin tab
  const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS ?? "")
    .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

  // Load any previously saved meal plans from localStorage on first render
  const [mealPlans, setMealPlans] = useState(() => {
    try {
      const saved = localStorage.getItem("pantrypal_mealplans");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [usageLogs, setUsageLogs] = useState([]);

  // Track Firebase auth state: undefined = still resolving, null = signed out, object = signed in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser ?? null);
    });
    return unsubscribe;
  }, []);

  // Persist meal plans to localStorage whenever the list changes
  useEffect(() => {
    localStorage.setItem("pantrypal_mealplans", JSON.stringify(mealPlans));
  }, [mealPlans]);

  // Subscribe to this user's usage logs from Firestore
  useEffect(() => {
    if (!user) { setUsageLogs([]); return; }
    const unsub = subscribeToUserUsageLogs(user.uid, setUsageLogs);
    return unsub;
  }, [user?.uid]);

  // Appends an entry to local state and writes it to both user and global Firestore collections
  const addUsageLog = (entry) => {
    if (!user) return;
    const log = { ...entry, id: Date.now() + Math.random() };
    setUsageLogs((prev) => [log, ...prev]);
    saveUsageLog(user.uid, user.email ?? "", log).catch(console.error);
  };

  // Clears usage logs from local state and deletes the user's Firestore subcollection
  const clearLogs = () => {
    if (!user) return;
    setUsageLogs([]);
    clearUserUsageLogs(user.uid).catch(console.error);
  };

  // Removes a single log entry from local state and deletes it from both Firestore collections
  const deleteLog = (logId) => {
    if (!user) return;
    setUsageLogs((prev) => prev.filter((l) => String(l.id) !== String(logId)));
    deleteUsageLog(user.uid, logId).catch(console.error);
  };

  // True when the signed-in user's email is listed in VITE_ADMIN_EMAILS
  const isAdmin = ADMIN_EMAILS.includes((user?.email ?? "").toLowerCase());

  // Still resolving Firebase auth — show a spinner to avoid a flash of the login page
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center"
           style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 50%, #f0f9ff 100%)" }}>
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Not signed in — render the login/signup page
  if (!user) return <LoginPage />;

  const pageProps = { inventory, addItems, updateItem, deleteItem, addToast };

  return (
    <div className="min-h-screen flex flex-col">
      <Header inventory={inventory} user={user} onSignOut={firebaseSignOut} />
      <Navbar page={page} setPage={setPage} />
      <main className="flex-1">
        {page === "dashboard" && <Dashboard {...pageProps} setPage={setPage} />}
        {page === "scan"      && <ScanReceipt {...pageProps} addUsageLog={addUsageLog} />}
        {page === "inventory" && <Inventory {...pageProps} />}
        {page === "mealplan"  && (
          <MealPlan
            {...pageProps}
            user={user}
            mealPlans={mealPlans}
            setMealPlans={setMealPlans}
            addUsageLog={addUsageLog}
          />
        )}
        {page === "info" && (
          <InfoTab usageLogs={usageLogs} clearLogs={clearLogs} deleteLog={deleteLog} isAdmin={isAdmin} />
        )}
      </main>
      <Footer />
      <Toast toasts={toasts} />
    </div>
  );
}
