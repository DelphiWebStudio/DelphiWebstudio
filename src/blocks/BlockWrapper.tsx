import { type ReactNode, type PointerEvent as ReactPointerEvent, useRef, useState, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
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
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ kind: 'move' | 'resize'; direction: string; x: number; y: number; width: number; left: number; top: number; height: number; pageWidth: number; minTop: number } | null>(null)
  const { ref: revealRef, isRevealed } = useScrollReveal(!previewMode)

  const imageLayout = block.type === 'image'
  const navbarLayout = block.type === 'navbar'
  const resizableLayout = imageLayout || navbarLayout
  const widthValue = Number(block.props.layoutWidth)
  const leftValue = Number(block.props.layoutLeft)
  const topValue = Number(block.props.layoutTop)
  const layerValue = Number(block.props.layoutLayer)
  const width = Number.isFinite(widthValue) && widthValue > 0 ? Math.max(5, Math.min(100, widthValue)) : 100
  const left = Number.isFinite(leftValue) ? Math.max(0, Math.min(100 - width, leftValue)) : 0
  const top = Number.isFinite(topValue) ? Math.max(-2000, Math.min(2000, topValue)) : 0
  const layer = Number.isFinite(layerValue) && layerValue > 0 ? Math.max(1, Math.min(100, Math.round(layerValue))) : 1
  const requestedHeight = Number(block.props.layoutHeight)
  const navbarHeight = navbarLayout && Number.isFinite(requestedHeight) && requestedHeight > 0 ? Math.max(40, Math.min(2000, requestedHeight)) : undefined
  const layoutStyle = resizableLayout ? { position: 'relative' as const, width: `${width}%`, marginLeft: `${left}%`, marginTop: top, zIndex: layer, ...(navbarHeight ? { height: navbarHeight } : {}) } : undefined

  const index = blocks.findIndex((b) => b.id === block.id)
  const isFirst = index === 0
  const isLast = index === blocks.length - 1

  useLayoutEffect(() => {
    if (!contextMenu || !menuRef.current) return
    const menu = menuRef.current
    const bounds = menu.getBoundingClientRect()
    menu.style.left = `${Math.max(0, Math.min(contextMenu.x, window.innerWidth - bounds.width))}px`
    menu.style.top = `${Math.max(0, Math.min(contextMenu.y, window.innerHeight - bounds.height))}px`
    menu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
  }, [contextMenu])

  useEffect(() => {
    if (!contextMenu) return
    const dismiss = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setContextMenu(null) }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setContextMenu(null); revealRef.current?.focus(); return }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
      const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
      if (!buttons.length) return
      event.preventDefault()
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
      buttons[(current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length].focus()
    }
    const onResize = () => setContextMenu(null)
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize) }
  }, [contextMenu, revealRef])

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
  const customStyle = (textRules ? `${selector} :is(h1,h2,h3,h4,h5,h6,p,span,a,li,label){${textRules}}` : '') + individualTextRules + imageRules + (navbarHeight ? `${selector},${selector}>nav{height:100%}${selector}>nav{padding-block:4px}` : '')

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
    const height = (imageLayout ? image?.getBoundingClientRect().height : 0) || element.getBoundingClientRect().height
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
      if (navbarLayout) element.style.height = `${nextHeight}px`
      else {
        const image = element.querySelector('img')
        if (image) image.style.height = `${nextHeight}px`
      }
    }
  }

  return (
    <div
      ref={revealRef}
      data-webstudio-block-id={block.id}
      data-ws-scope={scope}
      onContextMenu={event => {
        event.preventDefault()
        event.stopPropagation()
        onSelect()
        setContextMenu({ x: event.clientX, y: event.clientY })
      }}
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
          if (navbarLayout) element.style.height = navbarHeight ? `${navbarHeight}px` : ''
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
        resizableLayout ? (isSelected ? 'outline outline-1 outline-white -outline-offset-1' : '') : isSelected
          ? 'bg-green-glow2 outline outline-2 outline-green -outline-offset-2 rounded animate-select-pulse'
          : 'hover:bg-green-glow2'
      }`}
      role="button"
      aria-label={`${block.type} block${isSelected ? ', selected' : ''}`}
      aria-selected={isSelected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
          e.preventDefault()
          const bounds = e.currentTarget.getBoundingClientRect()
          onSelect()
          setContextMenu({ x: bounds.left + 10, y: bounds.top + 10 })
          return
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      style={{ ...layoutStyle, transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
    >
      {/* Block type tag */}
      {hiddenOnCurrentWidth && <span className="absolute top-8 left-1.5 text-[10px] bg-bg-2 border border-border-default rounded px-1.5 py-0.5 z-10">Hidden at this width in preview and export</span>}
      {!resizableLayout && <span
        className={`absolute top-8 left-1.5 text-[9px] font-semibold uppercase tracking-wider text-green bg-green-glow px-1.5 py-0.5 rounded transition-opacity z-10 ${
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        {block.type}
      </span>}

      {contextMenu && createPortal(<div
        ref={menuRef} role="menu" aria-label={`${block.type} block actions`}
        className="fixed z-[10000] min-w-48 rounded border border-gray-400 bg-white p-1 text-sm text-black shadow-lg"
        style={{ left: contextMenu.x, top: contextMenu.y }}
        onClick={event => event.stopPropagation()} onContextMenu={event => event.preventDefault()}
      >
        <button type="button" role="menuitem" disabled={isFirst} className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left hover:bg-blue-100 focus:bg-blue-100 disabled:opacity-40" onClick={() => { setContextMenu(null); moveBlock(index, index - 1) }}><ChevronUp size={15} />Move up</button>
        <button type="button" role="menuitem" disabled={isLast} className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left hover:bg-blue-100 focus:bg-blue-100 disabled:opacity-40" onClick={() => { setContextMenu(null); moveBlock(index, index + 1) }}><ChevronDown size={15} />Move down</button>
        <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left hover:bg-blue-100 focus:bg-blue-100" onClick={() => { setContextMenu(null); duplicateBlock(block.id) }}><Copy size={15} />Duplicate</button>
        {(block.type === 'navbar' || block.type === 'footer') && <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left hover:bg-blue-100 focus:bg-blue-100" onClick={() => {
          setContextMenu(null)
          try {
            if (block.webstudioSharedSectionId) { unshareSection(block.id); toast('Sections are now independent on each page') }
            else { shareSectionAcrossPages(block.id); toast('Section shared across pages; edits update every copy') }
          } catch (error) { toast.error(error instanceof Error ? error.message : 'Section could not be shared') }
        }}><Globe size={15} />{block.webstudioSharedSectionId ? 'Stop sharing across pages' : 'Share across pages'}</button>}
        <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left hover:bg-blue-100 focus:bg-blue-100" onClick={() => {
          setContextMenu(null)
          if (selectedBlockId === block.id) selectBlock(null)
          removeBlock(block.id)
          toast('Block removed', { action: { label: 'Undo', onClick: () => { useConfigStore.getState().undo(); toast('Block restored') } }, duration: 3000 })
        }}><Trash2 size={15} />Delete</button>
      </div>, document.body)}

      {customStyle && <style>{customStyle}</style>}
      <div data-ws-content>{children}</div>
      {resizableLayout && isSelected && ([
        ['nw', 'top-0 left-0 cursor-nwse-resize'], ['n', 'top-0 left-1/2 -translate-x-1/2 cursor-ns-resize'],
        ['ne', 'top-0 right-0 cursor-nesw-resize'], ['e', 'top-1/2 right-0 -translate-y-1/2 cursor-ew-resize'],
        ['se', 'bottom-0 right-0 cursor-nwse-resize'], ['s', 'bottom-0 left-1/2 -translate-x-1/2 cursor-ns-resize'],
        ['sw', 'bottom-0 left-0 cursor-nesw-resize'], ['w', 'top-1/2 left-0 -translate-y-1/2 cursor-ew-resize'],
      ] as const).map(([direction, position]) => <button
        key={direction} type="button" aria-label={`Resize ${imageLayout ? 'image' : 'navbar'} ${direction}`} title={`Drag to resize ${imageLayout ? 'image' : 'navbar'}`}
        className={`absolute z-20 h-3 w-3 border border-black bg-white touch-none ${position}`}
        onClick={event => event.stopPropagation()}
        onPointerDown={event => startImageDrag(event, 'resize', direction)}
        onPointerMove={event => { event.stopPropagation(); moveImageDrag(event) }}
        onPointerUp={event => { event.stopPropagation(); moveImageDrag(event, true) }}
      />)}
    </div>
  )
}
