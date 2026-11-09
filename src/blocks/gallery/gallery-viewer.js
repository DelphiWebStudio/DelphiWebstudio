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
    const thumbnail = event.target.closest('[data-ws-gallery-thumbnail]')
    if (!thumbnail || dialog.open) return
    if (event.type === 'keydown' && (event.repeat || (event.key !== 'Enter' && event.key !== ' '))) return
    if (event.type === 'click' && event.detail !== 0 && event.pointerType !== 'touch' && !event.sourceCapabilities?.firesTouchEvents) return

    event.preventDefault()
    event.stopPropagation()
    const text = thumbnail.dataset.wsGalleryCaption?.trim() ?? ''
    caption.textContent = text
    caption.hidden = !text
    caption.parentElement.dataset.caption = String(!!text)
    photo.alt = thumbnail.alt
    photo.src = thumbnail.currentSrc || thumbnail.src
    thumbnail.focus({ preventScroll: true })
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
  gallery.addEventListener('keydown', openPhoto)
  dialog.addEventListener('keydown', closeOnEscape)
  dialog.addEventListener('close', clearPhoto)
  return () => {
    gallery.removeEventListener('click', openPhoto)
    gallery.removeEventListener('dblclick', openPhoto)
    gallery.removeEventListener('keydown', openPhoto)
    dialog.removeEventListener('keydown', closeOnEscape)
    dialog.removeEventListener('close', clearPhoto)
    if (dialog.open) dialog.close()
    clearPhoto()
  }
}
