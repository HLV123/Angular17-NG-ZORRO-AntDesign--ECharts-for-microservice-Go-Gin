# Maintenix Backend — Microservice Structure

> **Smart Predictive Maintenance Warning System**

---

## 1. Tổng quan kiến trúc

```
                         ┌────────────────────────────────────────┐
                         │            API Gateway (Nginx)         │
                         │   :80/443 → routing to microservices   │
                         └────┬────────┬────────┬────────┬────────┘
                              │        │        │        │
           ┌──────────────────┼────────┼────────┼────────┼──────────────────┐
           │                  │        │        │        │                  │
           ▼                  ▼        ▼        ▼        ▼                  ▼
   ┌──────────────┐  ┌─────────────┐ ┌──────┐ ┌──────┐ ┌──────────┐ ┌───────────┐
   │ auth-service │  │ equipment-  │ │sensor│ │alert │ │work-order│ │ ml-service│
   │    :8081     │  │  service    │ │  svc │ │ svc  │ │   svc    │ │   :8086   │
   │              │  │   :8082     │ │:8083 │ │:8084 │ │  :8085   │ │           │
   └──────────────┘  └─────────────┘ └──────┘ └──────┘ └──────────┘ └───────────┘
           │                  │        │        │        │                  │
   ┌───────┴──────────────────┴────────┴────────┴────────┴──────────────────┴───┐
   │                          Shared Infrastructure                             │
   │  PostgreSQL · TimescaleDB · InfluxDB · Redis · Kafka · MinIO · Vault       │
   └────────────────────────────────────────────────────────────────────────────┘
```

**9 Microservices:**

| #  | Service              | Port  | Protocol         | Responsibility                          |
|----|----------------------|-------|------------------|-----------------------------------------|
| 1  | api-gateway          | 8080  | HTTP             | Routing, rate limit, CORS, aggregation  |
| 2  | auth-service         | 8081  | HTTP + gRPC      | JWT, RBAC, sessions, audit logs         |
| 3  | equipment-service    | 8082  | HTTP + gRPC      | Equipment CRUD, health score, spare parts |
| 4  | sensor-service       | 8083  | gRPC + Kafka     | Sensor ingestion, time-series query     |
| 5  | alert-service        | 8084  | HTTP + WS + Kafka| Alert CRUD, SLA, WebSocket broadcast    |
| 6  | workorder-service    | 8085  | HTTP             | Work orders, checklists, cost tracking  |
| 7  | ml-service           | 8086  | HTTP + gRPC      | Model registry, pipelines, predictions  |
| 8  | notification-service | 8087  | Kafka consumer   | Email, SMS, push, Slack/Teams           |
| 9  | opcua-bridge         | 4840  | OPC-UA + Kafka   | PLC/SCADA → Kafka ingestion             |

---

## 2. Cấu trúc thư mục tổng (mono-repo)

```
maintenix-backend/
│
├── go.work                             ← Go workspace (multi-module)
├── go.work.sum
├── Makefile                            ← Build, test, lint, migrate, proto-gen
├── README.md
├── LICENSE
├── .gitignore
├── .env.example                        ← Biến môi trường mẫu
├── .golangci.yml                       ← Linter config (golangci-lint)
│
├── api/                                ← Protobuf definitions
│   └── proto/
│       ├── buf.yaml                    ← Buf schema registry config
│       ├── buf.gen.yaml                ← Code generation config
│       ├── auth/
│       │   └── v1/
│       │       └── auth.proto
│       ├── equipment/
│       │   └── v1/
│       │       └── equipment.proto
│       ├── sensor/
│       │   └── v1/
│       │       └── sensor.proto
│       ├── alert/
│       │   └── v1/
│       │       └── alert.proto
│       ├── workorder/
│       │   └── v1/
│       │       └── workorder.proto
│       ├── ml/
│       │   └── v1/
│       │       └── ml.proto
│       └── common/
│           └── v1/
│               └── common.proto        ← Pagination, Timestamp, Error shared types
│
├── pkg/                                ← Shared libraries (dùng chung tất cả services)
│   ├── config/
│   │   └── config.go                  ← Viper config loader (env + yaml)
│   ├── logger/
│   │   └── logger.go                  ← Zap structured logging
│   ├── database/
│   │   ├── postgres.go                ← GORM + pgx connection pool
│   │   ├── timescaledb.go             ← TimescaleDB hypertable helper
│   │   ├── influxdb.go                ← InfluxDB v2 client
│   │   └── redis.go                   ← go-redis v9 client
│   ├── kafka/
│   │   ├── producer.go                ← Sarama/confluent async producer
│   │   └── consumer.go               ← Consumer group handler
│   ├── auth/
│   │   ├── jwt.go                     ← JWT generate/validate (RS256)
│   │   ├── claims.go                  ← Custom claims struct
│   │   └── rbac.go                    ← Casbin RBAC enforcer
│   ├── middleware/
│   │   ├── auth.go                    ← Gin JWT middleware
│   │   ├── cors.go                    ← CORS config
│   │   ├── ratelimit.go              ← Token bucket (Redis-backed)
│   │   ├── requestid.go              ← X-Request-ID injection
│   │   ├── recovery.go               ← Panic recovery + logging
│   │   └── tracing.go                ← OpenTelemetry middleware
│   ├── vault/
│   │   └── client.go                  ← HashiCorp Vault client (secrets, JWT keys)
│   ├── minio/
│   │   └── client.go                  ← MinIO S3-compatible client
│   ├── errors/
│   │   └── errors.go                  ← Custom error types + codes
│   ├── response/
│   │   └── response.go               ← Gin JSON response helpers
│   ├── pagination/
│   │   └── pagination.go             ← Cursor/Offset pagination
│   ├── validator/
│   │   └── validator.go              ← Custom validation rules
│   ├── tracing/
│   │   └── jaeger.go                  ← Jaeger/OTLP exporter init
│   └── metrics/
│       └── prometheus.go              ← Prometheus metrics registry
│
├── services/                           ← 9 microservices
│   ├── api-gateway/
│   ├── auth-service/
│   ├── equipment-service/
│   ├── sensor-service/
│   ├── alert-service/
│   ├── workorder-service/
│   ├── ml-service/
│   ├── notification-service/
│   └── opcua-bridge/
│
├── deployments/                        ← Deployment configs
│   ├── docker/
│   │   ├── docker-compose.yml         ← Full stack (all services + infra)
│   │   ├── docker-compose.infra.yml   ← Chỉ infrastructure
│   │   ├── docker-compose.dev.yml     ← Dev overrides (hot reload)
│   │   └── .env.docker
│   ├── kubernetes/
│   │   ├── namespace.yaml
│   │   ├── base/
│   │   │   ├── kustomization.yaml
│   │   │   ├── api-gateway/
│   │   │   │   ├── deployment.yaml
│   │   │   │   ├── service.yaml
│   │   │   │   └── configmap.yaml
│   │   │   ├── auth-service/
│   │   │   │   ├── deployment.yaml
│   │   │   │   ├── service.yaml
│   │   │   │   └── configmap.yaml
│   │   │   ├── equipment-service/
│   │   │   │   ├── deployment.yaml
│   │   │   │   ├── service.yaml
│   │   │   │   └── configmap.yaml
│   │   │   ├── sensor-service/
│   │   │   │   ├── deployment.yaml
│   │   │   │   ├── service.yaml
│   │   │   │   └── configmap.yaml
│   │   │   ├── alert-service/
│   │   │   │   ├── deployment.yaml
│   │   │   │   ├── service.yaml
│   │   │   │   └── configmap.yaml
│   │   │   ├── workorder-service/
│   │   │   │   ├── deployment.yaml
│   │   │   │   ├── service.yaml
│   │   │   │   └── configmap.yaml
│   │   │   ├── ml-service/
│   │   │   │   ├── deployment.yaml
│   │   │   │   ├── service.yaml
│   │   │   │   └── configmap.yaml
│   │   │   ├── notification-service/
│   │   │   │   ├── deployment.yaml
│   │   │   │   ├── service.yaml
│   │   │   │   └── configmap.yaml
│   │   │   ├── opcua-bridge/
│   │   │   │   ├── deployment.yaml
│   │   │   │   ├── service.yaml
│   │   │   │   └── configmap.yaml
│   │   │   └── infrastructure/
│   │   │       ├── postgres.yaml
│   │   │       ├── timescaledb.yaml
│   │   │       ├── redis.yaml
│   │   │       ├── kafka.yaml
│   │   │       ├── minio.yaml
│   │   │       └── vault.yaml
│   │   ├── overlays/
│   │   │   ├── dev/
│   │   │   │   └── kustomization.yaml
│   │   │   ├── staging/
│   │   │   │   └── kustomization.yaml
│   │   │   └── production/
│   │   │       └── kustomization.yaml
│   │   └── ingress/
│   │       ├── nginx-ingress.yaml
│   │       └── tls-secret.yaml
│   └── argocd/
│       ├── application.yaml
│       ├── project.yaml
│       └── appset.yaml
│
├── configs/                            ← External tool configs
│   ├── nginx/
│   │   ├── nginx.conf
│   │   └── upstream.conf
│   ├── kafka/
│   │   └── topics.yaml
│   ├── prometheus/
│   │   ├── prometheus.yml
│   │   └── rules/
│   │       ├── alert_rules.yml
│   │       └── recording_rules.yml
│   ├── grafana/
│   │   └── dashboards/
│   │       ├── overview.json
│   │       ├── sensors.json
│   │       └── services.json
│   └── jaeger/
│       └── jaeger.yml
│
├── scripts/                            ← Automation scripts
│   ├── migrate.sh                     ← Run all DB migrations
│   ├── seed.sh                        ← Seed demo data
│   ├── gen-proto.sh                   ← Generate Go code from .proto
│   ├── gen-swagger.sh                 ← Generate Swagger docs
│   ├── test-all.sh                    ← Run all service tests
│   └── setup-dev.sh                   ← One-click dev setup
│
└── docs/                               ← Documentation
    ├── api/
    │   └── swagger.yaml               ← OpenAPI 3.0 spec
    ├── architecture.md
    ├── deployment.md
    └── runbook.md
```

**Tổng cộng: ~200+ files** (source code, configs, migrations, Dockerfiles)

---

## 3. Chi tiết cấu trúc từng service

### 3.1. Pattern chung — Clean Architecture (mỗi service)

```
services/<service-name>/
├── go.mod                          ← Go module riêng biệt
├── go.sum
├── cmd/
│   └── main.go                    ← Entrypoint: init config → DI → start servers
├── internal/                       ← Private (không export ra ngoài module)
│   ├── config/
│   │   └── config.go              ← Service-specific config struct
│   ├── domain/
│   │   └── *.go                   ← Entities + Value Objects + Repository Interfaces
│   ├── repository/
│   │   └── *_repo.go              ← Database access (implement domain interfaces)
│   ├── service/
│   │   └── *_service.go           ← Business logic layer
│   ├── handler/
│   │   └── *_handler.go           ← Gin HTTP handlers (request → service → response)
│   ├── grpc/
│   │   └── server.go              ← gRPC server (inter-service + gRPC-Web)
│   ├── kafka/
│   │   ├── consumer.go            ← Kafka consumer group
│   │   └── producer.go            ← Kafka event publisher
│   ├── websocket/                  ← (chỉ alert-service, api-gateway)
│   │   ├── hub.go                 ← Connection manager
│   │   └── client.go             ← Per-connection handler
│   └── router/
│       └── router.go              ← Gin route registration
├── migrations/
│   ├── 000001_create_*.up.sql
│   ├── 000001_create_*.down.sql
│   └── ...
└── Dockerfile                      ← Multi-stage build
```

**Dependency flow (Clean Architecture):**

```
handler (HTTP/gRPC) → service (business logic) → repository (DB access) → database
        ↓                    ↓                          ↓
      request              kafka                    PostgreSQL
      validation          producer                  TimescaleDB
      response                                      InfluxDB
      formatting                                    Redis
```

**Quan trọng:** `domain/` chỉ chứa interfaces + entities, KHÔNG import bất kỳ package bên ngoài. `repository/` implement các interfaces trong `domain/`. Điều này cho phép test service layer với mock repository.

---

### 3.2. API Gateway (`services/api-gateway/`)

```
services/api-gateway/
├── go.mod
├── go.sum
├── cmd/
│   └── main.go
├── internal/
│   ├── config/
│   │   └── config.go              ← Gateway config (upstream URLs, timeouts)
│   ├── router/
│   │   └── router.go              ← Master route table
│   ├── proxy/
│   │   ├── auth.go                ← Reverse proxy → auth-service:8081
│   │   ├── equipment.go           ← Reverse proxy → equipment-service:8082
│   │   ├── sensor.go              ← Reverse proxy → sensor-service:8083
│   │   ├── alert.go               ← Reverse proxy → alert-service:8084
│   │   ├── workorder.go           ← Reverse proxy → workorder-service:8085
│   │   ├── ml.go                  ← Reverse proxy → ml-service:8086
│   │   └── report.go              ← Aggregator (gọi nhiều services)
│   ├── middleware/
│   │   ├── ratelimit.go           ← Redis-backed rate limiter
│   │   └── aggregator.go          ← Response combiner cho /dashboard/kpi
│   └── websocket/
│       └── hub.go                 ← WebSocket hub (proxy sang alert-service)
└── Dockerfile
```

**Vai trò chính:**
- Reverse proxy tới downstream services
- JWT validation (gọi auth-service gRPC `ValidateToken`)
- Rate limiting (Redis token bucket)
- KPI aggregation: `/api/dashboard/kpi` gọi song song equipment + sensor + alert + workorder → merge response
- WebSocket hub: proxy `/ws` connections sang alert-service

---

### 3.3. Auth Service (`services/auth-service/`)

```
services/auth-service/
├── go.mod
├── go.sum
├── cmd/
│   └── main.go
├── internal/
│   ├── config/
│   │   └── config.go
│   ├── domain/
│   │   ├── user.go                ← User entity + UserRepository interface
│   │   ├── role.go                ← Role, Permission entities
│   │   ├── session.go             ← Session entity
│   │   └── audit.go               ← AuditLog entity
│   ├── repository/
│   │   ├── user_repo.go           ← PostgreSQL (GORM)
│   │   ├── session_repo.go        ← Redis (session store)
│   │   └── audit_repo.go          ← PostgreSQL (audit logs)
│   ├── service/
│   │   ├── auth_service.go        ← Login, logout, refresh, token validate
│   │   ├── user_service.go        ← CRUD users, profile
│   │   ├── rbac_service.go        ← Casbin policy management
│   │   └── audit_service.go       ← Log all user actions
│   ├── handler/
│   │   ├── auth_handler.go        ← POST /login, /logout, /refresh, GET /me
│   │   ├── user_handler.go        ← CRUD /users
│   │   └── audit_handler.go       ← GET /audit
│   ├── grpc/
│   │   └── server.go              ← ValidateToken, GetUserPermissions (inter-service)
│   └── router/
│       └── router.go
├── migrations/
│   ├── 000001_create_users.up.sql
│   ├── 000001_create_users.down.sql
│   ├── 000002_create_roles_permissions.up.sql
│   ├── 000002_create_roles_permissions.down.sql
│   ├── 000003_create_sessions.up.sql
│   ├── 000003_create_sessions.down.sql
│   ├── 000004_create_audit_logs.up.sql
│   ├── 000004_create_audit_logs.down.sql
│   └── 000005_seed_users_roles.up.sql    ← 8 demo accounts + 8 roles
└── Dockerfile
```

**8 Demo accounts (match frontend):**

| Username       | Role                  | Password (bcrypt) |
|----------------|-----------------------|-------------------|
| admin          | super_admin           | 123456            |
| manager        | factory_manager       | 123456            |
| engineer       | maintenance_engineer  | 123456            |
| technician     | technician            | 123456            |
| datascientist  | data_scientist        | 123456            |
| maint_mgr      | maintenance_manager   | 123456            |
| inspector      | quality_inspector     | 123456            |
| viewer         | viewer                | 123456            |

---

### 3.4. Equipment Service (`services/equipment-service/`)

```
services/equipment-service/
├── go.mod
├── go.sum
├── cmd/
│   └── main.go
├── internal/
│   ├── config/
│   │   └── config.go
│   ├── domain/
│   │   ├── equipment.go           ← Equipment, EquipmentLocation, EquipmentSpecs
│   │   ├── location.go            ← Factory zones, buildings
│   │   ├── specs.go               ← Technical specifications
│   │   ├── spare_part.go          ← SparePart, SparePartUsage
│   │   └── maintenance_schedule.go← MaintenanceSchedule, PMTemplate
│   ├── repository/
│   │   ├── equipment_repo.go      ← PostgreSQL CRUD + health query
│   │   ├── spare_part_repo.go     ← PostgreSQL + Redis cache (stock levels)
│   │   └── schedule_repo.go       ← PostgreSQL (maintenance schedules)
│   ├── service/
│   │   ├── equipment_service.go   ← CRUD + status management
│   │   ├── spare_part_service.go  ← Inventory + auto reorder logic
│   │   ├── schedule_service.go    ← Calendar + Gantt data generation
│   │   └── health_calculator.go   ← Health score algorithm (sensor data weighted)
│   ├── handler/
│   │   ├── equipment_handler.go   ← CRUD /equipment, GET /:id/history
│   │   ├── spare_part_handler.go  ← CRUD /spare-parts, POST /:id/reorder
│   │   └── schedule_handler.go    ← CRUD /maintenance, PUT /:id/approve
│   ├── grpc/
│   │   └── server.go              ← GetHealthScore, StreamHealthUpdates
│   ├── kafka/
│   │   └── consumer.go            ← Listen sensor events → recalculate health
│   └── router/
│       └── router.go
├── migrations/
│   ├── 000001_create_equipment.up.sql
│   ├── 000001_create_equipment.down.sql
│   ├── 000002_create_spare_parts.up.sql
│   ├── 000002_create_spare_parts.down.sql
│   ├── 000003_create_maintenance_schedules.up.sql
│   ├── 000003_create_maintenance_schedules.down.sql
│   └── 000004_seed_equipment.up.sql      ← 10 thiết bị + 15 linh kiện
└── Dockerfile
```

---

### 3.5. Sensor Service (`services/sensor-service/`)

```
services/sensor-service/
├── go.mod
├── go.sum
├── cmd/
│   └── main.go
├── internal/
│   ├── config/
│   │   └── config.go
│   ├── domain/
│   │   ├── sensor.go              ← Sensor entity + thresholds
│   │   ├── reading.go             ← SensorReading (time-series point)
│   │   └── threshold.go           ← Warning/Critical threshold config
│   ├── repository/
│   │   ├── sensor_repo.go         ← PostgreSQL (sensor metadata)
│   │   ├── timeseries_repo.go     ← TimescaleDB (historical data, hypertable)
│   │   └── influx_repo.go         ← InfluxDB (real-time hot data, 7d retention)
│   ├── service/
│   │   ├── sensor_service.go      ← CRUD sensors + data query
│   │   ├── ingestion_service.go   ← Process raw readings from Kafka
│   │   └── anomaly_detector.go    ← Real-time anomaly detection (Z-score, IQR)
│   ├── handler/
│   │   └── sensor_handler.go      ← GET /sensors, /:id/data, /by-equipment/:id
│   ├── grpc/
│   │   └── server.go              ← StreamSensorData (server-streaming gRPC)
│   ├── kafka/
│   │   ├── consumer.go            ← Consume: maintenix.sensor.raw
│   │   └── producer.go            ← Produce: maintenix.sensor.processed
│   └── router/
│       └── router.go
├── migrations/
│   ├── 000001_create_sensors.up.sql
│   ├── 000001_create_sensors.down.sql
│   ├── 000002_create_hypertable_readings.up.sql    ← TimescaleDB hypertable
│   ├── 000002_create_hypertable_readings.down.sql
│   └── 000003_seed_sensors.up.sql                  ← 12 sensors
└── Dockerfile
```

**Data flow:**

```
OPC-UA Bridge → Kafka (maintenix.sensor.raw)
                    ↓
              sensor-service (consumer)
                    ↓
         ┌─────────┼─────────┐
         ↓         ↓         ↓
    InfluxDB   TimescaleDB  Kafka (maintenix.sensor.processed)
    (hot 7d)   (history)        ↓
                           alert-service (threshold check)
                           ml-service (anomaly + RUL prediction)
```

---

### 3.6. Alert Service (`services/alert-service/`)

```
services/alert-service/
├── go.mod
├── go.sum
├── cmd/
│   └── main.go
├── internal/
│   ├── config/
│   │   └── config.go
│   ├── domain/
│   │   ├── alert.go               ← Alert entity + severity/status enums
│   │   ├── sla.go                 ← SLA config (response time per severity)
│   │   └── escalation.go          ← Escalation rules + chains
│   ├── repository/
│   │   └── alert_repo.go          ← PostgreSQL + Redis (active alerts cache)
│   ├── service/
│   │   ├── alert_service.go       ← CRUD + acknowledge/assign/resolve/escalate
│   │   ├── sla_service.go         ← SLA countdown + breach detection
│   │   └── escalation_service.go  ← Auto-escalation when SLA breached
│   ├── handler/
│   │   └── alert_handler.go       ← CRUD /alerts, PUT /:id/acknowledge, /resolve
│   ├── websocket/
│   │   ├── hub.go                 ← WebSocket connection manager
│   │   └── client.go             ← Per-connection goroutine (read/write pumps)
│   ├── kafka/
│   │   ├── consumer.go            ← Consume: maintenix.sensor.processed → generate alerts
│   │   └── producer.go            ← Produce: maintenix.alert.created, .updated
│   └── router/
│       └── router.go
├── migrations/
│   ├── 000001_create_alerts.up.sql
│   ├── 000001_create_alerts.down.sql
│   ├── 000002_create_sla_config.up.sql
│   ├── 000002_create_sla_config.down.sql
│   └── 000003_seed_alerts.up.sql         ← 8 cảnh báo mẫu
└── Dockerfile
```

**WebSocket STOMP topics (match frontend `subscribeAlerts()`):**

```
/topic/factory-alerts        ← Broadcast tất cả alerts mới
/topic/sensor-updates        ← Sensor data real-time
/topic/equipment-status      ← Equipment status changes
/user/queue/notifications    ← Per-user notifications (filtered by role)
```

---

### 3.7. WorkOrder Service (`services/workorder-service/`)

```
services/workorder-service/
├── go.mod
├── go.sum
├── cmd/
│   └── main.go
├── internal/
│   ├── config/
│   │   └── config.go
│   ├── domain/
│   │   ├── workorder.go           ← WorkOrder entity + status FSM
│   │   ├── checklist.go           ← Checklist, ChecklistItem
│   │   ├── worklog.go             ← WorkLog (time tracking)
│   │   └── cost.go                ← CostRecord (labor, parts, external)
│   ├── repository/
│   │   ├── workorder_repo.go      ← PostgreSQL CRUD + Kanban queries
│   │   └── worklog_repo.go        ← PostgreSQL work log entries
│   ├── service/
│   │   ├── workorder_service.go   ← CRUD + status transitions (FSM)
│   │   ├── checklist_service.go   ← Checklist management
│   │   └── report_service.go      ← Maintenance cost reports, PM compliance
│   ├── handler/
│   │   ├── workorder_handler.go   ← CRUD /work-orders, PUT /:id/status, /checklist
│   │   └── report_handler.go      ← GET /reports/maintenance-cost, /pm-compliance
│   ├── kafka/
│   │   ├── consumer.go            ← Consume: maintenix.alert.created → auto-create WO
│   │   └── producer.go            ← Produce: maintenix.workorder.created, .updated
│   └── router/
│       └── router.go
├── migrations/
│   ├── 000001_create_work_orders.up.sql
│   ├── 000001_create_work_orders.down.sql
│   ├── 000002_create_checklists.up.sql
│   ├── 000002_create_checklists.down.sql
│   ├── 000003_create_work_logs.up.sql
│   ├── 000003_create_work_logs.down.sql
│   └── 000004_seed_work_orders.up.sql
└── Dockerfile
```

**Work Order Status FSM:**

```
                 ┌──────────┐
       ┌────────→│  OPEN    │←── auto-create from alert
       │         └────┬─────┘
       │              │ assign
       │         ┌────▼─────┐
       │         │ ASSIGNED │
       │         └────┬─────┘
       │              │ start
       │         ┌────▼──────┐
  reopen         │IN_PROGRESS│
       │         └────┬──────┘
       │              │ complete
       │         ┌────▼─────┐
       │         │ COMPLETED│
       │         └────┬─────┘
       │              │ verify
       └─────────┌────▼─────┐
                 │  CLOSED  │
                 └──────────┘
```

---

### 3.8. ML Service (`services/ml-service/`)

```
services/ml-service/
├── go.mod
├── go.sum
├── cmd/
│   └── main.go
├── internal/
│   ├── config/
│   │   └── config.go
│   ├── domain/
│   │   ├── model.go               ← AIModel, ModelVersion, ModelStatus
│   │   ├── pipeline.go            ← Pipeline, PipelineRun
│   │   ├── prediction.go          ← Prediction, RUL result
│   │   └── experiment.go          ← Experiment, ABTest
│   ├── repository/
│   │   ├── model_repo.go          ← PostgreSQL (model registry)
│   │   └── pipeline_repo.go       ← PostgreSQL (pipeline runs)
│   ├── service/
│   │   ├── model_service.go       ← Register, deploy, deprecate models
│   │   ├── pipeline_service.go    ← Trigger/cancel pipeline runs
│   │   ├── prediction_service.go  ← Run predictions (RUL, anomaly, failure mode)
│   │   └── drift_monitor.go       ← Data drift + model performance monitoring
│   ├── handler/
│   │   ├── model_handler.go       ← CRUD /models, PUT /:id/deploy, /:id/deprecate
│   │   └── pipeline_handler.go    ← GET /pipelines, POST /trigger
│   ├── grpc/
│   │   └── server.go              ← Predict, GetRUL, StreamPredictions
│   ├── kafka/
│   │   └── consumer.go            ← Consume: maintenix.sensor.processed → real-time predict
│   └── router/
│       └── router.go
├── migrations/
│   ├── 000001_create_models.up.sql
│   ├── 000001_create_models.down.sql
│   ├── 000002_create_pipelines.up.sql
│   ├── 000002_create_pipelines.down.sql
│   ├── 000003_create_predictions.up.sql
│   ├── 000003_create_predictions.down.sql
│   └── 000004_seed_models.up.sql         ← 5 AI models (RUL, Anomaly, Failure, Energy, Quality)
└── Dockerfile
```

---

### 3.9. Notification Service (`services/notification-service/`)

```
services/notification-service/
├── go.mod
├── go.sum
├── cmd/
│   └── main.go
├── internal/
│   ├── config/
│   │   └── config.go
│   ├── domain/
│   │   └── notification.go        ← Notification, Channel, Template
│   ├── channel/
│   │   ├── email.go               ← SMTP / SES sender
│   │   ├── sms.go                 ← Twilio / AWS SNS
│   │   ├── push.go                ← FCM / APNs
│   │   ├── slack.go               ← Slack Webhook
│   │   └── teams.go               ← MS Teams Webhook
│   ├── service/
│   │   ├── dispatcher.go          ← Route notification → correct channel(s)
│   │   └── template_service.go    ← Render notification templates
│   ├── kafka/
│   │   └── consumer.go            ← Consume: maintenix.notification.send
│   └── template/
│       ├── alert_critical.html    ← HTML email templates
│       ├── alert_high.html
│       ├── workorder_assigned.html
│       ├── maintenance_reminder.html
│       └── daily_summary.html
├── migrations/
│   ├── 000001_create_notification_logs.up.sql
│   └── 000001_create_notification_logs.down.sql
└── Dockerfile
```

---

### 3.10. OPC-UA Bridge (`services/opcua-bridge/`)

```
services/opcua-bridge/
├── go.mod
├── go.sum
├── cmd/
│   └── main.go
├── internal/
│   ├── config/
│   │   └── config.go
│   ├── opcua/
│   │   ├── client.go              ← gopcua/opcua client
│   │   ├── subscription.go        ← Subscribe to PLC node changes
│   │   └── node_mapping.go        ← Map OPC-UA nodes → sensor IDs
│   ├── kafka/
│   │   └── producer.go            ← Produce: maintenix.sensor.raw
│   └── transformer/
│       └── reading_transformer.go ← OPC-UA DataValue → SensorReading protobuf
├── configs/
│   └── node_map.yaml              ← OPC-UA node ID ↔ Sensor ID mapping
└── Dockerfile
```

---

## 4. API Gateway — Route Mapping (Frontend ↔ Backend)

### 4.1. REST Endpoints

```
Nginx (:80/443)
  │
  └── /api/* → api-gateway (:8080)
        │
        ├── /api/auth/**                → auth-service (:8081)
        │   ├── POST   /login
        │   ├── POST   /logout
        │   ├── POST   /refresh
        │   └── GET    /me
        │
        ├── /api/users/**               → auth-service (:8081)
        │   ├── GET    /                   ← List all users
        │   ├── GET    /:id                ← Get user by ID
        │   ├── POST   /                   ← Create user
        │   ├── PUT    /:id                ← Update user
        │   ├── DELETE /:id                ← Delete user
        │   └── GET    /:id/activity       ← Login activity chart
        │
        ├── /api/audit/**               → auth-service (:8081)
        │   └── GET    /                   ← Audit logs (paginated)
        │
        ├── /api/equipment/**           → equipment-service (:8082)
        │   ├── GET    /                   ← List + filter + search
        │   ├── GET    /:id                ← Detail + health score
        │   ├── POST   /                   ← Create equipment
        │   ├── PUT    /:id                ← Update equipment
        │   ├── DELETE /:id                ← Delete equipment
        │   └── GET    /:id/history        ← Maintenance history
        │
        ├── /api/spare-parts/**         → equipment-service (:8082)
        │   ├── GET    /                   ← Inventory list
        │   ├── GET    /:id
        │   ├── POST   /                   ← Add spare part
        │   ├── PUT    /:id                ← Update stock
        │   └── POST   /:id/reorder       ← Trigger reorder
        │
        ├── /api/maintenance/**         → equipment-service (:8082)
        │   ├── GET    /                   ← Schedules (Gantt + calendar data)
        │   ├── GET    /:id
        │   ├── POST   /                   ← Create schedule
        │   ├── PUT    /:id                ← Update schedule
        │   └── PUT    /:id/approve        ← Manager approve
        │
        ├── /api/sensors/**             → sensor-service (:8083)
        │   ├── GET    /                   ← List all sensors
        │   ├── GET    /:id                ← Sensor detail
        │   ├── GET    /:id/data?hours=24  ← Time-series data
        │   ├── GET    /:id/anomalies      ← Detected anomalies
        │   └── GET    /by-equipment/:equipmentId
        │
        ├── /api/alerts/**              → alert-service (:8084)
        │   ├── GET    /                   ← List + filter (severity/status/type)
        │   ├── GET    /:id                ← Alert detail + SLA info
        │   ├── PUT    /:id/acknowledge    ← Acknowledge alert
        │   ├── PUT    /:id/assign         ← Assign to technician
        │   ├── PUT    /:id/resolve        ← Resolve alert
        │   ├── PUT    /:id/escalate       ← Manual escalation
        │   └── GET    /sla-config         ← SLA configuration
        │
        ├── /api/work-orders/**         → workorder-service (:8085)
        │   ├── GET    /                   ← List + Kanban view
        │   ├── GET    /:id                ← Detail + checklist + logs
        │   ├── POST   /                   ← Create work order
        │   ├── PUT    /:id                ← Update work order
        │   ├── PUT    /:id/status         ← Transition status (FSM)
        │   ├── PUT    /:id/checklist/:itemId  ← Toggle checklist item
        │   ├── POST   /:id/logs           ← Add work log entry
        │   └── GET    /:id/logs           ← Get work logs
        │
        ├── /api/models/**              → ml-service (:8086)
        │   ├── GET    /                   ← Model registry list
        │   ├── GET    /:id                ← Model detail + versions
        │   ├── POST   /register           ← Register new model
        │   ├── PUT    /:id/deploy         ← Deploy model version
        │   ├── PUT    /:id/deprecate      ← Deprecate model
        │   └── GET    /:id/metrics        ← Performance metrics
        │
        ├── /api/pipelines/**           → ml-service (:8086)
        │   ├── GET    /                   ← Pipeline list + runs
        │   ├── POST   /trigger            ← Trigger pipeline run
        │   └── PUT    /:id/cancel         ← Cancel running pipeline
        │
        ├── /api/dashboard/**           → api-gateway (aggregator)
        │   ├── GET    /kpi                ← Combined KPI (equipment + sensor + alert + WO)
        │   └── GET    /summary            ← Factory overview
        │
        └── /api/reports/**             → api-gateway (aggregator)
            ├── GET    /oee?range=30d      ← OEE history (from TimescaleDB)
            ├── GET    /maintenance-cost?range=6m  ← Cost breakdown
            ├── GET    /equipment-reliability       ← MTBF, MTTR, failure rate
            ├── GET    /pm-compliance               ← PM compliance percentage
            └── GET    /ai-effectiveness            ← AI prediction accuracy, ROI
```

### 4.2. WebSocket Endpoints

```
Nginx
  └── /ws → api-gateway (:8080) → alert-service (:8084)
        │
        ├── STOMP /topic/factory-alerts      ← All alerts broadcast
        ├── STOMP /topic/sensor-updates      ← Sensor real-time data
        ├── STOMP /topic/equipment-status    ← Equipment status changes
        └── STOMP /user/queue/notifications  ← Per-user (filtered by role/dept)
```

### 4.3. gRPC Services (inter-service + gRPC-Web)

```
Frontend (gRPC-Web via Envoy proxy)
  │
  └── Envoy (:8081 gRPC-Web) → gRPC native
        │
        ├── sensor.v1.SensorService
        │   ├── StreamSensorData         ← Server streaming (live sensor values)
        │   ├── GetSensorReading         ← Unary (single reading)
        │   └── BatchGetReadings         ← Unary (batch query)
        │
        ├── auth.v1.AuthService          ← Inter-service only
        │   ├── ValidateToken            ← Gateway validates JWT
        │   └── GetUserPermissions       ← Gateway checks RBAC
        │
        ├── equipment.v1.EquipmentService
        │   ├── GetHealthScore           ← Unary (current health)
        │   └── StreamHealthUpdates      ← Server streaming
        │
        └── ml.v1.MLService
            ├── Predict                  ← Unary (single prediction)
            ├── GetRUL                   ← Unary (remaining useful life)
            └── StreamPredictions        ← Server streaming (real-time)
```

---

## 5. Kafka Topics

| Topic                           | Producer           | Consumer(s)                     | Description                        |
|----------------------------------|--------------------|---------------------------------|------------------------------------|
| `maintenix.sensor.raw`          | opcua-bridge       | sensor-service                  | Raw sensor data từ PLC/SCADA       |
| `maintenix.sensor.processed`    | sensor-service     | alert-service, ml-service       | Validated + enriched sensor data   |
| `maintenix.alert.created`       | alert-service      | notification-svc, api-gateway   | New alert notification             |
| `maintenix.alert.updated`       | alert-service      | api-gateway (WebSocket push)    | Alert status changes               |
| `maintenix.workorder.created`   | workorder-service  | notification-svc                | New work order assigned            |
| `maintenix.workorder.updated`   | workorder-service  | api-gateway                     | WO status transitions              |
| `maintenix.equipment.status`    | equipment-service  | api-gateway (WebSocket push)    | Equipment health changes           |
| `maintenix.ml.prediction`       | ml-service         | alert-service, equipment-svc    | AI prediction results              |
| `maintenix.ml.pipeline.status`  | ml-service         | api-gateway                     | Pipeline run status updates        |
| `maintenix.notification.send`   | any service        | notification-service            | Send email/SMS/push/Slack          |
| `maintenix.audit.log`           | all services       | auth-service                    | Audit trail events                 |

---

## 6. Database Schema Ownership

### 6.1. PostgreSQL (port 5432)

| Owner Service      | Tables                                                                          |
|--------------------|---------------------------------------------------------------------------------|
| auth-service       | `users`, `roles`, `permissions`, `role_permissions`, `sessions`, `audit_logs`   |
| equipment-service  | `equipment`, `equipment_locations`, `equipment_specs`, `spare_parts`, `spare_part_usage`, `maintenance_schedules`, `pm_templates` |
| alert-service      | `alerts`, `alert_history`, `sla_config`, `escalation_rules`                    |
| workorder-service  | `work_orders`, `checklists`, `checklist_items`, `work_logs`, `cost_records`    |
| ml-service         | `ai_models`, `model_versions`, `pipelines`, `pipeline_runs`, `predictions`, `experiments` |
| notification-svc   | `notification_logs`, `notification_templates`                                   |

### 6.2. TimescaleDB (port 5433)

| Owner Service  | Hypertable              | Retention   | Compression |
|----------------|-------------------------|-------------|-------------|
| sensor-service | `sensor_readings`       | 365 ngày    | After 7d    |
| sensor-service | `sensor_anomalies`      | 90 ngày     | After 3d    |

### 6.3. InfluxDB (port 8086)

| Owner Service  | Bucket              | Retention  | Purpose                    |
|----------------|---------------------|------------|----------------------------|
| sensor-service | `sensor_realtime`   | 7 ngày     | Hot data, real-time queries|
| sensor-service | `sensor_aggregated` | 30 ngày    | 1m/5m/1h aggregations     |

### 6.4. Redis (port 6379)

| Owner Service     | Key Pattern                    | TTL     | Purpose                     |
|-------------------|--------------------------------|---------|-----------------------------|
| auth-service      | `session:{userId}`             | 24h     | User sessions               |
| auth-service      | `token:blacklist:{jti}`        | 7d      | Revoked JWT tokens          |
| equipment-service | `equipment:health:{id}`        | 5m      | Cached health scores        |
| equipment-service | `equipment:status:{id}`        | 5m      | Cached equipment status     |
| sensor-service    | `sensor:latest:{id}`           | 30s     | Latest sensor reading       |
| sensor-service    | `sensor:cache:{id}:{hours}`    | 2m      | Time-series query cache     |
| alert-service     | `alert:active:count`           | 30s     | Active alert count          |
| alert-service     | `alert:sla:{id}`               | dynamic | SLA countdown timer         |
| api-gateway       | `ratelimit:{ip}`               | 1m      | Rate limit counters         |
| api-gateway       | `cache:dashboard:kpi`          | 30s     | KPI aggregation cache       |

### 6.5. MinIO (port 9000)

| Owner Service     | Bucket                     | Content                              |
|-------------------|----------------------------|--------------------------------------|
| equipment-service | `equipment-docs`           | Manuals, specs PDFs                  |
| equipment-service | `equipment-images`         | Equipment photos, QR codes           |
| workorder-service | `workorder-attachments`    | Work order documents                 |
| workorder-service | `workorder-photos`         | Before/after maintenance photos      |
| ml-service        | `model-artifacts`          | Trained model files (.pkl, .onnx)    |
| ml-service        | `training-data`            | Training datasets                    |

---

## 7. Chạy Development

### 7.1. Prerequisite

```bash
# Go 1.22+
go version                          # go1.22.x

# Tools
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
go install github.com/golang-migrate/migrate/v4/cmd/migrate@latest
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
go install github.com/air-verse/air@latest       # Hot reload
```

### 7.2. Khởi động infrastructure

```bash
# Terminal 1 — Postgres, TimescaleDB, Redis, Kafka, MinIO, Vault
cd deployments/docker
docker compose -f docker-compose.infra.yml up -d

# Kiểm tra services ready
docker compose -f docker-compose.infra.yml ps
```

Infrastructure ports:

| Service     | Port  | Credentials        |
|-------------|-------|---------------------|
| PostgreSQL  | 5432  | maintenix/secret    |
| TimescaleDB | 5433  | maintenix/secret    |
| InfluxDB    | 8086  | maintenix/secret    |
| Redis       | 6379  | (no auth dev)       |
| Kafka       | 9092  | (no auth dev)       |
| Kafka UI    | 9093  | —                   |
| MinIO       | 9000  | minioadmin/minioadmin |
| MinIO UI    | 9001  | —                   |
| Vault       | 8200  | root                |

### 7.3. Chạy migrations + seed

```bash
./scripts/migrate.sh up          # Tạo tất cả tables
./scripts/seed.sh                # Seed demo data (8 users, 10 equipment, 12 sensors, 8 alerts...)
```

### 7.4. Khởi động services (development — hot reload)

```bash
# Terminal 2 — API Gateway
cd services/api-gateway && air

# Terminal 3 — Auth Service
cd services/auth-service && air

# Terminal 4 — Equipment Service
cd services/equipment-service && air

# Terminal 5 — Sensor Service
cd services/sensor-service && air

# Terminal 6 — Alert Service
cd services/alert-service && air

# Terminal 7 — WorkOrder Service
cd services/workorder-service && air

# Terminal 8 — ML Service
cd services/ml-service && air

# Terminal 9 — Notification Service
cd services/notification-service && air

# (Optional) Terminal 10 — OPC-UA Bridge (cần có PLC simulator)
cd services/opcua-bridge && air
```

Hoặc chạy tất cả bằng Docker Compose:

```bash
cd deployments/docker
docker compose -f docker-compose.yml up --build
```

### 7.5. Verify

```bash
# Health check
curl http://localhost:8080/health

# Login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123456"}'

# Get equipment (với JWT token)
curl http://localhost:8080/api/equipment \
  -H "Authorization: Bearer <token>"

# gRPC (grpcurl)
grpcurl -plaintext localhost:8083 sensor.v1.SensorService/StreamSensorData
```

---

## 8. Dockerfile mẫu (Multi-stage Build)

```dockerfile
# === Stage 1: Build ===
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /app

# Copy shared packages
COPY pkg/ ./pkg/
COPY api/ ./api/

# Copy service
COPY services/auth-service/ ./services/auth-service/
COPY go.work go.work.sum ./

WORKDIR /app/services/auth-service

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /auth-service ./cmd/main.go

# === Stage 2: Runtime ===
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata
COPY --from=builder /auth-service /usr/local/bin/auth-service
COPY services/auth-service/migrations /migrations

EXPOSE 8081 50051

ENTRYPOINT ["auth-service"]
```

**Build output:** ~15-25MB per service binary (static linked, no CGO).

---

## 9. Makefile Commands

```makefile
# Protobuf
make proto                # Generate Go code from .proto files

# Development
make dev-infra            # docker compose infra up
make dev-all              # Run all services with air (hot reload)
make migrate-up           # Run all migrations
make migrate-down         # Rollback all migrations
make seed                 # Seed demo data

# Testing
make test                 # Run all tests
make test-cover           # Tests with coverage report
make lint                 # golangci-lint run

# Build
make build                # Build all service binaries
make docker-build         # Build all Docker images
make docker-push          # Push to container registry

# Deploy
make k8s-dev              # kubectl apply (dev overlay)
make k8s-staging          # kubectl apply (staging overlay)
make k8s-prod             # kubectl apply (production overlay)
```

---

## 10. Tech Stack tóm tắt

### 10.1. Core

| Layer           | Library/Tool                          | Version  |
|-----------------|---------------------------------------|----------|
| Language        | Go                                    | 1.22+    |
| HTTP Framework  | Gin                                   | 1.9+     |
| gRPC            | google.golang.org/grpc                | 1.62+    |
| ORM             | GORM                                  | 2.0+     |
| PostgreSQL      | pgx (via GORM driver)                 | 5.5+     |
| TimescaleDB     | pgx + TimescaleDB extension           | 2.14+    |
| InfluxDB        | influxdb-client-go                    | 2.13+    |
| Redis           | go-redis/redis                        | 9.5+     |
| Kafka           | IBM/sarama hoặc confluent-kafka-go    | latest   |
| WebSocket       | gorilla/websocket                     | 1.5+     |
| JWT             | golang-jwt/jwt                        | 5.2+     |
| RBAC            | casbin/casbin                         | 2.82+    |
| Validation      | go-playground/validator               | 10+      |
| Config          | spf13/viper                           | 1.18+    |
| Logging         | uber-go/zap                           | 1.27+    |
| Migration       | golang-migrate/migrate                | 4.17+    |

### 10.2. Infrastructure

| Tool            | Purpose                              | Port(s)  |
|-----------------|--------------------------------------|----------|
| PostgreSQL 16   | Master data                          | 5432     |
| TimescaleDB 2   | Time-series sensor history           | 5433     |
| InfluxDB 2.7    | Real-time sensor hot data            | 8086     |
| Redis 7         | Cache, sessions, rate limiting       | 6379     |
| Apache Kafka 3  | Event streaming                      | 9092     |
| MinIO           | Object/file storage (S3-compatible)  | 9000     |
| HashiCorp Vault | Secret management, JWT keys          | 8200     |
| Nginx           | Reverse proxy, load balancer         | 80/443   |

### 10.3. Observability

| Tool            | Purpose                              | Port     |
|-----------------|--------------------------------------|----------|
| Prometheus      | Metrics collection                   | 9090     |
| Grafana         | Dashboards + alerting                | 3000     |
| Jaeger          | Distributed tracing                  | 16686    |
| Loki            | Log aggregation                      | 3100     |

### 10.4. CI/CD & Deployment

| Tool            | Purpose                              |
|-----------------|--------------------------------------|
| Docker          | Containerization                     |
| Kubernetes      | Orchestration                        |
| Kustomize       | K8s config management (dev/staging/prod) |
| ArgoCD          | GitOps continuous deployment         |
| GitHub Actions  | CI pipeline (test → build → push)    |
| golangci-lint   | Static analysis                      |

---

## 11. Frontend ↔ Backend Compatibility

### 11.1. Chuyển Frontend từ Mock sang Backend thật

Chỉ cần thay đổi **1 file** trong Angular frontend: `src/app/core/services/api.service.ts`

```typescript
// TRƯỚC (mock):
getEquipment(): Observable<Equipment[]> {
  return of(MOCK_EQUIPMENT).pipe(delay(400));
}

// SAU (backend thật):
getEquipment(): Observable<Equipment[]> {
  return this.http.get<Equipment[]>(`${environment.apiBaseUrl}/equipment`);
}
```

### 11.2. Environment config mapping

| Frontend (environment.ts)       | Backend Service              |
|----------------------------------|------------------------------|
| `apiBaseUrl: localhost:8080/api` | api-gateway → downstream     |
| `wsUrl: ws://localhost:8080/ws`  | api-gateway → alert-service  |
| `grpcUrl: localhost:8081`        | Envoy → sensor/ml gRPC      |
| `kafkaWsProxy: ws://localhost:9092` | Kafka WS proxy            |

### 11.3. Response format contract

Tất cả REST API trả về format thống nhất:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 150,
    "totalPages": 8
  },
  "timestamp": "2025-01-15T10:30:00Z",
  "requestId": "req-abc123"
}
```

Error response:

```json
{
  "success": false,
  "error": {
    "code": "EQUIPMENT_NOT_FOUND",
    "message": "Equipment with ID 'eq-999' not found",
    "details": {}
  },
  "timestamp": "2025-01-15T10:30:00Z",
  "requestId": "req-abc123"
}
```

---

## 12. Production Deployment

```
┌──── Kubernetes Cluster ────────────────────────────────────────────┐
│                                                                    │
│  ┌─────────────────────┐      ┌──────────────────────────────────┐ │
│  │   Nginx Ingress     │      │     Services (Deployments)       │ │
│  │   Controller        │      │                                  │ │
│  │                     │  ──→ │  api-gateway     (2 replicas)    │ │
│  │   TLS termination   │      │  auth-service    (2 replicas)    │ │
│  │   /api  → gateway   │      │  equipment-svc   (2 replicas)    │ │
│  │   /ws   → gateway   │      │  sensor-svc      (3 replicas)    │ │
│  │   /grpc → envoy     │      │  alert-svc       (2 replicas)    │ │
│  │   /*    → frontend  │      │  workorder-svc   (2 replicas)    │ │
│  │                     │      │  ml-service      (2 replicas)    │ │
│  └─────────────────────┘      │  notification    (1 replica)     │ │
│                               │  opcua-bridge    (1 replica)     │ │
│  ┌──────────────────────────┐ └──────────────────────────────────┘ │
│  │     Infrastructure       │                                      │
│  │  (StatefulSets + PVCs)   │    ┌──────────────────────────────┐  │
│  │                          │    │      Observability           │  │
│  │  PostgreSQL  (HA)        │    │                              │  │
│  │  TimescaleDB (HA)        │    │  Prometheus + Grafana        │  │
│  │  Redis Sentinel          │    │  Jaeger + Loki               │  │
│  │  Kafka (3 brokers)       │    │                              │  │
│  │  MinIO (distributed)     │    └──────────────────────────────┘  │
│  │  Vault (HA)              │                                      │
│  └──────────────────────────┘    ┌──────────────────────────────┐  │
│                                  │      CI/CD                   │  │
│                                  │  ArgoCD (GitOps)             │  │
│                                  │  GitHub Actions → Build/Push │  │
│                                  └──────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

**Auto-scaling policies:**

| Service        | Min | Max | CPU Target | Memory Target |
|----------------|-----|-----|------------|---------------|
| api-gateway    | 2   | 10  | 70%        | 80%           |
| sensor-service | 3   | 20  | 60%        | 70%           |
| alert-service  | 2   | 8   | 70%        | 80%           |
| Others         | 2   | 5   | 70%        | 80%           |
