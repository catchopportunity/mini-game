function spend(p, amt) { p.cash -= amt; }
function spendToPot(p, amt) {
  spend(p, amt);
  pot += amt;
  flyMoney(playerCardEl(p.idx), document.getElementById('pot'), amt);
}

const CARDS = [
  // ---- 순금액형 (유리 2 / 불리 2, 예전엔 9장이나 됐던 걸 압축) ----
  { favorable: true, text: p => `보너스 상금 +${gainAmount(p, 0.12)}만원`, fn: p => { p.cash += gainAmount(p, 0.12); } },
  { favorable: true, text: p => `길거리 이벤트 당첨! +${gainAmount(p, 0.10)}만원`, fn: p => { p.cash += gainAmount(p, 0.10); } },
  { favorable: false, text: p => `세금 추징 -${payAmount(p, 0.06)}만원`, fn: p => spendToPot(p, payAmount(p, 0.06)) },
  { favorable: false, text: p => `벌금 고지서 도착! -${payAmount(p, 0.05)}만원 납부`, fn: p => spendToPot(p, payAmount(p, 0.05)) },

  // ---- 기존 유지 ----
  { favorable: false, text: '밀수 적발! 무인도로 강제 이송', fn: p => { p.pos = 10; p.stuck = true; p.jailTurns = 0; interrupted = true; } },
  { favorable: false, text: '출발점으로 순간이동 (급여 없음)', fn: p => { p.pos = 0; interrupted = true; } },
  { favorable: true, text: '투자 성공! 다음 세금은 면제됩니다.', fn: p => { p.taxExempt = true; } },
  { favorable: true, text: p => `컨설팅비 청구! ${opponentOf(p).name}에게 ${gainAmount(p, 0.08)}만원을 받았습니다.`, fn: p => { chargePlayer(opponentOf(p), gainAmount(p, 0.08), { toPlayer: p }); } },
  { favorable: false, text: p => `선의의 기부자 등장! ${opponentOf(p).name}에게 ${payAmount(p, 0.06)}만원을 지불합니다.`, fn: p => { chargePlayer(p, payAmount(p, 0.06), { toPlayer: opponentOf(p) }); } },
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

  // ---- 신규 ----
  { favorable: true, text: '황금열쇠 두 장 등장! 더 유리한 카드를 직접 골라잡으세요.', chooseFrom: true, fn: () => {} },
  { favorable: true, text: '도시 강탈! 라이벌 소유 도시 중 하나를 무작위로 빼앗아옵니다.', fn: p => {
      const rival = opponentOf(p);
      const stealable = rival ? TILES.filter(t => t && t.type === 'city' && t.owner === rival.idx && !t.landmark) : [];
      if (stealable.length) {
        const t = stealable[Math.floor(Math.random() * stealable.length)];
        t.owner = p.idx;
        t.stageLap = p.lapCount;
        log(`🏴‍☠️ ${p.name}, ${rival.name}의 ${t.name}을(를) 강탈했습니다!`);
      } else {
        p.cash += gainAmount(p, 0.07);
      }
    } },
  { favorable: true, text: '황금 나침반 발동! 보드에서 가장 비싼 빈 도시로 순간이동합니다.', warpTo: true, fn: p => {
      const empties = TILES.filter(t => t && t.type === 'city' && t.owner === null);
      if (empties.length) {
        const best = empties.reduce((a, b) => (b.price > a.price ? b : a));
        p.pos = TILES.indexOf(best);
        log(`🧭 ${p.name}, ${best.name}(으)로 순간이동했습니다!`);
      } else {
        p.cash += gainAmount(p, 0.05);
      }
    } },
  { favorable: true, text: '건설 할인권 획득! 다음 건설비가 50% 할인됩니다.', fn: p => { p.buildDiscount = 0.5; } },
  { favorable: true, text: '통행료 증폭권 획득! 보유 도시 중 하나, 다음 방문자의 통행료가 2배로 뜁니다.', fn: p => {
      const owned = TILES.filter(t => t && t.type === 'city' && t.owner === p.idx && !t.landmark);
      if (owned.length) {
        const t = owned[Math.floor(Math.random() * owned.length)];
        t.tollBoost = true;
        log(`💥 ${p.name}, ${t.name}에 통행료 증폭권 설치! (다음 방문자부터 2배)`);
      } else {
        p.cash += gainAmount(p, 0.05);
      }
    } },
  { favorable: false, text: p => {
      const stake = Math.max(10, Math.round(p.cash * 0.2));
      return `반반 승부! ${stake}만원을 걸고 동전을 던집니다...`;
    }, fn: p => {
      const stake = Math.max(10, Math.round(p.cash * 0.2));
      if (Math.random() < 0.5) {
        p.cash += stake;
        log(`🍀 ${p.name}, 반반 승부 성공! +${stake}만원`);
        SFX.casinoWin();
      } else {
        const lost = Math.min(stake, p.cash);
        spendToPot(p, lost);
        log(`💀 ${p.name}, 반반 승부 실패... -${lost}만원`);
        SFX.casinoLose();
      }
    } },
  { favorable: true, text: '보험증서 획득! 다음 강제 지불(세금·통행료 등) 한 번을 완전히 면제받습니다.', fn: p => { p.paymentShield = true; } },
  { favorable: false, text: '불운의 징조... 다음 주사위가 낮은 눈으로 편향됩니다.', fn: p => { p.badLuck = true; } },
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
