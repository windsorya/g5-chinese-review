// 國語各觀念的教學影片（答錯補救與觀念頁「看影片，聽老師講一次」）。格式比照數學站 src/mathvideos.js，另加 verify 欄記查證方式。
// 2026-10-13 子代理逐支驗證：yt-dlp metadata（public、playable_in_embed）；18 支 YouTube 都沒有字幕，改用 whisper-cli 整片轉錄全文讀過、
// 對照畫面字卡修正同音錯字（協調者同日核可這個查證方式）；選用段落抽 4–6 格逐張看過；史實片對照維基文庫《史記》卷八十一。
// 被刷掉的 16 支與理由、轉錄稿、抽格在 session 暫存（不進 repo）。NO_VIDEO：沒放影片要律師核可 {reason, ownerApproved}（tests 標準①）。fitNote：年級或對象和五上不同時的備註（畫面顯示；tests 標準①-c）。
// 2026-10-14 補第一課字形／多音字與國練第二課五個觀念的影片（翰林 L1／L2 備課、臺北酷課雲 部件／多義詞／一字多音；讀音段落對照簡編本）。
(function (root) {
  "use strict";
  var DATA = {
    "V": {
      "ga": [
        {
          "id": "x44P7c2s7l4",
          "title": "國小國語3上統整3認識說明文翰林出版",
          "channel": "翰林教學小幫手",
          "start": 0,
          "end": 235,
          "note": "同樣寫新竹的風，一篇是說明文，一篇是記敘文。看看老師怎麼分辨兩種文體！",
          "verify": "yt-dlp 確認公開且可嵌入；YouTube 無字幕，whisper-cli（ggml-small）整片轉錄全文讀過，同音錯字對照畫面字卡修正；選用段落抽 4–6 格逐張看過，2026-10-13",
          "fitNote": "三年級的影片：觀念和五上相同，用來把基礎講清楚。"
        },
        {
          "id": "pRaR3pM4ca0",
          "title": "小六國語｜文本｜詩歌概說3：詩的表述特性",
          "channel": "臺北酷課雲",
          "start": 12,
          "end": 104,
          "note": "詩歌和一般文章哪裡不一樣？詩的語言很精簡，還會一句一行分行寫。",
          "verify": "yt-dlp 確認公開且可嵌入；YouTube 無字幕，whisper-cli（ggml-small）整片轉錄全文讀過，同音錯字對照畫面字卡修正；選用段落抽 4–6 格逐張看過，2026-10-13",
          "fitNote": "六年級的影片：觀念和五上相同，用來把基礎講清楚。"
        }
      ],
      "nb": [
        {
          "id": "Ie7hixmNQiU",
          "title": "國小國語3上統整3認識記敘文翰林出版",
          "channel": "翰林教學小幫手",
          "start": 0,
          "end": 92,
          "note": "記敘文寫人、事、景、物，內容包含人、事、時、地、物。用〈月世界〉看開頭、經過、結尾。",
          "verify": "yt-dlp 確認公開且可嵌入；YouTube 無字幕，whisper-cli（ggml-small）整片轉錄全文讀過，同音錯字對照畫面字卡修正；選用段落抽 4–6 格逐張看過，2026-10-13",
          "fitNote": "三年級的影片：觀念和五上相同，用來把基礎講清楚。"
        },
        {
          "id": "i2F2Iae16Yg",
          "title": "小三國語｜文本｜記敘文概說",
          "channel": "臺北酷課雲",
          "start": 519,
          "end": 607,
          "note": "寫事的記敘文要交代起因、經過、結果。跟著〈曬棉被〉一起拆解看看！",
          "verify": "yt-dlp 確認公開且可嵌入；YouTube 無字幕，whisper-cli（ggml-small）整片轉錄全文讀過，同音錯字對照畫面字卡修正；選用段落抽 4–6 格逐張看過，2026-10-13",
          "fitNote": "三年級的影片：觀念和五上相同，用來把基礎講清楚。"
        }
      ],
      "ex": [
        {
          "id": "8BvCXbl-eyM",
          "title": "小三國語｜文本｜說明文：從標題、圖表讀懂說明文",
          "channel": "臺北酷課雲",
          "start": 86,
          "end": 230,
          "note": "說明文的總標題和小標題是文章的眼睛。先看小標題，就能抓到每段重點。",
          "verify": "yt-dlp 確認公開且可嵌入；YouTube 無字幕，whisper-cli（ggml-small）整片轉錄全文讀過，同音錯字對照畫面字卡修正；選用段落抽 4–6 格逐張看過，2026-10-13",
          "fitNote": "三年級的影片：觀念和五上相同，用來把基礎講清楚。"
        },
        {
          "id": "fqmr3-356rg",
          "title": "小四國語｜文本｜說明文：說明的方法-3",
          "channel": "臺北酷課雲",
          "start": 42,
          "end": 236,
          "note": "說明文常用舉例說明。看到「舉例來說」「比如」「像是」，後面就是例子。",
          "verify": "yt-dlp 確認公開且可嵌入；YouTube 無字幕，whisper-cli（ggml-small）整片轉錄全文讀過，同音錯字對照畫面字卡修正；選用段落抽 4–6 格逐張看過，2026-10-13",
          "fitNote": "四年級的影片：觀念和五上相同，用來把基礎講清楚。"
        }
      ],
      "rh1": [
        {
          "id": "5ZzDzkdEUrc",
          "title": "國小國語5上統整1認識修辭 擬人翰林出版",
          "channel": "翰林教學小幫手",
          "start": 0,
          "end": 235,
          "note": "擬人法是把東西當成人來寫，讓它會想、會說、會動。最後有小挑戰喔！",
          "verify": "yt-dlp 確認公開且可嵌入；YouTube 無字幕，whisper-cli（ggml-small）整片轉錄全文讀過，同音錯字對照畫面字卡修正；選用段落抽 4–6 格逐張看過，2026-10-13"
        },
        {
          "id": "asXCVmIHIZY",
          "title": "國小國語5上統整3認識修辭 類疊翰林出版",
          "channel": "翰林教學小幫手",
          "start": 0,
          "end": 247,
          "note": "類疊分成疊字、類字、疊句、類句四種。聽完試著分辨看看！",
          "verify": "yt-dlp 確認公開且可嵌入；YouTube 無字幕，whisper-cli（ggml-small）整片轉錄全文讀過，同音錯字對照畫面字卡修正；選用段落抽 4–6 格逐張看過，2026-10-13"
        }
      ],
      "rh2": [
        {
          "id": "qq-MGwXssGY",
          "title": "國小國語5上統整2認識修辭 設問翰林出版",
          "channel": "翰林教學小幫手",
          "start": 0,
          "end": 237,
          "note": "設問是故意用問句引起注意。分成疑問、提問、激問三種，記得分清楚！",
          "verify": "yt-dlp 確認公開且可嵌入；YouTube 無字幕，whisper-cli（ggml-small）整片轉錄全文讀過，同音錯字對照畫面字卡修正；選用段落抽 4–6 格逐張看過，2026-10-13"
        },
        {
          "id": "zWXR8MIsiuI",
          "title": "國小國語5上統整4認識修辭 引用翰林出版",
          "channel": "翰林教學小幫手",
          "start": 0,
          "end": 213,
          "note": "引用別人的話、俗語或典故，要加上引號。能說出處就寫清楚是誰說的。",
          "verify": "yt-dlp 確認公開且可嵌入；YouTube 無字幕，whisper-cli（ggml-small）整片轉錄全文讀過，同音錯字對照畫面字卡修正；選用段落抽 4–6 格逐張看過，2026-10-13"
        }
      ],
      "sp": [
        {
          "id": "hgNe-Lxjg2s",
          "title": "國小國語4上統整1認識句子 表達進一步關係的句子翰林出版",
          "channel": "翰林教學小幫手",
          "start": 0,
          "end": 209,
          "note": "「不但……而且……」「不僅……還……」表示更進一步。重點在後面那一句！",
          "verify": "yt-dlp 確認公開且可嵌入；YouTube 無字幕，whisper-cli（ggml-small）整片轉錄全文讀過，同音錯字對照畫面字卡修正；選用段落抽 4–6 格逐張看過，2026-10-13",
          "fitNote": "四年級的影片：觀念和五上相同，用來把基礎講清楚。"
        },
        {
          "id": "ios8sLIUt84",
          "title": "國小國語4上統整2認識句子 前後意思相反或相對的句子翰林出版",
          "channel": "翰林教學小幫手",
          "start": 0,
          "end": 170,
          "note": "「雖然……卻……」「不料」「即使……依然……」讓前後意思相反。重點常在轉折後。",
          "verify": "yt-dlp 確認公開且可嵌入；YouTube 無字幕，whisper-cli（ggml-small）整片轉錄全文讀過，同音錯字對照畫面字卡修正；選用段落抽 4–6 格逐張看過，2026-10-13",
          "fitNote": "四年級的影片：觀念和五上相同，用來把基礎講清楚。"
        }
      ],
      "sy": [
        {
          "id": "0A1SDWFhcIk",
          "title": "小二國語｜字詞｜近義詞：又再還也",
          "channel": "臺北酷課雲",
          "start": 408,
          "end": 545,
          "note": "「又、再、還、也」意思很像，用法卻不同。看重點整理，學會分辨近義詞。",
          "verify": "yt-dlp 確認公開且可嵌入；YouTube 無字幕，whisper-cli（ggml-small）整片轉錄全文讀過，同音錯字對照畫面字卡修正；選用段落抽 4–6 格逐張看過，2026-10-13",
          "fitNote": "二年級的影片：觀念和五上相同，用來把基礎講清楚。"
        }
      ],
      "an": [
        {
          "id": "3__vmTrXlZQ",
          "title": "5月20日國語課-相似詞/相反詞/顛倒詞",
          "channel": "JN H",
          "start": 64,
          "end": 112,
          "note": "意思相反的兩個詞就是反義詞。例如溫暖和寒冷、勇敢和膽小。",
          "verify": "yt-dlp 確認公開且可嵌入；YouTube 無字幕，whisper-cli（ggml-small）整片轉錄全文讀過，同音錯字對照畫面字卡修正；選用段落抽 4–6 格逐張看過，2026-10-13"
        }
      ],
      "hs": [
        {
          "id": "Z54kHamhSso",
          "title": "完璧歸趙【成語故事系列】",
          "channel": "學習吧LearnMode",
          "start": 30,
          "end": 222,
          "note": "藺相如帶著和氏璧到秦國，靠智慧把璧完整帶回趙國，這就是完璧歸趙。",
          "verify": "yt-dlp 確認公開且可嵌入；YouTube 無字幕，whisper-cli（ggml-small）整片轉錄全文讀過，同音錯字對照畫面字卡修正；選用段落抽 4–6 格逐張看過，2026-10-13"
        },
        {
          "id": "fC3wdfIOKmE",
          "title": "歷史百卡06 廉頗與藺相如",
          "channel": "China Foundation 財團法人中華教育文化基金會",
          "start": 0,
          "end": 200,
          "note": "從完璧歸趙到負荊請罪，看廉頗和藺相如怎麼由不和變成好朋友。",
          "verify": "yt-dlp 確認公開且可嵌入；YouTube 無字幕，whisper-cli（ggml-small）整片轉錄全文讀過，同音錯字對照畫面字卡修正；選用段落抽 4–6 格逐張看過，2026-10-13"
        }
      ],
      "cr": [
        {
          "id": "CUMgqaMMpv8",
          "title": "認識智慧財產權校園篇_作文篇",
          "channel": "100copyright",
          "start": 50,
          "end": 230,
          "note": "小威把姐姐的作文抄來交，這樣對嗎？別人的作品要尊重，不能直接抄。",
          "verify": "yt-dlp 確認公開且可嵌入；YouTube 無字幕，whisper-cli（ggml-small）整片轉錄全文讀過，同音錯字對照畫面字卡修正；選用段落抽 4–6 格逐張看過，2026-10-13"
        },
        {
          "id": "PC5pXVAyBig",
          "title": "認識智慧財產權校園篇_不翻印書籍篇",
          "channel": "100copyright",
          "start": 45,
          "end": 245,
          "note": "把整本書拿去影印來省錢，對作者公平嗎？想想尊重創作的正確作法。",
          "verify": "yt-dlp 確認公開且可嵌入；YouTube 無字幕，whisper-cli（ggml-small）整片轉錄全文讀過，同音錯字對照畫面字卡修正；選用段落抽 4–6 格逐張看過，2026-10-13"
        }
      ],
      "zx1": [
        {
          "id": "qgqINS6jAkU",
          "title": "【翰林國語五上備課影片】L1 你我之間",
          "channel": "翰林國小教學資源頻道",
          "start": 486,
          "end": 539,
          "note": "翰林老師講第一課生字容易寫錯的地方：堅、牙膏的膏、擁抱的擁……",
          "verify": "yt-dlp 確認公開且可嵌入；YouTube 無字幕，whisper-cli（ggml-small）整片轉錄全文讀過；選用段落抽 6 格逐張看過，2026-10-14",
          "fitNote": "翰林給老師看的備課影片；這一段正好在講本課生字。"
        },
        {
          "id": "wzNz7M3dhFo",
          "title": "小二國語｜字詞｜部件：上、中、下部件不同的字",
          "channel": "臺北酷課雲",
          "start": 169,
          "end": 290,
          "note": "上面一樣、下面不一樣的字，組詞造句就記得住。",
          "verify": "yt-dlp 確認公開且可嵌入；YouTube 無字幕，whisper-cli（ggml-small）整片轉錄全文讀過；選用段落抽 6 格逐張看過，2026-10-14",
          "fitNote": "二年級的影片：看部件分辨長得像的字，觀念和五上相同。"
        }
      ],
      "zx2": [
        {
          "id": "qgqINS6jAkU",
          "title": "【翰林國語五上備課影片】L1 你我之間",
          "channel": "翰林國小教學資源頻道",
          "start": 486,
          "end": 539,
          "note": "翰林老師講第一課生字容易寫錯的地方，一筆一筆看清楚。",
          "verify": "yt-dlp 確認公開且可嵌入；YouTube 無字幕，whisper-cli（ggml-small）整片轉錄全文讀過；選用段落抽 6 格逐張看過，2026-10-14",
          "fitNote": "翰林給老師看的備課影片；這一段正好在講本課生字。"
        },
        {
          "id": "wzNz7M3dhFo",
          "title": "小二國語｜字詞｜部件：上、中、下部件不同的字",
          "channel": "臺北酷課雲",
          "start": 290,
          "end": 436,
          "note": "中間部件不同的字：辮子用糸、辦事用力，看偏旁就知道意思。",
          "verify": "yt-dlp 確認公開且可嵌入；YouTube 無字幕，whisper-cli（ggml-small）整片轉錄全文讀過；選用段落抽 6 格逐張看過，2026-10-14",
          "fitNote": "二年級的影片：看部件分辨長得像的字，觀念和五上相同。"
        }
      ],
      "dy": [
        {
          "id": "MWK5zRrIvkc",
          "title": "小四國語｜字詞｜一字多音超有梗",
          "channel": "臺北酷課雲",
          "start": 369,
          "end": 441,
          "note": "一字多音：意思不同，讀音就不同，例如任、載。",
          "verify": "yt-dlp 確認公開且可嵌入；YouTube 無字幕，whisper-cli（ggml-small）整片轉錄全文讀過；選用段落抽 6 格逐張看過，2026-10-14",
          "fitNote": "四年級的影片：一字多音的觀念和五上相同；這一段的讀音已對照教育部國語辭典簡編本。"
        }
      ],
      "w2a": [
        {
          "id": "Ci0L7OVbt7Q",
          "title": "【翰林國語五上備課影片】L2 風起，大家都在",
          "channel": "翰林國小教學資源頻道",
          "start": 473,
          "end": 518,
          "note": "翰林老師講第二課的同部件字：都有「聿」的律、津、筆、建。",
          "verify": "yt-dlp 確認公開且可嵌入；YouTube 無字幕，whisper-cli（ggml-small）整片轉錄全文讀過；選用段落抽 6 格逐張看過，2026-10-14",
          "fitNote": "翰林給老師看的備課影片；這一段正好在講本課同部件的生字。"
        },
        {
          "id": "wzNz7M3dhFo",
          "title": "小二國語｜字詞｜部件：上、中、下部件不同的字",
          "channel": "臺北酷課雲",
          "start": 169,
          "end": 290,
          "note": "上面一樣、下面不一樣的字，像縈、螢、營、瑩、鶯。",
          "verify": "yt-dlp 確認公開且可嵌入；YouTube 無字幕，whisper-cli（ggml-small）整片轉錄全文讀過；選用段落抽 6 格逐張看過，2026-10-14",
          "fitNote": "二年級的影片：看部件分辨長得像的字，觀念和五上相同。"
        }
      ],
      "w2b": [
        {
          "id": "wzNz7M3dhFo",
          "title": "小二國語｜字詞｜部件：上、中、下部件不同的字",
          "channel": "臺北酷課雲",
          "start": 290,
          "end": 436,
          "note": "中間部件不同的字：辮子用糸、辦事用力，看偏旁就知道意思。",
          "verify": "yt-dlp 確認公開且可嵌入；YouTube 無字幕，whisper-cli（ggml-small）整片轉錄全文讀過；選用段落抽 6 格逐張看過，2026-10-14",
          "fitNote": "二年級的影片：看部件分辨長得像的字，觀念和五上相同。"
        }
      ],
      "w2c": [
        {
          "id": "Ci0L7OVbt7Q",
          "title": "【翰林國語五上備課影片】L2 風起，大家都在",
          "channel": "翰林國小教學資源頻道",
          "start": 473,
          "end": 518,
          "note": "翰林老師講第二課的同部件字：都有「肖」的梢、悄、稍、消。",
          "verify": "yt-dlp 確認公開且可嵌入；YouTube 無字幕，whisper-cli（ggml-small）整片轉錄全文讀過；選用段落抽 6 格逐張看過，2026-10-14",
          "fitNote": "翰林給老師看的備課影片；這一段正好在講本課同部件的生字。"
        },
        {
          "id": "wzNz7M3dhFo",
          "title": "小二國語｜字詞｜部件：上、中、下部件不同的字",
          "channel": "臺北酷課雲",
          "start": 290,
          "end": 436,
          "note": "看偏旁猜意思：辮子用糸、辦事用力。梢是木、捎是手，也是這個道理。",
          "verify": "yt-dlp 確認公開且可嵌入；YouTube 無字幕，whisper-cli（ggml-small）整片轉錄全文讀過；選用段落抽 6 格逐張看過，2026-10-14",
          "fitNote": "二年級的影片：看部件分辨長得像的字，觀念和五上相同。"
        }
      ],
      "w2d": [
        {
          "id": "Ci0L7OVbt7Q",
          "title": "【翰林國語五上備課影片】L2 風起，大家都在",
          "channel": "翰林國小教學資源頻道",
          "start": 485,
          "end": 500,
          "note": "翰林老師講第二課的多音字「旋」：旋轉讀ㄒㄩㄢˊ、旋風讀ㄒㄩㄢˋ。",
          "verify": "yt-dlp 確認公開且可嵌入；YouTube 無字幕，whisper-cli（ggml-small）整片轉錄全文讀過；選用段落抽 6 格逐張看過，2026-10-14",
          "fitNote": "翰林給老師看的備課影片；這一段正好在講本課多音字。"
        },
        {
          "id": "MWK5zRrIvkc",
          "title": "小四國語｜字詞｜一字多音超有梗",
          "channel": "臺北酷課雲",
          "start": 369,
          "end": 441,
          "note": "一字多音：意思不同，讀音就不同。不確定就查教育部國語辭典簡編本。",
          "verify": "yt-dlp 確認公開且可嵌入；YouTube 無字幕，whisper-cli（ggml-small）整片轉錄全文讀過；選用段落抽 6 格逐張看過，2026-10-14",
          "fitNote": "四年級的影片：一字多音的觀念和五上相同；這一段的讀音已對照教育部國語辭典簡編本。"
        }
      ],
      "w2e": [
        {
          "id": "Ci0L7OVbt7Q",
          "title": "【翰林國語五上備課影片】L2 風起，大家都在",
          "channel": "翰林國小教學資源頻道",
          "start": 418,
          "end": 469,
          "note": "翰林老師講第二課的多義詞：花絮、和諧都有兩個意思，放進句子裡判斷。",
          "verify": "yt-dlp 確認公開且可嵌入；YouTube 無字幕，whisper-cli（ggml-small）整片轉錄全文讀過；選用段落抽 6 格逐張看過，2026-10-14",
          "fitNote": "翰林給老師看的備課影片；這一段正好在講本課多義詞。"
        },
        {
          "id": "T2GNBWiCj-U",
          "title": "小四國語｜字詞｜多義詞-以「老」和「走」為例",
          "channel": "臺北酷課雲",
          "start": 68,
          "end": 300,
          "note": "一個字很多意思：老早的老是很、老規矩的老是原來的，放進句子裡判斷。",
          "verify": "yt-dlp 確認公開且可嵌入；YouTube 無字幕，whisper-cli（ggml-small）整片轉錄全文讀過；選用段落抽 6 格逐張看過，2026-10-14",
          "fitNote": "四年級的影片：一字多義的觀念和五上相同。"
        }
      ]
    },
    "NO_VIDEO": {}
  };
  if (typeof module !== "undefined" && module.exports) module.exports = DATA; else root.G5_VIDEOS = DATA;
})(typeof window !== "undefined" ? window : this);
