// 國語題庫的獨立檢查：答案在選項內且唯一、每個錯誤選項有 wrongWhy、句長、觀念都有題、反義／近義題的辭典依據、
// 修辭題「只有一個選項成立」的線索檢查、史實與著作權題都列在 tests/FACTCHECK.md、出口題不和練習重複、畫面不出現學校名稱、
// 著作權補救解說整份等於審定快照（tests/cr_approved_snapshot.json，工具 tests/cr_snapshot.js）。
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

// ⑪～⑳：Codex 審 e0ad0ad8（2026-10-13）逐項 FAIL 的回歸測試。每條先在舊內容上紅，再改內容到綠。
const card = (id) => B.CARDS.find((c) => c.id === id);
const optWhy = (c, o) => c.wrongWhy[c.opts.indexOf(o)];
const GENRES = ["詩歌", "說明文", "記敘文", "歷史故事", "童話", "寓言"];
const FC = fs.readFileSync(path.join(__dirname, "FACTCHECK.md"), "utf8");

test("⑪文體題：錯項是文體名稱時，不能拿「分不分行」當排除理由（排版不是文體的充分條件）", () => {
  const bad = [];
  B.CARDS.filter((c) => c.concept === "ga").forEach((c) => c.opts.forEach((o, i) => {
    if (i !== c.a && GENRES.indexOf(o) >= 0 && /短短的行|一行一行|分成.{0,4}行|分行/.test(c.wrongWhy[i])) bad.push(c.id + "「" + o + "」：" + c.wrongWhy[i]);
  }));
  assert.deepEqual(bad, []);
});

test("⑫ga5：題幹沒交代形式，不能放「詩歌」當錯項；ga9：歷史故事也是記敘，不能當「不是記敘文」的錯項", () => {
  const g5 = card("ga5"), g9 = card("ga9");
  assert.ok(g5.opts.indexOf("詩歌") < 0, "ga5 仍有「詩歌」錯項：" + g5.opts.join("／"));
  const bad = g9.opts.filter((o, i) => i !== g9.a && /歷史故事|古代真實/.test(g9.wrongWhy[i]));
  assert.deepEqual(bad, [], "ga9 用「是歷史故事」排除記敘文");
});

test("⑬ga8 刷牙方法：有國健署／衛福部 src，正解文字對得上 FACTCHECK 摘錄", () => {
  const c = card("ga8");
  assert.match(c.src || "", /^https:\/\/[a-z.]*(hpa|mohw)\.gov\.tw\//, "ga8 沒有官方 src");
  assert.match(FC, /\bga8\b[^\n]*牙刷刷毛朝向牙齦約45度/, "FACTCHECK 沒有 ga8 的官方摘錄");
  assert.match(c.opts[c.a], /45/, "ga8 正解沒照官方寫法（刷毛朝向牙齦約45度）");
});

test("⑭譬喻解說：不能把譬喻縮成「有『像』」；要分明喻（有像）與一般譬喻，並給沒有「像」的譬喻例", () => {
  const e = X.EXPLAIN.rh1, all = e.map((x) => x.svg() + x.lines.join("") + (x.examples || []).map((y) => y.s + y.why).join("")).join("");
  const figs = e.map((x) => x.svg()).join("");
  assert.ok(!/有「像」/.test(figs.replace(/&[a-z]+;/g, "")), "圖卡仍把譬喻寫成「有『像』」");
  assert.ok(/明喻/.test(all), "沒有區分明喻");
  const ex = e.flatMap((x) => x.examples || []).filter((y) => /譬喻/.test(y.why) && !/像|好像|彷彿|如同/.test(y.s));
  assert.ok(ex.length >= 1, "沒有不含「像」的譬喻例句");
});

test("⑮rh2d：把「譬喻」當錯項的引用題，引文不能是用比喻講道理的俗語", () => {
  const METAPHOR_PROVERBS = /耕耘|收穫|鐵杵|磨成針|滴水穿石|種瓜得瓜/;
  const bad = B.CARDS.filter((c) => c.opts[c.a] === "引用" && c.opts.indexOf("譬喻") >= 0 && METAPHOR_PROVERBS.test(c.q)).map((c) => c.id + "：" + c.q);
  assert.deepEqual(bad, []);
});

test("⑯設問「提問」例句：問號後面要真的回答問題（不能是建議、命令）", () => {
  const ANSWER = /^(因為|原來|就是|當然|是|已經)/;
  const bad = [];
  const tryOne = (where, s) => { const m = /？([^？]+)$/.exec(s.replace(/[「」]/g, "")); if (m && !ANSWER.test(m[1].trim())) bad.push(where + "：" + s); };
  Object.keys(X.EXPLAIN).forEach((k) => X.EXPLAIN[k].forEach((ex) => (ex.examples || []).forEach((y) => { if (/提問|自己回答/.test(y.why)) tryOne(k + " 例句", y.s); })));
  tryOne("rh2 出口答案", B.CONCEPTS.rh2.exitAns.split("。")[0].replace(/^例：/, ""));
  assert.deepEqual(bad, []);
});

test("⑰「安靜」的白話釋義不寫成「沒有聲音」（辭典相反詞是喧鬧、吵鬧；改「沒有吵鬧聲、很平靜」）", () => {
  const bad = B.CARDS.flatMap((c) => c.wrongWhy.filter((w) => /「安靜」是沒有聲音/.test(w)).map((w) => c.id + "：" + w));
  assert.deepEqual(bad, []);
  assert.match(FC, /安靜[^\n]*39717/, "FACTCHECK 沒有「安靜」辭典條目");
});

test("⑱hs8：問的是史記那句實際比較的對象（位在○○之右），錯項說明對得上", () => {
  const c = card("hs8");
  assert.match(c.q, /位在○○之右/, "hs8 仍在問排名「比誰高」：" + c.q);
  assert.equal(c.opts[c.a], "廉頗");
});

test("⑲cr8 加「沒有取得販售授權」條件；cr9 錯因改「未取得授權，不可任意上傳」", () => {
  assert.match(card("cr8").q, /沒有取得販售授權/, "cr8 題幹沒有授權條件");
  const c9 = card("cr9"), w = optWhy(c9, "錄完放上網路");
  assert.ok(w && !/只能自己用/.test(w) && /未取得授權/.test(w) && /任意上傳/.test(w), "cr9 錯因：" + w);
});

test("⑳著作權補救解說：合理引用四要件都講到，不說「用之前一定要先問」", () => {
  const all = X.EXPLAIN.cr.map((x) => x.svg() + x.lines.join("") + x.ask + x.task + (x.examples || []).map((y) => y.s + y.why).join("")).join("");
  ["已公開發表", "需要", "合理範圍", "出處"].forEach((k) => assert.ok(all.indexOf(k) >= 0, "缺合理引用要件：" + k));
  assert.ok(!/用之前(一定要)?先問/.test(all), "仍寫「用之前先問」");
});

// ===== ㉑ 著作權補救解說（EXPLAIN.cr）：整份審定快照＋結構斷言 =====
// 由來：Codex 審 c28888ed 抓到圖卡與第二種說法互相矛盾（合理引用不用先問 vs 無條件「要先得到同意」），9daba41 修內容並新增㉑。
// 舊㉑先用關鍵字（同意／授權／先問…）挑出句子再逐字比對審定清單，9daba41→899b730→abb1c94 連 3 輪 Codex FAIL：
// 分號、逗號、換行、同義詞（詢問）、零寬字、例句 s／why 錯配、圖卡位置對調、<tspan>、entity、隱藏屬性、刪句、多一個欄位……都繞得過——
// 載體是「篩選後的散落字串」，補一種寫法只是把缺口移到下一種（memory semantic-relations-have-no-string-carrier）。
// 依 Codex 設計者結論 docs/test21-snapshot-codex-designer-20261013.md 改成：
//   ①整份內容正規化後（tests/cr_snapshot.js：每張卡每個欄位、例句 s／why 同一物件且照順序、圖卡完整元素樹與全部屬性、
//     欄位集合與型別）必須等於審過的 tests/cr_approved_snapshot.json。預期值只從這份檔讀，測試絕不從受測內容即時產生。
//   ②結構斷言：恰有兩張卡；第一張 lines[1]／lines[6]、第二張 lines[3]／lines[4] 是「合理引用不用先問」「超出才要授權」的審定句
//     （同一套文字正規化後逐字比；就算有人沒送審就重產快照，這四句的位置和字也還釘著）。
// 改內容的流程：改 src/chiexplain.js → node tests/cr_snapshot.js 看差異 → 送審 → PASS 後由人手動 node tests/cr_snapshot.js --write
// → 內容和快照同一個 commit。網站成品 index.html 由 build.py 內嵌 src 產生，成品一致性不在這條的範圍。
const SNAP = require("./cr_snapshot.js");
const CR_PINS = [   // [第幾張（從 0 起）, lines 第幾句, 審定句, 這句承載的意思]
  [0, 1, "合理引用不用先問作者，但四件事都要做到：", "合理引用不用先問"],
  [0, 6, "超出合理引用的複製、上傳、賣，要先取得授權。", "超出合理引用才要授權"],
  [1, 3, "合理引用不用先問，但一定要寫出處。", "合理引用不用先問"],
  [1, 4, "超出合理引用的複製、上傳，要先取得授權。", "超出合理引用才要授權"],
];
const crSnapshot = () => JSON.parse(fs.readFileSync(SNAP.SNAPSHOT_FILE, "utf8"));
// 回傳 [{ kind: file｜parse｜snapshot｜structure, path, text }]；空陣列＝通過
function t21Check(cr, snap) {
  const bad = [];
  const put = (kind, p, text) => bad.push({ kind, path: p, text });
  const snapOk = !!snap && Array.isArray(snap.cr);
  if (!snapOk) put("file", "snapshot", "審定快照檔沒有 cr 陣列");
  else {
    if (snap["規則版本"] !== SNAP.RULES_VERSION) put("file", "snapshot", "審定快照的規則版本 " + SNAP.show(snap["規則版本"]) + " 和 tests/cr_snapshot.js 的 " + SNAP.show(SNAP.RULES_VERSION) + " 不同：正規化規則改了，要重產快照並送審");
    if (snap.sha256 !== SNAP.sha256Of(snap.cr)) put("file", "snapshot", "審定快照的 cr 和它記的 sha256 對不上（快照檔被手改過？只能用 node tests/cr_snapshot.js --write 產生）");
  }
  let norm = null;
  try { norm = SNAP.normalize(cr); } catch (e) { put("parse", e.path || "cr", e.message); }
  if (norm && snapOk) SNAP.diff(snap.cr, norm).forEach((d) => put("snapshot", d.path, d.text));
  const n = Array.isArray(cr) ? cr.length : -1;
  if (n !== 2) put("structure", "cr", "應該恰有兩張卡，現在" + (n < 0 ? "不是陣列" : "是 " + n + " 張"));
  CR_PINS.forEach(([c, j, want, what]) => {
    const card = n > c ? cr[c] : undefined;
    const got = card && Array.isArray(card.lines) ? card.lines[j] : undefined;
    if (typeof got !== "string" || SNAP.normalizeText(got) !== SNAP.normalizeText(want))
      put("structure", "cr[" + c + "].lines[" + j + "]", "第 " + (c + 1) + " 張的 lines[" + j + "] 要承載「" + what + "」的審定句 " + SNAP.show(want) + "，現在是 " + SNAP.show(got));
  });
  return bad;
}
const T21_KIND = { file: "快照檔", parse: "解析失敗", snapshot: "和審定快照不同", structure: "結構斷言" };
const t21Lines = (bad) => bad.map((b) => "  [" + T21_KIND[b.kind] + "] " + b.text).join("\n");
test("㉑著作權補救解說：整份內容（每個欄位、例句配對與順序、圖卡元素樹與全部屬性）等於審定快照 tests/cr_approved_snapshot.json；第一張 lines[1]／[6]、第二張 lines[3]／[4] 是「不用先問」「超出才要授權」審定句", () => {
  let snap;
  try { snap = crSnapshot(); } catch (e) { assert.fail("讀不到審定快照 tests/cr_approved_snapshot.json（" + e.message + "）。快照只能由人手動執行 node tests/cr_snapshot.js --write 產生並送審，測試不會自己產生。"); }
  const bad = t21Check(X.EXPLAIN.cr, snap);
  if (bad.length) assert.fail("測試㉑：著作權補救解說（EXPLAIN.cr）有 " + bad.length + " 處和審定版不符：\n" + t21Lines(bad) +
    "\n內容改了，請重新審定並送審後更新快照：先 node tests/cr_snapshot.js 看差異，送審 PASS 後由人手動執行 node tests/cr_snapshot.js --write，和內容同一個 commit。");
});

// ㉑ 自檢（設計檔 (d) 驗收矩陣）：每列在 EXPLAIN.cr 的深拷貝上做一個突變（svg 改成回傳改過字串的函式）。
// 反例：新版必須紅，而且紅在該列的位置（hit），不是別的原因碰巧紅；正向控制只改排版或編碼，新版必須綠。
// 設計檔 18 列在 abb1c94 的舊㉑全部是綠的（在暫存目錄用 git show abb1c94:tests/chibank.test.js 逐列實跑，結果記在 commit 訊息）；
// 檔尾的 module.exports 讓那支對照腳本載入同一份反例，不另抄一份。
function crClone(cr) {   // 深拷貝；函式（svg）照舊引用
  const cp = (v) => (Array.isArray(v) ? v.map(cp) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).map((k) => [k, cp(v[k])])) : v);
  return cp(cr);
}
function rep1(s, from, to) {   // 剛好替換一處；找不到或不只一處就丟錯（避免「沒改到」的突變假裝有牙齒）
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error("突變目標 " + JSON.stringify(from) + " 出現 " + n + " 次（要剛好 1 次）");
  return s.replace(from, () => to);
}
function svgEdit(card, f) { const s = f(card.svg()); card.svg = () => s; }
const charRefs = (t, hexEvery) => Array.from(t).map((c, n) => (hexEvery && n % hexEvery === 1 ? "&#x" + c.codePointAt(0).toString(16) + ";" : "&#" + c.codePointAt(0) + ";")).join("");
const crPrint = (C) => JSON.stringify(C.map((c) => Object.keys(c).map((k) => [k, typeof c[k] === "function" ? c[k]() : c[k]])));
const T21_ROWS = [   // 設計檔 (d) 18 列；hit＝[種類, 位置, 訊息裡要出現的字]
  { id: "1", what: "同義詞：第二張 lines[0] →「合理引用要先詢問作者。」", mutate: (C) => { C[1].lines[0] = "合理引用要先詢問作者。"; },
    hit: [["snapshot", "cr[1].lines[0]", "→ \"合理引用要先詢問作者。\""]] },
  { id: "2", what: "配對拆散：第一張 examples[1].s →「「把整篇文章貼到自己的網站。」」，why 不變", mutate: (C) => { C[0].examples[1].s = "「把整篇文章貼到自己的網站。」"; },
    hit: [["snapshot", "cr[0].examples[1].s", "→ \"「把整篇文章貼到自己的網站。」\""]] },
  { id: "3", what: "tspan：第二張圖卡新增 <text x=\"10\" y=\"145\"><tspan>合理引用要先取得同意。</tspan></text>",
    mutate: (C) => svgEdit(C[1], (s) => rep1(s, "</svg>", '<text x="10" y="145"><tspan>合理引用要先取得同意。</tspan></text></svg>')),
    hit: [["snapshot", "cr[1].svg.children[13]", "<tspan>合理引用要先取得同意。</tspan>"]] },
  { id: "4", what: "審定句錯配：第一張 examples[1].why ↔ examples[2].why", mutate: (C) => { const e = C[0].examples, w = e[1].why; e[1].why = e[2].why; e[2].why = w; },
    hit: [["snapshot", "cr[0].examples[1].why", "→ \"整篇貼上不是引用"], ["snapshot", "cr[0].examples[2].why", "→ \"合理引用，不用先問"]] },
  { id: "5", what: "標題漏檢：第二張 name →「合理引用要先詢問作者」", mutate: (C) => { C[1].name = "合理引用要先詢問作者"; },
    hit: [["snapshot", "cr[1].name", "→ \"合理引用要先詢問作者\""]] },
  { id: "6", what: "任務漏檢：第二張 task →「合理引用前，先詢問作者。」", mutate: (C) => { C[1].task = "合理引用前，先詢問作者。"; },
    hit: [["snapshot", "cr[1].task", "→ \"合理引用前，先詢問作者。\""]] },
  { id: "7", what: "提問漏檢：第二張 ask →「合理引用前，為什麼必須先詢問？」", mutate: (C) => { C[1].ask = "合理引用前，為什麼必須先詢問？"; },
    hit: [["snapshot", "cr[1].ask", "→ \"合理引用前，為什麼必須先詢問？\""]] },
  { id: "8", what: "無障礙文字：第二張圖卡根 aria-label →「合理引用要先詢問作者。」",
    mutate: (C) => svgEdit(C[1], (s) => { const m = s.match(/ aria-label="[^"]*"/g) || []; return rep1(s, m.length === 1 ? m[0] : "（aria-label 不是剛好一個）", ' aria-label="合理引用要先詢問作者。"'); }),
    hit: [["snapshot", "cr[1].svg.attrs.aria-label", "→ \"合理引用要先詢問作者。\""]] },
  { id: "9", what: "SVG 篩選：第二張圖卡文字「我的畫」→「合理引用要先詢問作者」", mutate: (C) => svgEdit(C[1], (s) => rep1(s, ">我的畫<", ">合理引用要先詢問作者<")),
    hit: [["snapshot", "cr[1].svg.children[1].text", "→ \"合理引用要先詢問作者\""]] },
  { id: "10", what: "entity：第二張圖卡新增 <text>，「合理引用要先取得同意。」逐字寫成 &#十進位碼點;",
    mutate: (C) => svgEdit(C[1], (s) => rep1(s, "</svg>", "<text>" + charRefs("合理引用要先取得同意。") + "</text></svg>")),
    hit: [["snapshot", "cr[1].svg.children[13]", "<text>合理引用要先取得同意。</text>"]] },
  { id: "11", what: "圖文關係：第一張圖卡兩個 x=\"535.0\" 右格文字的 y=\"122.0\" ↔ \"192.0\"",
    mutate: (C) => svgEdit(C[0], (s) => rep1(rep1(rep1(s, 'x="535.0" y="122.0"', "@@Y@@"), 'x="535.0" y="192.0"', 'x="535.0" y="122.0"'), "@@Y@@", 'x="535.0" y="192.0"')),
    hit: [["snapshot", "cr[0].svg.children[13].attrs.y", "\"122.0\" → \"192.0\""], ["snapshot", "cr[0].svg.children[20].attrs.y", "\"192.0\" → \"122.0\""]] },
  { id: "12", what: "隱藏內容：第一張圖卡根節點加 style=\"display:none\"", mutate: (C) => svgEdit(C[0], (s) => rep1(s, "<svg ", '<svg style="display:none" ')),
    hit: [["parse", "cr[0].svg", "不認得的屬性 style"]] },
  { id: "13", what: "刪除被掩護：刪掉第一張 lines[1]", mutate: (C) => { C[0].lines.splice(1, 1); },
    hit: [["snapshot", "cr[0].lines[1]", "少了這一項 \"合理引用不用先問作者，但四件事都要做到：\""], ["structure", "cr[0].lines[1]"], ["structure", "cr[0].lines[6]"]] },
  { id: "14", what: "集合完整性：刪掉第二張卡", mutate: (C) => { C.splice(1, 1); },
    hit: [["snapshot", "cr[1]", "少了這一項 整張卡"], ["structure", "cr"]] },
  { id: "15", what: "順序遺失：第一張 lines[0] ↔ lines[2]", mutate: (C) => { const l = C[0].lines, x = l[0]; l[0] = l[2]; l[2] = x; },
    hit: [["snapshot", "cr[0].lines[0]", "→ \"①引用的作品已公開發表。\""], ["snapshot", "cr[0].lines[2]", "→ \"作品一完成，作者就有著作權，不用登記。\""]] },
  { id: "16", what: "schema 擴張：第二張新增 note 欄位「合理引用要先詢問作者。」", mutate: (C) => { C[1].note = "合理引用要先詢問作者。"; },
    hit: [["snapshot", "cr[1].note", "多了這個欄位 \"合理引用要先詢問作者。\""]] },
  { id: "17", what: "Unicode 零寬：第二張 lines[0] →「合理引用要先\\u200b問作者。」", mutate: (C) => { C[1].lines[0] = "合理引用要先\u{200B}問作者。"; },
    hit: [["snapshot", "cr[1].lines[0]", "→ \"合理引用要先\\u200b問作者。\""]] },
  { id: "18", what: "過度正規化：第一張 examples[0].s「我畫好了一張圖。」→「我畫好了一張圖？」", mutate: (C) => { C[0].examples[0].s = rep1(C[0].examples[0].s, "我畫好了一張圖。", "我畫好了一張圖？"); },
    hit: [["snapshot", "cr[0].examples[0].s", "→ \"「我畫好了一張圖？」\""]] },
  // 以下兩列：Codex 審 6c732ff（規則版本 1 在這兩列假通過）
  { id: "19", what: "屬性值過度正規化：第一張圖卡 width=\"270.0\" →「270 .0」", mutate: (C) => svgEdit(C[0], (s) => s.replace('width="270.0"', 'width="270 .0"')),   // 只換第一個（根下第一個元素）
    hit: [["snapshot", "cr[0].svg.children[0].attrs.width", "270 .0"]] },
  { id: "20", what: "schema 擴張（__proto__）：第二張新增自有欄位 __proto__「合理引用要先詢問作者。」",
    mutate: (C) => { Object.defineProperty(C[1], "__proto__", { value: "合理引用要先詢問作者。", enumerable: true, writable: true, configurable: true }); },
    hit: [["snapshot", "cr[1].__proto__", "合理引用要先詢問作者"]] },
  { id: "21", what: "schema 擴張（例句裡的 __proto__）：第一張 examples[0] 新增自有欄位 __proto__「合理引用要先詢問作者。」",
    mutate: (C) => { Object.defineProperty(C[0].examples[0], "__proto__", { value: "合理引用要先詢問作者。", enumerable: true, writable: true, configurable: true }); },
    hit: [["snapshot", "cr[0].examples[0].__proto__", "合理引用要先詢問作者"]] },
];
const T21_LEGACY = [   // abb1c94 以前的自檢反例（Codex 審 9daba41、899b730），新版照樣要紅
  ["分號", "合理引用要先取得同意；用自己的話寫心得不用先問。"],
  ["逗號", "合理引用要先取得同意，寫心得不用先問"],
  ["換行", "合理引用要先取得同意\n寫心得不用先問"],
  ["同義詞", "合理引用也要作者允許才能用。"],
].map(([k, line], n) => ({ id: "舊" + (n + 1), what: "原有反例（" + k + "）：第二張 lines[3] → " + JSON.stringify(line), mutate: (C) => { C[1].lines[3] = line; },
  hit: [["snapshot", "cr[1].lines[3]"], ["structure", "cr[1].lines[3]"]] })).concat([
  { id: "舊5", what: "原有反例（圖卡左右格對調）：第一張圖卡左格「合理引用」↔「超出合理引用」",
    mutate: (C) => svgEdit(C[0], (s) => rep1(rep1(rep1(s, ">合理引用<", ">@@L@@<"), ">超出合理引用<", ">合理引用<"), ">@@L@@<", ">超出合理引用<")),
    hit: [["snapshot", "cr[0].svg.children[8].text"], ["snapshot", "cr[0].svg.children[15].text"]] },
]);
const T21_POSITIVE = [   // 設計檔 (d) 6 個正向控制：只改排版或編碼，新版必須綠
  { id: "正1", what: "文字縮排／CRLF：每個字串前後加縮排與 CRLF，句中逗號後換行",
    mutate: (C) => C.forEach((c) => {
      c.name = "\t" + c.name + "\r\n";
      c.lines = c.lines.map((s) => "  " + s.replace("，", "，\r\n    ") + " \r\n");
      c.examples.forEach((e) => { e.s = "\r\n  " + e.s; e.why = e.why.replace("，", "，\n  ") + "\t"; });
      c.task = "    " + c.task.replace("，", "，\r\n") + "\r\n";
      c.ask = "\r\n" + c.ask + "   ";
    }) },
  { id: "正2", what: "SVG 縮排與引號格式：元素之間、文字前後加換行縮排（含 CRLF），屬性改單引號、= 兩邊加空白，自閉合改成成對標籤",
    mutate: (C) => C.forEach((c) => svgEdit(c, (s) => s
      .replace(/<(rect|line|polygon)\b([^>]*?)\/>/g, "<$1$2></$1>")
      .replace(/="([^"]*)"/g, " = '$1'")
      .replace(/>(?=[^<])/g, ">\r\n      ")
      .replace(/(?!^)</g, "\n    <"))) },
  { id: "正3", what: "物件鍵順序：卡片與例句的鍵倒過來排",
    mutate: (C) => C.forEach((c, n) => {
      c.examples = c.examples.map((e) => Object.fromEntries(Object.entries(e).reverse()));
      C[n] = Object.fromEntries(Object.entries(c).reverse());
    }) },
  { id: "正4", what: "SVG 屬性順序：每個標籤的屬性倒過來排",
    mutate: (C) => C.forEach((c) => svgEdit(c, (s) => s.replace(/<([a-z]+)((?: [A-Za-z-]+="[^"]*")+)(\/?)>/g,
      (m, tag, attrs, sl) => "<" + tag + attrs.match(/ [A-Za-z-]+="[^"]*"/g).reverse().join("") + sl + ">"))) },
  { id: "正5", what: "等價 entity：圖卡文字與 aria-label 的字改寫成 &#十進位; 與 &#x十六進位;",
    mutate: (C) => {
      svgEdit(C[0], (s) => rep1(s, ">合理引用<", ">" + charRefs("合理引用", 2) + "<").replace(/；/g, "&#xff1b;"));
      svgEdit(C[1], (s) => rep1(rep1(s, ">我的畫<", ">" + charRefs("我的畫", 2) + "<"), "換位想一想", charRefs("換位想一想", 2)));
    } },
  { id: "正6", what: "NFC 等價：「著」「不」「理」換成相容漢字 U+FA5F、U+F967、U+F9E4（NFC 後是同一個字）",
    mutate: (C) => {
      C[0].lines[0] = rep1(C[0].lines[0], "著", "\u{FA5F}");
      C[0].lines[1] = rep1(C[0].lines[1], "不", "\u{F967}");
      C[1].lines[3] = rep1(C[1].lines[3], "理", "\u{F9E4}");
      svgEdit(C[0], (s) => rep1(s, ">四件事做到，不用先問<", ">四件事做到，\u{F967}用先問<"));
    } },
];
function t21Mutant(row) { const C = crClone(X.EXPLAIN.cr); row.mutate(C); return C; }
const t21Hit = (bad, [kind, p, sub]) => bad.some((b) => b.kind === kind && b.path === p && (sub === undefined || b.text.indexOf(sub) >= 0));
test("㉑自檢-基準：沒有突變的深拷貝必須綠（不然下面的「紅」沒有意義）；所有突變都不能動到原本的 EXPLAIN.cr", () => {
  const before = crPrint(X.EXPLAIN.cr);
  assert.equal(t21Lines(t21Check(crClone(X.EXPLAIN.cr), crSnapshot())), "");
  T21_ROWS.concat(T21_LEGACY, T21_POSITIVE).forEach((r) => t21Mutant(r));
  assert.equal(crPrint(X.EXPLAIN.cr), before, "突變動到了原本的 EXPLAIN.cr");
});
test("㉑自檢-快照檔：cr 被手改卻沒更新 sha256、規則版本對不上、檔案沒有 cr，都要紅", () => {
  const C = crClone(X.EXPLAIN.cr);
  const hand = crSnapshot(); hand.cr[1].lines[0] = "合理引用要先詢問作者。";
  assert.ok(t21Hit(t21Check(C, hand), ["file", "snapshot", "sha256 對不上"]), "手改快照沒被抓到");
  const old = crSnapshot(); old["規則版本"] = "cr-snapshot/0";
  assert.ok(t21Hit(t21Check(C, old), ["file", "snapshot", "規則版本"]), "規則版本不符沒被抓到");
  assert.ok(t21Hit(t21Check(C, {}), ["file", "snapshot", "沒有 cr 陣列"]), "快照沒有 cr 沒被抓到");
});
test("㉑自檢-反例：設計檔 18 列＋原有分號／逗號／換行／同義詞／圖卡左右格對調，新版每一列都紅，而且紅在該列的位置", async (t) => {
  const snap = crSnapshot(), base = crPrint(X.EXPLAIN.cr);
  for (const r of T21_ROWS.concat(T21_LEGACY)) {
    await t.test("列 " + r.id + " " + r.what, () => {
      const C = t21Mutant(r);
      assert.notEqual(crPrint(C), base, "突變沒有改到內容");
      const bad = t21Check(C, snap);
      assert.ok(bad.length > 0, "新版沒有紅");
      r.hit.forEach((h) => assert.ok(t21Hit(bad, h), "沒有紅在預期的位置 " + JSON.stringify(h) + "；實際：\n" + t21Lines(bad)));
    });
  }
});
test("㉑自檢-正向控制：縮排／CRLF、SVG 縮排與引號、物件鍵順序、SVG 屬性順序、等價 entity、NFC 等價，新版都必須綠", async (t) => {
  const snap = crSnapshot(), base = crPrint(X.EXPLAIN.cr);
  for (const r of T21_POSITIVE) {
    await t.test(r.id + " " + r.what, () => {
      const C = t21Mutant(r);
      assert.notEqual(crPrint(C), base, "正向控制沒有改到內容（恆真）");
      assert.equal(t21Lines(t21Check(C, snap)), "", "正向控制被判紅");
    });
  }
});
test("㉑自檢-解析器：<tspan> 與 entity 都收進文字；不認得的語法一律丟錯（測試就紅）", () => {
  const wrap = (body) => '<svg class="fig" viewBox="0 0 10 10" role="img" aria-label="圖">' + body + "</svg>";
  const t0 = SNAP.normalizeSvg(wrap('<text x="1" y="2">&#21512;<tspan>理</tspan>&amp;&lt;&gt;&quot;&apos;&#x5f15;</text>')).children[0];
  assert.equal(t0.text, "合理&<>\"'引");
  // 正規化後的物件無原型（規則版本 2），比結構前先轉成一般物件
  assert.deepEqual(JSON.parse(JSON.stringify(t0.children)), [{ "#text": "合" }, { tag: "tspan", attrs: {}, text: "理" }, { "#text": "&<>\"'引" }]);
  // 底稿本身必須能過，下面每個壞例子才是「只壞在那一處」
  assert.doesNotThrow(() => SNAP.parseSvg(wrap("")));
  assert.doesNotThrow(() => SNAP.parseSvg(wrap('<rect x="1" y="1" width="1" height="1"/><text x="1" y="2">合理</text>')));
  const BAD = [   // [名稱, SVG, 錯誤訊息裡要出現的字＝確實是因為這一處而丟錯]
    ["註解", wrap("<!-- 合理引用要先問 -->"), "不支援註解"],
    ["CDATA", wrap('<text x="1" y="2"><![CDATA[合理引用要先問]]></text>'), "不支援註解、CDATA"],
    ["XML 宣告", '<?xml version="1.0"?>' + wrap(""), "開頭必須是 <svg"],
    ["DOCTYPE", "<!DOCTYPE svg>" + wrap(""), "開頭必須是 <svg"],
    ["<title>", wrap("<title>合理引用要先問</title>"), "不認得的元素 <title>"],
    ["<g>", wrap('<g><text x="1" y="2">合理引用要先問</text></g>'), "不認得的元素 <g>"],
    ["<foreignObject>", wrap("<foreignObject><p>合理引用要先問</p></foreignObject>"), "不認得的元素 <foreignObject>"],
    ["HTML 的 <p>", wrap("<p>合理引用要先問</p>"), "不認得的元素 <p>"],
    ["大寫標籤", wrap('<TEXT x="1" y="2">合理引用</TEXT>'), "不認得的元素 <TEXT>"],
    ["svg 裡再放 svg", wrap(wrap("")), "<svg> 不能放在這個元素裡"],
    ["不認得的屬性", wrap('<text x="1" y="2" visibility="hidden">合理引用</text>'), "不認得的屬性 visibility"],
    ["命名空間屬性", wrap('<text x="1" y="2" xml:space="preserve">合理引用</text>'), "不認得的屬性 xml"],
    ["屬性重複", wrap('<text x="1" x="2">合理引用</text>'), "屬性重複：x"],
    ["屬性值沒加引號", wrap('<text x=1 y="2">合理引用</text>'), "的值要用引號包起來"],
    ["屬性之間沒空白", wrap('<text x="1"y="2">合理引用</text>'), "屬性前面要有空白"],
    ["&nbsp;", wrap('<text x="1" y="2">合理&nbsp;引用</text>'), "不認得的 entity"],
    ["沒有分號的 &", wrap('<text x="1" y="2">A & B</text>'), "不認得的 entity"],
    ["&#X 大寫", wrap('<text x="1" y="2">&#X5408;</text>'), "不認得的 entity"],
    ["C1 控制字元 entity", wrap('<text x="1" y="2">&#x80;</text>'), "entity 指到不允許的字元 U+80"],
    ["控制字元", wrap('<text x="1" y="2">合\u{7}理</text>'), "有不允許的字元 U+7"],
    ["結束標籤對不上", wrap('<text x="1" y="2">合理</tspan>'), "結束標籤 </tspan> 和 <text> 對不上"],
    ["沒有結束標籤", '<svg class="fig" viewBox="0 0 10 10" role="img" aria-label="圖"><text x="1" y="2">合理', "沒有結束標籤"],
    ["<svg> 裡直接放文字", wrap("合理引用要先問"), "<svg> 裡不能直接放文字"],
    ["<rect> 裡放元素", wrap('<rect x="1" y="1" width="1" height="1"><text x="1" y="2">合理</text></rect>'), "<text> 不能放在這個元素裡"],
    ["</svg> 後面還有字", wrap("") + "合理引用要先問", "</svg> 後面還有東西"],
    ["兩個根元素", wrap("") + wrap(""), "</svg> 後面還有東西"],
    ["根元素不是 svg", '<text x="1" y="2">合理</text>', "<text> 不能放在最外層"],
  ];
  BAD.forEach(([name, markup, why]) => assert.throws(() => SNAP.parseSvg(markup), (e) => e instanceof Error && e.message.indexOf(why) >= 0, name + "：沒有因為「" + why + "」丟錯"));
});
module.exports = { T21_ROWS, T21_LEGACY, T21_POSITIVE, crClone, crPrint, t21Check, crSnapshot };
