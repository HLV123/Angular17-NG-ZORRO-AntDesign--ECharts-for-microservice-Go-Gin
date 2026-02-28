# Maintenix — Kafka Events

> **Smart Predictive Maintenance Warning System**
> 11 Kafka topics: JSON schema, partition strategy, consumer groups, retry/DLQ, ordering guarantees.
> Dùng để: implement producer/consumer, debug event flow, setup monitoring.

---

## Mục lục

1. [Kafka Cluster Configuration](#1-kafka-cluster-configuration)
2. [Topic Overview](#2-topic-overview)
3. [Event Envelope (Common Header)](#3-event-envelope-common-header)
4. [Topic Details — Sensor Pipeline](#4-topic-details--sensor-pipeline)
5. [Topic Details — Alert Events](#5-topic-details--alert-events)
6. [Topic Details — Work Order Events](#6-topic-details--work-order-events)
7. [Topic Details — Equipment Events](#7-topic-details--equipment-events)
8. [Topic Details — ML Events](#8-topic-details--ml-events)
9. [Topic Details — Cross-cutting](#9-topic-details--cross-cutting)
10. [Consumer Groups](#10-consumer-groups)
11. [Dead Letter Queue (DLQ)](#11-dead-letter-queue-dlq)
12. [Idempotency & Deduplication](#12-idempotency--deduplication)
13. [Monitoring & Alerting](#13-monitoring--alerting)
14. [Development & Testing](#14-development--testing)

---

## 1. Kafka Cluster Configuration

### 1.1. Infrastructure

| Environment | Brokers | Ports | Storage |
|-------------|---------|-------|---------|
| Development | 1 (Docker) | 9092 (plaintext) | tmpfs |
| Staging | 3 | 9092 (internal), 9093 (SASL_SSL) | EBS gp3 |
| Production | 3 (StatefulSet, PVC per broker) | 9092 (internal), 9093 (SASL_SSL) | PVC 100Gi |

### 1.2. Broker settings

```properties
# server.properties (production)
num.partitions=12                          # default cho new topics
default.replication.factor=3               # 3 brokers → 3 replicas
min.insync.replicas=2                      # acks=all cần ≥2 ISR
log.retention.hours=168                    # 7 ngày retention
log.retention.bytes=107374182400           # 100GB per partition
log.segment.bytes=1073741824              # 1GB per segment
message.max.bytes=10485760                # 10MB max message
auto.create.topics.enable=false           # DISABLE — chỉ tạo qua migration
```

### 1.3. Development docker-compose

```yaml
# docker-compose.infra.yml
kafka:
  image: confluentinc/cp-kafka:7.6
  ports:
    - "9092:9092"
  environment:
    KAFKA_BROKER_ID: 1
    KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
    KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:29092,HOST://localhost:9092
    KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,HOST:PLAINTEXT
    KAFKA_AUTO_CREATE_TOPICS_ENABLE: "false"
    KAFKA_NUM_PARTITIONS: 6
    KAFKA_DEFAULT_REPLICATION_FACTOR: 1

kafka-ui:
  image: provectuslabs/kafka-ui:latest
  ports:
    - "9093:8080"
  environment:
    KAFKA_CLUSTERS_0_NAME: maintenix-dev
    KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kafka:29092
```

Kafka UI: `http://localhost:9093` — browse topics, messages, consumer groups.

---

## 2. Topic Overview

### 2.1. All Topics

| # | Topic | Partitions | Producer | Consumer(s) | Throughput | Retention |
|---|-------|-----------|----------|-------------|-----------|-----------|
| 1 | `maintenix.sensor.raw` | **12** | opcua-bridge | sensor-service | **10K+ msg/s** | 24h |
| 2 | `maintenix.sensor.processed` | **12** | sensor-service | alert-service, ml-service | 10K+ msg/s | 48h |
| 3 | `maintenix.alert.created` | 6 | alert-service | notification-svc, api-gateway, workorder-service | ~10 msg/min | 7d |
| 4 | `maintenix.alert.updated` | 6 | alert-service | api-gateway | ~30 msg/min | 7d |
| 5 | `maintenix.workorder.created` | 3 | workorder-service | notification-svc | ~5 msg/h | 7d |
| 6 | `maintenix.workorder.updated` | 3 | workorder-service | api-gateway | ~20 msg/h | 7d |
| 7 | `maintenix.equipment.status` | 3 | equipment-service | api-gateway | ~5 msg/min | 7d |
| 8 | `maintenix.ml.prediction` | 6 | ml-service | alert-service, equipment-svc | ~100 msg/min | 7d |
| 9 | `maintenix.ml.pipeline.status` | 1 | ml-service | api-gateway | ~1 msg/h | 7d |
| 10 | `maintenix.notification.send` | 3 | any service | notification-service | ~50 msg/min | 24h |
| 11 | `maintenix.audit.log` | 3 | all services | auth-service | ~100 msg/min | 30d |

### 2.2. Event flow diagram

```
PLC/SCADA
    │
    ▼
opcua-bridge ──→ sensor.raw ──→ sensor-service ──→ sensor.processed ───┬──→ alert-service
                                                                       │        │
                                                                       │        ├──→ alert.created ──┬──→ notification-svc
                                                                       │        │                    ├──→ api-gateway (WS)
                                                                       │        │                    └──→ workorder-svc
                                                                       │        │
                                                                       │        └──→ alert.updated ──→ api-gateway (WS)
                                                                       │
                                                                       └──→ ml-service
                                                                                │
                                                                                ├──→ ml.prediction ──┬──→ alert-service
                                                                                │                    └──→ equipment-svc
                                                                                │
                                                                                └──→ ml.pipeline.status ──→ api-gateway

workorder-service ──→ workorder.created ──→ notification-svc
                  ──→ workorder.updated ──→ api-gateway

equipment-service ──→ equipment.status ──→ api-gateway (WS)

any service ──→ notification.send ──→ notification-svc
            ──→ audit.log ──→ auth-service
```

### 2.3. Topic creation script

```bash
#!/bin/bash
# scripts/create-kafka-topics.sh

KAFKA_BROKER=${KAFKA_BROKER:-localhost:9092}

declare -A TOPICS=(
  ["maintenix.sensor.raw"]="12:1:24"           # partitions:replication:retention_hours
  ["maintenix.sensor.processed"]="12:1:48"
  ["maintenix.alert.created"]="6:1:168"
  ["maintenix.alert.updated"]="6:1:168"
  ["maintenix.workorder.created"]="3:1:168"
  ["maintenix.workorder.updated"]="3:1:168"
  ["maintenix.equipment.status"]="3:1:168"
  ["maintenix.ml.prediction"]="6:1:168"
  ["maintenix.ml.pipeline.status"]="1:1:168"
  ["maintenix.notification.send"]="3:1:24"
  ["maintenix.audit.log"]="3:1:720"            # 30 days
)

# DLQ topics
declare -A DLQ_TOPICS=(
  ["maintenix.dlq.sensor.raw"]="1:1:168"
  ["maintenix.dlq.sensor.processed"]="1:1:168"
  ["maintenix.dlq.alert.created"]="1:1:168"
  ["maintenix.dlq.notification.send"]="1:1:168"
)

for topic in "${!TOPICS[@]}"; do
  IFS=':' read -r partitions replication retention <<< "${TOPICS[$topic]}"
  kafka-topics.sh --create --topic "$topic" \
    --bootstrap-server "$KAFKA_BROKER" \
    --partitions "$partitions" \
    --replication-factor "$replication" \
    --config retention.ms=$((retention * 3600000)) \
    --if-not-exists
done

for topic in "${!DLQ_TOPICS[@]}"; do
  IFS=':' read -r partitions replication retention <<< "${DLQ_TOPICS[$topic]}"
  kafka-topics.sh --create --topic "$topic" \
    --bootstrap-server "$KAFKA_BROKER" \
    --partitions "$partitions" \
    --replication-factor "$replication" \
    --config retention.ms=$((retention * 3600000)) \
    --if-not-exists
done

echo "✅ All Kafka topics created"
```

---

## 3. Event Envelope (Common Header)

Tất cả Kafka messages tuân theo envelope format chung.

### 3.1. Kafka Record structure

```
Record {
  key:       string       ← partition key (determines which partition)
  value:     JSON bytes   ← event payload (xem từng topic bên dưới)
  headers: {
    "message_id":    UUID     ← unique per message, dùng cho idempotency
    "event_type":    string   ← e.g. "sensor.reading.created"
    "source":        string   ← producing service name
    "timestamp":     string   ← ISO 8601 UTC
    "trace_id":      string   ← OpenTelemetry trace ID (W3C format)
    "request_id":    string   ← correlation ID từ original request
    "schema_version":"1.0"    ← schema version cho evolution
  }
  timestamp: long         ← Kafka broker timestamp (auto)
}
```

### 3.2. Go producer helper

```go
// pkg/kafka/producer.go
type EventHeader struct {
    MessageID     string `json:"message_id"`
    EventType     string `json:"event_type"`
    Source        string `json:"source"`
    Timestamp     string `json:"timestamp"`
    TraceID       string `json:"trace_id"`
    RequestID     string `json:"request_id"`
    SchemaVersion string `json:"schema_version"`
}

func (p *Producer) Publish(ctx context.Context, topic, key string, eventType string, payload interface{}) error {
    value, _ := json.Marshal(payload)
    headers := []kafka.Header{
        {Key: "message_id",     Value: []byte(uuid.New().String())},
        {Key: "event_type",     Value: []byte(eventType)},
        {Key: "source",         Value: []byte(p.serviceName)},
        {Key: "timestamp",      Value: []byte(time.Now().UTC().Format(time.RFC3339Nano))},
        {Key: "trace_id",       Value: []byte(trace.SpanFromContext(ctx).SpanContext().TraceID().String())},
        {Key: "request_id",     Value: []byte(middleware.GetRequestID(ctx))},
        {Key: "schema_version", Value: []byte("1.0")},
    }
    return p.writer.WriteMessages(ctx, kafka.Message{
        Topic:   topic,
        Key:     []byte(key),
        Value:   value,
        Headers: headers,
    })
}
```

---

## 4. Topic Details — Sensor Pipeline

### 4.1. maintenix.sensor.raw

> PLC/SCADA → opcua-bridge → Kafka → sensor-service

| Property | Value |
|----------|-------|
| **Producer** | opcua-bridge |
| **Consumer** | sensor-service |
| **Partitions** | 12 |
| **Partition key** | `sensorId` (đảm bảo ordering per sensor) |
| **Throughput** | 10,000+ msg/s (peak) |
| **Retention** | 24h |
| **Compression** | lz4 (best for throughput) |
| **acks** | 1 (speed > durability cho raw sensor data) |

**Payload schema:**

```json
{
  "sensorId": "S005",
  "equipmentId": "EQ002",
  "value": 92.0,
  "unit": "°C",
  "timestamp": "2026-02-27T10:30:00.123Z",
  "qualityFlag": "good",
  "opcuaNodeId": "ns=2;s=EQ002.OilTemp",
  "opcuaStatusCode": 0
}
```

| Field | Type | Required | Mô tả |
|-------|------|----------|-------|
| sensorId | string | ✅ | ID sensor trong hệ thống |
| equipmentId | string | ✅ | ID thiết bị sở hữu sensor |
| value | float64 | ✅ | Giá trị đo |
| unit | string | ✅ | Đơn vị (°C, mm/s, bar, A, RPM, L/min) |
| timestamp | string | ✅ | ISO 8601 UTC, từ PLC clock |
| qualityFlag | enum | ✅ | `good`, `uncertain`, `bad` |
| opcuaNodeId | string | ❌ | OPC-UA node reference (debug) |
| opcuaStatusCode | int | ❌ | OPC-UA StatusCode (0 = Good) |

**Partition strategy:**

```
Partition = hash(sensorId) % 12

Ví dụ:
  S001 → partition 3   (EQ001 sensors có thể scatter)
  S004 → partition 7
  S005 → partition 11

→ Ordering guarantee: messages cùng sensorId luôn cùng partition
→ Cho phép sensor-service dùng 12 consumer instances (1:1 partition)
```

---

### 4.2. maintenix.sensor.processed

> sensor-service → Kafka → alert-service + ml-service + equipment-service

| Property | Value |
|----------|-------|
| **Producer** | sensor-service |
| **Consumers** | alert-service, ml-service, equipment-service |
| **Partitions** | 12 |
| **Partition key** | `equipmentId` (group sensors per equipment) |
| **Throughput** | 10,000+ msg/s |
| **Retention** | 48h |
| **Compression** | lz4 |
| **acks** | all (critical — alert pipeline depends on this) |

**Payload schema:**

```json
{
  "sensorId": "S005",
  "equipmentId": "EQ002",
  "sensorType": "temperature",
  "value": 92.0,
  "unit": "°C",
  "timestamp": "2026-02-27T10:30:00.123Z",
  "qualityFlag": "good",
  "thresholds": {
    "warningHigh": 85.0,
    "criticalHigh": 95.0,
    "warningLow": null,
    "criticalLow": null
  },
  "status": "critical",
  "anomalyScore": 2.4,
  "anomalyLevel": "warning",
  "rollingStats": {
    "mean1h": 88.5,
    "std1h": 3.2,
    "min1h": 82.0,
    "max1h": 92.0,
    "trend1h": 0.5
  }
}
```

| Field | Type | Required | Mô tả |
|-------|------|----------|-------|
| sensorId | string | ✅ | ID sensor |
| equipmentId | string | ✅ | ID thiết bị |
| sensorType | string | ✅ | temperature, vibration, pressure, current, rpm, flow_rate |
| value | float64 | ✅ | Giá trị đã validated |
| unit | string | ✅ | Đơn vị |
| timestamp | string | ✅ | ISO 8601 UTC |
| qualityFlag | enum | ✅ | `good`, `uncertain`, `bad` |
| thresholds | object | ✅ | Ngưỡng cảnh báo từ sensor config |
| status | enum | ✅ | `normal`, `warning`, `critical` (tính từ value vs thresholds) |
| anomalyScore | float64 | ✅ | Z-score (0 = bình thường, >3 = anomaly) |
| anomalyLevel | enum | ✅ | `normal`, `warning`, `critical` |
| rollingStats | object | ✅ | Thống kê rolling window 1h |

**Partition strategy:**

```
Partition = hash(equipmentId) % 12

→ Tất cả sensors cùng equipment vào cùng partition
→ alert-service xử lý per-equipment (compare nhiều sensors)
→ ml-service extract features per-equipment (cần tất cả sensors cùng lúc)
```

**Tại sao key đổi từ sensorId → equipmentId?**

`sensor.raw` dùng `sensorId` vì sensor-service cần ordering per sensor (validate, write).
`sensor.processed` dùng `equipmentId` vì downstream consumers cần group by equipment:
- alert-service: compare nhiều sensors cùng equipment
- ml-service: feature extraction cần multivariate data per equipment
- equipment-service: recalculate health score từ tất cả sensors

---

## 5. Topic Details — Alert Events

### 5.1. maintenix.alert.created

> alert-service → Kafka → notification-svc, api-gateway, workorder-service

| Property | Value |
|----------|-------|
| **Producer** | alert-service |
| **Consumers** | notification-svc, api-gateway, workorder-service |
| **Partitions** | 6 |
| **Partition key** | `equipmentId` |
| **acks** | all |

**Payload schema:**

```json
{
  "id": "ALT001",
  "equipmentId": "EQ002",
  "equipmentName": "Máy ép thủy lực M09",
  "severity": "critical",
  "type": "sensor_threshold",
  "title": "Quá nhiệt độ vòng bi",
  "description": "Nhiệt độ dầu thủy lực vượt ngưỡng critical 95°C, hiện tại 92°C",
  "status": "open",
  "createdAt": "2026-02-27T10:25:00Z",
  "slaDeadline": "2026-02-27T10:55:00Z",
  "productionLine": "Dây chuyền A",
  "triggerSensorId": "S005",
  "triggerValue": 92.0,
  "triggerThreshold": 85.0,
  "aiExplanation": "Phân tích cho thấy bộ lọc dầu bị tắc nghẽn 60%...",
  "contributingFactors": [
    { "factor": "Bộ lọc dầu tắc nghẽn", "impact": 45 }
  ],
  "recommendedActions": [
    "Thay bộ lọc dầu thủy lực",
    "Kiểm tra hệ thống làm mát"
  ]
}
```

**Consumer behavior:**

| Consumer | Action |
|----------|--------|
| notification-svc | Gửi email/SMS/Slack dựa trên severity + notification rules |
| api-gateway | Broadcast qua WebSocket `/topic/factory-alerts` |
| workorder-svc | Nếu severity=critical AND type=ml_prediction → auto-create draft WO |

---

### 5.2. maintenix.alert.updated

> alert-service → Kafka → api-gateway

| Property | Value |
|----------|-------|
| **Producer** | alert-service |
| **Consumer** | api-gateway |
| **Partitions** | 6 |
| **Partition key** | `alertId` (ordering per alert lifecycle) |

**Payload schema:**

```json
{
  "id": "ALT001",
  "equipmentId": "EQ002",
  "previousStatus": "open",
  "newStatus": "acknowledged",
  "updatedBy": "U003",
  "updatedAt": "2026-02-27T10:30:00Z",
  "notes": "Đang kiểm tra hiện trường",
  "eventType": "ALERT_ACKNOWLEDGED"
}
```

| eventType values | Trigger |
|-----------------|---------|
| `ALERT_ACKNOWLEDGED` | PUT /alerts/:id/acknowledge |
| `ALERT_ASSIGNED` | PUT /alerts/:id/assign |
| `ALERT_RESOLVED` | PUT /alerts/:id/resolve |
| `ALERT_ESCALATED` | SLA breach auto-escalation |
| `ALERT_CLOSED` | Admin closes alert |

---

## 6. Topic Details — Work Order Events

### 6.1. maintenix.workorder.created

| Property | Value |
|----------|-------|
| **Producer** | workorder-service |
| **Consumer** | notification-svc |
| **Partitions** | 3 |
| **Partition key** | `assignedTo` (group by technician) |

**Payload schema:**

```json
{
  "id": "WO001",
  "woNumber": "WO-2026-0145",
  "title": "Thay dầu thủy lực máy ép M09",
  "type": "corrective",
  "priority": "P1",
  "status": "assigned",
  "equipmentId": "EQ002",
  "equipmentName": "Máy ép thủy lực M09",
  "assignedTo": "U003",
  "assignedToName": "Lê Minh Khoa",
  "createdBy": "U002",
  "createdAt": "2026-02-26T10:30:00Z",
  "deadline": "2026-02-28T10:30:00Z",
  "alertId": "ALT001"
}
```

---

### 6.2. maintenix.workorder.updated

| Property | Value |
|----------|-------|
| **Producer** | workorder-service |
| **Consumer** | api-gateway, equipment-service |
| **Partitions** | 3 |
| **Partition key** | `equipmentId` |

**Payload schema:**

```json
{
  "id": "WO001",
  "woNumber": "WO-2026-0145",
  "equipmentId": "EQ002",
  "previousStatus": "in_progress",
  "newStatus": "completed",
  "updatedBy": "U003",
  "updatedAt": "2026-02-27T13:30:00Z",
  "completionRate": 100,
  "actualHours": 3.0,
  "totalCost": 10000000,
  "eventType": "WORKORDER_COMPLETED"
}
```

| eventType values | Consumer action |
|-----------------|-----------------|
| `WORKORDER_STATUS_CHANGED` | api-gateway: update Kanban board via WS |
| `WORKORDER_COMPLETED` | equipment-service: update lastMaintenanceDate, recalc health |
| `WORKORDER_CHECKLIST_UPDATED` | api-gateway: update progress bar via WS |

---

## 7. Topic Details — Equipment Events

### 7.1. maintenix.equipment.status

| Property | Value |
|----------|-------|
| **Producer** | equipment-service |
| **Consumer** | api-gateway |
| **Partitions** | 3 |
| **Partition key** | `equipmentId` |

**Payload schema:**

```json
{
  "equipmentId": "EQ002",
  "name": "Máy ép thủy lực M09",
  "previousStatus": "warning",
  "newStatus": "critical",
  "healthScore": 31,
  "previousHealthScore": 45,
  "productionLine": "Dây chuyền A",
  "updatedAt": "2026-02-27T10:30:00Z",
  "reason": "Health score dropped below critical threshold (35%)"
}
```

**Trigger conditions:**
- `healthScore` crosses threshold (100→70 = running→warning, 70→35 = warning→critical)
- Manual status change (maintenance mode, offline)
- Work order completion (health score recalculated)

---

## 8. Topic Details — ML Events

### 8.1. maintenix.ml.prediction

| Property | Value |
|----------|-------|
| **Producer** | ml-service |
| **Consumers** | alert-service, equipment-service |
| **Partitions** | 6 |
| **Partition key** | `equipmentId` |
| **Throughput** | ~100 msg/min (batch inference every 5 min per equipment) |

**Payload schema:**

```json
{
  "predictionId": "PRD-20260227-001",
  "equipmentId": "EQ009",
  "modelId": "MDL002",
  "modelName": "RUL Estimator",
  "modelVersion": "v2.1.0",
  "predictionType": "rul",
  "result": {
    "rulDays": 14,
    "failureProbability7d": 0.78,
    "failureProbability30d": 0.95,
    "confidence": 0.89
  },
  "features": {
    "vibration_trend": 0.85,
    "temperature_trend": 0.72,
    "maintenance_history": 3,
    "age": 7,
    "load_factor": 0.92
  },
  "featureImportance": {
    "vibration_trend": 0.35,
    "temperature_trend": 0.25,
    "age": 0.20,
    "load_factor": 0.12,
    "maintenance_history": 0.08
  },
  "contributingFactors": [
    { "factor": "Cách điện cuộn dây suy giảm", "impact": 40 },
    { "factor": "Rung động tăng", "impact": 35 },
    { "factor": "Nhiệt độ cao kéo dài", "impact": 25 }
  ],
  "timestamp": "2026-02-27T10:30:00Z"
}
```

| predictionType | result fields | Consumer behavior |
|---------------|--------------|-------------------|
| `rul` | rulDays, failureProbability7d/30d, confidence | alert-service: create alert if prob > threshold |
| `anomaly` | anomalyScore, isAnomaly, anomalyType | alert-service: create alert if score > 3.0 |
| `failure_mode` | predictedFailureMode, probability, confidence | alert-service: enrich alert with failure mode |
| `health_score` | healthScore, previousScore, delta | equipment-service: update equipment.health_score |

**alert-service threshold rules:**

```
if predictionType == "rul":
  if failureProbability7d ≥ 0.70 AND confidence ≥ 0.80 → severity: critical
  if failureProbability7d ≥ 0.40 AND confidence ≥ 0.80 → severity: high
  if failureProbability30d ≥ 0.60 AND confidence ≥ 0.75 → severity: medium

if predictionType == "anomaly":
  if anomalyScore ≥ 3.0 → severity: high
  if anomalyScore ≥ 2.5 → severity: medium
```

---

### 8.2. maintenix.ml.pipeline.status

| Property | Value |
|----------|-------|
| **Producer** | ml-service |
| **Consumer** | api-gateway |
| **Partitions** | 1 (low volume, ordering important) |
| **Partition key** | `pipelineId` |

**Payload schema:**

```json
{
  "pipelineId": "PL002",
  "name": "Anomaly Detector Training",
  "type": "train",
  "modelId": "MDL004",
  "previousStatus": "running",
  "newStatus": "running",
  "progress": 72,
  "metrics": null,
  "triggeredBy": "auto",
  "updatedAt": "2026-02-27T10:30:00Z",
  "eventType": "PIPELINE_PROGRESS"
}
```

| eventType | Khi nào |
|-----------|---------|
| `PIPELINE_STARTED` | Pipeline bắt đầu chạy |
| `PIPELINE_PROGRESS` | Progress update (mỗi 5%) |
| `PIPELINE_COMPLETED` | Hoàn thành, kèm metrics |
| `PIPELINE_FAILED` | Lỗi, kèm error message |

---

## 9. Topic Details — Cross-cutting

### 9.1. maintenix.notification.send

| Property | Value |
|----------|-------|
| **Producer** | any service |
| **Consumer** | notification-service |
| **Partitions** | 3 |
| **Partition key** | `channel` (email, sms, slack → separate partitions) |
| **Retention** | 24h |

**Payload schema:**

```json
{
  "notificationId": "NTF-20260227-001",
  "channel": "email",
  "recipients": ["engineer@maintenix.vn", "maint_mgr@maintenix.vn"],
  "recipientRoles": ["maintenance_engineer", "maintenance_manager"],
  "templateId": "alert_critical",
  "severity": "critical",
  "subject": "[CRITICAL] Quá nhiệt độ vòng bi - Máy ép thủy lực M09",
  "data": {
    "alertId": "ALT001",
    "equipmentName": "Máy ép thủy lực M09",
    "alertTitle": "Quá nhiệt độ vòng bi",
    "sensorValue": "92°C",
    "threshold": "85°C",
    "productionLine": "Dây chuyền A",
    "slaDeadline": "2026-02-27T10:55:00Z",
    "dashboardUrl": "https://maintenix.vn/alerts/ALT001"
  },
  "priority": "high",
  "createdAt": "2026-02-27T10:25:00Z"
}
```

| channel | Implementation |
|---------|---------------|
| `email` | SMTP / AWS SES, HTML template rendering |
| `sms` | Twilio / AWS SNS |
| `slack` | Slack Incoming Webhook |
| `teams` | MS Teams Incoming Webhook |
| `push` | FCM (future) |
| `in_app` | WebSocket → /user/queue/notifications |

---

### 9.2. maintenix.audit.log

| Property | Value |
|----------|-------|
| **Producer** | all services |
| **Consumer** | auth-service |
| **Partitions** | 3 |
| **Partition key** | `userId` (group actions per user) |
| **Retention** | 30 days |

**Payload schema:**

```json
{
  "userId": "U003",
  "userName": "Lê Minh Khoa",
  "action": "ACKNOWLEDGE_ALERT",
  "resource": "Alert",
  "resourceId": "ALT002",
  "details": "Acknowledged alert: Rung động bất thường - Băng tải A3",
  "ipAddress": "192.168.1.45",
  "userAgent": "Mozilla/5.0 ...",
  "timestamp": "2026-02-27T10:30:00Z",
  "dataBefore": { "status": "open" },
  "dataAfter": { "status": "acknowledged", "acknowledgedBy": "U003" },
  "serviceName": "alert-service",
  "requestId": "req-abc123"
}
```

**Common action values:**

| Service | Actions |
|---------|---------|
| auth-service | `LOGIN`, `LOGOUT`, `CREATE_USER`, `UPDATE_USER`, `DELETE_USER`, `CHANGE_PASSWORD` |
| equipment-service | `CREATE_EQUIPMENT`, `UPDATE_EQUIPMENT`, `DELETE_EQUIPMENT`, `UPDATE_SPARE_PART`, `REORDER_PART` |
| alert-service | `ACKNOWLEDGE_ALERT`, `ASSIGN_ALERT`, `RESOLVE_ALERT`, `ESCALATE_ALERT` |
| workorder-service | `CREATE_WORK_ORDER`, `UPDATE_STATUS`, `TOGGLE_CHECKLIST`, `ADD_WORK_LOG` |
| ml-service | `REGISTER_MODEL`, `DEPLOY_MODEL`, `DEPRECATE_MODEL`, `TRIGGER_PIPELINE`, `CANCEL_PIPELINE` |

---

## 10. Consumer Groups

### 10.1. All consumer groups

| Consumer Group | Service | Topics consumed | Instances (dev/prod) |
|---------------|---------|----------------|---------------------|
| `sensor-ingestion` | sensor-service | sensor.raw | 1 / 3-12 |
| `alert-sensor-processor` | alert-service | sensor.processed | 1 / 2-6 |
| `alert-ml-processor` | alert-service | ml.prediction | 1 / 2 |
| `ml-sensor-processor` | ml-service | sensor.processed | 1 / 2-6 |
| `equipment-ml-processor` | equipment-service | ml.prediction | 1 / 1 |
| `equipment-wo-processor` | equipment-service | workorder.updated | 1 / 1 |
| `notification-dispatcher` | notification-svc | alert.created, workorder.created, notification.send | 1 / 1 |
| `gateway-ws-broadcaster` | api-gateway | alert.created, alert.updated, workorder.updated, equipment.status, ml.pipeline.status | 1 / 2-5 |
| `workorder-alert-processor` | workorder-service | alert.created | 1 / 1 |
| `audit-logger` | auth-service | audit.log | 1 / 1 |

### 10.2. Consumer group scaling

```
sensor.raw (12 partitions):
  sensor-ingestion group: max 12 instances
  
  Dev:  1 instance  → consumer gets all 12 partitions
  Prod: 6 instances → each gets 2 partitions
  Peak: 12 instances → each gets 1 partition (max parallelism)

sensor.processed (12 partitions):
  alert-sensor-processor: max 12 instances (thường 2-6)
  ml-sensor-processor:    max 12 instances (thường 2-6)
  
  → 2 consumer groups, mỗi group nhận TOÀN BỘ messages (fan-out)
  → Kafka đảm bảo mỗi message trong 1 partition chỉ delivery 1 consumer trong group
```

### 10.3. Consumer configuration

```go
// pkg/kafka/consumer.go (common config)
type ConsumerConfig struct {
    Brokers        []string
    GroupID        string
    Topics         []string
    MinBytes       int    // 1KB
    MaxBytes       int    // 10MB
    MaxWait        time.Duration // 100ms
    CommitInterval time.Duration // 1s (auto-commit)
    StartOffset    int64  // kafka.LastOffset (-1)
    
    // Retry
    MaxRetries     int           // 3
    RetryBackoff   time.Duration // 1s, 2s, 4s (exponential)
    MaxRetryBackoff time.Duration // 60s
    
    // DLQ
    DLQTopic       string        // e.g. "maintenix.dlq.sensor.raw"
    DLQEnabled     bool
}
```

---

## 11. Dead Letter Queue (DLQ)

### 11.1. DLQ topics

| Original topic | DLQ topic | Khi nào message vào DLQ |
|---------------|-----------|------------------------|
| sensor.raw | `maintenix.dlq.sensor.raw` | Invalid JSON, unknown sensorId, quality=bad liên tục |
| sensor.processed | `maintenix.dlq.sensor.processed` | Consumer crash after max retries |
| alert.created | `maintenix.dlq.alert.created` | notification-svc gửi email fail, WO creation fail |
| notification.send | `maintenix.dlq.notification.send` | Email/SMS send failed after retries |

### 11.2. DLQ message format

```json
{
  "originalTopic": "maintenix.sensor.processed",
  "originalPartition": 7,
  "originalOffset": 1234567,
  "originalKey": "EQ002",
  "originalHeaders": { ... },
  "originalPayload": { ... },
  "error": {
    "code": "THRESHOLD_CHECK_FAILED",
    "message": "PostgreSQL connection timeout after 10s",
    "stackTrace": "...",
    "retryCount": 3
  },
  "consumerGroup": "alert-sensor-processor",
  "failedAt": "2026-02-27T10:30:00Z"
}
```

### 11.3. DLQ processing flow

```
Normal flow:
  sensor.processed → alert-service consumer
      ↓ (success)
  Process message → ack offset

Retry flow:
  sensor.processed → alert-service consumer
      ↓ (error)
  Retry 1 (after 1s) → error
  Retry 2 (after 2s) → error
  Retry 3 (after 4s) → error
      ↓ (max retries exceeded)
  Produce to maintenix.dlq.sensor.processed
  Ack original offset (don't block pipeline)
  Prometheus counter: dlq_messages_total{topic="sensor.processed"} +1

DLQ replay (manual):
  Admin inspects DLQ messages via Kafka UI
  Fix root cause (e.g., restart PostgreSQL)
  Replay: consume from DLQ → re-produce to original topic
  
  $ go run cmd/dlq-replay/main.go --topic maintenix.dlq.sensor.processed --limit 100
```

### 11.4. DLQ monitoring alerts

```yaml
# prometheus/rules/kafka-dlq.yml
groups:
  - name: kafka-dlq
    rules:
      - alert: DLQMessagesDetected
        expr: increase(kafka_dlq_messages_total[5m]) > 0
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Messages detected in DLQ {{ $labels.topic }}"
          
      - alert: DLQMessagesAccumulating
        expr: kafka_dlq_messages_total > 100
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "DLQ {{ $labels.topic }} has {{ $value }} unprocessed messages"
```

---

## 12. Idempotency & Deduplication

### 12.1. Producer idempotency

```go
// Kafka producer config
writer := &kafka.Writer{
    Addr:         kafka.TCP(brokers...),
    Balancer:     &kafka.Hash{},         // consistent partition by key
    RequiredAcks: kafka.RequireAll,       // acks=all
    MaxAttempts:  5,                      // retry on transient errors
    BatchTimeout: 100 * time.Millisecond, // batch linger
    Compression:  kafka.Lz4,
    // enable.idempotence = true (built-in exactly-once producer)
}
```

### 12.2. Consumer deduplication

```go
// Pattern: Redis-based dedup
func (c *Consumer) processWithDedup(ctx context.Context, msg kafka.Message) error {
    messageID := getHeader(msg, "message_id")
    
    // Check dedup
    dedupKey := fmt.Sprintf("dedup:%s:%s", c.groupID, messageID)
    exists, err := c.redis.SetNX(ctx, dedupKey, "1", 24*time.Hour).Result()
    if err != nil {
        return err // Redis error → retry
    }
    if !exists {
        // Already processed → skip (idempotent)
        log.Info("duplicate message skipped", "message_id", messageID)
        return nil
    }
    
    // Process
    if err := c.handler(ctx, msg); err != nil {
        // Rollback dedup key on failure
        c.redis.Del(ctx, dedupKey)
        return err
    }
    
    return nil
}
```

### 12.3. Dedup Redis keys

```
dedup:{consumerGroup}:{messageId} → "1" (TTL 24h)

Ví dụ:
  dedup:alert-sensor-processor:550e8400-e29b-41d4-a716 → "1"
```

---

## 13. Monitoring & Alerting

### 13.1. Kafka metrics (Prometheus)

Exposed bởi mỗi Go service:

```
# Producer metrics
kafka_producer_messages_total{topic="maintenix.sensor.processed"} 1234567
kafka_producer_errors_total{topic="maintenix.sensor.processed"} 3
kafka_producer_batch_size{topic="maintenix.sensor.processed"} 42
kafka_producer_latency_seconds{topic="maintenix.sensor.processed",quantile="0.99"} 0.05

# Consumer metrics
kafka_consumer_messages_total{topic="maintenix.sensor.raw",group="sensor-ingestion"} 9876543
kafka_consumer_errors_total{topic="maintenix.sensor.raw",group="sensor-ingestion"} 12
kafka_consumer_lag{topic="maintenix.sensor.raw",group="sensor-ingestion",partition="3"} 150
kafka_consumer_processing_seconds{topic="maintenix.sensor.raw",quantile="0.99"} 0.02

# DLQ metrics
kafka_dlq_messages_total{topic="maintenix.dlq.sensor.raw"} 5
```

### 13.2. Grafana dashboard panels

```
Dashboard: "Maintenix Kafka"

Row 1: Throughput
  - sensor.raw messages/s (target: 10K+)
  - sensor.processed messages/s
  - alert.created messages/min

Row 2: Consumer Lag (critical)
  - sensor-ingestion lag per partition (alert if >5000)
  - alert-sensor-processor lag (alert if >1000)
  - ml-sensor-processor lag (alert if >2000)

Row 3: Latency
  - End-to-end: sensor.raw produce → alert.created produce
  - Per-service processing time
  
Row 4: Errors
  - DLQ message rate
  - Producer error rate
  - Consumer retry rate
```

### 13.3. Prometheus alerting rules

```yaml
# prometheus/rules/kafka.yml
groups:
  - name: kafka-alerts
    rules:
      - alert: KafkaConsumerLagHigh
        expr: kafka_consumer_lag > 10000
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Consumer {{ $labels.group }} lag {{ $value }} on {{ $labels.topic }}"
          
      - alert: KafkaProducerErrors
        expr: rate(kafka_producer_errors_total[5m]) > 0.01
        for: 2m
        labels:
          severity: warning
          
      - alert: KafkaSensorPipelineDown
        expr: rate(kafka_consumer_messages_total{group="sensor-ingestion"}[5m]) == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Sensor ingestion pipeline stopped — no messages consumed in 2 minutes"
```

---

## 14. Development & Testing

### 14.1. Produce test messages

```bash
# Produce single sensor reading
echo '{"sensorId":"S005","equipmentId":"EQ002","value":92.0,"unit":"°C","timestamp":"2026-02-27T10:30:00Z","qualityFlag":"good"}' | \
  kafka-console-producer.sh \
    --bootstrap-server localhost:9092 \
    --topic maintenix.sensor.raw \
    --property "parse.key=true" \
    --property "key.separator=:" \
    --key S005

# Produce test alert
echo '{"id":"ALT-TEST","equipmentId":"EQ001","severity":"medium","type":"system","title":"Test alert","status":"open","createdAt":"2026-02-27T10:30:00Z"}' | \
  kafka-console-producer.sh \
    --bootstrap-server localhost:9092 \
    --topic maintenix.alert.created \
    --property "parse.key=true" \
    --property "key.separator=:" \
    --key EQ001
```

### 14.2. Consume & inspect messages

```bash
# Consume latest messages from sensor.processed
kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic maintenix.sensor.processed \
  --from-beginning \
  --max-messages 5 \
  --property print.key=true \
  --property print.headers=true \
  --property print.timestamp=true

# Monitor consumer group lag
kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group sensor-ingestion \
  --describe
```

### 14.3. Go integration test

```go
// internal/kafka/consumer_test.go
func TestSensorProcessedConsumer(t *testing.T) {
    // Setup: embedded Kafka (testcontainers)
    ctx := context.Background()
    kafkaC, _ := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
        ContainerRequest: testcontainers.ContainerRequest{
            Image: "confluentinc/cp-kafka:7.6",
            ExposedPorts: []string{"9092/tcp"},
        },
        Started: true,
    })
    defer kafkaC.Terminate(ctx)
    
    broker, _ := kafkaC.MappedPort(ctx, "9092")
    
    // Produce test message
    producer := NewProducer([]string{"localhost:" + broker.Port()})
    producer.Publish(ctx, "maintenix.sensor.processed", "EQ002", "sensor.reading", &SensorProcessed{
        SensorID:    "S005",
        EquipmentID: "EQ002",
        Value:       92.0,
        Status:      "critical",
    })
    
    // Verify consumer processes it
    alertCreated := make(chan *Alert, 1)
    consumer := NewAlertSensorConsumer([]string{"localhost:" + broker.Port()}, func(alert *Alert) {
        alertCreated <- alert
    })
    go consumer.Start(ctx)
    
    select {
    case alert := <-alertCreated:
        assert.Equal(t, "EQ002", alert.EquipmentID)
        assert.Equal(t, "critical", alert.Severity)
    case <-time.After(10 * time.Second):
        t.Fatal("timeout waiting for alert creation")
    }
}
```

### 14.4. Load test script

```bash
# scripts/kafka-load-test.sh
# Simulate 10K sensor readings/s for 60 seconds

for i in $(seq 1 600000); do
  SENSOR_ID="S$(printf '%03d' $((RANDOM % 12 + 1)))"
  VALUE=$(echo "scale=1; 50 + $RANDOM / 3276" | bc)
  echo "${SENSOR_ID}:{\"sensorId\":\"${SENSOR_ID}\",\"equipmentId\":\"EQ001\",\"value\":${VALUE},\"unit\":\"°C\",\"timestamp\":\"$(date -u +%FT%TZ)\",\"qualityFlag\":\"good\"}"
done | kafka-console-producer.sh \
  --bootstrap-server localhost:9092 \
  --topic maintenix.sensor.raw \
  --property "parse.key=true" \
  --property "key.separator=:" \
  --throughput 10000

# Monitor lag during test
watch -n 1 'kafka-consumer-groups.sh --bootstrap-server localhost:9092 --group sensor-ingestion --describe 2>/dev/null | tail -15'
```
