"""weak-export.js 在真瀏覽器（Chromium、WebKit）照錯題站的方式載入（交辦 #4027；錯題站設計書第 2 節）。

假的錯題站頁面放在 windsorya.github.io 同網域（route），先放替身 G5WeakExportRegister，再用 classic <script src> 載本站成品 weak-export.js：
  ① 檔案執行期間同步註冊恰好一次，當下 document.currentScript 就是這支 <script>（錯題站用它認是哪一科）
  ② key g5chi.v1、api 1、links 都是 null；載入前後 window 自有屬性一樣（沒新增、沒換掉錯題站的全域）
  ③ 載入與 summarize 都沒呼叫 localStorage 的任何方法
  ④ 合成存檔（node 用本站 core.js 產生）在瀏覽器裡算出的題數＝node 算的；壞字串回 {ok:false}
  ⑤ 頁面沒有 JS 錯誤
存檔是合成的（真實題庫 id、虛構作答狀態）。執行：python3.12 tests/e2e_weak_export.py
"""
import json
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PAGE = "https://windsorya.github.io/g5-wrong-review/__weak_export_probe.html"
EXPORT = "https://windsorya.github.io/g5-chinese-review/weak-export.js"
NOW = 1792382400000   # 2026-10-19 12:00 台北

SEED = r"""
const C=require('./src/core.js'),MB=require('./src/chibank.js'),vm=require('vm'),fs=require('fs'),B=C.bankFrom(MB),D='2026-10-19',s=C.blankState();
s.days[D]={planIds:[],doneIds:[],touched:[],extraDone:false,labRuns:0,teach:0,mood:null};
MB.CARDS.slice(0,40).forEach((c,i)=>{
  s.cards[c.id]=i%4===0?{seen:2,goodDays:['2026-10-15'],blockedDay:null,due:'2026-10-18'}:{seen:1,goodDays:[],blockedDay:i%4===1?'2026-10-17':null,due:'2026-10-20'};
  s.log.push({op:'o'+i,d:'2026-10-17',card:c.id,c:c.concept,ok:i%4===0,hint:false,unsure:false,variation:false,first:true});
  if(i%7===0)s.days[D].touched.push(c.id);});
Object.keys(MB.RETIRED).slice(0,3).forEach(id=>{s.cards[id]={seen:1,goodDays:[],blockedDay:null,due:'2026-10-20'};});
const raw=JSON.stringify(s);let x;const ctx={G5WeakExportRegister:e=>{x=e;}};ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync('weak-export.js','utf8'),ctx);
console.log(JSON.stringify({raw,want:x.summarize(raw,NOW_MS)}));
""".replace("NOW_MS", str(NOW))

HTML = """<!doctype html><html><head><meta charset="utf-8"></head><body><script>
(function(){
  var calls = [], ops = [];
  ["getItem","setItem","removeItem","clear","key"].forEach(function(m){
    var f = Storage.prototype[m];
    Storage.prototype[m] = function(){ ops.push(m); return f.apply(this, arguments); };
  });
  window.__probe = { calls: calls, ops: ops, before: Object.getOwnPropertyNames(window).sort() };
  window.G5WeakExportRegister = function(x){
    var cs = document.currentScript;
    calls.push({ x: x, src: cs && cs.src, sameEl: cs === document.getElementById("wx") });
  };
  window.__probe.before = Object.getOwnPropertyNames(window).sort();
})();
</script><script id="wx" src="%s"></script></body></html>""" % EXPORT

FAILS, DONE = [], []


def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"  ← {detail}"))
    DONE.append(name)
    if not ok:
        FAILS.append(name)


def main():
    d = json.loads(subprocess.check_output(["node", "-e", SEED], cwd=ROOT))
    js = (ROOT / "weak-export.js").read_text(encoding="utf-8")
    check("前提：合成存檔讀得懂，且同時有待加強、今天練過、考不到的題",
          d["want"]["ok"] and d["want"]["weak"] > d["want"]["weakToday"] > 0 and d["want"]["out"] == 3, d["want"])
    with sync_playwright() as p:
        for eng in (p.chromium, p.webkit):
            b = eng.launch()
            pg = b.new_page()
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.route(PAGE, lambda r: r.fulfill(status=200, content_type="text/html; charset=utf-8", body=HTML))
            pg.route(EXPORT, lambda r: r.fulfill(status=200, content_type="application/javascript; charset=utf-8", body=js))
            pg.goto(PAGE, wait_until="load")
            r = pg.evaluate("""(a) => { const P = window.__probe, c = P.calls;
                const after = Object.getOwnPropertyNames(window).sort();
                const x = c.length ? c[0].x : null, ops0 = P.ops.length;
                const got = x ? x.summarize(a.raw, a.now) : null, bad = x ? x.summarize("{", a.now) : null;
                return { n: c.length, src: c.length ? c[0].src : null, sameEl: c.length ? c[0].sameEl : false,
                  api: x && x.api, key: x && x.key, links: x && JSON.stringify(x.links), fn: x && typeof x.summarize,
                  added: after.filter(k => P.before.indexOf(k) < 0), removed: P.before.filter(k => after.indexOf(k) < 0),
                  opsLoad: ops0, opsAll: P.ops.slice(), got: got, bad: bad }; }""", {"raw": d["raw"], "now": NOW})
            n = eng.name
            check(f"{n} ① 執行期間同步註冊恰好一次，currentScript 是這支 <script>", r["n"] == 1 and r["sameEl"] and r["src"] == EXPORT, r)
            check(f"{n} ② key g5chi.v1、api 1、summarize 是函式、links 都是 null",
                  r["key"] == "g5chi.v1" and r["api"] == 1 and r["fn"] == "function" and r["links"] == '{"weak":null,"challenge":null}', r)
            check(f"{n} ② 載入前後 window 自有屬性相同（沒新增、沒拿掉）", r["added"] == [] and r["removed"] == [], (r["added"], r["removed"]))
            check(f"{n} ③ 載入與 summarize 都沒碰 localStorage", r["opsAll"] == [], r["opsAll"])
            check(f"{n} ④ 瀏覽器算的題數＝node 用本站 core.js 算的", r["got"] == d["want"], (r["got"], d["want"]))
            check(f"{n} ④ 壞字串回 {{ok:false}}", r["bad"] == {"ok": False}, r["bad"])
            check(f"{n} ⑤ 頁面沒有 JS 錯誤", not errs, errs)
            b.close()
    print(f"{len(DONE) - len(FAILS)}/{len(DONE)} PASS" if not FAILS else f"{len(FAILS)} FAIL")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
