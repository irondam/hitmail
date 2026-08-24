import { useState, useRef } from 'react'

const BADGE = {
  ok:      { bg: '#EAF3DE', color: '#3B6D11' },
  fixed:   { bg: '#FAEEDA', color: '#854F0B' },
  invalid: { bg: '#FCEBEB', color: '#A32D2D' },
  empty:   { bg: '#f0f0f0', color: '#888' },
}

function Badge({ status, children }) {
  const s = BADGE[status] || BADGE.empty
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 500 }}>
      {children}
    </span>
  )
}

export default function ResultsTable({ headers, rows, emailCols, cpCols, dupRemoved, onDownload, onReset }) {
  const [filter, setFilter] = useState('all')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef()
  const PAGE = 200

  const counts = { ok: 0, fixed: 0, invalid: 0 }
  rows.forEach((r) => {
    emailCols.forEach((ci) => {
      const s = r.emailResults[ci]?.status
      if (s && s !== 'empty') counts[s] = (counts[s] || 0) + 1
    })
  })

  const visible = rows.filter((r) => {
    if (filter === 'all') return true
    return emailCols.some((ci) => r.emailResults[ci]?.status === filter)
  }).slice(0, PAGE)

  const extraHeaders = cpCols.flatMap((ci) => [
    `Code dept. (${headers[ci] || 'CP'})`,
    `Département (${headers[ci] || 'CP'})`,
    `Direction territoriale (${headers[ci] || 'CP'})`,
  ])

  const filterBtn = (f, label, count, color) => (
    <button onClick={() => setFilter(f)} style={{
      padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
      border: `1px solid ${filter === f ? color : '#ccc'}`,
      background: filter === f ? color : '#fff',
      color: filter === f ? '#fff' : '#333',
      fontWeight: filter === f ? 500 : 400,
    }}>
      {label}{count !== undefined && (
        <span style={{
          background: filter === f ? 'rgba(255,255,255,0.25)' : BADGE[f]?.bg,
          color: filter === f ? '#fff' : BADGE[f]?.color,
          borderRadius: 10, padding: '1px 7px', fontSize: 11, marginLeft: 4,
        }}>{count}</span>
      )}
    </button>
  )

  const handleDrop = (file) => {
    if (file && onReset) {
      // On reset proprement puis on laisse App gérer le nouveau fichier
      // via la prop onReset qui est en fait le reset + handleFile
      onReset(file)
    }
  }

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: '1.5rem' }}>
        {[
          { label: 'Lignes', val: rows.length, color: '#333' },
          { label: 'Emails OK', val: counts.ok, color: '#3B6D11' },
          { label: 'Corrigés', val: counts.fixed, color: '#854F0B' },
          { label: 'Invalides', val: counts.invalid, color: '#A32D2D' },
          { label: 'Doublons supprimés', val: dupRemoved, color: '#6B21A8' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: '#f5f5f5', borderRadius: 8, padding: '0.75rem 1rem' }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Filtres + download */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {filterBtn('all', 'Tout', undefined, '#555')}
          {filterBtn('fixed', 'Corrigés', counts.fixed, '#854F0B')}
          {filterBtn('invalid', 'Invalides', counts.invalid, '#A32D2D')}
          {filterBtn('ok', 'OK', counts.ok, '#3B6D11')}
        </div>
        <button onClick={onDownload} style={{
          padding: '8px 18px', borderRadius: 8, fontSize: 14,
          background: '#185FA5', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 500,
        }}>
          ⬇ Télécharger le fichier nettoyé
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto', border: '1px solid #e5e5e5', borderRadius: 8, marginBottom: '1.5rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#fafafa', position: 'sticky', top: 0, zIndex: 1 }}>
              <th style={th}>#</th>
              {headers.map((h, i) => (
                <th key={i} style={th}>
                  {h || `Col ${i + 1}`}
                  {emailCols.includes(i) && <span style={{ marginLeft: 4, ...tag('#E6F1FB','#185FA5') }}>email</span>}
                  {cpCols.includes(i) && <span style={{ marginLeft: 4, ...tag('#FFF3E0','#E65100') }}>CP</span>}
                </th>
              ))}
              {extraHeaders.map((h) => (
                <th key={h} style={{ ...th, background: '#f0f7e6', color: '#3B6D11' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, ri) => (
              <tr key={ri} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={td(true)}>{ri + 1}</td>
                {headers.map((_, ci) => {
                  if (emailCols.includes(ci)) {
                    const res = r.emailResults[ci]
                    if (!res || res.status === 'empty') return <td key={ci} style={td()}><span style={{ color: '#bbb' }}>—</span></td>
                    if (res.status === 'ok') return <td key={ci} style={td()}><Badge status="ok">{r.cleanedRow[ci]}</Badge></td>
                    if (res.status === 'fixed') return (
                      <td key={ci} style={td()}>
                        <span style={{ textDecoration: 'line-through', color: '#bbb', fontSize: 11, marginRight: 4 }}>{res.original}</span>
                        →&nbsp;<Badge status="fixed">{res.cleaned}</Badge>
                      </td>
                    )
                    if (res.status === 'invalid') return (
                      <td key={ci} style={td()}>
                        <Badge status="invalid">{r.original[ci]}</Badge>
                        <span style={{ fontSize: 11, color: '#aaa', marginLeft: 4 }}>{res.reason}</span>
                      </td>
                    )
                  }
                  return <td key={ci} style={td()}>{r.original[ci] ?? ''}</td>
                })}
                {cpCols.flatMap((ci) => {
                  const info = r.cpInfo?.[ci] || {}
                  return [
                    <td key={`dept-${ci}`} style={td()}>{info.dept || <span style={{ color: '#bbb' }}>—</span>}</td>,
                    <td key={`dep-${ci}`} style={td()}>{info.departement || <span style={{ color: '#bbb' }}>—</span>}</td>,
                    <td key={`dt-${ci}`} style={{ ...td(), color: info.dt ? '#185FA5' : '#bbb' }}>{info.dt || '—'}</td>,
                  ]
                })}
              </tr>
            ))}
            {rows.length > PAGE && (
              <tr>
                <td colSpan={headers.length + extraHeaders.length + 1}
                  style={{ textAlign: 'center', padding: 12, color: '#aaa', fontSize: 13 }}>
                  … et {rows.length - PAGE} lignes de plus dans le fichier téléchargé
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Zone dépôt nouveau fichier */}
      <div
        onClick={() => inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragging(false)
          const file = e.dataTransfer.files[0]
          if (file) onReset(file)
        }}
        style={{
          border: `2px dashed ${dragging ? '#378ADD' : '#ddd'}`,
          borderRadius: 10, padding: '1.25rem 1rem', textAlign: 'center',
          cursor: 'pointer', background: dragging ? '#eaf4fd' : '#fafafa',
          transition: 'all 0.15s', fontSize: 13, color: '#999',
        }}
      >
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
          onChange={(e) => { if (e.target.files[0]) onReset(e.target.files[0]) }} />
        🔄 Déposer ou choisir un nouveau fichier pour recommencer
      </div>
    </div>
  )
}

const th = { padding: '8px 10px', fontWeight: 500, fontSize: 12, color: '#666', textAlign: 'left', borderBottom: '1px solid #e5e5e5', whiteSpace: 'nowrap' }
const td = (muted = false) => ({ padding: '6px 10px', color: muted ? '#aaa' : 'inherit', whiteSpace: 'nowrap' })
const tag = (bg, color) => ({ background: bg, color, borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 500 })
