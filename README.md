# Universal Pension Calculator — Bangladesh

**সার্বজনীন পেনশন ক্যালকুলেটর** — an offline, bilingual (English / বাংলা) estimator for Bangladesh's **Universal Pension Scheme (Sarbojanin Pension)**, launched 17 August 2023 by the National Pension Authority.

Pick one of the four schemes — **Progoti (প্রগতি)** for private-sector employees, **Surokkha (সুরক্ষা)** for self-employed and informal-sector workers, **Somota (সমতা)** for citizens below the poverty line (the government matches your contribution), or **Probash (প্রবাস)** for expatriate Bangladeshis — enter your age and monthly contribution, and see your estimated monthly pension from age 60, your total contribution, and the published official example figures.

## Features

- **Four schemes** with their published monthly contribution options (Progoti ৳2,000/3,000/5,000; Surokkha ৳1,000/2,000/3,000/5,000; Somota ৳1,000 total — you pay ৳500, the government adds ৳500; Probash ৳5,000/7,500/10,000)
- **Pension estimator** — contribution years to age 60, pension start age and year, your total contribution, government top-up (Somota), estimated monthly pension, and total pension to age 75
- **Eligibility rules** — join at 18–50 with pension from 60 after at least 10 contribution years; the special over-50 rule (10 uninterrupted years, pension from age + 10) is handled, and under-18s are told when they can join
- **Published official examples table** — every published figure for all four schemes at 42 and 10 contribution years
- **Saved calculations** — save, open, and delete scenarios (localStorage), JSON export/import with strict validation, typed-`DELETE` erase-all
- **Bilingual EN / বাংলা** toggle, persisted, with Bengali digits
- **Fully offline** — zero network requests; your data never leaves your browser
- **Responsive** — verified at desktop 1440px and mobile 390px with no horizontal overflow

## How the estimate works

The National Pension Authority's published illustrative figures are linear in the monthly contribution for a fixed contribution period. The app reproduces **all eight published figures exactly**:

| Monthly contribution | Pension after 42 years | Pension after 10 years |
|---|---:|---:|
| ৳1,000 | ৳34,465 | ৳1,530 |
| ৳2,000 | ৳68,931 | — |
| ৳3,000 | ৳1,03,396 | — |
| ৳5,000 | ৳1,72,327 | ৳7,651 |
| ৳7,500 | ৳2,58,491 | — |
| ৳10,000 | ৳3,44,655 | — |

Only the two 10-year figures above are published; the other 10-year values are computed by the app's interpolation and shown in the app as estimates, not as official figures.

For contribution periods between the two published anchors (10 and 42 years), the app interpolates geometrically between them (per-৳1,000 multipliers 1.5302× at 10 years and 34.46546× at 42 years) and labels the result an **estimate**. The actual pension depends on investment returns and the rules in force — verify at [upension.gov.bd](https://www.upension.gov.bd).

## Tech stack

- Vanilla HTML + CSS + JavaScript — no build step, no dependencies, no framework
- `data.js` — scheme definitions and the two published anchor figures (with sources)
- `logic.js` — pure, testable calculation logic (works in the browser and in Node)
- `i18n.js` — English/Bengali strings (Bengali stored as `\uXXXX` escapes so shipped sources stay pure ASCII)
- `app.js` — UI wiring, localStorage persistence, export/import

## Run locally

```bash
# any static server, or just open the file:
open index.html
# or
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Testing

```bash
node --test tests/logic.test.js   # 14 unit tests
node tests/smoke.js               # 55 headless-Chrome (CDP) smoke checks
```

Unit tests assert every published figure exactly, eligibility boundaries (17 / 18 / 50 / 51), the Somota government match, contribution validation, Indian digit grouping, and export/import rejection. Smoke tests drive the real page in headless Chrome: validation, all four schemes, the over-50 rule, Bengali toggle + persistence, save/export/import/erase flows, 390px layout, zero non-file network requests, and zero console/page errors.

## Limitations

- Pension figures between 10 and 42 contribution years are interpolated estimates, not official figures.
- The app does not register you for the scheme, check your NID, or talk to any government system — enrolment happens at upension.gov.bd.
- Contribution options are the published fixed options at launch; if the National Pension Authority changes them, the data in `data.js` needs updating.

## Status

Complete MVP. Sources: Wikipedia ("Universal Pension"), Daily Asian Age ("What is in the Universal Pension Scheme?"), BILS Policy Brief on UPS (2025) — checked 2026-11-10.
