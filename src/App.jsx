import { useState } from 'react'
import * as XLSX from 'xlsx'
import DropZone from './components/DropZone'
import ColumnSelector from './components/ColumnSelector'
import ResultsTable from './components/ResultsTable'
import { cleanEmail, detectEmailColumns, detectCPColumns } from './utils/emailCleaner'
import { getContactFromCP } from './data/regions'

const STEPS = { UPLOAD: 0, CONFIG: 1, RESULTS: 2 }

export default function App() {
  const [step, setStep] = useState(STEPS.UPLOAD)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState([])
  const [rawRows, setRawRows] = useState([])
  const [emailCols, setEmailCols] = useState([])
  const [cpCols, setCPCols] = useState([])
  const [results, setResults] = useState([])

  const handleFile = (file) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      const hdrs = data[0] || []
      const rows = data.slice(1)
      setHeaders(hdrs)
      setRawRows(rows)
      setEmailCols(detectEmailColumns(hdrs))
      setCPCols(detectCPColumns(hdrs))
      setStep(STEPS.CONFIG)
    }
    reader.readAsArrayBuffer(file)
  }

  const runClean = () => {
    const cleaned = rawRows.map((row) => {
      const emailResults = {}
      emailCols.forEach((ci) => { emailResults[ci] = cleanEmail(row[ci]) })
      const cleanedRow = [...row]
      emailCols.forEach((ci) => { if (emailResults[ci].cleaned) cleanedRow[ci] = emailResults[ci].cleaned })
      const cpInfo = {}
      cpCols.forEach((ci) => { cpInfo[ci] = getContactFromCP(row[ci]) })
      return { original: row, cleanedRow, emailResults, cpInfo }
    })
    setResults(cleaned)
    setStep(STEPS.RESULTS)
  }

  const downloadResult = () => {
    const extraHeaders = cpCols.flatMap((ci) => [
      `Codes_départements`,
      `Départements`,
      `Directions territoriales`,
    ])
    const outputHeaders = [...headers, ...extraHeaders]
    const outputRows = results.map((r) => {
      const extra = cpCols.flatMap((ci) => {
        const info = r.cpInfo?.[ci] || {}
        return [info.dept || '', info.departement || '', info.dt || '']
      })
      return [...r.cleanedRow, ...extra]
    })
    const ws = XLSX.utils.aoa_to_sheet([outputHeaders, ...outputRows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Nettoyé')
    XLSX.writeFile(wb, fileName.replace(/\.xlsx?$/i, '') + '_nettoye.xlsx')
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1.5rem', fontFamily: 'system-ui, sans-serif', color: '#1a1a1a' }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Hitmail</h1>

      {step === STEPS.UPLOAD && <DropZone onFile={handleFile} />}

      {step === STEPS.CONFIG && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <span style={{ background: '#EAF3DE', color: '#3B6D11', borderRadius: 6, padding: '4px 10px', fontSize: 13 }}>
              {fileName}
            </span>
            <span style={{ fontSize: 13, color: '#888' }}>{rawRows.length} lignes · {headers.length} colonnes</span>
            <button onClick={() => setStep(STEPS.UPLOAD)} style={secondaryBtn}>← Changer de fichier</button>
          </div>
          <ColumnSelector headers={headers} selected={emailCols} onChange={setEmailCols}
            label="Colonnes d'emails à nettoyer" color="#185FA5" />
          <ColumnSelector headers={headers} selected={cpCols} onChange={setCPCols}
            label="Colonnes de codes postaux (département)" color="#E65100" />
          <button onClick={runClean}
            disabled={!emailCols.length && !cpCols.length}
            style={{ ...primaryBtn, opacity: (!emailCols.length && !cpCols.length) ? 0.5 : 1 }}>
            Nettoyer
          </button>
        </div>
      )}

      {step === STEPS.RESULTS && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <span style={{ background: '#EAF3DE', color: '#3B6D11', borderRadius: 6, padding: '4px 10px', fontSize: 13 }}>
              {fileName}
            </span>
            <button onClick={() => setStep(STEPS.CONFIG)} style={secondaryBtn}>← Modifier les colonnes</button>
          </div>
          <ResultsTable headers={headers} rows={results} emailCols={emailCols} cpCols={cpCols} onDownload={downloadResult} />
        </div>
      )}
    </div>
  )
}

const primaryBtn = { padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 500, background: '#185FA5', color: '#fff', border: 'none', cursor: 'pointer' }
const secondaryBtn = { padding: '6px 14px', borderRadius: 8, fontSize: 13, background: '#fff', color: '#555', border: '1px solid #ccc', cursor: 'pointer' }
