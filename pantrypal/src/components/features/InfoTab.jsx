import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { subscribeToAllUsageLogs } from "../../lib/firebase";

const TASK_META = {
  'recipe-generation': { label: 'Recipe Generator', color: 'emerald', emoji: '🍽️' },
  'meal-planning':     { label: 'Meal Planning',     color: 'cyan',    emoji: '📅' },
  'receipt-scan':      { label: 'Receipt Scan',      color: 'violet',  emoji: '🧾' },
};

function fmt$( n) { return n == null ? '—' : `$${Number(n).toFixed(4)}`; }
function fmtMs(n) { return n == null ? '—' : n < 1000 ? `${n}ms` : `${(n / 1000).toFixed(1)}s`; }
function fmtK( n) { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n); }
function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
         ' · ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function StatCard({ label, value, sub, accent = 'emerald' }) {
  const colors = {
    emerald: 'from-emerald-50 to-emerald-100/60 border-emerald-200 text-emerald-700',
    cyan:    'from-cyan-50 to-cyan-100/60 border-cyan-200 text-cyan-700',
    amber:   'from-amber-50 to-amber-100/60 border-amber-200 text-amber-700',
    violet:  'from-violet-50 to-violet-100/60 border-violet-200 text-violet-700',
  };
  return (
    <div className={`bg-gradient-to-br ${colors[accent]} border rounded-2xl p-4`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs mt-0.5 opacity-60">{sub}</p>}
    </div>
  );
}

function TaskBreakdown({ logs }) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {Object.entries(TASK_META).map(([task, meta]) => {
        const subset = logs.filter((l) => l.task === task);
        if (subset.length === 0) return null;

        const totalCost         = subset.reduce((s, l) => s + (l.costUSD          ?? 0), 0);
        const totalIn           = subset.reduce((s, l) => s + (l.inputTokens       ?? 0), 0);
        const totalOut          = subset.reduce((s, l) => s + (l.outputTokens      ?? 0), 0);
        const totalCacheR       = subset.reduce((s, l) => s + (l.cacheReadTokens   ?? 0), 0);
        const totalCacheW       = subset.reduce((s, l) => s + (l.cacheWriteTokens  ?? 0), 0);
        const avgDuration       = subset.reduce((s, l) => s + (l.durationMs        ?? 0), 0) / subset.length;
        const avgClientDuration = subset.reduce((s, l) => s + (l.clientDurationMs  ?? 0), 0) / subset.length;

        const colorMap = {
          emerald: { border: 'border-emerald-200 bg-emerald-50/50', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
          cyan:    { border: 'border-cyan-200 bg-cyan-50/50',       text: 'text-cyan-700',    badge: 'bg-cyan-100 text-cyan-700'    },
          violet:  { border: 'border-violet-200 bg-violet-50/50',   text: 'text-violet-700',  badge: 'bg-violet-100 text-violet-700' },
        };
        const c = colorMap[meta.color] ?? colorMap.violet;

        return (
          <div key={task} className={`border rounded-2xl p-5 space-y-3 ${c.border}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{meta.emoji}</span>
                <span className={`font-bold text-sm ${c.text}`}>{meta.label}</span>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.badge}`}>
                {subset.length} call{subset.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><p className="text-gray-500 font-medium">Total Cost</p><p className="font-bold text-gray-800">{fmt$(totalCost)}</p></div>
              <div><p className="text-gray-500 font-medium">Avg Total Time</p><p className="font-bold text-gray-800">{fmtMs(avgClientDuration)}</p></div>
              <div><p className="text-gray-500 font-medium">Avg API Time</p><p className="font-bold text-gray-800">{fmtMs(avgDuration)}</p></div>
              <div><p className="text-gray-500 font-medium">Input Tokens</p><p className="font-bold text-gray-800">{fmtK(totalIn)}</p></div>
              <div><p className="text-gray-500 font-medium">Output Tokens</p><p className="font-bold text-gray-800">{fmtK(totalOut)}</p></div>
              {totalCacheR > 0 && <div><p className="text-gray-500 font-medium">Cache Hits</p><p className="font-bold text-amber-600">{fmtK(totalCacheR)} saved</p></div>}
              {totalCacheW > 0 && <div><p className="text-gray-500 font-medium">Cache Written</p><p className="font-bold text-gray-800">{fmtK(totalCacheW)}</p></div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LogEntry({ entry, showUser = false }) {
  const meta = TASK_META[entry.task] ?? { emoji: '🤖', label: entry.task, color: 'violet' };
  const badgeBg = meta.color === 'emerald'
    ? 'bg-emerald-100 text-emerald-700'
    : meta.color === 'cyan'
    ? 'bg-cyan-100 text-cyan-700'
    : 'bg-violet-100 text-violet-700';

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <span className="text-lg shrink-0 mt-0.5">{meta.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeBg}`}>{meta.label}</span>
          {(entry.cacheReadTokens ?? 0) > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">⚡ cache hit</span>
          )}
          {showUser && entry.userEmail && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium truncate max-w-[160px]">
              {entry.userEmail}
            </span>
          )}
          <span className="text-xs text-gray-400">{fmtTime(entry.timestamp)}</span>
        </div>
        <p className="text-sm font-semibold text-gray-800 truncate">{entry.description}</p>
        <div className="flex gap-3 mt-1 text-xs text-gray-500 flex-wrap">
          <span>{fmtK(entry.inputTokens ?? 0)} in · {fmtK(entry.outputTokens ?? 0)} out</span>
          {entry.cacheReadTokens > 0 && <span className="text-amber-600">{fmtK(entry.cacheReadTokens)} cached</span>}
          {entry.clientDurationMs != null && (
            <span title="Total wall-clock time from button click to results">⏱ {fmtMs(entry.clientDurationMs)} total</span>
          )}
          {entry.durationMs != null && (
            <span className="text-gray-400" title="Time spent inside the AI model">({fmtMs(entry.durationMs)} API)</span>
          )}
          <span className="font-semibold text-gray-700">{fmt$(entry.costUSD)}</span>
        </div>
      </div>
    </div>
  );
}

function UsagePanel({ logs, onClear, showUser = false }) {
  if (logs.length === 0) {
    return (
      <div className="glass p-12 text-center text-gray-400">
        <p className="text-5xl mb-4">📊</p>
        <p className="font-semibold text-lg text-gray-600">No usage recorded yet</p>
        <p className="text-sm mt-1">Scan a receipt or generate a meal plan to see stats here.</p>
      </div>
    );
  }

  const totalCost   = logs.reduce((s, l) => s + (l.costUSD           ?? 0), 0);
  const totalIn     = logs.reduce((s, l) => s + (l.inputTokens       ?? 0), 0);
  const totalOut    = logs.reduce((s, l) => s + (l.outputTokens      ?? 0), 0);
  const totalCacheR = logs.reduce((s, l) => s + (l.cacheReadTokens   ?? 0), 0);
  const totalCacheW = logs.reduce((s, l) => s + (l.cacheWriteTokens  ?? 0), 0);
  const totalTokens = totalIn + totalOut;
  const cacheRate   = totalCacheW + totalIn > 0 ? Math.round((totalCacheR / (totalCacheW + totalIn)) * 100) : 0;
  const timedLogs   = logs.filter((l) => l.clientDurationMs != null);
  const avgTotalMs  = timedLogs.length > 0 ? timedLogs.reduce((s, l) => s + l.clientDurationMs, 0) / timedLogs.length : null;
  const sorted      = [...logs].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Cost"   value={fmt$(totalCost)}      sub={`${logs.length} calls`}                       accent="emerald" />
        <StatCard label="Total Tokens" value={fmtK(totalTokens)}    sub={`${fmtK(totalIn)} in · ${fmtK(totalOut)} out`} accent="violet" />
        <StatCard label="Avg Response" value={avgTotalMs != null ? fmtMs(avgTotalMs) : '—'} sub="wall-clock · button to results" accent="cyan" />
        <StatCard label="Cache Hits"   value={fmtK(totalCacheR)}    sub={`${cacheRate}% hit rate`}                     accent="amber" />
      </div>

      {totalCacheR > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-800">
          <strong>⚡ Cache savings:</strong> {fmtK(totalCacheR)} tokens served from cache, reducing cost and latency on repeated calls.
        </div>
      )}

      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">By Task</h3>
        <TaskBreakdown logs={logs} />
      </div>

      <div className="glass p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Activity Log</h3>
          {onClear && (
            <button
              onClick={onClear}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 border border-gray-200 rounded-xl transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear my logs
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-3">Most recent first</p>
        <div>
          {sorted.map((entry) => <LogEntry key={entry.id} entry={entry} showUser={showUser} />)}
        </div>
      </div>
    </div>
  );
}

function exportCSV(logs) {
  const headers = [
    'Timestamp', 'Date', 'Time', 'User Email', 'User ID', 'Task',
    'API Time (ms)', 'Total Time (ms)', 'Cost (USD)',
    'Input Tokens', 'Output Tokens', 'Cache Read Tokens', 'Cache Write Tokens',
    'Items Extracted', 'Items Added', 'Accuracy (%)',
    'Description',
  ];

  const rows = [...logs].sort((a, b) => a.timestamp - b.timestamp).map(l => {
    const d = new Date(l.timestamp);
    const date = d.toLocaleDateString();
    const time = d.toLocaleTimeString();

    let itemsExtracted = l.itemsExtracted ?? '';
    let itemsAdded     = l.itemsAdded     ?? '';
    let accuracy       = '';

    if (l.task === 'receipt-scan' && itemsExtracted === '') {
      const m = l.description?.match(/^(\d+) items extracted/);
      if (m) itemsExtracted = parseInt(m[1], 10);
    }
    if (itemsExtracted !== '' && itemsAdded !== '') {
      accuracy = itemsExtracted > 0 ? Math.round((itemsAdded / itemsExtracted) * 100) : 100;
    }

    return [
      l.timestamp ?? '',
      date,
      time,
      l.userEmail  ?? '',
      l.userId     ?? '',
      l.task       ?? '',
      l.durationMs       ?? '',
      l.clientDurationMs ?? '',
      l.costUSD != null ? Number(l.costUSD).toFixed(6) : '',
      l.inputTokens      ?? '',
      l.outputTokens     ?? '',
      l.cacheReadTokens  ?? '',
      l.cacheWriteTokens ?? '',
      itemsExtracted,
      itemsAdded,
      accuracy,
      `"${(l.description ?? '').replace(/"/g, '""')}"`,
    ].join(',');
  });

  const csv  = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `pantrypal-usage-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function InfoTab({ usageLogs, clearLogs, isAdmin }) {
  const [activeTab, setActiveTab] = useState("mine");
  const [allLogs, setAllLogs]     = useState([]);

  useEffect(() => {
    if (!isAdmin) return;
    const unsub = subscribeToAllUsageLogs(setAllLogs);
    return unsub;
  }, [isAdmin]);

  const tabs = [
    { id: "mine",  label: "My Usage" },
    ...(isAdmin ? [{ id: "admin", label: "Admin — All Users" }] : []),
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">📊 Usage & Cost</h2>
        <p className="text-sm text-gray-500 mt-0.5">Powered by Claude · synced to your account</p>
      </div>

      {tabs.length > 1 && (
        <div className="flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`cursor-pointer px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === t.id ? "nav-active" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t.id === "admin" ? "🔐 " : ""}{t.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === "mine" && (
        <UsagePanel logs={usageLogs} onClear={clearLogs} showUser={false} />
      )}

      {activeTab === "admin" && isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-600 flex-1">
              Showing usage across <strong>{new Set(allLogs.map(l => l.userId)).size} user{new Set(allLogs.map(l => l.userId)).size !== 1 ? 's' : ''}</strong> · {allLogs.length} total calls
            </div>
            <button
              onClick={() => exportCSV(allLogs)}
              disabled={allLogs.length === 0}
              className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap"
            >
              ⬇ Export CSV
            </button>
          </div>
          <UsagePanel logs={allLogs} onClear={null} showUser={true} />
        </div>
      )}
    </div>
  );
}
