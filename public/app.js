
const API = '/api';
var customers=[], reps=[], tiers=[], lastCalc={sell:0,cost:0,profit:0,tax:0,total:0,taxPct:0,margin:0,comm:0,commPct:0,netProfit:0};

// ── HEALTH CHECK ──────────────────────────────────────────────
async function checkHealth(){
  try{
    var r=await fetch(API+'/health');
    var d=await r.json();
    document.getElementById('dbDot').className='dot '+(d.db==='connected'?'ok':'err');
    document.getElementById('dbStatus').textContent=d.db==='connected'?'Connected':'DB error';
  }catch(e){
    document.getElementById('dbDot').className='dot err';
    document.getElementById('dbStatus').textContent='Offline';
  }
}

// ── NAV ────────────────────────────────────────────────────────
function showPage(name,el){
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  document.querySelectorAll('.nav-tab').forEach(function(t){t.classList.remove('active');});
  document.getElementById('page-'+name).classList.add('active');
  el.classList.add('active');
  if(name==='customers')loadCustomers();
  if(name==='estimates')loadEstimates();
  if(name==='reps')loadReps();
  if(name==='tiers')loadTiers();
  if(name==='orders')loadOrders();
  if(name==='invoices'){loadInvoices();loadARaging();}
}

// ── TOAST ───────────────────────────────────────────────────────
function toast(msg){
  var t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  setTimeout(function(){t.classList.remove('show');},2500);
}

// ── MODAL UTILS ────────────────────────────────────────────────
function closeModal(id){document.getElementById(id).classList.remove('open');}
function openModal(id){document.getElementById(id).classList.add('open');}

// ── API HELPERS ────────────────────────────────────────────────
async function api(method,path,body){
  var opts={method:method,headers:{'Content-Type':'application/json'}};
  if(body)opts.body=JSON.stringify(body);
  var r=await fetch(API+path,opts);
  if(!r.ok){var e=await r.json();throw new Error(e.error||'Request failed');}
  return r.json();
}

// ── LOAD DROPDOWNS ──────────────────────────────────────────────
async function loadDropdowns(){
  try{
    var[r,t]=await Promise.all([api('GET','/reps'),api('GET','/tiers')]);
    reps=r; tiers=t;
    // Customer modal selects
    var rs=document.getElementById('c_rep');
    rs.innerHTML='<option value="">— None —</option>'+r.map(function(x){return '<option value="'+x.id+'">'+x.name+' ('+x.commission_pct+'%)</option>';}).join('');
    var ts=document.getElementById('c_tier');
    ts.innerHTML='<option value="">— None —</option>'+t.map(function(x){return '<option value="'+x.id+'">'+x.name+'</option>';}).join('');
    // Customer filter selects
    var rf=document.getElementById('custRepFilter');
    rf.innerHTML='<option value="">All reps</option>'+r.map(function(x){return '<option value="'+x.id+'">'+x.name+'</option>';}).join('');
    var tf=document.getElementById('custTierFilter');
    tf.innerHTML='<option value="">All tiers</option>'+t.map(function(x){return '<option value="'+x.id+'">'+x.name+'</option>';}).join('');
    // Estimator rep select
    var rs2=document.getElementById('repSel');
    rs2.innerHTML='<option value="">— None —</option>'+r.filter(function(x){return x.active;}).map(function(x){return '<option value="'+x.id+'" data-comm="'+x.commission_pct+'">'+x.name+'</option>';}).join('');
    // Estimator customer select
    var cs=document.getElementById('customerSel');
    var allCusts=await api('GET','/customers?status=active');
    customers=allCusts;
    cs.innerHTML='<option value="">— Walk-in / no customer —</option>'+allCusts.map(function(c){return '<option value="'+c.id+'" data-rep="'+c.sales_rep_id+'" data-repcomm="'+(c.rep_commission_pct||0)+'" data-tier="'+c.pricing_tier_id+'" data-tiername="'+(c.tier_name||'')+'" data-discount="'+(c.tier_discount_pct||0)+'" data-margin="'+(c.tier_margin_override||'')+'">'+(c.company||c.first_name+' '+c.last_name)+(c.company?' ('+c.first_name+' '+c.last_name+')':'')+'</option>';}).join('');
    // Import modal selects
    var ir=document.getElementById('importRepSel');
    ir.innerHTML='<option value="">— None —</option>'+r.map(function(x){return '<option value="'+x.id+'">'+x.name+'</option>';}).join('');
    var it=document.getElementById('importTierSel');
    it.innerHTML='<option value="">— None —</option>'+t.map(function(x){return '<option value="'+x.id+'">'+x.name+'</option>';}).join('');
  }catch(e){console.error(e);}
}

// ── CUSTOMER PAGE ────────────────────────────────────────────────
async function loadCustomers(){
  var search=document.getElementById('custSearch').value;
  var rep=document.getElementById('custRepFilter').value;
  var tier=document.getElementById('custTierFilter').value;
  var status=document.getElementById('custStatusFilter').value;
  var params=new URLSearchParams();
  if(search)params.set('search',search);
  if(rep)params.set('rep_id',rep);
  if(tier)params.set('tier_id',tier);
  params.set('status',status);
  try{
    var data=await api('GET','/customers?'+params.toString());
    customers=data;
    var approved=data.filter(function(c){return c.status==='active';});
    document.getElementById('customerStats').innerHTML=
      '<div class="stat"><div class="stat-label">Total customers</div><div class="stat-val">'+data.length+'</div></div>'+
      '<div class="stat"><div class="stat-label">Active</div><div class="stat-val">'+approved.length+'</div></div>'+
      '<div class="stat"><div class="stat-label">Revenue (approved)</div><div class="stat-val">$'+data.reduce(function(s,c){return s+parseFloat(c.approved_revenue||0);},0).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})+'</div></div>';
    var tbody=document.getElementById('custTbody');
    if(!data.length){tbody.innerHTML='<tr class="empty-row"><td colspan="9">No customers found.</td></tr>';return;}
    tbody.innerHTML=data.map(function(c){
      return '<tr>'+
        '<td><strong>'+c.first_name+' '+c.last_name+'</strong></td>'+
        '<td class="muted">'+(c.company||'—')+'</td>'+
        '<td class="muted">'+(c.email?'<div>'+c.email+'</div>':'')+(c.phone?'<div>'+c.phone+'</div>':'')+'</td>'+
        '<td class="muted">'+(c.rep_name||'—')+'</td>'+
        '<td class="muted">'+(c.tier_name?'<span class="badge b-sent">'+c.tier_name+'</span>':'—')+'</td>'+
        '<td class="muted">'+(c.payment_terms||'—')+'</td>'+
        '<td class="muted">'+c.estimate_count+'</td>'+
        '<td><span class="badge b-'+(c.status||'active')+'">'+c.status+'</span></td>'+
        '<td><div class="actions">'+
          '<button class="btn btn-sm" onclick="openCustomerModal('+JSON.stringify(c)+')">Edit</button>'+
          '<button class="btn btn-sm btn-blue" onclick="loadCustomerIntoEstimator('+c.id+')">Estimate</button>'+
        '</div></td>'+
      '</tr>';
    }).join('');
  }catch(e){toast('Error loading customers: '+e.message);}
}

function openCustomerModal(c){
  document.getElementById('custModalTitle').textContent=c?'Edit customer':'Add customer';
  document.getElementById('custId').value=c?c.id:'';
  document.getElementById('custDeleteBtn').style.display=c?'':'none';
  var f=function(id,val){var el=document.getElementById(id);if(el)el.value=val||'';};
  f('c_first_name',c&&c.first_name);f('c_last_name',c&&c.last_name);
  f('c_company',c&&c.company);f('c_email',c&&c.email);
  f('c_phone',c&&c.phone);f('c_mobile',c&&c.mobile);
  f('c_addr1',c&&c.address_line1);f('c_addr2',c&&c.address_line2);
  f('c_city',c&&c.city);f('c_state',c&&c.state);f('c_zip',c&&c.zip);
  f('c_rep',c&&c.sales_rep_id);f('c_tier',c&&c.pricing_tier_id);
  f('c_credit',c&&c.credit_limit);f('c_terms',c&&c.payment_terms);
  f('c_taxexempt',c?String(c.tax_exempt):'false');f('c_taxid',c&&c.tax_exempt_id);
  f('c_source',c&&c.source);f('c_status',c?c.status:'active');f('c_notes',c&&c.notes);
  openModal('customerModal');
}

async function saveCustomer(){
  var id=document.getElementById('custId').value;
  var body={
    first_name:document.getElementById('c_first_name').value.trim(),
    last_name:document.getElementById('c_last_name').value.trim(),
    company:document.getElementById('c_company').value.trim(),
    email:document.getElementById('c_email').value.trim(),
    phone:document.getElementById('c_phone').value.trim(),
    mobile:document.getElementById('c_mobile').value.trim(),
    address_line1:document.getElementById('c_addr1').value.trim(),
    address_line2:document.getElementById('c_addr2').value.trim(),
    city:document.getElementById('c_city').value.trim(),
    state:document.getElementById('c_state').value.trim(),
    zip:document.getElementById('c_zip').value.trim(),
    sales_rep_id:document.getElementById('c_rep').value||null,
    pricing_tier_id:document.getElementById('c_tier').value||null,
    credit_limit:document.getElementById('c_credit').value||null,
    payment_terms:document.getElementById('c_terms').value,
    tax_exempt:document.getElementById('c_taxexempt').value==='true',
    tax_exempt_id:document.getElementById('c_taxid').value.trim(),
    source:document.getElementById('c_source').value.trim(),
    status:document.getElementById('c_status').value,
    notes:document.getElementById('c_notes').value.trim()
  };
  if(!body.first_name||!body.last_name){toast('First and last name are required.');return;}
  try{
    if(id) await api('PUT','/customers/'+id,body);
    else await api('POST','/customers',body);
    closeModal('customerModal');
    toast(id?'Customer updated.':'Customer added.');
    loadCustomers(); loadDropdowns();
  }catch(e){toast('Error: '+e.message);}
}

async function deleteCustomer(){
  var id=document.getElementById('custId').value;
  if(!id||!confirm('Delete this customer?'))return;
  try{await api('DELETE','/customers/'+id);closeModal('customerModal');toast('Customer deleted.');loadCustomers();loadDropdowns();}
  catch(e){toast('Error: '+e.message);}
}

// ── REPS PAGE ────────────────────────────────────────────────────
async function loadReps(){
  try{
    var data=await api('GET','/reps');
    reps=data;
    var tbody=document.getElementById('repTbody');
    if(!data.length){tbody.innerHTML='<tr class="empty-row"><td colspan="10">No reps yet.</td></tr>';return;}
    tbody.innerHTML=data.map(function(r){
      return '<tr>'+
        '<td><strong>'+r.name+'</strong></td>'+
        '<td class="muted">'+(r.email||'—')+'</td>'+
        '<td class="muted">'+(r.phone||'—')+'</td>'+
        '<td>'+r.commission_pct+'%</td>'+
        '<td class="muted">'+(r.customer_count||0)+'</td>'+
        '<td class="muted">'+(r.estimate_count||0)+'</td>'+
        '<td class="muted">$'+parseFloat(r.total_revenue||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>'+
        '<td class="muted">$'+parseFloat(r.total_commission||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>'+
        '<td><span class="badge '+(r.active?'b-active':'b-inactive')+'">'+(r.active?'Active':'Inactive')+'</span></td>'+
        '<td><button class="btn btn-sm" onclick="openRepModal('+JSON.stringify(r)+')">Edit</button></td>'+
      '</tr>';
    }).join('');
  }catch(e){toast('Error loading reps: '+e.message);}
}

function openRepModal(r){
  document.getElementById('repModalTitle').textContent=r?'Edit rep':'Add rep';
  document.getElementById('repId').value=r?r.id:'';
  document.getElementById('repDeleteBtn').style.display=r?'':'none';
  document.getElementById('r_name').value=r?r.name:'';
  document.getElementById('r_email').value=r?r.email||'':'';
  document.getElementById('r_phone').value=r?r.phone||'':'';
  document.getElementById('r_commission').value=r?r.commission_pct:0;
  document.getElementById('r_active').value=r?String(r.active):'true';
  document.getElementById('r_notes').value=r?r.notes||'':'';
  openModal('repModal');
}

async function saveRep(){
  var id=document.getElementById('repId').value;
  var body={
    name:document.getElementById('r_name').value.trim(),
    email:document.getElementById('r_email').value.trim(),
    phone:document.getElementById('r_phone').value.trim(),
    commission_pct:parseFloat(document.getElementById('r_commission').value)||0,
    active:document.getElementById('r_active').value==='true',
    notes:document.getElementById('r_notes').value.trim()
  };
  if(!body.name){toast('Name is required.');return;}
  try{
    if(id) await api('PUT','/reps/'+id,body);
    else await api('POST','/reps',body);
    closeModal('repModal');toast(id?'Rep updated.':'Rep added.');
    loadReps(); loadDropdowns();
  }catch(e){toast('Error: '+e.message);}
}

async function deleteRep(){
  var id=document.getElementById('repId').value;
  if(!id||!confirm('Delete this rep?'))return;
  try{await api('DELETE','/reps/'+id);closeModal('repModal');toast('Rep deleted.');loadReps();loadDropdowns();}
  catch(e){toast('Error: '+e.message);}
}

// ── TIERS PAGE ───────────────────────────────────────────────────
async function loadTiers(){
  try{
    var data=await api('GET','/tiers');
    tiers=data;
    var tbody=document.getElementById('tierTbody');
    if(!data.length){tbody.innerHTML='<tr class="empty-row"><td colspan="6">No tiers yet.</td></tr>';return;}
    tbody.innerHTML=data.map(function(t){
      return '<tr>'+
        '<td><strong>'+t.name+'</strong></td>'+
        '<td class="muted">'+(t.margin_override!=null?t.margin_override+'%':'Default')+'</td>'+
        '<td class="muted">'+t.discount_pct+'% off</td>'+
        '<td class="muted">'+(t.customer_count||0)+' customers</td>'+
        '<td class="muted" style="max-width:220px">'+(t.notes||'—')+'</td>'+
        '<td><button class="btn btn-sm" onclick="openTierModal('+JSON.stringify(t)+')">Edit</button></td>'+
      '</tr>';
    }).join('');
  }catch(e){toast('Error loading tiers: '+e.message);}
}

function openTierModal(t){
  document.getElementById('tierModalTitle').textContent=t?'Edit tier':'Add tier';
  document.getElementById('tierId').value=t?t.id:'';
  document.getElementById('tierDeleteBtn').style.display=t?'':'none';
  document.getElementById('t_name').value=t?t.name:'';
  document.getElementById('t_discount').value=t?t.discount_pct:0;
  document.getElementById('t_margin').value=t&&t.margin_override!=null?t.margin_override:'';
  document.getElementById('t_notes').value=t?t.notes||'':'';
  openModal('tierModal');
}

async function saveTier(){
  var id=document.getElementById('tierId').value;
  var mv=document.getElementById('t_margin').value;
  var body={
    name:document.getElementById('t_name').value.trim(),
    discount_pct:parseFloat(document.getElementById('t_discount').value)||0,
    margin_override:mv!==''?parseFloat(mv):null,
    notes:document.getElementById('t_notes').value.trim()
  };
  if(!body.name){toast('Name is required.');return;}
  try{
    if(id) await api('PUT','/tiers/'+id,body);
    else await api('POST','/tiers',body);
    closeModal('tierModal');toast(id?'Tier updated.':'Tier added.');
    loadTiers(); loadDropdowns();
  }catch(e){toast('Error: '+e.message);}
}

async function deleteTier(){
  var id=document.getElementById('tierId').value;
  if(!id||!confirm('Delete this tier?'))return;
  try{await api('DELETE','/tiers/'+id);closeModal('tierModal');toast('Tier deleted.');loadTiers();loadDropdowns();}
  catch(e){toast('Error: '+e.message);}
}

// ── ESTIMATOR ────────────────────────────────────────────────────
var stocks={
  digital:[
    {id:'bond',name:'Bond 20lb',vendor:'',size:'letter',weight:'20lb',finish:'uncoated',vendorCost:0.004,markup:0,costPerSheet:0.004,notes:''},
    {id:'gloss',name:'Gloss 80lb',vendor:'',size:'letter',weight:'80lb text',finish:'gloss',vendorCost:0.018,markup:20,costPerSheet:0.022,notes:''},
    {id:'matte',name:'Matte 80lb',vendor:'',size:'letter',weight:'80lb text',finish:'matte',vendorCost:0.017,markup:18,costPerSheet:0.020,notes:''},
    {id:'card100',name:'Card 100lb',vendor:'',size:'letter',weight:'100lb cover',finish:'gloss',vendorCost:0.023,markup:22,costPerSheet:0.028,notes:''}
  ],
  wide:[
    {id:'vinyl',name:'Vinyl banner',vendor:'',rollW:54,printW:52,vendorCost:0.65,markup:23,costPerSqft:0.80,notes:''},
    {id:'canvas',name:'Canvas',vendor:'',rollW:60,printW:58,vendorCost:0.95,markup:26,costPerSqft:1.20,notes:''},
    {id:'foam',name:'Foam board',vendor:'',rollW:48,printW:46,vendorCost:0.48,markup:25,costPerSqft:0.60,notes:''},
    {id:'photo',name:'Photo paper',vendor:'',rollW:44,printW:42,vendorCost:0.80,markup:25,costPerSqft:1.00,notes:''}
  ]
};
var postPress=[
  {id:'pp1',name:'Laminate (gloss)',method:'per_sqft',rate:0.50,min:5,appliesTo:'both',enabled:false,qty:1},
  {id:'pp2',name:'Folding',method:'per_unit',rate:0.08,min:3,appliesTo:'digital',enabled:false,qty:1},
  {id:'pp3',name:'Saddle stitch',method:'per_unit',rate:0.20,min:10,appliesTo:'digital',enabled:false,qty:1},
  {id:'pp4',name:'Coil binding',method:'per_unit',rate:0.85,min:15,appliesTo:'digital',enabled:false,qty:1},
  {id:'pp5',name:'Grommets',method:'per_unit',rate:0.75,min:3,appliesTo:'wide',enabled:false,qty:4},
  {id:'pp6',name:'UV coating',method:'per_sqft',rate:0.40,min:8,appliesTo:'both',enabled:false,qty:1},
  {id:'pp7',name:'Die cutting',method:'flat',rate:45,min:45,appliesTo:'both',enabled:false,qty:1}
];
var idCtr=200;
function nid(){return 'x'+(++idCtr);}

function onCustomerChange(){
  var sel=document.getElementById('customerSel');
  var opt=sel.options[sel.selectedIndex];
  var repId=opt.getAttribute('data-rep');
  var repComm=opt.getAttribute('data-repcomm')||0;
  var tierName=opt.getAttribute('data-tiername')||'';
  var discount=parseFloat(opt.getAttribute('data-discount'))||0;
  var marginOverride=opt.getAttribute('data-margin');

  // Auto-set rep
  if(repId){
    document.getElementById('repSel').value=repId;
    document.getElementById('commPct').value=repComm;
  }
  // Auto-set margin from tier
  if(marginOverride&&marginOverride!=='null'&&marginOverride!==''){
    document.getElementById('marginSlider').value=marginOverride;
    document.getElementById('marginDisplay').textContent=marginOverride+'%';
  }
  // Show tier banner
  var banner=document.getElementById('tierBanner');
  if(tierName&&sel.value){
    banner.style.display='block';
    banner.textContent=tierName+' tier'+(discount>0?' — '+discount+'% discount applied':'');
  } else {
    banner.style.display='none';
  }
  calc();
}

function onRepChange(){
  var sel=document.getElementById('repSel');
  var opt=sel.options[sel.selectedIndex];
  var comm=opt.getAttribute('data-comm')||0;
  document.getElementById('commPct').value=comm;
}

function toggleJobType(){
  // digi-fields and wide-fields are now handled by imposition modal
  buildStockSelects(); renderPPList();
}

function buildStockSelects(){
  var ds=document.getElementById('stockSel');var cur=ds?ds.value:'';
  if(ds)ds.innerHTML=stocks.digital.map(function(s){return '<option value="'+s.id+'"'+(s.id===cur?' selected':'')+'>'+s.name+'</option>';}).join('');
  var ws=document.getElementById('mediaSel');var wcur=ws?ws.value:'';
  if(ws)ws.innerHTML=stocks.wide.map(function(s){
    return '<option value="'+s.id+'"'+(s.id===wcur?' selected':'')+
      ' data-width="'+(s.rollWidth||54)+'"'+
      ' data-cost="'+(s.costPerSqft||0)+'"'+
      '>'+s.name+'</option>';
  }).join('');
}

function calc(){
  var type=document.getElementById('jobType').value;
  var margin=parseInt(document.getElementById('marginSlider').value)/100;
  var rush=parseFloat(document.getElementById('rushFee').value)||0;
  var taxPct=parseFloat(document.getElementById('taxRate').value)||0;
  var rateColor=parseFloat(document.getElementById('rateColor').value)||0.045;
  var rateBW=parseFloat(document.getElementById('rateBW').value)||0.012;
  var rmMap={letter:parseFloat(document.getElementById('rmLetter').value)||1,legal:parseFloat(document.getElementById('rmLegal').value)||1.2,tabloid:parseFloat(document.getElementById('rmTabloid').value)||1.8,a4:parseFloat(document.getElementById('rmA4').value)||1};
  var setupD=parseFloat(document.getElementById('setupDigital').value)||8;
  var setupW=parseFloat(document.getElementById('setupWide').value)||15;
  // Tier discount
  var sel=document.getElementById('customerSel');
  var opt=sel.options[sel.selectedIndex];
  var tierDiscount=parseFloat(opt.getAttribute('data-discount'))||0;

  var cost=0,breakdown=[],qty=1,sides=1,sqft=0;
  if(type==='digital'){
    qty=parseInt(document.getElementById('qty').value)||1;
    sides=parseInt(document.getElementById('sides').value)||1;
    var size=document.getElementById('paperSize').value;
    var cm=document.getElementById('colorMode').value;
    var stockId=document.getElementById('stockSel').value;
    var stock=stocks.digital.filter(function(s){return s.id===stockId;})[0]||stocks.digital[0];
    if(!stock)return;
    var rm=rmMap[size]||1;
    var paperCost=stock.costPerSheet*qty*rm;
    var inkCost=(cm==='color'?rateColor:rateBW)*rm*qty*sides;
    cost=paperCost+inkCost+setupD;
    breakdown=[{label:'Paper & stock',detail:stock.name+' x '+qty,val:paperCost},{label:'Ink ('+(cm==='color'?'color':'B&W')+', '+sides+'s)',detail:'',val:inkCost},{label:'Setup',detail:'',val:setupD}];
  } else {
    var w=parseFloat(document.getElementById('imp_fw').value)||24;
    var h=parseFloat(document.getElementById('imp_fh').value)||36;
    qty=parseInt(document.getElementById('wfQty').value)||1;
    calcImposition();
    var subsCost=impResult.subsCost||0;
    var sheetsNeeded=impResult.sheetsNeeded||1;
    var outsPerSheet=impResult.outsPerSheet||1;
    sqft=impResult.totalSqft||((w*h)/144*Math.ceil(qty/outsPerSheet));
    var mediaId=document.getElementById('mediaSel').value;
    var media=stocks.wide.filter(function(s){return s.id===mediaId;})[0]||stocks.wide[0];
    var mediaName=media?media.name:'substrate';
    cost=subsCost+setupW;
    breakdown=[
      {label:'Substrate — '+mediaName,detail:sqft.toFixed(2)+' sqft, '+sheetsNeeded+' sheets',val:subsCost},
      {label:'Setup',detail:'',val:setupW},
      {label:'Imposition',detail:outsPerSheet+' outs/sheet, '+impResult.wastePct.toFixed(1)+'% waste',val:0}
    ];
  }
  var ppBD=[];
  postPress.forEach(function(p){
    if(!p.enabled||(p.appliesTo!=='both'&&p.appliesTo!==type))return;
    var c=calcPPCost(p,qty,sides,sqft/Math.max(qty,1));
    ppBD.push({label:p.name,val:c,id:p.id}); cost+=c;
    var el=document.getElementById('ppcost_'+p.id); if(el)el.textContent='$'+c.toFixed(2);
  });
  postPress.filter(function(p){return !p.enabled;}).forEach(function(p){var el=document.getElementById('ppcost_'+p.id);if(el)el.textContent='';});
  var rushAmt=cost*rush;
  if(rushAmt>0)ppBD.push({label:'Rush ('+Math.round(rush*100)+'%)',val:rushAmt});
  cost+=rushAmt;
  var sell=cost/(1-margin);
  // Apply tier discount
  if(tierDiscount>0)sell=sell*(1-tierDiscount/100);
  var profit=sell-cost;
  var tax=sell*(taxPct/100);
  var commPct=parseFloat(document.getElementById('commPct').value)||0;
  var comm=sell*(commPct/100);
  var netProfit=profit-comm;
  var total=sell+tax;
  lastCalc={sell:sell,cost:cost,profit:profit,tax:tax,total:total,taxPct:taxPct,margin:margin,comm:comm,commPct:commPct,netProfit:netProfit,tierDiscount:tierDiscount};
  // Comm preview
  var cp=document.getElementById('commPreview');
  if(commPct>0){cp.style.display='flex';document.getElementById('commPreviewLabel').textContent='Commission ('+commPct+'%)';document.getElementById('commPreviewAmt').textContent='$'+comm.toFixed(2);}
  else cp.style.display='none';
  // Metrics
  document.getElementById('metrics').innerHTML=
    '<div class="metric"><div class="metric-label">Sell price</div><div class="metric-val">$'+sell.toFixed(2)+'</div></div>'+
    '<div class="metric"><div class="metric-label">Gross profit</div><div class="metric-val">$'+profit.toFixed(2)+'</div></div>'+
    (commPct>0?'<div class="metric"><div class="metric-label">Commission</div><div class="metric-val">$'+comm.toFixed(2)+'</div></div>':'<div class="metric"><div class="metric-label">Margin</div><div class="metric-val">'+Math.round(margin*100)+'%</div></div>')+
    '<div class="metric"><div class="metric-label">'+(taxPct>0?'Total w/ tax':'Net profit')+'</div><div class="metric-val">'+(taxPct>0?'$'+total.toFixed(2):'$'+netProfit.toFixed(2))+'</div></div>';
  // Estimate card
  var name=document.getElementById('jobName').value||'Estimate';
  var notes=document.getElementById('jobNotes').value.trim();
  var tag=type==='digital'?'<span class="tag tag-d">Digital</span>':'<span class="tag tag-w">Wide format</span>';
  var custOpt=document.getElementById('customerSel').options[document.getElementById('customerSel').selectedIndex];
  var custLabel=document.getElementById('customerSel').value?custOpt.text.split('(')[0].trim():'';
  var mainRows=breakdown.map(function(b){return '<tr><td>'+b.label+(b.detail?'<br><span style="font-size:11px;color:#aaa">'+b.detail+'</span>':'')+'</td><td>$'+b.val.toFixed(2)+'</td></tr>';}).join('');
  var ppRows=ppBD.length?'<tr><td colspan="2" style="padding-top:10px;font-size:11px;font-weight:500;color:#aaa;text-transform:uppercase;letter-spacing:.06em">Post-press</td></tr>'+ppBD.map(function(p){return '<tr><td>'+p.label+'</td><td>$'+p.val.toFixed(2)+'</td></tr>';}).join(''):'';
  var tierRow=tierDiscount>0?'<tr><td style="color:#0C447C">Tier discount ('+tierDiscount+'%)</td><td style="color:#0C447C">- applied</td></tr>':'';
  var taxRow=taxPct>0?'<tr><td style="color:#666">Tax ('+taxPct+'%)</td><td>$'+tax.toFixed(2)+'</td></tr>':'';
  var commRow=commPct>0?'<tr><td colspan="2" style="padding-top:10px;font-size:11px;font-weight:500;color:#aaa;text-transform:uppercase;letter-spacing:.06em;border-top:none">Sales commission</td></tr><tr><td style="color:#666">Commission ('+commPct+'% of sell)</td><td style="color:#a32d2d">-$'+comm.toFixed(2)+'</td></tr><tr class="grand-row"><td>Net profit</td><td>$'+netProfit.toFixed(2)+'</td></tr>':'';
  var notesHtml=notes?'<div class="notes-box"><div class="nbx-lbl">Notes</div>'+notes+'</div>':'';
  document.getElementById('estimateCard').innerHTML=
    '<div class="est-hdr"><div><div style="font-size:16px;font-weight:500">'+name+'</div><div style="font-size:12px;color:#aaa;margin-top:2px">'+(custLabel?custLabel+' &middot; ':'')+''+tag+' &middot; '+new Date().toLocaleDateString()+'</div></div><div style="text-align:right"><div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:.06em">'+(taxPct>0?'Total w/ tax':'Total')+'</div><div style="font-size:26px;font-weight:500">$'+total.toFixed(2)+'</div></div></div>'+
    '<table class="bd-table"><tr><td colspan="2" style="font-size:11px;font-weight:500;color:#aaa;text-transform:uppercase;letter-spacing:.06em;padding-bottom:6px;border-top:none">Cost of goods</td></tr>'+
    mainRows+ppRows+
    '<tr><td style="font-size:12px;color:#aaa">Total COGS</td><td style="font-size:12px;color:#888">$'+cost.toFixed(2)+'</td></tr>'+
    '<tr><td>Markup ('+Math.round(margin*100)+'% margin)</td><td>$'+profit.toFixed(2)+'</td></tr>'+
    tierRow+
    '<tr class="total-row"><td>Subtotal</td><td>$'+sell.toFixed(2)+'</td></tr>'+
    taxRow+
    '<tr class="grand-row"><td>'+(taxPct>0?'Total (incl. tax)':'Customer price')+'</td><td>$'+total.toFixed(2)+'</td></tr>'+
    commRow+'</table>'+notesHtml;
  document.getElementById('estActionBar').style.display='flex';
}

function calcPPCost(p,qty,sides,sqft){
  var c=0;
  if(p.method==='flat')c=p.rate;
  else if(p.method==='per_unit')c=p.rate*qty*(p.qty||1);
  else if(p.method==='per_side')c=p.rate*qty*sides;
  else if(p.method==='per_sqft')c=p.rate*(sqft||0)*qty;
  return Math.max(c,p.min);
}

async function saveEstimate(){
  var custId=document.getElementById('customerSel').value||null;
  var repSel=document.getElementById('repSel');
  var repId=repSel.value||null;
  var type=document.getElementById('jobType').value;
  var jobName=document.getElementById('jobName').value||'Estimate';
  var body={
    customer_id:custId,sales_rep_id:repId,
    job_name:jobName,
    job_type:type,status:'draft',
    sell_price:lastCalc.sell,cogs:lastCalc.cost,gross_profit:lastCalc.profit,
    margin_pct:lastCalc.margin*100,tax_pct:lastCalc.taxPct,tax_amt:lastCalc.tax,
    comm_pct:lastCalc.commPct,comm_amt:lastCalc.comm,
    net_profit:lastCalc.netProfit,total:lastCalc.total,
    notes:document.getElementById('jobNotes').value.trim()
  };
  try{
    var saved=await api('POST','/estimates',body);
    toast('Estimate '+saved.estimate_number+' saved!');
    // Update the job name field to show the estimate number
    document.getElementById('jobName').value=saved.estimate_number+' — '+jobName;
    calc();
    var bar=document.getElementById('estActionBar');
    bar.innerHTML='<div style="font-size:12px;font-weight:500;color:#888;display:flex;align-items:center;padding:0 4px"><span style="font-family:monospace;color:#1a1a18">'+saved.estimate_number+'</span></div>'+
      '<button class="btn btn-primary" onclick="saveEstimate()">Save estimate</button>'+
      '<button class="btn btn-blue" onclick="window.print()">Export PDF</button>'+
      '<button class="btn" style="background:#EAF3DE;border-color:#3B6D11;color:#27500A" onclick="openConvertModal('+saved.id+',\''+jobName.replace(/'/g,"\\'")+'\','+lastCalc.total+')">Convert to order</button>';
  }catch(e){toast('Error saving: '+e.message);}
}

async function loadCustomerIntoEstimator(id){
  showPage('estimator',document.querySelectorAll('.nav-tab')[0]);
  document.getElementById('customerSel').value=id;
  onCustomerChange();
}

function clearJob(){
  document.getElementById('jobName').value='New estimate';
  document.getElementById('customerSel').value='';
  document.getElementById('repSel').value='';
  document.getElementById('commPct').value=0;
  document.getElementById('marginSlider').value=35;
  document.getElementById('marginDisplay').textContent='35%';
  document.getElementById('rushFee').value=0;
  document.getElementById('taxRate').value=0;
  document.getElementById('jobNotes').value='';
  document.getElementById('tierBanner').style.display='none';
  document.getElementById('commPreview').style.display='none';
  postPress.forEach(function(p){p.enabled=false;});
  renderPPList(); calc();
}

function switchESTab(name,el){
  document.querySelectorAll('.estab').forEach(function(t){t.classList.remove('active');});
  el.classList.add('active');
  ['job','stocks','postpress','rates'].forEach(function(n){document.getElementById('estab-'+n).style.display=n===name?'block':'none';});
  if(name==='stocks')renderStockCards();
  if(name==='postpress')renderPPList();
}

// Stock modal
var _smType=null,_smIdx=null;
function openStockModal(type,idx){
  _smType=type;_smIdx=idx;
  document.getElementById('sm_digital_fields').style.display=type==='digital'?'block':'none';
  document.getElementById('sm_wide_fields').style.display=type==='wide'?'block':'none';
  document.getElementById('stockModalTitle').textContent=(idx===null?'Add ':'Edit ')+(type==='digital'?'stock':'media');
  if(idx!==null){
    var s=stocks[type][idx];
    document.getElementById('sm_name').value=s.name;document.getElementById('sm_vendor').value=s.vendor||'';document.getElementById('sm_notes').value=s.notes||'';
    if(type==='digital'){document.getElementById('sm_size').value=s.size||'letter';document.getElementById('sm_weight').value=s.weight||'';document.getElementById('sm_finish').value=s.finish||'uncoated';document.getElementById('sm_vendorCost').value=s.vendorCost.toFixed(4);document.getElementById('sm_markup').value=s.markup||0;smCalc();}
    else{document.getElementById('sm_rollW').value=s.rollW||54;document.getElementById('sm_printW').value=s.printW||52;document.getElementById('sm_wVendorCost').value=s.vendorCost.toFixed(3);document.getElementById('sm_wMarkup').value=s.markup||0;smCalcW();}
  } else {
    ['sm_name','sm_vendor','sm_notes'].forEach(function(id){document.getElementById(id).value='';});
    if(type==='digital'){document.getElementById('sm_vendorCost').value='0.0100';document.getElementById('sm_markup').value=0;smCalc();}
    else{document.getElementById('sm_rollW').value=54;document.getElementById('sm_printW').value=52;document.getElementById('sm_wVendorCost').value='0.500';document.getElementById('sm_wMarkup').value=0;smCalcW();}
  }
  document.getElementById('stockModalOverlay').style.display='flex';
}
function toggleSmCustom(){document.getElementById('sm_custom_size').style.display=document.getElementById('sm_size').value==='custom'?'block':'none';}
function smCalc(){var vc=parseFloat(document.getElementById('sm_vendorCost').value)||0,mu=parseFloat(document.getElementById('sm_markup').value)||0;document.getElementById('sm_sellPrev').textContent='$'+(vc*(1+mu/100)).toFixed(4);}
function smCalcW(){var vc=parseFloat(document.getElementById('sm_wVendorCost').value)||0,mu=parseFloat(document.getElementById('sm_wMarkup').value)||0;document.getElementById('sm_wSellPrev').textContent='$'+(vc*(1+mu/100)).toFixed(3);}
function saveStockModal(){
  var type=_smType,name=document.getElementById('sm_name').value.trim()||'Unnamed',vendor=document.getElementById('sm_vendor').value.trim(),notes=document.getElementById('sm_notes').value.trim();
  var eid=_smIdx!==null?stocks[type][_smIdx].id:nid();
  if(type==='digital'){
    var vc=parseFloat(document.getElementById('sm_vendorCost').value)||0,mu=parseFloat(document.getElementById('sm_markup').value)||0;
    var obj={id:eid,name:name,vendor:vendor,size:document.getElementById('sm_size').value,weight:document.getElementById('sm_weight').value.trim(),finish:document.getElementById('sm_finish').value,vendorCost:vc,markup:mu,costPerSheet:vc*(1+mu/100),notes:notes};
    if(_smIdx!==null)stocks.digital[_smIdx]=obj;else stocks.digital.push(obj);
  }else{
    var vc=parseFloat(document.getElementById('sm_wVendorCost').value)||0,mu=parseFloat(document.getElementById('sm_wMarkup').value)||0;
    var obj={id:eid,name:name,vendor:vendor,rollW:parseFloat(document.getElementById('sm_rollW').value)||54,printW:parseFloat(document.getElementById('sm_printW').value)||52,vendorCost:vc,markup:mu,costPerSqft:vc*(1+mu/100),notes:notes};
    if(_smIdx!==null)stocks.wide[_smIdx]=obj;else stocks.wide.push(obj);
  }
  document.getElementById('stockModalOverlay').style.display='none';
  renderStockCards();buildStockSelects();calc();
}
function removeStock(type,idx){stocks[type].splice(idx,1);renderStockCards();buildStockSelects();calc();}
function renderStockCards(){
  var SZ={letter:'Letter',legal:'Legal',tabloid:'Tabloid',a4:'A4',custom:'Custom'};
  var dDiv=document.getElementById('digitalStockList');
  dDiv.innerHTML=stocks.digital.length?stocks.digital.map(function(s,i){
    var meta=[];if(s.size&&SZ[s.size])meta.push(SZ[s.size]);if(s.weight)meta.push(s.weight);if(s.vendor)meta.push(s.vendor);
    return '<div style="background:#fff;border:1px solid #e0ded8;border-radius:9px;padding:9px 11px;margin-bottom:7px"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div style="font-size:12px;font-weight:500">'+s.name+'</div><div style="font-size:11px;color:#aaa">'+meta.join(' · ')+'</div></div><div style="text-align:right"><div style="font-size:12px;font-weight:500">$'+s.costPerSheet.toFixed(4)+'/sht</div><div style="font-size:11px;color:#aaa">Cost $'+s.vendorCost.toFixed(4)+' · '+s.markup+'% up</div></div></div><div style="display:flex;gap:5px;margin-top:7px"><button class="btn btn-sm" onclick="openStockModal(\'digital\','+i+')">Edit</button><button class="btn btn-sm btn-danger" onclick="removeStock(\'digital\','+i+')">Remove</button></div></div>';
  }).join(''):'<div style="font-size:12px;color:#aaa;padding:6px 0">None yet.</div>';
  var wDiv=document.getElementById('wideStockList');
  wDiv.innerHTML=stocks.wide.length?stocks.wide.map(function(s,i){
    var meta=[];if(s.rollW)meta.push('Roll '+s.rollW+'"');if(s.vendor)meta.push(s.vendor);
    return '<div style="background:#fff;border:1px solid #e0ded8;border-radius:9px;padding:9px 11px;margin-bottom:7px"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div style="font-size:12px;font-weight:500">'+s.name+'</div><div style="font-size:11px;color:#aaa">'+meta.join(' · ')+'</div></div><div style="text-align:right"><div style="font-size:12px;font-weight:500">$'+s.costPerSqft.toFixed(3)+'/sqft</div><div style="font-size:11px;color:#aaa">Cost $'+s.vendorCost.toFixed(3)+' · '+s.markup+'% up</div></div></div><div style="display:flex;gap:5px;margin-top:7px"><button class="btn btn-sm" onclick="openStockModal(\'wide\','+i+')">Edit</button><button class="btn btn-sm btn-danger" onclick="removeStock(\'wide\','+i+')">Remove</button></div></div>';
  }).join(''):'<div style="font-size:12px;color:#aaa;padding:6px 0">None yet.</div>';
}

function renderPPList(){
  var type=document.getElementById('jobType').value;
  var rel=postPress.filter(function(p){return p.appliesTo==='both'||p.appliesTo===type;});
  if(!rel.length){document.getElementById('ppList').innerHTML='<div style="font-size:12px;color:#aaa;padding:6px 0">None for this job type.</div>';return;}
  document.getElementById('ppList').innerHTML=rel.map(function(p){
    var idx=postPress.indexOf(p);
    var qEl=(p.method==='per_unit'||p.method==='per_side')?'<div style="display:flex;align-items:center;gap:3px"><label style="font-size:11px;color:#aaa">qty</label><input type="number" value="'+p.qty+'" min="1" style="width:46px;height:24px;font-size:11px;padding:2px 5px;border:1px solid #ddd;border-radius:5px" oninput="postPress['+idx+'].qty=parseInt(this.value)||1;calc()"></div>':'';
    return '<div class="pp-item"><input type="checkbox" class="pp-check"'+(p.enabled?' checked':'')+' onchange="postPress['+idx+'].enabled=this.checked;calc()"><span class="pp-name">'+p.name+'</span>'+qEl+'<span class="pp-cost" id="ppcost_'+p.id+'"></span><button class="btn btn-sm btn-danger" onclick="postPress.splice('+idx+',1);renderPPList()" style="padding:2px 6px">×</button></div>';
  }).join('');
  calc();
}
function showAddPP(){document.getElementById('addPPForm').style.display='block';}
function saveNewPP(){
  var name=document.getElementById('newPPName').value.trim();if(!name)return;
  postPress.push({id:nid(),name:name,method:document.getElementById('newPPMethod').value,rate:parseFloat(document.getElementById('newPPRate').value)||0,min:parseFloat(document.getElementById('newPPMin').value)||0,appliesTo:document.getElementById('newPPType').value,enabled:false,qty:1});
  document.getElementById('addPPForm').style.display='none';document.getElementById('newPPName').value='';renderPPList();
}

// ── ESTIMATES LIST ────────────────────────────────────────────────
var STATUS_LABEL_EST={draft:'Draft',sent:'Sent',approved:'Approved',declined:'Declined'};
var STATUS_CLS_EST={draft:'b-draft',sent:'b-sent',approved:'b-approved',declined:'b-declined'};

async function loadEstimates(){
  var search=document.getElementById('estSearch').value;
  var status=document.getElementById('estStatusFilter').value;
  var repId=document.getElementById('estRepFilter').value;
  var params=new URLSearchParams();
  if(search)params.set('search',search);
  if(status)params.set('status',status);
  if(repId)params.set('rep_id',repId);
  try{
    var data=await api('GET','/estimates?'+params.toString());
    var draft=data.filter(function(e){return e.status==='draft';}).length;
    var approved=data.filter(function(e){return e.status==='approved';}).length;
    var total=data.reduce(function(s,e){return s+parseFloat(e.total||0);},0);
    document.getElementById('estimateStats').innerHTML=
      '<div class="stat"><div class="stat-label">Total</div><div class="stat-val">'+data.length+'</div></div>'+
      '<div class="stat"><div class="stat-label">Draft</div><div class="stat-val">'+draft+'</div></div>'+
      '<div class="stat"><div class="stat-label">Approved</div><div class="stat-val">'+approved+'</div></div>'+
      '<div class="stat"><div class="stat-label">Value</div><div class="stat-val">$'+total.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})+'</div></div>';
    // populate rep filter
    var repSeen={};
    var repOpts='<option value="">All reps</option>';
    data.forEach(function(e){if(e.sales_rep_id&&!repSeen[e.sales_rep_id]){repSeen[e.sales_rep_id]=1;repOpts+='<option value="'+e.sales_rep_id+'"'+(repId==e.sales_rep_id?' selected':'')+'>'+e.rep_name+'</option>';}});
    document.getElementById('estRepFilter').innerHTML=repOpts;
    var tbody=document.getElementById('estTbody');
    if(!data.length){tbody.innerHTML='<tr class="empty-row"><td colspan="8">No estimates found.</td></tr>';return;}
    tbody.innerHTML=data.map(function(e){
      var date=new Date(e.created_at).toLocaleDateString();
      var statusCls=STATUS_CLS_EST[e.status]||'b-draft';
      var statusLbl=STATUS_LABEL_EST[e.status]||e.status;
      var actions='<div class="actions">'+
        '<button class="btn btn-sm" onclick="openEstimateById('+e.id+')">Open</button>'+
        '<select style="font-size:11px;height:26px;padding:0 6px;border:1px solid #ddd;border-radius:6px" onchange="updateEstimateStatus('+e.id+',this.value)">'+
          Object.keys(STATUS_LABEL_EST).map(function(s){return '<option value="'+s+'"'+(e.status===s?' selected':'')+'>'+STATUS_LABEL_EST[s]+'</option>';}).join('')+
        '</select>';
      if(e.status==='approved'){
        actions+='<button class="btn btn-sm btn-blue" onclick="viewOrderFromEstimate('+e.id+')">View order</button>';
      } else {
        actions+='<button class="btn btn-sm" style="background:#EAF3DE;border-color:#3B6D11;color:#27500A" onclick="openConvertModal('+e.id+',\''+( e.job_name||'').replace(/'/g,"\\'")+'\','+e.total+')">Convert</button>';
      }
      actions+='<button class="btn btn-sm btn-danger" onclick="deleteEstimate('+e.id+')">Delete</button></div>';
      return '<tr>'+
        '<td><strong style="font-family:monospace;font-size:12px">'+(e.estimate_number||'—')+'</strong></td>'+
        '<td style="cursor:pointer;color:#185FA5;font-weight:500" onclick="openEstimateById('+e.id+')">'+e.job_name+'</td>'+
        '<td class="muted">'+(e.company||e.customer_name||'—')+'</td>'+
        '<td class="muted">'+(e.rep_name||'—')+'</td>'+
        '<td class="muted">'+date+'</td>'+
        '<td class="muted">$'+parseFloat(e.total||0).toFixed(2)+'</td>'+
        '<td><span class="badge '+statusCls+'">'+statusLbl+'</span></td>'+
        '<td>'+actions+'</td>'+
      '</tr>';
    }).join('');
  }catch(err){console.error(err);toast('Error loading estimates.');}
}

async function updateEstimateStatus(id,status){
  try{
    await api('PATCH','/estimates/'+id+'/status',{status:status});
    toast('Status updated.');
    loadEstimates();
  }catch(e){toast('Error: '+e.message);}
}

async function deleteEstimate(id){
  if(!confirm('Delete this estimate?'))return;
  try{
    await api('DELETE','/estimates/'+id);
    toast('Estimate deleted.');
    loadEstimates();
  }catch(e){toast('Error: '+e.message);}
}

// ── ORDERS & KANBAN ───────────────────────────────────────────────
var PAY_LABELS={unpaid:'Unpaid',deposit:'Deposit',paid:'Paid in full'};
var orderView='board';
var allStages=[];
var allOrders=[];
var draggingOrderId=null;

function setOrderView(v){
  orderView=v;
  document.getElementById('orderListView').style.display=v==='list'?'block':'none';
  document.getElementById('orderBoardView').style.display=v==='board'?'block':'none';
  var lb=document.getElementById('viewListBtn'),bb=document.getElementById('viewBoardBtn');
  lb.style.cssText='border:none;border-radius:0;border-right:0.5px solid #ddd'+(v==='list'?';background:#1a1a18;color:#fff':'');
  bb.style.cssText='border:none;border-radius:0'+(v==='board'?';background:#1a1a18;color:#fff':'');
  if(v==='list') renderOrderList(); else renderKanban();
}

async function loadOrders(){
  var search=document.getElementById('orderSearch').value;
  var pay=document.getElementById('orderPayFilter').value;
  var params=new URLSearchParams();
  if(search)params.set('search',search);
  if(pay)params.set('payment_status',pay);
  try{
    var res=await Promise.all([api('GET','/orders?'+params.toString()),api('GET','/orders/stages')]);
    allOrders=res[0]; allStages=res[1];
    var unpaid=allOrders.filter(function(o){return o.payment_status==='unpaid';});
    var lastStageId=allStages.length?allStages[allStages.length-1].id:null;
    var open=allOrders.filter(function(o){return o.stage_id!=lastStageId;});
    var revenue=allOrders.reduce(function(s,o){return s+parseFloat(o.total||0);},0);
    document.getElementById('orderStats').innerHTML=
      '<div class="stat"><div class="stat-label">Total orders</div><div class="stat-val">'+allOrders.length+'</div></div>'+
      '<div class="stat"><div class="stat-label">In progress</div><div class="stat-val">'+open.length+'</div></div>'+
      '<div class="stat"><div class="stat-label">Unpaid</div><div class="stat-val">'+unpaid.length+'</div></div>'+
      '<div class="stat"><div class="stat-label">Total value</div><div class="stat-val">$'+revenue.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})+'</div></div>';
    if(orderView==='list') renderOrderList(); else renderKanban();
  }catch(e){console.error(e);}
}

function renderOrderList(){
  var tbody=document.getElementById('orderTbody');
  if(!allOrders.length){tbody.innerHTML='<tr class="empty-row"><td colspan="10">No orders found.</td></tr>';return;}
  var t=new Date(); t.setHours(0,0,0,0);
  tbody.innerHTML=allOrders.map(function(o){
    var due=o.due_date?new Date(o.due_date):null;
    var overdue=due&&due<t;
    var sc=o.stage_color||'#888';
    return '<tr>'+
      '<td><strong style="font-family:monospace;font-size:12px">'+o.job_number+'</strong></td>'+
      '<td>'+o.job_name+'</td>'+
      '<td class="muted">'+(o.company||o.customer_name||'—')+'</td>'+
      '<td class="muted">'+(o.rep_name||'—')+'</td>'+
      '<td><span style="display:inline-block;font-size:10px;padding:2px 8px;border-radius:20px;font-weight:500;background:'+sc+'22;color:'+sc+'">'+(o.stage_name||'—')+'</span></td>'+
      '<td class="muted" style="color:'+(overdue?'#a32d2d':'inherit')+'">'+(due?due.toLocaleDateString():'—')+'</td>'+
      '<td class="muted">'+(o.operator||'—')+'</td>'+
      '<td><span class="badge b-'+o.payment_status+'">'+PAY_LABELS[o.payment_status]+'</span></td>'+
      '<td class="muted">$'+parseFloat(o.total||0).toFixed(2)+'</td>'+
      '<td><button class="btn btn-sm" onclick=\'openOrderModal('+JSON.stringify(o)+')\'>Edit</button></td>'+
    '</tr>';
  }).join('');
}

function renderKanban(){
  var board=document.getElementById('kanbanBoard');
  var t=new Date(); t.setHours(0,0,0,0);
  if(!allStages.length){board.innerHTML='<div style="color:#aaa;font-size:13px;padding:2rem">No stages. Click Manage stages to add some.</div>';return;}
  board.innerHTML=allStages.map(function(stage){
    var cards=allOrders.filter(function(o){return Number(o.stage_id)===Number(stage.id);});
    var cardsHtml=cards.map(function(o){
      var due=o.due_date?new Date(o.due_date):null;
      var overdue=due&&due<t;
      return '<div style="background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);padding:10px 12px;cursor:grab;user-select:none;margin-bottom:8px" id="kcard-'+o.id+'" draggable="true" ondragstart="onCardDragStart(event,'+o.id+')" ondragend="onCardDragEnd(event)">'+
        '<div style="font-size:10px;font-weight:500;color:#888;font-family:monospace;margin-bottom:3px">'+o.job_number+'</div>'+
        '<div style="font-size:13px;font-weight:500;color:var(--color-text-primary);margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+o.job_name+'</div>'+
        '<div style="font-size:11px;color:var(--color-text-secondary);margin-bottom:6px">'+(o.company||o.customer_name||'')+'</div>'+
        '<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">'+
          '<span class="badge b-'+o.payment_status+'">'+PAY_LABELS[o.payment_status]+'</span>'+
          (due?'<span style="font-size:11px;color:'+(overdue?'#a32d2d':'#888')+'">'+due.toLocaleDateString()+'</span>':'')+
          '<span style="margin-left:auto;font-size:12px;font-weight:500;color:var(--color-text-primary)">$'+parseFloat(o.total||0).toFixed(2)+'</span>'+
        '</div>'+
        '<div style="margin-top:8px;border-top:0.5px solid var(--color-border-tertiary);padding-top:6px">'+
          '<button class="btn btn-sm" style="font-size:11px;padding:3px 8px" onclick=\'openOrderModal('+JSON.stringify(o)+')\'>Edit</button>'+
        '</div>'+
      '</div>';
    }).join('');
    return '<div style="background:var(--color-background-secondary);border-radius:var(--border-radius-lg);min-width:240px;width:240px;flex-shrink:0" id="kcol-'+stage.id+'" ondragover="onColDragOver(event)" ondrop="onColDrop(event,'+stage.id+')" ondragleave="onColDragLeave(event)">'+
      '<div style="padding:10px 12px;border-bottom:1px solid var(--color-border-tertiary);display:flex;align-items:center;justify-content:space-between;border-top:3px solid '+stage.color+'">'+
        '<span style="font-size:12px;font-weight:500;color:var(--color-text-primary)">'+stage.name+'</span>'+
        '<span style="font-size:11px;color:var(--color-text-tertiary);background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:20px;padding:1px 8px">'+cards.length+'</span>'+
      '</div>'+
      '<div style="padding:10px;min-height:200px" id="kbody-'+stage.id+'">'+cardsHtml+'</div>'+
    '</div>';
  }).join('');
}

function onCardDragStart(e,id){
  draggingOrderId=id;
  setTimeout(function(){var c=document.getElementById('kcard-'+id);if(c)c.style.opacity='0.4';},0);
  e.stopPropagation();
}
function onCardDragEnd(){
  if(draggingOrderId){var c=document.getElementById('kcard-'+draggingOrderId);if(c)c.style.opacity='1';}
  document.querySelectorAll('[id^=kbody-]').forEach(function(b){b.style.background='';});
}
function onColDragOver(e){
  e.preventDefault();
  var body=document.getElementById('kbody-'+e.currentTarget.id.replace('kcol-',''));
  if(body)body.style.background='var(--color-background-info)';
}
function onColDragLeave(e){
  var body=document.getElementById('kbody-'+e.currentTarget.id.replace('kcol-',''));
  if(body)body.style.background='';
}
async function onColDrop(e,stageId){
  e.preventDefault();
  var body=document.getElementById('kbody-'+stageId);
  if(body)body.style.background='';
  if(!draggingOrderId)return;
  var id=draggingOrderId; draggingOrderId=null;
  try{
    await api('PATCH','/orders/'+id,{stage_id:stageId});
    var o=allOrders.find(function(x){return x.id==id;});
    if(o){var s=allStages.find(function(x){return x.id==stageId;});o.stage_id=stageId;o.stage_name=s?s.name:'';o.stage_color=s?s.color:'';}
    renderKanban();
    toast('Order moved.');
  }catch(err){toast('Error: '+err.message);}
}

async function openManageStages(){
  try{
    var stages=await api('GET','/orders/stages');
    allStages=stages;
    renderStagesList(stages);
    openModal('stagesModal');
  }catch(e){toast('Error loading stages.');}
}

function renderStagesList(stages){
  var div=document.getElementById('stagesList');
  if(!stages.length){div.innerHTML='<div style="font-size:12px;color:#aaa;padding:6px 0">No stages yet.</div>';return;}
  div.innerHTML=stages.map(function(s){
    return '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:0.5px solid var(--color-border-tertiary)">'+
      '<div style="width:12px;height:12px;border-radius:50%;background:'+s.color+';flex-shrink:0"></div>'+
      '<input type="text" value="'+s.name+'" style="flex:1;height:28px;font-size:13px;padding:0 8px;border:1px solid #ddd;border-radius:7px" onchange="updateStage('+s.id+',this.value,this.parentElement.querySelector(\'input[type=color]\').value)">'+
      '<input type="color" value="'+s.color+'" style="width:32px;height:28px;border:1px solid #ddd;border-radius:7px;padding:2px;cursor:pointer" onchange="updateStage('+s.id+',this.parentElement.querySelector(\'input[type=text]\').value,this.value)">'+
      '<button class="btn btn-sm btn-danger" onclick="deleteStage('+s.id+')">×</button>'+
    '</div>';
  }).join('');
}

async function addStage(){
  var name=document.getElementById('newStageName').value.trim();
  var color=document.getElementById('newStageColor').value;
  if(!name){toast('Enter a stage name.');return;}
  try{
    var stage=await api('POST','/orders/stages',{name:name,color:color});
    allStages.push(stage);
    renderStagesList(allStages);
    document.getElementById('newStageName').value='';
    toast('Stage added.');
    loadOrders();
  }catch(e){toast('Error: '+e.message);}
}

async function updateStage(id,name,color){
  try{await api('PUT','/orders/stages/'+id,{name:name,color:color});}
  catch(e){toast('Error: '+e.message);}
}

async function deleteStage(id){
  if(!confirm('Delete this stage? Orders in it will become unsorted.'))return;
  try{
    await api('DELETE','/orders/stages/'+id);
    allStages=allStages.filter(function(s){return s.id!==id;});
    renderStagesList(allStages);
    toast('Stage deleted.');
    loadOrders();
  }catch(e){toast('Error: '+e.message);}
}

function openConvertModal(estimateId,jobName,total){
  document.getElementById('convertEstimateId').value=estimateId;
  document.getElementById('convertEstimateSummary').innerHTML='<strong>'+jobName+'</strong> &middot; $'+parseFloat(total).toFixed(2);
  document.getElementById('conv_due_date').value='';
  document.getElementById('conv_operator').value='';
  document.getElementById('conv_deposit').value=0;
  document.getElementById('conv_payment').value='unpaid';
  document.getElementById('conv_notes').value='';
  openModal('convertModal');
}

async function confirmConvert(){
  var id=document.getElementById('convertEstimateId').value;
  var body={
    due_date:document.getElementById('conv_due_date').value||null,
    operator:document.getElementById('conv_operator').value.trim(),
    deposit_amt:parseFloat(document.getElementById('conv_deposit').value)||0,
    payment_status:document.getElementById('conv_payment').value,
    notes:document.getElementById('conv_notes').value.trim()
  };
  try{
    var order=await api('POST','/orders/convert/'+id,body);
    closeModal('convertModal');
    toast('Order '+order.job_number+' created!');
    showPage('orders',document.querySelectorAll('.nav-tab')[2]);
  }catch(e){toast('Error: '+e.message);}
}

function openOrderModal(o){
  if(typeof o==='string')o=JSON.parse(o);
  document.getElementById('orderId').value=o.id;
  document.getElementById('orderModalJobNum').textContent=o.job_number+' — '+o.job_name;
  var stageSelect=document.getElementById('o_stage');
  stageSelect.innerHTML=allStages.map(function(s){return '<option value="'+s.id+'"'+(s.id==o.stage_id?' selected':'')+'>'+s.name+'</option>';}).join('');
  document.getElementById('o_pay').value=o.payment_status||'unpaid';
  document.getElementById('o_due').value=o.due_date?o.due_date.split('T')[0]:'';
  document.getElementById('o_operator').value=o.operator||'';
  document.getElementById('o_deposit').value=o.deposit_amt||0;
  document.getElementById('o_notes').value=o.notes||'';
  openModal('orderModal');
}

async function saveOrder(){
  var id=document.getElementById('orderId').value;
  var body={
    stage_id:document.getElementById('o_stage').value||null,
    payment_status:document.getElementById('o_pay').value,
    due_date:document.getElementById('o_due').value||null,
    operator:document.getElementById('o_operator').value.trim(),
    deposit_amt:parseFloat(document.getElementById('o_deposit').value)||0,
    notes:document.getElementById('o_notes').value.trim()
  };
  try{
    await api('PATCH','/orders/'+id,body);
    closeModal('orderModal');
    toast('Order updated.');
    loadOrders();
  }catch(e){toast('Error: '+e.message);}
}

async function deleteOrder(){
  var id=document.getElementById('orderId').value;
  if(!confirm('Delete this order?'))return;
  try{
    await api('DELETE','/orders/'+id);
    closeModal('orderModal');
    toast('Order deleted.');
    loadOrders();
  }catch(e){toast('Error: '+e.message);}
}

// ── INIT ──────────────────────────────────────────────────────────

function openConvertModal(estimateId, jobName, total){
  document.getElementById('convertEstimateId').value=estimateId;
  document.getElementById('convertEstimateSummary').innerHTML='<strong>'+jobName+'</strong> &middot; $'+parseFloat(total).toFixed(2);
  document.getElementById('conv_due_date').value='';
  document.getElementById('conv_operator').value='';
  document.getElementById('conv_deposit').value=0;
  document.getElementById('conv_payment').value='unpaid';
  document.getElementById('conv_notes').value='';
  openModal('convertModal');
}

async function confirmConvert(){
  var id=document.getElementById('convertEstimateId').value;
  var body={
    due_date:document.getElementById('conv_due_date').value||null,
    operator:document.getElementById('conv_operator').value.trim(),
    deposit_amt:parseFloat(document.getElementById('conv_deposit').value)||0,
    payment_status:document.getElementById('conv_payment').value,
    notes:document.getElementById('conv_notes').value.trim()
  };
  try{
    var order=await api('POST','/orders/convert/'+id,body);
    closeModal('convertModal');
    toast('Order '+order.job_number+' created!');
    showPage('orders',document.querySelectorAll('.nav-tab')[2]);
  }catch(e){toast('Error: '+e.message);}
}

async function createInvFromCurrentOrder(){
  var id=document.getElementById('orderId').value;
  if(!id)return;
  try{
    var inv=await api('POST','/invoices/from-order/'+id,{});
    closeModal('orderModal');
    toast('Invoice '+inv.invoice_number+' created!');
    showPage('invoices',document.querySelectorAll('.nav-tab')[4]);
  }catch(e){toast('Error: '+e.message);}
}

async function openEstimateById(id){
  try{
    var e=await api('GET','/estimates/'+id);
    openEstimateDetail(e);
  }catch(err){toast('Error loading estimate.');}
}

async function openEstimateDetail(e){
  if(typeof e==='string')e=JSON.parse(e);
  showPage('estimator',document.querySelectorAll('.nav-tab')[0]);
  if(e.customer_id){document.getElementById('customerSel').value=e.customer_id;onCustomerChange();}
  var jobName=e.job_name||'';
  if(jobName.match(/^EST-\d{4}-\d{4} — /))jobName=jobName.replace(/^EST-\d{4}-\d{4} — /,'');
  document.getElementById('jobName').value=jobName;
  if(e.job_type){document.getElementById('jobType').value=e.job_type;toggleJobType();}
  var bar=document.getElementById('estActionBar');
  bar.style.display='flex';
  bar.innerHTML='<div style="font-size:12px;font-weight:500;color:#888;padding:0 4px"><span style="font-family:monospace;color:#1a1a18">'+(e.estimate_number||'')+'</span></div>'+
    '<button class="btn btn-primary" onclick="saveEstimate()">Save estimate</button>'+
    '<button class="btn btn-blue" onclick="window.print()">Export PDF</button>'+
    (e.status!=='approved'?'<button class="btn" style="background:#EAF3DE;border-color:#3B6D11;color:#27500A" onclick="openConvertModal('+e.id+',\''+jobName.replace(/'/g,"\\'")+'\','+parseFloat(e.total||0)+')">Convert to order</button>':'<span style="font-size:12px;color:#27500A;padding:0 8px">✓ Converted to order</span>');
  calc();
}

async function viewOrderFromEstimate(estimateId){
  try{
    var orders=await api('GET','/orders');
    var order=orders.find(function(o){return String(o.estimate_id)===String(estimateId);});
    if(!order){toast('No order found for this estimate.');return;}
    showPage('orders',document.querySelectorAll('.nav-tab')[3]);
    setTimeout(function(){openOrderModal(order);},400);
  }catch(e){toast('Error: '+e.message);}
}

// ── INVOICES / AR ────────────────────────────────────────────────
var INV_STATUS={draft:'Draft',sent:'Sent',partial:'Partial',paid:'Paid',overdue:'Overdue',void:'Void'};
var invLineItems=[];
var currentInvId=null;

async function loadARaging(){
  try{
    var d=await api('GET','/invoices/aging');
    document.getElementById('arAging').innerHTML=
      '<div class="stat"><div class="stat-label">Outstanding</div><div class="stat-val">$'+parseFloat(d.total_outstanding||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</div></div>'+
      '<div class="stat"><div class="stat-label">Current</div><div class="stat-val" style="color:#27500A">$'+parseFloat(d.current_amt||0).toFixed(2)+'</div></div>'+
      '<div class="stat"><div class="stat-label">1-30 days</div><div class="stat-val" style="color:#633806">$'+parseFloat(d.days_30||0).toFixed(2)+'</div></div>'+
      '<div class="stat"><div class="stat-label">31-60 days</div><div class="stat-val" style="color:#a32d2d">$'+parseFloat(d.days_60||0).toFixed(2)+'</div></div>'+
      '<div class="stat"><div class="stat-label">60+ days</div><div class="stat-val" style="color:#a32d2d;font-weight:500">$'+(parseFloat(d.days_90||0)+parseFloat(d.days_90_plus||0)).toFixed(2)+'</div></div>';
  }catch(e){console.error(e);}
}

async function loadInvoices(){
  var status=document.getElementById('invStatusFilter').value;
  var overdue=document.getElementById('invOverdueOnly').checked;
  var params=new URLSearchParams();
  if(status)params.set('status',status);
  if(overdue)params.set('overdue','true');
  try{
    var data=await api('GET','/invoices?'+params.toString());
    var tbody=document.getElementById('invTbody');
    if(!data.length){tbody.innerHTML='<tr class="empty-row"><td colspan="10">No invoices found.</td></tr>';return;}
    var today=new Date();today.setHours(0,0,0,0);
    tbody.innerHTML=data.map(function(inv){
      var due=inv.due_date?new Date(inv.due_date):null;
      var isOverdue=due&&due<today&&inv.status!=='paid'&&inv.status!=='void';
      var statusKey=isOverdue&&inv.status!=='paid'?'overdue':inv.status;
      return '<tr>'+
        '<td><strong style="font-family:monospace;font-size:12px">'+inv.invoice_number+'</strong></td>'+
        '<td>'+(inv.company||inv.customer_name||'—')+'</td>'+
        '<td class="muted">'+(inv.job_number||'—')+'</td>'+
        '<td class="muted">'+new Date(inv.issue_date).toLocaleDateString()+'</td>'+
        '<td class="muted" style="color:'+(isOverdue?'#a32d2d':'inherit')+'">'+(due?due.toLocaleDateString():'—')+'</td>'+
        '<td class="muted">$'+parseFloat(inv.total).toFixed(2)+'</td>'+
        '<td class="muted" style="color:#27500A">$'+parseFloat(inv.amount_paid).toFixed(2)+'</td>'+
        '<td class="muted" style="font-weight:500;color:'+(parseFloat(inv.balance_due)>0?'#1a1a18':'#27500A')+'">$'+parseFloat(inv.balance_due).toFixed(2)+'</td>'+
        '<td><span class="badge b-'+statusKey+'">'+INV_STATUS[statusKey]+'</span></td>'+
        '<td><div class="actions">'+
          '<button class="btn btn-sm" onclick="openInvoiceModal('+JSON.stringify(inv).replace(/"/g,"&quot;")+')" >Open</button>'+
          '<button class="btn btn-sm btn-blue" onclick="markReminderSentById('+inv.id+')">Reminder</button>'+
        '</div></td>'+
      '</tr>';
    }).join('');
  }catch(e){toast('Error loading invoices.');}
}

var invCustomers=[];
function openInvoiceModal(inv){
  currentInvId=inv?inv.id:null;
  invLineItems=inv&&inv.line_items?JSON.parse(typeof inv.line_items==='string'?inv.line_items:JSON.stringify(inv.line_items)):[{description:'',quantity:1,unit_price:0,amount:0}];
  document.getElementById('invModalTitle').textContent=inv?'Invoice':'New invoice';
  document.getElementById('invModalNumber').textContent=inv?inv.invoice_number:'';
  document.getElementById('invId').value=inv?inv.id:'';
  // Populate customer dropdown
  var cs=document.getElementById('inv_customer');
  cs.innerHTML='<option value="">— Select —</option>'+customers.map(function(c){return '<option value="'+c.id+'"'+(inv&&inv.customer_id==c.id?' selected':'')+'>'+(c.company||c.first_name+' '+c.last_name)+'</option>';}).join('');
  var rs=document.getElementById('inv_rep');
  rs.innerHTML='<option value="">— None —</option>'+reps.map(function(r){return '<option value="'+r.id+'"'+(inv&&inv.sales_rep_id==r.id?' selected':'')+'>'+ r.name+'</option>';}).join('');
  document.getElementById('inv_issue').value=inv&&inv.issue_date?inv.issue_date.split('T')[0]:new Date().toISOString().split('T')[0];
  document.getElementById('inv_due').value=inv&&inv.due_date?inv.due_date.split('T')[0]:'';
  document.getElementById('inv_status').value=inv?inv.status:'draft';
  document.getElementById('inv_tax').value=inv?inv.tax_pct:0;
  document.getElementById('inv_notes').value=inv?inv.notes||'':'';
  document.getElementById('invPaymentsSection').style.display=inv?'block':'none';
  document.getElementById('voidInvBtn').style.display=inv&&inv.status!=='void'?'inline-block':'none';
  document.getElementById('reminderBtn').style.display=inv&&inv.status==='sent'?'inline-block':'none';
  document.getElementById('pay_date').value=new Date().toISOString().split('T')[0];
  renderLineItems();
  if(inv){loadInvoicePayments(inv.id);}
  openModal('invoiceModal');
}

function renderLineItems(){
  document.getElementById('invLineItems').innerHTML=invLineItems.map(function(li,i){
    return '<div style="display:grid;grid-template-columns:1fr 60px 90px 90px 32px;gap:6px;margin-bottom:6px;align-items:center">'+
      '<input type="text" value="'+li.description+'" placeholder="Description" style="height:30px;font-size:12px;padding:0 8px;border:1px solid #ddd;border-radius:7px" oninput="invLineItems['+i+'].description=this.value">'+
      '<input type="number" value="'+li.quantity+'" min="1" step="1" style="height:30px;font-size:12px;padding:0 6px;border:1px solid #ddd;border-radius:7px;text-align:right" oninput="invLineItems['+i+'].quantity=parseFloat(this.value)||1;invLineItems['+i+'].amount=(invLineItems['+i+'].quantity*invLineItems['+i+'].unit_price);calcInvTotal()">'+
      '<input type="number" value="'+li.unit_price+'" min="0" step="0.01" style="height:30px;font-size:12px;padding:0 6px;border:1px solid #ddd;border-radius:7px;text-align:right" oninput="invLineItems['+i+'].unit_price=parseFloat(this.value)||0;invLineItems['+i+'].amount=(invLineItems['+i+'].quantity*invLineItems['+i+'].unit_price);calcInvTotal()">'+
      '<div style="font-size:12px;font-weight:500;text-align:right;padding-right:4px">$'+(li.quantity*li.unit_price).toFixed(2)+'</div>'+
      '<button class="btn btn-sm btn-danger" style="padding:2px 6px;height:30px" onclick="invLineItems.splice('+i+',1);renderLineItems();calcInvTotal()">×</button>'+
    '</div>';
  }).join('');
  calcInvTotal();
}

function addLineItem(){
  invLineItems.push({description:'',quantity:1,unit_price:0,amount:0});
  renderLineItems();
}

function calcInvTotal(){
  var sub=invLineItems.reduce(function(s,li){return s+(li.quantity*li.unit_price);},0);
  var taxPct=parseFloat(document.getElementById('inv_tax').value)||0;
  var tax=sub*(taxPct/100);
  document.getElementById('invSubtotal').textContent='$'+sub.toFixed(2);
  document.getElementById('invTaxAmt').textContent='$'+tax.toFixed(2);
  document.getElementById('invTotal').textContent='$'+(sub+tax).toFixed(2);
}

async function saveInvoice(){
  var id=document.getElementById('invId').value;
  var sub=invLineItems.reduce(function(s,li){return s+(li.quantity*li.unit_price);},0);
  var taxPct=parseFloat(document.getElementById('inv_tax').value)||0;
  var tax=sub*(taxPct/100);
  var total=sub+tax;
  var body={
    customer_id:document.getElementById('inv_customer').value||null,
    sales_rep_id:document.getElementById('inv_rep').value||null,
    status:document.getElementById('inv_status').value,
    due_date:document.getElementById('inv_due').value||null,
    subtotal:sub,tax_pct:taxPct,tax_amt:tax,total:total,
    line_items:invLineItems,
    notes:document.getElementById('inv_notes').value.trim()
  };
  try{
    if(id) await api('PATCH','/invoices/'+id,body);
    else await api('POST','/invoices',body);
    closeModal('invoiceModal');
    toast(id?'Invoice updated.':'Invoice created.');
    loadInvoices();loadARaging();
  }catch(e){toast('Error: '+e.message);}
}

async function loadInvoicePayments(id){
  try{
    var inv=await api('GET','/invoices/'+id);
    var payList=document.getElementById('invPaymentsList');
    if(!inv.payments||!inv.payments.length){payList.innerHTML='<div style="font-size:12px;color:#aaa;padding:4px 0">No payments yet.</div>';return;}
    payList.innerHTML=inv.payments.map(function(p){
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:0.5px solid #f0efec">'+
        '<div><div style="font-size:13px;font-weight:500">$'+parseFloat(p.amount).toFixed(2)+'</div>'+
        '<div style="font-size:11px;color:#888">'+new Date(p.payment_date).toLocaleDateString()+' &middot; '+p.method+(p.reference?' &middot; #'+p.reference:'')+'</div></div>'+
        '<button class="btn btn-sm btn-danger" onclick="deletePayment('+id+','+p.id+')">×</button>'+
      '</div>';
    }).join('');
    var credList=document.getElementById('invCreditsList');
    if(!inv.credits||!inv.credits.length){credList.innerHTML='<div style="font-size:12px;color:#aaa;padding:4px 0">No credit memos.</div>';return;}
    credList.innerHTML=inv.credits.map(function(c){
      return '<div style="padding:6px 0;border-bottom:0.5px solid #f0efec">'+
        '<div style="font-size:13px;font-weight:500">'+c.memo_number+' — $'+parseFloat(c.amount).toFixed(2)+'</div>'+
        '<div style="font-size:11px;color:#888">'+new Date(c.memo_date).toLocaleDateString()+(c.reason?' &middot; '+c.reason:'')+'</div>'+
      '</div>';
    }).join('');
  }catch(e){console.error(e);}
}

async function recordPayment(){
  var id=document.getElementById('invId').value;
  if(!id){toast('Save invoice first.');return;}
  var amt=parseFloat(document.getElementById('pay_amount').value);
  if(!amt||amt<=0){toast('Enter a valid amount.');return;}
  try{
    await api('POST','/invoices/'+id+'/payments',{
      amount:amt,
      method:document.getElementById('pay_method').value,
      reference:document.getElementById('pay_ref').value.trim(),
      payment_date:document.getElementById('pay_date').value
    });
    toast('Payment recorded.');
    document.getElementById('pay_amount').value='';
    document.getElementById('pay_ref').value='';
    loadInvoicePayments(id);loadInvoices();loadARaging();
  }catch(e){toast('Error: '+e.message);}
}

async function deletePayment(invId,payId){
  if(!confirm('Delete this payment?'))return;
  try{await api('DELETE','/invoices/'+invId+'/payments/'+payId);loadInvoicePayments(invId);loadInvoices();loadARaging();}
  catch(e){toast('Error: '+e.message);}
}

async function issueCreditMemo(){
  var id=document.getElementById('invId').value;
  if(!id){toast('Save invoice first.');return;}
  var amt=parseFloat(document.getElementById('cm_amount').value);
  if(!amt||amt<=0){toast('Enter a valid amount.');return;}
  try{
    await api('POST','/invoices/'+id+'/credits',{
      amount:amt,reason:document.getElementById('cm_reason').value.trim()
    });
    toast('Credit memo issued.');
    document.getElementById('cm_amount').value='';document.getElementById('cm_reason').value='';
    loadInvoicePayments(id);
  }catch(e){toast('Error: '+e.message);}
}

async function markReminderSent(){
  var id=document.getElementById('invId').value;
  if(!id)return;
  await markReminderSentById(id);
  closeModal('invoiceModal');
}

async function markReminderSentById(id){
  try{await api('POST','/invoices/'+id+'/reminder');toast('Reminder marked as sent.');loadInvoices();}
  catch(e){toast('Error: '+e.message);}
}

async function voidInvoice(){
  var id=document.getElementById('invId').value;
  if(!id||!confirm('Void this invoice?'))return;
  try{await api('DELETE','/invoices/'+id);closeModal('invoiceModal');toast('Invoice voided.');loadInvoices();loadARaging();}
  catch(e){toast('Error: '+e.message);}
}

function openQBExport(){
  document.getElementById('qb_from').value='';
  document.getElementById('qb_to').value='';
  openModal('qbModal');
}

async function downloadQBExport(){
  var from=document.getElementById('qb_from').value;
  var to=document.getElementById('qb_to').value;
  var params=new URLSearchParams();
  if(from)params.set('from_date',from);
  if(to)params.set('to_date',to);
  try{
    var response=await fetch('/api/invoices/export/quickbooks?'+params.toString());
    if(!response.ok)throw new Error('Export failed');
    var blob=await response.blob();
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');
    a.href=url;a.download='victor-qb-export-'+new Date().toISOString().split('T')[0]+'.iif';
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    URL.revokeObjectURL(url);
    closeModal('qbModal');
    toast('QuickBooks IIF file downloaded!');
  }catch(e){toast('Error: '+e.message);}
}

// Create invoice from order button (called from Orders page)
async function createInvoiceFromOrder(orderId, jobName, total){
  try{
    var inv=await api('POST','/invoices/from-order/'+orderId,{});
    toast('Invoice '+inv.invoice_number+' created!');
    showPage('invoices',document.querySelectorAll('.nav-tab')[4]);
  }catch(e){toast('Error: '+e.message);}
}

// ── CSV IMPORT ────────────────────────────────────────────────────
var importRows=[];
var importPreviewed=false;

function resetImportModal(){
  importRows=[];importPreviewed=false;
  document.getElementById('importStep1').style.display='block';
  document.getElementById('importStep2').style.display='none';
  document.getElementById('csvPasteArea').value='';
  document.getElementById('csvFileInput').value='';
  document.getElementById('importActionBtn').textContent='Preview import';
  document.getElementById('importProgress').textContent='';
  document.getElementById('importErrors').textContent='';
  closeModal('importModal');
}

function handleCSVFile(input){
  var file=input.files[0];if(!file)return;
  var reader=new FileReader();
  reader.onload=function(e){document.getElementById('csvPasteArea').value=e.target.result;};
  reader.readAsText(file);
}

function parseCSV(text){
  var lines=text.trim().split('\n').filter(function(l){return l.trim();});
  if(lines.length<2)return{error:'CSV must have a header row and at least one data row.'};
  var headers=lines[0].split(',').map(function(h){return h.trim().replace(/^"|"$/g,'').toLowerCase();});
  var hasCompany=headers.some(function(h){return h.replace(/\s+/g,'')===('company');});
  if(!hasCompany)return{error:'CSV must have a "Company" column.'};
  var rows=[];
  for(var i=1;i<lines.length;i++){
    // Handle quoted fields with commas inside
    var vals=[],cur='',inQ=false;
    for(var c=0;c<lines[i].length;c++){
      var ch=lines[i][c];
      if(ch==='"'){inQ=!inQ;}
      else if(ch===','&&!inQ){vals.push(cur.trim());cur='';}
      else{cur+=ch;}
    }
    vals.push(cur.trim());
    var row={};
    headers.forEach(function(h,idx){row[h.replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'')]=vals[idx]||'';});
    // Also store with original header keys for flexible lookup
    headers.forEach(function(h,idx){row[h]=(vals[idx]||'').trim();});
    if(row['company']||row['company_'])rows.push(row);
  }
  return{headers:headers,rows:rows};
}

function runImport(){
  if(!importPreviewed){
    var text=document.getElementById('csvPasteArea').value.trim();
    if(!text){toast('Paste CSV text or upload a file first.');return;}
    var result=parseCSV(text);
    if(result.error){toast(result.error);return;}
    importRows=result.rows;importPreviewed=true;
    document.getElementById('importStep1').style.display='none';
    document.getElementById('importStep2').style.display='block';
    document.getElementById('importPreviewTitle').textContent='Preview — '+importRows.length+' customer'+(importRows.length!==1?'s':'')+' to import';
    var SHOW=['company','first_name','last_name','email','phone','city','state','payment_terms'];
    var cols=SHOW.filter(function(c){return result.headers.includes(c);});
    document.getElementById('importPreviewHead').innerHTML=cols.map(function(c){return '<th style="padding:6px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#aaa;text-align:left">'+c.replace(/_/g,' ')+'</th>';}).join('');
    document.getElementById('importPreviewBody').innerHTML=importRows.slice(0,10).map(function(r){
      return '<tr style="border-top:1px solid #f0efec">'+cols.map(function(c){return '<td style="padding:5px 10px;font-size:12px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(r[c]||'—')+'</td>';}).join('')+'</tr>';
    }).join('');
    if(importRows.length>10)document.getElementById('importErrors').textContent='Showing first 10 of '+importRows.length+' rows.';
    document.getElementById('importActionBtn').textContent='Import '+importRows.length+' customers';
  } else {
    doImport();
  }
}

async function doImport(){
  var repId=document.getElementById('importRepSel').value||null;
  var tierId=document.getElementById('importTierSel').value||null;
  var btn=document.getElementById('importActionBtn');
  var prog=document.getElementById('importProgress');
  btn.disabled=true;
  var success=0,errors=0;
  for(var i=0;i<importRows.length;i++){
    var r=importRows[i];
    prog.textContent='Importing '+(i+1)+' of '+importRows.length+'...';
    try{
      // Handle both standard column names and your CSV column names
      var company=r['company']||r['company_']||'';
      var addr=r['address_line1']||r['address']||'';
      var zip=r['zip']||r['zip_code']||r['zipcode']||'';
      var phone=r['phone']||r['phone_number']||r['phonenumber']||'';
      // Contact field — split into first/last if possible
      var contact=r.contact||r['contact']||'';
      var fn=r.first_name||'';
      var ln=r.last_name||'';
      if(!fn&&!ln&&contact){
        var parts=contact.trim().split(' ');
        fn=parts[0]||'';
        ln=parts.slice(1).join(' ')||'.';
      }
      if(!fn) fn=company.split(' ')[0]||'';
      if(!ln) ln='.';
      await api('POST','/customers',{
        company:company,first_name:fn,last_name:ln,
        email:r.email||'',phone:phone,mobile:r.mobile||'',
        address_line1:addr,address_line2:r.address_line2||r.address2||'',
        city:r.city||'',state:r.state||'',zip:zip,
        payment_terms:r.payment_terms||'',notes:r.notes||'',
        sales_rep_id:repId,pricing_tier_id:tierId,status:'active'
      });
      success++;
    }catch(e){errors++;}
  }
  btn.disabled=false;prog.textContent='';
  toast(success+' customers imported!'+(errors>0?' ('+errors+' errors)':''));
  resetImportModal();loadCustomers();loadDropdowns();
}

// ── IMPOSITION CALCULATOR (inline) ───────────────────────────────
var impResult={subsCost:0,sheetsNeeded:0,outsPerSheet:0};

function onMediaChange(){
  var sel=document.getElementById('mediaSel');
  if(!sel)return;
  var opt=sel.options[sel.selectedIndex];
  var w=opt.getAttribute('data-width');
  var cost=opt.getAttribute('data-cost');
  if(w&&document.getElementById('imp_sw')) document.getElementById('imp_sw').value=w;
  if(cost&&document.getElementById('imp_costSqft')) document.getElementById('imp_costSqft').value=cost;
  calcImposition();
  calc();
}

function calcImposition(){
  var sw=parseFloat(document.getElementById('imp_sw').value)||54;
  var sh=parseFloat(document.getElementById('imp_sh').value)||1200;
  var fw=parseFloat(document.getElementById('imp_fw').value)||24;
  var fh=parseFloat(document.getElementById('imp_fh').value)||36;
  var bleed=parseFloat(document.getElementById('imp_bleed').value)||0.125;
  var gripper=parseFloat(document.getElementById('imp_gripper').value)||0.5;
  var gutter=parseFloat(document.getElementById('imp_gutter').value)||0.125;
  var rolls=parseInt(document.getElementById('imp_rolls').value)||1;
  var qty=parseInt(document.getElementById('wfQty').value)||1;
  var costSqft=parseFloat(document.getElementById('imp_costSqft').value)||0;

  var uw=fw+(bleed*2); var uh=fh+(bleed*2);
  var usableH=sh-gripper;
  var across=Math.max(1,Math.floor((sw+gutter)/(uw+gutter)));
  var around=Math.max(1,Math.floor((usableH+gutter)/(uh+gutter)));
  var outsPerSheet=across*around*rolls;
  var sheetsNeeded=Math.ceil(qty/outsPerSheet);
  var totalPieces=sheetsNeeded*outsPerSheet;
  var usedW=across*(uw+gutter)-gutter;
  var usedH=around*(uh+gutter)-gutter+gripper;
  var wastePct=Math.max(0,Math.min(99,((sw*sh)-(usedW*usedH))/(sw*sh)*100));
  var totalSqft=(sw/12)*(sh/12)*sheetsNeeded;
  var subsCost=totalSqft*costSqft;

  impResult={sw,sh,fw,fh,bleed,gripper,gutter,across,around,outsPerSheet,sheetsNeeded,totalPieces,wastePct,subsCost,totalSqft,qty,costSqft,uw,uh};

  // Update inline results
  var res=document.getElementById('impResults');
  if(res){
    res.style.display='block';
    document.getElementById('imp_r_outs').textContent=outsPerSheet;
    document.getElementById('imp_r_grid').textContent=across+' across × '+around+' around';
    document.getElementById('imp_r_sheets').textContent=sheetsNeeded.toLocaleString();
    document.getElementById('imp_r_waste').textContent=wastePct.toFixed(1)+'%';
    document.getElementById('imp_r_sqft').textContent=totalSqft.toFixed(1)+' sq ft';
    document.getElementById('imp_r_cost').textContent='$'+subsCost.toFixed(2);
  }
}

function openImpositionPreview(){
  calcImposition();
  var r=impResult;
  // Update modal stats
  document.getElementById('imp_modal_outs').textContent=r.outsPerSheet;
  document.getElementById('imp_modal_grid').textContent=r.across+' across × '+r.around+' around';
  document.getElementById('imp_modal_sheets').textContent=r.sheetsNeeded.toLocaleString();
  document.getElementById('imp_modal_pcs').textContent=r.totalPieces.toLocaleString()+' total pcs';
  document.getElementById('imp_modal_cost').textContent='$'+r.subsCost.toFixed(2);
  document.getElementById('imp_modal_waste').textContent=r.wastePct.toFixed(1)+'% waste';
  openModal('impositionModal');
  setTimeout(function(){drawImpPreview(r);},100);
}

function drawImpPreview(r){
  var canvas=document.getElementById('impCanvas');
  if(!canvas)return;
  var cw=canvas.offsetWidth||620;
  var aspect=Math.min(r.sh/r.sw,5);
  var ch=Math.min(Math.round(cw*aspect/3),300);
  canvas.width=cw; canvas.height=ch;
  var ctx=canvas.getContext('2d');
  var scale=Math.min((cw-20)/r.sw,(ch-20)/r.sh);
  var ox=(cw-r.sw*scale)/2, oy=8;
  ctx.fillStyle='#f5f5f3'; ctx.fillRect(ox,oy,r.sw*scale,r.sh*scale);
  ctx.strokeStyle='#aaa'; ctx.lineWidth=0.5; ctx.strokeRect(ox,oy,r.sw*scale,r.sh*scale);
  ctx.fillStyle='#FAEEDA'; ctx.fillRect(ox,oy,r.sw*scale,r.gripper*scale);
  if(r.gripper*scale>8){ctx.fillStyle='#633806';ctx.font='9px sans-serif';ctx.fillText('gripper',ox+3,oy+r.gripper*scale-2);}
  var maxDraw=Math.min(r.across*r.around,200); var drawn=0;
  outer:for(var row=0;row<r.around;row++){
    for(var col=0;col<r.across;col++){
      if(drawn>=maxDraw)break outer;
      var px=ox+col*(r.uw+r.gutter)*scale;
      var py=oy+r.gripper*scale+row*(r.uh+r.gutter)*scale;
      ctx.fillStyle='#EAF3DE'; ctx.fillRect(px,py,r.uw*scale,r.uh*scale);
      ctx.fillStyle='#B5D4F4'; ctx.fillRect(px+r.bleed*scale,py+r.bleed*scale,r.fw*scale,r.fh*scale);
      ctx.strokeStyle='#378ADD'; ctx.lineWidth=0.5; ctx.setLineDash([]); ctx.strokeRect(px+r.bleed*scale,py+r.bleed*scale,r.fw*scale,r.fh*scale);
      ctx.strokeStyle='#639922'; ctx.setLineDash([2,2]); ctx.strokeRect(px,py,r.uw*scale,r.uh*scale); ctx.setLineDash([]);
      drawn++;
    }
  }
  if(r.across>0&&r.around>0){
    ctx.fillStyle='#0C447C'; ctx.font='bold 9px sans-serif';
    ctx.fillText(r.fw+'" × '+r.fh+'"',ox+r.bleed*scale+2,oy+r.gripper*scale+r.bleed*scale+10);
  }
}

// ── INIT ──────────────────────────────────────────────────────────
checkHealth();
loadDropdowns();
buildStockSelects();
calc();
renderPPList();
