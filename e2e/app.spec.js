import { expect, test } from '@playwright/test';
import { anyTitle, useFakeMusic } from './fakeMusic.js';

// Each test runs on both projects in playwright.config.js: a desktop and a phone screen.

let pageErrors;

test.beforeEach(async ({ page }) => {
  pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await useFakeMusic(page);
  await page.goto('/');
});

test.afterEach(() => {
  expect(pageErrors, 'uncaught errors in the page').toEqual([]);
});

const isMobile = (testInfo) => testInfo.project.name === 'mobile';

async function openMood(page, mood = 'Calm & Peaceful') {
  await page.locator('.mood-tile', { hasText: mood }).click();
  await expect(page.getByRole('heading', { name: 'Made for Your Mood' })).toBeVisible();
}

test('welcome screen shows the hero and all six moods without sideways scrolling', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your mood.');
  await expect(page.locator('.mood-tile')).toHaveCount(6);
  await expect(page.getByRole('button', { name: /Find my sound/ })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('picking a mood loads songs from the music service', async ({ page }) => {
  await openMood(page);
  await expect(page.getByText(anyTitle('english')).first()).toBeVisible();
  await expect(page.getByText('The music service is taking a break.')).toHaveCount(0);
});

test('language bar switches the songs and keeps the chosen language in view', async ({ page }) => {
  await openMood(page);
  const bar = page.getByRole('group', { name: 'Song language' });
  await expect(bar.getByRole('button')).toHaveText(['All', 'Hindi', 'English', 'Gujarati', 'Punjabi', 'Instrumental']);

  const instrumental = bar.getByRole('button', { name: 'Instrumental' });
  await instrumental.click();
  await expect(instrumental).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(anyTitle('instrumental')).first()).toBeVisible();

  // The chip must be fully on screen and the sliding pill must sit under it.
  await expect(instrumental).toBeInViewport({ ratio: 1 });
  await expect.poll(async () => {
    const [pill, chip] = await Promise.all([bar.locator('.rb-pills-indicator').boundingBox(), instrumental.boundingBox()]);
    return Math.abs(pill.x - chip.x) < 2 && Math.abs(pill.width - chip.width) < 2;
  }).toBe(true);
});

test('playing a song starts audio and fills the lock-screen controls', async ({ page }) => {
  await openMood(page);
  await page.getByRole('button', { name: 'Play Mood Radio' }).click();
  await expect(page.getByRole('button', { name: 'Pause Flow' })).toBeVisible();

  await expect.poll(() => page.evaluate(() => {
    const audio = document.querySelector('audio');
    return audio && !audio.paused && audio.currentSrc.includes('saavncdn.com');
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => navigator.mediaSession.playbackState)).toBe('playing');
  await expect.poll(() => page.evaluate(() => navigator.mediaSession.metadata?.title)).toContain('Test');
});

test('volume card changes level from the keyboard and mutes', async ({ page }) => {
  await openMood(page);
  await page.getByRole('button', { name: 'Play Mood Radio' }).click();
  await page.locator('.flex-1.min-w-0.cursor-pointer.group').click();

  const card = page.locator('.volume-card');
  await card.scrollIntoViewIfNeeded();
  const readout = card.locator('.volume-readout');
  const before = await readout.textContent();

  const slider = card.getByRole('slider', { name: 'Volume' });
  await slider.focus();
  await page.keyboard.press('Home');
  await expect(readout).toHaveText('Muted');
  await page.keyboard.press('End');
  await expect(readout).toHaveText('100%');
  expect(before).toMatch(/%|Muted/);

  await card.getByRole('button', { name: 'Mute' }).click();
  await expect(readout).toHaveText('Muted');
  await card.getByRole('button', { name: 'Unmute' }).click();
  await expect(readout).toHaveText('100%');
});

test('search finds a song by name', async ({ page }) => {
  await page.getByRole('button', { name: 'Search songs or artists from anywhere' }).click();
  await page.getByPlaceholder('What do you want to hear?').fill('Moonlight');
  await expect(page.getByText('Moonlight 1').first()).toBeVisible();
});

test('search playback stays accessible and song progress can be dragged', async ({ page }, testInfo) => {
  await page.unrouteAll();
  await useFakeMusic(page, { audioSeconds: 30 });
  await page.getByRole('button', { name: 'Search songs or artists from anywhere' }).click();
  const search = page.getByRole('dialog');
  await search.getByPlaceholder('What do you want to hear?').fill('Moonlight');
  await search.getByRole('button', { name: 'Play Moonlight 1 by English Test Artist' }).click();
  await expect.poll(() => page.evaluate(() => document.querySelector('audio').duration)).toBe(30);

  if (isMobile(testInfo)) {
    await expect(search.getByRole('region', { name: 'Now playing in search' })).toHaveCount(0);
    await expect(search.getByRole('group', { name: 'Preview progress for Moonlight 1' })).toHaveCount(0);
    await search.getByRole('button', { name: 'Pause Moonlight 1 by English Test Artist' }).click();
  } else {
    const nowPlaying = search.getByRole('region', { name: 'Now playing in search' });
    const preview = search.getByRole('group', { name: 'Preview progress for Moonlight 1' });
    await expect(nowPlaying).toContainText('Moonlight 1');
    await nowPlaying.getByRole('button', { name: 'Pause current song' }).click();
    await expect.poll(() => page.evaluate(() => document.querySelector('audio').paused)).toBe(true);

    const slider = preview.getByRole('slider', { name: 'Seek song' });
    await expect(slider).toBeEnabled();
    const box = await slider.boundingBox();
    await page.mouse.move(box.x + 7, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => document.querySelector('audio').currentTime)).toBeGreaterThan(12);
    await expect(nowPlaying.getByRole('slider', { name: 'Seek song' })).toHaveValue(await slider.inputValue());
    await expect(search).toBeVisible();
    await search.getByPlaceholder('What do you want to hear?').fill('Another song');
    await expect(nowPlaying).toContainText('Moonlight 1');
    await nowPlaying.getByRole('button', { name: 'Play current song' }).click();
    await expect.poll(() => page.evaluate(() => document.querySelector('audio').paused)).toBe(false);
    await nowPlaying.getByRole('button', { name: 'Pause current song' }).click();
  }

  await search.getByRole('button', { name: 'Close search' }).click();
  if (!isMobile(testInfo)) await page.getByTitle('Play', { exact: true }).click();
  await page.getByRole('button', { name: 'Search songs or artists from anywhere' }).click();
  if (!isMobile(testInfo)) {
    const nowPlaying = search.getByRole('region', { name: 'Now playing in search' });
    await expect(nowPlaying).toContainText('Moonlight 1');
    await nowPlaying.getByRole('button', { name: 'Pause current song' }).click();
  }
  await search.getByRole('button', { name: 'Close search' }).click();
  const miniSlider = page.getByRole('slider', { name: 'Seek song' });
  await expect(miniSlider).toBeEnabled();
  await miniSlider.focus();
  await page.keyboard.press('Home');
  await expect.poll(() => page.evaluate(() => document.querySelector('audio').currentTime)).toBeLessThan(2);
  await page.locator('.flex-1.min-w-0.cursor-pointer.group').click();
  const fullSlider = page.getByRole('slider', { name: 'Seek song' }).last();
  await fullSlider.focus();
  for (let i = 0; i < 5; i += 1) await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => document.querySelector('audio').currentTime)).toBeGreaterThanOrEqual(5);
});

test('pointer-only effects are on for a mouse and off for touch', async ({ page }, testInfo) => {
  const cursor = page.locator('[class*="z-[99999]"]');
  if (isMobile(testInfo)) {
    await expect(cursor).toHaveCount(0);
    await expect(page.locator('.mix-blend-overlay')).toHaveCount(0);
  } else {
    await page.mouse.move(200, 200);
    await expect(cursor).toHaveCount(1);
    const tile = page.locator('.mood-tile').first();
    await tile.hover();
    await expect.poll(() => tile.evaluate((el) => el.closest('.rb-spotlight').parentElement.style.transform)).toContain('rotate');
  }
});

test('reduced motion turns the text animations off', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.rb-gradient').first()).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.rb-shiny').first()).toHaveCSS('animation-name', 'none');
});

// Records Element.animate() calls so we can check which open effect ran and from where.
async function recordAnimations(page) {
  await page.addInitScript(() => {
    window.__animations = [];
    const original = Element.prototype.animate;
    Element.prototype.animate = function animate(keyframes, options) {
      window.__animations.push({ className: String(this.className), first: keyframes?.[0] ?? null });
      return original.call(this, keyframes, options);
    };
  });
  await page.reload();
}

const grew = (page, classPart) => page.evaluate((part) => window.__animations.some(
  (a) => a.className.includes(part) && String(a.first?.clipPath || '').startsWith('inset(')
), classPart);

test('search panel grows out of the search pill and the pill pops back on close', async ({ page }) => {
  await recordAnimations(page);
  const pill = page.getByRole('button', { name: 'Search songs or artists from anywhere' });
  await pill.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect.poll(() => grew(page, 'search-studio')).toBe(true);

  await page.getByRole('button', { name: 'Close search' }).click();
  await expect(pill).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__animations.some((a) => a.className.includes('floating-search') && a.first?.scale))).toBe(true);
});

test('full player grows out of the mini player bar', async ({ page }) => {
  await recordAnimations(page);
  await openMood(page);
  await page.getByRole('button', { name: 'Play Mood Radio' }).click();
  await page.locator('.flex-1.min-w-0.cursor-pointer.group').click();
  await expect(page.getByRole('button', { name: 'Minimize Player' })).toBeVisible();
  await expect.poll(() => grew(page, 'backdrop-blur-2xl overflow-y-auto')).toBe(true);
});

test('open effects fall back to a plain fade for reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await recordAnimations(page);
  await page.getByRole('button', { name: 'Search songs or artists from anywhere' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await grew(page, 'search-studio')).toBe(false);
});
