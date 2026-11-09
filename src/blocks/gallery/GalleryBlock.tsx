import { ImageIcon, Maximize2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { BlockConfig } from '../types'
import { connectGalleryViewer } from './gallery-viewer.js'

interface GalleryImage {
  src?: string
  alt?: string
  caption?: string
}

const defaultImages: GalleryImage[] = [
  { alt: 'Image 1' }, { alt: 'Image 2' }, { alt: 'Image 3' },
  { alt: 'Image 4' }, { alt: 'Image 5' }, { alt: 'Image 6' },
]

function ImageCard({ image, tall, responsive, viewer }: { image: GalleryImage; tall?: boolean; responsive: boolean; viewer: boolean }) {
  const canEnlarge = viewer && !!image.src
  return (
    <div className={`relative rounded-lg overflow-hidden border border-border-default group ${tall ? 'row-span-2' : ''}`}>
      {image.src ? (
        <img src={image.src} alt={image.alt || ''}
          className={`${responsive ? 'block w-full aspect-[4/3] object-contain bg-black/5' : 'w-full h-full object-cover'}${canEnlarge ? ' cursor-zoom-in' : ''}`}
          loading={responsive ? 'lazy' : undefined}
          decoding={responsive ? 'async' : undefined}
          draggable={responsive || canEnlarge ? false : undefined}
          data-ws-gallery-thumbnail={canEnlarge ? true : undefined}
          data-ws-gallery-caption={canEnlarge ? image.caption : undefined}
        />
      ) : (
        <div className="w-full h-full min-h-[140px] bg-gradient-to-br from-bg-3 to-bg-4 flex items-center justify-center">
          <ImageIcon size={24} className="text-text-3" />
        </div>
      )}
      {canEnlarge && <button type="button" data-ws-gallery-open aria-haspopup="dialog"
        aria-label={image.alt ? `Enlarge ${image.alt}` : 'Enlarge photo'} title="Enlarge photo"
        className="absolute right-2 top-2 grid size-9 place-items-center rounded-md border border-white/60 bg-slate-900/80 text-white shadow-sm hover:bg-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
        <Maximize2 size={17} aria-hidden="true" />
      </button>}
      {image.caption && !canEnlarge && (
        <div className="px-3 py-2 bg-bg-2 text-[11px] text-text-2">{image.caption}</div>
      )}
    </div>
  )
}

export function GalleryBlock({ block }: { block: BlockConfig }) {
  const { variant, props } = block
  const title = props.title as string | undefined
  const viewer = props.enablePhotoViewer === true
  const gallery = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (viewer && gallery.current) return connectGalleryViewer(gallery.current)
  }, [viewer])
  const images = ((props.images as GalleryImage[]) || []).length > 0
    ? (props.images as GalleryImage[])
    : defaultImages

  const masonry = variant === 'masonry'
  const responsive = variant === 'responsive'
  return (
    <div ref={gallery} data-ws-gallery-viewer={viewer ? true : undefined} className="px-6 py-12 @lg:px-16 @lg:py-16">
      {title && <h2 className="reveal-fade-up reveal-d1 text-2xl font-display font-semibold mb-6 text-center">{title}</h2>}
      <div className={responsive ? 'grid gap-4' : `grid grid-cols-2 @lg:grid-cols-3 gap-3${masonry ? ' auto-rows-[160px]' : ''}`}
        style={responsive ? { gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))' } : undefined}>
        {images.map((img, i) => (
          <div key={i} data-ws-item-field="images" data-ws-item-index={i}
            className={responsive ? 'min-w-0 [&[draggable=true]]:cursor-grab [&[draggable=true]:active]:cursor-grabbing' : `reveal-scale reveal-d${Math.min(i + 2, 8)}`}>
            <ImageCard image={img} responsive={responsive} tall={masonry && i % 3 === 0} viewer={viewer} />
          </div>
        ))}
      </div>
      {viewer && <dialog data-ws-gallery-dialog aria-label="Enlarged photo"
        className="@container m-auto max-h-[92dvh] w-[min(94vw,94cqw,72rem)] max-w-none overflow-auto rounded-xl border border-slate-300 bg-white text-slate-900 shadow-2xl backdrop:bg-slate-950/75 [color-scheme:light]">
        <form method="dialog" className="sticky top-0 z-10 flex justify-end border-b border-slate-200 bg-white px-3 py-2">
          <button type="submit" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100">Close photo</button>
        </form>
        <figure className="grid gap-4 p-3 @min-[40rem]:data-[caption=true]:grid-cols-[minmax(0,1fr)_minmax(12rem,27%)] @min-[40rem]:p-4">
          <div className="flex min-w-0 items-center justify-center rounded-md bg-slate-100">
            <img data-ws-gallery-expanded alt="" className="block h-auto max-h-[70dvh] w-auto max-w-full object-contain" />
          </div>
          <figcaption hidden className="self-center whitespace-pre-wrap rounded-md bg-slate-50 p-4 text-base leading-relaxed [overflow-wrap:anywhere]" />
        </figure>
      </dialog>}
    </div>
  )
}
