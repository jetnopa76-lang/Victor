// Victor — Pricing Library
(function() {

var pricingCategories = [];
var pricingItems = [];

// ── API ───────────────────────────────────────────────────────────
async function pricingApi(method, path, body) {
  var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  var r = await fetch('/api/pricing' + path, opts);
  return r.json();
}

// ── LOAD DATA ─────────────────────────────────────────────────────
async function loadPricingData() {
  try {
    var res = await Promise.all([
      pricingApi('GET', '/categories'),
      pricingApi('GET', '/items')
    ]);
    pricingCategories = res[0];
    pricingItems = res[1];
    return { categories: pricingCategories, items: pricingItems };
  } catch(e) { console.error('Pricing load error:', e); return { categories: [], items: [] }; }
}

window.loadPricingData = loadPricingData;
window.getPricingCategories = function() { return pricingCategories; };
window.getPricingItems = function(categoryId) {
  if (!categoryId) return pricingItems;
  return pricingItems.filter(function(i) { return i.category_id == categoryId; });
};

// ── STYLES ────────────────────────────────────────────────────────
function injectStyles() {
  if (document.getElementById('pricing-styles')) return;
  var s = document.createElement('style');
  s.id = 'pricing-styles';
  s.textContent = `
    #pricingOverlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.45);z-index:9990;display:none;align-items:flex-start;justify-content:center;padding:20px 0;overflow-y:auto}
    #pricingWindow{background:#fff;border-radius:16px;width:95%;max-width:860px;margin:auto;overflow:hidden;position:relative;top:10px}
    .pl-header{background:#1a1a18;color:#fff;padding:12px 16px;display:flex;align-items:center;justify-content:space-between}
    .pl-body{display:grid;grid-template-columns:220px 1fr;min-height:500px}
    .pl-sidebar{background:#f9f8f6;border-right:1px solid #e0ded8;padding:12px}
    .pl-cat{padding:8px 10px;border-radius:8px;cursor:pointer;font-size:13px;color:#666;display:flex;align-items:center;justify-content:space-between;margin-bottom:2px}
    .pl-cat:hover{background:#f0efec}
    .pl-cat.active{background:#1a1a18;color:#fff}
    .pl-cat.active .pl-cat-del{color:#888}
    .pl-cat-del{background:none;border:none;cursor:pointer;color:#ccc;font-size:14px;padding:0 2px;line-height:1}
    .pl-cat-del:hover{color:#a32d2d}
    .pl-main{padding:16px;overflow-y:auto;max-height:70vh}
    .pl-item{display:grid;grid-template-columns:1fr 110px 90px 80px 80px 28px;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #f5f5f3}
    .pl-item input,.pl-item select{height:30px;padding:0 6px;border:1px solid #ddd;border-radius:6px;font-size:12px;width:100%}
    .pl-item-del{background:none;border:none;color:#ccc;cursor:pointer;font-size:16px;padding:0;text-align:center}
    .pl-item-del:hover{color:#a32d2d}
    .pl-hdr{display:grid;grid-template-columns:1fr 110px 90px 80px 80px 28px;gap:8px;padding:4px 0 8px;border-bottom:1px solid #e0ded8;margin-bottom:4px}
    .pl-hdr span{font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:.05em}
    .pl-add-btn{font-size:12px;color:#378ADD;background:none;border:none;cursor:pointer;padding:8px 0;display:block;margin-top:4px}
    .pl-add-cat{width:100%;margin-top:8px;padding:8px;border:2px dashed #ddd;border-radius:8px;background:none;font-size:12px;color:#378ADD;cursor:pointer}
    .pl-add-cat:hover{border-color:#378ADD;background:#E6F1FB}
    .method-badge{display:inline-block;font-size:10px;padding:2px 6px;border-radius:4px;background:#f0efec;color:#666}
  `;
  document.head.appendChild(s);
}

// ── OPEN/CLOSE ────────────────────────────────────────────────────
var activeCatId = null;

window.openPricingLibrary = async function() {
  injectStyles();
  if (!document.getElementById('pricingOverlay')) injectHTML();
  await loadPricingData();
  if (pricingCategories.length) activeCatId = pricingCategories[0].id;
  render();
  document.getElementById('pricingOverlay').style.display = 'flex';
};

window.closePricingLibrary = function() {
  document.getElementById('pricingOverlay').style.display = 'none';
};

// ── HTML SHELL ────────────────────────────────────────────────────
function injectHTML() {
  document.body.insertAdjacentHTML('beforeend', `
    <div id="pricingOverlay">
      <div id="pricingWindow">
        <div class="pl-header">
          <span style="font-size:14px;font-weight:500">Pricing Library</span>
          <button onclick="closePricingLibrary()" style="background:none;border:none;color:#aaa;font-size:20px;cursor:pointer;line-height:1">&times;</button>
        </div>
        <div class="pl-body">
          <div class="pl-sidebar" id="plSidebar"></div>
          <div class="pl-main" id="plMain"></div>
        </div>
      </div>
    </div>
  `);
}

// ── RENDER ────────────────────────────────────────────────────────
function render() {
  renderSidebar();
  renderItems();
}

function renderSidebar() {
  var sb = document.getElementById('plSidebar');
  var cats = pricingCategories.map(function(c) {
    var isActive = c.id == activeCatId;
    return '<div class="pl-cat' + (isActive ? ' active' : '') + '" onclick="switchPricingCat(' + c.id + ')">' +
      '<span>' + c.name + '</span>' +
      '<button class="pl-cat-del" onclick="event.stopPropagation();deletePricingCat(' + c.id + ')">×</button>' +
    '</div>';
  }).join('');
  sb.innerHTML = cats +
    '<button class="pl-add-cat" onclick="addPricingCategory()">+ Add category</button>';
}

function renderItems() {
  var main = document.getElementById('plMain');
  var cat = pricingCategories.find(function(c) { return c.id == activeCatId; });
  if (!cat) { main.innerHTML = '<div style="color:#aaa;font-size:13px;padding:20px">Select a category</div>'; return; }

  var items = pricingItems.filter(function(i) { return i.category_id == activeCatId; });

  var rows = items.map(function(item, idx) {
    return '<div class="pl-item" id="plitem-' + item.id + '">' +
      '<input type="text" value="' + escHtml(item.name) + '" placeholder="Item name" onchange="updatePricingItem(' + item.id + ',\'name\',this.value)">' +
      '<select onchange="updatePricingItem(' + item.id + ',\'method\',this.value)">' +
        '<option value="flat"'      + (item.method==='flat'      ?' selected':'') + '>Flat rate</option>' +
        '<option value="per_unit"'  + (item.method==='per_unit'  ?' selected':'') + '>Per unit</option>' +
        '<option value="per_hour"'  + (item.method==='per_hour'  ?' selected':'') + '>Per hour</option>' +
        '<option value="per_click"' + (item.method==='per_click' ?' selected':'') + '>Per click</option>' +
        '<option value="per_sheet"' + (item.method==='per_sheet' ?' selected':'') + '>Per sheet</option>' +
        '<option value="per_sqft"'  + (item.method==='per_sqft'  ?' selected':'') + '>Per sq ft</option>' +
      '</select>' +
      '<input type="number" value="' + parseFloat(item.rate).toFixed(4) + '" min="0" step="0.0001" placeholder="Rate" onchange="updatePricingItem(' + item.id + ',\'rate\',this.value)" style="text-align:right">' +
      '<input type="number" value="' + parseFloat(item.min_charge).toFixed(2) + '" min="0" step="0.01" placeholder="Min $" onchange="updatePricingItem(' + item.id + ',\'min_charge\',this.value)" style="text-align:right">' +
      '<input type="text" value="' + escHtml(item.unit_label||'') + '" placeholder="Unit label" onchange="updatePricingItem(' + item.id + ',\'unit_label\',this.value)">' +
      '<button class="pl-item-del" onclick="deletePricingItem(' + item.id + ')">×</button>' +
    '</div>';
  }).join('');

  main.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
      '<div style="font-size:15px;font-weight:500">' + cat.name + '</div>' +
      '<div style="font-size:12px;color:#888">' + items.length + ' item' + (items.length !== 1 ? 's' : '') + '</div>' +
    '</div>' +
    (items.length ? '<div class="pl-hdr"><span>Name</span><span>Method</span><span>Rate ($)</span><span>Min ($)</span><span>Unit label</span><span></span></div>' : '') +
    rows +
    '<button class="pl-add-btn" onclick="addPricingItem(' + activeCatId + ')">+ Add item to ' + cat.name + '</button>';
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── ACTIONS ───────────────────────────────────────────────────────
window.switchPricingCat = function(id) {
  activeCatId = id;
  renderSidebar();
  renderItems();
};

window.addPricingCategory = async function() {
  var name = prompt('Category name:');
  if (!name) return;
  var cat = await pricingApi('POST', '/categories', { name: name });
  pricingCategories.push(cat);
  activeCatId = cat.id;
  render();
};

window.deletePricingCat = async function(id) {
  if (!confirm('Delete this category and all its items?')) return;
  await pricingApi('DELETE', '/categories/' + id);
  pricingCategories = pricingCategories.filter(function(c) { return c.id !== id; });
  pricingItems = pricingItems.filter(function(i) { return i.category_id !== id; });
  activeCatId = pricingCategories.length ? pricingCategories[0].id : null;
  render();
};

window.addPricingItem = async function(catId) {
  var item = await pricingApi('POST', '/items', { category_id: catId, name: 'New item', method: 'flat', rate: 0, min_charge: 0, unit_label: '' });
  pricingItems.push(item);
  renderItems();
};

window.updatePricingItem = async function(id, field, val) {
  var body = {};
  body[field] = (field === 'name' || field === 'unit_label') ? val : parseFloat(val) || 0;
  await pricingApi('PUT', '/items/' + id, body);
  var item = pricingItems.find(function(i) { return i.id === id; });
  if (item) item[field] = body[field];
};

window.deletePricingItem = async function(id) {
  if (!confirm('Delete this item?')) return;
  await pricingApi('DELETE', '/items/' + id);
  pricingItems = pricingItems.filter(function(i) { return i.id !== id; });
  renderItems();
};

// ── INJECT PRICING LIBRARY BUTTON ────────────────────────────────
function injectPricingButton() {
  if (document.getElementById('pricingLibBtn')) return;
  // Add to nav area — look for the nav status div
  var nav = document.querySelector('nav');
  if (!nav) return;
  var btn = document.createElement('button');
  btn.id = 'pricingLibBtn';
  btn.className = 'btn';
  btn.textContent = 'Pricing Library';
  btn.style.cssText = 'font-size:12px;padding:4px 12px;margin-right:8px';
  btn.onclick = openPricingLibrary;
  var statusDiv = nav.querySelector('.nav-status');
  if (statusDiv) nav.insertBefore(btn, statusDiv);
  else nav.appendChild(btn);
}

// Init
loadPricingData();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() { injectStyles(); injectPricingButton(); });
} else {
  injectStyles();
  injectPricingButton();
  setTimeout(injectPricingButton, 1000);
}

})();
