// 奇门遁甲专业排盘 PWA 交互与应用主控制器 (Application Controller)

import { CITIES_DATA } from './database.js';
import {
  getLunarDate, JIAZI, xunOf, XUN_SHOU_YI,
  kongwangOf, MA_STAR, TIANGAN, DIZHI
} from './calendar.js';
import {
  paipan, getPalaceAnalysis, formatPlainQimen,
  GONG_CN, SEARCH_PRESETS, matchPatternCondition,
  DIPAN_PALACE_INFO, DOOR_HOME, STAR_HOME,
  JIUGONG_MEMORY_DATA, getStarWangshuaiAnalysis,
  DOOR_ORIGINAL_PALACE, DOOR_ORIGINAL_ELEMENT,
  checkGlobalPatterns, getDoorShengkeAnalysis,
  getYingqiXunKongAnalysis, TIANGAN_CHANGSHENG_MAP,
  KE_GAN_MAP, BEI_KE_GAN_MAP, BAGUA_GONG_MAP,
  ESSENCE_KEYWORDS
} from './qimen.js';
import {
  ENGINE_VERSION, NOTE_FIELDS, VERDICTS, newId, formatDateStr, todayStr,
  loadRecords, saveRecords, getRecord, updateRecord, insertRecord, deleteRecord,
  snapshotPan, panFingerprint, settingsOf, sameCastParams, rebuildFollowUps,
  dueFollowUps, castsOnDay, lastCast, exportRecordsJson, importRecordsJson, statusLabel
} from './records.js';
import { buildPaipanSteps, cellLayerContent } from './trace.js';
import { YUNCHOU_PURPOSES, analyzeYunchou, yunchouToText, palaceFactLine } from './yunchou.js';
import {
  YONGSHEN_PRESETS, DEFAULT_YONGSHEN_NATURE, getYongShenNature,
  YONGSHEN_ROLE_MAP as PRESET_ROLE_MAP, DIRECTION_OPTIONS
} from './presets.js';

// 中文数字
const GONG_NUM = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '七', 8: '八', 9: '九' };

// 应用核心状态
const state = {
  // 当前排盘时刻 (默认 2026年10月20日 21时12分，复刻参考案例)
  year: 2026,
  month: 10,
  day: 20,
  hour: 21,
  minute: 12,
  
  // 地理位置 (读取持久化设置)
  province: localStorage.getItem('qimen_province') || '北京',
  cityName: localStorage.getItem('qimen_city') || '北京 天安门',
  longitude: (() => {
    const v = parseFloat(localStorage.getItem('qimen_longitude'));
    return !isNaN(v) ? v : 116.38;
  })(),

  // 算法选项 (读取持久化设置)
  dingjuMethod: localStorage.getItem('qimen_dingju_method') || 'zhirun', // 'zhirun' | 'chaibu' | 'maoshan'
  paipanMethod: localStorage.getItem('qimen_paipan_method') || 'zhuan',  // 'zhuan' | 'fei'
  manualJu: null,         // null (自动) 或 { dun: '阴', ju: 5 }
  customPillars: null,    // null (自动推算) 或 { year: '丙午', month: '戊戌', day: '丁卯', hour: '辛亥' }
  zishi: localStorage.getItem('qimen_zishi') || 'split',         // 'split' | 'merge'
  showDipan: localStorage.getItem('qimen_show_dipan') === '1',       // 切换地盘全息视图 (默认显示天盘)
  selectedDipanGong: 0,                                               // 当前地盘聚焦选中的宫位 (0 表示未选中/收起连线)
  dipanShowShengke: true,                                            // 地盘图例开关：生克连线 (默认开)
  dipanShowDuigong: true,                                            // 地盘图例开关：对宫·马·冲 (默认开)
  dipanShowYuanjin: true,                                            // 地盘图例开关：同侧近/跨太极线远 (默认开)
  kongLookOpposite: localStorage.getItem('qimen_kong_look_opposite') !== '0', // 旬空看对冲宫开关 (默认 true)
  maskWeakened: localStorage.getItem('qimen_mask_weakened') === '1', // 减弱非用神蒙版效果开关 (默认 false)
  autoAnimOnYongshen: localStorage.getItem('qimen_auto_anim_on_yongshen') === '1', // 首次选取用神之后开始动态演盘 (默认 false)
  hasAnimatedOnFirstYS: false, // 当前盘面是否已执行过首次选后动态演盘
  lastPanKey: '',
  yongshenNature: localStorage.getItem('qimen_yongshen_nature') || 'auto', // 'auto' | 'person_object' | 'affair'
  userGenderRole: localStorage.getItem('qimen_user_gender_role') || 'none', // 风水宫身份: 'none' | 'male'(乾) | 'female'(坤) | 'son'(震) | 'daughter'(巽)
  selectedYongShenNatures: {}, // 逐个记录用神性质映射: { '用神名': 'person' | 'matter' | 'object' }

  // UI交互状态 (读取持久化设置)
  selectedGong: 2,        // 默认选中坤二宫
  isSimpleMode: localStorage.getItem('qimen_simple_mode') === '1',
  isGridPickingMode: false, // 盘面手动圈选用神模式 (点击九宫格直接圈选)
  showKeyingDetails: localStorage.getItem('qimen_show_keying_details') !== '0', // 设置总开关：默认展开详细 (值为 '0' 时才为精简)
  keyingOnlyYongShen: false, // 全盘克应速查弹窗中是否过滤只看当前用神
  imageryMode: localStorage.getItem('qimen_imagery_mode') || 'all', // 象意显示模式: 'all' (全部) | 'wu' (物象) | 'ren' (人象)
  currentPan: null,

  // 所问问题与选取用神
  userQuestion: localStorage.getItem('qimen_user_question') || '',
  caseRemark: localStorage.getItem('qimen_case_remark') || '',
  isPendingReveal: false, // 立即起盘防剧透状态 (先取时刻与用神，确认后再揭晓盘面)
  // 当前锁定的起局记录 (立即起盘或读取案例后锁定；改动起局参数需确认并另开新盘)
  activeRecordId: localStorage.getItem('qimen_active_record_id') || null,
  lastReleasedRecordId: null, // 最近一次解除锁定的记录 (报数补起局时关联原局)
  snapshotMismatchWarned: null,
  selectedYongShen: (() => {
    try {
      const raw = localStorage.getItem('qimen_selected_yongshen');
      const manuallyCleared = localStorage.getItem('qimen_zhifu_manually_cleared') === '1';
      if (!raw) return ['值符'];
      const saved = JSON.parse(raw);
      if (Array.isArray(saved)) {
        if (!manuallyCleared && !saved.includes('值符')) {
          saved.unshift('值符');
        }
        return saved;
      }
      return ['值符'];
    } catch {
      return ['值符'];
    }
  })(),
  
  // 万年历当前浏览年月
  calViewYear: 2026,
  calViewMonth: 10,
  palaceModeOverrides: {} // 记录用户针对各宫位手动设定的模式: { [gong]: boolean } (true: 完整模式, false: 精简模式)
};

// 初始化入口
document.addEventListener('DOMContentLoaded', () => {
  // 恢复保存的主题
  const savedTheme = localStorage.getItem('qimen_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);

  // 恢复简洁模式
  if (state.isSimpleMode) {
    document.body.classList.add('simple-mode');
    const btnSimple = document.getElementById('btnToggleSimple');
    if (btnSimple) btnSimple.textContent = '完整模式';
  }

  initServiceWorker();
  initLocationSelectors();
  initDateTimeSelectors();
  initControls();
  initCalendar();
  initPalaceInteractions();
  initCasesStorage();
  initLiveClock();
  initPatternSearch();
  initYongShenModal();
  initManualInputModal();
  initShiganSwitchDelegation();
  initSettingsModal();
  initCaseNotesModal();
  initStepsModal();
  initYunchouModal();
  initDipanLegendToggles();

  window.addEventListener('resize', () => {
    if (state.showDipan && state.currentPan) {
      renderDipanRelations(state.currentPan, state.selectedDipanGong || 0);
    }
  });

  // 刷新/重开时恢复正在进行的起局记录 (含待揭盘状态)，而不是回到默认参考盘
  restoreActiveRecordOnLoad();

  // 首次运行排盘
  executePaipan();
  renderDueBanner();
  window.__qimen_state = state;
  window.__qimen_renderNinePalaces = renderNinePalaces;
  window.__qimen_executePaipan = executePaipan;
  window.__qimen_boardAnimState = boardAnimState;
  window.__qimen_playAnimStep = playAnimStep;
});

// 十干克应按键切换全局事件委托
function initShiganSwitchDelegation() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.shigan-switch-btn');
    if (!btn) return;
    const row = btn.closest('tr');
    if (!row) return;
    const group = btn.closest('.shigan-btn-group');
    if (!group) return;
    const idx = parseInt(btn.dataset.idx, 10);

    group.querySelectorAll('.shigan-switch-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (row.dataset.shiganItems) {
      try {
        const items = JSON.parse(row.dataset.shiganItems);
        const item = items[idx];
        if (item) {
          const descEl = row.querySelector('.shigan-desc-display');
          if (descEl) descEl.textContent = item.content;
          const statusEl = row.querySelector('.shigan-live-status');
          if (statusEl) {
            statusEl.textContent = item.status;
            statusEl.className = `merged-status-badge ${item.statusClass} shigan-live-status`;
          }
          const classicEl = row.querySelector('.shigan-classic-detail-text');
          const classicWrap = row.querySelector('.shigan-classic-fold-wrap');
          if (classicEl) {
            classicEl.textContent = item.classicText || '';
          }
          if (classicWrap) {
            classicWrap.style.display = item.classicText ? 'block' : 'none';
          }
        }
      } catch (err) {
        console.warn('Switch shigan item error:', err);
      }
    }
  });
}

// 1. Service Worker 注册 (PWA 离线支持与自动热更新)
function initServiceWorker() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('[PWA] Service Worker Registered successfully:', reg.scope);
        // 主动探测远端版本更新
        if (typeof reg.update === 'function') {
          reg.update().catch(() => {});
        }
      })
      .catch(err => console.warn('[PWA] Service Worker registration failed:', err));

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }

  // 绑定设置弹窗中的“检查更新”按钮
  const btnForceUpdate = document.getElementById('btnForceUpdateApp');
  if (btnForceUpdate) {
    btnForceUpdate.addEventListener('click', async () => {
      btnForceUpdate.textContent = '更新中...';
      try {
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
        }
      } catch (e) {
        console.warn('[PWA] Clear cache error:', e);
      }
      window.location.href = window.location.pathname + '?v=' + Date.now();
    });
  }
}

// 2. 全国省市与经度下拉联动初始化
function initLocationSelectors() {
  const selProv = document.getElementById('selProvince');
  const selCity = document.getElementById('selCity');
  const numLon = document.getElementById('numLongitude');

  selProv.innerHTML = '';
  CITIES_DATA.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.province;
    opt.textContent = p.province;
    if (p.province === (state.province || '北京')) opt.selected = true;
    selProv.appendChild(opt);
  });

  function populateCities(provName, selectCityName) {
    selCity.innerHTML = '';
    const provObj = CITIES_DATA.find(p => p.province === provName) || CITIES_DATA[0];
    provObj.cities.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = c.name;
      opt.dataset.lon = c.lon;
      selCity.appendChild(opt);
    });
    if (selectCityName) {
      const cleanCity = selectCityName.replace(provName, '').trim();
      const matchOpt = Array.from(selCity.options).find(o => o.value === cleanCity || o.value === selectCityName);
      if (matchOpt) {
        selCity.value = matchOpt.value;
      } else {
        selCity.selectedIndex = 0;
      }
    } else {
      selCity.selectedIndex = 0;
    }
    updateLongitude();
  }

  function updateLongitude() {
    const selOpt = selCity.options[selCity.selectedIndex];
    if (selOpt && selOpt.dataset.lon) {
      numLon.value = selOpt.dataset.lon;
      state.longitude = parseFloat(selOpt.dataset.lon);
      state.province = selProv.value;
      state.cityName = `${selProv.value} ${selOpt.value}`;
      localStorage.setItem('qimen_province', state.province);
      localStorage.setItem('qimen_city', state.cityName);
      localStorage.setItem('qimen_longitude', state.longitude);
      if (typeof syncSettingsModalLocation === 'function') syncSettingsModalLocation();
    }
  }

  selProv.addEventListener('change', () => {
    state.province = selProv.value;
    populateCities(selProv.value);
    executePaipan();
  });

  selCity.addEventListener('change', () => {
    updateLongitude();
    executePaipan();
  });

  numLon.addEventListener('change', () => {
    state.longitude = parseFloat(numLon.value) || 120.0;
    localStorage.setItem('qimen_longitude', state.longitude);
    if (typeof syncSettingsModalLocation === 'function') syncSettingsModalLocation();
    executePaipan();
  });

  populateCities(state.province || '北京', state.cityName);
}

// 通用公历与中文字符串日期时间解析函数
function parseDateTimeFromText(text) {
  if (!text || !text.trim()) return null;
  const str = text.trim();

  let year = null, month = null, day = null, hour = null, minute = 0;
  const now = new Date();
  const defaultYear = state.year || now.getFullYear();

  // 1. 中文年月日格式: 2026年10月20日 / 2026年10月20
  const cnMatch = str.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?/);
  if (cnMatch) {
    year = parseInt(cnMatch[1]);
    month = parseInt(cnMatch[2]);
    day = parseInt(cnMatch[3]);
  } else {
    // 2. 破折号/斜杠/点格式: 2026-10-20, 2026/10/20, 2026.10.20
    const sepMatch = str.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (sepMatch) {
      year = parseInt(sepMatch[1]);
      month = parseInt(sepMatch[2]);
      day = parseInt(sepMatch[3]);
    } else {
      // 3. 紧凑8位连续数字: 20261020
      const compMatch = str.match(/\b(19\d{2}|20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\b/);
      if (compMatch) {
        year = parseInt(compMatch[1]);
        month = parseInt(compMatch[2]);
        day = parseInt(compMatch[3]);
      } else {
        // 4. 无年份格式: 10月20日 / 10-20 / 10/20 (默认当前年份)
        const noYearCn = str.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日?/);
        const noYearSep = str.match(/\b(0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/);
        if (noYearCn) {
          year = defaultYear;
          month = parseInt(noYearCn[1]);
          day = parseInt(noYearCn[2]);
        } else if (noYearSep) {
          year = defaultYear;
          month = parseInt(noYearSep[1]);
          day = parseInt(noYearSep[2]);
        }
      }
    }
  }

  if (!year || !month || !day) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // 时辰匹配:
  // A. 匹配地支时辰: 戌时 / 子时 / 午时 等
  const zhiNames = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const zhiHours = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
  const zhiMatch = str.match(/([子丑寅卯辰巳午未申酉戌亥])\s*时/);
  if (zhiMatch) {
    const idx = zhiNames.indexOf(zhiMatch[1]);
    if (idx >= 0) {
      hour = zhiHours[idx];
      minute = 0;
    }
  }

  // B. 匹配数字时间: 21:12 / 21:12:30 / 21点30分 / 21时12分 / 21点 / 21时 / 20:00
  if (hour === null) {
    const timeMatch = str.match(/(?:(?:上午|下午|晚上|夜间)\s*)?(\d{1,2})[:：点时](\s*(\d{1,2})\s*分?)?/);
    if (timeMatch) {
      hour = parseInt(timeMatch[1]);
      if (timeMatch[3] !== undefined && timeMatch[3].trim() !== '') {
        minute = parseInt(timeMatch[3]);
      } else {
        minute = 0;
      }
      if ((str.includes('下午') || str.includes('晚上')) && hour < 12) {
        hour += 12;
      }
    } else {
      // 匹配日期后空格跟随的4位时间: 20261020 2112 或 2026-10-20 2112
      const timeNumMatch = str.match(/(?:[-/.\d\s]+)\s+([01]?\d|2[0-3])([0-5]\d)\b/);
      if (timeNumMatch) {
        hour = parseInt(timeNumMatch[1]);
        minute = parseInt(timeNumMatch[2]);
      } else {
        // 若只输入了年月日，未指定小时，则使用当前小时
        hour = state.hour !== undefined ? state.hour : now.getHours();
        minute = state.minute !== undefined ? state.minute : now.getMinutes();
      }
    }
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return { year, month, day, hour, minute };
}

// 通用四柱干支与公历时间智能解析函数
function parseGanzhiOrDateTimeInput(rawText) {
  if (!rawText || !rawText.trim()) return null;
  const text = rawText.trim();

  // 1. 优先尝试解析公历/中文日期时间
  const dt = parseDateTimeFromText(text);
  if (dt) {
    let dingjuMethod = null;
    if (text.includes('拆补')) dingjuMethod = 'chaibu';
    else if (text.includes('置闰')) dingjuMethod = 'zhirun';
    else if (text.includes('茅山')) dingjuMethod = 'maoshan';

    let paipanMethod = null;
    if (text.includes('飞盘') || text.includes('飞宫')) paipanMethod = 'fei';
    else if (text.includes('转盘') || text.includes('排宫')) paipanMethod = 'zhuan';

    let dun = null, ju = null;
    const numMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
    const juMatch = text.match(/(阳|阴)[遁]?([一二三四五六七八九1-9])局?/);
    if (juMatch) {
      dun = juMatch[1];
      ju = numMap[juMatch[2]] || parseInt(juMatch[2]);
    }

    return {
      type: 'datetime',
      dt,
      dingjuMethod,
      paipanMethod,
      dun,
      ju,
      text
    };
  }

  // 2. 尝试提取四柱干支 (如：壬寅 乙巳 壬申 庚戌，或 年:甲子 月:丙寅 日:戊辰 时:辛酉)
  let parsedPillars = {};
  const yMatch = text.match(/(?:年柱?[:：\s]*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])|([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])\s*年)/);
  if (yMatch) parsedPillars.year = yMatch[1] || yMatch[2];
  const mMatch = text.match(/(?:月柱?[:：\s]*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])|([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])\s*月)/);
  if (mMatch) parsedPillars.month = mMatch[1] || mMatch[2];
  const dMatch = text.match(/(?:日柱?[:：\s]*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])|([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])\s*日)/);
  if (dMatch) parsedPillars.day = dMatch[1] || dMatch[2];
  const hMatch = text.match(/(?:时柱?[:：\s]*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])|([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])\s*时)/);
  if (hMatch) parsedPillars.hour = hMatch[1] || hMatch[2];

  // 连续四柱识别 (如：壬寅 乙巳 壬申 庚戌)
  const fourGzMatch = text.match(/(?:干支[:：\s]*)?([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])[\s,，]+([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])[\s,，]+([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])[\s,，]+([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])/);
  if (fourGzMatch) {
    if (!parsedPillars.year) parsedPillars.year = fourGzMatch[1];
    if (!parsedPillars.month) parsedPillars.month = fourGzMatch[2];
    if (!parsedPillars.day) parsedPillars.day = fourGzMatch[3];
    if (!parsedPillars.hour) parsedPillars.hour = fourGzMatch[4];
  }

  // 提取文本中出现的所有合法六十甲子
  const gzList = [];
  const gzRegex = /([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])/g;
  let gm;
  while ((gm = gzRegex.exec(text)) !== null) {
    if (JIAZI.includes(gm[1])) {
      gzList.push(gm[1]);
    }
  }

  if (!parsedPillars.year && !parsedPillars.month && !parsedPillars.day && !parsedPillars.hour) {
    if (gzList.length >= 4) {
      parsedPillars.year = gzList[0];
      parsedPillars.month = gzList[1];
      parsedPillars.day = gzList[2];
      parsedPillars.hour = gzList[3];
    } else if (gzList.length === 2) {
      parsedPillars.day = gzList[0];
      parsedPillars.hour = gzList[1];
    }
  } else {
    if (!parsedPillars.year && gzList[0]) parsedPillars.year = gzList[0];
    if (!parsedPillars.month && gzList[1]) parsedPillars.month = gzList[1];
    if (!parsedPillars.day && gzList[2]) parsedPillars.day = gzList[2];
    if (!parsedPillars.hour && gzList[3]) parsedPillars.hour = gzList[3];
  }

  const hasPillars = !!(parsedPillars.year || parsedPillars.month || parsedPillars.day || parsedPillars.hour);
  if (!hasPillars) return null;

  let dingjuMethod = null;
  if (text.includes('拆补')) dingjuMethod = 'chaibu';
  else if (text.includes('置闰')) dingjuMethod = 'zhirun';
  else if (text.includes('茅山')) dingjuMethod = 'maoshan';

  let paipanMethod = null;
  if (text.includes('飞盘') || text.includes('飞宫')) paipanMethod = 'fei';
  else if (text.includes('转盘') || text.includes('排宫')) paipanMethod = 'zhuan';

  let dun = null, ju = null;
  const numMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
  const juMatch = text.match(/(阳|阴)[遁]?([一二三四五六七八九1-9])局?/);
  if (juMatch) {
    dun = juMatch[1];
    ju = numMap[juMatch[2]] || parseInt(juMatch[2]);
  }

  return {
    type: 'ganzhi',
    pillars: parsedPillars,
    dingjuMethod,
    paipanMethod,
    dun,
    ju,
    text
  };
}

// 3. 起局日期时间选择与快速输入初始化
function initDateTimeSelectors() {
  const selYear = document.getElementById('selPanYear');
  const selMonth = document.getElementById('selPanMonth');
  const selDay = document.getElementById('selPanDay');
  const selHour = document.getElementById('selPanHour');
  const selMin = document.getElementById('selPanMinute');
  const iptQuick = document.getElementById('iptPanQuickTime');
  const btnQuick = document.getElementById('btnQuickTimeApply');

  if (selYear && selYear.tagName === 'SELECT') {
    for (let y = 1900; y <= 2099; y++) selYear.add(new Option(y, y));
    for (let m = 1; m <= 12; m++) selMonth.add(new Option(m, m));
    for (let h = 0; h <= 23; h++) selHour.add(new Option(h, h));
    for (let mi = 0; mi <= 59; mi++) selMin.add(new Option(mi, mi));
  }

  function handleInputEvent(el) {
    if (!el) return;
    el.addEventListener('change', syncDateTimeFromPickers);
    el.addEventListener('input', syncDateTimeFromPickers);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        syncDateTimeFromPickers();
        executePaipan();
      }
    });
  }

  [selYear, selMonth, selDay, selHour, selMin].forEach(handleInputEvent);

  const btnExec = document.getElementById('btnExecutePan');
  if (btnExec) {
    btnExec.addEventListener('click', () => {
      syncDateTimeFromPickers();
      executePaipan();
    });
  }

  const btnDirectCast = document.getElementById('btnDirectCastNow');
  if (btnDirectCast) {
    btnDirectCast.addEventListener('click', startImmediateCastFlow);
  }

  // 快速四柱干支或公历时间输入识别起盘逻辑 (复制手动录入智能联动能力)
  function handleQuickTimeApply() {
    if (!iptQuick) return;
    const val = iptQuick.value.trim();
    if (!val) return;

    const res = parseGanzhiOrDateTimeInput(val);
    if (!res) {
      showToast('未检测到有效四柱干支或公历时间，请尝试如：壬寅 乙巳 壬申 庚戌 或 2026-10-20 21:12');
      return;
    }

    // 1. 同步可能包含的定局方式
    if (res.dingjuMethod) {
      state.dingjuMethod = res.dingjuMethod;
      const segDingju = document.getElementById('segDingjuGroup');
      if (segDingju) {
        segDingju.querySelectorAll('.m3-segment-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.value === res.dingjuMethod);
        });
      }
    }

    // 2. 同步可能包含的排盘方式 (转盘/飞盘)
    if (res.paipanMethod) {
      state.paipanMethod = res.paipanMethod;
      const segPaipan = document.getElementById('segPaipanGroup');
      if (segPaipan) {
        segPaipan.querySelectorAll('.m3-segment-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.value === res.paipanMethod);
        });
      }
    }

    if (res.type === 'datetime') {
      const dt = res.dt;
      state.year = dt.year;
      state.month = dt.month;
      state.day = dt.day;
      state.hour = dt.hour;
      state.minute = dt.minute;
      state.customPillars = null;
      if (res.dun && res.ju) {
        state.manualJu = { dun: res.dun, ju: res.ju, type: 'manual', dingjuMethod: state.dingjuMethod };
        const selManual = document.getElementById('selManualJu');
        if (selManual) selManual.value = `${res.dun}${res.ju}`;
      } else {
        const selManual = document.getElementById('selManualJu');
        if (selManual && selManual.value !== 'auto') {
          const dun = selManual.value.substring(0, 1);
          const ju = parseInt(selManual.value.substring(1));
          state.manualJu = { dun, ju, type: 'manual', dingjuMethod: state.dingjuMethod };
        } else {
          state.manualJu = null;
        }
      }
      syncDateTimeToPickers();
      renderCalendar();
      executePaipan();
      showToast(`已识别起局时间: ${dt.year}年${dt.month}月${dt.day}日 ${String(dt.hour).padStart(2, '0')}:${String(dt.minute).padStart(2, '0')}`);
      iptQuick.value = '';
    } else if (res.type === 'ganzhi') {
      const curPillars = (state.currentPan && state.currentPan.pillars) || {};
      const fullPillars = {
        year: res.pillars.year || curPillars.year || '丙午',
        month: res.pillars.month || curPillars.month || '戊戌',
        day: res.pillars.day || curPillars.day || '丁卯',
        hour: res.pillars.hour || curPillars.hour || '辛亥'
      };
      state.customPillars = fullPillars;
      if (res.dun && res.ju) {
        state.manualJu = { dun: res.dun, ju: res.ju, type: 'manual', dingjuMethod: state.dingjuMethod };
        const selManual = document.getElementById('selManualJu');
        if (selManual) selManual.value = `${res.dun}${res.ju}`;
      } else {
        // 关键修复：输入纯四柱时优先尊重页面上已选择的指定局数下拉框（如 阴九局）
        const selManual = document.getElementById('selManualJu');
        if (selManual && selManual.value !== 'auto') {
          const dun = selManual.value.substring(0, 1);
          const ju = parseInt(selManual.value.substring(1));
          state.manualJu = { dun, ju, type: 'manual', dingjuMethod: state.dingjuMethod };
        } else {
          state.manualJu = null;
        }
      }
      executePaipan();
      const juText = state.manualJu ? ` · ${state.manualJu.dun}遁${['一','二','三','四','五','六','七','八','九'][state.manualJu.ju - 1]}局` : '';
      showToast(`已成功识别四柱干支：${fullPillars.year} ${fullPillars.month} ${fullPillars.day} ${fullPillars.hour}${juText}，完成起盘！`);
      iptQuick.value = '';
    }
  }

  if (btnQuick) btnQuick.addEventListener('click', handleQuickTimeApply);
  if (iptQuick) {
    iptQuick.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleQuickTimeApply();
      }
    });
  }

  syncDateTimeToPickers();
}

// 同步全部界面控件状态 (分段按钮、手动局数下拉框、时间选择框、用神与所问事项)
function syncControlsUI() {
  // 1. 同步定局方式 Segmented Button (置闰 / 拆补 / 茅山)
  const segDingju = document.getElementById('segDingjuGroup');
  if (segDingju) {
    segDingju.querySelectorAll('.m3-segment-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === state.dingjuMethod);
    });
  }

  // 2. 同步排盘方式 Segmented Button (排宫 / 飞宫)
  const segPaipan = document.getElementById('segPaipanGroup');
  if (segPaipan) {
    segPaipan.querySelectorAll('.m3-segment-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === state.paipanMethod);
    });
  }

  // 2.1 同步子时处理 Segmented Button
  const segZishi = document.getElementById('segZishiGroup');
  if (segZishi) {
    segZishi.querySelectorAll('.m3-segment-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === state.zishi);
    });
  }

  // 3. 同步手动指定局数下拉框 (#selManualJu) 及紧凑矩阵选择器
  const selManual = document.getElementById('selManualJu');
  if (selManual) {
    if (state.manualJu && state.manualJu.dun && state.manualJu.ju) {
      selManual.value = `${state.manualJu.dun}${state.manualJu.ju}`;
    } else {
      selManual.value = 'auto';
    }
  }
  syncManualJuUI();

  // 4. 同步时间选择框与日期
  syncDateTimeToPickers();

  // 5. 同步所问问题输入框
  const iptQ = document.getElementById('iptUserQuestion');
  if (iptQ) {
    iptQ.value = state.userQuestion || '';
  }
}

function syncDateTimeToPickers() {
  const y = document.getElementById('selPanYear');
  const m = document.getElementById('selPanMonth');
  const d = document.getElementById('selPanDay');
  const h = document.getElementById('selPanHour');
  const min = document.getElementById('selPanMinute');
  if (y) y.value = state.year;
  if (m) m.value = state.month;
  if (d) d.value = state.day;
  if (h) h.value = state.hour;
  if (min) min.value = state.minute;
}

function syncDateTimeFromPickers() {
  const y = parseInt(document.getElementById('selPanYear').value);
  const m = parseInt(document.getElementById('selPanMonth').value);
  const d = parseInt(document.getElementById('selPanDay').value);
  const h = parseInt(document.getElementById('selPanHour').value);
  const min = parseInt(document.getElementById('selPanMinute').value);

  // 锁定中改时间：先确认是否另开新盘，拒绝则把输入框恢复成原局时间
  const lockedRec = getActiveRecord();
  if (lockedRec) {
    const changed = (!isNaN(y) && y !== lockedRec.year) || (!isNaN(m) && m !== lockedRec.month) ||
      (!isNaN(d) && d !== lockedRec.day) || (!isNaN(h) && h !== lockedRec.hour) ||
      (!isNaN(min) && min !== lockedRec.minute);
    if (changed && !confirmLeaveLock('修改起局时间')) {
      syncDateTimeToPickers();
      return;
    }
  }

  if (!isNaN(y)) state.year = y;
  if (!isNaN(m)) state.month = m;
  if (!isNaN(d)) state.day = d;
  if (!isNaN(h)) state.hour = h;
  if (!isNaN(min)) state.minute = min;
  state.customPillars = null;

  const selBaoshi = document.getElementById('selBaoshiHour');
  if (selBaoshi) {
    selBaoshi.value = 'default';
  }
}

// 4. M3 控制组件初始化 (分段按钮、开关、选项)
function initControls() {
  function setupSegmentedGroup(groupId, onChange, currentValue) {
    const group = document.getElementById(groupId);
    if (!group) return;
    const btns = group.querySelectorAll('.m3-segment-btn');
    if (currentValue !== undefined) {
      btns.forEach(b => {
        b.classList.toggle('active', b.dataset.value === currentValue);
      });
    }
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (onChange) onChange(btn.dataset.value);
      });
    });
  }

  // 定局方式 Segmented Button
  setupSegmentedGroup('segDingjuGroup', val => {
    if (!guardPrefChange('dingjuMethod', val, '切换定局方式')) return;
    state.dingjuMethod = val;
    localStorage.setItem('qimen_dingju_method', val);
    if (typeof syncSettingsModal === 'function') syncSettingsModal();
    executePaipan();
  }, state.dingjuMethod);

  // 排盘方式 Segmented Button (排宫 / 飞宫)
  setupSegmentedGroup('segPaipanGroup', val => {
    if (!guardPrefChange('paipanMethod', val, '切换排盘方式')) return;
    state.paipanMethod = val;
    localStorage.setItem('qimen_paipan_method', val);
    if (typeof syncSettingsModal === 'function') syncSettingsModal();
    executePaipan();
  }, state.paipanMethod);

  // 子时 Segmented Button (早晚分 / 进次日)
  setupSegmentedGroup('segZishiGroup', val => {
    if (!guardPrefChange('zishi', val, '切换子时处理')) return;
    state.zishi = val;
    localStorage.setItem('qimen_zishi', val);
    if (typeof syncSettingsModal === 'function') syncSettingsModal();
    executePaipan();
  }, state.zishi);

  // 地盘/天盘全息视图切换开关 (M3 Switch)
  const chkDipan = document.getElementById('chkToggleDipan');
  if (chkDipan) {
    chkDipan.checked = state.showDipan;
    chkDipan.addEventListener('change', e => {
      state.showDipan = e.target.checked;
      state.selectedDipanGong = 0;
      localStorage.setItem('qimen_show_dipan', state.showDipan ? '1' : '0');
      updateBoardCardCenter(state.currentPan);
      if (typeof syncSettingsModal === 'function') syncSettingsModal();
      if (state.currentPan) {
        renderNinePalaces(state.currentPan);
        renderKeyingAnalysis(state.currentPan, state.selectedGong);
      }
      showToast(state.showDipan ? '已切换至地盘全息象意' : '已切换至天盘信息');
    });
  }

  // 研判详情折叠开关 (设置总开关最高权限，支持手动切换当前宫并记录覆盖)
  const btnToggleKeying = document.getElementById('btnToggleKeyingDetail');
  if (btnToggleKeying) {
    btnToggleKeying.addEventListener('click', () => {
      const g = state.selectedGong || 2;
      const defaultFullMode = state.showKeyingDetails !== false;
      const curFull = (state.palaceModeOverrides && state.palaceModeOverrides[g] !== undefined)
        ? !!state.palaceModeOverrides[g]
        : defaultFullMode;
      if (!state.palaceModeOverrides) state.palaceModeOverrides = {};
      state.palaceModeOverrides[g] = !curFull;
      if (state.currentPan) {
        renderKeyingAnalysis(state.currentPan, g);
      }
      showToast(!curFull ? '已展开为完整读象模式' : '已切换为精简模式 (仅展示宫位与十干克应)');
    });
  }

  // 辅助函数：清零报数起局
  function resetBaoShu() {
    const ipt = document.getElementById('iptBaoShu');
    const rem = document.getElementById('txtBaoshuRem');
    if (ipt) ipt.value = '';
    if (rem) rem.textContent = '余：-';
  }

  // 辅助函数：报时起局恢复默认
  function resetBaoshi() {
    const sel = document.getElementById('selBaoshiHour');
    if (sel) sel.value = 'default';
    const selHour = document.getElementById('selPanHour');
    if (selHour) state.hour = parseInt(selHour.value);
  }

  // ---------------- 指定局数紧凑矩阵选择器 (Popover Matrix) ----------------
  const NUM_TO_CHINESE = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '七', 8: '八', 9: '九' };

  function formatJuText(val) {
    if (!val || val === 'auto') return '自动起局';
    const dun = val.substring(0, 1);
    const num = parseInt(val.substring(1));
    const ch = NUM_TO_CHINESE[num] || num;
    return `${dun}${ch}局`;
  }

  function syncManualJuUI() {
    const selManual = document.getElementById('selManualJu');
    const txtTrigger = document.getElementById('txtManualJuTrigger');
    const btnTrigger = document.getElementById('btnManualJuTrigger');
    const btnAuto = document.getElementById('btnJuAuto');
    if (!selManual || !txtTrigger) return;

    const val = selManual.value || 'auto';
    txtTrigger.textContent = formatJuText(val);

    if (val === 'auto') {
      if (btnTrigger) btnTrigger.classList.remove('is-manual');
      if (btnAuto) btnAuto.classList.add('active');
      document.querySelectorAll('.ju-num-chip').forEach(chip => chip.classList.remove('active'));
    } else {
      if (btnTrigger) btnTrigger.classList.add('is-manual');
      if (btnAuto) btnAuto.classList.remove('active');
      document.querySelectorAll('.ju-num-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.ju === val);
      });
    }
  }

  function initManualJuPicker() {
    const wrap = document.getElementById('wrapManualJuPicker');
    const btnTrigger = document.getElementById('btnManualJuTrigger');
    const popover = document.getElementById('popoverManualJu');
    const btnAuto = document.getElementById('btnJuAuto');
    const selManual = document.getElementById('selManualJu');
    if (!wrap || !btnTrigger || !selManual) return;

    // 触发按钮展开/收起
    btnTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = wrap.classList.toggle('open');
      btnTrigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    // 点击浮层内部阻止冒泡，避免误关闭
    if (popover) {
      popover.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // 点击外部区域自动收起
    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) {
        wrap.classList.remove('open');
        btnTrigger.setAttribute('aria-expanded', 'false');
      }
    });

    // ESC 键收起
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && wrap.classList.contains('open')) {
        wrap.classList.remove('open');
        btnTrigger.setAttribute('aria-expanded', 'false');
      }
    });

    // 点击自动起局
    if (btnAuto) {
      btnAuto.addEventListener('click', () => {
        selManual.value = 'auto';
        selManual.dispatchEvent(new Event('change'));
        wrap.classList.remove('open');
        btnTrigger.setAttribute('aria-expanded', 'false');
      });
    }

    // 点击局数微胶囊 (阳1~9, 阴1~9)
    wrap.querySelectorAll('.ju-num-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const juVal = chip.dataset.ju;
        if (juVal) {
          selManual.value = juVal;
          selManual.dispatchEvent(new Event('change'));
          wrap.classList.remove('open');
          btnTrigger.setAttribute('aria-expanded', 'false');
        }
      });
    });

    // 首次同步一次
    syncManualJuUI();
  }

  // 辅助函数：指定局数改为自动起局
  function resetManualJu() {
    const sel = document.getElementById('selManualJu');
    if (sel) sel.value = 'auto';
    state.manualJu = null;
    syncManualJuUI();
  }

  // 1. 手动指定局数下拉框与矩阵组件初始化
  initManualJuPicker();
  const selManual = document.getElementById('selManualJu');
  if (selManual) {
    selManual.addEventListener('change', () => {
      const val = selManual.value;
      if (val === 'auto') {
        state.manualJu = null;
      } else {
        const dun = val.substring(0, 1);
        const ju = parseInt(val.substring(1));
        state.manualJu = { dun, ju, type: 'manual' };

        // 互斥：输入指定局数时，报时起局默认，报数起局输入数字清零
        resetBaoshi();
        resetBaoShu();
      }
      syncManualJuUI();
      executePaipan();
    });
  }

  // 2. 报时起局下拉框
  const selBaoshi = document.getElementById('selBaoshiHour');
  if (selBaoshi) {
    selBaoshi.addEventListener('change', () => {
      const val = selBaoshi.value;
      if (val === 'default') {
        // 恢复默认时辰（对齐主时间选择器小时）
        const selPanHour = document.getElementById('selPanHour');
        if (selPanHour) state.hour = parseInt(selPanHour.value);
      } else {
        const h = parseInt(val);
        state.hour = h;
        const selPanHour = document.getElementById('selPanHour');
        if (selPanHour) selPanHour.value = h;

        // 互斥：报时起局时，指定局数改为自动起局，报数起局输入数字清零
        resetManualJu();
        resetBaoShu();
        showToast(`报时起局：已切换至 ${selBaoshi.options[selBaoshi.selectedIndex].text}`);
      }
      executePaipan();
    });
  }

  // 3. 报数起局：实时预览
  const iptBaoShu = document.getElementById('iptBaoShu');
  const txtBaoshuRem = document.getElementById('txtBaoshuRem');
  if (iptBaoShu && txtBaoshuRem) {
    iptBaoShu.addEventListener('input', () => {
      const raw = iptBaoShu.value.trim();
      if (!raw) {
        txtBaoshuRem.textContent = '余：-';
        // 清空时，若当前处于报数起局状态则恢复自动起盘
        if (state.manualJu && state.manualJu.type === 'baoshu') {
          state.manualJu = null;
          executePaipan();
        }
        return;
      }

      const num = parseInt(raw);
      if (isNaN(num) || num <= 0) {
        txtBaoshuRem.textContent = '余：-';
        if (state.manualJu && state.manualJu.type === 'baoshu') {
          state.manualJu = null;
          executePaipan();
        }
        return;
      }

      const remainder = ((num - 1) % 9) + 1;
      txtBaoshuRem.textContent = `余：${remainder}`;

      // 互斥：报数起局时，指定局数改为自动起局，报时起局默认
      resetManualJu();
      resetBaoshi();

      // 实时预览起局（阴阳遁跟随当前日节气）
      const dun = state.currentPan ? state.currentPan.dun : '阳';
      state.manualJu = { dun, ju: remainder, type: 'baoshu' };
      executePaipan();
    });
  }

  // 查找格局入口按钮
  const btnOpenFindPattern = document.getElementById('btnOpenFindPattern');
  if (btnOpenFindPattern) btnOpenFindPattern.addEventListener('click', openPatternSearchModal);
  const btnBottomFindPattern = document.getElementById('btnBottomFindPattern');
  if (btnBottomFindPattern) btnBottomFindPattern.addEventListener('click', openPatternSearchModal);

  // 顶部与底部快捷按钮
  const btnSimple = document.getElementById('btnToggleSimple');
  if (btnSimple) {
    btnSimple.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSimpleMode();
    });
  }

  const btnCopy = document.getElementById('btnCopyQimen');
  if (btnCopy) btnCopy.addEventListener('click', copyQimenToClipboard);
  const btnTopKeying = document.getElementById('btnTopKeying');
  if (btnTopKeying) {
    btnTopKeying.addEventListener('click', (e) => {
      e.stopPropagation();
      openKeyingModal();
    });
    btnTopKeying.addEventListener('touchend', (e) => {
      e.stopPropagation();
      openKeyingModal();
    }, { passive: true });
  }
  const btnBottomCopy = document.getElementById('btnBottomCopy');
  if (btnBottomCopy) btnBottomCopy.addEventListener('click', copyQimenToClipboard);
  const btnBottomCopyYongShen = document.getElementById('btnBottomCopyYongShen');
  if (btnBottomCopyYongShen) btnBottomCopyYongShen.addEventListener('click', copyYongShenAnalysis);

  const btnTheme = document.getElementById('btnToggleTheme');
  if (btnTheme) btnTheme.addEventListener('click', toggleTheme);

  const btnSettings = document.getElementById('btnSettings');
  if (btnSettings) {
    btnSettings.addEventListener('click', () => {
      if (typeof syncSettingsModal === 'function') syncSettingsModal();
      openModal('modalSettings');
    });
  }

  const btnHelp = document.getElementById('btnHelp');
  if (btnHelp) btnHelp.addEventListener('click', () => openModal('modalHelp'));

  const btnKeying = document.getElementById('btnKeyingSearchModal');
  if (btnKeying) btnKeying.addEventListener('click', openKeyingModal);
  const btnBottomKeying = document.getElementById('btnBottomKeying');
  if (btnBottomKeying) btnBottomKeying.addEventListener('click', openKeyingModal);

  const btnKeyingFilterYongShen = document.getElementById('btnKeyingFilterYongShen');
  if (btnKeyingFilterYongShen) {
    btnKeyingFilterYongShen.addEventListener('click', () => {
      state.keyingOnlyYongShen = !state.keyingOnlyYongShen;
      renderKeyingModalContent();
    });
  }

  const btnKeyingCopyPan = document.getElementById('btnKeyingCopyPan');
  if (btnKeyingCopyPan) {
    btnKeyingCopyPan.addEventListener('click', copyQimenToClipboard);
  }

  const btnKeyingCopyAll = document.getElementById('btnKeyingCopyAll');
  if (btnKeyingCopyAll) {
    btnKeyingCopyAll.addEventListener('click', copyKeyingModalPanAndCurrentContent);
  }

  const btnKeyingCopyCurrent = document.getElementById('btnKeyingCopyCurrent');
  if (btnKeyingCopyCurrent) {
    btnKeyingCopyCurrent.addEventListener('click', copyKeyingModalCurrentContent);
  }

  const btnNow = document.getElementById('btnToolbarNow');
  if (btnNow) btnNow.addEventListener('click', startImmediateCastFlow);

  // 象意人象与物象快速切换按键委托监听
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.imagery-mode-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const mode = btn.dataset.mode;
    let targetMode = mode;
    if (btn.classList.contains('active') && mode !== 'all') {
      targetMode = 'all';
    }
    setImageryMode(targetMode);
  });

  // 对话框关闭按钮
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  // M3 移动端底部导航栏
  document.querySelectorAll('#m3MobileNav .nav-item').forEach(item => {
    item.addEventListener('click', () => {
      switchMobileTab(item.dataset.tab);
    });
  });
}

// 移动端底部标签页切换
function switchMobileTab(tab) {
  document.querySelectorAll('#m3MobileNav .nav-item').forEach(i => {
    i.classList.toggle('active', i.dataset.tab === tab);
  });
  const leftP = document.getElementById('leftPanel');
  const rightP = document.getElementById('rightPanel');
  const calCard = document.querySelector('.calendar-card');
  const ctrlCard = document.querySelector('.controls-card');
  const caseCard = document.querySelector('.cases-card');

  if (tab === 'pan') {
    if (leftP) leftP.classList.add('tab-active');
    if (rightP) rightP.classList.remove('tab-active');
  } else {
    if (leftP) leftP.classList.remove('tab-active');
    if (rightP) rightP.classList.add('tab-active');

    if (tab === 'cal') {
      if (calCard) calCard.style.display = 'flex';
      if (ctrlCard) ctrlCard.style.display = 'none';
      if (caseCard) caseCard.style.display = 'none';
    } else if (tab === 'setting') {
      if (calCard) calCard.style.display = 'none';
      if (ctrlCard) ctrlCard.style.display = 'flex';
      if (caseCard) caseCard.style.display = 'none';
    } else if (tab === 'cases') {
      if (calCard) calCard.style.display = 'none';
      if (ctrlCard) ctrlCard.style.display = 'none';
      if (caseCard) caseCard.style.display = 'flex';
    }
  }
}

// 5. 万年历月历组件初始化与渲染
function initCalendar() {
  const selYear = document.getElementById('selCalYear');
  const selMonth = document.getElementById('selCalMonth');

  for (let y = 1900; y <= 2099; y++) {
    selYear.add(new Option(y, y));
  }
  for (let m = 1; m <= 12; m++) {
    selMonth.add(new Option(m, m));
  }

  selYear.value = state.calViewYear;
  selMonth.value = state.calViewMonth;

  selYear.addEventListener('change', () => {
    state.calViewYear = parseInt(selYear.value);
    renderCalendar();
  });
  selMonth.addEventListener('change', () => {
    state.calViewMonth = parseInt(selMonth.value);
    renderCalendar();
  });

  const btnPrevY = document.getElementById('btnPrevYear');
  if (btnPrevY) {
    btnPrevY.addEventListener('click', () => {
      state.calViewYear = Math.max(1900, state.calViewYear - 1);
      selYear.value = state.calViewYear;
      renderCalendar();
    });
  }
  const btnNextY = document.getElementById('btnNextYear');
  if (btnNextY) {
    btnNextY.addEventListener('click', () => {
      state.calViewYear = Math.min(2099, state.calViewYear + 1);
      selYear.value = state.calViewYear;
      renderCalendar();
    });
  }
  const btnPrevM = document.getElementById('btnPrevMonth');
  if (btnPrevM) {
    btnPrevM.addEventListener('click', () => {
      if (state.calViewMonth === 1) {
        state.calViewMonth = 12;
        state.calViewYear--;
      } else {
        state.calViewMonth--;
      }
      selYear.value = state.calViewYear;
      selMonth.value = state.calViewMonth;
      renderCalendar();
    });
  }
  const btnNextM = document.getElementById('btnNextMonth');
  if (btnNextM) {
    btnNextM.addEventListener('click', () => {
      if (state.calViewMonth === 12) {
        state.calViewMonth = 1;
        state.calViewYear++;
      } else {
        state.calViewMonth++;
      }
      selYear.value = state.calViewYear;
      selMonth.value = state.calViewMonth;
      renderCalendar();
    });
  }
  document.getElementById('btnCalNow').addEventListener('click', jumpCalendarToToday);

  // 移动端万年历底部快捷起盘与查看盘面
  const btnCastNow = document.getElementById('btnCalCastNow');
  if (btnCastNow) {
    btnCastNow.addEventListener('click', startImmediateCastFlow);
  }

  const btnViewPan = document.getElementById('btnCalViewPan');
  if (btnViewPan) {
    btnViewPan.addEventListener('click', () => {
      if (typeof switchMobileTab === 'function') {
        switchMobileTab('pan');
      }
    });
  }

  renderCalendar();
}

function renderCalendar() {
  const tbody = document.getElementById('calTableBody');
  tbody.innerHTML = '';

  const y = state.calViewYear;
  const m = state.calViewMonth;

  // 首日星期 (0=周日)
  const firstDay = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const prevMonthDays = new Date(y, m - 1, 0).getDate();

  let dateNum = 1;
  let nextMonthDay = 1;

  for (let row = 0; row < 6; row++) {
    const tr = document.createElement('tr');
    let hasDateInRow = false;

    for (let col = 0; col < 7; col++) {
      const td = document.createElement('td');
      const cellIndex = row * 7 + col;

      if (cellIndex < firstDay) {
        // 上个月的尾巴
        const prevDay = prevMonthDays - (firstDay - cellIndex - 1);
        td.classList.add('is-other-month');
        td.innerHTML = `<div class="cal-day-num">${prevDay}</div>`;
      } else if (dateNum <= daysInMonth) {
        // 本月日期
        hasDateInRow = true;
        const currentD = dateNum;
        if (col === 0 || col === 6) td.classList.add('is-weekend');

        // 是否为当前起盘所选日期
        if (y === state.year && m === state.month && currentD === state.day) {
          td.classList.add('selected');
        }

        const lunar = getLunarDate(y, m, currentD);
        const lunarShort = lunar.lunarDay === 1
          ? (lunar.isLeap ? '闰' : '') + lunar.lunarMonthName.substring(0, 2)
          : lunar.lunarDayName;

        td.innerHTML = `
          <div class="cal-day-num">${currentD}</div>
          <div class="cal-lunar-text">${lunarShort}</div>
        `;

        // 点击直接起盘
        td.addEventListener('click', () => {
          state.year = y;
          state.month = m;
          state.day = currentD;
          syncDateTimeToPickers();
          renderCalendar();
          executePaipan();
        });

        dateNum++;
      } else {
        // 下个月头部
        td.classList.add('is-other-month');
        td.innerHTML = `<div class="cal-day-num">${nextMonthDay++}</div>`;
      }
      tr.appendChild(td);
    }

    if (hasDateInRow || row < 5) {
      tbody.appendChild(tr);
    }
  }

  // 更新万年历头部干支与节气展示
  const middleDateLunar = getLunarDate(y, m, 15);
  const elCalLunar = document.getElementById('calLunarYearTitle');
  if (elCalLunar) elCalLunar.textContent = `农历: ${middleDateLunar.yearGanzhi}${middleDateLunar.nayin}『${middleDateLunar.shengxiao}』年`;
  const elZodiac = document.getElementById('calZodiacBadge');
  if (elZodiac) elZodiac.textContent = `生肖: ${middleDateLunar.shengxiao}`;
}

// 6. 九宫格交互与点击选中
function initPalaceInteractions() {
  document.querySelectorAll('.palace-cell').forEach(cell => {
    const gong = parseInt(cell.dataset.gong);
    cell.addEventListener('click', (e) => {
      // 若处于九宫盘面动态演盘期间，用户点击宫位则立即结束演盘并选中该宫
      if (typeof boardAnimState !== 'undefined' && boardAnimState.running) {
        stopBoardAnimation(true);
      }

      // 若点击的是正宫角落开关按钮，不触发宫位选中
      if (e.target.closest('#btnCenterKongToggle') || e.target.closest('#btnCenterMaskToggle')) return;

      // 若处于盘面手动圈选用神模式，拦截点击并处理用神圈选，不改变所选宫位
      if (state.isGridPickingMode) {
        e.stopPropagation();
        e.preventDefault();
        handleGridPickClick(e, gong);
        return;
      }

      // 若处于地盘全息视图，宫位点击专用于聚焦该宫并展示对应动态关系层
      if (state.showDipan) {
        handleDipanPalaceClick(gong);
        return;
      }

      selectPalace(gong);
    });
  });

  // 正宫右上角旬空符号与左上角减弱蒙版按钮点击事件全局监听
  document.addEventListener('click', e => {
    const btn = e.target.closest('#btnCenterKongToggle');
    if (btn) {
      e.stopPropagation();
      e.preventDefault();
      state.kongLookOpposite = !state.kongLookOpposite;
      try {
        localStorage.setItem('qimen_kong_look_opposite', state.kongLookOpposite ? '1' : '0');
      } catch (err) {}
      if (state.currentPan) {
        renderNinePalaces(state.currentPan);
      }
      const modalKeying = document.getElementById('modalKeying');
      if (modalKeying && modalKeying.classList.contains('active')) {
        renderKeyingModalContent();
      }
      showToast(state.kongLookOpposite ? '旬空看对宫：已开启（实心·显示淡蓝色光圈）' : '旬空看对宫：已关闭（空圈·不显示）');
      return;
    }

    const maskBtn = e.target.closest('#btnCenterMaskToggle');
    if (maskBtn) {
      e.stopPropagation();
      e.preventDefault();
      state.maskWeakened = !state.maskWeakened;
      try {
        localStorage.setItem('qimen_mask_weakened', state.maskWeakened ? '1' : '0');
      } catch (err) {}
      if (state.currentPan) {
        renderNinePalaces(state.currentPan);
      }
      showToast(state.maskWeakened ? '运筹模式：已开启（金黄色标记吉门吉星吉神，并减弱非用神蒙版）' : '运筹模式：已关闭（恢复正常突出）');
    }
  });
}

// 地盘全息模式下的宫格点击交互 (选中宫位以同步下方克应研判，地盘看大象不进行变暗聚焦)
function handleDipanPalaceClick(gong) {
  state.selectedGong = gong;
  state.selectedDipanGong = gong;

  // 同步更新所有宫格的高亮选中样式
  document.querySelectorAll('.palace-cell').forEach(c => {
    const g = parseInt(c.dataset.gong);
    c.classList.toggle('selected', g === gong);
    c.classList.toggle('is-dipan-selected', g === gong);
  });

  // 同步更新下方克应研判卡片，并根据当前点击的宫位动态重绘天盘用神关系连线
  if (state.currentPan) {
    renderKeyingAnalysis(state.currentPan, gong);
    renderDipanRelations(state.currentPan, gong);
  }
}

function selectPalace(gong) {
  state.selectedGong = gong;
  document.querySelectorAll('.palace-cell').forEach(c => {
    c.classList.toggle('selected', parseInt(c.dataset.gong) === gong);
  });
  if (state.currentPan) {
    renderKeyingAnalysis(state.currentPan, gong);
  }
}

// 7. 执行排盘并更新全界面
function executePaipan() {
  if (typeof boardAnimState !== 'undefined' && boardAnimState.running) {
    stopBoardAnimation(false);
  }

  // 起局锁定兜底：任何入口改动了起局参数，都要先确认是否另开新盘
  const lockedRec = getActiveRecord();
  if (lockedRec && !sameCastParams(lockedRec, state)) {
    if (confirmLeaveLock('改动起局参数')) {
      // 已解除锁定，按新参数排盘
    } else {
      restoreLockedParams(lockedRec);
    }
  }

  try {
    let pan = paipan({
      year: state.year,
      month: state.month,
      day: state.day,
      hour: state.hour,
      minute: state.minute,
      longitude: state.longitude,
      dingjuMethod: state.dingjuMethod,
      paipanMethod: state.paipanMethod,
      designatedJu: state.manualJu,
      zishi: state.zishi,
      cityName: state.cityName,
      customPillars: state.customPillars
    });

    // 锁定中的记录若有盘面快照，以存档原盘为准 (算法日后修正也不会悄悄换盘)
    const rec = getActiveRecord();
    if (rec && rec.panSnapshot) {
      const fpRec = rec.panFingerprint || panFingerprint(rec.panSnapshot);
      if (panFingerprint(pan) !== fpRec) {
        pan = JSON.parse(JSON.stringify(rec.panSnapshot));
        if (state.snapshotMismatchWarned !== rec.id) {
          state.snapshotMismatchWarned = rec.id;
          setTimeout(() => showToast('当前算法重算的盘与存档不同，已按起局时保存的原盘显示'), 600);
        }
      }
    }

    pan.selectedYongShen = state.selectedYongShen;
    pan.userQuestion = state.userQuestion;
    pan.yongshenNature = state.yongshenNature;
    pan.remark = state.caseRemark;
    state.currentPan = pan;

    const curPillars = pan.pillars || {};
    const panKey = `${curPillars.year || ''}-${curPillars.month || ''}-${curPillars.day || ''}-${curPillars.hour || ''}-${pan.paipanMethod}-${pan.dingjuMethod}-${pan.ju}`;
    if (panKey !== state.lastPanKey) {
      state.lastPanKey = panKey;
      state.hasAnimatedOnFirstYS = false;
    }

    renderHeaderInfo(pan);
    renderNinePalaces(pan);
    renderCalendarTerms(pan);

    if (state.isPendingReveal) {
      renderKeyingPendingHint();
      applyPendingVisualMasks(true);
      scrubPendingContent();
    } else {
      renderKeyingAnalysis(pan, state.selectedGong);
      applyPendingVisualMasks(false);
    }
    renderLockBadge();
  } catch (err) {
    console.error('排盘执行异常:', err);
    showToast('排盘计算失败: ' + err.message);
  }
}

// 防剧透视觉遮罩控制
function applyPendingVisualMasks(isPending) {
  const grid = document.getElementById('nineGrid');
  const overviewCard = document.querySelector('.info-overview-card');
  const overlay = document.getElementById('boardPendingOverlay');
  const timeEl = document.getElementById('txtPendingLockedTime');

  if (isPending) {
    if (grid) grid.classList.add('is-grid-masked');
    if (overviewCard) overviewCard.classList.add('is-overview-masked');
    if (overlay) overlay.style.display = 'flex';
    if (timeEl) {
      timeEl.textContent = `${state.year}年${String(state.month).padStart(2, '0')}月${String(state.day).padStart(2, '0')}日 ${String(state.hour).padStart(2, '0')}:${String(state.minute).padStart(2, '0')}`;
    }
  } else {
    if (grid) grid.classList.remove('is-grid-masked');
    if (overviewCard) overviewCard.classList.remove('is-overview-masked');
    if (overlay) overlay.style.display = 'none';
  }
}

// 待揭盘模式下克应研判提示
function renderKeyingPendingHint() {
  const content = document.getElementById('keyingContent');
  if (!content) return;
  content.innerHTML = `
    <div class="keying-pending-mask-msg" style="padding: 48px 16px; text-align: center; color: var(--md-sys-color-outline); font-size: 13px;">
      <div style="font-size: 32px; margin-bottom: 10px;">🔒</div>
      <strong style="font-size: 14.5px; color: var(--md-sys-color-primary);">已锁定起局时刻 · 待选取用神揭盘</strong>
      <div style="margin-top: 8px; font-size: 12.5px; color: var(--md-sys-color-outline); line-height: 1.6;">
        当前时刻已锁定就绪。为防先窥盘面、后悔改占，<br>请先确定所问事项与用神，确认后将自动呈现宫位全盘研判。
      </div>
    </div>
  `;
}

// 渲染头部信息区
function renderHeaderInfo(pan) {
  const p = pan;
  document.getElementById('txtSolarTime').textContent = `${p.rawInput.year}年${String(p.rawInput.month).padStart(2, '0')}月${String(p.rawInput.day).padStart(2, '0')}日 ${String(p.rawInput.hour).padStart(2, '0')}:${String(p.rawInput.minute).padStart(2, '0')}`;
  document.getElementById('txtWeekDay').textContent = `星期${p.weekDay}`;

  document.getElementById('txtCurTerm').textContent = `${p.termInfo.current.name} ${String(p.termInfo.current.month).padStart(2, '0')}-${String(p.termInfo.current.day).padStart(2, '0')} ${String(p.termInfo.current.hour).padStart(2, '0')}:${String(p.termInfo.current.minute).padStart(2, '0')}`;
  document.getElementById('txtNextTerm').textContent = `次节 ${p.termInfo.next.name} ${String(p.termInfo.next.month).padStart(2, '0')}-${String(p.termInfo.next.day).padStart(2, '0')} ${String(p.termInfo.next.hour).padStart(2, '0')}:${String(p.termInfo.next.minute).padStart(2, '0')}`;

  document.getElementById('txtTrueTime').textContent = `${p.trueTime.year}年${String(p.trueTime.month).padStart(2, '0')}月${String(p.trueTime.day).padStart(2, '0')}日 ${String(p.trueTime.hour).padStart(2, '0')}:${String(p.trueTime.minute).padStart(2, '0')}`;
  document.getElementById('txtLocation').textContent = `${p.rawInput.cityName || '北京'} (${p.rawInput.longitude}°)`;

  document.getElementById('txtLunarDate').textContent = `${p.pillars.year}年 ${p.lunar.lunarMonthName} ${p.lunar.lunarDayName}日`;
  document.getElementById('txtShichenDesc').textContent = `${p.shichenTitle}  ${p.pillars.hour[1]}时`;

  document.getElementById('txtGanzhi').textContent = `${p.pillars.year}  ${p.pillars.month}  ${p.pillars.day}  ${p.pillars.hour}`;
  document.getElementById('txtJuDesc').textContent = p.dingju.desc;

  document.getElementById('txtKongwang').innerHTML = `${p.kongwang.year}  ${p.kongwang.month}  ${p.kongwang.day}  <span class="info-red">${p.kongwang.hour}</span>`;
  document.getElementById('txtXunshou').textContent = p.xun;

  document.getElementById('txtStarFu').textContent = p.starFu;
  document.getElementById('txtFuGong').textContent = GONG_NUM[p.shiGong];
  document.getElementById('txtDoorShi').textContent = p.doorShi;
  document.getElementById('txtDoorGong').textContent = GONG_NUM[p.doorShiGong];

  // 更新九宫盘面中间显示的四柱干支或所问问题
  updateBoardCardCenter(p);

  const dingjuName = p.dingjuMethod === 'zhirun' ? '置闰' : (p.dingjuMethod === 'chaibu' ? '拆补' : '茅山');
  const paipanName = p.paipanMethod === 'zhuan' ? '排宫法' : '飞宫法';
  document.getElementById('txtMethodDesc').textContent = `${dingjuName}${paipanName}`;

  // 全盘大像 (八门反吟/伏吟，九星反吟/伏吟，五不遇时，时干入墓)
  const patterns = checkGlobalPatterns(p);
  const existingBadges = document.querySelectorAll('.ju-banner .badge-pattern');
  existingBadges.forEach(el => el.remove());
  if (patterns.badges && patterns.badges.length > 0) {
    const juBanner = document.querySelector('.ju-banner');
    if (juBanner) {
      patterns.badges.forEach(b => {
        const badgeSpan = document.createElement('span');
        badgeSpan.className = 'badge-tag-tonal badge-pattern';
        badgeSpan.textContent = b.name;
        badgeSpan.title = b.desc;
        if (b.type.includes('fan') || b.type === 'wubuyu') {
          badgeSpan.style.backgroundColor = 'var(--md-sys-color-error-container)';
          badgeSpan.style.color = 'var(--md-sys-color-error)';
          badgeSpan.style.fontWeight = '700';
        } else if (b.type === 'shimu') {
          badgeSpan.style.backgroundColor = '#fef3c7';
          badgeSpan.style.color = '#92400e';
          badgeSpan.style.fontWeight = '700';
        } else {
          badgeSpan.style.backgroundColor = 'var(--md-sys-color-tertiary-container)';
          badgeSpan.style.color = 'var(--md-sys-color-on-tertiary-container)';
        }
        juBanner.appendChild(badgeSpan);
      });
    }
  }

  // 时辰大像列表联动展现 (五不遇时 / 时干入墓)
  const itemWuBuYuRow = document.getElementById('itemWuBuYuRow');
  const txtWuBuYuDesc = document.getElementById('txtWuBuYuDesc');
  if (p.wuBuYu && p.wuBuYu.hasSpecial) {
    if (itemWuBuYuRow && txtWuBuYuDesc) {
      itemWuBuYuRow.style.display = 'flex';
      txtWuBuYuDesc.textContent = p.wuBuYu.desc;
    }
  } else {
    if (itemWuBuYuRow) itemWuBuYuRow.style.display = 'none';
  }

  // 全局大局与月令判定 (顶栏常驻，天盘与地盘双视图通用)
  updateGlobalVerdictBanner(p);
}

// 全局大局与月令判定栏
function updateGlobalVerdictBanner(p) {
  const banner = document.getElementById('globalVerdictBanner');
  const txtYueling = document.getElementById('verdictYuelingText');
  const wrapBadges = document.getElementById('verdictBadgesWrap');
  if (!banner || !txtYueling || !wrapBadges) return;

  const monthZhi = p.pillars && p.pillars.month ? (p.pillars.month.length >= 2 ? p.pillars.month[1] : p.pillars.month[0]) : '戌';
  const mElem = ZHI_ELEMENT_MAP[monthZhi] || '土';

  const YUELING_PILLS = {
    '木': [
      { text: '木旺', cls: 'pill-wang' },
      { text: '火相', cls: 'pill-xiang' },
      { text: '水休', cls: 'pill-xiu' },
      { text: '金囚', cls: 'pill-qiu' },
      { text: '土死', cls: 'pill-si' }
    ],
    '火': [
      { text: '火旺', cls: 'pill-wang' },
      { text: '土相', cls: 'pill-xiang' },
      { text: '木休', cls: 'pill-xiu' },
      { text: '水囚', cls: 'pill-qiu' },
      { text: '金死', cls: 'pill-si' }
    ],
    '土': [
      { text: '土旺', cls: 'pill-wang' },
      { text: '金相', cls: 'pill-xiang' },
      { text: '火休', cls: 'pill-xiu' },
      { text: '木囚', cls: 'pill-qiu' },
      { text: '水死', cls: 'pill-si' }
    ],
    '金': [
      { text: '金旺', cls: 'pill-wang' },
      { text: '水相', cls: 'pill-xiang' },
      { text: '土休', cls: 'pill-xiu' },
      { text: '火囚', cls: 'pill-qiu' },
      { text: '木死', cls: 'pill-si' }
    ],
    '水': [
      { text: '水旺', cls: 'pill-wang' },
      { text: '木相', cls: 'pill-xiang' },
      { text: '金休', cls: 'pill-xiu' },
      { text: '土囚', cls: 'pill-qiu' },
      { text: '火死', cls: 'pill-si' }
    ]
  };

  const pills = YUELING_PILLS[mElem] || YUELING_PILLS['土'];
  const pillsHtml = `<div class="yueling-pills-row">${pills.map(x => `<span class="yueling-pill ${x.cls}">${x.text}</span>`).join('')}</div>`;

  txtYueling.innerHTML = `<span class="yueling-main-title">月令【${monthZhi}月·${mElem}旺】</span>${pillsHtml}`;

  // 反伏吟判定 (九星影响大，八门为人事反复)
  const patterns = checkGlobalPatterns(p);
  wrapBadges.innerHTML = '';

  let hasHeavyBadge = false;

  // 九星反吟与伏吟 (天时大局)
  if (patterns.isStarFanyin) {
    hasHeavyBadge = true;
    const tag = document.createElement('span');
    tag.className = 'verdict-tag verdict-tag-danger';
    tag.textContent = '【九星反吟】大局剧变颠倒';
    tag.title = '九星全盘反吟，天时气场颠倒反复，大势易有剧烈逆转';
    wrapBadges.appendChild(tag);
  } else if (patterns.isStarFuyin) {
    hasHeavyBadge = true;
    const tag = document.createElement('span');
    tag.className = 'verdict-tag verdict-tag-warning';
    tag.textContent = '【九星伏吟】大局停滞迟缓';
    tag.title = '九星全盘伏吟，天时不至，大局难以推进';
    wrapBadges.appendChild(tag);
  }

  // 八门反吟与伏吟 (人事情绪)
  if (patterns.isMenFanyin) {
    hasHeavyBadge = true;
    const tag = document.createElement('span');
    tag.className = 'verdict-tag verdict-tag-warning';
    tag.textContent = '【八门反吟】人事反复多变';
    tag.title = '八门全盘反吟，人事反复折腾，情绪状态起伏不定';
    wrapBadges.appendChild(tag);
  } else if (patterns.isMenFuyin) {
    hasHeavyBadge = true;
    const tag = document.createElement('span');
    tag.className = 'verdict-tag verdict-tag-info';
    tag.textContent = '【八门伏吟】人事闭塞难行';
    tag.title = '八门全盘伏吟，人事受阻闭塞，宜守旧不宜进取';
    wrapBadges.appendChild(tag);
  }

  // 特殊时辰大像
  if (p.wuBuYu && p.wuBuYu.isWuBuYu) {
    hasHeavyBadge = true;
    const tag = document.createElement('span');
    tag.className = 'verdict-tag verdict-tag-danger';
    tag.textContent = '【五不遇时】人时不遇';
    tag.title = p.wuBuYu.desc;
    wrapBadges.appendChild(tag);
  } else if (p.wuBuYu && p.wuBuYu.hasSpecial) {
    hasHeavyBadge = true;
    const tag = document.createElement('span');
    tag.className = 'verdict-tag verdict-tag-warning';
    tag.textContent = '【时干入墓】事态晦暗';
    tag.title = p.wuBuYu.desc;
    wrapBadges.appendChild(tag);
  }

  if (!hasHeavyBadge) {
    const tag = document.createElement('span');
    tag.className = 'verdict-tag verdict-tag-normal';
    tag.textContent = '【局态】无特殊局';
    wrapBadges.appendChild(tag);
  }
}

// -------------------------------------------------------------
// 地盘全息重构核心引擎 (旺衰热力图、用神角色、日干气场三位、地支缩角、九宫关系层)
// -------------------------------------------------------------
const ZHI_ELEMENT_MAP = {
  '寅': '木', '卯': '木',
  '巳': '火', '午': '火',
  '申': '金', '酉': '金',
  '亥': '水', '子': '水',
  '辰': '土', '戌': '土', '丑': '土', '未': '土'
};

const GONG_ELEMENT_MAP = {
  1: '水', 2: '土', 3: '木', 4: '木', 5: '土', 6: '金', 7: '金', 8: '土', 9: '火'
};

const YANG_SIDE_GONGS = [1, 8, 3, 4]; // 阳侧：坎艮震巽
const YIN_SIDE_GONGS = [9, 2, 7, 6];  // 阴侧：离坤兑乾

// 五行旺衰计算 (以月令为纲: 同我者旺, 我生者相, 生我者休, 克我者囚, 我克者死)
function getPalaceGongshi(monthZhi, gongElem) {
  const mElem = ZHI_ELEMENT_MAP[monthZhi] || '土';
  if (gongElem === mElem) {
    return { level: '旺', desc: '当令同气，最旺', tagClass: 'tag-wang', bigClass: 'gongshi-wang' };
  }
  const SHENG_MAP = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };
  if (SHENG_MAP[mElem] === gongElem) {
    return { level: '相', desc: '令生宫位，次旺有生气', tagClass: 'tag-xiang', bigClass: 'gongshi-xiang' };
  }
  if (SHENG_MAP[gongElem] === mElem) {
    return { level: '休', desc: '宫生月令，退休退气', tagClass: 'tag-xiu', bigClass: 'gongshi-xiu' };
  }
  const KE_MAP = { '木': '土', '土': '水', '水': '火', '火': '金', '金': '木' };
  if (KE_MAP[gongElem] === mElem) {
    return { level: '囚', desc: '宫克月令，受困入囚', tagClass: 'tag-qiu', bigClass: 'gongshi-qiu' };
  }
  if (KE_MAP[mElem] === gongElem) {
    return { level: '死', desc: '令克宫位，受克极衰死', tagClass: 'tag-si', bigClass: 'gongshi-si' };
  }
  return { level: '平', desc: '中和', tagClass: 'tag-xiu', bigClass: 'gongshi-xiu' };
}

// 获取日干在九宫中的长生、临官、帝旺三宫标记
function getDayGanWangGongs(dayGan) {
  const map = TIANGAN_CHANGSHENG_MAP[dayGan] || {};
  const GONG_ZHIS = {
    1: ['子'],
    2: ['未', '申'],
    3: ['卯'],
    4: ['辰', '巳'],
    6: ['戌', '亥'],
    7: ['酉'],
    8: ['丑', '寅'],
    9: ['午']
  };
  const result = {};
  for (let g = 1; g <= 9; g++) {
    const zhis = GONG_ZHIS[g] || [];
    for (const z of zhis) {
      const stage = map[z];
      if (stage === '长生' || stage === '临官' || stage === '帝旺') {
        result[g] = stage;
        break;
      }
    }
  }
  return result;
}

const YONGSHEN_ROLE_MAP = {
  '日干': '日干·求测人',
  '时干': '时干·事态/结果',
  '值符': '值符·大局/贵人',
  '值使': '值使·执行/门面',
  '年干': '年干·长辈/上级',
  '月干': '月干·同辈/朋友',
  '开门': '开门·工作/公司',
  '生门': '生门·利润/效益',
  '休门': '休门·贵人/休养',
  '伤门': '伤门·讨债/车船',
  '杜门': '杜门·保密/技术',
  '景门': '景门·行情/文书',
  '死门': '死门·执念/地产',
  '惊门': '惊门·官讼/口舌',
  '六合': '六合·合作/中介',
  '玄武': '玄武·虚假/盗贼',
  '白虎': '白虎·凶煞/压力',
  '螣蛇': '螣蛇·变故/虚惊',
  '九天': '九天·远行/高处',
  '九地': '九地·长久/稳固',
  '太阴': '太阴·暗谋/阴护',
  '戊': '戊·资金/本金',
  '天芮': '天芮·病灶/病源',
  '马星': '马星·变动/出行'
};

function getPalaceYongShenRole(pan, gong, dayGan, hourGan, selectedYS) {
  if (!pan || !gong) return '';
  const roles = [];
  const tg = pan.tianpanGan ? pan.tianpanGan[gong] : '';
  const tj = pan.tianpanJigan ? pan.tianpanJigan[gong] : '';
  const door = pan.tianpanDoor ? pan.tianpanDoor[gong] : '';
  const star = pan.tianpanStar ? pan.tianpanStar[gong] : '';
  const spirit = pan.tianpanSpirit ? pan.tianpanSpirit[gong] : '';
  const flags = pan.palaceFlags ? pan.palaceFlags[gong] : {};
  const yearGan = pan.pillars && pan.pillars.year ? pan.pillars.year[0] : '';
  const monthGan = pan.pillars && pan.pillars.month ? pan.pillars.month[0] : '';

  const selectedList = Array.isArray(selectedYS) ? selectedYS : [];
  const selectedNames = selectedList.map(y => (typeof y === 'object' && y !== null) ? y.name : String(y)).filter(Boolean);

  // 1. 日干求测人：必须在当前天盘明确选取了 '日干' 时才赋予！未选用神绝不强行展示日干标签
  if (selectedNames.includes('日干') && (tg === dayGan || tj === dayGan)) {
    roles.push('日干·求测人');
  }

  // 2. 其余用神：严格由天盘当前选用的用神 (selectedYS) 决定！未选中的严禁赋予与展示
  if (selectedNames.includes('年干') && (tg === yearGan || tj === yearGan)) {
    roles.push('年干·大领导');
  }
  if (selectedNames.includes('月干') && (tg === monthGan || tj === monthGan)) {
    roles.push('月干·同级/同行');
  }
  if (selectedNames.includes('时干') && (tg === hourGan || tj === hourGan) && tg !== dayGan && tj !== dayGan) {
    roles.push('时干·事态');
  }
  if (selectedNames.includes('值符') && spirit === '值符') {
    roles.push('值符·大局');
  }
  if (door && (selectedNames.includes(door) || selectedNames.includes(door.replace('门', '')))) {
    roles.push(YONGSHEN_ROLE_MAP[door] || `${door}·事`);
  }
  if (selectedNames.includes('戊') && (tg === '戊' || pan.dipan?.[gong] === '戊')) {
    roles.push('戊·资金');
  }
  if (selectedNames.includes('六合') && spirit === '六合') {
    roles.push('六合·合作');
  }
  if (selectedNames.includes('天芮') && (star && star.includes('天芮'))) {
    roles.push('天芮·病灶');
  }
  if (selectedNames.includes('马星') && flags && flags.isMa) {
    roles.push('马星·变动');
  }

  // 3. 其余显式勾选的用神项（如干支、神、星等）
  selectedNames.forEach(ys => {
    if (roles.length >= 2) return;
    if (['日干', '时干', '年干', '月干', '值符', '戊', '六合', '天芮', '马星'].includes(ys)) return;
    if (door && (ys === door || ys === door.replace('门', ''))) return;

    if (spirit && ys === spirit && !roles.some(r => r.startsWith(spirit))) {
      roles.push(YONGSHEN_ROLE_MAP[spirit] || ys);
    } else if (star && star.includes(ys) && !roles.some(r => r.includes(ys))) {
      roles.push(YONGSHEN_ROLE_MAP[ys] || ys);
    } else if ((tg === ys || tj === ys) && !roles.some(r => r.startsWith(ys))) {
      roles.push(YONGSHEN_ROLE_MAP[ys] || ys);
    } else {
      const match = checkPalaceMatchYongShen(pan, gong, [ys]);
      if (match && match.matched && !roles.some(r => r.startsWith(ys))) {
        roles.push(YONGSHEN_ROLE_MAP[ys] || ys);
      }
    }
  });

  return roles.length > 0 ? roles[0] : '';
}

function getPalaceDizhiHtml(info, pan, gong) {
  const flags = pan.palaceFlags ? pan.palaceFlags[gong] : {};
  const isKong = !!(flags && flags.isKong);
  const isMa = !!(flags && flags.isMa);
  const pillarZhis = [
    pan.pillars?.year?.[1],
    pan.pillars?.month?.[1],
    pan.pillars?.day?.[1],
    pan.pillars?.hour?.[1]
  ].filter(Boolean);

  const zhiItems = info.dizhi.map(z => {
    const isPillar = pillarZhis.includes(z);
    return `<span class="dipan-zhi-char ${isPillar ? 'is-pillar' : ''}">${z}</span>`;
  }).join(' ');

  let kongBadge = isKong ? `<span class="dipan-badge-kong" title="时柱旬空">○</span>` : '';
  let maBadge = isMa ? `<span class="dipan-badge-ma" title="驿马星">马</span>` : '';

  return `
    <div class="dipan-zhi-small-wrap">
      ${zhiItems}
      ${kongBadge}
      ${maBadge}
    </div>
  `;
}

// -------------------------------------------------------------
// 地盘关系层重构：三大画法与星形生克外围绕线
// ① 生克连线：以日干为中心画星形，沿宫卡边缘与缝隙走，隔一宫走九宫外圈弧线，绝不穿过宫位中心
// ② 指向徽章 + 目标光环：人物旬空看对宫、马星去向、宫内暗冲、五行通关
// ③ 宫自身状态：月令旺衰大字、旬空、击刑留在宫卡内部
// -------------------------------------------------------------

const GONG_POS = {
  4: { r: 0, c: 0 },
  9: { r: 0, c: 1 },
  2: { r: 0, c: 2 },
  3: { r: 1, c: 0 },
  5: { r: 1, c: 1 },
  7: { r: 1, c: 2 },
  8: { r: 2, c: 0 },
  1: { r: 2, c: 1 },
  6: { r: 2, c: 2 }
};

const OPPOSITE_GONG_MAP = { 1: 9, 9: 1, 2: 8, 8: 2, 3: 7, 7: 3, 4: 6, 6: 4, 5: 2 };

// 沿宫卡缝隙与九宫外围路由连线，绝不穿过任何宫位中心
function calculateEdgeRoutePath(dayGong, targetGong, arrowDir, bounds) {
  const b1 = bounds[dayGong];
  const b2 = bounds[targetGong];
  const p1 = GONG_POS[dayGong];
  const p2 = GONG_POS[targetGong];
  if (!b1 || !b2 || !p1 || !p2) return null;

  // arrowDir: 'to_day' -> 对方指向日干 (from b2 to b1)
  // arrowDir: 'to_target' -> 日干指向对方 (from b1 to b2)
  // arrowDir: 'none' -> 同气双向
  const isToDay = (arrowDir === 'to_day');

  // 1. 同行隔一宫 (列差 2，走九宫上外圈或下外圈光滑弧线，彻底避开坎宫与中宫内部，绝不遮挡坎宫“死”字或任何宫位大字)
  if (p1.r === p2.r && Math.abs(p1.c - p2.c) === 2) {
    const isBottomRow = (p1.r === 2); // 艮 8 到 乾 6，中间是坎 1
    const midGong = isBottomRow ? 1 : 9;
    const bMid = bounds[midGong];
    const midX = bMid ? bMid.cx : (b1.cx + b2.cx) / 2;

    if (isBottomRow) {
      // 走底边外圈光滑弧线 (艮 8 到 乾 6)
      const ctrlY = (bMid ? bMid.bottom : Math.max(b1.bottom, b2.bottom)) + 16;
      let sx = isToDay ? b2.cx : b1.cx;
      let sy = isToDay ? b2.bottom : b1.bottom;
      let ex = isToDay ? b1.cx : b2.cx;
      let ey = isToDay ? b1.bottom : b2.bottom;
      return {
        d: `M ${sx} ${sy} Q ${midX} ${ctrlY} ${ex} ${ey}`,
        lx: midX,
        ly: ctrlY
      };
    } else {
      // 走顶边外圈光滑弧线 (如巽 4 到 坤 2，中间是离 9)
      const ctrlY = (bMid ? bMid.top : Math.min(b1.top, b2.top)) - 16;
      let sx = isToDay ? b2.cx : b1.cx;
      let sy = isToDay ? b2.top : b1.top;
      let ex = isToDay ? b1.cx : b2.cx;
      let ey = isToDay ? b1.top : b2.top;
      return {
        d: `M ${sx} ${sy} Q ${midX} ${ctrlY} ${ex} ${ey}`,
        lx: midX,
        ly: ctrlY
      };
    }
  }

  // 2. 同列隔一宫 (行差 2，走九宫左外圈或右外圈光滑弧线)
  if (p1.c === p2.c && Math.abs(p1.r - p2.r) === 2) {
    const isLeftCol = (p1.c === 0); // 艮 8 到 巽 4，中间是震 3
    const midGong = isLeftCol ? 3 : 7;
    const bMid = bounds[midGong];
    const midY = bMid ? bMid.cy : (b1.cy + b2.cy) / 2;

    if (isLeftCol) {
      const ctrlX = (bMid ? bMid.left : Math.min(b1.left, b2.left)) - 16;
      let sx = isToDay ? b2.left : b1.left;
      let sy = isToDay ? b2.cy : b1.cy;
      let ex = isToDay ? b1.left : b2.left;
      let ey = isToDay ? b1.cy : b2.cy;
      return {
        d: `M ${sx} ${sy} Q ${ctrlX} ${midY} ${ex} ${ey}`,
        lx: ctrlX,
        ly: midY
      };
    } else {
      const ctrlX = (bMid ? bMid.right : Math.max(b1.right, b2.right)) + 16;
      let sx = isToDay ? b2.right : b1.right;
      let sy = isToDay ? b2.cy : b1.cy;
      let ex = isToDay ? b1.right : b2.right;
      let ey = isToDay ? b1.cy : b2.cy;
      return {
        d: `M ${sx} ${sy} Q ${ctrlX} ${midY} ${ex} ${ey}`,
        lx: ctrlX,
        ly: midY
      };
    }
  }

  // 3. 其余所有情况 (相邻垂直、相邻水平、对角跨宫如艮 8 到坤 2 等)：统一改为直接连直线
  const dx = b2.cx - b1.cx;
  const dy = b2.cy - b1.cy;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;

  let scale1, scale2;
  if (dist < 190) {
    // 宫位相邻近 (水平、垂直或对角相邻)：
    // 若止于宫位边缘，间隙仅 4~8px，会导致 36px 徽章与箭头直接重合挤压。
    // 因此起点/终点延伸至宫内（大字外圈半径 22px 处），保证充足线长与箭头出挑空间，绝不遮挡大字
    scale1 = 22;
    scale2 = 22;
  } else {
    // 跨宫远距离：止于宫卡边缘并为放大后的锐利箭头预留 5px 落位空间
    const hw1 = b1.width / 2;
    const hh1 = b1.height / 2;
    scale1 = Math.max(0, Math.min(Math.abs(hw1 / (ux || 0.0001)), Math.abs(hh1 / (uy || 0.0001))) - 5);

    const hw2 = b2.width / 2;
    const hh2 = b2.height / 2;
    scale2 = Math.max(0, Math.min(Math.abs(hw2 / (ux || 0.0001)), Math.abs(hh2 / (uy || 0.0001))) - 5);
  }

  const pStart = { x: b1.cx + ux * scale1, y: b1.cy + uy * scale1 };
  const pEnd = { x: b2.cx - ux * scale2, y: b2.cy - uy * scale2 };

  let sx = isToDay ? pEnd.x : pStart.x;
  let sy = isToDay ? pEnd.y : pStart.y;
  let ex = isToDay ? pStart.x : pEnd.x;
  let ey = isToDay ? pStart.y : pEnd.y;

  return {
    d: `M ${sx} ${sy} L ${ex} ${ey}`,
    lx: (b1.cx + b2.cx) / 2,
    ly: (b1.cy + b2.cy) / 2
  };
}

// 计算日干视角的五行生克关系
const SHENG_MAP_CYCLE = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };
const KE_MAP_CYCLE = { '木': '土', '土': '水', '水': '火', '火': '金', '金': '木' };

function getShengkeRelation(dayElem, targetElem, isFar) {
  let relType = '';
  let label = '';
  let color = '';
  let arrowDir = ''; // 'to_day' | 'to_target' | 'none'
  let badgeClass = '';
  let roleDesc = '';

  if (targetElem === dayElem) {
    relType = 'tongqi';
    label = isFar ? '同气·远' : '同气';
    color = '#94a3b8';
    arrowDir = 'none';
    badgeClass = 'badge-tongqi';
    roleDesc = isFar ? '比肩同气帮扶，隔着太极线，远' : '比肩同气帮扶，同在阳侧近，呼应直接';
  } else if (SHENG_MAP_CYCLE[targetElem] === dayElem) {
    // 对方生我 (得生)
    relType = 'sheng';
    label = isFar ? '得生·远' : '得生';
    color = '#10b981';
    arrowDir = 'to_day';
    badgeClass = 'badge-sheng';
    roleDesc = isFar ? '对方生我，源源供给，隔着太极线，需借力引渡' : '对方生我，得益得助，近在身旁，受生直接';
  } else if (SHENG_MAP_CYCLE[dayElem] === targetElem) {
    // 我生对方 (被泄)
    relType = 'xie';
    label = isFar ? '被泄·远' : '被泄';
    color = '#f59e0b';
    arrowDir = 'to_target';
    badgeClass = 'badge-xie';
    roleDesc = isFar ? '我在为这件事付出、被消耗。隔着太极线，远' : '我生对方，倾注精力被泄耗，近在身边，付出直接';
  } else if (KE_MAP_CYCLE[targetElem] === dayElem) {
    // 对方克我 (被克)
    relType = 'ke';
    label = isFar ? '被克·远' : '被克';
    color = '#ef4444';
    arrowDir = 'to_day';
    badgeClass = 'badge-ke';
    roleDesc = isFar ? '对方克我，受制受压，隔着太极线，压力渐近' : '对方克我，大局压着我。同在阳侧近，压力直接';
  } else if (KE_MAP_CYCLE[dayElem] === targetElem) {
    // 我克对方 (我克)
    relType = 'woke';
    label = isFar ? '我克·远' : '我克';
    color = '#3b82f6';
    arrowDir = 'to_target';
    badgeClass = 'badge-woke';
    roleDesc = isFar ? '我克掌控求取，隔着太极线，远水难救近火' : '我克掌控求取，同侧近，得心应手';
  }

  return { relType, label, color, arrowDir, badgeClass, roleDesc };
}

// 渲染九宫关系层 (三大画法)
function renderDipanRelations(pan, focusGong = 0) {
  const gridEl = document.getElementById('nineGrid');
  const svgEl = document.getElementById('dipanRelationOverlay');
  if (!gridEl) return;

  // 清除所有宫格的光环、角标与悬浮胶囊
  document.querySelectorAll('.palace-cell').forEach(c => {
    c.classList.remove(
      'has-target-halo-kong',
      'has-target-halo-ma',
      'has-target-halo-chong',
      'has-target-halo-tongguan',
      'is-dipan-dimmed'
    );
    c.querySelectorAll('.dipan-corner-badge, .dipan-target-pill').forEach(el => el.remove());
  });

  // 如果非地盘模式，隐藏相关元素并返回
  if (!state.showDipan || !pan) {
    if (svgEl) svgEl.innerHTML = '';
    return;
  }

  if (!svgEl) return;

  const width = gridEl.clientWidth || 360;
  const height = gridEl.clientHeight || 360;
  svgEl.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svgEl.innerHTML = '';

  const gridRect = gridEl.getBoundingClientRect();
  const bounds = {};
  for (let g = 1; g <= 9; g++) {
    const c = document.getElementById(`cellGong${g}`);
    if (c) {
      const r = c.getBoundingClientRect();
      bounds[g] = {
        left: r.left - gridRect.left,
        top: r.top - gridRect.top,
        right: r.right - gridRect.left,
        bottom: r.bottom - gridRect.top,
        width: r.width,
        height: r.height,
        cx: r.left - gridRect.left + r.width / 2,
        cy: r.top - gridRect.top + r.height / 2
      };
    }
  }

  const defs = `
    <defs>
      <marker id="relArrGreen" markerUnits="userSpaceOnUse" viewBox="0 0 14 14" refX="7" refY="7" markerWidth="15" markerHeight="15" orient="auto">
        <path d="M 1.5 1.5 L 13 7 L 1.5 12.5 L 4 7 z" fill="#10b981" />
      </marker>
      <marker id="relArrOrange" markerUnits="userSpaceOnUse" viewBox="0 0 14 14" refX="7" refY="7" markerWidth="15" markerHeight="15" orient="auto">
        <path d="M 1.5 1.5 L 13 7 L 1.5 12.5 L 4 7 z" fill="#f59e0b" />
      </marker>
      <marker id="relArrRed" markerUnits="userSpaceOnUse" viewBox="0 0 14 14" refX="7" refY="7" markerWidth="15" markerHeight="15" orient="auto">
        <path d="M 1.5 1.5 L 13 7 L 1.5 12.5 L 4 7 z" fill="#ef4444" />
      </marker>
      <marker id="relArrBlue" markerUnits="userSpaceOnUse" viewBox="0 0 14 14" refX="7" refY="7" markerWidth="15" markerHeight="15" orient="auto">
        <path d="M 1.5 1.5 L 13 7 L 1.5 12.5 L 4 7 z" fill="#3b82f6" />
      </marker>
      <marker id="relArrGray" markerUnits="userSpaceOnUse" viewBox="0 0 14 14" refX="7" refY="7" markerWidth="15" markerHeight="15" orient="auto">
        <path d="M 1.5 1.5 L 13 7 L 1.5 12.5 L 4 7 z" fill="#94a3b8" />
      </marker>
    </defs>
  `;

  const MARKER_ID_MAP = {
    '#10b981': 'relArrGreen',
    '#f59e0b': 'relArrOrange',
    '#ef4444': 'relArrRed',
    '#3b82f6': 'relArrBlue',
    '#94a3b8': 'relArrGray'
  };

  const dayGan = pan.pillars?.day?.[0] || '';
  const hourGan = pan.pillars?.hour?.[0] || '';
  const selectedYS = Array.isArray(state.selectedYongShen) ? state.selectedYongShen : [];
  const selectedNames = selectedYS.map(y => (typeof y === 'object' && y !== null) ? y.name : String(y)).filter(Boolean);

  // 1. 收集当前天盘实际选取的全部用神落宫 (排除中五宫 5)
  const yongShenPalaces = [];
  const seenYsGongs = new Set();

  for (let g = 1; g <= 9; g++) {
    if (g === 5) continue;
    const match = checkPalaceMatchYongShen(pan, g, selectedNames);
    if (match && match.matched) {
      const role = getPalaceYongShenRole(pan, g, dayGan, hourGan, selectedYS) || (match.items && match.items[0]) || '用神';
      yongShenPalaces.push({
        gong: g,
        role,
        element: GONG_ELEMENT_MAP[g]
      });
      seenYsGongs.add(g);
    }
  }

  // 2. 动态中心宫位：由用户当前点击的宫位决定（不再固定日干）
  let centerGong = focusGong || state.selectedDipanGong || state.selectedGong || 0;

  // 若初始进入地盘未显式点击，且当前中心不是用神宫，若有用神落宫则默认以第一个用神宫为中心
  if ((!centerGong || !seenYsGongs.has(centerGong)) && yongShenPalaces.length > 0 && !focusGong) {
    centerGong = yongShenPalaces[0].gong;
    state.selectedDipanGong = centerGong;
    state.selectedGong = centerGong;
    document.querySelectorAll('.palace-cell').forEach(c => {
      const g = parseInt(c.dataset.gong);
      c.classList.toggle('selected', g === centerGong);
      c.classList.toggle('is-dipan-selected', g === centerGong);
    });
  }

  // 用户明确指令：如果天盘没有选取这个宫位作为用神，不展示关系！根据用神动态展示
  const isCenterInYongShen = seenYsGongs.has(centerGong);
  if (!isCenterInYongShen) {
    svgEl.innerHTML = '';
    return;
  }

  const centerItem = yongShenPalaces.find(y => y.gong === centerGong);
  const centerElem = GONG_ELEMENT_MAP[centerGong];
  const targets = yongShenPalaces.filter(y => y.gong !== centerGong);

  const summaryRelations = [];

  // -----------------------------------------------------------
  // 画法 ①：以当前点击的用神宫位为中心，展示与天盘选取的其他用神之间的五行生克连线
  // -----------------------------------------------------------
  if (state.dipanShowShengke !== false && centerGong && bounds[centerGong]) {
    targets.forEach(tg => {
      const tgElem = GONG_ELEMENT_MAP[tg.gong];
      if (!tgElem || !bounds[tg.gong]) return;

      const isFar = (YANG_SIDE_GONGS.includes(centerGong) !== YANG_SIDE_GONGS.includes(tg.gong));
      const rel = getShengkeRelation(centerElem, tgElem, state.dipanShowYuanjin ? isFar : false);

      const route = calculateEdgeRoutePath(centerGong, tg.gong, rel.arrowDir, bounds);
      if (!route) return;

      const pInfoCenter = DIPAN_PALACE_INFO[centerGong];
      const pInfoTg = DIPAN_PALACE_INFO[tg.gong];
      const centerRole = centerItem.role ? centerItem.role.split('·')[0] : pInfoCenter.name;
      const tgRole = tg.role ? tg.role.split('·')[0] : pInfoTg.name;

      let title = '';
      if (rel.arrowDir === 'to_day') {
        title = `${tgRole}（${pInfoTg.name}·${tgElem}）→ ${centerRole}（${pInfoCenter.name}·${centerElem}）`;
      } else if (rel.arrowDir === 'to_target') {
        title = `${centerRole}（${pInfoCenter.name}·${centerElem}）→ ${tgRole}（${pInfoTg.name}·${tgElem}）`;
      } else {
        title = `${centerRole}（${pInfoCenter.name}·${centerElem}）↔ ${tgRole}（${pInfoTg.name}·${tgElem}）`;
      }

      const markerId = (rel.arrowDir !== 'none') ? MARKER_ID_MAP[rel.color] : null;
      summaryRelations.push({
        id: `rel-sk-${centerGong}-${tg.gong}`,
        type: 'shengke',
        gongs: [centerGong, tg.gong],
        title,
        badgeText: rel.label,
        badgeClass: rel.badgeClass,
        desc: rel.roleDesc,
        svgPath: route.d,
        color: rel.color,
        strokeWidth: isFar && state.dipanShowYuanjin ? 1.8 : 3.2,
        markerId,
        lx: route.lx,
        ly: route.ly,
        labelText: rel.label
      });
    });
  }

  // -----------------------------------------------------------
  // 画法 ②：指向徽章 + 目标光环 (旬空看对宫、马星去向、宫内暗冲)
  // -----------------------------------------------------------
  if (state.dipanShowDuigong !== false) {
    // 1. 旬空处理 (当前点击的用神宫落空时，在对宫套上光环)
    for (let g = 1; g <= 9; g++) {
      if (pan.palaceFlags?.[g]?.isKong) {
        if (g === centerGong) {
          const opp = OPPOSITE_GONG_MAP[g];
          const oppCell = document.getElementById(`cellGong${opp}`);
          if (oppCell) {
            oppCell.classList.add('has-target-halo-kong');
          }
        }
      }
    }

    // 2. 马星去向
    for (let g = 1; g <= 9; g++) {
      if (pan.palaceFlags?.[g]?.isMa) {
        const opp = OPPOSITE_GONG_MAP[g];
        const pInfo = DIPAN_PALACE_INFO[g];
        const oppInfo = DIPAN_PALACE_INFO[opp];
        const cell = document.getElementById(`cellGong${g}`);
        const oppCell = document.getElementById(`cellGong${opp}`);

        if (oppCell && oppInfo) {
          oppCell.classList.add('has-target-halo-ma');
          const pill = document.createElement('span');
          pill.className = 'dipan-target-pill pill-ma-target';
          pill.textContent = '马星所指';
          pill.title = `马星动态直指${oppInfo.name}，主动应变之方`;
          oppCell.appendChild(pill);

          summaryRelations.push({
            id: `rel-ma-${g}`,
            type: 'ma',
            gongs: [g, opp],
            title: `马星在${pInfo.name} → 奔赴${oppInfo.name}`,
            badgeText: '马星所指',
            badgeClass: 'badge-xie',
            desc: `气场变动与奔波去向直指${oppInfo.name}，主动应变之方`
          });
        }
      }
    }
  }

  // -----------------------------------------------------------
  // 绘制 SVG 连线与标签 (地盘主要用来看大象，全量清晰展示，不搞局部聚焦变暗)
  // -----------------------------------------------------------
  let pathsHtml = '';
  summaryRelations.forEach(r => {
    if (!r.svgPath) return;
    const markerAttr = r.markerId ? `marker-end="url(#${r.markerId})"` : '';
    const labelW = (r.labelText || '').length >= 4 ? 48 : 36;

    pathsHtml += `
      <g class="dipan-rel-path-group" data-rel-id="${r.id}" opacity="1">
        <path d="${r.svgPath}" fill="none" stroke="${r.color}" stroke-width="${r.strokeWidth}" ${markerAttr} />
        <g class="dipan-rel-label" transform="translate(${r.lx}, ${r.ly})">
          <rect x="-${labelW / 2}" y="-9" width="${labelW}" height="18" rx="9" fill="${r.color}" opacity="1" />
          <text x="0" y="3.5" fill="#ffffff" font-size="10" font-weight="700" text-anchor="middle">${r.labelText}</text>
        </g>
      </g>
    `;
  });
  svgEl.innerHTML = defs + pathsHtml;

  // 保证所有宫格不被变暗，地盘保持大象全景
  document.querySelectorAll('.palace-cell').forEach(c => c.classList.remove('is-dipan-dimmed'));
}

// 初始化地盘图例开关事件绑定
function initDipanLegendToggles() {
  const btnShengke = document.getElementById('btnToggleRelShengke');
  const btnDuigong = document.getElementById('btnToggleRelDuigong');
  const btnYuanjin = document.getElementById('btnToggleRelYuanjin');

  if (btnShengke) {
    btnShengke.classList.toggle('active', !!state.dipanShowShengke);
    btnShengke.addEventListener('click', () => {
      state.dipanShowShengke = !state.dipanShowShengke;
      btnShengke.classList.toggle('active', state.dipanShowShengke);
      if (state.currentPan && state.showDipan) {
        renderDipanRelations(state.currentPan, state.selectedDipanGong || 0);
      }
    });
  }

  if (btnDuigong) {
    btnDuigong.classList.toggle('active', !!state.dipanShowDuigong);
    btnDuigong.addEventListener('click', () => {
      state.dipanShowDuigong = !state.dipanShowDuigong;
      btnDuigong.classList.toggle('active', state.dipanShowDuigong);
      if (state.currentPan && state.showDipan) {
        renderDipanRelations(state.currentPan, state.selectedDipanGong || 0);
      }
    });
  }

  if (btnYuanjin) {
    btnYuanjin.classList.toggle('active', !!state.dipanShowYuanjin);
    btnYuanjin.addEventListener('click', () => {
      state.dipanShowYuanjin = !state.dipanShowYuanjin;
      btnYuanjin.classList.toggle('active', state.dipanShowYuanjin);
      if (state.currentPan && state.showDipan) {
        renderDipanRelations(state.currentPan, state.selectedDipanGong || 0);
      }
    });
  }
}

// 渲染重构后的地盘全息卡片 (对应新布局：旺衰热力图、用神角色、日干气场、地支缩角)
function renderDipanPalaces(pan, gongs) {
  const gridEl = document.getElementById('nineGrid');
  if (gridEl) {
    gridEl.classList.remove('has-yongshen-active', 'mask-weakened');
    gridEl.classList.add('is-dipan-mode');
  }

  const monthZhi = pan.pillars && pan.pillars.month ? (pan.pillars.month.length >= 2 ? pan.pillars.month[1] : pan.pillars.month[0]) : '戌';
  const dayGan = pan.pillars && pan.pillars.day ? pan.pillars.day[0] : '';
  const hourGan = pan.pillars && pan.pillars.hour ? pan.pillars.hour[0] : '';
  const selectedYS = Array.isArray(state.selectedYongShen) ? state.selectedYongShen : [];
  const dayWangGongs = getDayGanWangGongs(dayGan);

  gongs.forEach(g => {
    const cell = document.getElementById(`cellGong${g}`);
    if (!cell) return;
    cell.classList.remove('is-yongshen', 'is-yongshen-zhifu', 'is-yongshen-opposite-kong', 'is-palace-dimmed', 'is-yang-side', 'is-yin-side', 'is-center-gong');
    cell.classList.add('is-dipan-cell');
    cell.classList.toggle('is-dipan-selected', g === (state.selectedDipanGong || 0));
    cell.removeAttribute('title');

    // 阴阳侧底色标记 (太极线远近)
    if (YANG_SIDE_GONGS.includes(g)) {
      cell.classList.add('is-yang-side');
    } else if (YIN_SIDE_GONGS.includes(g)) {
      cell.classList.add('is-yin-side');
    } else {
      cell.classList.add('is-center-gong');
    }

    const info = DIPAN_PALACE_INFO[g];
    const dg = pan.dipan[g] || '';
    const gongElem = info.element || '土';
    const gongshi = getPalaceGongshi(monthZhi, gongElem);

    // 1. 中五宫特殊处理
    if (g === 5) {
      cell.innerHTML = `
        <div class="dipan-cell-content gong-5">
          <div class="dipan-row-top">
            <div class="dipan-num-wx">
              <span class="dipan-num">5</span>
              <span class="dipan-wx">土</span>
            </div>
            <div class="dipan-top-right">
              <span class="dipan-cur-stem-tag" title="本局地盘奇仪: ${dg || '戊'}">${dg || '戊'}</span>
              <span class="dipan-dir-tag">中</span>
            </div>
          </div>
          <div class="dipan-row-mid">
            <div class="dipan-center-box">
              <span class="dipan-gongshi-big ${gongshi.bigClass}">${gongshi.level}</span>
              <span class="dipan-center-sub">中宫 · 皇极寄坤</span>
            </div>
          </div>
          <div class="dipan-row-bot">
            <div class="dipan-bot-left">
              <span class="dipan-desc" style="color: var(--md-sys-color-outline);">皇极无卦 · 寄坤二</span>
            </div>
            <div class="dipan-bot-right">
              <span class="dipan-zhi-small-wrap"><span class="dipan-zhi-char">戊己</span></span>
            </div>
          </div>
        </div>
      `;
      return;
    }

    // 2. 用神角色标签（没有就不显示）
    const yongShenRole = getPalaceYongShenRole(pan, g, dayGan, hourGan, selectedYS);
    const roleHtml = yongShenRole ? `<div class="dipan-yongshen-role ${yongShenRole.includes('值符') ? 'is-zhifu' : ''}" title="${yongShenRole}">［${escapeHtml(yongShenRole)}］</div>` : '';

    // 3. 日干气场标记 (只在长生、临官、帝旺三宫出现)
    const dayStage = dayWangGongs[g];
    const energyHtml = dayStage ? `<div class="dipan-daygan-energy" title="日干【${dayGan}】之${dayStage}气场"><span class="energy-icon">◎</span>${dayStage}</div>` : '';

    // 4. 地盘寄干 (坤二宫寄干)
    let jiganTag = '';
    if (g === 2 && pan.dipan[5]) {
      jiganTag = `<span class="dipan-jigan-tag" title="中五寄干: ${pan.dipan[5]}">${pan.dipan[5]}</span>`;
    }

    // 5. 地支缩角 HTML (挂空、马、四柱标记)
    const dizhiCornerHtml = getPalaceDizhiHtml(info, pan, g);

    cell.innerHTML = `
      <div class="dipan-cell-content">
        <div class="dipan-row-top">
          <div class="dipan-num-wx">
            <span class="dipan-num">${info.num}</span>
            <span class="dipan-wx">${info.element}</span>
          </div>
          <div class="dipan-top-right">
            ${jiganTag}
            <span class="dipan-cur-stem-tag" title="本局地盘奇仪: ${dg}">${dg}</span>
            <span class="dipan-dir-tag">${info.direction}</span>
          </div>
        </div>

        <div class="dipan-row-mid">
          ${roleHtml}
          <div class="dipan-gongshi-big ${gongshi.bigClass}">${gongshi.level}</div>
          ${energyHtml}
        </div>

        <div class="dipan-row-bot">
          <div class="dipan-bot-left">
            <span class="dipan-trigram">${info.trigram}</span>
            <span class="dipan-desc">${info.trigramDesc}</span>
          </div>
          <div class="dipan-bot-right">
            ${dizhiCornerHtml}
          </div>
        </div>
      </div>
    `;
  });

  // 绘制九宫之上的关系层连线 (生克连线、空亡看对宫、马星去向、暗冲) - 仅在点击对应宫格时才绘制
  requestAnimationFrame(() => {
    renderDipanRelations(pan, state.selectedDipanGong || 0);
  });
}

// 渲染九宫格
function renderNinePalaces(pan) {
  const gongs = [4, 9, 2, 3, 5, 7, 8, 1, 6];

  // 地盘全息基盘视图
  if (state.showDipan) {
    renderDipanPalaces(pan, gongs);
    return;
  }

  // 切换为天盘时，清空地盘关系层 SVG 覆盖层与聚焦状态
  state.selectedDipanGong = 0;
  renderDipanRelations(pan, 0);
  const relSvg = document.getElementById('dipanRelationOverlay');
  if (relSvg) relSvg.innerHTML = '';
  document.querySelectorAll('.palace-cell').forEach(c => c.classList.remove('is-dipan-selected'));

  // 预先计算所有宫位的用神匹配与旬空状态 (人/物逢空看对冲宫，事逢空不看对面)
  const matchResByGong = {};
  const emptyYongShenPalaces = []; // 落有用神且逢旬空的宫位
  const oppositePalacesOfKong = new Map(); // 对冲宫位 -> 来源旬空宫位及用神信息

  const isPersonOrObj = isYongShenPersonOrObject(state.selectedYongShen, state.userQuestion, state.yongshenNature);
  const lookOppositeActive = (!state.showDipan && state.kongLookOpposite && isPersonOrObj);

  const hasYongShen = (!state.showDipan && state.selectedYongShen && state.selectedYongShen.length > 0);
  const gridEl = document.getElementById('nineGrid');
  if (gridEl) {
    gridEl.classList.remove('is-dipan-mode');
    gridEl.classList.toggle('has-yongshen-active', !!hasYongShen);
    gridEl.classList.toggle('mask-weakened', !!(hasYongShen && state.maskWeakened));
    gridEl.classList.toggle('grid-picking-mode', !!state.isGridPickingMode);
  }

  if (hasYongShen) {
    gongs.forEach(g => {
      const matchRes = checkPalaceMatchYongShen(pan, g, state.selectedYongShen);
      matchResByGong[g] = matchRes;
      if (matchRes.matched) {
        const isKong = !!(pan.palaceFlags[g] && pan.palaceFlags[g].isKong);
        if (isKong && lookOppositeActive) {
          emptyYongShenPalaces.push(g);
          const opp = (g === 5 ? 2 : (10 - g));
          oppositePalacesOfKong.set(opp, { originGong: g, items: matchRes.items });
        }
      }
    });
  }

  gongs.forEach(g => {
    const cell = document.getElementById(`cellGong${g}`);
    if (!cell) return;

    if (g === 5 && pan.paipanMethod === 'zhuan') {
      // 转盘中五正宫: 居中显示地盘戊，右上角为旬空看对宫切换按钮，左上角为减弱非用神蒙版按钮
      const isKongOppActive = state.kongLookOpposite;
      const kongBtnHtml = `
        <button type="button" class="btn-center-kong-toggle ${isKongOppActive ? 'is-solid' : 'is-hollow'}" id="btnCenterKongToggle" title="${isKongOppActive ? '旬空看对宫：已开启（实心·显示淡蓝色光圈，点击切换为不显示）' : '旬空看对宫：已关闭（空圈·不显示，点击切换为显示淡蓝色光圈）'}" aria-label="旬空看对宫切换">
          <span class="kong-icon"></span>
        </button>
      `;
      const isMaskWeakened = state.maskWeakened;
      const maskBtnHtml = `
        <button type="button" class="btn-center-mask-toggle ${isMaskWeakened ? 'is-solid' : 'is-hollow'}" id="btnCenterMaskToggle" title="${isMaskWeakened ? '运筹模式与蒙版减弱：已开启（实心·金黄色标记三吉，方便通盘运筹，点击恢复正常）' : '运筹模式与蒙版减弱：已关闭（空圈·点击开启金黄色标记三吉与减弱非用神蒙版）'}" aria-label="运筹与减弱非用神蒙版切换">
          <span class="mask-icon"></span>
        </button>
      `;
      cell.innerHTML = `
        ${maskBtnHtml}
        <div class="cell-center-content" title="${pan.dipan[5] || '戊'}">
          ${pan.dipan[5] || '戊'}
        </div>
        ${kongBtnHtml}
      `;
      cell.classList.remove('is-yongshen', 'is-yongshen-zhifu', 'is-yongshen-opposite-kong', 'is-dipan-cell', 'has-lucky-3', 'has-lucky-2', 'has-lucky-1');
      cell.removeAttribute('data-lucky-count');
      if (hasYongShen) {
        cell.classList.add('is-palace-dimmed');
      } else {
        cell.classList.remove('is-palace-dimmed');
      }
      cell.removeAttribute('title');
      return;
    }

    const spirit = pan.tianpanSpirit[g] || '';
    const flag = pan.palaceFlags[g];
    const isFuSpirit = spirit === '值符';
    const isShiDoor = g === pan.doorShiGong;

    let star = pan.tianpanStar[g] || '';
    const door = pan.tianpanDoor[g] || '';

    // 运筹模式三吉研判 (天辅、天心、天任为吉星；开、休、生为吉门；值符、太阴、六合、九天为吉神)
    let isLuckyStar = false;
    let isLuckyDoor = false;
    let isLuckySpirit = false;
    let luckyCount = 0;

    if (state.maskWeakened) {
      isLuckyStar = ['天辅', '天心', '天任'].some(s => star.includes(s));
      isLuckyDoor = ['开门', '休门', '生门', '开', '休', '生'].some(d => door.includes(d));
      isLuckySpirit = ['值符', '太阴', '六合', '九天'].includes(spirit);
      luckyCount = (isLuckyStar ? 1 : 0) + (isLuckyDoor ? 1 : 0) + (isLuckySpirit ? 1 : 0);
    }

    // 第一行: 八神 + 空亡/马星
    const isSpiritPicked = state.selectedYongShen && (state.selectedYongShen.includes(spirit) || (isFuSpirit && state.selectedYongShen.includes('值符')));
    let spiritClass = `spirit-tag ${isFuSpirit ? 'is-fu' : ''} ${isSpiritPicked ? 'is-picked-symbol' + (isFuSpirit ? ' is-zhifu-symbol' : '') : ''}`;
    let spiritTip = spirit;
    if (state.maskWeakened && isLuckySpirit && luckyCount > 0) {
      spiritClass += ` is-lucky-symbol lucky-lv-${luckyCount}`;
      spiritTip = `【运筹·吉神】${spirit}（本宫${luckyCount}吉）`;
    }

    const isKongPicked = state.selectedYongShen && (
      state.selectedYongShen.includes('空亡') ||
      state.selectedYongShen.includes('旬空') ||
      state.selectedYongShen.includes(`空亡•${GONG_CN[g]}宫`) ||
      state.selectedYongShen.includes(`旬空•${GONG_CN[g]}宫`) ||
      state.selectedYongShen.includes(`旬空亡•${GONG_CN[g]}宫`) ||
      state.selectedYongShen.includes(`空亡•${GONG_CN[g]}`) ||
      state.selectedYongShen.includes(`旬空•${GONG_CN[g]}`) ||
      state.selectedYongShen.includes(`旬空亡•${GONG_CN[g]}`)
    );
    const isMaPicked = state.selectedYongShen && state.selectedYongShen.includes('马星');

    // 天盘出现马星和旬空重叠时，把马星放到旬空的右边
    const hasBothKongAndMa = !!(flag.hasMa && flag.isKong);
    let maInSpiritBoxHtml = '';
    let maHtml = '';

    if (flag.hasMa) {
      const maSpan = `<span class="badge-ma ${isMaPicked ? 'is-picked-symbol' : ''}" title="驿马星（主动、出行、速变）">马</span>`;
      if (hasBothKongAndMa) {
        maInSpiritBoxHtml = maSpan;
      } else {
        maHtml = `<div class="palace-ma-wrap">${maSpan}</div>`;
      }
    }

    const spiritHtml = `
      <div class="cell-row-top">
        <div class="spirit-box">
          <span class="${spiritClass}" title="${spiritTip}">${spirit}</span>
          ${flag.isKong ? `<span class="badge-kong ${isKongPicked ? 'is-picked-symbol' : ''}">○</span>` : ''}
          ${maInSpiritBoxHtml}
        </div>
      </div>
    `;

    const isTianRui = star.includes('天芮');
    const hasTianQin = isTianRui || star.includes('天禽') || !!pan.tianpanJigan[g];

    const tg = pan.tianpanGan[g] || '';
    const isHighlightPurple = (tg === pan.dayGan || tg === pan.shiGan);
    const isTgPicked = state.selectedYongShen && (
      state.selectedYongShen.includes(tg) ||
      (tg === pan.dayGan && state.selectedYongShen.includes('日干')) ||
      (tg === pan.shiGan && state.selectedYongShen.includes('时干')) ||
      (pan.pillars && pan.pillars.year && tg === pan.pillars.year[0] && state.selectedYongShen.includes('年干')) ||
      (pan.pillars && pan.pillars.month && tg === pan.pillars.month[0] && state.selectedYongShen.includes('月干')) ||
      (HE_GAN_MAP[pan.dayGan] && tg === HE_GAN_MAP[pan.dayGan] && state.selectedYongShen.includes('合干'))
    );
    let tgClass = isHighlightPurple ? 'tian-gan highlight-purple' : 'tian-gan';
    if (isTgPicked) tgClass += ' is-picked-symbol';

    let tianJiganHtml = '';
    if (pan.tianpanJigan[g]) {
      const isTjPicked = state.selectedYongShen && (
        state.selectedYongShen.includes(pan.tianpanJigan[g]) ||
        (pan.tianpanJigan[g] === pan.dayGan && state.selectedYongShen.includes('日干')) ||
        (pan.tianpanJigan[g] === pan.shiGan && state.selectedYongShen.includes('时干'))
      );
      tianJiganHtml = `<span class="tian-jigan-stem ${isTjPicked ? 'is-picked-symbol' : ''}">${pan.tianpanJigan[g]}</span>`;
    }

    const starWang = getStarWangshuaiAnalysis(isTianRui ? '天芮' : star, g, pan);
    let starTip = starWang && starWang.text ? `${star}星（${starWang.text}）` : `${star}星`;
    if (hasTianQin) {
      const qinWang = getStarWangshuaiAnalysis('天禽', g, pan);
      const ruiPart = starWang && starWang.text ? `天芮星（${starWang.text}）` : '天芮星';
      const qinPart = qinWang && qinWang.text ? `天禽星（${qinWang.text}）` : '天禽星';
      starTip = `${ruiPart} ｜ ${qinPart}`;
    }

    let starDisplayHtml = star;
    if (isTianRui) {
      starDisplayHtml = `天芮<span class="star-qin">禽</span>`;
    }

    const isStarPicked = state.selectedYongShen && state.selectedYongShen.some(ys => star.includes(ys) || (hasTianQin && ys === '天禽'));
    let starClass = `star-name ${hasTianQin ? 'has-qin' : ''} ${isStarPicked ? 'is-picked-symbol' : ''}`;
    if (state.maskWeakened && isLuckyStar && luckyCount > 0) {
      starClass += ` is-lucky-symbol lucky-lv-${luckyCount}`;
      starTip = `【运筹·吉星】${starTip}（本宫${luckyCount}吉）`;
    }

    const starHtml = `
      <div class="cell-row-mid">
        <span class="${starClass}" title="${starTip}">${starDisplayHtml}</span>
        <div class="cell-stem-group">
          <span class="${tgClass}">${tg}</span>
          ${tianJiganHtml}
        </div>
      </div>
    `;

    // 第三行: 八门 + 地盘干 + 地盘寄干
    const dg = pan.dipan[g] || '';
    const isDgPicked = state.selectedYongShen && state.selectedYongShen.includes(dg);
    let diJiganHtml = '';
    if (g === 2 && pan.dipan[5]) {
      const isDjPicked = state.selectedYongShen && state.selectedYongShen.includes(pan.dipan[5]);
      diJiganHtml = `<span class="di-jigan-stem ${isDjPicked ? 'is-picked-symbol' : ''}">${pan.dipan[5]}</span>`;
    }

    const doorShengke = getDoorShengkeAnalysis(door, g, pan);
    let doorTip = doorShengke && doorShengke.text ? `${door}（${doorShengke.text}）` : door;

    const isDoorPicked = state.selectedYongShen && state.selectedYongShen.some(ys => door.includes(ys.replace('门', '')) || ys === door);
    let doorClass = `door-name ${isShiDoor ? 'is-shi' : ''} ${isDoorPicked ? 'is-picked-symbol' : ''}`;
    if (state.maskWeakened && isLuckyDoor && luckyCount > 0) {
      doorClass += ` is-lucky-symbol lucky-lv-${luckyCount}`;
      doorTip = `【运筹·吉门】${doorTip}（本宫${luckyCount}吉）`;
    }

    const doorHtml = `
      <div class="cell-row-bot">
        <span class="${doorClass}" title="${doorTip}">${door}</span>
        <div class="cell-stem-group">
          <span class="di-gan ${isDgPicked ? 'is-picked-symbol' : ''}">${dg}</span>
          ${diJiganHtml}
        </div>
      </div>
    `;

    cell.innerHTML = spiritHtml + starHtml + doorHtml + maHtml;

    // 清除原有状态类
    cell.classList.remove('is-yongshen', 'is-yongshen-zhifu', 'is-yongshen-opposite-kong', 'is-palace-dimmed', 'is-dipan-cell', 'has-lucky-3', 'has-lucky-2', 'has-lucky-1');
    cell.removeAttribute('title');
    if (state.maskWeakened && luckyCount > 0) {
      cell.classList.add(`has-lucky-${luckyCount}`);
      cell.dataset.luckyCount = String(luckyCount);
    } else {
      delete cell.dataset.luckyCount;
    }

    // 用神落宫与旬空对冲宫标记 (仅天盘生效)
    const matchRes = matchResByGong[g];
    const isYsMatch = matchRes && matchRes.matched;
    const isYsKong = emptyYongShenPalaces.includes(g);
    const isOpposite = oppositePalacesOfKong.has(g);

    if (isYsMatch) {
      cell.classList.remove('is-palace-dimmed');
      if (matchRes.hasZhifu) {
        cell.classList.add('is-yongshen-zhifu');
      } else {
        cell.classList.add('is-yongshen');
      }

      if (lookOppositeActive && (isYsKong || isOpposite)) {
        // 在天盘文字底下用淡蓝色的光圈在用神下面的宫位进行标记
        const oppGong = (g === 5 ? 2 : (10 - g));
        cell.innerHTML += `<div class="palace-kong-halo is-ys-halo" title="用神落宫逢旬空：人/物逢空，转寻对冲${GONG_CN[oppGong]}宫"></div>`;
        cell.setAttribute('title', `【用神落宫·旬空】${matchRes.items.join('、')}（人/物逢空，转寻对冲${GONG_CN[oppGong]}宫）`);
      } else {
        cell.setAttribute('title', `【用神落宫】${matchRes.items.join('、')}`);
      }
    } else if (lookOppositeActive && isOpposite) {
      cell.classList.remove('is-palace-dimmed');
      // 并在对面宫位进行标记
      const oppInfo = oppositePalacesOfKong.get(g);
      const originName = GONG_CN[oppInfo.originGong] || oppInfo.originGong;
      cell.classList.add('is-yongshen-opposite-kong');
      cell.innerHTML += `<div class="palace-kong-halo is-opp-halo" title="【旬空对冲宫】对冲${originName}宫用神（${oppInfo.items.join('、')}）旬空，人/物逢空看此对宫"></div>`;
      cell.setAttribute('title', `【旬空对冲宫】对冲${originName}宫用神（${oppInfo.items.join('、')}）旬空，人/物逢空看此对宫`);
    } else {
      if (hasYongShen) {
        cell.classList.add('is-palace-dimmed');
      }
    }

    if (g === 5) {
      const isKongOppActive = state.kongLookOpposite;
      const kongBtnHtml = `
        <button type="button" class="btn-center-kong-toggle ${isKongOppActive ? 'is-solid' : 'is-hollow'}" id="btnCenterKongToggle" title="${isKongOppActive ? '旬空看对宫：已开启（实心·显示淡蓝色光圈，点击切换为不显示）' : '旬空看对宫：已关闭（空圈·不显示，点击切换为显示淡蓝色光圈）'}" aria-label="旬空看对宫切换">
          <span class="kong-icon"></span>
        </button>
      `;
      const isMaskWeakened = state.maskWeakened;
      const maskBtnHtml = `
        <button type="button" class="btn-center-mask-toggle ${isMaskWeakened ? 'is-solid' : 'is-hollow'}" id="btnCenterMaskToggle" title="${isMaskWeakened ? '运筹模式与蒙版减弱：已开启（实心·金黄色标记三吉，方便通盘运筹，点击恢复正常）' : '运筹模式与蒙版减弱：已关闭（空圈·点击开启金黄色标记三吉与减弱非用神蒙版）'}" aria-label="运筹与减弱非用神蒙版切换">
          <span class="mask-icon"></span>
        </button>
      `;
      cell.innerHTML += `${maskBtnHtml}${kongBtnHtml}`;
    }
  });
}

// 同步克应研判折叠按钮文案与状态
function updateKeyingToggleBtn(isFullMode) {
  if (isFullMode === undefined) {
    const g = state.selectedGong || 2;
    const defaultFullMode = state.showKeyingDetails !== false;
    isFullMode = (state.palaceModeOverrides && state.palaceModeOverrides[g] !== undefined)
      ? !!state.palaceModeOverrides[g]
      : defaultFullMode;
  }
  const btn = document.getElementById('btnToggleKeyingDetail');
  const txt = document.getElementById('txtToggleKeyingDetail');
  if (!btn || !txt) return;

  if (isFullMode) {
    btn.classList.add('is-active');
    btn.title = '点击收起为精简模式 (仅展示宫位与十干克应)';
    txt.textContent = '收起精简';
  } else {
    btn.classList.remove('is-active');
    btn.title = '点击展开为完整读象模式';
    txt.textContent = '展开详细';
  }
}

// 渲染表头象意切换按钮组 (全部 / 物象 / 人象)
function renderImageryModeGroupHtml(currentMode) {
  const mode = currentMode || 'all';
  return `
    <div class="imagery-mode-group" role="group" aria-label="象意切换">
      <button type="button" class="imagery-mode-btn ${mode === 'all' ? 'active' : ''}" data-mode="all" title="查看完整象意">全部</button>
      <button type="button" class="imagery-mode-btn ${mode === 'wu' ? 'active' : ''}" data-mode="wu" title="仅查看物象、外观、材质与事物">物象</button>
      <button type="button" class="imagery-mode-btn ${mode === 'ren' ? 'active' : ''}" data-mode="ren" title="仅查看人象、外表、心性与人物">人象</button>
    </div>
  `.trim();
}

// 切换全局象意显示模式并同步更新当前界面
function setImageryMode(mode) {
  state.imageryMode = mode || 'all';
  try {
    localStorage.setItem('qimen_imagery_mode', state.imageryMode);
  } catch (e) {
    console.warn('localStorage error', e);
  }

  // 同步更新所有表头中的切换按钮 active 状态
  document.querySelectorAll('.imagery-mode-group .imagery-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === state.imageryMode);
  });

  // 同步更新所有已渲染 table 的模式 class
  document.querySelectorAll('.merged-table').forEach(tbl => {
    tbl.classList.remove('imagery-mode-all', 'imagery-mode-wu', 'imagery-mode-ren');
    tbl.classList.add(`imagery-mode-${state.imageryMode}`);
  });

  if (typeof syncSettingsModal === 'function') syncSettingsModal();
}

// 渲染克应速查面板
function renderKeyingAnalysis(pan, gong) {
  const analysis = getPalaceAnalysis(pan, gong);
  const contentDiv = document.getElementById('keyingContent');

  // 地盘全息模式：作为纯静态九宫定位基盘查询参考表 (不进行运算，移除本局地盘与多余杂项)
  if (state.showDipan) {
    const info = DIPAN_PALACE_INFO[gong];
    const mem = JIUGONG_MEMORY_DATA[gong];
    document.getElementById('keyingTitle').textContent = `『${mem.gongName}』(${mem.direction}) 地盘基盘参考`;

    let curDiGan = '';
    if (pan && pan.dipan) {
      if (gong === 2 && pan.dipan[5]) {
        curDiGan = `${pan.dipan[2]} 寄${pan.dipan[5]}`;
      } else if (gong === 5) {
        curDiGan = pan.dipan[5] || '戊';
      } else {
        curDiGan = pan.dipan[gong] || '';
      }
    }

    let html = `
      <div class="dipan-detail-overview">
        <div class="dipan-badge-row">
          <span class="dipan-badge-item num">洛书 ${mem.gongNum}宫</span>
          <span class="dipan-badge-item wuxing">${info.detail.nature}</span>
          <span class="dipan-badge-item bagua">${info.trigram ? info.trigram + ' ' : ''}${info.bagua}卦</span>
          <span class="dipan-badge-item dir">${info.direction}</span>
          <span class="dipan-badge-item star">${mem.star}星</span>
          <span class="dipan-badge-item door">${mem.door}</span>
        </div>
      </div>

      <div class="memory-card-container">
        <div class="memory-list">
          <div class="memory-row">
            <span class="memory-tag gong">宫</span>
            <div class="memory-content">
              <span class="memory-name">${mem.bagua}：</span>
              <span class="memory-desc">${mem.gongDesc}</span>
            </div>
          </div>
          <div class="memory-row">
            <span class="memory-tag star">星</span>
            <div class="memory-content">
              <span class="memory-name">${mem.star}星：</span>
              <span class="memory-desc">${mem.starDesc}</span>
            </div>
          </div>
          <div class="memory-row">
            <span class="memory-tag door">门</span>
            <div class="memory-content">
              <span class="memory-name">${mem.door}：</span>
              <span class="memory-desc">${mem.doorDesc}</span>
            </div>
          </div>
          <div class="memory-row">
            <span class="memory-tag stem">天干</span>
            <div class="memory-content">
              <span class="memory-desc">${mem.tianganDesc}</span>
            </div>
          </div>
          <div class="memory-row">
            <span class="memory-tag branch">地支</span>
            <div class="memory-content">
              <span class="memory-desc">${mem.dizhiDesc}</span>
            </div>
          </div>
          ${curDiGan ? `
          <div class="memory-row">
            <span class="memory-tag current">地盘干</span>
            <div class="memory-content">
              <span class="memory-desc">地盘坐干 <strong>【${curDiGan}】</strong>（地盘为基、为静、为过去状态）</span>
            </div>
          </div>
          ` : ''}
        </div>
      </div>
    `;
    contentDiv.innerHTML = html;
    return;
  }

  // 排宫法(转盘)中五宫寄坤二，无独立门星克应，明确显示“无”
  if (gong === 5 && pan.paipanMethod === 'zhuan') {
    document.getElementById('keyingTitle').textContent = `『中宫』克应研判`;
    updateKeyingToggleBtn(false);
    contentDiv.innerHTML = '<div style="color: var(--md-sys-color-outline); padding: 12px 0; font-size: 14px; font-weight: 500;">排宫法中五宫寄坤二宫，无独立门星符号</div>';
    return;
  }

  const ma = analysis.mergedAnalysis;
  if (!ma) {
    contentDiv.innerHTML = '<div style="color: var(--md-sys-color-outline); padding: 12px 0;">无</div>';
    return;
  }

  const matchRes = checkPalaceMatchYongShen(pan, gong, state.selectedYongShen);
  const isYongShenPalace = matchRes && matchRes.matched;

  // 1. 设置总开关最高权限：默认展开详细 (不管有没有用神都遵循总开关，用户手动切换当前宫时记录在 palaceModeOverrides)
  const defaultFullMode = state.showKeyingDetails !== false;
  let isFullMode = defaultFullMode;
  if (state.palaceModeOverrides && state.palaceModeOverrides[gong] !== undefined) {
    isFullMode = !!state.palaceModeOverrides[gong];
  }

  updateKeyingToggleBtn(isFullMode);

  // 2. 人象/物象/事象默认跟用神属性走 (人物用神人象，物品用神物象，事情用神事态)
  let activeImageryMode = state.imageryMode || 'all';
  if (isYongShenPalace && (!state.userSelectedImageryMode || state.userSelectedImageryMode === 'auto')) {
    let primaryNature = 'person';
    for (const ysName of matchRes.items) {
      if (state.selectedYongShenNatures && state.selectedYongShenNatures[ysName]) {
        primaryNature = state.selectedYongShenNatures[ysName];
        break;
      }
    }
    if (primaryNature === 'object') activeImageryMode = 'wu';
    else if (primaryNature === 'matter') activeImageryMode = 'all';
    else activeImageryMode = 'ren';
  }

  // 3. 构建顶部宫头 Banner (包含宫名姿态、用神角色、状态徽章、月令旺衰)
  const pInfo = DIPAN_PALACE_INFO[gong];
  const bagua = pInfo ? pInfo.bagua : '';
  const yue = ma.yuelingSimple || { text: '平', level: '平', tagClass: 'status-ping', desc: '' };
  const badges = ma.statusBadges || [];

  let badgesHtml = badges.map(b => `
    <span class="palace-status-badge ${b.tagClass}" title="${escapeHtml(b.title)}">${escapeHtml(b.text)}</span>
  `).join('');

  let yongshenRoleHtml = ma.yongshenRole ? `
    <span class="palace-yongshen-role" title="本次所问事项中的用神角色">用神：${escapeHtml(ma.yongshenRole)}</span>
  ` : '';

  let headBannerHtml = `
    <div class="palace-head-card">
      <div class="palace-head-main">
        <span class="palace-head-name">${pInfo ? pInfo.name : ''} · ${bagua ? (ESSENCE_KEYWORDS.bagua[bagua] ? ESSENCE_KEYWORDS.bagua[bagua].split('·')[1] : bagua) : ''}</span>
        <span class="palace-wangshuai-tag ${yue.tagClass}" title="${escapeHtml(yue.desc)}">[${yue.level}]</span>
        ${badgesHtml}
        ${yongshenRoleHtml}
      </div>
      <div class="palace-head-aside" title="以月令月支为纲计算的宫位旺衰力量">
        <span class="palace-yueling-text">${escapeHtml(yue.text)}</span>
      </div>
    </div>
  `;

  let html = headBannerHtml;

  // 4. 表格渲染：精简模式下仅展示【宫位】与【十干克应】，详细模式下展示全部符号 (天盘干/地盘干/九星/八门/八神等)
  const rowsToRender = isFullMode
    ? (ma.rows || [])
    : (ma.rows || []).filter(r => r.tag === '宫位' || r.tag === '十干克应');

  html += '<div class="merged-analysis-card">';
  html += '  <div class="merged-table-responsive">';
  html += `    <table class="merged-table imagery-mode-${activeImageryMode}">`;
  html += '      <thead>';
  html += '        <tr>';
  html += '          <th class="merged-th-tag">符号</th>';
  html += '          <th class="merged-th-desc">';
  html += '            <div class="desc-header-flex">';
  html += '              <span class="desc-header-title">实战象意与深层分析</span>';
  if (isFullMode) {
    html += `          ${renderImageryModeGroupHtml(activeImageryMode)}`;
  }
  html += '            </div>';
  html += '          </th>';
  html += '          <th class="merged-th-status">状态 / 旺衰</th>';
  html += '        </tr>';
  html += '      </thead>';
  html += '      <tbody>';

  rowsToRender.forEach(r => {
    let statusHtml = '';
    let descHtml = r.html || r.content;
    let trDataAttr = '';

    if (r.tag === '十干克应') {
      const items = r.items || [];
      if (items.length > 1) {
        trDataAttr = ` data-shigan-items="${JSON.stringify(items).replace(/"/g, '&quot;')}"`;
      }
      const btnGroupHtml = items.length > 1 ? `
        <div class="shigan-btn-group">
          ${items.map((it, idx) => `
            <button type="button" class="shigan-switch-btn ${idx === 0 ? 'active' : ''}" data-idx="${idx}">
              ${it.name}
            </button>
          `).join('')}
        </div>
      ` : '';

      // 典籍印证折叠嵌入在十干克应行内
      const classicText = items[0] ? items[0].classicText : r.classicText;
      const classicFoldHtml = classicText ? `
        <div class="shigan-classic-fold-wrap">
          <button type="button" class="shigan-classic-toggle-btn" onclick="const p = this.nextElementSibling; p.classList.toggle('show'); this.textContent = p.classList.contains('show') ? '收起古籍原文 ▴' : '典籍印证 ▾';">典籍印证 ▾</button>
          <div class="shigan-classic-detail-text">${escapeHtml(classicText)}</div>
        </div>
      ` : '';

      descHtml = `${btnGroupHtml}<div class="shigan-desc-display">${items[0] ? items[0].content : r.content}</div>${classicFoldHtml}`;
      statusHtml = `<span class="merged-status-badge ${items[0] ? items[0].statusClass : r.statusClass} shigan-live-status">${items[0] ? items[0].status : r.status}</span>`;
    } else {
      if (r.status) {
        statusHtml = `<span class="merged-status-badge ${r.statusClass}">${r.status}</span>`;
      }
    }

    html += `
      <tr${trDataAttr}>
        <td class="merged-cell-tag"><span class="merged-tag-badge ${r.tagClass}">${r.tag}</span></td>
        <td class="merged-cell-desc">${descHtml}</td>
        <td class="merged-cell-status">${statusHtml}</td>
      </tr>
    `;
  });

  html += '      </tbody>';
  html += '    </table>';
  html += '  </div>';
  html += '</div>';

  contentDiv.innerHTML = html;
  document.getElementById('keyingTitle').textContent = `『${pInfo ? pInfo.name : '宫位'}』克应研判`;
}

function renderCalendarTerms(pan) {
  const cur = pan.termInfo.current;
  const nxt = pan.termInfo.next;
  document.getElementById('calTermCur').textContent = `${cur.name}: ${String(cur.month).padStart(2, '0')}月${String(cur.day).padStart(2, '0')}日${cur.hour}时${cur.minute}分`;
  document.getElementById('calTermNext').textContent = `${nxt.name}: ${String(nxt.month).padStart(2, '0')}月${String(nxt.day).padStart(2, '0')}日${nxt.hour}时${nxt.minute}分`;
}

// 8. 快捷功能与立即起盘流程实现 (先取用神、锁定当前时刻、防止剧透后展示盘面)
let openYSModalHandler = null;

function jumpCalendarToToday() {
  const now = new Date();
  state.calViewYear = now.getFullYear();
  state.calViewMonth = now.getMonth() + 1;
  renderCalendar();
  showToast('已切回当月万年历');
}

// ================== 起局记录锁定 (Cast Record Lock) ==================
// 叶鸿生：想测的那一刻直接起局，不改任何设置；固定用一种设置，不要今天拆补、明天置闰；
// 同一件事两小时内不要反复起；起好后立即截图保存。
// 立即起盘 → 生成只读起局记录(含盘面快照) → 先立用神 → 揭盘自动存档；
// 锁定期间改动起局参数，需要确认并另开新盘，原记录保持不变。

const ACTIVE_RECORD_KEY = 'qimen_active_record_id';
let caseListRefresher = null; // 由案例库模块注入，用于刷新列表

function getActiveRecord() {
  return state.activeRecordId ? getRecord(state.activeRecordId) : null;
}

function setActiveRecord(id) {
  state.activeRecordId = id || null;
  try {
    if (id) localStorage.setItem(ACTIVE_RECORD_KEY, id);
    else localStorage.removeItem(ACTIVE_RECORD_KEY);
  } catch (e) {}
  renderLockBadge();
}

function refreshCaseList(selectId) {
  if (typeof caseListRefresher === 'function') caseListRefresher(selectId);
  renderDueBanner();
}

// 用户固定使用的起局设置 (设置里保存的偏好)，立即起盘时一律使用它
function preferredCastSettings() {
  return {
    dingjuMethod: localStorage.getItem('qimen_dingju_method') || 'zhirun',
    paipanMethod: localStorage.getItem('qimen_paipan_method') || 'zhuan',
    zishi: localStorage.getItem('qimen_zishi') || 'split'
  };
}

function applyRecordParamsToState(rec) {
  state.year = rec.year;
  state.month = rec.month;
  state.day = rec.day;
  state.hour = rec.hour;
  state.minute = rec.minute;
  if (rec.longitude) state.longitude = rec.longitude;
  if (rec.cityName) state.cityName = rec.cityName;
  state.dingjuMethod = rec.dingjuMethod || 'zhirun';
  state.paipanMethod = rec.paipanMethod || 'zhuan';
  state.zishi = rec.zishi || 'split';
  state.manualJu = (rec.manualJu && rec.manualJu.dun && rec.manualJu.ju) ? { ...rec.manualJu } : null;
  state.customPillars = rec.customPillars ? { ...rec.customPillars } : null;
}

// 拒绝改动时，把界面与状态恢复成锁定记录的起局参数
function restoreLockedParams(rec) {
  applyRecordParamsToState(rec);
  const ipt = document.getElementById('iptBaoShu');
  const rem = document.getElementById('txtBaoshuRem');
  if (ipt && !(rec.manualJu && rec.manualJu.type === 'baoshu')) ipt.value = '';
  if (rem && !(rec.manualJu && rec.manualJu.type === 'baoshu')) rem.textContent = '余：-';
  const selBaoshi = document.getElementById('selBaoshiHour');
  if (selBaoshi) selBaoshi.value = 'default';
  syncControlsUI();
  if (typeof syncSettingsModal === 'function') syncSettingsModal();
  renderCalendar();
  showToast('已保留原局，起局参数未改动');
}

// 询问是否解除当前起局锁定；返回 true 表示可以继续改动
function confirmLeaveLock(actionLabel = '改动起局参数') {
  const rec = getActiveRecord();
  if (!rec) return true;
  const title = rec.userQuestion || rec.title || rec.dateStr || '当前起局';
  let msg;
  if (rec.status === 'pending') {
    msg = `本局【${rec.dateStr}】尚未揭盘。\n\n${actionLabel}会放弃这一局（记录标为“作废”），按新参数另排一张研究盘。\n\n叶鸿生：刚起盘就觉得时间不对、问题不清楚，这个盘就别看了。\n\n确定放弃这一局吗？`;
  } else {
    msg = `当前锁定的是起局记录【${title}】。\n\n${actionLabel}会另开一张新盘，原记录与盘面保持不变。\n\n叶鸿生：固定用一种设置；同一件事要再看，用报数起局。\n\n确定另开新盘吗？`;
  }
  if (!window.confirm(msg)) return false;
  releaseLock(rec.status === 'pending' ? 'void' : 'keep');
  return true;
}

// 定局法/排盘法/子时这类“固定设置”的改动守卫 (在写入偏好之前调用)
function guardPrefChange(key, val, label) {
  const rec = getActiveRecord();
  if (!rec || state[key] === val) return true;
  if (confirmLeaveLock(label)) return true;
  syncControlsUI();
  if (typeof syncSettingsModal === 'function') syncSettingsModal();
  return false;
}

function releaseLock(mode = 'keep') {
  const rec = getActiveRecord();
  if (rec && mode === 'void' && rec.status === 'pending') {
    updateRecord(rec.id, r => {
      r.status = 'void';
      r.voidReason = '揭盘前改动起局参数，放弃此局';
    });
  }
  state.lastReleasedRecordId = rec ? rec.id : null;
  if (state.isPendingReveal) {
    state.isPendingReveal = false;
    applyPendingVisualMasks(false);
    const banner = document.getElementById('yongshenCastBanner');
    if (banner) banner.style.display = 'none';
    const btnConfirm = document.getElementById('btnConfirmYongShen');
    if (btnConfirm) btnConfirm.textContent = '确定';
  }
  setActiveRecord(null);
  refreshCaseList();
}

// 待揭盘期间禁止任何能看到盘面的操作
function blockIfPending(actionName = '该操作') {
  if (!state.isPendingReveal) return false;
  showToast(`盘面尚未揭晓：请先选取用神并揭盘，再使用${actionName}`);
  return true;
}

// 待揭盘时不把盘面内容留在页面里 (不只是模糊)
function scrubPendingContent() {
  document.querySelectorAll('#nineGrid .palace-cell').forEach(cell => {
    cell.innerHTML = '<div class="pending-cell-placeholder">?</div>';
  });
  const hide = ['txtGanzhi', 'txtJuDesc', 'txtKongwang', 'txtXunshou', 'txtStarFu', 'txtFuGong', 'txtDoorShi', 'txtDoorGong', 'txtWuBuYuDesc'];
  hide.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '··';
  });
  document.querySelectorAll('.ju-banner .badge-pattern').forEach(el => el.remove());
  const row = document.getElementById('itemWuBuYuRow');
  if (row) row.style.display = 'none';
  const center = document.getElementById('boardCardCenter');
  if (center) center.textContent = '待揭盘';
}

// 盘面卡片上的锁定状态徽标
function renderLockBadge() {
  const el = document.getElementById('txtLockBadge');
  if (!el) return;
  const rec = getActiveRecord();
  if (!rec) {
    el.style.display = 'none';
    el.textContent = '';
    return;
  }
  el.style.display = 'inline-flex';
  const label = rec.status === 'pending' ? '待揭盘' : (rec.source === 'cast' ? '起局记录' : '案例');
  el.textContent = `🔒 ${label} ${rec.dateStr ? rec.dateStr.slice(5) : ''}`;
  el.title = '起局参数已锁定：改动时间、定局法、排盘法等会提示另开新盘，原记录不变';
}

// 刷新/重开页面时恢复正在进行的起局记录
function restoreActiveRecordOnLoad() {
  const rec = getActiveRecord();
  if (!rec) {
    if (state.activeRecordId) setActiveRecord(null);
    return;
  }
  if (rec.status === 'void') {
    setActiveRecord(null);
    return;
  }
  applyRecordParamsToState(rec);
  state.userQuestion = rec.userQuestion || '';
  state.caseRemark = rec.remark || '';
  if (Array.isArray(rec.selectedYongShen)) state.selectedYongShen = [...rec.selectedYongShen];
  if (rec.yongshenNature) state.yongshenNature = rec.yongshenNature;
  state.isPendingReveal = rec.status === 'pending';
  state.calViewYear = state.year;
  state.calViewMonth = state.month;
  syncControlsUI();
  renderCalendar();
}

// 把用神弹窗里的问题/用神/笔记写回当前记录 (防抖自动保存)
let recordAutosaveTimer = null;
function scheduleRecordAutosave() {
  if (!state.activeRecordId) return;
  clearTimeout(recordAutosaveTimer);
  recordAutosaveTimer = setTimeout(flushRecordAutosave, 400);
}

function flushRecordAutosave() {
  clearTimeout(recordAutosaveTimer);
  const id = state.activeRecordId;
  if (!id) return;
  updateRecord(id, r => {
    r.userQuestion = state.userQuestion || '';
    if (!r.titleEdited) r.title = state.userQuestion || r.title || '';
    r.remark = state.caseRemark || '';
  });
}

function startImmediateCastFlow() {
  // 0. 上一局还没揭盘就重新起局：上一局作废
  const prev = getActiveRecord();
  if (prev && prev.status === 'pending') {
    updateRecord(prev.id, r => {
      r.status = 'void';
      r.voidReason = '未揭盘即重新起局';
    });
  }
  flushRecordAutosave();

  // 1. 取当前系统时刻 (精确到秒) 并使用固定的起局设置
  const now = new Date();
  const pref = preferredCastSettings();
  state.year = now.getFullYear();
  state.month = now.getMonth() + 1;
  state.day = now.getDate();
  state.hour = now.getHours();
  state.minute = now.getMinutes();
  state.manualJu = null;
  state.customPillars = null;
  state.dingjuMethod = pref.dingjuMethod;
  state.paipanMethod = pref.paipanMethod;
  state.zishi = pref.zishi;

  const selManual = document.getElementById('selManualJu');
  if (selManual) selManual.value = 'auto';
  const selBaoshi = document.getElementById('selBaoshiHour');
  if (selBaoshi) selBaoshi.value = 'default';
  const ipt = document.getElementById('iptBaoShu');
  const rem = document.getElementById('txtBaoshuRem');
  if (ipt) ipt.value = '';
  if (rem) rem.textContent = '余：-';

  state.calViewYear = state.year;
  state.calViewMonth = state.month;

  // 2. 新一局：问题与笔记从空白开始 (上一局的内容已自动保存在它自己的记录里)
  state.userQuestion = '';
  state.caseRemark = '';
  try {
    localStorage.removeItem('qimen_user_question');
    localStorage.removeItem('qimen_case_remark');
  } catch (e) {}
  ['iptUserQuestion', 'txtUserRemark', 'txtCaseRemark', 'iptCaseTitle'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  state.selectedYongShen = ['值符'];
  state.hasAnimatedOnFirstYS = false;
  try {
    localStorage.setItem('qimen_selected_yongshen', JSON.stringify(['值符']));
    localStorage.setItem('qimen_zhifu_manually_cleared', '0');
  } catch (e) {}

  // 3. 叶鸿生起局纪律提示：一天两三局、同一件事两小时内不反复起
  const all = loadRecords();
  const recent = lastCast(all);
  const minutesSinceLast = recent ? Math.round((now - new Date(recent.createdAt)) / 60000) : null;
  const todayCount = castsOnDay(all, todayStr(now)) + 1;

  // 4. 生成只读起局记录 (待揭盘)
  const rec = insertRecord({
    id: newId(),
    source: 'cast',
    status: 'pending',
    createdAt: now.toISOString(),
    castAtSeconds: now.getSeconds(),
    engineVersion: ENGINE_VERSION,
    title: '',
    userQuestion: '',
    remark: '',
    selectedYongShen: ['值符'],
    yongshenNature: state.yongshenNature,
    dateStr: formatDateStr(state.year, state.month, state.day, state.hour, state.minute),
    ...settingsOf(state),
    castContext: {
      minutesSinceLastCast: minutesSinceLast,
      lastCastQuestion: recent ? (recent.userQuestion || '') : '',
      castIndexToday: todayCount
    }
  });
  state.activeRecordId = null; // 先不锁，避免首次排盘被兜底拦截
  state.isPendingReveal = true;
  syncControlsUI();
  renderCalendar();

  if (typeof switchMobileTab === 'function') {
    switchMobileTab('pan');
  }

  executePaipan();
  setActiveRecord(rec.id);

  // 5. 立即写入盘面快照：锁住的是数据，不只是遮罩
  if (state.currentPan) {
    const snap = snapshotPan(state.currentPan);
    updateRecord(rec.id, r => {
      r.panSnapshot = snap;
      r.panFingerprint = panFingerprint(snap);
      r.pillars = { ...state.currentPan.pillars };
      r.juDesc = state.currentPan.dingju ? state.currentPan.dingju.desc : '';
    });
  }
  refreshCaseList(rec.id);
  renderCastDisciplineHint(rec);

  if (todayCount > 3) {
    showToast(`今天已是第 ${todayCount} 次正式起局。叶鸿生：替人预测一天最好两三局，起太多信息会混乱`);
  }

  // 6. 自动弹出“选取用神与所问事项”弹窗 (先取用神)
  if (typeof openYSModalHandler === 'function') {
    openYSModalHandler(true);
  }
}

// 在用神弹窗横幅里提示起局纪律
function renderCastDisciplineHint(rec) {
  const el = document.getElementById('txtCastDiscipline');
  if (!el) return;
  const ctx = (rec && rec.castContext) || {};
  const tips = [];
  if (ctx.minutesSinceLastCast !== null && ctx.minutesSinceLastCast !== undefined && ctx.minutesSinceLastCast < 120) {
    tips.push(`距上一局仅 ${ctx.minutesSinceLastCast} 分钟${ctx.lastCastQuestion ? `（上一局：${ctx.lastCastQuestion}）` : ''}。若是同一件事，叶鸿生建议两小时内不要反复起，改用报数起局。`);
  }
  if (ctx.castIndexToday > 3) {
    tips.push(`今天第 ${ctx.castIndexToday} 局：一天最好两三局。`);
  }
  el.textContent = tips.join(' ');
  el.style.display = tips.length ? 'block' : 'none';
}

function revealPanNow() {
  const rec = getActiveRecord();
  state.isPendingReveal = false;
  applyPendingVisualMasks(false);

  const banner = document.getElementById('yongshenCastBanner');
  if (banner) banner.style.display = 'none';

  const btnConfirm = document.getElementById('btnConfirmYongShen');
  if (btnConfirm) btnConfirm.textContent = '确定';

  executePaipan();

  // 揭盘即存档：记录揭盘时刻与揭盘时的用神 (之后改用神也能看到最初取的是什么)
  if (rec) {
    const ctx = rec.castContext || {};
    const sameQuestionRepeat = !!(state.userQuestion && ctx.lastCastQuestion &&
      ctx.lastCastQuestion.trim() === state.userQuestion.trim() &&
      ctx.minutesSinceLastCast !== null && ctx.minutesSinceLastCast < 120);
    updateRecord(rec.id, r => {
      r.status = 'revealed';
      r.revealedAt = new Date().toISOString();
      r.userQuestion = state.userQuestion || '';
      if (!r.titleEdited) r.title = state.userQuestion || r.title || '';
      r.remark = state.caseRemark || '';
      r.selectedYongShen = [...(state.selectedYongShen || [])];
      r.ysAtReveal = [...(state.selectedYongShen || [])];
      r.yongshenNature = state.yongshenNature;
      r.flags = { ...(r.flags || {}), repeatWithin2h: sameQuestionRepeat };
    });
    refreshCaseList(rec.id);
    if (sameQuestionRepeat) {
      setTimeout(() => showToast('提示：同一件事两小时内重复起局，信息容易混乱；已在记录中标注'), 1800);
    }
  }

  const ysText = (state.selectedYongShen && state.selectedYongShen.length > 0)
    ? `【${state.selectedYongShen.join('、')}】`
    : '【默认首领值符】';
  showToast(`起局成功！已锁定用神${ysText}，盘面已揭晓并自动存入案例库`);
}


function setToNow() {
  startImmediateCastFlow();
}

function toggleSimpleMode() {
  state.isSimpleMode = !state.isSimpleMode;
  document.body.classList.toggle('simple-mode', state.isSimpleMode);
  document.getElementById('btnToggleSimple').textContent = state.isSimpleMode ? '完整模式' : '简洁模式';
  localStorage.setItem('qimen_simple_mode', state.isSimpleMode ? '1' : '0');
  if (typeof syncSettingsModal === 'function') syncSettingsModal();
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('qimen_theme', newTheme);
  if (typeof syncSettingsModal === 'function') syncSettingsModal();
  showToast(`已切换至${newTheme === 'dark' ? '深色主题' : '浅色主题'}`);
}

function copyQimenToClipboard() {
  if (blockIfPending('复制排盘')) return;
  if (!state.currentPan) return;
  const text = formatPlainQimen(state.currentPan);

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('排盘信息已成功复制到剪贴板！');
    }).catch(err => {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text, successMsg = '排盘信息已成功复制到剪贴板！') {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  showToast(successMsg);
}

// 格式化单宫纯文本研判分析 (供复制用神、全盘克应导出复用)
function formatPalaceAnalysisText(p, gong, opts = {}) {
  const info = DIPAN_PALACE_INFO[gong];
  const spirit = p.tianpanSpirit[gong] || '无';
  const star = p.tianpanStar[gong] || '无';
  const starWang = getStarWangshuaiAnalysis(star, gong, p);
  const starText = starWang && starWang.text ? `${star}星（${starWang.text}）` : `${star}星`;

  const door = p.tianpanDoor[gong] || '无';
  const doorAnalysis = getDoorShengkeAnalysis(door, gong, p);
  const doorText = doorAnalysis && doorAnalysis.text ? `${door}（${doorAnalysis.text}）` : door;

  const tg = p.tianpanGan[gong] || '';
  const tj = p.tianpanJigan[gong] || '';
  const dg = p.dipan[gong] || '';
  const dj = (gong === 2 && p.dipan[5]) ? p.dipan[5] : '';

  const flag = p.palaceFlags[gong] || {};
  const flagsList = [];
  if (flag.isKong) flagsList.push('旬空');
  if (flag.hasMa) flagsList.push('马星(主动/出行/速变)');

  const pa = getPalaceAnalysis(p, gong);
  const ma = pa ? pa.mergedAnalysis : null;

  let out = '';
  const prefix = opts.titlePrefix || '宫位';
  const tag = opts.titleTag ? ` —— ${opts.titleTag}` : '';
  out += `${prefix}：『${GONG_CN[gong]}宫』(${info.direction} / ${info.bagua}卦 / 五行属${info.element})${tag}\n`;
  if (opts.note) {
    out += `  • 备注：${opts.note}\n`;
  }
  if (gong === 5 && p.paipanMethod === 'zhuan') {
    out += `  • 说明：排宫法(转盘)中五宫寄坤二，无独立神门星，地盘奇仪为【${p.dipan[5] || '戊'}】\n\n`;
    return out;
  }

  out += `  • 宫内神星门：八神【${spirit}】 ｜ 九星【${starText}】 ｜ 八门【${doorText}】\n`;
  out += `  • 天地盘奇仪：天盘【${tg}】${tj ? '(' + tj + ')' : ''} 加 地盘【${dg}】${dj ? '(' + dj + ')' : ''}\n`;
  if (flagsList.length > 0) {
    out += `  • 神煞标记：${flagsList.join('、')}\n`;
  }

  const yingqi = getYingqiXunKongAnalysis(p, gong);
  if (yingqi && yingqi.isKong) {
    out += `  • 旬空定应期：${yingqi.content}\n`;
  }

  if (ma && ma.rows) {
    const shiganRow = ma.rows.find(r => r.tag === '十干克应');
    if (shiganRow) {
      if (shiganRow.items && shiganRow.items.length > 1) {
        const shiganTexts = shiganRow.items.map(it => `[${it.name}] ${it.content} (${it.status})`).join('；');
        out += `  • 十干实战克应：${shiganTexts}\n`;
      } else {
        out += `  • 十干实战克应：${shiganRow.content} [${shiganRow.status}]\n`;
      }
    }
    const dunjiaRow = ma.rows.find(r => r.tag === '遁甲');
    if (dunjiaRow) {
      out += `  • 遁甲之变：${dunjiaRow.content}\n`;
    }
    const heRow = ma.rows.find(r => r.tag === '相合');
    if (heRow) {
      out += `  • 天干相合：${heRow.content}\n`;
    }
    const xingRow = ma.rows.find(r => r.tag === '相刑');
    if (xingRow) {
      out += `  • 天干相刑：${xingRow.content}\n`;
    }
    const shengwangRow = ma.rows.find(r => r.tag === '生旺死绝');
    if (shengwangRow) {
      out += `  • 气数旺绝：${shengwangRow.content}（${shengwangRow.status}）\n`;
    }
    const maxingRow = ma.rows.find(r => r.tag === '马星');
    if (maxingRow) {
      out += `  • 马星动态研判：${maxingRow.content} [${maxingRow.status}]\n`;
    }
  }

  if (ma && ma.classicEvidence && ma.classicEvidence.length > 0) {
    out += `  • 典籍印证：${ma.classicEvidence.join(' ')}\n`;
  }
  out += `\n`;
  return out;
}

// 复制用神：复制内容包含所问事项、所选用神落宫详析，若逢旬空且看对宫则把旬空对冲宫完整包含在内
function copyYongShenAnalysis() {
  if (blockIfPending('复制用神')) return;
  if (!state.currentPan) {
    showToast('当前无可用排盘信息');
    return;
  }
  const p = state.currentPan;
  const yongShenList = (Array.isArray(state.selectedYongShen) && state.selectedYongShen.length > 0)
    ? state.selectedYongShen
    : ['值符'];

  const questionText = state.userQuestion ? state.userQuestion.trim() : '（未指定具体所问事项，求测自身与事态大纲）';
  const isPersonObj = isYongShenPersonOrObject(yongShenList, state.userQuestion, state.yongshenNature);
  const shouldLookOpposite = (state.kongLookOpposite && isPersonObj);

  let out = `【奇门遁甲 · 用神专断落宫报告】\n`;
  out += `────────────────────────────────────────\n`;
  out += `所问事项：${questionText}\n`;
  out += `四柱干支：${p.pillars.year}  ${p.pillars.month}  ${p.pillars.day}  ${p.pillars.hour}\n`;
  out += `局象定局：${p.dingju.desc}（${p.paipanMethod === 'zhuan' ? '排宫法/转盘' : '飞宫法/飞盘'}）\n`;
  out += `选定用神：${yongShenList.join('、')}\n`;
  out += `旬空马星：日空【${p.kongwang.day}】 时空【${p.kongwang.hour}】 旬首【${p.xun}】\n`;
  out += `────────────────────────────────────────\n\n`;

  // 找出与用神匹配的宫位
  const matchedPalaces = [];
  for (let g = 1; g <= 9; g++) {
    const matchRes = checkPalaceMatchYongShen(p, g, yongShenList);
    if (matchRes.matched) {
      matchedPalaces.push({ gong: g, matchRes });
    }
  }

  if (matchedPalaces.length === 0) {
    out += `当前所选取的用神在天盘中未检索到明确落宫，请检查用神设定。\n`;
  } else {
    out += `【已选【${yongShenList.join('、')}】之天盘落宫详析】\n\n`;
    const oppPalacesToAppend = [];
    const addedOppGongs = new Set();

    matchedPalaces.forEach(({ gong, matchRes }, idx) => {
      let note = `对应所选用神：【${matchRes.items.join('、')}】${matchRes.hasZhifu ? ' (全局大纲首领)' : ''}`;
      const flag = p.palaceFlags[gong] || {};
      if (flag.isKong) {
        const oppG = (gong === 5 ? 2 : (10 - gong));
        if (shouldLookOpposite) {
          const reasonText = '人/物逢空，转寻对冲';
          note += `；落宫逢旬空（${reasonText}【${GONG_CN[oppG]}宫】）`;
          if (!addedOppGongs.has(oppG)) {
            addedOppGongs.add(oppG);
            oppPalacesToAppend.push({
              oppGong: oppG,
              originGong: gong,
              originName: GONG_CN[gong],
              items: matchRes.items,
              reasonText
            });
          }
        } else {
          const reasonText = !state.kongLookOpposite ? '已手动关闭旬空看对冲宫' : '测事逢空待填实，不看对面';
          note += `；落宫逢旬空（${reasonText}）`;
        }
      }

      out += formatPalaceAnalysisText(p, gong, {
        titlePrefix: `用神宫位 ${idx + 1}`,
        titleTag: `对应所选用神：【${matchRes.items.join('、')}】${matchRes.hasZhifu ? ' (全局大纲首领)' : ''}`,
        note
      });
    });

    if (oppPalacesToAppend.length > 0) {
      out += `────────────────────────────────────────\n`;
      out += `【旬空转看对冲落宫详析】\n\n`;
      oppPalacesToAppend.forEach(({ oppGong, originName, items, reasonText }, oppIdx) => {
        out += formatPalaceAnalysisText(p, oppGong, {
          titlePrefix: `对冲宫位 ${oppIdx + 1}`,
          titleTag: `【旬空转看对冲宫】`,
          note: `对冲『${originName}宫』用神【${items.join('、')}】落宫逢旬空（${reasonText}，转寻此对冲宫参断）`
        });
      });
    }
  }

  out += `════════════════════════════════════════\n`;
  out += `奇门遁甲专业排盘分析系统\n`;

  const successToast = '所问事项与用神落宫分析已复制到剪贴板！';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(out).then(() => {
      showToast(successToast);
    }).catch(err => {
      fallbackCopy(out, successToast);
    });
  } else {
    fallbackCopy(out, successToast);
  }
}

// 获取全盘克应速查弹窗当前信息纯文本 (全盘或仅看用神与对冲宫)
function getKeyingModalCurrentContentText() {
  if (!state.currentPan) return '';
  const p = state.currentPan;
  const yongShenList = (Array.isArray(state.selectedYongShen) && state.selectedYongShen.length > 0)
    ? state.selectedYongShen
    : ['值符'];

  const questionText = state.userQuestion ? state.userQuestion.trim() : '（未指定具体所问事项，求测自身与事态大纲）';
  const isPersonObj = isYongShenPersonOrObject(yongShenList, state.userQuestion, state.yongshenNature);
  const shouldLookOpposite = (state.kongLookOpposite && isPersonObj);

  let out = '';
  if (state.keyingOnlyYongShen) {
    out += `【奇门遁甲 · 克应速查当前信息（仅看用神落宫）】\n`;
    out += `────────────────────────────────────────\n`;
    out += `所问事项：${questionText}\n`;
    out += `四柱干支：${p.pillars.year}  ${p.pillars.month}  ${p.pillars.day}  ${p.pillars.hour}\n`;
    out += `局象定局：${p.dingju.desc}（${p.paipanMethod === 'zhuan' ? '排宫法/转盘' : '飞宫法/飞盘'}）\n`;
    out += `选定用神：${yongShenList.join('、')}\n`;
    out += `旬空马星：日空【${p.kongwang.day}】 时空【${p.kongwang.hour}】 旬首【${p.xun}】\n`;
    out += `────────────────────────────────────────\n\n`;

    const matchedPalaces = [];
    for (let g = 1; g <= 9; g++) {
      const matchRes = checkPalaceMatchYongShen(p, g, yongShenList);
      if (matchRes.matched) {
        matchedPalaces.push({ gong: g, matchRes });
      }
    }

    if (matchedPalaces.length === 0) {
      out += `当前所选取的用神【${yongShenList.join('、')}】在天盘中未检索到明确落宫。\n`;
    } else {
      out += `【用神落宫克应详析】\n\n`;
      const oppPalacesToAppend = [];
      const addedOppGongs = new Set();

      matchedPalaces.forEach(({ gong, matchRes }, idx) => {
        let note = `对应所选用神：【${matchRes.items.join('、')}】${matchRes.hasZhifu ? ' (全局大纲首领)' : ''}`;
        const flag = p.palaceFlags[gong] || {};
        if (flag.isKong) {
          const oppG = (gong === 5 ? 2 : (10 - gong));
          if (shouldLookOpposite) {
            const reasonText = '人/物逢空，转寻对冲';
            note += `；落宫逢旬空（${reasonText}【${GONG_CN[oppG]}宫】）`;
            if (!addedOppGongs.has(oppG)) {
              addedOppGongs.add(oppG);
              oppPalacesToAppend.push({
                oppGong: oppG,
                originGong: gong,
                originName: GONG_CN[gong],
                items: matchRes.items,
                reasonText
              });
            }
          } else {
            const reasonText = !state.kongLookOpposite ? '已手动关闭旬空看对冲宫' : '测事逢空待填实，不看对面';
            note += `；落宫逢旬空（${reasonText}）`;
          }
        }

        out += formatPalaceAnalysisText(p, gong, {
          titlePrefix: `用神宫位 ${idx + 1}`,
          titleTag: `对应所选用神：【${matchRes.items.join('、')}】`,
          note
        });
      });

      if (oppPalacesToAppend.length > 0) {
        out += `────────────────────────────────────────\n`;
        out += `【旬空转看对冲落宫详析】\n\n`;
        oppPalacesToAppend.forEach(({ oppGong, originName, items, reasonText }, oppIdx) => {
          out += formatPalaceAnalysisText(p, oppGong, {
            titlePrefix: `对冲宫位 ${oppIdx + 1}`,
            titleTag: `【旬空转看对冲宫】`,
            note: `对冲『${originName}宫』用神【${items.join('、')}】落宫逢旬空（${reasonText}，转寻此对冲宫参断）`
          });
        });
      }
    }
  } else {
    // 全盘九宫
    out += `【奇门遁甲 · 全盘九宫克应速查报告】\n`;
    out += `────────────────────────────────────────\n`;
    out += `四柱干支：${p.pillars.year}  ${p.pillars.month}  ${p.pillars.day}  ${p.pillars.hour}\n`;
    out += `局象定局：${p.dingju.desc}（${p.paipanMethod === 'zhuan' ? '排宫法/转盘' : '飞宫法/飞盘'}）\n`;
    out += `旬空马星：日空【${p.kongwang.day}】 时空【${p.kongwang.hour}】 旬首【${p.xun}】\n`;
    out += `────────────────────────────────────────\n\n`;

    const gongs = [4, 9, 2, 3, 5, 7, 8, 1, 6];
    gongs.forEach((g, idx) => {
      out += formatPalaceAnalysisText(p, g, {
        titlePrefix: `九宫之 ${idx + 1}`
      });
    });
  }

  out += `════════════════════════════════════════\n`;
  out += `奇门遁甲专业排盘分析系统\n`;
  return out;
}

// 复制全盘克应速查弹窗当前信息 (全盘或仅看用神与对冲宫)
function copyKeyingModalCurrentContent() {
  if (blockIfPending('复制研判')) return;
  if (!state.currentPan) {
    showToast('当前无可用排盘信息');
    return;
  }
  const out = getKeyingModalCurrentContentText();
  const successToast = '当前克应信息已成功复制到剪贴板！';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(out).then(() => {
      showToast(successToast);
    }).catch(err => {
      fallbackCopy(out, successToast);
    });
  } else {
    fallbackCopy(out, successToast);
  }
}

// 一起复制排盘与当前信息 (完整排盘 + 当前克应信息)
function copyKeyingModalPanAndCurrentContent() {
  if (blockIfPending('复制排盘')) return;
  if (!state.currentPan) {
    showToast('当前无可用排盘信息');
    return;
  }
  const panText = formatPlainQimen(state.currentPan);
  const currentKeyingText = getKeyingModalCurrentContentText();
  const combined = `${panText.trim()}\n\n${currentKeyingText.trim()}\n`;

  const successToast = '排盘与当前信息(1+2)已成功复制到剪贴板！';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(combined).then(() => {
      showToast(successToast);
    }).catch(err => {
      fallbackCopy(combined, successToast);
    });
  } else {
    fallbackCopy(combined, successToast);
  }
}

// 渲染全盘克应速查模态弹窗内容
function renderKeyingModalContent() {
  if (!state.currentPan) return;
  const p = state.currentPan;
  const modalBody = document.getElementById('modalKeyingBody');
  if (!modalBody) return;
  modalBody.innerHTML = '';

  const btnFilter = document.getElementById('btnKeyingFilterYongShen');
  const titleEl = document.getElementById('modalKeyingTitle');

  const yongShenList = (Array.isArray(state.selectedYongShen) && state.selectedYongShen.length > 0)
    ? state.selectedYongShen
    : ['值符'];

  const isPersonObj = isYongShenPersonOrObject(yongShenList, state.userQuestion, state.yongshenNature);
  const shouldLookOpposite = (state.kongLookOpposite && isPersonObj);

  if (btnFilter) {
    if (state.keyingOnlyYongShen) {
      btnFilter.textContent = '查看全盘克应';
      btnFilter.className = 'm3-btn m3-btn-filled';
      btnFilter.title = '点击切换回查看全盘九宫克应';
    } else {
      btnFilter.textContent = '只看当前用神';
      btnFilter.className = 'm3-btn m3-btn-outlined';
      btnFilter.title = state.kongLookOpposite
        ? '点击只查看当前用神落宫及旬空对冲宫克应'
        : '点击只查看当前用神落宫克应';
    }
  }

  if (titleEl) {
    titleEl.textContent = state.keyingOnlyYongShen
      ? `奇门遁甲克应速查 · 仅看用神落宫`
      : '奇门遁甲全盘克应速查';
  }

  let palacesToRender = []; // Array of { gong, isOpposite, originGong, matchItems, reasonText }

  if (!state.keyingOnlyYongShen) {
    // 全盘九宫
    const standardGongs = [4, 9, 2, 3, 5, 7, 8, 1, 6];
    palacesToRender = standardGongs.map(g => ({ gong: g, isOpposite: false }));
  } else {
    // 仅看当前用神 (含旬空对冲宫)
    const matchedPalaces = [];
    for (let g = 1; g <= 9; g++) {
      const matchRes = checkPalaceMatchYongShen(p, g, yongShenList);
      if (matchRes.matched) {
        matchedPalaces.push({ gong: g, matchRes });
      }
    }

    if (matchedPalaces.length === 0) {
      modalBody.innerHTML = `
        <div style="padding: 28px 16px; text-align: center; color: var(--md-sys-color-outline);">
          <p style="font-size: 15px; margin-bottom: 12px;">当前所选取的用神【${yongShenList.join('、')}】在天盘中未检索到明确落宫。</p>
          <button type="button" class="m3-btn m3-btn-tonal" id="btnKeyingResetAll">查看全盘克应</button>
        </div>
      `;
      const resetBtn = document.getElementById('btnKeyingResetAll');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          state.keyingOnlyYongShen = false;
          renderKeyingModalContent();
        });
      }
      return;
    }

    const addedOppGongs = new Set();
    matchedPalaces.forEach(({ gong, matchRes }) => {
      palacesToRender.push({
        gong,
        isOpposite: false,
        matchItems: matchRes.items
      });

      const isKong = !!(p.palaceFlags[gong] && p.palaceFlags[gong].isKong);
      if (isKong && shouldLookOpposite) {
        const oppG = (gong === 5 ? 2 : (10 - gong));
        if (!addedOppGongs.has(oppG)) {
          addedOppGongs.add(oppG);
          const reasonText = '人/物逢空，转寻对冲';
          palacesToRender.push({
            gong: oppG,
            isOpposite: true,
            originGong: gong,
            originName: GONG_CN[gong],
            matchItems: matchRes.items,
            reasonText
          });
        }
      }
    });
  }

  // 渲染每个宫位卡片
  palacesToRender.forEach(item => {
    const g = item.gong;
    const analysis = getPalaceAnalysis(p, g);
    const sec = document.createElement('div');
    sec.className = 'keying-palace-section';
    sec.style.marginBottom = '14px';
    sec.style.borderBottom = '1px solid var(--md-sys-color-outline-variant, #ddd)';
    sec.style.paddingBottom = '10px';

    let headerBadgeHtml = '';
    let noticeBannerHtml = '';

    if (item.isOpposite) {
      headerBadgeHtml = `<span class="keying-palace-badge is-opposite-badge">旬空转看对冲宫</span>`;
      noticeBannerHtml = `
        <div class="keying-palace-notice is-opp-notice">
          因『${item.originName}宫』用神【${item.matchItems.join('、')}】落宫逢旬空（${item.reasonText}），依奇门定则转寻此对冲『${GONG_CN[g]}宫』参断。
        </div>
      `;
    } else if (state.keyingOnlyYongShen && item.matchItems) {
      headerBadgeHtml = `<span class="keying-palace-badge is-yongshen-badge">用神：${item.matchItems.join('、')}</span>`;
      const isKong = !!(p.palaceFlags[g] && p.palaceFlags[g].isKong);
      if (isKong) {
        const oppG = (g === 5 ? 2 : (10 - g));
        if (shouldLookOpposite) {
          const reasonText = '人/物逢空，转寻对冲';
          noticeBannerHtml = `
            <div class="keying-palace-notice is-kong-notice">
              用神落宫逢旬空（${reasonText}），转寻对冲【${GONG_CN[oppG]}宫】（见下方对冲宫详析）。
            </div>
          `;
        } else {
          const reasonText = !state.kongLookOpposite ? '已手动关闭旬空看对冲宫' : '测事逢空待填实，不看对面';
          noticeBannerHtml = `
            <div class="keying-palace-notice is-kong-notice">
              用神落宫逢旬空（${reasonText}）。
            </div>
          `;
        }
      }
    }

    let html = `
      <div class="keying-palace-title-box">
        <h4 style="color: #0055ea; margin: 0; font-size: 16px;">${analysis.title}</h4>
        ${headerBadgeHtml}
      </div>
      ${noticeBannerHtml}
    `;

    if (g === 5 && p.paipanMethod === 'zhuan') {
      html += '<div style="padding-left:10px; color: var(--md-sys-color-outline); padding: 8px 0;">排宫法(转盘)中五宫寄坤二，无独立门星克应，地盘奇仪为【' + (p.dipan[5] || '戊') + '】。</div>';
      sec.innerHTML = html;
      modalBody.appendChild(sec);
      return;
    }

    if (analysis.mergedAnalysis && analysis.mergedAnalysis.rows && analysis.mergedAnalysis.rows.length > 0) {
      const ma = analysis.mergedAnalysis;
      html += '<div class="merged-analysis-card" style="margin-top: 4px; box-shadow: none;">';
      html += '  <div class="merged-table-responsive">';
      html += `    <table class="merged-table imagery-mode-${state.imageryMode || 'all'}">`;
      html += '      <thead>';
      html += '        <tr>';
      html += '          <th class="merged-th-tag">项目</th>';
      html += '          <th class="merged-th-desc">';
      html += '            <div class="desc-header-flex">';
      html += '              <span class="desc-header-title">实战象意与深层分析</span>';
      html += `              ${renderImageryModeGroupHtml(state.imageryMode)}`;
      html += '            </div>';
      html += '          </th>';
      html += '          <th class="merged-th-status">状态 / 旺衰</th>';
      html += '        </tr>';
      html += '      </thead>';
      html += '      <tbody>';
      ma.rows.forEach(r => {
        if (!state.showKeyingDetails && r.tag !== '宫位' && r.tag !== '十干克应') {
          return;
        }

        let statusHtml = '';
        let descHtml = r.html || r.content;
        let trDataAttr = '';

        if (r.tag === '十干克应' && r.items && r.items.length > 1) {
          trDataAttr = ` data-shigan-items="${JSON.stringify(r.items).replace(/"/g, '&quot;')}"`;
          const btnGroupHtml = `
            <div class="shigan-btn-group">
              ${r.items.map((it, idx) => `
                <button type="button" class="shigan-switch-btn ${idx === 0 ? 'active' : ''}" data-idx="${idx}">
                  ${it.name}
                </button>
              `).join('')}
            </div>
          `;
          descHtml = `${btnGroupHtml}<div class="shigan-desc-display">${r.items[0].content}</div>`;
          statusHtml = `<span class="merged-status-badge ${r.items[0].statusClass} shigan-live-status">${r.items[0].status}</span>`;
        } else {
          if (r.status) {
            statusHtml = `<span class="merged-status-badge ${r.statusClass}">${r.status}</span>`;
          }
        }

        html += `        <tr${trDataAttr}>
          <td class="merged-cell-tag"><span class="merged-tag-badge ${r.tagClass}">${r.tag}</span></td>
          <td class="merged-cell-desc">${descHtml}</td>
          <td class="merged-cell-status">${statusHtml}</td>
        </tr>`;
      });
      html += '      </tbody>';
      html += '    </table>';
      html += '  </div>';

      if (ma.classicEvidence && ma.classicEvidence.length > 0) {
        html += '  <div class="merged-classic-block">';
        html += '    <div class="merged-classic-title">典籍印证：</div>';
        ma.classicEvidence.forEach(c => {
          html += `    <div class="merged-classic-item">${c}</div>`;
        });
        html += '  </div>';
      }
      html += '</div>';
    }

    sec.innerHTML = html;
    modalBody.appendChild(sec);
  });
}

// 全盘克应速查模态弹窗
function openKeyingModal() {
  if (blockIfPending('全盘克应')) return;
  if (!state.currentPan) {
    executePaipan();
  }
  if (!state.currentPan) return;
  renderKeyingModalContent();
  openModal('modalKeying');
}

// 9. 案例库 (起局记录) 与 localStorage 持久化
// 每条记录按 id 管理，保存起局参数 + 完整盘面快照 + 问题、用神、笔记、反馈；读取时以快照为准。
function methodNames(item) {
  const dingjuName = item.dingjuMethod === 'zhirun' ? '置闰' : (item.dingjuMethod === 'chaibu' ? '拆补' : '茅山');
  const paipanName = item.paipanMethod === 'zhuan' ? '转盘' : '飞盘';
  return `${dingjuName}/${paipanName}`;
}

function recordSummary(item) {
  const juStr = item.juDesc || (item.manualJu ? `${item.manualJu.dun}遁${['一','二','三','四','五','六','七','八','九'][item.manualJu.ju - 1]}局` : '');
  const pillarsStr = item.pillars ? `${item.pillars.year} ${item.pillars.month} ${item.pillars.day} ${item.pillars.hour}` : (item.customPillars ? `${item.customPillars.year} ${item.customPillars.month} ${item.customPillars.day} ${item.customPillars.hour}` : '');
  return [juStr, pillarsStr, methodNames(item)].filter(Boolean).join(' ｜ ');
}

const SOURCE_NAMES = { cast: '立即起盘', manual: '手动保存', baoshu: '报数补起', legacy: '旧案例' };

function initCasesStorage() {
  const selCases = document.getElementById('selCaseList');
  const btnLoad = document.getElementById('btnLoadSelectedCase');

  function selectedRecord() {
    const id = selCases ? selCases.value : '';
    return id ? getRecord(id) : null;
  }

  function showCaseDetail(item) {
    const panel = document.getElementById('caseDetailPanel');
    if (!panel) return;
    if (!item) {
      panel.style.display = 'none';
      return;
    }
    panel.style.display = 'block';
    const titleEl = document.getElementById('caseDetailTitle');
    const timeEl = document.getElementById('caseDetailTime');
    const qEl = document.getElementById('caseDetailQuestion');
    const remarkEl = document.getElementById('caseDetailRemark');
    const summaryEl = document.getElementById('caseDetailSummary');
    const metaEl = document.getElementById('caseDetailMeta');
    const btnVoid = document.getElementById('btnVoidCase');

    if (titleEl) titleEl.textContent = item.title || item.userQuestion || '无标题案例';
    if (timeEl) timeEl.textContent = item.dateStr || '';
    if (qEl) qEl.textContent = item.userQuestion || item.title || '（未记录具体问题）';
    if (remarkEl) {
      const n = item.notes || {};
      const hasStructured = NOTE_FIELDS.some(f => n[f.key]);
      const text = item.remark || (hasStructured ? (n.judgment || '（已填写结构化笔记，点“笔记与回访”查看）') : '');
      remarkEl.textContent = text || '（暂无断语笔记）';
      remarkEl.style.fontStyle = text ? 'normal' : 'italic';
      remarkEl.style.color = text ? 'var(--md-sys-color-on-surface)' : 'var(--md-sys-color-outline)';
    }
    if (summaryEl) summaryEl.textContent = recordSummary(item);
    if (metaEl) {
      const bits = [];
      bits.push(SOURCE_NAMES[item.source] || '案例');
      if (item.status === 'pending') bits.push('尚未揭盘');
      if (item.status === 'void') bits.push(`已作废${item.voidReason ? '：' + item.voidReason : ''}`);
      if (Array.isArray(item.ysAtReveal) && item.ysAtReveal.length) bits.push(`揭盘时用神：${item.ysAtReveal.join('、')}`);
      if (item.verdict && item.verdict !== '待验证') bits.push(`验证：${item.verdict}`);
      if (item.flags && item.flags.repeatWithin2h) bits.push('两小时内重复起局');
      if (item.parentId) {
        const parent = getRecord(item.parentId);
        bits.push(`补起自：${parent ? (parent.userQuestion || parent.dateStr) : '原局'}`);
      }
      if (!item.panSnapshot) bits.push('无盘面快照（旧案例，按当前算法重算）');
      const due = (item.followUps || []).filter(f => !f.done && f.date <= todayStr());
      if (due.length) bits.push(`🔔 ${due.length} 条待回访`);
      metaEl.textContent = bits.join(' · ');
    }
  }

  function loadCases(selectId = null) {
    if (!selCases) return;
    const stored = loadRecords();
    selCases.innerHTML = '';
    const countEl = document.getElementById('txtCaseCount');
    if (countEl) countEl.textContent = `查找到${stored.length}个`;
    const emptyEl = document.getElementById('caseEmptyState');

    stored.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      const label = statusLabel(item);
      opt.textContent = `${label ? label + ' ' : ''}[${item.dateStr}] ${item.title || item.userQuestion || '无标题格局'}`;
      selCases.appendChild(opt);
    });

    if (stored.length > 0) {
      if (emptyEl) emptyEl.style.display = 'none';
      selCases.style.display = 'block';
      const wanted = selectId || state.activeRecordId;
      const target = stored.find(r => r.id === wanted) || stored[0];
      selCases.value = target.id;
      showCaseDetail(target);
    } else {
      if (emptyEl) emptyEl.style.display = 'flex';
      selCases.style.display = 'none';
      showCaseDetail(null);
    }
  }
  caseListRefresher = loadCases;

  function applyCase(item) {
    if (!item) return;
    flushRecordAutosave();
    const cur = getActiveRecord();
    if (cur && cur.id !== item.id && cur.status === 'pending') {
      if (!confirmLeaveLock('读取其他案例')) return;
    }

    // 1. 起局参数 (时间、地点、定局法、排盘法、子时、局数、自定义四柱)
    applyRecordParamsToState(item);

    // 2. 所问问题、笔记、用神与“人/物/事”属性
    state.userQuestion = item.userQuestion || item.title || '';
    state.caseRemark = item.remark || '';
    if (Array.isArray(item.selectedYongShen)) state.selectedYongShen = [...item.selectedYongShen];
    if (item.yongshenNature) state.yongshenNature = item.yongshenNature;
    try {
      localStorage.setItem('qimen_user_question', state.userQuestion);
      localStorage.setItem('qimen_case_remark', state.caseRemark);
      localStorage.setItem('qimen_selected_yongshen', JSON.stringify(state.selectedYongShen));
    } catch (e) {}
    const txtUser = document.getElementById('txtUserRemark');
    if (txtUser) txtUser.value = state.caseRemark;
    const txtCase = document.getElementById('txtCaseRemark');
    if (txtCase) txtCase.value = state.caseRemark;

    // 3. 锁定到这条记录 (读取的案例同样只读，改参数要另开新盘)
    state.isPendingReveal = item.status === 'pending';
    state.activeRecordId = null;
    state.calViewYear = state.year;
    state.calViewMonth = state.month;
    syncControlsUI();
    renderCalendar();
    setActiveRecord(item.id);
    executePaipan();

    // 4. 旧案例没有盘面快照：四柱/局数与当年记录一致才补存快照，否则提示
    if (!item.panSnapshot && state.currentPan) {
      const p = state.currentPan;
      const pillarsOk = !item.pillars || JSON.stringify(item.pillars) === JSON.stringify(p.pillars);
      const juOk = !item.juDesc || (p.dingju && item.juDesc === p.dingju.desc);
      if (pillarsOk && juOk) {
        const snap = snapshotPan(p);
        updateRecord(item.id, r => {
          r.panSnapshot = snap;
          r.panFingerprint = panFingerprint(snap);
          r.pillars = { ...p.pillars };
          r.juDesc = p.dingju ? p.dingju.desc : r.juDesc;
        });
      } else {
        setTimeout(() => showToast('注意：旧案例未保存盘面快照，按当前算法重算的四柱/局数与当时记录不一致'), 800);
      }
    }

    loadCases(item.id);
    if (state.isPendingReveal && typeof openYSModalHandler === 'function') {
      openYSModalHandler(true);
      return;
    }
    showToast(`已读取案例【${item.title || item.userQuestion || item.dateStr}】的原盘、问题与笔记`);
  }

  // 保存：有锁定记录时更新这条记录，没有时把当前研究盘另存为新记录
  function openSaveCaseModal() {
    const rec = getActiveRecord();
    const iptTitle = document.getElementById('iptCaseTitle');
    const txtRemark = document.getElementById('txtCaseRemark');
    const headline = document.getElementById('txtSaveCaseHeadline');
    if (headline) headline.textContent = rec ? '更新本局记录' : '保存为新案例';
    if (iptTitle) {
      iptTitle.value = (rec && rec.title) || (state.userQuestion ? state.userQuestion.trim() : (state.currentPan ? `${state.currentPan.pillars.day}日${state.currentPan.pillars.hour}时 占事` : ''));
    }
    if (txtRemark) txtRemark.value = state.caseRemark || '';
    openModal('modalSaveCase');
  }

  const btnSaveCase = document.getElementById('btnSaveCase');
  if (btnSaveCase) btnSaveCase.addEventListener('click', () => {
    if (blockIfPending('保存')) return;
    openSaveCaseModal();
  });
  const btnBottomSaveCase = document.getElementById('btnBottomSave');
  if (btnBottomSaveCase) btnBottomSaveCase.addEventListener('click', () => {
    if (blockIfPending('保存')) return;
    openSaveCaseModal();
  });

  const btnClearSaveRemark = document.getElementById('btnClearSaveRemark');
  if (btnClearSaveRemark) {
    btnClearSaveRemark.addEventListener('click', () => {
      const txtRemark = document.getElementById('txtCaseRemark');
      if (txtRemark && txtRemark.value.trim() && !window.confirm('确定清空这条断语笔记吗？')) return;
      if (txtRemark) txtRemark.value = '';
    });
  }

  const btnConfirmSave = document.getElementById('btnConfirmSaveCase');
  if (btnConfirmSave) btnConfirmSave.addEventListener('click', () => {
    const title = document.getElementById('iptCaseTitle').value.trim() || state.userQuestion || '奇门格局案例';
    const remark = document.getElementById('txtCaseRemark').value.trim();
    state.caseRemark = remark;
    try { localStorage.setItem('qimen_case_remark', remark); } catch (e) {}
    const txtUser = document.getElementById('txtUserRemark');
    if (txtUser) txtUser.value = remark;

    const rec = getActiveRecord();
    let savedId;
    if (rec) {
      updateRecord(rec.id, r => {
        r.title = title;
        r.titleEdited = true;
        r.remark = remark;
        r.userQuestion = state.userQuestion ? state.userQuestion.trim() : (r.userQuestion || title);
      });
      savedId = rec.id;
      showToast('已更新本局记录（盘面保持起局时的原样）');
    } else {
      const curPan = state.currentPan;
      const isBaoshu = !!(state.manualJu && state.manualJu.type === 'baoshu');
      const snap = curPan ? snapshotPan(curPan) : null;
      const item = insertRecord({
        id: newId(),
        source: isBaoshu ? 'baoshu' : 'manual',
        status: 'revealed',
        parentId: isBaoshu ? state.lastReleasedRecordId : null,
        createdAt: new Date().toISOString(),
        revealedAt: new Date().toISOString(),
        engineVersion: ENGINE_VERSION,
        title,
        titleEdited: true,
        remark,
        userQuestion: state.userQuestion ? state.userQuestion.trim() : title,
        selectedYongShen: Array.isArray(state.selectedYongShen) ? [...state.selectedYongShen] : ['值符'],
        ysAtReveal: Array.isArray(state.selectedYongShen) ? [...state.selectedYongShen] : ['值符'],
        yongshenNature: state.yongshenNature,
        dateStr: formatDateStr(state.year, state.month, state.day, state.hour, state.minute),
        ...settingsOf(state),
        panSnapshot: snap,
        panFingerprint: snap ? panFingerprint(snap) : '',
        pillars: (curPan && curPan.pillars) ? { ...curPan.pillars } : null,
        juDesc: (curPan && curPan.dingju) ? curPan.dingju.desc : ''
      });
      savedId = item.id;
      setActiveRecord(item.id);
      showToast('格局案例已保存，并锁定为当前记录');
    }
    closeModal('modalSaveCase');
    loadCases(savedId);
    renderDueBanner();
  });

  if (selCases) {
    selCases.addEventListener('change', () => showCaseDetail(selectedRecord()));
    selCases.addEventListener('click', () => showCaseDetail(selectedRecord()));
    selCases.addEventListener('dblclick', () => applyCase(selectedRecord()));
  }

  if (btnLoad) {
    btnLoad.addEventListener('click', () => {
      const item = selectedRecord();
      if (!item) {
        showToast('请先选择要读取的案例');
        return;
      }
      applyCase(item);
    });
  }

  let editingCaseId = null;

  function openEditCaseModal(item) {
    if (!item) {
      showToast('请先选择要编辑的案例');
      return;
    }
    editingCaseId = item.id;
    const metaEl = document.getElementById('editCaseMetaSummary');
    const iptTitle = document.getElementById('iptEditCaseTitle');
    const iptQ = document.getElementById('iptEditCaseQuestion');
    const txtRemark = document.getElementById('txtEditCaseRemark');
    if (metaEl) metaEl.textContent = `原盘信息（只读）：${item.dateStr} ｜ ${recordSummary(item)}`;
    if (iptTitle) iptTitle.value = item.title || '';
    if (iptQ) iptQ.value = item.userQuestion || item.title || '';
    if (txtRemark) txtRemark.value = item.remark || '';
    openModal('modalEditCase');
  }

  const btnEdit = document.getElementById('btnEditCase');
  if (btnEdit) btnEdit.addEventListener('click', () => openEditCaseModal(selectedRecord()));
  const btnDetailEdit = document.getElementById('btnDetailEditCase');
  if (btnDetailEdit) btnDetailEdit.addEventListener('click', () => openEditCaseModal(selectedRecord()));

  // 确认修改：只改文字信息，盘面永远是起局时的原盘 (不再提供“用当前盘覆盖”)
  const btnConfirmEdit = document.getElementById('btnConfirmEditCase');
  if (btnConfirmEdit) {
    btnConfirmEdit.addEventListener('click', () => {
      if (!editingCaseId) return;
      const iptTitle = document.getElementById('iptEditCaseTitle');
      const iptQ = document.getElementById('iptEditCaseQuestion');
      const txtRemark = document.getElementById('txtEditCaseRemark');
      const item = updateRecord(editingCaseId, r => {
        r.title = (iptTitle && iptTitle.value.trim()) || r.title || '奇门格局案例';
        r.titleEdited = true;
        r.userQuestion = (iptQ && iptQ.value.trim()) || r.title;
        r.remark = (txtRemark && txtRemark.value.trim()) || '';
      });
      if (item && item.id === state.activeRecordId) {
        state.userQuestion = item.userQuestion;
        state.caseRemark = item.remark;
        const txtUser = document.getElementById('txtUserRemark');
        if (txtUser) txtUser.value = item.remark;
        updateBoardCardCenter(state.currentPan);
      }
      closeModal('modalEditCase');
      loadCases(editingCaseId);
      if (item) showToast(`案例【${item.title}】已更新`);
    });
  }

  const btnDelete = document.getElementById('btnDeleteCase');
  if (btnDelete) btnDelete.addEventListener('click', () => {
    const item = selectedRecord();
    if (!item) {
      showToast('请先选择要删除的案例');
      return;
    }
    const name = item.title || item.userQuestion || item.dateStr;
    if (!window.confirm(`确定永久删除案例【${name}】吗？\n\n删除后盘面快照、断事笔记与反馈都将被彻底移除且无法恢复。`)) return;
    deleteRecord(item.id);
    if (item.id === state.activeRecordId) {
      state.isPendingReveal = false;
      applyPendingVisualMasks(false);
      setActiveRecord(null);
      executePaipan();
    }
    loadCases();
    renderDueBanner();
    showToast('案例已删除');
  });

  const btnVoid = document.getElementById('btnVoidCase');
  if (btnVoid) btnVoid.addEventListener('click', () => {
    const item = selectedRecord();
    if (!item) return;
    if (item.status === 'void') {
      updateRecord(item.id, r => {
        r.status = r.revealedAt ? 'revealed' : 'pending';
        r.voidReason = '';
      });
      showToast('已恢复此局');
    } else {
      updateRecord(item.id, r => {
        r.status = 'void';
        r.voidReason = r.voidReason || '起盘后觉得时间不对或问题不清，此盘不看';
      });
      if (item.id === state.activeRecordId) releaseLock('keep');
      showToast('已标记作废：这一局保留在库中，但不再参与回访');
    }
    loadCases(item.id);
    renderDueBanner();
  });

  const btnDetailNotes = document.getElementById('btnDetailNotes');
  if (btnDetailNotes) btnDetailNotes.addEventListener('click', () => {
    const item = selectedRecord();
    if (item) openCaseNotesModal(item.id);
  });

  // 导出 / 导入备份 (localStorage 清缓存即丢失，建议定期导出)
  const btnExport = document.getElementById('btnExportCases');
  if (btnExport) btnExport.addEventListener('click', () => {
    flushRecordAutosave();
    const json = exportRecordsJson();
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `qimen-cases-${todayStr().replace(/-/g, '')}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
    showToast(`已导出 ${loadRecords().length} 条案例`);
  });

  const btnImport = document.getElementById('btnImportCases');
  const fileImport = document.getElementById('fileImportCases');
  if (btnImport && fileImport) {
    btnImport.addEventListener('click', () => fileImport.click());
    fileImport.addEventListener('change', () => {
      const file = fileImport.files && fileImport.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const res = importRecordsJson(String(reader.result || ''));
          loadCases();
          renderDueBanner();
          showToast(`导入完成：新增 ${res.added} 条，更新 ${res.updated} 条，共 ${res.total} 条`);
        } catch (err) {
          showToast('导入失败：' + err.message);
        }
        fileImport.value = '';
      };
      reader.readAsText(file);
    });
  }

  loadCases();
}

// 案例库上方的待回访提醒条
function renderDueBanner() {
  const el = document.getElementById('caseDueBanner');
  if (!el) return;
  const due = dueFollowUps();
  if (!due.length) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }
  const first = due[0];
  el.style.display = 'flex';
  el.innerHTML = `<span>🔔 ${due.length} 条待回访 · ${escapeHtml(first.f.label)}【${escapeHtml(first.rec.userQuestion || first.rec.title || first.rec.dateStr)}】</span><button type="button" class="m3-btn m3-btn-tonal" id="btnOpenDueNotes">去回访</button>`;
  const btn = document.getElementById('btnOpenDueNotes');
  if (btn) btn.addEventListener('click', () => openCaseNotesModal(first.rec.id));
}


// 10. 实时时钟走时
function initLiveClock() {
  const clockEl = document.getElementById('txtLiveClock');
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  setInterval(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    const w = weekDays[now.getDay()];
    clockEl.textContent = `当前时间: ${y}年 ${m}月 ${d}日 ${h}时 ${mi}分 ${s}秒 星期${w}`;
  }, 1000);
}

// 通用弹窗与Toast函数
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toastMsg');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

// ==================== 11. 查找格局高级检索系统 ====================
const searchState = {
  conditions: {},
  currentGong: 1,
  currentCategory: 'tianSpirit',
  dingjuMethod: 'zhirun'
};

const SEARCH_CANDIDATES = {
  tianSpirit: ['值符', '螣蛇', '太阴', '六合', '白虎', '玄武', '九地', '九天'],
  star: ['天蓬', '天芮', '天冲', '天辅', '天禽', '天心', '天柱', '天任', '天英'],
  tianGan: ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'],
  door: ['休门', '生门', '伤门', '杜门', '景门', '死门', '惊门', '开门'],
  diGan: ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'],
  diSpirit: ['值符', '螣蛇', '太阴', '六合', '白虎', '玄武', '九地', '九天']
};

const SEARCH_GONG_NAMES = {
  1: '坎一宫', 2: '坤二宫', 3: '震三宫', 4: '巽四宫', 5: '中五宫',
  6: '乾六宫', 7: '兑七宫', 8: '艮八宫', 9: '离九宫'
};

function formatDateTimeLocal(d) {
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  const H = String(d.getHours()).padStart(2, '0');
  const Min = String(d.getMinutes()).padStart(2, '0');
  return `${Y}-${M}-${D}T${H}:${Min}`;
}

function setQuickDateRange(rangeType) {
  const now = new Date(state.year, state.month - 1, state.day, state.hour, state.minute);
  let start = new Date(now);
  let end = new Date(now);

  if (rangeType === 'today') {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (rangeType === '3days') {
    end.setDate(end.getDate() + 3);
  } else if (rangeType === '7days') {
    end.setDate(end.getDate() + 7);
  } else if (rangeType === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }

  const iptStart = document.getElementById('iptSearchStart');
  const iptEnd = document.getElementById('iptSearchEnd');
  if (iptStart) iptStart.value = formatDateTimeLocal(start);
  if (iptEnd) iptEnd.value = formatDateTimeLocal(end);

  document.querySelectorAll('.search-quick-ranges .m3-chip-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.range === rangeType);
  });
}

function updateSearchPromptPreview() {
  const txtPrompt = document.getElementById('txtSearchPrompt');
  if (!txtPrompt) return;

  const activeGongs = [];
  for (let g = 1; g <= 9; g++) {
    const c = searchState.conditions[g];
    if (c && Object.values(c).some(v => v !== undefined && v !== null && v !== '')) {
      activeGongs.push(g);
    }
  }

  const gongsToShow = activeGongs.length > 0 ? activeGongs : [searchState.currentGong];

  const blocks = gongsToShow.map(g => {
    const c = searchState.conditions[g] || {};
    const gongName = SEARCH_GONG_NAMES[g];
    return `${gongName}={\n　　天八神 = ${c.tianSpirit || ''}\n　　九星 = ${c.star || ''}\n　　天盘干 = ${c.tianGan || ''}\n　　八门 = ${c.door || ''}\n　　地盘干 = ${c.diGan || ''}\n　　地八神 = ${c.diSpirit || ''}\n　}`;
  });

  txtPrompt.value = blocks.join('\n');
}

function renderCandidateChips() {
  const box = document.getElementById('boxSearchCandidates');
  if (!box) return;
  box.innerHTML = '';

  const list = SEARCH_CANDIDATES[searchState.currentCategory] || [];
  const currentVal = (searchState.conditions[searchState.currentGong] || {})[searchState.currentCategory];

  list.forEach(val => {
    const chip = document.createElement('div');
    chip.className = 'candidate-chip';
    if (currentVal === val) chip.classList.add('active');
    chip.textContent = val;
    chip.addEventListener('click', () => {
      if (!searchState.conditions[searchState.currentGong]) {
        searchState.conditions[searchState.currentGong] = {};
      }
      if (searchState.conditions[searchState.currentGong][searchState.currentCategory] === val) {
        delete searchState.conditions[searchState.currentGong][searchState.currentCategory];
      } else {
        searchState.conditions[searchState.currentGong][searchState.currentCategory] = val;
      }
      renderCandidateChips();
      updateSearchPromptPreview();
    });
    box.appendChild(chip);
  });
}

function openPatternSearchModal() {
  setQuickDateRange('3days');
  renderCandidateChips();
  updateSearchPromptPreview();
  openModal('modalFindPattern');
}

function executeSearch() {
  const iptStart = document.getElementById('iptSearchStart');
  const iptEnd = document.getElementById('iptSearchEnd');
  const txtStatus = document.getElementById('txtSearchStatus');
  const boxResults = document.getElementById('boxSearchResults');
  const listResults = document.getElementById('listSearchResults');
  const btnExecute = document.getElementById('btnSearchExecute');

  if (!iptStart || !iptEnd || !iptStart.value || !iptEnd.value) {
    showToast('请选择开始时间和结束时间');
    return;
  }

  const startDate = new Date(iptStart.value);
  const endDate = new Date(iptEnd.value);
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  if (isNaN(startMs) || isNaN(endMs)) {
    showToast('时间格式无效，请重新选择');
    return;
  }

  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  if (startYear < 1900 || startYear > 2100 || endYear < 1900 || endYear > 2100) {
    showToast('本程序目前只能用于1900到2100年之间的格局查找,请重新选择');
    return;
  }

  if (endMs <= startMs) {
    showToast('结束时间必须比开始时间大');
    return;
  }

  const hasConditions = Object.values(searchState.conditions).some(c => 
    c && Object.values(c).some(v => v !== undefined && v !== null && v !== '')
  );

  if (!hasConditions) {
    showToast('请先选择查找条件或选择经典格局');
    return;
  }

  txtStatus.textContent = '正在查找.....';
  btnExecute.disabled = true;
  boxResults.style.display = 'block';
  listResults.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--md-sys-color-outline);">正在检索符合条件的奇门排盘...</div>';

  setTimeout(() => {
    try {
      const results = [];
      const stepMs = 2 * 3600 * 1000;
      let curMs = startMs;
      const dingjuMethod = searchState.dingjuMethod;

      while (curMs <= endMs) {
        const curDate = new Date(curMs);
        const pan = paipan({
          year: curDate.getFullYear(),
          month: curDate.getMonth() + 1,
          day: curDate.getDate(),
          hour: curDate.getHours(),
          minute: curDate.getMinutes(),
          longitude: state.longitude,
          dingjuMethod: dingjuMethod,
          paipanMethod: state.paipanMethod,
          zishi: state.zishi,
          cityName: state.cityName
        });

        if (matchPatternCondition(pan, searchState.conditions)) {
          results.push({
            date: curDate,
            pan: pan
          });
        }

        curMs += stepMs;
      }

      txtStatus.textContent = `查找结束   一共查找到 ${results.length} 个符合条件的起局时间`;
      btnExecute.disabled = false;

      if (results.length === 0) {
        listResults.innerHTML = '<div class="search-empty-msg">在所选时间范围内未找到符合条件的起局时刻</div>';
        return;
      }

      listResults.innerHTML = '';
      results.forEach(res => {
        const d = res.date;
        const Y = d.getFullYear();
        const M = String(d.getMonth() + 1).padStart(2, '0');
        const D = String(d.getDate()).padStart(2, '0');
        const H = String(d.getHours()).padStart(2, '0');
        const Min = String(d.getMinutes()).padStart(2, '0');
        const timeStr = `${Y}-${M}-${D} ${H}:${Min}`;

        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `
          <span class="sr-time">${timeStr}</span>
          <span class="sr-info">【${res.pan.dingju.desc}】值符${res.pan.starFu} 值使${res.pan.doorShi} 旬首${res.pan.xun}</span>
        `;

        item.addEventListener('click', () => {
          state.year = d.getFullYear();
          state.month = d.getMonth() + 1;
          state.day = d.getDate();
          state.hour = d.getHours();
          state.minute = d.getMinutes();
          state.dingjuMethod = dingjuMethod;
          state.manualJu = null;
          
          const selManual = document.getElementById('selManualJu');
          if (selManual) selManual.value = 'auto';

          const segDingju = document.getElementById('segDingjuGroup');
          if (segDingju) {
            segDingju.querySelectorAll('.m3-segment-btn').forEach(btn => {
              btn.classList.toggle('active', btn.dataset.value === dingjuMethod);
            });
          }

          syncDateTimeToPickers();
          renderCalendar();
          executePaipan();
          closeModal('modalFindPattern');
          showToast(`已加载格局时刻并起局：${timeStr}`);
        });

        listResults.appendChild(item);
      });
    } catch (err) {
      console.error('查找格局出错:', err);
      txtStatus.textContent = '查找过程中发生错误';
      btnExecute.disabled = false;
      listResults.innerHTML = `<div class="search-empty-msg" style="color: var(--md-sys-color-error);">查找失败: ${err.message}</div>`;
    }
  }, 30);
}

function initPatternSearch() {
  const selGong = document.getElementById('selSearchGong');
  if (selGong) {
    selGong.addEventListener('change', () => {
      searchState.currentGong = parseInt(selGong.value);
      renderCandidateChips();
      updateSearchPromptPreview();
    });
  }

  const selCategory = document.getElementById('selSearchCategory');
  if (selCategory) {
    selCategory.addEventListener('change', () => {
      searchState.currentCategory = selCategory.value;
      renderCandidateChips();
    });
  }

  const selPreset = document.getElementById('selSearchPreset');
  if (selPreset) {
    selPreset.addEventListener('change', () => {
      const presetKey = selPreset.value;
      if (!presetKey) return;
      const p = SEARCH_PRESETS[presetKey];
      if (!p) return;

      searchState.conditions = {};
      let targetGong = searchState.currentGong;
      if (p.gong) {
        targetGong = p.gong;
        searchState.currentGong = targetGong;
        if (selGong) selGong.value = targetGong.toString();
      }

      searchState.conditions[targetGong] = {};
      if (p.tianSpirit) searchState.conditions[targetGong].tianSpirit = p.tianSpirit;
      if (p.star) searchState.conditions[targetGong].star = p.star;
      if (p.tianGan) searchState.conditions[targetGong].tianGan = p.tianGan;
      if (p.door) searchState.conditions[targetGong].door = p.door;
      if (p.doors) searchState.conditions[targetGong].door = p.doors[0];
      if (p.qis) searchState.conditions[targetGong].tianGan = p.qis[0];
      if (p.diGan) searchState.conditions[targetGong].diGan = p.diGan;
      if (p.diSpirit) searchState.conditions[targetGong].diSpirit = p.diSpirit;

      renderCandidateChips();
      updateSearchPromptPreview();
    });
  }

  const btnClearField = document.getElementById('btnClearCurrentField');
  if (btnClearField) {
    btnClearField.addEventListener('click', () => {
      if (searchState.conditions[searchState.currentGong]) {
        delete searchState.conditions[searchState.currentGong][searchState.currentCategory];
      }
      renderCandidateChips();
      updateSearchPromptPreview();
    });
  }

  const btnReset = document.getElementById('btnSearchReset');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      searchState.conditions = {};
      if (selPreset) selPreset.value = '';
      renderCandidateChips();
      updateSearchPromptPreview();
      const boxResults = document.getElementById('boxSearchResults');
      if (boxResults) boxResults.style.display = 'none';
      const txtStatus = document.getElementById('txtSearchStatus');
      if (txtStatus) txtStatus.textContent = '选择好条件后点开始查找';
    });
  }

  document.querySelectorAll('.search-quick-ranges .m3-chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setQuickDateRange(btn.dataset.range);
    });
  });

  const segSearchDingju = document.getElementById('segSearchDingju');
  if (segSearchDingju) {
    segSearchDingju.querySelectorAll('.m3-segment-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        segSearchDingju.querySelectorAll('.m3-segment-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        searchState.dingjuMethod = btn.dataset.value;
      });
    });
  }

  const btnExecute = document.getElementById('btnSearchExecute');
  if (btnExecute) {
    btnExecute.addEventListener('click', executeSearch);
  }
}

// ==================== 12. 选取用神与所问问题模块 ====================

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const HE_GAN_MAP = {
  '甲': '己', '己': '甲',
  '乙': '庚', '庚': '乙',
  '丙': '辛', '辛': '丙',
  '丁': '壬', '壬': '丁',
  '戊': '癸', '癸': '戊'
};

// 判定宫位是否匹配所选取的用神
function checkPalaceMatchYongShen(pan, g, yongShenList) {
  if (!pan || !yongShenList || yongShenList.length === 0) {
    return { matched: false, items: [], hasZhifu: false };
  }
  // 排宫法(转盘)中五宫寄坤二，无独立神门星，中宫文字不参与用神选取
  if (g === 5 && pan.paipanMethod === 'zhuan') {
    return { matched: false, items: [], hasZhifu: false };
  }

  const tg = pan.tianpanGan[g] || '';
  const tj = pan.tianpanJigan[g] || '';
  const door = pan.tianpanDoor[g] || '';
  const star = pan.tianpanStar[g] || '';
  const spirit = pan.tianpanSpirit[g] || '';
  const hasMa = !!(pan.palaceFlags[g] && pan.palaceFlags[g].hasMa);
  const isKong = !!(pan.palaceFlags[g] && pan.palaceFlags[g].isKong);
  const gongNames = [String(g), GONG_CN[g] || '', `${GONG_CN[g]}宫`];

  const dayGan = pan.dayGan;
  const shiGan = pan.shiGan;
  const yearGan = pan.pillars && pan.pillars.year ? pan.pillars.year[0] : '';
  const monthGan = pan.pillars && pan.pillars.month ? pan.pillars.month[0] : '';
  const heGan = HE_GAN_MAP[dayGan] || '';
  const keGan = KE_GAN_MAP ? (KE_GAN_MAP[dayGan] || '') : '';
  const beiKeGan = BEI_KE_GAN_MAP ? (BEI_KE_GAN_MAP[dayGan] || '') : '';

  const matchedItems = [];

  for (const rawYs of yongShenList) {
    const ys = (typeof rawYs === 'object' && rawYs !== null) ? (rawYs.name || '') : String(rawYs);
    let hit = false;
    if (ys === '日干') {
      if (tg === dayGan || tj === dayGan) hit = true;
    } else if (ys === '时干') {
      if (tg === shiGan || tj === shiGan) hit = true;
    } else if (ys === '年干') {
      if (tg === yearGan || tj === yearGan) hit = true;
    } else if (ys === '月干') {
      if (tg === monthGan || tj === monthGan) hit = true;
    } else if (ys === '合干' || ys === '相合之干') {
      if (heGan && (tg === heGan || tj === heGan)) hit = true;
    } else if (ys === '所克之干' || ys === '我克之干') {
      if (keGan && (tg === keGan || tj === keGan)) hit = true;
    } else if (ys === '克我之干') {
      if (beiKeGan && (tg === beiKeGan || tj === beiKeGan)) hit = true;
    } else if (BAGUA_GONG_MAP && BAGUA_GONG_MAP[ys] === g) {
      hit = true;
    } else if (ys === '对冲宫' || ys === '日干对冲宫' || ys === '对冲') {
      let dayG = 0;
      for (let dg = 1; dg <= 9; dg++) {
        if (pan.tianpanGan && (pan.tianpanGan[dg] === dayGan || (pan.tianpanJigan && pan.tianpanJigan[dg] === dayGan))) {
          dayG = dg;
          break;
        }
      }
      const OPPOSITE_GONG = { 1: 9, 9: 1, 2: 8, 8: 2, 3: 7, 7: 3, 4: 6, 6: 4 };
      if (dayG && OPPOSITE_GONG[dayG] === g) hit = true;
    } else if (['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'].includes(ys)) {
      if (tg === ys || tj === ys) hit = true;
    } else if (ys === '值符' || ys === '直符') {
      if (spirit === '值符') hit = true;
    } else if (['螣蛇', '太阴', '六合', '白虎', '玄武', '九地', '九天'].includes(ys)) {
      if (spirit === ys) hit = true;
    } else if (['天蓬', '天芮', '天冲', '天辅', '天禽', '天心', '天柱', '天任', '天英'].includes(ys) || ys.startsWith('天')) {
      if (star.includes(ys)) hit = true;
      if (g === 2 && ys === '天禽' && star.includes('天芮')) hit = true;
    } else if (['休门', '生门', '伤门', '杜门', '景门', '死门', '惊门', '开门'].includes(ys) || ys.endsWith('门')) {
      if (door === ys || door.includes(ys.replace('门', ''))) hit = true;
    } else if (ys === '马星') {
      if (hasMa) hit = true;
    } else if (ys === '空亡' || ys === '旬空') {
      if (isKong) hit = true;
    } else if (
      ys === `空亡•${GONG_CN[g]}宫` ||
      ys === `旬空•${GONG_CN[g]}宫` ||
      ys === `旬空亡•${GONG_CN[g]}宫` ||
      ys === `空亡•${GONG_CN[g]}` ||
      ys === `旬空•${GONG_CN[g]}` ||
      ys === `旬空亡•${GONG_CN[g]}`
    ) {
      if (isKong) hit = true;
    } else if (gongNames.includes(ys)) {
      hit = true;
    }

    if (hit) {
      matchedItems.push(ys);
    }
  }

  const hasZhifu = matchedItems.includes('值符') || matchedItems.includes('直符');

  return {
    matched: matchedItems.length > 0,
    items: matchedItems,
    hasZhifu: hasZhifu
  };
}

// 判定当前用神与所问事项是否代表 人 或 物
// 准则:
// 1. 代表人的用神空（看对宫）
// 2. 代表物品的用神空（看对宫）
// 3. 代表事情的空不看对面
function isYongShenPersonOrObject(selectedList, question, natureSetting) {
  if (natureSetting === 'person_object') return true;
  if (natureSetting === 'affair') return false;

  const q = (question || '').trim();
  const personKeywords = ['我', '自己', '自身', '他', '她', '谁', '人', '恋', '婚', '妻', '夫', '对象', '男', '女', '友', '朋', '父母', '长辈', '领导', '上司', '孩子', '子女', '胎', '产', '下属', '病', '医', '贼', '盗', '犯', '对手'];
  const objectKeywords = ['钱', '财', '物', '本金', '资金', '利润', '货', '车', '失物', '手机', '资产', '物品', '东西'];
  const pureAffairKeywords = ['开业', '合作', '签约', '出行', '走势', '变动'];

  const hasPersonWord = personKeywords.some(w => q.includes(w));
  const hasObjectWord = objectKeywords.some(w => q.includes(w));
  if (hasPersonWord || hasObjectWord) return true;

  const list = Array.isArray(selectedList) ? selectedList : [];
  if (list.length === 0) return true;

  const personObjectItems = [
    '日干', '时干', '年干', '月干', '合干', '值符', '直符',
    '乙', '庚', '丙', '戊', '辛', '癸',
    '天芮', '天蓬', '天心', '天辅', '玄武', '太阴'
  ];

  const pureAffairItems = [
    '开门', '休门', '伤门', '杜门', '景门', '死门', '惊门',
    '六合', '九天', '九地', '白虎', '螣蛇', '马星', '空亡'
  ];

  const hasPersonObj = list.some(item => personObjectItems.includes(item));
  const allArePureAffair = list.every(item => pureAffairItems.includes(item) || item.startsWith('空亡') || item.startsWith('旬空'));

  if (allArePureAffair && !hasPersonWord && !hasObjectWord) {
    return false;
  }

  return true;
}

// 更新九宫盘面中间显示的四柱干支或所问问题
function updateBoardCardCenter(pan) {
  const el = document.getElementById('boardCardCenter');
  if (!el) return;
  const p = pan || state.currentPan;
  if (state.showDipan) {
    const q = state.userQuestion ? state.userQuestion.trim() : '';
    const displayText = q ? q : '点击输入所问事项';
    el.innerHTML = `<span class="header-center-text" title="${q ? escapeHtml(q) : '点击设置所问事项'}">${escapeHtml(displayText)}</span>`;
    el.title = q ? `所问事项：${q} (点击编辑或选取用神)` : '点击输入所问事项与选取用神';
  } else {
    if (p && p.pillars) {
      const sizhuStr = `${p.pillars.year}  ${p.pillars.month}  ${p.pillars.day}  ${p.pillars.hour}`;
      el.innerHTML = `<span class="header-center-text" title="${sizhuStr}">${sizhuStr}</span>`;
      el.title = `四柱干支：${sizhuStr}（点击可选取用神与输入所问）`;
    } else {
      el.innerHTML = `<span class="header-center-text">四柱干支</span>`;
      el.title = '四柱干支';
    }
  }
}

// 初始化选取用神与所问事项弹窗交互
function initYongShenModal() {
  const btnSelectYongShen = document.getElementById('btnSelectYongShen');
  const boardCenter = document.getElementById('boardCardCenter');
  const iptQuestion = document.getElementById('iptUserQuestion');
  const btnClearQ = document.getElementById('btnClearUserQuestion');
  const txtUserRemark = document.getElementById('txtUserRemark');
  const btnClearUserRemark = document.getElementById('btnClearUserRemark');
  const btnClearAllYS = document.getElementById('btnClearAllYongShen');
  const btnResetYS = document.getElementById('btnResetYongShen');
  const btnConfirmYS = document.getElementById('btnConfirmYongShen');
  const tagsContainer = document.getElementById('yongshenSelectedContainer');
  const presetsContainer = document.getElementById('ysPresetsContainer');
  const promptBar = document.getElementById('ysPromptBar');
  const categoryTabs = document.getElementById('ysCategoryTabs');
  const genderChips = document.getElementById('ysGenderChips');

  // 当前选中的用神对象结构集合: Map<name, { name, nature: 'person'|'matter'|'object', role: string }>
  let selectedYongShenMap = new Map();
  let currentPresetCategory = 'all';

  const NATURE_INFO = {
    'person': { next: 'matter', text: '人', class: 'nature-person', desc: '人物类(逢空看对宫)' },
    'matter': { next: 'object', text: '事', class: 'nature-matter', desc: '事情类(逢空不看对面)' },
    'object': { next: 'person', text: '物', class: 'nature-object', desc: '物品类(逢空主虚设不在)' }
  };

  // 渲染已选用神标签列表
  function renderSelectedTags() {
    if (!tagsContainer) return;
    if (selectedYongShenMap.size === 0) {
      tagsContainer.innerHTML = '<span class="yongshen-empty-hint" style="font-size: 12.5px; color: var(--md-sys-color-outline);">尚未选取用神（可点击上方快捷预设或下方各分类要素勾选）</span>';
      return;
    }

    const items = Array.from(selectedYongShenMap.values());
    tagsContainer.innerHTML = items.map(item => {
      const isZhifu = item.name === '值符' || item.name === '直符';
      const nat = item.nature || getYongShenNature(item.name);
      const natConfig = NATURE_INFO[nat] || NATURE_INFO.matter;

      return `
        <span class="yongshen-tag-pill ${isZhifu ? 'tag-zhifu' : ''}" data-val="${escapeHtml(item.name)}">
          <span>${escapeHtml(item.name)}</span>
          <span class="ys-nature-tag ${natConfig.class}" title="性质: ${natConfig.desc} (点击切换人/事/物)" data-nature-toggle="${escapeHtml(item.name)}">[${natConfig.text}]</span>
          <span class="remove-btn" title="移除此用神" data-remove="${escapeHtml(item.name)}">✕</span>
        </span>
      `;
    }).join('');

    // 点击切换性质 (人 -> 事 -> 物 -> 人)
    tagsContainer.querySelectorAll('[data-nature-toggle]').forEach(badge => {
      badge.addEventListener('click', e => {
        e.stopPropagation();
        const val = badge.dataset.natureToggle;
        const item = selectedYongShenMap.get(val);
        if (item) {
          const curNat = item.nature || getYongShenNature(item.name);
          const nextNat = (NATURE_INFO[curNat] || NATURE_INFO.matter).next;
          item.nature = nextNat;
          state.selectedYongShenNatures[val] = nextNat;
          renderSelectedTags();
        }
      });
    });

    // 移除单个用神
    tagsContainer.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const val = btn.dataset.remove;
        selectedYongShenMap.delete(val);
        delete state.selectedYongShenNatures[val];

        // 同步取消底部 Checkbox 勾选
        const cb = document.querySelector(`#modalYongShen .ys-chips-row input[type="checkbox"][value="${val}"]`);
        if (cb) {
          cb.checked = false;
          const chip = cb.closest('.ys-chip');
          if (chip) chip.classList.remove('active');
        }

        renderSelectedTags();
      });
    });

    if (typeof updateStandardTabsBadge === 'function') {
      updateStandardTabsBadge();
    }
  }

  // 批量设置用神项到 UI
  function applyYongShenList(itemsList, questionText = null) {
    if (questionText && iptQuestion) {
      iptQuestion.value = questionText;
      state.userQuestion = questionText;
      scheduleRecordAutosave();
    }

    itemsList.forEach(it => {
      const name = typeof it === 'string' ? it : it.name;
      const nature = (typeof it === 'object' && it.nature) ? it.nature : (state.selectedYongShenNatures[name] || getYongShenNature(name));
      const role = (typeof it === 'object' && it.role) ? it.role : '';
      selectedYongShenMap.set(name, { name, nature, role });
      state.selectedYongShenNatures[name] = nature;

      // 同步高亮底部 Checkbox
      const cb = document.querySelector(`#modalYongShen .ys-chips-row input[type="checkbox"][value="${name}"]`);
      if (cb) {
        cb.checked = true;
        const chip = cb.closest('.ys-chip');
        if (chip) chip.classList.add('active');
      }
    });

    renderSelectedTags();
  }

  // 渲染快捷预设列表
  function renderPresetsUI() {
    if (!presetsContainer) return;
    const list = currentPresetCategory === 'all'
      ? YONGSHEN_PRESETS
      : YONGSHEN_PRESETS.filter(p => p.category === currentPresetCategory);

    presetsContainer.innerHTML = list.map(p => {
      const hasPrompt = !!p.prompt;
      return `
        <button type="button" class="yongshen-qchip ${hasPrompt ? 'has-prompt' : ''}" data-preset-id="${p.id}" title="${p.hint || p.question}">
          <span class="qchip-name">${escapeHtml(p.name)}</span>
        </button>
      `;
    }).join('');

    // 点击预设处理
    presetsContainer.querySelectorAll('.yongshen-qchip').forEach(btn => {
      btn.addEventListener('click', () => {
        const pId = btn.dataset.presetId;
        const preset = YONGSHEN_PRESETS.find(x => x.id === pId);
        if (!preset) return;

        presetsContainer.querySelectorAll('.yongshen-qchip').forEach(b => b.classList.remove('is-active-preset'));
        btn.classList.add('is-active-preset');

        if (preset.prompt) {
          showPresetPrompt(preset);
        } else {
          hidePresetPrompt();
          // 无追问预设：若开启了风水宫身份且问人生事业，自动带上风水宫
          let finalItems = [...preset.items];
          if (state.userGenderRole && state.userGenderRole !== 'none') {
            const GENDER_MAP = {
              'male': { name: '乾宫', nature: 'person', role: '求测人男风水位' },
              'female': { name: '坤宫', nature: 'person', role: '求测人女风水位' },
              'son': { name: '震宫', nature: 'person', role: '长子风水位' },
              'daughter': { name: '巽宫', nature: 'person', role: '长女风水位' }
            };
            const fg = GENDER_MAP[state.userGenderRole];
            if (fg && !finalItems.some(x => (x.name || x) === fg.name)) {
              finalItems.push(fg);
            }
          }
          applyYongShenList(finalItems, preset.question);
          if (preset.hint) {
            showToast(preset.hint);
          }
        }
      });
    });
  }

  // 展开追问参数栏
  function showPresetPrompt(preset) {
    if (!promptBar) return;
    const pmt = preset.prompt;
    promptBar.style.display = 'block';

    // 变动出行 8 方位追问
    if (pmt.type === 'direction_8') {
      const dayGan = state.currentPan && state.currentPan.dayGan ? state.currentPan.dayGan : '丙';
      let html = `
        <div class="ys-prompt-title">${escapeHtml(pmt.title)}</div>
        <div class="ys-prompt-options">
      `;
      DIRECTION_OPTIONS.forEach(opt => {
        const isMu = opt.muGan.includes(dayGan);
        html += `
          <button type="button" class="ys-prompt-btn" data-dir="${opt.dir}" data-gong="${opt.gongName}" data-ismu="${isMu ? '1' : '0'}">
            <b>${opt.dir}</b> (${opt.gongName})${isMu ? ' <span style="color:#ef4444;font-size:11px;font-weight:bold;">[入墓]</span>' : ''}
          </button>
        `;
      });
      html += `</div><div id="ysPromptAlertArea"></div>`;
      promptBar.innerHTML = html;

      promptBar.querySelectorAll('.ys-prompt-btn').forEach(b => {
        b.addEventListener('click', () => {
          promptBar.querySelectorAll('.ys-prompt-btn').forEach(x => x.style.borderColor = 'var(--md-sys-color-outline-variant)');
          b.style.borderColor = 'var(--md-sys-color-primary)';
          const dir = b.dataset.dir;
          const gongName = b.dataset.gong;
          const isMu = b.dataset.ismu === '1';

          const qText = pmt.questionPrefix.replace('{dir}', dir);
          const finalItems = [
            ...pmt.items,
            { name: gongName, nature: 'object', role: `${dir}方目的地` }
          ];

          applyYongShenList(finalItems, qText);

          const alertArea = document.getElementById('ysPromptAlertArea');
          if (alertArea) {
            if (isMu) {
              alertArea.innerHTML = `<div class="ys-prompt-alert">提示：日干【${dayGan}】在${dir}方(${gongName})入墓！叶鸿生断法提示出行吉事受困，若非十万火急宜改日出门。</div>`;
            } else {
              alertArea.innerHTML = `<div class="ys-prompt-hint">已锁定出行方向：${dir}方 (${gongName})，日干得气，可详研落宫星门克应。</div>`;
            }
          }
        });
      });
      return;
    }

    // 常规选项追问
    let html = `
      <div class="ys-prompt-title">${escapeHtml(pmt.title)}</div>
      <div class="ys-prompt-options">
    `;
    pmt.options.forEach((opt, idx) => {
      html += `
        <button type="button" class="ys-prompt-btn" data-opt-idx="${idx}">
          <div style="font-weight:700;">${escapeHtml(opt.label)}</div>
          <div style="font-size:11px; color:var(--md-sys-color-outline); margin-top:2px;">${escapeHtml(opt.desc)}</div>
        </button>
      `;
    });
    html += `</div><div id="ysPromptAlertArea"></div>`;
    promptBar.innerHTML = html;

    promptBar.querySelectorAll('.ys-prompt-btn').forEach(b => {
      b.addEventListener('click', () => {
        promptBar.querySelectorAll('.ys-prompt-btn').forEach(x => x.style.borderColor = 'var(--md-sys-color-outline-variant)');
        b.style.borderColor = 'var(--md-sys-color-primary)';

        const idx = parseInt(b.dataset.optIdx);
        const opt = pmt.options[idx];
        if (!opt) return;

        let finalItems = JSON.parse(JSON.stringify(opt.items));
        const dayGan = state.currentPan && state.currentPan.dayGan ? state.currentPan.dayGan : '丙';
        const yearGan = state.currentPan && state.currentPan.pillars?.year ? state.currentPan.pillars.year[0] : '戊';

        // 智能代入推导干
        finalItems.forEach(it => {
          if (it.name === '所克之干') {
            const kg = (KE_GAN_MAP && KE_GAN_MAP[dayGan]) || '庚';
            it.name = kg;
            it.role = `被告(${kg})`;
          } else if (it.name === '克我之干') {
            const bkg = (BEI_KE_GAN_MAP && BEI_KE_GAN_MAP[dayGan]) || '庚';
            it.name = bkg;
            it.role = `原告(${bkg})`;
          } else if (it.name === '合干' && preset.id === 'parents') {
            const yhe = (HE_GAN_MAP && HE_GAN_MAP[yearGan]) || '癸';
            it.name = yhe;
            it.role = `母亲(${yhe})`;
          }
        });

        // 检查全局风水宫身份
        if (state.userGenderRole && state.userGenderRole !== 'none') {
          const GENDER_MAP = {
            'male': { name: '乾宫', nature: 'person', role: '求测人男风水位' },
            'female': { name: '坤宫', nature: 'person', role: '求测人女风水位' },
            'son': { name: '震宫', nature: 'person', role: '长子风水位' },
            'daughter': { name: '巽宫', nature: 'person', role: '长女风水位' }
          };
          const fg = GENDER_MAP[state.userGenderRole];
          if (fg && !finalItems.some(x => x.name === fg.name)) {
            finalItems.push(fg);
          }
        }

        applyYongShenList(finalItems, opt.question);

        const alertArea = document.getElementById('ysPromptAlertArea');
        if (alertArea && preset.hint) {
          alertArea.innerHTML = `<div class="ys-prompt-hint">${escapeHtml(preset.hint)}</div>`;
        }
      });
    });
  }

  function hidePresetPrompt() {
    if (promptBar) {
      promptBar.style.display = 'none';
      promptBar.innerHTML = '';
    }
  }

  // 绑定预设分类选项卡切换
  if (categoryTabs) {
    categoryTabs.querySelectorAll('.ys-cat-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        categoryTabs.querySelectorAll('.ys-cat-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentPresetCategory = tab.dataset.cat;
        hidePresetPrompt();
        renderPresetsUI();
      });
    });
  }

  // 绑定固定用神标准分类选项卡 (四柱核心、八门、八神、九星、十干像意、特殊用神)
  const standardCategoryTabs = document.getElementById('ysStandardCategoryTabs');

  function updateStandardTabsBadge() {
    if (!standardCategoryTabs) return;
    standardCategoryTabs.querySelectorAll('.ys-cat-tab').forEach(tab => {
      const grp = tab.dataset.group;
      const box = document.querySelector(`#modalYongShen .ys-standard-group-box[data-group="${grp}"]`);
      if (!box) return;
      const count = box.querySelectorAll('input[type="checkbox"]:checked').length;
      const baseName = tab.dataset.baseName || tab.textContent.replace(/\s*\d+$/, '').replace(/\s*\(\d+\)$/, '').trim();
      tab.dataset.baseName = baseName;
      if (count > 0) {
        tab.innerHTML = `${baseName}<span class="ys-cat-tab-badge">${count}</span>`;
      } else {
        tab.innerHTML = baseName;
      }
    });
  }

  if (standardCategoryTabs) {
    standardCategoryTabs.querySelectorAll('.ys-cat-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        standardCategoryTabs.querySelectorAll('.ys-cat-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const targetGroup = tab.dataset.group;
        document.querySelectorAll('#modalYongShen .ys-standard-group-box').forEach(box => {
          box.style.display = (box.dataset.group === targetGroup) ? 'block' : 'none';
        });
      });
    });
  }

  // 绑定求测人风水宫 / 性别身份切换
  if (genderChips) {
    genderChips.querySelectorAll('.ys-gender-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        genderChips.querySelectorAll('.ys-gender-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.userGenderRole = btn.dataset.gender || 'none';
        try {
          localStorage.setItem('qimen_user_gender_role', state.userGenderRole);
        } catch (e) {}

        const gong = btn.dataset.gong;
        if (gong) {
          showToast(`已选定风水宫身份：${btn.textContent.trim()}，问测人生时将自动兼顾【${gong}】`);
        } else {
          showToast('已设为不限风水宫身份');
        }
      });
    });
  }

  // 初始化预设区域
  renderPresetsUI();

  // 从当前全局状态同步到弹窗
  function syncUIFromState() {
    if (iptQuestion) iptQuestion.value = state.userQuestion || '';
    if (txtUserRemark) txtUserRemark.value = state.caseRemark || '';

    // 同步风水宫身份激活态
    if (genderChips) {
      const curGender = state.userGenderRole || 'none';
      genderChips.querySelectorAll('.ys-gender-chip').forEach(b => {
        b.classList.toggle('active', b.dataset.gender === curGender);
      });
    }

    // 重构已选用神结构字典
    selectedYongShenMap.clear();
    const currentList = Array.isArray(state.selectedYongShen) ? state.selectedYongShen : [];
    currentList.forEach(name => {
      const nat = state.selectedYongShenNatures[name] || getYongShenNature(name);
      selectedYongShenMap.set(name, { name, nature: nat, role: '' });
    });

    // 同步底部 Checkbox
    document.querySelectorAll('#modalYongShen .ys-chips-row input[type="checkbox"]').forEach(cb => {
      const isChecked = selectedYongShenMap.has(cb.value);
      cb.checked = isChecked;
      const chip = cb.closest('.ys-chip');
      if (chip) chip.classList.toggle('active', isChecked);
    });

    hidePresetPrompt();
    renderSelectedTags();
    if (typeof updateStandardTabsBadge === 'function') updateStandardTabsBadge();
  }

  function openYSModal(isFromCast = false) {
    syncUIFromState();
    const banner = document.getElementById('yongshenCastBanner');
    const bannerTime = document.getElementById('txtCastBannerTime');
    const btnConfirm = document.getElementById('btnConfirmYongShen');

    if (isFromCast || state.isPendingReveal) {
      if (banner) banner.style.display = 'flex';
      if (bannerTime) {
        bannerTime.textContent = `${state.year}年${String(state.month).padStart(2, '0')}月${String(state.day).padStart(2, '0')}日 ${String(state.hour).padStart(2, '0')}:${String(state.minute).padStart(2, '0')}`;
      }
      if (btnConfirm) btnConfirm.textContent = '确定用神并揭盘';
    } else {
      if (banner) banner.style.display = 'none';
      if (btnConfirm) btnConfirm.textContent = '确定';
    }

    openModal('modalYongShen');
  }

  // 暴露给起盘控制器
  openYSModalHandler = openYSModal;

  if (btnSelectYongShen) {
    btnSelectYongShen.addEventListener('click', () => openYSModal(false));
  }
  if (boardCenter) {
    boardCenter.addEventListener('click', () => openYSModal(false));
  }

  // 遮罩层上的按钮绑定
  const btnOverlayPick = document.getElementById('btnOverlayPickYongShen');
  if (btnOverlayPick) {
    btnOverlayPick.addEventListener('click', () => openYSModal(true));
  }
  const btnOverlayReveal = document.getElementById('btnOverlayDirectReveal');
  if (btnOverlayReveal) {
    btnOverlayReveal.addEventListener('click', () => revealPanNow());
  }

  // 断事笔记输入监听与实时同步
  if (txtUserRemark) {
    txtUserRemark.addEventListener('input', () => {
      state.caseRemark = txtUserRemark.value.trim();
      const txtCase = document.getElementById('txtCaseRemark');
      if (txtCase) txtCase.value = state.caseRemark;
      try { localStorage.setItem('qimen_case_remark', state.caseRemark); } catch (e) {}
      scheduleRecordAutosave();
    });
  }

  if (btnClearUserRemark) {
    btnClearUserRemark.addEventListener('click', () => {
      if (txtUserRemark && txtUserRemark.value.trim() && !window.confirm('确定清空这条断事笔记吗？')) return;
      if (txtUserRemark) txtUserRemark.value = '';
      setTimeout(scheduleRecordAutosave, 0);
      state.caseRemark = '';
      const txtCase = document.getElementById('txtCaseRemark');
      if (txtCase) txtCase.value = '';
      try {
        localStorage.removeItem('qimen_case_remark');
      } catch (e) {}
    });
  }

  // 问题输入框监听
  if (iptQuestion) {
    iptQuestion.addEventListener('input', () => {
      state.userQuestion = iptQuestion.value.trim();
      try { localStorage.setItem('qimen_user_question', state.userQuestion); } catch (e) {}
      scheduleRecordAutosave();
    });
  }

  // Checkbox 选择联动
  document.querySelectorAll('#modalYongShen .ys-chips-row input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const chip = cb.closest('.ys-chip');
      if (chip) chip.classList.toggle('active', cb.checked);
      const val = cb.value;
      if (cb.checked) {
        const nat = state.selectedYongShenNatures[val] || getYongShenNature(val);
        selectedYongShenMap.set(val, { name: val, nature: nat, role: '' });
      } else {
        selectedYongShenMap.delete(val);
      }
      renderSelectedTags();
      if (typeof updateStandardTabsBadge === 'function') updateStandardTabsBadge();
    });
  });

  // 清空问题
  if (btnClearQ) {
    btnClearQ.addEventListener('click', () => {
      if (iptQuestion) iptQuestion.value = '';
      state.userQuestion = '';
      try {
        localStorage.removeItem('qimen_user_question');
      } catch (e) {}
      scheduleRecordAutosave();
    });
  }

  // 清空用神选择
  function clearAllSelections(keepZhifu = true) {
    selectedYongShenMap.clear();
    document.querySelectorAll('#modalYongShen .ys-chips-row input[type="checkbox"]').forEach(cb => {
      if (keepZhifu && (cb.value === '值符' || cb.value === '直符')) {
        cb.checked = true;
        const chip = cb.closest('.ys-chip');
        if (chip) chip.classList.add('active');
        selectedYongShenMap.set(cb.value, { name: cb.value, nature: 'matter', role: '大局核心' });
      } else {
        cb.checked = false;
        const chip = cb.closest('.ys-chip');
        if (chip) chip.classList.remove('active');
      }
    });
    hidePresetPrompt();
    renderSelectedTags();
    if (typeof updateStandardTabsBadge === 'function') updateStandardTabsBadge();
  }

  if (btnClearAllYS) btnClearAllYS.addEventListener('click', () => clearAllSelections(true));
  if (btnResetYS) btnResetYS.addEventListener('click', () => {
    clearAllSelections(true);
    if (iptQuestion) iptQuestion.value = '';
    state.userQuestion = '';
    try {
      localStorage.removeItem('qimen_user_question');
    } catch (e) {}
    scheduleRecordAutosave();
  });

// 首次选取用神后自动触发动态演盘
function triggerAutoAnimOnFirstYongShen() {
  if (!state.autoAnimOnYongshen) return;
  if (state.hasAnimatedOnFirstYS) return;
  if (!state.selectedYongShen || state.selectedYongShen.length === 0) return;
  state.hasAnimatedOnFirstYS = true;

  setTimeout(() => {
    startBoardAnimation();
  }, 350);
}

  // 确认并应用用神
  if (btnConfirmYS) {
    btnConfirmYS.addEventListener('click', () => {
      state.userQuestion = iptQuestion ? iptQuestion.value.trim() : '';
      if (txtUserRemark) {
        state.caseRemark = txtUserRemark.value.trim();
      }
      state.selectedYongShen = Array.from(selectedYongShenMap.keys());

      // 同步保存各用神的 nature 字典
      selectedYongShenMap.forEach((it, name) => {
        state.selectedYongShenNatures[name] = it.nature;
      });

      try {
        localStorage.setItem('qimen_user_question', state.userQuestion);
        localStorage.setItem('qimen_case_remark', state.caseRemark);
        localStorage.setItem('qimen_selected_yongshen', JSON.stringify(state.selectedYongShen));
        localStorage.setItem('qimen_selected_yongshen_natures', JSON.stringify(state.selectedYongShenNatures));
        localStorage.setItem('qimen_zhifu_manually_cleared', state.selectedYongShen.includes('值符') ? '0' : '1');
      } catch (e) {
        console.warn('localStorage error', e);
      }
      closeModal('modalYongShen');

      // 若处于立即起盘防剧透状态，确认后立即揭晓盘面
      if (state.isPendingReveal) {
        revealPanNow();
        triggerAutoAnimOnFirstYongShen();
        return;
      }

      // 已揭盘的起局记录：同步写回
      if (state.activeRecordId) {
        flushRecordAutosave();
        updateRecord(state.activeRecordId, r => {
          r.selectedYongShen = [...state.selectedYongShen];
          r.yongshenNatures = { ...state.selectedYongShenNatures };
        });
        refreshCaseList(state.activeRecordId);
      }

      updateBoardCardCenter(state.currentPan);
      if (state.currentPan) {
        state.currentPan.selectedYongShen = state.selectedYongShen;
        state.currentPan.yongshenNatures = { ...state.selectedYongShenNatures };
        state.currentPan.userQuestion = state.userQuestion;
        state.currentPan.remark = state.caseRemark;
        renderNinePalaces(state.currentPan);
        renderKeyingAnalysis(state.currentPan, state.selectedGong);
      }
      if (state.selectedYongShen.length > 0) {
        showToast(`已应用用神：【${state.selectedYongShen.join('、')}】，已在天盘虚框标注（值符黄色，其他红色）`);
      } else {
        showToast('已更新所问事项，未选用神');
      }
      triggerAutoAnimOnFirstYongShen();
    });
  }

  // 盘面手动选按钮交互
  const btnStartManualGridPick = document.getElementById('btnStartManualGridPick');
  if (btnStartManualGridPick) {
    btnStartManualGridPick.addEventListener('click', () => {
      state.userQuestion = iptQuestion ? iptQuestion.value.trim() : '';
      state.selectedYongShen = getSelectedYongShenFromUI();
      const checkedRad = document.querySelector('#modalYongShen input[name="radKongOpposite"]:checked');
      if (checkedRad) {
        state.yongshenNature = checkedRad.value;
      }
      try {
        localStorage.setItem('qimen_user_question', state.userQuestion);
        localStorage.setItem('qimen_selected_yongshen', JSON.stringify(state.selectedYongShen));
        localStorage.setItem('qimen_zhifu_manually_cleared', state.selectedYongShen.includes('值符') ? '0' : '1');
        localStorage.setItem('qimen_yongshen_nature', state.yongshenNature);
      } catch (e) {
        console.warn('localStorage error', e);
      }
      closeModal('modalYongShen');
      enterGridPickingMode();
    });
  }

  // 初始化浮动圈选操作条与要素选择弹窗事件
  initGridPickingBar(openYSModal);
}

// ========================================================
// 盘面手动圈选用神模式交互控制器 (Manual Grid Picking Mode)
// ========================================================

let currentPickerGong = null;

// 从点击的目标元素提取所圈选的用神符号
function extractSymbolFromTarget(target, gong) {
  if (!target || !state.currentPan) return null;
  const pan = state.currentPan;

  // 1. 天禽星专属 (嵌套在天芮星内)
  if (target.closest('.star-qin')) {
    return '天禽';
  }

  // 2. 九星
  const starEl = target.closest('.star-name');
  if (starEl) {
    const rawStar = pan.tianpanStar[gong] || '';
    if (rawStar.includes('天芮')) {
      return '天芮';
    }
    const starList = ['天蓬', '天任', '天冲', '天辅', '天禽', '天心', '天柱', '天英', '天芮'];
    for (const s of starList) {
      if (rawStar.includes(s) || starEl.textContent.includes(s)) return s;
    }
    return rawStar || starEl.textContent.trim().slice(0, 2);
  }

  // 3. 八神
  const spiritEl = target.closest('.spirit-tag');
  if (spiritEl) {
    const spirit = pan.tianpanSpirit[gong] || spiritEl.textContent.trim();
    if (spirit === '滕蛇') return '螣蛇';
    return spirit;
  }

  // 4. 八门
  const doorEl = target.closest('.door-name');
  if (doorEl) {
    const rawDoor = pan.tianpanDoor[gong] || doorEl.textContent.trim();
    const doorList = ['休门', '生门', '伤门', '杜门', '景门', '死门', '惊门', '开门'];
    for (const d of doorList) {
      if (rawDoor.includes(d) || rawDoor.includes(d.replace('门', ''))) return d;
    }
    return rawDoor;
  }

  // 5. 天盘干与天盘寄干
  const tgEl = target.closest('.tian-gan');
  if (tgEl) {
    const tg = pan.tianpanGan[gong] || tgEl.textContent.trim();
    return tg;
  }
  const tjEl = target.closest('.tian-jigan-stem');
  if (tjEl) {
    const tj = pan.tianpanJigan[gong] || tjEl.textContent.trim();
    return tj;
  }

  // 6. 地盘干与地盘寄干
  const dgEl = target.closest('.di-gan');
  if (dgEl) {
    const dg = pan.dipan[gong] || dgEl.textContent.trim();
    return dg;
  }
  const djEl = target.closest('.di-jigan-stem');
  if (djEl) {
    return (gong === 2 && pan.dipan[5]) ? pan.dipan[5] : djEl.textContent.trim();
  }

  // 7. 空亡与马星
  if (target.closest('.badge-kong')) {
    const gongName = GONG_CN[gong] ? `${GONG_CN[gong]}宫` : `${gong}宫`;
    return `空亡•${gongName}`;
  }
  if (target.closest('.badge-ma')) {
    return '马星';
  }

  return null;
}

// 盘面圈选点击事件分发
function handleGridPickClick(e, gong) {
  // 排宫法(转盘)中五宫寄坤二，无独立神门星，中宫文字不参与用神选取
  if (gong === 5 && state.currentPan && state.currentPan.paipanMethod === 'zhuan') {
    return;
  }
  const symbol = extractSymbolFromTarget(e.target, gong);
  if (symbol) {
    toggleYongShenSymbol(symbol);
  } else {
    // 点击空白处打开本宫要素快捷选择弹窗
    openPalaceElementPicker(gong);
  }
}

// 切换某个用神符号的选中状态
function toggleYongShenSymbol(val) {
  if (!val) return;
  if (!Array.isArray(state.selectedYongShen)) {
    state.selectedYongShen = [];
  }

  // 若点击的是分宫空亡 (如 空亡•艮宫)，清理列表中的通用 '空亡'/'旬空'，避免两宫继续同时全选
  if (val.startsWith('空亡•') || val.startsWith('旬空•') || val.startsWith('旬空亡•')) {
    const gKongIdx = state.selectedYongShen.indexOf('空亡');
    if (gKongIdx >= 0) state.selectedYongShen.splice(gKongIdx, 1);
    const gXunIdx = state.selectedYongShen.indexOf('旬空');
    if (gXunIdx >= 0) state.selectedYongShen.splice(gXunIdx, 1);
  }

  const idx = state.selectedYongShen.indexOf(val);
  let isAdd = false;
  if (idx >= 0) {
    state.selectedYongShen.splice(idx, 1);
    isAdd = false;
  } else {
    state.selectedYongShen.push(val);
    isAdd = true;
  }

  // 保存并即时全盘刷新
  try {
    localStorage.setItem('qimen_selected_yongshen', JSON.stringify(state.selectedYongShen));
    localStorage.setItem('qimen_zhifu_manually_cleared', state.selectedYongShen.includes('值符') ? '0' : '1');
  } catch (err) {
    console.warn('localStorage error', err);
  }

  if (state.currentPan) {
    state.currentPan.selectedYongShen = state.selectedYongShen;
    renderNinePalaces(state.currentPan);
    renderKeyingAnalysis(state.currentPan, state.selectedGong);
  }

  updateBoardCardCenter(state.currentPan);
  updateGridPickBarUI();

  // 若弹窗打开着，同步更新弹窗 chips
  if (currentPickerGong) {
    renderPalacePickerBody(currentPickerGong);
  }

  showToast(isAdd ? `已圈选用神：【${val}】` : `已取消用神：【${val}】`);
}

// 更新浮动操作条 UI
function updateGridPickBarUI() {
  const bar = document.getElementById('gridPickBar');
  const tagsRow = document.getElementById('gridPickTagsRow');
  if (!bar || !tagsRow) return;

  const list = Array.isArray(state.selectedYongShen) ? state.selectedYongShen : [];
  if (list.length === 0) {
    tagsRow.innerHTML = '<span class="grid-pick-empty-hint">尚未圈选用神，请在上方九宫格中直接点击符号</span>';
    return;
  }

  tagsRow.innerHTML = list.map(item => {
    const isZhifu = (item === '值符' || item === '直符');
    return `
      <span class="grid-pick-chip ${isZhifu ? 'ys-chip-zhifu' : ''}">
        <span>${escapeHtml(item)}</span>
        <span class="pick-remove" data-remove="${escapeHtml(item)}" title="取消此用神">✕</span>
      </span>
    `;
  }).join('');

  tagsRow.querySelectorAll('.pick-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = btn.dataset.remove;
      if (val) toggleYongShenSymbol(val);
    });
  });
}

// 进入盘面圈选用神模式
function enterGridPickingMode() {
  if (blockIfPending('盘面圈选用神')) return;
  state.isGridPickingMode = true;
  const grid = document.getElementById('nineGrid');
  if (grid) grid.classList.add('grid-picking-mode');
  document.body.classList.add('grid-picking-active');

  const bar = document.getElementById('gridPickBar');
  if (bar) bar.style.display = 'block';

  updateGridPickBarUI();
  if (state.currentPan) renderNinePalaces(state.currentPan);

  const boardSection = document.getElementById('boardCardSection') || grid;
  if (boardSection) {
    boardSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  showToast('已进入盘面圈选用神模式：直接点击九宫格内的八神、九星、八门、天干即可圈选');
}

// 退出盘面圈选用神模式
function exitGridPickingMode(save = true) {
  state.isGridPickingMode = false;
  const grid = document.getElementById('nineGrid');
  if (grid) grid.classList.remove('grid-picking-mode');
  document.body.classList.remove('grid-picking-active');

  const bar = document.getElementById('gridPickBar');
  if (bar) bar.style.display = 'none';

  closePalaceElementPicker();

  if (save) {
    try {
      localStorage.setItem('qimen_selected_yongshen', JSON.stringify(state.selectedYongShen));
      localStorage.setItem('qimen_zhifu_manually_cleared', state.selectedYongShen.includes('值符') ? '0' : '1');
    } catch (e) {}
    if (state.currentPan) {
      state.currentPan.selectedYongShen = state.selectedYongShen;
      renderNinePalaces(state.currentPan);
      renderKeyingAnalysis(state.currentPan, state.selectedGong);
    }
    updateBoardCardCenter(state.currentPan);
    if (state.selectedYongShen.length > 0) {
      showToast(`已完成用神圈选：【${state.selectedYongShen.join('、')}】`);
      triggerAutoAnimOnFirstYongShen();
    } else {
      showToast('已退出圈选模式，未圈选用神');
    }
  } else {
    if (state.currentPan) renderNinePalaces(state.currentPan);
  }
}

// 渲染宫位要素快捷选择弹窗内容 (双栏卡片式精致排版)
function renderPalacePickerBody(gong) {
  if (!gong || !state.currentPan) return;
  const body = document.getElementById('palacePickerBody');
  const summaryEl = document.getElementById('palacePickerSummary');
  if (!body) return;
  const pan = state.currentPan;
  const list = Array.isArray(state.selectedYongShen) ? state.selectedYongShen : [];

  const spirit = pan.tianpanSpirit[gong] || '';
  const star = pan.tianpanStar[gong] || '';
  const door = pan.tianpanDoor[gong] || '';
  const tg = pan.tianpanGan[gong] || '';
  const tj = pan.tianpanJigan[gong] || '';
  const dg = pan.dipan[gong] || '';
  const dj = (gong === 2 && pan.dipan[5]) ? pan.dipan[5] : '';
  const hasMa = !!(pan.palaceFlags[gong] && pan.palaceFlags[gong].hasMa);
  const isKong = !!(pan.palaceFlags[gong] && pan.palaceFlags[gong].isKong);
  const gongName = `${GONG_CN[gong]}宫`;

  function renderChip(val, note = '', isZhifuDefault = false) {
    const active = list.includes(val) || (
      val.startsWith('空亡•') && (
        list.includes('空亡') ||
        list.includes('旬空') ||
        list.includes(val.replace('空亡•', '旬空•')) ||
        list.includes(val.replace('空亡•', '旬空亡•'))
      )
    );
    const isZhifu = isZhifuDefault || val === '值符' || val === '直符';
    return `
      <button type="button" class="palace-picker-chip ${active ? 'active' : ''} ${isZhifu ? 'is-zhifu' : ''}" data-val="${escapeHtml(val)}">
        <span>${escapeHtml(val)}${note ? ` <small class="chip-note">(${escapeHtml(note)})</small>` : ''}</span>
        ${active ? '<span class="chip-check">✓</span>' : ''}
      </button>
    `;
  }

  // 1. 左栏: 神机 · 星门
  let leftRowsHtml = '';
  if (gong === 5) {
    leftRowsHtml = `
      <div class="palace-picker-row">
        <span class="palace-picker-row-label">核心</span>
        <div class="palace-picker-row-chips">
          ${renderChip(pan.dipan[5] || '戊')}
        </div>
      </div>
      <div class="palace-picker-row">
        <span class="palace-picker-row-label">局态</span>
        <div style="font-size: 12px; color: var(--md-sys-color-outline); padding: 4px 0;">转盘中五无神门星，寄坤二宫</div>
      </div>
    `;
  } else {
    // 八神
    if (spirit) {
      leftRowsHtml += `
        <div class="palace-picker-row">
          <span class="palace-picker-row-label">八神</span>
          <div class="palace-picker-row-chips">
            ${renderChip(spirit, '', spirit === '值符')}
          </div>
        </div>
      `;
    }

    // 九星
    if (star) {
      let starChips = '';
      if (star.includes('天芮')) {
        starChips = renderChip('天芮') + renderChip('天禽');
      } else {
        starChips = renderChip(star);
      }
      leftRowsHtml += `
        <div class="palace-picker-row">
          <span class="palace-picker-row-label">九星</span>
          <div class="palace-picker-row-chips">
            ${starChips}
          </div>
        </div>
      `;
    }

    // 八门
    if (door) {
      leftRowsHtml += `
        <div class="palace-picker-row">
          <span class="palace-picker-row-label">八门</span>
          <div class="palace-picker-row-chips">
            ${renderChip(door)}
          </div>
        </div>
      `;
    }
  }

  // 2. 右栏: 奇仪 · 标志 · 宫位
  let rightRowsHtml = '';

  // 天盘干
  if (tg || tj) {
    let tgChips = '';
    if (tg) {
      let note = '';
      if (tg === pan.dayGan) note = '日干';
      else if (tg === pan.shiGan) note = '时干';
      tgChips += renderChip(tg, note);
    }
    if (tj) {
      let note = '天寄';
      if (tj === pan.dayGan) note = '日寄';
      else if (tj === pan.shiGan) note = '时寄';
      tgChips += renderChip(tj, note);
    }
    rightRowsHtml += `
      <div class="palace-picker-row">
        <span class="palace-picker-row-label">天盘</span>
        <div class="palace-picker-row-chips">
          ${tgChips}
        </div>
      </div>
    `;
  }

  // 地盘干
  if (dg || dj) {
    let dgChips = '';
    if (dg) dgChips += renderChip(dg);
    if (dj) dgChips += renderChip(dj, '地寄');
    rightRowsHtml += `
      <div class="palace-picker-row">
        <span class="palace-picker-row-label">地盘</span>
        <div class="palace-picker-row-chips">
          ${dgChips}
        </div>
      </div>
    `;
  }

  // 标志 (空亡 / 马星)
  if (isKong || hasMa) {
    let flagChips = '';
    if (isKong) flagChips += renderChip(`空亡•${gongName}`);
    if (hasMa) flagChips += renderChip('马星');
    rightRowsHtml += `
      <div class="palace-picker-row">
        <span class="palace-picker-row-label">标志</span>
        <div class="palace-picker-row-chips">
          ${flagChips}
        </div>
      </div>
    `;
  }

  // 宫位
  rightRowsHtml += `
    <div class="palace-picker-row">
      <span class="palace-picker-row-label">宫位</span>
      <div class="palace-picker-row-chips">
        ${renderChip(gongName)}
      </div>
    </div>
  `;

  body.innerHTML = `
    <div class="palace-picker-grid">
      <div class="palace-picker-card">
        <div class="palace-picker-card-header">
          <span class="palace-picker-section-title">神机 · 星门</span>
        </div>
        <div class="palace-picker-card-content">
          ${leftRowsHtml}
        </div>
      </div>

      <div class="palace-picker-card">
        <div class="palace-picker-card-header">
          <span class="palace-picker-section-title">奇仪 · 标志 · 宫位</span>
        </div>
        <div class="palace-picker-card-content">
          ${rightRowsHtml}
        </div>
      </div>
    </div>
  `;

  // 更新底部已选摘要
  if (summaryEl) {
    const palaceAllVals = [spirit, star, '天芮', '天禽', door, tg, tj, dg, dj, gongName, isKong ? '空亡' : null, hasMa ? '马星' : null].filter(Boolean);
    const matchedInPalace = list.filter(ys => palaceAllVals.includes(ys));
    if (matchedInPalace.length > 0) {
      summaryEl.innerHTML = `本宫已选：<b style="color: var(--md-sys-color-primary);">${escapeHtml(matchedInPalace.join('、'))}</b>`;
    } else {
      summaryEl.textContent = '本宫尚未圈选用神（点击上方要素即可选中）';
    }
  }

  // 绑定 chip 点击事件
  body.querySelectorAll('.palace-picker-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.val;
      if (val) toggleYongShenSymbol(val);
    });
  });
}

function openPalaceElementPicker(gong) {
  if (blockIfPending('宫位要素选取')) return;
  if (gong === 5 && state.currentPan && state.currentPan.paipanMethod === 'zhuan') {
    return;
  }
  currentPickerGong = gong;
  const title = document.getElementById('palacePickerTitle');
  if (title) title.textContent = `【${GONG_CN[gong]}宫 (${gong}宫)】要素点选`;
  renderPalacePickerBody(gong);
  openModal('modalPalacePickElements');
}

function closePalaceElementPicker() {
  closeModal('modalPalacePickElements');
  currentPickerGong = null;
}

// 初始化浮动圈选操作条与要素选择弹窗事件
function initGridPickingBar(openYSModalFn) {
  const btnFinish = document.getElementById('btnFinishGridPick');
  const btnReset = document.getElementById('btnResetGridPick');
  const btnBack = document.getElementById('btnBackToModalYS');
  const btnClose = document.getElementById('btnCloseGridPick');

  if (btnFinish) {
    btnFinish.addEventListener('click', () => exitGridPickingMode(true));
  }
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      state.selectedYongShen = [];
      try {
        localStorage.setItem('qimen_selected_yongshen', JSON.stringify([]));
        localStorage.setItem('qimen_zhifu_manually_cleared', '1');
      } catch (e) {}
      if (state.currentPan) {
        state.currentPan.selectedYongShen = [];
        renderNinePalaces(state.currentPan);
        renderKeyingAnalysis(state.currentPan, state.selectedGong);
      }
      updateBoardCardCenter(state.currentPan);
      updateGridPickBarUI();
      if (currentPickerGong) renderPalacePickerBody(currentPickerGong);
      showToast('已清空所有已选用神');
    });
  }
  if (btnBack) {
    btnBack.addEventListener('click', () => {
      exitGridPickingMode(false);
      if (typeof openYSModalFn === 'function') {
        openYSModalFn();
      }
    });
  }
  if (btnClose) {
    btnClose.addEventListener('click', () => exitGridPickingMode(true));
  }

  const btnConfirmPP = document.getElementById('btnConfirmPalacePicker');
  const btnClosePP = document.getElementById('btnClosePalacePicker');
  if (btnConfirmPP) btnConfirmPP.addEventListener('click', closePalaceElementPicker);
  if (btnClosePP) btnClosePP.addEventListener('click', closePalaceElementPicker);

  const modalPP = document.getElementById('modalPalacePickElements');
  if (modalPP) {
    modalPP.addEventListener('click', (e) => {
      if (e.target === modalPP) closePalaceElementPicker();
    });
  }
}

// 初始化手动录入奇门盘面模块
function initManualInputModal() {
  const btnBottomManual = document.getElementById('btnBottomManual');
  const selDun = document.getElementById('selManualDun');
  const selJuNum = document.getElementById('selManualJuNum');
  const selPaipanMethod = document.getElementById('selManualPaipanMethod');
  const selDingjuMethod = document.getElementById('selManualDingjuMethod');
  const selGzYear = document.getElementById('selManualGzYear');
  const selGzMonth = document.getElementById('selManualGzMonth');
  const selGzDay = document.getElementById('selManualGzDay');
  const selGzHour = document.getElementById('selManualGzHour');
  const iptGzQuick = document.getElementById('iptManualGzQuick');
  const txtGzQuickStatus = document.getElementById('txtManualGzQuickStatus');
  const previewSummary = document.getElementById('manualPreviewSummary');
  const previewDetail = document.getElementById('manualPreviewDetail');
  const btnConfirm = document.getElementById('btnConfirmManualInput');
  const txtPaste = document.getElementById('txtManualPasteInput');
  const btnParse = document.getElementById('btnParseManualText');
  const txtParseStatus = document.getElementById('txtManualParseStatus');
  const segMode = document.getElementById('segManualMode');
  const panelGanzhi = document.getElementById('manualModeGanzhi');
  const panelText = document.getElementById('manualModeText');

  // 1. 填充 60 甲子下拉框
  [selGzYear, selGzMonth, selGzDay, selGzHour].forEach(sel => {
    if (!sel) return;
    sel.innerHTML = '';
    JIAZI.forEach(gz => {
      sel.add(new Option(gz, gz));
    });
  });

  // 2. Tab 切换
  if (segMode) {
    const btns = segMode.querySelectorAll('.m3-segment-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.dataset.mode;
        if (panelGanzhi) panelGanzhi.style.display = mode === 'ganzhi' ? 'block' : 'none';
        if (panelText) panelText.style.display = mode === 'text' ? 'block' : 'none';
      });
    });
  }

  // 3. 实时更新预览
  function updateManualPreview() {
    if (!selDun || !selJuNum || !selGzYear || !selGzMonth || !selGzDay || !selGzHour) return;
    const dun = selDun.value;
    const juNum = selJuNum.value;
    const juNumCn = ['一', '二', '三', '四', '五', '六', '七', '八', '九'][parseInt(juNum) - 1] || juNum;
    const yGz = selGzYear.value;
    const mGz = selGzMonth.value;
    const dGz = selGzDay.value;
    const hGz = selGzHour.value;
    const djName = selDingjuMethod ? (selDingjuMethod.options[selDingjuMethod.selectedIndex]?.text || '') : '';

    const xun = xunOf(hGz);
    const shouYi = XUN_SHOU_YI[xun] || '戊';
    const dayKw = kongwangOf(dGz);
    const hourKw = kongwangOf(hGz);

    if (previewSummary) {
      previewSummary.textContent = `${dun}遁${juNumCn}局${djName ? ' · ' + djName : ''} · ${yGz}年 ${mGz}月 ${dGz}日 ${hGz}时`;
    }
    if (previewDetail) {
      previewDetail.textContent = `旬首：${xun}${shouYi} ｜ 日空：${dayKw} ｜ 时空：${hourKw} ｜ 核心：以${dGz[0]}为求测人，${hGz[0]}为事态`;
    }
  }

  [selDun, selJuNum, selPaipanMethod, selDingjuMethod, selGzYear, selGzMonth, selGzDay, selGzHour].forEach(el => {
    if (el) el.addEventListener('change', updateManualPreview);
  });

  // 4. 手动输入四柱干支或公历时间即时识别联动
  function handleManualGzQuickInput(val) {
    if (!val || !val.trim()) {
      if (txtGzQuickStatus) txtGzQuickStatus.textContent = '';
      return;
    }
    const res = parseGanzhiOrDateTimeInput(val);
    if (!res) {
      if (txtGzQuickStatus) {
        txtGzQuickStatus.textContent = '未检测到有效甲子干支或公历时间';
        txtGzQuickStatus.style.color = 'var(--md-sys-color-error)';
      }
      return;
    }

    if (res.dingjuMethod && selDingjuMethod) selDingjuMethod.value = res.dingjuMethod;
    if (res.paipanMethod && selPaipanMethod) selPaipanMethod.value = res.paipanMethod;
    if (res.dun && selDun) selDun.value = res.dun;
    if (res.ju && selJuNum) selJuNum.value = String(res.ju);

    if (res.type === 'datetime') {
      const dt = res.dt;
      try {
        const curDingjuMethod = selDingjuMethod ? selDingjuMethod.value : (state.dingjuMethod || 'zhirun');
        const curPaipanMethod = selPaipanMethod ? selPaipanMethod.value : (state.paipanMethod || 'zhuan');
        const calcPan = paipan({
          year: dt.year,
          month: dt.month,
          day: dt.day,
          hour: dt.hour,
          minute: dt.minute,
          dingjuMethod: curDingjuMethod,
          paipanMethod: curPaipanMethod,
          longitude: state.longitude || 116.38
        });

        if (calcPan && calcPan.pillars) {
          if (selGzYear) selGzYear.value = calcPan.pillars.year;
          if (selGzMonth) selGzMonth.value = calcPan.pillars.month;
          if (selGzDay) selGzDay.value = calcPan.pillars.day;
          if (selGzHour) selGzHour.value = calcPan.pillars.hour;

          if (!res.dun && selDun && calcPan.dun) selDun.value = calcPan.dun;
          if (!res.ju && selJuNum && calcPan.ju) selJuNum.value = String(calcPan.ju);

          updateManualPreview();

          if (txtGzQuickStatus) {
            const minStr = String(dt.minute).padStart(2, '0');
            txtGzQuickStatus.textContent = `已识别时间 [${dt.year}-${dt.month}-${dt.day} ${dt.hour}:${minStr}] 转化为四柱：${calcPan.pillars.year} ${calcPan.pillars.month} ${calcPan.pillars.day} ${calcPan.pillars.hour}`;
            txtGzQuickStatus.style.color = 'var(--md-sys-color-primary)';
          }
          return;
        }
      } catch (err) {
        console.warn('时间转化四柱失败:', err);
      }
    } else if (res.type === 'ganzhi') {
      let matchedCount = 0;
      if (res.pillars.year && selGzYear && JIAZI.includes(res.pillars.year)) { selGzYear.value = res.pillars.year; matchedCount++; }
      if (res.pillars.month && selGzMonth && JIAZI.includes(res.pillars.month)) { selGzMonth.value = res.pillars.month; matchedCount++; }
      if (res.pillars.day && selGzDay && JIAZI.includes(res.pillars.day)) { selGzDay.value = res.pillars.day; matchedCount++; }
      if (res.pillars.hour && selGzHour && JIAZI.includes(res.pillars.hour)) { selGzHour.value = res.pillars.hour; matchedCount++; }

      updateManualPreview();

      if (txtGzQuickStatus) {
        if (matchedCount >= 4) {
          txtGzQuickStatus.textContent = `已成功识别四柱：${selGzYear.value} ${selGzMonth.value} ${selGzDay.value} ${selGzHour.value}`;
          txtGzQuickStatus.style.color = 'var(--md-sys-color-primary)';
        } else if (matchedCount > 0) {
          txtGzQuickStatus.textContent = `已识别 ${matchedCount}/4 柱...`;
          txtGzQuickStatus.style.color = 'var(--md-sys-color-tertiary, #b06000)';
        } else {
          txtGzQuickStatus.textContent = '未检测到有效甲子干支或公历时间';
          txtGzQuickStatus.style.color = 'var(--md-sys-color-error)';
        }
      }
    }
  }

  if (iptGzQuick) {
    iptGzQuick.addEventListener('input', e => handleManualGzQuickInput(e.target.value));
    iptGzQuick.addEventListener('change', e => handleManualGzQuickInput(e.target.value));
  }

  // 5. 文本粘贴智能识别 (模式 2)
  function parsePastedText(text) {
    if (!text || !text.trim()) return false;
    let foundJu = null;
    let foundDun = null;

    // 匹配局象: e.g. 阴五局 / 阳遁一局 / 阴5局 / 阳遁三局
    const numMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
    const juMatch = text.match(/(阳|阴)[遁]?([一二三四五六七八九1-9])局?/);
    if (juMatch) {
      foundDun = juMatch[1];
      const rawNum = juMatch[2];
      foundJu = numMap[rawNum] || parseInt(rawNum) || 5;
    }

    if (text.includes('拆补') && selDingjuMethod) selDingjuMethod.value = 'chaibu';
    else if (text.includes('置闰') && selDingjuMethod) selDingjuMethod.value = 'zhirun';
    else if (text.includes('茅山') && selDingjuMethod) selDingjuMethod.value = 'maoshan';

    // 匹配干支 (在文本中提取所有合法的六十甲子干支)
    const gzMatches = [];
    const gzRegex = /([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])/g;
    let m;
    while ((m = gzRegex.exec(text)) !== null) {
      if (JIAZI.includes(m[1]) && !gzMatches.includes(m[1])) {
        gzMatches.push(m[1]);
      }
    }

    let parsedPillars = {};
    const yMatch = text.match(/(?:年柱?[:：\s]*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])|([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])\s*年)/);
    if (yMatch) parsedPillars.year = yMatch[1] || yMatch[2];
    const mMatch = text.match(/(?:月柱?[:：\s]*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])|([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])\s*月)/);
    if (mMatch) parsedPillars.month = mMatch[1] || mMatch[2];
    const dMatch = text.match(/(?:日柱?[:：\s]*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])|([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])\s*日)/);
    if (dMatch) parsedPillars.day = dMatch[1] || dMatch[2];
    const hMatch = text.match(/(?:时柱?[:：\s]*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])|([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])\s*时)/);
    if (hMatch) parsedPillars.hour = hMatch[1] || hMatch[2];

    const fourGzMatch = text.match(/干支[:：\s]*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])[\s,，]+([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])[\s,，]+([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])[\s,，]+([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])/);
    if (fourGzMatch && (!parsedPillars.year || !parsedPillars.month || !parsedPillars.day || !parsedPillars.hour)) {
      if (!parsedPillars.year) parsedPillars.year = fourGzMatch[1];
      if (!parsedPillars.month) parsedPillars.month = fourGzMatch[2];
      if (!parsedPillars.day) parsedPillars.day = fourGzMatch[3];
      if (!parsedPillars.hour) parsedPillars.hour = fourGzMatch[4];
    }

    if (!parsedPillars.year && !parsedPillars.month && gzMatches.length >= 4) {
      parsedPillars.year = gzMatches[0];
      parsedPillars.month = gzMatches[1];
      parsedPillars.day = gzMatches[2];
      parsedPillars.hour = gzMatches[3];
    } else if (gzMatches.length === 2 && !parsedPillars.day && !parsedPillars.hour) {
      parsedPillars.day = gzMatches[0];
      parsedPillars.hour = gzMatches[1];
    }

    // 若文本中未包含完整四柱，但包含公历时间，则利用时间推算自动补充四柱干支
    if (!parsedPillars.year || !parsedPillars.month || !parsedPillars.day || !parsedPillars.hour) {
      const dt = parseDateTimeFromText(text);
      if (dt) {
        try {
          const curDingju = selDingjuMethod ? selDingjuMethod.value : (state.dingjuMethod || 'zhirun');
          const curPaipan = selPaipanMethod ? selPaipanMethod.value : (state.paipanMethod || 'zhuan');
          const calcPan = paipan({
            year: dt.year,
            month: dt.month,
            day: dt.day,
            hour: dt.hour,
            minute: dt.minute,
            dingjuMethod: curDingju,
            paipanMethod: curPaipan,
            longitude: state.longitude || 116.38
          });
          if (calcPan && calcPan.pillars) {
            if (!parsedPillars.year) parsedPillars.year = calcPan.pillars.year;
            if (!parsedPillars.month) parsedPillars.month = calcPan.pillars.month;
            if (!parsedPillars.day) parsedPillars.day = calcPan.pillars.day;
            if (!parsedPillars.hour) parsedPillars.hour = calcPan.pillars.hour;
            if (!foundDun && calcPan.dun) foundDun = calcPan.dun;
            if (!foundJu && calcPan.ju) foundJu = calcPan.ju;
          }
        } catch (e) {
          console.warn('粘贴文本时间转化四柱失败:', e);
        }
      }
    }

    let hasUpdate = false;
    if (foundDun && selDun) { selDun.value = foundDun; hasUpdate = true; }
    if (foundJu && selJuNum) { selJuNum.value = String(foundJu); hasUpdate = true; }
    if (parsedPillars.year && selGzYear) { selGzYear.value = parsedPillars.year; hasUpdate = true; }
    if (parsedPillars.month && selGzMonth) { selGzMonth.value = parsedPillars.month; hasUpdate = true; }
    if (parsedPillars.day && selGzDay) { selGzDay.value = parsedPillars.day; hasUpdate = true; }
    if (parsedPillars.hour && selGzHour) { selGzHour.value = parsedPillars.hour; hasUpdate = true; }

    updateManualPreview();
    return hasUpdate;
  }

  if (btnParse) {
    btnParse.addEventListener('click', () => {
      const val = txtPaste ? txtPaste.value : '';
      const ok = parsePastedText(val);
      if (ok) {
        if (txtParseStatus) {
          txtParseStatus.textContent = '已成功识别四柱与局数，请核对下方预览';
          txtParseStatus.style.color = 'var(--md-sys-color-primary)';
        }
      } else {
        if (txtParseStatus) {
          txtParseStatus.textContent = '未能识别出完整四柱或局数，请检查文本格式';
          txtParseStatus.style.color = 'var(--md-sys-color-error)';
        }
      }
    });
  }

  // 6. 打开弹窗时，用当前盘面数据初始化各下拉框
  function openManualModal() {
    if (state.currentPan && state.currentPan.pillars) {
      const p = state.currentPan;
      if (selGzYear) selGzYear.value = p.pillars.year;
      if (selGzMonth) selGzMonth.value = p.pillars.month;
      if (selGzDay) selGzDay.value = p.pillars.day;
      if (selGzHour) selGzHour.value = p.pillars.hour;
      if (selDun) selDun.value = p.dun || '阴';
      if (selJuNum) selJuNum.value = String(p.ju || 5);
      if (selPaipanMethod) selPaipanMethod.value = p.paipanMethod || 'zhuan';
    }
    if (selDingjuMethod) {
      selDingjuMethod.value = state.dingjuMethod || 'zhirun';
    }
    if (iptGzQuick) iptGzQuick.value = '';
    if (txtGzQuickStatus) txtGzQuickStatus.textContent = '';
    if (txtParseStatus) txtParseStatus.textContent = '';
    updateManualPreview();
    openModal('modalManualInput');
  }

  if (btnBottomManual) {
    btnBottomManual.addEventListener('click', openManualModal);
  }

  // 7. 确认录入并排盘
  if (btnConfirm) {
    btnConfirm.addEventListener('click', () => {
      const dun = selDun.value;
      const ju = parseInt(selJuNum.value);
      const paipanMethod = selPaipanMethod.value;
      const dingjuMethod = selDingjuMethod ? selDingjuMethod.value : state.dingjuMethod;
      const customPillars = {
        year: selGzYear.value,
        month: selGzMonth.value,
        day: selGzDay.value,
        hour: selGzHour.value
      };

      state.manualJu = { dun, ju, type: 'manual', dingjuMethod };
      state.customPillars = customPillars;
      state.paipanMethod = paipanMethod;
      state.dingjuMethod = dingjuMethod;

      // 同步全局定局方式 Segmented Button
      const segDingju = document.getElementById('segDingjuGroup');
      if (segDingju) {
        segDingju.querySelectorAll('.m3-segment-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.value === dingjuMethod);
        });
      }

      closeModal('modalManualInput');
      executePaipan();

      const djText = selDingjuMethod ? selDingjuMethod.options[selDingjuMethod.selectedIndex]?.text : '';
      showToast(`已成功录入并排定【${dun}遁${['一','二','三','四','五','六','七','八','九'][ju - 1]}局 · ${djText} · ${customPillars.day}日 ${customPillars.hour}时】！`);
    });
  }
}

// ==================== 12. 系统常用设置模块 (统一配置与持久化存储) ====================
function initSettingsModal() {
  const btnSettings = document.getElementById('btnSettings');
  if (btnSettings) {
    btnSettings.addEventListener('click', () => {
      syncSettingsModal();
      openModal('modalSettings');
    });
  }

  const btnOpenHelp = document.getElementById('btnSettingsOpenHelp');
  if (btnOpenHelp) {
    btnOpenHelp.addEventListener('click', () => {
      closeModal('modalSettings');
      openModal('modalHelp');
    });
  }

  // 省份与城市下拉列表联动
  const selProv = document.getElementById('selSettingProvince');
  const selCity = document.getElementById('selSettingCity');
  const numLon = document.getElementById('numSettingLongitude');

  if (selProv && selCity && numLon) {
    selProv.innerHTML = '';
    CITIES_DATA.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.province;
      opt.textContent = p.province;
      if (p.province === (state.province || '北京')) opt.selected = true;
      selProv.appendChild(opt);
    });

    function populateSettingCities(provName, selectCityName) {
      selCity.innerHTML = '';
      const provObj = CITIES_DATA.find(p => p.province === provName) || CITIES_DATA[0];
      provObj.cities.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.name;
        opt.textContent = c.name;
        opt.dataset.lon = c.lon;
        selCity.appendChild(opt);
      });
      if (selectCityName) {
        const cleanCity = selectCityName.replace(provName, '').trim();
        const matchOpt = Array.from(selCity.options).find(o => o.value === cleanCity || o.value === selectCityName);
        if (matchOpt) selCity.value = matchOpt.value;
        else selCity.selectedIndex = 0;
      } else {
        selCity.selectedIndex = 0;
      }
      updateSettingLongitude();
    }

    function updateSettingLongitude() {
      const selOpt = selCity.options[selCity.selectedIndex];
      if (selOpt && selOpt.dataset.lon) {
        numLon.value = selOpt.dataset.lon;
        state.longitude = parseFloat(selOpt.dataset.lon);
        state.province = selProv.value;
        state.cityName = `${selProv.value} ${selOpt.value}`;
        localStorage.setItem('qimen_province', state.province);
        localStorage.setItem('qimen_city', state.cityName);
        localStorage.setItem('qimen_longitude', state.longitude);

        // 同步主页面位置选择器
        const mainProv = document.getElementById('selProvince');
        const mainCity = document.getElementById('selCity');
        const mainLon = document.getElementById('numLongitude');
        if (mainProv && mainCity && mainLon) {
          mainProv.value = state.province;
          const provObj = CITIES_DATA.find(p => p.province === state.province) || CITIES_DATA[0];
          mainCity.innerHTML = '';
          provObj.cities.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name;
            opt.textContent = c.name;
            opt.dataset.lon = c.lon;
            mainCity.appendChild(opt);
          });
          mainCity.value = selOpt.value;
          mainLon.value = selOpt.dataset.lon;
        }
        executePaipan();
      }
    }

    selProv.addEventListener('change', () => {
      populateSettingCities(selProv.value);
    });

    selCity.addEventListener('change', () => {
      updateSettingLongitude();
    });

    numLon.addEventListener('change', () => {
      state.longitude = parseFloat(numLon.value) || 120.0;
      localStorage.setItem('qimen_longitude', state.longitude);
      const mainLon = document.getElementById('numLongitude');
      if (mainLon) mainLon.value = state.longitude;
      executePaipan();
    });

    populateSettingCities(state.province || '北京', state.cityName);
  }

  // 绑定设置弹窗内部的 Segmented Buttons
  bindSettingSeg('segSettingDingju', val => {
    if (!guardPrefChange('dingjuMethod', val, '切换定局方式')) return;
    state.dingjuMethod = val;
    localStorage.setItem('qimen_dingju_method', val);
    syncMainSegmentGroup('segDingjuGroup', val);
    executePaipan();
  });

  bindSettingSeg('segSettingPaipan', val => {
    if (!guardPrefChange('paipanMethod', val, '切换排盘方式')) return;
    state.paipanMethod = val;
    localStorage.setItem('qimen_paipan_method', val);
    syncMainSegmentGroup('segPaipanGroup', val);
    executePaipan();
  });

  bindSettingSeg('segSettingZishi', val => {
    if (!guardPrefChange('zishi', val, '切换子时处理')) return;
    state.zishi = val;
    localStorage.setItem('qimen_zishi', val);
    syncMainSegmentGroup('segZishiGroup', val);
    executePaipan();
  });

  bindSettingSeg('segSettingTheme', val => {
    document.documentElement.setAttribute('data-theme', val);
    localStorage.setItem('qimen_theme', val);
  });

  bindSettingSeg('segSettingSimple', val => {
    state.isSimpleMode = val === '1';
    document.body.classList.toggle('simple-mode', state.isSimpleMode);
    const btn = document.getElementById('btnToggleSimple');
    if (btn) btn.textContent = state.isSimpleMode ? '完整模式' : '简洁模式';
    localStorage.setItem('qimen_simple_mode', val);
  });

  bindSettingSeg('segSettingDetail', val => {
    state.showKeyingDetails = val === '1';
    state.palaceModeOverrides = {}; // 总开关切换时重置各宫单宫覆盖，最高控制权限生效
    localStorage.setItem('qimen_show_keying_details', val);
    updateKeyingToggleBtn(state.showKeyingDetails);
    if (state.currentPan) renderKeyingAnalysis(state.currentPan, state.selectedGong);
  });

  bindSettingSeg('segSettingImagery', val => {
    setImageryMode(val);
  });

  bindSettingSeg('segSettingDipan', val => {
    state.showDipan = val === '1';
    localStorage.setItem('qimen_show_dipan', val);
    const chk = document.getElementById('chkToggleDipan');
    if (chk) chk.checked = state.showDipan;
    updateBoardCardCenter(state.currentPan);
    if (state.currentPan) {
      renderNinePalaces(state.currentPan);
      renderKeyingAnalysis(state.currentPan, state.selectedGong);
    }
  });

  const chkAutoAnim = document.getElementById('chkSettingAutoAnimOnYongshen');
  if (chkAutoAnim) {
    chkAutoAnim.checked = state.autoAnimOnYongshen;
    chkAutoAnim.addEventListener('change', e => {
      state.autoAnimOnYongshen = e.target.checked;
      localStorage.setItem('qimen_auto_anim_on_yongshen', state.autoAnimOnYongshen ? '1' : '0');
      showToast(state.autoAnimOnYongshen ? '已开启：首次选取用神后自动开始动态演盘' : '已关闭：首次选取用神后自动演盘');
    });
  }

  const chkMask = document.getElementById('chkSettingMask');
  if (chkMask) {
    chkMask.checked = state.maskWeakened;
    chkMask.addEventListener('change', e => {
      state.maskWeakened = e.target.checked;
      localStorage.setItem('qimen_mask_weakened', state.maskWeakened ? '1' : '0');
      if (state.currentPan) {
        renderNinePalaces(state.currentPan);
        renderKeyingAnalysis(state.currentPan, state.selectedGong);
      }
    });
  }

  bindSettingSeg('segSettingKong', val => {
    state.kongLookOpposite = val === '1';
    localStorage.setItem('qimen_kong_look_opposite', val);
    if (state.currentPan) {
      renderNinePalaces(state.currentPan);
      renderKeyingAnalysis(state.currentPan, state.selectedGong);
    }
  });

  // 恢复出厂默认按钮
  const btnReset = document.getElementById('btnSettingsResetDefault');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      resetSettingsToDefault();
    });
  }

  syncSettingsModal();
}

function bindSettingSeg(groupId, onChange) {
  const group = document.getElementById(groupId);
  if (!group) return;
  const btns = group.querySelectorAll('.m3-segment-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (onChange) onChange(btn.dataset.value);
    });
  });
}

function syncMainSegmentGroup(groupId, value) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll('.m3-segment-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.value === value);
  });
}

function syncSettingsModal() {
  // 同步定局法
  syncSegButtons('segSettingDingju', state.dingjuMethod);
  // 同步排盘法
  syncSegButtons('segSettingPaipan', state.paipanMethod);
  // 同步子时
  syncSegButtons('segSettingZishi', state.zishi);
  // 同步主题
  const curTheme = document.documentElement.getAttribute('data-theme') || 'light';
  syncSegButtons('segSettingTheme', curTheme);
  // 同步简洁模式
  syncSegButtons('segSettingSimple', state.isSimpleMode ? '1' : '0');
  // 同步详细
  syncSegButtons('segSettingDetail', state.showKeyingDetails ? '1' : '0');
  // 同步象意
  syncSegButtons('segSettingImagery', state.imageryMode);
  // 同步地盘
  syncSegButtons('segSettingDipan', state.showDipan ? '1' : '0');
  // 同步旬空
  syncSegButtons('segSettingKong', state.kongLookOpposite ? '1' : '0');
  // 同步动态演盘开关
  const chkAutoAnim = document.getElementById('chkSettingAutoAnimOnYongshen');
  if (chkAutoAnim) chkAutoAnim.checked = state.autoAnimOnYongshen;
  // 同步蒙版
  const chk = document.getElementById('chkSettingMask');
  if (chk) chk.checked = state.maskWeakened;

  syncSettingsModalLocation();
}

function syncSegButtons(groupId, value) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll('.m3-segment-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.value === String(value));
  });
}

function syncSettingsModalLocation() {
  const selProv = document.getElementById('selSettingProvince');
  const selCity = document.getElementById('selSettingCity');
  const numLon = document.getElementById('numSettingLongitude');
  if (!selProv || !selCity || !numLon) return;

  if (selProv.value !== state.province) {
    selProv.value = state.province || '北京';
    const provObj = CITIES_DATA.find(p => p.province === selProv.value) || CITIES_DATA[0];
    selCity.innerHTML = '';
    provObj.cities.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = c.name;
      opt.dataset.lon = c.lon;
      selCity.appendChild(opt);
    });
  }
  const cleanCity = (state.cityName || '').replace(state.province, '').trim();
  const match = Array.from(selCity.options).find(o => o.value === cleanCity || o.value === state.cityName);
  if (match) selCity.value = match.value;
  numLon.value = state.longitude;
}

function resetSettingsToDefault() {
  // 清理 localStorage 中的相关设置项
  [
    'qimen_dingju_method', 'qimen_paipan_method', 'qimen_zishi',
    'qimen_province', 'qimen_city', 'qimen_longitude',
    'qimen_theme', 'qimen_simple_mode', 'qimen_show_keying_details',
    'qimen_imagery_mode', 'qimen_show_dipan',
    'qimen_mask_weakened', 'qimen_kong_look_opposite',
    'qimen_auto_anim_on_yongshen'
  ].forEach(k => localStorage.removeItem(k));

  state.dingjuMethod = 'zhirun';
  state.paipanMethod = 'zhuan';
  state.zishi = 'split';
  state.province = '北京';
  state.cityName = '北京 天安门';
  state.longitude = 116.38;
  state.isSimpleMode = false;
  state.showKeyingDetails = true;
  state.palaceModeOverrides = {};
  state.imageryMode = 'all';
  state.showDipan = false;
  state.maskWeakened = false;
  state.autoAnimOnYongshen = false;
  state.kongLookOpposite = true;

  document.documentElement.setAttribute('data-theme', 'light');
  document.body.classList.remove('simple-mode');
  const btnSimple = document.getElementById('btnToggleSimple');
  if (btnSimple) btnSimple.textContent = '简洁模式';

  const chkDipan = document.getElementById('chkToggleDipan');
  if (chkDipan) chkDipan.checked = false;

  updateKeyingToggleBtn(true);
  syncSettingsModal();

  // 同步主界面表单
  syncMainSegmentGroup('segDingjuGroup', 'zhirun');
  syncMainSegmentGroup('segPaipanGroup', 'zhuan');
  syncMainSegmentGroup('segZishiGroup', 'split');

  const mainProv = document.getElementById('selProvince');
  const mainCity = document.getElementById('selCity');
  const mainLon = document.getElementById('numLongitude');
  if (mainProv && mainCity && mainLon) {
    mainProv.value = '北京';
    const provObj = CITIES_DATA.find(p => p.province === '北京') || CITIES_DATA[0];
    mainCity.innerHTML = '';
    provObj.cities.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = c.name;
      opt.dataset.lon = c.lon;
      mainCity.appendChild(opt);
    });
    mainCity.selectedIndex = 0;
    mainLon.value = 116.38;
  }

  setImageryMode('all');

  executePaipan();
  showToast('已恢复出厂默认设置！');
}

// ========================================================
// 结构化断事笔记与回访 (叶鸿生解盘九步 + 反馈验证闭环)
// ========================================================
let notesEditingId = null;

function openCaseNotesModal(id) {
  const targetId = id || state.activeRecordId;
  if (!targetId) {
    showToast('当前盘还不是一条记录：先“立即起盘”或“保存当前格局”，再写断事笔记');
    return;
  }
  if (targetId === state.activeRecordId) flushRecordAutosave();
  const rec = getRecord(targetId);
  if (!rec) {
    showToast('没有找到这条记录');
    return;
  }
  notesEditingId = rec.id;
  renderCaseNotesBody(rec);
  openModal('modalCaseNotes');
}

function renderCaseNotesBody(rec) {
  const body = document.getElementById('notesDialogBody');
  const headline = document.getElementById('txtNotesHeadline');
  if (headline) headline.textContent = `笔记回访 · ${rec.userQuestion || rec.title || rec.dateStr}`;
  if (!body) return;

  const n = rec.notes || {};
  const ysReveal = Array.isArray(rec.ysAtReveal) && rec.ysAtReveal.length ? rec.ysAtReveal.join('、') : '—';
  const titleVal = rec.title || '';
  const questionVal = rec.userQuestion || '';

  // 1. 提取并兼容历史笔记内容（绝不丢失任何老案例的历史细分数据）
  const legacySections = [];
  if (n.asker && n.asker.trim()) legacySections.push(`【求测人】${n.asker.trim()}`);
  if (n.yongshenReason && n.yongshenReason.trim()) legacySections.push(`【用神理由】${n.yongshenReason.trim()}`);
  if (n.readings && n.readings.trim()) legacySections.push(`【读象】\n${n.readings.trim()}`);
  if (n.relations && n.relations.trim()) legacySections.push(`【对宫马星】${n.relations.trim()}`);
  if (n.judgment && n.judgment.trim()) legacySections.push(`【综合判断】\n${n.judgment.trim()}`);
  if (n.yunchou && n.yunchou.trim()) legacySections.push(`【运筹方案】\n${n.yunchou.trim()}`);

  let mainContent = rec.remark || '';
  if (legacySections.length) {
    if (!mainContent.trim()) {
      mainContent = legacySections.join('\n\n');
    } else {
      const missing = legacySections.filter(s => !mainContent.includes(s.slice(0, 8)));
      if (missing.length) {
        mainContent = mainContent.trim() + '\n\n' + missing.join('\n\n');
      }
    }
  }

  // 2. 应期内容
  const yingqiText = n.yingqi || '';
  const yingqiDate = n.yingqiDate || '';

  // 3. 验断结论
  const currentVerdict = rec.verdict || '待验证';

  // 4. 反馈历史列表
  const fbList = (rec.feedback || []).map((x, i) => `
    <li class="notes-feedback-item">
      <span class="notes-fb-date">${escapeHtml(x.date || '')}</span>
      <span class="notes-fb-verdict">${escapeHtml(x.verdict || '待验证')}</span>
      <span class="notes-fb-text">${escapeHtml(x.text || '')}</span>
      <button type="button" class="m3-btn-subtle notes-fb-del" data-fb-del="${i}" title="删除这条反馈">✕</button>
    </li>`).join('');

  body.innerHTML = `
    <div class="notes-meta">
      <div><strong>${escapeHtml(rec.dateStr || '')}</strong> ｜ ${escapeHtml(recordSummary(rec))}</div>
      <div style="margin-top: 3px;">揭盘时用神：<strong>${escapeHtml(ysReveal)}</strong></div>
    </div>

    <!-- 案例标题与所问问题编辑区 (整合原“编辑此案例”功能) -->
    <div class="notes-case-header-edit">
      <label class="notes-inline-field">
        <span class="notes-sub-label">案例标题 / 占事简注</span>
        <input type="text" class="m3-input" id="notesCaseTitle" placeholder="例如：测工作事业与公司" value="${escapeHtml(titleVal)}">
      </label>
      <label class="notes-inline-field">
        <span class="notes-sub-label">所问事项 / 具体问题</span>
        <input type="text" class="m3-input" id="notesCaseQuestion" placeholder="记录求测人具体提问事项..." value="${escapeHtml(questionVal)}">
      </label>
    </div>

    <!-- 核心块 1：断事笔记（主断语 & 象意分析） -->
    <div class="notes-field">
      <div class="notes-field-header">
        <div class="notes-field-label">
          <strong>断事笔记</strong>
          <span>断语推断、逐宫象意与综合判断</span>
        </div>
        <button type="button" class="m3-btn m3-btn-tonal notes-btn-insert-inline" id="btnNotesInsertInline" title="在光标处插入用神宫要素">
          + 插入用神宫要素
        </button>
      </div>
      <textarea class="m3-input notes-main-textarea" id="notesMainContent" rows="7" placeholder="在此记录核心断语、分析过程与象意推导...&#10;（提示：可随时点击【+ 插入用神宫要素】快捷导入落宫象意）">${escapeHtml(mainContent)}</textarea>
    </div>

    <!-- 核心块 2：定应期（单行紧凑卡片） -->
    <div class="notes-timing-card">
      <div class="notes-field-label">
        <strong>定应期</strong>
        <span>推断应期时段及对应日期</span>
      </div>
      <div class="notes-timing-inputs">
        <input type="text" class="m3-input" id="notesField_yingqi" style="flex: 1; min-width: 140px; height: 34px; font-size: 13px;" placeholder="例如：申月填实 / 丙日冲动..." value="${escapeHtml(yingqiText)}">
        <label class="notes-date-pill">
          <span>预计日期</span>
          <input type="date" class="m3-input" id="notesDate_yingqi" value="${escapeHtml(yingqiDate)}">
        </label>
      </div>
    </div>

    <!-- 核心块 3：验断与实际结果 -->
    <div class="notes-verification-card">
      <div class="notes-verdict-bar">
        <span class="notes-sub-label"><strong>验断结论：</strong></span>
        <div class="notes-verdict-segmented" id="notesVerdictSegmented">
          ${VERDICTS.map(v => `
            <button type="button" class="notes-verdict-btn ${currentVerdict === v ? 'active' : ''}" data-verdict="${v}">${v}</button>
          `).join('')}
        </div>
      </div>

      <div class="notes-feedback-quick">
        <div class="notes-feedback-input-row">
          <input type="text" class="m3-input" id="notesFeedbackText" placeholder="记录实际发生的情况或验断细节...">
          <button type="button" class="m3-btn m3-btn-tonal" id="btnNotesAddFeedback" style="height: 36px; white-space: nowrap;">记录反馈</button>
        </div>
      </div>

      ${fbList ? `<ul class="notes-feedback-list">${fbList}</ul>` : ''}
    </div>
  `;

  // 绑定验断结论胶囊按钮点选
  const segButtons = body.querySelectorAll('.notes-verdict-btn');
  segButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      segButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // 绑定内联【+ 插入用神宫要素】
  const btnInlineInsert = document.getElementById('btnNotesInsertInline');
  if (btnInlineInsert) {
    btnInlineInsert.addEventListener('click', insertYongShenPalacesIntoNotes);
  }

  // 绑定添加反馈
  const btnAdd = document.getElementById('btnNotesAddFeedback');
  if (btnAdd) {
    btnAdd.addEventListener('click', () => {
      const txt = document.getElementById('notesFeedbackText');
      const text = txt ? txt.value.trim() : '';
      if (!text) {
        showToast('先写下实际情况再记录');
        return;
      }
      const activeBtn = body.querySelector('.notes-verdict-btn.active');
      const curVerdict = activeBtn ? activeBtn.dataset.verdict : '待验证';

      saveCaseNotesForm(false);
      const updated = updateRecord(notesEditingId, r => {
        r.feedback = r.feedback || [];
        r.feedback.push({ at: new Date().toISOString(), date: todayStr(), text, verdict: curVerdict });
      });
      if (updated) renderCaseNotesBody(updated);
      refreshCaseList(notesEditingId);
      showToast('已添加反馈记录');
    });
  }

  // 绑定删除反馈
  body.querySelectorAll('[data-fb-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!window.confirm('删除这条反馈？')) return;
      const idx = parseInt(btn.dataset.fbDel);
      saveCaseNotesForm(false);
      const updated = updateRecord(notesEditingId, r => {
        r.feedback.splice(idx, 1);
      });
      if (updated) renderCaseNotesBody(updated);
    });
  });
}

function saveCaseNotesForm(closeAfter = true) {
  if (!notesEditingId) return;
  const val = id => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  };

  const caseTitle = val('notesCaseTitle');
  const caseQuestion = val('notesCaseQuestion');
  const mainContent = val('notesMainContent');
  const yingqi = val('notesField_yingqi');
  const yingqiDate = val('notesDate_yingqi');

  const activeVerdictBtn = document.querySelector('#notesVerdictSegmented .notes-verdict-btn.active');
  const verdict = activeVerdictBtn ? activeVerdictBtn.dataset.verdict : '待验证';

  const updated = updateRecord(notesEditingId, r => {
    if (caseTitle) {
      r.title = caseTitle;
      r.titleEdited = true;
    }
    if (caseQuestion !== undefined) {
      r.userQuestion = caseQuestion;
    }
    r.notes = r.notes || {};
    r.notes.readings = mainContent;
    r.notes.judgment = mainContent;
    r.notes.yingqi = yingqi;
    r.notes.yingqiDate = yingqiDate;
    r.remark = mainContent;
    if (verdict) r.verdict = verdict;
    rebuildFollowUps(r);
  });

  if (updated && updated.id === state.activeRecordId) {
    if (caseTitle) state.caseTitle = updated.title;
    if (caseQuestion) state.userQuestion = updated.userQuestion;
    state.caseRemark = updated.remark || '';
    try { localStorage.setItem('qimen_case_remark', state.caseRemark); } catch (e) {}
    const txtUser = document.getElementById('txtUserRemark');
    if (txtUser) txtUser.value = state.caseRemark;
  }
  refreshCaseList(notesEditingId);
  if (closeAfter) {
    closeModal('modalCaseNotes');
    showToast('断事笔记与案例已保存');
  }
}

function insertYongShenPalacesIntoNotes() {
  const rec = notesEditingId ? getRecord(notesEditingId) : null;
  if (!rec) return;
  if (rec.status === 'pending') {
    showToast('盘面尚未揭晓，揭盘后再插入用神宫要素');
    return;
  }
  // 以这条记录的原盘为准 (不是当前屏幕上的研究盘)
  const pan = rec.panSnapshot ? rec.panSnapshot : (rec.id === state.activeRecordId ? state.currentPan : null);
  if (!pan) {
    showToast('这条旧案例没有盘面快照：请先“读取并复原此盘”后再插入');
    return;
  }
  const ysList = (rec.selectedYongShen && rec.selectedYongShen.length) ? rec.selectedYongShen : ['值符'];
  const lines = [];
  ysList.forEach(ys => {
    for (let g = 1; g <= 9; g++) {
      const m = checkPalaceMatchYongShen(pan, g, [ys]);
      if (m && m.matched) lines.push(`【${ys}】${palaceFactLine(pan, g)}`);
    }
  });
  if (!lines.length) {
    showToast('没有在盘上找到所选用神的落宫');
    return;
  }
  const ta = document.getElementById('notesMainContent');
  if (ta) {
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const insertText = lines.join('\n') + '\n';
    if (typeof start === 'number' && typeof end === 'number') {
      const before = ta.value.substring(0, start);
      const after = ta.value.substring(end);
      const needPrefixNl = before && !before.endsWith('\n') ? '\n' : '';
      ta.value = before + needPrefixNl + insertText + after;
      const newPos = before.length + needPrefixNl.length + insertText.length;
      ta.setSelectionRange(newPos, newPos);
    } else {
      ta.value = (ta.value ? ta.value.replace(/\s+$/, '') + '\n\n' : '') + insertText;
    }
    ta.focus();
  }
  showToast(`已插入 ${lines.length} 个用神落宫象意`);
}

function initCaseNotesModal() {
  const btnSave = document.getElementById('btnNotesSave');
  if (btnSave) btnSave.addEventListener('click', () => saveCaseNotesForm(true));
  const btnInsert = document.getElementById('btnNotesInsertPalaces');
  if (btnInsert) btnInsert.addEventListener('click', insertYongShenPalacesIntoNotes);
  ['btnOpenNotes', 'btnBottomNotes', 'btnYsOpenNotes'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', () => openCaseNotesModal(state.activeRecordId));
  });
}

// ========================================================
// 九宫盘面动态演示与演盘引擎 (Dynamic Board Animation)
// 先逐个展示地盘各个元素，然后再展示天盘动态运作
// ========================================================
const GONG_NAMES_MAP = { 1: '坎一', 2: '坤二', 3: '震三', 4: '巽四', 5: '中五', 6: '乾六', 7: '兑七', 8: '艮八', 9: '离九' };
const YIQI_SEQUENCE = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'];

// 地盘原始九星与八门各宫归属 (本宫固定原位)
const HOME_STARS = { 1: '天蓬', 2: '天芮', 3: '天冲', 4: '天辅', 5: '天禽', 6: '天心', 7: '天柱', 8: '天任', 9: '天英' };
const HOME_DOORS = { 1: '休门', 2: '死门', 3: '伤门', 4: '杜门', 5: '', 6: '开门', 7: '惊门', 8: '生门', 9: '景门' };

// 五行属性映射字典
const ELEM_COLOR_MAP = {
  // 十天干奇仪
  '甲': 'wood', '乙': 'wood',
  '丙': 'fire', '丁': 'fire',
  '戊': 'earth', '己': 'earth',
  '庚': 'metal', '辛': 'metal',
  '壬': 'water', '癸': 'water',

  // 九星
  '天蓬': 'water', '天蓬星': 'water', '蓬': 'water',
  '天任': 'earth', '天任星': 'earth', '任': 'earth',
  '天冲': 'wood', '天冲星': 'wood', '冲': 'wood',
  '天辅': 'wood', '天辅星': 'wood', '辅': 'wood',
  '天英': 'fire', '天英星': 'fire', '英': 'fire',
  '天芮': 'earth', '天芮星': 'earth', '芮': 'earth',
  '天禽': 'earth', '天禽星': 'earth', '禽': 'earth',
  '天柱': 'metal', '天柱星': 'metal', '柱': 'metal',
  '天心': 'metal', '天心星': 'metal', '心': 'metal',

  // 八门与飞盘九门
  '休门': 'water', '休': 'water',
  '生门': 'earth', '生': 'earth',
  '伤门': 'wood', '伤': 'wood',
  '杜门': 'wood', '杜': 'wood',
  '景门': 'fire', '景': 'fire',
  '死门': 'earth', '死': 'earth',
  '惊门': 'metal', '惊': 'metal',
  '开门': 'metal', '开': 'metal',
  '中门': 'earth', '中': 'earth',

  // 八神与飞盘九神
  '值符': 'earth',
  '螣蛇': 'fire', '腾蛇': 'fire',
  '太阴': 'metal',
  '六合': 'wood',
  '白虎': 'metal',
  '玄武': 'water',
  '九地': 'earth',
  '九天': 'metal',
  '勾陈': 'earth',
  '朱雀': 'fire',
  '太常': 'earth',

  // 九宫
  1: 'water', 2: 'earth', 3: 'wood', 4: 'wood',
  5: 'earth', 6: 'metal', 7: 'metal', 8: 'earth', 9: 'fire'
};

const GONG_WUXING_INFO = {
  1: { wx: 'water', name: '1水·坎' },
  2: { wx: 'earth', name: '2土·坤' },
  3: { wx: 'wood', name: '3木·震' },
  4: { wx: 'wood', name: '4木·巽' },
  5: { wx: 'earth', name: '5土·中' },
  6: { wx: 'metal', name: '6金·乾' },
  7: { wx: 'metal', name: '7金·兑' },
  8: { wx: 'earth', name: '8土·艮' },
  9: { wx: 'fire', name: '9火·离' }
};

function getWxClass(elem) {
  if (!elem) return '';
  const clean = String(elem).replace(/·原$/, '').trim();
  const wx = ELEM_COLOR_MAP[clean] || ELEM_COLOR_MAP[clean[0]] || '';
  return wx ? `wx-${wx}` : '';
}

// 九宫格 3x3 行列网格坐标映射
const GONG_GRID_COORDS = {
  4: { row: 0, col: 0 },
  9: { row: 0, col: 1 },
  2: { row: 0, col: 2 },
  3: { row: 1, col: 0 },
  5: { row: 1, col: 1 },
  7: { row: 1, col: 2 },
  8: { row: 2, col: 0 },
  1: { row: 2, col: 1 },
  6: { row: 2, col: 2 }
};

function buildOrthogonalPath(x1, y1, x2, y2, fromCoord, toCoord, R = 22) {
  const r1 = fromCoord ? fromCoord.row : 0;
  const c1 = fromCoord ? fromCoord.col : 0;
  const r2 = toCoord ? toCoord.row : 0;
  const c2 = toCoord ? toCoord.col : 0;

  // 1. 同一水平行 (无拐角直线，且仅限外周顶行或底行，杜绝穿行中宫)
  if (r1 === r2 && (r1 === 0 || r1 === 2)) {
    const dx = x2 - x1;
    const signX = dx >= 0 ? 1 : -1;
    const startX = x1 + signX * 8;
    const endX = x2 - signX * 18;
    const len = Math.max(10, Math.abs(endX - startX));
    return {
      d: `M ${startX} ${y1} L ${endX} ${y2}`,
      len: Math.round(len)
    };
  }

  // 2. 同一垂直列 (无拐角直线，且仅限外周左列或右列，杜绝穿行中宫)
  if (c1 === c2 && (c1 === 0 || c1 === 2)) {
    const dy = y2 - y1;
    const signY = dy >= 0 ? 1 : -1;
    const startY = y1 + signY * 8;
    const endY = y2 - signY * 18;
    const len = Math.max(10, Math.abs(endY - startY));
    return {
      d: `M ${x1} ${startY} L ${x2} ${endY}`,
      len: Math.round(len)
    };
  }

  // 3. 穿中宫横向对冲 (震三 col 0 <-> 兑七 col 2, 同在 row 1)：走顶边外围走廊 (巽4 -> 离9 -> 坤2)
  if (r1 === 1 && r2 === 1 && c1 !== c2) {
    const trackY = 48;
    const dx = x2 - x1;
    const signX = dx >= 0 ? 1 : -1;
    const startY = y1 - 8;
    const radius = R;
    const p1y = trackY + radius;
    const p2x = x1 + signX * radius;
    const p3x = x2 - signX * radius;
    const p4y = trackY + radius;
    const endY = y2 - 18;
    const d = `M ${x1} ${startY} L ${x1} ${p1y} Q ${x1} ${trackY} ${p2x} ${trackY} L ${p3x} ${trackY} Q ${x2} ${trackY} ${x2} ${p4y} L ${x2} ${endY}`;
    const len = Math.round(Math.abs(startY - p1y) + Math.abs(p3x - p2x) + Math.abs(endY - p4y) + Math.PI * radius);
    return { d, len };
  }

  // 4. 穿中宫纵向对冲 (离九 row 0 <-> 坎一 row 2, 同在 col 1)：走右边外围走廊 (坤2 -> 兑7 -> 乾6)
  if (c1 === 1 && c2 === 1 && r1 !== r2) {
    const trackX = 362;
    const dy = y2 - y1;
    const signY = dy >= 0 ? 1 : -1;
    const startX = x1 + 8;
    const radius = R;
    const p1x = trackX - radius;
    const p2y = y1 + signY * radius;
    const p3y = y2 - signY * radius;
    const p4x = trackX - radius;
    const endX = x2 + 18;
    const d = `M ${startX} ${y1} L ${p1x} ${y1} Q ${trackX} ${y1} ${trackX} ${p2y} L ${trackX} ${p3y} Q ${trackX} ${y2} ${p4x} ${y2} L ${endX} ${y2}`;
    const len = Math.round(Math.abs(p1x - startX) + Math.abs(p3y - p2y) + Math.abs(endX - p4x) + Math.PI * radius);
    return { d, len };
  }

  // 5. 异行异列：拐角走外周大方格四角之一 (巽4、坤2、艮8、乾6)，严禁穿行中宫
  let useHorizontalFirst = true;
  if (r1 === 0 || r1 === 2) {
    // 起点位于顶行或底行：先沿顶/底水平走道行进，再拐弯垂直射向目标
    useHorizontalFirst = true;
  } else if (c1 === 0 || c1 === 2) {
    // 起点位于左列或右列：先沿左/右垂直走道行进，再拐弯水平射向目标
    useHorizontalFirst = false;
  } else {
    useHorizontalFirst = true;
  }

  const dx = x2 - x1;
  const dy = y2 - y1;
  const signX = dx >= 0 ? 1 : -1;
  const signY = dy >= 0 ? 1 : -1;

  if (useHorizontalFirst) {
    // 先水平后垂直：拐角坐标 (x2, y1)
    const cx = x2;
    const cy = y1;
    const radius = Math.min(R, Math.abs(dx) * 0.45, Math.abs(dy) * 0.45);
    const startX = x1 + signX * 8;
    const p1x = cx - signX * radius;
    const p1y = y1;
    const p2x = x2;
    const p2y = cy + signY * radius;
    const endY = y2 - signY * 18;
    const d = `M ${startX} ${y1} L ${p1x} ${p1y} Q ${cx} ${cy} ${p2x} ${p2y} L ${x2} ${endY}`;
    const len = Math.round(Math.abs(p1x - startX) + (Math.PI * radius / 2) + Math.abs(endY - p2y));
    return { d, len };
  } else {
    // 先垂直后水平：拐角坐标 (x1, y2)
    const cx = x1;
    const cy = y2;
    const radius = Math.min(R, Math.abs(dx) * 0.45, Math.abs(dy) * 0.45);
    const startY = y1 + signY * 8;
    const p1x = x1;
    const p1y = cy - signY * radius;
    const p2x = cx + signX * radius;
    const p2y = y2;
    const endX = x2 - signX * 18;
    const d = `M ${x1} ${startY} L ${p1x} ${p1y} Q ${cx} ${cy} ${p2x} ${p2y} L ${endX} ${y2}`;
    const len = Math.round(Math.abs(p1y - startY) + (Math.PI * radius / 2) + Math.abs(endX - p2x));
    return { d, len };
  }
}

function buildStraightPath(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) {
    return { d: `M ${x1} ${y1} L ${x2} ${y2}`, len: 10 };
  }
  const ux = dx / dist;
  const uy = dy / dist;

  // 起点紧随原位文字边缘，终点预留 marker 箭头落位空间
  const startOffset = 10;
  const endOffset = 18;
  const startX = x1 + ux * startOffset;
  const startY = y1 + uy * startOffset;
  const endX = x2 - ux * endOffset;
  const endY = y2 - uy * endOffset;
  const len = Math.max(10, Math.round(dist - startOffset - endOffset));

  return {
    d: `M ${startX} ${startY} L ${endX} ${endY}`,
    len
  };
}

function renderAnimationArrow(fromGong, toGong, label = '', arrowType = '', flightDuration = 600) {
  const svg = document.getElementById('boardAnimArrowLayer');
  if (!svg) return;
  if (!fromGong || !toGong || fromGong === toGong) {
    svg.innerHTML = '';
    return;
  }
  const fromCoord = GONG_GRID_COORDS[fromGong];
  const toCoord = GONG_GRID_COORDS[toGong];
  if (!fromCoord || !toCoord) {
    svg.innerHTML = '';
    return;
  }

  const svgRect = svg.getBoundingClientRect();
  const width = svgRect.width || 410;
  const height = svgRect.height || 410;

  const colW = width / 3;
  const rowH = height / 3;

  // 默认宫位中心坐标
  let x1 = (fromCoord.col + 0.5) * colW;
  let y1 = (fromCoord.row + 0.5) * rowH;
  let x2 = (toCoord.col + 0.5) * colW;
  let y2 = (toCoord.row + 0.5) * rowH;

  // 精确定位：优先定位原位文字与新位文字的实际 DOM 视觉中心点
  const fromCell = document.getElementById(`cellGong${fromGong}`);
  const toCell = document.getElementById(`cellGong${toGong}`);

  if (fromCell && svgRect.width > 0) {
    let fromTarget = null;
    if (arrowType === 'star') {
      fromTarget = fromCell.querySelector('.anim-origin-motion-star') || fromCell.querySelector('.anim-slot-star') || fromCell.querySelector('.anim-row-mid');
    } else if (arrowType === 'door') {
      fromTarget = fromCell.querySelector('.anim-origin-motion-door') || fromCell.querySelector('.anim-slot-door') || fromCell.querySelector('.anim-row-bot');
    }
    if (fromTarget) {
      const r = fromTarget.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        x1 = r.left + r.width / 2 - svgRect.left;
        y1 = r.top + r.height / 2 - svgRect.top;
      }
    }
  }

  if (toCell && svgRect.width > 0) {
    let toTarget = null;
    if (arrowType === 'star') {
      toTarget = toCell.querySelector('.anim-target-motion-star') || toCell.querySelector('.highlight-fu-star') || toCell.querySelector('.anim-star-tag') || toCell.querySelector('.anim-slot-star');
    } else if (arrowType === 'door') {
      toTarget = toCell.querySelector('.anim-target-motion-door') || toCell.querySelector('.is-shi') || toCell.querySelector('.anim-door-tag') || toCell.querySelector('.anim-slot-door');
    }
    if (toTarget) {
      const r = toTarget.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        x2 = r.left + r.width / 2 - svgRect.left;
        y2 = r.top + r.height / 2 - svgRect.top;
      }
    }
  }

  // 同行同列微偏差对齐：同行严格水平，同列严格垂直，杜绝字体排版导致微小偏折
  if (fromCoord.row === toCoord.row) {
    const avgY = (y1 + y2) / 2;
    y1 = avgY;
    y2 = avgY;
  }
  if (fromCoord.col === toCoord.col) {
    const avgX = (x1 + x2) / 2;
    x1 = avgX;
    x2 = avgX;
  }

  // 文字首尾直线生长路径：直截了当连接原位文字与新位文字，从原位向新位生长，避免走外周路径造成顺逆误导
  const route = buildStraightPath(x1, y1, x2, y2);
  const pathD = route.d;
  const pathLen = route.len + 30;

  svg.innerHTML = `
    <defs>
      <marker id="animArrowMarker" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto" overflow="visible">
        <path d="M 0 1.5 L 9 5 L 0 8.5 z" class="anim-arrow-marker" />
      </marker>
      <mask id="arrowMotionMask" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}">
        <path d="${pathD}" fill="none" stroke="white" stroke-width="36" stroke-linecap="round" class="anim-mask-lead-path" style="--mask-len: ${pathLen}px; animation-duration: ${flightDuration}ms;" />
      </mask>
    </defs>
    <path d="${pathD}" class="anim-arrow-path" mask="url(#arrowMotionMask)" marker-end="url(#animArrowMarker)" />
  `;
}

function clearAnimationArrow() {
  const svg = document.getElementById('boardAnimArrowLayer');
  if (svg) svg.innerHTML = '';
}

window.__qimen_renderAnimationArrow = renderAnimationArrow;
window.__qimen_buildStraightPath = buildStraightPath;

const boardAnimState = {
  running: false,
  paused: false,
  pan: null,
  stepIdx: 0,
  steps: [],
  timerId: null,
  subTimers: [],
  speedIdx: 0,
  speedOptions: [
    { label: '1x', factor: 1.0 },
    { label: '1.5x', factor: 0.65 },
    { label: '0.6x', factor: 1.5 }
  ]
};

function clearAnimSubTimers() {
  if (boardAnimState.subTimers && boardAnimState.subTimers.length) {
    boardAnimState.subTimers.forEach(id => clearTimeout(id));
    boardAnimState.subTimers = [];
  }
}

function addAnimSubTimer(fn, delay) {
  if (!boardAnimState.subTimers) boardAnimState.subTimers = [];
  const id = setTimeout(fn, delay);
  boardAnimState.subTimers.push(id);
  return id;
}

// 转盘八卦宫位顺时针与逆时针环线 (洛书外周 8 宫：坎1->艮8->震3->巽4->离9->坤2->兑7->乾6)
const ZHUAN_RING_CW = [1, 8, 3, 4, 9, 2, 7, 6];
const ZHUAN_RING_CCW = [1, 6, 7, 2, 9, 4, 3, 8];

// 飞盘洛书九宫飞布序列 (坎1、坤2、震3、巽4、中5、乾6、兑7、艮8、离9)
const JIUGONG_FEI_SEQ = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function getRingSequenceCW(startGong) {
  const idx = ZHUAN_RING_CW.indexOf(startGong);
  if (idx === -1) return [...ZHUAN_RING_CW];
  return [...ZHUAN_RING_CW.slice(idx), ...ZHUAN_RING_CW.slice(0, idx)];
}

function getRingSequenceCCW(startGong) {
  const idx = ZHUAN_RING_CCW.indexOf(startGong);
  if (idx === -1) return [...ZHUAN_RING_CCW];
  return [...ZHUAN_RING_CCW.slice(idx), ...ZHUAN_RING_CCW.slice(0, idx)];
}

function getFeipanSequence(startGong, dun) {
  const startIdx = JIUGONG_FEI_SEQ.indexOf(startGong);
  const seq = [];
  for (let i = 0; i < 9; i++) {
    const targetIdx = (dun === '阳')
      ? (startIdx + i) % 9
      : (startIdx - i + 9) % 9;
    seq.push(JIUGONG_FEI_SEQ[targetIdx]);
  }
  return seq;
}

function buildBoardAnimationSteps(pan) {
  const steps = [];
  const p = pan.pillars;
  const isZhuan = pan.paipanMethod === 'zhuan';
  const methodLabel = isZhuan ? '排宫法/转盘' : '飞宫法/飞盘';

  // 1. 初始化底盘基调
  steps.push({
    stage: '起局',
    badgeClass: 'stage-dipan',
    desc: `起局定元：${p.year}年 ${p.month}月 ${p.day}日 ${p.hour}时 ·【${methodLabel} · ${pan.dun}遁${GONG_NUM[pan.ju] || pan.ju}局】`,
    duration: 500,
    activeGongs: [],
    originGongs: [],
    revealedDipanGans: new Set(),
    revealedStarGongs: new Set(),
    revealedTianGanGongs: new Set(),
    revealedDoorGongs: new Set(),
    revealedSpiritGongs: new Set(),
    showFuShiOrigin: false,
    showMarks: false,
    newGong: null,
    newType: null
  });

  // 2. 地盘三奇六仪逐个落入 (9 步，严格按 戊己庚辛壬癸丁丙乙 顺序逐宫飞布)
  const dipanRevealed = new Set();
  YIQI_SEQUENCE.forEach((gan, idx) => {
    let targetGong = null;
    for (let g = 1; g <= 9; g++) {
      if (pan.dipan[g] === gan) {
        targetGong = g;
        break;
      }
    }
    if (!targetGong) targetGong = pan.ju;
    dipanRevealed.add(gan);

    const isCenter = targetGong === 5;
    let extraNote = '';
    if (isCenter && isZhuan) {
      extraNote = '（中五皇极，寄于坤二）';
    }

    steps.push({
      stage: '地盘',
      badgeClass: 'stage-dipan',
      desc: `布地盘六仪 (${idx + 1}/9)：奇仪【${gan}】飞落${GONG_NAMES_MAP[targetGong]}宫 ${extraNote}`,
      duration: 360,
      activeGongs: [targetGong, ...(isCenter && isZhuan ? [2] : [])],
      originGongs: [],
      revealedDipanGans: new Set(dipanRevealed),
      revealedStarGongs: new Set(),
      revealedTianGanGongs: new Set(),
      revealedDoorGongs: new Set(),
      revealedSpiritGongs: new Set(),
      showFuShiOrigin: false,
      showMarks: false,
      newGong: targetGong,
      newType: 'dipan'
    });
  });

  // 3. 寻旬首遁甲，锁定值符星与值使门原位 (仅在旬首宫亮出原位星门，清晰聚焦)
  const fuGong = pan.fuGong;
  steps.push({
    stage: '旬首',
    badgeClass: 'stage-tianpan',
    desc: `寻旬首：时柱【${p.hour}】属【${pan.xun}】旬，甲遁于【${pan.shouYi}】（在${GONG_NAMES_MAP[fuGong]}宫），定值符【${pan.starFu}】、值使【${pan.doorShi}】${isZhuan ? '' : '（飞宫法）'}`,
    duration: 850,
    activeGongs: [fuGong],
    originGongs: [fuGong],
    revealedDipanGans: new Set(dipanRevealed),
    revealedStarGongs: new Set(),
    revealedTianGanGongs: new Set(),
    revealedDoorGongs: new Set(),
    revealedSpiritGongs: new Set(),
    showFuShiOrigin: true,
    showMarks: false,
    newGong: fuGong,
    newType: 'origin'
  });

  // 4. 值符随时干转九星（转盘8步，飞盘飞布9宫9步含中五！）
  const shiGong = pan.shiGong;
  const starGongSeq = isZhuan ? getRingSequenceCW(shiGong) : getFeipanSequence(shiGong, pan.dun);
  const totalStars = starGongSeq.length;
  const starRevealed = new Set();
  const tianganRevealed = new Set();

  starGongSeq.forEach((g, idx) => {
    starRevealed.add(g);
    tianganRevealed.add(g);
    const star = pan.tianpanStar[g] || '';
    const tg = pan.tianpanGan[g] || '';
    const isFirst = idx === 0;

    let desc = '';
    if (isFirst) {
      desc = `值符${isZhuan ? '加临' : '飞临'}时干 (1/${totalStars})：值符【${pan.starFu}】携天盘【${tg}】${isZhuan ? '加临' : '飞落'}${GONG_NAMES_MAP[g]}宫`;
    } else {
      const dirText = isZhuan ? '顺转' : (pan.dun === '阳' ? '顺飞' : '逆飞');
      desc = `${isZhuan ? '运转' : '飞布'}九星 (${idx + 1}/${totalStars})：【${star}】携天盘【${tg}】${dirText}飞落${GONG_NAMES_MAP[g]}宫`;
    }

    steps.push({
      stage: '九星',
      badgeClass: 'stage-tianpan',
      desc,
      duration: isFirst ? 1400 : 360,
      activeGongs: [g],
      originGongs: isFirst ? [fuGong] : [],
      motionType: isFirst ? 'star' : null,
      motionFrom: isFirst ? fuGong : null,
      motionTo: isFirst ? g : null,
      arrowFrom: isFirst ? fuGong : null,
      arrowTo: isFirst ? g : null,
      arrowType: isFirst ? 'star' : null,
      arrowLabel: '',
      revealedDipanGans: new Set(dipanRevealed),
      revealedStarGongs: new Set(starRevealed),
      revealedTianGanGongs: new Set(tianganRevealed),
      revealedDoorGongs: new Set(),
      revealedSpiritGongs: new Set(),
      showFuShiOrigin: false,
      showMarks: false,
      newGong: g,
      newType: 'star'
    });
  });

  // 5. 值使随时支转八门/九门（转盘8步，飞盘飞布9宫9步含中门！）
  const doorGong = pan.doorShiGong;
  const doorGongSeq = isZhuan ? getRingSequenceCW(doorGong) : getFeipanSequence(doorGong, pan.dun);
  const totalDoors = doorGongSeq.length;
  const doorRevealed = new Set();

  doorGongSeq.forEach((g, idx) => {
    doorRevealed.add(g);
    const door = pan.tianpanDoor[g] || '';
    const isFirst = idx === 0;

    let desc = '';
    if (isFirst) {
      desc = `值使随时支 (1/${totalDoors})：值使【${pan.doorShi}】自旬首依时辰数${isZhuan ? '运转' : '飞布'}至${GONG_NAMES_MAP[g]}宫`;
    } else {
      const dirText = isZhuan ? '顺转' : (pan.dun === '阳' ? '顺飞' : '逆飞');
      desc = `${isZhuan ? '运转' : '飞布'}${isZhuan ? '八门' : '九门'} (${idx + 1}/${totalDoors})：【${door}】${dirText}飞落${GONG_NAMES_MAP[g]}宫`;
    }

    steps.push({
      stage: isZhuan ? '八门' : '九门',
      badgeClass: 'stage-tianpan',
      desc,
      duration: isFirst ? 1400 : 360,
      activeGongs: [g],
      originGongs: isFirst ? [fuGong] : [],
      motionType: isFirst ? 'door' : null,
      motionFrom: isFirst ? fuGong : null,
      motionTo: isFirst ? g : null,
      arrowFrom: isFirst ? fuGong : null,
      arrowTo: isFirst ? g : null,
      arrowType: isFirst ? 'door' : null,
      arrowLabel: '',
      revealedDipanGans: new Set(dipanRevealed),
      revealedStarGongs: new Set(starRevealed),
      revealedTianGanGongs: new Set(tianganRevealed),
      revealedDoorGongs: new Set(doorRevealed),
      revealedSpiritGongs: new Set(),
      showFuShiOrigin: false,
      showMarks: false,
      newGong: g,
      newType: 'door'
    });
  });

  // 6. 八神/九神飞布（转盘8步，飞盘飞布9宫9步含勾陈/朱雀/太常！）
  const spiritGongSeq = isZhuan
    ? ((pan.dun === '阳') ? getRingSequenceCW(shiGong) : getRingSequenceCCW(shiGong))
    : getFeipanSequence(shiGong, pan.dun);
  const totalSpirits = spiritGongSeq.length;
  const spiritRevealed = new Set();

  spiritGongSeq.forEach((g, idx) => {
    spiritRevealed.add(g);
    const spirit = pan.tianpanSpirit[g] || '';
    const isFirst = idx === 0;

    let desc = '';
    if (isFirst) {
      desc = `排布${isZhuan ? '八神' : '九神'} (1/${totalSpirits})：神首【值符】加临天盘时干${GONG_NAMES_MAP[g]}宫`;
    } else {
      const dirText = isZhuan ? (pan.dun === '阳' ? '顺时针' : '逆时针') : (pan.dun === '阳' ? '顺飞' : '逆飞');
      desc = `排布${isZhuan ? '八神' : '九神'} (${idx + 1}/${totalSpirits})：【${spirit}】${dirText}飞落${GONG_NAMES_MAP[g]}宫`;
    }

    steps.push({
      stage: isZhuan ? '八神' : '九神',
      badgeClass: 'stage-tianpan',
      desc,
      duration: isFirst ? 500 : 320,
      activeGongs: [g],
      originGongs: [],
      revealedDipanGans: new Set(dipanRevealed),
      revealedStarGongs: new Set(starRevealed),
      revealedTianGanGongs: new Set(tianganRevealed),
      revealedDoorGongs: new Set(doorRevealed),
      revealedSpiritGongs: new Set(spiritRevealed),
      showFuShiOrigin: false,
      showMarks: false,
      newGong: g,
      newType: 'spirit'
    });
  });

  // 7. 标定时柱旬空与驿马星等天时大象 (1 步)
  const kongGongs = [1,2,3,4,5,6,7,8,9].filter(g => pan.palaceFlags[g] && pan.palaceFlags[g].isKong);
  const maGong = [1,2,3,4,5,6,7,8,9].find(g => pan.palaceFlags[g] && pan.palaceFlags[g].hasMa);
  steps.push({
    stage: '大象',
    badgeClass: 'stage-tianpan',
    desc: `标明大象：标定时柱旬空【${pan.kongwang.hour}】与驿马星，天时大象俱备`,
    duration: 750,
    activeGongs: [...kongGongs, ...(maGong ? [maGong] : [])],
    originGongs: [],
    revealedDipanGans: new Set(dipanRevealed),
    revealedStarGongs: new Set(starRevealed),
    revealedTianGanGongs: new Set(tianganRevealed),
    revealedDoorGongs: new Set(doorRevealed),
    revealedSpiritGongs: new Set(spiritRevealed),
    showFuShiOrigin: false,
    showMarks: true,
    newGong: null,
    newType: 'marks'
  });

  // 8. 推演圆满完成 (1 步)
  steps.push({
    stage: '圆满',
    badgeClass: 'stage-done',
    desc: `排盘推演圆满完成！现已呈现完整盘面，可点击任意宫位研判克应`,
    duration: 900,
    activeGongs: [],
    originGongs: [],
    revealedDipanGans: new Set(dipanRevealed),
    revealedStarGongs: new Set(starRevealed),
    revealedTianGanGongs: new Set(tianganRevealed),
    revealedDoorGongs: new Set(doorRevealed),
    revealedSpiritGongs: new Set(spiritRevealed),
    showFuShiOrigin: false,
    showMarks: true,
    newGong: null,
    newType: 'done'
  });

  return steps;
}

function renderAnimCellContent(pan, g, step) {
  const isZhuan = pan.paipanMethod === 'zhuan';
  const dg = pan.dipan[g] || '';
  const isDgRevealed = step.revealedDipanGans && step.revealedDipanGans.has(dg);
  const isNewDg = step.newGong === g && step.newType === 'dipan';
  const gongInfo = GONG_WUXING_INFO[g] || { wx: '', name: GONG_NAMES_MAP[g] || '' };

  // 中五宫特殊展示：仅在时家转盘法下中五皇极寄坤二；飞盘法下中五宫是标准主宫，走完整三行！
  if (g === 5 && isZhuan) {
    const centerGan = isDgRevealed ? dg : '';
    const centerWx = getWxClass(centerGan);
    let centerKong = '';
    if (step.showMarks && pan.palaceFlags[5] && pan.palaceFlags[5].isKong) {
      centerKong = `<span class="badge-kong anim-symbol-drop" style="position: absolute; top: 6px; left: 8px;">○</span>`;
    }
    return `
      <div class="anim-center-cell">
        ${centerKong}
        <div class="anim-cell-gong-mark wx-earth">5土·中</div>
        <div class="cell-center-content ${centerWx} ${isNewDg ? 'anim-symbol-drop' : ''}" style="font-size: 32px; font-weight: 800; line-height: 1.2;">
          ${centerGan || '皇极'}
        </div>
        <div class="anim-watermark" style="font-size: 11px; margin-top: 4px;">中五 · 寄坤二</div>
      </div>
    `;
  }

  // ================= 第一行 (顶层天位)：八神/九神 (左) + 宫名数理 (右) =================
  let spiritHtml = '';
  if (step.revealedSpiritGongs && step.revealedSpiritGongs.has(g)) {
    const spirit = pan.tianpanSpirit[g] || '';
    const isFu = spirit === '值符';
    const spiritWx = getWxClass(spirit);
    spiritHtml = `<span class="spirit-tag ${spiritWx} ${isFu ? 'is-fu' : ''} ${step.newGong === g && step.newType === 'spirit' ? 'anim-symbol-drop' : ''}">${spirit}</span>`;
  }

  let kongHtml = '';
  let maHtml = '';
  if (step.showMarks) {
    const flag = pan.palaceFlags[g];
    if (flag) {
      if (flag.isKong) kongHtml = `<div class="anim-palace-kong-wrap"><span class="badge-kong anim-symbol-drop">○</span></div>`;
      if (flag.hasMa) maHtml = `<div class="palace-ma-wrap"><span class="badge-ma anim-symbol-drop">马</span></div>`;
    }
  }

  const topRowHtml = `
    <div class="anim-cell-row anim-row-top">
      <div class="anim-cell-left-box anim-slot-spirit">
        ${spiritHtml}
      </div>
      <div class="anim-cell-gong-mark ${gongInfo.wx ? 'wx-' + gongInfo.wx : ''}">
        ${gongInfo.name}
      </div>
    </div>
  `;

  // ================= 第二行 (中层星位)：九星 (左) + 天盘奇仪 (右) =================
  let starHtml = '';
  if (step.motionType === 'star') {
    if (g === step.motionFrom) {
      // 原宫位展示对应的九星（无多余·原字，无背景底色，原色呈现）
      const originStar = pan.starFu || HOME_STARS[g] || '';
      const starWx = getWxClass(originStar);
      let starDisplay = originStar;
      if (originStar.includes('天芮')) starDisplay = `天芮<span class="star-qin wx-earth">禽</span>`;
      starHtml = `<span class="anim-star-tag ${starWx} anim-origin-motion-star" id="animOriginMotionStar">${starDisplay}</span>`;
    } else if (g === step.motionTo) {
      // 目标新宫位九星：初始等待状态 (is-waiting)，待虚线飞抵后显现
      const starName = pan.tianpanStar[g] || '';
      const isFuStar = starName.includes(pan.starFu);
      const starWx = getWxClass(starName);
      let starDisplay = starName;
      if (starName.includes('天芮')) starDisplay = `天芮<span class="star-qin wx-earth">禽</span>`;
      starHtml = `<span class="anim-star-tag ${starWx} ${isFuStar ? 'highlight-fu-star' : ''} anim-target-motion-star is-waiting" id="animTargetMotionStar">${starDisplay}</span>`;
    } else if (step.revealedStarGongs && step.revealedStarGongs.has(g)) {
      const starName = pan.tianpanStar[g] || '';
      const isFuStar = starName.includes(pan.starFu);
      const starWx = getWxClass(starName);
      let starDisplay = starName;
      if (starName.includes('天芮')) starDisplay = `天芮<span class="star-qin wx-earth">禽</span>`;
      starHtml = `<span class="anim-star-tag ${starWx} ${isFuStar ? 'highlight-fu-star' : ''}">${starDisplay}</span>`;
    }
  } else if (step.revealedStarGongs && step.revealedStarGongs.has(g)) {
    const starName = pan.tianpanStar[g] || '';
    const isFuStar = starName.includes(pan.starFu);
    const starWx = getWxClass(starName);
    let starDisplay = starName;
    if (starName.includes('天芮')) starDisplay = `天芮<span class="star-qin wx-earth">禽</span>`;
    starHtml = `<span class="anim-star-tag ${starWx} ${isFuStar ? 'highlight-fu-star' : ''} ${step.newGong === g && step.newType === 'star' ? 'anim-symbol-drop' : ''}">${starDisplay}</span>`;
  }

  // 天盘奇仪 (正位第二行右侧)
  let tgHtml = '';
  if (step.revealedTianGanGongs && step.revealedTianGanGongs.has(g)) {
    const tg = pan.tianpanGan[g] || '';
    const tgWx = getWxClass(tg);
    const isWaiting = (step.motionType === 'star' && g === step.motionTo);
    const waitClass = isWaiting ? 'anim-target-motion-tg is-waiting' : '';
    const dropClass = (!isWaiting && step.newGong === g && step.newType === 'star') ? 'anim-symbol-drop' : '';
    tgHtml = `<span class="tian-gan ${tgWx} ${waitClass} ${dropClass}">${tg}</span>`;
    if (pan.tianpanJigan[g]) {
      const jiWx = getWxClass(pan.tianpanJigan[g]);
      tgHtml += `<span class="tian-jigan-stem ${jiWx} ${waitClass} ${dropClass}">${pan.tianpanJigan[g]}</span>`;
    }
  }

  const midRowHtml = `
    <div class="anim-cell-row anim-row-mid">
      <div class="anim-cell-left-box anim-slot-star">
        ${starHtml}
      </div>
      <div class="cell-stem-group anim-cell-right-box anim-slot-tiangan">${tgHtml}</div>
    </div>
  `;

  // ================= 第三行 (底层人地)：八门/九门 (左) + 地盘奇仪 (右) =================
  let doorHtml = '';
  if (step.motionType === 'door') {
    if (g === step.motionFrom) {
      // 原宫位展示对应的八门（无多余·原字，无背景底色，原色呈现）
      const originDoor = pan.doorShi || HOME_DOORS[g] || (g === 5 ? '中门' : '');
      const doorWx = getWxClass(originDoor);
      doorHtml = `<span class="anim-door-tag ${doorWx} anim-origin-motion-door" id="animOriginMotionDoor">${originDoor}</span>`;
    } else if (g === step.motionTo) {
      // 目标新宫位八门：初始等待状态 (is-waiting)，待虚线飞抵后显现
      const doorName = pan.tianpanDoor[g] || '';
      const isShiDoor = doorName.includes(pan.doorShi) && g === pan.doorShiGong;
      const doorWx = getWxClass(doorName);
      doorHtml = `<span class="anim-door-tag ${doorWx} ${isShiDoor ? 'is-shi' : ''} anim-target-motion-door is-waiting" id="animTargetMotionDoor">${doorName}</span>`;
    } else if (step.revealedDoorGongs && step.revealedDoorGongs.has(g)) {
      const doorName = pan.tianpanDoor[g] || '';
      const isShiDoor = doorName.includes(pan.doorShi) && g === pan.doorShiGong;
      const doorWx = getWxClass(doorName);
      doorHtml = `<span class="anim-door-tag ${doorWx} ${isShiDoor ? 'is-shi' : ''}">${doorName}</span>`;
    }
  } else if (step.revealedDoorGongs && step.revealedDoorGongs.has(g)) {
    const doorName = pan.tianpanDoor[g] || '';
    const isShiDoor = doorName.includes(pan.doorShi) && g === pan.doorShiGong;
    const doorWx = getWxClass(doorName);
    doorHtml = `<span class="anim-door-tag ${doorWx} ${isShiDoor ? 'is-shi' : ''} ${step.newGong === g && step.newType === 'door' ? 'anim-symbol-drop' : ''}">${doorName}</span>`;
  }

  // 地盘干 (正位第三行右下角)
  let dgHtml = '';
  if (isDgRevealed) {
    const dgWx = getWxClass(dg);
    dgHtml = `<span class="di-gan ${dgWx} ${isNewDg ? 'anim-symbol-drop' : ''}">${dg}</span>`;
    // 坤二宫寄干 (若时家转盘且中五干已排)
    if (g === 2 && isZhuan && step.revealedDipanGans.has(pan.dipan[5])) {
      const jiganVal = pan.dipan[5];
      const jiganWx = getWxClass(jiganVal);
      dgHtml += `<span class="di-jigan-stem ${jiganWx} ${step.newGong === 5 ? 'anim-symbol-drop' : ''}" title="中五寄干">${jiganVal}</span>`;
    }
  }

  const botRowHtml = `
    <div class="anim-cell-row anim-row-bot">
      <div class="anim-cell-left-box anim-slot-door">
        ${doorHtml}
      </div>
      <div class="cell-stem-group anim-cell-right-box anim-slot-digan">${dgHtml}</div>
    </div>
  `;

  return `<div class="anim-cell-inner">${topRowHtml}${midRowHtml}${botRowHtml}${maHtml}${kongHtml}</div>`;
}

function startBoardAnimation() {
  if (blockIfPending('排盘过程')) return;
  if (!state.currentPan) executePaipan();
  const pan = state.currentPan;
  if (!pan) return;

  // 清除进行中的演示
  stopBoardAnimation(false);

  boardAnimState.running = true;
  boardAnimState.paused = false;
  boardAnimState.pan = pan;
  boardAnimState.stepIdx = 0;
  boardAnimState.steps = buildBoardAnimationSteps(pan);

  // 显示控制横幅并激活按钮状态
  const banner = document.getElementById('boardAnimBanner');
  if (banner) banner.style.display = 'flex';
  const toggleBtn = document.getElementById('btnStartBoardAnimation');
  if (toggleBtn) toggleBtn.classList.add('is-active');

  const grid = document.getElementById('nineGrid');
  if (grid) {
    grid.classList.add('is-animating-board');
    // 演盘开始时，暂时清除用神弱化蒙版，确保全盘九宫完全通透清晰
    grid.classList.remove('has-yongshen-active');
  }

  // 临时清除可能残存的单元格蒙版或选框
  for (let g = 1; g <= 9; g++) {
    const cell = document.getElementById(`cellGong${g}`);
    if (cell) {
      cell.classList.remove('is-palace-dimmed', 'selected', 'is-yongshen', 'is-yongshen-zhifu', 'is-yongshen-opposite-kong');
    }
  }

  // 平滑滚动到九宫盘面卡片
  const cardSection = document.getElementById('boardCardSection');
  if (cardSection) {
    cardSection.classList.add('is-anim-active');
    cardSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  const iconPause = document.getElementById('animPauseIcon');
  if (iconPause) iconPause.textContent = '⏸';

  playAnimStep();
}

function playAnimStep() {
  if (!boardAnimState.running || boardAnimState.paused) return;
  clearAnimSubTimers();
  const steps = boardAnimState.steps;
  const idx = boardAnimState.stepIdx;
  const pan = boardAnimState.pan;
  if (idx >= steps.length) {
    stopBoardAnimation(true);
    return;
  }

  const step = steps[idx];
  // 1. 更新顶部控制横幅
  const badge = document.getElementById('animStageBadge');
  if (badge) {
    badge.textContent = step.stage;
    badge.className = `anim-stage-badge ${step.badgeClass || ''}`;
  }
  const desc = document.getElementById('animStepDesc');
  if (desc) desc.textContent = step.desc;

  const bar = document.getElementById('animProgressBar');
  if (bar) {
    const pct = ((idx + 1) / steps.length * 100).toFixed(1);
    bar.style.width = `${pct}%`;
  }

  // 2. 渲染 9 宫
  const activeSet = new Set(step.activeGongs || []);
  const originSet = new Set(step.originGongs || []);
  for (let g = 1; g <= 9; g++) {
    const cell = document.getElementById(`cellGong${g}`);
    if (!cell) continue;
    cell.innerHTML = renderAnimCellContent(pan, g, step);
    cell.classList.toggle('is-anim-highlight', activeSet.has(g));
    cell.classList.toggle('is-anim-origin', originSet.has(g));
    cell.classList.remove('is-yongshen', 'is-yongshen-zhifu', 'is-yongshen-opposite-kong');
  }

  const factor = boardAnimState.speedOptions[boardAnimState.speedIdx].factor;

  // 3. 动态视觉引导虚线发射运动 (原位星/门 -> 新变动位星/门)
  if (step.arrowFrom && step.arrowTo) {
    const flightDuration = Math.round(620 * factor);
    renderAnimationArrow(step.arrowFrom, step.arrowTo, step.arrowLabel || '', step.arrowType || '', flightDuration);
  } else {
    clearAnimationArrow();
  }

  // 4. 若为动态位移运动步 (九星加临 / 八门随时支)：调度原位消失与新位出现子时序
  if (step.motionType) {
    const fadeOutDelay = Math.round(280 * factor);
    const arriveDelay = Math.round(580 * factor);

    // 子时序 1: 虚线飞出一半时，原宫位文字开始淡出
    addAnimSubTimer(() => {
      const originId = (step.motionType === 'star') ? 'animOriginMotionStar' : 'animOriginMotionDoor';
      const originEl = document.getElementById(originId);
      if (originEl) {
        originEl.classList.add('is-fading-out');
      }
    }, fadeOutDelay);

    // 子时序 2: 虚线抵达目标宫，原宫位文字完全隐去，新宫位文字与天盘干落位显现
    addAnimSubTimer(() => {
      const originId = (step.motionType === 'star') ? 'animOriginMotionStar' : 'animOriginMotionDoor';
      const originEl = document.getElementById(originId);
      if (originEl) {
        originEl.style.visibility = 'hidden';
        originEl.style.opacity = '0';
      }

      const targetId = (step.motionType === 'star') ? 'animTargetMotionStar' : 'animTargetMotionDoor';
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.classList.remove('is-waiting');
        targetEl.classList.add('anim-symbol-drop');
      }

      const targetTgs = document.querySelectorAll('.anim-target-motion-tg');
      targetTgs.forEach(el => {
        el.classList.remove('is-waiting');
        el.classList.add('anim-symbol-drop');
      });
    }, arriveDelay);
  }

  // 5. 计算下一跳时间
  const stepDuration = Math.round(step.duration * factor);
  boardAnimState.timerId = setTimeout(() => {
    boardAnimState.stepIdx++;
    playAnimStep();
  }, stepDuration);
}

function stopBoardAnimation(finishAndRestore = true) {
  if (boardAnimState.timerId) {
    clearTimeout(boardAnimState.timerId);
    boardAnimState.timerId = null;
  }
  clearAnimSubTimers();
  boardAnimState.running = false;
  boardAnimState.paused = false;

  clearAnimationArrow();

  const banner = document.getElementById('boardAnimBanner');
  if (banner) banner.style.display = 'none';
  const toggleBtn = document.getElementById('btnStartBoardAnimation');
  if (toggleBtn) toggleBtn.classList.remove('is-active');

  const cardSection = document.getElementById('boardCardSection');
  if (cardSection) cardSection.classList.remove('is-anim-active');

  const grid = document.getElementById('nineGrid');
  if (grid) grid.classList.remove('is-animating-board');

  for (let g = 1; g <= 9; g++) {
    const cell = document.getElementById(`cellGong${g}`);
    if (cell) cell.classList.remove('is-anim-highlight', 'is-anim-origin');
  }

  if (finishAndRestore && boardAnimState.pan) {
    renderNinePalaces(boardAnimState.pan);
    if (!state.isPendingReveal) {
      renderKeyingAnalysis(boardAnimState.pan, state.selectedGong);
    }
  }
}

// 初始化九宫格动态演盘控制条事件
function initBoardAnimationControls() {
  const btnStart = document.getElementById('btnStartBoardAnimation');
  if (btnStart) btnStart.addEventListener('click', startBoardAnimation);

  const btnPause = document.getElementById('btnAnimPause');
  const iconPause = document.getElementById('animPauseIcon');
  if (btnPause) {
    btnPause.addEventListener('click', () => {
      if (!boardAnimState.running) return;
      if (boardAnimState.paused) {
        boardAnimState.paused = false;
        if (iconPause) iconPause.textContent = '⏸';
        playAnimStep();
      } else {
        boardAnimState.paused = true;
        if (boardAnimState.timerId) clearTimeout(boardAnimState.timerId);
        clearAnimSubTimers();
        if (iconPause) iconPause.textContent = '▶';
      }
    });
  }

  const btnSpeed = document.getElementById('btnAnimSpeed');
  const txtSpeed = document.getElementById('animSpeedText');
  if (btnSpeed) {
    btnSpeed.addEventListener('click', () => {
      boardAnimState.speedIdx = (boardAnimState.speedIdx + 1) % boardAnimState.speedOptions.length;
      const curSpeed = boardAnimState.speedOptions[boardAnimState.speedIdx];
      if (txtSpeed) txtSpeed.textContent = curSpeed.label;
    });
  }

  const btnSkip = document.getElementById('btnAnimSkip');
  if (btnSkip) {
    btnSkip.addEventListener('click', () => {
      stopBoardAnimation(true);
      showToast('已直接呈现全盘排盘结果');
    });
  }
}

// ========================================================
// 分步排盘讲解与练习模式
// ========================================================
const stepsState = { steps: [], idx: 0, pan: null, practice: false, answered: false };

function openStepsModal() {
  if (blockIfPending('排盘过程')) return;
  if (!state.currentPan) executePaipan();
  stepsState.pan = state.currentPan;
  stepsState.steps = buildPaipanSteps(stepsState.pan);
  stepsState.idx = 0;
  stepsState.answered = false;
  renderStepsView();
  openModal('modalSteps');
}

function renderStepsView() {
  const steps = stepsState.steps;
  const idx = stepsState.idx;
  const pan = stepsState.pan;
  const step = steps[idx];
  if (!step || !pan) return;
  const quizActive = !!(stepsState.practice && step.quiz && !stepsState.answered);
  // 练习模式下，作答前只显示上一步的图层
  const layers = quizActive && idx > 0 ? steps[idx - 1].layers : step.layers;

  const progress = document.getElementById('stepsProgress');
  if (progress) {
    progress.innerHTML = steps.map((s, i) => `<button type="button" class="steps-dot ${i === idx ? 'is-current' : ''} ${i < idx ? 'is-done' : ''}" data-step="${i}" title="${escapeHtml(s.title)}">${i + 1}</button>`).join('');
    progress.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => {
      stepsState.idx = parseInt(b.dataset.step);
      stepsState.answered = false;
      renderStepsView();
    }));
  }

  const order = [4, 9, 2, 3, 5, 7, 8, 1, 6];
  const hl = new Set(quizActive ? [] : (step.highlight || []));
  const arrowFrom = new Set(quizActive ? [] : (step.arrows || []).map(a => a[0]));
  const board = document.getElementById('stepsBoard');
  if (board) {
    board.innerHTML = order.map(g => {
      const c = cellLayerContent(pan, g, layers);
      const isCenterZhuan = g === 5 && pan.paipanMethod === 'zhuan';
      return `
        <div class="steps-cell ${hl.has(g) ? 'is-hl' : ''} ${arrowFrom.has(g) ? 'is-from' : ''} ${quizActive ? 'is-quiz' : ''}" data-gong="${g}">
          <div class="steps-cell-head"><span>${c.gua}</span><span>${c.zhi}</span></div>
          ${c.spirit && !isCenterZhuan ? `<div class="steps-l steps-spirit">${escapeHtml(c.spirit)}</div>` : ''}
          ${c.star && !isCenterZhuan ? `<div class="steps-l steps-star">${escapeHtml(c.star)}</div>` : ''}
          ${c.door && !isCenterZhuan ? `<div class="steps-l steps-door">${escapeHtml(c.door)}</div>` : ''}
          <div class="steps-gan">
            ${c.tiangan && !isCenterZhuan ? `<span class="steps-tg" title="天盘干">${escapeHtml(c.tiangan)}</span>` : ''}
            ${c.dipan ? `<span class="steps-dg" title="地盘干">${escapeHtml(c.dipan)}</span>` : ''}
          </div>
          ${(c.kong || c.ma) ? `<div class="steps-marks">${c.kong ? '<span class="steps-kong">空</span>' : ''}${c.ma ? '<span class="steps-ma">马</span>' : ''}</div>` : ''}
        </div>`;
    }).join('');
    if (quizActive) {
      board.querySelectorAll('.steps-cell').forEach(cell => cell.addEventListener('click', () => answerStepQuiz(parseInt(cell.dataset.gong))));
    }
  }

  const setHtml = (id, html) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  };
  setHtml('stepsTitle', escapeHtml(step.title));
  setHtml('stepsRule', escapeHtml(step.rule));
  const quizEl = document.getElementById('stepsQuiz');
  if (quizActive) {
    setHtml('stepsDetail', '<span class="steps-hidden-hint">（练习模式：先在九宫上点出你的答案，再看讲解）</span>');
    if (quizEl) {
      quizEl.style.display = 'block';
      quizEl.classList.remove('is-wrong');
      quizEl.textContent = `❓ ${step.quiz.prompt}`;
    }
  } else {
    setHtml('stepsDetail', escapeHtml(step.detail));
    if (quizEl && !(stepsState.practice && step.quiz && stepsState.answered)) quizEl.style.display = 'none';
  }

  const prev = document.getElementById('btnStepsPrev');
  const next = document.getElementById('btnStepsNext');
  if (prev) prev.disabled = idx === 0;
  if (next) next.textContent = idx === steps.length - 1 ? '完成' : (quizActive ? '跳过，看答案' : '下一步');
}

function answerStepQuiz(g) {
  const step = stepsState.steps[stepsState.idx];
  if (!step || !step.quiz) return;
  const ok = step.quiz.answer.includes(g);
  stepsState.answered = true;
  renderStepsView();
  const quizEl = document.getElementById('stepsQuiz');
  if (quizEl) {
    quizEl.style.display = 'block';
    const names = step.quiz.answer.map(x => `${GONG_CN[x] || ''}${GONG_NUM[x]}宫`).join('、');
    quizEl.textContent = ok
      ? `✅ 答对了：${names}`
      : `❌ 你点的是${(GONG_CN[g] || '') + GONG_NUM[g]}宫，正确答案是${names}。对照下面的讲解再走一遍。`;
    quizEl.classList.toggle('is-wrong', !ok);
  }
}

function initStepsModal() {
  initBoardAnimationControls();
  ['btnOpenSteps', 'btnBottomSteps'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', startBoardAnimation);
  });
  const prev = document.getElementById('btnStepsPrev');
  const next = document.getElementById('btnStepsNext');
  const chk = document.getElementById('chkStepsPractice');
  if (prev) prev.addEventListener('click', () => {
    if (stepsState.idx > 0) {
      stepsState.idx--;
      stepsState.answered = false;
      renderStepsView();
    }
  });
  if (next) next.addEventListener('click', () => {
    const step = stepsState.steps[stepsState.idx];
    if (stepsState.practice && step && step.quiz && !stepsState.answered) {
      stepsState.answered = true;
      renderStepsView();
      return;
    }
    if (stepsState.idx >= stepsState.steps.length - 1) {
      closeModal('modalSteps');
      return;
    }
    stepsState.idx++;
    stepsState.answered = false;
    renderStepsView();
  });
  if (chk) {
    try { chk.checked = localStorage.getItem('qimen_steps_practice') === '1'; } catch (e) {}
    stepsState.practice = chk.checked;
    chk.addEventListener('change', () => {
      stepsState.practice = chk.checked;
      stepsState.answered = false;
      try { localStorage.setItem('qimen_steps_practice', chk.checked ? '1' : '0'); } catch (e) {}
      renderStepsView();
    });
  }
}

// ========================================================
// 运筹：以此刻另起一盘，按目的选宫，落地五要素
// ========================================================
const yunchouState = { pan: null, res: null };

function openYunchouModal() {
  if (blockIfPending('运筹')) return;
  openModal('modalYunchou');
}

function runYunchou() {
  const now = new Date();
  const pref = preferredCastSettings();
  try {
    // 运筹盘独立计算：不改主盘、不动起局记录
    const pan = paipan({
      year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(),
      hour: now.getHours(), minute: now.getMinutes(),
      longitude: state.longitude, cityName: state.cityName,
      dingjuMethod: pref.dingjuMethod, paipanMethod: pref.paipanMethod, zishi: pref.zishi
    });
    const purposeKey = document.getElementById('selYunchouPurpose').value;
    const dayGan = document.getElementById('selYunchouDayGan').value;
    const res = analyzeYunchou(pan, purposeKey, dayGan);
    yunchouState.pan = pan;
    yunchouState.res = res;
    renderYunchouResult(pan, res);
  } catch (err) {
    console.error(err);
    showToast('运筹盘计算失败：' + err.message);
  }
}

function renderYunchouResult(pan, res) {
  const box = document.getElementById('yunchouResult');
  if (!box) return;
  const p = pan.pillars;
  const ri = pan.rawInput;
  const head = `<div class="yunchou-pan-head">运筹盘：${ri.year}-${String(ri.month).padStart(2, '0')}-${String(ri.day).padStart(2, '0')} ${String(ri.hour).padStart(2, '0')}:${String(ri.minute).padStart(2, '0')} ｜ ${p.year} ${p.month} ${p.day} ${p.hour} ｜ ${escapeHtml(pan.dingju.desc)} ｜ 当事人日干 ${escapeHtml(res.dayGan)}</div>`;
  const cands = res.candidates.slice(0, 5).map(c => `
    <li class="yunchou-cand ${c.bad.length ? 'is-bad' : ''} ${res.best && res.best.f.g === c.f.g ? 'is-best' : ''}">
      <div class="yunchou-cand-head"><strong>${escapeHtml(c.f.name)} · ${escapeHtml(c.f.direction)}</strong><span>${c.score} 分</span></div>
      <div class="yunchou-cand-symbols">${escapeHtml([c.f.tg + '加' + c.f.dg, c.f.star, c.f.door, c.f.spirit].filter(Boolean).join(' · '))}</div>
      <div class="yunchou-cand-parts">${escapeHtml(c.parts.join('；') || '—')}</div>
      ${c.bad.length ? `<div class="yunchou-cand-bad">不可用：${escapeHtml(c.bad.join('、'))}</div>` : ''}
      ${c.warn.length ? `<div class="yunchou-cand-warn">${escapeHtml(c.warn.join('；'))}</div>` : ''}
    </li>`).join('');
  const plan = res.plan.length ? `
    <div class="yunchou-section-title">落地五要素</div>
    <ul class="yunchou-plan">${res.plan.map(x => `<li><strong>${escapeHtml(x.k)}</strong>${escapeHtml(x.v)}</li>`).join('')}</ul>` : '';
  box.innerHTML = `
    ${head}
    <div class="yunchou-summary ${res.best ? '' : 'is-none'}">${escapeHtml(res.summary)}</div>
    ${cands ? `<div class="yunchou-section-title">候选宫位</div><ul class="yunchou-cands">${cands}</ul>` : ''}
    ${plan}
    <div class="yunchou-section-title">边界</div>
    <ul class="yunchou-notes">${res.notes.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul>`;
}

function initYunchouModal() {
  const sel = document.getElementById('selYunchouPurpose');
  if (sel) {
    sel.innerHTML = YUNCHOU_PURPOSES.map(p => `<option value="${p.key}">${escapeHtml(p.label)}</option>`).join('');
  }
  ['btnOpenYunchou', 'btnBottomYunchou'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', openYunchouModal);
  });
  const btnCast = document.getElementById('btnYunchouCast');
  if (btnCast) btnCast.addEventListener('click', runYunchou);
  const btnToNotes = document.getElementById('btnYunchouToNotes');
  if (btnToNotes) btnToNotes.addEventListener('click', () => {
    if (!yunchouState.res) {
      showToast('先起运筹盘');
      return;
    }
    if (!state.activeRecordId) {
      showToast('当前没有锁定的起局记录：先立即起盘或保存当前格局');
      return;
    }
    const text = yunchouToText(yunchouState.pan, yunchouState.res);
    updateRecord(state.activeRecordId, r => {
      r.notes = r.notes || {};
      r.notes.yunchou = (r.notes.yunchou ? r.notes.yunchou.replace(/\s+$/, '') + '\n\n' : '') + text;
      if (!r.notes.yunchouDate) r.notes.yunchouDate = todayStr();
      rebuildFollowUps(r);
    });
    refreshCaseList(state.activeRecordId);
    showToast('已写入本局断事笔记，并按今天生成第 3、8 天回访');
  });
}
