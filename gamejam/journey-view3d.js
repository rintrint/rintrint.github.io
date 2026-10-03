import * as THREE from './vendor/three.module.js';
const {SURFACE,HOLES,LENGTH,clamp}=window.BreathJourney;
const X=x=>x/32,Y=y=>(SURFACE-y)/32;

export class Ice3D {
  constructor(canvas){
    this.canvas=canvas;this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.setClearColor('#16466b');this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.08;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-25,25,15,-15,.1,170);
    this.target=new THREE.Vector3(X(420)+5,-6.3,0);this.side=false;this.seed=953;this.look=0;this.facing=0;
    this.sphere=new THREE.SphereGeometry(1,24,16);this.rockGeo=new THREE.IcosahedronGeometry(1,1);this.mats=new Map();
    this.scene.add(new THREE.HemisphereLight('#e7efff','#093d61',2.1));
    this.sun=new THREE.DirectionalLight('#ffe3c0',3.6);this.sun.position.set(X(420)-15,23,15);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-29,right:29,top:26,bottom:-28,near:.1,far:95});this.sun.shadow.normalBias=.035;this.sun.shadow.bias=-.00015;this.scene.add(this.sun,this.sun.target);
    this.fill=new THREE.DirectionalLight('#66cfea',2.1);this.fill.position.set(X(420)+8,-2,14);this.scene.add(this.fill,this.fill.target);
    this.matcap=this.furTexture();this.buildWorld();
    this.player=this.seal();this.scene.add(this.player);this.friends=[];
    this.playerMaterials=[];this.player.traverse(n=>{if(n.isMesh){n.material=n.material.clone();this.playerMaterials.push(n.material);}});
    this.spirit=this.seal();this.spirit.visible=false;this.scene.add(this.spirit);
    this.spirit.traverse(n=>{if(n.isMesh){n.material=n.material.clone();n.material.transparent=true;n.material.opacity=.65;n.material.depthWrite=false;n.castShadow=false;}});
    this.halo=this.mesh(new THREE.TorusGeometry(.55,.025,8,48),new THREE.MeshBasicMaterial({color:'#ffe8a9'}),[.8,1.2,0],null,this.spirit);this.halo.rotation.x=Math.PI/2;
    this.wings=new THREE.Group();this.spirit.add(this.wings);
    for(const side of [-1,1])for(let i=0;i<5;i++){
      const feather=this.orb('#fff6de',[-.4-i*.14,.35+i*.13,side*(.58+i*.13)],[.55-i*.05,.10,.34],this.wings,{emissive:'#ffe6ab',emissiveIntensity:.35});feather.rotation.x=side*(.4+i*.08);feather.rotation.z=.35;
    }
    this.ghostMouth=this.orb('#53647e',[1.38,.2,.34],[.075,.12,.045],this.spirit);
    this.ghostModel=new THREE.Group();this.ghostModel.visible=false;this.scene.add(this.ghostModel);
    const ghostShape=new THREE.Shape();ghostShape.moveTo(-1.35,-.3);ghostShape.bezierCurveTo(-1.4,.65,-.65,1,.2,.82);ghostShape.bezierCurveTo(1.1,.8,1.65,.15,1.1,-.3);
    for(let i=0;i<5;i++)ghostShape.quadraticCurveTo(.88-i*.48,-.72,.64-i*.48,-.30);ghostShape.closePath();
    const ghostMaterial=new THREE.MeshPhysicalMaterial({color:'#bcd6ef',transparent:true,opacity:.72,roughness:.4,emissive:'#7daccf',emissiveIntensity:.3,depthWrite:false});
    this.mesh(new THREE.ExtrudeGeometry(ghostShape,{depth:.55,bevelEnabled:true,bevelSize:.13,bevelThickness:.12,bevelSegments:3,steps:1,curveSegments:24}),ghostMaterial,[0,0,-.3],null,this.ghostModel);
    for(const x of [.52,.88])this.orb('#304867',[x,.26,.4],[.055,.095,.035],this.ghostModel);
    this.orb('#536c89',[.73,-.03,.43],[.09,.14,.045],this.ghostModel);
    this.orb('#88abc7',[-.43,.06,.41],[.32,.17,.028],this.ghostModel,{transparent:true,opacity:.55});
    this.ghostModel.traverse(n=>{n.castShadow=false;});
    this.growthRing=this.mesh(new THREE.TorusGeometry(1,.018,6,72),new THREE.MeshBasicMaterial({color:'#ffdf9b',transparent:true,opacity:0,depthWrite:false}),[0,0,1]);this.growthRing.visible=false;
    for(let i=0;i<3;i++){const friend=this.seal();friend.scale.setScalar(.68+i*.04);friend.visible=false;this.scene.add(friend);this.friends.push(friend);}
    this.fish=[];for(let i=0;i<54;i++){const f=this.fishMesh(i%3);this.scene.add(f);this.fish.push(f);}
    this.fishers=[this.fisher(1),this.fisher(2)];this.buildEffects();
    this.ready=new Promise((resolve,reject)=>new THREE.TextureLoader().load('assets/glacier-world.png',texture=>{
      texture.colorSpace=THREE.SRGBColorSpace;
      this.backdrop=this.mesh(new THREE.PlaneGeometry(100,56.25),new THREE.MeshBasicMaterial({map:texture}),[this.target.x,-15.0,-45]);this.backdrop.castShadow=false;resolve();
    },undefined,reject));
    canvas.addEventListener('pointermove',e=>{this.look=(e.clientX/innerWidth-.5)*.10;});
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();document.getElementById('pauseButton')?.click();const copy=document.getElementById('modalCopy');if(copy)copy.textContent='3D 畫面暫時中斷，重新整理可恢復，也可以切換 2D 繪本版。';});
  }
  random(){this.seed=this.seed*16807%2147483647;return(this.seed-1)/2147483646;}
  mat(color,extra={}){const key=color+JSON.stringify(extra);if(!this.mats.has(key))this.mats.set(key,new THREE.MeshStandardMaterial({color,roughness:.63,...extra}));return this.mats.get(key);}
  mesh(geo,mat,pos,scale,parent=this.scene){const m=new THREE.Mesh(geo,mat);if(pos)m.position.set(...pos);if(scale)m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  orb(color,pos,scale,parent,extra){return this.mesh(this.sphere,this.mat(color,extra),pos,scale,parent);}
  tube(points,color,radius,parent=this.scene){const c=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return this.mesh(new THREE.TubeGeometry(c,12,radius,5,false),this.mat(color),null,null,parent);}
  furTexture(){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d');c.fillStyle='#e9e5d3';c.fillRect(0,0,512,512);
    for(let i=0;i<80;i++){const x=this.random()*512,y=this.random()*512,r=5+this.random()*9;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'#9caaab66');g.addColorStop(1,'#bdc6be00');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
    for(let i=0;i<22000;i++){const x=this.random()*512,y=this.random()*512;c.strokeStyle=i%2?'#fff8e828':'#667d8620';c.lineWidth=.5;c.beginPath();c.moveTo(x,y);c.lineTo(x+this.random()*3,y+2+this.random()*4);c.stroke();}
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;return texture;
  }
  glacier(a,b){
    if(b-a<1)return;const shape=new THREE.Shape();shape.moveTo(a,.20);
    for(let x=a;x<b;x+=.7)shape.lineTo(x,.3+Math.sin(x*1.7)*.09);shape.lineTo(b,.2);shape.lineTo(b,-.65);
    for(let x=b;x>a;x-=.4)shape.lineTo(x,-1.6+Math.sin(x*.45)*.35+Math.sin(x*.87)*.5+Math.sin(x*1.21)*.25);
    shape.lineTo(a,-.65);shape.closePath();
    const geo=new THREE.ExtrudeGeometry(shape,{depth:9.5,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.16,bevelThickness:.13,curveSegments:4});
    const colors=[],p=geo.attributes.position;
    for(let i=0;i<p.count;i++){const h=clamp((p.getY(i)+3.2)/3.8,0,1);const color=new THREE.Color().setHSL(.55+.025*(1-h),.36+.35*(1-h),.29+.58*h);colors.push(color.r,color.g,color.b);}
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    this.mesh(geo,this.mat('#ffffff',{vertexColors:true,roughness:.39,metalness:.08}),[0,0,-4.75]);
    const snowShape=new THREE.Shape();snowShape.moveTo(a-.12,.35);for(let x=a;x<b;x+=.6)snowShape.lineTo(x,.46+Math.sin(x*1.8)*.10);snowShape.lineTo(b+.12,.32);snowShape.lineTo(b,.14);snowShape.lineTo(a,.17);snowShape.closePath();
    this.mesh(new THREE.ExtrudeGeometry(snowShape,{depth:9.8,bevelEnabled:true,bevelSize:.09,bevelThickness:.08,bevelSegments:2}),this.mat('#edf5f1',{roughness:.88}),[0,0,-4.9]);
    const lineMaterial=new THREE.LineBasicMaterial({color:'#cefaff',transparent:true,opacity:.4});
    for(let x=a+.9;x<b-.2;x+=1.3){const points=[new THREE.Vector3(x,.1,4.95),new THREE.Vector3(x-.15,-.5,4.99),new THREE.Vector3(x+.23,-1.35,4.99)];this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),lineMaterial));}
  }
  buildWorld(){
    let start=-20;for(const hole of [...HOLES,LENGTH+700]){const end=X(hole)-1.6;this.glacier(start,end);start=X(hole)+1.6;}
    // Long, light-catching ice needles below the shelf. Instanced for stable frame time.
    const crystalGeo=new THREE.ConeGeometry(1,1,5,1),crystalMat=this.mat('#7bc4dc',{roughness:.28,metalness:.15,flatShading:true});
    const crystals=new THREE.InstancedMesh(crystalGeo,crystalMat,120),dummy=new THREE.Object3D();
    for(let i=0;i<120;i++){
      let x=-12+this.random()*150;const tooClose=HOLES.some(h=>Math.abs(X(h)-x)<2);if(tooClose)x+=3;
      const length=1.0+this.random()*3.9;dummy.position.set(x,-1.1-length/2,-3.4+this.random()*2);dummy.rotation.set(Math.PI,0,(this.random()-.5)*.3);dummy.scale.set(.12+this.random()*.3,length,.16+this.random()*.3);dummy.updateMatrix();crystals.setMatrixAt(i,dummy.matrix);
    }crystals.castShadow=true;this.scene.add(crystals);
    const waterGeo=new THREE.PlaneGeometry(170,40,150,30);waterGeo.rotateX(-Math.PI/2);
    this.waterMaterial=new THREE.ShaderMaterial({uniforms:{time:{value:0},pulse:{value:0}},transparent:true,depthWrite:false,side:THREE.DoubleSide,
      vertexShader:`uniform float time; varying vec3 pos; varying float wave; void main(){pos=position;wave=sin(position.x*.7+time*.55)*.075+sin(position.x*1.9+position.z*1.6-time*.65)*.035;vec3 p=position;p.y+=wave;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
      fragmentShader:`uniform float time;uniform float pulse;varying vec3 pos;varying float wave;void main(){float a=sin(pos.x*2.+pos.z*1.8+time*.7+sin(pos.z*3.-time)*.3);float crest=pow(max(0.,a),28.);float glint=pow(max(0.,sin(pos.x*9.2+pos.z*7.7+time*1.2)),42.)*crest;vec3 col=mix(vec3(.15,.48,.66),vec3(.76,.94,.98),crest*.7+glint*.3);col+=pulse*.07;gl_FragColor=vec4(col,.32+crest*.2+glint*.2);}`});
    this.water=this.mesh(waterGeo,this.waterMaterial,[60,-.12,0]);this.water.castShadow=false;this.water.renderOrder=5;
    // A sculpted seafloor, rather than a rectangular display base.
    const floorGeo=new THREE.PlaneGeometry(180,55,125,30);floorGeo.rotateX(-Math.PI/2);const fp=floorGeo.attributes.position;
    for(let i=0;i<fp.count;i++){const x=fp.getX(i),z=fp.getZ(i);fp.setY(i,Math.sin(x*.22)*.5+Math.cos(x*.57+z*.29)*.32+Math.sin(z*.19)*.6);}
    floorGeo.computeVertexNormals();
    this.floorMaterial=new THREE.ShaderMaterial({uniforms:{time:{value:0},pulse:{value:0}},vertexShader:`varying vec3 p;varying vec3 n;void main(){p=position;n=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform float time;uniform float pulse;varying vec3 p;varying vec3 n;void main(){float a=sin(p.x*2.2+sin(p.z*2.+time*.3))+cos(p.z*2.3+sin(p.x*1.1-time*.4));float b=pow(clamp(1.-abs(a)*.9,0.,1.),9.);vec3 c=mix(vec3(.045,.14,.23),vec3(.16,.37,.43),n.y*.6);c+=vec3(.12,.31,.36)*b*(.5+pulse*.6);gl_FragColor=vec4(c,1.);}`});
    this.mesh(floorGeo,this.floorMaterial,[60,-20.8,-2]);
    for(let i=0;i<48;i++){const x=-10+this.random()*145,z=-9+this.random()*18,sz=1+this.random()*2;const r=this.mesh(this.rockGeo,this.mat(i%3?'#235971':'#497b87',{flatShading:true}),[x,-20.1,z],[sz,.6+this.random()*1.6,sz*.8]);r.rotation.set(this.random()*.3,this.random()*6,0);}
    // Distant sculptural ice formations give the backdrop real parallax.
    const mountains=new THREE.PlaneGeometry(185,26,165,24);mountains.rotateX(-Math.PI/2);
    const mp=mountains.attributes.position,mc=[];
    for(let i=0;i<mp.count;i++){
      const x=mp.getX(i),z=mp.getZ(i),ridge=Math.pow(Math.max(0,Math.sin(x*.19+Math.sin(z*.28))*.5+.5),1.4);
      const edge=Math.pow(Math.sin((z+13)/26*Math.PI),.8);
      const h=edge*(1.0+ridge*5.7+Math.sin(x*.91+z*.67)*.45+Math.sin(x*2.4-z*1.8)*.16)-.35;mp.setY(i,h);
      const color=new THREE.Color().setHSL(.56,.20+Math.max(0,1-h/7)*.22,.62+Math.max(0,h/7)*.22);mc.push(color.r,color.g,color.b);
    }mountains.setAttribute('color',new THREE.Float32BufferAttribute(mc,3));mountains.computeVertexNormals();
    this.mesh(mountains,this.mat('#bed9ed',{vertexColors:true,roughness:.85}),[60,-.3,-29],[1,.30,1]);
    const bladeGeo=new THREE.PlaneGeometry(.22,2.6,2,9);bladeGeo.translate(0,1.3,0);
    this.plantMaterial=new THREE.ShaderMaterial({uniforms:{time:{value:0},pulse:{value:0}},side:THREE.DoubleSide,vertexShader:`uniform float time;varying vec2 v;void main(){v=uv;vec3 p=position;p.x*=pow(max(0.,sin(v.y*3.14159)),.65);p.x+=sin(time*.8+instanceMatrix[3].x*.3+p.y)*p.y*.09;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.);}`,fragmentShader:`uniform float pulse;varying vec2 v;void main(){float edge=1.-abs(v.x-.5)*2.;vec3 c=mix(vec3(.08,.32,.41),vec3(.52,.83,.82),v.y*v.y);c+=pulse*.09*v.y;gl_FragColor=vec4(c,1.);}`});
    const leaves=new THREE.InstancedMesh(bladeGeo,this.plantMaterial,250);
    for(let i=0;i<250;i++){dummy.position.set(-12+this.random()*147,-20.5,2.5+this.random()*6.5);dummy.rotation.set((this.random()-.5)*.3,this.random()*6,(this.random()-.5)*.8);dummy.scale.set(.6+this.random()*1.5,.45+this.random()*1.3,1);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);}this.scene.add(leaves);
    for(let i=0;i<20;i++){const x=2+i*6.1,z=3.4+this.random()*3.5,h=.6+this.random()*1.7;this.tube([[x,-20.4,z],[x-.2,-19.9,z],[x+.2,-20.4+h,z]],'#6ea5b1',.028);this.orb('#b7ebdf',[x+.2,-20.4+h,z],[.065,.12,.065],this.scene,{emissive:'#559a92',emissiveIntensity:.6});}
    this.shafts=[];
    const shaftGeo=new THREE.PlaneGeometry(7,22);shaftGeo.translate(0,-11,0);
    for(let i=0;i<HOLES.length;i++){
      const material=new THREE.ShaderMaterial({uniforms:{power:{value:.25},time:{value:0}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
        vertexShader:`varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader:`uniform float power;uniform float time;varying vec2 v;void main(){float beam=pow(max(0.,1.-abs(v.x-.5)*2.),3.);float grain=.8+.2*sin(v.x*120.+v.y*30.+time);gl_FragColor=vec4(.46,.83,.92,beam*v.y*v.y*power*grain);}`});
      const shaft=this.mesh(shaftGeo,material,[X(HOLES[i]),-.2,-1]);shaft.castShadow=false;shaft.renderOrder=3;this.shafts.push(shaft);
      const rim=new THREE.Mesh(new THREE.TorusGeometry(1.15,.033,7,64),this.mat('#ccefe7',{emissive:'#91cfd0',emissiveIntensity:.5}));rim.rotation.x=Math.PI/2;rim.scale.y=.82;rim.position.set(X(HOLES[i]),-.04,0);this.scene.add(rim);
    }
    const pos=new Float32Array(750*3),sizes=new Float32Array(750);
    for(let i=0;i<750;i++){pos[i*3]=this.random()*160-15;pos[i*3+1]=-1-this.random()*20;pos[i*3+2]=-10+this.random()*20;sizes[i]=1+this.random()*2;}
    const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(pos,3));pg.setAttribute('size',new THREE.BufferAttribute(sizes,1));
    this.moteMaterial=new THREE.ShaderMaterial({uniforms:{time:{value:0},pulse:{value:0},ratio:{value:1}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexShader:`uniform float time;uniform float ratio;attribute float size;varying float a;void main(){vec3 p=position;p.x+=sin(time*.2+p.y)*.16;p.y+=sin(time*.3+p.x)*.2;a=.15+size*.08;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=size*ratio;}`,fragmentShader:`uniform float pulse;varying float a;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(.6,.9,1.,max(0.,1.-d*2.)*(a+pulse*.1));}`});this.scene.add(new THREE.Points(pg,this.moteMaterial));
  }
  seal(){
    const group=new THREE.Group();
    // One continuous, gently shaped body, with a lifted head and tapered tail.
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-1.8,.06,-.03),new THREE.Vector3(-1.45,.32,0),new THREE.Vector3(-.9,.58,.06),new THREE.Vector3(-.2,.65,.12),new THREE.Vector3(.45,.57,.19),new THREE.Vector3(.85,.54,.36),new THREE.Vector3(1.2,.43,.37),new THREE.Vector3(1.48,.23,.23),new THREE.Vector3(1.6,.07,.2)]);
    const vertices=[],uv=[],indices=[];const rings=56,sides=36;
    for(let i=0;i<=rings;i++){const p=curve.getPoint(i/rings);for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2;vertices.push(p.x,p.z+Math.cos(a)*p.y,Math.sin(a)*p.y*.85);uv.push(i/rings,j/sides);}}
    for(let i=0;i<rings;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,a+1,b,b,a+1,b+1);}
    const bodyGeo=new THREE.BufferGeometry();bodyGeo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));bodyGeo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));bodyGeo.setIndex(indices);bodyGeo.computeVertexNormals();
    const fur=new THREE.MeshPhysicalMaterial({color:'#fff0d6',map:this.matcap,roughness:.76,sheen:1,sheenColor:new THREE.Color('#ffffff'),sheenRoughness:.7,clearcoat:.07});
    const body=this.mesh(bodyGeo,fur,null,null,group);
    const finMat=this.mat('#bfcec9',{roughness:.68});
    const fin=this.mesh(this.sphere,finMat,[.08,-.30,.53],[.44,.10,.29],group);fin.rotation.y=-.5;fin.rotation.z=-.25;
    const farFin=this.mesh(this.sphere,finMat,[.08,-.3,-.53],[.42,.095,.28],group);farFin.rotation.y=.5;
    const tail=this.mesh(this.sphere,finMat,[-1.67,-.03,.21],[.4,.07,.23],group);tail.rotation.y=-.5;
    const tail2=this.mesh(this.sphere,finMat,[-1.67,-.03,-.21],[.4,.07,.23],group);tail2.rotation.y=.5;
    for(const side of [-1,1]){
      this.orb('#758f97',[1.08,.56,side*.315],[.12,.15,.064],group);
      this.orb('#132d3b',[1.105,.575,side*.356],[.090,.12,.040],group,{roughness:.12,metalness:.1});
      this.orb('#fff5da',[1.13,.62,side*.385],[.027,.034,.010],group,{emissive:'#dacfb3',emissiveIntensity:.15});
      this.orb('#ede9d8',[1.4,.25,side*.13],[.24,.145,.18],group);
      for(let i=0;i<4;i++)this.tube([[1.47,.25-i*.035,side*.19],[1.74,.25-i*.045,side*.40],[1.83,.35-i*.10,side*.58]],'#b3c4c3',.008,group);
      for(let i=0;i<3;i++)this.orb('#617c83',[1.42+i*.05,.28-i*.03,side*.276],[.012,.012,.009],group);
    }
    this.orb('#304451',[1.61,.34,0],[.09,.068,.12],group,{roughness:.37});
    this.tube([[1.61,.28,0],[1.60,.20,.03],[1.5,.17,.06]],'#6b8084',.013,group);
    group.userData={body,fin,farFin,tail,tail2};return group;
  }
  fishMesh(tier){
    const g=new THREE.Group(),color=['#b5dae0','#e4d0a0','#e8b28d'][tier];
    this.orb(color,[0,0,0],[.35,.14,.095],g,{metalness:.27,roughness:.31});
    const tail=this.mesh(new THREE.ConeGeometry(.16,.23,3),this.mat(color),[-.36,0,0],[1,1,.4],g);tail.rotation.z=-Math.PI/2;
    this.orb('#132f40',[.22,.023,.082],[.024,.027,.012],g);
    g.userData.tail=tail;return g;
  }
  fisher(index){
    const g=new THREE.Group();g.position.set(X(HOLES[index])+1.3,.42,0);this.scene.add(g);
    this.mesh(new THREE.CylinderGeometry(.21,.22,.7,10),this.mat('#4b6175'),[0,.34,0],null,g);
    this.mesh(new THREE.BoxGeometry(.7,.12,.6),this.mat('#c39e73'),[0,.4,0],null,g);
    this.orb('#cd945c',[-.03,.87,0],[.35,.49,.32],g);
    this.orb('#e3bf80',[-.12,1.26,0],[.35,.36,.33],g);
    this.orb('#c48e71',[-.35,1.26,.09],[.14,.19,.18],g);
    this.orb('#6986a0',[-.1,1.49,0],[.34,.13,.32],g);
    this.orb('#e8ddd1',[-.04,1.63,0],[.10,.10,.10],g);
    this.orb('#405973',[-.19,.33,.25],[.27,.32,.13],g);this.orb('#314b61',[-.39,.12,.25],[.25,.10,.14],g);
    this.orb('#405973',[-.18,.33,-.21],[.27,.32,.13],g);this.orb('#314b61',[-.37,.12,-.21],[.25,.10,.14],g);
    this.tube([[-.15,1.1,.2],[-.47,.92,.24],[-.75,1.06,.17]],'#d9b787',.09,g);
    this.tube([[-.73,1.02,.16],[-1.05,1.94,.10],[-1.62,2.33,0]],'#6d7b84',.021,g);
    const lineGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1.62,2.33,0),new THREE.Vector3(-1.4,-2,0)]);
    const line=new THREE.Line(lineGeo,new THREE.LineBasicMaterial({color:'#e0e7dd',transparent:true,opacity:.55}));g.add(line);g.userData={line,index};return g;
  }
  buildEffects(){
    const geometry=new THREE.SphereGeometry(1,7,5),material=new THREE.MeshPhysicalMaterial({color:'#c8ecf7',transparent:true,opacity:.64,roughness:.13,metalness:.10});
    this.particles=new THREE.InstancedMesh(geometry,material,200);this.particles.count=0;this.scene.add(this.particles);this.dummy=new THREE.Object3D();
    this.rings=Array.from({length:5},()=>{const m=new THREE.Mesh(new THREE.TorusGeometry(1,.017,5,60),new THREE.MeshBasicMaterial({color:'#e6f9f6',transparent:true,opacity:.5,depthWrite:false}));m.rotation.x=Math.PI/2;m.visible=false;this.scene.add(m);return m;});
  }
  resize(w,h,dpr){this.width=w;this.height=h;this.renderer.setPixelRatio(Math.min(dpr,1.65));this.renderer.setSize(w,h,false);this.moteMaterial.uniforms.ratio.value=Math.min(dpr,1.65);}
  render(g,t,fx){
    const aspect=this.width/this.height,leap=g.transition?.type==='greatLeap';
    const half=(this.width<600?15.4:14.7)*(leap?1.10:1);
    const lookAhead=g.stage==='ending'?4.0:half*aspect*.22;
    this.target.lerp(new THREE.Vector3(X(g.x)+lookAhead,-6.35,0),.085);
    const yaw=this.side?0:.10+this.look,pitch=this.side?.005:.095;
    this.camera.left=-half*aspect;this.camera.right=half*aspect;this.camera.top=half;this.camera.bottom=-half;this.camera.updateProjectionMatrix();
    this.camera.position.set(this.target.x+Math.sin(yaw)*50,this.target.y+Math.sin(pitch)*50,Math.cos(yaw)*50);this.camera.lookAt(this.target);
    if(this.backdrop)this.backdrop.position.x=this.target.x;
    this.sun.position.set(this.target.x-16,24,16);this.sun.target.position.set(this.target.x,-6,0);
    this.fill.position.set(this.target.x+7,-2,14);this.fill.target.position.set(this.target.x,-10,0);this.fill.intensity=(1.8+g.pulse*.8)*(1-g.danger*.3);
    this.waterMaterial.uniforms.time.value=t;this.waterMaterial.uniforms.pulse.value=g.pulse;
    this.floorMaterial.uniforms.time.value=t;this.floorMaterial.uniforms.pulse.value=g.pulse;
    this.plantMaterial.uniforms.time.value=t;this.plantMaterial.uniforms.pulse.value=g.pulse;
    this.moteMaterial.uniforms.time.value=t;this.moteMaterial.uniforms.pulse.value=g.pulse;
    const active=g.stage==='entry'?g.x:g.targetHole;
    this.shafts.forEach((s,i)=>{s.material.uniforms.time.value=t;s.material.uniforms.power.value=Math.abs(HOLES[i]-active)<30?.26+g.pulse*.62:.11;});
    if(this.growth===undefined||g.stage==='breathe')this.growth=g.growth;this.growth+=(g.growth-this.growth)*.09;
    const py=Y(g.y),px=X(g.x),dying=g.stage==='dying';
    for(const material of this.playerMaterials){if(material.transparent!==dying){material.transparent=dying;material.needsUpdate=true;}material.opacity=dying?Math.max(.13,1-g.deathTime*.3):1;}
    this.player.position.set(px,py+(g.underwater||g.transition||dying?0:(this.growth-1)*.75)-(dying?Math.min(g.deathTime,3)*.27:0),0);
    const goal=g.facing===1?-.10:Math.PI+.10;this.facing+=Math.atan2(Math.sin(goal-this.facing),Math.cos(goal-this.facing))*.14;
    this.player.rotation.y=this.facing;this.player.rotation.z=leap?Math.sin(g.transition.t/g.transition.duration*Math.PI)*.22:clamp(-g.vy*.0008,-.16,.16)*g.facing;
    this.player.rotation.z-=g.danger*.13;
    const flat=g.status==='title'||g.stage==='breathe'?.72+g.oxygen*.0028:1;
    this.player.scale.set(1.35,(flat+(g.holding?g.charge*.15:Math.sin(t*1.7)*.01)+Math.min(g.food/g.goal,1)*.12)*1.25,(1+Math.min(g.food/g.goal,1)*.12)*1.25);
    this.player.scale.multiplyScalar(this.growth*(1+g.eatPulse*.055));
    const flap=Math.sin(t*(g.underwater?5.5:1.3))*(1-g.danger*.65);this.player.userData.fin.rotation.x=flap*.22;this.player.userData.farFin.rotation.x=-flap*.17;this.player.userData.tail.rotation.z=flap*.08;this.player.userData.tail2.rotation.z=flap*.07;
    this.spirit.visible=dying&&g.outcome==='angel';this.ghostModel.visible=dying&&g.outcome==='hungryGhost';
    if(dying){const p=clamp(g.deathTime/3.6,0,1);this.spirit.position.set(px,py+.7+p*3.6,6.5);this.spirit.scale.setScalar(g.growth*1.12);this.spirit.rotation.y=this.facing;this.halo.visible=this.wings.visible=g.outcome==='angel';this.ghostMouth.visible=g.outcome==='hungryGhost';this.wings.rotation.x=Math.sin(t*2)*.12;this.spirit.userData.body.material.color.set(g.outcome==='angel'?'#fff1ce':'#c0cde6');this.spirit.userData.body.material.opacity=.4+p*.25;}
    if(this.ghostModel.visible){this.ghostModel.position.copy(this.spirit.position);this.ghostModel.position.y+=Math.sin(t*2)*.06;this.ghostModel.scale.setScalar(g.growth*1.12);}
    this.growthRing.visible=g.evolutionGlow>0;this.growthRing.position.set(px,py,1.3);this.growthRing.scale.setScalar(2+(1-g.evolutionGlow)*4);this.growthRing.material.opacity=g.evolutionGlow*.7;
    this.fish.forEach((mesh,i)=>{const f=g.fish[i];mesh.visible=!!f?.active;if(!f)return;mesh.position.set(X(f.x),Y(f.y)+Math.sin(t*2+f.phase)*.07,Math.sin(f.phase)*1.2);mesh.rotation.y=Math.sin(f.phase)>0?0:Math.PI;mesh.userData.tail.rotation.y=Math.sin(t*6+f.phase)*.25;});
    this.fishers.forEach((f,i)=>{const start=g.fisherKnocks[i+1],p=start===undefined?0:clamp((g.time-start)/.75,0,1);f.rotation.z=-p*1.48;f.position.x=X(HOLES[i+1])+1.3+p*1.0;f.position.y=.42+p*.1;f.userData.line.visible=p<.4;});
    this.friends.forEach((f,i)=>{f.visible=g.stage==='ending'||g.status==='won';const p=clamp((g.endingTime-i*.6)/4,0,1);f.position.set(px+3.4+i*2.1+(1-p)*12,.99-(1-p)*4,0);f.rotation.y=Math.PI+.14;f.userData.fin.rotation.x=Math.sin(t*2+i)*.12;});
    this.particles.count=Math.min(fx.particles.length,200);
    for(let i=0;i<this.particles.count;i++){const p=fx.particles[i];this.dummy.position.set(X(p.x),Y(p.y),Math.sin(i*2.4)*(p.type==='bubble'?.28:1));this.dummy.scale.setScalar(p.size/32*clamp(p.life/p.max,0,1));this.dummy.updateMatrix();this.particles.setMatrixAt(i,this.dummy.matrix);}this.particles.instanceMatrix.needsUpdate=true;
    this.rings.forEach((r,i)=>{const ring=fx.rings[i];r.visible=!!ring;if(!ring)return;r.position.set(X(ring.x),.04,0);r.scale.setScalar(.4+(1.8-ring.life)*2.1);r.material.opacity=ring.life*.36;});
    this.renderer.render(this.scene,this.camera);
  }
}
