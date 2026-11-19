import { beforeEach, describe, expect, it, vi } from 'vitest'
import { planPageAddressChange, visitBlockLinks } from '../src/project/page-links'

const storage = new Map<string, string>()
vi.stubGlobal('window', { localStorage: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
} })
const { useConfigStore } = await import('../src/store/configStore')

beforeEach(() => {
  const homeBlocks = [
    { id: 'nav', type: 'navbar', variant: 'default', props: { navItems: [
      { label: 'About', url: '/about', children: [{ label: 'History', url: '/about/history#beginnings' }] },
    ] } },
    { id: 'welcome', type: 'hero', variant: 'minimal', props: { headline: 'Welcome', primaryCta: 'Visit', primaryCtaUrl: '/about?from=home#visit' } },
    { id: 'text', type: 'content', variant: 'prose', props: {
      body: '[About](/about) [History](/about/history#beginnings) [External](https://example.test/about)',
      bodyRich: [{ text: 'About', href: '/about#details', bold: true }],
      section1Objects: [{ id: 'object', type: 'image', url: '/about?photo=1' }],
    } },
    { id: 'photo', type: 'image', variant: 'full', props: { src: '', imageLink: '/about' } },
  ]
  useConfigStore.getState().setConfig({ name: 'Community example', extension: { retained: true }, blocks: homeBlocks, pages: [
    { id: 'home', name: 'Home', path: '/', blocks: homeBlocks },
    { id: 'about', name: 'About', path: '/about', blocks: [{ id: 'about-content', type: 'content', variant: 'prose', props: { body: 'Original content', textColor: '#000000' } }], webstudioCustomCode: { html: '<a href="/about">Custom</a>', css: '', js: '' } },
    { id: 'history', name: 'History', path: '/about/history', blocks: [] },
    { id: 'unrelated', name: 'Aboutness', path: '/aboutness', blocks: [] },
  ], webstudioReusableSections: [{ id: 'saved', name: 'Saved footer', block: { id: 'saved-footer', type: 'footer', variant: 'simple', props: { navItems: [{ label: 'About', url: '/about' }] } } }] })
  useConfigStore.getState().setActivePage('about')
})

describe('page settings transactions', () => {
  it('updates name and address together, preserves content, and restores every link with one Undo', () => {
    const before = structuredClone(useConfigStore.getState().config)
    useConfigStore.getState().updatePageSettings('about', 'About our community', ' about-us ', true)
    const state = useConfigStore.getState()
    expect(state.undoStack).toHaveLength(1)
    expect(state.config.pages?.find(page => page.id === 'about')).toMatchObject({ name: 'About our community', path: '/about-us', blocks: before.pages![1].blocks, webstudioCustomCode: before.pages![1].webstudioCustomCode })
    expect(state.config.pages?.find(page => page.id === 'history')?.path).toBe('/about/history')
    const urls: string[] = []
    for (const block of state.config.pages![0].blocks) visitBlockLinks(block, destination => { urls.push(destination) })
    expect(urls).toContain('/about-us?from=home#visit')
    expect(urls).toContain('/about-us#details')
    expect(urls).toContain('/about-us?photo=1')
    expect(urls).toContain('/about/history#beginnings')
    expect(urls).toContain('https://example.test/about')
    expect(urls).not.toContain('/about')
    expect(state.config.webstudioReusableSections?.[0].block.props.navItems).toEqual([{ label: 'About', url: '/about-us' }])
    state.undo()
    expect(useConfigStore.getState().config).toEqual(before)
    expect(useConfigStore.getState().activePageId).toBe('about')
    useConfigStore.getState().redo()
    expect(useConfigStore.getState().config.pages![1].path).toBe('/about-us')
    expect((useConfigStore.getState().config.extension as { retained: boolean }).retained).toBe(true)
  })

  it('moves child addresses only when requested and updates their anchored links in the same transaction', () => {
    const before = structuredClone(useConfigStore.getState().config)
    const plan = planPageAddressChange(before, 'about', '/about-us', true)
    expect(plan).toEqual([{ pageId: 'about', from: '/about', to: '/about-us' }, { pageId: 'history', from: '/about/history', to: '/about-us/history' }])
    expect(useConfigStore.getState().config).toEqual(before)
    useConfigStore.getState().updatePageSettings('about', 'About', '/about-us', true, true)
    expect(useConfigStore.getState().config.pages![2].path).toBe('/about-us/history')
    expect(useConfigStore.getState().config.pages![3].path).toBe('/aboutness')
    expect(JSON.stringify(useConfigStore.getState().config.pages![0])).toContain('/about-us/history#beginnings')
    useConfigStore.getState().undo()
    expect(useConfigStore.getState().config).toEqual(before)
  })

  it('rejects child collisions without changing content, selection or Undo history', () => {
    const original = useConfigStore.getState().config
    useConfigStore.getState().setConfig({ ...original, pages: [...original.pages!, { id: 'collision', name: 'Existing', path: '/about-us/history', blocks: [] }] })
    const before = structuredClone(useConfigStore.getState().config)
    const selected = useConfigStore.getState().activePageId
    expect(() => useConfigStore.getState().updatePageSettings('about', 'Updated', '/about-us', true, true)).toThrow('Duplicate page path')
    expect(useConfigStore.getState().config).toEqual(before)
    expect(useConfigStore.getState().activePageId).toBe(selected)
    expect(useConfigStore.getState().undoStack).toHaveLength(0)
  })

  it('supports a name-only Home change but protects its address and rejects empty, duplicate and unsafe settings', () => {
    useConfigStore.getState().updatePageSettings('home', 'Start', '/')
    expect(useConfigStore.getState().config.pages![0].name).toBe('Start')
    useConfigStore.getState().undo()
    const before = structuredClone(useConfigStore.getState().config)
    for (const address of ['', '/about/history', '//host.test', '/../escape', '/with spaces', '/CON', 'https://example.test']) {
      expect(() => useConfigStore.getState().updatePageSettings('about', 'About', address)).toThrow()
    }
    expect(() => useConfigStore.getState().updatePageSettings('home', 'Start', '/start')).toThrow('Home')
    expect(() => useConfigStore.getState().updatePageSettings('about', ' ', '/about-us')).toThrow('Page name')
    expect(useConfigStore.getState().config).toEqual(before)
    expect(useConfigStore.getState().undoStack).toHaveLength(0)
  })

  it('keeps old destinations when link updates are explicitly cleared and makes no history for a no-op', () => {
    useConfigStore.getState().updatePageSettings('about', 'About', '/about')
    expect(useConfigStore.getState().undoStack).toHaveLength(0)
    useConfigStore.getState().updatePageSettings('about', 'About', '/about-us', false)
    expect(useConfigStore.getState().config.pages![0].blocks[1].props.primaryCtaUrl).toBe('/about?from=home#visit')
  })
})
