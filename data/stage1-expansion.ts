import { makeWord } from "@/data/word-factory";
import type { FrequencyBand, RootTier, Word } from "@/types";

type Row = [word: string, meaningZh: string, meaningEn: string, band: FrequencyBand, tier: RootTier, morphology: string, literal: string, lemma?: string];

const rootMeanings: Record<string, string> = {
  form: "shape", ject: "throw", tract: "pull", struct: "build", cred: "believe", mit: "send", vis: "see", scrib: "write", fer: "carry", duc: "lead", rupt: "break", press: "press", mov: "move", cap: "take", ten: "hold", fac: "make", pos: "put"
};

function expand(rootId: string, rows: Row[]): Word[] {
  return rows.map(([word, meaningZh, meaningEn, band, rootTier, morphology, literalMeaning, lemma]) => makeWord({
    word,
    partOfSpeech: ["word"],
    meaningZh: [meaningZh],
    meaningEn: [meaningEn],
    frequency: band,
    rootIds: [rootId],
    morphology,
    literalMeaning,
    semanticEvolution: [literalMeaning, meaningZh],
    rootTier,
    lemma,
    family: lemma && lemma !== word ? [lemma, word] : [word],
    relatedWords: rows.filter((row) => row[0] !== word).slice(0, 3).map((row) => row[0])
  }));
}

const sets: Record<string, Row[]> = {
  form: [
    ["form", "形式", "shape or type", "very-high", "core", "form", "shape"], ["information", "信息", "facts provided", "very-high", "core", "in + form + ation", "shape within"], ["perform", "执行", "carry out", "very-high", "core", "per + form", "form thoroughly"], ["transform", "转变", "change form", "high", "core", "trans + form", "shape across"], ["reform", "改革", "improve by changing", "high", "core", "re + form", "form again"], ["formal", "正式的", "official in style", "high", "extension", "form + al", "related to form"], ["formation", "形成", "process of forming", "medium", "extension", "form + ation", "process of shaping", "form"]
  ],
  ject: [
    ["project", "项目", "planned piece of work", "very-high", "core", "pro + ject", "throw forward"], ["object", "物体", "a material thing", "very-high", "core", "ob + ject", "throw against"], ["subject", "主题", "topic under discussion", "very-high", "core", "sub + ject", "throw under"], ["reject", "拒绝", "refuse to accept", "high", "core", "re + ject", "throw back"], ["inject", "注射", "put fluid into", "high", "core", "in + ject", "throw into"], ["eject", "弹出", "force out", "medium", "extension", "e + ject", "throw out"], ["interject", "插话", "interrupt with a remark", "medium", "extension", "inter + ject", "throw between"]
  ],
  tract: [
    ["attract", "吸引", "draw toward", "very-high", "core", "at + tract", "pull toward"], ["contract", "合同", "binding agreement", "very-high", "core", "con + tract", "draw together"], ["extract", "提取", "take out", "high", "core", "ex + tract", "pull out"], ["distract", "使分心", "draw attention away", "high", "core", "dis + tract", "pull apart"], ["subtract", "减去", "take away a quantity", "high", "core", "sub + tract", "pull away"], ["retract", "撤回", "draw back", "medium", "extension", "re + tract", "pull back"], ["traction", "牵引力", "grip or pulling force", "medium", "extension", "tract + ion", "act of pulling"]
  ],
  struct: [
    ["structure", "结构", "arrangement of parts", "very-high", "core", "struct + ure", "something built"], ["construct", "建造", "build", "high", "core", "con + struct", "build together"], ["instruct", "指导", "teach or direct", "high", "core", "in + struct", "build knowledge in"], ["destruct", "破坏", "destroy", "high", "core", "de + struct", "unbuild"], ["infrastructure", "基础设施", "basic systems and facilities", "high", "core", "infra + struct + ure", "structure below"], ["reconstruct", "重建", "build again", "medium", "extension", "re + construct", "build again", "construct"], ["structural", "结构上的", "relating to structure", "medium", "extension", "struct + ural", "related to what is built", "structure"]
  ],
  cred: [
    ["credit", "信用", "trust or recognition", "very-high", "core", "cred + it", "trust given"], ["credible", "可信的", "able to be believed", "high", "core", "cred + ible", "able to be believed"], ["incredible", "难以置信的", "hard to believe", "very-high", "core", "in + credible", "not believable"], ["credentials", "资历证明", "proof of qualification", "high", "core", "cred + entials", "proof for trust"], ["creed", "信条", "set of beliefs", "medium", "core", "cred", "what is believed"], ["credibility", "可信度", "quality of being trusted", "medium", "extension", "cred + ibility", "capacity for belief", "credible"], ["discredit", "使失去信誉", "harm a reputation", "medium", "extension", "dis + credit", "remove trust", "credit"]
  ],
  mit: [
    ["submit", "提交", "send for consideration", "very-high", "core", "sub + mit", "send under"], ["permit", "允许", "allow", "very-high", "core", "per + mit", "send through"], ["commit", "承诺", "pledge or devote", "very-high", "core", "com + mit", "send together"], ["transmit", "传输", "send across", "high", "core", "trans + mit", "send across"], ["omit", "省略", "leave out", "high", "core", "ob + mit", "send away"], ["admit", "承认", "accept as true", "high", "extension", "ad + mit", "send toward"], ["dismiss", "解雇", "send away", "high", "extension", "dis + miss", "send apart"]
  ],
  vis: [
    ["visible", "可见的", "able to be seen", "very-high", "core", "vis + ible", "able to be seen"], ["vision", "视觉", "ability to see", "very-high", "core", "vis + ion", "act of seeing"], ["visit", "访问", "go to see", "very-high", "core", "vis + it", "go to see"], ["visual", "视觉的", "relating to sight", "high", "core", "vis + ual", "related to seeing"], ["revise", "修改", "look at again", "high", "core", "re + vis", "see again"], ["supervise", "监督", "watch over", "high", "extension", "super + vis", "see over"], ["envision", "设想", "imagine", "medium", "extension", "en + vision", "see in the mind"]
  ],
  scrib: [
    ["describe", "描述", "give an account of", "very-high", "core", "de + scrib", "write down"], ["subscribe", "订阅", "sign up to receive", "high", "core", "sub + scrib", "write under"], ["prescribe", "开处方", "authorize medicine", "high", "core", "pre + scrib", "write beforehand"], ["script", "脚本", "written text", "high", "core", "script", "something written"], ["manuscript", "手稿", "original written text", "medium", "core", "manu + script", "written by hand"], ["inscription", "铭文", "words written on a surface", "medium", "extension", "in + script + ion", "writing on"], ["transcribe", "转录", "write out from another source", "medium", "extension", "trans + scrib", "write across"]
  ],
  fer: [
    ["transfer", "转移", "move from one place to another", "very-high", "core", "trans + fer", "carry across"], ["offer", "提供", "present for acceptance", "very-high", "core", "ob + fer", "carry toward"], ["prefer", "更喜欢", "like better", "very-high", "core", "pre + fer", "carry before"], ["refer", "提及", "mention or direct", "very-high", "core", "re + fer", "carry back"], ["infer", "推断", "reach a conclusion", "high", "core", "in + fer", "carry into"], ["differ", "不同", "be unlike", "very-high", "extension", "dis + fer", "carry apart"], ["confer", "商议", "discuss together", "medium", "extension", "con + fer", "bring together"]
  ],
  duc: [
    ["produce", "生产", "make or create", "very-high", "core", "pro + duc", "lead forward"], ["reduce", "减少", "make smaller", "very-high", "core", "re + duc", "lead back"], ["introduce", "介绍", "bring in", "very-high", "core", "intro + duc", "lead inside"], ["conduct", "进行", "organize or lead", "high", "core", "con + duct", "lead together"], ["educate", "教育", "teach", "high", "core", "e + duc + ate", "lead out"], ["deduce", "推导", "reach by reasoning", "medium", "extension", "de + duc", "lead down from"], ["induce", "促使", "cause to happen", "medium", "extension", "in + duc", "lead into"]
  ],
  rupt: [
    ["interrupt", "打断", "stop briefly", "very-high", "core", "inter + rupt", "break between"], ["erupt", "爆发", "burst out", "high", "core", "e + rupt", "break out"], ["disrupt", "扰乱", "prevent normal operation", "high", "core", "dis + rupt", "break apart"], ["bankrupt", "破产的", "unable to pay debts", "high", "core", "bank + rupt", "broken bank"], ["corrupt", "腐败的", "dishonest", "high", "core", "cor + rupt", "thoroughly broken"], ["rupture", "破裂", "a break or burst", "medium", "extension", "rupt + ure", "state of breaking"], ["disruption", "中断", "disturbance", "medium", "extension", "disrupt + ion", "act of breaking apart", "disrupt"]
  ],
  press: [
    ["express", "表达", "show or communicate", "very-high", "core", "ex + press", "press out"], ["pressure", "压力", "force applied", "very-high", "core", "press + ure", "state of pressing"], ["impress", "给人印象", "affect strongly", "high", "core", "im + press", "press into"], ["compress", "压缩", "press together", "high", "core", "com + press", "press together"], ["depress", "使沮丧", "make sad or lower", "high", "core", "de + press", "press down"], ["suppress", "抑制", "hold back", "medium", "extension", "sub + press", "press under"], ["repress", "压制", "restrain", "medium", "extension", "re + press", "press back"]
  ],
  mov: [
    ["move", "移动", "change position", "very-high", "core", "mov", "move"], ["remove", "移除", "take away", "very-high", "core", "re + mov", "move away"], ["movement", "运动", "act of moving", "very-high", "core", "mov + ment", "act of moving", "move"], ["movie", "电影", "moving picture", "very-high", "core", "mov + ie", "moving image"], ["motivate", "激励", "give a reason to act", "high", "core", "mot + iv + ate", "set in motion"], ["emotion", "情绪", "strong feeling", "high", "extension", "e + mot + ion", "movement outward"], ["promote", "促进", "help advance", "high", "extension", "pro + mot", "move forward"]
  ],
  cap: [
    ["accept", "接受", "agree to receive", "very-high", "core", "ac + cept", "take toward"], ["except", "除了", "not including", "very-high", "core", "ex + cept", "take out"], ["concept", "概念", "general idea", "very-high", "core", "con + cept", "take together"], ["capture", "捕获", "take control of", "high", "core", "capt + ure", "act of taking"], ["capacity", "能力", "maximum amount", "high", "core", "cap + acity", "ability to hold"], ["recipient", "接收者", "person who receives", "high", "extension", "re + cip + ient", "one who takes back"], ["intercept", "拦截", "stop on the way", "medium", "extension", "inter + cept", "take between"]
  ],
  ten: [
    ["maintain", "维持", "keep in condition", "very-high", "core", "main + tain", "hold in hand"], ["obtain", "获得", "get", "high", "core", "ob + tain", "hold toward"], ["contain", "包含", "have inside", "very-high", "core", "con + tain", "hold together"], ["retain", "保留", "keep", "high", "core", "re + tain", "hold back"], ["attention", "注意", "notice or focus", "very-high", "core", "at + tent + ion", "stretch toward"], ["sustain", "维持", "support over time", "high", "extension", "sus + tain", "hold from below"], ["detain", "拘留", "keep from leaving", "medium", "extension", "de + tain", "hold away"]
  ],
  fac: [
    ["fact", "事实", "something known true", "very-high", "core", "fact", "thing done"], ["factory", "工厂", "place where things are made", "very-high", "core", "fact + ory", "place for making"], ["affect", "影响", "produce a change", "very-high", "core", "af + fect", "act upon"], ["effect", "效果", "result", "very-high", "core", "e + fect", "thing brought about"], ["facilitate", "促进", "make easier", "high", "core", "fac + ilitate", "make doable"], ["manufacture", "制造", "make goods", "high", "extension", "manu + fact + ure", "make by hand"], ["defect", "缺陷", "fault", "high", "extension", "de + fect", "making that falls short"]
  ],
  pos: [
    ["position", "位置", "place or role", "very-high", "core", "pos + ition", "state of being placed"], ["purpose", "目的", "reason for doing", "very-high", "core", "pur + pose", "put forward"], ["oppose", "反对", "act against", "high", "core", "op + pose", "place against"], ["propose", "提议", "suggest", "very-high", "core", "pro + pose", "put forward"], ["compose", "组成", "form by combining", "high", "core", "com + pose", "put together"], ["expose", "暴露", "make visible", "high", "extension", "ex + pose", "put out"], ["deposit", "存放", "put down", "high", "extension", "de + pos + it", "put down"]
  ]
};

export const stage1ExpansionWords: Word[] = Object.entries(sets).flatMap(([rootId, rows]) => expand(rootId, rows));

export const stage1ExpansionRootMeanings = rootMeanings;
