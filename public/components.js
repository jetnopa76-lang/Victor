// Victor — Job Components System
(function() {

var components = [];
var currentCompIdx = null;
var currentCompTab = 'layout';
var cachedMaterials = null;
var materialsLoading = false;
var cachedCostCenterItems = null;
var costCenterItemsLoading = false;

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
      if (ov && ov.style.display === 'flex' && currentCompIdx !== null) {
        renderCompEditor();
      }
    })
    .catch(function(){ materialsLoading = false; cachedMaterials = []; });
}

function loadCostCenterItems() {
  if (cachedCostCenterItems || costCenterItemsLoading) return;
  costCenterItemsLoading = true;
  fetch('/api/cost-centers/items').then(function(r){ return r.ok ? r.json() : []; })
    .then(function(data){
      cachedCostCenterItems = Array.isArray(data) ? data : [];
      costCenterItemsLoading = false;
      var ov = document.getElementById('compOverlay');
      if (ov && ov.style.display === 'flex' && currentCompIdx !== null) {
        renderCompEditor();
      }
    })
    .catch(function(){ costCenterItemsLoading = false; cachedCostCenterItems = []; });
}

var cachedDepartments = null, departmentsLoading = false;
function loadDepartments() {
  if (cachedDepartments || departmentsLoading) return;
  departmentsLoading = true;
  fetch('/api/cost-centers/departments').then(function(r){ return r.ok ? r.json() : []; })
    .then(function(data){ cachedDepartments = Array.isArray(data) ? data : []; departmentsLoading = false; })
    .catch(function(){ departmentsLoading = false; cachedDepartments = []; });
}

// Drop the cached materials + cost-center rates so the next component-editor
// open refetches fresh Admin data. Called by Admin after any price edit so
// changes there flow straight into estimates (no page reload needed).
window.invalidateComponentCaches = function() {
  cachedCostCenterItems = null; costCenterItemsLoading = false;
  cachedMaterials = null; materialsLoading = false;
  cachedDepartments = null; departmentsLoading = false;
  var ov = document.getElementById('compOverlay');
  if (ov && ov.style.display === 'flex' && currentCompIdx !== null) {
    loadMaterials(); loadCostCenterItems(); loadDepartments(); // editor is open → refresh live
  }
};

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
  // Capture the material's pricing method so the substrate prices correctly:
  // per sq ft (wide format), per sheet, or per M / per 1,000 (digital stock).
  l.pricing_method = m.pricing_method || 'per_sqft';
  l.mat_unit = m.unit || '';
  l.mat_cost = m.cost != null ? (parseFloat(m.cost) || 0) : 0;
  l.csf = (m.pricing_method === 'per_sqft' && m.cost != null) ? (parseFloat(m.cost) || 0) : 0;
  renderCompEditor();
};

// Process tabs mirror the cost-center departments (so they always match).
// Each tab carries the department `kind` so its picker + pricing line up.
function defaultProcessTabs() {
  if (cachedDepartments && cachedDepartments.length) {
    return cachedDepartments.map(function(d){ return { id: nid(), name: d.label, kind: d.kind, items: [] }; });
  }
  return [
    { id: nid(), name: 'PrePress',      kind: 'prepress', items: [] },
    { id: nid(), name: 'Wide Format Press', kind: 'press', items: [] },
    { id: nid(), name: 'Digital Press', kind: 'digital',  items: [] },
    { id: nid(), name: 'PostPress',     kind: 'postpress',items: [] },
    { id: nid(), name: 'Bindery',       kind: 'bindery',  items: [] }
  ];
}

function newComponent(name) {
  return {
    id: nid(),
    name: name || 'New component',
    layout: { sw:54, sh:1200, fw:24, fh:36, bleed:0.125, grip:0.5, gut:0.125, rolls:1, qty:500, csf:0, sides:1, material_id:null, material_name:'' },
    processTabs: defaultProcessTabs()
  };
}

function newProcessItem() {
  return { id: nid(), name: '', method: 'flat', rate: 0, qty: 1 };
}

// Press line: flat Setup + ($/sqft base + CMYK + optional White) × job sq ft.
// Other lines: rate × qty. `sqft` is the component's printed area.
function calcItemTotal(item, sqft, sheets) {
  if (item && item.kind === 'press') {
    var area = parseFloat(sqft || 0);
    var perSqft = (parseFloat(item.sqft_rate||0)) + (parseFloat(item.ink_cmyk||0)) +
                  (item.white ? parseFloat(item.ink_white||0) : 0);
    return parseFloat(item.setup||0) + perSqft * area;
  }
  if (item && item.kind === 'digital') {
    // Click $ per sheet + setup (minutes × AI $/hr).
    var run = parseFloat(item.click||0) * parseFloat(sheets||0);
    var setup = (parseFloat(item.setup_min||0)/60) * parseFloat(item.ai_rate||0);
    return run + setup;
  }
  return parseFloat(item.rate||0) * parseFloat(item.qty||1);
}

function calcTabTotal(tab, sqft, sheets) {
  return tab.items.reduce(function(s,i){ return s + calcItemTotal(i, sqft, sheets); }, 0);
}

// Is this a rigid board / cut-sheet stock (fixed sheet, bought whole) vs. a
// continuous roll (banner, vinyl, etc., bought by the linear foot)?
function isBoardStock(cat) {
  cat = (cat || '').toLowerCase();
  if (/roll|banner|vinyl|fabric|mesh|film|scrim|canvas|paper|wallpaper/.test(cat)) return false;
  if (/board|rigid|panel|acrylic|aluminum|sheet|foam|pvc|coroplast|corrugat|dibond|acm|styrene|glass|wood|substrate/.test(cat)) return true;
  return false; // default: treat unknown wide-format media as roll goods
}

// A fixed cut sheet (buy whole sheets: rigid boards AND digital/press sheets)
// vs. a continuous roll (billed by length). Rolls are the wide-format exception.
function isFixedSheet(cat, sh) {
  cat = (cat || '').toLowerCase();
  if (/roll|banner|vinyl|fabric|mesh|film|scrim|wallpaper/.test(cat)) return false; // roll goods
  if (isBoardStock(cat)) return true;                                                // rigid board
  return sh > 0 && sh <= 200;  // finite, modest length ⇒ a cut sheet (paper/digital/press)
}

// Compute substrate layout + cost. Prices by the material's method — per sq ft
// (wide format), per sheet, or per M (per 1,000 sheets, e.g. digital stock).
// Automatically tries both piece orientations and keeps the better nesting.
function calcLayoutCost(layout) {
  var sides = Math.max(1, parseInt(layout.sides) || 1);
  var bw = layout.fw + layout.bleed*2, bh = layout.fh + layout.bleed*2; // bled piece
  var sw = layout.sw || 0, sh = layout.sh || 0;
  var grip = layout.grip || 0, gut = layout.gut || 0, qty = Math.max(1, layout.qty || 1);
  var csf = layout.csf || 0;
  var pm = layout.pricing_method || 'per_sqft';
  var matCost = parseFloat(layout.mat_cost != null ? layout.mat_cost : csf) || 0;
  var unit = (layout.mat_unit || '').toLowerCase();
  var pieceSqftEach = (bw/12) * (bh/12);

  // Substrate $ from the material's pricing method. sheets = whole sheets/rolls used.
  function substrateCost(sheets, sqft) {
    if (pm === 'per_sheet') return sheets * matCost;
    if (pm === 'per_unit')  return unit === 'm' ? sheets * (matCost/1000) : sheets * matCost;
    return sqft * csf; // per_sqft (default / manual)
  }

  if (isFixedSheet(layout.material_category, sh) && sw > 0 && sh > 0) {
    // ── Fixed sheet: grid-nest onto sw×sh, buy whole sheets ──
    function fitSheet(pw, ph) {
      var a = Math.max(0, Math.floor((sw + gut) / (pw + gut)));            // across the width
      var d = Math.max(0, Math.floor((sh - grip + gut) / (ph + gut)));     // down the sheet
      return { across: a, down: d, per: a * d, pw: pw, ph: ph };
    }
    var f0 = fitSheet(bw, bh), f90 = fitSheet(bh, bw);
    var best = f90.per > f0.per ? f90 : f0;                                // more pieces wins
    var perSheet = best.per;
    var fits = perSheet > 0;
    var sheets = fits ? Math.ceil(qty / perSheet) : 1;                     // whole sheets
    var sheetSqft = (sw/12) * (sh/12);
    var sqft = sheets * sheetSqft;
    var waste = Math.max(0, Math.min(99, (1 - (pieceSqftEach * qty) / (sheetSqft * sheets)) * 100));
    return {
      mode: 'sheet', isBoard: isBoardStock(layout.material_category),
      rotated: best.pw !== bw, fits: fits,
      across: best.across, around: best.down, outs: perSheet, perSheet: perSheet,
      sheets: sheets, sqft: sqft, cost: substrateCost(sheets, sqft), waste: waste,
      lenUsed: sh, puw: best.pw, puh: best.ph, sides: sides
    };
  }

  // ── Roll goods: lay pieces across the roll width, consume length; rotate to
  //    minimize the length pulled. Billed by width × length used. ──
  function fitRoll(pw, ph) {
    var a = Math.floor((sw + gut) / (pw + gut));   // pieces across the roll width
    if (a < 1) return { across: 0, rows: 0, len: Infinity, pw: pw, ph: ph }; // too wide for the roll → invalid orientation
    var rows = Math.max(1, Math.ceil(qty / a));
    var len = grip + rows * (ph + gut) - gut;
    return { across: a, rows: rows, len: len, pw: pw, ph: ph };
  }
  var r0 = fitRoll(bw, bh), r90 = fitRoll(bh, bw);
  var rb;
  if (r0.len === Infinity && r90.len === Infinity) {
    // Piece is wider than the roll in both orientations — best effort, 1 across.
    var rowsF = Math.max(1, qty);
    rb = { across: 1, rows: rowsF, len: grip + rowsF * (bh + gut) - gut, pw: bw, ph: bh };
  } else {
    rb = (r90.len < r0.len) ? r90 : r0;                                    // only fitting orientations; less length wins
  }
  var rollLen = sh > 0 ? sh : rb.len;
  var rolls = Math.max(1, Math.ceil(rb.len / rollLen));
  var sqft = (sw/12) * (rb.len/12);
  var totalArea = sw * rb.len;
  var pieceArea = rb.pw * rb.ph * qty;
  var waste = Math.max(0, Math.min(99, ((totalArea - pieceArea) / Math.max(totalArea, 1)) * 100));
  return {
    mode: 'roll', isBoard: false, rotated: rb.pw !== bw, fits: true,
    across: rb.across, around: rb.rows, outs: rb.across * rb.rows, perSheet: rb.across * rb.rows,
    sheets: rolls, sqft: sqft, cost: substrateCost(rolls, sqft), waste: waste,
    lenUsed: rb.len, puw: rb.pw, puh: rb.ph, sides: sides
  };
}

function calcComponentTotal(comp) {
  var lc = calcLayoutCost(comp.layout);
  var proc = comp.processTabs.reduce(function(s,t){ return s + calcTabTotal(t, lc.sqft, lc.sheets); }, 0);
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
    .cc-picker{background:#f9f8f6;border:1px solid #e8e6e2;border-radius:10px;padding:10px 12px;margin-bottom:12px}
    .cc-picker-row{display:grid;grid-template-columns:120px 1fr 1fr;gap:10px;align-items:end}
    .cc-picker-row + .cc-picker-row{margin-top:8px;padding-top:8px;border-top:1px dashed #e0ded8}
    .cc-dept{font-size:13px;font-weight:500;color:#1a1a18;padding:8px 10px;background:#1a1a18;color:#fff;border-radius:7px;text-align:center;height:32px;line-height:16px;box-sizing:border-box}
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
  loadDepartments(); loadCostCenterItems(); loadMaterials(); // preload so new tabs match departments
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
    var parts = [];
    if (lc.cost > 0.01) parts.push('Substrate $' + lc.cost.toFixed(2));
    c.processTabs.forEach(function(t){
      var tt = calcTabTotal(t, lc.sqft);
      if (tt > 0.01) parts.push(t.name + ' $' + tt.toFixed(2));
    });
    var procTotal = c.processTabs.reduce(function(s,t){ return s + calcTabTotal(t, lc.sqft); }, 0);
    return {
      label: c.name || 'Component',
      val: lc.cost + procTotal,
      detail: parts.join(' · ') || (lc.sheets + ' sheets')
    };
  });
};

// Fully itemized breakdown: one entry per component, each with its own line
// items (substrate + every process line) so the estimate can list them all.
window.getComponentsItemized = function() {
  return components.map(function(c){
    var lc = calcLayoutCost(c.layout);
    var lines = [];
    if (lc.cost > 0.001) {
      var sheetWord = lc.isBoard ? 'board' : 'sheet';
      var subDetail = lc.mode === 'sheet'
        ? (lc.sheets + ' ' + sheetWord + (lc.sheets>1?'s':'') + ' · ' + Math.round(lc.sqft) + ' sq ft')
        : (Math.round(lc.sqft) + ' sq ft' + (lc.sheets>1 ? ' · ' + lc.sheets + ' sheets' : ''));
      lines.push({ label: 'Substrate — ' + (c.layout.material_name || 'stock'), detail: subDetail, val: lc.cost });
    }
    c.processTabs.forEach(function(t){
      t.items.forEach(function(it){
        var v = calcItemTotal(it, lc.sqft, lc.sheets);
        if (Math.abs(v) < 0.001) return;
        var label = (it.name && it.name.trim()) ? it.name : t.name;
        var detail = t.name;
        if (it.kind === 'press') {
          var per = parseFloat(it.sqft_rate||0) + parseFloat(it.ink_cmyk||0) + (it.white ? parseFloat(it.ink_white||0) : 0);
          detail = t.name + ' · $' + per.toFixed(4) + '/sqft × ' + Math.round(lc.sqft) +
                   (parseFloat(it.setup||0) > 0 ? ' + $' + parseFloat(it.setup).toFixed(2) + ' setup' : '') +
                   (it.white ? ' · +white ink' : '');
        } else if (it.kind === 'digital') {
          var setupC = (parseFloat(it.setup_min||0)/60) * parseFloat(it.ai_rate||0);
          detail = t.name + ' · $' + parseFloat(it.click||0).toFixed(4) + '/click × ' + lc.sheets + ' sheets' +
                   (setupC > 0.005 ? ' + $' + setupC.toFixed(2) + ' setup' : '');
        } else if (it.method === 'per_sqft') {
          detail = t.name + ' · $' + parseFloat(it.rate||0).toFixed(4) + '/sqft × ' + (it.qty||0);
        } else if (it.method === 'per_unit') {
          detail = t.name + ' · $' + parseFloat(it.rate||0).toFixed(4) + '/ea × ' + (it.qty||0);
        }
        lines.push({ label: label, detail: detail, val: v });
      });
    });
    return { name: c.name || 'Component', total: calcComponentTotal(c), lines: lines };
  });
};

window.getComponentsTotal = calcAllComponentsTotal;

// Serialize the current components (deep copy) for saving into an estimate.
window.exportComponents = function() {
  try { return JSON.parse(JSON.stringify(components)); } catch (e) { return []; }
};

// Restore components from a saved estimate and refresh the UI.
window.importComponents = function(arr) {
  components = Array.isArray(arr) ? arr : [];
  currentCompIdx = null;
  if (document.getElementById('compListItems')) renderCompList();
  updateAddCompBtn();
};

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
  loadDepartments();
  loadMaterials();
  loadCostCenterItems();
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
    tabsHTML += '<button class="cw-tab' + (currentCompTab===('proc_'+i)?' active':'') + '" onclick="switchCompTab(\'proc_'+i+'\')">' + escHtml(t.name) + '</button>';
  });
  // Tabs mirror the cost-center departments — add/remove them in Admin, not here.
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
        <div class="sec-lbl" style="margin-top:0;padding-top:0;border-top:none">Sheet size</div>
        <div class="r2g">
          <div><label class="lbl">Width (in)</label><input class="inp" type="number" value="${l.sw}" step="0.125" oninput="updateLayout('sw',this.value)"></div>
          <div><label class="lbl">Length (in)</label><input class="inp" type="number" value="${l.sh}" step="1" oninput="updateLayout('sh',this.value)"></div>
        </div>
        <div class="r2g">
          ${(function(){
            var pm=l.pricing_method||'per_sqft', u=(l.mat_unit||'').toLowerCase();
            if(pm==='per_unit'||pm==='per_sheet'){
              var lbl=(pm==='per_unit'&&u==='m')?'Cost per M ($)':'Cost per sheet ($)';
              return '<div><label class="lbl">'+lbl+'</label><input class="inp" type="number" value="'+(l.mat_cost||0)+'" min="0" step="0.01" oninput="updateLayout(\'mat_cost\',this.value)"></div>';
            }
            return '<div><label class="lbl">Cost per sq ft ($)</label><input class="inp" type="number" value="'+(l.csf||0)+'" min="0" step="0.01" oninput="updateLayout(\'csf\',this.value)"></div>';
          })()}
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
      <div class="stat-box"><div class="sl">Layout${lc.rotated?' <span style="color:#378ADD">⟳ rotated</span>':''}</div><div class="sv">${lc.across}×${lc.around}</div><div class="ss">${lc.mode==='sheet'?lc.outs+' per '+(lc.isBoard?'board':'sheet')+' · '+l.qty+' pcs':lc.outs+' positions · '+l.qty+' pcs'}</div></div>
      ${lc.mode==='sheet'
        ? `<div class="stat-box"><div class="sl">${lc.isBoard?'Boards':'Sheets'} used</div><div class="sv">${lc.sheets} ${lc.isBoard?'board':'sheet'}${lc.sheets>1?'s':''}</div><div class="ss">${lc.fits?lc.waste.toFixed(1)+'% waste':'<span style="color:#c0392b">⚠ piece too big for sheet</span>'}</div></div>`
        : `<div class="stat-box"><div class="sl">Length used</div><div class="sv">${(lc.lenUsed/12).toFixed(1)} ft</div><div class="ss">${lc.lenUsed.toFixed(1)}" · ${lc.sheets > 1 ? lc.sheets+' sheets · ' : ''}${lc.waste.toFixed(1)}% waste</div></div>`}
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
  // Piece orientation the calculator chose (may be rotated 90°)
  var uw = lc.puw || (l.fw+l.bleed*2), uh = lc.puh || (l.fh+l.bleed*2);
  var iw = Math.max(0, uw-l.bleed*2), ih = Math.max(0, uh-l.bleed*2); // finished (inner) dims
  // Roll goods → draw the length consumed (a strip). Cut sheets → draw ONE
  // actual sheet (width x length) so a 12x18 shows as 12x18, not a long strip.
  var rollish = (l.sh > 200) || /roll|banner|vinyl|fabric|mesh|film|scrim|wallpaper/.test((l.material_category||'').toLowerCase());
  var drawLen, across, down;
  if (rollish) {
    drawLen = lc.lenUsed || l.sh || 1;
    across = lc.across; down = lc.around;                 // full run down the roll
  } else {
    drawLen = l.sh || 1;
    across = Math.max(1, Math.floor((l.sw + l.gut) / (uw + l.gut)));
    down   = Math.max(1, Math.floor((drawLen - l.grip + l.gut) / (uh + l.gut)));  // one sheet
  }
  var ch = Math.min(Math.round(cw * Math.min(drawLen/l.sw, rollish?6:4) / 4), rollish?200:260);
  canvas.width = cw; canvas.height = ch;
  var ctx = canvas.getContext('2d');
  var scale = Math.min((cw-16)/l.sw, (ch-16)/drawLen);
  var ox = (cw-l.sw*scale)/2, oy = 8;
  ctx.fillStyle='#f0efec'; ctx.fillRect(ox,oy,l.sw*scale,drawLen*scale);
  ctx.strokeStyle='#ccc'; ctx.lineWidth=0.5; ctx.strokeRect(ox,oy,l.sw*scale,drawLen*scale);
  if(l.grip>0){ ctx.fillStyle='#FAEEDA'; ctx.fillRect(ox,oy,l.sw*scale,l.grip*scale); }
  var maxD=Math.min(across*down,400), drawn=0;
  outer:for(var row=0;row<down;row++){
    for(var col=0;col<across;col++){
      if(drawn>=maxD)break outer;
      var px=ox+col*(uw+l.gut)*scale, py=oy+l.grip*scale+row*(uh+l.gut)*scale;
      var isWaste = drawn >= (l.qty || 0);
      ctx.fillStyle = isWaste ? '#f5e0e0' : '#EAF3DE';
      ctx.fillRect(px,py,uw*scale,uh*scale);
      ctx.fillStyle = isWaste ? '#e8c0c0' : '#B5D4F4';
      ctx.fillRect(px+l.bleed*scale,py+l.bleed*scale,iw*scale,ih*scale);
      ctx.strokeStyle = isWaste ? '#a32d2d' : '#378ADD'; ctx.lineWidth=0.5; ctx.setLineDash([]); ctx.strokeRect(px+l.bleed*scale,py+l.bleed*scale,iw*scale,ih*scale);
      ctx.strokeStyle = isWaste ? '#a32d2d' : '#639922'; ctx.setLineDash([2,2]); ctx.strokeRect(px,py,uw*scale,uh*scale); ctx.setLineDash([]);
      drawn++;
    }
  }
  if(iw*scale>30){ctx.fillStyle='#0C447C';ctx.font='bold 9px sans-serif';ctx.fillText(iw+'" x '+ih+'"',ox+l.bleed*scale+2,oy+l.grip*scale+l.bleed*scale+10);}
}

window.addProcessTab = function() {
  var name = prompt('Tab name:');
  if (!name) return;
  components[currentCompIdx].processTabs.push({ id: nid(), name: name, items: [] });
  currentCompTab = 'proc_' + (components[currentCompIdx].processTabs.length - 1);
  renderCompEditor();
};

var TAB_LIBRARY_MAP = [
  { match: /pre\s*press|prepress/i, cost_center_kind: 'prepress', label: 'Prepress' },
  { match: /digital/i, cost_center_kind: 'digital', label: 'Digital Press' },
  { match: /post\s*press|lamination/i, cost_center_kind: 'postpress', categories: ['Wide Format / Lamination'], label: 'Postpress / Lamination' },
  { match: /bindery|hardware|install|finishing/i, categories: ['Wide Format / Hardware'], label: 'Hardware' },
  { match: /^press$|^\s*press\s*$|press(?!.*post)/i, cost_center_kind: 'press', label: 'Press mode' }
];

// Wide-format material categories some departments also pick from.
var KIND_CATEGORIES = { postpress: ['Wide Format / Lamination'], bindery: ['Wide Format / Hardware'] };

// Resolve a tab to its cost-center department. Prefer the kind stored on the
// tab (new components mirror departments); fall back to name-matching for
// components saved before departments were linked.
function getTabLibrary(tab) {
  var kind = (tab && typeof tab === 'object') ? tab.kind : null;
  var name = (tab && typeof tab === 'object') ? tab.name : tab;
  if (kind) {
    var lib = { cost_center_kind: kind, label: name };
    if (KIND_CATEGORIES[kind]) lib.categories = KIND_CATEGORIES[kind];
    return lib;
  }
  for (var i = 0; i < TAB_LIBRARY_MAP.length; i++) {
    if (TAB_LIBRARY_MAP[i].match.test(name||'')) return TAB_LIBRARY_MAP[i];
  }
  return null;
}

function buildPickerMaterialOptions(categories) {
  if (!cachedMaterials) return '<option value="">Loading materials…</option>';
  var items = cachedMaterials.filter(function(m){ return categories.indexOf(m.category_name) !== -1; });
  if (!items.length) return '<option value="">No materials</option>';
  var groups = {};
  items.forEach(function(m){ (groups[m.category_name] = groups[m.category_name] || []).push(m); });
  var html = '<option value="">— Select material —</option>';
  Object.keys(groups).sort().forEach(function(cat){
    html += '<optgroup label="' + escHtml(cat) + '">';
    groups[cat].forEach(function(m){
      var label = (m.sku ? m.sku + ' — ' : '') + (m.name || '');
      var price = m.cost ? ' · $' + Number(m.cost).toFixed(4) + (m.unit ? '/' + escHtml(m.unit) : '') : '';
      if (label.length > 60) label = label.substring(0, 57) + '…';
      html += '<option value="' + m.id + '">' + escHtml(label) + price + '</option>';
    });
    html += '</optgroup>';
  });
  return html;
}

function buildCostCenterDropdownOptions(kind, selectedCcId) {
  if (!cachedCostCenterItems) return '<option value="">Loading…</option>';
  var seen = {};
  var ccs = [];
  cachedCostCenterItems.forEach(function(x){
    if (x.cc_kind !== kind) return;
    if (seen[x.cost_center_id]) return;
    seen[x.cost_center_id] = true;
    ccs.push({ id: x.cost_center_id, code: x.cc_code, name: x.cc_name });
  });
  ccs.sort(function(a,b){ return String(a.code||'').localeCompare(String(b.code||'')); });
  if (!ccs.length) return '<option value="">No cost centers in this department</option>';
  var html = '<option value="">— Select cost center —</option>';
  var isPress = kind === 'press';
  ccs.forEach(function(cc){
    var sel = String(cc.id) === String(selectedCcId) ? ' selected' : '';
    var label = isPress ? cc.name : ((cc.code ? cc.code + ' — ' : '') + cc.name);
    html += '<option value="' + cc.id + '"' + sel + '>' + escHtml(label) + '</option>';
  });
  return html;
}

function buildProcessDropdownOptions(ccId, kind) {
  if (!ccId) return '<option value="">— Pick a cost center first —</option>';
  if (!cachedCostCenterItems) return '<option value="">Loading…</option>';
  var items = cachedCostCenterItems.filter(function(x){ return String(x.cost_center_id) === String(ccId); });
  if (!items.length) return '<option value="">No processes</option>';
  var isPress = kind === 'press';
  var html = '<option value="">— Select process —</option>';
  items.forEach(function(x){
    var label;
    if (isPress) {
      var rate = parseFloat(x.sqft_rate||0) + parseFloat(x.ink_cmyk||0); // base + CMYK $/sqft (white optional)
      var modeLabel = x.name.indexOf(x.cc_name + ' — ') === 0 ? x.name.substring(x.cc_name.length + 3) : x.name;
      label = modeLabel + ' · $' + rate.toFixed(4) + '/sqft';
    } else if (kind === 'digital') {
      label = x.name + ' · $' + (parseFloat(x.unit_cost)||0).toFixed(4) + '/click';
    } else {
      label = (x.code ? x.code + ' — ' : '') + x.name;
    }
    if (label.length > 70) label = label.substring(0, 67) + '…';
    html += '<option value="cc:' + x.id + '">' + escHtml(label) + '</option>';
  });
  return html;
}

window.pickTabCostCenter = function(tabIdx, ccId) {
  var tab = components[currentCompIdx].processTabs[tabIdx];
  tab._pickedCcId = ccId || null;
  renderCompEditor();
};

window.addProcessFromCC = function(tabIdx, value) {
  if (!value) return;
  var tab = components[currentCompIdx].processTabs[tabIdx];
  tab.items.push(newProcessItem());
  var newIdx = tab.items.length - 1;
  applyRowMaterial(tabIdx, newIdx, value);
};

function buildRowMaterialOptions(lib, item) {
  var html = '<option value="">— ' + escHtml(lib.label) + ' —</option>';
  var anyOpts = false;
  // Cost center items section
  if (lib.cost_center_kind) {
    if (!cachedCostCenterItems) {
      html += '<option value="" disabled>Loading cost centers…</option>';
    } else {
      var ccItems = cachedCostCenterItems.filter(function(x){ return x.cc_kind === lib.cost_center_kind; });
      if (ccItems.length) {
        anyOpts = true;
        var isPress = lib.cost_center_kind === 'press';
        // Group by cost center; press uses just cc_name, others use code + name
        var groups = {};
        ccItems.forEach(function(x){
          var key = isPress ? x.cc_name : (x.cc_code + ' — ' + x.cc_name);
          (groups[key] = groups[key] || []).push(x);
        });
        Object.keys(groups).sort().forEach(function(g){
          html += '<optgroup label="' + escHtml(g) + '">';
          groups[g].forEach(function(x){
            var sel = item && item.cost_center_item_id == x.id ? ' selected' : '';
            var label;
            if (isPress) {
              // For press, show "<mode> — $X.XXXX/sqft" (base + CMYK; white optional)
              var rate = parseFloat(x.sqft_rate||0) + parseFloat(x.ink_cmyk||0);
              // Strip the press name from item name to keep just the mode
              var modeLabel = x.name.indexOf(x.cc_name + ' — ') === 0 ? x.name.substring(x.cc_name.length + 3) : x.name;
              label = modeLabel + ' · $' + rate.toFixed(4) + '/sqft';
            } else if (lib.cost_center_kind === 'digital') {
              label = (x.name || '') + ' · $' + (parseFloat(x.unit_cost)||0).toFixed(4) + '/click';
            } else {
              label = (x.code ? x.code + ' — ' : '') + (x.name || '');
            }
            if (label.length > 70) label = label.substring(0, 67) + '…';
            html += '<option value="cc:' + x.id + '"' + sel + '>' + escHtml(label) + '</option>';
          });
          html += '</optgroup>';
        });
      }
    }
  }
  // Material categories section
  if (lib.categories) {
    var selectedMatId = item ? item.material_id : null;
    if (cachedMaterials) {
      var mats = cachedMaterials.filter(function(m){ return lib.categories.indexOf(m.category_name) !== -1; });
      if (mats.length) {
        anyOpts = true;
        // Group by category if more than one category
        var matGroups = {};
        mats.forEach(function(m){
          (matGroups[m.category_name] = matGroups[m.category_name] || []).push(m);
        });
        Object.keys(matGroups).sort().forEach(function(g){
          html += '<optgroup label="' + escHtml(g) + '">';
          matGroups[g].forEach(function(m){
            var sel = String(m.id) === String(selectedMatId) ? ' selected' : '';
            var label = (m.sku ? m.sku + ' — ' : '') + (m.name || '');
            if (label.length > 60) label = label.substring(0, 57) + '…';
            html += '<option value="' + m.id + '"' + sel + '>' + escHtml(label) + '</option>';
          });
          html += '</optgroup>';
        });
      }
    }
  }
  if (!anyOpts && (cachedCostCenterItems !== null || !lib.cost_center_kind)) {
    return '<option value="">No items in ' + escHtml(lib.label) + '</option>';
  }
  return html;
}

window.applyRowMaterial = function(tabIdx, itemIdx, value) {
  var tab = components[currentCompIdx].processTabs[tabIdx];
  var item = tab.items[itemIdx];
  if (!value) {
    item.material_id = null;
    item.preset_id = null;
    item.cost_center_item_id = null;
    renderCompEditor();
    return;
  }
  // Cost-center item path: "cc:<id>" (handles prepress, postpress, AND press)
  if (typeof value === 'string' && value.indexOf('cc:') === 0) {
    var ccid = value.substring(3);
    var cc = (cachedCostCenterItems||[]).find(function(x){ return String(x.id) === String(ccid); });
    if (!cc) return;
    var layout = components[currentCompIdx].layout;
    var pieceQty = parseFloat(layout.qty) || 1;
    var lc = calcLayoutCost(layout);
    var rate = parseFloat(cc.ai_rate) || 0;
    var unitCost = parseFloat(cc.unit_cost) || 0;
    var minsPerUnit = parseFloat(cc.mins_per_unit) || 0;
    var speedPerH = parseFloat(cc.speed_per_h) || 0;
    var setupMin = parseFloat(cc.setup_min) || 0;
    var minCharge = parseFloat(cc.min_charge) || 0;
    var isPress = cc.cc_kind === 'press';
    if (isPress) {
      // New press model: flat Setup + ($/sqft base + CMYK + optional White).
      item.kind = 'press';
      item.cost_center_item_id = cc.id;
      item.material_id = null;
      item.preset_id = null;
      item.name = cc.name;
      item.setup = parseFloat(cc.setup_min) || 0;
      item.sqft_rate = parseFloat(cc.sqft_rate) || 0;
      item.ink_cmyk = parseFloat(cc.ink_cmyk) || 0;
      item.ink_white = parseFloat(cc.ink_white) || 0;
      if (item.white === undefined) item.white = false;
      delete item.method; delete item.rate; delete item.qty; // shed generic fields
      renderCompEditor();
      return;
    }
    if (cc.cc_kind === 'digital') {
      // Digital press: Click $ per sheet + setup (minutes × AI $/hr).
      item.kind = 'digital';
      item.cost_center_item_id = cc.id;
      item.material_id = null;
      item.preset_id = null;
      item.name = cc.name;
      item.click = parseFloat(cc.unit_cost) || 0;
      item.setup_min = parseFloat(cc.setup_min) || 0;
      item.ai_rate = parseFloat(cc.ai_rate) || 0;
      delete item.method; delete item.rate; delete item.qty;
      renderCompEditor();
      return;
    }
    item.cost_center_item_id = cc.id;
    item.material_id = null;
    item.preset_id = null;
    item.name = (cc.code ? cc.code + ' — ' : '') + cc.name;
    // Decide method/rate/qty based on kind and which fields are populated
    if (isPress && speedPerH > 0 && rate > 0) {
      // Press: rate per sqft = $/hr ÷ sqft/hr; qty = printed sqft
      item.method = 'per_sqft';
      item.rate = +(rate / speedPerH).toFixed(4);
      item.qty = lc.sqft > 0 ? Math.ceil(lc.sqft) : 1;
    } else if (speedPerH > 0 && rate > 0) {
      // Postpress run: rate per piece, qty = piece count
      item.method = 'per_unit';
      item.rate = +(rate / speedPerH).toFixed(4);
      item.qty = pieceQty;
    } else if (unitCost > 0) {
      item.method = 'per_unit';
      item.rate = unitCost;
      item.qty = pieceQty;
    } else if (minsPerUnit > 0 && rate > 0) {
      item.method = 'per_hour';
      item.rate = rate;
      item.qty = +(minsPerUnit * pieceQty / 60).toFixed(4);
    } else if (minCharge > 0) {
      item.method = 'flat';
      item.rate = minCharge;
      item.qty = 1;
    } else {
      item.method = 'flat';
      item.rate = 0;
      item.qty = 1;
    }
    // Setup row when setup_min > 0
    if (setupMin > 0 && rate > 0) {
      var setupCost = +(setupMin / 60 * rate).toFixed(2);
      var setupItem = {
        id: nid(),
        name: 'Setup — ' + (cc.code ? cc.code + ' ' : '') + cc.name,
        method: 'flat',
        rate: setupCost,
        qty: 1,
        cost_center_item_id: cc.id,
        is_setup: true
      };
      var prev = tab.items[itemIdx - 1];
      if (!(prev && prev.is_setup && prev.cost_center_item_id === cc.id)) {
        tab.items.splice(itemIdx, 0, setupItem);
      }
    }
    if (minCharge > 0 && (item.rate * item.qty) < minCharge) {
      item.method = 'flat';
      item.rate = minCharge;
      item.qty = 1;
    }
    renderCompEditor();
    return;
  }
  // Material path
  var m = (cachedMaterials||[]).find(function(x){ return String(x.id) === String(value); });
  if (!m) return;
  item.material_id = m.id;
  item.preset_id = null;
  if (!item.name || item.name.trim() === '') {
    var nm = (m.sku ? m.sku + ' — ' : '') + (m.name || '');
    item.name = nm.length > 80 ? nm.substring(0, 77) + '…' : nm;
  }
  var pm = m.pricing_method || 'per_sqft';
  item.method = (pm === 'per_sqft' || pm === 'per_unit' || pm === 'per_hour') ? pm : 'flat';
  item.rate = parseFloat(m.cost) || 0;
  if (!item.qty || item.qty === 1) {
    if (pm === 'per_sqft') {
      var lc2 = calcLayoutCost(components[currentCompIdx].layout);
      if (lc2.sqft > 0) item.qty = Math.ceil(lc2.sqft);
    }
  }
  renderCompEditor();
};

function renderProcessTab(c, idx) {
  var tab = c.processTabs[idx];
  var _lcp = calcLayoutCost(c.layout);
  var sqft = _lcp.sqft || 0;   // job area drives wide-format press pricing
  var sheets = _lcp.sheets || 0; // job sheets drive digital-press click pricing
  var tabTotal = calcTabTotal(tab, sqft, sheets);
  var lib = getTabLibrary(tab);
  var hasLib = lib && (
    (lib.cost_center_kind && cachedCostCenterItems && cachedCostCenterItems.some(function(x){ return x.cc_kind === lib.cost_center_kind; })) ||
    (lib.categories && cachedMaterials && cachedMaterials.some(function(m){ return lib.categories.indexOf(m.category_name) !== -1; }))
  );
  var rowsHTML = '';
  if (tab.items.length) {
    var headerCols = hasLib
      ? '<span>Process name</span><span>Material</span><span>Method</span><span>Rate ($)</span><span>Qty</span><span style="text-align:right">Total</span><span></span>'
      : '<span>Process / item</span><span>Method</span><span>Rate ($)</span><span>Qty</span><span style="text-align:right">Total</span><span></span>';
    var rowCls = hasLib ? 'proc-row proc-row-mat' : 'proc-row';
    var hdrCls = hasLib ? 'proc-header proc-header-mat' : 'proc-header';
    rowsHTML = '<div class="' + hdrCls + '">' + headerCols + '</div>';
    tab.items.forEach(function(item, i) {
      if (item.kind === 'digital') {
        var dTotal = calcItemTotal(item, sqft, sheets);
        var setupC = (parseFloat(item.setup_min||0)/60) * parseFloat(item.ai_rate||0);
        var df = function(label, key, val, w, dec){ return '<div><div class="lbl">' + label + '</div><input type="number" step="' + (dec===0?'1':'0.0001') + '" value="' + (parseFloat(val||0)).toFixed(dec) + '" onchange="updatePressField(' + idx + ',' + i + ',\'' + key + '\',this.value)" style="width:' + w + 'px;text-align:right"></div>'; };
        rowsHTML += '<div style="grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px;padding:9px 10px;border:1px solid #e8e6e2;border-radius:8px;margin-bottom:6px;background:#fafafa">' +
          '<div style="flex:1;min-width:130px"><div class="lbl">Digital press</div><input value="' + escHtml(item.name||'') + '" onchange="updatePressField(' + idx + ',' + i + ',\'name\',this.value)" style="width:100%"></div>' +
          df('Click $', 'click', item.click, 78, 4) +
          df('Setup min', 'setup_min', item.setup_min, 70, 0) +
          df('AI $/hr', 'ai_rate', item.ai_rate, 70, 2) +
          '<div style="text-align:right;min-width:82px"><div class="lbl">Total</div><div class="row-total" style="font-weight:600">$' + dTotal.toFixed(2) + '</div><div style="font-size:10px;color:#aaa">' + (sheets>0 ? ('$'+parseFloat(item.click||0).toFixed(4)+' × '+sheets+' sht'+(setupC>0.005?' + $'+setupC.toFixed(2)+' setup':'')) : 'set layout sheets') + '</div></div>' +
          '<button class="del-btn" onclick="deleteItem(' + idx + ',' + i + ')">×</button>' +
        '</div>';
        return;
      }
      if (item.kind === 'press') {
        var pTotal = calcItemTotal(item, sqft, sheets);
        var perSqft = parseFloat(item.sqft_rate||0) + parseFloat(item.ink_cmyk||0) + (item.white ? parseFloat(item.ink_white||0) : 0);
        var pf = function(label, key, val, w, dec){ return '<div><div class="lbl">' + label + '</div><input type="number" step="' + (dec===2?'0.01':'0.0001') + '" value="' + (parseFloat(val||0)).toFixed(dec) + '" onchange="updatePressField(' + idx + ',' + i + ',\'' + key + '\',this.value)" style="width:' + w + 'px;text-align:right"></div>'; };
        rowsHTML += '<div style="grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px;padding:9px 10px;border:1px solid #e8e6e2;border-radius:8px;margin-bottom:6px;background:#fafafa">' +
          '<div style="flex:1;min-width:130px"><div class="lbl">Press process</div><input value="' + escHtml(item.name||'') + '" onchange="updatePressField(' + idx + ',' + i + ',\'name\',this.value)" style="width:100%"></div>' +
          pf('Setup $', 'setup', item.setup, 70, 2) +
          pf('Sq Ft $', 'sqft_rate', item.sqft_rate, 74, 4) +
          pf('Ink CMYK', 'ink_cmyk', item.ink_cmyk, 74, 4) +
          pf('Ink White', 'ink_white', item.ink_white, 74, 4) +
          '<label style="display:flex;align-items:center;gap:5px;font-size:12px;padding-bottom:6px;white-space:nowrap"><input type="checkbox" ' + (item.white?'checked':'') + ' onchange="updatePressField(' + idx + ',' + i + ',\'white\',this.checked)"> White ink</label>' +
          '<div style="text-align:right;min-width:76px"><div class="lbl">Total</div><div class="row-total" style="font-weight:600">$' + pTotal.toFixed(2) + '</div><div style="font-size:10px;color:#aaa">' + (sqft>0 ? ('$'+perSqft.toFixed(4)+'/sqft × '+Math.round(sqft)) : 'set layout sq ft') + '</div></div>' +
          '<button class="del-btn" onclick="deleteItem(' + idx + ',' + i + ')">×</button>' +
        '</div>';
        return;
      }
      var matCell = hasLib
        ? '<select onchange="applyRowMaterial(' + idx + ',' + i + ',this.value)">' + buildRowMaterialOptions(lib, item) + '</select>'
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
        '<div class="row-total">$' + calcItemTotal(item, sqft, sheets).toFixed(2) + '</div>' +
        '<button class="del-btn" onclick="deleteItem(' + idx + ',' + i + ')">×</button>' +
      '</div>';
    });
  }
  // Cascading Cost Center → Process (and optional Material) picker — mirrors admin's
  // Department > CC > Process structure. Department is the tab itself.
  var ccPickerHTML = '';
  if (lib && (lib.cost_center_kind || lib.categories)) {
    var pickedCcId = tab._pickedCcId || '';
    var deptLabel = lib.cost_center_kind === 'press' ? 'Press' :
                    lib.cost_center_kind === 'digital' ? 'Digital Press' :
                    lib.cost_center_kind === 'prepress' ? 'Prepress' :
                    lib.cost_center_kind === 'postpress' ? 'Postpress' :
                    lib.cost_center_kind === 'bindery' ? 'Bindery' :
                    lib.cost_center_kind === 'outside_services' ? 'Outside Services' : tab.name;
    var inner = '';
    if (lib.cost_center_kind) {
      inner +=
        '<div class="cc-picker-row">' +
          '<div><label class="lbl">Department</label><div class="cc-dept">' + escHtml(deptLabel) + '</div></div>' +
          '<div><label class="lbl">Cost Center</label><select class="inp" onchange="pickTabCostCenter(' + idx + ',this.value)">' + buildCostCenterDropdownOptions(lib.cost_center_kind, pickedCcId) + '</select></div>' +
          '<div><label class="lbl">Process</label><select class="inp" ' + (pickedCcId ? '' : 'disabled') + ' onchange="addProcessFromCC(' + idx + ',this.value);this.value=\'\'">' + buildProcessDropdownOptions(pickedCcId, lib.cost_center_kind) + '</select></div>' +
        '</div>';
    }
    if (lib.categories) {
      var matLabel = lib.categories.join(' / ').replace(/Wide Format \//g, '').trim() || 'Material';
      inner +=
        '<div class="cc-picker-row" style="grid-template-columns:120px 1fr">' +
          '<div><label class="lbl">Material</label><div class="cc-dept" style="background:#0C447C">' + escHtml(matLabel) + '</div></div>' +
          '<div><label class="lbl">Pick material</label><select class="inp" onchange="addProcessFromCC(' + idx + ',this.value);this.value=\'\'">' + buildPickerMaterialOptions(lib.categories) + '</select></div>' +
        '</div>';
    }
    ccPickerHTML = '<div class="cc-picker">' + inner + '</div>';
  }
  document.getElementById('compBody').innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
      '<div style="font-size:14px;font-weight:600;color:#1a1a18">' + escHtml(tab.name) + '</div>' +
      '<span style="font-size:12px;color:#888">Tab total: <strong style="color:#1a1a18">$' + tabTotal.toFixed(2) + '</strong></span>' +
    '</div>' +
    ccPickerHTML +
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
  // name/method are string fields; everything else is numeric.
  item[field] = (field === 'name' || field === 'method') ? val : (parseFloat(val) || 0);
  var total = calcItemTotal(item);
  var rows = document.querySelectorAll('.proc-row');
  if (rows[itemIdx]) {
    var totalEl = rows[itemIdx].querySelector('.row-total');
    if (totalEl) totalEl.textContent = '$' + total.toFixed(2);
  }
  document.getElementById('compEditorTotal').textContent = '$' + calcComponentTotal(components[currentCompIdx]).toFixed(2);
};

// Press-line fields (setup/sqft/inks/white). Full re-render so totals recompute
// against the component's sq ft.
window.updatePressField = function(tabIdx, itemIdx, field, val) {
  var it = components[currentCompIdx].processTabs[tabIdx].items[itemIdx];
  if (field === 'name') it.name = val;
  else if (field === 'white') it.white = (val === true || val === 'true' || val === 'on');
  else it[field] = parseFloat(val) || 0;
  renderCompEditor();
  if (typeof calc === 'function') calc();
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
