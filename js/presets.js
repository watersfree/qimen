// 奇门遁甲叶鸿生体系用神预设与分类配置 (YongShen Presets System)

// 默认用神性质分类：
// person: 人物用神 (逢空看对宫，标“心之所向”)
// matter: 事情用神 (逢空不看对宫)
// object: 物品/环境用神 (逢空主虚设、不在、丢失)
export const DEFAULT_YONGSHEN_NATURE = {
  // 人物类 (person)
  '日干': 'person', '时干': 'person', '年干': 'person', '月干': 'person', '合干': 'person',
  '相合之干': 'person', '所克之干': 'person', '克我之干': 'person',
  '甲': 'person', '乙': 'person', '丙': 'person', '丁': 'person', '戊': 'object',
  '己': 'object', '庚': 'person', '辛': 'person', '壬': 'person', '癸': 'person',
  '玄武': 'person', '天蓬': 'person', '白虎': 'person',
  '乾宫': 'person', '坤宫': 'person', '震宫': 'person', '巽宫': 'person',

  // 事情类 (matter)
  '值符': 'matter', '直符': 'matter',
  '开门': 'matter', '生门': 'matter', '休门': 'matter', '伤门': 'matter',
  '杜门': 'matter', '景门': 'matter', '死门': 'matter', '惊门': 'matter',
  '六合': 'matter', '九天': 'matter', '九地': 'matter', '螣蛇': 'matter', '太阴': 'matter',
  '天芮': 'matter', '天辅': 'matter', '天心': 'matter', '天柱': 'matter',
  '天任': 'matter', '天冲': 'matter', '天英': 'matter', '天禽': 'matter',
  '马星': 'matter',

  // 物品与环境类 (object)
  '坎宫': 'object', '艮宫': 'object', '兑宫': 'object', '离宫': 'object',
  '对冲宫': 'person', '日干对冲宫': 'person', '旬空': 'matter', '空亡': 'matter'
};

export function getYongShenNature(name) {
  if (!name) return 'matter';
  const cleanName = String(name).replace(/（.*?）|\(.*?\)/g, '').trim();
  return DEFAULT_YONGSHEN_NATURE[cleanName] || 'matter';
}

// 地盘角色翻译映射表
export const YONGSHEN_ROLE_MAP = {
  '日干': '日干·求测人',
  '时干': '时干·事态/子女',
  '值符': '值符·大局核心',
  '年干': '年干·长辈/大领导',
  '月干': '月干·同辈/朋友',
  '合干': '合干·配偶夫妻',
  '相合之干': '合干·配偶',
  '所克之干': '所克·被告方',
  '克我之干': '克我·原告方',
  '开门': '开门·工作/公司',
  '生门': '生门·利润/房产',
  '休门': '休门·贵人/休养',
  '伤门': '伤门·讨债/车船',
  '杜门': '杜门·保密/藏匿',
  '景门': '景门·行情/文书',
  '死门': '死门·阴宅/执念',
  '惊门': '惊门·官非/口舌',
  '六合': '六合·合作/媒约',
  '玄武': '玄武·小偷/虚假',
  '白虎': '白虎·凶险/公安',
  '螣蛇': '螣蛇·变故/虚惊',
  '九天': '九天·升职/远行',
  '九地': '九地·长久/稳固',
  '太阴': '太阴·暗谋/隐藏',
  '戊': '戊·资金/房屋',
  '己': '己·地户/阴宅',
  '天芮': '天芮·病灶/病源',
  '天辅': '天辅·学业/考试',
  '马星': '马星·变动/出行',
  '乾宫': '乾宫·男主/决策',
  '坤宫': '坤宫·女主/产房',
  '坎宫': '坎宫·子宫孕位',
  '震宫': '震宫·长子/主队',
  '巽宫': '巽宫·长女位',
  '对冲宫': '对冲·对方交易人',
  '丙': '丙·男第三者',
  '丁': '丁·钥匙/女第三者',
  '乙': '乙·女方/长条物',
  '庚': '庚·男方/利器',
  '辛': '辛·珠子/首饰'
};

// 5 大类、26 个叶鸿生用神预设
export const YONGSHEN_PRESETS = [
  // ================= 1. 人事关系 =================
  {
    category: '人事关系',
    icon: '',
    id: 'self',
    name: '求测自身',
    question: '求测自身综合运势',
    items: [
      { name: '日干', nature: 'person', role: '求测人自身' }
    ]
  },
  {
    category: '人事关系',
    icon: '',
    id: 'exam',
    name: '考试学业',
    question: '测学业考试与考运录取',
    prompt: {
      title: '请选择参加考试的对象：',
      options: [
        {
          label: '自己参加考试 (日干)',
          desc: '自己考取日干为考生，天辅为主考试卷，值符为录取大局',
          question: '测自身学业考试与成绩录取',
          items: [
            { name: '日干', nature: 'person', role: '考生自身' },
            { name: '天辅', nature: 'matter', role: '学业试卷' },
            { name: '值符', nature: 'matter', role: '录取考官' }
          ]
        },
        {
          label: '孩子/下属参加考试 (时干)',
          desc: '孩子考取时干为考生，天辅为主考试卷，值符为录取大局',
          question: '测子女学生学业考试与成绩录取',
          items: [
            { name: '时干', nature: 'person', role: '子女考生' },
            { name: '天辅', nature: 'matter', role: '学业试卷' },
            { name: '值符', nature: 'matter', role: '录取考官' }
          ]
        }
      ]
    }
  },
  {
    category: '人事关系',
    icon: '',
    id: 'parents',
    name: '长辈父母',
    question: '测长辈父母吉凶与近况',
    prompt: {
      title: '请选择求测长辈：',
      options: [
        {
          label: '问父亲 (年干+乾宫)',
          desc: '年干为长辈，男性长辈兼看乾卦父位',
          question: '测父亲身体健康与近况',
          items: [
            { name: '年干', nature: 'person', role: '长辈父亲' },
            { name: '乾宫', nature: 'person', role: '乾宫父位' }
          ]
        },
        {
          label: '问母亲 (年干合干+坤宫)',
          desc: '问完父亲再问母亲，取年干的相合之干，兼看坤宫母位',
          question: '测母亲身体健康与近况',
          items: [
            { name: '合干', nature: 'person', role: '母亲(年干合干)' },
            { name: '坤宫', nature: 'person', role: '坤宫母位' }
          ]
        },
        {
          label: '问父母双亲 (年干+合干+乾坤)',
          desc: '年干合干齐看，兼看乾坤二宫',
          question: '测父母双亲身体与近况',
          items: [
            { name: '年干', nature: 'person', role: '父亲' },
            { name: '合干', nature: 'person', role: '母亲' },
            { name: '乾宫', nature: 'person', role: '父位' },
            { name: '坤宫', nature: 'person', role: '母位' }
          ]
        }
      ]
    }
  },
  {
    category: '人事关系',
    icon: '',
    id: 'friends',
    name: '同事朋友',
    question: '测同辈朋友与同学同事关系',
    items: [
      { name: '月干', nature: 'person', role: '同事/同辈朋友' }
    ]
  },
  {
    category: '人事关系',
    icon: '',
    id: 'promotion',
    name: '升职晋升',
    question: '测职场晋升提拔与调职',
    items: [
      { name: '日干', nature: 'person', role: '自身' },
      { name: '值符', nature: 'person', role: '直接领导' },
      { name: '九天', nature: 'matter', role: '上升晋职' },
      { name: '开门', nature: 'matter', role: '职位官职' }
    ]
  },
  {
    category: '人事关系',
    icon: '',
    id: 'lawsuit',
    name: '官司诉讼',
    question: '测民事纠纷与官司诉讼',
    prompt: {
      title: '请选择我方的诉讼身份：',
      options: [
        {
          label: '我是原告 (控方/起诉方)',
          desc: '日干为我；我是原告，日干所克之干是被告 (阳克阳，阴克阴)',
          question: '测官司诉讼（我方原告，控告对方）',
          items: [
            { name: '日干', nature: 'person', role: '我方(原告)' },
            { name: '所克之干', nature: 'person', role: '被克之干(被告)' },
            { name: '惊门', nature: 'matter', role: '官非口舌' }
          ]
        },
        {
          label: '我是被告 (被诉方/应诉方)',
          desc: '日干为我；我是被告，克日干之干是原告 (阳克阳，阴克阴)',
          question: '测官司诉讼（我方被告，应对诉讼）',
          items: [
            { name: '日干', nature: 'person', role: '我方(被告)' },
            { name: '克我之干', nature: 'person', role: '克我之干(原告)' },
            { name: '惊门', nature: 'matter', role: '官司口舌' }
          ]
        }
      ]
    }
  },
  {
    category: '人事关系',
    icon: '',
    id: 'third_party',
    name: '感情第三者',
    question: '测感情中是否有第三者插足',
    items: [
      { name: '日干', nature: 'person', role: '求测人' },
      { name: '合干', nature: 'person', role: '配偶对象' },
      { name: '丙', nature: 'person', role: '男性第三者' },
      { name: '丁', nature: 'person', role: '女性第三者' }
    ]
  },
  {
    category: '人事关系',
    icon: '',
    id: 'love',
    name: '恋爱婚配',
    question: '测恋爱感情与婚配姻缘',
    items: [
      { name: '乙', nature: 'person', role: '恋爱女方' },
      { name: '庚', nature: 'person', role: '恋爱男方' },
      { name: '六合', nature: 'matter', role: '媒约/婚恋合和' }
    ]
  },
  {
    category: '人事关系',
    icon: '',
    id: 'marriage',
    name: '已婚夫妻',
    question: '测已婚夫妻感情与婚姻走势',
    items: [
      { name: '日干', nature: 'person', role: '自身' },
      { name: '合干', nature: 'person', role: '配偶' }
    ]
  },
  {
    category: '人事关系',
    icon: '',
    id: 'job',
    name: '工作事业',
    question: '测工作事业与公司职位',
    items: [
      { name: '开门', nature: 'matter', role: '工作事业/公司' },
      { name: '日干', nature: 'person', role: '求测人' }
    ]
  },
  {
    category: '人事关系',
    icon: '',
    id: 'leader',
    name: '领导贵人',
    question: '测领导提拔与贵人扶持',
    prompt: {
      title: '请选择所测领导级别：',
      options: [
        {
          label: '直接主管领导 (看值符)',
          desc: '以值符为直接领导',
          question: '测直接主管领导态度与提拔',
          items: [
            { name: '值符', nature: 'person', role: '直接主管领导' },
            { name: '日干', nature: 'person', role: '求测人' }
          ]
        },
        {
          label: '大领导/最高层 (看年干+乾宫)',
          desc: '高出太远取年干，兼看乾宫决策位',
          question: '测大领导/最高决策层态度',
          items: [
            { name: '年干', nature: 'person', role: '最高大领导' },
            { name: '乾宫', nature: 'person', role: '决策核心' },
            { name: '日干', nature: 'person', role: '求测人' }
          ]
        }
      ]
    }
  },
  {
    category: '人事关系',
    icon: '',
    id: 'children',
    name: '子女下属',
    question: '测子女后代与员工下属事物',
    items: [
      { name: '时干', nature: 'person', role: '子女/下属员工' }
    ]
  },

  // ================= 2. 财物与经营 =================
  {
    category: '财物经营',
    icon: '',
    id: 'trade',
    name: '买卖交易',
    question: '测商务贸易与买卖交易',
    items: [
      { name: '日干', nature: 'person', role: '我方买卖人' },
      { name: '对冲宫', nature: 'person', role: '对方交易人' },
      { name: '时干', nature: 'object', role: '买卖货物/商品' }
    ]
  },
  {
    category: '财物经营',
    icon: '',
    id: 'shop_business',
    name: '公司店铺经营',
    question: '测公司工厂与店铺经营效益',
    items: [
      { name: '年干', nature: 'matter', role: '大象大局' },
      { name: '生门', nature: 'matter', role: '进财利润' },
      { name: '戊', nature: 'object', role: '资本投资' },
      { name: '开门', nature: 'matter', role: '店铺店面' }
    ],
    hint: '开门与生门相生则顺，相克则即便有利也会流失'
  },
  {
    category: '财物经营',
    icon: '',
    id: 'house',
    name: '买房置业',
    question: '测买房置业与不动产投资',
    items: [
      { name: '生门', nature: 'matter', role: '利润收益' },
      { name: '戊', nature: 'object', role: '房屋资产' },
      { name: '日干', nature: 'person', role: '买房求测人' }
    ]
  },
  {
    category: '财物经营',
    icon: '',
    id: 'stock',
    name: '遁甲量股',
    question: '测股市大盘与个股涨跌行情（二代量股体系）',
    items: [
      { name: '值符', nature: 'matter', role: '大盘大方向' },
      { name: '戊', nature: 'object', role: '主力资金' },
      { name: '马星', nature: 'matter', role: '动静催化剂' }
    ],
    hint: '叶鸿生二代量股（三轮车体系）：值符(大方向) + 戊(主力资金) + 马星(动静催化)，时干退为辅助。'
  },
  {
    category: '财物经营',
    icon: '',
    id: 'salary_money',
    name: '求财资金',
    question: '测本金资金周转与求财运势',
    items: [
      { name: '日干', nature: 'person', role: '求测人' },
      { name: '戊', nature: 'object', role: '钱财本金' },
      { name: '生门', nature: 'matter', role: '收益利润' }
    ],
    hint: '注：上班族看日干+戊。有店铺、公司的请点击“公司店铺经营”。'
  },
  {
    category: '财物经营',
    icon: '',
    id: 'profit',
    name: '投资利润',
    question: '测生意投资与利润收益',
    items: [
      { name: '生门', nature: 'matter', role: '利润进财' },
      { name: '戊', nature: 'object', role: '投资本金' }
    ]
  },
  {
    category: '财物经营',
    icon: '',
    id: 'cooperation',
    name: '合作谈判',
    question: '测商务合作与合伙签约',
    items: [
      { name: '日干', nature: 'person', role: '自身' },
      { name: '六合', nature: 'matter', role: '合伙中介' }
    ]
  },

  // ================= 3. 健康家庭 =================
  {
    category: '健康家庭',
    icon: '',
    id: 'illness',
    name: '疾病健康',
    question: '测身体疾病病灶与健康康复',
    items: [
      { name: '天芮', nature: 'matter', role: '病灶病源' },
      { name: '日干', nature: 'person', role: '患者自身' },
      { name: '值符', nature: 'matter', role: '病情轻重大纲' }
    ],
    hint: '⚠️ 奇门测病仅供参详，身体不适请务必第一时间正规医院就医！'
  },
  {
    category: '健康家庭',
    icon: '',
    id: 'pregnancy',
    name: '怀孕生育',
    question: '测备孕怀胎与胎产生产',
    prompt: {
      title: '请选择胎产观察重点：',
      options: [
        {
          label: '常规备孕生产',
          desc: '日干配偶 + 坤(产房风水) + 坎(子宫孕位)',
          question: '测备孕生育与胎产',
          items: [
            { name: '日干', nature: 'person', role: '孕妇自身' },
            { name: '合干', nature: 'person', role: '配偶丈夫' },
            { name: '坤宫', nature: 'object', role: '产房风水' },
            { name: '坎宫', nature: 'object', role: '子宫孕位' }
          ]
        },
        {
          label: '侧重长子位 (震三宫)',
          desc: '加看震三宫长子位',
          question: '测备孕怀胎（侧重长子位）',
          items: [
            { name: '日干', nature: 'person', role: '孕妇自身' },
            { name: '合干', nature: 'person', role: '配偶' },
            { name: '坤宫', nature: 'object', role: '坤宫' },
            { name: '坎宫', nature: 'object', role: '坎宫' },
            { name: '震宫', nature: 'person', role: '长子位' }
          ]
        },
        {
          label: '侧重长女位 (巽四宫)',
          desc: '加看巽四宫长女位',
          question: '测备孕怀胎（侧重长女位）',
          items: [
            { name: '日干', nature: 'person', role: '孕妇自身' },
            { name: '合干', nature: 'person', role: '配偶' },
            { name: '坤宫', nature: 'object', role: '坤宫' },
            { name: '坎宫', nature: 'object', role: '坎宫' },
            { name: '巽宫', nature: 'person', role: '长女位' }
          ]
        }
      ]
    }
  },
  {
    category: '健康家庭',
    icon: '',
    id: 'lost_item',
    name: '寻物寻宠',
    question: '测失物寻找与遗失方位',
    prompt: {
      title: '请选择遗失物品的形态特征：',
      options: [
        {
          label: '钥匙 / 手机电子 / 首饰小件 (丁)',
          desc: '丁为星奇、发光、小件、钥匙电子',
          question: '测寻找钥匙/电子产品/首饰',
          items: [
            { name: '时干', nature: 'matter', role: '失物事态' },
            { name: '杜门', nature: 'matter', role: '藏匿处' },
            { name: '太阴', nature: 'matter', role: '阴暗角落' },
            { name: '丁', nature: 'object', role: '电子/钥匙' }
          ]
        },
        {
          label: '细长条 / 衣物 / 绳带软物 (乙)',
          desc: '乙为长条状、柔顺之物',
          question: '测寻找条状/衣物/绳带物品',
          items: [
            { name: '时干', nature: 'matter', role: '失物' },
            { name: '杜门', nature: 'matter', role: '隐藏处' },
            { name: '太阴', nature: 'matter', role: '太阴' },
            { name: '乙', nature: 'object', role: '长条软物' }
          ]
        },
        {
          label: '圆珠 / 戒指 / 颗粒零钱 (辛)',
          desc: '辛为颗粒、珠子、白金小件',
          question: '测寻找戒指/珠子/颗粒物品',
          items: [
            { name: '时干', nature: 'matter', role: '失物' },
            { name: '杜门', nature: 'matter', role: '杜门' },
            { name: '太阴', nature: 'matter', role: '太阴' },
            { name: '辛', nature: 'object', role: '珠子小件' }
          ]
        },
        {
          label: '刀剪 / 金属锐器 / 硬物 (庚)',
          desc: '庚为坚硬金属、锐器',
          question: '测寻找金属硬物/利器',
          items: [
            { name: '时干', nature: 'matter', role: '失物' },
            { name: '杜门', nature: 'matter', role: '杜门' },
            { name: '太阴', nature: 'matter', role: '太阴' },
            { name: '庚', nature: 'object', role: '金属硬物' }
          ]
        },
        {
          label: '大坨 / 钱箱 / 厚重大件 (戊)',
          desc: '戊为大块、厚重、存钱罐',
          question: '测寻找大件/厚重财物',
          items: [
            { name: '时干', nature: 'matter', role: '失物' },
            { name: '杜门', nature: 'matter', role: '杜门' },
            { name: '太阴', nature: 'matter', role: '太阴' },
            { name: '戊', nature: 'object', role: '大坨厚重' }
          ]
        },
        {
          label: '走失宠物 / 动物活物',
          desc: '以时干为主，杜门太阴为藏匿之所',
          question: '测走失宠物猫狗下落与方位',
          items: [
            { name: '时干', nature: 'person', role: '走失宠物' },
            { name: '杜门', nature: 'matter', role: '藏匿处' },
            { name: '太阴', nature: 'matter', role: '角落深处' }
          ]
        }
      ]
    }
  },
  {
    category: '健康家庭',
    icon: '',
    id: 'theft',
    name: '防贼防盗',
    question: '测失窃盗贼与案件侦破',
    items: [
      { name: '玄武', nature: 'person', role: '小偷暗贼' },
      { name: '天蓬', nature: 'person', role: '大盗破财' },
      { name: '白虎', nature: 'person', role: '公安缉拿' }
    ]
  },

  // ================= 4. 风水环境 =================
  {
    category: '风水环境',
    icon: '',
    id: 'yang_fengshui',
    name: '阳宅风水',
    question: '测阳宅居家风水气场',
    items: [
      { name: '值符', nature: 'matter', role: '阳宅大局' },
      { name: '乾宫', nature: 'person', role: '男主人位' },
      { name: '坤宫', nature: 'person', role: '女主人位' }
    ],
    hint: '叶鸿生验证取缔“生门为宅日干为人”旧法，以值符携星定阳宅大象'
  },
  {
    category: '风水环境',
    icon: '',
    id: 'yin_fengshui',
    name: '祖坟祭祀',
    question: '测阴宅祖坟风水与祭祀福荫',
    items: [
      { name: '死门', nature: 'object', role: '阴宅坟墓' },
      { name: '己', nature: 'object', role: '地户阴土' },
      { name: '坤宫', nature: 'object', role: '大地墓地' },
      { name: '日干', nature: 'person', role: '求测人' }
    ],
    hint: '日干若临死门，需细致排查阴宅“五查”隐患'
  },

  // ================= 5. 动态竞技 =================
  {
    category: '动态竞技',
    icon: '',
    id: 'travel',
    name: '变动出行',
    question: '测出行变动与出门吉凶',
    prompt: {
      title: '请选择出行前往的目的地方向：',
      type: 'direction_8',
      questionPrefix: '测出行变动（前往{dir}方向）',
      items: [
        { name: '日干', nature: 'person', role: '出行自身' },
        { name: '马星', nature: 'matter', role: '动向出行' }
      ]
    }
  },
  {
    category: '动态竞技',
    icon: '',
    id: 'match',
    name: '比赛对抗',
    question: '测体育竞技与比赛对抗双方胜负',
    prompt: {
      title: '请选择双方代号或颜色：',
      options: [
        {
          label: '红方 (丙火) vs 蓝方 (癸水)',
          desc: '以球衣颜色天干取象对比双方力量',
          question: '测比赛胜负（红方丙火 vs 蓝方癸水）',
          items: [
            { name: '丙', nature: 'person', role: '红方' },
            { name: '癸', nature: 'person', role: '蓝方' }
          ]
        },
        {
          label: '主队 (震三宫) vs 客队 (兑七宫)',
          desc: '以东西主客两宫五行旺衰生克对比',
          question: '测比赛胜负（主队震三宫 vs 客队兑七宫）',
          items: [
            { name: '震宫', nature: 'person', role: '主队' },
            { name: '兑宫', nature: 'person', role: '客队' }
          ]
        },
        {
          label: '日干 (我支持方) vs 对冲宫 (对手方)',
          desc: '以日干与对冲宫力量对比',
          question: '测比赛胜负（我支持方 vs 对手方）',
          items: [
            { name: '日干', nature: 'person', role: '我方' },
            { name: '对冲宫', nature: 'person', role: '对手' }
          ]
        }
      ]
    }
  },
  {
    category: '动态竞技',
    icon: '',
    id: 'energy_pick',
    name: '借气选位',
    question: '借气选位 · 奇门时空运筹借力',
    items: [
      { name: '日干', nature: 'person', role: '自身' },
      { name: '开门', nature: 'matter', role: '开门' },
      { name: '生门', nature: 'matter', role: '生门' },
      { name: '休门', nature: 'matter', role: '休门' }
    ],
    hint: '运筹模式：高亮日干长生、临官、帝旺三宫（占40%权重），结合开休生三吉门、乙丙丁三奇'
  }
];

// 八方位与对应九宫、入墓天干映射
export const DIRECTION_OPTIONS = [
  { dir: '东', gong: 3, gongName: '震宫', muGan: [] },
  { dir: '东南', gong: 4, gongName: '巽宫', muGan: ['辛', '壬'] },
  { dir: '南', gong: 9, gongName: '离宫', muGan: [] },
  { dir: '西南', gong: 2, gongName: '坤宫', muGan: ['甲', '癸'] },
  { dir: '西', gong: 7, gongName: '兑宫', muGan: [] },
  { dir: '西北', gong: 6, gongName: '乾宫', muGan: ['乙', '丙', '戊'] },
  { dir: '北', gong: 1, gongName: '坎宫', muGan: [] },
  { dir: '东北', gong: 8, gongName: '艮宫', muGan: ['丁', '己', '庚'] }
];
