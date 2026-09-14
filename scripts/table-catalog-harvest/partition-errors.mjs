const missingTypeMessage = '查询异常Cannot invoke "String.startsWith(String)" because "typeName" is null';

export function partitionBusinessErrorCode(body) {
  return body?.code === 1 && body.msg === missingTypeMessage
    ? 'SOURCE_METADATA_TYPE_MISSING' : 'PORTAL_BUSINESS_ERROR';
}

export async function runPartitionTable(action, onMissingMetadata) {
  try { return await action(); }
  catch (error) {
    if (error?.message !== 'SOURCE_METADATA_TYPE_MISSING') throw error;
    await onMissingMetadata();
    return 'BLOCKED';
  }
}
