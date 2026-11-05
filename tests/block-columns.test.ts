import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BlockColumns } from '../src/blocks/BlockColumns'
import { DividerBlock } from '../src/blocks/divider/DividerBlock'
import { blockMetadata } from '../src/lib/block-metadata'
import { useEditorStore } from '../src/store/editorStore'

describe('editor section guides', () => {
  it('shows resize handles and a move cursor without a visible Move button', () => {
    const block = { id: 'move-test', type: 'content' as const, variant: 'prose', props: { section1Objects: [{ id: 'label', type: 'text', text: 'Example', x: 5, y: 10, width: 30, height: 80, layer: 1 }] } }
    useEditorStore.getInitialState().selectedSectionObject = { blockId: block.id, section: 1, id: 'label' }
    try {
      const html = renderToStaticMarkup(createElement(BlockColumns, { block, editable: true }))
      expect(html).toContain('cursor:move')
      expect(html).toContain('Resize object se')
      expect(html).not.toContain('>Move</button>')
    } finally { useEditorStore.getInitialState().selectedSectionObject = null }
  })
  it('starts strips blank and preserves their resized height and positioned divider', () => {
    const strip = blockMetadata.find(item => item.type === 'divider')!
    expect(strip.variants[0]).toBe('space')
    const block = { id: 'strip', type: 'divider' as const, variant: 'space', props: { ...strip.defaultProps, layoutHeight: 140, section1Objects: [{ id: 'rule', type: 'divider', x: 10, y: 30, width: 70, height: 24, layer: 1 }] } }
    const markup = renderToStaticMarkup(createElement(BlockColumns, { block }, createElement(DividerBlock, { block })))
    expect(markup).toContain('--ws-strip-height, 140px')
    expect(markup).toContain('data-section-object="rule"')
    expect(markup).toContain('border-top:1px solid #808080')
  })
  it('keeps the section label after the block content so resize styling targets the block', () => {
    const block = { id: 'hero', type: 'hero' as const, variant: 'centered', props: { sectionCount: 2, layoutHeight: 250 } }
    const html = renderToStaticMarkup(createElement(BlockColumns, { block, editable: true }, createElement('section', null, 'Hero content')))
    expect(html.indexOf('<section>Hero content</section>')).toBeGreaterThan(-1)
    expect(html.indexOf('>Section 1</span>')).toBeGreaterThan(html.indexOf('<section>Hero content</section>'))
  })
  it('preserves space below a positioned image in editor and exported markup', () => {
    const block = { id: 'space-test', type: 'content' as const, variant: 'prose', props: { section1ExtraSpace: 64, section1Objects: [{ id: 'photo', type: 'image', src: 'assets/photo.png', x: 0, y: 100, width: 30, height: 200, layer: 1 }] } }
    for (const editable of [true, false]) {
      const html = renderToStaticMarkup(createElement(BlockColumns, { block, editable }))
      expect(html).toContain('min-height:364px')
      expect(html).toContain('padding-bottom:64px')
      expect(html).toContain('data-section-object="photo"')
    }
  })
})
