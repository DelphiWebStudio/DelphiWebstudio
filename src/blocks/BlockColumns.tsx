import type { ReactNode } from 'react'
import { renderMarkdown } from '@/lib/markdown'
import type { BlockConfig } from './types'

export function BlockColumns({ block, children, editable = false, selectedSection = 0, onSelectSection }: { block: BlockConfig; children?: ReactNode; editable?: boolean; selectedSection?: number; onSelectSection?: (section: number) => void }) {
  const count = Math.min(4, Math.max(1, Math.floor(Number(block.props.sectionCount) || 1)))
  if (count === 1) return <>{children}</>
  const layouts = ['', '', '@md:grid-cols-2', '@md:grid-cols-3', '@md:grid-cols-4']
  return <div className={`grid grid-cols-1 ${layouts[count]} gap-4`}>
    <div className="min-w-0 relative" data-editor-section={editable ? '1' : undefined} role={editable ? 'group' : undefined} aria-label={editable ? 'Section 1' : undefined} tabIndex={editable ? 0 : undefined} onClick={editable ? () => onSelectSection?.(1) : undefined} onKeyDown={editable ? event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.stopPropagation(); onSelectSection?.(1) } } : undefined} style={editable && selectedSection === 1 ? { outline: '2px solid #0078d4', outlineOffset: '-2px' } : undefined}>
      {editable && <span aria-hidden="true" className="absolute top-1 left-1 z-20 rounded bg-[#005a9e] px-2 py-1 text-xs text-white pointer-events-none">Section 1</span>}
      {children}
    </div>
    {Array.from({ length: count - 1 }, (_, i) => {
      const number = i + 2
      const image = typeof block.props[`section${number}Image`] === 'string' ? block.props[`section${number}Image`] as string : ''
      const alt = typeof block.props[`section${number}Alt`] === 'string' ? block.props[`section${number}Alt`] as string : ''
      const text = typeof block.props[`section${number}Text`] === 'string' ? block.props[`section${number}Text`] as string : ''
      const panel = block.props[`section${number}Panel`] === true
      const color = typeof block.props[`section${number}Color`] === 'string' && /^#[0-9a-f]{6}$/i.test(block.props[`section${number}Color`] as string) ? block.props[`section${number}Color`] as string : '#b9aeb6'
      return <div key={number} className="min-w-0 p-4 relative" data-editor-section={editable ? String(number) : undefined} role={editable ? 'group' : undefined} aria-label={editable ? `Section ${number}` : undefined} tabIndex={editable ? 0 : undefined} onClick={editable ? () => onSelectSection?.(number) : undefined} onKeyDown={editable ? event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.stopPropagation(); onSelectSection?.(number) } } : undefined} style={{ ...(panel ? { backgroundColor: color, borderRadius: '1rem' } : {}), ...(editable ? { minHeight: '80px', borderLeft: '2px solid #58a6ff', ...(selectedSection === number ? { outline: '2px solid #0078d4', outlineOffset: '-2px' } : {}) } : {}) }}>
        {editable && <span aria-hidden="true" className="absolute top-1 left-2 z-20 rounded bg-[#005a9e] px-2 py-1 text-xs text-white pointer-events-none">Section {number}</span>}
        {image && <img src={image} alt={alt} className="max-w-full h-auto" />}
        {renderMarkdown(text)}
      </div>
    })}
  </div>
}
