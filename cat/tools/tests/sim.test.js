// tools/tests/sim.test.js
// 模擬器整體行為:1v1、整關跑滿、determinism。
// 這些測試確認 sim.js + core.js 串起來能正確跑完比賽,並且不會因為
// Math.random (用於 y-jitter) 影響戰鬥結果。

const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../../core.js');
const { loadAndApply } = require('../csv-loader');
const { runMatch } = require('../sim');

const data = loadAndApply();
const { units, enemies } = data;

// ----------------------------------------------------------------------------
// 1v1: 爆破騎士 vs grunt 站在同一位置, 應在 ~3.6 秒內擊殺 grunt
// 公式: grunt hp=80, bomber atk=30, attackCd=1.8s -> 3 次攻擊命中 (第 3 hit 在 t≈3.6)
// ----------------------------------------------------------------------------
test('1v1: bomber defeats grunt in ~3.6 seconds at same x', () => {
  const g = new core.GameState();
  g.reset(1);
  g.levelEvents = [];
  g.pendingSpawns = [];

  const atk   = new core.Unit(units.bomber,    'player', 600);
  const grunt = new core.Unit(enemies.grunt,   'enemy',  600);
  g.playerUnits.push(atk);
  g.enemyUnits.push(grunt);

  const dt = 0.05;
  while (grunt.hp > 0 && atk.hp > 0 && g.elapsed < 10) {
    g.update(dt);
  }

  assert.ok(grunt.hp <= 0,  'grunt should be dead');
  assert.ok(atk.hp   >  0,  'bomber should still be alive');
  assert.ok(g.elapsed >= 2.5 && g.elapsed <= 5.0,
    `expected ~3.6s, got ${g.elapsed.toFixed(2)}s`);
});

// ----------------------------------------------------------------------------
// Smoke: level 1 完全不操作 -> 玩家輸 (或 timeout)
// Smoke: level 1 一直召喚最便宜的單位 -> 玩家應該贏
// ----------------------------------------------------------------------------
test('smoke: level 1 with no-op policy ends in lose or timeout', () => {
  const res = runMatch({ level: 1, policy: () => null, maxTime: 180 });
  assert.ok(res.result === 'lose' || res.result === 'timeout',
    `expected lose/timeout, got ${res.result}`);
});

test('smoke: level 1 with constant rusher-backdoor policy wins', () => {
  // 移除了 pierce 之後,常壓 attack 太弱;改用刺客背刺穩贏
  const res = runMatch({
    level: 1,
    deck: ['defender', 'rusher', 'sniper', 'bomber'],
    policy: () => ({ summon: 'rusher' }),
    maxTime: 180,
  });
  assert.equal(res.result, 'win', `expected win, got ${res.result}`);
  assert.ok(res.unitsSummoned.rusher > 0, 'should have summoned at least 1 rusher');
});

// ----------------------------------------------------------------------------
// Determinism: 同樣 policy + 同樣關卡跑兩次, 結果(時間/塔HP)應該完全一樣
// Math.random 用於 y 抖動和螢幕震動,不影響戰鬥邏輯 -> 結果決定性
// ----------------------------------------------------------------------------
test('determinism: same level + policy yields identical outcome twice', () => {
  const policy = () => ({ summon: 'rusher' });
  const opts = {
    level: 1,
    deck: ['defender', 'rusher', 'sniper', 'bomber'],
    policy,
    maxTime: 180,
  };
  const r1 = runMatch(opts);
  const r2 = runMatch(opts);
  assert.equal(r1.result, r2.result);
  assert.equal(r1.elapsedSec, r2.elapsedSec, 'elapsedSec mismatch');
  assert.equal(r1.enemyTowerHpFrac, r2.enemyTowerHpFrac, 'enemyTower mismatch');
  assert.equal(r1.playerTowerHpFrac, r2.playerTowerHpFrac, 'playerTower mismatch');
});

// ----------------------------------------------------------------------------
// 自訂關卡: 用 { events, enemyTowerHp } 注入,避免要動 CSV 才能測新關
// ----------------------------------------------------------------------------
test('custom level: events array overrides default level events', () => {
  const res = runMatch({
    level: {
      events: [{ trigger: 'time', enemy: 'grunt', count: 5, time: 0 }],
      enemyTowerHp: 1000000,    // 不可能打掉
    },
    policy: () => null,
    maxTime: 30,
  });
  // 5 隻 grunt 對玩家塔 hp=1000 持續造成傷害,30s 內應該結束
  assert.notEqual(res.result, 'win', 'player can never win against fortress tower');
});

test('custom level: enemyTowerHp override is respected', () => {
  const res = runMatch({
    level: { events: [], enemyTowerHp: 50 },     // 沒敵人 + 脆塔
    deck: ['defender', 'rusher', 'sniper', 'bomber'],
    policy: () => ({ summon: 'rusher' }),
    maxTime: 60,
  });
  // 沒有敵人擋路, 刺客背刺直接打爆 50HP 脆塔
  assert.equal(res.result, 'win');
});
