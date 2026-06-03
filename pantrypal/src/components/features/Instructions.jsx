import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, LogIn, LayoutDashboard, ScanLine, Eye, Edit3, Bell, ChefHat, LogOut, ZoomIn, X } from "lucide-react";

const STEPS = [
  {
    number: 1,
    icon: LogIn,
    title: "Sign In / Create Account",
    summary: "Access PantryPal by signing in or creating a new account.",
    details: [
      "After opening the website, you will be prompted to sign in to your account.",
      "If you have an existing account, sign in with your email and password.",
      "If you are creating a new account, sign up with your email address and create a password for your account.",
    ],
    images: [
      { label: "Sign-in Page", src: "/src/assets/signIn.png" },
      { label: "Create Account Page", src: "/src/assets/createAccount.png" }
    ],
    accent: "emerald",
  },
  {
    number: 2,
    icon: LayoutDashboard,
    title: "Navigate the Dashboard",
    summary: "The Dashboard is your home base with links to all major features.",
    details: [
      "Once you are signed in, you will be sent to the Dashboard Page. Here, you have multiple pages you can navigate to:",
      "• Scan a new receipt or manually enter new inventory items",
      "• View your current inventory, with expiration dates of each item",
      "• View generated meal plans customized to your inventory",
      "• View alerts regarding your inventory, primarily approaching expiration dates",
    ],
    images: [
      { label: "Dashboard / Home Page", src: "/src/assets/dashboard.png" },
    ],
    accent: "cyan",
  },
  {
    number: 3,
    icon: ScanLine,
    title: "Update Your Inventory",
    summary: "Add items by scanning a receipt or pasting extracted text.",
    details: [
      "To update your inventory, there are two convenient methods:",
      "• Upload an image of your receipt in the Scan Receipt Page. Your receipt will be automatically read and items will be immediately added to your inventory.",
      "• Manually enter inventory items in the Copy-Paste Section. This is mainly useful for lists of items you already have extracted text for.",
    ],
    images: [
      { label: "Upload Receipt Tab", src: "/src/assets/uploadReceipt.png" },
      { label: "Copy-Paste Data", src: "/src/assets/copyPaste.png" },
    ],
    accent: "violet",
  },
  {
    number: 4,
    icon: Eye,
    title: "View Inventory Status",
    summary: "Browse all your current inventory items and their expiration dates.",
    details: [
      "To view the status of items in your inventory, navigate to the Inventory section.",
      "This page allows you to view all of your items and update them as necessary, as detailed in the next step.",
    ],
    images: [
      { label: "Item Inventory Page", src: "/src/assets/inventory.png" },
    ],
    accent: "sky",
  },
  {
    number: 5,
    icon: Edit3,
    title: "Update Item Status",
    summary: "Mark items as partially used or finished from the Inventory page.",
    details: [
      "To update the status of an item, click on it in your Inventory Page.",
      "You can mark the item as ¾ full, ½ full, ¼ full, or finished. The app will automatically remove finished items from your inventory.",
    ],
    images: [
      { label: "Update Item Status", src: "/src/assets/updateItem.png" },
    ],
    accent: "amber",
  },
  {
    number: 6,
    icon: Bell,
    title: "View Inventory Alerts",
    summary: "Stay on top of expiring items with the alerts dropdown.",
    details: [
      "To view inventory alerts, click on the bell icon in the header.",
      "This will open a dropdown menu where you can view all of your alerts and resolve individual alerts.",
    ],
    images: [
      { label: "Inventory Alerts", src: "/src/assets/userInfo.png" },
    ],
    accent: "orange",
  },
  {
    number: 7,
    icon: ChefHat,
    title: "Generate Meal Plans",
    summary: "Create AI-powered meal plans tailored to your current inventory.",
    details: [
      "To generate meal plans, go to the Meal Plan Page. From here, you can see previously generated meal plans or click the \"Generate Meal Plan\" button to create a new one.",
      "You can provide specific instructions for the AI in a text box before generating the plan, or give further instructions to update a previously generated meal plan.",
    ],
    images: [
      { label: "Meal Plan Page", src: "/src/assets/mealPlan.png" },
    ],
    accent: "teal",
  },
  {
    number: 8,
    icon: LogOut,
    title: "Sign Out",
    summary: "Log out of your account using the Sign Out button in the header.",
    details: [
      "To log out, click on the \"Sign Out\" button in the top right corner of the page.",
    ],
    images: [
      { label: "Figure 32: Sign Out Button", src: "/src/assets/userInfo.png" },
    ],
    accent: "rose",
  },
];

const ACCENT_STYLES = {
  emerald: {
    badge:      "bg-emerald-500 text-white",
    iconBg:     "bg-emerald-50 text-emerald-600",
    border:     "border-emerald-200 hover:border-emerald-400",
    chevron:    "text-emerald-500",
    tag:        "bg-emerald-50 text-emerald-700 border-emerald-200",
    figureBar:  "bg-emerald-500",
  },
  cyan: {
    badge:      "bg-cyan-500 text-white",
    iconBg:     "bg-cyan-50 text-cyan-600",
    border:     "border-cyan-200 hover:border-cyan-400",
    chevron:    "text-cyan-500",
    tag:        "bg-cyan-50 text-cyan-700 border-cyan-200",
    figureBar:  "bg-cyan-500",
  },
  violet: {
    badge:      "bg-violet-500 text-white",
    iconBg:     "bg-violet-50 text-violet-600",
    border:     "border-violet-200 hover:border-violet-400",
    chevron:    "text-violet-500",
    tag:        "bg-violet-50 text-violet-700 border-violet-200",
    figureBar:  "bg-violet-500",
  },
  sky: {
    badge:      "bg-sky-500 text-white",
    iconBg:     "bg-sky-50 text-sky-600",
    border:     "border-sky-200 hover:border-sky-400",
    chevron:    "text-sky-500",
    tag:        "bg-sky-50 text-sky-700 border-sky-200",
    figureBar:  "bg-sky-500",
  },
  amber: {
    badge:      "bg-amber-500 text-white",
    iconBg:     "bg-amber-50 text-amber-600",
    border:     "border-amber-200 hover:border-amber-400",
    chevron:    "text-amber-500",
    tag:        "bg-amber-50 text-amber-700 border-amber-200",
    figureBar:  "bg-amber-500",
  },
  orange: {
    badge:      "bg-orange-500 text-white",
    iconBg:     "bg-orange-50 text-orange-600",
    border:     "border-orange-200 hover:border-orange-400",
    chevron:    "text-orange-500",
    tag:        "bg-orange-50 text-orange-700 border-orange-200",
    figureBar:  "bg-orange-500",
  },
  teal: {
    badge:      "bg-teal-500 text-white",
    iconBg:     "bg-teal-50 text-teal-600",
    border:     "border-teal-200 hover:border-teal-400",
    chevron:    "text-teal-500",
    tag:        "bg-teal-50 text-teal-700 border-teal-200",
    figureBar:  "bg-teal-500",
  },
  rose: {
    badge:      "bg-rose-500 text-white",
    iconBg:     "bg-rose-50 text-rose-600",
    border:     "border-rose-200 hover:border-rose-400",
    chevron:    "text-rose-500",
    tag:        "bg-rose-50 text-rose-700 border-rose-200",
    figureBar:  "bg-rose-500",
  },
};

function Lightbox({ src, label, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-5xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center text-gray-600 hover:text-gray-900 hover:shadow-xl transition-all cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
        <img
          src={src}
          alt={label}
          className="w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
        />
        {label && (
          <p className="text-center text-sm text-white/80 mt-3 italic">{label}</p>
        )}
      </div>
    </div>,
    document.body
  );
}

function ImageSlot({ label, src }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (src) {
    return (
      <figure className="mt-1">
        <div
          className="relative group cursor-zoom-in rounded-xl overflow-hidden border border-gray-200 shadow-sm"
          onClick={() => setLightboxOpen(true)}
        >
          <img
            src={src}
            alt={label}
            className="w-full object-contain max-h-72 transition-transform duration-200 group-hover:scale-[1.02]"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors duration-200">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-md">
              <ZoomIn className="w-5 h-5 text-gray-700" />
            </span>
          </div>
        </div>
        <figcaption className="text-xs text-gray-500 text-center mt-1.5 italic">{label}</figcaption>
        {lightboxOpen && <Lightbox src={src} label={label} onClose={() => setLightboxOpen(false)} />}
      </figure>
    );
  }
  return (
    <figure className="mt-1">
      <div className="w-full rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center py-10 gap-2">
        <span className="text-3xl">🖼️</span>
        <span className="text-xs text-gray-400 font-medium">{label}</span>
        <span className="text-xs text-gray-300">Image coming soon</span>
      </div>
    </figure>
  );
}

export default function Instructions() {
  const [allOpen, setAllOpen] = useState(false);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Operating Instructions</h2>
          <p className="text-sm text-gray-500 mt-1">
            Click any step to expand it and learn more. Follow the steps in order for a smooth start.
          </p>
        </div>
        <button
          onClick={() => setAllOpen((v) => !v)}
          className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
        >
          {allOpen ? "Collapse All" : "Expand All"}
        </button>
      </div>

      {/* Step cards */}
      <div className="space-y-3">
        {STEPS.map((step) => (
          <ControlledStepCard key={step.number} step={step} forceOpen={allOpen} />
        ))}
      </div>
    </div>
  );
}

// Wrapper that supports both local toggle and global expand/collapse
function ControlledStepCard({ step, forceOpen }) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = forceOpen || localOpen;
  const s = ACCENT_STYLES[step.accent];
  const Icon = step.icon;

  return (
    <div
      className={`bg-white border-2 rounded-2xl shadow-sm transition-all duration-200 cursor-pointer select-none ${s.border} ${open ? "shadow-md" : "hover:shadow-md"}`}
      onClick={() => setLocalOpen((v) => !v)}
    >
      <div className="flex items-center gap-4 p-5">
        <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${s.badge}`}>
          {step.number}
        </span>
        <span className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${s.iconBg}`}>
          <Icon className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-800 text-sm sm:text-base leading-snug">{step.title}</p>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{step.summary}</p>
        </div>
        <span className={`shrink-0 ${s.chevron}`}>
          {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </span>
      </div>

      {open && (
        <div
          className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <ul className="space-y-2">
            {step.details.map((line, i) => (
              <li key={i} className="text-sm text-gray-700 leading-relaxed">
                {line.startsWith("•") ? (
                  <span className="flex gap-2">
                    <span className={`shrink-0 font-bold ${s.chevron}`}>•</span>
                    <span>{line.slice(1).trim()}</span>
                  </span>
                ) : (
                  line
                )}
              </li>
            ))}
          </ul>
          {step.images.length > 0 && (
            <div className={`grid gap-4 ${step.images.length > 1 ? "sm:grid-cols-2" : ""}`}>
              {step.images.map((img, i) => (
                <ImageSlot key={i} label={img.label} src={img.src} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
