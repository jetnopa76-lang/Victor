// Victor — Imposition Calculator
(function() {

const S = 'width:100%;height:32px;padding:0 8px;border:1px solid #ddd;border-radius:7px;font-size:13px';
const LBL = 'font-size:12px;color:#666;display:block;margin-bottom:3px';
const SEC = 'font-size:11px;font-weight:500;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;margin-top:12px;padding-top:12px;border-top:1px solid #f0efec';
const G2 = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px';
const G4 = 'display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px';
const STAT = 'background:#f9f8f6;border-radius:8px;padding:10px';
const STATH = 'font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px';

const modalHTML = `<div id="impositionModal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.45);z-index:9999;align-items:flex-start;justify-content:center;padding:20px 0;overflow-y:auto">
<div style="background:#fff;border-radius:16px;padding:1.5rem;max-width:720px;width:95%;margin:auto">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
<h3 style="font-size:16px;font-weight:500;margin:0">Build job</h3>
<button onclick="closeImp()" style="border:none;background:none;font-size:22px;cursor:pointer;color:#888;line-height:1">&times;</button>
</div>
<div style="font-size:11px;font-weight:500;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Job specs</div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">
<div><label style="${LBL}">Job type</label><select id="ip_jt" onchange="ipToggleType()" style="${S}"><option value="digital">Digital printing</option><option value="wide">Wide format</option></select></div>
<div id="ip_ps_wrap"><label style="${LBL}">Paper size</label><select id="ip_ps" style="${S}"><option value="letter">Letter 8.5x11"</option><option value="legal">Legal 8.5x14"</option><option value="tabloid">Tabloid 11x17"</option><option value="a4">A4</option></select></div>
<div id="ip_cm_wrap"><label style="${LBL}">Color mode</label><select id="ip_cm" style="${S}"><option value="color">Full color</option><option value="bw">Black &amp; white</option></select></div>
</div>
<div style="${G2}">
<div><label style="${LBL}">Quantity</label><input type="number" id="ip_qty" value="500" min="1" oninput="runImp()" style="${S}"></div>
<div id="ip_sides_wrap"><label style="${LBL}">Sides</label><input type="number" id="ip_sides" value="1" min="1" max="2" style="${S}"></div>
</div>
<div id="ip_stock_wrap" style="margin-bottom:8px"><label style="${LBL}">Stock</label><select id="ip_stock" style="${S}"></select></div>
<div id="ip_media_wrap" style="margin-bottom:8px;display:none"><label style="${LBL}">Media</label><select id="ip_media" style="${S}"></select></div>
<div style="${SEC}">Press sheet</div>
<div style="${G2}">
<div><label style="${LBL}">Width (in)</label><input type="number" id="ip_sw" value="54" step="0.125" oninput="runImp()" style="${S}"></div>
<div><label style="${LBL}">Length (in)</label><input type="number" id="ip_sh" value="1200" step="1" oninput="runImp()" style="${S}"></div>
</div>
<div style="margin-bottom:8px"><label style="${LBL}">Cost per sq ft ($)</label><input type="number" id="ip_csf" value="0.00" min="0" step="0.01" oninput="runImp()" style="${S}"></div>
<div style="${SEC}">Finished trim size</div>
<div style="${G2}">
<div><label style="${LBL}">Width (in)</label><input type="number" id="ip_fw" value="24" step="0.125" oninput="runImp()" style="${S}"></div>
<div><label style="${LBL}">Height (in)</label><input type="number" id="ip_fh" value="36" step="0.125" oninput="runImp()" style="${S}"></div>
</div>
<div style="${SEC}">Imposition parameters</div>
<div style="${G4}">
<div><label style="${LBL}">Bleed (in)</label><input type="number" id="ip_bleed" value="0.125" step="0.0625" oninput="runImp()" style="${S}"></div>
<div><label style="${LBL}">Gripper (in)</label><input type="number" id="ip_grip" value="0.5" step="0.0625" oninput="runImp()" style="${S}"></div>
<div><label style="${LBL}">Gutter (in)</label><input type="number" id="ip_gut" value="0.125" step="0.0625" oninput="runImp()" style="${S}"></div>
<div><label style="${LBL}">Rolls</label><input type="number" id="ip_rolls" value="1" min="1" oninput="runImp()" style="${S}"></div>
</div>
<div style="${G4}">
<div style="${STAT}"><div style="${STATH}">Outs/sheet</div><div style="font-size:22px;font-weight:500" id="ip_r_outs">—</div><div style="font-size:11px;color:#888" id="ip_r_grid">—</div></div>
<div style="${STAT}"><div style="${STATH}">Sheets needed</div><div style="font-size:22px;font-weight:500" id="ip_r_sheets">—</div><div style="font-size:11px;color:#888" id="ip_r_pcs">—</div></div>
<div style="${STAT}"><div style="${STATH}">Waste</div><div style="font-size:22px;font-weight:500" id="ip_r_waste">—</div></div>
<div style="${STAT}"><div style="${STATH}">Substrate cost</div><div style="font-size:22px;font-weight:500" id="ip_r_cost">—</div><div style="font-size:11px;color:#888" id="ip_r_sqft">—</div></div>
</div>
<div style="background:#f9f8f6;border-radius:8px;padding:10px;margin-bottom:12px">
<div style="${STATH};margin-bottom:8px">Sheet layout preview</div>
<canvas id="ip_canvas" style="width:100%;background:#fff;border:1px solid #e0ded8;border-radius:6px;display:block"></canvas>
<div style="display:flex;gap:12px;margin-top:6px;font-size:11px;color:#888">
<span><span style="display:inline-block;width:10px;height:10px;background:#B5D4F4;border:1px solid #378ADD;border-radius:2px;margin-right:3px"></span>Trim</span>
<span><span style="display:inline-block;width:10px;height:10px;background:#EAF3DE;border:1px solid #639922;border-radius:2px;margin-right:3px"></span>Bleed</span>
<span><span style="display:inline-block;width:10px;height:10px;background:#FAEEDA;border:1px solid #EF9F27;border-radius:2px;margin-right:3px"></span>Gripper</span>
</div>
</div>
<div style="display:flex;gap:8px">
<button onclick="applyImp()" style="background:#1a1a18;color:#fff;border:none;border-radius:8px;padding:8px 18px;font-size:13px;font-weight:500;cursor:pointer">Apply to estimate</button>
<button onclick="closeImp()" style="background:transparent;border:1px solid #ddd;border-radius:8px;padding:8px 18px;font-size:13px;cursor:pointer">Close</button>
</div>
</div>
</div>`;

function injectButton() {
  // Button is now injected directly in index.html
}

function injectModal() {
  if (!document.getElementById('impositionModal')) {
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }
}

function populateDropdowns() {
  const stockSel = document.getElementById('stockSel');
  const mediaSel = document.getElementById('mediaSel');
  const ipStock = document.getElementById('ip_stock');
  const ipMedia = document.getElementById('ip_media');
  if (stockSel && ipStock) ipStock.innerHTML = stockSel.innerHTML;
  if (mediaSel && ipMedia) ipMedia.innerHTML = mediaSel.innerHTML;
}

window.ipToggleType = function() {
  const t = document.getElementById('ip_jt').value;
  const isWide = t === 'wide';
  ['ip_ps_wrap','ip_cm_wrap','ip_sides_wrap','ip_stock_wrap'].forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.style.display = isWide ? 'none' : '';
  });
  var mw = document.getElementById('ip_media_wrap');
  if(mw) mw.style.display = isWide ? '' : 'none';
};

window.openImpositionModal = function() {
  injectModal();
  populateDropdowns();
  var jt = document.getElementById('jobType');
  if(jt) { document.getElementById('ip_jt').value = jt.value; ipToggleType(); }
  var ps = document.getElementById('paperSize'); if(ps) document.getElementById('ip_ps').value = ps.value;
  var cm = document.getElementById('colorMode'); if(cm) document.getElementById('ip_cm').value = cm.value;
  var sd = document.getElementById('sides'); if(sd) document.getElementById('ip_sides').value = sd.value;
  var sk = document.getElementById('stockSel'); if(sk) document.getElementById('ip_stock').value = sk.value;
  var md = document.getElementById('mediaSel'); if(md) document.getElementById('ip_media').value = md.value;
  var qty = document.getElementById('qty'), wqty = document.getElementById('wfQty');
  if(qty && qty.value) document.getElementById('ip_qty').value = qty.value;
  else if(wqty && wqty.value) document.getElementById('ip_qty').value = wqty.value;
  var wfW = document.getElementById('wfW'), wfH = document.getElementById('wfH');
  if(wfW && wfW.value) document.getElementById('ip_fw').value = wfW.value;
  if(wfH && wfH.value) document.getElementById('ip_fh').value = wfH.value;
  document.getElementById('impositionModal').style.display = 'flex';
  runImp();
};

window.closeImp = function() {
  var m = document.getElementById('impositionModal');
  if(m) m.style.display = 'none';
};

var _imp = {};

window.runImp = function() {
  var sw    = parseFloat(document.getElementById('ip_sw').value)    || 54;
  var sh    = parseFloat(document.getElementById('ip_sh').value)    || 1200;
  var fw    = parseFloat(document.getElementById('ip_fw').value)    || 24;
  var fh    = parseFloat(document.getElementById('ip_fh').value)    || 36;
  var bleed = parseFloat(document.getElementById('ip_bleed').value) || 0.125;
  var grip  = parseFloat(document.getElementById('ip_grip').value)  || 0.5;
  var gut   = parseFloat(document.getElementById('ip_gut').value)   || 0.125;
  var rolls = parseInt(document.getElementById('ip_rolls').value)   || 1;
  var qty   = parseInt(document.getElementById('ip_qty').value)     || 500;
  var csf   = parseFloat(document.getElementById('ip_csf').value)   || 0;
  var uw = fw + bleed*2, uh = fh + bleed*2;
  var across = Math.max(1, Math.floor((sw + gut) / (uw + gut)));
  var around = Math.max(1, Math.floor((sh - grip + gut) / (uh + gut)));
  var outs = across * around * rolls;
  var sheets = Math.ceil(qty / outs);
  var sqft = (sw/12) * (sh/12) * sheets;
  var cost = sqft * csf;
  var usedW = across*(uw+gut)-gut, usedH = around*(uh+gut)-gut+grip;
  var waste = Math.max(0, Math.min(99, ((sw*sh)-(usedW*usedH))/(sw*sh)*100));
  _imp = {sw,sh,fw,fh,bleed,grip,gut,across,around,outs,sheets,sqft,cost,waste,qty,csf,uw,uh};
  document.getElementById('ip_r_outs').textContent   = outs;
  document.getElementById('ip_r_grid').textContent   = across + ' across × ' + around + ' around';
  document.getElementById('ip_r_sheets').textContent = sheets.toLocaleString();
  document.getElementById('ip_r_pcs').textContent    = (sheets*outs).toLocaleString() + ' total pcs';
  document.getElementById('ip_r_waste').textContent  = waste.toFixed(1) + '%';
  document.getElementById('ip_r_cost').textContent   = '$' + cost.toFixed(2);
  document.getElementById('ip_r_sqft').textContent   = sqft.toFixed(1) + ' sq ft';
  drawImpCanvas(_imp);
};

function drawImpCanvas(r) {
  var c = document.getElementById('ip_canvas'); if(!c) return;
  var cw = c.offsetWidth || 580;
  var ch = Math.min(Math.round(cw * Math.min(r.sh/r.sw, 6) / 4), 260);
  c.width = cw; c.height = ch;
  var ctx = c.getContext('2d');
  var scale = Math.min((cw-16)/r.sw, (ch-16)/r.sh);
  var ox = (cw - r.sw*scale)/2, oy = 8;
  ctx.fillStyle='#f0efec'; ctx.fillRect(ox,oy,r.sw*scale,r.sh*scale);
  ctx.strokeStyle='#ccc'; ctx.lineWidth=0.5; ctx.strokeRect(ox,oy,r.sw*scale,r.sh*scale);
  ctx.fillStyle='#FAEEDA'; ctx.fillRect(ox,oy,r.sw*scale,r.grip*scale);
  var maxD=Math.min(r.across*r.around,200), drawn=0;
  outer:for(var row=0;row<r.around;row++){
    for(var col=0;col<r.across;col++){
      if(drawn>=maxD) break outer;
      var px=ox+col*(r.uw+r.gut)*scale, py=oy+r.grip*scale+row*(r.uh+r.gut)*scale;
      ctx.fillStyle='#EAF3DE'; ctx.fillRect(px,py,r.uw*scale,r.uh*scale);
      ctx.fillStyle='#B5D4F4'; ctx.fillRect(px+r.bleed*scale,py+r.bleed*scale,r.fw*scale,r.fh*scale);
      ctx.strokeStyle='#378ADD'; ctx.lineWidth=0.5; ctx.setLineDash([]); ctx.strokeRect(px+r.bleed*scale,py+r.bleed*scale,r.fw*scale,r.fh*scale);
      ctx.strokeStyle='#639922'; ctx.setLineDash([2,2]); ctx.strokeRect(px,py,r.uw*scale,r.uh*scale); ctx.setLineDash([]);
      drawn++;
    }
  }
  if(r.fw*scale>30){ctx.fillStyle='#0C447C';ctx.font='bold 9px sans-serif';ctx.fillText(r.fw+'" x '+r.fh+'"',ox+r.bleed*scale+2,oy+r.grip*scale+r.bleed*scale+10);}
}

window.applyImp = function() {
  var jt=document.getElementById('jobType'),ipJt=document.getElementById('ip_jt');
  if(jt&&ipJt){jt.value=ipJt.value;if(typeof toggleJobType==='function')toggleJobType();}
  var ps=document.getElementById('paperSize'),ipPs=document.getElementById('ip_ps');if(ps&&ipPs)ps.value=ipPs.value;
  var cm=document.getElementById('colorMode'),ipCm=document.getElementById('ip_cm');if(cm&&ipCm)cm.value=ipCm.value;
  var sd=document.getElementById('sides'),ipSd=document.getElementById('ip_sides');if(sd&&ipSd)sd.value=ipSd.value;
  var sk=document.getElementById('stockSel'),ipSk=document.getElementById('ip_stock');if(sk&&ipSk)sk.value=ipSk.value;
  var md=document.getElementById('mediaSel'),ipMd=document.getElementById('ip_media');if(md&&ipMd)md.value=ipMd.value;
  var qty=document.getElementById('qty'),wqty=document.getElementById('wfQty');
  if(qty)qty.value=_imp.qty;if(wqty)wqty.value=_imp.qty;
  var wfW=document.getElementById('wfW'),wfH=document.getElementById('wfH');
  if(wfW)wfW.value=_imp.fw;if(wfH)wfH.value=_imp.fh;
  window._impSubsCost=_imp.cost;
  closeImp();
  if(typeof calc==='function')calc();
  if(typeof toast==='function')toast('Applied: '+_imp.outs+' outs, '+_imp.sheets+' sheets, $'+_imp.cost.toFixed(2)+' substrate');
};

if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',injectButton);}
else{injectButton();setTimeout(injectButton,1000);}

})();

// Update summary text after applying
function updateSpecsSummary() {
  var el = document.getElementById('jobSpecsText');
  if (!el) return;
  var jt = document.getElementById('ip_jt');
  var qty = document.getElementById('ip_qty');
  var ps = document.getElementById('ip_ps');
  var cm = document.getElementById('ip_cm');
  var fw = document.getElementById('ip_fw');
  var fh = document.getElementById('ip_fh');
  if (!jt) return;
  var type = jt.value === 'wide' ? 'Wide format' : 'Digital';
  var qtyVal = qty ? qty.value : '—';
  var sizeVal = fw && fh ? fw.value + '" × ' + fh.value + '"' : '';
  var extra = jt.value === 'digital' ? (ps ? ps.options[ps.selectedIndex].text : '') + ', ' + (cm ? (cm.value === 'color' ? 'Color' : 'B&W') : '') : sizeVal;
  el.textContent = type + ' · Qty ' + qtyVal + ' · ' + extra;
}
