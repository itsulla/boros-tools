import { useMode, type Mode } from "@/lib/mode-context";

interface Props {
  variant?: "desktop" | "mobile";
}

export function ModeToggle({ variant = "desktop" }: Props) {
  const { mode, setMode } = useMode();

  if (variant === "mobile") {
    return (
      <div
        role="group"
        aria-label="Interface complexity"
        className="flex w-full bg-background border border-card-border rounded-lg p-0.5 mb-4"
      >
        {(["simple", "advanced"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md text-center transition-colors capitalize ${
              mode === m
                ? "bg-primary text-[#090D18]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Interface complexity"
      className="inline-flex items-center gap-0.5 bg-background border border-card-border rounded-full p-0.5"
    >
      {(["simple", "advanced"] as Mode[]).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setMode(m)}
          aria-pressed={mode === m}
          className={`px-3 py-1 text-[11px] font-medium rounded-full transition-colors capitalize ${
            mode === m
              ? "bg-primary text-[#090D18]"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
