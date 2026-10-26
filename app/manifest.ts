import type { MetadataRoute } from "next";

// Web app manifest (served at /manifest.webmanifest, public so the browser can fetch it before sign-in).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "WorkForce Management",
    short_name: "WorkForce",
    description: "Plan team capacity from the roster and assign tasks by availability.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0a0b14",
    theme_color: "#0e0f1a",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      { name: "Roster", url: "/roster", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Tasks", url: "/tasks", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
