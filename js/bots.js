// ---------- 봇 AI ----------
// 봇의 매입/건설/인수 판단 기준을 한곳에 모아둔다 (여유 자금 버퍼 방식).
function thinkDelay() { return BOT_THINK_DELAY[0] + Math.random() * (BOT_THINK_DELAY[1] - BOT_THINK_DELAY[0]); }

const BOT_BUY_BUFFER = 250;
const BOT_BUILD_BUFFER = 250;
const BOT_LANDMARK_BUFFER = 300;
const BOT_ACQUIRE_BUFFER = 300;

function botWantsToBuy(player, price) {
  return player.cash - price >= BOT_BUY_BUFFER;
}
function botWantsToBuild(player, cost) {
  return player.cash - cost >= BOT_BUILD_BUFFER;
}
function botWantsToBuildLandmark(player, cost) {
  return player.cash - cost >= BOT_LANDMARK_BUFFER;
}
function botWantsToAcquire(player, tile, cost) {
  return tile.stars > 0 && player.cash - cost >= BOT_ACQUIRE_BUFFER;
}
