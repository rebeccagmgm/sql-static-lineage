/**
 * Compatibility surface for legacy field-lineage importers.
 *
 * The canonical semantic contract lives under target-field-causal-slice as
 * shared infrastructure (the field×branch product surface was retired).
 * This file deliberately contains no traversal or assessment API.
 */
export * from "../target-field-causal-slice/semantic-dependency-contract.ts";
