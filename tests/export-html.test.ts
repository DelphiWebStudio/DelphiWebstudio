import { describe, it, expect } from 'vitest'
import { exportSiteToHTML } from '../src/lib/export-html'
import type { SiteConfig } from '../src/blocks/types'

const baseConfig: SiteConfig = {
  name: 'Test Site',
  blocks: [
    {
      id: 'hero-1',
      type: 'hero',
      variant: 'centered',
      props: {
        headline: 'Hello',
        subheadline: 'World',
        primaryCta: 'Start',
      },
    },
  ],
}

describe('exportSiteToHTML', () => {
  it('exports separate positioned collage layers and a movable colored panel', () => {
    const collage = { id: 'collage', type: 'collage' as const, variant: 'default', props: { images: [
      { src: 'assets/a.png', alt: 'First photo', x: '0', y: '0', width: '60', height: '50', layer: '1' },
      { src: 'assets/b.png', alt: 'Logo', x: '40', y: '35', width: '20', height: '30', layer: '5' },
    ] } }
    const panel = { id: 'panel', type: 'panel' as const, variant: 'default', props: { title: 'Welcome', body: 'Panel text', src: 'assets/p.png', alt: 'Portrait', blockBackgroundColor: '#b9aeb6', layoutWidth: 40, layoutLeft: 30, layoutTop: -100, layoutLayer: 4 } }
    const html = exportSiteToHTML({ ...baseConfig, blocks: [collage, panel] })
    expect(html).toContain('alt="First photo"')
    expect(html).toContain('alt="Logo"')
    expect(html).toContain('z-index:5')
    expect(html).toContain('left:40%')
    expect(html).toContain('Panel text')
    expect(html).toContain('alt="Portrait"')
    expect(html).toContain('background-color:#b9aeb6!important')
    expect(html).toContain('margin-left:30%')
    expect(html).toContain('margin-top:-100px')
    expect(html).not.toContain('Resize collage image')
  })
  it('exports a colored panel inside an additional block section', () => {
    const block = { id: 'section', type: 'content' as const, variant: 'prose', props: { body: 'First', sectionCount: 2, section2Panel: true, section2Color: '#b9aeb6', section2Text: 'Panel inside section', section2Image: 'assets/portrait.png', section2Alt: 'Portrait' } }
    const html = exportSiteToHTML({ ...baseConfig, blocks: [block] })
    expect(html).toContain('background-color:#b9aeb6')
    expect(html).toContain('Panel inside section')
    expect(html).toContain('alt="Portrait"')
  })
  it('exports a valid block background and ignores invalid CSS values', () => {
    const block = { id: 'content', type: 'content' as const, variant: 'prose', props: { body: 'Hello', blockBackgroundColor: '#aabbcc' } }
    const html = exportSiteToHTML({ ...baseConfig, blocks: [block] })
    expect(html).toContain('background-color:#aabbcc!important')
    const invalid = exportSiteToHTML({ ...baseConfig, blocks: [{ ...block, props: { ...block.props, blockBackgroundColor: 'red;display:none' } }] })
    expect(invalid).not.toContain('red;display:none')
    const reset = exportSiteToHTML({ ...baseConfig, blocks: [{ ...block, props: { ...block.props, blockBackgroundColor: '' } }] })
    expect(reset).not.toContain('background-color:#aabbcc!important')
  })
  it('exports the selected number of independent sections and preserves hidden section data', () => {
    const block = { id: 'content', type: 'content' as const, variant: 'prose', props: {
      body: 'First section', sectionCount: 3, section2Text: 'Second section', section2Image: 'assets/church.png', section2Alt: 'Church', section3Text: 'Third section', section4Text: 'Hidden section',
    } }
    const html = exportSiteToHTML({ ...baseConfig, blocks: [block] })
    expect(html).toContain('@md:grid-cols-3')
    expect(html).toContain('First section')
    expect(html).toContain('Second section')
    expect(html).toContain('src="assets/church.png"')
    expect(html).toContain('alt="Church"')
    expect(html).toContain('Third section')
    expect(html).not.toContain('Hidden section')
    const expanded = exportSiteToHTML({ ...baseConfig, blocks: [{ ...block, props: { ...block.props, sectionCount: 4 } }] })
    expect(expanded).toContain('Hidden section')
  })
  it.each(['default', 'centered'])('keeps destination links before legacy labels in a %s Navbar', variant => {
    const navbar = { id: 'nav', type: 'navbar' as const, variant, props: { logo: '', links: ['About'], navItems: [{ label: 'Home', url: '/' }, { label: 'Contact', url: '/contact' }] } }
    const html = exportSiteToHTML({ ...baseConfig, blocks: [navbar] })
    const body = html.slice(html.indexOf('<body>'))
    expect(body.indexOf('>Home</a>')).toBeGreaterThan(-1)
    expect(body.indexOf('>Contact</a>')).toBeGreaterThan(body.indexOf('>Home</a>'))
    expect(body.indexOf('>About</span>')).toBeGreaterThan(body.indexOf('>Contact</a>'))
  })
  it.each(['default', 'centered'])('exports a %s text Navbar without a placeholder logo', variant => {
    const navbar = { id: 'nav', type: 'navbar' as const, variant, props: { logo: '', navItems: [{ label: 'Home', url: '/' }] } }
    const html = exportSiteToHTML({ ...baseConfig, blocks: [navbar] })
    expect(html).toContain('>Home</a>')
    expect(html).not.toContain('w-4 h-4 rounded-full bg-green')
    const withLogo = exportSiteToHTML({ ...baseConfig, blocks: [{ ...navbar, props: { ...navbar.props, logoImage: 'assets/logo.png' } }] })
    expect(withLogo).toContain('src="assets/logo.png"')
  })
  it('renders imported photos without a filename overlay or forced crop while preserving intentional captions', () => {
    const photo = { id: 'photo', type: 'image' as const, variant: 'hero-image', props: { src: 'assets/church.png', alt: 'church.png', title: 'church.png' } }
    const html = exportSiteToHTML({ ...baseConfig, blocks: [photo] })
    expect(html).not.toContain('bg-gradient-to-t from-bg-0/80')
    expect(html).not.toContain('h-64 @lg:h-96 object-cover')
    expect(html).toContain('alt="church.png"')
    const captioned = exportSiteToHTML({ ...baseConfig, blocks: [{ ...photo, props: { ...photo.props, title: 'Our church' } }] })
    expect(captioned).toContain('Our church')
  })
  it('exports individual gallery image adjustments and section text styling', () => {
    const html = exportSiteToHTML({ ...baseConfig, blocks: [{
      id: 'gallery', type: 'gallery', variant: 'grid',
      props: { title: 'Photos', images: [{ src: 'assets/a.png', alt: 'A' }, { src: 'assets/b.png', alt: 'B' }],
        textSize: '28', textColor: '#123456', textAdjustments: { 'h2-0': { size: '42', color: '#aa2200' } },
        imageAdjustments: { '1': { width: '160', height: '120', left: '-30', top: '15', layer: '2' } } },
    }] })
    expect(html).toContain('data-ws-image-index="0"')
    expect(html).toContain('data-ws-image-index="1"')
    expect(html).toContain('font-size:28px!important')
    expect(html).toContain('color:#123456!important')
    expect(html).toContain('data-ws-text-key="h2-0"')
    expect(html).toContain('font-size:42px!important')
    expect(html).toContain('color:#aa2200!important')
    expect(html).toContain('width:160px!important')
    expect(html).toContain('left:-30px!important')
  })
  it('ignores invalid image and text style content in exported CSS', () => {
    const html = exportSiteToHTML({ ...baseConfig, blocks: [{
      id: 'bad', type: 'hero', variant: 'split',
      props: { headline: 'Hi', heroImage: 'assets/a.png', textColor: 'red;display:none', textSize: '100;display:none',
        imageAdjustments: { '0': { width: '2px;display:none' } } },
    }] })
    expect(html).not.toContain('display:none!important')
    expect(html).not.toContain('red;display:none')
  })
  it('exports positioned image sections with their size, overlap and layer order', () => {
    const html = exportSiteToHTML({ ...baseConfig, blocks: [
      { id: 'first-image', type: 'image', variant: 'hero-image', props: { src: 'assets/first.png', alt: 'First image', layoutWidth: 55, layoutHeight: 250, layoutLeft: 10, layoutLayer: 1 } },
      { id: 'second-image', type: 'image', variant: 'hero-image', props: { src: 'assets/second.png', alt: 'Second image', layoutWidth: 40, layoutHeight: 180, layoutLeft: 45, layoutTop: -100, layoutLayer: 2 } },
    ] })
    expect(html).toContain('width:55%;margin-left:10%;margin-top:0px;z-index:1')
    expect(html).toContain('width:40%;margin-left:45%;margin-top:-100px;z-index:2')
    expect(html).toContain('height:250px')
    expect(html).toContain('height:180px')
    expect(html).toContain('alt="First image"')
    expect(html).toContain('alt="Second image"')
  })
  it('exports responsive visibility without removing the section content', () => {
    const html = exportSiteToHTML({ ...baseConfig, blocks: [{ ...baseConfig.blocks[0], webstudioHiddenOn: { mobile: true, desktop: true } }] })
    expect(html).toContain('class="ws-hidden-mobile ws-hidden-desktop"')
    expect(html).toContain('@media (max-width: 479px) { .ws-hidden-mobile { display: none !important; } }')
    expect(html).toContain('@media (min-width: 900px) { .ws-hidden-desktop { display: none !important; } }')
    expect(html).toContain('Hello')
  })
  it('renders unsafe button destinations as text while retaining supported links', () => {
    const hero = baseConfig.blocks[0]
    for (const url of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,test', '//evil.example', '/\\evil.example', 'java\nscript:alert(1)']) {
      const html = exportSiteToHTML({ ...baseConfig, blocks: [{ ...hero, props: { ...hero.props, primaryCtaUrl: url } }] })
      expect(html).not.toContain(`href="${url}"`)
      expect(html).toMatch(/<span[^>]*>Start<\/span>/)
    }
    for (const url of ['/about', '#section', 'https://example.com', 'mailto:info@example.com', 'tel:+123456']) {
      const html = exportSiteToHTML({ ...baseConfig, blocks: [{ ...hero, props: { ...hero.props, primaryCtaUrl: url } }] })
      expect(html).toContain(`href="${url}"`)
    }
  })
  it('includes SEO metadata and language settings', () => {
    const html = exportSiteToHTML(baseConfig, {
      settings: {
        siteName: 'Delphi Web Studio',
        seoTitle: 'Delphi Web Studio Builder',
        seoDescription: 'Build <fast> websites safely',
        ogImageUrl: 'https://cdn.example.com/og.png',
        faviconUrl: 'https://cdn.example.com/favicon.ico',
        language: 'German',
      },
    })

    expect(html).toMatch(/<html lang="de">/)
    expect(html).toMatch(/<title>Delphi Web Studio Builder<\/title>/)
    expect(html).toMatch(/name="description" content="Build &lt;fast&gt; websites safely"/)
    expect(html).toMatch(/property="og:image" content="https:\/\/cdn\.example\.com\/og\.png"/)
    expect(html).toMatch(/rel="icon" href="https:\/\/cdn\.example\.com\/favicon\.ico"/)
  })

  it('injects analytics snippets when keys are provided', () => {
    const html = exportSiteToHTML(baseConfig, {
      settings: {
        gaId: 'G-ABC123XYZ',
        posthogKey: 'phc_test_key',
      },
    })

    expect(html).toMatch(/googletagmanager\.com\/gtag\/js\?id=G-ABC123XYZ/)
    expect(html).toMatch(/gtag\('config', "G-ABC123XYZ"\);/)
    expect(html).toMatch(/posthog\.init\("phc_test_key"/)
  })

  it('keeps analytics values inside their script strings', () => {
    const attack = '</script><script>window.injected = true</script>'
    const html = exportSiteToHTML(baseConfig, { settings: { gaId: attack, posthogKey: attack } })
    expect(html).not.toContain(attack)
    expect(html).toContain('\\u003c/script>\\u003cscript>window.injected = true\\u003c/script>')
  })

  it('omits optional metadata when settings are absent', () => {
    const html = exportSiteToHTML(baseConfig)
    expect(html).not.toMatch(/name="description"/)
    expect(html).not.toMatch(/property="og:image"/)
    expect(html).not.toMatch(/googletagmanager/)
    expect(html).not.toMatch(/posthog\.init/)
  })

  it('uses the editor root size and container breakpoints for a centered hero', () => {
    const html = exportSiteToHTML(baseConfig)
    expect(html).toContain('html { font-size: 14px; }')
    expect(html).toContain('overflow-wrap: anywhere;')
    expect(html).toContain('class="@container"')
    expect(html).toContain('@md:text-5xl')
    expect(html).toContain('@md:py-28')
  })

  it('exports all hero layouts with their responsive container breakpoints', () => {
    const hero = baseConfig.blocks[0]
    const split = exportSiteToHTML({ ...baseConfig, blocks: [{ ...hero, variant: 'split' }] })
    const gradient = exportSiteToHTML({ ...baseConfig, blocks: [{ ...hero, variant: 'gradient' }] })
    const minimal = exportSiteToHTML({ ...baseConfig, blocks: [{ ...hero, variant: 'minimal', props: { ...hero.props, primaryCtaUrl: '/about' } }] })
    expect(split).toContain('@2xl:flex-row')
    expect(split).toContain('@md:text-5xl')
    expect(gradient).toContain('@md:py-32')
    expect(minimal).toContain('@md:text-7xl')
    expect(minimal).toContain('href="/about"')
  })

  it('clearly disables forms that have no submission backend', () => {
    const html = exportSiteToHTML({ name: 'Forms', blocks: [
      { id: 'contact', type: 'contact', variant: 'default', props: {} },
      { id: 'newsletter', type: 'newsletter', variant: 'default', props: {} },
    ] })
    expect(html.match(/<fieldset disabled/g)).toHaveLength(2)
    expect(html.match(/This form is not connected yet\./g)).toHaveLength(2)
    expect(html).not.toContain('Join 2,000+ developers and designers')
  })

  it('offers a mail application action only for a valid contact address', () => {
    const contact = { id: 'contact', type: 'contact' as const, variant: 'form', props: { title: 'Contact', recipientEmail: 'office@example.com' } }
    const configured = exportSiteToHTML({ name: 'Forms', blocks: [contact] })
    expect(configured).toContain('data-contact-email="office@example.com"')
    expect(configured).toContain('name="message" required')
    expect(configured).toContain('name="email" required')
    expect(configured).toContain('you send the message there')
    expect(configured).toContain("'mailto:' + recipient")
    const invalid = exportSiteToHTML({ name: 'Forms', blocks: [{ ...contact, props: { ...contact.props, recipientEmail: 'office@example.com?bcc=other@example.com' } }] })
    expect(invalid).not.toContain('data-contact-email="office@example.com')
    expect(invalid).toContain('<fieldset disabled')
  })

  it('preserves responsive feature layouts and alternating images', () => {
    const feature = { id: 'features', type: 'features' as const, variant: 'grid', props: { title: 'Features', items: [{ title: 'Photo', description: 'Description', image: 'assets/photo.png' }] } }
    const grid = exportSiteToHTML({ name: 'Test', blocks: [feature] })
    const alternating = exportSiteToHTML({ name: 'Test', blocks: [{ ...feature, variant: 'alternating' }] })
    expect(grid).toContain('@lg:grid-cols-2 @3xl:grid-cols-3')
    expect(alternating).toContain('@lg:flex-row')
    expect(alternating).toContain('src="assets/photo.png"')
    expect(alternating).toContain('alt="Photo"')
  })

  it('preserves CTA and statistics variants and responsive breakpoints', () => {
    const cta = { id: 'cta', type: 'cta' as const, variant: 'split', props: { headline: 'Contact us', buttonText: 'About', buttonUrl: '/about' } }
    const split = exportSiteToHTML({ name: 'Test', blocks: [cta] })
    expect(split).toContain('@lg:flex-row')
    expect(split).toContain('href="/about"')

    const stats = { id: 'stats', type: 'stats' as const, variant: 'counter', props: { items: [{ value: '12', label: 'Members' }] } }
    const counter = exportSiteToHTML({ name: 'Test', blocks: [stats] })
    expect(counter).toContain('@2xl:grid-cols-4')
    expect(counter).toContain('12')
    expect(counter).toContain('Members')
    expect(counter).toContain('bg-green/8')
  })
})
