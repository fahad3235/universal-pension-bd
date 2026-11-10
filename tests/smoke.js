// universal-pension-bd -- headless-Chrome smoke test via raw CDP (no puppeteer).
// Usage: node tests/smoke.js
// Exits non-zero on any failed assertion; fails on page console errors.
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 9354;
const FILE = 'file://' + path.resolve(__dirname, '..', 'index.html');
let failures = 0;
let count = 0;
const pageErrors = [];
function check(name, cond, extra) {
  count++;
  console.log((cond ? 'ok - ' : 'FAIL - ') + name + (cond ? '' : ' :: ' + (extra || '')));
  if (!cond) failures++;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const CHROME_BIN = process.env.CHROME_BIN ||
    require('os').homedir() + '/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';
  const chrome = spawn(CHROME_BIN, [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + PORT, '--user-data-dir=/tmp/upbd-smoke-' + process.pid,
    'about:blank',
  ], { stdio: 'ignore' });
  let targets = [];
  for (let i = 0; i < 50 && targets.length === 0; i++) {
    await wait(200);
    try {
      targets = JSON.parse(await new Promise((res, rej) => {
        http.get('http://127.0.0.1:' + PORT + '/json/list', (r) => {
          let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(d));
        }).on('error', rej);
      }));
    } catch (e) { /* retry */ }
  }
  if (!targets.length) { console.log('FAIL - chrome did not start'); process.exit(2); }
  const wsUrl = targets[0].webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);
  await new Promise((res) => { ws.onopen = res; });
  let seq = 0; const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') {
      pageErrors.push('exception: ' + JSON.stringify(msg.params.exceptionDetails).slice(0, 300));
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      pageErrors.push('console.error: ' + JSON.stringify(msg.params.args).slice(0, 300));
    }
  };
  function send(method, params) {
    return new Promise((res) => {
      const id = ++seq;
      pending.set(id, res);
      ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: FILE });
  await wait(1500);
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) return { error: JSON.stringify(r.result.exceptionDetails).slice(0, 300) };
    return r.result ? r.result.result.value : undefined;
  };
  const BN = (s) => s.replace(/[0-9]/g, (d) => '\u09e6\u09e7\u09e8\u09e9\u09ea\u09eb\u09ec\u09ed\u09ee\u09ef'[+d]);
  const setAge = async (v) => ev(`document.getElementById('ageInput').value='${v}'; document.getElementById('ageInput').dispatchEvent(new Event('input'))`);
  const setAmt = async (v) => ev(`document.getElementById('amountInput').value='${v}'; document.getElementById('amountInput').dispatchEvent(new Event('input'))`);

  // ---- Initial state ----
  check('page title contains Universal Pension', (await ev('document.title'))?.includes('Universal Pension'));
  check('4 scheme cards', (await ev(`document.querySelectorAll('.scheme-card').length`)) === 4);
  check('empty calc visible initially', (await ev(`document.getElementById('emptyCalc').hidden`)) === false);
  check('results hidden initially', (await ev(`document.getElementById('results').hidden`)) === true);
  check('official table has 11 rows (3+4+1+3)', (await ev(`document.querySelectorAll('#officialBody tr').length`)) === 11);
  check('table shows published 1,72,327 for Progoti 5000/42y', (await ev(`document.getElementById('officialBody').textContent`)).includes('1,72,327'));
  check('table shows published 7,651 for 5000/10y', (await ev(`document.getElementById('officialBody').textContent`)).includes('7,651'));
  check('unpublished 10y cells show a dash, not a computed value', (await ev(`document.querySelectorAll('#officialBody tr')[1].children[3].textContent`)) === '\u2014');
  check('disclaimer mentions upension.gov.bd', (await ev(`document.querySelector('.disclaimer').textContent`)).includes('upension.gov.bd'));

  // ---- Validation ----
  await setAge(9); await setAmt(2000);
  check('age 9 shows error', (await ev(`document.getElementById('calcError').hidden`)) === false);
  await setAge(30); await setAmt(2600);
  check('2600 shows error (not a multiple of 500)', (await ev(`document.getElementById('calcError').hidden`)) === false);
  check('2600 error mentions 500', (await ev(`document.getElementById('calcError').textContent`)).includes('500'));
  await setAge(30); await setAmt(1500);
  check('1500 below Progoti minimum shows error', (await ev(`document.getElementById('calcError').hidden`)) === false);

  // ---- Calculation: Progoti, age 30, 2000/month ----
  await setAmt(2000);
  check('results visible after valid input', (await ev(`document.getElementById('results').hidden`)) === false);
  check('eligibility badge says Eligible', (await ev(`document.getElementById('eligBadge').textContent`)).includes('Eligible'));
  check('years = 30 years', (await ev(`document.getElementById('resYears').textContent`)) === '30 years');
  check('pension starts at 60', (await ev(`document.getElementById('resStartAge').textContent`)) === '60');
  check('pension starts in ' + (new Date().getFullYear() + 30), (await ev(`document.getElementById('resStartYear').textContent`)) === String(new Date().getFullYear() + 30));
  check('monthly pension is 21,438', (await ev(`document.getElementById('resPension').textContent`)).includes('21,438'));
  check('own total is 7,20,000', (await ev(`document.getElementById('resTotal').textContent`)).includes('7,20,000'));
  check('govt rows hidden for Progoti', (await ev(`document.getElementById('govtTotalRow').hidden`)) === true);

  // ---- Bengali toggle ----
  await ev(`document.getElementById('langBtn').click()`);
  check('BN toggle: title in Bengali', (await ev(`document.getElementById('title').textContent`)) === '\u09b8\u09be\u09b0\u09cd\u09ac\u099c\u09a8\u09c0\u09a8 \u09aa\u09c7\u09a8\u09b6\u09a8 \u0995\u09cd\u09af\u09be\u09b2\u0995\u09c1\u09b2\u09c7\u099f\u09b0');
  check('BN toggle: pension in Bengali digits', (await ev(`document.getElementById('resPension').textContent`)).includes(BN('21,438')));
  check('BN toggle: years in Bengali', (await ev(`document.getElementById('resYears').textContent`)) === BN('30') + ' \u09ac\u099b\u09b0');
  await send('Page.navigate', { url: FILE });
  await wait(1200);
  check('BN toggle persists after reload', (await ev(`window.__upbd.state.lang`)) === 'bn');
  await ev(`document.getElementById('langBtn').click()`);
  check('back to EN', (await ev(`window.__upbd.state.lang`)) === 'en');

  // ---- Age 18, Surokkha 1000 -> published 42y anchor 34,465 ----
  await ev(`document.querySelectorAll('.scheme-card')[1].click()`);
  await ev(`document.querySelectorAll('#amountChips .chip')[0].click()`);
  await setAge(18);
  check('Surokkha 18y 1000/mo pension is 34,465', (await ev(`document.getElementById('resPension').textContent`)).includes('34,465'));
  check('Surokkha 18y years = 42 years', (await ev(`document.getElementById('resYears').textContent`)) === '42 years');

  // ---- Over-50 rule: age 55, Probash 10000 -> 10y, start 65, pension 15,302 ----
  await ev(`document.querySelectorAll('.scheme-card')[3].click()`);
  await ev(`document.querySelectorAll('#amountChips .chip')[2].click()`);
  await setAge(55);
  check('over-50 badge mentions special rule', (await ev(`document.getElementById('eligBadge').textContent`)).toLowerCase().includes('special'));
  check('over-50 years = 10 years', (await ev(`document.getElementById('resYears').textContent`)) === '10 years');
  check('over-50 pension starts at 65', (await ev(`document.getElementById('resStartAge').textContent`)) === '65');
  check('over-50 pension is 15,302', (await ev(`document.getElementById('resPension').textContent`)).includes('15,302'));

  // ---- Somota: fixed 1000, govt match rows visible ----
  await ev(`document.querySelectorAll('.scheme-card')[2].click()`);
  await setAge(18);
  check('Somota amount input disabled', (await ev(`document.getElementById('amountInput').disabled`)) === true);
  check('Somota amount is 1000', (await ev(`document.getElementById('amountInput').value`)) === '1000');
  check('Somota govt rows visible', (await ev(`document.getElementById('govtTotalRow').hidden`)) === false);
  check('Somota own total 2,52,000', (await ev(`document.getElementById('resOwnTotal').textContent`)).includes('2,52,000'));
  check('Somota govt total 2,52,000', (await ev(`document.getElementById('resGovtTotal').textContent`)).includes('2,52,000'));
  check('Somota pension 34,465', (await ev(`document.getElementById('resPension').textContent`)).includes('34,465'));

  // ---- Save / export / import / erase ----
  await ev(`document.getElementById('scenarioName').value='My Somota'; document.getElementById('saveBtn').click()`);
  check('saved scenario appears in list', (await ev(`document.querySelectorAll('#scenarioList li').length`)) === 1);
  check('saved message shows', (await ev(`document.getElementById('savedMsg').hidden`)) === false);
  await send('Page.navigate', { url: FILE });
  await wait(1200);
  check('scenario persists after reload', (await ev(`document.querySelectorAll('#scenarioList li').length`)) === 1);
  const payload = await ev(`window.__upbd.exportPayload()`);
  check('export payload is universal-pension-bd v1', payload.includes('"app": "universal-pension-bd"') && payload.includes('"version": 1'), payload);
  check('export payload carries Somota scenario', payload.includes('My Somota'));
  await ev(`window.__upbd.eraseAll()`);
  check('eraseAll clears scenarios', (await ev(`document.querySelectorAll('#scenarioList li').length`)) === 0);
  const imp = await ev(`JSON.stringify(window.__upbd.importPayload(${JSON.stringify(payload)}))`);
  check('import valid payload ok', imp.includes('"ok":true'), imp);
  check('import restores scenario', (await ev(`document.querySelectorAll('#scenarioList li').length`)) === 1);
  const badImp = await ev(`JSON.stringify(window.__upbd.importPayload('{"app":"bus-fare-bd","version":1}'))`);
  check('import wrong app rejected', badImp.includes('"ok":false'));
  check('invalid import leaves data intact', (await ev(`window.__upbd.exportPayload()`)).includes('My Somota'));
  const badJson = await ev(`JSON.stringify(window.__upbd.importPayload('{not json'))`);
  check('malformed JSON rejected', badJson.includes('"ok":false'));

  // ---- Typed-DELETE erase via UI; wrong word rejected ----
  await ev(`document.getElementById('eraseInput').value='delete'; document.getElementById('eraseBtn').click();`);
  check('wrong erase word rejected', (await ev(`document.getElementById('eraseWrong').hidden`)) === false);
  check('wrong erase keeps data', (await ev(`window.__upbd.exportPayload()`)).includes('My Somota'));
  await ev(`document.getElementById('eraseInput').value='DELETE'; document.getElementById('eraseBtn').click();`);
  check('DELETE erases data', (await ev(`window.__upbd.exportPayload()`)).includes('"scenarios": []'));
  check('erase success message shows', (await ev(`document.getElementById('erasedMsg').hidden`)) === false);

  // ---- Mobile 390px: no horizontal overflow ----
  await setAge(30);
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Page.navigate', { url: FILE });
  await wait(1200);
  const overflow = await ev(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
  check('390px no horizontal overflow', overflow <= 0, 'overflow=' + overflow);

  // ---- Zero network requests: app is fully offline (only file:// loads) ----
  const reqs = await ev(`performance.getEntriesByType('resource').map(r => r.name).filter(n => !n.startsWith('file://')).length`);
  check('zero non-file network requests', reqs === 0, 'non-file=' + reqs);

  check('no console/page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  chrome.kill();
  console.log('\n' + count + ' checks, ' + failures + ' failed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL - harness error: ' + e.message); try { chrome.kill(); } catch (_) {} process.exit(2); });
