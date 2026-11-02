import { type ReactNode, useRef, useEffect, useLayoutEffect } from 'react'
import { Copy, Trash2, ChevronUp, ChevronDown, Globe } from 'lucide-react'
import { toast } from 'sonner'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'
import { useScrollReveal } from '@/lib/useScrollReveal'
import type { BlockConfig } from './types'

interface Props {
  block: BlockConfig
  isSelected: boolean
  hiddenOnCurrentWidth?: boolean
  onSelect: () => void
  children: ReactNode
}

export function BlockWrapper({ block, isSelected, hiddenOnCurrentWidth, onSelect, children }: Props) {
  const blocks = useConfigStore((s) => {
    const pages = s.config.pages
    if (!pages || pages.length === 0) return s.config.blocks
    const page = pages.find((p) => p.id === s.activePageId) ?? pages[0]
    return page.blocks
  })
  const { duplicateBlock, removeBlock, moveBlock, shareSectionAcrossPages, unshareSection } = useConfigStore()
  const { selectedBlockId, selectBlock } = useEditorStore()
  const previewMode = useEditorStore((s) => s.previewMode)
  const dragRef = useRef<{ kind: 'move' | 'resize'; x: number; y: number; width: number; left: number; top: number; height: number; pageWidth: number } | null>(null)
  const { ref: revealRef, isRevealed } = useScrollReveal(!previewMode)

  const imageLayout = block.type === 'image'
  const widthValue = Number(block.props.layoutWidth)
  const leftValue = Number(block.props.layoutLeft)
  const topValue = Number(block.props.layoutTop)
  const layerValue = Number(block.props.layoutLayer)
  const width = Number.isFinite(widthValue) && widthValue > 0 ? Math.max(5, Math.min(100, widthValue)) : 100
  const left = Number.isFinite(leftValue) ? Math.max(0, Math.min(100 - width, leftValue)) : 0
  const top = Number.isFinite(topValue) ? Math.max(-2000, Math.min(2000, topValue)) : 0
  const layer = Number.isFinite(layerValue) && layerValue > 0 ? Math.max(1, Math.min(100, Math.round(layerValue))) : 1
  const layoutStyle = imageLayout ? { position: 'relative' as const, width: `${width}%`, marginLeft: `${left}%`, marginTop: top, zIndex: layer } : undefined

  const index = blocks.findIndex((b) => b.id === block.id)
  const isFirst = index === 0
  const isLast = index === blocks.length - 1

  useEffect(() => {
    if (isSelected && revealRef.current) {
      revealRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isSelected, revealRef])

  useLayoutEffect(() => {
    revealRef.current?.querySelectorAll('[data-ws-content] img').forEach((image, imageIndex) => {
      image.setAttribute('data-ws-image-index', String(imageIndex))
    })
    const counts: Record<string, number> = {}
    revealRef.current?.querySelectorAll('[data-ws-content] :is(h1,h2,h3,h4,h5,h6,p,span,a,li,label)').forEach(element => {
      const tag = element.tagName.toLowerCase()
      const ordinal = counts[tag] ?? 0
      counts[tag] = ordinal + 1
      element.setAttribute('data-ws-text-key', `${tag}-${ordinal}`)
    })
  }, [children, revealRef])

  const scope = `ws-${index}`
  const selector = `[data-ws-scope="${scope}"] [data-ws-content]`
  const textSize = Number(block.props.textSize)
  const textColor = typeof block.props.textColor === 'string' && /^#[0-9a-f]{6}$/i.test(block.props.textColor) ? block.props.textColor : ''
  const textRules = [
    Number.isFinite(textSize) && textSize >= 8 && textSize <= 200 ? `font-size:${textSize}px!important` : '',
    textColor ? `color:${textColor}!important` : '',
  ].filter(Boolean).join(';')
  const adjustments = block.props.imageAdjustments && typeof block.props.imageAdjustments === 'object' && !Array.isArray(block.props.imageAdjustments)
    ? block.props.imageAdjustments as Record<string, Record<string, unknown>> : {}
  const imageRules = Object.entries(adjustments).flatMap(([key, value]) => {
    if (!/^\d{1,4}$/.test(key) || !value || typeof value !== 'object' || Array.isArray(value)) return []
    const declarations = [
      value.width !== '' && Number.isFinite(Number(value.width)) && Number(value.width) > 0 ? `width:${Math.min(2000, Math.max(10, Number(value.width)))}px!important;max-width:none!important` : '',
      value.height !== '' && Number.isFinite(Number(value.height)) && Number(value.height) > 0 ? `height:${Math.min(2000, Math.max(10, Number(value.height)))}px!important` : '',
      value.left !== '' && Number.isFinite(Number(value.left)) ? `left:${Math.min(2000, Math.max(-2000, Number(value.left)))}px!important` : '',
      value.top !== '' && Number.isFinite(Number(value.top)) ? `top:${Math.min(2000, Math.max(-2000, Number(value.top)))}px!important` : '',
      value.layer !== '' && Number.isFinite(Number(value.layer)) ? `z-index:${Math.min(100, Math.max(1, Math.round(Number(value.layer))))}!important` : '',
    ].filter(Boolean).join(';')
    return declarations ? [`${selector} img[data-ws-image-index="${key}"]{position:relative!important;${declarations}}`, `${selector} :has(> img[data-ws-image-index="${key}"]){overflow:visible!important}`] : []
  }).join('')
  const textAdjustments = block.props.textAdjustments && typeof block.props.textAdjustments === 'object' && !Array.isArray(block.props.textAdjustments)
    ? block.props.textAdjustments as Record<string, Record<string, unknown>> : {}
  const individualTextRules = Object.entries(textAdjustments).flatMap(([key, value]) => {
    if (!/^(h[1-6]|p|span|a|li|label)-\d{1,4}$/.test(key) || !value || typeof value !== 'object' || Array.isArray(value)) return []
    const size = Number(value.size)
    const color = typeof value.color === 'string' && /^#[0-9a-f]{6}$/i.test(value.color) ? value.color : ''
    const declarations = [
      Number.isFinite(size) && size >= 8 && size <= 200 ? `font-size:${size}px!important` : '',
      color ? `color:${color}!important` : '',
    ].filter(Boolean).join(';')
    return declarations ? [`${selector} [data-ws-text-key="${key}"]{${declarations}}`] : []
  }).join('')
  const customStyle = (textRules ? `${selector} :is(h1,h2,h3,h4,h5,h6,p,span,a,li,label){${textRules}}` : '') + individualTextRules + imageRules

  if (previewMode) {
    return (
      <div
        ref={revealRef}
        className={isRevealed ? 'scroll-revealed' : ''}
        style={layoutStyle}
        data-ws-scope={scope}
      >
        {customStyle && <style>{customStyle}</style>}
        <div data-ws-content>{children}</div>
      </div>
    )
  }

  return (
    <div
      ref={revealRef}
      data-webstudio-block-id={block.id}
      data-ws-scope={scope}
      onClick={(e) => {
        if (e.target instanceof Element && e.target.closest('a')) e.preventDefault()
        onSelect()
        if (e.target instanceof HTMLImageElement && e.target.hasAttribute('data-ws-image-index')) {
          useEditorStore.getState().selectImage(Number(e.target.getAttribute('data-ws-image-index')))
        }
        if (e.target instanceof Element) {
          const textElement = e.target.closest('[data-ws-text-key]')
          if (textElement && e.currentTarget.contains(textElement)) useEditorStore.getState().selectText(textElement.getAttribute('data-ws-text-key') ?? '')
        }
        e.stopPropagation()
      }}
      className={`scroll-revealed relative cursor-pointer border-b border-border-subtle group transition-[opacity,transform] duration-500 ${
        isRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      } ${
        isSelected
          ? 'bg-green-glow2 outline outline-2 outline-green -outline-offset-2 rounded animate-select-pulse'
          : 'hover:bg-green-glow2'
      }`}
      role="button"
      aria-label={`${block.type} block${isSelected ? ', selected' : ''}`}
      aria-selected={isSelected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      style={{ ...layoutStyle, transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
    >
      {/* Block type tag */}
      {hiddenOnCurrentWidth && <span className="absolute top-8 left-1.5 text-[10px] bg-bg-2 border border-border-default rounded px-1.5 py-0.5 z-10">Hidden at this width in preview and export</span>}
      <span
        className={`absolute top-1.5 left-1.5 text-[9px] font-semibold uppercase tracking-wider text-green bg-green-glow px-1.5 py-0.5 rounded transition-opacity z-10 ${
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        {block.type}
      </span>

      {/* Action buttons */}
      <div
        className={`absolute top-1.5 right-1.5 flex gap-0.5 z-10 transition-opacity ${
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        {(block.type === 'navbar' || block.type === 'footer') && <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            try {
              if (block.webstudioSharedSectionId) {
                unshareSection(block.id)
                toast('Sections are now independent on each page')
              } else {
                shareSectionAcrossPages(block.id)
                toast('Section shared across pages; edits update every copy')
              }
            } catch (error) { toast.error(error instanceof Error ? error.message : 'Section could not be shared') }
          }}
          className="w-6 h-6 rounded bg-bg-2/80 border border-border-default flex items-center justify-center text-text-3 hover:text-text-0"
          title={block.webstudioSharedSectionId ? 'Stop sharing across pages' : 'Share across pages'}
          aria-label={block.webstudioSharedSectionId ? `Stop sharing ${block.type} across pages` : `Share ${block.type} across pages`}
        ><Globe size={12} /></button>}
        {!isFirst && (
          <button
            onClick={(e) => { e.stopPropagation(); moveBlock(index, index - 1) }}
            className="w-6 h-6 rounded bg-bg-2/80 border border-border-default backdrop-blur-sm flex items-center justify-center text-text-3 hover:text-text-0 hover:bg-bg-3 transition-colors"
            title="Move up"
            aria-label={`Move ${block.type} block up`}
          >
            <ChevronUp size={12} />
          </button>
        )}
        {!isLast && (
          <button
            onClick={(e) => { e.stopPropagation(); moveBlock(index, index + 1) }}
            className="w-6 h-6 rounded bg-bg-2/80 border border-border-default backdrop-blur-sm flex items-center justify-center text-text-3 hover:text-text-0 hover:bg-bg-3 transition-colors"
            title="Move down"
            aria-label={`Move ${block.type} block down`}
          >
            <ChevronDown size={12} />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); duplicateBlock(block.id) }}
          className="w-6 h-6 rounded bg-bg-2/80 border border-border-default backdrop-blur-sm flex items-center justify-center text-text-3 hover:text-text-0 hover:bg-bg-3 transition-colors"
          title="Duplicate"
          aria-label={`Duplicate ${block.type} block`}
        >
          <Copy size={12} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
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
          className="w-6 h-6 rounded bg-bg-2/80 border border-border-default backdrop-blur-sm flex items-center justify-center text-text-3 hover:text-status-red hover:bg-status-red/10 transition-colors"
          title="Delete"
          aria-label={`Delete ${block.type} block`}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {customStyle && <style>{customStyle}</style>}
      <div data-ws-content>{children}</div>
      {imageLayout && isSelected && <div className="absolute bottom-1 right-1 z-20 flex gap-1">
        {(['move', 'resize'] as const).map(kind => <button
          key={kind}
          type="button"
          aria-label={kind === 'move' ? 'Move image' : 'Resize image'}
          title={kind === 'move' ? 'Drag to move image' : 'Drag to resize image'}
          className="rounded border border-white bg-blue-700 px-2 py-1 text-xs font-semibold text-white touch-none"
          onClick={event => event.stopPropagation()}
          onPointerDown={event => {
            event.preventDefault()
            event.stopPropagation()
            const element = revealRef.current
            if (!element?.parentElement) return
            const pageWidth = element.parentElement.getBoundingClientRect().width
            const image = element.querySelector('img')
            const height = image?.getBoundingClientRect().height || element.getBoundingClientRect().height
            if (!pageWidth) return
            dragRef.current = { kind, x: event.clientX, y: event.clientY, width, left, top, height, pageWidth }
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={event => {
            const drag = dragRef.current
            const element = revealRef.current
            if (!drag || !element) return
            const dx = (event.clientX - drag.x) / drag.pageWidth * 100
            const dy = event.clientY - drag.y
            if (drag.kind === 'move') {
              element.style.marginLeft = `${Math.max(0, Math.min(100 - drag.width, drag.left + dx))}%`
              element.style.marginTop = `${Math.max(-2000, Math.min(2000, drag.top + dy))}px`
            } else {
              element.style.width = `${Math.max(5, Math.min(100 - drag.left, drag.width + dx))}%`
              const image = element.querySelector('img')
              if (image) image.style.height = `${Math.max(40, Math.min(2000, drag.height + dy))}px`
            }
          }}
          onPointerUp={event => {
            const drag = dragRef.current
            dragRef.current = null
            if (!drag) return
            const dx = (event.clientX - drag.x) / drag.pageWidth * 100
            const dy = event.clientY - drag.y
            useConfigStore.getState().updateBlockProps(block.id, drag.kind === 'move'
              ? { layoutLeft: Math.round(Math.max(0, Math.min(100 - drag.width, drag.left + dx))), layoutTop: Math.round(Math.max(-2000, Math.min(2000, drag.top + dy))) }
              : { layoutWidth: Math.round(Math.max(5, Math.min(100 - drag.left, drag.width + dx))), layoutHeight: Math.round(Math.max(40, Math.min(2000, drag.height + dy))) })
          }}
          onPointerCancel={() => {
            dragRef.current = null
            const element = revealRef.current
            if (element) {
              element.style.width = `${width}%`
              element.style.marginLeft = `${left}%`
              element.style.marginTop = `${top}px`
              const image = element.querySelector('img')
              const height = Number(block.props.layoutHeight)
              if (image) image.style.height = Number.isFinite(height) && height > 0 ? `${Math.max(40, Math.min(2000, height))}px` : ''
            }
          }}
        >{kind === 'move' ? 'Move' : 'Resize'}</button>)}
      </div>}
    </div>
  )
}
