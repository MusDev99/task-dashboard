/**
 * Next.js instrumentation hook.
 *
 * Node.js 22+ ships a built-in `localStorage` object, but its methods
 * (getItem, setItem, etc.) throw unless `--localstorage-file` points to
 * a valid path. Several libraries probe `localStorage` during SSR and
 * crash when the method call fails.
 *
 * This hook patches `globalThis.localStorage` on the server to be a
 * harmless no-op storage so SSR doesn't blow up.
 */
export async function register() {
  if (typeof window === "undefined") {
    const storage: Record<string, string> = {};

    (globalThis as Record<string, unknown>).localStorage = {
      getItem(key: string) {
        return storage[key] ?? null;
      },
      setItem(key: string, value: string) {
        storage[key] = String(value);
      },
      removeItem(key: string) {
        delete storage[key];
      },
      clear() {
        Object.keys(storage).forEach((k) => delete storage[k]);
      },
      get length() {
        return Object.keys(storage).length;
      },
      key(index: number) {
        return Object.keys(storage)[index] ?? null;
      },
    };
  }
}
