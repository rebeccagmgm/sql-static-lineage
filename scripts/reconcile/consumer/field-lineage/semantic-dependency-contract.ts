/**
 * Compatibility surface for legacy field-lineage importers.
 *
 * The canonical semantic contract now belongs to the isolated causal-slice
 * consumer. This file deliberately contains no traversal or assessment API.
 */
export * from "../target-field-causal-slice/semantic-dependency-contract.ts";
