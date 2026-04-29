import { useState } from "react";
import { firebaseSignIn, firebaseSignUp } from "../../lib/firebase";

export default function LoginPage() {
  const [tab, setTab]           = useState("signin");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const friendlyError = (code) => {
    switch (code) {
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential": return "Invalid email or password.";
      case "auth/email-already-in-use":                return "An account with this email already exists.";
      case "auth/weak-password":                       return "Password must be at least 6 characters.";
      case "auth/invalid-email":                       return "Please enter a valid email address.";
      default:                                         return "Something went wrong. Please try again.";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (tab === "signup" && password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      if (tab === "signin") {
        await firebaseSignIn(email, password);
      } else {
        await firebaseSignUp(email, password);
      }
      // App.jsx onAuthStateChanged will handle the redirect
    } catch (err) {
      console.error("Firebase auth error:", err.code, err.message);
      setError(friendlyError(err.code) + ` (${err.code})`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-8 px-4"
      style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 50%, #f0f9ff 100%)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-1">
        <img src=".\src\assets\logo.svg" alt="PantryPal Logo" className="w-auto h-18 object-fill"/>
        <div className="text-left">
          <h1
            className="text-4xl font-extrabold tracking-tight leading-none"
            style={{ background: "linear-gradient(to right, #059669, #0891b2)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
          >
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
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                tab === t ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "signin" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
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
            disabled={loading}
            className="w-full py-3 text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity shadow-md disabled:opacity-50 cursor-pointer"
            style={{ background: "linear-gradient(to right, #10b981, #059669)" }}
          >
            {loading ? "Please wait..." : tab === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>

      <p className="text-xs text-gray-400">Reducing household food waste one meal at a time 🌱</p>
    </div>
  );
}
