# OpenCLI catalog commands

## Table classification catalog

- opencli szdata classification-list -f json
- opencli szdata catalog-search --classification 按元数据分类 --page-size 20 -f json

Optional filters: --keyword, --system (exact owning-system ID), --database (physical database qualified ID), --page, --page-size. Use catalog-search --help. A response validates only one live page; total is the server search count, not a completed export. Cross-source database matches are rejected. HTTP/auth failures stop the command without automatic retries. Virtual directory membership does not manufacture classification tags. Inactive and temporary tables are excluded.

Installed implementation: ~/.opencli/shared/szdata-core/commands/metadata/catalog.js and catalog-core.mjs. Wrappers are registered in szdata and its command manifest. Strategy: PAGE_FETCH for table search, DOM_STATE for live taxonomy list; internal-unstable/visible-ui contracts. Reuses existing authenticated portal helpers. No credentials are persisted.
