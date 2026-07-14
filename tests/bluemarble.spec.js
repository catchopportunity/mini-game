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
  test('세금 칸은 (현금+자산가치)의 10%를 즉시 징수하고, 남은 현금의 절반이 추가로 소각된다', async ({ page }) => {
    await page.goto('/bluemarble.html');
    await page.evaluate(() => {
      current = 0;
      players[0].pos = 16; // 세금 칸
      players[0].cash = 500;
      resolveTile(players[0], false);
    });
    // 1) 세금 500*0.1=50 징수 → 450 2) 남은 450의 절반(225) 소각 → 225
    await expect(page.locator('#cash0')).toHaveText('225만원');
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
