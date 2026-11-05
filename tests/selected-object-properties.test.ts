import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { PropertiesPanel } from '../src/editor/PropertiesPanel'
import { useEditorStore } from '../src/store/editorStore'

describe('selected object properties', () => {
  afterEach(() => { useEditorStore.getInitialState().selectedSectionObject = null })

  it('shows only the selected item and retains its original position precision', () => {
    const block = { id: 'test-block', type: 'content' as const, variant: 'prose', props: { section2Objects: [
      { id: 'first', type: 'text', text: 'First item', x: 5, y: 4, width: 30, height: 80, layer: 1 },
      { id: 'second', type: 'panel', text: 'Selected panel', color: '#dadada', x: 34.66208946124076, y: 20, width: 30, height: 160, layer: 2 },
    ] } }
    useEditorStore.getInitialState().selectedSectionObject = { blockId: block.id, section: 2, id: 'second' }
    const html = renderToStaticMarkup(createElement(PropertiesPanel, { block }))
    expect(html).toContain('Panel Properties')
    expect(html).toContain('Selected panel')
    expect(html).toContain('34.66')
    expect(html).not.toContain('First item')
    expect(html).toContain('Section / Block Properties')
    expect(block.props.section2Objects[1].x).toBe(34.66208946124076)
  })
})
