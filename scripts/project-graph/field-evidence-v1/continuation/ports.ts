import type { ReadPartitionScope } from "../../../evidence/sql-read-scope.ts";
import type { ProducerTableIdentity } from "../../../reconcile/producer/producer-index.ts";
import type { TableProducerIndex } from "../../../reconcile/producer/producer-index.ts";
import type { HoraeScheduleRelationLookup } from "../schedule-preference.ts";

export type ReadScopeLookupResult =
  | { readonly kind: "OK"; readonly scope: ReadPartitionScope }
  | { readonly kind: "UNAVAILABLE"; readonly reasonCode: "READ_SCOPE_UNAVAILABLE" };

export interface ContinuationPorts {
  readonly scheduleLookup: HoraeScheduleRelationLookup | null;
  readonly producerIndex: TableProducerIndex | null;
  readonly readScopeFor: (input: {
    readonly consumerTaskId: string;
    readonly readOccurrenceId: string;
    readonly qualifiedName: string;
  }) => ReadScopeLookupResult;
  readonly tableIdentityFor: (qualifiedName: string) => ProducerTableIdentity;
}
