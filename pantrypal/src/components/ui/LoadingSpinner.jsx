export default function LoadingSpinner({ message = "Loading..." }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
      <p className="text-sm text-gray-500 font-medium">{message}</p>
    </div>
  );
}
