import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

const root = new URL('../..', import.meta.url).pathname;
const dist = new URL('./dist', import.meta.url).pathname;
const artifacts = new URL('./artifacts/chrome-game-flow', import.meta.url).pathname;
await mkdir(artifacts, { recursive: true });

const server = spawn('python3', ['-m', 'http.server', '8125', '--directory', dist], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe']
});
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || '/snap/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required']
});

try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 820 } });
  const errors = [];
  let mapLoaded;
  const mapLoadedPromise = new Promise(resolve => { mapLoaded = resolve; });

  page.on('pageerror', error => errors.push(`pageerror: ${error.stack || error}`));
  page.on('requestfailed', request => errors.push(`requestfailed: ${request.url()}: ${request.failure()?.errorText}`));
  page.on('console', message => {
    const text = message.text();
    console.log(`[browser:${message.type()}] ${text}`);
    if (/This map \*does not\* provide modern features|Modern types erased/.test(text)) mapLoaded();
    if (/abort\(|exception|failed to asynchronously prepare wasm/i.test(text)) errors.push(text);
  });

  await page.goto('http://127.0.0.1:8125/?game-test=1', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(
    () => document.getElementById('status')?.textContent === 'Starting NBlood…',
    null,
    { timeout: 120000 }
  );
  await page.waitForTimeout(12000);
  await page.locator('#canvas').focus();
  await page.screenshot({ path: `${artifacts}/10-main-menu.png` });

  await page.keyboard.press('Enter', { delay: 200 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${artifacts}/11-episode-menu.png` });

  await page.keyboard.press('Enter', { delay: 200 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${artifacts}/12-difficulty-menu.png` });

  await page.keyboard.press('Enter', { delay: 200 });
  await Promise.race([
    mapLoadedPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Level did not start')), 30000))
  ]);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${artifacts}/13-gameplay.png`, timeout: 30000 });

  if (errors.length) throw new Error(`Browser errors:\n${errors.join('\n')}`);
  console.log(JSON.stringify({
    result: 'entered gameplay',
    screenshots: ['10-main-menu.png', '11-episode-menu.png', '12-difficulty-menu.png', '13-gameplay.png']
  }, null, 2));
} finally {
  server.kill('SIGTERM');
  await Promise.race([
    browser.close(),
    new Promise(resolve => setTimeout(resolve, 5000))
  ]);
}

// An active Emscripten main loop can keep Chromium's transport alive after the
// result is captured. Closing the transport by exiting also terminates Chrome.
process.exit(process.exitCode || 0);
