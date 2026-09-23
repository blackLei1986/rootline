export const CONTENT_QUALITY_GATES = Object.freeze({
  acceptedLemmaMinimum: 8_000,
  acceptedLemmaTargetMinimum: 8_500,
  acceptedLemmaTargetMaximum: 10_000,
  coreMeaningCoverageMinimum: 0.99,
  exampleCoverageMinimum: 0.98,
  sourceMetadataCoverageMinimum: 0.95,
  tierAssignmentCoverageMinimum: 1,
  qaSampleSizePer500: 25,
  minimumSourceConfidence: 70
});
