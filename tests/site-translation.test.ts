import { runInNewContext } from 'node:vm'
import JSZip from 'jszip'
import { describe, expect, it, vi } from 'vitest'
import { exportSiteToHTML, exportSiteZip, type ExportSiteSettings } from '../src/lib/export-html'
import translationScript from '../src/lib/translation-selector.js?raw'
import type { SiteConfig } from '../src/blocks/types'
import { connectCalendar } from '../src/blocks/calendar/calendar-view.js'

const site: SiteConfig = {
  name: 'Community website', blocks: [], pages: [
    { id: 'home', name: 'Home', path: '/', blocks: [] },
    { id: 'visit', name: 'Visit', path: '/community/visit', blocks: [] },
    { id: 'news', name: 'News', path: '/news', blocks: [], webstudioArticle: { status: 'ready', author: '', summary: 'News', createdAt: '', modifiedAt: '' } },
  ],
}

describe('optional website translation', () => {
  it('keeps existing projects free of translation resources until explicitly enabled', async () => {
    for (const value of [undefined, false, 'true']) {
      const settings = { websiteTranslation: value } as ExportSiteSettings
      expect(exportSiteToHTML(site, { settings })).not.toContain('gtranslate')
      const zip = await JSZip.loadAsync(await (await exportSiteZip(site, { settings })).arrayBuffer())
      expect(zip.file('assets/translation-selector.js')).toBeNull()
    }
  })

  it('uses the original site language, the Atlas 35-language preset and a standalone helper', () => {
    const html = exportSiteToHTML(site, { settings: { websiteTranslation: true, language: 'Spanish' } })
    const settings = JSON.parse(html.match(/window\.gtranslateSettings=(\{[^<]+\});<\/script>/)![1])
    expect(settings.default_language).toBe('es')
    expect(settings.languages).toHaveLength(35)
    expect(settings.languages).toContain('zh-TW')
    expect(settings.languages).toContain('tl')
    expect(settings.detect_browser_language).toBe(true)
    expect(settings.native_language_names).toBe(true)
    expect(settings.switcher_horizontal_position).toBe('right')
    expect(settings.alt_flags).toEqual({ he: 'https://cdn.gtranslate.net/flags/svg/iw.svg' })
    expect(html).toContain('class="gtranslate_wrapper notranslate" translate="no"')
    expect(html.match(/src="https:\/\/cdn\.gtranslate\.net\/widgets\/latest\/float\.js"/g)).toHaveLength(1)
    expect(html).toContain(translationScript)
    expect(html).toContain('.gtranslate_wrapper .gt_float_switcher .gt_options.gt-open { display: block !important; }')
    expect(html).not.toMatch(/\.gt_options\s*\{[^}]*display:\s*block/)
    expect(html).not.toContain('docs/Help')
    expect(html).not.toContain('src="assets/translation-selector.js"')
  })

  it('exports one local helper and correct references on root, nested and generated pages', async () => {
    const zip = await JSZip.loadAsync(await (await exportSiteZip(site, { settings: { websiteTranslation: true, siteSearch: 'on' } })).arrayBuffer())
    expect(await zip.file('assets/translation-selector.js')!.async('string')).toBe(translationScript)
    expect(Object.keys(zip.files).filter(path => path.endsWith('translation-selector.js'))).toEqual(['assets/translation-selector.js'])
    for (const [path, prefix] of [['index.html', ''], ['community/visit.html', '../'], ['news.html', ''], ['articles/index.html', '../'], ['search.html', '']]) {
      const html = await zip.file(path)!.async('string')
      expect(html).toContain(`src="${prefix}assets/translation-selector.js"`)
      expect(html.match(/data-ws-translation-vendor/g)).toHaveLength(1)
      expect(html.match(/data-ws-translation-helper/g)).toHaveLength(1)
      expect(html.match(/class="gtranslate_wrapper notranslate"/g)).toHaveLength(1)
    }
  })

  it('rejects a media reference that would overwrite the translation runtime', async () => {
    const config = structuredClone(site)
    config.pages![0].blocks.push({ id: 'download', type: 'content', variant: 'prose', props: { body: '[File](assets/translation-selector.js)' } })
    await expect(exportSiteZip(config, { settings: { websiteTranslation: true } })).rejects.toThrow('reserved website translation asset path')
  })
})

function languageWidget(cookie = '') {
  type WidgetEvent = { type: string; target: unknown; stopImmediatePropagation: () => void }
  const captureHandlers = new Map<string, (event: WidgetEvent) => void>()
  const links = [['es', 'Español'], ['en', 'English'], ['ar', 'العربية']].map(([code, native]) => ({
    dataset: { gtLang: code } as Record<string, string>,
    textContent: native,
    attributes: {} as Record<string, string>,
    querySelector: () => null,
    matches: () => true,
    setAttribute(key: string, value: string) { this.attributes[key] = value },
    replaceChildren(...children: { textContent: string }[]) { this.textContent = children.map(child => child.textContent).join('') },
  }))
  const list = { children: links.slice(), appendChild(link: typeof links[number]) { this.children = this.children.filter(item => item !== link).concat(link) } }
  let selected: typeof links[number] | null = null
  let update: () => void = () => {}
  const wrapper = {
    querySelector: () => selected,
    querySelectorAll: (selector: string) => selector === '.gt_options' ? [list] : links,
    addEventListener: vi.fn((name: string, handler: (event: WidgetEvent) => void, capture?: boolean) => { if (capture) captureHandlers.set(name, handler) }),
    dispatchEvent: vi.fn(),
  }
  const document = { readyState: 'complete', cookie, documentElement: { lang: 'en', dir: '', dataset: {} as Record<string, string> }, querySelector: () => wrapper, createTextNode: (textContent: string) => ({ textContent }) }
  const window = { gtranslateSettings: { default_language: 'en' }, setTimeout: vi.fn(), dispatchEvent: vi.fn() }
  const observe = vi.fn()
  class Observer { constructor(callback: () => void) { update = callback } observe = observe }
  const context = { window, document, Intl, Set, Event, MutationObserver: Observer }
  runInNewContext(translationScript, context)
  return { context, document, wrapper, list, observe, captureHandlers, update: () => update(), select: (code: string) => { selected = links.find(link => link.dataset.gtLang === code) ?? null } }
}

describe('website language selector behavior', () => {
  it('labels and alphabetizes asynchronously supplied languages without duplicating initialization', () => {
    const widget = languageWidget()
    expect(widget.list.children.map(link => link.textContent)).toEqual(['Arabic (العربية)', 'English', 'Spanish (Español)'])
    expect(widget.list.children[0].attributes['aria-label']).toBe('Arabic (العربية)')
    widget.update()
    expect(widget.list.children.map(link => link.textContent)).toEqual(['Arabic (العربية)', 'English', 'Spanish (Español)'])
    runInNewContext(translationScript, widget.context)
    expect(widget.observe).toHaveBeenCalledTimes(1)
    expect(widget.wrapper.dispatchEvent).not.toHaveBeenCalled()
    expect(widget.context.window.dispatchEvent).toHaveBeenCalledTimes(1)
  })

  it('restores saved right-to-left direction and changes back with the selected language', () => {
    const widget = languageWidget('googtrans=/en/ar')
    expect(widget.document.documentElement.dir).toBe('rtl')
    expect(widget.document.documentElement.dataset.translationLanguage).toBe('ar')
    widget.select('es')
    widget.update()
    expect(widget.document.documentElement.dir).toBe('ltr')
    expect(widget.document.documentElement.dataset.translationLanguage).toBe('es')
    expect(widget.context.window.dispatchEvent).toHaveBeenCalledTimes(2)
    widget.update()
    expect(widget.context.window.dispatchEvent).toHaveBeenCalledTimes(2)
  })

  it('ignores malformed saved language cookies', () => {
    const widget = languageWidget('googtrans=/en/%E0%A4%A')
    expect(widget.document.documentElement.dir).toBe('ltr')
    expect(widget.document.documentElement.dataset.translationLanguage).toBe('en')
  })

  it('skips only redundant vendor library requests while retaining first-load and inner entry events', () => {
    const widget = languageWidget()
    const focus = { type: 'focusin', target: {}, stopImmediatePropagation: vi.fn() }
    const entry = { type: 'pointerenter', target: widget.wrapper, stopImmediatePropagation: vi.fn() }
    widget.captureHandlers.get('focusin')!(focus)
    widget.captureHandlers.get('pointerenter')!(entry)
    expect(focus.stopImmediatePropagation).not.toHaveBeenCalled()
    expect(entry.stopImmediatePropagation).not.toHaveBeenCalled()
    Object.assign(widget.context.window, { gt_translate_script: {} })
    widget.captureHandlers.get('focusin')!(focus)
    widget.captureHandlers.get('pointerenter')!(entry)
    expect(focus.stopImmediatePropagation).toHaveBeenCalledTimes(1)
    expect(entry.stopImmediatePropagation).toHaveBeenCalledTimes(1)
    const innerEntry = { type: 'pointerenter', target: {}, stopImmediatePropagation: vi.fn() }
    widget.captureHandlers.get('pointerenter')!(innerEntry)
    expect(innerEntry.stopImmediatePropagation).not.toHaveBeenCalled()
    expect([...widget.captureHandlers.keys()]).toEqual(['focusin', 'pointerenter'])
  })
})

describe('calendar translation compatibility', () => {
  it('preserves translated nested wording while still refreshing changed event dates and event lists', () => {
    type Change = { type: string; target: unknown; attributeName?: string }
    let changed: (changes: Change[]) => void = () => {}
    const disconnect = vi.fn()
    class Observer {
      constructor(callback: (changes: Change[]) => void) { changed = callback }
      observe = vi.fn()
      disconnect = disconnect
    }
    vi.stubGlobal('MutationObserver', Observer)
    vi.stubGlobal('document', { documentElement: { dataset: { translationLanguage: '' } } })
    const languageListeners = new Map<string, () => void>()
    vi.stubGlobal('window', { addEventListener: (name: string, listener: () => void) => languageListeners.set(name, listener), removeEventListener: (name: string) => languageListeners.delete(name) })
    let step: (event: { target: { closest: () => { dataset: { wsCalendarStep: string } } } }) => void = () => {}
    const month = { hidden: true, addEventListener: (_name: string, listener: typeof step) => { step = listener }, removeEventListener: vi.fn() }
    const label = { textContent: '' }
    const days = { replaceChildren: vi.fn(), insertRow: () => ({ insertCell: () => ({ dataset: {}, textContent: '', setAttribute: vi.fn() }) }) }
    const event = { dataset: { wsEventDate: '2026-11-15' }, hidden: false }
    const agenda = { children: [event] }
    const empty = { hidden: false }
    const elements = { '[data-ws-calendar-month]': month, '[data-ws-calendar-label]': label, '[data-ws-calendar-days]': days, '[data-ws-calendar-events]': agenda, '[data-ws-calendar-empty]': empty }
    try {
      const dispose = connectCalendar({ querySelector: (selector: keyof typeof elements) => elements[selector] })
      expect(days.replaceChildren).toHaveBeenCalledTimes(1)
      label.textContent = 'noviembre de 2026'
      changed([{ type: 'childList', target: event }])
      expect(label.textContent).toBe('noviembre de 2026')
      expect(days.replaceChildren).toHaveBeenCalledTimes(1)
      changed([{ type: 'childList', target: agenda }])
      expect(days.replaceChildren).toHaveBeenCalledTimes(2)
      changed([{ type: 'attributes', target: event, attributeName: 'data-ws-event-date' }])
      expect(days.replaceChildren).toHaveBeenCalledTimes(3)
      document.documentElement.dataset.translationLanguage = 'es'
      changed([{ type: 'childList', target: agenda }])
      expect(label.textContent).toBe(new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(new Date()))
      step({ target: { closest: () => ({ dataset: { wsCalendarStep: '1' } }) } })
      const advanced = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
      expect(label.textContent).toBe(new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(advanced))
      document.documentElement.dataset.translationLanguage = 'en'
      languageListeners.get('webstudio.translationchange')!()
      expect(label.textContent).toBe(new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(advanced))
      document.documentElement.dataset.translationLanguage = 'invalid_language'
      changed([{ type: 'childList', target: agenda }])
      expect(label.textContent).toBe(new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(advanced))
      dispose()
      expect(disconnect).toHaveBeenCalledTimes(1)
      expect(languageListeners.size).toBe(0)
    } finally { vi.unstubAllGlobals() }
  })
})
