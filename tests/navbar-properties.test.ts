import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PropertiesPanel } from '../src/editor/PropertiesPanel'

describe('Navbar link properties', () => {
  it('shows a compact list and keeps link fields collapsed until selected', () => {
    const block = { id: 'navbar-test', type: 'navbar' as const, variant: 'default', props: { navItems: [
      { label: 'Home', url: '/' },
      { label: 'Weekly Bulletin', url: '/bulletin' },
      { label: 'Happenings', url: '/happenings' },
    ] } }
    const html = renderToStaticMarkup(createElement(PropertiesPanel, { block }))
    expect(html).toContain('Navigation Links (3)')
    expect(html).toContain('Weekly Bulletin')
    expect(html).toContain('Happenings')
    expect(html).toContain('Drag link 2')
    expect(html).toContain('+ Add link')
    expect(html).not.toContain('Link 1 destination')
  })
})
