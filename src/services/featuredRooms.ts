/** Stable bundled stills shared by marketing and the Studio lobby. */
export const FEATURED_ROOMS = [
  {
    id: "rainy-desk",
    title: "Rainy Desk",
    mood: "A warm place to think",
    category: "Cozy study",
  },
  {
    id: "alpine-mirror",
    title: "Alpine Mirror",
    mood: "A little perspective",
    category: "Mountains",
  },
  {
    id: "rainy-skyline",
    title: "Rainy Skyline",
    mood: "The city can wait",
    category: "City & night",
  },
] as const;
export const roomImage = (id: string, thumbnail = false) =>
  `/media/backgrounds/v1/${id}${thumbnail ? "-thumb" : "-960"}.webp`;
