'use client';

import { useEffect } from 'react';
import { ensurePresetStamps } from '@/lib/presetStamps';

export default function PresetLoader() {
  useEffect(() => {
    ensurePresetStamps().catch(console.error);
  }, []);

  return null;
}
