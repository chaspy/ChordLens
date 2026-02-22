import { useRef, useState } from 'react'

type Props = {
  onSelectFile: (file: File) => void
  previewUrl?: string
}

export function ImageDropzone({ onSelectFile, previewUrl }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = useState(false)

  const acceptFile = (file: File | undefined) => {
    if (!file) {
      return
    }
    if (!file.type.startsWith('image/')) {
      return
    }
    onSelectFile(file)
  }

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
      <h3 className="mb-2 text-sm font-medium text-slate-200">Screenshot Upload</h3>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          e.preventDefault()
          setDragging(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          acceptFile(e.dataTransfer.files[0])
        }}
        className={`flex min-h-40 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition ${
          dragging ? 'border-teal-400 bg-teal-400/10' : 'border-slate-600 hover:border-slate-500'
        }`}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="uploaded screenshot" className="max-h-64 rounded object-contain" />
        ) : (
          <p className="text-sm text-slate-300">Drag & Drop 画像、またはクリックして選択</p>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        className="hidden"
        onChange={(e) => acceptFile(e.target.files?.[0])}
      />
    </section>
  )
}
