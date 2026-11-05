import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BlockColumns } from '../src/blocks/BlockColumns'

describe('editor section guides', () => {
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
