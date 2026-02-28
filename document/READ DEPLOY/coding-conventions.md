# Maintenix — Coding Conventions

> **Smart Predictive Maintenance Warning System**
> Quy ước viết code thống nhất cho Backend (Go), Frontend (Angular/TypeScript), Database (SQL), Protobuf (gRPC), Kafka Events, Docker, Git.
> Mục tiêu: code dễ đọc, dễ review, dễ maintain trong team 3-5 người.

---

## Mục lục

1. [Nguyên tắc Chung](#1-nguyên-tắc-chung)
2. [Go — Naming Conventions](#2-go--naming-conventions)
3. [Go — Code Structure & Patterns](#3-go--code-structure--patterns)
4. [Go — Error Handling](#4-go--error-handling)
5. [Go — Logging](#5-go--logging)
6. [Go — Testing Conventions](#6-go--testing-conventions)
7. [Go — Concurrency Patterns](#7-go--concurrency-patterns)
8. [TypeScript / Angular — Naming Conventions](#8-typescript--angular--naming-conventions)
9. [TypeScript / Angular — Component Patterns](#9-typescript--angular--component-patterns)
10. [TypeScript / Angular — Service Patterns](#10-typescript--angular--service-patterns)
11. [TypeScript / Angular — Template & Styling](#11-typescript--angular--template--styling)
12. [REST API — Design Conventions](#12-rest-api--design-conventions)
13. [Protobuf & gRPC — Conventions](#13-protobuf--grpc--conventions)
14. [Kafka Events — Conventions](#14-kafka-events--conventions)
15. [Database & SQL — Conventions](#15-database--sql--conventions)
16. [Git — Commit & Branch Conventions](#16-git--commit--branch-conventions)
17. [Docker & Deployment — Conventions](#17-docker--deployment--conventions)
18. [Code Review Checklist](#18-code-review-checklist)

---

## 1. Nguyên tắc Chung

### 1.1. Triết lý

```
┌────────────────────────────────────────────────────────────────────────┐
│                     Maintenix Coding Principles                        │
│                                                                        │
│  1. READABLE   — Code viết cho người đọc, không cho compiler          │
│  2. EXPLICIT   — Rõ ràng hơn ngắn gọn. Tên biến nói lên mục đích    │
│  3. CONSISTENT — Cùng pattern cho cùng loại vấn đề. Không trộn style │
│  4. TESTABLE   — Clean Architecture: mock được, inject được           │
│  5. SMALL      — Functions < 30 dòng, files < 300 dòng, PRs < 400    │
│  6. SAFE       — Handle mọi error. Không panic. Validate mọi input   │
└────────────────────────────────────────────────────────────────────────┘
```

### 1.2. Language Rules

| Ngôn ngữ | Formatter | Linter | Config file |
|-----------|-----------|--------|-------------|
| Go | `gofmt` (built-in) | `golangci-lint` | `.golangci.yml` |
| TypeScript | `prettier` | `eslint` | `.prettierrc`, `.eslintrc.json` |
| HTML | `prettier` | `eslint-plugin-angular` | `.prettierrc` |
| SCSS | `prettier` | `stylelint` (optional) | `.prettierrc` |
| SQL | — | — | Manual review |
| Proto | `buf format` | `buf lint` | `buf.yaml` |
| YAML | `prettier` | `yamllint` (optional) | `.prettierrc` |

### 1.3. Editor Config

```ini
# .editorconfig (root)
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space

[*.go]
indent_style = tab
indent_size = 4

[*.{ts,html,scss,json,yaml,yml}]
indent_size = 2

[*.proto]
indent_size = 2

[*.md]
trim_trailing_whitespace = false

[Makefile]
indent_style = tab
```

---

## 2. Go — Naming Conventions

### 2.1. Packages

```go
// ✅ GOOD: lowercase, single word, no underscores
package service
package handler
package repository
package domain
package kafka

// ❌ BAD
package equipmentService    // camelCase
package equipment_service   // snake_case
package handlers            // plural (trừ khi thật sự cần)
package utils               // quá chung chung — chia nhỏ ra
package common              // quá mơ hồ — dùng tên cụ thể
```

### 2.2. Files

```
// Pattern: <noun>_<qualifier>.go
equipment.go                 // Domain entity
equipment_service.go         // Service layer
equipment_handler.go         // HTTP handler
equipment_repo.go            // Repository implementation
equipment_service_test.go    // Test file (Go convention: _test.go)

// Không dùng:
equipmentService.go          // ❌ camelCase filename
EquipmentHandler.go          // ❌ PascalCase filename
eqSvc.go                     // ❌ viết tắt không rõ nghĩa
```

### 2.3. Variables & Functions

```go
// ── Exported (PascalCase) — visible ngoài package ──
type Equipment struct { ... }
type EquipmentRepository interface { ... }
func NewEquipmentService(...) *EquipmentService { ... }
func (s *EquipmentService) Create(ctx context.Context, req CreateRequest) (*Equipment, error) { ... }

// ── Unexported (camelCase) — private trong package ──
type equipmentCache struct { ... }
func (s *EquipmentService) validateInput(req CreateRequest) error { ... }
func buildFilterQuery(filter EquipmentFilter) string { ... }

// ── Variables ──
var (
    maxRetries     = 3                    // camelCase cho unexported
    DefaultTimeout = 30 * time.Second     // PascalCase cho exported
)

// ── Constants ──
const (
    StatusRunning     = "running"          // PascalCase + semantic prefix
    StatusWarning     = "warning"
    StatusCritical    = "critical"
    StatusMaintenance = "maintenance"
    StatusOffline     = "offline"
)

// ── Enums (dùng custom type) ──
type EquipmentStatus string

const (
    EquipmentStatusRunning     EquipmentStatus = "running"
    EquipmentStatusWarning     EquipmentStatus = "warning"
    EquipmentStatusCritical    EquipmentStatus = "critical"
    EquipmentStatusMaintenance EquipmentStatus = "maintenance"
)

// ── Interfaces ──
// Go convention: interface tên suffix -er cho single method, hoặc mô tả hành vi
type EquipmentRepository interface { ... }  // ✅ noun-based cho large interfaces
type EventProducer interface { ... }        // ✅
type HealthCalculator interface { ... }     // ✅
type Reader interface { Read() }            // ✅ -er suffix cho single-method

// ❌ BAD interface naming
type IEquipmentRepo interface { ... }       // ❌ Prefix I (Java/C# style)
type EquipmentRepoInterface interface { }   // ❌ suffix Interface
```

### 2.4. Acronyms & Initialisms

```go
// Go convention: Acronyms giữ nguyên case
type HTTPHandler struct {}     // ✅ (không HttpHandler)
type JSONResponse struct {}    // ✅ (không JsonResponse)
type SQLDB struct {}           // ✅ 
type SLAConfig struct {}       // ✅
type UserID string             // ✅ (không UserId)

func ParseJWT(token string) {}  // ✅
func NewHTTPServer() {}         // ✅
func GetOEE() float64 {}       // ✅
func GetRUL() int {}            // ✅ (Remaining Useful Life)

// Cho unexported:
var userID string               // ✅
var httpClient *http.Client     // ✅
var slaDeadline time.Time       // ✅
```

### 2.5. Receiver Names

```go
// 1-2 ký tự viết tắt từ type name, nhất quán trong cùng type
func (s *EquipmentService) Create() {}     // ✅ s cho Service
func (s *EquipmentService) GetByID() {}    // ✅ cùng s

func (h *EquipmentHandler) List() {}       // ✅ h cho Handler
func (r *equipmentRepo) Create() {}        // ✅ r cho Repository

// ❌ BAD
func (self *EquipmentService) Create() {}  // ❌ self (Python style)
func (this *EquipmentService) Create() {}  // ❌ this (Java style)
func (svc *EquipmentService) Create() {}   // ❌ quá dài
func (e *EquipmentService) Create() {}     // ⚠️ OK nhưng dễ nhầm với error
```

---

## 3. Go — Code Structure & Patterns

### 3.1. Clean Architecture — Layer Rules

```
┌─────────────────────────────────────────────────────────────┐
│                    Dependency Direction                     │
│                                                             │
│   handler → service → domain ← repository                   │
│     (HTTP)    (logic)  (entities   (DB access)              │
│                         + interfaces)                       │
│                                                             │
│   Rule: domain/ KHÔNG import bất kỳ package nào khác        │
│         handler/ KHÔNG import repository/ trực tiếp         │
│         service/ chỉ depend domain interfaces               │
└─────────────────────────────────────────────────────────────┘
```

### 3.2. Domain Layer — Entities & Interfaces

```go
// internal/domain/equipment.go

package domain

import "time"

// ── Entity ──
type Equipment struct {
    ID               string            `json:"id"`
    AssetID          string            `json:"assetId"`
    Name             string            `json:"name"`
    SerialNumber     string            `json:"serialNumber"`
    Type             EquipmentType     `json:"type"`
    Manufacturer     string            `json:"manufacturer"`
    Model            string            `json:"model"`
    YearManufactured int               `json:"yearManufactured"`
    Location         EquipmentLocation `json:"location"`
    Status           EquipmentStatus   `json:"status"`
    HealthScore      int               `json:"healthScore"`
    CreatedAt        time.Time         `json:"createdAt"`
    UpdatedAt        time.Time         `json:"updatedAt"`
}

// ── Value Object ──
type EquipmentLocation struct {
    Building       string `json:"building"`
    Floor          string `json:"floor"`
    ProductionLine string `json:"productionLine"`
    Workstation    string `json:"workstation"`
}

// ── Repository Interface (domain định nghĩa, repository implement) ──
type EquipmentRepository interface {
    Create(ctx context.Context, eq *Equipment) error
    GetByID(ctx context.Context, id string) (*Equipment, error)
    List(ctx context.Context, filter EquipmentFilter, pg Pagination) ([]*Equipment, int64, error)
    Update(ctx context.Context, eq *Equipment) error
    Delete(ctx context.Context, id string) error
    ExistsByAssetID(ctx context.Context, assetID string) (bool, error)
}

// ── Request/Response DTOs ──
type CreateEquipmentRequest struct {
    AssetID          string            `json:"assetId"      validate:"required,min=3,max=50"`
    Name             string            `json:"name"         validate:"required,min=2,max=100"`
    Type             EquipmentType     `json:"type"         validate:"required,oneof=cnc_machine press conveyor pump compressor robot"`
    Manufacturer     string            `json:"manufacturer" validate:"required"`
    YearManufactured int               `json:"yearManufactured" validate:"required,min=1990,max=2030"`
    Location         EquipmentLocation `json:"location"     validate:"required"`
}

// ── Filter & Pagination ──
type EquipmentFilter struct {
    Status   string `json:"status"`
    Type     string `json:"type"`
    Building string `json:"building"`
    Search   string `json:"search"`
}

type Pagination struct {
    Page     int `json:"page"     validate:"min=1"`
    PageSize int `json:"pageSize" validate:"min=1,max=100"`
}
```

### 3.3. Service Layer Pattern

```go
// internal/service/equipment_service.go

package service

import (
    "context"
    "fmt"
    "time"

    "github.com/google/uuid"
    "maintenix/services/equipment-service/internal/domain"
    "maintenix/pkg/errors"
)

// ── Constructor: inject dependencies via interfaces ──
type EquipmentService struct {
    repo  domain.EquipmentRepository
    kafka domain.EventProducer
}

func NewEquipmentService(repo domain.EquipmentRepository, kafka domain.EventProducer) *EquipmentService {
    return &EquipmentService{repo: repo, kafka: kafka}
}

// ── Method: Arrange-Act-Return pattern ──
func (s *EquipmentService) Create(ctx context.Context, req domain.CreateEquipmentRequest) (*domain.Equipment, error) {
    // 1. Validate business rules
    exists, err := s.repo.ExistsByAssetID(ctx, req.AssetID)
    if err != nil {
        return nil, fmt.Errorf("check asset ID: %w", err)
    }
    if exists {
        return nil, errors.Conflict("EQUIPMENT_ASSET_ID_EXISTS",
            fmt.Sprintf("Asset ID '%s' already exists", req.AssetID))
    }

    // 2. Build entity
    eq := &domain.Equipment{
        ID:               uuid.New().String(),
        AssetID:          req.AssetID,
        Name:             req.Name,
        Type:             req.Type,
        Manufacturer:     req.Manufacturer,
        YearManufactured: req.YearManufactured,
        Location:         req.Location,
        Status:           domain.EquipmentStatusRunning,
        HealthScore:      100,
        CreatedAt:        time.Now(),
        UpdatedAt:        time.Now(),
    }

    // 3. Persist
    if err := s.repo.Create(ctx, eq); err != nil {
        return nil, fmt.Errorf("create equipment: %w", err)
    }

    // 4. Publish event (fire-and-forget, log error)
    _ = s.kafka.Publish(ctx, "maintenix.equipment.status", eq.ID, eq)

    return eq, nil
}
```

### 3.4. Handler Layer Pattern

```go
// internal/handler/equipment_handler.go

package handler

import (
    "net/http"

    "github.com/gin-gonic/gin"
    "maintenix/pkg/errors"
    "maintenix/pkg/response"
)

type EquipmentHandler struct {
    svc *service.EquipmentService
}

func NewEquipmentHandler(svc *service.EquipmentService) *EquipmentHandler {
    return &EquipmentHandler{svc: svc}
}

// ── Method: Parse → Validate → Call Service → Respond ──
func (h *EquipmentHandler) Create(c *gin.Context) {
    // 1. Parse request body
    var req domain.CreateEquipmentRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        response.Error(c, http.StatusBadRequest, "VALIDATION_FAILED", err.Error())
        return
    }

    // 2. Call service
    result, err := h.svc.Create(c.Request.Context(), req)
    if err != nil {
        // Map domain error → HTTP status
        response.FromError(c, err)
        return
    }

    // 3. Success response
    response.Created(c, result)
}

func (h *EquipmentHandler) List(c *gin.Context) {
    filter := domain.EquipmentFilter{
        Status:   c.Query("status"),
        Type:     c.Query("type"),
        Building: c.Query("building"),
        Search:   c.Query("search"),
    }
    pg := parsePagination(c)  // helper: extract page, pageSize from query

    items, total, err := h.svc.List(c.Request.Context(), filter, pg)
    if err != nil {
        response.FromError(c, err)
        return
    }

    response.Paginated(c, items, pg.Page, pg.PageSize, total)
}
```

### 3.5. Router Registration

```go
// internal/router/router.go

func Setup(r *gin.Engine, h *handler.EquipmentHandler, auth gin.HandlerFunc) {
    api := r.Group("/api", auth)
    {
        eq := api.Group("/equipment")
        {
            eq.GET("", h.List)
            eq.GET("/:id", h.GetByID)
            eq.POST("", h.Create)
            eq.PUT("/:id", h.Update)
            eq.DELETE("/:id", h.Delete)
            eq.GET("/:id/history", h.GetHistory)
        }
    }
}
```

### 3.6. Dependency Injection — Wire-up (`cmd/main.go`)

```go
func main() {
    // 1. Load config
    cfg := config.Load()

    // 2. Connect infrastructure
    db := database.NewPostgres(cfg.Database)
    redisClient := database.NewRedis(cfg.Redis)
    kafkaProducer := kafka.NewProducer(cfg.Kafka)

    // 3. Build layers (bottom-up)
    repo := repository.NewEquipmentRepository(db)
    svc := service.NewEquipmentService(repo, kafkaProducer)
    h := handler.NewEquipmentHandler(svc)

    // 4. Setup router
    r := gin.Default()
    authMiddleware := middleware.NewAuthMiddleware(cfg.Auth)
    router.Setup(r, h, authMiddleware)

    // 5. Start servers
    go startGRPCServer(cfg.GRPC, svc)
    r.Run(cfg.HTTPPort)
}
```

---

## 4. Go — Error Handling

### 4.1. Custom Error Types

```go
// pkg/errors/errors.go

type AppError struct {
    Code    string `json:"code"`
    Message string `json:"message"`
    Status  int    `json:"-"`
}

func (e *AppError) Error() string {
    return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

// ── Constructors ──
func NotFound(code, message string) *AppError {
    return &AppError{Code: code, Message: message, Status: 404}
}

func Conflict(code, message string) *AppError {
    return &AppError{Code: code, Message: message, Status: 409}
}

func BadRequest(code, message string) *AppError {
    return &AppError{Code: code, Message: message, Status: 400}
}

func Unauthorized(code, message string) *AppError {
    return &AppError{Code: code, Message: message, Status: 401}
}

func Forbidden(code, message string) *AppError {
    return &AppError{Code: code, Message: message, Status: 403}
}

func Internal(code, message string) *AppError {
    return &AppError{Code: code, Message: message, Status: 500}
}
```

### 4.2. Error Code Convention

```
Pattern: DOMAIN_ACTION_REASON

Ví dụ:
  EQUIPMENT_NOT_FOUND           → Equipment không tìm thấy
  EQUIPMENT_ASSET_ID_EXISTS     → Asset ID đã tồn tại
  ALERT_ALREADY_ACKNOWLEDGED    → Alert đã được acknowledge
  AUTH_TOKEN_EXPIRED            → JWT hết hạn
  WORKORDER_INVALID_TRANSITION  → Work order FSM transition sai
  SENSOR_DATA_UNAVAILABLE       → TimescaleDB/InfluxDB không available
  VALIDATION_FAILED             → Request body validation lỗi
  INTERNAL_ERROR                → Lỗi server không xác định
```

### 4.3. Error Wrapping Rules

```go
// ✅ GOOD: Wrap error với context — giữ nguyên error chain
func (s *EquipmentService) GetByID(ctx context.Context, id string) (*domain.Equipment, error) {
    eq, err := s.repo.GetByID(ctx, id)
    if err != nil {
        return nil, fmt.Errorf("get equipment by ID %s: %w", id, err)
    }
    if eq == nil {
        return nil, errors.NotFound("EQUIPMENT_NOT_FOUND",
            fmt.Sprintf("Equipment with ID '%s' not found", id))
    }
    return eq, nil
}

// ✅ GOOD: Handler maps domain error → HTTP response
func (h *EquipmentHandler) GetByID(c *gin.Context) {
    result, err := h.svc.GetByID(c.Request.Context(), c.Param("id"))
    if err != nil {
        response.FromError(c, err)  // AppError → status code, other → 500
        return
    }
    response.OK(c, result)
}

// ❌ BAD: Swallow error
result, _ := s.repo.GetByID(ctx, id)

// ❌ BAD: Wrap mà mất error chain
return nil, fmt.Errorf("failed: %s", err)  // %s thay vì %w

// ❌ BAD: Return generic error
return nil, fmt.Errorf("something went wrong")
```

### 4.4. Panic Rules

```go
// Rule: KHÔNG BAO GIỜ panic trong production code
// Chỉ panic khi: programmer error mà không thể recover

// ✅ OK to panic:
func MustParseConfig(path string) *Config {
    // Fail at startup = acceptable
    cfg, err := parseConfig(path)
    if err != nil {
        panic(fmt.Sprintf("invalid config %s: %v", path, err))
    }
    return cfg
}

// ❌ NEVER panic in handlers/services:
func (h *Handler) Create(c *gin.Context) {
    // NEVER: panic("unexpected state")
    // ALWAYS: return error
}
```

---

## 5. Go — Logging

### 5.1. Structured Logging (Zap)

```go
// ── Dùng structured fields, KHÔNG dùng string concatenation ──

// ✅ GOOD
logger.Info("equipment created",
    zap.String("equipmentId", eq.ID),
    zap.String("assetId", eq.AssetID),
    zap.String("type", string(eq.Type)),
    zap.Duration("duration", time.Since(start)),
)

logger.Error("failed to create equipment",
    zap.Error(err),
    zap.String("assetId", req.AssetID),
)

// ❌ BAD
logger.Info("Equipment " + eq.ID + " created in " + time.Since(start).String())
log.Printf("Error creating equipment: %v", err)
fmt.Println("debug:", eq.ID)
```

### 5.2. Log Levels

| Level | Khi nào dùng | Ví dụ |
|-------|-------------|-------|
| `Debug` | Chi tiết cho development. Tắt ở production | Query SQL, request body, cache hit/miss |
| `Info` | Event quan trọng trong business flow | User login, equipment created, alert acknowledged |
| `Warn` | Không phải lỗi nhưng cần chú ý | SLA gần breach, stock gần hết, retry attempt |
| `Error` | Lỗi cần fix nhưng hệ thống vẫn chạy | DB query fail, Kafka produce fail, external API timeout |
| `Fatal` | Lỗi nghiêm trọng, service phải dừng | DB connection fail lúc startup, config invalid |

### 5.3. Sensitive Data — KHÔNG log

```go
// KHÔNG BAO GIỜ log các thông tin sau:
// - Password, JWT token, API key, secret
// - Mã OTP, refresh token
// - Thông tin cá nhân nhạy cảm (CMND, số tài khoản)

// ✅ GOOD
logger.Info("user authenticated", zap.String("userId", user.ID), zap.String("role", user.Role))

// ❌ BAD
logger.Info("user login", zap.String("password", password), zap.String("token", jwtToken))
```

---

## 6. Go — Testing Conventions

### 6.1. Naming

```go
// Pattern: Test<Struct>_<Method>_<Scenario>
func TestEquipmentService_Create_Success(t *testing.T) {}
func TestEquipmentService_Create_DuplicateAssetID(t *testing.T) {}
func TestEquipmentService_GetByID_NotFound(t *testing.T) {}
func TestAlertService_CheckSLABreach_EscalatesCritical(t *testing.T) {}

// Table-driven: Test<Struct>_<Method>
func TestWorkOrderService_TransitionStatus(t *testing.T) {
    tests := []struct {
        name       string
        fromStatus domain.WorkOrderStatus
        toStatus   domain.WorkOrderStatus
        wantErr    bool
    }{ ... }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) { ... })
    }
}

// Benchmark: Benchmark<Function>
func BenchmarkAnomalyDetector_ZScore(b *testing.B) {}
```

### 6.2. AAA Pattern — Arrange-Act-Assert

```go
func TestEquipmentService_Create_Success(t *testing.T) {
    // Arrange — setup mocks, input data
    mockRepo := mocks.NewMockEquipmentRepository(t)
    mockKafka := mocks.NewMockEventProducer(t)
    svc := service.NewEquipmentService(mockRepo, mockKafka)

    mockRepo.EXPECT().ExistsByAssetID(mock.Anything, "A-CNC-099").Return(false, nil)
    mockRepo.EXPECT().Create(mock.Anything, mock.Anything).Return(nil)
    mockKafka.EXPECT().Publish(mock.Anything, mock.Anything, mock.Anything).Return(nil)

    // Act — gọi method cần test
    result, err := svc.Create(context.Background(), domain.CreateEquipmentRequest{
        AssetID: "A-CNC-099",
        Name:    "Máy CNC mới",
        Type:    domain.EquipmentTypeCNC,
    })

    // Assert — kiểm tra kết quả
    require.NoError(t, err)
    assert.Equal(t, "A-CNC-099", result.AssetID)
    assert.Equal(t, 100, result.HealthScore)
    mockRepo.AssertExpectations(t)
}
```

### 6.3. Build Tags

```go
//go:build unit
package service_test      // Unit tests — không cần DB, Docker

//go:build integration
package repository_test   // Integration tests — cần real DB (testcontainers)
```

---

## 7. Go — Concurrency Patterns

### 7.1. Context Propagation

```go
// ✅ GOOD: Luôn truyền context, kiểm tra cancellation
func (s *SensorService) ProcessReading(ctx context.Context, reading domain.SensorReading) error {
    select {
    case <-ctx.Done():
        return ctx.Err()
    default:
    }

    // ... processing logic ...
    return s.repo.Save(ctx, reading)
}

// ❌ BAD: Dùng context.Background() trong business logic
func (s *SensorService) ProcessReading(reading domain.SensorReading) error {
    return s.repo.Save(context.Background(), reading)
}
```

### 7.2. Goroutine Safety

```go
// ✅ GOOD: WaitGroup cho parallel operations
func (s *DashboardService) GetKPI(ctx context.Context) (*KPI, error) {
    var (
        wg           sync.WaitGroup
        eqCount      int
        alertCount   int
        eqErr, alErr error
    )

    wg.Add(2)
    go func() {
        defer wg.Done()
        eqCount, eqErr = s.equipmentRepo.Count(ctx)
    }()
    go func() {
        defer wg.Done()
        alertCount, alErr = s.alertRepo.CountOpen(ctx)
    }()
    wg.Wait()

    if eqErr != nil { return nil, eqErr }
    if alErr != nil { return nil, alErr }

    return &KPI{TotalEquipment: eqCount, OpenAlerts: alertCount}, nil
}

// ✅ GOOD: Channel cho graceful shutdown
func (c *KafkaConsumer) Start(ctx context.Context) error {
    for {
        select {
        case <-ctx.Done():
            return nil // graceful stop
        case msg := <-c.messages:
            if err := c.process(ctx, msg); err != nil {
                c.logger.Error("process message failed", zap.Error(err))
            }
        }
    }
}
```

---

## 8. TypeScript / Angular — Naming Conventions

### 8.1. Files

```
// Pattern: <name>.<type>.ts
equipment.component.ts         // Component
equipment-detail.component.ts  // Multi-word: kebab-case
auth.service.ts                // Service
auth.guard.ts                  // Guard
api.interceptor.ts             // Interceptor
index.ts                       // Barrel export (models)
mock-data.ts                   // Mock data

// Test files: <name>.<type>.spec.ts
equipment.component.spec.ts
auth.service.spec.ts
role.guard.spec.ts
```

### 8.2. Classes & Interfaces

```typescript
// ── Classes: PascalCase ──
export class EquipmentComponent { }
export class AuthService { }
export class RoleGuard { }

// ── Interfaces: PascalCase, KHÔNG prefix I ──
export interface Equipment { }       // ✅
export interface CreateEquipmentRequest { }
export interface IEquipment { }      // ❌ prefix I (C# style)

// ── Type aliases: PascalCase ──
export type EquipmentStatus = 'running' | 'warning' | 'critical' | 'maintenance' | 'offline';
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type UserRole = 'super_admin' | 'factory_manager' | ... ;

// ── Enums: PascalCase members ──
export enum MaintenanceType {
    Preventive = 'preventive',
    Predictive = 'predictive',
    Corrective = 'corrective',
    Emergency  = 'emergency',
}
```

### 8.3. Variables & Methods

```typescript
// ── Properties: camelCase ──
healthScore: number;
lastMaintenanceDate: string;
isAuthenticated: boolean;

// ── Methods: camelCase, verb-first ──
getEquipment(): Observable<Equipment[]> { }
createWorkOrder(req: CreateRequest): Observable<WorkOrder> { }
acknowledgeAlert(id: string): Observable<Alert> { }

// ── Private: prefix _ KHÔNG dùng, dùng private keyword ──
private authState = new BehaviorSubject<AuthState>(...);   // ✅
private _authState = ...;                                    // ❌

// ── Constants: UPPER_SNAKE_CASE cho true constants ──
const MAX_RETRIES = 3;
const API_BASE_URL = 'http://localhost:8080/api';

// ── Role arrays: UPPER_SNAKE_CASE ──
const ALL_ROLES = ['super_admin', 'factory_manager', ...];
const ADMIN_ROLES = ['super_admin'];
const OPS_ROLES = ['super_admin', 'factory_manager', ...];

// ── Observable suffix: $ ──
authState$: Observable<AuthState>;   // ✅
alerts$: Observable<Alert[]>;        // ✅
loading$: Observable<boolean>;       // ✅
```

### 8.4. Selectors (Components)

```typescript
// Pattern: app-<feature-name>
@Component({ selector: 'app-dashboard', ... })        // ✅
@Component({ selector: 'app-equipment-detail', ... })  // ✅
@Component({ selector: 'app-alert-list', ... })        // ✅

// Shared components:
@Component({ selector: 'app-loading-spinner', ... })   // ✅
@Component({ selector: 'app-confirm-dialog', ... })    // ✅

// ❌ BAD
@Component({ selector: 'dashboard', ... })             // ❌ thiếu prefix
@Component({ selector: 'appDashboard', ... })          // ❌ camelCase
```

---

## 9. TypeScript / Angular — Component Patterns

### 9.1. Standalone Components (Angular 17+)

```typescript
@Component({
    selector: 'app-equipment',
    standalone: true,
    imports: [
        // 1. Angular core modules
        CommonModule, RouterModule, FormsModule,
        // 2. UI library modules
        NzTableModule, NzButtonModule, NzTagModule,
        // 3. Third-party
        NgxEchartsModule,
    ],
    template: `...`,
    styles: [`...`]
})
export class EquipmentComponent implements OnInit, OnDestroy {
    // ── 1. Injected services (inject() function — Angular 14+) ──
    private api = inject(ApiService);
    private auth = inject(AuthService);
    private router = inject(Router);

    // ── 2. Public properties (bound to template) ──
    equipment: Equipment[] = [];
    loading = true;
    searchText = '';

    // ── 3. Private properties ──
    private destroy$ = new Subject<void>();

    // ── 4. Lifecycle hooks ──
    ngOnInit(): void {
        this.loadData();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    // ── 5. Public methods (called from template) ──
    onSearch(): void { ... }
    onRowClick(id: string): void { ... }

    // ── 6. Private methods ──
    private loadData(): void {
        this.api.getEquipment()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (data) => { this.equipment = data; this.loading = false; },
                error: (err) => { console.error(err); this.loading = false; }
            });
    }
}
```

### 9.2. Subscription Cleanup — Bắt buộc

```typescript
// ✅ GOOD: takeUntil pattern — unsubscribe tự động
private destroy$ = new Subject<void>();

ngOnInit(): void {
    this.api.getAlerts()
        .pipe(takeUntil(this.destroy$))
        .subscribe(data => this.alerts = data);
}

ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
}

// ✅ GOOD: async pipe — tự unsubscribe
// template: *ngFor="let alert of alerts$ | async"
alerts$ = this.api.getAlerts();

// ❌ BAD: subscription leak
ngOnInit() {
    this.api.getAlerts().subscribe(data => this.alerts = data);
    // Không unsubscribe → memory leak!
}
```

---

## 10. TypeScript / Angular — Service Patterns

### 10.1. Service Structure

```typescript
@Injectable({ providedIn: 'root' })
export class ApiService {
    private http = inject(HttpClient);
    private baseUrl = environment.apiBaseUrl;

    // ── CRUD methods: verb + noun ──
    getEquipment(): Observable<Equipment[]> {
        return this.http.get<ApiResponse<Equipment[]>>(`${this.baseUrl}/equipment`)
            .pipe(map(res => res.data));
    }

    getEquipmentById(id: string): Observable<Equipment> {
        return this.http.get<ApiResponse<Equipment>>(`${this.baseUrl}/equipment/${id}`)
            .pipe(map(res => res.data));
    }

    createEquipment(req: CreateEquipmentRequest): Observable<Equipment> {
        return this.http.post<ApiResponse<Equipment>>(`${this.baseUrl}/equipment`, req)
            .pipe(map(res => res.data));
    }

    updateEquipment(id: string, req: UpdateEquipmentRequest): Observable<Equipment> {
        return this.http.put<ApiResponse<Equipment>>(`${this.baseUrl}/equipment/${id}`, req)
            .pipe(map(res => res.data));
    }

    deleteEquipment(id: string): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/equipment/${id}`);
    }
}
```

### 10.2. API Response Type

```typescript
// Khớp với backend response format
interface ApiResponse<T> {
    success: boolean;
    data: T;
    meta?: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
    timestamp: string;
    requestId: string;
}

interface ApiError {
    success: false;
    error: {
        code: string;
        message: string;
        details?: Record<string, string>;
    };
}
```

---

## 11. TypeScript / Angular — Template & Styling

### 11.1. Template Rules

```html
<!-- ✅ GOOD: Inline template cho small components -->
@Component({
  template: `
    <div class="equipment-card">
      <h3>{{ equipment.name }}</h3>
      <nz-tag [nzColor]="getStatusColor(equipment.status)">
        {{ equipment.status }}
      </nz-tag>
    </div>
  `
})

<!-- Rules: -->
<!-- 1. *ngIf kiểm tra null trước khi render -->
<div *ngIf="equipment">{{ equipment.name }}</div>

<!-- 2. trackBy cho *ngFor — performance -->
<tr *ngFor="let item of items; trackBy: trackById">

<!-- 3. Event binding: on prefix -->
<button (click)="onSave()">Save</button>
<input (input)="onSearch($event)">

<!-- 4. Không logic phức tạp trong template -->
<!-- ❌ BAD -->
<span>{{ items.filter(i => i.status === 'active').length }}</span>
<!-- ✅ GOOD — dùng getter hoặc method -->
<span>{{ activeCount }}</span>
```

### 11.2. CSS/SCSS — Tailwind + Custom

```scss
// ── Dùng Tailwind utilities cho layout, spacing, colors ──
// ── Custom CSS cho component-specific styles ──

// Naming: BEM-like cho custom classes
.equipment-card { }
.equipment-card__header { }
.equipment-card__status { }
.equipment-card--critical { }

// ── Biến CSS cho theme consistency ──
:host {
    --maintenix-primary: #6366f1;
    --maintenix-danger: #ef4444;
    --maintenix-warning: #f59e0b;
    --maintenix-success: #10b981;
}

// ── Không dùng !important (trừ override ng-zorro) ──
// ── Không dùng inline styles (trừ dynamic values) ──
```

---

## 12. REST API — Design Conventions

### 12.1. URL Pattern

```
/api/<resource>                    GET (list), POST (create)
/api/<resource>/:id                GET (detail), PUT (update), DELETE
/api/<resource>/:id/<sub-resource> GET, POST
/api/<resource>/:id/<action>       PUT (status changes)

Ví dụ cụ thể:
  GET    /api/equipment                    → List equipment
  POST   /api/equipment                    → Create equipment
  GET    /api/equipment/EQ001              → Get by ID
  PUT    /api/equipment/EQ001              → Update
  DELETE /api/equipment/EQ001              → Delete
  GET    /api/equipment/EQ001/history      → Sub-resource
  PUT    /api/alerts/ALT001/acknowledge    → Action
  PUT    /api/work-orders/WO001/status     → Status transition

Quy tắc:
  • Resource name: plural, kebab-case (work-orders, spare-parts)
  • ID parameter: :id
  • Query params: camelCase (pageSize, sortBy, equipmentId)
  • Nesting tối đa 2 level: /resource/:id/sub-resource
```

### 12.2. Response Format — Bắt buộc

```jsonc
// Success
{
    "success": true,
    "data": { ... },            // Object hoặc Array
    "meta": {                   // Chỉ cho paginated responses
        "page": 1,
        "pageSize": 20,
        "total": 150,
        "totalPages": 8
    },
    "timestamp": "2026-02-28T10:30:00Z",
    "requestId": "req-abc123"
}

// Error
{
    "success": false,
    "error": {
        "code": "EQUIPMENT_NOT_FOUND",     // DOMAIN_ACTION_REASON
        "message": "Equipment with ID 'EQ999' not found",
        "details": {}                       // Optional: field-level errors
    },
    "timestamp": "2026-02-28T10:30:00Z",
    "requestId": "req-abc123"
}
```

### 12.3. HTTP Status Codes

| Code | Dùng khi | Ví dụ |
|------|---------|-------|
| 200 | GET success, PUT success | List, detail, update |
| 201 | POST tạo resource mới | Create equipment, create work order |
| 204 | DELETE success (no body) | Delete equipment |
| 400 | Validation lỗi, malformed request | Missing required field |
| 401 | Chưa authenticate | Token missing, expired, invalid |
| 403 | Không đủ quyền (RBAC) | Viewer cố tạo equipment |
| 404 | Resource không tìm thấy | Equipment ID không tồn tại |
| 409 | Conflict / Business rule vi phạm | Duplicate asset ID, invalid FSM transition |
| 422 | Unprocessable entity | Checklist chưa hoàn thành |
| 429 | Rate limit | Quá nhiều requests |
| 500 | Server error không xác định | Unexpected panic, DB down |
| 503 | Service unavailable | Downstream dependency down |

---

## 13. Protobuf & gRPC — Conventions

### 13.1. Proto File Conventions

```protobuf
// api/proto/equipment/v1/equipment.proto

syntax = "proto3";

// Package: <domain>.v1
package equipment.v1;

// Go package option: bắt buộc
option go_package = "maintenix/api/gen/equipment/v1;equipmentv1";

import "common/v1/common.proto";
import "google/protobuf/timestamp.proto";

// ── Service: PascalCase + "Service" suffix ──
service EquipmentService {
    // Method: PascalCase, verb-first
    rpc GetHealthScore(GetHealthScoreRequest) returns (GetHealthScoreResponse);
    rpc StreamHealthUpdates(StreamHealthUpdatesRequest) returns (stream HealthUpdate);
}

// ── Messages: PascalCase ──
// Request/Response: <MethodName>Request, <MethodName>Response
message GetHealthScoreRequest {
    string equipment_id = 1;    // Field: snake_case
}

message GetHealthScoreResponse {
    string equipment_id = 1;
    int32 health_score = 2;     // 0-100
    string status = 3;
    google.protobuf.Timestamp updated_at = 4;
}

// ── Enums: PascalCase, values UPPER_SNAKE_CASE ──
enum EquipmentStatus {
    EQUIPMENT_STATUS_UNSPECIFIED = 0;  // Bắt buộc có _UNSPECIFIED = 0
    EQUIPMENT_STATUS_RUNNING = 1;
    EQUIPMENT_STATUS_WARNING = 2;
    EQUIPMENT_STATUS_CRITICAL = 3;
}
```

### 13.2. Versioning

```
// Luôn version proto packages: v1, v2, ...
// Breaking changes → new version (v2)
// Non-breaking (add field) → cùng version

api/proto/
├── sensor/v1/sensor.proto       // Current
├── sensor/v2/sensor.proto       // Breaking changes
└── common/v1/common.proto       // Shared types
```

---

## 14. Kafka Events — Conventions

### 14.1. Topic Naming

```
Pattern: maintenix.<domain>.<event-type>

maintenix.sensor.raw            // Sensor data thô từ PLC
maintenix.sensor.processed      // Sensor data đã validate + enrich
maintenix.alert.created         // Alert mới được tạo
maintenix.alert.updated         // Alert thay đổi trạng thái
maintenix.workorder.created     // Work order mới
maintenix.equipment.status      // Equipment health thay đổi
maintenix.ml.prediction         // AI prediction results
maintenix.notification.send     // Trigger gửi notification
maintenix.audit.log             // Audit trail events

DLQ: maintenix.dlq.<original-topic>
maintenix.dlq.sensor.raw
maintenix.dlq.alert.created
```

### 14.2. Message Format

```jsonc
{
    // ── Header (Kafka message headers) ──
    // message_id: UUID (idempotency key)
    // event_type: "equipment.status.changed"
    // source: "equipment-service"
    // timestamp: ISO 8601
    // correlation_id: request tracing ID

    // ── Key ──
    // Partition key: entity ID (đảm bảo ordering per entity)
    // Ví dụ: "EQ001" cho equipment events

    // ── Value (JSON) ──
    "eventType": "equipment.status.changed",
    "source": "equipment-service",
    "timestamp": "2026-02-28T10:30:00Z",
    "data": {
        "equipmentId": "EQ001",
        "previousStatus": "running",
        "currentStatus": "warning",
        "healthScore": 65
    }
}
```

---

## 15. Database & SQL — Conventions

### 15.1. Table & Column Naming

```sql
-- Tables: plural, snake_case
CREATE TABLE equipment ( ... );
CREATE TABLE work_orders ( ... );
CREATE TABLE spare_parts ( ... );
CREATE TABLE audit_logs ( ... );

-- Columns: snake_case
id                  VARCHAR(36)    PRIMARY KEY,  -- UUID string
asset_id            VARCHAR(50)    NOT NULL UNIQUE,
name                VARCHAR(100)   NOT NULL,
equipment_type      VARCHAR(30)    NOT NULL,     -- Tránh reserved words: dùng equipment_type thay vì type
health_score        INTEGER        DEFAULT 100,
created_at          TIMESTAMPTZ    DEFAULT NOW(),
updated_at          TIMESTAMPTZ    DEFAULT NOW(),
deleted_at          TIMESTAMPTZ,                 -- Soft delete

-- Foreign keys: <referenced_table_singular>_id
equipment_id        VARCHAR(36)    REFERENCES equipment(id),
assigned_to_user_id VARCHAR(36)    REFERENCES users(id),

-- Boolean columns: is_ hoặc has_ prefix
is_active           BOOLEAN        DEFAULT true,
has_checklist       BOOLEAN        DEFAULT false,

-- Status columns: dùng VARCHAR cho readability (không dùng integer enum)
status              VARCHAR(20)    NOT NULL DEFAULT 'running',
```

### 15.2. Index Naming

```sql
-- Pattern: idx_<table>_<columns>
CREATE INDEX idx_equipment_status ON equipment(status);
CREATE INDEX idx_equipment_building ON equipment((location->>'building'));
CREATE INDEX idx_alerts_severity_status ON alerts(severity, status);
CREATE INDEX idx_work_orders_assigned_to ON work_orders(assigned_to_user_id);

-- Unique: uq_<table>_<columns>
CREATE UNIQUE INDEX uq_equipment_asset_id ON equipment(asset_id);
CREATE UNIQUE INDEX uq_users_username ON users(username);
CREATE UNIQUE INDEX uq_users_email ON users(email);
```

### 15.3. Migration Naming

```
<version>_<description>.up.sql
<version>_<description>.down.sql

000001_create_users.up.sql
000001_create_users.down.sql
000002_create_roles_permissions.up.sql
000002_create_roles_permissions.down.sql
000003_add_phone_to_users.up.sql          -- ALTER
000003_add_phone_to_users.down.sql
000004_seed_demo_data.up.sql              -- Seed
000004_seed_demo_data.down.sql
```

---

## 16. Git — Commit & Branch Conventions

### 16.1. Conventional Commits — Bắt buộc

```
<type>(<scope>): <description>

type:
  feat     — Tính năng mới
  fix      — Bug fix
  docs     — Documentation
  style    — Formatting (không thay đổi logic)
  refactor — Refactor code (không thay đổi behavior)
  perf     — Performance improvement
  test     — Thêm/sửa tests
  chore    — Build, CI, config, dependencies
  ci       — CI/CD pipeline

scope: tên service hoặc module
  equipment, alert, sensor, workorder, auth, ml,
  frontend, gateway, notification, infra, proto

Ví dụ:
  feat(equipment): add health score calculation
  fix(alert): correct SLA deadline computation
  test(workorder): add FSM transition table tests
  refactor(sensor): extract anomaly detector to separate service
  docs(api): update equipment endpoints documentation
  chore(deps): upgrade go-redis to v9.5
  ci(backend): add integration test stage to pipeline

Breaking changes:
  feat(auth)!: switch JWT from HS256 to RS256
  → Body: BREAKING CHANGE: All existing tokens will be invalidated
```

### 16.2. Branch Strategy

```
main                            ← Production (protected)
  └── develop                   ← Integration branch
        ├── feat/equipment-health-score    ← Feature branch
        ├── feat/alert-sla-escalation
        ├── fix/sensor-data-gap
        ├── refactor/auth-jwt-rs256
        └── chore/upgrade-kafka-3.7

Branch naming:
  <type>/<short-description>    ← kebab-case

Merge strategy:
  feat → develop   : Squash merge (clean history)
  develop → main   : Merge commit (preserve integration history)
  hotfix → main    : Cherry-pick + merge to develop
```

### 16.3. PR Rules

```
PR Title: follow Conventional Commits format
  feat(equipment): add bulk import endpoint

PR Description template:
  ## What
  Brief description of the change.

  ## Why
  Link to issue/ticket.

  ## How
  Technical approach.

  ## Testing
  How was this tested?

  ## Checklist
  - [ ] Tests added/updated
  - [ ] Docs updated (if API change)
  - [ ] No TODO/FIXME left
  - [ ] Migration tested (if DB change)
```

---

## 17. Docker & Deployment — Conventions

### 17.1. Dockerfile Standards

```dockerfile
# ── Multi-stage build: builder + runtime ──
# Stage 1: Build
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download                           # Cache dependencies
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w" \
    -o /service ./cmd/main.go

# Stage 2: Runtime (minimal image)
FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata
COPY --from=builder /service /usr/local/bin/service
COPY migrations /migrations

EXPOSE 8082 50052
USER nobody                                    # Non-root
ENTRYPOINT ["service"]
```

### 17.2. Container Naming

```yaml
# docker-compose: maintenix-<service>
container_name: maintenix-postgres
container_name: maintenix-redis
container_name: maintenix-kafka
container_name: maintenix-auth-service
container_name: maintenix-equipment-service
```

### 17.3. Environment Variables

```bash
# Pattern: UPPER_SNAKE_CASE, prefix theo nhóm
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=maintenix
DATABASE_PASSWORD=secret
DATABASE_NAME=maintenix

# Redis
REDIS_URL=redis://localhost:6379

# Kafka
KAFKA_BROKERS=localhost:9092

# Service
HTTP_PORT=:8082
GRPC_PORT=:50052
LOG_LEVEL=info
ENV=development
```

---

## 18. Code Review Checklist

### 18.1. Review Checklist cho Reviewer

```
┌────────────────────────────────────────────────────────────────────┐
│                       Code Review Checklist                        │
│                                                                    │
│  Correctness:                                                      │
│  □  Logic đúng theo requirements / ticket description              │
│  □  Edge cases được handle (nil, empty, boundary)                  │
│  □  Error handling đầy đủ — không swallow errors                   │
│  □  Concurrent access safe (nếu có shared state)                   │
│                                                                    │
│  Clean Architecture:                                               │
│  □  Domain layer không import infrastructure packages              │
│  □  Handler không gọi trực tiếp repository                         │
│  □  Dependencies inject qua interfaces                             │
│                                                                    │
│  Naming & Style:                                                   │
│  □  Tên biến/function rõ ràng, self-documenting                    │
│  □  Theo naming conventions (xem sections 2, 8)                    │
│  □  Không có magic numbers — dùng constants                        │
│  □  Comments giải thích WHY, không giải thích WHAT                 │
│                                                                    │
│  Security:                                                         │
│  □  Input validation trước khi dùng                                │
│  □  SQL injection safe (parameterized queries / ORM)               │
│  □  Không log sensitive data (password, token, secret)             │
│  □  RBAC check cho endpoints mới                                   │
│                                                                    │
│  Testing:                                                          │
│  □  Unit tests cho business logic mới                              │
│  □  Test cả happy path + error cases                               │
│  □  Mock expectations rõ ràng                                      │
│  □  Coverage không giảm so với main                                │
│                                                                    │
│  Performance:                                                      │
│  □  Không N+1 query                                                │
│  □  Database index cho query mới                                   │
│  □  Pagination cho list endpoints                                  │
│  □  Context timeout propagated                                     │
│                                                                    │
│  API Contract:                                                     │
│  □  Response format theo chuẩn (success, data, error, requestId)   │
│  □  HTTP status codes đúng                                         │
│  □  Error codes follow DOMAIN_ACTION_REASON pattern                │
│  □  Breaking changes documented                                    │
│                                                                    │
│  Frontend specific:                                                │
│  □  Subscriptions cleanup (takeUntil / async pipe)                 │
│  □  Loading states handled                                         │
│  □  Error states handled (UI feedback)                             │
│  □  RBAC: routes + menu items hidden cho unauthorized roles        │
│                                                                    │
│  Infrastructure:                                                   │
│  □  Migration có cả up + down                                      │
│  □  Migration backward compatible (nếu cần rollback)               │
│  □  Docker image build OK                                          │
│  □  Environment variables documented                               │
└────────────────────────────────────────────────────────────────────┘
```

### 18.2. Khi nào KHÔNG cần review

```
Các thay đổi sau có thể self-merge (sau khi CI pass):
  • Typo fixes trong docs/comments
  • Dependency version bumps (patch only)
  • Auto-generated code (mocks, proto-gen)
  • CI config tweaks (non-functional)

Tất cả thay đổi khác: BẮT BUỘC ít nhất 1 reviewer approve.
```

### 18.3. Comment Conventions trong Code

```go
// ── Package-level doc comment ──
// Package service implements business logic for the equipment domain.
// It orchestrates between repository layer and event publishing.
package service

// ── Exported function doc ──
// Create validates input, persists a new equipment entity, and publishes
// an equipment.status event to Kafka. Returns EQUIPMENT_ASSET_ID_EXISTS
// if the asset ID already exists in the system.
func (s *EquipmentService) Create(ctx context.Context, req CreateRequest) (*Equipment, error) {

// ── Inline comments: explain WHY, not WHAT ──
// Health score starts at 100 for new equipment per business rule BR-EQ-004
eq.HealthScore = 100

// SLA deadline varies by severity: critical=30min, high=2h, medium=8h, low=24h
deadline := calculateSLADeadline(alert.Severity, alert.CreatedAt)

// ── TODO format ──
// TODO(username): Implement retry logic for Kafka produce failure — Issue #123
// FIXME(username): Race condition when concurrent health score updates — Issue #456
```

---

> **Ghi chú:** Document này là living document. Cập nhật khi team đồng ý thay đổi conventions. Mọi thay đổi convention phải được thảo luận và approve bởi ≥ 2 team members. Conventions áp dụng cho code mới; refactor code cũ khi có cơ hội (boy scout rule).
