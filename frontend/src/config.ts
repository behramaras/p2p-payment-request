/** Empty string = same-origin `/api` (Vite dev proxy). Otherwise full API origin. */
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
