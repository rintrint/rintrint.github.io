// tools/tests/abilities.test.js
// 八個出場技能 (pierce / shield / dash / snipe / heal / knockback / bomb / shake)
// 各一個測試。每個都是「設置最小場景 -> 召喚 -> 斷言效果」的單元測試,
// 不跑滿模擬,所以失敗訊息會直接指向是哪個 ability 壞掉的。

const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../../core.js');
const { loadAndApply } = require('../csv-loader');

const data = loadAndApply();
const { units, enemies } = data;
const C = core.constants;

function freshGame({ money = 5000, deck = null } = {}) {
  const g = new core.GameState();
  g.reset(1);
  g.levelEvents = [];      // 清掉 level1 腳本,避免被自動 spawn 干擾
  g.pendingSpawns = [];
  if (deck) g.deck = deck.slice();
  g.money = money;
  return g;
}

function pushEnemy(g, enemyId, x) {
  const u = new core.Unit(enemies[enemyId], 'enemy', x);
  g.enemyUnits.push(u);
  return u;
}

function pushPlayer(g, unitId, x, hpOverride = null) {
  const u = new core.Unit(units[unitId], 'player', x);
  if (hpOverride !== null) u.hp = hpOverride;
  g.playerUnits.push(u);
  return u;
}

// ----------------------------------------------------------------------------
// backdoor: 刺客直接傳送到敵塔背後並朝塔的方向走(目前唯一保留的玩家特殊效果)
// ----------------------------------------------------------------------------
test('backdoor: rusher spawns to the left of enemy tower and walks right', () => {
  const g = freshGame({ deck: ['rusher'] });
  g.trySpawnPlayer('rusher');
  const r = g.playerUnits[g.playerUnits.length - 1];
  assert.ok(r.x < C.ENEMY_TOWER_X, `rusher x=${r.x} should be < ENEMY_TOWER_X=${C.ENEMY_TOWER_X}`);
  assert.equal(r.dir, 1, 'rusher should walk right (toward enemy tower from behind)');
  assert.equal(r.dashTimer, 0, 'rusher no longer has dash speed boost');
});

// ----------------------------------------------------------------------------
// boss def.boss=true:即使 ability='none' 也會走 default case 觸發 purpleFlash
// ----------------------------------------------------------------------------
test('boss summon: purpleFlash + summonEffect fire from def.boss flag', () => {
  const g = freshGame({ money: 5000, deck: ['boss'] });
  g.purpleFlash = 0;
  g.summonEffects = [];
  assert.equal(g.trySpawnPlayer('boss'), true, `boss cost=${units.boss.cost}, money=${g.money}`);
  assert.ok(g.purpleFlash > 0, 'boss summon should trigger purpleFlash');
  assert.ok(g.summonEffects.length > 0, 'boss summon should push summonEffect');
});
