#!/usr/bin/env python3
"""（2026-10-13 由數學站 g5-math-review fd585e3 的 build.py 複製；只改主畫面標題。）
把 src/app.html（Artifact 格式：沒有 doctype/head）包成可直接開啟的 index.html。

為什麼分兩份：同一份內容可以發成 claude.ai Artifact，也可以放 GitHub Pages
讓孩子的 iPad 不登入就能開；Pages 需要自己帶 viewport 與 noindex。
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HEAD = ('<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<meta name="robots" content="noindex,nofollow">'
        '<link rel="icon" type="image/svg+xml" href="favicon.svg">'
        '<link rel="apple-touch-icon" href="apple-touch-icon.png">'
        '<meta name="theme-color" content="#1f5f8b">'
        '<meta name="apple-mobile-web-app-capable" content="yes">'
        '<meta name="apple-mobile-web-app-title" content="國語複習">'
        '</head><body>')


INLINE = re.compile(r"<!--@INLINE (src/[A-Za-z0-9_.-]+\.js)-->")


def inline(body: str) -> str:
    """把 <!--@INLINE src/x.js--> 換成 <script> 內容；核心邏輯（src/core.js）與 node 測試共用同一份檔。"""
    def sub(m: re.Match) -> str:
        js = (ROOT / m.group(1)).read_text(encoding="utf-8")
        if "</script" in js.lower():
            raise SystemExit(f"{m.group(1)} 含 </script，不能內嵌")
        return "<script>\n" + js + "\n</script>"
    out = INLINE.sub(sub, body)
    if "<!--@INLINE" in out:
        raise SystemExit("還有沒換掉的 @INLINE 標記")
    return out


def build() -> str:
    app_src = (ROOT / "src" / "app.html").read_text(encoding="utf-8")
    return HEAD + inline(app_src) + "</body></html>"


def main() -> None:
    out = build()
    # --check：只在記憶體重建、和現有 index.html 逐「位元組」比，不寫檔（tests/chibank.test.js ㉖-b 用；Codex 審 83067be：只比內嵌 js 會漏掉 app.html 本身）。
    # Codex 審 2fe4bbb：read_text 會把 CRLF 正規化成 LF ⇒ 讀 bytes、預期值 encode 成 UTF-8 bytes 再比（CRLF、BOM 都算不同）
    if "--check" in sys.argv:
        try:
            cur = (ROOT / "index.html").read_bytes()
        except OSError as e:
            print("讀不到 index.html：" + str(e))
            sys.exit(1)
        if cur != out.encode("utf-8"):
            print("index.html 和 src 重建結果不同：請執行 python3 build.py")
            sys.exit(1)
        print("index.html 和 src 一致")
        return
    (ROOT / "index.html").write_text(out, encoding="utf-8")
    print(f"built index.html ({len(out) - len(HEAD) - len('</body></html>')} chars)")


if __name__ == "__main__":
    main()
