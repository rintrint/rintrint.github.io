# Tower Defense 關卡生成 + 評估器

幫我建一個工具，用來為這個塔防遊戲生成關卡、評估難度、並回饋單位平衡。
**這是一個關卡與單位數值的「協同調整」工具** —— 我會用它的報告來決定 units.csv 要怎麼改，再用它驗證改動有沒有破壞既有關卡。

## 重要原則：重用 game.js，不要重寫

`cat/game.js` 是這個遊戲的本體,戰鬥邏輯完整。
評估器**必須直接 `require` 它**，禁止用其他語言（Python/Go 等）重新實作戰鬥邏輯。
理由：任何重寫都會跟 game.js 漂移，導致評估器報告的「合格關卡」在真實遊戲中不合格 —— 這會讓整個工作流失效。

第一個任務：把 `game.js` 拆成兩個檔案：
- `core.js`：純戰鬥邏輯，所有 dataclass、Unit、GameSim、ability 處理、敵人生成、勝負判定。**不可有** `document`、`canvas`、`requestAnimationFrame`、`Audio`、`Sound`、`ctx`、任何 DOM/瀏覽器 API。
- `render.js`：所有畫面繪製、音效、UI 互動，從 core 拿狀態來畫。

`index.html` 改成同時引入 `core.js` 和 `render.js`，瀏覽器行為必須跟拆分前**位元等價**（同一個 seed 跑同一關，結果完全一樣）。先做這步並用 1–2 個關卡實機驗證再進下一階段。

## 遊戲現況（從 game.js 讀出的事實，請以程式碼為準）

- 地圖:玩家塔在右、敵塔在左,兩塔 x 座標為常數。
- 金錢:有初始值、每秒回復、上限,擊敗敵人有 reward。
- 玩家單位定義在 `data/units.csv`、敵人單位定義在 `data/enemies.csv`。
- 關卡 CSV(`data/levelN.csv`)格式:欄位 `trigger,enemy,count,time,interval,start,end`
  - `trigger=time`:在 `time` 秒生 `count` 隻 `enemy`
  - `trigger=loop`:從 `start` 秒起每 `interval` 秒生 `count` 隻,直到 `end`(可空)
  - `trigger=tower_hit`:玩家塔被打到時觸發一次
- 敵塔 HP 跟出場技能效果常數定義在 core.js 開頭。
- 評估器以「所有單位全可用」為前提。

## 專案結構

```
cat/
  core.js          # 從 game.js 拆出的純邏輯（你要做的）
  render.js        # 從 game.js 拆出的渲染（你要做的）
  game.js          # 拆分後可刪除或保留為相容入口
  index.html       # 引入 core.js + render.js
  data/...         # 不動
  tools/
    sim.js         # 包一層 headless 介面，吃 level + seed 跑到結束，回傳結果
    bots.js        # 策略 bot
    evaluator.js   # 對單一關卡跑多 bot × 多 seed
    generator.js   # 生成 + 突變關卡參數
    report.js      # 產出 markdown 報告
    cli.js         # 進入點
    archive/       # 生出來的關卡 JSON
    reports/       # 報告輸出
```

純 Node.js（>=20），不要拉 npm 依賴除非必要。CSV parse 自己寫一個簡短的就好。

## Phase 1：headless 模擬 `tools/sim.js`

匯出：
```js
function runMatch({ level, bot, seed, maxTime = 180 }) -> {
  result: 'win' | 'lose' | 'timeout',
  elapsedSec: number,
  playerTowerHpFrac: number,    // 0..1
  enemyTowerHpFrac: number,     // 0..1
  unitsSummoned: { [unitId]: number },
  enemiesKilled: { [enemyId]: number },
  moneyHistory: number[],        // 每秒一筆
}
```

要求:
- **決定性**:固定 seed 結果必須完全相同。把 `Math.random` 全部替換成 seeded RNG(mulberry32 或類似)注入到 core.js 裡。core.js 不能直接呼叫 `Math.random`。
- 用 fixed DT 推進(不依賴 requestAnimationFrame)。
- 跑到勝負分明或 maxTime 為止。
- 一定要有單元測試:「玩家單位 vs 敵人 1v1,固定 seed,T 秒內敵人 HP 歸零」這種具體斷言。模擬器錯了下面全錯。

## Phase 2:策略 Bot `tools/bots.js`

每個 bot 是 `(gameState) -> unitIdToSummon | null` 的純函數策略。
所有單位全可用前提下實作:

- `RandomBot` — 隨機召喚一隻買得起的,baseline
- `MeatshieldDPSBot` — 缺肉盾就補肉盾,否則買得起就出最高 cost 的 DPS
- `RushBot` — 不停出最便宜最快的單位
- `SniperBot` — 少量肉盾,其他全遠程/AoE
- `EconomyBurstBot` — 錢快滿時才一次倒最貴的
- `OnSummonComboBot` — 依場面選最適合的單位

每個 bot 要**對任何單位組合 graceful fallback**(之後加 deck 機制時不會壞)。

## Phase 3:評估器 `tools/evaluator.js`

```js
async function evaluateLevel(level, { seeds }) -> LevelReport
```

對每個 bot 用多 seed 跑,回傳:
```js
{
  randomWinRate: number,                       // RandomBot 的勝率,需夠低
  botWinRate: { [botName]: number },           // 每個 bot 的勝率
  viableBots: string[],                        // 勝率高於門檻的 bot
  unitUsage: { [unitId]: number },             // 在 viable bot 的勝場中,每隻單位被召喚至少 1 次的場數比例
  avgMatchTime: number,
  score: number,
  verdict: 'good' | 'too_easy' | 'too_hard' | 'single_solution',
}
```

評分加總「max(botWinRate) − randomWinRate」、viable bot 多樣性獎勵、以及 random 勝率過高的懲罰,具體公式跟門檻寫在程式裡。

用 `worker_threads` 並行跑(CPU 核心數)。

## Phase 4:生成器 `tools/generator.js`

**先做最簡單版本**:純隨機生 N 個關卡 → 評估 → 取 score top-K 存到 `archive/`。
不要直接做 MAP-Elites,等簡單版跑起來證明評估器準確後再說。

突變的參數:
- 敵塔 HP
- 初始金錢、regen、cap
- 生成事件清單(混合 time/loop/tower_hit、所有敵人類型)
- maxTime

具體範圍寫在 generator.js 程式裡,別寫死在文件。

關卡 schema 用 JSON(不是 CSV):
```json
{
  "id": "...",
  "enemyTowerHp": ...,
  "initMoney": ...,
  "moneyRegen": ...,
  "moneyCap": ...,
  "maxTime": ...,
  "events": [
    { "trigger": "time", "enemy": "...", "count": ..., "time": ... },
    { "trigger": "loop", "enemy": "...", "count": ..., "interval": ..., "start": ..., "end": ... },
    { "trigger": "tower_hit", "enemy": "...", "count": ... }
  ]
}
```

sim.js 要同時支援讀 CSV(既有關卡)和 JSON(生成關卡)。

## Phase 5:報告 `tools/report.js`

產出 `reports/report_<timestamp>.md`,內容:

1. **Top K 值得手動玩的關卡** —— 從 archive 挑 score 高且 verdict 多樣的幾個。列出 id、參數、哪個 bot 過關了、平均過關時間。
2. **單位使用率** —— 對全 archive 統計每隻玩家單位被召喚的比例,過低或過高都標記為可能不平衡。
3. **Bot 主導率** —— 每個 bot 在多少 % 的 archive 關卡中是 viable;單一 bot 主導或完全不被支持都標記。
4. **難度分佈** —— randomWinRate 和 max(botWinRate) 的直方圖(純文字 ASCII 即可)。
5. **可疑平衡問題** —— 自動文字 bullet,例如「某單位幾乎沒出現 → 可能 cost 過高」。

具體百分比門檻寫在 report.js 程式裡。

## Phase 6:CLI `tools/cli.js`

```bash
node tools/cli.js generate --n <N> --out archive/<name>.json   # 慢,偶爾跑
node tools/cli.js regression --archive archive/<name>.json     # 快,改完 csv 跑這個
node tools/cli.js report --archive archive/<name>.json
node tools/cli.js play-suggest --archive archive/<name>.json --n <K>
node tools/cli.js evaluate --level data/levelN.csv             # 評估單一現有關卡
```

`regression` 是核心快循環:吃既有 archive,用**當前的 units.csv** 重跑一次評估,輸出 diff:
```
Archive: <N> levels
Re-evaluated under current units.csv:
  Still passing: <n>
  Broke: <n> -> [ids...]
  Score change median: ...
  Largest score drops: ...
```

如果壞掉比例超過門檻,就提示「本次單位調整衝擊過大,考慮退回」。

## 開發順序(強制)

依序做,每階段做完都要有 commit 和能跑的測試:

1. 拆 game.js → core.js + render.js,瀏覽器行為驗證等價
2. Seeded RNG 注入 + sim.js + 單元測試(含每個 ability 一個)
3. 對 data/level1.csv 跑一次 evaluator,輸出合理的 botWinRate
4. 寫所有 bot
5. 簡單版 generator（純隨機，無 MAP-Elites）
6. report
7. cli 串起來

**不要一次全寫完。Phase 1 沒驗證對之前不要碰 Phase 2。**

## 風格

- Conventional commits（feat: / fix: / refactor:）
- 中文 commit message 或 PR 描述 OK，code comment 用英文
- 不要寫 docstring 牆，code 自解釋
- 不要加沒被測試覆蓋的「以防萬一」邊界處理
- 沒實作的功能不要寫 stub，直接省略
