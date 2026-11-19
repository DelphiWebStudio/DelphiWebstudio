// Isolated synthetic project. Folder dialogs, refresh and browser opening are native-bridge mocks.
// The real website exporter and its ZIP-download handshake run in the actual Export UI.
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import { createServer } from 'vite';
import JSZip from 'jszip';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.WEBSTUDIO_PLAYWRIGHT || 'playwright');
const assert = (value, message) => { if (!value) throw new Error(message); };
const report = { checks: {}, errors: [], nativeOperationsMocked: true, actualWebsiteExporter: true, downloads: [] };
const server = await createServer({ server: { host: '127.0.0.1', port: 5196, strictPort: false,
  watch: { ignored: ['**/bin/**', '**/dcu/**', '**/docs/**', '**/test-results/**', '**/Projects/**', '**/Website Test/**', '**/.git/**'] } } });
let browser;
try {
  await server.listen();
  const localOrigin = server.resolvedUrls.local[0].replace(/\/$/, '');
  browser = await chromium.launch({ headless: true, executablePath: process.env.WEBSTUDIO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 860, height: 1000 } });
  await context.route('https://webstudio.local/**', async route => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: localOrigin + url.pathname + url.search });
    await route.fulfill({ response });
  });
  await context.route(/https?:\/\/(?!webstudio\.local|127\.0\.0\.1)/, route => route.abort());
  await context.addInitScript(() => {
    const webview = new EventTarget();
    window.__localSiteOperations = [];
    window.__selectedLocalFolder = '';
    window.__cancelNextFolderChoice = true;
    window.__localFolderExample = 'C:\\Website Test\\Community';
    window.__localBackupExample = 'C:\\Website Test\\Community Backups\\website-before-20261119-223000.zip';
    window.__replyLocalSite = (token, values) => webview.dispatchEvent(new MessageEvent('message', { data: { version: 1, kind: 'site.local.result', token, ok: true, folder: window.__selectedLocalFolder, ...values } }));
    webview.postMessage = message => {
      if (!message.kind?.startsWith('site.local.')) return;
      window.__localSiteOperations.push({ kind: message.kind, token: message.token, projectId: message.projectId });
      if (message.kind === 'site.local.get') setTimeout(() => window.__replyLocalSite(message.token, {}), 10);
      if (message.kind === 'site.local.choose') {
        if (window.__cancelNextFolderChoice) {
          window.__cancelNextFolderChoice = false;
          setTimeout(() => window.__replyLocalSite(message.token, { cancelled: true }), 10);
        } else {
          window.__selectedLocalFolder = window.__localFolderExample;
          setTimeout(() => window.__replyLocalSite(message.token, {}), 10);
        }
      }
      if (message.kind === 'site.local.prepare') {
        window.__pendingLocalRefresh = message.token;
        setTimeout(() => webview.dispatchEvent(new MessageEvent('message', { data: { version: 1, kind: 'site.local.ready', token: message.token, ok: true, folder: window.__selectedLocalFolder } })), 10);
      }
      if (message.kind === 'site.local.open') setTimeout(() => window.__replyLocalSite(message.token, {}), 10);
    };
    Object.defineProperty(window, 'chrome', { value: { webview }, configurable: true });
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto('https://webstudio.local/', { waitUntil: 'load' });
  await page.evaluate(async () => {
    const { useProjectsStore } = await import('/src/store/projectsStore.ts');
    const { useConfigStore } = await import('/src/store/configStore.ts');
    const { useEditorStore } = await import('/src/store/editorStore.ts');
    const { createProjectFile } = await import('/src/project/project-file.ts');
    const { themePresets } = await import('/src/lib/theme-presets.ts');
    if (useProjectsStore.getState().projects.length) throw new Error('Refusing to alter a profile containing existing projects.');
    const blocks = [{ id: 'welcome', type: 'hero', variant: 'minimal', props: { headline: 'Welcome to our community', subheadline: 'Visitor information and local activities.' } }];
    const config = { name: 'Community website', theme: themePresets.find(item => item.id === 'clean').theme, blocks,
      pages: [{ id: 'home', name: 'Home', path: '/', blocks }, { id: 'about', name: 'About', path: '/about', blocks: [{ id: 'about-title', type: 'hero', variant: 'minimal', props: { headline: 'About our community' } }] }] };
    const file = createProjectFile(config, 'local-folder-browser-fixture');
    const id = useProjectsStore.getState().addProject(config.name, file, 'local-folder-browser-fixture');
    useProjectsStore.getState().updateProjectSettings(id, { siteDescription: 'Community information and events.', webmasterEmail: 'contact@nowhere.com', websiteTranslation: true });
    useConfigStore.getState().setConfig(config);
    useEditorStore.getState().setActiveProject(id);
  });
  await page.getByRole('link', { name: 'Export', exact: true }).click();
  const panel = page.getByRole('heading', { name: 'Local test folder', exact: true }).locator('..');
  const choose = panel.getByRole('button', { name: 'Choose local test folder', exact: true });
  const refresh = panel.getByRole('button', { name: 'Refresh local site', exact: true });
  const open = panel.getByRole('button', { name: 'Open local site', exact: true });
  await panel.getByText('No local test folder selected for this project.', { exact: true }).waitFor();
  assert(await refresh.isDisabled() && await open.isDisabled(), 'A destination is required before local website actions.');
  assert(await page.evaluate(() => window.__localSiteOperations.every(item => item.kind === 'site.local.get')), 'Opening Export must not choose, refresh or open a site.');
  report.checks.getIsReadOnly = true;
  await choose.click();
  await choose.waitFor({ state: 'visible' });
  await page.waitForFunction(() => window.__localSiteOperations.filter(item => item.kind === 'site.local.choose').length === 1);
  assert(await panel.getByText('No local test folder selected for this project.', { exact: true }).isVisible(), 'Cancelling the picker must preserve the old destination.');
  await choose.click();
  await panel.getByText('C:\\Website Test\\Community', { exact: true }).waitFor();
  assert(await refresh.isDisabled(), 'Choosing a folder must not bypass website review.');
  report.checks.folderChoiceExplicitAndCancelPreserved = true;
  await page.getByRole('button', { name: 'Review files', exact: true }).click();
  await refresh.waitFor({ state: 'visible' });
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Refresh local site' && !button.disabled));
  assert(await page.evaluate(() => !window.__localSiteOperations.some(item => item.kind === 'site.local.prepare' || item.kind === 'site.local.open')), 'Reviewing files must not refresh or open automatically.');
  report.checks.currentReviewRequired = true;
  if (process.env.WEBSTUDIO_CAPTURE_GUIDE === '1') {
    await page.getByRole('heading', { name: 'Review website files', exact: true }).locator('..').screenshot({ path: 'docs/guide-images/export-review-current.png', animations: 'disabled' });
    report.checks.exportReviewScreenshot = true;
  }
  const runRefresh = async cancelled => {
    const downloadPromise = page.waitForEvent('download');
    await refresh.click();
    const download = await downloadPromise;
    const token = await page.evaluate(() => window.__pendingLocalRefresh);
    assert(download.suggestedFilename() === `webstudio-preview-${token}.zip`, 'Reviewed ZIP must carry its native refresh token.');
    const zip = await JSZip.loadAsync(await fs.readFile(await download.path()), { checkCRC32: true });
    assert(zip.file('index.html') && zip.file('about.html') && zip.file('assets/translation-selector.js'), 'Local refresh must receive the complete translated website.');
    report.downloads.push({ index: !!zip.file('index.html'), about: !!zip.file('about.html'), translation: !!zip.file('assets/translation-selector.js'), crcVerified: true, cancelled });
    await page.evaluate(({ token, cancelled }) => window.__replyLocalSite(token, cancelled ? { cancelled: true } : { backup: window.__localBackupExample, message: 'Local website files refreshed.' }), { token, cancelled });
    await refresh.waitFor({ state: 'visible' });
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Refresh local site' && !button.disabled));
    await download.delete();
  };
  await runRefresh(true);
  assert(await panel.getByText('Pre-refresh backup:', { exact: false }).count() === 0, 'Cancelled refresh must not claim that a backup or new site was written.');
  report.checks.refreshCancelDoesNotClaimSuccess = true;
  await runRefresh(false);
  await panel.getByText('website-before-20261119-223000.zip', { exact: false }).waitFor();
  report.checks.reviewedZipDownloadHandshake = true;
  if (process.env.WEBSTUDIO_CAPTURE_GUIDE === '1') {
    await panel.screenshot({ path: 'docs/guide-images/local-test-folder.png', animations: 'disabled' });
    report.checks.guideScreenshot = true;
  }
  const portable = await page.evaluate(async () => {
    const { useProjectsStore } = await import('/src/store/projectsStore.ts');
    const { useConfigStore } = await import('/src/store/configStore.ts');
    const { serializeProjectFile } = await import('/src/project/project-file.ts');
    const project = useProjectsStore.getState().projects[0];
    return serializeProjectFile({ ...project.projectFile, config: useConfigStore.getState().config, settings: project.settings });
  });
  assert(!portable.includes('Website Test') && !portable.includes('website-before-'), 'Local paths must not enter the portable project.');
  assert(portable.includes('contact@nowhere.com'), 'Dummy email must remain unchanged.');
  report.checks.privatePathsExcludedFromProject = true;
  assert(await page.evaluate(() => !window.__localSiteOperations.some(item => item.kind === 'site.local.open')), 'Refreshing must not open a browser automatically.');
  await open.click();
  await page.waitForFunction(() => window.__localSiteOperations.filter(item => item.kind === 'site.local.open').length === 1);
  report.checks.openRequiresExplicitButton = true;
  await page.evaluate(async () => { const { useConfigStore } = await import('/src/store/configStore.ts'); useConfigStore.getState().updateBlockProps('welcome', { subheadline: 'Updated visitor information.' }); });
  assert(await refresh.isDisabled(), 'A project edit must invalidate the reviewed ZIP.');
  await page.getByRole('button', { name: 'Review files', exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Refresh local site' && !button.disabled));
  assert(await page.evaluate(() => window.__localSiteOperations.filter(item => item.kind === 'site.local.prepare').length === 2), 'A new review must not refresh until requested.');
  report.checks.editsRequireNewReview = true;
  assert(report.errors.length === 0, 'Unexpected browser errors.');
  report.checks.noFormsSubmittedOrRemotePublication = true;
  report.passed = true;
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.passed = false;
  report.error = error.stack;
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} finally {
  await fs.mkdir('test-results', { recursive: true });
  await fs.writeFile('test-results/local-site-folder-browser.json', JSON.stringify(report, null, 2));
  await browser?.close();
  await server.close();
}
