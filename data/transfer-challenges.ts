export interface TransferChallenge {
  id: string;
  unitId: string;
  prompt: string;
  morphology: string;
  clue: string;
  options: string[];
  answer: string;
  explanation: string;
}

export const transferChallenges: TransferChallenge[] = [
  { id: "retrospect", unitId: "unit-1", prompt: "retrospect 最接近哪个意思？", morphology: "retro + spect", clue: "retro = backward · spect = look", options: ["回顾", "建造", "携带", "书写"], answer: "回顾", explanation: "backward + look → 向后看 → 回顾。" },
  { id: "reconstruct", unitId: "unit-2", prompt: "reconstruct 最接近哪个意思？", morphology: "re + construct", clue: "re = again · struct = build", options: ["重建", "撤回", "相信", "监督"], answer: "重建", explanation: "again + build → 再次建造 → 重建。" },
  { id: "transcription", unitId: "unit-3", prompt: "transcription 最接近哪个意思？", morphology: "trans + script + ion", clue: "trans = across · script = write", options: ["转录", "中断", "推导", "压缩"], answer: "转录", explanation: "across + write → 从一种载体写到另一种载体 → 转录。" },
  { id: "composition", unitId: "unit-4", prompt: "composition 最接近哪个意思？", morphology: "com + pos + ition", clue: "com = together · pos = put", options: ["组成", "拘留", "制造", "捕获"], answer: "组成", explanation: "together + put → 放在一起 → 组成。" }
];
