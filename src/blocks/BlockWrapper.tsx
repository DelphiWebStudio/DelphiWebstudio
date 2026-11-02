import { type ReactNode, type PointerEvent as ReactPointerEvent, useRef, useEffect, useLayoutEffect } from 'react'
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
  const dragRef = useRef<{ kind: 'move' | 'resize'; direction: string; x: number; y: number; width: number; left: number; top: number; height: number; pageWidth: number; minTop: number } | null>(null)
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

  function startImageDrag(event: ReactPointerEvent<HTMLElement>, kind: 'move' | 'resize', direction = '') {
    if (event.button !== 0) return
    const element = revealRef.current
    if (!element?.parentElement) return
    const pageWidth = element.parentElement.getBoundingClientRect().width
    if (!pageWidth) return
    const image = element.querySelector('img')
    const height = image?.getBoundingClientRect().height || element.getBoundingClientRect().height
    const canvas = element.closest('[aria-label^="Site preview"]')
    const minTop = canvas ? top + canvas.getBoundingClientRect().top - element.getBoundingClientRect().top : -2000
    dragRef.current = { kind, direction, x: event.clientX, y: event.clientY, width, left, top, height, pageWidth, minTop: Math.max(-2000, minTop) }
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveImageDrag(event: ReactPointerEvent<HTMLElement>, finish = false) {
    const drag = dragRef.current
    const element = revealRef.current
    if (!drag || !element) return
    const dx = (event.clientX - drag.x) / drag.pageWidth * 100
    const dy = event.clientY - drag.y
    let nextLeft = drag.left
    let nextTop = drag.top
    let nextWidth = drag.width
    let nextHeight = drag.height
    if (drag.kind === 'move') {
      nextLeft = Math.max(0, Math.min(100 - drag.width, drag.left + dx))
      nextTop = Math.max(drag.minTop, Math.min(2000, drag.top + dy))
    } else {
      if (drag.direction.includes('e')) nextWidth = Math.max(5, Math.min(100 - drag.left, drag.width + dx))
      if (drag.direction.includes('w')) {
        nextLeft = Math.max(0, Math.min(drag.left + drag.width - 5, drag.left + dx))
        nextWidth = drag.width + drag.left - nextLeft
      }
      if (drag.direction.includes('s')) nextHeight = Math.max(40, Math.min(2000, drag.height + dy))
      if (drag.direction.includes('n')) {
        nextTop = Math.max(drag.minTop, Math.max(drag.top + drag.height - 2000, Math.min(drag.top + drag.height - 40, drag.top + dy)))
        nextHeight = drag.height + drag.top - nextTop
      }
    }
    if (finish) {
      dragRef.current = null
      useConfigStore.getState().updateBlockProps(block.id, drag.kind === 'move'
        ? { layoutLeft: Math.round(nextLeft), layoutTop: Math.round(nextTop) }
        : { layoutLeft: Math.round(nextLeft), layoutTop: Math.round(nextTop), layoutWidth: Math.round(nextWidth), layoutHeight: Math.round(nextHeight) })
    } else if (drag.kind === 'move') {
      element.style.marginLeft = `${nextLeft}%`
      element.style.marginTop = `${nextTop}px`
    } else {
      element.style.marginLeft = `${nextLeft}%`
      element.style.marginTop = `${nextTop}px`
      element.style.width = `${nextWidth}%`
      const image = element.querySelector('img')
      if (image) image.style.height = `${nextHeight}px`
    }
  }

  return (
    <div
      ref={revealRef}
      data-webstudio-block-id={block.id}
      data-ws-scope={scope}
      onPointerDown={event => {
        if (imageLayout && isSelected && event.target instanceof HTMLImageElement) startImageDrag(event, 'move')
      }}
      onPointerMove={event => moveImageDrag(event)}
      onPointerUp={event => moveImageDrag(event, true)}
      onPointerCancel={() => {
        if (!dragRef.current) return
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
        imageLayout ? (isSelected ? 'outline outline-1 outline-white -outline-offset-1' : '') : isSelected
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
      {!imageLayout && <span
        className={`absolute top-1.5 left-1.5 text-[9px] font-semibold uppercase tracking-wider text-green bg-green-glow px-1.5 py-0.5 rounded transition-opacity z-10 ${
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        {block.type}
      </span>}

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
      {imageLayout && isSelected && ([
        ['nw', 'top-0 left-0 cursor-nwse-resize'], ['n', 'top-0 left-1/2 -translate-x-1/2 cursor-ns-resize'],
        ['ne', 'top-0 right-0 cursor-nesw-resize'], ['e', 'top-1/2 right-0 -translate-y-1/2 cursor-ew-resize'],
        ['se', 'bottom-0 right-0 cursor-nwse-resize'], ['s', 'bottom-0 left-1/2 -translate-x-1/2 cursor-ns-resize'],
        ['sw', 'bottom-0 left-0 cursor-nesw-resize'], ['w', 'top-1/2 left-0 -translate-y-1/2 cursor-ew-resize'],
      ] as const).map(([direction, position]) => <button
        key={direction} type="button" aria-label={`Resize image ${direction}`} title="Drag to resize image"
        className={`absolute z-20 h-3 w-3 border border-black bg-white touch-none ${position}`}
        onClick={event => event.stopPropagation()}
        onPointerDown={event => startImageDrag(event, 'resize', direction)}
        onPointerMove={event => { event.stopPropagation(); moveImageDrag(event) }}
        onPointerUp={event => { event.stopPropagation(); moveImageDrag(event, true) }}
      />)}
    </div>
  )
}
