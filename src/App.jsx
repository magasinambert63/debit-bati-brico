import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Printer, Download, Save, FolderOpen, Scissors } from 'lucide-react'

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

function expandPieces(items, allowRotation, respectGrain) {
  const pieces = []
  items.forEach(item => {
    for (let i = 0; i < Number(item.qty || 0); i++) {
      pieces.push({
        id: `${item.id}-${i}`,
        label: item.label || 'Pièce',
        originalW: Number(item.w),
        originalH: Number(item.h),
        w: Number(item.w),
        h: Number(item.h),
        color: item.color,
        allowRotation: allowRotation && !respectGrain
      })
    }
  })
  return pieces.filter(p => p.w > 0 && p.h > 0)
}

function canFit(piece, sheetW, sheetH) {
  if (piece.w <= sheetW && piece.h <= sheetH) return true
  if (piece.allowRotation && piece.h <= sheetW && piece.w <= sheetH) return true
  return false
}

function orientPieceForBand(piece, bandType, remainingLength, bandThickness) {
  const variants = [{ w: piece.w, h: piece.h, rotated: false }]
  if (piece.allowRotation && piece.w !== piece.h) variants.push({ w: piece.h, h: piece.w, rotated: true })

  const valid = variants.filter(v => {
    if (bandType === 'horizontal') return v.w <= remainingLength && v.h <= bandThickness
    return v.h <= remainingLength && v.w <= bandThickness
  })

  if (!valid.length) return null

  valid.sort((a, b) => {
    const aWaste = bandType === 'horizontal' ? (bandThickness - a.h) : (bandThickness - a.w)
    const bWaste = bandType === 'horizontal' ? (bandThickness - b.h) : (bandThickness - b.w)
    return aWaste - bWaste
  })

  return valid[0]
}

function buildBand(panel, pieces, sheetW, sheetH, kerf, bandType, minReusableWaste) {
  if (pieces.length === 0) return null

  const first = pieces[0]
  const firstVariants = [{ w: first.w, h: first.h, rotated: false }]
  if (first.allowRotation && first.w !== first.h) firstVariants.push({ w: first.h, h: first.w, rotated: true })

  const startOptions = firstVariants
    .filter(v => v.w <= sheetW && v.h <= sheetH)
    .map(v => ({
      firstVariant: v,
      thickness: bandType === 'horizontal' ? v.h : v.w,
      length: bandType === 'horizontal' ? sheetW : sheetH,
    }))
    .sort((a, b) => b.thickness - a.thickness)

  if (!startOptions.length) return null

  let bestBand = null

  for (const option of startOptions) {
    const band = {
      type: bandType,
      x: bandType === 'horizontal' ? 0 : panel.used,
      y: bandType === 'horizontal' ? panel.used : 0,
      w: bandType === 'horizontal' ? sheetW : option.thickness,
      h: bandType === 'horizontal' ? option.thickness : sheetH,
      thickness: option.thickness,
      pieces: [],
      usedLength: 0,
      offcuts: []
    }

    let lengthCursor = 0
    const usedPieceIds = new Set()

    const place = (piece, variant) => {
      const p = {
        ...piece,
        w: variant.w,
        h: variant.h,
        rotated: variant.rotated,
        x: bandType === 'horizontal' ? lengthCursor : band.x,
        y: bandType === 'horizontal' ? band.y : lengthCursor
      }
      if (bandType === 'vertical') {
        p.x = band.x
        p.y = lengthCursor
      }
      band.pieces.push(p)
      lengthCursor += (bandType === 'horizontal' ? variant.w : variant.h) + kerf
      band.usedLength = lengthCursor - kerf
      usedPieceIds.add(piece.id)
    }

    place(first, option.firstVariant)

    for (const piece of pieces.slice(1)) {
      if (usedPieceIds.has(piece.id)) continue
      const remaining = option.length - lengthCursor
      const variant = orientPieceForBand(piece, bandType, remaining, option.thickness)
      if (variant) place(piece, variant)
    }

    const bandArea = band.w * band.h
    const piecesArea = band.pieces.reduce((sum, p) => sum + p.w * p.h, 0)
    const waste = bandArea - piecesArea
    const fillRate = piecesArea / bandArea

    const endWasteLength = option.length - band.usedLength - kerf
    if (endWasteLength >= minReusableWaste) {
      band.offcuts.push({
        x: bandType === 'horizontal' ? band.usedLength + kerf : band.x,
        y: bandType === 'horizontal' ? band.y : band.usedLength + kerf,
        w: bandType === 'horizontal' ? endWasteLength : option.thickness,
        h: bandType === 'horizontal' ? option.thickness : endWasteLength,
        type: 'fin de bande'
      })
    }

    band.score = fillRate * 1000 - waste * 0.01 + band.pieces.length * 10

    if (!bestBand || band.score > bestBand.score) bestBand = band
  }

  return bestBand
}

function packByBands(sheetW, sheetH, kerf, items, settings) {
  const { allowRotation, respectGrain, bandMode, minReusableWaste } = settings
  let remaining = expandPieces(items, allowRotation, respectGrain)

  const impossible = remaining.filter(p => !canFit(p, sheetW, sheetH))
  remaining = remaining.filter(p => canFit(p, sheetW, sheetH))

  remaining.sort((a, b) => {
    const aMax = Math.max(a.w, a.h)
    const bMax = Math.max(b.w, b.h)
    if (bMax !== aMax) return bMax - aMax
    return b.w * b.h - a.w * a.h
  })

  const panels = []

  while (remaining.length > 0) {
    const panel = {
      pieces: [],
      bands: [],
      offcuts: [],
      used: 0,
      type: bandMode
    }

    while (remaining.length > 0) {
      const available = bandMode === 'vertical' ? sheetW - panel.used : sheetH - panel.used
      if (available <= 0) break

      const candidatePieces = remaining.filter(p => {
        if (bandMode === 'horizontal') {
          return (p.h <= available && p.w <= sheetW) || (p.allowRotation && p.w <= available && p.h <= sheetW)
        }
        return (p.w <= available && p.h <= sheetH) || (p.allowRotation && p.h <= available && p.w <= sheetH)
      })

      if (!candidatePieces.length) break

      const band = buildBand(panel, candidatePieces, sheetW, sheetH, kerf, bandMode, minReusableWaste)
      if (!band || !band.pieces.length) break

      panel.bands.push(band)
      panel.pieces.push(...band.pieces)
      panel.offcuts.push(...band.offcuts)
      panel.used += band.thickness + kerf

      const usedIds = new Set(band.pieces.map(p => p.id))
      remaining = remaining.filter(p => !usedIds.has(p.id))
    }

    const remainingWidth = bandMode === 'vertical' ? sheetW - panel.used : sheetW
    const remainingHeight = bandMode === 'horizontal' ? sheetH - panel.used : sheetH

    if (bandMode === 'horizontal' && remainingHeight >= minReusableWaste) {
      panel.offcuts.push({ x: 0, y: panel.used, w: sheetW, h: remainingHeight, type: 'reste panneau' })
    }

    if (bandMode === 'vertical' && remainingWidth >= minReusableWaste) {
      panel.offcuts.push({ x: panel.used, y: 0, w: remainingWidth, h: sheetH, type: 'reste panneau' })
    }

    panels.push(panel)
  }

  return { panels, impossible }
}

function packAuto(sheetW, sheetH, kerf, items, settings) {
  const horizontal = packByBands(sheetW, sheetH, kerf, items, { ...settings, bandMode: 'horizontal' })
  const vertical = packByBands(sheetW, sheetH, kerf, items, { ...settings, bandMode: 'vertical' })

  const score = (res) => {
    const panels = res.panels.length
    const reusable = res.panels.flatMap(p => p.offcuts).reduce((s, o) => s + o.w * o.h, 0)
    const tinyWastePenalty = res.panels.flatMap(p => p.offcuts).filter(o => o.w < 30 || o.h < 30).length * 5000
    return panels * 1000000 - reusable + tinyWastePenalty
  }

  return score(horizontal) <= score(vertical) ? horizontal : vertical
}

function formatNumber(n) {
  return Number(n || 0).toFixed(2)
}

export default function App() {
  const [materialIndex, setMaterialIndex] = useState(4)
  const [kerfMm, setKerfMm] = useState(4)
  const [allowRotation, setAllowRotation] = useState(true)
  const [respectGrain, setRespectGrain] = useState(false)
  const [bandMode, setBandMode] = useState('auto')
  const [minReusableWaste, setMinReusableWaste] = useState(20)
  const [orderNumber, setOrderNumber] = useState('CMD-2026-0001')
  const [customerName, setCustomerName] = useState('Client comptoir')
  const [operatorName, setOperatorName] = useState('Atelier BATI BRICO')
  const [machineSetupMin, setMachineSetupMin] = useState(8)
  const [cutSpeedMin, setCutSpeedMin] = useState(2)
  const [hourlyCutRate, setHourlyCutRate] = useState(40)
  const [vatRate, setVatRate] = useState(20)
  const [roundingStep, setRoundingStep] = useState(0.5)
  const [orders, setOrders] = useState([])
  const [items, setItems] = useState([
    { id: 1, label: 'Petit panneau', w: 89.6, h: 29.7, qty: 14, color: '#bfdbfe' },
    { id: 2, label: 'Grand panneau', w: 100, h: 95, qty: 2, color: '#fde68a' },
  ])

  const material = MATERIALS[materialIndex]
  const kerf = Number(kerfMm || 0) / 10

  useEffect(() => {
    const saved = localStorage.getItem('bati-brico-orders-v2')
    if (saved) setOrders(JSON.parse(saved))
  }, [])

  const result = useMemo(() => {
    const settings = { allowRotation, respectGrain, bandMode, minReusableWaste: Number(minReusableWaste || 20) }
    if (bandMode === 'auto') return packAuto(material.width, material.height, kerf, items, settings)
    return packByBands(material.width, material.height, kerf, items, settings)
  }, [material, kerf, items, allowRotation, respectGrain, bandMode, minReusableWaste])

  const panels = result.panels
  const impossible = result.impossible || []
  const sortedOffcuts = panels
    .flatMap((p, panelIdx) => p.offcuts.map(o => ({ ...o, panel: panelIdx + 1, area: o.w * o.h })))
    .sort((a, b) => b.area - a.area)

  const sheetAreaM2 = material.width * material.height / 10000
  const pricePerSheet = sheetAreaM2 * material.priceM2
  const materialCost = panels.length * pricePerSheet
  const totalPieces = items.reduce((s,i)=>s+Number(i.qty||0),0)
  const estimatedCuts = totalPieces * 2 + panels.reduce((s,p)=>s+p.bands.length,0)
  const estimatedMachineTime = Number(machineSetupMin) + estimatedCuts * Number(cutSpeedMin)
  const cuttingCost = estimatedMachineTime / 60 * Number(hourlyCutRate)
  const costPrice = materialCost + cuttingCost
  const recommendedHTRaw = costPrice * material.coefficient
  const recommendedHT = Math.ceil(recommendedHTRaw / Number(roundingStep)) * Number(roundingStep)
  const recommendedTTC = recommendedHT * (1 + Number(vatRate) / 100)
  const margin = recommendedHT - costPrice
  const marginRate = recommendedHT > 0 ? margin / recommendedHT * 100 : 0

  const addItem = () => setItems([...items, { id: Date.now(), label:'Nouvelle pièce', w:50, h:30, qty:1, color:'#bbf7d0' }])
  const updateItem = (id, key, value) => setItems(items.map(i => i.id === id ? {...i, [key]: value} : i))
  const removeItem = id => setItems(items.filter(i => i.id !== id))

  const saveOrder = () => {
    const data = { id: Date.now(), date: new Date().toLocaleDateString(), orderNumber, customerName, operatorName, materialIndex, items, ttc: recommendedTTC, panels: panels.length }
    const next = [data, ...orders]
    setOrders(next)
    localStorage.setItem('bati-brico-orders-v2', JSON.stringify(next))
  }

  const loadOrder = (o) => {
    setOrderNumber(o.orderNumber)
    setCustomerName(o.customerName)
    setOperatorName(o.operatorName)
    setMaterialIndex(o.materialIndex)
    setItems(o.items)
  }

  const exportPdf = () => {
    document.title = `${orderNumber}_${customerName}_Debit_BATI_BRICO_PRO`
    window.print()
  }

  return (
    <div className="app">
      <header className="top no-print">
        <div>
          <h1>BATI BRICO</h1>
          <p>Débit de coupe automatique PRO — logique scie à format</p>
        </div>
        <div className="badge">
          <span>Plaques nécessaires</span>
          <strong>{panels.length}</strong>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar no-print">
          <section className="card">
            <h2>Commande client</h2>
            <label>N° commande</label><input value={orderNumber} onChange={e=>setOrderNumber(e.target.value)} />
            <label>Client</label><input value={customerName} onChange={e=>setCustomerName(e.target.value)} />
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
            <h2>Optimisation PRO</h2>
            <label>Type de bandes</label>
            <select value={bandMode} onChange={e=>setBandMode(e.target.value)}>
              <option value="auto">Automatique : meilleur résultat</option>
              <option value="horizontal">Bandes horizontales</option>
              <option value="vertical">Bandes verticales</option>
            </select>
            <label>Chute réutilisable minimum cm</label>
            <input type="number" value={minReusableWaste} onChange={e=>setMinReusableWaste(e.target.value)} />
            <div className="notice">
              <Scissors size={16}/> V2 PRO : placement par bandes, coupes guillotine, tri des chutes.
            </div>
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
              <button onClick={exportPdf}><Download size={16}/> PDF</button>
              <button onClick={()=>window.print()}><Printer size={16}/> Imprimer</button>
            </div>
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
          <section className="print-header">
            <div><h1>BATI BRICO</h1><p>Feuille atelier PRO — Débit par bandes</p><p>Construire demain ensemble</p></div>
            <div>
              <p><b>Date :</b> {new Date().toLocaleDateString()}</p>
              <p><b>Commande :</b> {orderNumber}</p>
              <p><b>Client :</b> {customerName}</p>
              <p><b>Opérateur :</b> {operatorName}</p>
            </div>
          </section>

          {impossible.length > 0 && (
            <section className="alert">
              <b>Attention :</b> certaines pièces ne rentrent pas dans le panneau choisi.
              {impossible.map(p => <div key={p.id}>{p.label} — {p.w} x {p.h} cm</div>)}
            </section>
          )}

          <section className="summary">
            <div><span>Produit</span><b>{material.product} {material.thickness}</b></div>
            <div><span>Format</span><b>{material.width} x {material.height}</b></div>
            <div><span>Mode coupe</span><b>{bandMode}</b></div>
            <div><span>Plaques</span><b>{panels.length}</b></div>
            <div><span>Matière</span><b>{formatNumber(materialCost)} €</b></div>
            <div><span>Découpe</span><b>{formatNumber(cuttingCost)} €</b></div>
            <div><span>Prix HT</span><b>{formatNumber(recommendedHT)} €</b></div>
            <div><span>Prix TTC</span><b>{formatNumber(recommendedTTC)} €</b></div>
            <div><span>Marge</span><b>{formatNumber(margin)} € / {marginRate.toFixed(1)}%</b></div>
          </section>

          <h2>Plan de débit PRO</h2>
          <div className="panels">
            {panels.map((panel, idx)=>{
              const scale = Math.min(360/material.width, 520/material.height)
              return (
                <div className="panel-card" key={idx}>
                  <div className="panel-title">
                    <h3>PLAQUE {idx+1}</h3>
                    <span>{panel.bands.length} bandes</span>
                  </div>
                  <div className="sheet" style={{width: material.width*scale, height: material.height*scale}}>
                    {panel.bands.map((b,i)=>(
                      <div key={'b'+i} className="band" style={{left:b.x*scale, top:b.y*scale, width:b.w*scale, height:b.h*scale}}>
                        Bande {i+1}
                      </div>
                    ))}
                    {panel.pieces.map((p,i)=>(
                      <div key={i} className="piece" style={{left:p.x*scale, top:p.y*scale, width:p.w*scale, height:p.h*scale, background:p.color}}>
                        {p.w.toFixed(1)} x {p.h.toFixed(1)}<br />{p.rotated ? 'tourné' : ''}
                      </div>
                    ))}
                    {panel.offcuts.map((o,i)=>(
                      <div key={'o'+i} className="offcut" style={{left:o.x*scale, top:o.y*scale, width:o.w*scale, height:o.h*scale}}>
                        chute<br />{o.w.toFixed(1)} x {o.h.toFixed(1)}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <section className="cutlist">
            <h2>Liste de coupe</h2>
            <table>
              <thead><tr><th>Pièce</th><th>Dimensions</th><th>Qté</th></tr></thead>
              <tbody>{items.map(i=><tr key={i.id}><td>{i.label}</td><td>{i.w} x {i.h} cm</td><td>{i.qty}</td></tr>)}</tbody>
            </table>
          </section>

          <section className="cutlist">
            <h2>Chutes réutilisables triées</h2>
            <table>
              <thead><tr><th>Plaque</th><th>Type</th><th>Dimensions</th><th>Surface</th></tr></thead>
              <tbody>
                {sortedOffcuts.length === 0 && <tr><td colSpan="4">Aucune chute réutilisable détectée.</td></tr>}
                {sortedOffcuts.map((o,i)=>(
                  <tr key={i}><td>{o.panel}</td><td>{o.type}</td><td>{o.w.toFixed(1)} x {o.h.toFixed(1)} cm</td><td>{(o.area/10000).toFixed(2)} m²</td></tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="signatures"><div>Signature atelier</div><div>Validation client</div></section>
        </main>
      </div>
    </div>
  )
}
