// 奇门遁甲高精度历法引擎 (Calendar & Astronomical Engine)
// 包含: 儒略日互转、24节气高精度二分查表、农历转换(1900-2100)、纳音、生肖、四柱推算、真太阳时校正

import { SOLAR_TERMS_TABLE, SOLAR_TERMS_NAMES, LUNAR_INFO } from './database.js';

export const TIANGAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
export const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
export const SHENGXIAO = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

export const JIAZI = [];
for (let i = 0; i < 60; i++) {
  JIAZI.push(TIANGAN[i % 10] + DIZHI[i % 12]);
}

export const NAYIN = [
  '海中金', '炉中火', '大林木', '路旁土', '剑锋金',
  '山头火', '涧下水', '城头土', '白蜡金', '杨柳木',
  '泉中水', '屋上土', '霹雳火', '松柏木', '长流水',
  '沙中金', '山下火', '平地木', '壁上土', '金箔金',
  '覆灯火', '天河水', '大驿土', '钗钏金', '桑柘木',
  '大溪水', '沙中土', '天上火', '石榴木', '大海水'
];

export const SHICHEN_DESC = [
  '夜半三更', '鸡鸣四更', '平旦五更', '日出时分',
  '食时时分', '隅中时分', '日中时分', '日映时分',
  '哺时时分', '日入时分', '黄昏时分', '入定时分'
];

export const YUE_ZHI = {
  '立春': '寅', '雨水': '寅', '惊蛰': '卯', '春分': '卯', '清明': '辰', '谷雨': '辰',
  '立夏': '巳', '小满': '巳', '芒种': '午', '夏至': '午', '小暑': '未', '大暑': '未',
  '立秋': '申', '处暑': '申', '白露': '酉', '秋分': '酉', '寒露': '戌', '霜降': '戌',
  '立冬': '亥', '小雪': '亥', '大雪': '子', '冬至': '子', '小寒': '丑', '大寒': '丑'
};

// 儒略日数与公历互转
export function jdn(y, m, d) {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4)
    - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

export function jdnToYmd(j) {
  const a = j + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const dd = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * dd) / 4);
  const mm = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * mm + 2) / 5) + 1;
  const month = mm + 3 - 12 * Math.floor(mm / 10);
  const year = 100 * b + dd - 4800 + Math.floor(mm / 10);
  return { year, month, day };
}

export function jdFromLocal(y, m, d, hour = 0, minute = 0, second = 0, tz = 8) {
  return jdn(y, m, d) - 0.5 + (hour * 3600 + minute * 60 + second) / 86400.0 - tz / 24.0;
}

export function localYmd(jd, tz = 8) {
  const dateJdn = Math.floor(jd + tz / 24.0 + 0.5);
  return jdnToYmd(dateJdn);
}

export function localDateJdn(jd, tz = 8) {
  return Math.floor(jd + tz / 24.0 + 0.5);
}

export function localDatetime(jd, tz = 8) {
  const local = jd + tz / 24.0;
  const n = Math.floor(local + 0.5);
  const frac = local + 0.5 - n;
  let { year, month, day } = jdnToYmd(n);
  let total = Math.round(frac * 86400.0);
  let hour = Math.floor(total / 3600);
  let rem = total % 3600;
  let minute = Math.floor(rem / 60);
  let second = rem % 60;
  if (hour >= 24) {
    hour -= 24;
    const next = jdnToYmd(n + 1);
    year = next.year;
    month = next.month;
    day = next.day;
  }
  return { year, month, day, hour, minute, second };
}

// 24节气查表 (二分查找)
// SOLAR_TERMS_TABLE: [[y, m, d, h, mi, k], ...]
// 将条目预转换为 JD 便于高效二分搜索
const PREPARED_TERMS = SOLAR_TERMS_TABLE.map(t => {
  const [y, m, d, h, mi, k] = t;
  const jd = jdFromLocal(y, m, d, h, mi, 0, 8);
  return {
    year: y, month: m, day: d, hour: h, minute: mi,
    k, name: SOLAR_TERMS_NAMES[k], jd,
    jdn: localDateJdn(jd)
  };
});

// 置闰法节气归属查找 (基于上元符头日 JDN 落在各节气超神起算窗口 [T-9, nextT-9) 之间)
export function getZhirunTerm(shangYuanFutouJdn) {
  let low = 0;
  let high = PREPARED_TERMS.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const startJdn = PREPARED_TERMS[mid].jdn - 9;
    if (startJdn <= shangYuanFutouJdn) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  const idx = Math.max(0, Math.min(high, PREPARED_TERMS.length - 1));
  const term = PREPARED_TERMS[idx];
  const diff = term.jdn - shangYuanFutouJdn;
  let state = '正授';
  if (diff > 0) state = '超神';
  else if (diff < 0) state = '接气';
  return {
    term,
    diff,
    state,
    index: idx
  };
}

export function termAt(jd) {
  let low = 0;
  let high = PREPARED_TERMS.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (PREPARED_TERMS[mid].jd <= jd) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  const idx = high;
  if (idx < 0) {
    return {
      current: PREPARED_TERMS[0],
      next: PREPARED_TERMS[1],
      index: 0
    };
  }
  if (idx >= PREPARED_TERMS.length - 1) {
    return {
      current: PREPARED_TERMS[PREPARED_TERMS.length - 2],
      next: PREPARED_TERMS[PREPARED_TERMS.length - 1],
      index: PREPARED_TERMS.length - 2
    };
  }
  return {
    current: PREPARED_TERMS[idx],
    next: PREPARED_TERMS[idx + 1],
    index: idx
  };
}

export function lichunJd(year) {
  for (let i = 0; i < PREPARED_TERMS.length; i++) {
    if (PREPARED_TERMS[i].year === year && PREPARED_TERMS[i].name === '立春') {
      return PREPARED_TERMS[i].jd;
    }
  }
  return jdFromLocal(year, 2, 4, 12, 0, 0, 8);
}

// 真太阳时计算 (高精度经度差 + 太阳时差方程 EOT)
export function calculateTrueSolarTime(year, month, day, hour, minute, longitude = 116.38) {
  // 1. 经度时差: 每度4分钟 (东经120度为北京时间基准)
  const lonDiffMin = (longitude - 120.0) * 4.0;

  // 2. 时差方程 (Equation of Time):
  const startOfYear = new Date(year, 0, 1);
  const targetDate = new Date(year, month - 1, day);
  const dayOfYear = Math.floor((targetDate - startOfYear) / (24 * 3600 * 1000)) + 1;
  const b = (2 * Math.PI * (dayOfYear - 81)) / 365.0;
  const eotMin = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);

  const totalOffsetMin = lonDiffMin + eotMin;
  
  // 转化为实际日期时间
  const totalOriginalMin = hour * 60 + minute + totalOffsetMin;
  let adjustedHour = Math.floor(totalOriginalMin / 60);
  let adjustedMinute = Math.round(totalOriginalMin % 60);

  let targetYear = year;
  let targetMonth = month;
  let targetDay = day;

  if (adjustedMinute < 0) {
    adjustedMinute += 60;
    adjustedHour -= 1;
  } else if (adjustedMinute >= 60) {
    adjustedMinute -= 60;
    adjustedHour += 1;
  }

  let dayDelta = 0;
  if (adjustedHour < 0) {
    adjustedHour += 24;
    dayDelta = -1;
  } else if (adjustedHour >= 24) {
    adjustedHour -= 24;
    dayDelta = 1;
  }

  if (dayDelta !== 0) {
    const curJdn = jdn(year, month, day) + dayDelta;
    const ymd = jdnToYmd(curJdn);
    targetYear = ymd.year;
    targetMonth = ymd.month;
    targetDay = ymd.day;
  }

  return {
    year: targetYear,
    month: targetMonth,
    day: targetDay,
    hour: adjustedHour,
    minute: adjustedMinute,
    offsetMin: totalOffsetMin
  };
}

// 农历计算 (1900-2100)
const LUNAR_MONTH_NAMES = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const LUNAR_DAY_NAMES = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'
];

export function getLunarDate(solarYear, solarMonth, solarDay) {
  // 基准日: 1900年1月31日 为 农历 庚子年正月初一
  const baseJdn = jdn(1900, 1, 31);
  let offset = jdn(solarYear, solarMonth, solarDay) - baseJdn;

  let iYear = 1900;
  let daysInYear = 0;

  while (iYear <= 2100 && offset > 0) {
    daysInYear = getLunarYearDays(iYear);
    if (offset < daysInYear) break;
    offset -= daysInYear;
    iYear++;
  }

  const leapMonth = getLeapMonth(iYear);
  let isLeap = false;
  let iMonth = 1;

  for (iMonth = 1; iMonth <= 12; iMonth++) {
    // 闰月在前或在后
    if (leapMonth > 0 && iMonth === (leapMonth + 1) && !isLeap) {
      --iMonth;
      isLeap = true;
      const daysInLeap = getLeapDays(iYear);
      if (offset < daysInLeap) break;
      offset -= daysInLeap;
    } else {
      const daysInMonth = getLunarMonthDays(iYear, iMonth);
      if (offset < daysInMonth) break;
      offset -= daysInMonth;
    }
    if (isLeap && iMonth === leapMonth) {
      isLeap = false;
    }
  }

  const lunarDay = offset + 1;
  const monthDays = isLeap ? getLeapDays(iYear) : getLunarMonthDays(iYear, iMonth);
  const isBigMonth = monthDays === 30;

  // 年干支 (农历正月通常对应春季)
  const ganzhiYearIdx = (iYear - 4) % 60;
  const yearGanzhi = JIAZI[(ganzhiYearIdx + 60) % 60];
  const shengxiao = SHENGXIAO[(iYear - 4) % 12];
  const nayin = NAYIN[Math.floor(((ganzhiYearIdx + 60) % 60) / 2)];

  return {
    lunarYear: iYear,
    lunarMonth: iMonth,
    lunarMonthName: (isLeap ? '闰' : '') + LUNAR_MONTH_NAMES[iMonth - 1] + '月' + (isBigMonth ? '大' : '小'),
    lunarDay,
    lunarDayName: LUNAR_DAY_NAMES[lunarDay - 1] || `${lunarDay}日`,
    isLeap,
    isBigMonth,
    yearGanzhi,
    shengxiao,
    nayin,
    fullText: `${yearGanzhi}年 ${isLeap ? '闰' : ''}${LUNAR_MONTH_NAMES[iMonth - 1]}月${isBigMonth ? '大' : '小'} ${LUNAR_DAY_NAMES[lunarDay - 1]}`
  };
}

function getLunarYearDays(y) {
  let sum = 348;
  for (let i = 0x8000; i > 0x8; i >>= 1) {
    sum += (LUNAR_INFO[y - 1900] & i) ? 1 : 0;
  }
  return sum + getLeapDays(y);
}

function getLeapDays(y) {
  if (getLeapMonth(y)) {
    return (LUNAR_INFO[y - 1900] & 0x10000) ? 30 : 29;
  }
  return 0;
}

function getLeapMonth(y) {
  return LUNAR_INFO[y - 1900] & 0xf;
}

function getLunarMonthDays(y, m) {
  return (LUNAR_INFO[y - 1900] & (0x10000 >> m)) ? 30 : 29;
}

// 干支系统与四柱推算
export function dayIdxOfJdn(dateJdn) {
  return ((dateJdn + 49) % 60 + 60) % 60;
}

export function dayGanzhi(dateJdn) {
  return JIAZI[dayIdxOfJdn(dateJdn)];
}

const WUSHUDUN = [0, 2, 4, 6, 8, 0, 2, 4, 6, 8]; // 甲己起甲(0), 乙庚起丙(2)...

export function hourGanzhi(dayIdx, hour) {
  const shi = Math.floor((hour + 1) / 2) % 12;
  const ganIdx = (WUSHUDUN[dayIdx % 10] + shi) % 10;
  return TIANGAN[ganIdx] + DIZHI[shi];
}

export function hourPillar(dateJdn, hour, zishi = 'split') {
  const dayIdx = dayIdxOfJdn(dateJdn);
  const nextIdx = dayIdxOfJdn(dateJdn + 1);
  if (hour === 23) {
    if (zishi === 'merge') {
      return { ganzhi: hourGanzhi(nextIdx, 23), dayIdxUsed: nextIdx };
    }
    return { ganzhi: hourGanzhi(nextIdx, 23), dayIdxUsed: dayIdx };
  }
  return { ganzhi: hourGanzhi(dayIdx, hour), dayIdxUsed: dayIdx };
}

export function yearGanzhiOf(jd) {
  let y = localYmd(jd).year;
  const lc = lichunJd(y);
  if (jd < lc) {
    y -= 1;
  }
  const idx = ((y - 4) % 60 + 60) % 60;
  return JIAZI[idx];
}

export function monthGanzhi(yearGan, yueZhi) {
  const yinGan = (TIANGAN.indexOf(yearGan) % 5) * 2 + 2;
  const offset = ((DIZHI.indexOf(yueZhi) - DIZHI.indexOf('寅')) % 12 + 12) % 12;
  return TIANGAN[(yinGan + offset) % 10] + yueZhi;
}

// 旬首与旬空
const XUN_SHOU_TABLE = [];
const KONGWANG_TABLE = [];

for (let i = 0; i < 60; i++) {
  const s = i - (i % 10);
  XUN_SHOU_TABLE.push(JIAZI[s]);
  const have = new Set();
  for (let k = 0; k < 10; k++) {
    have.add(DIZHI[(s + k) % 12]);
  }
  let kw = '';
  for (let z of DIZHI) {
    if (!have.has(z)) kw += z;
  }
  KONGWANG_TABLE.push(kw);
}

export function xunOf(gz) {
  const idx = JIAZI.indexOf(gz);
  return idx >= 0 ? XUN_SHOU_TABLE[idx] : '';
}

export function kongwangOf(gz) {
  const idx = JIAZI.indexOf(gz);
  return idx >= 0 ? KONGWANG_TABLE[idx] : '';
}

// 驿马星 (按支查)
export const MA_STAR = {
  '寅': '申', '午': '申', '戌': '申',
  '申': '寅', '子': '寅', '辰': '寅',
  '巳': '亥', '酉': '亥', '丑': '亥',
  '亥': '巳', '卯': '巳', '未': '巳'
};

// 旬首仪 (甲子戊, 甲戌己, 甲申庚, 甲午辛, 甲辰壬, 甲寅癸)
export const XUN_SHOU_YI = {
  '甲子': '戊',
  '甲戌': '己',
  '甲申': '庚',
  '甲午': '辛',
  '甲辰': '壬',
  '甲寅': '癸'
};
