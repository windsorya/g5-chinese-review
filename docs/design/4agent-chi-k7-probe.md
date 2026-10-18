# Phase 3 工具裁決 probe（四欄契約：斷言｜查法｜原始輸出｜判定）

## 1
- 斷言：Grok：「把一張卡的正確選項改錯，重跑快照產生器，題庫、快照、建置產物一起交。--check、突變、題庫測試全綠。」
- 查法：暫存複本 git archive HEAD → 改 zx3a why 為「璧是土做的寶物，所以下面是「土」。」→ node tests/k7_snapshot.js --write → python3 build.py → node --test tests/chibank.test.js
- 原始輸出：ℹ pass 71 / ℹ fail 0
- 判定：證實

## 2
- 斷言：Grok：「位元組一致只證明 build 產出＝倉庫裡的檔，不證明瀏覽器畫出的字＝43 張卡……B 在註解寫不保證 E2E，等於把洞寫進契約。」
- 查法：grep -nE 'hintBox|\.hint|wrongWhy|c\.why' tests/e2e.py
- 原始輸出：49: …wrongWhy:c.wrongWhy… / 88: want = f"你選的「{c2['opts'][picked]}」錯在：{c2['wrongWhy'][picked]}"
- 判定：部分推翻（e2e 已斷言錯項回饋畫面文字＝wrongWhy；但未涵蓋 k7 卡與提示、答對解說＝缺口成立）

## 3
- 斷言：Grok：「宣稱強制 LF、無 BOM，但兩邊 read_bytes 相等時，兩邊都是 CRLF 仍綠」
- 查法：暫存複本把 src/app.html 全改 CRLF，載入 build.py 呼叫 build()，檢查輸出是否含 \r
- 原始輸出：src 全 CRLF 時 build() 輸出含 \r： False
- 判定：推翻（預期值恆由 build() 產生且為 LF，bytes 比對下 CRLF 產物一定不等）

## 4
- 斷言：Gemini：「C（補 T29 e2e）……引入高脆性測試，自掘墳墓」「災難解」
- 查法：tail -1 ~/.cc-scratch-845e6161/e2e.log；本 session e2e.py 實跑紀錄
- 原始輸出：95/95 PASS（本 session 15:5x 起實跑 ≥10 次皆 95/95；正式網址 96/96）
- 判定：推翻

## 5
- 斷言：GPT：「『攔截所有字元差異』與『不檢驗等價格式差異』互相矛盾，後者應刪除」
- 查法：grep -n '不保證不損害 DOM' 4B-20261018-chi-k7_gemini.txt
- 原始輸出：42: *   **不保證不損害 DOM 視覺呈現的格式差異**：不保證且不檢驗任何瀏覽器解譯後等價……
- 判定：證實

## 原始指令輸出全文（p3_raw.txt）
```
# Phase 3 工具裁決（2026-10-18 17:13:03）

## P1 Grok 破綻1『快照可跟著錯題一起換掉，測試全綠』
查法：暫存複本改 zx3a 正解文字＋重跑 --write＋node --test chibank
ℹ pass 71
ℹ fail 0
（若 fail>0，看是哪條）

## P2 Grok 破綻2『渲染錯誤不在閘門內』：e2e.py 有沒有斷言畫面提示／解說文字＝題庫欄位
查法：grep -n hint\|wrongWhy\|why tests/e2e.py
49:    return page.evaluate("(q)=>{var c=G5ChiBank.CARDS.find(function(x){return x.q===q;});return c?{id:c.id,a:c.a,opts:c.opts,concept:c.concept,wrongWhy:c.wrongWhy}:null;}", q)
88:    want = f"你選的「{c2['opts'][picked]}」錯在：{c2['wrongWhy'][picked]}"

## P3 Grok 破綻3『改成 read_bytes 後兩邊都是 CRLF 仍綠』
查法：預期值由 build() 產生；src/app.html 改成 CRLF 時 build() 輸出是否仍為 LF
src 全 CRLF 時 build() 輸出含 \r： False

## P4 Gemini『C（補 T29 e2e）＝災難解：高脆性 flaky』
查法：本 session 今天 e2e.py 實跑紀錄（scratchpad e2e.log 最後一行）與次數
95/95 PASS
97
（本 session 自 15:5x 起 e2e.py 已在本機實跑 ≥10 次，每次 95/95；正式網址 96/96）

## P5 GPT『Gemini 寫「不檢驗等價格式差異」與「攔截所有位元組差異」互相矛盾』
查法：讀 Gemini 原文 ④-2 第二點
42:*   **不保證不損害 DOM 視覺呈現的格式差異**：不保證且不檢驗任何瀏覽器解譯後等價、不影響學生閱讀作答的微觀字元差異。

```