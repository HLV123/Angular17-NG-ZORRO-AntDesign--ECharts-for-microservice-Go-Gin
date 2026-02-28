# Maintenix — Docker Compose

> **Smart Predictive Maintenance Warning System**
> Toàn bộ Docker Compose configs: infrastructure, backend services, full-stack, development overrides.
> File này là tài liệu tham chiếu cho `deployments/docker/` — giải thích chi tiết từng service, config, networking, volumes.

---

## Mục lục

1. [Tổng quan File Structure](#1-tổng-quan-file-structure)
2. [docker-compose.infra.yml — Infrastructure Only](#2-docker-composeinfrayml--infrastructure-only)
3. [docker-compose.yml — Full Stack (Infra + Backend)](#3-docker-composeyml--full-stack-infra--backend)
4. [docker-compose.dev.yml — Development Overrides](#4-docker-composedevyml--development-overrides)
5. [.env.docker — Environment Variables](#5-envdocker--environment-variables)
6. [Kafka Topic Initialization](#6-kafka-topic-initialization)
7. [Prometheus Configuration](#7-prometheus-configuration)
8. [Networking & Service Discovery](#8-networking--service-discovery)
9. [Volumes & Data Persistence](#9-volumes--data-persistence)
10. [Health Checks & Dependency Order](#10-health-checks--dependency-order)
11. [Resource Limits & Performance](#11-resource-limits--performance)
12. [Hướng dẫn Sử dụng](#12-hướng-dẫn-sử-dụng)
13. [Troubleshooting](#13-troubleshooting)
14. [Port Map tổng hợp](#14-port-map-tổng-hợp)

---

## 1. Tổng quan File Structure

```
deployments/docker/
├── docker-compose.infra.yml       ← Chỉ infrastructure (DB, cache, MQ, monitoring)
├── docker-compose.yml             ← Full stack (infra + 9 backend services)
├── docker-compose.dev.yml         ← Dev overrides (hot reload, debug ports)
├── .env.docker                    ← Environment variables cho Docker Compose
├── init-scripts/
│   ├── postgres/
│   │   └── 01-create-databases.sql  ← Tạo databases khi init PostgreSQL
│   ├── timescaledb/
│   │   └── 01-init-timescale.sql    ← Bật TimescaleDB extension, tạo hypertable
│   ├── kafka/
│   │   └── create-topics.sh         ← Tạo 11 Kafka topics với partition config
│   └── minio/
│       └── create-buckets.sh        ← Tạo MinIO buckets
└── configs/
    ├── prometheus/
    │   └── prometheus.yml           ← Prometheus scrape config
    ├── grafana/
    │   └── provisioning/
    │       ├── datasources.yml
    │       └── dashboards/
    └── nginx/
        └── nginx.conf               ← Reverse proxy config (production)
```

### Cách sử dụng

| Mục đích | Lệnh |
|----------|-------|
| Dev (chỉ infra, backend chạy `air`) | `docker compose -f docker-compose.infra.yml up -d` |
| Full stack (infra + backend containers) | `docker compose up -d` |
| Full stack + dev overrides (hot reload) | `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d` |
| Tắt tất cả | `docker compose down` |
| Tắt + xóa data | `docker compose down -v` |

---

## 2. docker-compose.infra.yml — Infrastructure Only

> Dùng khi dev: chạy infrastructure qua Docker, backend services chạy trực tiếp bằng `air` (hot reload).

```yaml
# ============================================================================
# Maintenix — Infrastructure Only
# Usage: docker compose -f docker-compose.infra.yml up -d
# Resource: ~4-6 GB RAM
# ============================================================================

name: maintenix-infra

services:

  # ═══════════════════════════════════════════════════════════════════════════
  #  DATABASES
  # ═══════════════════════════════════════════════════════════════════════════

  # ──────────────── PostgreSQL 16 — Master Data ────────────────
  postgres:
    image: postgres:16-alpine
    container_name: maintenix-postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-maintenix}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-secret}
      POSTGRES_DB: ${POSTGRES_DB:-maintenix}
      POSTGRES_INITDB_ARGS: "--encoding=UTF8 --locale=en_US.UTF-8"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-scripts/postgres:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-maintenix} -d ${POSTGRES_DB:-maintenix}"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s
    restart: unless-stopped
    networks:
      - maintenix-net

  # ──────────────── TimescaleDB 2.14 — Time-Series Data ────────────────
  timescaledb:
    image: timescale/timescaledb:latest-pg16
    container_name: maintenix-timescaledb
    ports:
      - "5433:5432"
    environment:
      POSTGRES_USER: ${TIMESCALE_USER:-maintenix}
      POSTGRES_PASSWORD: ${TIMESCALE_PASSWORD:-secret}
      POSTGRES_DB: ${TIMESCALE_DB:-maintenix_ts}
    volumes:
      - timescale_data:/var/lib/postgresql/data
      - ./init-scripts/timescaledb:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${TIMESCALE_USER:-maintenix} -d ${TIMESCALE_DB:-maintenix_ts}"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s
    restart: unless-stopped
    networks:
      - maintenix-net

  # ──────────────── InfluxDB 2.7 — Real-time Hot Data ────────────────
  influxdb:
    image: influxdb:2.7-alpine
    container_name: maintenix-influxdb
    ports:
      - "8086:8086"
    environment:
      DOCKER_INFLUXDB_INIT_MODE: setup
      DOCKER_INFLUXDB_INIT_USERNAME: ${INFLUX_USER:-maintenix}
      DOCKER_INFLUXDB_INIT_PASSWORD: ${INFLUX_PASSWORD:-secret123456}
      DOCKER_INFLUXDB_INIT_ORG: ${INFLUX_ORG:-maintenix-org}
      DOCKER_INFLUXDB_INIT_BUCKET: ${INFLUX_BUCKET:-sensor_realtime}
      DOCKER_INFLUXDB_INIT_RETENTION: 168h        # 7 ngày retention
      DOCKER_INFLUXDB_INIT_ADMIN_TOKEN: ${INFLUX_TOKEN:-maintenix-influx-token-dev}
    volumes:
      - influx_data:/var/lib/influxdb2
      - influx_config:/etc/influxdb2
    healthcheck:
      test: ["CMD", "influx", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s
    restart: unless-stopped
    networks:
      - maintenix-net

  # ──────────────── Redis 7 — Cache & Sessions ────────────────
  redis:
    image: redis:7-alpine
    container_name: maintenix-redis
    ports:
      - "6379:6379"
    command: >
      redis-server
        --maxmemory 512mb
        --maxmemory-policy allkeys-lru
        --appendonly yes
        --appendfsync everysec
        --save 60 1000
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped
    networks:
      - maintenix-net

  # ═══════════════════════════════════════════════════════════════════════════
  #  MESSAGE QUEUE
  # ═══════════════════════════════════════════════════════════════════════════

  # ──────────────── Apache Kafka 3.7 (KRaft — No Zookeeper) ────────────────
  kafka:
    image: bitnami/kafka:3.7
    container_name: maintenix-kafka
    ports:
      - "9092:9092"
    environment:
      # KRaft mode (no Zookeeper)
      KAFKA_CFG_NODE_ID: 1
      KAFKA_CFG_PROCESS_ROLES: broker,controller
      KAFKA_CFG_CONTROLLER_QUORUM_VOTERS: 1@kafka:9093
      # Listeners
      KAFKA_CFG_LISTENERS: PLAINTEXT://:29092,CONTROLLER://:9093,EXTERNAL://:9092
      KAFKA_CFG_ADVERTISED_LISTENERS: PLAINTEXT://kafka:29092,EXTERNAL://localhost:9092
      KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,CONTROLLER:PLAINTEXT,EXTERNAL:PLAINTEXT
      KAFKA_CFG_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CFG_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      # Topic defaults
      KAFKA_CFG_AUTO_CREATE_TOPICS_ENABLE: "false"
      KAFKA_CFG_NUM_PARTITIONS: 6
      KAFKA_CFG_DEFAULT_REPLICATION_FACTOR: 1
      # Performance
      KAFKA_CFG_LOG_RETENTION_HOURS: 168               # 7 ngày
      KAFKA_CFG_LOG_SEGMENT_BYTES: 1073741824          # 1GB
      KAFKA_CFG_MESSAGE_MAX_BYTES: 10485760            # 10MB
      KAFKA_CFG_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_CFG_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_CFG_TRANSACTION_STATE_LOG_MIN_ISR: 1
    volumes:
      - kafka_data:/bitnami/kafka
    healthcheck:
      test: kafka-topics.sh --bootstrap-server localhost:9092 --list || exit 1
      interval: 10s
      timeout: 10s
      retries: 10
      start_period: 30s
    restart: unless-stopped
    networks:
      - maintenix-net

  # ──────────────── Kafka Topic Initialization ────────────────
  kafka-init:
    image: bitnami/kafka:3.7
    container_name: maintenix-kafka-init
    depends_on:
      kafka:
        condition: service_healthy
    entrypoint: ["/bin/bash", "-c"]
    command:
      - |
        echo "=== Creating Kafka topics ==="

        # Sensor pipeline (high throughput)
        kafka-topics.sh --create --if-not-exists --bootstrap-server kafka:29092 \
          --topic maintenix.sensor.raw --partitions 12 --replication-factor 1 \
          --config retention.ms=86400000 --config cleanup.policy=delete
        kafka-topics.sh --create --if-not-exists --bootstrap-server kafka:29092 \
          --topic maintenix.sensor.processed --partitions 12 --replication-factor 1 \
          --config retention.ms=172800000

        # Alert events
        kafka-topics.sh --create --if-not-exists --bootstrap-server kafka:29092 \
          --topic maintenix.alert.created --partitions 6 --replication-factor 1 \
          --config retention.ms=604800000
        kafka-topics.sh --create --if-not-exists --bootstrap-server kafka:29092 \
          --topic maintenix.alert.updated --partitions 6 --replication-factor 1 \
          --config retention.ms=604800000

        # Work order events
        kafka-topics.sh --create --if-not-exists --bootstrap-server kafka:29092 \
          --topic maintenix.workorder.created --partitions 3 --replication-factor 1 \
          --config retention.ms=604800000
        kafka-topics.sh --create --if-not-exists --bootstrap-server kafka:29092 \
          --topic maintenix.workorder.updated --partitions 3 --replication-factor 1 \
          --config retention.ms=604800000

        # Equipment events
        kafka-topics.sh --create --if-not-exists --bootstrap-server kafka:29092 \
          --topic maintenix.equipment.status --partitions 3 --replication-factor 1 \
          --config retention.ms=604800000

        # ML events
        kafka-topics.sh --create --if-not-exists --bootstrap-server kafka:29092 \
          --topic maintenix.ml.prediction --partitions 6 --replication-factor 1 \
          --config retention.ms=604800000
        kafka-topics.sh --create --if-not-exists --bootstrap-server kafka:29092 \
          --topic maintenix.ml.pipeline.status --partitions 1 --replication-factor 1 \
          --config retention.ms=604800000

        # Cross-cutting
        kafka-topics.sh --create --if-not-exists --bootstrap-server kafka:29092 \
          --topic maintenix.notification.send --partitions 3 --replication-factor 1 \
          --config retention.ms=86400000
        kafka-topics.sh --create --if-not-exists --bootstrap-server kafka:29092 \
          --topic maintenix.audit.log --partitions 3 --replication-factor 1 \
          --config retention.ms=2592000000

        # Dead Letter Queues
        kafka-topics.sh --create --if-not-exists --bootstrap-server kafka:29092 \
          --topic maintenix.dlq.sensor --partitions 1 --replication-factor 1 \
          --config retention.ms=2592000000
        kafka-topics.sh --create --if-not-exists --bootstrap-server kafka:29092 \
          --topic maintenix.dlq.alert --partitions 1 --replication-factor 1 \
          --config retention.ms=2592000000
        kafka-topics.sh --create --if-not-exists --bootstrap-server kafka:29092 \
          --topic maintenix.dlq.notification --partitions 1 --replication-factor 1 \
          --config retention.ms=2592000000

        echo "=== All topics created ==="
        kafka-topics.sh --list --bootstrap-server kafka:29092
    networks:
      - maintenix-net

  # ──────────────── Kafka UI ────────────────
  kafka-ui:
    image: provectuslabs/kafka-ui:latest
    container_name: maintenix-kafka-ui
    ports:
      - "9093:8080"
    environment:
      KAFKA_CLUSTERS_0_NAME: maintenix-dev
      KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kafka:29092
      DYNAMIC_CONFIG_ENABLED: "true"
    depends_on:
      kafka:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - maintenix-net

  # ═══════════════════════════════════════════════════════════════════════════
  #  OBJECT STORAGE & SECRETS
  # ═══════════════════════════════════════════════════════════════════════════

  # ──────────────── MinIO (S3-Compatible Storage) ────────────────
  minio:
    image: minio/minio:latest
    container_name: maintenix-minio
    ports:
      - "9000:9000"       # API
      - "9001:9001"       # Console UI
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin}
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    restart: unless-stopped
    networks:
      - maintenix-net

  # ──────────────── MinIO Bucket Initialization ────────────────
  minio-init:
    image: minio/mc:latest
    container_name: maintenix-minio-init
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: ["/bin/sh", "-c"]
    command:
      - |
        mc alias set maintenix http://minio:9000 ${MINIO_ROOT_USER:-minioadmin} ${MINIO_ROOT_PASSWORD:-minioadmin}
        mc mb --ignore-existing maintenix/equipment-docs
        mc mb --ignore-existing maintenix/equipment-images
        mc mb --ignore-existing maintenix/workorder-attachments
        mc mb --ignore-existing maintenix/workorder-photos
        mc mb --ignore-existing maintenix/model-artifacts
        mc mb --ignore-existing maintenix/training-data
        echo "MinIO buckets created successfully"
    networks:
      - maintenix-net

  # ──────────────── HashiCorp Vault (Dev Mode) ────────────────
  vault:
    image: hashicorp/vault:1.15
    container_name: maintenix-vault
    ports:
      - "8200:8200"
    environment:
      VAULT_DEV_ROOT_TOKEN_ID: ${VAULT_TOKEN:-root}
      VAULT_DEV_LISTEN_ADDRESS: 0.0.0.0:8200
      VAULT_LOG_LEVEL: info
    cap_add:
      - IPC_LOCK
    healthcheck:
      test: ["CMD", "vault", "status"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 5s
    restart: unless-stopped
    networks:
      - maintenix-net

  # ──────────────── Vault Initialization ────────────────
  vault-init:
    image: hashicorp/vault:1.15
    container_name: maintenix-vault-init
    depends_on:
      vault:
        condition: service_healthy
    environment:
      VAULT_ADDR: http://vault:8200
      VAULT_TOKEN: ${VAULT_TOKEN:-root}
    entrypoint: ["/bin/sh", "-c"]
    command:
      - |
        vault secrets enable -path=secret -version=2 kv 2>/dev/null || true

        vault kv put secret/maintenix/jwt-keys \
          private_key="dev-jwt-private-key-placeholder" \
          public_key="dev-jwt-public-key-placeholder" \
          algorithm="RS256"

        vault kv put secret/maintenix/db-credentials \
          postgres_url="postgres://maintenix:secret@postgres:5432/maintenix?sslmode=disable" \
          timescale_url="postgres://maintenix:secret@timescaledb:5432/maintenix_ts?sslmode=disable"

        vault kv put secret/maintenix/kafka \
          brokers="kafka:29092"

        vault kv put secret/maintenix/redis \
          addr="redis:6379" \
          password=""

        vault kv put secret/maintenix/influxdb \
          url="http://influxdb:8086" \
          token="maintenix-influx-token-dev" \
          org="maintenix-org" \
          bucket="sensor_realtime"

        vault kv put secret/maintenix/minio \
          endpoint="minio:9000" \
          access_key="minioadmin" \
          secret_key="minioadmin"

        echo "Vault secrets initialized successfully"
    networks:
      - maintenix-net

  # ═══════════════════════════════════════════════════════════════════════════
  #  OBSERVABILITY
  # ═══════════════════════════════════════════════════════════════════════════

  # ──────────────── Prometheus ────────────────
  prometheus:
    image: prom/prometheus:v2.50.0
    container_name: maintenix-prometheus
    ports:
      - "9090:9090"
    command:
      - "--config.file=/etc/prometheus/prometheus.yml"
      - "--storage.tsdb.path=/prometheus"
      - "--storage.tsdb.retention.time=15d"
      - "--web.enable-lifecycle"
    volumes:
      - ../../configs/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ../../configs/prometheus/rules:/etc/prometheus/rules:ro
      - prometheus_data:/prometheus
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:9090/-/healthy"]
      interval: 10s
      timeout: 5s
      retries: 3
    restart: unless-stopped
    networks:
      - maintenix-net

  # ──────────────── Grafana ────────────────
  grafana:
    image: grafana/grafana:10.3.0
    container_name: maintenix-grafana
    ports:
      - "3000:3000"
    environment:
      GF_SECURITY_ADMIN_USER: ${GRAFANA_USER:-admin}
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD:-admin}
      GF_USERS_ALLOW_SIGN_UP: "false"
      GF_SERVER_ROOT_URL: http://localhost:3000
      # Auto-provision datasources
      GF_INSTALL_PLUGINS: grafana-clock-panel,grafana-piechart-panel
    volumes:
      - grafana_data:/var/lib/grafana
      - ../../configs/grafana/provisioning:/etc/grafana/provisioning:ro
    depends_on:
      prometheus:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - maintenix-net

  # ──────────────── Jaeger (Distributed Tracing) ────────────────
  jaeger:
    image: jaegertracing/all-in-one:1.54
    container_name: maintenix-jaeger
    ports:
      - "16686:16686"       # UI
      - "14268:14268"       # HTTP collector
      - "14250:14250"       # gRPC collector (model.proto)
      - "6831:6831/udp"     # Agent — Thrift compact
      - "4317:4317"         # OTLP gRPC
      - "4318:4318"         # OTLP HTTP
    environment:
      COLLECTOR_OTLP_ENABLED: "true"
      SPAN_STORAGE_TYPE: badger
      BADGER_EPHEMERAL: "false"
      BADGER_DIRECTORY_VALUE: /badger/data
      BADGER_DIRECTORY_KEY: /badger/key
    volumes:
      - jaeger_data:/badger
    restart: unless-stopped
    networks:
      - maintenix-net

  # ──────────────── Loki (Log Aggregation) ────────────────
  loki:
    image: grafana/loki:2.9.4
    container_name: maintenix-loki
    ports:
      - "3100:3100"
    command: -config.file=/etc/loki/local-config.yaml
    volumes:
      - loki_data:/loki
    restart: unless-stopped
    networks:
      - maintenix-net

# ═══════════════════════════════════════════════════════════════════════════
#  NETWORKS
# ═══════════════════════════════════════════════════════════════════════════

networks:
  maintenix-net:
    name: maintenix-network
    driver: bridge

# ═══════════════════════════════════════════════════════════════════════════
#  VOLUMES
# ═══════════════════════════════════════════════════════════════════════════

volumes:
  postgres_data:
    name: maintenix-postgres-data
  timescale_data:
    name: maintenix-timescale-data
  influx_data:
    name: maintenix-influx-data
  influx_config:
    name: maintenix-influx-config
  redis_data:
    name: maintenix-redis-data
  kafka_data:
    name: maintenix-kafka-data
  minio_data:
    name: maintenix-minio-data
  prometheus_data:
    name: maintenix-prometheus-data
  grafana_data:
    name: maintenix-grafana-data
  jaeger_data:
    name: maintenix-jaeger-data
  loki_data:
    name: maintenix-loki-data
```

---

## 3. docker-compose.yml — Full Stack (Infra + Backend)

> Chạy toàn bộ: infrastructure + 9 backend services trong containers. Frontend vẫn chạy `ng serve` riêng.

```yaml
# ============================================================================
# Maintenix — Full Stack (Infrastructure + Backend Services)
# Usage: docker compose up -d --build
# Resource: ~8-12 GB RAM
# ============================================================================

name: maintenix

include:
  - docker-compose.infra.yml

services:

  # ═══════════════════════════════════════════════════════════════════════════
  #  BACKEND SERVICES
  # ═══════════════════════════════════════════════════════════════════════════

  # ──────────────── Auth Service ────────────────
  auth-service:
    build:
      context: ../../
      dockerfile: services/auth-service/Dockerfile
    container_name: maintenix-auth
    ports:
      - "8081:8081"         # HTTP REST
      - "50051:50051"       # gRPC
    environment:
      SERVICE_NAME: auth-service
      HTTP_PORT: 8081
      GRPC_PORT: 50051
      # Database
      POSTGRES_URL: postgres://${POSTGRES_USER:-maintenix}:${POSTGRES_PASSWORD:-secret}@postgres:5432/${POSTGRES_DB:-maintenix}?sslmode=disable
      # Redis
      REDIS_ADDR: redis:6379
      # Kafka
      KAFKA_BROKERS: kafka:29092
      # Vault
      VAULT_ADDR: http://vault:8200
      VAULT_TOKEN: ${VAULT_TOKEN:-root}
      # JWT
      JWT_ALGORITHM: RS256
      JWT_ACCESS_TTL: 24h
      JWT_REFRESH_TTL: 168h
      # Observability
      JAEGER_ENDPOINT: http://jaeger:14268/api/traces
      OTEL_EXPORTER_OTLP_ENDPOINT: http://jaeger:4317
      LOG_LEVEL: debug
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      kafka:
        condition: service_healthy
      vault:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8081/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s
    restart: unless-stopped
    networks:
      - maintenix-net

  # ──────────────── Equipment Service ────────────────
  equipment-service:
    build:
      context: ../../
      dockerfile: services/equipment-service/Dockerfile
    container_name: maintenix-equipment
    ports:
      - "8082:8082"
      - "50052:50052"
    environment:
      SERVICE_NAME: equipment-service
      HTTP_PORT: 8082
      GRPC_PORT: 50052
      POSTGRES_URL: postgres://${POSTGRES_USER:-maintenix}:${POSTGRES_PASSWORD:-secret}@postgres:5432/${POSTGRES_DB:-maintenix}?sslmode=disable
      REDIS_ADDR: redis:6379
      KAFKA_BROKERS: kafka:29092
      MINIO_ENDPOINT: minio:9000
      MINIO_ACCESS_KEY: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_SECRET_KEY: ${MINIO_ROOT_PASSWORD:-minioadmin}
      AUTH_GRPC_ADDR: auth-service:50051
      JAEGER_ENDPOINT: http://jaeger:14268/api/traces
      OTEL_EXPORTER_OTLP_ENDPOINT: http://jaeger:4317
      LOG_LEVEL: debug
    depends_on:
      auth-service:
        condition: service_healthy
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8082/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s
    restart: unless-stopped
    networks:
      - maintenix-net

  # ──────────────── Sensor Service ────────────────
  sensor-service:
    build:
      context: ../../
      dockerfile: services/sensor-service/Dockerfile
    container_name: maintenix-sensor
    ports:
      - "8083:8083"
      - "50053:50053"
    environment:
      SERVICE_NAME: sensor-service
      HTTP_PORT: 8083
      GRPC_PORT: 50053
      POSTGRES_URL: postgres://${POSTGRES_USER:-maintenix}:${POSTGRES_PASSWORD:-secret}@postgres:5432/${POSTGRES_DB:-maintenix}?sslmode=disable
      TIMESCALE_URL: postgres://${TIMESCALE_USER:-maintenix}:${TIMESCALE_PASSWORD:-secret}@timescaledb:5432/${TIMESCALE_DB:-maintenix_ts}?sslmode=disable
      INFLUX_URL: http://influxdb:8086
      INFLUX_TOKEN: ${INFLUX_TOKEN:-maintenix-influx-token-dev}
      INFLUX_ORG: ${INFLUX_ORG:-maintenix-org}
      INFLUX_BUCKET: ${INFLUX_BUCKET:-sensor_realtime}
      REDIS_ADDR: redis:6379
      KAFKA_BROKERS: kafka:29092
      KAFKA_CONSUMER_GROUP: sensor-service-cg
      KAFKA_TOPIC_RAW: maintenix.sensor.raw
      KAFKA_TOPIC_PROCESSED: maintenix.sensor.processed
      AUTH_GRPC_ADDR: auth-service:50051
      JAEGER_ENDPOINT: http://jaeger:14268/api/traces
      OTEL_EXPORTER_OTLP_ENDPOINT: http://jaeger:4317
      LOG_LEVEL: debug
    depends_on:
      auth-service:
        condition: service_healthy
      timescaledb:
        condition: service_healthy
      influxdb:
        condition: service_healthy
      kafka:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8083/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s
    restart: unless-stopped
    networks:
      - maintenix-net

  # ──────────────── Alert Service ────────────────
  alert-service:
    build:
      context: ../../
      dockerfile: services/alert-service/Dockerfile
    container_name: maintenix-alert
    ports:
      - "8084:8084"
      - "50054:50054"
    environment:
      SERVICE_NAME: alert-service
      HTTP_PORT: 8084
      GRPC_PORT: 50054
      POSTGRES_URL: postgres://${POSTGRES_USER:-maintenix}:${POSTGRES_PASSWORD:-secret}@postgres:5432/${POSTGRES_DB:-maintenix}?sslmode=disable
      REDIS_ADDR: redis:6379
      KAFKA_BROKERS: kafka:29092
      KAFKA_CONSUMER_GROUP: alert-service-cg
      KAFKA_TOPIC_SENSOR: maintenix.sensor.processed
      KAFKA_TOPIC_ML: maintenix.ml.prediction
      KAFKA_TOPIC_ALERT_CREATED: maintenix.alert.created
      KAFKA_TOPIC_ALERT_UPDATED: maintenix.alert.updated
      AUTH_GRPC_ADDR: auth-service:50051
      EQUIPMENT_GRPC_ADDR: equipment-service:50052
      JAEGER_ENDPOINT: http://jaeger:14268/api/traces
      OTEL_EXPORTER_OTLP_ENDPOINT: http://jaeger:4317
      LOG_LEVEL: debug
    depends_on:
      auth-service:
        condition: service_healthy
      sensor-service:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8084/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s
    restart: unless-stopped
    networks:
      - maintenix-net

  # ──────────────── WorkOrder Service ────────────────
  workorder-service:
    build:
      context: ../../
      dockerfile: services/workorder-service/Dockerfile
    container_name: maintenix-workorder
    ports:
      - "8085:8085"
    environment:
      SERVICE_NAME: workorder-service
      HTTP_PORT: 8085
      POSTGRES_URL: postgres://${POSTGRES_USER:-maintenix}:${POSTGRES_PASSWORD:-secret}@postgres:5432/${POSTGRES_DB:-maintenix}?sslmode=disable
      REDIS_ADDR: redis:6379
      KAFKA_BROKERS: kafka:29092
      KAFKA_CONSUMER_GROUP: workorder-service-cg
      MINIO_ENDPOINT: minio:9000
      MINIO_ACCESS_KEY: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_SECRET_KEY: ${MINIO_ROOT_PASSWORD:-minioadmin}
      AUTH_GRPC_ADDR: auth-service:50051
      JAEGER_ENDPOINT: http://jaeger:14268/api/traces
      OTEL_EXPORTER_OTLP_ENDPOINT: http://jaeger:4317
      LOG_LEVEL: debug
    depends_on:
      auth-service:
        condition: service_healthy
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8085/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s
    restart: unless-stopped
    networks:
      - maintenix-net

  # ──────────────── ML Service ────────────────
  ml-service:
    build:
      context: ../../
      dockerfile: services/ml-service/Dockerfile
    container_name: maintenix-ml
    ports:
      - "8088:8088"         # HTTP (tránh conflict InfluxDB 8086)
      - "50056:50056"       # gRPC
    environment:
      SERVICE_NAME: ml-service
      HTTP_PORT: 8088
      GRPC_PORT: 50056
      POSTGRES_URL: postgres://${POSTGRES_USER:-maintenix}:${POSTGRES_PASSWORD:-secret}@postgres:5432/${POSTGRES_DB:-maintenix}?sslmode=disable
      REDIS_ADDR: redis:6379
      KAFKA_BROKERS: kafka:29092
      KAFKA_CONSUMER_GROUP: ml-service-cg
      KAFKA_TOPIC_SENSOR: maintenix.sensor.processed
      KAFKA_TOPIC_PREDICTION: maintenix.ml.prediction
      MINIO_ENDPOINT: minio:9000
      MINIO_ACCESS_KEY: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_SECRET_KEY: ${MINIO_ROOT_PASSWORD:-minioadmin}
      AUTH_GRPC_ADDR: auth-service:50051
      JAEGER_ENDPOINT: http://jaeger:14268/api/traces
      OTEL_EXPORTER_OTLP_ENDPOINT: http://jaeger:4317
      LOG_LEVEL: debug
    depends_on:
      auth-service:
        condition: service_healthy
      kafka:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8088/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s
    restart: unless-stopped
    networks:
      - maintenix-net

  # ──────────────── Notification Service ────────────────
  notification-service:
    build:
      context: ../../
      dockerfile: services/notification-service/Dockerfile
    container_name: maintenix-notification
    ports:
      - "8087:8087"
    environment:
      SERVICE_NAME: notification-service
      HTTP_PORT: 8087
      POSTGRES_URL: postgres://${POSTGRES_USER:-maintenix}:${POSTGRES_PASSWORD:-secret}@postgres:5432/${POSTGRES_DB:-maintenix}?sslmode=disable
      KAFKA_BROKERS: kafka:29092
      KAFKA_CONSUMER_GROUP: notification-service-cg
      # SMTP
      SMTP_HOST: ${SMTP_HOST:-mailhog}
      SMTP_PORT: ${SMTP_PORT:-1025}
      SMTP_FROM: ${SMTP_FROM:-noreply@maintenix.vn}
      # Slack (optional)
      SLACK_WEBHOOK_URL: ${SLACK_WEBHOOK_URL:-}
      JAEGER_ENDPOINT: http://jaeger:14268/api/traces
      OTEL_EXPORTER_OTLP_ENDPOINT: http://jaeger:4317
      LOG_LEVEL: debug
    depends_on:
      kafka:
        condition: service_healthy
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8087/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s
    restart: unless-stopped
    networks:
      - maintenix-net

  # ──────────────── OPC-UA Bridge (Optional) ────────────────
  opcua-bridge:
    build:
      context: ../../
      dockerfile: services/opcua-bridge/Dockerfile
    container_name: maintenix-opcua
    ports:
      - "4840:4840"
    environment:
      SERVICE_NAME: opcua-bridge
      OPCUA_PORT: 4840
      KAFKA_BROKERS: kafka:29092
      KAFKA_TOPIC_RAW: maintenix.sensor.raw
      # OPC-UA Server (PLC)
      OPCUA_SERVER_URL: ${OPCUA_SERVER_URL:-opc.tcp://plc-simulator:4840}
      OPCUA_SUBSCRIPTION_INTERVAL: 100ms
      LOG_LEVEL: debug
    depends_on:
      kafka:
        condition: service_healthy
    profiles:
      - with-opcua                   # Chỉ chạy khi: --profile with-opcua
    restart: unless-stopped
    networks:
      - maintenix-net

  # ──────────────── API Gateway ────────────────
  api-gateway:
    build:
      context: ../../
      dockerfile: services/api-gateway/Dockerfile
    container_name: maintenix-gateway
    ports:
      - "8080:8080"
    environment:
      SERVICE_NAME: api-gateway
      HTTP_PORT: 8080
      # Upstream service addresses
      AUTH_SERVICE_URL: http://auth-service:8081
      AUTH_GRPC_ADDR: auth-service:50051
      EQUIPMENT_SERVICE_URL: http://equipment-service:8082
      SENSOR_SERVICE_URL: http://sensor-service:8083
      ALERT_SERVICE_URL: http://alert-service:8084
      WORKORDER_SERVICE_URL: http://workorder-service:8085
      ML_SERVICE_URL: http://ml-service:8088
      NOTIFICATION_SERVICE_URL: http://notification-service:8087
      # Redis (rate limiting, KPI cache)
      REDIS_ADDR: redis:6379
      # Kafka (WebSocket event bridge)
      KAFKA_BROKERS: kafka:29092
      # CORS
      CORS_ORIGINS: http://localhost:4200,http://localhost:3000
      # Rate limiting
      RATE_LIMIT_RPS: 100
      RATE_LIMIT_BURST: 200
      # Observability
      JAEGER_ENDPOINT: http://jaeger:14268/api/traces
      OTEL_EXPORTER_OTLP_ENDPOINT: http://jaeger:4317
      LOG_LEVEL: debug
    depends_on:
      auth-service:
        condition: service_healthy
      equipment-service:
        condition: service_healthy
      sensor-service:
        condition: service_healthy
      alert-service:
        condition: service_healthy
      workorder-service:
        condition: service_healthy
      ml-service:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8080/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 20s
    restart: unless-stopped
    networks:
      - maintenix-net
```

---

## 4. docker-compose.dev.yml — Development Overrides

> Override cho dev: mount source code, hot reload, debug ports, email catcher.

```yaml
# ============================================================================
# Maintenix — Development Overrides
# Usage: docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
# ============================================================================

name: maintenix

services:

  # ──────────────── MailHog (Email Catcher for Dev) ────────────────
  mailhog:
    image: mailhog/mailhog:latest
    container_name: maintenix-mailhog
    ports:
      - "1025:1025"       # SMTP
      - "8025:8025"       # Web UI
    networks:
      - maintenix-net

  # ──────────────── PLC Simulator (OPC-UA for Dev) ────────────────
  plc-simulator:
    image: open62541/open62541:latest
    container_name: maintenix-plc-sim
    ports:
      - "4841:4840"
    networks:
      - maintenix-net
    profiles:
      - with-opcua

  # ──────────────── Envoy Proxy (gRPC-Web for Frontend) ────────────────
  envoy:
    image: envoyproxy/envoy:v1.29-latest
    container_name: maintenix-envoy
    ports:
      - "8090:8090"       # gRPC-Web → gRPC native
    volumes:
      - ../../configs/envoy/envoy.yaml:/etc/envoy/envoy.yaml:ro
    depends_on:
      - sensor-service
      - ml-service
    networks:
      - maintenix-net

  # ──────────── Override notification service to use MailHog ──────────
  notification-service:
    environment:
      SMTP_HOST: mailhog
      SMTP_PORT: 1025
      SMTP_AUTH: "false"
      SMTP_TLS: "false"
```

---

## 5. .env.docker — Environment Variables

```bash
# ============================================================================
# Maintenix — Docker Environment Variables
# Copy to .env (không commit .env vào git, chỉ commit .env.docker)
# ============================================================================

# ──── PostgreSQL ────
POSTGRES_USER=maintenix
POSTGRES_PASSWORD=secret
POSTGRES_DB=maintenix

# ──── TimescaleDB ────
TIMESCALE_USER=maintenix
TIMESCALE_PASSWORD=secret
TIMESCALE_DB=maintenix_ts

# ──── InfluxDB ────
INFLUX_USER=maintenix
INFLUX_PASSWORD=secret123456
INFLUX_ORG=maintenix-org
INFLUX_BUCKET=sensor_realtime
INFLUX_TOKEN=maintenix-influx-token-dev

# ──── Redis ────
REDIS_PASSWORD=

# ──── MinIO ────
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin

# ──── Vault ────
VAULT_TOKEN=root

# ──── Grafana ────
GRAFANA_USER=admin
GRAFANA_PASSWORD=admin

# ──── SMTP (dev: MailHog) ────
SMTP_HOST=mailhog
SMTP_PORT=1025
SMTP_FROM=noreply@maintenix.vn

# ──── Slack (optional) ────
SLACK_WEBHOOK_URL=

# ──── OPC-UA (optional) ────
OPCUA_SERVER_URL=opc.tcp://plc-simulator:4840
```

---

## 6. Kafka Topic Initialization

### 6.1. Topic Partition Strategy

| Topic | Partitions | Partition Key | Lý do |
|-------|-----------|---------------|-------|
| `maintenix.sensor.raw` | **12** | `sensorId` | High throughput (10K+ msg/s), partition theo sensor để đảm bảo ordering per sensor |
| `maintenix.sensor.processed` | **12** | `sensorId` | Match raw topic, fan-out tới alert + ML consumers |
| `maintenix.alert.created` | 6 | `equipmentId` | Alerts cùng equipment đi cùng partition → ordering |
| `maintenix.alert.updated` | 6 | `alertId` | Updates cho cùng alert đi cùng partition |
| `maintenix.workorder.created` | 3 | `equipmentId` | Low throughput, group theo equipment |
| `maintenix.workorder.updated` | 3 | `workOrderId` | Updates cho cùng WO đi cùng partition |
| `maintenix.equipment.status` | 3 | `equipmentId` | Status changes per equipment |
| `maintenix.ml.prediction` | 6 | `equipmentId` | Predictions per equipment |
| `maintenix.ml.pipeline.status` | 1 | — | Very low throughput, ordering global |
| `maintenix.notification.send` | 3 | `channelType` | Group theo channel (email/sms/slack) |
| `maintenix.audit.log` | 3 | `serviceId` | Group theo service source |

### 6.2. Retention Config

| Topic Group | Retention | Lý do |
|-------------|-----------|-------|
| Sensor topics | 24h / 48h | High volume, data đã persist vào InfluxDB/TimescaleDB |
| Alert / WO / Equipment | 7 ngày | Business events, cần replay khả năng |
| Notification | 24h | Fire-and-forget, log lưu trong PostgreSQL |
| Audit | 30 ngày | Compliance, cần giữ lâu hơn |
| DLQ topics | 30 ngày | Cần investigate failed messages |

---

## 7. Prometheus Configuration

### 7.1. prometheus.yml

```yaml
# configs/prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - /etc/prometheus/rules/*.yml

scrape_configs:
  # ──── Backend Services ────
  - job_name: "api-gateway"
    static_configs:
      - targets: ["api-gateway:8080"]
    metrics_path: /metrics

  - job_name: "auth-service"
    static_configs:
      - targets: ["auth-service:8081"]
    metrics_path: /metrics

  - job_name: "equipment-service"
    static_configs:
      - targets: ["equipment-service:8082"]
    metrics_path: /metrics

  - job_name: "sensor-service"
    static_configs:
      - targets: ["sensor-service:8083"]
    metrics_path: /metrics

  - job_name: "alert-service"
    static_configs:
      - targets: ["alert-service:8084"]
    metrics_path: /metrics

  - job_name: "workorder-service"
    static_configs:
      - targets: ["workorder-service:8085"]
    metrics_path: /metrics

  - job_name: "ml-service"
    static_configs:
      - targets: ["ml-service:8088"]
    metrics_path: /metrics

  - job_name: "notification-service"
    static_configs:
      - targets: ["notification-service:8087"]
    metrics_path: /metrics

  # ──── Infrastructure ────
  - job_name: "redis"
    static_configs:
      - targets: ["redis:6379"]

  - job_name: "kafka"
    static_configs:
      - targets: ["kafka:9092"]
```

---

## 8. Networking & Service Discovery

### 8.1. Docker Network

Tất cả services nằm chung network `maintenix-network` (bridge mode). Services giao tiếp qua container name.

```
┌─── maintenix-network (bridge) ───────────────────────────────────────────────┐
│                                                                              │
│  ┌─── Host Ports (exposed) ──────────────────────────────────────────────┐   │
│  │ 4200  Angular (host)        8080 gateway     9090 prometheus          │   │
│  │ 8081  auth                  8082 equipment   9092 kafka (external)    │   │
│  │ 8083  sensor                8084 alert       9093 kafka-ui            │   │
│  │ 8085  workorder             8088 ml          3000 grafana             │   │
│  │ 8087  notification          5432 postgres    16686 jaeger             │   │
│  │ 5433  timescaledb           8086 influxdb    8200 vault               │   │
│  │ 6379  redis                 9000 minio       3100 loki                │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─── Internal Only (container:port) ────────────────────────────────────┐   │
│  │ kafka:29092 (inter-broker)     auth-service:50051 (gRPC)              │   │
│  │ equipment-service:50052 (gRPC) sensor-service:50053 (gRPC)            │   │
│  │ alert-service:50054 (gRPC)     ml-service:50056 (gRPC)                │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 8.2. Service Discovery trong Containers

Backend services tìm nhau qua container name (DNS tự động):

```go
// Equipment service gọi Auth service qua gRPC
conn, err := grpc.Dial("auth-service:50051", grpc.WithInsecure())

// API Gateway proxy tới Equipment service qua HTTP
httputil.NewSingleHostReverseProxy("http://equipment-service:8082")

// Sensor service ghi InfluxDB
influxClient := influxdb2.NewClient("http://influxdb:8086", token)

// Alert service kết nối Redis
rdb := redis.NewClient(&redis.Options{Addr: "redis:6379"})

// Any service produce Kafka
producer := sarama.NewAsyncProducer([]string{"kafka:29092"}, config)
```

### 8.3. Frontend → Backend

Angular dev server (`ng serve :4200`) chạy trên host, kết nối API Gateway qua `localhost:8080`.

```typescript
// src/environments/environment.ts
export const environment = {
  apiBaseUrl: 'http://localhost:8080/api',
  wsUrl: 'ws://localhost:8080/ws',
  grpcUrl: 'http://localhost:8090',     // Envoy gRPC-Web proxy
};
```

---

## 9. Volumes & Data Persistence

### 9.1. Named Volumes

| Volume | Service | Mount Point | Dữ liệu | Backup? |
|--------|---------|-------------|----------|---------|
| `maintenix-postgres-data` | postgres | `/var/lib/postgresql/data` | Users, Equipment, Alerts, WO, Models | ✅ Critical |
| `maintenix-timescale-data` | timescaledb | `/var/lib/postgresql/data` | Sensor readings (365 ngày) | ✅ Important |
| `maintenix-influx-data` | influxdb | `/var/lib/influxdb2` | Sensor realtime (7 ngày) | ⚠️ Recreatable |
| `maintenix-redis-data` | redis | `/data` | Cache, sessions | ❌ Ephemeral |
| `maintenix-kafka-data` | kafka | `/bitnami/kafka` | Event messages (7 ngày) | ⚠️ Important |
| `maintenix-minio-data` | minio | `/data` | Model artifacts, photos, docs | ✅ Critical |
| `maintenix-prometheus-data` | prometheus | `/prometheus` | Metrics (15 ngày) | ❌ Recreatable |
| `maintenix-grafana-data` | grafana | `/var/lib/grafana` | Dashboards, configs | ⚠️ Nice to have |
| `maintenix-jaeger-data` | jaeger | `/badger` | Traces | ❌ Recreatable |
| `maintenix-loki-data` | loki | `/loki` | Logs | ❌ Recreatable |

### 9.2. Lệnh quản lý volumes

```bash
# Xem tất cả volumes
docker volume ls | grep maintenix

# Xóa toàn bộ data (reset clean)
docker compose down -v

# Chỉ xóa 1 volume (ví dụ: reset Redis cache)
docker volume rm maintenix-redis-data

# Backup PostgreSQL
docker exec maintenix-postgres pg_dump -U maintenix maintenix > backup.sql

# Restore PostgreSQL
docker exec -i maintenix-postgres psql -U maintenix maintenix < backup.sql
```

---

## 10. Health Checks & Dependency Order

### 10.1. Startup Sequence

```
Phase 1 — Infrastructure (parallel):
  ├── postgres          ← healthcheck: pg_isready
  ├── timescaledb       ← healthcheck: pg_isready
  ├── influxdb          ← healthcheck: influx ping
  ├── redis             ← healthcheck: redis-cli ping
  ├── kafka             ← healthcheck: kafka-topics --list
  ├── minio             ← healthcheck: mc ready
  └── vault             ← healthcheck: vault status
      │
Phase 2 — Init Jobs (after infra healthy):
  ├── kafka-init        ← Tạo 11 topics + 3 DLQ topics
  ├── minio-init        ← Tạo 6 buckets
  └── vault-init        ← Seed secrets
      │
Phase 3 — Auth Service (first backend):
  └── auth-service      ← healthcheck: /health
      │
Phase 4 — Domain Services (parallel, after auth):
  ├── equipment-service ← depends: auth, postgres
  ├── sensor-service    ← depends: auth, timescaledb, influxdb, kafka
  ├── alert-service     ← depends: auth, sensor
  ├── workorder-service ← depends: auth, postgres
  ├── ml-service        ← depends: auth, kafka
  └── notification-svc  ← depends: kafka, postgres
      │
Phase 5 — API Gateway (last, after all services):
  └── api-gateway       ← depends: auth, equipment, sensor, alert, workorder, ml
```

### 10.2. Health Check Endpoints

Mỗi backend service expose `GET /health`:

```json
{
  "status": "healthy",
  "service": "equipment-service",
  "version": "1.0.0",
  "uptime": "2h15m30s",
  "checks": {
    "postgres": "ok",
    "redis": "ok",
    "kafka": "ok"
  }
}
```

---

## 11. Resource Limits & Performance

### 11.1. Recommended Resource Allocation (Development)

| Service | CPU | Memory | Notes |
|---------|-----|--------|-------|
| postgres | 1.0 | 512 MB | Shared by all services |
| timescaledb | 1.0 | 1 GB | Heavy aggregation queries |
| influxdb | 0.5 | 512 MB | Write-heavy, 7d retention |
| redis | 0.25 | 512 MB | maxmemory 512mb configured |
| kafka | 1.0 | 1 GB | Single broker dev mode |
| minio | 0.25 | 256 MB | Object storage |
| vault | 0.25 | 128 MB | Dev mode (in-memory) |
| prometheus | 0.5 | 512 MB | 15 ngày metrics |
| grafana | 0.25 | 256 MB | Dashboard rendering |
| jaeger | 0.25 | 256 MB | Trace storage |
| loki | 0.25 | 256 MB | Log aggregation |
| **Infra total** | **~5.5** | **~5.5 GB** | |
| auth-service | 0.25 | 128 MB | Lightweight |
| equipment-service | 0.25 | 128 MB | CRUD |
| sensor-service | 0.5 | 256 MB | High throughput |
| alert-service | 0.5 | 256 MB | WebSocket + SLA timer |
| workorder-service | 0.25 | 128 MB | CRUD + FSM |
| ml-service | 0.5 | 512 MB | Model inference |
| notification-service | 0.25 | 128 MB | Fire-and-forget |
| api-gateway | 0.5 | 256 MB | Proxy + rate limit |
| **Services total** | **~3.0** | **~1.8 GB** | |
| **GRAND TOTAL** | **~8.5** | **~7.3 GB** | Minimum 8 GB RAM recommended |

### 11.2. Docker Desktop Settings

| Setting | Minimum | Recommended |
|---------|---------|-------------|
| CPUs | 4 | 8+ |
| Memory | 8 GB | 12 GB |
| Disk | 30 GB | 50 GB |
| WSL 2 backend | ✅ Required | ✅ Required |

---

## 12. Hướng dẫn Sử dụng

### 12.1. Lần đầu setup

```bash
# 1. Clone repo
git clone <repo-url> maintenix-backend
cd maintenix-backend

# 2. Copy env file
cp deployments/docker/.env.docker deployments/docker/.env

# 3. Khởi động infrastructure
cd deployments/docker
docker compose -f docker-compose.infra.yml up -d

# 4. Đợi tất cả healthy (~30-60 giây)
docker compose -f docker-compose.infra.yml ps
# Tất cả phải hiển thị (healthy)

# 5. Chạy migrations + seed
cd ../..
./scripts/migrate.sh up
./scripts/seed.sh

# 6. Chạy backend services (hot reload)
# Mỗi service 1 terminal tab:
cd services/auth-service && air           # Terminal 1
cd services/equipment-service && air      # Terminal 2
cd services/sensor-service && air         # Terminal 3
cd services/alert-service && air          # Terminal 4
cd services/workorder-service && air      # Terminal 5
cd services/ml-service && air             # Terminal 6
cd services/notification-service && air   # Terminal 7
cd services/api-gateway && air            # Terminal 8 (cuối cùng)

# 7. Chạy frontend
cd maintenix-app
npm install
ng serve   # http://localhost:4200
```

### 12.2. Full Docker (không cần Go trên host)

```bash
cd deployments/docker

# Build + start everything
docker compose up -d --build

# Xem logs
docker compose logs -f api-gateway
docker compose logs -f sensor-service

# Frontend vẫn chạy riêng
cd maintenix-app && ng serve
```

### 12.3. Verify full stack

```bash
# Health check
curl http://localhost:8080/health

# Login
curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123456"}'

# Kafka UI → check topics
open http://localhost:9093

# Grafana → check dashboards
open http://localhost:3000

# Jaeger → check traces
open http://localhost:16686
```

### 12.4. Reset data

```bash
# Xóa tất cả containers + volumes (clean slate)
docker compose down -v

# Chỉ restart services (giữ data)
docker compose restart

# Restart 1 service
docker compose restart sensor-service
```

### 12.5. Scale service (test load)

```bash
# Scale sensor-service lên 3 instances
docker compose up -d --scale sensor-service=3

# Xem instances
docker compose ps sensor-service
```

---

## 13. Troubleshooting

### 13.1. Các lỗi thường gặp

| Vấn đề | Nguyên nhân | Giải pháp |
|--------|-------------|-----------|
| `port is already allocated` | Port conflict trên host | `lsof -i :PORT` hoặc `netstat -ano \| findstr :PORT` → kill process hoặc đổi port |
| Kafka không start | Kafka data corrupted | `docker compose down -v` rồi `up` lại |
| PostgreSQL connection refused | Container chưa healthy | Đợi healthcheck pass: `docker compose ps` |
| Service liên tục restart | Dependency chưa ready | Check logs: `docker compose logs <service>` |
| Out of memory | Docker Desktop memory thấp | Settings → Resources → tăng Memory lên 8 GB+ |
| Disk full | Volumes quá lớn | `docker system prune -a --volumes` (cẩn thận xóa data) |
| TimescaleDB extension not found | Init script chưa chạy | Check `init-scripts/timescaledb/01-init-timescale.sql` |
| InfluxDB 401 Unauthorized | Token sai | Kiểm tra `INFLUX_TOKEN` trong `.env` |

### 13.2. Debug Commands

```bash
# Xem logs real-time
docker compose logs -f --tail=50 <service-name>

# Shell vào container
docker exec -it maintenix-postgres bash
docker exec -it maintenix-redis redis-cli
docker exec -it maintenix-kafka bash

# Kiểm tra network connectivity
docker exec maintenix-gateway ping redis
docker exec maintenix-gateway wget -qO- http://auth-service:8081/health

# Kiểm tra Kafka topics
docker exec maintenix-kafka kafka-topics.sh --list --bootstrap-server localhost:9092

# Kiểm tra Kafka consumer groups
docker exec maintenix-kafka kafka-consumer-groups.sh --list --bootstrap-server localhost:9092

# Kiểm tra consumer lag
docker exec maintenix-kafka kafka-consumer-groups.sh \
  --describe --group sensor-service-cg --bootstrap-server localhost:9092

# PostgreSQL query
docker exec maintenix-postgres psql -U maintenix -c "SELECT count(*) FROM users;"

# Redis check
docker exec maintenix-redis redis-cli INFO keyspace

# InfluxDB query
docker exec maintenix-influxdb influx query \
  'from(bucket:"sensor_realtime") |> range(start: -1h) |> count()' \
  --org maintenix-org --token maintenix-influx-token-dev

# Resource usage
docker stats --no-stream
```

---

## 14. Port Map tổng hợp

### 14.1. Infrastructure Ports

| Port | Service | Protocol | URL / Credentials |
|------|---------|----------|-------------------|
| 5432 | PostgreSQL | PostgreSQL | `maintenix` / `secret` — DB: `maintenix` |
| 5433 | TimescaleDB | PostgreSQL | `maintenix` / `secret` — DB: `maintenix_ts` |
| 8086 | InfluxDB | HTTP | http://localhost:8086 — `maintenix` / `secret123456` |
| 6379 | Redis | Redis | `redis-cli -h localhost` (no password) |
| 9092 | Kafka | Kafka | External listener (for host apps) |
| 9093 | Kafka UI | HTTP | http://localhost:9093 |
| 9000 | MinIO API | HTTP | S3-compatible endpoint |
| 9001 | MinIO Console | HTTP | http://localhost:9001 — `minioadmin` / `minioadmin` |
| 8200 | Vault | HTTP | http://localhost:8200 — Token: `root` |

### 14.2. Backend Service Ports

| Port | Service | Protocol | Health Check |
|------|---------|----------|-------------|
| 8080 | API Gateway | HTTP + WS | `GET /health` |
| 8081 | Auth Service | HTTP | `GET /health` |
| 8082 | Equipment Service | HTTP | `GET /health` |
| 8083 | Sensor Service | HTTP | `GET /health` |
| 8084 | Alert Service | HTTP + WS | `GET /health` |
| 8085 | WorkOrder Service | HTTP | `GET /health` |
| 8087 | Notification Service | HTTP | `GET /health` |
| 8088 | ML Service | HTTP | `GET /health` |
| 4840 | OPC-UA Bridge | OPC-UA | — |

### 14.3. gRPC Ports (Internal)

| Port | Service | Proto file |
|------|---------|-----------|
| 50051 | Auth Service | `api/proto/auth/v1/auth.proto` |
| 50052 | Equipment Service | `api/proto/equipment/v1/equipment.proto` |
| 50053 | Sensor Service | `api/proto/sensor/v1/sensor.proto` |
| 50054 | Alert Service | `api/proto/alert/v1/alert.proto` |
| 50056 | ML Service | `api/proto/ml/v1/ml.proto` |

### 14.4. Observability Ports

| Port | Service | URL |
|------|---------|-----|
| 9090 | Prometheus | http://localhost:9090 |
| 3000 | Grafana | http://localhost:3000 — `admin` / `admin` |
| 16686 | Jaeger UI | http://localhost:16686 |
| 3100 | Loki | http://localhost:3100 |
| 4317 | Jaeger OTLP gRPC | (internal — services push traces) |

### 14.5. Development-only Ports

| Port | Service | URL |
|------|---------|-----|
| 4200 | Angular Dev Server | http://localhost:4200 |
| 8025 | MailHog UI | http://localhost:8025 |
| 1025 | MailHog SMTP | (notification-service sends here) |
| 8090 | Envoy gRPC-Web | (frontend gRPC proxy) |
