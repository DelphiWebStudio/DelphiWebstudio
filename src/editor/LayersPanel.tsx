import { useState } from 'react'
import { toast } from 'sonner'
import {
  Layout, Type, Grid3X3, DollarSign, Megaphone, PanelBottom,
  MessageSquare, BarChart3, HelpCircle, Users, Mail, Newspaper, Image,
  Copy, Trash2, GripVertical, Plus, Search, Minus, Flag,
  FileText, ImageIcon, Play, GalleryHorizontalEnd, CalendarDays,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'
import { blockMetadata } from '@/lib/block-metadata'
import type { BlockType, BlockConfig } from '@/blocks/types'

const blockIcons: Record<BlockType, typeof Layout> = {
  navbar: Layout, hero: Type, features: Grid3X3, pricing: DollarSign,
  cta: Megaphone, footer: PanelBottom, testimonials: MessageSquare,
  stats: BarChart3, faq: HelpCircle, team: Users, contact: Mail,
  newsletter: Newspaper, logocloud: Image, divider: Minus, banner: Flag,
  content: FileText, image: ImageIcon, video: Play, gallery: GalleryHorizontalEnd, pdfViewer: FileText,
  document: FileText, documentLibrary: FileText, audio: Play, mediaVideo: Play,
  collage: GalleryHorizontalEnd, panel: PanelBottom, calendar: CalendarDays,
}

const blockLabels: Record<BlockType, string> = {
  navbar: 'Navbar', hero: 'Hero', features: 'Features', pricing: 'Pricing',
  cta: 'CTA', footer: 'Footer', testimonials: 'Testimonials', stats: 'Stats',
  faq: 'FAQ', team: 'Team', contact: 'Contact', newsletter: 'Newsletter',
  logocloud: 'Logo Cloud', divider: 'Divider', banner: 'Banner',
  content: 'Content', image: 'Image', video: 'Video', gallery: 'Gallery', pdfViewer: 'PDF viewer',
  document: 'Document', documentLibrary: 'Document library', audio: 'Audio', mediaVideo: 'Video file',
  collage: 'Photo collage', panel: 'Panel', calendar: 'Calendar',
}

const compositeFields: Partial<Record<BlockType, string[]>> = {
  features: ['items'], faq: ['items'], gallery: ['images'], logocloud: ['logos'],
  stats: ['items'], team: ['members'], testimonials: ['items'], documentLibrary: ['items'],
}

function SortableLayer({ block, isSelected, onSelect, onDuplicate, onRemove }: {
  block: BlockConfig
  isSelected: boolean
  onSelect: () => void
  onDuplicate: () => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id })
  const Icon = Object.hasOwn(blockIcons, block.type) ? blockIcons[block.type] : Layout
  const label = Object.hasOwn(blockLabels, block.type) ? blockLabels[block.type] : `Unsupported: ${block.type}`

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`group px-2.5 py-2 rounded-md text-[12.5px] flex items-center gap-2 transition-all cursor-pointer select-none relative ${
        isSelected ? 'bg-green-glow text-green' : 'text-text-1 hover:bg-bg-3 hover:text-text-0'
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-text-3 cursor-grab active:cursor-grabbing"
        aria-label={`Drag to reorder ${label}`}
      >
        <GripVertical size={12} />
      </div>

      <div className={`w-[26px] h-[26px] rounded flex items-center justify-center text-[11px] shrink-0 border ${
        isSelected ? 'border-green/30 bg-green-glow' : 'border-border-default bg-bg-3'
      }`}>
        <Icon size={13} />
      </div>

      <span className="font-medium flex-1">{label}</span>

      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onDuplicate() }}
          className="w-[22px] h-[22px] rounded flex items-center justify-center text-text-3 hover:bg-bg-4 hover:text-text-0 transition-all"
          aria-label={`Duplicate ${label}`}
        >
          <Copy size={11} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="w-[22px] h-[22px] rounded flex items-center justify-center text-text-3 hover:bg-status-red/10 hover:text-status-red transition-all"
          aria-label={`Remove ${label}`}
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  )
}

function AddComponentPopover({ onAdd, onClose }: { onAdd: (type: BlockType) => void; onClose: () => void }) {
  const [search, setSearch] = useState('')
  const filtered = blockMetadata.filter((b) =>
    b.type !== 'pricing' && (b.label.toLowerCase().includes(search.toLowerCase()) ||
    b.category.toLowerCase().includes(search.toLowerCase()))
  )

  const grouped = filtered.reduce<Record<string, typeof blockMetadata>>((acc, b) => {
    if (!acc[b.category]) acc[b.category] = []
    acc[b.category].push(b)
    return acc
  }, {})

  return (
    <div className="absolute bottom-[52px] left-2 right-2 bg-bg-2 border border-border-default rounded-lg p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.4)] z-10 max-h-[280px] overflow-y-auto">
      <input
        autoFocus
        type="text"
        placeholder="Search components..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        className="w-full px-2 py-1.5 rounded border border-border-default bg-bg-3 text-text-0 text-[11.5px] outline-none focus:border-green mb-1"
      />
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <div className="text-[9px] font-semibold uppercase tracking-wider text-text-3 px-1.5 pt-2 pb-1">
            {category}
          </div>
          {items.map((meta) => {
            const Icon = blockIcons[meta.type] || Layout
            return (
              <button
                key={meta.type}
                onClick={() => { onAdd(meta.type); onClose() }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[12px] text-text-1 hover:bg-bg-3 hover:text-text-0 transition-colors text-left"
              >
                <div className="w-[22px] h-[22px] rounded border border-border-default bg-bg-3 flex items-center justify-center text-[10px] shrink-0">
                  <Icon size={12} />
                </div>
                <span>{meta.label}</span>
                <span className="ml-auto text-[10px] text-text-3">{meta.variants.length}v</span>
              </button>
            )
          })}
        </div>
      ))}
      {filtered.length === 0 && (
        <div className="px-2 py-3 text-center text-[11px] text-text-3 flex items-center justify-center gap-1.5">
          <Search size={12} />
          No components match "{search}"
        </div>
      )}
    </div>
  )
}

export function LayersPanel() {
  const blocks = useConfigStore((s) => {
    const pages = s.config.pages
    if (!pages || pages.length === 0) return s.config.blocks
    const page = pages.find((p) => p.id === s.activePageId) ?? pages[0]
    return page.blocks
  })
  const { duplicateBlock, removeBlock, moveBlock, addBlock } = useConfigStore()
  const { selectedBlockId, selectBlock, selectedSectionObject, selectionPreference, setSelectionPreference } = useEditorStore()
  const [showPopover, setShowPopover] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = blocks.findIndex((b) => b.id === active.id)
    const newIndex = blocks.findIndex((b) => b.id === over.id)
    if (oldIndex !== -1 && newIndex !== -1) {
      moveBlock(oldIndex, newIndex)
    }
  }

  function handleAddBlock(type: BlockType) {
    const meta = blockMetadata.find((b) => b.type === type)
    if (!meta) return
    const block: BlockConfig = {
      id: `block-${crypto.randomUUID()}`,
      type,
      variant: meta.variants[0],
      props: { ...meta.defaultProps },
    }
    addBlock(block)
    selectBlock(block.id)
    toast(`${meta.label} added`)
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-3">
          Layers
        </span>
        <span className="text-[10px] text-text-3">{blocks.length}</span>
      </div>
      <label className="px-3 pb-2 text-xs text-text-2">Click overlapping items
        <select aria-label="Overlapping item selection" value={selectionPreference} onChange={event => setSelectionPreference(event.target.value as 'parent' | 'child')} className="mt-1 w-full rounded border border-border-default bg-bg-3 p-1 text-text-0">
          <option value="parent">Select panel first</option>
          <option value="child">Select top item first</option>
        </select>
        <span className="block pt-1 text-[10px]">Click text to edit. Ctrl+click selects the top item. Shift+click selects several objects.</span>
      </label>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            {blocks.map((block) => (
              <div key={block.id}>
              <SortableLayer
                key={block.id}
                block={block}
                isSelected={selectedBlockId === block.id}
                onSelect={() => selectBlock(block.id)}
                onDuplicate={() => { duplicateBlock(block.id); toast('Block duplicated') }}
                onRemove={() => {
                  if (selectedBlockId === block.id) selectBlock(null)
                  removeBlock(block.id)
                  toast('Block removed', {
                    action: {
                      label: 'Undo',
                      onClick: () => {
                        useConfigStore.getState().undo()
                        toast('Block restored')
                      },
                    },
                    duration: 3000,
                  })
                }}
              />
              {[1, 2, 3, 4].map(section => {
                const values = block.props[`section${section}Objects`]
                const items = Array.isArray(values) ? values.filter((value): value is Record<string, unknown> => !!value && typeof value === 'object' && typeof value.id === 'string') : []
                if (!items.length) return null
                return <details key={section} open={selectedBlockId === block.id || undefined} className="ml-6 text-xs text-text-2">
                  <summary className="cursor-pointer py-1">Section {section} objects ({items.length})</summary>
                  {[...items].sort((a, b) => (Number(b.layer) || 0) - (Number(a.layer) || 0)).map(item => {
                    const id = item.id as string
                    const name = typeof item.alt === 'string' && item.alt ? item.alt : typeof item.text === 'string' ? item.text : ''
                    const label = `${String(item.type || 'Object')}${name ? `: ${name.slice(0, 32)}` : ''}`
                    const active = selectedSectionObject?.blockId === block.id && selectedSectionObject.section === section && selectedSectionObject.id === id
                    return <div key={id} className="flex items-center" onDragOver={event => { if (event.dataTransfer.types.includes('application/x-webstudio-layer')) { event.preventDefault(); event.dataTransfer.dropEffect = 'move' } }} onDrop={event => {
                      const source = event.dataTransfer.getData('application/x-webstudio-layer')
                      let dragged: { blockId?: string; section?: number; id?: string }
                      try { dragged = JSON.parse(source) as typeof dragged } catch { return }
                      if (dragged.blockId !== block.id || dragged.section !== section || dragged.id === id) return
                      event.preventDefault(); event.stopPropagation()
                      const ordered = items.map((value, position) => ({ value, position })).sort((a, b) => (Number(b.value.layer) || 1) - (Number(a.value.layer) || 1) || b.position - a.position)
                      const from = ordered.findIndex(entry => entry.value.id === dragged.id), to = ordered.findIndex(entry => entry.value.id === id)
                      if (from < 0 || to < 0) return
                      const [entry] = ordered.splice(from, 1); ordered.splice(to, 0, entry)
                      useConfigStore.getState().updateBlockProps(block.id, { [`section${section}Objects`]: items.map(value => ({ ...value, layer: ordered.length - ordered.findIndex(entry => entry.value.id === value.id) })) })
                    }}><button type="button" draggable onDragStart={event => { event.stopPropagation(); event.dataTransfer.setData('application/x-webstudio-layer', JSON.stringify({ blockId: block.id, section, id })); event.dataTransfer.effectAllowed = 'move' }} className={`min-w-0 flex-1 truncate rounded px-2 py-1 text-left ${active ? 'bg-green-glow text-green' : 'hover:bg-bg-3'}`} onClick={() => {
                      selectBlock(block.id); const editor = useEditorStore.getState(); editor.selectSection(section); editor.selectSectionObject({ blockId: block.id, section, id })
                      requestAnimationFrame(() => Array.from(document.querySelectorAll<HTMLElement>('[data-section-object]')).find(element => element.dataset.sectionObject === id && element.closest('[data-webstudio-block-id]')?.getAttribute('data-webstudio-block-id') === block.id)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }))
                    }}>{label}</button>{(['forward', 'backward'] as const).map(direction => <button type="button" key={direction} aria-label={`Move ${label} ${direction}`} className="px-1 hover:bg-bg-3" onClick={() => {
                      const ordered = items.map((value, position) => ({ value, position })).sort((a, b) => (Number(a.value.layer) || 1) - (Number(b.value.layer) || 1) || a.position - b.position)
                      const from = ordered.findIndex(entry => entry.value.id === id), to = from + (direction === 'forward' ? 1 : -1)
                      if (from < 0 || to < 0 || to >= ordered.length) return
                      const [entry] = ordered.splice(from, 1); ordered.splice(to, 0, entry)
                      useConfigStore.getState().updateBlockProps(block.id, { [`section${section}Objects`]: items.map(value => ({ ...value, layer: ordered.findIndex(entry => entry.value.id === value.id) + 1 })) })
                    }}>{direction === 'forward' ? '↑' : '↓'}</button>)}</div>
                  })}
                </details>
              })}
              {(compositeFields[block.type] ?? []).map(field => {
                const values = block.props[field]
                if (!Array.isArray(values) || !values.length) return null
                return <details key={field} className="ml-6 text-xs text-text-2"><summary className="cursor-pointer py-1">{field} ({values.length})</summary>{values.map((value: unknown, index: number) => {
                  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {}
                  const name = [data.title, data.name, data.question, data.alt, data.label].find(item => typeof item === 'string' && item.trim())
                  const label = `${field} ${index + 1}${typeof name === 'string' ? `: ${name.slice(0, 32)}` : ''}`
                  return <div key={index} className="flex items-center"><button type="button" className="min-w-0 flex-1 truncate rounded px-2 py-1 text-left hover:bg-bg-3" onClick={() => {
                    selectBlock(block.id); useEditorStore.getState().selectCompositeItem({ blockId: block.id, field, index })
                    requestAnimationFrame(() => Array.from(document.querySelectorAll<HTMLElement>('[data-ws-item-field][data-ws-item-index]')).find(element => element.dataset.wsItemField === field && Number(element.dataset.wsItemIndex) === index && element.closest('[data-webstudio-block-id]')?.getAttribute('data-webstudio-block-id') === block.id)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }))
                  }}>{label}</button>{[-1, 1].map(offset => <button type="button" key={offset} disabled={index + offset < 0 || index + offset >= values.length} aria-label={`Move ${label} ${offset < 0 ? 'up' : 'down'}`} className="px-1 hover:bg-bg-3 disabled:opacity-30" onClick={() => { try { useConfigStore.getState().editBlockItems(block.id, field, index, index + offset); useEditorStore.getState().selectCompositeItem({ blockId: block.id, field, index: index + offset }) } catch { toast.error('This layout cannot reorder these formatted items.') } }}>{offset < 0 ? '↑' : '↓'}</button>)}</div>
                })}</details>
              })}
              {Array.isArray(block.props.placedMedia) && block.props.placedMedia.length > 0 && <details className="ml-6 text-xs text-text-2"><summary className="cursor-pointer py-1">Placed media ({block.props.placedMedia.length})</summary>{block.props.placedMedia.map((value: unknown) => {
                if (!value || typeof value !== 'object' || typeof (value as { id?: unknown }).id !== 'string') return null
                const item = value as { id: string; alt?: string; type?: string }
                return <button key={item.id} type="button" className="block w-full rounded px-2 py-1 text-left hover:bg-bg-3" onClick={() => { selectBlock(block.id); useEditorStore.getState().selectPlacedMedia({ blockId: block.id, id: item.id }); requestAnimationFrame(() => Array.from(document.querySelectorAll<HTMLElement>('[data-placed-media]')).find(element => element.dataset.placedMedia === item.id && element.closest('[data-webstudio-block-id]')?.getAttribute('data-webstudio-block-id') === block.id)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })) }}>{item.type || 'Media'}{item.alt ? `: ${item.alt.slice(0, 32)}` : ''}</button>
              })}</details>}
              </div>
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* Add component */}
      <div className="p-2 border-t border-border-subtle relative">
        <button
          onClick={() => setShowPopover(!showPopover)}
          className="w-full py-2 rounded-md border border-dashed border-border-default text-text-2 text-xs flex items-center justify-center gap-1.5 transition-all hover:border-green hover:text-green hover:bg-green-glow2"
        >
          <Plus size={13} />
          Add Component
        </button>
        {showPopover && (
          <AddComponentPopover onAdd={handleAddBlock} onClose={() => setShowPopover(false)} />
        )}
      </div>
    </div>
  )
}
