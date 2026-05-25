// tools/evaluator.js (UMD)
// 對單一關卡跑「每個 bot × N 個 seed」,輸出 LevelReport。
// 之後 generator 會大量呼叫這個函數來打分。

(function () {
  const isNode = typeof module !== 'undefined' && module.exports;
  const sim   = isNode ? require('./sim')  : globalThis.SimTools;
  const bots  = isNode ? require('./bots') : globalThis.Bots;

  const DEFAULT_DECK = ['attack', 'defender', 'rusher', 'sniper'];
  const VIABLE_THRESHOLD = 0.6;

  // 平均勝率算法:RandomBot 對 seed 敏感 -> 多跑 seed 取平均;
  // 其他 bot 是確定性的,跑 1 seed 就能定勝率(0 或 1)。
  function evaluateLevel(level, {
    deck = DEFAULT_DECK,
    randomSeeds = 5,
    getUnitDef,
  } = {}) {
    if (!getUnitDef) throw new Error('evaluateLevel: getUnitDef is required');

    const wrPerBot = {};
    const sampleResultsPerBot = {};

    for (const [name, botDef] of Object.entries(bots.BOTS)) {
      const seeds = botDef.seeded
        ? Array.from({ length: randomSeeds }, (_, i) => i + 1)
        : [1];
      let wins = 0;
      const sampleResults = [];
      for (const seed of seeds) {
        const policy = botDef.make({ seed, deck, getUnitDef });
        const res = sim.runMatch({ level, policy, deck });
        if (res.result === 'win') wins++;
        sampleResults.push(res);
      }
      wrPerBot[name] = wins / seeds.length;
      sampleResultsPerBot[name] = sampleResults;
    }

    const randomWr = wrPerBot.random ?? 0;
    const bestBotWr = Math.max(...Object.values(wrPerBot));
    const bestBotName = Object.entries(wrPerBot).reduce((best, [n, wr]) =>
      wr > best.wr ? { name: n, wr } : best, { name: null, wr: -1 }).name;
    const viableBots = Object.entries(wrPerBot)
      .filter(([_, wr]) => wr >= VIABLE_THRESHOLD)
      .map(([n]) => n);

    const score =
        bestBotWr
      - randomWr
      + 0.2 * viableBots.length
      - 2 * Math.max(0, randomWr - 0.15);

    let verdict;
    if (bestBotWr < 0.3) verdict = 'too_hard';
    else if (randomWr > 0.5) verdict = 'too_easy';
    else if (viableBots.length === 0) verdict = 'too_hard';
    else verdict = 'good';

    return {
      wrPerBot,
      randomWr,
      bestBotWr,
      bestBotName,
      viableBots,
      score,
      verdict,
      sampleResultsPerBot,
    };
  }

  const exportsObj = { evaluateLevel, VIABLE_THRESHOLD, DEFAULT_DECK };
  if (isNode) module.exports = exportsObj;
  else globalThis.Evaluator = exportsObj;
})();
