import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { PropertiesPanel } from '../src/editor/PropertiesPanel'
import { useEditorStore } from '../src/store/editorStore'

describe('selected object properties', () => {
  afterEach(() => { useEditorStore.getInitialState().selectedSectionObject = null; useEditorStore.getInitialState().selectedCompositeItem = null; useEditorStore.getInitialState().selectedPlacedMedia = null })

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

  it('shows only the selected composite item', () => {
    const block = { id: 'gallery', type: 'gallery' as const, variant: 'grid', props: { images: [{ src: '/first.jpg', alt: 'First image' }, { src: '/second.jpg', alt: 'Second image' }] } }
    useEditorStore.getInitialState().selectedCompositeItem = { blockId: block.id, field: 'images', index: 1 }
    const html = renderToStaticMarkup(createElement(PropertiesPanel, { block }))
    expect(html).toContain('Second image')
    expect(html).not.toContain('First image')
    expect(html).not.toContain('+ Add item')
  })

  it('shows only the selected placed media', () => {
    const block = { id: 'block', type: 'content' as const, variant: 'prose', props: { placedMedia: [{ id: 'a', name: 'First photo', x: 5, y: 7, width: 20 }, { id: 'b', name: 'Second photo', x: 10, y: 12, width: 30 }] } }
    useEditorStore.getInitialState().selectedPlacedMedia = { blockId: block.id, id: 'b' }
    const html = renderToStaticMarkup(createElement(PropertiesPanel, { block }))
    expect(html).toContain('Second photo')
    expect(html).not.toContain('First photo')
    expect(html).toContain('Width (%)')
  })
})
