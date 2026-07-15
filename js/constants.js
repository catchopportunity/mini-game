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
