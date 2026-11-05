import type { BlockConfig } from '../types'

export function DividerBlock({ block }: { block: BlockConfig }) {
  const { variant } = block
  const height = Math.max(40, Number(block.props.layoutHeight) || Number(block.props.height) || 60)
  const stripHeight = `var(--ws-strip-height, ${height}px)`
  const width = (block.props.width as string) || 'full'

  const widthClass = width === 'narrow' ? 'max-w-32' : width === 'centered' ? 'max-w-xs' : 'w-full'

  if (variant === 'space') {
    return <div style={{ height: stripHeight }} />
  }

  if (variant === 'dots') {
    return (
      <div className="flex items-center justify-center gap-2" style={{ minHeight: stripHeight }}>
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-text-3" />
        ))}
      </div>
    )
  }

  // line (default)
  return (
    <div className="flex items-center justify-center" style={{ minHeight: stripHeight }}>
      <div className={`${widthClass} mx-auto border-t border-border-default`} />
    </div>
  )
}
