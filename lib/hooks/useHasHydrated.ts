import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store/useAppStore";

/**
 * Returns true once the Zustand persist middleware has finished hydrating
 * from localStorage. Use this in layout components before reading auth state
 * to avoid flickers and incorrect redirects on first render.
 */
export function useHasHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(useAppStore.persist.hasHydrated());
    const unsub = useAppStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);
  return hydrated;
}
