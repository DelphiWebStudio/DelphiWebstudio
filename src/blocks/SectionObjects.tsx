import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'
import type { BlockConfig } from './types'
import { RichText } from './RichText'
import { CollageBlock } from './collage/CollageBlock'

type SectionObject = { id: string; type: 'text' | 'image' | 'button' | 'panel' | 'collage' | 'divider'; images?: unknown[]; parentId?: string; text?: string; src?: string; alt?: string; url?: string; color?: string; textColor?: string; fontSize?: number; x: number; y: number; width: number; height: number; layer: number }

export function SectionObjects({ block, section, editable }: { block: BlockConfig; section: number; editable: boolean }) {
  const key = `section${section}Objects`
  const objects = useMemo(() => Array.isArray(block.props[key]) ? block.props[key] as SectionObject[] : [], [block.props, key])
  const responsiveOrder = objects.filter(item => item && typeof item.id === 'string').slice().sort((a, b) => {
    const parentA = objects.find(item => item?.id === a.parentId && item.type === 'panel')
    const parentB = objects.find(item => item?.id === b.parentId && item.type === 'panel')
    const anchorA = parentA ?? a, anchorB = parentB ?? b
    return (Number(anchorA.y) || 0) - (Number(anchorB.y) || 0) || (Number(anchorA.x) || 0) - (Number(anchorB.x) || 0) || (parentA ? 1 : 0) - (parentB ? 1 : 0) || (Number(a.y) || 0) - (Number(b.y) || 0)
  }).map(item => item.id)
  const objectSelection = useEditorStore(state => state.selectedSectionObject)
  const selected = objectSelection?.blockId === block.id && objectSelection.section === section ? objectSelection.id : null
  const setSelected = (id: string | null) => useEditorStore.getState().selectSectionObject(id ? { blockId: block.id, section, id } : null)
  const [editing, setEditing] = useState<string | null>(null)
  const newTextObjectId = useEditorStore(state => state.newTextObjectId)
  useEffect(() => {
    if (!newTextObjectId || !objects.some(item => item.id === newTextObjectId)) return
    const timer = window.setTimeout(() => {
      useEditorStore.getState().selectSectionObject({ blockId: block.id, section, id: newTextObjectId })
      setEditing(newTextObjectId)
      useEditorStore.getState().setNewTextObjectId(null)
      requestAnimationFrame(() => {
      const element = document.querySelector<HTMLElement>(`[data-section-object="${newTextObjectId}"] [contenteditable="true"]`)
      if (!element) return
      element.focus()
      const selection = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(element)
      selection?.removeAllRanges()
      selection?.addRange(range)
      })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [newTextObjectId, objects, block.id, section])
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [guides, setGuides] = useState<{ vertical?: { x: number; top: number; height: number }; horizontal?: { y: number; left: number; width: number } }>({})
  const drag = useRef<{ id: string; startX: number; startY: number; grabX: number; grabY: number; x: number; y: number; width: number; height: number; parentWidth: number; resize: false | string; imageAspect?: number } | null>(null)
  function move(event: PointerEvent<HTMLElement>, finish = false) {
    const state = drag.current
    if (!state) return
    const dx = (event.clientX - state.startX) / state.parentWidth * 100
    const dy = event.clientY - state.startY
    const direction = state.resize || ''
    let width = direction.includes('w') ? Math.max(5, Math.min(state.width + state.x, state.width - dx)) : direction.includes('e') ? Math.max(5, Math.min(100 - state.x, state.width + dx)) : state.width
    let height = direction.includes('n') ? Math.max(24, Math.min(state.height + state.y, state.height - dy)) : direction.includes('s') ? Math.max(24, state.height + dy) : state.height
    if (state.imageAspect && state.resize) {
      if (direction === 'n' || direction === 's') width = Math.max(5, Math.min(100 - state.x, height * state.imageAspect / state.parentWidth * 100))
      else height = Math.max(24, width * state.parentWidth / 100 / state.imageAspect)
    }
    let x = state.resize ? direction.includes('w') ? state.x + state.width - width : state.x : Math.max(0, Math.min(100 - state.width, state.x + dx))
    let y = state.resize ? direction.includes('n') ? state.y + state.height - height : state.y : Math.max(0, state.y + dy)
    const element = event.currentTarget.closest<HTMLElement>('[data-section-object]')
    if (element) Object.assign(element.style, { left: `${!finish && !state.resize ? state.x + dx : x}%`, top: `${!finish && !state.resize ? state.y + dy : y}px`, width: `${width}%`, height: `${height}px` })
    if (!state.resize && element && objects.some(item => item.id === state.id && item.type === 'panel')) {
      for (const child of objects.filter(item => item.parentId === state.id)) {
        const childElement = element.closest('[data-section-object-area]')?.querySelector<HTMLElement>(`[data-section-object="${child.id}"]`)
        if (childElement) Object.assign(childElement.style, { left: `${child.x + x - state.x}%`, top: `${child.y + y - state.y}px` })
      }
    }
    if (!state.resize && element) {
      const canvas = element.closest('[aria-label^="Site preview"]')
      const current = element.getBoundingClientRect()
      const matches: { vertical?: { x: number; top: number; height: number }; horizontal?: { y: number; left: number; width: number } } = {}
      let snapX = 0, snapY = 0
      canvas?.querySelectorAll<HTMLElement>('[data-section-object], [data-placed-media], [data-ws-image-index], [contenteditable="true"]').forEach(other => {
        if (other === element || element.contains(other) || other.contains(element)) return
        const rect = other.getBoundingClientRect()
        if (!rect.width || !rect.height) return
        if (!matches.vertical) for (const [a, b] of [[current.left, rect.left], [current.right, rect.right], [(current.left + current.right) / 2, (rect.left + rect.right) / 2]]) {
          if (Math.abs(a - b) <= 4) { const top = Math.min(current.top, rect.top); matches.vertical = { x: b, top, height: Math.max(current.bottom, rect.bottom) - top }; snapX = b - a; break }
        }
        if (!matches.horizontal) for (const [a, b] of [[current.top, rect.top], [current.bottom, rect.bottom], [(current.top + current.bottom) / 2, (rect.top + rect.bottom) / 2]]) {
          if (Math.abs(a - b) <= 4) { const left = Math.min(current.left, rect.left); matches.horizontal = { y: b, left, width: Math.max(current.right, rect.right) - left }; snapY = b - a; break }
        }
      })
      if (block.props.snapSectionObjects === true) {
        x = Math.max(0, Math.min(100 - width, x + snapX / state.parentWidth * 100)); y = Math.max(0, y + snapY)
        Object.assign(element.style, { left: `${finish ? x : state.x + dx + snapX / state.parentWidth * 100}%`, top: `${finish ? y : state.y + dy + snapY}px` })
      }
      if (!finish) setGuides(matches)
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
      const moving = saved.find(item => item.id === state.id)
      let parentId = moving?.parentId
      if (!state.resize && moving && moving.type !== 'panel' && element) {
        const previous = element.style.pointerEvents
        element.style.pointerEvents = 'none'
        const hitId = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-section-object]')?.getAttribute('data-section-object')
        element.style.pointerEvents = previous
        parentId = saved.find(item => item.id === hitId && item.type === 'panel')?.id
      }
      useConfigStore.getState().updateBlockProps(block.id, { [key]: saved.map(item => item.id === state.id ? { ...item, x, y, width, height, ...(parentId ? { parentId } : { parentId: undefined }) } : !state.resize && moving?.type === 'panel' && item.parentId === state.id ? { ...item, x: item.x + x - state.x, y: item.y + y - state.y } : item) })
    }
  }
  const visibleObjects = objects.filter(item => item && typeof item.id === 'string' && ['text', 'image', 'button', 'panel', 'collage', 'divider'].includes(item.type))
  const renderedObjects = new Map(visibleObjects.map(item => {
      const x = Math.max(0, Math.min(95, Number(item.x) || 0)), y = Math.max(0, Number(item.y) || 0)
      const width = Math.max(5, Math.min(100 - x, Number(item.width) || 30)), height = Math.max(24, Number(item.height) || 80)
      const link = typeof item.url === 'string' && /^(https?:\/\/|\/(?!\/)|#)/i.test(item.url) ? item.url : undefined
      const parent = objects.find(value => value?.id === item.parentId && value.type === 'panel')
      const gridColumn = Math.min(Number(parent?.x ?? x) >= 60 ? 12 : 8, Math.max(1, Math.floor(x / 100 * 12) + 1))
      const gridSpan = Math.min((Number(parent?.x ?? x) >= 60 ? 13 : 9) - gridColumn, x < 5 && width >= 55 ? 8 : Math.max(1, Math.round(width / 100 * 12)))
      const emptyPanel = item.type === 'panel' && !item.text && !item.src && !block.props[`sectionObject_${item.id}`] && !block.props[`sectionObject_${item.id}Rich`] && objects.some(value => value?.parentId === item.id)
      return [item.id, <div key={item.id} data-section-object={item.id} data-ws-object-type={item.type} data-ws-parented={parent ? 'true' : undefined} data-ws-empty-panel={emptyPanel ? 'true' : undefined} tabIndex={editable ? 0 : undefined} aria-label={editable ? `${item.type} in section ${section}` : undefined} style={{ position: 'absolute', left: `${x}%`, top: y, width: `${width}%`, height, order: responsiveOrder.indexOf(item.id), '--ws-grid-column': gridColumn, '--ws-grid-span': gridSpan, '--ws-item-width': width, '--ws-parent-background': parent && /^#[0-9a-f]{6}$/i.test(parent.color || '') ? parent.color : 'transparent', zIndex: Number(item.layer) || 1, pointerEvents: 'auto', outline: editable && selected === item.id ? '1px solid #005a9e' : undefined, touchAction: editable ? 'none' : undefined, cursor: editable ? 'move' : undefined, background: item.type === 'panel' && /^#[0-9a-f]{6}$/i.test(item.color || '') ? item.color : undefined, color: /^#[0-9a-f]{6}$/i.test(item.textColor || '') ? item.textColor : undefined, fontSize: Number(item.fontSize) >= 6 && Number(item.fontSize) <= 200 ? Number(item.fontSize) : undefined } as CSSProperties}
        onContextMenu={event => { if (!editable || (editing === item.id && event.target instanceof Element && event.target.closest('[contenteditable="true"]'))) return; event.preventDefault(); event.stopPropagation(); useEditorStore.getState().selectBlock(block.id); useEditorStore.getState().selectSection(section); setSelected(item.id); setMenu({ id: item.id, x: event.clientX, y: event.clientY }) }}
        onDoubleClick={event => { if (editable && (item.type === 'text' || item.type === 'panel')) { const element = event.currentTarget; event.stopPropagation(); setSelected(item.id); setEditing(item.id); requestAnimationFrame(() => element.querySelector<HTMLElement>('[contenteditable="true"]')?.focus()) } }}
        onCopy={event => { if (!editable || event.target !== event.currentTarget) return; const current = useConfigStore.getState().getActivePageBlocks().find(value => value.id === block.id); const saved = Array.isArray(current?.props[key]) ? current.props[key] as SectionObject[] : []; const original = saved.find(value => value.id === item.id); if (!original || !current) return; const token = crypto.randomUUID(); useEditorStore.getState().setCopiedSectionObject({ token, projectId: useEditorStore.getState().activeProjectId, item: structuredClone(original) as unknown as Record<string, unknown>, text: structuredClone(current.props[`sectionObject_${item.id}`]), rich: structuredClone(current.props[`sectionObject_${item.id}Rich`]) }); event.clipboardData.setData('text/plain', `WebStudio object:${token}`); event.preventDefault(); event.stopPropagation() }}
        onKeyDown={event => { if (!editable || event.target !== event.currentTarget) return; const current = useConfigStore.getState().getActivePageBlocks().find(value => value.id === block.id); const saved = Array.isArray(current?.props[key]) ? current.props[key] as SectionObject[] : []; if (event.key === 'Enter' && item.type === 'image' && current) { const spaceKey = `section${section}ExtraSpace`; useConfigStore.getState().updateBlockProps(block.id, { [spaceKey]: Math.min(4000, Math.max(0, Number(current.props[spaceKey]) || 0) + 32) }); event.preventDefault(); event.stopPropagation(); return }; if (event.key === 'Delete' || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd')) { const index = saved.findIndex(value => value.id === item.id); if (index >= 0) useConfigStore.getState().editBlockItems(block.id, key, index, index, event.key === 'Delete' ? 'remove' : 'duplicate'); if (event.key === 'Delete') setSelected(null); event.preventDefault(); event.stopPropagation(); return }; if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return; event.preventDefault(); event.stopPropagation(); const step = event.shiftKey ? 10 : 1; const area = event.currentTarget.closest<HTMLElement>('[data-section-object-area]'); const horizontal = area?.clientWidth ? step / area.clientWidth * 100 : 0; useConfigStore.getState().updateBlockProps(block.id, { [key]: saved.map(value => { const nextX = Math.max(0, Math.min(100 - width, x + (event.key === 'ArrowRight' ? horizontal : event.key === 'ArrowLeft' ? -horizontal : 0))); const nextY = Math.max(0, y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0)); return value.id === item.id ? { ...value, x: nextX, y: nextY } : item.type === 'panel' && value.parentId === item.id ? { ...value, x: value.x + nextX - x, y: value.y + nextY - y } : value }) }) }}
        onPointerDown={event => { if (!editable || event.button !== 0 || (event.target instanceof Element && (event.target.closest('[data-rich-menu]') || (selected === item.id && editing === item.id && event.target.closest('[contenteditable="true"]'))))) return; const parent = event.currentTarget.closest<HTMLElement>('[data-section-object-area]'); if (!parent?.clientWidth) return; const bounds = event.currentTarget.getBoundingClientRect(); event.preventDefault(); event.stopPropagation(); event.currentTarget.focus({ preventScroll: true }); useEditorStore.getState().selectBlock(block.id); useEditorStore.getState().selectSection(section); setSelected(item.id); setEditing(null); drag.current = { id: item.id, startX: event.clientX, startY: event.clientY, grabX: event.clientX - bounds.left, grabY: event.clientY - bounds.top, x, y, width, height, parentWidth: parent.clientWidth, resize: false }; event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={event => move(event)} onPointerUp={event => move(event, true)} onPointerCancel={() => { drag.current = null; setGuides({}) }}>
        {(item.type === 'image' || item.type === 'panel') && item.src && (item.type === 'image' && link
          ? <a href={link} onClick={editable ? event => event.preventDefault() : undefined} style={{ display: 'block', width: '100%', height: '100%' }}><img src={item.src} alt={item.alt || ''} style={{ width: '100%', height: '100%', objectFit: 'contain' }} draggable={false} /></a>
          : <img src={item.src} alt={item.alt || ''} style={{ width: '100%', height: item.type === 'image' ? '100%' : '50%', objectFit: 'contain' }} draggable={false} />)}
        {editable && item.type === 'image' && !item.src && <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', border: '1px dashed #8290a0', color: '#8290a0' }}>Choose an image in Properties</div>}
        {editable && item.type === 'collage' && (!item.images || item.images.length === 0) && selected !== item.id && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', border: '1px dashed #8290a0', color: '#8290a0' }}>Select collage and add images in Properties</div>}
        {item.type === 'collage' && <CollageBlock block={{ ...block, props: { ...block.props, images: item.images ?? [] } }} editable={editable && selected === item.id} sectionObject={{ section, id: item.id }} />}
        {item.type === 'divider' && <div aria-label="Divider" style={{ display: 'flex', alignItems: 'center', width: '100%', height: '100%' }}><div style={{ width: '100%', borderTop: `1px solid ${/^#[0-9a-f]{6}$/i.test(item.textColor || '') ? item.textColor : '#808080'}` }} /></div>}
        {(item.type === 'text' || item.type === 'panel') && <RichText blockId={block.id} field={`sectionObject_${item.id}`} text={typeof block.props[`sectionObject_${item.id}`] === 'string' ? block.props[`sectionObject_${item.id}`] as string : item.text || ''} value={block.props[`sectionObject_${item.id}Rich`]} editable={editable && editing === item.id} multiline onDeleteBox={item.type === 'text' ? () => { const current = useConfigStore.getState().getActivePageBlocks().find(value => value.id === block.id); const saved = Array.isArray(current?.props[key]) ? current.props[key] as SectionObject[] : []; const index = saved.findIndex(value => value.id === item.id); if (index >= 0) useConfigStore.getState().editBlockItems(block.id, key, index, index, 'remove'); setEditing(null); setSelected(null) } : undefined} />}
        {item.type === 'button' && (link ? <a href={link} onClick={editable ? event => event.preventDefault() : undefined} className="inline-block rounded border border-current px-4 py-2">{item.text || 'Button'}</a> : <span className="inline-block rounded border border-current px-4 py-2">{item.text || 'Button'}</span>)}
        {editable && selected === item.id && (item.type === 'collage' || item.type === 'text' || item.type === 'panel') && <button type="button" aria-label={`Move ${item.type}`} title="Drag to move this object" style={{ position: 'absolute', left: 4, top: 4, zIndex: 1001, background: 'white', color: 'black', border: '1px solid black', padding: '1px 4px', cursor: 'move', touchAction: 'none' }} onPointerDown={event => { const parent = event.currentTarget.closest<HTMLElement>('[data-section-object-area]'); const object = event.currentTarget.parentElement; if (!parent?.clientWidth || !object) return; const bounds = object.getBoundingClientRect(); event.preventDefault(); event.stopPropagation(); drag.current = { id: item.id, startX: event.clientX, startY: event.clientY, grabX: event.clientX - bounds.left, grabY: event.clientY - bounds.top, x, y, width, height, parentWidth: parent.clientWidth, resize: false }; event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={event => move(event)} onPointerUp={event => move(event, true)} onPointerCancel={() => { drag.current = null; setGuides({}) }}>Move</button>}
        {editable && selected === item.id && (['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const).map(direction => <button key={direction} type="button" aria-label={`Resize object ${direction}`} style={{ position: 'absolute', left: direction.includes('w') ? -6 : direction.includes('e') ? 'calc(100% - 6px)' : 'calc(50% - 6px)', top: direction.includes('n') ? -6 : direction.includes('s') ? 'calc(100% - 6px)' : 'calc(50% - 6px)', width: 12, height: 12, background: 'white', border: '1px solid black', cursor: `${direction}-resize`, touchAction: 'none' }} onPointerDown={event => { const parent = event.currentTarget.closest<HTMLElement>('[data-section-object-area]'); if (!parent?.clientWidth) return; event.preventDefault(); event.stopPropagation(); const object = event.currentTarget.parentElement; const image = item.type === 'image' ? object?.querySelector<HTMLImageElement>('img') : null; const aspect = image?.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : undefined; let startX = x, startY = y, startWidth = width, startHeight = height; if (aspect && object) { const bounds = object.getBoundingClientRect(); const visibleWidth = Math.min(bounds.width, bounds.height * aspect); const visibleHeight = visibleWidth / aspect; startX += (bounds.width - visibleWidth) / 2 / parent.clientWidth * 100; startY += (bounds.height - visibleHeight) / 2; startWidth = visibleWidth / parent.clientWidth * 100; startHeight = visibleHeight }; drag.current = { id: item.id, startX: event.clientX, startY: event.clientY, grabX: 0, grabY: 0, x: startX, y: startY, width: startWidth, height: startHeight, parentWidth: parent.clientWidth, resize: direction, imageAspect: aspect }; event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={event => move(event)} onPointerUp={event => move(event, true)} onPointerCancel={() => { drag.current = null }} />)}
      </div>] as const
    }))
  return <><div data-section-object-area={section} data-ws-has-right={objects.some(item => item && Number(objects.find(value => value?.id === item.parentId && value.type === 'panel')?.x ?? item.x) >= 60) ? 'true' : undefined} className="ws-stack-mobile" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
    {[0, 1].map(column => <div key={column} data-ws-responsive-column={column} style={{ display: 'contents' }}>
      {visibleObjects.filter(item => item.type === 'panel' || !visibleObjects.some(value => value.id === item.parentId && value.type === 'panel')).filter(item => (Number(item.x) >= 60 ? 1 : 0) === column).map(item => {
        const children = item.type === 'panel' ? visibleObjects.filter(value => value.type !== 'panel' && value.parentId === item.id) : []
        const background = /^#[0-9a-f]{6}$/i.test(item.color || '') ? item.color : 'transparent'
        return <div key={item.id} data-ws-object-group data-ws-group-panel={children.length ? 'true' : undefined} style={{ display: 'contents', order: responsiveOrder.indexOf(item.id), '--ws-group-width': Number(item.width) || 30, '--ws-group-background': background } as CSSProperties}>
          {renderedObjects.get(item.id)}
          {children.map(child => renderedObjects.get(child.id))}
        </div>
      })}
    </div>)}
  </div>
  {editable && (guides.vertical || guides.horizontal) && createPortal(<div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10000 }}>
    {guides.vertical && <div style={{ position: 'fixed', left: guides.vertical.x, top: guides.vertical.top, height: guides.vertical.height, width: 1, background: '#1683e5' }} />}
    {guides.horizontal && <div style={{ position: 'fixed', left: guides.horizontal.left, top: guides.horizontal.y, width: guides.horizontal.width, height: 1, background: '#1683e5' }} />}
  </div>, document.body)}
  {editable && menu && createPortal(<div role="menu" aria-label="Object actions" style={{ position: 'fixed', left: Math.max(0, Math.min(menu.x, window.innerWidth - 170)), top: Math.max(0, Math.min(menu.y, window.innerHeight - 160)), zIndex: 10001 }} className="rounded border border-gray-400 bg-white p-1 text-sm text-black shadow-lg" onClick={event => event.stopPropagation()} onMouseLeave={() => setMenu(null)} onKeyDown={event => { if (event.key === 'Escape') setMenu(null) }}>
    <button type="button" role="menuitem" className="block w-full rounded px-3 py-1 text-left hover:bg-blue-100" onClick={() => { setMenu(null); document.querySelector<HTMLButtonElement>('[aria-label="Expand right panel"]')?.click(); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[data-properties-tab]')?.click()) }}>Properties</button>
    <button type="button" role="menuitem" className="block w-full rounded px-3 py-1 text-left hover:bg-blue-100" onClick={() => {
      const current = useConfigStore.getState().getActivePageBlocks().find(value => value.id === block.id)
      const spaceKey = `section${section}ExtraSpace`
      if (current) useConfigStore.getState().updateBlockProps(block.id, { [spaceKey]: Math.min(4000, Math.max(0, Number(current.props[spaceKey]) || 0) + 32) })
      setMenu(null)
    }}>Add space below</button>
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
