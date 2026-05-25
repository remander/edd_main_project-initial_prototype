import { useState, useCallback } from "react";

// Manages a timed list of toast notifications; each toast auto-removes itself after 4 seconds
export function useToast() {
  const [toasts, setToasts] = useState([]);

  // Appends a new toast and schedules its removal after 4 seconds
  const addToast = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return { toasts, addToast };
}
