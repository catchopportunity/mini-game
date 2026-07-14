// ---------- 봇 AI ----------
// 봇의 매입/건설/인수 판단 기준을 한곳에 모아둔다 (여유 자금 버퍼 방식).
function thinkDelay() { return BOT_THINK_DELAY[0] + Math.random() * (BOT_THINK_DELAY[1] - BOT_THINK_DELAY[0]); }

const BOT_BUY_BUFFER = 250;
const BOT_BUILD_BUFFER = 250;
const BOT_LANDMARK_BUFFER = 300;
const BOT_ACQUIRE_BUFFER = 300;
// 세금은 순자산의 10%(+잔액 절반 소각)라서 자산이 클수록 세금 한 방의 절대 피해도 커진다.
// 고정 버퍼만으로는 자산이 쌓인 봇일수록 상대적으로 더 위험해지므로, 순자산에 비례하는
// 여유분을 더해 자산 규모에 맞게 방어선도 같이 커지도록 한다.
const BOT_NET_WORTH_SAFETY_RATE = 0.15;

function safetyBuffer(player, base) {
  return Math.max(base, netWorth(player) * BOT_NET_WORTH_SAFETY_RATE);
}

function botWantsToBuy(player, price) {
  return player.cash - price >= safetyBuffer(player, BOT_BUY_BUFFER);
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
