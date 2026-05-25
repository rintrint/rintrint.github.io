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
// pierce: 出場對「最近的敵人」+30 傷害 (沒有距離限制)
// ----------------------------------------------------------------------------
test('pierce: deals PIERCE_BONUS to nearest enemy on summon', () => {
  const g = freshGame({ deck: ['attack'] });
  const grunt = pushEnemy(g, 'grunt', 600);
  const initialHp = grunt.hp;

  assert.equal(g.trySpawnPlayer('attack'), true);
  assert.equal(grunt.hp, initialHp - C.PIERCE_BONUS,
    `grunt should take ${C.PIERCE_BONUS} pierce damage`);
});

test('pierce: with two enemies, only nearest takes damage', () => {
  const g = freshGame({ deck: ['attack'] });
  const near = pushEnemy(g, 'grunt', 900);    // 距 spawn(1160) 較近
  const far  = pushEnemy(g, 'grunt', 200);
  g.trySpawnPlayer('attack');
  assert.equal(near.hp, 80 - C.PIERCE_BONUS);
  assert.equal(far.hp, 80, 'far enemy should be untouched');
});

// ----------------------------------------------------------------------------
// shield: 出場 SHIELD_DURATION 秒減傷 50%
// ----------------------------------------------------------------------------
test('shield: defender gets shieldTimer = SHIELD_DURATION on summon', () => {
  const g = freshGame({ deck: ['defender'] });
  assert.equal(g.trySpawnPlayer('defender'), true);
  const def = g.playerUnits[g.playerUnits.length - 1];
  assert.equal(def.shieldTimer, C.SHIELD_DURATION);
});

test('shield: takeDamage during shield window is halved', () => {
  const g = freshGame({ deck: ['defender'] });
  g.trySpawnPlayer('defender');
  const def = g.playerUnits[g.playerUnits.length - 1];
  const before = def.hp;
  def.takeDamage(100);
  assert.equal(def.hp, before - 50, 'damage should be halved by shield');
});

// ----------------------------------------------------------------------------
// dash: 出場 DASH_DURATION 秒移速 ×1.8
// ----------------------------------------------------------------------------
test('dash: rusher gets dashTimer = DASH_DURATION on summon', () => {
  const g = freshGame({ deck: ['rusher'] });
  g.trySpawnPlayer('rusher');
  const r = g.playerUnits[g.playerUnits.length - 1];
  assert.equal(r.dashTimer, C.DASH_DURATION);
});

test('dash: rusher moves at 1.8x speed while dashing', () => {
  const g = freshGame({ deck: ['rusher'] });
  g.trySpawnPlayer('rusher');
  const r = g.playerUnits[g.playerUnits.length - 1];
  const startX = r.x;
  const dt = 0.1;
  // 用 Unit.update 直接推一步,沒有敵人在範圍內所以會移動
  r.update(dt, g);
  const expectedDx = -1 * units.rusher.speed * 1.8 * dt;   // dir=-1 (player faces left)
  assert.ok(Math.abs((r.x - startX) - expectedDx) < 1e-9,
    `expected dx≈${expectedDx}, got ${r.x - startX}`);
});

// ----------------------------------------------------------------------------
// snipe: 出場狙擊最遠敵人 SNIPE_DAMAGE 傷害
// ----------------------------------------------------------------------------
test('snipe: targets farthest enemy (smallest x), not nearest', () => {
  const g = freshGame({ deck: ['sniper'] });
  const far  = pushEnemy(g, 'grunt', 100);   // 越靠左 = 越遠
  const near = pushEnemy(g, 'grunt', 800);
  g.trySpawnPlayer('sniper');
  assert.equal(far.hp, 80 - C.SNIPE_DAMAGE, 'far enemy should be sniped');
  assert.equal(near.hp, 80, 'near enemy should be untouched');
});

// ----------------------------------------------------------------------------
// heal: 出場立即治癒所有友軍 HEAL_SPAWN_FRAC × maxHp
// ----------------------------------------------------------------------------
test('heal: heals all damaged allies by HEAL_SPAWN_FRAC of maxHp', () => {
  const g = freshGame({ deck: ['healer'] });
  const wounded = pushPlayer(g, 'attack', 1000, 20);   // 攻擊兵 maxHp=80, 現 hp=20
  assert.equal(g.trySpawnPlayer('healer'), true);
  const expected = 20 + units.attack.hp * C.HEAL_SPAWN_FRAC;
  assert.equal(wounded.hp, expected,
    `wounded ally should heal to ${expected}`);
});

test('heal: full-hp ally is capped at maxHp', () => {
  const g = freshGame({ deck: ['healer'] });
  const full = pushPlayer(g, 'attack', 1000);          // 滿血
  g.trySpawnPlayer('healer');
  assert.equal(full.hp, full.maxHp, 'full-hp ally should remain at maxHp');
});

// ----------------------------------------------------------------------------
// knockback: 出場把所有敵人 x -= KNOCKBACK_DIST
// ----------------------------------------------------------------------------
test('knockback: all enemies shift left by KNOCKBACK_DIST', () => {
  const g = freshGame({ deck: ['heavy'] });
  const e1 = pushEnemy(g, 'grunt', 200);
  const e2 = pushEnemy(g, 'grunt', 300);
  g.trySpawnPlayer('heavy');
  assert.equal(e1.x, 200 - C.KNOCKBACK_DIST);
  assert.equal(e2.x, 300 - C.KNOCKBACK_DIST);
});

test('knockback: enemies get short attack delay after being knocked', () => {
  const g = freshGame({ deck: ['heavy'] });
  const e = pushEnemy(g, 'grunt', 200);
  e.attackTimer = 0;
  g.trySpawnPlayer('heavy');
  assert.ok(e.attackTimer >= 0.3, 'knocked enemy should have attack delay');
});

// ----------------------------------------------------------------------------
// bomb: 出場在 spawn 點半徑 BOMB_RADIUS 內造成 BOMB_DAMAGE
// ----------------------------------------------------------------------------
test('bomb: hits enemies within BOMB_RADIUS, misses outside', () => {
  const g = freshGame({ deck: ['bomber'] });
  const spawnX = C.PLAYER_TOWER_X - C.TOWER_W / 2 - 10;   // 1160
  const inRange  = pushEnemy(g, 'heavy', spawnX - C.BOMB_RADIUS + 10);  // 剛好內
  const outRange = pushEnemy(g, 'heavy', spawnX - C.BOMB_RADIUS - 10);  // 剛好外
  const inHpBefore  = inRange.hp;
  const outHpBefore = outRange.hp;
  g.trySpawnPlayer('bomber');
  assert.equal(inRange.hp,  inHpBefore  - C.BOMB_DAMAGE);
  assert.equal(outRange.hp, outHpBefore, 'out-of-range enemy should be untouched');
});

// ----------------------------------------------------------------------------
// shake (boss): 出場震撼;非 boss 走 default 也不應 crash
// ----------------------------------------------------------------------------
test('shake (boss): summon sets purpleFlash and adds summonEffect', () => {
  const g = freshGame({ money: 5000, deck: ['boss'] });
  g.purpleFlash = 0;
  g.summonEffects = [];
  assert.equal(g.trySpawnPlayer('boss'), true, `boss cost=${units.boss.cost}, money=${g.money}`);
  assert.ok(g.purpleFlash > 0, 'boss summon should trigger purpleFlash');
  assert.ok(g.summonEffects.length > 0, 'boss summon should push summonEffect');
});
