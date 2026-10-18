// 奇门遁甲核心排盘引擎 (Qimen Dun Jia Calculation Engine)
// 支持:
// 1. 三种定局法: 拆补法、置闰法(含超神/正授/接气/置闰)、茅山法、手动指定局数、报数起局
// 2. 两种排盘法: 排宫法(转盘八宫环)、飞宫法(九门九星九神九宫飞布)
// 3. 真太阳时经度联动
// 4. 四柱干支、旬首、值符值使、日空时空、天马/驿马、天禽寄坤二
// 5. 暗干暗神 (默认隐藏，支持显隐切换)
// 6. 81十干克应、八门动静克应、九星值时克应智能匹配
// 7. 纯文本与HTML排盘导出格式 (100%复刻原版复制格式)

import {
  jdn, jdnToYmd, jdFromLocal, localDateJdn, localDatetime,
  termAt, getZhirunTerm, lichunJd, calculateTrueSolarTime, getLunarDate,
  dayIdxOfJdn, dayGanzhi, hourPillar, yearGanzhiOf, monthGanzhi,
  xunOf, kongwangOf, MA_STAR, XUN_SHOU_YI,
  TIANGAN, DIZHI, JIAZI, SHICHEN_DESC, YUE_ZHI
} from './calendar.js';

import {
  SHIGAN_KEYING, BAMEN_JING_KEYING, BAMEN_DONG_KEYING,
  BAMEN_GAN_KEYING, JIUXING_KEYING
} from './database.js';

// 八宫环 (后天八卦旋转轨道): 坎1 艮8 震3 巽4 离9 坤2 兑7 乾6
export const BAGUA_RING = [1, 8, 3, 4, 9, 2, 7, 6];
export const RING_INDEX = { 1: 0, 8: 1, 3: 2, 4: 3, 9: 4, 2: 5, 7: 6, 6: 7 };

// 洛书九宫数序
export const JIUGONG_SEQ = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export const GONG_CN = {
  1: '坎', 2: '坤', 3: '震', 4: '巽', 5: '中',
  6: '乾', 7: '兑', 8: '艮', 9: '离'
};

export const GONG_DIZHI = {
  1: ['子'], 2: ['未', '申'], 3: ['卯'], 4: ['辰', '巳'],
  5: [],
  6: ['戌', '亥'], 7: ['酉'], 8: ['丑', '寅'], 9: ['午']
};

export const HE_GAN_MAP = {
  '甲': '己', '己': '甲',
  '乙': '庚', '庚': '乙',
  '丙': '辛', '辛': '丙',
  '丁': '壬', '壬': '丁',
  '戊': '癸', '癸': '戊'
};

// 判定宫位是否匹配所选取的用神
export function checkPalaceMatchYongShen(pan, g, yongShenList) {
  if (!pan || !yongShenList || yongShenList.length === 0) {
    return { matched: false, items: [], hasZhifu: false };
  }
  // 排宫法(转盘)中五宫寄坤二，无独立神门星，中宫文字不参与用神选取
  if (g === 5 && pan.paipanMethod === 'zhuan') {
    return { matched: false, items: [], hasZhifu: false };
  }

  const tg = (pan.tianpanGan && pan.tianpanGan[g]) || '';
  const tj = (pan.tianpanJigan && pan.tianpanJigan[g]) || '';
  const door = (pan.tianpanDoor && pan.tianpanDoor[g]) || '';
  const star = (pan.tianpanStar && pan.tianpanStar[g]) || '';
  const spirit = (pan.tianpanSpirit && pan.tianpanSpirit[g]) || '';
  const hasMa = !!(pan.palaceFlags && pan.palaceFlags[g] && pan.palaceFlags[g].hasMa);
  const isKong = !!(pan.palaceFlags && pan.palaceFlags[g] && pan.palaceFlags[g].isKong);
  const gongNames = [String(g), GONG_CN[g] || '', `${GONG_CN[g]}宫`];

  const dayGan = pan.dayGan;
  const shiGan = pan.shiGan;
  const yearGan = pan.pillars && pan.pillars.year ? pan.pillars.year[0] : '';
  const monthGan = pan.pillars && pan.pillars.month ? pan.pillars.month[0] : '';
  const heGan = HE_GAN_MAP[dayGan] || '';

  const matchedItems = [];

  for (const ys of yongShenList) {
    let hit = false;
    if (ys === '日干') {
      if (tg === dayGan || tj === dayGan) hit = true;
    } else if (ys === '时干') {
      if (tg === shiGan || tj === shiGan) hit = true;
    } else if (ys === '年干') {
      if (tg === yearGan || tj === yearGan) hit = true;
    } else if (ys === '月干') {
      if (tg === monthGan || tj === monthGan) hit = true;
    } else if (ys === '合干') {
      if (heGan && (tg === heGan || tj === heGan)) hit = true;
    } else if (['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'].includes(ys)) {
      if (tg === ys || tj === ys) hit = true;
    } else if (ys === '值符' || ys === '直符') {
      if (spirit === '值符') hit = true;
    } else if (['螣蛇', '太阴', '六合', '白虎', '玄武', '九地', '九天'].includes(ys)) {
      if (spirit === ys) hit = true;
    } else if (['天蓬', '天芮', '天冲', '天辅', '天禽', '天心', '天柱', '天任', '天英'].includes(ys) || ys.startsWith('天')) {
      if (star.includes(ys)) hit = true;
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

  return {
    matched: matchedItems.length > 0,
    items: matchedItems,
    hasZhifu: matchedItems.includes('值符') || matchedItems.includes('直符')
  };
}

// 判定当前用神与所问事项是否代表 人 或 物
export function isYongShenPersonOrObject(selectedList, question, natureSetting) {
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

// 地盘基盘全息属性字典 (对应奇门基础地盘教学图: 洛书数理、五行、八卦爻象、地支配属、卦德名意物象)
export const DIPAN_PALACE_INFO = {
  4: {
    num: 4,
    numCn: '四',
    name: '巽四宫',
    bagua: '巽',
    element: '木',
    direction: '东南',
    trigram: '☴',
    trigramDesc: '巽,风,入',
    descItems: ['巽', '风', '入'],
    dizhi: ['巳', '辰'],
    dizhiOrder: ['巳', '辰'],
    detail: {
      nature: '阴木',
      organ: '股、胆、神经、呼吸系统',
      image: '风、长女、进退不果、号令、齐也、深入潜入',
      dizhiDesc: '巳(大驿火)、辰(草泽水库)'
    }
  },
  9: {
    num: 9,
    numCn: '九',
    name: '离九宫',
    bagua: '离',
    element: '火',
    direction: '南方',
    trigram: '☲',
    trigramDesc: '离,太阳,丽',
    descItems: ['离', '太阳', '丽'],
    dizhi: ['午'],
    dizhiOrder: ['午'],
    detail: {
      nature: '阴火',
      organ: '目、心、血液、头面',
      image: '火、中女、日、电、文明、丽也、附丽虚华',
      dizhiDesc: '午(烽堠火、正南方)'
    }
  },
  2: {
    num: 2,
    numCn: '二',
    name: '坤二宫',
    bagua: '坤',
    element: '土',
    direction: '西南',
    trigram: '☷',
    trigramDesc: '坤,地,顺',
    descItems: ['坤', '地', '顺'],
    dizhi: ['未', '申'],
    dizhiOrder: ['未', '申'],
    detail: {
      nature: '阴土',
      organ: '腹、脾胃、肌肤、右肩',
      image: '地、母、老妇、顺也、包容厚德、阴暗柔顺',
      dizhiDesc: '未(花园木库)、申(传送金水)'
    }
  },
  3: {
    num: 3,
    numCn: '三',
    name: '震三宫',
    bagua: '震',
    element: '木',
    direction: '东',
    trigram: '☳',
    trigramDesc: '震,雷,动',
    descItems: ['震', '雷', '动'],
    dizhi: ['卯'],
    dizhiOrder: ['卯'],
    detail: {
      nature: '阳木',
      organ: '足、肝、神经、左胁',
      image: '雷、长男、动也、奋发、震惊、躁动有声',
      dizhiDesc: '卯(琼林木、正东方)'
    }
  },
  5: {
    num: 5,
    numCn: '五',
    name: '中五宫',
    bagua: '中',
    element: '土',
    direction: '中',
    trigram: '',
    trigramDesc: '',
    descItems: [],
    dizhi: [],
    dizhiOrder: [],
    detail: {
      nature: '中阳土 (寄坤二宫)',
      organ: '脾胃、腹心、中枢神经',
      image: '皇极、中央戊己土、寄生坤宫、无定卦',
      dizhiDesc: '无地支（统摄八方）'
    }
  },
  7: {
    num: 7,
    numCn: '七',
    name: '兑七宫',
    bagua: '兑',
    element: '金',
    direction: '西',
    trigram: '☱',
    trigramDesc: '兑,海,悦',
    descItems: ['兑', '海', '悦'],
    dizhi: ['酉'],
    dizhiOrder: ['酉'],
    detail: {
      nature: '阴金',
      organ: '口、舌、齿、咽喉、右胁',
      image: '泽、少女、悦也、口舌、海、残缺破损',
      dizhiDesc: '酉(寺钟金、正西方)'
    }
  },
  8: {
    num: 8,
    numCn: '八',
    name: '艮八宫',
    bagua: '艮',
    element: '土',
    direction: '东北',
    trigram: '☶',
    trigramDesc: '艮,山,止',
    descItems: ['艮', '山', '止'],
    dizhi: ['寅', '丑'],
    dizhiOrder: ['寅', '丑'],
    detail: {
      nature: '阳土',
      organ: '手、指、背、鼻、左足',
      image: '山、少男、止也、安稳、迟滞、阻止阻隔',
      dizhiDesc: '寅(广谷木)、丑(柳岸金库)'
    }
  },
  1: {
    num: 1,
    numCn: '一',
    name: '坎一宫',
    bagua: '坎',
    element: '水',
    direction: '北',
    trigram: '☵',
    trigramDesc: '坎,月亮,陷',
    descItems: ['坎', '月亮', '陷'],
    dizhi: ['子'],
    dizhiOrder: ['子'],
    detail: {
      nature: '阳水',
      organ: '耳、肾、膀胱、泌尿生殖系统',
      image: '水、中男、月亮、陷也、险陷曲折、智慧流动',
      dizhiDesc: '子(墨池水、正北方)'
    }
  },
  6: {
    num: 6,
    numCn: '六',
    name: '乾六宫',
    bagua: '乾',
    element: '金',
    direction: '西北',
    trigram: '☰',
    trigramDesc: '乾,天,健',
    descItems: ['乾', '天', '健'],
    dizhi: ['戌', '亥'],
    dizhiOrder: ['戌', '亥'],
    detail: {
      nature: '阳金',
      organ: '首、脑、骨、肺、右足',
      image: '天、父、老男、健也、自强不息、圆满高贵',
      dizhiDesc: '戌(烧原火土库)、亥(登明水)'
    }
  }
};

export const STAR_HOME = {
  1: '天蓬', 2: '天芮', 3: '天冲', 4: '天辅', 5: '天禽',
  6: '天心', 7: '天柱', 8: '天任', 9: '天英'
};

export const DOOR_HOME = {
  1: '休门', 2: '死门', 3: '伤门', 4: '杜门',
  6: '开门', 7: '惊门', 8: '生门', 9: '景门'
};

export const FEIPAN_DOORS = {
  1: '休门', 2: '死门', 3: '伤门', 4: '杜门', 5: '中门',
  6: '开门', 7: '惊门', 8: '生门', 9: '景门'
};

export const SPIRITS_ZHUAN = ['值符', '螣蛇', '太阴', '六合', '白虎', '玄武', '九地', '九天'];
export const SPIRITS_FEI = ['值符', '螣蛇', '太阴', '六合', '勾陈', '朱雀', '九地', '九天', '太常'];

export const YIQI_SEQ = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'];

// 节气三元局数表: (上, 中, 下)
export const JU_TABLE = {
  '冬至': [1, 7, 4], '惊蛰': [1, 7, 4], '小寒': [2, 8, 5], '大寒': [3, 9, 6],
  '春分': [3, 9, 6], '立春': [8, 5, 2], '雨水': [9, 6, 3], '清明': [4, 1, 7],
  '立夏': [4, 1, 7], '谷雨': [5, 2, 8], '小满': [5, 2, 8], '芒种': [6, 3, 9],
  '夏至': [9, 3, 6], '白露': [9, 3, 6], '小暑': [8, 2, 5], '大暑': [7, 1, 4],
  '秋分': [7, 1, 4], '立秋': [2, 5, 8], '处暑': [1, 4, 7], '寒露': [6, 9, 3],
  '立冬': [6, 9, 3], '霜降': [5, 8, 2], '小雪': [5, 8, 2], '大雪': [4, 7, 1]
};

export const YANG_JIEQI = new Set([
  '冬至', '小寒', '大寒', '立春', '雨水', '惊蛰',
  '春分', '清明', '谷雨', '立夏', '小满', '芒种'
]);

// 符头元序: 子午卯酉(上元0), 寅申巳亥(中元1), 辰戌丑未(下元2)
export function futouYuan(dayIdx) {
  const futouIdx = ((dayIdx - (dayIdx % 5)) % 60 + 60) % 60;
  const zhi = futouIdx % 12;
  let yuan = 0;
  if ([0, 3, 6, 9].includes(zhi)) yuan = 0;       // 子午卯酉 上元
  else if ([2, 5, 8, 11].includes(zhi)) yuan = 1; // 寅申巳亥 中元
  else yuan = 2;                                   // 辰戌丑未 下元
  return {
    yuan,
    yuanName: ['上元', '中元', '下元'][yuan],
    futouIdx,
    futouGanzhi: JIAZI[futouIdx],
    dayInYuan: (dayIdx % 5) + 1
  };
}

// ----------------- 定局计算 -----------------
export function calculateDingju({
  method = 'zhirun', // 'zhirun' | 'chaibu' | 'maoshan' | 'manual'
  termInfo,
  targetDayJdn,
  targetJd,
  dayGzIdx,
  manualJu = null // e.g. { dun: '阴', ju: 5 }
}) {
  if (manualJu) {
    const isBaoshu = manualJu.type === 'baoshu';
    const isManual = manualJu.type === 'manual';
    const djMethodName = manualJu.dingjuMethod ? (manualJu.dingjuMethod === 'chaibu' ? '拆补' : (manualJu.dingjuMethod === 'maoshan' ? '茅山' : '置闰')) : '';
    const descSuffix = djMethodName ? ` · ${djMethodName}法` : '';
    const prefix = isBaoshu ? '报数起局' : (isManual ? '手动录入' : '指定局数');
    const stateName = isBaoshu ? '报数' : (isManual ? (djMethodName ? `${djMethodName}录入` : '手动') : '指定');
    const yuanName = isBaoshu ? '报数局' : (isManual ? '录入局' : '指定局');
    return {
      dun: manualJu.dun,
      ju: manualJu.ju,
      yuanName,
      termName: termInfo.current.name,
      state: stateName,
      desc: `${prefix}${manualJu.dun}${['一','二','三','四','五','六','七','八','九'][manualJu.ju - 1]}局${descSuffix}`
    };
  }

  const currentTerm = termInfo.current;
  const fy = futouYuan(dayGzIdx);

  if (method === 'chaibu') {
    // 拆补法 (原版软件默认):
    // 节气随当日所在的公历严格交节区间 (交节即换节气)，上中下元随符头地支 (子午卯酉上元、寅申巳亥中元、辰戌丑未下元)
    const dun = YANG_JIEQI.has(currentTerm.name) ? '阳' : '阴';
    const ju = JU_TABLE[currentTerm.name][fy.yuan];
    return {
      dun,
      ju,
      yuanName: fy.yuanName,
      termName: currentTerm.name,
      state: '拆补',
      desc: `${currentTerm.name}${fy.yuanName}${dun}${['一','二','三','四','五','六','七','八','九'][ju - 1]}局`
    };
  }

  if (method === 'maoshan') {
    // 茅山法: 从交节时刻起算，严格每120小时(5整天)为一元
    const hoursDiff = (targetJd - currentTerm.jd) * 24;
    let yuan = 0;
    if (hoursDiff < 120) yuan = 0;
    else if (hoursDiff < 240) yuan = 1;
    else yuan = 2;
    const yuanName = ['上元', '中元', '下元'][yuan];
    const dun = YANG_JIEQI.has(currentTerm.name) ? '阳' : '阴';
    const ju = JU_TABLE[currentTerm.name][yuan];
    return {
      dun,
      ju,
      yuanName,
      termName: currentTerm.name,
      state: '茅山',
      desc: `${currentTerm.name}${yuanName}${dun}${['一','二','三','四','五','六','七','八','九'][ju - 1]}局`
    };
  }

  // 置闰法 (Zhirun):
  // 寻找支配当前 15 天周期的上元符头日 JDN:
  const curFutouJdn = targetDayJdn - (dayGzIdx % 5);
  const shangYuanFutouJdn = curFutouJdn - (fy.yuan * 5);
  const zhirunInfo = getZhirunTerm(shangYuanFutouJdn);
  const effectiveTermName = zhirunInfo.term.name;
  const dun = YANG_JIEQI.has(effectiveTermName) ? '阳' : '阴';
  const ju = JU_TABLE[effectiveTermName][fy.yuan];

  return {
    dun,
    ju,
    yuanName: fy.yuanName,
    termName: effectiveTermName,
    state: zhirunInfo.state,
    desc: `${effectiveTermName}${fy.yuanName}${dun}${['一','二','三','四','五','六','七','八','九'][ju - 1]}局`
  };
}

// ----------------- 地盘与旋转 -----------------
export function layoutDipan(dun, ju) {
  const order = dun === '阳' ? JIUGONG_SEQ : [...JIUGONG_SEQ].reverse();
  const start = order.indexOf(ju);
  const dipan = {};
  for (let i = 0; i < 9; i++) {
    const gong = order[(start + i) % 9];
    dipan[gong] = YIQI_SEQ[i];
  }
  return dipan;
}

export function rotateBagua(mapping, shift) {
  const result = {};
  for (let g of BAGUA_RING) {
    if (mapping[g] !== undefined) {
      const newGong = BAGUA_RING[(RING_INDEX[g] + shift + 8) % 8];
      result[newGong] = mapping[g];
    }
  }
  return result;
}

export function locateInDipan(dipan, gan, foldZhong = true) {
  for (let g of JIUGONG_SEQ) {
    if (dipan[g] === gan) {
      if (foldZhong && g === 5) return 2; // 中五寄坤二
      return g;
    }
  }
  return 2;
}

// 飞宫法 (飞盘) 沿洛书九宫飞布
export function flyNine(sequence, startGong, dun) {
  const result = {};
  const startIndex = JIUGONG_SEQ.indexOf(startGong);
  for (let i = 0; i < 9; i++) {
    const targetIdx = dun === '阳'
      ? (startIndex + i) % 9
      : (startIndex - i + 9) % 9;
    const gong = JIUGONG_SEQ[targetIdx];
    result[gong] = sequence[i];
  }
  return result;
}

// 暗干飞布
export function layoutAngan(dun, startGan, dipan, startGong) {
  const ganIdx0 = YIQI_SEQ.indexOf(startGan);
  const pos0 = JIUGONG_SEQ.indexOf(startGong);
  const result = {};
  for (let i = 0; i < 9; i++) {
    const gan = YIQI_SEQ[(ganIdx0 + i) % 9];
    const p = dun === '阳' ? (pos0 + i) % 9 : (pos0 - i + 9) % 9;
    let g = JIUGONG_SEQ[p];
    if (dipan[g] === startGan && gan !== startGan) {
      g = 5; // 入中
    }
    if (!result[g]) result[g] = [];
    result[g].push(gan);
  }
  return result;
}

// ----------------- 主排盘入口 -----------------
export function paipan({
  year, month, day, hour = 0, minute = 0,
  longitude = 116.38,
  dingjuMethod = 'zhirun', // 'zhirun' | 'chaibu' | 'maoshan' | 'manual'
  paipanMethod = 'zhuan',  // 'zhuan' (排宫法) | 'fei' (飞宫法)
  designatedJu = null,    // { dun: '阴', ju: 5 }
  zishi = 'split',        // 'split' | 'merge'
  showAngan = false,
  cityName = '北京 天安门',
  customPillars = null    // { year, month, day, hour }
}) {
  // 1. 真太阳时
  const trueTime = calculateTrueSolarTime(year, month, day, hour, minute, longitude);

  // 2. 儒略日与瞬时节气
  const jd = jdFromLocal(year, month, day, hour, minute, 0, 8);
  const termInfo = termAt(jd);

  // 3. 历法日 JDN (晚子时归并处理)
  const baseDateJdn = localDateJdn(jd);
  let effDateJdn = baseDateJdn;
  let effHour = hour;
  if (hour === 23 && zishi === 'merge') {
    effDateJdn = baseDateJdn + 1;
    effHour = 0;
  }

  // 4. 四柱干支推算 (若有自定义四柱优先使用)
  const dayGz = (customPillars && customPillars.day) ? customPillars.day : dayGanzhi(effDateJdn);
  const dayGzIdx = (customPillars && customPillars.day) ? JIAZI.indexOf(customPillars.day) : dayIdxOfJdn(effDateJdn);
  const hourP = hourPillar(effDateJdn, effHour, zishi);
  const hourGz = (customPillars && customPillars.hour) ? customPillars.hour : hourP.ganzhi;
  const yearGz = (customPillars && customPillars.year) ? customPillars.year : yearGanzhiOf(jd);
  const yueZhi = YUE_ZHI[termInfo.current.name];
  const monthGz = (customPillars && customPillars.month) ? customPillars.month : monthGanzhi(yearGz[0], yueZhi);

  // 5. 农历月日
  const lunar = getLunarDate(year, month, day);

  // 6. 定局
  const dj = calculateDingju({
    method: dingjuMethod,
    termInfo,
    targetDayJdn: effDateJdn,
    targetJd: jd,
    dayGzIdx,
    manualJu: designatedJu
  });
  const dun = dj.dun;
  const ju = dj.ju;

  // 7. 地盘
  const dipan = layoutDipan(dun, ju);

  // 8. 旬首、值符星、值使门
  const xun = xunOf(hourGz);
  const shouYi = XUN_SHOU_YI[xun];
  const shouYiRawGong = locateInDipan(dipan, shouYi, false);
  const fuGong = shouYiRawGong === 5 ? 2 : shouYiRawGong;
  const starFu = shouYiRawGong === 5 ? '天禽' : STAR_HOME[fuGong];
  const doorShi = DOOR_HOME[fuGong];

  // 时干在地盘落宫 (甲遁于六仪)
  const shiGan = hourGz[0];
  const shiGanForLocate = shiGan === '甲' ? shouYi : shiGan;
  const shiGong = locateInDipan(dipan, shiGanForLocate, true);

  // 值使门落宫: 旬首地支到时辰地支的步数，九宫序走步数
  const xunZhi = xun[1];
  const hourZhi = hourGz[1];
  const zhiSteps = ((DIZHI.indexOf(hourZhi) - DIZHI.indexOf(xunZhi)) % 12 + 12) % 12;
  const fuPosInSeq = JIUGONG_SEQ.indexOf(fuGong);
  let doorShiTargetPos = dun === '阳'
    ? (fuPosInSeq + zhiSteps) % 9
    : (fuPosInSeq - zhiSteps % 9 + 9) % 9;
  let doorShiGong = JIUGONG_SEQ[doorShiTargetPos];
  if (paipanMethod === 'zhuan' && doorShiGong === 5) {
    doorShiGong = 2; // 转盘中五寄坤二
  }

  // 9. 天盘、人盘、神盘排布
  let tianpanGan = {};
  let tianpanStar = {};
  let tianpanDoor = {};
  let tianpanSpirit = {};
  let tianpanJigan = {}; // 天禽寄干

  if (paipanMethod === 'zhuan') {
    // --- 转盘排宫法 ---
    // 天盘旋转量
    const tianShift = (RING_INDEX[shiGong] - RING_INDEX[fuGong] + 8) % 8;
    tianpanGan = rotateBagua(dipan, tianShift);
    
    // 九星旋转
    const starMap = {};
    for (let g of BAGUA_RING) {
      starMap[g] = STAR_HOME[g];
    }
    tianpanStar = rotateBagua(starMap, tianShift);
    // 天禽随天芮一同旋转
    for (let g of BAGUA_RING) {
      if (tianpanStar[g] === '天芮') {
        tianpanStar[g] = '天芮、天禽';
        break;
      }
    }
    // 天盘寄干 (随坤二旋转)
    const jiganGong = BAGUA_RING[(RING_INDEX[2] + tianShift + 8) % 8];
    tianpanJigan[jiganGong] = dipan[5];

    // 八门旋转量
    const menShift = (RING_INDEX[doorShiGong] - RING_INDEX[fuGong] + 8) % 8;
    tianpanDoor = rotateBagua(DOOR_HOME, menShift);

    // 八神旋转 (值符随时干落宫，阳顺阴逆走八宫环)
    const s0 = RING_INDEX[shiGong];
    const spiritStep = dun === '阳' ? 1 : -1;
    for (let i = 0; i < 8; i++) {
      const g = BAGUA_RING[(s0 + spiritStep * i + 80) % 8];
      tianpanSpirit[g] = SPIRITS_ZHUAN[i];
    }
  } else {
    // --- 飞盘飞宫法 ---
    // 九星飞布 (以值符星飞到时干宫起飞)
    const starOrder = ['天蓬', '天芮', '天冲', '天辅', '天禽', '天心', '天柱', '天任', '天英'];
    const starFuIdx = starOrder.indexOf(STAR_HOME[shouYiRawGong]);
    const starSeq = [];
    for (let i = 0; i < 9; i++) {
      starSeq.push(starOrder[(starFuIdx + i) % 9]);
    }
    tianpanStar = flyNine(starSeq, shiGong, dun);

    // 天盘干飞布
    const tianGanSeq = [];
    const shouYiIdx = YIQI_SEQ.indexOf(shouYi);
    for (let i = 0; i < 9; i++) {
      tianGanSeq.push(YIQI_SEQ[(shouYiIdx + i) % 9]);
    }
    tianpanGan = flyNine(tianGanSeq, shiGong, dun);

    // 九门飞布 (值使门飞至门落宫)
    const doorOrder = ['休门', '死门', '伤门', '杜门', '中门', '开门', '惊门', '生门', '景门'];
    const doorShiIdx = doorOrder.indexOf(FEIPAN_DOORS[shouYiRawGong]);
    const doorSeq = [];
    for (let i = 0; i < 9; i++) {
      doorSeq.push(doorOrder[(doorShiIdx + i) % 9]);
    }
    tianpanDoor = flyNine(doorSeq, doorShiGong, dun);

    // 九神飞布
    tianpanSpirit = flyNine(SPIRITS_FEI, shiGong, dun);
  }

  // 10. 暗干排布
  const anganStartGan = shiGan === '甲' ? shouYi : shiGan;
  const anganMap = layoutAngan(dun, anganStartGan, dipan, doorShiGong);

  // 11. 空亡与马星
  const dayKw = kongwangOf(dayGz);
  const hourKw = kongwangOf(hourGz);
  const yearKw = kongwangOf(yearGz);
  const monthKw = kongwangOf(monthGz);
  const hourMa = MA_STAR[hourGz[1]];

  // 12. 宫位标记 (空亡、马星)
  // 原版软件中，九宫格中的 ○ 标记专门对应【时柱旬空】
  const palaceFlags = {};
  for (let g of JIUGONG_SEQ) {
    palaceFlags[g] = {
      isKong: GONG_DIZHI[g].some(z => hourKw.includes(z)),
      isHourKong: GONG_DIZHI[g].some(z => hourKw.includes(z)),
      isDayKong: GONG_DIZHI[g].some(z => dayKw.includes(z)),
      hasMa: GONG_DIZHI[g].includes(hourMa)
    };
  }

  // 12. 星期
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const weekDayStr = weekDays[new Date(year, month - 1, day).getDay()];

  // 时辰时分描述
  const shiIndex = Math.floor((hour + 1) / 2) % 12;
  const shichenTitle = SHICHEN_DESC[shiIndex];

  return {
    rawInput: { year, month, day, hour, minute, longitude, cityName },
    trueTime,
    weekDay: weekDayStr,
    shichenTitle,
    pillars: {
      year: yearGz,
      month: monthGz,
      day: dayGz,
      hour: hourGz
    },
    kongwang: {
      year: yearKw,
      month: monthKw,
      day: dayKw,
      hour: hourKw
    },
    lunar,
    termInfo,
    dingju: dj,
    dun,
    ju,
    xun,
    shouYi,
    fuGong,
    starFu,
    doorShi,
    doorShiGong,
    shiGong,
    shiGan,
    dayGan: dayGz[0],
    paipanMethod,
    dingjuMethod,
    showAngan,
    hourMa,
    dipan,
    tianpanGan,
    tianpanStar,
    tianpanDoor,
    tianpanSpirit,
    tianpanJigan,
    anganMap,
    palaceFlags,
    wuBuYu: checkWuBuYuShi(dayGz, hourGz)
  };
}

// 叶鸿生《九宫定位记忆法》全息基盘数据字典
export const JIUGONG_MEMORY_DATA = {
  4: {
    gongNum: 4,
    gongName: '巽四宫',
    bagua: '巽',
    direction: '东南',
    star: '天辅',
    door: '杜门',
    gongDesc: '不稳定、漂浮、变动、晃动',
    starDesc: '人物（辅助从属／无主见）；事物（教育文化知识／辅助器械）',
    doorDesc: '人物（关闭隐藏）；事物（封堵堵塞）',
    tianganDesc: '甲: 外观（高大粗直）、材质（木质粗壮）；乙: 外观（长条柔韧）、材质（植物纤维）',
    dizhiDesc: '辰: 壬水库；巳: 金长生'
  },
  9: {
    gongNum: 9,
    gongName: '离九宫',
    bagua: '离',
    direction: '南方',
    star: '天英',
    door: '景门',
    gongDesc: '外实内虚、中空、空心、发光发热、美丽绚丽',
    starDesc: '人物（热情火辣／暴躁开放）；事物（美丽光明）',
    doorDesc: '人物（享受愉悦）；事物（美观张扬）',
    tianganDesc: '丙: 外观（高温炽热）、材质（剧烈燃烧）；丁: 外观（发光温和）、材质（微小火种芯片）',
    dizhiDesc: '午: 火旺'
  },
  2: {
    gongNum: 2,
    gongName: '坤二宫',
    bagua: '坤',
    direction: '西南',
    star: '天芮',
    door: '死门',
    gongDesc: '柔软、包容、平实、厚德载物',
    starDesc: '人物（柔软包容／毛病疾病）；事物（柔软瑕疵）',
    doorDesc: '人物（死气沉沉）；事物（无生命静止）',
    tianganDesc: '戊: 外观（庞大厚实）、材质（厚重坚实）；己: 外观（小巧平整）、材质（平坦软泥）',
    dizhiDesc: '未: 木库；申: 水长生'
  },
  3: {
    gongNum: 3,
    gongName: '震三宫',
    bagua: '震',
    direction: '东',
    star: '天冲',
    door: '伤门',
    gongDesc: '运动、变动、活跃、向上冲腾、爆发震颤',
    starDesc: '人物（雷厉风行／冲动鲁莽）；事物（高速运动）',
    doorDesc: '人物（受伤攻击）；事物（破损损坏）',
    tianganDesc: '甲: 外观（高大粗直）、材质（木质粗壮）；乙: 外观（长条柔韧）、材质（植物纤维）',
    dizhiDesc: '卯: 木旺的地方'
  },
  5: {
    gongNum: 5,
    gongName: '中五宫',
    bagua: '中',
    direction: '中',
    star: '天禽',
    door: '中门',
    gongDesc: '皇极中枢、中央厚土、统御八方',
    starDesc: '人物（中正忠厚／稳固包容）；事物（稳固中枢／调和包容）',
    doorDesc: '人物（居中调和）；事物（包容承载）',
    tianganDesc: '戊: 外观（庞大厚实）、材质（厚重坚实）；己: 外观（小巧平整）、材质（平坦软泥）',
    dizhiDesc: '无特定地支，统御八荒'
  },
  7: {
    gongNum: 7,
    gongName: '兑七宫',
    bagua: '兑',
    direction: '西',
    star: '天柱',
    door: '惊门',
    gongDesc: '有口、缺口、容器、能盛装',
    starDesc: '人物（中流砥柱／破坏叛逆）；事物（立柱支撑／破坏毁拆）',
    doorDesc: '人物（担忧恐惧）；事物（发声鸣响）',
    tianganDesc: '庚: 外观（坚硬强固）、材质（坚硬钢铁）；辛: 外观（细小尖锐）、材质（小金属构件）',
    dizhiDesc: '酉: 金旺'
  },
  8: {
    gongNum: 8,
    gongName: '艮八宫',
    bagua: '艮',
    direction: '东北',
    star: '天任',
    door: '生门',
    gongDesc: '停止不动、阻隔、敦厚质朴',
    starDesc: '人物（忠诚老实／固执愚蠢）；事物（固定静止）',
    doorDesc: '人物（生机活力）；事物（生长发展）',
    tianganDesc: '戊: 外观（庞大厚实）、材质（厚重坚实）；己: 外观（小巧平整）、材质（平坦软泥）',
    dizhiDesc: '丑: 庚金库；寅: 火长生'
  },
  1: {
    gongNum: 1,
    gongName: '坎一宫',
    bagua: '坎',
    direction: '北',
    star: '天蓬',
    door: '休门',
    gongDesc: '外虚内实、冰冷、液体、流动变化',
    starDesc: '人物（聪明胆大／胆大妄为／暗中行事）；事物（大面积平铺）',
    doorDesc: '人物（休息停歇）；事物（停止静止）',
    tianganDesc: '壬: 外观（透明流动）、材质（流动液体）；癸: 外观（网状水汽）、材质（潮湿含水网状）',
    dizhiDesc: '子: 水旺'
  },
  6: {
    gongNum: 6,
    gongName: '乾六宫',
    bagua: '乾',
    direction: '西北',
    star: '天心',
    door: '开门',
    gongDesc: '强健、刚劲、权威、运转不停',
    starDesc: '人物（仁厚慈爱／刚硬自我）；事物（核心刚硬）',
    doorDesc: '人物（开朗沟通）；事物（打开畅通）',
    tianganDesc: '庚: 外观（坚硬强固）、材质（坚硬钢铁）；辛: 外观（细小尖锐）、材质（小金属构件）',
    dizhiDesc: '戌: 丙火库；亥: 木长生'
  }
};

// ----------------- 天盘实战象意与心性研判字典 -----------------
export const PALACE_BAGUA_MEANING = {
  1: '坎为水，外虚内实、冰冷、液体、流动变化',
  2: '坤为地，柔软、包容、平实、厚德载物',
  3: '震为雷，运动、变动、活跃、向上冲腾、爆发震颤',
  4: '巽为风，不稳定、漂浮、变动、晃动',
  5: '中宫，皇极中枢、中央厚土、统御八方',
  6: '乾为天，强健、刚劲、权威、运转不停',
  7: '兑为泽，有口、缺口、容器、能盛装',
  8: '艮为山，停止不动、阻隔、敦厚质朴',
  9: '离为火，外实内虚、中空、空心、发光发热、美丽绚丽'
};

export const STAR_PRACTICAL = {
  '天辅': '人物（辅助从属／无主见）；事物（教育文化知识／辅助器械）',
  '天英': '人物（热情火辣／暴躁开放）；事物（美丽光明）',
  '天芮': '人物（柔软包容／毛病疾病）；事物（柔软瑕疵）',
  '天冲': '人物（雷厉风行／冲动鲁莽）；事物（高速运动）',
  '天柱': '人物（中流砥柱／破坏叛逆）；事物（立柱支撑／破坏毁拆）',
  '天任': '人物（忠诚老实／固执愚蠢）；事物（固定静止）',
  '天蓬': '人物（聪明胆大／胆大妄为／暗中行事）；事物（大面积平铺）',
  '天心': '人物（仁厚慈爱／刚硬自我）；事物（核心刚硬）',
  '天禽': '人物（中正忠厚／稳固包容）；事物（稳固中枢／调和包容）'
};

export const DOOR_PRACTICAL = {
  '杜门': '人物（关闭隐藏）；事物（封堵堵塞）',
  '景门': '人物（享受愉悦）；事物（美观张扬）',
  '死门': '人物（死气沉沉）；事物（无生命静止）',
  '伤门': '人物（受伤攻击）；事物（破损损坏）',
  '惊门': '人物（担忧恐惧）；事物（发声鸣响）',
  '生门': '人物（生机活力）；事物（生长发展）',
  '休门': '人物（休息停歇）；事物（停止静止）',
  '开门': '人物（开朗沟通）；事物（打开畅通）',
  '中门': '人物（居中调和）；事物（包容承载）'
};

export const SPIRIT_PRACTICAL = {
  '太阴': '人物（深沉内敛）；事物（隐藏遮挡）',
  '白虎': '人物（伤害杀心）；事物（攻击危险）',
  '值符': '人物（正直公正）；事物（名贵高档）',
  '螣蛇': '人物（多疑变动）；事物（不稳定变化）',
  '六合': '人物（亲和结合）；事物（粘连聚合）',
  '玄武': '人物（暗中算计）；事物（昏暗玄秘）',
  '九地': '人物（深沉低落）；事物（深藏低下）',
  '九天': '人物（志向高远）；事物（极高向上）',
  '太常': '人物（温和喜庆）；事物（宴席衣履）',
  '勾陈': '人物（阻滞反复）；事物（牵连打斗）',
  '朱雀': '人物（口舌是非）；事物（吵闹文书）'
};

// ----------------- 天干六种变化体系 (依据叶鸿生《我用遁甲》第十章) -----------------
// 1、天干遁甲 2、天干相合 3、相刑 4、十干克应 5、天干能量 6、天干与地支（生旺死绝表）

// 5、天干能量字典 (形态物象与心性)
// 特点：甲乙条、丙丁热、戊己凸、庚辛硬、壬癸透明光滑。
// 最复杂变数较多的为“辛、癸”：辛代表错误、改变，金属、颗粒、铁块、煤炭、器械；癸代表黑色、消极、暗昧，污渍、毛巾、垃圾、纸张、暗痣。
export const TIANGAN_ENERGY_DATA = {
  '甲': {
    keyword: '条',
    shape: '条状、直硬、大树横梁',
    energyDesc: '甲乙为条状；刚健正直，为大树横梁、头面首脑、元首大人物',
    summary: '直硬条状，首脑领导'
  },
  '乙': {
    keyword: '条',
    shape: '条状、曲木、花草藤蔓',
    energyDesc: '甲乙为条状；柔韧蜿转，为花草神经、血管手足、依附世情',
    summary: '蜿转条状，柔顺借力'
  },
  '丙': {
    keyword: '热',
    shape: '发热、发光、太阳炉火',
    energyDesc: '丙丁为热；烈火文明，发热发光、急躁发炎、太阳窗户',
    summary: '发热发光，急躁明朗'
  },
  '丁': {
    keyword: '热',
    shape: '发热、星光、灯烛微火',
    energyDesc: '丙丁为热；内热柔和，灯烛希望、文明美好、微光针灸',
    summary: '发热星光，希望美好'
  },
  '戊': {
    keyword: '凸',
    shape: '高大凸起、一坨、大石头',
    energyDesc: '戊己为凸；阳土山峦，凸起厚重、大肉块、大石资产金融',
    summary: '高大凸起，厚重聚财'
  },
  '己': {
    keyword: '凸',
    shape: '低平小凸、小坨、台阶低洼',
    energyDesc: '戊己为凸；阴土平坦，台阶落差、低洼天井、小肉怀疑杂乱',
    summary: '小坨落差，怀疑杂乱'
  },
  '庚': {
    keyword: '硬',
    shape: '坚硬刚金、冰霜铁石、骨骼武器',
    energyDesc: '庚辛为硬；刚烈肃杀，坚硬冰霜、道路关口、骨骼技术、凶猛阻隔',
    summary: '坚硬刚烈，技术阻隔'
  },
  '辛': {
    keyword: '硬',
    shape: '坚硬金属、颗粒、铁块、煤炭、器械',
    energyDesc: '庚辛为硬；【最复杂变数较多】代表错误、改变（变革、创新、革命）；同时辛代表金属、颗粒，同时也铁块、煤炭、器械都可以是辛',
    summary: '坚硬金属，错误、改变（金属、颗粒、器械）'
  },
  '壬': {
    keyword: '透明光滑',
    shape: '透明光滑、流动水液、大江大河',
    energyDesc: '壬癸透明光滑；流动变化、大水江河、聪明圆滑、随波逐流运输',
    summary: '透明光滑流动，圆滑变化'
  },
  '癸': {
    keyword: '透明光滑',
    shape: '透明光滑、至弱泉水、静水污渍',
    energyDesc: '壬癸透明光滑；【最复杂变数较多】代表黑色、消极、暗昧（绝望、困难、堕落）；同时可以是污渍、毛巾、垃圾、一张纸、一个痣',
    summary: '透明光滑，黑色、消极、暗昧（污渍、毛巾、垃圾、一张纸、痣）'
  }
};

// ----------------- 天盘干：外在表象关键词 (依据核心意象) -----------------
export const TIANGAN_TIANPAN_INFO = {
  '甲': {
    name: '甲木',
    stemText: '人象外表（高大、正直、正派、有担当）；物象外观（高大、粗直、立柱、栋梁）',
    wuXiang: '高大、粗直、立柱、栋梁',
    renXiang: '高大、正直、正派、有担当'
  },
  '乙': {
    name: '乙木',
    stemText: '人象外表（斯文、文静、温柔、谦顺）；物象外观（长条、柔韧、弯曲、细软）',
    wuXiang: '长条、柔韧、弯曲、细软',
    renXiang: '斯文、文静、温柔、谦顺'
  },
  '丙': {
    name: '丙火',
    stemText: '人象外表（热情、急躁、火爆）；物象外观（高温、炽热、大火、发光）',
    wuXiang: '高温、炽热、大火、发光',
    renXiang: '热情、急躁、火爆'
  },
  '丁': {
    name: '丁火',
    stemText: '人象外表（爱心、温暖、亲和、细腻）；物象外观（发光、温和、发热、内火）',
    wuXiang: '发光、温和、发热、内火',
    renXiang: '爱心、温暖、亲和、细腻'
  },
  '戊': {
    name: '戊土',
    stemText: '人象外表（偏胖、敦实、老实、沉稳）；物象外观（庞大、厚实、大坨、隆起）',
    wuXiang: '庞大、厚实、大坨、隆起',
    renXiang: '偏胖、敦实、老实、沉稳'
  },
  '己': {
    name: '己土',
    stemText: '人象外表（阴郁、安静、不苟言笑、沉静）；物象外观（小巧、平整、小坨、规整）',
    wuXiang: '小巧、平整、小坨、规整',
    renXiang: '阴郁、安静、不苟言笑、沉静'
  },
  '庚': {
    name: '庚金',
    stemText: '人象外表（严肃、刚强、强硬、讲原则）；物象外观（坚硬、强固、金属大件、刚硬）',
    wuXiang: '坚硬、强固、金属大件、刚硬',
    renXiang: '严肃、刚强、强硬、讲原则'
  },
  '辛': {
    name: '辛金',
    stemText: '人象外表（机巧灵动、挑剔、易显问题/过错）；物象外观（细小、尖锐、颗粒、小金属）',
    wuXiang: '细小、尖锐、颗粒、小金属',
    renXiang: '机巧灵动、挑剔、易显问题/过错'
  },
  '壬': {
    name: '壬水',
    stemText: '人象外表（聪明伶俐、善于变通、圆融）；物象外观（透明、流动、大面积、液体）',
    wuXiang: '透明、流动、大面积、液体',
    renXiang: '聪明伶俐、善于变通、圆融'
  },
  '癸': {
    name: '癸水',
    stemText: '人象外表（迷茫、温吞、糊涂、内向）；物象外观（网状、水汽、静止、柔软、液体）',
    wuXiang: '网状、水汽、静止、柔软、液体',
    renXiang: '迷茫、温吞、糊涂、内向'
  }
};

// ----------------- 地盘干：内在材质与深层心性关键词 (依据核心意象) -----------------
export const TIANGAN_DIPAN_INFO = {
  '甲': {
    name: '甲木',
    stemText: '人象心性（正直、有担当、栋梁）；物象材质（木质、粗壮、直立支撑、栋梁）',
    wuXiang: '木质、粗壮、直立支撑、栋梁',
    renXiang: '正直、有担当、栋梁'
  },
  '乙': {
    name: '乙木',
    stemText: '人象心性（善良、温柔、老实、柔顺）；物象材质（植物、木质纤维、柔韧、编织、条状）',
    wuXiang: '植物、木质纤维、柔韧、编织、条状',
    renXiang: '善良、温柔、老实、柔顺'
  },
  '丙': {
    name: '丙火',
    stemText: '人象心性（脾气暴躁、刚烈、火急火燎）；物象材质（剧烈燃烧、发热、发光、高温核心）',
    wuXiang: '剧烈燃烧、发热、发光、高温核心',
    renXiang: '脾气暴躁、刚烈、火急火燎'
  },
  '丁': {
    name: '丁火',
    stemText: '人象心性（慈爱、奉献、温暖、爱心）；物象材质（通电芯片、微小火种、热源、电路）',
    wuXiang: '通电芯片、微小火种、热源、电路',
    renXiang: '慈爱、奉献、温暖、爱心'
  },
  '戊': {
    name: '戊土',
    stemText: '人象心性（忠诚、憨厚、重情重义、沉稳）；物象材质（厚重泥土、石块、大坨填充、坚实）',
    wuXiang: '厚重泥土、石块、大坨填充、坚实',
    renXiang: '忠诚、憨厚、重情重义、沉稳'
  },
  '己': {
    name: '己土',
    stemText: '人象心性（心思重、阴郁、深沉、多思多虑）；物象材质（平坦软泥、小巧结构、细腻、土质）',
    wuXiang: '平坦软泥、小巧结构、细腻、土质',
    renXiang: '心思重、阴郁、深沉、多思多虑'
  },
  '庚': {
    name: '庚金',
    stemText: '人象心性（极讲原则、寸步不让、强硬刚愎）；物象材质（坚硬钢铁、金属骨架、合金、强硬材质）',
    wuXiang: '坚硬钢铁、金属骨架、合金、强硬材质',
    renXiang: '极讲原则、寸步不让、强硬刚愎'
  },
  '辛': {
    name: '辛金',
    stemText: '人象心性（曾犯过失、渴望变革、革新、挑剔）；物象材质（小金属构件、颗粒、精密零件、瑕疵）',
    wuXiang: '小金属构件、颗粒、精密零件、瑕疵',
    renXiang: '曾犯过失、渴望变革、革新、挑剔'
  },
  '壬': {
    name: '壬水',
    stemText: '人象心性（大智若愚、通透、圆融、灵活）；物象材质（流动、液体、水、变动）',
    wuXiang: '流动、液体、水、变动',
    renXiang: '大智若愚、通透、圆融、灵活'
  },
  '癸': {
    name: '癸水',
    stemText: '人象心性（心思如网、迷茫、软弱退缩）；物象材质（潮湿含水、柔软网状、纤维吸水、静止）',
    wuXiang: '潮湿含水、柔软网状、纤维吸水、静止',
    renXiang: '心思如网、迷茫、软弱退缩'
  }
};

// 保持兼容别名
export const TIANGAN_MERGED_INFO = TIANGAN_TIANPAN_INFO;

// 1、天干遁甲映射字典 (六仪肚内遁藏六甲元首，顶值符方为遁甲)
export const TIANGAN_DUNJIA_MAP = {
  '戊': { xun: '甲子', name: '甲子戊', meaning: '甲子遁戊，值符元首，资金大盘' },
  '己': { xun: '甲戌', name: '甲戌己', meaning: '甲戌遁己，地户元机，暗蓄机谋' },
  '庚': { xun: '甲申', name: '甲申庚', meaning: '甲申遁庚，太白煞气，阻隔技术' },
  '辛': { xun: '甲午', name: '甲午辛', meaning: '甲午遁辛，天狱革命，改变革新' },
  '壬': { xun: '甲辰', name: '甲辰壬', meaning: '甲辰遁壬，天牢游弋，变动回首' },
  '癸': { xun: '甲寅', name: '甲寅癸', meaning: '甲寅遁癸，地网潜伏，至柔待机' }
};

// 2、天干相合字典 (乙庚、丙辛、丁壬、戊癸，上排主动去合，下排被动受合)
export const TIANGAN_HE_MAP = {
  '甲': { partner: '己', element: '土', name: '甲己合土' },
  '己': { partner: '甲', element: '土', name: '甲己合土' },
  '乙': { partner: '庚', element: '金', name: '乙庚合金' },
  '庚': { partner: '乙', element: '金', name: '乙庚合金' },
  '丙': { partner: '辛', element: '水', name: '丙辛合水' },
  '辛': { partner: '丙', element: '水', name: '丙辛合水' },
  '丁': { partner: '壬', element: '木', name: '丁壬合木' },
  '壬': { partner: '丁', element: '木', name: '丁壬合木' },
  '戊': { partner: '癸', element: '火', name: '戊癸合火' },
  '癸': { partner: '戊', element: '火', name: '戊癸合火' }
};
export const TIANGAN_HE_ACTIVE_STEMS = new Set(['乙', '丙', '丁', '戊', '甲']);

// 3、相刑 / 击刑与自刑 (因遁甲内部地支与宫地支相刑，挨整打击、自责内耗)
export const TIANGAN_XING_DATA = {
  '戊-3': {
    name: '六仪击刑（子刑卯，无礼之刑）',
    type: 'jixing',
    meaning: '损财折腾、阻力大、受挨整打击、刑伤破耗'
  },
  '己-2': {
    name: '六仪击刑（戌刑未，恃势之刑）',
    type: 'jixing',
    meaning: '伤病憋屈、田宅纠纷、受挨整打击、自我折磨'
  },
  '庚-8': {
    name: '六仪击刑（申刑寅，无恩之刑）',
    type: 'jixing',
    meaning: '刑伤争斗、道路受阻、骨折筋伤、受挨整打击'
  },
  '辛-9': {
    name: '六仪自刑（午午自刑）',
    type: 'zixing',
    meaning: '自己捏自己、责备自己、自省内耗、决策失误'
  },
  '壬-4': {
    name: '六仪自刑（辰辰自刑）',
    type: 'zixing',
    meaning: '自我纠结、犯错自刑、责备自己、官非牵连'
  },
  '癸-4': {
    name: '六仪击刑（寅刑巳，无恩之刑）',
    type: 'jixing',
    meaning: '官非惩处、半途而废、受罚受打击'
  }
};

// 6、天干与地支（生旺死绝表）
export const CHANGSHENG_12_STAGES = [
  '长生', '沐浴', '冠带', '临官', '帝旺', '衰',
  '病', '死', '墓', '绝', '胎', '养'
];

export const TIANGAN_CHANGSHENG_MAP = {
  '甲': { '亥': '长生', '子': '沐浴', '丑': '冠带', '寅': '临官', '卯': '帝旺', '辰': '衰', '巳': '病', '午': '死', '未': '墓', '申': '绝', '酉': '胎', '戌': '养' },
  '乙': { '午': '长生', '巳': '沐浴', '辰': '冠带', '卯': '临官', '寅': '帝旺', '丑': '衰', '子': '病', '亥': '死', '戌': '墓', '未': '墓', '申': '胎', '酉': '绝' },
  '丙': { '寅': '长生', '卯': '沐浴', '辰': '冠带', '巳': '临官', '午': '帝旺', '未': '衰', '申': '病', '酉': '死', '戌': '墓', '亥': '绝', '子': '胎', '丑': '养' },
  '丁': { '酉': '长生', '申': '沐浴', '未': '冠带', '午': '临官', '巳': '帝旺', '辰': '衰', '卯': '病', '寅': '死', '丑': '墓', '子': '绝', '亥': '胎', '戌': '养' },
  '戊': { '寅': '长生', '卯': '沐浴', '辰': '冠带', '巳': '临官', '午': '帝旺', '未': '衰', '申': '病', '酉': '死', '戌': '墓', '亥': '绝', '子': '胎', '丑': '养' },
  '己': { '酉': '长生', '申': '沐浴', '未': '冠带', '午': '临官', '巳': '帝旺', '辰': '衰', '卯': '病', '寅': '死', '丑': '墓', '子': '绝', '亥': '胎', '戌': '养' },
  '庚': { '巳': '长生', '午': '沐浴', '未': '冠带', '申': '临官', '酉': '帝旺', '戌': '衰', '亥': '病', '子': '死', '丑': '墓', '寅': '绝', '卯': '胎', '辰': '养' },
  '辛': { '子': '长生', '亥': '沐浴', '戌': '冠带', '酉': '临官', '申': '帝旺', '未': '衰', '午': '病', '巳': '死', '辰': '墓', '卯': '绝', '寅': '胎', '丑': '养' },
  '壬': { '申': '长生', '酉': '沐浴', '戌': '冠带', '亥': '临官', '子': '帝旺', '丑': '衰', '寅': '病', '卯': '死', '辰': '墓', '巳': '绝', '午': '胎', '未': '养' },
  '癸': { '卯': '长生', '寅': '沐浴', '丑': '冠带', '子': '临官', '亥': '帝旺', '戌': '衰', '酉': '病', '申': '死', '未': '墓', '辰': '墓', '午': '绝', '巳': '胎' }
};

// 叶鸿生抓重点“长生、入墓”两种状态
export const TIANGAN_KEY_STAGE_MEANINGS = {
  '壬-4': '壬下辰入墓，有结束、消极、归家念头',
  '庚-8': '庚在丑入墓，结束消极完蛋',
  '辛-4': '辛入辰库（辰为辛金墓），被埋没、无处发力、受屈',
  '丁-8': '丁入丑库（丑为丁火墓），微光被埋、消沉退缩、受阻',
  '己-8': '己入丑库（丑为己土墓），陷于阴暗、杂乱无绪、受困',
  '乙-2': '乙入未库（未为木库），受制、委靡不振、无力结束',
  '癸-2': '癸入未库（未为木库耗水），暗中被困、结束完蛋、消极停滞',
  '丙-6': '丙入戌库（戌为丙火库），光明受阻、能量收敛、结束',
  '戊-6': '戊入戌库（戌为火土库），资金被套、阻滞不通、困顿',
  '庚-4': '庚临巳为金长生，炉火炼金、初露锋芒、锐意进取',
  '壬-2': '壬临申为水长生，源远流长、生生不息、开拓进取',
  '丙-8': '丙临寅为长生，阳光普照、根基稳固、初显成效',
  '戊-8': '戊临寅为长生，根基稳固、生长开始',
  '乙-6': '乙临亥为木长生，得水生扶、暗生生机、绝处逢生'
};

// 4、十干克应实战全典 (完全采用权威 1~10 全套格名与断语)
export const SHIGAN_PRACTICAL = SHIGAN_KEYING;

// 干支生旺墓绝与击刑分析（融合天干能量、生旺死绝表、击刑与遁甲）
export function getGanzhiStateAnalysis(tianGan, gong, pan) {
  if (!tianGan) return '';

  const energy = TIANGAN_ENERGY_DATA[tianGan];
  const stageKey = `${tianGan}-${gong}`;
  const keyStage = TIANGAN_KEY_STAGE_MEANINGS[stageKey];
  const xing = TIANGAN_XING_DATA[stageKey];
  const spirit = pan && pan.tianpanSpirit ? pan.tianpanSpirit[gong] : '';
  const isZhiFu = (spirit === '值符' || (pan && pan.shiGong === gong));

  // 1. 经典入墓与长生重点状态
  if (keyStage) {
    let extra = '';
    if (xing) {
      let xingShort = '';
      if (xing.name.includes('辰辰')) xingShort = '辰自刑';
      else if (xing.name.includes('午午')) xingShort = '午自刑';
      else if (xing.name.includes('申刑寅')) xingShort = '申刑寅击刑';
      else if (xing.name.includes('子刑卯')) xingShort = '子刑卯击刑';
      else if (xing.name.includes('戌刑未')) xingShort = '戌刑未击刑';
      else if (xing.name.includes('寅刑巳')) xingShort = '寅刑巳击刑';
      else xingShort = '击刑受阻';
      extra += `；${xingShort}`;
    }
    if (tianGan === '辛') {
      extra += '；辛金坚硬，代表错误、改变（亦为金属、颗粒、器械）';
    } else if (tianGan === '癸') {
      extra += '；癸水透明光滑，代表黑色、消极、暗昧（亦为污渍、毛巾、垃圾、一张纸、痣）';
    } else if (tianGan === '壬') {
      extra += '；壬水透明光滑流动';
    } else if (tianGan === '庚') {
      extra += '；庚金坚硬';
    } else if (energy) {
      extra += `；${energy.summary}`;
    }
    return `${keyStage}${extra}`;
  }

  // 2. 击刑/自刑独立状态
  if (xing) {
    let energyText = '';
    if (tianGan === '辛') {
      energyText = '辛金坚硬，代表错误、改变（亦为金属、颗粒、器械）';
    } else if (tianGan === '癸') {
      energyText = '癸水透明光滑，代表黑色、消极、暗昧（亦为污渍、毛巾、垃圾、一张纸、痣）';
    } else if (energy) {
      energyText = `${energy.summary}`;
    }
    return `${energyText}；${tianGan}在${GONG_CN[gong]}宫${xing.name}，${xing.meaning}`;
  }

  // 3. 常态天干能量与地支十二状态
  let stageText = '';
  if (pan && pan.dipan) {
    const palaceZhi = DIPAN_PALACE_INFO[gong] ? DIPAN_PALACE_INFO[gong].dizhi : [];
    const stageMap = TIANGAN_CHANGSHENG_MAP[tianGan] || {};
    const stages = palaceZhi.map(z => `${z}${stageMap[z] || '平'}`).join('、');
    stageText = stages ? `临${stages}` : '';
  }

  let energyText = '';
  if (tianGan === '辛') {
    energyText = '辛金坚硬，代表错误、改变（亦为金属、颗粒、器械）';
  } else if (tianGan === '癸') {
    energyText = '癸水透明光滑，代表黑色、消极、暗昧（亦为污渍、毛巾、垃圾、一张纸、痣）';
  } else if (energy) {
    energyText = `${tianGan}: ${energy.summary}`;
  }

  return stageText ? `${energyText}；${tianGan}${stageText}，气数平稳` : `${energyText}，顺应时势`;
}

// 十干克应实战断语提取 (采用用户全新 1~10 权威格式，支持相合与值符同甲提示)
export function getShiganPracticalText(tianGan, diGan, jiGan, pan, gong) {
  if (!tianGan || !diGan) return '';

  const formatItem = (tg, dg) => {
    const k = `${tg}加${dg}`;
    const v = SHIGAN_PRACTICAL[k] || SHIGAN_KEYING[k] || '';
    if (!v) return k;
    const cleanV = v.replace(/^为/, '').replace(/。$/, '');
    return `${k}为${cleanV}`;
  };

  const item1 = formatItem(tianGan, diGan);
  let result = item1;

  if (jiGan && jiGan !== diGan && jiGan !== tianGan) {
    const item2 = formatItem(jiGan, diGan);
    result = `${item1}；${item2}。`;
  } else {
    result = `${item1}。`;
  }

  // 天干相合提示 (若天盘与地盘相合)
  const heRel = TIANGAN_HE_MAP[tianGan];
  if (heRel && diGan === heRel.partner) {
    const isTianActive = TIANGAN_HE_ACTIVE_STEMS.has(tianGan);
    const heNote = isTianActive
      ? `（${heRel.name}：天盘${tianGan}主动合地盘${diGan}，内心牵挂放不下）`
      : `（${heRel.name}：地盘${diGan}来合天盘${tianGan}，欲办某事有人牵绊）`;
    result += ` ${heNote}`;
  }

  // 顶值符见甲提示 (甲即值符同戊，凡见值符即为甲)
  const spirit = pan && pan.tianpanSpirit ? pan.tianpanSpirit[gong] : '';
  const isZhiFu = (spirit === '值符' || (pan && pan.shiGong === gong));
  if (isZhiFu && tianGan !== '甲') {
    const jiaKey = `甲加${diGan}`;
    const jiaVal = SHIGAN_PRACTICAL[jiaKey] || SHIGAN_KEYING[jiaKey] || '';
    if (jiaVal) {
      const cleanJia = jiaVal.replace(/^为/, '');
      result += `（值符同甲：${jiaKey}为${cleanJia}）`;
    }
  }

  return `十干克应，${result}`;
}

// 天干六种变化综合结构化分析器 (供卡片与深度面板调用)
export function getTianganSixChanges(pan, gong) {
  if (gong === 5 && pan.paipanMethod === 'zhuan') return null;

  const tianGan = pan.tianpanGan[gong] || '';
  const diGan = pan.dipan[gong] || '';
  const jiGan = pan.tianpanJigan[gong] || (gong === 2 ? pan.dipan[5] : '');
  const spirit = pan.tianpanSpirit[gong] || '';
  const isZhiFu = (spirit === '值符' || pan.shiGong === gong);

  // 1、天干遁甲
  let dunjiaInfo = {
    hasDunjia: false,
    name: '',
    desc: ''
  };
  if (isZhiFu && TIANGAN_DUNJIA_MAP[tianGan]) {
    const dj = TIANGAN_DUNJIA_MAP[tianGan];
    dunjiaInfo = {
      hasDunjia: true,
      name: dj.name,
      xun: dj.xun,
      desc: `天干头顶值符，肚内有遁甲【${dj.name}】，为值符元首枢机（值符同甲，兼读甲加${diGan}克应）`
    };
  } else if (TIANGAN_DUNJIA_MAP[tianGan]) {
    dunjiaInfo = {
      hasDunjia: false,
      name: `${tianGan}（常态）`,
      desc: `本宫未临值符，仅为常态天干【${tianGan}】，腹中暂无遁甲之变`
    };
  } else {
    dunjiaInfo = {
      hasDunjia: false,
      name: tianGan,
      desc: `天干【${tianGan}】为三奇吉曜，统率施为`
    };
  }

  // 2、天干相合
  let heInfo = {
    isHe: false,
    pair: '',
    desc: ''
  };
  const heRel = TIANGAN_HE_MAP[tianGan];
  if (heRel && diGan === heRel.partner) {
    const isTianActive = TIANGAN_HE_ACTIVE_STEMS.has(tianGan);
    heInfo = {
      isHe: true,
      pair: heRel.name,
      desc: isTianActive
        ? `天盘【${tianGan}】主动合地盘【${diGan}】（${heRel.name}）：内心有牵挂、放不下，主动去合（牵挂）别人`
        : `地盘【${diGan}】来合天盘【${tianGan}】（${heRel.name}）：被动受合，欲办某事有人来牵绊`
    };
  } else {
    heInfo = {
      isHe: false,
      pair: '无合',
      desc: `天盘【${tianGan}】与地盘【${diGan}】不相合，各自施为`
    };
  }

  // 3、相刑（六仪击刑与自刑）
  let xingInfo = {
    isXing: false,
    type: 'none',
    name: '',
    desc: ''
  };
  const xingKey = `${tianGan}-${gong}`;
  if (TIANGAN_XING_DATA[xingKey]) {
    const x = TIANGAN_XING_DATA[xingKey];
    xingInfo = {
      isXing: true,
      type: x.type,
      name: x.name,
      desc: `${x.name}：${x.meaning}`
    };
  } else {
    xingInfo = {
      isXing: false,
      type: 'none',
      name: '无击刑',
      desc: `天盘【${tianGan}】落${GONG_CN[gong]}宫无击刑相伤`
    };
  }

  // 4、十干克应
  const key1 = `${tianGan}加${diGan}`;
  const text1 = SHIGAN_PRACTICAL[key1] || '';
  let keyingList = [];
  if (text1) {
    keyingList.push({ key: key1, text: `${key1}${text1.startsWith('为') ? '' : '为'}${text1}` });
  }
  if (jiGan && jiGan !== diGan && jiGan !== tianGan) {
    const key2 = `${jiGan}加${diGan}`;
    const text2 = SHIGAN_PRACTICAL[key2] || '';
    if (text2) {
      keyingList.push({ key: key2, text: `${key2}${text2.startsWith('为') ? '' : '为'}${text2}` });
    }
  }
  if (isZhiFu) {
    const jiaKey = `甲加${diGan}`;
    const jiaText = SHIGAN_PRACTICAL[jiaKey] || '';
    if (jiaText) {
      keyingList.push({ key: jiaKey, text: `值符同甲：${jiaKey}${jiaText.startsWith('为') ? '' : '为'}${jiaText}` });
    }
  }

  // 5、天干能量
  const energyData = TIANGAN_ENERGY_DATA[tianGan] || {
    keyword: '',
    shape: '',
    energyDesc: '气数平稳',
    summary: ''
  };

  // 6、天干与地支（生旺死绝表）
  const stageMap = TIANGAN_CHANGSHENG_MAP[tianGan] || {};
  const palaceZhi = DIPAN_PALACE_INFO[gong] ? DIPAN_PALACE_INFO[gong].dizhi : [];
  const stages = palaceZhi.map(z => `${z}(${stageMap[z] || '平'})`).join('、');
  const stageKey = `${tianGan}-${gong}`;
  const keyStageDesc = TIANGAN_KEY_STAGE_MEANINGS[stageKey] || '';

  return {
    tianGan,
    diGan,
    jiGan,
    gong,
    gongName: GONG_CN[gong] + '宫',
    dunjia: dunjiaInfo,
    he: heInfo,
    xing: xingInfo,
    keying: keyingList,
    energy: energyData,
    shengwang: {
      stages,
      keyStageDesc: keyStageDesc || `天盘【${tianGan}】落${GONG_CN[gong]}宫，气数平顺`
    }
  };
}

// ----------------- 月令对九宫旺衰影响分析 (依据叶鸿生《我用遁甲》第三步看宫位旺衰精炼模型) -----------------
const MONTH_ZHI_ELEMENT = {
  '寅': '木', '卯': '木',
  '辰': '土', '巳': '火',
  '午': '火', '未': '土',
  '申': '金', '酉': '金',
  '戌': '土', '亥': '水',
  '子': '水', '丑': '土'
};

const PALACE_FIVE_ELEMENT_NAME = {
  1: '坎水',
  2: '坤土',
  3: '震木',
  4: '巽木',
  5: '中土',
  6: '乾金',
  7: '兑金',
  8: '艮土',
  9: '离火'
};

const ZHI_CLASH_MAP = {
  '子': '午', '午': '子',
  '丑': '未', '未': '丑',
  '寅': '申', '申': '寅',
  '卯': '酉', '酉': '卯',
  '辰': '戌', '戌': '辰',
  '巳': '亥', '亥': '巳'
};

const CLASH_PAIR_NAME = {
  '子-午': '子午相冲', '午-子': '子午相冲',
  '丑-未': '丑未相冲', '未-丑': '丑未相冲',
  '寅-申': '寅申相冲', '申-寅': '寅申相冲',
  '卯-酉': '卯酉相冲', '酉-卯': '卯酉相冲',
  '辰-戌': '辰戌相冲', '戌-辰': '辰戌相冲',
  '巳-亥': '巳亥相冲', '亥-巳': '巳亥相冲'
};

const WUXING_SHENG = {
  '木': '火',
  '火': '土',
  '土': '金',
  '金': '水',
  '水': '木'
};

const WUXING_KE = {
  '木': '土',
  '土': '水',
  '水': '火',
  '火': '金',
  '金': '木'
};

export function getPalaceYuelingStructured(pan, gong) {
  if (!pan || !pan.pillars || !pan.pillars.month) return { formula: '', status: '平', full: '' };
  const monthStr = pan.pillars.month;
  const monthZhi = monthStr.length >= 2 ? monthStr[1] : monthStr[0];
  const mElem = MONTH_ZHI_ELEMENT[monthZhi];
  const pInfo = DIPAN_PALACE_INFO[gong];
  if (!mElem || !pInfo) return { formula: '', status: '平', full: '' };

  const pElem = pInfo.element;
  const mName = `${monthZhi}${mElem}`;
  const pName = PALACE_FIVE_ELEMENT_NAME[gong] || `${pInfo.bagua}${pElem}`;
  const pZhi = pInfo.dizhi || [];
  const clashZhi = ZHI_CLASH_MAP[monthZhi] || '';

  const isClash = pZhi.includes(clashZhi);
  const isHome = pZhi.includes(monthZhi);

  let formula = '';
  let status = '';
  if (pElem === mElem) {
    formula = isHome ? `${mName}居${pName}` : `${mName}同${pName}`;
    status = isHome ? '最旺' : '宫旺';
  } else if (WUXING_SHENG[mElem] === pElem) {
    formula = `${mName}生${pName}`;
    status = isHome ? '最旺' : '宫旺';
  } else if (WUXING_KE[mElem] === pElem) {
    formula = `${mName}克${pName}`;
    status = '宫受制';
  } else if (WUXING_SHENG[pElem] === mElem) {
    formula = `${mName}泄${pName}`;
    status = '宫泄气';
  } else if (WUXING_KE[pElem] === mElem) {
    formula = `${mName}被${pName}所克`;
    status = '宫休无力';
  }

  let clashDesc = '';
  if (isClash) {
    const pairKey = `${monthZhi}-${clashZhi}`;
    const clashText = CLASH_PAIR_NAME[pairKey] || `${clashZhi}${monthZhi}相冲`;
    clashDesc = `，${clashText}`;
  }

  return {
    formula,
    status: `${status}${clashDesc}`,
    full: `${formula}，${status}${clashDesc}`
  };
}

export function getPalaceYuelingAnalysis(pan, gong) {
  const s = getPalaceYuelingStructured(pan, gong);
  return s.full;
}

// 九星原始宫位五行归属 (坎一蓬水、艮八任土、震三冲木、巽四辅木、离九英火、坤二芮土、中五禽土、兑七柱金、乾六心金)
export const STAR_ORIGINAL_ELEMENT = {
  '天蓬': '水',
  '天任': '土',
  '天冲': '木',
  '天辅': '木',
  '天英': '火',
  '天芮': '土',
  '天禽': '土',
  '天柱': '金',
  '天心': '金'
};

// ----------------- 九星旺相休囚分析 (依据九星专门口诀与叶鸿生《我用遁甲》) -----------------
// 口诀：与我同行即为相，我生之月诚为旺。废于父母休于财，囚于鬼分真不妄。
// 简化版：同五行为相，我生宫为旺，宫克我为囚，宫生我为废，我克宫为休。
// 三态实质：旺和相相同、休和囚相似、废就是没有用处。
export function getStarWangshuaiAnalysis(star, gong, pan) {
  if (!star) return null;
  let starClean = star.replace(/星/g, '').trim();
  if (starClean === '天禽') {
    starClean = '天禽';
  } else if (starClean.includes('天芮')) {
    starClean = '天芮';
  }
  const sElem = STAR_ORIGINAL_ELEMENT[starClean];
  if (!sElem) return null;

  // 落宫五行 (看地利)
  const pInfo = DIPAN_PALACE_INFO[gong];
  const pElem = pInfo ? pInfo.element : '';

  // 月令五行 (看天时)
  let mElem = '';
  if (pan && pan.pillars && pan.pillars.month) {
    const monthStr = pan.pillars.month;
    const monthZhi = monthStr.length >= 2 ? monthStr[1] : monthStr[0];
    mElem = MONTH_ZHI_ELEMENT[monthZhi] || '';
  }

  // 1. 计算落宫旺衰 (与宫比对: 地利)
  let gongRel = { formula: '', state: '', group: '' };
  if (pElem) {
    if (sElem === pElem) {
      gongRel = { formula: '同五行为相', state: '相', group: 'wang' };
    } else if (WUXING_SHENG[sElem] === pElem) {
      gongRel = { formula: '我生宫为旺', state: '旺', group: 'wang' };
    } else if (WUXING_KE[sElem] === pElem) {
      gongRel = { formula: '我克宫为休', state: '休', group: 'xiu' };
    } else if (WUXING_KE[pElem] === sElem) {
      gongRel = { formula: '宫克我为囚', state: '囚', group: 'xiu' };
    } else if (WUXING_SHENG[pElem] === sElem) {
      gongRel = { formula: '宫生我为废', state: '废', group: 'fei' };
    }
  }

  // 2. 计算月令旺衰 (与月比对: 天时)
  let monthRel = { formula: '', state: '', group: '' };
  if (mElem) {
    if (sElem === mElem) {
      monthRel = { formula: '同五行为相', state: '相', group: 'wang' };
    } else if (WUXING_SHENG[sElem] === mElem) {
      monthRel = { formula: '我生月为旺', state: '旺', group: 'wang' };
    } else if (WUXING_KE[sElem] === mElem) {
      monthRel = { formula: '我克月为休', state: '休', group: 'xiu' };
    } else if (WUXING_KE[mElem] === sElem) {
      monthRel = { formula: '月克我为囚', state: '囚', group: 'xiu' };
    } else if (WUXING_SHENG[mElem] === sElem) {
      monthRel = { formula: '月生我为废', state: '废', group: 'fei' };
    }
  }

  // 3. 三态实质综合结论 (旺和相相同、休和囚相似、废就是没有用处)
  let summary = '';
  const isWang = s => s === '旺' || s === '相';
  const isXiu = s => s === '休' || s === '囚';
  if (gongRel.state === '废' || monthRel.state === '废') {
    summary = '没有用处';
  } else if (isWang(gongRel.state) && isWang(monthRel.state)) {
    summary = '旺相有用';
  } else if (isXiu(gongRel.state) && isXiu(monthRel.state)) {
    summary = '休囚失利';
  } else if (isWang(gongRel.state) && isXiu(monthRel.state)) {
    summary = '得地利失天时';
  } else if (isXiu(gongRel.state) && isWang(monthRel.state)) {
    summary = '得天时失地利';
  } else if (isWang(gongRel.state)) {
    summary = '旺相有用';
  } else if (isXiu(gongRel.state)) {
    summary = '休囚失利';
  } else if (gongRel.state === '废') {
    summary = '没有用处';
  }

  let text = '';
  if (gongRel.formula && monthRel.formula) {
    text = `${gongRel.formula}，${monthRel.formula}：${summary}`;
  } else if (gongRel.formula) {
    text = `${gongRel.formula}：${summary}`;
  }

  return {
    starClean,
    sElem,
    gongState: gongRel.state,
    gongFormula: gongRel.formula,
    monthState: monthRel.state,
    monthFormula: monthRel.formula,
    summary,
    text
  };
}

// ----------------- 八门原始位置、五行与生克制化、反吟伏吟分析 (依据叶鸿生《我用遁甲》) -----------------
// 八门原始位置：坎一休门、坤二死门、震三伤门、巽四杜门、乾六开门、兑七惊门、艮八生门、离九景门
export const DOOR_ORIGINAL_PALACE = {
  '休门': 1,
  '死门': 2,
  '伤门': 3,
  '杜门': 4,
  '中门': 5,
  '开门': 6,
  '惊门': 7,
  '生门': 8,
  '景门': 9
};

export const DOOR_ORIGINAL_ELEMENT = {
  '休门': '水',
  '生门': '土',
  '伤门': '木',
  '杜门': '木',
  '景门': '火',
  '死门': '土',
  '惊门': '金',
  '开门': '金',
  '中门': '土'
};

export const DOOR_CATEGORY = {
  '开门': '吉门',
  '休门': '吉门',
  '生门': '吉门',
  '伤门': '凶门',
  '死门': '凶门',
  '惊门': '凶门',
  '杜门': '平门',
  '景门': '平门'
};

// ----------------- 五不遇时与时干入墓检测 (严格遵循叶鸿生《我用遁甲》第174页标准) -----------------
export const WU_BU_YU_STEM_MAP = {
  '甲': '庚', // 甲日庚午时 (阳金克阳木)
  '乙': '辛', // 乙日辛巳时 (阴金克阴木)
  '丙': '壬', // 丙日壬辰时 (阳水克阳火)
  '丁': '癸', // 丁日癸卯时 (阴水克阴火)
  '戊': '甲', // 戊日甲寅时 (阳木克阳土)
  '己': '乙', // 己日乙丑时 (阴木克阴土)
  '庚': '丙', // 庚日丙子时 (阳火克阳金)
  '辛': '丁', // 辛日丁酉时 (阴火克阴金)
  '壬': '戊', // 壬日戊申时 (阳土克阳水)
  '癸': '己'  // 癸日己未时 (阴土克阴水)
};

export const SHI_GAN_RU_MU_LIST = ['丙戌', '丁丑', '戊戌', '己丑', '壬辰', '癸未'];

export function checkWuBuYuShi(dayGz, hourGz) {
  if (!dayGz || !hourGz) {
    return {
      isWuBuYu: false,
      isShiMu: false,
      hasSpecial: false,
      tag: '',
      title: '常态时辰',
      desc: '四柱干支配合平顺。',
      rule: ''
    };
  }

  const dayGan = dayGz[0];
  const hourGan = hourGz[0];
  const isWuBuYu = (WU_BU_YU_STEM_MAP[dayGan] === hourGan);
  const isShiMu = SHI_GAN_RU_MU_LIST.includes(hourGz);

  if (isWuBuYu && isShiMu) {
    return {
      isWuBuYu: true,
      isShiMu: true,
      hasSpecial: true,
      tag: '五不遇时·时干入墓',
      level: 'danger',
      title: '五不遇时且时干入墓',
      desc: `时干克日干（${hourGz}时硬克${dayGan}日）且时干入墓：时运不济，求吉反凶。预测所问之事本身不利或时机不合，且恐未起步即受阻告终。`,
      rule: `时干${hourGan}克日干${dayGan}（阳克阳/阴克阴） + 时干${hourGan}入墓于时支${hourGz[1]}`
    };
  }

  if (isWuBuYu) {
    return {
      isWuBuYu: true,
      isShiMu: false,
      hasSpecial: true,
      tag: '五不遇时',
      level: 'danger',
      title: '五不遇时（时干克日干）',
      desc: `时干克日干（${hourGz}时硬克${dayGan}日，同性极克）：时运不济、求吉反凶。当下预测所问之事本身即不利或时机不恰当，运筹大忌。`,
      rule: `时干${hourGan}克日干${dayGan}（阳克阳/阴克阴）`
    };
  }

  if (isShiMu) {
    return {
      isWuBuYu: false,
      isShiMu: true,
      hasSpecial: true,
      tag: '时干入墓',
      level: 'warning',
      title: '时干入墓于时支',
      desc: `时干入墓于时支（${hourGz}）：所问之事很可能还没开始干就已经结束了，主迟滞、困顿、难有作为。`,
      rule: `时干${hourGan}入墓于时支${hourGz[1]}`
    };
  }

  return {
    isWuBuYu: false,
    isShiMu: false,
    hasSpecial: false,
    tag: '',
    level: 'normal',
    title: '常态时辰',
    desc: '四柱干支配合平顺，无五不遇时或时干入墓之克忌。',
    rule: ''
  };
}

// 检查全盘八门/九星反吟伏吟全局大像
export function checkGlobalPatterns(pan) {
  if (!pan || !pan.tianpanDoor) {
    return { isMenFuyin: false, isMenFanyin: false, isStarFuyin: false, isStarFanyin: false, badges: [] };
  }

  let isMenFuyin = true;
  let isMenFanyin = true;
  let isStarFuyin = true;
  let isStarFanyin = true;

  const validGongs = [1, 2, 3, 4, 6, 7, 8, 9];
  for (const g of validGongs) {
    const d = pan.tianpanDoor[g];
    const origGongD = DOOR_ORIGINAL_PALACE[d];
    if (origGongD !== undefined) {
      if (origGongD !== g) isMenFuyin = false;
      if (origGongD !== 10 - g) isMenFanyin = false;
    }

    const s = pan.tianpanStar[g];
    if (s) {
      const sClean = s.includes('天芮') ? '天芮' : s.replace(/星/g, '').trim();
      const origGongS = sClean === '天蓬' ? 1 :
        (sClean === '天芮' || sClean === '天禽') ? 2 :
        sClean === '天冲' ? 3 :
        sClean === '天辅' ? 4 :
        sClean === '天心' ? 6 :
        sClean === '天柱' ? 7 :
        sClean === '天任' ? 8 :
        sClean === '天英' ? 9 : 0;
      if (origGongS > 0) {
        if (origGongS !== g) isStarFuyin = false;
        if (origGongS !== 10 - g) isStarFanyin = false;
      }
    }
  }

  const badges = [];
  if (isMenFuyin) badges.push({ type: 'men-fu', name: '八门伏吟', desc: '八门全盘伏吟，大像停止不动、保持现状、保守难进' });
  if (isMenFanyin) badges.push({ type: 'men-fan', name: '八门反吟', desc: '八门全盘反吟，大像反复折腾、时好时坏、来回变动' });
  if (isStarFuyin) badges.push({ type: 'star-fu', name: '九星伏吟', desc: '九星全盘伏吟，天时不动、暗伏深沉' });
  if (isStarFanyin) badges.push({ type: 'star-fan', name: '九星反吟', desc: '九星全盘反吟，天时反背、气场反复' });

  // 增加五不遇时与时干入墓全局大像徽章
  if (pan.wuBuYu && pan.wuBuYu.hasSpecial) {
    if (pan.wuBuYu.isWuBuYu) {
      badges.push({
        type: 'wubuyu',
        name: pan.wuBuYu.isShiMu ? '五不遇时·时干入墓' : '五不遇时',
        desc: pan.wuBuYu.desc
      });
    } else if (pan.wuBuYu.isShiMu) {
      badges.push({
        type: 'shimu',
        name: '时干入墓',
        desc: pan.wuBuYu.desc
      });
    }
  }

  return { isMenFuyin, isMenFanyin, isStarFuyin, isStarFanyin, badges };
}

// 八门反吟、伏吟与落宫生克制化分析
export function getDoorShengkeAnalysis(door, gong, pan) {
  if (!door) return null;
  const dElem = DOOR_ORIGINAL_ELEMENT[door];
  const origPalace = DOOR_ORIGINAL_PALACE[door];
  const pInfo = DIPAN_PALACE_INFO[gong];
  if (!dElem || !pInfo) return null;

  const pElem = pInfo.element;
  const cat = DOOR_CATEGORY[door] || '平门';

  // 1. 判断单门反吟与伏吟 (对冲宫位: 10 - origPalace)
  let isFu = false;
  let isFan = false;
  if (origPalace) {
    if (gong === origPalace) {
      isFu = true;
    } else if (gong === 10 - origPalace) {
      isFan = true;
    }
  }

  // 2. 判断生克制化 (八门五行与落宫五行)
  let relationFormula = '';
  let relationMeaning = '';
  let relationType = '';

  if (WUXING_KE[dElem] === pElem) {
    // 门克宫为迫 (门迫)
    relationType = 'po';
    relationFormula = '门克宫为迫';
    if (cat === '吉门') {
      relationMeaning = '吉门被迫，吉字不成，办事受阻';
    } else if (cat === '凶门') {
      relationMeaning = '凶门被迫，凶事尤甚，阻力重重';
    } else {
      relationMeaning = '门迫受阻，阻滞多磨';
    }
  } else if (WUXING_KE[pElem] === dElem) {
    // 宫克门受制
    relationType = 'zhi';
    relationFormula = '宫克门受制';
    if (cat === '吉门') {
      relationMeaning = '吉门受克，吉力受压制、行动被动';
    } else if (cat === '凶门') {
      relationMeaning = '凶门受克制，凶意难逞、有所收敛';
    } else {
      relationMeaning = '行动被动，状态受压制';
    }
  } else if (WUXING_SHENG[pElem] === dElem) {
    // 宫生门得助
    relationType = 'sheng';
    relationFormula = '宫生门得助';
    if (cat === '吉门') {
      relationMeaning = '吉门得生扶，顺畅借力、大吉亨通';
    } else {
      relationMeaning = '得宫生扶，顺畅有力';
    }
  } else if (WUXING_SHENG[dElem] === pElem) {
    // 门生宫为泄
    relationType = 'xie';
    relationFormula = '门生宫泄气';
    relationMeaning = '门生宫耗泄，多耗心力、付出多';
  } else if (dElem === pElem) {
    // 门宫同气比和
    relationType = 'bi';
    relationFormula = '门宫比和';
    relationMeaning = '顺应自然、气势平稳';
  }

  // 3. 组合综合断语
  let text = '';
  if (isFan) {
    text = `门反吟，${relationFormula}：反复折腾，${relationMeaning}`;
  } else if (isFu) {
    text = `门伏吟，${relationFormula}：事情停止不动，保持原态`;
  } else {
    text = `${relationFormula}，${relationMeaning}`;
  }

  return {
    door,
    dElem,
    origPalace,
    origPalaceName: DIPAN_PALACE_INFO[origPalace] ? DIPAN_PALACE_INFO[origPalace].name : '',
    pElem,
    cat,
    isFu,
    isFan,
    relationType,
    relationFormula,
    relationMeaning,
    text
  };
}

// 逐项天盘实战象意生成 (根据九宫定位记忆法与《我用遁甲》)
export function getPalacePracticalAnalysis(pan, gong) {
  if (gong === 5 && pan.paipanMethod === 'zhuan') {
    return [];
  }

  const items = [];
  let step = 1;

  // 1、地盘宫位与月令旺衰影响 (根据叶鸿生《我用遁甲》第三步看宫位旺衰)
  const mem = JIUGONG_MEMORY_DATA[gong];
  if (mem) {
    const palaceBase = `${mem.bagua}: ${mem.gongDesc}`;
    const yuelingDesc = getPalaceYuelingAnalysis(pan, gong);
    const text1 = yuelingDesc ? `${palaceBase}（${yuelingDesc}）` : palaceBase;
    items.push({ step: step++, title: '地盘宫位', text: text1 });
  }

  // 2、干支克应 (根据九宫定位记忆法墓库长生)
  const tianGan = pan.tianpanGan[gong] || '';
  const diGan = pan.dipan[gong] || '';
  const jiGan = pan.tianpanJigan[gong] || (gong === 2 ? pan.dipan[5] : '');

  const ganzhiDesc = getGanzhiStateAnalysis(tianGan, gong, pan);
  if (ganzhiDesc) {
    items.push({ step: step++, title: '干支克应', text: ganzhiDesc });
  }

  // 3、十干克应 (实战象意断语，含天干相合与值符遁甲提示)
  const shiganDesc = getShiganPracticalText(tianGan, diGan, jiGan, pan, gong);
  if (shiganDesc) {
    items.push({ step: step++, title: '十干克应', text: shiganDesc });
  }

  // 4、九星 (根据九宫定位记忆法与九星旺衰口诀)
  const star = pan.tianpanStar[gong] || '';
  if (star) {
    let starClean = star;
    if (star.includes('天芮')) starClean = '天芮';
    const desc = STAR_PRACTICAL[starClean] || '秉令施为，各随本性';
    const wangshuai = getStarWangshuaiAnalysis(star, gong, pan);
    const starText = wangshuai && wangshuai.text
      ? `${starClean}星，${desc}（${wangshuai.text}）`
      : `${starClean}星，${desc}`;
    items.push({ step: step++, title: '九星', text: starText });

    if (star.includes('天芮') || star.includes('天禽')) {
      const qinDesc = STAR_PRACTICAL['天禽'] || '人物（中正忠厚／稳固包容）；事物（稳固中枢／调和包容）';
      const qinWangshuai = getStarWangshuaiAnalysis('天禽', gong, pan);
      const qinText = qinWangshuai && qinWangshuai.text
        ? `天禽星，${qinDesc}（${qinWangshuai.text}）`
        : `天禽星，${qinDesc}`;
      items.push({ step: step++, title: '九星', text: qinText });
    }
  }

  // 5、八门 (根据九宫定位记忆法与八门反吟伏吟生克制化)
  const door = pan.tianpanDoor[gong] || '';
  if (door) {
    const desc = DOOR_PRACTICAL[door] || '人事所司，动静分明';
    const doorAnalysis = getDoorShengkeAnalysis(door, gong, pan);
    const doorText = doorAnalysis && doorAnalysis.text
      ? `${door}，${desc}（${doorAnalysis.text}）`
      : `${door}，${desc}`;
    items.push({ step: step++, title: '八门', text: doorText });
  }

  // 6、八神 (心性与能量象意)
  const spirit = pan.tianpanSpirit[gong] || '';
  if (spirit) {
    const desc = SPIRIT_PRACTICAL[spirit] || '神明默佑，幽潜变化';
    items.push({ step: step++, title: '八神', text: `${spirit}，${desc}` });
  }

  return items;
}

// 权威 81 十干克应（含值符同甲）吉凶定性映射表
// 遵循《御定奇门宝鉴》《奇门遁甲秘笈大全》《烟波钓叟歌》正统断法
export const SHIGAN_STATUS_MAP = {
  // 戊 (甲子戊)
  '戊加戊': { status: '平', statusClass: 'ping', desc: '伏吟重峦，闭塞静守' },
  '戊加乙': { status: '吉', statusClass: 'ji', desc: '青龙合会，门吉事吉' },
  '戊加丙': { status: '大吉', statusClass: 'daji', desc: '青龙返首，百事大吉' },
  '戊加丁': { status: '吉', statusClass: 'ji', desc: '青龙耀明，谒贵求名吉利' },
  '戊加己': { status: '凶', statusClass: 'xiong', desc: '贵人入狱，公私皆不利' },
  '戊加庚': { status: '凶', statusClass: 'xiong', desc: '值符飞宫，吉事不吉，凶事更凶' },
  '戊加辛': { status: '凶', statusClass: 'xiong', desc: '青龙折足，招灾失财' },
  '戊加壬': { status: '凶', statusClass: 'xiong', desc: '青龙入天牢，凡事不利' },
  '戊加癸': { status: '吉', statusClass: 'ji', desc: '青龙华盖，门吉招福' },

  // 乙 (日奇)
  '乙加戊': { status: '凶', statusClass: 'xiong', desc: '阴害阳门，财破人伤' },
  '乙加乙': { status: '平', statusClass: 'ping', desc: '日奇伏吟，安分守己' },
  '乙加丙': { status: '吉', statusClass: 'ji', desc: '奇仪顺遂，迁官进职' },
  '乙加丁': { status: '吉', statusClass: 'ji', desc: '奇仪相佐，文书事吉，百事皆可谋' },
  '乙加己': { status: '平', statusClass: 'ping', desc: '日奇入雾，暗昧迟疑' },
  '乙加庚': { status: '凶', statusClass: 'xiong', desc: '日奇被刑，争讼败产，夫妻怀私' },
  '乙加辛': { status: '大凶', statusClass: 'daxiong', desc: '青龙逃走，奴仆拐带，六畜皆伤' },
  '乙加壬': { status: '凶', statusClass: 'xiong', desc: '日奇入地，尊卑悖乱，官讼是非' },
  '乙加癸': { status: '平', statusClass: 'ping', desc: '华盖逢星，遁迹隐形，避灾为吉' },

  // 丙 (月奇)
  '丙加戊': { status: '大吉', statusClass: 'daji', desc: '飞鸟跌穴，谋为百事洞彻' },
  '丙加乙': { status: '吉', statusClass: 'ji', desc: '日月并行，公谋私为皆吉' },
  '丙加丙': { status: '凶', statusClass: 'xiong', desc: '月奇悖师，文书逼迫，破耗遗失' },
  '丙加丁': { status: '吉', statusClass: 'ji', desc: '月奇朱雀，贵人文书吉利' },
  '丙加己': { status: '凶', statusClass: 'xiong', desc: '大悖入刑，囚人刑杖，文书不行' },
  '丙加庚': { status: '大凶', 'statusClass': 'daxiong', desc: '荧入太白，门户破败，盗贼耗失' },
  '丙加辛': { status: '吉', statusClass: 'ji', desc: '奇干相合，谋事就成，病人不凶' },
  '丙加壬': { status: '凶', statusClass: 'xiong', desc: '火入天罗，为客不利，是非颇多' },
  '丙加癸': { status: '凶', statusClass: 'xiong', desc: '华盖悖师，阴人害事，灾祸频生' },

  // 丁 (星奇)
  '丁加戊': { status: '吉', statusClass: 'ji', desc: '青龙转光，官人升迁，常人威昌' },
  '丁加乙': { status: '吉', statusClass: 'ji', desc: '人遁吉格，贵人加官进爵，常人婚姻财喜' },
  '丁加丙': { status: '吉', statusClass: 'ji', desc: '星随月转，贵人越级高升' },
  '丁加丁': { status: '吉', statusClass: 'ji', desc: '奇入太阴，文书即至，喜事遂心' },
  '丁加己': { status: '凶', statusClass: 'xiong', desc: '火入勾陈，奸私仇冤，事因女人' },
  '丁加庚': { status: '平', statusClass: 'ping', desc: '文书阻隔，行人必归' },
  '丁加辛': { status: '平', statusClass: 'ping', desc: '朱雀入狱，罪人释囚，官人释位' },
  '丁加壬': { status: '吉', statusClass: 'ji', desc: '五神互合，贵人恩诏，讼狱公平' },
  '丁加癸': { status: '大凶', statusClass: 'daxiong', desc: '朱雀投江，音信沉溺，文书俱消' },

  // 己
  '己加戊': { status: '吉', statusClass: 'ji', desc: '犬遇青龙，门吉谋望遂意' },
  '己加乙': { status: '平', statusClass: 'ping', desc: '墓神不明，宜遁迹隐形' },
  '己加丙': { status: '凶', statusClass: 'xiong', desc: '火悖地户，冤相害，阴人淫污' },
  '己加丁': { status: '平', statusClass: 'ping', desc: '朱雀入墓，文书词讼，先曲后直' },
  '己加己': { status: '大凶', statusClass: 'daxiong', desc: '地户逢鬼，病者必死，百事不遂' },
  '己加庚': { status: '凶', statusClass: 'xiong', desc: '刑格返名，先动不利，谋害之情' },
  '己加辛': { status: '凶', statusClass: 'xiong', desc: '游魂入墓，大人鬼魅，家先为祟' },
  '己加壬': { status: '凶', statusClass: 'xiong', desc: '地网高张，狡童佚女，奸情伤杀' },
  '己加癸': { status: '凶', statusClass: 'xiong', desc: '地刑玄武，疾病垂危，囚狱之灾' },

  // 庚
  '庚加戊': { status: '大凶', statusClass: 'daxiong', desc: '天乙伏宫，百事不可谋为，凶' },
  '庚加乙': { status: '平', statusClass: 'ping', desc: '太白逢星，退吉进凶' },
  '庚加丙': { status: '凶', statusClass: 'xiong', desc: '太白入荧，占贼必来，为客进利，为主破财' },
  '庚加丁': { status: '凶', statusClass: 'xiong', desc: '亭亭之格，私昵起官司' },
  '庚加己': { status: '凶', statusClass: 'xiong', desc: '刑格，官司被重刑' },
  '庚加庚': { status: '大凶', statusClass: 'daxiong', desc: '太白同宫，官灾横祸，兄弟雷攻' },
  '庚加辛': { status: '凶', statusClass: 'xiong', desc: '白虎干格，远行车折马死' },
  '庚加壬': { status: '凶', statusClass: 'xiong', desc: '上格，远行迷路，音信嗟呀' },
  '庚加癸': { status: '大凶', statusClass: 'daxiong', desc: '大格，母子俱伤，官司大凶' },

  // 辛
  '辛加戊': { status: '凶', statusClass: 'xiong', desc: '困龙被伤，官司破败，妄动祸殃' },
  '辛加乙': { status: '大凶', statusClass: 'daxiong', desc: '白虎猖狂，人亡家败，车船俱伤' },
  '辛加丙': { status: '平', statusClass: 'ping', desc: '干合相持，因财致讼' },
  '辛加丁': { status: '吉', statusClass: 'ji', desc: '狱神得奇，经商获倍利，囚人逢赦' },
  '辛加己': { status: '凶', statusClass: 'xiong', desc: '入狱自刑，奴仆背主，诉讼难伸' },
  '辛加庚': { status: '大凶', statusClass: 'daxiong', desc: '白虎出力，刀刃相接，主客相残' },
  '辛加辛': { status: '凶', statusClass: 'xiong', desc: '伏吟天庭，自罹罪名' },
  '辛加壬': { status: '凶', statusClass: 'xiong', desc: '凶蛇入狱，两男争女，诉讼不息' },
  '辛加癸': { status: '凶', statusClass: 'xiong', desc: '天牢华盖，日月失明，动止乖张' },

  // 壬
  '壬加戊': { status: '吉', statusClass: 'ji', desc: '小蛇化龙，男人发达，女产婴童' },
  '壬加乙': { status: '平', statusClass: 'ping', desc: '小蛇日奇，女利男滞，见喜不凶' },
  '壬加丙': { status: '凶', statusClass: 'xiong', desc: '水蛇入火，官灾刑禁，络绎不绝' },
  '壬加丁': { status: '平', statusClass: 'ping', desc: '干合蛇刑，文书牵连，男吉女凶' },
  '壬加己': { status: '凶', statusClass: 'xiong', desc: '反吟蛇刑，大祸将至，词讼理屈' },
  '壬加庚': { status: '平', statusClass: 'ping', desc: '太白擒蛇，讼狱公平，立剖邪正' },
  '壬加辛': { status: '凶', statusClass: 'xiong', desc: '螣蛇相缠，纵得吉门也不能安，被人欺瞒' },
  '壬加壬': { status: '凶', statusClass: 'xiong', desc: '蛇入地罗，外缠内索，谋事蹉跎' },
  '壬加癸': { status: '凶', statusClass: 'xiong', desc: '天网逢蛇，内有丑声，是非纷扰' },

  // 癸
  '癸加戊': { status: '吉', statusClass: 'ji', desc: '天乙会合，婚姻财喜，吉人相成' },
  '癸加乙': { status: '吉', statusClass: 'ji', desc: '华盖逢星，贵人禄位，常人平安' },
  '癸加丙': { status: '吉', statusClass: 'ji', desc: '华盖悖师，贵贱逢之，上人见喜' },
  '癸加丁': { status: '大凶', statusClass: 'daxiong', desc: '螣蛇夭矫，文书官司，火焚莫逃' },
  '癸加己': { status: '平', statusClass: 'ping', desc: '华盖地户，音信阻隔，躲灾为吉' },
  '癸加庚': { status: '凶', statusClass: 'xiong', desc: '太白入网，以暴争讼力平' },
  '癸加辛': { status: '大凶', statusClass: 'daxiong', desc: '网盖天牢，死罪莫逃' },
  '癸加壬': { status: '凶', statusClass: 'xiong', desc: '复见螣蛇，嫁娶重婚，后嫁无子' },
  '癸加癸': { status: '大凶', statusClass: 'daxiong', desc: '天网四张，行人失伴，病讼皆伤' },

  // 甲 (值符同甲)
  '甲加戊': { status: '吉', statusClass: 'ji', desc: '伏吟得助' },
  '甲加乙': { status: '吉', statusClass: 'ji', desc: '贵人相辅' },
  '甲加丙': { status: '大吉', statusClass: 'daji', desc: '青龙返首' },
  '甲加丁': { status: '吉', statusClass: 'ji', desc: '青龙耀明' },
  '甲加己': { status: '凶', statusClass: 'xiong', desc: '贵人入狱' },
  '甲加庚': { status: '凶', statusClass: 'xiong', desc: '值符飞宫' },
  '甲加辛': { status: '凶', statusClass: 'xiong', desc: '青龙折足' },
  '甲加壬': { status: '凶', statusClass: 'xiong', desc: '青龙入天牢' },
  '甲加癸': { status: '吉', statusClass: 'ji', desc: '青龙华盖' }
};

// 提炼十干克应吉凶与主事简评状态 (深度义理研判，杜绝“字面有吉即算吉”误判)
export function getShiganStatusSummary(text, key) {
  if (key && SHIGAN_STATUS_MAP[key]) {
    return SHIGAN_STATUS_MAP[key].status;
  }
  if (!text) return '平';

  // 尝试从 text 开头提取干干组合 (如 "壬加辛：..." 或 "壬加辛为...")
  const m = text.match(/^([甲乙丙丁戊己庚辛壬癸]加[甲乙丙丁戊己庚辛壬癸])/);
  if (m && SHIGAN_STATUS_MAP[m[1]]) {
    return SHIGAN_STATUS_MAP[m[1]].status;
  }

  // 滤除虚假的“吉”（如“纵得吉门”、“虽得吉门”、“吉事成凶”、“吉事不吉”、“躲灾避难为吉”、“静守为吉”、“退吉进凶”、“吉门有救”等让步条件或凶象转化）
  let cleanText = text
    .replace(/(纵得|虽得|纵有|虽有|纵使|即使|得二|得)吉门/g, '')
    .replace(/吉门(不能救|有救)/g, '')
    .replace(/吉事(成凶|不吉)/g, '')
    .replace(/见吉不吉|反吉为凶|化吉为凶|不吉|非吉|退吉进凶/g, '')
    .replace(/避灾(为吉)?|躲灾(为吉)?|遁迹(为吉)?|隐匿(为吉)?|静守为吉|安分守身|守分吉/g, '');

  // 1. 深度大吉判型
  if (cleanText.includes('青龙返首') || cleanText.includes('飞鸟跌穴') || cleanText.includes('大吉大利') || cleanText.includes('百事吉顺') || cleanText.includes('百事洞彻') || cleanText.includes('大吉')) {
    return '大吉';
  }

  // 2. 深度大凶判型
  if (cleanText.includes('青龙逃走') || cleanText.includes('朱雀投江') || cleanText.includes('白虎猖狂') || cleanText.includes('螣蛇夭矫') ||
      cleanText.includes('荧入太白') || cleanText.includes('太白同宫') || cleanText.includes('天网四张') || cleanText.includes('死罪莫逃') ||
      cleanText.includes('人亡家败') || cleanText.includes('母子俱伤') || cleanText.includes('血溅衣裳') || cleanText.includes('大祸将至') || cleanText.includes('大凶')) {
    return '大凶';
  }

  // 3. 凶格判型 (排除虚假吉后)
  if (cleanText.includes('相缠') || cleanText.includes('也不能安') || cleanText.includes('被人欺瞒') || cleanText.includes('欺瞒') ||
      cleanText.includes('破败') || cleanText.includes('破财') || cleanText.includes('失脱') || cleanText.includes('盗贼') ||
      cleanText.includes('官灾') || cleanText.includes('刑杖') || cleanText.includes('重刑') || cleanText.includes('刑格') || cleanText.includes('官司') || cleanText.includes('词讼') || cleanText.includes('争讼') ||
      cleanText.includes('夫妻离别') || cleanText.includes('夫妻怀私') || cleanText.includes('私昵') || cleanText.includes('自刑') ||
      cleanText.includes('入狱') || cleanText.includes('折足') || cleanText.includes('迷失道路') || cleanText.includes('车折马死') ||
      cleanText.includes('百事不利') || cleanText.includes('公私皆不利') || cleanText.includes('凶')) {
    return '凶';
  }

  // 4. 吉格判型
  if (cleanText.includes('奇仪相佐') || cleanText.includes('奇仪顺遂') || cleanText.includes('日月并行') || cleanText.includes('人遁') ||
      cleanText.includes('加官进爵') || cleanText.includes('高升') || cleanText.includes('升迁') || cleanText.includes('威昌') ||
      cleanText.includes('财喜') || cleanText.includes('喜事遂心') || cleanText.includes('获倍利') || cleanText.includes('小蛇化龙') ||
      cleanText.includes('百事皆可谋') || cleanText.includes('公谋私为皆吉') || cleanText.includes('吉')) {
    return '吉';
  }

  return '平';
}

// ----------------- 最实用“旬空填实”定应期分析器 (严格遵循叶鸿生标准：有旬空才显示，无旬空直接隐藏) -----------------
export function getYingqiXunKongAnalysis(pan, gong) {
  if (!pan || !gong) return null;

  const hourKw = (pan.kongwang && pan.kongwang.hour) ? pan.kongwang.hour : '';
  const palaceZhi = GONG_DIZHI[gong] || [];
  const matchedKongZhi = palaceZhi.filter(z => hourKw.includes(z));

  // 有旬空才显示，没有旬空直接隐藏该行 (返回 null)
  if (!matchedKongZhi || matchedKongZhi.length === 0) {
    return null;
  }

  const kongZhiStr = matchedKongZhi.join('');
  const kongZhiDisplay = matchedKongZhi.join('、');
  return {
    isKong: true,
    kongZhi: matchedKongZhi,
    content: `${kongZhiStr}空则虚，填${kongZhiStr}则实，由虚转实，事态发端或见分晓    短取${kongZhiStr}日/时，长取${kongZhiStr}月/年`,
    status: `【${kongZhiDisplay}】填实应期`,
    statusClass: 'special'
  };
}

// ----------------- 天盘实战克应与天干六变综合合并分析器 (严格遵循叶鸿生标准) -----------------
export function getPalaceMergedAnalysis(pan, gong) {
  if (gong === 5 && pan.paipanMethod === 'zhuan') return null;

  const tianGan = pan.tianpanGan[gong] || '';
  const diGan = pan.dipan[gong] || '';
  const jiGan = pan.tianpanJigan[gong] || (gong === 2 ? pan.dipan[5] : '');
  const star = pan.tianpanStar[gong] || '';
  const door = pan.tianpanDoor[gong] || '';
  const spirit = pan.tianpanSpirit[gong] || '';
  const mem = JIUGONG_MEMORY_DATA[gong];
  const pInfo = DIPAN_PALACE_INFO[gong];
  const gongName = GONG_CN[gong] + '宫';

  const rows = [];

  // 象意人象与事物结构化 HTML 生成器 (人物在第一行，事物在第二行，支持全部/物象/人象响应式切换)
  const formatRenWuHtml = (title, descText) => {
    if (!descText) return `<div class="imagery-cell-box"><div class="imagery-line"><span class="imagery-item-title">${title}</span></div></div>`;
    const match = descText.match(/人物[（(](.*?)[）)][；;]\s*事物[（(](.*?)[）)]/);
    if (match) {
      const ren = match[1];
      const wu = match[2];
      return `
        <div class="imagery-cell-box">
          <div class="imagery-aspect-row ren">
            <span class="imagery-item-title">${title}：</span>
            <span class="imagery-section-badge ren">人物</span>
            <span class="imagery-section-text ren">${ren}</span>
          </div>
          <div class="imagery-aspect-row wu">
            <span class="imagery-item-title">${title}：</span>
            <span class="imagery-section-badge wu">事物</span>
            <span class="imagery-section-text wu">${wu}</span>
          </div>
        </div>
      `.trim();
    }
    return `<div class="imagery-cell-box"><div class="imagery-line"><span class="imagery-item-title">${title}：</span><span class="imagery-section-text">${descText}</span></div></div>`;
  };

  // 1. 宫位
  const structuredYueling = getPalaceYuelingStructured(pan, gong);
  let cleanGongDesc = mem ? mem.gongDesc : '';
  let gongDescText = mem ? `${mem.bagua}为${cleanGongDesc}` : gongName;
  if (structuredYueling.formula) {
    gongDescText += `\n${structuredYueling.formula}`;
  }
  const gongHtml = `
    <div class="imagery-cell-box">
      <div class="imagery-line">
        <span class="imagery-item-title">${mem ? mem.bagua + '为' : ''}</span>
        <span class="imagery-section-text gong">${cleanGongDesc}</span>
      </div>
      ${structuredYueling.formula ? `
      <div class="imagery-line gong-formula-line">
        <span class="imagery-extra-text">${structuredYueling.formula}</span>
      </div>
      ` : ''}
    </div>
  `.trim();
  rows.push({
    tag: '宫位',
    tagClass: 'gong',
    content: gongDescText,
    html: gongHtml,
    status: structuredYueling.status || '平',
    statusClass: structuredYueling.status.includes('旺') ? 'wang' :
      (structuredYueling.status.includes('克') || structuredYueling.status.includes('制') || structuredYueling.status.includes('泄') || structuredYueling.status.includes('休') ? 'xiong' : 'ping')
  });

  // 2. 天盘干
  const stemInfo = TIANGAN_TIANPAN_INFO[tianGan] || TIANGAN_MERGED_INFO[tianGan] || { name: tianGan, stemText: `${tianGan}气数平顺`, wuXiang: '', renXiang: '' };
  let stemContent = `${stemInfo.name || tianGan}：人象外表（${stemInfo.renXiang || stemInfo.stemText || ''}）；物象外观（${stemInfo.wuXiang || stemInfo.stemText || ''}）`;
  let stemHtmlLines = `
    <div class="imagery-aspect-row ren">
      <span class="imagery-item-title">${stemInfo.name || tianGan}：</span>
      <span class="imagery-section-badge ren">人象外表</span>
      <span class="imagery-section-text ren">${stemInfo.renXiang || stemInfo.stemText || ''}</span>
    </div>
    <div class="imagery-aspect-row wu">
      <span class="imagery-item-title">${stemInfo.name || tianGan}：</span>
      <span class="imagery-section-badge wu">物象外观</span>
      <span class="imagery-section-text wu">${stemInfo.wuXiang || stemInfo.stemText || ''}</span>
    </div>
  `;
  if (jiGan && jiGan !== tianGan && jiGan !== diGan) {
    const jInfo = TIANGAN_TIANPAN_INFO[jiGan] || TIANGAN_MERGED_INFO[jiGan] || { name: jiGan, stemText: jiGan, wuXiang: '', renXiang: '' };
    stemContent += `；${jInfo.name || jiGan}：人象外表（${jInfo.renXiang || jInfo.stemText || ''}）；物象外观（${jInfo.wuXiang || jInfo.stemText || ''}）`;
    stemHtmlLines += `
    <div class="imagery-aspect-row ren is-jigan">
      <span class="imagery-jigan-title">${jInfo.name || jiGan}：</span>
      <span class="imagery-section-badge ren">人象外表</span>
      <span class="imagery-section-text ren">${jInfo.renXiang || jInfo.stemText || ''}</span>
    </div>
    <div class="imagery-aspect-row wu">
      <span class="imagery-jigan-title">${jInfo.name || jiGan}：</span>
      <span class="imagery-section-badge wu">物象外观</span>
      <span class="imagery-section-text wu">${jInfo.wuXiang || jInfo.stemText || ''}</span>
    </div>
    `;
  }
  const stemHtml = `<div class="imagery-cell-box">${stemHtmlLines}</div>`.trim();

  // 天盘干生旺死绝阶段
  const stageMap = TIANGAN_CHANGSHENG_MAP[tianGan] || {};
  const palaceZhi = pInfo ? (pInfo.dizhi || []) : [];
  const stagesDetail = palaceZhi.map(z => `${z}为${stageMap[z] || '平'}`).join('、');
  const stageKey = `${tianGan}-${gong}`;
  const keyStageDesc = TIANGAN_KEY_STAGE_MEANINGS[stageKey] || '';
  const stagesPrefix = palaceZhi.map(z => `落${z}为${stageMap[z] || '平'}`).join('、');
  let stemStatus = stagesPrefix ? `${stagesPrefix}，${keyStageDesc || '气数平顺'}` : (keyStageDesc || '气数平顺');
  let stemStatusClass = 'ping';
  if (keyStageDesc.includes('入墓') || keyStageDesc.includes('自刑') || keyStageDesc.includes('击刑')) {
    stemStatusClass = 'xiong';
  } else if (keyStageDesc.includes('长生')) {
    stemStatusClass = 'wang';
  }
  rows.push({
    tag: '天盘干',
    tagClass: 'stem',
    content: stemContent,
    html: stemHtml,
    status: stemStatus,
    statusClass: stemStatusClass
  });

  // 2.1 地盘干
  if (diGan) {
    const diStemInfo = TIANGAN_DIPAN_INFO[diGan] || TIANGAN_MERGED_INFO[diGan] || { name: diGan, stemText: `${diGan}气数平顺`, wuXiang: '', renXiang: '' };
    let diStemContent = `${diStemInfo.name || diGan}：人象心性（${diStemInfo.renXiang || diStemInfo.stemText || ''}）；物象材质（${diStemInfo.wuXiang || diStemInfo.stemText || ''}）`;
    let diStemHtmlLines = `
      <div class="imagery-aspect-row ren">
        <span class="imagery-item-title">${diStemInfo.name || diGan}：</span>
        <span class="imagery-section-badge ren">人象心性</span>
        <span class="imagery-section-text ren">${diStemInfo.renXiang || diStemInfo.stemText || ''}</span>
      </div>
      <div class="imagery-aspect-row wu">
        <span class="imagery-item-title">${diStemInfo.name || diGan}：</span>
        <span class="imagery-section-badge wu">物象材质</span>
        <span class="imagery-section-text wu">${diStemInfo.wuXiang || diStemInfo.stemText || ''}</span>
      </div>
    `;
    const diJiGan = (gong === 2 && pan.paipanMethod === 'zhuan' && pan.dipan[5] && pan.dipan[5] !== diGan) ? pan.dipan[5] : '';
    if (diJiGan) {
      const djInfo = TIANGAN_DIPAN_INFO[diJiGan] || TIANGAN_MERGED_INFO[diJiGan] || { name: diJiGan, stemText: diJiGan, wuXiang: '', renXiang: '' };
      diStemContent += `；${djInfo.name || diJiGan}：人象心性（${djInfo.renXiang || djInfo.stemText || ''}）；物象材质（${djInfo.wuXiang || djInfo.stemText || ''}）`;
      diStemHtmlLines += `
      <div class="imagery-aspect-row ren is-jigan">
        <span class="imagery-jigan-title">${djInfo.name || diJiGan}：</span>
        <span class="imagery-section-badge ren">人象心性</span>
        <span class="imagery-section-text ren">${djInfo.renXiang || djInfo.stemText || ''}</span>
      </div>
      <div class="imagery-aspect-row wu">
        <span class="imagery-jigan-title">${djInfo.name || diJiGan}：</span>
        <span class="imagery-section-badge wu">物象材质</span>
        <span class="imagery-section-text wu">${djInfo.wuXiang || djInfo.stemText || ''}</span>
      </div>
      `;
    }
    const diStemHtml = `<div class="imagery-cell-box">${diStemHtmlLines}</div>`.trim();

    const diStageMap = TIANGAN_CHANGSHENG_MAP[diGan] || {};
    const diStageKey = `${diGan}-${gong}`;
    const diKeyStageDesc = TIANGAN_KEY_STAGE_MEANINGS[diStageKey] || '';
    const diStagesPrefix = palaceZhi.map(z => `落${z}为${diStageMap[z] || '平'}`).join('、');
    let diStemStatus = diStagesPrefix ? `${diStagesPrefix}，${diKeyStageDesc || '气数平顺'}` : (diKeyStageDesc || '气数平顺');
    let diStemStatusClass = 'ping';
    if (diKeyStageDesc.includes('入墓') || diKeyStageDesc.includes('自刑') || diKeyStageDesc.includes('击刑')) {
      diStemStatusClass = 'xiong';
    } else if (diKeyStageDesc.includes('长生')) {
      diStemStatusClass = 'wang';
    }
    rows.push({
      tag: '地盘干',
      tagClass: 'digan',
      content: diStemContent,
      html: diStemHtml,
      status: diStemStatus,
      statusClass: diStemStatusClass
    });
  }

  // 3. 星
  let starClean = star ? (star.includes('天芮') ? '天芮' : star.replace(/星/g, '').trim()) : '';
  let starDesc = STAR_PRACTICAL[starClean] || (mem ? mem.starDesc : '');
  const starAnalysis = getStarWangshuaiAnalysis(starClean, gong, pan);
  let starStatus = '平';
  let starStatusClass = 'ping';
  if (starAnalysis) {
    const formulaPart = [starAnalysis.gongFormula, starAnalysis.monthFormula]
      .filter(Boolean)
      .map(f => f.replace(/为.*/, ''))
      .join('、');
    starStatus = formulaPart ? `${formulaPart}，${starAnalysis.summary}` : starAnalysis.summary;
    if (starAnalysis.summary.includes('旺相')) starStatusClass = 'wang';
    else if (starAnalysis.summary.includes('休囚') || starAnalysis.summary.includes('没有用处')) starStatusClass = 'xiong';
  }
  rows.push({
    tag: '九星',
    tagClass: 'star',
    content: `${starClean}星：${starDesc}`,
    html: formatRenWuHtml(`${starClean}星`, starDesc),
    status: starStatus,
    statusClass: starStatusClass
  });

  // 如果此宫临天芮星（转盘中五天禽寄天芮），在天芮星下面增加天禽星的判定
  if (starClean === '天芮' || (star && star.includes('天芮')) || (pan.tianpanStar && pan.tianpanStar[gong] && pan.tianpanStar[gong].includes('天芮'))) {
    const qinAnalysis = getStarWangshuaiAnalysis('天禽', gong, pan);
    let qinStatus = '平';
    let qinStatusClass = 'ping';
    if (qinAnalysis) {
      const formulaPart = [qinAnalysis.gongFormula, qinAnalysis.monthFormula]
        .filter(Boolean)
        .map(f => f.replace(/为.*/, ''))
        .join('、');
      qinStatus = formulaPart ? `${formulaPart}，${qinAnalysis.summary}` : qinAnalysis.summary;
      if (qinAnalysis.summary.includes('旺相')) qinStatusClass = 'wang';
      else if (qinAnalysis.summary.includes('休囚') || qinAnalysis.summary.includes('没有用处')) qinStatusClass = 'xiong';
    }
    const qinDesc = STAR_PRACTICAL['天禽'] || '人物（中正忠厚／稳固包容）；事物（稳固中枢／调和包容）';
    rows.push({
      tag: '九星',
      tagClass: 'star',
      content: `天禽星：${qinDesc}`,
      html: formatRenWuHtml('天禽星', qinDesc),
      status: qinStatus,
      statusClass: qinStatusClass
    });
  }

  // 4. 门
  let doorDesc = DOOR_PRACTICAL[door] || (mem ? mem.doorDesc : '');
  const doorAnalysis = getDoorShengkeAnalysis(door, gong, pan);
  let doorStatus = '平';
  let doorStatusClass = 'ping';
  if (doorAnalysis) {
    if (doorAnalysis.isFan) {
      doorStatus = `门反吟，${doorAnalysis.relationFormula}：反复折腾，${doorAnalysis.relationMeaning}`;
      doorStatusClass = 'xiong';
    } else if (doorAnalysis.isFu) {
      doorStatus = `门伏吟，${doorAnalysis.relationFormula}：事情停止不动、保持原态`;
      doorStatusClass = 'xiong';
    } else {
      doorStatus = `${doorAnalysis.relationFormula}，${doorAnalysis.relationMeaning}`;
      if (doorAnalysis.relationType === 'po' || doorAnalysis.relationType === 'zhi') doorStatusClass = 'xiong';
      else if (doorAnalysis.relationType === 'sheng' || doorAnalysis.relationType === 'bi') doorStatusClass = 'wang';
    }
  }
  rows.push({
    tag: '八门',
    tagClass: 'door',
    content: `${door}：${doorDesc}`,
    html: formatRenWuHtml(door, doorDesc),
    status: doorStatus,
    statusClass: doorStatusClass
  });

  // 5. 神
  let spiritDesc = SPIRIT_PRACTICAL[spirit] || '';
  rows.push({
    tag: '八神',
    tagClass: 'spirit',
    content: `${spirit}：${spiritDesc}`,
    html: formatRenWuHtml(spirit, spiritDesc),
    status: '',
    statusClass: 'ping'
  });

  // 6. 十干克应 (支持多个组合，如主干加地盘干、寄干加地盘干、值符同甲加地盘干)
  const formatKeyingContent = (k, raw) => {
    if (!raw) return k;
    const body = raw.replace(/^为/, '').replace(/。$/, '');
    const cleaned = body.replace(/[“”]/g, '').replace(/：/, '，');
    return `${k}：${cleaned}`;
  };

  const getStatusObj = (k, v) => {
    if (k && SHIGAN_STATUS_MAP[k]) {
      return { status: SHIGAN_STATUS_MAP[k].status, statusClass: SHIGAN_STATUS_MAP[k].statusClass };
    }
    const status = getShiganStatusSummary(v, k);
    let statusClass = 'ping';
    if (status.includes('大吉')) statusClass = 'daji';
    else if (status.includes('吉')) statusClass = 'ji';
    else if (status.includes('大凶')) statusClass = 'daxiong';
    else if (status.includes('凶')) statusClass = 'xiong';
    return { status, statusClass };
  };

  const shiganItems = [];

  // 1) 主干加地盘干
  if (tianGan && diGan) {
    const k1 = `${tianGan}加${diGan}`;
    const v1 = SHIGAN_PRACTICAL[k1] || SHIGAN_KEYING[k1] || '';
    if (v1) {
      const s1 = getStatusObj(k1, v1);
      shiganItems.push({
        key: k1,
        name: k1,
        content: formatKeyingContent(k1, v1),
        status: s1.status,
        statusClass: s1.statusClass
      });
    }
  }

  // 2) 寄干加地盘干
  if (jiGan && jiGan !== diGan && jiGan !== tianGan) {
    const k2 = `${jiGan}加${diGan}`;
    const v2 = SHIGAN_PRACTICAL[k2] || SHIGAN_KEYING[k2] || '';
    if (v2) {
      const s2 = getStatusObj(k2, v2);
      shiganItems.push({
        key: k2,
        name: k2,
        content: formatKeyingContent(k2, v2),
        status: s2.status,
        statusClass: s2.statusClass
      });
    }
  }

  // 3) 顶值符见甲克应提示
  const isZhiFu = (spirit === '值符' || (pan && pan.shiGong === gong));
  if (isZhiFu && tianGan !== '甲') {
    const kj = `甲加${diGan}`;
    const vj = SHIGAN_PRACTICAL[kj] || SHIGAN_KEYING[kj] || '';
    if (vj) {
      const sj = getStatusObj(kj, vj);
      shiganItems.push({
        key: kj,
        name: kj,
        content: `${formatKeyingContent(kj, vj)}（值符同甲）`,
        status: sj.status,
        statusClass: sj.statusClass
      });
    }
  }

  const defaultKeying = shiganItems[0] || {
    key: `${tianGan}加${diGan}`,
    name: `${tianGan}加${diGan}`,
    content: `${tianGan}加${diGan}：无特定克应`,
    status: '平',
    statusClass: 'ping'
  };

  rows.push({
    tag: '十干克应',
    tagClass: 'keying',
    content: defaultKeying.content,
    fullContent: shiganItems.map(it => it.content).join('；'),
    status: defaultKeying.status,
    statusClass: defaultKeying.statusClass,
    items: shiganItems
  });

  // 获取天干六种变化结构
  const sc = getTianganSixChanges(pan, gong);

  // 7. 遁甲 —— 铁律：没有状态可以不显示！
  if (sc && sc.dunjia && sc.dunjia.hasDunjia && isZhiFu) {
    rows.push({
      tag: '遁甲',
      tagClass: 'dunjia',
      content: sc.dunjia.desc,
      status: '值符同甲',
      statusClass: 'special'
    });
  }

  // 8. 相合 —— 铁律：没有状态可以不显示！
  if (sc && sc.he && sc.he.isHe) {
    const isTianActive = TIANGAN_HE_ACTIVE_STEMS.has(tianGan);
    rows.push({
      tag: '相合',
      tagClass: 'he',
      content: sc.he.desc,
      status: `${sc.he.pair}（${isTianActive ? '主动牵挂' : '被动受合'}）`,
      statusClass: 'ji'
    });
  }

  // 9. 相刑 —— 铁律：没有状态可以不显示！
  if (sc && sc.xing && sc.xing.isXing) {
    rows.push({
      tag: '相刑',
      tagClass: 'xing',
      content: sc.xing.desc,
      status: sc.xing.type === 'zixing' ? '六仪自刑' : '六仪击刑',
      statusClass: 'xiong'
    });
  }

  // 10. 生旺死绝
  const shengwangContent = stagesDetail ? `天盘${tianGan}落${gongName}：${stagesDetail}` : `天盘${tianGan}落${gongName}`;
  rows.push({
    tag: '生旺死绝',
    tagClass: 'shengwang',
    content: shengwangContent,
    status: keyStageDesc || '气数平顺',
    statusClass: stemStatusClass
  });

  // 12. 定应期 (有旬空才显示，无旬空直接隐藏该行，严格遵循叶鸿生标准)
  const yingqi = getYingqiXunKongAnalysis(pan, gong);
  if (yingqi && yingqi.isKong) {
    rows.push({
      tag: '定应期',
      tagClass: 'yingqi',
      content: yingqi.content,
      status: yingqi.status,
      statusClass: yingqi.statusClass
    });
  }

  // 12.5 马星判定 (严格位于典籍印证前面一行)
  // 准则:
  // - 日干或者人物用神的宫位临马星，代表他正在动
  // - 如果是事情“值符、时干”临马星，指这个事情正在进行中
  // - 说的直白一点，只要用神宫位有马星，就代表他在动
  const flag = (pan && pan.palaceFlags && pan.palaceFlags[gong]) ? pan.palaceFlags[gong] : {};
  const hasMa = !!flag.hasMa;

  if (hasMa) {
    const isDayGan = (tianGan === (pan && pan.dayGan));
    const isShiGan = (tianGan === (pan && pan.shiGan));
    const currentYongShen = (pan && pan.selectedYongShen) ? pan.selectedYongShen : ((typeof state !== 'undefined' && state.selectedYongShen) ? state.selectedYongShen : ['值符']);
    const curQuestion = (pan && pan.userQuestion !== undefined) ? pan.userQuestion : ((typeof state !== 'undefined' && state.userQuestion) ? state.userQuestion : '');
    const curNature = (pan && pan.yongshenNature !== undefined) ? pan.yongshenNature : ((typeof state !== 'undefined' && state.yongshenNature) ? state.yongshenNature : 'auto');

    const matchRes = checkPalaceMatchYongShen(pan, gong, currentYongShen);
    const isYsMatch = matchRes && matchRes.matched;
    const isPersonObj = isYongShenPersonOrObject(currentYongShen, curQuestion, curNature);

    let maContent = '';
    let maStatus = '正在动';
    let maStatusClass = 'special';

    if (isYsMatch) {
      if (isDayGan || isPersonObj) {
        maContent = `日干/人物用神【${matchRes.items.join('、')}】临马星：代表其人正在动、出行奔波、身处变动中，主动求变、行色匆匆`;
        maStatus = '正在动';
        maStatusClass = 'special';
      } else if (isZhiFu || isShiGan) {
        maContent = `值符/时干【${matchRes.items.join('、')}】临马星：代表所问事项正在快速进行中、事态推进、瞬息万变`;
        maStatus = '进行中';
        maStatusClass = 'special';
      } else {
        maContent = `用神【${matchRes.items.join('、')}】临马星：只要用神宫位有马星，即代表其人/事正在动，处于快速变动发展中`;
        maStatus = '正在动';
        maStatusClass = 'special';
      }
    } else if (isDayGan) {
      maContent = `日干【${pan.dayGan}】临马星：代表求测人自身正在动、有出行走动、奔波或身处变动之中`;
      maStatus = '正在动';
      maStatusClass = 'ji';
    } else if (isZhiFu || isShiGan) {
      maContent = `值符/时干【${pan.shiGan}】临马星：代表所问事项正在快速进行中、事态推进疾速、瞬息万变`;
      maStatus = '进行中';
      maStatusClass = 'ji';
    } else {
      maContent = `宫临马星：主快速变动、出行走动、事态加速推进、蓄势待发之象`;
      maStatus = '动态疾速';
      maStatusClass = 'ping';
    }

    rows.push({
      tag: '马星',
      tagClass: 'maxing',
      content: maContent,
      status: maStatus,
      statusClass: maStatusClass
    });
  }

  // 13. 典籍印证列表
  const classicEvidence = [];
  const addClassic = (k) => {
    if (SHIGAN_KEYING[k]) {
      const c = SHIGAN_KEYING[k].replace(/^为/, '').replace(/[“”]/g, '').replace(/：/, '，').replace(/。$/, '');
      classicEvidence.push(`${k}：${c}。`);
    }
  };
  if (tianGan && diGan) {
    addClassic(`${tianGan}加${diGan}`);
  }
  if (jiGan && jiGan !== diGan && jiGan !== tianGan) {
    addClassic(`${jiGan}加${diGan}`);
  }
  if (isZhiFu && tianGan !== '甲' && diGan) {
    addClassic(`甲加${diGan}`);
  }

  return {
    gong,
    gongName,
    title: `『${gongName}』`,
    rows,
    classicEvidence
  };
}

// ----------------- 克应速查匹配 -----------------
export function getPalaceAnalysis(pan, gong) {
  if (gong === 5 && pan.paipanMethod === 'zhuan') {
    return {
      gong: 5,
      title: '『中宫』',
      practicalList: [],
      sixChanges: null,
      mergedAnalysis: null,
      shigan: []
    };
  }

  const gongName = GONG_CN[gong] + '宫';
  const tianGan = pan.tianpanGan[gong] || '';
  const diGan = pan.dipan[gong] || '';
  const jiGan = pan.tianpanJigan[gong] || (gong === 2 ? pan.dipan[5] : '');

  // 1. 十干克应
  const shiganList = [];
  const seenShiganKeys = new Set();
  function matchShigan(tg, dg) {
    if (!tg || !dg) return;
    const key = `${tg}加${dg}`;
    if (seenShiganKeys.has(key)) return;
    if (SHIGAN_KEYING[key]) {
      seenShiganKeys.add(key);
      shiganList.push({ key, text: SHIGAN_KEYING[key] });
    }
  }

  matchShigan(tianGan, diGan);
  if (jiGan && jiGan !== diGan && jiGan !== tianGan) {
    matchShigan(jiGan, diGan);
  }

  // 顶值符见甲克应 (甲即值符同戊，凡见值符即为甲)
  const spirit = pan.tianpanSpirit[gong] || '';
  const isZhiFu = (spirit === '值符' || pan.shiGong === gong);
  if (isZhiFu && tianGan !== '甲') {
    matchShigan('甲', diGan);
  }

  // 八门动静克应和九星值时克应已按用户要求彻底移除

  return {
    gong,
    title: `『${gongName}』`,
    practicalList: getPalacePracticalAnalysis(pan, gong),
    sixChanges: getTianganSixChanges(pan, gong),
    mergedAnalysis: getPalaceMergedAnalysis(pan, gong),
    shigan: shiganList
  };
}

// ----------------- 复制奇门纯文本格式化 (100% 原版风格) -----------------
export function formatPlainQimen(pan) {
  const p = pan;
  const methodTitle = p.paipanMethod === 'zhuan' ? '排宫法' : '飞宫法';
  const dingjuTitle = p.dingjuMethod === 'zhirun' ? '置闰' : (p.dingjuMethod === 'chaibu' ? '拆补' : '茅山');

  let text = `公历：${p.rawInput.year}年${String(p.rawInput.month).padStart(2, '0')}月${String(p.rawInput.day).padStart(2, '0')}日${p.rawInput.hour}时${p.rawInput.minute}分　　星期${p.weekDay}\n`;
  text += `节气：${p.termInfo.current.name}：${String(p.termInfo.current.month).padStart(2, '0')}月${String(p.termInfo.current.day).padStart(2, '0')}日${p.termInfo.current.hour}时${p.termInfo.current.minute}分　　${p.termInfo.next.name}：${String(p.termInfo.next.month).padStart(2, '0')}月${String(p.termInfo.next.day).padStart(2, '0')}日${p.termInfo.next.hour}时${p.termInfo.next.minute}分\n`;
  text += `真时：${p.trueTime.year}年${String(p.trueTime.month).padStart(2, '0')}月${String(p.trueTime.day).padStart(2, '0')}日${p.trueTime.hour}时${p.trueTime.minute}分　　${p.rawInput.cityName || '北京 天安门'}(东经${p.rawInput.longitude}度)\n`;
  text += `农历：${p.pillars.year}年　${p.lunar.lunarMonthName}　${p.lunar.lunarDayName}　　　${p.shichenTitle}　${p.pillars.hour[1]}时\n`;
  const wubuyuTag = (p.wuBuYu && p.wuBuYu.hasSpecial) ? `　　${p.wuBuYu.tag}` : '';
  text += `干支：${p.pillars.year}　${p.pillars.month}　${p.pillars.day}　${p.pillars.hour}　　　${p.dingju.desc}${wubuyuTag}\n`;
  text += `旬空：${p.kongwang.year}　${p.kongwang.month}　${p.kongwang.day}　${p.kongwang.hour}　　 旬首：${p.xun}\n`;
  const GONG_NUM = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '七', 8: '八', 9: '九' };
  text += `值符${p.starFu}在${GONG_NUM[p.shiGong]}宫　　　值使${p.doorShi}在${GONG_NUM[p.doorShiGong]}宫　　奇门遁甲${dingjuTitle}${methodTitle}\n\n`;

  // 九宫布局 3x3 字符网格
  // 宫格顺序:
  // [4, 9, 2]
  // [3, 5, 7]
  // [8, 1, 6]
  const rows = [
    [4, 9, 2],
    [3, 5, 7],
    [8, 1, 6]
  ];

  function getCellLines(g) {
    if (g === 5 && p.paipanMethod === 'zhuan') {
      const dg5 = p.dipan[5] || '　';
      return [
        '　　　　　　　',
        `　　　${dg5}　　　`,
        '　　　　　　　'
      ];
    }

    const spirit = p.tianpanSpirit[g] || '　　';
    const flag = (p.palaceFlags && p.palaceFlags[g]) || {};
    const isKong = !!flag.isKong;
    const hasMa = !!flag.hasMa;
    const angan = (p.showAngan && p.anganMap && p.anganMap[g]) ? p.anganMap[g].join('') : '';

    let line1;
    if (isKong && hasMa) {
      line1 = angan ? `${spirit}旬空[马星]${angan}` : `${spirit}　旬空[马星]`;
    } else if (isKong) {
      line1 = angan ? `${spirit}　旬空　　${angan}` : `${spirit}　旬空　　　`;
    } else if (hasMa) {
      line1 = angan ? `${spirit}　　[马星]${angan}` : `${spirit}　　[马星]　`;
    } else {
      line1 = angan ? `${spirit}　　　　　${angan}` : `${spirit}　　　　　　`;
    }

    let starRaw = p.tianpanStar[g] || '　　';
    if (starRaw.includes('天芮')) starRaw = '天芮禽';
    const star = starRaw.padEnd(4, ' ');
    const tg = p.tianpanGan[g] || ' ';
    const jigan = p.tianpanJigan[g] ? `${p.tianpanJigan[g]}` : '　';
    let line2 = `　　${star}　${tg}　${jigan}`;

    const door = p.tianpanDoor[g] || '　　';
    const dg = p.dipan[g] || ' ';
    const extra = (g === 2 && p.dipan[5]) ? `${p.dipan[5]}` : '　';
    let line3 = `　　${door}　${dg}　${extra}`;

    return [line1, line2, line3];
  }

  text += '┌──────────────┬──────────────┬──────────────┐\n';
  for (let r = 0; r < 3; r++) {
    const c0 = getCellLines(rows[r][0]);
    const c1 = getCellLines(rows[r][1]);
    const c2 = getCellLines(rows[r][2]);
    for (let l = 0; l < 3; l++) {
      text += `│${c0[l]}│${c1[l]}│${c2[l]}│\n`;
    }
    if (r < 2) {
      text += '├──────────────┼──────────────┼──────────────┤\n';
    }
  }
  text += '└──────────────┴──────────────┴──────────────┘\n';

  return text;
}

// ----------------- 查找格局匹配引擎 -----------------
export const SEARCH_PRESETS = {
  '青龙返首': { tianGan: '戊', diGan: '丙' },
  '飞鸟跌穴': { tianGan: '丙', diGan: '戊' },
  '天遁': { tianGan: '丙', door: '生门' },
  '地遁': { tianGan: '乙', door: '开门', diGan: '己' },
  '人遁': { tianGan: '丁', door: '休门', tianSpirit: '太阴' },
  '风遁': { gong: 4, tianGan: '乙', door: '开门' },
  '云遁': { gong: 2, tianGan: '乙', door: '开门' },
  '龙遁': { gong: 1, tianGan: '乙', door: '休门' },
  '虎遁': { gong: 8, tianGan: '辛', door: '休门' },
  '神遁': { tianGan: '丙', door: '生门', tianSpirit: '九天' },
  '鬼遁': { tianGan: '丁', door: '杜门', tianSpirit: '九地' },
  '真诈': { doors: ['休门', '生门', '开门'], qis: ['乙', '丙', '丁'], tianSpirit: '太阴' },
  '休诈': { doors: ['休门', '生门', '开门'], qis: ['乙', '丙', '丁'], tianSpirit: '六合' },
  '重诈': { doors: ['休门', '生门', '开门'], qis: ['乙', '丙', '丁'], tianSpirit: '九地' },
  '天假': { door: '景门', tianGan: '乙', tianSpirit: '九天' },
  '地假': { door: '杜门', tianGan: '丁', tianSpirit: '九地' },
  '人假': { door: '惊门', tianGan: '壬', tianSpirit: '太阴' },
  '神假': { door: '伤门', tianGan: '丁', tianSpirit: '九天' },
  '鬼假': { door: '死门', tianGan: '癸', tianSpirit: '九地' }
};

export function matchPatternCondition(pan, conditions) {
  if (!conditions || Object.keys(conditions).length === 0) return true;
  for (const gongStr of Object.keys(conditions)) {
    const g = parseInt(gongStr);
    const cond = conditions[g];
    if (!cond) continue;

    if (cond.tianSpirit && pan.tianpanSpirit[g] !== cond.tianSpirit) return false;
    if (cond.star) {
      if (pan.tianpanStar[g] !== cond.star) {
        if (!(g === 2 && cond.star === '天禽' && pan.tianpanStar[g] === '天芮')) return false;
      }
    }
    if (cond.tianGan) {
      const hasGan = pan.tianpanGan[g] === cond.tianGan || (g === 2 && pan.tianpanJigan && pan.tianpanJigan[2] === cond.tianGan);
      if (!hasGan) return false;
    }
    if (cond.qis && Array.isArray(cond.qis)) {
      const hasQi = cond.qis.includes(pan.tianpanGan[g]) || (g === 2 && pan.tianpanJigan && cond.qis.includes(pan.tianpanJigan[2]));
      if (!hasQi) return false;
    }
    if (cond.door && pan.tianpanDoor[g] !== cond.door) return false;
    if (cond.doors && Array.isArray(cond.doors)) {
      if (!cond.doors.includes(pan.tianpanDoor[g])) return false;
    }
    if (cond.diGan && pan.dipan[g] !== cond.diGan) return false;
    if (cond.diSpirit && pan.dipanSpirit && pan.dipanSpirit[g] !== cond.diSpirit) return false;
  }
  return true;
}

