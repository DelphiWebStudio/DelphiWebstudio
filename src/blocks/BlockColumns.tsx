import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { useConfigStore } from '@/store/configStore'
import type { BlockConfig } from './types'
import { RichText } from './RichText'
import { SectionObjects } from './SectionObjects'

export function BlockColumns({ block, children, editable = false, selectedSection = 0, onSelectSection }: { block: BlockConfig; children?: ReactNode; editable?: boolean; selectedSection?: number; onSelectSection?: (section: number) => void }) {
  const count = Math.min(4, Math.max(1, Math.floor(Number(block.props.sectionCount) || 1)))
  const [dragWidths, setDragWidths] = useState<number[] | null>(null)
  const drag = useRef<{ index: number; startX: number; width: number; widths: number[]; latest: number[] } | null>(null)
  const textDrag = useRef<{ section: number; resize: boolean; startX: number; startY: number; width: number; height: number; left: number; top: number } | null>(null)
  const stored = block.props.sectionWidths
  const savedWidths = Array.isArray(stored) && stored.length === count && stored.every(value => typeof value === 'number' && Number.isFinite(value) && value > 0) ? stored as number[] : Array.from({ length: count }, () => 100 / count)
  const widths = dragWidths?.length === count ? dragWidths : savedWidths
  const firstExtraSpace = Math.max(0, Math.min(4000, Number(block.props.section1ExtraSpace) || 0))
  function resize(event: PointerEvent<HTMLButtonElement>, finish = false) {
    const state = drag.current
    if (!state) return
    const amount = (event.clientX - state.startX) / state.width * 100
    const minimum = 8
    const delta = Math.max(minimum - state.widths[state.index], Math.min(state.widths[state.index + 1] - minimum, amount))
    const next = [...state.widths]
    next[state.index] += delta
    next[state.index + 1] -= delta
    state.latest = next
    event.preventDefault(); event.stopPropagation()
    if (finish) {
      drag.current = null
      useConfigStore.getState().updateBlockProps(block.id, { sectionWidths: next })
      setDragWidths(null)
    } else setDragWidths(next)
  }
  if (count === 1) {
    const content = <>{children}{Array.isArray(block.props.section1Items) && block.props.section1Items.map((value, index) => {
    if (!value || typeof value !== 'object') return null
    const item = value as Record<string, unknown>
    const url = typeof item.url === 'string' && /^(https?:\/\/|\/(?!\/)|#)/i.test(item.url) ? item.url : undefined
    const image = typeof item.src === 'string' && item.src ? <img src={item.src} alt={typeof item.alt === 'string' ? item.alt : ''} className="max-w-full h-auto" /> : null
    return <div key={index} className="my-2">{url && image ? <a href={url} onClick={editable ? event => event.preventDefault() : undefined}>{image}</a> : image}{typeof item.text === 'string' && item.text && <p className="whitespace-pre-wrap">{url ? <a href={url} onClick={editable ? event => event.preventDefault() : undefined}>{item.text}</a> : item.text}</p>}</div>
    })}</>
    if (!editable && !firstExtraSpace && (!Array.isArray(block.props.section1Objects) || !block.props.section1Objects.length)) return content
    return <div data-ws-responsive-section data-editor-section={editable ? '1' : undefined} role={editable ? 'group' : undefined} aria-label={editable ? 'Section 1' : undefined} onClick={editable ? () => onSelectSection?.(1) : undefined} style={{ position: 'relative', minHeight: Math.max(0, ...(Array.isArray(block.props.section1Objects) ? (block.props.section1Objects as { y?: number; height?: number }[]).filter(Boolean).map(item => (Number(item.y) || 0) + Math.max(24, Number(item.height) || 80)) : [])) + firstExtraSpace, paddingBottom: firstExtraSpace }}>{content}<SectionObjects block={block} section={1} editable={editable} /></div>
  }
  return <div className="ws-block-columns grid grid-cols-1" style={{ '--ws-section-widths': widths.map(value => `${value}fr`).join(' ') } as CSSProperties}>
    <div data-ws-responsive-section className="min-w-0 relative" style={{ minHeight: Math.max(0, ...(Array.isArray(block.props.section1Objects) ? (block.props.section1Objects as { y?: number; height?: number }[]).filter(Boolean).map(item => (Number(item.y) || 0) + Math.max(24, Number(item.height) || 80)) : [])) + firstExtraSpace, paddingBottom: firstExtraSpace }} data-editor-section={editable ? '1' : undefined} role={editable ? 'group' : undefined} aria-label={editable ? 'Section 1' : undefined} tabIndex={editable ? 0 : undefined} onClick={editable ? () => onSelectSection?.(1) : undefined} onKeyDown={editable ? event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.stopPropagation(); onSelectSection?.(1) } } : undefined}>
      {children}
      <SectionObjects block={block} section={1} editable={editable} />
      {Array.isArray(block.props.section1Items) && block.props.section1Items.map((value, index) => {
        if (!value || typeof value !== 'object') return null
        const item = value as Record<string, unknown>
        const url = typeof item.url === 'string' && /^(https?:\/\/|\/(?!\/)|#)/i.test(item.url) ? item.url : undefined
        const image = typeof item.src === 'string' && item.src ? <img src={item.src} alt={typeof item.alt === 'string' ? item.alt : ''} className="max-w-full h-auto" /> : null
        return <div key={index} className="my-2">{url && image ? <a href={url} onClick={editable ? event => event.preventDefault() : undefined}>{image}</a> : image}{typeof item.text === 'string' && item.text && <p className="whitespace-pre-wrap">{url ? <a href={url} onClick={editable ? event => event.preventDefault() : undefined}>{item.text}</a> : item.text}</p>}</div>
      })}
      {editable && <span aria-hidden="true" className="absolute top-1 left-1 z-20 rounded bg-[#005a9e] px-2 py-1 text-xs text-white pointer-events-none" style={{ opacity: selectedSection === 1 ? 1 : 0.7 }}>Section 1</span>}
    </div>
    {Array.from({ length: count - 1 }, (_, i) => {
      const number = i + 2
      const image = typeof block.props[`section${number}Image`] === 'string' ? block.props[`section${number}Image`] as string : ''
      const alt = typeof block.props[`section${number}Alt`] === 'string' ? block.props[`section${number}Alt`] as string : ''
      const text = typeof block.props[`section${number}Text`] === 'string' ? block.props[`section${number}Text`] as string : ''
      const linkValue = typeof block.props[`section${number}ImageLink`] === 'string' ? (block.props[`section${number}ImageLink`] as string).trim() : ''
      const imageLink = /^(https?:\/\/|\/|#)/i.test(linkValue) && !/^\/\//.test(linkValue) ? linkValue : ''
      const sectionImage = image && (imageLink ? <a href={imageLink} onClick={editable ? event => event.preventDefault() : undefined}><img src={image} alt={alt} className="max-w-full h-auto" /></a> : <img src={image} alt={alt} className="max-w-full h-auto" />)
      const textFirst = block.props[`section${number}TextFirst`] === true
      const panel = block.props[`section${number}Panel`] === true
      const extraSpace = Math.max(0, Math.min(4000, Number(block.props[`section${number}ExtraSpace`]) || 0))
      const color = typeof block.props[`section${number}Color`] === 'string' && /^#[0-9a-f]{6}$/i.test(block.props[`section${number}Color`] as string) ? block.props[`section${number}Color`] as string : '#b9aeb6'
      return <div key={number} data-ws-responsive-section className={`min-w-0 p-4 relative ${editable ? 'flex flex-col' : ''}`} data-editor-section={editable ? String(number) : undefined} role={editable ? 'group' : undefined} aria-label={editable ? `Section ${number}` : undefined} tabIndex={editable ? 0 : undefined} onClick={editable ? () => onSelectSection?.(number) : undefined} onKeyDown={editable ? event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.stopPropagation(); onSelectSection?.(number) } } : undefined} style={{ ...(panel ? { backgroundColor: color, borderRadius: '1rem' } : {}), minHeight: Math.max(editable ? 80 : 0, ...(Array.isArray(block.props[`section${number}Objects`]) ? (block.props[`section${number}Objects`] as { y?: number; height?: number }[]).filter(Boolean).map(item => (Number(item.y) || 0) + Math.max(24, Number(item.height) || 80)) : [])) + extraSpace, paddingBottom: extraSpace ? extraSpace + 16 : undefined, ...(editable ? { paddingTop: '2rem', borderLeft: '1px solid #c3c7cb' } : {}) }}>
        {editable && <button type="button" className="ws-section-divider" aria-label={`Resize sections ${number - 1} and ${number}`} title="Drag or use arrow keys to resize sections" onClick={event => event.stopPropagation()} onKeyDown={event => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
          const index = number - 2
          const delta = event.key === 'ArrowLeft' ? -1 : 1
          const next = [...widths]
          if (next[index] + delta < 8 || next[index + 1] - delta < 8) return
          next[index] += delta; next[index + 1] -= delta
          event.preventDefault(); event.stopPropagation()
          useConfigStore.getState().updateBlockProps(block.id, { sectionWidths: next })
        }} onPointerDown={event => {
          if (event.button !== 0) return
          const grid = event.currentTarget.parentElement?.parentElement
          const width = grid?.getBoundingClientRect().width ?? 0
          if (!width || !grid || getComputedStyle(grid).gridTemplateColumns.split(' ').length !== count) return
          drag.current = { index: number - 2, startX: event.clientX, width, widths: [...widths], latest: [...widths] }
          event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId)
        }} onPointerMove={event => resize(event)} onPointerUp={event => resize(event, true)} onPointerCancel={() => { drag.current = null; setDragWidths(null) }} />}
        {editable && <span aria-hidden="true" className="absolute top-1 left-2 z-20 rounded bg-[#005a9e] px-2 py-1 text-xs text-white pointer-events-none" style={{ opacity: selectedSection === number ? 1 : 0.7 }}>Section {number}</span>}
        {!textFirst && sectionImage}
        <div data-section-text-container={number} style={{ position: 'relative', width: Number(block.props[`section${number}TextWidth`]) > 0 ? `${Number(block.props[`section${number}TextWidth`])}px` : 'fit-content', maxWidth: '100%', minHeight: Number(block.props[`section${number}TextHeight`]) > 0 ? `${Number(block.props[`section${number}TextHeight`])}px` : undefined, left: Number(block.props[`section${number}TextLeft`]) || 0, top: Number(block.props[`section${number}TextTop`]) || 0, outline: editable && selectedSection === number ? '1px solid #8290a0' : undefined }}>
          <RichText blockId={block.id} field={`section${number}Text`} text={text} value={block.props[`section${number}TextRich`]} alignment={block.props[`section${number}TextAlign`]} editable={editable} multiline markdown />
          {editable && selectedSection === number && (['move', 'resize'] as const).map(action => <button key={action} type="button" aria-label={`${action === 'move' ? 'Move' : 'Resize'} section ${number} text`} title={`${action === 'move' ? 'Move' : 'Resize'} text`} style={{ position: 'absolute', ...(action === 'move' ? { top: 0, right: 0 } : { bottom: 0, right: 0 }), width: 12, height: 12, border: '1px solid #111', background: 'white', cursor: action === 'move' ? 'move' : 'nwse-resize', touchAction: 'none', zIndex: 40 }} onPointerDown={event => { const element = event.currentTarget.parentElement; if (!element) return; const bounds = element.getBoundingClientRect(); textDrag.current = { section: number, resize: action === 'resize', startX: event.clientX, startY: event.clientY, width: bounds.width, height: bounds.height, left: Number(block.props[`section${number}TextLeft`]) || 0, top: Number(block.props[`section${number}TextTop`]) || 0 }; event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={event => { const state = textDrag.current, element = event.currentTarget.parentElement; if (!state || !element) return; const dx = event.clientX - state.startX, dy = event.clientY - state.startY; if (state.resize) { element.style.width = `${Math.max(40, state.width + dx)}px`; element.style.minHeight = `${Math.max(24, state.height + dy)}px` } else { element.style.left = `${state.left + dx}px`; element.style.top = `${state.top + dy}px` } event.stopPropagation() }} onPointerUp={event => { const state = textDrag.current; if (!state) return; textDrag.current = null; const dx = event.clientX - state.startX, dy = event.clientY - state.startY; useConfigStore.getState().updateBlockProps(block.id, state.resize ? { [`section${number}TextWidth`]: Math.max(40, Math.round(state.width + dx)), [`section${number}TextHeight`]: Math.max(24, Math.round(state.height + dy)) } : { [`section${number}TextLeft`]: Math.round(state.left + dx), [`section${number}TextTop`]: Math.round(state.top + dy) }); event.stopPropagation() }} onPointerCancel={() => { textDrag.current = null }} />)}
        </div>
        {textFirst && sectionImage}
        <SectionObjects block={block} section={number} editable={editable} />
        {Array.isArray(block.props[`section${number}Items`]) && (block.props[`section${number}Items`] as unknown[]).map((value, index) => {
          if (!value || typeof value !== 'object') return null
          const item = value as Record<string, unknown>
          const url = typeof item.url === 'string' && /^(https?:\/\/|\/(?!\/)|#)/i.test(item.url) ? item.url : undefined
          const extraImage = typeof item.src === 'string' && item.src ? <img src={item.src} alt={typeof item.alt === 'string' ? item.alt : ''} className="max-w-full h-auto" /> : null
          return <div key={index} className="my-2">{url && extraImage ? <a href={url} onClick={editable ? event => event.preventDefault() : undefined}>{extraImage}</a> : extraImage}{typeof item.text === 'string' && item.text && <p className="whitespace-pre-wrap">{url ? <a href={url} onClick={editable ? event => event.preventDefault() : undefined}>{item.text}</a> : item.text}</p>}</div>
        })}
      </div>
    })}
  </div>
}
