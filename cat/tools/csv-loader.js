// tools/csv-loader.js
// 用 fs 把 data/ 目錄裡的 CSV 讀進記憶體,轉成 core.applyGameData 吃的格式。
// Browser 端走 fetch 路徑(render.js 的 loadGameData),這支是 headless 工具專用。

const fs = require('fs');
const path = require('path');
const core = require('../core.js');

const NUMERIC_UNIT_FIELDS  = ['cost', 'hp', 'atk', 'speed', 'range', 'attackCd', 'cd', 'size', 'aoe'];
const NUMERIC_ENEMY_FIELDS = ['hp', 'atk', 'speed', 'range', 'attackCd', 'size', 'reward'];
const NUMERIC_LEVEL_FIELDS = ['count', 'time', 'interval', 'start', 'end'];

function readRows(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return core.rowsToObjects(text);
}

function loadGameDataFromDisk(dataDir = path.join(__dirname, '..', 'data')) {
  const unitRows  = readRows(path.join(dataDir, 'units.csv'));
  const enemyRows = readRows(path.join(dataDir, 'enemies.csv'));

  const units = Object.fromEntries(unitRows.map(row => {
    const def = core.numberize({ ...row, boss: row.boss === 'true' }, NUMERIC_UNIT_FIELDS);
    return [def.id, def];
  }));

  const enemies = Object.fromEntries(enemyRows.map(row => {
    const def = core.numberize({ ...row, boss: row.boss === 'true' }, NUMERIC_ENEMY_FIELDS);
    return [def.id, def];
  }));

  // level1.csv .. 直到找不到為止
  const levels = {};
  for (let i = 1; i < 100; i++) {
    const file = path.join(dataDir, `level${i}.csv`);
    if (!fs.existsSync(file)) break;
    const rows = readRows(file);
    levels[i] = rows.map(row =>
      core.numberize({ ...row, fired: false, nextTime: null }, NUMERIC_LEVEL_FIELDS)
    );
  }

  return { units, enemies, levels };
}

function applyToCore(data) {
  core.applyGameData(data);
}

// 方便:一次完成「讀檔 + 注入」
function loadAndApply(dataDir) {
  const data = loadGameDataFromDisk(dataDir);
  applyToCore(data);
  return data;
}

module.exports = {
  loadGameDataFromDisk,
  applyToCore,
  loadAndApply,
  NUMERIC_UNIT_FIELDS,
  NUMERIC_ENEMY_FIELDS,
  NUMERIC_LEVEL_FIELDS,
};
