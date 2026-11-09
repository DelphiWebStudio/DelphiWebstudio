export function connectGalleryViewer(gallery) {
  const dialog = gallery.querySelector('[data-ws-gallery-dialog]')
  const photo = dialog.querySelector('[data-ws-gallery-expanded]')
  const caption = dialog.querySelector('figcaption')

  function openPhoto(event) {
    if (!(event.target instanceof Element)) return
    if (dialog.contains(event.target)) {
      event.stopPropagation()
      return
    }
    const trigger = event.type === 'dblclick' ? '[data-ws-gallery-thumbnail]' : '[data-ws-gallery-open]'
    const card = event.target.closest(trigger)?.closest('[data-ws-item-field="images"]')
    const thumbnail = card?.querySelector('[data-ws-gallery-thumbnail]')
    if (!thumbnail || dialog.open) return

    event.stopPropagation()
    const text = thumbnail.dataset.wsGalleryCaption?.trim() ?? ''
    caption.textContent = text
    caption.hidden = !text
    caption.parentElement.dataset.caption = String(!!text)
    photo.alt = thumbnail.alt
    photo.src = thumbnail.currentSrc || thumbnail.src
    card.querySelector('[data-ws-gallery-open]').focus({ preventScroll: true })
    dialog.showModal()
  }

  function clearPhoto() {
    photo.removeAttribute('src')
  }

  function closeOnEscape(event) {
    if (event.key !== 'Escape' || !dialog.open) return
    event.preventDefault()
    event.stopPropagation()
    dialog.close()
  }

  gallery.addEventListener('click', openPhoto)
  gallery.addEventListener('dblclick', openPhoto)
  dialog.addEventListener('keydown', closeOnEscape)
  dialog.addEventListener('close', clearPhoto)
  return () => {
    gallery.removeEventListener('click', openPhoto)
    gallery.removeEventListener('dblclick', openPhoto)
    dialog.removeEventListener('keydown', closeOnEscape)
    dialog.removeEventListener('close', clearPhoto)
    if (dialog.open) dialog.close()
    clearPhoto()
  }
}
