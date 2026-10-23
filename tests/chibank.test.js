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
const VID = require("../src/chivideos.js");
const ROOT = path.join(__dirname, "..");
const MAX_SENTENCE = 40;
const sentences = (t) => String(t == null ? "" : t).split(/[。！？；\n]/).map((s) => s.trim()).filter(Boolean);
const long = (t) => sentences(t).filter((s) => s.length > MAX_SENTENCE);
const DICT_URL = /^https:\/\/dict\.concised\.moe\.edu\.tw\/dictView\.jsp\?ID=\d+$/;

test("①每題：選擇題、至少 2 個選項、選項不重複、答案編號在選項內", () => {
  const bad = [];
  B.ALL_CARDS.forEach((c) => {
    if (c.type !== "choice") bad.push(c.id + " 不是選擇題");
    if (!Array.isArray(c.opts) || c.opts.length < 2) bad.push(c.id + " 選項少於 2 個");
    if (new Set(c.opts).size !== c.opts.length) bad.push(c.id + " 選項重複");
    if (!(Number.isInteger(c.a) && c.a >= 0 && c.a < c.opts.length)) bad.push(c.id + " 答案編號不在選項內");
  });
  assert.deepEqual(bad, []);
});

// 2026-10-14：tests/e2e.py 用題目文字反查題庫（current_card），題目文字重複就會拿錯答案（第一課四題「找錯字」曾同一句）
test("②-b 題目文字不重複", () => {
  const seen = {}, dup = [];
  B.ALL_CARDS.forEach((c) => { if (seen[c.q]) dup.push(seen[c.q] + "／" + c.id + "：" + c.q); else seen[c.q] = c.id; });
  assert.deepEqual(dup, []);
});

test("②每個錯誤選項都有 wrongWhy（非空），正解那格是空字串；id 不重複", () => {
  const bad = [];
  const ids = new Set();
  B.ALL_CARDS.forEach((c) => {
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
  B.ALL_CARDS.forEach((c) => [c.q, c.why, c.hint].concat(c.opts, c.wrongWhy).forEach((t) => long(t).forEach((s) => bad.push(c.id + "（" + s.length + "）：" + s))));
  Object.keys(B.CONCEPTS).forEach((k) => [B.CONCEPTS[k].exit, B.CONCEPTS[k].exitAns].forEach((t) => long(t).forEach((s) => bad.push(k + " 出口題：" + s))));
  Object.keys(X.EXPLAIN).forEach((k) => X.EXPLAIN[k].forEach((ex) => ex.lines.concat([ex.task, ex.ask], (ex.examples || []).map((e) => e.s + "。" + e.why))
    .forEach((t) => long(t).forEach((s) => bad.push(k + " 說明：" + s)))));
  Object.keys(X.PREDICT).forEach((k) => [X.PREDICT[k].q, X.PREDICT[k].why].concat(X.PREDICT[k].opts).forEach((t) => long(t).forEach((s) => bad.push(k + " 先猜：" + s))));
  assert.deepEqual(bad, []);
});

test("④每個觀念都有題，8～15 題；每題的觀念都存在；每題標「自編題（未對課本）」", () => {
  const n = {};
  B.ALL_CARDS.forEach((c) => { n[c.concept] = (n[c.concept] || 0) + 1; });
  const bad = Object.keys(B.CONCEPTS).filter((k) => !(n[k] >= 8 && n[k] <= 15)).map((k) => k + "：" + (n[k] || 0) + " 題");
  // 國練第二課（單元 k6）的題目出處寫「國練第二課第 6 頁的字詞（題目自編）」：字詞照抄國練，題目是自己出的
  B.ALL_CARDS.forEach((c) => {
    if (!B.CONCEPTS[c.concept]) { bad.push(c.id + " 觀念不存在：" + c.concept); return; }
    const ok = B.CONCEPTS[c.concept].unit === "k6" ? (c.page === B.P6_PAGE || c.page === B.P7_PAGE) : c.page === "自編題（未對課本）";
    if (!ok) bad.push(c.id + " page 不對：" + c.page);
  });
  Object.keys(B.CONCEPTS).forEach((k) => { if (!B.UNITS[B.CONCEPTS[k].unit]) bad.push(k + " 單元不存在"); if (B.CONCEPTS[k].unit === "3") bad.push(k + " 單元代號不可用 \"3\"（core.js 會當成待開放單元）"); });
  assert.deepEqual(bad, []);
  // 2026-10-14 加第一課字形、多音字三個觀念（34 題）與國練第二課五個觀念（64 題）後，上限 130 → 230
  // 2026-10-18 依考古卷加第三～六課五個觀念（43 題，交辦 #2703）後 → 280；每天量另由排程模擬把關（國語每天增量 ≤5 題為原則）
  assert.ok(B.ALL_CARDS.length >= 90 && B.ALL_CARDS.length <= 280, "總題數 " + B.ALL_CARDS.length);
});

// ㉒ 字形（zx*、w2a–w2c）、字音（dy*、w2d）、字義（w2e）：每題對 tests/fixtures/dict_l1.json（tests/build_dict_fixture.py 產生，教育部兩本辭典的查詢結果）
//    與 src/chibank.js 的 P6／SHU（國練第二課第 6 頁照抄）。
//    讀音一律以《國語辭典簡編本》（concised）為準：國練 38 個字的注音和它逐字一致；《重編本》另列語音／讀音／又音（例如熟另有讀音ㄕㄨˊ），不拿來判讀音。
//    「沒有這個詞」要《重編國語辭典修訂本》（收詞最多）與簡編本都查無。
//    填字題：正確的詞查得到（國練題：是國練這一頁的詞）、錯字組成的詞兩本都查無；國練題的錯項必須是國練同一組的形近字。
//    讀音題：正解＝國練標的注音＝簡編本的讀音；錯項讀音不能也是這個字的讀音；錯法說明「X是「Y」的讀音」要真的是 Y 在國練的注音。
//    字義題：正解是國練列的意思，詞真的列在那個意思底下。
const DICT_L1 = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "dict_l1.json"), "utf8")).words;
const PAGE = {};
(B.P6 || []).forEach((g) => g.forEach((e) => { PAGE[e[0]] = { read: e[1], words: e[2], group: g.map((x) => x[0]) }; }));
const PAGE_WORDS = new Set(Object.values(PAGE).flatMap((p) => p.words));
// 第三～六課字形題的部首欄位（結構檢查）：zx.rad 必填且等於簡編本；zx.radPos 必填，值是 上下左右外裡 或 null（解說不講部首）。
// 2026-10-18 連 4 輪 Codex FAIL 後（設計者 L20261018080918-e4f31c 方案②）：解說／提示這些自由文字「講得對不對」不再用句型比對判斷
// （有限句型永遠追不上任意中文敘述），改由 ㉖ 審定快照釘住每一個字，改字就要重審。
const K7_ZX = new Set(["zxc", "zxd"]);
const RAD_POS = new Set(["上", "下", "左", "右", "外", "裡"]);
function l1Problems(cards, dict) {
  const bad = [], known = (w) => !!dict[w], con = (w) => (dict[w] && dict[w].concised) || [];
  const inDict = (w) => known(w) && (dict[w].revised.length > 0 || dict[w].concised.length > 0);
  const syl = (w, ch) => { const r = (con(w)[0] || "").split(" "); return r.length === w.length ? r[w.indexOf(ch)] : null; };
  const S = B.SHU, shuOf = (w) => S.findIndex((s) => s[1].indexOf(w) >= 0);
  cards.forEach((c) => {
    const id = c.id;
    if (c.zx && c.zx.word) {
      if (c.zx.page) {
        const p = PAGE[c.zx.ch];
        if (!p || p.words.indexOf(c.zx.word) < 0) bad.push(id + "「" + c.zx.word + "」不是國練這一頁的詞");
        c.opts.forEach((o, i) => { if (i !== c.a && !(p && p.group.indexOf(o) >= 0)) bad.push(id + " 錯項「" + o + "」不是國練同一組的形近字"); });
      } else if (!inDict(c.zx.word)) bad.push(id + " 辭典查不到「" + c.zx.word + "」");
      if (c.opts[c.a] !== c.zx.ch) bad.push(id + " 正解不是「" + c.zx.ch + "」");
      // 2026-10-18 第三～六課字形題：解說講的偏旁（zx.rad）要等於簡編本的部首
      if (c.zx.rad && (dict[c.zx.ch] || {}).concised_radical !== c.zx.rad) bad.push(id + "「" + c.zx.ch + "」部首寫 " + c.zx.rad + "，簡編本是 " + (dict[c.zx.ch] || {}).concised_radical);
      if (K7_ZX.has(c.concept) && !c.zx.rad) bad.push(id + " 第三～六課字形題要寫 zx.rad（部首）");
      if (K7_ZX.has(c.concept) && !(c.zx.radPos === null || RAD_POS.has(c.zx.radPos))) bad.push(id + " zx.radPos 要是上下左右外裡或 null：" + c.zx.radPos);
      c.zx.wrong.forEach((w) => {
        if (!known(w)) bad.push(id + "「" + w + "」沒查過");
        else if (inDict(w)) bad.push(id + " 錯項「" + w + "」辭典其實有");
        else if (PAGE_WORDS.has(w)) bad.push(id + " 錯項「" + w + "」是國練上的詞");
      });
    } else if (c.zx) {
      if (c.opts[c.a] !== c.zx.bad) bad.push(id + " 正解不是錯的詞");
      if (!known(c.zx.bad) || inDict(c.zx.bad)) bad.push(id + "「" + c.zx.bad + "」沒查過或辭典其實有");
      [c.zx.good].concat(c.zx.ok).forEach((w) => { if (!inDict(w)) bad.push(id + " 辭典查不到「" + w + "」"); });
    }
    if (c.dy) {
      c.dy.words.forEach((w) => { if (con(w).length !== 1) bad.push(id + "「" + w + "」簡編本查無或不只一種讀法：" + JSON.stringify(con(w))); });
      if (bad.some((b) => b.indexOf(id + " ") === 0 || b.indexOf(id + "「") === 0)) return;
      const [first, ...rest] = c.dy.words;
      if (syl(first, c.dy.ch) !== c.dy.read) bad.push(id + "「" + first + "」的「" + c.dy.ch + "」簡編本讀 " + syl(first, c.dy.ch) + "，題目說 " + c.dy.read);
      if (c.opts[c.a] !== (/怎麼讀/.test(c.q) ? c.dy.read : first)) bad.push(id + " 正解和 dy 欄位對不上");
      if (/怎麼讀/.test(c.q)) {
        const other = c.opts.filter((o, i) => i !== c.a);
        if (other.length !== 1 || syl(rest[0], c.dy.ch) !== other[0]) bad.push(id + " 另一個讀音和例詞「" + rest[0] + "」對不上");
      } else rest.forEach((w) => { if (syl(w, c.dy.ch) === c.dy.read) bad.push(id + " 錯項「" + w + "」其實也讀 " + c.dy.read); });
    }
    if (c.yin) {
      const y = c.yin;
      if (c.opts[c.a] !== y.read) bad.push(id + " 正解和 yin.read 對不上");
      if (y.word) { if (con(y.word).length !== 1 || syl(y.word, y.ch) !== y.read) bad.push(id + "「" + y.word + "」的「" + y.ch + "」簡編本讀 " + syl(y.word, y.ch)); }
      else {
        if (!PAGE[y.ch] || PAGE[y.ch].read !== y.read) bad.push(id + "「" + y.ch + "」和國練標的注音不同");
        if (con(y.ch).indexOf(y.read) < 0) bad.push(id + "「" + y.ch + "」簡編本沒有 " + y.read + "：" + JSON.stringify(con(y.ch)));
      }
      y.others.forEach((o) => { if (con(y.ch).indexOf(o) >= 0) bad.push(id + " 錯項讀音 " + o + " 其實也是「" + y.ch + "」的讀音"); });
      c.opts.forEach((o, i) => {
        const m = /^(.+)是「(.)」的讀音/.exec(c.wrongWhy[i] || "");
        if (m && (m[1] !== o || !PAGE[m[2]] || PAGE[m[2]].read !== o)) bad.push(id + " 錯法說明對不上國練：" + c.wrongWhy[i]);
      });
    }
    if (c.yinPick) {
      const y = c.yinPick;
      if (c.opts[c.a] !== y.ch || !PAGE[y.ch] || PAGE[y.ch].read !== y.read || con(y.ch).indexOf(y.read) < 0) bad.push(id + "「" + y.ch + "」不讀 " + y.read);
      y.others.forEach((o) => { if (!PAGE[o] || PAGE[o].read === y.read || con(o).indexOf(y.read) >= 0) bad.push(id + " 錯項「" + o + "」其實也讀 " + y.read); });
    }
    if (c.yi) {
      if (shuOf(c.yi.word) !== c.yi.n || c.opts[c.a] !== S[c.yi.n][0]) bad.push(id + "「" + c.yi.word + "」不在國練「" + c.opts[c.a] + "」底下");
      c.opts.forEach((o, i) => { if (i !== c.a && S.findIndex((s) => s[0] === o) < 0) bad.push(id + " 錯項「" + o + "」不是國練列的意思"); });
    }
    if (c.yiPick) {
      const y = c.yiPick;
      if (c.opts[c.a] !== y.word || shuOf(y.word) !== y.n) bad.push(id + "「" + y.word + "」不在國練「" + S[y.n][0] + "」底下");
      y.others.forEach((w) => { const k = shuOf(w); if (k < 0 || k === y.n) bad.push(id + " 錯項「" + w + "」不是國練列的詞或其實是同一個意思"); });
    }
  });
  return bad;
}
test("㉒字形、字音、字義題，逐題對得上教育部辭典與國練原頁", () => {
  const l1 = B.ALL_CARDS.filter((c) => c.zx || c.dy || c.yin || c.yinPick || c.yi || c.yiPick);
  assert.ok(l1.length >= 90, "字形字音字義題只有 " + l1.length + " 題");
  assert.deepEqual(l1Problems(l1, DICT_L1), []);
});
// 照片抄錯注音的防線：國練第 6 頁每個字的注音，簡編本必須有；國練每個詞若簡編本有收，那個字的讀音要一樣
test("㉒國練第 6 頁的注音（從照片抄的）和簡編本一致", () => {
  const bad = [], con = (w) => (DICT_L1[w] && DICT_L1[w].concised) || null;
  Object.keys(PAGE).forEach((ch) => {
    const r = con(ch);
    if (!r) bad.push(ch + " 沒查過"); else if (r.indexOf(PAGE[ch].read) < 0) bad.push(ch + "：國練 " + PAGE[ch].read + "，簡編本 " + JSON.stringify(r));
    PAGE[ch].words.forEach((w) => {
      const wr = con(w);
      if (!wr || !wr.length) return;   // 簡編本沒收的詞（例如繞境）只能以國練為準
      const ok = wr.some((x) => { const s = x.split(" "); return s.length === w.length && s[w.indexOf(ch)] === PAGE[ch].read; });
      if (!ok) bad.push(w + "：國練的「" + ch + "」標 " + PAGE[ch].read + "，簡編本 " + JSON.stringify(wr));
    });
  });
  assert.deepEqual(bad, []);
});
test("㉒自檢-反例：把讀音改錯、把錯項換成辭典有的詞、把字義放錯，都要抓到", () => {
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const d1 = clone(B.ALL_CARDS.find((c) => c.id === "dy1")); d1.dy.read = "ㄍㄨㄥˋ"; d1.opts[d1.a] = "ㄍㄨㄥˋ";
  assert.ok(l1Problems([d1], DICT_L1).length > 0, "讀音改錯沒抓到");
  const z = clone(B.ALL_CARDS.find((c) => c.id === "zx7")); z.zx.wrong[0] = "跳繩";
  assert.ok(l1Problems([z], DICT_L1).length > 0, "錯項換成辭典有的詞沒抓到");
  const d7 = clone(B.ALL_CARDS.find((c) => c.id === "dy7")); d7.dy.words.push("間隔");
  assert.ok(l1Problems([d7], DICT_L1).length > 0, "錯項其實也讀ㄐㄧㄢˋ沒抓到");
  const r2 = clone(B.ALL_CARDS.find((c) => c.id === "w2d2")); r2.yin.read = "ㄖㄠˋ"; r2.opts[r2.a] = "ㄖㄠˋ";
  assert.ok(l1Problems([r2], DICT_L1).length > 0, "國練讀音改錯沒抓到");
  const s13 = clone(B.ALL_CARDS.find((c) => c.id === "w2d13")); s13.yin.read = "ㄕㄠˋ"; s13.opts[s13.a] = "ㄕㄠˋ";
  assert.ok(l1Problems([s13], DICT_L1).length > 0, "稍息改成ㄕㄠˋ沒抓到");
  const f = clone(B.ALL_CARDS.find((c) => c.id === "w2b4")); f.zx.wrong = ["燒水"];
  assert.ok(l1Problems([f], DICT_L1.燒水 ? DICT_L1 : Object.assign({ 燒水: { revised: ["ㄕㄠ ㄕㄨㄟˇ"], concised: [] } }, DICT_L1)).length > 0, "燒水（真的詞）當錯項沒抓到");
  const g = clone(B.ALL_CARDS.find((c) => c.id === "w2a1")); g.opts.push("秦");
  assert.ok(l1Problems([g], DICT_L1).length > 0, "錯項不是同一組的形近字沒抓到");
  const m = clone(B.ALL_CARDS.find((c) => c.id === "w2e6")); m.yi.word = "熟人";
  assert.ok(l1Problems([m], DICT_L1).length > 0, "字義放錯沒抓到");
  const r3 = clone(B.ALL_CARDS.find((c) => c.id === "zx3a")); r3.zx.rad = "土";
  assert.ok(l1Problems([r3], DICT_L1).length > 0, "部首寫錯（璧寫成土部）沒抓到");
  const r6 = clone(B.ALL_CARDS.find((c) => c.id === "zx3a")); delete r6.zx.rad;
  assert.ok(l1Problems([r6], DICT_L1).length > 0, "第三～六課字形題沒寫 zx.rad 沒抓到");
  const r11 = clone(B.ALL_CARDS.find((c) => c.id === "zx3a")); delete r11.zx.radPos;
  assert.ok(l1Problems([r11], DICT_L1).length > 0, "沒寫 radPos 沒抓到");
  const r14 = clone(B.ALL_CARDS.find((c) => c.id === "zx3a")); r14.zx.radPos = "中";
  assert.ok(l1Problems([r14], DICT_L1).length > 0, "radPos 值不合法沒抓到");
});

// ㉓ 填字題的句子：把正確的字填回括號，句子裡要出現那個詞（Codex 審 aaa3dbe：zx14「圖書館（　）供」挖錯位置，填回去變「供供」）
// Codex 審 c8f6d18：只查整句有沒有那個詞，「圖書館（　）供好書，提供大家閱讀」會因別處的「提供」過關 ⇒
// 每一個空格填回去後，都要被那個詞的某一次出現蓋住（詞跨過空格）；空格數＝詞裡這個字出現的次數（津津有味兩格）。
const blankBad = (cards) => cards.filter((c) => c.zx && c.zx.word).filter((c) => {
  const m = /^「(.+)」括號裡要填哪個字？$/.exec(c.q);
  if (!m) return true;
  const parts = m[1].split("（　）"), n = parts.length - 1;
  if (n < 1 || n !== c.zx.word.split(c.zx.ch).length - 1) return true;
  const filled = parts.join(c.zx.ch), pos = [];
  let k = 0; for (let i = 0; i < n; i++) { k += parts[i].length; pos.push(k); k += 1; }
  const occ = []; let j = filled.indexOf(c.zx.word); while (j >= 0) { occ.push(j); j = filled.indexOf(c.zx.word, j + 1); }
  return !pos.every((p) => occ.some((o) => p >= o && p < o + c.zx.word.length));
}).map((c) => c.id + "：" + c.q);
test("㉓填字題把正確的字填回去，句子裡要有那個詞（挖空位置正確）", () => {
  assert.deepEqual(blankBad(B.ALL_CARDS), []);
  const z = JSON.parse(JSON.stringify(card("zx14"))); z.q = "「圖書館（　）供很多好書給我們借」括號裡要填哪個字？";
  assert.deepEqual(blankBad([z]).length, 1, "自檢：zx14 舊題幹（挖錯位置）要抓到");
  const z2 = JSON.parse(JSON.stringify(card("zx14"))); z2.q = "「圖書館（　）供好書，提供大家閱讀」括號裡要填哪個字？";
  assert.deepEqual(blankBad([z2]).length, 1, "自檢：別處另有那個詞（Codex 反例）也要抓到");
  const z3 = JSON.parse(JSON.stringify(card("zx14"))); z3.q = "「圖書館提（　）好書，（　）大家閱讀」括號裡要填哪個字？";
  assert.deepEqual(blankBad([z3]).length, 1, "自檢：兩個空格要抓到");
});

// ⑤ 反義／近義：src 是國語辭典簡編本的條目網址；正解在該條目的相反詞（或相似詞）欄；其他選項都不在同一欄；
//    錯法說明若說某選項「意思相近／是近義詞」或「是反義詞」，該選項必須真的在辭典的另一欄（防止解說亂講）
test("⑤反義詞、近義詞題都有辭典 src，正解在辭典欄位裡、其他選項不在", () => {
  const bad = [];
  B.ALL_CARDS.filter((c) => c.concept === "an" || c.concept === "sy").forEach((c) => {
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
  B.ALL_CARDS.filter((c) => c.concept === "rh1" || c.concept === "rh2").forEach((c) => {
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
  const c = JSON.parse(JSON.stringify(B.ALL_CARDS.find((x) => x.id === "rh1a")));
  const i = c.opts.indexOf("擬人"); c.a = i;
  const s = quoted(c.q);
  assert.ok(CLUE["譬喻"](s) && c.opts.indexOf("譬喻") >= 0 && c.opts[c.a] !== "譬喻");
});

// ⑦ 史實（hs）與著作權（cr）題：每題要有 src，而且 tests/FACTCHECK.md 逐題列出依據
test("⑦史實、著作權、標點題都有 src，且每題 id 都列在 tests/FACTCHECK.md", () => {
  const fc = fs.readFileSync(path.join(__dirname, "FACTCHECK.md"), "utf8");
  const bad = [];
  B.ALL_CARDS.filter((c) => c.concept === "hs" || c.concept === "cr" || c.concept === "bd").forEach((c) => {   // bd 標點：2026-10-18 加，依《重訂標點符號手冊》
    if (!/^https:\/\//.test(c.src || "")) bad.push(c.id + " 沒有 src");
    if (!new RegExp("\\b" + c.id + "\\b").test(fc)) bad.push(c.id + " 沒列在 FACTCHECK.md");
  });
  assert.deepEqual(bad, []);
});

// ⑧ 出口題（app.html 對家長說「這些題目在練習裡沒出現過」）不得和練習題、先猜題、說明例句同題
const norm = (s) => String(s).replace(/^(說說看|先猜猜看)[：:]?/, "").replace(/[^一-鿿]/g, "");
test("⑧出口題不和練習題、先猜題、例句同題", () => {
  const seen = B.ALL_CARDS.map((c) => [c.id, c.q]).concat(Object.keys(X.PREDICT).map((k) => ["先猜 " + k, X.PREDICT[k].q]),
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

// ⑩ 隱私：網頁（index.html，含內嵌的程式碼與註解）不出現學校名稱等不公開字詞。
//    字詞清單在本機不公開的 ~/Documents/g5-curriculum/curriculum.json（2026-10-18 起；舊版把校名直接寫在這裡＝公開 repo 自己洩漏）。
//    六站全部檔案與 push 的 commit 訊息另由那裡的 check.py 在 git pre-push 擋。
const PRIVATE = path.join(require("os").homedir(), "Documents", "g5-curriculum", "curriculum.json");
test("⑩index.html 不出現學校名稱等不公開字詞", { skip: !fs.existsSync(PRIVATE) && "這台沒有不公開字詞清單（pre-push 的 check.py 才是主閘）" }, () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const terms = JSON.parse(fs.readFileSync(PRIVATE, "utf8")).private_terms;
  assert.ok(terms.length > 0, "不公開字詞清單是空的");
  assert.deepEqual(terms.filter((t) => html.includes(t)).map((t) => terms.indexOf(t) + 1), [], "index.html 出現第幾個不公開字詞");
});

// ⑪～⑳：Codex 審 e0ad0ad8（2026-10-13）逐項 FAIL 的回歸測試。每條先在舊內容上紅，再改內容到綠。
const card = (id) => B.ALL_CARDS.find((c) => c.id === id);
const optWhy = (c, o) => c.wrongWhy[c.opts.indexOf(o)];
const GENRES = ["詩歌", "說明文", "記敘文", "歷史故事", "童話", "寓言"];
const FC = fs.readFileSync(path.join(__dirname, "FACTCHECK.md"), "utf8");

test("⑪文體題：錯項是文體名稱時，不能拿「分不分行」當排除理由（排版不是文體的充分條件）", () => {
  const bad = [];
  B.ALL_CARDS.filter((c) => c.concept === "ga").forEach((c) => c.opts.forEach((o, i) => {
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
  const bad = B.ALL_CARDS.filter((c) => c.opts[c.a] === "引用" && c.opts.indexOf("譬喻") >= 0 && METAPHOR_PROVERBS.test(c.q)).map((c) => c.id + "：" + c.q);
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
  const bad = B.ALL_CARDS.flatMap((c) => c.wrongWhy.filter((w) => /「安靜」是沒有聲音/.test(w)).map((w) => c.id + "：" + w));
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

// 2026-10-19 範圍稽核改寫：舊⑳要求講合理引用四要件；第五課〈超級英雄〉教的是「影片、圖片、文章都要先取得創作者的同意與授權」，
// 合理引用、登記、讀後心得不用問都是課外著作權法（公開教案主旨），和課文方向相反會讓她照課文推時答錯 ⇒ 反過來：主訊息要有、課外條件不准出現。
const CR_OUT = /合理引用|合理使用|合理範圍|四件事|已公開發表|登記|讀後心得|寫心得|不用先問|不必先問/;
test("⑳著作權補救解說與先猜題照第五課主訊息：要先取得同意與授權、寫上作者和出處；不教課外的合理引用條件、登記、讀後心得不用問", () => {
  const all = X.EXPLAIN.cr.map((x) => x.name + x.svg() + x.lines.join("") + x.ask + x.task + (x.examples || []).map((y) => y.s + y.why).join("")).join("");
  ["同意", "授權", "作者", "出處"].forEach((k) => assert.ok(all.indexOf(k) >= 0, "缺第五課主訊息：" + k));
  assert.equal((all.match(CR_OUT) || [""])[0], "", "解說仍教課外的著作權法條件");
  const p = X.PREDICT.cr, pt = [p.q, p.why].concat(p.opts).join("");
  assert.ok(/同意/.test(p.opts[p.a]) && /授權/.test(p.opts[p.a]), "先猜題正解不是「先取得同意與授權」：" + p.opts[p.a]);
  assert.equal((pt.match(CR_OUT) || [""])[0], "", "先猜題仍考課外的著作權法條件");
  // 自檢：把舊內容的句子放回去要抓得到
  ["作品一完成，作者就有著作權，不用登記。", "合理引用不用先問作者，但四件事都要做到：", "用自己的話寫讀後心得，不用先問作者。"].forEach((t) => assert.ok(CR_OUT.test(t), "CR_OUT 沒抓到舊句：" + t));
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
// 2026-10-19 範圍稽核：內容改成第五課主訊息（先取得同意與授權、寫上作者和出處），審定句換成新的四句；
// 下面的反例跟著換：意思從「合理引用要先問」（推翻舊內容）改成「分享不用先問」（推翻新內容），位置與檢查方式不變。
const SNAP = require("./cr_snapshot.js");
const CR_PINS = [   // [第幾張（從 0 起）, lines 第幾句, 審定句, 這句承載的意思]
  [0, 2, "得到創作者的同意與授權，才算合法使用。", "要先取得同意與授權"],
  [0, 3, "使用的時候，要寫上作者和出處。", "寫上作者和出處"],
  [1, 3, "得到同意與授權，才能使用、才能分享。", "要先取得同意與授權"],
  [1, 4, "用的時候，記得寫上作者和出處。", "寫上作者和出處"],
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
test("㉑著作權補救解說：整份內容（每個欄位、例句配對與順序、圖卡元素樹與全部屬性）等於審定快照 tests/cr_approved_snapshot.json；第一張 lines[2]／[3]、第二張 lines[3]／[4] 是「先取得同意與授權」「寫上作者和出處」審定句", () => {
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
  { id: "1", what: "同義詞：第二張 lines[0] →「分享別人的作品不用先詢問作者。」", mutate: (C) => { C[1].lines[0] = "分享別人的作品不用先詢問作者。"; },
    hit: [["snapshot", "cr[1].lines[0]", "→ \"分享別人的作品不用先詢問作者。\""]] },
  { id: "2", what: "配對拆散：第一張 examples[1].s →「「把整篇文章貼到自己的網站。」」，why 不變", mutate: (C) => { C[0].examples[1].s = "「把整篇文章貼到自己的網站。」"; },
    hit: [["snapshot", "cr[0].examples[1].s", "→ \"「把整篇文章貼到自己的網站。」\""]] },
  { id: "3", what: "tspan：第二張圖卡新增 <text x=\"10\" y=\"145\"><tspan>分享別人的作品不用先問。</tspan></text>",
    mutate: (C) => svgEdit(C[1], (s) => rep1(s, "</svg>", '<text x="10" y="145"><tspan>分享別人的作品不用先問。</tspan></text></svg>')),
    hit: [["snapshot", "cr[1].svg.children[13]", "<tspan>分享別人的作品不用先問。</tspan>"]] },
  { id: "4", what: "審定句錯配：第一張 examples[1].why ↔ examples[2].why", mutate: (C) => { const e = C[0].examples, w = e[1].why; e[1].why = e[2].why; e[2].why = w; },
    hit: [["snapshot", "cr[0].examples[1].why", "→ \"音樂也是作品"], ["snapshot", "cr[0].examples[2].why", "→ \"先得到畫的人同意"]] },
  { id: "5", what: "標題漏檢：第二張 name →「分享別人的作品不用先問」", mutate: (C) => { C[1].name = "分享別人的作品不用先問"; },
    hit: [["snapshot", "cr[1].name", "→ \"分享別人的作品不用先問\""]] },
  { id: "6", what: "任務漏檢：第二張 task →「分享別人的作品前，不用先問作者。」", mutate: (C) => { C[1].task = "分享別人的作品前，不用先問作者。"; },
    hit: [["snapshot", "cr[1].task", "→ \"分享別人的作品前，不用先問作者。\""]] },
  { id: "7", what: "提問漏檢：第二張 ask →「分享別人的作品前，為什麼不用先問？」", mutate: (C) => { C[1].ask = "分享別人的作品前，為什麼不用先問？"; },
    hit: [["snapshot", "cr[1].ask", "→ \"分享別人的作品前，為什麼不用先問？\""]] },
  { id: "8", what: "無障礙文字：第二張圖卡根 aria-label →「分享別人的作品不用先問作者。」",
    mutate: (C) => svgEdit(C[1], (s) => { const m = s.match(/ aria-label="[^"]*"/g) || []; return rep1(s, m.length === 1 ? m[0] : "（aria-label 不是剛好一個）", ' aria-label="分享別人的作品不用先問作者。"'); }),
    hit: [["snapshot", "cr[1].svg.attrs.aria-label", "→ \"分享別人的作品不用先問作者。\""]] },
  { id: "9", what: "SVG 篩選：第二張圖卡文字「我的畫」→「分享不用先問作者」", mutate: (C) => svgEdit(C[1], (s) => rep1(s, ">我的畫<", ">分享不用先問作者<")),
    hit: [["snapshot", "cr[1].svg.children[1].text", "→ \"分享不用先問作者\""]] },
  { id: "10", what: "entity：第二張圖卡新增 <text>，「分享別人的作品不用先問。」逐字寫成 &#十進位碼點;",
    mutate: (C) => svgEdit(C[1], (s) => rep1(s, "</svg>", "<text>" + charRefs("分享別人的作品不用先問。") + "</text></svg>")),
    hit: [["snapshot", "cr[1].svg.children[13]", "<text>分享別人的作品不用先問。</text>"]] },
  { id: "11", what: "圖文關係：第一張圖卡兩個 x=\"535.0\" 右格文字的 y=\"122.0\" ↔ \"192.0\"",
    mutate: (C) => svgEdit(C[0], (s) => rep1(rep1(rep1(s, 'x="535.0" y="122.0"', "@@Y@@"), 'x="535.0" y="192.0"', 'x="535.0" y="122.0"'), "@@Y@@", 'x="535.0" y="192.0"')),
    hit: [["snapshot", "cr[0].svg.children[13].attrs.y", "\"122.0\" → \"192.0\""], ["snapshot", "cr[0].svg.children[20].attrs.y", "\"192.0\" → \"122.0\""]] },
  { id: "12", what: "隱藏內容：第一張圖卡根節點加 style=\"display:none\"", mutate: (C) => svgEdit(C[0], (s) => rep1(s, "<svg ", '<svg style="display:none" ')),
    hit: [["parse", "cr[0].svg", "不認得的屬性 style"]] },
  { id: "13", what: "刪除被掩護：刪掉第一張 lines[2]（審定句「先取得同意與授權」）", mutate: (C) => { C[0].lines.splice(2, 1); },
    hit: [["snapshot", "cr[0].lines[2]", "少了這一項 \"得到創作者的同意與授權，才算合法使用。\""], ["structure", "cr[0].lines[2]"], ["structure", "cr[0].lines[3]"]] },
  { id: "14", what: "集合完整性：刪掉第二張卡", mutate: (C) => { C.splice(1, 1); },
    hit: [["snapshot", "cr[1]", "少了這一項 整張卡"], ["structure", "cr"]] },
  { id: "15", what: "順序遺失：第一張 lines[0] ↔ lines[2]", mutate: (C) => { const l = C[0].lines, x = l[0]; l[0] = l[2]; l[2] = x; },
    hit: [["snapshot", "cr[0].lines[0]", "→ \"得到創作者的同意與授權，才算合法使用。\""], ["snapshot", "cr[0].lines[2]", "→ \"影片、圖片、文章，都是創作者辛苦做出來的作品。\""]] },
  { id: "16", what: "schema 擴張：第二張新增 note 欄位「分享別人的作品不用先問作者。」", mutate: (C) => { C[1].note = "分享別人的作品不用先問作者。"; },
    hit: [["snapshot", "cr[1].note", "多了這個欄位 \"分享別人的作品不用先問作者。\""]] },
  { id: "17", what: "Unicode 零寬：第二張 lines[0] →「分享別人的作品不用先\\u200b問作者。」", mutate: (C) => { C[1].lines[0] = "分享別人的作品不用先\u{200B}問作者。"; },
    hit: [["snapshot", "cr[1].lines[0]", "→ \"分享別人的作品不用先\\u200b問作者。\""]] },
  { id: "18", what: "過度正規化：第一張 examples[0].s「…貼到自己的網站。」→「…貼到自己的網站？」", mutate: (C) => { C[0].examples[0].s = rep1(C[0].examples[0].s, "貼到自己的網站。", "貼到自己的網站？"); },
    hit: [["snapshot", "cr[0].examples[0].s", "→ \"「我想把網路上的文章貼到自己的網站？」\""]] },
  // 以下兩列：Codex 審 6c732ff（規則版本 1 在這兩列假通過）
  { id: "19", what: "屬性值過度正規化：第一張圖卡 width=\"270.0\" →「270 .0」", mutate: (C) => svgEdit(C[0], (s) => s.replace('width="270.0"', 'width="270 .0"')),   // 只換第一個（根下第一個元素）
    hit: [["snapshot", "cr[0].svg.children[0].attrs.width", "270 .0"]] },
  { id: "20", what: "schema 擴張（__proto__）：第二張新增自有欄位 __proto__「分享別人的作品不用先問作者。」",
    mutate: (C) => { Object.defineProperty(C[1], "__proto__", { value: "分享別人的作品不用先問作者。", enumerable: true, writable: true, configurable: true }); },
    hit: [["snapshot", "cr[1].__proto__", "分享別人的作品不用先問作者"]] },
  { id: "21", what: "schema 擴張（例句裡的 __proto__）：第一張 examples[0] 新增自有欄位 __proto__「分享別人的作品不用先問作者。」",
    mutate: (C) => { Object.defineProperty(C[0].examples[0], "__proto__", { value: "分享別人的作品不用先問作者。", enumerable: true, writable: true, configurable: true }); },
    hit: [["snapshot", "cr[0].examples[0].__proto__", "分享別人的作品不用先問作者"]] },
];
const T21_LEGACY = [   // abb1c94 以前的自檢反例（Codex 審 9daba41、899b730），新版照樣要紅
  ["分號", "分享別人的作品不用先問；寫上出處就好。"],
  ["逗號", "分享別人的作品不用先問，寫上出處就好"],
  ["換行", "分享別人的作品不用先問\n寫上出處就好"],
  ["同義詞", "分享別人的作品，不必徵求作者允許。"],
].map(([k, line], n) => ({ id: "舊" + (n + 1), what: "原有反例（" + k + "）：第二張 lines[3] → " + JSON.stringify(line), mutate: (C) => { C[1].lines[3] = line; },
  hit: [["snapshot", "cr[1].lines[3]"], ["structure", "cr[1].lines[3]"]] })).concat([
  { id: "舊5", what: "原有反例（圖卡左右格對調）：第一張圖卡左格「得到同意與授權」↔「沒問就拿來用」（變成「沒問就拿來用→才可以用」）",
    mutate: (C) => svgEdit(C[0], (s) => rep1(rep1(rep1(s, ">得到同意與授權<", ">@@L@@<"), ">沒問就拿來用<", ">得到同意與授權<"), ">@@L@@<", ">沒問就拿來用<")),
    hit: [["snapshot", "cr[0].svg.children[8].text"], ["snapshot", "cr[0].svg.children[22].text"]] },
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
      svgEdit(C[0], (s) => rep1(s, ">得到同意與授權<", ">" + charRefs("得到同意與授權", 2) + "<").replace(/；/g, "&#xff1b;"));
      svgEdit(C[1], (s) => rep1(rep1(s, ">我的畫<", ">" + charRefs("我的畫", 2) + "<"), "換位想一想", charRefs("換位想一想", 2)));
    } },
  { id: "正6", what: "NFC 等價：「都」「者」「者」「不」換成相容漢字 U+FA26、U+FA5B、U+FAB2、U+F967（NFC 後是同一個字；第二張 lines[4] 是審定句）",
    mutate: (C) => {
      C[0].lines[0] = rep1(C[0].lines[0], "都", "\u{FA26}");
      C[0].lines[1] = rep1(C[0].lines[1], "者", "\u{FA5B}");
      C[1].lines[4] = rep1(C[1].lines[4], "者", "\u{FAB2}");
      svgEdit(C[0], (s) => rep1(s, ">不尊重創作者<", ">\u{F967}尊重創作者<"));
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
// ㉔ 成語題（cy*）：每個選項都是 CY 表裡的成語，CY 的辭典關鍵字真的在教育部《成語典》（或《重編國語辭典修訂本》）的釋義裡，
//    src 是正解那一條的網址。辭典查詢結果存在 tests/fixtures/idioms.json（tests/build_idiom_fixture.py 產生）。
const IDIOMS = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "idioms.json"), "utf8")).idioms;
// Codex 審 c8f6d18：只驗辭典關鍵字 CY[o][1]，畫面顯示的白話說法 CY[o][0] 改成相反意思也過 ⇒
// 白話說法釘在下面這份審定表（改內容＝改這裡＋送審），解說與錯法說明必須照這份產生。
const CY_APPROVED = {
  "完璧歸趙": "把東西完好的還給原主", "負荊請罪": "主動向人認錯，請對方處罰", "肝膽相照": "朋友之間真心相待", "挺身而出": "遇到危難，勇敢的站出來",
  "雨後春筍": "新的事物一下子大量出現", "寓教於樂": "在遊戲、娛樂裡學到東西", "患得患失": "太在意得失，一直擔心", "來龍去脈": "事情從頭到尾的經過",
  "語重心長": "說的話真誠，用心很深", "神采飛揚": "精神很好、很得意的樣子"
};
function cyProblems(cards, CY, fx) {
  const bad = [];
  Object.keys(CY).forEach((k) => { if (CY[k][0] !== CY_APPROVED[k]) bad.push("CY「" + k + "」白話說法和審定表不同：" + CY[k][0]); });
  cards.forEach((c) => {
    const y = c.cy;
    if (c.opts[c.a] !== y.idiom) bad.push(c.id + " 正解不是 " + y.idiom);
    if (JSON.stringify(c.opts.filter((o, i) => i !== c.a).sort()) !== JSON.stringify(y.others.slice().sort())) bad.push(c.id + " 錯項和 cy.others 對不上");
    c.opts.forEach((o) => {
      const e = fx[o];
      if (!CY[o]) bad.push(c.id + "「" + o + "」不在 CY 表");
      else if (!e) bad.push(c.id + "「" + o + "」辭典查無");
      else if ((e.meaning + e.semantic).indexOf(CY[o][1]) < 0) bad.push(c.id + "「" + o + "」的關鍵字「" + CY[o][1] + "」不在辭典釋義裡");
    });
    if (!fx[y.idiom] || c.src !== fx[y.idiom].url) bad.push(c.id + " src 不是辭典那一條：" + c.src);
    if (c.why !== "「" + y.idiom + "」是" + CY_APPROVED[y.idiom] + "。") bad.push(c.id + " 解說不是審定的白話說法：" + c.why);
    c.opts.forEach((o, i) => { if (i !== c.a && c.wrongWhy[i] !== "「" + o + "」是" + CY_APPROVED[o] + "，不符合這句的意思。") bad.push(c.id + " 錯法說明不是審定的白話說法：" + c.wrongWhy[i]); });
  });
  return bad;
}
test("㉔成語題：選項都在 CY 表、白話說法的關鍵字在教育部辭典釋義裡、src 是那一條", () => {
  const cards = B.ALL_CARDS.filter((c) => c.cy);
  assert.ok(cards.length >= 8, "成語題只有 " + cards.length + " 題");
  assert.deepEqual(cyProblems(cards, B.CY, IDIOMS), []);
  // 自檢：關鍵字改成辭典沒有的話、src 指錯條，都要抓到
  const CY2 = JSON.parse(JSON.stringify(B.CY)); CY2["雨後春筍"][1] = "長得很快的竹筍";
  assert.ok(cyProblems(cards, CY2, IDIOMS).length > 0, "關鍵字不在辭典裡沒抓到");
  const c1 = JSON.parse(JSON.stringify(card("cy1"))); c1.src = IDIOMS["肝膽相照"].url;
  assert.ok(cyProblems([c1], B.CY, IDIOMS).length > 0, "src 指錯條沒抓到");
  // Codex 反例：白話說法改成相反意思、關鍵字不動
  const CY3 = JSON.parse(JSON.stringify(B.CY)); CY3["雨後春筍"][0] = "新的事物越來越少直到消失";
  assert.ok(cyProblems(cards, CY3, IDIOMS).length > 0, "白話說法改成相反意思沒抓到");
  const c5 = JSON.parse(JSON.stringify(card("cy5"))); c5.why = "「雨後春筍」是新的事物越來越少。";
  assert.ok(cyProblems([c5], B.CY, IDIOMS).length > 0, "解說改壞沒抓到");
});

// ㉕ 部首題（c.bs）：部首一律以《國語辭典簡編本》為準（fixture 的 concised_radical）。
//    same：正解和 target 同部首、錯項都不同；pair：正解那組兩字同部首、錯項每組兩字不同；common：正解就是兩字共同的部首、錯項都不是。
//    錯法說明若寫「X是Y部」，Y 要等於 X 的部首。
// Codex 審 c8f6d18：查無部首時 undefined === undefined 會被當成同部首 ⇒ 每個字都要查得到部首才比較。
// Codex 審 1e41707：用字串找「X是Y部」認不出說的是哪個字 ⇒ 解說與錯法說明改由 bs.rad 產生（src/chibank.js bsTexts）；
// 這裡用辭典部首照同一個模板重產一次，逐字比對；bs.rad 也要等於辭典。
// Codex 審 44a8dd4：原本允許照抄的補充說明可夾帶「坊是提手旁」⇒ 補充說明拿掉，解說必須和模板完全相同。提示是自由文字，由 ㉖ 審定快照釘住。
function bsExpect(c, R) {
  const b = c.bs, right = c.opts[c.a], wrong = c.opts.filter((o, i) => i !== c.a);
  const head = b.kind === "pair" ? "「" + right.split("、")[0] + "」和「" + right.split("、")[1] + "」都是" + R(right.split("、")[0]) + "部"
    : b.kind === "same" ? "「" + b.target + "」和「" + right + "」都是" + R(b.target) + "部"
    : "「" + b.chars[0] + "」和「" + b.chars[1] + "」的部首都是" + R(b.chars[0]);
  const ww = b.kind === "same" ? wrong.map((w) => "「" + w + "」是" + R(w) + "部，和「" + b.target + "」不同。")
    : b.kind === "pair" ? wrong.map((w) => { const x = w.split("、"); return "「" + x[0] + "」是" + R(x[0]) + "部，「" + x[1] + "」是" + R(x[1]) + "部。"; })
    : wrong.map((w) => "「" + w + "」不是這兩個字的部首；「" + b.chars[0] + "」「" + b.chars[1] + "」的部首都是" + R(b.chars[0]) + "。");
  return { why: head + "。", ww };
}
function bsProblems(cards, dict) {
  const bad = [], R = (ch) => (dict[ch] || {}).concised_radical;
  cards.forEach((c) => {
    const b = c.bs, right = c.opts[c.a], wrong = c.opts.filter((o, i) => i !== c.a);
    const used = b.kind === "common" ? b.chars.slice() : (b.target ? [b.target] : []).concat(...c.opts.map((o) => o.split("、")));
    const miss = used.filter((ch) => !R(ch));
    if (miss.length) { bad.push(c.id + " 這些字沒查到部首：" + miss.join("")); return; }
    if (b.kind !== "common" && JSON.stringify([...new Set(used)].sort()) !== JSON.stringify([...new Set(b.chars)].sort())) bad.push(c.id + " bs.chars 和選項裡的字對不上");
    b.chars.forEach((ch) => { if (!b.rad || b.rad[ch] !== R(ch)) bad.push(c.id + " bs.rad「" + ch + "」寫 " + (b.rad || {})[ch] + "，簡編本是 " + R(ch)); });
    const e = bsExpect(c, R);
    if (c.why !== e.why) bad.push(c.id + " 解說和用辭典部首重產的不同：" + c.why + " ≠ " + e.why);
    wrong.forEach((w, i) => { const got = c.wrongWhy[c.opts.indexOf(w)]; if (got !== e.ww[i]) bad.push(c.id + " 錯法說明和重產的不同：" + got + " ≠ " + e.ww[i]); });
    if (b.kind === "same") {
      if (R(right) !== R(b.target)) bad.push(c.id + " 正解「" + right + "」和「" + b.target + "」部首不同");
      wrong.forEach((w) => { if (R(w) === R(b.target)) bad.push(c.id + " 錯項「" + w + "」其實同部首"); });
    } else if (b.kind === "pair") {
      const two = (o) => o.split("、");
      if (R(two(right)[0]) !== R(two(right)[1])) bad.push(c.id + " 正解那組部首不同");
      wrong.forEach((w) => { if (R(two(w)[0]) === R(two(w)[1])) bad.push(c.id + " 錯項「" + w + "」其實部首相同"); });
    } else if (b.kind === "common") {
      if (b.chars.some((ch) => R(ch) !== right)) bad.push(c.id + " 正解「" + right + "」不是兩字共同的部首");
      wrong.forEach((w) => { if (b.chars.some((ch) => R(ch) === w)) bad.push(c.id + " 錯項「" + w + "」其實是部首"); });
    } else bad.push(c.id + " bs.kind 不認得：" + b.kind);
  });
  return bad;
}
test("㉕部首題：正解、錯項、錯法說明裡的部首，都和教育部簡編本一致", () => {
  const cards = B.ALL_CARDS.filter((c) => c.bs);
  assert.ok(cards.length >= 3, "部首題只有 " + cards.length + " 題");
  assert.deepEqual(bsProblems(cards, DICT_L1), []);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const a = clone(card("yb8")); a.opts[a.a] = "坊";
  assert.ok(bsProblems([a], DICT_L1).length > 0, "自檢：正解換成不同部首的字要抓到");
  const b = clone(card("yb9")); b.wrongWhy = b.wrongWhy.map((t) => t.replace("「筍」是竹部", "「筍」是艸部"));
  assert.ok(bsProblems([b], DICT_L1).length > 0, "自檢：錯法說明部首寫錯要抓到");
  const d = clone(card("yb10")); d.opts[d.a] = "耳";
  assert.ok(bsProblems([d], DICT_L1).length > 0, "自檢：共同部首寫錯要抓到");
  const e = clone(card("yb10")); e.wrongWhy = e.wrongWhy.map((t) => t.replace("部首都是心。", "部首都是耳。"));
  assert.ok(bsProblems([e], DICT_L1).length > 0, "自檢：錯法說明「部首是耳」（Codex 反例）要抓到");
  const f = clone(card("yb9")); f.opts = f.opts.map((o, i) => (i === f.a ? o : i === (f.a + 1) % f.opts.length ? "龘、靐" : o)); f.bs.chars = f.bs.chars.concat(["龘", "靐"]);
  assert.ok(bsProblems([f], DICT_L1).length > 0, "自檢：查無部首的字（Codex 反例龘、靐）要抓到");
  // Codex 審 1e41707 的反例：錯的「坊是糸部」要紅、正確的 yb8 要綠；「培和壞都是木部」要紅；bs.rad 寫錯要紅
  const g = clone(card("yb8")); g.wrongWhy = g.wrongWhy.map((t) => t.replace("「坊」是土部", "「坊」是糸部"));
  assert.ok(bsProblems([g], DICT_L1).length > 0, "自檢：坊寫成糸部要抓到");
  assert.deepEqual(bsProblems([clone(card("yb8"))], DICT_L1), [], "自檢：正確的 yb8 不能紅");
  const h = clone(card("yb9")); h.why = "「培」和「壞」都是木部。";
  assert.ok(bsProblems([h], DICT_L1).length > 0, "自檢：培和壞寫成木部要抓到");
  const k = clone(card("yb8")); k.bs.rad["坊"] = "糸";
  assert.ok(bsProblems([k], DICT_L1).length > 0, "自檢：bs.rad 寫錯要抓到");
  // Codex 審 44a8dd4 的反例：解說後面夾帶「坊是提手旁」「坊是糸字旁」；提示寫「坊的部首是糸」
  [ "，坊是提手旁。", "，坊是糸字旁。", "，坊也是糸部。" ].forEach((x) => { const m = clone(card("yb8")); m.why = m.why.replace(/。$/, x); assert.ok(bsProblems([m], DICT_L1).length > 0, "自檢：解說夾帶" + x + "要抓到"); });
});

// ===== ㉖ 第三～六課內容審定快照（2026-10-18，Codex 設計者 L20261018080918-e4f31c 方案②）=====
// 連 4 輪 FAIL 的根因：拿有限句型判斷孩子看到的任意中文敘述（部首說得對不對），每補一種寫法就有下一種繞過。
// 改成：k7 產題後的完整內容（每張卡每個欄位、解說每種說法與圖、先猜題、觀念、影片說明）等於審定快照 tests/k7_approved_snapshot.json；
// 一個字不同就 REVIEW_REQUIRED（不判斷「錯在哪」，只說「沒審過」）。快照只能由人審過差異、送審 PASS 後手動 node tests/k7_snapshot.js --write。
const K7S = require("./k7_snapshot.js");
// 審定版的雜湊另釘在這裡（4agent 4B-20261018-chi-k7 Phase 3 證實：改錯內容後重產快照，測試照樣全綠）。
// 改第三～六課內容＝重產快照＋改這一行，兩處都會出現在 diff 裡，送審時一定看得到；本值對應 Codex 逐題審過的內容（c8f6d18 起到 b1ae58f 各輪修正）。
// 2026-10-19 範圍稽核：zx4c 人名「瑞邦」改成課文的「銳邦」（第五課主角；教案、考古卷）——快照只差這一個字（node tests/k7_snapshot.js 逐字確認）
const K7_APPROVED_SHA256 = "d8ac9c9f930f7321b3819debf30a63064d7f6f8b595560b1b1db7c67573a8c15";
const k7Snap = () => JSON.parse(fs.readFileSync(K7S.SNAPSHOT_FILE, "utf8"));
function k7Check(cur, snap) {
  const bad = [];
  if (!snap || !snap.content) return ["審定快照沒有 content"];
  if (snap["規則版本"] !== K7S.RULES_VERSION) bad.push("審定快照規則版本不同：" + snap["規則版本"]);
  if (snap.sha256 !== K7S.sha256Of(snap.content)) bad.push("審定快照的 content 和記的 sha256 對不上（被手改過？只能用 --write 產生）");
  if (snap.sha256 !== K7_APPROVED_SHA256) bad.push("審定快照不是釘住的審定版（K7_APPROVED_SHA256）：內容改了要重審，審過才改這個常數");
  K7S.diff(snap.content, cur).forEach((d) => bad.push("REVIEW_REQUIRED " + d.path + "：" + d.text));
  return bad;
}
test("㉖第三～六課內容（卡片每個欄位、解說與圖、先猜、觀念、影片）等於審定快照 tests/k7_approved_snapshot.json", () => {
  let snap; try { snap = k7Snap(); } catch (e) { assert.fail("讀不到審定快照（" + e.message + "）；只能由人手動 node tests/k7_snapshot.js --write 產生並送審"); }
  const bad = k7Check(K7S.view(), snap);
  if (bad.length) assert.fail("第三～六課內容有 " + bad.length + " 處和審定版不同（要重審後再更新快照）：\n  " + bad.slice(0, 40).join("\n  "));
  // 涵蓋：快照裡的卡數＝題庫裡 k7 觀念的卡數（刪題、搬觀念、加新題都會反映在 diff）
  assert.equal(Object.keys(snap.content.cards).length, B.ALL_CARDS.filter((c) => (B.CONCEPTS[c.concept] || {}).unit === "k7").length);
});
// 自檢：設計報告 (D) 驗收矩陣的反例在記憶體裡注入，每一個都要紅、而且紅在被改的欄位；只改鍵的順序要綠
test("㉖自檢：前 4 輪 Codex 的反例（含否定句、追加句、零寬字、交換錯法說明、拿掉欄位、加新欄位、加新題）都要紅在被改的地方", () => {
  const snap = k7Snap(), base = K7S.view();
  assert.deepEqual(k7Check(base, snap), [], "基準：沒改的內容必須綠");
  const cases = [
    ["T03 璧解說改下面是土", (v) => { v.cards.zx3a.why = "璧是土做的寶物，所以下面是土。"; }, "cards.zx3a.why"],
    ["T04 璧提示改是土字旁", (v) => { v.cards.zx3a.hint = "是土字旁的那一個。"; }, "cards.zx3a.hint"],
    ["T05 正確解說後追加璧上面是玉", (v) => { v.cards.zx3a.why += "璧上面是玉。"; }, "cards.zx3a.why"],
    ["T09 撲的 radPos 改右", (v) => { v.cards.zx3f.zx.radPos = "右"; }, "cards.zx3f.zx.radPos"],
    ["T11 yb8 錯法說明坊是糸部", (v) => { const i = v.cards.yb8.opts.indexOf("坊"); v.cards.yb8.wrongWhy[i] = "「坊」是糸部，和「紡」不同。"; }, "cards.yb8.wrongWhy"],
    ["T14 yb8 提示坊不是土字旁（否定句）", (v) => { v.cards.yb8.hint = "坊不是土字旁。"; }, "cards.yb8.hint"],
    ["T15 解說夾零寬字", (v) => { v.cards.yb9.why = v.cards.yb9.why.replace("土部", "土​部"); }, "cards.yb9.why"],
    ["T17 屆恢復裡面是由", (v) => { v.cards.zx4i.why = "屆是一次一次的次序，外面是「尸」，裡面是「由」。"; }, "cards.zx4i.why"],
    ["T20 cy10 錯項換回患得患失", (v) => { v.cards.cy10.opts[v.cards.cy10.opts.indexOf("雨後春筍")] = "患得患失"; }, "cards.cy10.opts"],
    ["T21 bd9 恢復排他說法", (v) => { v.cards.bd9.why = "《　》用在書名，〈　〉用在篇名。"; }, "cards.bd9.why"],
    ["T22 zxc 標題恢復讀音一樣", (v) => { v.explain.zxc[1].name = "換個說法：讀音一樣，意思不一樣"; }, "explain.zxc[1].name"],
    ["T22 zxc 圖改字", (v) => { v.explain.zxc[1].svg["#fn"] = v.explain.zxc[1].svg["#fn"].replace("容易混淆", "讀音一樣"); }, "explain.zxc[1].svg"],
    ["T23 出口答案恢復右邊一樣", (v) => { v.concepts.zxd.exitAns = "右邊一樣。"; }, "concepts.zxd.exitAns"],
    ["T23 影片說明恢復右邊一樣", (v) => { v.videos.zxd[0].note = "劇、據右邊一樣。"; }, "videos.zxd[0].note"],
    ["T25 交換兩個錯法說明", (v) => { const w = v.cards.yb8.wrongWhy, i = w.findIndex((x) => x), j = w.findIndex((x, k) => x && k > i); [w[i], w[j]] = [w[j], w[i]]; }, "cards.yb8.wrongWhy"],
    ["T25 拿掉 bs 欄位", (v) => { delete v.cards.yb9.bs; }, "cards.yb9.bs"],
    ["T25 加未知欄位", (v) => { v.cards.cy1.note = "合理"; }, "cards.cy1.note"],
    ["T25 刪一題", (v) => { delete v.cards.bd1; }, "cards.bd1"],
    ["T25 加一題", (v) => { v.cards.bd99 = v.cards.bd1; }, "cards.bd99"],
  ];
  cases.forEach(([name, mut, where]) => {
    const v = JSON.parse(JSON.stringify(base)); mut(v);
    const bad = k7Check(v, snap);
    assert.ok(bad.length > 0, name + "：沒有紅");
    assert.ok(bad.some((b) => b.indexOf("k7." + where) >= 0), name + "：沒有紅在 " + where + "；實際：" + bad.join(" | "));
  });
  // 正向控制：物件鍵順序倒過來（存檔排版）不算差異
  const rev = (o) => (Array.isArray(o) ? o.map(rev) : o && typeof o === "object" ? Object.fromEntries(Object.entries(o).reverse().map(([k, x]) => [k, rev(x)])) : o);
  assert.deepEqual(k7Check(rev(base), snap), [], "鍵順序不同被判紅");
  // 快照檔手改（content 改了 sha256 沒改）要紅
  const hand = JSON.parse(JSON.stringify(snap)); hand.content.cards.zx3a.hint = "改過";
  assert.ok(k7Check(base, hand).some((b) => /sha256/.test(b)), "手改快照沒被抓到");
  // 4agent Phase 3 證實的破口：內容改錯後重產快照（content 和 sha256 自洽）——要因為不是釘住的審定版而紅
  const regen = JSON.parse(JSON.stringify(base)); regen.cards.zx3a.why = "璧是土做的寶物，所以下面是「土」。";
  const fake = { "規則版本": K7S.RULES_VERSION, sha256: K7S.sha256Of(regen), content: regen };
  const rb = k7Check(regen, fake);
  assert.ok(rb.some((b) => /K7_APPROVED_SHA256/.test(b)), "改錯內容後重產快照沒被抓到：" + rb.join(" | "));
});
// T27 成品一致：index.html 裡內嵌的每一支 src 檔，和 src 逐字相同（改了 src 沒 build 會紅）
test("㉖-b 成品 index.html 內嵌的 src 檔和來源逐字相同（build.py 的 <script>\\n…\\n</script> 包法），而且整份等於 build.py 重建結果（含 app.html 本身）", () => {
  const app = fs.readFileSync(path.join(ROOT, "src", "app.html"), "utf8"), html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const files = [...app.matchAll(/<!--@INLINE (src\/[A-Za-z0-9_.-]+\.js)-->/g)].map((m) => m[1]);
  assert.ok(files.indexOf("src/chibank.js") >= 0 && files.indexOf("src/chiexplain.js") >= 0 && files.indexOf("src/chivideos.js") >= 0, "app.html 沒有內嵌題庫三支檔：" + files.join("、"));
  const stale = files.filter((f) => html.indexOf("<script>\n" + fs.readFileSync(path.join(ROOT, f), "utf8") + "\n</script>") < 0);
  assert.deepEqual(stale, [], "這些 src 檔改了但 index.html 沒重新 build");
  // Codex 審 83067be：只查內嵌 js 會漏掉 app.html（畫面怎麼顯示提示、解說）⇒ 整份用 build.py --check 在記憶體重建後逐字比
  const r = require("child_process").spawnSync("python3", [path.join(ROOT, "build.py"), "--check"], { encoding: "utf8" });
  assert.equal(r.status, 0, "build.py --check：" + (r.stdout || "") + (r.stderr || ""));
});
test("㉖-c 自檢：審定檔只重排鍵不算被手改；build.py --check 對改過的 app.html、CRLF、BOM、缺檔都會紅", () => {
  const snap = k7Snap(), rev = (o) => (Array.isArray(o) ? o.map(rev) : o && typeof o === "object" ? Object.fromEntries(Object.entries(o).reverse().map(([k, x]) => [k, rev(x)])) : o);
  const s2 = Object.assign({}, snap, { content: rev(snap.content) });
  assert.deepEqual(k7Check(K7S.view(), s2), [], "審定檔只重排鍵被誤擋（Codex 反例 F1）");
  // 在暫存資料夾複製一份站台，只改 app.html 的提示顯示，index.html 不重建：--check 要紅
  const os = require("os"), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "chi-check-"));
  try {
    fs.mkdirSync(path.join(tmp, "src"));
    fs.copyFileSync(path.join(ROOT, "build.py"), path.join(tmp, "build.py"));
    fs.copyFileSync(path.join(ROOT, "index.html"), path.join(tmp, "index.html"));
    fs.copyFileSync(path.join(ROOT, "weak-export.js"), path.join(tmp, "weak-export.js"));   // #4027：--check 也比 weak-export.js
    fs.readdirSync(path.join(ROOT, "src")).filter((f) => /\.(js|html)$/.test(f)).forEach((f) => fs.copyFileSync(path.join(ROOT, "src", f), path.join(tmp, "src", f)));
    const ok = require("child_process").spawnSync("python3", [path.join(tmp, "build.py"), "--check"], { encoding: "utf8" });
    assert.equal(ok.status, 0, "複本未改應一致：" + ok.stdout);
    const app = fs.readFileSync(path.join(tmp, "src", "app.html"), "utf8");
    assert.ok(app.indexOf('"提示："+c.hint') >= 0, "app.html 找不到提示顯示的程式（自檢前提）");
    // Codex 審 2fe4bbb 的反例：index.html 首個換行改 CRLF、開頭加 BOM、刪掉 index.html，--check 都要紅
    const idx = fs.readFileSync(path.join(tmp, "index.html"));
    const variant = (name, buf) => { if (buf === null) fs.rmSync(path.join(tmp, "index.html")); else fs.writeFileSync(path.join(tmp, "index.html"), buf);
      const r = require("child_process").spawnSync("python3", [path.join(tmp, "build.py"), "--check"], { encoding: "utf8" });
      fs.writeFileSync(path.join(tmp, "index.html"), idx); assert.notEqual(r.status, 0, "--check 沒抓到：" + name); };
    const nl = idx.indexOf(10);
    variant("首個換行改 CRLF", Buffer.concat([idx.subarray(0, nl), Buffer.from([13]), idx.subarray(nl)]));
    variant("開頭加 UTF-8 BOM", Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), idx]));
    variant("index.html 不見", null);
    // #4027：weak-export.js 缺檔、或 core.js 改了沒重建 weak-export.js，--check 也要紅
    const wx = fs.readFileSync(path.join(tmp, "weak-export.js"));
    fs.rmSync(path.join(tmp, "weak-export.js"));
    assert.notEqual(require("child_process").spawnSync("python3", [path.join(tmp, "build.py"), "--check"], { encoding: "utf8" }).status, 0, "--check 沒抓到：weak-export.js 不見");
    fs.writeFileSync(path.join(tmp, "weak-export.js"), Buffer.concat([wx, Buffer.from("\n")]));
    assert.notEqual(require("child_process").spawnSync("python3", [path.join(tmp, "build.py"), "--check"], { encoding: "utf8" }).status, 0, "--check 沒抓到：weak-export.js 和 src 不同");
    fs.writeFileSync(path.join(tmp, "weak-export.js"), wx);
    fs.writeFileSync(path.join(tmp, "src", "app.html"), app.replace('"提示："+c.hint', '"提示：坊不是土字旁。"'));
    const bad = require("child_process").spawnSync("python3", [path.join(tmp, "build.py"), "--check"], { encoding: "utf8" });
    assert.notEqual(bad.status, 0, "只改 app.html 的提示顯示、沒重建 index.html，--check 沒紅（Codex 反例 F2）");
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

module.exports = { T21_ROWS, T21_LEGACY, T21_POSITIVE, crClone, crPrint, t21Check, crSnapshot };

// 2026-10-18 重複題只留一題（律師：「重複是指a題可以答對，也能夠答對b或c題，那b、c題就可能是重複觀念題」）
test("重複題合併表：被併的題存在、留下的題存在且沒被併（不接龍）、同一個觀念、寫了理由；出題＝全部扣掉被併的和停出的", () => {
  const byId = {}; B.ALL_CARDS.forEach((c) => { byId[c.id] = c; });
  const bad = [];
  Object.keys(B.MERGED).forEach((id) => {
    const m = B.MERGED[id], c = byId[id];
    if (!c) { bad.push(id + " 不在題庫"); return; }
    if (!Array.isArray(m.keep) || !m.keep.length || typeof m.why !== "string" || m.why.length < 8) bad.push(id + " 缺 keep／why");
    (m.keep || []).forEach((k) => {
      if (!byId[k]) bad.push(id + " → " + k + " 不在題庫");
      else if (B.MERGED[k]) bad.push(id + " → " + k + " 自己也被併掉了（不能接龍）");
      else if (byId[k].concept !== c.concept) bad.push(id + " → " + k + " 跨觀念");
    });
  });
  assert.deepEqual(bad, []);
  assert.deepEqual(B.CARDS.map((c) => c.id), B.ALL_CARDS.filter((c) => !B.MERGED[c.id] && !B.RETIRED[c.id]).map((c) => c.id));
  assert.equal(B.ALL_CARDS.length, 256);
  assert.equal(B.CARDS.length, 235);   // 2026-10-18：204 ＋ 第三～六課 43 題 − 併入的 yb3 ＝ 246；2026-10-19 範圍稽核停出 11 題 ⇒ 235
  const n = {}; B.CARDS.forEach((c) => { n[c.concept] = (n[c.concept] || 0) + 1; });
  const thin = Object.keys(B.CONCEPTS).filter((k) => !(n[k] >= 4)).map((k) => k + "=" + (n[k] || 0));
  assert.deepEqual(thin, [], "每個觀念合併後至少 4 題");
});

// ===== 2026-10-19 範圍稽核：考不到的不練，課文怎麼寫就怎麼教 =====
// 依據：翰林第九冊第一～六課＋統整活動一、二＋享閱讀〈煙會說話〉。〈廉頗與藺相如〉課文第 1 段只一句帶過「使秦．完璧歸趙」「諸侯大會－維護趙王顏面」，
// 沒有澠池、瑟、缶、十五座城，結尾用「肝膽相照」不是「刎頸之交」（彰化縣 114 學年公開授課學習單、教育百科第三課語詞表）；第五課主角是「銳邦」。
// 停出的題只是不出新題（RETIRED，和 MERGED 同一套）：ALL_CARDS 照留，她以前練過的照常複習。
const RETIRED_IDS = ["hs1", "hs2", "hs3", "hs4", "hs6", "hs7", "hs8", "cr1", "cr2", "cr5", "cr10"];
test("停出表 RETIRED：恰是稽核判 OUT 的 11 題；每題在 ALL_CARDS、不在 CARDS、kind 是 out、寫了理由；不和 MERGED 重疊、MERGED 不指向停出題", () => {
  assert.ok(B.RETIRED && typeof B.RETIRED === "object", "api 沒有匯出 RETIRED");
  assert.deepEqual(Object.keys(B.RETIRED).sort(), RETIRED_IDS.slice().sort());
  const all = new Set(B.ALL_CARDS.map((c) => c.id)), active = new Set(B.CARDS.map((c) => c.id)), bad = [];
  Object.keys(B.RETIRED).forEach((id) => {
    const r = B.RETIRED[id];
    if (!all.has(id)) bad.push(id + " 不在 ALL_CARDS（練過的就沒辦法複習）");
    if (active.has(id)) bad.push(id + " 還在 CARDS（會出新題）");
    if (!r || r.kind !== "out") bad.push(id + " kind 不是 out");
    if (!r || typeof r.why !== "string" || r.why.trim().length < 8) bad.push(id + " 沒寫理由");
    if (B.MERGED[id]) bad.push(id + " 同時在 MERGED");
  });
  Object.keys(B.MERGED).forEach((id) => (B.MERGED[id].keep || []).forEach((k) => { if (B.RETIRED[k]) bad.push(id + " 留下的題 " + k + " 已停出"); }));
  assert.deepEqual(bad, []);
});

// 課外細節與錯的人名：會出新題的卡片（題目、選項、解說、錯法說明、提示）、出口題與參考答案、補救解說（每個欄位含圖）、先猜題、影片標題與說明都不能出現
const OUT_OF_SCOPE = /澠池|瑟|缶|刎頸|十五座城|瑞邦/;
function scopeLeaks(bank, expl, vid) {
  const bad = [], chk = (where, t) => { const m = String(t == null ? "" : t).match(OUT_OF_SCOPE); if (m) bad.push(where + "「" + m[0] + "」"); };
  (bank.CARDS || []).forEach((c) => {
    chk(c.id + " 題目", c.q); (c.opts || []).forEach((o) => chk(c.id + " 選項", o));
    chk(c.id + " 解說", c.why); (c.wrongWhy || []).forEach((w) => chk(c.id + " 錯法說明", w)); chk(c.id + " 提示", c.hint);
  });
  Object.keys(bank.CONCEPTS || {}).forEach((k) => { const c = bank.CONCEPTS[k]; chk(k + " 觀念名稱", c.title); chk(k + " 出口題", c.exit); chk(k + " 出口題答案", c.exitAns); });
  Object.keys(expl.EXPLAIN || {}).forEach((k) => expl.EXPLAIN[k].forEach((ex, i) => {
    const w = k + " 說法" + (i + 1);
    chk(w + " 圖", typeof ex.svg === "function" ? ex.svg() : ex.svg);
    [ex.name, ex.task, ex.ask].concat(ex.lines || []).forEach((t) => chk(w, t));
    (ex.examples || []).forEach((e) => { chk(w + " 例句", e.s); chk(w + " 例句說明", e.why); });
  }));
  Object.keys(expl.PREDICT || {}).forEach((k) => { const p = expl.PREDICT[k]; [p.q, p.why].concat(p.opts || []).forEach((t) => chk(k + " 先猜", t)); });
  Object.keys(vid.V || {}).forEach((k) => vid.V[k].forEach((v) => { chk(k + " 影片標題", v.title); chk(k + " 影片說明", v.note); chk(k + " 影片備註", v.fitNote); }));
  return bad;
}
test("範圍：會出新題的卡片、出口題、補救解說、先猜題、影片標題與說明，都不出現課外的《史記》細節（澠池、瑟、缶、刎頸、十五座城）和錯的人名（瑞邦）", () => {
  assert.deepEqual(scopeLeaks(B, X, VID), []);
  // 自檢：停出的題如果還在出題，要抓得到（證明是 RETIRED 過濾讓它綠，不是掃描器沒牙）
  const leak = scopeLeaks({ CARDS: B.ALL_CARDS, CONCEPTS: {} }, {}, {});
  ["hs1", "hs6", "hs7"].forEach((id) => assert.ok(leak.some((b) => b.indexOf(id + " ") === 0), "把停出的 " + id + " 放回出題沒抓到：" + leak.join("、")));
  // 自檢：每一個掃描位置各放一個課外詞，都要紅
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const h = clone(card("hs12")); h.opts[h.a] = "完璧歸趙→澠池之會→負荊請罪";
  const z = clone(card("zx4c")); z.q = z.q.replace("銳邦", "瑞邦");
  const w = clone(card("hs13")); w.wrongWhy = w.wrongWhy.map((t) => (t ? t + "成為刎頸之交。" : t));
  const cases = [
    ["選項", { CARDS: [h] }, {}, {}], ["題目", { CARDS: [z] }, {}, {}], ["錯法說明", { CARDS: [w] }, {}, {}],
    ["出口題答案", { CARDS: [], CONCEPTS: { hs: Object.assign({}, B.CONCEPTS.hs, { exitAns: "兩人成了刎頸之交。" }) } }, {}, {}],
    ["解說的圖", { CARDS: [] }, { EXPLAIN: { hs: [Object.assign({}, X.EXPLAIN.hs[0], { svg: () => "<svg>秦王要趙王彈瑟</svg>" })] } }, {}],
    ["解說例句", { CARDS: [] }, { EXPLAIN: { hs: [Object.assign({}, X.EXPLAIN.hs[1], { examples: [{ s: "逼秦王敲缶", why: "爭面子" }] })] } }, {}],
    ["先猜題", { CARDS: [] }, { PREDICT: { hs: Object.assign({}, X.PREDICT.hs, { why: "秦王說要用十五座城換璧。" }) } }, {}],
    ["影片說明", { CARDS: [] }, {}, { V: { hs: [Object.assign({}, VID.V.hs[0], { note: "從完璧歸趙、澠池之會到負荊請罪。" })] } }],
  ];
  cases.forEach(([name, b, x, v]) => assert.ok(scopeLeaks(b, x, v).length > 0, "自檢：" + name + "放進課外詞沒抓到"));
});

test("課文說法：hs12 用「諸侯大會」、hs13 正解是「肝膽相照」、hs 出口題參考答案是「肝膽相照」、zx4c 是第五課主角「銳邦」", () => {
  const h12 = card("hs12"), h13 = card("hs13");
  assert.equal(h12.opts[h12.a], "完璧歸趙→諸侯大會→負荊請罪");
  assert.ok(h12.opts.every((o) => o.indexOf("諸侯大會") >= 0), "hs12 每個選項都要用課文的「諸侯大會」：" + h12.opts.join("／"));
  assert.match(h13.opts[h13.a], /肝膽相照/, "hs13 正解：" + h13.opts[h13.a]);
  assert.ok(B.CARDS.indexOf(h12) >= 0 && B.CARDS.indexOf(h13) >= 0, "hs12、hs13 是改內容不是停出，要照常出題");
  assert.match(B.CONCEPTS.hs.exitAns, /肝膽相照/);
  assert.match(card("zx4c").q, /銳邦/);
});

test("〈廉頗與藺相如〉補救解說照課文三個意義段：使秦完璧歸趙、諸侯大會維護趙王顏面 → 藺相如以國家為重避讓 → 負荊請罪、肝膽相照；不出現《史記》才有的細節", () => {
  const e = X.EXPLAIN.hs, txt = (ex) => [ex.name, ex.svg(), ex.task, ex.ask].concat(ex.lines, (ex.examples || []).flatMap((y) => [y.s, y.why])).join("");
  const all = e.map(txt).join("");
  const m = all.match(/澠池|瑟|缶|刎頸|十五座城|肉袒/);
  assert.equal(m ? m[0] : "", "", "解說出現《史記》細節");
  ["完璧歸趙", "諸侯大會", "趙王的顏面", "國家為重", "負荊請罪", "肝膽相照"].forEach((k) => assert.ok(all.indexOf(k) >= 0, "解說缺課文的「" + k + "」"));
  assert.deepEqual(e[0].examples.map((y) => y.s.slice(0, 4)), ["意義段一", "意義段二", "意義段三"], "第一種說法的例句要照三個意義段");
});
