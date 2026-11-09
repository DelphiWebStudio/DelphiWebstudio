import { useEffect, useRef, useState } from 'react'
import { ProjectMediaLibrary } from '@/media/media-library'
import { projectDraftReadFailed, useProjectsStore } from '@/store/projectsStore'
import { useEditorStore } from '@/store/editorStore'
import { ProjectRevisions } from './project-revisions'

function sizeLabel(bytes: number): string {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KiB` : `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
}

export function LocalStorageDialog({ onClose, recentlyRemoved }: {
  onClose: () => void
  recentlyRemoved: (projectId: string) => boolean
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const projects = useProjectsStore(state => state.projects)
  const mediaBusy = useEditorStore(state => state.mediaImporting)
  const [inventory, setInventory] = useState<Awaited<ReturnType<typeof readInventory>> | null>(null)
  const [confirm, setConfirm] = useState<{ projectId: string; revisionId?: string } | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  async function readInventory() {
    const [media, revisions] = await Promise.all([new ProjectMediaLibrary().storageUsage(), new ProjectRevisions().list()])
    return { media, revisions }
  }

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    let active = true
    void readInventory().then(result => { if (active) setInventory(result) }).catch(() => { if (active) setError('Local storage could not be read.') })
    return () => { active = false; if (element?.open) element.close() }
  }, [])

  async function removeSelected() {
    if (!confirm || mediaBusy || working) return
    const { projectId, revisionId } = confirm
    setWorking(true)
    setError('')
    try {
      if (revisionId) await new ProjectRevisions().remove(projectId, revisionId)
      else await new ProjectMediaLibrary().removeProjectMedia(projectId, () => {
        if (projectDraftReadFailed || useEditorStore.getState().mediaImporting || recentlyRemoved(projectId) ||
          useProjectsStore.getState().projects.some(project => project.id === projectId)) return false
        try {
          const storageName = useProjectsStore.persist.getOptions().name
          if (!storageName) return false
          const raw = localStorage.getItem(storageName)
          if (!raw) return true
          const drafts: unknown = JSON.parse(raw)?.state?.projects
          return Array.isArray(drafts) && !drafts.some(project => project?.id === projectId)
        } catch { return false }
      })
      setConfirm(null)
      setInventory(await readInventory())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Local storage could not be updated.')
    } finally { setWorking(false) }
  }

  const projectIds = inventory ? new Set([...inventory.media.keys(), ...inventory.revisions.map(revision => revision.projectId)]) : new Set<string>()

  return <dialog ref={dialog} onCancel={event => { event.preventDefault(); if (!working) onClose() }} aria-labelledby="local-storage-title" className="m-auto max-h-[85vh] w-[min(92vw,44rem)] overflow-auto rounded-xl border border-border-default bg-bg-1 p-5 text-text-0 shadow-xl backdrop:bg-black/60">
    <header className="flex items-center justify-between gap-3">
      <h2 id="local-storage-title" className="text-lg font-semibold">Local Storage</h2>
      <button autoFocus type="button" disabled={working} onClick={onClose} className="rounded border border-border-default px-3 py-1">Close</button>
    </header>
    <p className="mt-2 text-sm text-text-2">Shows media and revisions held by this editor profile. Saved project files and backups are separate.</p>
    {error && <p role="alert" className="mt-3 text-sm text-status-red">{error}</p>}
    {!inventory && !error && <p role="status" className="mt-3">Reading local storage…</p>}
    {inventory && projectIds.size === 0 && <p className="mt-3">No local media or revisions are stored.</p>}
    {confirm && <section className="mt-4 rounded border border-status-red p-3">
      <p>{confirm.revisionId ? 'Permanently remove this local revision?' : 'Permanently remove media left by this removed draft?'}</p>
      <button type="button" disabled={working || mediaBusy} onClick={() => void removeSelected()} className="mr-3 mt-2 rounded border border-border-default px-3 py-1">{working ? 'Removing…' : 'Remove permanently'}</button>
      <button type="button" disabled={working} onClick={() => setConfirm(null)} className="mt-2 px-2 py-1">Cancel</button>
    </section>}
    {[...projectIds].map(id => {
      const project = projects.find(item => item.id === id)
      const media = inventory?.media.get(id)
      const revisions = inventory?.revisions.filter(item => item.projectId === id) ?? []
      return <section key={id} className="mt-4 rounded border border-border-default p-3">
        <h3 className="break-all font-semibold">{project?.name || `Removed draft · ${id}`}</h3>
        <p className="mt-1 text-sm text-text-2">{media?.count ?? 0} media files · {sizeLabel(media?.bytes ?? 0)} | {revisions.length} revisions · {sizeLabel(revisions.reduce((total, revision) => total + revision.contents.size, 0))}</p>
        {!project && !!media?.count && <button type="button" disabled={working || mediaBusy || projectDraftReadFailed} onClick={() => {
          if (recentlyRemoved(id)) { setError('Wait for the dashboard’s Undo notice to expire, then try again.'); return }
          setError(''); setConfirm({ projectId: id })
        }} className="mt-2 rounded border border-border-default px-2 py-1 text-sm">Remove leftover media…</button>}
        {revisions.length > 0 && <details className="mt-2">
          <summary className="cursor-pointer text-sm">Review revisions</summary>
          <ul className="mt-1 space-y-1 text-sm">{revisions.map(revision => <li key={revision.id} className="flex flex-wrap items-center justify-between gap-2">
            <span className="break-all">{revision.filename} · {new Date(revision.createdAt).toLocaleString()} · {sizeLabel(revision.contents.size)}</span>
            <button type="button" disabled={working || mediaBusy} onClick={() => { setError(''); setConfirm({ projectId: id, revisionId: revision.id }) }} className="rounded border border-border-default px-2 py-1">Remove revision…</button>
          </li>)}</ul>
        </details>}
      </section>
    })}
  </dialog>
}
