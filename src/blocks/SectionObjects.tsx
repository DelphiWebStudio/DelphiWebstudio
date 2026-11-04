import { useRef, useState, type PointerEvent } from 'react'
import { useConfigStore } from '@/store/configStore'
import type { BlockConfig } from './types'
import { RichText } from './RichText'

type SectionObject = { id: string; type: 'text' | 'image' | 'button' | 'panel'; text?: string; src?: string; alt?: string; url?: string; color?: string; textColor?: string; fontSize?: number; x: number; y: number; width: number; height: number; layer: number }

export function SectionObjects({ block, section, editable }: { block: BlockConfig; section: number; editable: boolean }) {
  const key = `section${section}Objects`
  const objects = Array.isArray(block.props[key]) ? block.props[key] as SectionObject[] : []
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const drag = useRef<{ id: string; startX: number; startY: number; grabX: number; grabY: number; x: number; y: number; width: number; height: number; parentWidth: number; resize: boolean } | null>(null)
  function move(event: PointerEvent<HTMLElement>, finish = false) {
    const state = drag.current
    if (!state) return
    const dx = (event.clientX - state.startX) / state.parentWidth * 100
    const dy = event.clientY - state.startY
    const x = state.resize ? state.x : Math.max(0, Math.min(100 - state.width, state.x + dx))
    const y = state.resize ? state.y : Math.max(0, state.y + dy)
    const width = state.resize ? Math.max(5, Math.min(100 - x, state.width + dx)) : state.width
    const height = state.resize ? Math.max(24, state.height + dy) : state.height
    const element = event.currentTarget.closest<HTMLElement>('[data-section-object]')
    if (element) Object.assign(element.style, { left: `${!finish && !state.resize ? state.x + dx : x}%`, top: `${!finish && !state.resize ? state.y + dy : y}px`, width: `${width}%`, height: `${height}px` })
    event.preventDefault(); event.stopPropagation()
    if (finish) {
      drag.current = null
      const current = useConfigStore.getState().getActivePageBlocks().find(value => value.id === block.id)
      const saved = Array.isArray(current?.props[key]) ? current.props[key] as SectionObject[] : []
      if (!state.resize && element && current) {
        const previous = element.style.pointerEvents
        element.style.pointerEvents = 'none'
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-editor-section]')
        element.style.pointerEvents = previous
        const targetSection = Number(target?.dataset.editorSection)
        const targetBlock = target?.closest('[data-webstudio-block-id]')?.getAttribute('data-webstudio-block-id')
        const area = target?.querySelector<HTMLElement>(`[data-section-object-area="${targetSection}"]`)
        const moving = saved.find(item => item.id === state.id)
        if (moving && area && targetBlock && targetSection >= 1 && targetSection <= 4 && (targetBlock !== block.id || targetSection !== section)) {
          const bounds = area.getBoundingClientRect()
          const nextWidth = bounds.width ? Math.max(5, Math.min(100, width * state.parentWidth / bounds.width)) : width
          const nextX = bounds.width ? Math.max(0, Math.min(100 - nextWidth, (event.clientX - state.grabX - bounds.left) / bounds.width * 100)) : 0
          useConfigStore.getState().moveSectionObject(block.id, section, targetBlock, targetSection, state.id, nextX, Math.max(0, event.clientY - state.grabY - bounds.top), nextWidth, height)
          setSelected(null)
          return
        }
      }
      useConfigStore.getState().updateBlockProps(block.id, { [key]: saved.map(item => item.id === state.id ? { ...item, x, y, width, height } : item) })
    }
  }
  return <div data-section-object-area={section} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
    {objects.filter(item => item && typeof item.id === 'string' && ['text', 'image', 'button', 'panel'].includes(item.type)).map(item => {
      const x = Math.max(0, Math.min(95, Number(item.x) || 0)), y = Math.max(0, Number(item.y) || 0)
      const width = Math.max(5, Math.min(100 - x, Number(item.width) || 30)), height = Math.max(24, Number(item.height) || 80)
      const link = typeof item.url === 'string' && /^(https?:\/\/|\/(?!\/)|#)/i.test(item.url) ? item.url : undefined
      return <div key={item.id} data-section-object={item.id} tabIndex={editable ? 0 : undefined} aria-label={editable ? `${item.type} in section ${section}` : undefined} style={{ position: 'absolute', left: `${x}%`, top: y, width: `${width}%`, height, zIndex: Number(item.layer) || 1, pointerEvents: 'auto', outline: editable && selected === item.id ? '1px solid #005a9e' : undefined, touchAction: editable ? 'none' : undefined, cursor: editable ? 'move' : undefined, background: item.type === 'panel' && /^#[0-9a-f]{6}$/i.test(item.color || '') ? item.color : undefined, color: /^#[0-9a-f]{6}$/i.test(item.textColor || '') ? item.textColor : undefined, fontSize: Number(item.fontSize) >= 6 && Number(item.fontSize) <= 200 ? Number(item.fontSize) : undefined }}
        onDoubleClick={event => { if (editable && (item.type === 'text' || item.type === 'panel')) { const element = event.currentTarget; event.stopPropagation(); setSelected(item.id); setEditing(item.id); requestAnimationFrame(() => element.querySelector<HTMLElement>('[contenteditable="true"]')?.focus()) } }}
        onKeyDown={event => { if (!editable || event.target !== event.currentTarget || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return; event.preventDefault(); event.stopPropagation(); const current = useConfigStore.getState().getActivePageBlocks().find(value => value.id === block.id); const saved = Array.isArray(current?.props[key]) ? current.props[key] as SectionObject[] : []; const step = event.shiftKey ? 10 : 1; const area = event.currentTarget.parentElement; const horizontal = area?.clientWidth ? step / area.clientWidth * 100 : 0; useConfigStore.getState().updateBlockProps(block.id, { [key]: saved.map(value => value.id === item.id ? { ...value, x: Math.max(0, Math.min(100 - width, x + (event.key === 'ArrowRight' ? horizontal : event.key === 'ArrowLeft' ? -horizontal : 0))), y: Math.max(0, y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0)) } : value) }) }}
        onPointerDown={event => { if (!editable || event.button !== 0 || (event.target instanceof Element && (event.target.closest('[data-rich-menu]') || (editing === item.id && event.target.closest('[contenteditable="true"]'))))) return; const parent = event.currentTarget.parentElement; if (!parent?.clientWidth) return; const bounds = event.currentTarget.getBoundingClientRect(); event.preventDefault(); event.stopPropagation(); setSelected(item.id); drag.current = { id: item.id, startX: event.clientX, startY: event.clientY, grabX: event.clientX - bounds.left, grabY: event.clientY - bounds.top, x, y, width, height, parentWidth: parent.clientWidth, resize: false }; event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={event => move(event)} onPointerUp={event => move(event, true)} onPointerCancel={() => { drag.current = null }}>
        {(item.type === 'image' || item.type === 'panel') && item.src && <img src={item.src} alt={item.alt || ''} style={{ width: '100%', height: item.type === 'image' ? '100%' : '50%', objectFit: 'contain' }} draggable={false} />}
        {editable && item.type === 'image' && !item.src && <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', border: '1px dashed #8290a0', color: '#8290a0' }}>Choose an image in Properties</div>}
        {(item.type === 'text' || item.type === 'panel') && <RichText blockId={block.id} field={`sectionObject_${item.id}`} text={typeof block.props[`sectionObject_${item.id}`] === 'string' ? block.props[`sectionObject_${item.id}`] as string : item.text || ''} value={block.props[`sectionObject_${item.id}Rich`]} editable={editable && editing === item.id} multiline />}
        {item.type === 'button' && (link ? <a href={link} onClick={editable ? event => event.preventDefault() : undefined} className="inline-block rounded border border-current px-4 py-2">{item.text || 'Button'}</a> : <span className="inline-block rounded border border-current px-4 py-2">{item.text || 'Button'}</span>)}
        {editable && selected === item.id && <button type="button" aria-label="Resize object" style={{ position: 'absolute', right: 0, bottom: 0, width: 12, height: 12, background: 'white', border: '1px solid black', cursor: 'nwse-resize', touchAction: 'none' }} onPointerDown={event => { const parent = event.currentTarget.parentElement?.parentElement; if (!parent?.clientWidth) return; event.preventDefault(); event.stopPropagation(); drag.current = { id: item.id, startX: event.clientX, startY: event.clientY, grabX: 0, grabY: 0, x, y, width, height, parentWidth: parent.clientWidth, resize: true }; event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={event => move(event)} onPointerUp={event => move(event, true)} onPointerCancel={() => { drag.current = null }} />}
      </div>
    })}
  </div>
}
