(() => {
/* ---------- categories & rules ---------- */
const CATS = [
  { k: "會議記錄", v: "--c-meeting", re: /會議|開會|meeting|議程|與會|決議|討論|週會|例會|簡報|家長會|座談/i },
  { k: "工作", v: "--c-work", re: /客戶|專案|報告|提案|主管|老闆|同事|KPI|業務|合約|報價|上線|公司/i },
  { k: "待辦", v: "--c-todo", re: /待辦|todo|要做|記得|截止|deadline|提醒|\[ \]|□/i },
  { k: "學習", v: "--c-learn", re: /學習|課程|讀書|書摘|文章|教學|研究|心得|作業|考試|英文|單字|數學|老師|學校/i },
  { k: "想法", v: "--c-idea", re: /想法|點子|靈感|idea|構想|或許可以|如果能/i },
  { k: "私人", v: "--c-private", re: /日記|心情|感覺|私人|健康|情緒|開心|難過|生氣/i },
  { k: "生活", v: "--c-life", re: /購物|要買|買|餐廳|旅行|預約|醫院|看診|繳費|帳單|搬家|晚餐|週末/i },
  { k: "其他", v: "--c-other", re: null },
];
const CAT_KEYS = CATS.map(c => c.k);
const catVar = k => `var(${(CATS.find(c => c.k === k) || CATS[CATS.length - 1]).v})`;
const AUTO_ARCHIVE_DAYS = 30;
const TPL = {
  meeting: () => { const d = new Date(); return `會議：\n日期：${d.getMonth() + 1}/${d.getDate()}\n與會：\n重點：\n- \n決議：\n- \n待辦：\n- [ ] ` },
  todo: () => "待辦\n- [ ] \n- [ ] \n- [ ] ",
  shop: () => "購物清單\n- [ ] \n- [ ] ",
};
const $ = id => document.getElementById(id);
const state = { notes: [], members: [], me: null, tab: "inbox", scope: "all", q: "", filter: null, openId: null, ready: false, membersReady: false, shared: false };
let store = null;

function lsGet(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }
function lsDel(k) { try { localStorage.removeItem(k) } catch {} }

/* ---------- storage: Google Sheet via Apps Script, cached on this phone ----------
   Writes land in the local cache at once and queue for the server, so the notebook
   opens instantly and keeps working without signal. */
const API = window.SUISHOU_API;
function setSync(s, text) { const el = $("sync"); el.dataset.s = s; el.querySelector("span").textContent = text }
function apiStore(key, onBadKey) {
  const cache = lsGet("sn-cache", { notes: {}, members: {} });
  let queue = lsGet("sn-queue", []);
  const subs = {};
  const emit = col => subs[col] && subs[col](Object.entries(cache[col]).map(([id, d]) => ({ id, ...d })));
  const persist = () => { lsSet("sn-cache", cache); lsSet("sn-queue", queue) };
  async function call(body) {
    const r = await fetch(API, { method: "POST", body: JSON.stringify({ key, ...body }) });
    const j = await r.json();
    if (!j.ok) { const e = new Error(j.error); e.code = j.error; throw e }
    return j;
  }
  function enqueue(op) {
    const id = op.note?.id || op.member?.id || op.id;
    queue = queue.filter(o => (o.note?.id || o.member?.id || o.id) !== id || o.op !== op.op);
    queue.push(op); persist(); flushSoon();
  }
  let flushing = false, flushT = null;
  function flushSoon() { clearTimeout(flushT); flushT = setTimeout(flush, 400) }
  async function flush() {
    if (flushing || !queue.length) return; flushing = true;
    const ops = queue.slice(); setSync("busy", "儲存中");
    try {
      await call({ action: "batch", ops });
      queue = queue.filter(o => !ops.includes(o)); persist();
      setSync("ok", "已同步");
    } catch (e) {
      if (e.code === "bad_key") onBadKey(); else setSync("offline", `離線，${queue.length} 則待上傳`);
    } finally { flushing = false }
    if (queue.length) flushSoon();
  }
  async function refresh() {
    if (queue.length) await flush();
    if (queue.length) return;
    try {
      const j = await call({ action: "load" });
      if (queue.length) return;
      cache.notes = Object.fromEntries(j.notes.map(({ id, ...d }) => [id, d]));
      cache.members = Object.fromEntries(j.members.map(({ id, ...d }) => [id, d]));
      if (j.folderUrl) lsSet("sn-folder", j.folderUrl);
      persist(); emit("members"); emit("notes"); setSync("ok", "已同步");
      return true;
    } catch (e) {
      if (e.code === "bad_key") { onBadKey(); throw e }
      setSync("offline", "離線中，先用手機裡的資料");
      return false;
    }
  }
  const toOp = (col, id, d) => col === "notes"
    ? { op: "saveNote", note: { id, ...d, authorName: member(d.author)?.name || "" } }
    : { op: "saveMember", member: { id, ...d } };
  const api = {
    hasCache: Object.keys(cache.members).length > 0,
    newId: () => "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    sub(col, fn) { subs[col] = fn; emit(col) },
    async set(col, id, d) { cache[col][id] = d; emit(col); enqueue(toOp(col, id, d)) },
    async update(col, id, p) { return api.set(col, id, { ...cache[col][id], ...p }) },
    async remove(col, id) { delete cache[col][id]; emit(col); if (col === "notes") enqueue({ op: "deleteNote", id }) },
    refresh, flush, call,
  };
  return api;
}

/* ---------- auto tagging (built-in rules) ---------- */
function hashtags(t) { return [...new Set((t.match(/#([^\s#，。,.!?！？、]+)/g) || []).map(x => x.slice(1)))] }
function firstLine(t) { const l = t.trim().split("\n").find(x => x.trim()) || ""; return l.replace(/^#+\s*/, "").replace(/[:：]\s*$/, "").slice(0, 24) }
function analyze(text) {
  const hit = CATS.find(c => c.re && c.re.test(text));
  const kw = []; for (const c of CATS) if (c.re) { const m = text.match(c.re); if (m && !/[\[□]/.test(m[0])) kw.push(m[0].toLowerCase()) }
  const actions = []; const people = [];
  for (const line of text.split("\n")) {
    const a = line.match(/^\s*(?:[-*]\s*\[\s?\]|□|☐|TODO[:：]?|待辦[:：])\s*(.+)$/i); if (a && a[1].trim()) actions.push({ t: a[1].trim(), done: false });
    const d = line.match(/^\s*[-*]\s*\[x\]\s*(.+)$/i); if (d) actions.push({ t: d[1].trim(), done: true });
    const p = line.match(/^\s*(?:與會|出席|參加|人員)[:：]\s*(.+)$/); if (p) people.push(...p[1].split(/[、,，\s]+/).filter(Boolean));
  }
  let title = firstLine(text);
  if (/^(會議|待辦|購物清單)$/.test(title)) {
    const second = text.trim().split("\n").map(s => s.replace(/^[-*]\s*(\[.\])?\s*/, "").replace(/^[^:：]+[:：]\s*/, "").trim()).find((s, i) => i > 0 && s);
    if (second) title = `${title}：${second.slice(0, 16)}`;
  }
  return { title: title || "未命名筆記", category: hit ? hit.k : "其他",
    tags: [...new Set([...hashtags(text), ...kw])].slice(0, 5), summary: "", actions, people: [...new Set(people)].slice(0, 12) };
}
const folderOf = (cat, ts) => { const d = new Date(ts); return `${cat}/${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` };

/* ---------- family password (once per phone) ---------- */
$("setupBear").innerHTML = MONSTERS.bear.svg;
$("keyForm").addEventListener("submit", async e => {
  e.preventDefault();
  const key = $("keyIn").value.trim(); if (!key) return;
  if (!API) { $("keyMsg").textContent = "筆記本還沒連上 Google，請先完成設定（config.js）。"; return }
  $("keyGo").disabled = true; $("keyMsg").textContent = "";
  const s = apiStore(key, () => {});
  try {
    await s.call({ action: "load" });
    lsSet("sn-key", key); start(key);
  } catch (err) {
    $("keyMsg").textContent = err.code === "bad_key" ? "密碼不對，再試一次。" : "連不上，請確認有網路再試一次。";
  } finally { $("keyGo").disabled = false }
});
function badKey() {
  lsDel("sn-key"); store = null; state.me = null;
  $("keyMsg").textContent = "家庭密碼改過了，請輸入新的密碼。"; showView();
}
$("forget").addEventListener("click", () => {
  lsDel("sn-key"); lsDel("sn-me"); lsDel("sn-cache"); lsDel("sn-queue"); store = null; state.me = null; state.members = []; state.notes = []; showView();
});

/* ---------- who's writing ---------- */
const member = id => state.members.find(m => m.id === id);
const meM = () => member(state.me);
async function hashPin(pin, salt) {
  const s = salt + ":" + pin;
  try { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("") }
  catch { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return "x" + h.toString(16) }
}
let pickMonster = "bear", pinFor = null, switching = false;
function renderPicker() {
  const used = new Set(state.members.map(m => m.monster));
  if (used.has(pickMonster)) pickMonster = MKEYS.find(k => !used.has(k)) || pickMonster;
  $("picker").innerHTML = MKEYS.map(k => `<button data-monster="${k}" aria-pressed="${k === pickMonster}" aria-label="${MONSTERS[k].name}" title="${MONSTERS[k].name}">${mSvg(k)}</button>`).join("");
}
function renderLogin() {
  const waiting = !state.membersReady || (state.me && !meM());
  $("addOpen").hidden = waiting || !$("addBox").hidden;
  if (waiting) { $("loginHint").textContent = "正在打開筆記本…"; $("tiles").innerHTML = ""; return }
  const ms = [...state.members].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  $("loginHint").textContent = ms.length ? "點自己的小怪獸開始寫。" : "還沒有家人。先新增自己，選一隻小怪獸當頭像。";
  $("tiles").innerHTML = ms.map(m => `<button class="sticker tile" data-member="${esc(m.id)}">${mSvg(m.monster)}<b>${esc(m.name)}</b><small>${m.pinHash ? "有 PIN" : MONSTERS[m.monster]?.name || ""}</small></button>`).join("");
  if (!ms.length && $("addBox").hidden) openAdd();
}
function openAdd() { $("addBox").hidden = false; $("addOpen").hidden = true; $("pinBox").hidden = true; renderPicker(); setTimeout(() => $("addName").focus(), 30) }
$("addOpen").addEventListener("click", openAdd);
$("addCancel").addEventListener("click", () => { $("addBox").hidden = true; $("addOpen").hidden = false });
$("picker").addEventListener("click", e => { const b = e.target.closest("[data-monster]"); if (!b) return; pickMonster = b.dataset.monster; renderPicker() });
$("addGo").addEventListener("click", async () => {
  const name = $("addName").value.trim(), pin = $("addPin").value;
  if (!name) return $("addMsg").textContent = "請填名字。";
  if (pin && !/^\d{4}$/.test(pin)) return $("addMsg").textContent = "PIN 要 4 位數字，或留空。";
  if (state.members.some(m => m.name === name)) return $("addMsg").textContent = "已經有同名的家人了。";
  const id = "m" + Date.now().toString(36), d = { name, monster: pickMonster, createdAt: Date.now(), updatedAt: Date.now() };
  if (pin) { d.pinSalt = Math.random().toString(36).slice(2); d.pinHash = await hashPin(pin, d.pinSalt) }
  await store.set("members", id, d);
  $("addName").value = ""; $("addPin").value = ""; $("addMsg").textContent = ""; $("addBox").hidden = true; $("addOpen").hidden = false;
  enter(id);
});
$("tiles").addEventListener("click", e => {
  const t = e.target.closest("[data-member]"); if (!t) return; const m = member(t.dataset.member);
  if (!m.pinHash) return enter(m.id);
  pinFor = m.id; $("pinTitle").textContent = `${m.name}，輸入 PIN`; $("pinMsg").textContent = ""; $("pinIn").value = "";
  $("pinBox").hidden = false; $("addBox").hidden = true; setTimeout(() => $("pinIn").focus(), 30);
});
async function checkPin() {
  const m = member(pinFor); if (!m) return;
  if ((await hashPin($("pinIn").value, m.pinSalt)) === m.pinHash) { $("pinBox").hidden = true; enter(m.id) }
  else { $("pinMsg").textContent = "PIN 不對，再試一次。"; $("pinIn").value = "" }
}
$("pinGo").addEventListener("click", checkPin);
$("pinForm").addEventListener("submit", e => { e.preventDefault(); checkPin() });
$("pinIn").addEventListener("input", e => { if (e.target.value.length === 4) checkPin() });
$("pinCancel").addEventListener("click", () => { $("pinBox").hidden = true; pinFor = null });
function enter(id) { state.me = id; switching = false; lsSet("sn-me", id); state.scope = "all"; showView(); onDraft() }
$("meBtn").addEventListener("click", () => { closeSheet(); switching = true; state.me = null; showView() });
function showView() {
  const hasKey = !!store, m = hasKey && meM();
  $("vSetup").hidden = hasKey; $("vLogin").hidden = !hasKey || !!m; $("vBook").hidden = !m; $("meBtn").hidden = !m; $("sync").hidden = !hasKey;
  if (m) { $("meBtn").innerHTML = `${mSvg(m.monster)}<span>${esc(m.name)}</span>`; $("sub").textContent = `${m.name} 的筆記・點頭像換人` }
  else $("sub").textContent = "全家人的小怪獸筆記本";
  if (m) render(); else if (hasKey) renderLogin();
}

/* ---------- capture ---------- */
const draft = $("draft");
draft.value = lsGet("sn-draft", "");
function onDraft() {
  $("saveBtn").disabled = !draft.value.trim() || !store || !state.me;
  draft.style.height = "auto"; draft.style.height = Math.max(130, draft.scrollHeight + 2) + "px";
  lsSet("sn-draft", draft.value);
}
draft.addEventListener("input", onDraft);
draft.addEventListener("keydown", e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveDraft() } });
document.querySelector(".quick").addEventListener("click", e => {
  const b = e.target.closest("[data-tpl]"); if (!b) return;
  draft.value = (draft.value.trim() ? draft.value.trimEnd() + "\n\n" : "") + TPL[b.dataset.tpl]();
  draft.focus(); draft.setSelectionRange(draft.value.length, draft.value.length); onDraft();
});
function setVis(shared) { state.shared = shared; $("visMe").setAttribute("aria-pressed", String(!shared)); $("visFam").setAttribute("aria-pressed", String(shared)) }
$("visMe").addEventListener("click", () => setVis(false)); $("visFam").addEventListener("click", () => setVis(true));
$("saveBtn").addEventListener("click", saveDraft);
async function saveDraft() {
  const text = draft.value.trim(); if (!text || !store || !state.me) return;
  const id = store.newId(), now = Date.now(), r = analyze(text);
  await store.set("notes", id, { ...r, text, author: state.me, shared: state.shared, folder: folderOf(r.category, now),
    archived: false, createdAt: now, updatedAt: now });
  draft.value = ""; onDraft(); cheer();
  if (state.tab !== "inbox") selectTab("inbox");
}
function cheer() { const m = $("mascot"); m.classList.remove("happy"); void m.getBoundingClientRect(); m.classList.add("happy") }

/* ---------- rendering ---------- */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function hl(s) { s = esc(s); const q = state.q.trim(); if (!q) return s;
  return s.replace(new RegExp(esc(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), m => `<mark>${m}</mark>`) }
const pad = n => String(n).padStart(2, "0");
const hhmm = ts => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}` };
const WD = "日一二三四五六";
function dayLabel(ts) {
  const d = new Date(ts), t = new Date(); t.setHours(0, 0, 0, 0);
  const diff = Math.round((t - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  if (diff === 0) return "今天"; if (diff === 1) return "昨天";
  return `${d.getFullYear() !== t.getFullYear() ? d.getFullYear() + "年" : ""}${d.getMonth() + 1}月${d.getDate()}日 週${WD[d.getDay()]}`;
}
const canSee = n => n.author === state.me || n.shared || !n.author;
const visibleNotes = () => state.notes.filter(canSee);
const inScope = n => state.scope === "all" || (state.scope === "mine" ? n.author === state.me : n.author !== state.me);
function allTags(list) { const c = {}; for (const n of list) for (const t of n.tags || []) c[t] = (c[t] || 0) + 1; return Object.entries(c).sort((a, b) => b[1] - a[1]) }
function noteCard(n, withDate) {
  const a = member(n.author), snippet = n.summary || (n.text || "").replace(/\s+/g, " ").slice(0, 140), acts = n.actions || [];
  return `<button class="sticker note" data-id="${esc(n.id)}" style="--cat:${catVar(n.category)}">
    ${mSvg(a ? a.monster : "bear", "av")}
    <span class="body">
      <span class="t">${hl(n.title || "未命名筆記")}</span>
      <span class="meta"><span class="cat">${esc(n.category)}</span>
        <span>${a ? esc(a.name) + "・" : ""}${withDate ? dayLabel(n.createdAt) + " " : ""}${hhmm(n.createdAt)}</span>
        ${n.author === state.me ? (n.shared ? `<span class="lock">全家看</span>` : `<span class="lock">只有我</span>`) : ""}
        ${acts.length ? `<span>待辦 ${acts.filter(x => x.done).length}/${acts.length}</span>` : ""}</span>
      <span class="snip">${hl(snippet)}</span>
      ${(n.tags || []).length ? `<span class="tags">${n.tags.map(t => `<span class="tag">${hl(t)}</span>`).join("")}</span>` : ""}
    </span></button>`;
}
function byDay(list) {
  const groups = []; let cur = null;
  for (const n of list) { const l = dayLabel(n.createdAt); if (!cur || cur.l !== l) groups.push(cur = { l, items: [] }); cur.items.push(n) }
  return groups.map(g => `<div class="group"><div class="day">${esc(g.l)}</div>${g.items.map(n => noteCard(n)).join("")}</div>`).join("");
}
function matches(n) {
  const q = state.q.trim().toLowerCase();
  if (q && ![n.title, n.text, n.summary, ...(n.tags || []), ...(n.people || []), n.category, member(n.author)?.name].join("\n").toLowerCase().includes(q)) return false;
  if (state.filter?.type === "cat" && n.category !== state.filter.v) return false;
  if (state.filter?.type === "tag" && !(n.tags || []).includes(state.filter.v)) return false;
  return true;
}
const empty = (b, s, k = "bear") => `<div class="empty">${mSvg(k)}<b>${b}</b><span>${s}</span></div>`;
function render() {
  if (!meM()) return;
  const notes = visibleNotes().filter(inScope);
  const inbox = notes.filter(n => !n.archived), arch = notes.filter(n => n.archived);
  $("n-inbox").textContent = inbox.length || ""; $("n-archive").textContent = arch.length || "";
  document.querySelectorAll("[data-scope]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.scope === state.scope)));
  const f = $("filter");
  if (state.filter) { f.hidden = false; f.innerHTML = `<span>篩選：${state.filter.type === "tag" ? "#" : ""}${esc(state.filter.v)}</span><button id="clearF">清除 ×</button>` } else f.hidden = true;
  const folder = lsGet("sn-folder", "");
  $("folderLink").innerHTML = folder ? `<a href="${esc(folder)}" target="_blank" rel="noopener">在 Google 雲端硬碟打開資料夾</a>（只有設定者的帳號打得開）` : "";
  const v = $("view");
  if (!state.ready) { v.innerHTML = empty("正在翻開筆記本", "稍等一下下。"); return }
  if (state.q.trim() || state.filter) {
    const res = notes.filter(matches);
    v.innerHTML = res.length ? `<div class="group"><div class="day">找到 ${res.length} 則</div>${res.map(n => noteCard(n, true)).join("")}</div>` : empty("找不到耶", "換個關鍵字，或清除篩選。", "orange");
    return;
  }
  if (state.tab === "inbox") {
    v.innerHTML = inbox.length ? byDay(inbox) : empty("收件匣空空的", `在上面的筆記紙寫第一則，按「存起來」。藍藍熊會幫你下標題、貼標籤、放進對應資料夾；超過 ${AUTO_ARCHIVE_DAYS} 天的筆記會自動收進「歸檔」。`);
  } else if (state.tab === "cats") {
    const c = {}; for (const n of notes) c[n.category] = (c[n.category] || 0) + 1;
    v.innerHTML = `<div class="cats">${CATS.map(x => `<button class="sticker catcard" data-cat="${x.k}" style="--cat:var(${x.v})"><i></i><b>${x.k}</b><span>${c[x.k] || 0} 則</span></button>`).join("")}</div>`;
  } else if (state.tab === "tags") {
    const t = allTags(notes);
    v.innerHTML = t.length ? `<div class="cloud">${t.map(([k, n]) => `<button class="tag" data-tag="${esc(k)}">${esc(k)}<small>${n}</small></button>`).join("")}</div>`
      : empty("還沒有標籤", "存筆記後會自動貼上標籤，你也可以直接在內文打 #標籤。", "green");
  } else {
    const groups = {}; for (const n of arch) (groups[n.folder || folderOf(n.category, n.createdAt)] ||= []).push(n);
    const keys = Object.keys(groups).sort((a, b) => (b.split("/")[1] || "").localeCompare(a.split("/")[1] || "") || a.localeCompare(b));
    v.innerHTML = keys.length ? keys.map(k => { const [cat, ym] = k.split("/");
      return `<details class="sticker folder" style="--cat:${catVar(cat)}"><summary><i></i><span class="path">${esc(cat)}<em>${esc(ym)}</em></span><span class="cnt">${groups[k].length} 則</span></summary>
        <div class="list">${groups[k].map(n => noteCard(n, true)).join("")}</div></details>` }).join("")
      : empty("歸檔還是空的", `筆記裡按「歸檔」，或等筆記超過 ${AUTO_ARCHIVE_DAYS} 天，就會照「分類／月份」收進來。`, "pumpkin");
  }
}
document.addEventListener("click", e => {
  const n = e.target.closest(".note"); if (n) return openNote(n.dataset.id);
  const c = e.target.closest("[data-cat]"); if (c) { state.filter = { type: "cat", v: c.dataset.cat }; return render() }
  const t = e.target.closest("[data-tag]"); if (t) { state.filter = { type: "tag", v: t.dataset.tag }; return render() }
  const s = e.target.closest("[data-scope]"); if (s) { state.scope = s.dataset.scope; return render() }
  if (e.target.id === "clearF") { state.filter = null; render() }
});
function selectTab(tab) {
  state.tab = tab; state.filter = null;
  document.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
  render();
}
document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => selectTab(b.dataset.tab)));
$("q").addEventListener("input", e => { state.q = e.target.value; render() });

/* ---------- one note ---------- */
$("eCat").innerHTML = CAT_KEYS.map(k => `<option>${k}</option>`).join("");
const cur = () => state.notes.find(n => n.id === state.openId);
let editTimer = null;
function openNote(id) {
  state.openId = id; const n = cur(); if (!n) return;
  $("eTitle").value = n.title || ""; $("eText").value = n.text || "";
  fillSheet(n); $("sheet").hidden = false; document.body.style.overflow = "hidden";
}
function fillSheet(n) {
  const mine = n.author === state.me || !n.author, a = member(n.author);
  $("eTitle").readOnly = $("eText").readOnly = !mine; $("eCat").disabled = !mine;
  $("byline").innerHTML = `${mSvg(a ? a.monster : "bear")}<span>${a ? esc(a.name) : "範例"} 寫於 ${dayLabel(n.createdAt)} ${hhmm(n.createdAt)}${mine ? "" : "・家人分享（只能看）"}</span>`;
  $("eCat").value = CAT_KEYS.includes(n.category) ? n.category : "其他";
  $("savedAt").textContent = `${dayLabel(n.updatedAt || n.createdAt)} ${hhmm(n.updatedAt || n.createdAt)} 更新`;
  $("eTags").innerHTML = (n.tags || []).map((t, i) => `<span class="tag">${esc(t)}${mine ? `<button data-rm="${i}" aria-label="移除標籤 ${esc(t)}">×</button>` : ""}</span>`).join("")
    + (mine ? `<input id="tagIn" placeholder="+ 新標籤" enterkeyhint="done">` : "");
  const s = $("eSummary"), acts = n.actions || [], ppl = n.people || [];
  s.hidden = !(n.summary || acts.length || ppl.length);
  s.innerHTML = (n.summary ? `<div><b>摘要</b>　${esc(n.summary)}</div>` : "") + (ppl.length ? `<div><b>相關的人</b>　${ppl.map(esc).join("、")}</div>` : "")
    + (acts.length ? `<div><b>待辦</b></div><ul>${acts.map((x, i) => `<li class="${x.done ? "done" : ""}"><label><input type="checkbox" data-act="${i}" ${x.done ? "checked" : ""} ${mine ? "" : "disabled"}><span>${esc(x.t)}</span></label></li>`).join("")}</ul>` : "");
  $("visBtn").textContent = n.shared ? "改成只有我" : "改成全家看";
  $("archBtn").textContent = n.archived ? "移回收件匣" : "歸檔";
  ["visBtn", "reAi", "archBtn", "delBtn"].forEach(id => $(id).hidden = !mine);
}
function closeSheet() { flushEdit(); $("sheet").hidden = true; document.body.style.overflow = ""; state.openId = null; disarm() }
$("back").addEventListener("click", closeSheet);
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("sheet").hidden) closeSheet() });
const upd = (n, p) => store.update("notes", n.id, { ...p, updatedAt: Date.now() });
function queueEdit() { clearTimeout(editTimer); editTimer = setTimeout(flushEdit, 800) }
async function flushEdit() {
  clearTimeout(editTimer); const n = cur(); if (!n || $("eText").readOnly) return;
  const title = $("eTitle").value.trim(), text = $("eText").value;
  if (title === (n.title || "") && text === n.text) return;
  await upd(n, { title, text, tags: [...new Set([...(n.tags || []), ...hashtags(text)])] });
}
$("eTitle").addEventListener("input", queueEdit); $("eText").addEventListener("input", queueEdit);
$("eCat").addEventListener("change", e => { const n = cur(); upd(n, { category: e.target.value, folder: folderOf(e.target.value, n.createdAt) }) });
$("eTags").addEventListener("click", e => { const i = e.target.dataset.rm; if (i === undefined) return; const n = cur(); upd(n, { tags: n.tags.filter((_, j) => j !== +i) }) });
$("eTags").addEventListener("keydown", e => {
  if (e.target.id !== "tagIn" || e.key !== "Enter" || e.isComposing) return;
  e.preventDefault(); const v = e.target.value.trim().replace(/^#/, ""), n = cur(); if (!v) return;
  if (!(n.tags || []).includes(v)) upd(n, { tags: [...(n.tags || []), v] }); e.target.value = "";
});
$("eSummary").addEventListener("change", e => { const i = e.target.dataset.act; if (i === undefined) return; const n = cur();
  upd(n, { actions: n.actions.map((x, j) => j === +i ? { ...x, done: e.target.checked } : x) }) });
$("visBtn").addEventListener("click", () => { const n = cur(); upd(n, { shared: !n.shared }); toast(n.shared ? "改成只有你看得到" : "全家都看得到了") });
$("reAi").addEventListener("click", async () => {
  await flushEdit(); const n = cur(); if (!n) return; const r = analyze($("eText").value);
  await upd(n, { ...r, folder: folderOf(r.category, n.createdAt) }); toast("重新整理好了");
});
$("archBtn").addEventListener("click", async () => {
  const n = cur(); await upd(n, { archived: !n.archived, pinned: !!n.archived });
  toast(n.archived ? "移回收件匣了" : `收進 ${n.folder || folderOf(n.category, n.createdAt)}`); closeSheet();
});
$("copyBtn").addEventListener("click", () => { const n = cur(); const txt = `${n.title}\n\n${$("eText").value}`;
  navigator.clipboard.writeText(txt).then(() => toast("複製好了"), () => { $("eText").select(); toast("已選取內文，請手動複製") }) });
let delArmed = null;
$("delBtn").addEventListener("click", async () => {
  if (!delArmed) { $("delBtn").classList.add("armed"); $("delBtn").textContent = "再按一次刪除"; delArmed = setTimeout(disarm, 3000); return }
  disarm(); const id = state.openId; closeSheet(); await store.remove("notes", id); toast("刪掉了");
});
function disarm() { clearTimeout(delArmed); delArmed = null; $("delBtn").classList.remove("armed"); $("delBtn").textContent = "刪除" }

/* ---------- download a copy ---------- */
$("expJson").addEventListener("click", () => {
  const notes = visibleNotes().map(n => ({ ...n, author: member(n.author)?.name || "" }));
  const blob = new Blob([JSON.stringify({ app: "隨手筆記", version: 2, exportedAt: new Date().toISOString(), notes }, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "suishou-notes.json";
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
});

let toastT = null;
function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2600) }

/* ---------- boot ---------- */
$("mascot").innerHTML = MONSTERS.bear.svg;
let autoArchived = false;
async function autoArchive() {
  if (autoArchived || !state.me) return; autoArchived = true;
  const cutoff = Date.now() - AUTO_ARCHIVE_DAYS * 864e5;
  for (const n of state.notes.filter(n => n.author === state.me && !n.archived && !n.pinned && n.createdAt < cutoff))
    await store.update("notes", n.id, { archived: true, updatedAt: Date.now() });
}
function onNotes(list) {
  state.notes = list.sort((a, b) => b.createdAt - a.createdAt); state.ready = true;
  render(); if (state.openId) { const n = cur(); n ? fillSheet(n) : closeSheet() }
}
function onMembers(list) {
  state.members = list;
  if (state.me && !member(state.me) && state.membersReady) state.me = null;
  if (!state.me && !switching && list.length === 1 && !list[0].pinHash) state.me = list[0].id;
  showView(); onDraft();
}
async function start(key) {
  store = apiStore(key, badKey);
  state.me = lsGet("sn-me", null);
  state.membersReady = store.hasCache;
  store.sub("members", onMembers);
  store.sub("notes", onNotes);
  showView();
  const ok = await store.refresh().catch(() => false);
  if (ok) { state.membersReady = true; onMembers(state.members); autoArchive() }
  else if (!store) return;
  else { state.membersReady = true; showView() }
}
let lastRefresh = Date.now();
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && store && Date.now() - lastRefresh > 15000) { lastRefresh = Date.now(); store.refresh().catch(() => {}) }
  if (document.visibilityState === "hidden" && store) store.flush();
});
setInterval(() => { if (store && document.visibilityState === "visible" && $("sheet").hidden) { lastRefresh = Date.now(); store.refresh().catch(() => {}) } }, 60000);
window.addEventListener("online", () => store && store.refresh().catch(() => {}));

const savedKey = lsGet("sn-key", null);
if (savedKey && API) start(savedKey); else showView();
})();
