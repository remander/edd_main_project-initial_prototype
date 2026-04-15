import { useState, useEffect } from "react";
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

export default function App() {
  const [page, setPage] = useState("dashboard");
  const { inventory, addItems, updateItem, deleteItem } = useInventory();
  const { toasts, addToast } = useToast();
  const [mealPlans, setMealPlans] = useState(() => {
    try {
      const saved = localStorage.getItem("pantrypal_mealplans");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("pantrypal_mealplans", JSON.stringify(mealPlans));
  }, [mealPlans]);

  const pageProps = { inventory, addItems, updateItem, deleteItem, addToast };

  return (
    <div className="min-h-screen flex flex-col">
      <Header inventory={inventory} />
      <Navbar page={page} setPage={setPage} />

      <main className="flex-1">
        {page === "dashboard" && (
          <Dashboard {...pageProps} setPage={setPage} />
        )}
        {page === "scan" && (
          <ScanReceipt {...pageProps} />
        )}
        {page === "inventory" && (
          <Inventory {...pageProps} />
        )}
        {page === "mealplan" && (
          <MealPlan {...pageProps} mealPlans={mealPlans} setMealPlans={setMealPlans} />
        )}
      </main>

      <Footer />
      <Toast toasts={toasts} />
    </div>
  );
}
