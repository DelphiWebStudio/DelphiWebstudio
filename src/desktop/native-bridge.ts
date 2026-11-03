import type { DesktopCapability } from './bridge-protocol'

type NativeMessage = Record<string, unknown>
type NativeWebView = {
  postMessage(message: NativeMessage): void
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void
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
