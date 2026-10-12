// One media-query hook for "is the viewport at least this wide". Desktop layouts (tables, master-detail) branch on it
// so the phone tree stays exactly as it was; CSS handles everything that is only spacing.
import { useEffect, useState } from 'react';
import { BREAK } from '../tokens.js';

const test = (min) => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(`(min-width:${min}px)`).matches;
export function useWide(min = BREAK.desktop) {
  const [wide, setWide] = useState(() => test(min));
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const m = window.matchMedia(`(min-width:${min}px)`); const f = () => setWide(m.matches);
    f(); m.addEventListener?.('change', f); return () => m.removeEventListener?.('change', f);
  }, [min]);
  return wide;
}
