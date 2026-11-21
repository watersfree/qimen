// 分步排盘讲解 (Paipan Step Trace)
// 从排盘引擎输出的中间结果(定局、地盘、旬首、值符值使、天盘)还原每一步，
// 保证讲解与实际计算一致。顺序按叶鸿生“手工起局”七步展开，最后落到他的四层读盘法。

import {
  BAGUA_RING, RING_INDEX, JIUGONG_SEQ, GONG_CN, STAR_HOME, DOOR_HOME,
  YIQI_SEQ, JU_TABLE, SPIRITS_ZHUAN, futouYuan, GONG_DIZHI
} from './qimen.js';
import { JIAZI, DIZHI } from './calendar.js';

const NUM_CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const GUA = { 1: '坎', 2: '坤', 3: '震', 4: '巽', 5: '中', 6: '乾', 7: '兑', 8: '艮', 9: '离' };

function gname(g) { return `${GUA[g]}${NUM_CN[g]}宫`; }

function pad2(n) { return String(n).padStart(2, '0'); }

// 每一步要显示的图层：base(宫卦地支) dipan(地盘干) home(九星八门原位) star door spirit tiangan marks(空/马)
// highlight: 需要高亮的宫；arrows: [from,to] 走位；answer: 练习模式要点出的宫(可多选，任一即对)
export function buildPaipanSteps(pan) {
  if (!pan) return [];
  const steps = [];
  const isZhuan = pan.paipanMethod === 'zhuan';
  const dj = pan.dingju || {};
  const dun = pan.dun;
  const ju = pan.ju;
  const p = pan.pillars;
  const term = pan.termInfo && pan.termInfo.current;
  const manual = /报数|录入|指定/.test(dj.desc || '');

  // 1. 四柱与节气
  steps.push({
    key: 'pillars',
    title: '第一步 · 查当下干支与节气',
    rule: '奇门以“时”为用：年月日时四柱定好，再看当下处于哪个节气。节气换月、立春换年。',
    detail: `四柱：${p.year}年 ${p.month}月 ${p.day}日 ${p.hour}时。` +
      (term ? `当前节气：${term.name}（${pad2(term.month)}-${pad2(term.day)} ${pad2(term.hour)}:${pad2(term.minute)} 交节）。` : '') +
      `月令（月支）为“${p.month[1]}”，后面看宫位、九星旺衰都以它为纲。`,
    layers: ['base'],
    highlight: []
  });

  // 2. 定元
  if (!manual) {
    const dayIdx = JIAZI.indexOf(p.day);
    const fy = dayIdx >= 0 ? futouYuan(dayIdx) : null;
    let methodText = '';
    if (pan.dingjuMethod === 'zhirun') {
      methodText = `置闰法：符头与节气的先后决定用哪个节气的局。本局状态：${dj.state || '—'}（正授＝符头与节气同到；超神＝符头先到；接气＝符头后到；芒种、大雪时超神过多则置闰）。`;
    } else if (pan.dingjuMethod === 'chaibu') {
      methodText = '拆补法：交节即换节气，上中下元只看符头地支。';
    } else {
      methodText = '茅山法：从交节时刻起，每 5 天（120 小时）为一元。';
    }
    steps.push({
      key: 'yuan',
      title: '第二步 · 找符头，定上中下元',
      rule: '从当日往前找甲日或己日为“符头”：符头地支子午卯酉为上元，寅申巳亥为中元，辰戌丑未为下元。',
      detail: `${fy ? `今日 ${p.day}，往前数到符头 ${fy.futouGanzhi}（今日是这一元的第 ${fy.dayInYuan} 天）。` : ''}${methodText} 结果：${dj.termName || ''}${dj.yuanName || ''}。`,
      layers: ['base'],
      highlight: []
    });
  } else {
    steps.push({
      key: 'yuan',
      title: '第二步 · 起局方式',
      rule: '叶鸿生：错过时机、或同一件事要再看时，用报数起局——报 1~9 直接作局数，更大的数除以 9 取余（除尽用九局）；冬至后阳遁，夏至后阴遁。',
      detail: `本局为“${dj.desc}”，不走符头定元这一步。`,
      layers: ['base'],
      highlight: []
    });
  }

  // 3. 定局数
  const row = term && JU_TABLE[dj.termName || term.name];
  steps.push({
    key: 'ju',
    title: '第三步 · 定阴阳遁与局数',
    rule: '冬至到芒种用阳遁，夏至到大雪用阴遁；每个节气按上中下元各有一个局数（如“冬至惊蛰一七四”）。',
    detail: `${dj.termName || ''}${row && !manual ? ` 三元局数为 ${row.join('、')}，取${dj.yuanName}` : ''} → ${dun}遁${NUM_CN[ju]}局。`,
    layers: ['base'],
    highlight: [ju === 5 ? 5 : ju]
  });

  // 4. 地盘三奇六仪
  const order = dun === '阳' ? JIUGONG_SEQ : [...JIUGONG_SEQ].reverse();
  const seqText = YIQI_SEQ.map((gan, i) => `${gan}${NUM_CN[order[(order.indexOf(ju) + i) % 9]]}`).join(' → ');
  steps.push({
    key: 'dipan',
    title: '第四步 · 布地盘三奇六仪',
    rule: `从局数宫起“戊”，按 戊己庚辛壬癸丁丙乙 的次序${dun === '阳' ? '顺排（1→2→3…→9）' : '逆排（9→8→7…→1）'}九宫。`,
    detail: `${dun}遁${NUM_CN[ju]}局：${seqText}。地盘代表事情的“底子、内在”，读宫时它是天盘干下临的内容。`,
    layers: ['base', 'dipan'],
    highlight: [ju],
    quiz: { prompt: `${dun}遁${NUM_CN[ju]}局，“戊”从哪一宫起排？`, answer: [ju] }
  });

  // 5. 旬首遁甲 → 值符星、值使门
  const rawGong = JIUGONG_SEQ.find(g => pan.dipan[g] === pan.shouYi);
  const inCenter = rawGong === 5;
  steps.push({
    key: 'xun',
    title: '第五步 · 找旬首，定值符星与值使门',
    rule: '时柱所在的旬首“甲”遁藏在六仪之下（甲子戊、甲戌己、甲申庚、甲午辛、甲辰壬、甲寅癸）。该仪在地盘所在宫，原有的九星就是值符星，原有的八门就是值使门。',
    detail: `时柱 ${p.hour} 属 ${pan.xun} 旬，甲遁于“${pan.shouYi}”。地盘 ${pan.shouYi} 在${gname(rawGong)}${inCenter ? '（中五宫无门，寄坤二：值符取天禽、值使取坤二的死门）' : ''}，所以值符星＝${pan.starFu}，值使门＝${pan.doorShi}。`,
    layers: ['base', 'dipan', 'home'],
    highlight: [rawGong],
    quiz: { prompt: `旬首仪“${pan.shouYi}”在地盘哪一宫？`, answer: [rawGong] }
  });

  if (isZhuan) {
    // 6. 值符随时干
    const shiGanLabel = pan.shiGan === '甲' ? `${pan.shiGan}（甲不现，用旬首仪${pan.shouYi}）` : pan.shiGan;
    const fromGong = pan.fuGong;
    const shift = (RING_INDEX[pan.shiGong] - RING_INDEX[fromGong] + 8) % 8;
    steps.push({
      key: 'star',
      title: '第六步 · 值符随时干，转九星',
      rule: '值符星加到“时干”在地盘所在的宫，其余八星按八宫环（坎→艮→震→巽→离→坤→兑→乾）整体顺时针转动同样的格数；天禽随天芮走。',
      detail: `时干 ${shiGanLabel} 在地盘${gname(pan.shiGong)}。值符 ${pan.starFu} 从${gname(fromGong)}移到${gname(pan.shiGong)}，整圈转 ${shift} 格。`,
      layers: ['base', 'dipan', 'star'],
      highlight: [pan.shiGong],
      arrows: fromGong !== pan.shiGong ? [[fromGong, pan.shiGong]] : [],
      quiz: { prompt: `值符星 ${pan.starFu} 要转到哪一宫？（找时干在地盘的位置）`, answer: [pan.shiGong] }
    });

    // 7. 天盘干随星走
    steps.push({
      key: 'tiangan',
      title: '第七步 · 天盘干跟着九星走',
      rule: '每颗星把它“原位”下面的地盘干一起带走，落在哪宫，那宫的天盘干就是它；中五宫的干寄在坤二，随天芮（天禽）一同移动。',
      detail: `例：值符 ${pan.starFu} 原位地盘干是 ${pan.shouYi}，所以${gname(pan.shiGong)}天盘干为 ${pan.tianpanGan[pan.shiGong]}。天盘干是“表象、主体”（约占六成），地盘干是“内在”（约占两成）。`,
      layers: ['base', 'dipan', 'star', 'tiangan'],
      highlight: [pan.shiGong]
    });

    // 8. 值使随时支
    const xunZhi = pan.xun[1];
    const hourZhi = p.hour[1];
    const steps12 = ((DIZHI.indexOf(hourZhi) - DIZHI.indexOf(xunZhi)) % 12 + 12) % 12;
    const startPos = JIUGONG_SEQ.indexOf(pan.fuGong);
    const path = [];
    for (let i = 0; i <= steps12; i++) {
      const pos = dun === '阳' ? (startPos + i) % 9 : ((startPos - i) % 9 + 9) % 9;
      path.push(`${DIZHI[(DIZHI.indexOf(xunZhi) + i) % 12]}${NUM_CN[JIUGONG_SEQ[pos]]}`);
    }
    const lastRaw = path.length ? path[path.length - 1] : '';
    const landedCenter = /五$/.test(lastRaw);
    steps.push({
      key: 'door',
      title: '第八步 · 值使随时支，转八门',
      rule: `值使门从旬首宫出发，按九宫数字次序${dun === '阳' ? '顺' : '逆'}走，旬首地支走到时辰地支为止；落中五寄坤二。然后其余七门按八宫环整体转动。`,
      detail: `从旬首 ${pan.xun}（${xunZhi}）数到时支 ${hourZhi}，共 ${steps12} 步：${path.join(' → ')}${landedCenter ? '（落中五，寄坤二）' : ''}。值使 ${pan.doorShi} 落${gname(pan.doorShiGong)}。`,
      layers: ['base', 'dipan', 'star', 'tiangan', 'door'],
      highlight: [pan.doorShiGong],
      arrows: pan.fuGong !== pan.doorShiGong ? [[pan.fuGong, pan.doorShiGong]] : [],
      quiz: { prompt: `值使 ${pan.doorShi} 最后落在哪一宫？（从旬首宫按九宫数到时支）`, answer: [pan.doorShiGong] }
    });

    // 9. 八神
    const ringOrder = [];
    const s0 = RING_INDEX[pan.shiGong];
    const stepDir = dun === '阳' ? 1 : -1;
    for (let i = 0; i < 8; i++) ringOrder.push(`${SPIRITS_ZHUAN[i]}${NUM_CN[BAGUA_RING[(s0 + stepDir * i + 80) % 8]]}`);
    steps.push({
      key: 'spirit',
      title: '第九步 · 排八神',
      rule: `八神从“值符”起，跟值符星同宫，${dun === '阳' ? '阳遁顺时针' : '阴遁逆时针'}排：值符、螣蛇、太阴、六合、白虎、玄武、九地、九天。`,
      detail: `${ringOrder.join(' → ')}。八神只取神态、给人的整体感觉，不与任何符号论生克。`,
      layers: ['base', 'dipan', 'star', 'tiangan', 'door', 'spirit'],
      highlight: [pan.shiGong]
    });
  } else {
    steps.push({
      key: 'fei',
      title: '第六步 · 飞盘九宫飞布',
      rule: '飞盘法把九星、九门、九神、天盘干都按洛书次序（1→2→…→9，阴遁逆飞）从起点宫依次飞布。叶鸿生所用为时家转盘，这里只做对照。',
      detail: `值符 ${pan.starFu} 飞到时干宫${gname(pan.shiGong)}，值使 ${pan.doorShi} 飞到${gname(pan.doorShiGong)}。`,
      layers: ['base', 'dipan', 'star', 'tiangan', 'door', 'spirit'],
      highlight: [pan.shiGong, pan.doorShiGong]
    });
  }

  // 10. 旬空、马星、大象
  const kongGongs = JIUGONG_SEQ.filter(g => pan.palaceFlags[g] && pan.palaceFlags[g].isKong);
  const maGong = JIUGONG_SEQ.find(g => pan.palaceFlags[g] && pan.palaceFlags[g].hasMa);
  const wby = pan.wuBuYu && pan.wuBuYu.hasSpecial ? `另外：${pan.wuBuYu.desc}` : '';
  steps.push({
    key: 'marks',
    title: '第十步 · 标旬空、马星，看大象',
    rule: '时柱旬空落在含这两个地支的宫；马星看时支（申子辰马在寅、寅午戌马在申、巳酉丑马在亥、亥卯未马在巳）。人物用神逢空要看对宫，马星表示正在动、朝对宫方向去。',
    detail: `时柱 ${p.hour} 旬空 ${pan.kongwang.hour}：${kongGongs.map(gname).join('、') || '无'}。马星 ${pan.hourMa} 在${maGong ? gname(maGong) : '—'}。${wby}`,
    layers: ['base', 'dipan', 'star', 'tiangan', 'door', 'spirit', 'marks'],
    highlight: [...kongGongs, ...(maGong ? [maGong] : [])],
    quiz: kongGongs.length ? { prompt: `时柱旬空“${pan.kongwang.hour}”落在哪一宫？`, answer: kongGongs } : null
  });

  // 11. 读盘顺序
  steps.push({
    key: 'read',
    title: '最后 · 叶鸿生的四层读盘法',
    rule: '排盘是自下而上叠上去的，读盘也自下而上：底层九宫八卦（定位与姿态）→ 宫内地支（阶段、时间）→ 九星八门的原位与五行（识别反吟伏吟）→ 顶层天盘（八神、九星、八门、天地盘干）。',
    detail: '每宫只看 7 个符号：八卦、地支、八神、九星、八门、两个天干。单宫内部不论生克，都围着天盘干从不同侧面描画同一个对象。先提用神，再逐个用神读宫，最后综合。',
    layers: ['base', 'dipan', 'star', 'tiangan', 'door', 'spirit', 'marks'],
    highlight: []
  });

  return steps;
}

// 一个宫在某个图层组合下要显示的内容
export function cellLayerContent(pan, g, layers) {
  const out = { gua: `${GUA[g]}${NUM_CN[g]}`, zhi: (GONG_DIZHI[g] || []).join(''), lines: [] };
  const has = k => layers.includes(k);
  if (has('spirit') && pan.tianpanSpirit[g]) out.spirit = pan.tianpanSpirit[g];
  if (has('star')) out.star = pan.tianpanStar[g] || '';
  else if (has('home') && STAR_HOME[g]) out.star = STAR_HOME[g] + '·原';
  if (has('door')) out.door = pan.tianpanDoor[g] || '';
  else if (has('home') && DOOR_HOME[g]) out.door = DOOR_HOME[g] + '·原';
  if (has('tiangan')) out.tiangan = (pan.tianpanGan[g] || '') + (pan.tianpanJigan[g] ? pan.tianpanJigan[g] : '');
  if (has('dipan')) out.dipan = pan.dipan[g] || '';
  if (has('marks') && pan.palaceFlags[g]) {
    out.kong = !!pan.palaceFlags[g].isKong;
    out.ma = !!pan.palaceFlags[g].hasMa;
  }
  return out;
}

export { GONG_CN };
