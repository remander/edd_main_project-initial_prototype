import { useState } from "react";
import { KeyRound, ExternalLink } from "lucide-react";
import { saveOpenAiApiKey } from "../../lib/userProfile";

export default function ApiKeySetup({ userId, onKeySaved }) {
  const [key, setKey]       = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  const handleSave = async () => {
    if (!key.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await saveOpenAiApiKey(userId, key.trim());
      onKeySaved(key.trim());
    } catch {
      setError("Failed to save API key. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <div className="glass p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Set Up AI Meal Generator</h2>
            <p className="text-sm text-gray-500">One-time setup — your key is saved to your account</p>
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 space-y-2 text-sm text-gray-700">
          <p className="font-semibold text-emerald-800">Get your OpenAI API key:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>
              Go to{" "}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-600 underline inline-flex items-center gap-1"
              >
                platform.openai.com/api-keys <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li>Sign in or create an OpenAI account</li>
            <li>Add a payment method under <strong>Billing</strong> (pay-as-you-go)</li>
            <li>Click <strong>"Create new secret key"</strong> and copy it</li>
            <li>Paste it below</li>
          </ol>
          <p className="text-xs text-gray-500 pt-1">
            Each meal generation costs less than $0.001. Your key is stored securely
            in your account and never shared.
          </p>
        </div>

        <div className="space-y-3">
          <input
            type="password"
            placeholder="Paste your OpenAI API key here (sk-...)"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            onClick={handleSave}
            disabled={saving || !key.trim()}
            className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save API Key"}
          </button>
        </div>
      </div>
    </div>
  );
}
