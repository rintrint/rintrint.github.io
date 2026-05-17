// ========================================================================
// 塔防 Prototype — 純 Canvas 2D
// 主要元件:Unit、Tower、GameState、UI/主迴圈
// ========================================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// --- 場地常數 ---
const W = 1280;
const H = 480;
const GROUND_Y = 440;              // 地面 y 座標
const PLAYER_TOWER_X = 1200;
const ENEMY_TOWER_X = 80;
const TOWER_W = 60;
const TOWER_H = 160;
const MONEY_START = 200;
const MONEY_PER_SEC = 18;
const MONEY_CAP = 5000;

let UNIT_DEFS = {};
let ENEMY_DEFS = {};
let LEVEL_EVENTS = {};

const NUMERIC_UNIT_FIELDS = ['cost', 'hp', 'atk', 'speed', 'range', 'attackCd', 'cd', 'size', 'tier'];
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

  if (rows.length > 0) rows[0][0] = rows[0][0].replace(/^\uFEFF/, '');
  return rows;
}

function rowsToObjects(text) {
  const rows = parseCsv(text).filter(row => !row[0]?.startsWith('#'));
  const headers = rows.shift() || [];
  return rows.map(row => Object.fromEntries(headers.map((key, index) => [key, row[index] ?? ''])));
}

async function loadCsv(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`CSV 載入失敗: ${path}`);
  return rowsToObjects(await res.text());
}

function numberize(obj, fields) {
  for (const field of fields) {
    if (obj[field] !== '') obj[field] = Number(obj[field]);
  }
  return obj;
}

async function loadGameData() {
  const [unitRows, enemyRows, level1Rows, level2Rows, level3Rows] = await Promise.all([
    loadCsv('data/units.csv'),
    loadCsv('data/enemies.csv'),
    loadCsv('data/level1.csv'),
    loadCsv('data/level2.csv'),
    loadCsv('data/level3.csv'),
  ]);

  UNIT_DEFS = Object.fromEntries(unitRows.map(row => {
    const def = numberize({ ...row, boss: row.boss === 'true' }, NUMERIC_UNIT_FIELDS);
    return [def.id, def];
  }));

  ENEMY_DEFS = Object.fromEntries(enemyRows.map(row => {
    const def = numberize({ ...row }, NUMERIC_ENEMY_FIELDS);
    return [def.id, def];
  }));

  LEVEL_EVENTS = {
    1: level1Rows.map(row => numberize({ ...row, fired: false, nextTime: null }, NUMERIC_LEVEL_FIELDS)),
    2: level2Rows.map(row => numberize({ ...row, fired: false, nextTime: null }, NUMERIC_LEVEL_FIELDS)),
    3: level3Rows.map(row => numberize({ ...row, fired: false, nextTime: null }, NUMERIC_LEVEL_FIELDS)),
  };
}

const TOTAL_LEVELS = 3;
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

const ABILITY_DESC = {
  pierce:    '出場對最近敵人 +30 傷害',
  shield:    '出場 4 秒減傷 50%',
  dash:      '出場 3 秒移速 +80%',
  snipe:    `出場狙擊最遠敵人 ${SNIPE_DAMAGE} 傷害`,
  heal:      '出場+定期治癒友軍',
  knockback: '出場擊退所有敵人',
  bomb:      '出場範圍爆炸',
  shake:     '出場震撼全場',
  none:      '',
};

// ========================================================================
// SaveData:把進度存到 localStorage,避免 F5 後關卡解鎖狀態歸零
// ========================================================================
const SAVE_KEY = 'cat-tower-defense-save-v1';
const SaveData = {
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return {
        unlockedLevel: Math.min(TOTAL_LEVELS, Math.max(1, Number(data.unlockedLevel) || 1)),
        soundEnabled: data.soundEnabled !== false,
        deck: Array.isArray(data.deck) ? data.deck.slice(0, DECK_MAX) : null,
      };
    } catch (error) {
      return null;
    }
  },
  save(data) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (error) {
      // localStorage 不可用(隱私模式 / quota 滿)時靜默略過
    }
  },
};

// ========================================================================
// Sound:用 WebAudio 合成簡單音效
// ========================================================================
const Sound = (() => {
  let ctx = null;
  let enabled = true;

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone({ freq = 440, type = 'sine', dur = 0.15, gain = 0.2, freqEnd = null, delay = 0 }) {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise({ dur = 0.18, gain = 0.18, delay = 0, bandpass = null }) {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = src;
    if (bandpass) {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = bandpass;
      bp.Q.value = 1.2;
      src.connect(bp);
      node = bp;
    }
    node.connect(g);
    g.connect(c.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  // ---- BGM (合成 chord progression loop) ----
  const noteHz = midi => 440 * Math.pow(2, (midi - 69) / 12);
  const CHORDS = [
    { bass: 45, notes: [57, 60, 64] }, // Am
    { bass: 41, notes: [53, 57, 60] }, // F
    { bass: 48, notes: [60, 64, 67] }, // C
    { bass: 43, notes: [55, 59, 62] }, // G
  ];
  const BPM = 96;
  const STEP_DUR = 60 / BPM / 2;       // 8th 音符
  const STEPS_PER_CHORD = 8;
  const ARPEGGIO_STEPS = [0, 2, 4, 6, 3, 5, 7, 1];

  let bgmPlaying = false;
  let bgmNextTime = 0;
  let bgmStep = 0;
  let bgmTimer = null;
  let bgmMaster = null;

  function bgmNote(c, type, freq, time, dur, gain) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(g);
    g.connect(bgmMaster);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  function scheduleBgmStep(c, step, t) {
    const chordIdx = Math.floor(step / STEPS_PER_CHORD) % CHORDS.length;
    const inChord = step % STEPS_PER_CHORD;
    const chord = CHORDS[chordIdx];

    if (inChord === 0 || inChord === 4) {
      bgmNote(c, 'sine', noteHz(chord.bass), t, 0.5, 0.32);
      bgmNote(c, 'sine', noteHz(chord.bass - 12), t, 0.55, 0.18);
    }
    const arpIdx = ARPEGGIO_STEPS[inChord];
    const arpNote = chord.notes[arpIdx % chord.notes.length] + 12;
    bgmNote(c, 'triangle', noteHz(arpNote), t, 0.28, 0.14);
    if (inChord === 0) {
      bgmNote(c, 'triangle', noteHz(chord.notes[0] + 24), t, 0.35, 0.10);
    }
  }

  function bgmScheduler() {
    if (!bgmPlaying) return;
    const c = ensureCtx();
    if (!c) return;
    while (bgmNextTime < c.currentTime + 0.2) {
      scheduleBgmStep(c, bgmStep, bgmNextTime);
      bgmStep = (bgmStep + 1) % (STEPS_PER_CHORD * CHORDS.length);
      bgmNextTime += STEP_DUR;
    }
  }

  function bgmStart() {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c || bgmPlaying) return;
    if (!bgmMaster) {
      bgmMaster = c.createGain();
      bgmMaster.gain.value = 0.55;
      bgmMaster.connect(c.destination);
    }
    bgmMaster.gain.cancelScheduledValues(c.currentTime);
    bgmMaster.gain.setValueAtTime(0, c.currentTime);
    bgmMaster.gain.linearRampToValueAtTime(0.55, c.currentTime + 0.4);
    bgmPlaying = true;
    bgmStep = 0;
    bgmNextTime = c.currentTime + 0.05;
    bgmTimer = setInterval(bgmScheduler, 60);
  }

  function bgmStop() {
    if (!bgmPlaying) return;
    bgmPlaying = false;
    if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
    if (bgmMaster && ctx) {
      bgmMaster.gain.cancelScheduledValues(ctx.currentTime);
      bgmMaster.gain.setValueAtTime(bgmMaster.gain.value, ctx.currentTime);
      bgmMaster.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    }
  }

  return {
    setEnabled(v) {
      enabled = !!v;
      if (!enabled) bgmStop();
    },
    isEnabled() { return enabled; },
    resume() { ensureCtx(); },
    bgmStart,
    bgmStop,
    spawn() { tone({ freq: 520, freqEnd: 760, type: 'triangle', dur: 0.12, gain: 0.18 }); },
    spawnBoss() {
      tone({ freq: 110, freqEnd: 60, type: 'sawtooth', dur: 0.5, gain: 0.32 });
      tone({ freq: 320, freqEnd: 80, type: 'square', dur: 0.45, gain: 0.18, delay: 0.05 });
      noise({ dur: 0.4, gain: 0.18, delay: 0.05, bandpass: 600 });
    },
    attack() { tone({ freq: 900, freqEnd: 450, type: 'square', dur: 0.06, gain: 0.07 }); },
    bossAttack() {
      tone({ freq: 220, freqEnd: 70, type: 'sawtooth', dur: 0.25, gain: 0.22 });
      noise({ dur: 0.18, gain: 0.12, bandpass: 400 });
    },
    towerHit() { noise({ dur: 0.18, gain: 0.22, bandpass: 220 }); },
    kill() { tone({ freq: 700, freqEnd: 1200, type: 'triangle', dur: 0.09, gain: 0.1 }); },
    victory() {
      tone({ freq: 523, type: 'triangle', dur: 0.18, gain: 0.22, delay: 0 });
      tone({ freq: 659, type: 'triangle', dur: 0.18, gain: 0.22, delay: 0.18 });
      tone({ freq: 784, type: 'triangle', dur: 0.18, gain: 0.22, delay: 0.36 });
      tone({ freq: 1046, type: 'triangle', dur: 0.32, gain: 0.24, delay: 0.54 });
    },
    defeat() {
      tone({ freq: 320, freqEnd: 110, type: 'sawtooth', dur: 0.6, gain: 0.25 });
      tone({ freq: 220, freqEnd: 70, type: 'sawtooth', dur: 0.7, gain: 0.2, delay: 0.2 });
    },
    click() { tone({ freq: 600, type: 'square', dur: 0.04, gain: 0.08 }); },
  };
})();

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
  }

  takeDamage(amount) {
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

    this.flashTimer  = Math.max(0, this.flashTimer  - dt);
    this.attackFlash = Math.max(0, this.attackFlash - dt);
    this.shieldTimer = Math.max(0, this.shieldTimer - dt);
    this.dashTimer   = Math.max(0, this.dashTimer   - dt);

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
    this.attackFlash = this.def.boss ? 0.28 : 0.18;
    this.lastTargetPos = { x: target.x, y: target.y };
    if (target instanceof Tower && target.team === 'player' && !game.playerTowerHitTriggered) {
      game.playerTowerHitTriggered = true;
      game.fireTowerHitEvents();
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

      if (isBoss) {
        ctx.fillStyle = 'rgba(216, 180, 254, 0.35)';
        ctx.beginPath();
        ctx.arc(this.lastTargetPos.x, this.lastTargetPos.y, 24 + this.attackFlash * 80, 0, Math.PI * 2);
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
    this.unlockedLevel = saved?.unlockedLevel ?? 1;
    this.deck = this.sanitizeDeck(saved?.deck);
    this.screen = 'map';
    this.reset(1);
    this.screen = 'map';
  }

  sanitizeDeck(deck) {
    const all = Object.keys(UNIT_DEFS);
    if (!deck || deck.length === 0) {
      // 預設選 tier 1 的前 4 隻
      return all.filter(k => UNIT_DEFS[k].tier === 1).slice(0, DECK_MAX);
    }
    return deck.filter(k => UNIT_DEFS[k]).slice(0, DECK_MAX);
  }

  persist() {
    SaveData.save({
      unlockedLevel: this.unlockedLevel,
      soundEnabled: Sound.isEnabled(),
      deck: this.deck,
    });
  }

  isUnitUnlocked(key) {
    const def = UNIT_DEFS[key];
    return def && def.tier <= this.unlockedLevel;
  }

  toggleDeck(key) {
    if (!this.isUnitUnlocked(key)) return false;
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
    const enemyTowerHpByLevel = { 1: 1500, 2: 2200, 3: 2600 };
    this.playerTower = new Tower('player', PLAYER_TOWER_X, 1000);
    this.enemyTower  = new Tower('enemy',  ENEMY_TOWER_X,  enemyTowerHpByLevel[this.level] || 1500);
    this.playerUnits = [];
    this.enemyUnits  = [];
    this.money = MONEY_START;
    this.elapsed = 0;
    this.cooldowns = {};
    for (const key of Object.keys(UNIT_DEFS)) this.cooldowns[key] = 0;
    this.levelEvents = (LEVEL_EVENTS[this.level] || []).map(event => ({ ...event }));
    this.pendingSpawns = [];                // {time, type}
    this.playerTowerHitTriggered = false;
    this.summonEffects = [];                // {x, y, t, duration}
    this.floatingTexts = [];                // {x, y, text, t, duration}
    this.purpleFlash = 0;
    this.shakeTimer = 0;
    this.gameOver = false;
    this.winner = null;
  }

  activeUnitKeys() {
    // 戰場上能召喚的貓 = 編成內 + 該關卡已解鎖(tier 篩選)
    return this.deck.filter(key => this.isUnitUnlocked(key));
  }

  goToMap() {
    this.screen = 'map';
    Sound.bgmStop();
  }

  startLevel(level) {
    if (level > this.unlockedLevel) return false;
    if (this.activeUnitKeys().length === 0) return false;
    this.reset(level);
    Sound.bgmStart();
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
    const minX = ENEMY_TOWER_X + TOWER_W / 2 + 4;
    for (const e of this.enemyUnits) {
      if (e.hp <= 0) continue;
      e.x = Math.max(minX, e.x - distance);
      e.flashTimer = 0.15;
      e.attackTimer = Math.max(e.attackTimer, 0.3);    // 被擊退後短暫無法立刻攻擊
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
  }

  queueEnemySpawn(type, count = 1) {
    const safeCount = Math.max(1, Number(count) || 1);
    for (let i = 0; i < safeCount; i++) {
      this.pendingSpawns.push({ time: this.elapsed + i * 0.4, type });
    }
  }

  fireTowerHitEvents() {
    for (const event of this.levelEvents) {
      if (event.trigger !== 'tower_hit' || event.fired) continue;
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
      if (this.level < TOTAL_LEVELS) {
        this.unlockedLevel = Math.max(this.unlockedLevel, this.level + 1);
      }
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
      ctx.fillText(this.winner === 'player' ? '勝利!' : '失敗...', W / 2, H / 2 - 20);
      ctx.fillStyle = '#e5e7eb';
      ctx.font = '20px sans-serif';
      let subtitle;
      if (this.winner === 'player') {
        if (this.level < TOTAL_LEVELS) {
          subtitle = `第 ${this.level + 1} 關已解鎖`;
        } else {
          subtitle = '全部關卡通關!';
        }
      } else {
        subtitle = '請選擇下方按鈕';
      }
      ctx.fillText(subtitle, W / 2, H / 2 + 60);
    }
  }
}

// ========================================================================
// UI:按鈕 + 主迴圈
// ========================================================================
let game = null;
const buttonContainer = document.getElementById('buttons');
const mapScreen = document.getElementById('map-screen');
const bottomBar = document.getElementById('bottom-bar');
const restartBtn = document.getElementById('restart');
const backToMapBtn = document.getElementById('back-to-map');
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const closeSettingsBtn = document.getElementById('close-settings');
const soundToggle = document.getElementById('sound-toggle');
const gameoverPanel = document.getElementById('gameover-panel');
const gameoverRestartBtn = document.getElementById('gameover-restart');
const gameoverMapBtn = document.getElementById('gameover-map');
const victoryPanel = document.getElementById('victory-panel');
const victoryNextBtn = document.getElementById('victory-next');
const victoryReplayBtn = document.getElementById('victory-replay');
const victoryMapBtn = document.getElementById('victory-map');
const gameContainer = document.getElementById('game-container');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const deckGrid = document.getElementById('deck-grid');
const deckCount = document.getElementById('deck-count');
const buttonEls = {};
const deckSlotEls = {};
const levelButtons = [...document.querySelectorAll('.level-node')];

function closeSettings() {
  settingsPanel.hidden = true;
}

function toggleSettings() {
  settingsPanel.hidden = !settingsPanel.hidden;
  if (!settingsPanel.hidden) Sound.resume();
}

function initButtons() {
  buttonContainer.innerHTML = '';
  for (const [key, def] of Object.entries(UNIT_DEFS)) {
    const btn = document.createElement('button');
    btn.className = `unit-btn${def.boss ? ' boss-btn' : ''}`;
    btn.type = 'button';
    btn.dataset.unit = key;
    btn.innerHTML = `
      <div class="unit-icon ${def.shape}" style="--unit-color:${def.color}"></div>
      <div class="unit-name">${def.name}</div>
      <div class="unit-cost">$${def.cost}</div>
      <div class="unit-stats">HP ${def.hp} · ATK ${def.atk}</div>
      <div class="cd-overlay"></div>
    `;
    btn.addEventListener('click', () => {
      Sound.resume();
      game.trySpawnPlayer(key);
    });
    buttonContainer.appendChild(btn);
    buttonEls[key] = btn;
  }

  renderDeckGrid();

  settingsBtn.addEventListener('click', () => {
    Sound.click();
    toggleSettings();
  });
  closeSettingsBtn.addEventListener('click', () => {
    Sound.click();
    closeSettings();
  });
  restartBtn.addEventListener('click', () => {
    Sound.click();
    game.reset(game.level);
    Sound.bgmStart();
    closeSettings();
  });
  backToMapBtn.addEventListener('click', () => {
    Sound.click();
    game.goToMap();
    closeSettings();
  });
  soundToggle.addEventListener('change', () => {
    Sound.setEnabled(soundToggle.checked);
    game?.persist();
    if (soundToggle.checked) {
      Sound.click();
      if (game && game.screen === 'playing' && !game.gameOver) Sound.bgmStart();
    }
  });

  gameoverRestartBtn.addEventListener('click', () => {
    Sound.click();
    game.reset(game.level);
    Sound.bgmStart();
  });
  gameoverMapBtn.addEventListener('click', () => {
    Sound.click();
    game.goToMap();
  });

  victoryNextBtn.addEventListener('click', () => {
    if (game.level >= TOTAL_LEVELS) return;
    Sound.click();
    game.startLevel(game.level + 1);
    updateMap();
  });
  victoryReplayBtn.addEventListener('click', () => {
    Sound.click();
    game.reset(game.level);
    Sound.bgmStart();
  });
  victoryMapBtn.addEventListener('click', () => {
    Sound.click();
    game.goToMap();
  });

  for (const btn of levelButtons) {
    btn.addEventListener('click', () => {
      Sound.resume();
      Sound.click();
      game.startLevel(Number(btn.dataset.level));
      updateMap();
    });
  }
}

function renderDeckGrid() {
  deckGrid.innerHTML = '';
  for (const [key, def] of Object.entries(UNIT_DEFS)) {
    const slot = document.createElement('button');
    slot.className = 'deck-slot';
    slot.type = 'button';
    slot.dataset.unit = key;
    slot.innerHTML = `
      <div class="deck-slot-order"></div>
      <div class="deck-slot-icon ${def.shape}" style="--unit-color:${def.color}"></div>
      <div class="deck-slot-name">${def.name}</div>
      <div class="deck-slot-cost">$${def.cost}</div>
      <div class="deck-slot-ability">${ABILITY_DESC[def.ability] || ''}</div>
      <div class="deck-slot-lock">🔒</div>
    `;
    slot.addEventListener('click', () => {
      if (!game) return;
      Sound.resume();
      if (game.toggleDeck(key)) {
        Sound.click();
        updateDeck();
      }
    });
    deckGrid.appendChild(slot);
    deckSlotEls[key] = slot;
  }
}

function updateDeck() {
  if (!game) return;
  deckCount.textContent = String(game.deck.length);
  for (const [key, slot] of Object.entries(deckSlotEls)) {
    const idx = game.deck.indexOf(key);
    const unlocked = game.isUnitUnlocked(key);
    slot.classList.toggle('selected', idx >= 0);
    slot.classList.toggle('locked', !unlocked);
    slot.disabled = !unlocked;
    const orderEl = slot.querySelector('.deck-slot-order');
    if (orderEl) orderEl.textContent = idx >= 0 ? String(idx + 1) : '';
  }
}

async function toggleFullscreen() {
  if (!document.fullscreenElement) {
    const request = gameContainer.requestFullscreen || gameContainer.webkitRequestFullscreen;
    await request?.call(gameContainer);
    try {
      await screen.orientation?.lock?.('landscape');
    } catch (error) {
      // Some mobile browsers, especially iOS Safari, do not allow orientation lock.
    }
  } else {
    try {
      screen.orientation?.unlock?.();
    } catch (error) {}
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    await exit?.call(document);
  }
}

fullscreenBtn.addEventListener('click', toggleFullscreen);

function updateButtons() {
  if (!game) return;
  const activeKeys = game.activeUnitKeys();
  const cols = Math.max(1, activeKeys.length);
  buttonContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  for (const [key, def] of Object.entries(UNIT_DEFS)) {
    const btn = buttonEls[key];
    const orderIdx = activeKeys.indexOf(key);
    if (orderIdx < 0) {
      btn.hidden = true;
      continue;
    }
    btn.hidden = false;
    btn.style.order = String(orderIdx);

    const cd = game.cooldowns[key];
    const canAfford = game.money >= def.cost;
    const ready = cd <= 0 && canAfford && !game.gameOver;

    btn.disabled = !ready;
    btn.classList.toggle('cant-afford', !canAfford && cd <= 0 && !game.gameOver);

    const overlay = btn.querySelector('.cd-overlay');
    overlay.style.height = cd > 0 ? ((cd / def.cd) * 100) + '%' : '0%';
  }
}

function updateMap() {
  if (!game) return;
  const onMap = game.screen === 'map';
  mapScreen.hidden = !onMap;
  canvas.hidden = onMap;
  bottomBar.hidden = onMap;

  const showLoseButtons = !onMap && game.gameOver && game.winner === 'enemy';
  const showWinButtons = !onMap && game.gameOver && game.winner === 'player';
  gameoverPanel.hidden = !showLoseButtons;
  victoryPanel.hidden = !showWinButtons;
  if (showWinButtons) {
    const isFinal = game.level >= TOTAL_LEVELS;
    victoryNextBtn.disabled = isFinal;
    victoryNextBtn.textContent = isFinal ? '已是最終關' : '進入下一關';
  }

  const hasDeck = game.deck.length > 0;
  for (const btn of levelButtons) {
    const level = Number(btn.dataset.level);
    const unlocked = level <= game.unlockedLevel;
    btn.disabled = !unlocked || !hasDeck;
    btn.classList.toggle('locked', !unlocked);
    btn.classList.toggle('cleared', level < game.unlockedLevel);
    btn.classList.toggle('no-deck', unlocked && !hasDeck);
  }

  if (onMap) updateDeck();
}

let lastTime = performance.now();
function loop(now) {
  let dt = (now - lastTime) / 1000;
  if (dt > 0.1) dt = 0.1;                   // 切到背景太久時避免大跳
  lastTime = now;

  game.update(dt);
  updateMap();
  if (game.screen === 'playing') game.draw(ctx);
  updateButtons();

  requestAnimationFrame(loop);
}

async function bootstrap() {
  await loadGameData();
  const saved = SaveData.load();
  if (saved) {
    Sound.setEnabled(saved.soundEnabled);
    soundToggle.checked = saved.soundEnabled;
  }
  game = new GameState();
  initButtons();
  updateMap();
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

bootstrap().catch(error => {
  console.error(error);
  mapScreen.hidden = false;
  canvas.hidden = true;
  bottomBar.hidden = true;
  mapScreen.innerHTML = '<div class="map-panel"><div class="map-title">CSV 載入失敗</div></div>';
});
