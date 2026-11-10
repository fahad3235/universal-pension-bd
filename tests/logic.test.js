// universal-pension-bd -- unit tests for logic.js + data.js
// Run: node --test tests/logic.test.js
// Published figures (National Pension Authority, via Wikipedia / Daily Asian Age /
// BILS policy brief) are asserted EXACTLY -- they are the ground truth, not
// values derived from logic.js.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('../logic.js');
const { UPS_SCHEMES } = require('../data.js');

const approx = (a, b, tol) => Math.abs(a - b) <= tol;

test('anchors are exact', () => {
  assert.ok(approx(L.pensionMultiplier(10), 1.5302, 0.0001));
  assert.ok(approx(L.pensionMultiplier(42), 34.46546, 0.0001));
});

test('all six published 42-year figures reproduce exactly', () => {
  const published = { 1000: 34465, 2000: 68931, 3000: 103396, 5000: 172327, 7500: 258491, 10000: 344655 };
  for (const [amount, want] of Object.entries(published)) {
    assert.equal(L.estimatePension(Number(amount), 42), want, `42y at ${amount}/mo`);
  }
});

test('both published 10-year figures reproduce exactly', () => {
  assert.equal(L.estimatePension(1000, 10), 1530);
  assert.equal(L.estimatePension(5000, 10), 7651);
});

test('interpolated multiplier is monotonic and bounded', () => {
  assert.ok(L.pensionMultiplier(20) > L.pensionMultiplier(10));
  assert.ok(L.pensionMultiplier(30) > L.pensionMultiplier(20));
  assert.ok(L.pensionMultiplier(40) > L.pensionMultiplier(30));
  assert.ok(L.pensionMultiplier(40) < L.pensionMultiplier(42));
  assert.ok(approx(L.pensionMultiplier(30), 10.7188, 0.001));
});

test('eligibility rules', () => {
  assert.deepEqual(L.contributionYears(17), { eligible: false, reason: 'under18', years: 0, startAge: 60, rule: null });
  assert.equal(L.contributionYears(18).years, 42);
  assert.equal(L.contributionYears(18).rule, 'standard');
  assert.equal(L.contributionYears(30).years, 30);
  assert.equal(L.contributionYears(50).years, 10);
  assert.equal(L.contributionYears(50).startAge, 60);
  assert.deepEqual(
    { years: L.contributionYears(51).years, startAge: L.contributionYears(51).startAge, rule: L.contributionYears(51).rule },
    { years: 10, startAge: 61, rule: 'over50' });
  assert.equal(L.contributionYears(60).startAge, 70);
  assert.equal(L.contributionYears(-1).reason, 'invalid');
  assert.equal(L.contributionYears(30.5).reason, 'invalid');
});

test('estimate: Progoti age 30, 2000/month', () => {
  const r = L.estimate('progoti', 30, 2000);
  assert.equal(r.valid, true);
  assert.equal(r.years, 30);
  assert.equal(r.startAge, 60);
  assert.equal(r.ownMonthly, 2000);
  assert.equal(r.govtMonthly, 0);
  assert.equal(r.ownTotal, 720000);
  assert.equal(r.totalContributed, 720000);
  assert.equal(r.monthlyPension, 21438);
  assert.equal(r.pensionTo75, 21438 * 180);
});

test('estimate: Somota age 18, 1000/month total (500 own + 500 govt)', () => {
  const r = L.estimate('somota', 18, 1000);
  assert.equal(r.valid, true);
  assert.equal(r.years, 42);
  assert.equal(r.ownMonthly, 500);
  assert.equal(r.govtMonthly, 500);
  assert.equal(r.ownTotal, 252000);
  assert.equal(r.govtTotal, 252000);
  assert.equal(r.totalContributed, 504000);
  assert.equal(r.monthlyPension, 34465);
});

test('estimate: Probash age 55 (over-50 rule), 10000/month', () => {
  const r = L.estimate('probash', 55, 10000);
  assert.equal(r.valid, true);
  assert.equal(r.years, 10);
  assert.equal(r.startAge, 65);
  assert.equal(r.monthlyPension, 15302);
});

test('estimate: under-18 is not valid', () => {
  const r = L.estimate('progoti', 17, 2000);
  assert.equal(r.valid, false);
  assert.equal(r.eligibility.reason, 'under18');
  assert.equal(L.estimate('no-such-scheme', 30, 2000), null);
});

test('contribution validation', () => {
  const progoti = L.getScheme('progoti');
  assert.deepEqual(L.validateContribution(progoti, 2000), { ok: true });
  assert.equal(L.validateContribution(progoti, 1500).error, 'outOfRange');
  assert.equal(L.validateContribution(progoti, 6000).error, 'outOfRange');
  assert.equal(L.validateContribution(progoti, 2600).error, 'notMultiple500');
  assert.equal(L.validateContribution(progoti, 2000.5).error, 'notInteger');
  const somota = L.getScheme('somota');
  assert.deepEqual(L.validateContribution(somota, 1000), { ok: true });
  assert.equal(L.validateContribution(somota, 500).error, 'outOfRange');
  assert.equal(L.validateContribution(L.getScheme('probash'), 6000).ok, true);
});

test('age validation', () => {
  assert.equal(L.validateAge(10), true);
  assert.equal(L.validateAge(100), true);
  assert.equal(L.validateAge(9), false);
  assert.equal(L.validateAge(101), false);
  assert.equal(L.validateAge(30.5), false);
});

test('Indian digit grouping', () => {
  assert.equal(L.formatMoney(172327), '1,72,327');
  assert.equal(L.formatMoney(344655), '3,44,655');
  assert.equal(L.formatMoney(1000), '1,000');
  assert.equal(L.formatMoney(1530), '1,530');
  assert.equal(L.formatMoney(0), '0');
  assert.equal(L.formatMoney(500), '500');
});

test('scheme data consistency', () => {
  assert.equal(UPS_SCHEMES.length, 4);
  for (const s of UPS_SCHEMES) {
    assert.ok(s.options.length >= 1);
    for (const o of s.options) {
      assert.ok(o >= s.min && o <= s.max, `${s.id} option ${o} in range`);
      assert.equal(o % 500, 0, `${s.id} option ${o} is a multiple of 500`);
    }
    assert.equal(s.min % 500, 0);
    assert.equal(s.max % 500, 0);
  }
  const somota = UPS_SCHEMES.find((s) => s.id === 'somota');
  assert.equal(somota.govtMatch, true);
  assert.equal(somota.ownPay, 500);
  assert.equal(somota.options.length, 1);
});

test('export / import round-trip and rejection', () => {
  const scenarios = [{ name: 'My Progoti', schemeId: 'progoti', age: 30, monthly: 2000 }];
  const payload = L.buildExportPayload(scenarios);
  assert.ok(payload.includes('"app":"universal-pension-bd"') || payload.includes('"app": "universal-pension-bd"'));
  const back = L.parseImportPayload(payload);
  assert.equal(back.ok, true);
  assert.deepEqual(back.scenarios, scenarios);
  assert.equal(L.parseImportPayload('{"app":"bus-fare-bd","version":1,"scenarios":[]}').ok, false);
  assert.equal(L.parseImportPayload('{not json').ok, false);
  assert.equal(L.parseImportPayload(JSON.stringify({ app: 'universal-pension-bd', version: 1, scenarios: [{ name: 'x', schemeId: 'progoti', age: 30, monthly: 2600 }] })).ok, false);
  assert.equal(L.parseImportPayload(JSON.stringify({ app: 'universal-pension-bd', version: 1, scenarios: [{ name: 'x', schemeId: 'progoti', age: 9, monthly: 2000 }] })).ok, false);
  assert.equal(L.isValidScenario({ name: 'ok', schemeId: 'surokkha', age: 40, monthly: 5000 }), true);
});
