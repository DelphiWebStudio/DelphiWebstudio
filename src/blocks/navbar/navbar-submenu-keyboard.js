document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || event.defaultPrevented) return

  for (const submenu of document.querySelectorAll('[data-ws-navbar-submenu]')) {
    if (typeof submenu.hidePopover !== 'function' || !submenu.matches(':popover-open')) continue
    const arrow = submenu.previousElementSibling
    if (!arrow?.matches('button[data-ws-navbar-toggle]')) continue

    event.preventDefault()
    event.stopPropagation()
    submenu.hidePopover()
    arrow.focus({ preventScroll: true })
    break
  }
}, true)
