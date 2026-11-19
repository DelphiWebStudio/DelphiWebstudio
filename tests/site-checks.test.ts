import { describe, expect, it } from 'vitest'
import { checkSite, checkSiteReadability, siteExternalLinks, textContrastRatio } from '../src/project/site-checks'
import type { BlockConfig, SiteConfig } from '../src/blocks/types'
import { exportSiteToHTML } from '../src/lib/export-html'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { FooterBlock } from '../src/blocks/footer/FooterBlock'
import { ImageBlock } from '../src/blocks/image/ImageBlock'

const hero: BlockConfig = { id: 'hero', type: 'hero', variant: 'minimal', props: { headline: 'Welcome', primaryCta: 'News', primaryCtaUrl: '/news?source=home#top' } }
const config: SiteConfig = { name: 'Community', pages: [
  { id: 'home', name: 'Home', path: '/', blocks: [hero] },
  { id: 'news', name: 'News', path: '/news', blocks: [{ id: 'news-section', type: 'content', variant: 'prose', props: { anchorName: 'headlines' } }] },
], blocks: [hero] }

describe('readability and external link review', () => {
  const withBlock = (props: Record<string, unknown>, type: BlockConfig['type'] = 'content') => {
    const block: BlockConfig = { id: 'review', type, variant: type === 'content' ? 'prose' : 'minimal', props }
    return { name: 'Review', blocks: [block], pages: [{ id: 'review-page', name: 'Review', path: '/', blocks: [block] }] } satisfies SiteConfig
  }

  it('uses relative luminance and accepts only editor-supported opaque colors', () => {
    expect(textContrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 7)
    expect(textContrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 7)
    expect(textContrastRatio('#333333', '#333333')).toBe(1)
    for (const color of ['transparent', '#fff', '#ffffff88', 'rgba(0,0,0,.5)', 'linear-gradient(white,black)', undefined]) {
      expect(textContrastRatio(color, '#ffffff')).toBeNull()
    }
  })

  it('checks actual declared size without rounding a failing ratio up to a pass', () => {
    expect(checkSiteReadability(withBlock({ body: 'Normal-size information', textColor: '#777777', blockBackgroundColor: '#ffffff', textSize: 16 }))[0].message).toContain('minimum for this text size is 4.5:1')
    expect(checkSiteReadability(withBlock({ body: 'Normal-size information', textColor: '#767676', blockBackgroundColor: '#ffffff', textSize: 16 }))).toEqual([])
    expect(checkSiteReadability(withBlock({ body: 'Large information', textColor: '#888888', blockBackgroundColor: '#ffffff', textSize: 24 }))).toEqual([])
    expect(checkSiteReadability(withBlock({ body: 'Large information', textColor: '#aaaaaa', blockBackgroundColor: '#ffffff', textSize: 24 }))[0].message).toContain('minimum for this text size is 3:1')
    expect(checkSiteReadability(withBlock({ headline: 'Heading weight needs review', textColor: '#888888', blockBackgroundColor: '#ffffff', textSize: 22 }, 'hero'))[0].message).toContain('Check the actual weight')
    const button = withBlock({ headline: 'Large heading', textSize: 32, primaryCta: 'Read more', primaryCtaUrl: '/news', buttonTextColor: '#888888', buttonBackgroundColor: '#ffffff' }, 'hero')
    expect(checkSiteReadability(button)[0].message).toContain('Normal-size text needs 4.5:1')
  })

  it('labels an unknown size as a review and avoids guesses over photos or overridden styles', () => {
    expect(checkSiteReadability(withBlock({ body: 'Information', textColor: '#888888', blockBackgroundColor: '#ffffff' }))[0].message).toContain('check the actual size and weight')
    const colored = { headline: 'Photographic banner', textColor: '#888888', blockBackgroundColor: '#ffffff', heroImage: 'assets/photo.jpg' }
    expect(checkSiteReadability(withBlock(colored, 'hero'))).toEqual([])
    expect(checkSiteReadability(withBlock({ ...colored, heroImage: '', bodyRich: [{ text: 'Black wording', color: '#000000' }] }))).toEqual([])
    expect(checkSiteReadability(withBlock({ body: 'A bold passage', bodyRich: [{ text: 'A bold passage', bold: true }], textColor: '#888888', blockBackgroundColor: '#ffffff', textSize: 22 }))).toEqual([])
    expect(checkSiteReadability(withBlock({ body: 'Inherited colors', textColor: '#eeeeee' }))).toEqual([])
    expect(checkSiteReadability(withBlock({ body: 'Overrides', textColor: '#ffffff', blockBackgroundColor: '#ffffff', textAdjustments: { 'p-0': { color: '#000000' } } }))).toEqual([])
    expect(checkSiteReadability(withBlock({ body: 'Photographic layer', textColor: '#ffffff', blockBackgroundColor: '#ffffff', section1Objects: [{ id: 'photo', type: 'image', src: 'assets/photo.jpg' }, { id: 'caption', type: 'text', text: 'On the photograph', textColor: '#ffffff' }] }))).toEqual([])
  })

  it('points a failing section button to its object and preserves the project unchanged', () => {
    const source = withBlock({ sectionCount: 2, section2Objects: [{ id: 'button-2', type: 'button', text: 'Read more', url: '/news', textColor: '#aaaaaa', backgroundColor: '#ffffff', fontSize: 16 }] })
    const before = structuredClone(source)
    expect(checkSiteReadability(source)).toEqual([expect.objectContaining({ pageId: 'review-page', blockId: 'review', section: 2, objectId: 'button-2', message: expect.stringContaining('Section 2 button contrast') })])
    expect(source).toEqual(before)
  })

  it('checks text on a parent panel while skipping draft pages and custom stylesheet overrides', () => {
    const source: SiteConfig = withBlock({ section1Objects: [
      { id: 'panel', type: 'panel', color: '#ffffff' },
      { id: 'text', type: 'text', text: 'Panel wording', parentId: 'panel', textColor: '#eeeeee', fontSize: 18 },
    ] })
    expect(checkSiteReadability(source)).toHaveLength(1)
    source.pages![0].webstudioCustomCode = { html: '', css: 'p { color:black }', js: '' }
    expect(checkSiteReadability(source)).toEqual([])
    delete source.pages![0].webstudioCustomCode
    source.pages!.push({ ...structuredClone(source.pages![0]), id: 'draft-page', path: '/draft', webstudioArticle: { status: 'draft', author: '', summary: '', createdAt: '', modifiedAt: '' } })
    source.pages![0].blocks = []
    source.blocks = []
    expect(checkSiteReadability(source)).toEqual([])
  })

  it('deduplicates web destinations while retaining every affected page and object', () => {
    const source = structuredClone(config)
    source.pages![0].blocks[0].props.primaryCtaUrl = 'https://example.test/visit#schedule'
    source.pages![1].blocks.push({ id: 'text', type: 'content', variant: 'prose', props: { body: '[Visit](https://example.test/visit#directions) [Email](mailto:office@nowhere.com)' } })
    source.blocks = source.pages![0].blocks
    const before = structuredClone(source)
    const links = siteExternalLinks(source)
    expect(links).toHaveLength(1)
    expect(links[0].url).toBe('https://example.test/visit')
    expect(links[0].locations).toEqual([expect.objectContaining({ pageId: 'home', blockId: 'hero' }), expect.objectContaining({ pageId: 'news', blockId: 'text' })])
    expect(source).toEqual(before)
  })

  it('does not offer credentials, malformed web addresses, non-web protocols or draft-only links to the network check', () => {
    const source: SiteConfig = withBlock({ body: '[Private](https://user:secret@example.test/private) [Bad](https://) [Phone](tel:123) [Internal](/news)' })
    expect(siteExternalLinks(source)).toEqual([])
    const messages = checkSite(source).map(issue => issue.message)
    expect(messages).toContain('Private: remove the username or password from this link address.')
    expect(messages).toContain('Bad: this web address is not valid.')
    source.pages![0].blocks[0].props.body = '[Visit](https://example.test/visit)'
    source.pages!.push({ ...structuredClone(source.pages![0]), id: 'draft-page', path: '/draft', webstudioArticle: { status: 'draft', author: '', summary: '', createdAt: '', modifiedAt: '' } })
    source.pages![0].blocks = []
    source.blocks = []
    expect(siteExternalLinks(source)).toEqual([])
  })
})

describe('local site checks', () => {
  it('reports duplicate anchors, missing placed-image descriptions, and heading gaps', () => {
    const copy = structuredClone(config)
    const content: BlockConfig = { id: 'content', type: 'content', variant: 'prose', props: {
      body: '### Skipped heading', anchorName: 'repeat',
      section1Objects: [{ id: 'photo', type: 'image', anchorName: 'repeat', src: 'assets/photo.png' }],
    } }
    copy.pages![0].blocks.push(content)
    copy.blocks = copy.pages![0].blocks
    const messages = checkSite(copy, undefined, true).filter(issue => issue.pageId === 'home').map(issue => issue.message)
    expect(messages).toEqual(expect.arrayContaining([
      expect.stringContaining('Duplicate anchor #repeat'),
      expect.stringContaining('image without alternative text'),
      expect.stringContaining('Heading order skips from H1 to H3'),
    ]))
  })
  it('keeps footer information columns without link warnings or skipped heading levels', () => {
    const copy = structuredClone(config)
    const footer: BlockConfig = { id: 'footer', type: 'footer', variant: 'multi-column', props: {
      links: [], navItems: [{ label: 'News', url: '/news' }],
      columns: [{ title: 'Visit', links: ['123 Example Avenue', 'Example City, GA 00000'] }, { title: 'Contact', links: ['office@nowhere.com'] }],
    } }
    copy.pages![0].blocks.push(footer)
    copy.blocks = copy.pages![0].blocks
    const before = structuredClone(copy)
    expect(checkSite(copy, undefined, true).filter(issue => issue.pageId === 'home')).toEqual([])
    expect(copy).toEqual(before)
    const heading = '<h2 class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-2 @md:mb-3">Visit</h2>'
    const preview = renderToStaticMarkup(createElement(FooterBlock, { block: footer }))
    const exported = exportSiteToHTML({ name: 'Visit', blocks: copy.blocks })
    expect(preview).toContain(heading)
    expect(exported).toContain(heading)
    expect(preview).not.toContain('<h4')
    expect(exported).not.toContain('<h4')
    expect(preview).toContain('office@nowhere.com')
    expect(exported).toContain('office@nowhere.com')
  })
  it.each(['hero-image', 'grid', 'side-by-side'])('accepts an explicit image-page heading without changing the visible %s image', variant => {
    const image: BlockConfig = { id: 'banner', type: 'image', variant, props: {
      src: 'assets/events.png', alt: 'Community events', caption: '', images: [{ src: 'assets/events.png', alt: 'Community events' }],
    } }
    const page: SiteConfig = { name: 'Events', pages: [{ id: 'events', name: 'Events', path: '/', blocks: [image] }], blocks: [image] }
    expect(checkSite(page, undefined, true).some(issue => issue.message.includes('No H1 heading'))).toBe(true)
    const before = exportSiteToHTML(page)
    const previewBefore = renderToStaticMarkup(createElement(ImageBlock, { block: image }))
    image.props.pageHeading = '   '
    expect(exportSiteToHTML(page)).toBe(before)
    image.props.pageHeading = ' Community events '
    const after = exportSiteToHTML(page)
    const previewAfter = renderToStaticMarkup(createElement(ImageBlock, { block: image }))
    expect(checkSite(page, undefined, true).filter(issue => issue.message.includes('heading'))).toEqual([])
    expect(after).toContain('<h1 class="sr-only">Community events</h1>')
    expect(previewAfter).toContain('<h1 class="sr-only">Community events</h1>')
    expect(after.replace('<h1 class="sr-only">Community events</h1>', '')).toBe(before)
    expect(previewAfter.replace('<h1 class="sr-only">Community events</h1>', '')).toBe(previewBefore)
  })
  it('recognizes generated Search and Articles destinations when enabled', () => {
    const copy = structuredClone(config)
    copy.pages![1].webstudioArticle = { status: 'ready', author: '', summary: '', createdAt: '', modifiedAt: '' }
    copy.pages![0].blocks.push({ id: 'nav', type: 'navbar', variant: 'default', props: { links: [], navItems: [{ label: 'Search', url: '/search.html' }, { label: 'Articles', url: '/articles/index.html' }] } })
    copy.blocks = copy.pages![0].blocks
    const enabled = checkSite(copy, { siteSearch: 'on' })
    expect(enabled.filter(issue => issue.blockId === 'nav')).toEqual([])
    const disabled = checkSite(copy, { siteSearch: 'off' })
    expect(disabled.some(issue => issue.blockId === 'nav' && issue.message.includes('/search.html'))).toBe(true)
  })
  it('warns about online media during export review without flagging ordinary links', () => {
    const copy = structuredClone(config)
    copy.pages![0].blocks.push(
      { id: 'remote-image', type: 'image', variant: 'hero-image', props: { src: 'https://example.test/photo.jpg', alt: 'Photo' } },
      { id: 'gallery', type: 'gallery', variant: 'grid', props: { images: [{ src: '//example.test/image.png', alt: 'Image' }] } },
      { id: 'local-image', type: 'image', variant: 'hero-image', props: { src: 'assets/local.png', alt: 'Photo' } },
      { id: 'video', type: 'video', variant: 'youtube', props: { url: 'https://youtu.be/abcdefghijk' } },
    )
    copy.blocks = copy.pages![0].blocks
    const issues = checkSite(copy, { siteDescription: 'Community information' }).filter(issue => issue.message.includes('online media'))
    expect(issues.map(issue => issue.blockId)).toEqual(['remote-image', 'gallery', 'video'])
  })
  it('checks exported SEO titles and descriptions using page and site settings', () => {
    const copy = structuredClone(config)
    const issues = checkSite(copy, { seoTitle: 'Community', siteDescription: '' })
    expect(issues.filter(issue => issue.message.includes('same SEO title'))).toHaveLength(2)
    expect(issues.filter(issue => issue.message.includes('no meta description'))).toHaveLength(2)
    copy.pages![1].webstudioSeo = { title: 'News', description: 'Latest news' }
    const improved = checkSite(copy, { seoTitle: 'Community', siteDescription: 'Community information' })
    expect(improved.filter(issue => issue.message.includes('SEO title') || issue.message.includes('meta description'))).toEqual([])
    copy.pages![1].webstudioArticle = { status: 'draft', author: '', summary: '', createdAt: '', modifiedAt: '' }
    const draftExcluded = checkSite(copy, { seoTitle: 'Community', siteDescription: '' })
    expect(draftExcluded.filter(issue => issue.message.includes('no meta description'))).toHaveLength(1)
  })
  it('recognizes an HTTPS contact service and rejects an unsafe configured service', () => {
    const copy = structuredClone(config)
    copy.pages![0].blocks.push({ id: 'contact-service', type: 'contact', variant: 'form', props: { formEndpoint: 'https://forms.example.test/submit', consentNotice: 'I agree to the privacy notice.' } })
    copy.blocks = copy.pages![0].blocks
    expect(checkSite(copy).some(issue => issue.blockId === 'contact-service')).toBe(false)
    copy.pages![0].blocks.at(-1)!.props.consentNotice = ''
    expect(checkSite(copy).some(issue => issue.blockId === 'contact-service' && issue.message.includes('privacy and consent'))).toBe(true)
    copy.pages![0].blocks.at(-1)!.props.formEndpoint = 'http://forms.example.test/submit'
    expect(checkSite(copy).some(issue => issue.blockId === 'contact-service' && issue.message.includes('disabled'))).toBe(true)
    copy.pages![0].blocks.at(-1)!.props.formEndpoint = 'https://user:password@forms.example.test/submit'
    expect(checkSite(copy).some(issue => issue.blockId === 'contact-service' && issue.message.includes('disabled'))).toBe(true)
  })
  it('checks missing footer navigation destinations', () => {
    const copy = structuredClone(config)
    copy.pages![0].blocks.push({ id: 'footer', type: 'footer', variant: 'simple', props: { navItems: [{ label: 'Missing', url: '/missing' }] } })
    copy.blocks = copy.pages![0].blocks
    expect(checkSite(copy).some(issue => issue.blockId === 'footer' && issue.message.includes('does not match a site page'))).toBe(true)
  })
  it('recognizes common video links consistently in checks and export', () => {
    const cases = [
      ['youtube', 'https://m.youtube.com/watch?feature=share&v=abcdefghijk', 'https://www.youtube-nocookie.com/embed/abcdefghijk'],
      ['youtube', 'https://youtube.com/shorts/abcdefghijk?feature=share', 'https://www.youtube-nocookie.com/embed/abcdefghijk'],
      ['youtube', 'https://youtu.be/abcdefghijk?t=1', 'https://www.youtube-nocookie.com/embed/abcdefghijk'],
      ['vimeo', 'https://player.vimeo.com/video/12345', 'https://player.vimeo.com/video/12345'],
    ]
    for (const [variant, url, expected] of cases) {
      const copy = structuredClone(config)
      copy.pages![0].blocks.push({ id: 'video', type: 'video', variant, props: { url } })
      copy.blocks = copy.pages![0].blocks
      expect(checkSite(copy).some(issue => issue.blockId === 'video')).toBe(false)
      expect(exportSiteToHTML({ name: 'Video', blocks: [copy.blocks[1]] })).toContain(expected)
    }
    for (const url of ['https://notyoutube.com/watch?v=abcdefghijk', 'https://youtube.com.evil.test/watch?v=abcdefghijk', 'https://vimeo.com.evil.test/12345']) {
      const variant = url.includes('vimeo') ? 'vimeo' : 'youtube'
      const video: BlockConfig = { id: 'video', type: 'video', variant, props: { url } }
      const copy = structuredClone(config)
      copy.pages![0].blocks.push(video)
      copy.blocks = copy.pages![0].blocks
      expect(checkSite(copy).some(issue => issue.blockId === 'video')).toBe(true)
      expect(exportSiteToHTML({ name: 'Video', blocks: [video] })).not.toContain('<iframe')
    }
  })
  it('warns when a button uses an unsupported destination', () => {
    const copy = structuredClone(config)
    copy.pages![0].blocks[0].props.primaryCtaUrl = '//example.com/path'
    copy.blocks = copy.pages![0].blocks
    expect(checkSite(copy).some(issue => issue.message.includes('unsupported link address'))).toBe(true)
  })
  it('accepts a known page link with a query and anchor without changing the project', () => {
    const before = structuredClone(config)
    expect(checkSite(config)).toEqual([])
    expect(config).toEqual(before)
  })

  it('reports missing and draft page destinations and unconfigured link labels', () => {
    const copy = structuredClone(config)
    copy.pages![0].blocks[0].props.primaryCtaUrl = '/missing'
    copy.pages![0].blocks.push({ id: 'banner', type: 'banner', variant: 'bar', props: { linkText: 'Read', linkUrl: '/news' } })
    copy.pages![0].blocks.push({ id: 'cta', type: 'cta', variant: 'simple', props: { buttonText: 'Contact', buttonUrl: '' } })
    copy.pages![1].webstudioArticle = { status: 'draft', author: '', summary: '', createdAt: '', modifiedAt: '' }
    copy.blocks = copy.pages![0].blocks
    const issues = checkSite(copy)
    expect(issues.some(issue => issue.message.includes('does not match a site page'))).toBe(true)
    expect(issues.some(issue => issue.message.includes('draft article'))).toBe(true)
    expect(issues.some(issue => issue.message.includes('no link destination'))).toBe(true)
  })

  it('reports missing image descriptions and unconfigured forms without claiming compliance', () => {
    const copy = structuredClone(config)
    copy.pages![0].blocks.push({ id: 'image', type: 'image', variant: 'hero-image', props: { src: 'https://example.test/a.png', alt: '' } })
    copy.pages![0].blocks.push({ id: 'contact', type: 'contact', variant: 'form', props: { recipientEmail: 'invalid' } })
    copy.pages![0].blocks.push({ id: 'newsletter', type: 'newsletter', variant: 'default', props: {} })
    copy.blocks = copy.pages![0].blocks
    const issues = checkSite(copy)
    expect(issues.map(issue => issue.blockId)).toEqual(['image', 'contact', 'newsletter'])
    expect(issues[0].message).toContain('decorative')
    expect(issues[1].message).toContain('disabled')
  })

  it('finds unconfigured media and image placeholders without flagging unused image fields', () => {
    const copy = structuredClone(config)
    copy.pages![0].blocks.push(
      { id: 'image', type: 'image', variant: 'hero-image', props: {} },
      { id: 'grid', type: 'image', variant: 'grid', props: { images: [{ src: '', alt: '' }, { src: 'https://example.test/photo.png', alt: 'Photo' }] } },
      { id: 'gallery', type: 'gallery', variant: 'grid', props: {} },
      { id: 'pdf', type: 'pdfViewer', variant: 'default', props: {} },
      { id: 'video', type: 'video', variant: 'youtube', props: { url: '' } },
    )
    copy.blocks = copy.pages![0].blocks
    const issues = checkSite(copy)
    expect(issues.map(issue => issue.blockId)).toEqual(['image', 'grid', 'gallery', 'pdf', 'video'])
    expect(issues.find(issue => issue.blockId === 'grid')?.message).toContain('Image 1')
    copy.pages![0].blocks[5].props.url = 'https://www.youtube.com/watch?v=abcdefghijk'
    expect(checkSite(copy).some(issue => issue.blockId === 'video')).toBe(false)
  })

  it('checks local anchors without contacting external links', () => {
    const copy = structuredClone(config)
    copy.pages![0].blocks[0].props.primaryCtaUrl = 'https://example.test/'
    copy.blocks = copy.pages![0].blocks
    expect(checkSite(copy)).toEqual([])
    copy.pages![0].blocks[0].props.primaryCtaUrl = '#section'
    expect(checkSite(copy)[0].message).toContain('anchor #section was not found on Home')
    copy.pages![0].blocks[0].props.primaryCtaUrl = '/news?from=home#headlines'
    expect(checkSite(copy)).toEqual([])
    copy.pages![0].blocks[0].props.section1Objects = [{ id: 'photo', type: 'image', url: '/news#missing' }]
    expect(checkSite(copy)[0].message).toContain('anchor #missing was not found on News')
  })

  it('reports missing or draft destinations and unsafe protocols in content links', () => {
    const copy = structuredClone(config)
    copy.pages![0].blocks.push({ id: 'text', type: 'content', variant: 'prose', props: { body: '[Missing](/missing) [Draft](/news#top) [Unsafe](javascript:alert) [Web](https://example.test)' } })
    copy.pages![1].webstudioArticle = { status: 'draft', author: '', summary: '', createdAt: '', modifiedAt: '' }
    copy.blocks = copy.pages![0].blocks
    const issues = checkSite(copy).filter(issue => issue.blockId === 'text')
    expect(issues).toHaveLength(3)
    expect(issues.some(issue => issue.message.includes('does not match'))).toBe(true)
    expect(issues.some(issue => issue.message.includes('draft article'))).toBe(true)
    expect(issues.some(issue => issue.message.includes('unsupported link address'))).toBe(true)
  })

  it('flags explicitly empty blocks that need content', () => {
    const copy = structuredClone(config)
    copy.pages![0].blocks.push({ id: 'team', type: 'team', variant: 'grid', props: { members: [] } })
    copy.blocks = copy.pages![0].blocks
    expect(checkSite(copy).find(issue => issue.blockId === 'team')?.message).toContain('no entries')
  })

  it('warns about nonfunctional legacy navigation without altering it', () => {
    const copy = structuredClone(config)
    copy.pages![0].blocks.push({ id: 'nav', type: 'navbar', variant: 'default', props: { links: ['About'], navItems: [{ label: 'News', url: '/news' }], ctaText: 'Join' } })
    copy.pages![0].blocks.push({ id: 'footer', type: 'footer', variant: 'multi-column', props: { links: ['Privacy'], navItems: [{ label: 'News', url: '/news' }], columns: [{ title: 'Visit', links: ['123 Example Avenue'] }] } })
    copy.blocks = copy.pages![0].blocks
    const before = structuredClone(copy)
    const issues = checkSite(copy)
    expect(issues.filter(issue => issue.blockId === 'nav')).toHaveLength(2)
    expect(issues.filter(issue => issue.blockId === 'footer')).toHaveLength(1)
    expect(copy).toEqual(before)
    copy.pages![0].blocks[1].props.ctaUrl = '/news'
    expect(checkSite(copy).filter(issue => issue.blockId === 'nav')).toHaveLength(1)
    copy.pages![0].blocks[1].props = { links: [], ctaText: '' }
    copy.pages![0].blocks[2].props.links = []
    expect(checkSite(copy)).toEqual([])
  })
})
