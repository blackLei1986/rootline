import { z } from "zod";

const source = z.enum(["carryover", "weak", "root-core", "support"]);
const duration = z.number().int().min(0).max(86_400_000);
const count = z.number().int().min(0).max(1_000);
const timestamp = z.iso.datetime({ offset: true });

const eventSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("plan-observed"), targetCount: count.max(30), newWordCount: count.max(30).optional(), sourceCounts: z.record(source, count.max(30)).optional() }),
  z.strictObject({ type: z.literal("plan-created") }),
  z.strictObject({ type: z.literal("session-started"), at: timestamp.optional() }),
  z.strictObject({ type: z.literal("session-completed"), at: timestamp.optional() }),
  z.strictObject({ type: z.literal("activity-duration"), activity: z.enum(["block-a", "block-b", "block-c", "mini-review-a", "mini-review-b", "mini-review-c", "final-review"]), milliseconds: duration }),
  z.strictObject({ type: z.literal("review-outcome"), kind: z.enum(["mini", "final"]), source, originSource: source.optional(), correct: z.boolean() }),
  z.strictObject({ type: z.literal("reading-open") }),
  z.strictObject({ type: z.literal("today-open") }),
  z.strictObject({ type: z.literal("reading-observed"), sessionToken: z.string().regex(/^[0-9a-f]{16}$/) }),
  z.strictObject({ type: z.literal("reading-completed"), sessionToken: z.string().regex(/^[0-9a-f]{16}$/) }),
  z.strictObject({ type: z.literal("progress-open") }),
  z.strictObject({ type: z.literal("recoverable-error") }),
  z.strictObject({ type: z.literal("conflict-recovery") }),
  z.strictObject({ type: z.literal("route-timing"), route: z.enum(["today", "reading", "reading-article", "progress"]), milliseconds: duration }),
  z.strictObject({
    type: z.literal("journal"),
    ratings: z.strictObject({ difficulty: z.number().int().min(1).max(5), fatigue: z.number().int().min(1).max(5), rootUsefulness: z.number().int().min(1).max(5), reviewUsefulness: z.number().int().min(1).max(5) }),
    continueTomorrow: z.boolean(),
    note: z.string().max(2_000),
  }),
]);

const submissionSchema = z.strictObject({
  eventKey: z.string().max(80).regex(/^(?:event:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|today:\d{4}-\d{2}-\d{2}:\d+)$/),
  learningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  event: eventSchema,
});

export type BetaEvidenceSubmission = z.infer<typeof submissionSchema>;
export type BetaEvidenceEvent = BetaEvidenceSubmission["event"];

export function parseBetaEvidenceEvent(input: unknown): BetaEvidenceEvent {
  return eventSchema.parse(input);
}

export function parseBetaEvidenceSubmission(input: unknown): BetaEvidenceSubmission {
  const submission = submissionSchema.parse(input);
  const date = new Date(`${submission.learningDate}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== submission.learningDate) throw new Error("Invalid learning date");
  if (submission.eventKey.startsWith("today:") && !submission.eventKey.startsWith(`today:${submission.learningDate}:`)) throw new Error("Today revision date mismatch");
  if (submission.event.type !== "journal") return submission;
  return {
    ...submission,
    event: {
      ...submission.event,
      note: submission.event.note
        .replace(/https?:\/\/\S+|www\.\S+/gi, "[link removed]")
        .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email removed]")
        .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, "[identifier removed]")
        .replace(/\b(?:article|word|vocab|target|root)[-_:#][a-z0-9_-]{4,}\b/gi, "[identifier removed]")
        .slice(0, 500),
    },
  };
}
