import { useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'
import type { BlockConfig } from './types'

type Item = { id: string; assetId: string; src: string; name: string; mime: string; x: number; y: number; width: number }

export function PlacedMedia({ block, editable = false }: { block: BlockConfig; editable?: boolean }) {
  const items = Array.isArray(block.props.placedMedia) ? block.props.placedMedia as Item[] : []
  const [selected, setSelected] = useState<string | null>(null)
  const [guides, setGuides] = useState<{ vertical?: { x: number; top: number; height: number }; horizontal?: { y: number; left: number; width: number } }>({})
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const drag = useRef<{ id: string; resize: boolean; startX: number; startY: number; grabX: number; grabY: number; x: number; y: number; width: number; parentWidth: number; parentHeight: number } | null>(null)
  const number = (value: unknown, fallback: number, min: number, max: number) => {
    const result = Number(value)
    return Number.isFinite(result) ? Math.max(min, Math.min(max, result)) : fallback
  }
  function begin(event: PointerEvent<HTMLElement>, item: Item, resize: boolean) {
    if (!editable || event.button !== 0 || (!resize && event.target instanceof Element && event.target.closest('audio,video,a,button'))) return
    const parent = event.currentTarget.closest('[data-webstudio-block-id]')
    if (!parent) return
    const rect = parent.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const x = number(item.x, 0, 0, 99), y = number(item.y, 0, 0, 99)
    const itemRect = event.currentTarget.getBoundingClientRect()
    drag.current = { id: item.id, resize, startX: event.clientX, startY: event.clientY, grabX: event.clientX - itemRect.left, grabY: event.clientY - itemRect.top, x, y, width: number(item.width, 25, 1, 100 - x), parentWidth: rect.width, parentHeight: rect.height }
    setSelected(item.id)
    useEditorStore.getState().selectBlock(block.id)
    event.preventDefault(); event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function move(event: PointerEvent<HTMLElement>, finish = false) {
    const state = drag.current
    if (!state) return
    const dx = (event.clientX - state.startX) / state.parentWidth * 100
    const dy = (event.clientY - state.startY) / state.parentHeight * 100
    const x = state.resize ? state.x : Math.max(0, Math.min(100 - state.width, state.x + dx))
    const y = state.resize ? state.y : Math.max(0, Math.min(99, state.y + dy))
    const width = state.resize ? Math.max(1, Math.min(100 - x, state.width + dx)) : state.width
    const element = event.currentTarget.closest<HTMLElement>('[data-placed-media]')
    if (element) Object.assign(element.style, { left: `${!finish && !state.resize ? state.x + dx : x}%`, top: `${!finish && !state.resize ? state.y + dy : y}%`, width: `${width}%` })
    if (!finish && !state.resize && element) {
      const canvas = element.closest('[aria-label^="Site preview"]')
      const current = element.getBoundingClientRect()
      const matches: { vertical?: { x: number; top: number; height: number }; horizontal?: { y: number; left: number; width: number } } = {}
      canvas?.querySelectorAll<HTMLElement>('[data-section-object], [data-placed-media], [data-ws-image-index], [contenteditable="true"]').forEach(other => {
        if (other === element || element.contains(other) || other.contains(element)) return
        const rect = other.getBoundingClientRect()
        if (!rect.width || !rect.height) return
        if (!matches.vertical) for (const [a, b] of [[current.left, rect.left], [current.right, rect.right], [(current.left + current.right) / 2, (rect.left + rect.right) / 2]]) {
          if (Math.abs(a - b) <= 4) { const top = Math.min(current.top, rect.top); matches.vertical = { x: b, top, height: Math.max(current.bottom, rect.bottom) - top }; break }
        }
        if (!matches.horizontal) for (const [a, b] of [[current.top, rect.top], [current.bottom, rect.bottom], [(current.top + current.bottom) / 2, (rect.top + rect.bottom) / 2]]) {
          if (Math.abs(a - b) <= 4) { const left = Math.min(current.left, rect.left); matches.horizontal = { y: b, left, width: Math.max(current.right, rect.right) - left }; break }
        }
      })
      setGuides(matches)
    }
    event.stopPropagation()
    if (finish) {
      setGuides({})
      drag.current = null
      if (!state.resize && element) {
        const previous = element.style.pointerEvents
        element.style.pointerEvents = 'none'
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-webstudio-block-id]')
        element.style.pointerEvents = previous
        const targetId = target?.getAttribute('data-webstudio-block-id')
        if (target && targetId && targetId !== block.id) {
          const rect = target.getBoundingClientRect()
          if (rect.width && rect.height) {
            const nextX = Math.max(0, Math.min(99, (event.clientX - state.grabX - rect.left) / rect.width * 100))
            const nextY = Math.max(0, Math.min(99, (event.clientY - state.grabY - rect.top) / rect.height * 100))
            const nextWidth = Math.max(1, Math.min(100 - nextX, state.width * state.parentWidth / rect.width))
            useConfigStore.getState().movePlacedMedia(block.id, targetId, state.id, Math.round(nextX * 10) / 10, Math.round(nextY * 10) / 10, Math.round(nextWidth * 10) / 10)
            useEditorStore.getState().selectBlock(targetId)
            return
          }
        }
      }
      const original = useConfigStore.getState().getActivePageBlocks().find(candidate => candidate.id === block.id)
      const saved = Array.isArray(original?.props.placedMedia) ? original.props.placedMedia as Item[] : []
      if (saved.some(item => item.id === state.id)) useConfigStore.getState().updateBlockProps(block.id, { placedMedia: saved.map(item => item.id === state.id ? { ...item, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, width: Math.round(width * 10) / 10 } : item) })
    }
  }
  return <>
    {items.filter(item => item && typeof item.id === 'string' && typeof item.src === 'string' && typeof item.mime === 'string').map(item => {
      const x = number(item.x, 0, 0, 99), y = number(item.y, 0, 0, 99), width = number(item.width, 25, 1, 100 - x)
      return <div key={item.id} data-placed-media={item.id} tabIndex={editable ? 0 : undefined} aria-label={editable ? `${item.name || 'Media'}; press Enter to add space below` : undefined} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: `${width}%`, '--ws-item-width': width, zIndex: 10, ...(editable && selected === item.id ? { outline: '1px solid white' } : {}), ...(editable ? { cursor: 'move', touchAction: 'none' } : {}) } as CSSProperties}
        onPointerDown={event => begin(event, item, false)} onPointerMove={event => move(event)} onPointerUp={event => move(event, true)} onPointerCancel={() => { drag.current = null; setGuides({}) }}
        onClick={event => { if (editable) { event.preventDefault(); event.stopPropagation(); event.currentTarget.focus({ preventScroll: true }); setSelected(item.id); useEditorStore.getState().selectBlock(block.id) } }}
        onKeyDown={event => { if (!editable || event.target !== event.currentTarget || event.key !== 'Enter' || !item.mime.startsWith('image/')) return; const current = useConfigStore.getState().getActivePageBlocks().find(value => value.id === block.id); if (current) useConfigStore.getState().updateBlockProps(block.id, { section1ExtraSpace: Math.min(4000, Math.max(0, Number(current.props.section1ExtraSpace) || 0) + 32) }); event.preventDefault(); event.stopPropagation() }}
        onContextMenu={event => { if (editable) { event.preventDefault(); event.stopPropagation(); setSelected(item.id); setMenu({ id: item.id, x: event.clientX, y: event.clientY }) } }}>
        {item.mime.startsWith('image/') ? <img src={item.src} alt={item.name || ''} draggable={false} loading="lazy" style={{ display: 'block', width: '100%', height: 'auto' }} />
          : item.mime.startsWith('audio/') ? <audio controls src={item.src} aria-label={item.name} style={{ width: '100%' }} />
            : item.mime.startsWith('video/') ? <video controls src={item.src} aria-label={item.name} style={{ width: '100%', height: 'auto' }} />
              : <a href={item.src} download>{item.name || 'Open document'}</a>}
        {editable && selected === item.id && <button type="button" aria-label={`Resize ${item.name || 'media'}`} title="Drag to resize" style={{ position: 'absolute', right: 0, bottom: 0, width: 12, height: 12, background: 'white', border: '1px solid black', cursor: 'nwse-resize', touchAction: 'none' }} onPointerDown={event => begin(event, item, true)} onPointerMove={event => move(event)} onPointerUp={event => move(event, true)} onClick={event => event.stopPropagation()} />}
      </div>
    })}
    {editable && (guides.vertical || guides.horizontal) && createPortal(<div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10000 }}>
      {guides.vertical && <div style={{ position: 'fixed', left: guides.vertical.x, top: guides.vertical.top, height: guides.vertical.height, width: 1, background: '#1683e5' }} />}
      {guides.horizontal && <div style={{ position: 'fixed', left: guides.horizontal.left, top: guides.horizontal.y, width: guides.horizontal.width, height: 1, background: '#1683e5' }} />}
    </div>, document.body)}
    {editable && menu && createPortal(<div role="menu" aria-label="Media actions" style={{ position: 'fixed', left: Math.max(0, Math.min(menu.x, window.innerWidth - 150)), top: Math.max(0, Math.min(menu.y, window.innerHeight - 50)), zIndex: 10001 }} className="rounded border border-gray-400 bg-white p-1 text-sm text-black shadow-lg" onClick={event => event.stopPropagation()} onMouseLeave={() => setMenu(null)}>
      <button type="button" role="menuitem" className="rounded px-3 py-1 hover:bg-blue-100" onClick={() => {
        const original = useConfigStore.getState().getActivePageBlocks().find(candidate => candidate.id === block.id)
        const saved = Array.isArray(original?.props.placedMedia) ? original.props.placedMedia as Item[] : []
        useConfigStore.getState().updateBlockProps(block.id, { placedMedia: saved.filter(item => item.id !== menu.id) })
        setMenu(null); setSelected(null)
      }}>Remove from page</button>
    </div>, document.body)}
  </>
}
