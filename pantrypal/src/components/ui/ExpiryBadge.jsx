import { daysUntilExpiry, expiryStatus } from "../../lib/expiration";

export default function ExpiryBadge({ expiration }) {
  const days = daysUntilExpiry(expiration);
  const status = expiryStatus(days);

  const config = {
    expired:  { bg: "bg-red-100",    text: "text-red-700",    border: "border-red-200",    label: "Expired" },
    critical: { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200", label: `${days}d left` },
    warning:  { bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-200", label: `${days}d left` },
    good:     { bg: "bg-emerald-100",text: "text-emerald-700",border: "border-emerald-200",label: `${days}d left` },
  }[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${config.bg} ${config.text} ${config.border}`}>
      {status !== "good" && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      )}
      {config.label}
    </span>
  );
}
