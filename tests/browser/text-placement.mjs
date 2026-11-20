// Isolated acceptance checks for text insertion, movement and complete context menus.
// WEBSTUDIO_NATIVE_EXE may select one final bin/Win32 or bin/Win64 executable.
// The suite never opens user projects, uses the system clipboard, or changes a dictionary.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createServer as createPortServer } from 'node:net';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const { chromium } = createRequire(import.meta.url)(process.env.WEBSTUDIO_PLAYWRIGHT || 'playwright');
const root = process.cwd();
const nativeExe = process.env.WEBSTUDIO_NATIVE_EXE && path.resolve(process.env.WEBSTUDIO_NATIVE_EXE);
const label = process.env.WEBSTUDIO_TEST_LABEL || (nativeExe ? path.basename(path.dirname(nativeExe)) : 'browser');
assert.match(label, /^[A-Za-z0-9-]+$/);
const output = path.resolve('test-results/text-placement', label);
const profile = path.join(output, 'isolated-profile');
await mkdir(output, { recursive: true });
const checks = [];
const errors = [];
const report = { label, scope: nativeExe ? 'Actual desktop executable with isolated synthetic profile' : 'Isolated Vite browser', checks, errors, passed: false };
function check(value, message) { assert(value, message); checks.push(message); if (process.env.WEBSTUDIO_VERBOSE === '1') console.log('PASS:', message); }
const panels = [
  { id: 'left-panel', type: 'panel', text: 'Left panel', x: 8, y: 140, width: 32, height: 180, layer: 1, color: '#e7efe8' },
  { id: 'right-panel', type: 'panel', text: 'Right panel', x: 55, y: 140, width: 32, height: 180, layer: 1, color: '#e7edf5' },
];
const fixtureBlocks = [
  { id: 'placement-header', type: 'hero', variant: 'minimal', props: { headline: 'Text placement example', subheadline: 'Place a text box where you choose', layoutHeight: 180, blockBackgroundColor: '#243246' } },
  { id: 'placement-area', type: 'content', variant: 'wide-prose', props: { body: 'Choose Add text, then click a section or panel.', layoutHeight: 720, blockBackgroundColor: '#fbf8ef', textColor: '#17334b', section1Objects: panels } },
  { id: 'two-sections', type: 'content', variant: 'wide-prose', props: { body: 'First section', layoutHeight: 360, sectionCount: 2, section2Text: 'Second section', blockBackgroundColor: '#ffffff', section2Objects: [] } },
  { id: 'placement-footer', type: 'footer', variant: 'multi-column', props: { brand: 'Example Community', tagline: 'Synthetic test website', copyright: '2026 Example Community', columns: [] } },
];
function project(config, suffix = '') { return { format: 'webstudio', schemaVersion: 2, projectId: `text-placement-test${suffix}`, config, assets: [] }; }
const initial = { name: 'Text placement acceptance', blocks: fixtureBlocks, pages: [{ id: 'home', name: 'Home', path: '/', blocks: fixtureBlocks }] };
let vite, browser, page, child;
try {
  let target;
  if (nativeExe) {
    check(['Win32', 'Win64'].some(platform => nativeExe === path.join(root, 'bin', platform, 'DelphiWebStudioPro.exe')), 'Native target is an approved project build');
    await mkdir(profile, { recursive: true });
    const portServer = createPortServer();
    await new Promise(resolve => portServer.listen(0, '127.0.0.1', resolve));
    const port = portServer.address().port;
    await new Promise(resolve => portServer.close(resolve));
    target = `http://127.0.0.1:${port}`;
    child = spawn(nativeExe, [], { cwd: path.dirname(nativeExe), windowsHide: true, stdio: 'ignore', env: { ...process.env, LOCALAPPDATA: profile, WEBVIEW2_USER_DATA_FOLDER: path.join(profile, 'WebView'), WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port} --remote-allow-origins=http://127.0.0.1:${port}` } });
    child.on('error', error => errors.push(error.message));
    const deadline = Date.now() + 45000;
    let ready = false;
    while (Date.now() < deadline) {
      try { ready = (await fetch(`${target}/json/version`)).ok; if (ready) break; } catch { /* Runtime startup */ }
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    check(ready, 'Isolated native WebView2 debugging endpoint started');
    browser = await chromium.connectOverCDP(target);
    const context = browser.contexts()[0];
    page = context.pages()[0] || await context.waitForEvent('page');
    await page.waitForURL('https://webstudio.local/**');
    await page.setViewportSize({ width: 1540, height: 1000 });
    report.executable = path.relative(root, nativeExe).replaceAll('\\', '/');
    report.executableSha256 = createHash('sha256').update(await readFile(nativeExe)).digest('hex');
    target = 'https://webstudio.local/index.html#/editor';
  } else {
    vite = await createServer({ server: { host: '127.0.0.1', port: 0, watch: { ignored: ['**/bin/**', '**/dcu/**', '**/docs/**', '**/export/**', '**/Projects/**', '**/Website Test/**', '**/test-results/**', '**/*.tmp'] } }, appType: 'spa', ssr: { noExternal: ['pdfjs-dist'] } });
    await vite.listen();
    browser = await chromium.launch({ executablePath: process.env.WEBSTUDIO_EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    page = await browser.newPage({ viewport: { width: 1540, height: 1000 }, deviceScaleFactor: 1 });
    target = vite.resolvedUrls.local[0] + 'editor';
  }
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(target);
  if (nativeExe) {
    const script = await page.locator('script[type="module"][src]').first().getAttribute('src');
    const scriptUrl = new URL(script, page.url());
    const bundle = path.basename(scriptUrl.pathname);
    assert.match(bundle, /^index-[A-Za-z0-9_-]+\.js$/);
    report.editorBundle = bundle;
    report.editorBundleSha256 = await page.evaluate(async url => {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw Error('Unable to fingerprint the loaded editor bundle');
      const digest = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
      return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
    }, scriptUrl.href);
    const stagedHash = createHash('sha256').update(await readFile(path.join(path.dirname(nativeExe), 'editor', 'assets', bundle))).digest('hex');
    check(report.editorBundleSha256 === stagedHash, 'Loaded native editor bundle matches the exact staged JavaScript bytes');
  }
  await page.evaluate(() => {
    const projects = JSON.parse(localStorage.getItem('openpage-projects') || '{"state":{"projects":[]}}').state.projects;
    if (projects.some(value => !value.id.startsWith('text-placement-test'))) throw Error('Refusing to run in a profile containing non-test projects.');
  });
  const starter = page.getByRole('button', { name: /^Church/ });
  if (await starter.count()) await starter.click();
  const importProject = async (value, name) => page.locator('[aria-label="Choose project file"]').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
  await importProject(project(initial), 'text-placement.webstudio.json');
  const block = page.locator('[data-webstudio-block-id="placement-area"]');
  await block.waitFor();
  const expandSidebar = page.getByRole('button', { name: 'Expand left panel', exact: true });
  if (await expandSidebar.count()) await expandSidebar.click();
  const readBlocks = () => page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('openpage-config')).state;
    return stored.config.pages?.find(value => value.id === stored.activePageId)?.blocks || stored.config.blocks;
  });
  const readItems = async (blockId = 'placement-area', section = 1) => (await readBlocks()).find(value => value.id === blockId).props[`section${section}Objects`] || [];
  const textItems = async (blockId = 'placement-area', section = 1) => (await readItems(blockId, section)).filter(value => value.type === 'text');
  const canvas = page.getByRole('region', { name: /^Site preview,/ });
  const area = block.locator('[data-section-object-area="1"]');
  async function footerLast() { check((await readBlocks()).at(-1).id === 'placement-footer', 'No insertion appends a block after the footer'); }
  async function fits(locator) {
    const bounds = await locator.boundingBox();
    const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    check(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1, 'Entire context menu fits the viewport');
  }
  async function clickPoint(locator, xFraction, y) {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    const point = { x: box.x + box.width * xFraction, y: box.y + y };
    point.relative = await locator.evaluate((element, point) => {
      const section = element.closest('[data-editor-section]') || element.querySelector('[data-editor-section]');
      const area = section?.querySelector('[data-section-object-area]');
      const bounds = area.getBoundingClientRect();
      return { x: (point.x - bounds.left) / bounds.width * 100, y: point.y - bounds.top };
    }, point);
    await page.mouse.click(point.x, point.y);
    return point;
  }
  async function assertPlacement(id, point, message) {
    const position = await page.locator(`[data-section-object="${id}"]`).evaluate(element => ({ x: Number.parseFloat(element.style.left), y: Number.parseFloat(element.style.top) }));
    check(Math.abs(position.x - point.relative.x) < .2 && Math.abs(position.y - point.relative.y) < 3, `${message} (expected ${JSON.stringify(point.relative)}, received ${JSON.stringify(position)})`);
  }
  async function move(id, x, y) {
    const handle = page.locator(`[data-section-object="${id}"] [data-text-move-handle]`);
    await handle.waitFor({ state: 'visible' });
    const box = await handle.boundingBox();
    check(box.height >= 18, 'Text move control is visibly sized rather than a hidden thin strip');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(x, y, { steps: 12 });
    await page.mouse.up();
  }

  // Context command must arm placement, never insert at an old or missing right-click coordinate.
  await block.scrollIntoViewIfNeeded();
  const shell = await block.boundingBox();
  await page.mouse.click(shell.x + shell.width * .80, shell.y + Math.min(shell.height - 25, 430), { button: 'right' });
  await page.getByRole('menu', { name: 'content block actions', exact: true }).getByRole('menuitem', { name: 'Add text', exact: true }).click();
  check((await textItems()).length === 0, 'Context Add text waits for the next placement click');
  const firstPoint = await clickPoint(area, .12, 46);
  await page.waitForFunction(() => document.querySelectorAll('[data-section-object][data-ws-object-type="text"]').length === 1);
  let first = (await textItems())[0];
  await assertPlacement(first.id, firstPoint, 'Context insertion lands at the chosen click, including after scrolling');
  await footerLast();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  check((await textItems()).length === 0, 'Undo removes one complete text insertion');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  check((await textItems())[0].id === first.id, 'Redo restores the same text object');

  // Both entry points share the same one-shot placement behavior, including a real panel click.
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  check((await textItems()).length === 1, 'Sidebar Add text also waits for the next placement click');
  const panel = page.locator('[data-section-object="left-panel"]');
  const secondPoint = await clickPoint(panel, .20, 110);
  await page.waitForFunction(() => document.querySelectorAll('[data-section-object][data-ws-object-type="text"]').length === 2);
  let second = (await textItems()).find(value => value.id !== first.id);
  check(second.parentId === 'left-panel', 'Text placed on a panel belongs to that panel');
  await assertPlacement(second.id, secondPoint, 'Sidebar insertion lands on the chosen panel point');
  await footerLast();

  // Real typing must not make the selected box immovable.
  const secondObject = page.locator(`[data-section-object="${second.id}"]`);
  const text = secondObject.locator('[data-rich-editor]');
  await text.fill('A useful description for this panel.');
  const before = { ...second };
  const handle = await secondObject.locator('[data-text-move-handle]').boundingBox();
  await move(second.id, handle.x + handle.width / 2 + 72, handle.y + handle.height / 2 + 44);
  second = (await textItems()).find(value => value.id === second.id);
  check(second.x > before.x && second.y > before.y, 'Text moves immediately after typing through its visible move control');
  check((await secondObject.textContent()).includes('A useful description'), 'Dragging preserves typed wording');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  const undone = (await textItems()).find(value => value.id === second.id);
  check(Math.abs(undone.x - before.x) < .01 && Math.abs(undone.y - before.y) < .01, 'One Undo restores the complete move');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  const redone = (await textItems()).find(value => value.id === second.id);
  check(Math.abs(redone.x - second.x) < .01 && Math.abs(redone.y - second.y) < .01, 'Redo restores the complete move');

  // A click in exposed block-height space must remain in that block, never fall below the footer.
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  const outerPoint = await clickPoint(block, .48, 560);
  await page.waitForFunction(() => document.querySelectorAll('[data-section-object][data-ws-object-type="text"]').length === 3);
  const third = (await textItems()).find(value => value.id !== first.id && value.id !== second.id);
  await assertPlacement(third.id, outerPoint, 'Text placed in visible block-height space uses that exact location');
  await footerLast();

  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await page.keyboard.press('Escape');
  const cancelCount = (await textItems()).length;
  await clickPoint(block, .75, 490);
  check((await textItems()).length === cancelCount, 'Escape cancels placement without adding text');

  // Cross-panel movement uses the destination panel instead of retaining a stale parent.
  await secondObject.click();
  const right = await page.locator('[data-section-object="right-panel"]').boundingBox();
  await move(second.id, right.x + 50, right.y + 95);
  second = (await textItems()).find(value => value.id === second.id);
  check(second.parentId === 'right-panel', 'Dragging between panels updates the text destination');

  // Invalid panel drops must restore both the parent and its children's rendered positions.
  const rightPanel = page.locator('[data-section-object="right-panel"]');
  const rightBounds = await rightPanel.boundingBox();
  await page.mouse.click(rightBounds.x + 6, rightBounds.y + rightBounds.height - 6);
  const beforeInvalidPanel = JSON.stringify(await readBlocks());
  const beforeChildStyle = await secondObject.evaluate(element => ({ left: element.style.left, top: element.style.top }));
  await move('right-panel', 12, 600);
  check(JSON.stringify(await readBlocks()) === beforeInvalidPanel, 'Dropping a panel outside the page leaves its model and children unchanged');
  check(JSON.stringify(await secondObject.evaluate(element => ({ left: element.style.left, top: element.style.top }))) === JSON.stringify(beforeChildStyle), 'Invalid panel drop restores the child preview position');

  // Moving to another section retains the object identity and is a single undoable operation.
  const twoSections = page.locator('[data-webstudio-block-id="two-sections"]');
  await twoSections.scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  const firstSection = twoSections.locator('[data-editor-section="1"]');
  const firstSectionBounds = await firstSection.boundingBox();
  await clickPoint(firstSection, .12, firstSectionBounds.height + 25);
  check((await readBlocks()).length === fixtureBlocks.length && (await textItems('two-sections', 1)).length === 0 && (await textItems('two-sections', 2)).length === 0, 'An ambiguous multi-section destination creates nothing and leaves the page structure intact');
  await clickPoint(firstSection, .12, 48);
  await page.waitForFunction(() => document.querySelectorAll('[data-section-object][data-ws-object-type="text"]').length === 4);
  const crossing = (await textItems('two-sections', 1))[0];
  const destination = await twoSections.locator('[data-editor-section="2"]').boundingBox();
  await move(crossing.id, destination.x + destination.width * .35, destination.y + 55);
  check((await textItems('two-sections', 1)).length === 0 && (await textItems('two-sections', 2))[0]?.id === crossing.id, 'Text moves between sections with its identity preserved');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  check((await textItems('two-sections', 1))[0]?.id === crossing.id && (await textItems('two-sections', 2)).length === 0, 'One Undo restores a cross-section move');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  check((await textItems('two-sections', 2))[0]?.id === crossing.id, 'Redo restores a cross-section move');
  const beforeInvalidText = JSON.stringify(await readBlocks());
  await move(crossing.id, 12, 650);
  check(JSON.stringify(await readBlocks()) === beforeInvalidText, 'Dropping text outside the page restores its original placement');

  // All ordinary commands are available without expanding a disclosure.
  await secondObject.scrollIntoViewIfNeeded();
  await secondObject.locator('[data-rich-text]').first().click();
  await text.waitFor();
  await text.evaluate(element => element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: innerWidth - 8, clientY: innerHeight - 8 })));
  const menu = page.getByRole('menu', { name: 'Text context menu', exact: true });
  await menu.waitFor();
  check(await menu.locator('details:not([open])').count() === 0, 'Text menu has no initially hidden action groups');
  for (const name of ['Text settings…', 'Paragraph settings…', 'Match destination formatting', 'Keep source formatting', 'Paste plain text   Ctrl+Shift+V']) check(await menu.getByRole('menuitem', { name, exact: true }).isVisible(), `${name} is available immediately`);
  for (const name of ['Block properties', 'Delete text box', 'Select all', 'Cut', 'Copy', 'Delete', 'Paste']) check(await menu.getByRole('button', { name: new RegExp(`^${name}$`, 'i') }).isVisible(), `${name} is available immediately`);
  check(await text.evaluate(element => element.spellcheck === true), 'Text keeps Windows/browser spell checking enabled');
  if (nativeExe) check(await page.evaluate(() => window.webstudioNativeSpellingMenu === true), 'Native host retains its spelling-menu integration');
  await fits(menu);
  await menu.screenshot({ path: path.join(output, 'full-text-context-menu.png') });
  await page.setViewportSize({ width: 650, height: 440 });
  await fits(menu);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1540, height: 1000 });

  // Exact model state survives importing the portable project again; only synthetic data is used.
  await page.keyboard.press('Escape');
  const savedConfig = await page.evaluate(() => JSON.parse(localStorage.getItem('openpage-config')).state.config);
  const savedBlocks = await readBlocks();
  await importProject(project(savedConfig, '-reopened'), 'text-placement-reopened.webstudio.json');
  await block.waitFor();
  check(JSON.stringify(await readBlocks()) === JSON.stringify(savedBlocks), 'Portable-project reopen preserves placement, parents and typed wording');
  await footerLast();
  check(await canvas.count() === 1, 'Editor retains one page canvas');
  check(errors.length === 0, 'No browser runtime errors occurred');
  await page.locator(`[data-section-object="${second.id}"]`).click();
  await page.locator(`[data-section-object="${second.id}"] [data-text-move-handle]`).waitFor({ state: 'visible' });
  const detail = await page.locator('[data-section-object="right-panel"]').boundingBox();
  const view = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  const detailClip = { x: Math.max(0, detail.x - 22), y: Math.max(0, detail.y - 28), width: Math.min(detail.width + 44, view.width - Math.max(0, detail.x - 22)), height: Math.min(detail.height + 56, view.height - Math.max(0, detail.y - 28)) };
  await page.screenshot({ path: path.join(output, 'text-move-detail.png'), clip: detailClip });
  await page.screenshot({ path: path.join(output, 'text-placement-editor.png') });
  report.passed = true;
  report.completedUtc = new Date().toISOString();
  console.log(`PASS ${label}: ${checks.length} text-placement, drag, full-menu and preservation checks.`);
} catch (error) {
  report.failure = error.stack || String(error);
  await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  await browser?.close().catch(() => {});
  await vite?.close();
  if (child?.pid) spawnSync(path.join(process.env.SystemRoot || 'C:/Windows', 'System32', 'taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  if (nativeExe) {
    assert(profile.startsWith(output + path.sep), 'Profile cleanup stays inside the task output folder');
    await rm(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 150 }).catch(error => { report.profileCleanupError = error.message; });
  }
  await writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2));
}
