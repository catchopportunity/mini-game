// ---------- 은근한 난이도 조정 (플레이어가 크게 뒤처지면 몰래 유리하게) ----------
// 돈을 내는 카드는 "내" 순자산에 비례, 돈을 받는 카드는 "상대" 순자산에 비례.
// 봇이 여럿이면 "상대"는 그 순간 가장 자산 많은 다른 활성 플레이어(1등 라이벌) 기준.
function opponentOf(p) {
  const rivals = players.filter(pl => pl.idx !== p.idx && !pl.eliminated);
  return rivals.reduce((best, pl) => (!best || netWorth(pl) > netWorth(best)) ? pl : best, null);
}
function payAmount(p, rate) { return Math.max(1, Math.round(netWorth(p) * rate)); }
// 상대와 5배 이상 격차로 뒤처진 플레이어(사람 전용)에게는 획득액을 대폭 증폭
function isDesperate(player) {
  if (activeGlobalEvent?.key === 'audit') return false; // 공정 감사 기간엔 숨겨진 보정 전면 정지
  const oppWorth = netWorth(opponentOf(player));
  const myWorth = Math.max(1, netWorth(player));
  return oppWorth / myWorth >= DESPERATION_RATIO_CAP;
}
function gainAmount(p, rate) {
  const boost = (!p.isBot && isDesperate(p)) ? DESPERATE_GAIN_BOOST : 1;
  return Math.max(1, Math.round(netWorth(opponentOf(p)) * rate * boost));
}

// 절대 현금이 아니라 상대와의 자산 배율 기준: 서로 자산이 비슷하면 0,
// 상대 자산이 내 자산의 5배에 가까워질수록(그 이상은 상한) 1에 수렴.
// 3제곱이면 5배 상한 근처가 아닌 이상 거의 안 켜져서(2배 격차=1.6%), 세금처럼 한 방에
// 훅 가는 위험 앞에서 도움이 안 되는 문제가 있었음 — 제곱으로 완만하게 해서 중간 구간도 보호.
function desperationLevel(player) {
  if (activeGlobalEvent?.key === 'audit') return 0; // 공정 감사 기간엔 숨겨진 보정 전면 정지
  const opponent = opponentOf(player);
  const myWorth = Math.max(1, netWorth(player));
  const oppWorth = netWorth(opponent);
  const ratio = oppWorth / myWorth;
  if (ratio <= 1) return 0;
  const raw = Math.min(1, (ratio - 1) / (DESPERATION_RATIO_CAP - 1));
  return raw ** 2;
}

// 그 칸에 도착하면 실제로 내야 하는 현금 비용(세금은 이중타격 전체, 통행료 등) — 없으면 0
function tileCashCost(tile, player) {
  if (!tile) return 0;
  switch (tile.type) {
    case 'tax': {
      if (player.taxExempt) return 0;
      const tax = taxAmount(player);
      const burn = Math.max(0, Math.round((player.cash - tax) * TAX_BURN_RATE));
      return tax + burn;
    }
    case 'city':
      return (tile.owner !== null && tile.owner !== player.idx) ? getToll(tile) : 0;
    case 'compound':
      return (tile.owner !== null && tile.owner !== player.idx) ? compoundToll(tile) : 0;
    default:
      return 0;
  }
}

// 착지할 칸이 해당 플레이어에게 얼마나 유리한지 대략적으로 점수화
function tileFavorability(tile, player) {
  if (!tile) return 0;
  switch (tile.type) {
    case 'start': return 1;
    case 'island': return -6;
    case 'rest': return 3 + pot * 0.01;
    case 'warp': return -1;
    case 'tax': return -2 - taxAmount(player) * 0.01 - player.cash * 0.005;
    case 'goldenkey': return isDesperate(player) ? 4 : -0.5;
    case 'casino': return -0.5;
    case 'compound':
      if (tile.owner === null) return 2;
      if (tile.owner === player.idx) return 1;
      return -1 - compoundToll(tile) * 0.02;
    case 'trust':
      if (tile.owner === null) return 2;
      if (tile.owner === player.idx) return 1.5;
      return 0.5;
    case 'city':
      if (tile.owner === null) return 2;
      if (tile.owner === player.idx) return 1.5;
      if (tile.landmark) return -5;
      return -1 - getToll(tile) * 0.02;
    default: return 0;
  }
}

// rawSum 기준 ±1칸 중 플레이어에게 가장 유리한 합을 몰래 골라준다.
// 후보 전부가 비용을 내야 하는 칸이라 어차피 피할 수 없다면, 정성적 유리함 점수 대신
// 실제로 내야 할 금액이 가장 적은 쪽을 정확히 계산해서 고른다.
function luckyAdjust(player, rawSum) {
  const candidates = [rawSum];
  for (const delta of [-1, 1]) {
    const cand = rawSum + delta;
    if (cand >= 2 && cand <= 12) candidates.push(cand);
  }
  const costed = candidates.map(sum => ({
    sum,
    cost: tileCashCost(TILES[(player.pos + sum) % 40], player),
  }));
  if (costed.every(c => c.cost > 0)) {
    return costed.reduce((cheapest, c) => (c.cost < cheapest.cost ? c : cheapest)).sum;
  }

  let best = rawSum;
  let bestScore = tileFavorability(TILES[(player.pos + rawSum) % 40], player);
  for (const delta of [-1, 1]) {
    const cand = rawSum + delta;
    if (cand < 2 || cand > 12) continue;
    const score = tileFavorability(TILES[(player.pos + cand) % 40], player);
    if (score > bestScore) { bestScore = score; best = cand; }
  }
  return best;
}

function diceForSum(sum) {
  const low = Math.max(1, sum - 6);
  const high = Math.min(6, sum - 1);
  const d1 = low + Math.floor(Math.random() * (high - low + 1));
  return [d1, sum - d1];
}
