import { useState } from 'react'
import { ImagePlus } from 'lucide-react'
import { sortImageFiles } from '../../lib/imageFiles'

/**
 * Drag-and-drop (or click) picker for several images at once.
 * Calls onFiles with the valid files and onReject with the reasons for the rest.
 */
export default function ImageDropzone({ onFiles, onReject, disabled = false, busyLabel = 'Uploading…', className = '' }) {
  const [over, setOver] = useState(false)

  function handle(fileList) {
    const { accepted, rejected } = sortImageFiles(fileList)
    if (rejected.length) onReject?.(rejected)
    if (accepted.length) onFiles(accepted)
  }

  return (
    <label
      className={`admin-image-add-tile${over ? ' is-dragover' : ''} ${className}`.trim()}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        if (!disabled) handle(e.dataTransfer.files)
      }}
    >
      <ImagePlus size={22} />
      <span>{disabled ? busyLabel : 'Drop pictures here or click to browse'}</span>
      <span className="admin-image-add-hint">JPG, PNG, WebP, AVIF · up to 5 MB each · multiple OK</span>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        hidden
        disabled={disabled}
        onChange={(e) => {
          handle(e.target.files)
          e.target.value = ''
        }}
      />
    </label>
  )
}
