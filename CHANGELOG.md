# Changelog

## 0.58.0 (2026-10-09) — repo scaffold
- Pure sim skeleton (`src/sim`): seeded rng, tick(), action reducer, monthly-system registry, invariants, replay.
- Gate: purity, determinism, invariant fuzz (200 seeds x 120 months), parity (skipped until task 001), UI smoke.
- Scripts: sim, replay, balance, build (single-file HTML for artifact publish).
- CI, PR/issue templates, CLAUDE.md, migration plan, task prompts 000-003.

## 0.57.0 — legacy baseline
- `legacy/world-leaders-v57.jsx`, single-file artifact, 78-step jsdom harness. Last chat-built version.
