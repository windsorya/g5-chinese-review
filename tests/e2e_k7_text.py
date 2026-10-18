#!/usr/bin/env python3
"""第三～六課（k7）畫面文字＝審定快照（2026-10-18，4agent 4B-20261018-chi-k7 最終方案第 3 點；設計報告矩陣 T29 精簡版）。

為什麼：㉖ 鎖的是資料（題庫產出的每個欄位），不保證瀏覽器畫出來的字就是那些欄位（模板綁錯欄位、跳脫、只載入部分題庫都不改資料）。
做法：每個 k7 觀念從觀念頁按「練這個觀念的全部 N 題」，逐題實際作答；預期值一律讀 tests/k7_approved_snapshot.json（不是讀頁面上的題庫），
  ① 題目、選項＝快照；② 按提示＝「提示：」＋快照 hint；③ 單數題答對：回饋含快照 why；④ 雙數題答錯：回饋含「正確答案是「…」」
  與「你選的「X」錯在：快照 wrongWhy」與 why；⑤ 這個觀念出到的題＝快照裡這個觀念、沒被合併的每一題；⑥ 沒有 JS 錯誤。
Chromium 桌機＋WebKit iPad。執行：python3.12 tests/e2e_k7_text.py
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
URL = (ROOT / "index.html").as_uri()
SNAP = json.loads((ROOT / "tests" / "k7_approved_snapshot.json").read_text(encoding="utf-8"))["content"]
RESULTS = []


def check(name, ok, info=""):
    RESULTS.append(bool(ok))
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else "  ← " + str(info)[:400]))


def run(browser, label, device):
    ctx = browser.new_context(**device)
    pg = ctx.new_page()
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    by_q = {c["q"]: c for c in SNAP["cards"].values()}
    for cid in sorted(SNAP["concepts"]):
        want_ids = sorted(i for i, c in SNAP["cards"].items() if c["concept"] == cid and i not in SNAP["merged"])
        pg.goto(URL + "#c/" + cid)
        pg.wait_for_selector("#cAll")
        pg.locator("#cAll").click()
        seen, bad, n = [], [], 0
        while pg.locator("#main .q").count() and n < 60:
            n += 1
            q = pg.locator("#main .q").inner_text().strip()
            c = by_q.get(q)
            if not c:
                bad.append("題目不在快照：" + q)
                break
            seen.append(c["id"])
            opts = [x.strip() for x in pg.locator("#main .opt").all_inner_texts()]
            if opts != c["opts"]:
                bad.append(c["id"] + " 選項 " + json.dumps(opts, ensure_ascii=False))
            pg.locator("#hintBtn").click()
            hint = pg.locator("#hintBox").inner_text().strip()
            if hint != "提示：" + c["hint"]:
                bad.append(c["id"] + " 提示：" + hint)
            right = len(seen) % 2 == 1
            i = c["a"] if right else (c["a"] + 1) % len(c["opts"])
            pg.locator(f'#main .opt[data-i="{i}"]').click()
            pg.wait_for_selector("#ansBox .fb")
            box = pg.locator("#ansBox").inner_text()
            need = [c["why"]] if right else ["正確答案是「" + c["opts"][c["a"]] + "」", "你選的「" + c["opts"][i] + "」錯在：" + c["wrongWhy"][i], c["why"]]
            miss = [t for t in need if t not in box]
            if miss:
                bad.append(c["id"] + (" 答對" if right else " 答錯") + " 回饋缺：" + " / ".join(miss))
            if not right:
                pg.locator('#errq button[data-k=""]').click()
            pg.locator("#next").click()
            pg.wait_for_timeout(120)
        check(f"{label} {cid}：畫面的題目、選項、提示、答對解說、答錯回饋＝審定快照", not bad, bad)
        check(f"{label} {cid}：出到的題＝快照裡這個觀念沒被合併的每一題（{len(want_ids)} 題）", sorted(set(seen)) == want_ids, sorted(set(seen)))
    check(f"{label} 沒有 JS 錯誤", not errors, errors)
    ctx.close()


def main():
    with sync_playwright() as p:
        b = p.chromium.launch()
        run(b, "桌機", {"viewport": {"width": 1280, "height": 900}})
        b.close()
        w = p.webkit.launch()
        run(w, "iPad", dict(p.devices["iPad (gen 7)"]))
        w.close()
    bad = RESULTS.count(False)
    print(f"{len(RESULTS) - bad}/{len(RESULTS)} PASS" if not bad else f"{bad} FAIL")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
