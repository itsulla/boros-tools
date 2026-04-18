import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Mode = "simple" | "advanced";

interface ModeContextValue {
  mode: Mode;
  setMode: (m: Mode) => void;
  toggleMode: () => void;
}

const ModeContext = createContext<ModeContextValue | null>(null);

const STORAGE_KEY = "useboros-mode";

function readStoredMode(): Mode {
  if (typeof window === "undefined") return "simple";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "advanced" ? "advanced" : "simple";
  } catch {
    return "simple";
  }
}

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>(readStoredMode);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // localStorage disabled — silently no-op
    }
  }, [mode]);

  const setMode = (m: Mode) => setModeState(m);
  const toggleMode = () => setModeState((prev) => (prev === "simple" ? "advanced" : "simple"));

  return (
    <ModeContext.Provider value={{ mode, setMode, toggleMode }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode(): ModeContextValue {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useMode must be used inside ModeProvider");
  return ctx;
}
