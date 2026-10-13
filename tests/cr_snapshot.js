// 測試㉑的審定快照工具（產生器＋比對器）：把 src/chiexplain.js 的 EXPLAIN.cr（著作權補救解說兩張卡）正規化成
// 人看得懂的 JSON，和 tests/cr_approved_snapshot.json（審定過的版本）比對、列出差異。
// 依據：Codex 設計者結論 docs/test21-snapshot-codex-designer-20261013.md（測試㉑ 9daba41→899b730→abb1c94 連 3 輪 FAIL 後升級）。
//
// 用法（只能由人手動執行；tests/chibank.test.js 只讀快照檔，絕不呼叫寫檔，也不從受測內容即時產生預期值）：
//   node tests/cr_snapshot.js           只印出目前內容和審定快照的差異，不寫檔（一致 exit 0；不一致或沒有快照 exit 1）
//   node tests/cr_snapshot.js --write   先印出差異，再把目前內容寫成審定快照。只在「內容改過、重新審定並送審 PASS」之後執行，
//                                       快照和內容放在同一個 commit。
//
// 正規化規則（RULES_VERSION；規則一改，快照就要重產並送審）：
//   文字  NFC（不用 NFKC：①②③④、全形字不能被換掉）。ASCII 空白（tab、換行、FF、CR、空格）連成一段算排版空白：
//         頭尾的刪掉；兩邊都是英數字時留一格；其他（中文、標點、全形字旁邊）刪掉。CRLF 因此自然統一。
//         其餘字元都是內容：標點、否定字、全形空白、不換行空白、零寬字、方向控制字一律保留（快照裡寫成 \uXXXX 才看得見）。
//   物件  鍵名排序；陣列、SVG 元素與子節點保持原順序。卡片、例句的欄位一個不漏（多欄、缺欄、型別改變都會出現在差異裡）；
//         只收字串、陣列、一般物件；只有卡片的 svg 可以是函式（照網站的方式呼叫 ex.svg() 再解析）。
//   SVG   Node 沒有內建 XML parser、repo 也沒有套件，這裡自寫最小的嚴格 XML 解析：只認 svg／text／tspan／rect／line／polygon
//         與各自用到的屬性、XML 五個內建 entity 和 &#十進位; &#x十六進位;、自閉合標籤。註解、CDATA、DOCTYPE、XML 宣告、
//         不認得的元素／屬性／entity、沒加引號的屬性值、重複屬性、控制字元、根元素以外的東西……一律丟錯（測試就紅）。
//         <text>／<tspan> 記完整 textContent（含 <tspan> 的字），有子元素時另記 children；元素之間的縮排忽略。
//         屬性值逐字保留（只做 NFC，不折疊空白）：數值、座標、樣式字串裡的每個字都算內容（規則版本 2，Codex 審 6c732ff）。
//   物件鍵 正規化後的物件無原型（Object.create(null)）：鍵名 __proto__ 也是一般欄位，不會在正規化時消失（規則版本 2）。
// 快照不涵蓋網站成品：index.html 由 build.py 內嵌 src 產生，成品一致性不在這裡檢查。
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const RULES_VERSION = "cr-snapshot/2";
const SNAPSHOT_FILE = path.join(__dirname, "cr_approved_snapshot.json");
const SNAPSHOT_REL = "tests/cr_approved_snapshot.json";

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const kindOf = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);
function isPlainObject(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const p = Object.getPrototypeOf(v);
  return p === Object.prototype || p === null;
}

// ---------- 顯示：看不見的字元一律寫成 \uXXXX ----------
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}\u{00A0}\u{1680}\u{2000}-\u{200A}\u{202F}\u{205F}\u{3000}]/gu;
const hex4 = (n) => "\\u" + n.toString(16).padStart(4, "0");
function escInvisible(s) {
  return s.replace(INVISIBLE, (c) => {
    const cp = c.codePointAt(0);
    if (cp <= 0xffff) return hex4(cp);
    const v = cp - 0x10000;
    return hex4(0xd800 + (v >> 10)) + hex4(0xdc00 + (v & 0x3ff));
  });
}
function show(v) {
  if (v === undefined) return "（沒有）";
  let j;
  try { j = JSON.stringify(v); } catch (e) { return "（無法顯示的 " + kindOf(v) + "）"; }
  return j === undefined ? "（" + kindOf(v) + "）" : escInvisible(j);
}

// ---------- 文字正規化 ----------
const ASCII_WS = new Set(["\t", "\n", "\f", "\r", " "]);
const WORD_CHAR = /^[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Nd}]$/u;   // 英數字；全形英數（U+FF00–FFEF）照中文處理
function isWordChar(c) {
  const cp = c.codePointAt(0);
  return WORD_CHAR.test(c) && !(cp >= 0xff00 && cp <= 0xffef);
}
function normalizeText(s) {
  if (typeof s !== "string") throw new TypeError("normalizeText 只收字串，收到 " + kindOf(s));
  const cps = Array.from(s.normalize("NFC"));
  let out = "";
  for (let i = 0; i < cps.length; ) {
    if (!ASCII_WS.has(cps[i])) { out += cps[i]; i += 1; continue; }
    let j = i;
    while (j < cps.length && ASCII_WS.has(cps[j])) j += 1;
    if (i > 0 && j < cps.length && isWordChar(cps[i - 1]) && isWordChar(cps[j])) out += " ";
    i = j;
  }
  return out.normalize("NFC");
}

// ---------- 嚴格 SVG（XML）解析 ----------
// 只認這些元素、各自只認這些屬性；children＝可以放進來的子元素；text＝可以放文字。
const SVG_SCHEMA = {
  svg: { attrs: ["aria-label", "class", "role", "viewBox"], children: ["line", "polygon", "rect", "text"], text: false },
  text: { attrs: ["fill", "font-size", "font-weight", "text-anchor", "x", "y"], children: ["tspan"], text: true },
  tspan: { attrs: ["fill", "font-size", "font-weight", "text-anchor", "x", "y"], children: ["tspan"], text: true },
  rect: { attrs: ["fill", "height", "rx", "stroke", "stroke-width", "width", "x", "y"], children: [], text: false },
  line: { attrs: ["stroke", "stroke-width", "x1", "x2", "y1", "y2"], children: [], text: false },
  polygon: { attrs: ["fill", "points"], children: [], text: false },
};
const XML_SPACE = new Set([" ", "\t", "\n", "\r"]);
const XML_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const NAME_RE = /[A-Za-z_][A-Za-z0-9._-]*/y;   // 不含冒號：xml:space、xlink:href 這類命名空間屬性一律不認得
// XML 不允許的字元，加上 C1 控制字元（瀏覽器把 &#x80; 這類當成 Windows-1252 字，和 XML 解讀不同）與非字元
function forbiddenCodePoint(cp) {
  return (cp < 0x20 && cp !== 0x9 && cp !== 0xa && cp !== 0xd) || (cp >= 0x7f && cp <= 0x9f) ||
    (cp >= 0xd800 && cp <= 0xdfff) || (cp >= 0xfdd0 && cp <= 0xfdef) || (cp & 0xfffe) === 0xfffe || cp > 0x10ffff;
}

// 回傳 { tag, attrs: {名稱: 值}, kids: [元素 | { text }] }；有任何不認得的語法就丟 Error
function parseSvg(src) {
  if (typeof src !== "string") throw new Error("svg() 回傳的不是字串，而是 " + kindOf(src));
  const s = src.replace(/\r\n?/g, "\n");   // XML 換行正規化
  let i = 0;
  const fail = (msg) => { throw new Error(msg + "（第 " + i + " 字附近：" + show(s.slice(Math.max(0, i - 12), i + 12)) + "）"); };
  const skipSpace = () => { const from = i; while (i < s.length && XML_SPACE.has(s[i])) i += 1; return i > from; };
  const readName = (what) => {
    NAME_RE.lastIndex = i;
    const m = NAME_RE.exec(s);
    if (!m) fail("這裡應該是" + what + "名稱");
    i += m[0].length;
    return m[0];
  };
  const decode = (raw) => {
    let out = "";
    for (let k = 0; k < raw.length; ) {
      const amp = raw.indexOf("&", k);
      if (amp < 0) { out += raw.slice(k); break; }
      out += raw.slice(k, amp);
      const semi = raw.indexOf(";", amp + 1);
      const ref = semi < 0 ? null : raw.slice(amp + 1, semi);
      let cp = null;
      if (ref !== null && has(XML_ENTITIES, ref)) out += XML_ENTITIES[ref];
      else if (ref !== null && /^#[0-9]{1,7}$/.test(ref)) cp = parseInt(ref.slice(1), 10);
      else if (ref !== null && /^#x[0-9A-Fa-f]{1,6}$/.test(ref)) cp = parseInt(ref.slice(2), 16);
      else fail("不認得的 entity " + show(raw.slice(amp, semi < 0 ? amp + 12 : semi + 1)));
      if (cp !== null) {
        if (forbiddenCodePoint(cp)) fail("entity 指到不允許的字元 U+" + cp.toString(16).toUpperCase());
        out += String.fromCodePoint(cp);
      }
      k = semi + 1;
    }
    for (const c of out) {
      const cp = c.codePointAt(0);
      if (forbiddenCodePoint(cp)) fail("有不允許的字元 U+" + cp.toString(16).toUpperCase());
    }
    return out;
  };
  function element(parent) {
    i += 1;   // "<"
    const tag = readName("元素");
    const sc = has(SVG_SCHEMA, tag) ? SVG_SCHEMA[tag] : null;
    if (!sc) fail("不認得的元素 <" + tag + ">");
    if (parent ? parent.children.indexOf(tag) < 0 : tag !== "svg") fail("<" + tag + "> 不能放在" + (parent ? "這個元素裡" : "最外層"));
    const attrs = Object.create(null);
    for (;;) {
      const spaced = skipSpace();
      if (s.startsWith("/>", i)) { i += 2; return { tag, attrs, kids: [] }; }
      if (s[i] === ">") { i += 1; break; }
      if (i >= s.length) fail("<" + tag + " 沒有結束");
      if (!spaced) fail("屬性前面要有空白");
      const name = readName("屬性");
      if (sc.attrs.indexOf(name) < 0) fail("<" + tag + "> 不認得的屬性 " + name);
      if (has(attrs, name)) fail("<" + tag + "> 屬性重複：" + name);
      skipSpace();
      if (s[i] !== "=") fail("屬性 " + name + " 後面要接 =");
      i += 1;
      skipSpace();
      const q = s[i];
      if (q !== '"' && q !== "'") fail("屬性 " + name + " 的值要用引號包起來");
      const end = s.indexOf(q, i + 1);
      if (end < 0) fail("屬性 " + name + " 的值沒有結束引號");
      const raw = s.slice(i + 1, end);
      if (raw.indexOf("<") >= 0) fail("屬性 " + name + " 的值不能有 <");
      attrs[name] = decode(raw.replace(/[\t\n]/g, " "));   // XML 屬性值正規化：字面的 tab、換行變空白
      i = end + 1;
    }
    const kids = [];
    for (;;) {
      if (i >= s.length) fail("<" + tag + "> 沒有結束標籤");
      if (s.startsWith("</", i)) {
        i += 2;
        const endTag = readName("結束標籤");
        if (endTag !== tag) fail("結束標籤 </" + endTag + "> 和 <" + tag + "> 對不上");
        skipSpace();
        if (s[i] !== ">") fail("結束標籤 </" + endTag + " 少了 >");
        i += 1;
        return { tag, attrs, kids };
      }
      if (s[i] === "<") {
        if (s[i + 1] === "!" || s[i + 1] === "?") fail("不支援註解、CDATA、DOCTYPE、處理指令");
        kids.push(element(sc));
        continue;
      }
      const lt = s.indexOf("<", i);
      const raw = s.slice(i, lt < 0 ? s.length : lt);
      if (raw.indexOf("]]>") >= 0) fail("文字裡不能有 ]]>");
      const text = decode(raw);
      if (sc.text) kids.push({ text });
      else if (/[^ \t\n\r]/.test(text)) fail("<" + tag + "> 裡不能直接放文字 " + show(text));
      i += raw.length;
    }
  }
  skipSpace();
  if (s[i] !== "<" || s[i + 1] === "!" || s[i + 1] === "?") fail("開頭必須是 <svg（不支援 XML 宣告、DOCTYPE、註解）");
  const root = element(null);
  skipSpace();
  if (i < s.length) fail("</svg> 後面還有東西");
  return root;
}

const textContent = (n) => n.kids.map((k) => (has(k, "tag") ? textContent(k) : k.text)).join("");
// 正規化後的元素：{ tag, attrs（名稱排序）, text（只有 text／tspan：完整 textContent）, children（svg 一定有；text／tspan 有子元素時才有） }
function normNode(n) {
  const sc = SVG_SCHEMA[n.tag];
  const attrs = Object.create(null);
  // 屬性值逐字保留（只做 NFC）：數值、座標、樣式裡的空白都是內容（Codex 審 6c732ff：width="270 .0" 被折疊成 270.0 而假通過）
  Object.keys(n.attrs).sort().forEach((k) => { attrs[k] = n.attrs[k].normalize("NFC"); });
  const o = { tag: n.tag, attrs };
  if (sc.text) {
    o.text = normalizeText(textContent(n));
    if (n.kids.some((k) => has(k, "tag"))) {
      o.children = n.kids.map((k) => (has(k, "tag") ? normNode(k) : { "#text": normalizeText(k.text) }))
        .filter((k) => !has(k, "#text") || k["#text"] !== "");
    }
  } else if (n.tag === "svg") o.children = n.kids.map(normNode);
  return o;
}

// ---------- 整份內容正規化 ----------
class ContentError extends Error {
  constructor(where, msg) { super(where + "：" + msg); this.name = "ContentError"; this.path = where; }
}
function checkDense(v, at) {
  const ks = Object.keys(v);
  if (ks.length !== v.length || ks.some((k, n) => k !== String(n))) throw new ContentError(at, "陣列有空洞或多出來的屬性");
}
function normData(v, at) {
  if (typeof v === "string") return normalizeText(v);
  if (Array.isArray(v)) { checkDense(v, at); return v.map((x, n) => normData(x, at + "[" + n + "]")); }
  if (isPlainObject(v)) {
    const o = Object.create(null);   // 無原型：鍵名 __proto__ 也照樣保留成欄位（Codex 審 6c732ff）
    Object.keys(v).sort().forEach((k) => { o[k] = normData(v[k], at + "." + k); });
    return o;
  }
  throw new ContentError(at, "型別 " + kindOf(v) + " 不在快照規則裡（只收字串、陣列、一般物件；只有卡片的 svg 可以是函式）");
}
function normalizeSvg(markup, at) {
  at = at || "svg";
  let tree;
  try { tree = parseSvg(markup); } catch (e) { throw new ContentError(at, "SVG 解析失敗：" + e.message); }
  return normNode(tree);
}
function normalize(cr) {
  if (!Array.isArray(cr)) throw new ContentError("cr", "EXPLAIN.cr 不是陣列，而是 " + kindOf(cr));
  checkDense(cr, "cr");
  return cr.map((card, n) => {
    const at = "cr[" + n + "]";
    if (!isPlainObject(card)) throw new ContentError(at, "卡片不是一般物件，而是 " + kindOf(card));
    const o = Object.create(null);
    Object.keys(card).sort().forEach((k) => {
      if (k !== "svg") { o[k] = normData(card[k], at + "." + k); return; }
      if (typeof card.svg !== "function") throw new ContentError(at + ".svg", "不是函式（網站會呼叫 ex.svg()），而是 " + kindOf(card.svg));
      let markup;
      try { markup = card.svg(); } catch (e) { throw new ContentError(at + ".svg", "呼叫 svg() 出錯：" + e.message); }
      o.svg = normalizeSvg(markup, at + ".svg");
    });
    return o;
  });
}

// ---------- 差異 ----------
const NODE_KEYS = ["tag", "attrs", "text", "children"];
const isNode = (v) => isPlainObject(v) && typeof v.tag === "string" && isPlainObject(v.attrs) && Object.keys(v).every((k) => NODE_KEYS.indexOf(k) >= 0);
function markup(n) {
  const a = Object.keys(n.attrs).map((k) => " " + k + "=" + JSON.stringify(n.attrs[k])).join("");
  if (n.children) return "<" + n.tag + a + ">" + n.children.map((c) => (has(c, "#text") ? c["#text"] : markup(c))).join("") + "</" + n.tag + ">";
  if (has(n, "text")) return "<" + n.tag + a + ">" + n.text + "</" + n.tag + ">";
  return "<" + n.tag + a + "/>";
}
function brief(v) {
  let s;
  if (isNode(v)) s = escInvisible(markup(v));
  else if (isPlainObject(v) && typeof v.name === "string" && Array.isArray(v.lines)) s = "整張卡 " + show(v.name);
  else s = show(v);
  return s.length > 300 ? s.slice(0, 300) + "…" : s;
}
function canonical(v) {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
  return JSON.stringify(v);
}
const sha256Of = (v) => crypto.createHash("sha256").update(canonical(v), "utf8").digest("hex");

// 最長共同子序列：回傳 ["=", i, j]／["-", i]／["+", null, j]
function lcsOps(ka, kb) {
  const n = ka.length, m = kb.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) for (let j = m - 1; j >= 0; j -= 1) dp[i][j] = ka[i] === kb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (ka[i] === kb[j]) { ops.push(["=", i, j]); i += 1; j += 1; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push(["-", i, null]); i += 1; }
    else { ops.push(["+", null, j]); j += 1; }
  }
  for (; i < n; i += 1) ops.push(["-", i, null]);
  for (; j < m; j += 1) ops.push(["+", null, j]);
  return ops;
}
function walk(e, a, at, out) {
  const ke = kindOf(e), ka = kindOf(a);
  if (ke !== ka) { out.push({ path: at, op: "型別", text: at + "：型別不同（審定是 " + ke + " " + brief(e) + "；現在是 " + ka + " " + brief(a) + "）" }); return; }
  if (ke === "array") { walkArray(e, a, at, out); return; }
  if (ke === "object") {
    Array.from(new Set(Object.keys(e).concat(Object.keys(a)))).sort().forEach((k) => {
      const p = at + "." + k;
      if (has(e, k) && !has(a, k)) out.push({ path: p, op: "少了", text: p + "：少了這個欄位（審定是 " + brief(e[k]) + "）" });
      else if (!has(e, k) && has(a, k)) out.push({ path: p, op: "多了", text: p + "：多了這個欄位 " + brief(a[k]) });
      else walk(e[k], a[k], p, out);
    });
    return;
  }
  if (e !== a) out.push({ path: at, op: "改了", text: at + "：改了 " + brief(e) + " → " + brief(a) });
}
function walkArray(e, a, at, out) {
  if (e.length === a.length) { e.forEach((x, n) => walk(x, a[n], at + "[" + n + "]", out)); return; }
  // 長度不同：用最長共同子序列對齊，列出少了、多了、改了的項目（其餘位置不受刪除、插入牽連）
  let dels = [], adds = [];
  const flush = () => {
    const n = Math.min(dels.length, adds.length);
    for (let k = 0; k < n; k += 1) walk(e[dels[k]], a[adds[k]], at + "[" + (dels[k] === adds[k] ? dels[k] : dels[k] + "→" + adds[k]) + "]", out);
    dels.slice(n).forEach((i) => out.push({ path: at + "[" + i + "]", op: "少了", text: at + "[" + i + "]：少了這一項 " + brief(e[i]) }));
    adds.slice(n).forEach((j) => out.push({ path: at + "[" + j + "]", op: "多了", text: at + "[" + j + "]：多了這一項 " + brief(a[j]) }));
    dels = []; adds = [];
  };
  lcsOps(e.map(canonical), a.map(canonical)).forEach(([op, i, j]) => { if (op === "=") flush(); else if (op === "-") dels.push(i); else adds.push(j); });
  flush();
}
// expected＝審定快照的 cr、actual＝normalize(EXPLAIN.cr)；回傳 [{ path, op, text }]，一致時是空陣列
function diff(expected, actual, at) {
  const out = [];
  walk(expected, actual, at || "cr", out);
  return out;
}

// ---------- 快照檔（給人看：一個 SVG 元素一行；看不見的字元寫成 \uXXXX） ----------
function buildSnapshot(cr) {
  const content = normalize(cr);
  return {
    "說明": [
      "測試㉑（tests/chibank.test.js）的審定快照：src/chiexplain.js 的 EXPLAIN.cr（著作權補救解說兩張卡）整份內容正規化後的樣子。",
      "測試只讀這份檔當預期值，絕不從受測內容即時產生；內容一改，測試就紅並印出差異。",
      "更新：改內容 → node tests/cr_snapshot.js 看差異 → 重新審定並送審 → PASS 後由人手動執行 node tests/cr_snapshot.js --write → 和內容同一個 commit。",
      "讀法：cr[0] 是第一張卡；欄位依鍵名排序；svg 是圖卡的元素樹（tag 元素、attrs 全部屬性、text 完整文字含 <tspan>、children 子節點，順序照原圖）。",
      "看不見的字元（零寬字、方向控制字、全形空白、不換行空白等）一律寫成 \\uXXXX。規則見 tests/cr_snapshot.js 檔頭。",
      "依據：docs/test21-snapshot-codex-designer-20261013.md（Codex 設計者結論）。",
    ],
    "規則版本": RULES_VERSION,
    "sha256": sha256Of(content),
    "cr": content,
  };
}
// 只對字串跳脫看不見的字元（排版用的換行、縮排在字串外面，不能動）
const jstr = (s) => escInvisible(JSON.stringify(s));
function flatJson(v) {
  if (Array.isArray(v)) return "[" + v.map(flatJson).join(",") + "]";
  if (isPlainObject(v)) return "{" + Object.keys(v).map((k) => jstr(k) + ":" + flatJson(v[k])).join(",") + "}";
  return typeof v === "string" ? jstr(v) : JSON.stringify(v);
}
function pretty(v, depth, key) {
  const pad = "  ".repeat(depth), inner = "  ".repeat(depth + 1);
  if (Array.isArray(v)) return v.length ? "[\n" + v.map((x) => inner + pretty(x, depth + 1)).join(",\n") + "\n" + pad + "]" : "[]";
  if (isPlainObject(v)) {
    const flat = flatJson(v);
    if (key === "attrs" || (isNode(v) && !v.children) || (Object.keys(v).every((k) => typeof v[k] === "string") && flat.length <= 160)) return flat;
    const ks = Object.keys(v);
    return ks.length ? "{\n" + ks.map((k) => inner + jstr(k) + ": " + pretty(v[k], depth + 1, k)).join(",\n") + "\n" + pad + "}" : "{}";
  }
  return flatJson(v);
}
const serialize = (doc) => pretty(doc, 0) + "\n";

module.exports = { RULES_VERSION, SNAPSHOT_FILE, normalize, normalizeText, normalizeSvg, parseSvg, diff, show, sha256Of, buildSnapshot, serialize };

if (require.main === module) {
  const args = process.argv.slice(2);
  const unknown = args.filter((x) => x !== "--write");
  if (unknown.length) { console.error("不認得的參數：" + unknown.join(" ") + "（只有 --write）"); process.exit(2); }
  const X = require("../src/chiexplain.js");
  const doc = buildSnapshot(X.EXPLAIN.cr);   // 內容不合規則（解析失敗等）會在這裡丟錯，不會寫檔
  let old = null;
  try { old = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, "utf8")); } catch (e) {
    if (e.code !== "ENOENT") console.log("審定快照讀不出來（" + e.message + "）。");
  }
  let same = false;
  if (!old || !Array.isArray(old.cr)) console.log("目前沒有可用的審定快照（" + SNAPSHOT_REL + "）。");
  else {
    const d = diff(old.cr, doc.cr);
    const meta = [];
    if (old["規則版本"] !== RULES_VERSION) meta.push("規則版本 " + show(old["規則版本"]) + " → " + show(RULES_VERSION));
    if (old.sha256 !== sha256Of(old.cr)) meta.push("審定快照的 cr 和它記的 sha256 對不上（被手改過？）");
    same = !d.length && !meta.length;
    if (same) console.log("和審定快照一致（sha256 " + doc.sha256 + "）。");
    else {
      console.log("和審定快照不一致（內容 " + d.length + " 處" + (meta.length ? "＋快照檔 " + meta.length + " 處" : "") + "）：");
      d.forEach((x) => console.log("  " + x.text));
      meta.forEach((x) => console.log("  [快照檔] " + x));
    }
  }
  if (args.indexOf("--write") >= 0) {
    fs.writeFileSync(SNAPSHOT_FILE, serialize(doc));
    console.log("已寫入 " + SNAPSHOT_REL + "（sha256 " + doc.sha256 + "）。這份差異要送審，PASS 後和內容同一個 commit。");
  } else if (!same) process.exitCode = 1;
}
