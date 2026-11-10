// universal-pension-bd -- UI wiring. Pure ASCII source; Bengali via i18n.js.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var LS_KEY = 'universal-pension-bd-v1';
  var TAKA = '\u09f3';

  var state = { lang: 'en', schemeId: 'progoti', age: '', monthly: null, scenarios: [] };

  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      var obj = JSON.parse(raw);
      if (obj && typeof obj === 'object') {
        if (obj.lang === 'bn' || obj.lang === 'en') state.lang = obj.lang;
        if (UPS.getScheme(obj.schemeId)) state.schemeId = obj.schemeId;
        if (typeof obj.age === 'number' || typeof obj.age === 'string') state.age = obj.age;
        if (typeof obj.monthly === 'number') state.monthly = obj.monthly;
        if (Array.isArray(obj.scenarios)) {
          state.scenarios = obj.scenarios.filter(function (s) { return UPS.isValidScenario(s); });
        }
      }
    } catch (e) { /* corrupted storage: start fresh */ }
  }
  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        lang: state.lang, schemeId: state.schemeId, age: state.age,
        monthly: state.monthly, scenarios: state.scenarios,
      }));
    } catch (e) { /* storage full/blocked: app still works in-memory */ }
  }

  function t(key) { return upsT(key, state.lang); }
  function digits(s) { return state.lang === 'bn' ? upsBnDigits(String(s)) : String(s); }
  function fmt(n) { return TAKA + digits(UPS.formatMoney(n)); }
  function fmtNum(n) { return digits(n); }

  function currentScheme() { return UPS.getScheme(state.schemeId); }

  // ---- Scheme cards ----
  function renderSchemes() {
    var wrap = $('schemeCards');
    wrap.innerHTML = '';
    UPS.SCHEMES.forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'scheme-card';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(s.id === state.schemeId));
      var opts = s.options.map(function (o) { return fmt(o); }).join(', ');
      b.innerHTML =
        '<strong>' + esc(t('schemeName_' + s.id)) + '</strong>' +
        '<small>' + esc(t('who_' + s.id)) + '</small>' +
        '<span class="opts">' + esc(opts) + ' ' + esc(t('perMonth')) + '</span>' +
        (s.govtMatch ? '<small>' + esc(t('govtMatchNote')) + '</small>' : '');
      b.addEventListener('click', function () {
        state.schemeId = s.id;
        state.monthly = s.options[0];
        $('amountInput').value = String(state.monthly);
        save();
        renderSchemes(); renderChips(); recalc();
      });
      wrap.appendChild(b);
    });
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---- Amount chips + custom input ----
  function renderChips() {
    var wrap = $('amountChips');
    wrap.innerHTML = '';
    var s = currentScheme();
    s.options.forEach(function (o) {
      var c = document.createElement('button');
      c.type = 'button';
      c.className = 'chip';
      c.textContent = fmt(o);
      c.setAttribute('aria-pressed', String(state.monthly === o));
      c.addEventListener('click', function () {
        state.monthly = o;
        $('amountInput').value = String(o);
        save(); renderChips(); recalc();
      });
      wrap.appendChild(c);
    });
    var input = $('amountInput');
    input.disabled = s.govtMatch;
    if (s.govtMatch) { state.monthly = s.options[0]; input.value = String(s.options[0]); }
  }

  // ---- Official published-examples table ----
  function renderTable() {
    var body = $('officialBody');
    body.innerHTML = '';
    UPS.SCHEMES.forEach(function (s) {
      s.options.forEach(function (o) {
        var tr = document.createElement('tr');
        var nameTd = document.createElement('td');
        nameTd.textContent = t('schemeName_' + s.id);
        var optTd = document.createElement('td');
        optTd.className = 'num';
        optTd.textContent = fmt(o);
        var p42 = document.createElement('td');
        p42.className = 'num';
        p42.textContent = fmt(UPS.estimatePension(o, 42));
        var p10 = document.createElement('td');
        p10.className = 'num';
        // Only two 10-year figures are published (1,000 -> 1,530 and
        // 5,000 -> 7,651 per month); other 10-year values are not published,
        // so show a dash rather than a computed value in this table.
        p10.textContent = (o === 1000 || o === 5000) ? fmt(UPS.estimatePension(o, 10)) : '\u2014';
        tr.appendChild(nameTd); tr.appendChild(optTd); tr.appendChild(p42); tr.appendChild(p10);
        body.appendChild(tr);
      });
    });
  }

  // ---- Calculator ----
  function showError(key) {
    var el = $('calcError');
    el.textContent = t(key);
    el.hidden = false;
  }
  function hideError() { $('calcError').hidden = true; }

  function recalc() {
    var ageRaw = $('ageInput').value.trim();
    var amtRaw = $('amountInput').value.trim();
    hideError();
    if (ageRaw === '' || amtRaw === '') {
      $('emptyCalc').hidden = false;
      $('results').hidden = true;
      return;
    }
    var age = Number(ageRaw);
    if (!UPS.validateAge(age)) { showError('errAge'); $('results').hidden = true; $('emptyCalc').hidden = false; return; }
    var monthly = Number(amtRaw);
    var scheme = currentScheme();
    var v = UPS.validateContribution(scheme, monthly);
    if (!v.ok) {
      var key = v.error === 'notInteger' ? 'errNotInteger'
        : v.error === 'outOfRange' ? 'errOutOfRange'
        : v.error === 'notMultiple500' ? 'errNotMultiple500' : 'errSomotaFixed';
      showError(key);
      $('results').hidden = true; $('emptyCalc').hidden = false;
      return;
    }
    state.age = age; state.monthly = monthly; save();
    var r = UPS.estimate(state.schemeId, age, monthly);
    if (!r || !r.valid) { $('results').hidden = true; $('emptyCalc').hidden = false; return; }
    var badge = $('eligBadge');
    if (r.eligibility.rule === 'standard') { badge.textContent = t('eligibleStandard'); badge.className = 'badge'; }
    else { badge.textContent = t('eligibleOver50'); badge.className = 'badge warn'; }
    var year = new Date().getFullYear();
    $('resYears').textContent = fmtNum(r.years) + ' ' + t('yearsUnit');
    $('resStartAge').textContent = fmtNum(r.startAge);
    $('resStartYear').textContent = fmtNum(year + r.years);
    $('resOwnMonthly').textContent = fmt(r.ownMonthly);
    $('resGovtMonthly').textContent = fmt(r.govtMonthly);
    $('resOwnTotal').textContent = fmt(r.ownTotal);
    $('resGovtTotal').textContent = fmt(r.govtTotal);
    $('resTotal').textContent = fmt(r.totalContributed);
    $('resPension').textContent = fmt(r.monthlyPension);
    $('resTo75').textContent = fmt(r.pensionTo75);
    $('govtMonthlyRow').hidden = !scheme.govtMatch;
    $('govtTotalRow').hidden = !scheme.govtMatch;
    $('emptyCalc').hidden = true;
    $('results').hidden = false;
  }

  // ---- Saved scenarios ----
  function renderScenarios() {
    var list = $('scenarioList');
    list.innerHTML = '';
    $('noScenarios').hidden = state.scenarios.length !== 0;
    state.scenarios.forEach(function (sc, i) {
      var li = document.createElement('li');
      var r = UPS.estimate(sc.schemeId, sc.age, sc.monthly);
      var detail = t('schemeName_' + sc.schemeId) + ' | ' + fmt(sc.monthly) + '/' + t('perMonth') +
        ' | ' + fmtNum(sc.age) + ' ' + t('yearsUnit') +
        (r && r.valid ? ' -> ' + fmt(r.monthlyPension) + '/' + t('perMonth') : '');
      var nameSpan = document.createElement('span');
      nameSpan.className = 's-name';
      nameSpan.textContent = sc.name;
      var detSpan = document.createElement('span');
      detSpan.className = 's-detail';
      detSpan.textContent = detail;
      var loadBtn = document.createElement('button');
      loadBtn.type = 'button'; loadBtn.className = 'secondary'; loadBtn.textContent = t('loadLabel');
      loadBtn.addEventListener('click', function () {
        state.schemeId = sc.schemeId; state.age = sc.age; state.monthly = sc.monthly;
        $('ageInput').value = String(sc.age);
        $('amountInput').value = String(sc.monthly);
        save(); renderSchemes(); renderChips(); recalc();
      });
      var delBtn = document.createElement('button');
      delBtn.type = 'button'; delBtn.className = 'secondary'; delBtn.textContent = t('deleteLabel');
      delBtn.addEventListener('click', function () {
        state.scenarios.splice(i, 1);
        save(); renderScenarios();
      });
      li.appendChild(nameSpan); li.appendChild(detSpan);
      li.appendChild(loadBtn); li.appendChild(delBtn);
      list.appendChild(li);
    });
  }

  function saveScenario() {
    var name = $('scenarioName').value.trim();
    var age = Number($('ageInput').value.trim());
    var monthly = Number($('amountInput').value.trim());
    var sc = { name: name || (t('schemeName_' + state.schemeId) + ' - ' + age), schemeId: state.schemeId, age: age, monthly: monthly };
    if (!UPS.isValidScenario(sc)) { showError('errAge'); return; }
    state.scenarios.push(sc);
    $('scenarioName').value = '';
    $('savedMsg').textContent = t('savedMsg');
    $('savedMsg').hidden = false;
    save(); renderScenarios();
  }

  function doExport() { $('exportText').value = UPS.buildExportPayload(state.scenarios); }

  function doImport() {
    var res = UPS.parseImportPayload($('importText').value);
    $('importOk').hidden = true; $('importFail').hidden = true;
    if (!res.ok) { $('importFail').hidden = false; return; }
    state.scenarios = res.scenarios;
    save(); renderScenarios();
    $('importOk').hidden = false;
  }

  function doErase() {
    if ($('eraseInput').value !== 'DELETE') { $('eraseWrong').hidden = false; $('erasedMsg').hidden = true; return; }
    state.scenarios = [];
    $('eraseInput').value = '';
    $('eraseWrong').hidden = true;
    $('erasedMsg').hidden = false;
    save(); renderScenarios();
  }

  // ---- Language ----
  function applyLang() {
    document.documentElement.lang = state.lang === 'bn' ? 'bn' : 'en';
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
    $('langBtn').textContent = t('langBtn');
    renderSchemes(); renderChips(); renderTable(); renderScenarios(); recalc();
  }

  // ---- Test hooks ----
  window.__upbd = {
    state: state,
    exportPayload: function () { return UPS.buildExportPayload(state.scenarios); },
    importPayload: function (text) {
      var res = UPS.parseImportPayload(text);
      if (res.ok) { state.scenarios = res.scenarios; save(); renderScenarios(); }
      return res;
    },
    eraseAll: function () { state.scenarios = []; save(); renderScenarios(); },
  };

  // ---- Init ----
  load();
  if (state.monthly == null) state.monthly = currentScheme().options[0];
  $('ageInput').value = state.age === '' ? '' : String(state.age);
  $('amountInput').value = String(state.monthly);
  $('ageInput').addEventListener('input', recalc);
  $('amountInput').addEventListener('input', function () { renderChips(); recalc(); });
  $('saveBtn').addEventListener('click', saveScenario);
  $('exportBtn').addEventListener('click', doExport);
  $('importBtn').addEventListener('click', doImport);
  $('eraseBtn').addEventListener('click', doErase);
  $('langBtn').addEventListener('click', function () {
    state.lang = state.lang === 'en' ? 'bn' : 'en';
    save(); applyLang();
  });
  applyLang();
})();
