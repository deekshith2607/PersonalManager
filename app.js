/* ---------- utils ---------- */
function pad(n){ return n<10 ? '0'+n : ''+n; }
function fmtDate(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
function prettyDate(dstr){
  const d = new Date(dstr+'T00:00:00');
  return d.toLocaleDateString('en-US',{weekday:'short', month:'short', day:'numeric'});
}
function todayStr(){ return fmtDate(new Date()); }
function tomorrowStr(){ const d=new Date(); d.setDate(d.getDate()+1); return fmtDate(d); }
function uid(){ return Math.random().toString(36).slice(2,10); }

/* ---------- storage (localStorage, works standalone / anywhere hosted) ---------- */
function lsGet(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch(e){
    console.error('localStorage read failed for', key, e);
    return fallback;
  }
}
function lsSet(key, val){
  try{
    localStorage.setItem(key, JSON.stringify(val));
  }catch(e){
    console.error('localStorage write failed for', key, e);
    alert('Could not save — your browser storage may be full or disabled.');
  }
}

/* ---------- state ---------- */
let state = {
  routines: {},      // dateStr -> [ {id,time,text,done} ]
  habits: [],          // [ {id,emoji,name,streak,lastDate} ]
  habitLogs: {},         // dateStr -> { habitId: bool }
  notes: [],              // [ {id,text,ts} ]
  history: []               // [ {date, routineDone, routineTotal, habitDone, habitTotal, reflection} ]
};

function loadAll(){
  state.routines = lsGet('ritual:routines', {});
  state.habits = lsGet('ritual:habits', []);
  state.notes = lsGet('ritual:notes', []);
  state.history = lsGet('ritual:history', []);
  state.habitLogs[todayStr()] = lsGet('ritual:habitlog:'+todayStr(), {});
  state.habitLogs[tomorrowStr()] = lsGet('ritual:habitlog:'+tomorrowStr(), {});
  renderAll();
}

function saveRoutines(){ lsSet('ritual:routines', state.routines); }
function saveHabits(){ lsSet('ritual:habits', state.habits); }
function saveNotes(){ lsSet('ritual:notes', state.notes); }
function saveHistory(){ lsSet('ritual:history', state.history); }
function saveHabitLog(dateStr){ lsSet('ritual:habitlog:'+dateStr, state.habitLogs[dateStr]||{}); }

/* ---------- tabs ---------- */
document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-'+btn.dataset.view).classList.add('active');
  });
});

/* ---------- routine tasks ---------- */
function getTasks(dateStr){
  if(!state.routines[dateStr]) state.routines[dateStr] = [];
  return state.routines[dateStr];
}

function addTask(which){
  const dateStr = which==='today' ? todayStr() : tomorrowStr();
  const timeEl = document.getElementById(which+'Time');
  const textEl = document.getElementById(which+'Text');
  const text = textEl.value.trim();
  if(!text) return;
  const tasks = getTasks(dateStr);
  tasks.push({id:uid(), time:timeEl.value||'--:--', text, done:false});
  tasks.sort((a,b)=> a.time.localeCompare(b.time));
  textEl.value = '';
  saveRoutines();
  renderRoutine('today'); renderRoutine('tomorrow'); updateBottomBar();
}

function toggleTask(dateStr, id){
  const tasks = getTasks(dateStr);
  const t = tasks.find(x=>x.id===id);
  if(t){ t.done = !t.done; }
  saveRoutines();
  renderRoutine('today'); renderRoutine('tomorrow'); updateBottomBar();
}

function deleteTask(dateStr, id){
  state.routines[dateStr] = getTasks(dateStr).filter(x=>x.id!==id);
  saveRoutines();
  renderRoutine('today'); renderRoutine('tomorrow'); updateBottomBar();
}

function renderRoutine(which){
  const dateStr = which==='today' ? todayStr() : tomorrowStr();
  const tasks = getTasks(dateStr);
  const list = document.getElementById(which+'List');
  const countEl = document.getElementById(which+'Count');
  const done = tasks.filter(t=>t.done).length;
  countEl.textContent = done+'/'+tasks.length;
  if(tasks.length===0){
    list.innerHTML = `<div class="empty"><span class="big">${which==='today'?'🌤️':'🌙'}</span>${which==='today'?'Nothing scheduled yet. Add your first task for today.':'Plan ahead — add tasks for tomorrow so future-you wakes up with a plan.'}</div>`;
    return;
  }
  list.innerHTML = tasks.map(t=>`
    <div class="task-row ${t.done?'done':''}">
      <div class="checkbox ${t.done?'checked':''}" onclick="toggleTask('${dateStr}','${t.id}')"></div>
      <div class="task-time">${t.time}</div>
      <div class="task-text">${escapeHtml(t.text)}</div>
      <button class="del-btn" onclick="deleteTask('${dateStr}','${t.id}')">✕</button>
    </div>
  `).join('');
}

/* ---------- habits ---------- */
function addHabit(){
  const emojiEl = document.getElementById('habitEmoji');
  const nameEl = document.getElementById('habitName');
  const name = nameEl.value.trim();
  if(!name) return;
  state.habits.push({id:uid(), emoji: emojiEl.value.trim()||'✨', name, streak:0, lastDate:null});
  emojiEl.value=''; nameEl.value='';
  saveHabits();
  renderHabits(); updateBottomBar();
}

function deleteHabit(id){
  state.habits = state.habits.filter(h=>h.id!==id);
  saveHabits();
  renderHabits(); updateBottomBar();
}

function toggleHabitToday(id){
  const dateStr = todayStr();
  if(!state.habitLogs[dateStr]) state.habitLogs[dateStr] = {};
  state.habitLogs[dateStr][id] = !state.habitLogs[dateStr][id];
  saveHabitLog(dateStr);
  renderHabits(); updateBottomBar();
}

function renderHabits(){
  const grid = document.getElementById('habitGrid');
  const dateStr = todayStr();
  const log = state.habitLogs[dateStr] || {};
  const doneCount = state.habits.filter(h=>log[h.id]).length;
  document.getElementById('habitsCount').textContent = doneCount+'/'+state.habits.length+' today';
  if(state.habits.length===0){
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><span class="big">🌱</span>No habits yet. Add one below — small and repeatable beats big and rare.</div>`;
    return;
  }
  grid.innerHTML = state.habits.map(h=>{
    const isDone = !!log[h.id];
    return `
      <div class="habit-card ${isDone?'done':''}" onclick="toggleHabitToday('${h.id}')">
        <button class="habit-del" onclick="event.stopPropagation(); deleteHabit('${h.id}')">✕</button>
        <span class="habit-emoji">${h.emoji}</span>
        <div class="habit-name">${escapeHtml(h.name)}</div>
        <div class="habit-streak">🔥 ${h.streak} day${h.streak===1?'':'s'}</div>
        <div class="habit-check-mark"></div>
      </div>`;
  }).join('');
}

/* ---------- notes ---------- */
function addNote(){
  const el = document.getElementById('noteInput');
  const text = el.value.trim();
  if(!text) return;
  state.notes.unshift({id:uid(), text, ts:new Date().toISOString()});
  el.value='';
  saveNotes();
  renderNotes();
}
function deleteNote(id){
  state.notes = state.notes.filter(n=>n.id!==id);
  saveNotes();
  renderNotes();
}
function renderNotes(){
  document.getElementById('notesCount').textContent = state.notes.length;
  const list = document.getElementById('notesList');
  if(state.notes.length===0){
    list.innerHTML = `<div class="empty"><span class="big">📝</span>No notes yet.</div>`;
    return;
  }
  list.innerHTML = state.notes.map(n=>{
    const d = new Date(n.ts);
    const ts = d.toLocaleDateString('en-US',{month:'short',day:'numeric'})+' · '+d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
    return `<div class="note-card">
      <div class="ts"><span>${ts}</span><button class="del-btn" onclick="deleteNote('${n.id}')">✕</button></div>
      <div class="body">${escapeHtml(n.text)}</div>
    </div>`;
  }).join('');
}

/* ---------- history ---------- */
function renderHistory(){
  document.getElementById('historyCount').textContent = state.history.length;
  const list = document.getElementById('historyList');
  if(state.history.length===0){
    list.innerHTML = `<div class="empty"><span class="big">📜</span>No closed days yet. Hit "End Day" once you've made progress.</div>`;
    return;
  }
  const rows = [...state.history].reverse();
  list.innerHTML = rows.map(h=>{
    const rPct = h.routineTotal ? Math.round(h.routineDone/h.routineTotal*100) : 0;
    const hPct = h.habitTotal ? Math.round(h.habitDone/h.habitTotal*100) : 0;
    return `<div class="hist-row">
      <div class="hist-date">${prettyDate(h.date)}</div>
      <div class="hist-bars">
        <div>
          <div class="hist-bar-label"><span>Routine</span><span>${h.routineDone}/${h.routineTotal}</span></div>
          <div class="hist-bar-track"><div class="hist-bar-fill" style="width:${rPct}%; background:var(--gold);"></div></div>
        </div>
        <div>
          <div class="hist-bar-label"><span>Habits</span><span>${h.habitDone}/${h.habitTotal}</span></div>
          <div class="hist-bar-track"><div class="hist-bar-fill" style="width:${hPct}%; background:var(--sage);"></div></div>
        </div>
        ${h.reflection ? `<div class="hist-refl">"${escapeHtml(h.reflection)}"</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

/* ---------- bottom bar ---------- */
function updateBottomBar(){
  const dateStr = todayStr();
  const tasks = getTasks(dateStr);
  const doneT = tasks.filter(t=>t.done).length;
  document.getElementById('bbRoutine').textContent = doneT+'/'+tasks.length;
  const log = state.habitLogs[dateStr] || {};
  const doneH = state.habits.filter(h=>log[h.id]).length;
  document.getElementById('bbHabits').textContent = doneH+'/'+state.habits.length;
}

/* ---------- end day ---------- */
function openEndDay(){
  const dateStr = todayStr();
  const tasks = getTasks(dateStr);
  const doneT = tasks.filter(t=>t.done).length;
  const log = state.habitLogs[dateStr] || {};
  const doneH = state.habits.filter(h=>log[h.id]).length;
  const totH = state.habits.length;

  document.getElementById('overlayDateSub').textContent = prettyDate(dateStr);
  document.getElementById('endDayForm').style.display='block';
  document.getElementById('closedMsg').classList.remove('show');
  document.getElementById('reflectionInput').value='';

  const rPct = tasks.length ? Math.round(doneT/tasks.length*100) : 0;
  const hPct = totH ? Math.round(doneH/totH*100) : 0;
  const circumference = 264;
  const ringRoutine = document.getElementById('ringRoutine');
  const ringHabits = document.getElementById('ringHabits');
  ringRoutine.style.transition = 'none';
  ringHabits.style.transition = 'none';
  ringRoutine.style.strokeDashoffset = circumference;
  ringHabits.style.strokeDashoffset = circumference;
  // force reflow so the reset takes effect before animating
  void ringRoutine.offsetWidth;

  setTimeout(()=>{
    ringRoutine.style.transition = 'stroke-dashoffset 1s ease';
    ringHabits.style.transition = 'stroke-dashoffset 1s ease';
    ringRoutine.style.strokeDashoffset = circumference - (circumference*rPct/100);
    ringHabits.style.strokeDashoffset = circumference - (circumference*hPct/100);
  }, 80);
  document.getElementById('ringRoutinePct').textContent = rPct+'%';
  document.getElementById('ringHabitsPct').textContent = hPct+'%';

  document.getElementById('endDayOverlay').classList.add('show');
}

function closeOverlay(){
  document.getElementById('endDayOverlay').classList.remove('show');
}

function confirmEndDay(){
  const dateStr = todayStr();
  const tasks = getTasks(dateStr);
  const doneT = tasks.filter(t=>t.done).length;
  const log = state.habitLogs[dateStr] || {};
  const reflection = document.getElementById('reflectionInput').value.trim();

  // update habit streaks
  state.habits.forEach(h=>{
    if(log[h.id]){
      if(h.lastDate !== dateStr){ h.streak = (h.streak||0)+1; h.lastDate = dateStr; }
    } else {
      h.streak = 0; h.lastDate = h.lastDate===dateStr ? h.lastDate : null;
    }
  });
  saveHabits();

  const entry = {
    date: dateStr, routineDone: doneT, routineTotal: tasks.length,
    habitDone: state.habits.filter(h=>log[h.id]).length, habitTotal: state.habits.length,
    reflection
  };
  // replace existing entry for same date if re-closing
  state.history = state.history.filter(h=>h.date!==dateStr);
  state.history.push(entry);
  saveHistory();

  renderHabits(); renderHistory(); updateBottomBar();

  document.getElementById('endDayForm').style.display='none';
  const msg = document.getElementById('closedMsg');
  msg.classList.add('show');
  document.getElementById('closedSummary').textContent =
    `Routine ${entry.routineDone}/${entry.routineTotal} · Habits ${entry.habitDone}/${entry.habitTotal}. Rest well.`;
}

/* ---------- misc ---------- */
function escapeHtml(s){
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function renderAll(){
  renderRoutine('today');
  renderRoutine('tomorrow');
  renderHabits();
  renderNotes();
  renderHistory();
  updateBottomBar();
}

function initDateDisplay(){
  const now = new Date();
  document.getElementById('dateDisplay').innerHTML =
    now.toLocaleDateString('en-US',{weekday:'long'})+'<br><b>'+now.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})+'</b>';
}

initDateDisplay();
loadAll();
