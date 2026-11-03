import type { ReactNode } from 'react'
import type { BlockConfig } from './types'
import { RichText } from './RichText'

export function BlockColumns({ block, children, editable = false, selectedSection = 0, onSelectSection }: { block: BlockConfig; children?: ReactNode; editable?: boolean; selectedSection?: number; onSelectSection?: (section: number) => void }) {
  const count = Math.min(4, Math.max(1, Math.floor(Number(block.props.sectionCount) || 1)))
  if (count === 1) return <>{children}</>
  const layouts = ['', '', '@md:grid-cols-2', '@md:grid-cols-3', '@md:grid-cols-4']
  return <div className={`grid grid-cols-1 ${layouts[count]} gap-4`}>
    <div className="min-w-0 relative" data-editor-section={editable ? '1' : undefined} role={editable ? 'group' : undefined} aria-label={editable ? 'Section 1' : undefined} tabIndex={editable ? 0 : undefined} onClick={editable ? () => onSelectSection?.(1) : undefined} onKeyDown={editable ? event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.stopPropagation(); onSelectSection?.(1) } } : undefined}>
      {children}
      {editable && <span aria-hidden="true" className="absolute top-1 left-1 z-20 rounded bg-[#005a9e] px-2 py-1 text-xs text-white pointer-events-none" style={{ opacity: selectedSection === 1 ? 1 : 0.7 }}>Section 1</span>}
    </div>
    {Array.from({ length: count - 1 }, (_, i) => {
      const number = i + 2
      const image = typeof block.props[`section${number}Image`] === 'string' ? block.props[`section${number}Image`] as string : ''
      const alt = typeof block.props[`section${number}Alt`] === 'string' ? block.props[`section${number}Alt`] as string : ''
      const text = typeof block.props[`section${number}Text`] === 'string' ? block.props[`section${number}Text`] as string : ''
      const panel = block.props[`section${number}Panel`] === true
      const color = typeof block.props[`section${number}Color`] === 'string' && /^#[0-9a-f]{6}$/i.test(block.props[`section${number}Color`] as string) ? block.props[`section${number}Color`] as string : '#b9aeb6'
      return <div key={number} className={`min-w-0 p-4 relative ${editable ? 'flex flex-col' : ''}`} data-editor-section={editable ? String(number) : undefined} role={editable ? 'group' : undefined} aria-label={editable ? `Section ${number}` : undefined} tabIndex={editable ? 0 : undefined} onClick={editable ? () => onSelectSection?.(number) : undefined} onKeyDown={editable ? event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.stopPropagation(); onSelectSection?.(number) } } : undefined} style={{ ...(panel ? { backgroundColor: color, borderRadius: '1rem' } : {}), ...(editable ? { minHeight: '80px', paddingTop: '2rem', borderLeft: '1px solid #c3c7cb' } : {}) }}>
        {editable && <span aria-hidden="true" className="absolute top-1 left-2 z-20 rounded bg-[#005a9e] px-2 py-1 text-xs text-white pointer-events-none" style={{ opacity: selectedSection === number ? 1 : 0.7 }}>Section {number}</span>}
        {image && <img src={image} alt={alt} className="max-w-full h-auto" />}
        <RichText blockId={block.id} field={`section${number}Text`} text={text} value={block.props[`section${number}TextRich`]} editable={editable} multiline markdown fill />
      </div>
    })}
  </div>
}
