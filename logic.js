// universal-pension-bd -- pure logic (no DOM). Works in browser + node.
// Pension model: the National Pension Authority's published illustrative
// figures are linear in the monthly contribution for a fixed contribution
// period (verified: 1,000->34,465; 2,000->68,931; 3,000->103,396;
// 5,000->172,327; 7,500->258,491; 10,000->344,655 per month after 42 years;
// and 1,530 per 1,000/month after 10 years). For intermediate periods the
// app interpolates geometrically between the two published anchors
// (10y -> 1.5302x, 42y -> 34.46546x monthly contribution) and labels the
// result an ESTIMATE, never an official figure.
(function (root) {
  const DATA = typeof require === 'function'
    ? require('./data.js')
    : { UPS_SCHEMES: root.UPS_SCHEMES, UPS_ANCHORS: root.UPS_ANCHORS };
  const SCHEMES = DATA.UPS_SCHEMES;
  const A = DATA.UPS_ANCHORS;

  function getScheme(id) {
    return SCHEMES.find((s) => s.id === id) || null;
  }

  // Eligibility under the published rules: join at 18-50, pension from 60
  // after at least 10 contribution years; over 50 may join under a special
  // rule with 10 uninterrupted contribution years, pension starting at age+10.
  function contributionYears(age) {
    if (!Number.isInteger(age) || age < 0 || age > 120) {
      return { eligible: false, reason: 'invalid', years: 0, startAge: 60, rule: null };
    }
    if (age < 18) {
      return { eligible: false, reason: 'under18', years: 0, startAge: 60, rule: null };
    }
    if (age <= 50) {
      return { eligible: true, reason: null, years: 60 - age, startAge: 60, rule: 'standard' };
    }
    return { eligible: true, reason: null, years: 10, startAge: age + 10, rule: 'over50' };
  }

  // Geometric interpolation between the two published anchors. Exact at
  // both anchors: M(10) = 1.5302, M(42) = 34.46546.
  function pensionMultiplier(years) {
    if (typeof years !== 'number' || !isFinite(years)) return 0;
    const y = Math.min(42, Math.max(10, years));
    const ratio = A.pension42 / A.pension10;
    return A.pension10 * Math.pow(ratio, (y - A.years10) / (A.years42 - A.years10));
  }

  // monthlyTotal = total monthly contribution incl. any government match.
  function estimatePension(monthlyTotal, years) {
    if (typeof monthlyTotal !== 'number' || monthlyTotal <= 0) return 0;
    return Math.round(monthlyTotal * pensionMultiplier(years));
  }

  function ownMonthly(scheme, monthlyTotal) {
    if (!scheme) return monthlyTotal;
    return scheme.govtMatch ? scheme.ownPay : monthlyTotal;
  }

  function govtMonthly(scheme, monthlyTotal) {
    if (!scheme) return 0;
    return scheme.govtMatch ? monthlyTotal - scheme.ownPay : 0;
  }

  // Full estimate for one scenario. Returns null on invalid input.
  function estimate(schemeId, age, monthlyTotal) {
    const scheme = getScheme(schemeId);
    if (!scheme) return null;
    const elig = contributionYears(age);
    if (!elig.eligible) return { scheme, eligibility: elig, valid: false };
    const v = validateContribution(scheme, monthlyTotal);
    if (!v.ok) return { scheme, eligibility: elig, valid: false, error: v.error };
    const years = elig.years;
    const own = ownMonthly(scheme, monthlyTotal);
    const govt = govtMonthly(scheme, monthlyTotal);
    const monthlyPension = estimatePension(monthlyTotal, years);
    return {
      scheme, eligibility: elig, valid: true,
      years, startAge: elig.startAge,
      monthlyTotal, ownMonthly: own, govtMonthly: govt,
      ownTotal: own * 12 * years,
      govtTotal: govt * 12 * years,
      totalContributed: monthlyTotal * 12 * years,
      monthlyPension,
      pensionTo75: monthlyPension * 180, // 15 years x 12 months, illustrative
    };
  }

  function validateContribution(scheme, amount) {
    if (typeof amount !== 'number' || !isFinite(amount) || !Number.isInteger(amount)) {
      return { ok: false, error: 'notInteger' };
    }
    if (amount < scheme.min || amount > scheme.max) {
      return { ok: false, error: 'outOfRange' };
    }
    if (amount % 500 !== 0) return { ok: false, error: 'notMultiple500' };
    if (scheme.govtMatch && amount !== scheme.options[0]) {
      return { ok: false, error: 'somotaFixed' };
    }
    return { ok: true };
  }

  function validateAge(age) {
    return Number.isInteger(age) && age >= 10 && age <= 100;
  }

  // Indian digit grouping (1,72,327), independent of ICU locale data.
  function formatMoney(n) {
    const s = String(Math.round(Math.abs(n)));
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3);
    const grouped = rest.replace(/(\d)(?=(\d{2})+$)/g, '$1,');
    return (n < 0 ? '-' : '') + (rest ? grouped + ',' + last3 : last3);
  }

  // ---- Saved scenarios: export / import (pure, no DOM) ----
  function buildExportPayload(scenarios) {
    return JSON.stringify({ app: 'universal-pension-bd', version: 1, scenarios }, null, 2);
  }

  function isValidScenario(o) {
    if (!o || typeof o !== 'object') return false;
    if (typeof o.name !== 'string' || !o.name.trim() || o.name.length > 60) return false;
    if (!getScheme(o.schemeId)) return false;
    if (!validateAge(o.age)) return false;
    const v = validateContribution(getScheme(o.schemeId), o.monthly);
    return v.ok;
  }

  function parseImportPayload(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { return { ok: false, error: 'badJson' }; }
    if (!obj || obj.app !== 'universal-pension-bd' || obj.version !== 1) {
      return { ok: false, error: 'wrongApp' };
    }
    if (!Array.isArray(obj.scenarios) || obj.scenarios.length > 50) {
      return { ok: false, error: 'badScenarios' };
    }
    for (const s of obj.scenarios) {
      if (!isValidScenario(s)) return { ok: false, error: 'badScenario' };
    }
    return { ok: true, scenarios: obj.scenarios };
  }

  const API = {
    SCHEMES, UPS_ANCHORS: A, getScheme, contributionYears, pensionMultiplier,
    estimatePension, ownMonthly, govtMonthly, estimate, validateContribution,
    validateAge, formatMoney, buildExportPayload, parseImportPayload, isValidScenario,
  };
  if (typeof module !== 'undefined') module.exports = API;
  else root.UPS = API;
})(typeof window !== 'undefined' ? window : globalThis);
