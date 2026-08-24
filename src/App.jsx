import { useState } from 'react'
import * as XLSX from 'xlsx'
import DropZone from './components/DropZone'
import ColumnSelector from './components/ColumnSelector'
import ResultsTable from './components/ResultsTable'
import { getContactFromCP } from './data/regions'
import { cleanEmail, detectEmailColumns, detectCPColumns, deduplicateRows, parseCSV, decodeBuffer, splitMultipleEmails } from './utils/emailCleaner'

const STEPS = { UPLOAD: 0, CONFIG: 1, RESULTS: 2 }

const initialState = {
  step: STEPS.UPLOAD,
  fileName: '',
  headers: [],
  rawRows: [],
  emailCols: [],
  cpCols: [],
  addDept: true,
  results: [],
  dupRemoved: 0,
  splitCount: 0,
}

export default function App() {
  const [state, setState] = useState(initialState)
  const set = (patch) => setState(s => ({ ...s, ...patch }))

  const reset = (file) => {
    setState(initialState)
    if (file instanceof File) {
      // Petit délai pour laisser le state se réinitialiser
      setTimeout(() => handleFile(file), 50)
    }
  }

  const handleFile = (file) => {
    set({ fileName: file.name })
    const name = file.name.toLowerCase()
    const isCSV = name.endsWith('.csv')
    const reader = new FileReader()

    const onData = (data) => {
      const hdrs = data[0] || []
      set({
        headers: hdrs,
        rawRows: data.slice(1),
        emailCols: detectEmailColumns(hdrs),
        cpCols: detectCPColumns(hdrs),
        step: STEPS.CONFIG,
      })
    }

    if (isCSV) {
      reader.onload = (e) => {
        const text = decodeBuffer(e.target.result)
        const rows = parseCSV(text)
        onData(rows)
      }
      reader.readAsArrayBuffer(file)
    } else {
      reader.onload = (e) => {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        onData(data)
      }
      reader.readAsArrayBuffer(file)
    }
  }

  const runClean = () => {
    const { rawRows, emailCols, cpCols, addDept } = state
    let splitCount = 0

    // Étape 1 : expansion des lignes multi-emails
    const expanded = []
    for (const row of rawRows) {
      // Pour chaque colonne email, on collecte les emails séparés
      // On fait le produit cartésien si plusieurs colonnes ont plusieurs valeurs
      // Dans la pratique on traite colonne par colonne et on duplique
      let baseRows = [row]

      for (const ci of emailCols) {
        const newBaseRows = []
        for (const r of baseRows) {
          const parts = splitMultipleEmails(r[ci])
          if (parts.length > 1) {
            splitCount += parts.length - 1
            for (const part of parts) {
              const newRow = [...r]
              newRow[ci] = part
              newBaseRows.push(newRow)
            }
          } else {
            newBaseRows.push(r)
          }
        }
        baseRows = newBaseRows
      }
      expanded.push(...baseRows)
    }

    // Étape 2 : nettoyage email + CP
    const cleaned = expanded.map((row) => {
      const emailResults = {}
      emailCols.forEach((ci) => { emailResults[ci] = cleanEmail(row[ci]) })
      const cleanedRow = [...row]
      emailCols.forEach((ci) => { if (emailResults[ci].cleaned) cleanedRow[ci] = emailResults[ci].cleaned })
      const cpInfo = {}
      if (addDept) {
        cpCols.forEach((ci) => { cpInfo[ci] = getContactFromCP(row[ci]) })
      }
      return { original: row, cleanedRow, emailResults, cpInfo }
    })

    // Étape 3 : déduplication
    const { deduped, duplicatesRemoved } = deduplicateRows(cleaned, emailCols)
    set({ results: deduped, dupRemoved: duplicatesRemoved, splitCount, step: STEPS.RESULTS })
  }

  const downloadResult = () => {
    const { headers, results, cpCols, addDept, fileName } = state
    const activeCpCols = addDept ? cpCols : []
    const extraHeaders = activeCpCols.flatMap(() => ['Codes_départements', 'Départements', 'Directions territoriales'])
    const outputHeaders = [...headers, ...extraHeaders]
    const outputRows = results.map((r) => {
      const extra = activeCpCols.flatMap((ci) => {
        const info = r.cpInfo?.[ci] || {}
        return [info.dept || '', info.departement || '', info.dt || '']
      })
      return [...r.cleanedRow, ...extra]
    })
    const ws = XLSX.utils.aoa_to_sheet([outputHeaders, ...outputRows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Nettoyé')
    XLSX.writeFile(wb, fileName.replace(/\.(xlsx?|csv)$/i, '') + '_nettoye.xlsx')
  }

  const { step, fileName, headers, rawRows, emailCols, cpCols, addDept, results, dupRemoved, splitCount } = state

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1.5rem', fontFamily: 'system-ui, sans-serif', color: '#1a1a1a' }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Hitmail</h1>

      {step === STEPS.UPLOAD && <DropZone onFile={handleFile} />}

      {step === STEPS.CONFIG && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <span style={{ background: '#EAF3DE', color: '#3B6D11', borderRadius: 6, padding: '4px 10px', fontSize: 13 }}>{fileName}</span>
            <span style={{ fontSize: 13, color: '#888' }}>{rawRows.length} lignes · {headers.length} colonnes</span>
            <button onClick={reset} style={secondaryBtn}>← Changer de fichier</button>
          </div>
          <ColumnSelector headers={headers} selected={emailCols} onChange={(v) => set({ emailCols: v })}
            label="Colonnes d'emails à nettoyer" color="#185FA5" />
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input type="checkbox" checked={addDept} onChange={(e) => set({ addDept: e.target.checked })}
                style={{ width: 16, height: 16, cursor: 'pointer' }} />
              Ajouter département / direction territoriale à partir du code postal
            </label>
          </div>
          {addDept && (
            <ColumnSelector headers={headers} selected={cpCols} onChange={(v) => set({ cpCols: v })}
              label="Colonnes de codes postaux" color="#E65100" />
          )}
          <button onClick={runClean}
            disabled={!emailCols.length && !(addDept && cpCols.length)}
            style={{ ...primaryBtn, opacity: (!emailCols.length && !(addDept && cpCols.length)) ? 0.5 : 1 }}>
            Nettoyer
          </button>
        </div>
      )}

      {step === STEPS.RESULTS && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <span style={{ background: '#EAF3DE', color: '#3B6D11', borderRadius: 6, padding: '4px 10px', fontSize: 13 }}>{fileName}</span>
            <button onClick={() => set({ step: STEPS.CONFIG })} style={secondaryBtn}>← Modifier les colonnes</button>
            <button onClick={reset} style={secondaryBtn}>🔄 Nouveau fichier</button>
          </div>
          {splitCount > 0 && (
            <div style={{ background: '#EEF2FF', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: '#3730A3', marginBottom: '1rem' }}>
              ✂️ {splitCount} ligne{splitCount > 1 ? 's' : ''} dupliquée{splitCount > 1 ? 's' : ''} (cellules contenant plusieurs emails)
            </div>
          )}
          <ResultsTable
            headers={headers}
            rows={results}
            emailCols={emailCols}
            cpCols={addDept ? cpCols : []}
            dupRemoved={dupRemoved}
            onDownload={downloadResult}
            onReset={reset}
          />
        </div>
      )}
    </div>
  )
}

const primaryBtn = { padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 500, background: '#185FA5', color: '#fff', border: 'none', cursor: 'pointer' }
const secondaryBtn = { padding: '6px 14px', borderRadius: 8, fontSize: 13, background: '#fff', color: '#555', border: '1px solid #ccc', cursor: 'pointer' }
