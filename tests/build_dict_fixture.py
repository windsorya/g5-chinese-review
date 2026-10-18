#!/usr/bin/env python3
"""字形／字音題（src/chibank.js 的 zx*、dy*、w2*）用到的每個詞和字，到教育部兩本辭典查「有沒有、怎麼讀」，
存成 tests/fixtures/dict_l1.json，給 tests/chibank.test.js ㉒ 離線核對（2026-10-14）。

為什麼兩本：
- 《國語辭典簡編本》（concised）：每個詞只列學校用的那一個讀音，國練第二課 38 個字的注音和它逐字一致 ⇒ 讀音以它為準。
- 《重編國語辭典修訂本》（revised）：收詞最多，但另列語音／讀音／又音（例如熟另有讀音ㄕㄨˊ、供應有兩讀）
  ⇒ 只拿來判斷「錯字組成的詞是不是其實存在」（兩本都查無才算不是詞）。

用法：python3 tests/build_dict_fixture.py [快取資料夾]
- 詞的清單由 node 讀 src/chibank.js 取得（題目改了，重跑這支就會跟著查新詞）。
- 只有一筆時站方 302 轉到詞條頁，詞條頁要帶查詢時發的 JSESSIONID，否則回空白 ⇒ 每本辭典各用一個 cookie jar。
- 回空白就等一下再試，試 5 次還是空白就整支失敗（不寫半套結果）。
- 只收「詞條名稱和查的詞完全一樣」的結果；查無＝空陣列。讀音去掉「(又音)」這類標記、空白統一成一格。
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
OUT = ROOT / "tests" / "fixtures" / "dict_l1.json"
DICTS = {
    "revised": "https://dict.revised.moe.edu.tw/search.jsp?md=1&word=",
    "concised": "https://dict.concised.moe.edu.tw/search.jsp?md=1&word=",
}

WORDS_JS = r"""
const B = require(process.argv[1]);
const w = new Set();
B.ALL_CARDS.forEach((c) => {
  if (c.zx) [c.zx.word, c.zx.good, c.zx.bad].concat(c.zx.wrong || [], c.zx.ok || []).filter(Boolean).forEach((x) => w.add(x));
  if (c.dy) c.dy.words.forEach((x) => w.add(x));
  if (c.yin) { w.add(c.yin.ch); if (c.yin.word) w.add(c.yin.word); }
  if (c.yinPick) [c.yinPick.ch].concat(c.yinPick.others).forEach((x) => w.add(x));
  if (c.bs) c.bs.chars.forEach((x) => w.add(x));
});
(B.P6 || []).forEach((g) => g.forEach((e) => { w.add(e[0]); e[2].forEach((x) => w.add(x)); }));
console.log(JSON.stringify([...w]));
"""


def words() -> list:
    out = subprocess.run(["node", "-e", WORDS_JS, str(ROOT / "src" / "chibank.js")], capture_output=True, text=True, check=True).stdout
    return sorted(json.loads(out))


def fetch(kind: str, word: str, cache: Path) -> str:
    fn = cache / (("rev_" if kind == "revised" else "con_") + urllib.parse.quote(word, safe="") + ".html")
    if fn.exists() and fn.stat().st_size > 500:
        return fn.read_text(encoding="utf-8")
    t, jar = "", str(cache / ("cookies_" + kind + ".txt"))
    for k in range(5):
        t = subprocess.run(["curl", "-sL", "-m", "30", "-c", jar, "-b", jar, DICTS[kind] + urllib.parse.quote(word)],
                           capture_output=True).stdout.decode("utf-8", "ignore")
        if len(t) > 500:
            break
        time.sleep(5 + k * 10)
    if len(t) <= 500:
        raise SystemExit("辭典查不到回應：" + kind + " " + word)
    fn.write_text(t, encoding="utf-8")
    time.sleep(0.3)
    return t


def norm(r: str) -> str:
    r = re.sub(r"\([^)]*\)|（[^）]*）", "", html.unescape(r))
    return re.sub(r"\s+", " ", r.replace("　", " ")).strip()


def readings(word: str, t: str) -> list:
    out = []
    for m in re.finditer(r"<tr data-link[^>]*>(.*?)</tr>", t, flags=re.S):
        tds = [html.unescape(re.sub(r"<[^>]+>", "", x)).strip() for x in re.findall(r"<td[^>]*>(.*?)</td>", m.group(1), flags=re.S)]
        if len(tds) > 2 and tds[1] == word:
            out.append(norm(tds[2]))
    if not out:   # 只有一筆時直接跳到詞條頁：重編本看 <title>、簡編本看 Description
        d = re.search(r"<title>&lt; (.*?) :\s*(.*?) &gt;", t)
        if d and html.unescape(d.group(1)).strip() == word:
            out.append(norm(d.group(2)))
        d = re.search(r'<meta name="Description" content="字詞:([^,]*),注音:([^,]*),', t)
        if d and html.unescape(d.group(1)).strip() == word:
            out.append(norm(d.group(2)))
    return list(dict.fromkeys(r for r in out if r))   # 去重：重編本單筆頁的 title 與 Description 會各抓到一次


RADICAL_JS = r"""
const B = require(process.argv[1]);
const w = new Set();
B.ALL_CARDS.forEach((c) => { if (c.bs) c.bs.chars.forEach((x) => w.add(x)); if (c.zx && c.zx.rad) w.add(c.zx.ch); });
console.log(JSON.stringify([...w]));
"""


def radical(ch: str, t: str, cache: Path) -> str:
    """部首題（c.bs）與字形題寫了部首（c.zx.rad）的字用：簡編本單字詞條頁 Description 的「X部+N畫」，取 X。列表頁先找名稱就是這個字的那一列。"""
    m = None
    for r in re.finditer(r"<tr data-link='(dictView\.jsp\?ID=\d+)[^']*'[^>]*>(.*?)</tr>", t, flags=re.S):
        tds = [html.unescape(re.sub(r"<[^>]+>", "", x)).strip() for x in re.findall(r"<td[^>]*>(.*?)</td>", r.group(2), flags=re.S)]
        if len(tds) > 1 and tds[1] == ch:
            m = r.group(1)
            break
    if m:
        fn = cache / ("conv_" + urllib.parse.quote(ch, safe="") + ".html")
        if not (fn.exists() and fn.stat().st_size > 500):
            jar = str(cache / "cookies_concised.txt")
            v = subprocess.run(["curl", "-sL", "-m", "30", "-c", jar, "-b", jar, "https://dict.concised.moe.edu.tw/" + m], capture_output=True).stdout.decode("utf-8", "ignore")
            if len(v) <= 500:
                raise SystemExit("辭典查不到回應：部首 " + ch)
            fn.write_text(v, encoding="utf-8")
        t = fn.read_text(encoding="utf-8")
    d = re.search(r'<meta name="Description" content="字詞:([^,]*),注音:[^,]*,([^部,]+)部\+', t)
    if not d or html.unescape(d.group(1)).strip() != ch:
        raise SystemExit("簡編本找不到部首：" + ch)
    return d.group(2).strip()


def main() -> None:
    cache = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/tmp/dict_l1_cache")
    cache.mkdir(parents=True, exist_ok=True)
    res = {}
    for w in words():
        res[w] = {k: readings(w, fetch(k, w, cache)) for k in DICTS}
    rad = json.loads(subprocess.run(["node", "-e", RADICAL_JS, str(ROOT / "src" / "chibank.js")], capture_output=True, text=True, check=True).stdout)
    for ch in rad:
        if ch not in res:
            res[ch] = {k: readings(ch, fetch(k, ch, cache)) for k in DICTS}
        res[ch]["concised_radical"] = radical(ch, fetch("concised", ch, cache), cache)
    OUT.write_text(json.dumps({"checked": time.strftime("%Y-%m-%d"),
                               "source": {k: v for k, v in DICTS.items()},
                               "note": "讀音以 concised（簡編本，和現行課本一致）為準；錯字詞要 revised、concised 都查無",
                               "words": res}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {OUT} ({len(res)} words)")


if __name__ == "__main__":
    main()
