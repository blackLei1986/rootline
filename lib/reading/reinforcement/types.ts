import type { WordProgress } from "@/types/progress";

export type QuestionType = "recognition" | "cloze" | "recall";

export interface FrozenQuestion {
  id: string;
  wordId: string;
  type: QuestionType;
  context: string;
  prompt: string;
  choices?: string[];
  acceptedAnswers: string[];
  correctDisplay: string;
  explanation?: string;
}

export interface ReadingOutcome {
  questionId: string;
  wordId: string;
  submittedAnswer: string;
  correct: boolean;
  correctDisplay: string;
  answeredAt: string;
}

export interface ReadingSessionRow {
  id: string;
  user_id: string;
  article_id: string;
  learning_date: string;
  status: "active" | "complete";
  revision: number;
  cursor: number;
  questions: FrozenQuestion[];
  outcomes: ReadingOutcome[];
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface CommitReadingAnswerInput {
  userId: string;
  sessionId: string;
  questionId: string;
  expectedSessionRevision: number;
  wordId: string;
  expectedReadingRevision: number;
  expectedWordRevision: number;
  eventId: string;
  submittedAnswer: string;
  correct: boolean;
  eventType: "quiz_correct" | "quiz_wrong";
  eventPayload: Record<string, string | number | boolean>;
  nextWordState: WordProgress;
}

export type CommitReadingAnswerResult =
  | { kind: "accepted"; row: ReadingSessionRow; wordState: WordProgress }
  | { kind: "duplicate"; row: ReadingSessionRow }
  | { kind: "conflict"; row: ReadingSessionRow };

export type PublicQuestion = Omit<FrozenQuestion, "acceptedAnswers" | "correctDisplay">;

export interface PublicSession {
  id: string;
  articleId: string;
  articleLabel: string;
  learningDate: string;
  status: "active" | "complete";
  cursor: number;
  total: number;
  practiced: number;
  correct: number;
  currentQuestion: PublicQuestion | null;
  outcomes: ReadingOutcome[];
}
