const fmt = n => n.toLocaleString('ko-KR') + '만원';
const DELAY = 750;
const STEP_DELAY = 140;

// ---------- Audio (synthesized, no external files) ----------
let audioCtx = null;
let masterGain = null;
let muted = false;
let bgmHandle = null;

function ensureAudio() {
  if (audioCtx) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  audioCtx = new AC();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = muted ? 0 : 0.5;
  masterGain.connect(audioCtx.destination);
  startBGM();
}

function toggleMute() {
  ensureAudio();
  muted = !muted;
  if (masterGain) masterGain.gain.setTargetAtTime(muted ? 0 : 0.5, audioCtx.currentTime, 0.05);
  const btn = document.getElementById('muteBtn');
  if (btn) btn.textContent = muted ? '🔇' : '🔊';
}

function tone(freq, dur, opts = {}) {
  if (!audioCtx) return;
  const { type = 'sine', vol = 0.22, delay = 0, sweepTo = null } = opts;
  const t0 = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noiseBurst(dur, opts = {}) {
  if (!audioCtx) return;
  const { vol = 0.2, delay = 0 } = opts;
  const t0 = audioCtx.currentTime + delay;
  const size = Math.max(1, Math.floor(audioCtx.sampleRate * dur));
  const buffer = audioCtx.createBuffer(1, size, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(gain);
  gain.connect(masterGain);
  src.start(t0);
}

// notes: [[freq, dur, gapAfter], ...] played back to back starting now
function melody(notes, opts = {}) {
  let t = 0;
  notes.forEach(([freq, dur, gap = 0.02]) => {
    tone(freq, dur, { ...opts, delay: t });
    t += dur + gap;
  });
  return t;
}

const SFX = {
  click: () => tone(600, 0.045, { type: 'square', vol: 0.1 }),
  dice: () => { noiseBurst(0.12, { vol: 0.12 }); tone(180, 0.06, { type: 'square', vol: 0.08, delay: 0.05 }); },
  doubleDing: () => melody([[1200, 0.05], [1600, 0.08]], { type: 'sine', vol: 0.15 }),
  buy: () => melody([[523, 0.07], [784, 0.13]], { type: 'triangle', vol: 0.22 }),
  build: () => melody([[440, 0.06], [660, 0.06], [880, 0.12]], { type: 'triangle', vol: 0.2 }),
  pay: () => melody([[380, 0.09], [280, 0.16]], { type: 'sawtooth', vol: 0.16 }),
  tax: () => melody([[300, 0.08], [220, 0.1], [180, 0.16]], { type: 'sawtooth', vol: 0.15 }),
  gain: () => melody([[660, 0.06], [880, 0.06], [1108, 0.1]], { type: 'sine', vol: 0.18 }),
  card: () => melody([[880, 0.05], [1108, 0.05], [1318, 0.05], [1568, 0.1]], { type: 'sine', vol: 0.18 }),
  casinoSpin: () => noiseBurst(0.4, { vol: 0.08 }),
  casinoWin: () => melody([[523, 0.07], [659, 0.07], [784, 0.07], [1047, 0.2]], { type: 'square', vol: 0.22 }),
  casinoLose: () => tone(220, 0.32, { type: 'sawtooth', vol: 0.18, sweepTo: 90 }),
  monopoly: () => melody([[523, 0.09], [659, 0.09], [784, 0.09], [1047, 0.09], [1318, 0.22]], { type: 'triangle', vol: 0.24 }),
  landmark: () => melody([[392, 0.1], [523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.1], [1318, 0.28]], { type: 'triangle', vol: 0.26 }),
  warp: () => tone(200, 0.35, { type: 'sine', vol: 0.16, sweepTo: 1400 }),
  jail: () => tone(140, 0.3, { type: 'square', vol: 0.16, sweepTo: 70 }),
  bankrupt: () => melody([[300, 0.18], [220, 0.18], [140, 0.4]], { type: 'sawtooth', vol: 0.22 }),
  win: () => melody([[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.12], [1318, 0.12], [1568, 0.4]], { type: 'triangle', vol: 0.26 }),
};

const BGM_NOTES = [
  [220, 0.42], [261.6, 0.42], [329.6, 0.42], [440, 0.42],
  [392, 0.42], [329.6, 0.42], [261.6, 0.42], [246.9, 0.6],
];
function startBGM() {
  if (bgmHandle) return;
  const loop = () => {
    const dur = melody(BGM_NOTES, { type: 'triangle', vol: 0.05 });
    bgmHandle = setTimeout(loop, dur * 1000 + 400);
  };
  loop();
}

const GROUPS = [
  { id: 0, name: '동남아', color: '#f472b6' },
  { id: 1, name: '동아시아', color: '#fb923c' },
  { id: 2, name: '중동·남아시아', color: '#fbbf24' },
  { id: 3, name: '남유럽', color: '#34d399' },
  { id: 4, name: '중유럽', color: '#22d3ee' },
  { id: 5, name: '서유럽', color: '#60a5fa' },
  { id: 6, name: '최상급', color: '#a78bfa' },
];

// [보드 인덱스, 이름, 가격, 랜드마크 이름, 랜드마크 아이콘]
const CITY_DEF = [
  [1, '방콕', 60, '왓아룬', '🛕'], [2, '마닐라', 70, '인트라무로스', '🏰'],
  [4, '하노이', 80, '호안끼엠 호수', '🏮'], [5, '자카르타', 90, '모나스 타워', '🗼'],
  [7, '베이징', 100, '자금성', '🏯'], [8, '오사카', 110, '오사카성', '🎏'],
  [9, '상하이', 120, '동방명주', '📡'], [11, '도쿄', 130, '도쿄타워', '🗼'],
  [12, '뭄바이', 140, '인도문', '🏛️'], [14, '두바이', 150, '부르즈할리파', '🏙️'],
  [15, '이스탄불', 160, '아야소피아', '🕌'], [17, '카이로', 170, '기자 피라미드', '🔺'],
  [18, '리스본', 180, '벨렝탑', '🗼'], [19, '아테네', 190, '파르테논 신전', '🏛️'],
  [21, '프라하', 200, '카를교', '🌉'], [22, '부다페스트', 210, '국회의사당', '🏰'],
  [24, '로마', 220, '콜로세움', '🏟️'], [25, '마드리드', 230, '프라도 미술관', '🖼️'],
  [27, '베를린', 240, '브란덴부르크문', '🚪'], [28, '암스테르담', 250, '담 광장', '🚲'],
  [29, '파리', 260, '에펠탑', '🗼'], [31, '런던', 280, '런던아이', '🎡'],
  [32, '취리히', 300, '알프스 전망대', '⛰️'], [34, '비엔나', 320, '쇤브룬 궁전', '🏰'],
  [35, '뉴욕', 340, '자유의 여신상', '🗽'], [37, '시드니', 370, '오페라 하우스', '🎭'],
  [38, '싱가포르', 400, '가든스 바이 더 베이', '🌳'], [39, '서울', 430, 'N서울타워', '🗼'],
];

const TAX_IDX = [16, 36];
const TAX_RATE = 0.1; // 세금 = (현금 + 부동산 가치) * TAX_RATE
const LAP_POT_SHARE = 0.2; // 한 바퀴 돌 때 쌓인 세금(중앙기금)의 이 비율을 급여에 얹어줌
const GOLDENKEY_IDX = [3, 23, 33];
const COMPOUND_IDX = [13];   // 복리 상가: 방문할 때마다 통행료가 배로 뛴다
const TRUST_IDX = [26];      // 투자 신탁: 통행료는 없지만 한 바퀴마다 배당금을 준다
const CASINO_IDX = [6];      // 카지노: 즉석에서 베팅 도박
const COMPOUND_TOLL_CAP_HITS = 5; // 통행료 배증은 최대 32배까지만
const TRUST_DIVIDEND_RATE = 0.15;
const SALARY = 500;
const TIER_NAMES = ['빈 땅', '별장', '빌딩', '호텔'];

const TILES = [];
for (let i = 0; i < 40; i++) TILES.push(null);
TILES[0] = { type: 'start', name: '출발', icon: '🚀' };
TILES[10] = { type: 'island', name: '무인도', icon: '🏝️' };
TILES[20] = { type: 'rest', name: '중앙기금', icon: '💰' };
TILES[30] = { type: 'warp', name: '순간이동', icon: '🌀' };
GOLDENKEY_IDX.forEach(i => TILES[i] = { type: 'goldenkey', name: '황금열쇠', icon: '🔑' });
COMPOUND_IDX.forEach(i => TILES[i] = { type: 'compound', name: '복리 상가', icon: '🏪', price: 150, owner: null, hits: 0 });
TRUST_IDX.forEach(i => TILES[i] = { type: 'trust', name: '투자 신탁', icon: '📈', price: 200, owner: null });
CASINO_IDX.forEach(i => TILES[i] = { type: 'casino', name: '카지노', icon: '🎰' });
TAX_IDX.forEach(i => TILES[i] = { type: 'tax', name: '세금', icon: '💸' });
CITY_DEF.forEach(([idx, name, price, landmarkName, landmarkIcon], order) => {
  const groupId = Math.floor(order / 4);
  TILES[idx] = {
    type: 'city', name, price, group: groupId, landmarkName, landmarkIcon,
    tollBase: Math.round(price * 0.15),
    owner: null, stars: 0, landmark: false, stageLap: null,
  };
});

// 돈을 내는 카드는 "내" 순자산에 비례, 돈을 받는 카드는 "상대" 순자산에 비례
function opponentOf(p) { return players[1 - p.idx]; }
function payAmount(p, rate) { return Math.max(1, Math.round(netWorth(p) * rate)); }
function gainAmount(p, rate) { return Math.max(1, Math.round(netWorth(opponentOf(p)) * rate)); }

const CARDS = [
  { text: p => `공항 마일리지 적립! +${gainAmount(p, 0.08)}만원`, fn: p => { p.cash += gainAmount(p, 0.08); } },
  { text: p => `세금 추징 -${payAmount(p, 0.06)}만원`, fn: p => { const amt = payAmount(p, 0.06); spend(p, amt); pot += amt; } },
  { text: p => `길거리 이벤트 당첨! +${gainAmount(p, 0.10)}만원`, fn: p => { p.cash += gainAmount(p, 0.10); } },
  { text: p => `여권 분실로 벌금 -${payAmount(p, 0.04)}만원`, fn: p => { const amt = payAmount(p, 0.04); spend(p, amt); pot += amt; } },
  { text: p => `기부 활동 -${payAmount(p, 0.03)}만원`, fn: p => { const amt = payAmount(p, 0.03); spend(p, amt); pot += amt; } },
  { text: p => `보너스 상금 +${gainAmount(p, 0.12)}만원`, fn: p => { p.cash += gainAmount(p, 0.12); } },
  { text: '밀수 적발! 무인도로 강제 이송', fn: p => { p.pos = 10; p.stuck = true; p.jailTurns = 0; interrupted = true; } },
  { text: '출발점으로 순간이동 (급여 없음)', fn: p => { p.pos = 0; interrupted = true; } },
  { text: '투자 성공! 다음 세금은 면제됩니다.', fn: p => { p.taxExempt = true; } },
  { text: p => `컨설팅비 청구! 상대에게 ${gainAmount(p, 0.08)}만원을 받았습니다.`, fn: p => { chargePlayer(opponentOf(p), gainAmount(p, 0.08), { toPlayer: p }); } },
  { text: p => `선의의 기부자 등장! 상대에게 ${payAmount(p, 0.06)}만원을 지불합니다.`, fn: p => { chargePlayer(p, payAmount(p, 0.06), { toPlayer: opponentOf(p) }); } },
  { text: p => `보물 지도 발견! 지도를 팔아 +${gainAmount(p, 0.09)}만원`, fn: p => { p.cash += gainAmount(p, 0.09); } },
  { text: '황금열쇠 두 장 찬스! 카드를 한 번 더 뽑습니다.', drawAgain: true, fn: () => {} },
  { text: p => `투자 배당 수익! +${gainAmount(p, 0.08)}만원 획득`, fn: p => { p.cash += gainAmount(p, 0.08); } },
  { text: p => `벌금 고지서 도착! -${payAmount(p, 0.05)}만원 납부`, fn: p => { const amt = payAmount(p, 0.05); spend(p, amt); pot += amt; } },
  { text: '무료 리모델링 쿠폰! 보유 도시 중 하나가 무료로 업그레이드됩니다.', fn: p => {
      const candidates = TILES.filter(t => t && t.type === 'city' && t.owner === p.idx && t.stars < 3);
      if (candidates.length) {
        const t = candidates[Math.floor(Math.random() * candidates.length)];
        t.stars++;
        t.stageLap = p.lapCount;
      } else {
        p.cash += gainAmount(p, 0.06);
      }
    } },
];

function cardText(card, p) { return typeof card.text === 'function' ? card.text(p) : card.text; }

function spend(p, amt) { p.cash -= amt; }

function tilePos(i) {
  let row, col;
  if (i <= 10) { row = 11; col = 11 - i; }
  else if (i <= 20) { row = 11 - (i - 10); col = 1; }
  else if (i <= 30) { row = 1; col = 1 + (i - 20); }
  else { row = 1 + (i - 30); col = 11; }
  return { row, col };
}

let players, pot, current, phase, interrupted;
const tileEls = [];

function initGame() {
  TILES.forEach(t => {
    if (t.type === 'city') { t.owner = null; t.stars = 0; t.landmark = false; t.stageLap = null; }
    else if (t.type === 'compound') { t.owner = null; t.hits = 0; }
    else if (t.type === 'trust') { t.owner = null; }
  });
  players = [
    { idx: 0, name: '플레이어', isBot: false, cash: 100, pos: 0, stuck: false, jailTurns: 0, doublesCount: 0, lapCount: 0, taxExempt: false },
    { idx: 1, name: '봇', isBot: true, cash: 1000, pos: 0, stuck: false, jailTurns: 0, doublesCount: 0, lapCount: 0, taxExempt: false },
  ];
  pot = 0;
  phase = 'idle';
  interrupted = false;
  document.getElementById('log').innerHTML = '';
  document.getElementById('overlay').style.display = 'none';
  current = Math.random() < 0.5 ? 0 : 1;
  log('🎮 새 게임 시작! ' + players[current].name + '가 먼저 시작합니다.');
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

function groupFullyOwned(playerIdx, groupId) {
  return TILES.filter(t => t && t.type === 'city' && t.group === groupId)
    .every(t => t.owner === playerIdx);
}

function tierName(tile) {
  if (tile.landmark) return tile.landmarkName;
  return TIER_NAMES[tile.stars];
}

// 통행료 단계: 그룹독점만 2배 / ★1=4배 / ★2=8배 / ★3=16배 / 랜드마크=30배
function getToll(tile) {
  const base = tile.tollBase;
  if (tile.landmark) return Math.round(base * 30);
  if (tile.stars === 1) return Math.round(base * 4);
  if (tile.stars === 2) return Math.round(base * 8);
  if (tile.stars === 3) return Math.round(base * 16);
  if (groupFullyOwned(tile.owner, tile.group)) return base * 2;
  return base;
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
  return Math.round(netWorth(player) * TAX_RATE);
}

function ensureFunds(player, amount) {
  if (player.cash >= amount) return true;
  const owned = TILES.filter(t => t && t.owner === player.idx &&
    (t.type === 'city' || t.type === 'compound' || t.type === 'trust'))
    .sort((a, b) => assetValue(b) - assetValue(a));
  for (const t of owned) {
    if (player.cash >= amount) break;
    const refund = Math.floor(assetValue(t) * 0.5);
    t.owner = null;
    if (t.type === 'city') { t.stars = 0; t.landmark = false; t.stageLap = null; }
    if (t.type === 'compound') t.hits = 0;
    player.cash += refund;
    log(`💵 ${player.name}, ${t.name} 매각 (+${refund}만원)`);
  }
  return player.cash >= amount;
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
  return true;
}

function bankrupt(player) {
  phase = 'gameover';
  const winner = players[1 - player.idx];
  log(`💥 ${player.name} 파산! 승자는 ${winner.name}!`);
  render();
  winner.idx === 0 ? SFX.win() : SFX.bankrupt();
  showOverlay('GAME OVER', `${winner.name} 승리! (${player.name} 파산)`);
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
  setTimeout(() => {
    modal.classList.remove('show');
    modal.classList.add('hide');
    setTimeout(() => {
      modal.classList.remove('hide');
      cb();
    }, 320);
  }, 1650);
}

function showKeyCard(who, text, cb) {
  showEventCard('🔑', 'GOLDEN KEY', who, text, cb);
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
    setTimeout(rollForCurrent, DELAY);
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
    case 'tax': return -2 - taxAmount(player) * 0.01;
    case 'goldenkey': return -0.5;
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

// 절대 현금이 아니라 상대와의 자산 배율 기준: 서로 자산이 비슷하면 0,
// 상대 자산이 내 자산의 5배에 가까워질수록(그 이상은 상한) 1에 수렴
const DESPERATION_RATIO_CAP = 5;
function desperationLevel(player) {
  const opponent = players[1 - player.idx];
  const myWorth = Math.max(1, netWorth(player));
  const oppWorth = netWorth(opponent);
  const ratio = oppWorth / myWorth;
  if (ratio <= 1) return 0;
  const raw = Math.min(1, (ratio - 1) / (DESPERATION_RATIO_CAP - 1));
  return raw ** 3;
}

// rawSum 기준 ±1칸 중 플레이어에게 가장 유리한 합을 몰래 골라준다
function luckyAdjust(player, rawSum) {
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

function rollForCurrent() {
  if (phase !== 'idle') return;
  phase = 'rolling';
  const p = players[current];
  let d1 = 1 + Math.floor(Math.random() * 6);
  let d2 = 1 + Math.floor(Math.random() * 6);

  if (p.stuck) {
    document.getElementById('diceDisplay').textContent = `🎲 ${d1} + ${d2} = ${d1 + d2}`;
    SFX.dice();
    if (d1 === d2) {
      p.stuck = false; p.jailTurns = 0;
      log(`🎲 ${p.name}: ${d1} + ${d2} = ${d1 + d2} (더블!) 🏝️ 무인도 탈출!`);
      setTimeout(SFX.doubleDing, 150);
      // 탈출 굴림으로 이동은 하지만, 더블이어도 추가 굴림 보너스는 없음
      movePlayerBy(p, d1 + d2, () => resolveTile(p, false));
    } else {
      p.jailTurns++;
      log(`🎲 ${p.name}: ${d1} + ${d2} = ${d1 + d2}. 탈출 실패... (대기 ${p.jailTurns}/2턴)`);
      SFX.jail();
      render();
      setTimeout(switchTurn, DELAY);
    }
    return;
  }

  if (!p.isBot) {
    const desperation = desperationLevel(p);
    if (desperation > 0 && Math.random() < desperation) {
      const adjustedSum = luckyAdjust(p, d1 + d2);
      if (adjustedSum !== d1 + d2) [d1, d2] = diceForSum(adjustedSum);
    }
  }
  document.getElementById('diceDisplay').textContent = `🎲 ${d1} + ${d2} = ${d1 + d2}`;
  log(`🎲 ${p.name}: ${d1} + ${d2} = ${d1 + d2}` + (d1 === d2 ? ' (더블!)' : ''));
  SFX.dice();
  if (d1 === d2) setTimeout(SFX.doubleDing, 150);
  renderActions();

  if (d1 === d2) p.doublesCount++; else p.doublesCount = 0;

  if (p.doublesCount >= 3) {
    p.pos = 10; p.stuck = true; p.jailTurns = 0; p.doublesCount = 0;
    log(`🚨 연속 더블 3회! ${p.name} 무인도로 강제 이송!`);
    SFX.jail();
    render();
    setTimeout(switchTurn, DELAY);
    return;
  }

  movePlayerBy(p, d1 + d2, () => resolveTile(p, d1 === d2));
}

function movePlayerBy(player, steps, cb) {
  let remaining = steps;
  const hop = () => {
    if (remaining <= 0) {
      setTimeout(cb, DELAY);
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
      if (bonus > 0) { pot -= bonus; player.cash += bonus; }
      if (dividend > 0) player.cash += dividend;
      let msg = `🚀 ${player.name}, 출발점 통과! 급여 +${SALARY}만원`;
      if (bonus > 0) msg += ` + 세금 환급 +${bonus}만원`;
      if (dividend > 0) msg += ` + 투자 배당 +${dividend}만원`;
      log(msg);
      SFX.gain();
    }
    render();
    setTimeout(hop, STEP_DELAY);
  };
  hop();
}

function resolveTile(player, wasDouble) {
  if (phase === 'gameover') return;
  const tile = TILES[player.pos];
  interrupted = false;

  const afterResolve = () => {
    if (phase === 'gameover') return;
    if (wasDouble && !interrupted && !player.stuck) {
      log(`✨ 더블! ${player.name} 한 번 더 굴립니다.`);
      phase = 'idle';
      render();
      if (player.isBot) setTimeout(rollForCurrent, DELAY);
      else renderActions();
    } else {
      setTimeout(switchTurn, DELAY);
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
      setTimeout(switchTurn, DELAY);
      break;
    case 'rest': {
      const gained = pot;
      player.cash += gained;
      pot = 0;
      log(`💰 ${player.name}, 중앙기금 ${gained}만원 획득!`);
      SFX.gain();
      render();
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
      setTimeout(() => resolveTile(player, wasDouble), DELAY);
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
      log(`💸 ${player.name}, 재산세 ${amt}만원 납부. (자산 ${netWorth(player)}만원의 ${Math.round(TAX_RATE * 100)}%)`);
      SFX.tax();
      chargePlayer(player, amt, { toPot: true });
      afterResolve();
      break;
    }
    case 'goldenkey': {
      const card = CARDS[Math.floor(Math.random() * CARDS.length)];
      SFX.card();
      const drawnText = cardText(card, player);
      showKeyCard(player.name, drawnText, () => {
        log(`🔑 ${player.name}: ${drawnText}`);
        card.fn(player);
        render();
        if (card.drawAgain) {
          const others = CARDS.filter(c => !c.drawAgain);
          const card2 = others[Math.floor(Math.random() * others.length)];
          SFX.card();
          const drawnText2 = cardText(card2, player);
          showKeyCard(player.name, drawnText2, () => {
            log(`🔑 ${player.name}: ${drawnText2}`);
            card2.fn(player);
            render();
            afterResolve();
          });
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
          const buffer = 250;
          if (player.cash - tile.price >= buffer) {
            player.cash -= tile.price;
            tile.owner = player.idx; tile.hits = 0;
            log(`🏪 봇이 ${tile.name} 매입! (-${tile.price}만원)`);
            SFX.buy();
          } else {
            log(`🏪 봇이 ${tile.name} 매입을 포기했습니다.`);
          }
          render();
          afterResolve();
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
        chargePlayer(player, toll, { toPlayer: owner });
        tile.hits++;
        render();
        afterResolve();
      }
      break;
    case 'trust':
      if (tile.owner === null) {
        if (player.isBot) {
          const buffer = 250;
          if (player.cash - tile.price >= buffer) {
            player.cash -= tile.price;
            tile.owner = player.idx;
            log(`📈 봇이 ${tile.name} 매입! (-${tile.price}만원, 한 바퀴마다 +${trustDividend(tile)}만원 배당)`);
            SFX.buy();
          } else {
            log(`📈 봇이 ${tile.name} 매입을 포기했습니다.`);
          }
          render();
          afterResolve();
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
          const buffer = 250;
          if (player.cash - tile.price >= buffer) {
            player.cash -= tile.price;
            tile.owner = player.idx; tile.stars = 0; tile.stageLap = player.lapCount;
            log(`🏙️ 봇이 ${tile.name} 매입! (-${tile.price}만원)`);
            SFX.buy();
            maybeCelebrateMonopoly(player, tile, () => { render(); afterResolve(); });
          } else {
            log(`🏙️ 봇이 ${tile.name} 매입을 포기했습니다.`);
            render();
            afterResolve();
          }
        } else {
          phase = 'awaiting-buy';
          renderActions();
          window.__pendingResolve = afterResolve;
        }
      } else if (tile.owner === player.idx) {
        // 색깔 그룹 독점 여부와 무관하게, 마지막 건설 이후 한 바퀴를 돌고 다시 착지하면 다음 단계 건설 가능
        const lapCleared = player.lapCount > tile.stageLap;
        const canBuildNext = tile.stars < 3 && lapCleared;
        const landmarkEligible = tile.stars === 3 && !tile.landmark && lapCleared;
        if (canBuildNext) {
          const cost = buildCost(tile);
          if (player.isBot) {
            const buffer = 250;
            if (player.cash - cost >= buffer) {
              player.cash -= cost;
              tile.stars++;
              tile.stageLap = player.lapCount;
              log(`🏗️ 봇이 ${tile.name}에 건설! (${tierName(tile)}, -${cost}만원, 통행료 ${getToll(tile)}만원)`);
              SFX.build();
            } else {
              log(`${player.name}, 본인 소유의 ${tile.name} 도착. (건설 자금 부족)`);
            }
            render();
            afterResolve();
          } else {
            phase = 'awaiting-build';
            renderActions();
            window.__pendingResolve = afterResolve;
          }
        } else if (landmarkEligible) {
          const cost = landmarkCost(tile);
          if (player.isBot) {
            const buffer = 300;
            if (player.cash - cost >= buffer) {
              player.cash -= cost;
              tile.landmark = true;
              tile.stageLap = player.lapCount;
              log(`👑 봇이 ${tile.name}에 ${tile.landmarkName}${tile.landmarkIcon}을(를) 건설했습니다! (-${cost}만원, 이제 인수 불가)`);
              SFX.landmark();
            } else {
              log(`${player.name}, 본인 소유의 ${tile.name} 도착. (랜드마크 자금 부족)`);
            }
            render();
            afterResolve();
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
          chargePlayer(player, toll, { toPlayer: owner });
          afterResolve();
        } else if (player.isBot) {
          const buffer = 300;
          const acq = acquireCost(tile);
          if (tile.stars > 0 && player.cash - acq >= buffer) {
            chargePlayer(player, acq, { toPlayer: owner });
            tile.owner = player.idx;
            tile.stageLap = player.lapCount;
            log(`🏆 봇이 ${owner.name} 소유 ${tile.name}을(를) 인수했습니다! (-${acq}만원)`);
            SFX.buy();
            maybeCelebrateMonopoly(player, tile, afterResolve);
          } else {
            log(`🏙️ ${player.name}, ${owner.name} 소유 ${tile.name} 도착. 통행료 ${toll}만원 지불.`);
            SFX.pay();
            chargePlayer(player, toll, { toPlayer: owner });
            afterResolve();
          }
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
  const cost = buildCost(tile);
  if (p.cash < cost) return;
  p.cash -= cost;
  tile.stars++;
  tile.stageLap = p.lapCount;
  log(`🏗️ ${p.name}, ${tile.name}에 건설! (${tierName(tile)}, -${cost}만원, 통행료 ${getToll(tile)}만원)`);
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
  const cost = landmarkCost(tile);
  if (p.cash < cost) return;
  p.cash -= cost;
  tile.landmark = true;
  log(`👑 ${p.name}, ${tile.name}에 ${tile.landmarkName} ${tile.landmarkIcon}을(를) 건설했습니다! (-${cost}만원, 이제 인수 불가)`);
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
  chargePlayer(p, toll, { toPlayer: owner });
  phase = 'resolving';
  finishPending();
}

function acquireCurrent() {
  ensureAudio();
  const p = players[current];
  const tile = TILES[p.pos];
  const owner = players[tile.owner];
  const cost = acquireCost(tile);
  if (p.cash < cost) return;
  chargePlayer(p, cost, { toPlayer: owner });
  tile.owner = p.idx;
  tile.stageLap = p.lapCount;
  log(`🏆 ${p.name}, ${owner.name} 소유 ${tile.name}을(를) 인수했습니다! (-${cost}만원)`);
  SFX.buy();
  phase = 'resolving';
  maybeCelebrateMonopoly(p, tile, finishPending);
}

function switchTurn() {
  if (phase === 'gameover') return;
  current = 1 - current;
  startTurn(current);
}

// ---------- Rendering ----------
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

function render() {
  players.forEach((p, i) => {
    document.getElementById('cash' + i).textContent = fmt(p.cash);
    const owned = TILES.filter(t => t && t.owner === i &&
      (t.type === 'city' || t.type === 'compound' || t.type === 'trust'));
    const totalValue = owned.reduce((sum, t) => sum + assetValue(t), 0);
    document.getElementById('props' + i).textContent = `보유 자산 ${owned.length}개 (${fmt(totalValue)})` + (p.stuck ? ` · 🏝️무인도(${p.jailTurns}/2)` : '');
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
        strip.style.background = tile.owner === 0 ? '#60a5fa' : '#f472b6';
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
        strip.style.background = tile.owner === 0 ? '#60a5fa' : '#f472b6';
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
        if (p.pos === i) {
          const s = document.createElement('div');
          s.className = 'tok p' + pi;
          s.textContent = pi === 0 ? 'P' : 'B';
          tok.appendChild(s);
        }
      });
    }
  });

  document.getElementById('pot').textContent = `중앙기금 💰 ${pot}만원`;
  const p = players[current];
  document.getElementById('turnLabel').textContent = phase === 'gameover' ? '게임 종료' :
    (p.isBot ? '🤖 봇의 턴' : '🧑 내 턴');

  renderActions();
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

  if (phase === 'awaiting-landmark' && !p.isBot) {
    const tile = TILES[p.pos];
    const cost = landmarkCost(tile);
    promptBox.style.display = 'block';
    promptBox.textContent = `${tile.landmarkIcon} ${tile.name}은 호텔을 다 지었고 한 바퀴를 돌았습니다! ${tile.landmarkName}(${cost}만원)을 건설하시겠습니까? (건설하면 이후 인수 불가)`;
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
    const acq = acquireCost(tile);
    promptBox.style.display = 'block';
    promptBox.textContent = `${owner.name} 소유 ${tile.name} (${tierName(tile)}) 도착. 통행료 ${toll}만원을 낼까요, ${acq}만원 내고 인수할까요?`;
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

  if (phase === 'idle' && !p.isBot && current === 0) {
    if (p.stuck) {
      promptBox.style.display = 'block';
      promptBox.textContent = `🏝️ 무인도에 갇혔습니다! 더블이 나오면 탈출 (실패 ${p.jailTurns}/2턴, 2턴 차면 강제 석방)`;
    }
    const rollBtn = document.createElement('button');
    rollBtn.textContent = p.stuck ? '🎲 탈출 시도' : '🎲 주사위 굴리기';
    rollBtn.onclick = () => { ensureAudio(); rollForCurrent(); };
    actionRow.appendChild(rollBtn);
  }
}

function openRules() { ensureAudio(); SFX.click(); document.getElementById('rulesModal').classList.remove('hidden'); }
function closeRules() { SFX.click(); document.getElementById('rulesModal').classList.add('hidden'); }

createBoard();
document.getElementById('restartBtn').onclick = () => { ensureAudio(); SFX.click(); initGame(); };
document.getElementById('rulesBtn').onclick = openRules;
document.getElementById('rulesCloseBtn').onclick = closeRules;
document.getElementById('muteBtn').onclick = toggleMute;
initGame();
