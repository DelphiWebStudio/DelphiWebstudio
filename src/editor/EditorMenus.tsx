import { toast } from 'sonner'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'

/** Standard desktop commands share the editor's existing actions. */
export function EditorMenus() {
  const root = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const codeOpen = useEditorStore(state => state.jsonDrawerOpen)
  useEffect(() => {
    const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) root.current?.querySelectorAll('details[open]').forEach(item => item.removeAttribute('open')) }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [])
  const command = (name: string) => document.querySelector<HTMLButtonElement>(`[data-project-command="${name}"]`)?.click()
  const panel = (tab: string) => tab === 'media' ? window.dispatchEvent(new Event('webstudio.media')) : window.dispatchEvent(new CustomEvent('webstudio.panel', { detail: tab }))
  const place = (kind: 'text' | 'panel' | 'divider') => { const editor = useEditorStore.getState(); editor.setTextPlacement({ projectId: editor.activeProjectId, pageId: useConfigStore.getState().activePageId, kind }) }
  const menus: { name: string; items: { label: string; key?: string; action: () => void }[] }[] = [
    { name: 'File', items: [{ label: 'New project…', action: () => navigate('/') }, { label: 'Open project…', key: 'Ctrl+O', action: () => command('open') }, { label: 'Save', key: 'Ctrl+S', action: () => command('save') }, { label: 'Save as…', key: 'Ctrl+Shift+S', action: () => command('save-as') }, { label: 'Recent projects', action: () => navigate('/') }, { label: 'Export website…', action: () => navigate('/deploy') }] },
    { name: 'Edit', items: [{ label: 'Undo', key: 'Ctrl+Z', action: () => useConfigStore.getState().undo() }, { label: 'Redo', key: 'Ctrl+Y', action: () => useConfigStore.getState().redo() }, { label: 'Cut', key: 'Ctrl+X', action: () => { if (!document.execCommand('cut')) toast('Select text and use Ctrl+X, or use the object context menu.') } }, { label: 'Copy', key: 'Ctrl+C', action: () => { if (!document.execCommand('copy')) toast('Select text or an object and use Ctrl+C.') } }, { label: 'Paste', key: 'Ctrl+V', action: () => { if (!document.execCommand('paste')) toast('Use Ctrl+V to paste at the current text cursor.') } }, { label: 'Layers and selection', action: () => panel('layers') }] },
    { name: 'Insert', items: [{ label: 'Text', action: () => place('text') }, { label: 'Image, video or document…', action: () => panel('media') }, { label: 'Panel', action: () => place('panel') }, { label: 'Line', action: () => place('divider') }, { label: 'More elements…', action: () => panel('components') }] },
    { name: 'View', items: [{ label: 'Elements', action: () => panel('components') }, { label: 'Layers', action: () => panel('layers') }, { label: 'Media library', action: () => panel('media') }, { label: 'Preview', key: 'P', action: () => useEditorStore.getState().togglePreview() }, { label: 'Keyboard shortcuts', key: '?', action: () => useEditorStore.getState().toggleShortcutsModal() }] },
    { name: 'Advanced', items: [{ label: 'Import HTML folder…', action: () => command('import-html') }, { label: 'Import WordPress content…', action: () => command('import-wordpress') }, { label: 'Project JSON', action: () => useEditorStore.getState().toggleJsonDrawer() }, { label: 'Undo history', action: () => useEditorStore.getState().toggleHistory() }] },
  ]
  return <div ref={root} className="studio-menu-bar" role="menubar" aria-label="Editor commands" onKeyDown={event => {
    if (event.key === 'Escape') { root.current?.querySelectorAll('details[open]').forEach(item => item.removeAttribute('open')); (event.target as HTMLElement).closest('details')?.querySelector('summary')?.focus() }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { const menu = (event.target as HTMLElement).closest('details'); const items = Array.from(menu?.querySelectorAll<HTMLButtonElement>('button') ?? []); if (items.length) { event.preventDefault(); const current = items.indexOf(document.activeElement as HTMLButtonElement); items[(current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus() } }
  }}>{menus.map(menu => <details key={menu.name} onToggle={event => { if (event.currentTarget.open) root.current?.querySelectorAll('details[open]').forEach(item => { if (item !== event.currentTarget) item.removeAttribute('open') }) }}><summary data-editor-menu={menu.name} onMouseDown={event => event.preventDefault()}>{menu.name}</summary><div role="menu" aria-label={menu.name}>{menu.items.map(item => <button key={item.label} type="button" role="menuitem" {...(item.label === 'Project JSON' ? { 'aria-controls': 'editor-code-panel', 'aria-expanded': codeOpen } : {})} onMouseDown={event => event.preventDefault()} onClick={event => { item.action(); (event.currentTarget.closest('details') as HTMLDetailsElement).open = false }}><span>{item.label}</span><kbd>{item.key}</kbd></button>)}</div></details>)}</div>
}
