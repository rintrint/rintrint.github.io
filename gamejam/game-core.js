(function (root) {
  'use strict';
  const W = 1440, H = 760, SURFACE = 255, SHORE = 335, PERIOD = 3.2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  class Game {
    constructor(random = Math.random, options = {}) { this.random = random; this.is3D = options.dimensions === 3; this.status = 'ready'; this.reset(); this.status = 'ready'; }
    reset() {
      this.status = 'playing'; this.x = 247; this.y = 224; this.z = 0; this.facing = 1;
      this.oxygen = 100; this.food = 0; this.collected = 0; this.companions = 0;
      this.elapsed = 1.3; this.duration = 0; this.maxDepth = 0; this.perfects = 0;
      this.boost = 0; this.lastBreath = -10; this.lastCall = -10; this.events = []; this.fish = [];
      this.velocity = { x: 0, y: 0, z: 0 }; this.lowWarned = false;
      for (let i = 0; i < 27; i++) this.fish.push(this.makeFish(i));
    }
    makeFish(i) {
      const tier = i % 3;
      return { x: 460 + this.random() * 830, y: 335 + tier * 138 + this.random() * 65,
        homeX: 460 + this.random() * 790, tier, value: tier + 1,
        z: this.is3D ? Math.sin(i * 2.4) * 95 : 0,
        phase: this.random() * Math.PI * 2, speed: 9 + this.random() * 17,
        direction: this.random() > .5 ? 1 : -1, active: true, respawn: 0 };
    }
    get onLand() { return this.x < SHORE && this.y <= SURFACE + 5; }
    get atAir() { return this.onLand || this.y <= SURFACE + 6; }
    get depth() { return Math.max(0, (this.y - SURFACE) / 7); }
    get phase() { return (this.elapsed % PERIOD) / PERIOD; }
    get onBeat() { return Math.min(this.phase, 1 - this.phase) * PERIOD <= .34; }
    emit(type, text) { this.events.push({ type, text }); }
    breathe() {
      if (this.status !== 'playing' || this.elapsed - this.lastBreath < .48) return false;
      this.lastBreath = this.elapsed;
      if (this.onBeat) {
        this.perfects++; this.boost = 1.5;
        if (this.atAir) this.oxygen = Math.min(100, this.oxygen + 25);
        this.emit('perfect', this.atAir ? '很好的呼吸 ＋25' : '輕盈划水 · 更省氧');
      } else {
        if (this.atAir) this.oxygen = Math.min(100, this.oxygen + 6);
        this.emit('breath', this.atAir ? '慢慢來，等光圈靠攏' : '等光圈靠攏，再輕輕划水');
      }
      return this.onBeat;
    }
    call() {
      if (this.status !== 'playing' || this.elapsed - this.lastCall < 1) return;
      this.lastCall = this.elapsed;
      if (!this.onLand) { this.emit('hint', '先回到左側岸上，再呼喚同伴'); return; }
      if (this.food < 5) { this.emit('hint', `再帶回 ${5 - this.food} 份小魚，就能一起分享`); return; }
      this.food -= 5; this.companions++; this.emit('friend', '你的呼喚，有了回應 ♡');
      if (this.companions >= 3) { this.status = 'won'; this.emit('won', '每一次呼吸，都是為了相聚。'); }
    }
    update(dt, input = {}) {
      if (this.status !== 'playing') return;
      dt = clamp(dt, 0, .05); this.elapsed += dt; this.duration += dt;
      this.boost = Math.max(0, this.boost - dt);
      let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      let dz = this.is3D ? (input.forward ? 1 : 0) - (input.back ? 1 : 0) : 0;
      const mag = Math.hypot(dx, dy, dz); if (mag > 1) { dx /= mag; dy /= mag; dz /= mag; }
      const speed = (this.onLand ? 145 : 195) * (this.boost > 0 && !this.onLand ? 1.48 : 1);
      this.velocity.x = dx * speed; this.velocity.y = dy * speed; this.velocity.z = dz * speed;
      if (dx) this.facing = dx > 0 ? 1 : -1;
      const wasOnLand = this.onLand;
      this.x = clamp(this.x + dx * speed * dt, 50, W - 60);
      this.z = clamp(this.z + dz * speed * dt, -130, 130);
      this.y = clamp(this.y + dy * speed * dt, SURFACE - 2, H - 55);
      if (wasOnLand && this.x < SHORE) this.y = 224 + Math.max(0, this.x - 245) * .30;
      else if (this.x < SHORE) {
        if (this.y <= SURFACE + 6) this.y = 224 + Math.max(0, this.x - 245) * .30;
        else this.x = SHORE;
      }
      if (wasOnLand && !this.onLand) this.emit('splash', '');
      if (this.atAir) this.oxygen = Math.min(100, this.oxygen + dt * 5.5);
      else this.oxygen = Math.max(0, this.oxygen - dt * (3.4 + this.depth * .075) * (this.boost > 0 ? .55 : 1));
      this.maxDepth = Math.max(this.maxDepth, this.depth);
      if (this.oxygen < 25 && !this.lowWarned) { this.lowWarned = true; this.emit('warning', '氧氣不多了，往上回到水面 ↑'); }
      if (this.oxygen > 50) this.lowWarned = false;
      if (this.oxygen <= 0) { this.status = 'lost'; this.emit('lost', '這一口氣，沒能帶你回到岸邊。'); return; }
      for (const f of this.fish) {
        if (!f.active) { f.respawn -= dt; if (f.respawn <= 0) { Object.assign(f, this.makeFish(f.tier)); } continue; }
        f.x += f.direction * f.speed * dt;
        if (f.x < 390 || f.x > W - 60) { f.direction *= -1; f.x = clamp(f.x, 390, W - 60); }
        if (!this.atAir && Math.hypot(f.x - this.x, f.y - this.y, this.is3D ? f.z - this.z : 0) < 40) {
          f.active = false; f.respawn = 16; this.food += f.value; this.collected += f.value;
          this.emit('fish', `小魚 ＋${f.value}`);
        }
      }
    }
  }
  const api = { Game, W, H, SURFACE, SHORE, PERIOD, clamp };
  root.BreathGame = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
