import type { BlockConfig } from '@/blocks/types'

export const buttonLinks: Partial<Record<BlockConfig['type'], [string, string][]>> = {
  hero: [['primaryCta', 'primaryCtaUrl'], ['secondaryCta', 'secondaryCtaUrl']],
  cta: [['buttonText', 'buttonUrl']],
  navbar: [['ctaText', 'ctaUrl']],
  banner: [['linkText', 'linkUrl']],
}

export function pageLinkPath(destination: string): string {
  return destination.split(/[?#]/, 1)[0].replace(/\/$/, '') || '/'
}

export function visitBlockLinks(block: BlockConfig, visit: (destination: string, label: string) => string | void): void {
  const { props } = block
  function visitField(record: Record<string, unknown>, key: string, label: string) {
    const value = record[key]
    if (typeof value !== 'string' || !value.trim()) return
    const changed = visit(value.trim(), label)
    if (typeof changed === 'string' && changed !== value.trim()) record[key] = changed
  }
  function visitItems(items: unknown, fallback: string, children = false) {
    if (!Array.isArray(items)) return
    for (const item of items) {
      if (!item || typeof item !== 'object') continue
      visitField(item, 'url', String(item.label || item.title || item.alt || item.text || fallback))
      if (children) visitItems(item.children, fallback)
    }
  }

  for (const [label, key] of buttonLinks[block.type] ?? []) visitField(props, key, String(props[label] || key))
  if (block.type === 'navbar' || block.type === 'footer') visitItems(props.navItems, 'Navigation link', block.type === 'navbar')
  if (block.type === 'footer') {
    visitItems(props.resources, 'Footer resource')
    visitItems(props.resourceButtons, 'Footer button')
  }
  if (block.type === 'image' && block.variant !== 'grid') visitField(props, 'imageLink', String(props.alt || 'Image link'))

  for (const [key, value] of Object.entries(props)) {
    if (/^section[1-4](?:Items|Objects)$/.test(key)) visitItems(value, 'Section object link')
    if (/^section[2-4]ImageLink$/.test(key)) visitField(props, key, 'Section image link')
    if (key.endsWith('Rich') && Array.isArray(value)) {
      for (const run of value) if (run && typeof run === 'object') visitField(run, 'href', String(run.text || 'Text link'))
    }
    if (typeof value === 'string' && ((['content', 'panel'].includes(block.type) && key === 'body') || /^section[2-4]Text$/.test(key))) {
      const changed = value.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (match, label: string, destination: string) => {
        const updated = visit(destination, label)
        return typeof updated === 'string' && updated !== destination ? `[${label}](${updated})` : match
      })
      if (changed !== value) props[key] = changed
    }
  }
}
