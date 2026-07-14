// ---------- Bootstrap ----------
createBoard();
document.getElementById('restartBtn').onclick = () => { ensureAudio(); SFX.click(); initGame(); };
document.getElementById('rulesBtn').onclick = openRules;
document.getElementById('rulesCloseBtn').onclick = closeRules;
document.getElementById('muteBtn').onclick = toggleMute;
document.querySelectorAll('.botCountBtn').forEach(btn => {
  btn.onclick = () => {
    ensureAudio();
    SFX.click();
    botCount = Number(btn.dataset.count);
    updateBotCountUI();
    initGame();
  };
});
updateBotCountUI();
initGame();
