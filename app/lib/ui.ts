export const avatarColors = [
  "linear-gradient(135deg, #6c63ff, #9b5de5)",
  "linear-gradient(135deg, #f15bb5, #fe6d73)",
  "linear-gradient(135deg, #00c9a7, #00b4d8)",
  "linear-gradient(135deg, #ffc233, #ff9f1c)",
  "linear-gradient(135deg, #9b5de5, #f15bb5)",
  "linear-gradient(135deg, #00b4d8, #0077b6)",
  "linear-gradient(135deg, #ff6b6b, #ee5a24)",
  "linear-gradient(135deg, #26de81, #20bf6b)",
  "linear-gradient(135deg, #fd79a8, #e84393)",
  "linear-gradient(135deg, #a29bfe, #6c5ce7)",
];

/** Names often end with " -"; strip it for display. */
export const displayName = (name: string) => name.replace(/\s-\s*$/, "").trim() || name;

export const initial = (name: string) => displayName(name).charAt(0).toUpperCase() || "?";

/** Stable colour per user id, so an avatar doesn't change colour when the list is filtered. */
export function avatarColor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return avatarColors[h % avatarColors.length];
}
