# Tower Defense 關卡生成 + 評估器

幫我建一個工具，用來為這個塔防遊戲生成關卡、評估難度、並回饋單位平衡。
**這是一個關卡與單位數值的「協同調整」工具** —— 我會用它的報告來決定 units.csv 要怎麼改，再用它驗證改動有沒有破壞既有關卡。

## 重要原則：重用 game.js，不要重寫

`cat/game.js` 是這個遊戲的本體（1537 行，戰鬥邏輯完整）。
評估器**必須直接 `require` 它**，禁止用其他語言（Python/Go 等）重新實作戰鬥邏輯。
理由：任何重寫都會跟 game.js 漂移，導致評估器報告的「合格關卡」在真實遊戲中不合格 —— 這會讓整個工作流失效。

第一個任務：把 `game.js` 拆成兩個檔案：
- `core.js`：純戰鬥邏輯，所有 dataclass、Unit、GameSim、ability 處理、敵人生成、勝負判定。**不可有** `document`、`canvas`、`requestAnimationFrame`、`Audio`、`Sound`、`ctx`、任何 DOM/瀏覽器 API。
- `render.js`：所有畫面繪製、音效、UI 互動，從 core 拿狀態來畫。

`index.html` 改成同時引入 `core.js` 和 `render.js`，瀏覽器行為必須跟拆分前**位元等價**（同一個 seed 跑同一關，結果完全一樣）。先做這步並用 1–2 個關卡實機驗證再進下一階段。

## 遊戲現況（從 game.js 讀出的事實，請以程式碼為準）

- 地圖：玩家塔 x=1200，敵塔 x=80。
- 金錢：初始 3000，每秒 +36，上限 5000。擊敗敵人有 reward。
- 玩家單位（`data/units.csv`，8 隻）：attack/defender/rusher/sniper/healer/heavy/bomber/boss
- 敵人單位（`data/enemies.csv`，5 隻）：grunt/heavy/fast/elite/boss
- 關卡 CSV（`data/levelN.csv`）格式：欄位 `trigger,enemy,count,time,interval,start,end`
  - `trigger=time`：在 `time` 秒生 `count` 隻 `enemy`
  - `trigger=loop`：從 `start` 秒起每 `interval` 秒生 `count` 隻，直到 `end`（可空）
  - `trigger=tower_hit`：玩家塔被打到時觸發一次
- 敵塔 HP：目前 level 1–5 為 1800/2500/3000/3600/4400
- 出場技能（`ability` 欄位）效果常數在 game.js 開頭：PIERCE_BONUS=30、SHIELD_DURATION=4、DASH_DURATION=3、SNIPE_DAMAGE=60、HEAL_SPAWN_FRAC=0.4、HEAL_AURA_INTERVAL=12、KNOCKBACK_DIST=100、BOMB_RADIUS=180、BOMB_DAMAGE=100
- **目前遊戲沒有「4 選 8」套牌機制，8 隻全部可用**。評估器先以「8 隻全可用」為前提；如果之後要加 deck，再開新 issue。

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

純 Node.js（>=20），不要拉 npm 依賴除非必要。CSV parse 自己寫一個 10 行的就好。

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

要求：
- **決定性**：固定 seed 結果必須完全相同。把 `Math.random` 全部替換成 seeded RNG（mulberry32 或類似）注入到 core.js 裡。core.js 不能直接呼叫 `Math.random`。
- 用 fixed DT=0.05 推進（不依賴 requestAnimationFrame）。
- 跑到勝負分明或 maxTime 為止。
- 一定要有單元測試：「攻擊兵 vs grunt 1v1，固定 seed，T 秒內 grunt HP 歸零」這種具體斷言。模擬器錯了下面全錯。

## Phase 2：策略 Bot `tools/bots.js`

每個 bot 是 `(gameState) -> unitIdToSummon | null` 的純函數策略。
8 隻全部可用前提下實作：

- `RandomBot` — 每 tick 有 30% 機率隨機召喚一隻買得起的，baseline
- `MeatshieldDPSBot` — 場上 < 3 隻肉盾就補肉盾（defender/heavy），否則買得起就出最高 cost 的 DPS
- `RushBot` — 不停出最便宜最快的單位（rusher 優先）
- `SniperBot` — 出 1–2 肉盾，其他全 sniper / bomber
- `EconomyBurstBot` — 在錢 < 90% MAX 時不出，到 90% 後一次倒最貴的
- `OnSummonComboBot` —
  - 場上前線 3 隻以上敵人聚集時出 bomber（觸發 bomb）
  - 敵人離玩家塔 < 200 時出 heavy（觸發 knockback）
  - 最遠敵人是高 HP（heavy/elite/boss）時出 sniper（觸發 snipe）
  - 主力快死時出 healer
  - 其他時候出 attack（pierce）

每個 bot 要**對任何單位組合 graceful fallback**（之後加 deck 機制時不會壞）。

## Phase 3：評估器 `tools/evaluator.js`

```js
async function evaluateLevel(level, { seeds = 30 }) -> LevelReport
```

對每個 bot 用 `seeds` 個 seed 跑，回傳：
```js
{
  randomWinRate: number,                       // RandomBot 的勝率，目標 < 0.15
  botWinRate: { [botName]: number },           // 每個 bot 的勝率
  viableBots: string[],                        // 勝率 >= 0.6 的 bot
  unitUsage: { [unitId]: number },             // 在 viable bot 的勝場中，每隻單位被召喚至少 1 次的場數比例
  avgMatchTime: number,
  score: number,
  verdict: 'good' | 'too_easy' | 'too_hard' | 'single_solution',
}
```

評分：
```
score = max(botWinRate) - randomWinRate
      + 0.2 * viableBots.length
      - 2 * max(0, randomWinRate - 0.15)
```

用 `worker_threads` 並行跑（CPU 核心數）。

## Phase 4：生成器 `tools/generator.js`

**先做最簡單版本**：純隨機生 N 個關卡 → 評估 → 取 score top-K 存到 `archive/`。
不要直接做 MAP-Elites，等簡單版跑起來證明評估器準確後再說。

突變的參數：
- 敵塔 HP（1500–8000）
- 初始金錢（500–4000）、regen（20–60）、cap（3000–8000）
- 生成事件清單（5–25 個事件，混合 time/loop/tower_hit、五種敵人類型）
- maxTime（90–180）

關卡 schema 用 JSON（不是 CSV）：
```json
{
  "id": "gen_seed42",
  "enemyTowerHp": 3200,
  "initMoney": 2000,
  "moneyRegen": 36,
  "moneyCap": 5000,
  "maxTime": 120,
  "events": [
    { "trigger": "time", "enemy": "grunt", "count": 3, "time": 2 },
    { "trigger": "loop", "enemy": "fast", "count": 1, "interval": 5, "start": 10, "end": 60 },
    { "trigger": "tower_hit", "enemy": "heavy", "count": 1 }
  ]
}
```

sim.js 要同時支援讀 CSV（既有關卡）和 JSON（生成關卡）。

## Phase 5：報告 `tools/report.js`

產出 `reports/report_<timestamp>.md`，內容：

1. **Top 5 值得手動玩的關卡** —— 從 archive 挑 score 高且 verdict 多樣的 5 個。列出 id、參數、哪個 bot 過關了、平均過關時間。
2. **單位使用率** —— 對全 archive 統計，每隻玩家單位在「viable bot 的勝場」中被召喚的比例。<10% 標「可能太弱」，>90% 標「可能過強」。
3. **Bot 主導率** —— 每個 bot 在多少 % 的 archive 關卡中是 viable。某 bot >80% 標「策略單一」，<20% 標「該玩法不被支持」。
4. **難度分佈** —— randomWinRate 和 max(botWinRate) 的直方圖（純文字 ASCII 即可）。
5. **可疑平衡問題** —— 自動文字 bullet：例如「巨型貓在 3% 的 viable 勝場中出現 → 可能 cost 過高」。

## Phase 6：CLI `tools/cli.js`

```bash
node tools/cli.js generate --n 500 --out archive/<name>.json   # 慢，偶爾跑
node tools/cli.js regression --archive archive/<name>.json     # 快，改完 csv 跑這個
node tools/cli.js report --archive archive/<name>.json
node tools/cli.js play-suggest --archive archive/<name>.json --n 5
node tools/cli.js evaluate --level data/level3.csv             # 評估單一現有關卡
```

`regression` 是核心快循環：吃既有 archive，用**當前的 units.csv** 重跑一次評估，輸出 diff：
```
Archive: 50 levels
Re-evaluated under current units.csv:
  Still passing: 47
  Broke: 3 -> [gen_seed12, gen_seed88, gen_seed213]
  Score change median: -0.04
  Largest score drops: ...
```

如果壞 >20%，就提示「本次單位調整衝擊過大，考慮退回」。

## 開發順序（強制）

依序做，每階段做完都要有 commit 和能跑的測試：

1. 拆 game.js → core.js + render.js，瀏覽器行為驗證等價
2. Seeded RNG 注入 + sim.js + 至少 5 個單元測試（含每個 ability 一個）
3. 對 data/level1.csv 跑一次 evaluator，輸出合理的 botWinRate
4. 寫滿 6 個 bot
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
