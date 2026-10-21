#!/usr/bin/env python3
"""五上國語複習 e2e：本機 index.html（或 --base 正式網址）；Chromium 桌機／手機 390、WebKit iPad。
用 python3.12 執行：python3.12 tests/e2e.py [--base https://windsorya.github.io/g5-chinese-review/]
由數學站 g5-math-review 9545348 的 tests/e2e.py 改寫：題庫換成 window.G5ChiBank；「跟著算一題」換成「看例句」；
存檔 key 換成 g5chi.v1；切換列是四站；另外驗切換列的連結真的點得過去（攔截成假頁面，不連外網）。
題目答案從頁面上的 window.G5ChiBank 依題目文字查（題庫本身另有 tests/chibank.test.js 獨立檢查）。"""
import json
import math
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
# 不公開字詞（學校名稱等）放本機 ~/Documents/g5-curriculum/curriculum.json，不寫進公開 repo（2026-10-18）；
# 讀不到就讓那一項判失敗（量不到≠乾淨）
_PRIV = Path.home() / "Documents" / "g5-curriculum" / "curriculum.json"
PRIVATE_TERMS = json.loads(_PRIV.read_text(encoding="utf-8")).get("private_terms", []) if _PRIV.exists() else []
BASE = sys.argv[sys.argv.index("--base") + 1].rstrip("/") + "/" if "--base" in sys.argv else ROOT.as_uri() + "/"
URL = BASE + "index.html"
RESULTS = []
SITES = {"https://windsorya.github.io/g5-sci-review/": "五上自然複習",
         "https://windsorya.github.io/g5-math-review/": "五上數學複習",
         "https://windsorya.github.io/g5-help/": "難題解說",
         "https://windsorya.github.io/g5-social-review/": "五上社會複習",
         "https://windsorya.github.io/g5-wrong-review/": "錯題複習"}
SELF_NAME = "五上國語複習"


def check(name, cond, detail=""):
    RESULTS.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  ← {detail}"))


def open_page(browser, device=None, init=None):
    ctx = browser.new_context(**(device or {}))
    if init:
        ctx.add_init_script(init)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL)
    page.wait_for_selector("#main .btn, #main .done")
    return ctx, page, errors


def current_card(page):
    q = page.locator("#main .q").inner_text()
    return page.evaluate("(q)=>{var c=G5ChiBank.CARDS.find(function(x){return x.q===q;});return c?{id:c.id,a:c.a,opts:c.opts,concept:c.concept,wrongWhy:c.wrongWhy}:null;}", q)


def answer(page, right=True):
    c = current_card(page)
    assert c, "頁面上的題目在題庫裡找不到"
    i = c["a"] if right else (c["a"] + 1) % len(c["opts"])
    page.locator(f'#main .opt[data-i="{i}"]').click()
    return c, i


def no_overflow(page):
    return page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")


def flow_main(browser, label, device=None):
    ctx, pg, errors = open_page(browser, device)
    n_concepts = pg.evaluate("Object.keys(G5ChiBank.CONCEPTS).length")
    check(f"{label} 首頁標題與倒數", SELF_NAME in pg.title() and pg.locator("#days").inner_text().strip().isdigit(), pg.title())
    # 2026-10-14：加第一課字形、多音字三個觀念與國練第二課五個觀念，10 → 18
    # 2026-10-18 第三～六課加五個觀念（18 → 23，交辦 #2703）
    check(f"{label} {n_concepts} 個觀念入口", n_concepts == 23 and pg.locator("#concepts .ccard").count() == n_concepts, pg.locator("#concepts .ccard").count())
    check(f"{label} 小考複習列出七組（含 2026-10-18 第三～六課 k7）", all(pg.locator(f'button[data-rv="u{u}"]').count() == 1 for u in ["k1", "k2", "k3", "k4", "k5", "k6", "k7"]))
    # 10/15 小考的國練第二課要排在「小考前想全部練一次」第一個
    check(f"{label} 國練第二課排第一個", pg.locator("button[data-rv]").first.get_attribute("data-rv") == "uk6",
          pg.locator("button[data-rv]").first.get_attribute("data-rv"))
    check(f"{label} 沒有水平捲動", no_overflow(pg))
    nav = pg.evaluate("[...document.querySelectorAll('#siteNav a')].map(a=>[a.getAttribute('href'),a.textContent.trim()])")
    check(f"{label} 切換列：連到其他每一站、目前站是「{SELF_NAME}」",
          dict(nav) == SITES and pg.locator('#siteNav [aria-current="page"]').inner_text() == SELF_NAME, nav)
    body = pg.locator("body").inner_text()
    check(f"{label} 畫面不出現學校名稱等不公開字詞", bool(PRIVATE_TERMS) and not [t for t in PRIVATE_TERMS if t in body])
    pg.locator("#goAll").click()
    pg.wait_for_selector("#main .q")
    c, _ = answer(pg, True)
    check(f"{label} 練一題答對：顯示答對了與解說", "答對了" in pg.locator("#ansBox").inner_text())
    pg.locator("#next").click(); pg.wait_for_selector("#main .q")
    c2, picked = answer(pg, False)
    box = pg.locator("#ansBox").inner_text()
    want = f"你選的「{c2['opts'][picked]}」錯在：{c2['wrongWhy'][picked]}"
    check(f"{label} 答錯：顯示正確答案、「你選的…錯在…」", "正確答案是" in box and want in box, box[:240])
    pg.locator('#errq button[data-k="concept"]').click()
    pg.wait_for_selector("#remedy")
    rem = pg.locator("#remedy").inner_text()
    check(f"{label} 補救：有圖解（svg）、白話解說、例句與「看例句，再換一題確認」",
          pg.locator("#remedy svg.fig").count() >= 1 and pg.locator("#remedy li").count() >= 2 and "例句" in rem and pg.locator("#toLab").count() == 1, rem[:200])
    pg.locator("#toLab").click()
    pg.wait_for_selector("#labPredict button[data-g]")
    pg.locator("#labPredict button[data-g]").first.click()
    n = 0
    while pg.locator("#mNext").is_visible() and n < 10:
        pg.locator("#mNext").click(); n += 1
    check(f"{label} 看例句：每個例句都看過後可以換一題確認", n >= 1 and pg.locator("#labDone").is_enabled(), n)
    pg.locator("#labDone").click()
    pg.wait_for_selector("#main .q")
    head = pg.locator("#main .qhead").inner_text()
    c3 = current_card(pg)
    check(f"{label} 換一題確認：同一個觀念、不同的題", "同觀念換一題確認" in head and c3 and c3["concept"] == c2["concept"] and c3["id"] != c2["id"], {"head": head, "c2": c2["id"], "c3": c3 and c3["id"]})
    saved = json.loads(pg.evaluate("localStorage.getItem('g5chi.v1')") or "null")
    check(f"{label} 存檔在 g5chi.v1，作答都記到", saved and len(saved.get("log", [])) >= 2, (saved or {}).get("log"))
    other = pg.evaluate("Object.keys(localStorage).filter(k=>k!=='g5chi.v1'&&k!=='g5chi.mapSeen')")   # mapSeen＝探險地圖看過第幾階（本站自己的 key）
    check(f"{label} 只寫自己的 key（不碰 g5math／g5sci／g5help）", other == [], other)
    pg.reload(); pg.wait_for_selector("#main .btn, #main .done")
    saved2 = json.loads(pg.evaluate("localStorage.getItem('g5chi.v1')") or "null")
    check(f"{label} 重新整理後紀錄還在", saved2 and len(saved2.get("log", [])) == len(saved.get("log", [])) and pg.locator("#cal i.on").count() >= 1)
    # 跨裝置同步面板（g5-help/sync.js 已收 g5chi.v1）：展開後看得到「開啟跨裝置同步」按鈕，代表 G5Sync.init 真的接上、沒有退回「還沒開放」
    sync_txt = "（頁面沒有 #syncBox／#g5sync）"
    if pg.locator("#syncBox summary").count() == 1 and pg.locator("#g5sync").count() == 1:
        pg.locator("#syncBox summary").click()
        try:
            pg.wait_for_function("document.querySelector('#g5sync').innerText.indexOf('開啟跨裝置同步') >= 0", timeout=10000)
        except Exception:  # noqa: BLE001 — 逾時就照實記 FAIL
            pass
        sync_txt = pg.locator("#g5sync").inner_text()
    check(f"{label} 同步面板：展開看得到「開啟跨裝置同步」", "開啟跨裝置同步" in sync_txt, sync_txt[:200])
    check(f"{label} 沒有 JS 錯誤", not errors, errors)
    ctx.close()


def flow_nav_click(browser, label, device=None):
    """切換列連結真的點得過去：攔截 windsorya.github.io 回假頁面（不連外網），點每一個連結，看網址到了該站。"""
    ctx, pg, errors = open_page(browser, device)
    # 只攔另外幾站：正式網址也在 windsorya.github.io 底下，全攔會連本站都換成假頁（2026-10-13 線上跑實測逾時）
    for href in SITES:
        ctx.route(href + "**", lambda route: route.fulfill(status=200, content_type="text/html; charset=utf-8", body="<title>stub</title>stub"))
    bad = []
    for href, name in SITES.items():
        pg.goto(URL); pg.wait_for_selector("#siteNav a")
        pg.locator("#siteNav a", has_text=name).click()
        pg.wait_for_url(href + "**", timeout=5000)
        if not pg.url.startswith(href):
            bad.append((name, pg.url))
    check(f"{label} 切換列每個連結點了都到對的站", not bad, bad)
    ctx.close()


def flow_concepts(browser, label, device=None):
    ctx, pg, errors = open_page(browser, device)
    cids = pg.evaluate("Object.keys(G5ChiBank.CONCEPTS)")
    bad = []
    for cid in cids:
        pg.locator(f'#concepts .ccard[data-cid="{cid}"]').click()
        pg.wait_for_selector("#main .remedy")
        first = pg.locator("#main .remedy strong").first.inner_text()
        ok = pg.locator("#main .remedy svg.fig").count() == 1 and pg.locator("#main .remedy li").count() >= 2 and "例句" in pg.locator("#main .remedy").inner_text()
        pg.locator("#cMore").click()
        second = pg.locator("#main .remedy strong").first.inner_text()
        ok = ok and second != first and pg.locator("#main .remedy svg.fig").count() == 1 and pg.locator("#main .remedy li").count() >= 2
        vids = pg.locator("#main .vids")
        # 每個觀念頁：有影片播放鈕，或寫明「這個觀念沒有放影片」的理由（standard.test.js ① 另驗理由內容）
        ok = ok and vids.count() >= 1 and (pg.locator("#main .vids button[data-play]").count() >= 1 or "沒有放影片" in vids.first.inner_text())
        if not ok or not no_overflow(pg):
            bad.append(cid)
        pg.locator("#cBack").click(); pg.wait_for_selector("#concepts .ccard")
    check(f"{label} {len(cids)} 個觀念頁：兩種說法都有圖、解說、例句，有影片或寫明理由，沒有水平捲動", not bad, bad)
    check(f"{label} 觀念頁沒有 JS 錯誤", not errors, errors)
    ctx.close()


# 播放器畫面出現這些字＝不能播（YouTube 嵌入錯誤頁；英文介面與中文介面都列）。比對時不分大小寫。
# 以下 PLAYER_*／player_problem／selftest_player／flow_video_live 照數學站 g5-math-review b1ae271 的 tests/e2e.py
# （Codex 審 e0ad0ad8：舊版 `paused … and … t > 0` 對 {hasVideo:true, paused:true, t:10} 判通過，不能證明影片真的在播）。
PLAYER_ERROR_MARKS = ("video unavailable", "this video is private", "private video", "error 153", "錯誤 153",
                      "無法播放", "影片無法觀看", "私人影片", "an error occurred", "發生錯誤",
                      "sign in to confirm", "登入以確認")
# 讀播放器 iframe 裡的真實狀態。正常播放時 body 文字常是空的（數學站 2026-10-13 正式網址實測），所以「沒有文字」不算失敗；
# 能不能播看 <video> 元素：存在、沒有 YouTube 錯誤畫面、隔一段時間讀兩次，第二次沒暫停且時間有前進。
PLAYER_STATE_JS = """b => { const v = b.querySelector('video'), e = b.querySelector('.ytp-error');
  return {text: (b.innerText || '').trim().slice(0, 200), hasVideo: !!v, t: v ? v.currentTime : null, paused: v ? v.paused : null,
          err: e ? (e.innerText || 'ytp-error').trim().slice(0, 120) : ''}; }"""
PLAY_GAP_MS = 2000        # 兩次讀狀態之間隔多久
PLAY_MIN_ADVANCE = 0.5    # 隔 PLAY_GAP_MS 後 currentTime 至少要多這麼多秒，才算真的在播


def player_problem(src, rp, read_state, wait):
    """判斷一個嵌入播放器是不是真的在播；回傳問題說明，在播回傳 None。
    read_state() 回傳 {text, hasVideo, t, paused, err}；先讀一次、wait()（約 2 秒）、再讀一次：
    兩次都要讀得到、有 <video>、沒有錯誤畫面；第二次 paused=false，且 currentTime 比第一次多 ≥ PLAY_MIN_ADVANCE 秒。"""
    if "youtube-nocookie.com/embed/" not in (src or ""):
        return f"iframe 沒指向 youtube-nocookie：{src}"
    if rp != "strict-origin-when-cross-origin":
        return f"referrerpolicy 不對：{rp}"
    states = []
    for k in (1, 2):
        if k == 2:
            wait()
        try:
            st = read_state()
        except Exception as e:  # noqa: BLE001 — 任何讀取失敗都是播放失敗
            return f"第 {k} 次讀不到播放器內容（{type(e).__name__}：{str(e)[:60]}）"
        if not isinstance(st, dict):
            return f"第 {k} 次讀到的播放器狀態讀不懂：{st!r}"[:120]
        low = (str(st.get("text") or "") + " " + str(st.get("err") or "")).lower()
        hit = next((m for m in PLAYER_ERROR_MARKS if m.lower() in low), None)
        if st.get("err") or hit:
            return f"第 {k} 次讀：播放器顯示錯誤（{hit or st.get('err')}）"
        if not st.get("hasVideo"):
            return f"第 {k} 次讀：播放器裡沒有 <video>（沒有載入影片）"
        states.append(st)
    t1, t2 = states[0].get("t"), states[1].get("t")
    if not all(isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x) for x in (t1, t2)):
        return f"讀不到播放時間（t={t1}→{t2}）"
    if states[1].get("paused") is not False:
        return f"第二次讀時影片沒有在播（paused={states[1].get('paused')}、t={t2}）"
    if t2 - t1 < PLAY_MIN_ADVANCE:
        return f"影片沒有往前播（隔約 {PLAY_GAP_MS / 1000:g} 秒，t {t1}→{t2}，只多 {t2 - t1:.2f} 秒，至少要 {PLAY_MIN_ADVANCE}）"
    return None


def selftest_player():
    """播放判準的替身測試（不開瀏覽器）：餵假的兩次狀態序列，斷言判對；也斷言兩次讀之間真的有等（呼叫順序 讀→等→讀）。"""
    ok_src, ok_rp = "https://www.youtube-nocookie.com/embed/abcdefghijk?start=10", "strict-origin-when-cross-origin"

    def st(**kw):
        return dict({"text": "", "hasVideo": True, "t": 10.0, "paused": False, "err": ""}, **kw)
    boom = TimeoutError("frame 逾時")
    cases = [  # (說明, 兩次狀態（例外＝讀時丟出）, 應判在播?)
        ("Codex 反例 {hasVideo:true, paused:true, t:10}：停著", [st(t=10, paused=True), st(t=10, paused=True)], False),
        ("{paused:false, t:0}：沒前進", [st(t=0, paused=False), st(t=0, paused=False)], False),
        ("正常在播：10→12.1", [st(t=10), st(t=12.1)], True),
        ("剛好前進 0.5 秒", [st(t=10), st(t=10.5)], True),
        ("第二次暫停（雖然時間有前進）", [st(t=10), st(t=12, paused=True)], False),
        ("第二次 paused=None（讀不到）", [st(t=10), st(t=12, paused=None)], False),
        ("只前進 0.3 秒（緩衝中）", [st(t=10), st(t=10.3)], False),
        ("時間倒退", [st(t=18), st(t=10)], False),
        ("第一次 paused=true、第二次在播且前進", [st(t=10, paused=True), st(t=11.9)], True),
        ("第二次讀逾時", [st(t=10), boom], False),
        ("第一次讀逾時", [boom, st(t=12)], False),
        ("第二次出現 Video unavailable", [st(t=10), st(t=12, text="Video unavailable. This video is private.")], False),
        ("第一次有 .ytp-error", [st(err="ytp-error"), st(t=12)], False),
        ("Sign in to confirm you're not a bot", [st(t=10, text="Sign in to confirm you're not a bot"), st(t=12)], False),
        ("沒有 <video>", [st(hasVideo=False, t=None, paused=None), st(hasVideo=False, t=None, paused=None)], False),
        ("t 是 None", [st(t=None), st(t=None)], False),
        ("t 是字串", [st(t="10"), st(t="12")], False),
        ("狀態不是 dict", ["???", st(t=12)], False),
    ]
    wrong = []
    for name, seq, want in cases:
        log, it = [], iter(seq)

        def read():
            log.append("讀"); x = next(it)
            if isinstance(x, Exception):
                raise x
            return x
        got = player_problem(ok_src, ok_rp, read, lambda: log.append("等")) is None
        if got != want:
            wrong.append(f"{name}：應判{'在播' if want else '沒在播'}，判成{'在播' if got else '沒在播'}")
        if want and log != ["讀", "等", "讀"]:
            wrong.append(f"{name}：呼叫順序應為 讀→等→讀，實際 {log}")
    if player_problem("https://www.youtube.com/embed/abcdefghijk", ok_rp, lambda: st(), lambda: None) is None:
        wrong.append("iframe 不是 youtube-nocookie 卻判在播")
    if player_problem(ok_src, "no-referrer", lambda: st(), lambda: None) is None:
        wrong.append("referrerpolicy 錯卻判在播")
    check(f"播放判準替身測試：{len(cases) + 2} 個假狀態序列都判對（含 Codex 的 {{hasVideo:true,paused:true,t:10}}）", not wrong, wrong)


def flow_video_live(browser, label, device=None):
    """只在線上版跑：每個有影片的觀念頁按第一段影片播放，iframe 指向 youtube-nocookie、帶 referrerpolicy；
    等播放器載入後隔約 2 秒讀兩次 <video>：都有 <video>、沒有錯誤畫面，第二次在播且時間前進 ≥0.5 秒。任何一個觀念失敗就記 FAIL。"""
    ctx, pg, errors = open_page(browser, device)
    bad, ok = [], []
    cids = pg.evaluate("Object.keys(G5ChiBank.CONCEPTS).filter(k=>(G5_VIDEOS.V[k]||[]).length)")
    for cid in cids:
        pg.locator(f'#concepts .ccard[data-cid="{cid}"]').click(); pg.wait_for_selector("#main .remedy")
        pg.locator("#main .vids button[data-play]").first.click()
        fr = pg.locator("#main .vids iframe").first
        src, rp = fr.get_attribute("src"), fr.get_attribute("referrerpolicy")
        pg.wait_for_timeout(5000)
        seen = []

        def read():
            s = pg.frame_locator("#main .vids iframe").first.locator("body").evaluate(PLAYER_STATE_JS, timeout=10000)
            seen.append({k: s.get(k) for k in ("t", "paused")} if isinstance(s, dict) else s)
            return s
        why = player_problem(src, rp, read, lambda: pg.wait_for_timeout(PLAY_GAP_MS))
        if why:
            bad.append((cid, why))
        else:
            ok.append((cid, seen))
        pg.locator("#cBack").click(); pg.wait_for_selector("#concepts .ccard")
    print("  影片兩次讀到的狀態（觀念：[第一次, 第二次]）：" + json.dumps(ok, ensure_ascii=False))
    check(f"{label} {len(cids)} 個有影片的觀念都真的在播（隔 {PLAY_GAP_MS / 1000:g} 秒讀兩次：有 <video>、無錯誤畫面、第二次沒暫停、時間前進 ≥{PLAY_MIN_ADVANCE} 秒）",
          cids and not bad, bad or "沒有任何有影片的觀念")
    ctx.close()


def flow_redo_after_external_clear(browser):
    """Codex 審 g5-sci-review 4d8b1e0（四站同型）：做完含答錯題的一輪 → 存檔被別處清掉 → 切回頁面（只重畫側欄，結束畫面還在）
    → 按「再練答錯的」，舊版 V().session.wrong 讀 null 拋 TypeError、按鈕沒反應。"""
    ctx, pg, errors = open_page(browser, {"viewport": {"width": 390, "height": 844}})
    pg.locator("#goLight").click(); pg.wait_for_selector("#main .q")
    answer(pg, False); pg.locator('#errq button[data-k=""]').click()
    for _ in range(8):
        if pg.locator("#goRedo").count():
            break
        if pg.locator("#next").count() and pg.locator("#next").is_visible():
            pg.locator("#next").click()
        elif pg.locator("#main .q").count():
            answer(pg, True)
    check("清檔前：一輪結束畫面有「再練答錯的 1 張」", "再練答錯的 1 張" in pg.inner_text("#main"), pg.inner_text("#main")[:160])
    pg.evaluate("localStorage.removeItem('g5chi.v1'); document.dispatchEvent(new Event('visibilitychange')); 0")
    pg.locator("#goRedo").click()
    check("存檔被別處清掉後按舊畫面的「再練答錯的」：不拋錯、回到首頁", not errors and pg.locator("#goAll").count() == 1, errors or pg.inner_text("#main")[:160])
    ctx.close()


def flow_lab_after_external_clear(browser):
    """Codex 審 c28888ed（#1541）：看例句中途存檔被別處清掉（別的分頁清除、同步換檔）→ 切回頁面 → 再按例句頁的按鈕，
    核心回 NO_RUN；舊版留在例句頁、按了沒反應也沒有任何提示。新版照磁碟現況回首頁。另驗正常按「看完了」仍到完成畫面。"""
    clear = "localStorage.removeItem('g5chi.v1'); document.dispatchEvent(new Event('visibilitychange')); 0"

    def open_lab(pg):
        pg.locator("#concepts .ccard").first.click(); pg.wait_for_selector("#cLab")
        pg.locator("#cLab").click(); pg.wait_for_selector("#labPredict button[data-g]")

    def open_lab_wrong(pg):   # 答錯後補救進來的例句頁（完成鈕是「我看懂了，換一題確認」）
        pg.locator("#goAll").click(); pg.wait_for_selector("#main .q")
        answer(pg, False); pg.locator('#errq button[data-k="concept"]').click()
        pg.wait_for_selector("#toLab"); pg.locator("#toLab").click(); pg.wait_for_selector("#labPredict button[data-g]")

    def see_all(pg):
        pg.locator("#labPredict button[data-g]").first.click()
        n = 0
        while pg.locator("#mNext").is_visible() and n < 12:
            pg.locator("#mNext").click(); n += 1

    ctx, pg, errors = open_page(browser, {"viewport": {"width": 390, "height": 844}})
    open_lab(pg); see_all(pg); pg.locator("#labDone").click()
    check("看例句（觀念頁進來）：正常按「看完了」到完成畫面", pg.locator("#main .done").count() == 1 and "看完了" in pg.inner_text("#main"), pg.inner_text("#main")[:120])
    ctx.close()
    bg = "localStorage.removeItem('g5chi.v1'); 0"   # 沒切換頁面（同步在背景換檔）：記憶體還有這次例句，存檔時核心才回 NO_RUN
    mid = lambda p: p.locator("#labPredict button[data-g]").first.click()
    for name, opener, before, js, press in [("例句都看完後按「看完了」", open_lab, see_all, clear, "#labDone"),
                                            ("（答錯補救進來）例句都看完後按「我看懂了，換一題確認」", open_lab_wrong, see_all, clear, "#labDone"),
                                            ("看到一半按「下一個例句」", open_lab, mid, clear, "#mNext"),
                                            ("（沒切換頁面）看到一半按「下一個例句」", open_lab, mid, bg, "#mNext"),
                                            ("還沒猜就點猜測選項", open_lab, lambda p: None, clear, "#labPredict button[data-g] >> nth=0")]:
        ctx, pg, errors = open_page(browser, {"viewport": {"width": 390, "height": 844}})
        opener(pg); before(pg)
        pg.evaluate(js); pg.locator(press).click()
        check(f"看例句中存檔被別處清掉後{name}：回到首頁、沒有 JS 錯誤",
              not errors and pg.locator("#labNav").count() == 0 and pg.locator("#goAll").count() == 1, errors or pg.inner_text("#main")[:120])
        ctx.close()
    # 社會站 Codex 審 e195ef98 第 3 項後半（#1542，四站同型 #2231）：下一個例句存檔失敗（留下待存）→ 恢復 → 存檔被別處清掉 → 按「再存一次」。
    # 舊版核心回 NO_RUN 但留著待存、狀態仍 failed：按了沒反應、提示列一直在。應該：回首頁、提示列消失。
    ctx, pg, errors = open_page(browser, {"viewport": {"width": 390, "height": 844}})
    open_lab(pg); mid(pg)
    pg.evaluate("window.__realSet = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException('QuotaExceededError', 'QuotaExceededError'); }; 0")
    pg.locator("#mNext").click(); pg.evaluate("Storage.prototype.setItem = window.__realSet; 0")
    had_retry = pg.locator("#retrySave").count() == 1
    pg.evaluate(bg); pg.locator("#retrySave").click()
    check("看例句存檔失敗待重試中、存檔又被別處清掉後按「再存一次」：回到首頁、提示列消失、沒有 JS 錯誤",
          had_retry and not errors and pg.locator("#labNav").count() == 0 and pg.locator("#goAll").count() == 1 and pg.locator("#retrySave").count() == 0,
          {"先出現再存一次": had_retry, "errors": errors, "main": pg.inner_text("#main")[:80], "再存一次": pg.locator("#retrySave").count()})
    ctx.close()
    # Codex 審 3b7cfc6a 第 2 項（#2634）：一步存檔失敗 → 回首頁 → 進觀念頁、寫入仍失敗時按「看例句」（開不成，人還在觀念頁、screen 卻已是 lab）
    # → 存檔被別處清掉、寫入恢復 → 按「再存一次」：不得把她從觀念頁甩回首頁。
    ctx, pg, errors = open_page(browser, {"viewport": {"width": 390, "height": 844}})
    open_lab(pg); mid(pg)
    pg.evaluate("window.__realSet = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException('QuotaExceededError', 'QuotaExceededError'); }; 0")
    pg.locator("#mNext").click(); pg.locator("#labHome").click()
    pg.locator("#concepts .ccard").first.click(); pg.wait_for_selector("#cLab"); pg.locator("#cLab").click()
    on_concept = pg.locator("#cLab").count() == 1 and pg.locator("#labNav").count() == 0
    pg.evaluate(bg); pg.evaluate("Storage.prototype.setItem = window.__realSet; 0"); pg.locator("#retrySave").first.click()
    check("例句頁沒開成、人還在觀念頁時按「再存一次」（那一輪已被別處清掉）：留在觀念頁、提示列消失、沒有 JS 錯誤",
          on_concept and not errors and pg.locator("#cLab").count() == 1 and pg.locator("#goAll").count() == 0 and pg.locator("#retrySave").count() == 0,
          {"先在觀念頁": on_concept, "errors": errors, "main": pg.inner_text("#main")[:80], "再存一次": pg.locator("#retrySave").count()})
    ctx.close()


BREAK_SET = """() => { window.__realSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function () { throw new DOMException('QuotaExceededError', 'QuotaExceededError'); }; }"""
FIX_SET = "() => { Storage.prototype.setItem = window.__realSet; }"
LAST_RUN = """() => { const s = JSON.parse(localStorage.getItem('g5chi.v1') || 'null'); if (!s) return null;
  const ids = Object.keys(s.labRuns || {}); const r = s.labRuns[ids[ids.length - 1]];
  return r ? {id: ids[ids.length - 1], n: ids.length, tasksDone: r.tasksDone.slice().sort(), tasks: r.tasks} : null; }"""


def enter_lab_wrong(pg):   # 答錯後補救進來，先猜一個；回傳任務（例句）數
    pg.locator("#goAll").click(); pg.wait_for_selector("#main .q")
    answer(pg, False); pg.locator('#errq button[data-k="concept"]').click()
    pg.wait_for_selector("#toLab"); pg.locator("#toLab").click(); pg.wait_for_selector("#labPredict button[data-g]")
    pg.locator("#labPredict button[data-g]").first.click(); pg.wait_for_selector("#mNext")
    return pg.evaluate("document.querySelectorAll('#labTask .ck').length")


def flow_lab_last_resume(browser):
    """社會站 #1542 ①（e554ab6）三姊妹站同型（#2632）：最後一個例句存檔失敗→恢復→切回分頁（visibilitychange 補存）。
    舊版切回分頁只重繪側欄，任務與完成鈕還是存檔前的樣子，完成鈕一直停用、「下一個例句」也已收起，卡死。應該：補存後完成鈕可按。"""
    ctx, pg, errors = open_page(browser, {"viewport": {"width": 390, "height": 844}})
    n = enter_lab_wrong(pg)
    for _ in range(n - 1):
        pg.locator("#mNext").click()
    pg.evaluate(BREAK_SET); pg.locator("#mNext").click()
    had_retry = pg.locator("#retrySave").count() >= 1
    pg.evaluate(FIX_SET)
    pg.evaluate("() => document.dispatchEvent(new Event('visibilitychange'))")
    if pg.locator("#mNext").is_visible():
        pg.locator("#mNext").click()
    run = pg.evaluate(LAST_RUN)
    check("看例句最後一個例句存檔失敗→恢復→切回分頁補存：每個例句都記到、提示列消失、完成鈕可按",
          had_retry and run and run["tasksDone"] == list(range(n)) and pg.locator("#retrySave").count() == 0 and pg.locator("#labDone").is_enabled(),
          {"先出現再存一次": had_retry, "run": run, "再存一次": pg.locator("#retrySave").count(), "完成鈕": pg.locator("#labDone").is_enabled()})
    if pg.locator("#labDone").is_enabled():
        pg.locator("#labDone").click()
    check("看例句補存後按「我看懂了，換一題確認」：回到練習換一題", pg.locator("#main .q").count() == 1, pg.inner_text("#main")[:120])
    check("看例句最後一個例句補存流程沒有 JS 錯誤", not errors, errors)
    ctx.close()


def flow_lab_retry_resume(browser):
    """社會站 #1542 ②（e554ab6）三姊妹站同型（#2632）：第二個例句存檔失敗→恢復→按「再存一次」。
    舊版存成功後 route() 把 screen="lab" 導回首頁、lab=null，只能重開一輪。應該：留在原本那一輪，同一個 runId 做到完。"""
    ctx, pg, errors = open_page(browser, {"viewport": {"width": 390, "height": 844}})
    n = enter_lab_wrong(pg)
    pg.locator("#mNext").click()
    pg.evaluate(BREAK_SET); pg.locator("#mNext").click()
    before = pg.evaluate(LAST_RUN)
    pg.evaluate(FIX_SET); pg.locator("#retrySave").first.click()
    after = pg.evaluate(LAST_RUN)
    still_lab = pg.locator("#labPredict").count() == 1 and pg.locator("#mNext").count() == 1
    check("看例句「再存一次」成功後留在原本那一輪：兩個例句都記到、提示列消失",
          still_lab and after and after["tasksDone"] == [0, 1] and pg.locator("#mSteps li").count() == 2 and pg.locator("#retrySave").count() == 0,
          {"還在學習畫面": still_lab, "畫面例句數": pg.locator("#mSteps li").count(), "run": after, "main": pg.inner_text("#main")[:80]})
    k = 0
    while still_lab and pg.locator("#mNext").is_visible() and k < 20:
        pg.locator("#mNext").click(); k += 1
    end = pg.evaluate(LAST_RUN)
    check("看例句「再存一次」後續接同一輪（同一個 runId、沒有多開一輪）做到完、完成鈕可按",
          bool(still_lab and end and before and end["id"] == before["id"] and end["n"] == before["n"]
               and end["tasksDone"] == list(range(n)) and pg.locator("#labDone").is_enabled()), {"before": before, "end": end})
    check("看例句「再存一次」續接流程沒有 JS 錯誤", not errors, errors)
    ctx.close()


def flow_lab_double_fail_resume(browser):
    """Codex 審國語站 232875bd P2（#2632，本站）：第一個例句存好→寫入壞掉→連按兩次「下一個例句」（兩次都沒存到）→恢復→補存。
    舊版「下一個例句」不論存成功與否都前進：第三個例句已顯示、下一個例句收起，補存只救回第二個例句，第三個例句沒存也沒按鈕能重來，完成鈕永遠停用。
    應該：沒存到的那一個例句不往前顯示；補存後畫面停在存到的地方，接著按「下一個例句」做到完。兩種補存路（再存一次、切回分頁）各跑一次。"""
    for how in ("再存一次", "切回分頁"):
        ctx, pg, errors = open_page(browser, {"viewport": {"width": 390, "height": 844}})
        n = enter_lab_wrong(pg)
        pg.locator("#mNext").click()
        pg.evaluate(BREAK_SET); pg.locator("#mNext").click(); pg.locator("#mNext").click()
        failed = {"畫面例句數": pg.locator("#mSteps li").count(), "下一步": pg.locator("#mNext").is_visible()}
        pg.evaluate(FIX_SET)
        if how == "再存一次":
            pg.locator("#retrySave").first.click()
        else:
            pg.evaluate("() => document.dispatchEvent(new Event('visibilitychange'))")
        mid = pg.evaluate(LAST_RUN)
        shown = pg.locator("#mSteps li").count()
        check(f"看例句連續兩個例句沒存到→恢復→{how}：畫面停在存到的那一個例句（{shown} 句＝存到 {len(mid['tasksDone']) if mid else '?'} 句）、下一個例句還在、提示列消失",
              n >= 3 and failed == {"畫面例句數": 1, "下一步": True} and mid and mid["tasksDone"] == [0, 1] and shown == 2
              and pg.locator("#mNext").is_visible() and pg.locator("#retrySave").count() == 0,
              {"n": n, "失敗時": failed, "run": mid, "畫面例句數": shown, "再存一次": pg.locator("#retrySave").count()})
        k = 0
        while pg.locator("#mNext").count() and pg.locator("#mNext").is_visible() and k < 20:
            pg.locator("#mNext").click(); k += 1
        end = pg.evaluate(LAST_RUN)
        check(f"看例句連續兩個例句沒存到→{how}後接著做到完：每個例句都記到、完成鈕可按、沒有 JS 錯誤",
              end and mid and end["id"] == mid["id"] and end["tasksDone"] == list(range(n)) and pg.locator("#labDone").is_enabled() and not errors,
              {"end": end, "完成鈕": pg.locator("#labDone").count() and pg.locator("#labDone").is_enabled(), "errors": errors})
        ctx.close()


def flow_lab_done_resume(browser):
    """#2632 第 2 輪（Codex 審自然站 aa365726 P2，四站同型）：每一步都看完→寫入壞掉→按完成鈕（沒存到）→恢復→補存。
    第 1 輪 labRefresh 把她留在已完成的頁面、要再按一次完成；更早的版本 route() 甩回首頁。應該：照完成鈕成功時的去向
    （答錯補救進來＝回練習換一題確認；觀念頁進來＝完成畫面）。"""
    def open_menu(pg):
        pg.locator("#concepts .ccard").first.click(); pg.wait_for_selector("#cLab")
        pg.locator("#cLab").click(); pg.wait_for_selector("#labPredict button[data-g]")
        pg.locator("#labPredict button[data-g]").first.click(); pg.wait_for_selector("#mNext")
    phase = """() => { const s = JSON.parse(localStorage.getItem('g5chi.v1') || 'null'); const ids = Object.keys((s && s.labRuns) || {});
      return ids.length ? s.labRuns[ids[ids.length - 1]].phase : null; }"""
    for ctxname, opener, how in (("答錯補救進來", enter_lab_wrong, "再存一次"), ("答錯補救進來", enter_lab_wrong, "切回分頁"), ("觀念頁進來", open_menu, "再存一次")):
        ctx, pg, errors = open_page(browser, {"viewport": {"width": 390, "height": 844}})
        opener(pg)
        k = 0
        while pg.locator("#mNext").is_visible() and k < 20:
            pg.locator("#mNext").click(); k += 1
        pg.evaluate(BREAK_SET); pg.locator("#labDone").click()
        failed = {"還在學習畫面": pg.locator("#labNav").count() == 1, "再存一次": pg.locator("#retrySave").count() >= 1}
        pg.evaluate(FIX_SET)
        if how == "再存一次":
            pg.locator("#retrySave").first.click()
        else:
            pg.evaluate("() => document.dispatchEvent(new Event('visibilitychange'))")
        ph = pg.evaluate(phase)
        if ctxname == "答錯補救進來":
            dest = pg.locator("#main .q").count() == 1
        else:
            dest = pg.locator("#main .done").count() == 1 and "看完了" in pg.inner_text("#main")
        check(f"看例句（{ctxname}）完成鈕那一下沒存到→恢復→{how}：存成完成、離開學習頁到該去的地方、提示列消失、沒有 JS 錯誤",
              failed == {"還在學習畫面": True, "再存一次": True} and ph == "complete" and dest and pg.locator("#labNav").count() == 0
              and pg.locator("#retrySave").count() == 0 and not errors,
              {"失敗時": failed, "phase": ph, "到該去的地方": dest, "main": pg.inner_text("#main")[:80], "errors": errors})
        ctx.close()


def flow_review(browser):
    ctx, pg, errors = open_page(browser)
    check("小考複習按鈕寫「修辭與句型」", "修辭與句型" in pg.locator("#main .review").inner_text(), pg.locator("#main .review").inner_text()[:200])
    pg.locator('button[data-rv="uk2"]').click(); pg.wait_for_selector("#main .q")
    c = current_card(pg)
    check("小考複習：修辭與句型只出 rh1／rh2／sp 的題", c and c["concept"] in ("rh1", "rh2", "sp"), c)
    check("小考複習沒有 JS 錯誤", not errors, errors)
    ctx.close()
    # 2026-10-14：10/15 小考的國練第二課，按「練一段」只出 w2a–w2e 的題，答一題看得到解說
    ctx, pg, errors = open_page(browser)
    check("小考複習按鈕寫「國練第二課」", "國練第二課" in pg.locator("#main .review").inner_text(), pg.locator("#main .review").inner_text()[:200])
    pg.locator('button[data-rv="uk6"]').click(); pg.wait_for_selector("#main .q")
    c = current_card(pg)
    check("小考複習：國練第二課只出 w2a～w2e 的題", c and c["concept"] in ("w2a", "w2b", "w2c", "w2d", "w2e"), c)
    answer(pg, True); pg.wait_for_selector("#main .fb")
    check("國練第二課答完一題：回饋框標出處「國練第二課第 6 頁」", "國練第二課第 6 頁" in pg.locator("#main .fb").first.inner_text(), pg.locator("#main .fb").first.inner_text()[:300])
    check("國練第二課小考複習沒有 JS 錯誤", not errors, errors)
    ctx.close()


# 補題區（交辦 #1618）：家長打開才載入 g5-help/upload.js；本機測試用 g5-help 的原始碼頂替（還沒上線的版本也測得到），GAS 一律攔截不打真後端。
UP_SRC = ROOT.parent / "g5-help" / "src" / "upload.js"
UP_PNG = __import__("base64").b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")


def flow_upload(browser, subject, site, bank_global):
    import json as _j, tempfile as _t
    live = BASE.startswith("https:")
    ctx = browser.new_context()
    ctx.add_init_script("localStorage.setItem('g5sync.code','ABCDEFGHJKMN')")
    sent, mode = [], {"fail_js": True}
    def gas(route):
        req = _j.loads(route.request.post_data or "{}")
        if route.request.method != "POST" or not req:   # GET 等非 JSON POST：從網址參數取 op，並記方法（審 684ecc8：GET 漏算）
            from urllib.parse import urlparse as _u, parse_qsl as _q
            req = dict(_q(_u(route.request.url).query), _method=route.request.method)
        sent.append(req)
        body = {"ok": True, "id": "u1"} if req.get("op") == "upload" else {"ok": True, "items": [], "lastFetch": 0} if req.get("op") == "mine" else {"ok": False, "err": "test"}
        route.fulfill(status=200, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"}, body=_j.dumps(body))
    ctx.route("**/macros/s/**", gas)
    def upjs(route):
        if mode["fail_js"]:
            return route.abort()
        if live:
            return route.continue_()
        route.fulfill(status=200, content_type="application/javascript", body=UP_SRC.read_text(encoding="utf-8"))
    ctx.route("**/g5-help/upload.js", upjs)
    pg = ctx.new_page(); errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(URL); pg.wait_for_selector("#main .btn, #main .done")
    check(f"補題區 首頁沒打開前不載入 upload.js", pg.evaluate("!window.G5Upload && !document.querySelector('script[src*=\"g5-help/upload.js\"]')"))
    pg.locator("#upBox summary").click()
    pg.wait_for_function("document.getElementById('g5upload').textContent.indexOf('載入失敗') >= 0", timeout=10000)
    check(f"補題區 upload.js 載不到：說明可以關掉再打開重試", "關掉再打開" in pg.inner_text("#g5upload"))
    mode["fail_js"] = False
    pg.locator("#upBox summary").click(); pg.locator("#upBox summary").click()
    # 補題區已關功能（g5-help upload.js ENABLED=false，迴圈 L20261013134831-7db82f 會診後第 2 次 FAIL）：只顯示暫停說明、導向難題站、0 請求
    pg.wait_for_function("document.getElementById('g5upload').textContent.indexOf('補題區暫停使用') >= 0", timeout=20000)
    link = pg.locator("#g5upload a[href='https://windsorya.github.io/g5-help/']")
    check(f"補題區 暫停：說明與難題站連結看得見、沒有表單", pg.locator("#g5upload .g5u-msg", has_text="補題區暫停使用").is_visible() and link.count() == 1 and link.is_visible() and pg.locator("#g5upload .g5u-send, #g5upload .g5u-file").count() == 0)   # 審 684ecc8：只比 textContent 會放過 hidden
    # 「補題區 0 請求」屬元件保證，由 g5-help tests/upload_disabled.test.js 鎖（fetch／計時器／監聽＝0，突變會紅）；本站共用同一個 GAS 端點，
    # 從網址分不出同步與補題，判準連三輪被審查打穿（684ecc8／5630afa／1d7a0df），依升級階梯縮範圍：本站只驗看得見的暫停說明與連結。
    check(f"補題區 沒有水平捲動", no_overflow(pg))
    # 做好了的連結 #c/<觀念id> 直接打開那個觀念；不存在的觀念留在首頁
    cid = pg.evaluate(f"Object.keys(window.{bank_global}.CONCEPTS)[0]")
    pg.goto(URL + "#c/" + cid); pg.wait_for_selector("#main .remedy", timeout=10000)
    check(f"補題區 #c/{cid} 直接打開該觀念", pg.locator("#cBack").count() == 1)
    # 審 Codex b44cf85／9404d3a／2904b29：回首頁後同一連結要能再開；改成無效網址要回首頁
    pg.locator("#cBack").click(); pg.wait_for_selector("#main .btn, #main .done")
    check(f"補題區 觀念頁回首頁後網址不再帶 #c/", not pg.evaluate("location.hash").startswith("#c/"), pg.evaluate("location.hash"))
    pg.evaluate(f"location.hash = '#c/{cid}'"); pg.wait_for_timeout(300)
    check(f"補題區 回首頁後再開同一個 #c/{cid}：打開該觀念", pg.locator("#cBack").count() == 1)
    if pg.locator("#cBack").count() == 0:   # 不依賴上一步：不在觀念頁就點一張觀念卡進去（不重新載入，避免中斷在途請求）
        pg.locator("#concepts .ccard").first.click(); pg.wait_for_selector("#cBack", timeout=10000)
    pg.evaluate("location.hash = '#c/no-such-concept'"); pg.wait_for_timeout(300)
    check(f"補題區 觀念頁中網址改成不存在的觀念：回首頁", pg.locator("#cBack").count() == 0 and pg.locator("#concepts .ccard").count() > 0)
    pg2 = ctx.new_page(); pg2.on("pageerror", lambda e: errors.append(str(e)))
    pg2.goto(URL + "#c/no-such-concept"); pg2.wait_for_selector("#main .btn, #main .done")
    check(f"補題區 #c/不存在的觀念：留在首頁", pg2.locator("#main .remedy").count() == 0 and pg2.locator("#concepts .ccard").count() > 0)
    check(f"補題區 沒有 JS 錯誤", not errors, errors)
    ctx.close()


def main():
    with sync_playwright() as p:
        selftest_player()
        cr = p.chromium.launch()
        if BASE.startswith("https:"):
            flow_video_live(cr, "線上Chromium")
        flow_main(cr, "桌機", {"viewport": {"width": 1280, "height": 900}})
        flow_main(cr, "手機390", {"viewport": {"width": 390, "height": 844}, "is_mobile": True, "has_touch": True, "device_scale_factor": 2})
        flow_concepts(cr, "手機390", {"viewport": {"width": 390, "height": 844}, "is_mobile": True, "has_touch": True})
        flow_nav_click(cr, "手機390", {"viewport": {"width": 390, "height": 844}, "is_mobile": True, "has_touch": True})
        flow_review(cr)
        flow_redo_after_external_clear(cr)
        flow_lab_after_external_clear(cr)
        flow_lab_last_resume(cr)
        flow_lab_retry_resume(cr)
        flow_lab_double_fail_resume(cr)
        flow_lab_done_resume(cr)
        flow_upload(cr, "國語", "g5-chinese-review", "G5ChiBank")
        cr.close()
        wk = p.webkit.launch()
        ipad = p.devices["iPad (gen 7)"]
        flow_main(wk, "iPad", ipad)
        flow_concepts(wk, "iPad", ipad)
        flow_upload(wk, "國語", "g5-chinese-review", "G5ChiBank")
        flow_nav_click(wk, "iPad", ipad)
        wk.close()
    bad = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS) - len(bad)}/{len(RESULTS)} PASS")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
