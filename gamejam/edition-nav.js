export function editionLinks(current){
  return [['2d','index.html','2D 繪本'],['3d','3d.html','3D 光影'],['rings','rings.html','圈圈節奏'],['runner','runner.html','海豹上下'],['sketch','sketch.html','手繪海豹'],['journey','tide.html','呼吸旅程'],['dash','dash.html','雙軌對照'],['scenes','scenes.html','冰海四幕'],['pulse','pulse.html','疾速潮汐'],['duet','duet.html','雙潮律動'],['drift','drift.html','游光拾拍'],['floe','floe.html','冰海新章']]
    .map(([id,href,label],i)=>`<a href="${href}" ${id===current?'aria-current="page"':''}>${i+1}. ${label}</a>`).join('');
}
