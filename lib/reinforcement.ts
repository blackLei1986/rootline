import type { LearningSession, LearningSessionItem } from "@/types/session";

export function insertReinforcementItem(
  session: LearningSession,
  sourceItem: LearningSessionItem,
  random: () => number = Math.random
): LearningSession {
  if (!sourceItem.wordId) return session;
  const count = session.reinforcementCounts[sourceItem.wordId] ?? 0;
  if (count >= 3) return session;
  const gap = 2 + Math.floor(random() * 4);
  let insertionIndex = session.items.length;
  let quizItemsSeen = 0;
  for (let index = session.currentIndex + 1; index < session.items.length; index += 1) {
    if (session.items[index].type !== "quiz") continue;
    quizItemsSeen += 1;
    if (quizItemsSeen >= gap) {
      insertionIndex = index + 1;
      break;
    }
  }
  const reinforcement: LearningSessionItem = {
    ...sourceItem,
    id: `${sourceItem.id}-reinforcement-${count + 1}`,
    stage: "mixed-quiz",
    reinforcement: true
  };
  const items = [...session.items];
  items.splice(insertionIndex, 0, reinforcement);
  return {
    ...session,
    items,
    reinforcementCounts: {
      ...session.reinforcementCounts,
      [sourceItem.wordId]: count + 1
    }
  };
}
