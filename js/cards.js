function spend(p, amt) { p.cash -= amt; }
function spendToPot(p, amt) {
  spend(p, amt);
  pot += amt;
  flyMoney(playerCardEl(p.idx), document.getElementById('pot'), amt);
}

const CARDS = [
  { favorable: true, text: p => `공항 마일리지 적립! +${gainAmount(p, 0.08)}만원`, fn: p => { p.cash += gainAmount(p, 0.08); } },
  { favorable: false, text: p => `세금 추징 -${payAmount(p, 0.06)}만원`, fn: p => spendToPot(p, payAmount(p, 0.06)) },
  { favorable: true, text: p => `길거리 이벤트 당첨! +${gainAmount(p, 0.10)}만원`, fn: p => { p.cash += gainAmount(p, 0.10); } },
  { favorable: false, text: p => `여권 분실로 벌금 -${payAmount(p, 0.04)}만원`, fn: p => spendToPot(p, payAmount(p, 0.04)) },
  { favorable: false, text: p => `기부 활동 -${payAmount(p, 0.03)}만원`, fn: p => spendToPot(p, payAmount(p, 0.03)) },
  { favorable: true, text: p => `보너스 상금 +${gainAmount(p, 0.12)}만원`, fn: p => { p.cash += gainAmount(p, 0.12); } },
  { favorable: false, text: '밀수 적발! 무인도로 강제 이송', fn: p => { p.pos = 10; p.stuck = true; p.jailTurns = 0; interrupted = true; } },
  { favorable: false, text: '출발점으로 순간이동 (급여 없음)', fn: p => { p.pos = 0; interrupted = true; } },
  { favorable: true, text: '투자 성공! 다음 세금은 면제됩니다.', fn: p => { p.taxExempt = true; } },
  { favorable: true, text: p => `컨설팅비 청구! ${opponentOf(p).name}에게 ${gainAmount(p, 0.08)}만원을 받았습니다.`, fn: p => { chargePlayer(opponentOf(p), gainAmount(p, 0.08), { toPlayer: p }); } },
  { favorable: false, text: p => `선의의 기부자 등장! ${opponentOf(p).name}에게 ${payAmount(p, 0.06)}만원을 지불합니다.`, fn: p => { chargePlayer(p, payAmount(p, 0.06), { toPlayer: opponentOf(p) }); } },
  { favorable: true, text: p => `보물 지도 발견! 지도를 팔아 +${gainAmount(p, 0.09)}만원`, fn: p => { p.cash += gainAmount(p, 0.09); } },
  { favorable: true, text: '황금열쇠 두 장 찬스! 카드를 한 번 더 뽑습니다.', drawAgain: true, fn: () => {} },
  { favorable: true, text: p => `투자 배당 수익! +${gainAmount(p, 0.08)}만원 획득`, fn: p => { p.cash += gainAmount(p, 0.08); } },
  { favorable: false, text: p => `벌금 고지서 도착! -${payAmount(p, 0.05)}만원 납부`, fn: p => spendToPot(p, payAmount(p, 0.05)) },
  { favorable: true, text: '무료 리모델링 쿠폰! 보유 도시 중 하나가 무료로 업그레이드됩니다.', fn: p => {
      const candidates = TILES.filter(t => t && t.type === 'city' && t.owner === p.idx && t.stars < 5);
      if (candidates.length) {
        const t = candidates[Math.floor(Math.random() * candidates.length)];
        t.stars++;
        t.stageLap = p.lapCount;
      } else {
        p.cash += gainAmount(p, 0.06);
      }
    } },
];

function pickCard(player, pool = CARDS) {
  let options = pool;
  if (!player.isBot && isDesperate(player)) {
    const favorable = options.filter(c => c.favorable);
    if (favorable.length) options = favorable;
  }
  return options[Math.floor(Math.random() * options.length)];
}

function cardText(card, p) { return typeof card.text === 'function' ? card.text(p) : card.text; }
