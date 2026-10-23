/** Stable bundled stills shared by marketing and the Studio lobby. */
export const FEATURED_ROOMS = [
  {
    id: "kyoto-rain",
    title: "Kyoto Rain",
    mood: "A warm place to think",
    category: "Cozy study",
  },
  {
    id: "dolomite-dawn",
    title: "Dolomite Dawn",
    mood: "A little perspective",
    category: "Mountains",
  },
  {
    id: "penthouse-noir",
    title: "Penthouse Noir",
    mood: "The city can wait",
    category: "City & night",
  },
  { id: 'quiet-coast', title: 'Quiet Coast', mood: 'Let the day breathe', category: 'Ocean & escape' },
  { id: 'lunar-horizon', title: 'Lunar Horizon', mood: 'Room for a different perspective', category: 'Space & cosmic' },
  { id: 'amber-fold', title: 'Amber Fold', mood: 'A clear space for your thoughts', category: 'Minimal & abstract' },
] as const;
export const roomImage = (id: string, thumbnail = false) =>
  `/media/backgrounds/v1/${id}${thumbnail ? "-thumb" : "-960"}.webp`;
