// Synthetic paragraph/list acceptance; never opens user projects or alters clipboard/dictionary.
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
const output = path.resolve('test-results/text-bullets', label);
const profile = path.join(output, 'isolated-profile');
await mkdir(output, { recursive: true });
const checks = [], errors = [];
const report = { label, scope: nativeExe ? 'Actual desktop executable in an isolated synthetic profile' : 'Isolated Vite browser', checks, errors, passed: false };
function check(value, message) { assert(value, message); checks.push(message); }
const style = { tag: 'p', font: 'Arial', size: 18, color: '#17334b', align: 'left', lineHeight: 1.7, spaceBefore: 8, spaceAfter: 13, indentLeft: 12, indentRight: 16, firstLineIndent: 0 };
const runs = [
  { text: 'Mass Schedule', tag: 'h2', line: 1, font: 'Georgia', size: 28, bold: true, color: '#243246', spaceBefore: 4, spaceAfter: 18 },
  { ...style, text: 'Monday: 8:15 AM (Community Service)', line: 2 },
  { ...style, text: 'Tuesday: ', italic: true, line: 3 },
  { ...style, text: '6:15 PM', bold: true, line: 3 },
  { ...style, text: ' visit information', href: '/visit', underline: true, line: 3 },
  { ...style, text: '', line: 4, spaceBefore: 23, spaceAfter: 7 },
  { ...style, text: 'Wednesday through Friday: 8:15 AM', line: 5, lineHeight: 1.9, spaceBefore: 11, spaceAfter: 17 },
  { ...style, text: 'Friday: 12:15 PM', line: 6 },
  { ...style, text: 'Saturday: 9:15 AM', line: 7, indentLeft: 24, firstLineIndent: 6 },
  { ...style, text: 'Sunday: 10:15 AM', line: 8 },
  { text: 'Confessions', tag: 'h3', line: 9, bold: true, size: 22, color: '#243246', spaceBefore: 20, spaceAfter: 9 },
  { ...style, text: 'Thursday: 5:15 PM or by appointment', line: 10 },
  { ...style, text: 'Existing listed paragraph', tag: 'li', line: 11, spaceBefore: 10, spaceAfter: 10 },
  { ...style, text: '• A previously marked line.', line: 12 },
];
function config(value = runs) {
  const block = { id: 'bullet-example', type: 'content', variant: 'prose', props: { body: value.map(run => run.text).join('\n'), bodyRich: value, blockBackgroundColor: '#fbf8ef' } };
  return { name: 'Synthetic bullet formatting example', blocks: [block], pages: [{ id: 'home', name: 'Home', path: '/', blocks: [block] }] };
}
function project(value, suffix = '') { return { format: 'webstudio', schemaVersion: 2, projectId: 'text-bullets-test' + suffix, config: value, assets: [] }; }
let server, browser, exportBrowser, page, child;
try {
  server = await createServer({ server: { host: '127.0.0.1', port: 0, watch: { ignored: ['**/bin/**', '**/dcu/**', '**/docs/**', '**/export/**', '**/Projects/**', '**/Website Test/**', '**/test-results/**'] } }, appType: 'spa', ssr: { noExternal: ['pdfjs-dist'] } });
  await server.listen();
  let target;
  if (nativeExe) {
    check(['Win32', 'Win64'].some(platform => nativeExe === path.join(root, 'bin', platform, 'DelphiWebStudioPro.exe')), 'Native target is an approved project build');
    await mkdir(profile, { recursive: true });
    const portServer = createPortServer();
    await new Promise(resolve => portServer.listen(0, '127.0.0.1', resolve));
    const port = portServer.address().port;
    await new Promise(resolve => portServer.close(resolve));
    target = 'http://127.0.0.1:' + port;
    child = spawn(nativeExe, [], { cwd: path.dirname(nativeExe), windowsHide: true, stdio: 'ignore', env: { ...process.env, LOCALAPPDATA: profile, WEBVIEW2_USER_DATA_FOLDER: path.join(profile, 'WebView'), WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=' + port + ' --remote-allow-origins=' + target } });
    child.on('error', error => errors.push(error.message));
    const deadline = Date.now() + 45000;
    let ready = false;
    while (Date.now() < deadline) {
      try { ready = (await fetch(target + '/json/version')).ok; if (ready) break; } catch { /* Runtime startup */ }
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    check(ready, 'Isolated native WebView2 endpoint started');
    browser = await chromium.connectOverCDP(target);
    const context = browser.contexts()[0];
    page = context.pages()[0] || await context.waitForEvent('page');
    await page.waitForURL('https://webstudio.local/**');
    await page.setViewportSize({ width: 1540, height: 1100 });
    report.executable = path.relative(root, nativeExe).replaceAll('\\', '/');
    report.executableSha256 = createHash('sha256').update(await readFile(nativeExe)).digest('hex');
    target = 'https://webstudio.local/index.html#/editor';
  } else {
    browser = await chromium.launch({ executablePath: process.env.WEBSTUDIO_EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    page = await browser.newPage({ viewport: { width: 1540, height: 1100 }, deviceScaleFactor: 1 });
    target = server.resolvedUrls.local[0] + 'editor';
  }
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(target);
  if (nativeExe) {
    const script = await page.locator('script[type="module"][src]').first().getAttribute('src');
    const url = new URL(script, page.url());
    report.editorBundle = path.basename(url.pathname);
    report.editorBundleSha256 = await page.evaluate(async href => {
      const response = await fetch(href, { cache: 'no-store' });
      if (!response.ok) throw Error('Unable to read the loaded frontend');
      const digest = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
      return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
    }, url.href);
    check(report.editorBundleSha256 === createHash('sha256').update(await readFile(path.join(path.dirname(nativeExe), 'editor/assets', report.editorBundle))).digest('hex'), 'Loaded bundle matches exact staged frontend bytes');
  }
  await page.evaluate(() => {
    const items = JSON.parse(localStorage.getItem('openpage-projects') || '{"state":{"projects":[]}}').state.projects;
    if (items.some(item => !item.id.startsWith('text-bullets-test'))) throw Error('Refusing a profile with non-test projects.');
  });
  const starter = page.getByRole('button', { name: /^Church/ });
  if (await starter.count()) await starter.click();
  const importProject = async (value, suffix = '') => page.locator('[aria-label="Choose project file"]').setInputFiles({ name: 'text-bullets' + suffix + '.webstudio.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project(value, suffix))) });
  await importProject(config());
  const editor = page.locator('[data-rich-editor="body"]');
  await editor.waitFor();
  const readConfig = () => page.evaluate(() => JSON.parse(localStorage.getItem('openpage-config')).state.config);
  async function select(start, end, startOffset = 0, endOffset) {
    await editor.evaluate((element, args) => {
      const nodes = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) nodes.push(node);
      const first = nodes.find(node => node.textContent.includes(args.start));
      const last = [...nodes].reverse().find(node => node.textContent.includes(args.end));
      if (!first || !last) throw Error('Selection text not found');
      element.focus({ preventScroll: true });
      const range = document.createRange();
      range.setStart(first, first.textContent.indexOf(args.start) + args.startOffset);
      range.setEnd(last, last.textContent.indexOf(args.end) + (args.endOffset ?? args.end.length));
      const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
    }, { start, end, startOffset, endOffset });
  }
  async function bullets() {
    await editor.evaluate(element => element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 600, clientY: 300 })));
    await page.getByRole('menu', { name: 'Text context menu', exact: true }).getByRole('menuitem', { name: 'Text settings…', exact: true }).click();
    await page.getByRole('dialog', { name: 'Text settings', exact: true }).getByRole('button', { name: 'Add bullets', exact: true }).click();
    await page.getByRole('dialog', { name: 'Text settings', exact: true }).waitFor({ state: 'hidden' });
  }
  async function snapshot(locator = editor) {
    return locator.evaluate(element => {
      const top = element.getBoundingClientRect().top;
      return {
        html: element.innerHTML,
        rows: Array.from(element.querySelectorAll('h2,h3,p,li,span[style*="display:block"],span[style*="display: block"]')).map(row => ({
          text: row.textContent.replace(/•\s?/g, ''), tag: row.tagName, top: Math.round((row.getBoundingClientRect().top - top) * 100) / 100,
          height: Math.round(row.getBoundingClientRect().height * 100) / 100,
          paragraph: Object.fromEntries(['lineHeight', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'textIndent', 'textAlign'].map(key => [key, row.style[key]])),
          spans: Array.from(row.querySelectorAll('[data-rich-run]')).map(span => ({ text: span.textContent.replace(/•\s?/g, ''), font: getComputedStyle(span).fontFamily, size: getComputedStyle(span).fontSize, color: getComputedStyle(span).color, bold: getComputedStyle(span).fontWeight, italic: getComputedStyle(span).fontStyle, href: span.getAttribute('href') })).filter(span => span.text.length),
        })),
      };
    });
  }
  function equalSpacing(before, after, message, inline = true) {
    check(before.rows.length === after.rows.length, message + ': every original paragraph and blank row is retained');
    for (let index = 0; index < before.rows.length; index++) {
      const a = before.rows[index], b = after.rows[index];
      assert.equal(b.text, a.text, message + ': row content ' + index);
      assert.equal(b.tag, a.tag, message + ': heading/list/paragraph ' + index);
      assert.deepEqual(b.paragraph, a.paragraph, message + ': spacing/indents ' + index);
      assert(Math.abs(b.top - a.top) <= 1 && Math.abs(b.height - a.height) <= 1, message + ': vertical geometry ' + index);
      if (inline) assert.deepEqual(b.spans, a.spans, message + ': inline formatting/links ' + index);
    }
    checks.push(message + ': row order, headings, font/color/emphasis/links, paragraph spacing and vertical gaps preserved');
  }
  const before = await snapshot();
  report.before = before;
  await select('Monday:', 'Sunday: 10:15 AM');
  await bullets();
  const after = await snapshot();
  report.after = after;
  equalSpacing(before, after, 'Text-node endpoint selection');
  await page.screenshot({ path: path.join(output, 'schedule-preserved.png') });
  check(await editor.locator('p').filter({ hasText: /^• Monday:/ }).count() === 1 && await editor.locator('p').filter({ hasText: /^• Sunday:/ }).count() === 1, 'Each selected day receives one bullet at its original line start');
  check((await editor.locator('h2').textContent()) === 'Mass Schedule' && (await editor.locator('h3').textContent()) === 'Confessions', 'Unselected headings remain unchanged');
  const applied = await readConfig();
  const blankRun = applied.pages[0].blocks[0].props.bodyRich.find(run => run.text === '' && run.spaceBefore === 23);
  check(blankRun?.font === 'Arial' && blankRun.size === 18 && /^(#17334b|rgb\(23,\s*51,\s*75\))$/i.test(blankRun.color), 'Empty paragraph retains its stored font, size and color');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal((await readConfig()).pages[0].blocks[0].props.bodyRich.some(run => run.text.startsWith('• Monday:')), false);
  check((await snapshot()).html === before.html, 'One Undo restores the complete original paragraph layout');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  equalSpacing(before, await snapshot(), 'Redo');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await select('Tuesday:', 'Friday: 12:15 PM', 3, 6);
  await bullets();
  check(await editor.locator('p').filter({ hasText: /^• Tuesday:/ }).count() === 1 && await editor.locator('p').filter({ hasText: /^• Friday:/ }).count() === 1, 'Partial-word endpoints bullet whole selected logical lines');
  check(await editor.locator('p').filter({ hasText: /^Monday:/ }).count() === 1 && await editor.locator('p').filter({ hasText: /^Sunday:/ }).count() === 1, 'Partial selection leaves outside paragraphs unchanged');
  equalSpacing(before, await snapshot(), 'Partial selection');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await select('Monday:', 'Wednesday through', 0, 0);
  await bullets();
  check(await editor.locator('p').filter({ hasText: /^Wednesday through/ }).count() === 1, 'Selection ending at the next paragraph start excludes that paragraph');
  equalSpacing(before, await snapshot(), 'Paragraph-boundary selection');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await select('Mass Schedule', '• A previously marked line.');
  await bullets();
  equalSpacing(before, await snapshot(), 'Whole-box selection including formatted headings');
  check((await editor.locator('h2').textContent()) === '• Mass Schedule' && (await editor.locator('h3').textContent()) === '• Confessions', 'Selected headings receive bullets without changing heading formatting');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  const noOpConfig = JSON.stringify(await readConfig());
  await select('Existing listed paragraph', '• A previously marked line.');
  await bullets();
  check((await editor.locator('li').textContent()) === 'Existing listed paragraph' && (await editor.locator('p').filter({ hasText: 'previously marked' }).textContent()) === '• A previously marked line.', 'Existing list markers and literal bullets are not duplicated');
  check(JSON.stringify(await readConfig()) === noOpConfig, 'Already-bulleted selection is a model-preserving no-op');
  await importProject(applied, '-reopened');
  await editor.waitFor();
  equalSpacing(before, await snapshot(), 'Portable-project reopen');
  check(JSON.stringify(await readConfig()) === JSON.stringify(applied), 'Portable project retains exact formatted data');
  await page.getByRole('button', { name: 'Toggle preview mode', exact: true }).click();
  const preview = page.getByRole('region', { name: /^Site preview,/ }).locator('[data-rich-text]').filter({ hasText: 'Mass Schedule' }).first();
  await preview.waitFor();
  const previewState = await snapshot(preview);
  check(previewState.rows.length === before.rows.length && previewState.rows.map(row => row.text).join('\n') === before.rows.map(row => row.text).join('\n'), 'Preview preserves paragraph boundaries and wording');
  await page.getByRole('button', { name: 'Toggle preview mode', exact: true }).click();
  await editor.waitFor();
  const { exportSiteToHTML } = await server.ssrLoadModule('/src/lib/export-html.ts');
  if (nativeExe) exportBrowser = await chromium.launch({ executablePath: process.env.WEBSTUDIO_EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const exported = await (exportBrowser || browser).newPage();
  for (const width of [1280, 800, 390]) {
    await exported.setViewportSize({ width, height: 1000 });
    await exported.setContent(exportSiteToHTML(applied));
    const rich = exported.locator('[data-rich-text]').filter({ hasText: 'Mass Schedule' }).first();
    const state = await snapshot(rich);
    check(state.rows.length === before.rows.length && state.rows.map(row => row.text).join('\n') === before.rows.map(row => row.text).join('\n'), 'Export preserves paragraphs and blank rows at ' + width + 'px');
    for (let index = 0; index < state.rows.length; index++) assert.deepEqual(state.rows[index].paragraph, before.rows[index].paragraph, 'Export paragraph style at ' + width + 'px row ' + index);
  }
  await exported.close();
  const newlineRuns = [{ ...style, text: '  Line one\n  Line two\n\n\tLine four', line: 1 }];
  await importProject(config(newlineRuns), '-newlines');
  await editor.waitFor();
  const newlineBefore = await snapshot();
  await select('Line one', 'Line four');
  await bullets();
  equalSpacing(newlineBefore, await snapshot(), 'Embedded newline selection');
  check((await editor.textContent()) === '  • Line one\n  • Line two\n\n\t• Line four', 'Embedded newlines, blank lines and leading spaces/tabs are retained');
  await editor.evaluate(element => {
    element.innerHTML = '<p style="line-height:1.7;margin-top:8px;margin-bottom:13px;margin-left:12px;margin-right:16px;text-indent:0px;text-align:left">Break one<br><b>Break two</b><br><br><a href="/visit">Break four</a></p>';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await select('Break one', 'Break four');
  await bullets();
  check((await editor.textContent()) === '• Break one\n• Break two\n\n• Break four', 'BR-separated lines retain every break and blank line');
  check(await editor.locator('a[href="/visit"]').count() === 1, 'BR conversion preserves the safe link');
  await editor.evaluate(element => {
    element.innerHTML = '<div><span style="display:block;text-align:left;line-height:1.7;margin-top:8px;margin-bottom:13px;margin-left:12px;margin-right:16px;text-indent:0px">Span one</span><p style="line-height:1.8;margin-top:23px;margin-bottom:7px"></p><span style="display:block;text-align:left;line-height:1.9;margin-top:11px;margin-bottom:17px;margin-left:12px;margin-right:16px;text-indent:0px"><b>Span two</b></span><span style="display:block;text-align:left;line-height:1.7;margin-top:8px;margin-bottom:13px;margin-left:12px;margin-right:16px;text-indent:0px"><a href="/visit">Span three</a></span></div>';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const spansBefore = await snapshot();
  report.cssBefore = spansBefore;
  await select('Span one', 'Span three');
  await bullets();
  const spansAfter = await snapshot();
  report.cssAfter = spansAfter;
  equalSpacing(spansBefore, spansAfter, 'CSS block spans and truly empty paragraph', false);
  check(await editor.locator('p').filter({ hasText: /^$/ }).count() === 1, 'A truly empty styled paragraph is retained without a bullet');
  check((await editor.locator('a[href="/visit"]').textContent()) === '• Span three', 'A line beginning with a link keeps its link and gets one bullet');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  check((await editor.textContent()) === 'Span oneSpan twoSpan three', 'One Undo removes bullets while keeping pending typed content');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  equalSpacing(spansBefore, await snapshot(), 'Pending-typing Redo', false);
  await editor.evaluate(element => {
    element.innerHTML = ['h1', 'h4', 'h5', 'h6'].map((tag, index) => '<' + tag + ' style="font-family:Arial;font-size:20px;font-weight:bold;color:#17334b;text-align:left;line-height:1.4;margin-top:8px;margin-bottom:13px;margin-left:12px;margin-right:16px;text-indent:0px">Source heading ' + (index + 1) + '</' + tag + '>').join('');
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const headingSnapshot = () => editor.evaluate(element => {
    const top = element.getBoundingClientRect().top;
    const rows = Array.from(element.querySelectorAll('h1,h4,h5,h6,p,span[style*="display:block"],span[style*="display: block"]'));
    return rows.map(row => {
      const leaf = row.querySelector('[data-rich-run]') || row;
      const style = getComputedStyle(leaf), block = getComputedStyle(row), bounds = row.getBoundingClientRect();
      return { text: row.textContent.replace(/•\s?/g, ''), top: bounds.top - top, height: bounds.height, font: style.fontFamily, size: style.fontSize, weight: style.fontWeight, color: style.color, lineHeight: style.lineHeight, spaceBefore: block.marginTop, spaceAfter: block.marginBottom, left: block.marginLeft, right: block.marginRight };
    });
  });
  const headingsBefore = await headingSnapshot();
  report.headingsBefore = headingsBefore;
  await select('Source heading 1', 'Source heading 4');
  await bullets();
  const headingsAfter = await headingSnapshot();
  report.headingsAfter = headingsAfter;
  check(headingsAfter.length === 4, 'Source-pasted H1/H4/H5/H6 each retain a separate logical line');
  assert.deepEqual(headingsAfter, headingsBefore, 'Source headings preserve visible fonts, line height, paragraph gaps and row geometry');
  checks.push('Source-pasted heading appearance and line spacing are preserved');
  check(errors.length === 0, 'No browser runtime errors');
  await page.screenshot({ path: path.join(output, 'bullets-preserved.png') });
  report.passed = true;
  console.log('PASS ' + label + ': ' + checks.length + ' bullet layout, spacing and persistence checks.');
} catch (error) {
  report.failure = error.stack || String(error);
  await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  if (child?.pid && child.exitCode === null) spawnSync(path.join(process.env.SystemRoot || 'C:/Windows', 'System32/taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  await browser?.close().catch(() => {});
  await exportBrowser?.close().catch(() => {});
  await server?.close();
  if (nativeExe) {
    assert(profile.startsWith(output + path.sep));
    await rm(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 150 }).catch(error => { report.profileCleanupError = error.message; });
  }
  await writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2));
}
