# data-graph 本机启停操作手册

本文只说明本机已发布 `titans-otc` asset graph 的启动、核验和停止。
启动现有图不等于重新发布；仅在明确要求更新图数据时才执行
`graph:prepare` / `graph:publish`。

## 当前本机部署

2026-09-10 起，默认图库为 **ArcadeDB 26.9.1 Windows native**。
验收记录见 [图库迁移记录](arcadedb-migration.md)。

- 本机运行目录：`artifacts/arcadedb/runtime`，不需要 Java 或 Docker。
- 本机密钥：`artifacts/arcadedb/password.txt`，不提交 Git。
- 配置：`config/workspace-paths.json` 的 `graphDatabase`。
- ArcadeDB Bolt：`127.0.0.1:17688`；管理 HTTP：`127.0.0.1:12481`。
- data-graph API：`127.0.0.1:8791`；React Flow 前端：`127.0.0.1:8792`。
- 数据库沿用验收名称 `lineage_arcade_trial`，已经作为当前正式查询库使用。

## 最短启动流程

所有命令均在仓库根目录执行。运行目录和密码文件为本机部署产物，
新的 checkout 不包含它们；缺失时按迁移记录恢复部署，不要生成新密码覆盖已有库。

### 1. 检查已发布图

```powershell
.\scripts\lineage-graph.ps1 status
```

返回 `meta.backend: arcadedb`、`ok: true`、`data.state: READY` 即可使用。
若返回 `ARCADEDB_UNAVAILABLE`，执行第 2 步。

### 2. 启动 ArcadeDB

```powershell
.\scripts\arcadedb.ps1 start
.\scripts\lineage-graph.ps1 status
```

启动器校验二进制哈希、进程身份和端口，并等待 HTTP/Bolt 就绪；
已启动时复用现有进程。进程就绪不等于图已发布，图状态以 CLI 为准。

### 3. 启动 API 和前端

分别在两个后台进程或两个终端中运行：

```powershell
npm run graph:serve
npm run graph:ui
```

需要后台运行时使用精确日志文件，避免打开额外窗口：

```powershell
$repo = (Get-Location).Path
Start-Process npm.cmd -ArgumentList @('run', 'graph:serve') `
  -WorkingDirectory $repo -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $env:TEMP 'data-graph-api.stdout.log') `
  -RedirectStandardError (Join-Path $env:TEMP 'data-graph-api.stderr.log')

Start-Process npm.cmd -ArgumentList @('run', 'graph:ui') `
  -WorkingDirectory $repo -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $env:TEMP 'data-graph-ui.stdout.log') `
  -RedirectStandardError (Join-Path $env:TEMP 'data-graph-ui.stderr.log')
```

### 4. 验收

```powershell
$status = Invoke-RestMethod 'http://127.0.0.1:8791/api/status'
$page = Invoke-WebRequest 'http://127.0.0.1:8792/' -UseBasicParsing
[pscustomobject]@{
  GraphState = $status.state
  Version = $status.version
  UiStatus = $page.StatusCode
}
```

验收条件：

- `GraphState` 为 `READY`；
- `Version` 与 `.\scripts\lineage-graph.ps1 status` 一致；
- `UiStatus` 为 `200`；
- 浏览器可打开 <http://127.0.0.1:8792/>。

## 常见误区

本机浏览器验收已通过 OpenCLI 连接现有 Chrome。若当前终端找不到 `opencli`，
可用 `& "$env:APPDATA\npm\opencli.cmd" doctor` 检查已安装的入口。
Codex 自带浏览器控制报 `nodeRepl.fetch request failed` 时，不代表图服务不可用；
先核对 CLI/API，再按浏览器技能通过已连接的 Chrome 验收，不要重新发布数据。

- **只要求启动**：不要运行 `graph:prepare` 或 `graph:publish`。
- **`ARCADEDB_UNAVAILABLE`**：执行 `.\scripts\arcadedb.ps1 start`，再检查 CLI 状态。
- **端口已占用**：先定位占用 `17688`、`8791`、`8792` 的精确 PID 和命令行；
  不要按进程名批量停止 `java` 或 `node`。
- **API 可用但页面不更新**：刷新页面并重新查询；Vite 热更新不会自动重拉
  已在画布内存中的旧 trace。
- **本地 `publish-progress.json` 是 `READY`**：这只能证明曾发布过；当前是否可用
  仍以实时 CLI/API 状态为准。

## 停止

停止时只处理本次启动的精确 PID。先通过监听端口定位 PID，再核对其命令行，
不要批量结束所有 `java`、`node` 或 `npm` 进程：

```powershell
netstat -ano -p tcp | Select-String ":8791 |:8792 "
```

确认 API/前端的 PID 和启动命令后再停止对应进程。停止图库使用：

```powershell
.\scripts\arcadedb.ps1 stop
```

该命令核对本机运行进程身份，再请求数据库正常关闭。
