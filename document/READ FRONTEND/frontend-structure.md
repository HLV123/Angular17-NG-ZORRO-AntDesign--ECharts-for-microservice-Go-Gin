# Maintenix Frontend — Project Structure

> **Smart Predictive Maintenance Warning System**

---

## 1. Cấu trúc ban đầu (khi mở bằng VSCode)

```
maintenix-app/
│
├── angular.json
├── package.json
├── package-lock.json
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.app.json
└── src/
    ├── index.html
    ├── main.ts
    ├── styles.scss
    ├── assets/
    │   └── logo.png
    ├── environments/
    │   ├── environment.ts
    │   └── environment.prod.ts
    └── app/
        ├── app.component.ts
        ├── app.routes.ts
        ├── core/
        │   ├── models/
        │   │   └── index.ts
        │   ├── mock/
        │   │   └── mock-data.ts
        │   ├── guards/
        │   │   ├── auth.guard.ts
        │   │   └── role.guard.ts
        │   └── services/
        │       ├── auth.service.ts
        │       └── api.service.ts
        ├── layouts/
        │   └── main-layout.component.ts
        └── modules/
            ├── auth/
            │   └── login.component.ts
            ├── dashboard/
            │   └── dashboard.component.ts
            ├── equipment/
            │   ├── equipment.component.ts
            │   └── equipment-detail.component.ts
            ├── sensors/
            │   └── sensors.component.ts
            ├── alerts/
            │   ├── alerts.component.ts
            │   └── alert-detail.component.ts
            ├── maintenance/
            │   └── maintenance.component.ts
            ├── work-orders/
            │   ├── work-orders.component.ts
            │   └── work-order-detail.component.ts
            ├── spare-parts/
            │   └── spare-parts.component.ts
            ├── ai-models/
            │   └── ai-models.component.ts
            ├── reports/
            │   └── reports.component.ts
            ├── users/
            │   └── users.component.ts
            ├── settings/
            │   └── settings.component.ts
            └── profile/
                └── profile.component.ts
```

**Tổng cộng: 34 files** (không tính `package-lock.json`).


---

## 2. Cài đặt và các file được sinh thêm

### Bước 1 — Cài dependencies

```bash
npm install
```

Sau khi chạy xong, cấu trúc project thêm:

```
maintenix-app/
│
├── node_modules/                          ← ~800+ thư mục packages
│   ├── @angular/
│   └── ...                                ← hàng trăm sub-dependencies khác
│
├── .angular/                              ← Angular CLI cache (ẩn)
│   └── cache/
│       └── 17.3.x/
│           └── ...
│
├── angular.json
├── package.json
├── package-lock.json
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.app.json
├── nghiệp vụ.md
│
└── src/
    └── (giữ nguyên như trên)
```

### Bước 2 — Chạy dev server

```bash
ng serve
```

hoặc

```bash
npm start
```

Ttạo thêm bên trong `.angular/cache/`:

```
.angular/
└── cache/
    └── 17.3.x/
        ├── babel-webpack/
        ├── vite/
        │   └── deps/
        │       ├── chunk-xxx.js
        │       ├── ng-zorro-antd_*.js
        │       ├── ngx-echarts.js
        │       └── ...
        └── ...
```

### Bước 3 (tùy chọn) — Build production

```bash
ng build --configuration production
```

Sinh thêm:

```
maintenix-app/
│
├── dist/
│   └── maintenix-app/
│       └── browser/
│           ├── index.html
│           ├── main-[hash].js
│           ├── polyfills-[hash].js
│           ├── styles-[hash].css
│           ├── chunk-[hash].js          ← lazy-loaded modules
│           ├── chunk-[hash].js
│           ├── chunk-[hash].js
│           ├── ...
│           └── assets/
│               └── logo.png
│
└── (phần còn lại giữ nguyên)
```

---

## 4. Chạy và trải nghiệm trên trình duyệt

```bash
# 1. Cài đặt dependencies
npm install

# 2. Khởi chạy dev server
ng serve
# hoặc
npm start

# 3. Mở trình duyệt
# → http://localhost:4200
```

### Đăng nhập

| Username       | Password | Vai trò              |
|----------------|----------|----------------------|
| `admin`        | `123456` | Super Admin          |
| `manager`      | `123456` | Factory Manager      |
| `engineer`     | `123456` | Maintenance Engineer |
| `technician`   | `123456` | Technician           |
| `datascientist`| `123456` | Data Scientist       |
| `maint_mgr`   | `123456` | Maintenance Manager  |
| `inspector`    | `123456` | Quality Inspector    |
| `viewer`       | `123456` | Viewer               |

Mỗi vai trò sẽ thấy menu sidebar khác nhau dựa trên phân quyền RBAC.

### Các trang có thể trải nghiệm

| Route                | Module               | Nội dung chính                                     |
|----------------------|----------------------|----------------------------------------------------|
| `/dashboard`         | Dashboard            | KPI, sơ đồ nhà máy, cảnh báo live, OEE gauge, RUL, Gantt mini |
| `/equipment`         | Equipment            | Danh sách 10 thiết bị, filter, search, health score |
| `/equipment/:id`     | Equipment Detail     | Thông số, sensor real-time, AI predictions, lịch sử bảo trì |
| `/sensors`           | Sensors              | 12 sensor grid, sparkline, multi-chart, anomaly heatmap |
| `/alerts`            | Alerts               | 8 cảnh báo, filter severity/status/type, acknowledge |
| `/alerts/:id`        | Alert Detail         | SLA countdown, AI analysis, SHAP, counterfactual, timeline |
| `/maintenance`       | Maintenance          | Gantt chart, calendar, AI recommendations, PM templates |
| `/work-orders`       | Work Orders          | Kanban board 4 cột, danh sách, filter               |
| `/work-orders/:id`   | Work Order Detail    | Checklist, cost tracking, work log, safety LOTO/PPE  |
| `/spare-parts`       | Spare Parts          | Kho linh kiện, AI demand forecast, auto-reorder, order tracking |
| `/ai-models`         | AI/ML Models         | Model registry, performance charts, A/B testing, pipelines |
| `/reports`           | Reports              | OEE dashboard, maintenance cost, reliability, PM compliance, AI ROI |
| `/users`             | Users                | Danh sách 8 user, RBAC matrix, login activity chart  |
| `/settings`          | Settings             | Cấu hình nhà máy, tích hợp backend, SLA, audit log  |
| `/profile`           | Profile              | Hồ sơ cá nhân, kỹ năng, cài đặt thông báo, bảo mật |

---

## 5. Tương thích Backend — Mapping chi tiết

### 5.1. Environment Configuration

```
src/environments/environment.ts       → Dev endpoints
src/environments/environment.prod.ts  → Production endpoints (behind Nginx reverse proxy)
```

| Frontend Config   | Backend Service                    | Protocol     |
|-------------------|------------------------------------|-------------|
| `apiBaseUrl`      | Go/Java REST API Gateway           | REST/HTTP    |
| `wsUrl`           | WebSocket STOMP Broker (qua Kafka) | WebSocket    |
| `grpcUrl`         | Sensor & ML gRPC Services          | gRPC-Web     |
| `kafkaWsProxy`    | Kafka WebSocket Proxy              | WebSocket    |

### 5.2. API Service → Backend Endpoint Mapping

| Frontend Method (api.service.ts)      | Backend REST Endpoint        | Database             |
|---------------------------------------|------------------------------|----------------------|
| `getKPI()`                            | `GET /api/dashboard/kpi`     | PostgreSQL + Redis   |
| `getEquipment()`                      | `GET /api/equipment`         | PostgreSQL           |
| `getEquipmentById(id)`                | `GET /api/equipment/:id`     | PostgreSQL           |
| `getSensors()`                        | `GET /api/sensors`           | TimescaleDB          |
| `streamSensorData(sensorId)`          | `gRPC StreamSensorData`      | InfluxDB (real-time) |
| `getSensorTimeSeries(id, hours)`      | `GET /api/sensors/:id/data`  | TimescaleDB          |
| `getAlerts()`                         | `GET /api/alerts`            | PostgreSQL           |
| `acknowledgeAlert(id, userId)`        | `PUT /api/alerts/:id/ack`    | PostgreSQL           |
| `subscribeAlerts()`                   | `STOMP /topic/factory-alerts`| Apache Kafka         |
| `getWorkOrders()`                     | `GET /api/work-orders`       | PostgreSQL           |
| `getMaintenanceSchedules()`           | `GET /api/maintenance`       | PostgreSQL           |
| `getSpareParts()`                     | `GET /api/spare-parts`       | PostgreSQL           |
| `getAIModels()`                       | `GET /api/models`            | PostgreSQL           |
| `getPipelines()`                      | `gRPC Kubeflow Pipelines`    | PostgreSQL           |
| `getUsers()`                          | `GET /api/users`             | PostgreSQL           |
| `getAuditLogs()`                      | `GET /api/audit`             | PostgreSQL           |
| `getOEEHistory()`                     | `GET /api/reports/oee`       | TimescaleDB          |
| `getMaintenanceCostHistory()`         | `GET /api/reports/cost`      | PostgreSQL           |

### 5.3. Auth Service → Backend Auth Stack

| Frontend                          | Backend                                       |
|-----------------------------------|-----------------------------------------------|
| `login(username, password)`       | `POST /api/auth/login` → JWT + Refresh Token  |
| `logout()`                        | `POST /api/auth/logout` → Revoke token        |
| `token` (Bearer header)          | JWT signed bằng RSA (HashiCorp Vault key)     |
| `localStorage` (mock)            | HttpOnly Cookie / Secure Token Storage        |
| `AuthGuard`                       | Backend: JWT middleware trên mỗi request       |
| `RoleGuard` (route-level RBAC)   | Backend: RBAC middleware + Casbin/OPA policy   |

OAuth 2.0 / OIDC flow sẽ thay thế mock login khi kết nối backend thực.

### 5.4. Domain Models → Database Schema

| Model (models/index.ts) | Primary DB      | Caching    | Event Bus  |
|--------------------------|-----------------|------------|------------|
| `User`                   | PostgreSQL      | Redis      | —          |
| `Equipment`              | PostgreSQL      | Redis      | Kafka      |
| `Sensor`                 | TimescaleDB     | Redis      | Kafka      |
| `SensorReading`          | InfluxDB        | —          | Kafka      |
| `Alert`                  | PostgreSQL      | Redis      | Kafka      |
| `WorkOrder`              | PostgreSQL      | —          | Kafka      |
| `MaintenanceSchedule`    | PostgreSQL      | —          | —          |
| `SparePart`              | PostgreSQL      | Redis      | —          |
| `AIModel`                | PostgreSQL      | —          | Kafka      |
| `Pipeline`               | PostgreSQL      | —          | Kafka      |
| `KPIData`                | TimescaleDB     | Redis      | —          |
| `AuditLog`               | PostgreSQL      | —          | Kafka      |

### 5.5. Real-time Data Flow

```
┌─────────────┐    OPC-UA     ┌──────────────┐    Kafka     ┌──────────────┐
│  PLC/SCADA  │ ──────────→   │  OPC-UA      │ ──────────→  │  Apache      │
│  (Sensors)  │               │  Bridge      │              │  Kafka       │
└─────────────┘               └──────────────┘              └──────┬───────┘
                                                                   │
                           ┌───────────────────────────────────────┼───────┐
                           │                                       │       │
                           ▼                                       ▼       ▼
                    ┌──────────────┐                    ┌──────────┐ ┌─────────┐
                    │  TimescaleDB │                    │ InfluxDB │ │ AI/ML   │
                    │  (history)   │                    │ (rt)     │ │ SageMak │
                    └──────────────┘                    └──────────┘ └────┬────┘
                                                                          │
                    ┌──────────────────────────────────────────────────┐  │
                    │              Backend API Gateway                 │←─┘
                    │   REST · gRPC · WebSocket STOMP · GraphQL        │
                    └────────────────────┬────────────────────────────-┘
                                         │
                          ┌──────────────┼──────────────┐
                          │  Nginx (Reverse Proxy / LB) │
                          └──────────────┬──────────────┘
                                         │
                          ┌──────────────┼──────────────┐
                          │      Frontend (Angular)     │
                          │   api.service.ts endpoints  │
                          │   ← ĐANG Ở ĐÂY (mock data)  │
                          └─────────────────────────────┘
```

### 5.6. Chuyển từ Mock sang Backend thật

Chỉ cần thay đổi **1 file duy nhất**: `src/app/core/services/api.service.ts`

Thay các `of(MOCK_DATA).pipe(delay(...))` bằng `this.http.get<T>(...)`:

```typescript
// Mock (hiện tại):
getEquipment(): Observable<Equipment[]> {
  return of(MOCK_EQUIPMENT).pipe(delay(400));
}

// Production (khi có backend):
getEquipment(): Observable<Equipment[]> {
  return this.http.get<Equipment[]>(`${environment.apiBaseUrl}/equipment`);
}
```

Tương tự cho `auth.service.ts` — thay mock JWT bằng call thực tới `/api/auth/login`.

### 5.7. Infrastructure Mapping (Settings page)

| Integration (settings.component.ts) | Backend Service                   | Port  |
|--------------------------------------|-----------------------------------|-------|
| Apache Kafka                         | Event streaming, sensor ingestion | 9092  |
| TimescaleDB                          | Time-series sensor data           | 5432  |
| PostgreSQL                           | Master data, work orders, users   | 5432  |
| Redis                                | Cache, session, real-time state   | 6379  |
| HashiCorp Vault                      | Secret management, JWT keys       | 8200  |
| MinIO                                | File storage (manuals, photos)    | 9000  |
| Prometheus                           | Metrics collection                | 9090  |
| Grafana                              | Infrastructure monitoring         | 3000  |
| Jaeger                               | Distributed tracing               | 16686 |
| OPC-UA Bridge                        | SCADA/DCS → Kafka integration     | 4840  |

### 5.8. Deployment (Production)

```
┌── Docker Compose / Kubernetes ──────────────────┐
│                                                 │
│  ┌─────────────────────┐   ┌──────────────────┐ │
│  │   Nginx Container   │   │  Frontend Dist   │ │
│  │   (reverse proxy)   │──→│  (static files)  │ │
│  │                     │   └──────────────────┘ │
│  │   /api  → backend   │                        │
│  │   /ws   → stomp     │   ┌──────────────────┐ │
│  │   /grpc → grpc-web  │──→│  Backend API     │ │
│  │   /*    → frontend  │   │  (Go/Java/Node)  │ │
│  └─────────────────────┘   └──────────────────┘ │
│                                                 │
│  ArgoCD (GitOps) → Kubernetes → Auto Deploy     │
└─────────────────────────────────────────────────┘
```

`environment.prod.ts` dùng relative paths (`/api`, `/ws`, `/grpc`) để Nginx proxy tới backend containers tương ứng.

---

## 6. Tech Stack tóm tắt

| Layer       | Thư viện hiện có trong package.json           |
|-------------|-----------------------------------------------|
| Framework   | Angular 17.3+ (standalone components)         |
| UI Library  | ng-zorro-antd 17.3 (Ant Design for Angular)   |
| Charts      | ECharts 5.5 + ngx-echarts 17.1                |
| Styling     | Tailwind CSS 3.4 + SCSS                       |
| Drag & Drop | @angular/cdk (DragDropModule)                 |
| State       | RxJS 7.8 (BehaviorSubject pattern)            |
| Font        | DM Sans + JetBrains Mono (Google Fonts)       |
| Icons       | Font Awesome 6.5 (CDN)                        |
| Locale      | vi_VN (ng-zorro i18n)                         |

