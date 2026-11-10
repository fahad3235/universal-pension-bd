// universal-pension-bd -- scheme data for Bangladesh's Universal Pension Scheme
// (Sarbojanin Pension), launched 17 August 2023, National Pension Authority.
// Sources (checked 2026-11-10): Wikipedia "Universal Pension"; Daily Asian Age
// "What is in the Universal Pension Scheme?"; BILS Policy Brief on UPS (2025).
// Contribution options below are the published fixed monthly options per scheme.
// Somota: subscriber pays 500, government adds 500 (total 1000/month).
const UPS_SCHEMES = [
  { id: 'progoti',  nameEn: 'Progoti',  min: 2000, max: 5000,  options: [2000, 3000, 5000],       govtMatch: false, ownPay: null },
  { id: 'surokkha', nameEn: 'Surokkha', min: 1000, max: 5000,  options: [1000, 2000, 3000, 5000], govtMatch: false, ownPay: null },
  { id: 'somota',   nameEn: 'Somota',   min: 1000, max: 1000,  options: [1000],                   govtMatch: true,  ownPay: 500 },
  { id: 'probash',  nameEn: 'Probash',  min: 5000, max: 10000, options: [5000, 7500, 10000],      govtMatch: false, ownPay: null },
];

// Published illustrative monthly pension per 1,000 BDT/month total contribution:
//  - 10 contribution years  -> 1,530 BDT/month  (Probash 5,000 x 10y -> 7,651;
//    Somota 500 own + 500 govt x 10y -> 1,530; both agree: 1.5302 per 1,000)
//  - 42 contribution years  -> 34,465 BDT/month (Progoti/Surokkha/Probash figures
//    are linear in the monthly amount: 2,000->68,931, 3,000->103,396,
//    5,000->172,327, 7,500->258,491, 10,000->344,655; per-1,000 = 34.46545
//    reproduces every one of these exactly after rounding to the taka)
// Anchors below use the fitted per-1,000 multipliers so the app reproduces
// every published figure exactly; see tests/logic.test.js for the checks.
// Intermediate years are NOT officially published; the app interpolates
// geometrically between these two anchors and labels the result an estimate.
const UPS_ANCHORS = { years10: 10, pension10: 1.5302, years42: 42, pension42: 34.46546 };

if (typeof module !== 'undefined') {
  module.exports = { UPS_SCHEMES, UPS_ANCHORS };
}
if (typeof window !== 'undefined') {
  // Top-level `const` does not attach to window; expose explicitly so
  // logic.js (which reads root.UPS_SCHEMES) works in the browser.
  window.UPS_SCHEMES = UPS_SCHEMES;
  window.UPS_ANCHORS = UPS_ANCHORS;
}
