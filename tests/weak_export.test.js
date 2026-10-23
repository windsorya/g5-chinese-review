// 錯題站讀「國語 app 待加強題數」的 weak-export.js（交辦 #4027；介面＝g5-wrong-review docs/app-weak-entry-design-20261019.md 第 2 節）。
// 擋：①錯題站看到的待加強與首頁各單元「練待加強的」實際會出的題不是同一群 ②考不到（out）、考古挑戰（challenge）混進 weak
// ③今天練過的算進今天可練 ④讀不懂的存檔回數字 ⑤欄位不是非負整數或不等式不成立 ⑥載入時新增全域、碰 localStorage、不是同步註冊一次。
// 存檔全是合成資料（真實題庫 id＋亂數作答狀態），不用任何真實存檔。執行：node --test tests/weak_export.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const C = require("../src/core.js");
const MB = require("../src/chibank.js");

const ROOT = path.join(__dirname, "..");
const CODE = fs.readFileSync(path.join(ROOT, "weak-export.js"), "utf8");
const NOON = (d) => Date.parse(d + "T12:00:00+08:00");
const TODAY = "2026-10-24", NOW = NOON(TODAY);
const FIELDS = ["answers", "seen", "weak", "weakToday", "challenge", "challengeToday", "out"];

// 首頁改版前的題庫組法與 unitCards（git show bb58392:src/app.html 第 337–344、563 行照抄）：bankFrom／unitIds 必須和它一模一樣
function oldAppBank() {
  const ALL = MB.ALL_GENERATED || MB.ALL_CARDS || MB.CARDS, ACTIVE = {}, OUT = {}, R = MB.RETIRED || {};
  MB.CARDS.forEach((c) => { ACTIVE[c.id] = 1; });
  Object.keys(R).forEach((id) => { if (R[id] && R[id].kind === "out") OUT[id] = 1; });
  const B = { cards: ALL, active: ACTIVE, out: OUT, concepts: {}, figs: {} };
  Object.keys(MB.CONCEPTS).forEach((k) => { B.concepts[k] = { unit: MB.CONCEPTS[k].unit }; });
  return B;
}
const oldUnitCards = (s, B, day, u) => C.poolCards(s, B, day).filter((c) => MB.CONCEPTS[c.concept].unit === u && C.conceptOn(s, B, c.concept)).map((c) => c.id);

// 用錯題站的方式載入：classic script、替身註冊函式接住物件；localStorage 一碰就記下來
function load(opts) {
  opts = opts || {};
  const calls = [], touched = [];
  const ctx = {};
  if (!opts.noRegister) ctx.G5WeakExportRegister = function (x) { calls.push(x); };
  Object.defineProperty(ctx, "localStorage", { get() { touched.push("localStorage"); throw new Error("不得碰 localStorage"); }, configurable: true, enumerable: true });
  ctx.window = ctx;
  vm.createContext(ctx);
  const before = Object.getOwnPropertyNames(ctx).sort();
  new vm.Script(CODE, { filename: "weak-export.js" }).runInContext(ctx);   // vm.Script＝classic script（有 import／export 會語法錯）
  const after = Object.getOwnPropertyNames(ctx).sort();
  return { calls, touched, before, after, ctx };
}

// 亂數合成存檔：每張卡隨機成「沒做過／待加強（從沒答對、needsRecheck）／學會一半／畢業」，部分今天練過，加考不到與停出的題
function rng(seed) { let x = seed >>> 0; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; }
function synth(seed, B) {
  const r = rng(seed), s = C.blankState(), days = ["2026-10-18", "2026-10-20", "2026-10-22", TODAY];
  s.days[TODAY] = { planIds: [], doneIds: [], touched: [], extraDone: false, labRuns: 0, teach: 0, mood: null };
  s.settings.unit3 = r() < 0.5;
  const ids = B.cards.map((c) => c.id);
  ids.forEach((id) => {
    const p = r();
    if (p < 0.3) return;   // 沒做過
    const seen = 1 + Math.floor(r() * 4);
    let cs;
    if (p < 0.55) cs = { seen, goodDays: [], blockedDay: r() < 0.5 ? "2026-10-22" : null, due: "2026-10-25" };
    else if (p < 0.65) cs = { seen, goodDays: ["2026-10-18"], blockedDay: null, due: "2026-10-23", needsRecheck: true };
    else if (p < 0.85) cs = { seen, goodDays: ["2026-10-20"], blockedDay: null, due: "2026-10-23" };
    else cs = { seen, goodDays: ["2026-10-18", "2026-10-22"], blockedDay: null, due: null };
    s.cards[id] = cs;
    const c = B.cards.find((x) => x.id === id);
    for (let k = 0; k < seen; k++) s.log.push({ op: "o" + id + k, d: days[Math.floor(r() * days.length)], card: id, c: c.concept, ok: r() < 0.6, hint: false, unsure: false, variation: false, first: k === 0 });
    if (r() < 0.25) s.days[TODAY].touched.push(id);   // 今天練過
  });
  // 一定要有：考不到的待加強、停出（MERGED）但練過的待加強、今天練過的待加強
  Object.keys(MB.RETIRED).slice(0, 3).forEach((id) => { s.cards[id] = { seen: 2, goodDays: [], blockedDay: null, due: "2026-10-25" }; });
  Object.keys(MB.MERGED).slice(0, 2).forEach((id) => { s.cards[id] = { seen: 1, goodDays: [], blockedDay: null, due: "2026-10-25" }; });
  const w = ids.filter((id) => s.cards[id] && !s.cards[id].goodDays.length && !B.out[id]);
  w.slice(0, 2).forEach((id) => { if (s.days[TODAY].touched.indexOf(id) < 0) s.days[TODAY].touched.push(id); });
  s.log = s.log.slice(-600);
  assert.deepEqual(C.checkState(s, B), [], "合成存檔本身要合法（seed " + seed + "）");
  return s;
}
const exp = () => load().calls[0];
const plain = (o) => JSON.parse(JSON.stringify(o));   // vm 另一個 realm 的物件：比內容不比原型
const SEEDS = [1, 2, 3, 7, 42, 2026, 4027, 99991];

test("載入：classic script 同步註冊恰好一次、key＝g5chi.v1、api 1、links 為 null；沒有新增全域、沒碰 localStorage", () => {
  const L = load();
  assert.equal(L.calls.length, 1, "要在執行期間同步註冊一次");
  const x = L.calls[0];
  assert.equal(x.api, 1); assert.equal(x.key, "g5chi.v1"); assert.equal(x.key, C.LS_KEY);
  assert.equal(typeof x.summarize, "function");
  assert.deepEqual(plain(x.links), { weak: null, challenge: null });
  assert.deepEqual(L.after, L.before, "載入後全域多了或少了東西");
  assert.equal(L.ctx.G5Core, undefined); assert.equal(L.ctx.G5ChiBank, undefined);
  SEEDS.slice(0, 3).forEach((sd) => x.summarize(JSON.stringify(synth(sd, C.bankFrom(MB))), NOW));
  x.summarize("壞掉", NOW);
  assert.deepEqual(L.touched, [], "載入或 summarize 碰了 localStorage");
  assert.deepEqual(Object.getOwnPropertyNames(L.ctx).sort(), L.before, "summarize 之後全域變了");
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|setItem\(|WebSocket/.test(fs.readFileSync(path.join(ROOT, "src", "weakexport.js"), "utf8")), "接線檔不得連網或寫入");
});

test("載入：不是被錯題站載入（沒有註冊函式）＝什麼都不做、不丟例外、不留全域", () => {
  const L = load({ noRegister: true });
  assert.equal(L.calls.length, 0);
  assert.deepEqual(L.after, L.before);
  assert.deepEqual(L.touched, []);
});

test("同一份程式：bankFrom、unitIds 與首頁改版前的題庫組法、unitCards 逐題相同；首頁與 weak-export.js 都用它們", () => {
  const B = C.bankFrom(MB), O = oldAppBank();
  assert.deepEqual(B, O);
  const s = synth(5, B);
  Object.keys(MB.UNITS).forEach((u) => assert.deepEqual(C.unitIds(s, B, TODAY, u), oldUnitCards(s, O, TODAY, u), "單元 " + u));
  const app = fs.readFileSync(path.join(ROOT, "src", "app.html"), "utf8");
  assert.ok(/var BANK = C\.bankFrom\(MB\)/.test(app), "首頁題庫不是由 core.js bankFrom 組");
  assert.ok(/function unitCards\(unit\)\{return C\.unitIds\(S\(\),BANK,V\(\)\.today,unit\);\}/.test(app), "首頁單元題不是 core.js unitIds");
  assert.ok(app.includes('startReview(b.dataset.rvweak,"weak")'), "首頁「練待加強的」按鈕接線變了，請重查 weakSummary 是否仍是同一群");
  const lib = ["src/chibank.js", "src/core.js"].map((f) => fs.readFileSync(path.join(ROOT, f), "utf8"));
  lib.forEach((t, i) => assert.ok(CODE.includes(t), ["chibank.js", "core.js"][i] + " 沒有原文內嵌進 weak-export.js（改了 src 沒 build？）"));
});

test("①weak＝各單元「練待加強的」會出的那一群（不管今天練過沒）、weakToday＝今天開局會出的：逐題對照，8 份合成存檔", () => {
  const B = C.bankFrom(MB), x = exp();
  SEEDS.forEach((sd) => {
    const s = synth(sd, B), raw = JSON.stringify(s), got = x.summarize(raw, NOW);
    const units = Object.keys(MB.UNITS);
    // 首頁實際出題：每個單元 reviewPick(…, "weak", 今天)；不管今天練過沒＝同一判準、沒有「今天」
    const served = new Set(), ever = new Set();
    let shownWeak = 0, shownNow = 0;
    units.forEach((u) => {
      const ids = oldUnitCards(s, oldAppBank(), TODAY, u);
      C.reviewPick(s, B, ids, "weak", TODAY).forEach((id) => served.add(id));
      C.reviewPick(s, B, ids, "weak", null).forEach((id) => ever.add(id));
      const st = C.reviewCounts(s, B, ids, TODAY); shownWeak += st.weak; shownNow += st.weakNow;   // 首頁每個單元顯示的「待加強 N 題」
    });
    const w = C.weakSummary(s, B, units, MB.RETIRED, TODAY);
    assert.deepEqual(new Set(w.weakNow), served, "seed " + sd + " 今天可練的和首頁出題不同");
    assert.deepEqual(new Set(w.weak), ever, "seed " + sd + " 待加強的群和首頁不同");
    assert.equal(got.weak, ever.size); assert.equal(got.weakToday, served.size);
    assert.equal(got.weak, shownWeak, "和首頁各單元顯示的待加強加總不同");
    assert.equal(got.weakToday, shownNow, "和首頁各單元「練待加強的」可練加總不同");
    assert.ok(got.weak > got.weakToday, "合成存檔要同時有今天練過與沒練過的待加強（seed " + sd + "）");
  });
});

test("②out 不進 weak、另算 out；停出（MERGED）但練過的待加強照首頁一樣算；challenge 不進 weak", () => {
  const B = C.bankFrom(MB), x = exp();
  SEEDS.forEach((sd) => {
    const s = synth(sd, B), got = x.summarize(JSON.stringify(s), NOW);
    const w = C.weakSummary(s, B, Object.keys(MB.UNITS), MB.RETIRED, TODAY);
    const outs = Object.keys(MB.RETIRED).filter((id) => MB.RETIRED[id].kind === "out" && s.cards[id] && C.weakCard(s.cards[id]) && C.conceptOn(s, B, C.cardById(s, B, id).concept));
    assert.ok(outs.length >= 1, "合成存檔要有考不到的待加強");
    assert.equal(got.out, outs.length);
    assert.deepEqual(w.weak.filter((id) => B.out[id]), [], "考不到的題進了 weak");
    const merged = Object.keys(MB.MERGED).filter((id) => s.cards[id] && C.weakCard(s.cards[id]) && C.conceptOn(s, B, C.cardById(s, B, id).concept));
    assert.ok(merged.length >= 1, "合成存檔要有停出但練過的待加強");
    merged.forEach((id) => assert.ok(w.weak.includes(id), "停出但練過的待加強 " + id + " 首頁照樣會出，應算進 weak"));
  });
  // 國語站目前沒有考古挑戰：challenge 一律 0；有一天加了 kind:"challenge" 就分出去、不進 weak（用改過的停出名單驗）
  assert.deepEqual(Object.keys(MB.RETIRED).filter((id) => MB.RETIRED[id].kind === "challenge"), [], "chibank 有 challenge 了：請確認首頁「練待加強的」是否排除它，再改這條");
  const s = synth(11, B), got = x.summarize(JSON.stringify(s), NOW);
  assert.equal(got.challenge, 0); assert.equal(got.challengeToday, 0);
  const w0 = C.weakSummary(s, B, Object.keys(MB.UNITS), MB.RETIRED, TODAY), pickCh = w0.weak.slice(0, 3);
  const R2 = Object.assign({}, MB.RETIRED); pickCh.forEach((id) => { R2[id] = { kind: "challenge", why: "測試" }; });
  const w2 = C.weakSummary(s, B, Object.keys(MB.UNITS), R2, TODAY);
  assert.deepEqual(w2.challenge.slice().sort(), pickCh.slice().sort());
  assert.deepEqual(w2.weak.filter((id) => pickCh.includes(id)), [], "challenge 進了 weak");
  assert.equal(w2.weak.length + w2.challenge.length, w0.weak.length);
});

test("③今天練過的不算 weakToday：把一題待加強標成今天練過，weak 不變、weakToday 少 1；換到明天又算", () => {
  const B = C.bankFrom(MB), x = exp(), s = synth(3, B);
  const before = x.summarize(JSON.stringify(s), NOW);
  const id = C.weakSummary(s, B, Object.keys(MB.UNITS), MB.RETIRED, TODAY).weakNow[0];
  assert.ok(id, "要有今天可練的待加強");
  s.days[TODAY].touched.push(id);
  const after = x.summarize(JSON.stringify(s), NOW);
  assert.equal(after.weak, before.weak); assert.equal(after.weakToday, before.weakToday - 1);
  const tomorrow = x.summarize(JSON.stringify(s), NOON("2026-10-25"));
  assert.equal(tomorrow.weak, before.weak); assert.equal(tomorrow.weakToday, tomorrow.weak, "明天沒有今天練過的，全部可練");
  // 台北日界：同一天 23:59 還算今天練過，隔天 00:00 就可練
  assert.equal(x.summarize(JSON.stringify(s), Date.parse("2026-10-24T23:59:00+08:00")).weakToday, after.weakToday);
  assert.equal(x.summarize(JSON.stringify(s), Date.parse("2026-10-25T00:00:00+08:00")).weakToday, tomorrow.weakToday);
});

test("④讀不懂回 {ok:false}：壞 JSON、空字串、別科格式、版本不對、欄位壞、非字串、時間不是數字；不丟例外", () => {
  const x = exp(), B = C.bankFrom(MB), good = synth(2, B);
  const bad = (o) => JSON.stringify(Object.assign(JSON.parse(JSON.stringify(good)), o));
  const cases = {
    "壞 JSON": "{", "空字串": "", "null 字面": "null", "陣列": "[]", "數字": "3",
    "v1 舊格式": JSON.stringify({ v: 1, cards: {} }), "v5": bad({ v: 5 }), "cards 不是物件": bad({ cards: [] }),
    "卡片 seen 負數": bad({ cards: { k6a1: { seen: -1, goodDays: [], blockedDay: null, due: null } } }),
    "log 少欄位": bad({ log: [{ op: "x", d: TODAY }] }), "缺 settings": bad({ settings: null })
  };
  Object.keys(cases).forEach((k) => assert.deepEqual(plain(x.summarize(cases[k], NOW)), { ok: false }, k));
  [null, undefined, 3, {}, []].forEach((raw) => assert.deepEqual(plain(x.summarize(raw, NOW)), { ok: false }, String(raw)));
  [NaN, Infinity, "1", undefined, 8.64e15 + 1].forEach((t) => assert.deepEqual(plain(x.summarize(JSON.stringify(good), t)), { ok: false }, "now=" + String(t)));
  // 空白存檔（剛開始用）讀得懂：全部 0
  assert.deepEqual(plain(x.summarize(JSON.stringify(C.blankState()), NOW)), { ok: true, answers: 0, seen: 0, weak: 0, weakToday: 0, challenge: 0, challengeToday: 0, out: 0 });
  // v3 存檔照首頁一樣讀（decode 轉 v4）
  assert.equal(x.summarize(bad({ v: 3 }), NOW).ok, true);
});

test("⑤欄位都是非負整數、weakToday≤weak、challengeToday≤challenge；answers＝log 筆數、seen＝cards[*].seen 加總（同 sync.js practiceScore）；錯題站驗證器收", () => {
  const x = exp(), B = C.bankFrom(MB);
  let AW = null;
  // 錯題站的驗證程式（同一台有那個 repo 才跑；沒有就只驗本站這邊）
  for (const p of [process.env.G5_APPWEAK, path.join(require("os").homedir(), "Documents", "g5-wrong-review", "src", "appweak.js")]) {
    if (p && fs.existsSync(p)) { AW = require(p); break; }
  }
  SEEDS.forEach((sd) => {
    const s = synth(sd, B), got = x.summarize(JSON.stringify(s), NOW);
    assert.equal(got.ok, true);
    assert.deepEqual(Object.keys(got).sort(), ["ok"].concat(FIELDS).sort());
    FIELDS.forEach((f) => assert.ok(Number.isInteger(got[f]) && got[f] >= 0, f + "=" + got[f]));
    assert.ok(got.weakToday <= got.weak && got.challengeToday <= got.challenge);
    assert.equal(got.answers, s.log.length);
    assert.equal(got.seen, Object.values(s.cards).reduce((a, c) => a + c.seen, 0));
    if (AW) { assert.ok(AW.okSummary(got), "錯題站 okSummary 不收（seed " + sd + "）"); assert.deepEqual(AW.summarize(x, JSON.stringify(s), NOW), Object.fromEntries(FIELDS.map((f) => [f, got[f]]))); }
  });
  if (AW) {
    const subj = AW.SUBJECTS.find((s) => s.key === "g5chi.v1");
    assert.ok(AW.okExport(x, "g5chi.v1"), "錯題站 okExport 不收");
    assert.deepEqual(AW.links(x, subj), { weak: null, challenge: null });
    assert.ok(AW.snapshot(x, subj), "錯題站 snapshot 不收");
    assert.equal(AW.summarize(x, "{", NOW), null, "讀不懂要讓錯題站判成讀不懂（不是格式不對）");
  }
});

test("成品一致：weak-export.js 等於 build.py 由 src 重建的結果（改了 core.js／chibank.js 沒 build 會紅）", () => {
  const r = require("child_process").spawnSync("python3", [path.join(ROOT, "build.py"), "--check"], { encoding: "utf8" });
  assert.equal(r.status, 0, "build.py --check：" + (r.stdout || "") + (r.stderr || ""));
});
