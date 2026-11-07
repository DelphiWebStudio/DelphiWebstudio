import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'

export function SelectionToolbar() {
  const selection = useEditorStore(state => state.selectedSectionObjects)
  const config = useConfigStore(state => state.config)
  const pageId = useConfigStore(state => state.activePageId)
  if (!selection.length) return null
  const sameSection = selection.every(value => value.blockId === selection[0].blockId && value.section === selection[0].section)
  const block = (config.pages?.find(page => page.id === pageId)?.blocks ?? config.blocks).find(value => value.id === selection[0].blockId)
  if (!block) return null
  const key = `section${selection[0].section}Objects`
  const rawItems = (Array.isArray(block.props[key]) ? block.props[key] : []) as { id: string; parentId?: string; type: string; x: number; y: number; width: number; height: number; layer: number }[]
  const items = rawItems.map(item => ({ ...item, x: Number(item.x) || 0, y: Number(item.y) || 0, width: Number(item.width) || 30, height: Number(item.height) || 80, layer: Number(item.layer) || 1 }))
  const chosen = items.filter(item => selection.some(value => value.id === item.id))
  if (!chosen.length) return null
  const align = (direction: string) => {
    const left = Math.min(...chosen.map(item => item.x)), right = Math.max(...chosen.map(item => item.x + item.width))
    const top = Math.min(...chosen.map(item => item.y)), bottom = Math.max(...chosen.map(item => item.y + item.height))
    const sorted = [...chosen].sort((a, b) => a.x - b.x)
    const gap = (right - left - chosen.reduce((sum, item) => sum + item.width, 0)) / Math.max(1, chosen.length - 1)
    const aligned = items.map(item => {
      if (!chosen.includes(item)) return item
      if (direction === 'Left') return { ...item, x: left }
      if (direction === 'Center') return { ...item, x: (left + right - item.width) / 2 }
      if (direction === 'Right') return { ...item, x: right - item.width }
      if (direction === 'Top') return { ...item, y: top }
      if (direction === 'Bottom') return { ...item, y: bottom - item.height }
      return { ...item, x: left + sorted.slice(0, sorted.indexOf(item)).reduce((sum, previous) => sum + previous.width + gap, 0) }
    })
    useConfigStore.getState().updateBlockProps(block.id, { [key]: aligned.map(item => {
      if (!item.parentId || chosen.some(value => value.id === item.id)) return item
      const previous = chosen.find(value => value.id === item.parentId && value.type === 'panel')
      const parent = aligned.find(value => value.id === item.parentId)
      return previous && parent ? { ...item, x: item.x + parent.x - previous.x, y: item.y + parent.y - previous.y } : item
    }) })
  }
  return <div className="studio-toolbar flex flex-wrap items-center gap-1 border-b border-border-default bg-bg-2 px-3 py-1" aria-label="Selected object tools"><strong className="mr-3 text-xs">{chosen.length > 1 ? `${selection.length} objects` : `${chosen[0].type.charAt(0).toUpperCase() + chosen[0].type.slice(1)} selected`}</strong>
    {['Left', 'Center', 'Right', 'Top', 'Bottom', 'Distribute'].map(direction => <button key={direction} type="button" disabled={!sameSection || chosen.length < (direction === 'Distribute' ? 3 : 2)} title={`${direction} selected objects in this section`} className="rounded border border-border-default px-2 disabled:opacity-40 hover:bg-bg-3" onClick={() => align(direction)}>{direction}</button>)}
    <button type="button" className="ml-2 rounded border border-border-default px-2" disabled={!sameSection} onClick={() => {
      const moved = items.filter(item => chosen.includes(item) || chosen.some(parent => parent.type === 'panel' && parent.id === item.parentId)).sort((a, b) => (a.parentId === b.id ? 1 : b.parentId === a.id ? -1 : a.layer - b.layer))
      const top = Math.max(...items.map(value => value.layer || 1)) + 1
      useConfigStore.getState().updateBlockProps(block.id, { [key]: items.map(item => moved.includes(item) ? { ...item, layer: top + moved.indexOf(item) } : item) })
    }}>Bring to front</button>
    <button type="button" className="rounded border border-border-default px-2" onClick={() => window.dispatchEvent(new Event('webstudio.properties'))}>Properties</button>
    <button type="button" className="rounded border border-border-default px-2" disabled={chosen.length !== 1 || !sameSection} onClick={() => {
      const original = chosen[0], id = `object-${crypto.randomUUID()}`, offsetX = Math.min(2, Math.max(0, 100 - original.x - original.width))
      const sources = [original, ...items.filter(item => item.parentId === original.id)]
      const copies = sources.map(item => ({ ...structuredClone(item), id: item.id === original.id ? id : `object-${crypto.randomUUID()}`, ...(item.parentId === original.id ? { parentId: id } : {}), x: item.x + offsetX, y: item.y + 12, layer: Math.max(...items.map(value => value.layer || 1)) + 1 + item.layer }))
      const changes: Record<string, unknown> = { [key]: [...items, ...copies] }
      sources.forEach((source, index) => { for (const suffix of ['', 'Rich']) { const previousKey = `sectionObject_${source.id}${suffix}`; if (block.props[previousKey] !== undefined) changes[`sectionObject_${copies[index].id}${suffix}`] = structuredClone(block.props[previousKey]) } })
      useConfigStore.getState().updateBlockProps(block.id, changes)
      useEditorStore.getState().selectSectionObject({ blockId: block.id, section: selection[0].section, id })
    }}>Duplicate</button>
    <button type="button" className="rounded border border-border-default px-2" disabled={!sameSection} onClick={() => { useConfigStore.getState().updateBlockProps(block.id, { [key]: items.filter(item => !chosen.includes(item) && !chosen.some(parent => parent.type === 'panel' && parent.id === item.parentId)) }); useEditorStore.getState().setSectionObjects([]) }}>Delete</button>
  </div>
}
