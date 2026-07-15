function groupFullyOwned(playerIdx, groupId) {
  return TILES.filter(t => t && t.type === 'city' && t.group === groupId)
    .every(t => t.owner === playerIdx);
}

function tierName(tile) {
  if (tile.landmark) return tile.landmarkName;
  return TIER_NAMES[tile.stars];
}

// 통행료 단계: 그룹독점만 2배 / ★1=4배 / ★2=8배 / ★3=16배 / 랜드마크=30배
const STAR_TOLL_MULT = [1, 4, 8, 16, 32, 64]; // 인덱스 = stars(0~5)
const LANDMARK_TOLL_MULT = 120; // 독점 곱하면 240배

function getToll(tile) {
  const base = tile.tollBase;
  let mult = tile.landmark ? LANDMARK_TOLL_MULT : STAR_TOLL_MULT[tile.stars];
  if (groupFullyOwned(tile.owner, tile.group)) mult *= 2; // 독점은 건설 단계와 곱연산으로 중첩
  if (tile.tollBoost) mult *= 2; // 황금열쇠 통행료 증폭권 — 다음 방문자가 지불할 때 소진됨
  if (activeGlobalEvent?.key === 'crisis') mult *= 0.5;
  if (activeGlobalEvent?.key === 'boom') mult *= 1.5;
  return Math.round(base * mult);
}

function buildCost(tile) {
  return Math.round(tile.price * 0.6 * (tile.stars + 1));
}

function landmarkCost(tile) {
  return Math.round(tile.price * 2.5);
}

// 땅값 + 지금까지 지은 건물에 들어간 금액 (별 k번째 건설 비용의 합 + 랜드마크 비용)
function totalInvested(tile) {
  const n = tile.stars;
  let value = tile.price + Math.round(tile.price * 0.6 * n * (n + 1) / 2);
  if (tile.landmark) value += landmarkCost(tile);
  return value;
}

// 강제 매각 시 자산 가치: 도시는 땅값+건물 투자금 전부, 그 외는 매입가
function assetValue(tile) {
  return tile.type === 'city' ? totalInvested(tile) : tile.price;
}

function acquireCost(tile) {
  return totalInvested(tile) * 2;
}

// 인수는 통행료를 면제해주는 게 아니라 통행료 + 인수 프리미엄을 함께 지불
function acquireTotalCost(tile) {
  return getToll(tile) + acquireCost(tile);
}

function compoundToll(tile) {
  return Math.round(tile.price * 0.15) * (2 ** Math.min(tile.hits, COMPOUND_TOLL_CAP_HITS));
}

function trustDividend(tile) {
  return Math.round(tile.price * TRUST_DIVIDEND_RATE);
}

// 현금 + 보유 부동산(땅값+건물 투자금, 복리 상가·투자 신탁 포함) 가치의 합 — 세금 산정 기준
function netWorth(player) {
  const realEstate = TILES.reduce((sum, t) => {
    if (!t || t.owner !== player.idx) return sum;
    if (t.type === 'city') return sum + totalInvested(t);
    if (t.type === 'compound' || t.type === 'trust') return sum + t.price;
    return sum;
  }, 0);
  return player.cash + realEstate;
}

function taxAmount(player) {
  const rate = activeGlobalEvent?.key === 'crisis' ? TAX_RATE * 2 : TAX_RATE;
  return Math.round(netWorth(player) * rate);
}
