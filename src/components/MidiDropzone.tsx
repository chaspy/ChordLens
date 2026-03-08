import { useRef, useState } from 'react'

type Props = {
  onSelectFile: (file: File) => void
  fileName?: string
}

function isMidiFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return name.endsWith('.mid') || name.endsWith('.midi') || name.endsWith('.smf')
}

export function MidiDropzone({ onSelectFile, fileName }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = useState(false)

  const acceptFile = (file: File | undefined) => {
    if (!file) return
    if (!isMidiFile(file)) return
    onSelectFile(file)
  }

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
      <h3 className="mb-2 text-sm font-medium text-slate-200">MIDI File Upload</h3>
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
        className={`flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition ${
          dragging ? 'border-teal-400 bg-teal-400/10' : 'border-slate-600 hover:border-slate-500'
        }`}
      >
        {fileName ? (
          <div className="flex flex-col items-center gap-2">
            <span className="text-2xl">🎵</span>
            <p className="text-sm font-medium text-teal-300">{fileName}</p>
            <p className="text-xs text-slate-400">クリックまたはドロップで別ファイルに変更</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="text-2xl">🎹</span>
            <p className="text-sm text-slate-300">Drag & Drop MIDI ファイル、またはクリックして選択</p>
            <p className="text-xs text-slate-500">.mid / .midi / .smf</p>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".mid,.midi,.smf"
        className="hidden"
        onChange={(e) => acceptFile(e.target.files?.[0])}
      />
    </section>
  )
}
