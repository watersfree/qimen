// 起局记录 (Cast Records) 与断事笔记存储层
// ---------------------------------------------------------------
// 叶鸿生：想测的那一刻直接起局、不改设置；起好后立即截图保存；
// 同一件事两小时内不要反复起；一天替人预测最好两三局。
// 本模块把“起局”变成一条只读记录：起局时刻、设置快照、完整盘面快照、
// 所问事项与用神、结构化断事笔记、反馈验证与回访提醒。
// 存储沿用旧键 qimen_saved_cases，旧案例在读取时自动迁移，不丢字段。

const STORE_KEY = 'qimen_saved_cases';
export const ENGINE_VERSION = 'qimen-engine-2026.11';

export const NOTE_FIELDS = [
  { key: 'asker', label: '求测人 / 谁在问', hint: '谁问谁就是日干；替他人问时写明关系', rows: 1 },
  { key: 'yongshenReason', label: '用神与取用理由', hint: '用神只是代号，取最符合现实特点的那个', rows: 2 },
  { key: 'readings', label: '逐宫读象', hint: '宫卦 → 天地盘干与克应 → 九星天时地利 → 八门 → 八神 → 长生入墓，单宫内不论生克', rows: 4 },
  { key: 'relations', label: '对宫 · 马星 · 用神关系', hint: '人物用神空看对宫；马星朝对宫方向动；落宫生克、远近、高低', rows: 2 },
  { key: 'judgment', label: '综合判断', hint: '五个用神都读完再思考：现状、原因、走向', rows: 3 },
  { key: 'yingqi', label: '应期', hint: '旬空填实/冲实最常用；取日月年按常理', rows: 1 },
  { key: 'yunchou', label: '运筹方案', hint: '内境 + 外境；五要素：时间、带的东西、放的东西、带的人、要做的事', rows: 3 }
];

export const VERDICTS = ['待验证', '准', '部分准', '不准'];

export function newId() {
  return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function pad2(n) { return String(n).padStart(2, '0'); }

export function formatDateStr(y, m, d, h, mi) {
  return `${y}-${pad2(m)}-${pad2(d)} ${pad2(h)}:${pad2(mi)}`;
}

export function todayStr(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return todayStr(dt);
}

function emptyNotes() {
  const n = {};
  NOTE_FIELDS.forEach(f => { n[f.key] = ''; });
  n.yingqiDate = '';
  n.yunchouDate = '';
  return n;
}

// 旧案例迁移：补齐 id、状态、笔记结构等字段
function migrate(item) {
  if (!item || typeof item !== 'object') return null;
  if (!item.id) item.id = newId();
  if (!item.status) item.status = 'revealed';
  if (!item.source) item.source = 'legacy';
  if (!item.createdAt) item.createdAt = item.revealedAt || new Date().toISOString();
  if (!item.notes || typeof item.notes !== 'object') item.notes = emptyNotes();
  else item.notes = { ...emptyNotes(), ...item.notes };
  if (!Array.isArray(item.feedback)) item.feedback = [];
  if (!Array.isArray(item.followUps)) item.followUps = [];
  if (!item.verdict) item.verdict = '待验证';
  if (typeof item.remark !== 'string') item.remark = item.remark ? String(item.remark) : '';
  if (item.year && (!item.dateStr || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(item.dateStr))) {
    item.dateStr = formatDateStr(item.year, item.month, item.day, item.hour, item.minute);
  }
  return item;
}

export function loadRecords() {
  let raw;
  try {
    raw = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
  } catch (e) {
    console.warn('案例库数据损坏，已忽略', e);
    raw = [];
  }
  if (!Array.isArray(raw)) raw = [];
  // 旧案例缺 id 时迁移结果必须写回，否则每次读取都会得到不同的 id
  const needsPersist = raw.some(item => item && typeof item === 'object' && !item.id);
  const list = raw.map(migrate).filter(Boolean);
  if (needsPersist) saveRecords(list);
  return list;
}

export function saveRecords(list) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    console.warn('保存案例库失败（可能超出浏览器存储空间）', e);
    return false;
  }
}

export function getRecord(id) {
  if (!id) return null;
  return loadRecords().find(r => r.id === id) || null;
}

// 读-改-写单条记录；返回更新后的记录
export function updateRecord(id, mutator) {
  const list = loadRecords();
  const idx = list.findIndex(r => r.id === id);
  if (idx < 0) return null;
  const rec = list[idx];
  mutator(rec);
  rec.updatedAt = new Date().toISOString();
  list[idx] = rec;
  saveRecords(list);
  return rec;
}

export function insertRecord(rec) {
  const list = loadRecords();
  const item = migrate(rec);
  list.unshift(item);
  saveRecords(list);
  return item;
}

export function deleteRecord(id) {
  const list = loadRecords().filter(r => r.id !== id);
  saveRecords(list);
}

// 盘面快照：完整保留排盘引擎输出（纯数据），日后算法修正也能按原盘复原
export function snapshotPan(pan) {
  if (!pan) return null;
  const clone = JSON.parse(JSON.stringify(pan));
  // 这些是界面附加字段，不属于盘面本身
  delete clone.selectedYongShen;
  delete clone.userQuestion;
  delete clone.yongshenNature;
  delete clone.remark;
  return clone;
}

// 盘面指纹：四柱 + 局 + 天盘九星八门八神干，用于检测重算是否与存档一致
export function panFingerprint(pan) {
  if (!pan) return '';
  const p = pan.pillars || {};
  const parts = [p.year, p.month, p.day, p.hour, pan.dun, pan.ju, pan.paipanMethod];
  for (let g = 1; g <= 9; g++) {
    parts.push(
      (pan.tianpanGan || {})[g] || '',
      (pan.tianpanStar || {})[g] || '',
      (pan.tianpanDoor || {})[g] || '',
      (pan.tianpanSpirit || {})[g] || ''
    );
  }
  return parts.join('|');
}

export function settingsOf(state) {
  return {
    year: state.year, month: state.month, day: state.day,
    hour: state.hour, minute: state.minute,
    longitude: state.longitude, cityName: state.cityName,
    dingjuMethod: state.dingjuMethod, paipanMethod: state.paipanMethod, zishi: state.zishi,
    manualJu: state.manualJu ? { ...state.manualJu } : null,
    customPillars: state.customPillars ? { ...state.customPillars } : null
  };
}

// 起局参数是否与记录一致（决定是否仍处于同一局）
// 城市/经度只影响真太阳时显示、不改变盘面，因此不参与比较
export function castParamsOf(src) {
  const s = settingsOf(src);
  delete s.longitude;
  delete s.cityName;
  if (s.manualJu) s.manualJu = { dun: s.manualJu.dun, ju: s.manualJu.ju, type: s.manualJu.type || 'manual' };
  return s;
}

export function sameCastParams(rec, state) {
  if (!rec) return false;
  return JSON.stringify(castParamsOf(rec)) === JSON.stringify(castParamsOf(state));
}

// 根据应期日与运筹执行日生成回访提醒（运筹后第 3 天、第 8 天）
export function rebuildFollowUps(rec) {
  const keepDone = new Map((rec.followUps || []).map(f => [`${f.kind}|${f.date}`, f.done]));
  const list = [];
  const n = rec.notes || {};
  if (n.yingqiDate) {
    list.push({ kind: 'yingqi', date: n.yingqiDate, label: '应期到了：核对是否应验' });
  }
  if (n.yunchouDate) {
    list.push({ kind: 'yc3', date: addDays(n.yunchouDate, 3), label: '运筹第 3 天：对症的化解两三天内见变化' });
    list.push({ kind: 'yc8', date: addDays(n.yunchouDate, 8), label: '运筹第 8 天：七八天毫无动静说明没有对症' });
  }
  rec.followUps = list.map(f => ({ ...f, done: !!keepDone.get(`${f.kind}|${f.date}`) }));
  return rec;
}

export function dueFollowUps(list = loadRecords(), today = todayStr()) {
  const out = [];
  list.forEach(rec => {
    if (rec.status === 'void') return;
    (rec.followUps || []).forEach(f => {
      if (!f.done && f.date <= today) out.push({ rec, f });
    });
  });
  return out;
}

// 当天正式起局（立即起盘）次数
export function castsOnDay(list = loadRecords(), day = todayStr()) {
  return list.filter(r => r.source === 'cast' && r.createdAt && todayStr(new Date(r.createdAt)) === day).length;
}

// 最近一次正式起局
export function lastCast(list = loadRecords(), excludeId = null) {
  return list
    .filter(r => r.source === 'cast' && r.id !== excludeId && r.status !== 'void')
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0] || null;
}

export function exportRecordsJson() {
  return JSON.stringify({
    app: 'qimen-pwa',
    exportedAt: new Date().toISOString(),
    engineVersion: ENGINE_VERSION,
    records: loadRecords()
  }, null, 2);
}

// 导入：按 id 合并，已有的记录保留较新的版本
export function importRecordsJson(text) {
  const data = JSON.parse(text);
  const incoming = Array.isArray(data) ? data : (data && Array.isArray(data.records) ? data.records : null);
  if (!incoming) throw new Error('文件中没有找到案例记录');
  const list = loadRecords();
  const byId = new Map(list.map(r => [r.id, r]));
  let added = 0, updated = 0;
  incoming.map(migrate).filter(Boolean).forEach(r => {
    const cur = byId.get(r.id);
    if (!cur) { byId.set(r.id, r); added++; }
    else if ((r.updatedAt || '') > (cur.updatedAt || '')) { byId.set(r.id, r); updated++; }
  });
  const merged = Array.from(byId.values())
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  saveRecords(merged);
  return { added, updated, total: merged.length };
}

export function statusLabel(rec) {
  if (!rec) return '';
  if (rec.status === 'pending') return '⏳待揭盘';
  if (rec.status === 'void') return '作废';
  const due = (rec.followUps || []).some(f => !f.done && f.date <= todayStr());
  if (due) return '🔔待回访';
  if (rec.verdict && rec.verdict !== '待验证') return `✓${rec.verdict}`;
  return '';
}
