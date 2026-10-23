// 國語站「待加強題數」給錯題站讀（交辦 #4027；介面＝g5-wrong-review docs/app-weak-entry-design-20261019.md 第 2 節）。
// build.py 把下面的 @LIB 標記換成 src/chibank.js＋src/core.js 原文，產生網站根目錄 weak-export.js（不要手改那一份）。
// 判定一律走 core.js（bankFrom 組題庫與停出名單、decode 讀存檔、weakSummary＝各單元「練待加強的」會出的題），和首頁同一份程式；這裡只接線。
// classic script、IIFE：執行期間同步註冊一次；不新增也不改任何全域、不讀寫 localStorage、不連網（設計書 I1）。
(function () {
  if (typeof window === "undefined" || typeof window.G5WeakExportRegister !== "function") return;   // 不是被錯題站載入就什麼都不做
  var lib = (function () {
    var window = {}, module = void 0;   // 遮住真的 window／module：內嵌的題庫與核心只掛到這個區域物件，不碰全域
    /*@LIB*/
    return { MB: window.G5ChiBank, C: window.G5Core };
  })();
  var MB = lib.MB, C = lib.C, BANK = C.bankFrom(MB), UNITS = Object.keys(MB.UNITS);
  function n(a) { return a.length; }
  window.G5WeakExportRegister({
    api: 1,
    key: C.LS_KEY,
    links: { weak: null, challenge: null },   // 本站還沒有「直接開練」的深連結（#go=weak）：錯題站連首頁並說明怎麼按
    summarize: function (raw, nowMs) {
      try {
        if (typeof raw !== "string" || typeof nowMs !== "number" || !isFinite(nowMs)) return { ok: false };
        var r = C.decode(raw, BANK);   // 和首頁開檔同一個判準：讀不進來的存檔首頁也打不開
        if (!r.accepted) return { ok: false };
        var s = r.state, w = C.weakSummary(s, BANK, UNITS, MB.RETIRED, C.dayKey(nowMs)), seen = 0;
        Object.keys(s.cards).forEach(function (k) { seen += s.cards[k].seen; });
        return { ok: true, answers: s.log.length, seen: seen, weak: n(w.weak), weakToday: n(w.weakNow),
                 challenge: n(w.challenge), challengeToday: n(w.challengeNow), out: n(w.out) };
      } catch (e) { return { ok: false }; }
    }
  });
})();
