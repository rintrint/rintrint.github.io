// ========================================================================
// render.js — DOM、canvas、Sound、SaveData、UI 處理與主迴圈。
// 載入順序:必須在 core.js 之後,因為本檔會重新賦值 core 中的 Sound / SaveData
// （兩者在 core 是 let 的 no-op 佔位,在此換成真實實作）。
// ========================================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const ABILITY_DESC = {
  pierce:    '出場對最近敵人 +30 傷害',
  shield:    '出場 4 秒減傷 50%',
  dash:      '出場 3 秒移速 +80%',
  backdoor:  '偷家',
  aura:      '治癒',
  snipe:    `出場狙擊最遠敵人 ${SNIPE_DAMAGE} 傷害`,
  heal:      '出場+定期治癒友軍',
  knockback: '出場擊退所有敵人',
  bomb:      '出場範圍爆炸',
  shake:     '出場震撼全場',
  none:      '',
};

// ========================================================================
// SaveData:把進度存到 localStorage,避免 F5 後關卡解鎖狀態歸零
// （覆寫 core.js 的 no-op 佔位）
// ========================================================================
const SAVE_KEY = 'cat-tower-defense-save-v1';
SaveData = {
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      // 舊存檔只有 soundEnabled,拆成 BGM/SFX 後當作兩者的初值
      const legacy = data.soundEnabled !== false;
      return {
        bgmEnabled: data.bgmEnabled !== undefined ? data.bgmEnabled !== false : legacy,
        sfxEnabled: data.sfxEnabled !== undefined ? data.sfxEnabled !== false : legacy,
        deck: Array.isArray(data.deck) ? data.deck.slice(0, DECK_MAX) : null,
        levelStars: data.levelStars && typeof data.levelStars === 'object' ? data.levelStars : {},
        difficulty: data.difficulty === 'hard' ? 'hard' : 'easy',
        endlessBest: typeof data.endlessBest === 'number' ? data.endlessBest : 0,
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
// Sound:用 WebAudio 合成簡單音效（覆寫 core.js 的 no-op 佔位）
// ========================================================================
Sound = (() => {
  let ctx = null;
  let bgmEnabled = true;
  let sfxEnabled = true;

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone({ freq = 440, type = 'sine', dur = 0.15, gain = 0.2, freqEnd = null, delay = 0 }) {
    if (!sfxEnabled) return;
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
    if (!sfxEnabled) return;
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
  const STEPS_PER_CHORD = 8;
  const ARPEGGIO_STEPS = [0, 2, 4, 6, 3, 5, 7, 1];

  // 多軌:平時用 normal,boss 出場切到 boss(更低、更快、不和諧)
  const BGM_TRACKS = {
    normal: {
      chords: [
        { bass: 45, notes: [57, 60, 64] }, // Am
        { bass: 41, notes: [53, 57, 60] }, // F
        { bass: 48, notes: [60, 64, 67] }, // C
        { bass: 43, notes: [55, 59, 62] }, // G
      ],
      bpm: 96,
    },
    boss: {
      chords: [
        { bass: 33, notes: [45, 48, 52] }, // Am (低 8 度)
        { bass: 31, notes: [43, 46, 50] }, // G dim
        { bass: 33, notes: [45, 49, 52] }, // Am(M3)
        { bass: 28, notes: [40, 44, 47] }, // E
      ],
      bpm: 138,
    },
  };

  let currentTrack = BGM_TRACKS.normal;
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
    const chords = currentTrack.chords;
    const chordIdx = Math.floor(step / STEPS_PER_CHORD) % chords.length;
    const inChord = step % STEPS_PER_CHORD;
    const chord = chords[chordIdx];

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
    const stepDur = 60 / currentTrack.bpm / 2;
    while (bgmNextTime < c.currentTime + 0.2) {
      scheduleBgmStep(c, bgmStep, bgmNextTime);
      bgmStep = (bgmStep + 1) % (STEPS_PER_CHORD * currentTrack.chords.length);
      bgmNextTime += stepDur;
    }
  }

  function bgmStart(trackName = 'normal') {
    if (!bgmEnabled) return;
    const next = BGM_TRACKS[trackName] || BGM_TRACKS.normal;
    if (bgmPlaying && currentTrack === next) return;     // 已經在播這軌
    const c = ensureCtx();
    if (!c) return;
    // 切換軌道:清掉舊 scheduler,gain 重新淡入
    if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
    bgmPlaying = false;
    if (!bgmMaster) {
      bgmMaster = c.createGain();
      bgmMaster.gain.value = 0;
      bgmMaster.connect(c.destination);
    }
    currentTrack = next;
    bgmMaster.gain.cancelScheduledValues(c.currentTime);
    bgmMaster.gain.setValueAtTime(bgmMaster.gain.value, c.currentTime);
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
    setBgmEnabled(v) {
      bgmEnabled = !!v;
      if (!bgmEnabled) bgmStop();
    },
    isBgmEnabled() { return bgmEnabled; },
    setSfxEnabled(v) { sfxEnabled = !!v; },
    isSfxEnabled() { return sfxEnabled; },
    resume() { ensureCtx(); },
    bgmStart,
    bgmStartBoss() { bgmStart('boss'); },
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
// CSV 載入（fetch 版,瀏覽器專用）。Node 端走 fs + rowsToObjects + applyGameData。
// ========================================================================
async function loadCsv(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`CSV 載入失敗: ${path}`);
  return rowsToObjects(await res.text());
}

// ========================================================================
// Sprite 載入:預載所有 PNG,對玩家單位做色相 tint(共用 3 個 hero 卻有 8 個單位)
// ========================================================================
const PLAYER_SPRITE_MAP = {
  defender: { hero: 'knight', tint: '#1e3a8a' },
  rusher:   { hero: 'rogue',  tint: '#0ea5e9' },
  sniper:   { hero: 'mage',   tint: '#06b6d4' },
  healer:   { hero: 'mage',   tint: '#22c55e' },
  bomber:   { hero: 'knight', tint: '#facc15' },  // AoE 單位都用拿劍的騎士
  boss:     { hero: 'knight', tint: '#7c3aed' },
};

const ENEMY_SPRITE_MAP = {
  grunt: 'lizard',
  heavy: 'demon',
  fast:  'small_dragon',
  elite: 'medusa',
  boss:  'dragon',
};

// 各角色的攻擊幀數量(對應 assets/<group>/<name>/attack/1.png ... N.png)
const HERO_ATTACK_FRAME_COUNT = { knight: 4, rogue: 7, mage: 7 };
const MONSTER_ATTACK_FRAME_COUNT = {
  lizard: 5, demon: 4, small_dragon: 3, medusa: 6, dragon: 4,
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`Image 載入失敗: ${src}`));
    img.src = src;
  });
}

function tintImage(img, color, intensity = 0.4) {
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const cx = c.getContext('2d');
  cx.imageSmoothingEnabled = false;
  cx.drawImage(img, 0, 0);
  cx.globalCompositeOperation = 'source-atop';
  cx.globalAlpha = intensity;
  cx.fillStyle = color;
  cx.fillRect(0, 0, w, h);
  return c;
}

// 把 sprite 四周的透明 padding 全部裁掉,回傳緊貼角色內容的新 canvas。
// 用於 UI 頭像:讓圖示在卡片中填得滿,不會頭頂留一大塊空白。
function cropToContent(src) {
  const w = src.naturalWidth || src.width;
  const h = src.naturalHeight || src.height;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const cx = c.getContext('2d');
  cx.drawImage(src, 0, 0);
  const data = cx.getImageData(0, 0, w, h).data;
  let top = h, bottom = -1, left = w, right = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 12) {
        if (y < top)    top = y;
        if (y > bottom) bottom = y;
        if (x < left)   left = x;
        if (x > right)  right = x;
      }
    }
  }
  if (bottom < 0) return c;
  const cw = right - left + 1;
  const ch = bottom - top + 1;
  const out = document.createElement('canvas');
  out.width = cw; out.height = ch;
  const ox = out.getContext('2d');
  ox.imageSmoothingEnabled = false;
  ox.drawImage(c, left, top, cw, ch, 0, 0, cw, ch);
  return out;
}

// 掃描 alpha 通道找出實際內容的四邊邊界,回傳上下左右透明 padding 比例。
// top/bottom 用於把腳尖貼地;left/right 用於算實際視覺寬度(供 findTarget 用邊緣距離)。
function measureSpritePadding(src) {
  const w = src.naturalWidth || src.width;
  const h = src.naturalHeight || src.height;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const cx = c.getContext('2d');
  cx.drawImage(src, 0, 0);
  const data = cx.getImageData(0, 0, w, h).data;
  let top = h, bottom = -1, left = w, right = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 12) {
        if (y < top)    top = y;
        if (y > bottom) bottom = y;
        if (x < left)   left = x;
        if (x > right)  right = x;
      }
    }
  }
  if (bottom < 0) return { top: 0, bottom: 0, left: 0, right: 0 };
  return {
    top:    top / h,
    bottom: (h - 1 - bottom) / h,
    left:   left / w,
    right:  (w - 1 - right) / w,
  };
}

async function loadSprites() {
  const heroFrames = {};
  for (const hero of ['knight', 'rogue', 'mage']) {
    const attackFrames = [];
    for (let i = 1; i <= HERO_ATTACK_FRAME_COUNT[hero]; i++) {
      attackFrames.push(await loadImage(`assets/heroes/${hero}/attack/${i}.png`));
    }
    heroFrames[hero] = {
      idle:   await loadImage(`assets/heroes/${hero}/idle.png`),
      idle2:  await loadImage(`assets/heroes/${hero}/idle2.png`),
      attackFrames,
    };
  }
  const unitSprites = {};
  for (const [id, { hero, tint }] of Object.entries(PLAYER_SPRITE_MAP)) {
    const src = heroFrames[hero];
    const set = {
      idle:   tintImage(src.idle,   tint, 0.42),
      idle2:  tintImage(src.idle2,  tint, 0.42),
      attackFrames: src.attackFrames.map(f => tintImage(f, tint, 0.42)),
    };
    const pad = measureSpritePadding(set.idle);
    set.topPad = pad.top;
    set.bottomPad = pad.bottom;
    set.leftPad = pad.left;
    set.rightPad = pad.right;
    unitSprites[id] = set;
  }

  const enemySprites = {};
  for (const [id, monster] of Object.entries(ENEMY_SPRITE_MAP)) {
    const attackFrames = [];
    for (let i = 1; i <= MONSTER_ATTACK_FRAME_COUNT[monster]; i++) {
      attackFrames.push(await loadImage(`assets/monsters/${monster}/attack/${i}.png`));
    }
    const set = {
      idle:   await loadImage(`assets/monsters/${monster}/idle.png`),
      idle2:  await loadImage(`assets/monsters/${monster}/idle2.png`),
      attackFrames,
    };
    const pad = measureSpritePadding(set.idle);
    set.topPad = pad.top;
    set.bottomPad = pad.bottom;
    set.leftPad = pad.left;
    set.rightPad = pad.right;
    enemySprites[id] = set;
  }

  const towerSprites = {
    player: await loadImage('assets/tower/player.png'),
    enemy:  await loadImage('assets/tower/enemy.png'),
  };

  const backgroundImage = await loadImage('assets/bg/background.png');
  applySprites({ unitSprites, enemySprites, towerSprites, backgroundImage });

  // UI 用的小頭像:idle.png 周圍有大量透明 padding(rogue 128 圖內角色只有 ~46 寬),
  // 直接放卡片裡會留一大圈空白。先 tint 成該單位的顏色(否則三個 knight base 看起來一模一樣),
  // 再 crop 到角色內容讓圖示填滿卡片。
  for (const id of Object.keys(PLAYER_SPRITE_MAP)) {
    const { hero, tint } = PLAYER_SPRITE_MAP[id];
    const heroIdle = await loadImage(`assets/heroes/${hero}/idle.png`);
    const tinted = tintImage(heroIdle, tint, 0.42);
    UNIT_ICON_DATA_URL[id] = cropToContent(tinted).toDataURL();
  }
}

const UNIT_ICON_DATA_URL = {};

// 技能圖示:inline SVG,直接嵌進按鈕。色塊圖示太單調,改用辨識度高的圖案。
// shield: 五角星(對應「全體無敵」庇佑感),cannon: 八角爆裂(對應 AoE 擊退傷害)
const SKILL_ICONS = {
  shield: `<svg class="unit-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
      fill="#fbbf24"/>
  </svg>`,
  cannon: `<svg class="unit-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
    <polygon points="12,1 14,9 21,5 17,11 23,13 16,14 19,21 13,15 12,23 11,15 5,21 8,14 1,13 7,11 3,5 10,9"
      fill="#dc2626" stroke="#fbbf24" stroke-width="0.9" stroke-linejoin="round"/>
  </svg>`,
};

async function loadGameData() {
  const levelPaths = Array.from({ length: TOTAL_LEVELS }, (_, i) => `data/level${i + 1}.csv`);
  const [unitRows, enemyRows, ...levelRows] = await Promise.all([
    loadCsv('data/units.csv'),
    loadCsv('data/enemies.csv'),
    ...levelPaths.map(loadCsv),
  ]);

  const units = Object.fromEntries(unitRows.map(row => {
    const def = numberize({ ...row, boss: row.boss === 'true' }, NUMERIC_UNIT_FIELDS);
    return [def.id, def];
  }));

  const enemies = Object.fromEntries(enemyRows.map(row => {
    const def = numberize({ ...row, boss: row.boss === 'true' }, NUMERIC_ENEMY_FIELDS);
    return [def.id, def];
  }));

  const levels = Object.fromEntries(levelRows.map((rows, i) => [
    i + 1,
    rows.map(row => numberize({ ...row, fired: false, nextTime: null }, NUMERIC_LEVEL_FIELDS)),
  ]));

  applyGameData({ units, enemies, levels });
}

// ========================================================================
// UI:按鈕 + 主迴圈
// ========================================================================
let game = null;
const buttonContainer = document.getElementById('buttons');
const mapScreen = document.getElementById('map-screen');
const playScreen = document.getElementById('play-screen');
const restartBtn = document.getElementById('restart');
const backToMapBtn = document.getElementById('back-to-map');
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const closeSettingsBtn = document.getElementById('close-settings');
const bgmToggle = document.getElementById('bgm-toggle');
const sfxToggle = document.getElementById('sfx-toggle');
const gameoverPanel = document.getElementById('gameover-panel');
const gameoverRestartBtn = document.getElementById('gameover-restart');
const gameoverMapBtn = document.getElementById('gameover-map');
const victoryPanel = document.getElementById('victory-panel');
const victoryNextBtn = document.getElementById('victory-next');
const victoryReplayBtn = document.getElementById('victory-replay');
const victoryMapBtn = document.getElementById('victory-map');
const gameContainer = document.getElementById('game-container');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const skillsContainer = document.getElementById('skills');
const skillBtnEls = {};
const deckGrid = document.getElementById('deck-grid');
const buttonEls = {};
const diffBtns = [...document.querySelectorAll('.diff-btn')];
const levelButtons = [...document.querySelectorAll('.level-node')];

function openSettings() {
  settingsPanel.hidden = false;
  if (game && game.screen === 'playing' && !game.gameOver) {
    game.paused = true;
    Sound.bgmStop();
  }
  Sound.resume();
}

function closeSettings() {
  settingsPanel.hidden = true;
  if (game && game.paused) {
    game.paused = false;
    if (game.screen === 'playing' && !game.gameOver) Sound.bgmStart();
  }
}

function toggleSettings() {
  if (settingsPanel.hidden) openSettings();
  else closeSettings();
}

function unitIconHTML(key, def) {
  const url = UNIT_ICON_DATA_URL[key];
  if (url) return `<img class="unit-icon-img" src="${url}" alt="">`;
  return `<div class="unit-icon ${def.shape}" style="--unit-color:${def.color}"></div>`;
}

function initButtons() {
  buttonContainer.innerHTML = '';
  for (const [key, def] of Object.entries(UNIT_DEFS)) {
    const btn = document.createElement('button');
    btn.className = `unit-btn${def.boss ? ' boss-btn' : ''}`;
    btn.type = 'button';
    btn.dataset.unit = key;
    btn.innerHTML = `
      ${unitIconHTML(key, def)}
      <div class="unit-name">${def.name}</div>
      <div class="unit-cost">$${def.cost}</div>
      <div class="unit-ability">${ABILITY_DESC[def.ability] || ''}</div>
      <div class="cd-overlay"></div>
    `;
    btn.addEventListener('click', () => {
      Sound.resume();
      game.trySpawnPlayer(key);
    });
    buttonContainer.appendChild(btn);
    buttonEls[key] = btn;
  }

  for (const [key, skill] of Object.entries(SKILLS)) {
    const btn = document.createElement('button');
    btn.className = 'unit-btn skill-btn';
    btn.type = 'button';
    btn.style.setProperty('--skill-color', skill.color);
    const iconHTML = SKILL_ICONS[key]
      || `<div class="unit-icon" style="--unit-color:${skill.color}"></div>`;
    btn.innerHTML = `
      ${iconHTML}
      <div class="unit-name">${skill.name}</div>
      <div class="unit-cost">$${skill.cost}</div>
      <div class="unit-ability">${skill.desc}</div>
      <div class="cd-overlay"></div>
    `;
    btn.addEventListener('click', () => {
      Sound.resume();
      game.trySkill(key);
    });
    skillsContainer.appendChild(btn);
    skillBtnEls[key] = btn;
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
  bgmToggle.addEventListener('change', () => {
    Sound.setBgmEnabled(bgmToggle.checked);
    game?.persist();
    if (bgmToggle.checked) {
      if (Sound.isSfxEnabled()) Sound.click();
      if (game && game.screen === 'playing' && !game.gameOver) Sound.bgmStart();
    }
  });
  sfxToggle.addEventListener('change', () => {
    Sound.setSfxEnabled(sfxToggle.checked);
    game?.persist();
    if (sfxToggle.checked) Sound.click();
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
    // 普通關卡上限是 TOTAL_LEVELS - 1(最後一個是 endless 無盡模式,不算「下一關」)
    if (game.level >= TOTAL_LEVELS - 1) return;
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

  for (const btn of diffBtns) {
    btn.addEventListener('click', () => {
      if (!game) return;
      Sound.resume();
      Sound.click();
      game.setDifficulty(btn.dataset.diff);
      updateMap();
    });
  }
}

// 純展示用,沒有點擊互動(出戰編成系統已移除)
function renderDeckGrid() {
  deckGrid.innerHTML = '';
  for (const [key, def] of Object.entries(UNIT_DEFS)) {
    const slot = document.createElement('div');
    slot.className = 'deck-slot';
    slot.dataset.unit = key;
    const iconHTML = UNIT_ICON_DATA_URL[key]
      ? `<img class="deck-slot-icon-img" src="${UNIT_ICON_DATA_URL[key]}" alt="">`
      : `<div class="deck-slot-icon ${def.shape}" style="--unit-color:${def.color}"></div>`;
    slot.innerHTML = `
      ${iconHTML}
      <div class="deck-slot-name">${def.name}</div>
      <div class="deck-slot-cost">$${def.cost}</div>
      <div class="deck-slot-ability">${ABILITY_DESC[def.ability] || ''}</div>
    `;
    deckGrid.appendChild(slot);
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

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    Sound.bgmStop();
  } else if (game && game.screen === 'playing' && !game.gameOver && !game.paused) {
    Sound.bgmStart();
  }
});

function updateButtons() {
  if (!game) return;
  buttonContainer.style.gridTemplateColumns = `repeat(${Object.keys(UNIT_DEFS).length}, 1fr)`;

  for (const [key, def] of Object.entries(UNIT_DEFS)) {
    const btn = buttonEls[key];
    const cd = game.cooldowns[key];
    const canAfford = game.money >= def.cost;
    const ready = cd <= 0 && canAfford && !game.gameOver;

    btn.disabled = !ready;
    btn.classList.toggle('cant-afford', !canAfford && cd <= 0 && !game.gameOver);

    const overlay = btn.querySelector('.cd-overlay');
    overlay.style.height = cd > 0 ? ((cd / def.cd) * 100) + '%' : '0%';
  }

  for (const [key, skill] of Object.entries(SKILLS)) {
    const btn = skillBtnEls[key];
    const cd = game.skillCds[key];
    const canAfford = game.money >= skill.cost;
    const ready = cd <= 0 && canAfford && !game.gameOver;
    btn.disabled = !ready;
    btn.classList.toggle('cant-afford', !canAfford && cd <= 0 && !game.gameOver);
    const overlay = btn.querySelector('.cd-overlay');
    overlay.style.height = cd > 0 ? ((cd / skill.cd) * 100) + '%' : '0%';
  }
}

function updateMap() {
  if (!game) return;
  const onMap = game.screen === 'map';
  mapScreen.hidden = !onMap;
  playScreen.hidden = onMap;

  const showLoseButtons = !onMap && game.gameOver && game.winner === 'enemy';
  const showWinButtons = !onMap && game.gameOver && game.winner === 'player';
  gameoverPanel.hidden = !showLoseButtons;
  victoryPanel.hidden = !showWinButtons;
  if (showWinButtons) {
    // endless 不會顯示 victory panel,普通關卡最大可前進到 TOTAL_LEVELS - 1
    const isFinal = game.level >= TOTAL_LEVELS - 1;
    victoryNextBtn.disabled = isFinal;
    victoryNextBtn.textContent = isFinal ? '已是最後一關' : '進入下一關';
  }

  for (const btn of diffBtns) {
    btn.classList.toggle('selected', game.difficulty === btn.dataset.diff);
  }
  const mapPathEl = document.querySelector('.map-path');
  if (mapPathEl) mapPathEl.classList.toggle('hard', game.difficulty === 'hard');

  for (const btn of levelButtons) {
    const level = Number(btn.dataset.level);
    btn.disabled = false;
    if (level === ENDLESS_LEVEL) {
      const scoreEl = btn.querySelector('.endless-score');
      if (scoreEl) {
        scoreEl.textContent = game.endlessBest > 0 ? `最佳 ${game.endlessBest.toFixed(3)}s` : '尚無紀錄';
      }
    } else {
      const earned = game.getStarsFor(level);
      btn.classList.toggle('cleared', earned >= 1);
      const starsEl = btn.querySelector('.level-stars');
      if (starsEl) {
        starsEl.innerHTML = `<span class="star${earned >= 1 ? ' earned' : ''}">★</span><span class="star${earned >= 2 ? ' earned' : ''}">★</span>`;
      }
    }
  }
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

const CUSTOM_LEVELS_KEY = 'cat-custom-levels';

function tryLoadCustomLevel() {
  const params = new URLSearchParams(window.location.search);
  const playId = params.get('play');
  if (!playId) return null;
  try {
    const pool = JSON.parse(localStorage.getItem(CUSTOM_LEVELS_KEY) || '{}');
    return pool[playId] || null;
  } catch {
    return null;
  }
}

function applyCustomLevel(customLevel) {
  // game 已存在,直接覆寫 levelEvents 和 enemyTower 後切到 playing
  game.reset(1);
  game.levelEvents = customLevel.events.map(e => ({ ...e, fired: false, nextTime: null }));
  if (typeof customLevel.enemyTowerHp === 'number') {
    game.enemyTower.hp = customLevel.enemyTowerHp;
    game.enemyTower.maxHp = customLevel.enemyTowerHp;
  }
  game.screen = 'playing';
  Sound.bgmStart();
  const backLink = document.getElementById('back-to-generator');
  if (backLink) backLink.hidden = false;
}

async function bootstrap() {
  await loadGameData();
  try {
    await loadSprites();
  } catch (err) {
    console.warn('[sprite] 載入失敗,回退到 placeholder 形狀:', err);
  }
  const saved = SaveData.load();
  if (saved) {
    Sound.setBgmEnabled(saved.bgmEnabled);
    Sound.setSfxEnabled(saved.sfxEnabled);
    bgmToggle.checked = saved.bgmEnabled;
    sfxToggle.checked = saved.sfxEnabled;
  }
  game = new GameState();
  initButtons();

  const customLevel = tryLoadCustomLevel();
  if (customLevel) applyCustomLevel(customLevel);

  updateMap();
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

bootstrap().catch(error => {
  console.error(error);
  mapScreen.hidden = false;
  playScreen.hidden = true;
  mapScreen.innerHTML = '<div class="map-panel"><div class="map-title">CSV 載入失敗</div></div>';
});
