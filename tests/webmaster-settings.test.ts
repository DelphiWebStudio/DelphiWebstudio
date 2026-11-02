import { describe, expect, it } from 'vitest'
import { exportSiteToHTML } from '../src/lib/export-html'
import { checkSite } from '../src/project/site-checks'
import { createProjectFile, serializeProjectFile, parseProjectFile } from '../src/project/project-file'
import type { SiteConfig } from '../src/blocks/types'

describe('project webmaster email', () => {
  it('persists the email in the saved project file', () => {
    const project = createProjectFile({ name: 'Site', blocks: [] }, 'project')
    project.settings = { webmasterEmail: 'admin@example.test' }
    expect(parseProjectFile(serializeProjectFile(project)).project.settings?.webmasterEmail).toBe('admin@example.test')
  })
  it('defaults contact forms to the project email while preserving form overrides and services', () => {
    const config: SiteConfig = { name: 'Site', blocks: [
      { id: 'default', type: 'contact', variant: 'form', props: {} },
      { id: 'override', type: 'contact', variant: 'form', props: { recipientEmail: 'other@example.test' } },
      { id: 'service', type: 'contact', variant: 'form', props: { formEndpoint: 'https://forms.example.test/submit' } },
    ] }
    const html = exportSiteToHTML(config, { settings: { webmasterEmail: 'admin@example.test' } })
    expect(html).toContain('data-contact-email="admin@example.test"')
    expect(html).toContain('data-contact-email="other@example.test"')
    expect(html).toContain('https://forms.example.test/submit')
    expect(config.blocks[0].props.recipientEmail).toBeUndefined()
    expect(checkSite(config, { webmasterEmail: 'admin@example.test' }).some(issue => issue.blockId === 'default')).toBe(false)
    expect(checkSite(config).some(issue => issue.blockId === 'default')).toBe(true)
  })
})
