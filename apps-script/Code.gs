/**
 * 隨手筆記 — Google 雲端資料庫
 *
 * 筆記存在你 Google 雲端硬碟的「隨手筆記」資料夾：
 *   - 隨手筆記資料庫（試算表）：筆記與家人名單
 *   - suishou-notes.json：每次有變動就自動更新，給其他工具讀取
 *   - 隨手筆記.md：同一份內容的 Markdown 版
 *
 * 安裝：
 *   1. 把下面 FAMILY_KEY 改成你們家的密碼（家人第一次打開筆記本時要輸入）
 *   2. 上方選單選函式 setup，按「執行」，依畫面授權
 *   3. 右上「部署」→「新增部署作業」→ 類型「網頁應用程式」
 *      執行身分：我　／　誰可以存取：所有人 → 部署，複製網址
 */
const FAMILY_KEY = '請改成你們家的密碼';
const FOLDER_NAME = '隨手筆記';
const NOTE_HEAD = ['id', '作者', '標題', '分類', '資料夾', '標籤', '內容', '建立時間', '更新時間', '全家看', '已歸檔', 'json'];
const MEM_HEAD = ['id', '名字', '頭像', 'json'];

function setup() {
  const ss = getDb_();
  exportFiles_(ss);
  Logger.log('完成！資料夾：' + getFolder_().getUrl());
}

function doGet() {
  return json_({ ok: true, app: '隨手筆記' });
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad_request' }); }
  if (!req || req.key !== FAMILY_KEY) return json_({ ok: false, error: 'bad_key' });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = getDb_();
    if (req.action === 'load') {
      return json_({ ok: true, notes: readAll_(ss.getSheetByName('notes')), members: readAll_(ss.getSheetByName('members')),
        folderUrl: getFolder_().getUrl() });
    }
    if (req.action === 'batch') {
      let notesChanged = false;
      (req.ops || []).forEach(function (op) {
        if (op.op === 'saveNote' && op.note && op.note.id) { upsert_(ss.getSheetByName('notes'), op.note, noteRow_); notesChanged = true; }
        if (op.op === 'deleteNote' && op.id) { remove_(ss.getSheetByName('notes'), op.id); notesChanged = true; }
        if (op.op === 'saveMember' && op.member && op.member.id) upsert_(ss.getSheetByName('members'), op.member, memRow_);
      });
      if (notesChanged) exportFiles_(ss);
      return json_({ ok: true });
    }
    return json_({ ok: false, error: 'unknown_action' });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- storage ---------- */
function getFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
  props.setProperty('FOLDER_ID', folder.getId());
  return folder;
}

function getDb_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SHEET_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) {} }
  const ss = SpreadsheetApp.create('隨手筆記資料庫');
  DriveApp.getFileById(ss.getId()).moveTo(getFolder_());
  const notes = ss.getSheets()[0];
  notes.setName('notes');
  notes.appendRow(NOTE_HEAD);
  notes.setFrozenRows(1);
  notes.hideColumns(NOTE_HEAD.length);
  const members = ss.insertSheet('members');
  members.appendRow(MEM_HEAD);
  members.setFrozenRows(1);
  members.hideColumns(MEM_HEAD.length);
  props.setProperty('SHEET_ID', ss.getId());
  return ss;
}

function readAll_(sheet) {
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const width = sheet.getLastColumn();
  return sheet.getRange(2, width, last - 1, 1).getValues()
    .map(function (r) { try { return JSON.parse(r[0]); } catch (e) { return null; } })
    .filter(function (x) { return x && x.id; });
}

function findRow_(sheet, id) {
  const last = sheet.getLastRow();
  if (last < 2) return -1;
  const ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

function upsert_(sheet, obj, toRow) {
  const row = findRow_(sheet, obj.id);
  if (row > 0) {
    // keep the newer copy when two phones edited the same note offline
    const width = sheet.getLastColumn();
    try {
      const old = JSON.parse(sheet.getRange(row, width).getValue());
      if (old && old.updatedAt && obj.updatedAt && old.updatedAt > obj.updatedAt) return;
    } catch (e) {}
    const values = toRow(obj);
    sheet.getRange(row, 1, 1, values.length).setValues([values]);
  } else {
    sheet.appendRow(toRow(obj));
  }
}

function remove_(sheet, id) {
  const row = findRow_(sheet, id);
  if (row > 0) sheet.deleteRow(row);
}

function noteRow_(n) {
  return [n.id, n.authorName || n.author || '', n.title || '', n.category || '', n.folder || '', (n.tags || []).join('、'),
    n.text || '', n.createdAt ? new Date(n.createdAt) : '', n.updatedAt ? new Date(n.updatedAt) : '',
    n.shared ? '是' : '', n.archived ? '是' : '', JSON.stringify(n)];
}

function memRow_(m) {
  return [m.id, m.name || '', m.monster || '', JSON.stringify(m)];
}

/* ---------- files other tools can read ---------- */
function exportFiles_(ss) {
  const members = {};
  readAll_(ss.getSheetByName('members')).forEach(function (m) { members[m.id] = m.name; });
  const notes = readAll_(ss.getSheetByName('notes'))
    .sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); })
    .map(function (n) {
      return { id: n.id, title: n.title || '', text: n.text || '', category: n.category || '', folder: n.folder || '',
        tags: n.tags || [], actions: n.actions || [], people: n.people || [], author: members[n.author] || '',
        shared: !!n.shared, archived: !!n.archived,
        createdAt: n.createdAt ? new Date(n.createdAt).toISOString() : '', updatedAt: n.updatedAt ? new Date(n.updatedAt).toISOString() : '' };
    });
  writeFile_('suishou-notes.json', JSON.stringify({ app: '隨手筆記', version: 2, exportedAt: new Date().toISOString(), notes: notes }, null, 2), 'application/json');
  const md = notes.map(function (n) {
    return '---\nid: ' + n.id + '\ntitle: ' + JSON.stringify(n.title) + '\ncategory: ' + n.category + '\nfolder: ' + n.folder +
      '\ntags: [' + n.tags.map(function (t) { return JSON.stringify(t); }).join(', ') + ']\nauthor: ' + n.author +
      '\ncreated: ' + n.createdAt + '\narchived: ' + n.archived + '\n---\n\n# ' + n.title + '\n\n' + n.text + '\n' +
      (n.actions.length ? '\n## 待辦\n' + n.actions.map(function (a) { return '- [' + (a.done ? 'x' : ' ') + '] ' + a.t; }).join('\n') + '\n' : '');
  }).join('\n\n');
  writeFile_('隨手筆記.md', md, 'text/markdown');
}

function writeFile_(name, content, mime) {
  const folder = getFolder_();
  const it = folder.getFilesByName(name);
  if (it.hasNext()) it.next().setContent(content);
  else folder.createFile(name, content, mime);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
