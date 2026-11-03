import { renderMarkdown } from '@/lib/markdown'
import type { BlockConfig } from '../types'

export function PanelBlock({ block }: { block: BlockConfig }) {
  const { props } = block
  const src = typeof props.src === 'string' ? props.src : ''
  const alt = typeof props.alt === 'string' ? props.alt : ''
  const title = typeof props.title === 'string' ? props.title : ''
  const body = typeof props.body === 'string' ? props.body : ''
  const height = Number(props.layoutHeight)
  return <section className="rounded-2xl p-4" style={{ minHeight: Number.isFinite(height) && height > 0 ? Math.max(40, Math.min(2000, height)) : undefined }}>
    {src && <img src={src} alt={alt} draggable={false} className="mx-auto max-w-full h-auto mb-3" />}
    {title && <h2 className="text-xl font-semibold mb-3">{title}</h2>}
    {renderMarkdown(body)}
  </section>
}
