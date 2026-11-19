import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestLocalWebsite } from '../src/desktop/native-bridge'

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

function desktop() {
  const messages: Record<string, unknown>[] = []
  const listeners = new Set<(event: MessageEvent) => void>()
  const webview = {
    addEventListener: (_: string, listener: (event: MessageEvent) => void) => { listeners.add(listener) },
    removeEventListener: (_: string, listener: (event: MessageEvent) => void) => { listeners.delete(listener) },
    postMessage: (message: Record<string, unknown>) => { messages.push(message) },
  }
  vi.stubGlobal('window', { location: { origin: 'https://webstudio.local' }, setTimeout, clearTimeout, chrome: { webview } })
  const reply = (data: Record<string, unknown>) => { for (const listener of [...listeners]) listener({ data } as MessageEvent) }
  return { messages, listeners, reply }
}

describe('local website folder bridge', () => {
  it('requires the Windows host without sending file paths from the browser', async () => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost' } })
    await expect(requestLocalWebsite('choose', 'project-1')).rejects.toThrow('Windows desktop')
  })

  it('sends only project identity and a token, and ignores another request’s result', async () => {
    const bridge = desktop()
    const pending = requestLocalWebsite('get', 'project-1')
    expect(Object.keys(bridge.messages[0]).sort()).toEqual(['kind', 'projectId', 'token', 'version'])
    bridge.reply({ version: 1, kind: 'site.local.result', token: 'wrong', ok: true, folder: 'wrong-folder' })
    expect(bridge.listeners.size).toBe(1)
    bridge.reply({ version: 1, kind: 'site.local.result', token: bridge.messages[0].token, ok: true, folder: 'Chosen local folder' })
    await expect(pending).resolves.toMatchObject({ folder: 'Chosen local folder' })
    expect(bridge.listeners.size).toBe(0)
  })

  it('releases only its own preparation when creating the website download fails', async () => {
    const bridge = desktop()
    const pending = requestLocalWebsite('prepare', 'project-1', () => { throw new Error('Download failed') })
    const rejected = expect(pending).rejects.toThrow('Download failed')
    bridge.reply({ version: 1, kind: 'site.local.ready', token: bridge.messages[0].token })
    await rejected
    expect(bridge.messages[1]).toEqual({ ...bridge.messages[0], kind: 'site.local.cancel' })
    expect(bridge.listeners.size).toBe(0)
  })

  it('releases an expired preparation instead of leaving the native host armed', async () => {
    vi.useFakeTimers()
    const bridge = desktop()
    const pending = requestLocalWebsite('prepare', 'project-1', () => undefined)
    const rejected = expect(pending).rejects.toThrow('timed out')
    await vi.advanceTimersByTimeAsync(600000)
    await rejected
    expect(bridge.messages[1]).toEqual({ ...bridge.messages[0], kind: 'site.local.cancel' })
    expect(bridge.listeners.size).toBe(0)
  })

  it('does not cancel other native operations when a short folder query times out', async () => {
    vi.useFakeTimers()
    const bridge = desktop()
    const pending = requestLocalWebsite('get', 'project-1')
    const rejected = expect(pending).rejects.toThrow('timed out')
    await vi.advanceTimersByTimeAsync(15000)
    await rejected
    expect(bridge.messages).toHaveLength(1)
  })

  it('downloads once and accepts the completed refresh without sending cancellation', async () => {
    const bridge = desktop()
    const download = vi.fn()
    const pending = requestLocalWebsite('prepare', 'project-1', download)
    const token = bridge.messages[0].token
    bridge.reply({ version: 1, kind: 'site.local.ready', token })
    bridge.reply({ version: 1, kind: 'site.local.ready', token })
    expect(download).toHaveBeenCalledTimes(1)
    bridge.reply({ version: 1, kind: 'site.local.result', token, ok: true, folder: 'Local site', backup: 'Pre-refresh ZIP' })
    await expect(pending).resolves.toMatchObject({ folder: 'Local site', backup: 'Pre-refresh ZIP' })
    expect(bridge.messages).toHaveLength(1)
  })

  it('honors a user’s native No without attempting another operation', async () => {
    const bridge = desktop()
    const pending = requestLocalWebsite('prepare', 'project-1', () => undefined)
    bridge.reply({ version: 1, kind: 'site.local.result', token: bridge.messages[0].token, ok: false, cancelled: true, folder: 'Local site' })
    await expect(pending).resolves.toMatchObject({ cancelled: true, folder: 'Local site' })
    expect(bridge.messages).toHaveLength(1)
  })
})
