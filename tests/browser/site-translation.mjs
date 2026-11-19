// Isolated synthetic projects only. Set WEBSTUDIO_PLAYWRIGHT to the Playwright module.
// Live provider checks require WEBSTUDIO_LIVE_TRANSLATION=1; no private project is opened.
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs/promises';
import { createServer } from 'vite';
import JSZip from 'jszip';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.WEBSTUDIO_PLAYWRIGHT || 'playwright');
const assert = (value, message) => { if (!value) throw new Error(message); };
const live = process.env.WEBSTUDIO_LIVE_TRANSLATION === '1';
const capture = live && process.env.WEBSTUDIO_CAPTURE_GUIDE === '1';
const report = { live, phase: 'starting', settings: {}, export: {}, translation: {}, interactions: {}, viewports: [], externalHosts: [], providerResponses: [], failures: [], errors: [] };
const setPhase = async phase => { report.phase = phase; console.log('PHASE:', phase); await fs.writeFile('test-results/site-translation-browser.json', JSON.stringify(report, null, 2)); };
const files = new Map();
const prefix = '/website-review/';
const site = http.createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const entry = path.startsWith(prefix) ? files.get(path.slice(prefix.length)) : null;
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Content-Security-Policy', "form-action 'none'; connect-src 'self' https://translate-pa.googleapis.com; frame-ancestors 'self'");
  if (!entry) { response.writeHead(404); response.end('Not found'); return; }
  response.setHeader('Content-Type', path.endsWith('.html') ? 'text/html; charset=utf-8' : path.endsWith('.js') ? 'application/javascript; charset=utf-8' : 'application/octet-stream');
  response.end(entry);
});
const vite = process.env.WEBSTUDIO_TEST_URL ? null : await createServer({ server: { host: '127.0.0.1', port: 5199, strictPort: false,
  watch: { ignored: ['**/bin/**', '**/dcu/**', '**/export/**', '**/test-results/**', '**/docs/**', '**/.git/**', '**/Projects/**', '**/Website Test/**'] } } });
let browser, editorContext, siteContext, englishContext, page;
const image = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420"><rect width="640" height="420" fill="#e8efe8"/><circle cx="320" cy="180" r="95" fill="#e7b75f"/><path d="M0 420 190 210 320 340 450 170 640 420" fill="#24354a"/></svg>';
try {
  await vite?.listen();
  await new Promise(resolve => site.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ headless: true, executablePath: process.env.WEBSTUDIO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  editorContext = await browser.newContext({ viewport: { width: 1280, height: 1000 }, locale: 'en-US' });
  const editorRequests = [];
  editorContext.on('request', request => { if (/gtranslate|translate-pa\.googleapis/.test(request.url())) editorRequests.push(request.url()); });
  await editorContext.route('https://images.example.test/**', route => route.fulfill({ contentType: 'image/svg+xml', body: image }));
  page = await editorContext.newPage();
  page.on('pageerror', error => report.errors.push({ stage: 'editor', message: error.message, stack: error.stack }));
  await page.goto(process.env.WEBSTUDIO_TEST_URL || vite.resolvedUrls.local[0]);
  const fixture = await page.evaluate(async () => {
    const { useProjectsStore: projects } = await import('/src/store/projectsStore.ts');
    const { useConfigStore: configStore } = await import('/src/store/configStore.ts');
    const { useEditorStore: editor } = await import('/src/store/editorStore.ts');
    const { themePresets } = await import('/src/lib/theme-presets.ts');
    const { createProjectFile, parseProjectFile, serializeProjectFile } = await import('/src/project/project-file.ts');
    if (projects.getState().projects.length) throw new Error('Refusing to replace non-test projects.');
    const navbar = { id: 'home-nav', type: 'navbar', variant: 'default', props: { logo: 'Community', navItems: [{ label: 'Home', url: '/' }, { label: 'Plan your visit', url: '/visit/team' }], blockBackgroundColor: '#ffffff' } };
    const home = [navbar,
      { id: 'welcome', type: 'hero', variant: 'minimal', props: { headline: 'Welcome to our community', subheadline: 'A place to meet, share and grow. We welcome visitors and families.', blockBackgroundColor: '#24354a', textColor: '#ffffff', layoutHeight: 300 } },
      { id: 'intro', type: 'content', variant: 'prose', props: { title: 'Come and visit us', body: 'Join us on Sunday morning. Our community welcomes people of all ages. Find useful information and meet our team.', blockBackgroundColor: '#faf7ef', textColor: '#24354a' } },
      { id: 'photos', type: 'gallery', variant: 'responsive', props: { title: 'Community photographs', enablePhotoViewer: true, images: [{ id: 'photo-1', src: 'https://images.example.test/community.svg', alt: 'Community landscape', caption: 'A welcoming place for everyone.' }] } },
      { id: 'calendar', type: 'calendar', variant: 'default', props: { title: 'Community calendar', intro: 'See what is happening this month.', events: [] } },
      { id: 'contact', type: 'contact', variant: 'form', props: { title: 'Contact our community', recipientEmail: 'contact@nowhere.com' } },
      { id: 'footer', type: 'footer', variant: 'simple', props: { logo: 'Community', copyright: 'Community example website', links: [] } },
    ];
    const nested = [{ ...navbar, id: 'visit-nav' },
      { id: 'visit-title', type: 'hero', variant: 'minimal', props: { headline: 'Plan your visit', subheadline: 'We look forward to welcoming you.', blockBackgroundColor: '#24354a', textColor: '#ffffff', layoutHeight: 240 } },
      { id: 'staff', type: 'team', variant: 'directory', props: { title: 'Meet our team', members: [{ name: 'Community volunteer', role: 'Visitor welcome', bio: 'Our volunteer welcomes visitors and helps families find their way. The team shares practical information about activities, community groups and local events. Please speak with a team member when you arrive; everyone is happy to help you feel at home. We welcome questions and look forward to meeting you.' }] } },
    ];
    const config = { name: 'Community welcome', theme: themePresets.find(item => item.id === 'clean').theme, blocks: home, pages: [{ id: 'home', name: 'Home', path: '/', blocks: home }, { id: 'visit', name: 'Visit', path: '/visit/team', blocks: nested }] };
    const file = createProjectFile(config, 'translation-browser-fixture');
    const id = projects.getState().addProject('Community welcome', file, 'translation-browser-fixture');
    projects.getState().updateProjectSettings(id, { webmasterEmail: 'contact@nowhere.com', siteDescription: 'Community visitor information' });
    configStore.getState().setConfig(config);
    editor.getState().setActiveProject(id);
    const reopened = parseProjectFile(serializeProjectFile(file)).project;
    return { id, original: JSON.stringify(projects.getState().projects[0].config), olderDisabled: reopened.settings?.websiteTranslation !== true };
  });
  assert(fixture.olderDisabled, 'Existing projects must remain disabled.');
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  const checkbox = page.getByRole('checkbox', { name: 'Website translation', exact: true });
  await checkbox.waitFor();
  assert(!await checkbox.isChecked(), 'Translation must initially be off.');
  assert(await page.getByText('GTranslate processes displayed page text online;', { exact: false }).count() === 1, 'Settings must explain online processing and service terms.');
  await checkbox.check();
  assert(await checkbox.isChecked(), 'Checkbox should enable website translation.');
  const saved = await page.evaluate(async () => {
    const { useProjectsStore: projects } = await import('/src/store/projectsStore.ts');
    const { parseProjectFile, serializeProjectFile } = await import('/src/project/project-file.ts');
    const project = projects.getState().projects[0];
    const file = { ...project.projectFile, config: project.config, settings: project.settings };
    const reopened = parseProjectFile(serializeProjectFile(file)).project;
    return { enabled: reopened.settings.websiteTranslation, email: reopened.settings.webmasterEmail, original: JSON.stringify(reopened.config), persisted: JSON.parse(localStorage.getItem('openpage-projects')).state.projects[0].settings.websiteTranslation };
  });
  assert(saved.enabled === true && saved.persisted === true, 'Choice must persist in the portable project and draft.');
  assert(saved.email === 'contact@nowhere.com', 'Dummy email must remain unchanged.');
  assert(saved.original === fixture.original, 'Enabling translation must not modify page content.');
  await page.reload();
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await page.getByText('Community welcome', { exact: true }).click();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  assert(await checkbox.isChecked(), 'Choice must survive reloading Settings.');
  if (capture) {
    await checkbox.locator('..').locator('..').screenshot({ path: 'docs/guide-images/website-translation-settings.png', animations: 'disabled' });
  }
  await page.getByRole('link', { name: 'Editor', exact: true }).click();
  await page.getByRole('button', { name: 'Toggle preview mode', exact: true }).click();
  assert(await page.locator('script[src*="gtranslate"], .gtranslate_wrapper').count() === 0, 'Editor Preview must not run the external translator.');
  assert(editorRequests.length === 0, 'No translation service may receive editor content.');
  report.settings = { defaultOff: true, checkbox: true, portableRoundTrip: true, draftReload: true, dummyEmailPreserved: true, editorIsolated: true };

  const archives = await page.evaluate(async () => {
    const { useProjectsStore: projects } = await import('/src/store/projectsStore.ts');
    const { exportSiteZip } = await import('/src/lib/export-html.ts');
    const project = projects.getState().projects[0];
    const enabled = await exportSiteZip(project.config, { settings: project.settings });
    const disabled = await exportSiteZip(project.config, { settings: { ...project.settings, websiteTranslation: false } });
    return { enabled: Array.from(new Uint8Array(await enabled.arrayBuffer())), disabled: Array.from(new Uint8Array(await disabled.arrayBuffer())) };
  });
  const enabledZip = await JSZip.loadAsync(Uint8Array.from(archives.enabled));
  const disabledZip = await JSZip.loadAsync(Uint8Array.from(archives.disabled));
  for (const [name, entry] of Object.entries(enabledZip.files)) if (!entry.dir) files.set(name, await entry.async('nodebuffer'));
  assert(files.has('assets/translation-selector.js'), 'ZIP must include the local translation asset.');
  assert(!disabledZip.file('assets/translation-selector.js'), 'Disabled ZIP must not contain translation code.');
  for (const name of ['index.html', 'visit/team.html']) {
    const html = files.get(name).toString();
    assert((html.match(/data-ws-translation-vendor/g) || []).length === 1, 'Each page must load the vendor once.');
    const helper = name === 'index.html' ? 'assets/translation-selector.js' : '../assets/translation-selector.js';
    assert(html.includes(`src="${helper}"`), 'Nested pages must use the correct helper path.');
    assert(!/gtranslate|translation-selector/.test(await disabledZip.file(name).async('string')), 'Disabled pages must omit translation entirely.');
  }
  report.export = { root: true, nested: true, helperPackagedOnce: true, disabledClean: true };
  const siteUrl = `http://127.0.0.1:${site.address().port}${prefix}`;
  if (live) {
    await setPhase('fresh-English-first-menu');
    englishContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US' });
    await englishContext.route('https://images.example.test/**', route => route.fulfill({ contentType: 'image/svg+xml', body: image }));
    const firstVisit = await englishContext.newPage();
    firstVisit.on('pageerror', error => { report.errors.push({ stage: 'fresh-English', message: error.message, stack: error.stack }); console.log('Fresh English pageerror:', error.stack); });
    firstVisit.on('response', response => { if (new URL(response.url()).hostname === 'translate-pa.googleapis.com') report.providerResponses.push({ stage: 'fresh-English', status: response.status() }); });
    await firstVisit.goto(siteUrl + 'index.html', { waitUntil: 'load' });
    await firstVisit.locator('.gtranslate_wrapper .gt-selected').hover();
    await firstVisit.locator('.gtranslate_wrapper .gt-selected').click();
    await firstVisit.locator('.gtranslate_wrapper a[data-gt-lang="es"]').focus();
    await firstVisit.keyboard.press('Enter');
    await firstVisit.waitForFunction(() => document.querySelector('h1')?.innerText.toLowerCase().includes('bienven'), null, { timeout: 45000 });
    report.translation.freshEnglishFirstMenu = true;
    report.translation.keyboardLanguageChoice = true;
    await englishContext.close(); englishContext = null;
  }
  siteContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' });
  await siteContext.route('https://images.example.test/**', route => route.fulfill({ contentType: 'image/svg+xml', body: image }));
  if (!live) await siteContext.route('https://cdn.gtranslate.net/**', route => route.abort());
  const visitor = await siteContext.newPage();
  const hosts = new Set();
  const privateSentinel = 'PRIVATE_VISITOR_INPUT_739285';
  let translationPosts = 0;
  let visitorInputExposed = false;
  visitor.on('request', request => {
    const url = new URL(request.url());
    if (!['127.0.0.1', 'images.example.test'].includes(url.hostname)) hosts.add(url.hostname);
    if (url.hostname === 'translate-pa.googleapis.com' && request.method() === 'POST') {
      translationPosts++;
      if ((request.postData() || '').includes(privateSentinel)) visitorInputExposed = true;
    }
  });
  visitor.on('requestfailed', request => report.failures.push({ url: request.url().split('?')[0], error: request.failure()?.errorText }));
  visitor.on('response', response => { if (new URL(response.url()).hostname === 'translate-pa.googleapis.com') report.providerResponses.push({ stage: report.phase, status: response.status() }); });
  visitor.on('pageerror', error => { report.errors.push({ stage: 'website', message: error.message, stack: error.stack }); console.log('Website pageerror:', error.stack); });
  await visitor.goto(siteUrl + 'index.html', { waitUntil: 'load' });
  if (live) {
    const menu = visitor.locator('.gtranslate_wrapper .gt_options');
    const trigger = visitor.locator('.gtranslate_wrapper .gt-selected');
    const openMenu = async () => {
      if (!await menu.evaluate(element => element.classList.contains('gt-open'))) await trigger.click();
      try {
        await visitor.waitForFunction(() => {
          const list = document.querySelector('.gtranslate_wrapper .gt_options');
          return list.classList.contains('gt-open') && getComputedStyle(list).display !== 'none' && getComputedStyle(list).opacity === '1';
        });
      } catch (error) {
        console.log('MENU STATE', await menu.evaluate(element => ({ className: element.className, style: element.style.cssText, opacity: getComputedStyle(element).opacity, display: getComputedStyle(element).display, rect: element.getBoundingClientRect().toJSON(), wrapper: element.parentElement.outerHTML.slice(0, 1000) })));
        throw error;
      }
    };
    const closeMenu = async () => {
      if (await menu.evaluate(element => element.classList.contains('gt-open'))) await trigger.click();
      await visitor.waitForFunction(() => !document.querySelector('.gtranslate_wrapper .gt_options').classList.contains('gt-open'));
    };
    const chooseLanguage = async code => {
      await openMenu();
      await menu.evaluate((element, language) => element.querySelector(`a[data-gt-lang="${language}"]`).scrollIntoView({ block: 'nearest' }), code);
      await visitor.locator(`.gtranslate_wrapper a[data-gt-lang="${code}"]`).click();
    };
    await setPhase('automatic-Spanish-and-static-caption');
    await visitor.waitForFunction(() => document.querySelector('h1')?.innerText.toLowerCase().includes('bienven'), null, { timeout: 45000 });
    assert(await visitor.locator('.gtranslate_wrapper a[data-gt-lang]').count() === 35, 'The preset must offer 35 languages.');
    const labels = await visitor.locator('.gtranslate_wrapper .gt_options a[data-gt-lang]').allTextContents();
    assert(labels.length === 35 && labels.every((label, index) => index === 0 || labels[index - 1].localeCompare(label, 'en') <= 0), 'Language labels must be alphabetical.');
    assert(labels.some(label => label.includes('Arabic') && label.includes('العربية')), 'Labels must include English and native wording.');
    report.translation.autoSpanish = await visitor.locator('h1').first().innerText();
    await visitor.waitForFunction(() => /lugar|todos|acoged/i.test(document.querySelector('[data-ws-gallery-caption-source]')?.innerText || ''), null, { timeout: 15000 });
    report.translation.staticGalleryCaption = await visitor.locator('[data-ws-gallery-caption-source]').innerText();
    await setPhase('calendar-next-in-Spanish');
    const beforeMonth = await visitor.locator('[data-ws-calendar-label]').innerText();
    await visitor.locator('[data-ws-calendar-step="1"]').click();
    await visitor.waitForFunction(() => /enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre/i.test(document.querySelector('[data-ws-calendar-label]').innerText));
    assert(await visitor.locator('[data-ws-calendar-label]').innerText() !== beforeMonth, 'Calendar controls must remain usable.');
    report.interactions.translatedCalendar = await visitor.locator('[data-ws-calendar-label]').innerText();
    await setPhase('gallery-Spanish-popup');
    await visitor.locator('[data-ws-gallery-thumbnail]').dblclick();
    await visitor.locator('[data-ws-gallery-dialog][open]').waitFor();
    await visitor.waitForFunction(() => /lugar|todos|acoged/i.test(document.querySelector('[data-ws-gallery-dialog] figcaption').innerText));
    report.interactions.translatedGalleryCaption = await visitor.locator('[data-ws-gallery-dialog] figcaption').innerText();
    await visitor.keyboard.press('Escape');
    assert(await visitor.locator('[data-ws-gallery-dialog][open]').count() === 0, 'Gallery Escape must still close the enlarged photo.');
    report.interactions.calendar = report.interactions.gallery = true;
    await setPhase('manual-English-and-calendar-state');
    await chooseLanguage('en');
    await visitor.waitForFunction(() => document.documentElement.dataset.translationLanguage === 'en' && document.querySelector('h1')?.innerText === 'Welcome to our community');
    report.translation.manualEnglish = true;
    report.interactions.monthAfterEnglishReset = await visitor.locator('[data-ws-calendar-label]').innerText();
    const expectedMonth = await visitor.evaluate(() => { const today = new Date(); return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(today.getFullYear(), today.getMonth() + 1, 1)); });
    assert(report.interactions.monthAfterEnglishReset === expectedMonth, 'Changing language must preserve the advanced calendar month and translate its label.');
    await visitor.locator('[data-ws-calendar-step="0"]').click();
    if (capture) {
      await visitor.evaluate(() => window.scrollTo(0, 0));
      await openMenu();
      await menu.evaluate(element => { element.scrollTop = 0; });
      await visitor.waitForFunction(() => Array.from(document.querySelectorAll('.gtranslate_wrapper .gt_options img')).slice(0, 6).every(image => image.complete && image.naturalWidth > 0));
      await visitor.locator('.gtranslate_wrapper .gt_options a[data-gt-lang="ar"]').waitFor({ state: 'visible' });
      await visitor.waitForTimeout(400);
      await visitor.locator('.gtranslate_wrapper .gt_float_switcher').screenshot({ path: 'docs/guide-images/website-translation-selector.png', animations: 'disabled' });
      await closeMenu();
    }
    await visitor.locator('input[name="name"]').fill(privateSentinel + '_NAME');
    await visitor.locator('input[name="email"]').fill(privateSentinel + '@example.test');
    await visitor.locator('textarea[name="message"]').fill(privateSentinel + '_MESSAGE');
    await setPhase('French-navigation-and-form-privacy');
    await chooseLanguage('fr');
    await visitor.waitForFunction(() => document.querySelector('h1')?.innerText.startsWith('Bienvenue'));
    assert(translationPosts > 0 && !visitorInputExposed, 'Translation requests must exclude visitor-entered form values.');
    report.translation.visitorInputExcluded = true;
    await visitor.locator('a[href="visit/team.html"]').first().click();
    await visitor.waitForURL('**/visit/team.html');
    await visitor.waitForFunction(() => document.querySelector('h1')?.innerText !== 'Plan your visit', null, { timeout: 45000 });
    report.translation.persistedState = await visitor.evaluate(() => ({ language: document.documentElement.dataset.translationLanguage, cookies: document.cookie, storage: { ...localStorage } }));
    const nestedHeading = await visitor.locator('h1').first().innerText();
    assert(/visite/i.test(nestedHeading), 'The manually selected French language must persist across pages despite the Spanish browser language.');
    report.translation.nestedFrench = nestedHeading;
    await setPhase('French-biography-popup');
    await visitor.locator('[data-ws-staff-bio-trigger]').click();
    await visitor.locator('[data-ws-staff-bio-dialog][open]').waitFor();
    await visitor.waitForFunction(() => /bénévole|visiteurs|familles/i.test(document.querySelector('[data-ws-staff-bio-text]').innerText));
    report.interactions.translatedBiography = await visitor.locator('[data-ws-staff-bio-text]').innerText();
    await visitor.keyboard.press('Escape');
    assert(await visitor.locator('[data-ws-staff-bio-dialog][open]').count() === 0, 'Biography popup Escape must still close.');
    report.interactions.biography = true;
    await setPhase('Arabic-and-English-reset');
    await chooseLanguage('ar');
    await visitor.waitForFunction(() => document.documentElement.dir === 'rtl' && document.documentElement.dataset.translationLanguage === 'ar');
    await visitor.waitForFunction(() => /[\u0600-\u06ff]/.test(document.querySelector('h1')?.innerText || ''));
    report.translation.arabicDirection = true;
    await chooseLanguage('en');
    await visitor.waitForFunction(() => document.documentElement.dir === 'ltr' && document.querySelector('h1')?.innerText === 'Plan your visit');
    await setPhase('viewport-layouts');
    for (const language of ['en', 'ar']) {
      if (language === 'ar') { await chooseLanguage('ar'); await visitor.waitForFunction(() => document.documentElement.dir === 'rtl'); }
      for (const [width, height] of [[1280, 900], [768, 1024], [390, 844], [320, 740]]) {
      await visitor.setViewportSize({ width, height });
      const box = await trigger.boundingBox();
      assert(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height, 'Floating selector must fit the viewport.');
      await openMenu();
      const list = await menu.boundingBox();
      report.viewports.push({ language, width, height, selector: box, dropdown: list });
      assert(list && list.x >= 0 && list.y >= 0 && list.x + list.width <= width + 1 && list.y + list.height <= height + 1, 'Open language list must fit the viewport.');
      await closeMenu();
      Object.assign(report.viewports.at(-1), { selectorFits: true, dropdownFits: true });
      }
    }
    assert(translationPosts > 0 && !visitorInputExposed, 'Translation requests must exclude visitor-entered form values.');
    report.translation.visitorInputExcluded = true;
    report.translation.translationPostsObserved = translationPosts;
  }
  assert(await page.evaluate(async () => JSON.stringify((await import('/src/store/projectsStore.ts')).useProjectsStore.getState().projects[0].config)) === fixture.original, 'Browser translation must not change the saved source.');
  report.translation.sourceUnchanged = true;
  report.externalHosts = [...hosts].sort();
  await fs.writeFile('test-results/site-translation-browser.json', JSON.stringify(report, null, 2));
  assert(report.errors.length === 0, `Browser errors: ${report.errors.map(error => error.message).join('; ')}`);
  assert(report.providerResponses.every(response => response.status >= 200 && response.status < 300), 'The translation provider returned an HTTP error.');
  assert(!live || report.failures.length === 0, `Failed requests: ${report.failures.map(failure => failure.url).join('; ')}`);
  console.log(JSON.stringify({ result: 'PASS', ...report }, null, 2));
} catch (error) {
  report.failure = error.message;
  const currentVisitor = siteContext?.pages()[0];
  if (currentVisitor && !currentVisitor.isClosed()) report.observedPage = await currentVisitor.evaluate(() => ({ language: document.documentElement.dataset.translationLanguage, heading: document.querySelector('h1')?.innerText, month: document.querySelector('[data-ws-calendar-label]')?.innerText, staticCaption: document.querySelector('[data-ws-gallery-caption-source]')?.innerText, popupCaption: document.querySelector('[data-ws-gallery-dialog] figcaption')?.innerText, biography: document.querySelector('[data-ws-staff-bio-text]')?.innerText }));
  await fs.writeFile('test-results/site-translation-browser.json', JSON.stringify(report, null, 2));
  throw error;
} finally {
  await siteContext?.close();
  await englishContext?.close();
  await editorContext?.close();
  await browser?.close();
  await vite?.close();
  await new Promise(resolve => site.close(resolve));
}
