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
      return {
        soundEnabled: data.soundEnabled !== false,
        deck: Array.isArray(data.deck) ? data.deck.slice(0, DECK_MAX) : null,
        levelStars: data.levelStars && typeof data.levelStars === 'object' ? data.levelStars : {},
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
// CSV 載入（fetch 版,瀏覽器專用）。Node 端走 fs + rowsToObjects + applyGameData。
// ========================================================================
async function loadCsv(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`CSV 載入失敗: ${path}`);
  return rowsToObjects(await res.text());
}

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
const skillsContainer = document.getElementById('skills');
const skillBtnEls = {};
const deckGrid = document.getElementById('deck-grid');
const deckCount = document.getElementById('deck-count');
const buttonEls = {};
const placeholderEls = [];
const deckSlotEls = {};
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

  for (let i = 0; i < DECK_MAX; i++) {
    const ph = document.createElement('button');
    ph.className = 'unit-btn locked-slot';
    ph.type = 'button';
    ph.disabled = true;
    buttonContainer.appendChild(ph);
    placeholderEls.push(ph);
  }

  for (const [key, skill] of Object.entries(SKILLS)) {
    const btn = document.createElement('button');
    btn.className = 'unit-btn skill-btn';
    btn.type = 'button';
    btn.style.setProperty('--skill-color', skill.color);
    btn.innerHTML = `
      <div class="unit-icon" style="--unit-color:${skill.color}"></div>
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
    slot.classList.toggle('selected', idx >= 0);
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

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    Sound.bgmStop();
  } else if (game && game.screen === 'playing' && !game.gameOver && !game.paused) {
    Sound.bgmStart();
  }
});

function updateButtons() {
  if (!game) return;
  buttonContainer.style.gridTemplateColumns = `repeat(${DECK_MAX}, 1fr)`;

  for (const [key, def] of Object.entries(UNIT_DEFS)) {
    const btn = buttonEls[key];
    const orderIdx = game.deck.indexOf(key);
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

  const emptySlots = DECK_MAX - game.deck.length;
  for (let i = 0; i < DECK_MAX; i++) {
    const ph = placeholderEls[i];
    if (i < emptySlots) {
      ph.hidden = false;
      ph.style.order = String(game.deck.length + i);
    } else {
      ph.hidden = true;
    }
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
    const isFinal = game.level >= TOTAL_LEVELS;
    victoryNextBtn.disabled = isFinal;
    victoryNextBtn.textContent = isFinal ? '已是最終關' : '進入下一關';
  }

  for (const btn of levelButtons) {
    const level = Number(btn.dataset.level);
    const earned = game.levelStars[level] || 0;
    btn.disabled = false;
    btn.classList.toggle('cleared', earned >= 1);
    const starsEl = btn.querySelector('.level-stars');
    if (starsEl) {
      starsEl.innerHTML = `<span class="star${earned >= 1 ? ' earned' : ''}">★</span><span class="star${earned >= 2 ? ' earned' : ''}">★</span>`;
    }
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
  const saved = SaveData.load();
  if (saved) {
    Sound.setEnabled(saved.soundEnabled);
    soundToggle.checked = saved.soundEnabled;
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
