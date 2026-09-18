export interface Course {
  id: string;
  title: string;
  titleZh: string;
  description: string;
  stages: CourseStage[];
}

export interface CourseStage {
  id: string;
  title: string;
  titleZh: string;
  description: string;
  order: number;
  units: CourseUnit[];
  rootIds: string[];
  previewRoots?: string[];
  unlockRule?: StageUnlockRule;
}

export interface CourseUnit {
  id: string;
  title: string;
  description: string;
  order: number;
  rootIds: string[];
}

export interface StageUnlockRule {
  requiredRootCompletionRatio: number;
  requiredAverageMastery: number;
}
