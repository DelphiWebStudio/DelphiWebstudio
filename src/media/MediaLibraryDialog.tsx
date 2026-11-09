import { useEffect, useRef, useState } from 'react'
import type { MediaAsset } from './media-library'
import { MediaPanel } from './MediaPanel'
import { useEditorStore } from '@/store/editorStore'

export function MediaLibraryDialog() {
  const [open, setOpen] = useState(false)
  const [request, setRequest] = useState<{ manage?: boolean; accept?: string; onSelect?: (asset: MediaAsset) => void }>({})
  const dialog = useRef<HTMLDialogElement>(null)
  const [lastFolders, setLastFolders] = useState<Record<string, string | null>>({})
  const projectId = useEditorStore(state => state.activeProjectId)
  useEffect(() => {
    const show = (event: Event) => { if (useEditorStore.getState().activeProjectId) { setRequest((event as CustomEvent).detail || {}); setOpen(true) } }
    window.addEventListener('webstudio.media', show)
    return () => window.removeEventListener('webstudio.media', show)
  }, [])
  useEffect(() => {
    const element = dialog.current
    if (open) element?.showModal()
    return () => { if (element?.open) element.close() }
  }, [open, projectId])
  if (!open || !projectId) return null
  return <dialog ref={dialog} aria-labelledby="media-library-title" onCancel={event => { event.preventDefault(); setOpen(false) }} className="studio-media-library rounded-xl border border-slate-500 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-black/40">
    <header className="flex shrink-0 items-center justify-between border-b border-slate-300 px-5 py-3"><div><h2 id="media-library-title" className="text-lg font-semibold">{request.manage ? 'Manage Media' : 'Project media library'}</h2><p className="text-sm text-slate-600">{request.manage ? 'Create folders and organize project files.' : request.onSelect ? 'Find a file for this property, then choose Choose file.' : 'Find a file, then choose Add to page.'}</p></div><button autoFocus type="button" aria-label="Close media library" className="rounded border border-slate-400 px-3 py-1" onClick={() => setOpen(false)}>Close</button></header>
    <MediaPanel key={`${projectId}-${Boolean(request.manage)}`} picker manage={request.manage} accept={request.accept}
      initialFolder={lastFolders[projectId] ?? null} onFolderChange={folder => setLastFolders(previous => ({ ...previous, [projectId]: folder }))}
      onSelect={request.onSelect} onAdded={() => setOpen(false)} />
  </dialog>
}
