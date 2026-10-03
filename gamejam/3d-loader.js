// ES modules require the included local HTTP server. Both renderers share the same game controller.
try {
  const { Breath3D } = await import('./scene3d.js');
  window.Breath3D = Breath3D;
  await import('./game.js');
  document.getElementById('startButton').disabled = false;
  document.getElementById('startButton').innerHTML = '走進立體海灣 <span>↗</span>';
} catch (error) {
  console.error('Breath 3D could not initialize:', error);
  document.getElementById('startButton').disabled = true;
  document.getElementById('startButton').textContent = '3D 暫時無法載入';
  const notice = document.createElement('p');
  notice.className = 'renderer-error';
  notice.textContent = '請使用本機伺服器開啟，並確認瀏覽器支援 WebGL 2。你仍可切換到 2D 版遊玩。';
  document.querySelector('.start-card').append(notice);
}
