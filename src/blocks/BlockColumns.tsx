import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { useConfigStore } from '@/store/configStore'
import type { BlockConfig } from './types'
import { RichText } from './RichText'

export function BlockColumns({ block, children, editable = false, selectedSection = 0, onSelectSection }: { block: BlockConfig; children?: ReactNode; editable?: boolean; selectedSection?: number; onSelectSection?: (section: number) => void }) {
  const count = Math.min(4, Math.max(1, Math.floor(Number(block.props.sectionCount) || 1)))
  const [dragWidths, setDragWidths] = useState<number[] | null>(null)
  const drag = useRef<{ index: number; startX: number; width: number; widths: number[]; latest: number[] } | null>(null)
  const stored = block.props.sectionWidths
  const savedWidths = Array.isArray(stored) && stored.length === count && stored.every(value => typeof value === 'number' && Number.isFinite(value) && value > 0) ? stored as number[] : Array.from({ length: count }, () => 100 / count)
  const widths = dragWidths?.length === count ? dragWidths : savedWidths
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
  if (count === 1) return <>{children}</>
  return <div className="ws-block-columns grid grid-cols-1" style={{ '--ws-section-widths': widths.map(value => `${value}fr`).join(' ') } as CSSProperties}>
    <div className="min-w-0 relative" data-editor-section={editable ? '1' : undefined} role={editable ? 'group' : undefined} aria-label={editable ? 'Section 1' : undefined} tabIndex={editable ? 0 : undefined} onClick={editable ? () => onSelectSection?.(1) : undefined} onKeyDown={editable ? event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.stopPropagation(); onSelectSection?.(1) } } : undefined}>
      {children}
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
      const color = typeof block.props[`section${number}Color`] === 'string' && /^#[0-9a-f]{6}$/i.test(block.props[`section${number}Color`] as string) ? block.props[`section${number}Color`] as string : '#b9aeb6'
      return <div key={number} className={`min-w-0 p-4 relative ${editable ? 'flex flex-col' : ''}`} data-editor-section={editable ? String(number) : undefined} role={editable ? 'group' : undefined} aria-label={editable ? `Section ${number}` : undefined} tabIndex={editable ? 0 : undefined} onClick={editable ? () => onSelectSection?.(number) : undefined} onKeyDown={editable ? event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.stopPropagation(); onSelectSection?.(number) } } : undefined} style={{ ...(panel ? { backgroundColor: color, borderRadius: '1rem' } : {}), ...(editable ? { minHeight: '80px', paddingTop: '2rem', borderLeft: '1px solid #c3c7cb' } : {}) }}>
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
        <RichText blockId={block.id} field={`section${number}Text`} text={text} value={block.props[`section${number}TextRich`]} alignment={block.props[`section${number}TextAlign`]} editable={editable} multiline markdown fill />
        {textFirst && sectionImage}
      </div>
    })}
  </div>
}
