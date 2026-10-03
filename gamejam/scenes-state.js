(function(root){
  function screenFor(g){
    if(!g||g.status==='ready')return 'start';
    const status=g.status==='paused'?g.beforePause:g.status;
    if(status==='won'||status==='lost')return 'ending';
    if(status==='breathing')return 'breath';
    return g.phase==='underwater'?'dive':'breath';
  }
  class SceneFlow{
    constructor(){this.current='start';this.previous='start';this.elapsed=1;this.serial=0;}
    update(g,dt){const next=screenFor(g);if(next!==this.current){this.previous=this.current;this.current=next;this.elapsed=0;this.serial++;}if(g?.status!=='paused')this.elapsed=Math.min(1,this.elapsed+Math.max(0,dt));return this.current;}
    get veil(){return Math.max(0,1-this.elapsed/.75);}
  }
  const api={screenFor,SceneFlow};root.BreathScenes=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
