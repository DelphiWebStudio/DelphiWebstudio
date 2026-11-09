export function connectStaffBiographies(directory) {
  const dialog = directory.querySelector('[data-ws-staff-bio-dialog]')
  const heading = dialog.querySelector('[data-ws-staff-bio-name]')
  const body = dialog.querySelector('[data-ws-staff-bio-text]')
  const bios = directory.querySelectorAll('[data-ws-staff-bio]')
  let opener = null

  function updateTriggers() {
    for (const bio of bios) {
      bio.nextElementSibling.hidden = bio.scrollHeight <= bio.clientHeight
    }
  }

  const observer = new ResizeObserver(updateTriggers)
  for (const bio of bios) observer.observe(bio)
  document.fonts.addEventListener('loadingdone', updateTriggers)
  updateTriggers()

  function openBiography(event) {
    if (!(event.target instanceof Element)) return
    if (dialog.contains(event.target)) {
      event.stopPropagation()
      return
    }
    const trigger = event.target.closest('[data-ws-staff-bio-trigger]')
    if (!trigger || trigger.hidden || dialog.open) return
    event.stopPropagation()
    opener = trigger
    const name = trigger.dataset.wsStaffBioTrigger
    heading.textContent = name
    body.textContent = trigger.previousElementSibling.textContent
    dialog.setAttribute('aria-label', `${name} biography`)
    trigger.focus({ preventScroll: true })
    dialog.showModal()
    body.scrollTop = 0
  }

  function closeOnEscape(event) {
    if (event.key !== 'Escape' || !dialog.open) return
    event.preventDefault()
    event.stopPropagation()
    dialog.close()
  }

  function returnFocus() {
    opener?.focus({ preventScroll: true })
    opener = null
  }

  directory.addEventListener('click', openBiography)
  dialog.addEventListener('keydown', closeOnEscape)
  dialog.addEventListener('close', returnFocus)
  return () => {
    observer.disconnect()
    document.fonts.removeEventListener('loadingdone', updateTriggers)
    directory.removeEventListener('click', openBiography)
    dialog.removeEventListener('keydown', closeOnEscape)
    dialog.removeEventListener('close', returnFocus)
    if (dialog.open) dialog.close()
  }
}
