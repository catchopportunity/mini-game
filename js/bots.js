// ---------- 봇 AI ----------
// 봇의 매입/건설/인수 판단 기준을 한곳에 모아둔다 (여유 자금 버퍼 방식).
function thinkDelay() { return BOT_THINK_DELAY[0] + Math.random() * (BOT_THINK_DELAY[1] - BOT_THINK_DELAY[0]); }

const BOT_BUY_BUFFER = 250;
const BOT_BUILD_BUFFER = 250;
const BOT_LANDMARK_BUFFER = 300;
const BOT_ACQUIRE_BUFFER = 300;
// 세금은 순자산의 10%(+잔액 일부 소각)라서 자산이 클수록 세금 한 방의 절대 피해도 커진다.
// 고정 버퍼만으로는 자산이 쌓인 봇일수록 상대적으로 더 위험해지므로, 순자산에 비례하는
// 여유분을 더해 자산 규모에 맞게 방어선도 같이 커지도록 한다. 성격(personality)이 있으면
// 그 배율을 곱해 공격적/수전노 성향 차이를 낸다.
const BOT_NET_WORTH_SAFETY_RATE = 0.15;

function safetyBuffer(player, base) {
  const netWorthBuffer = Math.max(base, netWorth(player) * BOT_NET_WORTH_SAFETY_RATE);
  const mult = player.personality ? player.personality.bufferMult : 1;
  return netWorthBuffer * mult;
}

// 수집가 성향은 그룹을 이미 2개 이상 모은 상태에서 그 그룹 도시를 살 땐 버퍼를 절반으로 낮춰
// 독점을 더 적극적으로 노린다
function collectorDiscount(player, tile) {
  if (player.personality?.key !== 'collector' || tile.type !== 'city') return 1;
  const owned = TILES.filter(t => t && t.type === 'city' && t.group === tile.group && t.owner === player.idx).length;
  return owned >= 2 ? 0.5 : 1;
}

function botWantsToBuy(player, tile) {
  const buffer = safetyBuffer(player, BOT_BUY_BUFFER) * collectorDiscount(player, tile);
  return player.cash - tile.price >= buffer;
}
function botWantsToBuild(player, cost) {
  return player.cash - cost >= safetyBuffer(player, BOT_BUILD_BUFFER);
}
function botWantsToBuildLandmark(player, cost) {
  return player.cash - cost >= safetyBuffer(player, BOT_LANDMARK_BUFFER);
}
function botWantsToAcquire(player, tile, cost) {
  return tile.stars > 0 && player.cash - cost >= safetyBuffer(player, BOT_ACQUIRE_BUFFER);
}

// 황금열쇠 "두 장 중 선택" 카드에서 봇이 고를 쪽 — 유리한 쪽을 우선하고, 둘 다 같은 성향이면 무작위
function chooseBotCard(optionA, optionB) {
  if (optionA.favorable !== optionB.favorable) return optionA.favorable ? optionA : optionB;
  return Math.random() < 0.5 ? optionA : optionB;
}
