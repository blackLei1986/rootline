export type QuizMode =
  | "root-to-meaning"
  | "word-to-meaning"
  | "meaning-to-word"
  | "morphology-to-word"
  | "word-to-root";

export interface QuizQuestion {
  id: string;
  type: QuizMode;
  prompt: string;
  instruction: string;
  options?: string[];
  answer: string;
  acceptedAnswers?: string[];
  explanation?: string;
  wordId?: string;
  rootId?: string;
}
