import { useState } from "react";

// Simple demo credentials — change these as needed
const DEMO_USERS = [
  { username: "admin", password: "pantry123" },
  { username: "demo",  password: "demo" },
];

export default function LoginPage({ onLogin }) {
  const [tab, setTab] = useState("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  const handleSignIn = (e) => {
    e.preventDefault();
    setError("");
    const stored = JSON.parse(localStorage.getItem("pantrypal_users") || "[]");
    const all = [...DEMO_USERS, ...stored];
    const match = all.find((u) => u.username === username && u.password === password);
    if (match) {
      localStorage.setItem("pantrypal_session", username);
      onLogin(username);
    } else {
      setError("Invalid username or password.");
    }
  };

  const handleSignUp = (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 6)  { setError("Password must be at least 6 characters."); return; }
    const stored = JSON.parse(localStorage.getItem("pantrypal_users") || "[]");
    const all = [...DEMO_USERS, ...stored];
    if (all.find((u) => u.username === username)) { setError("Username already taken."); return; }
    const updated = [...stored, { username, password }];
    localStorage.setItem("pantrypal_users", JSON.stringify(updated));
    localStorage.setItem("pantrypal_session", username);
    onLogin(username);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-8 px-4"
      style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 50%, #f0f9ff 100%)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3">
        <span className="text-6xl">🥗</span>
        <div className="text-left">
          <h1 className="text-4xl font-extrabold tracking-tight leading-none"
              style={{ background: "linear-gradient(to right, #059669, #0891b2)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            PantryPal
          </h1>
          <p className="text-sm text-gray-500 font-medium mt-1">Smart Kitchen Assistant</p>
        </div>
      </div>

      {/* Card */}
      <div className="glass p-8 w-full max-w-sm space-y-5">
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
          {["signin", "signup"].map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(""); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === t ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "signin" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        <form onSubmit={tab === "signin" ? handleSignIn : handleSignUp} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Username</label>
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your username"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Password</label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
          {tab === "signup" && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Confirm Password</label>
              <input
                required
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 font-medium bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full py-3 text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity shadow-md"
            style={{ background: "linear-gradient(to right, #10b981, #059669)" }}
          >
            {tab === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        {tab === "signin" && (
          <p className="text-xs text-center text-gray-400">
            Demo: <span className="font-mono font-semibold text-gray-500">demo / demo</span>
          </p>
        )}
      </div>

      <p className="text-xs text-gray-400">Reducing household food waste one meal at a time 🌱</p>
    </div>
  );
}
