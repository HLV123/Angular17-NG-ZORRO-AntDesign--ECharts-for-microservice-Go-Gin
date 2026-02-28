# Maintenix — Troubleshooting Guide

> **Smart Predictive Maintenance Warning System**
> Hướng dẫn chẩn đoán và khắc phục sự cố toàn diện: cài đặt môi trường, Docker infrastructure, backend services, frontend, database, Kafka, gRPC, networking, performance, production.

---

## Mục lục

1. [Quy trình Chẩn đoán Tổng quát](#1-quy-trình-chẩn-đoán-tổng-quát)
2. [Cài đặt Môi trường — Windows](#2-cài-đặt-môi-trường--windows)
3. [Docker & Docker Compose](#3-docker--docker-compose)
4. [PostgreSQL & TimescaleDB](#4-postgresql--timescaledb)
5. [InfluxDB](#5-influxdb)
6. [Redis](#6-redis)
7. [Apache Kafka](#7-apache-kafka)
8. [Backend — Go Services](#8-backend--go-services)
9. [Backend — gRPC](#9-backend--grpc)
10. [Backend — API Gateway](#10-backend--api-gateway)
11. [Frontend — Angular](#11-frontend--angular)
12. [Authentication & Authorization (RBAC)](#12-authentication--authorization-rbac)
13. [WebSocket & Real-time Data](#13-websocket--real-time-data)
14. [Sensor Pipeline & Anomaly Detection](#14-sensor-pipeline--anomaly-detection)
15. [AI/ML Service](#15-aiml-service)
16. [Monitoring & Observability](#16-monitoring--observability)
17. [Performance & Tối ưu](#17-performance--tối-ưu)
18. [Networking & Port Conflicts](#18-networking--port-conflicts)
19. [Data & Migration Issues](#19-data--migration-issues)
20. [Production Issues](#20-production-issues)
21. [Quick Reference — Lệnh Chẩn đoán](#21-quick-reference--lệnh-chẩn-đoán)

---

## 1. Quy trình Chẩn đoán Tổng quát

### 1.1. Flowchart Chẩn đoán

```
                        ┌──────────────────┐
                        │  Phát hiện lỗi   │
                        └────────┬─────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  Xác định phạm vi lỗi   │
                    │  (Frontend / Backend /  │
                    │   Infrastructure / All) │
                    └────────────┬────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                   │
     ┌────────▼──────┐  ┌───────▼───────┐  ┌───────▼────────┐
     │  Frontend     │  │  Backend      │  │ Infrastructure │
     │  (Browser)    │  │  (Services)   │  │  (Docker)      │
     └────────┬──────┘  └───────┬───────┘  └───────┬────────┘
              │                  │                   │
     ┌────────▼──────┐  ┌───────▼───────┐  ┌───────▼────────┐
     │ 1. DevTools   │  │ 1. Service    │  │ 1. docker ps   │
     │    Console    │  │    logs       │  │ 2. docker logs │
     │ 2. Network tab│  │ 2. Health     │  │ 3. Resource    │
     │ 3. ng serve   │  │    endpoint   │  │    usage       │
     │    output     │  │ 3. Debug      │  │ 4. Network     │
     └───────────────┘  │    endpoint   │  │    inspect     │
                        └───────────────┘  └────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Kiểm tra logs chi tiết│
                    │   → Tìm error code      │
                    │   → Tra bảng bên dưới   │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │      Áp dụng fix        │
                    │   → Verify → Document   │
                    └─────────────────────────┘
```

### 1.2. Kiểm tra Nhanh Sức khỏe Hệ thống

```bash
# ===== 1. Infrastructure healthy? =====
docker compose -f docker-compose.infra.yml ps
# Tất cả containers phải ở trạng thái "Up (healthy)"

# ===== 2. Backend services running? =====
curl -s http://localhost:8080/health | jq .
# Mong đợi: {"status":"ok","services":{...}}

# Kiểm tra từng service
for port in 8081 8082 8083 8084 8085 8086 8087; do
  echo -n "Service :${port} → "
  curl -s --max-time 2 http://localhost:${port}/health | jq -r '.status' 2>/dev/null || echo "DOWN"
done

# ===== 3. Frontend running? =====
curl -s --max-time 2 http://localhost:4200 > /dev/null && echo "Frontend: UP" || echo "Frontend: DOWN"

# ===== 4. Database connections? =====
docker exec maintenix-postgres psql -U maintenix -c "SELECT 1;" > /dev/null 2>&1 && echo "PostgreSQL: OK" || echo "PostgreSQL: FAIL"
docker exec maintenix-redis redis-cli PING 2>/dev/null || echo "Redis: FAIL"

# ===== 5. Kafka healthy? =====
docker exec maintenix-kafka kafka-topics.sh --list --bootstrap-server localhost:9092 > /dev/null 2>&1 && echo "Kafka: OK" || echo "Kafka: FAIL"
```

### 1.3. Severity Levels

| Level | Ký hiệu | Mô tả | Ví dụ |
|-------|---------|-------|-------|
| **P0 — Critical** | 🔴 | Hệ thống down hoàn toàn, không sử dụng được | Tất cả services crash, DB corruption |
| **P1 — High** | 🟠 | Feature chính không hoạt động | Alert pipeline dừng, không login được |
| **P2 — Medium** | 🟡 | Feature phụ lỗi, workaround có | Report export fail, WebSocket ngắt kết nối |
| **P3 — Low** | 🟢 | Cosmetic, không ảnh hưởng chức năng | UI hiển thị sai format, log verbose |

---

## 2. Cài đặt Môi trường — Windows

### 2.1. Lỗi cài đặt Tools

| # | Lỗi | Nguyên nhân | Cách fix |
|---|------|-------------|----------|
| 1 | `'node' is not recognized as an internal or external command` | Node.js chưa thêm vào PATH | Cài lại Node.js bằng `winget install OpenJS.NodeJS.LTS`, tick "Add to PATH". Restart terminal |
| 2 | `'ng' is not recognized...` | Angular CLI chưa cài global | `npm install -g @angular/cli`. Nếu vẫn lỗi: kiểm tra `npm prefix -g` có trong PATH không |
| 3 | `'go' is not recognized...` | Go chưa cài hoặc PATH sai | Kiểm tra `C:\Program Files\Go\bin` trong System PATH. Restart terminal sau khi thêm |
| 4 | `go install ... permission denied` | Thiếu quyền write vào `$GOPATH/bin` | Chạy PowerShell as Administrator. Hoặc set `$env:GOPATH = "$env:USERPROFILE\go"` |
| 5 | `protoc: command not found` | protoc chưa cài hoặc PATH sai | `choco install protoc -y`. Kiểm tra `C:\ProgramData\chocolatey\bin` trong PATH |
| 6 | `npm install` rất chậm / timeout | Registry chậm từ Việt Nam | Dùng mirror: `npm config set registry https://registry.npmmirror.com`. Hoặc dùng VPN |
| 7 | `EPERM: operation not permitted` khi npm install | File bị lock (VSCode, antivirus) | Đóng VSCode → xóa `node_modules` → chạy lại `npm install` |
| 8 | `The term 'make' is not recognized` | GNU Make chưa cài trên Windows | `choco install make -y`. Alternative: dùng `go-task` (`choco install go-task -y`) |
| 9 | `air: command not found` | Go tools chưa trong PATH | Thêm `$env:GOPATH\bin` (thường `C:\Users\<user>\go\bin`) vào PATH. Verify: `go env GOPATH` |
| 10 | `WSL2 is not installed` khi mở Docker Desktop | WSL2 chưa bật | PowerShell Admin: `wsl --install` → restart → `wsl --set-default-version 2` |

### 2.2. Kiểm tra môi trường đầy đủ

```powershell
# Script kiểm tra tất cả tools cần thiết
$tools = @(
    @{ Name="Git";      Cmd="git --version" },
    @{ Name="Node.js";  Cmd="node --version" },
    @{ Name="npm";      Cmd="npm --version" },
    @{ Name="Angular";  Cmd="ng version 2>&1 | Select-String 'Angular CLI'" },
    @{ Name="Go";       Cmd="go version" },
    @{ Name="Docker";   Cmd="docker --version" },
    @{ Name="Compose";  Cmd="docker compose version" },
    @{ Name="Make";     Cmd="make --version 2>&1 | Select-Object -First 1" },
    @{ Name="protoc";   Cmd="protoc --version" },
    @{ Name="air";      Cmd="air -v 2>&1 | Select-Object -First 1" },
    @{ Name="golangci"; Cmd="golangci-lint --version 2>&1 | Select-Object -First 1" }
)

foreach ($tool in $tools) {
    try {
        $result = Invoke-Expression $tool.Cmd 2>$null
        if ($result) {
            Write-Host "✅ $($tool.Name): $result" -ForegroundColor Green
        } else {
            Write-Host "❌ $($tool.Name): Not found" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ $($tool.Name): Not found" -ForegroundColor Red
    }
}
```

---

## 3. Docker & Docker Compose

### 3.1. Docker Desktop Issues

| # | Lỗi | Nguyên nhân | Cách fix |
|---|------|-------------|----------|
| 1 | Docker Desktop không khởi động | WSL2 chưa bật hoặc Hyper-V conflict | Bật WSL2: `wsl --install`. Tắt Hyper-V nếu dùng WSL2 backend. Restart máy |
| 2 | `Cannot connect to Docker daemon` | Docker service chưa start | Mở Docker Desktop GUI. Hoặc PowerShell Admin: `Start-Service Docker` |
| 3 | `docker compose: command not found` | Docker Compose plugin chưa cài | Cập nhật Docker Desktop (Compose V2 built-in). Hoặc: `docker-compose` (V1 legacy) |
| 4 | Container restart loop (`Restarting`) | Dependency chưa ready hoặc config sai | `docker compose logs <service>` → đọc error. Kiểm tra healthcheck dependencies |
| 5 | `OCI runtime create failed` | Image corrupted hoặc thiếu | `docker compose pull` để tải lại images. Hoặc `docker system prune` |
| 6 | Máy rất chậm khi chạy Docker | Docker dùng quá nhiều RAM/CPU | Docker Desktop → Settings → Resources: giới hạn Memory ≤ 8GB, CPUs ≤ 4 |
| 7 | `no space left on device` | Docker volumes/images chiếm hết ổ cứng | `docker system prune -a --volumes` (⚠️ xóa tất cả data). Hoặc xóa có chọn lọc bên dưới |
| 8 | Build rất chậm | Không dùng cache layer | Kiểm tra `Dockerfile` có multi-stage build. Dùng `docker compose build --parallel` |

### 3.2. Docker Compose — Infrastructure

| # | Lỗi | Nguyên nhân | Cách fix |
|---|------|-------------|----------|
| 1 | `port is already allocated` | Port bị chiếm bởi process khác | Tìm process: `netstat -ano \| findstr :<PORT>` → `taskkill /PID <PID>`. Hoặc đổi port trong docker-compose |
| 2 | Kafka không start, log "Cluster ID mismatch" | Data volume cũ conflict | `docker compose down -v` rồi `docker compose up -d` (xóa volumes) |
| 3 | Container `unhealthy` | Service bên trong chưa ready | Kiểm tra logs: `docker compose logs <service>`. Tăng `start_period` trong healthcheck |
| 4 | `network maintenix-network not found` | Network chưa được tạo | `docker compose down` rồi `docker compose up -d` (tạo lại network) |
| 5 | Service A không kết nối Service B | Sai hostname hoặc khác network | Trong Docker network, dùng container name (vd: `postgres`, `redis`), KHÔNG dùng `localhost` |
| 6 | Volume mount permission denied | Quyền file trên host khác container | Linux: `chmod -R 777 <volume-dir>`. Docker Desktop: Settings → File Sharing → thêm thư mục |

### 3.3. Dọn dẹp Docker Resources

```bash
# Xem disk usage
docker system df

# Xóa containers đã dừng + images không dùng + networks không dùng
docker system prune

# Xóa tất cả (bao gồm volumes — MẤT DATA)
docker system prune -a --volumes

# Xóa có chọn lọc
docker image prune -a                     # Xóa images không dùng
docker volume prune                       # Xóa volumes orphan
docker container prune                    # Xóa containers đã dừng
docker builder prune                      # Xóa build cache

# Xóa chỉ volumes của Maintenix (reset data)
docker compose -f docker-compose.infra.yml down -v

# Restart sạch toàn bộ infrastructure
docker compose -f docker-compose.infra.yml down -v --remove-orphans
docker compose -f docker-compose.infra.yml up -d
```

---

## 4. PostgreSQL & TimescaleDB

### 4.1. Connection Issues

| # | Lỗi | Nguyên nhân | Cách fix |
|---|------|-------------|----------|
| 1 | `connection refused (port 5432)` | PostgreSQL chưa start hoặc sai port | `docker compose ps postgres` kiểm tra status. Verify: `docker exec maintenix-postgres pg_isready` |
| 2 | `password authentication failed` | Sai credentials | Kiểm tra `.env` file: `POSTGRES_USER=maintenix`, `POSTGRES_PASSWORD=secret`. Nếu đổi password, phải xóa volume và tạo lại |
| 3 | `FATAL: database "maintenix" does not exist` | DB chưa được tạo hoặc init script fail | `docker exec maintenix-postgres psql -U maintenix -c "CREATE DATABASE maintenix;"`. Hoặc kiểm tra init script |
| 4 | `too many connections` | Connection pool exhausted | Tăng `max_connections` trong PostgreSQL config. Kiểm tra connection leak trong Go code (defer `db.Close()`) |
| 5 | `could not connect to server: Connection timed out` | Network issue hoặc firewall | Kiểm tra container network: `docker network inspect maintenix-network`. Verify port mapping |
| 6 | TimescaleDB: `extension "timescaledb" is not available` | Extension chưa cài | Kiểm tra image đúng `timescale/timescaledb:latest-pg16`. Chạy: `CREATE EXTENSION IF NOT EXISTS timescaledb;` |
| 7 | Query rất chậm | Thiếu index hoặc data quá lớn | Chạy `EXPLAIN ANALYZE <query>` → thêm index phù hợp. TimescaleDB: kiểm tra hypertable chunk interval |
| 8 | `relation "xxx" does not exist` | Migration chưa chạy | `make migrate-up` hoặc `migrate -path migrations -database $DATABASE_URL up` |

### 4.2. Debug Commands — PostgreSQL

```bash
# Kết nối vào PostgreSQL
docker exec -it maintenix-postgres psql -U maintenix

# Kiểm tra databases
docker exec maintenix-postgres psql -U maintenix -c "\l"

# Kiểm tra tables
docker exec maintenix-postgres psql -U maintenix -c "\dt"

# Kiểm tra connections đang mở
docker exec maintenix-postgres psql -U maintenix -c \
  "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"

# Kill connections đang stuck
docker exec maintenix-postgres psql -U maintenix -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction' AND query_start < now() - interval '5 minutes';"

# Kiểm tra table sizes
docker exec maintenix-postgres psql -U maintenix -c \
  "SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 10;"

# Kiểm tra migration version
docker exec maintenix-postgres psql -U maintenix -c \
  "SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 5;"

# TimescaleDB: Kiểm tra hypertables
docker exec maintenix-timescaledb psql -U maintenix -d maintenix_ts -c \
  "SELECT hypertable_name, num_chunks, approximate_row_count(format('%I.%I', hypertable_schema, hypertable_name)::regclass) FROM timescaledb_information.hypertables;"

# TimescaleDB: Kiểm tra chunk sizes
docker exec maintenix-timescaledb psql -U maintenix -d maintenix_ts -c \
  "SELECT chunk_name, range_start, range_end, pg_size_pretty(total_bytes) FROM timescaledb_information.chunks ORDER BY range_end DESC LIMIT 10;"
```

---

## 5. InfluxDB

### 5.1. Issues

| # | Lỗi | Nguyên nhân | Cách fix |
|---|------|-------------|----------|
| 1 | `401 Unauthorized` | Token sai | Kiểm tra `INFLUX_TOKEN` trong `.env`. Default: `maintenix-influx-token`. Hoặc tạo token mới qua UI http://localhost:8086 |
| 2 | `bucket not found` | Bucket chưa tạo hoặc sai tên | UI: http://localhost:8086 → Buckets → tạo `sensor_realtime`. Hoặc: `influx bucket create -n sensor_realtime -o maintenix-org` |
| 3 | Write timeout | InfluxDB quá tải hoặc disk slow | Kiểm tra `docker stats maintenix-influxdb`. Tăng resource limits. Giảm write batch size |
| 4 | Query trả kết quả rỗng | Sai time range hoặc measurement name | Kiểm tra data: `from(bucket:"sensor_realtime") \|> range(start: -1h) \|> limit(n:5)`. Chú ý timezone |
| 5 | Disk usage tăng nhanh | Retention policy không đúng | Kiểm tra: `influx bucket list`. Set retention: `influx bucket update -id <ID> -r 168h` (7 ngày) |

### 5.2. Debug Commands — InfluxDB

```bash
# Query data gần nhất
docker exec maintenix-influxdb influx query \
  'from(bucket:"sensor_realtime") |> range(start: -1h) |> count()' \
  --org maintenix-org --token maintenix-influx-token

# Kiểm tra buckets
docker exec maintenix-influxdb influx bucket list \
  --org maintenix-org --token maintenix-influx-token

# Kiểm tra write throughput
docker exec maintenix-influxdb influx query \
  'from(bucket:"_monitoring") |> range(start: -5m) |> filter(fn: (r) => r._measurement == "write")' \
  --org maintenix-org --token maintenix-influx-token

# Xóa data cũ (nếu disk full)
docker exec maintenix-influxdb influx delete \
  --bucket sensor_realtime --start 2020-01-01T00:00:00Z --stop 2025-01-01T00:00:00Z \
  --org maintenix-org --token maintenix-influx-token
```

---

## 6. Redis

### 6.1. Issues

| # | Lỗi | Nguyên nhân | Cách fix |
|---|------|-------------|----------|
| 1 | `WRONGPASS` hoặc `NOAUTH` | Redis có password nhưng client không gửi | Kiểm tra Redis config có `requirepass` không. Set `REDIS_PASSWORD` trong `.env` |
| 2 | `OOM command not allowed` | Redis hết memory | Kiểm tra `maxmemory` config. Tăng limit hoặc set eviction policy: `maxmemory-policy allkeys-lru` |
| 3 | Cache miss liên tục (hit rate thấp) | TTL quá ngắn hoặc key pattern sai | Kiểm tra TTL: `redis-cli TTL <key>`. Review caching strategy — tăng TTL nếu data ít thay đổi |
| 4 | Session mất sau khi restart Redis | Redis persistence chưa bật | Bật AOF: thêm `--appendonly yes` vào Docker command. Hoặc dùng RDB snapshot |
| 5 | `Connection refused` | Redis container chưa healthy | `docker compose ps redis`. Kiểm tra logs: `docker compose logs redis` |
| 6 | Kết nối chậm / high latency | Quá nhiều keys hoặc slow commands | Kiểm tra: `redis-cli SLOWLOG GET 10`. Tránh `KEYS *` — dùng `SCAN` thay thế |

### 6.2. Debug Commands — Redis

```bash
# Kết nối Redis CLI
docker exec -it maintenix-redis redis-cli

# Kiểm tra thông tin tổng quan
docker exec maintenix-redis redis-cli INFO server
docker exec maintenix-redis redis-cli INFO memory
docker exec maintenix-redis redis-cli INFO keyspace

# Kiểm tra memory usage
docker exec maintenix-redis redis-cli INFO memory | grep used_memory_human

# Liệt kê keys theo pattern (dùng SCAN, không dùng KEYS)
docker exec maintenix-redis redis-cli --scan --pattern "sensor:latest:*" --count 100

# Kiểm tra session data
docker exec maintenix-redis redis-cli GET "session:<session-id>"

# Kiểm tra JWT blacklist
docker exec maintenix-redis redis-cli SISMEMBER "jwt:blacklist" "<token-hash>"

# Kiểm tra cache equipment
docker exec maintenix-redis redis-cli GET "equipment:cache:EQ001"

# Monitor commands real-time (debug — tắt sau khi dùng xong)
docker exec maintenix-redis redis-cli MONITOR

# Kiểm tra slow queries
docker exec maintenix-redis redis-cli SLOWLOG GET 10

# Flush tất cả cache (⚠️ DEV ONLY — users phải login lại)
docker exec maintenix-redis redis-cli FLUSHALL
```

---

## 7. Apache Kafka

### 7.1. Kafka Broker Issues

| # | Lỗi | Nguyên nhân | Cách fix |
|---|------|-------------|----------|
| 1 | Kafka không start, log "Cluster ID mismatch" | Volume data cũ không khớp config mới | `docker compose down -v` rồi `up -d` (xóa Kafka data) |
| 2 | `LEADER_NOT_AVAILABLE` | Broker chưa hoàn tất election | Đợi 30-60 giây. Nếu kéo dài: restart Kafka container |
| 3 | `Topic not found` | Topic chưa được tạo | Chạy init script: `./scripts/create-kafka-topics.sh`. Hoặc tạo thủ công — xem lệnh bên dưới |
| 4 | Consumer lag tăng liên tục | Consumer xử lý chậm hơn producer | Tăng partitions cho topic. Thêm consumer instances. Optimize consumer logic |
| 5 | `Message too large` | Message vượt `max.message.bytes` | Tăng `max.message.bytes` trong broker config. Hoặc compress messages (gzip/snappy) |
| 6 | `OFFSET_OUT_OF_RANGE` | Consumer offset đã bị xóa (retention) | Set `auto.offset.reset=earliest` hoặc `latest`. Hoặc reset offset thủ công |
| 7 | Messages vào DLQ | Consumer xử lý fail sau max retries | Kiểm tra root cause: `docker exec maintenix-kafka kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic maintenix.dlq.<topic> --from-beginning --max-messages 5` |
| 8 | Kafka UI (http://localhost:9093) không load | Kafka container chưa healthy | Đợi Kafka healthy trước. Kiểm tra: `docker compose logs kafka-ui` |

### 7.2. Kafka Consumer/Producer Issues

| # | Lỗi | Nguyên nhân | Cách fix |
|---|------|-------------|----------|
| 1 | Producer: `context deadline exceeded` | Kafka broker unreachable hoặc quá tải | Kiểm tra broker health. Tăng `produce.timeout`. Kiểm tra network |
| 2 | Consumer: không nhận messages | Sai consumer group hoặc topic | Verify group: `kafka-consumer-groups.sh --describe --group <CG>`. Kiểm tra topic name |
| 3 | Duplicate messages | Consumer crash trước khi commit offset | Implement idempotent processing (dedup key trong Redis). Kiểm tra `enable.auto.commit` |
| 4 | Messages mất thứ tự | Nhiều partitions + round-robin produce | Đảm bảo dùng partition key (vd: `equipmentId`) cho ordering per entity |
| 5 | Consumer rebalancing liên tục | `session.timeout.ms` quá nhỏ hoặc consumer quá chậm | Tăng `session.timeout.ms` (30s). Tăng `max.poll.interval.ms` (300s) |

### 7.3. Debug Commands — Kafka

```bash
# Liệt kê topics
docker exec maintenix-kafka kafka-topics.sh --list --bootstrap-server localhost:9092

# Chi tiết topic
docker exec maintenix-kafka kafka-topics.sh --describe \
  --topic maintenix.sensor.raw --bootstrap-server localhost:9092

# Xem messages mới nhất
docker exec maintenix-kafka kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic maintenix.sensor.raw \
  --from-beginning --max-messages 5

# Liệt kê consumer groups
docker exec maintenix-kafka kafka-consumer-groups.sh --list --bootstrap-server localhost:9092

# Kiểm tra consumer lag
docker exec maintenix-kafka kafka-consumer-groups.sh \
  --describe --group sensor-service-cg --bootstrap-server localhost:9092

# Reset consumer offset (⚠️ DANGEROUS — chỉ dùng khi cần reprocess)
docker exec maintenix-kafka kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group alert-sensor-processor \
  --topic maintenix.sensor.processed \
  --reset-offsets --to-earliest --execute

# Tạo topic thủ công
docker exec maintenix-kafka kafka-topics.sh --create \
  --topic maintenix.sensor.raw \
  --partitions 12 --replication-factor 1 \
  --bootstrap-server localhost:9092

# Kiểm tra DLQ messages
docker exec maintenix-kafka kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic maintenix.dlq.sensor.raw \
  --from-beginning --max-messages 10 \
  --property print.key=true \
  --property print.headers=true

# Replay DLQ messages (custom script)
# go run cmd/dlq-replay/main.go --topic maintenix.dlq.sensor.processed --limit 100
```

---

## 8. Backend — Go Services

### 8.1. Build & Compile Errors

| # | Lỗi | Nguyên nhân | Cách fix |
|---|------|-------------|----------|
| 1 | `cannot find package "maintenix/..."` | Module path sai hoặc go.mod chưa đúng | `go mod tidy`. Kiểm tra `module` name trong `go.mod` |
| 2 | `undefined: SomeFunction` | Import thiếu hoặc function chưa export (lowercase) | Kiểm tra package import. Go: functions phải viết HOA chữ cái đầu để export |
| 3 | `multiple-value X() in single-value context` | Chưa handle error return | Go functions thường trả `(value, error)`. Phải handle cả hai: `val, err := fn()` |
| 4 | `go.sum mismatch` hoặc checksum error | Module cache corrupted | `go clean -modcache && go mod download` |
| 5 | Build quá chậm | CGO enabled hoặc thiếu cache | `CGO_ENABLED=0 go build ...`. Đảm bảo Go build cache: `go env GOCACHE` |
| 6 | `air` không hot reload | File watcher không detect thay đổi | Kiểm tra `.air.toml` config. Windows: có thể cần `poll = true` do filesystem events |

### 8.2. Runtime Errors

| # | Lỗi | Nguyên nhân | Cách fix |
|---|------|-------------|----------|
| 1 | `panic: runtime error: nil pointer dereference` | Dùng pointer nil chưa check | Thêm nil check trước khi dùng pointer. Review error handling flow |
| 2 | `context deadline exceeded` | Request timeout (default 30s) | Tăng timeout trong Gin config. Kiểm tra downstream service latency |
| 3 | `connection refused` khi gọi service khác | Service chưa start hoặc sai URL | Kiểm tra service order (auth-service phải start đầu tiên). Verify URL trong config |
| 4 | `GORM: record not found` | Query trả rỗng nhưng code không handle | Dùng `errors.Is(err, gorm.ErrRecordNotFound)` → return 404 thay vì 500 |
| 5 | `concurrent map writes` / race condition | Map truy cập đồng thời không có lock | Dùng `sync.RWMutex` hoặc `sync.Map`. Chạy `go test -race` để detect |
| 6 | Memory leak — RAM tăng liên tục | Goroutine leak hoặc connection không close | Profile: `go tool pprof http://localhost:<port>/debug/pprof/heap`. Kiểm tra `defer Close()` |
| 7 | Service crash khi Kafka down | Không handle Kafka connection error | Implement retry with backoff. Dùng circuit breaker cho Kafka producer |
| 8 | `bind: address already in use` | Port đã bị chiếm | `lsof -i :<port>` hoặc `netstat -ano | findstr :<port>` → kill process. Hoặc đổi port |

### 8.3. Debug Backend Service

```bash
# Xem logs (nếu chạy bằng air)
# Logs output trực tiếp trong terminal đang chạy air

# Health check
curl -s http://localhost:8082/health | jq .

# Debug pprof endpoints (nếu đã enable)
# CPU profile (30 giây)
go tool pprof http://localhost:8082/debug/pprof/profile?seconds=30

# Heap profile
go tool pprof http://localhost:8082/debug/pprof/heap

# Goroutine dump
curl -s http://localhost:8082/debug/pprof/goroutine?debug=2

# Xem active goroutines count
curl -s http://localhost:8082/debug/pprof/goroutine?debug=0 | head -1

# Test API endpoint trực tiếp
curl -s -X POST http://localhost:8081/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123456"}' | jq .

# Lấy token rồi test endpoint khác
TOKEN=$(curl -s -X POST http://localhost:8081/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123456"}' | jq -r '.data.token')

curl -s http://localhost:8082/api/equipment \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## 9. Backend — gRPC

### 9.1. gRPC Issues

| # | Lỗi | Nguyên nhân | Cách fix |
|---|------|-------------|----------|
| 1 | `transport: Error while dialing: connection refused` | gRPC server chưa start | Kiểm tra service log. Verify gRPC port (50051, 50052, ...) đang listen |
| 2 | `rpc error: code = Unavailable` | Server unreachable hoặc circuit breaker open | Kiểm tra server health. Circuit breaker reset sau 30s (half-open mode) |
| 3 | `rpc error: code = Unauthenticated` | Token sai hoặc hết hạn | Validate token: `grpcurl -plaintext -d '{"token":"<JWT>"}' localhost:50051 auth.v1.AuthService/ValidateToken` |
| 4 | `rpc error: code = DeadlineExceeded` | gRPC call timeout (default 5s) | Tăng deadline trong client config. Kiểm tra server processing time |
| 5 | `protoc-gen-go: program not found` | gRPC Go plugins chưa cài | `go install google.golang.org/protobuf/cmd/protoc-gen-go@latest` và `go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest` |
| 6 | Proto generate ra code lỗi | Proto file syntax sai | Validate: `buf lint`. Check `option go_package` trong .proto file |
| 7 | `stream terminated by RST_STREAM` | HTTP/2 connection bị reset | Kiểm tra proxy (Nginx) có support gRPC không. Cần `grpc_pass` thay vì `proxy_pass` |

### 9.2. Debug gRPC

```bash
# Liệt kê services
grpcurl -plaintext localhost:50051 list

# Liệt kê methods
grpcurl -plaintext localhost:50051 list auth.v1.AuthService

# Describe service
grpcurl -plaintext localhost:50051 describe auth.v1.AuthService

# Gọi method
grpcurl -plaintext -d '{"token":"eyJhbGciOi..."}' \
  localhost:50051 auth.v1.AuthService/ValidateToken

# Gọi method qua equipment service
grpcurl -plaintext -d '{"equipment_id":"EQ001"}' \
  localhost:50052 equipment.v1.EquipmentService/GetHealthScore

# Stream sensor data
grpcurl -plaintext -d '{"sensor_id":"S001","interval_seconds":5}' \
  localhost:50053 sensor.v1.SensorStreamService/StreamSensorData
```

---

## 10. Backend — API Gateway

### 10.1. API Gateway Issues

| # | Lỗi | Nguyên nhân | Cách fix |
|---|------|-------------|----------|
| 1 | `502 Bad Gateway` | Downstream service down | Kiểm tra service tương ứng: `curl http://localhost:<port>/health`. Restart service nếu cần |
| 2 | `504 Gateway Timeout` | Downstream service xử lý quá chậm | Tăng timeout trong Nginx config. Kiểm tra DB query performance |
| 3 | `413 Request Entity Too Large` | Upload file quá lớn | Tăng `client_max_body_size` trong Nginx. Default: 1MB → set 50MB |
| 4 | `CORS error` (browser console) | CORS headers thiếu | Kiểm tra CORS config trong gateway. Đảm bảo `Access-Control-Allow-Origin` cho `http://localhost:4200` |
| 5 | `429 Too Many Requests` | Rate limit triggered | Giảm request frequency. Hoặc tăng rate limit config (dev mode) |
| 6 | `403 Forbidden` — mọi request | JWT middleware reject | Kiểm tra auth-service gRPC connection. Verify token format. Kiểm tra clock sync |
| 7 | Routing sai — request đến sai service | Route config sai | Kiểm tra route mapping trong gateway config. Verify: `/api/equipment` → equipment-service:8082 |

### 10.2. Debug API Gateway

```bash
# Health check gateway
curl -s http://localhost:8080/health | jq .

# Test routing
curl -v http://localhost:8080/api/equipment 2>&1 | grep "< HTTP"
# Mong đợi: < HTTP/1.1 200 OK (nếu có token) hoặc 401 (nếu không)

# Kiểm tra CORS headers
curl -v -X OPTIONS http://localhost:8080/api/equipment \
  -H "Origin: http://localhost:4200" \
  -H "Access-Control-Request-Method: GET" 2>&1 | grep -i "access-control"

# Xem Nginx logs (nếu gateway dùng Nginx)
docker exec maintenix-gateway tail -50 /var/log/nginx/access.log
docker exec maintenix-gateway tail -50 /var/log/nginx/error.log
```

---

## 11. Frontend — Angular

### 11.1. Build & Compile Errors

| # | Lỗi | Nguyên nhân | Cách fix |
|---|------|-------------|----------|
| 1 | `npm install` fail với `ERESOLVE` | Dependency version conflict | `npm install --legacy-peer-deps`. Hoặc xóa `node_modules` + `package-lock.json` rồi `npm install` |
| 2 | `Module not found: Error: Can't resolve 'ng-zorro-antd/...'` | ng-zorro chưa cài hoặc version sai | `npm install ng-zorro-antd@17.3.0`. Kiểm tra version match với Angular |
| 3 | `error TS2307: Cannot find module` | Path sai hoặc file chưa tạo | Kiểm tra `tsconfig.json` paths config. Verify import đúng relative path |
| 4 | `Expression has changed after it was checked` | Change detection race condition | Dùng `ChangeDetectorRef.detectChanges()` hoặc wrap trong `setTimeout`. Hoặc dùng `OnPush` strategy |
| 5 | `ng serve` chậm (> 30 giây) | Quá nhiều files hoặc thiếu cache | Xóa `.angular/cache/` rồi chạy lại. Kiểm tra `node_modules` corruption |
| 6 | `Allocation failed - JavaScript heap out of memory` | Build cần nhiều RAM | `node --max-old-space-size=8192 ./node_modules/.bin/ng build` |
| 7 | Hot reload không hoạt động | File watcher limit hoặc poll mode | WSL2: tăng inotify limit: `echo fs.inotify.max_user_watches=524288 \| sudo tee -a /etc/sysctl.conf`. Angular: `ng serve --poll 2000` |
| 8 | SCSS compile error | Syntax sai hoặc thiếu import | Kiểm tra `@import` paths trong `styles.scss`. ng-zorro: `@import "ng-zorro-antd/ng-zorro-antd.min.css"` |

### 11.2. Runtime Errors (Browser)

| # | Lỗi (Console) | Nguyên nhân | Cách fix |
|---|------|-------------|----------|
| 1 | `HttpErrorResponse: Http failure response for http://localhost:8080/api/...: 0 Unknown Error` | CORS block hoặc backend down | F12 Network tab → kiểm tra request. Backend: verify CORS config cho `localhost:4200` |
| 2 | `NullInjectorError: No provider for HttpClient` | `HttpClientModule` chưa import | Thêm `provideHttpClient()` trong `app.config.ts` hoặc import `HttpClientModule` |
| 3 | `Cannot read properties of undefined (reading 'xxx')` | Data chưa load xong (async) | Dùng optional chaining: `data?.property`. Hoặc `*ngIf="data"` trong template |
| 4 | `NG0100: ExpressionChangedAfterItHasBeenChecked` | Template binding thay đổi ngoài Angular zone | Wrap trong `NgZone.run()` hoặc `ChangeDetectorRef.detectChanges()` |
| 5 | `ERROR TypeError: this.xxx is not a function` | Service method undefined hoặc scope sai | Kiểm tra injection. Đảm bảo service có `@Injectable({providedIn: 'root'})` |
| 6 | Trang trắng sau login | Route guard redirect loop hoặc lazy loading fail | F12 Console → check error. Verify routes trong `app.routes.ts`. Kiểm tra AuthGuard logic |
| 7 | ECharts không render | Container div chưa có kích thước | Đảm bảo parent container có `height` (vd: `style="height: 400px"`). `echarts.resize()` khi window resize |
| 8 | ng-zorro component không hiển thị | Module chưa import hoặc thiếu CSS | Kiểm tra import module tương ứng (vd: `NzTableModule`). Verify `styles.scss` có import ng-zorro CSS |
| 9 | Routing: `Cannot match any routes` | URL sai hoặc route chưa config | Kiểm tra `app.routes.ts`. Verify lazy loading path đúng. Thêm wildcard route `**` → redirect |
| 10 | API trả 401 liên tục sau vài phút | Token hết hạn, chưa implement refresh | Implement `AuthInterceptor` với token refresh logic. Hoặc tăng token TTL (dev mode) |

### 11.3. Debug Frontend

```bash
# Chạy với verbose output
ng serve --verbose

# Build production (check for errors)
ng build --configuration production 2>&1 | head -50

# Kiểm tra bundle size
ng build --configuration production --stats-json
npx webpack-bundle-analyzer dist/maintenix-app/stats.json

# Lint kiểm tra
npx eslint src/ --ext .ts
npx prettier --check "src/**/*.{ts,html,scss}"
```

**Browser DevTools Tips:**

```
1. F12 → Console tab: Xem Angular errors, API errors
2. F12 → Network tab: Kiểm tra API calls, status codes, response body
3. F12 → Application tab: Kiểm tra localStorage (auth token)
4. F12 → Performance tab: Profile rendering performance
5. Angular DevTools extension: Component tree, change detection profiling
```

---

## 12. Authentication & Authorization (RBAC)

### 12.1. Auth Issues

| # | Lỗi | Nguyên nhân | Cách fix |
|---|------|-------------|----------|
| 1 | Login fail: `AUTH_INVALID_CREDENTIALS` | Sai username/password | Dev accounts: admin/123456, engineer/123456, viewer/123456. Check mock data |
| 2 | `AUTH_TOKEN_EXPIRED` (401) | JWT hết hạn (default 24h) | Frontend: implement token refresh. Backend: tăng token TTL cho dev |
| 3 | `AUTH_TOKEN_INVALID` (401) | JWT bị tamper hoặc sai signing key | Kiểm tra JWT secret/RSA key đồng nhất giữa auth-service và gateway |
| 4 | `AUTH_INSUFFICIENT_ROLE` (403) | User role không đủ quyền | Kiểm tra RBAC matrix. Verify user role trong JWT claims. Xem `rbac-matrix.md` |
| 5 | `AUTH_ACCOUNT_LOCKED` (403) | Login sai quá 5 lần | Reset: `UPDATE users SET failed_login_count=0, locked_until=NULL WHERE username='xxx'` |
| 6 | `AUTH_TOO_MANY_ATTEMPTS` (429) | Rate limit login endpoint | Đợi cooldown (thường 5 phút). Hoặc xóa rate limit key trong Redis |
| 7 | Token không truyền lên backend | AuthInterceptor chưa cài hoặc chưa attach header | Kiểm tra interceptor: `Authorization: Bearer <token>`. F12 Network tab verify header |
| 8 | Sau logout vẫn truy cập được | JWT chưa thêm vào blacklist | Backend: implement JWT blacklist trong Redis. Frontend: xóa token khỏi localStorage |

### 12.2. Debug Auth

```bash
# Decode JWT token (không cần secret)
echo "eyJhbGciOi..." | cut -d '.' -f 2 | base64 -d 2>/dev/null | jq .
# → Xem payload: userId, role, exp, permissions

# Kiểm tra token qua gRPC
grpcurl -plaintext -d '{"token":"eyJhbGciOi..."}' \
  localhost:50051 auth.v1.AuthService/ValidateToken

# Kiểm tra JWT blacklist trong Redis
docker exec maintenix-redis redis-cli SISMEMBER "jwt:blacklist" "<token-hash>"

# Kiểm tra user role trong DB
docker exec maintenix-postgres psql -U maintenix -c \
  "SELECT id, username, role, status, failed_login_count FROM users;"

# Kiểm tra RBAC permissions
docker exec maintenix-postgres psql -U maintenix -c \
  "SELECT role, resource, actions FROM rbac_policies ORDER BY role;"
```

### 12.3. RBAC Role Quick Reference

```
super_admin         → Full access tất cả
factory_manager     → View all + manage equipment, maintenance, reports
maintenance_manager → Manage work orders, maintenance schedules, spare parts
maintenance_engineer→ Create/edit work orders, equipment
quality_inspector   → Verify completed work orders
technician          → Update assigned work orders, view equipment
data_scientist      → Manage AI models, pipelines
viewer              → Read-only dashboard, equipment, alerts
```

---

## 13. WebSocket & Real-time Data

### 13.1. WebSocket Issues

| # | Lỗi | Nguyên nhân | Cách fix |
|---|------|-------------|----------|
| 1 | WebSocket connect fail: `ws://localhost:8080/ws` | Gateway chưa config WebSocket proxy | Nginx: thêm `proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";` |
| 2 | WebSocket ngắt kết nối liên tục | Timeout hoặc proxy disconnect | Tăng `proxy_read_timeout` (Nginx). Implement ping/pong heartbeat (mỗi 30s) |
| 3 | Không nhận được alert real-time | WebSocket subscription sai topic | Verify: subscribe `/topic/factory-alerts`. Kiểm tra alert-service Kafka consumer running |
| 4 | Alert bị duplicate trên UI | WebSocket reconnect re-subscribe | Frontend: dedup theo alert ID. Hoặc unsubscribe trước khi reconnect |
| 5 | WebSocket lag (delay > 5 giây) | Kafka consumer lag hoặc processing chậm | Kiểm tra Kafka consumer lag (section 7). Optimize alert processing pipeline |

### 13.2. Debug WebSocket

```bash
# Test WebSocket connection (cần wscat)
npm install -g wscat
wscat -c "ws://localhost:8080/ws"
# → Gửi: {"type":"subscribe","topic":"factory-alerts"}

# Kiểm tra WebSocket connections trong alert-service
curl -s http://localhost:8084/debug/websocket/connections | jq .

# Simulate alert event (trigger WebSocket broadcast)
curl -s -X POST http://localhost:8084/api/alerts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "equipmentId": "EQ001",
    "sensorId": "S001",
    "severity": "critical",
    "message": "Test alert"
  }'
```

---

## 14. Sensor Pipeline & Anomaly Detection

### 14.1. Sensor Pipeline Flow

```
PLC/SCADA → opcua-bridge → Kafka (sensor.raw) → sensor-service → Kafka (sensor.processed)
                                                       ↓
                                              InfluxDB + TimescaleDB
                                                       ↓
                                               alert-service (anomaly check)
                                                       ↓
                                              Kafka (alert.created) → WebSocket → Frontend
```

### 14.2. Pipeline Issues

| # | Lỗi | Nguyên nhân | Cách fix |
|---|------|-------------|----------|
| 1 | Sensor data không xuất hiện trên Dashboard | Pipeline bị đứt ở bước nào đó | Kiểm tra từng bước theo flow ở trên. Xem Kafka topics có message không |
| 2 | Anomaly detection không trigger alert | Threshold config sai hoặc sensor data quality=bad | Kiểm tra sensor thresholds trong DB. Verify data quality flag |
| 3 | Health Score không cập nhật | Sensor service không ghi vào equipment cache | Kiểm tra Redis: `GET equipment:health:EQ001`. Verify Kafka event `equipment.status` |
| 4 | Dữ liệu sensor bị trễ > 5 giây | Kafka consumer lag hoặc DB write slow | Kiểm tra consumer lag. Optimize batch write vào InfluxDB/TimescaleDB |
| 5 | Giá trị sensor hiển thị NaN/null | Sensor đọc fail hoặc parse error | Kiểm tra DLQ: `maintenix.dlq.sensor.raw`. Verify sensor JSON format |
| 6 | OEE tính sai trên Dashboard | Sensor data gaps hoặc formula config sai | Verify thời gian uptime/downtime. Kiểm tra OEE calculation logic |

### 14.3. Debug Sensor Pipeline

```bash
# 1. Kiểm tra Kafka topic sensor.raw có data
docker exec maintenix-kafka kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic maintenix.sensor.raw \
  --max-messages 3 --timeout-ms 5000

# 2. Kiểm tra Kafka topic sensor.processed
docker exec maintenix-kafka kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic maintenix.sensor.processed \
  --max-messages 3 --timeout-ms 5000

# 3. Kiểm tra InfluxDB có data
docker exec maintenix-influxdb influx query \
  'from(bucket:"sensor_realtime") |> range(start: -10m) |> limit(n:5)' \
  --org maintenix-org --token maintenix-influx-token

# 4. Kiểm tra Redis cache sensor latest
docker exec maintenix-redis redis-cli --scan --pattern "sensor:latest:*" --count 10

# 5. Kiểm tra alert-service nhận sensor events
docker exec maintenix-kafka kafka-consumer-groups.sh \
  --describe --group alert-sensor-processor --bootstrap-server localhost:9092

# 6. Kiểm tra sensor thresholds
docker exec maintenix-postgres psql -U maintenix -c \
  "SELECT id, equipment_id, type, warning_low, warning_high, critical_low, critical_high FROM sensors WHERE equipment_id='EQ001';"
```

---

## 15. AI/ML Service

### 15.1. ML Issues

| # | Lỗi | Nguyên nhân | Cách fix |
|---|------|-------------|----------|
| 1 | Model prediction trả error | Model chưa load hoặc input format sai | Kiểm tra model status: `GET /api/models`. Verify model file trong MinIO |
| 2 | Pipeline stuck ở `RUNNING` | Worker crash hoặc timeout | Kiểm tra logs ml-service. Stop pipeline: `POST /api/pipelines/:id/stop` |
| 3 | `MODEL_NOT_VALIDATED` khi activate | Model chưa qua validation step | Chạy validation: `POST /api/models/:id/validate`. Review validation metrics |
| 4 | Prediction accuracy giảm đột ngột | Data drift hoặc model stale | Retrain model với data mới. Monitor data drift metrics trong Grafana |
| 5 | MinIO connection error | MinIO container down hoặc credentials sai | Kiểm tra MinIO: http://localhost:9001. Verify `MINIO_ROOT_USER/PASSWORD` |

---

## 16. Monitoring & Observability

### 16.1. Observability Stack

```
                    ┌─────────────────────────────────────────────┐
                    │              Observability Stack            │
                    │                                             │
                    │  Metrics:  Prometheus (:9090) → Grafana     │
                    │  Logs:     Container stdout → docker logs   │
                    │  Traces:   Jaeger (:16686)                  │
                    │  Alerts:   Prometheus AlertManager          │
                    └─────────────────────────────────────────────┘
```

### 16.2. Issues

| # | Lỗi | Nguyên nhân | Cách fix |
|---|------|-------------|----------|
| 1 | Prometheus không scrape metrics | Target unreachable hoặc sai port | http://localhost:9090/targets → kiểm tra status. Verify `prometheus.yml` config |
| 2 | Grafana dashboard trống | Datasource chưa config hoặc query sai | Grafana → Data Sources → thêm Prometheus URL: `http://prometheus:9090` |
| 3 | Jaeger không nhận traces | Service chưa cấu hình tracing | Kiểm tra `JAEGER_AGENT_HOST` trong service config. Verify Jaeger UI: http://localhost:16686 |
| 4 | Prometheus disk full | Retention quá lớn | Set retention: `--storage.tsdb.retention.time=15d --storage.tsdb.retention.size=5GB` |
| 5 | Grafana login fail | Password đã đổi | Default: admin/admin. Reset: `docker exec maintenix-grafana grafana-cli admin reset-admin-password admin` |

### 16.3. Key Metrics cần Monitor

```bash
# Prometheus PromQL queries hữu ích:

# Request rate per service
rate(http_requests_total[5m])

# Error rate (5xx)
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# Request latency P95
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Kafka consumer lag
kafka_consumer_lag_sum

# Active database connections
pg_stat_activity_count

# Redis memory usage
redis_memory_used_bytes

# Go goroutine count (memory leak indicator)
go_goroutines

# DLQ message count
kafka_dlq_messages_total
```

---

## 17. Performance & Tối ưu

### 17.1. Vấn đề Performance

| # | Triệu chứng | Nguyên nhân có thể | Cách chẩn đoán & fix |
|---|-------------|-------------------|----------------------|
| 1 | API response > 2 giây | DB query chậm, missing index | Backend: thêm middleware log query time. DB: `EXPLAIN ANALYZE` → thêm index |
| 2 | Frontend load chậm (> 5 giây) | Bundle quá lớn, quá nhiều API calls | `ng build --stats-json` → analyze bundle. Implement lazy loading cho modules |
| 3 | RAM tăng liên tục (Go service) | Goroutine leak, connection pool leak | `go tool pprof` heap profile. Kiểm tra goroutine count trending |
| 4 | Docker container OOMKilled | Memory limit quá thấp | `docker stats` kiểm tra usage. Tăng `mem_limit` trong docker-compose |
| 5 | Kafka throughput thấp | Partition ít, batch size nhỏ | Tăng partitions. Tune `batch.size`, `linger.ms` cho producer |
| 6 | Dashboard render chậm | ECharts render quá nhiều data points | Downsample data: `GROUP BY time(5m)` thay vì raw points. Virtualize tables |
| 7 | Sensor pipeline lag > 10 giây | sensor-service xử lý chậm | Tăng consumer instances (horizontal scale). Optimize processing logic |

### 17.2. Performance Benchmarks — Mục tiêu

```
┌───────────────────────────────────┬──────────────┬───────────────┐
│ Metric                            │ Target       │ Critical      │
├───────────────────────────────────┼──────────────┼───────────────┤
│ API response time (P95)           │ < 500ms      │ > 2000ms      │
│ Sensor ingestion latency          │ < 1s         │ > 5s          │
│ Sensor → Alert pipeline           │ < 5s         │ > 30s         │
│ Frontend initial load (LCP)       │ < 3s         │ > 8s          │
│ Frontend route navigation         │ < 500ms      │ > 2000ms      │
│ WebSocket event delivery          │ < 2s         │ > 10s         │
│ Database query (simple)           │ < 50ms       │ > 500ms       │
│ Database query (complex report)   │ < 2s         │ > 10s         │
│ Kafka produce latency             │ < 100ms      │ > 1000ms      │
│ Redis cache hit                   │ < 5ms        │ > 50ms        │
└───────────────────────────────────┴──────────────┴───────────────┘
```

---

## 18. Networking & Port Conflicts

### 18.1. Port Map — Tất cả Services

```
┌───────┬──────────────────────────┬─────────────┬──────────────────────┐
│ Port  │ Service                  │ Protocol    │ Ghi chú              │
├───────┼──────────────────────────┼─────────────┼──────────────────────┤
│ 4200  │ Angular Dev Server       │ HTTP        │ Frontend             │
│ 8080  │ API Gateway              │ HTTP/WS     │ Main entry point     │
│ 8081  │ auth-service             │ HTTP+gRPC   │ gRPC: 50051          │
│ 8082  │ equipment-service        │ HTTP+gRPC   │ gRPC: 50052          │
│ 8083  │ sensor-service           │ HTTP+gRPC   │ gRPC: 50053          │
│ 8084  │ alert-service            │ HTTP+WS     │ WebSocket + gRPC     │
│ 8085  │ workorder-service        │ HTTP        │                      │
│ 8086  │ ml-service / InfluxDB    │ HTTP+gRPC   │ ⚠️ Port conflict!   │
│ 8087  │ notification-service     │ Kafka only  │ No HTTP              │
│ 4840  │ opcua-bridge             │ OPC-UA      │ PLC/SCADA            │
│ 5432  │ PostgreSQL               │ TCP         │ Master data          │
│ 5433  │ TimescaleDB              │ TCP         │ Time-series          │
│ 6379  │ Redis                    │ TCP         │ Cache + Sessions     │
│ 8200  │ Vault                    │ HTTP        │ Secrets              │
│ 9000  │ MinIO API                │ HTTP        │ S3 storage           │
│ 9001  │ MinIO Console            │ HTTP        │ Web UI               │
│ 9090  │ Prometheus               │ HTTP        │ Metrics              │
│ 9092  │ Kafka Broker             │ TCP         │ Event streaming      │
│ 9093  │ Kafka UI                 │ HTTP        │ Web UI               │
│ 3000  │ Grafana                  │ HTTP        │ Dashboards           │
│ 16686 │ Jaeger                   │ HTTP        │ Tracing UI           │
└───────┴──────────────────────────┴─────────────┴──────────────────────┘
```

### 18.2. Kiểm tra & Fix Port Conflicts

**Windows (PowerShell):**

```powershell
# Kiểm tra tất cả ports
$ports = @(4200,8080,8081,8082,8083,8084,8085,8086,8087,4840,
           5432,5433,6379,8200,9000,9001,9090,9092,9093,3000,16686)

foreach ($port in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($conn) {
        $proc = Get-Process -Id $conn[0].OwningProcess -ErrorAction SilentlyContinue
        Write-Host "⚠️  Port $port → PID $($conn[0].OwningProcess) ($($proc.ProcessName))" -ForegroundColor Yellow
    }
}

# Kill process đang chiếm port
Stop-Process -Id <PID> -Force
```

**Linux / macOS / WSL:**

```bash
# Kiểm tra port
lsof -i :8080
# hoặc
ss -tlnp | grep :8080

# Kill process
kill -9 $(lsof -t -i :8080)
```

### 18.3. Lỗi Networking thường gặp

| # | Lỗi | Nguyên nhân | Cách fix |
|---|------|-------------|----------|
| 1 | Service A (Docker) không kết nối service B (host) | Docker container dùng `localhost` → trỏ về chính container | Dùng `host.docker.internal` thay vì `localhost` (Docker Desktop) |
| 2 | Service A (host) không kết nối service B (Docker) | Port chưa expose | Kiểm tra `docker compose ps` → cột PORTS. Thêm port mapping nếu thiếu |
| 3 | Docker container không có internet | DNS resolve fail | Docker Desktop → Settings → Docker Engine → thêm `"dns": ["8.8.8.8"]` |
| 4 | `ml-service` và `InfluxDB` cùng port 8086 | Port conflict khi chạy cả 2 trên host | Đổi ml-service sang port khác (vd: 8096). Hoặc chạy ml-service trong Docker |

---

## 19. Data & Migration Issues

### 19.1. Migration Issues

| # | Lỗi | Nguyên nhân | Cách fix |
|---|------|-------------|----------|
| 1 | `dirty database version X` | Migration trước fail giữa chừng | Force version: `migrate -path migrations -database $DB_URL force <X>`. Rồi fix migration SQL và chạy lại |
| 2 | `migration file not found` | Thiếu file migration | Kiểm tra thư mục `migrations/`. Ensure cả file `.up.sql` và `.down.sql` tồn tại |
| 3 | `already exists` khi migrate up | Migration đã chạy trước đó | Skip migration đã chạy: kiểm tra `schema_migrations` table. Hoặc `migrate force <version>` |
| 4 | Seed data không load | Script lỗi hoặc table chưa tạo | Chạy `migrate up` trước → rồi mới `make seed`. Kiểm tra seed script logs |
| 5 | Foreign key constraint error khi seed | Thứ tự insert sai (parent trước child) | Kiểm tra thứ tự: users → equipment → sensors → ... Tắt FK check tạm nếu cần |

### 19.2. Data Issues

| # | Lỗi | Nguyên nhân | Cách fix |
|---|------|-------------|----------|
| 1 | Dữ liệu frontend không khớp mock-data.md | Mock data trong code outdated | Sync `src/app/core/mock/mock-data.ts` với `mock-data.md` documentation |
| 2 | Sensor time-series bị gaps | Sensor offline hoặc ingestion fail | Kiểm tra sensor status. Check DLQ cho failed messages. Review uptime logs |
| 3 | Work order count sai trên dashboard | Stale cache hoặc query filter sai | Invalidate cache: `redis-cli DEL dashboard:kpi`. Review query logic |
| 4 | Equipment health score = 0 mặc dù sensors OK | Health calculator bug hoặc missing sensor mapping | Kiểm tra sensor → equipment mapping trong DB. Verify health calculation formula |

### 19.3. Reset Data hoàn toàn

```bash
# ⚠️ CHỈ DÙNG CHO DEVELOPMENT — MẤT TOÀN BỘ DATA

# 1. Dừng tất cả services
docker compose -f docker-compose.yml down

# 2. Xóa volumes (data)
docker compose -f docker-compose.infra.yml down -v

# 3. Khởi động lại infrastructure
docker compose -f docker-compose.infra.yml up -d

# 4. Đợi healthy
sleep 30
docker compose -f docker-compose.infra.yml ps

# 5. Chạy migrations
make migrate-up

# 6. Seed demo data
make seed

# 7. Khởi động backend services
make dev-all

# 8. Verify
curl -s http://localhost:8080/health | jq .
```

---

## 20. Production Issues

### 20.1. Những gì khác biệt so với Development

```
┌─────────────────────┬─────────────────────────┬──────────────────────────┐
│ Khía cạnh           │ Development             │ Production               │
├─────────────────────┼─────────────────────────┼──────────────────────────┤
│ Database            │ Docker container        │ Managed RDS/CloudSQL     │
│ Kafka               │ Single broker           │ 3+ brokers (cluster)     │
│ Redis               │ Single instance         │ Redis Cluster/Sentinel   │
│ Secrets             │ .env file               │ Vault / K8s Secrets      │
│ SSL/TLS             │ Không                   │ Bắt buộc (cert-manager)  │
│ Scaling             │ 1 instance/service      │ HPA (auto-scale)         │
│ Logging             │ stdout                  │ ELK/Loki centralized     │
│ Monitoring          │ Local Prometheus        │ Prometheus + AlertManager │
│ JWT signing         │ HS256 (shared secret)   │ RS256 (RSA key pair)     │
│ CORS                │ localhost:4200          │ production domain only   │
│ Rate limiting       │ Cao (dev-friendly)      │ Strict per-user limits   │
└─────────────────────┴─────────────────────────┴──────────────────────────┘
```

### 20.2. Production Checklist — Trước khi Deploy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Production Deployment Checklist                      │
│                                                                         │
│  Security:                                                              │
│  □  Tất cả secrets trong Vault / K8s Secrets (không hardcode)           │
│  □  JWT signing dùng RS256 (không HS256)                                │
│  □  CORS chỉ allow production domain                                    │
│  □  Rate limiting đã enable cho tất cả endpoints                        │
│  □  HTTPS/TLS certificates valid                                        │
│  □  Database credentials rotated                                        │
│  □  Debug endpoints (pprof) disabled                                    │
│                                                                         │
│  Database:                                                              │
│  □  Migrations đã chạy trên production DB                               │
│  □  Backup strategy configured (daily)                                  │
│  □  Connection pool tuned                                               │
│  □  Indexes đã tạo cho production queries                               │
│                                                                         │
│  Infrastructure:                                                        │
│  □  Kafka replication factor ≥ 3                                        │
│  □  Redis Sentinel / Cluster enabled                                    │
│  □  Resource limits set cho tất cả containers                           │
│  □  Health checks configured                                            │
│  □  HPA (auto-scaling) configured                                       │
│                                                                         │
│  Monitoring:                                                            │
│  □  Prometheus alerting rules active                                    │
│  □  Grafana dashboards configured                                       │
│  □  DLQ monitoring enabled                                              │
│  □  Error rate alerting (Slack/PagerDuty)                               │
│  □  Log aggregation (ELK/Loki) working                                  │
│                                                                         │
│  Application:                                                           │
│  □  Environment variables set cho production                            │
│  □  Log level = warn (không debug)                                      │
│  □  Graceful shutdown implemented                                       │
│  □  Circuit breakers configured                                         │
│  □  Frontend build with --configuration production                      │
│  □  Source maps disabled (hoặc uploaded to Sentry)                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### 20.3. Incident Response Flow

```
┌─────────────┐      ┌───────────────────┐     ┌──────────────────┐
│  Alert      │────▶│  Acknowledge      │────▶│  Investigate     │
│  triggered  │      │  (within 5 min)   │     │  (check logs,    │
│  (PagerDuty/│      │                   │     │   metrics,       │
│   Slack)    │      │                   │     │   traces)        │
└─────────────┘      └───────────────────┘     └────────┬─────────┘
                                                        │
                    ┌───────────────────┐     ┌─────────▼─────────┐
                    │  Post-mortem      │◀───│  Mitigate         │
                    │  (RCA + action    │     │  (fix/rollback/   │
                    │   items)          │     │   scale)          │
                    └───────────────────┘     └───────────────────┘
```

**Khi nào rollback:**

```
Rollback ngay lập tức nếu:
  · Error rate > 5% trong 5 phút liên tục
  · P95 latency > 5x bình thường
  · Critical service (auth, alert) completely down
  · Data corruption detected

Lệnh rollback:
  kubectl rollout undo deployment/<service> -n maintenix-prod
  # Hoặc
  make k8s-rollback SVC=<service>
```

---

## 21. Quick Reference — Lệnh Chẩn đoán

### 21.1. One-liner Health Check

```bash
# Tất cả trong 1 lệnh
echo "=== Docker ===" && docker compose -f docker-compose.infra.yml ps --format "table {{.Name}}\t{{.Status}}" && \
echo "=== Backend ===" && for p in 8081 8082 8083 8084 8085 8086 8087; do echo -n ":$p → "; curl -s --max-time 2 http://localhost:$p/health | jq -r '.status' 2>/dev/null || echo "DOWN"; done && \
echo "=== Frontend ===" && curl -s --max-time 2 http://localhost:4200 > /dev/null && echo ":4200 → UP" || echo ":4200 → DOWN"
```

### 21.2. Lệnh Debug theo Thành phần

```bash
# ─── Docker ───
docker compose ps                              # Trạng thái containers
docker compose logs -f --tail=50 <service>     # Logs real-time
docker stats --no-stream                       # Resource usage
docker system df                               # Disk usage

# ─── PostgreSQL ───
docker exec maintenix-postgres psql -U maintenix -c "\dt"              # Tables
docker exec maintenix-postgres psql -U maintenix -c "SELECT version();"  # Version

# ─── Redis ───
docker exec maintenix-redis redis-cli PING                            # Health
docker exec maintenix-redis redis-cli INFO memory                     # Memory
docker exec maintenix-redis redis-cli DBSIZE                          # Key count

# ─── Kafka ───
docker exec maintenix-kafka kafka-topics.sh --list --bootstrap-server localhost:9092
docker exec maintenix-kafka kafka-consumer-groups.sh --list --bootstrap-server localhost:9092

# ─── Backend ───
curl -s http://localhost:8080/health | jq .                           # Gateway health
curl -s http://localhost:8082/api/equipment -H "Authorization: Bearer $TOKEN" | jq .

# ─── Frontend ───
ng serve --verbose 2>&1 | head -20                                     # Build output
npx eslint src/ --ext .ts 2>&1 | tail -5                              # Lint errors

# ─── gRPC ───
grpcurl -plaintext localhost:50051 list                                # Services
grpcurl -plaintext localhost:50051 describe auth.v1.AuthService        # Methods
```

### 21.3. Emergency Commands

```bash
# 🔴 Restart tất cả infrastructure
docker compose -f docker-compose.infra.yml restart

# 🔴 Restart 1 service cụ thể
docker compose restart <service-name>

# 🔴 Kill & recreate 1 container
docker compose up -d --force-recreate <service-name>

# 🔴 Reset toàn bộ (MẤT DATA)
docker compose -f docker-compose.infra.yml down -v && docker compose -f docker-compose.infra.yml up -d

# 🔴 Flush Redis cache (users phải login lại)
docker exec maintenix-redis redis-cli FLUSHALL

# 🔴 Force kill tất cả Docker containers
docker kill $(docker ps -q)

# 🔴 Production: Rollback deployment
kubectl rollout undo deployment/<service> -n maintenix-prod

# 🔴 Production: Scale to 0 (emergency stop 1 service)
kubectl scale deployment/<service> --replicas=0 -n maintenix-prod
```

### 21.4. Log Patterns — Tìm nhanh nguyên nhân

```bash
# Tìm errors trong logs
docker compose logs --tail=200 | grep -i "error\|panic\|fatal\|fail"

# Tìm slow queries
docker compose logs equipment-service --tail=500 | grep -i "slow\|duration.*[0-9]\{4,\}ms"

# Tìm connection issues
docker compose logs --tail=200 | grep -i "refused\|timeout\|unreachable\|dial"

# Tìm auth issues
docker compose logs auth-service --tail=200 | grep -i "unauthorized\|forbidden\|expired\|invalid.*token"

# Tìm Kafka issues
docker compose logs --tail=200 | grep -i "kafka\|consumer\|producer\|offset\|rebalance"

# Tìm memory issues
docker compose logs --tail=200 | grep -i "oom\|out of memory\|heap\|alloc"
```

---

