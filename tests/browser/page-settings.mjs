// Synthetic, isolated projects only. No installed editor profile is opened.
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.WEBSTUDIO_PLAYWRIGHT || 'playwright');
const vite = process.env.WEBSTUDIO_TEST_URL ? null : await createServer({ server: { host: '127.0.0.1', port: 5203, strictPort: false,
  watch: { ignored: ['**/Projects/**', '**/Website Test/**', '**/bin/**', '**/dcu/**', '**/test-results/**', '**/docs/**', '**/.git/**'] } } });
let browser, page;
const report = { checks: {}, errors: [] };
try {
  await vite?.listen();
  browser = await chromium.launch({ headless: true, executablePath: process.env.WEBSTUDIO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const context = await browser.newContext({ viewport: { width: 1366, height: 1100 } });
  page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(process.env.WEBSTUDIO_TEST_URL || vite.resolvedUrls.local[0]);
  const original = await page.evaluate(async () => {
    const { useConfigStore: configStore } = await import('/src/store/configStore.ts');
    const { useProjectsStore: projects } = await import('/src/store/projectsStore.ts');
    const { useEditorStore: editor } = await import('/src/store/editorStore.ts');
    if (projects.getState().projects.length) throw new Error('Refusing a non-test profile.');
    const home = [
      { id: 'home-nav', type: 'navbar', variant: 'default', props: { logo: 'Community example', navItems: [{ label: 'Home', url: '/' }, { label: 'About', url: '/about', children: [{ label: 'History', url: '/about/history#beginnings' }] }] } },
      { id: 'home-text', type: 'content', variant: 'prose', props: { title: 'Welcome', body: '[Learn about our community](/about?from=home#visit)' } },
    ];
    const config = { name: 'Community example', blocks: home, pages: [
      { id: 'home', name: 'Home', path: '/', blocks: home },
      { id: 'about', name: 'About', path: '/about', blocks: [{ id: 'about-content', type: 'content', variant: 'prose', props: { title: 'About our community', body: 'A welcoming place to meet and share.', anchorName: 'visit' } }] },
      { id: 'history', name: 'History', path: '/about/history', blocks: [{ id: 'history-content', type: 'content', variant: 'prose', props: { title: 'Our history', body: 'Discover how our community began.', anchorName: 'beginnings' } }] },
    ] };
    const id = projects.getState().addProject('Community example');
    projects.getState().updateProjectConfig(id, config);
    configStore.getState().setConfig(config);
    editor.getState().setActiveProject(id);
    return JSON.stringify(configStore.getState().config);
  });
  await page.getByRole('link', { name: 'Editor', exact: true }).click();
  await page.evaluate(async () => {
    const { useEditorStore: editor } = await import('/src/store/editorStore.ts');
    const { useProjectsStore: projects } = await import('/src/store/projectsStore.ts');
    editor.getState().setActiveProject(projects.getState().projects[0].id);
  });
  await page.getByLabel('Go to page', { exact: true }).selectOption('about');
  await page.locator('.studio-page-tools > summary').click();
  await page.getByRole('button', { name: 'Page settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Page settings for About', exact: true });
  await settings.getByLabel('Page address', { exact: true }).fill('about-us');
  await settings.locator('[data-page-address-preview]').filter({ hasText: '/about-us' }).waitFor();
  assert(await settings.getByLabel('Update links within this website', { exact: true }).isChecked());
  assert(!await settings.getByLabel('Also change related page addresses (1)', { exact: true }).isChecked());
  await settings.getByText('Review 2 link references', { exact: true }).click();
  await settings.getByText('Home: 2', { exact: true }).waitFor();
  if (process.env.WEBSTUDIO_CAPTURE_GUIDE === '1') await settings.screenshot({ path: 'docs/guide-images/page-settings-address.png' });
  await settings.getByRole('button', { name: 'Save page settings', exact: true }).click();
  let state = await page.evaluate(async () => {
    const { useConfigStore: store } = await import('/src/store/configStore.ts');
    const s = store.getState(); return { config: s.config, undo: s.undoStack.length };
  });
  assert.equal(state.config.pages[1].path, '/about-us');
  assert.equal(state.config.pages[2].path, '/about/history');
  assert.equal(state.config.pages[0].blocks[1].props.body, '[Learn about our community](/about-us?from=home#visit)');
  assert.equal(state.undo, 1);
  report.checks.settingsViaPageTools = true;
  report.checks.slashAndFilenamePreview = true;
  report.checks.internalLinksAndAnchors = true;
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal(await page.evaluate(async () => { const { useConfigStore: store } = await import('/src/store/configStore.ts'); return JSON.stringify(store.getState().config); }), original);
  report.checks.singleUndoRestoresEverything = true;
  const aboutTab = page.getByRole('group', { name: 'Pages', exact: true }).getByRole('button', { name: 'About', exact: true });
  await aboutTab.click({ button: 'right' });
  await settings.getByLabel('Page name', { exact: true }).fill('About our community');
  await settings.getByLabel('Page address', { exact: true }).fill('/about-us');
  await settings.getByLabel('Also change related page addresses (1)', { exact: true }).check();
  await settings.getByRole('list', { name: 'Related address changes' }).getByText('/about/history → /about-us/history', { exact: true }).waitFor();
  await settings.getByRole('button', { name: 'Save page settings', exact: true }).click();
  state = await page.evaluate(async () => { const { useConfigStore: store } = await import('/src/store/configStore.ts'); return { config: store.getState().config, undo: store.getState().undoStack.length }; });
  assert.equal(state.config.pages[1].name, 'About our community');
  assert.equal(state.config.pages[2].path, '/about-us/history');
  assert.equal(state.config.pages[0].blocks[0].props.navItems[1].label, 'About');
  assert.equal(state.config.pages[0].blocks[0].props.navItems[1].children[0].url, '/about-us/history#beginnings');
  assert.equal(state.undo, 1);
  report.checks.rightClickAndExplicitChildren = true;
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  report.checks.redo = true;
  await page.getByRole('button', { name: 'Page settings for About our community', exact: true }).click();
  const renamed = page.getByRole('dialog', { name: 'Page settings for About our community', exact: true });
  await renamed.getByLabel('Page address', { exact: true }).fill('/about-us/history');
  await renamed.getByRole('button', { name: 'Save page settings', exact: true }).click();
  await renamed.getByRole('alert').getByText(/Duplicate page path/).waitFor();
  await renamed.getByRole('button', { name: 'Cancel', exact: true }).click();
  report.checks.collisionDoesNotCommit = true;
  await page.getByLabel('Go to page', { exact: true }).selectOption('home');
  await page.getByRole('button', { name: 'Page settings for Home', exact: true }).click();
  const homeDialog = page.getByRole('dialog', { name: 'Page settings for Home', exact: true });
  assert.equal(await homeDialog.getByLabel('Page address', { exact: true }).inputValue(), '/');
  assert(!await homeDialog.getByLabel('Page address', { exact: true }).isEditable());
  await page.setViewportSize({ width: 390, height: 844 });
  const bounds = await homeDialog.boundingBox();
  assert(bounds.x >= 0 && bounds.x + bounds.width <= 391);
  await homeDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  report.checks.homeProtectionAndPhoneLayout = true;
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (error) {
  report.passed = false; report.error = error.stack;
  if (page) { report.finalUrl = page.url(); report.screenText = (await page.locator('body').innerText()).slice(0, 2500); }
  process.exitCode = 1;
}
finally {
  await browser?.close(); await vite?.close();
  await fs.writeFile('test-results/page-settings-browser.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
