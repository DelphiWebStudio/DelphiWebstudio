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
})
