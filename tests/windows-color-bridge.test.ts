import { afterEach, describe, expect, it, vi } from 'vitest'
import { chooseWindowsColor } from '../src/desktop/native-bridge'

afterEach(() => vi.unstubAllGlobals())

describe('Windows color dialog bridge', () => {
  it('matches replies to the request and returns the selected color', async () => {
    let receive: ((event: MessageEvent) => void) | undefined
    let request: Record<string, unknown> | undefined
    const webview = {
      postMessage: (message: Record<string, unknown>) => { request = message },
      addEventListener: (_type: string, listener: (event: MessageEvent) => void) => { receive = listener },
      removeEventListener: () => { receive = undefined },
    }
    vi.stubGlobal('window', { location: { origin: 'https://webstudio.local' }, chrome: { webview }, setTimeout, clearTimeout })
    const result = chooseWindowsColor('#123456')
    expect(request).toMatchObject({ version: 1, kind: 'ui.color', color: '#123456' })
    receive!({ data: { version: 1, kind: 'ui.color', requestId: 'other', accepted: true, color: '#ffffff' } } as MessageEvent)
    expect(receive).toBeDefined()
    receive!({ data: { version: 1, kind: 'ui.color', requestId: request!.requestId, accepted: true, color: '#abcdef' } } as MessageEvent)
    await expect(result).resolves.toBe('#abcdef')
    expect(receive).toBeUndefined()
  })
})
