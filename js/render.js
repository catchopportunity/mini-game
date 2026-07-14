// ---------- Rendering ----------
const tileEls = [];

function createBoard() {
  const board = document.getElementById('board');
  for (let i = 0; i < 40; i++) {
    const tile = TILES[i];
    const { row, col } = tilePos(i);
    const el = document.createElement('div');
    el.className = 'tile';
    el.style.gridRow = row; el.style.gridColumn = col;
    if (tile.type === 'city') {
      const g = GROUPS[tile.group];
      el.style.setProperty('--mono-color', g.color);
      el.innerHTML = `<div class="bar" style="background:${g.color}"></div>
        <div class="nm" title="${tile.name}">${tile.name}</div>
        <div class="stats"><span class="pr">${tile.price}</span><span class="toll"></span></div>
        <div class="stage"></div>
        <div class="tokens"></div>
        <div class="owner-strip"></div>`;
    } else if (tile.type === 'compound' || tile.type === 'trust') {
      const barColor = tile.type === 'compound' ? '#f97316' : '#22c55e';
      el.innerHTML = `<div class="bar" style="background:${barColor}"></div>
        <div class="nm" title="${tile.name}">${tile.icon} ${tile.name}</div>
        <div class="stats"><span class="pr">${tile.price}</span><span class="toll"></span></div>
        <div class="stage"></div>
        <div class="tokens"></div>
        <div class="owner-strip"></div>`;
    } else {
      el.classList.add('corner');
      el.innerHTML = `<div class="ic">${tile.icon}</div><div class="nm">${tile.name}</div><div class="tokens"></div>`;
      if (tile.type === 'tax') el.querySelector('.nm').textContent = `${tile.name} ${Math.round(TAX_RATE * 100)}%`;
    }
    board.appendChild(el);
    tileEls[i] = el;
  }
}

function playerCardEl(idx) { return document.getElementById('pcard' + idx); }

// 자금이 어디서 어디로 이동하는지 눈으로 보이도록 카드/중앙기금 사이에 떠다니는 뱃지를 날린다
function flyMoney(fromEl, toEl, amount) {
  if (!fromEl || !toEl || !(amount > 0)) return;
  const fromRect = fromEl.getBoundingClientRect();
  const toRect = toEl.getBoundingClientRect();
  const fromX = fromRect.left + fromRect.width / 2;
  const fromY = fromRect.top + fromRect.height / 2;
  const toX = toRect.left + toRect.width / 2;
  const toY = toRect.top + toRect.height / 2;
  const badge = document.createElement('div');
  badge.className = 'money-fly';
  badge.textContent = `💸 ${fmt(amount)}`;
  badge.style.left = fromX + 'px';
  badge.style.top = fromY + 'px';
  document.body.appendChild(badge);
  // 강제 리플로우: 시작 위치가 먼저 페인트된 뒤에 목표 transform을 걸어야 트랜지션이 실제로 재생된다
  void badge.offsetWidth;
  requestAnimationFrame(() => {
    badge.style.transform = `translate(${toX - fromX}px, ${toY - fromY}px) scale(0.55)`;
    badge.style.opacity = '0';
  });
  setTimeout(() => badge.remove(), 850);
}

function render() {
  for (let i = 0; i < 4; i++) {
    const card = document.getElementById('pcard' + i);
    if (card) {
      card.style.display = i < players.length ? '' : 'none';
      card.style.setProperty('--player-color', PLAYER_COLORS[i]);
    }
  }
  players.forEach((p, i) => {
    const nameEl = document.querySelector('#pcard' + i + ' .name');
    if (nameEl) nameEl.textContent = (p.isBot ? '🤖 ' : '🧑 ') + p.name + (p.eliminated ? ' 💀' : '');
    document.getElementById('cash' + i).textContent = fmt(p.cash);
    const owned = TILES.filter(t => t && t.owner === i &&
      (t.type === 'city' || t.type === 'compound' || t.type === 'trust'));
    const totalValue = owned.reduce((sum, t) => sum + assetValue(t), 0);
    document.getElementById('props' + i).textContent = p.eliminated ? '탈락' : `보유 자산 ${owned.length}개 (${fmt(totalValue)})` + (p.stuck ? ` · 🏝️무인도(${p.jailTurns}/2)` : '');
    document.getElementById('pcard' + i).classList.toggle('turn', current === i && phase !== 'gameover');
  });

  TILES.forEach((tile, i) => {
    if (!tile) return;
    const el = tileEls[i];
    if (!el) return;
    if (tile.type === 'city') {
      const strip = el.querySelector('.owner-strip');
      const stageEl = el.querySelector('.stage');
      const tollEl = el.querySelector('.toll');
      const isMonopoly = tile.owner !== null && groupFullyOwned(tile.owner, tile.group);
      el.classList.toggle('landmark', !!tile.landmark);
      el.classList.toggle('monopoly', isMonopoly);
      tollEl.textContent = '💸' + (tile.owner !== null ? getToll(tile) : tile.tollBase);
      if (tile.owner !== null) {
        strip.style.background = PLAYER_COLORS[tile.owner];
        stageEl.textContent = tile.landmark ? tile.landmarkIcon : (tile.stars > 0 ? '★'.repeat(tile.stars) : '');
      } else {
        strip.style.background = 'transparent';
        stageEl.textContent = '';
      }
    } else if (tile.type === 'compound' || tile.type === 'trust') {
      const strip = el.querySelector('.owner-strip');
      const stageEl = el.querySelector('.stage');
      const tollEl = el.querySelector('.toll');
      if (tile.type === 'compound') {
        tollEl.textContent = '💸' + (tile.owner !== null ? compoundToll(tile) : Math.round(tile.price * 0.15));
      } else {
        tollEl.textContent = '';
      }
      if (tile.owner !== null) {
        strip.style.background = PLAYER_COLORS[tile.owner];
        stageEl.textContent = tile.type === 'compound'
          ? `×${2 ** Math.min(tile.hits, COMPOUND_TOLL_CAP_HITS)}`
          : `+${trustDividend(tile)}`;
      } else {
        strip.style.background = 'transparent';
        stageEl.textContent = '';
      }
    }
    const tok = el.querySelector('.tokens');
    if (tok) {
      tok.innerHTML = '';
      players.forEach((p, pi) => {
        if (p.pos === i && !p.eliminated) {
          const s = document.createElement('div');
          s.className = 'tok p' + pi;
          s.textContent = pi === 0 ? 'P' : String(pi);
          tok.appendChild(s);
        }
      });
    }
  });

  document.getElementById('pot').textContent = `중앙기금 💰 ${pot}만원`;
  const p = players[current];
  document.getElementById('turnLabel').textContent = phase === 'gameover' ? '게임 종료' :
    (p.isBot ? `🤖 ${p.name}의 턴` + (botThinking ? ' · 생각 중...' : '') : '🧑 내 턴');

  renderActions();
}

let chargeState = null;
function startCharge(meterFill) {
  if (chargeState) return;
  const startTime = performance.now();
  const tick = () => {
    if (!chargeState) return;
    const pct = Math.min(1, (performance.now() - startTime) / CHARGE_MAX_MS);
    meterFill.style.width = (pct * 100) + '%';
    chargeState.raf = requestAnimationFrame(tick);
  };
  chargeState = { startTime, raf: requestAnimationFrame(tick) };
}
function releaseCharge() {
  if (!chargeState) return 0;
  const level = Math.min(1, (performance.now() - chargeState.startTime) / CHARGE_MAX_MS);
  cancelAnimationFrame(chargeState.raf);
  chargeState = null;
  return level;
}

function renderActions() {
  const actionRow = document.getElementById('actionRow');
  const promptBox = document.getElementById('promptBox');
  actionRow.innerHTML = '';
  promptBox.style.display = 'none';

  if (phase === 'gameover') return;
  const p = players[current];

  if (phase === 'awaiting-buy' && !p.isBot) {
    const tile = TILES[p.pos];
    let extra = '';
    if (tile.type === 'compound') extra = ' (통행료가 방문마다 2배로 오릅니다)';
    else if (tile.type === 'trust') extra = ` (한 바퀴마다 +${trustDividend(tile)}만원 배당)`;
    promptBox.style.display = 'block';
    promptBox.textContent = `${tile.name} (${tile.price}만원)을 구매하시겠습니까?${extra}`;
    const buyBtn = document.createElement('button');
    buyBtn.textContent = '구매';
    buyBtn.disabled = p.cash < tile.price;
    buyBtn.onclick = buyCurrent;
    const skipBtn = document.createElement('button');
    skipBtn.className = 'secondary';
    skipBtn.textContent = '패스';
    skipBtn.onclick = skipBuy;
    actionRow.appendChild(buyBtn);
    actionRow.appendChild(skipBtn);
    return;
  }

  if (phase === 'awaiting-build' && !p.isBot) {
    const tile = TILES[p.pos];
    const cost = buildCost(tile);
    const nextTier = TIER_NAMES[tile.stars + 1];
    const nextToll = getToll(Object.assign({}, tile, { stars: tile.stars + 1 }));
    promptBox.style.display = 'block';
    promptBox.textContent = `${tile.name}에 ${nextTier}을(를) 건설하시겠습니까? (${cost}만원 → 통행료 ${nextToll}만원으로 상승)`;
    const buildBtn = document.createElement('button');
    buildBtn.textContent = '건설';
    buildBtn.disabled = p.cash < cost;
    buildBtn.onclick = buildCurrentOnLanding;
    const skipBtn = document.createElement('button');
    skipBtn.className = 'secondary';
    skipBtn.textContent = '보류';
    skipBtn.onclick = skipBuildOnLanding;
    actionRow.appendChild(buildBtn);
    actionRow.appendChild(skipBtn);
    return;
  }

  if (phase === 'awaiting-post-build' && !p.isBot) {
    const tile = TILES[p.pos];
    const cost = buildCost(tile);
    const nextTier = TIER_NAMES[tile.stars + 1];
    const nextToll = getToll(Object.assign({}, tile, { stars: tile.stars + 1 }));
    promptBox.style.display = 'block';
    promptBox.textContent = `🏆 인수 기념! 한 바퀴 기다리지 않고 바로 ${nextTier}을(를) 건설하시겠습니까? (${cost}만원 → 통행료 ${nextToll}만원으로 상승)`;
    const buildBtn = document.createElement('button');
    buildBtn.textContent = '바로 건설';
    buildBtn.disabled = p.cash < cost;
    buildBtn.onclick = buildPostAcquire;
    const skipBtn = document.createElement('button');
    skipBtn.className = 'secondary';
    skipBtn.textContent = '보류';
    skipBtn.onclick = skipPostAcquireBuild;
    actionRow.appendChild(buildBtn);
    actionRow.appendChild(skipBtn);
    return;
  }

  if (phase === 'awaiting-landmark' && !p.isBot) {
    const tile = TILES[p.pos];
    const cost = landmarkCost(tile);
    promptBox.style.display = 'block';
    promptBox.textContent = `${tile.landmarkIcon} ${tile.name}은 ${TIER_NAMES[5]}까지 다 지었고 한 바퀴를 돌았습니다! ${tile.landmarkName}(${cost}만원)을 건설하시겠습니까? (건설하면 이후 인수 불가)`;
    const buildBtn = document.createElement('button');
    buildBtn.textContent = `${tile.landmarkName} 건설`;
    buildBtn.disabled = p.cash < cost;
    buildBtn.onclick = buildLandmarkCurrent;
    const skipBtn = document.createElement('button');
    skipBtn.className = 'secondary';
    skipBtn.textContent = '보류';
    skipBtn.onclick = skipLandmark;
    actionRow.appendChild(buildBtn);
    actionRow.appendChild(skipBtn);
    return;
  }

  if (phase === 'awaiting-toll-choice' && !p.isBot) {
    const tile = TILES[p.pos];
    const owner = players[tile.owner];
    const toll = getToll(tile);
    const premium = acquireCost(tile);
    const acq = toll + premium;
    promptBox.style.display = 'block';
    promptBox.textContent = `${owner.name} 소유 ${tile.name} (${tierName(tile)}) 도착. 통행료 ${toll}만원만 낼까요, 통행료+인수 프리미엄 ${acq}만원(=${toll}+${premium}) 내고 인수할까요?`;
    const tollBtn = document.createElement('button');
    tollBtn.className = 'secondary';
    tollBtn.textContent = `통행료 내기 (${toll})`;
    tollBtn.onclick = payTollCurrent;
    const acqBtn = document.createElement('button');
    acqBtn.textContent = `인수하기 (${acq})`;
    acqBtn.disabled = p.cash < acq;
    acqBtn.onclick = acquireCurrent;
    actionRow.appendChild(tollBtn);
    actionRow.appendChild(acqBtn);
    return;
  }

  if (phase === 'awaiting-asset-sale' && !p.isBot) {
    const need = pendingCharge.amount;
    const short = Math.max(0, need - p.cash);
    promptBox.style.display = 'block';
    promptBox.textContent = `자금 부족! ${need}만원 필요 (보유 ${p.cash}만원, ${short}만원 부족) — 매각할 자산을 직접 고르세요`;
    const owned = TILES.filter(t => t && t.owner === p.idx &&
      (t.type === 'city' || t.type === 'compound' || t.type === 'trust'))
      .sort((a, b) => assetValue(b) - assetValue(a));
    owned.forEach(t => {
      const idx = TILES.indexOf(t);
      const refund = Math.floor(assetValue(t) * 0.5);
      const btn = document.createElement('button');
      btn.className = 'secondary';
      btn.textContent = `${t.name} 매각 (+${refund})`;
      btn.onclick = () => sellAssetForPending(idx);
      actionRow.appendChild(btn);
    });
    return;
  }

  if (phase === 'idle' && !p.isBot && current === 0) {
    if (p.stuck) {
      promptBox.style.display = 'block';
      promptBox.textContent = `🏝️ 무인도에 갇혔습니다! 더블이 나오면 탈출 (실패 ${p.jailTurns}/2턴, 2턴 차면 강제 석방)`;
    }
    const rollBtn = document.createElement('button');
    rollBtn.id = 'rollBtn';
    rollBtn.textContent = p.stuck ? '🎲 탈출 시도 (누르고 있으면 강해짐)' : '🎲 주사위 굴리기 (누르고 있으면 강해짐)';
    const meter = document.createElement('div');
    meter.id = 'chargeMeter';
    const meterFill = document.createElement('div');
    meterFill.id = 'chargeMeterFill';
    meter.appendChild(meterFill);

    let handledByPointer = false;
    const onDown = (e) => {
      e.preventDefault();
      ensureAudio();
      if (rollBtn.setPointerCapture) { try { rollBtn.setPointerCapture(e.pointerId); } catch { /* 포인터 캡처 미지원 브라우저는 무시 */ } }
      startCharge(meterFill);
    };
    const onUp = () => {
      if (!chargeState) return;
      const level = releaseCharge();
      meterFill.style.width = '0%';
      handledByPointer = true;
      rollForCurrent(level);
    };
    // 포인터(마우스/터치)는 pointerup에서 처리. 키보드/접근성 활성화는 pointerdown/up 없이
    // click만 발생하므로, 그 경우엔 차지 없이(레벨 0) 굴리도록 폴백.
    const onClick = () => {
      if (handledByPointer) { handledByPointer = false; return; }
      rollForCurrent(0);
    };
    rollBtn.addEventListener('pointerdown', onDown);
    rollBtn.addEventListener('pointerup', onUp);
    rollBtn.addEventListener('pointercancel', onUp);
    rollBtn.addEventListener('click', onClick);
    actionRow.appendChild(rollBtn);
    actionRow.appendChild(meter);
  }
}

function openRules() { ensureAudio(); SFX.click(); document.getElementById('rulesModal').classList.remove('hidden'); }
function closeRules() { SFX.click(); document.getElementById('rulesModal').classList.add('hidden'); }

function updateBotCountUI() {
  document.querySelectorAll('.botCountBtn').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.count) === botCount);
  });
}
