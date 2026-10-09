// Seeded PRNG. The ONLY source of randomness allowed inside src/sim.
// mulberry32: 32-bit state, fast, good enough for game sim. Same seed => same stream, every platform.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  let draws = 0;
  return {
    seed,
    next: () => { draws++; return next(); },
    int: (n) => { draws++; return Math.floor(next() * n); },
    chance: (p) => { draws++; return next() < p; },
    pick: (arr) => { draws++; return arr[Math.floor(next() * arr.length)]; },
    get draws() { return draws; },
  };
}
