import * as THREE from './vendor/three.module.js';

const clamp = THREE.MathUtils.clamp;
const worldX = x => (x - 720) / 40;
const worldY = y => (255 - y) / 40;

// A real WebGL diorama: all animals, terrain, plants and water are 3D geometry.
export class Breath3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setClearColor('#d9e4d9');
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#d9e4d9', 62, 125);
    this.camera = new THREE.OrthographicCamera(-23, 23, 13, -13, .1, 180);
    this.target = new THREE.Vector3(0, -4.6, 0);
    this.mode = 'diorama'; this.yaw = .22; this.pitch = .32; this.zoom = 1; this.angle = 0;
    this.plants = []; this.fish = []; this.friends = []; this.ripples = [];
    this.seed = 381;
    this.sphereGeo = new THREE.SphereGeometry(1, 20, 14);
    this.rockGeo = new THREE.IcosahedronGeometry(1, 1);
    this.materials = new Map();
    this.scene.add(new THREE.HemisphereLight('#ffffe9', '#4b7f81', 2.3));
    const sunlight = new THREE.DirectionalLight('#fff2ce', 3.3);
    sunlight.position.set(-12, 25, 14); sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(2048, 2048);
    Object.assign(sunlight.shadow.camera, { left: -27, right: 27, top: 21, bottom: -21, near: .5, far: 80 });
    sunlight.shadow.normalBias = .035; sunlight.shadow.bias = -.00015;
    sunlight.target.position.set(0, -5, 0); this.scene.add(sunlight, sunlight.target);
    const rim = new THREE.DirectionalLight('#acdfe0', 1.4); rim.position.set(12, 2, -14); this.scene.add(rim);
    this.buildWorld();
    this.player = this.makeSeal(); this.scene.add(this.player);
    for (let i = 0; i < 3; i++) { const friend = this.makeSeal(true); friend.scale.setScalar(.66); friend.position.set(worldX(100 + i * 59), .77, -.5 + i * .55); friend.rotation.y = i % 2 ? Math.PI : 0; this.scene.add(friend); this.friends.push(friend); }
    this.buildBubbles();
    this.controls();
    canvas.addEventListener('webglcontextlost', e => {
      e.preventDefault(); document.getElementById('pauseButton').click();
      document.getElementById('statusText').textContent = '3D 畫面暫停，請重新整理頁面以恢復。';
    });
  }
  random() { this.seed = this.seed * 16807 % 2147483647; return (this.seed - 1) / 2147483646; }
  mat(color, extra = {}) {
    const key = color + JSON.stringify(extra);
    if (!this.materials.has(key)) this.materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: .78, ...extra }));
    return this.materials.get(key);
  }
  mesh(geometry, material, position, scale, parent = this.scene) {
    const m = new THREE.Mesh(geometry, material);
    if (position) m.position.set(...position); if (scale) m.scale.set(...scale);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  orb(color, position, scale, parent, extra) { return this.mesh(this.sphereGeo, this.mat(color, extra), position, scale, parent); }
  rock(color, position, scale) {
    const rock = this.mesh(this.rockGeo, this.mat(color, { flatShading: true }), position, scale);
    rock.rotation.set(this.random(), this.random() * 4, this.random() * .4); return rock;
  }
  tube(points, color, radius, parent = this.scene) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    return this.mesh(new THREE.TubeGeometry(curve, 12, radius, 5, false), this.mat(color), null, null, parent);
  }
  buildWorld() {
    const floor = this.mesh(new THREE.PlaneGeometry(250, 250), this.mat('#d4dfd2'), [0, -13.4, 0]);
    floor.rotation.x = -Math.PI / 2; floor.castShadow = false;
    const base = this.mesh(new THREE.BoxGeometry(37.6, .65, 12), this.mat('#bcc9b3'), [0, -12.55, 0]);
    base.receiveShadow = true;
    this.mesh(new THREE.BoxGeometry(37.2, .35, 11.65), this.mat('#d3d3b5'), [0, -12.12, 0]);
    // A sloping island shelf. Top surface agrees with the shared gameplay shoreline.
    this.mesh(new THREE.BoxGeometry(8.2, 11.5, 10.5), this.mat('#758d7e', { flatShading: true }), [-13.8, -5.8, -.2]);
    this.orb('#8d9e83', [-13.7, -5.6, -.2], [4.5, 5.4, 5.2]);
    this.orb('#dcd7b1', [-13.7, -.15, 0], [4.7, .6, 5.3]);
    this.orb('#9eaf83', [-14.7, .23, -.8], [3.6, .32, 4.2]);
    this.rock('#a9b393', [-16.3, .65, -1.9], [1.2, .75, 1.0]);
    this.rock('#c5c6a5', [-15, .63, -2.5], [.7, .6, .8]);
    this.rock('#b2bd9c', [-12.5, .38, -3.5], [.6, .35, .45]);
    this.rock('#819986', [-14.8, -3.7, 4.7], [2.1, 2.5, .6]);
    this.rock('#6e8b7b', [-12.8, -8, 4.9], [2.5, 2.8, .4]);
    this.rock('#93a28b', [-10.4, -2.7, 3.8], [.6, 2.1, 1]);
    for (let i = 0; i < 19; i++) {
      const x = -17 + this.random() * 4.4, z = -3.7 + this.random() * 5;
      this.tube([[x,.45,z],[x-.12,1,z],[x+.08,1.3+this.random()*.45,z]], '#799573', .032);
    }
    // Open-front water block preserves a clear view of the animals inside.
    const back = this.mesh(new THREE.PlaneGeometry(27.5, 12), this.mat('#589e9d', { roughness: 1 }), [4.15, -6, -5.3]); back.castShadow = false;
    const seabed = new THREE.PlaneGeometry(27.5, 10.6, 36, 14);
    const sp = seabed.attributes.position;
    for (let i = 0; i < sp.count; i++) sp.setZ(i, Math.sin(sp.getX(i)*.55)*.15 + Math.cos(sp.getY(i)*.7)*.18);
    seabed.computeVertexNormals();
    const sand = this.mesh(seabed, this.mat('#9fae8b'), [4.15, -11.9, 0]); sand.rotation.x = -Math.PI / 2;
    const wallMat = new THREE.MeshBasicMaterial({ color: '#56a79e', transparent: true, opacity: .12, depthWrite: false, side: THREE.DoubleSide });
    const front = this.mesh(new THREE.PlaneGeometry(27.5, 12), wallMat, [4.15, -6, 5.31]); front.castShadow = false; front.renderOrder = 5;
    const end = this.mesh(new THREE.PlaneGeometry(10.6, 12), wallMat, [17.9, -6, 0]); end.rotation.y = Math.PI / 2; end.castShadow = false;
    const waterGeometry = new THREE.PlaneGeometry(27.5, 10.6, 70, 25); waterGeometry.rotateX(-Math.PI/2);
    const waterMaterial = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: `uniform float time; varying vec3 pos; varying float wave; void main(){pos=position; wave=sin(position.x*1.4+time*.7)*.055+cos(position.z*2.1+time*.5)*.045; vec3 p=position;p.y+=wave;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
      fragmentShader: `uniform float time; varying vec3 pos; varying float wave; void main(){float ripple=pow(max(0.,sin(pos.x*2.8+pos.z*2.2+sin(pos.z*1.4+time)*.5+time*.5)),24.);vec3 color=mix(vec3(.34,.66,.62),vec3(.85,.96,.82),ripple*.55+wave*.7);gl_FragColor=vec4(color,.26+ripple*.18);}`
    });
    this.water = this.mesh(waterGeometry, waterMaterial, [4.15, 0, 0]); this.water.castShadow = false; this.water.renderOrder = 4;
    // Thin pale edges make the water's volume legible without a solid front wall.
    const lineMat = new THREE.LineBasicMaterial({ color: '#c2e1cd', transparent: true, opacity: .65 });
    const outline = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-9.6,0,5.3),new THREE.Vector3(17.9,0,5.3),new THREE.Vector3(17.9,-12,5.3)]);
    this.scene.add(new THREE.Line(outline, lineMat));
    for (let i=0; i<19; i++) {
      const r = new THREE.Mesh(new THREE.RingGeometry(.5, .512, 48), new THREE.MeshBasicMaterial({color:'#e4efce',transparent:true,opacity:.3,side:THREE.DoubleSide,depthWrite:false}));
      r.rotation.x=-Math.PI/2;r.scale.set(1.7+this.random()*2, .4+this.random(), 1);r.position.set(-7+this.random()*24,.08,-4+this.random()*8);this.scene.add(r);this.ripples.push(r);
    }
    for(let i=0;i<24;i++) {
      const x=-8.6+this.random()*25.5,z=-4.6+this.random()*9;
      this.rock(['#708f84','#899d8a','#b4b693'][i%3],[x,-11.65,z],[.35+this.random()*1.1,.3+this.random()*.8,.4+this.random()*.75]);
    }
    for(let i=0;i<35;i++) {
      const x=-8.5+this.random()*25.8,z=-4.5+this.random()*9;
      // Keep the central swimming corridor readable.
      if(Math.abs(z)<1.4&&i%2)continue;
      const plant=new THREE.Group();plant.position.set(x,-11.7,z);this.scene.add(plant);
      const h=1+this.random()*2.8, color=['#608f73','#78a98a','#3e7c73','#86aa88'][i%4];
      this.tube([[0,0,0],[.12,h*.35,.02],[-.08,h*.7,0],[.15,h,0]],color,.055,plant);
      for(let j=1;j<5;j++) {
        const side=j%2?1:-1, leaf=this.orb(color,[side*.23,h*j/5,0],[.14,.46,.055],plant);
        leaf.rotation.z=side*-.58;
      }
      this.plants.push({group:plant,phase:this.random()*6});
    }
    for(const [x,z,s] of [[12,3.5,1.2],[-6,3.6,.8],[15,-3.7,.85],[3,-4,1]])this.coral(x,z,s);
    // Floating motes and suspended light make the water feel alive.
    const particlePos=new Float32Array(160*3);
    for(let i=0;i<160;i++){particlePos[i*3]=-8+this.random()*25;particlePos[i*3+1]=-this.random()*11.3;particlePos[i*3+2]=-4.8+this.random()*9.6;}
    const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.BufferAttribute(particlePos,3));
    this.motes=new THREE.Points(geom,new THREE.PointsMaterial({color:'#e2f1cc',size:.065,transparent:true,opacity:.48,depthWrite:false}));this.scene.add(this.motes);
    const rayMat=new THREE.MeshBasicMaterial({color:'#e8f0b9',transparent:true,opacity:.035,side:THREE.DoubleSide,depthWrite:false});
    for(let i=0;i<5;i++){const ray=this.mesh(new THREE.CylinderGeometry(.16,.8,10,12,1,true),rayMat,[-5+i*4.8,-5,-3.9]);ray.rotation.z=-.15;ray.castShadow=false;}
  }
  coral(x,z,s) {
    const g=new THREE.Group();g.position.set(x,-11.7,z);g.scale.setScalar(s);this.scene.add(g);
    const c='#c7ac95';this.tube([[0,0,0],[.08,.8,0],[-.1,1.7,0]],c,.07,g);
    this.tube([[0,.55,0],[-.45,.85,.1],[-.62,1.35,.15]],c,.055,g);
    this.tube([[0,.85,0],[.5,1.15,0],[.58,1.7,.1]],c,.05,g);
    this.tube([[.38,1.07,0],[.3,1.52,-.1]],c,.044,g);
    this.tube([[-.35,.8,.1],[-.8,1.05,0]],c,.04,g);
  }
  makeSeal(friend=false) {
    const g=new THREE.Group(),body=friend?'#b4c9b5':'#e5e9cf',flipper='#a4bdaa';
    this.orb(body,[-.18,0,0],[.96,.46,.44],g);
    this.orb(body,[.53,.3,0],[.52,.51,.44],g);
    this.orb('#f1f0d9',[.93,.13,.08],[.28,.2,.3],g);
    const tail1=this.orb(flipper,[-1.04,-.07,.2],[.45,.095,.2],g);tail1.rotation.y=-.6;
    const tail2=this.orb(flipper,[-1.04,-.07,-.2],[.45,.095,.2],g);tail2.rotation.y=.6;
    const fin=this.orb(flipper,[.05,-.24,.44],[.32,.11,.26],g);fin.rotation.z=-.35;
    const farFin=this.orb(flipper,[.05,-.24,-.43],[.32,.11,.25],g);farFin.rotation.z=.25;
    for(const side of [-1,1]) {
      this.orb('#294d43',[.78,.38,side*.342],[.062,.081,.035],g,{roughness:.3});
      this.orb('#fffae4',[.805,.412,side*.363],[.017,.023,.011],g);
      this.orb('#d6b6a0',[.76,.13,side*.36],[.085,.045,.018],g);
      for(let j=0;j<3;j++)this.tube([[1.04,.11-j*.04,side*.17],[1.25,.13-j*.07,side*.33],[1.34,.16-j*.09,side*.46]],'#6f8974',.009,g);
    }
    this.orb('#526b58',[1.15,.22,0],[.073,.05,.10],g);
    for(let i=0;i<7;i++)this.orb('#a9bf9e',[-.67+i*.14,.32-Math.abs(i-3)*.025,.26],[.035,.018,.025],g);
    g.userData={fin,farFin,tail1,tail2};return g;
  }
  makeFish(tier) {
    const g=new THREE.Group(),color=['#dfdfad','#e4c68f','#e6a886'][tier];
    this.orb(color,[0,0,0],[.27,.14,.10],g);
    const tail=this.mesh(new THREE.ConeGeometry(.16,.25,3),this.mat(color),[-.31,0,0],[1,1,.65],g);tail.rotation.z=-Math.PI/2;
    const fin=this.mesh(new THREE.ConeGeometry(.08,.15,3),this.mat(color),[-.06,.13,0],[1,1,.5],g);fin.rotation.z=.4;
    for(const side of [-1,1])this.orb('#496757',[.17,.025,side*.081],[.018,.023,.01],g);
    g.userData.tail=tail;return g;
  }
  buildBubbles() {
    const geo=new THREE.SphereGeometry(.07,8,6),mat=new THREE.MeshStandardMaterial({color:'#e3f3db',transparent:true,opacity:.5,roughness:.15,metalness:.05});
    this.bubbles=Array.from({length:35},()=>{const b=new THREE.Mesh(geo,mat);b.visible=false;this.scene.add(b);return b;});
    this.callRing=new THREE.Mesh(new THREE.TorusGeometry(1,.018,6,64),new THREE.MeshBasicMaterial({color:'#f1ddb1',transparent:true,opacity:.7,depthWrite:false}));
    this.callRing.rotation.x=-Math.PI/2;this.callRing.visible=false;this.scene.add(this.callRing);
    // A subtle marker helps locate the player within the three-dimensional volume.
    this.marker=new THREE.Mesh(new THREE.RingGeometry(.7,.725,48),new THREE.MeshBasicMaterial({color:'#f8eec6',transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false}));
    this.marker.rotation.x=-Math.PI/2;this.scene.add(this.marker);
  }
  controls() {
    for(const button of document.querySelectorAll('[data-camera]'))button.addEventListener('click',()=>{
      this.mode=button.dataset.camera;this.zoom=1;
      if(this.mode==='side'){this.yaw=0;this.pitch=.045;}else{this.yaw=.22;this.pitch=.32;}
      this.updateButtons();this.canvas.focus({preventScroll:true});
    });
    let drag=null;
    this.canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;if(this.mode!=='custom')this.customFollowing=this.mode==='follow'||(this.narrow&&this.mode==='diorama');drag={x:e.clientX,y:e.clientY};this.canvas.setPointerCapture(e.pointerId);});
    this.canvas.addEventListener('pointermove',e=>{if(!drag)return;this.yaw=clamp(this.yaw-(e.clientX-drag.x)*.007,-1.1,1.1);this.pitch=clamp(this.pitch+(e.clientY-drag.y)*.005,-.02,.9);drag={x:e.clientX,y:e.clientY};this.mode='custom';this.updateButtons();});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])this.canvas.addEventListener(event,()=>{drag=null;});
    this.canvas.addEventListener('wheel',e=>{e.preventDefault();this.zoom=clamp(this.zoom*Math.exp(-e.deltaY*.001),.7,2.1);},{passive:false});
  }
  updateButtons(){for(const b of document.querySelectorAll('[data-camera]'))b.setAttribute('aria-pressed',String(b.dataset.camera===this.mode));}
  resize(w,h,dpr) {this.width=w;this.height=h;this.narrow=w<760;this.renderer.setPixelRatio(Math.min(dpr,1.7));this.renderer.setSize(w,h,false);}
  render(game,t,particles,waves) {
    const ready=game.status==='ready';
    this.water.material.uniforms.time.value=t;
    for(const {group,phase} of this.plants)group.rotation.z=Math.sin(t*.65+phase)*.08;
    for(let i=0;i<this.ripples.length;i++)this.ripples[i].position.y=.085+Math.sin(t*.5+i)*.025;
    this.motes.position.y=Math.sin(t*.15)*.15;
    while(this.fish.length<game.fish.length){const f=this.makeFish(game.fish[this.fish.length].tier);this.fish.push(f);this.scene.add(f);}
    for(let i=0;i<game.fish.length;i++) {
      const source=game.fish[i],f=this.fish[i];f.visible=source.active;
      f.position.set(worldX(source.x)+(ready?Math.sin(t*.4+source.phase)*.6:0),worldY(source.y)+Math.sin(t*2.5+source.phase)*.045,source.z/40);
      f.rotation.y=source.direction===1?0:Math.PI;f.userData.tail.rotation.y=Math.sin(t*7+source.phase)*.25;
    }
    const px=ready?2.3+Math.sin(t*.4)*.8:worldX(game.x),py=ready?-3.3+Math.sin(t*.8)*.2:worldY(game.y),pz=ready?.3:game.z/40;
    this.player.position.set(px,py,pz);
    const angle=game.facing===1?0:Math.PI;
    const delta=Math.atan2(Math.sin(angle-this.angle),Math.cos(angle-this.angle));this.angle+=delta*.14;
    this.player.rotation.y=ready?-.18:this.angle;
    this.player.rotation.z=ready?Math.sin(t)*.045:clamp(-game.velocity.y/1600,-.18,.18)*game.facing;
    const flap=Math.sin(t*(game.onLand&&!ready?1.8:6))*.24;
    this.player.userData.fin.rotation.x=flap;this.player.userData.farFin.rotation.x=-flap;this.player.userData.tail1.rotation.z=flap*.3;
    this.player.scale.setScalar(ready?1.25:1);
    this.friends.forEach((f,i)=>{f.visible=i<game.companions;f.userData.fin.rotation.x=Math.sin(t*2+i)*.08;});
    this.marker.position.set(px,-11.65,pz);this.marker.visible=!ready&&!game.onLand;
    for(let i=0;i<this.bubbles.length;i++) {
      const b=this.bubbles[i],p=particles[i];b.visible=!!p;
      if(p){b.position.set(worldX(p.x),worldY(p.y),pz+Math.sin(i)*.18);b.scale.setScalar(p.size*.32);}
      if(ready&&i<9){b.visible=true;b.position.set(px+1.3+Math.sin(i+t)*.1,py+((t*.5+i*.35)%3.4),pz);b.scale.setScalar(.4+(i%3)*.25);}
    }
    this.callRing.visible=waves.length>0;
    if(waves.length){const w=waves[0];this.callRing.position.set(worldX(w.x),.1,game.z/40);this.callRing.scale.setScalar(1+(2-w.life)*1.9);this.callRing.material.opacity=w.life*.4;}
    // Narrow screens automatically keep the current swimmer in view.
    const following=this.mode==='follow'||(this.narrow&&this.mode==='diorama')||(this.mode==='custom'&&this.customFollowing);
    const destination=following?new THREE.Vector3(px,py-1,0):new THREE.Vector3(0,-4.7,0);
    this.target.lerp(destination,.075);
    const aspect=this.width/this.height;
    const half=(following?(this.narrow?7.5:7.8):Math.max(12.3,21/aspect))/this.zoom;
    this.camera.left=-half*aspect;this.camera.right=half*aspect;this.camera.top=half;this.camera.bottom=-half;this.camera.updateProjectionMatrix();
    this.camera.position.set(this.target.x+Math.sin(this.yaw)*44,this.target.y+Math.sin(this.pitch)*44,Math.cos(this.yaw)*Math.cos(this.pitch)*44);
    this.camera.lookAt(this.target);
    this.renderer.render(this.scene,this.camera);
  }
}
