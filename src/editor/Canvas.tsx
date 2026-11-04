import { useEffect, useMemo, useState } from 'react'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'
import { CanvasEmpty } from './CanvasEmpty'
import { BlockWrapper } from '@/blocks/BlockWrapper'
import { RenderBlock } from '@/blocks/registry'
import { resolveTheme, themeToCSS } from '@/lib/theme-presets'
import { useProjectsStore } from '@/store/projectsStore'
import { ProjectMediaLibrary, type MediaAsset } from '@/media/media-library'
import { toast } from 'sonner'
import { blockMetadata } from '@/lib/block-metadata'

export function Canvas() {
  const blocks = useConfigStore((s) => {
    const pages = s.config.pages
    if (!pages || pages.length === 0) return s.config.blocks
    const page = pages.find((p) => p.id === s.activePageId) ?? pages[0]
    return page.blocks
  })
  const theme = useConfigStore((s) => s.config.theme)
  const pages = useConfigStore((s) => s.config.pages)
  const activePageId = useConfigStore((s) => s.activePageId)
  const activeArticle = pages?.find(page => page.id === activePageId)?.webstudioArticle
  const setActivePage = useConfigStore((s) => s.setActivePage)
  const { selectedBlockId, selectBlock, viewport, customViewportWidth, activeProjectId, previewMode } = useEditorStore()
  const textPlacement = useEditorStore(state => state.textPlacement)
  const revision = useProjectsStore(state => state.projects.find(project => project.id === activeProjectId)?.mediaRevision ?? 0)
  const webmasterEmail = useProjectsStore(state => state.projects.find(project => project.id === activeProjectId)?.settings?.webmasterEmail ?? '')
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({})
  const referencedAssets = JSON.stringify([...new Set([
    ...blocks.map(block => typeof block.props.assetId === 'string' ? block.props.assetId : '').filter(Boolean),
    ...(JSON.stringify(blocks).match(/assets\/[a-zA-Z0-9._-]+/g) ?? []),
  ])].sort())

  useEffect(() => {
    if (!activeProjectId) return
    let active = true
    const urls: string[] = []
    new ProjectMediaLibrary().list(activeProjectId).then(assets => {
      if (!active) return
      const mapped: Record<string, string> = {}
      const referenced = new Set<string>(JSON.parse(referencedAssets))
      for (const asset of assets) if (referenced.has(asset.id) || referenced.has(asset.path)) {
        const url = URL.createObjectURL(asset.content)
        mapped[asset.id] = url
        mapped[asset.path] = url
        urls.push(url)
      }
      setAssetUrls(mapped)
    }).catch(() => { if (active) setAssetUrls({}) })
    return () => { active = false; urls.forEach(url => URL.revokeObjectURL(url)) }
  }, [activeProjectId, revision, referencedAssets])

  const resolved = useMemo(() => resolveTheme(theme), [theme])
  const cssVars = useMemo(() => themeToCSS(resolved), [resolved])

  const previewWidth = customViewportWidth ?? (viewport === 'desktop' ? 1200 : viewport === 'tablet' ? 768 : 375)

  useEffect(() => {
    if (!textPlacement) return
    const cancel = (event: KeyboardEvent) => { if (event.key === 'Escape') useEditorStore.getState().setTextPlacement(null) }
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [textPlacement])

  const canvasContent = (
    <div
      className={`@container outline outline-1 rounded-xl ${blocks.length === 0 ? 'min-h-[400px]' : ''} relative z-[1] overflow-clip transition-all duration-300 mx-auto shrink-0`}
      style={{ width: `${previewWidth}px`, ...cssVars, color: 'var(--color-text-0)', backgroundColor: 'var(--color-bg-1)', outlineColor: 'var(--color-border-default)', overflowWrap: 'anywhere' } as React.CSSProperties}
      onPointerDownCapture={event => {
        if (!textPlacement || event.button !== 0 || previewMode) return
        event.preventDefault(); event.stopPropagation()
        useEditorStore.getState().setTextPlacement(null)
        if (textPlacement.projectId !== useEditorStore.getState().activeProjectId || textPlacement.pageId !== useConfigStore.getState().activePageId) { toast.error('The page changed. Select Add text again.'); return }
        const section = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-editor-section]') : null
        const sectionNumber = Number(section?.dataset.editorSection)
        const blockId = section?.closest('[data-webstudio-block-id]')?.getAttribute('data-webstudio-block-id')
        const block = useConfigStore.getState().getActivePageBlocks().find(item => item.id === blockId)
        const area = section?.querySelector<HTMLElement>(`[data-section-object-area="${sectionNumber}"]`)
        if (!block || !area || sectionNumber < 1 || sectionNumber > 4) {
          const meta = blockMetadata.find(item => item.type === 'content')
          if (!meta) return
          const id = `object-${crypto.randomUUID()}`
          const newBlockId = `block-${crypto.randomUUID()}`
          const bounds = event.currentTarget.getBoundingClientRect()
          const x = bounds.width ? Math.max(0, Math.min(70, (event.clientX - bounds.left) / bounds.width * 100)) : 0
          useConfigStore.getState().addBlock({ id: newBlockId, type: 'content', variant: meta.variants[0], props: { ...structuredClone(meta.defaultProps), title: '', body: '', section1Objects: [{ id, type: 'text', text: 'Text', textColor: '', fontSize: '', x, y: 0, width: 30, height: 80, layer: 1 }] } })
          selectBlock(newBlockId)
          useEditorStore.getState().selectSection(1)
          useEditorStore.getState().setNewTextObjectId(id)
          return
        }
        const bounds = area.getBoundingClientRect()
        if (!bounds.width) return
        const key = `section${sectionNumber}Objects`
        const items = Array.isArray(block.props[key]) ? block.props[key] as Array<Record<string, unknown>> : []
        const hitId = event.target instanceof Element ? event.target.closest('[data-section-object]')?.getAttribute('data-section-object') : null
        const parent = items.find(item => item.id === hitId && item.type === 'panel') ?? [...items].filter(item => item.type === 'panel' && typeof item.id === 'string').sort((a, b) => (Number(b.layer) || 0) - (Number(a.layer) || 0)).find(item => {
          const bounds = area.querySelector<HTMLElement>(`[data-section-object="${item.id}"]`)?.getBoundingClientRect()
          return bounds && event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom
        })
        const id = `object-${crypto.randomUUID()}`
        const x = Math.max(0, Math.min(70, (event.clientX - bounds.left) / bounds.width * 100))
        const y = Math.max(0, event.clientY - bounds.top)
        const layer = Math.max(0, ...items.map(item => Number(item.layer) || 0)) + 1
        useConfigStore.getState().updateBlockProps(block.id, { [key]: [...items, { id, type: 'text', text: 'Text', textColor: '', fontSize: '', x, y, width: 30, height: 80, layer, ...(parent ? { parentId: parent.id } : {}) }] })
        selectBlock(block.id)
        useEditorStore.getState().selectSection(sectionNumber)
        useEditorStore.getState().setNewTextObjectId(id)
      }}
      onClick={(e) => {
        if (previewMode && !e.defaultPrevented && e.target instanceof Element) {
          const link = e.target.closest('a[href]')
          if (link) {
            const href = link.getAttribute('href') ?? ''
            if (link.hasAttribute('download') && href.startsWith('blob:')) return
            e.preventDefault()
            const path = href.split(/[?#]/, 1)[0].replace(/\/$/, '') || '/'
            const target = pages?.find(page => page.path === path && page.webstudioArticle?.status !== 'draft')
            if (target && href.startsWith('/')) { setActivePage(target.id); selectBlock(null) }
            else toast('Open the exported website to follow this link.')
            return
          }
        }
        if (e.target === e.currentTarget) selectBlock(null)
      }}
      role="region"
      aria-label={`Site preview, ${blocks.length} blocks, ${viewport} viewport`}
    >
      {textPlacement && <div className="absolute left-0 top-0 z-50 bg-blue-700 px-3 py-2 text-sm text-white" style={{ pointerEvents: 'none' }}>Click inside a section or on a panel to place text. Press Esc to cancel.</div>}
      {!previewMode && viewport === 'desktop' && <div aria-hidden="true" className="absolute inset-y-0 left-1/2 z-30 pointer-events-none" style={{ width: 'min(1100px, calc(100% - 32px))', transform: 'translateX(-50%)', borderLeft: '1px dashed #8996a2', borderRight: '1px dashed #8996a2' }} />}
      {activeArticle && (activeArticle.author || activeArticle.summary || activeArticle.tags?.length) && <header className="px-6 py-3 text-text-1">
        {activeArticle.author && <p className="text-sm">By {activeArticle.author}</p>}
        {activeArticle.summary && <p className="text-sm">{activeArticle.summary}</p>}
        {!!activeArticle.tags?.length && <p className="text-sm">Tags: {activeArticle.tags.join(', ')}</p>}
      </header>}
      {blocks.length === 0 ? <div className="bg-[#dce8f3] min-h-[400px] flex"><CanvasEmpty /></div> : blocks.map((block) => {
        const device = previewWidth < 480 ? 'mobile' : previewWidth < 900 ? 'tablet' : 'desktop'
        const hiddenOnCurrentWidth = block.webstudioHiddenOn?.[device] === true
        if (previewMode && hiddenOnCurrentWidth) return null
        const props = Object.fromEntries(Object.entries(block.props).map(([key, value]) => {
          if (typeof value === 'string' && (/^(src|image|logoImage|heroImage|avatar|url)$/i.test(key) || /^section[2-4]Image$/.test(key))) return [key, assetUrls[value] ?? value]
          if (Array.isArray(value)) return [key, value.map(item => item && typeof item === 'object' && !Array.isArray(item)
            ? Object.fromEntries(Object.entries(item).map(([itemKey, itemValue]) => [itemKey, typeof itemValue === 'string' && /^(src|image|logoImage|heroImage|avatar|url)$/i.test(itemKey) ? assetUrls[itemValue] ?? itemValue : itemKey === 'images' && Array.isArray(itemValue) ? itemValue.map(photo => photo && typeof photo === 'object' && typeof photo.src === 'string' ? { ...photo, src: assetUrls[photo.src] ?? photo.src } : photo) : itemValue]))
            : item)]
          return [key, value]
        }))
        if (typeof block.props.assetId === 'string' && assetUrls[block.props.assetId]) props.src = assetUrls[block.props.assetId]
        if (block.type === 'contact' && !(typeof block.props.recipientEmail === 'string' && block.props.recipientEmail.trim())) props.recipientEmail = webmasterEmail
        return (
        <BlockWrapper
          key={block.id}
          block={{ ...block, props }}
          isSelected={selectedBlockId === block.id}
          hiddenOnCurrentWidth={hiddenOnCurrentWidth}
          onSelect={() => selectBlock(block.id)}
        >
          <RenderBlock block={{ ...block, props }} editable={!previewMode} />
        </BlockWrapper>
        )
      })}
    </div>
  )

  return (
    <div className="flex-1 flex items-start justify-start p-6 overflow-auto relative bg-[#dce8f3]" onDragOver={event => {
      if (!previewMode && (event.dataTransfer.types.includes('application/x-webstudio-asset') || event.dataTransfer.types.includes('application/x-webstudio-component') || event.dataTransfer.types.includes('application/x-webstudio-block') || event.dataTransfer.types.includes('Files'))) { event.preventDefault(); event.dataTransfer.dropEffect = event.dataTransfer.types.includes('application/x-webstudio-block') ? 'move' : 'copy' }
    }} onDrop={event => {
      if (previewMode) return
      const movingBlockId = event.dataTransfer.getData('application/x-webstudio-block')
      if (movingBlockId) {
        event.preventDefault()
        const target = event.target instanceof Element ? event.target.closest('[data-webstudio-block-id]') : null
        const from = blocks.findIndex(block => block.id === movingBlockId)
        const targetIndex = blocks.findIndex(block => block.id === target?.getAttribute('data-webstudio-block-id'))
        if (from < 0 || targetIndex < 0 || !target) return
        let to = targetIndex + (event.clientY >= target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2 ? 1 : 0)
        if (from < to) to--
        if (to !== from) useConfigStore.getState().moveBlock(from, to)
        selectBlock(movingBlockId)
        return
      }
      const componentType = event.dataTransfer.getData('application/x-webstudio-component')
      if (componentType) {
        const meta = blockMetadata.find(item => item.type === componentType && item.type !== 'pricing')
        if (!meta) return
        event.preventDefault()
        const target = event.target instanceof Element ? event.target.closest('[data-webstudio-block-id]') : null
        const targetId = target?.getAttribute('data-webstudio-block-id')
        const targetIndex = blocks.findIndex(block => block.id === targetId)
        const index = targetIndex < 0 || !target ? undefined : targetIndex + (event.clientY >= target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2 ? 1 : 0)
        const id = `block-${crypto.randomUUID()}`
        useConfigStore.getState().addBlock({ id, type: meta.type, variant: meta.variants[0], props: structuredClone(meta.defaultProps) }, index)
        selectBlock(id)
        toast(`${meta.label} added`)
        return
      }
      const assetId = event.dataTransfer.getData('application/x-webstudio-asset')
      const files = Array.from(event.dataTransfer.files)
      if ((!assetId && !files.length) || !activeProjectId) return
      event.preventDefault()
      const target = event.target instanceof Element ? event.target.closest('[data-webstudio-block-id]') : null
      const rect = target?.getBoundingClientRect()
      const blockId = target?.getAttribute('data-webstudio-block-id')
      const dropped = blockId && rect?.width && rect.height ? { blockId, x: Math.max(0, Math.min(99, (event.clientX - rect.left) / rect.width * 100)), y: Math.max(0, Math.min(99, (event.clientY - rect.top) / rect.height * 100)), pageId: activePageId, projectId: activeProjectId } : null
      const destination = dropped
      const sectionElement = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-editor-section]') : null
      const sectionNumber = Number(sectionElement?.dataset.editorSection)
      const sectionBounds = sectionElement?.getBoundingClientRect()
      const sectionDestination = sectionElement && sectionBounds?.width && sectionNumber >= 1 && sectionNumber <= 4 && blockId ? { sectionNumber, blockId, width: sectionBounds.width, x: Math.max(0, Math.min(70, (event.clientX - sectionBounds.left) / sectionBounds.width * 100)), y: Math.max(0, event.clientY - sectionBounds.top) } : null
      const placeAsset = (asset: MediaAsset, offset: number) => {
        if (useEditorStore.getState().activeProjectId !== activeProjectId || useConfigStore.getState().activePageId !== activePageId) throw new Error('The project or page changed; select the intended page and try again.')
        if (sectionDestination && asset.mime.startsWith('image/')) {
          const block = useConfigStore.getState().getActivePageBlocks().find(item => item.id === sectionDestination.blockId)
          if (!block) throw new Error('The selected block no longer exists.')
          const key = `section${sectionDestination.sectionNumber}Objects`, objects = Array.isArray(block.props[key]) ? block.props[key] : []
          const height = asset.width && asset.height ? Math.max(24, sectionDestination.width * .3 * asset.height / asset.width) : 180
          useConfigStore.getState().updateBlockProps(block.id, { [key]: [...objects, { id: `object-${crypto.randomUUID()}`, type: 'image', src: asset.path, assetId: asset.id, alt: asset.name, x: Math.min(70, sectionDestination.x + offset * 2), y: sectionDestination.y + offset * 12, width: 30, height, layer: objects.length + 1 }] })
          useEditorStore.getState().selectBlock(block.id); useEditorStore.getState().selectSection(sectionDestination.sectionNumber)
          return
        }
        if (destination) {
          const block = useConfigStore.getState().getActivePageBlocks().find(item => item.id === destination.blockId)
          if (!block) throw new Error('The selected block no longer exists.')
          const x = Math.min(99, destination.x + offset * 2), y = Math.min(99, destination.y + offset * 2)
          const existing = Array.isArray(block.props.placedMedia) ? block.props.placedMedia : []
          useConfigStore.getState().updateBlockProps(block.id, { placedMedia: [...existing, { id: `placed-${crypto.randomUUID()}`, assetId: asset.id, src: asset.path, name: asset.name, mime: asset.mime, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, width: Math.max(1, Math.min(25, 100 - x)) }] })
          useEditorStore.getState().selectBlock(block.id)
        } else {
          const id = `block-${crypto.randomUUID()}`
          const type = asset.mime === 'application/pdf' ? 'pdfViewer' : asset.mime.startsWith('image/') ? 'image' : asset.mime.startsWith('audio/') ? 'audio' : asset.mime.startsWith('video/') ? 'mediaVideo' : 'document'
          useConfigStore.getState().addBlock({ id, type, variant: type === 'image' ? 'hero-image' : 'default', props: type === 'image' ? { assetId: asset.id, src: asset.path, alt: asset.name, layoutWidth: 40 } : { assetId: asset.id, src: asset.path, title: asset.name, alt: asset.name } })
          useEditorStore.getState().selectBlock(id)
        }
      }
      void (async () => {
        const library = new ProjectMediaLibrary()
        if (assetId) {
          const asset = (await library.list(activeProjectId)).find(item => item.id === assetId)
          if (!asset) throw new Error('The media file is no longer available.')
          placeAsset(asset, 0)
        } else {
          if (useEditorStore.getState().mediaImporting) throw new Error('Wait for the current media import to finish.')
          useEditorStore.getState().setMediaImporting(true)
          try {
            for (const [index, file] of files.entries()) {
              const { asset } = await library.import(activeProjectId, file)
              useProjectsStore.getState().mediaChanged(activeProjectId)
              placeAsset(asset, index)
            }
          } finally { useEditorStore.getState().setMediaImporting(false) }
        }
        toast('Media added to page')
      })().catch(error => toast.error(error instanceof Error ? error.message : 'Media could not be added.'))
    }}>
      {/* Dot grid background */}
      <div
        className="absolute inset-0 opacity-50 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #9bb4ca 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />

      {viewport === 'tablet' ? (
        <div className="relative z-[1] shrink-0 mx-auto" style={{ width: previewWidth + 24 }}>
          {/* Tablet frame */}
          <div className="border-[12px] border-bg-4 rounded-2xl bg-bg-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <div className="rounded-lg overflow-hidden">
              {canvasContent}
            </div>
          </div>
        </div>
      ) : viewport === 'mobile' ? (
        <div className="relative z-[1] shrink-0 mx-auto" style={{ width: previewWidth + 20 }}>
          {/* Phone frame */}
          <div className="border-[10px] border-bg-4 rounded-[2rem] bg-bg-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            {/* Notch */}
            <div className="flex justify-center -mt-[4px] mb-1">
              <div className="w-24 h-5 bg-bg-4 rounded-b-xl" />
            </div>
            <div className="rounded-xl overflow-hidden">
              {canvasContent}
            </div>
            {/* Home indicator */}
            <div className="flex justify-center mt-2 pb-1">
              <div className="w-28 h-1 bg-bg-5 rounded-full" />
            </div>
          </div>
        </div>
      ) : (
        canvasContent
      )}
    </div>
  )
}
