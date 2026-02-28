# Maintenix — API Contracts

> **Smart Predictive Maintenance Warning System**
> Tài liệu chi tiết tất cả REST endpoints, request/response body, error format, authentication, pagination.
> Frontend developer dùng tài liệu này để chuyển từ mock data sang backend thật.

---

## Mục lục

1. [Quy ước chung](#1-quy-ước-chung)
2. [Authentication — /api/auth](#2-authentication--apiauth)
3. [Users — /api/users](#3-users--apiusers)
4. [Audit Logs — /api/audit](#4-audit-logs--apiaudit)
5. [Equipment — /api/equipment](#5-equipment--apiequipment)
6. [Spare Parts — /api/spare-parts](#6-spare-parts--apispare-parts)
7. [Maintenance Schedules — /api/maintenance](#7-maintenance-schedules--apimaintenance)
8. [Sensors — /api/sensors](#8-sensors--apisensors)
9. [Alerts — /api/alerts](#9-alerts--apialerts)
10. [Work Orders — /api/work-orders](#10-work-orders--apiwork-orders)
11. [AI Models — /api/models](#11-ai-models--apimodels)
12. [Pipelines — /api/pipelines](#12-pipelines--apipipelines)
13. [Dashboard — /api/dashboard](#13-dashboard--apidashboard)
14. [Reports — /api/reports](#14-reports--apireports)
15. [WebSocket (STOMP)](#15-websocket-stomp)
16. [gRPC Services](#16-grpc-services)
17. [Error Codes Reference](#17-error-codes-reference)

---

## 1. Quy ước chung

### 1.1. Base URL

| Environment | Base URL                                |
|-------------|-----------------------------------------|
| Development | `http://localhost:8080/api`              |
| Staging     | `https://staging.maintenix.vn/api`      |
| Production  | `https://maintenix.vn/api`              |

Frontend config:

```typescript
// src/environments/environment.ts
export const environment = {
  apiBaseUrl: 'http://localhost:8080/api',
  wsUrl: 'ws://localhost:8080/ws',
  grpcUrl: 'http://localhost:8081',     // Envoy gRPC-Web proxy
};
```

### 1.2. Authentication Header

Tất cả endpoints (trừ `/api/auth/login`) yêu cầu JWT Bearer token:

```
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

Token nhận được từ `POST /api/auth/login`. Khi token hết hạn (401), gọi `POST /api/auth/refresh` với refresh token.

### 1.3. Request Format

```
Content-Type: application/json
Accept: application/json
Authorization: Bearer <token>
X-Request-ID: <uuid>              ← Optional, auto-generated nếu không gửi
Idempotency-Key: <uuid>           ← Optional, cho mutations (POST/PUT/DELETE)
```

### 1.4. Response Format — Success

Tất cả endpoints trả về cùng 1 format:

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
  "timestamp": "2026-02-27T10:30:00Z",
  "requestId": "req-abc123"
}
```

| Field       | Type    | Mô tả                                            |
|-------------|---------|---------------------------------------------------|
| `success`   | boolean | Luôn `true` khi HTTP status 2xx                   |
| `data`      | object / array | Dữ liệu response. Object cho single, Array cho list |
| `meta`      | object  | Chỉ có khi response là paginated list             |
| `timestamp` | string  | ISO 8601 UTC                                      |
| `requestId` | string  | Correlation ID, dùng để trace logs                |

**Single entity response** (không có `meta`):

```json
{
  "success": true,
  "data": {
    "id": "EQ001",
    "name": "Máy CNC Fanuc #01",
    ...
  },
  "timestamp": "2026-02-27T10:30:00Z",
  "requestId": "req-abc123"
}
```

**List response** (có `meta`):

```json
{
  "success": true,
  "data": [
    { "id": "EQ001", ... },
    { "id": "EQ002", ... }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 10,
    "totalPages": 1
  },
  "timestamp": "2026-02-27T10:30:00Z",
  "requestId": "req-abc123"
}
```

### 1.5. Response Format — Error

```json
{
  "success": false,
  "error": {
    "code": "EQUIPMENT_NOT_FOUND",
    "message": "Equipment with ID 'eq-999' not found",
    "details": {}
  },
  "timestamp": "2026-02-27T10:30:00Z",
  "requestId": "req-abc123"
}
```

| HTTP Status | Ý nghĩa                           | Khi nào                                |
|-------------|------------------------------------|-----------------------------------------|
| 400         | Bad Request                        | Validation error, malformed request     |
| 401         | Unauthorized                       | Missing/expired/invalid JWT             |
| 403         | Forbidden                          | Valid JWT nhưng không đủ permission     |
| 404         | Not Found                          | Resource không tồn tại                  |
| 409         | Conflict                           | Duplicate, invalid state transition     |
| 422         | Unprocessable Entity               | Business rule violation                 |
| 429         | Too Many Requests                  | Rate limit exceeded                     |
| 500         | Internal Server Error              | Unexpected server error                 |
| 503         | Service Unavailable                | Downstream service down                 |

**Validation error** (400) có `details` là object keyed by field name:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed",
    "details": {
      "name": "Name is required",
      "type": "Invalid equipment type. Must be one of: cnc_machine, press, conveyor, ...",
      "specs.power": "Power must be a positive value"
    }
  }
}
```

### 1.6. Pagination

**Offset-based** (cho CRUD listings):

```
GET /api/equipment?page=1&pageSize=20&sort=name&order=asc
```

| Param    | Type   | Default | Mô tả                                   |
|----------|--------|---------|------------------------------------------|
| page     | int    | 1       | Trang hiện tại (1-indexed)               |
| pageSize | int    | 20      | Số items mỗi trang (max 100)            |
| sort     | string | createdAt | Field để sort                           |
| order    | string | desc    | `asc` hoặc `desc`                       |

**Cursor-based** (cho time-series, large datasets):

```
GET /api/sensors/SEN-001/data?cursor=2026-02-27T10:00:00Z&limit=100&direction=backward
```

| Param     | Type   | Default  | Mô tả                                |
|-----------|--------|----------|---------------------------------------|
| cursor    | string | (now)    | ISO 8601 timestamp, điểm bắt đầu    |
| limit     | int    | 100      | Số records (max 1000)                |
| direction | string | backward | `forward` (mới→cũ) hoặc `backward`  |

### 1.7. Filtering

Tất cả list endpoints hỗ trợ filter qua query params:

```
GET /api/alerts?severity=critical,high&status=open&type=ml_prediction&equipmentId=EQ002
```

Nhiều giá trị cho cùng 1 field: dùng comma-separated (OR logic).
Nhiều fields: AND logic.

### 1.8. Search

```
GET /api/equipment?search=CNC+Fanuc
```

Full-text search trên các field: `name`, `assetId`, `serialNumber`, `manufacturer`, `model`.

### 1.9. Rate Limiting

| Scope          | Limit           | Header                           |
|----------------|-----------------|----------------------------------|
| Per IP         | 100 req/min     | `X-RateLimit-Limit: 100`        |
| Per User       | 300 req/min     | `X-RateLimit-Remaining: 295`    |
| Auth endpoints | 10 req/min      | `Retry-After: 30`               |

Khi vượt limit → HTTP 429 + `Retry-After` header (seconds).

---

## 2. Authentication — /api/auth

**Service:** auth-service (:8081)
**Database:** PostgreSQL (`users`, `sessions`)
**Auth required:** Không cho login, Có cho các endpoint khác

---

### POST /api/auth/login

Đăng nhập, nhận JWT + Refresh Token.

**Request:**

```json
{
  "username": "engineer",
  "password": "123456"
}
```

| Field    | Type   | Required | Validation                     |
|----------|--------|----------|--------------------------------|
| username | string | ✅       | 3-50 ký tự, alphanumeric + _  |
| password | string | ✅       | 6-100 ký tự                   |

**Response 200:**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InZhdWx0LWtleS12MSJ9...",
    "refreshToken": "rf_a1b2c3d4e5f6...",
    "expiresIn": 86400,
    "tokenType": "Bearer",
    "user": {
      "id": "U003",
      "username": "engineer",
      "email": "engineer@maintenix.vn",
      "fullName": "Lê Minh Khoa",
      "phone": "0923456789",
      "role": "maintenance_engineer",
      "department": "Bảo trì",
      "avatar": "",
      "status": "active",
      "skills": ["PLC", "Hydraulics", "CNC"],
      "certifications": [],
      "lastLogin": "2026-02-27T08:00:00Z",
      "createdAt": "2024-02-01T00:00:00Z"
    }
  },
  "timestamp": "2026-02-27T10:30:00Z",
  "requestId": "req-abc123"
}
```

| Field         | Type   | Mô tả                                            |
|---------------|--------|---------------------------------------------------|
| token         | string | JWT access token (RS256, 24h expiry)              |
| refreshToken  | string | Refresh token (7 ngày expiry, single-use)         |
| expiresIn     | int    | Token TTL in seconds                              |
| tokenType     | string | Luôn là "Bearer"                                  |
| user          | User   | Full user object                                  |

**Error responses:**

| Status | Code                   | Khi nào                          |
|--------|------------------------|----------------------------------|
| 401    | AUTH_INVALID_CREDENTIALS | Username hoặc password sai      |
| 403    | AUTH_ACCOUNT_LOCKED    | Tài khoản bị khóa               |
| 429    | AUTH_TOO_MANY_ATTEMPTS | > 10 lần login sai trong 1 phút |

---

### POST /api/auth/logout

Revoke current token. Token bị thêm vào blacklist (Redis, TTL = remaining expiry).

**Request:** Không có body. Token trong `Authorization` header.

**Response 200:**

```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

---

### POST /api/auth/refresh

Lấy token mới bằng refresh token. Refresh token cũ bị invalidate (rotation).

**Request:**

```json
{
  "refreshToken": "rf_a1b2c3d4e5f6..."
}
```

**Response 200:** Giống response login (token mới + refreshToken mới + user).

**Error responses:**

| Status | Code                    | Khi nào                            |
|--------|-------------------------|------------------------------------|
| 401    | AUTH_REFRESH_EXPIRED    | Refresh token hết hạn (>7 ngày)   |
| 401    | AUTH_REFRESH_REVOKED    | Refresh token đã bị dùng/revoke   |

---

### GET /api/auth/me

Lấy thông tin user hiện tại từ JWT.

**Response 200:**

```json
{
  "success": true,
  "data": {
    "id": "U003",
    "username": "engineer",
    "email": "engineer@maintenix.vn",
    "fullName": "Lê Minh Khoa",
    "phone": "0923456789",
    "role": "maintenance_engineer",
    "department": "Bảo trì",
    "avatar": "",
    "status": "active",
    "skills": ["PLC", "Hydraulics", "CNC"],
    "certifications": [],
    "lastLogin": "2026-02-27T08:00:00Z",
    "createdAt": "2024-02-01T00:00:00Z"
  }
}
```

---

## 3. Users — /api/users

**Service:** auth-service (:8081)
**Database:** PostgreSQL (`users`, `roles`, `permissions`)
**Auth required:** ✅ | **Roles:** super_admin (full CRUD), factory_manager/maintenance_manager (read-only)

---

### GET /api/users

Danh sách tất cả users (paginated).

**Query params:**

| Param      | Type   | Mô tả                                              |
|------------|--------|-----------------------------------------------------|
| page       | int    | Trang (default: 1)                                  |
| pageSize   | int    | Items/trang (default: 20)                           |
| role       | string | Filter: `super_admin,factory_manager` (comma-sep)   |
| department | string | Filter: `Bảo trì`                                  |
| status     | string | Filter: `active,inactive,locked`                    |
| search     | string | Search: username, fullName, email                   |

**Response 200:**

```json
{
  "success": true,
  "data": [
    {
      "id": "U001",
      "username": "admin",
      "email": "admin@maintenix.vn",
      "fullName": "Nguyễn Văn Admin",
      "phone": "0901234567",
      "role": "super_admin",
      "department": "IT",
      "avatar": "",
      "status": "active",
      "skills": [],
      "certifications": [],
      "lastLogin": "2026-02-27T08:00:00Z",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 8, "totalPages": 1 }
}
```

---

### GET /api/users/:id

**Response 200:** Single User object (như trên, không có `meta`).

**Error:** 404 `USER_NOT_FOUND`

---

### POST /api/users

Tạo user mới. **Role:** super_admin only.

**Request:**

```json
{
  "username": "newuser",
  "email": "newuser@maintenix.vn",
  "password": "SecureP@ss123",
  "fullName": "Trần Văn Mới",
  "phone": "0999888777",
  "role": "technician",
  "department": "Bảo trì",
  "skills": ["Welding"],
  "certifications": []
}
```

| Field          | Type     | Required | Validation                                         |
|----------------|----------|----------|-----------------------------------------------------|
| username       | string   | ✅       | 3-50, alphanumeric + _, unique                      |
| email          | string   | ✅       | Valid email, unique                                  |
| password       | string   | ✅       | 8+, must have uppercase + lowercase + number        |
| fullName       | string   | ✅       | 2-100 ký tự                                        |
| phone          | string   | ❌       | Vietnamese phone format                              |
| role           | UserRole | ✅       | Enum: super_admin, factory_manager, maintenance_manager, maintenance_engineer, technician, data_scientist, quality_inspector, viewer |
| department     | string   | ✅       | 2-100 ký tự                                        |
| skills         | string[] | ❌       | Array of skill strings                               |
| certifications | string[] | ❌       | Array of certification strings                       |

**Response 201:** Created User object.

**Errors:**

| Status | Code                 | Khi nào                   |
|--------|----------------------|---------------------------|
| 400    | VALIDATION_FAILED    | Field validation errors   |
| 409    | USER_USERNAME_EXISTS | Username đã tồn tại      |
| 409    | USER_EMAIL_EXISTS    | Email đã tồn tại         |

---

### PUT /api/users/:id

Update user. **Role:** super_admin (all fields), user tự update profile (limited fields).

**Request:** Partial update — chỉ gửi fields cần thay đổi:

```json
{
  "fullName": "Trần Văn Mới Updated",
  "phone": "0999888000",
  "skills": ["Welding", "Electrical"]
}
```

**Response 200:** Updated User object.

---

### DELETE /api/users/:id

Soft delete (set `status: 'inactive'`). **Role:** super_admin only.

**Response 200:**

```json
{
  "success": true,
  "data": { "message": "User deactivated successfully" }
}
```

**Error:** 404 `USER_NOT_FOUND` | 409 `USER_CANNOT_DELETE_SELF`

---

### GET /api/users/:id/activity

Login activity chart data (30 ngày gần nhất).

**Response 200:**

```json
{
  "success": true,
  "data": [
    { "date": "2026-02-27", "loginCount": 3, "activeMinutes": 240 },
    { "date": "2026-02-26", "loginCount": 2, "activeMinutes": 180 }
  ]
}
```

---

## 4. Audit Logs — /api/audit

**Service:** auth-service (:8081)
**Database:** PostgreSQL (`audit_logs`)
**Auth required:** ✅ | **Roles:** super_admin, factory_manager

---

### GET /api/audit

**Query params:**

| Param    | Type   | Mô tả                                   |
|----------|--------|------------------------------------------|
| page     | int    | Default: 1                               |
| pageSize | int    | Default: 20 (max: 100)                  |
| userId   | string | Filter by user ID                        |
| action   | string | Filter: `login,create,update,delete`     |
| resource | string | Filter: `user,equipment,alert,workorder` |
| from     | string | ISO datetime (start range)               |
| to       | string | ISO datetime (end range)                 |

**Response 200:**

```json
{
  "success": true,
  "data": [
    {
      "id": "AUD001",
      "userId": "U003",
      "userName": "Lê Minh Khoa",
      "action": "update",
      "resource": "alert",
      "resourceId": "ALT002",
      "details": "Acknowledged alert ALT002",
      "ipAddress": "192.168.1.50",
      "timestamp": "2026-02-27T09:30:00Z",
      "dataBefore": { "status": "open" },
      "dataAfter": { "status": "acknowledged", "acknowledgedBy": "U003" }
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 156, "totalPages": 8 }
}
```

---

## 5. Equipment — /api/equipment

**Service:** equipment-service (:8082)
**Database:** PostgreSQL (`equipment`, `equipment_locations`, `equipment_specs`)
**Auth required:** ✅ | **Roles:** All roles can read; maintenance_manager+ can write

---

### GET /api/equipment

**Query params:**

| Param          | Type   | Mô tả                                                 |
|----------------|--------|--------------------------------------------------------|
| page           | int    | Default: 1                                             |
| pageSize       | int    | Default: 20                                            |
| status         | string | `running,warning,critical,maintenance,offline,idle`    |
| type           | string | `cnc_machine,press,conveyor,pump,compressor,robot,motor,generator,valve,heat_exchanger` |
| building       | string | Filter by building name                                |
| productionLine | string | Filter by production line                              |
| healthScoreMin | int    | Min health score (0-100)                               |
| healthScoreMax | int    | Max health score (0-100)                               |
| search         | string | Search: name, assetId, serialNumber, manufacturer      |
| sort           | string | Default: `name`. Options: `name,healthScore,status,type,lastMaintenanceDate` |
| order          | string | `asc` / `desc`                                         |

**Response 200:**

```json
{
  "success": true,
  "data": [
    {
      "id": "EQ001",
      "assetId": "A-CNC-001",
      "name": "Máy CNC Fanuc #01",
      "serialNumber": "FNC-2021-0891",
      "type": "cnc_machine",
      "manufacturer": "Fanuc",
      "model": "Robodrill α-D21MiB5",
      "yearManufactured": 2021,
      "location": {
        "building": "Nhà xưởng A",
        "floor": "Tầng 1",
        "productionLine": "Dây chuyền A",
        "workstation": "Trạm A-01",
        "coordinates": { "lat": 10.8231, "lng": 106.6297 }
      },
      "specs": {
        "power": "15kW",
        "ratedSpeed": "24000 RPM",
        "maxTemperature": 90,
        "maxPressure": null,
        "weight": null
      },
      "status": "running",
      "healthScore": 84,
      "lastMaintenanceDate": "2026-01-15",
      "nextMaintenanceDate": "2026-03-15",
      "sensors": [
        {
          "id": "S001",
          "equipmentId": "EQ001",
          "name": "Nhiệt độ vòng bi",
          "type": "temperature",
          "unit": "°C",
          "currentValue": 78,
          "minThreshold": 20,
          "maxThreshold": 90,
          "warningLow": 10,
          "warningHigh": 80,
          "criticalLow": 5,
          "criticalHigh": 90,
          "status": "warning",
          "lastUpdated": "2026-02-27T10:29:55Z",
          "sparklineData": [72.1, 73.5, 71.8, 74.2, ...]
        }
      ],
      "imageUrl": null,
      "qrCode": null,
      "createdAt": "2021-06-01T00:00:00Z"
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 10, "totalPages": 1 }
}
```

**TypeScript mapping — `Equipment` interface:**

| JSON field           | TS type             | Go struct field     | DB column              |
|----------------------|---------------------|---------------------|------------------------|
| id                   | string              | ID (uuid)           | equipment.id           |
| assetId              | string              | AssetID             | equipment.asset_id     |
| name                 | string              | Name                | equipment.name         |
| serialNumber         | string              | SerialNumber        | equipment.serial_number|
| type                 | EquipmentType       | Type                | equipment.type         |
| manufacturer         | string              | Manufacturer        | equipment.manufacturer |
| model                | string              | Model               | equipment.model        |
| yearManufactured     | number              | YearManufactured    | equipment.year_manufactured |
| location             | EquipmentLocation   | Location            | equipment_locations.*  |
| specs                | EquipmentSpecs      | Specs               | equipment_specs.*      |
| status               | EquipmentStatus     | Status              | equipment.status       |
| healthScore          | number              | HealthScore         | equipment.health_score |
| lastMaintenanceDate  | string (date)       | LastMaintenanceDate | equipment.last_maintenance_date |
| nextMaintenanceDate  | string (date)       | NextMaintenanceDate | equipment.next_maintenance_date |
| sensors              | Sensor[]            | Sensors (joined)    | sensors.* WHERE equipment_id = |
| imageUrl             | string?             | ImageURL            | equipment.image_url    |
| qrCode               | string?             | QRCode              | equipment.qr_code      |
| createdAt            | string (datetime)   | CreatedAt           | equipment.created_at   |

---

### GET /api/equipment/:id

**Response 200:** Single Equipment object (full, including sensors).

**Error:** 404 `EQUIPMENT_NOT_FOUND`

---

### POST /api/equipment

**Request:**

```json
{
  "assetId": "A-CNC-011",
  "name": "Máy CNC mới",
  "serialNumber": "NEW-2026-0001",
  "type": "cnc_machine",
  "manufacturer": "Fanuc",
  "model": "Robodrill α-D21MiB5 ADV",
  "yearManufactured": 2026,
  "location": {
    "building": "Nhà xưởng A",
    "floor": "Tầng 1",
    "productionLine": "Dây chuyền A",
    "workstation": "Trạm A-12"
  },
  "specs": {
    "power": "18kW",
    "ratedSpeed": "30000 RPM",
    "maxTemperature": 95
  }
}
```

| Field            | Required | Validation                          |
|------------------|----------|--------------------------------------|
| assetId          | ✅       | Unique, 3-50 chars                  |
| name             | ✅       | 3-200 chars                         |
| serialNumber     | ✅       | Unique                              |
| type             | ✅       | Must be valid EquipmentType enum    |
| manufacturer     | ✅       | 2-100 chars                         |
| model            | ✅       | 2-100 chars                         |
| yearManufactured | ✅       | 1900 ≤ year ≤ current year         |
| location         | ✅       | building + floor + productionLine required |
| specs            | ✅       | power required                      |

**Response 201:** Created Equipment object (id + createdAt auto-generated, healthScore = 100, status = "idle").

**Errors:** 409 `EQUIPMENT_ASSET_ID_EXISTS` | 409 `EQUIPMENT_SERIAL_EXISTS`

---

### PUT /api/equipment/:id

Partial update. Chỉ gửi fields cần thay đổi.

**Response 200:** Updated Equipment object.

---

### DELETE /api/equipment/:id

Soft delete (set `status: 'offline'`, ẩn khỏi default listing).

**Response 200:**

```json
{ "success": true, "data": { "message": "Equipment deactivated" } }
```

**Errors:** 404 `EQUIPMENT_NOT_FOUND` | 409 `EQUIPMENT_HAS_ACTIVE_WORKORDERS`

---

### GET /api/equipment/:id/history

Lịch sử bảo trì của thiết bị (work orders đã hoàn thành).

**Query params:** `page`, `pageSize`, `from`, `to`

**Response 200:**

```json
{
  "success": true,
  "data": [
    {
      "workOrderId": "WO004",
      "woNumber": "WO-2026-0143",
      "title": "Bảo trì định kỳ máy nén khí",
      "type": "preventive",
      "completedAt": "2026-02-20T15:00:00Z",
      "actualHours": 4.5,
      "totalCost": 4325000,
      "assignedTo": "Phạm Anh Tuấn"
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 12, "totalPages": 1 }
}
```

---

## 6. Spare Parts — /api/spare-parts

**Service:** equipment-service (:8082)
**Database:** PostgreSQL (`spare_parts`, `spare_part_usage`) + Redis (stock cache)
**Auth required:** ✅ | **Roles:** All can read; maintenance_manager+ can write

---

### GET /api/spare-parts

**Query params:**

| Param    | Type   | Mô tả                                                  |
|----------|--------|---------------------------------------------------------|
| page     | int    | Default: 1                                              |
| pageSize | int    | Default: 20                                             |
| status   | string | `ok,low_stock,out_of_stock,overstock`                   |
| category | string | `Bearing,Filter,Lubricant,Belt,Consumable,Seal`         |
| abcClass | string | `A,B,C`                                                 |
| equipmentId | string | Filter parts compatible with specific equipment      |
| search   | string | Search: name, partNumber, manufacturer                  |

**Response 200:**

```json
{
  "success": true,
  "data": [
    {
      "id": "SP001",
      "partNumber": "BRG-6208-2RS",
      "name": "Ổ bi 6208-2RS",
      "description": "Ổ bi cầu một dãy, bọc kín hai mặt",
      "manufacturer": "SKF",
      "category": "Bearing",
      "unit": "cái",
      "quantity": 12,
      "reorderPoint": 5,
      "reorderQuantity": 20,
      "leadTimeDays": 7,
      "unitPrice": 850000,
      "status": "ok",
      "abcClass": "A",
      "compatibleEquipment": ["EQ003", "EQ009"],
      "lastUsedDate": "2026-02-15T00:00:00Z"
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 7, "totalPages": 1 }
}
```

---

### GET /api/spare-parts/:id

**Response 200:** Single SparePart object.

---

### POST /api/spare-parts

**Request:**

```json
{
  "partNumber": "FLT-NEW-001",
  "name": "Bộ lọc mới",
  "description": "Mô tả bộ lọc",
  "manufacturer": "Bosch",
  "category": "Filter",
  "unit": "cái",
  "quantity": 10,
  "reorderPoint": 3,
  "reorderQuantity": 10,
  "leadTimeDays": 7,
  "unitPrice": 500000,
  "abcClass": "B",
  "compatibleEquipment": ["EQ001"]
}
```

| Field              | Required | Validation                   |
|--------------------|----------|-------------------------------|
| partNumber         | ✅       | Unique, 3-50 chars            |
| name               | ✅       | 3-200 chars                   |
| manufacturer       | ✅       | 2-100 chars                   |
| category           | ✅       | Valid category string         |
| unit               | ✅       | 1-20 chars                    |
| quantity           | ✅       | ≥ 0                          |
| reorderPoint       | ✅       | ≥ 0                          |
| reorderQuantity    | ✅       | > 0                          |
| leadTimeDays       | ✅       | > 0                          |
| unitPrice          | ✅       | ≥ 0 (VNĐ)                   |
| abcClass           | ✅       | A, B, or C                    |

**Response 201:** Created SparePart (status auto-calculated from quantity vs reorderPoint).

---

### PUT /api/spare-parts/:id

Partial update. Khi `quantity` thay đổi → `status` auto-recalculated.

---

### POST /api/spare-parts/:id/reorder

Trigger đặt hàng bổ sung (quantity = reorderQuantity).

**Request:**

```json
{
  "quantity": 20,
  "supplier": "SKF Vietnam",
  "notes": "Đặt gấp cho PM quý 2"
}
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "reorderId": "RO-2026-0001",
    "partId": "SP001",
    "quantity": 20,
    "estimatedDelivery": "2026-03-06",
    "status": "ordered"
  }
}
```

---

## 7. Maintenance Schedules — /api/maintenance

**Service:** equipment-service (:8082)
**Database:** PostgreSQL (`maintenance_schedules`, `pm_templates`)
**Auth required:** ✅ | **Roles:** All can read; maintenance_manager+ can write

---

### GET /api/maintenance

**Query params:**

| Param          | Type   | Mô tả                                        |
|----------------|--------|-----------------------------------------------|
| page           | int    | Default: 1                                    |
| pageSize       | int    | Default: 20                                   |
| status         | string | `planned,in_progress,completed,overdue`       |
| type           | string | `preventive,predictive,corrective,emergency`  |
| equipmentId    | string | Filter by equipment                           |
| productionLine | string | Filter by production line                     |
| from           | string | Start date range (ISO date)                   |
| to             | string | End date range (ISO date)                     |
| isAiRecommended | bool  | Filter AI-recommended schedules               |

**Response 200:**

```json
{
  "success": true,
  "data": [
    {
      "id": "MS001",
      "title": "Bảo trì dự đoán - Máy ép M09",
      "type": "predictive",
      "equipmentId": "EQ002",
      "equipmentName": "Máy ép thủy lực M09",
      "productionLine": "Dây chuyền A",
      "startDate": "2026-02-28",
      "endDate": "2026-03-01",
      "assignedTeam": "Team A",
      "status": "in_progress",
      "completionRate": 55,
      "isAiRecommended": true,
      "confidence": 94
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 5, "totalPages": 1 }
}
```

---

### POST /api/maintenance

**Request:**

```json
{
  "title": "PM Quý 2 - Robot hàn",
  "type": "preventive",
  "equipmentId": "EQ004",
  "startDate": "2026-06-01",
  "endDate": "2026-06-02",
  "assignedTeam": "Team B"
}
```

**Response 201:** Created MaintenanceSchedule.

---

### PUT /api/maintenance/:id/approve

Manager phê duyệt lịch bảo trì (chuyển `planned` → `in_progress` nếu đến ngày).

**Request:**

```json
{
  "approvedBy": "U008",
  "notes": "Approved for Q2"
}
```

**Response 200:** Updated MaintenanceSchedule.

**Error:** 409 `MAINTENANCE_INVALID_STATUS` (chỉ approve schedule ở status `planned`)

---

## 8. Sensors — /api/sensors

**Service:** sensor-service (:8083)
**Database:** PostgreSQL (metadata) + TimescaleDB (history) + InfluxDB (real-time)
**Auth required:** ✅ | **Roles:** All can read

---

### GET /api/sensors

**Query params:**

| Param       | Type   | Mô tả                                                    |
|-------------|--------|-----------------------------------------------------------|
| page        | int    | Default: 1                                                |
| pageSize    | int    | Default: 20                                               |
| equipmentId | string | Filter sensors by equipment                               |
| type        | string | `temperature,vibration,pressure,current,humidity,flow_rate,rpm,noise` |
| status      | string | `normal,warning,critical`                                 |

**Response 200:**

```json
{
  "success": true,
  "data": [
    {
      "id": "S001",
      "equipmentId": "EQ001",
      "name": "Nhiệt độ vòng bi",
      "type": "temperature",
      "unit": "°C",
      "currentValue": 78,
      "minThreshold": 20,
      "maxThreshold": 90,
      "warningLow": 10,
      "warningHigh": 80,
      "criticalLow": 5,
      "criticalHigh": 90,
      "status": "warning",
      "lastUpdated": "2026-02-27T10:29:55Z",
      "sparklineData": [72.1, 73.5, 71.8, 74.2, 75.0, 76.3, 77.1, 78.0, ...]
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 12, "totalPages": 1 }
}
```

---

### GET /api/sensors/:id

**Response 200:** Single Sensor object.

---

### GET /api/sensors/:id/data

Time-series sensor readings.

**Query params:**

| Param     | Type   | Default  | Mô tả                                       |
|-----------|--------|----------|----------------------------------------------|
| hours     | int    | 24       | Số giờ lấy data (1-720, tức max 30 ngày)   |
| interval  | string | auto     | Aggregation: `raw`, `1m`, `5m`, `1h`, `1d` |
| cursor    | string | (now)    | Cursor-based pagination                      |
| limit     | int    | 100      | Max points per request (max 1000)            |

**Aggregation logic:**
- hours ≤ 1: `raw` (mỗi reading)
- hours ≤ 6: `1m` (1 phút avg)
- hours ≤ 24: `5m` (5 phút avg)
- hours ≤ 168 (7d): `1h` (1 giờ avg)
- hours > 168: `1d` (1 ngày avg)

**Response 200:**

```json
{
  "success": true,
  "data": [
    { "time": "2026-02-27T10:25:00Z", "value": 76.3 },
    { "time": "2026-02-27T10:30:00Z", "value": 78.0 },
    { "time": "2026-02-27T10:35:00Z", "value": 77.5 }
  ],
  "meta": {
    "sensorId": "S001",
    "unit": "°C",
    "interval": "5m",
    "startTime": "2026-02-26T10:30:00Z",
    "endTime": "2026-02-27T10:30:00Z",
    "pointCount": 288
  }
}
```

**Data source routing:**
- hours ≤ 168 (7 ngày) → **InfluxDB** (hot data, fast query)
- hours > 168 → **TimescaleDB** (history, compressed)

---

### GET /api/sensors/:id/anomalies

Detected anomalies (Z-score, IQR method).

**Query params:** `hours` (default: 168 = 7 ngày), `page`, `pageSize`

**Response 200:**

```json
{
  "success": true,
  "data": [
    {
      "id": "ANO001",
      "sensorId": "S001",
      "timestamp": "2026-02-27T08:15:00Z",
      "value": 92.3,
      "expectedRange": { "min": 65.0, "max": 85.0 },
      "zScore": 3.2,
      "method": "z_score",
      "severity": "high"
    }
  ]
}
```

---

### GET /api/sensors/by-equipment/:equipmentId

Shortcut: tất cả sensors thuộc 1 equipment.

**Response 200:** Array of Sensor objects (không paginated — max 20 sensors/equipment).

---

## 9. Alerts — /api/alerts

**Service:** alert-service (:8084)
**Database:** PostgreSQL (`alerts`, `alert_history`, `sla_config`) + Redis (active alerts cache)
**Auth required:** ✅ | **Roles:** All can read; maintenance_engineer+ can write

---

### GET /api/alerts

**Query params:**

| Param          | Type   | Mô tả                                                        |
|----------------|--------|---------------------------------------------------------------|
| page           | int    | Default: 1                                                    |
| pageSize       | int    | Default: 20                                                   |
| severity       | string | `critical,high,medium,low,info` (comma-sep)                  |
| status         | string | `open,acknowledged,assigned,in_progress,resolved,closed,escalated` |
| type           | string | `sensor_threshold,ml_prediction,system,manual`               |
| equipmentId    | string | Filter by equipment                                          |
| productionLine | string | Filter by production line                                    |
| assignedTo     | string | Filter by assigned user ID                                   |
| from           | string | Created after (ISO datetime)                                 |
| to             | string | Created before (ISO datetime)                                |
| sort           | string | Default: `createdAt`. Options: `severity,status,slaDeadline` |

**Response 200:**

```json
{
  "success": true,
  "data": [
    {
      "id": "ALT001",
      "equipmentId": "EQ002",
      "equipmentName": "Máy ép thủy lực M09",
      "severity": "critical",
      "type": "sensor_threshold",
      "title": "Quá nhiệt độ vòng bi",
      "description": "Nhiệt độ dầu thủy lực vượt ngưỡng critical 95°C, hiện tại 92°C và đang tăng",
      "status": "open",
      "createdAt": "2026-02-27T10:25:00Z",
      "acknowledgedAt": null,
      "acknowledgedBy": null,
      "resolvedAt": null,
      "assignedTo": null,
      "slaDeadline": "2026-02-27T11:20:00Z",
      "aiExplanation": "Phân tích cho thấy bộ lọc dầu bị tắc nghẽn 60%...",
      "contributingFactors": [
        { "factor": "Bộ lọc dầu tắc nghẽn", "impact": 45 },
        { "factor": "Nhiệt độ môi trường", "impact": 25 },
        { "factor": "Tải trọng hoạt động", "impact": 20 },
        { "factor": "Tuổi thọ dầu", "impact": 10 }
      ],
      "recommendedActions": [
        "Thay bộ lọc dầu thủy lực",
        "Kiểm tra hệ thống làm mát",
        "Giảm tải vận hành 20%"
      ],
      "relatedAlerts": ["ALT007"],
      "productionLine": "Dây chuyền A"
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 8, "totalPages": 1 }
}
```

---

### GET /api/alerts/:id

**Response 200:** Single Alert object (full).

---

### PUT /api/alerts/:id/acknowledge

**Request:**

```json
{
  "userId": "U003",
  "notes": "Đang kiểm tra hiện trường"
}
```

**Response 200:** Updated Alert (status → `acknowledged`, acknowledgedAt + acknowledgedBy populated).

**Errors:**

| Status | Code                        | Khi nào                               |
|--------|-----------------------------|---------------------------------------|
| 404    | ALERT_NOT_FOUND             | Alert ID không tồn tại               |
| 409    | ALERT_ALREADY_ACKNOWLEDGED  | Alert đã được acknowledge            |
| 409    | ALERT_INVALID_STATUS        | Alert đã resolved/closed              |

---

### PUT /api/alerts/:id/assign

**Request:**

```json
{
  "assignedTo": "U004",
  "notes": "Giao cho Tuấn xử lý"
}
```

**Response 200:** Updated Alert (status → `assigned`).

---

### PUT /api/alerts/:id/resolve

**Request:**

```json
{
  "resolution": "Đã thay bộ lọc dầu và kiểm tra hệ thống làm mát",
  "rootCause": "Bộ lọc dầu tắc nghẽn do bụi bẩn tích tụ",
  "preventiveAction": "Tăng tần suất kiểm tra lọc dầu từ 3 tháng → 1 tháng"
}
```

**Response 200:** Updated Alert (status → `resolved`, resolvedAt populated).

---

### PUT /api/alerts/:id/escalate

**Request:**

```json
{
  "reason": "SLA sắp breach, cần manager xử lý",
  "escalateTo": "U008"
}
```

**Response 200:** Updated Alert (status → `escalated`).

---

### GET /api/alerts/sla-config

SLA configuration (response time targets).

**Response 200:**

```json
{
  "success": true,
  "data": [
    { "severity": "critical", "responseTimeMinutes": 30, "resolutionTimeHours": 4 },
    { "severity": "high",     "responseTimeMinutes": 60, "resolutionTimeHours": 8 },
    { "severity": "medium",   "responseTimeMinutes": 240, "resolutionTimeHours": 24 },
    { "severity": "low",      "responseTimeMinutes": 480, "resolutionTimeHours": 72 },
    { "severity": "info",     "responseTimeMinutes": null, "resolutionTimeHours": null }
  ]
}
```

---

## 10. Work Orders — /api/work-orders

**Service:** workorder-service (:8085)
**Database:** PostgreSQL (`work_orders`, `checklists`, `checklist_items`, `work_logs`, `cost_records`)
**Auth required:** ✅ | **Roles:** technician+ can read; maintenance_engineer+ can create/update

---

### GET /api/work-orders

**Query params:**

| Param      | Type   | Mô tả                                                            |
|------------|--------|-------------------------------------------------------------------|
| page       | int    | Default: 1                                                        |
| pageSize   | int    | Default: 20                                                       |
| status     | string | `draft,submitted,approved,scheduled,assigned,in_progress,pending_parts,completed,verified,closed` |
| type       | string | `preventive,predictive,corrective,emergency`                     |
| priority   | string | `P1,P2,P3,P4`                                                   |
| equipmentId| string | Filter by equipment                                              |
| assignedTo | string | Filter by assigned user                                          |
| createdBy  | string | Filter by creator                                                |
| view       | string | `list` (default) or `kanban` (grouped by status)                |

**Kanban view** (view=kanban) — response grouped by status columns:

```json
{
  "success": true,
  "data": {
    "columns": [
      {
        "status": "assigned",
        "label": "Đã giao",
        "items": [{ "id": "WO005", ... }]
      },
      {
        "status": "in_progress",
        "label": "Đang thực hiện",
        "items": [{ "id": "WO001", ... }]
      },
      {
        "status": "completed",
        "label": "Hoàn thành",
        "items": [{ "id": "WO004", ... }]
      },
      {
        "status": "verified",
        "label": "Đã xác minh",
        "items": [{ "id": "WO006", ... }]
      }
    ]
  }
}
```

**List view** — standard paginated:

```json
{
  "success": true,
  "data": [
    {
      "id": "WO001",
      "woNumber": "WO-2026-0145",
      "title": "Thay dầu thủy lực máy ép M09",
      "description": "Thay toàn bộ dầu thủy lực và bộ lọc...",
      "type": "corrective",
      "priority": "P1",
      "status": "in_progress",
      "equipmentId": "EQ002",
      "equipmentName": "Máy ép thủy lực M09",
      "assignedTo": "Lê Minh Khoa",
      "assignedTeam": "Team A",
      "createdBy": "Trần Thị Lan",
      "createdAt": "2026-02-26T10:30:00Z",
      "deadline": "2026-02-28T10:30:00Z",
      "estimatedHours": 6,
      "actualHours": 3,
      "completionRate": 55,
      "laborCost": 1500000,
      "partsCost": 8500000,
      "totalCost": 10000000,
      "alertId": "ALT001",
      "checklist": [
        { "id": "CK1", "description": "Xả dầu cũ", "completed": true, "completedBy": "Khoa", "completedAt": "2026-02-27T08:00:00Z" },
        { "id": "CK2", "description": "Thay bộ lọc", "completed": true, "completedBy": "Khoa", "completedAt": null },
        { "id": "CK3", "description": "Đổ dầu mới", "completed": false },
        { "id": "CK4", "description": "Kiểm tra áp suất", "completed": false },
        { "id": "CK5", "description": "Chạy thử", "completed": false }
      ],
      "workLogs": [
        { "id": "WL1", "timestamp": "2026-02-27T07:30:00Z", "author": "Khoa", "description": "Bắt đầu xả dầu cũ", "type": "note" },
        { "id": "WL2", "timestamp": "2026-02-27T08:00:00Z", "author": "System", "description": "Status: assigned → in_progress", "type": "status_change" }
      ]
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 6, "totalPages": 1 }
}
```

---

### GET /api/work-orders/:id

**Response 200:** Single WorkOrder (full with checklist + workLogs).

---

### POST /api/work-orders

**Request:**

```json
{
  "title": "Thay ổ bi motor",
  "description": "Thay ổ bi do phát hiện rung động bất thường",
  "type": "predictive",
  "priority": "P2",
  "equipmentId": "EQ003",
  "assignedTo": "U004",
  "assignedTeam": "Team A",
  "deadline": "2026-03-07T17:00:00Z",
  "estimatedHours": 4,
  "alertId": "ALT002",
  "checklist": [
    { "description": "Dừng máy an toàn" },
    { "description": "Tháo motor" },
    { "description": "Thay ổ bi" },
    { "description": "Lắp lại và chạy thử" }
  ]
}
```

| Field          | Required | Validation                                                |
|----------------|----------|-----------------------------------------------------------|
| title          | ✅       | 5-200 chars                                               |
| description    | ✅       | 10-2000 chars                                             |
| type           | ✅       | preventive, predictive, corrective, emergency             |
| priority       | ✅       | P1, P2, P3, P4                                            |
| equipmentId    | ✅       | Must exist                                                |
| assignedTo     | ❌       | User ID (must have technician/engineer role)              |
| deadline       | ✅       | ISO datetime, must be in future                           |
| estimatedHours | ✅       | > 0                                                      |
| alertId        | ❌       | Link to triggering alert                                  |
| checklist      | ❌       | Array of { description: string }                          |

**Response 201:** Created WorkOrder (status = `draft`, woNumber auto-generated).

---

### PUT /api/work-orders/:id/status

FSM status transition.

**Request:**

```json
{
  "status": "in_progress",
  "notes": "Bắt đầu thực hiện"
}
```

**Valid transitions:**

```
draft → submitted → approved → scheduled → assigned → in_progress
in_progress → pending_parts → in_progress (khi có parts)
in_progress → completed → verified → closed
completed → in_progress (reopen)
```

**Errors:**

| Status | Code                           | Khi nào                                 |
|--------|--------------------------------|------------------------------------------|
| 409    | WORKORDER_INVALID_TRANSITION   | Status transition không hợp lệ          |
| 422    | WORKORDER_CHECKLIST_INCOMPLETE | Chuyển completed nhưng checklist chưa xong |

---

### PUT /api/work-orders/:id/checklist/:itemId

Toggle checklist item.

**Request:**

```json
{
  "completed": true,
  "completedBy": "U003"
}
```

**Response 200:** Updated WorkOrder (completionRate auto-recalculated).

---

### POST /api/work-orders/:id/logs

Add work log entry.

**Request:**

```json
{
  "description": "Đã tháo motor ra, phát hiện ổ bi bị mòn nặng",
  "type": "note",
  "author": "U003"
}
```

| Field       | Required | Validation                              |
|-------------|----------|-----------------------------------------|
| description | ✅       | 5-2000 chars                            |
| type        | ✅       | `note`, `status_change`, `photo`, `measurement` |
| author      | ✅       | User ID                                 |

**Response 201:** Created WorkLog entry.

---

### GET /api/work-orders/:id/logs

**Response 200:** Array of WorkLog entries (newest first).

---

## 11. AI Models — /api/models

**Service:** ml-service (:8086)
**Database:** PostgreSQL (`ai_models`, `model_versions`) + MinIO (model artifacts)
**Auth required:** ✅ | **Roles:** data_scientist, super_admin can write; all can read

---

### GET /api/models

**Query params:**

| Param  | Type   | Mô tả                                                       |
|--------|--------|--------------------------------------------------------------|
| page   | int    | Default: 1                                                   |
| type   | string | `health_score,rul,failure_prediction,anomaly_detection`      |
| status | string | `active,staging,deprecated,training`                         |

**Response 200:**

```json
{
  "success": true,
  "data": [
    {
      "id": "MDL001",
      "name": "Health Score Predictor",
      "version": "v3.2.1",
      "type": "health_score",
      "status": "active",
      "accuracy": 0.942,
      "f1Score": 0.935,
      "precision": 0.948,
      "recall": 0.922,
      "deployedAt": "2026-02-01T00:00:00Z",
      "trainedOn": "2026-01-25T00:00:00Z",
      "datasetSize": 2450000,
      "features": ["temperature", "vibration", "current", "pressure", "runtime_hours"],
      "driftScore": 0.08,
      "confidenceScore": 0.94
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 5, "totalPages": 1 }
}
```

---

### GET /api/models/:id

**Response 200:** Single AIModel object.

---

### POST /api/models/register

Register new model version.

**Request:**

```json
{
  "name": "Energy Optimizer v2",
  "type": "health_score",
  "version": "v2.0.0",
  "features": ["temperature", "vibration", "power_consumption", "ambient_temp"],
  "artifactUrl": "model-artifacts/energy-optimizer/v2.0.0/model.onnx",
  "trainingMetrics": {
    "accuracy": 0.918,
    "f1Score": 0.905,
    "precision": 0.920,
    "recall": 0.891
  }
}
```

**Response 201:** Created AIModel (status = `staging`).

---

### PUT /api/models/:id/deploy

Deploy model to production (status → `active`). Previous active version → `deprecated`.

**Response 200:** Updated AIModel.

**Error:** 409 `MODEL_ALREADY_ACTIVE` | 422 `MODEL_NOT_VALIDATED`

---

### PUT /api/models/:id/deprecate

**Response 200:** Updated AIModel (status → `deprecated`).

---

### GET /api/models/:id/metrics

Performance metrics over time.

**Response 200:**

```json
{
  "success": true,
  "data": {
    "modelId": "MDL001",
    "metrics": [
      { "date": "2026-02-20", "accuracy": 0.945, "driftScore": 0.05, "inferenceLatencyMs": 12 },
      { "date": "2026-02-21", "accuracy": 0.942, "driftScore": 0.06, "inferenceLatencyMs": 13 },
      { "date": "2026-02-22", "accuracy": 0.940, "driftScore": 0.08, "inferenceLatencyMs": 12 }
    ]
  }
}
```

---

## 12. Pipelines — /api/pipelines

**Service:** ml-service (:8086)
**Auth required:** ✅ | **Roles:** data_scientist, super_admin

---

### GET /api/pipelines

**Query params:** `page`, `pageSize`, `status` (`pending,running,completed,failed`), `type` (`train,evaluate,deploy,monitor`)

**Response 200:**

```json
{
  "success": true,
  "data": [
    {
      "id": "PL001",
      "name": "Retrain RUL Estimator",
      "type": "train",
      "status": "running",
      "progress": 65,
      "startedAt": "2026-02-27T08:00:00Z",
      "completedAt": null,
      "triggeredBy": "Hoàng Dũng",
      "modelId": "MDL002",
      "metrics": null
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 3, "totalPages": 1 }
}
```

---

### POST /api/pipelines/trigger

**Request:**

```json
{
  "name": "Retrain Anomaly Detector",
  "type": "train",
  "modelId": "MDL003",
  "config": {
    "epochs": 100,
    "batchSize": 32,
    "dataRange": "90d"
  }
}
```

**Response 201:** Created Pipeline (status = `pending`).

---

### PUT /api/pipelines/:id/cancel

**Response 200:** Updated Pipeline (status → `failed`, stoppedAt populated).

**Error:** 409 `PIPELINE_NOT_RUNNING`

---

## 13. Dashboard — /api/dashboard

**Service:** api-gateway (:8080) — aggregator
**Data source:** Gọi song song equipment + sensor + alert + workorder services → merge
**Auth required:** ✅ | **Roles:** All

---

### GET /api/dashboard/kpi

KPI tổng hợp cho dashboard chính.

**Response 200:**

```json
{
  "success": true,
  "data": {
    "oee": 87.5,
    "oeeTrend": 2.3,
    "mttr": 4.2,
    "mttrTrend": -0.8,
    "openAlerts": 5,
    "criticalAlerts": 2,
    "uptime": 97.8,
    "costSavings": 125000000,
    "totalEquipment": 10,
    "onlineEquipment": 7
  }
}
```

| Field           | Type   | Unit   | Mô tả                                        |
|-----------------|--------|--------|-----------------------------------------------|
| oee             | number | %      | Overall Equipment Effectiveness                |
| oeeTrend        | number | %      | Thay đổi so với tuần trước (+/-)              |
| mttr            | number | hours  | Mean Time To Repair                           |
| mttrTrend       | number | hours  | Thay đổi so với tuần trước (-= tốt hơn)      |
| openAlerts      | number | count  | Alerts chưa resolved                          |
| criticalAlerts  | number | count  | Alerts severity = critical, status = open      |
| uptime          | number | %      | Equipment uptime (running / total)             |
| costSavings     | number | VNĐ    | Chi phí tiết kiệm nhờ predictive maintenance  |
| totalEquipment  | number | count  | Tổng thiết bị                                 |
| onlineEquipment | number | count  | Thiết bị đang running hoặc idle               |

**Cache:** Redis `cache:dashboard:kpi` TTL 30s.

---

### GET /api/dashboard/summary

Factory overview (chi tiết hơn KPI).

**Response 200:**

```json
{
  "success": true,
  "data": {
    "equipmentByStatus": {
      "running": 5,
      "warning": 2,
      "critical": 2,
      "maintenance": 1,
      "offline": 0,
      "idle": 0
    },
    "alertsBySeverity": {
      "critical": 2,
      "high": 2,
      "medium": 2,
      "low": 1,
      "info": 1
    },
    "workOrdersByStatus": {
      "in_progress": 1,
      "assigned": 1,
      "scheduled": 1,
      "completed": 1,
      "verified": 1,
      "approved": 1
    },
    "recentAlerts": [ ... ],
    "upcomingMaintenance": [ ... ]
  }
}
```

---

## 14. Reports — /api/reports

**Service:** api-gateway (:8080) — aggregator
**Data source:** TimescaleDB (OEE), PostgreSQL (cost, work orders), ml-service (AI metrics)
**Auth required:** ✅ | **Roles:** factory_manager, maintenance_manager, super_admin

---

### GET /api/reports/oee

**Query params:**

| Param | Type   | Default | Mô tả               |
|-------|--------|---------|----------------------|
| range | string | 30d     | `7d`, `30d`, `90d`, `1y` |

**Response 200:**

```json
{
  "success": true,
  "data": [
    {
      "date": "2026-02-27",
      "availability": 95.2,
      "performance": 91.5,
      "quality": 98.1,
      "oee": 85.4
    },
    {
      "date": "2026-02-26",
      "availability": 93.8,
      "performance": 89.7,
      "quality": 97.5,
      "oee": 82.1
    }
  ]
}
```

---

### GET /api/reports/maintenance-cost

**Query params:** `range` (`3m`, `6m`, `1y`)

**Response 200:**

```json
{
  "success": true,
  "data": [
    {
      "month": "2026-02",
      "preventive": 44000000,
      "corrective": 38000000,
      "predictive": 32000000,
      "total": 114000000,
      "currency": "VND"
    }
  ]
}
```

---

### GET /api/reports/equipment-reliability

**Response 200:**

```json
{
  "success": true,
  "data": {
    "mtbf": 720,
    "mttr": 4.2,
    "failureRate": 0.0014,
    "byEquipment": [
      { "equipmentId": "EQ001", "name": "Máy CNC Fanuc #01", "mtbf": 1440, "mttr": 2.5, "failureCount": 1 },
      { "equipmentId": "EQ002", "name": "Máy ép thủy lực M09", "mtbf": 360, "mttr": 6.0, "failureCount": 4 }
    ]
  }
}
```

---

### GET /api/reports/pm-compliance

**Response 200:**

```json
{
  "success": true,
  "data": {
    "overallCompliance": 87.5,
    "onTime": 14,
    "late": 2,
    "missed": 0,
    "total": 16,
    "byProductionLine": [
      { "line": "Dây chuyền A", "compliance": 85.0 },
      { "line": "Dây chuyền B", "compliance": 92.0 }
    ]
  }
}
```

---

### GET /api/reports/ai-effectiveness

**Response 200:**

```json
{
  "success": true,
  "data": {
    "predictionAccuracy": 91.2,
    "falsePositiveRate": 3.5,
    "trueAlertRate": 96.5,
    "costSavings": 125000000,
    "preventedDowntimeHours": 48,
    "byModel": [
      { "modelId": "MDL001", "name": "Health Score Predictor", "accuracy": 94.2, "predictions": 1250 },
      { "modelId": "MDL002", "name": "RUL Estimator", "accuracy": 89.1, "predictions": 340 }
    ]
  }
}
```

---

## 15. WebSocket (STOMP)

**Connection:** `ws://localhost:8080/ws` → api-gateway → alert-service
**Protocol:** STOMP over WebSocket
**Auth:** JWT token gửi trong STOMP CONNECT headers

### Connection

```javascript
// Frontend (SockJS + STOMP)
const socket = new SockJS('http://localhost:8080/ws');
const stompClient = Stomp.over(socket);

stompClient.connect(
  { Authorization: 'Bearer ' + token },
  (frame) => {
    // Connected successfully
  }
);
```

### Topics

#### /topic/factory-alerts

Broadcast tất cả alerts mới tới mọi connected clients.

**Message payload:**

```json
{
  "type": "ALERT_CREATED",
  "data": {
    "id": "ALT009",
    "equipmentId": "EQ001",
    "equipmentName": "Máy CNC Fanuc #01",
    "severity": "high",
    "type": "sensor_threshold",
    "title": "Rung động tăng đột biến",
    "status": "open",
    "createdAt": "2026-02-27T10:35:00Z",
    "productionLine": "Dây chuyền A"
  },
  "timestamp": "2026-02-27T10:35:00Z"
}
```

**Event types:** `ALERT_CREATED`, `ALERT_UPDATED`, `ALERT_ACKNOWLEDGED`, `ALERT_RESOLVED`, `ALERT_ESCALATED`

#### /topic/sensor-updates

Real-time sensor data (push mỗi 2-5 giây).

**Message payload:**

```json
{
  "type": "SENSOR_READING",
  "data": {
    "sensorId": "S001",
    "equipmentId": "EQ001",
    "value": 78.5,
    "unit": "°C",
    "status": "warning",
    "timestamp": "2026-02-27T10:35:02Z"
  }
}
```

#### /topic/equipment-status

Equipment status changes.

**Message payload:**

```json
{
  "type": "EQUIPMENT_STATUS_CHANGED",
  "data": {
    "equipmentId": "EQ002",
    "name": "Máy ép thủy lực M09",
    "oldStatus": "warning",
    "newStatus": "critical",
    "healthScore": 31,
    "timestamp": "2026-02-27T10:35:05Z"
  }
}
```

#### /user/queue/notifications

Per-user notifications (filtered by role, department, assignment).

**Message payload:**

```json
{
  "type": "NOTIFICATION",
  "data": {
    "id": "NTF001",
    "title": "Work Order assigned",
    "body": "Bạn được giao WO-2026-0148: Kiểm tra khẩn cấp động cơ băng tải",
    "severity": "high",
    "link": "/work-orders/WO005",
    "read": false,
    "timestamp": "2026-02-27T10:35:10Z"
  }
}
```

---

## 16. gRPC Services

**Proxy:** Envoy gRPC-Web proxy (frontend) hoặc native gRPC (inter-service)
**Proto files:** `api/proto/*/v1/*.proto`

---

### sensor.v1.SensorService

#### StreamSensorData (Server Streaming)

```protobuf
rpc StreamSensorData(StreamSensorRequest) returns (stream SensorReading);

message StreamSensorRequest {
  string sensor_id = 1;
  int32 interval_ms = 2;  // push interval (default: 2000)
}

message SensorReading {
  string sensor_id = 1;
  string equipment_id = 2;
  double value = 3;
  string unit = 4;
  string timestamp = 5;       // ISO 8601
  QualityFlag quality_flag = 6;
}

enum QualityFlag {
  GOOD = 0;
  UNCERTAIN = 1;
  BAD = 2;
}
```

#### GetSensorReading (Unary)

```protobuf
rpc GetSensorReading(GetSensorReadingRequest) returns (SensorReading);

message GetSensorReadingRequest {
  string sensor_id = 1;
}
```

#### BatchGetReadings (Unary)

```protobuf
rpc BatchGetReadings(BatchGetReadingsRequest) returns (BatchGetReadingsResponse);

message BatchGetReadingsRequest {
  repeated string sensor_ids = 1;
}

message BatchGetReadingsResponse {
  repeated SensorReading readings = 1;
}
```

---

### auth.v1.AuthService (Inter-service only)

```protobuf
rpc ValidateToken(ValidateTokenRequest) returns (ValidateTokenResponse);
rpc GetUserPermissions(GetUserPermissionsRequest) returns (GetUserPermissionsResponse);

message ValidateTokenRequest {
  string token = 1;
}

message ValidateTokenResponse {
  bool valid = 1;
  string user_id = 2;
  string username = 3;
  string role = 4;
  repeated string permissions = 5;
}
```

---

### equipment.v1.EquipmentService

```protobuf
rpc GetHealthScore(GetHealthScoreRequest) returns (HealthScoreResponse);
rpc StreamHealthUpdates(StreamHealthRequest) returns (stream HealthScoreResponse);

message GetHealthScoreRequest {
  string equipment_id = 1;
}

message HealthScoreResponse {
  string equipment_id = 1;
  double health_score = 2;
  string status = 3;
  string timestamp = 4;
}
```

---

### ml.v1.MLService

```protobuf
rpc Predict(PredictRequest) returns (PredictResponse);
rpc GetRUL(GetRULRequest) returns (RULResponse);
rpc StreamPredictions(StreamPredictionsRequest) returns (stream PredictResponse);

message PredictRequest {
  string equipment_id = 1;
  string model_id = 2;
  map<string, double> features = 3;
}

message PredictResponse {
  string equipment_id = 1;
  string model_id = 2;
  double prediction = 3;
  double confidence = 4;
  string timestamp = 5;
  map<string, double> feature_importance = 6;
}

message GetRULRequest {
  string equipment_id = 1;
}

message RULResponse {
  string equipment_id = 1;
  double rul_days = 2;
  double confidence = 3;
  double failure_probability_7d = 4;
  double failure_probability_30d = 5;
  string timestamp = 6;
}
```

---

## 17. Error Codes Reference

### Auth errors (AUTH_*)

| Code                       | HTTP | Mô tả                             |
|----------------------------|------|------------------------------------|
| AUTH_INVALID_CREDENTIALS   | 401  | Username/password sai              |
| AUTH_TOKEN_EXPIRED         | 401  | JWT đã hết hạn                    |
| AUTH_TOKEN_INVALID         | 401  | JWT malformed/invalid signature   |
| AUTH_TOKEN_REVOKED         | 401  | JWT đã bị blacklist               |
| AUTH_REFRESH_EXPIRED       | 401  | Refresh token hết hạn             |
| AUTH_REFRESH_REVOKED       | 401  | Refresh token đã dùng/revoke      |
| AUTH_ACCOUNT_LOCKED        | 403  | Tài khoản bị khóa                 |
| AUTH_INSUFFICIENT_ROLE     | 403  | Không đủ quyền (RBAC)             |
| AUTH_TOO_MANY_ATTEMPTS     | 429  | Quá nhiều lần login sai           |

### User errors (USER_*)

| Code                    | HTTP | Mô tả                          |
|-------------------------|------|---------------------------------|
| USER_NOT_FOUND          | 404  | User không tồn tại             |
| USER_USERNAME_EXISTS    | 409  | Username đã có                 |
| USER_EMAIL_EXISTS       | 409  | Email đã có                    |
| USER_CANNOT_DELETE_SELF | 409  | Không thể xóa chính mình      |

### Equipment errors (EQUIPMENT_*)

| Code                             | HTTP | Mô tả                          |
|----------------------------------|------|---------------------------------|
| EQUIPMENT_NOT_FOUND              | 404  | Equipment không tồn tại        |
| EQUIPMENT_ASSET_ID_EXISTS        | 409  | Asset ID đã có                 |
| EQUIPMENT_SERIAL_EXISTS          | 409  | Serial number đã có            |
| EQUIPMENT_HAS_ACTIVE_WORKORDERS  | 409  | Có work orders đang active     |

### Sensor errors (SENSOR_*)

| Code                      | HTTP | Mô tả                           |
|---------------------------|------|----------------------------------|
| SENSOR_NOT_FOUND          | 404  | Sensor không tồn tại            |
| SENSOR_DATA_UNAVAILABLE   | 503  | TimescaleDB/InfluxDB unavailable |

### Alert errors (ALERT_*)

| Code                        | HTTP | Mô tả                              |
|-----------------------------|------|--------------------------------------|
| ALERT_NOT_FOUND             | 404  | Alert không tồn tại                |
| ALERT_ALREADY_ACKNOWLEDGED  | 409  | Đã acknowledge rồi                 |
| ALERT_ALREADY_RESOLVED      | 409  | Đã resolve rồi                     |
| ALERT_INVALID_STATUS        | 409  | Status transition không hợp lệ     |

### Work Order errors (WORKORDER_*)

| Code                              | HTTP | Mô tả                              |
|-----------------------------------|------|--------------------------------------|
| WORKORDER_NOT_FOUND               | 404  | Work order không tồn tại           |
| WORKORDER_INVALID_TRANSITION      | 409  | Status FSM transition không hợp lệ |
| WORKORDER_CHECKLIST_INCOMPLETE    | 422  | Chưa hoàn thành checklist          |
| WORKORDER_ALREADY_COMPLETED       | 409  | WO đã completed/closed              |

### Model errors (MODEL_*)

| Code                    | HTTP | Mô tả                           |
|-------------------------|------|----------------------------------|
| MODEL_NOT_FOUND         | 404  | Model không tồn tại             |
| MODEL_ALREADY_ACTIVE    | 409  | Model đã ở status active        |
| MODEL_NOT_VALIDATED     | 422  | Model chưa qua validation       |

### Pipeline errors (PIPELINE_*)

| Code                   | HTTP | Mô tả                           |
|------------------------|------|----------------------------------|
| PIPELINE_NOT_FOUND     | 404  | Pipeline không tồn tại          |
| PIPELINE_NOT_RUNNING   | 409  | Pipeline không đang running      |
| PIPELINE_ALREADY_RUNNING| 409 | Đã có pipeline đang chạy        |

### Spare Part errors (SPAREPART_*)

| Code                        | HTTP | Mô tả                          |
|-----------------------------|------|---------------------------------|
| SPAREPART_NOT_FOUND         | 404  | Spare part không tồn tại       |
| SPAREPART_PARTNUMBER_EXISTS | 409  | Part number đã có              |
| SPAREPART_INSUFFICIENT_STOCK| 422  | Không đủ tồn kho               |

### Maintenance errors (MAINTENANCE_*)

| Code                        | HTTP | Mô tả                           |
|-----------------------------|------|----------------------------------|
| MAINTENANCE_NOT_FOUND       | 404  | Schedule không tồn tại          |
| MAINTENANCE_INVALID_STATUS  | 409  | Chỉ approve schedule ở planned  |
| MAINTENANCE_DATE_CONFLICT   | 409  | Trùng lịch với maintenance khác |

### General errors

| Code                 | HTTP | Mô tả                              |
|----------------------|------|--------------------------------------|
| VALIDATION_FAILED    | 400  | Request body validation errors       |
| RATE_LIMIT_EXCEEDED  | 429  | Quá giới hạn request                |
| INTERNAL_ERROR       | 500  | Lỗi server không xác định           |
| SERVICE_UNAVAILABLE  | 503  | Downstream service không phản hồi   |

---

## Appendix: Frontend Migration Checklist

Khi chuyển từ mock data sang backend thật, thay đổi theo thứ tự:

```
1. src/environments/environment.ts       → Set apiBaseUrl, wsUrl, grpcUrl
2. src/app/core/services/auth.service.ts → POST /api/auth/login thay mock
3. src/app/core/services/api.service.ts  → Thay tất cả of(MOCK_*).pipe(delay(...))
                                            bằng this.http.get/post/put/delete(...)
4. src/app/core/interceptors/            → Thêm AuthInterceptor (attach JWT)
                                          → Thêm ErrorInterceptor (handle 401 → refresh)
5. Xóa src/app/core/mock/mock-data.ts   → Không cần nữa khi có backend
```

**Mapping nhanh api.service.ts → REST endpoint:**

| Frontend method                    | HTTP Method | Backend Endpoint                    |
|------------------------------------|-------------|--------------------------------------|
| `getKPI()`                         | GET         | `/api/dashboard/kpi`                |
| `getEquipment()`                   | GET         | `/api/equipment`                    |
| `getEquipmentById(id)`             | GET         | `/api/equipment/:id`                |
| `getSensors()`                     | GET         | `/api/sensors`                      |
| `getSensorsByEquipment(eqId)`      | GET         | `/api/sensors/by-equipment/:eqId`   |
| `streamSensorData(sensorId)`       | gRPC        | `sensor.v1.StreamSensorData`        |
| `getSensorTimeSeries(id, hours)`   | GET         | `/api/sensors/:id/data?hours=`      |
| `getAlerts()`                      | GET         | `/api/alerts`                       |
| `getAlertById(id)`                 | GET         | `/api/alerts/:id`                   |
| `acknowledgeAlert(id, userId)`     | PUT         | `/api/alerts/:id/acknowledge`       |
| `subscribeAlerts()`                | WS/STOMP    | `/topic/factory-alerts`             |
| `getWorkOrders()`                  | GET         | `/api/work-orders`                  |
| `getWorkOrderById(id)`             | GET         | `/api/work-orders/:id`              |
| `getMaintenanceSchedules()`        | GET         | `/api/maintenance`                  |
| `getSpareParts()`                  | GET         | `/api/spare-parts`                  |
| `getAIModels()`                    | GET         | `/api/models`                       |
| `getPipelines()`                   | GET         | `/api/pipelines`                    |
| `getUsers()`                       | GET         | `/api/users`                        |
| `getAuditLogs()`                   | GET         | `/api/audit`                        |
| `getOEEHistory()`                  | GET         | `/api/reports/oee?range=30d`        |
| `getMaintenanceCostHistory()`      | GET         | `/api/reports/maintenance-cost?range=6m` |
