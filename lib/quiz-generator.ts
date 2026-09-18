import { roots as defaultRoots } from "@/data/roots";
import { words as defaultWords } from "@/data/words";
import type { Root, Word } from "@/types";
import type { QuizMode, QuizQuestion } from "@/types/quiz";

export interface GenerateQuizInput {
  word?: Word;
  root?: Root;
  mode: QuizMode;
  allWords?: Word[];
  allRoots?: Root[];
  random?: () => number;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function uniqueOptions(answer: string, distractors: string[], random: () => number): string[] {
  const unique = [...new Set(distractors.filter((item) => item && item !== answer))];
  return shuffle([answer, ...unique.slice(0, 3)], random);
}

export function generateQuiz({
  word,
  root,
  mode,
  allWords = defaultWords,
  allRoots = defaultRoots,
  random = Math.random
}: GenerateQuizInput): QuizQuestion {
  const baseId = `${mode}-${word?.id ?? root?.id ?? "unknown"}`;

  if (mode === "root-to-meaning") {
    if (!root) throw new Error("Root-to-meaning quiz requires a root.");
    const answer = root.meaningZh[0];
    return {
      id: baseId,
      type: mode,
      prompt: root.root,
      instruction: "这个词根的核心含义是？",
      options: uniqueOptions(answer, allRoots.map((item) => item.meaningZh[0]), random),
      answer,
      acceptedAnswers: [...root.meaningZh, ...root.meaningEn],
      explanation: `${root.root} = ${root.meaningEn.join(" / ")} · ${root.meaningZh.join(" / ")}`,
      rootId: root?.id
    };
  }

  if (!word) {
    throw new Error(`Quiz mode ${mode} requires a word.`);
  }

  const explanation = `${word.word} · ${word.morphology} · ${word.literalMeaning} → ${word.meaningZh[0]}`;
  if (mode === "word-to-meaning") {
    const answer = word.meaningZh[0];
    return {
      id: baseId,
      type: mode,
      prompt: word.word,
      instruction: "这个单词的核心中文含义是？",
      options: uniqueOptions(answer, allWords.map((item) => item.meaningZh[0]), random),
      answer,
      acceptedAnswers: word.meaningZh,
      explanation,
      wordId: word.id,
      rootId: root?.id
    };
  }

  if (mode === "meaning-to-word") {
    return {
      id: baseId,
      type: mode,
      prompt: word.meaningZh[0],
      instruction: "请输入对应的英文单词。",
      answer: word.word,
      acceptedAnswers: [word.word],
      explanation,
      wordId: word.id,
      rootId: root?.id
    };
  }

  if (mode === "morphology-to-word") {
    return {
      id: baseId,
      type: mode,
      prompt: word.morphology,
      instruction: "这个构词结构对应哪个单词？",
      answer: word.word,
      acceptedAnswers: [word.word],
      explanation,
      wordId: word.id,
      rootId: root?.id
    };
  }

  if (!root) throw new Error("Word-to-root quiz requires a root.");
  const answer = root.root;
  return {
    id: baseId,
    type: mode,
    prompt: word.word,
    instruction: "这个单词的核心词根是？",
    options: uniqueOptions(answer, allRoots.map((item) => item.root), random),
    answer,
    acceptedAnswers: [answer],
    explanation,
    wordId: word.id,
    rootId: root.id
  };
}

export function normalizeQuizAnswer(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function isQuizAnswerCorrect(question: QuizQuestion, value: string): boolean {
  const normalized = normalizeQuizAnswer(value);
  const answers = [question.answer, ...(question.acceptedAnswers ?? [])];
  return answers.some((answer) => normalizeQuizAnswer(answer) === normalized);
}
