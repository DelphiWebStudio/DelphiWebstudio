import { UserRound } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { BlockConfig } from '../types'
import { connectStaffBiographies } from './staff-biographies.js'

interface TeamMember {
  name: string
  role: string
  avatar?: string
  bio?: string
}

interface TeamProps {
  title?: string
  subtitle?: string
  members?: TeamMember[]
}

export function TeamBlock({ block }: { block: BlockConfig }) {
  const props = block.props as unknown as TeamProps
  const members = props.members
  const directory = useRef<HTMLElement>(null)
  useEffect(() => {
    if (block.variant === 'directory' && directory.current) return connectStaffBiographies(directory.current)
  }, [block.variant, members])

  if (block.variant === 'directory') {
    const title = props.title || 'Staff Directory'
    return <section ref={directory} data-ws-staff-directory aria-label={title} className="px-5 py-12 @md:px-8 @md:py-16">
      <header className="mx-auto mb-9 max-w-2xl text-center">
        <span aria-hidden="true" className="mx-auto mb-4 block h-1 w-12 rounded-full bg-green" />
        <h2 className="font-serif text-3xl font-semibold tracking-tight text-text-0 @md:text-4xl">{title}</h2>
        {props.subtitle && <p className="mt-3 text-base leading-relaxed text-text-3">{props.subtitle}</p>}
      </header>
      <ul className="mx-auto grid max-w-6xl list-none grid-cols-1 gap-5 p-0 @md:grid-cols-2 @4xl:grid-cols-3">
        {members?.map((member, i) => (
          <li key={i} data-ws-item-field="members" data-ws-item-index={i}
            className="min-w-0 rounded-xl border border-border-default bg-bg-2 p-5 text-center">
            <div className="mx-auto mb-4 flex aspect-[4/5] w-full max-w-[11rem] items-center justify-center overflow-hidden rounded-lg border border-green/40 bg-green/10">
              {member.avatar
                ? <img src={member.avatar} alt={member.name?.trim() ? `Portrait of ${member.name.trim()}` : 'Staff portrait'} loading="lazy" decoding="async" className="h-full w-full object-cover object-top" />
                : <UserRound size={52} strokeWidth={1.2} aria-hidden="true" className="text-text-3" />}
            </div>
            <h3 className="text-lg font-semibold text-text-0">{member.name?.trim() || `Staff member ${i + 1}`}</h3>
            {member.role && <p className="mt-1 text-sm font-medium text-text-3">{member.role}</p>}
            {member.bio?.trim() && <div className="mt-3 text-left text-sm leading-relaxed text-text-0">
              <p data-ws-staff-bio className="line-clamp-2 whitespace-pre-wrap [overflow-wrap:anywhere]">{member.bio}</p>
              <button type="button" hidden aria-haspopup="dialog"
                data-ws-staff-bio-trigger={member.name?.trim() || `Staff member ${i + 1}`}
                className="mt-2 cursor-pointer text-left font-semibold underline underline-offset-2">
                Read the complete biography
              </button>
            </div>}
          </li>
        ))}
      </ul>
      <dialog data-ws-staff-bio-dialog aria-label="Biography"
        className="m-auto max-h-[75dvh] w-[min(32rem,calc(100%_-_2rem))] max-w-none grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl border border-slate-300 bg-white text-slate-900 shadow-xl open:grid backdrop:bg-slate-950/60 [color-scheme:light]">
        <form method="dialog" className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3">
          <h2 data-ws-staff-bio-name className="min-w-0 text-lg font-semibold [overflow-wrap:anywhere]" />
          <button type="submit" autoFocus className="shrink-0 rounded border border-slate-300 px-2.5 py-1 text-sm font-medium hover:bg-slate-100">Close</button>
        </form>
        <div data-ws-staff-bio-text tabIndex={0} aria-label="Biography text"
          className="min-h-0 overflow-y-auto overscroll-contain whitespace-pre-wrap px-4 py-4 text-base leading-relaxed [overflow-wrap:anywhere]" />
      </dialog>
    </section>
  }

  return (
    <section className="px-6 @md:px-10 py-16 @md:py-20">
      <div className="reveal-fade-up reveal-d1 text-center mb-10">
        <h2 className="text-2xl @md:text-3xl font-bold tracking-tight mb-2">
          {props.title || 'Meet the Team'}
        </h2>
        {props.subtitle && (
          <p className="text-text-2 text-sm max-w-lg mx-auto">{props.subtitle}</p>
        )}
      </div>

      <div className="grid grid-cols-2 @2xl:grid-cols-4 gap-4 max-w-3xl mx-auto">
        {members?.map((member, i) => (
          <div key={i} data-ws-item-field="members" data-ws-item-index={i} className={`reveal-fade-up reveal-d${Math.min(i + 2, 8)} text-center group`}>
            {member.avatar ? <img src={member.avatar} alt={member.name} className="w-20 h-20 mx-auto rounded-full object-cover border-2 border-border-default mb-3 transition-all group-hover:border-green/30" /> : <div className="w-20 h-20 mx-auto rounded-full bg-bg-3 border-2 border-border-default flex items-center justify-center text-xl font-bold text-text-3 mb-3 transition-all group-hover:border-green/30 group-hover:accent-glow-sm">
              {member.name.split(' ').map(n => n[0]).join('')}
            </div>}
            <h3 className="text-sm font-semibold">{member.name}</h3>
            <p className="text-[11px] text-text-3 mt-0.5">{member.role}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
