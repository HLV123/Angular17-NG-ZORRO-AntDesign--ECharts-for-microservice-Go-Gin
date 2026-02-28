# Maintenix — RBAC Matrix

> **Smart Predictive Maintenance Warning System**
> Ma trận phân quyền chi tiết cho 8 roles × tất cả resources/actions.
> Tài liệu này là **single source of truth** cho: Frontend (route guard, sidebar), Backend (Casbin policies), Database (row-level filtering).

---

## Mục lục

1. [Tổng quan RBAC](#1-tổng-quan-rbac)
2. [Định nghĩa 8 Roles](#2-định-nghĩa-8-roles)
3. [Ma trận Sidebar / Route Access (Frontend)](#3-ma-trận-sidebar--route-access-frontend)
4. [Ma trận API Endpoint Permissions (Backend)](#4-ma-trận-api-endpoint-permissions-backend)
5. [Ma trận CRUD chi tiết theo Resource](#5-ma-trận-crud-chi-tiết-theo-resource)
6. [Ma trận Action-level Permissions](#6-ma-trận-action-level-permissions)
7. [Row-level Data Filtering (Layer 3)](#7-row-level-data-filtering-layer-3)
8. [Casbin Policy Definitions](#8-casbin-policy-definitions)
9. [Frontend Role Groups (app.routes.ts)](#9-frontend-role-groups-approutests)
10. [Audit Trail Requirements](#10-audit-trail-requirements)
11. [Escalation & Delegation Matrix](#11-escalation--delegation-matrix)
12. [Quick Reference — Ai được làm gì?](#12-quick-reference--ai-được-làm-gì)

---

## 1. Tổng quan RBAC

### 1.1. Mô hình 3 lớp

Maintenix sử dụng RBAC 3 lớp, mỗi lớp enforce tại vị trí khác nhau:

```
┌─── Layer 1: UI Navigation (Frontend) ──────────────────────────────────────┐
│                                                                            │
│  Vị trí:   role.guard.ts, main-layout.component.ts (sidebar)               │
│  Cách:     Ẩn/hiện menu items, block route navigation                      │
│  Mục đích: UX — không show chức năng user không có quyền                   │
│  Lưu ý:    KHÔNG phải security boundary — bypass được qua URL/DevTools     │
│                                                                            │
├─── Layer 2: API Endpoint (Backend) ────────────────────────────────────────┤
│                                                                            │
│  Vị trí:   Casbin middleware trong API Gateway + mỗi service handler       │
│  Cách:     Check role + endpoint + HTTP method → ALLOW / DENY (403)        │
│  Mục đích: Real security boundary — enforce bất kể frontend gửi gì         │
│  Lưu ý:    JWT claims chứa role, Casbin load policies từ PostgreSQL        │
│                                                                            │
├─── Layer 3: Data Row/Column (Repository) ──────────────────────────────────┤
│                                                                            │
│  Vị trí:   Repository layer (WHERE clause, column projection)              │
│  Cách:     Filter data theo department, assignment, production line        │
│  Mục đích: Fine-grained — cùng endpoint nhưng data khác nhau theo role     │
│  Lưu ý:    Technician chỉ thấy WO assigned cho mình, Manager thấy tất cả   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 1.2. Permission Format

```
resource:action

Ví dụ:
  equipment:read        → Xem danh sách/chi tiết thiết bị
  alert:write           → Tạo/sửa/acknowledge cảnh báo
  workorder:create      → Tạo lệnh công việc mới
  user:delete           → Xóa/khóa tài khoản người dùng
  model:deploy          → Deploy AI model lên production
  settings:write        → Thay đổi cấu hình hệ thống
```

---

## 2. Định nghĩa 8 Roles

| # | Role Code | Tên hiển thị | Department | Mô tả chức năng | User mẫu |
|---|-----------|-------------|------------|------------------|----------|
| 1 | `super_admin` | Quản trị viên | IT | Toàn quyền hệ thống: quản lý user, cấu hình, audit logs | U001 — Nguyễn Văn Admin |
| 2 | `factory_manager` | Quản đốc nhà máy | Quản lý Nhà máy | Giám sát KPI, phê duyệt ngân sách, xem báo cáo tổng hợp, quản lý nhân sự | U002 — Trần Thị Lan |
| 3 | `maintenance_manager` | Trưởng phòng Bảo trì | Bảo trì | Phê duyệt work order, lập lịch bảo trì, quản lý team, cấu hình SLA | U008 — Vũ Đình Hùng |
| 4 | `maintenance_engineer` | Kỹ sư Bảo trì | Bảo trì | Phân tích alert, tạo work order, giám sát AI/ML, xử lý sự cố kỹ thuật | U003 — Lê Minh Khoa |
| 5 | `technician` | Kỹ thuật viên | Bảo trì | Thực hiện work order, checklist, ghi nhật ký công việc, báo cáo linh kiện | U004 — Phạm Anh Tuấn |
| 6 | `data_scientist` | Chuyên gia AI/ML | AI/ML | Quản lý model registry, pipeline, đánh giá model, A/B testing | U005 — Hoàng Dũng |
| 7 | `quality_inspector` | Kiểm soát Chất lượng | QC | Xác minh work order hoàn thành, kiểm tra tuân thủ PM, báo cáo chất lượng | U006 — Ngô Thị Mai |
| 8 | `viewer` | Người xem | Sản xuất | Chỉ đọc dashboard, thiết bị, cảm biến — không có quyền ghi | U007 — Đào Thanh Sơn |

### Hierarchy (Thừa kế quyền)

```
super_admin ─────────────────────── Toàn quyền
    │
    ├── factory_manager ──────────── Quản lý + đọc tất cả
    │       │
    │       └── maintenance_manager ── Bảo trì + nhân sự team
    │               │
    │               ├── maintenance_engineer ── Kỹ thuật + tạo WO
    │               │       │
    │               │       └── technician ──── Thực hiện WO
    │               │
    │               └── quality_inspector ──── Kiểm tra + xác minh
    │
    └── data_scientist ──────────── AI/ML domain riêng biệt
    │
    └── viewer ──────────────────── Chỉ đọc
```

> **Lưu ý:** Hierarchy mang tính logic, KHÔNG phải inheritance tự động trong Casbin. Mỗi role được define permission riêng biệt (explicit > implicit).

---

## 3. Ma trận Sidebar / Route Access (Frontend)

**Layer 1 — Chỉ là UX, không phải security.**

Tham chiếu: `src/app/layouts/main-layout.component.ts` + `src/app/app.routes.ts`

| Menu / Route | Icon | super_admin | factory_manager | maint_manager | maint_engineer | technician | data_scientist | quality_inspector | viewer |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Dashboard `/dashboard` | `fa-gauge-high` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Quản lý Thiết bị `/equipment` | `fa-gears` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Giám sát Sensor `/sensors` | `fa-microchip` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Quản lý Cảnh báo `/alerts` | `fa-triangle-exclamation` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Lập lịch Bảo trì `/maintenance` | `fa-calendar-check` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Lệnh Công việc `/work-orders` | `fa-clipboard-list` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Kho Linh kiện `/spare-parts` | `fa-warehouse` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Quản lý AI/ML `/ai-models` | `fa-brain` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Báo cáo & Phân tích `/reports` | `fa-chart-pie` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Quản lý Người dùng `/users` | `fa-users` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Cấu hình Hệ thống `/settings` | `fa-sliders` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Hồ sơ Cá nhân `/profile` | `fa-user` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Frontend Role Groups (từ app.routes.ts)

```typescript
const ALL_ROLES    = ['super_admin', 'factory_manager', 'maintenance_manager',
                      'maintenance_engineer', 'technician', 'data_scientist',
                      'quality_inspector', 'viewer'];

const OPS_ROLES    = ['super_admin', 'factory_manager', 'maintenance_manager',
                      'maintenance_engineer', 'technician', 'quality_inspector', 'viewer'];
// ↳ Tất cả trừ data_scientist

const MAINT_ROLES  = ['super_admin', 'factory_manager', 'maintenance_manager',
                      'maintenance_engineer', 'technician'];
// ↳ Maintenance chain + managers

const WO_ROLES     = ['super_admin', 'factory_manager', 'maintenance_manager',
                      'maintenance_engineer', 'technician', 'quality_inspector'];
// ↳ Work order stakeholders (bao gồm QC để verify)

const REPORT_ROLES = ['super_admin', 'factory_manager', 'maintenance_manager',
                      'data_scientist', 'quality_inspector', 'viewer'];
// ↳ Reporting & analytics consumers

const AI_ROLES     = ['super_admin', 'data_scientist'];
// ↳ AI/ML management

const ADMIN_ROLES  = ['super_admin'];
// ↳ System administration
```

---

## 4. Ma trận API Endpoint Permissions (Backend)

**Layer 2 — Real security boundary. Casbin enforce tại đây.**

### 4.1. Auth — `/api/auth`

| Endpoint | Method | super_admin | factory_manager | maint_manager | maint_engineer | technician | data_scientist | quality_inspector | viewer |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `/api/auth/login` | POST | 🔓 | 🔓 | 🔓 | 🔓 | 🔓 | 🔓 | 🔓 | 🔓 |
| `/api/auth/refresh` | POST | 🔓 | 🔓 | 🔓 | 🔓 | 🔓 | 🔓 | 🔓 | 🔓 |
| `/api/auth/logout` | POST | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/auth/me` | GET | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

> 🔓 = Public (không cần JWT)

### 4.2. Users — `/api/users`

| Endpoint | Method | super_admin | factory_manager | maint_manager | maint_engineer | technician | data_scientist | quality_inspector | viewer |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `/api/users` | GET | ✅ | 👁️ | 👁️ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/api/users/:id` | GET | ✅ | 👁️ | 👁️ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/api/users` | POST | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/api/users/:id` | PUT | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/api/users/:id` | DELETE | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/api/users/:id/profile` | PUT | ✅ᐩ | ✅ᐩ | ✅ᐩ | ✅ᐩ | ✅ᐩ | ✅ᐩ | ✅ᐩ | ✅ᐩ |

> ✅ = Full access, 👁️ = Read-only, ❌ = Denied, ✅ᐩ = Chỉ bản thân (self-only)

### 4.3. Audit Logs — `/api/audit`

| Endpoint | Method | super_admin | factory_manager | maint_manager | maint_engineer | technician | data_scientist | quality_inspector | viewer |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `/api/audit` | GET | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

### 4.4. Equipment — `/api/equipment`

| Endpoint | Method | super_admin | factory_manager | maint_manager | maint_engineer | technician | data_scientist | quality_inspector | viewer |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `/api/equipment` | GET | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/equipment/:id` | GET | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/equipment` | POST | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/api/equipment/:id` | PUT | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/api/equipment/:id` | DELETE | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/api/equipment/:id/health` | GET | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/equipment/:id/history` | GET | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### 4.5. Spare Parts — `/api/spare-parts`

| Endpoint | Method | super_admin | factory_manager | maint_manager | maint_engineer | technician | data_scientist | quality_inspector | viewer |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `/api/spare-parts` | GET | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| `/api/spare-parts/:id` | GET | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| `/api/spare-parts` | POST | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/api/spare-parts/:id` | PUT | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/api/spare-parts/:id` | DELETE | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

### 4.6. Maintenance Schedules — `/api/maintenance`

| Endpoint | Method | super_admin | factory_manager | maint_manager | maint_engineer | technician | data_scientist | quality_inspector | viewer |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `/api/maintenance` | GET | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| `/api/maintenance/:id` | GET | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| `/api/maintenance` | POST | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/api/maintenance/:id` | PUT | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/api/maintenance/:id/approve` | PUT | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/api/maintenance/:id` | DELETE | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

### 4.7. Sensors — `/api/sensors`

| Endpoint | Method | super_admin | factory_manager | maint_manager | maint_engineer | technician | data_scientist | quality_inspector | viewer |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `/api/sensors` | GET | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/sensors/:id` | GET | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/sensors/:id/data` | GET | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/sensors/:id/anomalies` | GET | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/sensors/by-equipment/:id` | GET | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### 4.8. Alerts — `/api/alerts`

| Endpoint | Method | super_admin | factory_manager | maint_manager | maint_engineer | technician | data_scientist | quality_inspector | viewer |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `/api/alerts` | GET | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/alerts/:id` | GET | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/alerts/:id/acknowledge` | PUT | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/api/alerts/:id/assign` | PUT | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/api/alerts/:id/resolve` | PUT | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/api/alerts/:id/escalate` | PUT | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/api/alerts/:id/close` | PUT | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/api/alerts/sla-config` | GET | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/api/alerts/sla-config` | PUT | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### 4.9. Work Orders — `/api/work-orders`

| Endpoint | Method | super_admin | factory_manager | maint_manager | maint_engineer | technician | data_scientist | quality_inspector | viewer |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `/api/work-orders` | GET | ✅ | ✅ | ✅ | ✅ | ✅ᶠ | ❌ | ✅ | ❌ |
| `/api/work-orders/:id` | GET | ✅ | ✅ | ✅ | ✅ | ✅ᶠ | ❌ | ✅ | ❌ |
| `/api/work-orders` | POST | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/api/work-orders/:id` | PUT | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/api/work-orders/:id/status` | PUT | ✅ | ✅ | ✅ | ✅ | ✅ᶠ | ❌ | ✅ᵛ | ❌ |
| `/api/work-orders/:id/checklist/:itemId` | PUT | ✅ | ❌ | ❌ | ✅ | ✅ᶠ | ❌ | ❌ | ❌ |
| `/api/work-orders/:id/logs` | POST | ✅ | ✅ | ✅ | ✅ | ✅ᶠ | ❌ | ✅ | ❌ |
| `/api/work-orders/:id/logs` | GET | ✅ | ✅ | ✅ | ✅ | ✅ᶠ | ❌ | ✅ | ❌ |

> ✅ᶠ = Filtered — Technician chỉ thấy/thao tác work orders assigned cho mình (Layer 3)
> ✅ᵛ = Verify only — Quality Inspector chỉ được chuyển `completed → verified`

### 4.10. AI Models — `/api/models`

| Endpoint | Method | super_admin | factory_manager | maint_manager | maint_engineer | technician | data_scientist | quality_inspector | viewer |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `/api/models` | GET | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `/api/models/:id` | GET | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `/api/models` | POST | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `/api/models/:id` | PUT | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `/api/models/:id/deploy` | POST | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `/api/models/:id/deprecate` | PUT | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |

### 4.11. Pipelines — `/api/pipelines`

| Endpoint | Method | super_admin | factory_manager | maint_manager | maint_engineer | technician | data_scientist | quality_inspector | viewer |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `/api/pipelines` | GET | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `/api/pipelines` | POST | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `/api/pipelines/:id/cancel` | PUT | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |

### 4.12. Dashboard — `/api/dashboard`

| Endpoint | Method | super_admin | factory_manager | maint_manager | maint_engineer | technician | data_scientist | quality_inspector | viewer |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `/api/dashboard/kpi` | GET | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/dashboard/charts` | GET | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### 4.13. Reports — `/api/reports`

| Endpoint | Method | super_admin | factory_manager | maint_manager | maint_engineer | technician | data_scientist | quality_inspector | viewer |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `/api/reports` | GET | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/api/reports/generate` | POST | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/api/reports/export` | GET | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |

### 4.14. Settings — `/api/settings`

| Endpoint | Method | super_admin | factory_manager | maint_manager | maint_engineer | technician | data_scientist | quality_inspector | viewer |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `/api/settings` | GET | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/api/settings` | PUT | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 5. Ma trận CRUD chi tiết theo Resource

Tổng hợp nhanh: ai được Create / Read / Update / Delete trên mỗi resource.

| Resource | C | R | U | D |
|----------|---|---|---|---|
| **Users** | `admin` | `admin`, `factory_mgr`(RO), `maint_mgr`(RO) | `admin` (all), self (profile) | `admin` |
| **Equipment** | `admin`, `factory_mgr`, `maint_mgr` | All roles | `admin`, `factory_mgr`, `maint_mgr` | `admin` |
| **Spare Parts** | `admin`, `factory_mgr`, `maint_mgr` | OPS_ROLES | `admin`, `factory_mgr`, `maint_mgr` | `admin` |
| **Maint. Schedule** | `admin`, `factory_mgr`, `maint_mgr` | MAINT_ROLES + `inspector` | `admin`, `factory_mgr`, `maint_mgr` | `admin` |
| **Sensors** | — (auto từ OPC-UA) | All roles | — (auto update) | — |
| **Alerts** | — (auto từ sensor/ML) | All roles | `engineer`+ (ack/assign/resolve) | — |
| **Work Orders** | `admin`, `factory_mgr`, `maint_mgr`, `engineer` | WO_ROLES (tech filtered) | `engineer`+, `tech`(assigned), `inspector`(verify) | — |
| **AI Models** | `admin`, `data_scientist` | `admin`, `factory_mgr`, `maint_mgr`, `engineer`, `data_scientist` | `admin`, `data_scientist` | — |
| **Pipelines** | `admin`, `data_scientist` | `admin`, `data_scientist` | `admin`, `data_scientist` | — |
| **Reports** | `admin`, `factory_mgr`, `maint_mgr` | REPORT_ROLES | — | — |
| **Audit Logs** | — (auto-generated) | `admin`, `factory_mgr` | — | — |
| **Settings** | — | `admin` | `admin` | — |

---

## 6. Ma trận Action-level Permissions

Các action đặc biệt ngoài CRUD cơ bản.

### 6.1. Alert Actions

| Action | Mô tả | Roles được phép | Điều kiện |
|--------|-------|-----------------|-----------|
| **Acknowledge** | Xác nhận đã nhận cảnh báo | `admin`, `factory_mgr`, `maint_mgr`, `engineer` | Alert ở trạng thái `open` |
| **Assign** | Giao cho technician/engineer xử lý | `admin`, `factory_mgr`, `maint_mgr`, `engineer` | Alert ở trạng thái `open` hoặc `acknowledged` |
| **Resolve** | Đánh dấu đã xử lý xong | `admin`, `factory_mgr`, `maint_mgr`, `engineer`, `technician` | Alert ở trạng thái `in_progress` |
| **Escalate** | Chuyển lên manager | `admin`, `factory_mgr`, `maint_mgr`, `engineer` | Alert chưa `resolved/closed` |
| **Close** | Đóng vĩnh viễn | `admin`, `factory_mgr`, `maint_mgr` | Alert ở trạng thái `resolved` |
| **Update SLA Config** | Cấu hình SLA response time | `admin`, `maint_mgr` | — |

### 6.2. Work Order Actions (FSM Transitions)

| Transition | Mô tả | Roles được phép |
|------------|-------|-----------------|
| `draft → submitted` | Gửi duyệt | Creator (`engineer`+) |
| `submitted → approved` | Phê duyệt | `admin`, `factory_mgr`, `maint_mgr` |
| `approved → scheduled` | Xếp lịch | `admin`, `maint_mgr` |
| `scheduled → assigned` | Giao việc | `admin`, `maint_mgr`, `engineer` |
| `assigned → in_progress` | Bắt đầu | `engineer`, `technician` (assigned) |
| `in_progress → pending_parts` | Chờ linh kiện | `engineer`, `technician` (assigned) |
| `pending_parts → in_progress` | Có linh kiện, tiếp tục | `engineer`, `technician` (assigned) |
| `in_progress → completed` | Hoàn thành (checklist 100%) | `engineer`, `technician` (assigned) |
| `completed → verified` | Xác minh chất lượng | `admin`, `quality_inspector` |
| `verified → closed` | Đóng vĩnh viễn | `admin`, `factory_mgr`, `maint_mgr` |
| `completed → in_progress` | Mở lại (rework) | `admin`, `maint_mgr`, `quality_inspector` |

### 6.3. AI Model Actions

| Action | Mô tả | Roles được phép |
|--------|-------|-----------------|
| **Register** | Đăng ký model mới | `admin`, `data_scientist` |
| **Train** | Trigger training pipeline | `admin`, `data_scientist` |
| **Deploy** | Deploy lên production | `admin`, `data_scientist` |
| **Deprecate** | Đánh dấu deprecated | `admin`, `data_scientist` |
| **Archive** | Lưu trữ (không dùng nữa) | `admin`, `data_scientist` |
| **Monitor Drift** | Xem drift metrics | `admin`, `data_scientist`, `engineer` |

### 6.4. Maintenance Schedule Actions

| Action | Mô tả | Roles được phép |
|--------|-------|-----------------|
| **Create** | Tạo lịch bảo trì mới | `admin`, `factory_mgr`, `maint_mgr` |
| **Approve** | Phê duyệt lịch `planned → in_progress` | `admin`, `factory_mgr`, `maint_mgr` |
| **Complete** | Đánh dấu hoàn thành | `admin`, `maint_mgr`, `engineer` |
| **Accept AI Recommendation** | Chấp nhận lịch do AI đề xuất | `admin`, `maint_mgr` |

---

## 7. Row-level Data Filtering (Layer 3)

**Layer 3 — Cùng endpoint, cùng API nhưng data trả về khác nhau theo role/context.**

### 7.1. Filtering Rules

| Resource | Role | Filter Rule |
|----------|------|-------------|
| **Work Orders** | `technician` | `WHERE assigned_to = current_user.id` — Chỉ thấy WO giao cho mình |
| **Work Orders** | `maintenance_engineer` | `WHERE department = current_user.department` — Thấy WO trong department |
| **Work Orders** | `maintenance_manager` | Tất cả WO trong department mình quản lý |
| **Work Orders** | `factory_manager`, `admin` | Tất cả WO (không filter) |
| **Equipment** | `factory_manager` | `WHERE building IN (managed_buildings)` — Thiết bị trong nhà máy mình |
| **Equipment** | Roles khác | Tất cả (không filter — xem nhưng không sửa) |
| **Alerts** | `technician` | Chỉ thấy alerts liên quan equipment được assign |
| **Alerts** | `maintenance_engineer` | Alerts trong department / production line |
| **Alerts** | `manager`+ | Tất cả alerts |
| **Audit Logs** | `super_admin` | Tất cả logs (không filter) |
| **Audit Logs** | `factory_manager` | Logs trong scope nhà máy mình (exclude system/IT logs) |

### 7.2. Column-level Projection

| Resource | Role | Hidden Fields |
|----------|------|---------------|
| **Users** | `factory_manager`, `maint_manager` | `password_hash`, `refresh_token`, `login_attempts` |
| **Work Orders** | `viewer` | N/A (viewer không access WO) |
| **AI Models** | `maintenance_engineer` | `training_config`, `hyperparameters` (chỉ xem metrics) |
| **Reports** | `viewer` | `cost_breakdown`, `labor_details` (chỉ xem KPI summary) |

---

## 8. Casbin Policy Definitions

### 8.1. Model (RBAC)

```ini
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = g(r.sub, p.sub) && keyMatch2(r.obj, p.obj) && regexMatch(r.act, p.act)
```

### 8.2. Policies (Casbin CSV format)

```csv
# ========================================
# Super Admin — Toàn quyền
# ========================================
p, super_admin, /api/*, (GET)|(POST)|(PUT)|(DELETE)

# ========================================
# Factory Manager
# ========================================
p, factory_manager, /api/dashboard/*, GET
p, factory_manager, /api/equipment/*, (GET)|(POST)|(PUT)
p, factory_manager, /api/spare-parts/*, (GET)|(POST)|(PUT)
p, factory_manager, /api/sensors/*, GET
p, factory_manager, /api/alerts/*, (GET)|(PUT)
p, factory_manager, /api/work-orders/*, (GET)|(POST)|(PUT)
p, factory_manager, /api/maintenance/*, (GET)|(POST)|(PUT)
p, factory_manager, /api/models/*, GET
p, factory_manager, /api/reports/*, (GET)|(POST)
p, factory_manager, /api/users/*, GET
p, factory_manager, /api/audit/*, GET

# ========================================
# Maintenance Manager
# ========================================
p, maintenance_manager, /api/dashboard/*, GET
p, maintenance_manager, /api/equipment/*, (GET)|(POST)|(PUT)
p, maintenance_manager, /api/spare-parts/*, (GET)|(POST)|(PUT)
p, maintenance_manager, /api/sensors/*, GET
p, maintenance_manager, /api/alerts/*, (GET)|(PUT)
p, maintenance_manager, /api/alerts/sla-config, (GET)|(PUT)
p, maintenance_manager, /api/work-orders/*, (GET)|(POST)|(PUT)
p, maintenance_manager, /api/maintenance/*, (GET)|(POST)|(PUT)
p, maintenance_manager, /api/models/*, GET
p, maintenance_manager, /api/reports/*, (GET)|(POST)
p, maintenance_manager, /api/users/*, GET
p, maintenance_manager, /api/settings/*, (GET)|(PUT)

# ========================================
# Maintenance Engineer
# ========================================
p, maintenance_engineer, /api/dashboard/*, GET
p, maintenance_engineer, /api/equipment/*, GET
p, maintenance_engineer, /api/spare-parts/*, GET
p, maintenance_engineer, /api/sensors/*, GET
p, maintenance_engineer, /api/alerts/*, (GET)|(PUT)
p, maintenance_engineer, /api/work-orders/*, (GET)|(POST)|(PUT)
p, maintenance_engineer, /api/maintenance/*, GET
p, maintenance_engineer, /api/models/*, GET

# ========================================
# Technician
# ========================================
p, technician, /api/dashboard/*, GET
p, technician, /api/equipment/*, GET
p, technician, /api/spare-parts/*, GET
p, technician, /api/sensors/*, GET
p, technician, /api/alerts/*, GET
p, technician, /api/alerts/:id/resolve, PUT
p, technician, /api/work-orders/*, GET
p, technician, /api/work-orders/:id/status, PUT
p, technician, /api/work-orders/:id/checklist/*, PUT
p, technician, /api/work-orders/:id/logs, (GET)|(POST)
p, technician, /api/maintenance/*, GET

# ========================================
# Data Scientist
# ========================================
p, data_scientist, /api/dashboard/*, GET
p, data_scientist, /api/sensors/*, GET
p, data_scientist, /api/models/*, (GET)|(POST)|(PUT)
p, data_scientist, /api/pipelines/*, (GET)|(POST)|(PUT)
p, data_scientist, /api/reports/*, GET

# ========================================
# Quality Inspector
# ========================================
p, quality_inspector, /api/dashboard/*, GET
p, quality_inspector, /api/equipment/*, GET
p, quality_inspector, /api/spare-parts/*, GET
p, quality_inspector, /api/sensors/*, GET
p, quality_inspector, /api/alerts/*, GET
p, quality_inspector, /api/work-orders/*, GET
p, quality_inspector, /api/work-orders/:id/status, PUT
p, quality_inspector, /api/work-orders/:id/logs, (GET)|(POST)
p, quality_inspector, /api/maintenance/*, GET
p, quality_inspector, /api/reports/*, GET

# ========================================
# Viewer
# ========================================
p, viewer, /api/dashboard/*, GET
p, viewer, /api/equipment/*, GET
p, viewer, /api/sensors/*, GET
p, viewer, /api/alerts/*, GET
p, viewer, /api/spare-parts/*, GET
p, viewer, /api/reports/*, GET

# ========================================
# All roles — Profile self-edit
# ========================================
p, super_admin, /api/users/:id/profile, PUT
p, factory_manager, /api/users/:id/profile, PUT
p, maintenance_manager, /api/users/:id/profile, PUT
p, maintenance_engineer, /api/users/:id/profile, PUT
p, technician, /api/users/:id/profile, PUT
p, data_scientist, /api/users/:id/profile, PUT
p, quality_inspector, /api/users/:id/profile, PUT
p, viewer, /api/users/:id/profile, PUT
```

---

## 9. Frontend Role Groups (app.routes.ts)

Mapping giữa tên group và nơi sử dụng:

| Group Name | Roles | Routes sử dụng | Sidebar items |
|------------|-------|-----------------|---------------|
| `ALL_ROLES` | 8/8 roles | `/dashboard`, `/sensors`, `/profile` | Dashboard, Sensor |
| `OPS_ROLES` | ALL trừ `data_scientist` | `/equipment`, `/alerts` | Thiết bị, Cảnh báo |
| `MAINT_ROLES` | `admin`, `factory_mgr`, `maint_mgr`, `engineer`, `technician` | `/maintenance`, `/spare-parts` | Bảo trì, Linh kiện |
| `WO_ROLES` | MAINT + `quality_inspector` | `/work-orders` | Lệnh Công việc |
| `REPORT_ROLES` | `admin`, `factory_mgr`, `maint_mgr`, `data_scientist`, `inspector`, `viewer` | `/reports` | Báo cáo |
| `AI_ROLES` | `admin`, `data_scientist` | `/ai-models` | AI/ML |
| `ADMIN_ROLES` | `admin` only | `/users`, `/settings` | Người dùng, Cấu hình |

---

## 10. Audit Trail Requirements

Mọi action có tính chất **write/mutation** đều phải ghi audit log.

### 10.1. Actions cần Audit

| Category | Actions | Logged Fields |
|----------|---------|---------------|
| **Auth** | Login, Logout, Login Failed, Token Refresh | userId, IP, userAgent, timestamp |
| **User Management** | Create, Update, Delete, Lock/Unlock, Role Change | userId, targetUserId, dataBefore, dataAfter |
| **Equipment** | Create, Update, Delete, Status Change | userId, equipmentId, changes |
| **Alert** | Acknowledge, Assign, Resolve, Escalate, Close | userId, alertId, statusBefore, statusAfter |
| **Work Order** | Create, Status Transition, Checklist Toggle, Cost Update | userId, workOrderId, transition, details |
| **AI Model** | Register, Deploy, Deprecate, Archive | userId, modelId, version, action |
| **Maintenance** | Create Schedule, Approve, Complete | userId, scheduleId, action |
| **Spare Parts** | Create, Update Stock, Reorder | userId, partId, quantityBefore, quantityAfter |
| **Settings** | Any config change | userId, key, valueBefore, valueAfter |

### 10.2. Audit Log Access

| Role | Access Level |
|------|-------------|
| `super_admin` | Tất cả audit logs, không filter |
| `factory_manager` | Audit logs trong scope nhà máy (exclude IT/system logs) |
| Các role khác | Không access audit logs |

---

## 11. Escalation & Delegation Matrix

### 11.1. Alert Escalation Chain

```
Alert Created (auto)
    │
    ▼
Maintenance Engineer (acknowledge + initial assessment)
    │ SLA approaching?
    ├── NO → Engineer xử lý
    └── YES ──→ Maintenance Manager (escalate)
                    │ Cần resource/budget?
                    ├── NO → Manager assign team
                    └── YES ──→ Factory Manager (escalate)
                                    │
                                    └── Approve budget/resource
```

### 11.2. SLA Escalation Timing

| Severity | Response SLA | Auto-escalate if no ACK | Escalate to |
|----------|-------------|-------------------------|-------------|
| Critical | 30 phút | 25 phút (83%) | `maintenance_manager` |
| High | 60 phút | 50 phút (83%) | `maintenance_manager` |
| Medium | 4 giờ | 3 giờ (75%) | `maintenance_manager` |
| Low | 8 giờ | 7 giờ (87%) | `maintenance_manager` |
| Info | — | — | — |

### 11.3. Delegation Rules

| Delegator | Có thể delegate cho | Scope |
|-----------|---------------------|-------|
| `factory_manager` | `maintenance_manager` | Phê duyệt WO, lập lịch PM |
| `maintenance_manager` | `maintenance_engineer` | Assign WO, acknowledge alerts |
| `maintenance_engineer` | `technician` | Thực hiện WO (assign) |
| Các role khác | — | Không có quyền delegate |

---

## 12. Quick Reference — Ai được làm gì?

### 12.1. Super Admin (U001)

Toàn quyền hệ thống. Quản lý users, settings, audit logs. Có thể thực hiện mọi action của tất cả roles khác.

### 12.2. Factory Manager (U002)

Xem mọi thứ ở level tổng quan. Phê duyệt work orders, lập lịch bảo trì, xem báo cáo chi phí. Quản lý equipment (CRUD). Xem danh sách users (read-only). Không trực tiếp quản lý AI models hay system settings.

### 12.3. Maintenance Manager (U008)

Trưởng phòng bảo trì. Phê duyệt/assign work orders, cấu hình SLA, lập lịch PM. Quản lý equipment và spare parts. Xem users (read-only). Nhận escalation từ engineers. Cấu hình hệ thống liên quan bảo trì.

### 12.4. Maintenance Engineer (U003)

Acknowledge alerts, tạo work orders, assign cho technicians. Xem AI predictions và model metrics. Không tạo/sửa equipment, spare parts, maintenance schedule (chỉ đọc). Không truy cập reports, users, settings.

### 12.5. Technician (U004)

Thực hiện work orders được assign. Checklist, work logs, resolve alerts liên quan. Chỉ thấy WO assigned cho mình. Không tạo WO, không acknowledge alert, không truy cập AI, reports, settings.

### 12.6. Data Scientist (U005)

Domain AI/ML riêng biệt. Full CRUD models và pipelines. Xem sensor data để training. Xem reports. Không truy cập equipment, alerts, work orders, spare parts, maintenance.

### 12.7. Quality Inspector (U006)

Verify work orders hoàn thành (`completed → verified`). Xem equipment, alerts, maintenance schedules. Thêm work logs. Xem reports. Không tạo/sửa WO, không acknowledge alerts, không truy cập AI, settings.

### 12.8. Viewer (U007)

Chỉ đọc: Dashboard, Equipment, Sensors, Alerts, Spare Parts, Reports. Không thao tác bất kỳ action nào. Không truy cập Work Orders, Maintenance, AI, Users, Settings.

---

## Phụ lục: Ký hiệu

| Ký hiệu | Ý nghĩa |
|----------|---------|
| ✅ | Full access (read + write) |
| 👁️ | Read-only |
| ❌ | Denied (403 Forbidden) |
| 🔓 | Public (không cần authentication) |
| ✅ᶠ | Filtered — chỉ thấy data liên quan đến mình (Layer 3) |
| ✅ᐩ | Self-only — chỉ thao tác trên bản thân |
| ✅ᵛ | Verify-only — chỉ được thực hiện action verify |
