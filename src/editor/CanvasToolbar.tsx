import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Monitor,
  Tablet,
  Smartphone,
  Undo2,
  Redo2,
  Eye,
  Plus,
  HelpCircle,
  Download,
  Loader2,
  Pencil,
  Copy,
  Trash2,
  Link,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { useEditorStore, type Viewport, type EditorMode } from '@/store/editorStore'
import { useConfigStore } from '@/store/configStore'
import { useProjectsStore } from '@/store/projectsStore'
import type { PageConfig, SiteConfig } from '@/blocks/types'
import { exportToHTML, downloadHTML, exportSiteZip } from '@/lib/export-html'
import { EditorMenus } from './EditorMenus'
import { ProjectFileCommands } from '@/project/ProjectFileCommands'
import { portableProjectsEnabled } from '@/project/project-file'
import { ProjectMediaLibrary } from '@/media/media-library'
import { requestDesktopAction } from '@/desktop/native-bridge'
import { PlanPages } from './PlanPages'
import { SiteChecks } from './SiteChecks'
import { pageLinkPath, planPageAddressChange, visitBlockLinks } from '@/project/page-links'
import { GeminiPageAssistant } from '@/ai/GeminiPageAssistant'

const viewports: { value: Viewport; icon: typeof Monitor; label: string }[] = [
  { value: 'desktop', icon: Monitor, label: 'Desktop' },
  { value: 'tablet', icon: Tablet, label: 'Tablet' },
  { value: 'mobile', icon: Smartphone, label: 'Mobile' },
]

function AddPageDialog({ onAdd, onClose }: { onAdd: (name: string, path: string) => void; onClose: () => void }) {
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [error, setError] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = dialog.current
    if (element && !element.open) element.showModal()
  }, [])

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) return
    const cleanPath = path.trim() || `/${trimmed.toLowerCase().replace(/\s+/g, '-')}`
    try {
      onAdd(trimmed, cleanPath)
      dialog.current?.close()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Page could not be added')
    }
  }

  return (
    <dialog ref={dialog} onClose={onClose} aria-labelledby="add-page-title" className="m-auto w-[min(92vw,26rem)] rounded-xl border border-border-default bg-bg-1 p-5 text-text-0 shadow-xl backdrop:bg-black/60">
      <h2 id="add-page-title" className="text-lg font-semibold">Add page</h2>
      <form onSubmit={event => { event.preventDefault(); submit() }}>
        <label htmlFor="add-page-name" className="mt-4 block text-sm">Page name</label>
        <input
          id="add-page-name"
          value={name}
          onChange={event => { setName(event.target.value); setError('') }}
          className="mt-1 w-full rounded border border-border-default bg-bg-2 px-3 py-2 text-sm"
        />
        <label htmlFor="add-page-path" className="mt-3 block text-sm">Page address <span className="text-text-2">(optional)</span></label>
        <input
          id="add-page-path"
          value={path}
          onChange={event => { setPath(event.target.value); setError('') }}
          placeholder="/about"
          aria-describedby="add-page-path-hint"
          className="mt-1 w-full rounded border border-border-default bg-bg-2 px-3 py-2 text-sm"
        />
        <p id="add-page-path-hint" className="mt-1 text-xs text-text-2">Leave blank to use the page name.</p>
        {error && <p role="alert" className="mt-2 text-sm text-status-red">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => dialog.current?.close()} className="rounded border border-border-default px-3 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={!name.trim()} className="rounded bg-green px-3 py-2 text-sm font-semibold text-black disabled:opacity-50">Add page</button>
        </div>
      </form>
    </dialog>
  )
}

function PageTab({ page, isActive, editing, onClick, onEdit, onSettings, onRename, onCancel }: {
  page: PageConfig
  isActive: boolean
  editing: boolean
  onClick: () => void
  onEdit: () => void
  onSettings: () => void
  onRename: (name: string) => void
  onCancel: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const tabRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.select()
      return
    }
    const tab = tabRef.current
    const tabList = tab?.parentElement
    if (!isActive || !tab || !tabList) return
    const tabBounds = tab.getBoundingClientRect()
    const listBounds = tabList.getBoundingClientRect()
    if (tabBounds.left < listBounds.left) tabList.scrollLeft += tabBounds.left - listBounds.left
    else if (tabBounds.right > listBounds.right) tabList.scrollLeft += tabBounds.right - listBounds.right
  }, [editing, isActive])

  if (editing) {
    return (
      <input
        ref={inputRef}
        aria-label={`Rename ${page.name}`}
        defaultValue={page.name}
        autoFocus
        onBlur={event => {
          const name = event.currentTarget.value.trim()
          if (name && name !== page.name) onRename(name)
          onCancel()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') { e.preventDefault(); onCancel() }
        }}
        className="w-28 shrink-0 rounded border border-green bg-bg-3 px-2 py-1 text-xs outline-none"
        onClick={(e) => e.stopPropagation()}
      />
    )
  }

  return (
    <button
      ref={tabRef}
      type="button"
      aria-current={isActive ? 'page' : undefined}
      onClick={onClick}
      onDoubleClick={onEdit}
      onContextMenu={event => { event.preventDefault(); onSettings() }}
      onKeyDown={event => {
        if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) { event.preventDefault(); onSettings() }
      }}
      aria-haspopup="dialog"
      className={`shrink-0 whitespace-nowrap rounded px-2 py-1 text-xs transition-colors ${
        isActive ? 'bg-bg-3 text-text-0' : 'text-text-3 hover:text-text-1 hover:bg-bg-2'
      }`}
      title={`${page.name} (${page.path})`}
    >
      {page.name}
    </button>
  )
}

function EditPageSeoDialog({ page, onCancel, onSave }: { page: PageConfig; onCancel: () => void; onSave: (title: string, description: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [title, setTitle] = useState(page.webstudioSeo?.title ?? '')
  const [description, setDescription] = useState(page.webstudioSeo?.description ?? '')
  const [error, setError] = useState('')
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => { if (element?.open) element.close() } }, [])
  return <dialog ref={dialog} onCancel={event => { event.preventDefault(); onCancel() }} aria-labelledby="page-seo-title" className="w-[min(92vw,32rem)] rounded-xl border border-border-default bg-bg-1 p-5 text-text-0 shadow-xl backdrop:bg-black/60">
    <h2 id="page-seo-title" className="text-lg font-semibold">Search details for {page.name}</h2>
    <p className="mt-2 text-sm text-text-2">Set this page's title and description for search and sharing. Leave either blank to use the site-wide setting.</p>
    <label htmlFor="page-search-title" className="mt-4 block text-sm">Page title</label>
    <input id="page-search-title" value={title} onChange={event => setTitle(event.target.value)} className="mt-1 w-full rounded border border-border-default bg-bg-2 px-3 py-2 text-sm" />
    <label htmlFor="page-search-description" className="mt-3 block text-sm">Page description</label>
    <textarea id="page-search-description" value={description} onChange={event => setDescription(event.target.value)} rows={3} className="mt-1 w-full rounded border border-border-default bg-bg-2 px-3 py-2 text-sm" />
    {error && <p role="alert" className="mt-2 text-sm text-status-red">{error}</p>}
    <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded border border-border-default px-3 py-2 text-sm">Cancel</button><button type="button" onClick={() => { try { onSave(title, description) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Search details could not be saved.') } }} className="rounded bg-green px-3 py-2 text-sm font-semibold text-black">Save details</button></div>
  </dialog>
}

function EditPagePathDialog({ page, config, onCancel, onSave }: { page: PageConfig; config: SiteConfig; onCancel: () => void; onSave: (name: string, path: string, updateLinks: boolean, includeChildPages: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState(page.name)
  const [path, setPath] = useState(page.path)
  const [error, setError] = useState('')
  const [updateLinks, setUpdateLinks] = useState(true)
  const [includeChildPages, setIncludeChildPages] = useState(false)
  const childPages = page.path === '/' ? [] : (config.pages ?? []).filter(item => item.id !== page.id && item.path.startsWith(`${page.path}/`))
  const changes = planPageAddressChange(config, page.id, path, includeChildPages)
  const destinations = new Set(changes.flatMap(change => [change.from, encodeURI(change.from)]))
  const linkedPages = (config.pages ?? []).map(item => {
    let count = 0
    for (const block of item.blocks) visitBlockLinks(block, destination => {
      if (/^\/(?!\/)/.test(destination) && destinations.has(pageLinkPath(destination))) count++
    })
    return { page: item, count }
  }).filter(item => item.count > 0)
  let reusableCount = 0
  for (const section of config.webstudioReusableSections ?? []) visitBlockLinks(section.block, destination => {
    if (/^\/(?!\/)/.test(destination) && destinations.has(pageLinkPath(destination))) reusableCount++
  })
  const previewPath = changes[0]?.to ?? page.path
  const filename = previewPath === '/' ? 'index.html' : `${previewPath.slice(1)}.html`
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => { if (element?.open) element.close() } }, [])
  return <dialog ref={dialog} onCancel={event => { event.preventDefault(); onCancel() }} aria-labelledby="page-path-title" className="w-[min(92vw,38rem)] max-h-[85vh] overflow-auto rounded-xl border border-border-default bg-bg-1 p-5 text-text-0 shadow-xl backdrop:bg-black/60">
    <h2 id="page-path-title" className="text-lg font-semibold">Page settings for {page.name}</h2>
    <p className="mt-2 text-sm text-text-2">The page name identifies it in the editor. Its address determines the exported filename. Your content and design stay in place.</p>
    <form onSubmit={event => { event.preventDefault(); try { onSave(name, path, updateLinks, includeChildPages) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Page settings could not be saved.') } }}>
      <label htmlFor="page-settings-name" className="mt-4 block text-sm">Page name</label>
      <input id="page-settings-name" value={name} onChange={event => { setName(event.target.value); setError('') }} className="mt-1 w-full rounded border border-border-default bg-bg-2 px-3 py-2 text-sm" />
      <p className="mt-3 text-sm">Current address: <span className="break-all font-mono">{page.path}</span></p>
      <label htmlFor="page-path" className="mt-3 block text-sm">Page address</label>
      <input id="page-path" value={path} readOnly={page.path === '/'} aria-describedby="page-address-hint" onChange={event => { setPath(event.target.value); setError('') }} className="mt-1 w-full rounded border border-border-default bg-bg-2 px-3 py-2 text-sm read-only:opacity-70" />
      <p id="page-address-hint" className="mt-1 text-xs text-text-2">{page.path === '/' ? 'Home keeps the address / and exports as index.html.' : 'Use an address such as /about-us. The leading slash is added if you leave it out. Use hyphens between words.'}</p>
      <dl className="mt-3 rounded border border-border-default bg-bg-2 p-3 text-sm">
        <div><dt className="inline">Resulting address: </dt><dd className="inline break-all font-mono" data-page-address-preview>{previewPath}</dd></div>
        <div className="mt-1"><dt className="inline">Exported filename: </dt><dd className="inline break-all font-mono">{filename}</dd></div>
      </dl>
      {childPages.length > 0 && <div className="mt-3 text-sm">
        <label className="flex items-start gap-2"><input type="checkbox" checked={includeChildPages} onChange={event => { setIncludeChildPages(event.target.checked); setError('') }} /> Also change related page addresses ({childPages.length})</label>
        <p className="mt-1 text-xs text-text-2">Leave this clear to keep related addresses unchanged. Submenu labels and grouping are not changed.</p>
        {includeChildPages && changes.length > 1 && <ul aria-label="Related address changes" className="mt-2 max-h-28 overflow-auto rounded bg-bg-2 p-2 text-xs">{changes.slice(1).map(change => <li key={change.pageId} className="break-all">{change.from} → {change.to}</li>)}</ul>}
      </div>}
      {changes.length > 0 && <div className="mt-4 rounded border border-border-default p-3 text-sm">
        <label className="flex items-start gap-2"><input type="checkbox" checked={updateLinks} onChange={event => setUpdateLinks(event.target.checked)} /> Update links within this website</label>
        <p className="mt-2 text-xs text-text-2">Supported text, image, button, navigation and footer links retain their anchors and query details. Menu wording is left as you wrote it.</p>
        <details className="mt-2"><summary className="cursor-pointer">Review {linkedPages.reduce((sum, item) => sum + item.count, 0) + reusableCount} link references</summary>
          {linkedPages.length || reusableCount ? <ul className="mt-1 max-h-32 overflow-auto pl-3 text-xs">{linkedPages.map(item => <li key={item.page.id}>{item.page.name}: {item.count}</li>)}{reusableCount > 0 && <li>Saved reusable sections: {reusableCount}</li>}</ul> : <p className="mt-1 text-xs">No supported project links point to the addresses being changed.</p>}
        </details>
        {!updateLinks && linkedPages.length > 0 && <p className="mt-2 text-xs text-status-red">These links will keep their old destinations. Review them before exporting.</p>}
        <p className="mt-2 text-xs text-text-2">Links in custom code, full website URLs and external bookmarks need separate review. Saving here does not redirect the old address on a published website.</p>
      </div>}
      <p className="mt-3 text-xs text-text-2">Use Undo to reverse the saved page settings and link updates together. Export or refresh your local site to see the new filenames.</p>
      {error && <p role="alert" className="mt-2 text-sm text-status-red">{error}</p>}
      <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded border border-border-default px-3 py-2 text-sm">Cancel</button><button type="submit" disabled={!name.trim() || !path.trim()} className="rounded bg-green px-3 py-2 text-sm font-semibold text-black disabled:opacity-50">Save page settings</button></div>
    </form>
  </dialog>
}

function DeletePageDialog({ page, linkedPages, onCancel, onConfirm }: {
  page: PageConfig
  linkedPages: PageConfig[]
  onCancel: () => void
  onConfirm: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => { if (element?.open) element.close() }
  }, [])
  return (
    <dialog ref={dialog} onCancel={event => { event.preventDefault(); onCancel() }} aria-labelledby="delete-page-title" className="w-[min(92vw,32rem)] rounded-xl border border-border-default bg-bg-1 p-5 text-text-0 shadow-xl backdrop:bg-black/60">
      <h2 id="delete-page-title" className="text-lg font-semibold">Delete {page.name}?</h2>
      <p className="mt-2 text-sm text-text-2">This removes the page and its contents. You can restore it with Undo.</p>
      {linkedPages.length > 0 && <div className="mt-3 rounded border border-status-red/40 p-3 text-sm" role="status">
        <p>These pages have known links pointing to {page.path}. Those links will no longer reach this page:</p>
        <ul className="mt-2 list-disc pl-5">{linkedPages.map(linked => <li key={linked.id}>{linked.name}</li>)}</ul>
      </div>}
      <p className="mt-3 text-xs text-text-2">Other links, including links in unsupported or custom content, are not checked.</p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded border border-border-default px-3 py-2 text-sm">Cancel</button>
        <button type="button" onClick={onConfirm} className="rounded bg-status-red px-3 py-2 text-sm font-semibold text-white">Delete page</button>
      </div>
    </dialog>
  )
}

export function CanvasToolbar({ settingsOpen = false, onOpenSettings }: { settingsOpen?: boolean; onOpenSettings?: () => void } = {}) {
  const navigate = useNavigate()
  const { viewport, setViewport, customViewportWidth, setCustomViewportWidth, mode, setMode, togglePreview, toggleShortcutsModal, previewMode, activeProjectId } = useEditorStore()
  const { undo, redo, canUndo, canRedo } = useConfigStore()
  const undoStack = useConfigStore((s) => s.undoStack)
  const redoStack = useConfigStore((s) => s.redoStack)
  const pages = useConfigStore((s) => s.config.pages) ?? []
  const activePageId = useConfigStore((s) => s.activePageId)
  const setActivePage = useConfigStore((s) => s.setActivePage)
  const addPage = useConfigStore((s) => s.addPage)
  const removePage = useConfigStore((s) => s.removePage)
  const duplicatePage = useConfigStore((s) => s.duplicatePage)
  const renamePage = useConfigStore((s) => s.renamePage)
  const updatePageSettings = useConfigStore((s) => s.updatePageSettings)
  const updatePageSeo = useConfigStore((s) => s.updatePageSeo)
  const projects = useProjectsStore((s) => s.projects)
  const configName = useConfigStore((s) => s.config.name)
  const config = useConfigStore((s) => s.config)
  const [showAddPage, setShowAddPage] = useState(false)
  const [showPlanPages, setShowPlanPages] = useState(false)
  const [showAiAssistant, setShowAiAssistant] = useState(false)
  const [showSiteChecks, setShowSiteChecks] = useState(false)
  const [deletingPage, setDeletingPage] = useState<{ id: string; projectId: string | null } | null>(null)
  const [editingPath, setEditingPath] = useState<{ id: string; projectId: string | null } | null>(null)
  const [editingSeo, setEditingSeo] = useState<{ id: string; projectId: string | null } | null>(null)
  const [renamingPage, setRenamingPage] = useState<{ id: string; projectId: string | null } | null>(null)
  const [exporting, setExporting] = useState(false)

  const activeProject = activeProjectId ? projects.find((p) => p.id === activeProjectId) : null
  const projectName = activeProject?.name || configName
  const selectedPage = pages.find(page => page.id === activePageId)
  const selectedTarget = selectedPage ? { id: selectedPage.id, projectId: activeProjectId } : null
  const selectedName = selectedPage?.name ?? 'selected page'
  const canChangeAddress = !!selectedPage && selectedPage.path !== '/'
  const canDelete = canChangeAddress && pages.length > 1
  const actionClass = 'grid shrink-0 place-items-center rounded text-text-3 hover:text-text-0 focus-visible:outline focus-visible:outline-2 disabled:opacity-40'
  const pageToDelete = pages.find(page => page.id === deletingPage?.id && deletingPage.projectId === activeProjectId)
  const pageToEditPath = pages.find(page => page.id === editingPath?.id && editingPath.projectId === activeProjectId)
  const pageToEditSeo = pages.find(page => page.id === editingSeo?.id && editingSeo.projectId === activeProjectId)
  const linkedPages = pageToDelete ? pages.filter(page => page.id !== pageToDelete.id && page.blocks.some(block => {
    let matches = false
    visitBlockLinks(block, destination => {
      if (!/^\/(?!\/)/.test(destination)) return
      const path = pageLinkPath(destination)
      if (path === pageToDelete.path || path === encodeURI(pageToDelete.path)) matches = true
    })
    return matches
  })) : []

  async function handleExport() {
    setExporting(true)
    try {
      await requestDesktopAction('site.export', activeProjectId)
      if (useEditorStore.getState().activeProjectId !== activeProjectId) throw new Error('The active project changed. Export it again.')
      let filename = (activeProject?.name || config.name || 'site').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'site'
      if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(filename)) filename = `_${filename}`
      if (portableProjectsEnabled) {
        const media = activeProjectId ? await new ProjectMediaLibrary().list(activeProjectId) : []
        downloadHTML(await exportSiteZip(config, { settings: activeProject?.settings }, media), `${filename}.zip`)
      } else {
        downloadHTML(await exportToHTML(config, { settings: activeProject?.settings }), `${filename}.html`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
    {showAddPage && <AddPageDialog onAdd={addPage} onClose={() => setShowAddPage(false)} />}
    {showPlanPages && <PlanPages onClose={() => setShowPlanPages(false)} />}
    {showAiAssistant && <GeminiPageAssistant onClose={() => setShowAiAssistant(false)} />}
    {showSiteChecks && <SiteChecks onClose={() => setShowSiteChecks(false)} />}
    {pageToDelete && <DeletePageDialog page={pageToDelete} linkedPages={linkedPages} onCancel={() => setDeletingPage(null)} onConfirm={() => { removePage(pageToDelete.id); setDeletingPage(null) }} />}
    {pageToEditPath && <EditPagePathDialog page={pageToEditPath} config={config} onCancel={() => setEditingPath(null)} onSave={(name, path, updateLinks, includeChildPages) => { updatePageSettings(pageToEditPath.id, name, path, updateLinks, includeChildPages); setEditingPath(null) }} />}
    {pageToEditSeo && <EditPageSeoDialog page={pageToEditSeo} onCancel={() => setEditingSeo(null)} onSave={(title, description) => { updatePageSeo(pageToEditSeo.id, title, description); setEditingSeo(null) }} />}
    {portableProjectsEnabled && <div className="bg-bg-1 border-b border-border-default px-3 py-1"><div className="flex flex-wrap items-center justify-between gap-2"><EditorMenus /><ProjectFileCommands /></div></div>}
    <div className="studio-toolbar min-h-10 border-b border-border-default bg-bg-1 px-3 py-1">
      <div className="flex flex-wrap items-center gap-1">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-text-3 shrink-0">
          <span
            className="cursor-pointer hover:text-text-1 transition-colors"
            onClick={() => navigate('/')}
          >
            Projects
          </span>
          <span>/</span>
          <span className="text-text-0 font-medium max-w-[120px] truncate">{projectName}</span>
        </div>

        <div className="w-px h-5 bg-border-default mx-1.5 shrink-0" />

        {/* Page tabs */}
        <div role="group" aria-label="Pages" className="flex min-w-20 flex-1 items-center gap-0.5 overflow-x-auto">
          {pages.map((page) => (
            <PageTab
              key={page.id}
              page={page}
              isActive={activePageId === page.id}
              editing={page.id === renamingPage?.id && renamingPage.projectId === activeProjectId}
              onClick={() => setActivePage(page.id)}
              onEdit={() => setRenamingPage({ id: page.id, projectId: activeProjectId })}
              onSettings={() => { setActivePage(page.id); setEditingPath({ id: page.id, projectId: activeProjectId }) }}
              onRename={(name) => renamePage(page.id, name)}
              onCancel={() => setRenamingPage(null)}
            />
          ))}
        </div>
        <div role="group" aria-label="Page controls" className="ml-auto flex shrink-0 items-center gap-0.5 self-start">
          <button type="button" disabled={!selectedPage} aria-label={`Rename ${selectedName}`} title={`Rename ${selectedName}`}
            onClick={() => setRenamingPage(selectedTarget)} className={actionClass}><Pencil size={12} /></button>
          <button type="button" disabled={!selectedPage} aria-label={`Duplicate ${selectedName} page`} title={`Duplicate ${selectedName} page`}
            onClick={() => {
              if (!selectedPage) return
              try { duplicatePage(selectedPage.id); toast(selectedPage.webstudioArticle ? 'Page duplicated as a draft' : 'Page duplicated') }
              catch (error) { toast.error(error instanceof Error ? error.message : 'Page could not be duplicated') }
            }} className={actionClass}><Copy size={12} /></button>
          <button type="button" disabled={!selectedPage} aria-label={`Search details for ${selectedName}`} title={`Search details for ${selectedName}`}
            onClick={() => setEditingSeo(selectedTarget)} className={actionClass}><Search size={12} /></button>
          <button type="button" disabled={!selectedPage} aria-label={`Page settings for ${selectedName}`} title={`Page settings for ${selectedName}`}
            onClick={() => setEditingPath(selectedTarget)} className={actionClass}><Link size={12} /></button>
          <button type="button" disabled={!canDelete} aria-label={`Delete ${selectedName}`} title={canDelete ? `Delete ${selectedName}` : 'Home cannot be deleted'}
            onClick={() => setDeletingPage(selectedTarget)} className={`${actionClass} hover:text-status-red`}><Trash2 size={12} /></button>
          <button type="button" aria-haspopup="dialog" onClick={() => setShowAddPage(true)} className="ml-1 inline-flex shrink-0 items-center gap-1.5 rounded border border-border-default bg-bg-2 px-2.5 text-xs font-medium text-text-0 hover:bg-bg-3">
            <Plus size={14} aria-hidden="true" /> Add page
          </button>
        </div>
      </div>

      {/* Right side */}
      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1">
        {pages.length > 0 && <label className="flex shrink-0 items-center gap-1 text-xs text-text-1">
          Go to page
          <select aria-label="Go to page" value={selectedPage?.id ?? ''} onChange={event => setActivePage(event.target.value)} className="max-w-48 rounded border border-border-default bg-bg-2 px-1 py-1 text-text-0">
            {!selectedPage && <option value="" disabled>Choose a page</option>}
            {pages.map(page => <option key={page.id} value={page.id}>{page.name}</option>)}
          </select>
        </label>}
        {portableProjectsEnabled && <details className="studio-page-tools relative text-xs">
          <summary className="cursor-pointer rounded px-2 py-2">Page tools</summary>
          <div className="absolute top-full z-50 w-36 rounded border border-border-default bg-bg-1 p-1 shadow-xl">
            <button type="button" disabled={!selectedPage} onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); setEditingPath(selectedTarget) }} className="block w-full rounded px-2 py-1 text-left text-text-0 hover:bg-bg-3 disabled:opacity-50">Page settings</button>
            <button type="button" aria-haspopup="dialog" onClick={event => {
              const menu = event.currentTarget.closest('details')
              menu?.removeAttribute('open')
              menu?.querySelector('summary')?.focus()
              setShowAddPage(true)
            }} className="block w-full rounded px-2 py-1 text-left text-text-0 hover:bg-bg-3">Add page</button>
            <button type="button" onClick={() => setShowPlanPages(true)} className="block w-full rounded px-2 py-1 text-left text-text-1 hover:bg-bg-3">Plan pages</button>
            <button type="button" onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); setShowSiteChecks(true) }} className="block w-full rounded px-2 py-1 text-left text-text-1 hover:bg-bg-3">Check site</button>
          </div>
        </details>}
        <button type="button" aria-haspopup="dialog" className="rounded border border-blue-400 px-3 py-1 text-xs text-text-0 hover:bg-bg-3" onClick={() => setShowAiAssistant(true)}>AI assistant</button>
        <label className="text-xs text-text-1 flex items-center gap-1">
          Mode
          <select aria-label="Editor mode" value={mode} onChange={event => setMode(event.target.value as EditorMode)} className="rounded bg-bg-2 border border-border-default px-1 py-1 text-text-0">
            <option value="beginner">Beginner</option>
            <option value="designer">Designer</option>
            <option value="professional">Professional (JSON)</option>
          </select>
        </label>
        {/* Viewport toggle */}
        {viewports.map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            title={label}
            aria-label={label}
            aria-pressed={viewport === value && customViewportWidth === null}
            onClick={() => setViewport(value)}
            className={`w-7 h-7 rounded flex items-center justify-center text-xs transition-all ${
              viewport === value && customViewportWidth === null
                ? 'bg-bg-3 text-text-0'
                : 'text-text-3 hover:text-text-1 hover:bg-bg-3'
            }`}
          >
            <Icon size={14} />
          </button>
        ))}
        <label className="flex items-center gap-1 text-xs text-text-1" title="Adjust the simulated screen width">
          <span>Width</span>
          <input type="range" aria-label="Preview width" min={320} max={1920} step={1}
            value={customViewportWidth ?? (viewport === 'desktop' ? 1200 : viewport === 'tablet' ? 768 : 375)}
            onChange={event => setCustomViewportWidth(Number(event.target.value))} className="w-20" />
          <span className="w-12 tabular-nums">{customViewportWidth ?? (viewport === 'desktop' ? 1200 : viewport === 'tablet' ? 768 : 375)}px</span>
        </label>

        <div className="w-px h-5 bg-border-default mx-1" />

        {/* Undo/Redo */}
        <button
          onClick={() => {
            const label = undoStack[undoStack.length - 1]?.label
            undo()
            if (label) toast(`Undo: ${label}`, { duration: 1500 })
          }}
          disabled={!canUndo()}
          className="w-7 h-7 rounded flex items-center justify-center text-text-3 hover:text-text-1 hover:bg-bg-3 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <Undo2 size={14} />
        </button>
        <button
          onClick={() => {
            const label = redoStack[redoStack.length - 1]?.label
            redo()
            if (label) toast(`Redo: ${label}`, { duration: 1500 })
          }}
          disabled={!canRedo()}
          className="w-7 h-7 rounded flex items-center justify-center text-text-3 hover:text-text-1 hover:bg-bg-3 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
        >
          <Redo2 size={14} />
        </button>

        <div className="w-px h-5 bg-border-default mx-1" />

        {/* Preview toggle */}
        {!previewMode && <button type="button" aria-label={settingsOpen ? 'Settings window open' : 'Expand right panel'} aria-expanded={settingsOpen} aria-controls="editor-right-panel" onClick={onOpenSettings} className="h-7 rounded px-2 text-[11px] text-text-1 hover:bg-bg-3">Object properties</button>}
        <button
          onClick={togglePreview}
          className={`h-7 px-2 rounded flex items-center gap-1 text-[11px] transition-all ${
            previewMode ? 'bg-green-glow text-green' : 'text-text-3 hover:text-text-1 hover:bg-bg-3'
          }`}
          title="Preview (P)"
          aria-label="Toggle preview mode"
          aria-pressed={previewMode}
        >
          <Eye size={13} />
          <span>Preview</span>
        </button>

        {/* Shortcuts help */}
        <button
          onClick={toggleShortcutsModal}
          className="w-7 h-7 rounded flex items-center justify-center text-text-3 hover:text-text-1 hover:bg-bg-3 transition-all"
          title="Keyboard shortcuts (?)"
          aria-label="Show keyboard shortcuts"
        >
          <HelpCircle size={14} />
        </button>

        <div className="w-px h-5 bg-border-default mx-1" />

        <button
          onClick={handleExport}
          disabled={exporting}
          className="h-7 px-3 rounded-lg bg-green text-bg-0 text-[11.5px] font-semibold hover:bg-green/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {exporting ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              <span>Exporting...</span>
            </>
          ) : (
            <>
              <Download size={12} />
              <span>Export</span>
            </>
          )}
        </button>
      </div>
    </div>
    </>
  )
}
