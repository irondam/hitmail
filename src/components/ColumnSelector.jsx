const btn = (active) => ({
  padding: '6px 14px',
  borderRadius: 8,
  border: `1px solid ${active ? '#185FA5' : '#ccc'}`,
  background: active ? '#185FA5' : '#fff',
  color: active ? '#fff' : '#333',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: active ? 500 : 400,
})

export default function ColumnSelector({ headers, selected, onChange, label, color = '#185FA5' }) {
  const toggle = (i) => {
    onChange(
      selected.includes(i) ? selected.filter((x) => x !== i) : [...selected, i]
    )
  }

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <p style={{ margin: '0 0 8px', fontSize: 14, color: '#555' }}>{label}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {headers.map((h, i) => {
          const active = selected.includes(i)
          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              style={{
                ...btn(active),
                ...(active ? { background: color, borderColor: color } : {}),
              }}
            >
              {h || `Colonne ${i + 1}`}
            </button>
          )
        })}
      </div>
    </div>
  )
}
