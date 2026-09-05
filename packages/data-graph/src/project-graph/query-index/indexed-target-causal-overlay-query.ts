import {
  explainTargetCausalAssessmentFromProjection,
  getTargetCausalOverlayFromProjection,
  getTargetCausalTaskRollupFromProjection,
  type GetTargetCausalOverlayOptions,
} from "../target-causal-overlay/target-causal-overlay-query.ts";
import {
  loadIndexedTargetCausalOverlay,
  type QueryIndexExpectedSource,
} from "./query-index-query-source.ts";

export interface IndexedTargetCausalOverlaySource extends QueryIndexExpectedSource {
  readonly targetCausalOverlaySnapshotId: string;
}

export async function getIndexedTargetCausalOverlay(
  input: IndexedTargetCausalOverlaySource,
  options: GetTargetCausalOverlayOptions = {},
): Promise<ReturnType<typeof getTargetCausalOverlayFromProjection>> {
  return getTargetCausalOverlayFromProjection(
    await loadIndexedTargetCausalOverlay(input),
    options,
  );
}

export async function getIndexedTargetCausalTaskRollup(
  input: IndexedTargetCausalOverlaySource,
  taskId: string,
  options: { readonly maxAssessments?: number } = {},
): Promise<ReturnType<typeof getTargetCausalTaskRollupFromProjection>> {
  return getTargetCausalTaskRollupFromProjection(
    await loadIndexedTargetCausalOverlay(input),
    taskId,
    options,
  );
}

export async function explainIndexedTargetCausalAssessment(
  input: IndexedTargetCausalOverlaySource,
  assessmentId: string,
  options: { readonly maxAttachments?: number } = {},
): Promise<ReturnType<typeof explainTargetCausalAssessmentFromProjection>> {
  return explainTargetCausalAssessmentFromProjection(
    await loadIndexedTargetCausalOverlay(input),
    assessmentId,
    options,
  );
}
