# Maintenix — Cài đặt môi trường trên Windows

> **Hướng dẫn cài đặt TOÀN BỘ môi trường** để chạy full project trên Windows 10/11

---

## 1. Tổng quan cần cài

```
┌─────────────────────────────────────────────────────────────────────┐
│                        WINDOWS 10/11                                │
│                                                                     │
│  ┌─── Cần cài trực tiếp ──────────────────────────────────────────┐ │
│  │                                                                │ │
│  │  1.  Windows Terminal         (terminal đẹp, tabs)             │ │
│  │  2.  Git 2.44+               (source control)                  │ │
│  │  3.  Node.js 20 LTS          (Angular frontend)                │ │
│  │  4.  Angular CLI 17+         (ng serve, ng build)              │ │
│  │  5.  Go 1.22+                (backend microservices)           │ │
│  │  6.  Go Dev Tools            (air, migrate, golangci-lint)     │ │
│  │  7.  Protocol Buffers 26+    (protoc + Go plugins)             │ │
│  │  8.  Docker Desktop 4.28+    (containers, Compose)             │ │
│  │  9.  Make (via Chocolatey)   (Makefile commands)               │ │
│  │                                                                │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─── Chạy qua Docker (KHÔNG cần cài riêng) ──────────────────────┐ │
│  │                                                                │ │
│  │  PostgreSQL 16       (port 5432)                               │ │
│  │  TimescaleDB 2.14    (port 5433)                               │ │
│  │  InfluxDB 2.7        (port 8086)                               │ │
│  │  Redis 7             (port 6379)                               │ │
│  │  Apache Kafka 3.7    (port 9092)                               │ │
│  │  Kafka UI            (port 9093)                               │ │
│  │  MinIO               (port 9000/9001)                          │ │
│  │  HashiCorp Vault     (port 8200)                               │ │
│  │  Prometheus          (port 9090)                               │ │
│  │  Grafana             (port 3000)                               │ │
│  │  Jaeger              (port 16686)                              │ │
│  │                                                                │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─── Tùy chọn (recommended) ─────────────────────────────────────┐ │
│  │                                                                │ │
│  │  VSCode + Extensions     (code editor)                         │ │
│  │  DBeaver / pgAdmin       (database GUI)                        │ │
│  │  Postman / Bruno         (API testing)                         │ │
│  │  kubectl + k9s           (Kubernetes — nếu deploy K8s)         │ │
│  │                                                                │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Yêu cầu phần cứng

| Thành phần | Minimum            | Recommended                |
|------------|--------------------|----------------------------|
| OS         | Windows 10 21H2+  | Windows 11 23H2+           |
| CPU        | 4 cores            | 8+ cores (i7/Ryzen 7)      |
| RAM        | 16 GB              | 32 GB                      |
| Disk       | 50 GB trống (SSD)  | 100 GB trống (NVMe SSD)    |
| Network    | Internet access    | Stable broadband            |

> **Lưu ý:** Docker Desktop + Kafka + TimescaleDB + InfluxDB + Redis + PostgreSQL + 9 Go services + Angular dev server sẽ dùng ~8-12 GB RAM khi chạy full. Nếu chỉ có 16 GB RAM, nên tắt bớt services không cần.

---

## 5. Bước 3 — Node.js + npm (Frontend)
### 5.1. Cài Node.js 20 LTS
### 5.2. Verify
### 5.3. Cấu hình npm (tùy chọn)
## 6. Bước 4 — Angular CLI (Frontend)
### 6.1. Cài Angular CLI global
### 6.3. Chạy thử frontend
## 7. Bước 5 — Go (Backend)
### 7.1. Cài Go 1.22+
### 7.2. Verify
### 7.3. Kiểm tra environment variables

---

## 8. Bước 6 — Go Tools (Backend Dev)
### 8.1. Cài các tools cần thiết

```powershell
# Hot reload (tương tự nodemon cho Go)
go install github.com/air-verse/air@latest

# Database migration
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

# Linter (static analysis)
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest

# Swagger docs generator
go install github.com/swaggo/swag/cmd/swag@latest

# Wire (dependency injection code gen)
go install github.com/google/wire/cmd/wire@latest

# gRPC tools (cài ở bước 7)
```

### 8.2. Verify tất cả

```powershell
air -v
# Output: air vx.x.x

migrate -version
# Output: x.x.x

golangci-lint --version
# Output: golangci-lint has version x.x.x

swag --version
# Output: swag version vx.x.x
```

---

## 9. Bước 7 — Protocol Buffers (gRPC)

### 9.1. Cài protoc compiler

**Cách 1 — Chocolatey (recommended):**

```powershell
choco install protoc -y
```

**Cách 2 — Tải thủ công:**

1. Vào https://github.com/protocolbuffers/protobuf/releases
2. Tải `protoc-26.x-win64.zip`
3. Giải nén vào `C:\protoc`
4. Thêm `C:\protoc\bin` vào System PATH

### 9.2. Cài Go plugins cho protoc

```powershell
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
```

### 9.3. Cài Buf CLI (optional — schema management)

```powershell
# Dùng npm (đã có từ bước 3)
npm install -g @bufbuild/buf

# Hoặc Chocolatey
choco install buf -y
```

### 9.4. Verify

```powershell
protoc --version
# Output: libprotoc 26.x

protoc-gen-go --version
# Output: protoc-gen-go vx.x.x

protoc-gen-go-grpc --version
# Output: protoc-gen-go-grpc x.x.x
```

### 9.5. Cài grpcurl (gRPC testing tool)

```powershell
choco install grpcurl -y
```

Hoặc:

```powershell
go install github.com/fullstorydev/grpcurl/cmd/grpcurl@latest
```

---

## 10. Bước 8 — Docker Desktop (Infrastructure)

### 10.1. Bật Windows features

Mở **PowerShell as Administrator**:

```powershell
# Bật WSL2
wsl --install

# Hoặc bật thủ công:
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

# Restart máy
Restart-Computer
```

Sau khi restart:

```powershell
# Set WSL 2 làm default
wsl --set-default-version 2

# Cài Ubuntu cho WSL (optional nhưng recommended)
wsl --install -d Ubuntu-24.04
```

### 10.2. Cài Docker Desktop

```powershell
winget install Docker.DockerDesktop
```

Hoặc tải từ: https://www.docker.com/products/docker-desktop/

### 10.3. Cấu hình Docker Desktop

Sau khi cài, mở Docker Desktop → **Settings**:

| Setting                | Value                              |
|------------------------|------------------------------------|
| General → WSL 2 backend| ✅ Enabled                          |
| Resources → Memory     | **8 GB** (minimum cho full stack)  |
| Resources → CPUs       | **4+** cores                       |
| Resources → Disk       | **50 GB+**                         |
| Resources → WSL Integration | ✅ Enable cho Ubuntu           |

### 10.4. Verify

```powershell
docker --version
# Output: Docker version 26.x.x

docker compose version
# Output: Docker Compose version v2.26.x

# Test run
docker run hello-world
```

---

## 11. Bước 9 — Infrastructure qua Docker Compose

### 11.1. File `docker-compose.infra.yml`

Tạo file `deployments/docker/docker-compose.infra.yml`:

```yaml
version: "3.9"

services:
  # ============ POSTGRESQL 16 ============
  postgres:
    image: postgres:16-alpine
    container_name: maintenix-postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: maintenix
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: maintenix
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U maintenix"]
      interval: 5s
      timeout: 5s
      retries: 5

  # ============ TIMESCALEDB 2.14 ============
  timescaledb:
    image: timescale/timescaledb:latest-pg16
    container_name: maintenix-timescaledb
    ports:
      - "5433:5432"
    environment:
      POSTGRES_USER: maintenix
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: maintenix_ts
    volumes:
      - timescale_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U maintenix"]
      interval: 5s
      timeout: 5s
      retries: 5

  # ============ INFLUXDB 2.7 ============
  influxdb:
    image: influxdb:2.7-alpine
    container_name: maintenix-influxdb
    ports:
      - "8086:8086"
    environment:
      DOCKER_INFLUXDB_INIT_MODE: setup
      DOCKER_INFLUXDB_INIT_USERNAME: maintenix
      DOCKER_INFLUXDB_INIT_PASSWORD: secret123456
      DOCKER_INFLUXDB_INIT_ORG: maintenix-org
      DOCKER_INFLUXDB_INIT_BUCKET: sensor_realtime
      DOCKER_INFLUXDB_INIT_RETENTION: 168h    # 7 days
      DOCKER_INFLUXDB_INIT_ADMIN_TOKEN: maintenix-influx-token
    volumes:
      - influx_data:/var/lib/influxdb2

  # ============ REDIS 7 ============
  redis:
    image: redis:7-alpine
    container_name: maintenix-redis
    ports:
      - "6379:6379"
    command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  # ============ APACHE KAFKA (KRaft mode — no Zookeeper) ============
  kafka:
    image: bitnami/kafka:3.7
    container_name: maintenix-kafka
    ports:
      - "9092:9092"
    environment:
      KAFKA_CFG_NODE_ID: 1
      KAFKA_CFG_PROCESS_ROLES: broker,controller
      KAFKA_CFG_CONTROLLER_QUORUM_VOTERS: 1@kafka:9093
      KAFKA_CFG_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093
      KAFKA_CFG_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,CONTROLLER:PLAINTEXT
      KAFKA_CFG_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CFG_AUTO_CREATE_TOPICS_ENABLE: "true"
    volumes:
      - kafka_data:/bitnami/kafka
    healthcheck:
      test: kafka-topics.sh --bootstrap-server localhost:9092 --list || exit 1
      interval: 10s
      timeout: 10s
      retries: 10

  # ============ KAFKA UI ============
  kafka-ui:
    image: provectuslabs/kafka-ui:latest
    container_name: maintenix-kafka-ui
    ports:
      - "9093:8080"
    environment:
      KAFKA_CLUSTERS_0_NAME: maintenix
      KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kafka:9092
    depends_on:
      kafka:
        condition: service_healthy

  # ============ MINIO (S3-Compatible) ============
  minio:
    image: minio/minio:latest
    container_name: maintenix-minio
    ports:
      - "9000:9000"    # API
      - "9001:9001"    # Console UI
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data

  # ============ HASHICORP VAULT ============
  vault:
    image: hashicorp/vault:1.15
    container_name: maintenix-vault
    ports:
      - "8200:8200"
    environment:
      VAULT_DEV_ROOT_TOKEN_ID: root
      VAULT_DEV_LISTEN_ADDRESS: 0.0.0.0:8200
    cap_add:
      - IPC_LOCK

  # ============ PROMETHEUS ============
  prometheus:
    image: prom/prometheus:v2.50.0
    container_name: maintenix-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ../../configs/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus

  # ============ GRAFANA ============
  grafana:
    image: grafana/grafana:10.3.0
    container_name: maintenix-grafana
    ports:
      - "3000:3000"
    environment:
      GF_SECURITY_ADMIN_USER: admin
      GF_SECURITY_ADMIN_PASSWORD: admin
    volumes:
      - grafana_data:/var/lib/grafana

  # ============ JAEGER ============
  jaeger:
    image: jaegertracing/all-in-one:1.54
    container_name: maintenix-jaeger
    ports:
      - "16686:16686"    # UI
      - "14268:14268"    # HTTP collector
      - "6831:6831/udp"  # Agent (Thrift compact)

volumes:
  postgres_data:
  timescale_data:
  influx_data:
  redis_data:
  kafka_data:
  minio_data:
  prometheus_data:
  grafana_data:
```

### 11.2. Khởi động infrastructure

```powershell
cd maintenix-backend\deployments\docker

# Khởi động tất cả infrastructure
docker compose -f docker-compose.infra.yml up -d

# Kiểm tra trạng thái
docker compose -f docker-compose.infra.yml ps

# Xem logs
docker compose -f docker-compose.infra.yml logs -f kafka
```

### 11.3. Verify từng service

| Service     | URL                                  | Credentials             |
|-------------|--------------------------------------|-------------------------|
| PostgreSQL  | `localhost:5432`                     | maintenix / secret      |
| TimescaleDB | `localhost:5433`                     | maintenix / secret      |
| InfluxDB    | http://localhost:8086                | maintenix / secret123456|
| Redis       | `localhost:6379`                     | (no password)           |
| Kafka UI    | http://localhost:9093                | —                       |
| MinIO       | http://localhost:9001                | minioadmin / minioadmin |
| Vault       | http://localhost:8200                | Token: root             |
| Prometheus  | http://localhost:9090                | —                       |
| Grafana     | http://localhost:3000                | admin / admin           |
| Jaeger      | http://localhost:16686               | —                       |

```powershell
# Quick test
docker exec maintenix-postgres psql -U maintenix -c "SELECT version();"
docker exec maintenix-redis redis-cli PING
docker exec maintenix-kafka kafka-topics.sh --bootstrap-server localhost:9092 --list
```

---

## 12. Bước 10 — Database Tools (GUI)

### 12.1. DBeaver Community (Recommended — hỗ trợ tất cả DB)

```powershell
winget install dbeaver.dbeaver
```

Hoặc tải: https://dbeaver.io/download/

**Tạo connections:**

| Connection Name       | Driver      | Host      | Port | Database     | User      | Password |
|-----------------------|-------------|-----------|------|-------------|-----------|----------|
| Maintenix PostgreSQL  | PostgreSQL  | localhost | 5432 | maintenix   | maintenix | secret   |
| Maintenix TimescaleDB | PostgreSQL  | localhost | 5433 | maintenix_ts| maintenix | secret   |

### 12.2. pgAdmin 4 (Alternative — chỉ PostgreSQL)

```powershell
winget install PostgreSQL.pgAdmin
```

### 12.3. RedisInsight (Redis GUI)

```powershell
winget install Redis.RedisInsight
```

Hoặc tải: https://redis.io/insight/

Kết nối: `localhost:6379` (no password)

### 12.4. InfluxDB — Dùng Web UI

Mở trình duyệt: http://localhost:8086 → Login: maintenix / secret123456

---

## 13. Bước 11 — API Testing

### 13.1. Postman (Recommended)

```powershell
winget install Postman.Postman
```

### 13.2. Bruno (Lightweight alternative — Git-friendly)

```powershell
winget install Bruno.Bruno
```

### 13.3. curl (đã có sẵn trong Windows 10/11)

```powershell
curl --version
# Output: curl 8.x.x (Windows)...
```

### 13.4. HTTPie (Beautiful CLI tool)

```powershell
pip install httpie
# Hoặc
winget install HTTPie.HTTPie
```

---

## 14. Bước 12 — IDE / Code Editor

### 14.1. Visual Studio Code (Recommended)

```powershell
winget install Microsoft.VisualStudioCode
```

### 14.2. VSCode Extensions cần cài

Mở VSCode → Extensions (Ctrl+Shift+X) → cài các extensions sau:

**Frontend (Angular):**

| Extension                          | ID                                          |
|------------------------------------|---------------------------------------------|
| Angular Language Service           | `angular.ng-template`                       |
| TypeScript Importer                | `pmneo.tsimporter`                          |
| Tailwind CSS IntelliSense          | `bradlc.vscode-tailwindcss`                 |
| ESLint                             | `dbaeumer.vscode-eslint`                    |
| Prettier                           | `esbenp.prettier-vscode`                    |
| Auto Import                        | `steoates.autoimport`                       |
| IntelliCode                        | `visualstudioexptteam.vscodeintellicode`    |

**Backend (Go):**

| Extension                          | ID                                          |
|------------------------------------|---------------------------------------------|
| Go (by Google)                     | `golang.go`                                 |
| Go Test Explorer                   | `premparihar.gotestexplorer`               |
| vscode-proto3                      | `zxh404.vscode-proto3`                      |

**Infrastructure & Database:**

| Extension                          | ID                                          |
|------------------------------------|---------------------------------------------|
| Docker                             | `ms-azuretools.vscode-docker`               |
| Kubernetes                         | `ms-kubernetes-tools.vscode-kubernetes-tools`|
| YAML                               | `redhat.vscode-yaml`                        |
| Thunder Client (API testing)       | `rangav.vscode-thunder-client`              |
| PostgreSQL (by Chris Kolkman)      | `ckolkman.vscode-postgres`                  |
| REST Client                        | `humao.rest-client`                         |
| GitLens                            | `eamodio.gitlens`                           |

**Tiện ích chung:**

| Extension                          | ID                                          |
|------------------------------------|---------------------------------------------|
| Error Lens                         | `usernamehw.errorlens`                      |
| indent-rainbow                     | `oderwat.indent-rainbow`                    |
| Better Comments                    | `aaron-bond.better-comments`                |
| Material Icon Theme                | `pkief.material-icon-theme`                 |

### 14.3. VSCode Settings cho project

Tạo file `.vscode/settings.json` trong thư mục root:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[go]": {
    "editor.defaultFormatter": "golang.go",
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.organizeImports": "explicit"
    }
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[html]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "go.lintTool": "golangci-lint",
  "go.lintFlags": ["--fast"],
  "go.useLanguageServer": true,
  "go.testFlags": ["-v"],
  "typescript.preferences.importModuleSpecifier": "relative",
  "files.exclude": {
    "**/node_modules": true,
    "**/.angular": true,
    "**/dist": true
  }
}
```

### 14.4. GoLand (Alternative — JetBrains IDE cho Go)

```powershell
winget install JetBrains.GoLand
```

> GoLand có built-in support tốt hơn cho Go, gRPC, database, Docker. Tuy nhiên cần license (có student free).

---

## 15. Bước 13 — Kubernetes (Tùy chọn)

> Chỉ cần nếu muốn deploy lên K8s. Development dùng Docker Compose là đủ.

### 15.1. Bật Kubernetes trong Docker Desktop

Docker Desktop → Settings → Kubernetes → ✅ Enable Kubernetes → Apply & Restart

### 15.2. Cài kubectl

```powershell
winget install Kubernetes.kubectl
```

Verify:

```powershell
kubectl version --client
kubectl cluster-info
```

### 15.3. Cài k9s (Terminal UI cho K8s)

```powershell
choco install k9s -y
```

### 15.4. Cài Helm (K8s package manager)

```powershell
choco install kubernetes-helm -y
```

### 15.5. Cài Kustomize

```powershell
choco install kustomize -y
```

---

## 16. Bước 14 — Make cho Windows

### 16.1. Cài GNU Make

```powershell
choco install make -y
```

### 16.2. Verify

```powershell
make --version
# Output: GNU Make 4.x
```

> Giờ có thể chạy `make dev-infra`, `make migrate-up`, `make test`... từ root project.

### 16.3. Alternative — Sử dụng Task (modern Makefile replacement)

```powershell
choco install go-task -y
```

Dùng `task` thay vì `make` nếu gặp compatibility issues với Makefile trên Windows.

---

## 17. Kiểm tra tất cả sau khi cài

Mở **PowerShell 7**, chạy từng lệnh:

```powershell
Write-Host "===== KIỂM TRA MÔI TRƯỜNG MAINTENIX =====" -ForegroundColor Cyan

# --- Core Tools ---
Write-Host "`n--- Core Tools ---" -ForegroundColor Yellow
git --version
node --version
npm --version
ng version --skip-update-check 2>$null | Select-String "Angular CLI"
go version
docker --version
docker compose version

# --- Go Dev Tools ---
Write-Host "`n--- Go Dev Tools ---" -ForegroundColor Yellow
air -v 2>$null || Write-Host "❌ air not found" -ForegroundColor Red
migrate -version 2>$null || Write-Host "❌ migrate not found" -ForegroundColor Red
golangci-lint --version 2>$null || Write-Host "❌ golangci-lint not found" -ForegroundColor Red
swag --version 2>$null || Write-Host "❌ swag not found" -ForegroundColor Red

# --- gRPC Tools ---
Write-Host "`n--- gRPC Tools ---" -ForegroundColor Yellow
protoc --version 2>$null || Write-Host "❌ protoc not found" -ForegroundColor Red
grpcurl --version 2>$null || Write-Host "❌ grpcurl not found" -ForegroundColor Red

# --- Optional ---
Write-Host "`n--- Optional ---" -ForegroundColor Yellow
make --version 2>$null | Select-Object -First 1 || Write-Host "⚠️ make not found" -ForegroundColor DarkYellow
kubectl version --client --short 2>$null || Write-Host "⚠️ kubectl not found" -ForegroundColor DarkYellow

Write-Host "`n===== KIỂM TRA HOÀN TẤT =====" -ForegroundColor Cyan
```

**Output mong đợi (tất cả ✅):**

```
===== KIỂM TRA MÔI TRƯỜNG MAINTENIX =====

--- Core Tools ---
git version 2.44.0.windows.1
v20.12.2
10.5.0
Angular CLI: 17.3.x
go version go1.22.x windows/amd64
Docker version 26.1.x
Docker Compose version v2.27.x

--- Go Dev Tools ---
  air  v1.51.x
x.x.x
golangci-lint has version v1.57.x
swag version v1.16.x

--- gRPC Tools ---
libprotoc 26.x

--- Optional ---
GNU Make 4.4.x
Client Version: v1.29.x

===== KIỂM TRA HOÀN TẤT =====
```

---

## 18. Chạy Full Project

### 18.1. Thứ tự khởi động

```
BƯỚC 1 ─── Infrastructure (Docker)
   │
   ├── PostgreSQL, TimescaleDB, InfluxDB
   ├── Redis, Kafka, MinIO, Vault
   └── Prometheus, Grafana, Jaeger
   │
BƯỚC 2 ─── Database Migrations + Seed
   │
BƯỚC 3 ─── Backend Services (9 services)
   │
   ├── auth-service      (:8081)    ← Phải khởi động đầu tiên
   ├── equipment-service (:8082)
   ├── sensor-service    (:8083)
   ├── alert-service     (:8084)
   ├── workorder-service (:8085)
   ├── ml-service        (:8086)
   ├── notification-svc  (:8087)
   ├── opcua-bridge      (:4840)    ← Optional (cần PLC simulator)
   └── api-gateway       (:8080)    ← Khởi động cuối cùng
   │
BƯỚC 4 ─── Frontend (Angular)
   │
   └── ng serve          (:4200)    ← Kết nối api-gateway :8080
```

### 18.2. Lệnh chạy

```powershell
# ===== TERMINAL 1: Infrastructure =====
cd maintenix-backend\deployments\docker
docker compose -f docker-compose.infra.yml up -d

# Đợi ~30 giây cho tất cả services healthy
docker compose -f docker-compose.infra.yml ps

# ===== TERMINAL 2: Migrations =====
cd maintenix-backend
.\scripts\migrate.ps1 up        # Hoặc: make migrate-up
.\scripts\seed.ps1              # Hoặc: make seed

# ===== TERMINAL 3-10: Backend Services =====
# (Mỗi service 1 tab trong Windows Terminal)

# Tab 3: Auth
cd maintenix-backend\services\auth-service
air    # hoặc: go run cmd/main.go

# Tab 4: Equipment
cd maintenix-backend\services\equipment-service
air

# Tab 5: Sensor
cd maintenix-backend\services\sensor-service
air

# Tab 6: Alert
cd maintenix-backend\services\alert-service
air

# Tab 7: WorkOrder
cd maintenix-backend\services\workorder-service
air

# Tab 8: ML
cd maintenix-backend\services\ml-service
air

# Tab 9: Notification
cd maintenix-backend\services\notification-service
air

# Tab 10: API Gateway (khởi động cuối cùng)
cd maintenix-backend\services\api-gateway
air

# ===== TERMINAL 11: Frontend =====
cd maintenix-app
npm install     # Lần đầu
ng serve        # http://localhost:4200
```

### 18.3. Hoặc chạy tất cả backend bằng Docker Compose

```powershell
# Chạy cả infrastructure + backend services
cd maintenix-backend\deployments\docker
docker compose -f docker-compose.yml up --build -d

# Chỉ cần chạy frontend riêng
cd maintenix-app
ng serve
```

### 18.4. Verify full stack

```powershell
# Backend health
curl http://localhost:8080/health

# Login
$token = (curl -s -X POST http://localhost:8080/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"username":"admin","password":"123456"}' | ConvertFrom-Json).data.token

# Get equipment
curl -s http://localhost:8080/api/equipment `
  -H "Authorization: Bearer $token" | ConvertFrom-Json

# Frontend
Start-Process "http://localhost:4200"
```

---

## 19. Ports tổng hợp

### 19.1. Tất cả ports sử dụng

| Port  | Service                | Loại           | Ghi chú                    |
|-------|------------------------|----------------|-----------------------------|
| 4200  | Angular Dev Server     | Frontend       | `ng serve`                  |
| 8080  | API Gateway            | Backend        | REST + WebSocket proxy      |
| 8081  | Auth Service           | Backend        | REST + gRPC (50051)         |
| 8082  | Equipment Service      | Backend        | REST + gRPC                 |
| 8083  | Sensor Service         | Backend        | REST + gRPC (streaming)     |
| 8084  | Alert Service          | Backend        | REST + WebSocket + gRPC     |
| 8085  | WorkOrder Service      | Backend        | REST                        |
| 8086  | ML Service / InfluxDB  | Backend / Infra| REST + gRPC / InfluxDB UI   |
| 8087  | Notification Service   | Backend        | Kafka consumer only         |
| 4840  | OPC-UA Bridge          | Backend        | OPC-UA protocol             |
| 5432  | PostgreSQL             | Infrastructure | Master data                 |
| 5433  | TimescaleDB            | Infrastructure | Time-series data            |
| 6379  | Redis                  | Infrastructure | Cache + Sessions            |
| 8200  | HashiCorp Vault        | Infrastructure | Secret management           |
| 9000  | MinIO API              | Infrastructure | S3-compatible storage       |
| 9001  | MinIO Console          | Infrastructure | Web UI                      |
| 9090  | Prometheus             | Observability  | Metrics                     |
| 9092  | Kafka Broker           | Infrastructure | Event streaming             |
| 9093  | Kafka UI               | Infrastructure | Web UI                      |
| 3000  | Grafana                | Observability  | Dashboards                  |
| 16686 | Jaeger                 | Observability  | Distributed tracing         |

### 19.2. Kiểm tra port conflict

```powershell
# Kiểm tra tất cả ports quan trọng
$ports = @(4200,8080,8081,8082,8083,8084,8085,8086,8087,4840,5432,5433,6379,8200,9000,9001,9090,9092,9093,3000,16686)

foreach ($port in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($conn) {
        $process = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        Write-Host "⚠️  Port $port đang được dùng bởi: $($process.ProcessName)" -ForegroundColor Yellow
    } else {
        Write-Host "✅ Port $port: Available" -ForegroundColor Green
    }
}
```

---
