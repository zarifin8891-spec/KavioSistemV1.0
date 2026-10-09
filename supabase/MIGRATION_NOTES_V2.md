# KAVIO V2 migration notes

`migrations/` contains the 19 migrations recorded on the V2 Supabase project. They rebuild the V1-compatible foundation and layer the V2 schema on top. The old repository migration files are retained under `migrations_v1_archive/` for reference and are intentionally outside Supabase CLI's migration path.

`cleanup_invalid_bootstrap_operational_data.sql` is archived and not applied to V2. That cleanup expects specific V1 test transactions; V2 starts with Sales, SPK, Progress, and material stock empty.

The V2 project also has project-specific master data, Siteplan mappings, and the Type 36 RAB seed. Those rows are data setup, not schema migrations. When provisioning another project database, apply the schema migrations first, then import that project's masters, kavling, and Siteplan data, followed by any relevant RAB templates.
