import type { DesktopCapability } from './bridge-protocol'

type NativeMessage = Record<string, unknown>
type NativeWebView = {
  postMessage(message: NativeMessage): void
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void
}

export interface ExternalLinkCheckResult {
  url: string
  status: 'ok' | 'broken' | 'unverified' | 'blocked'
  httpStatus?: number
  message: string
}

/** User-requested, read-only website header checks in the Windows host. */
export function requestExternalLinkChecks(urls: string[]): Promise<ExternalLinkCheckResult[]> {
  const webview = (window as unknown as { chrome?: { webview?: NativeWebView } }).chrome?.webview
  if (window.location.origin !== 'https://webstudio.local' || !webview) return Promise.reject(new Error('External link checks require the Windows desktop application.'))
  if (!urls.length || urls.length > 20 || urls.some(url => typeof url !== 'string' || url.length > 2048)) return Promise.reject(new Error('Check between one and twenty website links at a time.'))
  const token = crypto.randomUUID()
  return new Promise((resolve, reject) => {
    function finish(error?: Error, results?: ExternalLinkCheckResult[]) {
      window.clearTimeout(timeout)
      webview!.removeEventListener('message', receive)
      if (error) reject(error)
      else resolve(results ?? [])
    }
    function receive(event: MessageEvent) {
      const reply = event.data as NativeMessage | null
      if (reply?.version !== 1 || reply.kind !== 'site.links.result' || reply.token !== token) return
      if (reply.ok !== true || !Array.isArray(reply.results) || reply.results.length !== urls.length || reply.results.some((value, index) => !value || typeof value !== 'object' || value.url !== urls[index] || !['ok', 'broken', 'unverified', 'blocked'].includes(value.status) || typeof value.message !== 'string' || (value.httpStatus !== undefined && (!Number.isInteger(value.httpStatus) || value.httpStatus < 100 || value.httpStatus > 599)))) {
        finish(new Error(typeof reply.message === 'string' ? reply.message : 'The external link check returned an invalid result.'))
        return
      }
      finish(undefined, reply.results as ExternalLinkCheckResult[])
    }
    const timeout = window.setTimeout(() => finish(new Error('The external link check timed out. Check these links in your browser.')), 120000)
    webview.addEventListener('message', receive)
    try { webview.postMessage({ version: 1, kind: 'site.links.check', token, urls }) }
    catch { finish(new Error('The external link check could not start.')) }
  })
}

export interface LocalWebsiteResult {
  folder: string
  backup?: string
  cancelled?: boolean
  message?: string
}

/** Folder selection and refresh stay local to this Windows profile. */
export function requestLocalWebsite(action: 'get' | 'choose' | 'prepare' | 'open', projectId: string, download?: (token: string) => void): Promise<LocalWebsiteResult> {
  const webview = (window as unknown as { chrome?: { webview?: NativeWebView } }).chrome?.webview
  if (window.location.origin !== 'https://webstudio.local' || !webview) return Promise.reject(new Error('Local test folders require the Windows desktop application.'))
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(projectId)) return Promise.reject(new Error('Open a project first.'))
  const token = crypto.randomUUID()
  return new Promise((resolve, reject) => {
    let settled = false
    let downloadStarted = false
    function finish(error?: Error, result?: LocalWebsiteResult) {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      webview!.removeEventListener('message', receive)
      if (error && action === 'prepare') {
        try { webview!.postMessage({ version: 1, kind: 'site.local.cancel', token, projectId }) }
        catch { /* A closed host has no remaining preparation to release. */ }
      }
      if (error) reject(error)
      else resolve(result ?? { folder: '' })
    }
    function receive(event: MessageEvent) {
      const reply = event.data as NativeMessage | null
      if (reply?.version !== 1 || reply.token !== token) return
      if (reply.kind === 'site.local.ready' && action === 'prepare') {
        if (downloadStarted) return
        downloadStarted = true
        try { if (!download) throw new Error('Review the website files before refreshing.'); download(token) }
        catch (error) { finish(error instanceof Error ? error : new Error('The website ZIP could not be prepared.')) }
        return
      }
      if (reply.kind !== 'site.local.result') return
      if (reply.cancelled === true) { finish(undefined, { folder: typeof reply.folder === 'string' ? reply.folder : '', cancelled: true }); return }
      if (reply.ok !== true || typeof reply.folder !== 'string') { finish(new Error(typeof reply.message === 'string' ? reply.message : 'The local website operation failed.')); return }
      finish(undefined, { folder: reply.folder, backup: typeof reply.backup === 'string' ? reply.backup : undefined, message: typeof reply.message === 'string' ? reply.message : undefined })
    }
    const timeout = window.setTimeout(() => finish(new Error('The local website operation timed out. Review the folder and try again.')), action === 'choose' || action === 'prepare' ? 600000 : 15000)
    webview.addEventListener('message', receive)
    try { webview.postMessage({ version: 1, kind: `site.local.${action}`, token, projectId }) }
    catch { finish(new Error('The local website operation could not start.')) }
  })
}

export async function chooseWindowsColor(color: string): Promise<string | null> {
  const webview = (window as unknown as { chrome?: { webview?: NativeWebView } }).chrome?.webview
  if (window.location.origin !== 'https://webstudio.local' || !webview || !/^#[0-9a-f]{6}$/i.test(color)) throw new Error('The Windows color dialog is unavailable.')
  const requestId = crypto.randomUUID()
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => { webview.removeEventListener('message', receive); reject(new Error('The Windows color dialog did not respond.')) }, 600000)
    function receive(event: MessageEvent) {
      const reply = event.data as NativeMessage | null
      if (!reply || reply.version !== 1 || reply.kind !== 'ui.color' || reply.requestId !== requestId) return
      window.clearTimeout(timer); webview!.removeEventListener('message', receive)
      if (reply.accepted === false) resolve(null)
      else if (reply.accepted === true && typeof reply.color === 'string' && /^#[0-9a-f]{6}$/i.test(reply.color)) resolve(reply.color)
      else reject(new Error('The Windows color dialog returned invalid values.'))
    }
    webview.addEventListener('message', receive)
    try { webview.postMessage({ version: 1, kind: 'ui.color', requestId, color }) }
    catch { window.clearTimeout(timer); webview.removeEventListener('message', receive); reject(new Error('The Windows color dialog could not be opened.')) }
  })
}

export async function chooseWindowsFont(font: { font: string; size: number; color: string; bold: boolean; italic: boolean; underline: boolean }): Promise<typeof font | null> {
  const webview = (window as unknown as { chrome?: { webview?: NativeWebView } }).chrome?.webview
  if (window.location.origin !== 'https://webstudio.local' || !webview) throw new Error('The Windows font dialog is unavailable.')
  const requestId = crypto.randomUUID()
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => { webview.removeEventListener('message', receive); reject(new Error('The Windows font dialog did not respond.')) }, 600000)
    function receive(event: MessageEvent) {
      const reply = event.data as NativeMessage | null
      if (!reply || reply.version !== 1 || reply.kind !== 'ui.font' || reply.requestId !== requestId) return
      window.clearTimeout(timer)
      webview!.removeEventListener('message', receive)
      if (reply.accepted === false) { resolve(null); return }
      if (reply.accepted !== true || typeof reply.font !== 'string' || !/^[\p{L}\p{N} ,._-]{1,100}$/u.test(reply.font) || typeof reply.size !== 'number' || reply.size < 6 || reply.size > 200 || typeof reply.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(reply.color) || typeof reply.bold !== 'boolean' || typeof reply.italic !== 'boolean' || typeof reply.underline !== 'boolean') { reject(new Error('The Windows font dialog returned invalid values.')); return }
      resolve({ font: reply.font, size: reply.size, color: reply.color, bold: reply.bold, italic: reply.italic, underline: reply.underline })
    }
    webview.addEventListener('message', receive)
    try { webview.postMessage({ version: 1, kind: 'ui.font', requestId, ...font }) }
    catch { window.clearTimeout(timer); webview.removeEventListener('message', receive); reject(new Error('The Windows font dialog could not be opened.')) }
  })
}

/** Store the Google key in the current Windows user's Credential Manager. */
export async function requestGeminiCredential(action: 'read' | 'write' | 'delete', key?: string): Promise<string | null> {
  if (typeof window === 'undefined' || window.location.origin !== 'https://webstudio.local') {
    if (action === 'read') return null
    throw new Error('Saving the Google key requires the Windows desktop application.')
  }
  const webview = (window as unknown as { chrome?: { webview?: NativeWebView } }).chrome?.webview
  if (!webview) throw new Error('The desktop credential service is unavailable.')
  const requestId = crypto.randomUUID()
  const kind = `gemini.${action}`
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => { webview.removeEventListener('message', receive); reject(new Error('The credential request timed out.')) }, 5000)
    function receive(event: MessageEvent) {
      const reply = event.data as NativeMessage | null
      if (!reply || typeof reply !== 'object' || reply.version !== 1 || reply.kind !== kind || reply.requestId !== requestId) return
      window.clearTimeout(timer)
      webview!.removeEventListener('message', receive)
      if (reply.ok !== true || (action === 'read' && typeof reply.key !== 'string')) reject(new Error('Windows Credential Manager could not complete the request.'))
      else resolve(action === 'read' ? reply.key as string : null)
    }
    webview.addEventListener('message', receive)
    try { webview.postMessage(action === 'write' ? { version: 1, kind, requestId, key } : { version: 1, kind, requestId }) }
    catch { window.clearTimeout(timer); webview.removeEventListener('message', receive); reject(new Error('The credential request could not be sent.')) }
  })
}

/** Authorizes an existing local flow; no file paths or content cross this bridge. */
export async function requestDesktopAction(capability: DesktopCapability, projectId: string | null): Promise<void> {
  if (window.location.hostname !== 'webstudio.local') return
  if ((projectId === null && capability !== 'project.open') || (projectId !== null && !/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(projectId))) throw new Error('Open a project before continuing.')
  const webview = (window as unknown as { chrome?: { webview?: NativeWebView } }).chrome?.webview
  if (!webview) throw new Error('The desktop bridge is unavailable.')

  function exchange(message: NativeMessage): Promise<NativeMessage> {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => { webview!.removeEventListener('message', receive); reject(new Error('The desktop request timed out.')) }, 5000)
      function receive(event: MessageEvent) {
        const data: unknown = event.data
        if (!data || typeof data !== 'object' || Array.isArray(data)) return
        const reply = data as NativeMessage
        if (reply.version !== 1 || reply.requestId !== message.requestId) return
        window.clearTimeout(timer)
        webview!.removeEventListener('message', receive)
        resolve(reply)
      }
      webview!.addEventListener('message', receive)
      try { webview!.postMessage(message) } catch {
        window.clearTimeout(timer)
        webview!.removeEventListener('message', receive)
        reject(new Error('The desktop request could not be sent.'))
      }
    })
  }

  const opened = await exchange({ version: 1, kind: 'session.open', requestId: crypto.randomUUID(), projectId, capability })
  if (opened.kind !== 'session.open' || opened.projectId !== projectId || opened.capability !== capability || typeof opened.sessionId !== 'string' || !/^[0-9a-f]{64}$/.test(opened.sessionId)) throw new Error('The desktop session was rejected.')
  const reply = await exchange({ version: 1, requestId: crypto.randomUUID(), sessionId: opened.sessionId, projectId, capability })
  if (reply.capability !== capability || reply.ok !== true) throw new Error('The desktop request was rejected.')
}
