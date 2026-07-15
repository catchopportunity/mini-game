// ---------- 고정 웜홀 & 글로벌 이벤트 ----------
let wormholePair = null; // [tileIdxA, tileIdxB] — 매 게임 무작위로 정해지는 고정 통로
let activeGlobalEvent = null; // GLOBAL_EVENTS 중 하나 또는 null
let globalEventTurnsLeft = 0;

// 도시 타일 중 서로 연결된 2칸을 무작위로 골라 "고정 웜홀"로 만든다 — 도착 즉시 서로에게 이어짐
function pickWormholePair() {
  const cityIdxs = TILES.map((t, i) => (t && t.type === 'city') ? i : -1).filter(i => i >= 0);
  const a = cityIdxs[Math.floor(Math.random() * cityIdxs.length)];
  let b = cityIdxs[Math.floor(Math.random() * cityIdxs.length)];
  while (b === a) b = cityIdxs[Math.floor(Math.random() * cityIdxs.length)];
  return [a, b];
}

// 출발점을 통과할 때마다 이 확률로 새 글로벌 이벤트가 발동한다 (이미 진행 중이면 스킵)
function maybeTriggerGlobalEvent() {
  if (activeGlobalEvent || Math.random() >= GLOBAL_EVENT_TRIGGER_CHANCE) return;
  activeGlobalEvent = GLOBAL_EVENTS[Math.floor(Math.random() * GLOBAL_EVENTS.length)];
  globalEventTurnsLeft = GLOBAL_EVENT_DURATION_TURNS;
  log(`🌍 글로벌 이벤트 발생! ${activeGlobalEvent.icon} ${activeGlobalEvent.label} — ${activeGlobalEvent.desc} (${globalEventTurnsLeft}턴간)`);
  SFX.monopoly();
  render();
}

function tickGlobalEvent() {
  if (!activeGlobalEvent) return;
  globalEventTurnsLeft--;
  if (globalEventTurnsLeft <= 0) {
    log(`🌍 ${activeGlobalEvent.icon} ${activeGlobalEvent.label} 종료.`);
    activeGlobalEvent = null;
  }
}
