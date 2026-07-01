import { Stamp } from './types';

const STORAGE_KEY = 'stampbookcover_stamps';

export function getStamps(): Stamp[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveStamp(stamp: Stamp): void {
  const stamps = getStamps();
  const existing = stamps.findIndex(s => s.id === stamp.id);
  if (existing >= 0) {
    stamps[existing] = stamp;
  } else {
    stamps.push(stamp);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stamps));
}

export function deleteStamp(id: string): void {
  const stamps = getStamps().filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stamps));
}
