import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Printer, Download, Save, FolderOpen } from 'lucide-react'

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

function rectsOverlap(a, b, kerf) {
  return !(a.x + a.w + kerf <= b.x || b.x + b.w + kerf <= a.x || a.y + a.h + kerf <= b.y || b.y + b.h + kerf <= a.y)
}

function makePieces(items, allowRotation, respectGrain) {
  const out = []
  items.forEach(item => {
    for (let i = 0; i < Number(item.qty || 0); i++) {
      out.push({ id: `${item.id}-${i}`, label: item.label || 'Pièce', w: Number(item.w), h: Number(item.h), color: item.color, allowRotation: allowRotation && !respectGrain })
    }
  })
  return out.filter(p => p.w > 0 && p.h > 0)
}

function pack(sheetW, sheetH, kerf, items, allowRotation, respectGrain) {
  const pieces = makePieces(items, allowRotation, respectGrain).sort((a,b) => b.w*b.h - a.w*a.h)
  const panels = []

  const tryPanel = (panel, piece) => {
    const variants = [{w:piece.w,h:piece.h,rot:false}]
    if (piece.allowRotation && piece.w !== piece.h) variants.push({w:piece.h,h:piece.w,rot:true})
    let best = null

    for (const v of variants) {
      if (v.w > sheetW || v.h > sheetH) continue
      for (let y = 0; y <= sheetH - v.h; y += 1) {
        let foundOnLine = false
        for (let x = 0; x <= sheetW - v.w; x += 1) {
          const cand = {x,y,w:v.w,h:v.h}
          if (!panel.pieces.some(p => rectsOverlap(cand, p, kerf))) {
            const score = y * sheetW + x
            if (!best || score < best.score) best = { ...cand, rotated:v.rot, score }
            foundOnLine = true
            break
          }
        }
        if (foundOnLine) break
      }
    }

    if (!best) return false
    panel.pieces.push({ ...piece, ...best })
    return true
  }

  for (const piece of pieces) {
    let placed = false
    for (const panel of panels) {
      if (tryPanel(panel, piece)) { placed = true; break }
    }
    if (!placed) {
      const panel = { pieces: [] }
      tryPanel(panel, piece)
      panels.push(panel)
    }
  }

  return panels.map(panel => {
    const maxY = panel.pieces.reduce((m,p) => Math.max(m, p.y + p.h), 0)
    const maxX = panel.pieces.reduce((m,p) => Math.max(m, p.x + p.w), 0)
    return {
      ...panel,
      offcuts: [
        {x:0, y:maxY + kerf, w:sheetW, h:Math.max(0, sheetH - maxY - kerf)},
        {x:maxX + kerf, y:0, w:Math.max(0, sheetW - maxX - kerf), h:Math.min(sheetH, maxY)}
      ].filter(o => o.w >= 20 && o.h >= 20)
    }
  })
}

export default function App() {
  const [materialIndex, setMaterialIndex] = useState(4)
  const [kerfMm, setKerfMm] = useState(4)
  const [allowRotation, setAllowRotation] = useState(true)
  const [respectGrain, setRespectGrain] = useState(false)
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
    const saved = localStorage.getItem('bati-brico-orders')
    if (saved) setOrders(JSON.parse(saved))
  }, [])

  const panels = useMemo(() => pack(material.width, material.height, kerf, items, allowRotation, respectGrain), [material, kerf, items, allowRotation, respectGrain])

  const sheetAreaM2 = material.width * material.height / 10000
  const pricePerSheet = sheetAreaM2 * material.priceM2
  const materialCost = panels.length * pricePerSheet
  const totalPieces = items.reduce((s,i)=>s+Number(i.qty||0),0)
  const estimatedCuts = totalPieces * 2 + panels.length
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
    localStorage.setItem('bati-brico-orders', JSON.stringify(next))
  }

  const loadOrder = (o) => {
    setOrderNumber(o.orderNumber); setCustomerName(o.customerName); setOperatorName(o.operatorName)
    setMaterialIndex(o.materialIndex); setItems(o.items)
  }

  const exportPdf = () => {
    document.title = `${orderNumber}_${customerName}_Debit_BATI_BRICO`
    window.print()
  }

  return (
    <div className="app">
      <header className="top no-print">
        <div><h1>BATI BRICO</h1><p>Débit de coupe automatique — panneaux bois</p></div>
        <div className="badge"><span>Plaques nécessaires</span><strong>{panels.length}</strong></div>
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
            <label className="check"><input type="checkbox" checked={allowRotation} onChange={e=>setAllowRotation(e.target.checked)} /> Rotation autorisée</label>
            <label className="check"><input type="checkbox" checked={respectGrain} onChange={e=>setRespectGrain(e.target.checked)} /> Respect sens du fil</label>
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
            <div><h1>BATI BRICO</h1><p>Feuille atelier — Débit de coupe panneaux</p><p>Construire demain ensemble</p></div>
            <div>
              <p><b>Date :</b> {new Date().toLocaleDateString()}</p>
              <p><b>Commande :</b> {orderNumber}</p>
              <p><b>Client :</b> {customerName}</p>
              <p><b>Opérateur :</b> {operatorName}</p>
            </div>
          </section>

          <section className="summary">
            <div><span>Produit</span><b>{material.product} {material.thickness}</b></div>
            <div><span>Format</span><b>{material.width} x {material.height}</b></div>
            <div><span>Plaques</span><b>{panels.length}</b></div>
            <div><span>Matière</span><b>{materialCost.toFixed(2)} €</b></div>
            <div><span>Découpe</span><b>{cuttingCost.toFixed(2)} €</b></div>
            <div><span>Prix HT</span><b>{recommendedHT.toFixed(2)} €</b></div>
            <div><span>Prix TTC</span><b>{recommendedTTC.toFixed(2)} €</b></div>
            <div><span>Marge</span><b>{margin.toFixed(2)} € / {marginRate.toFixed(1)}%</b></div>
          </section>

          <h2>Plan de débit</h2>
          <div className="panels">
            {panels.map((panel, idx)=>{
              const scale = Math.min(360/material.width, 520/material.height)
              return (
                <div className="panel-card" key={idx}>
                  <h3>PLAQUE {idx+1}</h3>
                  <div className="sheet" style={{width: material.width*scale, height: material.height*scale}}>
                    {panel.pieces.map((p,i)=><div key={i} className="piece" style={{left:p.x*scale, top:p.y*scale, width:p.w*scale, height:p.h*scale, background:p.color}}>{p.w.toFixed(1)} x {p.h.toFixed(1)}<br />{p.rotated ? 'tourné' : ''}</div>)}
                    {panel.offcuts.map((o,i)=><div key={'o'+i} className="offcut" style={{left:o.x*scale, top:o.y*scale, width:o.w*scale, height:o.h*scale}}>chute<br />{o.w.toFixed(1)} x {o.h.toFixed(1)}</div>)}
                  </div>
                </div>
              )
            })}
          </div>

          <section className="cutlist">
            <h2>Liste de coupe</h2>
            <table><thead><tr><th>Pièce</th><th>Dimensions</th><th>Qté</th></tr></thead><tbody>{items.map(i=><tr key={i.id}><td>{i.label}</td><td>{i.w} x {i.h} cm</td><td>{i.qty}</td></tr>)}</tbody></table>
          </section>

          <section className="signatures"><div>Signature atelier</div><div>Validation client</div></section>
        </main>
      </div>
    </div>
  )
}
