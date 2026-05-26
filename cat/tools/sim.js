// tools/sim.js (UMD)
// Headless 比賽執行器。Node 透過 require、瀏覽器透過 <script> 載入都能用。
//
// policy(game) -> null | { summon: 'attackId' } | { skill: 'cannon'|'shield' }
// 每個 sim tick 會被呼叫一次。

(function () {
  const isNode = typeof module !== 'undefined' && module.exports;
  const core = isNode ? require('../core.js') : globalThis.Core;

  const DEFAULT_DT = 0.05;
  const DEFAULT_MAX_TIME = 180;

  function runMatch({
    level,
    policy = () => null,
    deck = null,
    maxTime = DEFAULT_MAX_TIME,
    dt = DEFAULT_DT,
  } = {}) {
    const game = new core.GameState();

    if (deck) game.deck = deck.slice();

    if (typeof level === 'number') {
      game.reset(level);
    } else if (level && typeof level === 'object') {
      game.reset(1);
      if (Array.isArray(level.events)) {
        game.levelEvents = level.events.map(e => ({ ...e, fired: false, nextTime: null }));
      }
      if (typeof level.enemyTowerHp === 'number') {
        game.enemyTower.hp = level.enemyTowerHp;
        game.enemyTower.maxHp = level.enemyTowerHp;
      }
    } else {
      game.reset(1);
    }

    const unitsSummoned = {};
    let policyCalls = 0;

    while (!game.gameOver && game.elapsed < maxTime) {
      const action = policy(game);
      policyCalls++;
      if (action) {
        if (action.summon && game.trySpawnPlayer(action.summon)) {
          unitsSummoned[action.summon] = (unitsSummoned[action.summon] || 0) + 1;
        } else if (action.skill) {
          game.trySkill(action.skill);
        }
      }
      game.update(dt);
    }

    return {
      result: game.gameOver ? (game.winner === 'player' ? 'win' : 'lose') : 'timeout',
      elapsedSec: game.elapsed,
      playerTowerHpFrac: Math.max(0, game.playerTower.hp / game.playerTower.maxHp),
      enemyTowerHpFrac:  Math.max(0, game.enemyTower.hp  / game.enemyTower.maxHp),
      unitsSummoned,
      policyCalls,
      finalMoney: game.money,
      finalPlayerCount: game.playerUnits.length,
      finalEnemyCount: game.enemyUnits.length,
    };
  }

  const exportsObj = { runMatch, DEFAULT_DT, DEFAULT_MAX_TIME };
  if (isNode) {
    module.exports = exportsObj;
  } else {
    globalThis.SimTools = exportsObj;
  }
})();
