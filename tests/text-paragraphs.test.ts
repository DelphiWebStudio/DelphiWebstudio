import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RichText } from '../src/blocks/RichText'
import { exportSiteToHTML } from '../src/lib/export-html'
import { createProjectFile, parseProjectFile, serializeProjectFile } from '../src/project/project-file'

describe('paragraph formatting in portable projects and exported pages', () => {
  const runs = [
    { text: 'Visit our ', tag: 'p', line: 1, lineHeight: 1.75, spaceBefore: 8, spaceAfter: 14, indentLeft: 12, indentRight: 16, firstLineIndent: -8, align: 'justify', size: 18, color: '#111111' },
    { text: 'community', tag: 'p', line: 1, lineHeight: 1.75, spaceBefore: 8, spaceAfter: 14, indentLeft: 12, indentRight: 16, firstLineIndent: -8, align: 'justify', href: '/visit' },
    { text: 'An unchanged paragraph.', tag: 'p', line: 2 },
  ]

  it('retains paragraph properties and links through save, reopen, Preview, and export', () => {
    const config = { name: 'Writing', blocks: [{ id: 'writing', type: 'content' as const, variant: 'prose', props: { body: 'Visit our community\nAn unchanged paragraph.', bodyRich: runs } }] }
    const reopened = parseProjectFile(serializeProjectFile(createProjectFile(config, 'writing'))).project.config
    expect(reopened.blocks[0].props.bodyRich).toEqual(runs)
    const preview = renderToStaticMarkup(createElement(RichText, { blockId: 'writing', field: 'body', text: '', value: runs, multiline: true, markdown: true }))
    for (const html of [preview, exportSiteToHTML(reopened)]) {
      expect(html).toContain('line-height:1.75')
      expect(html).toContain('margin-top:8px')
      expect(html).toContain('margin-bottom:14px')
      expect(html).toContain('margin-left:12px')
      expect(html).toContain('margin-right:16px')
      expect(html).toContain('text-indent:-8px')
      expect(html).toContain('text-align:justify')
      expect(html).toContain('href="/visit"')
      expect(html).toContain('An unchanged paragraph.')
    }
    expect(preview.match(/<p /g)).toHaveLength(2)
  })

  it('preserves paragraph boundaries in independent text boxes without Markdown styling', () => {
    const html = renderToStaticMarkup(createElement(RichText, { blockId: 'writing', field: 'sectionObject_text', text: '', value: runs, multiline: true }))
    expect(html.match(/<p/g)).toHaveLength(2)
    expect(html).toContain('text-indent:-8px')
    expect(html).not.toContain('leading-relaxed')
  })

  it('retains source-pasted heading tags and spacing through project reopening, Preview and export', () => {
    const headings = ['h1', 'h4', 'h5', 'h6'].map((tag, index) => ({
      text: `Source heading ${tag}`, tag, line: index + 1, font: 'Arial', size: 20, bold: true,
      color: '#17334b', lineHeight: 1.4, spaceBefore: 8, spaceAfter: 13, indentLeft: 12, indentRight: 16,
    }))
    const config = { name: 'Heading example', blocks: [{ id: 'headings', type: 'content' as const, variant: 'prose', props: { body: headings.map(run => run.text).join('\n'), bodyRich: headings } }] }
    const reopened = parseProjectFile(serializeProjectFile(createProjectFile(config, 'headings'))).project.config
    expect(reopened.blocks[0].props.bodyRich).toEqual(headings)
    const preview = renderToStaticMarkup(createElement(RichText, { blockId: 'headings', field: 'body', text: '', value: reopened.blocks[0].props.bodyRich, multiline: true, markdown: true }))
    for (const html of [preview, exportSiteToHTML(reopened)]) {
      for (const { tag, text } of headings) {
        const heading = Array.from(html.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?</${tag}>`, 'g'))).find(match => match[0].includes(text))?.[0]
        expect(heading).toBeDefined()
        expect(heading).toContain('font-size:20px')
        expect(heading).toContain('line-height:1.4')
        expect(heading).toContain('margin-top:8px')
        expect(heading).toContain('margin-bottom:13px')
        expect(heading).toContain('margin-left:12px')
        expect(heading).toContain('margin-right:16px')
        expect(heading).not.toContain('leading-relaxed')
      }
    }
  })

  it('ignores malformed and out-of-range paragraph styles in imported projects', () => {
    const html = renderToStaticMarkup(createElement(RichText, { blockId: 'writing', field: 'body', text: '', multiline: true, value: [{ text: 'Safe wording', tag: 'p', lineHeight: 500, spaceBefore: -1, spaceAfter: '0;position:fixed', indentLeft: 9999, indentRight: NaN, firstLineIndent: -201 }] }))
    expect(html).toContain('Safe wording')
    expect(html).not.toMatch(/margin-|line-height|text-indent|position:fixed|NaN/)
  })
})
