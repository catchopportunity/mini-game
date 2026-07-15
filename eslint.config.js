import js from '@eslint/js';
import globals from 'globals';

// bluemarble.js는 빌드 없이 file://로 여는 브라우저 게임이라 여러 개의 일반 <script> 태그로
// 쪼갰다. 모듈이 아니라서 각 js/*.js 파일의 최상위 선언이 전역 스코프를 공유하는데,
// 그걸 no-undef가 오탐하지 않도록 다른 파일에서 정의하는 전역들을 여기 명시해둔다.
const sharedGlobals = {
  // js/constants.js
  fmt: 'readonly', DELAY: 'readonly', STEP_DELAY: 'readonly', PLAYER_COLORS: 'readonly',
  SALARY: 'readonly', TIER_NAMES: 'readonly', TAX_RATE: 'readonly', TAX_BURN_RATE: 'readonly',
  LAP_POT_SHARE: 'readonly',
  COMPOUND_TOLL_CAP_HITS: 'readonly', TRUST_DIVIDEND_RATE: 'readonly',
  DESPERATION_RATIO_CAP: 'readonly', DESPERATE_GAIN_BOOST: 'readonly',
  CHARGE_MAX_MS: 'readonly', CHARGE_WOBBLE: 'readonly', BOT_THINK_DELAY: 'readonly',
  // js/audio.js
  audioCtx: 'writable', masterGain: 'writable', muted: 'writable', bgmHandle: 'writable',
  ensureAudio: 'readonly', toggleMute: 'readonly', tone: 'readonly', noiseBurst: 'readonly',
  melody: 'readonly', SFX: 'readonly', BGM_NOTES: 'readonly', startBGM: 'readonly',
  // js/board-data.js
  GROUPS: 'readonly', CITY_DEF: 'readonly', TAX_IDX: 'readonly', GOLDENKEY_IDX: 'readonly',
  COMPOUND_IDX: 'readonly', TRUST_IDX: 'readonly', CASINO_IDX: 'readonly', TILES: 'readonly',
  BOARD_COLS: 'readonly', BOARD_ROWS: 'readonly', tilePos: 'readonly',
  // js/economy.js
  groupFullyOwned: 'readonly', tierName: 'readonly', STAR_TOLL_MULT: 'readonly',
  LANDMARK_TOLL_MULT: 'readonly', getToll: 'readonly', buildCost: 'readonly',
  landmarkCost: 'readonly', totalInvested: 'readonly', assetValue: 'readonly',
  acquireCost: 'readonly', acquireTotalCost: 'readonly', compoundToll: 'readonly',
  trustDividend: 'readonly', netWorth: 'readonly', taxAmount: 'readonly',
  // js/fairness.js
  opponentOf: 'readonly', payAmount: 'readonly', isDesperate: 'readonly', gainAmount: 'readonly',
  desperationLevel: 'readonly', tileCashCost: 'readonly', tileFavorability: 'readonly',
  luckyAdjust: 'readonly', diceForSum: 'readonly',
  // js/cards.js
  spend: 'readonly', spendToPot: 'readonly', CARDS: 'readonly', pickCard: 'readonly', cardText: 'readonly',
  // js/bots.js
  thinkDelay: 'readonly', BOT_BUY_BUFFER: 'readonly', BOT_BUILD_BUFFER: 'readonly',
  BOT_LANDMARK_BUFFER: 'readonly', BOT_ACQUIRE_BUFFER: 'readonly',
  botWantsToBuy: 'readonly', botWantsToBuild: 'readonly', botWantsToBuildLandmark: 'readonly',
  botWantsToAcquire: 'readonly', chooseBotCard: 'readonly',
  // js/engine.js
  players: 'writable', pot: 'writable', current: 'writable', phase: 'writable',
  interrupted: 'writable', pendingCharge: 'writable', pendingCardChoice: 'writable',
  botCount: 'writable',
  botThinking: 'writable', gameEpoch: 'writable', schedule: 'readonly', initGame: 'readonly',
  log: 'readonly', ensureFunds: 'readonly', chargePlayer: 'readonly',
  chargePlayerInteractive: 'readonly', sellAssetForPending: 'readonly', bankrupt: 'readonly',
  showOverlay: 'readonly', showEventCard: 'readonly', showKeyCard: 'readonly',
  maybeCelebrateMonopoly: 'readonly', startTurn: 'readonly', proceedNormalStart: 'readonly',
  playCasino: 'readonly', chargedDie: 'readonly', unluckyDie: 'readonly', rollForCurrent: 'readonly',
  movePlayerBy: 'readonly', resolveTile: 'readonly', finishPending: 'readonly',
  effectiveBuildCost: 'readonly', effectiveLandmarkCost: 'readonly',
  resolveCardChoice: 'readonly', applyChosenCard: 'readonly', chooseCard: 'readonly',
  buyCurrent: 'readonly', skipBuy: 'readonly', buildCurrentOnLanding: 'readonly',
  skipBuildOnLanding: 'readonly', buildLandmarkCurrent: 'readonly', skipLandmark: 'readonly',
  payTollCurrent: 'readonly', acquireCurrent: 'readonly', offerPostAcquireBuild: 'readonly',
  buildPostAcquire: 'readonly', skipPostAcquireBuild: 'readonly', switchTurn: 'readonly',
  // js/render.js
  tileEls: 'readonly', createBoard: 'readonly', render: 'readonly', chargeState: 'writable',
  startCharge: 'readonly', releaseCharge: 'readonly', renderActions: 'readonly',
  openRules: 'readonly', closeRules: 'readonly', updateBotCountUI: 'readonly',
  playerCardEl: 'readonly', flyMoney: 'readonly', drawBoardPath: 'readonly',
};

export default [
  js.configs.recommended,
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...sharedGlobals,
      },
    },
    rules: {
      // vars:'local' → 파일 최상위 선언(다른 파일에서 쓰는 공유 전역)은 검사하지 않고,
      // 함수 안의 진짜 지역 변수만 검사한다.
      'no-unused-vars': ['warn', { vars: 'local', args: 'none' }],
      // 위 sharedGlobals와 각 파일의 최상위 선언이 이름이 겹치는 게 이 구조(전역 공유 스크립트)의
      // 의도된 형태라서 꺼둔다 — 실제 파일 내 중복 선언은 여전히 문법 에러로 걸린다.
      'no-redeclare': 'off',
    },
  },
  {
    // Playwright/Node 설정·스크립트 파일
    files: ['playwright.config.js', 'scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  {
    // 테스트는 page.evaluate 콜백 안에서 브라우저 쪽 공유 전역을 그대로 참조한다
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
        ...sharedGlobals,
      },
    },
  },
];
