const fmt = n => n.toLocaleString('ko-KR') + '만원';
const DELAY = 750;
const STEP_DELAY = 140;

const PLAYER_COLORS = ['#60a5fa', '#f472b6', '#34d399', '#fbbf24'];

const SALARY = 500;
const TIER_NAMES = ['빈 땅', '별장', '빌딩', '호텔', '리조트', '마천루'];

const TAX_RATE = 0.1; // 세금 = (현금 + 부동산 가치) * TAX_RATE
const TAX_BURN_RATE = 0.25; // 세금 납부 후, 남은 현금 중 이 비율만큼 추가로 소각 (기존 0.5는 너무 가혹해서 완화)
const LAP_POT_SHARE = 0.2; // 한 바퀴 돌 때 쌓인 세금(중앙기금)의 이 비율을 급여에 얹어줌
const COMPOUND_TOLL_CAP_HITS = 9; // 통행료 배증은 최대 512배까지만
const TRUST_DIVIDEND_RATE = 0.15;

// 절대 현금이 아니라 상대와의 자산 배율 기준으로 판정되는 "은근한 난이도 조정" 관련 상수
const DESPERATION_RATIO_CAP = 5;
const DESPERATE_GAIN_BOOST = 3;

// 주사위 버튼 홀드-차지 관련 상수
const CHARGE_MAX_MS = 1400;
const CHARGE_WOBBLE = 0.12;

// 봇 행동 딜레이(사람처럼 느껴지게 하기 위한 연출용, 봇 수가 늘어도 누가 뭘 했는지 눈으로 따라갈 수 있도록 충분히 김): [min, max] ms
const BOT_THINK_DELAY = [1100, 1900];

// 강제 매각 옥션 — 은행(50%)보다 더 받을 기회. 다른 활성 플레이어들이 자산가치의 60~95% 사이에서
// 무작위로 입찰하고, 은행 제시가보다 높으면 그 플레이어가 낙찰(소유권까지 이전)
const AUCTION_BID_MIN_RATE = 0.6;
const AUCTION_BID_MAX_RATE = 0.95;
const AUCTION_BANK_RATE = 0.5;

// 부채 시스템 — 자산을 다 팔아도 부족하면 파산 대신 대출. 담보(보유 부동산 가치) 한도 내에서만 빌릴 수 있고,
// 부동산이 없어도 최소한의 신용대출(MIN_DEBT_CAP)은 가능. 출발점을 통과할 때마다 미상환 부채에 이자가 붙음.
// "플레이어 보정(순자산 계산)"에서는 부채를 자산에서 빼지 않는다 — 빚을 내서 일부러 가난해 보이게
// 만들어 은근한 난이도 보정을 악용하는 걸 막기 위함.
const DEBT_INTEREST_RATE = 0.15;
const MAX_DEBT_RATIO = 1.0;
const MIN_DEBT_CAP = 100;

// 글로벌 이벤트 — 출발점을 통과할 때마다 이 확률로 새 이벤트 발동 시도(이미 진행 중이면 스킵), N턴간 지속
const GLOBAL_EVENT_TRIGGER_CHANCE = 0.3;
const GLOBAL_EVENT_DURATION_TURNS = 10;
const GLOBAL_EVENTS = [
  { key: 'crisis', icon: '📉', label: '경제 위기', desc: '모든 통행료 반값 · 세율 2배' },
  { key: 'boom', icon: '📈', label: '부동산 붐', desc: '모든 통행료 1.5배' },
  { key: 'audit', icon: '🔍', label: '공정 감사 기간', desc: '숨겨진 보정 시스템 잠시 정지' },
];

// 봇 성격 — 매입/건설 버퍼(safetyBuffer)에 곱해지는 배율로 성향을 구현
const BOT_PERSONALITIES = [
  { key: 'aggressive', label: '공격적', icon: '🔥', bufferMult: 0.6 },
  { key: 'collector', label: '수집가', icon: '🎯', bufferMult: 1.0 },
  { key: 'miser', label: '수전노', icon: '🐢', bufferMult: 1.6 },
];
