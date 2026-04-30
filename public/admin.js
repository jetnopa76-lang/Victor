// Victor — Auth & Admin Panel
(function() {

var currentUser = null;

var ROLE_TABS = {
  admin:      ['estimator','estimates','customers','orders','invoices'],
  sales:      ['estimator','estimates','customers','orders'],
  production: ['orders'],
  accounting: ['invoices']
};

window.applyRoleTabs=function applyRoleTabs(role) {
  var allowed = ROLE_TABS[role] || ROLE_TABS.sales;
  document.querySelectorAll('.nav-tab').forEach(function(tab) {
    var fn = tab.getAttribute('onclick') || '';
    var m = fn.match(/showPage\('(\w+)'/);
    if (!m) return;
    var tabId = m[1];
    tab.style.display = (role === 'admin' || allowed.indexOf(tabId) >= 0) ? '' : 'none';
  });
}

window.lockAndHide=function lockAndHide() {
  currentUser = null;
  // Hide all tabs
  document.querySelectorAll('.nav-tab').forEach(function(t){ t.style.display = 'none'; });
  // Hide admin button
  var ag = document.getElementById('adminGearBtn');
  if (ag) ag.style.display = 'none';
  // Clear badge
  var b = document.getElementById('userBadge');
  if (b) b.textContent = '';
  // Show PIN
  document.getElementById('pinOverlay').style.display = 'flex';
  setTimeout(function(){ document.getElementById('pinInput').focus(); }, 100);
}

// ── STYLES ────────────────────────────────────────────────────────
function injectStyles() {
  if (document.getElementById('admin-styles')) return;
  var s = document.createElement('style');
  s.id = 'admin-styles';
  s.textContent = `
    #pinOverlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:10000;display:none;align-items:center;justify-content:center}
    #pinBox{background:#fff;border-radius:16px;padding:2rem;max-width:340px;width:90%;text-align:center}
    #pinBox h3{font-size:18px;font-weight:500;margin-bottom:4px}
    #pinBox p{font-size:13px;color:#888;margin-bottom:20px}
    #pinInput{width:100%;height:48px;font-size:24px;text-align:center;letter-spacing:8px;border:2px solid #ddd;border-radius:10px;outline:none;margin-bottom:12px;padding:0 12px}
    #pinInput:focus{border-color:#1a1a18}
    #pinError{color:#a32d2d;font-size:12px;min-height:16px;margin-bottom:8px}
    #pinSubmit{width:100%;height:44px;background:#1a1a18;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:500;cursor:pointer}
    #adminOverlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.45);z-index:9995;display:none;align-items:flex-start;justify-content:center;padding:20px 0;overflow-y:auto}
    #adminWindow{background:#fff;border-radius:16px;width:95%;max-width:900px;margin:auto;overflow:hidden;top:10px;position:relative}
    .adm-header{background:#1a1a18;color:#fff;padding:12px 16px;display:flex;align-items:center;justify-content:space-between}
    .adm-body{display:grid;grid-template-columns:200px 1fr;min-height:500px}
    .adm-sidebar{background:#f9f8f6;border-right:1px solid #e0ded8;padding:12px}
    .adm-nav{padding:8px 10px;border-radius:8px;cursor:pointer;font-size:13px;color:#666;margin-bottom:2px;display:flex;align-items:center;gap:8px}
    .adm-nav:hover{background:#f0efec}
    .adm-nav.active{background:#1a1a18;color:#fff}
    .adm-main{padding:20px;overflow-y:auto;max-height:70vh}
    .user-card{background:#f9f8f6;border-radius:10px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between}
    .role-badge{display:inline-block;font-size:11px;padding:2px 8px;border-radius:20px;font-weight:500;margin-left:8px}
    .role-admin{background:#1a1a18;color:#fff}
    .role-sales{background:#EAF3DE;color:#27500A}
    .role-production{background:#E6F1FB;color:#0C447C}
    .role-accounting{background:#FFF3DC;color:#7A4A00}
    .adm-btn{padding:6px 14px;border-radius:7px;border:1px solid #ddd;background:#fff;font-size:12px;cursor:pointer;font-weight:500}
    .adm-btn-primary{background:#1a1a18;color:#fff;border-color:#1a1a18}
    .adm-btn-danger{color:#a32d2d;border-color:#f0c8c8}
    .adm-field{margin-bottom:12px}
    .adm-field label{font-size:12px;color:#666;display:block;margin-bottom:3px}
    .adm-field input,.adm-field select{width:100%;height:34px;padding:0 10px;border:1px solid #ddd;border-radius:8px;font-size:13px}
    .g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .item-row{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f5f5f3}
    .item-row .name{flex:1;font-size:13px}
  `;
  document.head.appendChild(s);
}

// ── MODALS HTML ───────────────────────────────────────────────────
function injectHTML() {
  if (document.getElementById('pinOverlay')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="pinOverlay">
      <div id="pinBox">
        <h3>🔒 Victor</h3>
        <p>Enter your PIN to continue</p>
        <input id="pinInput" type="password" maxlength="8" placeholder="••••" onkeydown="if(event.key==='Enter')submitPin()">
        <div id="pinError"></div>
        <button id="pinSubmit" onclick="submitPin()">Sign in</button>
        <button onclick="skipPin()" style="margin-top:8px;width:100%;height:36px;background:none;border:1px solid #ddd;border-radius:10px;font-size:13px;color:#888;cursor:pointer">Continue without signing in</button>
      </div>
    </div>
    <div id="adminOverlay">
      <div id="adminWindow">
        <div class="adm-header">
          <span style="font-size:14px;font-weight:500">⚙ Admin settings</span>
          <button onclick="closeAdmin()" style="background:none;border:none;color:#aaa;font-size:20px;cursor:pointer">&times;</button>
        </div>
        <div class="adm-body">
          <div class="adm-sidebar" id="admSidebar"></div>
          <div class="adm-main" id="admMain"></div>
        </div>
      </div>
    </div>
  `);
}

// ── PIN AUTH ──────────────────────────────────────────────────────
window.submitPin = async function() {
  var pin = document.getElementById('pinInput').value;
  if (!pin) return;
  document.getElementById('pinError').textContent = '';
  try {
    var r = await fetch('/api/users/login', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({pin: pin})
    });
    var data = await r.json();
    if (!r.ok) {
      document.getElementById('pinError').textContent = 'Invalid PIN';
      document.getElementById('pinInput').value = '';
      return;
    }
    currentUser = data;
    document.getElementById('pinOverlay').style.display = 'none';
    document.getElementById('pinInput').value = '';
    applyRoleTabs(data.role);
    updateUserDisplay();
    if (typeof toast === 'function') toast('Welcome, ' + data.name + '!');
  } catch(e) {
    document.getElementById('pinError').textContent = 'Connection error';
  }
};

window.skipPin = function() {
  document.getElementById('pinOverlay').style.display = 'none';
  document.querySelectorAll('.nav-tab').forEach(function(t){ t.style.display=''; });
};

function updateUserDisplay() {
  var badge = document.getElementById('userBadge');
  var adminBtn = document.getElementById('adminGearBtn');
  if (badge && currentUser) badge.textContent = currentUser.name;
  if (adminBtn) adminBtn.style.display = currentUser && currentUser.role === 'admin' ? '' : 'none';
}

window.openAdmin = function() {
  injectHTML();
  renderAdmSidebar();
  renderAdmSection('users');
  document.getElementById('adminOverlay').style.display = 'flex';
};

window.closeAdmin = function() {
  document.getElementById('adminOverlay').style.display = 'none';
};

// ── ADMIN SIDEBAR ─────────────────────────────────────────────────
var admSection = 'users';

function renderAdmSidebar() {
  var items = [
    {id:'users',    icon:'👥', label:'Users'},
    {id:'pricing',  icon:'💲', label:'Pricing Library'},
    {id:'stages',   icon:'📋', label:'Production Stages'},
    {id:'tiers',    icon:'🏷', label:'Pricing Tiers'},
    {id:'reps',     icon:'👤', label:'Sales Reps'},
    {id:'business', icon:'🏢', label:'Business Settings'},
  ];
  document.getElementById('admSidebar').innerHTML = items.map(function(i){
    return '<div class="adm-nav'+(admSection===i.id?' active':'')+'" onclick="renderAdmSection(\''+i.id+'\')">'+i.icon+' '+i.label+'</div>';
  }).join('');
}

window.renderAdmSection = async function(sec) {
  admSection = sec;
  renderAdmSidebar();
  var main = document.getElementById('admMain');
  main.innerHTML = '<div style="color:#aaa;font-size:13px">Loading...</div>';
  if      (sec==='users')    await renderUsers(main);
  else if (sec==='pricing')  { closeAdmin(); openPricingLibrary(); }
  else if (sec==='stages')   await renderStages(main);
  else if (sec==='tiers')    await renderTiers(main);
  else if (sec==='reps')     await renderReps(main);
  else if (sec==='business') renderBusiness(main);
};

// ── USERS ─────────────────────────────────────────────────────────
async function renderUsers(main) {
  var r = await fetch('/api/users');
  var users = await r.json();
  main.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'+
      '<div style="font-size:15px;font-weight:500">Users</div>'+
      '<button class="adm-btn adm-btn-primary" onclick="showNewUserForm()">+ Add user</button>'+
    '</div>'+
    '<div id="newUserForm"></div>'+
    users.map(function(u){
      return '<div class="user-card">'+
        '<div><strong>'+u.name+'</strong><span class="role-badge role-'+u.role+'">'+u.role+'</span></div>'+
        '<div style="display:flex;gap:6px">'+
          '<button class="adm-btn" onclick="resetPin('+u.id+')">Reset PIN</button>'+
          (u.id!==1?'<button class="adm-btn adm-btn-danger" onclick="deleteUser('+u.id+')">Delete</button>':'')+
        '</div>'+
      '</div>';
    }).join('');
}

window.showNewUserForm = function() {
  document.getElementById('newUserForm').innerHTML =
    '<div style="background:#f0efec;border-radius:10px;padding:14px;margin-bottom:16px">'+
      '<div class="g2">'+
        '<div class="adm-field"><label>Name</label><input id="nu_name" type="text" placeholder="Full name"></div>'+
        '<div class="adm-field"><label>PIN</label><input id="nu_pin" type="password" placeholder="4-8 digits" maxlength="8"></div>'+
        '<div class="adm-field"><label>Role</label><select id="nu_role">'+
          '<option value="admin">Admin</option>'+
          '<option value="sales" selected>Sales</option>'+
          '<option value="production">Production</option>'+
          '<option value="accounting">Accounting</option>'+
        '</select></div>'+
      '</div>'+
      '<div style="display:flex;gap:8px">'+
        '<button class="adm-btn adm-btn-primary" onclick="createUser()">Create</button>'+
        '<button class="adm-btn" onclick="document.getElementById(\'newUserForm\').innerHTML=\'\'">Cancel</button>'+
      '</div>'+
    '</div>';
};

window.createUser = async function() {
  var name=document.getElementById('nu_name').value.trim();
  var pin=document.getElementById('nu_pin').value;
  var role=document.getElementById('nu_role').value;
  if(!name||!pin){alert('Name and PIN required');return;}
  await fetch('/api/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,role,pin})});
  renderAdmSection('users');
};

window.resetPin = function(id) {
  var pin=prompt('New PIN:');
  if(!pin)return;
  fetch('/api/users/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin})})
    .then(function(){if(typeof toast==='function')toast('PIN updated!');});
};

window.deleteUser = async function(id) {
  if(!confirm('Delete user?'))return;
  await fetch('/api/users/'+id,{method:'DELETE'});
  renderAdmSection('users');
};

// ── STAGES ────────────────────────────────────────────────────────
async function renderStages(main) {
  var r=await fetch('/api/orders/stages');
  var stages=await r.json();
  main.innerHTML=
    '<div style="font-size:15px;font-weight:500;margin-bottom:12px">Production Stages</div>'+
    stages.map(function(s){
      return '<div class="item-row"><div class="name">'+s.name+'</div>'+
        '<button class="adm-btn adm-btn-danger" onclick="deleteStage('+s.id+')">Delete</button></div>';
    }).join('')+
    '<div style="display:flex;gap:8px;margin-top:12px">'+
      '<input id="newStage" type="text" placeholder="Stage name" style="flex:1;height:34px;padding:0 10px;border:1px solid #ddd;border-radius:8px;font-size:13px">'+
      '<button class="adm-btn adm-btn-primary" onclick="addStage()">Add</button>'+
    '</div>';
}
window.addStage=async function(){
  var name=document.getElementById('newStage').value.trim();if(!name)return;
  await fetch('/api/orders/stages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});
  renderAdmSection('stages');
};
window.deleteStage=async function(id){
  if(!confirm('Delete stage?'))return;
  await fetch('/api/orders/stages/'+id,{method:'DELETE'});
  renderAdmSection('stages');
};

// ── TIERS ─────────────────────────────────────────────────────────
async function renderTiers(main) {
  var r=await fetch('/api/tiers');
  var tiers=await r.json();
  main.innerHTML=
    '<div style="font-size:15px;font-weight:500;margin-bottom:12px">Pricing Tiers</div>'+
    tiers.map(function(t){
      return '<div class="item-row"><div class="name"><strong>'+t.name+'</strong> — '+t.discount_pct+'% off</div>'+
        '<button class="adm-btn adm-btn-danger" onclick="deleteTier('+t.id+')">Delete</button></div>';
    }).join('')+
    '<div style="display:grid;grid-template-columns:1fr 100px auto;gap:8px;margin-top:12px">'+
      '<input id="newTierName" type="text" placeholder="Tier name" style="height:34px;padding:0 10px;border:1px solid #ddd;border-radius:8px;font-size:13px">'+
      '<input id="newTierPct" type="number" placeholder="%" min="0" style="height:34px;padding:0 10px;border:1px solid #ddd;border-radius:8px;font-size:13px">'+
      '<button class="adm-btn adm-btn-primary" onclick="addTier()">Add</button>'+
    '</div>';
}
window.addTier=async function(){
  var name=document.getElementById('newTierName').value.trim();
  var pct=document.getElementById('newTierPct').value;
  if(!name)return;
  await fetch('/api/tiers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,discount_pct:parseFloat(pct)||0})});
  renderAdmSection('tiers');
};
window.deleteTier=async function(id){
  if(!confirm('Delete tier?'))return;
  await fetch('/api/tiers/'+id,{method:'DELETE'});
  renderAdmSection('tiers');
};

// ── REPS ──────────────────────────────────────────────────────────
async function renderReps(main) {
  var r=await fetch('/api/reps');
  var reps=await r.json();
  main.innerHTML=
    '<div style="font-size:15px;font-weight:500;margin-bottom:12px">Sales Reps</div>'+
    reps.map(function(r){
      return '<div class="item-row"><div class="name"><strong>'+r.name+'</strong>'+(r.email?' · '+r.email:'')+' · '+r.commission_pct+'% comm</div>'+
        '<button class="adm-btn adm-btn-danger" onclick="deleteRep('+r.id+')">Delete</button></div>';
    }).join('')+
    '<div style="display:grid;grid-template-columns:1fr 1fr 80px auto;gap:8px;margin-top:12px">'+
      '<input id="newRepName" type="text" placeholder="Name" style="height:34px;padding:0 10px;border:1px solid #ddd;border-radius:8px;font-size:13px">'+
      '<input id="newRepEmail" type="email" placeholder="Email" style="height:34px;padding:0 10px;border:1px solid #ddd;border-radius:8px;font-size:13px">'+
      '<input id="newRepComm" type="number" placeholder="%" min="0" style="height:34px;padding:0 10px;border:1px solid #ddd;border-radius:8px;font-size:13px">'+
      '<button class="adm-btn adm-btn-primary" onclick="addRep()">Add</button>'+
    '</div>';
}
window.addRep=async function(){
  var name=document.getElementById('newRepName').value.trim();
  var email=document.getElementById('newRepEmail').value.trim();
  var comm=document.getElementById('newRepComm').value;
  if(!name)return;
  await fetch('/api/reps',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,commission_pct:parseFloat(comm)||0})});
  renderAdmSection('reps');
};
window.deleteRep=async function(id){
  if(!confirm('Delete rep?'))return;
  await fetch('/api/reps/'+id,{method:'DELETE'});
  renderAdmSection('reps');
};

// ── BUSINESS SETTINGS ─────────────────────────────────────────────
function renderBusiness(main) {
  var s=JSON.parse(localStorage.getItem('victorSettings')||'{}');
  main.innerHTML=
    '<div style="font-size:15px;font-weight:500;margin-bottom:16px">Business Settings</div>'+
    '<div class="g2">'+
      '<div class="adm-field"><label>Company name</label><input id="bs_name" value="'+(s.companyName||'')+'" placeholder="Your company"></div>'+
      '<div class="adm-field"><label>Phone</label><input id="bs_phone" value="'+(s.phone||'')+'" placeholder="(555) 555-5555"></div>'+
      '<div class="adm-field"><label>Email</label><input id="bs_email" type="email" value="'+(s.email||'')+'" placeholder="info@company.com"></div>'+
      '<div class="adm-field"><label>Address</label><input id="bs_addr" value="'+(s.address||'')+'" placeholder="123 Main St"></div>'+
      '<div class="adm-field"><label>Default tax rate (%)</label><input id="bs_tax" type="number" value="'+(s.defaultTax||0)+'" min="0" step="0.1"></div>'+
      '<div class="adm-field"><label>Default margin (%)</label><input id="bs_margin" type="number" value="'+(s.defaultMargin||40)+'" min="0" max="100"></div>'+
    '</div>'+
    '<button class="adm-btn adm-btn-primary" onclick="saveBiz()">Save</button>';
}
window.saveBiz=function(){
  localStorage.setItem('victorSettings',JSON.stringify({
    companyName:document.getElementById('bs_name').value,
    phone:document.getElementById('bs_phone').value,
    email:document.getElementById('bs_email').value,
    address:document.getElementById('bs_addr').value,
    defaultTax:parseFloat(document.getElementById('bs_tax').value)||0,
    defaultMargin:parseFloat(document.getElementById('bs_margin').value)||40
  }));
  if(typeof toast==='function')toast('Saved!');
};

// ── NAV BUTTONS ───────────────────────────────────────────────────
function injectNavButtons() {
  if (document.getElementById('lockBtn')) return;
  var nav = document.querySelector('nav');
  if (!nav) return;
  var wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex;align-items:center;gap:6px;margin-left:8px';
  wrapper.innerHTML =
    '<span id="userBadge" style="font-size:12px;color:#666"></span>'+
    '<button id="adminGearBtn" onclick="openAdmin()" style="display:none;background:none;border:1px solid #ddd;color:#1a1a18;border-radius:8px;padding:4px 10px;font-size:12px;cursor:pointer">⚙ Admin</button>'+
    '<button id="lockBtn" onclick="lockAndHide()" style="background:none;border:1px solid #ddd;color:#1a1a18;border-radius:8px;padding:4px 10px;font-size:12px;cursor:pointer">🔒</button>';
  var statusDiv = nav.querySelector('.nav-status');
  if (statusDiv) statusDiv.parentNode.insertBefore(wrapper, statusDiv);
  else nav.appendChild(wrapper);
  // Remove pricing library button from nav
  setTimeout(function(){
    var pl = document.getElementById('pricingLibBtn');
    if (pl) pl.remove();
  }, 500);
}

// Init
injectStyles();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function(){
    injectHTML();
    injectNavButtons();
    // Hide all tabs until login
    document.querySelectorAll('.nav-tab').forEach(function(t){ t.style.display='none'; });
  });
} else {
  injectHTML();
  injectNavButtons();
  setTimeout(function(){
    document.querySelectorAll('.nav-tab').forEach(function(t){ t.style.display='none'; });
  }, 100);
}

})();
