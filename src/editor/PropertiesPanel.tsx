import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronRight, Code } from 'lucide-react'
import { toast } from 'sonner'
import type { BlockConfig, BlockType } from '@/blocks/types'
import { useConfigStore } from '@/store/configStore'
import { portableProjectsEnabled } from '@/project/project-file'
import { useEditorStore } from '@/store/editorStore'
import { useProjectsStore } from '@/store/projectsStore'
import { ProjectMediaLibrary, type MediaAsset } from '@/media/media-library'
import { WindowsColorInput } from './WindowsColorInput'
import { chooseWindowsFont } from '@/desktop/native-bridge'
import { resolveTheme } from '@/lib/theme-presets'

interface FieldDef {
  key: string
  label: string
  type: 'text' | 'image' | 'link' | 'textarea' | 'select' | 'checkbox' | 'array-strings' | 'array-items'
  options?: string[]
}

const blockFields: Partial<Record<BlockType, { sections: { title: string; fields: FieldDef[] }[] }>> = {
  collage: { sections: [{ title: 'Collage photos', fields: [{ key: 'images', label: 'Photos and image layers', type: 'array-items' }] }] },
  panel: { sections: [{ title: 'Panel content', fields: [
    { key: 'title', label: 'Title', type: 'text' }, { key: 'body', label: 'Text', type: 'textarea' },
    { key: 'src', label: 'Image', type: 'image' }, { key: 'alt', label: 'Image description', type: 'text' },
  ] }, { title: 'Panel position', fields: [
    { key: 'layoutWidth', label: 'Width (% of page)', type: 'text' }, { key: 'layoutHeight', label: 'Height (px)', type: 'text' },
    { key: 'layoutLeft', label: 'Left (% of page)', type: 'text' }, { key: 'layoutTop', label: 'Vertical offset (px)', type: 'text' },
    { key: 'layoutLayer', label: 'Layer order', type: 'text' },
  ] }] },
  document: { sections: [{ title: 'Document', fields: [{ key: 'title', label: 'Title', type: 'text' }] }] },
  documentLibrary: { sections: [{ title: 'Document library', fields: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'items', label: 'Documents', type: 'array-items' }] }] },
  audio: { sections: [{ title: 'Audio', fields: [{ key: 'title', label: 'Title', type: 'text' }] }] },
  mediaVideo: { sections: [{ title: 'Video', fields: [{ key: 'title', label: 'Title', type: 'text' }] }] },
  pdfViewer: { sections: [{ title: 'PDF', fields: [
    { key: 'title', label: 'Title', type: 'text' },
    { key: 'caption', label: 'Caption', type: 'text' },
    { key: 'accessibilityLabel', label: 'Accessibility label', type: 'text' },
    { key: 'height', label: 'Height (px)', type: 'text' },
    { key: 'initialPage', label: 'Starting page', type: 'text' },
    { key: 'fitMode', label: 'Fit mode', type: 'select', options: ['auto', 'width', 'page'] },
    { key: 'mobileMode', label: 'Mobile display', type: 'select', options: ['viewer', 'link'] },
    { key: 'showThumbnails', label: 'Show page thumbnails', type: 'checkbox' },
    { key: 'showSearch', label: 'Show search', type: 'checkbox' },
    { key: 'showPrint', label: 'Show print link', type: 'checkbox' },
    { key: 'showDownload', label: 'Show download link', type: 'checkbox' },
    { key: 'showFullscreen', label: 'Show fullscreen', type: 'checkbox' },
  ] }] },
  navbar: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'logo', label: 'Logo Text', type: 'text' },
          { key: 'logoImage', label: 'Logo Image URL', type: 'image' },
          { key: 'ctaText', label: 'CTA Button', type: 'text' },
          { key: 'ctaUrl', label: 'CTA Destination', type: 'link' },
          { key: 'links', label: 'Legacy text-only labels', type: 'array-strings' },
          { key: 'navItems', label: 'Navigation destinations', type: 'array-items' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['default', 'centered'] },
          { key: 'layoutWidth', label: 'Navbar width (% of page)', type: 'text' },
          { key: 'layoutHeight', label: 'Navbar height (px)', type: 'text' },
        ],
      },
    ],
  },
  hero: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'badge', label: 'Badge', type: 'text' },
          { key: 'headline', label: 'Headline', type: 'text' },
          { key: 'subheadline', label: 'Subheadline', type: 'textarea' },
          { key: 'primaryCta', label: 'Primary CTA', type: 'text' },
          { key: 'primaryCtaUrl', label: 'Primary CTA URL', type: 'link' },
          { key: 'secondaryCta', label: 'Secondary CTA', type: 'text' },
          { key: 'secondaryCtaUrl', label: 'Secondary CTA URL', type: 'link' },
          { key: 'heroImage', label: 'Hero Image URL', type: 'image' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['centered', 'split', 'gradient', 'minimal'] },
          { key: 'layoutWidth', label: 'Hero width (% of page)', type: 'text' },
          { key: 'layoutHeight', label: 'Hero height (px)', type: 'text' },
        ],
      },
    ],
  },
  features: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'label', label: 'Section Label', type: 'text' },
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'subtitle', label: 'Subtitle', type: 'text' },
        ],
      },
      {
        title: 'Items',
        fields: [
          { key: 'items', label: 'Feature Cards', type: 'array-items' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['grid', 'list', 'alternating'] },
        ],
      },
    ],
  },
  pricing: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'subtitle', label: 'Subtitle', type: 'text' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['simple', 'comparison'] },
        ],
      },
    ],
  },
  cta: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'headline', label: 'Headline', type: 'text' },
          { key: 'subheadline', label: 'Subheadline', type: 'text' },
          { key: 'buttonText', label: 'Button Text', type: 'text' },
          { key: 'buttonUrl', label: 'Button URL', type: 'link' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['simple', 'split'] },
        ],
      },
    ],
  },
  footer: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'logo', label: 'Logo Text', type: 'text' },
          { key: 'logoImage', label: 'Logo Image URL', type: 'image' },
          { key: 'description', label: 'Description', type: 'textarea' },
          { key: 'copyright', label: 'Copyright', type: 'text' },
          { key: 'links', label: 'Legacy text-only labels', type: 'array-strings' },
          { key: 'navItems', label: 'Navigation destinations', type: 'array-items' },
          { key: 'resources', label: 'Resource images and links', type: 'array-items' },
          { key: 'resourceButtons', label: 'Resource buttons', type: 'array-items' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['simple', 'multi-column', 'minimal', 'resources'] },
        ],
      },
    ],
  },
  testimonials: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'subtitle', label: 'Subtitle', type: 'text' },
          { key: 'items', label: 'Testimonials', type: 'array-items' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['cards', 'carousel', 'spotlight'] },
        ],
      },
    ],
  },
  stats: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'items', label: 'Stats', type: 'array-items' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['grid', 'bar', 'counter'] },
        ],
      },
    ],
  },
  faq: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'subtitle', label: 'Subtitle', type: 'text' },
          { key: 'items', label: 'Questions', type: 'array-items' },
        ],
      },
    ],
  },
  team: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'subtitle', label: 'Subtitle', type: 'text' },
          { key: 'members', label: 'Members', type: 'array-items' },
        ],
      },
    ],
  },
  contact: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'subtitle', label: 'Subtitle', type: 'text' },
          { key: 'recipientEmail', label: 'Contact Email', type: 'text' },
          { key: 'formEndpoint', label: 'Form service HTTPS URL (optional)', type: 'text' },
          { key: 'consentNotice', label: 'Privacy and consent notice (optional)', type: 'textarea' },
        ],
      },
    ],
  },
  newsletter: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'subtitle', label: 'Subtitle', type: 'text' },
          { key: 'buttonText', label: 'Button Text', type: 'text' },
          { key: 'socialProof', label: 'Social Proof', type: 'text' },
        ],
      },
    ],
  },
  logocloud: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'logos', label: 'Logos', type: 'array-strings' },
        ],
      },
    ],
  },
  content: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'body', label: 'Body', type: 'textarea' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['prose', 'columns', 'highlight'] },
        ],
      },
    ],
  },
  image: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'src', label: 'Image URL', type: 'image' },
          { key: 'alt', label: 'Alt Text', type: 'text' },
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'subtitle', label: 'Subtitle', type: 'text' },
          { key: 'imageSide', label: 'Image Side', type: 'select', options: ['left', 'right'] },
        ],
      },
      {
        title: 'Grid Images',
        fields: [
          { key: 'images', label: 'Images', type: 'array-items' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['hero-image', 'side-by-side', 'grid'] },
          { key: 'imageFit', label: 'Image fit', type: 'select', options: ['cover', 'contain', 'fill'] },
          { key: 'layoutWidth', label: 'Section width (% of page)', type: 'text' },
          { key: 'layoutHeight', label: 'Image height (px)', type: 'text' },
          { key: 'layoutLeft', label: 'Left position (% of page)', type: 'text' },
          { key: 'layoutTop', label: 'Vertical spacing (px; negative overlaps)', type: 'text' },
          { key: 'layoutLayer', label: 'Layer order', type: 'text' },
        ],
      },
    ],
  },
  video: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'url', label: 'Video URL', type: 'text' },
          { key: 'title', label: 'Title', type: 'text' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Platform', type: 'select', options: ['youtube', 'vimeo'] },
        ],
      },
    ],
  },
  gallery: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'images', label: 'Images', type: 'array-items' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['grid', 'masonry'] },
        ],
      },
    ],
  },
  divider: {
    sections: [
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['line', 'space', 'dots'] },
          { key: 'width', label: 'Width', type: 'select', options: ['full', 'centered', 'narrow'] },
          { key: 'height', label: 'Height (px)', type: 'text' },
        ],
      },
    ],
  },
  banner: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'text', label: 'Text', type: 'text' },
          { key: 'linkText', label: 'Link Text', type: 'text' },
          { key: 'linkUrl', label: 'Link URL', type: 'link' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['ribbon', 'bar'] },
        ],
      },
    ],
  },
}

function PropertyField({ field, block }: { field: FieldDef; block: BlockConfig }) {
  const textArea = useRef<HTMLTextAreaElement>(null)
  const updateBlockProps = useConfigStore((s) => s.updateBlockProps)
  const updateBlock = useConfigStore((s) => s.updateBlock)
  const pages = useConfigStore((s) => s.config.pages)
  const projectId = useEditorStore((s) => s.activeProjectId)
  const siteSearchEnabled = useProjectsStore((s) => s.projects.find(project => project.id === projectId)?.settings?.siteSearch === 'on')
  const mediaRevision = useProjectsStore((s) => s.projects.find(project => project.id === projectId)?.mediaRevision ?? 0)
  const [media, setMedia] = useState<{ projectId: string; revision: number; images: MediaAsset[] } | null>(null)
  const [itemMenu, setItemMenu] = useState<{ index: number; x: number; y: number } | null>(null)
  const [expandedNavIndex, setExpandedNavIndex] = useState<number | null>(null)
  const imageItems = field.type === 'array-items' && ((field.key === 'images' && (block.type === 'gallery' || block.type === 'image' || block.type === 'collage')) || (field.key === 'items' && block.type === 'features') || (field.key === 'members' && block.type === 'team') || (field.key === 'resources' && block.type === 'footer') || /^section[1-4](Items|Objects)$/.test(field.key))
  const documentItems = field.type === 'array-items' && block.type === 'documentLibrary' && field.key === 'items'
  const mediaItems = imageItems || documentItems
  const imageKey = block.type === 'features' ? 'image' : block.type === 'team' ? 'avatar' : 'src'
  const contentMedia = block.type === 'content' && field.key === 'body' && field.type === 'textarea'

  useEffect(() => {
    if (!itemMenu) return
    const dismiss = (event: PointerEvent) => { if (!(event.target instanceof Element) || !event.target.closest('[data-property-item-menu]')) setItemMenu(null) }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setItemMenu(null) }
    document.addEventListener('pointerdown', dismiss); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', key) }
  }, [itemMenu])

  useEffect(() => {
    if (!portableProjectsEnabled || (field.type !== 'image' && !mediaItems && !contentMedia) || !projectId) return
    let active = true
    new ProjectMediaLibrary().list(projectId).then(assets => {
      if (active) setMedia({ projectId, revision: mediaRevision, images: contentMedia ? assets : documentItems ? assets.filter(asset => !asset.mime.startsWith('image/') && !asset.mime.startsWith('audio/') && !asset.mime.startsWith('video/')) : assets.filter(asset => asset.mime.startsWith('image/')) })
    }).catch(() => { if (active) setMedia({ projectId, revision: mediaRevision, images: [] }) })
    return () => { active = false }
  }, [field.type, mediaItems, documentItems, contentMedia, projectId, mediaRevision])

  // For variant field, it's on the block itself
  const value = field.key === 'variant'
    ? block.variant
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : (block.props as any)[field.key]

  const onChange = (newValue: unknown) => {
    if (field.key === 'variant') {
      updateBlock(block.id, { variant: newValue as string })
    } else {
      updateBlockProps(block.id, field.key === 'src' ? { [field.key]: newValue, assetId: undefined } : (block.type === 'hero' && ['headline', 'subheadline'].includes(field.key)) || (block.type === 'content' && field.key === 'body' && block.variant !== 'columns') || (block.type === 'panel' && ['title', 'body'].includes(field.key)) || /^section[2-4]Text$/.test(field.key) ? { [field.key]: newValue, [`${field.key}Rich`]: undefined } : { [field.key]: newValue })
    }
  }

  switch (field.type) {
    case 'checkbox':
      return <label className="mb-2 flex items-center gap-2 text-xs text-text-1"><input type="checkbox" checked={field.key === 'showThumbnails' ? value === true : value !== false} onChange={event => onChange(event.target.checked)} /> {field.label}</label>
    case 'image': {
      const images = media?.projectId === projectId && media.revision === mediaRevision ? media.images : []
      const current = String(value || '')
      const selected = images.some(image => image.path === current) ? current : ''
      return (
        <div className="mb-2.5">
          <label className="block text-[11.5px] text-text-2 mb-1 font-medium">{field.label}</label>
          <input type="text" aria-label={field.label} value={current} onChange={event => onChange(event.target.value)}
            className="w-full px-2 py-1.5 rounded border border-border-default bg-bg-2 text-text-0 text-xs outline-none focus:border-green" />
          {portableProjectsEnabled && images.length > 0 && <select aria-label={`Choose image for ${field.label}`} value={selected}
            onChange={event => {
              const image = images.find(item => item.path === event.target.value)
              if (!image) return
              if (field.key === 'src') updateBlockProps(block.id, { src: image.path, assetId: image.id })
              else onChange(image.path)
            }} className="mt-1 w-full px-2 py-1.5 rounded border border-border-default bg-bg-2 text-text-0 text-xs outline-none focus:border-green">
            <option value="">Choose an image from Media...</option>
            {images.map(image => <option key={image.id} value={image.path}>{image.name}</option>)}
          </select>}
        </div>
      )
    }

    case 'link': {
      const availablePages = (pages ?? []).filter(page => page.webstudioArticle?.status !== 'draft')
      const current = String(value || '')
      const selected = availablePages.some(page => page.path === current) ? current : ''
      return (
        <div className="mb-2.5">
          <label className="block text-[11.5px] text-text-2 mb-1 font-medium">{field.label}</label>
          <input type="text" aria-label={field.label} value={current} onChange={event => onChange(event.target.value)}
            className="w-full px-2 py-1.5 rounded border border-border-default bg-bg-2 text-text-0 text-xs outline-none focus:border-green" />
          {portableProjectsEnabled && availablePages.length > 0 && <select aria-label={`Choose a page for ${field.label}`} value={selected}
            onChange={event => { if (event.target.value) onChange(event.target.value) }}
            className="mt-1 w-full px-2 py-1.5 rounded border border-border-default bg-bg-2 text-text-0 text-xs outline-none focus:border-green">
            <option value="">Choose a site page...</option>
            {availablePages.map(page => <option key={page.id} value={page.path}>{page.name} ({page.path})</option>)}
          </select>}
        </div>
      )
    }

    case 'text':
      return (
        <div className="mb-2.5">
          <label className="block text-[11.5px] text-text-2 mb-1 font-medium">{field.label}</label>
          <input
            type="text"
            aria-label={field.label}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-2 py-1.5 rounded border border-border-default bg-bg-2 text-text-0 text-xs outline-none focus:border-green"
          />
        </div>
      )

    case 'textarea':
      return (
        <div className="mb-2.5">
          <label className="block text-[11.5px] text-text-2 mb-1 font-medium">{field.label}</label>
          {contentMedia && <div role="toolbar" aria-label="Text formatting" className="mb-1 flex flex-wrap gap-1">
            {(['Bold', 'Italic', 'Heading', 'List'] as const).map(format => <button key={format} type="button" onMouseDown={event => event.preventDefault()} onClick={() => {
              const input = textArea.current
              if (!input) return
              const text = String(value || '')
              let start = input.selectionStart
              let end = input.selectionEnd
              let replacement: string
              let selectStart: number
              let selectEnd: number
              if (format === 'Bold' || format === 'Italic') {
                const marker = format === 'Bold' ? '**' : '*'
                replacement = marker + text.slice(start, end) + marker
                selectStart = start + marker.length
                selectEnd = selectStart + end - start
              } else {
                start = start === 0 ? 0 : text.lastIndexOf('\n', start - 1) + 1
                const lineEnd = text.indexOf('\n', end)
                end = lineEnd < 0 ? text.length : lineEnd
                const prefix = format === 'Heading' ? '## ' : '- '
                replacement = text.slice(start, end).split('\n').map(line => prefix + line).join('\n')
                selectStart = start + prefix.length
                selectEnd = start + replacement.length
              }
              onChange(text.slice(0, start) + replacement + text.slice(end))
              requestAnimationFrame(() => { input.focus(); input.setSelectionRange(selectStart, selectEnd) })
            }} className="rounded border border-border-default bg-bg-3 px-2 py-1 text-[11px] hover:bg-bg-4">{format}</button>)}
          </div>}
          <textarea
            ref={textArea}
            aria-label={field.label}
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className="w-full px-2 py-1.5 rounded border border-border-default bg-bg-2 text-text-0 text-xs outline-none focus:border-green resize-y"
          />
          {contentMedia && portableProjectsEnabled && (pages ?? []).some(page => page.webstudioArticle?.status !== 'draft') && <select aria-label="Insert page link in Body" value="" onChange={event => {
            const page = pages?.find(item => item.id === event.target.value && item.webstudioArticle?.status !== 'draft')
            if (!page) return
            const input = textArea.current
            const text = String(value || '')
            const start = input?.selectionStart ?? text.length
            const end = input?.selectionEnd ?? text.length
            const selected = text.slice(start, end)
            const label = selected || page.name
            if (!label.trim() || label.includes('[') || label.includes(']') || /[\r\n]/.test(label) || /[()]/.test(page.path)) {
              toast.error('Choose plain text for the link and a page address without parentheses.')
              return
            }
            const link = `[${label}](${page.path})`
            onChange(text.slice(0, start) + link + text.slice(end))
            requestAnimationFrame(() => { input?.focus(); input?.setSelectionRange(start + link.length, start + link.length) })
          }} className="mt-1 w-full rounded border border-border-default bg-bg-2 px-2 py-1.5 text-xs text-text-0">
            <option value="">Insert a link to a page...</option>
            {(pages ?? []).filter(page => page.webstudioArticle?.status !== 'draft').map(page => <option key={page.id} value={page.id}>{page.name}</option>)}
          </select>}
          {contentMedia && <p className="mt-1 text-[10px] text-text-3">Select text before choosing a page to use it as the link label.</p>}
          {contentMedia && portableProjectsEnabled && media?.projectId === projectId && media.revision === mediaRevision && media.images.length > 0 && <select aria-label="Insert media link in Body" value="" onChange={event => {
            const asset = media.images.find(item => item.path === event.target.value)
            if (!asset) return
            const label = asset.name.replace(/[\x5b\x5d\r\n]/g, ' ').trim() || 'Open file'
            const current = String(value || '')
            onChange(`${current}${current ? '\n\n' : ''}[${label}](${asset.path})`)
          }} className="mt-1 w-full rounded border border-border-default bg-bg-2 px-2 py-1.5 text-xs text-text-0">
            <option value="">Insert a link to Media...</option>
            {media.images.map(asset => <option key={asset.id} value={asset.path}>{asset.name}</option>)}
          </select>}
        </div>
      )

    case 'select':
      return (
        <div className="mb-2.5">
          <label className="block text-[11.5px] text-text-2 mb-1 font-medium">{field.label}</label>
          <select
            aria-label={field.label}
            value={String(value || (field.key === 'fitMode' ? 'auto' : field.key === 'mobileMode' ? 'viewer' : ''))}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-2 py-1.5 rounded border border-border-default bg-bg-2 text-text-0 text-xs outline-none focus:border-green cursor-pointer"
          >
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      )

    case 'array-strings': {
      const items = (Array.isArray(value) ? value : []) as string[]
      return (
        <div className="mb-2.5">
          <label className="block text-[11.5px] text-text-2 mb-1 font-medium">{field.label}</label>
          {items.map((item, i) => (
            <div key={i} className="flex gap-1 mb-1" onDragOver={event => { if (event.dataTransfer.types.includes('application/x-webstudio-property-item')) { event.preventDefault(); event.dataTransfer.dropEffect = 'move' } }} onDrop={event => {
              const data = event.dataTransfer.getData('application/x-webstudio-property-item'); if (!data) return
              event.preventDefault(); event.stopPropagation()
              try {
                const source = JSON.parse(data) as { block: string; field: string; index: number }
                if (source.block !== block.id || source.field !== field.key || !Number.isInteger(source.index) || source.index < 0 || source.index >= items.length || source.index === i) return
                useConfigStore.getState().editBlockItems(block.id, field.key, source.index, i)
              } catch (error) { toast.error(error instanceof Error ? error.message : 'The item could not be moved.') }
            }}>
              <button type="button" draggable aria-label={`Drag ${field.label} item ${i + 1}`} title="Drag to reorder" className="cursor-grab rounded border border-border-default px-1 text-xs" onDragStart={event => { event.dataTransfer.setData('application/x-webstudio-property-item', JSON.stringify({ block: block.id, field: field.key, index: i })); event.dataTransfer.effectAllowed = 'move' }}>↕</button>
              <input
                type="text"
                aria-label={`${field.label} item ${i + 1}`}
                value={item}
                onChange={(e) => {
                  const updated = [...items]
                  updated[i] = e.target.value
                  onChange(updated)
                }}
                className="min-w-0 flex-1 px-2 py-1 rounded border border-border-default bg-bg-2 text-text-0 text-xs outline-none focus:border-green"
              />
              {([-1, 1] as const).map(delta => <button key={delta} type="button" aria-label={`Move ${field.label} item ${i + 1} ${delta < 0 ? 'up' : 'down'}`} disabled={i + delta < 0 || i + delta >= items.length} className="rounded border border-border-default px-1 text-xs disabled:opacity-40" onClick={() => { try { useConfigStore.getState().editBlockItems(block.id, field.key, i, i + delta) } catch (error) { toast.error(error instanceof Error ? error.message : 'The item could not be moved.') } }}>{delta < 0 ? '↑' : '↓'}</button>)}
              <button
                onClick={() => { try { useConfigStore.getState().editBlockItems(block.id, field.key, i, i, 'remove') } catch (error) { toast.error(error instanceof Error ? error.message : 'The item could not be removed.') } }}
                className="px-1.5 text-text-3 hover:text-status-red text-xs transition-colors"
              >
                x
              </button>
            </div>
          ))}
          <button
            onClick={() => onChange([...items, ''])}
            className="text-[10px] text-green hover:text-green-dim transition-colors mt-0.5"
          >
            + Add item
          </button>
        </div>
      )
    }

    case 'array-items': {
      const items = (Array.isArray(value) ? value : []) as Array<Record<string, string>>
      const images = media?.projectId === projectId && media.revision === mediaRevision ? media.images : []

      // Infer new item shape from existing items, or use sensible defaults per field key
      function createEmptyItem(): Record<string, string> {
        if (items.length > 0) {
          const template: Record<string, string> = {}
          for (const key of Object.keys(items[0])) if (key !== 'assetId') template[key] = ''
          return template
        }
        // Fallback templates by block type + field key
        const blockTemplates: Partial<Record<string, Record<string, Record<string, string>>>> = {
          navbar: { navItems: { label: '', url: '' } },
          footer: { navItems: { label: '', url: '' }, resources: { src: '', alt: '', title: '', description: '', url: '' }, resourceButtons: { label: '', url: '' } },
          testimonials: { items: { name: '', role: '', quote: '' } },
          stats: { items: { value: '', label: '' } },
          faq: { items: { question: '', answer: '' } },
          team: { members: { name: '', role: '' } },
          features: { items: { title: '', description: '' } },
          image: { images: { src: '', alt: '' } },
          gallery: { images: { src: '', alt: '', caption: '' } },
          collage: { images: { src: '', alt: '', x: '', y: '', width: '', height: '', layer: '' } },
          documentLibrary: { items: { title: '', description: '', src: '' } },
        }
        return blockTemplates[block.type]?.[field.key] || (/^section[1-4]Items$/.test(field.key) ? { src: '', alt: '', text: '', url: '' } : { title: '', description: '' })
      }

      if (block.type === 'navbar' && field.key === 'navItems') return (
        <details open className="mb-2.5 rounded border border-border-default bg-bg-2">
          <summary className="cursor-pointer px-2 py-1.5 text-xs font-medium text-text-1">Navigation Links ({items.length})</summary>
          <div className="border-t border-border-default p-2">
            <p className="mb-1 text-[10px] text-text-3">Drag a link to reorder it, or use the arrow buttons.</p>
            {items.map((item, i) => <div key={i} className="mb-1 rounded border border-border-default bg-bg-3" onDragOver={event => {
              if (event.dataTransfer.types.includes('application/x-webstudio-property-item')) { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }
            }} onDrop={event => {
              const data = event.dataTransfer.getData('application/x-webstudio-property-item')
              if (!data) return
              event.preventDefault(); event.stopPropagation()
              try {
                const source = JSON.parse(data) as { block: string; field: string; index: number }
                if (source.block !== block.id || source.field !== field.key || !Number.isInteger(source.index) || source.index < 0 || source.index >= items.length || source.index === i) return
                useConfigStore.getState().editBlockItems(block.id, field.key, source.index, i)
                setExpandedNavIndex(null)
              } catch (error) { toast.error(error instanceof Error ? error.message : 'The link could not be moved.') }
            }}>
              <div className="flex items-center gap-1 px-1 py-1">
                <button type="button" draggable aria-label={`Drag link ${i + 1}`} title="Drag to reorder" className="cursor-grab rounded border border-border-default px-1.5 text-xs active:cursor-grabbing" onDragStart={event => {
                  event.dataTransfer.setData('application/x-webstudio-property-item', JSON.stringify({ block: block.id, field: field.key, index: i })); event.dataTransfer.effectAllowed = 'move'
                }}>↕</button>
                <button type="button" aria-expanded={expandedNavIndex === i} className="min-w-0 flex-1 truncate px-1 text-left text-xs text-text-0" onClick={() => setExpandedNavIndex(expandedNavIndex === i ? null : i)}>{item.label?.trim() || `New link ${i + 1}`}</button>
                {([-1, 1] as const).map(delta => <button key={delta} type="button" aria-label={`Move link ${i + 1} ${delta < 0 ? 'up' : 'down'}`} disabled={i + delta < 0 || i + delta >= items.length} className="rounded border border-border-default px-1 text-xs disabled:opacity-40" onClick={() => {
                  try { useConfigStore.getState().editBlockItems(block.id, field.key, i, i + delta); setExpandedNavIndex(null) } catch (error) { toast.error(error instanceof Error ? error.message : 'The link could not be moved.') }
                }}>{delta < 0 ? '↑' : '↓'}</button>)}
              </div>
              {expandedNavIndex === i && <div className="border-t border-border-default p-2">
                <label className="block text-[10px] text-text-3">Label<input aria-label={`Link ${i + 1} label`} value={item.label || ''} onChange={event => { const updated = [...items]; updated[i] = { ...updated[i], label: event.target.value }; onChange(updated) }} className="mt-1 w-full rounded border border-border-subtle bg-bg-2 px-1.5 py-1 text-xs text-text-0" /></label>
                <label className="mt-2 block text-[10px] text-text-3">Destination<input aria-label={`Link ${i + 1} destination`} value={item.url || ''} onChange={event => { const updated = [...items]; updated[i] = { ...updated[i], url: event.target.value }; onChange(updated) }} className="mt-1 w-full rounded border border-border-subtle bg-bg-2 px-1.5 py-1 text-xs text-text-0" /></label>
                {portableProjectsEnabled && (pages ?? []).some(page => page.webstudioArticle?.status !== 'draft') && <select aria-label={`Choose a page for link ${i + 1}`} value={(pages ?? []).some(page => page.path === item.url && page.webstudioArticle?.status !== 'draft') || (item.url === '/search.html' && siteSearchEnabled) || (item.url === '/articles/index.html' && (pages ?? []).some(page => page.webstudioArticle?.status === 'ready')) ? item.url : ''} onChange={event => {
                  if (!event.target.value) return
                  const updated = [...items]; updated[i] = { ...updated[i], url: event.target.value }; onChange(updated)
                }} className="mt-1 w-full rounded border border-border-subtle bg-bg-2 px-1.5 py-1 text-xs text-text-0">
                  <option value="">Choose a site page...</option>
                  {(pages ?? []).filter(page => page.webstudioArticle?.status !== 'draft').map(page => <option key={page.id} value={page.path}>{page.name} ({page.path})</option>)}
                  {siteSearchEnabled && <option value="/search.html">Search</option>}
                  {(pages ?? []).some(page => page.webstudioArticle?.status === 'ready') && <option value="/articles/index.html">Articles</option>}
                </select>}
                <button type="button" className="mt-2 text-xs text-text-2 hover:text-status-red" onClick={() => {
                  try { useConfigStore.getState().editBlockItems(block.id, field.key, i, i, 'remove'); setExpandedNavIndex(null) } catch (error) { toast.error(error instanceof Error ? error.message : 'The link could not be removed.') }
                }}>Remove link</button>
              </div>}
            </div>)}
            <button type="button" className="mt-1 text-xs text-green hover:text-green-dim" onClick={() => {
              const legacy = Array.isArray(block.props.links) && block.props.links.every(link => typeof link === 'string') ? block.props.links : []
              if (legacy.length) updateBlockProps(block.id, { navItems: [...items, ...legacy.map(label => ({ label, url: '' })), createEmptyItem()], links: [] })
              else onChange([...items, createEmptyItem()])
              setExpandedNavIndex(items.length + legacy.length)
            }}>+ Add link</button>
          </div>
        </details>
      )

      return (
        <div className="mb-2.5">
          <label className="block text-[11.5px] text-text-2 mb-1 font-medium">{field.label}</label>
          {block.type === 'collage' && <p className="mb-1 text-[10px] text-text-3">Select an image on the collage and drag it to move; drag its white corner to resize. Set layer order here; larger numbers appear in front. Positions and sizes are percentages.</p>}
          {block.type === 'navbar' && field.key === 'navItems' && <p className="mb-1 text-[10px] text-text-3">Drag links on the Navbar to change their order.</p>}
          {imageItems && block.type === 'features' && <p className="mb-1 text-[10px] text-text-3">Feature images appear in the alternating layout.</p>}
          {items.map((item, i) => (
            <div key={i} className="bg-bg-2 border border-border-default rounded p-2 mb-1.5" onContextMenu={event => {
              if (event.target instanceof Element && event.target.closest('input,textarea,select')) return
              event.preventDefault(); event.stopPropagation(); setItemMenu({ index: i, x: Math.max(0, Math.min(event.clientX, window.innerWidth - 160)), y: Math.max(0, Math.min(event.clientY, window.innerHeight - 125)) })
            }} onDragOver={event => {
              if (event.dataTransfer.types.includes('application/x-webstudio-property-item')) { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }
            }} onDrop={event => {
              const data = event.dataTransfer.getData('application/x-webstudio-property-item')
              if (!data) return
              event.preventDefault(); event.stopPropagation()
              try {
                const source = JSON.parse(data) as { block: string; field: string; index: number }
                if (source.block !== block.id || source.field !== field.key || !Number.isInteger(source.index) || source.index < 0 || source.index >= items.length || source.index === i) return
                useConfigStore.getState().editBlockItems(block.id, field.key, source.index, i)
              } catch (error) { toast.error(error instanceof Error ? error.message : 'The item could not be moved.') }
            }}>
              <div className="flex items-center justify-between mb-1.5">
                <button type="button" draggable aria-label={`Drag ${field.label} item ${i + 1}`} title="Drag to reorder" className="cursor-grab rounded border border-border-default px-1.5 py-0.5 text-[10px] text-text-1 active:cursor-grabbing" onDragStart={event => {
                  event.dataTransfer.setData('application/x-webstudio-property-item', JSON.stringify({ block: block.id, field: field.key, index: i })); event.dataTransfer.effectAllowed = 'move'
                }}>Item {i + 1} ↕</button>
                <div className="flex gap-1">
                {([-1, 1] as const).map(delta => <button key={delta} type="button" aria-label={`Move ${field.label} item ${i + 1} ${delta < 0 ? 'up' : 'down'}`} disabled={i + delta < 0 || i + delta >= items.length} className="rounded border border-border-default px-1 text-[10px] disabled:opacity-40" onClick={() => {
                  try { useConfigStore.getState().editBlockItems(block.id, field.key, i, i + delta) } catch (error) { toast.error(error instanceof Error ? error.message : 'The item could not be moved.') }
                }}>{delta < 0 ? '↑' : '↓'}</button>)}
                <button
                  onClick={() => {
                    try { useConfigStore.getState().editBlockItems(block.id, field.key, i, i, 'remove') } catch (error) { toast.error(error instanceof Error ? error.message : 'The item could not be removed.') }
                  }}
                  className="text-[10px] text-text-3 hover:text-status-red transition-colors"
                >
                  Remove
                </button>
                </div>
              </div>
              {block.type === 'collage' && <div className="mb-2 flex gap-1">
                {(['Send to back', 'Bring to front'] as const).map(direction => <button key={direction} type="button" className="rounded border border-border-default px-2 py-1 text-[10px]" onClick={() => {
                  const order = items.map((value, index) => ({ index, layer: Math.max(1, Math.min(1000, Number(value.layer) || index + 1)) })).sort((a, b) => a.layer - b.layer || a.index - b.index).filter(entry => entry.index !== i)
                  if (direction === 'Bring to front') order.push({ index: i, layer: 0 })
                  else order.unshift({ index: i, layer: 0 })
                  const updated = items.map((value, index) => ({ ...value, layer: String(order.findIndex(entry => entry.index === index) + 1) }))
                  onChange(updated)
                }}>{direction}</button>)}
              </div>}
              {/^section[1-4]Objects$/.test(field.key) && item.type === 'collage' && <div className="mb-2"><label className="block text-xs">Add collage image from Media</label><select aria-label={`Add image to collage ${i + 1}`} value="" onChange={event => {
                const image = images.find(candidate => candidate.path === event.target.value)
                if (!image) return
                const photos = Array.isArray(item.images) ? item.images as Record<string, unknown>[] : []
                const updated: Record<string, unknown>[] = [...items]
                updated[i] = { ...updated[i], images: [...photos, { src: image.path, alt: image.name, x: String(photos.length % 2 * 50), y: String(Math.floor(photos.length / 2) % 2 * 50), width: '50', height: '50', layer: String(photos.length + 1) }] }
                onChange(updated)
              }} className="mt-1 w-full rounded border border-border-subtle bg-bg-3 px-1.5 py-1 text-xs"><option value="">Choose an image...</option>{images.filter(image => image.mime.startsWith('image/')).map(image => <option key={image.id} value={image.path}>{image.name}</option>)}</select>
                <p className="mt-1 text-[10px] text-text-3">Select the collage, then drag an image or its corner to arrange it.</p>
                {(Array.isArray(item.images) ? item.images as Record<string, unknown>[] : []).map((photo, photoIndex) => <div key={photoIndex} className="mt-1 flex items-center gap-1 text-xs"><span className="min-w-0 flex-1 truncate">{String(photo.alt || `Image ${photoIndex + 1}`)}</span><button type="button" aria-label={`Remove collage image ${photoIndex + 1}`} className="rounded border border-border-default px-1" onClick={() => {
                  const photos = item.images as unknown as Record<string, unknown>[]
                  const updated: Record<string, unknown>[] = [...items]
                  updated[i] = { ...updated[i], images: photos.filter((_, index) => index !== photoIndex) }
                  onChange(updated)
                }}>Remove</button></div>)}
              </div>}
              {Object.entries(mediaItems && !(imageKey in item) ? { ...item, [imageKey]: '' } : item).filter(([key]) => !(mediaItems && key === 'assetId') && !(/^section[1-4]Objects$/.test(field.key) && (key === 'id' || key === 'type' || key === 'parentId' || key === 'images' || key === 'sourceCollageProps'))).map(([key, val]) => (
                <div key={key} className="mb-1">
                  <label className="block text-[10px] text-text-3 mb-0.5">{block.type === 'collage' || /^section[1-4]Objects$/.test(field.key) ? ({ src: 'Image', alt: 'Image description', text: 'Text', url: 'Link', color: 'Panel background color', textColor: 'Text color', fontSize: 'Font size (px)', x: 'Left (%)', y: 'Top (px)', width: 'Width (%)', height: 'Height (px)', layer: 'Layer order' } as Record<string, string>)[key] ?? key : key}</label>
                  <input
                    type="text"
                    aria-label={`${field.label} item ${i + 1} ${key}`}
                    value={String(/^section[1-4]Objects$/.test(field.key) && key === 'text' && typeof item.id === 'string' ? block.props[`sectionObject_${item.id}`] ?? val : val)}
                    onChange={(e) => {
                      const updated = [...items]
                      updated[i] = { ...updated[i], [key]: e.target.value }
                      if (mediaItems && key === imageKey) delete updated[i].assetId
                      if (/^section[1-4]Objects$/.test(field.key) && key === 'text' && typeof item.id === 'string') updateBlockProps(block.id, { [field.key]: updated, [`sectionObject_${item.id}`]: e.target.value, [`sectionObject_${item.id}Rich`]: undefined })
                      else onChange(updated)
                    }}
                    className="w-full px-1.5 py-1 rounded border border-border-subtle bg-bg-3 text-text-0 text-[11px] outline-none focus:border-green"
                  />
                  {/^section[1-4]Objects$/.test(field.key) && (key === 'color' || key === 'textColor') && <WindowsColorInput label={key === 'color' ? 'Choose panel background color' : 'Choose object text color'} value={typeof val === 'string' && /^#[0-9a-f]{6}$/i.test(val) ? val : key === 'color' ? '#ffffff' : '#111111'} onChange={value => { const updated = [...items]; updated[i] = { ...updated[i], [key]: value }; onChange(updated) }} className="mt-1 block h-7 w-full rounded border border-border-default" />}
                  {(block.type === 'navbar' || block.type === 'footer') && field.key === 'navItems' && key === 'url' && portableProjectsEnabled && (pages ?? []).some(page => page.webstudioArticle?.status !== 'draft') && <select
                    aria-label={`Choose a page for ${field.label} item ${i + 1}`}
                    value={(pages ?? []).some(page => page.path === val && page.webstudioArticle?.status !== 'draft') || (val === '/search.html' && siteSearchEnabled) || (val === '/articles/index.html' && (pages ?? []).some(page => page.webstudioArticle?.status === 'ready')) ? val : ''}
                    onChange={event => {
                      if (!event.target.value) return
                      const updated = [...items]
                      updated[i] = { ...updated[i], url: event.target.value }
                      onChange(updated)
                    }}
                    className="mt-1 w-full px-1.5 py-1 rounded border border-border-subtle bg-bg-3 text-text-0 text-[11px] outline-none focus:border-green">
                    <option value="">Choose a site page...</option>
                    {(pages ?? []).filter(page => page.webstudioArticle?.status !== 'draft').map(page => <option key={page.id} value={page.path}>{page.name} ({page.path})</option>)}
                    {siteSearchEnabled && <option value="/search.html">Search</option>}
                    {(pages ?? []).some(page => page.webstudioArticle?.status === 'ready') && <option value="/articles/index.html">Articles</option>}
                  </select>}
                  {mediaItems && key === imageKey && portableProjectsEnabled && images.length > 0 && <select
                    aria-label={`Choose ${documentItems ? 'document' : 'image'} for ${field.label} item ${i + 1}`}
                    value={images.some(image => image.path === val) ? val : ''}
                    onChange={event => {
                      const image = images.find(candidate => candidate.path === event.target.value)
                      if (!image) return
                      const updated = [...items]
                      updated[i] = { ...updated[i], [imageKey]: image.path, assetId: image.id, ...(documentItems && !updated[i].title ? { title: image.name } : {}) }
                      onChange(updated)
                    }}
                    className="mt-1 w-full px-1.5 py-1 rounded border border-border-subtle bg-bg-3 text-text-0 text-[11px] outline-none focus:border-green">
                    <option value="">Choose {documentItems ? 'a document' : 'an image'} from Media...</option>
                    {images.map(image => <option key={image.id} value={image.path}>{image.name}</option>)}
                  </select>}
                </div>
              ))}
            </div>
          ))}
          {itemMenu && createPortal(<div data-property-item-menu role="menu" aria-label={`${field.label} item actions`} className="fixed z-[10001] w-40 rounded border border-gray-400 bg-white p-1 text-sm text-black shadow-lg" style={{ left: itemMenu.x, top: itemMenu.y }}>
            {([-1, 1] as const).map(delta => <button key={delta} type="button" role="menuitem" disabled={itemMenu.index + delta < 0 || itemMenu.index + delta >= items.length} className="block w-full rounded px-3 py-1 text-left hover:bg-blue-100 disabled:opacity-40" onClick={() => {
              try { useConfigStore.getState().editBlockItems(block.id, field.key, itemMenu.index, itemMenu.index + delta) } catch (error) { toast.error(error instanceof Error ? error.message : 'The item could not be moved.') }
              setItemMenu(null)
            }}>Move {delta < 0 ? 'up' : 'down'}</button>)}
            <button type="button" role="menuitem" className="block w-full rounded px-3 py-1 text-left hover:bg-blue-100" onClick={() => {
              try { useConfigStore.getState().editBlockItems(block.id, field.key, itemMenu.index, itemMenu.index, 'duplicate') } catch (error) { toast.error(error instanceof Error ? error.message : 'The item could not be duplicated.') }
              setItemMenu(null)
            }}>Duplicate</button>
            <button type="button" role="menuitem" className="block w-full rounded px-3 py-1 text-left hover:bg-blue-100" onClick={() => {
              try { useConfigStore.getState().editBlockItems(block.id, field.key, itemMenu.index, itemMenu.index, 'remove') } catch (error) { toast.error(error instanceof Error ? error.message : 'The item could not be removed.') }
              setItemMenu(null)
            }}>Remove</button>
          </div>, document.body)}
          {!/^section[1-4]Objects$/.test(field.key) && <button
            onClick={() => {
              if (block.type === 'navbar' && field.key === 'navItems' && Array.isArray(block.props.links) && block.props.links.length > 0 && block.props.links.every(link => typeof link === 'string')) {
                updateBlockProps(block.id, { navItems: [...items, ...block.props.links.map(label => ({ label, url: '' })), createEmptyItem()], links: [] })
              } else onChange([...items, createEmptyItem()])
            }}
            className="text-[10px] text-green hover:text-green-dim transition-colors"
          >
            + Add item
          </button>}
        </div>
      )
    }

    default:
      return null
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border-b border-border-subtle">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-3.5 py-2.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-text-3 hover:text-text-2 transition-colors"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
      </button>
      {open && <div className="px-3.5 pb-3">{children}</div>}
    </div>
  )
}

export function PropertiesPanel({ block }: { block: BlockConfig }) {
  const [showJson, setShowJson] = useState(false)
  const [imageNames, setImageNames] = useState<string[]>([])
  const [textNames, setTextNames] = useState<{ key: string; label: string }[]>([])
  const updateBlock = useConfigStore((state) => state.updateBlock)
  const updateBlockProps = useConfigStore((state) => state.updateBlockProps)
  const selectedImageIndex = useEditorStore(state => state.selectedImageIndex)
  const selectImage = useEditorStore(state => state.selectImage)
  const selectedTextKey = useEditorStore(state => state.selectedTextKey)
  const selectedSection = useEditorStore(state => state.selectedSection)
  const theme = useConfigStore(state => state.config.theme)
  const selectText = useEditorStore(state => state.selectText)
  const schema = Object.hasOwn(blockFields, block.type) ? blockFields[block.type] : undefined
  const adjustments = block.props.imageAdjustments && typeof block.props.imageAdjustments === 'object' && !Array.isArray(block.props.imageAdjustments)
    ? block.props.imageAdjustments as Record<string, Record<string, unknown>> : {}
  const selectedAdjustment = adjustments[String(selectedImageIndex)] ?? {}
  const textAdjustments = block.props.textAdjustments && typeof block.props.textAdjustments === 'object' && !Array.isArray(block.props.textAdjustments)
    ? block.props.textAdjustments as Record<string, Record<string, unknown>> : {}
  const textKey = textNames.some(item => item.key === selectedTextKey) ? selectedTextKey : (textNames[0]?.key ?? '')
  const selectedTextAdjustment = textAdjustments[textKey] ?? {}
  const selectedTextElement = typeof document === 'undefined' ? undefined : Array.from(document.querySelectorAll('[data-webstudio-block-id]')).find(element => element.getAttribute('data-webstudio-block-id') === block.id)?.querySelector<HTMLElement>(`[data-ws-text-key="${textKey}"]`)
  const selectedColorParts = selectedTextElement ? getComputedStyle(selectedTextElement).color.match(/\d+/g)?.slice(0, 3) : null
  const defaultTextColor = selectedColorParts?.length === 3 ? `#${selectedColorParts.map(value => Math.min(255, Number(value)).toString(16).padStart(2, '0')).join('')}` : '#000000'

  useEffect(() => {
    if (selectedSection < 2) return
    document.querySelector<HTMLElement>(`[data-section-properties="${selectedSection}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [block.id, selectedSection])

  useEffect(() => {
    let active = true
    const wrapper = Array.from(document.querySelectorAll('[data-webstudio-block-id]')).find(element => element.getAttribute('data-webstudio-block-id') === block.id)
    const names = Array.from(wrapper?.querySelectorAll('[data-ws-content] img') ?? []).map((image, index) => image.getAttribute('alt') || `Image ${index + 1}`)
    const labels = Array.from(wrapper?.querySelectorAll('[data-ws-content] [data-ws-text-key]') ?? [])
      .map((element, index) => ({ key: element.getAttribute('data-ws-text-key') ?? '', label: element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 70) || `Text ${index + 1}` }))
    void Promise.resolve().then(() => { if (active) { setImageNames(names); setTextNames(labels) } })
    return () => { active = false }
  }, [block])

  return (
    <>
      {/* Header */}
      <div className="px-3.5 py-3 border-b border-border-default flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-2">
          Properties
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-glow text-green font-semibold">
          {block.type}
        </span>
      </div>

      {/* Property sections */}
      {block.type === 'hero' && <Section title="Hero text position">
        <p className="mb-2 text-xs text-text-3">Use these buttons if text moves out of view. Select the text to move or resize its box.</p>
        {(['headline', 'subheadline'] as const).map(field => block.props[`${field}Hidden`] === true && <button key={field} type="button" className="mb-2 mr-2 rounded border border-border-default px-2 py-1 text-xs" onClick={() => updateBlockProps(block.id, { [`${field}Hidden`]: false })}>Restore {field} text box</button>)}
        <div className="flex flex-wrap gap-2">{(['headline', 'subheadline'] as const).map(field => <button key={field} type="button" className="rounded border border-border-default px-2 py-1 text-xs" onClick={() => updateBlockProps(block.id, { [`${field}OffsetX`]: 0, [`${field}OffsetY`]: 0 })}>Reset {field} position</button>)}</div>
        {(['headline', 'subheadline'] as const).map(field => <label key={field} className="mt-2 block text-xs">{field === 'headline' ? 'Headline' : 'Subheadline'} box width (px; blank is automatic)<input type="number" min="40" max="1920" aria-label={`${field} box width`} value={typeof block.props[`${field}Width`] === 'number' ? block.props[`${field}Width`] as number : ''} onChange={event => { const value = event.target.value; updateBlockProps(block.id, { [`${field}Width`]: value === '' ? undefined : Number(value) }) }} onBlur={event => { if (event.target.value !== '') updateBlockProps(block.id, { [`${field}Width`]: Math.max(40, Math.min(1920, Number(event.target.value) || 40)) }) }} className="mt-1 w-full rounded border border-border-default bg-bg-2 p-1 text-xs" /></label>)}
      </Section>}
      <Section title="Block background">
        <label className="block text-xs text-text-2">Background color
          <WindowsColorInput label="Block background color" value={typeof block.props.blockBackgroundColor === 'string' && /^#[0-9a-f]{6}$/i.test(block.props.blockBackgroundColor) ? block.props.blockBackgroundColor : resolveTheme(theme).bg1} onChange={value => updateBlockProps(block.id, { blockBackgroundColor: value })} className="mt-1 block h-9 w-full cursor-pointer rounded border border-border-default p-1" />
        </label>
        <p className="mt-1 text-[10px] text-text-3">{block.props.blockBackgroundColor ? 'Custom block color' : 'Using the block’s default background'}</p>
        <button type="button" onClick={() => updateBlockProps(block.id, { blockBackgroundColor: '' })} className="mt-2 rounded border border-border-default px-2 py-1 text-xs">Reset background</button>
      </Section>
      <Section title="Sections across">
        <label className="block text-xs text-text-2">Number of sections
          <select aria-label="Number of sections" value={Math.min(4, Math.max(1, Number(block.props.sectionCount) || 1))} onChange={event => updateBlockProps(block.id, { sectionCount: Number(event.target.value) })} className="mt-1 w-full rounded border border-border-default bg-bg-2 p-1 text-xs">
            {[1, 2, 3, 4].map(count => <option key={count} value={count}>{count}</option>)}
          </select>
        </label>
        <p className="mt-2 text-[10px] text-text-3">Each section can contain independently positioned text, images, buttons, and panels. Reducing the count keeps hidden section contents for later.</p>
        <button type="button" onClick={() => updateBlockProps(block.id, { sectionWidths: [] })} className="mt-2 rounded border border-border-default px-2 py-1 text-xs">Reset section widths</button>
        <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={block.props.snapSectionObjects === true} onChange={event => updateBlockProps(block.id, { snapSectionObjects: event.target.checked })} /> Snap section objects to alignment guides</label>
        <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={block.props.stackSectionObjectsOnMobile === true} onChange={event => updateBlockProps(block.id, { stackSectionObjectsOnMobile: event.target.checked })} /> Stack section objects on phones</label>
        <p className="mt-1 text-[10px] text-text-3">On narrow screens, stack objects below the section content. Desktop positions stay unchanged.</p>
        {Array.from({ length: Math.min(4, Math.max(1, Number(block.props.sectionCount) || 1)) }, (_, index) => {
          const number = index + 1, key = `section${number}Objects`
          return <div key={key} className="mt-3 border-t border-border-default pt-2"><div className="text-xs font-semibold">Section {number} objects</div><div className="mt-1 flex flex-wrap gap-1">
            {(['text', 'image', 'button', 'panel', 'collage'] as const).map(type => <button key={type} type="button" className="rounded border border-border-default px-2 py-1 text-xs" onClick={() => {
              const items = Array.isArray(block.props[key]) ? block.props[key] : []
              updateBlockProps(block.id, { [key]: [...items, { id: `object-${crypto.randomUUID()}`, type, text: type === 'text' ? 'Text' : type === 'button' ? 'Button' : type === 'panel' ? 'Panel' : '', src: '', alt: '', url: '', color: '#ffffff', textColor: '', fontSize: '', ...(type === 'collage' ? { images: [] } : {}), x: 0, y: items.length * 90, width: 30, height: type === 'collage' ? 180 : 80, layer: items.length + 1 }] })
            }}>Add {type}</button>)}
          </div><PropertyField block={block} field={{ key, label: `Section ${number} objects`, type: 'array-items' }} /></div>
        })}
        <PropertyField block={block} field={{ key: 'section1Items', label: 'Section 1 additional items', type: 'array-items' }} />
        {Array.from({ length: Math.min(4, Math.max(1, Number(block.props.sectionCount) || 1)) - 1 }, (_, i) => {
          const number = i + 2
          return <div key={number} data-section-properties={number} className={`mt-3 border-t border-border-default pt-2 ${selectedSection === number ? 'outline outline-1 outline-[#c3c7cb] rounded' : ''}`}>
            <div className="mb-2 text-xs font-semibold">Section {number}</div>
            <PropertyField block={block} field={{ key: `section${number}Text`, label: `Section ${number} text`, type: 'textarea' }} />
            <PropertyField block={block} field={{ key: `section${number}Image`, label: `Section ${number} image`, type: 'image' }} />
            <PropertyField block={block} field={{ key: `section${number}Alt`, label: `Section ${number} image description`, type: 'text' }} />
            <PropertyField block={block} field={{ key: `section${number}ImageLink`, label: `Section ${number} image link`, type: 'text' }} />
            <PropertyField block={block} field={{ key: `section${number}Items`, label: `Section ${number} additional items`, type: 'array-items' }} />
            <label className="mb-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={block.props[`section${number}TextFirst`] === true} onChange={event => updateBlockProps(block.id, { [`section${number}TextFirst`]: event.target.checked })} /> Put text above image</label>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={block.props[`section${number}Panel`] === true} onChange={event => updateBlockProps(block.id, { [`section${number}Panel`]: event.target.checked })} /> Show this section as a panel</label>
            {block.props[`section${number}Panel`] === true && <label className="mt-2 block text-xs">Panel color <WindowsColorInput label={`Section ${number} panel color`} value={typeof block.props[`section${number}Color`] === 'string' && /^#[0-9a-f]{6}$/i.test(block.props[`section${number}Color`] as string) ? block.props[`section${number}Color`] as string : '#b9aeb6'} onChange={value => updateBlockProps(block.id, { [`section${number}Color`]: value })} className="mt-1 block h-9 w-full rounded border border-border-default p-1" /></label>}
          </div>
        })}
      </Section>
      {schema?.sections.map((section) => (
        <Section key={section.title} title={section.title}>
          {section.fields.filter(field => !(block.type === 'footer' && ((block.variant === 'minimal' && ['logo', 'logoImage'].includes(field.key)) || (block.variant !== 'multi-column' && field.key === 'description')))).map((field) => (
            <PropertyField key={field.key} field={field} block={block} />
          ))}
        </Section>
      )) || (
        <div className="p-3.5 text-[11px] text-text-3">
          No editable properties defined for this block type.
        </div>
      )}

      {imageNames.length > 0 && <Section title="Image size and position">
        <label className="block text-xs text-text-2">Image
          <select aria-label="Choose image to adjust" value={Math.min(selectedImageIndex, imageNames.length - 1)} onChange={event => selectImage(Number(event.target.value))}
            className="mt-1 mb-2 w-full rounded border border-border-default bg-bg-2 p-1 text-xs">
            {imageNames.map((name, index) => <option key={index} value={index}>{index + 1}. {name}</option>)}
          </select>
        </label>
        <p className="mb-2 text-[10px] text-text-3">Select an image on the page or in this list. Blank values use the section default. Position is relative to its normal location.</p>
        {([['width', 'Image width (px)'], ['height', 'Image height (px)'], ['left', 'Move right or left (px)'], ['top', 'Move down or up (px)'], ['layer', 'Image layer order']] as const).map(([key, label]) =>
          <label key={key} className="mb-2 block text-xs text-text-2">{label}
            <input type="number" aria-label={label} value={String(selectedAdjustment[key] ?? '')}
              onChange={event => updateBlockProps(block.id, { imageAdjustments: { ...adjustments, [String(selectedImageIndex)]: { ...selectedAdjustment, [key]: event.target.value } } })}
              className="mt-1 w-full rounded border border-border-default bg-bg-2 p-1 text-xs" />
          </label>)}
        <button type="button" onClick={() => {
          const next = { ...adjustments }; delete next[String(selectedImageIndex)]
          updateBlockProps(block.id, { imageAdjustments: next })
        }} className="rounded border border-border-default px-2 py-1 text-xs">Reset selected image</button>
      </Section>}

      <Section title="Text size and color">
        <p className="mb-2 text-[10px] text-text-3">These settings apply to text in this section. Leave blank for the section defaults.</p>
        <label className="mb-2 block text-xs text-text-2">Text size (px)
          <input type="number" min="8" max="200" aria-label="Section text size (px)" value={String(block.props.textSize ?? '')}
            onChange={event => updateBlockProps(block.id, { textSize: event.target.value })}
            className="mt-1 w-full rounded border border-border-default bg-bg-2 p-1 text-xs" />
        </label>
        <label className="mb-2 block text-xs text-text-2">Text color (#RRGGBB)
          <input type="text" aria-label="Section text color" placeholder="#000000" value={String(block.props.textColor ?? '')}
            onChange={event => updateBlockProps(block.id, { textColor: event.target.value })}
            className="mt-1 w-full rounded border border-border-default bg-bg-2 p-1 text-xs" />
        </label>
        <WindowsColorInput label="Choose section text color" value={typeof block.props.textColor === 'string' && /^#[0-9a-f]{6}$/i.test(block.props.textColor) ? block.props.textColor : defaultTextColor} onChange={value => updateBlockProps(block.id, { textColor: value })} className="mb-2 h-7 w-full rounded border border-border-default" />
        {textNames.length > 0 && <>
          <label className="mb-2 block text-xs text-text-2">Individual text
            <select aria-label="Choose text to adjust" value={textKey} onChange={event => selectText(event.target.value)}
              className="mt-1 w-full rounded border border-border-default bg-bg-2 p-1 text-xs">
              {textNames.map((item, index) => <option key={item.key} value={item.key}>{index + 1}. {item.label}</option>)}
            </select>
          </label>
          {([['size', 'Selected text size (px)'], ['color', 'Selected text color (#RRGGBB)']] as const).map(([key, label]) =>
            <label key={key} className="mb-2 block text-xs text-text-2">{label}
              <input type={key === 'size' ? 'number' : 'text'} aria-label={label} value={String(selectedTextAdjustment[key] ?? '')}
                onChange={event => updateBlockProps(block.id, { textAdjustments: { ...textAdjustments, [textKey]: { ...selectedTextAdjustment, [key]: event.target.value } } })}
                className="mt-1 w-full rounded border border-border-default bg-bg-2 p-1 text-xs" />
            </label>)}
          <WindowsColorInput label="Choose selected text color" value={typeof selectedTextAdjustment.color === 'string' && /^#[0-9a-f]{6}$/i.test(selectedTextAdjustment.color) ? selectedTextAdjustment.color : defaultTextColor} onChange={value => updateBlockProps(block.id, { textAdjustments: { ...textAdjustments, [textKey]: { ...selectedTextAdjustment, color: value } } })} className="mb-2 h-7 w-full rounded border border-border-default" />
          {typeof window !== 'undefined' && window.location.origin === 'https://webstudio.local' && <button type="button" className="mb-2 w-full rounded border border-border-default px-2 py-1 text-left text-xs" onClick={async () => {
            const wrapper = Array.from(document.querySelectorAll('[data-webstudio-block-id]')).find(element => element.getAttribute('data-webstudio-block-id') === block.id)
            const element = Array.from(wrapper?.querySelectorAll<HTMLElement>('[data-ws-text-key]') ?? []).find(item => item.dataset.wsTextKey === textKey)
            if (!element) { toast.error('Select text in the block first.'); return }
            const style = getComputedStyle(element)
            const rgb = style.color.match(/\d+/g)?.slice(0, 3).map(value => Math.min(255, Number(value)).toString(16).padStart(2, '0')).join('')
            try {
              const font = await chooseWindowsFont({ font: style.fontFamily.split(',')[0].replace(/["']/g, '').trim().replace(/[^\p{L}\p{N} ,._-]/gu, '') || 'Arial', size: Math.max(6, Math.min(200, Math.round(parseFloat(style.fontSize) || 16))), color: rgb?.length === 6 ? `#${rgb}` : '#000000', bold: style.fontWeight === 'bold' || Number(style.fontWeight) >= 600, italic: style.fontStyle === 'italic', underline: style.textDecorationLine.includes('underline') })
              if (font) updateBlockProps(block.id, { textAdjustments: { ...textAdjustments, [textKey]: { ...selectedTextAdjustment, ...font } } })
            } catch { toast.error('The Windows font dialog could not be opened.') }
          }}>Font for selected text...</button>}
          <button type="button" onClick={() => {
            const next = { ...textAdjustments }; delete next[textKey]
            updateBlockProps(block.id, { textAdjustments: next })
          }} className="rounded border border-border-default px-2 py-1 text-xs">Reset selected text</button>
        </>}
      </Section>

      <Section title="Screen visibility">
        <p className="mb-2 text-[11px] text-text-3">Choose the screen sizes where this section appears.</p>
        {(['mobile', 'tablet', 'desktop'] as const).map(device => <label key={device} className="flex items-center gap-2 py-1 text-xs text-text-1">
          <input type="checkbox" checked={!block.webstudioHiddenOn?.[device]} onChange={event => updateBlock(block.id, {
            webstudioHiddenOn: { ...block.webstudioHiddenOn, [device]: !event.target.checked },
          })} /> Show on {device}
        </label>)}
        <p className="mt-2 text-[10px] text-text-3">Hidden sections stay available while editing.</p>
      </Section>

      {/* View JSON toggle */}
      <div className="border-t border-border-subtle">
        <button
          onClick={() => setShowJson(!showJson)}
          className="w-full px-3.5 py-2 flex items-center gap-1.5 text-[10px] text-text-3 hover:text-text-2 transition-colors"
        >
          <Code size={11} />
          {showJson ? 'Hide' : 'View'} Block JSON
        </button>
        {showJson && (
          <pre className="px-3.5 pb-3 text-[10px] font-mono text-text-2 leading-relaxed overflow-x-auto max-h-48 overflow-y-auto">
            {JSON.stringify({ id: block.id, type: block.type, variant: block.variant, props: block.props }, null, 2)}
          </pre>
        )}
      </div>
    </>
  )
}
