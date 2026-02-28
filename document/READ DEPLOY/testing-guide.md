# Maintenix — Testing Guide

> **Smart Predictive Maintenance Warning System**
> Chiến lược testing toàn diện cho cả Backend (Go) và Frontend (Angular).
> Test pyramid, naming conventions, mẫu code chi tiết, CI pipeline, coverage targets.

---

## Mục lục

1. [Testing Philosophy & Pyramid](#1-testing-philosophy--pyramid)
2. [Backend — Cấu trúc Test](#2-backend--cấu-trúc-test)
3. [Backend — Unit Tests (Service Layer)](#3-backend--unit-tests-service-layer)
4. [Backend — Unit Tests (Handler Layer)](#4-backend--unit-tests-handler-layer)
5. [Backend — Unit Tests (Repository Layer)](#5-backend--unit-tests-repository-layer)
6. [Backend — Integration Tests](#6-backend--integration-tests)
7. [Backend — Kafka Consumer/Producer Tests](#7-backend--kafka-consumerproducer-tests)
8. [Backend — gRPC Tests](#8-backend--grpc-tests)
9. [Frontend — Cấu trúc Test](#9-frontend--cấu-trúc-test)
10. [Frontend — Component Tests](#10-frontend--component-tests)
11. [Frontend — Service Tests](#11-frontend--service-tests)
12. [Frontend — Guard & Interceptor Tests](#12-frontend--guard--interceptor-tests)
13. [Frontend — E2E Tests (Playwright)](#13-frontend--e2e-tests-playwright)
14. [API Contract Tests](#14-api-contract-tests)
15. [Performance & Load Tests](#15-performance--load-tests)
16. [CI/CD Pipeline](#16-cicd-pipeline)
17. [Coverage Targets & Quality Gates](#17-coverage-targets--quality-gates)
18. [Makefile Commands & Scripts](#18-makefile-commands--scripts)
19. [Troubleshooting Tests](#19-troubleshooting-tests)

---

## 1. Testing Philosophy & Pyramid

### 1.1. Test Pyramid

```
                          ╱╲
                         ╱  ╲
                        ╱ E2E╲              ~5%   │ Playwright (Frontend)
                       ╱──────╲                   │ Full flow: login → create WO → verify
                      ╱        ╲
                     ╱ Contract ╲          ~10%  │ API contract tests (REST + gRPC)
                    ╱────────────╲               │ Request/response schema validation
                   ╱              ╲
                  ╱   Integration  ╲      ~25%  │ DB real, Kafka real (Testcontainers)
                 ╱──────────────────╲            │ Service → Repository → PostgreSQL
                ╱                    ╲
               ╱      Unit Tests      ╲   ~60%  │ Mock dependencies, fast, isolated
              ╱────────────────────────╲         │ Service logic, handlers, domain rules
             ╱                          ╲
            ╱────────────────────────────╲
```

### 1.2. Nguyên tắc Testing

| Nguyên tắc | Giải thích |
|------------|-----------|
| **Fast feedback** | Unit tests chạy < 5 giây cho toàn bộ service. CI pipeline tổng < 10 phút |
| **Isolated** | Mỗi test tự setup/teardown, không phụ thuộc test khác, chạy parallel được |
| **Deterministic** | Cùng input → cùng output. Không dùng `time.Now()` trực tiếp, inject clock |
| **Readable** | Test name mô tả behavior, không mô tả implementation. Given-When-Then pattern |
| **Clean Architecture = Testable** | Domain interfaces cho phép mock repository. Service layer test không cần DB |

### 1.3. Tools

**Backend (Go):**

| Tool | Purpose | Install |
|------|---------|---------|
| `testing` (stdlib) | Test framework | Built-in |
| `testify` | Assert/Require/Mock/Suite | `go get github.com/stretchr/testify` |
| `mockery` | Auto-generate mocks từ interfaces | `go install github.com/vektra/mockery/v2@latest` |
| `testcontainers-go` | Docker containers cho integration tests | `go get github.com/testcontainers/testcontainers-go` |
| `httptest` (stdlib) | HTTP handler testing | Built-in |
| `golangci-lint` | Static analysis + linting | `go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest` |
| `go-cmp` | Deep equality comparison | `go get github.com/google/go-cmp/cmp` |
| `go tool cover` | Coverage reporting | Built-in |
| `benchstat` | Benchmark comparison | `go install golang.org/x/perf/cmd/benchstat@latest` |

**Frontend (Angular):**

| Tool | Purpose | Install |
|------|---------|---------|
| Karma + Jasmine | Unit test runner + framework | `ng add @angular/testing` (built-in) |
| Jest (alternative) | Faster unit test runner | `npm i -D jest @angular-builders/jest` |
| Playwright | E2E testing | `npm i -D @playwright/test` |
| `ng-mocks` | Angular mock helpers | `npm i -D ng-mocks` |
| `spectator` | Angular test ergonomics | `npm i -D @ngneat/spectator` |

---

## 2. Backend — Cấu trúc Test

### 2.1. File Placement

Test files đặt cạnh source files (Go convention `_test.go`):

```
services/equipment-service/
├── internal/
│   ├── domain/
│   │   ├── equipment.go
│   │   └── equipment_test.go              ← Domain validation tests
│   ├── service/
│   │   ├── equipment_service.go
│   │   └── equipment_service_test.go      ← Unit tests (mock repo)
│   ├── handler/
│   │   ├── equipment_handler.go
│   │   └── equipment_handler_test.go      ← HTTP handler tests (httptest)
│   ├── repository/
│   │   ├── equipment_repo.go
│   │   └── equipment_repo_test.go         ← Integration tests (testcontainers)
│   ├── kafka/
│   │   ├── consumer.go
│   │   └── consumer_test.go               ← Kafka consumer tests
│   └── grpc/
│       ├── server.go
│       └── server_test.go                 ← gRPC server tests (bufconn)
├── mocks/                                  ← Auto-generated mocks (mockery)
│   ├── mock_equipment_repository.go
│   ├── mock_spare_part_repository.go
│   └── mock_health_calculator.go
└── testdata/                               ← Test fixtures
    ├── equipment_valid.json
    ├── equipment_invalid.json
    └── seed.sql
```

### 2.2. Mock Generation

Sử dụng `mockery` để auto-generate mocks từ domain interfaces:

```bash
# Cài mockery
go install github.com/vektra/mockery/v2@latest

# Generate mocks cho tất cả interfaces trong domain/
cd services/equipment-service
mockery --all --dir=internal/domain --output=mocks --outpkg=mocks --case=underscore

# Hoặc chỉ 1 interface
mockery --name=EquipmentRepository --dir=internal/domain --output=mocks --outpkg=mocks
```

**`.mockery.yaml` (root config):**

```yaml
all: true
dir: "internal/domain"
output: "mocks"
outpkg: "mocks"
case: "underscore"
with-expecter: true
```

### 2.3. Test Naming Convention

```go
// Pattern: Test<Struct>_<Method>_<Scenario>
func TestEquipmentService_Create_Success(t *testing.T)
func TestEquipmentService_Create_DuplicateAssetID(t *testing.T)
func TestEquipmentService_Create_InvalidType(t *testing.T)
func TestEquipmentService_GetByID_NotFound(t *testing.T)
func TestEquipmentService_UpdateHealthScore_RecalculatesCorrectly(t *testing.T)

// Table-driven tests: Test<Struct>_<Method>
func TestEquipmentService_Create(t *testing.T) {
    tests := []struct {
        name    string
        input   CreateEquipmentRequest
        wantErr bool
        errCode string
    }{...}
}
```

### 2.4. Build Tags

```go
//go:build unit
// +build unit

package service_test   // Unit tests

//go:build integration
// +build integration

package repository_test  // Integration tests (cần DB)
```

```bash
# Chỉ chạy unit tests
go test -tags=unit ./...

# Chỉ chạy integration tests
go test -tags=integration ./...

# Chạy tất cả
go test ./...
```

---

## 3. Backend — Unit Tests (Service Layer)

> **Mục tiêu:** Test business logic thuần. Mock tất cả dependencies (repository, Kafka producer, Redis, gRPC clients).

### 3.1. Mẫu: Equipment Service — Create

```go
// services/equipment-service/internal/service/equipment_service_test.go
package service_test

import (
    "context"
    "testing"

    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/mock"
    "github.com/stretchr/testify/require"

    "maintenix/services/equipment-service/internal/domain"
    "maintenix/services/equipment-service/internal/service"
    "maintenix/services/equipment-service/mocks"
)

func TestEquipmentService_Create_Success(t *testing.T) {
    // Arrange
    mockRepo := mocks.NewMockEquipmentRepository(t)
    mockKafka := mocks.NewMockEventProducer(t)
    svc := service.NewEquipmentService(mockRepo, mockKafka)

    input := domain.CreateEquipmentRequest{
        AssetID:          "A-CNC-099",
        Name:             "Máy CNC mới",
        Type:             domain.EquipmentTypeCNC,
        Manufacturer:     "Fanuc",
        YearManufactured: 2024,
        Location: domain.EquipmentLocation{
            Building:       "Nhà xưởng A",
            ProductionLine: "Dây chuyền A",
        },
    }

    // Mock expectations
    mockRepo.EXPECT().
        ExistsByAssetID(mock.Anything, "A-CNC-099").
        Return(false, nil)
    mockRepo.EXPECT().
        Create(mock.Anything, mock.MatchedBy(func(eq *domain.Equipment) bool {
            return eq.AssetID == "A-CNC-099" && eq.HealthScore == 100
        })).
        Return(nil)
    mockKafka.EXPECT().
        Publish(mock.Anything, "maintenix.equipment.status", mock.Anything).
        Return(nil)

    // Act
    result, err := svc.Create(context.Background(), input)

    // Assert
    require.NoError(t, err)
    assert.Equal(t, "A-CNC-099", result.AssetID)
    assert.Equal(t, "Máy CNC mới", result.Name)
    assert.Equal(t, 100, result.HealthScore) // New equipment starts at 100%
    assert.NotEmpty(t, result.ID)
    assert.NotEmpty(t, result.CreatedAt)

    mockRepo.AssertExpectations(t)
    mockKafka.AssertExpectations(t)
}

func TestEquipmentService_Create_DuplicateAssetID(t *testing.T) {
    // Arrange
    mockRepo := mocks.NewMockEquipmentRepository(t)
    mockKafka := mocks.NewMockEventProducer(t)
    svc := service.NewEquipmentService(mockRepo, mockKafka)

    mockRepo.EXPECT().
        ExistsByAssetID(mock.Anything, "A-CNC-001").
        Return(true, nil)

    // Act
    _, err := svc.Create(context.Background(), domain.CreateEquipmentRequest{
        AssetID: "A-CNC-001",
        Name:    "Duplicate",
        Type:    domain.EquipmentTypeCNC,
    })

    // Assert
    require.Error(t, err)
    assert.Contains(t, err.Error(), "EQUIPMENT_ASSET_ID_EXISTS")
}
```

### 3.2. Mẫu: Alert Service — SLA Escalation Logic

```go
func TestAlertService_CheckSLABreach_EscalatesCritical(t *testing.T) {
    // Arrange
    mockRepo := mocks.NewMockAlertRepository(t)
    mockRedis := mocks.NewMockCacheClient(t)
    mockKafka := mocks.NewMockEventProducer(t)
    clock := &fakeClock{now: time.Date(2026, 2, 27, 11, 00, 0, 0, time.UTC)}

    svc := service.NewAlertService(mockRepo, mockRedis, mockKafka,
        service.WithClock(clock))

    alert := &domain.Alert{
        ID:          "ALT001",
        Severity:    domain.SeverityCritical,
        Status:      domain.AlertStatusOpen,
        CreatedAt:   time.Date(2026, 2, 27, 10, 00, 0, 0, time.UTC), // 60 phút trước
        SLADeadline: time.Date(2026, 2, 27, 10, 30, 0, 0, time.UTC), // Đã breach 30 phút
    }

    mockRepo.EXPECT().
        FindUnacknowledgedPastSLA(mock.Anything, clock.Now()).
        Return([]*domain.Alert{alert}, nil)
    mockRepo.EXPECT().
        UpdateStatus(mock.Anything, "ALT001", domain.AlertStatusEscalated).
        Return(nil)
    mockKafka.EXPECT().
        Publish(mock.Anything, "maintenix.alert.updated", mock.Anything).
        Return(nil)
    mockKafka.EXPECT().
        Publish(mock.Anything, "maintenix.notification.send", mock.MatchedBy(
            func(msg []byte) bool {
                return strings.Contains(string(msg), "SLA BREACHED")
            })).
        Return(nil)

    // Act
    escalated, err := svc.CheckSLABreach(context.Background())

    // Assert
    require.NoError(t, err)
    assert.Len(t, escalated, 1)
    assert.Equal(t, "ALT001", escalated[0].ID)
}
```

### 3.3. Mẫu: WorkOrder Service — FSM Transitions (Table-driven)

```go
func TestWorkOrderService_TransitionStatus(t *testing.T) {
    tests := []struct {
        name        string
        fromStatus  domain.WorkOrderStatus
        toStatus    domain.WorkOrderStatus
        role        string
        wantErr     bool
        errCode     string
    }{
        // Valid transitions
        {"draft to submitted", domain.WODraft, domain.WOSubmitted, "maintenance_engineer", false, ""},
        {"submitted to approved", domain.WOSubmitted, domain.WOApproved, "maintenance_manager", false, ""},
        {"approved to scheduled", domain.WOApproved, domain.WOScheduled, "maintenance_manager", false, ""},
        {"scheduled to assigned", domain.WOScheduled, domain.WOAssigned, "maintenance_engineer", false, ""},
        {"assigned to in_progress", domain.WOAssigned, domain.WOInProgress, "technician", false, ""},
        {"in_progress to completed", domain.WOInProgress, domain.WOCompleted, "technician", false, ""},
        {"completed to verified", domain.WOCompleted, domain.WOVerified, "quality_inspector", false, ""},
        {"verified to closed", domain.WOVerified, domain.WOClosed, "maintenance_manager", false, ""},
        // Reopen
        {"completed to in_progress (reopen)", domain.WOCompleted, domain.WOInProgress, "maintenance_manager", false, ""},
        // Pending parts
        {"in_progress to pending_parts", domain.WOInProgress, domain.WOPendingParts, "technician", false, ""},
        {"pending_parts to in_progress", domain.WOPendingParts, domain.WOInProgress, "technician", false, ""},
        // Invalid transitions
        {"draft to completed (skip)", domain.WODraft, domain.WOCompleted, "super_admin", true, "WORKORDER_INVALID_TRANSITION"},
        {"closed to draft (backwards)", domain.WOClosed, domain.WODraft, "super_admin", true, "WORKORDER_INVALID_TRANSITION"},
        {"assigned to approved (backwards)", domain.WOAssigned, domain.WOApproved, "maintenance_manager", true, "WORKORDER_INVALID_TRANSITION"},
        // Unauthorized role
        {"technician cannot approve", domain.WOSubmitted, domain.WOApproved, "technician", true, "AUTH_INSUFFICIENT_ROLE"},
        {"viewer cannot transition", domain.WODraft, domain.WOSubmitted, "viewer", true, "AUTH_INSUFFICIENT_ROLE"},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            mockRepo := mocks.NewMockWorkOrderRepository(t)
            svc := service.NewWorkOrderService(mockRepo, nil)

            wo := &domain.WorkOrder{ID: "WO001", Status: tt.fromStatus}

            if !tt.wantErr {
                mockRepo.EXPECT().
                    GetByID(mock.Anything, "WO001").
                    Return(wo, nil)
                mockRepo.EXPECT().
                    UpdateStatus(mock.Anything, "WO001", tt.toStatus).
                    Return(nil)
            } else if tt.errCode != "AUTH_INSUFFICIENT_ROLE" {
                mockRepo.EXPECT().
                    GetByID(mock.Anything, "WO001").
                    Return(wo, nil)
            }

            err := svc.TransitionStatus(context.Background(), "WO001", tt.toStatus, tt.role)

            if tt.wantErr {
                require.Error(t, err)
                assert.Contains(t, err.Error(), tt.errCode)
            } else {
                require.NoError(t, err)
            }
        })
    }
}
```

### 3.4. Mẫu: Sensor Service — Anomaly Detection

```go
func TestAnomalyDetector_ZScore(t *testing.T) {
    detector := service.NewAnomalyDetector(service.AnomalyConfig{
        Method:           "z_score",
        WarningThreshold: 2.0,
        CriticalThreshold: 3.0,
        WindowSize:       100,
    })

    // Dữ liệu bình thường: mean=80, std=5
    normalReadings := make([]float64, 100)
    for i := range normalReadings {
        normalReadings[i] = 80 + (float64(i%10) - 5)
    }
    detector.Train(normalReadings)

    tests := []struct {
        name     string
        value    float64
        wantLevel string
    }{
        {"normal value", 82.0, "normal"},
        {"warning low", 70.0, "warning"},
        {"warning high", 92.0, "warning"},    // Z = (92-80)/5 = 2.4 → warning
        {"critical high", 97.0, "critical"},  // Z = (97-80)/5 = 3.4 → critical
        {"exactly at mean", 80.0, "normal"},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := detector.Evaluate(tt.value)
            assert.Equal(t, tt.wantLevel, result.Level)
        })
    }
}
```

---

## 4. Backend — Unit Tests (Handler Layer)

> **Mục tiêu:** Test HTTP request parsing, response formatting, status codes. Mock service layer.

### 4.1. Mẫu: Equipment Handler — GET /api/equipment

```go
// services/equipment-service/internal/handler/equipment_handler_test.go
package handler_test

import (
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/gin-gonic/gin"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/mock"

    "maintenix/services/equipment-service/internal/domain"
    "maintenix/services/equipment-service/internal/handler"
    "maintenix/services/equipment-service/mocks"
)

func setupRouter(h *handler.EquipmentHandler) *gin.Engine {
    gin.SetMode(gin.TestMode)
    r := gin.New()
    r.GET("/api/equipment", h.List)
    r.GET("/api/equipment/:id", h.GetByID)
    r.POST("/api/equipment", h.Create)
    return r
}

func TestEquipmentHandler_List_Success(t *testing.T) {
    // Arrange
    mockSvc := mocks.NewMockEquipmentService(t)
    h := handler.NewEquipmentHandler(mockSvc)
    router := setupRouter(h)

    equipment := []*domain.Equipment{
        {ID: "EQ001", Name: "Máy CNC Fanuc #01", Status: "running", HealthScore: 84},
        {ID: "EQ002", Name: "Máy ép thủy lực M09", Status: "critical", HealthScore: 31},
    }

    mockSvc.EXPECT().
        List(mock.Anything, mock.AnythingOfType("*domain.ListRequest")).
        Return(equipment, 2, nil)

    // Act
    w := httptest.NewRecorder()
    req, _ := http.NewRequest("GET", "/api/equipment?page=1&pageSize=20", nil)
    router.ServeHTTP(w, req)

    // Assert
    assert.Equal(t, http.StatusOK, w.Code)

    var resp map[string]interface{}
    json.Unmarshal(w.Body.Bytes(), &resp)
    assert.True(t, resp["success"].(bool))
    data := resp["data"].([]interface{})
    assert.Len(t, data, 2)
    meta := resp["meta"].(map[string]interface{})
    assert.Equal(t, float64(2), meta["total"])
}

func TestEquipmentHandler_GetByID_NotFound(t *testing.T) {
    mockSvc := mocks.NewMockEquipmentService(t)
    h := handler.NewEquipmentHandler(mockSvc)
    router := setupRouter(h)

    mockSvc.EXPECT().
        GetByID(mock.Anything, "EQ999").
        Return(nil, domain.ErrNotFound("EQUIPMENT_NOT_FOUND", "Equipment with ID 'EQ999' not found"))

    w := httptest.NewRecorder()
    req, _ := http.NewRequest("GET", "/api/equipment/EQ999", nil)
    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusNotFound, w.Code)

    var resp map[string]interface{}
    json.Unmarshal(w.Body.Bytes(), &resp)
    assert.False(t, resp["success"].(bool))
    errObj := resp["error"].(map[string]interface{})
    assert.Equal(t, "EQUIPMENT_NOT_FOUND", errObj["code"])
}

func TestEquipmentHandler_Create_ValidationError(t *testing.T) {
    mockSvc := mocks.NewMockEquipmentService(t)
    h := handler.NewEquipmentHandler(mockSvc)
    router := setupRouter(h)

    // Missing required fields
    body := `{"name": ""}`
    w := httptest.NewRecorder()
    req, _ := http.NewRequest("POST", "/api/equipment", strings.NewReader(body))
    req.Header.Set("Content-Type", "application/json")
    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusBadRequest, w.Code)

    var resp map[string]interface{}
    json.Unmarshal(w.Body.Bytes(), &resp)
    errObj := resp["error"].(map[string]interface{})
    assert.Equal(t, "VALIDATION_FAILED", errObj["code"])
}
```

### 4.2. Mẫu: Alert Handler — PUT /api/alerts/:id/acknowledge

```go
func TestAlertHandler_Acknowledge_AlreadyAcknowledged(t *testing.T) {
    mockSvc := mocks.NewMockAlertService(t)
    h := handler.NewAlertHandler(mockSvc)

    router := gin.New()
    gin.SetMode(gin.TestMode)
    router.PUT("/api/alerts/:id/acknowledge", h.Acknowledge)

    mockSvc.EXPECT().
        Acknowledge(mock.Anything, "ALT001", "U003").
        Return(nil, domain.ErrConflict("ALERT_ALREADY_ACKNOWLEDGED", "Alert đã được acknowledge"))

    body := `{"userId": "U003", "notes": "Test"}`
    w := httptest.NewRecorder()
    req, _ := http.NewRequest("PUT", "/api/alerts/ALT001/acknowledge", strings.NewReader(body))
    req.Header.Set("Content-Type", "application/json")
    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusConflict, w.Code)
}
```

---

## 5. Backend — Unit Tests (Repository Layer)

> **Mục tiêu:** Test SQL queries chạy đúng. Dùng Testcontainers cho real PostgreSQL.

### 5.1. Test Helpers — Testcontainers Setup

```go
// services/equipment-service/internal/repository/testhelpers_test.go
package repository_test

import (
    "context"
    "fmt"
    "testing"

    "github.com/testcontainers/testcontainers-go"
    "github.com/testcontainers/testcontainers-go/modules/postgres"
    "github.com/testcontainers/testcontainers-go/wait"
    "gorm.io/driver/postgres"
    "gorm.io/gorm"
)

func setupTestDB(t *testing.T) (*gorm.DB, func()) {
    t.Helper()
    ctx := context.Background()

    container, err := postgres.RunContainer(ctx,
        testcontainers.WithImage("postgres:16-alpine"),
        postgres.WithDatabase("test_maintenix"),
        postgres.WithUsername("test"),
        postgres.WithPassword("test"),
        testcontainers.WithWaitStrategy(
            wait.ForLog("database system is ready to accept connections").
                WithOccurrence(2).
                WithStartupTimeout(30*time.Second)),
    )
    if err != nil {
        t.Fatalf("failed to start postgres container: %v", err)
    }

    connStr, _ := container.ConnectionString(ctx, "sslmode=disable")
    db, err := gorm.Open(postgres.Open(connStr), &gorm.Config{})
    if err != nil {
        t.Fatalf("failed to connect: %v", err)
    }

    // Run migrations
    sqlDB, _ := db.DB()
    runMigrations(sqlDB)

    cleanup := func() {
        container.Terminate(ctx)
    }

    return db, cleanup
}
```

### 5.2. Mẫu: Equipment Repository

```go
//go:build integration

func TestEquipmentRepo_Create_And_FindByID(t *testing.T) {
    db, cleanup := setupTestDB(t)
    defer cleanup()

    repo := repository.NewEquipmentRepository(db)
    ctx := context.Background()

    eq := &domain.Equipment{
        ID:       "EQ-TEST-001",
        AssetID:  "T-CNC-001",
        Name:     "Test CNC",
        Type:     "cnc_machine",
        Status:   "running",
        HealthScore: 100,
    }

    // Create
    err := repo.Create(ctx, eq)
    require.NoError(t, err)

    // Find
    found, err := repo.GetByID(ctx, "EQ-TEST-001")
    require.NoError(t, err)
    assert.Equal(t, "T-CNC-001", found.AssetID)
    assert.Equal(t, "Test CNC", found.Name)
    assert.Equal(t, 100, found.HealthScore)
}

func TestEquipmentRepo_List_WithFilters(t *testing.T) {
    db, cleanup := setupTestDB(t)
    defer cleanup()

    repo := repository.NewEquipmentRepository(db)
    ctx := context.Background()

    // Seed test data
    seedEquipment(t, repo, ctx)

    tests := []struct {
        name     string
        filter   domain.EquipmentFilter
        wantLen  int
    }{
        {"no filter", domain.EquipmentFilter{}, 10},
        {"by status running", domain.EquipmentFilter{Status: "running"}, 4},
        {"by type robot", domain.EquipmentFilter{Type: "robot"}, 2},
        {"by building A", domain.EquipmentFilter{Building: "Nhà xưởng A"}, 6},
        {"by status + building", domain.EquipmentFilter{Status: "critical", Building: "Nhà xưởng A"}, 2},
        {"search by name", domain.EquipmentFilter{Search: "CNC"}, 1},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            results, total, err := repo.List(ctx, tt.filter, domain.Pagination{Page: 1, PageSize: 20})
            require.NoError(t, err)
            assert.Equal(t, tt.wantLen, int(total))
            assert.Len(t, results, tt.wantLen)
        })
    }
}
```

---

## 6. Backend — Integration Tests

> **Mục tiêu:** Test full flow: HTTP request → Handler → Service → Repository → Database → Response.

### 6.1. Mẫu: Full API Integration Test

```go
//go:build integration

func TestEquipmentAPI_FullCRUD(t *testing.T) {
    // Setup real DB + real service + real handler
    db, cleanup := setupTestDB(t)
    defer cleanup()

    repo := repository.NewEquipmentRepository(db)
    svc := service.NewEquipmentService(repo, nil)
    h := handler.NewEquipmentHandler(svc)
    router := setupRouter(h)

    // 1. CREATE
    createBody := `{
        "assetId": "T-INT-001",
        "name": "Integration Test Machine",
        "type": "cnc_machine",
        "manufacturer": "TestCorp",
        "yearManufactured": 2024,
        "location": {"building": "Test", "productionLine": "Test Line"}
    }`
    w := httptest.NewRecorder()
    req, _ := http.NewRequest("POST", "/api/equipment", strings.NewReader(createBody))
    req.Header.Set("Content-Type", "application/json")
    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusCreated, w.Code)
    var createResp map[string]interface{}
    json.Unmarshal(w.Body.Bytes(), &createResp)
    id := createResp["data"].(map[string]interface{})["id"].(string)

    // 2. READ
    w = httptest.NewRecorder()
    req, _ = http.NewRequest("GET", "/api/equipment/"+id, nil)
    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusOK, w.Code)

    // 3. UPDATE
    updateBody := `{"name": "Updated Machine"}`
    w = httptest.NewRecorder()
    req, _ = http.NewRequest("PUT", "/api/equipment/"+id, strings.NewReader(updateBody))
    req.Header.Set("Content-Type", "application/json")
    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusOK, w.Code)

    // 4. Verify update
    w = httptest.NewRecorder()
    req, _ = http.NewRequest("GET", "/api/equipment/"+id, nil)
    router.ServeHTTP(w, req)

    var getResp map[string]interface{}
    json.Unmarshal(w.Body.Bytes(), &getResp)
    assert.Equal(t, "Updated Machine", getResp["data"].(map[string]interface{})["name"])
}
```

---

## 7. Backend — Kafka Consumer/Producer Tests

### 7.1. Mock Kafka Producer

```go
func TestSensorService_ProcessReading_ProducesProcessedEvent(t *testing.T) {
    mockRepo := mocks.NewMockSensorRepository(t)
    mockInflux := mocks.NewMockInfluxWriter(t)
    mockTimescale := mocks.NewMockTimeseriesWriter(t)
    mockRedis := mocks.NewMockCacheClient(t)
    mockKafka := mocks.NewMockEventProducer(t)

    svc := service.NewIngestionService(mockRepo, mockInflux, mockTimescale, mockRedis, mockKafka)

    reading := domain.SensorReading{
        SensorID:    "S005",
        EquipmentID: "EQ002",
        Value:       92.0,
        Unit:        "°C",
        Timestamp:   time.Now(),
        QualityFlag: "good",
    }

    sensor := &domain.Sensor{
        ID: "S005", EquipmentID: "EQ002",
        WarningHigh: 85, CriticalHigh: 95,
    }

    mockRepo.EXPECT().GetByID(mock.Anything, "S005").Return(sensor, nil)
    mockInflux.EXPECT().Write(mock.Anything, mock.Anything).Return(nil)
    mockTimescale.EXPECT().Write(mock.Anything, mock.Anything).Return(nil)
    mockRedis.EXPECT().Set(mock.Anything, "sensor:latest:S005", mock.Anything, 30*time.Second).Return(nil)

    // Verify Kafka message contains anomaly info
    mockKafka.EXPECT().
        Publish(mock.Anything, "maintenix.sensor.processed", mock.MatchedBy(
            func(msg []byte) bool {
                var event map[string]interface{}
                json.Unmarshal(msg, &event)
                return event["anomalyLevel"] == "warning" // 92 > 85 warning threshold
            })).
        Return(nil)

    err := svc.ProcessReading(context.Background(), reading)
    require.NoError(t, err)
}
```

### 7.2. Kafka Integration Test (Testcontainers)

```go
//go:build integration

func TestKafkaConsumer_SensorRaw_EndToEnd(t *testing.T) {
    ctx := context.Background()

    // Start Kafka container
    kafkaContainer, err := kafka.RunContainer(ctx,
        kafka.WithClusterID("test-cluster"),
        testcontainers.WithImage("confluentinc/cp-kafka:7.6"),
    )
    require.NoError(t, err)
    defer kafkaContainer.Terminate(ctx)

    brokers, _ := kafkaContainer.Brokers(ctx)

    // Create topic
    admin, _ := sarama.NewClusterAdmin(brokers, sarama.NewConfig())
    admin.CreateTopic("maintenix.sensor.raw", &sarama.TopicDetail{
        NumPartitions: 1, ReplicationFactor: 1,
    }, false)

    // Produce test message
    producer, _ := sarama.NewSyncProducer(brokers, nil)
    msg := &sarama.ProducerMessage{
        Topic: "maintenix.sensor.raw",
        Key:   sarama.StringEncoder("S005"),
        Value: sarama.ByteEncoder(`{"sensorId":"S005","value":92,"unit":"°C"}`),
    }
    producer.SendMessage(msg)

    // Consume and verify
    consumer := NewTestConsumer(brokers, "maintenix.sensor.raw", "test-cg")
    received := consumer.WaitForMessage(5 * time.Second)
    require.NotNil(t, received)
    assert.Contains(t, string(received.Value), "S005")
}
```

---

## 8. Backend — gRPC Tests

### 8.1. gRPC Server Test (bufconn — in-memory)

```go
func TestAuthGRPC_ValidateToken_Valid(t *testing.T) {
    // Setup in-memory gRPC server
    lis := bufconn.Listen(1024 * 1024)
    s := grpc.NewServer()
    mockSvc := mocks.NewMockAuthService(t)
    authpb.RegisterAuthServiceServer(s, grpcserver.NewAuthServer(mockSvc))
    go s.Serve(lis)
    defer s.Stop()

    // Create client
    conn, _ := grpc.DialContext(context.Background(), "",
        grpc.WithContextDialer(func(ctx context.Context, s string) (net.Conn, error) {
            return lis.Dial()
        }),
        grpc.WithInsecure(),
    )
    defer conn.Close()
    client := authpb.NewAuthServiceClient(conn)

    mockSvc.EXPECT().
        ValidateToken(mock.Anything, "valid-jwt-token").
        Return(&domain.TokenClaims{
            UserID: "U001", Role: "super_admin",
            Permissions: []string{"equipment:read", "equipment:write"},
        }, nil)

    // Call
    resp, err := client.ValidateToken(context.Background(), &authpb.ValidateTokenRequest{
        Token: "valid-jwt-token",
    })

    require.NoError(t, err)
    assert.True(t, resp.Valid)
    assert.Equal(t, "U001", resp.UserId)
    assert.Equal(t, "super_admin", resp.Role)
}

func TestAuthGRPC_ValidateToken_Expired(t *testing.T) {
    // ... similar setup ...
    mockSvc.EXPECT().
        ValidateToken(mock.Anything, "expired-token").
        Return(nil, domain.ErrUnauthorized("AUTH_TOKEN_EXPIRED", "Token đã hết hạn"))

    resp, err := client.ValidateToken(context.Background(), &authpb.ValidateTokenRequest{
        Token: "expired-token",
    })

    require.Error(t, err)
    st, _ := status.FromError(err)
    assert.Equal(t, codes.Unauthenticated, st.Code())
}
```

---

## 9. Frontend — Cấu trúc Test

### 9.1. Setup Testing Framework

```bash
# Thêm testing dependencies
npm i -D karma-jasmine karma-chrome-launcher karma-coverage
npm i -D @angular/testing
npm i -D @ngneat/spectator ng-mocks

# E2E
npm i -D @playwright/test
npx playwright install
```

**Cập nhật `package.json`:**

```json
{
  "scripts": {
    "test": "ng test --watch=false --code-coverage",
    "test:watch": "ng test",
    "test:ci": "ng test --watch=false --code-coverage --browsers=ChromeHeadless",
    "e2e": "npx playwright test",
    "e2e:ui": "npx playwright test --ui"
  }
}
```

### 9.2. Test File Placement

```
src/app/
├── core/
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── auth.service.spec.ts          ← Service tests
│   │   ├── api.service.ts
│   │   └── api.service.spec.ts
│   ├── guards/
│   │   ├── auth.guard.ts
│   │   ├── auth.guard.spec.ts            ← Guard tests
│   │   ├── role.guard.ts
│   │   └── role.guard.spec.ts
│   └── models/
│       └── index.ts
├── modules/
│   ├── dashboard/
│   │   ├── dashboard.component.ts
│   │   └── dashboard.component.spec.ts   ← Component tests
│   ├── equipment/
│   │   ├── equipment.component.ts
│   │   └── equipment.component.spec.ts
│   └── ...
└── e2e/                                   ← Playwright E2E tests
    ├── playwright.config.ts
    ├── pages/                             ← Page Object Models
    │   ├── login.page.ts
    │   ├── dashboard.page.ts
    │   └── equipment.page.ts
    └── specs/
        ├── auth.spec.ts
        ├── equipment-crud.spec.ts
        └── alert-workflow.spec.ts
```

---

## 10. Frontend — Component Tests

### 10.1. Mẫu: Dashboard Component

```typescript
// src/app/modules/dashboard/dashboard.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { MOCK_KPI } from '../../core/mock/mock-data';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let apiServiceSpy: jasmine.SpyObj<ApiService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    apiServiceSpy = jasmine.createSpyObj('ApiService', ['getKPI', 'getAlerts', 'subscribeAlerts']);
    authServiceSpy = jasmine.createSpyObj('AuthService', ['hasRole'], {
      currentUser: { id: 'U001', role: 'super_admin', fullName: 'Admin' }
    });

    apiServiceSpy.getKPI.and.returnValue(of(MOCK_KPI));
    apiServiceSpy.getAlerts.and.returnValue(of([]));
    apiServiceSpy.subscribeAlerts.and.returnValue(of());

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: ApiService, useValue: apiServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA]   // Ignore ng-zorro components
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load KPI data on init', () => {
    expect(apiServiceSpy.getKPI).toHaveBeenCalled();
  });

  it('should display OEE value', () => {
    component.kpi = MOCK_KPI;
    fixture.detectChanges();
    const el = fixture.nativeElement;
    expect(el.textContent).toContain(MOCK_KPI.oee.toString());
  });
});
```

---

## 11. Frontend — Service Tests

### 11.1. Mẫu: AuthService Tests

```typescript
// src/app/core/services/auth.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [AuthService] });
    service = TestBed.inject(AuthService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('login', () => {
    it('should login with valid credentials', (done) => {
      service.login('admin', '123456').subscribe(user => {
        expect(user.username).toBe('admin');
        expect(user.role).toBe('super_admin');
        expect(service.isAuthenticated).toBeTrue();
        expect(service.token).toBeTruthy();
        done();
      });
    });

    it('should reject invalid password', (done) => {
      service.login('admin', 'wrong').subscribe({
        error: (err) => {
          expect(err.message).toContain('không chính xác');
          expect(service.isAuthenticated).toBeFalse();
          done();
        }
      });
    });

    it('should reject locked account', (done) => {
      // Assuming a locked user exists in mock data
      service.login('locked_user', '123456').subscribe({
        error: (err) => {
          expect(err.message).toContain('khóa');
          done();
        }
      });
    });
  });

  describe('hasRole', () => {
    it('should return true for matching role', (done) => {
      service.login('admin', '123456').subscribe(() => {
        expect(service.hasRole(['super_admin'])).toBeTrue();
        expect(service.hasRole(['super_admin', 'factory_manager'])).toBeTrue();
        done();
      });
    });

    it('should return false for non-matching role', (done) => {
      service.login('viewer', '123456').subscribe(() => {
        expect(service.hasRole(['super_admin'])).toBeFalse();
        expect(service.hasRole(['maintenance_engineer'])).toBeFalse();
        done();
      });
    });

    it('should return false when not authenticated', () => {
      expect(service.hasRole(['super_admin'])).toBeFalse();
    });
  });

  describe('logout', () => {
    it('should clear auth state', (done) => {
      service.login('admin', '123456').subscribe(() => {
        service.logout();
        expect(service.isAuthenticated).toBeFalse();
        expect(service.currentUser).toBeNull();
        expect(service.token).toBeNull();
        expect(localStorage.getItem('maintenix_auth')).toBeNull();
        done();
      });
    });
  });
});
```

---

## 12. Frontend — Guard & Interceptor Tests

### 12.1. RoleGuard Test

```typescript
// src/app/core/guards/role.guard.spec.ts
import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot } from '@angular/router';
import { RoleGuard } from './role.guard';
import { AuthService } from '../services/auth.service';

describe('RoleGuard', () => {
  let guard: RoleGuard;
  let authSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    authSpy = jasmine.createSpyObj('AuthService', ['hasRole']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        RoleGuard,
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
      ]
    });
    guard = TestBed.inject(RoleGuard);
  });

  it('should allow access when no roles specified', () => {
    const route = { data: {} } as unknown as ActivatedRouteSnapshot;
    expect(guard.canActivate(route)).toBeTrue();
  });

  it('should allow access for matching role', () => {
    authSpy.hasRole.and.returnValue(true);
    const route = { data: { roles: ['super_admin', 'factory_manager'] } } as unknown as ActivatedRouteSnapshot;
    expect(guard.canActivate(route)).toBeTrue();
  });

  it('should deny access and redirect for non-matching role', () => {
    authSpy.hasRole.and.returnValue(false);
    const route = { data: { roles: ['super_admin'] } } as unknown as ActivatedRouteSnapshot;
    expect(guard.canActivate(route)).toBeFalse();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  // Test all role groups from app.routes.ts
  const roleTests = [
    { route: '/users', roles: ['super_admin'], allowed: 'super_admin', denied: 'viewer' },
    { route: '/ai-models', roles: ['super_admin', 'data_scientist'], allowed: 'data_scientist', denied: 'technician' },
    { route: '/maintenance', roles: ['super_admin','factory_manager','maintenance_manager','maintenance_engineer','technician'], allowed: 'technician', denied: 'viewer' },
  ];

  roleTests.forEach(({ route, roles, allowed, denied }) => {
    it(`${route} should allow ${allowed}`, () => {
      authSpy.hasRole.and.callFake((r: string[]) => r.includes(allowed));
      const snapshot = { data: { roles } } as unknown as ActivatedRouteSnapshot;
      expect(guard.canActivate(snapshot)).toBeTrue();
    });

    it(`${route} should deny ${denied}`, () => {
      authSpy.hasRole.and.callFake((r: string[]) => r.includes(denied));
      const snapshot = { data: { roles } } as unknown as ActivatedRouteSnapshot;
      expect(guard.canActivate(snapshot)).toBeFalse();
    });
  });
});
```

---

## 13. Frontend — E2E Tests (Playwright)

### 13.1. Playwright Config

```typescript
// e2e/playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:4200',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
  webServer: {
    command: 'ng serve',
    port: 4200,
    reuseExistingServer: true,
  },
});
```

### 13.2. Page Object Models

```typescript
// e2e/pages/login.page.ts
import { Page, Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.locator('input[placeholder*="Tên đăng nhập"]');
    this.passwordInput = page.locator('input[placeholder*="Mật khẩu"]');
    this.loginButton = page.locator('button:has-text("Đăng nhập")');
    this.errorMessage = page.locator('.login-error, nz-alert');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  async expectRedirectToDashboard() {
    await expect(this.page).toHaveURL(/dashboard/);
  }

  async expectError(message: string) {
    await expect(this.errorMessage).toContainText(message);
  }
}
```

### 13.3. E2E Test Specs

```typescript
// e2e/specs/auth.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';

test.describe('Authentication', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('should login as admin', async ({ page }) => {
    await loginPage.login('admin', '123456');
    await loginPage.expectRedirectToDashboard();
    await expect(page.locator('.user-name')).toContainText('Nguyễn Văn Admin');
  });

  test('should show error for wrong password', async () => {
    await loginPage.login('admin', 'wrongpass');
    await loginPage.expectError('không chính xác');
  });

  test('should hide admin menu for viewer role', async ({ page }) => {
    await loginPage.login('viewer', '123456');
    await loginPage.expectRedirectToDashboard();
    await expect(page.locator('text=Quản lý Người dùng')).not.toBeVisible();
    await expect(page.locator('text=Cấu hình Hệ thống')).not.toBeVisible();
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('viewer cannot navigate to /users via URL', async ({ page }) => {
    await loginPage.login('viewer', '123456');
    await page.goto('/users');
    await expect(page).toHaveURL(/dashboard/);
  });
});

// e2e/specs/alert-workflow.spec.ts
test.describe('Alert Workflow', () => {
  test('engineer can acknowledge alert', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('engineer', '123456');

    await page.locator('text=Quản lý Cảnh báo').click();
    await expect(page).toHaveURL(/alerts/);

    // Click first open alert
    const firstAlert = page.locator('tr:has-text("open")').first();
    await firstAlert.locator('text=Chi tiết').click();

    // Acknowledge
    await page.locator('button:has-text("Xác nhận")').click();
    await expect(page.locator('nz-tag:has-text("acknowledged")')).toBeVisible();
  });
});
```

---

## 14. API Contract Tests

> Đảm bảo frontend và backend đồng bộ format request/response.

### 14.1. Response Format Contract

```go
// pkg/response/response_test.go
func TestSuccessResponse_Format(t *testing.T) {
    data := map[string]string{"id": "EQ001", "name": "Test"}

    resp := response.Success(data)
    jsonBytes, _ := json.Marshal(resp)

    var result map[string]interface{}
    json.Unmarshal(jsonBytes, &result)

    // Verify required fields
    assert.True(t, result["success"].(bool))
    assert.NotNil(t, result["data"])
    assert.NotEmpty(t, result["timestamp"])
    assert.NotEmpty(t, result["requestId"])
}

func TestErrorResponse_Format(t *testing.T) {
    resp := response.Error("EQUIPMENT_NOT_FOUND", "Not found", nil)
    jsonBytes, _ := json.Marshal(resp)

    var result map[string]interface{}
    json.Unmarshal(jsonBytes, &result)

    assert.False(t, result["success"].(bool))
    errObj := result["error"].(map[string]interface{})
    assert.Equal(t, "EQUIPMENT_NOT_FOUND", errObj["code"])
    assert.Equal(t, "Not found", errObj["message"])
}

func TestPaginatedResponse_Format(t *testing.T) {
    items := []string{"a", "b"}
    resp := response.Paginated(items, 1, 20, 50)
    jsonBytes, _ := json.Marshal(resp)

    var result map[string]interface{}
    json.Unmarshal(jsonBytes, &result)

    meta := result["meta"].(map[string]interface{})
    assert.Equal(t, float64(1), meta["page"])
    assert.Equal(t, float64(20), meta["pageSize"])
    assert.Equal(t, float64(50), meta["total"])
    assert.Equal(t, float64(3), meta["totalPages"])
}
```

---

## 15. Performance & Load Tests

### 15.1. Go Benchmarks

```go
func BenchmarkAnomalyDetector_ZScore(b *testing.B) {
    detector := service.NewAnomalyDetector(service.AnomalyConfig{
        Method: "z_score", WindowSize: 1000,
    })
    readings := make([]float64, 1000)
    for i := range readings { readings[i] = 80 + float64(i%20) - 10 }
    detector.Train(readings)

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        detector.Evaluate(92.5)
    }
}

func BenchmarkHealthScoreCalculation(b *testing.B) {
    calc := service.NewHealthCalculator()
    sensors := generateTestSensorData(12)

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        calc.Calculate(sensors)
    }
}
```

```bash
# Run benchmarks
go test -bench=. -benchmem ./services/sensor-service/internal/service/...

# Compare benchmarks
benchstat old.txt new.txt
```

### 15.2. Load Test Script (k6)

```javascript
// tests/load/sensor-ingestion.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 50 },    // Ramp up
    { duration: '2m',  target: 200 },   // Sustain
    { duration: '30s', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],    // 95% requests < 500ms
    errors: ['rate<0.01'],               // Error rate < 1%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
let token = '';

export function setup() {
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    username: 'admin', password: '123456'
  }), { headers: { 'Content-Type': 'application/json' } });

  return { token: loginRes.json('data.token') };
}

export default function (data) {
  const headers = {
    Authorization: `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  // GET equipment list
  const eqRes = http.get(`${BASE_URL}/api/equipment`, { headers });
  check(eqRes, { 'equipment 200': (r) => r.status === 200 });
  errorRate.add(eqRes.status !== 200);

  // GET sensors
  const sensorRes = http.get(`${BASE_URL}/api/sensors`, { headers });
  check(sensorRes, { 'sensors 200': (r) => r.status === 200 });

  // GET alerts
  const alertRes = http.get(`${BASE_URL}/api/alerts?severity=critical`, { headers });
  check(alertRes, { 'alerts 200': (r) => r.status === 200 });

  sleep(1);
}
```

```bash
# Install k6
brew install k6  # macOS
choco install k6 # Windows

# Run load test
k6 run tests/load/sensor-ingestion.js

# With custom base URL
k6 run -e BASE_URL=http://staging.maintenix.vn tests/load/sensor-ingestion.js
```

---

## 16. CI/CD Pipeline

### 16.1. Tổng quan Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           GitHub Actions CI/CD Pipeline                         │
│                                                                                 │
│  Push/PR to main                                                                │
│  ┌─────────┐    ┌──────────┐   ┌───────────┐    ┌────────┐   ┌───────────────┐  │
│  │  Lint & │──▶│  Unit    │──▶│Integration│──▶│ Build  │──▶│   Deploy      │  │
│  │  Format │    │  Tests   │   │   Tests   │    │ & Push │   │  (per env)    │  │
│  └─────────┘    └──────────┘   └───────────┘    └────────┘   └───────────────┘  │
│    ~1 min         ~3 min         ~5 min          ~2 min        ~3 min           │
│                                                                                 │
│  Frontend (parallel)                                                            │
│  ┌─────────┐    ┌──────────┐   ┌────────────┐    ┌────────┐                     │
│  │  Lint & │──▶│  Unit    │──▶│   E2E      │──▶│ Build  │                     │
│  │  Format │    │  Tests   │   │(Playwright)│    │ & Push │                     │
│  └─────────┘    └──────────┘   └───────── ──┘    └────────┘                     │
│    ~30 sec        ~2 min         ~4 min          ~1 min                         │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 16.2. GitHub Actions — Backend Pipeline

```yaml
# .github/workflows/backend-ci.yml
name: Backend CI

on:
  push:
    branches: [main, develop]
    paths:
      - 'services/**'
      - 'pkg/**'
      - 'go.mod'
      - 'go.sum'
  pull_request:
    branches: [main]
    paths:
      - 'services/**'
      - 'pkg/**'

env:
  GO_VERSION: '1.22'
  GOLANGCI_LINT_VERSION: 'v1.57'

jobs:
  # ─── Stage 1: Lint & Static Analysis ───
  lint:
    name: Lint & Format
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-go@v5
        with:
          go-version: ${{ env.GO_VERSION }}
          cache: true

      - name: Check formatting
        run: |
          gofmt_output=$(gofmt -l .)
          if [ -n "$gofmt_output" ]; then
            echo "❌ Files not formatted:"
            echo "$gofmt_output"
            exit 1
          fi

      - name: Run golangci-lint
        uses: golangci/golangci-lint-action@v4
        with:
          version: ${{ env.GOLANGCI_LINT_VERSION }}
          args: --timeout 5m

      - name: Check go mod tidy
        run: |
          go mod tidy
          git diff --exit-code go.mod go.sum

  # ─── Stage 2: Unit Tests ───
  unit-tests:
    name: Unit Tests
    needs: lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-go@v5
        with:
          go-version: ${{ env.GO_VERSION }}
          cache: true

      - name: Run unit tests
        run: |
          go test -tags=unit -race -coverprofile=coverage-unit.out -covermode=atomic ./services/...

      - name: Check coverage threshold
        run: |
          COVERAGE=$(go tool cover -func=coverage-unit.out | grep total | awk '{print $3}' | sed 's/%//')
          echo "Total coverage: ${COVERAGE}%"
          if (( $(echo "$COVERAGE < 60" | bc -l) )); then
            echo "❌ Unit test coverage ${COVERAGE}% is below 60% threshold"
            exit 1
          fi

      - name: Upload coverage artifact
        uses: actions/upload-artifact@v4
        with:
          name: coverage-unit
          path: coverage-unit.out

  # ─── Stage 3: Integration Tests ───
  integration-tests:
    name: Integration Tests
    needs: unit-tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_maintenix
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-go@v5
        with:
          go-version: ${{ env.GO_VERSION }}
          cache: true

      - name: Run integration tests
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/test_maintenix?sslmode=disable
          REDIS_URL: redis://localhost:6379
        run: |
          go test -tags=integration -race -coverprofile=coverage-integration.out \
            -covermode=atomic -timeout 10m ./services/...

      - name: Upload coverage artifact
        uses: actions/upload-artifact@v4
        with:
          name: coverage-integration
          path: coverage-integration.out

  # ─── Stage 4: Build & Push Docker Images ───
  build:
    name: Build & Push
    needs: [unit-tests, integration-tests]
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service:
          - api-gateway
          - auth-service
          - equipment-service
          - sensor-service
          - alert-service
          - workorder-service
          - ml-service
          - notification-service
          - opcua-bridge
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: services/${{ matrix.service }}/Dockerfile
          push: true
          tags: |
            ghcr.io/${{ github.repository }}/${{ matrix.service }}:${{ github.sha }}
            ghcr.io/${{ github.repository }}/${{ matrix.service }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # ─── Stage 5: Deploy ───
  deploy-staging:
    name: Deploy Staging
    needs: build
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Kubernetes (Staging)
        run: |
          kubectl apply -k deployments/k8s/overlays/staging/
          kubectl rollout status deployment --all -n maintenix-staging --timeout=300s

  deploy-production:
    name: Deploy Production
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Kubernetes (Production)
        run: |
          kubectl apply -k deployments/k8s/overlays/production/
          kubectl rollout status deployment --all -n maintenix-prod --timeout=300s
```

### 16.3. GitHub Actions — Frontend Pipeline

```yaml
# .github/workflows/frontend-ci.yml
name: Frontend CI

on:
  push:
    branches: [main, develop]
    paths:
      - 'frontend/**'
  pull_request:
    branches: [main]
    paths:
      - 'frontend/**'

env:
  NODE_VERSION: '20'

jobs:
  # ─── Stage 1: Lint & Format ───
  lint:
    name: Lint & Format
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - run: npm ci

      - name: ESLint
        run: npx eslint src/ --ext .ts --max-warnings 0

      - name: Prettier check
        run: npx prettier --check "src/**/*.{ts,html,scss}"

  # ─── Stage 2: Unit Tests ───
  unit-tests:
    name: Unit Tests
    needs: lint
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - run: npm ci

      - name: Run unit tests with coverage
        run: npm run test:ci

      - name: Check coverage threshold
        run: |
          # ng test generates coverage/maintenix-app/coverage-summary.json
          COVERAGE=$(node -e "
            const c = require('./coverage/maintenix-app/coverage-summary.json');
            console.log(c.total.statements.pct);
          ")
          echo "Statement coverage: ${COVERAGE}%"
          if (( $(echo "$COVERAGE < 50" | bc -l) )); then
            echo "❌ Coverage ${COVERAGE}% is below 50% threshold"
            exit 1
          fi

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: frontend-coverage
          path: frontend/coverage/

  # ─── Stage 3: E2E Tests ───
  e2e-tests:
    name: E2E Tests (Playwright)
    needs: unit-tests
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: npx playwright test --project=chromium

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: frontend/playwright-report/

  # ─── Stage 4: Build ───
  build:
    name: Build Production
    needs: [unit-tests, e2e-tests]
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - run: npm ci

      - name: Build production
        run: npx ng build --configuration production

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: frontend
          push: true
          tags: |
            ghcr.io/${{ github.repository }}/frontend:${{ github.sha }}
            ghcr.io/${{ github.repository }}/frontend:latest
```

### 16.4. Quality Gate — PR Check

```yaml
# .github/workflows/pr-check.yml
name: PR Quality Gate

on:
  pull_request:
    branches: [main, develop]

jobs:
  quality-gate:
    name: Quality Gate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check commit messages (Conventional Commits)
        uses: wagoid/commitlint-github-action@v5
        with:
          configFile: .commitlintrc.yml

      - name: Check PR title
        run: |
          PR_TITLE="${{ github.event.pull_request.title }}"
          if ! echo "$PR_TITLE" | grep -qE "^(feat|fix|docs|style|refactor|perf|test|chore|ci)(\(.+\))?: .+"; then
            echo "❌ PR title must follow Conventional Commits format"
            echo "   Examples: feat(equipment): add health score calculation"
            echo "             fix(alert): correct SLA deadline computation"
            exit 1
          fi

      - name: Check for TODO/FIXME in diff
        run: |
          DIFF=$(git diff origin/main...HEAD)
          if echo "$DIFF" | grep -n "TODO\|FIXME\|HACK\|XXX" | grep "^+"; then
            echo "⚠️ New TODO/FIXME found. Create an issue instead."
          fi
```

---

## 17. Coverage Targets & Quality Gates

### 17.1. Coverage Targets theo Layer

| Layer | Target | Hard Minimum | Giải thích |
|-------|--------|-------------|-----------|
| **Domain / Business Logic** | ≥ 90% | 80% | Logic nghiệp vụ là core, phải test kỹ |
| **Service Layer** | ≥ 80% | 70% | Orchestration + validation logic |
| **Handler / Controller** | ≥ 70% | 60% | Request/response mapping, error codes |
| **Repository Layer** | ≥ 60% | 50% | SQL logic (integration tests cover phần lớn) |
| **gRPC Server** | ≥ 70% | 60% | Proto mapping + service delegation |
| **Kafka Consumer** | ≥ 60% | 50% | Message parsing + routing logic |
| **Frontend Components** | ≥ 60% | 50% | Template rendering + user interactions |
| **Frontend Services** | ≥ 80% | 70% | Business logic phía client |
| **Frontend Guards** | ≥ 90% | 80% | Security-critical, phải cover đầy đủ |

### 17.2. Coverage Targets theo Service

```
┌─────────────────────────────────┬────────────┬───────────────┐
│ Service                         │ Target     │ Hard Minimum  │
├─────────────────────────────────┼────────────┼───────────────┤
│ auth-service                    │ ≥ 85%      │ 75%           │
│ equipment-service               │ ≥ 80%      │ 70%           │
│ sensor-service                  │ ≥ 75%      │ 65%           │
│ alert-service                   │ ≥ 85%      │ 75%           │
│ workorder-service               │ ≥ 80%      │ 70%           │
│ ml-service                      │ ≥ 70%      │ 60%           │
│ notification-service            │ ≥ 65%      │ 55%           │
│ api-gateway                     │ ≥ 60%      │ 50%           │
│ opcua-bridge                    │ ≥ 60%      │ 50%           │
├─────────────────────────────────┼────────────┼───────────────┤
│ Frontend (tổng)                 │ ≥ 65%      │ 55%           │
│ Frontend Guards + Services      │ ≥ 80%      │ 70%           │
└─────────────────────────────────┴────────────┴───────────────┘
```

### 17.3. Quality Gates — PR Merge Conditions

Một PR chỉ được merge khi **tất cả** các điều kiện sau đạt:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PR Merge Conditions                             │
│                                                                        │
│  ✅ 1. All CI checks passed (lint, unit, integration, e2e)            │
│  ✅ 2. Coverage không giảm so với main branch (delta ≥ 0%)            │
│  ✅ 3. Không có critical/high vulnerability từ security scan          │
│  ✅ 4. Ít nhất 1 reviewer approved                                    │
│  ✅ 5. PR title follow Conventional Commits format                    │
│  ✅ 6. No merge conflicts                                             │
│  ✅ 7. Branch up-to-date with target branch                           │
│                                                                        │
│  Bỏ qua (cho hotfix):                                                  │
│  ⚠️  E2E tests có thể skip nếu hotfix label + manager approve         │
└────────────────────────────────────────────────────────────────────────┘
```

### 17.4. Coverage Report Configuration

**Backend — `go tool cover` + `go-coverage-report`:**

```bash
# Generate coverage report (HTML)
go test -tags=unit -coverprofile=coverage.out ./services/...
go tool cover -html=coverage.out -o coverage.html

# Coverage per service
for svc in auth equipment sensor alert workorder ml notification; do
  echo "=== ${svc}-service ==="
  go test -tags=unit -coverprofile=coverage-${svc}.out \
    ./services/${svc}-service/...
  go tool cover -func=coverage-${svc}.out | grep total
done
```

**Frontend — Karma Coverage (Istanbul):**

```json
// angular.json → projects.maintenix-app.architect.test
{
  "options": {
    "codeCoverage": true,
    "codeCoverageExclude": [
      "src/app/core/mock/**",
      "src/**/*.spec.ts",
      "src/environments/**"
    ]
  }
}
```

**Karma coverage thresholds (`karma.conf.js`):**

```javascript
coverageReporter: {
  type: 'lcov',
  dir: require('path').join(__dirname, './coverage/maintenix-app'),
  subdir: '.',
  check: {
    global: {
      statements: 55,
      branches: 45,
      functions: 50,
      lines: 55
    },
    each: {
      statements: 30,
      branches: 20,
      functions: 25,
      lines: 30
    }
  }
}
```

### 17.5. Coverage Badge & Reporting

```yaml
# Thêm vào CI pipeline sau khi test xong
- name: Generate coverage badge
  run: |
    COVERAGE=$(go tool cover -func=coverage.out | grep total | awk '{print $3}' | sed 's/%//')
    COLOR="red"
    if (( $(echo "$COVERAGE >= 80" | bc -l) )); then COLOR="brightgreen"
    elif (( $(echo "$COVERAGE >= 60" | bc -l) )); then COLOR="yellow"
    fi
    echo "COVERAGE=${COVERAGE}" >> $GITHUB_ENV
    echo "COLOR=${COLOR}" >> $GITHUB_ENV

- name: Update README badge
  uses: schneegans/dynamic-badges-action@v1.7.0
  with:
    auth: ${{ secrets.GIST_TOKEN }}
    gistID: <your-gist-id>
    filename: coverage.json
    label: coverage
    message: "${{ env.COVERAGE }}%"
    color: "${{ env.COLOR }}"
```

---

## 18. Makefile Commands & Scripts

### 18.1. Root Makefile — Testing Commands

```makefile
# Makefile (root)

# ═══════════════════════════════════════════
#  Variables
# ═══════════════════════════════════════════
GO          := go
GOTEST      := $(GO) test
GOCOVER     := $(GO) tool cover
LINT        := golangci-lint
SERVICES    := auth equipment sensor alert workorder ml notification api-gateway opcua-bridge
COVERAGE_DIR := .coverage

# ═══════════════════════════════════════════
#  Testing — Backend
# ═══════════════════════════════════════════

## test: Chạy tất cả unit tests
.PHONY: test
test:
	@echo "🧪 Running all unit tests..."
	$(GOTEST) -tags=unit -race -count=1 ./services/...

## test-v: Chạy unit tests với verbose output
.PHONY: test-v
test-v:
	@echo "🧪 Running all unit tests (verbose)..."
	$(GOTEST) -tags=unit -race -v -count=1 ./services/...

## test-service: Chạy test cho 1 service cụ thể
##   Usage: make test-service SVC=equipment
.PHONY: test-service
test-service:
	@if [ -z "$(SVC)" ]; then echo "❌ Usage: make test-service SVC=equipment"; exit 1; fi
	@echo "🧪 Running tests for $(SVC)-service..."
	$(GOTEST) -tags=unit -race -v -count=1 ./services/$(SVC)-service/...

## test-integration: Chạy integration tests (cần Docker)
.PHONY: test-integration
test-integration:
	@echo "🔗 Running integration tests..."
	@echo "   Đảm bảo Docker đang chạy và infrastructure đã up (make dev-infra)"
	$(GOTEST) -tags=integration -race -count=1 -timeout 10m ./services/...

## test-all: Chạy cả unit + integration tests
.PHONY: test-all
test-all: test test-integration

## test-cover: Chạy tests với coverage report
.PHONY: test-cover
test-cover:
	@echo "📊 Running tests with coverage..."
	@mkdir -p $(COVERAGE_DIR)
	$(GOTEST) -tags=unit -race -coverprofile=$(COVERAGE_DIR)/coverage.out \
		-covermode=atomic ./services/...
	$(GOCOVER) -html=$(COVERAGE_DIR)/coverage.out -o $(COVERAGE_DIR)/coverage.html
	$(GOCOVER) -func=$(COVERAGE_DIR)/coverage.out | grep total
	@echo "📄 Report: $(COVERAGE_DIR)/coverage.html"

## test-cover-service: Coverage cho 1 service
##   Usage: make test-cover-service SVC=alert
.PHONY: test-cover-service
test-cover-service:
	@if [ -z "$(SVC)" ]; then echo "❌ Usage: make test-cover-service SVC=alert"; exit 1; fi
	@echo "📊 Coverage for $(SVC)-service..."
	@mkdir -p $(COVERAGE_DIR)
	$(GOTEST) -tags=unit -race -coverprofile=$(COVERAGE_DIR)/coverage-$(SVC).out \
		-covermode=atomic ./services/$(SVC)-service/...
	$(GOCOVER) -html=$(COVERAGE_DIR)/coverage-$(SVC).out \
		-o $(COVERAGE_DIR)/coverage-$(SVC).html
	$(GOCOVER) -func=$(COVERAGE_DIR)/coverage-$(SVC).out | grep total
	@echo "📄 Report: $(COVERAGE_DIR)/coverage-$(SVC).html"

## test-cover-all: Coverage report cho từng service riêng
.PHONY: test-cover-all
test-cover-all:
	@echo "📊 Generating coverage for all services..."
	@mkdir -p $(COVERAGE_DIR)
	@for svc in $(SERVICES); do \
		echo "\n=== $${svc}-service ===" ; \
		$(GOTEST) -tags=unit -race -coverprofile=$(COVERAGE_DIR)/coverage-$${svc}.out \
			-covermode=atomic ./services/$${svc}-service/... 2>/dev/null ; \
		$(GOCOVER) -func=$(COVERAGE_DIR)/coverage-$${svc}.out 2>/dev/null | grep total || echo "  (no tests)" ; \
	done
	@echo "\n✅ All coverage reports in $(COVERAGE_DIR)/"

# ═══════════════════════════════════════════
#  Linting — Backend
# ═══════════════════════════════════════════

## lint: Chạy golangci-lint
.PHONY: lint
lint:
	@echo "🔍 Running linter..."
	$(LINT) run --timeout 5m ./...

## lint-fix: Chạy linter với auto-fix
.PHONY: lint-fix
lint-fix:
	@echo "🔧 Running linter with auto-fix..."
	$(LINT) run --fix ./...

# ═══════════════════════════════════════════
#  Mocking — Backend
# ═══════════════════════════════════════════

## mocks: Generate tất cả mocks
.PHONY: mocks
mocks:
	@echo "🎭 Generating mocks..."
	@for svc in $(SERVICES); do \
		echo "  → $${svc}-service" ; \
		cd services/$${svc}-service && mockery --all --dir=internal/domain \
			--output=mocks --outpkg=mocks --case=underscore --with-expecter 2>/dev/null ; \
		cd ../.. ; \
	done
	@echo "✅ Mocks generated"

## mocks-clean: Xóa tất cả mocks (để regenerate)
.PHONY: mocks-clean
mocks-clean:
	@echo "🗑️  Cleaning mocks..."
	@find services -type d -name mocks -exec rm -rf {} + 2>/dev/null || true
	@echo "✅ Mocks cleaned"

# ═══════════════════════════════════════════
#  Benchmarks — Backend
# ═══════════════════════════════════════════

## bench: Chạy benchmarks
.PHONY: bench
bench:
	@echo "⚡ Running benchmarks..."
	$(GOTEST) -bench=. -benchmem -run=^$$ ./services/...

## bench-compare: So sánh benchmark kết quả
##   Usage: make bench-compare OLD=bench_old.txt NEW=bench_new.txt
.PHONY: bench-compare
bench-compare:
	@if [ -z "$(OLD)" ] || [ -z "$(NEW)" ]; then \
		echo "❌ Usage: make bench-compare OLD=bench_old.txt NEW=bench_new.txt"; exit 1; fi
	benchstat $(OLD) $(NEW)
```

### 18.2. Frontend Scripts (`package.json`)

```json
{
  "scripts": {
    "──── Development ────": "",
    "start": "ng serve",
    "start:mock": "ng serve --configuration=mock",

    "──── Testing ────": "",
    "test": "ng test --watch=false --code-coverage",
    "test:watch": "ng test",
    "test:ci": "ng test --watch=false --code-coverage --browsers=ChromeHeadless --no-progress",
    "test:debug": "ng test --browsers=Chrome --no-watch=false",
    "test:service": "ng test --include='**/core/services/**/*.spec.ts' --watch=false",
    "test:guards": "ng test --include='**/core/guards/**/*.spec.ts' --watch=false",
    "test:component": "ng test --include='**/modules/**/*.spec.ts' --watch=false",

    "──── E2E ────": "",
    "e2e": "npx playwright test",
    "e2e:ui": "npx playwright test --ui",
    "e2e:headed": "npx playwright test --headed",
    "e2e:debug": "npx playwright test --debug",
    "e2e:report": "npx playwright show-report",
    "e2e:codegen": "npx playwright codegen http://localhost:4200",

    "──── Lint & Format ────": "",
    "lint": "ng lint",
    "lint:fix": "ng lint --fix",
    "format": "prettier --write \"src/**/*.{ts,html,scss}\"",
    "format:check": "prettier --check \"src/**/*.{ts,html,scss}\"",

    "──── Build ────": "",
    "build": "ng build",
    "build:prod": "ng build --configuration production",
    "build:analyze": "ng build --configuration production --stats-json && npx webpack-bundle-analyzer dist/maintenix-app/stats.json"
  }
}
```

### 18.3. Convenience Script — `scripts/test-all.sh`

```bash
#!/usr/bin/env bash
# scripts/test-all.sh — Chạy toàn bộ test suite (backend + frontend)
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "═══════════════════════════════════════════"
echo "  Maintenix — Full Test Suite"
echo "═══════════════════════════════════════════"
echo ""

FAILED=0

# ─── Backend Lint ───
echo -e "${YELLOW}▶ [1/6] Backend Lint${NC}"
if make lint; then
  echo -e "${GREEN}✅ Backend lint passed${NC}"
else
  echo -e "${RED}❌ Backend lint failed${NC}"
  FAILED=1
fi
echo ""

# ─── Backend Unit Tests ───
echo -e "${YELLOW}▶ [2/6] Backend Unit Tests${NC}"
if make test-cover; then
  echo -e "${GREEN}✅ Backend unit tests passed${NC}"
else
  echo -e "${RED}❌ Backend unit tests failed${NC}"
  FAILED=1
fi
echo ""

# ─── Backend Integration Tests ───
echo -e "${YELLOW}▶ [3/6] Backend Integration Tests${NC}"
if make test-integration; then
  echo -e "${GREEN}✅ Backend integration tests passed${NC}"
else
  echo -e "${RED}❌ Backend integration tests failed${NC}"
  FAILED=1
fi
echo ""

# ─── Frontend Lint ───
echo -e "${YELLOW}▶ [4/6] Frontend Lint${NC}"
cd frontend
if npm run lint && npm run format:check; then
  echo -e "${GREEN}✅ Frontend lint passed${NC}"
else
  echo -e "${RED}❌ Frontend lint failed${NC}"
  FAILED=1
fi
echo ""

# ─── Frontend Unit Tests ───
echo -e "${YELLOW}▶ [5/6] Frontend Unit Tests${NC}"
if npm run test:ci; then
  echo -e "${GREEN}✅ Frontend unit tests passed${NC}"
else
  echo -e "${RED}❌ Frontend unit tests failed${NC}"
  FAILED=1
fi
echo ""

# ─── Frontend E2E Tests ───
echo -e "${YELLOW}▶ [6/6] Frontend E2E Tests${NC}"
if npm run e2e; then
  echo -e "${GREEN}✅ Frontend E2E tests passed${NC}"
else
  echo -e "${RED}❌ Frontend E2E tests failed${NC}"
  FAILED=1
fi
cd ..
echo ""

# ─── Summary ───
echo "═══════════════════════════════════════════"
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}  ✅ ALL TESTS PASSED${NC}"
else
  echo -e "${RED}  ❌ SOME TESTS FAILED${NC}"
  exit 1
fi
echo "═══════════════════════════════════════════"
```

```bash
# Cấp quyền chạy
chmod +x scripts/test-all.sh

# Chạy full suite
./scripts/test-all.sh
```

### 18.4. Git Hooks — Pre-commit & Pre-push

```bash
# .husky/pre-commit (Frontend)
#!/bin/sh
cd frontend
npx lint-staged

# .husky/pre-push (Full)
#!/bin/sh
echo "🧪 Running pre-push checks..."
make test
cd frontend && npm run test:ci
```

**`lint-staged` config (`frontend/package.json`):**

```json
{
  "lint-staged": {
    "src/**/*.ts": [
      "eslint --fix",
      "prettier --write"
    ],
    "src/**/*.{html,scss}": [
      "prettier --write"
    ]
  }
}
```

---

## 19. Troubleshooting Tests

### 19.1. Backend — Lỗi thường gặp

| # | Lỗi | Nguyên nhân | Cách fix |
|---|------|-------------|----------|
| 1 | `no test files` khi chạy `go test ./...` | File test thiếu build tag hoặc wrong package | Kiểm tra `//go:build unit` ở đầu file. Bỏ tag nếu muốn chạy mặc định |
| 2 | `cannot find package "maintenix/..."` | Go module path sai | Kiểm tra `go.mod` có đúng module path. Chạy `go mod tidy` |
| 3 | `mockery: command not found` | Chưa cài mockery | `go install github.com/vektra/mockery/v2@latest`. Đảm bảo `$GOPATH/bin` trong PATH |
| 4 | `mock expects X calls, got Y` | Mock expectation không khớp | Kiểm tra logic code — có thể method được gọi nhiều/ít hơn expected |
| 5 | `testcontainers: Cannot connect to Docker` | Docker daemon không chạy | Khởi động Docker Desktop. Kiểm tra `docker ps` hoạt động |
| 6 | `port 5432 already in use` (integration test) | PostgreSQL local đang chạy cùng port | Dừng PostgreSQL local hoặc dùng random port trong testcontainers |
| 7 | `context deadline exceeded` | Test timeout quá ngắn | Tăng timeout: `go test -timeout 10m ./...` |
| 8 | `race condition detected` | Data race trong code | Dùng mutex/channel hoặc sync primitives. Flag `-race` giúp detect |
| 9 | `test passed individually but fails in batch` | Test không isolated — shared state | Đảm bảo mỗi test tự setup/teardown. Không dùng global variable |
| 10 | `coverage: 0.0% of statements` | File test ở package khác hoặc thiếu `-cover` flag | Đảm bảo test file cùng package hoặc dùng `-coverpkg` |

### 19.2. Frontend — Lỗi thường gặp

| # | Lỗi | Nguyên nhân | Cách fix |
|---|------|-------------|----------|
| 1 | `NullInjectorError: No provider for ApiService` | Thiếu provide mock trong TestBed | Thêm `{ provide: ApiService, useValue: jasmine.createSpyObj(...) }` vào providers |
| 2 | `Can't bind to 'nzType' since it isn't a known property` | Component ng-zorro chưa import | Thêm `schemas: [NO_ERRORS_SCHEMA]` hoặc import ng-zorro module trong test |
| 3 | `Karma: 0 of X SUCCESS` rồi timeout | Chrome/ChromeHeadless bị crash | Xóa cache: `rm -rf .angular/cache`. Chạy lại `npm ci` |
| 4 | `TypeError: Cannot read properties of undefined` | Observable chưa emit trong test | Mock service trả `of(...)` thay vì `undefined`. Kiểm tra async flow |
| 5 | `ExpressionChangedAfterItHasBeenCheckedError` | Change detection race condition | Thêm `fixture.detectChanges()` sau khi set data. Hoặc wrap trong `fakeAsync/tick` |
| 6 | `Error: Expected spy to have been called` | Spy chưa được gọi — logic sai hoặc timing | Kiểm tra component lifecycle. Spy có thể cần gọi trong `ngOnInit` — đảm bảo `fixture.detectChanges()` đã trigger |
| 7 | Playwright E2E: `Timeout waiting for selector` | Element chưa render hoặc selector sai | Dùng `page.waitForSelector()` explicit. Kiểm tra selector bằng Playwright codegen |
| 8 | Playwright E2E: `net::ERR_CONNECTION_REFUSED` | Dev server chưa start | Kiểm tra `ng serve` đang chạy. Hoặc config `webServer` trong `playwright.config.ts` |
| 9 | Coverage báo thấp dù có test | File test import sai path hoặc component khác | Kiểm tra `codeCoverageExclude` trong `angular.json` và import path |
| 10 | `Circular dependency detected` trong test | Module import lẫn nhau | Tách shared types ra file riêng. Dùng interface thay vì concrete class |

### 19.3. Debugging Strategies

**Backend — Go Test Debugging:**

```bash
# 1. Chạy 1 test cụ thể
go test -tags=unit -run TestEquipmentService_Create_Success -v ./services/equipment-service/...

# 2. Debug với delve
dlv test ./services/equipment-service/internal/service/ -- -test.run TestEquipmentService_Create

# 3. Print verbose mock calls
# Thêm vào cuối test:
mockRepo.AssertExpectations(t)  # Sẽ print expected vs actual calls

# 4. Xem coverage chi tiết cho 1 file
go test -coverprofile=c.out ./services/equipment-service/internal/service/
go tool cover -func=c.out | grep equipment_service.go

# 5. Race detection cho 1 package
go test -race -count=10 ./services/sensor-service/internal/service/
```

**Frontend — Angular Test Debugging:**

```bash
# 1. Chạy 1 file test cụ thể
ng test --include='**/dashboard.component.spec.ts'

# 2. Debug trong Chrome DevTools
ng test --browsers=Chrome  # Mở Chrome, F12 → Sources → Set breakpoints

# 3. Focused test (chỉ chạy 1 test)
# Thay describe → fdescribe, it → fit
fdescribe('DashboardComponent', () => {
  fit('should load KPI data', () => { ... });
});
# ⚠️ Nhớ bỏ fdescribe/fit trước khi commit!

# 4. Skip test tạm thời
xdescribe('Skipped suite', () => { ... });
xit('skipped test', () => { ... });

# 5. Playwright debug mode
npx playwright test --debug                    # Step-by-step
npx playwright test --headed                   # Thấy browser
npx playwright codegen http://localhost:4200   # Record interactions
PWDEBUG=1 npx playwright test                  # Inspector mode
```

### 19.4. Common Patterns — Fix nhanh

**Pattern 1: Test bị flaky (pass/fail ngẫu nhiên)**

```go
// ❌ Bad: Dùng time.Now() trực tiếp
func TestAlert_IsExpired(t *testing.T) {
    alert := &Alert{ExpiresAt: time.Now().Add(-1 * time.Hour)}
    assert.True(t, alert.IsExpired())  // Có thể fail nếu timing edge case
}

// ✅ Good: Inject clock
func TestAlert_IsExpired(t *testing.T) {
    clock := &fakeClock{now: time.Date(2026, 3, 1, 12, 0, 0, 0, time.UTC)}
    alert := &Alert{ExpiresAt: time.Date(2026, 3, 1, 11, 0, 0, 0, time.UTC)}
    assert.True(t, alert.IsExpired(clock.Now()))
}
```

**Pattern 2: Test phụ thuộc thứ tự chạy**

```go
// ❌ Bad: Shared state giữa các tests
var testDB *gorm.DB  // Global variable — nguy hiểm!

// ✅ Good: Mỗi test tự setup
func TestEquipmentRepo_Create(t *testing.T) {
    db, cleanup := setupTestDB(t)  // Fresh DB mỗi test
    defer cleanup()
    // ...
}
```

**Pattern 3: Frontend async test không đợi**

```typescript
// ❌ Bad: Không đợi async operation
it('should load data', () => {
  component.ngOnInit();
  expect(component.data).toBeDefined();  // Có thể undefined vì async
});

// ✅ Good: Dùng fakeAsync + tick
it('should load data', fakeAsync(() => {
  component.ngOnInit();
  tick();                                 // Flush microtasks
  fixture.detectChanges();
  expect(component.data).toBeDefined();
}));

// ✅ Good: Dùng waitForAsync + whenStable
it('should load data', waitForAsync(() => {
  component.ngOnInit();
  fixture.whenStable().then(() => {
    fixture.detectChanges();
    expect(component.data).toBeDefined();
  });
}));
```

**Pattern 4: Mock service trả Observable lỗi**

```typescript
// ❌ Bad: Không test error case
apiServiceSpy.getEquipment.and.returnValue(of([]));

// ✅ Good: Test cả success + error
// Success case:
apiServiceSpy.getEquipment.and.returnValue(of(mockEquipmentList));

// Error case:
apiServiceSpy.getEquipment.and.returnValue(
  throwError(() => new Error('Network error'))
);
fixture.detectChanges();
expect(component.errorMessage).toBe('Không thể tải dữ liệu thiết bị');
```

### 19.5. Checklist trước khi Push

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     Pre-push Testing Checklist                           │
│                                                                          │
│  Backend:                                                                │
│  □  make lint               → Không có warning/error                     │
│  □  make test               → Tất cả unit tests pass                     │
│  □  make test-cover         → Coverage ≥ target cho service đang sửa     │
│  □  make mocks              → Mocks up-to-date nếu sửa interface         │
│  □  go mod tidy             → go.mod/go.sum clean                        │
│                                                                          │
│  Frontend:                                                               │
│  □  npm run lint            → ESLint pass                                │
│  □  npm run format:check    → Prettier pass                              │
│  □  npm run test:ci         → Unit tests pass + coverage OK              │
│  □  npm run e2e             → E2E tests pass (nếu sửa UI flow)           │
│                                                                          │
│  General:                                                                │
│  □  Không có fdescribe/fit  → Kiểm tra trước commit                      │
│  □  Không có .only          → (nếu dùng Jest)                            │
│  □  Commit message          → Follow Conventional Commits                │
│  □  PR description          → Mô tả rõ thay đổi + link issue             │
└──────────────────────────────────────────────────────────────────────────┘
```