"use client";

import { useEffect, useRef, useState } from "react";
import { avatarColor, initial } from "../../lib/ui";

export default function Avatar({ id, name, src, size = "md" }: { id: string; name: string; src: string | null; size?: "sm" | "md" | "lg" }) {
  const [broken, setBroken] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // An image can fail before hydration, in which case onError never fires; check once mounted.
  useEffect(() => {
    if (img.current?.complete && img.current.naturalWidth === 0) setBroken(true);
  }, [src]);
  const showImage = src && !broken;
  return (
    <div
      className={`avatar avatar-${size}`}
      style={{ background: showImage ? "none" : avatarColor(id), overflow: "hidden", flexShrink: 0 }}
      aria-hidden="true"
    >
      {showImage ? (
        // Plain <img>: user-entered URLs can be any https host, which next/image would reject.
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={img} src={src} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        initial(name)
      )}
    </div>
  );
}
