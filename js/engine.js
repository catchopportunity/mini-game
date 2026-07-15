// ---------- Game state & turn flow ----------
let players, pot, current, phase, interrupted;
let pendingCharge = null; // { player, amount, opts, onDone } while awaiting-asset-sale
let pendingCardChoice = null; // { player, optionA, optionB, afterResolve } while awaiting-card-choice
let botCount = 1;
let botThinking = false;

// 새 게임이 시작되면 이전 게임에서 예약된 setTimeout이 뒤늦게 실행돼 리셋된 상태를 건드리지 않도록 세대 값으로 무효화
let gameEpoch = 0;
function schedule(fn, delay) {
  const epoch = gameEpoch;
  return setTimeout(() => { if (epoch === gameEpoch) fn(); }, delay);
}

function initGame() {
  gameEpoch++;
  TILES.forEach(t => {
    if (t.type === 'city') { t.owner = null; t.stars = 0; t.landmark = false; t.stageLap = null; t.tollBoost = false; }
    else if (t.type === 'compound') { t.owner = null; t.hits = 0; }
    else if (t.type === 'trust') { t.owner = null; }
  });
  wormholePair = pickWormholePair();
  activeGlobalEvent = null;
  globalEventTurnsLeft = 0;
  players = [
    { idx: 0, name: '플레이어', isBot: false, cash: 100, pos: 0, stuck: false, jailTurns: 0, doublesCount: 0, lapCount: 0, taxExempt: false, paymentShield: false, buildDiscount: null, badLuck: false, debt: 0, eliminated: false },
  ];
  const shuffledPersonalities = [...BOT_PERSONALITIES].sort(() => Math.random() - 0.5);
  for (let i = 0; i < botCount; i++) {
    players.push({
      idx: i + 1,
      name: botCount === 1 ? '봇' : `${i + 1}호봇`,
      isBot: true, cash: 1000, pos: 0, stuck: false, jailTurns: 0, doublesCount: 0, lapCount: 0, taxExempt: false, paymentShield: false, buildDiscount: null, badLuck: false, debt: 0, eliminated: false,
      personality: shuffledPersonalities[i % shuffledPersonalities.length],
    });
  }
  pot = 0;
  phase = 'idle';
  interrupted = false;
  botThinking = false;
  document.getElementById('log').innerHTML = '';
  document.getElementById('overlay').style.display = 'none';
  current = Math.floor(Math.random() * players.length);
  log('🎮 새 게임 시작! ' + players[current].name + '가 먼저 시작합니다.');
  if (botCount > 0) {
    const intro = players.filter(p => p.isBot).map(p => `${p.personality.icon} ${p.name}(${p.personality.label})`).join(', ');
    log(`🤖 봇 성향: ${intro}`);
  }
  render();
  startTurn(current);
}

function log(msg) {
  const el = document.getElementById('log');
  const d = document.createElement('div');
  d.textContent = msg;
  el.prepend(d);
  while (el.children.length > 60) el.removeChild(el.lastChild);
}

function chargePlayer(player, amount, opts = {}) {
  if (!ensureFunds(player, amount)) {
    bankrupt(player);
    return false;
  }
  player.cash -= amount;
  if (opts.toPot) pot += amount;
  if (opts.toPlayer) opts.toPlayer.cash += amount;
  render();
  if (opts.toPlayer) flyMoney(playerCardEl(player.idx), playerCardEl(opts.toPlayer.idx), amount);
  else if (opts.toPot) flyMoney(playerCardEl(player.idx), document.getElementById('pot'), amount);
  return true;
}

// 사람이 강제 지불(통행료/세금)을 감당 못 하면 자동 매각 대신 직접 고를 기회를 줌.
// 봇이거나 이미 감당 가능하거나 팔 게 없으면 기존과 동일하게 즉시 처리.
function chargePlayerInteractive(player, amount, opts, onDone) {
  if (player.paymentShield) {
    player.paymentShield = false;
    log(`☂️ ${player.name}, 보험증서로 지불(${amount}만원)을 면제받았습니다!`);
    SFX.click();
    onDone();
    return;
  }
  const owned = TILES.filter(t => t && t.owner === player.idx &&
    (t.type === 'city' || t.type === 'compound' || t.type === 'trust'));
  if (player.isBot || player.cash >= amount || owned.length === 0) {
    chargePlayer(player, amount, opts);
    onDone();
    return;
  }
  pendingCharge = { player, amount, opts, onDone };
  phase = 'awaiting-asset-sale';
  renderActions();
}

function sellAssetForPending(tileIdx) {
  ensureAudio();
  SFX.click();
  const t = TILES[tileIdx];
  const p = pendingCharge.player;
  liquidateAsset(t, p);
  const stillOwned = TILES.filter(tl => tl && tl.owner === p.idx &&
    (tl.type === 'city' || tl.type === 'compound' || tl.type === 'trust'));
  if (p.cash >= pendingCharge.amount || stillOwned.length === 0) {
    const { amount, opts, onDone } = pendingCharge;
    pendingCharge = null;
    phase = 'resolving';
    chargePlayer(p, amount, opts);
    onDone();
  } else {
    render();
  }
}

// 봇이 여럿일 때는 파산 즉시 게임이 끝나지 않고 그 플레이어만 탈락, 남은 인원으로 계속.
// 사람이 파산하면 그 즉시 패배로 게임 종료. 최후의 1인이 남으면 그 사람이 승자.
function bankrupt(player) {
  player.eliminated = true;
  player.cash = 0;
  SFX.bankrupt();
  const active = players.filter(p => !p.eliminated);
  if (player.idx === 0) {
    phase = 'gameover';
    log(`💥 ${player.name} 파산! 게임 종료...`);
    render();
    showOverlay('GAME OVER', '파산했습니다... 다음엔 더 잘할 수 있을 거예요!');
  } else if (active.length <= 1) {
    phase = 'gameover';
    const winner = active[0];
    log(`💥 ${player.name} 파산으로 탈락! 최후의 1인은 ${winner.name}!`);
    render();
    if (winner.idx === 0) SFX.win();
    showOverlay('GAME OVER', `${winner.name} 승리! (${player.name} 파산)`);
  } else {
    log(`💥 ${player.name} 파산으로 탈락! (남은 인원 ${active.length}명)`);
    render();
  }
}

function showOverlay(title, sub) {
  document.getElementById('overTitle').textContent = title;
  document.getElementById('overSub').textContent = sub;
  document.getElementById('overlay').style.display = 'flex';
}

function showEventCard(icon, title, who, text, cb) {
  const modal = document.getElementById('keyModal');
  document.getElementById('keyIconEl').textContent = icon;
  document.getElementById('keyTitleEl').textContent = title;
  document.getElementById('keyWho').textContent = who;
  document.getElementById('keyText').textContent = text;
  modal.classList.remove('hide');
  modal.classList.add('show');
  schedule(() => {
    modal.classList.remove('show');
    modal.classList.add('hide');
    schedule(() => {
      modal.classList.remove('hide');
      cb();
    }, 320);
  }, 1650);
}

function showKeyCard(who, text, cb) {
  showEventCard('🔑', 'GOLDEN KEY', who, text, cb);
}

// "두 장 중 선택" 카드: chooseFrom 카드 자체는 아무 효과가 없고, 대신 나머지 카드 중 서로 다른
// 두 장을 뽑아 플레이어(또는 봇)가 하나를 골라 그 효과만 적용한다.
function resolveCardChoice(player, wasDouble, afterResolve) {
  const pool = CARDS.filter(c => !c.chooseFrom);
  const optionA = pickCard(player, pool);
  let optionB = pickCard(player, pool);
  for (let guard = 0; optionB === optionA && guard < 20; guard++) optionB = pickCard(player, pool);
  if (player.isBot) {
    botThinking = true; render();
    schedule(() => {
      botThinking = false;
      applyChosenCard(player, chooseBotCard(optionA, optionB), wasDouble, afterResolve);
    }, thinkDelay());
  } else {
    pendingCardChoice = { player, optionA, optionB, wasDouble, afterResolve };
    phase = 'awaiting-card-choice';
    renderActions();
  }
}

function applyChosenCard(player, card, wasDouble, afterResolve) {
  const text = cardText(card, player);
  log(`🔑 ${player.name}: ${text}`);
  card.fn(player);
  render();
  if (card.warpTo) {
    schedule(() => resolveTile(player, wasDouble), DELAY);
  } else {
    afterResolve();
  }
}

function chooseCard(which) {
  ensureAudio();
  SFX.click();
  const { player, optionA, optionB, wasDouble, afterResolve } = pendingCardChoice;
  pendingCardChoice = null;
  phase = 'resolving';
  applyChosenCard(player, which === 'A' ? optionA : optionB, wasDouble, afterResolve);
}

// 도시 매입/인수로 그룹을 방금 독점했다면 축하 연출을 먼저 보여주고 cb 실행
function maybeCelebrateMonopoly(player, tile, cb) {
  if (tile.type === 'city' && groupFullyOwned(player.idx, tile.group)) {
    const g = GROUPS[tile.group];
    render();
    SFX.monopoly();
    showEventCard('🎉', 'MONOPOLY', player.name, `${g.name} 지역 독점 완료! 통행료가 대폭 상승합니다.`, cb);
  } else {
    cb();
  }
}

// ---------- Turn flow ----------
function startTurn(idx) {
  current = idx;
  interrupted = false;
  const p = players[idx];
  if (p.stuck && p.jailTurns >= 2) {
    p.stuck = false; p.jailTurns = 0;
    log(`🏝️ ${p.name} 무인도에서 강제 석방!`);
  }
  render();
  proceedNormalStart();
}

function proceedNormalStart() {
  phase = 'idle';
  const p = players[current];
  p.doublesCount = 0;
  render();
  if (p.isBot) {
    schedule(rollForCurrent, DELAY);
  }
}

function playCasino(player) {
  const stake = Math.min(player.cash, Math.max(20, Math.round(player.cash * 0.15)));
  if (stake <= 0) return null;
  const roll = Math.random();
  let mult, label;
  if (roll < 0.40) { mult = 0; label = '꽝! 스테이크를 잃었습니다.'; }
  else if (roll < 0.75) { mult = 2; label = '적중! 2배로 돌려받았습니다.'; }
  else if (roll < 0.95) { mult = 3; label = '대박! 3배로 돌려받았습니다.'; }
  else { mult = 6; label = '🎉 JACKPOT! 6배로 돌려받았습니다.'; }
  return { stake, mult, label };
}

// 주사위 버튼을 오래 누를수록(최대 CHARGE_MAX_MS) chargeLevel(0~1)이 커짐.
// 0이면 공정한 1d6과 완전히 동일 — 안 누르고 그냥 클릭해도 손해는 없음.
// 릴리즈 타이밍에 약간의 흔들림(CHARGE_WOBBLE)을 더해 완벽한 정밀 조작은 불가능하게 함.
function chargedDie(chargeLevel) {
  const wobble = (Math.random() * 2 - 1) * CHARGE_WOBBLE;
  const t = Math.min(1, Math.max(0, chargeLevel + wobble));
  const exponent = 1 - t * 0.65; // 1.0(공정) → 0.35(높은 눈으로 강하게 편향)
  return 1 + Math.floor(6 * Math.pow(Math.random(), exponent));
}

// 황금열쇠 "불운의 징조" 카드용 — chargedDie와 반대로 낮은 눈 쪽으로 편향
function unluckyDie() {
  return 1 + Math.floor(6 * Math.pow(Math.random(), 1.8));
}

function rollForCurrent(chargeLevel = 0) {
  if (phase !== 'idle') return;
  phase = 'rolling';
  const p = players[current];
  const badLuck = p.badLuck;
  if (badLuck) p.badLuck = false;
  let d1 = badLuck ? unluckyDie() : (p.isBot ? 1 + Math.floor(Math.random() * 6) : chargedDie(chargeLevel));
  let d2 = badLuck ? unluckyDie() : (p.isBot ? 1 + Math.floor(Math.random() * 6) : chargedDie(chargeLevel));
  const chargeTag = (!p.isBot && chargeLevel > 0.05) ? ` [차지 ${Math.round(Math.min(1, chargeLevel) * 100)}%]` : '';
  const badLuckTag = badLuck ? ' [불운의 징조]' : '';

  if (p.stuck) {
    document.getElementById('diceDisplay').textContent = `🎲 ${d1} + ${d2} = ${d1 + d2}`;
    SFX.dice();
    if (d1 === d2) {
      p.stuck = false; p.jailTurns = 0;
      log(`🎲 ${p.name}: ${d1} + ${d2} = ${d1 + d2}${chargeTag}${badLuckTag} (더블!) 🏝️ 무인도 탈출!`);
      setTimeout(SFX.doubleDing, 150);
      // 탈출 굴림으로 이동은 하지만, 더블이어도 추가 굴림 보너스는 없음
      movePlayerBy(p, d1 + d2, () => resolveTile(p, false));
    } else {
      p.jailTurns++;
      log(`🎲 ${p.name}: ${d1} + ${d2} = ${d1 + d2}${chargeTag}${badLuckTag}. 탈출 실패... (대기 ${p.jailTurns}/2턴)`);
      SFX.jail();
      render();
      schedule(switchTurn, DELAY);
    }
    return;
  }

  // 불운의 징조가 발동한 굴림은 은근한 난이도 보정으로 다시 유리하게 덮어쓰지 않는다
  if (!p.isBot && !badLuck) {
    const desperation = desperationLevel(p);
    if (desperation > 0 && Math.random() < desperation) {
      const adjustedSum = luckyAdjust(p, d1 + d2);
      if (adjustedSum !== d1 + d2) [d1, d2] = diceForSum(adjustedSum);
    }
  }
  document.getElementById('diceDisplay').textContent = `🎲 ${d1} + ${d2} = ${d1 + d2}`;
  log(`🎲 ${p.name}: ${d1} + ${d2} = ${d1 + d2}${chargeTag}${badLuckTag}` + (d1 === d2 ? ' (더블!)' : ''));
  SFX.dice();
  if (d1 === d2) setTimeout(SFX.doubleDing, 150);
  renderActions();

  if (d1 === d2) p.doublesCount++; else p.doublesCount = 0;

  if (p.doublesCount >= 3) {
    p.pos = 10; p.stuck = true; p.jailTurns = 0; p.doublesCount = 0;
    log(`🚨 연속 더블 3회! ${p.name} 무인도로 강제 이송!`);
    SFX.jail();
    render();
    schedule(switchTurn, DELAY);
    return;
  }

  movePlayerBy(p, d1 + d2, () => resolveTile(p, d1 === d2));
}

function movePlayerBy(player, steps, cb) {
  let remaining = steps;
  const hop = () => {
    if (remaining <= 0) {
      schedule(cb, DELAY);
      return;
    }
    player.pos = (player.pos + 1) % 40;
    remaining--;
    if (player.pos === 0) {
      player.cash += SALARY;
      player.lapCount++;
      const bonus = Math.round(pot * LAP_POT_SHARE);
      const dividend = TILES.reduce((sum, t) =>
        sum + (t && t.type === 'trust' && t.owner === player.idx ? trustDividend(t) : 0), 0);
      if (bonus > 0) {
        pot -= bonus; player.cash += bonus;
        flyMoney(document.getElementById('pot'), playerCardEl(player.idx), bonus);
      }
      if (dividend > 0) player.cash += dividend;
      let msg = `🚀 ${player.name}, 출발점 통과! 급여 +${SALARY}만원`;
      if (bonus > 0) msg += ` + 세금 환급 +${bonus}만원`;
      if (dividend > 0) msg += ` + 투자 배당 +${dividend}만원`;
      log(msg);
      SFX.gain();
      if (player.debt > 0) {
        const interest = Math.round(player.debt * DEBT_INTEREST_RATE);
        player.debt += interest;
        log(`🏦 ${player.name}, 미상환 부채에 이자 +${interest}만원 (누적 부채 ${player.debt}만원)`);
        if (player.isBot) {
          const room = player.cash - safetyBuffer(player, BOT_BUY_BUFFER);
          const repay = Math.min(Math.max(0, room), player.debt);
          if (repay > 0) {
            player.cash -= repay;
            player.debt -= repay;
            log(`🏦 ${player.name}, 여유 자금으로 부채 ${repay}만원 상환. (남은 부채 ${player.debt}만원)`);
          }
        }
      }
      maybeTriggerGlobalEvent();
    }
    render();
    schedule(hop, STEP_DELAY);
  };
  hop();
}

// 황금열쇠 "건설 할인권" 적용가 — 실제 소진은 건설이 확정 실행되는 시점에만 한다(가격 표시만으로는 소진 X)
function effectiveBuildCost(player, tile) {
  const base = buildCost(tile);
  return player.buildDiscount ? Math.round(base * (1 - player.buildDiscount)) : base;
}
function effectiveLandmarkCost(player, tile) {
  const base = landmarkCost(tile);
  return player.buildDiscount ? Math.round(base * (1 - player.buildDiscount)) : base;
}

function resolveTile(player, wasDouble) {
  if (phase === 'gameover') return;

  // 고정 웜홀 통로 — 이 칸 자체의 효과는 처리하지 않고, 곧장 반대편으로 이어준다
  if (wormholePair && wormholePair.includes(player.pos)) {
    const dest = wormholePair[0] === player.pos ? wormholePair[1] : wormholePair[0];
    log(`🕳️ ${player.name}, 고정 웜홀을 통과해 ${TILES[dest].name}(으)로 이동했습니다!`);
    SFX.warp();
    player.pos = dest;
    render();
    schedule(() => resolveTile(player, wasDouble), DELAY);
    return;
  }

  const tile = TILES[player.pos];
  interrupted = false;

  const afterResolve = () => {
    if (phase === 'gameover') return;
    if (player.eliminated) { schedule(switchTurn, DELAY); return; }
    if (wasDouble && !interrupted && !player.stuck) {
      log(`✨ 더블! ${player.name} 한 번 더 굴립니다.`);
      phase = 'idle';
      render();
      if (player.isBot) schedule(rollForCurrent, DELAY);
      else renderActions();
    } else {
      schedule(switchTurn, DELAY);
    }
  };

  switch (tile.type) {
    case 'start':
      log(`${player.name}, 출발점 도착.`);
      afterResolve();
      break;
    case 'island':
      player.stuck = true;
      player.jailTurns = 0;
      log(`🏝️ ${player.name}, 무인도에 직접 도착해서 갇혔습니다!`);
      SFX.jail();
      render();
      schedule(switchTurn, DELAY);
      break;
    case 'rest': {
      const gained = pot;
      player.cash += gained;
      pot = 0;
      log(`💰 ${player.name}, 중앙기금 ${gained}만원 획득!`);
      SFX.gain();
      render();
      flyMoney(document.getElementById('pot'), playerCardEl(player.idx), gained);
      afterResolve();
      break;
    }
    case 'warp': {
      const options = [];
      for (let i = 0; i < 40; i++) if (i !== 30) options.push(i);
      const dest = options[Math.floor(Math.random() * options.length)];
      log(`🌀 ${player.name}, 순간이동 소용돌이에 빨려들어갑니다...!`);
      SFX.warp();
      player.pos = dest;
      render();
      schedule(() => resolveTile(player, wasDouble), DELAY);
      break;
    }
    case 'tax': {
      if (player.taxExempt) {
        player.taxExempt = false;
        log(`🎫 ${player.name}, 세금 면제권 사용! 재산세를 내지 않았습니다.`);
        SFX.click();
        afterResolve();
        break;
      }
      const amt = taxAmount(player);
      const shielded = player.paymentShield; // chargePlayerInteractive가 이 값을 소비하기 전에 스냅샷
      log(`💸 ${player.name}, 재산세 ${amt}만원 납부. (자산 ${netWorth(player)}만원의 ${Math.round(TAX_RATE * 100)}%)`);
      SFX.tax();
      chargePlayerInteractive(player, amt, { toPot: true }, () => {
        // 보험증서로 세금 자체를 면제받았다면 뒤따르는 소각도 함께 면제 — "완전 면제"가 절반짜리가 되지 않도록
        if (!player.eliminated && !shielded) {
          const burnAmt = Math.round(player.cash * TAX_BURN_RATE);
          player.cash -= burnAmt;
          log(`🔥 ${player.name}, 남은 현금의 ${Math.round(TAX_BURN_RATE * 100)}% ${burnAmt}만원이 그대로 소각되었습니다!`);
          SFX.tax();
          render();
        }
        afterResolve();
      });
      break;
    }
    case 'goldenkey': {
      const card = pickCard(player);
      SFX.card();
      if (card.chooseFrom) {
        resolveCardChoice(player, wasDouble, afterResolve);
        break;
      }
      const drawnText = cardText(card, player);
      showKeyCard(player.name, drawnText, () => {
        log(`🔑 ${player.name}: ${drawnText}`);
        card.fn(player);
        render();
        if (card.warpTo) {
          // 카드가 위치를 옮겼으니 이 턴 흐름을 끝내지 말고 새 위치의 칸 효과를 이어서 처리
          schedule(() => resolveTile(player, wasDouble), DELAY);
        } else {
          afterResolve();
        }
      });
      break;
    }
    case 'casino': {
      const result = playCasino(player);
      if (!result) {
        log(`🎰 ${player.name}, 돈이 없어 카지노에서 구경만 합니다.`);
        afterResolve();
        break;
      }
      SFX.casinoSpin();
      showEventCard('🎰', 'CASINO', player.name, `${result.stake}만원 베팅... ${result.label}`, () => {
        player.cash -= result.stake;
        if (result.mult === 0) {
          pot += result.stake;
          log(`🎰 ${player.name}, 카지노에서 ${result.stake}만원 베팅 후 잃었습니다.`);
          SFX.casinoLose();
          flyMoney(playerCardEl(player.idx), document.getElementById('pot'), result.stake);
        } else {
          const payout = result.stake * result.mult;
          player.cash += payout;
          log(`🎰 ${player.name}, 카지노에서 ${result.stake}만원 베팅해 ${payout}만원 획득!`);
          SFX.casinoWin();
        }
        render();
        afterResolve();
      });
      break;
    }
    case 'compound':
      if (tile.owner === null) {
        if (player.isBot) {
          botThinking = true; render();
          schedule(() => {
            botThinking = false;
            if (botWantsToBuy(player, tile)) {
              player.cash -= tile.price;
              tile.owner = player.idx; tile.hits = 0;
              log(`🏪 ${player.name}, ${tile.name} 매입! (-${tile.price}만원)`);
              SFX.buy();
            } else {
              log(`🏪 ${player.name}, ${tile.name} 매입을 포기했습니다.`);
            }
            render();
            afterResolve();
          }, thinkDelay());
        } else {
          phase = 'awaiting-buy';
          renderActions();
          window.__pendingResolve = afterResolve;
        }
      } else if (tile.owner === player.idx) {
        log(`${player.name}, 본인 소유의 ${tile.name} 도착. (다음 통행료 ${compoundToll(tile)}만원)`);
        afterResolve();
      } else {
        const owner = players[tile.owner];
        const toll = compoundToll(tile);
        log(`🏪 ${player.name}, ${owner.name} 소유 ${tile.name} 도착. 통행료 ${toll}만원 지불! (다음엔 더 비싸집니다)`);
        SFX.pay();
        tile.hits++;
        chargePlayerInteractive(player, toll, { toPlayer: owner }, afterResolve);
      }
      break;
    case 'trust':
      if (tile.owner === null) {
        if (player.isBot) {
          botThinking = true; render();
          schedule(() => {
            botThinking = false;
            if (botWantsToBuy(player, tile)) {
              player.cash -= tile.price;
              tile.owner = player.idx;
              log(`📈 ${player.name}, ${tile.name} 매입! (-${tile.price}만원, 한 바퀴마다 +${trustDividend(tile)}만원 배당)`);
              SFX.buy();
            } else {
              log(`📈 ${player.name}, ${tile.name} 매입을 포기했습니다.`);
            }
            render();
            afterResolve();
          }, thinkDelay());
        } else {
          phase = 'awaiting-buy';
          renderActions();
          window.__pendingResolve = afterResolve;
        }
      } else if (tile.owner === player.idx) {
        log(`${player.name}, 본인 소유의 ${tile.name} 도착. (한 바퀴마다 +${trustDividend(tile)}만원 배당 중)`);
        afterResolve();
      } else {
        log(`${player.name}, ${players[tile.owner].name} 소유 ${tile.name} 도착. (통행료 없음)`);
        afterResolve();
      }
      break;
    case 'city':
      if (tile.owner === null) {
        if (player.isBot) {
          botThinking = true; render();
          schedule(() => {
            botThinking = false;
            if (botWantsToBuy(player, tile)) {
              player.cash -= tile.price;
              tile.owner = player.idx; tile.stars = 0; tile.stageLap = player.lapCount;
              log(`🏙️ ${player.name}, ${tile.name} 매입! (-${tile.price}만원)`);
              SFX.buy();
              maybeCelebrateMonopoly(player, tile, () => { render(); afterResolve(); });
            } else {
              log(`🏙️ ${player.name}, ${tile.name} 매입을 포기했습니다.`);
              render();
              afterResolve();
            }
          }, thinkDelay());
        } else {
          phase = 'awaiting-buy';
          renderActions();
          window.__pendingResolve = afterResolve;
        }
      } else if (tile.owner === player.idx) {
        // 색깔 그룹 독점 여부와 무관하게, 마지막 건설 이후 한 바퀴를 돌고 다시 착지하면 다음 단계 건설 가능
        const lapCleared = player.lapCount > tile.stageLap;
        const canBuildNext = tile.stars < 5 && lapCleared;
        const landmarkEligible = tile.stars === 5 && !tile.landmark && lapCleared;
        if (canBuildNext) {
          const cost = effectiveBuildCost(player, tile);
          if (player.isBot) {
            botThinking = true; render();
            schedule(() => {
              botThinking = false;
              if (botWantsToBuild(player, cost)) {
                player.cash -= cost;
                tile.stars++;
                tile.stageLap = player.lapCount;
                const discounted = !!player.buildDiscount;
                player.buildDiscount = null;
                log(`🏗️ ${player.name}, ${tile.name}에 건설! (${tierName(tile)}, -${cost}만원${discounted ? ' · 할인권 사용' : ''}, 통행료 ${getToll(tile)}만원)`);
                SFX.build();
              } else {
                log(`${player.name}, 본인 소유의 ${tile.name} 도착. (건설 자금 부족)`);
              }
              render();
              afterResolve();
            }, thinkDelay());
          } else {
            phase = 'awaiting-build';
            renderActions();
            window.__pendingResolve = afterResolve;
          }
        } else if (landmarkEligible) {
          const cost = effectiveLandmarkCost(player, tile);
          if (player.isBot) {
            botThinking = true; render();
            schedule(() => {
              botThinking = false;
              if (botWantsToBuildLandmark(player, cost)) {
                player.cash -= cost;
                tile.landmark = true;
                tile.stageLap = player.lapCount;
                const discounted = !!player.buildDiscount;
                player.buildDiscount = null;
                log(`👑 ${player.name}, ${tile.name}에 ${tile.landmarkName}${tile.landmarkIcon}을(를) 건설했습니다! (-${cost}만원${discounted ? ' · 할인권 사용' : ''}, 이제 인수 불가)`);
                SFX.landmark();
              } else {
                log(`${player.name}, 본인 소유의 ${tile.name} 도착. (랜드마크 자금 부족)`);
              }
              render();
              afterResolve();
            }, thinkDelay());
          } else {
            phase = 'awaiting-landmark';
            renderActions();
            window.__pendingResolve = afterResolve;
          }
        } else {
          const reason = tile.landmark ? ' (이미 랜드마크 완공)' : ' (한 바퀴 더 돌아야 다음 건설 가능)';
          log(`${player.name}, 본인 소유의 ${tile.name} 도착.${reason}`);
          afterResolve();
        }
      } else {
        const owner = players[tile.owner];
        const toll = getToll(tile);
        if (tile.landmark) {
          log(`🏙️ ${player.name}, ${owner.name} 소유 ${tile.landmarkName} ${tile.landmarkIcon} 도착. 통행료 ${toll}만원 지불. (인수 불가)`);
          SFX.pay();
          chargePlayerInteractive(player, toll, { toPlayer: owner }, afterResolve);
        } else if (player.isBot) {
          botThinking = true; render();
          schedule(() => {
            botThinking = false;
            const acq = acquireTotalCost(tile);
            if (botWantsToAcquire(player, tile, acq)) {
              chargePlayer(player, acq, { toPlayer: owner });
              tile.owner = player.idx;
              tile.stageLap = player.lapCount;
              tile.tollBoost = false;
              log(`🏆 ${player.name}, ${owner.name} 소유 ${tile.name}을(를) 인수했습니다! (통행료 포함 -${acq}만원)`);
              SFX.buy();
              maybeCelebrateMonopoly(player, tile, () => {
                if (tile.stars < 5) {
                  const bCost = effectiveBuildCost(player, tile);
                  if (botWantsToBuild(player, bCost)) {
                    player.cash -= bCost;
                    tile.stars++;
                    tile.stageLap = player.lapCount;
                    const discounted = !!player.buildDiscount;
                    player.buildDiscount = null;
                    log(`🏗️ ${player.name}, 인수 직후 ${tile.name} 추가 건설! (${tierName(tile)}, -${bCost}만원${discounted ? ' · 할인권 사용' : ''}, 통행료 ${getToll(tile)}만원)`);
                    SFX.build();
                    render();
                  }
                }
                afterResolve();
              });
            } else {
              log(`🏙️ ${player.name}, ${owner.name} 소유 ${tile.name} 도착. 통행료 ${toll}만원 지불.`);
              SFX.pay();
              tile.tollBoost = false;
              chargePlayer(player, toll, { toPlayer: owner });
              afterResolve();
            }
          }, thinkDelay());
        } else {
          phase = 'awaiting-toll-choice';
          renderActions();
          window.__pendingResolve = afterResolve;
        }
      }
      break;
  }
}

function finishPending() {
  render();
  const cb = window.__pendingResolve; window.__pendingResolve = null;
  if (cb) cb();
}

function buyCurrent() {
  ensureAudio();
  const p = players[current];
  const tile = TILES[p.pos];
  if (tile.owner !== null || p.cash < tile.price) return;
  p.cash -= tile.price;
  tile.owner = p.idx;
  if (tile.type === 'city') { tile.stars = 0; tile.stageLap = p.lapCount; }
  if (tile.type === 'compound') tile.hits = 0;
  const icon = tile.type === 'compound' ? '🏪' : tile.type === 'trust' ? '📈' : '🏙️';
  log(`${icon} ${p.name}, ${tile.name} 매입! (-${tile.price}만원)`);
  SFX.buy();
  phase = 'resolving';
  maybeCelebrateMonopoly(p, tile, finishPending);
}

function skipBuy() {
  ensureAudio();
  SFX.click();
  const p = players[current];
  const tile = TILES[p.pos];
  log(`${p.name}, ${tile.name} 매입을 포기했습니다.`);
  phase = 'resolving';
  finishPending();
}

function buildCurrentOnLanding() {
  ensureAudio();
  const p = players[current];
  const tile = TILES[p.pos];
  const cost = effectiveBuildCost(p, tile);
  if (p.cash < cost) return;
  p.cash -= cost;
  tile.stars++;
  tile.stageLap = p.lapCount;
  const discounted = !!p.buildDiscount;
  p.buildDiscount = null;
  log(`🏗️ ${p.name}, ${tile.name}에 건설! (${tierName(tile)}, -${cost}만원${discounted ? ' · 할인권 사용' : ''}, 통행료 ${getToll(tile)}만원)`);
  SFX.build();
  phase = 'resolving';
  finishPending();
}

function skipBuildOnLanding() {
  ensureAudio();
  SFX.click();
  const p = players[current];
  const tile = TILES[p.pos];
  log(`${p.name}, ${tile.name} 건설을 보류했습니다.`);
  phase = 'resolving';
  finishPending();
}

function buildLandmarkCurrent() {
  ensureAudio();
  const p = players[current];
  const tile = TILES[p.pos];
  const cost = effectiveLandmarkCost(p, tile);
  if (p.cash < cost) return;
  p.cash -= cost;
  tile.landmark = true;
  const discounted = !!p.buildDiscount;
  p.buildDiscount = null;
  log(`👑 ${p.name}, ${tile.name}에 ${tile.landmarkName} ${tile.landmarkIcon}을(를) 건설했습니다! (-${cost}만원${discounted ? ' · 할인권 사용' : ''}, 이제 인수 불가)`);
  SFX.landmark();
  phase = 'resolving';
  finishPending();
}

function skipLandmark() {
  ensureAudio();
  SFX.click();
  const p = players[current];
  const tile = TILES[p.pos];
  log(`${p.name}, ${tile.name} 랜드마크 건설을 보류했습니다.`);
  phase = 'resolving';
  finishPending();
}

function payTollCurrent() {
  ensureAudio();
  const p = players[current];
  const tile = TILES[p.pos];
  const owner = players[tile.owner];
  const toll = getToll(tile);
  log(`🏙️ ${p.name}, ${owner.name} 소유 ${tile.name} 통행료 ${toll}만원 지불.`);
  SFX.pay();
  tile.tollBoost = false;
  chargePlayerInteractive(p, toll, { toPlayer: owner }, () => {
    phase = 'resolving';
    finishPending();
  });
}

function acquireCurrent() {
  ensureAudio();
  const p = players[current];
  const tile = TILES[p.pos];
  const owner = players[tile.owner];
  const cost = acquireTotalCost(tile);
  if (p.cash < cost) return;
  chargePlayer(p, cost, { toPlayer: owner });
  tile.owner = p.idx;
  tile.stageLap = p.lapCount;
  tile.tollBoost = false;
  log(`🏆 ${p.name}, ${owner.name} 소유 ${tile.name}을(를) 인수했습니다! (통행료 포함 -${cost}만원)`);
  SFX.buy();
  phase = 'resolving';
  maybeCelebrateMonopoly(p, tile, () => offerPostAcquireBuild(tile));
}

// 인수 직후엔 그 자리에서 바로 한 단계 추가 건설을 제안 (한 바퀴 대기 없이, 비용은 정상 지불)
function offerPostAcquireBuild(tile) {
  if (tile.type === 'city' && tile.stars < 5) {
    phase = 'awaiting-post-build';
    renderActions();
  } else {
    if (tile.type === 'city') log(`${tile.name}은(는) 이미 ${TIER_NAMES[5]}까지 지어져 있어 추가 건설을 제안하지 않습니다.`);
    finishPending();
  }
}

function buildPostAcquire() {
  const p = players[current];
  const tile = TILES[p.pos];
  const cost = effectiveBuildCost(p, tile);
  if (p.cash < cost) return;
  p.cash -= cost;
  tile.stars++;
  tile.stageLap = p.lapCount;
  const discounted = !!p.buildDiscount;
  p.buildDiscount = null;
  log(`🏗️ ${p.name}, 인수 직후 ${tile.name} 추가 건설! (${tierName(tile)}, -${cost}만원${discounted ? ' · 할인권 사용' : ''}, 통행료 ${getToll(tile)}만원)`);
  SFX.build();
  phase = 'resolving';
  finishPending();
}

function skipPostAcquireBuild() {
  SFX.click();
  phase = 'resolving';
  finishPending();
}

function switchTurn() {
  if (phase === 'gameover') return;
  tickGlobalEvent();
  do {
    current = (current + 1) % players.length;
  } while (players[current].eliminated);
  startTurn(current);
}
