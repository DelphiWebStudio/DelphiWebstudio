import { useEffect, useRef, useState } from 'react'
import type { Project } from '@/store/projectsStore'
import type { BlockConfig } from '@/blocks/types'
import { ProjectMediaLibrary } from '@/media/media-library'
import { RenderBlock } from '@/blocks/registry'
import { resolveTheme, themeToCSS } from '@/lib/theme-presets'

/** Read-only block previews also work inside the desktop host, which blocks frames. */
export function ProjectThumbnail({ project }: { project: Project }) {
  const host = useRef<HTMLDivElement>(null)
  const [blocks, setBlocks] = useState<BlockConfig[] | null>(null)
  const [scale, setScale] = useState(.2)
  const config = project.config ?? project.projectFile?.config
  useEffect(() => {
    const element = host.current
    if (!element || !config) return
    let active = true
    const urls: string[] = []
    const size = new ResizeObserver(() => setScale(element.clientWidth / 1200))
    size.observe(element)
    const visible = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return
      visible.disconnect()
      void new ProjectMediaLibrary().list(project.id).then(assets => {
        if (!active) return
        const home = config.pages?.find(page => page.path === '/') ?? config.pages?.[0]
        let content = JSON.stringify((home?.blocks ?? config.blocks).slice(0, 4))
        for (const asset of assets) if (content.includes(asset.path) || content.includes(asset.id)) {
          const url = URL.createObjectURL(asset.content)
          urls.push(url)
          content = content.split(asset.path).join(url)
        }
        const preview = JSON.parse(content, (_key, value) => typeof value === 'string' && /^https?:\/\//i.test(value) ? '' : value) as BlockConfig[]
        if (active) setBlocks(preview)
      }).catch(() => { if (active) setBlocks([]) })
    }, { rootMargin: '100px' })
    visible.observe(element)
    return () => { active = false; size.disconnect(); visible.disconnect(); urls.forEach(url => URL.revokeObjectURL(url)) }
  }, [project.id, config, project.mediaRevision])
  return <div ref={host} inert className="absolute inset-0 overflow-hidden bg-white" aria-hidden="true">
    {blocks ? <div className="@container" style={{ ...themeToCSS(resolveTheme(config?.theme)), pointerEvents: 'none', width: 1200, minHeight: 800, transform: `scale(${scale})`, transformOrigin: 'top left', background: 'var(--color-bg-1)', color: 'var(--color-text-0)' } as React.CSSProperties}>
      {blocks.map(block => ['pdfViewer', 'audio', 'mediaVideo', 'video', 'document', 'documentLibrary'].includes(block.type) ? <div key={block.id} className="border-b p-8 text-xl">{String(block.props.title || block.type)}</div> : <RenderBlock key={block.id} block={block} />)}
    </div> : <div className="grid h-full place-items-center text-sm text-slate-500">Page preview</div>}
  </div>
}
