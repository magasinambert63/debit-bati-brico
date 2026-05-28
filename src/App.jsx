import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Printer, Download, Save, FolderOpen, Scissors, FileText } from 'lucide-react'

const MATERIALS = [
  { product: "Radiata", thickness: "9 mm", width: 250, height: 125, priceM2: 7.30, coefficient: 1.55 },
  { product: "Radiata", thickness: "12 mm", width: 250, height: 125, priceM2: 9.05, coefficient: 1.55 },
  { product: "Radiata", thickness: "15 mm", width: 250, height: 125, priceM2: 11.15, coefficient: 1.55 },
  { product: "Radiata", thickness: "18 mm", width: 250, height: 125, priceM2: 13.05, coefficient: 1.55 },
  { product: "Radiata", thickness: "21 mm", width: 250, height: 125, priceM2: 15.40, coefficient: 1.55 },
  { product: "Okoumé", thickness: "5 mm", width: 250, height: 122, priceM2: 8.61, coefficient: 1.70 },
  { product: "Okoumé", thickness: "8 mm", width: 250, height: 122, priceM2: 12.37, coefficient: 1.70 },
  { product: "Okoumé", thickness: "10 mm", width: 250, height: 122, priceM2: 13.45, coefficient: 1.70 },
  { product: "Okoumé", thickness: "12 mm", width: 250, height: 122, priceM2: 16.94, coefficient: 1.70 },
  { product: "Okoumé", thickness: "15 mm", width: 250, height: 122, priceM2: 19.37, coefficient: 1.70 },
  { product: "Okoumé", thickness: "18 mm", width: 250, height: 122, priceM2: 23.24, coefficient: 1.70 },
  { product: "Okoumé", thickness: "22 mm", width: 250, height: 122, priceM2: 28.12, coefficient: 1.70 },
  { product: "Panneau OSB 3", thickness: "9 mm", width: 250, height: 125, priceM2: 3.73, coefficient: 1.46 },
  { product: "Panneau OSB 3", thickness: "12 mm", width: 250, height: 125, priceM2: 4.67, coefficient: 1.46 },
  { product: "Panneau OSB 3", thickness: "15 mm", width: 250, height: 125, priceM2: 5.71, coefficient: 1.46 },
  { product: "Panneau OSB 3", thickness: "18 mm", width: 250, height: 125, priceM2: 6.75, coefficient: 1.46 },
  { product: "Dalle OSB 3", thickness: "12 mm", width: 250, height: 67.5, priceM2: 4.99, coefficient: 1.44 },
  { product: "Dalle OSB 3", thickness: "15 mm", width: 250, height: 67.5, priceM2: 5.71, coefficient: 1.44 },
  { product: "Dalle OSB 3", thickness: "18 mm", width: 250, height: 67.5, priceM2: 7.72, coefficient: 1.44 },
  { product: "Dalle OSB 3", thickness: "22 mm", width: 250, height: 67.5, priceM2: 8.82, coefficient: 1.44 },
  { product: "MDF", thickness: "10 mm", width: 280, height: 207, priceM2: 6.94, coefficient: 1.45 },
  { product: "MDF", thickness: "12 mm", width: 280, height: 207, priceM2: 4.32, coefficient: 1.45 },
  { product: "MDF", thickness: "19 mm", width: 280, height: 207, priceM2: 9.74, coefficient: 1.45 },
]

const COLORS = ['#DBEAFE','#FEF3C7','#DCFCE7','#FEE2E2','#EDE9FE','#FFEDD5','#CCFBF1','#FCE7F3']
const BLUE = '#0D2D73'
const RED = '#D71920'

function expandPieces(items, allowRotation, respectGrain) {
  const pieces = []
  items.forEach((item, groupIndex) => {
    for (let i = 0; i < Number(item.qty || 0); i++) {
      pieces.push({
        id: `${item.id}-${i}`,
        pieceNo: '',
        label: item.label || 'Pièce',
        originalW: Number(item.w),
        originalH: Number(item.h),
        w: Number(item.w),
        h: Number(item.h),
        color: item.color || COLORS[groupIndex % COLORS.length],
        allowRotation: allowRotation && !respectGrain,
        group: groupIndex + 1
      })
    }
  })
  return pieces.filter(p => p.w > 0 && p.h > 0)
}

function canFit(piece, sheetW, sheetH) {
  return (piece.w <= sheetW && piece.h <= sheetH) || (piece.allowRotation && piece.h <= sheetW && piece.w <= sheetH)
}

function orientPiece(piece, bandType, remainingLength, bandThickness) {
  const variants = [{ w: piece.w, h: piece.h, rotated: false }]
  if (piece.allowRotation && piece.w !== piece.h) variants.push({ w: piece.h, h: piece.w, rotated: true })
  const valid = variants.filter(v => bandType === 'horizontal' ? v.w <= remainingLength && v.h <= bandThickness : v.h <= remainingLength && v.w <= bandThickness)
  if (!valid.length) return null
  valid.sort((a,b) => {
    const aw = bandType === 'horizontal' ? bandThickness - a.h : bandThickness - a.w
    const bw = bandType === 'horizontal' ? bandThickness - b.h : bandThickness - b.w
    return aw - bw
  })
  return valid[0]
}

function buildBand(panel, pieces, sheetW, sheetH, kerf, bandType, minWaste) {
  if (!pieces.length) return null
  const first = pieces[0]
  const variants = [{ w:first.w, h:first.h, rotated:false }]
  if (first.allowRotation && first.w !== first.h) variants.push({ w:first.h, h:first.w, rotated:true })

  const options = variants
    .filter(v => v.w <= sheetW && v.h <= sheetH)
    .map(v => ({
      firstVariant: v,
      thickness: bandType === 'horizontal' ? v.h : v.w,
      length: bandType === 'horizontal' ? sheetW : sheetH,
    }))
    .sort((a,b) => b.thickness - a.thickness)

  let best = null

  for (const opt of options) {
    const band = {
      type: bandType,
      x: bandType === 'horizontal' ? 0 : panel.used,
      y: bandType === 'horizontal' ? panel.used : 0,
      w: bandType === 'horizontal' ? sheetW : opt.thickness,
      h: bandType === 'horizontal' ? opt.thickness : sheetH,
      thickness: opt.thickness,
      pieces: [],
      usedLength: 0,
      offcuts: []
    }

    let cursor = 0
    const usedIds = new Set()

    const place = (piece, v) => {
      const placed = {
        ...piece,
        w: v.w,
        h: v.h,
        rotated: v.rotated,
        x: bandType === 'horizontal' ? cursor : band.x,
        y: bandType === 'horizontal' ? band.y : cursor,
      }
      band.pieces.push(placed)
      cursor += (bandType === 'horizontal' ? v.w : v.h) + kerf
      band.usedLength = cursor - kerf
      usedIds.add(piece.id)
    }

    place(first, opt.firstVariant)

    for (const p of pieces.slice(1)) {
      if (usedIds.has(p.id)) continue
      const remaining = opt.length - cursor
      const v = orientPiece(p, bandType, remaining, opt.thickness)
      if (v) place(p, v)
    }

    const bandArea = band.w * band.h
    const piecesArea = band.pieces.reduce((s,p)=>s+p.w*p.h,0)
    const fillRate = piecesArea / bandArea
    const waste = bandArea - piecesArea

    const endWaste = opt.length - band.usedLength - kerf
    if (endWaste >= minWaste) {
      band.offcuts.push({
        x: bandType === 'horizontal' ? band.usedLength + kerf : band.x,
        y: bandType === 'horizontal' ? band.y : band.usedLength + kerf,
        w: bandType === 'horizontal' ? endWaste : opt.thickness,
        h: bandType === 'horizontal' ? opt.thickness : endWaste,
        type: 'fin de bande'
      })
    }

    band.score = fillRate * 1000 - waste * 0.01 + band.pieces.length * 15
    if (!best || band.score > best.score) best = band
  }

  return best
}

function packBands(sheetW, sheetH, kerf, items, settings) {
  const { allowRotation, respectGrain, bandMode, minReusableWaste } = settings
  let remaining = expandPieces(items, allowRotation, respectGrain)
  const impossible = remaining.filter(p => !canFit(p, sheetW, sheetH))
  remaining = remaining.filter(p => canFit(p, sheetW, sheetH))

  remaining.sort((a,b) => Math.max(b.w,b.h) - Math.max(a.w,a.h) || b.w*b.h - a.w*a.h)

  const panels = []
  while (remaining.length) {
    const panel = { pieces: [], bands: [], offcuts: [], used: 0, type: bandMode }
    while (remaining.length) {
      const available = bandMode === 'vertical' ? sheetW - panel.used : sheetH - panel.used
      if (available <= 0) break

      const candidates = remaining.filter(p => {
        if (bandMode === 'horizontal') return (p.h <= available && p.w <= sheetW) || (p.allowRotation && p.w <= available && p.h <= sheetW)
        return (p.w <= available && p.h <= sheetH) || (p.allowRotation && p.h <= available && p.w <= sheetH)
      })

      if (!candidates.length) break
      const band = buildBand(panel, candidates, sheetW, sheetH, kerf, bandMode, Number(minReusableWaste || 20))
      if (!band || !band.pieces.length) break

      panel.bands.push(band)
      panel.pieces.push(...band.pieces)
      panel.offcuts.push(...band.offcuts)
      panel.used += band.thickness + kerf
      const ids = new Set(band.pieces.map(p=>p.id))
      remaining = remaining.filter(p => !ids.has(p.id))
    }

    if (bandMode === 'horizontal') {
      const rest = sheetH - panel.used
      if (rest >= minReusableWaste) panel.offcuts.push({x:0,y:panel.used,w:sheetW,h:rest,type:'reste panneau'})
    } else {
      const rest = sheetW - panel.used
      if (rest >= minReusableWaste) panel.offcuts.push({x:panel.used,y:0,w:rest,h:sheetH,type:'reste panneau'})
    }
    panels.push(panel)
  }

  let counter = 1
  panels.forEach((panel, pi) => {
    panel.pieces.forEach(p => {
      p.pieceNo = `P${String(counter).padStart(2,'0')}`
      p.panelNo = pi + 1
      counter++
    })
  })

  return { panels, impossible }
}

function packAuto(sheetW, sheetH, kerf, items, settings) {
  const h = packBands(sheetW, sheetH, kerf, items, {...settings, bandMode:'horizontal'})
  const v = packBands(sheetW, sheetH, kerf, items, {...settings, bandMode:'vertical'})
  const score = (res) => {
    const sheets = res.panels.length * 1000000
    const waste = res.panels.flatMap(p=>p.offcuts).reduce((s,o)=>s+o.w*o.h,0)
    const cuts = res.panels.reduce((s,p)=>s+p.bands.length+p.pieces.length*2,0)
    return sheets + cuts*200 - waste*0.02
  }
  return score(h) <= score(v) ? h : v
}

function format(n) { return Number(n || 0).toFixed(2) }

export default function App() {
  const [materialIndex, setMaterialIndex] = useState(4)
  const [kerfMm, setKerfMm] = useState(4)
  const [allowRotation, setAllowRotation] = useState(true)
  const [respectGrain, setRespectGrain] = useState(false)
  const [bandMode, setBandMode] = useState('auto')
  const [minReusableWaste, setMinReusableWaste] = useState(20)
  const [orderNumber, setOrderNumber] = useState('CMD-2026-0001')
  const [customerName, setCustomerName] = useState('Client comptoir')
  const [customerPhone, setCustomerPhone] = useState('')
  const [jobSite, setJobSite] = useState('')
  const [operatorName, setOperatorName] = useState('Atelier BATI BRICO')
  const [salesName, setSalesName] = useState('')
  const [machineSetupMin, setMachineSetupMin] = useState(8)
  const [cutSpeedMin, setCutSpeedMin] = useState(2)
  const [hourlyCutRate, setHourlyCutRate] = useState(40)
  const [vatRate, setVatRate] = useState(20)
  const [roundingStep, setRoundingStep] = useState(0.5)
  const [orders, setOrders] = useState([])
  const [items, setItems] = useState([
    { id: 1, label: 'Petit panneau', w: 89.6, h: 29.7, qty: 14, color: COLORS[0] },
    { id: 2, label: 'Grand panneau', w: 100, h: 95, qty: 2, color: COLORS[1] },
  ])

  const material = MATERIALS[materialIndex]
  const kerf = Number(kerfMm || 0) / 10

  useEffect(() => {
    const saved = localStorage.getItem('bati-brico-orders-premium')
    if (saved) setOrders(JSON.parse(saved))
  }, [])

  const result = useMemo(() => {
    const settings = {allowRotation, respectGrain, bandMode, minReusableWaste}
    if (bandMode === 'auto') return packAuto(material.width, material.height, kerf, items, settings)
    return packBands(material.width, material.height, kerf, items, settings)
  }, [material, kerf, items, allowRotation, respectGrain, bandMode, minReusableWaste])

  const panels = result.panels
  const impossible = result.impossible || []
  const allPieces = panels.flatMap(p => p.pieces)
  const sortedOffcuts = panels.flatMap((p,pi)=>p.offcuts.map(o=>({...o,panel:pi+1,area:o.w*o.h}))).sort((a,b)=>b.area-a.area)

  const sheetAreaM2 = material.width * material.height / 10000
  const pricePerSheet = sheetAreaM2 * material.priceM2
  const materialCost = panels.length * pricePerSheet
  const totalPieces = items.reduce((s,i)=>s+Number(i.qty||0),0)
  const estimatedCuts = panels.reduce((s,p)=>s+p.bands.length+p.pieces.length*2,0)
  const estimatedMachineTime = Number(machineSetupMin) + estimatedCuts * Number(cutSpeedMin)
  const cuttingCost = estimatedMachineTime / 60 * Number(hourlyCutRate)
  const costPrice = materialCost + cuttingCost
  const recommendedHTRaw = costPrice * material.coefficient
  const recommendedHT = Math.ceil(recommendedHTRaw / Number(roundingStep)) * Number(roundingStep)
  const recommendedTTC = recommendedHT * (1 + Number(vatRate)/100)
  const margin = recommendedHT - costPrice
  const marginRate = recommendedHT > 0 ? margin / recommendedHT * 100 : 0
  const usedArea = allPieces.reduce((s,p)=>s+p.w*p.h,0)
  const totalSheetArea = panels.length * material.width * material.height
  const yieldRate = totalSheetArea > 0 ? usedArea / totalSheetArea * 100 : 0

  const cutOrder = panels.flatMap((panel, pi) => {
    const rows = []
    panel.bands.forEach((band, bi) => {
      rows.push({
        step: '',
        panel: pi+1,
        action: band.type === 'horizontal' ? `Débit bande horizontale ${band.h.toFixed(1)} cm` : `Débit bande verticale ${band.w.toFixed(1)} cm`,
        detail: `${band.pieces.length} pièce(s) dans la bande ${bi+1}`,
        type: 'band'
      })
      band.pieces.forEach(p => {
        rows.push({
          step: '',
          panel: pi+1,
          action: `Coupe pièce ${p.pieceNo}`,
          detail: `${p.label} — ${p.w.toFixed(1)} x ${p.h.toFixed(1)} cm${p.rotated ? ' — tournée' : ''}`,
          type: 'piece'
        })
      })
    })
    return rows
  }).map((r,i)=>({...r, step:i+1}))

  const addItem = () => setItems([...items, { id: Date.now(), label:'Nouvelle pièce', w:50, h:30, qty:1, color:COLORS[items.length % COLORS.length] }])
  const updateItem = (id, key, value) => setItems(items.map(i => i.id === id ? {...i, [key]: value} : i))
  const removeItem = id => setItems(items.filter(i => i.id !== id))

  const saveOrder = () => {
    const data = { id:Date.now(), date:new Date().toLocaleDateString(), orderNumber, customerName, customerPhone, jobSite, operatorName, salesName, materialIndex, items, ttc: recommendedTTC, panels: panels.length }
    const next = [data, ...orders]
    setOrders(next)
    localStorage.setItem('bati-brico-orders-premium', JSON.stringify(next))
  }

  const loadOrder = (o) => {
    setOrderNumber(o.orderNumber)
    setCustomerName(o.customerName)
    setCustomerPhone(o.customerPhone || '')
    setJobSite(o.jobSite || '')
    setOperatorName(o.operatorName)
    setSalesName(o.salesName || '')
    setMaterialIndex(o.materialIndex)
    setItems(o.items)
  }

  const exportPdf = () => {
    document.body.classList.remove('client-pdf')
    document.body.classList.add('atelier-pdf')
    document.title = `${orderNumber}_${customerName}_PDF_ATELIER_BATI_BRICO`
    setTimeout(() => window.print(), 50)
  }

  const exportClientPdf = () => {
    document.body.classList.remove('atelier-pdf')
    document.body.classList.add('client-pdf')
    document.title = `${orderNumber}_${customerName}_DEVIS_BATI_BRICO`
    setTimeout(() => window.print(), 50)
  }

  return (
    <div className="app">
      <header className="top no-print">
        <div>
          <img src="/logo-bati-brico.png" alt="BATI BRICO France Matériaux" className="top-logo" />
          <p>Débit de coupe automatique — PDF Atelier Premium</p>
        </div>
        <div className="badge"><span>Plaques nécessaires</span><strong>{panels.length}</strong></div>
      </header>

      <div className="layout">
        <aside className="sidebar no-print">
          <section className="card">
            <h2>Commande client</h2>
            <label>N° commande</label><input value={orderNumber} onChange={e=>setOrderNumber(e.target.value)} />
            <label>Client</label><input value={customerName} onChange={e=>setCustomerName(e.target.value)} />
            <label>Téléphone</label><input value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)} />
            <label>Chantier</label><input value={jobSite} onChange={e=>setJobSite(e.target.value)} />
            <label>Commercial</label><input value={salesName} onChange={e=>setSalesName(e.target.value)} />
            <label>Opérateur</label><input value={operatorName} onChange={e=>setOperatorName(e.target.value)} />
          </section>

          <section className="card">
            <h2>Matière</h2>
            <select value={materialIndex} onChange={e=>setMaterialIndex(Number(e.target.value))}>
              {MATERIALS.map((m,i)=><option key={i} value={i}>{m.product} — {m.thickness} — {m.width} x {m.height} — {m.priceM2.toFixed(2)} €/m²</option>)}
            </select>
            <div className="grid2">
              <div><label>Trait scie mm</label><input type="number" value={kerfMm} onChange={e=>setKerfMm(e.target.value)} /></div>
              <div><label>Coeff.</label><input readOnly value={material.coefficient} /></div>
            </div>
            <label className="check"><input type="checkbox" checked={allowRotation} onChange={e=>setAllowRotation(e.target.checked)} /> Rotation intelligente</label>
            <label className="check"><input type="checkbox" checked={respectGrain} onChange={e=>setRespectGrain(e.target.checked)} /> Respect sens du fil / décor</label>
          </section>

          <section className="card">
            <h2>Optimisation</h2>
            <label>Type de bandes</label>
            <select value={bandMode} onChange={e=>setBandMode(e.target.value)}>
              <option value="auto">Automatique</option>
              <option value="horizontal">Bandes horizontales</option>
              <option value="vertical">Bandes verticales</option>
            </select>
            <label>Chute réutilisable mini cm</label>
            <input type="number" value={minReusableWaste} onChange={e=>setMinReusableWaste(e.target.value)} />
            <div className="notice"><Scissors size={16}/> Mode atelier premium : bandes, ordre de coupe et chutes.</div>
          </section>

          <section className="card">
            <h2>Pièces</h2>
            {items.map(item=>(
              <div className="item" key={item.id}>
                <input value={item.label} onChange={e=>updateItem(item.id,'label',e.target.value)} />
                <div className="grid3">
                  <input type="number" step="0.1" value={item.w} onChange={e=>updateItem(item.id,'w',e.target.value)} />
                  <input type="number" step="0.1" value={item.h} onChange={e=>updateItem(item.id,'h',e.target.value)} />
                  <input type="number" value={item.qty} onChange={e=>updateItem(item.id,'qty',e.target.value)} />
                </div>
                <button className="danger" onClick={()=>removeItem(item.id)}><Trash2 size={14}/> Supprimer</button>
              </div>
            ))}
            <button onClick={addItem}><Plus size={16}/> Ajouter pièce</button>
          </section>

          <section className="card">
            <h2>Chiffrage</h2>
            <div className="grid2">
              <div><label>Prépa min</label><input type="number" value={machineSetupMin} onChange={e=>setMachineSetupMin(e.target.value)} /></div>
              <div><label>Min / trait</label><input type="number" value={cutSpeedMin} onChange={e=>setCutSpeedMin(e.target.value)} /></div>
              <div><label>€/h découpe</label><input type="number" value={hourlyCutRate} onChange={e=>setHourlyCutRate(e.target.value)} /></div>
              <div><label>TVA %</label><input type="number" value={vatRate} onChange={e=>setVatRate(e.target.value)} /></div>
            </div>
            <label>Arrondi HT</label>
            <select value={roundingStep} onChange={e=>setRoundingStep(e.target.value)}>
              <option value="0.5">0,50 € supérieur</option>
              <option value="1">1 € supérieur</option>
              <option value="5">5 € supérieur</option>
              <option value="10">10 € supérieur</option>
            </select>
            <div className="actions">
              <button onClick={saveOrder}><Save size={16}/> Sauver</button>
              <button onClick={exportPdf}><Download size={16}/> PDF atelier</button>
              <button onClick={exportClientPdf}><FileText size={16}/> PDF client</button>
            </div>
            <button className="print-btn" onClick={()=>window.print()}><Printer size={16}/> Imprimer aperçu</button>
          </section>

          <section className="card">
            <h2>Historique</h2>
            {orders.length === 0 && <p className="muted">Aucune commande sauvegardée.</p>}
            {orders.map(o=>(
              <div className="history" key={o.id}>
                <b>{o.orderNumber}</b><br />
                <span>{o.customerName} — {o.date}</span><br />
                <span>{o.panels} plaques — {o.ttc.toFixed(2)} € TTC</span>
                <button onClick={()=>loadOrder(o)}><FolderOpen size={14}/> Ouvrir</button>
              </div>
            ))}
          </section>
        </aside>

        <main className="main">
          <section className="premium-header">
            <img src="/logo-bati-brico.png" alt="BATI BRICO France Matériaux" />
            <div className="doc-title">
              <h1>FEUILLE ATELIER DÉBIT PANNEAUX</h1>
              <p>Document technique généré automatiquement — BATI BRICO</p>
            </div>
          </section>

          <section className="client-doc-title">
            <img src="/logo-bati-brico.png" alt="BATI BRICO France Matériaux" />
            <h1>DEVIS DÉCOUPE PANNEAUX</h1>
            <p>Préparation atelier BATI BRICO</p>
          </section>

          <section className="info-grid">
            <div className="info-card">
              <h3>Commande</h3>
              <p><b>N° :</b> {orderNumber}</p>
              <p><b>Date :</b> {new Date().toLocaleDateString()}</p>
              <p><b>Commercial :</b> {salesName || '—'}</p>
              <p><b>Opérateur :</b> {operatorName}</p>
            </div>
            <div className="info-card">
              <h3>Client</h3>
              <p><b>Nom :</b> {customerName}</p>
              <p><b>Téléphone :</b> {customerPhone || '—'}</p>
              <p><b>Chantier :</b> {jobSite || '—'}</p>
            </div>
            <div className="info-card">
              <h3>Matière</h3>
              <p><b>Produit :</b> {material.product}</p>
              <p><b>Épaisseur :</b> {material.thickness}</p>
              <p><b>Format :</b> {material.width} x {material.height} cm</p>
              <p><b>Trait :</b> {kerfMm} mm</p>
            </div>
          </section>

          {impossible.length > 0 && (
            <section className="alert">
              <b>Attention :</b> certaines pièces ne rentrent pas dans le panneau choisi.
              {impossible.map(p => <div key={p.id}>{p.label} — {p.w} x {p.h} cm</div>)}
            </section>
          )}

          <section className="summary">
            <div><span>Panneaux</span><b>{panels.length}</b></div>
            <div><span>Pièces</span><b>{totalPieces}</b></div>
            <div><span>Rendement</span><b>{yieldRate.toFixed(1)}%</b></div>
            <div><span>Traits estimés</span><b>{estimatedCuts}</b></div>
            <div><span>Temps atelier</span><b>{estimatedMachineTime.toFixed(1)} min</b></div>
            <div><span>Matière</span><b>{format(materialCost)} €</b></div>
            <div><span>Découpe</span><b>{format(cuttingCost)} €</b></div>
            <div><span>Prix HT</span><b>{format(recommendedHT)} €</b></div>
            <div><span>Prix TTC</span><b>{format(recommendedTTC)} €</b></div>
            <div><span>Marge</span><b>{format(margin)} € / {marginRate.toFixed(1)}%</b></div>
          </section>

          <section className="client-only">
            <h2>Récapitulatif client</h2>
            <table>
              <thead><tr><th>Désignation</th><th>Dimensions</th><th>Quantité</th></tr></thead>
              <tbody>{items.map(i=><tr key={i.id}><td>{i.label}</td><td>{i.w} x {i.h} cm</td><td>{i.qty}</td></tr>)}</tbody>
            </table>
            <div className="client-total">
              <span>Total TTC conseillé</span>
              <strong>{format(recommendedTTC)} €</strong>
            </div>
          </section>

          <h2 className="atelier-only">Plan de débit atelier</h2>
          <div className="panels atelier-only">
            {panels.map((panel, idx)=>{
              const scale = Math.min(370/material.width, 520/material.height)
              return (
                <div className="panel-card" key={idx}>
                  <div className="panel-title"><h3>PLAQUE {idx+1}</h3><span>{panel.bands.length} bandes</span></div>
                  <div className="sheet" style={{width: material.width*scale, height: material.height*scale}}>
                    {panel.bands.map((b,i)=><div key={'b'+i} className="band" style={{left:b.x*scale, top:b.y*scale, width:b.w*scale, height:b.h*scale}}>B{i+1}</div>)}
                    {panel.pieces.map((p,i)=>(
                      <div key={i} className="piece" style={{left:p.x*scale, top:p.y*scale, width:p.w*scale, height:p.h*scale, background:p.color}}>
                        <b>{p.pieceNo}</b><br />{p.w.toFixed(1)} x {p.h.toFixed(1)}{p.rotated ? <><br/>tourné</> : null}
                      </div>
                    ))}
                    {panel.offcuts.map((o,i)=><div key={'o'+i} className="offcut" style={{left:o.x*scale, top:o.y*scale, width:o.w*scale, height:o.h*scale}}>CHUTE<br />{o.w.toFixed(1)} x {o.h.toFixed(1)}</div>)}
                  </div>
                </div>
              )
            })}
          </div>

          <section className="cutlist atelier-only">
            <h2>Ordre réel des coupes</h2>
            <table>
              <thead><tr><th>#</th><th>Plaque</th><th>Action</th><th>Détail</th></tr></thead>
              <tbody>{cutOrder.map(r=><tr key={r.step} className={r.type==='band'?'band-row':''}><td>{r.step}</td><td>{r.panel}</td><td>{r.action}</td><td>{r.detail}</td></tr>)}</tbody>
            </table>
          </section>

          <section className="cutlist atelier-only">
            <h2>Liste des pièces numérotées</h2>
            <table>
              <thead><tr><th>N°</th><th>Pièce</th><th>Dimensions</th><th>Plaque</th><th>Rotation</th></tr></thead>
              <tbody>{allPieces.map(p=><tr key={p.id}><td><b>{p.pieceNo}</b></td><td>{p.label}</td><td>{p.w.toFixed(1)} x {p.h.toFixed(1)} cm</td><td>{p.panelNo}</td><td>{p.rotated ? 'Oui' : 'Non'}</td></tr>)}</tbody>
            </table>
          </section>

          <section className="cutlist atelier-only">
            <h2>Chutes réutilisables</h2>
            <table>
              <thead><tr><th>Plaque</th><th>Type</th><th>Dimensions</th><th>Surface</th></tr></thead>
              <tbody>
                {sortedOffcuts.length === 0 && <tr><td colSpan="4">Aucune chute réutilisable détectée.</td></tr>}
                {sortedOffcuts.map((o,i)=><tr key={i}><td>{o.panel}</td><td>{o.type}</td><td>{o.w.toFixed(1)} x {o.h.toFixed(1)} cm</td><td>{(o.area/10000).toFixed(2)} m²</td></tr>)}
              </tbody>
            </table>
          </section>

          <section className="signatures atelier-only"><div>Signature atelier</div><div>Validation client</div></section>
        </main>
      </div>
    </div>
  )
}
