import { useState } from "react";
import { X, Sparkles } from "lucide-react";

const STORAGE_KEY = "useboros-welcome-dismissed";

export function WelcomeBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });
  if (dismissed) return null;

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    setDismissed(true);
  };

  return (
    <div className="bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/30 rounded-xl p-4 mb-6 flex items-center gap-3">
      <Sparkles className="w-4 h-4 text-primary shrink-0" />
      <div className="flex-1 text-sm">
        <span className="font-medium text-foreground">New to Pendle?</span>
        <span className="text-muted-foreground"> Here's a 60-second explainer.</span>
      </div>
      <a href="#what-is-pendle" className="text-xs font-medium text-primary hover:underline px-3 py-1 rounded-lg border border-primary/30 hover:bg-primary/10">Learn</a>
      <button onClick={dismiss} className="text-muted-foreground hover:text-foreground p-1" aria-label="Dismiss">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
