import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import process from 'node:process';

const root = new URL('../..', import.meta.url).pathname;
const dist = new URL('./dist', import.meta.url).pathname;
const artifacts = new URL('./artifacts', import.meta.url).pathname;
await mkdir(artifacts, { recursive: true });

const server = spawn('python3', ['-m', 'http.server', '8123', '--directory', dist], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe']
});

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || '/snap/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
  const errors = [];
  page.on('pageerror', error => {
    console.error(`[browser:pageerror] ${error.stack || error}`);
    errors.push(String(error));
  });
  page.on('console', message => {
    console.log(`[browser:${message.type()}] ${message.text()}`);
    const benignSdlMessage = /runtime\s+src\||emscripten_set_main_loop_timing/.test(message.text());
    if (message.type() === 'error' && !benignSdlMessage) errors.push(message.text());
  });
  page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));

  await page.goto('http://127.0.0.1:8123/?smoke=1', { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.dataset.wasmReady === 'true', null, { timeout: 30000 });
  const before = await page.evaluate(() => ({ ...Module.wasmSmokeState }));
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `${artifacts}/before-input.png` });

  await page.locator('#canvas').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  await page.waitForFunction(
    previous => Module.wasmSmokeState.inputs >= previous.inputs + 3,
    before,
    { timeout: 5000 }
  );

  const after = await page.evaluate(() => ({ ...Module.wasmSmokeState }));
  await page.waitForTimeout(100);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `${artifacts}/after-input.png` });

  if (after.x !== before.x + 48) throw new Error(`Expected x=${before.x + 48}, got ${after.x}`);
  if (after.color === before.color) throw new Error('Space did not change marker color');
  if (after.frame <= before.frame) throw new Error('Render loop did not advance');
  if (errors.length) throw new Error(`Browser errors:\n${errors.join('\n')}`);

  console.log(JSON.stringify({ before, after, screenshots: ['before-input.png', 'after-input.png'] }, null, 2));
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
