const puppeteer = require('puppeteer-core'), XLSX = require('xlsx'), fs = require('fs'), path = require('path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  fs.mkdirSync('dl', { recursive: true }); fs.mkdirSync('shots', { recursive: true });
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 1366, height: 800 } });
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  const cdp = await page.createCDPSession(); await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: path.resolve('dl') });
  await page.goto('http://localhost:8765/index.html', { waitUntil: 'networkidle2' });
  await page.evaluate(() => { localStorage.clear(); }); await page.reload({ waitUntil: 'networkidle2' });
  await page.evaluate(() => { LW.S.settings.quick = true; LW.refreshAll(); });
  await page.screenshot({ path: 'shots/idle.png' });

  const res = await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms)), S = LW.S, out = { fail: [], rows: 0 };
    const waitFor = async sel => { for (let t = 0; t < 1200; t++) { const e = document.querySelector(sel); if (e) return e; await sleep(50); } return null; };
    for (let i = 0; i < 22; i++) {
      S.settings.mode = i < 12 ? 'person-first' : 'prize-first'; LW.refreshAll();
      const before = {}; S.prizes.forEach(p => before[p.id] = p.qty);
      document.querySelector('#btnSpin').click(); document.querySelector('#btnSpin').click(); LW.startDraw();
      const card = await waitFor('.invite'); if (!card) { out.fail.push('no card ' + i); break; }
      const announced = card.querySelector('.inv-prize').textContent, info = LW.Wheel.sliceInfo(LW.Wheel.domSliceUnderPointer());
      if (S.prizes[info.pi].name !== announced) out.fail.push(`spin ${i}: announced "${announced}" vs pointer "${S.prizes[info.pi].name}"`);
      if (document.querySelectorAll('.invite').length !== 1) out.fail.push('multiple cards');
      card.querySelector('[data-a=confirm]').click(); await sleep(200);
      const pr = S.prizes.find(p => p.name === announced); if (before[pr.id] - pr.qty !== 1) out.fail.push(`qty ${i}`);
      out.rows++;
    }
    const ids = S.history.map(h => h.empId); out.unique = new Set(ids).size === ids.length; out.hist = S.history.length; return out;
  });
  ok(res.rows === 22 && !res.fail.length, `22 spins: pointer == announced, qty -1 each (${res.fail.join('; ') || 'no mismatches'})`);
  ok(res.unique && res.hist === 22, `no duplicate winners (${res.hist} history rows)`);

  await page.evaluate(() => { LW.S.settings.quick = false; LW.S.settings.mode = 'prize-first'; LW.startDraw(); });
  await sleep(6500); await page.screenshot({ path: 'shots/suspense.png' });
  await page.waitForSelector('.invite', { timeout: 40000 }); await sleep(1500); await page.screenshot({ path: 'shots/card.png' });
  await page.evaluate(() => document.querySelector('[data-a=redraw]').click()); await page.waitForSelector('.invite', { timeout: 40000 });
  await page.evaluate(() => document.querySelector('[data-a=discard]').click()); await sleep(500);
  const st = await page.evaluate(() => ({ busy: LW.busy, hist: LW.S.history.length })); ok(!st.busy && st.hist === 22, 'redraw + discard leaves state untouched');
  await page.evaluate(() => { LW.S.settings.quick = true; });

  await page.evaluate(() => { LW.S.prizes.forEach(p => { p.rate = p.name.startsWith('Toyota') ? 100 : 0; }); LW.S.settings.mode = 'person-first'; LW.refreshAll(); LW.startDraw(); });
  await sleep(4800); await page.screenshot({ path: 'shots/jackpot.png' });
  await page.waitForSelector('.invite', { timeout: 40000 }); await page.evaluate(() => document.querySelector('[data-a=confirm]').click()); await sleep(300);
  ok(await page.evaluate(() => LW.S.prizes[0].qty === 0), 'jackpot prize consumed, stock 1 -> 0');
  const msg = await page.evaluate(() => { LW.startDraw(); return [...document.querySelectorAll('.toast')].pop().textContent; });
  ok(/0% rate/.test(msg), 'only 0%-rate prizes left -> friendly message: ' + msg);

  await page.evaluate(() => { LW.S.prizes.forEach(p => p.rate = 1); const p = LW.S.prizes[7]; LW.S.settings.prizeChoice = String(p.id); LW.S.settings.mode = 'group'; LW.S.settings.groupSize = 10; LW.refreshAll(); });
  const q0 = await page.evaluate(() => LW.S.prizes[7].qty); await page.evaluate(() => { LW.startDraw(); });
  await page.waitForSelector('.invite.wide', { timeout: 40000 }); await sleep(900); await page.screenshot({ path: 'shots/group.png' });
  ok(await page.evaluate(() => document.querySelectorAll('#gBody tr').length === 10), 'group card lists 10 winners');
  await page.evaluate(() => { document.querySelector('#gBody input').click(); document.querySelector('[data-a=redraw]').click(); });
  await sleep(300); const same = await page.evaluate(() => document.querySelectorAll('#gBody tr').length);
  await page.evaluate(() => document.querySelector('[data-a=confirm]').click()); await sleep(300);
  const q1 = await page.evaluate(() => LW.S.prizes[7].qty); ok(q0 - q1 === 10 && same === 10, `group confirm: stock ${q0} -> ${q1}`);
  ok(await page.evaluate(() => { const i = LW.S.history.map(h => h.empId); return i.length === new Set(i).size; }), 'still no duplicate winners after group');

  const before = await page.evaluate(() => JSON.stringify([LW.S.history.length, LW.S.prizes.map(p => p.qty)]));
  await page.reload({ waitUntil: 'networkidle2' });
  ok(before === await page.evaluate(() => JSON.stringify([LW.S.history.length, LW.S.prizes.map(p => p.qty)])), 'state survives refresh');

  async function importFile(btn, file) {
    const [fc] = await Promise.all([page.waitForFileChooser(), page.click(btn)]); await fc.accept([path.resolve(file)]); await sleep(700);
  }
  await page.evaluate(() => document.querySelector('[data-tab=tools]').click());
  const t0 = Date.now(); await importFile('#btnImpPeople', 'sample-participants.xlsx');
  const prev = await page.evaluate(() => document.querySelector('.dlg .imp-sum').textContent); ok(/300/.test(prev), 'preview shows 300 valid rows: ' + prev.replace(/\s+/g, ' '));
  await page.evaluate(() => [...document.querySelectorAll('.dlg .btn')].find(b => /^Import/.test(b.textContent)).click()); await sleep(300);
  ok(await page.evaluate(() => LW.S.participants.length) === 300, `300 participants imported in ${Date.now() - t0} ms`);
  const thai = await page.evaluate(() => LW.S.participants.find(p => /[\u0E00-\u0E7F]/.test(p.name)).name); ok(thai.length > 3, 'Thai name kept: ' + thai);
  await page.evaluate(() => document.querySelector('[data-tab=people]').click());
  await page.type('#pSearch', 'EMP0300'); await sleep(400); ok(await page.evaluate(() => document.querySelectorAll('#peopleBody tr').length) === 1, 'search by ID works');
  await page.screenshot({ path: 'shots/people.png' });
  await page.evaluate(() => document.querySelector('[data-tab=tools]').click());
  await importFile('#btnImpPrize2', 'sample-prizes.xlsx'); await page.evaluate(() => [...document.querySelectorAll('.dlg .btn')].find(b => /^Import/.test(b.textContent)).click()); await sleep(300);
  ok(await page.evaluate(() => LW.S.prizes.length === 8 && Math.abs(LW.S.prizes.reduce((s, p) => s + p.rate, 0) - 100) < 1e-9), 'prize import: 8 prizes sum 100%');

  const mk = (name, rows) => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'S'); XLSX.writeFile(wb, name); };
  mk('bad-headers.xlsx', [['Foo', 'Bar'], [1, 2]]); mk('empty.xlsx', [[]]);
  mk('messy.xlsx', [['Employee ID', 'Full Name', 'Department'], ['A1', 'สมชาย', 'IT'], [], ['A1', 'dup', 'IT'], ['A3', '', 'IT'], ['', '', ''], ['A4', 'นางสาว ทดสอบ', '']]);
  fs.writeFileSync('notexcel.xlsx', 'hello world');
  await importFile('#btnImpPeople', 'bad-headers.xlsx'); let t = await page.evaluate(() => document.querySelector('.dlg').textContent); ok(/Wrong file format/.test(t), 'wrong headers -> friendly message'); await page.evaluate(() => document.querySelector('.dlg .btn').click());
  await importFile('#btnImpPeople', 'empty.xlsx'); t = await page.evaluate(() => [...document.querySelectorAll('.toast')].pop()?.textContent); ok(/empty/i.test(t), 'empty file -> ' + t);
  await importFile('#btnImpPeople', 'notexcel.xlsx'); await sleep(300); t = await page.evaluate(() => [...document.querySelectorAll('.toast')].pop()?.textContent || ''); console.log('   corrupt file message:', t);
  await page.evaluate(() => document.querySelectorAll('.ov').forEach(e => e.remove()));
  await importFile('#btnImpPeople', 'messy.xlsx'); t = await page.evaluate(() => document.querySelector('.dlg').textContent); ok(/Valid rows: 2/.test(t) && /duplicate/.test(t), 'messy file: 2 valid, duplicates/empties reported'); await page.evaluate(() => document.querySelector('.dlg .btn').click());

  await page.evaluate(() => document.querySelector('[data-tab=winners]').click()); await page.click('#btnExport'); await sleep(1500);
  const files = fs.readdirSync('dl'); ok(files.some(f => /^Lucky_Draw_Results_\d{4}-\d{2}-\d{2}\.xlsx$/.test(f)), 'export file name: ' + files.join(','));
  const wb = XLSX.readFile(path.join('dl', files[0])), rows = XLSX.utils.sheet_to_json(wb.Sheets.Results, { header: 1 });
  console.log(rows.slice(0, 3)); ok(rows[0].join('|') === 'No.|Date/Time|Employee ID|Winner Name|Department|Prize|Prize Rate (%)', 'export headers correct');
  ok(rows.some(r => /[\u0E00-\u0E7F]/.test(r[3] + r[5])), 'Thai text present in exported file');
  await page.evaluate(() => document.querySelector('[data-tab=prizes]').click()); await page.click('#btnSim'); await sleep(500);
  await page.screenshot({ path: 'shots/sim.png' }); console.log(await page.evaluate(() => document.querySelector('.dlg .banner').textContent));
  await page.evaluate(() => document.querySelectorAll('.ov').forEach(e => e.remove()));
  await page.screenshot({ path: 'shots/final.png' });
  console.log('\nconsole/page errors:', errs.length ? errs : 'NONE'); ok(!errs.some(e => /pageerror|Wheel alignment/.test(e)), 'no JS errors');
  await browser.close(); console.log(fails ? fails + ' FAILED' : 'ALL E2E PASSED');
})().catch(e => { console.error(e); process.exit(1); });
