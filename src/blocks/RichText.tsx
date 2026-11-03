import { createElement, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { renderToStaticMarkup } from 'react-dom/server'
import { useConfigStore } from '@/store/configStore'
import { renderMarkdown } from '@/lib/markdown'

type Run = { text: string; font?: string; size?: number; color?: string; bold?: boolean; italic?: boolean; underline?: boolean; href?: string }
type Props = { blockId: string; field: string; text: string; value: unknown; editable?: boolean; multiline?: boolean; markdown?: boolean }

export function RichText({ blockId, field, text, value, editable = false, multiline = false, markdown = false }: Props) {
  const root = useRef<HTMLElement>(null)
  const dirty = useRef(false)
  const savedRange = useRef<Range | null>(null)
  const menuActive = useRef(false)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const runs = Array.isArray(value) ? value.filter((item): item is Run => !!item && typeof item === 'object' && typeof item.text === 'string') : null

  function save() {
    const element = root.current
    if (!element || !editable || !dirty.current) return
    const output: Run[] = []
    const collect = (node: Node, style: Omit<Run, 'text'>) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent) output.push({ text: node.textContent, ...style })
        return
      }
      if (!(node instanceof HTMLElement)) return
      if (node.tagName === 'BR') { output.push({ text: '\n', ...style }); return }
      const next = { ...style }
      const font = node.style.fontFamily.replace(/["']/g, '').trim()
      if (font && /^[\w ,.-]{1,100}$/.test(font)) next.font = font
      const size = Number.parseFloat(node.style.fontSize)
      if (Number.isFinite(size) && size >= 6 && size <= 200 && node.style.fontSize.endsWith('px')) next.size = size
      const color = node.style.color
      if (/^#[0-9a-f]{6}$/i.test(color) || /^rgba?\(\s*[\d.,%\s]+\)$/i.test(color)) next.color = color
      if (node.tagName === 'B' || node.tagName === 'STRONG' || node.style.fontWeight === 'bold' || Number(node.style.fontWeight) >= 600) next.bold = true
      if (node.tagName === 'I' || node.tagName === 'EM' || node.style.fontStyle === 'italic') next.italic = true
      if (node.tagName === 'U' || node.style.textDecorationLine.includes('underline')) next.underline = true
      const href = node.tagName === 'A' ? node.getAttribute('href') : null
      if (href && !/[\\\p{Cc}]/u.test(href) && !href.startsWith('//') && (!/^[a-z][a-z\d+.-]*:/i.test(href) || /^(https?:|mailto:|tel:)/i.test(href))) next.href = href
      if ((node.tagName === 'P' || node.tagName === 'DIV') && output.length && !output[output.length - 1].text.endsWith('\n')) output.push({ text: '\n' })
      node.childNodes.forEach(child => collect(child, next))
    }
    element.childNodes.forEach(node => collect(node, {}))
    const plain = output.map(item => item.text).join('')
    const current = useConfigStore.getState().getActivePageBlocks().find(block => block.id === blockId)
    dirty.current = false
    if (!current || (current.props[field] === plain && JSON.stringify(current.props[`${field}Rich`]) === JSON.stringify(output))) return
    useConfigStore.getState().updateBlockProps(blockId, { [field]: plain, [`${field}Rich`]: output })
  }

  function apply(style: Partial<CSSStyleDeclaration>) {
    const range = savedRange.current
    if (!range || range.collapsed || !root.current?.contains(range.commonAncestorContainer)) return
    const span = document.createElement('span')
    Object.assign(span.style, style)
    span.appendChild(range.extractContents())
    range.insertNode(span)
    dirty.current = true
    const next = document.createRange()
    next.selectNodeContents(span)
    savedRange.current = next
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(next)
  }

  function insertPastedHtml(html: string, plain: string) {
    const parsed = new DOMParser().parseFromString(html, 'text/html')
    const container = document.createElement('div')
    const copy = (node: Node, parent: Node) => {
      if (node.nodeType === Node.TEXT_NODE) { parent.appendChild(document.createTextNode(node.textContent || '')); return }
      if (!(node instanceof HTMLElement)) return
      const tag = node.tagName.toLowerCase()
      if (['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'img'].includes(tag)) return
      const allowed = ['p', 'div', 'br', 'span', 'b', 'strong', 'i', 'em', 'u', 'a'].includes(tag)
      if (!allowed) { node.childNodes.forEach(child => copy(child, parent)); return }
      const clean = document.createElement(tag)
      const font = node.style.fontFamily.replace(/["']/g, '').trim()
      if (font && /^[\w ,.-]{1,100}$/.test(font)) clean.style.fontFamily = font
      const size = Number.parseFloat(node.style.fontSize)
      if (Number.isFinite(size) && size >= 6 && size <= 200 && node.style.fontSize.endsWith('px')) clean.style.fontSize = `${size}px`
      if (/^#[0-9a-f]{6}$/i.test(node.style.color) || /^rgba?\(\s*[\d.,%\s]+\)$/i.test(node.style.color)) clean.style.color = node.style.color
      if (node.style.fontWeight === 'bold' || Number(node.style.fontWeight) >= 600) clean.style.fontWeight = 'bold'
      if (node.style.fontStyle === 'italic') clean.style.fontStyle = 'italic'
      if (node.style.textDecorationLine.includes('underline')) clean.style.textDecoration = 'underline'
      const href = tag === 'a' ? node.getAttribute('href') : null
      if (href && !/[\\\p{Cc}]/u.test(href) && !href.startsWith('//') && (!/^[a-z][a-z\d+.-]*:/i.test(href) || /^(https?:|mailto:|tel:)/i.test(href))) clean.setAttribute('href', href)
      node.childNodes.forEach(child => copy(child, clean))
      parent.appendChild(clean)
    }
    parsed.body.childNodes.forEach(node => copy(node, container))
    if (container.textContent || container.querySelector('br')) document.execCommand('insertHTML', false, container.innerHTML)
    else if (plain) document.execCommand('insertText', false, plain)
  }

  function close() {
    menuActive.current = false
    savedRange.current = null
    setMenu(null)
    save()
  }
  useEffect(() => {
    if (!menu) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    const outside = (event: globalThis.PointerEvent) => { if (!(event.target instanceof Element) || !event.target.closest('[data-rich-menu]')) close() }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', outside)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', outside) }
  }, [menu]) // eslint-disable-line react-hooks/exhaustive-deps

  const content: ReactNode = runs ? runs.map((run, index) => createElement(typeof run.href === 'string' && !!run.href && !/[\\\p{Cc}]/u.test(run.href) && !run.href.startsWith('//') && (!/^[a-z][a-z\d+.-]*:/i.test(run.href) || /^(https?:|mailto:|tel:)/i.test(run.href)) ? 'a' : 'span', {
    key: index, 'data-rich-run': '', style: {
      ...(typeof run.font === 'string' && /^[\w ,.-]{1,100}$/.test(run.font) ? { fontFamily: run.font } : {}),
      ...(typeof run.size === 'number' && Number.isFinite(run.size) && run.size >= 6 && run.size <= 200 ? { fontSize: `${run.size}px` } : {}),
      ...(typeof run.color === 'string' && (/^#[0-9a-f]{6}$/i.test(run.color) || /^rgba?\(\s*[\d.,%\s]+\)$/i.test(run.color)) ? { color: run.color } : {}),
      ...(run.bold ? { fontWeight: 'bold' } : {}), ...(run.italic ? { fontStyle: 'italic' } : {}), ...(run.underline ? { textDecoration: 'underline' } : {}),
    }, ...(typeof run.href === 'string' && !!run.href && !/[\\\p{Cc}]/u.test(run.href) && !run.href.startsWith('//') && (!/^[a-z][a-z\d+.-]*:/i.test(run.href) || /^(https?:|mailto:|tel:)/i.test(run.href)) ? { href: run.href } : {}),
  }, run.text)) : markdown ? renderMarkdown(text) : text
  // React escapes text and renders only the supported formatting above; never store or render pasted HTML directly.
  const markup = renderToStaticMarkup(createElement('div', null, content)).slice(5, -6)
  useEffect(() => {
    if (editable && root.current && !dirty.current && root.current.innerHTML !== markup) root.current.innerHTML = markup
  }, [editable, markup])

  const Tag = multiline ? 'div' : 'span'
  return <>
    <Tag ref={(element: HTMLElement | null) => { root.current = element }} data-rich-editor={editable ? field : undefined} role={editable ? 'textbox' : undefined} aria-label={editable ? `Edit ${field}` : undefined} aria-multiline={editable && multiline ? true : undefined} contentEditable={editable || undefined} suppressContentEditableWarning style={{ whiteSpace: 'pre-wrap', ...(editable && multiline ? { display: 'block', minHeight: '3em', cursor: 'text' } : {}) }}
      onBlur={() => { if (!menuActive.current) save() }}
      onInput={() => { dirty.current = true }}
      onPaste={event => {
        const html = event.clipboardData.getData('text/html')
        if (!html) return
        event.preventDefault()
        insertPastedHtml(html, event.clipboardData.getData('text/plain'))
      }}
      onKeyDown={event => { event.stopPropagation(); if (!multiline && event.key === 'Enter') { event.preventDefault(); root.current?.blur() } }}
      onContextMenu={event => {
        if (!editable) return
        event.preventDefault(); event.stopPropagation()
        const selection = window.getSelection()
        const range = selection?.rangeCount ? selection.getRangeAt(0) : null
        savedRange.current = range && root.current?.contains(range.commonAncestorContainer) ? range.cloneRange() : null
        menuActive.current = true
        setMenu({ x: Math.max(0, Math.min(event.clientX, window.innerWidth - 240)), y: Math.max(0, Math.min(event.clientY, window.innerHeight - 200)) })
      }}
      onDragStart={event => {
        if (!editable) return
        const selection = window.getSelection()
        if (!selection || selection.isCollapsed || !root.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) return
        const style = getComputedStyle(root.current)
        const span = document.createElement('span')
        span.style.fontFamily = style.fontFamily
        span.style.fontSize = style.fontSize
        span.style.color = style.color
        span.style.fontWeight = style.fontWeight
        span.style.fontStyle = style.fontStyle
        span.appendChild(selection.getRangeAt(0).cloneContents())
        root.current.dataset.richDragging = 'true'
        event.dataTransfer.setData('text/plain', selection.toString())
        event.dataTransfer.setData('text/html', span.outerHTML)
        event.dataTransfer.effectAllowed = 'copyMove'
      }}
      onDragEnd={() => { if (root.current) delete root.current.dataset.richDragging; if (!menuActive.current) save() }}
      onDrop={event => {
        const html = event.dataTransfer.getData('text/html')
        if (html && !document.querySelector('[data-rich-dragging="true"]')) {
          event.preventDefault()
          const range = document.caretRangeFromPoint(event.clientX, event.clientY)
          if (range && root.current?.contains(range.commonAncestorContainer)) {
            root.current.focus()
            const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range)
            insertPastedHtml(html, event.dataTransfer.getData('text/plain'))
          }
        }
        window.setTimeout(() => { if (root.current && document.activeElement !== root.current) save() }, 0)
      }}
      dangerouslySetInnerHTML={editable ? undefined : { __html: markup }} />
    {menu && createPortal(<div data-rich-menu role="menu" aria-label="Text formatting" className="fixed z-[10001] w-56 rounded border border-gray-400 bg-white p-2 text-sm text-black shadow-lg" style={{ left: menu.x, top: menu.y }} onContextMenu={event => event.preventDefault()} onClick={event => event.stopPropagation()}>
      {!savedRange.current || savedRange.current.collapsed ? <p className="mb-2 text-xs">Select text to format it.</p> : <>
        <label className="mb-2 block text-xs">Font<select aria-label="Text font" defaultValue="" className="mt-1 w-full rounded border border-gray-400 p-1" onChange={event => { if (event.target.value) apply({ fontFamily: event.target.value }) }}><option value="">Choose font</option>{['Arial', 'Calibri', 'Georgia', 'Tahoma', 'Times New Roman', 'Verdana'].map(font => <option key={font}>{font}</option>)}</select></label>
        <label className="mb-2 block text-xs">Font size (px)<input aria-label="Text font size" type="number" min="6" max="200" className="mt-1 w-full rounded border border-gray-400 p-1" onChange={event => { const size = Number(event.target.value); if (size >= 6 && size <= 200) apply({ fontSize: `${size}px` }) }} /></label>
        <label className="mb-2 flex items-center justify-between text-xs">Text color<input aria-label="Text color" type="color" defaultValue="#000000" onChange={event => apply({ color: event.target.value })} /></label>
        <div className="flex gap-2"><button type="button" className="rounded border border-gray-400 px-2 py-1 font-bold" onMouseDown={event => event.preventDefault()} onClick={() => apply({ fontWeight: 'bold' })}>Bold</button><button type="button" className="rounded border border-gray-400 px-2 py-1 italic" onMouseDown={event => event.preventDefault()} onClick={() => apply({ fontStyle: 'italic' })}>Italic</button><button type="button" className="rounded border border-gray-400 px-2 py-1 underline" onMouseDown={event => event.preventDefault()} onClick={() => apply({ textDecoration: 'underline' })}>Underline</button></div>
      </>}
      <button type="button" className="mt-2 rounded border border-gray-400 px-2 py-1" onClick={close}>Done</button>
    </div>, document.body)}
  </>
}
