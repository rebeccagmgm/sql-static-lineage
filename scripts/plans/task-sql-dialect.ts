export type TaskSqlDialect = "databricks" | "duckdb";

/** Select the parser profile from the task's source-side SQL family. */
export function taskSqlDialect(taskCategory: string): TaskSqlDialect {
  return taskCategory.trim().toLowerCase().startsWith("oracle2")
    ? "duckdb"
    : "databricks";
}
