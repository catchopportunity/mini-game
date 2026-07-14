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
const GOLDENKEY_IDX = [3, 23, 33];
const COMPOUND_IDX = [13];   // 복리 상가: 방문할 때마다 통행료가 배로 뛴다
const TRUST_IDX = [26];      // 투자 신탁: 통행료는 없지만 한 바퀴마다 배당금을 준다
const CASINO_IDX = [6];      // 카지노: 즉석에서 베팅 도박

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

function tilePos(i) {
  let row, col;
  if (i <= 10) { row = 11; col = 11 - i; }
  else if (i <= 20) { row = 11 - (i - 10); col = 1; }
  else if (i <= 30) { row = 1; col = 1 + (i - 20); }
  else { row = 1 + (i - 30); col = 11; }
  return { row, col };
}
