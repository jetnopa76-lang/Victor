// Victor — Job Components System
(function() {

var components = [];
var currentCompIdx = null;
var currentCompTab = 'layout';
var cachedMaterials = null;
var materialsLoading = false;

function nid() { return '_' + Math.random().toString(36).substr(2,9); }

function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(ch){
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch];
  });
}

function loadMaterials() {
  if (cachedMaterials || materialsLoading) return;
  materialsLoading = true;
  fetch('/api/materials').then(function(r){ return r.ok ? r.json() : []; })
    .then(function(data){
      cachedMaterials = Array.isArray(data) ? data : [];
      materialsLoading = false;
      var ov = document.getElementById('compOverlay');
      if (ov && ov.style.display === 'flex' && currentCompTab === 'layout' && currentCompIdx !== null) {
        renderCompEditor();
      }
    })
    .catch(function(){ materialsLoading = false; cachedMaterials = []; });
}

function getMaterialCategories() {
  if (!cachedMaterials) return [];
  var seen = {};
  cachedMaterials.forEach(function(m){
    if (m.category_name) seen[m.category_name] = true;
  });
  return Object.keys(seen).sort();
}

function buildCategoryOptions(selectedCat) {
  var cats = getMaterialCategories();
  if (!cats.length) return '<option value="">— No categories —</option>';
  var html = '<option value="">— Select category —</option>';
  cats.forEach(function(c){
    var sel = c === selectedCat ? ' selected' : '';
    html += '<option value="' + escHtml(c) + '"' + sel + '>' + escHtml(c) + '</option>';
  });
  return html;
}

function buildMaterialOptions(selectedId, filterCat) {
  if (!cachedMaterials) {
    return '<option value="">Loading materials…</option>';
  }
  if (!filterCat) {
    return '<option value="">— Pick a category first —</option>';
  }
  var items = cachedMaterials.filter(function(m){ return m.category_name === filterCat; });
  if (!items.length) {
    return '<option value="">No materials in this category</option>';
  }
  var html = '<option value="">— Select material —</option>';
  items.forEach(function(m){
    var sel = String(m.id) === String(selectedId) ? ' selected' : '';
    var w = m.width_in ? Number(m.width_in) : null;
    var h = m.length_in ? Number(m.length_in) : null;
    var sz = w ? ' (' + w + '"' + (h ? '×' + h + '"' : '') + ')' : '';
    var price = ' — $' + Number(m.cost||0).toFixed(4);
    var unit = m.unit ? '/' + escHtml(m.unit) : '';
    var label = (m.sku ? m.sku + ' — ' : '') + (m.name || '');
    html += '<option value="' + m.id + '"' + sel + '>' + escHtml(label) + sz + price + unit + '</option>';
  });
  return html;
}

window.applyMaterialCategory = function(cat) {
  if (currentCompIdx === null) return;
  var l = components[currentCompIdx].layout;
  l.material_category = cat || '';
  // If current material is not in the new category, clear it
  if (l.material_id) {
    var m = (cachedMaterials||[]).find(function(x){ return String(x.id) === String(l.material_id); });
    if (!m || m.category_name !== cat) {
      l.material_id = null;
      l.material_name = '';
    }
  }
  renderCompEditor();
};

window.applyMaterial = function(id) {
  if (currentCompIdx === null) return;
  var l = components[currentCompIdx].layout;
  if (!id) {
    l.material_id = null;
    l.material_name = '';
    renderCompEditor();
    return;
  }
  var m = (cachedMaterials||[]).find(function(x){ return String(x.id) === String(id); });
  if (!m) return;
  l.material_id = m.id;
  l.material_name = m.name;
  l.material_category = m.category_name || l.material_category;
  if (m.width_in)  l.sw = parseFloat(m.width_in);
  if (m.length_in) l.sh = parseFloat(m.length_in);
  if (m.pricing_method === 'per_sqft' && m.cost != null) l.csf = parseFloat(m.cost) || 0;
  renderCompEditor();
};

function newComponent(name) {
  return {
    id: nid(),
    name: name || 'New component',
    layout: { sw:54, sh:1200, fw:24, fh:36, bleed:0.125, grip:0.5, gut:0.125, rolls:1, qty:500, csf:0, sides:1, material_id:null, material_name:'' },
    processTabs: [
      { id: nid(), name: 'PrePress',  items: [] },
      { id: nid(), name: 'Press',     items: [] },
      { id: nid(), name: 'PostPress', items: [] },
      { id: nid(), name: 'Bindery',   items: [] }
    ]
  };
}

function newProcessItem() {
  return { id: nid(), name: '', method: 'flat', rate: 0, qty: 1 };
}

function calcItemTotal(item) {
  return parseFloat(item.rate||0) * parseFloat(item.qty||1);
}

function calcTabTotal(tab) {
  return tab.items.reduce(function(s,i){ return s + calcItemTotal(i); }, 0);
}

function calcLayoutCost(layout) {
  var uw = layout.fw + layout.bleed*2, uh = layout.fh + layout.bleed*2;
  var sides = Math.max(1, parseInt(layout.sides) || 1);
  var across = Math.max(1, Math.floor((layout.sw + layout.gut) / (uw + layout.gut)));
  var rowsNeeded = Math.max(1, Math.ceil((layout.qty || 1) / across));
  var totalOuts = rowsNeeded * across;
  // Length of roll consumed for the job (in inches), per side
  var lenUsed = layout.grip + rowsNeeded * (uh + layout.gut) - layout.gut;
  // How many rolls needed if length exceeds one roll (informational)
  var rollLen = layout.sh > 0 ? layout.sh : lenUsed;
  var rolls = Math.max(1, Math.ceil(lenUsed / rollLen));
  // sqft consumed = (width × length × sides)
  var sqft = (layout.sw/12) * (lenUsed/12) * sides;
  // Waste: positions not used on the last row
  var pieceArea = uw * uh * (layout.qty || 1);
  var totalAreaUsed = layout.sw * lenUsed;
  var waste = Math.max(0, Math.min(99, ((totalAreaUsed - pieceArea) / Math.max(totalAreaUsed, 1)) * 100));
  return {
    across,
    around: rowsNeeded,
    outs: totalOuts,
    sheets: rolls,
    sqft,
    cost: sqft * (layout.csf || 0),
    waste,
    lenUsed,
    sides
  };
}

function calcComponentTotal(comp) {
  var lc = calcLayoutCost(comp.layout);
  var proc = comp.processTabs.reduce(function(s,t){ return s + calcTabTotal(t); }, 0);
  return lc.cost + proc;
}

function calcAllComponentsTotal() {
  return components.reduce(function(s,c){ return s + calcComponentTotal(c); }, 0);
}

function injectStyles() {
  if (document.getElementById('comp-styles')) return;
  var style = document.createElement('style');
  style.id = 'comp-styles';
  style.textContent = `
    #compOverlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.45);z-index:9998;display:none;align-items:flex-start;justify-content:center;padding:20px 0;overflow-y:auto}
    #compWindow{background:#fff;border-radius:16px;width:95%;max-width:760px;margin:auto;overflow:hidden;position:relative;top:10px}
    #compListOverlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.45);z-index:9997;display:none;align-items:flex-start;justify-content:center;padding:20px 0;overflow-y:auto}
    #compListWindow{background:#fff;border-radius:16px;width:95%;max-width:600px;margin:auto;overflow:hidden;position:relative;top:10px}
    .cw-header{background:#1a1a18;color:#fff;padding:12px 16px;display:flex;align-items:center;justify-content:space-between}
    .cw-title{font-size:14px;font-weight:500}
    .cw-close{background:none;border:none;color:#aaa;font-size:20px;cursor:pointer;line-height:1}
    .cw-tabs{display:flex;border-bottom:1px solid #e0ded8;background:#f9f8f6;overflow-x:auto}
    .cw-tab{padding:10px 16px;font-size:13px;cursor:pointer;border-bottom:2px solid transparent;color:#888;background:none;border-top:none;border-left:none;border-right:none;white-space:nowrap}
    .cw-tab.active{color:#1a1a18;border-bottom-color:#1a1a18;font-weight:500;background:#fff}
    .cw-body{padding:16px;max-height:65vh;overflow-y:auto}
    .cw-footer{padding:12px 16px;border-top:1px solid #f0efec;display:flex;gap:8px;justify-content:space-between;align-items:center;background:#fff}
    .proc-row{display:grid;grid-template-columns:1fr 100px 80px 60px 60px 24px;gap:6px;align-items:center;padding:7px 0;border-bottom:1px solid #f5f5f3}
    .proc-row input,.proc-row select{height:28px;padding:0 6px;border:1px solid #ddd;border-radius:6px;font-size:12px;width:100%}
    .proc-row .row-total{font-size:12px;font-weight:500;text-align:right}
    .proc-row .del-btn{background:none;border:none;color:#ccc;cursor:pointer;font-size:16px;padding:0;text-align:center}
    .proc-row .del-btn:hover{color:#a32d2d}
    .proc-header{display:grid;grid-template-columns:1fr 100px 80px 60px 60px 24px;gap:6px;padding:4px 0;margin-bottom:4px}
    .proc-row-mat{grid-template-columns:1fr 1.4fr 90px 70px 50px 60px 22px}
    .proc-header-mat{grid-template-columns:1fr 1.4fr 90px 70px 50px 60px 22px}
    .proc-header span{font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:.05em}
    .add-item-btn{font-size:12px;color:#378ADD;cursor:pointer;background:none;border:none;padding:6px 0;margin-top:4px;display:block}
    .stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}
    .stat-box{background:#f9f8f6;border-radius:8px;padding:10px}
    .stat-box .sl{font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}
    .stat-box .sv{font-size:18px;font-weight:500;color:#1a1a18}
    .stat-box .ss{font-size:11px;color:#888}
    .r2g{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px}
    .r3g{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px}
    .lbl{font-size:12px;color:#666;display:block;margin-bottom:3px}
    .inp{width:100%;height:32px;padding:0 8px;border:1px solid #ddd;border-radius:7px;font-size:13px}
    .sec-lbl{font-size:11px;font-weight:500;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;margin-top:12px;padding-top:12px;border-top:1px solid #f0efec}
    .comp-card{background:#fff;border:1px solid #e0ded8;border-radius:12px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between}
    .comp-card-info{flex:1;cursor:pointer}
    .comp-card-name{font-size:14px;font-weight:500;color:#1a1a18}
    .comp-card-detail{font-size:12px;color:#888;margin-top:2px}
    .comp-card-total{font-size:15px;font-weight:500;color:#1a1a18;margin-right:12px}
    .comp-card-actions{display:flex;gap:6px}
    .cta-btn{font-size:11px;padding:4px 10px;border-radius:6px;border:1px solid #ddd;background:#fff;cursor:pointer}
    .cta-del{border-color:#f0c8c8;color:#a32d2d}
    .total-bar{background:#1a1a18;color:#fff;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;font-size:13px}
    .canvas-preview{width:100%;background:#fff;border:1px solid #e0ded8;border-radius:6px;display:block;margin-top:8px}
  `;
  document.head.appendChild(style);
}

function injectHTML() {
  if (document.getElementById('compOverlay')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="compListOverlay">
      <div id="compListWindow">
        <div class="cw-header">
          <span class="cw-title">Job components</span>
          <button class="cw-close" onclick="closeCompList()">&times;</button>
        </div>
        <div style="padding:16px">
          <div id="compListItems"></div>
          <button onclick="openNewComp()" style="width:100%;margin-top:8px;padding:10px;border:2px dashed #ddd;border-radius:10px;background:none;font-size:13px;color:#378ADD;cursor:pointer">+ Add component</button>
        </div>
        <div class="total-bar">
          <span>Total all components</span>
          <span id="compListTotal">$0.00</span>
        </div>
        <div class="cw-footer" style="justify-content:flex-end">
          <button onclick="applyComponentsToEstimate()" style="background:#1a1a18;color:#fff;border:none;border-radius:8px;padding:8px 18px;font-size:13px;font-weight:500;cursor:pointer">Apply to estimate</button>
          <button onclick="closeCompList()" style="background:transparent;border:1px solid #ddd;border-radius:8px;padding:8px 18px;font-size:13px;cursor:pointer">Close</button>
        </div>
      </div>
    </div>
    <div id="compOverlay">
      <div id="compWindow">
        <div class="cw-header">
          <div style="display:flex;align-items:center;gap:8px"><label style="font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:.05em">Name</label><input id="compNameInput" type="text" placeholder="Component name" style="background:rgba(255,255,255,0.08);border:1px solid #555;border-radius:6px;color:#fff;font-size:14px;font-weight:500;padding:5px 10px;width:240px;outline:none" oninput="updateCurrentCompName(this.value)" onfocus="this.style.borderColor='#888';this.style.background='rgba(255,255,255,0.15)'" onblur="this.style.borderColor='#555';this.style.background='rgba(255,255,255,0.08)'"></div>
          <button class="cw-close" onclick="closeCompEditor()">&times;</button>
        </div>
        <div class="cw-tabs" id="compMainTabs"></div>
        <div class="cw-body" id="compBody"></div>
        <div class="cw-footer">
          <div style="font-size:13px;color:#888">Component total: <strong id="compEditorTotal" style="color:#1a1a18">$0.00</strong></div>
          <div style="display:flex;gap:8px">
            <button onclick="saveAndCloseComp()" style="background:#1a1a18;color:#fff;border:none;border-radius:8px;padding:8px 18px;font-size:13px;font-weight:500;cursor:pointer">Save component</button>
            <button onclick="closeCompEditor()" style="background:transparent;border:1px solid #ddd;border-radius:8px;padding:8px 18px;font-size:13px;cursor:pointer">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  `);
}

window.openCompList = function() {
  injectStyles(); injectHTML();
  renderCompList();
  document.getElementById('compListOverlay').style.display = 'flex';
};

window.closeCompList = function() {
  document.getElementById('compListOverlay').style.display = 'none';
};

function renderCompList() {
  var el = document.getElementById('compListItems');
  if (!components.length) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:#aaa;font-size:13px">No components yet. Click Add component to start.</div>';
  } else {
    el.innerHTML = components.map(function(c, i) {
      var lc = calcLayoutCost(c.layout);
      var total = calcComponentTotal(c);
      return '<div class="comp-card">' +
        '<div class="comp-card-info" onclick="openEditComp(' + i + ')">' +
          '<div class="comp-card-name">' + escHtml(c.name) + '</div>' +
          '<div class="comp-card-detail">' + c.layout.qty + ' pcs · ' + lc.outs + ' outs/sheet · ' + lc.sheets + ' sheets</div>' +
        '</div>' +
        '<div class="comp-card-total">$' + total.toFixed(2) + '</div>' +
        '<div class="comp-card-actions">' +
          '<button class="cta-btn" onclick="openEditComp(' + i + ')">Edit</button>' +
          '<button class="cta-btn cta-del" onclick="deleteComp(' + i + ')">Delete</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }
  document.getElementById('compListTotal').textContent = '$' + calcAllComponentsTotal().toFixed(2);
  updateAddCompBtn();
}

function updateAddCompBtn() {
  var btn = document.getElementById('addCompBtn');
  if (!btn) return;
  btn.textContent = components.length
    ? 'Edit Components (' + components.length + ') — $' + calcAllComponentsTotal().toFixed(2)
    : 'Add Component';
}

window.deleteComp = function(i) {
  if (!confirm('Delete this component?')) return;
  components.splice(i, 1);
  renderCompList();
  if (typeof calc === 'function') calc();
};

window.applyComponentsToEstimate = function() {
  closeCompList();
  if (typeof calc === 'function') calc();
  var total = calcAllComponentsTotal();
  if (typeof toast === 'function') toast(components.length + ' component(s) applied — $' + total.toFixed(2));
};

window.getComponentsBreakdown = function() {
  return components.map(function(c){
    var lc = calcLayoutCost(c.layout);
    var procTotal = c.processTabs.reduce(function(s,t){ return s + calcTabTotal(t); }, 0);
    return {
      label: c.name || 'Component',
      val: lc.cost + procTotal,
      detail: lc.sheets + ' sheets · ' + c.processTabs.reduce(function(s,t){ return s + t.items.length; }, 0) + ' process item(s)'
    };
  });
};

window.getComponentsTotal = calcAllComponentsTotal;

window.openNewComp = function() {
  components.push(newComponent('New component'));
  currentCompIdx = components.length - 1;
  currentCompTab = 'layout';
  openCompEditor();
};

window.openEditComp = function(i) {
  currentCompIdx = i;
  currentCompTab = 'layout';
  openCompEditor();
};

function openCompEditor() {
  injectStyles(); injectHTML();
  loadMaterials();
  document.getElementById('compNameInput').value = components[currentCompIdx].name;
  document.getElementById('compOverlay').style.display = 'flex';
  renderCompEditor();
}

window.closeCompEditor = function() {
  document.getElementById('compOverlay').style.display = 'none';
  renderCompList();
};

window.saveAndCloseComp = function() {
  document.getElementById('compOverlay').style.display = 'none';
  renderCompList();
  document.getElementById('compListOverlay').style.display = 'flex';
  if (typeof calc === 'function') calc();
};

window.updateCurrentCompName = function(val) {
  if (currentCompIdx === null) return;
  components[currentCompIdx].name = val;
};

function renderCompEditor() {
  var c = components[currentCompIdx];
  var tabsHTML = '<button class="cw-tab' + (currentCompTab==='layout'?' active':'') + '" onclick="switchCompTab(\'layout\')">Layout</button>';
  c.processTabs.forEach(function(t, i) {
    tabsHTML += '<button class="cw-tab' + (currentCompTab===('proc_'+i)?' active':'') + '" onclick="switchCompTab(\'proc_'+i+'\')">' + t.name + '</button>';
  });
  tabsHTML += '<button class="cw-tab" style="color:#378ADD" onclick="addProcessTab()">+ Add tab</button>';
  document.getElementById('compMainTabs').innerHTML = tabsHTML;
  if (currentCompTab === 'layout') {
    renderLayoutTab(c);
  } else {
    renderProcessTab(c, parseInt(currentCompTab.replace('proc_','')));
  }
  document.getElementById('compEditorTotal').textContent = '$' + calcComponentTotal(c).toFixed(2);
}

window.switchCompTab = function(tab) {
  currentCompTab = tab;
  renderCompEditor();
};

function renderLayoutTab(c) {
  var l = c.layout;
  var lc = calcLayoutCost(l);
  document.getElementById('compBody').innerHTML = `
    <div class="r2g" style="margin-bottom:12px">
      <div>
        <label class="lbl">Material category</label>
        <select class="inp" onchange="applyMaterialCategory(this.value)">${buildCategoryOptions(l.material_category)}</select>
      </div>
      <div>
        <label class="lbl">Material</label>
        <select class="inp" onchange="applyMaterial(this.value)" ${!l.material_category ? 'disabled' : ''}>${buildMaterialOptions(l.material_id, l.material_category)}</select>
      </div>
    </div>
    <div class="r2g">
      <div>
        <div class="sec-lbl" style="margin-top:0;padding-top:0;border-top:none">Roll / press sheet</div>
        <div class="r2g">
          <div><label class="lbl">Width (in)</label><input class="inp" type="number" value="${l.sw}" step="0.125" oninput="updateLayout('sw',this.value)"></div>
          <div><label class="lbl">Roll length (in)</label><input class="inp" type="number" value="${l.sh}" step="1" oninput="updateLayout('sh',this.value)"></div>
        </div>
        <div class="r2g">
          <div><label class="lbl">Cost per sq ft ($)</label><input class="inp" type="number" value="${l.csf}" min="0" step="0.01" oninput="updateLayout('csf',this.value)"></div>
          <div><label class="lbl">Sides</label><select class="inp" oninput="updateLayout('sides',this.value)"><option value="1"${l.sides==1?' selected':''}>1-sided</option><option value="2"${l.sides==2?' selected':''}>2-sided</option></select></div>
        </div>
      </div>
      <div>
        <div class="sec-lbl" style="margin-top:0;padding-top:0;border-top:none">Finished trim size</div>
        <div class="r2g">
          <div><label class="lbl">Width (in)</label><input class="inp" type="number" value="${l.fw}" step="0.125" oninput="updateLayout('fw',this.value)"></div>
          <div><label class="lbl">Height (in)</label><input class="inp" type="number" value="${l.fh}" step="0.125" oninput="updateLayout('fh',this.value)"></div>
        </div>
        <div><label class="lbl">Quantity (pieces)</label><input class="inp" type="number" value="${l.qty}" min="1" oninput="updateLayout('qty',this.value)"></div>
      </div>
    </div>
    <div class="r3g">
      <div><label class="lbl">Bleed (in)</label><input class="inp" type="number" value="${l.bleed}" step="0.0625" oninput="updateLayout('bleed',this.value)"></div>
      <div><label class="lbl">Gripper (in)</label><input class="inp" type="number" value="${l.grip}" step="0.0625" oninput="updateLayout('grip',this.value)"></div>
      <div><label class="lbl">Gutter (in)</label><input class="inp" type="number" value="${l.gut}" step="0.0625" oninput="updateLayout('gut',this.value)"></div>
    </div>
    <div class="stat-grid">
      <div class="stat-box"><div class="sl">Layout</div><div class="sv">${lc.across}×${lc.around}</div><div class="ss">${lc.outs} positions · ${l.qty} pcs</div></div>
      <div class="stat-box"><div class="sl">Roll length used</div><div class="sv">${(lc.lenUsed/12).toFixed(1)} ft</div><div class="ss">${lc.lenUsed.toFixed(1)}" · ${lc.sheets > 1 ? lc.sheets+' rolls · ' : ''}${lc.waste.toFixed(1)}% waste</div></div>
      <div class="stat-box"><div class="sl">Substrate cost</div><div class="sv">$${lc.cost.toFixed(2)}</div><div class="ss">${lc.sqft.toFixed(1)} sq ft${lc.sides>1?' (×'+lc.sides+' sides)':''}</div></div>
    </div>
    <canvas id="compCanvas" class="canvas-preview" height="200"></canvas>
  `;
  setTimeout(function(){ drawCompCanvas(l, lc); }, 50);
}

window.updateLayout = function(field, val) {
  components[currentCompIdx].layout[field] = parseFloat(val) || 0;
  renderCompEditor();
};

function drawCompCanvas(l, lc) {
  var canvas = document.getElementById('compCanvas');
  if (!canvas) return;
  var cw = canvas.offsetWidth || 600;
  var lenForDraw = lc.lenUsed || l.sh;
  var ch = Math.min(Math.round(cw * Math.min(lenForDraw/l.sw, 6) / 4), 200);
  canvas.width = cw; canvas.height = ch;
  var ctx = canvas.getContext('2d');
  var scale = Math.min((cw-16)/l.sw, (ch-16)/lenForDraw);
  var ox = (cw-l.sw*scale)/2, oy = 8;
  var uw = l.fw+l.bleed*2, uh = l.fh+l.bleed*2;
  ctx.fillStyle='#f0efec'; ctx.fillRect(ox,oy,l.sw*scale,lenForDraw*scale);
  ctx.strokeStyle='#ccc'; ctx.lineWidth=0.5; ctx.strokeRect(ox,oy,l.sw*scale,lenForDraw*scale);
  ctx.fillStyle='#FAEEDA'; ctx.fillRect(ox,oy,l.sw*scale,l.grip*scale);
  var maxD=Math.min(lc.across*lc.around,200), drawn=0;
  outer:for(var row=0;row<lc.around;row++){
    for(var col=0;col<lc.across;col++){
      if(drawn>=maxD)break outer;
      var px=ox+col*(uw+l.gut)*scale, py=oy+l.grip*scale+row*(uh+l.gut)*scale;
      var isWaste = drawn >= (l.qty || 0);
      ctx.fillStyle = isWaste ? '#f5e0e0' : '#EAF3DE';
      ctx.fillRect(px,py,uw*scale,uh*scale);
      ctx.fillStyle = isWaste ? '#e8c0c0' : '#B5D4F4';
      ctx.fillRect(px+l.bleed*scale,py+l.bleed*scale,l.fw*scale,l.fh*scale);
      ctx.strokeStyle = isWaste ? '#a32d2d' : '#378ADD'; ctx.lineWidth=0.5; ctx.setLineDash([]); ctx.strokeRect(px+l.bleed*scale,py+l.bleed*scale,l.fw*scale,l.fh*scale);
      ctx.strokeStyle = isWaste ? '#a32d2d' : '#639922'; ctx.setLineDash([2,2]); ctx.strokeRect(px,py,uw*scale,uh*scale); ctx.setLineDash([]);
      drawn++;
    }
  }
  if(l.fw*scale>30){ctx.fillStyle='#0C447C';ctx.font='bold 9px sans-serif';ctx.fillText(l.fw+'" x '+l.fh+'"',ox+l.bleed*scale+2,oy+l.grip*scale+l.bleed*scale+10);}
}

window.addProcessTab = function() {
  var name = prompt('Tab name:');
  if (!name) return;
  components[currentCompIdx].processTabs.push({ id: nid(), name: name, items: [] });
  currentCompTab = 'proc_' + (components[currentCompIdx].processTabs.length - 1);
  renderCompEditor();
};

var TAB_LIBRARY_MAP = [
  { match: /post\s*press|lamination/i, categories: ['Wide Format / Lamination'], label: 'Lamination' },
  { match: /bindery|hardware|install|finishing/i, categories: ['Wide Format / Hardware'], label: 'Hardware' },
  { match: /press(?!.*post)|substrate|roll\s*media/i, categories: ['Wide Format / Roll Media'], label: 'Roll Media' }
];

function getTabLibrary(tabName) {
  for (var i = 0; i < TAB_LIBRARY_MAP.length; i++) {
    if (TAB_LIBRARY_MAP[i].match.test(tabName||'')) return TAB_LIBRARY_MAP[i];
  }
  return null;
}

function buildLibraryPicker(tabIdx, lib) {
  if (!cachedMaterials || !cachedMaterials.length) return '';
  var items = cachedMaterials.filter(function(m){ return lib.categories.indexOf(m.category_name) !== -1; });
  if (!items.length) return '';
  var opts = '<option value="">— Add from ' + escHtml(lib.label) + ' library (' + items.length + ' items) —</option>';
  items.forEach(function(m){
    var label = (m.sku ? m.sku + ' — ' : '') + (m.name || '');
    var sz = m.width_in ? ' (' + Number(m.width_in) + '")' : '';
    var price = ' — $' + Number(m.cost||0).toFixed(4) + '/sqft';
    opts += '<option value="' + m.id + '">' + escHtml(label) + sz + price + '</option>';
  });
  return '<select class="inp" style="margin-bottom:10px" onchange="addItemFromLibrary(' + tabIdx + ',this.value);this.value=\'\'">' + opts + '</select>';
}

window.addItemFromLibrary = function(tabIdx, materialId) {
  if (!materialId) return;
  var m = (cachedMaterials||[]).find(function(x){ return String(x.id) === String(materialId); });
  if (!m) return;
  var c = components[currentCompIdx];
  var lc = calcLayoutCost(c.layout);
  var qty = lc.sqft > 0 ? Math.ceil(lc.sqft) : 1;
  var name = (m.sku ? m.sku + ' — ' : '') + (m.name || '');
  c.processTabs[tabIdx].items.push({
    id: nid(),
    name: name.length > 80 ? name.substring(0, 77) + '…' : name,
    method: 'per_sqft',
    rate: parseFloat(m.cost) || 0,
    qty: qty,
    material_id: m.id
  });
  renderCompEditor();
};

function buildRowMaterialOptions(lib, selectedId) {
  if (!cachedMaterials) return '<option value="">Loading…</option>';
  var items = cachedMaterials.filter(function(m){ return lib.categories.indexOf(m.category_name) !== -1; });
  if (!items.length) return '<option value="">No ' + escHtml(lib.label) + ' materials</option>';
  var html = '<option value="">— ' + escHtml(lib.label) + ' material —</option>';
  items.forEach(function(m){
    var sel = String(m.id) === String(selectedId) ? ' selected' : '';
    var label = (m.sku ? m.sku + ' — ' : '') + (m.name || '');
    if (label.length > 60) label = label.substring(0, 57) + '…';
    html += '<option value="' + m.id + '"' + sel + '>' + escHtml(label) + '</option>';
  });
  return html;
}

window.applyRowMaterial = function(tabIdx, itemIdx, materialId) {
  var item = components[currentCompIdx].processTabs[tabIdx].items[itemIdx];
  if (!materialId) {
    item.material_id = null;
    renderCompEditor();
    return;
  }
  var m = (cachedMaterials||[]).find(function(x){ return String(x.id) === String(materialId); });
  if (!m) return;
  item.material_id = m.id;
  if (!item.name || item.name.trim() === '') {
    var nm = (m.sku ? m.sku + ' — ' : '') + (m.name || '');
    item.name = nm.length > 80 ? nm.substring(0, 77) + '…' : nm;
  }
  var pm = m.pricing_method || 'per_sqft';
  item.method = (pm === 'per_sqft' || pm === 'per_unit' || pm === 'per_hour') ? pm : 'flat';
  item.rate = parseFloat(m.cost) || 0;
  if (!item.qty || item.qty === 1) {
    if (pm === 'per_sqft') {
      var lc = calcLayoutCost(components[currentCompIdx].layout);
      if (lc.sqft > 0) item.qty = Math.ceil(lc.sqft);
    }
    // for per_unit / per_hour / flat, leave qty = 1 (user knows the count)
  }
  renderCompEditor();
};

function renderProcessTab(c, idx) {
  var tab = c.processTabs[idx];
  var tabTotal = calcTabTotal(tab);
  var lib = getTabLibrary(tab.name);
  var hasLib = lib && cachedMaterials && cachedMaterials.some(function(m){ return lib.categories.indexOf(m.category_name) !== -1; });
  var rowsHTML = '';
  if (tab.items.length) {
    var headerCols = hasLib
      ? '<span>Process name</span><span>Material</span><span>Method</span><span>Rate ($)</span><span>Qty</span><span style="text-align:right">Total</span><span></span>'
      : '<span>Process / item</span><span>Method</span><span>Rate ($)</span><span>Qty</span><span style="text-align:right">Total</span><span></span>';
    var rowCls = hasLib ? 'proc-row proc-row-mat' : 'proc-row';
    var hdrCls = hasLib ? 'proc-header proc-header-mat' : 'proc-header';
    rowsHTML = '<div class="' + hdrCls + '">' + headerCols + '</div>';
    tab.items.forEach(function(item, i) {
      var matCell = hasLib
        ? '<select onchange="applyRowMaterial(' + idx + ',' + i + ',this.value)">' + buildRowMaterialOptions(lib, item.material_id) + '</select>'
        : '';
      rowsHTML += '<div class="' + rowCls + '">' +
        '<input value="' + escHtml(item.name||'') + '" placeholder="Process name" oninput="updateItem(' + idx + ',' + i + ',\'name\',this.value)">' +
        matCell +
        '<select oninput="updateItem(' + idx + ',' + i + ',\'method\',this.value)">' +
          '<option value="flat"' + (item.method==='flat'?' selected':'') + '>Flat rate</option>' +
          '<option value="per_unit"' + (item.method==='per_unit'?' selected':'') + '>Per unit</option>' +
          '<option value="per_hour"' + (item.method==='per_hour'?' selected':'') + '>Per hour</option>' +
          '<option value="per_sqft"' + (item.method==='per_sqft'?' selected':'') + '>Per sq ft</option>' +
        '</select>' +
        '<input type="number" value="' + (item.rate||0) + '" min="0" step="0.01" oninput="updateItem(' + idx + ',' + i + ',\'rate\',this.value)" style="text-align:right">' +
        '<input type="number" value="' + (item.qty||1) + '" min="1" oninput="updateItem(' + idx + ',' + i + ',\'qty\',this.value)" style="text-align:right">' +
        '<div class="row-total">$' + calcItemTotal(item).toFixed(2) + '</div>' +
        '<button class="del-btn" onclick="deleteItem(' + idx + ',' + i + ')">×</button>' +
      '</div>';
    });
  }
  document.getElementById('compBody').innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
      '<input value="' + tab.name + '" style="font-size:14px;font-weight:500;border:none;border-bottom:1px solid #ddd;padding:2px 4px;outline:none;width:150px" oninput="renameTab(' + idx + ',this.value)">' +
      '<div style="display:flex;gap:8px;align-items:center">' +
        '<span style="font-size:12px;color:#888">Tab total: <strong style="color:#1a1a18">$' + tabTotal.toFixed(2) + '</strong></span>' +
        (idx >= 4 ? '<button onclick="deleteTab(' + idx + ')" style="font-size:11px;color:#a32d2d;border:1px solid #f0c8c8;border-radius:6px;background:#fff;padding:3px 8px;cursor:pointer">Delete tab</button>' : '') +
      '</div>' +
    '</div>' +
    rowsHTML +
    '<button class="add-item-btn" onclick="addItem(' + idx + ')">+ Add ' + tab.name.toLowerCase() + ' item</button>';
}

window.renameTab = function(idx, val) {
  components[currentCompIdx].processTabs[idx].name = val;
};

window.deleteTab = function(idx) {
  if (!confirm('Delete this tab?')) return;
  components[currentCompIdx].processTabs.splice(idx, 1);
  currentCompTab = 'layout';
  renderCompEditor();
};

window.addItem = function(tabIdx) {
  components[currentCompIdx].processTabs[tabIdx].items.push(newProcessItem());
  renderCompEditor();
};

window.deleteItem = function(tabIdx, itemIdx) {
  components[currentCompIdx].processTabs[tabIdx].items.splice(itemIdx, 1);
  renderCompEditor();
};

window.updateItem = function(tabIdx, itemIdx, field, val) {
  var item = components[currentCompIdx].processTabs[tabIdx].items[itemIdx];
  item[field] = field === 'name' ? val : (parseFloat(val) || 0);
  var total = calcItemTotal(item);
  var rows = document.querySelectorAll('.proc-row');
  if (rows[itemIdx]) {
    var totalEl = rows[itemIdx].querySelector('.row-total');
    if (totalEl) totalEl.textContent = '$' + total.toFixed(2);
  }
  document.getElementById('compEditorTotal').textContent = '$' + calcComponentTotal(components[currentCompIdx]).toFixed(2);
};

function injectButton() {
  if (document.getElementById('addCompBtn')) return;
  var ef = document.getElementById('jobType');
  if (!ef) return;
  ef = ef.closest('.ef');
  if (!ef) return;
  ef.insertAdjacentHTML('afterend', '<button id="addCompBtn" class="btn btn-primary" style="width:100%;margin-top:8px" onclick="openCompList()">Add Component</button>');
  updateAddCompBtn();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function(){ injectStyles(); injectButton(); });
} else {
  injectStyles();
  injectButton();
  setTimeout(injectButton, 1000);
}

})();
