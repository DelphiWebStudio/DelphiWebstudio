import { createElement, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { renderToStaticMarkup } from 'react-dom/server'
import { useConfigStore } from '@/store/configStore'
import { renderMarkdown } from '@/lib/markdown'

type Run = { text: string; font?: string; size?: number; color?: string; bold?: boolean; italic?: boolean; underline?: boolean; href?: string }
type Props = { blockId: string; field: string; text: string; value: unknown; editable?: boolean; multiline?: boolean; markdown?: boolean; position?: { x: number; y: number }; fill?: boolean }
let draggedText: { element: HTMLElement; range: Range } | null = null

export function RichText({ blockId, field, text, value, editable = false, multiline = false, markdown = false, position, fill = false }: Props) {
  const root = useRef<HTMLElement>(null)
  const dirty = useRef(false)
  const savedRange = useRef<Range | null>(null)
  const menuActive = useRef(false)
  const moveRef = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [clipboardError, setClipboardError] = useState('')
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
  const Outer = multiline ? 'div' : 'span'
  const x = Number.isFinite(position?.x) ? Math.max(-2000, Math.min(2000, position!.x)) : 0
  const y = Number.isFinite(position?.y) ? Math.max(-2000, Math.min(2000, position!.y)) : 0
  const updatePosition = (nextX: number, nextY: number) => useConfigStore.getState().updateBlockProps(blockId, { [`${field}OffsetX`]: Math.round(Math.max(-2000, Math.min(2000, nextX))), [`${field}OffsetY`]: Math.round(Math.max(-2000, Math.min(2000, nextY))) })
  return <>
    <Outer data-text-position={position ? field : undefined} className={position && editable ? 'group/text relative inline-block' : undefined} style={position ? { display: 'inline-block', position: 'relative', transform: `translate(${x}px, ${y}px)` } : fill && editable ? { display: 'flex', flex: '1 1 auto' } : undefined}>
    <Tag ref={(element: HTMLElement | null) => { root.current = element }} data-rich-editor={editable ? field : undefined} role={editable ? 'textbox' : undefined} aria-label={editable ? `Edit ${field}` : undefined} aria-multiline={editable && multiline ? true : undefined} contentEditable={editable || undefined} suppressContentEditableWarning style={{ whiteSpace: 'pre-wrap', ...(editable && multiline ? { display: 'block', minHeight: '3em', cursor: 'text', ...(fill ? { flex: 1 } : {}) } : {}) }}
      onBlur={() => { if (!menuActive.current && !draggedText) save() }}
      onInput={() => { dirty.current = true }}
      onCopy={event => {
        const selection = window.getSelection()
        if (!selection || selection.isCollapsed || !root.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) return
        const node = selection.getRangeAt(0).startContainer
        const style = getComputedStyle(node instanceof Element ? node : node.parentElement || root.current)
        const span = document.createElement('span')
        span.style.fontFamily = style.fontFamily; span.style.fontSize = style.fontSize; span.style.color = style.color
        span.style.fontWeight = style.fontWeight; span.style.fontStyle = style.fontStyle
        span.appendChild(selection.getRangeAt(0).cloneContents())
        event.clipboardData.setData('text/plain', selection.toString())
        event.clipboardData.setData('text/html', span.outerHTML)
        event.preventDefault()
      }}
      onPaste={event => {
        const html = event.clipboardData.getData('text/html')
        if (!html) return
        event.preventDefault()
        insertPastedHtml(html, event.clipboardData.getData('text/plain'))
        dirty.current = true
      }}
      onKeyDown={event => { event.stopPropagation(); if (!multiline && event.key === 'Enter') { event.preventDefault(); root.current?.blur() } }}
      onContextMenu={event => {
        if (!editable) return
        event.preventDefault(); event.stopPropagation()
        const selection = window.getSelection()
        const range = selection?.rangeCount ? selection.getRangeAt(0) : null
        savedRange.current = range && root.current?.contains(range.commonAncestorContainer) ? range.cloneRange() : null
        menuActive.current = true
        setClipboardError('')
        setMenu({ x: Math.max(0, Math.min(event.clientX, window.innerWidth - 240)), y: Math.max(0, Math.min(event.clientY, window.innerHeight - 200)) })
      }}
      onDragStart={event => {
        if (!editable) return
        const selection = window.getSelection()
        if (!selection || selection.isCollapsed || !root.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) return
        const node = selection.getRangeAt(0).startContainer
        const style = getComputedStyle(node instanceof Element ? node : node.parentElement || root.current)
        const span = document.createElement('span')
        span.style.fontFamily = style.fontFamily
        span.style.fontSize = style.fontSize
        span.style.color = style.color
        span.style.fontWeight = style.fontWeight
        span.style.fontStyle = style.fontStyle
        span.appendChild(selection.getRangeAt(0).cloneContents())
        root.current.dataset.richDragging = 'true'
        draggedText = { element: root.current, range: selection.getRangeAt(0).cloneRange() }
        event.dataTransfer.setData('text/plain', selection.toString())
        event.dataTransfer.setData('text/html', span.outerHTML)
        event.dataTransfer.effectAllowed = 'copyMove'
      }}
      onDragEnd={() => { if (root.current) delete root.current.dataset.richDragging; draggedText = null; if (!menuActive.current) save() }}
      onDrop={event => {
        const html = event.dataTransfer.getData('text/html')
        if (html && draggedText?.element !== root.current) {
          event.preventDefault()
          let range = document.caretRangeFromPoint(event.clientX, event.clientY)
          if (root.current && (!range || !root.current.contains(range.commonAncestorContainer))) { range = document.createRange(); range.selectNodeContents(root.current); range.collapse(false) }
          if (range && root.current) {
            root.current.focus()
            const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range)
            insertPastedHtml(html, event.dataTransfer.getData('text/plain'))
            dirty.current = true
            if (draggedText && !event.ctrlKey) { draggedText.range.deleteContents(); draggedText.element.dispatchEvent(new Event('input', { bubbles: true })) }
          }
        }
        window.setTimeout(() => { if (root.current && document.activeElement !== root.current) save() }, 0)
      }}
      dangerouslySetInnerHTML={editable ? undefined : { __html: markup }} />
    {position && editable && <button type="button" aria-label={`Move ${field}`} title="Drag to move text, or focus and use arrow keys" className="absolute -top-5 left-0 z-30 rounded border border-gray-400 bg-white px-1 text-xs leading-4 text-black opacity-0 group-hover/text:opacity-100 focus:opacity-100" style={{ cursor: 'move', touchAction: 'none' }}
      onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.stopPropagation(); moveRef.current = { startX: event.clientX, startY: event.clientY, x, y }; event.currentTarget.setPointerCapture(event.pointerId) }}
      onPointerMove={event => { const move = moveRef.current; if (move) event.currentTarget.parentElement!.style.transform = `translate(${move.x + event.clientX - move.startX}px, ${move.y + event.clientY - move.startY}px)` }}
      onPointerUp={event => { const move = moveRef.current; if (move) { moveRef.current = null; updatePosition(move.x + event.clientX - move.startX, move.y + event.clientY - move.startY) } }}
      onKeyDown={event => { const delta = event.shiftKey ? 10 : 1; const dx = event.key === 'ArrowLeft' ? -delta : event.key === 'ArrowRight' ? delta : 0; const dy = event.key === 'ArrowUp' ? -delta : event.key === 'ArrowDown' ? delta : 0; if (dx || dy) { event.preventDefault(); event.stopPropagation(); updatePosition(x + dx, y + dy) } }}>Move</button>}
    </Outer>
    {menu && createPortal(<div data-rich-menu role="menu" aria-label="Text formatting" className="fixed z-[10001] w-56 rounded border border-gray-400 bg-white p-2 text-sm text-black shadow-lg" style={{ left: menu.x, top: menu.y }} onContextMenu={event => event.preventDefault()} onClick={event => event.stopPropagation()}>
      <div className="mb-2 flex flex-wrap gap-1 border-b border-gray-300 pb-2">
        <button type="button" className="rounded border border-gray-400 px-2 py-1" onMouseDown={event => event.preventDefault()} onClick={() => {
          if (!root.current) return
          root.current.focus(); const range = document.createRange(); range.selectNodeContents(root.current)
          const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range); savedRange.current = range.cloneRange(); setMenu({ ...menu })
        }}>Select all</button>
        {(['cut', 'copy', 'delete'] as const).map(command => <button key={command} type="button" disabled={!savedRange.current || savedRange.current.collapsed} className="rounded border border-gray-400 px-2 py-1 capitalize disabled:opacity-40" onMouseDown={event => event.preventDefault()} onClick={() => {
          if (!root.current || !savedRange.current || savedRange.current.collapsed) return
          root.current.focus(); const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(savedRange.current)
          if (document.execCommand(command)) { if (command !== 'copy') dirty.current = true; close() }
        }}>{command}</button>)}
        <button type="button" className="rounded border border-gray-400 px-2 py-1" onMouseDown={event => event.preventDefault()} onClick={async () => {
          try {
            const entries = await navigator.clipboard.read()
            const entry = entries[0]
            if (!entry || !root.current) throw new Error('Clipboard is empty')
            const html = entry.types.includes('text/html') ? await (await entry.getType('text/html')).text() : ''
            const plain = entry.types.includes('text/plain') ? await (await entry.getType('text/plain')).text() : ''
            root.current.focus(); const selection = window.getSelection()
            if (savedRange.current && root.current.contains(savedRange.current.commonAncestorContainer)) { selection?.removeAllRanges(); selection?.addRange(savedRange.current) }
            insertPastedHtml(html, plain); dirty.current = true; close()
          } catch { setClipboardError('Paste unavailable here. Click in the text and press Ctrl+V.') }
        }}>Paste</button>
      </div>
      {clipboardError && <p role="status" className="mb-2 text-xs">{clipboardError}</p>}
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
