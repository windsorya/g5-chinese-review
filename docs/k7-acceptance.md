# 第三～六課（單元 k7）驗收契約

迴圈 L20261018080918-e4f31c；設計報告 `state/design_reports/L20261018080918-e4f31c__task-mvdkjzb0-u0nw05.md`；
4agent 4B-20261018-chi-k7（報告 `docs/design/4agent-chi-k7-synthesis.md`（工具裁決 `docs/design/4agent-chi-k7-probe.md`），四腦帳本 PASS）。

## 範圍

- 43 張卡（zxc 8、zxd 9、yb 10（yb3 併入 yb1）、cy 8、bd 8）；審定快照 `tests/k7_approved_snapshot.json`，
  審定雜湊 `4455a63c34c2a84efa29749dd3cd1a4df401814810a9a4e454a5ff22b5f70f03`（釘在 `tests/chibank.test.js` 的 `K7_APPROVED_SHA256`）。
- 快照內容＝Codex 逐題審過的版本（c8f6d18 起，1e41707、44a8dd4、b1ae58f 各輪修正；83067be、2fe4bbb 起只改檢查方式、不改孩子看得到的字）。

## 本閘門保證

1. **成品逐位元組一致**：`python3 build.py --check` 在記憶體重建，與 `index.html` 的 UTF-8 位元組完全相同（CRLF、BOM、任何字元差異都攔；不寫檔）。由 tests ㉖-b 呼叫、㉖-c 自檢。
2. **內容逐字等於審定版**：k7 每張卡每個欄位、解說每種說法（含圖）、先猜題、觀念與出口題、影片說明，等於審定快照；物件鍵順序不影響；
   快照本身必須是釘住的審定版（改內容＝重產快照＋改 `K7_APPROVED_SHA256`，兩處都在 diff 裡）。tests ㉖。
3. **結構欄位對辭典**：字形題 `zx.rad` 等於《國語辭典簡編本》部首、`zx.radPos` 是合法值；錯字組成的詞兩本辭典都查無；部首題解說與錯法說明由 `bs.rad` 模板產生並用辭典部首重產逐字比對；
   成語白話說法釘審定表、關鍵字在《成語典》釋義裡。tests ㉒㉓㉔㉕。
4. **畫面文字等於審定快照**：每個 k7 觀念從觀念頁實際作答，題目、選項、提示、答對解說、答錯回饋＝快照欄位（Chromium 桌機＋WebKit iPad）。`tests/e2e_k7_text.py`。

## 本閘門不保證

- 自由文字的語意正確（例如解說裡的部件說明）：由審定紀錄（Codex 逐題審查報告）承擔；快照只保證「沒被改」。
- 正式網址部署一致性與 YouTube 影片當下能播：另由 `tests/e2e.py --base <正式網址>` 檢查，不在本契約內。

## 改第三～六課內容的流程

改 src → `node tests/k7_snapshot.js` 看差異 → 送審 → PASS 後人工 `node tests/k7_snapshot.js --write`、改 `K7_APPROVED_SHA256` → 內容、快照、常數同一個 commit。
