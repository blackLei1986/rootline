export interface ContextQuestion {
  id: string;
  articleId: string;
  sentence: string;
  targetWordId: string;
  prompt: string;
  choices: string[];
  correctChoice: string;
}
