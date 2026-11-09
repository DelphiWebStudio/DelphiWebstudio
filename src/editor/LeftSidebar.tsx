import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Search, Layout, Type, Grid3X3, DollarSign, Megaphone, PanelBottom, MessageSquare, BarChart3, HelpCircle, Users, Mail, Newspaper, Image, Plus, Minus, Flag, FileText, ImageIcon, Play, GalleryHorizontalEnd, CalendarDays } from 'lucide-react'
import { LayersPanel } from './LayersPanel'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'
import { blockMetadata } from '@/lib/block-metadata'
import type { BlockType, BlockConfig } from '@/blocks/types'
import { ArticlesPanel } from './ArticlesPanel'

const blockIcons: Record<BlockType, typeof Layout> = {
  navbar: Layout, hero: Type, features: Grid3X3, pricing: DollarSign,
  cta: Megaphone, footer: PanelBottom, testimonials: MessageSquare,
  stats: BarChart3, faq: HelpCircle, team: Users, contact: Mail,
  newsletter: Newspaper, logocloud: Image, divider: Minus, banner: Flag,
  content: FileText, image: ImageIcon, video: Play, gallery: GalleryHorizontalEnd, pdfViewer: FileText,
  document: FileText, documentLibrary: FileText, audio: Play, mediaVideo: Play,
  collage: GalleryHorizontalEnd, panel: PanelBottom, calendar: CalendarDays,
}

const noReusableSections: NonNullable<import('@/blocks/types').SiteConfig['webstudioReusableSections']> = []

function ComponentsPanel() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [sectionName, setSectionName] = useState('')
  const sectionDrag = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const addBlock = useConfigStore((s) => s.addBlock)
  const sections = useConfigStore((s) => s.config.webstudioReusableSections ?? noReusableSections)
  const saveReusableSection = useConfigStore((s) => s.saveReusableSection)
  const insertReusableSection = useConfigStore((s) => s.insertReusableSection)
  const removeReusableSection = useConfigStore((s) => s.removeReusableSection)
  const selectedBlockId = useEditorStore((s) => s.selectedBlockId)
  const selectBlock = useEditorStore((s) => s.selectBlock)

  const filtered = blockMetadata.filter((b) =>
    b.type !== 'pricing' && (category === 'All' || b.category === category) && (b.label.toLowerCase().includes(search.toLowerCase()) ||
    b.category.toLowerCase().includes(search.toLowerCase()))
  )

  const grouped = filtered.reduce<Record<string, typeof blockMetadata>>((acc, b) => {
    if (!acc[b.category]) acc[b.category] = []
    acc[b.category].push(b)
    return acc
  }, {})

  function handleAdd(type: BlockType) {
    if (type === 'panel') {
      if (useEditorStore.getState().previewMode) { toast('Exit Preview to add a panel'); return }
      useEditorStore.getState().setTextPlacement({ projectId: useEditorStore.getState().activeProjectId, pageId: useConfigStore.getState().activePageId, kind: 'panel' })
      toast('Click where you want to place the panel. Press Escape to cancel.')
      return
    }
    const meta = blockMetadata.find((b) => b.type === type)
    if (!meta) return
    const block: BlockConfig = {
      id: `block-${crypto.randomUUID()}`,
      type,
      variant: meta.variants[0],
      props: { ...meta.defaultProps },
    }
    const selectedIndex = type === 'divider' ? useConfigStore.getState().getActivePageBlocks().findIndex(item => item.id === selectedBlockId) : -1
    addBlock(block, selectedIndex >= 0 ? selectedIndex + 1 : undefined)
    selectBlock(block.id)
    toast(`${meta.label} added`)
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-3 pt-2.5 pb-1.5"><label className="mb-2 flex items-center gap-2 text-xs">Category<select aria-label="Element category" value={category} onChange={event => setCategory(event.target.value)} className="min-w-0 flex-1 rounded border border-border-default bg-bg-2 p-1"><option>All</option>{[...new Set(blockMetadata.filter(item => item.type !== 'pricing').map(item => item.category))].map(value => <option key={value}>{value}</option>)}</select></label>
        <details className="mb-3 rounded-lg border border-border-default bg-bg-2 p-2" open><summary className="font-semibold">Text styles</summary><div className="mt-2 grid gap-2">{[{ text: 'Heading 1', size: 36 }, { text: 'Heading 2', size: 28 }, { text: 'Heading 3', size: 22 }, { text: 'Paragraph text', size: 16 }].map(preset => <button key={preset.text} type="button" aria-label={preset.text} className="rounded border border-border-default bg-bg-1 p-3 text-left hover:border-green" onClick={() => useEditorStore.getState().setTextPlacement({ projectId: useEditorStore.getState().activeProjectId, pageId: useConfigStore.getState().activePageId, kind: 'text', text: preset.text, fontSize: preset.size })}><span style={{ fontSize: preset.size / 1.4, lineHeight: 1.2 }}>{preset.text}</span><span className="block text-xs text-text-3">{preset.size}px · click, then place on page</span></button>)}</div></details>
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-3" />
          <input
            type="text"
            placeholder="Search components..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-2 py-1.5 rounded-md border border-border-default bg-bg-2 text-text-0 text-[11px] outline-none focus:border-green placeholder:text-text-3"
            style={{ paddingLeft: '1.625rem' }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <button type="button" className="w-full flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-left text-sm text-white hover:bg-blue-600" onClick={() => {
          if (useEditorStore.getState().previewMode) { toast('Exit Preview to add text'); return }
          useEditorStore.getState().setTextPlacement({ projectId: useEditorStore.getState().activeProjectId, pageId: useConfigStore.getState().activePageId })
          toast('Click where you want to place the text. Press Escape to cancel.')
        }}><Type size={16} /> Add text</button>
        <p className="px-2 py-1 text-[11px] text-text-3">Click Add text, then click a section or panel on the page.</p>
        {(['horizontal', 'vertical'] as const).map(orientation => <details key={orientation} className="px-1.5 py-2 border-b border-border-default">
          <summary className="cursor-pointer text-xs font-semibold text-text-1">{orientation === 'horizontal' ? 'Horizontal lines' : 'Vertical lines'}</summary>
          <div className={`mt-2 grid gap-1 ${orientation === 'vertical' ? 'grid-cols-4' : 'grid-cols-1'}`}>
            {([{ name: 'Thin solid', style: 'solid', thickness: 1 }, { name: 'Thick solid', style: 'solid', thickness: 5 }, { name: 'Dashed', style: 'dashed', thickness: 3 }, { name: 'Dotted', style: 'dotted', thickness: 3 }, { name: 'Double', style: 'double', thickness: 5 }] as const).map(line => <button key={line.name} type="button" aria-label={`Add ${orientation} ${line.name.toLowerCase()} line`} title={`${line.name} ${orientation} line`} className="flex min-h-9 items-center justify-center rounded border border-border-default bg-bg-2 px-2 py-1 hover:border-blue-400" onClick={() => {
              if (useEditorStore.getState().previewMode) { toast('Exit Preview to add a line'); return }
              useEditorStore.getState().setTextPlacement({ projectId: useEditorStore.getState().activeProjectId, pageId: useConfigStore.getState().activePageId, kind: 'divider', lineOrientation: orientation, lineStyle: line.style, lineThickness: line.thickness })
              toast('Click where you want to place the line. Press Escape to cancel.')
            }}><span aria-hidden="true" style={orientation === 'horizontal' ? { display: 'block', width: '100%', borderTop: `${line.thickness}px ${line.style} #d5e2ef` } : { display: 'block', height: 30, borderLeft: `${line.thickness}px ${line.style} #d5e2ef` }} /></button>)}
          </div>
        </details>)}
        <details className="px-1.5 pt-2.5 pb-2 border-b border-border-default">
          <summary className="text-[10px] font-semibold uppercase text-text-2 cursor-pointer">Reusable sections</summary>
          <p className="text-[11px] text-text-3 mt-1">Select a section on the page to save a copy for this project.</p>
          <label className="sr-only" htmlFor="reusable-section-name">Section name</label>
          <input id="reusable-section-name" value={sectionName} onChange={event => setSectionName(event.target.value)} placeholder="Section name" className="mt-2 w-full rounded border border-border-default bg-bg-2 px-2 py-1.5 text-xs" />
          <button type="button" disabled={!selectedBlockId || !sectionName.trim()} onClick={() => {
            if (!selectedBlockId) return
            if (!useConfigStore.getState().getActivePageBlocks().some(block => block.id === selectedBlockId)) { toast.error('Select a section on the current page first'); return }
            saveReusableSection(selectedBlockId, sectionName)
            setSectionName('')
            toast('Section saved in this project')
          }} className="mt-1 w-full rounded border border-border-default px-2 py-1.5 text-xs disabled:opacity-40">Save selected section</button>
          {sections.map(section => <div key={section.id} className="mt-2 flex items-center gap-1">
            <button type="button" onClick={() => { insertReusableSection(section.id); toast('Section added to this page') }} className="flex-1 rounded bg-bg-3 px-2 py-1.5 text-left text-xs" title="Add a copy to the current page">{section.name}</button>
            <button type="button" onClick={() => { removeReusableSection(section.id); toast('Saved section removed; use Undo to restore it') }} aria-label={`Remove saved section ${section.name}`} className="rounded px-2 py-1.5 text-xs hover:bg-bg-3">Remove</button>
          </div>)}
        </details>
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-text-3 px-1.5 pt-2.5 pb-1">
              {category}
            </div>
            {items.map((meta) => {
              const Icon = blockIcons[meta.type] || Layout
              return (
                <button
                  key={meta.type}
                  draggable={!['content', 'image', 'cta', 'panel', 'collage'].includes(meta.type)}
                  onDragStart={(event) => { event.dataTransfer.setData('application/x-webstudio-component', meta.type); event.dataTransfer.effectAllowed = 'copy' }}
                  onPointerDown={event => {
                    suppressClick.current = false
                    if (event.button !== 0 || !['content', 'image', 'cta', 'panel', 'collage'].includes(meta.type)) return
                    sectionDrag.current = { x: event.clientX, y: event.clientY, moved: false }
                    event.currentTarget.setPointerCapture(event.pointerId)
                  }}
                  onPointerMove={event => {
                    const drag = sectionDrag.current
                    if (drag && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 6) drag.moved = true
                  }}
                  onPointerCancel={() => { sectionDrag.current = null }}
                  onPointerUp={event => {
                    const drag = sectionDrag.current
                    sectionDrag.current = null
                    if (!drag?.moved) return
                    suppressClick.current = true
                    if (useEditorStore.getState().previewMode) return
                    const element = document.elementFromPoint(event.clientX, event.clientY)
                    const section = element?.closest<HTMLElement>('[data-editor-section]')
                    const number = Number(section?.dataset.editorSection)
                    const blockId = section?.closest('[data-webstudio-block-id]')?.getAttribute('data-webstudio-block-id')
                    const block = useConfigStore.getState().getActivePageBlocks().find(item => item.id === blockId)
                    if (!section || !block || number < 1 || number > 4) {
                      if (element?.closest('[aria-label^="Site preview,"]')) handleAdd(meta.type)
                      return
                    }
                    const bounds = section.getBoundingClientRect()
                    if (!bounds.width) return
                    const key = `section${number}Objects`
                    const items = Array.isArray(block.props[key]) ? block.props[key] as Record<string, unknown>[] : []
                    const hitId = element?.closest('[data-section-object]')?.getAttribute('data-section-object')
                    const parent = items.find(item => item.id === hitId && item.type === 'panel')
                    const type = meta.type === 'content' ? 'text' : meta.type === 'cta' ? 'button' : meta.type
                    const x = Math.max(0, Math.min(70, (event.clientX - bounds.left) / bounds.width * 100))
                    const y = Math.max(0, event.clientY - bounds.top)
                    useConfigStore.getState().updateBlockProps(block.id, { [key]: [...items, { id: `object-${crypto.randomUUID()}`, type, text: type === 'text' ? 'Text' : type === 'button' ? 'Button' : type === 'panel' ? 'Panel' : '', src: '', alt: '', url: '', color: type === 'panel' ? '#b9aeb6' : '#ffffff', textColor: ['text', 'button', 'panel'].includes(type) ? '#000000' : '', fontSize: '', ...(type === 'collage' ? { images: [] } : {}), ...(parent && type !== 'panel' ? { parentId: parent.id } : {}), x, y, width: 30, height: type === 'image' || type === 'collage' ? 180 : 80, layer: Math.max(0, ...items.map(item => Number(item.layer) || 0)) + 1 }] })
                    selectBlock(block.id)
                    useEditorStore.getState().selectSection(number)
                    toast(`${meta.label} added to section ${number}`)
                  }}
                  onClick={() => { if (suppressClick.current) { suppressClick.current = false; return }; handleAdd(meta.type) }}
                  className="mb-2 w-full flex items-center gap-2 border border-border-default bg-bg-2 px-3 py-3 rounded-md text-[12px] text-text-1 hover:bg-bg-3 hover:text-text-0 transition-colors text-left group"
                >
                  <div aria-hidden="true" className="w-16 h-12 rounded border border-border-default bg-bg-3 flex items-center justify-center text-[10px] shrink-0">
                    <Icon size={24} strokeWidth={1.3} />
                  </div>
                  <span className="flex-1">{meta.type === 'content' ? 'Content block' : meta.label}<small className="mt-1 block text-[11px] text-text-3">{meta.variants.length} {meta.variants.length === 1 ? 'style' : 'styles'} · {meta.category}</small></span>
                  <Plus size={11} className="text-text-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )
            })}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-2 py-6 text-center text-[11px] text-text-3">
            No components match "{search}"
          </div>
        )}
      </div>
    </div>
  )
}

type Tab = 'layers' | 'components' | 'media' | 'articles'

export function LeftSidebar({ collapsed = false }: { collapsed?: boolean }) {
  const mode = useEditorStore((state) => state.mode)
  const [tab, setTab] = useState<Tab>(() => mode === 'beginner' ? 'components' : 'layers')

  useEffect(() => { const open = (event: Event) => { const tab = (event as CustomEvent<string>).detail; if (['layers', 'components', 'media', 'articles'].includes(tab)) setTab(tab as Tab) }; window.addEventListener('webstudio.panel', open); return () => window.removeEventListener('webstudio.panel', open) }, [])

  return (
    <div id="editor-left-panel" className={collapsed ? 'hidden' : 'hidden md:flex w-[230px] bg-bg-1 border-r border-border-default flex-col shrink-0'}>
      <div className="flex border-b border-border-default shrink-0">
        <button
          onClick={() => setTab('layers')}
          className={`flex-1 py-2 text-[11px] font-medium transition-colors ${
            tab === 'layers'
              ? 'text-text-0 border-b border-green'
              : 'text-text-3 hover:text-text-1'
          }`}
        >
          Layers
        </button>
        <button
          onClick={() => setTab('components')}
          className={`flex-1 py-2 text-[11px] font-medium transition-colors ${
            tab === 'components'
              ? 'text-text-0 border-b border-green'
              : 'text-text-3 hover:text-text-1'
          }`}
        >
          Components
        </button>
        <button onClick={() => setTab('media')} className={`flex-1 py-2 text-[11px] font-medium transition-all ${tab === 'media' ? 'text-text-0 border-b border-green' : 'text-text-3 hover:text-text-1'}`}>Media</button>
        <button onClick={() => setTab('articles')} className={`flex-1 py-2 text-[11px] font-medium transition-all ${tab === 'articles' ? 'text-text-0 border-b border-green' : 'text-text-3 hover:text-text-1'}`}>Articles</button>
      </div>
      {tab === 'layers' ? <LayersPanel /> : tab === 'components' ? <ComponentsPanel /> : tab === 'media' ? <div className="space-y-2 p-4">
        <button type="button" className="w-full rounded bg-blue-600 px-3 py-2 font-semibold text-white" onClick={() => window.dispatchEvent(new Event('webstudio.media'))}>Open media library</button>
        <button type="button" className="w-full rounded border border-border-default px-3 py-2 font-semibold" onClick={() => window.dispatchEvent(new CustomEvent('webstudio.media', { detail: { manage: true } }))}>Manage Media</button>
      </div> : <ArticlesPanel />}
    </div>
  )
}
