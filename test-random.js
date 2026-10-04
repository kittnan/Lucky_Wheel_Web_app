// Node test for the REAL random engine: extracts the ENGINE block straight out of index.html.
const fs = require('fs'), vm = require('vm'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/\/\* ==== ENGINE:START ==== \*\/([\s\S]*?)\/\* ==== ENGINE:END ==== \*\//);
if (!m) throw new Error('Engine block not found');
const ctx = { crypto: require('crypto').webcrypto, console, Math };
vm.createContext(ctx);
vm.runInContext(m[1] + '\nthis.Engine=Engine;this.RATE_SCALE=RATE_SCALE;', ctx);
const E = ctx.Engine;
let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };

function run(title, prizes, N, ignoreQty) {
  console.log(`\n== ${title}  (${N.toLocaleString()} draws) ==`);
  const live = E.liveRates(prizes, ignoreQty), counts = prizes.map(() => 0);
  for (let i = 0; i < N; i++) { const k = E.pickPrize(prizes, ignoreQty); counts[k >= 0 ? k : 0]++; }
  console.log('Prize'.padEnd(18), 'Set%'.padStart(9), 'Expected'.padStart(10), 'Observed'.padStart(10), 'Obs%'.padStart(9), 'z'.padStart(7));
  prizes.forEach((p, i) => {
    if (live[i] === 0) { check(counts[i] === 0, `${p.name} (unavailable) never drawn`); return; }
    const pr = live[i] / 100, exp = N * pr, sd = Math.sqrt(N * pr * (1 - pr)), z = (counts[i] - exp) / sd;
    console.log(p.name.padEnd(18), live[i].toFixed(4).padStart(9), exp.toFixed(0).padStart(10), String(counts[i]).padStart(10), (counts[i] / N * 100).toFixed(4).padStart(9), z.toFixed(2).padStart(7));
    check(Math.abs(z) < 4, `${p.name}: |z| = ${Math.abs(z).toFixed(2)} < 4`);
  });
}
const P = [
  { name: 'Grand 0.01%', qty: 1, rate: 0.01 }, { name: 'Big 0.5%', qty: 3, rate: 0.5 }, { name: 'Gold 1.5%', qty: 5, rate: 1.5 },
  { name: 'Cash 3%', qty: 10, rate: 3 }, { name: 'TV 5%', qty: 10, rate: 5 }, { name: 'Voucher 10%', qty: 40, rate: 10 },
  { name: 'Mug 30%', qty: 100, rate: 30 }, { name: 'Gift 49.99%', qty: 200, rate: 49.99 }];
run('Demo rates', P, 1000000);
// depletion: Grand + Cash sold out → others rescale proportionally
const Q = P.map(p => ({ ...p })); Q[0].qty = 0; Q[3].qty = 0;
const lr = E.liveRates(Q), tot = 100 - 0.01 - 3;
check(Math.abs(lr[7] - 49.99 / tot * 100) < 1e-9, 'rescaled live rate of Gift = ' + lr[7].toFixed(4) + '%');
check(Math.abs(lr.reduce((a, b) => a + b, 0) - 100) < 1e-9, 'live rates still sum to 100');
run('After depletion', Q, 1000000);
run('Fine decimals 0.07 / 0.03 / 99.9', [{ name: 'a 0.07', qty: 1, rate: 0.07 }, { name: 'b 0.03', qty: 1, rate: 0.03 }, { name: 'c 99.9', qty: 1, rate: 99.9 }], 1000000);
run('Rates not summing to 100 (relative)', [{ name: 'x 1', qty: 1, rate: 1 }, { name: 'y 3', qty: 1, rate: 3 }], 500000);
check(E.pickPrize([{ qty: 0, rate: 5 }]) === -1, 'no stock → -1');
check(E.pickPrize([{ qty: 5, rate: 0 }]) === -1, 'rate 0 → -1');
check(E.pickPrize([]) === -1, 'empty → -1');
// randInt uniformity (non power of two → rejection sampling)
for (const n of [3, 7, 300, 1000003]) {
  const N = 600000, c = new Array(Math.min(n, 300)).fill(0); let bad = 0;
  for (let i = 0; i < N; i++) { const v = E.randInt(n); if (v < 0 || v >= n) bad++; if (n <= 300) c[v]++; }
  check(bad === 0, `randInt(${n}) stays in range`);
  if (n <= 300) { const e = N / n; let chi = 0; c.forEach(x => chi += (x - e) ** 2 / e); const df = n - 1; check(chi < df + 5 * Math.sqrt(2 * df), `randInt(${n}) chi2=${chi.toFixed(1)} (df ${df})`); }
}
// pickMany: distinct + fair
const list = Array.from({ length: 300 }, (_, i) => i), hits = new Array(300).fill(0);
let dupe = 0; for (let t = 0; t < 30000; t++) { const s = E.pickMany(list, 10); if (new Set(s).size !== 10) dupe++; s.forEach(x => hits[x]++); }
check(dupe === 0, 'pickMany returns distinct people');
const e = 30000 * 10 / 300, mx = Math.max(...hits.map(h => Math.abs(h - e) / Math.sqrt(e)));
check(mx < 5, `pickMany fairness, worst z = ${mx.toFixed(2)}`);
check(E.pickMany([1, 2], 10).length === 2, 'pickMany clamps to list size');
// autoBalance
const ab = E.autoBalance([10, 20, 30.5, 0]); check(Math.abs(ab.reduce((a, b) => a + b, 0) - 100) < 1e-9, 'autoBalance sums to 100: ' + ab.join(', '));
check(E.autoBalance([0, 0]) === null, 'autoBalance with all zeros → null');
console.log(fails ? `\n${fails} FAILED` : '\nALL TESTS PASSED'); process.exit(fails ? 1 : 0);
