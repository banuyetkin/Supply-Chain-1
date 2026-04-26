import { useState, useRef, useEffect } from "react";
import Head from "next/head";

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r, dLng = (lng2 - lng1) * r;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin(dLng/2)**2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(l=>l.trim());
  const hi = Math.max(lines.findIndex(l=>l.toLowerCase().includes("supplier")), 0);
  const rows = [];
  for (let i = hi+1; i < lines.length; i++) {
    const v = lines[i].split(",").map(x=>x.trim().replace(/^"|"$/g,""));
    if (!v[0]) continue;
    rows.push({ name:v[0], lat:parseFloat(v[1])||0, lng:parseFloat(v[2])||0,
      transport:parseFloat(v[3])||0, purchase:parseFloat(v[4])||0, capacity:parseFloat(v[5])||999999 });
  }
  return rows;
}

const TEMPLATE_CSV =
  "Supplier Name,Latitude,Longitude,Transportation Cost/Product,Purchase Cost/Product,Capacity (Units)\r\n" +
  "Supplier A,51.5074,-0.1278,2.50,12.00,5000\r\nSupplier B,48.8566,2.3522,4.10,9.80,3000\r\nSupplier C,52.3676,4.9041,1.80,14.50,8000\r\n";

const DEMO_ROWS = [
  {name:"Apex Materials",lat:51.5074,lng:-0.1278,transport:2.5,purchase:12.0,capacity:5000},
  {name:"BuildCo",lat:48.8566,lng:2.3522,transport:4.1,purchase:9.8,capacity:3000},
  {name:"CraftSource",lat:52.3676,lng:4.9041,transport:1.8,purchase:14.5,capacity:8000},
  {name:"Delta Supply",lat:53.4808,lng:-2.2426,transport:1.2,purchase:16.0,capacity:2000},
  {name:"EliteParts",lat:50.1109,lng:8.6821,transport:5.5,purchase:8.5,capacity:10000},
  {name:"FabCorp",lat:45.4654,lng:9.1859,transport:6.8,purchase:7.2,capacity:6000},
];

const QUICK_PROMPTS = [
  "Only suppliers within 300 km",
  "Demand is now 15,000 units",
  "Minimise cost instead of distance",
  "Why was the furthest supplier excluded?",
  "What if the closest supplier is unavailable?",
  "Show me a risk summary",
];

export default function Home() {
  const [step, setStep]             = useState(1);
  const [rawSuppliers, setRaw]      = useState([]);
  const [myLat, setMyLat]           = useState("51.5074");
  const [myLng, setMyLng]           = useState("-0.1278");
  const [demand, setDemand]         = useState("10000");
  const [result, setResult]         = useState(null);
  const [liveResult, setLiveResult] = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [messages, setMessages]     = useState([]);
  const [chatInput, setChatInput]   = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const fileRef = useRef(null);
  const chatEnd = useRef(null);
  const activeResult = liveResult || result;

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, chatLoading]);

  function goTo(n) { setStep(n); setError(""); }

  function downloadTemplate() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([TEMPLATE_CSV], {type:"text/csv"}));
    a.download = "Suppliers_Template.csv"; a.click();
  }

  function loadFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
      const rows = parseCSV(e.target.result);
      if (!rows.length) { setError("No valid rows found."); return; }
      setRaw(rows); goTo(3);
    };
    reader.readAsText(file);
  }

  async function runOptimise() {
    const lat = parseFloat(myLat), lng = parseFloat(myLng), dem = parseInt(demand);
    if (isNaN(lat)||isNaN(lng)) { setError("Please enter valid coordinates."); return; }
    if (!dem||dem<1) { setError("Please enter a valid demand."); return; }
    const enriched = rawSuppliers.map(s=>({...s, distance_km:haversine(lat,lng,s.lat,s.lng), total_cost_per_unit:+(s.transport+s.purchase).toFixed(2)}));
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/optimise", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({suppliers:enriched,demand:dem})});
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult(data); setLiveResult(null);
      setMessages([{role:"assistant", content:`I've analysed your ${enriched.length} suppliers and selected the optimal ${data.selected.length} to meet your ${dem.toLocaleString()} unit demand. You can ask me to adjust filters, change demand, switch to cost optimisation, or explain any decision.`}]);
      goTo(4);
    } catch(e) { setError("Optimisation failed: "+e.message); }
    finally { setLoading(false); }
  }

  async function sendChat(text) {
    if (!text?.trim()||chatLoading) return;
    setChatInput("");
    const userMsg = {role:"user", content:text};
    setMessages(m=>[...m, userMsg]);
    setChatLoading(true);
    try {
      const res = await fetch("/api/chat", {method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({messages:[...messages,userMsg], result:activeResult, demand:parseInt(demand)})});
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setMessages(m=>[...m, {role:"assistant", content:data.reply}]);
      if (data.updatedResult) setLiveResult(data.updatedResult);
    } catch(e) {
      setMessages(m=>[...m, {role:"assistant", content:"Sorry, something went wrong. Please try again."}]);
    } finally { setChatLoading(false); }
  }

  const stepLabels = ["Template","Upload","Demand","Results"];

  return (<>
    <Head><title>Supplier Selection Optimiser</title></Head>
    <main style={{maxWidth:step===4?1100:800,margin:"0 auto",padding:"2rem 1rem",fontFamily:"system-ui,sans-serif",transition:"max-width .3s"}}>
      <h1 style={{fontSize:22,fontWeight:600,marginBottom:4}}>Supplier Selection Optimiser</h1>
      <p style={{color:"#666",fontSize:13,marginBottom:20}}>Upload data → Run optimisation → Refine through chat</p>

      <div style={{display:"flex",alignItems:"center",marginBottom:24}}>
        {stepLabels.map((label,i)=>(<div key={i} style={{display:"flex",alignItems:"center",flex:i<3?1:0}}>
          <div style={{display:"flex",alignItems:"center",gap:6,fontSize:13,color:step===i+1?"#000":step>i+1?"#0F6E56":"#aaa",fontWeight:step===i+1?600:400}}>
            <span style={{width:22,height:22,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600,border:`1.5px solid ${step===i+1?"#000":step>i+1?"#0F6E56":"#ccc"}`,background:step===i+1?"#000":step>i+1?"#E1F5EE":"transparent",color:step===i+1?"#fff":"inherit"}}>{i+1}</span>
            {label}
          </div>
          {i<3&&<div style={{flex:1,height:1,background:"#e5e5e5",margin:"0 8px"}}/>}
        </div>))}
      </div>

      {error&&<div style={{background:"#fff0f0",border:"1px solid #fcc",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#c00",marginBottom:16}}>{error}</div>}

      {/* STEP 1 */}
      {step===1&&<div>
        <Card title="Your data template">
          <p style={{fontSize:13,color:"#555",marginBottom:14}}>Download this template, fill in your suppliers, then upload it.</p>
          <div style={{overflowX:"auto"}}>
            <table style={{fontSize:13,borderCollapse:"collapse",width:"100%"}}>
              <thead>
                <tr style={{background:"#f7f7f7"}}>
                  <Th rowSpan={2}>Supplier Name</Th><Th colSpan={2} center>Location</Th>
                  <Th rowSpan={2}>Transport Cost/Product ($)</Th><Th rowSpan={2}>Purchase Cost/Product ($)</Th><Th rowSpan={2}>Capacity (Units)</Th>
                </tr>
                <tr style={{background:"#f7f7f7"}}><Th>Latitude</Th><Th>Longitude</Th></tr>
              </thead>
              <tbody>
                {[["Supplier A","51.5074","-0.1278","2.50","12.00","5000"],["Supplier B","48.8566","2.3522","4.10","9.80","3000"]].map((r,i)=>(
                  <tr key={i} style={{color:"#aaa",fontStyle:"italic"}}>{r.map((v,j)=><Td key={j}>{v}</Td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div style={{display:"flex",gap:12}}>
          <Btn green onClick={downloadTemplate}>↓ Download CSV template</Btn>
          <Btn primary onClick={()=>goTo(2)}>I already have my data →</Btn>
        </div>
      </div>}

      {/* STEP 2 */}
      {step===2&&<div>
        <div onClick={()=>fileRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)loadFile(f);}}
          style={{border:"1.5px dashed #ccc",borderRadius:12,padding:"3rem 2rem",textAlign:"center",cursor:"pointer",marginBottom:12}}>
          <div style={{fontSize:32,marginBottom:10,opacity:.5}}>📄</div>
          <p style={{fontWeight:600,marginBottom:6}}>Drop your filled CSV here</p>
          <p style={{fontSize:13,color:"#888",marginBottom:16}}>Supplier Name, Lat, Lng, Transport Cost, Purchase Cost, Capacity</p>
          <Btn>Browse file</Btn>
        </div>
        <input ref={fileRef} type="file" accept=".csv" style={{display:"none"}} onChange={e=>{if(e.target.files[0])loadFile(e.target.files[0]);}}/>
        <div style={{textAlign:"center",marginBottom:16}}>
          <button onClick={()=>{setRaw(DEMO_ROWS);goTo(3);}} style={{fontSize:13,color:"#888",background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}}>Try with demo data</button>
        </div>
        <Btn onClick={()=>goTo(1)}>← Back</Btn>
      </div>}

      {/* STEP 3 */}
      {step===3&&<div>
        <Card title={`${rawSuppliers.length} suppliers loaded`}>
          <div style={{overflowX:"auto"}}><table style={{fontSize:13,borderCollapse:"collapse",width:"100%"}}>
            <thead><tr style={{background:"#f7f7f7"}}>{["Supplier","Lat","Lng","Transport ($)","Purchase ($)","Capacity"].map(h=><Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>{rawSuppliers.slice(0,6).map((s,i)=><tr key={i}><Td>{s.name}</Td><Td>{s.lat}</Td><Td>{s.lng}</Td><Td>${s.transport.toFixed(2)}</Td><Td>${s.purchase.toFixed(2)}</Td><Td>{s.capacity.toLocaleString()}</Td></tr>)}</tbody>
          </table></div>
        </Card>
        <Card title="Your company location and demand">
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:14}}>
            <Field label="Your latitude"><input type="number" value={myLat} onChange={e=>setMyLat(e.target.value)} step="any" style={inpStyle}/></Field>
            <Field label="Your longitude"><input type="number" value={myLng} onChange={e=>setMyLng(e.target.value)} step="any" style={inpStyle}/></Field>
            <Field label="Total demand (units)"><input type="number" value={demand} onChange={e=>setDemand(e.target.value)} min="1" style={inpStyle}/></Field>
          </div>
        </Card>
        <div style={{display:"flex",gap:12}}>
          <Btn primary onClick={runOptimise} disabled={loading}>{loading?"Optimising…":"Run optimisation"}</Btn>
          <Btn onClick={()=>goTo(2)}>← Back</Btn>
        </div>
      </div>}

      {/* STEP 4: Results + Chat */}
      {step===4&&activeResult&&<div style={{display:"grid",gridTemplateColumns:"1fr 340px",gap:0,border:"1px solid #e5e5e5",borderRadius:12,overflow:"hidden",minHeight:640}}>

        {/* Left panel */}
        <div style={{padding:"1.25rem",borderRight:"1px solid #e5e5e5",overflowY:"auto",maxHeight:700}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
            {[{label:"Selected",value:activeResult.selected.length+" suppliers"},{label:"Demand covered",value:(activeResult.demand_covered||0).toLocaleString()+" units",g:true},{label:"Avg distance",value:(activeResult.total_distance_km||0).toLocaleString()+" km"},{label:"Cost / unit",value:"$"+(activeResult.avg_cost_per_unit||0).toFixed(2)}].map(({label,value,g})=>(
              <div key={label} style={{background:"#f7f7f7",borderRadius:8,padding:"10px 12px"}}>
                <div style={{fontSize:10,color:"#888",textTransform:"uppercase",letterSpacing:".05em",marginBottom:3}}>{label}</div>
                <div style={{fontSize:20,fontWeight:600,color:g?"#0F6E56":"inherit"}}>{value}</div>
              </div>
            ))}
          </div>
          <Card title="Supplier ranking">
            <div style={{overflowX:"auto"}}><table style={{fontSize:12,borderCollapse:"collapse",width:"100%"}}>
              <thead><tr style={{background:"#f7f7f7"}}>{["Supplier","Dist (km)","Cost/unit","Allocated","Status"].map(h=><Th key={h}>{h}</Th>)}</tr></thead>
              <tbody>{(activeResult.all_ranked||[]).map((s,i)=>{
                const sel=activeResult.selected?.find(x=>x.name===s.name);
                return <tr key={i} style={{background:sel?"#f0fff8":"transparent"}}>
                  <Td><strong>{s.name}</strong></Td><Td>{s.distance_km}</Td><Td>${(s.transport+s.purchase).toFixed(2)}</Td>
                  <Td>{sel?sel.allocated_units?.toLocaleString()+"u":"—"}</Td>
                  <Td><span style={{background:sel?"#E1F5EE":"#f5f5f5",color:sel?"#0F6E56":"#888",fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:20}}>{sel?"Selected":"—"}</span></Td>
                </tr>;
              })}</tbody>
            </table></div>
          </Card>
          <Card title="Strategy">
            <p style={{fontSize:13,color:"#555",lineHeight:1.6,marginBottom:10}}>{activeResult.strategy}</p>
            {activeResult.risks&&<div style={{background:"#FAEEDA",borderRadius:8,padding:"8px 12px",fontSize:13,color:"#633806"}}>⚠️ <strong>Risks:</strong> {activeResult.risks}</div>}
          </Card>
          <div style={{display:"flex",gap:10}}><Btn primary onClick={()=>goTo(3)}>Adjust demand</Btn><Btn onClick={()=>goTo(2)}>New data</Btn></div>
        </div>

        {/* Chat panel */}
        <div style={{display:"flex",flexDirection:"column",maxHeight:700,background:"#fafafa"}}>
          <div style={{padding:"12px 14px",borderBottom:"1px solid #e5e5e5",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:8}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:"#1D9E75",display:"inline-block"}}/>AI assistant
          </div>
          <div style={{flex:1,overflowY:"auto",padding:12,display:"flex",flexDirection:"column",gap:10}}>
            {messages.map((m,i)=>(
              <div key={i} style={{alignSelf:m.role==="user"?"flex-end":"flex-start",maxWidth:"90%",padding:"10px 12px",fontSize:13,lineHeight:1.5,
                background:m.role==="user"?"#111":"#fff",color:m.role==="user"?"#fff":"#333",
                border:m.role==="assistant"?"1px solid #e5e5e5":"none",
                borderRadius:m.role==="user"?"12px 12px 2px 12px":"2px 12px 12px 12px"}}>
                {m.role==="assistant"&&<div style={{fontSize:10,fontWeight:600,color:"#aaa",textTransform:"uppercase",letterSpacing:".05em",marginBottom:4}}>Assistant</div>}
                {m.content}
              </div>
            ))}
            {chatLoading&&<div style={{alignSelf:"flex-start",background:"#fff",border:"1px solid #e5e5e5",borderRadius:"2px 12px 12px 12px",padding:"10px 12px"}}>
              <div style={{fontSize:10,fontWeight:600,color:"#aaa",textTransform:"uppercase",letterSpacing:".05em",marginBottom:6}}>Assistant</div>
              <div style={{display:"flex",gap:4}}>{[0,.2,.4].map(d=><span key={d} style={{width:6,height:6,borderRadius:"50%",background:"#aaa",animation:`pulse .9s ${d}s infinite`}}/>)}</div>
            </div>}
            <div ref={chatEnd}/>
          </div>
          <div style={{padding:"8px 12px",borderTop:"1px solid #e5e5e5",display:"flex",flexWrap:"wrap",gap:6}}>
            {QUICK_PROMPTS.map(p=><button key={p} onClick={()=>sendChat(p)} style={{fontSize:11,padding:"4px 10px",borderRadius:20,border:"1px solid #ddd",cursor:"pointer",background:"#fff",color:"#555",fontFamily:"inherit"}}>{p}</button>)}
          </div>
          <div style={{display:"flex",gap:8,padding:"12px",borderTop:"1px solid #e5e5e5"}}>
            <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")sendChat(chatInput);}}
              placeholder="Ask anything about your suppliers…"
              style={{flex:1,padding:"8px 12px",fontSize:13,borderRadius:20,border:"1px solid #ddd",fontFamily:"inherit",background:"#fff"}}/>
            <button onClick={()=>sendChat(chatInput)} disabled={chatLoading||!chatInput.trim()}
              style={{width:32,height:32,borderRadius:"50%",background:"#111",color:"#fff",border:"none",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",opacity:chatLoading||!chatInput.trim()?.4:1}}>↑</button>
          </div>
        </div>
      </div>}
    </main>
    <style>{`@keyframes pulse{0%,60%,100%{opacity:.2;transform:scale(.8)}30%{opacity:1;transform:scale(1)}}`}</style>
  </>);
}

function Card({title,children}){return <div style={{border:"1px solid #e5e5e5",borderRadius:10,padding:"1rem",marginBottom:14}}><div style={{fontSize:11,fontWeight:600,color:"#888",textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>{title}</div>{children}</div>;}
function Th({children,rowSpan,colSpan,center}){return <th rowSpan={rowSpan} colSpan={colSpan} style={{padding:"6px 8px",textAlign:center?"center":"left",color:"#888",fontWeight:500,borderBottom:"1px solid #eee",whiteSpace:"nowrap"}}>{children}</th>;}
function Td({children}){return <td style={{padding:"6px 8px",borderBottom:"1px solid #f0f0f0"}}>{children}</td>;}
function Field({label,children}){return <div style={{display:"flex",flexDirection:"column",gap:5}}><label style={{fontSize:12,color:"#888",fontWeight:500}}>{label}</label>{children}</div>;}
const inpStyle={padding:"7px 10px",fontSize:13,borderRadius:8,border:"1px solid #ddd",fontFamily:"inherit",width:"100%"};
function Btn({children,onClick,primary,green,disabled}){return <button onClick={onClick} disabled={disabled} style={{padding:"8px 18px",fontSize:13,fontWeight:500,borderRadius:8,cursor:disabled?"not-allowed":"pointer",border:primary||green?"none":"1px solid #ddd",background:primary?"#111":green?"#1D9E75":"transparent",color:primary||green?"#fff":"#333",opacity:disabled?.5:1,fontFamily:"inherit"}}>{children}</button>;}
