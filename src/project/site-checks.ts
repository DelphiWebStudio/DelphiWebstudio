import type { SiteConfig } from '@/blocks/types'
import { validateProjectConfig } from './project-file'
import { buttonLinks, pageLinkPath, visitBlockLinks } from './page-links'
import { exportSiteToHTML } from '@/lib/export-html'

export interface SiteIssue {
  pageId: string
  pageName: string
  blockId: string
  message: string
  section?: number
  objectId?: string
}

export interface ExternalSiteLink {
  url: string
  locations: { pageId: string; pageName: string; blockId: string; label: string }[]
}

/** Only explicit, public-web destinations are offered to the optional status check. */
export function siteExternalLinks(config: SiteConfig): ExternalSiteLink[] {
  const links = new Map<string, ExternalSiteLink>()
  for (const page of validateProjectConfig(config).pages!) {
    if (page.webstudioArticle?.status === 'draft') continue
    for (const block of page.blocks) visitBlockLinks(block, (destination, label) => {
      if (!/^https?:\/\//i.test(destination) || /[\\\p{Cc}]/u.test(destination)) return
      try {
        const url = new URL(destination)
        if (url.username || url.password) return
        url.hash = ''
        const key = url.href
        const link = links.get(key) ?? { url: key, locations: [] }
        if (!link.locations.some(location => location.pageId === page.id && location.blockId === block.id && location.label === label)) {
          link.locations.push({ pageId: page.id, pageName: page.name, blockId: block.id, label })
        }
        links.set(key, link)
      } catch { /* Invalid destinations are left for the local link checks. */ }
    })
  }
  return [...links.values()]
}

/** WCAG relative luminance for the six-digit opaque colors supported by the editor. */
export function textContrastRatio(foreground: unknown, background: unknown): number | null {
  if (typeof foreground !== 'string' || typeof background !== 'string' || !/^#[0-9a-f]{6}$/i.test(foreground) || !/^#[0-9a-f]{6}$/i.test(background)) return null
  const luminance = (color: string) => {
    const linear = [1, 3, 5].map(offset => {
      const value = parseInt(color.slice(offset, offset + 2), 16) / 255
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    })
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
  }
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

/** Conservative color checks: image/gradient backgrounds and inherited/overridden styles need visual review. */
export function checkSiteReadability(config: SiteConfig): SiteIssue[] {
  const issues: SiteIssue[] = []
  for (const page of validateProjectConfig(config).pages!) {
    if (page.webstudioArticle?.status === 'draft' || page.webstudioCustomCode?.css || page.webstudioCustomCode?.html || page.webstudioCustomCode?.js) continue
    for (const block of page.blocks) {
      const props = block.props
      const add = (foreground: unknown, background: unknown, size: unknown, bold: boolean, label: string, section?: number, objectId?: string) => {
        const ratio = textContrastRatio(foreground, background)
        if (ratio === null) return
        const fontSize = Number(size)
        const knownSize = size !== undefined && size !== null && size !== '' && Number.isFinite(fontSize) && fontSize >= 6 && fontSize <= 200
        const large = knownSize && (fontSize >= 24 || (bold && fontSize >= 18.67))
        const minimum = large ? 3 : 4.5
        if (ratio >= minimum) return
        const explanation = knownSize && !bold && fontSize >= 18.67 && fontSize < 24 && ratio >= 3
          ? 'Normal-weight text at this size needs 4.5:1; sufficiently bold text may use 3:1. Check the actual weight.'
          : knownSize ? `The minimum for this text size is ${minimum}:1.` : ratio < 3 ? 'Even large text needs at least 3:1.' : 'Normal-size text needs 4.5:1; check the actual size and weight.'
        issues.push({ pageId: page.id, pageName: page.name, blockId: block.id, section, objectId, message: `${label} contrast is ${ratio.toFixed(2)}:1. ${explanation} Review the text and background colors.` })
      }
      const richOverrides = Object.entries(props).some(([key, value]) => key.endsWith('Rich') && Array.isArray(value) && value.some(run => run && typeof run === 'object' && (typeof run.color === 'string' || run.size !== undefined || run.bold !== undefined)))
      const adjustedText = props.textAdjustments && typeof props.textAdjustments === 'object' && Object.keys(props.textAdjustments).length > 0
      const firstSectionObjects = props.section1Objects
      const layeredPhoto = Array.isArray(firstSectionObjects) && firstSectionObjects.some(item => item && typeof item === 'object' && (item.type === 'image' || item.type === 'collage' || (item.type === 'panel' && item.src)))
      const flatText = ['content', 'panel', 'hero', 'banner', 'cta'].includes(block.type) && !props.heroImage && !props.src && !richOverrides && !adjustedText && !layeredPhoto
      const hasText = ['headline', 'subheadline', 'title', 'body', 'text', 'description'].some(key => typeof props[key] === 'string' && String(props[key]).trim())
      if (flatText && hasText) add(props.textColor, props.blockBackgroundColor, props.textSize, false, 'Block text')
      const hasButton = (buttonLinks[block.type] ?? []).some(([key]) => typeof props[key] === 'string' && String(props[key]).trim())
      if (hasButton && !adjustedText) add(props.buttonTextColor, props.buttonBackgroundColor, undefined, false, 'Button text')
      const count = Math.min(4, Math.max(1, Math.floor(Number(props.sectionCount) || 1)))
      for (let section = 1; section <= count; section++) {
        const background = section === 1 ? props.blockBackgroundColor : props[`section${section}Panel`] === true ? props[`section${section}Color`] : undefined
        const imageBackground = section === 1 && !!props.heroImage
        if (imageBackground) continue
        if (section > 1 && typeof props[`section${section}Text`] === 'string' && String(props[`section${section}Text`]).trim() && !richOverrides) {
          add(props.textColor, background, props.textSize, false, `Section ${section} text`, section)
        }
        const sectionObjects = props[`section${section}Objects`]
        const objects = Array.isArray(sectionObjects) ? sectionObjects as Record<string, unknown>[] : []
        const hasPhoto = objects.some(item => item && (item.type === 'image' || item.type === 'collage' || (item.type === 'panel' && item.src)))
        for (const item of objects) {
          if (!item || typeof item !== 'object' || !['text', 'button'].includes(String(item.type))) continue
          if (item.type === 'text' && hasPhoto) continue
          const rich = props[`sectionObject_${item.id}Rich`]
          if (Array.isArray(rich) && rich.some(run => run && typeof run === 'object' && (run.color || run.size !== undefined || run.bold !== undefined))) continue
          const parent = item.parentId ? objects.find(candidate => candidate?.id === item.parentId && candidate.type === 'panel') : undefined
          const itemBackground = item.type === 'button' ? item.backgroundColor : parent?.color ?? background
          const text = typeof item.text === 'string' && item.text.trim() || typeof props[`sectionObject_${item.id}`] === 'string' && String(props[`sectionObject_${item.id}`]).trim()
          if (text) add(item.textColor ?? props.textColor, itemBackground, item.fontSize ?? props.textSize, false, `Section ${section} ${item.type}`, section, typeof item.id === 'string' ? item.id : undefined)
        }
      }
    }
  }
  return issues
}

/** Local, limited checks. External URLs and arbitrary extension content are not inspected. */
export function checkSite(config: SiteConfig, settings?: { seoTitle?: string; seoDescription?: string; siteName?: string; siteDescription?: string; webmasterEmail?: string; siteSearch?: string }, checkHeadings = false): SiteIssue[] {
  const pages = validateProjectConfig(config).pages!
  const generatedPaths = new Set<string>([...(settings?.siteSearch === 'on' ? ['/search.html'] : []), ...(pages.some(page => page.webstudioArticle?.status === 'ready') ? ['/articles/index.html'] : [])])
  const issues: SiteIssue[] = []
  if (settings) {
    const publishedPages = pages.filter(page => page.webstudioArticle?.status !== 'draft')
    const titles = publishedPages.map(page => (page.webstudioSeo?.title?.trim() || settings.seoTitle || settings.siteName || page.name || 'Website').trim())
    for (const [index, page] of publishedPages.entries()) {
      const title = titles[index]
      const description = (page.webstudioSeo?.description?.trim() || settings.seoDescription || settings.siteDescription || '').trim()
      if (!title) issues.push({ pageId: page.id, pageName: page.name, blockId: '', message: 'Page has no SEO title. Add one in page settings.' })
      else if (titles.filter(value => value.toLocaleLowerCase() === title.toLocaleLowerCase()).length > 1) issues.push({ pageId: page.id, pageName: page.name, blockId: '', message: 'Another page uses the same SEO title. Give pages distinct titles in page settings.' })
      if (!description) issues.push({ pageId: page.id, pageName: page.name, blockId: '', message: 'Page has no meta description. Add one in page settings or site settings.' })
    }
  }
  const pageAnchors = new Map(pages.map(page => {
    const anchors = new Set<string>()
    for (const block of page.blocks) {
      const count = Math.min(4, Math.max(1, Math.floor(Number(block.props.sectionCount) || 1)))
      const names = [block.props.anchorName]
      for (let section = 1; section <= count; section++) {
        const items = block.props['section' + section + 'Objects']
        if (Array.isArray(items)) for (const item of items) names.push(item?.anchorName)
      }
      for (const name of names) {
        if (typeof name !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(name)) continue
        if (name === 'main-content' || anchors.has(name)) issues.push({ pageId: page.id, pageName: page.name, blockId: block.id, message: 'Duplicate anchor #' + name + '. Give each destination a unique name.' })
        anchors.add(name)
      }
    }
    return [page.id, anchors] as const
  }))
  for (const page of pages) {
    if (checkHeadings && page.blocks.length && page.webstudioArticle?.status !== 'draft') {
      try {
        const html = exportSiteToHTML({ name: page.name, blocks: page.blocks, theme: config.theme }, { settings })
        const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? ''
        const headings = [...main.matchAll(/<h([1-6])(?:\s[^>]*)?>/gi)].map(match => Number(match[1]))
        const report = (message: string) => issues.push({ pageId: page.id, pageName: page.name, blockId: '', message })
        const mainHeadings = headings.filter(level => level === 1).length
        if (!mainHeadings) report('No H1 heading was found in the generated page. Use a main heading to introduce the page.')
        if (mainHeadings > 1) report('The generated page contains more than one H1 heading. Review its heading structure.')
        const gap = headings.findIndex((level, index) => index > 0 && level > headings[index - 1] + 1)
        if (gap >= 0) report(`Heading order skips from H${headings[gap - 1]} to H${headings[gap]}. Review the heading levels.`)
      } catch { /* Other checks still run for pages with export errors. */ }
    }
    for (const block of page.blocks) {
      const add = (message: string) => issues.push({ pageId: page.id, pageName: page.name, blockId: block.id, message })
      if (settings) {
        const directMedia = [block.props.heroImage, block.props.logoImage]
        if (['image', 'audio', 'mediaVideo', 'document'].includes(block.type)) directMedia.push(block.props.src)
        for (const collection of [block.props.images, block.props.items, block.props.members, block.props.logos]) {
          if (!Array.isArray(collection)) continue
          for (const item of collection) {
            if (item && typeof item === 'object') directMedia.push(item.src, item.image, item.avatar)
          }
        }
        const hostedVideo = block.type === 'video' && typeof block.props.url === 'string' && /(?:youtube\.com|youtu\.be|vimeo\.com)/i.test(block.props.url)
        if (hostedVideo || directMedia.some(value => typeof value === 'string' && /^(?:https?:)?\/\//i.test(value.trim()))) {
          add('This block uses online media. Import the file into Media for offline use; hosted videos require internet access.')
        }
      }
      if (block.type === 'navbar' || block.type === 'footer') {
        const links = Array.isArray(block.props.links) ? block.props.links : []
        // Footer column entries can be ordinary address, contact or opening-hours text.
        if (links.some(link => typeof link === 'string' && link.trim())) add('This block contains text-only navigation labels that do not link to pages. Add working links under Navigation destinations.')
      }
      if ((block.type === 'navbar' || block.type === 'footer') && Array.isArray(block.props.navItems)) {
        const destinations = block.props.navItems.flatMap(item => [item, ...(block.type === 'navbar' && Array.isArray(item?.children) ? item.children : [])])
        for (const item of destinations) {
          if (!item || typeof item !== 'object') { add('A navigation destination is invalid.'); continue }
          const label = typeof item.label === 'string' ? item.label.trim() : ''
          const url = typeof item.url === 'string' ? item.url.trim() : ''
          if (!label || !url) { add('A navigation destination needs both a label and a URL.'); continue }
        }
      }
      for (const [labelKey, urlKey] of buttonLinks[block.type] ?? []) {
        const label = typeof block.props[labelKey] === 'string' ? String(block.props[labelKey]).trim() : ''
        const url = typeof block.props[urlKey] === 'string' ? String(block.props[urlKey]).trim() : ''
        if (label && !url) add(label + ': no link destination is set.')
        if (!label && url) add(urlKey + ': the link has no visible label.')
      }
      visitBlockLinks(block, (url, label) => {
        if (/^https?:\/\//i.test(url)) {
          try {
            const destination = new URL(url)
            if (destination.username || destination.password) { add(label + ': remove the username or password from this link address.'); return }
          } catch { add(label + ': this web address is not valid.'); return }
        }
        if (/[\\\p{Cc}]/u.test(url) || url.startsWith('//') || (/^[a-z][a-z\d+.-]*:/i.test(url) && !/^(https?:|mailto:|tel:)/i.test(url))) {
          add(label + ': unsupported link address; it will be shown as text in the export.')
          return
        }
        let target = page
        if (url.startsWith('/')) {
          const path = pageLinkPath(url)
          const destination = pages.find(item => item.path === path || encodeURI(item.path) === path)
          if (!destination) {
            if (!generatedPaths.has(path)) add(url + ': does not match a site page; it may point to a separate file or host resource.')
            return
          }
          target = destination
        } else if (!url.startsWith('#') && !url.startsWith('?')) return
        if (target.webstudioArticle?.status === 'draft') {
          add(url + ': points to a draft article that is omitted from export.')
          return
        }
        const hash = url.indexOf('#')
        if (hash < 0 || target.webstudioCustomCode?.html) return
        let anchor = url.slice(hash + 1).split(':~:', 1)[0]
        try { anchor = decodeURIComponent(anchor) } catch { /* report the literal anchor */ }
        if (anchor && !/^top$/i.test(anchor) && anchor !== 'main-content' && !pageAnchors.get(target.id)?.has(anchor)) {
          add(url + ': anchor #' + anchor + ' was not found on ' + target.name + '.')
        }
      })
      if (block.type === 'image' && block.variant !== 'grid' && !(typeof block.props.src === 'string' && block.props.src.trim())) add('Image has no source and will show a placeholder. Choose an image from Media or enter an image URL.')
      if (block.type === 'image' && block.variant !== 'grid' && typeof block.props.src === 'string' && block.props.src && !String(block.props.alt ?? '').trim()) {
        add('Image has no alternative text. Add a description or confirm that it is decorative.')
      }
      const sectionCount = Math.min(4, Math.max(1, Math.floor(Number(block.props.sectionCount) || 1)))
      for (let section = 1; section <= sectionCount; section++) {
        const items = block.props[`section${section}Objects`]
        if (Array.isArray(items)) for (const [index, item] of items.entries()) {
          if ((item?.type === 'image' || item?.type === 'panel') && typeof item.src === 'string' && item.src && !String(item.alt ?? '').trim()) {
            add(`Section ${section}, item ${index + 1} has an image without alternative text. Add an image description if it conveys information.`)
          }
        }
      }
      if (block.type === 'gallery' || (block.type === 'image' && block.variant === 'grid')) {
        const images = Array.isArray(block.props.images) ? block.props.images : []
        if (!images.length) add('This image collection has no images and will show placeholders. Add images in Properties.')
        for (const [index, image] of images.entries()) {
          if (!image || typeof image !== 'object' || typeof image.src !== 'string' || !image.src.trim()) add(`Image ${index + 1} has no source and will show a placeholder.`)
          if (image && typeof image === 'object' && typeof image.src === 'string' && image.src && !String(image.alt ?? '').trim()) add(`Image ${index + 1} has no alternative text. Add a description or confirm that it is decorative.`)
        }
      }
      if (['pdfViewer', 'document', 'audio', 'mediaVideo'].includes(block.type) && !(typeof block.props.src === 'string' && block.props.src.trim())) add('This media block has no file selected. Add a file from Media.')
      if (block.type === 'video') {
        const url = typeof block.props.url === 'string' ? block.props.url : ''
        const valid = block.variant === 'vimeo' ? /^(?:https?:\/\/)?(?:(?:www\.)?vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)(?=[/?#]|$)/i.test(url.trim()) : /^(?:https?:\/\/)?(?:(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:[^#]*&)?v=|(?:embed|v|shorts|live)\/)|(?:www\.)?youtu\.be\/)([a-zA-Z0-9_-]{11})(?=[?&#/]|$)/i.test(url.trim())
        if (!valid) add(`Video has no supported ${block.variant === 'vimeo' ? 'Vimeo' : 'YouTube'} address and will show a placeholder.`)
      }
      if (['features', 'testimonials', 'stats', 'faq', 'team', 'logocloud'].includes(block.type)) {
        const key = block.type === 'team' ? 'members' : block.type === 'logocloud' ? 'logos' : 'items'
        const value = block.props[key]
        if (Array.isArray(value) && value.length === 0) add('This block has no entries yet. Add your own content in Properties or remove the block.')
      }
      if (block.type === 'contact') {
        const email = (typeof block.props.recipientEmail === 'string' && block.props.recipientEmail.trim()) || settings?.webmasterEmail?.trim() || ''
        const endpoint = typeof block.props.formEndpoint === 'string' ? block.props.formEndpoint.trim() : ''
        let validEndpoint = false
        try { const url = new URL(endpoint); validEndpoint = !/[\s\p{Cc}]/u.test(endpoint) && url.protocol === 'https:' && !url.username && !url.password && !url.hash } catch { /* no valid endpoint */ }
        if (endpoint ? !validEndpoint : !/^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$/.test(email)) add('Contact form has no valid contact email or HTTPS form service URL and will be disabled in the export.')
        if (endpoint && validEndpoint && (typeof block.props.consentNotice !== 'string' || !block.props.consentNotice.trim())) add('Contact form sends visitor information to a service without a privacy and consent notice. Add one in Properties.')
      }
      if (block.type === 'newsletter') add('Newsletter signup has no configured service and will be disabled in the export.')
    }
  }
  return issues
}
