import { useRef, useState, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'
import type { BlockConfig } from './types'
import { RichText } from './RichText'

type SectionObject = { id: string; type: 'text' | 'image' | 'button' | 'panel'; text?: string; src?: string; alt?: string; url?: string; color?: string; textColor?: string; fontSize?: number; x: number; y: number; width: number; height: number; layer: number }

export function SectionObjects({ block, section, editable }: { block: BlockConfig; section: number; editable: boolean }) {
  const key = `section${section}Objects`
  const objects = Array.isArray(block.props[key]) ? block.props[key] as SectionObject[] : []
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [guides, setGuides] = useState<{ vertical?: { x: number; top: number; height: number }; horizontal?: { y: number; left: number; width: number } }>({})
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
    event.preventDefault(); event.stopPropagation()
    if (finish) {
      setGuides({})
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
          useEditorStore.getState().selectBlock(targetBlock)
          useEditorStore.getState().selectSection(targetSection)
          setSelected(null)
          return
        }
      }
      useConfigStore.getState().updateBlockProps(block.id, { [key]: saved.map(item => item.id === state.id ? { ...item, x, y, width, height } : item) })
    }
  }
  return <><div data-section-object-area={section} className={block.props.stackSectionObjectsOnMobile === true ? 'ws-stack-mobile' : undefined} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
    {objects.filter(item => item && typeof item.id === 'string' && ['text', 'image', 'button', 'panel'].includes(item.type)).map(item => {
      const x = Math.max(0, Math.min(95, Number(item.x) || 0)), y = Math.max(0, Number(item.y) || 0)
      const width = Math.max(5, Math.min(100 - x, Number(item.width) || 30)), height = Math.max(24, Number(item.height) || 80)
      const link = typeof item.url === 'string' && /^(https?:\/\/|\/(?!\/)|#)/i.test(item.url) ? item.url : undefined
      return <div key={item.id} data-section-object={item.id} tabIndex={editable ? 0 : undefined} aria-label={editable ? `${item.type} in section ${section}` : undefined} style={{ position: 'absolute', left: `${x}%`, top: y, width: `${width}%`, height, zIndex: Number(item.layer) || 1, pointerEvents: 'auto', outline: editable && selected === item.id ? '1px solid #005a9e' : undefined, touchAction: editable ? 'none' : undefined, cursor: editable ? 'move' : undefined, background: item.type === 'panel' && /^#[0-9a-f]{6}$/i.test(item.color || '') ? item.color : undefined, color: /^#[0-9a-f]{6}$/i.test(item.textColor || '') ? item.textColor : undefined, fontSize: Number(item.fontSize) >= 6 && Number(item.fontSize) <= 200 ? Number(item.fontSize) : undefined }}
        onContextMenu={event => { if (!editable || (editing === item.id && event.target instanceof Element && event.target.closest('[contenteditable="true"]'))) return; event.preventDefault(); event.stopPropagation(); setSelected(item.id); useEditorStore.getState().selectBlock(block.id); useEditorStore.getState().selectSection(section); setMenu({ id: item.id, x: event.clientX, y: event.clientY }) }}
        onDoubleClick={event => { if (editable && (item.type === 'text' || item.type === 'panel')) { const element = event.currentTarget; event.stopPropagation(); setSelected(item.id); setEditing(item.id); requestAnimationFrame(() => element.querySelector<HTMLElement>('[contenteditable="true"]')?.focus()) } }}
        onCopy={event => { if (!editable || event.target !== event.currentTarget) return; const current = useConfigStore.getState().getActivePageBlocks().find(value => value.id === block.id); const saved = Array.isArray(current?.props[key]) ? current.props[key] as SectionObject[] : []; const original = saved.find(value => value.id === item.id); if (!original || !current) return; const token = crypto.randomUUID(); useEditorStore.getState().setCopiedSectionObject({ token, projectId: useEditorStore.getState().activeProjectId, item: structuredClone(original) as unknown as Record<string, unknown>, text: structuredClone(current.props[`sectionObject_${item.id}`]), rich: structuredClone(current.props[`sectionObject_${item.id}Rich`]) }); event.clipboardData.setData('text/plain', `WebStudio object:${token}`); event.preventDefault(); event.stopPropagation() }}
        onKeyDown={event => { if (!editable || event.target !== event.currentTarget) return; const current = useConfigStore.getState().getActivePageBlocks().find(value => value.id === block.id); const saved = Array.isArray(current?.props[key]) ? current.props[key] as SectionObject[] : []; if (event.key === 'Delete' || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd')) { const index = saved.findIndex(value => value.id === item.id); if (index >= 0) useConfigStore.getState().editBlockItems(block.id, key, index, index, event.key === 'Delete' ? 'remove' : 'duplicate'); if (event.key === 'Delete') setSelected(null); event.preventDefault(); event.stopPropagation(); return }; if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return; event.preventDefault(); event.stopPropagation(); const step = event.shiftKey ? 10 : 1; const area = event.currentTarget.parentElement; const horizontal = area?.clientWidth ? step / area.clientWidth * 100 : 0; useConfigStore.getState().updateBlockProps(block.id, { [key]: saved.map(value => value.id === item.id ? { ...value, x: Math.max(0, Math.min(100 - width, x + (event.key === 'ArrowRight' ? horizontal : event.key === 'ArrowLeft' ? -horizontal : 0))), y: Math.max(0, y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0)) } : value) }) }}
        onPointerDown={event => { if (!editable || event.button !== 0 || (event.target instanceof Element && (event.target.closest('[data-rich-menu]') || (editing === item.id && event.target.closest('[contenteditable="true"]'))))) return; const parent = event.currentTarget.parentElement; if (!parent?.clientWidth) return; const bounds = event.currentTarget.getBoundingClientRect(); event.preventDefault(); event.stopPropagation(); event.currentTarget.focus({ preventScroll: true }); setSelected(item.id); useEditorStore.getState().selectBlock(block.id); useEditorStore.getState().selectSection(section); drag.current = { id: item.id, startX: event.clientX, startY: event.clientY, grabX: event.clientX - bounds.left, grabY: event.clientY - bounds.top, x, y, width, height, parentWidth: parent.clientWidth, resize: false }; event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={event => move(event)} onPointerUp={event => move(event, true)} onPointerCancel={() => { drag.current = null; setGuides({}) }}>
        {(item.type === 'image' || item.type === 'panel') && item.src && (item.type === 'image' && link
          ? <a href={link} onClick={editable ? event => event.preventDefault() : undefined} style={{ display: 'block', width: '100%', height: '100%' }}><img src={item.src} alt={item.alt || ''} style={{ width: '100%', height: '100%', objectFit: 'contain' }} draggable={false} /></a>
          : <img src={item.src} alt={item.alt || ''} style={{ width: '100%', height: item.type === 'image' ? '100%' : '50%', objectFit: 'contain' }} draggable={false} />)}
        {editable && item.type === 'image' && !item.src && <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', border: '1px dashed #8290a0', color: '#8290a0' }}>Choose an image in Properties</div>}
        {(item.type === 'text' || item.type === 'panel') && <RichText blockId={block.id} field={`sectionObject_${item.id}`} text={typeof block.props[`sectionObject_${item.id}`] === 'string' ? block.props[`sectionObject_${item.id}`] as string : item.text || ''} value={block.props[`sectionObject_${item.id}Rich`]} editable={editable && editing === item.id} multiline />}
        {item.type === 'button' && (link ? <a href={link} onClick={editable ? event => event.preventDefault() : undefined} className="inline-block rounded border border-current px-4 py-2">{item.text || 'Button'}</a> : <span className="inline-block rounded border border-current px-4 py-2">{item.text || 'Button'}</span>)}
        {editable && selected === item.id && <button type="button" aria-label="Resize object" style={{ position: 'absolute', right: 0, bottom: 0, width: 12, height: 12, background: 'white', border: '1px solid black', cursor: 'nwse-resize', touchAction: 'none' }} onPointerDown={event => { const parent = event.currentTarget.parentElement?.parentElement; if (!parent?.clientWidth) return; event.preventDefault(); event.stopPropagation(); drag.current = { id: item.id, startX: event.clientX, startY: event.clientY, grabX: 0, grabY: 0, x, y, width, height, parentWidth: parent.clientWidth, resize: true }; event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={event => move(event)} onPointerUp={event => move(event, true)} onPointerCancel={() => { drag.current = null }} />}
      </div>
    })}
  </div>
  {editable && (guides.vertical || guides.horizontal) && createPortal(<div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10000 }}>
    {guides.vertical && <div style={{ position: 'fixed', left: guides.vertical.x, top: guides.vertical.top, height: guides.vertical.height, width: 1, background: '#1683e5' }} />}
    {guides.horizontal && <div style={{ position: 'fixed', left: guides.horizontal.left, top: guides.horizontal.y, width: guides.horizontal.width, height: 1, background: '#1683e5' }} />}
  </div>, document.body)}
  {editable && menu && createPortal(<div role="menu" aria-label="Object actions" style={{ position: 'fixed', left: Math.max(0, Math.min(menu.x, window.innerWidth - 170)), top: Math.max(0, Math.min(menu.y, window.innerHeight - 160)), zIndex: 10001 }} className="rounded border border-gray-400 bg-white p-1 text-sm text-black shadow-lg" onClick={event => event.stopPropagation()} onMouseLeave={() => setMenu(null)} onKeyDown={event => { if (event.key === 'Escape') setMenu(null) }}>
    {(['Copy', 'Duplicate', 'Bring to front', 'Send to back', 'Delete'] as const).map(action => <button key={action} type="button" role="menuitem" className="block w-full rounded px-3 py-1 text-left hover:bg-blue-100" onClick={() => {
      const current = useConfigStore.getState().getActivePageBlocks().find(value => value.id === block.id)
      const saved = Array.isArray(current?.props[key]) ? current.props[key] as SectionObject[] : []
      const index = saved.findIndex(value => value.id === menu.id)
      if (index >= 0) {
        if (action === 'Copy' && current) { const token = crypto.randomUUID(); useEditorStore.getState().setCopiedSectionObject({ token, projectId: useEditorStore.getState().activeProjectId, item: structuredClone(saved[index]) as unknown as Record<string, unknown>, text: structuredClone(current.props[`sectionObject_${menu.id}`]), rich: structuredClone(current.props[`sectionObject_${menu.id}Rich`]) }); void navigator.clipboard?.writeText(`WebStudio object:${token}`).catch(() => {}) }
        else if (action === 'Duplicate' || action === 'Delete') useConfigStore.getState().editBlockItems(block.id, key, index, index, action === 'Duplicate' ? 'duplicate' : 'remove')
        else {
          const ordered = saved.map((value, position) => ({ value, position })).sort((a, b) => (Number(a.value.layer) || 1) - (Number(b.value.layer) || 1) || a.position - b.position).filter(entry => entry.value.id !== menu.id)
          const chosen = { value: saved[index], position: index }
          if (action === 'Bring to front') ordered.push(chosen); else ordered.unshift(chosen)
          useConfigStore.getState().updateBlockProps(block.id, { [key]: saved.map(value => ({ ...value, layer: ordered.findIndex(entry => entry.value.id === value.id) + 1 })) })
        }
      }
      if (action === 'Delete') setSelected(null)
      setMenu(null)
    }}>{action}</button>)}
  </div>, document.body)}</>
}
