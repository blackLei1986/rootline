# Final product acceptance

Generated at 2026-09-18T01:53:10.430Z

accepted lemma count: **9000**

| Check | Status | Detail |
| --- | --- | --- |
| acceptedLemmaCount | pass | accepted lemma count 9000 (target 9000). |
| vocabularyGate | pass | final gate true, duplicates 0, tier-depth issues 0. |
| accountFlow | pass | 27 account checks passed. |
| rls | pass | RLS policy tests reference owner-allow, cross-user-deny, and anonymous-deny assertions. |
| rssSafety | pass | SSRF policy and redirect-pivot tests present. |
| articleDeduplication | pass | Article deduplication tests present. |
| candidateLimit | pass | Reading hub limits candidates to three. |
| migrationIdempotency | pass | Idempotent migration tests present. |
| todayArticleCount | pass | At most one article per plan (array rejected). |
| fiveQuestions | pass | Eligible article generates exactly five unique questions with valid answer choices. |
| eligiblePlanStages | pass | Eligible plan includes reading and context-quiz stages with five questions. |
| degradation | pass | Article-less plan omits reading stages and keeps vocabulary stages. |
| stageOrder | pass | Today stage order frozen as warmup → scan → learn → reading → context-quiz → summary. |
| rssAudit | pass | 21 RSS checks passed; reading index lemma count 9000. |
| fullTestBuildStatus | gate | Verified by the release gate command chain (pnpm test / lint / tsc / build), not by this aggregator. |

Overall: **PASS**
