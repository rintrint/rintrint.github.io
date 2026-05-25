// tools/bots.js (UMD)
// 三隻策略 bot。每隻是 factory: ({ seed, deck, getUnitDef }) -> policy(game)
// policy 在每個 sim tick 回傳 null / { summon } / { skill }。
//
// bot 之間的差異不是隨機性,而是「決策邏輯」。
// RandomBot 用 seed 確保可重現;其他 bot 是確定性策略(看 game state 決定),不用 seed。

(function () {
  const isNode = typeof module !== 'undefined' && module.exports;

  // mulberry32 seeded RNG
  function makeRng(seed) {
    let s = (seed | 0) || 1;
    return () => {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function affordable(game, unitId, getUnitDef) {
    const def = getUnitDef(unitId);
    return def && game.money >= def.cost && (game.cooldowns[unitId] || 0) <= 0;
  }

  // --------------------------------------------------------------------------
  // RandomBot:每 tick 0.3 機率隨機召喚一隻 deck 裡買得起的。baseline。
  // --------------------------------------------------------------------------
  // 5% per tick = baseline "懶人玩家"。比 RushBot 緊湊的點擊弱很多,
  // 用來標示「這關連隨機按一按都能過嗎?」
  function RandomBot({ seed = 1, deck, getUnitDef }) {
    const rng = makeRng(seed);
    return (game) => {
      if (rng() >= 0.05) return null;
      const available = deck.filter(id => affordable(game, id, getUnitDef));
      if (available.length === 0) return null;
      return { summon: available[Math.floor(rng() * available.length)] };
    };
  }

  // --------------------------------------------------------------------------
  // RushBot:不停出 deck 裡最便宜的單位。
  // --------------------------------------------------------------------------
  function RushBot({ deck, getUnitDef }) {
    // 預先排序 (便宜 -> 貴)
    const sortedDeck = deck.slice().sort((a, b) => getUnitDef(a).cost - getUnitDef(b).cost);
    return (game) => {
      for (const id of sortedDeck) {
        if (affordable(game, id, getUnitDef)) return { summon: id };
      }
      return null;
    };
  }

  // --------------------------------------------------------------------------
  // MeatshieldDPSBot:確保場上至少 N 隻肉盾(defender/heavy),其他錢買最高 DPS。
  // DPS 估算:atk / attackCd。
  // --------------------------------------------------------------------------
  const TANK_IDS = new Set(['defender', 'heavy']);

  function MeatshieldDPSBot({ deck, getUnitDef, minTanks = 2 }) {
    const tanksInDeck = deck.filter(id => TANK_IDS.has(id));
    const dpsRanked = deck
      .filter(id => !TANK_IDS.has(id))
      .map(id => ({ id, def: getUnitDef(id) }))
      .filter(x => x.def)
      .sort((a, b) => (b.def.atk / b.def.attackCd) - (a.def.atk / a.def.attackCd))
      .map(x => x.id);

    return (game) => {
      const livingTanks = game.playerUnits.filter(u => u.hp > 0 && TANK_IDS.has(u.def.id)).length;
      // 缺肉盾就先補
      if (livingTanks < minTanks) {
        for (const id of tanksInDeck) {
          if (affordable(game, id, getUnitDef)) return { summon: id };
        }
      }
      // 沒缺肉盾,出最高 DPS
      for (const id of dpsRanked) {
        if (affordable(game, id, getUnitDef)) return { summon: id };
      }
      // DPS 都出不起,有錢就補肉盾
      for (const id of tanksInDeck) {
        if (affordable(game, id, getUnitDef)) return { summon: id };
      }
      return null;
    };
  }

  const BOTS = {
    random:     { name: 'Random',      make: RandomBot,        seeded: true  },
    rush:       { name: 'Rush',        make: RushBot,          seeded: false },
    meatshield: { name: 'Meatshield',  make: MeatshieldDPSBot, seeded: false },
  };

  const exportsObj = { BOTS, RandomBot, RushBot, MeatshieldDPSBot, makeRng };
  if (isNode) module.exports = exportsObj;
  else globalThis.Bots = exportsObj;
})();
