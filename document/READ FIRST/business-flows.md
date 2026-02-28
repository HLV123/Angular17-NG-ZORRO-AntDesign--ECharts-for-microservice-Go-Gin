# Maintenix — Business Flows

> **Smart Predictive Maintenance Warning System**
> 8 luồng nghiệp vụ chính với sequence diagram chi tiết.
> Mỗi flow mô tả: actors, services tham gia, data flow, Kafka events, và trạng thái thay đổi.

---

## Mục lục

1. [Sensor Data Ingestion Pipeline](#1-sensor-data-ingestion-pipeline)
2. [Alert Generation & Lifecycle](#2-alert-generation--lifecycle)
3. [AI Prediction → Predictive Alert](#3-ai-prediction--predictive-alert)
4. [Work Order Lifecycle (FSM)](#4-work-order-lifecycle-fsm)
5. [Spare Part Management & Auto-Reorder](#5-spare-part-management--auto-reorder)
6. [Preventive Maintenance Scheduling](#6-preventive-maintenance-scheduling)
7. [AI Model Lifecycle (MLOps)](#7-ai-model-lifecycle-mlops)
8. [Authentication & Authorization](#8-authentication--authorization)

---

## Tổng quan: Mối quan hệ giữa các flows

```
                    ┌─────────────────────────────────────┐
                    │         Flow 1: Sensor Ingestion    │
                    │  PLC → OPC-UA → Kafka → sensor-svc  │
                    └──────────────┬──────────────────────┘
                                   │
                     ┌─────────────┼──────────────┐
                     │             │              │
                     ▼             ▼              ▼
         ┌───────────────┐  ┌──────────┐  ┌──────────────┐
         │ Flow 2: Alert │  │ Flow 3:  │  │ Equipment    │
         │ (Threshold)   │  │ AI       │  │ Health Score │
         │ sensor → alert│  │ Predict  │  │ Recalculate  │
         └───────┬───────┘  └────┬─────┘  └──────────────┘
                 │               │
                 └───────┬───────┘
                         ▼
              ┌────────────────────┐
              │ Flow 4: Work Order │
              │ (auto-create từ    │
              │  critical alert)   │
              └────────┬───────────┘
                       │
            ┌──────────┼──────────┐
            ▼          ▼          ▼
  ┌──────────────┐ ┌────────┐ ┌──────────────┐
  │ Flow 5:      │ │ Flow 6:│ │ Notification │
  │ Spare Parts  │ │ PM     │ │ (email/SMS/  │
  │ (check stock)│ │Schedule│ │  Slack/push) │
  └──────────────┘ └────────┘ └──────────────┘
```

---

## 1. Sensor Data Ingestion Pipeline

> **Trigger:** PLC/SCADA gửi data liên tục (mỗi 100ms-1s)
> **End result:** Data lưu vào InfluxDB + TimescaleDB, broadcast real-time tới dashboard

### Sequence Diagram

```
PLC/SCADA        opcua-bridge     Kafka              sensor-service        InfluxDB    TimescaleDB    Redis         Kafka (out)
    │                 │              │                      │                 │            │              │              │
    │  OPC-UA data    │              │                      │                 │            │              │              │
    │────────────────→│              │                      │                 │            │              │              │
    │  (subscribe     │              │                      │                 │            │              │              │
    │   node changes) │              │                      │                 │            │              │              │
    │                 │              │                      │                 │            │              │              │
    │                 │  Produce     │                      │                 │            │              │              │
    │                 │  sensor.raw  │                      │                 │            │              │              │
    │                 │─────────────→│                      │                 │            │              │              │
    │                 │              │                      │                 │            │              │              │
    │                 │              │  Consume sensor.raw  │                 │            │              │              │
    │                 │              │─────────────────────→│                 │            │              │              │
    │                 │              │                      │                 │            │              │              │
    │                 │              │                      │── Validate ────→│            │              │              │
    │                 │              │                      │   (quality flag)│            │              │              │
    │                 │              │                      │                 │            │              │              │
    │                 │              │                      │── Write hot ───→│ (7d ret.)  │              │              │
    │                 │              │                      │   data          │            │              │              │
    │                 │              │                      │                 │            │              │              │
    │                 │              │                      │── Write history─────────── ─→│ (365d ret.)  │              │
    │                 │              │                      │                 │            │              │              │
    │                 │              │                      │── Cache latest─────────────────────────────→│              │
    │                 │              │                      │   reading       │            │  (TTL 30s)   │              │
    │                 │              │                      │                 │            │              │              │
    │                 │              │                      │── Anomaly ──┐   │            │              │              │
    │                 │              │                      │   detection │   │            │              │              │
    │                 │              │                      │   (Z-score) │   │            │              │              │
    │                 │              │                      │←────────────┘   │            │              │              │
    │                 │              │                      │                 │            │              │              │
    │                 │              │                      │── Produce sensor.processed────────────────────────────────→│
    │                 │              │                      │                 │            │              │              │
```

### Ví dụ thực tế từ mock data

```
PLC gửi dữ liệu sensor S005 (Nhiệt độ dầu, Máy ép M09):

  OPC-UA reading:
    node_id: ns=2;s=EQ002.OilTemp
    value: 92
    timestamp: 2026-02-27T10:30:00Z
    quality: Good

  → opcua-bridge transform → Kafka message:
    topic: maintenix.sensor.raw
    key: S005
    value: {
      "sensorId": "S005",
      "equipmentId": "EQ002",
      "value": 92,
      "unit": "°C",
      "timestamp": "2026-02-27T10:30:00Z",
      "qualityFlag": "good"
    }

  → sensor-service:
    1. Validate: qualityFlag == "good" ✓
    2. Write InfluxDB: sensor_realtime bucket
    3. Write TimescaleDB: sensor_readings hypertable
    4. Cache Redis: sensor:latest:S005 = 92 (TTL 30s)
    5. Anomaly check: Z-score = (92 - mean(80)) / std(5) = 2.4 → WARNING
    6. Produce:
       topic: maintenix.sensor.processed
       value: { ...original, "anomalyScore": 2.4, "anomalyLevel": "warning" }
```

### Data flow speed

| Stage | Latency | Notes |
|-------|---------|-------|
| PLC → OPC-UA Bridge | ~100ms | OPC-UA subscription interval |
| Bridge → Kafka | ~50ms | Async producer, batch linger 100ms |
| Kafka → sensor-service | ~100ms | Consumer poll interval |
| Validate + Write (parallel) | ~200ms | InfluxDB + TimescaleDB concurrent writes |
| Produce processed | ~50ms | Async produce |
| **Total** | **~500ms** | PLC reading → available for consumers |

---

## 2. Alert Generation & Lifecycle

> **Trigger:** sensor-service phát hiện giá trị vượt ngưỡng (threshold) HOẶC ml-service dự đoán anomaly
> **End result:** Alert tạo, notify user, SLA countdown, resolve/close

### 2.1. Alert Generation (Threshold-based)

```
Kafka                  alert-service        PostgreSQL    Redis          Kafka (out)     notification     api-gateway
(sensor.processed)          │                   │           │               │            -service          │
    │                       │                   │           │               │               │              │
    │  Consume:             │                   │           │               │               │              │
    │  value: 92°C          │                   │           │               │               │              │
    │  threshold: 85°C warn │                   │           │               │               │              │
    │            95°C crit  │                   │           │               │               │              │
    │──────────────────────→│                   │           │               │               │              │
    │                       │                   │           │               │               │              │
    │                       │── Check threshold │           │               │               │              │
    │                       │   92 ≥ 85 (warn)  │           │               │               │              │
    │                       │   92 < 95 (crit)  │           │               │               │              │
    │                       │   → severity=HIGH │           │               │               │              │
    │                       │                   │           │               │               │              │
    │                       │── Lookup SLA ─────────────────│               │               │              │
    │                       │   high → 60min    │           │               │               │              │
    │                       │   response time   │           │               │               │              │
    │                       │                   │           │               │               │              │
    │                       │── Create alert ──→│           │               │               │              │
    │                       │   status: "open"  │ INSERT    │               │               │              │
    │                       │   slaDeadline:    │           │               │               │              │
    │                       │   now() + 60min   │           │               │               │              │
    │                       │                   │           │               │               │              │
    │                       │── Cache active ───────────────│               │               │              │
    │                       │   alert:active:   │           │ INCR count    │               │              │
    │                       │   count +1        │           │               │               │              │
    │                       │                   │           │               │               │              │
    │                       │── Start SLA timer────────────→│               │               │              │
    │                       │   alert:sla:ALT001│           │ TTL=60min     │               │              │
    │                       │                   │           │               │               │              │
    │                       │── Produce alert.created──────→│               │               │              │
    │                       │                   │           │               │ Consume       │              │
    │                       │                   │           │               │──────────────→│              │
    │                       │                   │           │               │  Send email/  │              │
    │                       │                   │           │               │  SMS/Slack    │              │
    │                       │                   │           │               │               │              │
    │                       │                   │           │               │ Consume ────────────────────→│
    │                       │                   │           │               │               │  WebSocket   │
    │                       │                   │           │               │               │  broadcast   │
    │                       │                   │           │               │               │  /topic/     │
    │                       │                   │           │               │               │  factory-    │
    │                       │                   │           │               │               │  alerts      │
```

### 2.2. Alert Lifecycle (Full)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Alert Status Lifecycle                              │
│                                                                             │
│   ┌────────┐   auto (threshold/   ┌───────────────┐   engineer    ┌────────┐│
│   │        │   ML prediction)     │               │   reviews     │        ││
│   │  N/A   │──────────────────────│     OPEN      │──────────────→│  ACK   ││
│   │        │                      │               │               │        ││
│   └────────┘                      └───────┬───────┘               └───┬────┘│
│                                           │                           │     │
│                        SLA breach ┌───────┼───────┐    assign to      │     │
│                        auto       │               │    technician     │     │
│                     ┌──────────── │  ESCALATED    │←──────────────────┤     │
│                     │             │               │                   │     │
│                     │             └───────────────┘                   │     │
│                     │                                                 │     │
│                     │                                          ┌──────▼───┐ │
│                     │                                          │ ASSIGNED │ │
│                     │                                          └──────┬───┘ │
│                     │                                                 │     │
│                     │                                    start  ┌─────▼────┐│
│                     │                                    work   │   IN     ││
│                     │                                           │PROGRESS  ││
│                     │                                           └─────┬────┘│
│                     │                                                 │     │
│                     │                                   fix     ┌─────▼────┐│
│                     └──────────────────────────────────────────→│ RESOLVED ││
│                                                                 └──────┬───┘│
│                                                                        │    │
│                                                         verify  ┌──────▼──┐ │
│                                                                 │ CLOSED  │ │
│                                                                 └─────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3. Ví dụ thực tế: ALT001 — Quá nhiệt dầu máy ép M09

```
Timeline:

T+0min    Sensor S005 (Nhiệt độ dầu, EQ002) = 92°C
          → alert-service: 92 ≥ warningHigh(85) → severity = CRITICAL (gần criticalHigh 95)
          → Tạo ALT001: status=open, slaDeadline = T+30min (critical SLA)
          → Kafka → notification-service: email + Slack tới maintenance team
          → WebSocket → Dashboard: popup alert real-time

T+5min    Engineer Lê Minh Khoa (U003) nhận notification trên dashboard
          → PUT /api/alerts/ALT001/acknowledge
          → ALT001: status=acknowledged, acknowledgedBy="Lê Minh Khoa"
          → Audit log: "ACKNOWLEDGE_ALERT" (AUD001)

T+10min   Factory Manager Trần Thị Lan (U002) xem dashboard, thấy critical alert
          → Tạo Work Order WO001: "Thay dầu thủy lực máy ép M09"
          → POST /api/work-orders
          → WO001: type=corrective, priority=P1, alertId=ALT001
          → Audit log: "CREATE_WORK_ORDER" (AUD002)

T+15min   WO001 assigned cho Khoa → status: in_progress
          → Khoa bắt đầu checklist: xả dầu cũ ✓, thay bộ lọc ✓

T+180min  Khoa hoàn thành: đổ dầu mới ✓, kiểm tra áp suất ✓, chạy thử ✓
          → WO001: status=completed, actualHours=3, completionRate=100%
          → PUT /api/alerts/ALT001/resolve
          → ALT001: status=resolved, resolvedAt=now()

T+240min  Inspector Ngô Thị Mai (U006) verify work
          → WO001: status=verified → closed
          → ALT001: status=closed
```

### 2.4. SLA Escalation (Auto)

```
Nếu alert không được acknowledge trong SLA time:

T+0min    ALT tạo, severity=critical, SLA=30min
          → Redis: alert:sla:ALT = TTL 30 phút

T+25min   Redis TTL < 5min
          → alert-service background job: check SLA approaching
          → Kafka → notification: "⚠️ SLA sắp breach trong 5 phút"

T+30min   Redis key expired (TTL=0)
          → alert-service: auto-escalate
          → ALT: status=escalated, escalateTo=maintenance_manager (U008)
          → Kafka → notification: "🔴 SLA BREACHED — escalated to Vũ Đình Hùng"
```

---

## 3. AI Prediction → Predictive Alert

> **Trigger:** ml-service nhận sensor data từ Kafka, chạy model inference
> **End result:** Dự đoán RUL (Remaining Useful Life) hoặc phát hiện anomaly → tạo predictive alert

### Sequence Diagram

```
Kafka               ml-service            MinIO        PostgreSQL    Kafka (out)      alert-service
(sensor.processed)       │                   │              │             │                 │
    │                    │                   │              │             │                 │
    │  Consume:          │                   │              │             │                 │
    │  sensor readings   │                   │              │             │                 │
    │  (batch 32 points) │                   │              │             │                 │
    │───────────────────→│                   │              │             │                 │
    │                    │                   │              │             │                 │
    │                    │── Feature ──┐     │              │             │                 │
    │                    │   extraction│     │              │             │                 │
    │                    │   (rolling  │     │              │             │                 │
    │                    │    window   │     │              │             │                 │
    │                    │    stats)   │     │              │             │                 │
    │                    │←────────────┘     │              │             │                 │
    │                    │                   │              │             │                 │
    │                    │── Load model ────→│              │             │                 │
    │                    │   (cached in      │ model.onnx   │             │                 │
    │                    │    memory)        │              │             │                 │
    │                    │                   │              │             │                 │
    │                    │── ONNX inference──┐              │             │                 │
    │                    │   RUL = 14 days   │              │             │                 │
    │                    │   P(fail 7d)= 78% │              │             │                 │
    │                    │   confidence= 89% │              │             │                 │
    │                    │←──────────────────┘              │             │                 │
    │                    │                   │              │             │                 │
    │                    │── Save prediction────────────────│             │                 │
    │                    │                   │    INSERT    │             │                 │
    │                    │                   │              │             │                 │
    │                    │── Produce ml.prediction ──────────────────────→│                 │
    │                    │   {equipmentId: "EQ009",         │             │                 │
    │                    │    modelId: "MDL002",            │             │ Consume         │
    │                    │    rul_days: 14,                 │             │────────────────→│
    │                    │    fail_prob_7d: 0.78,           │             │                 │
    │                    │    confidence: 0.89,             │             │ Check:          │
    │                    │    features: {...}}              │             │ fail_prob > 0.7 │
    │                    │                   │              │             │ AND conf > 0.8  │
    │                    │                   │              │             │ → Create alert  │
    │                    │                   │              │             │ ALT004:         │
    │                    │                   │              │             │ type=ml_predict │
    │                    │                   │              │             │ severity=critic │
```

### Ví dụ thực tế: ALT004 — Dự đoán hỏng động cơ băng tải EQ009

```
Input data (từ sensors giả lập, equipment EQ009 không có sensors trong mock
nhưng trong production sẽ có):

  Features extracted (rolling window 7 ngày):
  {
    "vibration_trend": 0.85,          ← xu hướng tăng (1.0 = tăng mạnh)
    "temperature_trend": 0.72,         ← nhiệt cuộn dây tăng dần
    "maintenance_history": 3,          ← 3 lần bảo trì trong 6 tháng
    "age": 7,                          ← 7 năm tuổi (2019→2026)
    "load_factor": 0.92                ← chạy 92% công suất
  }

RUL Estimator (MDL002, v2.1.0) inference:
  {
    "rul_days": 14,
    "failure_probability_7d": 0.78,
    "failure_probability_30d": 0.95,
    "confidence": 0.89,
    "contributing_factors": [
      {"factor": "Cách điện cuộn dây suy giảm", "impact": 0.40},
      {"factor": "Rung động tăng",              "impact": 0.35},
      {"factor": "Nhiệt độ cao kéo dài",        "impact": 0.25}
    ]
  }

alert-service nhận prediction:
  Rule: fail_prob_7d(0.78) > threshold(0.70) AND confidence(0.89) > min(0.80)
  → Tạo ALT004:
    severity: critical (fail_prob > 0.7)
    type: ml_prediction
    title: "Dự đoán hỏng trong 7 ngày"
    aiExplanation: "Kết hợp nhiều yếu tố: rung động tăng, nhiệt độ cuộn dây tăng..."
    recommendedActions: ["Dừng máy kiểm tra cuộn dây", "Đo điện trở cách điện", ...]

→ Factory Manager tạo WO005: "Kiểm tra khẩn cấp động cơ băng tải"
   type=emergency, priority=P1, assignedTo=Lê Minh Khoa
```

### AI prediction thresholds

| Condition | Alert severity | Action |
|-----------|---------------|--------|
| fail_prob_7d ≥ 0.70, confidence ≥ 0.80 | critical | Auto-create alert, notify manager |
| fail_prob_7d ≥ 0.40, confidence ≥ 0.80 | high | Auto-create alert, add to dashboard |
| fail_prob_30d ≥ 0.60, confidence ≥ 0.75 | medium | Auto-create alert, suggest PM schedule |
| anomaly_score ≥ 3.0 (Z-score) | high | Auto-create alert from anomaly detection |
| drift_score ≥ 0.20 | info (internal) | Alert to data_scientist, suggest retraining |

---

## 4. Work Order Lifecycle (FSM)

> **Trigger:** Manual creation, auto-create from critical alert, hoặc PM schedule due
> **End result:** Maintenance task completed, equipment health restored, cost tracked

### 4.1. State Machine

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              Work Order FSM (10 states)                              │
│                                                                                      │
│   ┌────────┐   engineer     ┌───────────┐   manager     ┌──────────┐                 │
│   │ DRAFT  │───creates─────→│ SUBMITTED │───approves───→│ APPROVED │                 │
│   └────────┘                └───────────┘               └────┬─────┘                 │
│       ↑                                                      │                       │
│       │ (auto-create                                    schedule│                    │
│       │  from critical                                   date   │                    │
│       │  alert skips                               ┌──────▼──────┐                   │
│       │  to ASSIGNED)                              │  SCHEDULED  │                   │
│       │                                            └──────┬──────┘                   │
│       │                                                   │ assign                   │
│       │                                            ┌──────▼──────┐                   │
│       └────────────────────────────────────────────│   ASSIGNED  │                   │
│                                                    └──────┬──────┘                   │
│                                                           │ technician starts        │
│                                                     ┌──────▼──────┐                  │
│                                               ┌────→│ IN_PROGRESS │←────┐            │
│                                               │     └──────┬──────┘     │            │
│                                               │            │            │            │
│                                               │    ┌───────┴───────┐    │            │
│                                               │    │               │    │            │
│                                               │    ▼               ▼    │            │
│                                          ┌──────────┐      ┌────────────┐            │
│                                          │ PENDING  │      │ COMPLETED  │            │
│                                          │ _PARTS   │      │            │            │
│                                          └──────────┘      └──────┬─────┘            │
│                                          (parts arrive →          │                  │
│                                           back to in_progress)    │inspector verifies│
│                                                             ┌─────▼──────┐           │
│                                                             │  VERIFIED  │           │
│                                                             └─────┬──────┘           │
│                                                                   │ auto/manual close│
│                                                             ┌─────▼──────┐           │
│                                                             │   CLOSED   │           │
│                                                             └────────────┘           │
│                                                                                      │
│  Reopen: COMPLETED → IN_PROGRESS (if issue found during verification)                │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2. Ví dụ thực tế: WO001 — Thay dầu thủy lực máy ép M09

```
                    Factory        Maintenance     Technician/      Quality       System
                    Manager        Engineer        Engineer         Inspector     (auto)
                    (Trần Thị Lan) (Lê Minh Khoa)  (Lê Minh Khoa)  (Ngô Thị Mai)
                         │              │               │               │            │
 ALT001 (critical)       │              │               │               │            │
 created ───────────────→│              │               │               │            │
                         │              │               │               │            │
                         │── Create ───→│               │               │            │
                         │   WO001      │               │               │            │
                         │   P1,correct.│               │               │            │
                         │   assign to  │               │               │            │
                         │   Khoa       │               │               │            │
                         │              │               │               │            │
                         │     WO001: DRAFT → ASSIGNED (skip approval for P1)        │
                         │              │               │               │            │
                         │              │── Review ────→│               │            │
                         │              │   requirements│               │            │
                         │              │               │               │            │
                         │              │               │── Check stock │            │
                         │              │               │   SP002 (bộ lọc): qty=3 ✓  │
                         │              │               │   SP003 (dầu):    qty=8 ✓  │
                         │              │               │               │            │
                         │              │               │── Start work  │            │
                         │              │               │   WO001: ASSIGNED → IN_PROGRESS
                         │              │               │               │            │
                         │              │               │── Checklist:  │            │
                         │              │               │   [✓] Xả dầu cũ           │
                         │              │               │   [✓] Thay bộ lọc         │
                         │              │               │   [✓] Đổ dầu mới          │
                         │              │               │   [✓] Kiểm tra áp suất    │
                         │              │               │   [✓] Chạy thử            │
                         │              │               │               │            │
                         │              │               │── Log work:   │            │
                         │              │               │   hours=3     │            │
                         │              │               │   parts used: │            │
                         │              │               │   SP002 × 1   │            │
                         │              │               │   SP003 × 2   │            │
                         │              │               │               │            │
                         │              │               │── Complete    │            │
                         │              │               │   WO001: IN_PROGRESS → COMPLETED
                         │              │               │   actualHours=3            │
                         │              │               │   laborCost=1,500,000      │
                         │              │               │   partsCost=8,500,000      │
                         │              │               │   totalCost=10,000,000     │
                         │              │               │               │            │
                         │              │               │               │── Verify   │
                         │              │               │               │   quality  │
                         │              │               │               │   WO001: COMPLETED → VERIFIED
                         │              │               │               │            │
                         │              │               │               │            │── Auto close
                         │              │               │               │            │   WO001: VERIFIED → CLOSED
                         │              │               │               │            │
                         │              │               │               │            │── Update equipment
                         │              │               │               │            │   EQ002:
                         │              │               │               │            │   lastMaintenanceDate = today
                         │              │               │               │            │   healthScore recalc
                         │              │               │               │            │
                         │              │               │               │            │── Update spare parts
                         │              │               │               │            │   SP002: qty 3→2 (low_stock!)
                         │              │               │               │            │   SP003: qty 8→6
```

### 4.3. Auto-create Work Order từ Alert

```
Khi alert severity = critical VÀ type = ml_prediction:

  alert-service produce: maintenix.alert.created
    {
      severity: "critical",
      type: "ml_prediction",
      equipmentId: "EQ009",
      recommendedActions: [...]
    }

  workorder-service consume:
    Rule: severity == "critical" → auto-create draft WO
    WO created: {
      title: "[Auto] " + alert.title,
      type: "emergency",
      priority: "P1",
      equipmentId: alert.equipmentId,
      alertId: alert.id,
      status: "draft"           ← cần manager approve
      checklist: auto from recommendedActions
    }

  → notification: "⚠️ Auto-generated WO for critical alert, pending approval"
```

---

## 5. Spare Part Management & Auto-Reorder

> **Trigger:** Work order sử dụng spare parts, stock giảm xuống reorder point
> **End result:** Tự động trigger reorder, track delivery

### Sequence Diagram

```
Technician      workorder-service    equipment-service     Redis           notification
(work order)          │                    │                 │               -service
    │                 │                    │                 │                   │
    │── Complete WO   │                    │                 │                   │
    │   parts used:   │                    │                 │                   │
    │   SP002 × 1     │                    │                 │                   │
    │────────────────→│                    │                 │                   │
    │                 │                    │                 │                   │
    │                 │── Update stock ───→│                 │                   │
    │                 │   SP002: qty 3→2   │                 │                   │
    │                 │                    │                 │                   │
    │                 │                    │── Check ────────│                   │
    │                 │                    │   reorder point │                   │
    │                 │                    │   qty(2) ≤      │                   │
    │                 │                    │   reorderPt(2)  │                   │
    │                 │                    │   → TRIGGER!    │                   │
    │                 │                    │                 │                   │
    │                 │                    │── Update status │                   │
    │                 │                    │   SP002:        │                   │
    │                 │                    │   status=       │                   │
    │                 │                    │   "low_stock"   │                   │
    │                 │                    │                 │                   │
    │                 │                    │── Invalidate ──→│                   │
    │                 │                    │   cache         │ DEL spare:SP002   │
    │                 │                    │                 │                   │
    │                 │                    │── Notify ──────────────────────────→│
    │                 │                    │   "⚠️ SP002 low stock (2/5)"       │
    │                 │                    │   "Suggest reorder: 5 bộ"           │
    │                 │                    │   → email maintenance_manager       │
    │                 │                    │                 │                   │
```

### Stock status rules

```
quantity > reorderPoint × 2       → status: "overstock"   (SP007: 25 > 10)
quantity > reorderPoint           → status: "ok"          (SP001: 12 > 5)
quantity ≤ reorderPoint           → status: "low_stock"   (SP002: 3 ≤ 2 → 2 ≤ 2)
quantity = 0                      → status: "out_of_stock" (SP004: 0)
```

### Ví dụ: SP004 (Dây curoa băng tải A3) — Out of stock impact

```
WO002: "Thay ổ bi motor băng tải A3" (EQ003)
  Technician cần: SP001 (Ổ bi) + SP004 (Dây curoa)

  SP001: qty=12 ✓ Available
  SP004: qty=0  ✗ OUT OF STOCK!

  → WO002 status: IN_PROGRESS → PENDING_PARTS
  → Auto-reorder SP004: 5 sợi, leadTimeDays=10
  → Notification: "WO002 blocked — waiting for SP004 (Dây curoa), ETA 10 ngày"
  → Dashboard KPI: workorder.pendingParts +1
```

---

## 6. Preventive Maintenance Scheduling

> **Trigger:** PM schedule đến hạn, hoặc AI recommend maintenance window
> **End result:** Work order tạo, schedule cập nhật, equipment downtime planned

### 6.1. Time-based PM (Preventive)

```
System               equipment-service     workorder-service    notification
(cron: daily 6AM)          │                     │                -service
    │                      │                     │                    │
    │── Check schedules    │                     │                    │
    │   due within 7 days  │                     │                    │
    │─────────────────────→│                     │                    │
    │                      │                     │                    │
    │                      │── Query:            │                    │
    │                      │   WHERE status =    │                    │
    │                      │   'planned'         │                    │
    │                      │   AND startDate ≤   │                    │
    │                      │   now() + 7d        │                    │
    │                      │                     │                    │
    │                      │   Results:          │                    │
    │                      │   MS004: PM CNC     │                    │
    │                      │   (15 ngày nữa)     │                    │
    │                      │                     │                    │
    │                      │── Create system ───→│                    │
    │                      │   alert: "Sắp đến   │                    │
    │                      │   hạn PM" (ALT006)  │                    │
    │                      │                     │                    │
    │                      │   If startDate ≤    │                    │
    │                      │   now() + 3d:       │                    │
    │                      │   Auto-create WO ──→│                    │
    │                      │   type=preventive   │                    │
    │                      │   from PM template  │                    │
    │                      │                     │── Notify ─────────→│
    │                      │                     │   "WO tạo cho PM"  │
    │                      │                     │   assigned team    │
```

### 6.2. AI-recommended PM (Predictive)

```
ml-service (drift monitor)     equipment-service       Frontend
         │                           │                     │
         │── Detect:                 │                     │
         │   EQ002 health declining  │                     │
         │   trend: -3%/week         │                     │
         │   Recommend PM in 7-10d   │                     │
         │                           │                     │
         │── Kafka (ml.prediction)   │                     │
         │   {type: "pm_recommend",  │                     │
         │    equipmentId: "EQ002",  │                     │
         │    window: "2026-02-28    │                     │
         │     to 2026-03-01",       │                     │
         │    confidence: 94%}       │                     │
         │──────────────────────────→│                     │
         │                           │                     │
         │                           │── Create schedule   │
         │                           │   MS001:            │
         │                           │   isAiRecommended=  │
         │                           │   true              │
         │                           │   confidence=94%    │
         │                           │                     │
         │                           │────────────────────→│
         │                           │   Dashboard:        │
         │                           │   Gantt chart shows │
         │                           │   AI-recommended    │
         │                           │   schedule with     │
         │                           │   confidence badge  │
```

### Ví dụ: Schedule data hiện tại

```
Gantt chart hiển thị trên /maintenance:

Feb 27 ━━━━━━━━ Feb 28 ━━━━━━━━ Mar 01 ━━━━━━━━ Mar 05 ━━━━━━━━ Mar 15 ━━━━
  │                │                │                │                │
  │  MS003 ████████│                │                │                │
  │  Sửa khẩn      │                │                │                │
  │  Động cơ (AI)  │                │                │                │
  │                │                │                │                │
  │                │  MS001 ████████│                │                │
  │                │  Bảo trì M09   │                │                │
  │                │  (AI, 94%)     │                │                │
  │                │                │                │                │
  │                │                │  MS002 ████████│                │
  │                │                │  Kiểm tra DC B │                │
  │                │                │                │                │
  │                │                │                │  MS005 ██      │
  │                │                │                │  Robot lắp ráp │
  │                │                │                │                │
  │                │                │                │                │  MS004 ████
  │                │                │                │                │  PM CNC
  │                │                │                │                │

Legend: ████ = scheduled duration
        (AI) = AI recommended with confidence score
```

---

## 7. AI Model Lifecycle (MLOps)

> **Trigger:** Data scientist register, train, validate, deploy, monitor model
> **End result:** Model deployed serving real-time predictions, with drift monitoring

### State Machine

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        AI Model Lifecycle                                  │
│                                                                            │
│   ┌──────────┐  register   ┌───────────┐  train       ┌────────────┐       │
│   │          │────────────→│           │───complete──→│            │       │
│   │   N/A    │             │  STAGING  │              │  TRAINING  │       │
│   │          │             │           │←──fail───────│            │       │
│   └──────────┘             └─────┬─────┘              └────────────┘       │
│                                  │                                         │
│                            validate│                                       │
│                            (A/B test│ or offline eval)                     │
│                                  │                                         │
│                            ┌─────▼──────┐                                  │
│                            │ VALIDATING │                                  │
│                            └─────┬──────┘                                  │
│                                  │                                         │
│                            pass  │  fail → back to STAGING                 │
│                                  │                                         │
│                    ┌─────────────▼──────────────┐                          │
│                    │          ACTIVE            │←── current model serving │
│                    │  (previous active →        │    predictions           │
│                    │   auto DEPRECATED)         │                          │
│                    └─────────────┬──────────────┘                          │
│                                  │                                         │
│                    drift detected│ or newer version deployed               │
│                                  │                                         │
│                    ┌─────────────▼──────────────┐                          │
│                    │       DEPRECATED           │                          │
│                    │  (still available for      │                          │
│                    │   rollback if needed)      │                          │
│                    └─────────────┬──────────────┘                          │
│                                  │ after 90 days                           │
│                    ┌─────────────▼──────────────┐                          │
│                    │        ARCHIVED            │                          │
│                    └────────────────────────────┘                          │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Ví dụ: MDL001 → MDL005 version transition

```
Timeline:

2025-10    MDL005 (Health Score v3.1.0) deployed, status=ACTIVE
           accuracy=92.1%, driftScore=0.05

2025-12    Drift monitor: driftScore tăng 0.05 → 0.12 → 0.22
           → Alert (internal): "Model drift detected, suggest retraining"
           → Data scientist Hoàng Dũng triggered PL001 (retraining)

2026-01-25 PL001 completed: MDL001 (Health Score v3.2.1) trained
           accuracy=94.2% (improvement +2.1%)
           status=STAGING

2026-01-28 A/B test: 10% traffic → MDL001, 90% → MDL005
           MDL001 p99 latency = 12ms (acceptable)
           MDL001 accuracy online = 94.0% (confirmed)

2026-02-01 Deploy MDL001:
           PUT /api/models/MDL001/deploy
           → MDL001: status = ACTIVE
           → MDL005: status = DEPRECATED (auto)
           → PL004 (Failure Classifier Deploy) pipeline triggered

Current state (from mock data):
  MDL001: Health Score Predictor v3.2.1 — ACTIVE, accuracy 94.2%
  MDL005: Health Score Predictor v3.1.0 — DEPRECATED, drift 0.22
```

### Drift Monitoring Flow

```
ml-service (background, every 1h)       PostgreSQL       notification-service
         │                                   │                    │
         │── Compare current feature         │                    │
         │   distributions vs training       │                    │
         │   distribution                    │                    │
         │                                   │                    │
         │── Calculate drift score:          │                    │
         │   KL divergence / PSI             │                    │
         │   per feature                     │                    │
         │                                   │                    │
         │── Update model record ───────────→│                    │
         │   MDL002: driftScore = 0.12       │                    │
         │                                   │                    │
         │── If driftScore > 0.20:           │                    │
         │   Auto-trigger retrain pipeline   │                    │
         │                                   │                    │
         │── If driftScore > 0.15:           │                    │
         │   Notify data_scientist ──────────────────────────────→│
         │   "⚠️ MDL002 drift=0.12,          │                    │
         │    approaching threshold"         │                    │
```

---

## 8. Authentication & Authorization

> **Trigger:** User login, subsequent API requests
> **End result:** Authenticated session, RBAC-controlled access

### 8.1. Login Flow

```
Browser              Nginx            api-gateway       auth-service       PostgreSQL   Redis    Vault
  │                    │                   │                  │                │           │        │
  │ POST /api/auth/    │                   │                  │                │           │        │
  │ login              │                   │                  │                │           │        │
  │ {username,password}│                   │                  │                │           │        │
  │───────────────────→│                   │                  │                │           │        │
  │                    │──────────────────→│                  │                │           │        │
  │                    │                   │─────────────────→│                │           │        │
  │                    │                   │                  │                │           │        │
  │                    │                   │                  │── Find user ──→│           │        │
  │                    │                   │                  │   WHERE        │           │        │
  │                    │                   │                  │   username=    │           │        │
  │                    │                   │                  │   'engineer'   │           │        │
  │                    │                   │                  │←───────────────│           │        │
  │                    │                   │                  │   User U003    │           │        │
  │                    │                   │                  │                │           │        │
  │                    │                   │                  │── Verify ──┐   │           │        │
  │                    │                   │                  │   bcrypt   │   │           │        │
  │                    │                   │                  │   hash     │   │           │        │
  │                    │                   │                  │←───────────┘   │           │        │
  │                    │                   │                  │   ✓ valid      │           │        │
  │                    │                   │                  │                │           │        │
  │                    │                   │                  │── Get RSA key─────────────────────→ │
  │                    │                   │                  │   private key  │           │        │
  │                    │                   │                  │←─────────────────────────────────── │
  │                    │                   │                  │                │           │        │
  │                    │                   │                  │── Sign JWT ─┐  │           │        │
  │                    │                   │                  │   RS256     │  │           │        │
  │                    │                   │                  │   sub: U003 │  │           │        │
  │                    │                   │                  │   role: eng │  │           │        │
  │                    │                   │                  │   exp: 24h  │  │           │        │
  │                    │                   │                  │←────────────┘  │           │        │
  │                    │                   │                  │                │           │        │
  │                    │                   │                  │── Create session──────────→│        │
  │                    │                   │                  │   session:U003 │  TTL 24h  │        │
  │                    │                   │                  │                │           │        │
  │                    │                   │                  │── Audit log ──→│           │        │
  │                    │                   │                  │   LOGIN        │           │        │
  │                    │                   │                  │                │           │        │
  │                    │                   │←─────────────────│                │           │        │
  │                    │←──────────────────│  {token, refresh,│                │           │        │
  │←───────────────────│                   │   user}          │                │           │        │
  │                    │                   │                  │                │           │        │
  │ Store token        │                   │                  │                │           │        │
  │ (localStorage      │                   │                  │                │           │        │
  │  → production:     │                   │                  │                │           │        │
  │  HttpOnly cookie)  │                   │                  │                │           │        │
```

### 8.2. Authenticated Request Flow

```
Browser              Nginx            api-gateway          auth-service (gRPC)    downstream service
  │                    │                   │                      │                      │
  │ GET /api/equipment │                   │                      │                      │
  │ Authorization:     │                   │                      │                      │
  │ Bearer eyJ...      │                   │                      │                      │
  │───────────────────→│                   │                      │                      │
  │                    │──────────────────→│                      │                      │
  │                    │                   │                      │                      │
  │                    │                   │── gRPC ─────────────→│                      │
  │                    │                   │   ValidateToken      │                      │
  │                    │                   │   (token: "eyJ...")  │                      │
  │                    │                   │                      │                      │
  │                    │                   │←─────────────────────│                      │
  │                    │                   │   {valid: true,      │                      │
  │                    │                   │    userId: "U003",   │                      │
  │                    │                   │    role: "maint_eng",│                      │
  │                    │                   │    perms: [...]}     │                      │
  │                    │                   │                      │                      │
  │                    │                   │── Check RBAC:        │                      │
  │                    │                   │   role=maint_eng     │                      │
  │                    │                   │   endpoint=/api/     │                      │
  │                    │                   │    equipment         │                      │
  │                    │                   │   method=GET         │                      │
  │                    │                   │   → ALLOW ✓          │                      │
  │                    │                   │                      │                      │
  │                    │                   │── Proxy ────────────────────────────────────→│
  │                    │                   │   X-User-ID: U003    │                      │
  │                    │                   │   X-User-Role: eng   │                      │
  │                    │                   │   X-Request-ID: ...  │                      │
  │                    │                   │                      │                      │
  │                    │                   │←────────────────────────────────────────────│
  │                    │←──────────────────│   {data: [...]}      │                      │
  │←───────────────────│                   │                      │                      │
```

### 8.3. RBAC Matrix (route-level)

| Role | Dashboard | Equipment | Sensors | Alerts | Work Orders | Spare Parts | AI Models | Reports | Users | Settings |
|------|-----------|-----------|---------|--------|-------------|-------------|-----------|---------|-------|----------|
| **super_admin** | ✅ R | ✅ RW | ✅ R | ✅ RW | ✅ RW | ✅ RW | ✅ RW | ✅ R | ✅ RW | ✅ RW |
| **factory_manager** | ✅ R | ✅ R | ✅ R | ✅ RW | ✅ RW (approve) | ✅ R | ✅ R | ✅ R | ✅ R | ✅ R |
| **maintenance_manager** | ✅ R | ✅ RW | ✅ R | ✅ RW | ✅ RW (approve) | ✅ RW | ✅ R | ✅ R | ❌ | ✅ R |
| **maintenance_engineer** | ✅ R | ✅ R | ✅ R | ✅ RW (ack/resolve) | ✅ RW (create/execute) | ✅ R | ✅ R | ✅ R | ❌ | ❌ |
| **technician** | ✅ R | ✅ R | ✅ R | ✅ R (ack only) | ✅ RW (execute only) | ✅ R | ❌ | ❌ | ❌ | ❌ |
| **data_scientist** | ✅ R | ✅ R | ✅ R | ✅ R | ❌ | ❌ | ✅ RW | ✅ R | ❌ | ❌ |
| **quality_inspector** | ✅ R | ✅ R | ✅ R | ✅ R | ✅ R (verify only) | ✅ R | ❌ | ✅ R | ❌ | ❌ |
| **viewer** | ✅ R | ✅ R | ✅ R | ✅ R | ✅ R | ✅ R | ❌ | ❌ | ❌ | ❌ |

**Legend:** R = Read, W = Write (create/update/delete), ❌ = No access (hidden from sidebar)

### 8.4. Token Refresh Flow

```
Browser                  api-gateway          auth-service         Redis
  │                          │                     │                 │
  │ GET /api/alerts          │                     │                 │
  │ Authorization: Bearer    │                     │                 │
  │ (EXPIRED token)          │                     │                 │
  │─────────────────────────→│                     │                 │
  │                          │── ValidateToken ───→│                 │
  │                          │←────────────────────│                 │
  │                          │   {valid: false,    │                 │
  │                          │    reason: expired} │                 │
  │                          │                     │                 │
  │←─────────────────────────│                     │                 │
  │ 401 AUTH_TOKEN_EXPIRED   │                     │                 │
  │                          │                     │                 │
  │ POST /api/auth/refresh   │                     │                 │
  │ {refreshToken: "rf_..."} │                     │                 │
  │─────────────────────────→│────────────────────→│                 │
  │                          │                     │── Check ───────→│
  │                          │                     │   refresh token │
  │                          │                     │   exists & valid│
  │                          │                     │←────────────────│
  │                          │                     │   ✓ valid       │
  │                          │                     │                 │
  │                          │                     │── Invalidate ──→│
  │                          │                     │   old refresh   │ DEL
  │                          │                     │                 │
  │                          │                     │── Issue new ─┐  │
  │                          │                     │   JWT + new  │  │
  │                          │                     │   refresh    │  │
  │                          │                     │←─────────────┘  │
  │                          │                     │                 │
  │                          │                     │── Store new ───→│
  │                          │                     │   refresh token│ SET TTL 7d
  │                          │                     │                 │
  │                          │←────────────────────│                 │
  │←─────────────────────────│                     │                 │
  │ {token, refreshToken,    │                     │                 │
  │  expiresIn, user}        │                     │                 │
  │                          │                     │                 │
  │ Retry original request   │                     │                 │
  │ with new token           │                     │                 │
  │─────────────────────────→│                     │                 │
  │←─────────────────────────│                     │                 │
  │ 200 OK (alerts data)     │                     │                 │
```

Frontend implementation (Angular interceptor):

```typescript
// Pseudo-code cho ErrorInterceptor
intercept(req, next) {
  return next.handle(req).pipe(
    catchError(err => {
      if (err.status === 401 && err.error?.code === 'AUTH_TOKEN_EXPIRED') {
        return this.authService.refresh().pipe(
          switchMap(newToken => {
            const retryReq = req.clone({
              headers: req.headers.set('Authorization', `Bearer ${newToken}`)
            });
            return next.handle(retryReq);
          })
        );
      }
      return throwError(err);
    })
  );
}
```

---

## Appendix: Event & Data Cross-reference

### Kafka Events Summary (All Flows)

| Topic | Producer | Consumer(s) | Triggered in Flow |
|-------|----------|-------------|-------------------|
| `maintenix.sensor.raw` | opcua-bridge | sensor-service | Flow 1 |
| `maintenix.sensor.processed` | sensor-service | alert-service, ml-service, equipment-service | Flow 1 → Flow 2, 3 |
| `maintenix.alert.created` | alert-service | notification-svc, api-gateway, workorder-service | Flow 2, 3 → Flow 4 |
| `maintenix.alert.updated` | alert-service | api-gateway (WS push) | Flow 2 |
| `maintenix.ml.prediction` | ml-service | alert-service, equipment-service | Flow 3 → Flow 2, 6 |
| `maintenix.ml.pipeline.status` | ml-service | api-gateway | Flow 7 |
| `maintenix.workorder.created` | workorder-service | notification-service | Flow 4 |
| `maintenix.workorder.updated` | workorder-service | api-gateway, equipment-service | Flow 4 → Flow 5, 6 |
| `maintenix.equipment.status` | equipment-service | api-gateway (WS push) | Flow 4 (post-completion) |
| `maintenix.notification.send` | any service | notification-service | All flows |
| `maintenix.audit.log` | all services | auth-service | Flow 8 (all actions) |

### Entity State Transitions (All Flows)

| Entity | States | Trigger Flows |
|--------|--------|---------------|
| Equipment.status | running → warning → critical → maintenance → running | Flow 1 (health recalc), Flow 4 (WO complete) |
| Alert.status | open → acknowledged → assigned → in_progress → resolved → closed | Flow 2, 3 |
| Alert.status | open → escalated (SLA breach) | Flow 2 |
| WorkOrder.status | draft → submitted → approved → scheduled → assigned → in_progress → completed → verified → closed | Flow 4 |
| WorkOrder.status | in_progress → pending_parts → in_progress | Flow 5 |
| SparePart.status | ok → low_stock → out_of_stock (or reverse on restock) | Flow 5 |
| AIModel.status | staging → training → staging → active → deprecated → archived | Flow 7 |
| Pipeline.status | pending → running → completed / failed | Flow 7 |
| MaintenanceSchedule.status | planned → in_progress → completed / overdue | Flow 6 |

### Mock Data Cross-references

Đây là mối quan hệ giữa các entities trong mock data hiện tại:

```
EQ002 (Máy ép thủy lực M09, healthScore=31, status=critical)
  ├── S004 (Áp suất thủy lực, 185 bar, status=critical)
  ├── S005 (Nhiệt độ dầu, 92°C, status=critical)
  ├── ALT001 (Quá nhiệt, critical, open) ───→ WO001 (Thay dầu, P1, in_progress, 55%)
  ├── ALT007 (Áp suất vượt ngưỡng, critical, in_progress)
  ├── MS001 (Bảo trì dự đoán, AI recommended 94%, in_progress)
  ├── SP002 (Bộ lọc dầu, low_stock: 3→2 after WO001)
  └── SP003 (Dầu thủy lực, ok: 8→6 after WO001)

EQ003 (Băng tải A3, healthScore=68, status=warning)
  ├── S006 (Tốc độ, normal)
  ├── S007 (Rung động motor, 4.2mm/s, warning)
  ├── ALT002 (Rung động bất thường, high, acknowledged by Khoa)
  ├── WO002 (Thay ổ bi, P2, scheduled, assigned Tuấn)
  ├── SP001 (Ổ bi 6208, ok: qty=12)
  └── SP004 (Dây curoa, out_of_stock: qty=0) ← potential WO002 blocker!

EQ009 (Động cơ băng tải chính, healthScore=28, status=critical)
  ├── ALT004 (AI dự đoán hỏng 7d, critical, assigned Tuấn) ← ml_prediction type
  ├── WO005 (Kiểm tra khẩn cấp, P1, assigned Khoa)
  └── MS003 (Sửa khẩn, AI recommended 78%, planned)

EQ004 (Robot hàn #12, healthScore=91, status=running)
  ├── S008 (Nhiệt độ khoang, normal)
  ├── ALT003 (Hiệu suất giảm, medium, open) ← ml_prediction type
  ├── WO003 (Hiệu chuẩn, P3, approved)
  └── MS002 (Kiểm tra định kỳ DC B, planned)

EQ010 (Bộ trao đổi nhiệt B1, healthScore=55, status=maintenance)
  ├── ALT008 (Rò rỉ, high, resolved) ← manual type
  ├── WO006 (Sửa rò rỉ, P2, verified, cost=1,125,000)
  └── SP007 (Gioăng, overstock: qty=25)
```
