// generator-ui.js
// 串接 generator.html 的 UI 與 tools/*。瀏覽器專用,不走 UMD。
// 注意:NUMERIC_UNIT_FIELDS / NUMERIC_ENEMY_FIELDS 由 core.js 提供 (同一 script scope),
// 這裡不要重新宣告,否則會 SyntaxError: Identifier already declared。

const CUSTOM_LEVELS_KEY = 'cat-custom-levels';

let unitDefs = {};
let enemyDefs = {};
let currentResults = [];

const statusEl     = document.getElementById('data-status');
const genBtn       = document.getElementById('generate-btn');
const countInput   = document.getElementById('gen-count');
const seedInput    = document.getElementById('gen-seed');
const randSeedsInput = document.getElementById('gen-random-seeds');
const progressEl   = document.getElementById('progress');
const progressText = document.getElementById('progress-text');
const resultsSection = document.getElementById('results-section');
const resultsTitle = document.getElementById('results-title');
const resultsBody  = document.getElementById('results-body');
const statsSection = document.getElementById('stats-section');
const statsBody    = document.getElementById('stats-body');
const filterGood   = document.getElementById('filter-good');
const filterEasy   = document.getElementById('filter-easy');
const filterHard   = document.getElementById('filter-hard');

async function loadData() {
  try {
    const [unitText, enemyText] = await Promise.all([
      fetch('data/units.csv', { cache: 'no-store' }).then(r => r.text()),
      fetch('data/enemies.csv', { cache: 'no-store' }).then(r => r.text()),
    ]);
    const unitRows  = Core.rowsToObjects(unitText);
    const enemyRows = Core.rowsToObjects(enemyText);

    unitDefs = Object.fromEntries(unitRows.map(row => {
      const def = Core.numberize({ ...row, boss: row.boss === 'true' }, NUMERIC_UNIT_FIELDS);
      return [def.id, def];
    }));
    enemyDefs = Object.fromEntries(enemyRows.map(row => {
      const def = Core.numberize({ ...row, boss: row.boss === 'true' }, NUMERIC_ENEMY_FIELDS);
      return [def.id, def];
    }));

    Core.applyGameData({ units: unitDefs, enemies: enemyDefs, levels: {} });

    statusEl.textContent = `已載入 ${Object.keys(unitDefs).length} 個玩家單位、${Object.keys(enemyDefs).length} 個敵人`;
    statusEl.classList.add('ready');
    genBtn.disabled = false;
  } catch (err) {
    statusEl.textContent = `資料載入失敗: ${err.message}`;
    statusEl.classList.add('error');
    console.error(err);
  }
}

function fmtWr(wr) {
  const pct = (wr * 100).toFixed(0) + '%';
  const cls = wr >= 0.6 ? 'wr-high' : wr >= 0.3 ? 'wr-mid' : 'wr-low';
  return `<span class="${cls}">${pct}</span>`;
}

function fmtScore(s) { return s.toFixed(2); }

function renderResults() {
  const filters = {
    good:     filterGood.checked,
    too_easy: filterEasy.checked,
    too_hard: filterHard.checked,
  };
  const shown = currentResults.filter(({ report }) => filters[report.verdict]);
  resultsTitle.textContent = `結果 (顯示 ${shown.length} / ${currentResults.length})`;

  resultsBody.innerHTML = '';
  for (const { level, report } of shown) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${level.id}</code></td>
      <td><span class="verdict-${report.verdict}">${report.verdict}</span></td>
      <td>${fmtScore(report.score)}</td>
      <td>${fmtWr(report.wrPerBot.random)}</td>
      <td>${fmtWr(report.wrPerBot.rush)}</td>
      <td>${fmtWr(report.wrPerBot.meatshield)}</td>
      <td>${report.bestBotName || '-'}</td>
      <td>${level.enemyTowerHp}</td>
      <td>${level.events.length}</td>
      <td>
        <button class="row-action expand" data-id="${level.id}">展開</button>
        <button class="row-action play" data-id="${level.id}">試玩</button>
      </td>
    `;
    resultsBody.appendChild(tr);
  }

  resultsBody.querySelectorAll('.row-action.play').forEach(btn => {
    btn.addEventListener('click', () => playLevel(btn.dataset.id));
  });
  resultsBody.querySelectorAll('.row-action.expand').forEach(btn => {
    btn.addEventListener('click', () => toggleExpand(btn));
  });
}

function toggleExpand(btn) {
  const id = btn.dataset.id;
  const tr = btn.closest('tr');
  const next = tr.nextElementSibling;
  if (next && next.classList.contains('detail-row')) {
    next.remove();
    btn.textContent = '展開';
    return;
  }
  const entry = currentResults.find(r => r.level.id === id);
  if (!entry) return;
  const detail = document.createElement('tr');
  detail.className = 'detail-row';
  const summarySampleRuns = Object.entries(entry.report.sampleResultsPerBot).map(([botName, samples]) => {
    const elapsed = samples.map(s => s.elapsedSec.toFixed(1)).join(', ');
    const enemyHp = samples.map(s => (s.enemyTowerHpFrac * 100).toFixed(0) + '%').join(', ');
    return `${botName}: results=[${samples.map(s => s.result).join(', ')}] elapsed=[${elapsed}] enemyHp=[${enemyHp}]`;
  }).join('\n');
  detail.innerHTML = `
    <td colspan="10">
      <pre>關卡參數: enemyTowerHp=${entry.level.enemyTowerHp}, events=${entry.level.events.length}, seed=${entry.level.seed}

事件列表:
${entry.level.events.map((e, i) => `  ${String(i + 1).padStart(2)}. ${JSON.stringify(e)}`).join('\n')}

各 bot 表現:
${summarySampleRuns}</pre>
    </td>
  `;
  tr.after(detail);
  btn.textContent = '收合';
}

function playLevel(id) {
  const entry = currentResults.find(r => r.level.id === id);
  if (!entry) return;
  // 把該關卡存到 localStorage,然後在新分頁開啟 index.html。
  // 新分頁保留生成器分頁的結果,方便連續試玩多關。
  const pool = JSON.parse(localStorage.getItem(CUSTOM_LEVELS_KEY) || '{}');
  pool[id] = entry.level;
  localStorage.setItem(CUSTOM_LEVELS_KEY, JSON.stringify(pool));
  window.open(`index.html?play=${encodeURIComponent(id)}`, '_blank');
}

function renderStats() {
  if (currentResults.length === 0) {
    statsSection.hidden = true;
    return;
  }
  statsSection.hidden = false;

  const total = currentResults.length;
  const byVerdict = { good: 0, too_easy: 0, too_hard: 0 };
  for (const { report } of currentResults) byVerdict[report.verdict] = (byVerdict[report.verdict] || 0) + 1;

  const avgScore = currentResults.reduce((s, r) => s + r.report.score, 0) / total;
  const avgRandomWr = currentResults.reduce((s, r) => s + r.report.randomWr, 0) / total;
  const avgBestWr = currentResults.reduce((s, r) => s + r.report.bestBotWr, 0) / total;

  const dominantBot = {};
  for (const { report } of currentResults) {
    if (report.bestBotName) dominantBot[report.bestBotName] = (dominantBot[report.bestBotName] || 0) + 1;
  }
  const domText = Object.entries(dominantBot)
    .sort((a, b) => b[1] - a[1])
    .map(([n, c]) => `${n} ${(c / total * 100).toFixed(0)}%`).join(' / ');

  statsBody.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">good / too_easy / too_hard</div>
      <div class="stat-value">${byVerdict.good} / ${byVerdict.too_easy} / ${byVerdict.too_hard}</div>
      <div class="stat-detail">總共 ${total} 關</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">平均 score</div>
      <div class="stat-value">${avgScore.toFixed(2)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Random bot 平均勝率</div>
      <div class="stat-value">${(avgRandomWr * 100).toFixed(0)}%</div>
      <div class="stat-detail">越低代表關卡越不能矇出來</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">最佳 bot 平均勝率</div>
      <div class="stat-value">${(avgBestWr * 100).toFixed(0)}%</div>
      <div class="stat-detail">越高代表關卡可被精通</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">主導 bot 分布</div>
      <div class="stat-value" style="font-size:14px">${domText || '-'}</div>
      <div class="stat-detail">某 bot 太強代表策略單一</div>
    </div>
  `;
}

async function generate() {
  const n = Math.max(1, parseInt(countInput.value, 10));
  const masterSeed = Math.max(1, parseInt(seedInput.value, 10));
  const randomSeeds = Math.max(1, parseInt(randSeedsInput.value, 10));

  genBtn.disabled = true;
  progressEl.value = 0;
  progressText.textContent = `0/${n}`;

  // 把 evaluator 用的隨機 seed 數量改掉(透過 closure 包一層 wrapper)
  const origEvaluate = Evaluator.evaluateLevel;
  const wrappedEvaluate = (level, opts) => origEvaluate(level, { ...opts, randomSeeds });

  // 暫時 monkey-patch — 生成完恢復
  Evaluator.evaluateLevel = wrappedEvaluate;

  const t0 = performance.now();
  try {
    currentResults = await Generator.generateAndEvaluate({
      n,
      masterSeed,
      deck: Evaluator.DEFAULT_DECK,
      getUnitDef: (id) => unitDefs[id],
      onProgress: (done, total) => {
        progressEl.value = Math.round((done / total) * 100);
        progressText.textContent = `${done}/${total}`;
      },
      yieldEvery: 1,
    });
    const t1 = performance.now();
    progressText.textContent = `完成 (${((t1 - t0) / 1000).toFixed(1)}s)`;
    resultsSection.hidden = false;
    renderResults();
    renderStats();
  } catch (err) {
    progressText.textContent = '錯誤: ' + err.message;
    console.error(err);
  } finally {
    Evaluator.evaluateLevel = origEvaluate;
    genBtn.disabled = false;
  }
}

genBtn.addEventListener('click', generate);
filterGood.addEventListener('change', renderResults);
filterEasy.addEventListener('change', renderResults);
filterHard.addEventListener('change', renderResults);

loadData();
