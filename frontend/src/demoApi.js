
const KEY = 'business-central-demo-v1'
const today = new Date().toISOString().slice(0, 10)
const seed = {
  orders: [
    {id:1,order_number:'ORD-2026-001',customer_name:'Northstar Textiles',order_date:today,product_name:'Cotton Fabric - 40s',quantity:1200,agreed_price:185,delivery_date:today,status:'In Production',remarks:'Priority order'},
    {id:2,order_number:'ORD-2026-002',customer_name:'Aarav Garments',order_date:today,product_name:'Polyester Blend',quantity:800,agreed_price:142,delivery_date:today,status:'Confirmed',remarks:''},
    {id:3,order_number:'ORD-2026-003',customer_name:'Metro Furnishings',order_date:today,product_name:'Canvas Roll',quantity:450,agreed_price:220,delivery_date:today,status:'Completed',remarks:''}
  ],
  employees: [
    {id:1,employee_code:'EMP-001',name:'Amit Sharma',worker_type:'Salaried',phone:'9876501234',joining_date:'2024-04-01',monthly_salary:22000,daily_wage:null,piece_rate:null,pay_mode:'Monthly',job_description:'Production Supervisor',is_active:1},
    {id:2,employee_code:'EMP-002',name:'Neha Verma',worker_type:'Salaried',phone:'9876505678',joining_date:'2025-01-15',monthly_salary:18000,daily_wage:null,piece_rate:null,pay_mode:'Monthly',job_description:'Quality Checker',is_active:1},
    {id:3,employee_code:'LAB-001',name:'Ramesh Kumar',worker_type:'Labour',phone:'',joining_date:today,monthly_salary:null,daily_wage:null,piece_rate:12,pay_mode:'Piece Based',job_description:'Fabric cutting',is_active:1}
  ],
  attendance: [{id:1,employee_id:1,attendance_date:today,status:'Present',hours_worked:8,remarks:''}],
  workEntries: [{id:1,employee_id:3,work_date:today,work_description:'Piece Work',quantity:120,quantity_unit:'piece',rate:12,size:'Large',weight:0.45,total_amount:1440,remarks:''}],
  payments: [{id:1,employee_id:1,payment_date:today,payment_period:today.slice(0,7),payment_type:'Advance',amount:3000,remarks:'Demo advance'}],
  suppliers: [{id:1,name:'Shree Raw Materials',phone:'9876500001',email:'sales@example.com',address:'Ludhiana'},{id:2,name:'Punjab Textile Supply',phone:'9876500002',email:'',address:'Ludhiana'}],
  materials: [{id:1,item_name:'Cotton Yarn 40s',unit:'kg',minimum_quantity:100,quantity:620,rate:245},{id:2,item_name:'Polyester Yarn',unit:'kg',minimum_quantity:80,quantity:210,rate:190},{id:3,item_name:'Dye - Navy Blue',unit:'ltr',minimum_quantity:20,quantity:45,rate:320}],
  purchases: [{id:1,purchase_number:'PUR-2026-001',supplier_id:1,supplier_name:'Shree Raw Materials',purchase_date:today,invoice_reference:'INV-1042',total_amount:49000,items:[{inventory_item_id:1,item_name:'Cotton Yarn 40s',quantity:200,rate:245}]}],
  production: [{id:1,production_number:'PROD-2026-001',order_reference:'ORD-2026-001',product_name:'Cotton Fabric - 40s',order_quantity:1200,delivery_date:today,status:'In Production',remarks:'Loom 2 running',materials:[{material_name:'Cotton Yarn 40s',quantity:620,unit:'kg'}]}],
  packing: [{id:1,packing_number:'PACK-2026-001',order_reference:'ORD-2026-003',product_name:'Canvas Roll',required_quantity:450,receiver_party:'Metro Furnishings',via:'Direct',status:'Completed',completed_quantity:450,completion_date:today,remarks:'Packed in 30 rolls'}],
  shipments: [{id:1,shipment_number:'SHP-2026-001',packing_id:1,packing_number:'PACK-2026-001',order_reference:'ORD-2026-003',product_name:'Canvas Roll',quantity_dispatched:450,dispatch_date:today,transporter:'Demo Logistics',vehicle_number:'PB10AB1234',tracking_details:'DEMO-TRACK-001',remarks:''}],
  costMaterials: [{id:1,material_name:'Cotton Yarn 40s',unit:'kg',rate:245},{id:2,material_name:'Polyester Yarn',unit:'kg',rate:190},{id:3,material_name:'Dye - Navy Blue',unit:'ltr',rate:320}],
  inventory: [{id:1,item_code:'RM-001',item_name:'Cotton Yarn 40s',item_type:'Raw Material',unit:'kg',minimum_quantity:100,quantity:620,remarks:''},{id:2,item_code:'RM-002',item_name:'Polyester Yarn',item_type:'Raw Material',unit:'kg',minimum_quantity:80,quantity:210,remarks:''},{id:3,item_code:'FG-001',item_name:'Canvas Roll',item_type:'Finished Goods',unit:'roll',minimum_quantity:20,quantity:35,remarks:'Ready for dispatch'}]
}
const state = (() => {
  try { return {...seed, ...JSON.parse(localStorage.getItem(KEY) || '{}')} } catch { return structuredClone(seed) }
})()
function save(){ localStorage.setItem(KEY, JSON.stringify(state)) }
function clone(x){ return JSON.parse(JSON.stringify(x)) }
function response(data,status=200){ return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}}) }
function nextId(rows){ return Math.max(0,...rows.map(x=>Number(x.id)||0))+1 }
function bodyOf(options){ try{return JSON.parse(options.body||'{}')}catch{return {}} }
function filter(rows,q,fields){ const t=(q||'').toLowerCase(); return !t?rows:rows.filter(r=>fields.some(k=>String(r[k]??'').toLowerCase().includes(t))) }
function upsert(rows,id,payload,prefix,key){
  let row
  if(id){ row=rows.find(x=>x.id===Number(id)); if(!row)return null; Object.assign(row,payload) }
  else { row={id:nextId(rows),...payload}; row[key]=row[key]||`${prefix}-${String(row.id).padStart(4,'0')}`; rows.unshift(row) }
  save(); return row
}
function remove(rows,id){ const i=rows.findIndex(x=>x.id===Number(id)); if(i<0)return false; rows.splice(i,1); save(); return true }
if(!Array.isArray(state.stockLedger))state.stockLedger=[]
function itemByName(name,type){const n=String(name||'').trim().toLowerCase();return state.inventory.find(x=>String(x.item_name).trim().toLowerCase()===n&&(!type||x.item_type===type))}
function ensureInventory(name,unit,type='Raw Material'){let item=itemByName(name,type);if(!item){item={id:nextId(state.inventory),item_code:`${type==='Raw Material'?'RM':'FG'}-${String(nextId(state.inventory)).padStart(3,'0')}`,item_name:name,item_type:type,unit:unit||'pcs',minimum_quantity:0,quantity:0,remarks:'Created by stock movement'};state.inventory.push(item)}return item}
function stockMove(item,qty,kind,ref){const n=Number(qty);if(!item||!Number.isFinite(n)||n===0)throw new Error('Invalid stock movement.');if(Number(item.quantity||0)+n < -0.000001)throw new Error(`Insufficient ${item.item_name} stock. Available ${item.quantity} ${item.unit}; required ${Math.abs(n)} ${item.unit}.`);item.quantity=Math.max(0,Number(item.quantity||0)+n);state.stockLedger.unshift({id:nextId(state.stockLedger),date:today,type:kind,reference:ref,item_id:item.id,item_name:item.item_name,unit:item.unit,quantity_in:n>0?n:0,quantity_out:n<0?-n:0,balance_after:item.quantity});save()}
function reverseMovements(ref){const moves=state.stockLedger.filter(x=>x.reference===ref),totals=new Map();for(const mv of moves){const delta=Number(mv.quantity_out||0)-Number(mv.quantity_in||0);totals.set(mv.item_id,(totals.get(mv.item_id)||0)+delta)}for(const [id,delta] of totals){const item=state.inventory.find(x=>x.id===id);if(item&&Number(item.quantity||0)+delta < -0.000001)throw new Error(`Cannot reverse ${ref}; ${item.item_name} stock has already been consumed.`)}for(const [id,delta] of totals){const item=state.inventory.find(x=>x.id===id);if(item)item.quantity=Math.max(0,Number(item.quantity||0)+delta)}state.stockLedger=state.stockLedger.filter(x=>x.reference!==ref);save()}
function materialItem(name){return itemByName(name,'Raw Material')}
function employeeSummary(id){
  const e=state.employees.find(x=>x.id===Number(id)); if(!e)return {}
  const month=new URLSearchParams(location.search).get('month')||today.slice(0,7)
  const att=state.attendance.filter(x=>x.employee_id===e.id&&x.attendance_date?.startsWith(month))
  const work=state.workEntries.filter(x=>x.employee_id===e.id&&x.work_date?.startsWith(month))
  const pays=state.payments.filter(x=>x.employee_id===e.id&&x.payment_period===month)
  const piece=work.reduce((s,x)=>s+Number(x.total_amount||x.quantity*x.rate||0),0)
  const paid=pays.reduce((s,x)=>s+Number(x.amount||0),0)
  const monthly=e.worker_type==='Salaried'?Number(e.monthly_salary||0):piece
  const earnings=e.worker_type==='Salaried'?monthly:piece
  return {total_earnings:earnings,total_paid:paid,advances:pays.filter(x=>x.payment_type==='Advance').reduce((s,x)=>s+Number(x.amount||0),0),outstanding:earnings-paid,monthly_salary_earnings:monthly,piece_based_earnings:piece,piece_based_quantity:work.reduce((s,x)=>s+Number(x.quantity||0),0),present_days:att.filter(x=>x.status==='Present').length,half_days:att.filter(x=>x.status==='Half Day').length,absent_days:att.filter(x=>x.status==='Absent').length,leave_days:att.filter(x=>x.status==='Leave').length,paid_days:att.filter(x=>['Present','Half Day'].includes(x.status)).length}
}
function handle(path,method,options){
 const url=new URL(path,location.origin), p=url.pathname.replace(/^\/api/,'').replace(/\/$/,'')||'/', q=url.searchParams.get('q')||''
 const data=bodyOf(options)
 let m
 if(p==='/dashboard') return response({orders_total:state.orders.length,orders_active:state.orders.filter(x=>!['Completed','Cancelled'].includes(x.status)).length,orders_pending:state.orders.filter(x=>x.status==='Pending').length,orders_completed:state.orders.filter(x=>x.status==='Completed').length})
 if(p==='/orders'){ if(method==='GET')return response(filter(state.orders,q,['order_number','customer_name','product_name','status'])); const r=upsert(state.orders,null,data,'ORD','order_number'); return response(r,201) }
 if(m=p.match(/^\/orders\/(\d+)$/)){ if(method==='GET')return response(state.orders.find(x=>x.id===+m[1])||{}); if(method==='DELETE'){remove(state.orders,m[1]);return response({ok:true})} return response(upsert(state.orders,m[1],data,'ORD','order_number'))}
 if(p==='/cost-calculator/materials'){if(method==='GET')return response(state.costMaterials);return response(upsert(state.costMaterials,null,data,'MAT','material_code'),201)}
 if(m=p.match(/^\/cost-calculator\/materials\/(\d+)$/)){if(method==='DELETE'){remove(state.costMaterials,m[1]);return response({ok:true})}return response(upsert(state.costMaterials,m[1],data,'MAT','material_code'))}
 if(p==='/employees'){if(method==='GET'){let rows=state.employees;const type=url.searchParams.get('worker_type');if(type)rows=rows.filter(x=>x.worker_type===type);if(url.searchParams.get('active_only')==='true')rows=rows.filter(x=>x.is_active);return response(filter(rows,q,['name','employee_code','phone','job_description']))}return response(upsert(state.employees,null,{...data,is_active:1},'EMP','employee_code'),201)}
 if(p==='/employees/piece-work-options')return response({sizes:['Small','Medium','Large'],weights:[0.25,0.45,0.75],rates:[8,10,12,15]})
 if(p==='/employees/labour-with-first-work'){const e=upsert(state.employees,null,{name:data.name,worker_type:'Labour',joining_date:today,pay_mode:'Piece Based',piece_rate:data.rate,is_active:1},'LAB','employee_code');const w=upsert(state.workEntries,null,{...data,employee_id:e.id,work_date:data.work_date,total_amount:data.quantity*data.rate},'WRK','work_number');return response({employee:e,work_entry:w},201)}
 if(m=p.match(/^\/employees\/(\d+)\/(attendance|work-entries|payments|summary|deactivate|reactivate)$/)){
  const id=+m[1], kind=m[2]
  if(kind==='summary')return response(employeeSummary(id))
  if(kind==='deactivate'||kind==='reactivate'){const e=state.employees.find(x=>x.id===id);if(e)e.is_active=kind==='reactivate'?1:0;save();return response(e||{})}
  const rows=kind==='attendance'?state.attendance:kind==='work-entries'?state.workEntries:state.payments
  if(method==='GET')return response(rows.filter(x=>x.employee_id===id && String(x[kind==='attendance'?'attendance_date':kind==='work-entries'?'work_date':'payment_date']||'').startsWith(url.searchParams.get('month')||'')))
  const row=upsert(rows,null,{...data,employee_id:id,...(kind==='work-entries'?{total_amount:Number(data.quantity||0)*Number(data.rate||0)}:{})},kind.toUpperCase(),'entry_number');return response(row,201)
 }
 if(p==='/suppliers'){if(method==='GET')return response(state.suppliers);return response(upsert(state.suppliers,null,data,'SUP','supplier_code'),201)}
 if(p==='/inventory/raw-materials'){if(method==='GET')return response(state.materials);const r=upsert(state.materials,null,{...data,quantity:0},'RM','item_code');return response(r,201)}
 if(p==='/purchases'){
  if(method==='GET')return response(state.purchases)
  try{const supplier=state.suppliers.find(x=>x.id===+data.supplier_id);const items=(data.items||[]).map(x=>({...x,item_name:state.materials.find(m=>m.id===+x.inventory_item_id)?.item_name||'Material'}));if(!items.length||items.some(x=>!(Number(x.quantity)>0)))throw new Error('Add purchase items with valid quantities.');const id=nextId(state.purchases),ref=`PUR-${String(id).padStart(4,'0')}`,row={id,...data,items,supplier_name:supplier?.name,total_amount:items.reduce((a,x)=>a+Number(x.quantity)*Number(x.rate),0),purchase_number:ref,stock_posted:true};for(const line of items){const mat=state.materials.find(x=>x.id===+line.inventory_item_id);if(!mat)throw new Error('Raw material not found.');const inv=ensureInventory(mat.item_name,mat.unit,'Raw Material');if(Number(inv.quantity)+Number(line.quantity)<0)throw new Error('Invalid stock balance.')}state.purchases.unshift(row);for(const line of items){const mat=state.materials.find(x=>x.id===+line.inventory_item_id);const inv=ensureInventory(mat.item_name,mat.unit,'Raw Material');stockMove(inv,Number(line.quantity),'Purchase Receipt',ref);mat.quantity=inv.quantity}save();return response(row,201)}catch(e){return response({detail:e.message},400)}
 }
 if(m=p.match(/^\/purchases\/(\d+)$/)){const row=state.purchases.find(x=>x.id===+m[1]);if(method==='GET')return response(row||{});try{if(method==='DELETE'){if(row){if(row.stock_posted)reverseMovements(row.purchase_number);remove(state.purchases,m[1])}return response({ok:true})}if(!row?.stock_posted)return response({detail:'This is an opening demo purchase record; it is not linked to a stock movement and cannot be edited.'},409);const supplier=state.suppliers.find(x=>x.id===+data.supplier_id);const items=(data.items||[]).map(x=>({...x,item_name:state.materials.find(m=>m.id===+x.inventory_item_id)?.item_name||'Material'}));if(!items.length||items.some(x=>!(Number(x.quantity)>0)))throw new Error('Add purchase items with valid quantities.');reverseMovements(row.purchase_number);for(const line of items){const mat=state.materials.find(x=>x.id===+line.inventory_item_id);if(!mat)throw new Error('Raw material not found.');const inv=ensureInventory(mat.item_name,mat.unit,'Raw Material');if(Number(inv.quantity)+Number(line.quantity)<0)throw new Error('Invalid stock balance.')}Object.assign(row,data,{items,supplier_name:supplier?.name,total_amount:items.reduce((a,x)=>a+Number(x.quantity)*Number(x.rate),0)});for(const line of items){const mat=state.materials.find(x=>x.id===+line.inventory_item_id);const inv=ensureInventory(mat.item_name,mat.unit,'Raw Material');stockMove(inv,Number(line.quantity),'Purchase Receipt',row.purchase_number);mat.quantity=inv.quantity}save();return response(row)}catch(e){return response({detail:e.message},400)}}
 if(p==='/production'){
  if(method==='GET')return response(filter(state.production,q,['production_number','order_reference','product_name','status']))
  const row=upsert(state.production,null,{...data,materials:data.materials||[],materials_issued:false,completed_quantity:0},'PROD','production_number');return response(row,201)
 }
 if(m=p.match(/^\/production\/(\d+)\/(issue|complete)$/)){const row=state.production.find(x=>x.id===+m[1]);if(!row)return response({detail:'Production record not found.'},404);try{if(m[2]==='issue'){if(row.materials_issued)return response({detail:'Materials already issued.'},409);const required=new Map();for(const req of row.materials||[]){const item=materialItem(req.material_name);if(!item)throw new Error(`Raw material ${req.material_name} is not in inventory.`);required.set(item.id,{item,qty:(required.get(item.id)?.qty||0)+Number(req.quantity)})}for(const {item,qty} of required.values())if(Number(item.quantity)<qty)throw new Error(`Insufficient ${item.item_name}: available ${item.quantity} ${item.unit}, required ${qty} ${item.unit}.`);for(const {item,qty} of required.values())stockMove(item,-qty,'Material Issue',row.production_number);row.materials_issued=true;row.status='In Production';save();return response(row)}const qty=Number(data.quantity);if(!(qty>0))throw new Error('Completed quantity must be greater than zero.');if(!row.materials_issued)throw new Error('Issue raw materials before receiving finished goods.');const fg=ensureInventory(row.product_name,'pcs','Finished Goods');stockMove(fg,qty,'Production Receipt',row.production_number);row.completed_quantity=Number(row.completed_quantity||0)+qty;if(row.completed_quantity>=Number(row.order_quantity))row.status='Completed';save();return response(row)}catch(e){return response({detail:e.message},400)}}
 if(m=p.match(/^\/production\/(\d+)$/)){const row=state.production.find(x=>x.id===+m[1]);if(method==='DELETE'){if(row&&(row.materials_issued||Number(row.completed_quantity||0)>0))return response({detail:'Cannot delete production after stock movements.'},409);remove(state.production,m[1]);return response({ok:true})}if(row&&(row.materials_issued||Number(row.completed_quantity||0)>0))return response({detail:'Production details are locked after material issue. Keep the original requirements for audit.'},409);return response(upsert(state.production,m[1],data,'PROD','production_number'))}
 if(p==='/packing'){
  if(method==='GET')return response(filter(state.packing,q,['packing_number','order_reference','product_name','receiver_party','status']).filter(x=>!url.searchParams.get('status')||x.status===url.searchParams.get('status')))
  try{let fg=null,qty=0;if(data.status==='Completed'){fg=itemByName(data.product_name,'Finished Goods');if(!fg)throw new Error(`Finished goods ${data.product_name} not found.`);qty=Number(data.completed_quantity);if(!(qty>0))throw new Error('Completed quantity must be greater than zero.');if(Number(fg.quantity)<qty)throw new Error(`Insufficient finished goods. Available ${fg.quantity} ${fg.unit}.`)}const row=upsert(state.packing,null,{...data,stock_posted:false},'PACK','packing_number');if(fg){stockMove(fg,-qty,'Packing Transfer Out',row.packing_number);const packed=ensureInventory(row.product_name,fg.unit,'Packed Goods');stockMove(packed,qty,'Packing Transfer In',row.packing_number);row.stock_posted=true;save()}return response(row,201)}catch(e){return response({detail:e.message},400)}
 }
 if(m=p.match(/^\/packing\/(\d+)$/)){const row=state.packing.find(x=>x.id===+m[1]);if(row?.stock_posted)return response({detail:'Posted packing entries are locked to protect stock history.'},409);if(method==='DELETE'){remove(state.packing,m[1]);return response({ok:true})}try{let fg=null,qty=0;if(data.status==='Completed'){fg=itemByName(data.product_name,'Finished Goods');qty=Number(data.completed_quantity);if(!fg)throw new Error(`Finished goods ${data.product_name} not found.`);if(!(qty>0)||Number(fg.quantity)<qty)throw new Error(`Insufficient finished goods. Available ${fg.quantity} ${fg.unit}; required ${qty}.`)}const saved=upsert(state.packing,m[1],{...data,stock_posted:false},'PACK','packing_number');if(fg){stockMove(fg,-qty,'Packing Transfer Out',saved.packing_number);const packed=ensureInventory(saved.product_name,fg.unit,'Packed Goods');stockMove(packed,qty,'Packing Transfer In',saved.packing_number);saved.stock_posted=true;save()}return response(saved)}catch(e){return response({detail:e.message},400)}}
 if(p==='/shipments'){
  if(method==='GET')return response(filter(state.shipments,q,['shipment_number','packing_number','order_reference','product_name','transporter']))
  try{const packing=state.packing.find(x=>x.id===+data.packing_id);if(!packing?.stock_posted)throw new Error('Choose a completed packing entry with posted stock.');const item=itemByName(packing.product_name,'Packed Goods');const qty=Number(data.quantity_dispatched);if(!item||!(qty>0))throw new Error('Invalid packed item or dispatch quantity.');const id=nextId(state.shipments),ref=`SHP-${String(id).padStart(4,'0')}`;const row={id,...data,shipment_number:ref,packing_number:packing.packing_number,order_reference:packing.order_reference,product_name:packing.product_name,customer_name:packing.receiver_party};stockMove(item,-qty,'Shipment Dispatch',ref);state.shipments.unshift(row);save();return response(row,201)}catch(e){return response({detail:e.message},400)}
 }
 if(m=p.match(/^\/shipments\/(\d+)$/)){return response({detail:'Posted dispatches cannot be edited or deleted. Use a formal return/reversal record.'},409)}
 if(p==='/inventory/items' && method==='POST'){const item=upsert(state.inventory,null,{...data,quantity:0},'INV','item_code');if(item.item_type==='Raw Material'&&!state.materials.some(x=>x.item_name.toLowerCase()===item.item_name.toLowerCase()))state.materials.push({id:nextId(state.materials),item_name:item.item_name,unit:item.unit,minimum_quantity:item.minimum_quantity,quantity:0,inventory_id:item.id});save();return response(item,201)}
 if(p==='/inventory/items' && method==='GET'){let rows=state.inventory;if(url.searchParams.get('item_type'))rows=rows.filter(x=>x.item_type===url.searchParams.get('item_type'));if(url.searchParams.get('low_stock')==='true')rows=rows.filter(x=>Number(x.quantity)<Number(x.minimum_quantity));return response(filter(rows,q,['item_code','item_name','item_type','remarks']).map(x=>({...x,current_quantity:Number(x.quantity||0)})))}
 if(p==='/inventory/summary')return response({total_items:state.inventory.length,raw_materials:state.inventory.filter(x=>x.item_type==='Raw Material').length,finished_goods:state.inventory.filter(x=>['Finished Goods','Packed Goods'].includes(x.item_type)).length,low_stock:state.inventory.filter(x=>Number(x.quantity)<Number(x.minimum_quantity)).length,total_quantity:state.inventory.reduce((s,x)=>s+Number(x.quantity||0),0)})
 if(p==='/inventory/ledger')return response(state.stockLedger)
 if(m=p.match(/^\/inventory\/items\/(\d+)$/)){if(method==='DELETE'){const item=state.inventory.find(x=>x.id===+m[1]);if(item&&Number(item.quantity||0)!==0)return response({detail:'Cannot delete an item with stock on hand. Issue or dispatch the stock first.'},409);if(state.stockLedger.some(x=>x.item_id===+m[1]))return response({detail:'Cannot delete an item with stock history. Keep it for audit.'},409);remove(state.inventory,m[1]);return response({ok:true})}return response(upsert(state.inventory,m[1],data,'INV','item_code'))}
 if(p==='/inventory/items'&&method==='POST')return response(upsert(state.inventory,null,{...data,quantity:0},'INV','item_code'),201)
 return response({detail:`Demo endpoint not configured: ${p}`},404)
}
window.fetch = async (input, options={}) => {
 const url=typeof input==='string'?input:input.url
 if(url.includes('127.0.0.1:8015')||url.startsWith('/api/')){
   const method=(options.method||'GET').toUpperCase()
   return handle(url,method,options)
 }
 return new Response('Not found',{status:404})
}
