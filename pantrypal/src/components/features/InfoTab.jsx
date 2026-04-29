import { Trash2 } from "lucide-react";

const TASK_META = {
  'recipe-generation': { label: 'Recipe Generator', color: 'emerald', emoji: '🍽️' },
  'meal-planning':     { label: 'Meal Planning',     color: 'cyan',    emoji: '📅' },
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
  const tasks = Object.keys(TASK_META);
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {tasks.map((task) => {
        const meta   = TASK_META[task];
        const subset = logs.filter((l) => l.task === task);
        if (subset.length === 0) return null;

        const totalCost    = subset.reduce((s, l) => s + (l.costUSD   ?? 0), 0);
        const totalIn      = subset.reduce((s, l) => s + (l.inputTokens  ?? 0), 0);
        const totalOut     = subset.reduce((s, l) => s + (l.outputTokens ?? 0), 0);
        const totalCacheR  = subset.reduce((s, l) => s + (l.cacheReadTokens  ?? 0), 0);
        const totalCacheW  = subset.reduce((s, l) => s + (l.cacheWriteTokens ?? 0), 0);
        const avgDuration  = subset.reduce((s, l) => s + (l.durationMs ?? 0), 0) / subset.length;

        const borderColor = meta.color === 'emerald' ? 'border-emerald-200 bg-emerald-50/50' : 'border-cyan-200 bg-cyan-50/50';
        const textAccent  = meta.color === 'emerald' ? 'text-emerald-700' : 'text-cyan-700';
        const badgeBg     = meta.color === 'emerald' ? 'bg-emerald-100 text-emerald-700' : 'bg-cyan-100 text-cyan-700';

        return (
          <div key={task} className={`border rounded-2xl p-5 space-y-3 ${borderColor}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{meta.emoji}</span>
                <span className={`font-bold text-sm ${textAccent}`}>{meta.label}</span>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeBg}`}>
                {subset.length} call{subset.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-gray-500 font-medium">Total Cost</p>
                <p className="font-bold text-gray-800">{fmt$(totalCost)}</p>
              </div>
              <div>
                <p className="text-gray-500 font-medium">Avg Duration</p>
                <p className="font-bold text-gray-800">{fmtMs(avgDuration)}</p>
              </div>
              <div>
                <p className="text-gray-500 font-medium">Input Tokens</p>
                <p className="font-bold text-gray-800">{fmtK(totalIn)}</p>
              </div>
              <div>
                <p className="text-gray-500 font-medium">Output Tokens</p>
                <p className="font-bold text-gray-800">{fmtK(totalOut)}</p>
              </div>
              {totalCacheR > 0 && (
                <div>
                  <p className="text-gray-500 font-medium">Cache Hits</p>
                  <p className="font-bold text-amber-600">{fmtK(totalCacheR)} tokens saved</p>
                </div>
              )}
              {totalCacheW > 0 && (
                <div>
                  <p className="text-gray-500 font-medium">Cache Written</p>
                  <p className="font-bold text-gray-800">{fmtK(totalCacheW)}</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LogEntry({ entry }) {
  const meta = TASK_META[entry.task] ?? { emoji: '🤖', label: entry.task, color: 'violet' };
  const badgeBg = meta.color === 'emerald'
    ? 'bg-emerald-100 text-emerald-700'
    : meta.color === 'cyan'
    ? 'bg-cyan-100 text-cyan-700'
    : 'bg-violet-100 text-violet-700';

  const totalTokens = (entry.inputTokens ?? 0) + (entry.outputTokens ?? 0);
  const cacheHit    = (entry.cacheReadTokens ?? 0) > 0;

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <span className="text-lg shrink-0 mt-0.5">{meta.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeBg}`}>{meta.label}</span>
          {cacheHit && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              ⚡ cache hit
            </span>
          )}
          <span className="text-xs text-gray-400">{fmtTime(entry.timestamp)}</span>
        </div>
        <p className="text-sm font-semibold text-gray-800 truncate">{entry.description}</p>
        <div className="flex gap-3 mt-1 text-xs text-gray-500 flex-wrap">
          <span>{fmtK(entry.inputTokens ?? 0)} in · {fmtK(entry.outputTokens ?? 0)} out</span>
          {entry.cacheReadTokens > 0 && <span className="text-amber-600">{fmtK(entry.cacheReadTokens)} cached</span>}
          <span>{fmtMs(entry.durationMs)}</span>
          <span className="font-semibold text-gray-700">{fmt$(entry.costUSD)}</span>
        </div>
      </div>
    </div>
  );
}

export default function InfoTab({ usageLogs, clearLogs }) {
  if (usageLogs.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="glass p-12 text-center text-gray-400">
          <p className="text-5xl mb-4">📊</p>
          <p className="font-semibold text-lg text-gray-600">No usage recorded yet</p>
          <p className="text-sm mt-1">Generate a recipe or meal plan to see token usage and cost breakdown here.</p>
        </div>
      </div>
    );
  }

  const totalCost   = usageLogs.reduce((s, l) => s + (l.costUSD      ?? 0), 0);
  const totalIn     = usageLogs.reduce((s, l) => s + (l.inputTokens  ?? 0), 0);
  const totalOut    = usageLogs.reduce((s, l) => s + (l.outputTokens ?? 0), 0);
  const totalCacheR = usageLogs.reduce((s, l) => s + (l.cacheReadTokens  ?? 0), 0);
  const totalCacheW = usageLogs.reduce((s, l) => s + (l.cacheWriteTokens ?? 0), 0);
  const totalTokens = totalIn + totalOut;
  const cacheRate   = totalCacheW + totalIn > 0
    ? Math.round((totalCacheR / (totalCacheW + totalIn)) * 100)
    : 0;

  const sorted = [...usageLogs].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">📊 Usage & Cost</h2>
          <p className="text-sm text-gray-500 mt-0.5">Powered by Claude Agent SDK · claude-haiku-4-5</p>
        </div>
        <button
          onClick={clearLogs}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 border border-gray-200 rounded-xl transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Cost"   value={fmt$(totalCost)}          sub={`${usageLogs.length} calls`}          accent="emerald" />
        <StatCard label="Total Tokens" value={fmtK(totalTokens)}        sub={`${fmtK(totalIn)} in · ${fmtK(totalOut)} out`} accent="violet" />
        <StatCard label="Cache Hits"   value={fmtK(totalCacheR)}        sub={`${cacheRate}% hit rate`}             accent="amber" />
        <StatCard label="Cache Written" value={fmtK(totalCacheW)}       sub="reused on future calls"               accent="cyan" />
      </div>

      {/* Cache insight */}
      {totalCacheR > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-800">
          <strong>⚡ Cache savings:</strong> {fmtK(totalCacheR)} tokens were served from the agent SDK's prompt cache instead of re-processing, reducing cost and latency on repeated calls.
        </div>
      )}

      {/* Per-task breakdown */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">By Task</h3>
        <TaskBreakdown logs={usageLogs} />
      </div>

      {/* Activity log */}
      <div className="glass p-4">
        <h3 className="text-sm font-bold text-gray-700 mb-1 uppercase tracking-wide">Activity Log</h3>
        <p className="text-xs text-gray-400 mb-3">Most recent first</p>
        <div>
          {sorted.map((entry) => (
            <LogEntry key={entry.id} entry={entry} />
          ))}
        </div>
      </div>
    </div>
  );
}
