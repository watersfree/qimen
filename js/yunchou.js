// 运筹引擎 (Yunchou Engine)
// 叶鸿生：预测盘看事情的状态；运筹要“另起一盘”，取当下真实的天地能量，以当事人为太极点。
// 按目的选符号 → 过滤不可用的宫(旬空、入墓、格局太凶) → 落地到五要素
// (时间、带上的东西、放在房里的东西、带上的人、要做的事)。
// 借气选位权重：日干长生/临官/帝旺 40%，开休生 15%，乙丙丁三奇 15%，十干吉格 15%，宫位当令 5%。

import {
  GONG_DIZHI, SHIGAN_STATUS_MAP, TIANGAN_CHANGSHENG_MAP, getPalaceYuelingStructured
} from './qimen.js';

const NUM_CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const GUA = { 1: '坎', 2: '坤', 3: '震', 4: '巽', 5: '中', 6: '乾', 7: '兑', 8: '艮', 9: '离' };
const DIRECTION = { 1: '正北', 2: '西南', 3: '正东', 4: '东南', 5: '中央', 6: '西北', 7: '正西', 8: '东北', 9: '正南' };
const FAMILY = { 1: '中年男性（中男）', 2: '母亲、女主人、年长女性', 3: '长子、三十多岁的男性', 4: '长女、年轻干练的女性', 6: '父亲、领导、当官的', 7: '少女、年轻女孩', 8: '少男、年轻小伙', 9: '中年女性（中女）', 5: '核心人物' };
const OPPOSITE = { 1: 9, 9: 1, 2: 8, 8: 2, 3: 7, 7: 3, 4: 6, 6: 4, 5: 5 };
const GAN_COLOR = { 甲: '青绿色', 乙: '青绿色', 丙: '红色', 丁: '红色', 戊: '黄色', 己: '黄色', 庚: '白色、金属色', 辛: '白色、金属色', 壬: '黑色、深蓝', 癸: '黑色、深蓝' };
const GAN_ITEM = {
  甲: '挺拔的木制品', 乙: '长条形的东西、植物', 丙: '明亮耀眼的东西', 丁: '文书、证件、小灯', 戊: '大块、厚重的东西（也象征钱）',
  己: '陶土、收纳类的东西', 庚: '金属器物', 辛: '首饰、精巧的小物件', 壬: '流动的水、饮品', 癸: '小瓶的水、雨具'
};
const STAR_STYLE = {
  天蓬: '想得大、胆子大', 天任: '老实稳重、按部就班', 天冲: '快、果断', 天辅: '仔细斟酌、讲道理', 天英: '热情张扬、展示亮点',
  天芮: '耐心照顾、慢慢来', 天柱: '态度强硬、敢说', 天心: '冷静掌控、讲方案', 天禽: '居中协调'
};
const STAR_ITEM = {
  天辅: '书、学习资料', 天英: '漂亮、发光发热的东西', 天心: '精密的工具、药', 天任: '稳重厚实的东西', 天冲: '运动、带动感的东西',
  天柱: '柱状的东西', 天蓬: '与水有关的东西', 天芮: '（天芮主病，物件慎取）', 天禽: '放在中心的东西'
};
const SPIRIT_STYLE = {
  值符: '像领导一样稳住场面', 螣蛇: '灵活多变', 太阴: '悄悄地做、不张扬', 六合: '和气、讲人缘', 白虎: '有威严、不退让',
  玄武: '用技巧、让人看不透', 九地: '低调沉稳、耐得住', 九天: '张扬、往高处说'
};
const DOOR_ITEM = { 开门: '钥匙、打开的东西', 休门: '让人放松的东西（茶、靠垫）', 生门: '绿植、钱夹', 景门: '图片、光亮的东西', 杜门: '包裹、遮挡物', 六合: '成对的东西' };
const ZHI_HOUR = { 子: '23–01', 丑: '01–03', 寅: '03–05', 卯: '05–07', 辰: '07–09', 巳: '09–11', 午: '11–13', 未: '13–15', 申: '15–17', 酉: '17–19', 戌: '19–21', 亥: '21–23' };
const GOOD_PATTERNS = new Set(['丁加戊', '戊加丁', '丙加戊', '戊加丙', '辛加丁', '丁加乙']);
const HE_GAN = { 甲: '己', 己: '甲', 乙: '庚', 庚: '乙', 丙: '辛', 辛: '丙', 丁: '壬', 壬: '丁', 戊: '癸', 癸: '戊' };
const SAN_QI = ['乙', '丙', '丁'];
const JI_DOORS = ['开门', '休门', '生门'];

export const YUNCHOU_PURPOSES = [
  { key: 'jieqi', label: '借气选位（谈判、比赛、销售现场）', mode: 'weighted' },
  { key: 'open', label: '让对方敞开心扉、见领导', targets: { door: ['开门'] }, face: '背靠杜门，面对开门' },
  { key: 'guiren', label: '求见贵人、请领导批准', targets: { door: ['休门'] }, needQi: true },
  { key: 'zhongshi', label: '引起重视、让对方兴奋', targets: { door: ['景门'] }, face: '让对方站在景门方位，说绽放、光明的话' },
  { key: 'hezuo', label: '谈合作、谈判、吸引对方', targets: { spirit: ['六合'] }, needQi: true, heFallback: true },
  { key: 'xiaoshou', label: '卖货、求利、跑销售', targets: { door: ['生门'], alt: { spirit: ['九天'], door2: ['景门'] } }, face: '坐生门方位，面对对宫' },
  { key: 'zhengjian', label: '办证件、文书', targets: { gan: ['丁'], alt: { door2: ['景门'], spirit: ['六合'] } } },
  { key: 'shengzhi', label: '升职、上升', targets: { spirit: ['九天'] } },
  { key: 'kaoshi', label: '考试、学习', targets: { star: ['天辅'] } },
  { key: 'kongchang', label: '比赛控球、掌控场面', targets: { star: ['天心'] } },
  { key: 'redu', label: '视频点击量、热度', targets: { star: ['天英'], door2: ['景门'], spirit: ['九天', '六合'] }, countAll: true },
  { key: 'baomi', label: '保密、躲藏、不被发现', targets: { door: ['杜门'], spirit: ['太阴', '九地'] }, countAll: true },
  { key: 'weiyan', label: '对下属要有威严', targets: { spirit: ['白虎'] } },
  { key: 'zhuanyun', label: '转运出行（找最吉方位走一走）', mode: 'zhuanyun' }
];

function cleanStar(s) { return (s || '').split('、')[0]; }

// 一个宫的事实：给运筹与笔记共用
export function describePalace(pan, g) {
  const tg = pan.tianpanGan[g] || '';
  const jg = pan.tianpanJigan ? (pan.tianpanJigan[g] || '') : '';
  const dg = pan.dipan[g] || '';
  const star = pan.tianpanStar[g] || '';
  const door = pan.tianpanDoor[g] || '';
  const spirit = pan.tianpanSpirit[g] || '';
  const flags = pan.palaceFlags[g] || {};
  const zhis = GONG_DIZHI[g] || [];
  const keyingKey = tg && dg ? `${tg}加${dg}` : '';
  const keying = keyingKey ? (SHIGAN_STATUS_MAP[keyingKey] || null) : null;
  const stages = tg && TIANGAN_CHANGSHENG_MAP[tg] ? zhis.map(z => `${z}${TIANGAN_CHANGSHENG_MAP[tg][z] || ''}`) : [];
  const ruMu = tg && TIANGAN_CHANGSHENG_MAP[tg] ? zhis.some(z => TIANGAN_CHANGSHENG_MAP[tg][z] === '墓') : false;
  const yl = getPalaceYuelingStructured(pan, g);
  return {
    g, name: `${GUA[g]}${NUM_CN[g]}宫`, direction: DIRECTION[g], tg, jg, dg, star, door, spirit,
    kong: !!flags.isKong, ma: !!flags.hasMa, zhis, keyingKey, keying, stages, ruMu,
    yueling: yl ? yl.status : '', palaceWang: !!(yl && /旺/.test(yl.status || ''))
  };
}

export function palaceFactLine(pan, g) {
  const f = describePalace(pan, g);
  const bits = [`天盘${f.tg}${f.jg ? '(寄' + f.jg + ')' : ''} / 地盘${f.dg}`, f.star, f.door, f.spirit].filter(Boolean);
  if (f.keying) bits.push(`${f.keyingKey}：${f.keying.desc}`);
  if (f.stages.length) bits.push(`${f.tg}临${f.stages.join('、')}`);
  if (f.yueling) bits.push(`月令：${f.yueling}`);
  if (f.kong) bits.push('旬空');
  if (f.ma) bits.push('马星');
  return `${f.name}（${f.direction}）：${bits.join(' · ')}`;
}

function usability(f) {
  const reasons = [];
  if (f.kong) reasons.push('旬空');
  if (f.ruMu) reasons.push(`${f.tg}入墓`);
  if (f.keying && f.keying.status === '大凶') reasons.push(`格局太凶（${f.keyingKey}）`);
  if (SAN_QI.includes(f.tg) && ['庚', '辛', '壬', '癸'].includes(f.dg)) reasons.push(`三奇下临${f.dg}，有奇也不算`);
  return reasons;
}

function hasQi(f) { return SAN_QI.includes(f.tg) && !['庚', '辛', '壬', '癸'].includes(f.dg); }
function goodPattern(f) {
  if (!f.keyingKey) return false;
  return GOOD_PATTERNS.has(f.keyingKey) || (f.keying && (f.keying.status === '吉' || f.keying.status === '大吉'));
}

function matchTargets(f, t) {
  const hits = [];
  if (!t) return hits;
  const star = cleanStar(f.star);
  (t.door || []).forEach(d => { if (f.door === d) hits.push(d); });
  (t.door2 || []).forEach(d => { if (f.door === d) hits.push(d); });
  (t.spirit || []).forEach(s => { if (f.spirit === s) hits.push(s); });
  (t.star || []).forEach(s => { if (f.star.includes(s) || star === s) hits.push(s); });
  (t.gan || []).forEach(gn => { if (f.tg === gn) hits.push(gn); });
  return hits;
}

function palaceList(pan) {
  return pan.paipanMethod === 'zhuan' ? [1, 2, 3, 4, 6, 7, 8, 9] : [1, 2, 3, 4, 5, 6, 7, 8, 9];
}

// 五要素落地方案
function landingPlan(pan, f, purpose, dayGan) {
  const plan = [];
  const zhiText = f.zhis.map(z => `${z}日 / ${z}时（${ZHI_HOUR[z]}）`).join('，');
  plan.push({ k: '① 时间', v: `取${f.name}的地支：${zhiText || '—'}。` });
  const items = [];
  if (f.tg && GAN_ITEM[f.tg]) items.push(`${GAN_COLOR[f.tg]}的${GAN_ITEM[f.tg]}（取天盘干${f.tg}）`);
  const star = cleanStar(f.star);
  if (STAR_ITEM[star]) items.push(`${STAR_ITEM[star]}（取${star}）`);
  if (DOOR_ITEM[f.door]) items.push(`${DOOR_ITEM[f.door]}（取${f.door}）`);
  if (DOOR_ITEM[f.spirit]) items.push(`${DOOR_ITEM[f.spirit]}（取${f.spirit}）`);
  plan.push({ k: '② 带上的东西', v: `数量取宫数 ${f.g}（例如 ${f.g} 件，或一本书翻到第 ${f.g} 页）；${items.join('；') || '按本宫符号取象'}。` });
  plan.push({ k: '③ 放在房里的东西', v: `在房间的${f.direction}方放上述物件，并清理那里陈旧、破损的东西。` });
  plan.push({ k: '④ 带上的人', v: `${FAMILY[f.g] || '本宫象的人'}；气质要合本宫九星：${STAR_STYLE[star] || '—'}。` });
  const acts = [];
  if (purpose && purpose.face) acts.push(purpose.face);
  acts.push(`坐（站）在${f.direction}方位`);
  if (STAR_STYLE[star]) acts.push(`言行合${star}：${STAR_STYLE[star]}`);
  if (SPIRIT_STYLE[f.spirit]) acts.push(`神态合${f.spirit}：${SPIRIT_STYLE[f.spirit]}`);
  plan.push({ k: '⑤ 要做的事', v: acts.join('；') + '。' });
  return plan;
}

function boundaryNotes(pan) {
  const notes = [];
  if (pan.wuBuYu && pan.wuBuYu.isWuBuYu) notes.push('本时辰是五不遇时：运筹大不利，最好换个时间再起运筹盘。');
  notes.push('高于我层面的事（政策、天气、大盘、上级的决定）不能运筹改变，只能顺势。');
  notes.push('对症的化解一般两三天内见变化；七八天毫无动静，说明没有对症，要回头核对分析。');
  notes.push('运筹仅用于正当的事务；找不到可用的宫就不要硬用，“下次再起”。');
  return notes;
}

export function analyzeYunchou(pan, purposeKey, dayGanOverride = '') {
  const purpose = YUNCHOU_PURPOSES.find(p => p.key === purposeKey) || YUNCHOU_PURPOSES[0];
  const dayGan = dayGanOverride || pan.dayGan;
  const facts = palaceList(pan).map(g => describePalace(pan, g));
  const result = { purpose, dayGan, candidates: [], best: null, plan: [], notes: boundaryNotes(pan), summary: '' };

  if (purpose.mode === 'weighted') {
    facts.forEach(f => {
      const parts = [];
      let score = 0;
      const dayStages = TIANGAN_CHANGSHENG_MAP[dayGan] ? f.zhis.map(z => TIANGAN_CHANGSHENG_MAP[dayGan][z]) : [];
      const wangStage = dayStages.find(s => ['长生', '临官', '帝旺'].includes(s));
      if (wangStage) { score += 40; parts.push(`日干${dayGan}在此${wangStage} +40`); }
      const jiDoor = JI_DOORS.includes(f.door);
      if (jiDoor) { score += 15; parts.push(`${f.door} +15`); }
      const qi = hasQi(f);
      if (qi) { score += 15; parts.push(`三奇${f.tg} +15`); }
      const good = goodPattern(f);
      if (good) { score += 15; parts.push(`${f.keyingKey}吉格 +15`); }
      if (f.palaceWang) { score += 5; parts.push('宫位当令 +5'); }
      const bad = usability(f);
      const warn = [];
      if ((jiDoor || qi) && !(jiDoor && qi)) warn.push('吉门与三奇只占其一，能量不强');
      if (wangStage && !good && !jiDoor && f.keying && (f.keying.status === '凶' || f.keying.status === '大凶')) warn.push('日干虽旺但格局差，很平常');
      result.candidates.push({ f, score, parts, bad, warn });
    });
    result.candidates.sort((a, b) => (a.bad.length ? 1 : 0) - (b.bad.length ? 1 : 0) || b.score - a.score);
    const top = result.candidates.find(c => !c.bad.length && c.score >= 40) ||
      result.candidates.find(c => !c.bad.length && c.parts.some(p => p.includes('门')) && c.parts.some(p => p.includes('三奇')));
    if (top) {
      result.best = top;
      result.summary = `首选${top.f.name}（${top.f.direction}），得分 ${top.score}/90。坐到这个方位后，言行要配合本宫的九星、八神。`;
    } else {
      result.summary = '全盘没有符合条件的好位置：叶鸿生说这种情况就不用借气选位，不要硬用。';
    }
  } else if (purpose.mode === 'zhuanyun') {
    facts.forEach(f => {
      let score = 0;
      const parts = [];
      if (hasQi(f)) { score += 15; parts.push(`三奇${f.tg}`); }
      if (JI_DOORS.includes(f.door)) { score += 15; parts.push(f.door); }
      if (f.palaceWang) { score += 5; parts.push('宫旺'); }
      if (goodPattern(f)) { score += 10; parts.push(`${f.keyingKey}吉格`); }
      result.candidates.push({ f, score, parts, bad: usability(f), warn: [] });
    });
    result.candidates.sort((a, b) => (a.bad.length ? 1 : 0) - (b.bad.length ? 1 : 0) || b.score - a.score);
    const top = result.candidates.find(c => !c.bad.length && c.parts.length >= 2 && hasQi(c.f) && JI_DOORS.includes(c.f.door));
    const dist = { 9: '90 米或 900 米', 8: '80 米', 2: '80 米', 1: '10 米', 7: '20 米', 3: '30 米', 4: '40 米', 6: '60 米' };
    if (top) {
      result.best = top;
      result.summary = `朝${top.f.direction}（${top.f.name}）走 ${dist[top.f.g] || top.f.g + '0 米'}，宫旺可以走远些；让本宫的吉象“落进眼里”。`;
    } else {
      result.summary = '找不到三奇加开休生、又不旬空入墓的宫：说明此刻运气确实一般，下次出门再起。';
    }
  } else {
    facts.forEach(f => {
      let hits = matchTargets(f, purpose.targets);
      let alt = false;
      if (!hits.length && purpose.targets && purpose.targets.alt) {
        hits = matchTargets(f, purpose.targets.alt);
        alt = hits.length > 0;
      }
      if (!hits.length && purpose.heFallback && HE_GAN[dayGan] && f.tg === HE_GAN[dayGan]) {
        hits = [`天干相合（${dayGan}${f.tg}合）`];
        alt = true;
      }
      if (!hits.length) return;
      const parts = [`含${hits.join('、')}${alt ? '（替代取象）' : ''}`];
      let score = (purpose.countAll ? hits.length * 20 : 30) - (alt ? 10 : 0);
      if (hasQi(f)) { score += 15; parts.push(`三奇${f.tg}`); }
      else if (purpose.needQi) parts.push('缺三奇，力量弱一些');
      if (JI_DOORS.includes(f.door) && !hits.includes(f.door)) { score += 8; parts.push(f.door); }
      if (goodPattern(f)) { score += 10; parts.push(`${f.keyingKey}吉格`); }
      if (f.keying && f.keying.status === '凶') { score -= 8; parts.push(`${f.keyingKey}偏凶`); }
      if (f.palaceWang) { score += 5; parts.push('宫位当令'); }
      result.candidates.push({ f, score, parts, bad: usability(f), warn: [] });
    });
    result.candidates.sort((a, b) => (a.bad.length ? 1 : 0) - (b.bad.length ? 1 : 0) || b.score - a.score);
    const top = result.candidates.find(c => !c.bad.length);
    if (top) {
      result.best = top;
      result.summary = `取${top.f.name}（${top.f.direction}）：${top.parts.join('，')}。把人或事“放进”这一宫，按它的象去行动。`;
    } else if (result.candidates.length) {
      result.summary = '目标符号所在的宫都不可用（旬空、入墓或格局太凶）：这次不用，“下次再起”。';
    } else {
      result.summary = '盘上找不到这个目的对应的符号。';
    }
  }

  if (result.best) result.plan = landingPlan(pan, result.best.f, purpose, dayGan);
  return result;
}

export function yunchouToText(pan, res) {
  const lines = [];
  const p = pan.pillars;
  lines.push(`【运筹盘】${pan.rawInput.year}-${String(pan.rawInput.month).padStart(2, '0')}-${String(pan.rawInput.day).padStart(2, '0')} ${String(pan.rawInput.hour).padStart(2, '0')}:${String(pan.rawInput.minute).padStart(2, '0')}  ${p.year} ${p.month} ${p.day} ${p.hour}  ${pan.dingju.desc}`);
  lines.push(`目的：${res.purpose.label}；当事人日干：${res.dayGan}`);
  lines.push(res.summary);
  res.plan.forEach(x => lines.push(`${x.k}：${x.v}`));
  return lines.join('\n');
}
