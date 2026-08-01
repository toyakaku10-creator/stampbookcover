export type SavedMap = {
  id: string;
  name: string;
  thumbnail: string;     // small JPEG base64 (~200px wide) for list display
  fabricJson: object;    // Fabric.js canvas.toJSON() for re-editing
  bgColor: string;       // canvas background color
  mmW: number;
  mmH: number;
  createdAt: number;
};

const KEY = 'mapBackgrounds';

export function getSavedMaps(): SavedMap[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedMap[];
  } catch {
    return [];
  }
}

export function saveMap(map: SavedMap): void {
  const maps = getSavedMaps().filter(m => m.id !== map.id);
  maps.unshift(map); // newest first
  localStorage.setItem(KEY, JSON.stringify(maps));
}

export function deleteMap(id: string): void {
  const maps = getSavedMaps().filter(m => m.id !== id);
  localStorage.setItem(KEY, JSON.stringify(maps));
}

export function getMap(id: string): SavedMap | undefined {
  return getSavedMaps().find(m => m.id === id);
}
