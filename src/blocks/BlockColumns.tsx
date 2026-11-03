import type { ReactNode } from 'react'
import { renderMarkdown } from '@/lib/markdown'
import type { BlockConfig } from './types'

export function BlockColumns({ block, children }: { block: BlockConfig; children?: ReactNode }) {
  const count = Math.min(4, Math.max(1, Math.floor(Number(block.props.sectionCount) || 1)))
  if (count === 1) return <>{children}</>
  const layouts = ['', '', '@md:grid-cols-2', '@md:grid-cols-3', '@md:grid-cols-4']
  return <div className={`grid grid-cols-1 ${layouts[count]} gap-4`}>
    <div className="min-w-0">{children}</div>
    {Array.from({ length: count - 1 }, (_, i) => {
      const number = i + 2
      const image = typeof block.props[`section${number}Image`] === 'string' ? block.props[`section${number}Image`] as string : ''
      const alt = typeof block.props[`section${number}Alt`] === 'string' ? block.props[`section${number}Alt`] as string : ''
      const text = typeof block.props[`section${number}Text`] === 'string' ? block.props[`section${number}Text`] as string : ''
      return <div key={number} className="min-w-0 p-4">
        {image && <img src={image} alt={alt} className="max-w-full h-auto" />}
        {renderMarkdown(text)}
      </div>
    })}
  </div>
}
