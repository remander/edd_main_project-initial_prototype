export default function Toast({ toasts }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`
            flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border backdrop-blur-sm animate-in
            ${t.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
              t.type === "error"   ? "bg-red-50 border-red-200 text-red-800" :
                                     "bg-amber-50 border-amber-200 text-amber-800"}
          `}
        >
          {t.type === "success" ? "✅" : t.type === "error" ? "❌" : "⚠️"}
          {t.message}
        </div>
      ))}
    </div>
  );
}
