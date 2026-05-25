// ========================================================================
// core.js — 純戰鬥邏輯（Unit / Tower / GameState）+ 共用常數與 CSV 解析。
// 規則:本檔不可直接觸碰 DOM、canvas、Audio、localStorage。
// 渲染、音效、存檔由 render.js 提供;headless 工具直接 require 本檔即可。
// ========================================================================

// --- 場地常數 ---
const W = 1280;
const H = 480;
const GROUND_Y = 440;              // 地面 y 座標
const PLAYER_TOWER_X = 1200;
const ENEMY_TOWER_X = 80;
const TOWER_W = 60;
const TOWER_H = 160;
const MONEY_START = 3000;
const MONEY_PER_SEC = 36;
const MONEY_CAP = 5000;
const TOTAL_LEVELS = 5;

let UNIT_DEFS = {};
let ENEMY_DEFS = {};
let LEVEL_EVENTS = {};

const NUMERIC_UNIT_FIELDS = ['cost', 'hp', 'atk', 'speed', 'range', 'attackCd', 'cd', 'size', 'aoe'];
const NUMERIC_ENEMY_FIELDS = ['hp', 'atk', 'speed', 'range', 'attackCd', 'size', 'reward'];
const NUMERIC_LEVEL_FIELDS = ['count', 'time', 'interval', 'start', 'end'];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && quoted && next === '"') {
      value += '"';
      i++;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      row.push(value.trim());
      value = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i++;
      row.push(value.trim());
      if (row.some(cell => cell !== '')) rows.push(row);
      row = [];
      value = '';
    } else {
      value += ch;
    }
  }

  if (value !== '' || row.length > 0) {
    row.push(value.trim());
    if (row.some(cell => cell !== '')) rows.push(row);
  }

  if (rows.length > 0) rows[0][0] = rows[0][0].replace(/^﻿/, '');
  return rows;
}

function rowsToObjects(text) {
  const rows = parseCsv(text).filter(row => !row[0]?.startsWith('#'));
  const headers = rows.shift() || [];
  return rows.map(row => Object.fromEntries(headers.map((key, index) => [key, row[index] ?? ''])));
}

function numberize(obj, fields) {
  for (const field of fields) {
    if (obj[field] !== '') obj[field] = Number(obj[field]);
  }
  return obj;
}

// 由 render（瀏覽器 fetch）或 headless 工具（fs 讀檔）把已解析的 row 灌進來。
function applyGameData({ units, enemies, levels }) {
  UNIT_DEFS = units;
  ENEMY_DEFS = enemies;
  LEVEL_EVENTS = levels;
}

const DECK_MAX = 4;
const HEAL_AURA_INTERVAL = 12;             // 治癒貓 aura 觸發間隔(秒)
const HEAL_SPAWN_FRAC = 0.4;               // 出場立即治癒比例
const KNOCKBACK_DIST = 100;                // 重量貓擊退距離
const BOMB_RADIUS = 180;
const BOMB_DAMAGE = 100;
const SNIPE_DAMAGE = 60;
const PIERCE_BONUS = 30;
const SHIELD_DURATION = 4.0;
const DASH_DURATION = 3.0;

const SKILLS = {
  cannon: {
    name: '手動砲台', cost: 200, cd: 30, color: '#dc2626',
    desc: '擊退並對全體敵人造成 50 傷害',
    fire(game) {
      const damage = 50;
      game.knockbackAllEnemies(200);
      for (const e of game.enemyUnits) {
        if (e.hp <= 0) continue;
        e.takeDamage(damage);
        game.floatingTexts.push({ x: e.x, y: e.y - 20, text: `-${damage}`, t: 0, duration: 0.6, color: '#fb923c' });
      }
      game.shakeTimer = Math.max(game.shakeTimer, 0.35);
      game.summonEffects.push({ x: PLAYER_TOWER_X, y: GROUND_Y - TOWER_H / 2, t: 0, duration: 0.7, color: 'orange' });
      Sound.bossAttack();
    },
  },
  shield: {
    name: '全體無敵', cost: 300, cd: 25, color: '#fbbf24',
    desc: '所有貓無敵 1 秒',
    fire(game) {
      for (const u of game.playerUnits) u.invincibleTimer = 1.0;
      game.summonEffects.push({ x: PLAYER_TOWER_X, y: GROUND_Y - TOWER_H / 2, t: 0, duration: 0.6, color: 'yellow' });
      Sound.spawnBoss();
    },
  },
  retreat: {
    name: '戰術後撤', cost: 150, cd: 20, color: '#a855f7',
    desc: '所有我方單位後退 150',
    fire(game) {
      game.retreatAllPlayers(150);
      game.summonEffects.push({ x: PLAYER_TOWER_X, y: GROUND_Y - TOWER_H / 2, t: 0, duration: 0.5, color: 'purple' });
      Sound.towerHit();
    },
  },
};

// ========================================================================
// Sound / SaveData：core 預設用 no-op，render.js 載入時會覆寫成真實實作。
// 用 let 是為了讓 render 可以從另一支 script 中重新賦值（共享 script scope）。
// ========================================================================
let Sound = {
  bgmStart() {}, bgmStop() {},
  spawn() {}, spawnBoss() {},
  attack() {}, bossAttack() {},
  towerHit() {}, kill() {},
  victory() {}, defeat() {},
  click() {},
  setEnabled() {}, isEnabled() { return true; }, resume() {},
};

let SaveData = {
  load() { return null; },
  save() {},
};

// ========================================================================
// Unit:玩家方與敵方共用的基本單位類別
// ========================================================================
class Unit {
  constructor(def, team, x) {
    this.def = def;
    this.team = team;                       // 'player' | 'enemy'
    this.x = x;
    // y 加一點隨機抖動,避免單位完全重疊
    this.y = GROUND_Y - 22 - Math.random() * 50;
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.attackTimer = 0;                   // 攻擊冷卻倒數
    this.flashTimer = 0;                    // 受擊閃白
    this.attackFlash = 0;                   // 攻擊閃光(畫線用)
    this.lastTargetPos = null;
    this.shieldTimer = 0;                   // 防禦貓減傷
    this.dashTimer = 0;                     // 衝鋒貓加速
    this.auraTimer = 0;                     // 治癒貓 aura 倒數
    this.invincibleTimer = 0;               // 全體無敵技能
  }

  takeDamage(amount) {
    if (this.invincibleTimer > 0) {
      this.flashTimer = 0.12;
      return 0;
    }
    const reduced = this.shieldTimer > 0 ? amount * 0.5 : amount;
    this.hp -= reduced;
    this.flashTimer = 0.12;
    return reduced;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  get dir() { return this.team === 'player' ? -1 : 1; }

  // 找出攻擊範圍內最近的敵方目標(不分前後,避免召喚時被 enemy 包夾走過頭)
  findTarget(game) {
    const enemyUnits = this.team === 'player' ? game.enemyUnits : game.playerUnits;
    const enemyTower = this.team === 'player' ? game.enemyTower : game.playerTower;

    let best = null;
    let bestDist = Infinity;

    for (const e of enemyUnits) {
      if (e.hp <= 0) continue;
      const dist = Math.abs(e.x - this.x);
      if (dist <= this.def.range && dist < bestDist) {
        best = e; bestDist = dist;
      }
    }

    if (enemyTower.hp > 0) {
      const dist = Math.abs(enemyTower.x - this.x);
      if (dist <= this.def.range && dist < bestDist) {
        best = enemyTower; bestDist = dist;
      }
    }

    return best;
  }

  update(dt, game) {
    if (this.hp <= 0) return;

    this.flashTimer      = Math.max(0, this.flashTimer      - dt);
    this.attackFlash     = Math.max(0, this.attackFlash     - dt);
    this.shieldTimer     = Math.max(0, this.shieldTimer     - dt);
    this.dashTimer       = Math.max(0, this.dashTimer       - dt);
    this.invincibleTimer = Math.max(0, this.invincibleTimer - dt);

    // 治癒貓 aura:出場後每 HEAL_AURA_INTERVAL 秒治癒全體友軍
    if (this.def.ability === 'heal' && this.team === 'player') {
      this.auraTimer -= dt;
      if (this.auraTimer <= 0) {
        game.healAllAllies(0.2, this);
        this.auraTimer = HEAL_AURA_INTERVAL;
      }
    }

    const target = this.findTarget(game);

    if (target) {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.attack(target, game);
        this.attackTimer = this.def.attackCd;
      }
    } else {
      const speedMul = this.dashTimer > 0 ? 1.8 : 1.0;
      this.x += this.dir * this.def.speed * speedMul * dt;
      this.attackTimer = Math.max(0, this.attackTimer - dt);
    }
  }

  attack(target, game) {
    target.takeDamage(this.def.atk);
    if (this.def.aoe > 0) {
      const others = this.team === 'player' ? game.enemyUnits : game.playerUnits;
      const enemyTower = this.team === 'player' ? game.enemyTower : game.playerTower;
      for (const e of others) {
        if (e === target || e.hp <= 0) continue;
        if (Math.abs(e.x - target.x) <= this.def.aoe) e.takeDamage(this.def.atk);
      }
      if (enemyTower !== target && enemyTower.hp > 0 && Math.abs(enemyTower.x - target.x) <= this.def.aoe) {
        enemyTower.takeDamage(this.def.atk);
      }
    }
    this.attackFlash = this.def.boss ? 0.28 : 0.18;
    this.lastTargetPos = { x: target.x, y: target.y };
    if (target instanceof Tower) {
      if (target.team === 'player' && !game.playerTowerHitTriggered) {
        game.playerTowerHitTriggered = true;
        game.fireTriggerEvents('tower_hit');
      } else if (target.team === 'enemy' && !game.enemyTowerHitTriggered) {
        game.enemyTowerHitTriggered = true;
        game.fireTriggerEvents('enemy_tower_hit');
      }
    }
    if (target instanceof Tower) {
      Sound.towerHit();
    } else if (this.def.boss) {
      Sound.bossAttack();
    } else {
      Sound.attack();
    }
    if (this.def.boss) {
      game.shakeTimer = Math.max(game.shakeTimer, 0.18);
    }
  }

  draw(ctx) {
    const { size, shape, color } = this.def;
    const fill = this.flashTimer > 0 ? '#ffffff' : color;

    // 護盾光圈
    if (this.shieldTimer > 0) {
      const alpha = Math.min(1, this.shieldTimer / SHIELD_DURATION) * 0.65;
      ctx.strokeStyle = `rgba(96, 165, 250, ${alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, size / 2 + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 無敵光圈
    if (this.invincibleTimer > 0) {
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(this.x, this.y, size / 2 + 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 衝刺殘影
    if (this.dashTimer > 0) {
      const trail = Math.min(1, this.dashTimer / DASH_DURATION);
      ctx.fillStyle = `rgba(253, 224, 71, ${trail * 0.4})`;
      for (let i = 1; i <= 3; i++) {
        const tx = this.x - this.dir * i * 8;
        ctx.beginPath();
        ctx.arc(tx, this.y, size / 2 - i, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = fill;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;

    if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(this.x, this.y, size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (shape === 'triangle') {
      const d = this.dir;
      ctx.beginPath();
      ctx.moveTo(this.x + d * size / 2,  this.y);
      ctx.lineTo(this.x - d * size / 2,  this.y - size / 2);
      ctx.lineTo(this.x - d * size / 2,  this.y + size / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(this.x - size / 2, this.y - size / 2, size, size);
      ctx.strokeRect(this.x - size / 2, this.y - size / 2, size, size);
    }

    // 單位頭頂血條
    const barW = Math.max(size, 24);
    const barH = 3;
    const barY = this.y - size / 2 - 7;
    const frac = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(this.x - barW / 2, barY, barW, barH);
    ctx.fillStyle = frac > 0.5 ? '#4ade80' : frac > 0.25 ? '#facc15' : '#ef4444';
    ctx.fillRect(this.x - barW / 2, barY, barW * frac, barH);

    // 攻擊閃光線
    if (this.attackFlash > 0 && this.lastTargetPos) {
      const isBoss = this.def.boss;
      ctx.strokeStyle = isBoss ? '#d8b4fe' : (this.team === 'player' ? '#93c5fd' : '#fca5a5');
      ctx.lineWidth = isBoss ? 8 : 4;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = isBoss ? 18 : 8;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.lastTargetPos.x, this.lastTargetPos.y);
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (this.def.aoe > 0) {
        ctx.fillStyle = isBoss ? 'rgba(216, 180, 254, 0.35)' : 'rgba(251, 146, 60, 0.35)';
        ctx.beginPath();
        ctx.arc(this.lastTargetPos.x, this.lastTargetPos.y, this.def.aoe, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// ========================================================================
// Tower:可被攻擊的靜態目標
// ========================================================================
class Tower {
  constructor(team, x, hp) {
    this.team = team;
    this.x = x;
    this.y = GROUND_Y - TOWER_H / 2;        // 給攻擊閃光線用
    this.hp = hp;
    this.maxHp = hp;
    this.flashTimer = 0;
  }

  takeDamage(amount) {
    this.hp -= amount;
    this.flashTimer = 0.12;
    return amount;
  }

  update(dt) {
    this.flashTimer = Math.max(0, this.flashTimer - dt);
  }

  draw(ctx) {
    const w = TOWER_W;
    const h = TOWER_H;
    const top = GROUND_Y - h;

    // 塔身
    ctx.fillStyle = this.flashTimer > 0
      ? '#ffffff'
      : (this.team === 'player' ? '#1e40af' : '#7f1d1d');
    ctx.fillRect(this.x - w / 2, top, w, h);

    // 塔頂裝飾
    ctx.fillStyle = this.team === 'player' ? '#60a5fa' : '#f87171';
    ctx.fillRect(this.x - w / 2 - 6, top - 14, w + 12, 14);

    // 邊框
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.x - w / 2, top, w, h);

    // 血量數字（塔頂）
    const hp = Math.max(0, Math.floor(this.hp));
    const hpText = `${hp}/${this.maxHp}`;
    const textY = top - 36;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    const padding = 6;
    const textW = ctx.measureText(hpText).width + padding * 2;
    ctx.fillRect(this.x - textW / 2, textY - 11, textW, 22);
    ctx.fillStyle = this.team === 'player' ? '#93c5fd' : '#fca5a5';
    ctx.fillText(hpText, this.x, textY);

    // 塔頂血條
    const barW = 110;
    const barH = 7;
    const barY = top - 18;
    const frac = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = '#000';
    ctx.fillRect(this.x - barW / 2 - 1, barY - 1, barW + 2, barH + 2);
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(this.x - barW / 2, barY, barW, barH);
    ctx.fillStyle = frac > 0.5 ? '#4ade80' : frac > 0.25 ? '#facc15' : '#ef4444';
    ctx.fillRect(this.x - barW / 2, barY, barW * frac, barH);
  }
}

// ========================================================================
// GameState:整場比賽的狀態管理
// ========================================================================
class GameState {
  constructor() {
    const saved = SaveData.load();
    this.level = 1;
    this.deck = this.sanitizeDeck(saved?.deck);
    this.levelStars = saved?.levelStars ?? {};
    this.screen = 'map';
    this.reset(1);
    this.screen = 'map';
  }

  sanitizeDeck(deck) {
    const all = Object.keys(UNIT_DEFS);
    if (!deck || deck.length === 0) return all.slice(0, DECK_MAX);
    return deck.filter(k => UNIT_DEFS[k]).slice(0, DECK_MAX);
  }

  persist() {
    SaveData.save({
      soundEnabled: Sound.isEnabled(),
      deck: this.deck,
      levelStars: this.levelStars,
    });
  }

  toggleDeck(key) {
    if (!UNIT_DEFS[key]) return false;
    const idx = this.deck.indexOf(key);
    if (idx >= 0) {
      this.deck.splice(idx, 1);
    } else {
      if (this.deck.length >= DECK_MAX) return false;
      this.deck.push(key);
    }
    this.persist();
    return true;
  }

  reset(level = this.level || 1) {
    this.level = level;
    this.screen = 'playing';
    const enemyTowerHpByLevel = { 1: 1800, 2: 2500, 3: 3000, 4: 3600, 5: 4400 };
    this.playerTower = new Tower('player', PLAYER_TOWER_X, 1000);
    this.enemyTower  = new Tower('enemy',  ENEMY_TOWER_X,  enemyTowerHpByLevel[this.level] || 1800);
    this.playerUnits = [];
    this.enemyUnits  = [];
    this.money = MONEY_START;
    this.elapsed = 0;
    this.cooldowns = {};
    for (const key of Object.keys(UNIT_DEFS)) this.cooldowns[key] = 0;
    this.levelEvents = (LEVEL_EVENTS[this.level] || []).map(event => ({ ...event }));
    this.pendingSpawns = [];                // {time, type}
    this.playerTowerHitTriggered = false;
    this.enemyTowerHitTriggered = false;
    this.summonEffects = [];                // {x, y, t, duration}
    this.floatingTexts = [];                // {x, y, text, t, duration}
    this.purpleFlash = 0;
    this.shakeTimer = 0;
    this.gameOver = false;
    this.winner = null;
    this.paused = false;
    this.skillCds = {};
    for (const k of Object.keys(SKILLS)) this.skillCds[k] = 0;
    this.earnedStars = 0;
  }

  goToMap() {
    this.screen = 'map';
    Sound.bgmStop();
  }

  startLevel(level) {
    this.reset(level);
    Sound.bgmStart();
    return true;
  }

  trySkill(key) {
    const skill = SKILLS[key];
    if (!skill) return false;
    if (this.screen !== 'playing') return false;
    if (this.gameOver) return false;
    if (this.skillCds[key] > 0) return false;
    if (this.money < skill.cost) return false;
    this.money -= skill.cost;
    this.skillCds[key] = skill.cd;
    skill.fire(this);
    return true;
  }

  // 玩家按下召喚按鈕
  trySpawnPlayer(type) {
    if (this.screen !== 'playing') return false;
    if (this.gameOver) return false;
    if (!this.deck.includes(type)) return false;
    const def = UNIT_DEFS[type];
    if (!def) return false;
    if (this.money < def.cost) return false;
    if (this.cooldowns[type] > 0) return false;

    this.money -= def.cost;
    this.cooldowns[type] = def.cd;
    const spawnX = PLAYER_TOWER_X - TOWER_W / 2 - 10;
    const unit = new Unit(def, 'player', spawnX);
    this.playerUnits.push(unit);
    this.applySpawnAbility(unit, def);
    return true;
  }

  applySpawnAbility(unit, def) {
    const x = unit.x;
    const y = unit.y;
    switch (def.ability) {
      case 'pierce': {
        const t = this.nearestEnemy(x);
        if (t) {
          t.takeDamage(PIERCE_BONUS);
          this.floatingTexts.push({ x: t.x, y: t.y - 20, text: `-${PIERCE_BONUS}`, t: 0, duration: 0.6, color: '#fbbf24' });
        }
        Sound.spawn();
        break;
      }
      case 'shield': {
        unit.shieldTimer = SHIELD_DURATION;
        this.summonEffects.push({ x, y, t: 0, duration: 0.5, color: 'blue' });
        Sound.spawn();
        break;
      }
      case 'dash': {
        unit.dashTimer = DASH_DURATION;
        this.summonEffects.push({ x, y, t: 0, duration: 0.4, color: 'yellow' });
        Sound.spawn();
        break;
      }
      case 'snipe': {
        const t = this.farthestEnemy();
        if (t) {
          t.takeDamage(SNIPE_DAMAGE);
          this.floatingTexts.push({ x: t.x, y: t.y - 20, text: `-${SNIPE_DAMAGE}`, t: 0, duration: 0.6, color: '#fbbf24' });
          unit.attackFlash = 0.3;
          unit.lastTargetPos = { x: t.x, y: t.y };
        }
        Sound.spawn();
        break;
      }
      case 'heal': {
        this.healAllAllies(HEAL_SPAWN_FRAC, unit);
        unit.auraTimer = HEAL_AURA_INTERVAL;
        this.summonEffects.push({ x, y, t: 0, duration: 0.6, color: 'green' });
        Sound.spawn();
        break;
      }
      case 'knockback': {
        this.knockbackAllEnemies(KNOCKBACK_DIST);
        this.summonEffects.push({ x, y, t: 0, duration: 0.55, color: 'orange' });
        this.shakeTimer = Math.max(this.shakeTimer, 0.2);
        Sound.towerHit();
        break;
      }
      case 'bomb': {
        this.bombAt(x, BOMB_RADIUS, BOMB_DAMAGE);
        this.summonEffects.push({ x, y, t: 0, duration: 0.5, color: 'red' });
        this.shakeTimer = Math.max(this.shakeTimer, 0.18);
        Sound.bossAttack();
        break;
      }
      case 'shake':
      default: {
        if (def.boss) {
          this.purpleFlash = 0.3;
          this.summonEffects.push({ x, y, t: 0, duration: 0.55, color: 'purple' });
          Sound.spawnBoss();
        } else {
          Sound.spawn();
        }
        break;
      }
    }
  }

  nearestEnemy(x) {
    let best = null;
    let bestDist = Infinity;
    for (const e of this.enemyUnits) {
      if (e.hp <= 0) continue;
      const d = Math.abs(e.x - x);
      if (d < bestDist) { best = e; bestDist = d; }
    }
    return best;
  }

  farthestEnemy() {
    let best = null;
    let bestX = Infinity;        // 敵人從左進場,x 越小越遠離我方塔
    for (const e of this.enemyUnits) {
      if (e.hp <= 0) continue;
      if (e.x < bestX) { best = e; bestX = e.x; }
    }
    return best;
  }

  healAllAllies(fraction, source) {
    for (const u of this.playerUnits) {
      if (u.hp <= 0) continue;
      const amount = u.maxHp * fraction;
      const before = u.hp;
      u.heal(amount);
      const healed = Math.floor(u.hp - before);
      if (healed > 0) {
        this.floatingTexts.push({ x: u.x, y: u.y - u.def.size / 2 - 6, text: `+${healed}`, t: 0, duration: 0.6, color: '#4ade80' });
      }
    }
    if (source) {
      this.summonEffects.push({ x: source.x, y: source.y, t: 0, duration: 0.45, color: 'green' });
    }
  }

  knockbackAllEnemies(distance) {
    for (const e of this.enemyUnits) {
      if (e.hp <= 0) continue;
      e.x -= distance;
      e.flashTimer = 0.15;
      e.attackTimer = Math.max(e.attackTimer, 0.3);    // 被擊退後短暫無法立刻攻擊
    }
  }

  // 戰術後撤:我方單位往玩家塔方向(右)位移,可超過塔位置。
  retreatAllPlayers(distance) {
    for (const u of this.playerUnits) {
      if (u.hp <= 0) continue;
      u.x += distance;
      u.flashTimer = 0.15;
      u.attackTimer = Math.max(u.attackTimer, 0.3);
    }
  }

  bombAt(x, radius, damage) {
    for (const e of this.enemyUnits) {
      if (e.hp <= 0) continue;
      if (Math.abs(e.x - x) <= radius) {
        e.takeDamage(damage);
        this.floatingTexts.push({ x: e.x, y: e.y - 20, text: `-${damage}`, t: 0, duration: 0.6, color: '#fb923c' });
      }
    }
  }

  spawnEnemy(type) {
    const def = ENEMY_DEFS[type];
    if (!def) return;
    // 敵塔在左邊,單位從敵塔右側 spawn 往右走
    this.enemyUnits.push(new Unit(def, 'enemy', ENEMY_TOWER_X + TOWER_W / 2 + 10));
    if (def.boss) {
      Sound.spawnBoss();
      this.shakeTimer = Math.max(this.shakeTimer, 0.4);
      this.purpleFlash = 0.4;
    }
  }

  queueEnemySpawn(type, count = 1) {
    const safeCount = Math.max(1, Number(count) || 1);
    for (let i = 0; i < safeCount; i++) {
      this.pendingSpawns.push({ time: this.elapsed + i * 0.4, type });
    }
  }

  fireTriggerEvents(trigger) {
    for (const event of this.levelEvents) {
      if (event.trigger !== trigger || event.fired) continue;
      event.fired = true;
      this.queueEnemySpawn(event.enemy, event.count);
    }
  }

  updateLevelEvents() {
    for (const event of this.levelEvents) {
      if (event.trigger === 'time') {
        if (!event.fired && this.elapsed >= event.time) {
          event.fired = true;
          this.queueEnemySpawn(event.enemy, event.count);
        }
      } else if (event.trigger === 'loop') {
        const start = event.start || event.interval || 1;
        const interval = event.interval || 1;
        if (event.nextTime === null) event.nextTime = start;
        while (this.elapsed >= event.nextTime && (!event.end || event.nextTime <= event.end)) {
          this.queueEnemySpawn(event.enemy, event.count);
          event.nextTime += interval;
        }
      }
    }
  }

  update(dt) {
    if (this.screen === 'map') return;
    if (this.paused) return;

    if (this.gameOver) {
      return;
    }

    this.elapsed += dt;
    this.money = Math.min(MONEY_CAP, this.money + MONEY_PER_SEC * dt);
    this.purpleFlash = Math.max(0, this.purpleFlash - dt);
    this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    for (const fx of this.summonEffects) fx.t += dt;
    for (const ft of this.floatingTexts) ft.t += dt;
    this.summonEffects = this.summonEffects.filter(fx => fx.t < fx.duration);
    this.floatingTexts = this.floatingTexts.filter(ft => ft.t < ft.duration);

    // 召喚冷卻減少
    for (const key of Object.keys(this.cooldowns)) {
      this.cooldowns[key] = Math.max(0, this.cooldowns[key] - dt);
    }
    for (const key of Object.keys(this.skillCds)) {
      this.skillCds[key] = Math.max(0, this.skillCds[key] - dt);
    }

    this.updateLevelEvents();

    // 處理已到時間的 pending spawn
    this.pendingSpawns = this.pendingSpawns.filter(s => {
      if (this.elapsed >= s.time) { this.spawnEnemy(s.type); return false; }
      return true;
    });

    // 更新單位與塔
    for (const u of this.playerUnits) u.update(dt, this);
    for (const u of this.enemyUnits)  u.update(dt, this);
    this.playerTower.update(dt);
    this.enemyTower.update(dt);

    // 敵人死亡:加錢 + 金額浮字 + 音效
    for (const u of this.enemyUnits) {
      if (u.hp <= 0 && !u.killRewarded) {
        u.killRewarded = true;
        const reward = u.def.reward || 5;
        this.money = Math.min(MONEY_CAP, this.money + reward);
        this.floatingTexts.push({ x: u.x, y: u.y - u.def.size / 2, text: `+${reward}`, t: 0, duration: 0.5 });
        Sound.kill();
      }
    }

    // 移除死亡單位
    this.playerUnits = this.playerUnits.filter(u => u.hp > 0);
    this.enemyUnits  = this.enemyUnits.filter(u => u.hp > 0);

    // 勝負判定
    if (this.playerTower.hp <= 0) {
      this.gameOver = true;
      this.winner = 'enemy';
      Sound.bgmStop();
      Sound.defeat();
    } else if (this.enemyTower.hp <= 0) {
      this.gameOver = true;
      this.winner = 'player';
      this.earnedStars = this.playerTowerHitTriggered ? 1 : 2;
      const prev = this.levelStars[this.level] || 0;
      this.levelStars[this.level] = Math.max(prev, this.earnedStars);
      this.persist();
      Sound.bgmStop();
      Sound.victory();
    }
  }

  draw(ctx) {
    const shakeAmount = this.shakeTimer > 0 ? 5 : 0;
    const shakeX = shakeAmount ? (Math.random() - 0.5) * shakeAmount : 0;
    const shakeY = shakeAmount ? (Math.random() - 0.5) * shakeAmount : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);

    // --- 背景 ---
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0,   '#0f172a');
    grad.addColorStop(0.7, '#1e293b');
    grad.addColorStop(1,   '#334155');
    ctx.fillStyle = grad;
    ctx.fillRect(-10, -10, W + 20, H + 20);

    // 遠景山(裝飾)
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    for (let x = 0; x <= W; x += 80) {
      const h = 60 + (Math.sin(x * 0.013) * 30 + Math.cos(x * 0.007) * 20);
      ctx.lineTo(x, GROUND_Y - h);
    }
    ctx.lineTo(W, GROUND_Y);
    ctx.closePath();
    ctx.fill();

    // 地面
    ctx.fillStyle = '#3f3f46';
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = '#52525b';
    ctx.fillRect(0, GROUND_Y, W, 3);

    // --- 塔 ---
    this.playerTower.draw(ctx);
    this.enemyTower.draw(ctx);

    // --- 單位(用 y 排序讓下面的後畫,有點層次)---
    const all = [...this.playerUnits, ...this.enemyUnits].sort((a, b) => a.y - b.y);
    for (const u of all) u.draw(ctx);

    // --- 召喚特效 (按 color 變換) ---
    const fxPalette = {
      purple: { ring: '196, 181, 253', fill: '139, 92, 246', maxR: 105 },
      green:  { ring: '134, 239, 172', fill: '34, 197, 94',  maxR: 130 },
      orange: { ring: '253, 186, 116', fill: '249, 115, 22', maxR: 160 },
      red:    { ring: '252, 165, 165', fill: '239, 68, 68',  maxR: BOMB_RADIUS },
      blue:   { ring: '147, 197, 253', fill: '59, 130, 246', maxR: 80 },
      yellow: { ring: '253, 224, 71',  fill: '234, 179, 8',  maxR: 70 },
    };
    for (const fx of this.summonEffects) {
      const p = fx.t / fx.duration;
      const pal = fxPalette[fx.color] || fxPalette.purple;
      const radius = 18 + p * pal.maxR;
      ctx.strokeStyle = `rgba(${pal.ring}, ${1 - p})`;
      ctx.lineWidth = 7 * (1 - p) + 2;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(${pal.fill}, ${(1 - p) * 0.28})`;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, radius * 0.65, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const ft of this.floatingTexts) {
      const p = ft.t / ft.duration;
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = ft.color || '#fbbf24';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ft.text, ft.x, ft.y - p * 32);
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // --- HUD ---
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, W, 40);

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`💰 $${Math.floor(this.money)}`, 16, 20);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '14px sans-serif';
    ctx.fillText(`第 ${this.level} 關`, 156, 20);
    ctx.fillText(`時間 ${this.elapsed.toFixed(1)}s`, 230, 20);

    if (this.purpleFlash > 0) {
      const alpha = this.purpleFlash / 0.3;
      ctx.strokeStyle = `rgba(168, 85, 247, ${alpha})`;
      ctx.lineWidth = 26;
      ctx.strokeRect(13, 13, W - 26, H - 26);
    }

    // --- Game Over 覆蓋 ---
    if (this.gameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = this.winner === 'player' ? '#4ade80' : '#ef4444';
      ctx.font = 'bold 96px sans-serif';
      ctx.fillText(this.winner === 'player' ? '勝利!' : '失敗...', W / 2, H / 2 - 60);

      if (this.winner === 'player') {
        ctx.font = 'bold 48px sans-serif';
        const starW = ctx.measureText('★').width;
        const gap = 16;
        const totalW = starW * 2 + gap;
        let starX = W / 2 - totalW / 2 + starW / 2;
        for (let i = 0; i < 2; i++) {
          ctx.fillStyle = i < this.earnedStars ? '#fbbf24' : '#4b5563';
          ctx.fillText('★', starX, H / 2 + 30);
          starX += starW + gap;
        }
      }

      ctx.fillStyle = '#e5e7eb';
      ctx.font = '20px sans-serif';
      let subtitle = '';
      if (this.winner === 'player') {
        if (this.level >= TOTAL_LEVELS) subtitle = '全部關卡通關!';
      } else {
        subtitle = '請選擇下方按鈕';
      }
      if (subtitle) ctx.fillText(subtitle, W / 2, H / 2 + 95);
    }
  }
}

// ========================================================================
// 對外 export — Node 走 module.exports,瀏覽器走 globalThis.Core。
// 兩個都讓 sim.js / bots.js / evaluator.js 等 UMD 工具拿得到 core 物件。
// 注意:render.js 不透過 Core,它直接用同一 script scope 的 GameState 等 class。
// ========================================================================
const _coreExports = {
  Unit, Tower, GameState,
  parseCsv, rowsToObjects, numberize, applyGameData,
  setSound:    (s) => { Sound = s; },
  setSaveData: (s) => { SaveData = s; },
  constants: {
    W, H, GROUND_Y, PLAYER_TOWER_X, ENEMY_TOWER_X, TOWER_W, TOWER_H,
    MONEY_START, MONEY_PER_SEC, MONEY_CAP,
    DECK_MAX, TOTAL_LEVELS,
    HEAL_AURA_INTERVAL, HEAL_SPAWN_FRAC,
    KNOCKBACK_DIST, BOMB_RADIUS, BOMB_DAMAGE,
    SNIPE_DAMAGE, PIERCE_BONUS, SHIELD_DURATION, DASH_DURATION,
  },
  SKILLS,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = _coreExports;
} else if (typeof globalThis !== 'undefined') {
  globalThis.Core = _coreExports;
}
