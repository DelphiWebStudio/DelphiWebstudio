import { beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from '../src/store/editorStore'

describe('section object selection', () => {
  beforeEach(() => {
    useEditorStore.getState().selectBlock(null)
    useEditorStore.getState().selectSectionObject(null)
    useEditorStore.getState().setSelectionPreference('parent')
  })

  it('selects, toggles and clears individual objects without losing the remaining selection', () => {
    const editor = useEditorStore.getState()
    const first = { blockId: 'block', section: 1, id: 'first' }
    const second = { blockId: 'block', section: 1, id: 'second' }
    editor.selectBlock('block')
    editor.selectSectionObject(first)
    editor.toggleSectionObject(second)
    expect(useEditorStore.getState().selectedSectionObjects).toEqual([first, second])
    editor.toggleSectionObject(first)
    expect(useEditorStore.getState().selectedSectionObject).toEqual(second)
    editor.selectBlock('other')
    expect(useEditorStore.getState().selectedSectionObjects).toEqual([])
  })

  it('clears multi-selection when a different kind of object is selected', () => {
    const editor = useEditorStore.getState()
    editor.setSectionObjects([{ blockId: 'block', section: 1, id: 'first' }, { blockId: 'block', section: 1, id: 'second' }])
    editor.selectPlacedMedia({ blockId: 'block', id: 'image' })
    expect(useEditorStore.getState().selectedSectionObjects).toEqual([])
    expect(useEditorStore.getState().selectedSectionObject).toBeNull()
  })

  it('keeps objects selected across blocks and sections', () => {
    const editor = useEditorStore.getState()
    const first = { blockId: 'one', section: 1, id: 'first' }
    const second = { blockId: 'two', section: 2, id: 'second' }
    editor.selectBlock('one')
    editor.selectSectionObject(first)
    editor.toggleSectionObject(second)
    expect(useEditorStore.getState().selectedSectionObjects).toEqual([first, second])
    editor.toggleSectionObject(first)
    expect(useEditorStore.getState().selectedSectionObjects).toEqual([second])
  })
})
