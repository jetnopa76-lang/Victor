// Victor Admin Panel — no auth
var _ms=null,_mc=null,_nuf=false;

function _e(s){return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
async function _a(m,p,b){var o={method:m,headers:{'Content-Type':'application/json'}};if(b)o.body=JSON.stringify(b);var r=await fetch(p,o);if(m!=='GET'&&/\/(cost-centers|materials)/.test(p)&&typeof window.invalidateComponentCaches==='function')window.invalidateComponentCaches();return r.json();}

// Inject styles
(function(){
  if(document.getElementById('_admStyles'))return;
  var s=document.createElement('style');s.id='_admStyles';
  s.textContent='#_adm{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9990;display:none;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto}#_admW{background:#f5f4f2;border-radius:20px;width:100%;max-width:960px;margin:auto;overflow:hidden;min-height:300px}._admTop{background:#1a1a18;color:#fff;padding:12px 18px;display:flex;align-items:center;justify-content:space-between}._admTop h2{font-size:15px;font-weight:500;margin:0}._admX{background:none;border:none;color:#888;font-size:20px;cursor:pointer}._admHome{padding:20px;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}._card{background:#fff;border-radius:14px;padding:18px 14px;cursor:pointer;border:1px solid #e8e6e2;text-align:center;transition:all .15s}._card:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(0,0,0,.1);border-color:#1a1a18}._ci{font-size:26px;margin-bottom:8px}._cl{font-size:13px;font-weight:500;color:#1a1a18}._cd{font-size:11px;color:#888;margin-top:3px}._sec{padding:20px}._bc{display:flex;align-items:center;gap:8px;margin-bottom:18px;font-size:13px}._back{background:#fff;border:1px solid #e0ded8;border-radius:8px;padding:5px 12px;cursor:pointer;font-size:12px;font-weight:500}._lc{background:#fff;border-radius:12px;border:1px solid #e8e6e2;overflow:hidden}._li{display:flex;align-items:center;padding:11px 14px;border-bottom:1px solid #f0efec;gap:10px}._li:last-child{border-bottom:none}._ln{flex:1;font-size:13px;font-weight:500}._ls{font-size:11px;color:#888;margin-top:2px}._addrow{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}._addrow input{flex:1;min-width:100px;height:36px;padding:0 10px;border:1px solid #e0ded8;border-radius:8px;font-size:13px;outline:none}._form{background:#fff;border-radius:12px;border:1px solid #e8e6e2;padding:14px;margin-bottom:14px}._form h4{font-size:14px;font-weight:500;margin:0 0 12px}._fg{display:grid;grid-template-columns:1fr 1fr;gap:10px}._ff{display:flex;flex-direction:column;gap:3px}._ff label{font-size:10px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.04em}._ff input,._ff select{height:34px;padding:0 10px;border:1px solid #e0ded8;border-radius:8px;font-size:13px;outline:none}._fa{display:flex;gap:8px;margin-top:12px}._btn{background:#1a1a18;color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:500;cursor:pointer}._btnG{background:none;border:1px solid #e0ded8;border-radius:8px;padding:7px 14px;font-size:13px;cursor:pointer}._btnD{background:none;border:1px solid #f0c8c8;border-radius:8px;padding:5px 10px;font-size:12px;cursor:pointer;color:#c0392b}._ml{display:grid;grid-template-columns:180px 1fr;gap:14px}._ml3{display:grid;grid-template-columns:160px 220px 1fr;gap:12px}._mlh{font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:.06em;font-weight:500;padding:0 4px 6px;display:block}._mc{padding:9px 10px;border-radius:10px;cursor:pointer;font-size:13px;color:#666;border:1px solid transparent;display:flex;align-items:center;justify-content:space-between;background:#fff;margin-bottom:3px}._mc:hover{background:#f5f4f2}._mca{background:#1a1a18!important;color:#fff!important}._mr{display:grid;grid-template-columns:1fr 90px 80px 70px 28px;gap:5px;align-items:center;padding:6px 10px;border-bottom:1px solid #f5f5f3}._mr input{height:28px;padding:0 6px;border:1px solid #e0ded8;border-radius:6px;font-size:12px;width:100%;outline:none}';
  document.head.appendChild(s);
})();

// Inject modal HTML
(function(){
  if(document.getElementById('_adm'))return;
  document.body.insertAdjacentHTML('beforeend','<div id="_adm"><div id="_admW"><div class="_admTop"><h2 id="_admTitle">Admin settings</h2><button class="_admX" onclick="document.getElementById(\'_adm\').style.display=\'none\'">&times;</button></div><div id="_admC"></div></div></div>');
})();

// Inject Admin button into nav
function _injectAdmBtn(){
  if(document.getElementById('_admNavBtn'))return;
  var nav=document.querySelector('nav');
  if(!nav)return;
  var btn=document.createElement('button');
  btn.id='_admNavBtn';
  btn.textContent='⚙ Admin';
  btn.style.cssText='background:none;border:1px solid #e0ded8;color:#1a1a18;border-radius:8px;padding:4px 10px;font-size:12px;cursor:pointer;font-weight:500;margin-left:8px';
  btn.onclick=function(){openAdmin();};
  // Admin panel is restricted to admin-role users.
  if(window.currentUser && window.currentUser.role!=='admin') btn.style.display='none';
  var st=nav.querySelector('.nav-status');
  if(st)nav.insertBefore(btn,st);else nav.appendChild(btn);
  // Remove old pricing library button
  setTimeout(function(){var pl=document.getElementById('pricingLibBtn');if(pl)pl.remove();},500);
}

if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',_injectAdmBtn);}
else{_injectAdmBtn();setTimeout(_injectAdmBtn,500);}

// Open admin (admin-role only)
function openAdmin(){
  if(window.currentUser && window.currentUser.role!=='admin'){ if(typeof toast==='function')toast('Admin access only'); return; }
  _admHome();
  document.getElementById('_adm').style.display='flex';
}
window.openAdmin=openAdmin;

function _admHome(){
  _ms=null;
  document.getElementById('_admTitle').textContent='Admin settings';
  var cards=[
    {id:'users',       i:'👥',l:'Users',          d:'Manage users & PINs'},
    {id:'materials',   i:'📦',l:'Materials',       d:'Paper, media, substrates'},
    {id:'costcenters', i:'⚙️',l:'Cost Centers',    d:'Pre/Post-press process rates'},
    {id:'stages',      i:'📋',l:'Prod. Stages',    d:'Kanban columns'},
    {id:'tiers',       i:'🏷',l:'Pricing Tiers',   d:'Customer discounts'},
    {id:'reps',        i:'👤',l:'Sales Reps',      d:'Commission rates'},
    {id:'business',    i:'🏢',l:'Business',        d:'Company info & defaults'},
  ];
  document.getElementById('_admC').innerHTML='<div class="_admHome">'+cards.map(function(c){return '<div class="_card" onclick="_goS(\''+c.id+'\')"><div class="_ci">'+c.i+'</div><div class="_cl">'+c.l+'</div><div class="_cd">'+c.d+'</div></div>';}).join('')+'</div>';
}

async function _goS(s){
  _ms=s;
  document.getElementById('_admC').innerHTML='<div style="padding:40px;text-align:center;color:#aaa">Loading...</div>';
  if(s==='users')await _rUsers();
  else if(s==='materials')await _rMats();
  else if(s==='costcenters')await _rCC();
  else if(s==='stages')await _rStages();
  else if(s==='tiers')await _rTiers();
  else if(s==='reps')await _rReps();
  else if(s==='business')_rBiz();
}

function _bc(l){return '<div class="_bc"><button class="_back" onclick="_admHome()">← Back</button><span style="color:#aaa">/</span><span style="font-weight:500">'+l+'</span></div>';}

// USERS
var _eu=null; // id of user being edited
function _roleOpts(sel){return ['admin','sales','production','accounting'].map(function(r){return '<option value="'+r+'"'+(sel===r?' selected':'')+'>'+r.charAt(0).toUpperCase()+r.slice(1)+'</option>';}).join('');}
async function _rUsers(){
  document.getElementById('_admTitle').textContent='Users';
  var u=await _a('GET','/api/users');
  var rb={admin:'background:#1a1a18;color:#fff',sales:'background:#EAF3DE;color:#27500A',production:'background:#E6F1FB;color:#0C447C',accounting:'background:#FFF3DC;color:#7A4A00'};
  var eu=_eu?u.find(function(x){return x.id===_eu;}):null;
  var editForm=eu?'<div class="_form"><h4>Edit user</h4><div class="_fg"><div class="_ff"><label>Name</label><input id="_eu_n" type="text" value="'+_e(eu.name)+'"></div><div class="_ff"><label>Role</label><select id="_eu_r">'+_roleOpts(eu.role)+'</select></div><div class="_ff" style="grid-column:span 2"><label style="display:flex;align-items:center;gap:6px;font-size:13px"><input type="checkbox" id="_eu_a"'+(eu.active?' checked':'')+' style="width:auto"> Active</label></div></div><div class="_fa"><button class="_btn" onclick="_uUser()">Save</button><button class="_btnG" onclick="_rPin('+eu.id+',\''+_e(eu.name)+'\')">Reset PIN</button><button class="_btnG" onclick="_eu=null;_rUsers()">Cancel</button></div></div>':'';
  var form=(_nuf&&!eu)?'<div class="_form"><h4>New user</h4><div class="_fg"><div class="_ff"><label>Name</label><input id="_nu_n" type="text"></div><div class="_ff"><label>PIN</label><input id="_nu_p" type="password" maxlength="8"></div><div class="_ff" style="grid-column:span 2"><label>Role</label><select id="_nu_r">'+_roleOpts('sales')+'</select></div></div><div class="_fa"><button class="_btn" onclick="_cUser()">Create</button><button class="_btnG" onclick="_nuf=false;_rUsers()">Cancel</button></div></div>':'';
  document.getElementById('_admC').innerHTML='<div class="_sec">'+_bc('Users')+editForm+form+'<div class="_lc">'+u.map(function(x){return '<div class="_li"><div style="flex:1"><div class="_ln">'+_e(x.name)+(x.active===false?' <span style="font-size:10px;color:#a32d2d">(inactive)</span>':'')+'</div><div class="_ls"><span style="display:inline-block;font-size:11px;padding:1px 7px;border-radius:20px;font-weight:500;'+(rb[x.role]||rb.admin)+'">'+x.role+'</span></div></div><button class="_btnG" style="font-size:12px;margin-right:6px" onclick="_eUser('+x.id+')">Edit</button>'+(x.id!==1?'<button class="_btnD" onclick="_dUser('+x.id+')">Del</button>':'')+'</div>';}).join('')+'</div>'+(!_nuf&&!eu?'<div class="_addrow"><button class="_btn" onclick="_nuf=true;_rUsers()">+ Add user</button></div>':'')+'</div>';
}
function _eUser(id){_eu=id;_nuf=false;_rUsers();}
async function _uUser(){var b={name:document.getElementById('_eu_n').value.trim(),role:document.getElementById('_eu_r').value,active:document.getElementById('_eu_a').checked};if(!b.name){alert('Name required');return;}await _a('PUT','/api/users/'+_eu,b);_eu=null;if(typeof toast==='function')toast('User updated');_rUsers();}
async function _cUser(){var n=document.getElementById('_nu_n').value.trim(),p=document.getElementById('_nu_p').value,r=document.getElementById('_nu_r').value;if(!n||!p){alert('Name and PIN required');return;}await _a('POST','/api/users',{name:n,role:r,pin:p});_nuf=false;_rUsers();}
function _rPin(id,name){var p=prompt('New PIN for '+name+':');if(!p)return;_a('PUT','/api/users/'+id,{pin:p}).then(function(){if(typeof toast==='function')toast('PIN updated!');});}
async function _dUser(id){if(!confirm('Delete?'))return;await _a('DELETE','/api/users/'+id);if(_eu===id)_eu=null;_rUsers();}

// MATERIALS
async function _rMats(){
  document.getElementById('_admTitle').textContent='Materials';
  var cats=await _a('GET','/api/materials/categories');
  if(!_mc&&cats.length)_mc=cats[0].id;
  var sel=cats.find(function(c){return c.id==_mc;});
  var items=_mc?await _a('GET','/api/materials?category_id='+_mc):[];
  var ML={per_sqft:'per sq ft',per_sheet:'per sheet',per_unit:'per unit',per_click:'per click',per_lb:'per lb'};
  var cH=cats.map(function(c){var a=c.id==_mc;return '<div class="_mc'+(a?' _mca':'')+'" onclick="_sMC('+c.id+')"><span>'+_e(c.name)+'</span><button style="background:none;border:none;cursor:pointer;font-size:14px;color:'+(a?'#aaa':'#ddd')+';padding:0" onclick="event.stopPropagation();_dMC('+c.id+')">×</button></div>';}).join('')+'<button onclick="_aMC()" style="width:100%;margin-top:6px;padding:8px;border:2px dashed #ddd;border-radius:8px;background:none;font-size:12px;color:#378ADD;cursor:pointer">+ Add category</button>';
  var iH='<div style="color:#aaa;font-size:13px;padding:10px 0">Select a category</div>';
  if(sel){
    iH='<div style="margin-bottom:12px"><div style="font-size:15px;font-weight:600">'+_e(sel.name)+'</div><div style="font-size:12px;color:#888;margin-top:2px">Priced <select onchange="_uMC('+sel.id+',this.value)" style="font-size:12px;border:1px solid #ddd;border-radius:5px;padding:1px 5px">'+Object.keys(ML).map(function(m){return '<option value="'+m+'"'+(m===sel.pricing_method?' selected':'')+'>'+ML[m]+'</option>';}).join('')+'</select></div></div>'+
    (items.length?'<div class="_lc" style="margin-bottom:8px"><div style="display:grid;grid-template-columns:1fr 90px 80px 70px 28px;gap:5px;padding:6px 10px;border-bottom:1px solid #e8e6e2"><span style="font-size:10px;color:#aaa;text-transform:uppercase">Name</span><span style="font-size:10px;color:#aaa;text-transform:uppercase">SKU</span><span style="font-size:10px;color:#aaa;text-transform:uppercase">Cost</span><span style="font-size:10px;color:#aaa;text-transform:uppercase">Unit</span><span></span></div>'+items.map(function(x){return '<div class="_mr"><input value="'+_e(x.name)+'" onchange="_uM('+x.id+',\'name\',this.value)"><input value="'+_e(x.sku||'')+'" placeholder="SKU" onchange="_uM('+x.id+',\'sku\',this.value)"><input type="number" value="'+parseFloat(x.cost).toFixed(4)+'" step="0.0001" style="text-align:right" onchange="_uM('+x.id+',\'cost\',this.value)"><input value="'+_e(x.unit||'')+'" placeholder="unit" onchange="_uM('+x.id+',\'unit\',this.value)"><button style="background:none;border:none;cursor:pointer;color:#ccc;font-size:15px;padding:0" onclick="_dM('+x.id+')">×</button></div>';}).join('')+'</div>':'<div style="color:#aaa;font-size:13px;padding:10px 0">No items yet.</div>')+
    '<button onclick="_aM('+_mc+')" style="font-size:13px;color:#378ADD;background:none;border:none;cursor:pointer;padding:6px 0;font-weight:500">+ Add '+_e(sel.name)+' item</button>';
  }
  document.getElementById('_admC').innerHTML='<div class="_sec">'+_bc('Materials')+'<div class="_ml"><div>'+cH+'</div><div>'+iH+'</div></div></div>';
}
async function _sMC(id){_mc=id;_rMats();}
async function _aMC(){var n=prompt('Category name:');if(!n)return;var mm={'1':'per_sqft','2':'per_sheet','3':'per_unit','4':'per_click','5':'per_lb'};var k=prompt('Pricing:\n1=per sq ft\n2=per sheet\n3=per unit\n4=per click\n5=per lb','1');var c=await _a('POST','/api/materials/categories',{name:n,pricing_method:mm[k]||'per_sqft'});_mc=c.id;_rMats();}
async function _dMC(id){if(!confirm('Delete category?'))return;await _a('DELETE','/api/materials/categories/'+id);_mc=null;_rMats();}
async function _uMC(id,m){await _a('PUT','/api/materials/categories/'+id,{pricing_method:m});_rMats();}
async function _aM(cid){await _a('POST','/api/materials',{category_id:cid,name:'New item',cost:0,unit:''});_rMats();}
async function _uM(id,f,v){var b={};b[f]=f==='cost'?parseFloat(v)||0:v;await _a('PUT','/api/materials/'+id,b);}
async function _dM(id){if(!confirm('Delete?'))return;await _a('DELETE','/api/materials/'+id);_rMats();}

// COST CENTERS
var _cck='prepress'; // current department (kind)
var _cccid=null;     // current cost center id
var _CC_KINDS=[
  {k:'prepress',         l:'Prepress'},
  {k:'press',            l:'Press'},
  {k:'digital',          l:'Digital Press'},
  {k:'postpress',        l:'Postpress'},
  {k:'bindery',          l:'Bindery'},
  {k:'outside_services', l:'Outside Services'}
];
async function _rCC(){
  document.getElementById('_admTitle').textContent='Cost Centers';
  // Departments are DB-backed so they can be added/removed by the user.
  var depts=await _a('GET','/api/cost-centers/departments');
  if(Array.isArray(depts)&&depts.length){ _CC_KINDS=depts.map(function(d){return {k:d.kind,l:d.label,model:d.model||'speed',id:d.id};}); }
  if(!_CC_KINDS.some(function(d){return d.k===_cck;})) _cck=_CC_KINDS[0]?_CC_KINDS[0].k:'prepress';
  var deptModel=(_CC_KINDS.find(function(d){return d.k===_cck;})||{}).model||'speed';
  var curDept=_CC_KINDS.find(function(d){return d.k===_cck;})||{};
  var allCenters=await _a('GET','/api/cost-centers');
  var centers=allCenters.filter(function(c){return c.kind===_cck;});
  // If current cost center isn't in the selected department, reset
  if(_cccid && !centers.some(function(c){return c.id==_cccid;})) _cccid=null;
  if(!_cccid&&centers.length)_cccid=centers[0].id;
  var sel=centers.find(function(c){return c.id==_cccid;});
  var items=_cccid?await _a('GET','/api/cost-centers/items?cost_center_id='+_cccid):[];

  // Column 1: Departments
  var depHTML='<span class="_mlh">Department</span>'+_CC_KINDS.map(function(d){var a=d.k===_cck;return '<div class="_mc'+(a?' _mca':'')+'" onclick="_sCCK(\''+d.k+'\')"><span>'+_e(d.l)+'</span>'+(a&&d.id?'<button style="background:none;border:none;cursor:pointer;font-size:13px;color:#aaa;padding:0" onclick="event.stopPropagation();_dCCDept('+d.id+',\''+_e(d.l).replace(/'/g,"")+'\')">×</button>':'')+'</div>';}).join('')+'<button onclick="_aCCDept()" style="width:100%;margin-top:6px;padding:8px;border:2px dashed #ddd;border-radius:8px;background:none;font-size:12px;color:#378ADD;cursor:pointer">+ Add department</button>';

  // Column 2: Cost Centers
  var ccHTML='<span class="_mlh">Cost Center</span>';
  if(centers.length){
    ccHTML+=centers.map(function(c){var a=c.id==_cccid;return '<div class="_mc'+(a?' _mca':'')+'" onclick="_sCC('+c.id+')"><span><span style="font-family:monospace;color:'+(a?'#ddd':'#aaa')+';font-size:11px;margin-right:6px">'+_e(c.code)+'</span>'+_e(c.name)+'</span><button style="background:none;border:none;cursor:pointer;font-size:14px;color:'+(a?'#aaa':'#ddd')+';padding:0" onclick="event.stopPropagation();_dCC('+c.id+')">×</button></div>';}).join('');
  }else{
    ccHTML+='<div style="color:#aaa;font-size:12px;padding:8px 4px">No cost centers yet.</div>';
  }
  ccHTML+='<button onclick="_aCC()" style="width:100%;margin-top:6px;padding:8px;border:2px dashed #ddd;border-radius:8px;background:none;font-size:12px;color:#378ADD;cursor:pointer">+ Add cost center</button>';

  // Column 3: Processes (items)
  var procHTML='<span class="_mlh">Processes</span>';
  if(!sel){
    procHTML+='<div style="color:#aaa;font-size:13px;padding:10px 4px">Select a cost center on the left.</div>';
  } else {
    var _ll='font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:.03em;margin-bottom:2px';
    var deptOpts=_CC_KINDS.map(function(d){return '<option value="'+_e(d.k)+'"'+(d.k===_cck?' selected':'')+'>'+_e(d.l)+'</option>';}).join('');
    var hdr='<div style="margin-bottom:12px;padding:10px;background:#f9f8f6;border:1px solid #ececec;border-radius:8px">'
      +'<div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:8px">'
        +'<div><div style="'+_ll+'">Code</div><input value="'+_e(sel.code||'')+'" onchange="_uCC('+sel.id+',\'code\',this.value)" style="width:82px;font-family:monospace"></div>'
        +'<div style="flex:1"><div style="'+_ll+'">Cost center name</div><input value="'+_e(sel.name)+'" onchange="_uCC('+sel.id+',\'name\',this.value)" style="width:100%"></div>'
      +'</div>'
      +'<div style="display:flex;gap:10px;align-items:flex-end">'
        +'<div><div style="'+_ll+'">Department</div><select onchange="_uCC('+sel.id+',\'kind\',this.value)">'+deptOpts+'</select></div>'
        +'<div style="font-size:11px;color:#888;padding-bottom:6px">'+items.length+' process(es)</div>'
      +'</div>'
    +'</div>';
    procHTML+=hdr;
    var th='<span style="font-size:10px;color:#aaa;text-transform:uppercase">';
    if(items.length){
      if(deptModel==='prepress'){
        procHTML+='<div class="_lc" style="margin-bottom:8px"><div style="display:grid;grid-template-columns:60px 1fr 60px 60px 60px 60px 60px 24px;gap:5px;padding:6px 10px;border-bottom:1px solid #e8e6e2">'+th+'Code</span>'+th+'Name</span>'+th+'Mins/U</span>'+th+'AI $/h</span>'+th+'DM $/h</span>'+th+'Unit $</span>'+th+'Min $</span><span></span></div>'+items.map(function(x){return '<div class="_mr" style="grid-template-columns:60px 1fr 60px 60px 60px 60px 60px 24px"><input value="'+_e(x.code||'')+'" onchange="_uCCI('+x.id+',\'code\',this.value)"><input value="'+_e(x.name)+'" onchange="_uCCI('+x.id+',\'name\',this.value)"><input type="number" value="'+(parseFloat(x.mins_per_unit)||0).toFixed(2)+'" step="0.1" onchange="_uCCI('+x.id+',\'mins_per_unit\',this.value)"><input type="number" value="'+(parseFloat(x.ai_rate)||0).toFixed(2)+'" step="0.5" onchange="_uCCI('+x.id+',\'ai_rate\',this.value)"><input type="number" value="'+(parseFloat(x.dm_rate)||0).toFixed(2)+'" step="0.5" onchange="_uCCI('+x.id+',\'dm_rate\',this.value)"><input type="number" value="'+(parseFloat(x.unit_cost)||0).toFixed(2)+'" step="0.01" onchange="_uCCI('+x.id+',\'unit_cost\',this.value)"><input type="number" value="'+(parseFloat(x.min_charge)||0).toFixed(2)+'" step="0.5" onchange="_uCCI('+x.id+',\'min_charge\',this.value)"><button style="background:none;border:none;cursor:pointer;color:#ccc;font-size:15px;padding:0" onclick="_dCCI('+x.id+')">×</button></div>';}).join('')+'</div>';
      }else if(deptModel==='press'){
        // Press model: Setup Min (flat $) + Sq Ft / Ink CMYK / Ink White ($/sq ft) + Min $ (floor)
        procHTML+='<div class="_lc" style="margin-bottom:8px"><div style="display:grid;grid-template-columns:60px 1fr 66px 66px 72px 72px 60px 24px;gap:5px;padding:6px 10px;border-bottom:1px solid #e8e6e2">'+th+'Code</span>'+th+'Name</span>'+th+'Setup $</span>'+th+'Sq Ft</span>'+th+'Ink CMYK</span>'+th+'Ink White</span>'+th+'Min $</span><span></span></div>'+items.map(function(x){return '<div class="_mr" style="grid-template-columns:60px 1fr 66px 66px 72px 72px 60px 24px"><input value="'+_e(x.code||'')+'" onchange="_uCCI('+x.id+',\'code\',this.value)"><input value="'+_e(x.name)+'" onchange="_uCCI('+x.id+',\'name\',this.value)"><input type="number" value="'+(parseFloat(x.setup_min)||0).toFixed(2)+'" step="0.01" onchange="_uCCI('+x.id+',\'setup_min\',this.value)"><input type="number" value="'+(parseFloat(x.sqft_rate)||0).toFixed(4)+'" step="0.0001" onchange="_uCCI('+x.id+',\'sqft_rate\',this.value)"><input type="number" value="'+(parseFloat(x.ink_cmyk)||0).toFixed(4)+'" step="0.0001" onchange="_uCCI('+x.id+',\'ink_cmyk\',this.value)"><input type="number" value="'+(parseFloat(x.ink_white)||0).toFixed(4)+'" step="0.0001" onchange="_uCCI('+x.id+',\'ink_white\',this.value)"><input type="number" value="'+(parseFloat(x.min_charge)||0).toFixed(2)+'" step="0.5" onchange="_uCCI('+x.id+',\'min_charge\',this.value)"><button style="background:none;border:none;cursor:pointer;color:#ccc;font-size:15px;padding:0" onclick="_dCCI('+x.id+')">×</button></div>';}).join('')+'</div>';
      }else if(deptModel==='digital'){
        // Digital press model: Click $ (per sheet) + Setup Min (costed at AI $/h)
        procHTML+='<div class="_lc" style="margin-bottom:8px"><div style="display:grid;grid-template-columns:60px 1fr 80px 70px 70px 24px;gap:5px;padding:6px 10px;border-bottom:1px solid #e8e6e2">'+th+'Code</span>'+th+'Name</span>'+th+'Click $</span>'+th+'Setup Min</span>'+th+'AI $/h</span><span></span></div>'+items.map(function(x){return '<div class="_mr" style="grid-template-columns:60px 1fr 80px 70px 70px 24px"><input value="'+_e(x.code||'')+'" onchange="_uCCI('+x.id+',\'code\',this.value)"><input value="'+_e(x.name)+'" onchange="_uCCI('+x.id+',\'name\',this.value)"><input type="number" value="'+(parseFloat(x.unit_cost)||0).toFixed(4)+'" step="0.0001" onchange="_uCCI('+x.id+',\'unit_cost\',this.value)"><input type="number" value="'+(parseFloat(x.setup_min)||0).toFixed(0)+'" step="1" onchange="_uCCI('+x.id+',\'setup_min\',this.value)"><input type="number" value="'+(parseFloat(x.ai_rate)||0).toFixed(2)+'" step="0.5" onchange="_uCCI('+x.id+',\'ai_rate\',this.value)"><button style="background:none;border:none;cursor:pointer;color:#ccc;font-size:15px;padding:0" onclick="_dCCI('+x.id+')">×</button></div>';}).join('')+'</div>';
      }else if(deptModel==='lamination'){
        // Lamination model: Labor $/sq ft (+ Min $). The film itself is picked
        // per-estimate from the "Wide Format / Lamination" material catalog.
        procHTML+='<div style="font-size:11px;color:#888;margin:-4px 0 8px">Labor only — the laminate film is picked from the material catalog on each estimate.</div>';
        procHTML+='<div class="_lc" style="margin-bottom:8px"><div style="display:grid;grid-template-columns:60px 1fr 90px 60px 24px;gap:5px;padding:6px 10px;border-bottom:1px solid #e8e6e2">'+th+'Code</span>'+th+'Name</span>'+th+'Labor $/sqft</span>'+th+'Min $</span><span></span></div>'+items.map(function(x){return '<div class="_mr" style="grid-template-columns:60px 1fr 90px 60px 24px"><input value="'+_e(x.code||'')+'" onchange="_uCCI('+x.id+',\'code\',this.value)"><input value="'+_e(x.name)+'" onchange="_uCCI('+x.id+',\'name\',this.value)"><input type="number" value="'+(parseFloat(x.sqft_rate)||0).toFixed(4)+'" step="0.0001" onchange="_uCCI('+x.id+',\'sqft_rate\',this.value)"><input type="number" value="'+(parseFloat(x.min_charge)||0).toFixed(2)+'" step="0.5" onchange="_uCCI('+x.id+',\'min_charge\',this.value)"><button style="background:none;border:none;cursor:pointer;color:#ccc;font-size:15px;padding:0" onclick="_dCCI('+x.id+')">×</button></div>';}).join('')+'</div>';
      }else{
        // postpress / bindery / outside use speed/setup model
        procHTML+='<div class="_lc" style="margin-bottom:8px"><div style="display:grid;grid-template-columns:60px 1fr 70px 60px 60px 60px 24px;gap:5px;padding:6px 10px;border-bottom:1px solid #e8e6e2">'+th+'Code</span>'+th+'Name</span>'+th+'Speed/h</span>'+th+'Setup min</span>'+th+'AI $/h</span>'+th+'DM $/h</span><span></span></div>'+items.map(function(x){return '<div class="_mr" style="grid-template-columns:60px 1fr 70px 60px 60px 60px 24px"><input value="'+_e(x.code||'')+'" onchange="_uCCI('+x.id+',\'code\',this.value)"><input value="'+_e(x.name)+'" onchange="_uCCI('+x.id+',\'name\',this.value)"><input type="number" value="'+(parseFloat(x.speed_per_h)||0).toFixed(0)+'" step="1" onchange="_uCCI('+x.id+',\'speed_per_h\',this.value)"><input type="number" value="'+(parseFloat(x.setup_min)||0).toFixed(0)+'" step="1" onchange="_uCCI('+x.id+',\'setup_min\',this.value)"><input type="number" value="'+(parseFloat(x.ai_rate)||0).toFixed(2)+'" step="0.5" onchange="_uCCI('+x.id+',\'ai_rate\',this.value)"><input type="number" value="'+(parseFloat(x.dm_rate)||0).toFixed(2)+'" step="0.5" onchange="_uCCI('+x.id+',\'dm_rate\',this.value)"><button style="background:none;border:none;cursor:pointer;color:#ccc;font-size:15px;padding:0" onclick="_dCCI('+x.id+')">×</button></div>';}).join('')+'</div>';
      }
    }else{
      procHTML+='<div style="color:#aaa;font-size:13px;padding:10px 0">No processes yet.</div>';
    }
    procHTML+='<button onclick="_aCCI('+_cccid+')" style="font-size:13px;color:#378ADD;background:none;border:none;cursor:pointer;padding:6px 0;font-weight:500">+ Add process</button>';
  }

  document.getElementById('_admC').innerHTML='<div class="_sec">'+_bc('Cost Centers')+'<div class="_ml3"><div>'+depHTML+'</div><div>'+ccHTML+'</div><div>'+procHTML+'</div></div></div>';
}
function _sCCK(k){_cck=k;_cccid=null;_rCC();}
async function _aCCDept(){
  var name=prompt('New department name (e.g. Large Format):'); if(!name||!name.trim())return;
  var mm={'1':'speed','2':'digital','3':'press','4':'prepress'};
  var mk=prompt('Pricing model for this department:\n\n1 = Speed / Setup / AI $/h / DM $/h  (most presses & finishing)\n2 = Click $ / Setup  (digital press)\n3 = Sq Ft / Ink  (wide-format press)\n4 = Mins / Rates  (prepress)','1');
  if(mk===null)return;
  var model=mm[(mk||'1').trim()]||'speed';
  var r=await _a('POST','/api/cost-centers/departments',{label:name.trim(),model:model});
  if(r&&r.error){alert(r.error);return;}
  _cck=r.kind;_cccid=null;if(typeof toast==='function')toast('Department added');_rCC();
}
async function _dCCDept(id,label){
  if(!confirm('Delete department "'+label+'"? (It must have no cost centers.)'))return;
  var r=await _a('DELETE','/api/cost-centers/departments/'+id);
  if(r&&r.error){alert(r.error);return;}
  _cck='prepress';_cccid=null;if(typeof toast==='function')toast('Department deleted');_rCC();
}
function _sCC(id){_cccid=id;_rCC();}
async function _aCC(){var code=prompt('Cost center code (e.g. 5400):');if(!code)return;var name=prompt('Cost center name:');if(!name)return;var c=await _a('POST','/api/cost-centers',{kind:_cck,code:code,name:name});_cccid=c.id;_rCC();}
async function _dCC(id){if(!confirm('Delete cost center and all its processes?'))return;await _a('DELETE','/api/cost-centers/'+id);_cccid=null;_rCC();}
async function _uCC(id,f,v){
  var b={}; b[f]=(f==='kind'||f==='code'||f==='name')?v:(parseFloat(v)||0);
  var r=await _a('PUT','/api/cost-centers/'+id,b);
  if(r&&r.error){alert(r.error);return;}
  if(f==='kind'){_cck=v;} // follow the cost center into its new department
  _cccid=id;
  if(typeof toast==='function')toast('Cost center updated');
  _rCC();
}
async function _aCCI(cid){await _a('POST','/api/cost-centers/items',{cost_center_id:cid,name:'New process'});_rCC();}
async function _uCCI(id,f,v){var b={};b[f]=(f==='code'||f==='name')?v:(parseFloat(v)||0);await _a('PUT','/api/cost-centers/items/'+id,b);}
async function _dCCI(id){if(!confirm('Delete?'))return;await _a('DELETE','/api/cost-centers/items/'+id);_rCC();}

// STAGES
var _stages=[]; var _dragStage=null;
async function _rStages(){
  document.getElementById('_admTitle').textContent='Production Stages';
  _stages=await _a('GET','/api/orders/stages');
  _renderStages();
}
function _renderStages(){
  var rows=_stages.map(function(x,i){
    var up=i===0?' disabled style="opacity:.3"':'', dn=i===_stages.length-1?' disabled style="opacity:.3"':'';
    return '<div class="_li" draggable="true" ondragstart="_stDrag(event,'+i+')" ondragover="event.preventDefault()" ondrop="_stDrop(event,'+i+')" ondragend="_dragStage=null" style="cursor:grab">'+
      '<span style="color:#c9c6c0;font-size:15px;margin-right:8px;cursor:grab" title="Drag to reorder">⠿</span>'+
      '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:'+(x.color||'#888')+';margin-right:9px;flex-shrink:0"></span>'+
      '<div class="_ln">'+_e(x.name)+'</div>'+
      '<button class="_btnG" style="font-size:13px;padding:2px 8px;margin-right:4px" onclick="_stMove('+i+',-1)"'+up+'>▲</button>'+
      '<button class="_btnG" style="font-size:13px;padding:2px 8px;margin-right:6px" onclick="_stMove('+i+',1)"'+dn+'>▼</button>'+
      '<button class="_btnD" onclick="_dStage('+x.id+')">Delete</button></div>';
  }).join('');
  document.getElementById('_admC').innerHTML='<div class="_sec">'+_bc('Production Stages')+
    '<div style="font-size:12px;color:#888;margin-bottom:10px">Drag the ⠿ handle (or use ▲▼) to set the order — this is the order of the columns on the Orders board.</div>'+
    '<div class="_lc">'+rows+'</div>'+
    '<div class="_addrow"><input id="_ns" type="text" placeholder="Stage name"><button class="_btn" onclick="_aStage()">Add</button></div></div>';
}
function _stDrag(e,i){_dragStage=i;e.dataTransfer.effectAllowed='move';}
function _stDrop(e,i){
  e.preventDefault();
  if(_dragStage===null||_dragStage===i)return;
  var moved=_stages.splice(_dragStage,1)[0];
  _stages.splice(i,0,moved);
  _dragStage=null;
  _renderStages(); _persistStageOrder();
}
function _stMove(i,dir){
  var j=i+dir; if(j<0||j>=_stages.length)return;
  var t=_stages[i]; _stages[i]=_stages[j]; _stages[j]=t;
  _renderStages(); _persistStageOrder();
}
async function _persistStageOrder(){
  for(var i=0;i<_stages.length;i++){ _stages[i].position=i; await _a('PUT','/api/orders/stages/'+_stages[i].id,{position:i}); }
  if(typeof toast==='function')toast('Stage order saved');
}
async function _aStage(){var n=document.getElementById('_ns').value.trim();if(!n)return;await _a('POST','/api/orders/stages',{name:n});_rStages();}
async function _dStage(id){if(!confirm('Delete?'))return;await _a('DELETE','/api/orders/stages/'+id);_rStages();}

// TIERS
async function _rTiers(){document.getElementById('_admTitle').textContent='Pricing Tiers';var t=await _a('GET','/api/tiers');document.getElementById('_admC').innerHTML='<div class="_sec">'+_bc('Pricing Tiers')+'<div class="_lc">'+t.map(function(x){return '<div class="_li"><div style="flex:1"><div class="_ln">'+_e(x.name)+'</div><div class="_ls">'+x.discount_pct+'% off</div></div><button class="_btnD" onclick="_dTier('+x.id+')">Delete</button></div>';}).join('')+'</div><div class="_addrow"><input id="_nt" type="text" placeholder="Tier name"><input id="_ntp" type="number" placeholder="%" min="0" style="max-width:80px"><button class="_btn" onclick="_aTier()">Add</button></div></div>';}
async function _aTier(){var n=document.getElementById('_nt').value.trim();if(!n)return;await _a('POST','/api/tiers',{name:n,discount_pct:parseFloat(document.getElementById('_ntp').value)||0});_rTiers();}
async function _dTier(id){if(!confirm('Delete?'))return;await _a('DELETE','/api/tiers/'+id);_rTiers();}

// REPS
var _er=null; // id of rep being edited
async function _rReps(){
  document.getElementById('_admTitle').textContent='Sales Reps';
  var r=await _a('GET','/api/reps');
  var er=_er?r.find(function(x){return x.id===_er;}):null;
  var editForm=er?'<div class="_form"><h4>Edit rep</h4><div class="_fg"><div class="_ff"><label>Name</label><input id="_er_n" value="'+_e(er.name)+'"></div><div class="_ff"><label>Email</label><input id="_er_e" type="email" value="'+_e(er.email||'')+'"></div><div class="_ff"><label>Phone</label><input id="_er_p" value="'+_e(er.phone||'')+'"></div><div class="_ff"><label>Commission %</label><input id="_er_c" type="number" min="0" step="0.5" value="'+(er.commission_pct||0)+'"></div></div><div class="_fa"><button class="_btn" onclick="_uRep()">Save</button><button class="_btnG" onclick="_er=null;_rReps()">Cancel</button></div></div>':'';
  document.getElementById('_admC').innerHTML='<div class="_sec">'+_bc('Sales Reps')+editForm+'<div class="_lc">'+r.map(function(x){return '<div class="_li"><div style="flex:1"><div class="_ln">'+_e(x.name)+'</div><div class="_ls">'+(x.email||'')+(x.commission_pct?' · '+x.commission_pct+'% comm':'')+'</div></div><button class="_btnG" style="font-size:12px;margin-right:6px" onclick="_eRep('+x.id+')">Edit</button><button class="_btnD" onclick="_dRep('+x.id+')">Delete</button></div>';}).join('')+'</div>'+(!er?'<div class="_addrow"><input id="_nr" type="text" placeholder="Name"><input id="_nre" type="email" placeholder="Email"><input id="_nrc" type="number" placeholder="%" min="0" style="max-width:70px"><button class="_btn" onclick="_aRep()">Add</button></div>':'')+'</div>';
}
function _eRep(id){_er=id;_rReps();}
async function _uRep(){var b={name:document.getElementById('_er_n').value.trim(),email:document.getElementById('_er_e').value,phone:document.getElementById('_er_p').value,commission_pct:parseFloat(document.getElementById('_er_c').value)||0};if(!b.name){alert('Name required');return;}await _a('PUT','/api/reps/'+_er,b);_er=null;if(typeof toast==='function')toast('Rep updated');_rReps();}
async function _aRep(){var n=document.getElementById('_nr').value.trim();if(!n)return;await _a('POST','/api/reps',{name:n,email:document.getElementById('_nre').value,commission_pct:parseFloat(document.getElementById('_nrc').value)||0});_rReps();}
async function _dRep(id){if(!confirm('Delete?'))return;await _a('DELETE','/api/reps/'+id);if(_er===id)_er=null;_rReps();}

// BUSINESS
function _rBiz(){document.getElementById('_admTitle').textContent='Business Settings';var s=JSON.parse(localStorage.getItem('victorSettings')||'{}');document.getElementById('_admC').innerHTML='<div class="_sec">'+_bc('Business Settings')+'<div class="_form"><h4>Company</h4><div class="_fg"><div class="_ff"><label>Name</label><input id="_bn" value="'+_e(s.companyName||'')+'" placeholder="Company name"></div><div class="_ff"><label>Phone</label><input id="_bp" value="'+_e(s.phone||'')+'" placeholder="(555) 555-5555"></div><div class="_ff"><label>Email</label><input id="_be" type="email" value="'+_e(s.email||'')+'" placeholder="info@co.com"></div><div class="_ff"><label>Address</label><input id="_ba" value="'+_e(s.address||'')+'" placeholder="123 Main St"></div></div></div><div class="_form"><h4>Defaults</h4><div class="_fg"><div class="_ff"><label>Tax rate (%)</label><input id="_bt" type="number" value="'+(s.defaultTax||0)+'" min="0" step="0.1"></div><div class="_ff"><label>Margin (%)</label><input id="_bm" type="number" value="'+(s.defaultMargin||40)+'" min="0" max="100"></div></div></div><button class="_btn" onclick="_sBiz()">Save settings</button></div>';}
function _sBiz(){localStorage.setItem('victorSettings',JSON.stringify({companyName:document.getElementById('_bn').value,phone:document.getElementById('_bp').value,email:document.getElementById('_be').value,address:document.getElementById('_ba').value,defaultTax:parseFloat(document.getElementById('_bt').value)||0,defaultMargin:parseFloat(document.getElementById('_bm').value)||40}));if(typeof toast==='function')toast('Saved!');}
