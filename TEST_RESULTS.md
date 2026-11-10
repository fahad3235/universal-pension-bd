# TEST_RESULTS.md — universal-pension-bd

Run date: 2026-11-10. All results are real, from commands run on this machine.

## Unit tests — 14/14 pass

Command: `node --test tests/logic.test.js`

```
tests 14, pass 14, fail 0
```

Hand-verified anchors (independently computed from the published figures,
not derived from logic.js):

| Check | Expected | Measured |
|---|---|---|
| 42y pension, ৳1,000/mo | ৳34,465 | exact |
| 42y pension, ৳2,000/mo | ৳68,931 | exact |
| 42y pension, ৳3,000/mo | ৳1,03,396 | exact |
| 42y pension, ৳5,000/mo | ৳1,72,327 | exact |
| 42y pension, ৳7,500/mo | ৳2,58,491 | exact |
| 42y pension, ৳10,000/mo | ৳3,44,655 | exact |
| 10y pension, ৳1,000/mo | ৳1,530 | exact |
| 10y pension, ৳5,000/mo | ৳7,651 | exact |
| Progoti, age 30, ৳2,000/mo | 30 years, own total ৳7,20,000, pension ৳21,438 | exact |
| Somota, age 18, ৳1,000/mo total | own ৳2,52,000 + govt ৳2,52,000, pension ৳34,465 | exact |
| Probash, age 55, ৳10,000/mo | 10 years (over-50 rule), starts 65, pension ৳15,302 | exact |
| formatMoney(172327) | 1,72,327 | exact |
| formatMoney(344655) | 3,44,655 | exact |

## Smoke tests — 56/56 pass

Command: `node tests/smoke.js` (raw CDP, headless_shell-1187, file://)

```
56 checks, 0 failed
```

Hand-verified in the live page: Progoti age 30 / ৳2,000 → ৳21,438, 30 years, starts 2056 (current year + 30); Surokkha age 18 / ৳1,000 → ৳34,465; over-50 Probash age 55 / ৳10,000 → 10 years, starts 65, ৳15,302; Somota input disabled at ৳1,000 with govt rows ৳2,52,000 / ৳2,52,000; official table shows ৳1,72,327 and ৳7,651 and a dash for unpublished 10-year cells; Bengali toggle renders the title and Bengali digits and persists across reload; save → reload persistence; export/import round-trip; wrong-app and malformed imports rejected; typed-DELETE erase; 390px no horizontal overflow; zero non-file network requests; 0 console/page errors.

## Repairs

- 1 real app bug: `data.js` top-level `const` does not attach to `window`, so `logic.js` read `root.UPS_SCHEMES` as undefined in the browser (41/55 smoke checks failed on first run). Fixed by exposing the data on `window` explicitly; re-run 56/56 green.
- 2 test-side fixes (my expectations, not app bugs): ৳2,500 is a valid Progoti amount (multiple of 500, in range) — corrected the rejection test to ৳2,600; the 42-year per-৳1,000 multiplier needed 34.46546 (not 34.46545) so ৳10,000/mo reproduces the published ৳3,44,655 after rounding.
- 1 honesty fix: the official-examples table and README now show a dash for 10-year cells whose figures were never published (only ৳1,000 → ৳1,530 and ৳5,000 → ৳7,651 are published for 10 years); the calculator still estimates those periods and labels them estimates.
