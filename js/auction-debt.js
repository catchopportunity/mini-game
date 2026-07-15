// ---------- 강제 매각 옥션 & 부채 ----------
// 강제 매각 옥션 — 은행에 반값으로 넘기는 대신, 다른 활성 플레이어들에게 입찰을 붙여 더 받을 기회를 준다.
// 입찰자가 없거나 은행 제시가보다 낮으면 기존처럼 은행에 매각(소유권 초기화).
function auctionAsset(tile, seller) {
  const bankOffer = Math.floor(assetValue(tile) * AUCTION_BANK_RATE);
  const bidders = players.filter(p => p.idx !== seller.idx && !p.eliminated);
  let bestBid = bankOffer;
  let winner = null;
  bidders.forEach(bidder => {
    const willingness = Math.round(assetValue(tile) * (AUCTION_BID_MIN_RATE + Math.random() * (AUCTION_BID_MAX_RATE - AUCTION_BID_MIN_RATE)));
    const room = bidder.cash - safetyBuffer(bidder, BOT_BUY_BUFFER);
    const bid = Math.min(willingness, Math.max(0, room));
    if (bid > bestBid) { bestBid = bid; winner = bidder; }
  });
  return { amount: bestBid, winner };
}

function liquidateAsset(tile, seller) {
  const { amount, winner } = auctionAsset(tile, seller);
  tile.owner = winner ? winner.idx : null;
  if (winner) {
    tile.stageLap = winner.lapCount;
    winner.cash -= amount;
    log(`🔨 ${seller.name}, ${tile.name} 강제 매각 — ${winner.name}이(가) 경매로 낙찰! (+${amount}만원)`);
    flyMoney(playerCardEl(winner.idx), playerCardEl(seller.idx), amount);
  } else {
    if (tile.type === 'city') { tile.stars = 0; tile.landmark = false; tile.stageLap = null; }
    if (tile.type === 'compound') tile.hits = 0;
    log(`💵 ${seller.name}, ${tile.name} 매각 (은행, +${amount}만원)`);
  }
  seller.cash += amount;
  return amount;
}

// 부동산 담보 한도 내에서만 대출 가능 — 부동산이 없어도 최소 신용대출(MIN_DEBT_CAP)까지는 가능
function maxDebtRoom(player) {
  const collateral = TILES.reduce((sum, t) => (t && t.owner === player.idx) ? sum + assetValue(t) : sum, 0);
  const cap = Math.max(MIN_DEBT_CAP, collateral * MAX_DEBT_RATIO);
  return Math.max(0, cap - player.debt);
}

function ensureFunds(player, amount) {
  if (player.cash >= amount) return true;
  const owned = TILES.filter(t => t && t.owner === player.idx &&
    (t.type === 'city' || t.type === 'compound' || t.type === 'trust'))
    .sort((a, b) => assetValue(b) - assetValue(a));
  for (const t of owned) {
    if (player.cash >= amount) break;
    liquidateAsset(t, player);
  }
  if (player.cash >= amount) return true;

  // 자산을 다 팔아도 부족하면 파산 대신 담보 한도 내에서 대출로 메꿔본다
  const shortfall = amount - player.cash;
  const room = maxDebtRoom(player);
  if (room > 0) {
    const borrowed = Math.min(shortfall, room);
    player.debt += borrowed;
    player.cash += borrowed;
    log(`🏦 ${player.name}, 대출로 ${borrowed}만원을 마련했습니다. (누적 부채 ${player.debt}만원)`);
  }
  return player.cash >= amount;
}

function repayDebt() {
  ensureAudio();
  SFX.click();
  const p = players[current];
  const amount = Math.min(p.cash, p.debt);
  if (amount <= 0) return;
  p.cash -= amount;
  p.debt -= amount;
  log(`🏦 ${p.name}, 부채 ${amount}만원 상환. (남은 부채 ${p.debt}만원)`);
  render();
}
