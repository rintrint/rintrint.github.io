export function editionLinks(current){
  return [['2d','index.html','2D 繪本'],['3d','3d.html','3D 光影'],['rings','rings.html','圈圈節奏'],['runner','runner.html','海豹上下'],['sketch','sketch.html','手繪海豹']]
    .map(([id,href,label])=>`<a href="${href}" ${id===current?'aria-current="page"':''}>${label}</a>`).join('');
}
