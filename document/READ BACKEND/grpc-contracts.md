# Maintenix — gRPC Contracts

> **Smart Predictive Maintenance Warning System**
> 6 proto files, 4 gRPC services, 13 RPC methods. Bao gồm: proto definitions, timeout/retry/circuit breaker config, Envoy gRPC-Web proxy, Go implementation patterns.

---

## Mục lục

1. [Tổng quan gRPC Architecture](#1-tổng-quan-grpc-architecture)
2. [Proto File Structure](#2-proto-file-structure)
3. [common.proto — Shared Types](#3-commonproto--shared-types)
4. [sensor.proto — SensorService](#4-sensorproto--sensorservice)
5. [auth.proto — AuthService](#5-authproto--authservice)
6. [equipment.proto — EquipmentService](#6-equipmentproto--equipmentservice)
7. [ml.proto — MLService](#7-mlproto--mlservice)
8. [Envoy gRPC-Web Proxy](#8-envoy-grpc-web-proxy)
9. [Timeout, Retry & Circuit Breaker](#9-timeout-retry--circuit-breaker)
10. [Go Server Implementation](#10-go-server-implementation)
11. [Go Client Implementation](#11-go-client-implementation)
12. [Angular Frontend (gRPC-Web)](#12-angular-frontend-grpc-web)
13. [Testing & Debugging](#13-testing--debugging)

---

## 1. Tổng quan gRPC Architecture

### 1.1. Vai trò gRPC trong hệ thống

```
┌────────────────────────────────────────────────────────────────────────┐
│                    Maintenix Communication Matrix                      │
│                                                                        │
│  Frontend ←── REST ──→ api-gateway     (CRUD, pagination, bulk ops)    │
│  Frontend ←── WS ───→ api-gateway      (real-time push: alerts, sensor)│
│  Frontend ←── gRPC-Web ──→ Envoy ──→ services  (streaming data)        │
│                                                                        │
│  Service ←── gRPC ──→ Service          (inter-service sync calls)      │
│  Service ←── Kafka ──→ Service         (async events, decoupled)       │
└────────────────────────────────────────────────────────────────────────┘
```

gRPC được dùng cho 2 mục đích:

| Use case | Protocol | Ví dụ |
|----------|----------|-------|
| **Inter-service synchronous** | Native gRPC | api-gateway → auth-service `ValidateToken` trên mọi request |
| **Streaming to frontend** | gRPC-Web (via Envoy) | Dashboard live sensor data, real-time health updates, ML predictions |

### 1.2. Service ports

| Service | REST Port | gRPC Port | gRPC Services |
|---------|-----------|-----------|---------------|
| auth-service | 8081 | **50051** | auth.v1.AuthService |
| equipment-service | 8082 | **50052** | equipment.v1.EquipmentService |
| sensor-service | 8083 | **50053** | sensor.v1.SensorService |
| ml-service | 8086 | **50056** | ml.v1.MLService |
| api-gateway | 8080 | — | (gRPC client only, không expose gRPC server) |
| Envoy proxy | — | **8090** | gRPC-Web → native gRPC translation |

### 1.3. Call frequency

| RPC Method | Caller | Frequency | Latency target |
|------------|--------|-----------|---------------|
| ValidateToken | api-gateway | **~1000 req/s** (mọi HTTP request) | < 5ms (cached) |
| GetUserPermissions | api-gateway | ~100 req/s (RBAC checks) | < 10ms |
| GetSensorReading | dashboard frontend | ~50 req/s | < 20ms |
| StreamSensorData | dashboard frontend | ~10 streams concurrent | ongoing |
| BatchGetReadings | dashboard frontend | ~5 req/min | < 100ms |
| GetHealthScore | equipment detail page | ~20 req/s | < 30ms |
| StreamHealthUpdates | equipment detail page | ~10 streams concurrent | ongoing |
| Predict | alert-service (on anomaly) | ~100 req/min | < 200ms |
| GetRUL | equipment detail page | ~20 req/s | < 100ms |
| StreamPredictions | dashboard frontend | ~5 streams concurrent | ongoing |

---

## 2. Proto File Structure

```
api/proto/
├── buf.yaml                    ← Buf schema registry config
├── buf.gen.yaml                ← Code generation targets
├── common/
│   └── v1/
│       └── common.proto        ← Shared types: Pagination, Timestamp, Error
├── auth/
│   └── v1/
│       └── auth.proto          ← AuthService (ValidateToken, GetUserPermissions)
├── equipment/
│   └── v1/
│       └── equipment.proto     ← EquipmentService (GetHealthScore, StreamHealthUpdates)
├── sensor/
│   └── v1/
│       └── sensor.proto        ← SensorService (StreamSensorData, GetSensorReading, BatchGetReadings)
├── alert/
│   └── v1/
│       └── alert.proto         ← (reserved for future inter-service alert queries)
├── workorder/
│   └── v1/
│       └── workorder.proto     ← (reserved for future inter-service WO queries)
└── ml/
    └── v1/
        └── ml.proto            ← MLService (Predict, GetRUL, StreamPredictions)
```

### buf.yaml

```yaml
version: v1
name: buf.build/maintenix/api
breaking:
  use:
    - FILE
lint:
  use:
    - DEFAULT
  except:
    - PACKAGE_VERSION_SUFFIX
```

### buf.gen.yaml

```yaml
version: v1
plugins:
  - plugin: buf.build/protocolbuffers/go
    out: gen/go
    opt: paths=source_relative
  - plugin: buf.build/grpc/go
    out: gen/go
    opt: paths=source_relative
  - plugin: buf.build/grpc/web         # gRPC-Web cho Angular
    out: gen/web
    opt:
      - import_style=typescript
      - mode=grpcweb
```

### Code generation

```bash
# Makefile target
proto:
	buf generate api/proto
	@echo "✅ Generated Go + TypeScript gRPC code"

# Output structure:
# gen/go/auth/v1/auth.pb.go
# gen/go/auth/v1/auth_grpc.pb.go
# gen/go/sensor/v1/sensor.pb.go
# gen/go/sensor/v1/sensor_grpc.pb.go
# gen/web/sensor/v1/sensor_pb.ts
# gen/web/sensor/v1/SensorServiceClientPb.ts
```

---

## 3. common.proto — Shared Types

```protobuf
syntax = "proto3";
package common.v1;
option go_package = "maintenix/gen/go/common/v1;commonv1";

import "google/protobuf/timestamp.proto";

// ─── Pagination ───

message PaginationRequest {
  int32 page = 1;       // 1-based
  int32 page_size = 2;  // default 20, max 100
}

message PaginationResponse {
  int32 page = 1;
  int32 page_size = 2;
  int64 total = 3;
  int32 total_pages = 4;
}

// ─── Cursor-based pagination (for time-series) ───

message CursorRequest {
  string cursor = 1;     // opaque cursor (base64 encoded timestamp)
  int32 limit = 2;       // default 100, max 1000
  Direction direction = 3;
}

enum Direction {
  DIRECTION_UNSPECIFIED = 0;
  DIRECTION_FORWARD = 1;
  DIRECTION_BACKWARD = 2;
}

message CursorResponse {
  string next_cursor = 1;
  string prev_cursor = 2;
  bool has_more = 3;
}

// ─── Error ───

message Error {
  string code = 1;          // e.g. "SENSOR_NOT_FOUND"
  string message = 2;       // human-readable
  repeated ErrorDetail details = 3;
}

message ErrorDetail {
  string field = 1;
  string description = 2;
}

// ─── Quality Flag ───

enum QualityFlag {
  QUALITY_FLAG_UNSPECIFIED = 0;
  QUALITY_FLAG_GOOD = 1;
  QUALITY_FLAG_UNCERTAIN = 2;
  QUALITY_FLAG_BAD = 3;
}
```

---

## 4. sensor.proto — SensorService

### 4.1. Proto definition

```protobuf
syntax = "proto3";
package sensor.v1;
option go_package = "maintenix/gen/go/sensor/v1;sensorv1";

import "google/protobuf/timestamp.proto";
import "common/v1/common.proto";

// ═══════════════════════════════════════════════════════════════
// SensorService — Real-time sensor data streaming & queries
// Server: sensor-service (:50053)
// Callers: Frontend (gRPC-Web via Envoy), api-gateway, ml-service
// ═══════════════════════════════════════════════════════════════

service SensorService {
  // Server streaming — continuous live sensor readings
  // Frontend subscribes to get real-time values for dashboard charts
  // Connection: long-lived, server pushes new readings as they arrive
  rpc StreamSensorData(StreamSensorDataRequest) returns (stream SensorReading);

  // Unary — single sensor current reading
  rpc GetSensorReading(GetSensorReadingRequest) returns (SensorReading);

  // Unary — batch query multiple sensors at once
  // Used by dashboard to load all sensors for one equipment
  rpc BatchGetReadings(BatchGetReadingsRequest) returns (BatchGetReadingsResponse);
}

// ─── Messages ───

message StreamSensorDataRequest {
  string sensor_id = 1;         // required: which sensor to stream
  int32 interval_ms = 2;        // push interval in ms (default 2000, min 500, max 10000)
}

message GetSensorReadingRequest {
  string sensor_id = 1;         // required
}

message BatchGetReadingsRequest {
  repeated string sensor_ids = 1; // max 50 sensor IDs per request
}

message BatchGetReadingsResponse {
  repeated SensorReading readings = 1;
  int32 total = 2;
  repeated string not_found = 3;  // sensor_ids that don't exist
}

message SensorReading {
  string sensor_id = 1;
  string equipment_id = 2;
  double value = 3;
  string unit = 4;               // °C, mm/s, bar, A, RPM, L/min
  google.protobuf.Timestamp timestamp = 5;
  common.v1.QualityFlag quality_flag = 6;
  SensorStatus status = 7;
  SensorThresholds thresholds = 8;
}

message SensorThresholds {
  optional double warning_low = 1;
  optional double warning_high = 2;
  optional double critical_low = 3;
  optional double critical_high = 4;
}

enum SensorStatus {
  SENSOR_STATUS_UNSPECIFIED = 0;
  SENSOR_STATUS_NORMAL = 1;
  SENSOR_STATUS_WARNING = 2;
  SENSOR_STATUS_CRITICAL = 3;
}
```

### 4.2. Method details

**StreamSensorData (Server Streaming)**

| Property | Value |
|----------|-------|
| Type | Server streaming |
| Caller | Frontend (gRPC-Web), api-gateway |
| Timeout | 30 minutes (long-lived stream) |
| Keepalive | Server ping every 30s |
| Max concurrent streams | 1000 per server |
| Backpressure | Server drops oldest readings if client slow |

```
Client                     sensor-service
  │                              │
  │  StreamSensorDataRequest     │
  │  {sensor_id: "S005",         │
  │   interval_ms: 2000}         │
  │─────────────────────────────→│
  │                              │── Subscribe to Redis pub/sub
  │                              │   channel: sensor:live:S005
  │                              │
  │       SensorReading          │
  │  {sensor_id: "S005",         │
  │   value: 92.0,               │
  │   status: CRITICAL}          │
  │←─────────────────────────────│  ← push every 2s
  │                              │
  │       SensorReading          │
  │  {value: 91.8, ...}          │
  │←─────────────────────────────│  ← push every 2s
  │                              │
  │       SensorReading          │
  │  {value: 92.3, ...}          │
  │←─────────────────────────────│  ← push every 2s
  │           ...                │
```

**GetSensorReading (Unary)**

| Property | Value |
|----------|-------|
| Type | Unary |
| Timeout | 5s |
| Data source | Redis cache → InfluxDB fallback |

**BatchGetReadings (Unary)**

| Property | Value |
|----------|-------|
| Type | Unary |
| Timeout | 10s |
| Max batch size | 50 sensor IDs |
| Data source | Redis MGET → InfluxDB for cache misses |

### 4.3. Error codes

| gRPC Status | Code | Khi nào |
|-------------|------|---------|
| NOT_FOUND | SENSOR_NOT_FOUND | sensor_id không tồn tại |
| INVALID_ARGUMENT | INVALID_INTERVAL | interval_ms < 500 hoặc > 10000 |
| INVALID_ARGUMENT | BATCH_TOO_LARGE | sensor_ids > 50 |
| UNAVAILABLE | DATA_UNAVAILABLE | InfluxDB/Redis down |
| RESOURCE_EXHAUSTED | TOO_MANY_STREAMS | concurrent streams > 1000 |

---

## 5. auth.proto — AuthService

### 5.1. Proto definition

```protobuf
syntax = "proto3";
package auth.v1;
option go_package = "maintenix/gen/go/auth/v1;authv1";

import "google/protobuf/timestamp.proto";

// ═══════════════════════════════════════════════════════════════
// AuthService — Token validation & permission checks
// Server: auth-service (:50051)
// Callers: api-gateway (on EVERY HTTP request), other services
// CRITICAL: High-frequency, MUST be fast (< 5ms p99)
// ═══════════════════════════════════════════════════════════════

service AuthService {
  // Validate JWT token — called by api-gateway on every incoming request
  // api-gateway caches result for 60s keyed by token hash
  rpc ValidateToken(ValidateTokenRequest) returns (ValidateTokenResponse);

  // Get user permissions — called for fine-grained RBAC checks
  rpc GetUserPermissions(GetUserPermissionsRequest) returns (GetUserPermissionsResponse);
}

// ─── Messages ───

message ValidateTokenRequest {
  string token = 1;             // JWT Bearer token (without "Bearer " prefix)
}

message ValidateTokenResponse {
  bool valid = 1;
  string user_id = 2;           // e.g. "U003"
  string username = 3;          // e.g. "engineer"
  string role = 4;              // e.g. "maintenance_engineer"
  repeated string permissions = 5;  // e.g. ["alert:read", "alert:acknowledge", "workorder:create"]
  google.protobuf.Timestamp expires_at = 6;
}

message GetUserPermissionsRequest {
  string user_id = 1;           // required
}

message GetUserPermissionsResponse {
  string user_id = 1;
  string role = 2;
  repeated string permissions = 3;
  repeated string accessible_production_lines = 4;  // data-level filtering
  repeated string accessible_equipment_ids = 5;     // data-level filtering (empty = all)
}
```

### 5.2. Method details

**ValidateToken (Unary) — HOT PATH**

| Property | Value |
|----------|-------|
| Type | Unary |
| Caller | api-gateway |
| Frequency | **~1000 req/s** (mọi HTTP request đi qua gateway) |
| Timeout | **2s** (hard limit — gateway drops request if auth takes longer) |
| Latency target | **< 5ms p99** |
| Caching | api-gateway cache token→result trong Redis (TTL 60s) |

```
Browser → api-gateway → auth-service ValidateToken

Optimization layers:
  1. api-gateway local cache (in-memory LRU, TTL 10s)
  2. api-gateway Redis cache (hash(token) → result, TTL 60s)
  3. auth-service Redis session lookup (session:{userId})
  4. auth-service JWT decode + verify signature (RS256)

Typical path (cached): 1 → hit → < 1ms
Typical path (Redis):  2 → hit → < 3ms
Cold path (full):      4 → verify → < 10ms
```

**Inter-service only:** AuthService KHÔNG exposed qua Envoy/gRPC-Web. Frontend dùng REST `POST /api/auth/login` thay vì gRPC.

### 5.3. Permission model

```
permissions format: "{resource}:{action}"

Resources: user, equipment, sensor, alert, workorder, sparepart, maintenance, model, pipeline, report, audit
Actions:   read, create, update, delete, approve, acknowledge, resolve, execute, verify, deploy

Ví dụ cho role maintenance_engineer:
  "alert:read", "alert:acknowledge", "alert:assign", "alert:resolve",
  "workorder:read", "workorder:create", "workorder:update",
  "equipment:read", "sensor:read", "sparepart:read",
  "model:read", "report:read"
```

### 5.4. Error codes

| gRPC Status | Code | Khi nào |
|-------------|------|---------|
| UNAUTHENTICATED | TOKEN_INVALID | JWT signature invalid |
| UNAUTHENTICATED | TOKEN_EXPIRED | JWT expired |
| UNAUTHENTICATED | TOKEN_REVOKED | Token in blacklist (Redis) |
| NOT_FOUND | USER_NOT_FOUND | user_id không tồn tại |
| INTERNAL | AUTH_SERVICE_ERROR | Database/Redis error |

---

## 6. equipment.proto — EquipmentService

### 6.1. Proto definition

```protobuf
syntax = "proto3";
package equipment.v1;
option go_package = "maintenix/gen/go/equipment/v1;equipmentv1";

import "google/protobuf/timestamp.proto";

// ═══════════════════════════════════════════════════════════════
// EquipmentService — Equipment health monitoring
// Server: equipment-service (:50052)
// Callers: Frontend (gRPC-Web), ml-service, alert-service
// ═══════════════════════════════════════════════════════════════

service EquipmentService {
  // Unary — current health score for a single equipment
  rpc GetHealthScore(GetHealthScoreRequest) returns (HealthScoreResponse);

  // Server streaming — live health score updates
  // Pushes when health_score changes (threshold crossings, ML recalculation)
  rpc StreamHealthUpdates(StreamHealthUpdatesRequest) returns (stream HealthScoreResponse);
}

// ─── Messages ───

message GetHealthScoreRequest {
  string equipment_id = 1;      // required: e.g. "EQ002"
}

message StreamHealthUpdatesRequest {
  string equipment_id = 1;      // required
}

message HealthScoreResponse {
  string equipment_id = 1;
  string name = 2;              // e.g. "Máy ép thủy lực M09"
  double health_score = 3;      // 0-100
  EquipmentStatus status = 4;
  google.protobuf.Timestamp timestamp = 5;
  HealthScoreBreakdown breakdown = 6;
}

message HealthScoreBreakdown {
  double sensor_score = 1;       // 0-100: aggregated from sensor readings
  double maintenance_score = 2;  // 0-100: based on maintenance compliance
  double age_score = 3;          // 0-100: based on equipment age & lifecycle
  double ml_score = 4;           // 0-100: from AI health prediction model
}

enum EquipmentStatus {
  EQUIPMENT_STATUS_UNSPECIFIED = 0;
  EQUIPMENT_STATUS_RUNNING = 1;
  EQUIPMENT_STATUS_WARNING = 2;
  EQUIPMENT_STATUS_CRITICAL = 3;
  EQUIPMENT_STATUS_MAINTENANCE = 4;
  EQUIPMENT_STATUS_OFFLINE = 5;
  EQUIPMENT_STATUS_IDLE = 6;
}
```

### 6.2. Method details

**GetHealthScore (Unary)**

| Property | Value |
|----------|-------|
| Type | Unary |
| Timeout | 5s |
| Data source | Redis cache (`equipment:health:{id}`, TTL 5min) → PostgreSQL |

**StreamHealthUpdates (Server Streaming)**

| Property | Value |
|----------|-------|
| Type | Server streaming |
| Timeout | 30 minutes |
| Push frequency | On change only (health score recalculated every 5 min, or on event) |

```
Client                       equipment-service
  │                                 │
  │  StreamHealthUpdatesRequest     │
  │  {equipment_id: "EQ002"}        │
  │────────────────────────────────→│
  │                                 │── Subscribe Redis pub/sub
  │                                 │   channel: equipment:health:EQ002
  │                                 │
  │       HealthScoreResponse       │
  │  {health_score: 31,             │
  │   status: CRITICAL,             │
  │   breakdown: {                  │
  │     sensor_score: 22,           │  ← sensor S004+S005 cả 2 critical
  │     maintenance_score: 40,      │  ← overdue maintenance
  │     age_score: 65,              │  ← 7 years old (2019)
  │     ml_score: 28}}              │  ← AI predicted low health
  │←────────────────────────────────│  ← push when score changes
  │           ...                   │
```

### 6.3. Health score calculation

```
health_score = weighted_average(
  sensor_score      × 0.35,    // real-time sensor data
  maintenance_score × 0.25,    // PM compliance
  age_score         × 0.15,    // equipment lifecycle
  ml_score          × 0.25     // AI prediction
)

Ví dụ EQ002 (Máy ép M09):
  sensor_score      = 22  (S004 critical + S005 critical → penalty)
  maintenance_score = 40  (overdue PM, recent corrective WO)
  age_score         = 65  (7 năm, lifecycle 15 năm → 53% used)
  ml_score          = 28  (MDL001 predicts low health)
  
  health_score = (22×0.35 + 40×0.25 + 65×0.15 + 28×0.25) = 34.2 ≈ 31 (with rounding + penalties)

Status thresholds:
  health_score ≥ 70  → RUNNING
  health_score ≥ 35  → WARNING
  health_score < 35  → CRITICAL
```

### 6.4. Error codes

| gRPC Status | Code | Khi nào |
|-------------|------|---------|
| NOT_FOUND | EQUIPMENT_NOT_FOUND | equipment_id không tồn tại |
| UNAVAILABLE | SERVICE_UNAVAILABLE | PostgreSQL/Redis down |

---

## 7. ml.proto — MLService

### 7.1. Proto definition

```protobuf
syntax = "proto3";
package ml.v1;
option go_package = "maintenix/gen/go/ml/v1;mlv1";

import "google/protobuf/timestamp.proto";
import "google/protobuf/struct.proto";

// ═══════════════════════════════════════════════════════════════
// MLService — AI/ML predictions (RUL, anomaly, failure mode)
// Server: ml-service (:50056)
// Callers: Frontend (gRPC-Web), alert-service, equipment-service
// ═══════════════════════════════════════════════════════════════

service MLService {
  // Unary — run single prediction for an equipment
  rpc Predict(PredictRequest) returns (PredictResponse);

  // Unary — get Remaining Useful Life estimate
  rpc GetRUL(GetRULRequest) returns (RULResponse);

  // Server streaming — continuous predictions as new sensor data arrives
  rpc StreamPredictions(StreamPredictionsRequest) returns (stream PredictResponse);
}

// ─── Messages ───

message PredictRequest {
  string equipment_id = 1;      // required
  string model_id = 2;          // optional: specific model; empty = active model for equipment
  google.protobuf.Struct features = 3;  // optional: override features; empty = auto-extract from latest sensor data
}

message PredictResponse {
  string equipment_id = 1;
  string model_id = 2;
  string model_name = 3;
  string model_version = 4;
  PredictionType prediction_type = 5;
  double prediction = 6;          // primary prediction value
  double confidence = 7;          // 0.0 - 1.0
  google.protobuf.Timestamp timestamp = 8;
  google.protobuf.Struct feature_importance = 9;  // feature → importance weight
  repeated ContributingFactor contributing_factors = 10;
}

message GetRULRequest {
  string equipment_id = 1;      // required
}

message RULResponse {
  string equipment_id = 1;
  string model_id = 2;
  int32 rul_days = 3;              // Remaining Useful Life in days
  double confidence = 4;           // 0.0 - 1.0
  double failure_probability_7d = 5;   // probability of failure within 7 days
  double failure_probability_30d = 6;  // probability of failure within 30 days
  google.protobuf.Timestamp timestamp = 7;
  repeated ContributingFactor contributing_factors = 8;
}

message StreamPredictionsRequest {
  string equipment_id = 1;      // required
}

message ContributingFactor {
  string factor = 1;            // e.g. "Cách điện cuộn dây suy giảm"
  int32 impact = 2;             // 0-100 percentage
}

enum PredictionType {
  PREDICTION_TYPE_UNSPECIFIED = 0;
  PREDICTION_TYPE_HEALTH_SCORE = 1;
  PREDICTION_TYPE_RUL = 2;
  PREDICTION_TYPE_FAILURE_MODE = 3;
  PREDICTION_TYPE_ANOMALY = 4;
}
```

### 7.2. Method details

**Predict (Unary)**

| Property | Value |
|----------|-------|
| Type | Unary |
| Timeout | **10s** (model inference can be expensive) |
| Model loading | ONNX Runtime, models cached in memory from MinIO |

```
Predict flow:

  1. Load model artifact from memory cache (or MinIO if cold)
  2. If features empty → extract from latest sensor readings (Redis/InfluxDB)
  3. Feature preprocessing (normalization, rolling window stats)
  4. ONNX Runtime inference
  5. Post-processing (sigmoid, softmax, denormalization)
  6. Return PredictResponse

Ví dụ (EQ009, MDL002 RUL):
  Request:
    equipment_id: "EQ009"
    model_id: "" (empty → auto-select active RUL model = MDL002)
    features: {} (empty → auto-extract)

  Auto-extracted features:
    vibration_trend: 0.85
    temperature_trend: 0.72
    maintenance_history: 3
    age: 7
    load_factor: 0.92

  Response:
    prediction: 14.0 (RUL days)
    confidence: 0.89
    prediction_type: PREDICTION_TYPE_RUL
    feature_importance: {vibration_trend: 0.35, temperature_trend: 0.25, age: 0.20, ...}
    contributing_factors: [{factor: "Cách điện cuộn dây suy giảm", impact: 40}, ...]
```

**GetRUL (Unary)**

| Property | Value |
|----------|-------|
| Type | Unary |
| Timeout | 10s |
| Shortcut | Calls Predict internally with active RUL model, returns simplified response |

**StreamPredictions (Server Streaming)**

| Property | Value |
|----------|-------|
| Type | Server streaming |
| Timeout | 30 minutes |
| Push frequency | Every 5 minutes (batch inference cycle) |
| Data source | Consumes sensor.processed from Kafka, runs inference, pushes result |

### 7.3. Error codes

| gRPC Status | Code | Khi nào |
|-------------|------|---------|
| NOT_FOUND | EQUIPMENT_NOT_FOUND | equipment_id không tồn tại |
| NOT_FOUND | MODEL_NOT_FOUND | model_id không tồn tại |
| FAILED_PRECONDITION | NO_ACTIVE_MODEL | Không có model active cho prediction type |
| FAILED_PRECONDITION | INSUFFICIENT_DATA | Không đủ sensor data để extract features |
| INTERNAL | INFERENCE_ERROR | ONNX Runtime error |
| DEADLINE_EXCEEDED | INFERENCE_TIMEOUT | Model inference vượt 10s |

---

## 8. Envoy gRPC-Web Proxy

### 8.1. Tại sao cần Envoy?

Browser không hỗ trợ native gRPC (HTTP/2 binary framing). gRPC-Web là protocol trung gian:

```
Angular SPA (gRPC-Web client)
    │
    │  HTTP/1.1 or HTTP/2
    │  Content-Type: application/grpc-web+proto
    │
    ▼
Envoy Proxy (:8090)
    │
    │  Native gRPC (HTTP/2)
    │
    ├──→ sensor-service (:50053)
    ├──→ equipment-service (:50052)
    └──→ ml-service (:50056)
```

### 8.2. Envoy configuration

```yaml
# deploy/envoy/envoy.yaml
static_resources:
  listeners:
    - name: grpc_web_listener
      address:
        socket_address:
          address: 0.0.0.0
          port_value: 8090
      filter_chains:
        - filters:
            - name: envoy.filters.network.http_connection_manager
              typed_config:
                "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
                codec_type: AUTO
                stat_prefix: grpc_web
                route_config:
                  name: local_route
                  virtual_hosts:
                    - name: grpc_services
                      domains: ["*"]
                      routes:
                        # Sensor service
                        - match:
                            prefix: "/sensor.v1.SensorService"
                          route:
                            cluster: sensor_service
                            timeout: 1800s   # 30 min for streaming
                            max_stream_duration:
                              grpc_timeout_header_max: 1800s
                        # Equipment service
                        - match:
                            prefix: "/equipment.v1.EquipmentService"
                          route:
                            cluster: equipment_service
                            timeout: 1800s
                        # ML service
                        - match:
                            prefix: "/ml.v1.MLService"
                          route:
                            cluster: ml_service
                            timeout: 30s     # shorter for unary calls
                      cors:
                        allow_origin_string_match:
                          - prefix: "http://localhost"
                          - prefix: "https://maintenix.vn"
                        allow_methods: "GET, PUT, DELETE, POST, OPTIONS"
                        allow_headers: "authorization,content-type,x-grpc-web,x-user-agent,grpc-timeout"
                        expose_headers: "grpc-status,grpc-message"
                        max_age: "1728000"
                http_filters:
                  - name: envoy.filters.http.grpc_web
                    typed_config:
                      "@type": type.googleapis.com/envoy.extensions.filters.http.grpc_web.v3.GrpcWeb
                  - name: envoy.filters.http.cors
                    typed_config:
                      "@type": type.googleapis.com/envoy.extensions.filters.http.cors.v3.Cors
                  - name: envoy.filters.http.router
                    typed_config:
                      "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router

  clusters:
    - name: sensor_service
      connect_timeout: 5s
      type: STRICT_DNS
      lb_policy: ROUND_ROBIN
      typed_extension_protocol_options:
        envoy.extensions.upstreams.http.v3.HttpProtocolOptions:
          "@type": type.googleapis.com/envoy.extensions.upstreams.http.v3.HttpProtocolOptions
          explicit_http_config:
            http2_protocol_options: {}
      load_assignment:
        cluster_name: sensor_service
        endpoints:
          - lb_endpoints:
              - endpoint:
                  address:
                    socket_address:
                      address: sensor-service
                      port_value: 50053

    - name: equipment_service
      connect_timeout: 5s
      type: STRICT_DNS
      lb_policy: ROUND_ROBIN
      typed_extension_protocol_options:
        envoy.extensions.upstreams.http.v3.HttpProtocolOptions:
          "@type": type.googleapis.com/envoy.extensions.upstreams.http.v3.HttpProtocolOptions
          explicit_http_config:
            http2_protocol_options: {}
      load_assignment:
        cluster_name: equipment_service
        endpoints:
          - lb_endpoints:
              - endpoint:
                  address:
                    socket_address:
                      address: equipment-service
                      port_value: 50052

    - name: ml_service
      connect_timeout: 5s
      type: STRICT_DNS
      lb_policy: ROUND_ROBIN
      typed_extension_protocol_options:
        envoy.extensions.upstreams.http.v3.HttpProtocolOptions:
          "@type": type.googleapis.com/envoy.extensions.upstreams.http.v3.HttpProtocolOptions
          explicit_http_config:
            http2_protocol_options: {}
      load_assignment:
        cluster_name: ml_service
        endpoints:
          - lb_endpoints:
              - endpoint:
                  address:
                    socket_address:
                      address: ml-service
                      port_value: 50056
```

### 8.3. Docker compose

```yaml
envoy:
  image: envoyproxy/envoy:v1.29-latest
  ports:
    - "8090:8090"
  volumes:
    - ./deploy/envoy/envoy.yaml:/etc/envoy/envoy.yaml:ro
  depends_on:
    - sensor-service
    - equipment-service
    - ml-service
```

---

## 9. Timeout, Retry & Circuit Breaker

### 9.1. Timeout matrix

| RPC Method | Client deadline | Server timeout | Envoy route timeout |
|------------|----------------|----------------|-------------------|
| ValidateToken | **2s** | 2s | N/A (not via Envoy) |
| GetUserPermissions | 5s | 5s | N/A |
| GetSensorReading | 5s | 5s | 30s |
| StreamSensorData | **30 min** | 30 min | **1800s** |
| BatchGetReadings | 10s | 10s | 30s |
| GetHealthScore | 5s | 5s | 30s |
| StreamHealthUpdates | **30 min** | 30 min | **1800s** |
| Predict | **10s** | 10s | 30s |
| GetRUL | 10s | 10s | 30s |
| StreamPredictions | **30 min** | 30 min | **1800s** |

### 9.2. Retry policy

```go
// pkg/grpc/client.go — shared retry config

import "google.golang.org/grpc"

func DefaultRetryPolicy() grpc.DialOption {
    return grpc.WithDefaultServiceConfig(`{
        "methodConfig": [{
            "name": [{}],
            "retryPolicy": {
                "maxAttempts": 4,
                "initialBackoff": "0.1s",
                "maxBackoff": "1s",
                "backoffMultiplier": 2.0,
                "retryableStatusCodes": [
                    "UNAVAILABLE",
                    "DEADLINE_EXCEEDED"
                ]
            }
        }]
    }`)
}
```

| Attempt | Wait | Total elapsed |
|---------|------|--------------|
| 1 | 0ms (immediate) | 0ms |
| 2 | 100ms | 100ms |
| 3 | 200ms | 300ms |
| 4 | 400ms | 700ms |
| Fail | — | 700ms + RPC time |

**Exceptions — NO retry cho:**
- `INVALID_ARGUMENT` (client bug, retry won't help)
- `NOT_FOUND` (data doesn't exist)
- `PERMISSION_DENIED` (auth issue)
- `UNAUTHENTICATED` (token expired → refresh token thay vì retry)
- Streaming RPCs (client should reconnect stream)

### 9.3. Circuit breaker

```go
// pkg/grpc/circuit_breaker.go
import "github.com/sony/gobreaker"

func NewCircuitBreaker(name string) *gobreaker.CircuitBreaker {
    return gobreaker.NewCircuitBreaker(gobreaker.Settings{
        Name:        name,
        MaxRequests: 1,                           // half-open: allow 1 probe
        Interval:    10 * time.Second,             // rolling window
        Timeout:     30 * time.Second,             // open → half-open after 30s
        ReadyToTrip: func(counts gobreaker.Counts) bool {
            return counts.ConsecutiveFailures >= 5  // 5 consecutive failures → open
        },
        OnStateChange: func(name string, from, to gobreaker.State) {
            logger.Warn("circuit breaker state change",
                zap.String("name", name),
                zap.String("from", from.String()),
                zap.String("to", to.String()))
            metrics.CircuitBreakerState.WithLabelValues(name, to.String()).Set(1)
        },
    })
}
```

```
Circuit Breaker States:

CLOSED (normal)
  │ 5 consecutive gRPC failures
  ▼
OPEN (all calls fail-fast with UNAVAILABLE)
  │ after 30 seconds
  ▼
HALF-OPEN (allow 1 probe request)
  │
  ├── probe success → CLOSED
  └── probe failure → OPEN (another 30s)
```

Circuit breaker per-service:

| Client | Target | CB name | Impact khi OPEN |
|--------|--------|---------|-----------------|
| api-gateway | auth-service | `auth-cb` | ALL requests return 503 (critical!) |
| api-gateway | sensor-service | `sensor-cb` | Sensor data unavailable, dashboard stale |
| api-gateway | equipment-service | `equipment-cb` | Health scores stale |
| alert-service | ml-service | `ml-predict-cb` | No AI predictions, only threshold alerts |
| equipment-service | ml-service | `ml-health-cb` | Health score uses only sensor+maintenance weights |

### 9.4. Keepalive settings

```go
// Server-side keepalive
grpcServer := grpc.NewServer(
    grpc.KeepaliveParams(keepalive.ServerParameters{
        MaxConnectionIdle:     5 * time.Minute,   // close idle connection after 5m
        MaxConnectionAge:      30 * time.Minute,   // force reconnect after 30m (load balancing)
        MaxConnectionAgeGrace: 10 * time.Second,   // grace period for in-flight
        Time:                  30 * time.Second,   // ping client every 30s
        Timeout:               10 * time.Second,   // wait 10s for pong
    }),
    grpc.KeepaliveEnforcementPolicy(keepalive.EnforcementPolicy{
        MinTime:             10 * time.Second,    // min interval between client pings
        PermitWithoutStream: true,                 // allow pings even without active streams
    }),
)

// Client-side keepalive
conn, _ := grpc.Dial(target,
    grpc.WithKeepaliveParams(keepalive.ClientParameters{
        Time:                30 * time.Second,    // ping server every 30s
        Timeout:             10 * time.Second,
        PermitWithoutStream: true,
    }),
)
```

---

## 10. Go Server Implementation

### 10.1. Server bootstrap

```go
// services/sensor-service/internal/grpc/server.go

package grpc

import (
    "net"
    "google.golang.org/grpc"
    "google.golang.org/grpc/reflection"
    sensorv1 "maintenix/gen/go/sensor/v1"
)

type SensorServer struct {
    sensorv1.UnimplementedSensorServiceServer
    sensorSvc  service.SensorService
    redisPubSub *redis.PubSub
}

func NewSensorServer(svc service.SensorService, rdb *redis.Client) *SensorServer {
    return &SensorServer{
        sensorSvc: svc,
        redisPubSub: rdb,
    }
}

func StartGRPCServer(srv *SensorServer, port string) error {
    lis, err := net.Listen("tcp", ":"+port)
    if err != nil {
        return err
    }

    grpcServer := grpc.NewServer(
        grpc.ChainUnaryInterceptor(
            interceptors.LoggingInterceptor(),
            interceptors.MetricsInterceptor(),
            interceptors.RecoveryInterceptor(),
            interceptors.TracingInterceptor(),
        ),
        grpc.ChainStreamInterceptor(
            interceptors.StreamLoggingInterceptor(),
            interceptors.StreamMetricsInterceptor(),
            interceptors.StreamRecoveryInterceptor(),
        ),
        // keepalive settings (see Section 9.4)
    )

    sensorv1.RegisterSensorServiceServer(grpcServer, srv)
    reflection.Register(grpcServer) // enable grpcurl inspection

    log.Info("gRPC server listening", zap.String("port", port))
    return grpcServer.Serve(lis)
}
```

### 10.2. StreamSensorData implementation

```go
func (s *SensorServer) StreamSensorData(
    req *sensorv1.StreamSensorDataRequest,
    stream sensorv1.SensorService_StreamSensorDataServer,
) error {
    // Validate
    if req.SensorId == "" {
        return status.Error(codes.InvalidArgument, "sensor_id is required")
    }
    interval := time.Duration(req.IntervalMs) * time.Millisecond
    if interval < 500*time.Millisecond {
        interval = 2 * time.Second
    }

    // Subscribe to Redis pub/sub for live readings
    ctx := stream.Context()
    pubsub := s.redisPubSub.Subscribe(ctx, "sensor:live:"+req.SensorId)
    defer pubsub.Close()

    ticker := time.NewTicker(interval)
    defer ticker.Stop()

    for {
        select {
        case <-ctx.Done():
            return nil // client disconnected

        case <-ticker.C:
            reading, err := s.sensorSvc.GetLatestReading(ctx, req.SensorId)
            if err != nil {
                continue // skip this tick, don't break stream
            }
            if err := stream.Send(toProtoReading(reading)); err != nil {
                return err // stream broken
            }
        }
    }
}
```

---

## 11. Go Client Implementation

### 11.1. Client factory

```go
// pkg/grpc/client_factory.go

func NewAuthClient(addr string) (authv1.AuthServiceClient, *grpc.ClientConn, error) {
    conn, err := grpc.Dial(addr,
        grpc.WithTransportCredentials(insecure.NewCredentials()), // dev only
        DefaultRetryPolicy(),
        grpc.WithKeepaliveParams(defaultClientKeepalive),
        grpc.WithChainUnaryInterceptor(
            interceptors.ClientTracingInterceptor(),
            interceptors.ClientMetricsInterceptor(),
            interceptors.ClientTimeoutInterceptor(2*time.Second), // 2s default
        ),
    )
    if err != nil {
        return nil, nil, err
    }
    return authv1.NewAuthServiceClient(conn), conn, nil
}
```

### 11.2. api-gateway ValidateToken usage

```go
// services/api-gateway/internal/middleware/auth.go

func (m *AuthMiddleware) Authenticate() gin.HandlerFunc {
    return func(c *gin.Context) {
        token := extractBearerToken(c)
        if token == "" {
            c.AbortWithStatusJSON(401, gin.H{"error": "missing token"})
            return
        }

        // 1. Check local cache
        if cached, ok := m.localCache.Get(token); ok {
            setUserContext(c, cached.(*authv1.ValidateTokenResponse))
            c.Next()
            return
        }

        // 2. Check Redis cache
        cacheKey := "auth:token:" + hashToken(token)
        if cached, err := m.redis.Get(c, cacheKey).Bytes(); err == nil {
            var resp authv1.ValidateTokenResponse
            proto.Unmarshal(cached, &resp)
            m.localCache.Set(token, &resp, 10*time.Second)
            setUserContext(c, &resp)
            c.Next()
            return
        }

        // 3. gRPC call (with circuit breaker)
        result, err := m.authCB.Execute(func() (interface{}, error) {
            ctx, cancel := context.WithTimeout(c, 2*time.Second)
            defer cancel()
            return m.authClient.ValidateToken(ctx, &authv1.ValidateTokenRequest{Token: token})
        })
        if err != nil {
            c.AbortWithStatusJSON(503, gin.H{"error": "auth service unavailable"})
            return
        }

        resp := result.(*authv1.ValidateTokenResponse)
        if !resp.Valid {
            c.AbortWithStatusJSON(401, gin.H{"error": "invalid token"})
            return
        }

        // Cache result
        data, _ := proto.Marshal(resp)
        m.redis.Set(c, cacheKey, data, 60*time.Second)
        m.localCache.Set(token, resp, 10*time.Second)

        setUserContext(c, resp)
        c.Next()
    }
}
```

---

## 12. Angular Frontend (gRPC-Web)

### 12.1. Setup

```bash
# Install dependencies
npm install grpc-web google-protobuf @improbable-eng/grpc-web
```

### 12.2. Environment config

```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8080/api',
  wsUrl: 'ws://localhost:8080/ws',
  grpcUrl: 'http://localhost:8090',       // Envoy gRPC-Web proxy
};
```

### 12.3. Sensor streaming service

```typescript
// src/app/core/services/grpc-sensor.service.ts

import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { grpc } from '@improbable-eng/grpc-web';
import { SensorService } from '../../../gen/web/sensor/v1/SensorServiceClientPb';
import { StreamSensorDataRequest, SensorReading } from '../../../gen/web/sensor/v1/sensor_pb';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class GrpcSensorService {
  private client: SensorService;

  constructor() {
    this.client = new SensorService(environment.grpcUrl);
  }

  streamSensorData(sensorId: string, intervalMs: number = 2000): Observable<SensorReading> {
    const subject = new Subject<SensorReading>();

    const request = new StreamSensorDataRequest();
    request.setSensorId(sensorId);
    request.setIntervalMs(intervalMs);

    const stream = this.client.streamSensorData(request, {
      'authorization': `Bearer ${localStorage.getItem('token')}`,
    });

    stream.on('data', (reading: SensorReading) => {
      subject.next(reading);
    });

    stream.on('error', (err) => {
      console.error('Stream error:', err);
      subject.error(err);
    });

    stream.on('end', () => {
      subject.complete();
    });

    return subject.asObservable();
  }
}
```

### 12.4. Usage in component

```typescript
// sensor-detail.component.ts

export class SensorDetailComponent implements OnInit, OnDestroy {
  private subscription?: Subscription;

  constructor(private grpcSensor: GrpcSensorService) {}

  ngOnInit() {
    this.subscription = this.grpcSensor
      .streamSensorData('S005', 2000)
      .subscribe({
        next: (reading) => {
          this.currentValue = reading.getValue();
          this.status = reading.getStatus();
          this.chartData.push({ time: new Date(), value: reading.getValue() });
        },
        error: (err) => {
          console.error('Sensor stream error, falling back to REST polling');
          this.startRestPolling();
        }
      });
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe(); // closes gRPC stream
  }
}
```

---

## 13. Testing & Debugging

### 13.1. grpcurl — CLI testing

```bash
# Install
go install github.com/fullstorydev/grpcurl/cmd/grpcurl@latest

# List services (requires reflection enabled)
grpcurl -plaintext localhost:50053 list
# → sensor.v1.SensorService

# List methods
grpcurl -plaintext localhost:50053 list sensor.v1.SensorService
# → sensor.v1.SensorService.BatchGetReadings
# → sensor.v1.SensorService.GetSensorReading
# → sensor.v1.SensorService.StreamSensorData

# Describe method
grpcurl -plaintext localhost:50053 describe sensor.v1.SensorService.StreamSensorData

# Unary call: GetSensorReading
grpcurl -plaintext -d '{"sensor_id": "S005"}' \
  localhost:50053 sensor.v1.SensorService/GetSensorReading

# Unary call: BatchGetReadings
grpcurl -plaintext -d '{"sensor_ids": ["S001", "S004", "S005"]}' \
  localhost:50053 sensor.v1.SensorService/BatchGetReadings

# Server streaming: StreamSensorData (Ctrl+C to stop)
grpcurl -plaintext -d '{"sensor_id": "S005", "interval_ms": 2000}' \
  localhost:50053 sensor.v1.SensorService/StreamSensorData

# Auth: ValidateToken
grpcurl -plaintext -d '{"token": "eyJ..."}' \
  localhost:50051 auth.v1.AuthService/ValidateToken

# ML: GetRUL
grpcurl -plaintext -d '{"equipment_id": "EQ009"}' \
  localhost:50056 ml.v1.MLService/GetRUL

# ML: Predict with custom features
grpcurl -plaintext -d '{
  "equipment_id": "EQ002",
  "features": {
    "fields": {
      "temperature": {"number_value": 92},
      "vibration": {"number_value": 4.2},
      "pressure": {"number_value": 185}
    }
  }
}' localhost:50056 ml.v1.MLService/Predict
```

### 13.2. Go integration tests

```go
// internal/grpc/server_test.go

func TestStreamSensorData(t *testing.T) {
    // Setup: start gRPC server with mock service
    lis := bufconn.Listen(1024 * 1024)
    srv := grpc.NewServer()
    sensorv1.RegisterSensorServiceServer(srv, &mockSensorServer{})
    go srv.Serve(lis)
    defer srv.Stop()

    // Connect
    conn, _ := grpc.Dial("bufnet",
        grpc.WithContextDialer(func(ctx context.Context, s string) (net.Conn, error) {
            return lis.Dial()
        }),
        grpc.WithTransportCredentials(insecure.NewCredentials()),
    )
    defer conn.Close()
    client := sensorv1.NewSensorServiceClient(conn)

    // Call streaming RPC
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    stream, err := client.StreamSensorData(ctx, &sensorv1.StreamSensorDataRequest{
        SensorId:   "S005",
        IntervalMs: 500,
    })
    require.NoError(t, err)

    // Read 3 messages
    for i := 0; i < 3; i++ {
        reading, err := stream.Recv()
        require.NoError(t, err)
        assert.Equal(t, "S005", reading.SensorId)
        assert.Equal(t, "EQ002", reading.EquipmentId)
        assert.Greater(t, reading.Value, 80.0)
    }
}
```

### 13.3. Prometheus metrics

```
# Exposed by gRPC interceptors

# Server-side
grpc_server_handled_total{grpc_service="sensor.v1.SensorService",grpc_method="GetSensorReading",grpc_code="OK"} 1234
grpc_server_handling_seconds_bucket{grpc_service="sensor.v1.SensorService",grpc_method="GetSensorReading",le="0.005"} 1100
grpc_server_msg_sent_total{grpc_service="sensor.v1.SensorService",grpc_method="StreamSensorData"} 98765

# Client-side (api-gateway → auth-service)
grpc_client_handled_total{grpc_service="auth.v1.AuthService",grpc_method="ValidateToken",grpc_code="OK"} 567890
grpc_client_handling_seconds_bucket{grpc_service="auth.v1.AuthService",grpc_method="ValidateToken",le="0.005"} 560000
```

### 13.4. Common issues & troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `UNAVAILABLE: connection refused` | gRPC server not started or wrong port | Check service logs, verify port in config |
| `DEADLINE_EXCEEDED` on ValidateToken | auth-service slow, Redis/PG overloaded | Check auth-service latency, scale up Redis |
| `CORS error` in browser console | Envoy CORS config missing allowed origin | Add origin to `allow_origin_string_match` |
| gRPC-Web stream disconnects after 30s | Envoy route timeout too short | Set `timeout: 1800s` for streaming routes |
| `stream terminated by RST_STREAM` | Keepalive mismatch between client/server | Align keepalive settings (Section 9.4) |
| `too many open streams` | Client not closing streams properly | Ensure `ngOnDestroy` unsubscribes |
| Circuit breaker OPEN | Target service down > 5 failures | Check target service health, wait 30s for half-open |
