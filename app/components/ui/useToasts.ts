import { useCallback, useRef, useState } from "react";
import type { ToastItem } from "./Toast";

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const id = useRef(0);
  const notify = useCallback((kind: ToastItem["kind"], text: string) => {
    const n = ++id.current;
    setToasts((t) => [...t, { id: n, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== n)), 4500);
  }, []);
  return { toasts, notify };
}
