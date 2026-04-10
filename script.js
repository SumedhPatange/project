'use strict';

/* ══════════════════════════════════════
   CLASS: Student  (mirrors C++ exactly)
══════════════════════════════════════ */
class Student {
  #regNo; #name; #record;
  constructor(regNo, name) {
    this.#regNo  = regNo.trim().toUpperCase();
    this.#name   = name.trim();
    this.#record = new Map();
  }
  get regNo()  { return this.#regNo; }
  get name()   { return this.#name; }
  markAttendance(date, status) {
    const s = status.toUpperCase();
    if (s !== 'P' && s !== 'A') return false;
    this.#record.set(date, s); return true;
  }
  getAttendance(date) { return this.#record.get(date) ?? null; }
  get totalClasses()  { return this.#record.size; }
  get presentCount()  { let c=0; for (const v of this.#record.values()) if(v==='P') c++; return c; }
  get absentCount()   { return this.totalClasses - this.presentCount; }
  get attendancePct() { return this.totalClasses ? (this.presentCount / this.totalClasses)*100 : 0; }
  get record()        { return new Map(this.#record); }
  toJSON() {
    return { regNo: this.#regNo, name: this.#name, record: Object.fromEntries(this.#record) };
  }
  static fromJSON(o) {
    const s = new Student(o.regNo, o.name);
    for (const [d, v] of Object.entries(o.record)) s.markAttendance(d, v);
    return s;
  }
}

/* ══════════════════════════════════════
   CLASS: AttendanceManager  (mirrors C++)
══════════════════════════════════════ */
class AttendanceManager {
  #students = [];
  #KEY = 'att_mgr_v3';
  constructor() { this.#load(); }

  #idx(regNo) {
    const r = regNo.trim().toUpperCase();
    return this.#students.findIndex(s => s.regNo === r);
  }

  addStudent(regNo, name) {
    if (!regNo || !name) return { ok:false, msg:'Fields cannot be empty.' };
    if (this.#idx(regNo) !== -1) return { ok:false, msg:`${regNo.toUpperCase()} already exists.` };
    this.#students.push(new Student(regNo, name));
    this.#save(); return { ok:true, msg:'Student added.' };
  }
  removeStudent(regNo) {
    const i = this.#idx(regNo);
    if (i === -1) return { ok:false, msg:'Not found.' };
    const n = this.#students[i].name;
    this.#students.splice(i,1); this.#save();
    return { ok:true, msg:`${n} removed.` };
  }
  markAttendance(regNo, date, status) {
    const i = this.#idx(regNo);
    if (i === -1) return { ok:false, msg:'Student not found.' };
    if (!date)    return { ok:false, msg:'Date required.' };
    if (!this.#students[i].markAttendance(date, status))
      return { ok:false, msg:'Status must be P or A.' };
    this.#save(); return { ok:true, msg:`Marked for ${this.#students[i].name}.` };
  }
  markBulk(date, entries) {
    entries.forEach(e => this.markAttendance(e.regNo, date, e.status));
    this.#save(); return { ok:true, msg:'Bulk attendance saved.' };
  }
  getStudent(regNo) { const i=this.#idx(regNo); return i===-1?null:this.#students[i]; }
  get allStudents()  { return [...this.#students]; }
  get studentCount() { return this.#students.length; }
  getBelowThreshold(t=75) { return this.#students.filter(s=>s.attendancePct<t); }
  get classAverage() {
    if (!this.#students.length) return 0;
    return this.#students.reduce((a,s)=>a+s.attendancePct,0)/this.#students.length;
  }
  get totalDays() { return this.#students.length ? Math.max(...this.#students.map(s=>s.totalClasses)) : 0; }
  get allDates()  { const set=new Set(); for(const s of this.#students) for(const[d] of s.record) set.add(d); return [...set].sort(); }

  exportCSV() {
    const dates  = this.allDates;
    const header = ['RegNo','Name',...dates,'Present','Total','Percent'].join(',');
    const rows   = this.#students.map(s => {
      const cells = dates.map(d => s.getAttendance(d)??'-');
      return [s.regNo,`"${s.name}"`,...cells,s.presentCount,s.totalClasses,s.attendancePct.toFixed(1)+'%'].join(',');
    });
    return [header,...rows].join('\n');
  }
  clearAll() { this.#students=[]; localStorage.removeItem(this.#KEY); }

  #save() { localStorage.setItem(this.#KEY, JSON.stringify(this.#students.map(s=>s.toJSON()))); }
  #load() {
    try {
      const raw = localStorage.getItem(this.#KEY);
      if (raw) this.#students = JSON.parse(raw).map(o=>Student.fromJSON(o));
    } catch(e) { console.error(e); }
  }
}

/* ══════════════════════════════════════
   GLOBAL
══════════════════════════════════════ */
const mgr = new AttendanceManager();

/* ── Helpers ── */
function toast(msg, type='info') {
  const c  = document.getElementById('toast-container');
  const el = document.createElement('div');
  const icons = { success:'✓', error:'✕', info:'i' };
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="t-ico">${icons[type]||'i'}</span><span>${msg}</span>`;
  c.appendChild(el);
  setTimeout(()=>el.remove(), 3000);
}

function nav(id) {
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelector(`.nav-btn[data-section="${id}"]`)?.classList.add('active');
  renderMap[id]?.();
}

function confirmModal(html, cb) {
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `
    <div class="modal">
      <div class="modal-head">
        <span class="modal-title">Confirm</span>
        <button class="modal-close" id="mc-x">✕</button>
      </div>
      <p style="color:var(--t2);font-size:13.5px;margin-bottom:22px">${html}</p>
      <div class="btn-row">
        <button class="btn btn-danger" id="mc-ok">Yes, proceed</button>
        <button class="btn btn-ghost"  id="mc-no">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const close = ()=>ov.remove();
  ov.querySelector('#mc-x').onclick  = close;
  ov.querySelector('#mc-no').onclick = close;
  ov.querySelector('#mc-ok').onclick = ()=>{ close(); cb(); };
}

/* ── Progress + badge helper ── */
function pctCell(v) {
  const n   = +v.toFixed(1);
  const cls = n>=75?'safe': n>=60?'warn':'danger';
  const bar = n>=75?'pbar-safe': n>=60?'pbar-warn':'pbar-danger';
  return `
    <div class="pbar-wrap">
      <div class="pbar-track"><div class="pbar-fill ${bar}" style="width:${Math.min(n,100)}%"></div></div>
      <span class="badge badge-${cls}">${n}%</span>
    </div>`;
}

/* ══════════════════════════════════════
   RENDER: Dashboard
══════════════════════════════════════ */
function renderDash() {
  const students = mgr.allStudents;
  const shortage = mgr.getBelowThreshold(75);
  const avg      = mgr.classAverage;

  document.getElementById('stat-total').textContent = mgr.studentCount;
  document.getElementById('stat-short').textContent = shortage.length;
  document.getElementById('stat-avg').textContent   = avg.toFixed(1)+'%';
  document.getElementById('stat-days').textContent  = mgr.totalDays;

  drawRing(avg, students);

  const tbody = document.getElementById('dash-tbody');
  if (!students.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty"><div class="empty-ico">🎓</div><h3>No students yet</h3><p>Add students to get started</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = [...students]
    .sort((a,b)=>b.attendancePct-a.attendancePct)
    .map(s=>`
      <tr>
        <td class="mono">${s.regNo}</td>
        <td style="font-weight:500">${s.name}</td>
        <td class="mono">${s.presentCount}/${s.totalClasses}</td>
        <td>${pctCell(s.attendancePct)}</td>
        <td>${s.attendancePct<75
          ? `<span class="badge badge-danger">⚠ Shortage</span>`
          : `<span class="badge badge-safe">✓ Safe</span>`}</td>
      </tr>`).join('');
}

function drawRing(avg, students) {
  const safe = students.filter(s=>s.attendancePct>=75).length;
  const warn = students.filter(s=>s.attendancePct>=60&&s.attendancePct<75).length;
  const low  = students.filter(s=>s.attendancePct<60).length;
  const total = safe+warn+low||1;
  const cx=75, cy=75, R=58;
  const PI2 = Math.PI*2;

  function arc(start,end,color) {
    if (end-start < 0.001) return '';
    const x1=cx+R*Math.cos(start-Math.PI/2), y1=cy+R*Math.sin(start-Math.PI/2);
    const x2=cx+R*Math.cos(end  -Math.PI/2), y2=cy+R*Math.sin(end  -Math.PI/2);
    const lg = end-start>Math.PI?1:0;
    return `<path d="M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${R},${R} 0 ${lg} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z" fill="${color}"/>`;
  }

  const s1=0, s2=s1+(safe/total)*PI2, s3=s2+(warn/total)*PI2;
  document.getElementById('ring-svg').innerHTML = `
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="#141720" stroke="rgba(255,255,255,.07)" stroke-width="1"/>
    <g opacity=".85">
      ${arc(s1,s2,'#5de0c8')}
      ${arc(s2,s3,'#ffa94d')}
      ${arc(s3,PI2,'#ff7b7b')}
    </g>
    <circle cx="${cx}" cy="${cy}" r="36" fill="#141720"/>
    <text x="${cx}" y="${cy-5}" text-anchor="middle" fill="#f0c96b" font-size="17" font-family="Syne,sans-serif" font-weight="800">${avg.toFixed(0)}%</text>
    <text x="${cx}" y="${cy+11}" text-anchor="middle" fill="#4a5070" font-size="9" font-family="JetBrains Mono,monospace" letter-spacing="1">AVG</text>`;

  document.getElementById('ring-legend').innerHTML = `
    <div class="ring-row"><div class="ring-dot" style="background:#5de0c8"></div><span style="color:var(--t2)">Safe ≥75%</span><span class="ring-val">${safe}</span></div>
    <div class="ring-row"><div class="ring-dot" style="background:#ffa94d"></div><span style="color:var(--t2)">Warning 60–74%</span><span class="ring-val">${warn}</span></div>
    <div class="ring-row"><div class="ring-dot" style="background:#ff7b7b"></div><span style="color:var(--t2)">Shortage &lt;60%</span><span class="ring-val">${low}</span></div>`;
}

/* ══════════════════════════════════════
   RENDER: Students table
══════════════════════════════════════ */
function renderStudents(filter='') {
  const list = mgr.allStudents.filter(s=>
    s.name.toLowerCase().includes(filter.toLowerCase()) ||
    s.regNo.includes(filter.toUpperCase())
  );
  const tbody = document.getElementById('stu-tbody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty"><div class="empty-ico">👥</div><h3>No students found</h3><p>Add students using the form above</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(s=>`
    <tr>
      <td class="mono">${s.regNo}</td>
      <td style="font-weight:500">${s.name}</td>
      <td class="mono">${s.totalClasses}</td>
      <td class="mono">${s.presentCount} / ${s.absentCount}</td>
      <td>${pctCell(s.attendancePct)}</td>
      <td style="display:flex;gap:6px;align-items:center">
        <button class="btn btn-ghost btn-sm" onclick="openDetail('${s.regNo}')">Detail</button>
        <button class="btn btn-danger btn-sm" onclick="delStudent('${s.regNo}')">✕</button>
      </td>
    </tr>`).join('');
}

function delStudent(regNo) {
  const s = mgr.getStudent(regNo);
  confirmModal(`Remove <strong>${s?.name||regNo}</strong> and all records?`, ()=>{
    const r = mgr.removeStudent(regNo);
    toast(r.msg, r.ok?'success':'error');
    renderStudents();
  });
}

/* ── Student Detail Modal ── */
function openDetail(regNo) {
  const s = mgr.getStudent(regNo);
  if (!s) return;
  const dates = [...s.record.keys()].sort();
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `
    <div class="modal" style="max-width:580px">
      <div class="modal-head">
        <span class="modal-title">${s.name}</span>
        <button class="modal-close" id="det-close">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
        ${[['Total',s.totalClasses,'var(--t1)'],['Present',s.presentCount,'var(--teal)'],['Absent',s.absentCount,'var(--rose)']].map(([l,v,c])=>`
          <div style="background:var(--bg3);border:1px solid var(--border1);border-radius:10px;padding:14px 16px">
            <div style="font-family:var(--f-mono);font-size:9px;color:var(--t3);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px">${l}</div>
            <div style="font-family:var(--f-display);font-size:26px;font-weight:800;color:${c}">${v}</div>
          </div>`).join('')}
      </div>
      <div style="margin-bottom:14px">${pctCell(s.attendancePct)}</div>
      <div style="font-family:var(--f-mono);font-size:9px;color:var(--t3);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Date-wise record</div>
      <div class="heat-grid">
        ${dates.length
          ? dates.map(d=>{const v=s.record.get(d); return `<div class="heat-cell heat-${v.toLowerCase()}" data-tip="${d}: ${v}">${v}</div>`;}).join('')
          : '<span style="color:var(--t3);font-size:12px">No records yet</span>'}
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector('#det-close').onclick = ()=>ov.remove();
  ov.addEventListener('click', e=>{ if(e.target===ov) ov.remove(); });
}

/* ══════════════════════════════════════
   RENDER: Mark Single
══════════════════════════════════════ */
function renderMark() {
  const sel = document.getElementById('att-reg');
  sel.innerHTML = `<option value="">— Select Student —</option>` +
    mgr.allStudents.map(s=>`<option value="${s.regNo}">${s.regNo} — ${s.name}</option>`).join('');
  document.getElementById('att-date').value = new Date().toISOString().split('T')[0];
}

/* ══════════════════════════════════════
   RENDER: Bulk
══════════════════════════════════════ */
function renderBulk() {
  const date = document.getElementById('bulk-date').value || new Date().toISOString().split('T')[0];
  document.getElementById('bulk-date').value = date;
  buildBulkTable(date);
}

function buildBulkTable(date) {
  const students = mgr.allStudents;
  const tbody    = document.getElementById('bulk-tbody');
  if (!students.length) {
    tbody.innerHTML = `<tr><td colspan="3"><div class="empty"><div class="empty-ico">📋</div><h3>No students</h3></div></td></tr>`;
    return;
  }
  tbody.innerHTML = students.map(s=>{
    const cur = s.getAttendance(date) || 'P';
    return `<tr>
      <td class="mono">${s.regNo}</td>
      <td style="font-weight:500">${s.name}</td>
      <td>
        <label class="rp-label">
          <input type="radio" name="b-${s.regNo}" value="P" ${cur==='P'?'checked':''}>
          <span class="rp-pill p">P — Present</span>
        </label>
        <label class="rp-label">
          <input type="radio" name="b-${s.regNo}" value="A" ${cur==='A'?'checked':''}>
          <span class="rp-pill a">A — Absent</span>
        </label>
      </td>
    </tr>`;
  }).join('');
}

/* ══════════════════════════════════════
   RENDER: Reports
══════════════════════════════════════ */
function renderReports() {
  const avg = mgr.classAverage;
  const cls = avg>=75?'pbar-safe': avg>=60?'pbar-warn':'pbar-danger';
  document.getElementById('avg-display').innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;margin-top:6px">
      <div class="pbar-track" style="width:220px;height:8px">
        <div class="pbar-fill ${cls}" style="width:${Math.min(avg,100).toFixed(1)}%"></div>
      </div>
      <span style="font-family:var(--f-display);font-size:22px;font-weight:800;color:var(--gold)">${avg.toFixed(1)}%</span>
    </div>
    <p style="font-size:12px;color:var(--t3);margin-top:6px;font-family:var(--f-mono)">Target: 75.0%</p>`;

  const shortage = mgr.getBelowThreshold(75).sort((a,b)=>a.attendancePct-b.attendancePct);
  const tbody    = document.getElementById('short-tbody');

  if (!shortage.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty"><div class="empty-ico">🎉</div><h3>No shortage students!</h3><p>All students have ≥75% attendance</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = shortage.map(s=>{
    const need = Math.max(0, Math.ceil((0.75*s.totalClasses - s.presentCount)/0.25));
    return `<tr>
      <td class="mono">${s.regNo}</td>
      <td style="font-weight:500">${s.name}</td>
      <td class="mono">${s.presentCount}/${s.totalClasses}</td>
      <td>${pctCell(s.attendancePct)}</td>
      <td><span class="badge badge-danger">+${need} classes</span></td>
    </tr>`;
  }).join('');
}

/* ══════════════════════════════════════
   SECTION MAP
══════════════════════════════════════ */
const renderMap = {
  'sec-dash':     renderDash,
  'sec-students': ()=>renderStudents(),
  'sec-mark':     renderMark,
  'sec-bulk':     renderBulk,
  'sec-reports':  renderReports,
};

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', ()=>{

  document.querySelectorAll('.nav-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>nav(btn.dataset.section));
  });

  document.getElementById('btn-add').addEventListener('click', ()=>{
    const reg  = document.getElementById('inp-reg').value.trim();
    const name = document.getElementById('inp-name').value.trim();
    const r = mgr.addStudent(reg, name);
    toast(r.msg, r.ok?'success':'error');
    if (r.ok) {
      document.getElementById('inp-reg').value = '';
      document.getElementById('inp-name').value = '';
      renderStudents();
    }
  });

  document.getElementById('inp-name').addEventListener('keydown', e=>{
    if (e.key==='Enter') document.getElementById('btn-add').click();
  });

  document.getElementById('search').addEventListener('input', e=>renderStudents(e.target.value));

  document.getElementById('btn-mark').addEventListener('click', ()=>{
    const r = mgr.markAttendance(
      document.getElementById('att-reg').value,
      document.getElementById('att-date').value,
      document.getElementById('att-status').value
    );
    toast(r.msg, r.ok?'success':'error');
  });

  document.getElementById('bulk-date').addEventListener('change', e=>buildBulkTable(e.target.value));

  document.getElementById('btn-all-p').addEventListener('click', ()=>{
    mgr.allStudents.forEach(s=>{ const el=document.querySelector(`input[name="b-${s.regNo}"][value="P"]`); if(el) el.checked=true; });
  });
  document.getElementById('btn-all-a').addEventListener('click', ()=>{
    mgr.allStudents.forEach(s=>{ const el=document.querySelector(`input[name="b-${s.regNo}"][value="A"]`); if(el) el.checked=true; });
  });

  document.getElementById('btn-bulk-save').addEventListener('click', ()=>{
    const date = document.getElementById('bulk-date').value;
    if (!date) { toast('Select a date first.','error'); return; }
    const entries = mgr.allStudents.map(s=>{
      const sel = document.querySelector(`input[name="b-${s.regNo}"]:checked`);
      return { regNo:s.regNo, status: sel?sel.value:'P' };
    });
    const r = mgr.markBulk(date, entries);
    toast(r.msg, r.ok?'success':'error');
  });

  document.getElementById('btn-export').addEventListener('click', ()=>{
    if (!mgr.studentCount) { toast('No data to export.','error'); return; }
    const blob = new Blob([mgr.exportCSV()],{type:'text/csv'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href=url; a.download='attendance_report.csv'; a.click();
    URL.revokeObjectURL(url); toast('CSV exported!','success');
  });

  document.getElementById('btn-clear').addEventListener('click', ()=>{
    confirmModal('Clear <strong>ALL</strong> data? This cannot be undone.', ()=>{
      mgr.clearAll(); toast('All data cleared.','info');
      renderDash(); renderStudents();
    });
  });

  nav('sec-dash');
  if (!mgr.studentCount) seedDemo();
});

/* ══════════════════════════════════════
   Demo seed
══════════════════════════════════════ */
function seedDemo() {
  [['22BCE1001','Arjun Sharma'],['22BCE1002','Priya Nair'],
   ['22BCE1003','Karthik Rajan'],['22BCE1004','Ananya Iyer'],
   ['22BCE1005','Rohan Mehta'],['22BCE1006','Sneha Pillai'],
   ['22BCE1007','Vikram Das']].forEach(([r,n])=>mgr.addStudent(r,n));

  const today = new Date();
  const dates = Array.from({length:12},(_,i)=>{
    const d = new Date(today); d.setDate(today.getDate()-i); return d.toISOString().split('T')[0];
  }).reverse();

  const pats = ['PPPPPPPPPPPP','PPPPPPPPPPPA','PPPPPPPPPAPP','PPPPPPAAAPPP','PPPAAAPPPAAP','PPAAAPPPPPPA','PPPPPPPPAPPP'];
  ['22BCE1001','22BCE1002','22BCE1003','22BCE1004','22BCE1005','22BCE1006','22BCE1007'].forEach((r,i)=>{
    dates.forEach((d,j)=>mgr.markAttendance(r,d,(pats[i]||'PPPPPPPPPPPP')[j]||'P'));
  });
  toast('Demo data loaded — explore the system!','info');
}
