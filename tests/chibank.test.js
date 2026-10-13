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

// Codex 審 c28888ed：圖卡與第二種說法同時寫「合理引用不用先問」與無條件「要先得到同意」，互相矛盾。
// Codex 審 9daba41、899b730：用關鍵字判「條件有沒有跟著要求」，分號、逗號、換行都能讓錯的前半句被後半句掩護而假通過——
// 「這個同意是用在哪個條件下」是語意關係，沒有字串載體（memory semantic-relations-have-no-string-carrier）。
// ⇒ 改成逐字審定：卡片任何文字欄位、圖說、圖卡「左格→右格」只要講到同意／授權／先問（含同義詞），就必須逐字等於下面審過的句子。
//   要改寫這類句子：改內容的同時改這份清單，送審讓審查者看語意；測試只保證「沒有未經審定的說法混進來」。
const CR_ASK = /同意|授權|先問|問過|允許|許可|徵得|徵求|准許|答應/;
const CR_APPROVED = [   // [第幾張, 句子, 類別：free＝合理引用不用先問／need＝超出才要授權或同意／other]
  [0, "合理引用不用先問作者，但四件事都要做到：", "free"],
  [0, "超出合理引用的複製、上傳、賣，要先取得授權。", "need"],
  [0, "用自己的話寫讀後心得，不用先問作者。", "other"],
  [0, "合理引用，不用先問，但要寫上作者和書名。", "free"],
  [0, "整篇貼上不是引用，要先問作者同意。", "need"],
  [0, "這是合理引用，還是超出合理引用、要先取得授權？", "other"],
  [0, "著作權：作品一完成作者就有著作權；合理引用四件事都做到，不用先問；超出合理引用的複製、上傳、賣，要先取得授權；用自己的話寫心得可以", "other"],
  [0, "合理引用→四件事做到，不用先問", "free"],
  [0, "超出合理引用→複製、上傳、賣要先授權", "need"],
  [0, "用自己的話寫心得→可以，不用先問", "other"],
  [1, "合理引用不用先問，但一定要寫出處。", "free"],
  [1, "超出合理引用的複製、上傳，要先取得授權。", "need"],
  [1, "「我想把阿姨拍的整張照片放上網，先問她可不可以。」", "other"],
  [1, "整張放上網超出合理引用，先問、得到同意再用才對。", "need"],
];
function crUnits(x) {
  const leaves = (o, out) => { if (typeof o === "string") out.push(o); else if (Array.isArray(o)) o.forEach((v) => leaves(v, out)); else if (o && typeof o === "object") Object.keys(o).forEach((k) => leaves(o[k], out)); return out; };
  const svg = x.svg();
  const nodes = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]).filter((s) => s.trim());
  const aria = (/aria-label="([^"]*)"/.exec(svg) || [, ""])[1];
  // 圖卡每格連同左格一起比（條件寫在左格）：左右對調也會變成清單外的組合
  return leaves(x, []).concat([aria], nodes.map((s, i) => (CR_ASK.test(s) ? nodes[i - 1] + "→" + s : null)).filter(Boolean));
}
test("㉑著作權補救解說：講到同意／授權／先問的每一句都必須逐字是審定過的句子；兩張卡都要同時講到「合理引用不用先問」與「超出才要授權」", () => {
  const bad = [];
  X.EXPLAIN.cr.forEach((x, ci) => {
    const ok = new Map(CR_APPROVED.filter(([c]) => c === ci).map(([, t, k]) => [t, k]));
    const units = crUnits(x);
    units.forEach((u) => { if (CR_ASK.test(u) && !ok.has(u)) bad.push("第" + (ci + 1) + "張：未審定的說法「" + u + "」"); });
    const kinds = new Set(units.filter((u) => ok.has(u)).map((u) => ok.get(u)));
    if (!kinds.has("free")) bad.push("第" + (ci + 1) + "張：沒講到合理引用不用先問");
    if (!kinds.has("need")) bad.push("第" + (ci + 1) + "張：沒講到超出合理引用才要授權或同意");
  });
  assert.deepEqual(bad, []);
});
// ㉑的自檢：Codex 審 9daba41、899b730 的三種反例（分號、逗號、換行）與同義詞、左右格對調，都必須被抓到
test("㉑自檢：分號／逗號／換行反例、同義詞、圖卡左右格對調都會被擋", () => {
  const base = X.EXPLAIN.cr[1];
  const variants = [
    ["分號", "合理引用要先取得同意；用自己的話寫心得不用先問。"],
    ["逗號", "合理引用要先取得同意，寫心得不用先問"],
    ["換行", "合理引用要先取得同意\n寫心得不用先問"],
    ["同義詞", "合理引用也要作者允許才能用。"],
  ];
  variants.forEach(([name, line]) => {
    const x = Object.assign({}, base, { lines: base.lines.slice(0, 3).concat([line], base.lines.slice(4)) });
    const units = crUnits(x), ok = new Set(CR_APPROVED.filter(([c]) => c === 1).map(([, t]) => t));
    assert.ok(units.some((u) => CR_ASK.test(u) && !ok.has(u)), name + " 反例沒被擋");
  });
  const card0 = X.EXPLAIN.cr[0], swapped = Object.assign({}, card0, { svg: () => card0.svg().replace(">合理引用<", ">__L__<").replace(">超出合理引用<", ">合理引用<").replace(">__L__<", ">超出合理引用<") });
  const ok0 = new Set(CR_APPROVED.filter(([c]) => c === 0).map(([, t]) => t));
  assert.ok(crUnits(swapped).some((u) => CR_ASK.test(u) && !ok0.has(u)), "圖卡左右格對調沒被擋");
});
