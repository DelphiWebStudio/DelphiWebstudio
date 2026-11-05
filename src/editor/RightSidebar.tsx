import { useEffect, useRef, useState } from 'react'
import { MousePointer2 } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'
import { useConfigStore } from '@/store/configStore'
import { PropertiesPanel } from './PropertiesPanel'
import { DesignPanel } from './DesignPanel'

type Tab = 'properties' | 'design'

export function RightSidebar({ collapsed = false, onClose }: { collapsed?: boolean; onClose?: () => void }) {
  const selectedBlockId = useEditorStore((s) => s.selectedBlockId)
  const selectedObject = useEditorStore((s) => s.selectedSectionObject)
  const scrollRef = useRef<HTMLDivElement>(null)
  const windowRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const mode = useEditorStore((s) => s.mode)
  const blocks = useConfigStore((s) => {
    const pages = s.config.pages
    if (!pages || pages.length === 0) return s.config.blocks
    const page = pages.find((p) => p.id === s.activePageId) ?? pages[0]
    return page.blocks
  })
  const selectedBlock = blocks.find((b) => b.id === selectedBlockId)
  const objectKey = selectedObject ? `${selectedObject.blockId}:${selectedObject.section}:${selectedObject.id}` : ''
  const [selection, setSelection] = useState<{ blockId: string | null; objectKey: string; tab: Tab }>({
    blockId: null, objectKey: '', tab: mode === 'designer' ? 'design' : 'properties',
  })
  if (selection.blockId !== selectedBlockId || selection.objectKey !== objectKey) {
    setSelection({ blockId: selectedBlockId, objectKey, tab: selectedBlock ? 'properties' : selection.tab })
  }
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0 }, [selectedBlockId, objectKey])
  const activeTab = selectedBlock && (selection.blockId !== selectedBlock.id || selection.objectKey !== objectKey)
    ? 'properties'
    : selection.tab

  return (
    <div ref={windowRef} id="editor-right-panel" role="dialog" aria-label="Editor settings" aria-modal="false" className={collapsed ? 'hidden' : 'fixed z-[100] flex flex-col rounded-lg border border-border-default bg-bg-1 shadow-2xl'} style={{ width: 'min(360px, calc(100vw - 24px))', maxHeight: `min(720px, calc(100vh - ${position?.top ?? 72}px - 16px))`, left: position?.left, right: position ? undefined : 16, top: position?.top ?? 72 }}>
      <div className="flex shrink-0 items-center justify-between rounded-t-lg border-b border-border-default bg-bg-2 px-3 py-2" style={{ cursor: 'move', touchAction: 'none' }} title="Drag to move the settings window" onPointerDown={event => {
        if (event.button !== 0 || (event.target instanceof Element && event.target.closest('button'))) return
        const rect = windowRef.current?.getBoundingClientRect(); if (!rect) return
        dragRef.current = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top }
        event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault()
      }} onPointerMove={event => {
        const drag = dragRef.current; const rect = windowRef.current?.getBoundingClientRect(); if (!drag || !rect) return
        setPosition({ left: Math.max(0, Math.min(window.innerWidth - rect.width, drag.left + event.clientX - drag.x)), top: Math.max(0, Math.min(window.innerHeight - 160, drag.top + event.clientY - drag.y)) })
      }} onPointerUp={() => { dragRef.current = null }} onPointerCancel={() => { dragRef.current = null }}>
        <span className="text-xs font-semibold text-text-0">{activeTab === 'design' ? 'Site design' : selectedObject ? 'Object settings' : selectedBlock ? `${selectedBlock.type} settings` : 'Settings'}</span>
        <button type="button" aria-label="Close settings" onClick={onClose} className="rounded px-2 py-1 text-base text-text-1 hover:bg-bg-3">×</button>
      </div>
      {/* Tabs */}
      <div className="flex border-b border-border-default shrink-0">
        <button
          data-properties-tab
          onClick={() => setSelection({ blockId: selectedBlockId, objectKey, tab: 'properties' })}
          className={`flex-1 py-2 text-[11px] font-medium transition-colors ${
            activeTab === 'properties'
              ? 'text-text-0 border-b border-green'
              : 'text-text-3 hover:text-text-1'
          }`}
        >
          Properties
        </button>
        <button
          onClick={() => setSelection({ blockId: selectedBlockId, objectKey, tab: 'design' })}
          className={`flex-1 py-2 text-[11px] font-medium transition-colors ${
            activeTab === 'design'
              ? 'text-text-0 border-b border-green'
              : 'text-text-3 hover:text-text-1'
          }`}
        >
          Site design
        </button>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {activeTab === 'design' ? (
          <DesignPanel />
        ) : selectedBlock ? (
          <>
            <PropertiesPanel block={selectedBlock} />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-center px-6 py-16 gap-3">
            <div className="w-10 h-10 rounded-lg bg-bg-3 border border-border-default flex items-center justify-center">
              <MousePointer2 size={16} className="text-text-3" />
            </div>
            <div>
              <p className="text-text-1 text-[12px] font-medium">Click a block to edit</p>
              <p className="text-text-3 text-[11px] mt-1">Select any block on the canvas to see its properties here</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
