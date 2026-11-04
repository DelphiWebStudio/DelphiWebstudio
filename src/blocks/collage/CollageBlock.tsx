import { useRef, useState, type PointerEvent } from 'react'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'
import type { BlockConfig } from '../types'

type Photo = { src?: string; alt?: string; x?: string; y?: string; width?: string; height?: string; layer?: string }

export function CollageBlock({ block, editable = false, sectionObject }: { block: BlockConfig; editable?: boolean; sectionObject?: { section: number; id: string } }) {
  const images = Array.isArray(block.props.images) ? block.props.images as Photo[] : []
  const [selected, setSelected] = useState<number | null>(null)
  const canvas = useRef<HTMLDivElement>(null)
  const drag = useRef<{ index: number; resize: boolean; x: number; y: number; left: number; top: number; width: number; height: number; canvasWidth: number; canvasHeight: number } | null>(null)
  const number = (value: unknown, fallback: number, min: number, max: number) => {
    const result = value === '' || value == null ? fallback : Number(value)
    return Number.isFinite(result) ? Math.min(max, Math.max(min, result)) : fallback
  }
  function begin(event: PointerEvent<HTMLElement>, index: number, resize: boolean) {
    if (!editable || event.button !== 0 || !canvas.current) return
    const rect = canvas.current.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const item = images[index]
    const left = number(item.x, index % 2 * 50, 0, 95)
    const top = number(item.y, Math.floor(index / 2) % 2 * 50, 0, 95)
    const width = number(item.width, 50, 5, 100 - left)
    const height = number(item.height, 50, 5, 100 - top)
    drag.current = { index, resize, x: event.clientX, y: event.clientY, left, top, width, height, canvasWidth: rect.width, canvasHeight: rect.height }
    setSelected(index)
    useEditorStore.getState().selectBlock(block.id)
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function move(event: PointerEvent<HTMLElement>, finish = false) {
    const state = drag.current
    if (!state || !canvas.current) return
    const dx = (event.clientX - state.x) / state.canvasWidth * 100
    const dy = (event.clientY - state.y) / state.canvasHeight * 100
    const left = state.resize ? state.left : Math.max(0, Math.min(100 - state.width, state.left + dx))
    const top = state.resize ? state.top : Math.max(0, Math.min(100 - state.height, state.top + dy))
    const width = state.resize ? Math.max(5, Math.min(100 - left, state.width + dx)) : state.width
    const height = state.resize ? Math.max(5, Math.min(100 - top, state.height + dy)) : state.height
    const layer = canvas.current.querySelector<HTMLElement>(`[data-collage-layer="${state.index}"]`)
    if (layer) Object.assign(layer.style, { left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` })
    event.stopPropagation()
    if (finish) {
      drag.current = null
      const original = useConfigStore.getState().getActivePageBlocks().find(item => item.id === block.id)
      const objectKey = sectionObject ? `section${sectionObject.section}Objects` : ''
      const objects = sectionObject && Array.isArray(original?.props[objectKey]) ? original.props[objectKey] as Record<string, unknown>[] : []
      const savedObject = objects.find(item => item.id === sectionObject?.id)
      const saved = sectionObject ? (Array.isArray(savedObject?.images) ? savedObject.images as Photo[] : []) : (Array.isArray(original?.props.images) ? original.props.images as Photo[] : [])
      if (saved[state.index]) {
        const updated = saved.map((item, i) => i === state.index ? { ...item, x: String(Math.round(left)), y: String(Math.round(top)), width: String(Math.round(width)), height: String(Math.round(height)) } : item)
        useConfigStore.getState().updateBlockProps(block.id, sectionObject ? { [objectKey]: objects.map(item => item.id === sectionObject.id ? { ...item, images: updated } : item) } : { images: updated })
      }
    }
  }
  return <div ref={canvas} data-collage-canvas style={{ position: 'relative', width: '100%', ...(sectionObject ? { height: '100%' } : { aspectRatio: '3 / 2' }), overflow: 'hidden' }}>
    {editable && images.length === 0 && <p className="p-4 text-sm">Add photos in Properties. Select a photo to move or resize it.</p>}
    {images.map((item, index) => {
      const left = number(item.x, index % 2 * 50, 0, 95)
      const top = number(item.y, Math.floor(index / 2) % 2 * 50, 0, 95)
      const width = number(item.width, 50, 5, 100 - left)
      const height = number(item.height, 50, 5, 100 - top)
      return <div key={index} data-collage-layer={index} style={{ position: 'absolute', left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`, zIndex: number(item.layer, index + 1, 1, 1000), touchAction: editable ? 'none' : undefined, outline: editable && selected === index ? '1px solid white' : undefined, cursor: editable ? 'move' : undefined }}
        onPointerDown={event => begin(event, index, false)} onPointerMove={event => move(event)} onPointerUp={event => move(event, true)} onPointerCancel={() => { drag.current = null }}>
        {item.src && <img src={item.src} alt={item.alt || ''} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
        {editable && selected === index && <button type="button" aria-label={`Resize collage image ${index + 1}`} title="Drag to resize" style={{ position: 'absolute', right: 0, bottom: 0, width: 12, height: 12, background: 'white', border: '1px solid black', cursor: 'nwse-resize', touchAction: 'none' }} onPointerDown={event => begin(event, index, true)} onPointerMove={event => move(event)} onPointerUp={event => move(event, true)} onClick={event => event.stopPropagation()} />}
      </div>
    })}
  </div>
}
