## Diagram NAVPRO (Mermaid)

Dokumen ini berisi diagram arsitektur dan relasi data NAVPRO menggunakan Mermaid.

---

### 1) ERD (Entity Relationship Diagram)

```mermaid
erDiagram
  USERS {
    uuid id PK
    varchar email UK
    varchar password_hash
    varchar full_name
    varchar role
    boolean is_active
    timestamptz last_login_at
    timestamptz created_at
  }

  PROJECTS {
    uuid id PK
    uuid created_by FK
    varchar project_code UK
    varchar project_name
    varchar status
    int project_duration_months
    varchar duration_category
    date contract_start_date
    numeric wacc_override
    numeric inflation_rate_override
    jsonb bcr_threshold_override
    jsonb detail
    timestamptz created_at
    timestamptz updated_at
  }

  CALCULATION_VERSIONS {
    uuid id PK
    uuid project_id FK
    int version_number
    int duration_months
    jsonb input_snapshot
    jsonb result_snapshot
    uuid created_by FK
    varchar created_by_name
    timestamptz created_at
  }

  AUDIT_LOGS {
    uuid id PK
    uuid user_id FK
    varchar user_name
    uuid project_id FK
    varchar action
    text old_val
    text new_val
    timestamptz created_at
  }

  NOTIFICATIONS {
    uuid id PK
    uuid user_id FK
    uuid project_id FK
    varchar title
    text body
    boolean is_read
    timestamptz created_at
  }

  ASSUMPTIONS_MASTER {
    int id PK
    jsonb data
    timestamptz updated_at
    uuid updated_by FK
  }

  ASSUMPTIONS_HISTORY {
    int id PK
    jsonb data
    timestamptz updated_at
    varchar updated_by_name
  }

  DURATION_PRESETS {
    varchar id PK
    varchar preset_name
    int duration_months
    varchar category
    numeric bcr_mandatory
    numeric bcr_minimum
    boolean is_active
  }

  SLA_CONFIG {
    varchar role_key PK
    varchar role_name
    int sla_working_days
    int reminder_hours
    int escalation_hours
    varchar escalate_to_role
  }

  SLA_EVENTS {
    int id PK
    uuid project_id FK
    varchar role_key
    varchar event_type
    timestamptz due_at
    timestamptz created_at
  }

  CATEGORIES {
    int id PK
    varchar type
    varchar code
  }

  SYSTEM_CONFIG {
    varchar config_key PK
    text config_val
    varchar category
    varchar data_type
    text description
  }

  USERS ||--o{ PROJECTS : "created_by"
  PROJECTS ||--o{ CALCULATION_VERSIONS : "project_id"
  USERS ||--o{ CALCULATION_VERSIONS : "created_by"
  USERS ||--o{ AUDIT_LOGS : "user_id"
  PROJECTS ||--o{ AUDIT_LOGS : "project_id"
  USERS ||--o{ NOTIFICATIONS : "user_id"
  PROJECTS ||--o{ NOTIFICATIONS : "project_id"
  USERS ||--o{ ASSUMPTIONS_MASTER : "updated_by"
  PROJECTS ||--o{ SLA_EVENTS : "project_id"
```

Catatan:
- `PROJECTS.detail` menyimpan struktur domain (CAPEX/OPEX/Revenue, approval_chain, kpi, cashflow_monthly, dll) sebagai JSONB.
- `SLA_EVENTS` digunakan untuk menandai event reminder/escalation agar tidak dobel.

---

### 2) DFD Level 0 (Context Diagram)

```mermaid
flowchart LR
  U[User / Role-based Actor] -->|Login / CRUD Proyek / Submit| WEB[Next.js Frontend]
  WEB -->|REST JSON| API[Express API]
  API -->|SQL| DB[(PostgreSQL)]
  API -->|Enqueue calc job| Q[(Redis/BullMQ)]
  W[Worker] -->|Dequeue + Process KPI| Q
  W -->|SQL update result| DB
  API -->|Send email (optional)| SMTP[(SMTP Server)]
  API -->|Presign URL + Upload (optional)| OBJ[(MinIO/S3)]
  WEB -->|Download export| API
```

---

### 3) DFD Level 1 (Proses utama)

```mermaid
flowchart TB
  subgraph FE[Frontend]
    L[Login Page] --> A[Auth Store]
    WZ[Project Wizard] --> P[Project Detail]
    D[Dashboard] --> P
    ADM[Admin CMS] --> API
  end

  subgraph BE[Backend]
    API[API Router]
    CALC[Calculation Engine]
    SLA[SLA Scheduler]
    NTF[Notification Service]
    EXP[Export Service]
    Q[BullMQ Queue]
    WK[Worker]
  end

  DB[(PostgreSQL)]

  A -->|token| API
  WZ -->|create/update| API --> DB
  WZ -->|calculate-async| API --> Q
  WK -->|process job| Q --> WK
  WK -->|run calc| CALC
  WK -->|write versions + update project| DB
  SLA -->|tick| DB
  SLA -->|create notif + audit| NTF --> DB
  API -->|export pdf/xlsx| EXP --> API
  API -->|audit logs| DB
  API -->|notifications| DB
```

---

### 4) Sequence (Auth + Change Password)

```mermaid
sequenceDiagram
  participant User
  participant FE as Frontend
  participant API as Express API
  participant DB as Postgres

  User->>FE: Input email+password
  FE->>API: POST /api/v1/auth/login
  API->>DB: SELECT user by email
  API-->>FE: token + user
  FE->>FE: store token + hydrate /me

  User->>FE: Open User Menu -> Update Password
  FE->>API: PATCH /api/v1/auth/password (current,new)
  API->>DB: verify current password hash
  API->>DB: update password_hash
  API-->>FE: {ok:true}
```

