# Maintenix — Architecture & Design Decisions

> **Smart Predictive Maintenance Warning System**
> Đọc trước khi làm bất cứ việc gì trong project.

---

## Mục lục

1. [Tầm nhìn & Bài toán](#1-tầm-nhìn--bài-toán)
2. [Kiến trúc tổng quan](#2-kiến-trúc-tổng-quan)
3. [Quyết định thiết kế (ADR)](#3-quyết-định-thiết-kế-adr)
4. [Service Decomposition — Tại sao 9 services?](#4-service-decomposition--tại-sao-9-services)
5. [Communication Patterns — Khi nào dùng gì?](#5-communication-patterns--khi-nào-dùng-gì)
6. [Data Architecture — Polyglot Persistence](#6-data-architecture--polyglot-persistence)
7. [Security Architecture](#7-security-architecture)
8. [Real-time Data Pipeline](#8-real-time-data-pipeline)
9. [AI/ML Integration Architecture](#9-aiml-integration-architecture)
10. [Observability Strategy](#10-observability-strategy)
11. [Deployment Topology](#11-deployment-topology)
12. [Cross-cutting Concerns](#12-cross-cutting-concerns)
13. [Failure Modes & Resilience](#13-failure-modes--resilience)
14. [Scalability Considerations](#14-scalability-considerations)
15. [Sơ đồ tham chiếu nhanh](#15-sơ-đồ-tham-chiếu-nhanh)

---

## 1. Tầm nhìn & Bài toán

### 1.1. Bối cảnh

Maintenix là hệ thống **bảo trì dự đoán thông minh** cho nhà máy sản xuất công nghiệp. Hệ thống thu thập dữ liệu cảm biến real-time từ thiết bị sản xuất (PLC/SCADA), sử dụng AI/ML để dự đoán hỏng hóc trước khi xảy ra, tự động sinh cảnh báo và lệnh công việc (work order), giúp giảm downtime và tối ưu chi phí bảo trì.

### 1.2. Các yêu cầu kiến trúc chính (Quality Attributes)

| Quality Attribute   | Yêu cầu cụ thể                                                   | Ảnh hưởng thiết kế                       |
|---------------------|-------------------------------------------------------------------|------------------------------------------|
| **Low Latency**     | Sensor data → Alert trong < 5 giây                               | Kafka streaming, InfluxDB hot data       |
| **High Throughput** | 10,000+ sensor readings/giây (peak)                              | Kafka partitioning, TimescaleDB          |
| **Reliability**     | 99.9% uptime cho alert pipeline                                  | Service isolation, retry, DLQ            |
| **Scalability**     | Horizontal scale sensor & alert services                         | Microservices, Kubernetes HPA            |
| **Maintainability** | Team 3-5 dev có thể develop/deploy độc lập từng service          | Mono-repo + Go modules, Clean Arch       |
| **Security**        | RBAC 8 roles, audit trail mọi hành động                         | JWT RS256, Casbin, Vault                 |
| **Extensibility**   | Thêm loại sensor/model AI mới không cần sửa core                | Event-driven, plugin pattern             |

### 1.3. Stakeholders

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Stakeholder Map                              │
│                                                                     │
│  Factory Manager ──→ Dashboard KPI, OEE, cost overview              │
│  Maint. Manager  ──→ Work order approval, Gantt schedule, reports   │
│  Maint. Engineer ──→ Alert response, equipment detail, AI insights  │
│  Technician      ──→ Work order execution, checklist, spare parts   │
│  Data Scientist  ──→ Model registry, pipeline management, A/B test  │
│  Quality Inspector → Equipment health, PM compliance reports        │
│  Super Admin     ──→ User management, system settings, audit logs   │
│  Viewer          ──→ Read-only dashboards                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Kiến trúc tổng quan

### 2.1. System Context (C4 Level 1)

```
                          ┌──────────────────┐
                          │    Operators &   │
                          │  Factory Staff   │
                          │  (8 roles)       │
                          └────────┬─────────┘
                                   │ HTTPS / WSS
                                   ▼
                          ┌──────────────────┐
                          │    Maintenix     │
                          │    System        │
                          └──┬─────────┬─────┘
                             │         │
              OPC-UA / Modbus│         │ SMTP / Webhook
                             ▼         ▼
                    ┌──────────┐  ┌──────────────┐
                    │ PLC/SCADA│  │ External:    │
                    │ (Sensors)│  │ Email, Slack,│
                    │          │  │ Teams, SMS   │
                    └──────────┘  └──────────────┘
```

### 2.2. Container Diagram (C4 Level 2)

```
┌─── Client Layer ────────────────────────────────────────────────────────┐
│                                                                         │
│   Angular 17 SPA ←── REST / gRPC-Web / WebSocket ──→ Nginx (LB/TLS)     │
│   (ng-zorro + ECharts + Tailwind)                                       │
│                                                                         │
└──────────────────────────────────────────────┬──────────────────────────┘
                                               │
┌─── API Layer ────────────────────────────────┼──────────────────────────┐
│                                               │                         │
│   ┌────────────────────────────────────────────────────────────────┐    │
│   │                    API Gateway (:8080)                         │    │
│   │   Reverse proxy · JWT validation · Rate limit · KPI aggregator │    │
│   └──────┬──────┬──────┬──────┬──────┬──────┬──────────────────────┘    │
│          │      │      │      │      │      │                           │
└──────────┼──────┼──────┼──────┼──────┼──────┼───────────────────────────┘
           │      │      │      │      │      │
┌─── Service Layer (Business Logic) ──────────┼───────────────────────────┐
│          │      │      │      │      │      │                           │
│          ▼      ▼      ▼      ▼      ▼      ▼                           │
│   ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐             │
│   │ Auth │ │Equip.│ │Sensor│ │Alert │ │ Work │ │    ML    │             │
│   │ Svc  │ │ Svc  │ │ Svc  │ │ Svc  │ │Order │ │  Service │             │
│   │:8081 │ │:8082 │ │:8083 │ │:8084 │ │ :8085│ │  :8086   │             │
│   └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────────┘             │
│                                                                         │
│   ┌────────────────┐   ┌───────────────┐                                │
│   │  Notification  │   │  OPC-UA       │   ← Edge/IoT Layer             │
│   │  Service :8087 │   │  Bridge :4840 │                                │
│   └────────────────┘   └───────────────┘                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
           │              │            │              │
┌─── Infrastructure Layer ────────────────────────────────────────────────┐
│                                                                         │
│   ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌───────┐ ┌───────┐           │
│   │PostgreSQL│ │TimescaleDB│ │ InfluxDB │ │ Redis │ │ Kafka │           │
│   │  :5432   │ │   :5433   │ │  :8086   │ │ :6379 │ │ :9092 │           │
│   │  Master  │ │ Time-     │ │  Hot     │ │ Cache │ │ Event │           │
│   │  data    │ │ series    │ │  data    │ │ & Sess│ │ Bus   │           │
│   └──────────┘ └───────────┘ └──────────┘ └───────┘ └───────┘           │
│                                                                         │
│   ┌───────┐   ┌───────────┐   ┌───────────┐                             │
│   │ MinIO │   │   Vault   │   │  Envoy    │                             │
│   │ :9000 │   │   :8200   │   │  (gRPC    │                             │
│   │ Files │   │  Secrets  │   │   proxy)  │                             │
│   └───────┘   └───────────┘   └───────────┘                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
           │              │              │
┌─── Observability Layer ─────────────────────────────────────────────────┐
│                                                                         │
│   Prometheus (:9090) → Grafana (:3000) → Alert rules                    │
│   Jaeger (:16686) → Distributed tracing (OpenTelemetry)                 │
│   Loki (:3100) → Centralized log aggregation                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Quyết định thiết kế (ADR)

Mỗi quyết định dưới đây tuân theo format: **Context → Decision → Consequences**.

### ADR-001: Go thay vì Java/Node.js cho backend

**Context:** Hệ thống cần xử lý high-throughput sensor data (10K+ readings/s), nhiều concurrent connections (WebSocket, gRPC streaming), và deploy dưới dạng lightweight containers.

**Decision:** Chọn **Go 1.22+** cho tất cả 9 microservices.

**Consequences:**

| Ưu điểm | Đánh đổi |
|----------|----------|
| Goroutines xử lý concurrent cực hiệu quả (sensor ingestion, WS hub) | Ecosystem nhỏ hơn Java (ít ORM, ít framework) |
| Binary size nhỏ (15-25MB), startup < 1s, RAM thấp | Generics mới (Go 1.18+), community patterns chưa mature |
| gRPC native support tốt (protobuf first-class) | Error handling verbose (no exceptions) |
| Compile-time type safety + linter (golangci-lint) | Không có framework full-featured như Spring Boot |
| Ideal cho Kubernetes: fast scale-up/down | Team cần học Go nếu chưa biết |

**Alternatives considered:**
- **Java/Spring Boot**: Mature ecosystem nhưng JVM startup chậm (5-15s), RAM 256MB+/service, không phù hợp rapid scaling
- **Node.js**: Tốt cho I/O nhưng single-threaded, không ideal cho CPU-intensive ML inference
- **Rust**: Performance tốt hơn nhưng learning curve cao, development speed chậm hơn

---

### ADR-002: Microservices thay vì Monolith

**Context:** Hệ thống có nhiều domain rõ ràng (Auth, Equipment, Sensor, Alert, WorkOrder, ML) với yêu cầu scale khác nhau (sensor-service cần scale 3-20 replicas, notification-service chỉ cần 1).

**Decision:** Tách thành **9 microservices** trong mono-repo, giao tiếp qua REST + gRPC + Kafka.

**Consequences:**

| Ưu điểm | Đánh đổi |
|----------|----------|
| Scale từng service độc lập theo workload | Phức tạp vận hành (9 deployments) |
| Deploy từng service không ảnh hưởng service khác | Distributed tracing cần thiết |
| Team có thể phát triển song song | Data consistency challenges (eventual consistency) |
| Failure isolation (sensor-service down ≠ auth-service down) | Network latency giữa services |
| Mono-repo giảm overhead quản lý nhiều repos | Shared `pkg/` cần versioning cẩn thận |

---

### ADR-003: Mono-repo thay vì Multi-repo

**Context:** 9 services chia sẻ nhiều code chung (auth middleware, database clients, error types, protobuf definitions). Multi-repo sẽ tạo dependency hell với internal packages.

**Decision:** **Mono-repo** với Go workspace (`go.work`) — mỗi service là 1 Go module riêng, shared code trong `pkg/`.

**Consequences:**
- ✅ Atomic changes across services (1 PR thay đổi proto + handler + test)
- ✅ Shared `pkg/` import trực tiếp, không cần publish module
- ✅ CI chạy test tất cả affected services trong 1 pipeline
- ⚠️ Repo size lớn dần (mitigate: `.gitignore` aggressively, sparse checkout)
- ⚠️ Build time tăng (mitigate: Makefile chỉ build services có thay đổi)

---

### ADR-004: Clean Architecture cho mỗi service

**Context:** Mỗi service cần testable, và phải dễ thay đổi database/framework mà không ảnh hưởng business logic.

**Decision:** Áp dụng **Clean Architecture** (Hexagonal/Ports & Adapters) cho mỗi service:

```
┌─────────────────────────────────────────────────────────────────┐
│                         External World                          │
│   HTTP Request   gRPC Call   Kafka Event   Cron Job             │
└───────┬──────────┬───────────┬──────────────┬───────────────────┘
        │          │           │              │
        ▼          ▼           ▼              ▼
┌────────────────────────────────────────────────────────────────┐
│                    Handler / Adapter Layer                     │
│   handler/*.go (Gin HTTP)                                      │
│   grpc/server.go (gRPC)                                        │
│   kafka/consumer.go (Kafka)                                    │
│                                                                │
│   Responsibilities: request validation, serialization,         │
│   authentication, error formatting                             │
└────────────────────────────┬───────────────────────────────────┘
                             │ calls
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                    Service Layer (Business Logic)              │
│   service/*_service.go                                         │
│                                                                │
│   Responsibilities: orchestration, business rules,             │
│   domain validation, event publishing                          │
│                                                                │
│   Dependencies: domain interfaces ONLY (no concrete imports)   │
└────────────────────────────┬───────────────────────────────────┘
                             │ calls via interface
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                    Domain Layer (Core)                         │
│   domain/*.go                                                  │
│                                                                │
│   Contains: Entities, Value Objects, Repository Interfaces     │
│   Rule: ZERO external dependencies (no GORM, no Redis, etc.)   │
└────────────────────────────┬───────────────────────────────────┘
                             │ implemented by
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                    Repository Layer (Infrastructure)           │
│   repository/*_repo.go                                         │
│                                                                │
│   Implements domain interfaces with concrete DB access:        │
│   PostgreSQL (GORM), TimescaleDB, InfluxDB, Redis              │
└────────────────────────────────────────────────────────────────┘
```

**Quy tắc quan trọng:**
- `domain/` **KHÔNG import** bất kỳ external package nào
- `service/` **CHỈ depend** vào interfaces từ `domain/`
- `repository/` implement interfaces từ `domain/` — có thể swap PostgreSQL → MongoDB mà service layer không biết
- `handler/` là adapter mỏng: parse request → gọi service → format response

---

### ADR-005: Event-Driven Architecture (Kafka) cho sensor pipeline

**Context:** Sensor data cần được xử lý bởi nhiều consumers cùng lúc (storage, alert checking, ML prediction) mà không tạo tight coupling giữa services.

**Decision:** Sử dụng **Apache Kafka** làm event bus trung tâm cho tất cả async communication.

**Chi tiết ở [Section 5.2](#52-async-kafka-event-driven) và [Section 8](#8-real-time-data-pipeline).**

---

### ADR-006: Polyglot Persistence — Tại sao 5 databases?

**Context:** Dữ liệu trong hệ thống có nature rất khác nhau: structured master data, high-volume time-series, hot real-time data, cache/sessions, binary files.

**Decision:** Mỗi loại data dùng database phù hợp nhất. **Chi tiết ở [Section 6](#6-data-architecture--polyglot-persistence).**

---

### ADR-007: Angular 17 + ng-zorro cho frontend

**Context:** Frontend cần: dashboard phức tạp (charts, Gantt, Kanban), enterprise UI components (table, form, modal), i18n tiếng Việt, và đội dev quen Angular.

**Decision:** **Angular 17** (standalone components) + **ng-zorro-antd** + **ECharts** + **Tailwind CSS**.

**Consequences:**

| Ưu điểm | Đánh đổi |
|----------|----------|
| ng-zorro cung cấp 60+ components enterprise-grade | Bundle size lớn hơn React (~350KB gzip) |
| ECharts: 50+ chart types, 3D support, real-time update | Learning curve Angular cao hơn React/Vue |
| Standalone components giảm boilerplate (no NgModules) | ng-zorro phụ thuộc vào Angular version |
| Tailwind cho utility-first custom styling | SCSS + Tailwind đôi khi conflict |
| Built-in i18n `vi_VN` locale | — |

---

## 4. Service Decomposition — Tại sao 9 services?

### 4.1. Bounded Contexts (Domain-Driven Design)

Hệ thống được chia theo **bounded contexts** — mỗi context có ngôn ngữ riêng, data riêng, lifecycle riêng:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Maintenix Domain Map                           │
│                                                                         │
│  ┌─── Identity & Access ────┐  ┌─── Asset Management ────────────────┐  │
│  │                          │  │                                     │  │
│  │  auth-service            │  │  equipment-service                  │  │
│  │  · User, Role, Session   │  │  · Equipment, Location, Specs       │  │
│  │  · RBAC policies         │  │  · SparePart, MaintenanceSchedule   │  │
│  │  · Audit trail           │  │  · Health score calculation         │  │
│  │                          │  │                                     │  │
│  └──────────────────────────┘  └─────────────────────────────────────┘  │
│                                                                         │
│  ┌─── IoT & Telemetry ──────┐  ┌─── Alerting & SLA ────────────────┐    │
│  │                          │  │                                   │    │
│  │  sensor-service          │  │  alert-service                    │    │
│  │  · Sensor metadata       │  │  · Alert lifecycle (CRUD)         │    │
│  │  · Time-series ingestion │  │  · SLA countdown & breach         │    │
│  │  · Anomaly detection     │  │  · Auto-escalation                │    │
│  │                          │  │  · WebSocket broadcast            │    │
│  │  opcua-bridge            │  │                                   │    │
│  │  · PLC/SCADA protocol    │  └───────────────────────────────────┘    │
│  │  · Raw data extraction   │                                           │
│  │                          │  ┌─── Work Execution ────────────────┐    │
│  └──────────────────────────┘  │                                   │    │
│                                │  workorder-service                │    │
│  ┌─── AI & Predictions ─────┐  │  · Work order FSM                 │    │
│  │                          │  │  · Checklists, work logs          │    │
│  │  ml-service              │  │  · Cost tracking                  │    │
│  │  · Model registry        │  │  · Report generation              │    │
│  │  · Pipeline orchestration│  │                                   │    │
│  │  · RUL prediction        │  └───────────────────────────────────┘    │
│  │  · Drift monitoring      │                                           │
│  │                          │  ┌─── Communication ─────────────────┐    │
│  └──────────────────────────┘  │                                   │    │
│                                │  notification-service             │    │
│  ┌─── Traffic Management ───┐  │  · Multi-channel dispatch         │    │
│  │                          │  │  · Template rendering             │    │
│  │  api-gateway             │  │  · Delivery tracking              │    │
│  │  · Routing & proxy       │  │                                   │    │
│  │  · Rate limiting         │  └───────────────────────────────────┘    │
│  │  · KPI aggregation       │                                           │
│  │  · WebSocket hub         │                                           │
│  └──────────────────────────┘                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2. Tại sao tách/gộp từng service?

| Service | Tại sao tách riêng? | Nếu gộp vào đâu thì sai? |
|---------|---------------------|--------------------------|
| **auth-service** | Security concern riêng biệt, mọi service khác đều gọi gRPC `ValidateToken` — nếu auth down, cần isolate rõ ràng | Gộp vào gateway → gateway quá nặng, khó test auth logic |
| **sensor-service** | Throughput cao nhất (10K+ readings/s), cần scale 3-20 replicas, dùng TimescaleDB + InfluxDB riêng | Gộp vào equipment → equipment CRUD đơn giản bị kéo scale theo |
| **alert-service** | WebSocket stateful (connection hub), SLA timer chạy liên tục, Kafka consumer riêng | Gộp vào sensor → alert business logic phức tạp (escalation, SLA) không liên quan sensor processing |
| **workorder-service** | FSM phức tạp (6 states), checklist, cost tracking — domain riêng biệt hoàn toàn | Gộp vào alert → work order có thể tạo manual, không phải lúc nào cũng từ alert |
| **ml-service** | Model lifecycle khác hoàn toàn (register → train → deploy → deprecate), pipeline orchestration | Gộp vào sensor → ML logic sẽ bloat sensor-service, khác team develop |
| **notification-service** | Fire-and-forget, Kafka consumer thuần, không cần HTTP endpoint | Gộp vào alert → notification cần serve nhiều sources (alert, WO, maintenance reminder) |
| **opcua-bridge** | Protocol adapter thuần (OPC-UA → Kafka), deploy gần PLC (edge) | Gộp vào sensor → OPC-UA library nặng, chỉ cần ở edge |
| **api-gateway** | Single entry point, cross-cutting concerns (rate limit, CORS, auth check) | Không tách → mỗi service tự handle CORS/rate limit → duplicate logic |
| **equipment-service** | Quản lý cả spare parts + maintenance schedule (cùng asset domain) | Tách spare-parts riêng → over-engineering, data coupling quá chặt với equipment |

### 4.3. Những gì KHÔNG tách service

| Chức năng | Ở đâu? | Tại sao không tách? |
|-----------|--------|---------------------|
| Spare Parts | equipment-service | Spare part gắn chặt với equipment (FK), query thường JOIN, tách ra tạo unnecessary network hop |
| Maintenance Schedule | equipment-service | Schedule liên quan trực tiếp equipment health & specs |
| Reports | workorder-service + api-gateway (aggregator) | Reports là aggregation queries, không có domain logic riêng, không cần runtime riêng |
| User Profile | auth-service | Profile là extension của User entity, cùng lifecycle |

---

## 5. Communication Patterns — Khi nào dùng gì?

Hệ thống sử dụng **4 protocol** khác nhau. Decision matrix:

### 5.1. Protocol Decision Matrix

```
┌───────────────────────────────────────────────────────────────────────┐
│                    Communication Decision Tree                        │
│                                                                       │
│  Cần response ngay?                                                   │
│  ├── YES → Cần binary performance?                                    │
│  │         ├── YES → gRPC (inter-service, streaming)                  │
│  │         └── NO  → REST/HTTP (CRUD, external-facing)                │
│  │                                                                    │
│  └── NO  → Cần broadcast to nhiều consumers?                          │
│            ├── YES → Kafka event (pub/sub)                            │
│            └── NO  → Cần push to client real-time?                    │
│                      ├── YES → WebSocket (STOMP)                      │
│                      └── NO  → Kafka event (point-to-point)           │
└───────────────────────────────────────────────────────────────────────┘
```

### 5.2. Chi tiết từng pattern

#### REST/HTTP — Frontend ↔ Backend, CRUD operations

```
Dùng khi:
  · Frontend gọi backend (qua API Gateway)
  · CRUD operations (create/read/update/delete)
  · Request-response đơn giản
  · Cần cacheable (GET requests)

Không dùng khi:
  · Inter-service high-frequency calls (dùng gRPC)
  · Fire-and-forget events (dùng Kafka)

Ví dụ:
  · GET  /api/equipment        → List equipment
  · POST /api/work-orders      → Create work order
  · PUT  /api/alerts/:id/ack   → Acknowledge alert
```

#### gRPC — Inter-service synchronous, streaming

```
Dùng khi:
  · Service-to-service calls cần low latency
  · Streaming data (server-streaming sensor readings)
  · Strong contract enforcement (protobuf schema)
  · Binary performance matters (10x faster than JSON REST)

Không dùng khi:
  · Frontend calls (browser không support native gRPC → cần gRPC-Web qua Envoy)
  · Fire-and-forget (dùng Kafka)

Ví dụ:
  · api-gateway → auth-service: ValidateToken (mỗi request)
  · frontend → sensor-service: StreamSensorData (live chart)
  · alert-service → equipment-service: GetHealthScore
  · frontend → ml-service: StreamPredictions (real-time AI)
```

#### Kafka — Async event-driven, decoupled

```
Dùng khi:
  · Producer không cần biết/care consumer là ai
  · Nhiều consumers cần cùng 1 event (fan-out)
  · Cần guaranteed delivery (at-least-once)
  · Cần replay events (debug, re-process)
  · Fire-and-forget (notification, audit log)

Không dùng khi:
  · Cần response ngay (dùng REST/gRPC)
  · Simple request-response

Ví dụ:
  · maintenix.sensor.raw: opcua-bridge → sensor-service
  · maintenix.sensor.processed: sensor-service → alert-service + ml-service (fan-out)
  · maintenix.alert.created: alert-service → notification-service + api-gateway
  · maintenix.notification.send: any → notification-service
```

#### WebSocket (STOMP) — Server push to browser

```
Dùng khi:
  · Real-time updates tới browser (alert popup, sensor chart update)
  · Per-user filtered notifications
  · Bidirectional communication (chat, acknowledge)

Không dùng khi:
  · Service-to-service (dùng Kafka/gRPC)
  · Data không cần real-time (dùng polling REST)

Ví dụ:
  · /topic/factory-alerts      → Broadcast new alerts to all connected users
  · /topic/sensor-updates      → Live sensor data (refreshes dashboard charts)
  · /topic/equipment-status    → Equipment status changes (map update)
  · /user/queue/notifications  → Per-user notifications (filtered by role)
```

### 5.3. Communication Map giữa services

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         Service Communication Map                            │
│                                                                              │
│   ───── REST ─────    ═════ gRPC ═════    - - - Kafka - - -    ∿∿∿ WS ∿∿∿  │
│                                                                              │
│                                                                              │
│   Angular ─────── Nginx ─────── api-gateway ═══════ auth-service             │
│   (SPA)     REST          REST      │  gRPC         (ValidateToken)          │
│      │                              │                                        │
│      │∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿│                                    │
│      │ WebSocket (STOMP)            │                                        │
│      │                              │                                        │
│                                     ├────── equipment-service                │
│   opcua-bridge - - - - - - - → Kafka│         │                              │
│   (sensor.raw)                      │    ┌────┘                              │
│                                     │    │ Kafka (sensor.processed)          │
│                              sensor-service - - - - → alert-service          │
│                              (consumer+producer)      │  (threshold check)   │
│                                     │                 │                      │
│                                     │            - - -│- - - → notification  │
│                              ml-service               │         -service     │
│                              (consumer: sensor.processed)        (consumer)  │
│                                     │                 │                      │
│                                     │   Kafka         │                      │
│                                     │   (ml.prediction)                      │
│                                     │                 │                      │
│                                     └─ - - - → workorder-service             │
│                                                (consumer: alert.created)     │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Data Architecture — Polyglot Persistence

### 6.1. Tại sao 5 databases?

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                       Data Classification & Storage                          │
│                                                                              │
│   ┌─── Structured Master Data ────────────── PostgreSQL 16 (:5432) ─────┐    │
│   │                                                                     │    │
│   │  Users, Roles, Equipment, Alerts, WorkOrders, AI Models             │    │
│   │  → ACID transactions, complex JOINs, referential integrity          │    │
│   │  → Tại sao không NoSQL? Cần strong consistency cho business data    │    │
│   │                                                                     │    │
│   └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│   ┌─── Time-Series History ───────────── TimescaleDB 2.14 (:5433) ──────┐    │
│   │                                                                     │    │
│   │  sensor_readings (hypertable), sensor_anomalies                     │    │
│   │  → 365 ngày retention, auto-compression sau 7 ngày                  │    │
│   │  → Tại sao không InfluxDB? TimescaleDB = PostgreSQL extension,      │    │
│   │    dùng SQL quen thuộc, JOIN được với master data                   │    │
│   │  → Tại sao cần riêng port? Tách workload: master data queries       │    │
│   │    không bị ảnh hưởng bởi heavy time-series aggregation             │    │
│   │                                                                     │    │
│   └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│   ┌─── Real-time Hot Data ────────────── InfluxDB 2.7 (:8086) ──────────┐    │
│   │                                                                     │    │
│   │  sensor_realtime (7 ngày), sensor_aggregated (30 ngày)              │    │
│   │  → Optimized cho write-heavy (10K+ writes/s)                        │    │
│   │  → 1m/5m/1h continuous aggregation queries                          │    │
│   │  → Tại sao không chỉ TimescaleDB? InfluxDB nhanh hơn 3-5x           │    │
│   │    cho real-time point queries (last 5 minutes), nhưng kém hơn      │    │
│   │    cho complex aggregation. Dùng cả 2: hot (InfluxDB) + warm        │    │
│   │    (TimescaleDB)                                                    │    │
│   │                                                                     │    │
│   └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│   ┌─── Cache & Sessions ─────────────── Redis 7 (:6379) ────────────────┐    │
│   │                                                                     │    │
│   │  Sessions (24h TTL), JWT blacklist (7d), equipment health cache     │    │
│   │  (5m), sensor latest reading (30s), rate limit counters (1m),       │    │
│   │  dashboard KPI cache (30s), SLA countdown timers                    │    │
│   │  → In-memory, sub-millisecond reads                                 │    │
│   │  → Tại sao không Memcached? Redis có data structures (sorted set    │    │
│   │    cho SLA countdown, pub/sub cho cache invalidation)               │    │
│   │                                                                     │    │
│   └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│   ┌─── Binary Files / Objects ────────── MinIO (:9000) ──────────────────┐   │ 
│   │                                                                      │   │
│   │  Equipment manuals/photos, work order attachments, ML model          │   │
│   │  artifacts (.pkl, .onnx), training datasets                          │   │
│   │  → S3-compatible API, self-hosted                                    │   │
│   │  → Tại sao không local filesystem? Stateless containers cần          │   │
│   │    external storage; MinIO clusters cho HA                           │   │
│   │                                                                      │   │
│   └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 6.2. Data Ownership — Ai sở hữu gì?

**Nguyên tắc: Mỗi table chỉ có 1 service owner.** Service khác muốn đọc data phải gọi qua API/gRPC của owner, KHÔNG truy cập trực tiếp database.

```
┌───────────────────────┬───────────────────────────────────────────────────┐
│ Service               │ Owns (read + write)                               │
├───────────────────────┼───────────────────────────────────────────────────┤
│ auth-service          │ users, roles, permissions, sessions, audit_logs   │
│ equipment-service     │ equipment, locations, specs, spare_parts,         │
│                       │ maintenance_schedules, pm_templates               │
│ sensor-service        │ sensors (PG), sensor_readings (Timescale),        │
│                       │ sensor_realtime (InfluxDB)                        │
│ alert-service         │ alerts, alert_history, sla_config, escalation     │
│ workorder-service     │ work_orders, checklists, work_logs, cost_records  │
│ ml-service            │ ai_models, model_versions, pipelines, predictions │
│ notification-service  │ notification_logs, notification_templates         │
└───────────────────────┴───────────────────────────────────────────────────┘
```

### 6.3. Data Flow: Write Path vs Read Path

```
Write Path (sensor data):                    Read Path (dashboard):

PLC → OPC-UA Bridge                         Browser → Nginx → API Gateway
       │                                                       │
       ▼                                         ┌─────────────┼─────────────┐
  Kafka (sensor.raw)                             │             │             │
       │                                         ▼             ▼             ▼
       ▼                                    equipment     sensor-svc     alert-svc
  sensor-service                            -service      (InfluxDB     (Redis
       │                                    (Redis        hot data)     active count)
       ├──→ InfluxDB (hot, 7d)              cache)             │             │
       ├──→ TimescaleDB (warm, 365d)             │             │             │
       └──→ Kafka (sensor.processed)             └─────────────┼─────────────┘
              │                                                │
              ├──→ alert-service                         KPI aggregation
              └──→ ml-service                            (cached 30s Redis)
                                                               │
                                                               ▼
                                                          JSON response
```

---

## 7. Security Architecture

### 7.1. Authentication Flow

```
┌───────────┐  POST /login    ┌──────────┐  Verify credentials  ┌──────────┐
│  Browser  │ ──────────────→ │   API    │ ═══════════════════→ │   Auth   │
│  (Angular)│                 │ Gateway  │                      │  Service │
│           │ ←────────────── │  :8080   │ ←═══════════════════ │  :8081   │
│           │  JWT + Refresh  └──────────┘  JWT signed RS256    └──────────┘
│           │                                (key from Vault)
│           │
│  Subsequent requests:
│           │
│  GET /api/equipment
│  Authorization: Bearer <JWT>
│           │
│           │ ──────────────→ API Gateway ═══════════════════→ Auth Service
│           │                      │        gRPC ValidateToken     │
│           │                      │ ←═══════════════════════════ │
│           │                      │  {valid: true, claims: {...}}
│           │                      │
│           │                      ▼
│           │              equipment-service
│           │                 (trusted: JWT already validated)
│           │ ←──────────── response
└───────────┘
```

### 7.2. JWT Structure

```json
{
  "header": {
    "alg": "RS256",
    "typ": "JWT",
    "kid": "vault-key-v1"
  },
  "payload": {
    "sub": "user-uuid-001",
    "username": "engineer",
    "role": "maintenance_engineer",
    "department": "Production Line A",
    "permissions": ["equipment:read", "alert:write", "workorder:write"],
    "iat": 1706000000,
    "exp": 1706086400,
    "jti": "unique-token-id"
  }
}
```

**Tại sao RS256 thay vì HS256?**
- RS256 (asymmetric): Auth service giữ private key (sign), tất cả services khác dùng public key (verify) — không cần share secret
- HS256 (symmetric): Mọi service cần biết secret — lộ 1 service = lộ tất cả
- Private key lưu trong **HashiCorp Vault**, rotate định kỳ

### 7.3. RBAC Model (3 lớp)

```
┌─── Layer 1: UI Sidebar (Frontend) ──────────────────────────────────┐
│                                                                     │
│  role.guard.ts kiểm tra route → ẩn/hiện menu items                  │
│  Ví dụ: Viewer không thấy menu Users, Settings                      │
│  → Chỉ là UX, KHÔNG phải security (bypass được qua URL)             │
│                                                                     │
├─── Layer 2: API Endpoint (Backend) ─────────────────────────────────┤
│                                                                     │
│  Casbin middleware kiểm tra: role + endpoint + method               │
│  Policy: maintenance_engineer, /api/equipment/*, GET  → ALLOW       │
│  Policy: maintenance_engineer, /api/users/*, *        → DENY        │
│  → Real security boundary                                           │
│                                                                     │
├─── Layer 3: Data Row/Column (Repository) ───────────────────────────┤
│                                                                     │
│  Repository layer filter data theo department/assignment            │
│  Ví dụ: Technician chỉ thấy work orders assigned cho mình           │
│  Ví dụ: Factory Manager thấy tất cả equipment trong factory mình    │
│  → Fine-grained data access control                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.4. Secret Management (Vault)

```
┌──── HashiCorp Vault (:8200) ───────────────────────────────┐
│                                                            │
│  secret/maintenix/jwt-keys       → RSA key pair            │
│  secret/maintenix/db-credentials → PostgreSQL passwords    │
│  secret/maintenix/kafka          → Kafka credentials       │
│  secret/maintenix/minio          → MinIO access keys       │
│  secret/maintenix/smtp           → Email credentials       │
│  secret/maintenix/twilio         → SMS API keys            │
│  secret/maintenix/slack          → Webhook URLs            │
│                                                            │
│  Policies: mỗi service chỉ đọc được secrets của mình       │
│  auth-service → jwt-keys + db-credentials                  │
│  notification-service → smtp + twilio + slack              │
│                                                            │
│  Auto-rotation: JWT keys mỗi 30 ngày                       │
│  Dynamic secrets: DB credentials lease 1h, auto-renew      │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 8. Real-time Data Pipeline

### 8.1. End-to-End Sensor Flow

```
┌─────────┐    OPC-UA     ┌──────────┐   Kafka           ┌────────────┐
│ PLC/    │ ────────────→ │ OPC-UA   │ ────────────────→ │  sensor    │
│ SCADA   │  (subscribe)  │ Bridge   │ (sensor.raw)      │  -service  │
│ Sensors │               │ :4840    │                   │  :8083     │
└─────────┘               └──────────┘                   └──────┬─────┘
                                                                  │
                                                    ┌─────────────┼──────────────┐
                                                    │             │              │
                                                    ▼             ▼              ▼
                                              ┌──────────┐ ┌──────────┐ ┌──────────────┐
                                              │ InfluxDB │ │Timescale │ │    Kafka     │
                                              │ (hot 7d) │ │DB (365d) │ │ (sensor.     │
                                              └──────────┘ └──────────┘ │  processed)  │
                                                                        └──────┬───────┘
                                                                               │
                                                              ┌────────────────┼────────────┐
                                                              │                │            │
                                                              ▼                ▼            ▼
                                                        ┌──────────┐  ┌───────────┐  ┌──────────┐
                                                        │  alert   │  │    ML     │  │equipment │
                                                        │ -service │  │  -service │  │ -service │
                                                        │ (thresh. │  │ (predict  │  │ (health  │
                                                        │  check)  │  │  RUL)     │  │  recalc) │
                                                        └────┬─────┘  └────┬──────┘  └──────────┘
                                                             │             │
                                                             ▼             ▼
                                                     Kafka (alert.   Kafka (ml.
                                                      created)        prediction)
                                                             │             │
                                                     ┌───────┼─────────────┘
                                                     │       │
                                                     ▼       ▼
                                              ┌────────────────────┐
                                              │  notification-svc  │
                                              │  (email/SMS/Slack) │
                                              └────────────────────┘
                                                     │
                                                     ▼
                                              ┌────────────────────┐
                                              │  api-gateway       │
                                              │  (WebSocket push)  │
                                              └────────┬───────────┘
                                                       │ STOMP
                                                       ▼
                                              ┌────────────────────┐
                                              │  Browser (Angular) │
                                              │  Real-time update  │
                                              └────────────────────┘
```

### 8.2. Latency Budget

```
End-to-end target: PLC → Browser < 5 seconds

┌────────────────┬─────────┬──────────────────────────────────────┐
│ Stage          │ Budget  │ Notes                                │
├────────────────┼─────────┼──────────────────────────────────────┤
│ PLC → OPC-UA   │ ~100ms  │ OPC-UA subscription interval         │
│ Bridge → Kafka │ ~50ms   │ Async producer, batch 100ms          │
│ Kafka delivery │ ~100ms  │ Within same cluster                  │
│ sensor-service │ ~200ms  │ Validate + write InfluxDB/Timescale  │
│ → Kafka        │ ~50ms   │ Produce sensor.processed             │
│ alert-service  │ ~500ms  │ Threshold check + DB write           │
│ → WebSocket    │ ~100ms  │ Kafka → gateway → STOMP broadcast    │
│ Network → UI   │ ~100ms  │ WebSocket delivery to browser        │
├────────────────┼─────────┼──────────────────────────────────────┤
│ TOTAL          │ ~1.2s   │ Well within 5s budget                │
│ (typical)      │         │ Peak: 2-3s under load                │
└────────────────┴─────────┴──────────────────────────────────────┘
```

---

## 9. AI/ML Integration Architecture

### 9.1. ML Service Responsibilities

```
┌──── ml-service (:8086) ────────────────────────────────────────────┐
│                                                                    │
│  ┌─── Model Registry ───────────────────────────────────────────┐  │
│  │  5 pre-registered models:                                    │  │
│  │  · RUL Predictor (remaining useful life)                     │  │
│  │  · Anomaly Detector (unsupervised)                           │  │
│  │  · Failure Mode Classifier (supervised)                      │  │
│  │  · Energy Optimizer (regression)                             │  │
│  │  · Quality Predictor (classification)                        │  │
│  │                                                              │  │
│  │  Lifecycle: Draft → Training → Validating → Deployed →       │  │
│  │             Deprecated → Archived                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─── Prediction Pipeline ───────────────────────────────────────┐ │
│  │                                                               │ │
│  │  Kafka (sensor.processed)                                     │ │
│  │       │                                                       │ │
│  │       ▼                                                       │ │
│  │  Feature extraction (rolling window, statistical features)    │ │
│  │       │                                                       │ │
│  │       ▼                                                       │ │
│  │  Model inference (loaded model artifact from MinIO)           │ │
│  │       │                                                       │ │
│  │       ▼                                                       │ │
│  │  Kafka (ml.prediction) → alert-service (auto-generate alert)  │ │
│  │                                                               │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌─── Drift Monitor ────────────────────────────────────────────┐  │
│  │  · Data drift detection (feature distribution shift)         │  │
│  │  · Model performance degradation tracking                    │  │
│  │  · Auto-trigger retraining pipeline when drift > threshold   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 9.2. Model Artifact Storage

```
MinIO (model-artifacts bucket):

model-artifacts/
├── rul-predictor/
│   ├── v1.0.0/
│   │   ├── model.onnx          ← ONNX format (cross-platform inference)
│   │   ├── metadata.json       ← Hyperparams, training metrics, data version
│   │   └── feature_config.json ← Input features, scaling params
│   └── v1.1.0/
│       └── ...
├── anomaly-detector/
│   └── v1.0.0/
│       ├── model.pkl           ← Isolation Forest (scikit-learn)
│       └── ...
└── ...
```

### 9.3. Tại sao Go cho ML service thay vì Python?

ML service dùng Go cho API layer + Kafka consumer, nhưng **model inference** có 2 options:

| Approach | Khi nào dùng |
|----------|-------------|
| **ONNX Runtime (Go binding)** | Production: load `.onnx` model, inference trong Go process — low latency, no Python dependency |
| **gRPC → Python sidecar** | Training/retraining: complex ML pipelines gọi Python service qua gRPC — full scikit-learn/PyTorch ecosystem |

---

## 10. Observability Strategy

### 10.1. Three Pillars

```
┌─── Metrics (Prometheus) ─────────────────────────────────────────────┐
│                                                                      │
│  Mỗi service expose :PORT/metrics (Prometheus format)                │
│                                                                      │
│  Business metrics:                                                   │
│  · maintenix_sensor_readings_total (counter)                         │
│  · maintenix_alert_active_count (gauge)                              │
│  · maintenix_workorder_completion_rate (histogram)                   │
│  · maintenix_ml_prediction_latency_seconds (histogram)               │
│                                                                      │
│  Infrastructure metrics:                                             │
│  · go_goroutines, go_memstats_*                                      │
│  · http_requests_total, http_request_duration_seconds                │
│  · kafka_consumer_lag, kafka_consumer_records_consumed_total         │
│  · grpc_server_handled_total, grpc_server_handling_seconds           │
│                                                                      │
│  Alerting rules (Prometheus → Grafana):                              │
│  · KafkaConsumerLagHigh: lag > 10000 for 5m                          │
│  · ServiceDown: up == 0 for 1m                                       │
│  · HighErrorRate: 5xx rate > 1% for 5m                               │
│  · SLABreachRisk: SLA remaining < 25%                                │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

┌─── Logs (Loki) ──────────────────────────────────────────────────────┐
│                                                                      │
│  Zap structured logging → stdout → Loki (Promtail collector)         │
│                                                                      │
│  Log format:                                                         │
│  {"level":"info","ts":"2025-01-15T10:30:00Z","caller":"handler/...", │
│   "msg":"equipment fetched","equipment_id":"eq-001",                 │
│   "request_id":"req-abc123","trace_id":"abc...","user_id":"u-001"}   │
│                                                                      │
│  Correlation: request_id + trace_id in mọi log entry                 │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

┌─── Traces (Jaeger) ──────────────────────────────────────────────────┐
│                                                                      │
│  OpenTelemetry SDK → Jaeger (OTLP exporter)                          │
│                                                                      │
│  Trace propagation: W3C Trace Context headers                        │
│  · traceparent: 00-<trace-id>-<span-id>-01                           │
│  · Propagated qua: HTTP headers, gRPC metadata, Kafka headers        │
│                                                                      │
│  Ví dụ trace: Frontend request → Gateway → Equipment → Sensor (gRPC) │
│  → Có thể thấy full call chain + timing breakdown trong Jaeger UI    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 10.2. Correlation ID Strategy

```
Mỗi request nhận 1 X-Request-ID (UUID) tại API Gateway:

Browser → [X-Request-ID: req-abc123] → Gateway
           → [X-Request-ID: req-abc123] → equipment-service
              → [X-Request-ID: req-abc123] → sensor-service (gRPC metadata)
                 → [X-Request-ID: req-abc123] → Kafka message header

→ Tìm kiếm req-abc123 trong Loki sẽ thấy log từ TẤT CẢ services involved
→ Tìm trace-id tương ứng trong Jaeger sẽ thấy call graph + timing
```

---

## 11. Deployment Topology

### 11.1. Development (Local)

```
Developer Workstation:
├── Docker Desktop
│   └── docker-compose.infra.yml
│       ├── PostgreSQL :5432
│       ├── TimescaleDB :5433
│       ├── InfluxDB :8086
│       ├── Redis :6379
│       ├── Kafka :9092 + Kafka UI :9093
│       ├── MinIO :9000/:9001
│       ├── Vault :8200
│       ├── Prometheus :9090
│       ├── Grafana :3000
│       └── Jaeger :16686
│
├── Go services (air hot reload) × 8-9 terminals
│   ├── api-gateway :8080
│   ├── auth-service :8081
│   ├── equipment-service :8082
│   ├── sensor-service :8083
│   ├── alert-service :8084
│   ├── workorder-service :8085
│   ├── ml-service :8086
│   ├── notification-service :8087
│   └── (optional) opcua-bridge :4840
│
└── Angular dev server
    └── ng serve :4200 (proxy /api → :8080)
```

**Tài nguyên cần: ~8-12 GB RAM, 8+ CPU cores**

### 11.2. Production (Kubernetes)

```
┌──── Kubernetes Cluster ──────────────────────────────────────────────┐
│                                                                      │
│  Namespace: maintenix-prod                                           │
│                                                                      │
│  ┌── Ingress ───────────────────────────────────────────────────────┐│
│  │  Nginx Ingress Controller (TLS termination, /api /ws /grpc /*)   ││
│  └──────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌── Deployments (HPA auto-scaling) ───────────────────────────────┐ │
│  │  api-gateway      2-10 replicas  (CPU target 70%)               │ │
│  │  auth-service     2-5  replicas  (CPU target 70%)               │ │
│  │  equipment-svc    2-5  replicas  (CPU target 70%)               │ │
│  │  sensor-svc       3-20 replicas  (CPU target 60%) ← highest     │ │
│  │  alert-svc        2-8  replicas  (CPU target 70%)               │ │
│  │  workorder-svc    2-5  replicas  (CPU target 70%)               │ │
│  │  ml-service       2-5  replicas  (CPU target 70%)               │ │
│  │  notification-svc 1    replica   (no auto-scale needed)         │ │
│  │  opcua-bridge     1    replica   (1:1 with PLC)                 │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌── StatefulSets (persistent volumes) ─────────────────────────────┐│
│  │  PostgreSQL (primary + replica, PVC)                             |│
│  │  TimescaleDB (primary + replica, PVC)                            ││
│  │  Redis Sentinel (3 nodes)                                        ││
│  │  Kafka (3 brokers, PVC per broker)                               |│ 
│  │  MinIO (distributed mode, 4 nodes)                               ││
│  │  Vault (HA mode, 3 nodes, Raft storage)                          ││
│  └──────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌── CI/CD ────────────────────────────────────────────────────────┐ │
│  │  GitHub Actions → Build → Push → ArgoCD (GitOps) → Auto-deploy  │ │
│  │  Kustomize overlays: dev / staging / production                 │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 12. Cross-cutting Concerns

### 12.1. Error Handling

Tất cả services trả về format thống nhất:

```
Success: { success: true, data: {...}, meta: {page, total}, requestId }
Error:   { success: false, error: {code, message, details}, requestId }

Error codes follow pattern: DOMAIN_ACTION_REASON
  · EQUIPMENT_NOT_FOUND
  · ALERT_ALREADY_ACKNOWLEDGED
  · AUTH_TOKEN_EXPIRED
  · SENSOR_THRESHOLD_EXCEEDED
  · WORKORDER_INVALID_TRANSITION
```

### 12.2. Pagination

```
Cursor-based (preferred cho time-series, large datasets):
  GET /api/sensors/SEN-001/data?cursor=2025-01-15T10:00:00Z&limit=100

Offset-based (cho CRUD listings):
  GET /api/equipment?page=1&pageSize=20&sort=name&order=asc

Response meta:
  { page: 1, pageSize: 20, total: 150, totalPages: 8 }
```

### 12.3. Idempotency

```
Kafka consumers:
  · Dedup key: message_id (UUID in Kafka header)
  · Dedup store: Redis SET with TTL 24h
  · Pattern: check dedup → process → ack → add to dedup set

REST mutations:
  · Client sends Idempotency-Key header
  · Gateway stores {key → response} in Redis (TTL 24h)
  · Duplicate request returns cached response
```

### 12.4. Configuration

```
Hierarchy (priority cao → thấp):
  1. Environment variables (12-factor)
  2. Vault secrets (dynamic, rotated)
  3. YAML config file (defaults)

Tool: Viper (spf13/viper) — tự động merge 3 sources
```

---

## 13. Chế Độ Lỗi & Khả Năng Chịu Lỗi

### 13.1. Điều gì xảy ra khi X bị sập?

| Thành phần bị sập | Ảnh hưởng | Biện pháp giảm thiểu |
|------------------|-----------|----------------------|
| **PostgreSQL** | Toàn bộ thao tác CRUD thất bại | Connection pool tự retry (pgx), read replica cho GET, dữ liệu cache trong Redis vẫn được phục vụ |
| **TimescaleDB** | Truy vấn dữ liệu cảm biến lịch sử thất bại | InfluxDB vẫn phục vụ truy vấn thời gian thực (7 ngày gần nhất), dashboard bị giảm chức năng |
| **InfluxDB** | Truy vấn cảm biến thời gian thực chậm hơn | Fallback sang TimescaleDB (độ trễ cao hơn một chút), việc nhận dữ liệu cảm biến vẫn tiếp tục vào TimescaleDB |
| **Redis** | Session không hợp lệ, cache miss → tăng truy vấn DB | Các service giảm cấp một cách nhẹ nhàng (không cache = chậm hơn), người dùng cần đăng nhập lại |
| **Kafka** | Pipeline sự kiện bị dừng | opcua-bridge lưu buffer cục bộ (file), các service retry với backoff. Quan trọng: cảnh báo bị trì hoãn đến khi Kafka phục hồi |
| **auth-service** | Không thể đăng nhập mới, không xác thực được token | Token hiện tại vẫn hợp lệ đến khi hết hạn (JWT tự chứa thông tin). Gateway cache token đã xác thực trong thời gian ngắn |
| **sensor-service** | Không nhận được dữ liệu cảm biến mới | Kafka buffer tin nhắn (retention cấu hình được: 7 ngày). Dữ liệu được xử lý khi service phục hồi |
| **alert-service** | Không tạo được cảnh báo mới | Kafka giữ lại các sự kiện sensor.processed. WebSocket ngắt kết nối, frontend chuyển sang polling REST |
| **ml-service** | Không có dự đoán AI | Cảnh báo vẫn hoạt động (dựa trên ngưỡng). Dự đoán ML tiếp tục khi service phục hồi |
| **api-gateway** | Frontend không thể kết nối backend | Nginx health check chuyển sang replica lành mạnh (nếu nhiều replica). Điểm lỗi duy nhất nếu chỉ có một replica |

### 13.2. Các Mẫu Chịu Lỗi

```
Circuit Breaker (mỗi gRPC client):
  · Ngưỡng: 5 lỗi trong 10 giây → mở circuit
  · Half-open sau 30 giây → thử 1 request
  · Reset khi thành công

Retry với Backoff:
  · gRPC: 3 lần retry, exponential backoff (100ms, 200ms, 400ms)
  · Kafka consumer: retry vô hạn với backoff (1s, 2s, 4s, tối đa 60s)
  · HTTP: 2 lần retry cho lỗi 5xx, không retry cho lỗi 4xx

Dead Letter Queue (DLQ):
  · Tin nhắn Kafka thất bại → maintenix.dlq.<topic-gốc>
  · Kiểm tra thủ công + replay qua admin endpoint
  · Cảnh báo khi số lượng tin nhắn DLQ > 0

Timeout:
  · HTTP handler: 30 giây (Gin)
  · gRPC call: 5 giây (mặc định), 30 giây (streaming)
  · Truy vấn database: 10 giây
  · Kafka produce: 5 giây
  · Redis operation: 1 giây
```

---

## 14. Các Cân Nhắc Về Khả Năng Mở Rộng

### 14.1. Phân Tích Điểm Nghẽn Cổ Chai

```
                    Mức Độ Có Khả Năng Nghẽn

  opcua-bridge        [███░░░░░░░]  Thấp — kết nối PLC đơn
  sensor-service      [████████░░]  CAO — 10K+ lượt ghi/giây, CPU cho phát hiện bất thường
  alert-service       [██████░░░░]  Trung bình — kiểm tra ngưỡng + kết nối WebSocket
  ml-service          [██████░░░░]  Trung bình — model inference bị giới hạn bởi CPU
  api-gateway         [█████░░░░░]  Trung bình — overhead proxy, tổng hợp KPI
  equipment-service   [██░░░░░░░░]  Thấp — CRUD thông thường
  workorder-service   [██░░░░░░░░]  Thấp — CRUD thông thường
  auth-service        [███░░░░░░░]  Thấp — xác thực token được cache
  notification-svc    [██░░░░░░░░]  Thấp — fire-and-forget
```

### 14.2. Chiến Lược Mở Rộng

```
sensor-service (điểm nghẽn chính):
  · Kafka consumer group: song song hóa theo partition
  · 12 partition → tối đa 12 instance consumer
  · InfluxDB ghi theo batch (1000 điểm/batch, flush mỗi 100ms)
  · TimescaleDB chunk_time_interval: 1 ngày (tối ưu nén dữ liệu)
  · Kích hoạt scale: Kafka consumer lag > 5000

alert-service:
  · Kết nối WebSocket: gorilla/websocket, 1 goroutine/kết nối
  · 10K kết nối WS đồng thời mỗi instance
  · Redis pub/sub để broadcast giữa các instance (khi có >1 replica)
  · Kích hoạt scale: số kết nối WebSocket > 8000

ml-service:
  · ONNX Runtime: batch inference (32 mẫu/batch)
  · Model được cache trong bộ nhớ (tránh fetch từ MinIO mỗi request)
  · Kích hoạt scale: độ trễ dự đoán p99 > 500ms
```
---

## 15. Sơ đồ tham chiếu nhanh

### 15.1. Port Map

| Port  | Service                | Protocol     |
|-------|------------------------|-------------|
| 80    | Nginx (HTTP)           | HTTP         |
| 443   | Nginx (HTTPS)          | HTTPS        |
| 4200  | Angular dev server     | HTTP         |
| 4840  | OPC-UA Bridge          | OPC-UA       |
| 5432  | PostgreSQL             | PostgreSQL   |
| 5433  | TimescaleDB            | PostgreSQL   |
| 6379  | Redis                  | Redis        |
| 8080  | API Gateway            | HTTP         |
| 8081  | Auth Service           | HTTP + gRPC  |
| 8082  | Equipment Service      | HTTP + gRPC  |
| 8083  | Sensor Service         | gRPC + Kafka |
| 8084  | Alert Service          | HTTP + WS    |
| 8085  | WorkOrder Service      | HTTP         |
| 8086  | ML Service / InfluxDB  | HTTP + gRPC  |
| 8087  | Notification Service   | Kafka only   |
| 8200  | Vault                  | HTTP         |
| 9000  | MinIO (API)            | HTTP         |
| 9001  | MinIO (Console)        | HTTP         |
| 9090  | Prometheus             | HTTP         |
| 9092  | Kafka                  | Kafka        |
| 9093  | Kafka UI               | HTTP         |
| 3000  | Grafana                | HTTP         |
| 3100  | Loki                   | HTTP         |
| 16686 | Jaeger                 | HTTP         |

