import { toast } from 'sonner'
import { chooseWindowsColor } from '@/desktop/native-bridge'

export function WindowsColorInput({ label, value, onChange, onPreview, className }: { label: string; value: string; onChange: (value: string) => void; onPreview?: (value: string) => void; className?: string }) {
  const desktop = typeof window !== 'undefined' && window.location.origin === 'https://webstudio.local' && !!(window as unknown as { chrome?: { webview?: unknown } }).chrome?.webview
  if (!desktop) return <input type="color" aria-label={label} value={value} className={className} onInput={event => onPreview?.(event.currentTarget.value)} onChange={event => onChange(event.currentTarget.value)} />
  return <button type="button" aria-label={label} title={label} className={className} style={{ backgroundColor: value }} onMouseDown={event => event.preventDefault()} onClick={async () => {
    try { const color = await chooseWindowsColor(value); if (color) onChange(color) }
    catch { toast.error('The Windows color dialog could not be opened.') }
  }} />
}
