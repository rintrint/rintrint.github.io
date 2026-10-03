import {PulseHud} from './pulse-hud.js';
export class DuetHud extends PulseHud{
  event(e,g){super.event(e,g);if(e.type==='miss')document.getElementById('timing').textContent={early:'TOO EARLY · 太早按',lane:'WRONG LANE · 按錯軌',empty:'EMPTY HIT · 空拍'}[e.reason]||'MISS · 錯過拍點';}
  draw(g,dt){super.draw(g,dt);document.getElementById('stabilityValue').textContent=Math.ceil(g.stability)+'%';document.getElementById('stabilityFill').style.width=g.stability+'%';document.getElementById('stabilityMeter').setAttribute('aria-valuenow',Math.ceil(g.stability));document.getElementById('stabilityMeter').classList.toggle('low',g.stability<35);}
}
