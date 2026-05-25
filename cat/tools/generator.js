// tools/generator.js (UMD)
// 隨機產生關卡參數 -> 餵給 evaluator 打分 -> 按 score 排序回傳。
// 目前是純隨機,沒有 MAP-Elites,先確認 evaluator 準確再升級。

(function () {
  const isNode = typeof module !== 'undefined' && module.exports;
  const evaluator = isNode ? require('./evaluator') : globalThis.Evaluator;
  const bots      = isNode ? require('./bots')      : globalThis.Bots;

  const ENEMY_TYPES = ['grunt', 'heavy', 'fast', 'elite'];   // 暫時跳過 boss(太強會偏斜分數)

  // 加權選敵人:多數是 grunt/fast,heavy 偶爾,elite 稀有。
  function pickEnemy(rng) {
    const r = rng();
    if (r < 0.50) return 'grunt';
    if (r < 0.80) return 'fast';
    if (r < 0.94) return 'heavy';
    return 'elite';
  }

  // 重型敵人 count 要壓低,不然壓垮玩家。
  function pickCount(rng, enemyType) {
    if (enemyType === 'elite') return 1;
    if (enemyType === 'heavy') return 1 + Math.floor(rng() * 2);   // 1-2
    return 1 + Math.floor(rng() * 3);                              // 1-3
  }

  function makeRandomLevel(rng, id) {
    const events = [];

    // 8-18 個 timed 事件,時間均勻分散在 0-120s
    const nTimed = 8 + Math.floor(rng() * 11);
    for (let i = 0; i < nTimed; i++) {
      const enemy = pickEnemy(rng);
      events.push({
        trigger: 'time',
        enemy,
        count: pickCount(rng, enemy),
        time: Math.floor(rng() * 120),
      });
    }

    // 1-2 個 loop (3 個同時跑會壓垮玩家)
    const nLoops = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < nLoops; i++) {
      const enemy = pickEnemy(rng);
      events.push({
        trigger: 'loop',
        enemy,
        count: 1,
        interval: 4 + Math.floor(rng() * 7),   // 4-10s
        start: 30 + Math.floor(rng() * 40),
        end: null,
      });
    }

    // 60% 機率有 1 個 tower_hit 事件
    if (rng() < 0.6) {
      const enemy = pickEnemy(rng);
      events.push({
        trigger: 'tower_hit',
        enemy,
        count: pickCount(rng, enemy),
      });
    }

    return {
      id,
      enemyTowerHp: 3000 + Math.floor(rng() * 9000),     // 3000-12000
      events,
    };
  }

  // async 是為了讓 UI 可以在每個關卡之間 yield (onProgress callback 後 await microtask)
  async function generateAndEvaluate({
    n = 50,
    masterSeed = 1,
    deck,
    getUnitDef,
    onProgress,
    yieldEvery = 1,
  }) {
    const masterRng = bots.makeRng(masterSeed);
    const results = [];

    for (let i = 0; i < n; i++) {
      const levelSeed = Math.floor(masterRng() * 1e9) + 1;
      const level = makeRandomLevel(bots.makeRng(levelSeed), `gen_${masterSeed}_${i + 1}`);
      level.seed = levelSeed;
      const report = evaluator.evaluateLevel(level, { deck, getUnitDef });
      results.push({ level, report });
      if (onProgress) onProgress(i + 1, n);
      if ((i + 1) % yieldEvery === 0) {
        // 讓出 UI thread,瀏覽器可以更新進度條
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    results.sort((a, b) => b.report.score - a.report.score);
    return results;
  }

  const exportsObj = { generateAndEvaluate, makeRandomLevel, ENEMY_TYPES };
  if (isNode) module.exports = exportsObj;
  else globalThis.Generator = exportsObj;
})();
