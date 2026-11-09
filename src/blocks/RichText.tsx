import { createElement, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { renderToStaticMarkup } from 'react-dom/server'
import { useConfigStore } from '@/store/configStore'
import { renderMarkdown } from '@/lib/markdown'
import { chooseWindowsFont } from '@/desktop/native-bridge'
import { WindowsColorInput } from '@/editor/WindowsColorInput'

type Run = { text: string; font?: string; size?: number; color?: string; bold?: boolean; italic?: boolean; underline?: boolean; href?: string; align?: 'left' | 'center' | 'right' | 'justify' }
type Props = { blockId: string; field: string; text: string; value: unknown; editable?: boolean; multiline?: boolean; markdown?: boolean; position?: { x: number; y: number; width?: number; height?: number }; fill?: boolean; alignment?: unknown; onDeleteBox?: () => void }
let draggedText: { element: HTMLElement; range: Range } | null = null

export function RichText({ blockId, field, text, value, editable = false, multiline = false, markdown = false, position, fill = false, alignment, onDeleteBox }: Props) {
  const root = useRef<HTMLElement>(null)
  const dirty = useRef(false)
  const savedRange = useRef<Range | null>(null)
  const menuActive = useRef(false)
  const menuElement = useRef<HTMLDivElement>(null)
  const menuDrag = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const menuMoved = useRef(false)
  const moveRef = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null)
  const resizeRef = useRef<{ startX: number; startY: number; width: number; height: number; maxWidth: number; direction: string } | null>(null)
  const [resizeSize, setResizeSize] = useState<{ width: number; height: number } | null>(null)
  const [guides, setGuides] = useState<{ vertical?: { x: number; top: number; height: number }; horizontal?: { y: number; left: number; width: number } }>({})
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
      if (node.tagName === 'LI') {
        if (output.length && !output[output.length - 1].text.endsWith('\n')) output.push({ text: '\n' })
        if (!node.textContent?.trimStart().startsWith('• ')) output.push({ text: '• ', ...style })
      }
      if (node.style.textAlign === 'left' || node.style.textAlign === 'center' || node.style.textAlign === 'right' || node.style.textAlign === 'justify') next.align = node.style.textAlign
      const font = node.style.fontFamily.replace(/["']/g, '').trim()
      if (font && /^[\p{L}\p{N} ,._-]{1,100}$/u.test(font)) next.font = font
      const size = Number.parseFloat(node.style.fontSize)
      if (Number.isFinite(size) && size >= 6 && size <= 200 && node.style.fontSize.endsWith('px')) next.size = size
      const color = node.style.color
      if (/^#[0-9a-f]{6}$/i.test(color) || /^rgba?\(\s*[\d.,%\s]+\)$/i.test(color)) next.color = color
      if (node.tagName === 'B' || node.tagName === 'STRONG' || node.style.fontWeight === 'bold' || Number(node.style.fontWeight) >= 600) next.bold = true
      else if (node.style.fontWeight === 'normal' || (node.style.fontWeight && Number(node.style.fontWeight) > 0 && Number(node.style.fontWeight) < 600)) next.bold = false
      if (node.tagName === 'I' || node.tagName === 'EM' || node.style.fontStyle === 'italic') next.italic = true
      else if (node.style.fontStyle === 'normal') next.italic = false
      if (node.tagName === 'U' || node.style.textDecorationLine.includes('underline')) next.underline = true
      else if (node.style.textDecorationLine === 'none') next.underline = false
      const href = node.tagName === 'A' ? node.getAttribute('href') : null
      if (href && !/[\\\p{Cc}]/u.test(href) && !href.startsWith('//') && (!/^[a-z][a-z\d+.-]*:/i.test(href) || /^(https?:|mailto:|tel:)/i.test(href))) next.href = href
      if ((node.tagName === 'P' || node.tagName === 'DIV') && output.length && !output[output.length - 1].text.endsWith('\n')) output.push({ text: '\n' })
      node.childNodes.forEach(child => collect(child, next))
    }
    element.childNodes.forEach(node => collect(node, {}))
    const plain = output.map(item => item.text).join('')
    const current = useConfigStore.getState().getActivePageBlocks().find(block => block.id === blockId)
    dirty.current = false
    if (!current) return
    const object = element.closest<HTMLElement>('[data-section-object][data-ws-object-type="text"]')
    const section = object?.closest<HTMLElement>('[data-editor-section]')
    const key = section ? `section${section.dataset.editorSection}Objects` : ''
    const items = key && Array.isArray(current.props[key]) ? current.props[key] as { id: string; height: number }[] : []
    const measuredHeight = object ? Math.ceil(Math.max(object.scrollHeight, element.scrollHeight)) : 0
    const needsHeight = items.some(item => item.id === object?.dataset.sectionObject && measuredHeight > (Number(item.height) || 80))
    if (!needsHeight && current.props[field] === plain && JSON.stringify(current.props[`${field}Rich`]) === JSON.stringify(output)) return
    useConfigStore.getState().updateBlockProps(blockId, { [field]: plain, [`${field}Rich`]: output, ...(needsHeight ? { [key]: items.map(item => item.id === object?.dataset.sectionObject ? { ...item, height: measuredHeight } : item) } : {}) })
  }

  useEffect(() => {
    const element = root.current
    element?.addEventListener('webstudio-flush-text', save)
    return () => element?.removeEventListener('webstudio-flush-text', save)
  })

  function apply(style: Partial<CSSStyleDeclaration>) {
    const range = savedRange.current
    if (!range || range.collapsed || !root.current?.contains(range.commonAncestorContainer)) return
    const span = document.createElement('span')
    Object.assign(span.style, style)
    span.setAttribute('data-rich-run', '')
    const fragment = range.extractContents()
    if (!style.textAlign) fragment.querySelectorAll<HTMLElement>('*').forEach(element => Object.assign(element.style, style))
    span.appendChild(fragment)
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
      if (font && /^[\p{L}\p{N} ,._-]{1,100}$/u.test(font)) clean.style.fontFamily = font
      const size = Number.parseFloat(node.style.fontSize)
      if (Number.isFinite(size) && size >= 6 && size <= 200 && node.style.fontSize.endsWith('px')) clean.style.fontSize = `${size}px`
      if (/^#[0-9a-f]{6}$/i.test(node.style.color) || /^rgba?\(\s*[\d.,%\s]+\)$/i.test(node.style.color)) clean.style.color = node.style.color
      if (node.style.fontWeight === 'bold' || Number(node.style.fontWeight) >= 600) clean.style.fontWeight = 'bold'
      else if (node.style.fontWeight === 'normal' || (node.style.fontWeight && Number(node.style.fontWeight) > 0 && Number(node.style.fontWeight) < 600)) clean.style.fontWeight = 'normal'
      if (node.style.fontStyle === 'italic') clean.style.fontStyle = 'italic'
      else if (node.style.fontStyle === 'normal') clean.style.fontStyle = 'normal'
      if (node.style.textDecorationLine.includes('underline')) clean.style.textDecoration = 'underline'
      else if (node.style.textDecorationLine === 'none') clean.style.textDecoration = 'none'
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
  useLayoutEffect(() => {
    const element = menuElement.current
    if (!menu || !element) return
    const bounds = element.getBoundingClientRect()
    if (!menuMoved.current) {
      const target = (root.current?.closest('[data-section-object]') ?? root.current)?.getBoundingClientRect()
      const gap = 12
      const x = target && target.right + gap + bounds.width <= window.innerWidth ? target.right + gap : target && target.left - gap >= bounds.width ? target.left - gap - bounds.width : menu.x
      const sidePlacement = !!target && x !== menu.x
      const y = sidePlacement ? 16 : target && target.bottom + gap + bounds.height <= window.innerHeight ? target.bottom + gap : target && target.top - gap >= bounds.height ? target.top - gap - bounds.height : target?.top ?? menu.y
      element.style.left = `${Math.max(0, Math.min(x, window.innerWidth - bounds.width))}px`
      element.style.top = `${Math.max(0, Math.min(y, window.innerHeight - bounds.height))}px`
    }
    element.style.maxHeight = `${Math.max(0, window.innerHeight - 32)}px`
    element.style.overflowY = 'auto'
  }, [menu])
  useEffect(() => {
    if (!menu) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    const outside = (event: globalThis.PointerEvent) => { if (!(event.target instanceof Element) || !event.target.closest('[data-rich-menu]')) close() }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', outside)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', outside) }
  }, [menu]) // eslint-disable-line react-hooks/exhaustive-deps

  const formattedRuns = runs?.map((run, index) => createElement(typeof run.href === 'string' && !!run.href && !/[\\\p{Cc}]/u.test(run.href) && !run.href.startsWith('//') && (!/^[a-z][a-z\d+.-]*:/i.test(run.href) || /^(https?:|mailto:|tel:)/i.test(run.href)) ? 'a' : 'span', {
    key: index, 'data-rich-run': '', style: {
      ...(typeof run.font === 'string' && /^[\p{L}\p{N} ,._-]{1,100}$/u.test(run.font) ? { fontFamily: run.font } : {}),
      ...(typeof run.size === 'number' && Number.isFinite(run.size) && run.size >= 6 && run.size <= 200 ? { fontSize: `${run.size}px` } : {}),
      ...(typeof run.color === 'string' && (/^#[0-9a-f]{6}$/i.test(run.color) || /^rgba?\(\s*[\d.,%\s]+\)$/i.test(run.color)) ? { color: run.color } : {}),
      ...(typeof run.bold === 'boolean' ? { fontWeight: run.bold ? 'bold' : 'normal' } : {}), ...(typeof run.italic === 'boolean' ? { fontStyle: run.italic ? 'italic' : 'normal' } : {}), ...(typeof run.underline === 'boolean' ? { textDecoration: run.underline ? 'underline' : 'none' } : {}),
    }, ...(typeof run.href === 'string' && !!run.href && !/[\\\p{Cc}]/u.test(run.href) && !run.href.startsWith('//') && (!/^[a-z][a-z\d+.-]*:/i.test(run.href) || /^(https?:|mailto:|tel:)/i.test(run.href)) ? { href: run.href } : {}),
  }, run.text))
  const groups = runs?.reduce<{ align?: Run['align']; children: ReactNode[] }[]>((result, run, index) => {
    const align = run.align === 'left' || run.align === 'center' || run.align === 'right' || run.align === 'justify' ? run.align : undefined
    const last = result[result.length - 1]
    if (last && last.align === align) last.children.push(formattedRuns![index])
    else result.push({ align, children: [formattedRuns![index]] })
    return result
  }, [])
  const content: ReactNode = groups ? groups.map((group, index) => group.align ? createElement('span', { key: index, style: { display: 'block', textAlign: group.align } }, group.children) : createElement('span', { key: index }, group.children)) : markdown ? renderMarkdown(text) : text
  // React escapes text and renders only the supported formatting above; never store or render pasted HTML directly.
  const markup = renderToStaticMarkup(createElement('div', null, content)).slice(5, -6)
  useLayoutEffect(() => {
    if (editable && root.current && !dirty.current && root.current.innerHTML !== markup) root.current.innerHTML = markup
  }, [editable, markup])

  const Tag = multiline ? 'div' : 'span'
  const Outer = multiline ? 'div' : 'span'
  const textAlign = alignment === 'left' || alignment === 'center' || alignment === 'right' || alignment === 'justify' ? alignment : undefined
  const x = Number.isFinite(position?.x) ? Math.max(-2000, Math.min(2000, position!.x)) : 0
  const y = Number.isFinite(position?.y) ? Math.max(-2000, Math.min(2000, position!.y)) : 0
  const colorNode = menu ? savedRange.current?.startContainer : null
  const selectedNode = colorNode && colorNode instanceof Element ? colorNode.childNodes.item(savedRange.current?.startOffset ?? 0) ?? colorNode : colorNode
  let colorElement = selectedNode ? (selectedNode instanceof Element ? selectedNode : selectedNode.parentElement) : null
  while (colorElement?.firstElementChild) colorElement = colorElement.firstElementChild
  const selectedStyle = colorElement ? getComputedStyle(colorElement) : null
  const colorParts = selectedStyle?.color.match(/\d+/g)?.slice(0, 3) ?? null
  const selectedColor = colorParts?.length === 3 ? `#${colorParts.map(value => Math.min(255, Number(value)).toString(16).padStart(2, '0')).join('')}` : '#000000'
  const selectedFont = selectedStyle?.fontFamily.split(',')[0].replace(/["']/g, '').trim() || ''
  const selectedSize = Math.max(6, Math.min(200, Math.round(parseFloat(selectedStyle?.fontSize || '') || 16)))
  const updatePosition = (nextX: number, nextY: number) => useConfigStore.getState().updateBlockProps(blockId, { [`${field}OffsetX`]: Math.round(Math.max(-2000, Math.min(2000, nextX))), [`${field}OffsetY`]: Math.round(Math.max(-2000, Math.min(2000, nextY))) })
  return <>
    <Outer data-text-position={position ? field : undefined} className={position && editable ? 'group/text relative inline-block' : undefined} style={position ? { display: 'inline-block', position: 'relative', maxWidth: '100%', overflowWrap: 'anywhere', transform: `translate(${x}px, ${y}px)`, ...(position.width && position.width > 0 ? { width: `${position.width}px` } : {}), ...(position.height && position.height > 0 ? { minHeight: `${position.height}px` } : {}), ...(textAlign ? { textAlign } : {}) } : { ...(fill && editable ? { display: 'flex', flex: '1 1 auto' } : {}), ...(textAlign ? { display: fill && editable ? 'flex' : 'block', width: '100%', textAlign } : {}) }}>
    <Tag ref={(element: HTMLElement | null) => { root.current = element }} data-rich-text data-rich-editor={editable ? field : undefined} role={editable ? 'textbox' : undefined} aria-label={editable ? `Edit ${field}` : undefined} aria-multiline={editable && multiline ? true : undefined} contentEditable={editable || undefined} suppressContentEditableWarning style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', ...(editable ? { display: 'inline-block', minWidth: '2em', minHeight: '1em', cursor: 'text' } : {}), ...(editable && multiline ? { display: 'block', minHeight: '3em', ...(fill ? { flex: 1 } : {}) } : {}) }}
      onBlur={() => { if (!menuActive.current && !draggedText) save() }}
      onInput={() => { dirty.current = true; requestAnimationFrame(() => { const element = root.current; const section = element?.closest<HTMLElement>('[data-editor-section]'); if (!element || !section) return; const object = element.closest<HTMLElement>('[data-section-object][data-ws-object-type="text"]'); if (object) { const bottom = object.offsetTop + Math.max(object.scrollHeight, element.scrollHeight); section.style.minHeight = `${Math.max(section.offsetHeight, bottom)}px` }; if (position) { const bounds = element.getBoundingClientRect(), area = section.getBoundingClientRect(); const correction = bounds.left < area.left ? area.left - bounds.left : bounds.right > area.right ? area.right - bounds.right : 0; if (Math.abs(correction) > 1) updatePosition(x + correction, y) } }) }}
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
        let range = selection?.rangeCount ? selection.getRangeAt(0) : null
        if ((!range || range.collapsed || !root.current?.contains(range.commonAncestorContainer)) && root.current) {
          range = document.createRange(); range.selectNodeContents(root.current)
          selection?.removeAllRanges(); selection?.addRange(range)
        }
        savedRange.current = range && root.current?.contains(range.commonAncestorContainer) ? range.cloneRange() : null
        menuActive.current = true
        setClipboardError('')
        menuMoved.current = false
        setMenu({ x: Math.max(0, Math.min(event.clientX, window.innerWidth - 320)), y: Math.max(0, Math.min(event.clientY, window.innerHeight - 200)) })
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
    {position && editable && <div role="button" tabIndex={0} aria-label={`Move ${field}`} title="Drag the top edge to move text, or use arrow keys" className="absolute left-1 right-1 top-0 z-20 h-2" style={{ cursor: 'move', touchAction: 'none' }}
      onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.stopPropagation(); moveRef.current = { startX: event.clientX, startY: event.clientY, x, y }; event.currentTarget.setPointerCapture(event.pointerId) }}
      onPointerMove={event => { const move = moveRef.current; const element = event.currentTarget.parentElement; if (move && element) {
        element.style.transform = `translate(${move.x + event.clientX - move.startX}px, ${move.y + event.clientY - move.startY}px)`
        const current = element.getBoundingClientRect()
        const matches: typeof guides = {}
        element.closest('[aria-label^="Site preview"]')?.querySelectorAll<HTMLElement>('[data-placed-media], [data-ws-image-index], [contenteditable="true"]').forEach(other => {
          if (element.contains(other) || other.contains(element)) return
          const rect = other.getBoundingClientRect(); if (!rect.width || !rect.height) return
          if (!matches.vertical) for (const [a, b] of [[current.left, rect.left], [current.right, rect.right], [(current.left + current.right) / 2, (rect.left + rect.right) / 2]]) if (Math.abs(a - b) <= 4) { const top = Math.min(current.top, rect.top); matches.vertical = { x: b, top, height: Math.max(current.bottom, rect.bottom) - top }; break }
          if (!matches.horizontal) for (const [a, b] of [[current.top, rect.top], [current.bottom, rect.bottom], [(current.top + current.bottom) / 2, (rect.top + rect.bottom) / 2]]) if (Math.abs(a - b) <= 4) { const left = Math.min(current.left, rect.left); matches.horizontal = { y: b, left, width: Math.max(current.right, rect.right) - left }; break }
        })
        setGuides(matches)
      } }}
      onPointerUp={event => { const move = moveRef.current; setGuides({}); if (move) { moveRef.current = null; updatePosition(move.x + event.clientX - move.startX, move.y + event.clientY - move.startY) } }}
      onPointerCancel={() => { moveRef.current = null; setGuides({}) }}
      onKeyDown={event => { const delta = event.shiftKey ? 10 : 1; const dx = event.key === 'ArrowLeft' ? -delta : event.key === 'ArrowRight' ? delta : 0; const dy = event.key === 'ArrowUp' ? -delta : event.key === 'ArrowDown' ? delta : 0; if (dx || dy) { event.preventDefault(); event.stopPropagation(); updatePosition(x + dx, y + dy) } }} />}
    {position && editable && (['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const).map(direction => <button key={direction} type="button" aria-label={`Resize ${field} ${direction}`} title="Drag to resize the text box" className="absolute z-30 h-3 w-3 border border-black bg-white opacity-0 group-hover/text:opacity-100 group-focus-within/text:opacity-100 focus:opacity-100" style={{ left: direction.includes('w') ? -6 : direction.includes('e') ? 'calc(100% - 6px)' : 'calc(50% - 6px)', top: direction.includes('n') ? -6 : direction.includes('s') ? 'calc(100% - 6px)' : 'calc(50% - 6px)', cursor: `${direction}-resize`, touchAction: 'none' }}
      onPointerDown={event => { const element = event.currentTarget.parentElement; const parent = element?.parentElement; if (!element || !parent || event.button !== 0) return; event.preventDefault(); event.stopPropagation(); const rect = element.getBoundingClientRect(); resizeRef.current = { startX: event.clientX, startY: event.clientY, width: rect.width, height: rect.height, maxWidth: parent.getBoundingClientRect().width, direction }; setResizeSize({ width: Math.round(rect.width), height: Math.round(rect.height) }); event.currentTarget.setPointerCapture(event.pointerId) }}
      onPointerMove={event => { const resize = resizeRef.current; const element = event.currentTarget.parentElement; if (!resize || !element) return; const dx = event.clientX - resize.startX, dy = event.clientY - resize.startY; const width = Math.max(40, Math.min(resize.maxWidth, resize.width + (direction.includes('e') ? dx : direction.includes('w') ? -dx : 0))); const height = Math.max(24, resize.height + (direction.includes('s') ? dy : direction.includes('n') ? -dy : 0)); element.style.width = `${width}px`; element.style.minHeight = `${height}px`; setResizeSize({ width: Math.round(element.getBoundingClientRect().width), height: Math.round(element.getBoundingClientRect().height) }) }}
      onPointerUp={event => { const resize = resizeRef.current; const element = event.currentTarget.parentElement; if (!resize || !element) return; resizeRef.current = null; useConfigStore.getState().updateBlockProps(blockId, { [`${field}Width`]: Math.round(element.getBoundingClientRect().width), [`${field}Height`]: Math.round(element.getBoundingClientRect().height) }); setResizeSize(null); event.stopPropagation() }} onPointerCancel={() => { resizeRef.current = null; setResizeSize(null) }} />)}
    {resizeSize && <span aria-live="polite" className="absolute right-0 top-full z-40 rounded bg-white px-1 text-xs font-normal leading-4 text-black">{resizeSize.width} × {resizeSize.height} px</span>}
    </Outer>
    {editable && (guides.vertical || guides.horizontal) && createPortal(<div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10000 }}>
      {guides.vertical && <div style={{ position: 'fixed', left: guides.vertical.x, top: guides.vertical.top, height: guides.vertical.height, width: 1, background: '#1683e5' }} />}
      {guides.horizontal && <div style={{ position: 'fixed', left: guides.horizontal.left, top: guides.horizontal.y, width: guides.horizontal.width, height: 1, background: '#1683e5' }} />}
    </div>, document.body)}
    {menu && createPortal(<div ref={menuElement} data-rich-menu data-studio-window role="dialog" aria-label="Text settings" className="fixed z-[10001] flex w-80 max-w-[calc(100vw-16px)] flex-col rounded border border-gray-300 bg-white p-4 text-sm font-normal text-black shadow-xl" style={{ left: menu.x, top: menu.y }} onContextMenu={event => event.preventDefault()} onClick={event => event.stopPropagation()}>
      <div className="order-first mb-4 flex items-center justify-between border-b border-gray-200 pb-3" style={{ cursor: 'move', touchAction: 'none' }} title="Drag to move the settings window" onPointerDown={event => { if (event.button !== 0 || (event.target instanceof Element && event.target.closest('button'))) return; const bounds = menuElement.current?.getBoundingClientRect(); if (!bounds) return; menuDrag.current = { x: event.clientX, y: event.clientY, left: bounds.left, top: bounds.top }; event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault() }} onPointerMove={event => { const drag = menuDrag.current, element = menuElement.current; if (!drag || !element) return; menuMoved.current = true; element.style.left = `${Math.max(0, Math.min(window.innerWidth - element.offsetWidth, drag.left + event.clientX - drag.x))}px`; element.style.top = `${Math.max(0, Math.min(window.innerHeight - 80, drag.top + event.clientY - drag.y))}px` }} onPointerUp={() => { menuDrag.current = null }} onPointerCancel={() => { menuDrag.current = null }}><strong className="text-base">Text settings</strong><button type="button" aria-label="Close text settings" className="rounded px-2 text-lg hover:bg-gray-100" onClick={close}>×</button></div>
      <details className="order-4 mt-3 border-t border-gray-200 pt-2"><summary className="cursor-pointer text-xs">More actions</summary>
      <button type="button" className="mt-2 block w-full rounded border border-gray-400 px-2 py-1 text-left" onClick={() => { close(); document.querySelector<HTMLButtonElement>('[aria-label="Expand right panel"]')?.click(); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[data-properties-tab]')?.click()) }}>Block properties</button>
      {(onDeleteBox || position) && <button type="button" className="mt-2 block w-full rounded border border-gray-400 px-2 py-1 text-left" onClick={() => { menuActive.current = false; dirty.current = false; setMenu(null); if (onDeleteBox) onDeleteBox(); else useConfigStore.getState().updateBlockProps(blockId, { [`${field}Hidden`]: true }) }}>Delete text box</button>}
      <div className="mt-2 flex flex-wrap gap-1">
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
      </details>
      {clipboardError && <p role="status" className="mb-2 text-xs">{clipboardError}</p>}
      <div className="order-2 mt-4 flex flex-wrap gap-1 border-t border-gray-200 pt-3" aria-label="Paragraph alignment">
        {(['left', 'center', 'right', 'justify'] as const).map(align => <button key={align} type="button" aria-label={`Align ${align}`} disabled={!savedRange.current || savedRange.current.collapsed} className="rounded border border-gray-400 px-2 py-1 capitalize disabled:opacity-40" onMouseDown={event => event.preventDefault()} onClick={() => {
          apply({ textAlign: align, display: 'block' }); setMenu({ ...menu })
        }}>{align}</button>)}
      </div>
      {multiline && <div className="order-3 mt-3 border-t border-gray-200 pt-3"><button type="button" aria-label="Add bullets" disabled={!savedRange.current} className="rounded border border-gray-400 px-3 py-1 disabled:opacity-40" onMouseDown={event => event.preventDefault()} onClick={() => {
        if (!root.current || !savedRange.current || !root.current.contains(savedRange.current.commonAncestorContainer)) return
        const range = savedRange.current
        if (range.collapsed) return
        const fragment = range.extractContents()
        const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
        let startOfLine = true
        let node: Node | null
        while ((node = walker.nextNode())) {
          if (node instanceof HTMLElement && node.tagName === 'BR') { startOfLine = true; continue }
          if (node instanceof HTMLElement && ['DIV', 'P', 'LI'].includes(node.tagName)) { startOfLine = true; continue }
          if (node.nodeType !== Node.TEXT_NODE || !node.textContent) continue
          const original = node.textContent
          let updated = ''
          for (let i = 0; i < original.length; i++) {
            const character = original[i]
            if (startOfLine && character !== '\n') { if (character !== '•') updated += '• '; startOfLine = false }
            updated += character
            if (character === '\n') startOfLine = true
          }
          node.textContent = updated
        }
        range.insertNode(fragment); dirty.current = true; close()
      }}>• Bullets</button></div>}
      {!savedRange.current || savedRange.current.collapsed ? <p className="order-1 mb-2 text-xs">Select text to format it.</p> : <div className="order-1">
        {window.location.origin === 'https://webstudio.local' ? <label className="mb-3 block text-xs text-gray-700">Font<button type="button" aria-label="Choose Windows font" className="mt-1 w-full rounded border border-gray-400 p-2 text-left text-sm text-black" onMouseDown={event => event.preventDefault()} onClick={async () => {
          const node = savedRange.current?.startContainer
          const element = node instanceof Element ? node : node?.parentElement
          if (!element) return
          const style = getComputedStyle(element)
          const rgb = style.color.match(/\d+/g)?.slice(0, 3).map(value => Math.min(255, Number(value)).toString(16).padStart(2, '0')).join('')
          try {
            const result = await chooseWindowsFont({ font: style.fontFamily.split(',')[0].replace(/["']/g, '').trim().replace(/[^\p{L}\p{N} ,._-]/gu, '') || 'Arial', size: Math.max(6, Math.min(200, Math.round(parseFloat(style.fontSize) || 16))), color: rgb?.length === 6 ? `#${rgb}` : '#000000', bold: style.fontWeight === 'bold' || Number(style.fontWeight) >= 600, italic: style.fontStyle === 'italic', underline: style.textDecorationLine.includes('underline') })
            if (result) { apply({ fontFamily: result.font, fontSize: `${result.size}px`, color: result.color, fontWeight: result.bold ? 'bold' : 'normal', fontStyle: result.italic ? 'italic' : 'normal', textDecoration: result.underline ? 'underline' : 'none' }); setMenu({ ...menu }) }
          } catch { setClipboardError('The Windows font dialog could not be opened.') }
        }}>{selectedFont || 'Choose font'}…</button></label> : <label className="mb-3 block text-xs text-gray-700">Font<select aria-label="Text font" defaultValue={selectedFont} className="mt-1 w-full rounded border border-gray-400 p-2 text-sm text-black" onChange={event => { if (event.target.value) apply({ fontFamily: event.target.value }) }}><option value="">Choose font</option>{selectedFont && !['Arial', 'Calibri', 'Georgia', 'Tahoma', 'Times New Roman', 'Verdana'].includes(selectedFont) && <option value={selectedFont}>{selectedFont}</option>}{['Arial', 'Calibri', 'Georgia', 'Tahoma', 'Times New Roman', 'Verdana'].map(font => <option key={font}>{font}</option>)}</select></label>}
        <label className="mb-3 block text-xs text-gray-700">Font size (px)<input key={selectedSize} aria-label="Text font size" type="number" min="6" max="200" defaultValue={selectedSize} className="mt-1 w-full rounded border border-gray-400 p-2 text-sm text-black" onChange={event => { const size = Number(event.target.value); if (size >= 6 && size <= 200) apply({ fontSize: `${size}px` }) }} /></label>
        <div className="mb-2 flex items-center justify-between text-xs">Text color<WindowsColorInput label="Text color" value={selectedColor} onChange={value => { apply({ color: value }); setMenu({ ...menu }) }} className="h-7 w-10 rounded border border-gray-400" /></div>
        <div className="flex gap-2"><button type="button" className="rounded border border-gray-400 px-2 py-1 font-bold" onMouseDown={event => event.preventDefault()} onClick={() => { apply({ fontWeight: selectedStyle && (selectedStyle.fontWeight === 'bold' || Number(selectedStyle.fontWeight) >= 600) ? 'normal' : 'bold' }); setMenu({ ...menu }) }}>Bold</button><button type="button" className="rounded border border-gray-400 px-2 py-1 italic" onMouseDown={event => event.preventDefault()} onClick={() => { apply({ fontStyle: selectedStyle?.fontStyle === 'italic' ? 'normal' : 'italic' }); setMenu({ ...menu }) }}>Italic</button><button type="button" className="rounded border border-gray-400 px-2 py-1 underline" onMouseDown={event => event.preventDefault()} onClick={() => { apply({ textDecoration: selectedStyle?.textDecorationLine.includes('underline') ? 'none' : 'underline' }); setMenu({ ...menu }) }}>Underline</button></div>
      </div>}
      <button type="button" className="order-5 mt-3 self-end rounded border border-gray-400 px-3 py-1" onClick={close}>Done</button>
    </div>, document.body)}
  </>
}
