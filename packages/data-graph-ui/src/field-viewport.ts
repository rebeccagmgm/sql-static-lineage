/** Only draw an individual field edge when its port is inside the scroll viewport. */
export function fieldHandleVisible(
  rowTop: number,
  rowBottom: number,
  viewTop: number,
  viewBottom: number,
) {
  const center = (rowTop + rowBottom) / 2;
  return center >= viewTop && center <= viewBottom;
}
export function edgeTouchesHiddenField(
  edge: { sourceHandle?: string | null; targetHandle?: string | null },
  hidden: ReadonlySet<string>,
) {
  return Boolean(
    (edge.sourceHandle && hidden.has(edge.sourceHandle)) ||
    (edge.targetHandle && hidden.has(edge.targetHandle)),
  );
}
