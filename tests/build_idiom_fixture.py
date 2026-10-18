#!/usr/bin/env python3
"""成語題（src/chibank.js 的 cy*）用到的每個成語，到教育部《成語典》查「有沒有收、怎麼讀、釋義」，
存成 tests/fixtures/idioms.json，給 tests/chibank.test.js ㉔ 離線核對（2026-10-18）。

為什麼查《成語典》：交辦 #2703 規定成語釋義以教育部《成語典》為準並附出處；
題目的正解（意思）要能在成語典的「釋義」或「語義說明」裡找到依據，題目的 src 是那一條的網址。

為什麼逐條查網頁、不用官方資料檔（2026-10-18 盤查）：教育部國語辭典公眾授權網有《成語典》文字資料庫
（dict_idioms_2020_20260929.xlsx，CC 姓名標示-禁止改作），但只收正文（主條／非主條）成語，不含辭典附錄
（例如「胼手胝足」只在附錄，ID 8009）；網頁查詢正文與附錄都查得到，而且只查題目用到的十幾條。
建好後另用官方 xlsx 交叉核對正文成語的釋義一致（見 commit 訊息）。本機 tool_index 查無同類工具。

用法：python3 tests/build_idiom_fixture.py [快取資料夾]
- 成語清單由 node 讀 src/chibank.js 取得（每張卡 cy.idiom 與 cy.others）。
- 先查 idiomList.jsp?idiom=成語，取「名稱完全一樣」那一列的 idiomView.jsp?ID=；
  正文（main）與附錄都收：附錄條目只有釋義，沒有語義說明。
- 成語典沒收的（例如課本語詞「寓教於樂」）改查《重編國語辭典修訂本》，取詞條頁 Description 的注音與釋義，標 dict="revised"。
- 回應太短就等一下再試，5 次還是太短就整支失敗（不寫半套結果）；查無＝null。
"""
import html
import json
import re
import subprocess
import sys
import time
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "tests" / "fixtures" / "idioms.json"
BASE = "https://dict.idioms.moe.edu.tw/"

WORDS_JS = r"""
const B = require(process.argv[1]);
const w = new Set();
B.ALL_CARDS.forEach((c) => { if (c.cy) [c.cy.idiom].concat(c.cy.others || []).forEach((x) => w.add(x)); });
console.log(JSON.stringify([...w]));
"""


def words() -> list:
    out = subprocess.run(["node", "-e", WORDS_JS, str(ROOT / "src" / "chibank.js")], capture_output=True, text=True, check=True).stdout
    return sorted(json.loads(out))


def get(url: str, fn: Path, jar: str) -> str:
    if fn.exists() and fn.stat().st_size > 2000:
        return fn.read_text(encoding="utf-8")
    t = ""
    for k in range(5):
        t = subprocess.run(["curl", "-sL", "-m", "30", "-c", jar, "-b", jar, url], capture_output=True).stdout.decode("utf-8", "ignore")
        if len(t) > 2000:
            break
        time.sleep(5 + k * 10)
    if len(t) <= 2000:
        raise SystemExit("成語典沒有回應：" + url)
    fn.write_text(t, encoding="utf-8")
    time.sleep(0.3)
    return t


def text_lines(s: str) -> list:
    s = re.sub(r"<script.*?</script>|<style.*?</style>", "", s, flags=re.S)
    s = re.sub(r"<sup>(.*?)</sup>", r"\1", s)
    t = html.unescape(re.sub(r"<[^>]+>", "\n", s))
    return [x.strip() for x in t.split("\n") if x.strip()]


def field(lines: list, name: str, stops: tuple) -> str:
    try:
        i = lines.index(name)
    except ValueError:
        return ""
    out = []
    for x in lines[i + 1:]:
        if x in stops:
            break
        out.append(x)
    return "".join(out)


STOPS = ("△", "典故說明", "用法說明", "書證", "辨　　識", "使用類別", "例句", "近義成語", "反義成語", "附　　錄", "參考語料")


def lookup(idiom: str, cache: Path, jar: str):
    q = urllib.parse.quote(idiom)
    lst = get(BASE + "idiomList.jsp?idiom=" + q, cache / ("list_" + q + ".html"), jar)
    m = None
    for a in re.finditer(r"href='(idiomView\.jsp\?ID=(\d+)[^']*)'>(.*?)</a>", lst):
        if re.sub(r"<[^>]+>", "", a.group(3)) == idiom:
            m = a
            break
    if not m:
        return revised(idiom, cache)
    vid = m.group(2)
    view = get(BASE + "idiomView.jsp?ID=" + vid, cache / ("view_" + vid + ".html"), jar)
    L = text_lines(view)
    zh = field(L, "注　　音", ("漢語拼音",)).replace("ˊ", "ˊ")
    return {
        "dict": "idioms",
        "id": int(vid),
        "url": BASE + "idiomView.jsp?ID=" + vid,
        "zhuyin": zh,
        "meaning": field(L, "釋　　義", STOPS),
        "semantic": field(L, "語義說明", STOPS),
    }


REV = "https://dict.revised.moe.edu.tw/"


def revised(idiom: str, cache: Path):
    q = urllib.parse.quote(idiom)
    jar = str(cache / "cookies_rev.txt")
    t = get(REV + "search.jsp?md=1&word=" + q, cache / ("rev_" + q + ".html"), jar)
    d = re.search(r'<meta name="Description" content="字詞:([^,]*),注音:([^,]*),釋義:([^"]*)"', t)
    i = re.search(r"dictView\.jsp\?ID=(\d+)", t)
    if not (d and i and html.unescape(d.group(1)).strip() == idiom):
        return None
    return {"dict": "revised", "id": int(i.group(1)), "url": REV + "dictView.jsp?ID=" + i.group(1),
            "zhuyin": re.sub(r"\s+", "", html.unescape(d.group(2))), "meaning": html.unescape(d.group(3)).strip(), "semantic": ""}


def main() -> None:
    cache = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/tmp/idiom_cache")
    cache.mkdir(parents=True, exist_ok=True)
    jar = str(cache / "cookies.txt")
    res = {w: lookup(w, cache, jar) for w in words()}
    OUT.write_text(json.dumps({"checked": time.strftime("%Y-%m-%d"), "source": BASE,
                               "note": "釋義與語義說明照抄教育部《成語典》；查無＝null",
                               "idioms": res}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {OUT} ({len(res)} idioms, {sum(1 for v in res.values() if v)} found)")


if __name__ == "__main__":
    main()
