import { useState } from 'react'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'
import type { MediaAsset } from '@/media/media-library'
import type { BlockConfig } from '../types'

export function DocumentLibraryBlock({ block, editable = false }: { block: BlockConfig; editable?: boolean }) {
  const [query, setQuery] = useState('')
  const weekly = block.variant === 'weekly-bulletins'
  const title = typeof block.props.title === 'string' && block.props.title ? block.props.title : weekly ? 'Weekly Bulletin' : 'Documents'
  const items = Array.isArray(block.props.items) ? block.props.items : []
  if (weekly) {
    const recent = items.map((item, index) => ({ item, index })).filter(({ item }) =>
      typeof item?.src === 'string' && (/^assets\/[a-z0-9._-]+\.pdf$/i.test(item.src) || item.src.startsWith('blob:'))).slice(0, 5)
    return <section data-weekly-bulletins className="px-5 py-10 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold">{title}</h1>
          {editable && <button type="button" className="rounded border border-blue-700 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50" onClick={() => {
            const projectId = useEditorStore.getState().activeProjectId
            window.dispatchEvent(new CustomEvent('webstudio.media', { detail: { accept: 'application/pdf', onSelect: (asset: MediaAsset) => {
              if (useEditorStore.getState().activeProjectId !== projectId || asset.mime !== 'application/pdf') return
              const config = useConfigStore.getState()
              const savedBlock = config.getActivePageBlocks().find(candidate => candidate.id === block.id)
              if (!savedBlock) return
              const saved = Array.isArray(savedBlock.props.items) ? savedBlock.props.items : []
              const existing = saved.find(item => item?.assetId === asset.id || item?.src === asset.path)
              if (existing && existing === saved[0]) return
              const bulletin = { title: asset.name.replace(/\.pdf$/i, ''), description: '', ...existing, src: asset.path, assetId: asset.id }
              config.updateBlockProps(block.id, { items: [bulletin, ...saved.filter(item => item !== existing)] })
            } } }))
          }}>Add bulletin PDF</button>}
        </div>
        {recent.length === 0 ? <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-slate-700">No bulletins have been posted yet.</p> : <ul className="space-y-2">
          {recent.map(({ item, index }, position) => {
            const label = typeof item.title === 'string' && item.title.trim() ? item.title : 'Open bulletin'
            return <li key={index} data-ws-item-field="items" data-ws-item-index={index} className={position === 0 ? 'rounded-lg border border-blue-300 bg-blue-50 p-4' : 'rounded-lg border border-slate-200 px-4 py-3'}>
              {position === 0 && <p className="mb-1 text-sm font-semibold text-blue-900">Current bulletin</p>}
              <a href={item.src} target="_blank" rel="noopener" download={item.src.startsWith('blob:') ? `${label.replace(/\.pdf$/i, '')}.pdf` : undefined} className="break-words font-medium text-blue-800 underline">{label} <span className="text-sm">(PDF)</span></a>
              {typeof item.description === 'string' && item.description && <p className="mt-1 text-sm text-slate-700">{item.description}</p>}
            </li>
          })}
        </ul>}
        {editable && <p className="mt-4 text-sm text-slate-700">The first PDF is the current bulletin. Add the newest one last, or reorder the entries in Properties.</p>}
      </div>
    </section>
  }
  const visible = items.filter(item => item && typeof item === 'object' && !Array.isArray(item) && `${typeof item.title === 'string' ? item.title : ''} ${typeof item.description === 'string' ? item.description : ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  return <section className="p-6" data-document-library>
    <h2 className="text-xl font-semibold mb-3">{title}</h2>
    <label className="block text-sm mb-3">Search documents <input type="search" aria-label={`Search ${title}`} data-library-search value={query} onChange={event => setQuery(event.target.value)} className="ml-2 rounded border border-border-default bg-bg-2 px-2 py-1" /></label>
    <ul className="space-y-3">{visible.map((item, index) => <li key={index} data-library-item data-ws-item-field="items" data-ws-item-index={items.indexOf(item)} className="rounded border border-border-default p-3">
      {typeof item.src === 'string' && item.src ? <a className="text-green underline" href={item.src} download>{typeof item.title === 'string' && item.title ? item.title : 'Open document'}</a> : <span>{typeof item.title === 'string' && item.title ? item.title : 'Choose a document'}</span>}
      {typeof item.description === 'string' && item.description && <p className="text-sm mt-1">{item.description}</p>}
    </li>)}</ul>
  </section>
}
