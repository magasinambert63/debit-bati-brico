import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Printer, Download, Save, FolderOpen, Scissors, FileText, Archive, RotateCcw } from 'lucide-react'

const MATERIALS = [
  { product:"Radiata", thickness:"9 mm", width:250, height:125, priceM2:7.30, coefficient:1.55 },
  { product:"Radiata", thickness:"12 mm", width:250, height:125, priceM2:9.05, coefficient:1.55 },
  { product:"Radiata", thickness:"15 mm", width:250, height:125, priceM2:11.15, coefficient:1.55 },
  { product:"Radiata", thickness:"18 mm", width:250, height:125, priceM2:13.05, coefficient:1.55 },
  { product:"Radiata", thickness:"21 mm", width:250, height:125, priceM2:15.40, coefficient:1.55 },
  { product:"Okoumé", thickness:"5 mm", width:250, height:122, priceM2:8.61, coefficient:1.70 },
  { product:"Okoumé", thickness:"8 mm", width:250, height:122, priceM2:12.37, coefficient:1.70 },
  { product:"Okoumé", thickness:"10 mm", width:250, height:122, priceM2:13.45, coefficient:1.70 },
  { product:"Okoumé", thickness:"12 mm", width:250, height:122, priceM2:16.94, coefficient:1.70 },
  { product:"Okoumé", thickness:"15 mm", width:250, height:122, priceM2:19.37, coefficient:1.70 },
  { product:"Okoumé", thickness:"18 mm", width:250, height:122, priceM2:23.24, coefficient:1.70 },
  { product:"Okoumé", thickness:"22 mm", width:250, height:122, priceM2:28.12, coefficient:1.70 },
  { product:"Panneau OSB 3", thickness:"9 mm", width:250, height:125, priceM2:3.73, coefficient:1.46 },
  { product:"Panneau OSB 3", thickness:"12 mm", width:250, height:125, priceM2:4.67, coefficient:1.46 },
  { product:"Panneau OSB 3", thickness:"15 mm", width:250, height:125, priceM2:5.71, coefficient:1.46 },
  { product:"Panneau OSB 3", thickness:"18 mm", width:250, height:125, priceM2:6.75, coefficient:1.46 },
  { product:"Dalle OSB 3", thickness:"12 mm", width:250, height:67.5, priceM2:4.99, coefficient:1.44 },
  { product:"Dalle OSB 3", thickness:"15 mm", width:250, height:67.5, priceM2:5.71, coefficient:1.44 },
  { product:"Dalle OSB 3", thickness:"18 mm", width:250, height:67.5, priceM2:7.72, coefficient:1.44 },
  { product:"Dalle OSB 3", thickness:"22 mm", width:250, height:67.5, priceM2:8.82, coefficient:1.44 },
  { product:"MDF", thickness:"10 mm", width:280, height:207, priceM2:6.94, coefficient:1.45 },
  { product:"MDF", thickness:"12 mm", width:280, height:207, priceM2:4.32, coefficient:1.45 },
  { product:"MDF", thickness:"19 mm", width:280, height:207, priceM2:9.74, coefficient:1.45 },
]
const COLORS = ['#DBEAFE','#FEF3C7','#DCFCE7','#FEE2E2','#EDE9FE','#FFEDD5','#CCFBF1','#FCE7F3']
const uid = () => Math.random().toString(36).slice(2) + Date.now()

function makePieces(items, allowRotation, respectGrain) {
  const pieces=[]
  items.forEach((it,gi)=>{
    for(let i=0;i<Number(it.qty||0);i++){
      pieces.push({id:`${it.id}-${i}`, label:it.label||'Pièce', w:Number(it.w), h:Number(it.h), color:it.color||COLORS[gi%COLORS.length], allowRotation:allowRotation&&!respectGrain, group:gi+1})
    }
  })
  return pieces.filter(p=>p.w>0&&p.h>0)
}
function variants(piece){
  const v=[{...piece,w:piece.w,h:piece.h,rotated:false}]
  if(piece.allowRotation && piece.w!==piece.h) v.push({...piece,w:piece.h,h:piece.w,rotated:true})
  return v
}
function fitsIn(p,w,h){ return p.w<=w && p.h<=h }
function chooseOrientation(sheetW,sheetH,kerf,pieces,mode){
  if(mode!=='auto') return mode
  const h = simulate(sheetW,sheetH,kerf,pieces,'horizontal',false)
  const v = simulate(sheetW,sheetH,kerf,pieces,'vertical',false)
  const score = r => r.panels.length*1000000 + r.cuts*250 + r.waste*0.02
  return score(h)<=score(v)?'horizontal':'vertical'
}
function simulate(sheetW,sheetH,kerf,pieces,orientation,withDetails=true){
  let remaining=[...pieces].sort((a,b)=>{
    const keyA = orientation==='horizontal' ? Math.max(a.h,a.allowRotation?a.w:0) : Math.max(a.w,a.allowRotation?a.h:0)
    const keyB = orientation==='horizontal' ? Math.max(b.h,b.allowRotation?b.w:0) : Math.max(b.w,b.allowRotation?b.h:0)
    return keyB-keyA || b.w*b.h-a.w*a.h
  })
  const panels=[]; let impossible=[]
  while(remaining.length){
    const panel={type:'sheet',pieces:[],bands:[],offcuts:[],used:0,source:'Panneau neuf'}
    let progress=true
    while(progress && remaining.length){
      progress=false
      const available = orientation==='horizontal' ? sheetH-panel.used : sheetW-panel.used
      if(available<=0) break
      // group by compatible band thickness, prefer same height/width group
      const candidates = remaining.filter(p=>variants(p).some(v=>orientation==='horizontal'?v.h<=available&&v.w<=sheetW:v.w<=available&&v.h<=sheetH))
      if(!candidates.length) break
      candidates.sort((a,b)=>{
        const ba = bestBandThickness(a,orientation,available)
        const bb = bestBandThickness(b,orientation,available)
        return bb-ba || b.w*b.h-a.w*a.h
      })
      const seed=candidates[0]
      const seedVar = variants(seed).filter(v=>orientation==='horizontal'?v.h<=available&&v.w<=sheetW:v.w<=available&&v.h<=sheetH).sort((a,b)=>{
        const ta=orientation==='horizontal'?a.h:a.w, tb=orientation==='horizontal'?b.h:b.w
        return tb-ta
      })[0]
      if(!seedVar){ impossible.push(seed); remaining=remaining.filter(p=>p.id!==seed.id); continue }
      const thickness = orientation==='horizontal'?seedVar.h:seedVar.w
      const lengthLimit = orientation==='horizontal'?sheetW:sheetH
      let cursor=0
      const band={orientation,x:orientation==='horizontal'?0:panel.used,y:orientation==='horizontal'?panel.used:0,w:orientation==='horizontal'?sheetW:thickness,h:orientation==='horizontal'?thickness:sheetH,thickness,pieces:[],cutNo:panel.bands.length+1}
      const bandCandidates=[...remaining].sort((a,b)=>{
        const da = Math.abs(bestBandThickness(a,orientation,available)-thickness)
        const db = Math.abs(bestBandThickness(b,orientation,available)-thickness)
        return da-db || b.w*b.h-a.w*a.h
      })
      const usedIds=new Set()
      for(const p of bandCandidates){
        const rest=lengthLimit-cursor
        const v=variants(p).filter(x=>orientation==='horizontal'?x.h<=thickness&&x.w<=rest:x.w<=thickness&&x.h<=rest).sort((a,b)=>{
          const wasteA=orientation==='horizontal'?(thickness-a.h):(thickness-a.w)
          const wasteB=orientation==='horizontal'?(thickness-b.h):(thickness-b.w)
          return wasteA-wasteB || (orientation==='horizontal'?b.w-a.w:b.h-a.h)
        })[0]
        if(v){
          const placed={...p,w:v.w,h:v.h,rotated:v.rotated,x:orientation==='horizontal'?cursor:panel.used,y:orientation==='horizontal'?panel.used:cursor,bandNo:band.cutNo}
          band.pieces.push(placed); panel.pieces.push(placed); usedIds.add(p.id)
          cursor += (orientation==='horizontal'?v.w:v.h) + kerf
          progress=true
        }
      }
      if(!progress) break
      band.usedLength = cursor-kerf
      panel.bands.push(band)
      panel.used += thickness + kerf
      remaining = remaining.filter(p=>!usedIds.has(p.id))
      const restLen = lengthLimit-band.usedLength-kerf
      if(restLen>=20){
        panel.offcuts.push({x:orientation==='horizontal'?band.usedLength+kerf:panel.used-thickness-kerf,y:orientation==='horizontal'?panel.used-thickness-kerf:band.usedLength+kerf,w:orientation==='horizontal'?restLen:thickness,h:orientation==='horizontal'?thickness:restLen,type:'fin de bande'})
      }
    }
    const rest = orientation==='horizontal'?sheetH-panel.used:sheetW-panel.used
    if(rest>=20) panel.offcuts.push({x:orientation==='horizontal'?0:panel.used,y:orientation==='horizontal'?panel.used:0,w:orientation==='horizontal'?sheetW:rest,h:orientation==='horizontal'?rest:sheetH,type:'reste panneau'})
    panels.push(panel)
  }
  let no=1
  panels.forEach((pan,pi)=>pan.pieces.forEach(p=>{p.pieceNo=`P${String(no++).padStart(2,'0')}`;p.panelNo=pi+1}))
  const cuts = panels.reduce((s,p)=>s+p.bands.length+p.pieces.length*2,0)
  const usedArea = panels.flatMap(p=>p.pieces).reduce((s,p)=>s+p.w*p.h,0)
  const totalArea = panels.length*sheetW*sheetH
  return {panels,impossible,cuts,waste:Math.max(0,totalArea-usedArea),orientation}
}
function bestBandThickness(p,orientation,available){
  const vs=variants(p).filter(v=>orientation==='horizontal'?v.h<=available:v.w<=available)
  if(!vs.length) return 9999
  return Math.max(...vs.map(v=>orientation==='horizontal'?v.h:v.w))
}
function tryUseOffcuts(pieces, stock, kerf){
  let remaining=[...pieces], usedStock=[], virtualPanels=[]
  const stockSorted=[...stock].sort((a,b)=>b.w*b.h-a.w*a.h)
  for(const off of stockSorted){
    const usable=[]
    remaining = remaining.filter(piece=>{
      const v=variants(piece).filter(x=>x.w<=off.w&&x.h<=off.h).sort((a,b)=>b.w*b.h-a.w*a.h)[0]
      if(v && usable.length<8){ usable.push({...piece,...v,x:0,y:0,fromOffcut:true,offcutId:off.id}); return false }
      return true
    })
    if(usable.length){
      usedStock.push(off)
      virtualPanels.push({type:'offcut',source:`Chute stock ${off.w} x ${off.h}`,w:off.w,h:off.h,pieces:usable,bands:[],offcuts:[],used:0})
    }
  }
  return {remaining, usedStock, virtualPanels}
}
function format(n){return Number(n||0).toFixed(2)}
function csvEscape(v){ return `"${String(v??'').replaceAll('"','""')}"` }

export default function App(){
  const [materialIndex,setMaterialIndex]=useState(4), [kerfMm,setKerfMm]=useState(4)
  const [allowRotation,setAllowRotation]=useState(true), [respectGrain,setRespectGrain]=useState(false)
  const [cutMode,setCutMode]=useState('auto'), [useOffcutStock,setUseOffcutStock]=useState(true)
  const [orderNumber,setOrderNumber]=useState('CMD-2026-0001'), [customerName,setCustomerName]=useState('Client comptoir')
  const [customerPhone,setCustomerPhone]=useState(''), [jobSite,setJobSite]=useState(''), [operatorName,setOperatorName]=useState('Atelier BATI BRICO')
  const [machineSetupMin,setMachineSetupMin]=useState(8), [cutSpeedMin,setCutSpeedMin]=useState(2), [hourlyCutRate,setHourlyCutRate]=useState(40), [vatRate,setVatRate]=useState(20), [roundingStep,setRoundingStep]=useState(0.5)
  const [orders,setOrders]=useState([]), [offcutStock,setOffcutStock]=useState([])
  const [items,setItems]=useState([{id:1,label:'Petit panneau',w:89.6,h:29.7,qty:14,color:COLORS[0]},{id:2,label:'Grand panneau',w:100,h:95,qty:2,color:COLORS[1]}])
  const material=MATERIALS[materialIndex], kerf=Number(kerfMm||0)/10
  useEffect(()=>{setOrders(JSON.parse(localStorage.getItem('bb-orders-scie')||'[]'));setOffcutStock(JSON.parse(localStorage.getItem('bb-offcuts')||'[]'))},[])
  const result=useMemo(()=>{
    const all=makePieces(items,allowRotation,respectGrain)
    const off = useOffcutStock ? tryUseOffcuts(all, offcutStock.filter(o=>o.product===material.product&&o.thickness===material.thickness), kerf) : {remaining:all,usedStock:[],virtualPanels:[]}
    const orientation=chooseOrientation(material.width,material.height,kerf,off.remaining,cutMode)
    const packed=simulate(material.width,material.height,kerf,off.remaining,orientation,true)
    packed.panels=[...off.virtualPanels,...packed.panels]
    packed.usedStock=off.usedStock
    return packed
  },[items,allowRotation,respectGrain,material,kerf,cutMode,useOffcutStock,offcutStock])
  const panels=result.panels, allPieces=panels.flatMap(p=>p.pieces)
  const sortedOffcuts=panels.flatMap((p,pi)=>(p.offcuts||[]).map(o=>({...o,panel:pi+1,area:o.w*o.h,product:material.product,thickness:material.thickness}))).sort((a,b)=>b.area-a.area)
  const materialPanels=panels.filter(p=>p.type!=='offcut').length
  const sheetAreaM2=material.width*material.height/10000, pricePerSheet=sheetAreaM2*material.priceM2
  const materialCost=materialPanels*pricePerSheet, estimatedCuts=result.cuts, estimatedMachineTime=Number(machineSetupMin)+estimatedCuts*Number(cutSpeedMin)
  const cuttingCost=estimatedMachineTime/60*Number(hourlyCutRate), costPrice=materialCost+cuttingCost
  const recommendedHT=Math.ceil((costPrice*material.coefficient)/Number(roundingStep))*Number(roundingStep), recommendedTTC=recommendedHT*(1+Number(vatRate)/100)
  const margin=recommendedHT-costPrice, marginRate=recommendedHT>0?margin/recommendedHT*100:0
  const usedArea=allPieces.reduce((s,p)=>s+p.w*p.h,0), totalArea=materialPanels*material.width*material.height + panels.filter(p=>p.type==='offcut').reduce((s,p)=>s+p.w*p.h,0)
  const yieldRate=totalArea?usedArea/totalArea*100:0
  const cutOrder=panels.flatMap((p,pi)=>{
    if(p.type==='offcut') return p.pieces.map((pc,i)=>({step:0,panel:pi+1,action:`Débit sur chute stock`,detail:`${pc.label} ${pc.w} x ${pc.h}`}))
    let rows=[]; (p.bands||[]).forEach((b,bi)=>{rows.push({panel:pi+1,action:b.orientation==='horizontal'?`Bande horizontale ${b.h.toFixed(1)} cm`:`Bande verticale ${b.w.toFixed(1)} cm`,detail:`Bande ${bi+1} - ${b.pieces.length} pièce(s)`});b.pieces.forEach(pc=>rows.push({panel:pi+1,action:`Coupe ${pc.pieceNo}`,detail:`${pc.label} ${pc.w.toFixed(1)} x ${pc.h.toFixed(1)}${pc.rotated?' tournée':''}`}))}); return rows
  }).map((r,i)=>({...r,step:i+1}))
  const addItem=()=>setItems([...items,{id:Date.now(),label:'Nouvelle pièce',w:50,h:30,qty:1,color:COLORS[items.length%COLORS.length]}])
  const updateItem=(id,k,v)=>setItems(items.map(i=>i.id===id?{...i,[k]:v}:i)); const removeItem=id=>setItems(items.filter(i=>i.id!==id))
  const saveOrder=()=>{const d={id:Date.now(),date:new Date().toLocaleDateString(),orderNumber,customerName,materialIndex,items,ttc:recommendedTTC,panels:materialPanels}; const n=[d,...orders]; setOrders(n); localStorage.setItem('bb-orders-scie',JSON.stringify(n))}
  const addOffcutsToStock=()=>{const newOnes=sortedOffcuts.map(o=>({id:uid(),date:new Date().toLocaleDateString(),product:o.product,thickness:o.thickness,w:Number(o.w.toFixed(1)),h:Number(o.h.toFixed(1)),source:orderNumber})); const n=[...newOnes,...offcutStock]; setOffcutStock(n); localStorage.setItem('bb-offcuts',JSON.stringify(n))}
  const deleteOffcut=id=>{const n=offcutStock.filter(o=>o.id!==id);setOffcutStock(n);localStorage.setItem('bb-offcuts',JSON.stringify(n))}
  const loadOrder=o=>{setOrderNumber(o.orderNumber);setCustomerName(o.customerName);setMaterialIndex(o.materialIndex);setItems(o.items)}
  const exportPdf=()=>{document.body.classList.remove('client-pdf');document.body.classList.add('atelier-pdf');document.title=`${orderNumber}_PDF_ATELIER_BATI_BRICO`;setTimeout(()=>window.print(),50)}
  const exportClientPdf=()=>{document.body.classList.remove('atelier-pdf');document.body.classList.add('client-pdf');document.title=`${orderNumber}_DEVIS_BATI_BRICO`;setTimeout(()=>window.print(),50)}
  const exportCSV=()=>{const rows=[['N°','Pièce','Largeur','Hauteur','Plaque','Rotation'],...allPieces.map(p=>[p.pieceNo,p.label,p.w,p.h,p.panelNo,p.rotated?'Oui':'Non'])]; const blob=new Blob([rows.map(r=>r.map(csvEscape).join(';')).join('\n')],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`${orderNumber}_liste_coupe.csv`; a.click()}
  return <div className="app">
    <header className="top no-print"><div><img src="/logo-bati-brico.png" className="top-logo"/><p>Débit de coupe — optimisation scie à format + chutes stockables</p></div><div className="badge"><span>Panneaux neufs</span><strong>{materialPanels}</strong></div></header>
    <div className="layout"><aside className="sidebar no-print">
      <section className="card"><h2>Commande client</h2><label>N° commande</label><input value={orderNumber} onChange={e=>setOrderNumber(e.target.value)}/><label>Client</label><input value={customerName} onChange={e=>setCustomerName(e.target.value)}/><label>Téléphone</label><input value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)}/><label>Chantier</label><input value={jobSite} onChange={e=>setJobSite(e.target.value)}/><label>Opérateur</label><input value={operatorName} onChange={e=>setOperatorName(e.target.value)}/></section>
      <section className="card"><h2>Matière</h2><select value={materialIndex} onChange={e=>setMaterialIndex(Number(e.target.value))}>{MATERIALS.map((m,i)=><option key={i} value={i}>{m.product} — {m.thickness} — {m.width} x {m.height}</option>)}</select><div className="grid2"><div><label>Trait scie mm</label><input type="number" value={kerfMm} onChange={e=>setKerfMm(e.target.value)}/></div><div><label>Coeff.</label><input readOnly value={material.coefficient}/></div></div><label className="check"><input type="checkbox" checked={allowRotation} onChange={e=>setAllowRotation(e.target.checked)}/> Rotation intelligente</label><label className="check"><input type="checkbox" checked={respectGrain} onChange={e=>setRespectGrain(e.target.checked)}/> Respect sens fil/décor</label></section>
      <section className="card"><h2>Optimisation scie à format</h2><label>Mode coupe</label><select value={cutMode} onChange={e=>setCutMode(e.target.value)}><option value="auto">Automatique : meilleur sens</option><option value="horizontal">Bandes horizontales</option><option value="vertical">Bandes verticales</option></select><label className="check"><input type="checkbox" checked={useOffcutStock} onChange={e=>setUseOffcutStock(e.target.checked)}/> Utiliser les chutes stockées avant panneau neuf</label><div className="notice"><Scissors size={16}/> Orientation choisie : <b>{result.orientation}</b></div></section>
      <section className="card"><h2>Pièces</h2>{items.map(item=><div className="item" key={item.id}><input value={item.label} onChange={e=>updateItem(item.id,'label',e.target.value)}/><div className="grid3"><input type="number" step="0.1" value={item.w} onChange={e=>updateItem(item.id,'w',e.target.value)}/><input type="number" step="0.1" value={item.h} onChange={e=>updateItem(item.id,'h',e.target.value)}/><input type="number" value={item.qty} onChange={e=>updateItem(item.id,'qty',e.target.value)}/></div><button className="danger" onClick={()=>removeItem(item.id)}><Trash2 size={14}/> Supprimer</button></div>)}<button onClick={addItem}><Plus size={16}/> Ajouter pièce</button></section>
      <section className="card"><h2>Chiffrage</h2><div className="grid2"><div><label>Prépa min</label><input type="number" value={machineSetupMin} onChange={e=>setMachineSetupMin(e.target.value)}/></div><div><label>Min/trait</label><input type="number" value={cutSpeedMin} onChange={e=>setCutSpeedMin(e.target.value)}/></div><div><label>€/h découpe</label><input type="number" value={hourlyCutRate} onChange={e=>setHourlyCutRate(e.target.value)}/></div><div><label>TVA %</label><input type="number" value={vatRate} onChange={e=>setVatRate(e.target.value)}/></div></div><label>Arrondi HT</label><select value={roundingStep} onChange={e=>setRoundingStep(e.target.value)}><option value="0.5">0,50 € supérieur</option><option value="1">1 € supérieur</option><option value="5">5 € supérieur</option><option value="10">10 € supérieur</option></select><div className="actions"><button onClick={saveOrder}><Save size={16}/> Sauver</button><button onClick={exportPdf}><Download size={16}/> PDF atelier</button><button onClick={exportClientPdf}><FileText size={16}/> PDF client</button></div><button className="print-btn" onClick={exportCSV}>Export Excel CSV</button></section>
      <section className="card"><h2>Stock chutes</h2><button onClick={addOffcutsToStock}><Archive size={16}/> Ajouter les chutes du débit au stock</button>{offcutStock.length===0&&<p className="muted">Aucune chute stockée.</p>}{offcutStock.slice(0,8).map(o=><div className="history" key={o.id}><b>{o.product} {o.thickness}</b><br/><span>{o.w} x {o.h} cm — {o.source}</span><button onClick={()=>deleteOffcut(o.id)}><Trash2 size={14}/> Retirer</button></div>)}</section>
      <section className="card"><h2>Historique</h2>{orders.length===0&&<p className="muted">Aucune commande.</p>}{orders.map(o=><div className="history" key={o.id}><b>{o.orderNumber}</b><br/><span>{o.customerName} — {o.date}</span><br/><span>{o.panels} panneaux — {o.ttc.toFixed(2)} € TTC</span><button onClick={()=>loadOrder(o)}><FolderOpen size={14}/> Ouvrir</button></div>)}</section>
    </aside>
    <main className="main"><section className="premium-header"><img src="/logo-bati-brico.png"/><div className="doc-title"><h1>FEUILLE ATELIER - SCIE À FORMAT</h1><p>Optimisation bandes + chutes stockables</p></div></section>
      <section className="info-grid"><div className="info-card"><h3>Commande</h3><p><b>N° :</b> {orderNumber}</p><p><b>Date :</b> {new Date().toLocaleDateString()}</p><p><b>Opérateur :</b> {operatorName}</p></div><div className="info-card"><h3>Client</h3><p><b>Nom :</b> {customerName}</p><p><b>Tél :</b> {customerPhone||'—'}</p><p><b>Chantier :</b> {jobSite||'—'}</p></div><div className="info-card"><h3>Matière</h3><p><b>{material.product}</b> {material.thickness}</p><p>{material.width} x {material.height} cm</p><p>Trait : {kerfMm} mm</p></div></section>
      <section className="summary"><div><span>Panneaux neufs</span><b>{materialPanels}</b></div><div><span>Chutes utilisées</span><b>{result.usedStock?.length||0}</b></div><div><span>Rendement</span><b>{yieldRate.toFixed(1)}%</b></div><div><span>Traits estimés</span><b>{estimatedCuts}</b></div><div><span>Temps</span><b>{estimatedMachineTime.toFixed(1)} min</b></div><div className="tarif-pdf-hide"><span>Matière</span><b>{format(materialCost)} €</b></div><div className="tarif-pdf-hide"><span>Découpe</span><b>{format(cuttingCost)} €</b></div><div className="tarif-pdf-hide"><span>Prix HT</span><b>{format(recommendedHT)} €</b></div><div className="tarif-pdf-hide"><span>Prix TTC</span><b>{format(recommendedTTC)} €</b></div><div className="tarif-pdf-hide"><span>Marge</span><b>{format(margin)} € / {marginRate.toFixed(1)}%</b></div></section>
      <h2>Plan de débit</h2><div className="panels">{panels.map((panel,idx)=>{const sw=panel.type==='offcut'?panel.w:material.width, sh=panel.type==='offcut'?panel.h:material.height, scale=Math.min(370/sw,520/sh);return <div className="panel-card" key={idx}><div className="panel-title"><h3>{panel.type==='offcut'?'CHUTE':'PLAQUE'} {idx+1}</h3><span>{panel.source}</span></div><div className="sheet" style={{width:sw*scale,height:sh*scale}}>{(panel.bands||[]).map((b,i)=><div className="band" key={i} style={{left:b.x*scale,top:b.y*scale,width:b.w*scale,height:b.h*scale}}>B{i+1}</div>)}{panel.pieces.map((p,i)=><div className="piece" key={i} style={{left:(p.x||0)*scale,top:(p.y||0)*scale,width:p.w*scale,height:p.h*scale,background:p.color}}><b>{p.pieceNo}</b><br/>{p.w.toFixed(1)} x {p.h.toFixed(1)}{p.rotated?<><br/>tourné</>:null}</div>)}{(panel.offcuts||[]).map((o,i)=><div className="offcut" key={i} style={{left:o.x*scale,top:o.y*scale,width:o.w*scale,height:o.h*scale}}>CHUTE<br/>{o.w.toFixed(1)} x {o.h.toFixed(1)}</div>)}</div></div>})}</div>
      <section className="cutlist"><h2>Ordre des coupes scie à format</h2><table><thead><tr><th>#</th><th>Plaque</th><th>Action</th><th>Détail</th></tr></thead><tbody>{cutOrder.map(r=><tr key={r.step}><td>{r.step}</td><td>{r.panel}</td><td>{r.action}</td><td>{r.detail}</td></tr>)}</tbody></table></section>
      <section className="cutlist"><h2>Chutes réutilisables détectées</h2><table><thead><tr><th>Plaque</th><th>Type</th><th>Dimensions</th><th>Surface</th></tr></thead><tbody>{sortedOffcuts.length===0&&<tr><td colSpan="4">Aucune chute.</td></tr>}{sortedOffcuts.map((o,i)=><tr key={i}><td>{o.panel}</td><td>{o.type}</td><td>{o.w.toFixed(1)} x {o.h.toFixed(1)} cm</td><td>{(o.area/10000).toFixed(2)} m²</td></tr>)}</tbody></table></section>
      <section className="signatures"><div>Signature atelier</div><div>Validation client</div></section>
    </main></div></div>
}
