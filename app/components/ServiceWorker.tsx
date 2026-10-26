"use client";

import { useEffect } from "react";

/** Registers /sw.js in production, after the page is idle so it never competes with first paint or hydration. */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((e) => console.error("Service worker registration failed", e));
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(register, { timeout: 5000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(register, 2000);
    return () => clearTimeout(t);
  }, []);
  return null;
}
