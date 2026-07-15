import { test, expect } from '@playwright/test';

test.describe('보드 초기 렌더링', () => {
  test('40칸 보드와 초기 자금이 표시된다', async ({ page }) => {
    await page.goto('/bluemarble.html');
    await expect(page.locator('.tile')).toHaveCount(40);
    await expect(page.locator('#cash0')).toHaveText('100만원');
    await expect(page.locator('#cash1')).toHaveText('1,000만원');
  });

  test('도시 통행료 배지가 가격의 15% 공식대로 표시된다', async ({ page }) => {
    await page.goto('/bluemarble.html');
    // 방콕: price 60 → tollBase round(60*0.15) = 9
    const bangkokToll = page.locator('.tile', { hasText: '방콕' }).locator('.toll');
    await expect(bangkokToll).toHaveText('💸9');
    // 서울: price 430 → tollBase round(430*0.15) = 65 (최고가 도시)
    const seoulToll = page.locator('.tile', { hasText: '서울' }).locator('.toll');
    await expect(seoulToll).toHaveText('💸65');
  });
});

test.describe('매입 흐름', () => {
  test('빈 도시에 도착하면 매입할 수 있고, 매입 시 정확한 금액이 차감된다', async ({ page }) => {
    await page.goto('/bluemarble.html');
    await page.evaluate(() => {
      current = 0;
      players[0].pos = 2; // 마닐라, 70만원
      phase = 'awaiting-buy';
      window.__pendingResolve = () => {};
      renderActions();
    });

    const buyBtn = page.getByRole('button', { name: '구매' });
    await expect(buyBtn).toBeEnabled();
    await buyBtn.click();

    await expect(page.locator('#cash0')).toHaveText('30만원'); // 100 - 70
    await expect(page.locator('#props0')).toContainText('보유 자산 1개');
  });

  test('매입가보다 현금이 부족하면 구매 버튼이 비활성화된다', async ({ page }) => {
    await page.goto('/bluemarble.html');
    await page.evaluate(() => {
      current = 0;
      players[0].pos = 39; // 서울, 430만원 (플레이어 시작 자금 100만원으로는 못 삼)
      phase = 'awaiting-buy';
      window.__pendingResolve = () => {};
      renderActions();
    });
    await expect(page.getByRole('button', { name: '구매' })).toBeDisabled();
  });
});

test.describe('세금 계산', () => {
  test('세금 칸은 (현금+자산가치)의 10%를 즉시 징수하고, 남은 현금의 25%가 추가로 소각된다', async ({ page }) => {
    await page.goto('/bluemarble.html');
    await page.evaluate(() => {
      current = 0;
      players[0].pos = 16; // 세금 칸
      players[0].cash = 500;
      resolveTile(players[0], false);
    });
    // 1) 세금 500*0.1=50 징수 → 450  2) 남은 450의 25%(113) 소각 → 337
    await expect(page.locator('#cash0')).toHaveText('337만원');
  });
});

test.describe('은근한 난이도 조정', () => {
  test('±1칸 후보가 전부 비용을 내야 하는 칸이면, 실제 금액이 가장 적은 칸으로 유도한다', async ({ page }) => {
    await page.goto('/bluemarble.html');
    const chosenSum = await page.evaluate(() => {
      current = 0;
      players[0].pos = 0;
      players[0].cash = 500;
      // 베이징(idx7,통행료15) · 오사카(idx8,17) · 상하이(idx9,18) 모두 라이벌 소유로 세팅
      [7, 8, 9].forEach(i => { TILES[i].owner = 1; TILES[i].stars = 0; });
      return luckyAdjust(players[0], 8); // 원래 합(8)의 기본 착지는 오사카(17) — 더 싼 베이징(7)으로 유도돼야 함
    });
    expect(chosenSum).toBe(7);
  });
});

test.describe('그룹 독점', () => {
  test('그룹 4개를 모두 소유하면 통행료가 2배가 된다', async ({ page }) => {
    await page.goto('/bluemarble.html');
    const toll = await page.evaluate(() => {
      // 동남아 그룹(0): 방콕(1), 마닐라(2), 하노이(4), 자카르타(5)
      [1, 2, 4, 5].forEach(i => { TILES[i].owner = 0; });
      return getToll(TILES[1]); // 방콕: tollBase 9 * ★0단계(1배) * 독점(2배)
    });
    expect(toll).toBe(18);
  });
});

test.describe('봇 AI', () => {
  test('봇은 여유 자금이 있으면 빈 도시를 자동으로 매입한다', async ({ page }) => {
    await page.goto('/bluemarble.html');
    await page.evaluate(() => {
      current = 1; // 봇
      players[1].pos = 2; // 마닐라, 70만원
      resolveTile(players[1], false);
    });
    // BOT_THINK_DELAY(최대 1900ms) 이후 자동 결정
    await expect(page.locator('#cash1')).toHaveText('930만원', { timeout: 3000 }); // 1000 - 70
  });
});

test.describe('황금열쇠 신규 메커니즘', () => {
  test('통행료 증폭권이 걸린 도시는 통행료가 2배이고, 지불하면 소진된다', async ({ page }) => {
    await page.goto('/bluemarble.html');
    const boosted = await page.evaluate(() => {
      TILES[1].owner = 1; // 방콕을 1호봇 소유로
      TILES[1].tollBoost = true;
      return getToll(TILES[1]); // tollBase 9 * ★0(1배) * 부스트(2배) = 18
    });
    expect(boosted).toBe(18);

    await page.evaluate(() => {
      current = 0;
      players[0].pos = 1;
      players[0].cash = 100;
      phase = 'awaiting-toll-choice';
      window.__pendingResolve = () => {};
      renderActions();
    });
    await page.getByRole('button', { name: /통행료 내기/ }).click();
    await expect(page.locator('#cash0')).toHaveText('82만원'); // 100 - 18
    expect(await page.evaluate(() => TILES[1].tollBoost)).toBe(false);
  });

  test('보험증서는 세금과 그에 딸린 소각까지 완전히 면제한다', async ({ page }) => {
    await page.goto('/bluemarble.html');
    await page.evaluate(() => {
      current = 0;
      players[0].pos = 16; // 세금 칸
      players[0].cash = 500;
      players[0].paymentShield = true;
      resolveTile(players[0], false);
    });
    await expect(page.locator('#cash0')).toHaveText('500만원'); // 세금도, 소각도 없음
    expect(await page.evaluate(() => players[0].paymentShield)).toBe(false);
  });

  test('건설 할인권은 다음 건설비를 50% 할인하고 1회 소진된다', async ({ page }) => {
    await page.goto('/bluemarble.html');
    await page.evaluate(() => {
      current = 0;
      const tile = TILES[1]; // 방콕, price 60 → buildCost round(60*0.6*1) = 36
      tile.owner = 0; tile.stars = 0; tile.stageLap = 0;
      players[0].pos = 1;
      players[0].lapCount = 1;
      players[0].cash = 100;
      players[0].buildDiscount = 0.5;
      phase = 'awaiting-build';
      window.__pendingResolve = () => {};
      renderActions();
    });
    await page.getByRole('button', { name: '건설' }).click();
    await expect(page.locator('#cash0')).toHaveText('82만원'); // 100 - 18(=36의 50%)
    expect(await page.evaluate(() => players[0].buildDiscount)).toBe(null);
  });

  test('"두 장 중 선택" 카드는 서로 다른 카드 두 개를 보여주고, 고른 카드만 적용된다', async ({ page }) => {
    await page.goto('/bluemarble.html');
    await page.evaluate(() => {
      current = 0;
      resolveCardChoice(players[0], false, () => {});
    });
    await expect(page.locator('#promptBox')).toContainText('황금열쇠 두 장');
    const buttons = page.locator('#actionRow button');
    await expect(buttons).toHaveCount(2);
    const [textA, textB] = await Promise.all([buttons.nth(0).textContent(), buttons.nth(1).textContent()]);
    expect(textA).not.toBe(textB);
    await buttons.first().click();
    await expect(page.locator('#log')).toContainText('🔑');
  });
});
