# Deprecated Calcite compatibility wrapper

Calcite Java, Maven dependencies, process execution, fixtures, and runtime
tests now live in the independently versioned sidecar at:

`E:\02_area\股衍数据-数据cookbook\scripts\Calcite`

The main repository keeps this short documentation/command compatibility
entrypoint only. It is not part of the Native pipeline and it does not read or
write canonical lineage artifacts. New Plan Facts work should use the
sidecar's `PLAN_FACTS_REL_V1` runner; the legacy raw-SQL fixture is retained
there only for explicit compatibility testing.

```powershell
npm run test:calcite-oracle
```

To use another checked-out sidecar explicitly:

```powershell
powershell -ExecutionPolicy Bypass -File tools/calcite-oracle/test-runtime.ps1 `
  -SidecarRoot E:\path\to\Calcite
```
