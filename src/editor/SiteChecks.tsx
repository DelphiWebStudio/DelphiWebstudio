import { useEffect, useMemo, useRef, useState } from 'react'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'
import { checkSite, checkSiteReadability, siteExternalLinks, type SiteIssue } from '@/project/site-checks'
import { validateProjectMedia } from '@/project/project-file'
import { ProjectMediaLibrary, type MediaAsset } from '@/media/media-library'
import { useProjectsStore } from '@/store/projectsStore'
import { requestExternalLinkChecks, type ExternalLinkCheckResult } from '@/desktop/native-bridge'

export function SiteChecks({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const config = useConfigStore(state => state.config)
  const projectId = useEditorStore(state => state.activeProjectId)
  const settings = useProjectsStore(state => state.projects.find(project => project.id === projectId)?.settings)
  const mediaBusy = useEditorStore(state => state.mediaImporting)
  const revision = useProjectsStore(state => state.projects.find(project => project.id === projectId)?.mediaRevision ?? 0)
  const [media, setMedia] = useState<{ projectId: string; revision: number; assets?: MediaAsset[]; error?: string } | null>(null)
  const [external, setExternal] = useState<{ signature: string; results: ExternalLinkCheckResult[]; checked: number; running: boolean; error?: string } | null>(null)
  const requestGeneration = useRef(0)
  const signature = JSON.stringify({ projectId, config })
  const windowsEdition = window.location.origin === 'https://webstudio.local'
  const links = useMemo(() => { try { return siteExternalLinks(config) } catch { return [] } }, [config])
  const currentExternal = external?.signature === signature ? external : null
  const { issues, error } = useMemo((): { issues: SiteIssue[]; error: string } => {
    try { return { issues: [...checkSite(config, settings ?? {}, true), ...checkSiteReadability(config)], error: '' } }
    catch (cause) { return { issues: [], error: cause instanceof Error ? cause.message : 'The site could not be checked.' } }
  }, [config, settings])
  const mediaReady = !mediaBusy && !!projectId && media?.projectId === projectId && media.revision === revision
  let mediaError = mediaReady ? media?.error ?? '' : ''
  if (!error && mediaReady && media?.assets) {
    try { validateProjectMedia(config, media.assets) } catch (cause) { mediaError = cause instanceof Error ? cause.message : 'Project media could not be checked.' }
  }

  useEffect(() => {
    if (!projectId || mediaBusy) return
    let active = true
    const library = new ProjectMediaLibrary()
    library.list(projectId).then(assets => {
      if (active) setMedia({ projectId, revision, assets })
    }).catch(() => { if (active) setMedia({ projectId, revision, error: 'Project media could not be read.' }) }).finally(() => library.close())
    return () => { active = false }
  }, [projectId, revision, mediaBusy])

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => { if (element?.open) element.close() }
  }, [])

  useEffect(() => () => { requestGeneration.current++ }, [signature])

  function openFinding(issue: Pick<SiteIssue, 'pageId' | 'blockId' | 'section' | 'objectId'>) {
    useConfigStore.getState().setActivePage(issue.pageId)
    const editor = useEditorStore.getState()
    editor.selectBlock(issue.blockId || null)
    if (issue.section) editor.selectSection(issue.section)
    if (issue.section && issue.objectId) editor.selectSectionObject({ blockId: issue.blockId, section: issue.section, id: issue.objectId })
    onClose()
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (useConfigStore.getState().activePageId !== issue.pageId) return
      const block = issue.blockId ? document.querySelector<HTMLElement>(`[data-webstudio-block-id="${CSS.escape(issue.blockId)}"]`) : null
      const object = issue.objectId ? block?.querySelector<HTMLElement>(`[data-section-object="${CSS.escape(issue.objectId)}"]`) : null
      const target = object ?? block ?? document.querySelector<HTMLElement>('[data-webstudio-block-id]')
      target?.scrollIntoView({ block: issue.blockId ? 'center' : 'start', behavior: 'instant' })
      if (target && !target.hasAttribute('tabindex')) {
        target.tabIndex = -1
        target.addEventListener('blur', () => { if (target.getAttribute('tabindex') === '-1') target.removeAttribute('tabindex') }, { once: true })
      }
      target?.focus({ preventScroll: true })
    }))
  }

  async function checkExternalLinks() {
    if (!windowsEdition || currentExternal?.running || !links.length) return
    const generation = ++requestGeneration.current
    const currentSignature = signature
    const results: ExternalLinkCheckResult[] = []
    setExternal({ signature: currentSignature, results, checked: 0, running: true })
    try {
      for (let offset = 0; offset < links.length; offset += 20) {
        const batch = links.slice(offset, offset + 20).map(link => link.url)
        const received = await requestExternalLinkChecks(batch)
        if (requestGeneration.current !== generation) return
        for (const url of batch) results.push(received.find(result => result.url === url) ?? { url, status: 'unverified', message: 'The destination returned no check result.' })
        setExternal({ signature: currentSignature, results: [...results], checked: offset + batch.length, running: offset + batch.length < links.length })
      }
    } catch (cause) {
      if (requestGeneration.current === generation) setExternal({ signature: currentSignature, results: [...results], checked: results.length, running: false, error: cause instanceof Error ? cause.message : 'External destinations could not be checked.' })
    }
  }

  return (
    <dialog ref={dialog} onCancel={event => { event.preventDefault(); onClose() }} aria-labelledby="site-checks-title" className="w-[min(94vw,48rem)] max-h-[88vh] overflow-y-auto rounded-xl border border-border-default bg-bg-1 p-5 text-text-0 shadow-xl backdrop:bg-black/60">
      <h2 id="site-checks-title" className="text-lg font-semibold">Check site</h2>
      <p className="mt-2 text-sm text-text-2">Review page titles, headings, media, image descriptions, project links, anchors and form configuration. Findings open the affected page or object so you can make the correction.</p>
      <p className="mt-2 text-xs text-text-2">Contrast checks cover explicit solid text/background colors. Inherited styles, photos, gradients, rich-text overrides and custom code need a visual check; the report is not an accessibility certification.</p>
      {!mediaReady && <p role="status" className="mt-3 text-sm">Checking project media…</p>}
      {mediaError && <p role="alert" className="mt-3 text-sm text-status-red">{mediaError}</p>}
      <h3 className="mt-5 font-semibold">Local findings{!error ? ` (${issues.length})` : ''}</h3>
      {error ? <p role="alert" className="mt-4 text-sm text-status-red">{error}</p> : issues.length ? <ul className="mt-3 space-y-2" aria-label="Local findings">
        {issues.map((issue, index) => <li key={`${issue.pageId}-${issue.blockId}-${index}`} className="rounded border border-border-default bg-bg-2 p-3 text-sm">
          <p><strong>{issue.pageName}:</strong> {issue.message}</p>
          <button type="button" className="mt-2 text-green underline" onClick={() => openFinding(issue)}>{issue.objectId ? 'Open this object' : issue.blockId ? 'Open this block' : 'Open this page'}</button>
        </li>)}
      </ul> : mediaReady && !mediaError ? <p className="mt-4 text-sm">No issues found in these checks.</p> : null}
      <section className="mt-5 border-t border-border-default pt-4" aria-labelledby="external-checks-title">
        <h3 id="external-checks-title" className="font-semibold">External link status</h3>
        <p className="mt-2 text-sm text-text-2">{links.length} distinct web {links.length === 1 ? 'address' : 'addresses'} in editor-managed links. Checking contacts those destinations without signing in or sending a form. Page fragments and custom-code links are not checked.</p>
        {!windowsEdition && <p className="mt-2 text-sm">External status checks require the Windows desktop edition. Browser restrictions can hide a valid response, so no destination is marked broken from a browser error.</p>}
        <button type="button" className="mt-3 rounded border border-border-default px-3 py-2 text-sm disabled:opacity-50" disabled={!windowsEdition || !links.length || currentExternal?.running || !!error} onClick={() => { void checkExternalLinks() }}>{currentExternal?.running ? 'Checking external links…' : 'Check external links'}</button>
        {currentExternal && <p role="status" className="mt-2 text-sm">Checked {currentExternal.checked} of {links.length}. Reachable: {currentExternal.results.filter(result => result.status === 'ok').length}; broken: {currentExternal.results.filter(result => result.status === 'broken').length}; unverified or blocked: {currentExternal.results.filter(result => result.status === 'unverified' || result.status === 'blocked').length}.</p>}
        {currentExternal?.error && <p role="alert" className="mt-2 text-sm text-status-red">{currentExternal.error} Completed results remain below; you can run the check again.</p>}
        {!!currentExternal?.results.length && <ul className="mt-3 space-y-2" aria-label="External link results">{currentExternal.results.map(result => {
          const locations = links.find(link => link.url === result.url)?.locations ?? []
          const label = ({ ok: 'Reachable', broken: 'Broken', unverified: 'Unverified', blocked: 'Blocked from checking' })[result.status]
          return <li key={result.url} className="rounded border border-border-default bg-bg-2 p-3 text-sm"><details open={result.status !== 'ok'}>
            <summary className="cursor-pointer break-all"><strong>{label}{result.httpStatus ? ` (HTTP ${result.httpStatus})` : ''}:</strong> {result.url}</summary>
            <p className="mt-2">{result.message}</p>
            <ul className="mt-2 space-y-1">{locations.map((location, index) => <li key={`${location.pageId}-${location.blockId}-${index}`}><button type="button" className="text-green underline" onClick={() => openFinding(location)}>Open {location.pageName}: {location.label}</button></li>)}</ul>
          </details></li>
        })}</ul>}
        <p className="mt-2 text-xs text-text-2">A 404 or 410 response is reported as broken. Sign-in requirements, rate limits, network failures and restricted addresses remain unverified or blocked. A reachable response does not prove that the page content is correct.</p>
      </section>
      <details className="mt-5 border-t border-border-default pt-4">
        <summary className="cursor-pointer font-semibold">Keyboard and form review</summary>
        <p className="mt-2 text-sm">Open the reviewed website from Export or the local test folder. Check the actual exported pages using the keyboard; no form needs to be submitted.</p>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
          <li>Press Tab and Shift+Tab through links, menus and form fields. Confirm that the focused item is visible and the order follows the page.</li>
          <li>Open dropdowns and popups with the keyboard. Check Enter or Space where appropriate, Escape to close, and return of focus to the opening control.</li>
          <li>Visit each form field. Confirm it has a clear label and that required fields and instructions make sense. Stop before sending or submitting anything.</li>
          <li>Review desktop, tablet and phone widths, including enlarged text. Look for clipped text, overlapping controls, weak contrast over photographs and content that needs sideways scrolling.</li>
        </ol>
      </details>
      <div className="mt-5 flex justify-end"><button type="button" onClick={onClose} className="rounded border border-border-default px-3 py-2 text-sm">Close</button></div>
    </dialog>
  )
}
