import { useState, useEffect } from "react";
import { auth, onAuthStateChanged, firebaseSignOut } from "./lib/firebase";
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
import LoginPage from "./components/features/LoginPage";

export default function App() {
  const [user, setUser]       = useState(undefined); // undefined = still loading
  const [page, setPage]       = useState("dashboard");
  const { inventory, addItems, updateItem, deleteItem } = useInventory(user?.uid);
  const { toasts, addToast }  = useToast();
  const [mealPlans, setMealPlans] = useState(() => {
    try {
      const saved = localStorage.getItem("pantrypal_mealplans");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser ?? null);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    localStorage.setItem("pantrypal_mealplans", JSON.stringify(mealPlans));
  }, [mealPlans]);

  // Still resolving auth state
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center"
           style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 50%, #f0f9ff 100%)" }}>
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <LoginPage />;

  const pageProps = { inventory, addItems, updateItem, deleteItem, addToast };

  return (
    <div className="min-h-screen flex flex-col">
      <Header inventory={inventory} user={user} onSignOut={firebaseSignOut} />
      <Navbar page={page} setPage={setPage} />
      <main className="flex-1">
        {page === "dashboard" && <Dashboard {...pageProps} setPage={setPage} />}
        {page === "scan"      && <ScanReceipt {...pageProps} />}
        {page === "inventory" && <Inventory {...pageProps} />}
        {page === "mealplan"  && <MealPlan {...pageProps} user={user} mealPlans={mealPlans} setMealPlans={setMealPlans} />}
      </main>
      <Footer />
      <Toast toasts={toasts} />
    </div>
  );
}
