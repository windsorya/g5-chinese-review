// 國語題庫的獨立檢查：答案在選項內且唯一、每個錯誤選項有 wrongWhy、句長、觀念都有題、反義／近義題的辭典依據、
// 修辭題「只有一個選項成立」的線索檢查、史實與著作權題都列在 tests/FACTCHECK.md、出口題不和練習重複、畫面不出現學校名稱。
// 執行：node --test tests/chibank.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const B = require("../src/chibank.js");
const X = require("../src/chiexplain.js");
const ROOT = path.join(__dirname, "..");
const MAX_SENTENCE = 40;
const sentences = (t) => String(t == null ? "" : t).split(/[。！？；\n]/).map((s) => s.trim()).filter(Boolean);
const long = (t) => sentences(t).filter((s) => s.length > MAX_SENTENCE);
const DICT_URL = /^https:\/\/dict\.concised\.moe\.edu\.tw\/dictView\.jsp\?ID=\d+$/;

test("①每題：選擇題、至少 2 個選項、選項不重複、答案編號在選項內", () => {
  const bad = [];
  B.CARDS.forEach((c) => {
    if (c.type !== "choice") bad.push(c.id + " 不是選擇題");
    if (!Array.isArray(c.opts) || c.opts.length < 2) bad.push(c.id + " 選項少於 2 個");
    if (new Set(c.opts).size !== c.opts.length) bad.push(c.id + " 選項重複");
    if (!(Number.isInteger(c.a) && c.a >= 0 && c.a < c.opts.length)) bad.push(c.id + " 答案編號不在選項內");
  });
  assert.deepEqual(bad, []);
});

test("②每個錯誤選項都有 wrongWhy（非空），正解那格是空字串；id 不重複", () => {
  const bad = [];
  const ids = new Set();
  B.CARDS.forEach((c) => {
    if (ids.has(c.id)) bad.push(c.id + " id 重複"); ids.add(c.id);
    if (!Array.isArray(c.wrongWhy) || c.wrongWhy.length !== c.opts.length) { bad.push(c.id + " wrongWhy 長度不對"); return; }
    c.opts.forEach((o, i) => {
      const w = c.wrongWhy[i];
      if (i === c.a) { if (w !== "") bad.push(c.id + " 正解也寫了 wrongWhy"); }
      else if (typeof w !== "string" || !w.trim()) bad.push(c.id + "「" + o + "」沒有 wrongWhy");
    });
    if (typeof c.why !== "string" || !c.why.trim()) bad.push(c.id + " 沒有正解說明 why");
  });
  assert.deepEqual(bad, []);
});

test("③句長：題目、選項、提示、解說、錯法說明，每句 ≤40 字", () => {
  const bad = [];
  B.CARDS.forEach((c) => [c.q, c.why, c.hint].concat(c.opts, c.wrongWhy).forEach((t) => long(t).forEach((s) => bad.push(c.id + "（" + s.length + "）：" + s))));
  Object.keys(B.CONCEPTS).forEach((k) => [B.CONCEPTS[k].exit, B.CONCEPTS[k].exitAns].forEach((t) => long(t).forEach((s) => bad.push(k + " 出口題：" + s))));
  Object.keys(X.EXPLAIN).forEach((k) => X.EXPLAIN[k].forEach((ex) => ex.lines.concat([ex.task, ex.ask], (ex.examples || []).map((e) => e.s + "。" + e.why))
    .forEach((t) => long(t).forEach((s) => bad.push(k + " 說明：" + s)))));
  Object.keys(X.PREDICT).forEach((k) => [X.PREDICT[k].q, X.PREDICT[k].why].concat(X.PREDICT[k].opts).forEach((t) => long(t).forEach((s) => bad.push(k + " 先猜：" + s))));
  assert.deepEqual(bad, []);
});

test("④每個觀念都有題，8～15 題；每題的觀念都存在；每題標「自編題（未對課本）」", () => {
  const n = {};
  B.CARDS.forEach((c) => { n[c.concept] = (n[c.concept] || 0) + 1; });
  const bad = Object.keys(B.CONCEPTS).filter((k) => !(n[k] >= 8 && n[k] <= 15)).map((k) => k + "：" + (n[k] || 0) + " 題");
  B.CARDS.forEach((c) => { if (!B.CONCEPTS[c.concept]) bad.push(c.id + " 觀念不存在：" + c.concept); if (c.page !== "自編題（未對課本）") bad.push(c.id + " page 不對"); });
  Object.keys(B.CONCEPTS).forEach((k) => { if (!B.UNITS[B.CONCEPTS[k].unit]) bad.push(k + " 單元不存在"); if (B.CONCEPTS[k].unit === "3") bad.push(k + " 單元代號不可用 \"3\"（core.js 會當成待開放單元）"); });
  assert.deepEqual(bad, []);
  assert.ok(B.CARDS.length >= 90 && B.CARDS.length <= 130, "總題數 " + B.CARDS.length);
});

// ⑤ 反義／近義：src 是國語辭典簡編本的條目網址；正解在該條目的相反詞（或相似詞）欄；其他選項都不在同一欄；
//    錯法說明若說某選項「意思相近／是近義詞」或「是反義詞」，該選項必須真的在辭典的另一欄（防止解說亂講）
test("⑤反義詞、近義詞題都有辭典 src，正解在辭典欄位裡、其他選項不在", () => {
  const bad = [];
  B.CARDS.filter((c) => c.concept === "an" || c.concept === "sy").forEach((c) => {
    const d = c.dict;
    if (!d) { if (/反義詞是哪一個|近義詞是哪一個|哪一組/.test(c.q)) bad.push(c.id + " 沒有 dict"); return; }
    if (!DICT_URL.test(c.src || "")) bad.push(c.id + " src 不是辭典條目網址：" + c.src);
    const right = c.opts[c.a];
    if (d.kind === "ant" || d.kind === "sim") {
      const col = d.kind === "ant" ? d.ant : d.sim, other = d.kind === "ant" ? d.sim : d.ant;
      if (col.indexOf(right) < 0) bad.push(c.id + " 正解「" + right + "」不在辭典「" + d.word + "」的" + (d.kind === "ant" ? "相反詞" : "相似詞") + "欄");
      if (c.q.indexOf("「" + d.word + "」") < 0) bad.push(c.id + " 題目沒有寫到「" + d.word + "」");
      c.opts.forEach((o, i) => {
        if (i === c.a) return;
        if (col.indexOf(o) >= 0) bad.push(c.id + " 錯誤選項「" + o + "」也在辭典同一欄（答案不唯一）");
        const w = c.wrongWhy[i];
        const saysSim = /意思相近|是近義詞/.test(w), saysAnt = /反義詞/.test(w) && !/不是.*反義詞/.test(w);
        if (d.kind === "ant" && saysSim && other.indexOf(o) < 0) bad.push(c.id + "「" + o + "」說是近義詞，但辭典相似詞欄沒有");
        if (d.kind === "sim" && saysAnt && other.indexOf(o) < 0) bad.push(c.id + "「" + o + "」說是反義詞，但辭典相反詞欄沒有");
      });
    } else if (d.kind === "antPair") {
      const [w1, w2] = right.split("—");
      if (w1 !== d.word || d.ant.indexOf(w2) < 0) bad.push(c.id + " 正解那組不在辭典相反詞欄");
      c.opts.forEach((o, i) => { if (i !== c.a && !DICT_URL.test((d.pairs || {})[o] || "")) bad.push(c.id + "「" + o + "」沒有辭典網址"); });
    } else if (d.kind === "antIn") {
      if (!(right.indexOf(d.word) >= 0 && d.ant.some((x) => right.indexOf(x) >= 0))) bad.push(c.id + " 正解不是辭典裡的那一組");
    } else bad.push(c.id + " dict.kind 不認得：" + d.kind);
  });
  assert.deepEqual(bad, []);
});

// ⑥ 修辭題：題目引號裡的句子，用「線索」檢查有沒有第二個選項也成立（例如句子有「像」，選項卻有譬喻而正解不是譬喻）
const CLUE = {
  "譬喻": (s) => /像|好像|彷彿|如同/.test(s),
  "引用": (s) => /說：|說「|俗話|名言/.test(s),
  "設問": (s) => /？/.test(s),
};
const quoted = (q) => { const m = /^「(.+)」用了哪一種修辭/.exec(q); return m ? m[1] : null; };
test("⑥修辭題：有明顯線索的修辭只在正解出現（「像」→譬喻、「說：」→引用、問號→設問）", () => {
  const bad = [];
  B.CARDS.filter((c) => c.concept === "rh1" || c.concept === "rh2").forEach((c) => {
    const right = c.opts[c.a], s = quoted(c.q);
    if (s) {
      Object.keys(CLUE).forEach((k) => { if (k !== right && c.opts.indexOf(k) >= 0 && CLUE[k](s)) bad.push(c.id + "：句子有「" + k + "」的線索，選項卻把它當錯的"); });
      if (CLUE[right] && !CLUE[right](s)) bad.push(c.id + "：正解是" + right + "，句子卻沒有它的線索");
    }
    const m = /^下面哪一句用了「(.+)」/.exec(c.q);
    if (m && CLUE[m[1]]) c.opts.forEach((o, i) => { if (i !== c.a && CLUE[m[1]](o)) bad.push(c.id + "：錯誤選項「" + o + "」也有" + m[1] + "的線索"); });
  });
  assert.deepEqual(bad, []);
});
test("⑥-b 線索檢查器自檢：把譬喻句的正解改成擬人，要抓到", () => {
  const c = JSON.parse(JSON.stringify(B.CARDS.find((x) => x.id === "rh1a")));
  const i = c.opts.indexOf("擬人"); c.a = i;
  const s = quoted(c.q);
  assert.ok(CLUE["譬喻"](s) && c.opts.indexOf("譬喻") >= 0 && c.opts[c.a] !== "譬喻");
});

// ⑦ 史實（hs）與著作權（cr）題：每題要有 src，而且 tests/FACTCHECK.md 逐題列出依據
test("⑦史實與著作權題都有 src，且每題 id 都列在 tests/FACTCHECK.md", () => {
  const fc = fs.readFileSync(path.join(__dirname, "FACTCHECK.md"), "utf8");
  const bad = [];
  B.CARDS.filter((c) => c.concept === "hs" || c.concept === "cr").forEach((c) => {
    if (!/^https:\/\//.test(c.src || "")) bad.push(c.id + " 沒有 src");
    if (!new RegExp("\\b" + c.id + "\\b").test(fc)) bad.push(c.id + " 沒列在 FACTCHECK.md");
  });
  assert.deepEqual(bad, []);
});

// ⑧ 出口題（app.html 對家長說「這些題目在練習裡沒出現過」）不得和練習題、先猜題、說明例句同題
const norm = (s) => String(s).replace(/^(說說看|先猜猜看)[：:]?/, "").replace(/[^一-鿿]/g, "");
test("⑧出口題不和練習題、先猜題、例句同題", () => {
  const seen = B.CARDS.map((c) => [c.id, c.q]).concat(Object.keys(X.PREDICT).map((k) => ["先猜 " + k, X.PREDICT[k].q]),
    ...Object.keys(X.EXPLAIN).map((k) => X.EXPLAIN[k].flatMap((ex) => [[k + " 跟著做", ex.task], [k + " 問", ex.ask]])));
  const bad = [];
  Object.keys(B.CONCEPTS).forEach((k) => {
    const e = norm(B.CONCEPTS[k].exit);
    seen.forEach(([id, q]) => { const n = norm(q); if (n.length >= 6 && (e.includes(n) || n.includes(e))) bad.push(k + " 出口題＝" + id); });
  });
  assert.deepEqual(bad, []);
});

// ⑨ 說明：每個觀念兩種說法，第一種有例句（「看例句」要逐句看完才能換一題確認，core.js labStart 要求至少 1 項）；先猜題答案在選項內
test("⑨每個觀念兩種說法、第一種有例句；先猜題答案在選項內", () => {
  const bad = [];
  Object.keys(B.CONCEPTS).forEach((k) => {
    const e = X.EXPLAIN[k];
    if (!Array.isArray(e) || e.length < 2) { bad.push(k + " 沒有兩種說法"); return; }
    if (!(e[0].examples && e[0].examples.length >= 1)) bad.push(k + " 第一種說法沒有例句");
    e.forEach((ex, i) => (ex.examples || []).forEach((x) => { if (!x.s || !x.why) bad.push(k + " 第 " + (i + 1) + " 種說法有空例句"); }));
    const p = X.PREDICT[k];
    if (!p || !(Number.isInteger(p.a) && p.a >= 0 && p.a < p.opts.length)) bad.push(k + " 先猜題答案不在選項內");
  });
  assert.deepEqual(bad, []);
});

// ⑩ 隱私：網頁（index.html，含內嵌的程式碼與註解）不出現學校名稱
test("⑩index.html 不出現學校名稱", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(!/忠孝/.test(html), "index.html 出現學校名稱");
});
