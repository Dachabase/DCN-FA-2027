# University of Ibadan Freshers Companion: AWS RDS PostgreSQL Migration Runbook

This runbook provides end-to-end instructions for migrating the UI Freshers Companion database to **Amazon RDS for PostgreSQL** (or **Amazon Aurora Serverless v2 PostgreSQL**), configuring AWS Secrets Manager, applying Row Level Security (RLS) policies, and validating the zero-downtime cutover.

---

## 1. Architecture & Security Specifications

| Attribute | Specification | Rationale / Compliance |
| :--- | :--- | :--- |
| **Engine** | PostgreSQL 16.3 on Amazon RDS | Long-term support, standard RLS, full Prisma compatibility |
| **Network Placement** | Private Subnets across 2 AZs | Non-routable over public internet |
| **Ingress Rule** | Port 5432 strictly from App Compute Security Group | Zero-trust firewall, no `0.0.0.0/0` exposure |
| **Encryption** | KMS AES-256 at rest, TLS 1.3 in transit | `rds.force_ssl = 1` enforced in DB Parameter Group |
| **Connection String** | `sslmode=require` (or `verify-full` with RDS CA) | Enforces strict encrypted transmission |
| **Secrets Management**| AWS Secrets Manager with 30-day auto-rotation | Eliminates static credentials in repository/images |
| **Backups** | Automated daily snapshots with 7-day retention | Point-in-time recovery (PITR) enabled |
| **Connection Pool** | AWS RDS Proxy / PgBouncer | Prevents connection exhaustion under fresher surges |

---

## 2. Pre-Migration Checklist

- [ ] **Infrastructure Provisioned**: Run `terraform apply` in `infra/terraform/` to provision VPC, Subnets, RDS, Secrets Manager, and Security Groups.
- [ ] **Network Connectivity**: Verify compute host can reach RDS endpoint on port 5432 (via VPC Peering, ECS VPC attachment, or bastion host).
- [ ] **Dependencies**: Ensure `postgresql-client` (`pg_dump`, `psql`, `pg_restore`) is available on the migration runner machine.
- [ ] **Safety Snapshot**: Take a manual pre-migration snapshot of the source database as a rollback point.

```bash
# Verify connection to destination AWS RDS instance
pg_isready -h fa27.ct2ua4mes3jl.eu-north-1.rds.amazonaws.com -p 5432 -d ui_freshers
```

---

## 3. Data Export (`pg_dump`)

Export the complete existing data (including all 18 faculties, 95+ departments, courses, guides, opportunities, FAQs) from the existing database.

```bash
# Set source DB URL
SOURCE_DB_URL="<OLD_SOURCE_DATABASE_URL>"

# Step 3.1: Export full schema and data with clean inserts
pg_dump "$SOURCE_DB_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --verbose \
  --file="ui_freshers_backup_$(date +%Y%m%d_%H%M%S).dump"

# Step 3.2: (Alternative Plain SQL format for inspection)
pg_dump "$SOURCE_DB_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --file="ui_freshers_migration_data.sql"
```

---

## 4. Data Restore to AWS RDS PostgreSQL

Restore the exported dataset into the new AWS RDS PostgreSQL instance.

```bash
# Destination AWS RDS Connection details
TARGET_HOST="fa27.ct2ua4mes3jl.eu-north-1.rds.amazonaws.com"
TARGET_PORT="5432"
TARGET_USER="postgres"
TARGET_DB="ui_freshers"

# Step 4.1: Restore database dump into RDS
psql "postgresql://${TARGET_USER}@${TARGET_HOST}:${TARGET_PORT}/${TARGET_DB}?sslmode=require" \
  -f ui_freshers_migration_data.sql
```

---

## 5. Apply Schema Migrations & Row Level Security (RLS)

Run the Prisma migration and execute the RLS policy script against the AWS RDS database:

```bash
# Step 5.1: Run Prisma migrations to ensure new User and Interaction columns are present
DATABASE_URL="postgresql://${TARGET_USER}:<PASSWORD>@${TARGET_HOST}:${TARGET_PORT}/${TARGET_DB}?sslmode=require" \
npx prisma db push

# Step 5.2: Apply PostgreSQL Row Level Security (RLS) script
psql "postgresql://${TARGET_USER}:<PASSWORD>@${TARGET_HOST}:${TARGET_PORT}/${TARGET_DB}?sslmode=require" \
  -f prisma/migrations/20260823_init_auth_rls.sql
```

---

## 6. Post-Migration Verification & Row Count Audits

Verify that all existing records were preserved and new schema constraints are active:

```bash
psql "postgresql://${TARGET_USER}:<PASSWORD>@${TARGET_HOST}:${TARGET_PORT}/${TARGET_DB}?sslmode=require" -c "
SELECT 'Faculty' AS table_name, count(*) FROM \"Faculty\"
UNION ALL
SELECT 'Department', count(*) FROM \"Department\"
UNION ALL
SELECT 'Course', count(*) FROM \"Course\"
UNION ALL
SELECT 'Guide', count(*) FROM \"Guide\"
UNION ALL
SELECT 'Resource', count(*) FROM \"Resource\"
UNION ALL
SELECT 'Opportunity', count(*) FROM \"Opportunity\"
UNION ALL
SELECT 'FAQ', count(*) FROM \"FAQ\"
UNION ALL
SELECT 'User', count(*) FROM \"User\"
UNION ALL
SELECT 'Interaction', count(*) FROM \"Interaction\";
"
```

### Spot Check Queries
```sql
-- 1. Check Computing faculty and departments
SELECT f.name AS faculty, d.name AS department 
FROM "Faculty" f 
JOIN "Department" d ON d."facultyId" = f.id 
WHERE f.name = 'Computing';

-- 2. Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN ('User', 'Interaction');
```

---

## 7. App Configuration Cutover

1. Update AWS Secrets Manager secret `ui-freshers/production/rds-postgres-credentials` with the new RDS endpoint.
2. In production hosting (Render / AWS ECS / App Runner), update environment variable `DATABASE_URL` to point to the AWS RDS instance with `?sslmode=require`.
3. Verify that the health check and auth endpoints succeed:

```bash
# Health check
curl -f https://<YOUR_APP_DOMAIN>/api/health

# Verify faculties endpoint reads directly from RDS
curl -f https://<YOUR_APP_DOMAIN>/api/faculties
```

---

## 8. Rollback Strategy

In the unlikely event of data inconsistencies or performance degradation:
1. **Immediate Fallback**: Point the application's `DATABASE_URL` environment variable back to the pre-migration database snapshot.
2. **Data Consistency**: Because the pre-migration database was not altered during export, zero data corruption will occur on the fallback target.
