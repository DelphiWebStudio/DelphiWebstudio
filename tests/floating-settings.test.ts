import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RightSidebar } from '../src/editor/RightSidebar'
import { BlockWrapper } from '../src/blocks/BlockWrapper'
import { DividerBlock } from '../src/blocks/divider/DividerBlock'

describe('floating settings and blank strips', () => {
  it('provides a floating, closable settings window and site design access', () => {
    const html = renderToStaticMarkup(createElement(RightSidebar, { collapsed: false }))
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-label="Close settings"')
    expect(html).toContain('Site design')
    expect(html).toContain('class="fixed ')
    expect(html).toContain('Drag to move the settings window')
  })
  it('provides a selectable strip with resize handles and a section drop area', () => {
    const block = { id: 'strip-test', type: 'divider' as const, variant: 'space', props: { height: 60 } }
    const html = renderToStaticMarkup(createElement(BlockWrapper, { block, isSelected: true, onSelect: () => {} }, createElement(DividerBlock, { block })))
    expect(html).toContain('Resize divider s')
    expect(html).toContain('data-editor-section="1"')
    expect(html).toContain('data-section-object-area="1"')
    expect(html).toContain('>Strip</span>')
  })
})
