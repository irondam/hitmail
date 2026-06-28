import { useRef, useState } from 'react'

export default function DropZone({ onFile }) {
  const inputRef = useRef()
  const [dragging, setDragging] = useState(false)

  const handle = (file) => {
    if (!file) return
    const name = file.name.toLowerCase()
    if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
      onFile(file)
    } else {
      alert('Merci de déposer un fichier .xlsx, .xls ou .csv')
    }
  }

  return (
    <div
      onClick={() => inputRef.current.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files[0]) }}
      style={{
        border: `2px dashed ${dragging ? '#378ADD' : '#ccc'}`,
        borderRadius: 12,
        padding: '3rem 2rem',
        textAlign: 'center',
        cursor: 'pointer',
        background: dragging ? '#eaf4fd' : '#fafafa',
        transition: 'all 0.15s',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
        onChange={(e) => handle(e.target.files[0])}
      />
      <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
      <p style={{ margin: 0, fontWeight: 500 }}>Dépose ton fichier ici</p>
      <p style={{ margin: '6px 0 0', fontSize: 13, color: '#888' }}>ou clique pour choisir (.xlsx, .xls ou .csv)</p>
    </div>
  )
}
