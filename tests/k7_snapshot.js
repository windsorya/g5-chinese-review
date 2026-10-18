// 第三～六課（單元 k7）內容的審定快照工具（2026-10-18，Codex 設計者 L20261018080918-e4f31c 推薦方案②，報告 state/design_reports/）。
// 由來：用字串比對檢查孩子看到的解說／提示裡的部首說法，連 4 輪 Codex FAIL（X是Y部、部首是Y、偏旁名稱、引號位置、否定句……每補一種就有下一種繞過）。
// 設計者結論：不要再用有限句型判斷任意中文敘述 ⇒ k7 產題後的完整內容（每張卡每個欄位、解說每種說法含圖、先猜題、觀念、影片）釘一份審定快照，
// 任何一個字不同就要重審（REVIEW_REQUIRED）；部首模板、辭典比對這些結構檢查留在 tests/chibank.test.js。
// 用法：
//   node tests/k7_snapshot.js           印出現在內容和審定快照的差異（不寫檔）
//   node tests/k7_snapshot.js --write   人工審過差異、送審 PASS 後才執行：重寫 tests/k7_approved_snapshot.json（和內容同一個 commit）
// 測試（tests/chibank.test.js ㉖）只讀審定檔、絕不從待測內容產生預期值，也不會自動更新。
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const SNAPSHOT_FILE = path.join(__dirname, "k7_approved_snapshot.json");
const RULES_VERSION = "k7-snapshot/1";

// 函式（例如 svg）先執行再存；其餘照原樣深拷貝。物件鍵排序只為了存檔穩定，比對時鍵的順序不影響結果。
function plain(v) {
  if (typeof v === "function") return { "#fn": String(v()) };
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === "object") { const o = {}; Object.keys(v).sort().forEach((k) => { o[k] = plain(v[k]); }); return o; }
  return v;
}
function view(B, X, VID) {
  B = B || require("../src/chibank.js"); X = X || require("../src/chiexplain.js"); VID = VID || require("../src/chivideos.js");
  const ks = Object.keys(B.CONCEPTS).filter((k) => B.CONCEPTS[k].unit === "k7").sort();
  const cards = {};
  B.ALL_CARDS.filter((c) => ks.indexOf(c.concept) >= 0).forEach((c) => { cards[c.id] = plain(c); });
  const by = (m) => { const o = {}; ks.forEach((k) => { o[k] = plain(m[k] === undefined ? null : m[k]); }); return o; };
  return { unit: B.UNITS.k7, concepts: by(B.CONCEPTS), cards, explain: by(X.EXPLAIN), predict: by(X.PREDICT), videos: by(VID.V), noVideo: by(VID.NO_VIDEO || {}),
    merged: plain(Object.fromEntries(Object.keys(B.MERGED).filter((id) => cards[id]).map((id) => [id, B.MERGED[id]]))) };
}
const INVISIBLE = new RegExp("[" + String.fromCharCode(0x200b) + "-" + String.fromCharCode(0x200f) + String.fromCharCode(0x2028, 0x2029, 0xfeff) + "]", "g");
const show = (v) => JSON.stringify(v).replace(INVISIBLE, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
// 逐字比對（字串不做任何正規化：空白、標點、零寬字都算差異）；物件比鍵集合、陣列照順序
function diff(want, got, p, out) {
  out = out || []; p = p || "k7";
  if (typeof want !== typeof got || Array.isArray(want) !== Array.isArray(got) || (want === null) !== (got === null)) { out.push({ path: p, text: show(want) + " → " + show(got) }); return out; }
  if (Array.isArray(want)) {
    for (let i = 0; i < Math.max(want.length, got.length); i++) {
      if (i >= got.length) out.push({ path: p + "[" + i + "]", text: "少了這一項 " + show(want[i]) });
      else if (i >= want.length) out.push({ path: p + "[" + i + "]", text: "多了這一項 " + show(got[i]) });
      else diff(want[i], got[i], p + "[" + i + "]", out);
    }
  } else if (want && typeof want === "object") {
    new Set(Object.keys(want).concat(Object.keys(got))).forEach((k) => {
      if (!(k in got)) out.push({ path: p + "." + k, text: "少了這個欄位 " + show(want[k]) });
      else if (!(k in want)) out.push({ path: p + "." + k, text: "多了這個欄位 " + show(got[k]) });
      else diff(want[k], got[k], p + "." + k, out);
    });
  } else if (want !== got) out.push({ path: p, text: show(want) + " → " + show(got) });
  return out;
}
const sha256Of = (content) => crypto.createHash("sha256").update(JSON.stringify(content)).digest("hex");

module.exports = { SNAPSHOT_FILE, RULES_VERSION, view, diff, plain, sha256Of, show };

if (require.main === module) {
  const cur = view();
  if (process.argv.includes("--write")) {
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify({ "規則版本": RULES_VERSION, "說明": "第三～六課內容審定快照；只能由人審過差異、送審 PASS 後手動 node tests/k7_snapshot.js --write 產生", sha256: sha256Of(cur), content: cur }, null, 1) + "\n");
    console.log("wrote " + SNAPSHOT_FILE + "（" + Object.keys(cur.cards).length + " 張卡）");
  } else {
    let snap = null; try { snap = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, "utf8")); } catch (e) { console.log("還沒有審定快照"); process.exit(1); }
    const d = diff(snap.content, cur);
    d.forEach((x) => console.log(x.path + "：" + x.text));
    console.log(d.length ? d.length + " 處和審定版不同（REVIEW_REQUIRED）" : "和審定版相同");
    process.exit(d.length ? 1 : 0);
  }
}
