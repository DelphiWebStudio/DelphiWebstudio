// Isolated synthetic project. The native status bridge is mocked; no external website is contacted.
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.WEBSTUDIO_PLAYWRIGHT || 'playwright');
const assert = (value, message) => { if (!value) throw new Error(message); };
const report = { checks: {}, errors: [], nativeBatches: [], nativeNetworkMocked: true };
const server = await createServer({ server: { host: '127.0.0.1', port: 5197, strictPort: false,
  watch: { ignored: ['**/bin/**', '**/dcu/**', '**/docs/**', '**/test-results/**', '**/Projects/**', '**/Website Test/**', '**/.git/**'] } } });
let browser;
try {
  await server.listen();
  const localOrigin = server.resolvedUrls.local[0].replace(/\/$/, '');
  browser = await chromium.launch({ headless: true, executablePath: process.env.WEBSTUDIO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const context = await browser.newContext({ viewport: { width: 1366, height: 1000 } });
  await context.route('https://webstudio.local/**', async route => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: localOrigin + url.pathname + url.search });
    await route.fulfill({ response });
  });
  await context.route(/https?:\/\/(?!webstudio\.local|127\.0\.0\.1)/, route => route.abort());
  await context.addInitScript(() => {
    const webview = new EventTarget();
    window.__siteCheckBatches = [];
    webview.postMessage = message => {
      if (message.kind !== 'site.links.check') return;
      window.__siteCheckBatches.push(message.urls);
      const results = message.urls.map((url, index) => ({ url, status: index === 0 ? 'broken' : index === 1 ? 'unverified' : 'ok', httpStatus: index === 0 ? 404 : index === 1 ? 403 : 200,
        message: index === 0 ? 'The server reports that this page was not found.' : index === 1 ? 'This server requires sign-in or declined an automated check.' : 'The destination responded successfully.' }));
      setTimeout(() => webview.dispatchEvent(new MessageEvent('message', { data: { version: 1, kind: 'site.links.result', token: message.token, ok: true, results } })), 20);
    };
    Object.defineProperty(window, 'chrome', { value: { webview }, configurable: true });
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto('https://webstudio.local/', { waitUntil: 'load' });
  const fixture = await page.evaluate(async () => {
    const { useProjectsStore } = await import('/src/store/projectsStore.ts');
    const { useConfigStore } = await import('/src/store/configStore.ts');
    const { useEditorStore } = await import('/src/store/editorStore.ts');
    const { createProjectFile } = await import('/src/project/project-file.ts');
    const { themePresets } = await import('/src/lib/theme-presets.ts');
    if (useProjectsStore.getState().projects.length) throw new Error('Refusing to change a profile containing existing projects.');
    const home = [{ id: 'home-hero', type: 'hero', variant: 'minimal', props: { headline: 'Welcome to our community' } },
      { id: 'web-links', type: 'content', variant: 'prose', props: { body: Array.from({ length: 25 }, (_, index) => `[Visitor resource ${index + 1}](https://example.test/resource-${index + 1})`).join('\n\n') } }];
    const visit = [{ id: 'visit-hero', type: 'hero', variant: 'minimal', props: { headline: 'Plan your visit' } },
      { id: 'space', type: 'panel', variant: 'default', props: { layoutHeight: 1400 } },
      { id: 'visit-information', type: 'content', variant: 'prose', props: { title: 'Visitor information', body: 'Our welcome team can help you find your way.', textSize: 16, textColor: '#bbbbbb', blockBackgroundColor: '#ffffff',
        section1Objects: [{ id: 'visitor-note', type: 'text', text: 'Please ask if you need assistance.', textColor: '#bbbbbb', fontSize: 16, x: 5, y: 180, width: 60, height: 60 }] } }];
    const config = { name: 'Check site example', theme: themePresets.find(item => item.id === 'clean').theme, blocks: home, pages: [{ id: 'home', name: 'Home', path: '/', blocks: home }, { id: 'visit', name: 'Visit', path: '/visit', blocks: visit }] };
    const file = createProjectFile(config, 'checks-browser-fixture');
    const id = useProjectsStore.getState().addProject(config.name, file, 'checks-browser-fixture');
    useProjectsStore.getState().updateProjectSettings(id, { siteDescription: 'Visitor information and community resources.' });
    useConfigStore.getState().setConfig(config);
    useEditorStore.getState().setActiveProject(id);
    return { original: JSON.stringify(useConfigStore.getState().config) };
  });
  await page.getByRole('link', { name: 'Editor', exact: true }).click();
  await page.getByText('Page tools', { exact: true }).click();
  await page.getByRole('button', { name: 'Check site', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Check site', exact: true });
  await dialog.getByText('Block text contrast is', { exact: false }).waitFor();
  assert(await dialog.getByText('Section 1 text contrast is', { exact: false }).count() === 1, 'Object contrast finding missing.');
  assert(await dialog.getByRole('button', { name: 'Open this object', exact: true }).count() === 1, 'Object jump action missing.');
  assert(await page.evaluate(() => window.__siteCheckBatches.length) === 0, 'Opening checks must not contact external destinations.');
  report.checks.networkRequiresClick = true;
  if (process.env.WEBSTUDIO_CAPTURE_GUIDE === '1') {
    await dialog.screenshot({ path: 'docs/guide-images/check-site-review.png', animations: 'disabled' });
    report.checks.guideScreenshot = true;
  }
  await dialog.getByRole('button', { name: 'Check external links', exact: true }).click();
  await dialog.getByText('Checked 25 of 25.', { exact: false }).waitFor();
  assert(await dialog.getByText('Broken (HTTP 404):', { exact: false }).count() === 2, '404 status was not distinguished from unverified results.');
  assert(await dialog.getByText('Unverified (HTTP 403):', { exact: false }).count() === 2, '403 must remain unverified.');
  report.nativeBatches = await page.evaluate(() => window.__siteCheckBatches.map(batch => batch.length));
  assert(JSON.stringify(report.nativeBatches) === '[20,5]', 'External links must use bounded batches.');
  report.checks.statusClassificationAndBatches = true;
  await dialog.getByText('Keyboard and form review', { exact: true }).click();
  assert(await dialog.getByText('Stop before sending or submitting anything.', { exact: false }).isVisible(), 'Manual form review must not submit a form.');
  report.checks.guidedKeyboardAndFormReview = true;
  await dialog.getByRole('button', { name: 'Open this object', exact: true }).click();
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-section-object') === 'visitor-note');
  const target = page.locator('[data-section-object="visitor-note"]');
  const bounds = await target.boundingBox();
  assert(bounds && bounds.y >= 0 && bounds.y < 1000, 'Affected object must be scrolled into view.');
  report.checks.objectSelectedFocusedAndVisible = await page.evaluate(async () => {
    const { useConfigStore } = await import('/src/store/configStore.ts');
    const { useEditorStore } = await import('/src/store/editorStore.ts');
    return useConfigStore.getState().activePageId === 'visit' && useEditorStore.getState().selectedSectionObject?.id === 'visitor-note';
  });
  assert(report.checks.objectSelectedFocusedAndVisible, 'Jump did not select the affected page/object.');
  const unchanged = await page.evaluate(async () => { const { useConfigStore } = await import('/src/store/configStore.ts'); return JSON.stringify(useConfigStore.getState().config); });
  assert(unchanged === fixture.original, 'Running checks must not edit the project.');
  report.checks.projectUnchanged = true;
  assert(report.errors.length === 0, 'Unexpected page error.');
  report.passed = true;
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.passed = false;
  report.error = error.stack;
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} finally {
  await fs.mkdir('test-results', { recursive: true });
  await fs.writeFile('test-results/editor-site-checks-browser.json', JSON.stringify(report, null, 2));
  await browser?.close();
  await server.close();
}
