# Maintenix — Mock Data Reference

> **Smart Predictive Maintenance Warning System**
> Mô tả toàn bộ dữ liệu mẫu trong frontend (`mock-data.ts`) và backend seed migrations.
> Dùng để: test UI, demo, kiểm tra data khớp frontend ↔ backend.

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Users & Credentials](#2-users--credentials)
3. [Equipment (10 thiết bị)](#3-equipment-10-thiết-bị)
4. [Sensors (12 cảm biến)](#4-sensors-12-cảm-biến)
5. [Alerts (8 cảnh báo)](#5-alerts-8-cảnh-báo)
6. [Work Orders (6 lệnh công việc)](#6-work-orders-6-lệnh-công-việc)
7. [Maintenance Schedules (5 lịch bảo trì)](#7-maintenance-schedules-5-lịch-bảo-trì)
8. [Spare Parts (7 linh kiện)](#8-spare-parts-7-linh-kiện)
9. [AI Models (5 mô hình)](#9-ai-models-5-mô-hình)
10. [Pipelines (4 pipeline)](#10-pipelines-4-pipeline)
11. [KPI Dashboard](#11-kpi-dashboard)
12. [Audit Logs (4 bản ghi)](#12-audit-logs-4-bản-ghi)
13. [Relationships & Cross-references](#13-relationships--cross-references)
14. [Backend Seed Migrations](#14-backend-seed-migrations)

---

## 1. Tổng quan

### 1.1. Thống kê

| Entity | Số lượng | Frontend file | Backend seed migration |
|--------|----------|---------------|------------------------|
| Users | 8 | `MOCK_USERS` | `000005_seed_users_roles.up.sql` |
| Equipment | 10 | `MOCK_EQUIPMENT` | `000004_seed_equipment.up.sql` |
| Sensors | 12 | `MOCK_SENSORS` | `000003_seed_sensors.up.sql` |
| Alerts | 8 | `MOCK_ALERTS` | `000003_seed_alerts.up.sql` |
| Work Orders | 6 | `MOCK_WORK_ORDERS` | `000004_seed_work_orders.up.sql` |
| Maintenance Schedules | 5 | `MOCK_SCHEDULES` | (part of equipment seed) |
| Spare Parts | 7 | `MOCK_SPARE_PARTS` | (part of equipment seed) |
| AI Models | 5 | `MOCK_AI_MODELS` | `000004_seed_models.up.sql` |
| Pipelines | 4 | `MOCK_PIPELINES` | (part of ml seed) |
| Audit Logs | 4 | `MOCK_AUDIT_LOGS` | (generated at runtime) |
| KPI | 1 | `MOCK_KPI` | (aggregated at runtime) |

### 1.2. Source files

```
Frontend:
  src/app/core/mock/mock-data.ts     ← 30KB, tất cả mock data
  src/app/core/models/index.ts       ← TypeScript interfaces

Backend (seed SQL):
  services/auth-service/migrations/000005_seed_users_roles.up.sql
  services/equipment-service/migrations/000004_seed_equipment.up.sql
  services/sensor-service/migrations/000003_seed_sensors.up.sql
  services/alert-service/migrations/000003_seed_alerts.up.sql
  services/workorder-service/migrations/000004_seed_work_orders.up.sql
  services/ml-service/migrations/000004_seed_models.up.sql
```

### 1.3. ID Conventions

| Entity | Prefix | Format | Ví dụ |
|--------|--------|--------|-------|
| User | U | U + 3 digits | U001, U008 |
| Equipment | EQ | EQ + 3 digits | EQ001, EQ010 |
| Sensor | S | S + 3 digits | S001, S012 |
| Alert | ALT | ALT + 3 digits | ALT001, ALT008 |
| Work Order | WO | WO + 3 digits | WO001, WO006 |
| WO Number | WO- | WO-YYYY-NNNN | WO-2026-0145 |
| Maintenance Schedule | MS | MS + 3 digits | MS001, MS005 |
| Spare Part | SP | SP + 3 digits | SP001, SP007 |
| AI Model | MDL | MDL + 3 digits | MDL001, MDL005 |
| Pipeline | PL | PL + 3 digits | PL001, PL004 |
| Audit Log | AUD | AUD + 3 digits | AUD001, AUD004 |
| Asset ID | — | Building-Type-Seq | A-CNC-001 |
| Part Number | — | Category-Detail | BRG-6208-2RS |

---

## 2. Users & Credentials

**8 users, tất cả password: `123456`**

| ID | Username | Full Name | Role | Department | Phone | Skills |
|----|----------|-----------|------|------------|-------|--------|
| U001 | `admin` | Nguyễn Văn Admin | super_admin | IT | 0901234567 | — |
| U002 | `manager` | Trần Thị Lan | factory_manager | Quản lý Nhà máy | 0912345678 | — |
| U003 | `engineer` | Lê Minh Khoa | maintenance_engineer | Bảo trì | 0923456789 | PLC, Hydraulics, CNC |
| U004 | `technician` | Phạm Anh Tuấn | technician | Bảo trì | 0934567890 | Welding, Electrical |
| U005 | `datascientist` | Hoàng Dũng | data_scientist | AI/ML | 0945678901 | Python, TensorFlow, SageMaker |
| U006 | `inspector` | Ngô Thị Mai | quality_inspector | QC | 0956789012 | — |
| U007 | `viewer` | Đào Thanh Sơn | viewer | Sản xuất | 0967890123 | — |
| U008 | `maint_mgr` | Vũ Đình Hùng | maintenance_manager | Bảo trì | 0978901234 | — |

### Sidebar visibility theo role

| Menu item | admin | manager | maint_mgr | engineer | technician | datascientist | inspector | viewer |
|-----------|-------|---------|-----------|----------|------------|---------------|-----------|--------|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Equipment | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sensors | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Alerts | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Work Orders | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Maintenance | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Spare Parts | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| AI Models | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Reports | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Users | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Settings | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 3. Equipment (10 thiết bị)

### 3.1. Danh sách tổng quan

| ID | Asset ID | Tên | Loại | Hãng SX | Năm SX | Nhà xưởng | Dây chuyền | Status | Health |
|----|----------|-----|------|---------|--------|------------|------------|--------|--------|
| EQ001 | A-CNC-001 | Máy CNC Fanuc #01 | cnc_machine | Fanuc | 2021 | Nhà xưởng A | Dây chuyền A | 🟢 running | 84% |
| EQ002 | A-PRS-002 | Máy ép thủy lực M09 | press | Komatsu | 2019 | Nhà xưởng A | Dây chuyền A | 🔴 critical | 31% |
| EQ003 | A-CVR-003 | Băng tải A3 | conveyor | Siemens | 2020 | Nhà xưởng A | Dây chuyền A | 🟡 warning | 68% |
| EQ004 | B-RBT-004 | Robot hàn #12 | robot | ABB | 2022 | Nhà xưởng B | Dây chuyền B | 🟢 running | 91% |
| EQ005 | A-CMP-005 | Máy nén khí Atlas | compressor | Atlas Copco | 2018 | Nhà xưởng A | Chung | 🟡 warning | 72% |
| EQ006 | B-RBT-006 | Robot lắp ráp #05 | robot | KUKA | 2023 | Nhà xưởng B | Dây chuyền B | 🟢 running | 95% |
| EQ007 | A-PMP-007 | Bơm chân không VP-3 | pump | Grundfos | 2020 | Nhà xưởng A | Dây chuyền A | 🟢 running | 82% |
| EQ008 | C-GEN-008 | Máy phát điện dự phòng | generator | Cummins | 2017 | Nhà phụ trợ | Hạ tầng | ⚪ idle | 88% |
| EQ009 | A-MTR-009 | Động cơ băng tải chính | motor | ABB | 2019 | Nhà xưởng A | Dây chuyền A | 🔴 critical | 28% |
| EQ010 | B-HEX-010 | Bộ trao đổi nhiệt B1 | heat_exchanger | Alfa Laval | 2021 | Nhà xưởng B | Dây chuyền B | 🔧 maintenance | 55% |

### 3.2. Phân bố

```
Theo status:      running=4, idle=1, warning=2, critical=2, maintenance=1
Theo nhà xưởng:   Nhà xưởng A=6, Nhà xưởng B=3, Nhà phụ trợ=1
Theo dây chuyền:  Dây chuyền A=5, Dây chuyền B=3, Chung=1, Hạ tầng=1
Theo loại:        robot=2, temperature-related=3, mechanical=3, utility=2
```

### 3.3. Chi tiết specs

| ID | Power | Rated Speed | Max Temp | Max Pressure |
|----|-------|-------------|----------|--------------|
| EQ001 | 15kW | 24000 RPM | 90°C | — |
| EQ002 | 45kW | — | — | 200 bar |
| EQ003 | 5.5kW | 150 RPM | — | — |
| EQ004 | 7.5kW | — | — | — |
| EQ005 | 37kW | — | — | 13 bar |
| EQ006 | 5kW | — | — | — |
| EQ007 | 11kW | — | — | — |
| EQ008 | 500kVA | — | — | — |
| EQ009 | 132kW | 1485 RPM | — | — |
| EQ010 | 3kW | — | 150°C | — |

### 3.4. Coordinates (Factory Map)

```
Nhà xưởng A (Dây chuyền A):
  EQ001 CNC      (10.8231, 106.6297)  Trạm A-01
  EQ002 Máy ép   (10.8225, 106.6305)  Trạm A-03
  EQ003 Băng tải  (10.8238, 106.6288)  Trạm A-05
  EQ007 Bơm      (10.8235, 106.6295)  Trạm A-08
  EQ009 Động cơ   (—, —)              Trạm A-10

Nhà xưởng A (Chung):
  EQ005 Máy nén   (10.8220, 106.6292)  Phòng máy nén

Nhà xưởng B (Dây chuyền B):
  EQ004 Robot hàn  (10.8245, 106.6300)  Trạm B-02
  EQ006 Robot lắp  (10.8250, 106.6310)  Trạm B-05
  EQ010 Trao đổi   (—, —)              Trạm B-08

Nhà phụ trợ:
  EQ008 Máy phát   (—, —)              Phòng máy phát
```

---

## 4. Sensors (12 cảm biến)

### 4.1. Danh sách

| ID | Equipment | Tên | Type | Unit | Current | Warning High | Critical High | Status |
|----|-----------|-----|------|------|---------|-------------|--------------|--------|
| S001 | EQ001 | Nhiệt độ vòng bi | temperature | °C | 78 | 80 | 90 | 🟡 warning |
| S002 | EQ001 | Rung động trục X | vibration | mm/s | 2.8 | 3 | 5 | 🟢 normal |
| S003 | EQ001 | Dòng điện động cơ | current | A | 15.8 | 20 | 25 | 🟢 normal |
| S004 | EQ002 | Áp suất thủy lực | pressure | bar | **185** | 180 | 200 | 🔴 critical |
| S005 | EQ002 | Nhiệt độ dầu | temperature | °C | **92** | 85 | 95 | 🔴 critical |
| S006 | EQ003 | Tốc độ băng tải | rpm | RPM | 120 | 160 | 190 | 🟢 normal |
| S007 | EQ003 | Rung động motor | vibration | mm/s | **4.2** | 3.5 | 5 | 🟡 warning |
| S008 | EQ004 | Nhiệt độ khoang | temperature | °C | 45 | 60 | 75 | 🟢 normal |
| S009 | EQ005 | Áp suất nén | pressure | bar | 8.2 | 10 | 11.5 | 🟢 normal |
| S010 | EQ005 | Nhiệt độ khí nén | temperature | °C | **88** | 85 | 95 | 🟡 warning |
| S011 | EQ006 | Dòng servo | current | A | 5.1 | 7 | 9 | 🟢 normal |
| S012 | EQ007 | Lưu lượng nước | flow_rate | L/min | 45 | 65 | 75 | 🟢 normal |

**Bold** = giá trị vượt ngưỡng warning hoặc critical.

### 4.2. Phân bố

```
Theo equipment:
  EQ001: 3 sensors (S001, S002, S003)
  EQ002: 2 sensors (S004, S005)
  EQ003: 2 sensors (S006, S007)
  EQ004: 1 sensor  (S008)
  EQ005: 2 sensors (S009, S010)
  EQ006: 1 sensor  (S011)
  EQ007: 1 sensor  (S012)
  EQ008-EQ010: 0 sensors (mock chưa có)

Theo status:  normal=7, warning=3, critical=2
Theo type:    temperature=4, vibration=2, pressure=2, current=2, rpm=1, flow_rate=1
```

### 4.3. Sparkline generation

Mỗi sensor có `sparklineData`: 20 points sinh bởi `genSparkline(base, variance, trend)`:

| Sensor | base | variance | trend | Giải thích |
|--------|------|----------|-------|-----------|
| S001 | 72 | 8 | **+0.3** | Nhiệt vòng bi trending UP (nóng dần) |
| S002 | 2.2 | 1 | +0.05 | Rung nhẹ tăng |
| S003 | 14 | 3 | 0 | Dòng ổn định |
| S004 | 170 | 15 | **+0.8** | Áp suất tăng NHANH (nguy hiểm) |
| S005 | 82 | 10 | **+0.5** | Nhiệt dầu tăng nhanh |
| S006 | 120 | 10 | 0 | Tốc độ ổn định |
| S007 | 3.5 | 1.5 | +0.05 | Rung tăng nhẹ |
| S008 | 44 | 5 | 0 | Nhiệt khoang ổn định |
| S009 | 8 | 1.5 | 0 | Áp suất ổn định |
| S010 | 80 | 10 | **+0.4** | Nhiệt khí nén trending UP |
| S011 | 5 | 1 | 0 | Dòng servo ổn định |
| S012 | 44 | 8 | 0 | Lưu lượng ổn định |

### 4.4. Time-series helper

`generateTimeSeriesData(hours, baseValue, variance)` tạo data cho chart:
- Tạo `hours + 1` data points (1 per hour)
- Format: `{ time: "HH:mm", value: number }`
- Value = `baseValue + random(±variance) + sin(i/4) * variance/3`
- Sin wave tạo pattern realistic (cycle ngày/đêm)

---

## 5. Alerts (8 cảnh báo)

### 5.1. Danh sách

| ID | Equipment | Severity | Type | Title | Status | Assigned |
|----|-----------|----------|------|-------|--------|----------|
| ALT001 | EQ002 Máy ép M09 | 🔴 critical | sensor_threshold | Quá nhiệt độ vòng bi | open | — |
| ALT002 | EQ003 Băng tải A3 | 🟠 high | sensor_threshold | Rung động bất thường | acknowledged | Khoa |
| ALT003 | EQ004 Robot hàn | 🟡 medium | **ml_prediction** | Hiệu suất giảm dần | open | — |
| ALT004 | EQ009 Động cơ BT | 🔴 critical | **ml_prediction** | Dự đoán hỏng 7 ngày | assigned | Tuấn |
| ALT005 | EQ005 Máy nén khí | 🟡 medium | sensor_threshold | Nhiệt khí nén cao | open | — |
| ALT006 | EQ001 CNC Fanuc | 🔵 low | system | Sắp đến hạn PM | open | — |
| ALT007 | EQ002 Máy ép M09 | 🔴 critical | sensor_threshold | Áp suất vượt ngưỡng | in_progress | Khoa |
| ALT008 | EQ010 Trao đổi nhiệt | 🟠 high | manual | Phát hiện rò rỉ | ✅ resolved | — |

### 5.2. Phân bố

```
Theo severity:     critical=3, high=2, medium=2, low=1
Theo type:         sensor_threshold=4, ml_prediction=2, system=1, manual=1
Theo status:       open=4, acknowledged=1, assigned=1, in_progress=1, resolved=1
Theo dây chuyền:   Dây chuyền A=5, Dây chuyền B=2, Chung=1
```

### 5.3. AI-enriched alerts (4 alerts có aiExplanation)

**ALT001 — Quá nhiệt M09 (Critical):**
```
aiExplanation: "Bộ lọc dầu bị tắc nghẽn 60%, kết hợp nhiệt độ môi trường
               cao gây quá tải hệ thống làm mát"
contributingFactors:
  Bộ lọc dầu tắc nghẽn  ━━━━━━━━━━━━━━━━━━━ 45%
  Nhiệt độ môi trường   ━━━━━━━━━━━━        25%
  Tải trọng hoạt động    ━━━━━━━━           20%
  Tuổi thọ dầu           ━━━━               10%
recommendedActions:
  1. Thay bộ lọc dầu thủy lực
  2. Kiểm tra hệ thống làm mát
  3. Giảm tải vận hành 20%
```

**ALT002 — Rung động A3 (High):**
```
aiExplanation: "Mô hình ML dự đoán ổ bi motor bắt đầu hao mòn, hỏng trong 14 ngày"
contributingFactors:
  Ổ bi hao mòn         ━━━━━━━━━━━━━━━━━━━━━━ 55%
  Mất cân bằng rotor   ━━━━━━━━━━━━           30%
  Lỏng chân đế          ━━━━━━                15%
```

**ALT003 — Robot hàn hiệu suất giảm (Medium):**
```
aiExplanation: "Đầu hàn bắt đầu mòn, cần hiệu chuẩn lại"
contributingFactors:
  Mòn đầu hàn          ━━━━━━━━━━━━━━━━━━━━━━━━ 60%
  Drift hiệu chuẩn     ━━━━━━━━━━━━           30%
  Chất lượng gas        ━━━━                   10%
```

**ALT004 — Dự đoán hỏng EQ009 (Critical):**
```
aiExplanation: "Kết hợp: rung động tăng, nhiệt cuộn dây tăng, dòng điện bất thường"
contributingFactors:
  Cách điện cuộn dây suy giảm ━━━━━━━━━━━━━━━━ 40%
  Rung động tăng               ━━━━━━━━━━━━━━  35%
  Nhiệt độ cao kéo dài         ━━━━━━━━━━      25%
```

### 5.4. SLA configuration

| Severity | Response time | Resolution time |
|----------|-------------|-----------------|
| critical | 30 phút | 4 giờ |
| high | 60 phút | 8 giờ |
| medium | 4 giờ | 24 giờ |
| low | 8 giờ | 72 giờ |
| info | — | — |

ALT001 có `slaDeadline`: dynamic `Date.now() + 55 phút`.

---

## 6. Work Orders (6 lệnh công việc)

### 6.1. Danh sách

| ID | WO Number | Title | Type | Priority | Status | Equipment | Assigned | Completion |
|----|-----------|-------|------|----------|--------|-----------|----------|------------|
| WO001 | WO-2026-0145 | Thay dầu thủy lực M09 | corrective | **P1** | 🔵 in_progress | EQ002 | Khoa | 55% |
| WO002 | WO-2026-0146 | Thay ổ bi motor băng tải A3 | predictive | P2 | 📅 scheduled | EQ003 | Tuấn | 0% |
| WO003 | WO-2026-0147 | Hiệu chuẩn Robot hàn #12 | predictive | P3 | ✅ approved | EQ004 | Tuấn | 0% |
| WO004 | WO-2026-0143 | Bảo trì định kỳ máy nén khí | preventive | P3 | ✅ completed | EQ005 | Tuấn | 100% |
| WO005 | WO-2026-0148 | Kiểm tra khẩn cấp động cơ BT | emergency | **P1** | 👤 assigned | EQ009 | Khoa | 0% |
| WO006 | WO-2026-0144 | Sửa chữa rò rỉ trao đổi nhiệt | corrective | P2 | ✅ verified | EQ010 | Tuấn | 100% |

### 6.2. Phân bố

```
Theo type:     corrective=2, predictive=2, preventive=1, emergency=1
Theo priority: P1=2, P2=2, P3=2
Theo status:   in_progress=1, scheduled=1, approved=1, completed=1, assigned=1, verified=1
Theo assignee: Khoa (U003)=2, Tuấn (U004)=4
```

### 6.3. Cost tracking (chỉ WO đã/đang thực hiện)

| WO | Labor Cost | Parts Cost | Total Cost | Hours (est/actual) |
|----|-----------|-----------|-----------|-------------------|
| WO001 | 1,500,000₫ | 8,500,000₫ | 10,000,000₫ | 6h / 3h (đang làm) |
| WO004 | 1,125,000₫ | 3,200,000₫ | 4,325,000₫ | 5h / 4.5h |
| WO006 | 625,000₫ | 500,000₫ | 1,125,000₫ | 3h / 2.5h |
| **Tổng** | **3,250,000₫** | **12,200,000₫** | **15,450,000₫** | |

### 6.4. WO001 Checklist chi tiết

```
WO001: Thay dầu thủy lực máy ép M09
  Created by: Trần Thị Lan (Factory Manager)
  Alert link: ALT001

  [✅] CK1: Xả dầu cũ        — Khoa, ~2h ago
  [✅] CK2: Thay bộ lọc       — Khoa
  [  ] CK3: Đổ dầu mới
  [  ] CK4: Kiểm tra áp suất
  [  ] CK5: Chạy thử

  Progress: 2/5 items ≈ 55% (actual field: completionRate=55)
```

### 6.5. Alert ↔ Work Order links

| Work Order | Linked Alert | Mối quan hệ |
|------------|-------------|-------------|
| WO001 | ALT001 (Quá nhiệt M09) | Alert → Manager tạo WO corrective |
| WO002 | ALT002 (Rung động A3) | AI warning → Engineer tạo WO predictive |
| WO005 | ALT004 (Dự đoán hỏng EQ009) | ML prediction → Manager tạo WO emergency |
| WO003, WO004, WO006 | — | Manual/scheduled, không từ alert |

---

## 7. Maintenance Schedules (5 lịch bảo trì)

### 7.1. Danh sách

| ID | Title | Type | Equipment | Line | Start | End | Team | Status | AI? | Conf |
|----|-------|------|-----------|------|-------|-----|------|--------|-----|------|
| MS001 | Bảo trì dự đoán M09 | predictive | EQ002 | DC A | Feb 28 | Mar 01 | Team A | 🔵 in_progress | ✅ | 94% |
| MS002 | Kiểm tra định kỳ DC B | preventive | EQ004 | DC B | Mar 01 | Mar 02 | Team B | 📅 planned | ❌ | — |
| MS003 | Sửa khẩn Động cơ BT | emergency | EQ009 | DC A | Feb 27 | Feb 28 | Team A | 📅 planned | ✅ | 78% |
| MS004 | PM Quý 1 Máy CNC | preventive | EQ001 | DC A | Mar 15 | Mar 16 | Team A | 📅 planned | ❌ | — |
| MS005 | Hiệu chuẩn Robot lắp ráp | preventive | EQ006 | DC B | Mar 05 | Mar 05 | Team B | 📅 planned | ❌ | — |

### 7.2. Gantt timeline

```
Feb 27      Feb 28      Mar 01      Mar 05      Mar 15      Mar 16
  │           │           │           │           │           │
  ├─MS003─────┤           │           │           │           │
  │ Emergency │           │           │           │           │
  │ EQ009 AI  │           │           │           │           │
  │           ├─MS001─────┤           │           │           │
  │           │Predictive │           │           │           │
  │           │EQ002 AI94 │           │           │           │
  │           │           ├─MS002─────┤           │           │
  │           │           │Preventive │           │           │
  │           │           │ EQ004     │           │           │
  │           │           │           ├MS005      │           │
  │           │           │           │Preventive │           │
  │           │           │           │EQ006      │           │
  │           │           │           │           ├─MS004─────┤
  │           │           │           │           │PM Q1 CNC  │
  │           │           │           │           │ EQ001     │
```

---

## 8. Spare Parts (7 linh kiện)

### 8.1. Danh sách

| ID | Part Number | Name | Category | Qty | Reorder Pt | Price (₫) | Status | ABC | Compatible |
|----|-------------|------|----------|-----|-----------|-----------|--------|-----|------------|
| SP001 | BRG-6208-2RS | Ổ bi 6208-2RS | Bearing | 12 | 5 | 850,000 | 🟢 ok | A | EQ003, EQ009 |
| SP002 | FLT-HYD-M09 | Bộ lọc dầu M09 | Filter | 3 | 2 | 2,500,000 | 🟡 low_stock | A | EQ002 |
| SP003 | OIL-HYD-46 | Dầu thủy lực ISO 46 | Lubricant | 8 | 3 | 1,800,000 | 🟢 ok | B | EQ002, EQ007 |
| SP004 | BLT-CVR-A3 | Dây curoa băng tải A3 | Belt | **0** | 2 | 4,500,000 | 🔴 out_of_stock | A | EQ003 |
| SP005 | WLD-TIP-IRB | Đầu hàn ABB IRB | Consumable | 15 | 5 | 3,200,000 | 🟢 ok | B | EQ004 |
| SP006 | FLT-AIR-GA37 | Lọc gió máy nén GA37 | Filter | 6 | 3 | 950,000 | 🟢 ok | B | EQ005 |
| SP007 | SEAL-HEX-M10 | Gioăng trao đổi nhiệt | Seal | **25** | 5 | 12,000,000 | 🟣 overstock | A | EQ010 |

### 8.2. Inventory value

| Part | Qty × Price | Value |
|------|------------|-------|
| SP001 | 12 × 850K | 10,200,000₫ |
| SP002 | 3 × 2,500K | 7,500,000₫ |
| SP003 | 8 × 1,800K | 14,400,000₫ |
| SP004 | 0 × 4,500K | 0₫ |
| SP005 | 15 × 3,200K | 48,000,000₫ |
| SP006 | 6 × 950K | 5,700,000₫ |
| SP007 | 25 × 12,000K | 300,000,000₫ |
| **Total** | | **385,800,000₫** |

### 8.3. Lead times

```
 3 ngày:  SP003 Dầu thủy lực (local supplier)
 7 ngày:  SP001 Ổ bi SKF
10 ngày:  SP004 Dây curoa Gates
14 ngày:  SP002 Bộ lọc Komatsu (OEM), SP006 Lọc gió Atlas Copco (OEM)
21 ngày:  SP005 Đầu hàn ABB (import)
30 ngày:  SP007 Gioăng Alfa Laval (import EU)
```

### 8.4. Stock status rules

```
quantity > reorderPoint × 2       → "overstock"    (SP007: 25 > 10)
quantity > reorderPoint           → "ok"           (SP001: 12 > 5)
quantity ≤ reorderPoint           → "low_stock"    (SP002: 3 ≤ 2 → triggered)
quantity = 0                      → "out_of_stock" (SP004)
```

---

## 9. AI Models (5 mô hình)

### 9.1. Danh sách

| ID | Name | Version | Type | Status | Accuracy | F1 | Drift | Deployed |
|----|------|---------|------|--------|----------|----|-------|----------|
| MDL001 | Health Score Predictor | v3.2.1 | health_score | 🟢 active | 94.2% | 93.5% | 0.08 | Feb 01 |
| MDL002 | RUL Estimator | v2.1.0 | rul | 🟢 active | 89.1% | 87.8% | 0.12 | Jan 15 |
| MDL003 | Failure Mode Classifier | v1.5.3 | failure_prediction | 🟢 active | 91.8% | 91.2% | 0.15 | Jan 20 |
| MDL004 | Anomaly Detector LSTM | v4.0.0 | anomaly_detection | 🟡 staging | 95.6% | 94.9% | 0 | — |
| MDL005 | Health Score Predictor (Old) | v3.1.0 | health_score | ⚪ deprecated | 92.1% | 91.4% | **0.22** | Nov 01 '25 |

### 9.2. Model features

```
MDL001 (Health Score v3.2.1):   temperature, vibration, current, pressure, runtime_hours
MDL002 (RUL v2.1.0):            vibration_trend, temperature_trend, maintenance_history, age, load_factor
MDL003 (Failure Mode v1.5.3):   vibration_spectrum, temperature_pattern, acoustic_signature
MDL004 (Anomaly v4.0.0):        multivariate_sensor_data
MDL005 (Health Score OLD v3.1.0):temperature, vibration, current, pressure  ← ít hơn MDL001 (thiếu runtime_hours)
```

### 9.3. Version history story

```
MDL005 v3.1.0 (deployed Nov 2025, accuracy=92.1%)
  │ drift tăng dần: 0.05 → 0.12 → 0.22 (vượt threshold 0.20)
  │ → trigger retraining PL001
  ▼
MDL001 v3.2.1 (deployed Feb 2026, accuracy=94.2%, +2.1% improvement)
  │ Added feature: runtime_hours
  │ drift=0.08 (healthy)

MDL004 v4.0.0 (staging, accuracy=95.6% — highest of all models)
  │ LSTM architecture, multivariate input
  │ Đang A/B test trước khi deploy
```

---

## 10. Pipelines (4 pipeline)

| ID | Name | Type | Model | Status | Progress | Triggered By | Duration |
|----|------|------|-------|--------|----------|-------------|----------|
| PL001 | Health Score Retraining | train | MDL001 | ✅ completed | 100% | Hoàng Dũng | 2.5h |
| PL002 | Anomaly Detector Training | train | MDL004 | 🔵 running | 72% | Auto-scheduler | — |
| PL003 | RUL Model Evaluation | evaluate | MDL002 | ✅ completed | 100% | Hoàng Dũng | 45min |
| PL004 | Failure Classifier Deploy | deploy | MDL003 | ✅ completed | 100% | Hoàng Dũng | 15min |

### Pipeline metrics

```
PL001 (train): accuracy=0.942, f1=0.935, loss=0.058
PL003 (eval):  accuracy=0.891, mae=12.3, rmse=18.7 (days — prediction error ±12-18d)
PL002 (train): 72% done, metrics chưa có
PL004 (deploy): không có metrics (chỉ deploy)
```

---

## 11. KPI Dashboard

### 11.1. KPI values

| Metric | Value | Trend | Unit |
|--------|-------|-------|------|
| OEE | 86.5 | +2.1 | % |
| MTTR | 2.4 | -0.3 (tốt hơn) | hours |
| Open Alerts | 18 | — | count |
| Critical Alerts | 4 | — | count |
| Uptime | 98.2 | — | % |
| Cost Savings | 214,000 | — | USD |
| Total Equipment | 62 | — | count |
| Online Equipment | 57 | — | count |

> **Lưu ý:** KPI dùng scale lớn hơn mock lists (62 equipment vs 10 mock) — KPI đại diện toàn nhà máy thực tế, mock lists chỉ sample.

### 11.2. Report generators

**OEE History** (`getOEEHistory`, 31 ngày):
```
Mỗi ngày: {
  date: "YYYY-MM-DD",
  availability: 90 + random(0-8) %,
  performance: 85 + random(0-10) %,
  quality: 95 + random(0-4) %,
  oee: (A × P × Q) / 10000
}
Typical OEE range: 76-89%
```

**Maintenance Cost** (`getMaintenanceCostHistory`, 6 tháng):

| Month | Preventive | Corrective | Predictive |
|-------|-----------|-----------|-----------|
| 09/2025 | 45,000,000₫ | 78,000,000₫ | 12,000,000₫ |
| 10/2025 | 48,000,000₫ | 62,000,000₫ | 18,000,000₫ |
| 11/2025 | 42,000,000₫ | 55,000,000₫ | 25,000,000₫ |
| 12/2025 | 50,000,000₫ | 48,000,000₫ | 30,000,000₫ |
| 01/2026 | 46,000,000₫ | 42,000,000₫ | 35,000,000₫ |
| 02/2026 | 44,000,000₫ | 38,000,000₫ | 32,000,000₫ |

```
Trend insight:
  Corrective: 78M → 38M (giảm 51%)  ← ít sự cố hơn
  Predictive: 12M → 32M (tăng 167%) ← đầu tư dự đoán
  → ROI: chuyển chi phí từ "sửa khi hỏng" sang "dự đoán trước khi hỏng"
```

---

## 12. Audit Logs (4 bản ghi)

| ID | User | Action | Resource | Details | Time ago |
|----|------|--------|----------|---------|----------|
| AUD001 | Khoa (U003) | ACKNOWLEDGE_ALERT | Alert/ALT002 | Acknowledged: Rung động bất thường | ~10 min |
| AUD002 | Lan (U002) | CREATE_WORK_ORDER | WorkOrder/WO005 | Created emergency WO for Động cơ BT | ~6h |
| AUD003 | Dũng (U005) | TRIGGER_PIPELINE | Pipeline/PL002 | Triggered Anomaly Detector Training | ~12h |
| AUD004 | Admin (U001) | UPDATE_USER | User/U004 | Updated certifications for Tuấn | ~24h |

---

## 13. Relationships & Cross-references

### 13.1. Entity Relationship Map

```
┌─────────┐ 1    N ┌──────────┐ 1    N ┌───────────────┐
│  User   │────────│WorkOrder │────────│ ChecklistItem │
│  (8)    │assignTo│  (6)     │ has    │               │
└────┬────┘        └────┬─────┘        └───────────────┘
     │                  │ 1
     │ createdBy        │ equipmentId
     │                  │
     │             N    │    1
     │  ┌───────────────┘
     │  │
     │  ▼
     │ ┌──────────┐ 1    N ┌─────────┐
     │ │Equipment │────────│ Sensor  │
     │ │  (10)    │ has    │  (12)   │
     │ └────┬─────┘        └─────────┘
     │      │ 1
     │      │          N
     │      ├──────────── Alert (8)
     │      │
     │      ├──────────── MaintenanceSchedule (5)
     │      │
     │      └──────────── SparePart (7) [many-to-many via compatibleEquipment]
     │
     │            ┌──────────┐ 1    N ┌──────────┐
     └────────────│ AIModel  │────────│ Pipeline │
       triggeredBy│  (5)     │modelId │  (4)     │
                  └──────────┘        └──────────┘
```

### 13.2. "Hot spot" equipment — Cross-reference chi tiết

**EQ002 (Máy ép thủy lực M09) — MOST CRITICAL:**
```
├── Health Score: 31% (lowest among running equipment)
├── Status: critical
├── Sensors:
│   ├── S004 (Áp suất thủy lực): 185 bar → critical (> warningHigh 180)
│   └── S005 (Nhiệt độ dầu): 92°C → critical (> warningHigh 85)
├── Alerts:
│   ├── ALT001 (Quá nhiệt, critical, open, SLA 30min)
│   └── ALT007 (Áp suất vượt ngưỡng, critical, in_progress, assigned Khoa)
├── Work Orders:
│   └── WO001 (Thay dầu, P1, in_progress, 55%, cost 10M₫)
├── Schedule:
│   └── MS001 (Bảo trì dự đoán, AI recommended 94%, in_progress)
└── Parts needed:
    ├── SP002 (Bộ lọc dầu): low_stock (qty=3, reorder triggered)
    └── SP003 (Dầu thủy lực): ok (qty=8)
```

**EQ009 (Động cơ băng tải chính) — AI FLAGGED:**
```
├── Health Score: 28% (LOWEST overall)
├── Status: critical
├── Sensors: (none in mock — production sẽ có)
├── Alerts:
│   └── ALT004 (AI dự đoán hỏng 7d, critical, assigned Tuấn)
├── Work Orders:
│   └── WO005 (Kiểm tra khẩn cấp, P1 emergency, assigned Khoa)
├── Schedule:
│   └── MS003 (Sửa khẩn, AI recommended 78%, planned)
└── Parts needed:
    └── SP001 (Ổ bi 6208): ok (qty=12, compatible)
```

**EQ003 (Băng tải A3) — WATCH LIST:**
```
├── Health Score: 68%
├── Status: warning
├── Sensors:
│   ├── S006 (Tốc độ): normal (120 RPM)
│   └── S007 (Rung động motor): warning (4.2mm/s > warningHigh 3.5)
├── Alerts:
│   └── ALT002 (Rung động bất thường, high, acknowledged by Khoa)
├── Work Orders:
│   └── WO002 (Thay ổ bi, P2, scheduled, assigned Tuấn)
└── Parts needed:
    ├── SP001 (Ổ bi): ok (qty=12)
    └── SP004 (Dây curoa): ⚠️ OUT OF STOCK (qty=0) — potential WO blocker!
```

**EQ004 (Robot hàn #12) — AI MONITORING:**
```
├── Health Score: 91% (good)
├── Status: running
├── Sensors:
│   └── S008 (Nhiệt độ khoang): normal (45°C)
├── Alerts:
│   └── ALT003 (Hiệu suất giảm, medium, ml_prediction, open)
├── Work Orders:
│   └── WO003 (Hiệu chuẩn, P3, approved, assigned Tuấn)
├── Schedule:
│   └── MS002 (Kiểm tra định kỳ DC B, planned)
└── Parts needed:
    └── SP005 (Đầu hàn ABB): ok (qty=15)
```

**EQ005 (Máy nén khí Atlas) — WARNING:**
```
├── Health Score: 72%
├── Status: warning
├── Sensors:
│   ├── S009 (Áp suất nén): normal (8.2 bar)
│   └── S010 (Nhiệt khí nén): warning (88°C > warningHigh 85)
├── Alerts:
│   └── ALT005 (Nhiệt khí nén cao, medium, open)
├── Work Orders:
│   └── WO004 (PM định kỳ, completed, cost 4.3M₫)
└── Parts needed:
    └── SP006 (Lọc gió): ok (qty=6)
```

**EQ010 (Bộ trao đổi nhiệt B1) — RESOLVED:**
```
├── Health Score: 55%
├── Status: maintenance (đang bảo trì)
├── Alerts:
│   └── ALT008 (Rò rỉ, high, manual, resolved)
├── Work Orders:
│   └── WO006 (Sửa rò rỉ, P2, verified, cost 1.1M₫)
└── Parts:
    └── SP007 (Gioăng): overstock (qty=25)
```

**EQ001, EQ006, EQ007, EQ008 — HEALTHY:**
```
EQ001 CNC Fanuc:     health=84%, 3 sensors (1 warning), ALT006 (low, PM reminder)
EQ006 Robot lắp ráp: health=95%, 1 sensor (normal), MS005 (PM planned)
EQ007 Bơm chân không: health=82%, 1 sensor (normal), no issues
EQ008 Máy phát điện: health=88%, idle, no sensors, no issues
```

### 13.3. User workload

```
Lê Minh Khoa (U003, maintenance_engineer):
  ├── ALT002: acknowledged (Băng tải A3)
  ├── ALT007: in_progress (Máy ép M09)
  ├── WO001: in_progress, P1 (Thay dầu M09)
  └── WO005: assigned, P1 (Kiểm tra EQ009)
  Total: 2 active WOs (cả 2 P1!), 2 active alerts

Phạm Anh Tuấn (U004, technician):
  ├── ALT004: assigned (Động cơ BT, nhưng WO giao cho Khoa)
  ├── WO002: scheduled, P2 (Thay ổ bi A3)
  ├── WO003: approved, P3 (Hiệu chuẩn Robot)
  ├── WO004: completed (PM máy nén — done)
  └── WO006: verified (Sửa rò rỉ — done)
  Total: 2 pending WOs, 2 completed WOs
```

---

## 14. Backend Seed Migrations

Để backend mock data khớp với frontend, tạo seed SQL cho mỗi service.

### 14.1. auth-service seeds

```sql
-- migrations/000005_seed_users_roles.up.sql

-- Roles
INSERT INTO roles (id, name, description) VALUES
  ('R01', 'super_admin',          'Full system access'),
  ('R02', 'factory_manager',      'Factory-wide read, approve WOs'),
  ('R03', 'maintenance_manager',  'Maintenance department management'),
  ('R04', 'maintenance_engineer', 'Create/execute maintenance tasks'),
  ('R05', 'technician',           'Execute assigned work orders'),
  ('R06', 'data_scientist',       'AI/ML model management'),
  ('R07', 'quality_inspector',    'Verify completed work'),
  ('R08', 'viewer',               'Read-only access');

-- Users (password: bcrypt hash of "123456")
-- Generate with: htpasswd -nbBC 10 "" 123456 | cut -d: -f2
INSERT INTO users (id, username, email, full_name, phone, role_id, department, status, password_hash, created_at)
VALUES
  ('U001', 'admin',         'admin@maintenix.vn',     'Nguyễn Văn Admin', '0901234567', 'R01', 'IT',              'active', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '2024-01-01'),
  ('U002', 'manager',       'manager@maintenix.vn',   'Trần Thị Lan',     '0912345678', 'R02', 'Quản lý Nhà máy', 'active', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '2024-01-15'),
  ('U003', 'engineer',      'engineer@maintenix.vn',  'Lê Minh Khoa',     '0923456789', 'R04', 'Bảo trì',         'active', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '2024-02-01'),
  ('U004', 'technician',    'tech@maintenix.vn',      'Phạm Anh Tuấn',    '0934567890', 'R05', 'Bảo trì',         'active', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '2024-02-15'),
  ('U005', 'datascientist', 'ds@maintenix.vn',        'Hoàng Dũng',       '0945678901', 'R06', 'AI/ML',           'active', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '2024-03-01'),
  ('U006', 'inspector',     'qc@maintenix.vn',        'Ngô Thị Mai',      '0956789012', 'R07', 'QC',              'active', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '2024-03-15'),
  ('U007', 'viewer',        'viewer@maintenix.vn',    'Đào Thanh Sơn',    '0967890123', 'R08', 'Sản xuất',        'active', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '2024-04-01'),
  ('U008', 'maint_mgr',     'maint_mgr@maintenix.vn', 'Vũ Đình Hùng',    '0978901234', 'R03', 'Bảo trì',         'active', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '2024-04-15');

-- User skills
INSERT INTO user_skills (user_id, skill) VALUES
  ('U003', 'PLC'), ('U003', 'Hydraulics'), ('U003', 'CNC'),
  ('U004', 'Welding'), ('U004', 'Electrical'),
  ('U005', 'Python'), ('U005', 'TensorFlow'), ('U005', 'SageMaker');

-- User certifications
INSERT INTO user_certifications (user_id, certification) VALUES
  ('U004', 'ISO 9001');
```

### 14.2. equipment-service seeds

```sql
-- migrations/000004_seed_equipment.up.sql

INSERT INTO equipment (id, asset_id, name, serial_number, type, manufacturer, model, year_manufactured, status, health_score, last_maintenance_date, next_maintenance_date, created_at)
VALUES
  ('EQ001', 'A-CNC-001', 'Máy CNC Fanuc #01',         'FNC-2021-0891', 'cnc_machine',     'Fanuc',      'Robodrill α-D21MiB5', 2021, 'running',     84, '2026-01-15', '2026-03-15', '2021-06-01'),
  ('EQ002', 'A-PRS-002', 'Máy ép thủy lực M09',       'HYD-2019-0445', 'press',           'Komatsu',    'H2F-300',             2019, 'critical',    31, '2026-01-28', '2026-02-28', '2019-09-15'),
  ('EQ003', 'A-CVR-003', 'Băng tải A3',                'CVR-2020-1122', 'conveyor',        'Siemens',    'ConveyLine Pro',      2020, 'warning',     68, '2026-02-01', '2026-04-01', '2020-03-20'),
  ('EQ004', 'B-RBT-004', 'Robot hàn #12',              'RBT-2022-0067', 'robot',           'ABB',        'IRB 6700',            2022, 'running',     91, '2026-02-10', '2026-05-10', '2022-01-10'),
  ('EQ005', 'A-CMP-005', 'Máy nén khí Atlas',          'CMP-2018-0334', 'compressor',      'Atlas Copco','GA 37+',              2018, 'warning',     72, '2026-01-20', '2026-03-20', '2018-07-01'),
  ('EQ006', 'B-RBT-006', 'Robot lắp ráp #05',          'RBT-2023-0112', 'robot',           'KUKA',       'KR QUANTEC',          2023, 'running',     95, '2026-02-15', '2026-06-15', '2023-02-20'),
  ('EQ007', 'A-PMP-007', 'Bơm chân không VP-3',        'PMP-2020-0890', 'pump',            'Grundfos',   'CRE 45-3',            2020, 'running',     82, '2026-01-05', '2026-04-05', '2020-11-15'),
  ('EQ008', 'C-GEN-008', 'Máy phát điện dự phòng',     'GEN-2017-0223', 'generator',       'Cummins',    'C500D5',              2017, 'idle',        88, '2026-02-20', '2026-08-20', '2017-05-01'),
  ('EQ009', 'A-MTR-009', 'Động cơ băng tải chính',     'MTR-2019-0667', 'motor',           'ABB',        'M3BP 315',            2019, 'critical',    28, '2026-02-05', '2026-02-28', '2019-04-10'),
  ('EQ010', 'B-HEX-010', 'Bộ trao đổi nhiệt B1',      'HEX-2021-0445', 'heat_exchanger',  'Alfa Laval', 'M10-BFG',             2021, 'maintenance', 55, '2026-02-25', '2026-02-27', '2021-08-20');

INSERT INTO equipment_locations (equipment_id, building, floor, production_line, workstation, lat, lng)
VALUES
  ('EQ001', 'Nhà xưởng A', 'Tầng 1', 'Dây chuyền A', 'Trạm A-01', 10.8231, 106.6297),
  ('EQ002', 'Nhà xưởng A', 'Tầng 1', 'Dây chuyền A', 'Trạm A-03', 10.8225, 106.6305),
  ('EQ003', 'Nhà xưởng A', 'Tầng 1', 'Dây chuyền A', 'Trạm A-05', 10.8238, 106.6288),
  ('EQ004', 'Nhà xưởng B', 'Tầng 1', 'Dây chuyền B', 'Trạm B-02', 10.8245, 106.6300),
  ('EQ005', 'Nhà xưởng A', 'Tầng 1', 'Chung',        'Phòng máy nén', 10.8220, 106.6292),
  ('EQ006', 'Nhà xưởng B', 'Tầng 1', 'Dây chuyền B', 'Trạm B-05', 10.8250, 106.6310),
  ('EQ007', 'Nhà xưởng A', 'Tầng 1', 'Dây chuyền A', 'Trạm A-08', 10.8235, 106.6295),
  ('EQ008', 'Nhà phụ trợ', 'Tầng 1', 'Hạ tầng',      'Phòng máy phát', NULL, NULL),
  ('EQ009', 'Nhà xưởng A', 'Tầng 1', 'Dây chuyền A', 'Trạm A-10', NULL, NULL),
  ('EQ010', 'Nhà xưởng B', 'Tầng 1', 'Dây chuyền B', 'Trạm B-08', NULL, NULL);

INSERT INTO equipment_specs (equipment_id, power, rated_speed, max_temperature, max_pressure)
VALUES
  ('EQ001', '15kW',   '24000 RPM', 90,   NULL),
  ('EQ002', '45kW',   NULL,         NULL, 200),
  ('EQ003', '5.5kW',  '150 RPM',   NULL, NULL),
  ('EQ004', '7.5kW',  NULL,         NULL, NULL),
  ('EQ005', '37kW',   NULL,         NULL, 13),
  ('EQ006', '5kW',    NULL,         NULL, NULL),
  ('EQ007', '11kW',   NULL,         NULL, NULL),
  ('EQ008', '500kVA', NULL,         NULL, NULL),
  ('EQ009', '132kW',  '1485 RPM',  NULL, NULL),
  ('EQ010', '3kW',    NULL,         150,  NULL);

-- Spare Parts
INSERT INTO spare_parts (id, part_number, name, description, manufacturer, category, unit, quantity, reorder_point, reorder_quantity, lead_time_days, unit_price, status, abc_class)
VALUES
  ('SP001', 'BRG-6208-2RS',  'Ổ bi 6208-2RS',              'Ổ bi cầu một dãy, bọc kín hai mặt',      'SKF',        'Bearing',    'cái',         12, 5,  20, 7,  850000,   'ok',           'A'),
  ('SP002', 'FLT-HYD-M09',   'Bộ lọc dầu thủy lực M09',   'Bộ lọc dầu thủy lực chính cho máy ép',   'Komatsu',    'Filter',     'bộ',          3,  2,  5,  14, 2500000,  'low_stock',    'A'),
  ('SP003', 'OIL-HYD-46',    'Dầu thủy lực ISO 46',        'Dầu thủy lực chống mài mòn',             'Shell',      'Lubricant',  'thùng 20L',   8,  3,  10, 3,  1800000,  'ok',           'B'),
  ('SP004', 'BLT-CVR-A3',    'Dây curoa băng tải A3',       'Dây curoa truyền động chính',             'Gates',      'Belt',       'sợi',         0,  2,  5,  10, 4500000,  'out_of_stock', 'A'),
  ('SP005', 'WLD-TIP-IRB',   'Đầu hàn ABB IRB',            'Đầu hàn thay thế cho robot ABB',         'ABB',        'Consumable', 'bộ',          15, 5,  10, 21, 3200000,  'ok',           'B'),
  ('SP006', 'FLT-AIR-GA37',  'Lọc gió máy nén GA37',       'Lọc gió đầu vào',                        'Atlas Copco','Filter',     'cái',         6,  3,  6,  14, 950000,   'ok',           'B'),
  ('SP007', 'SEAL-HEX-M10',  'Gioăng bộ trao đổi nhiệt',   'Gioăng EPDM cho Alfa Laval M10',         'Alfa Laval', 'Seal',       'bộ',          25, 5,  20, 30, 12000000, 'overstock',    'A');

-- Spare part ↔ equipment compatibility
INSERT INTO spare_part_equipment (spare_part_id, equipment_id) VALUES
  ('SP001', 'EQ003'), ('SP001', 'EQ009'),
  ('SP002', 'EQ002'),
  ('SP003', 'EQ002'), ('SP003', 'EQ007'),
  ('SP004', 'EQ003'),
  ('SP005', 'EQ004'),
  ('SP006', 'EQ005'),
  ('SP007', 'EQ010');
```

### 14.3. sensor-service seeds

```sql
-- migrations/000003_seed_sensors.up.sql (PostgreSQL — metadata)

INSERT INTO sensors (id, equipment_id, name, type, unit, min_threshold, max_threshold, warning_low, warning_high, critical_low, critical_high)
VALUES
  ('S001', 'EQ001', 'Nhiệt độ vòng bi',   'temperature', '°C',    20,  90,  10,  80,  5,    90),
  ('S002', 'EQ001', 'Rung động trục X',    'vibration',   'mm/s',  0,   5,   NULL,3,   NULL, 5),
  ('S003', 'EQ001', 'Dòng điện động cơ',   'current',     'A',     0,   25,  NULL,20,  NULL, 25),
  ('S004', 'EQ002', 'Áp suất thủy lực',    'pressure',    'bar',   100, 200, NULL,180, NULL, 200),
  ('S005', 'EQ002', 'Nhiệt độ dầu',        'temperature', '°C',    20,  100, NULL,85,  NULL, 95),
  ('S006', 'EQ003', 'Tốc độ băng tải',     'rpm',         'RPM',   50,  200, NULL,160, NULL, 190),
  ('S007', 'EQ003', 'Rung động motor',      'vibration',   'mm/s',  0,   6,   NULL,3.5, NULL, 5),
  ('S008', 'EQ004', 'Nhiệt độ khoang',     'temperature', '°C',    15,  80,  NULL,60,  NULL, 75),
  ('S009', 'EQ005', 'Áp suất nén',         'pressure',    'bar',   5,   12,  NULL,10,  NULL, 11.5),
  ('S010', 'EQ005', 'Nhiệt độ khí nén',    'temperature', '°C',    20,  100, NULL,85,  NULL, 95),
  ('S011', 'EQ006', 'Dòng servo',          'current',     'A',     0,   10,  NULL,7,   NULL, 9),
  ('S012', 'EQ007', 'Lưu lượng nước',      'flow_rate',   'L/min', 20,  80,  NULL,65,  NULL, 75);

-- InfluxDB seed (run via influx CLI or API)
-- Tạo initial readings cho mỗi sensor
-- Xem script: scripts/seed-influxdb.sh
```

### 14.4. alert-service seeds

```sql
-- migrations/000003_seed_alerts.up.sql

INSERT INTO alerts (id, equipment_id, equipment_name, severity, type, title, description, status, created_at, acknowledged_at, acknowledged_by, resolved_at, assigned_to, sla_deadline, production_line)
VALUES
  ('ALT001', 'EQ002', 'Máy ép thủy lực M09',   'critical', 'sensor_threshold', 'Quá nhiệt độ vòng bi',       'Nhiệt độ dầu thủy lực vượt ngưỡng critical 95°C',                      'open',         NOW() - INTERVAL '5 minutes',   NULL, NULL, NULL, NULL,          NOW() + INTERVAL '55 minutes', 'Dây chuyền A'),
  ('ALT002', 'EQ003', 'Băng tải A3',            'high',     'sensor_threshold', 'Rung động bất thường',        'Rung động motor băng tải vượt ngưỡng warning 3.5mm/s',                  'acknowledged', NOW() - INTERVAL '30 minutes',  NOW() - INTERVAL '10 minutes', 'U003', NULL, NULL, NULL,       'Dây chuyền A'),
  ('ALT003', 'EQ004', 'Robot hàn #12',          'medium',   'ml_prediction',    'Hiệu suất giảm dần',         'AI phát hiện hiệu suất hàn giảm 8% trong 7 ngày qua',                  'open',         NOW() - INTERVAL '2 hours',     NULL, NULL, NULL, NULL,          NULL,                          'Dây chuyền B'),
  ('ALT004', 'EQ009', 'Động cơ băng tải chính', 'critical', 'ml_prediction',    'Dự đoán hỏng trong 7 ngày',  'Mô hình AI dự báo RUL còn 14 ngày, xác suất hỏng 7 ngày: 78%',         'assigned',     NOW() - INTERVAL '1 day',       NULL, NULL, NULL, 'U004',       NULL,                          'Dây chuyền A'),
  ('ALT005', 'EQ005', 'Máy nén khí Atlas',      'medium',   'sensor_threshold', 'Nhiệt khí nén cao',          'Nhiệt độ khí nén đầu ra 88°C, vượt warning threshold 85°C',             'open',         NOW() - INTERVAL '1 hour',      NULL, NULL, NULL, NULL,          NULL,                          'Chung'),
  ('ALT006', 'EQ001', 'Máy CNC Fanuc #01',      'low',      'system',           'Sắp đến hạn bảo trì PM',     'Còn 15 ngày đến lịch bảo trì PM tiếp theo',                            'open',         NOW() - INTERVAL '2 days',      NULL, NULL, NULL, NULL,          NULL,                          'Dây chuyền A'),
  ('ALT007', 'EQ002', 'Máy ép thủy lực M09',   'critical', 'sensor_threshold', 'Áp suất vượt ngưỡng',        'Áp suất thủy lực 185 bar, gần ngưỡng critical 200 bar',                 'in_progress',  NOW() - INTERVAL '15 minutes',  NULL, NULL, NULL, 'U003',       NULL,                          'Dây chuyền A'),
  ('ALT008', 'EQ010', 'Bộ trao đổi nhiệt B1',  'high',     'manual',           'Phát hiện rò rỉ',            'Kỹ thuật viên phát hiện rò rỉ nhỏ tại mối nối ống',                    'resolved',     NOW() - INTERVAL '3 days',      NULL, NULL, NOW() - INTERVAL '1 day', NULL, NULL,                 'Dây chuyền B');

-- AI explanation data (separate table or JSONB column)
INSERT INTO alert_ai_analysis (alert_id, ai_explanation, recommended_actions)
VALUES
  ('ALT001', 'Phân tích cho thấy bộ lọc dầu bị tắc nghẽn 60%, kết hợp nhiệt độ môi trường cao gây quá tải hệ thống làm mát',
   '["Thay bộ lọc dầu thủy lực","Kiểm tra hệ thống làm mát","Giảm tải vận hành 20%"]'),
  ('ALT002', 'Mô hình ML dự đoán ổ bi motor bắt đầu hao mòn, khả năng hỏng trong 14 ngày',
   '["Lên lịch thay ổ bi motor","Kiểm tra cân bằng rotor"]'),
  ('ALT003', 'Phân tích dữ liệu cho thấy đầu hàn bắt đầu mòn, cần hiệu chuẩn lại',
   '["Thay đầu hàn","Hiệu chuẩn lại robot"]'),
  ('ALT004', 'Kết hợp nhiều yếu tố: rung động tăng, nhiệt độ cuộn dây tăng, dòng điện bất thường',
   '["Dừng máy kiểm tra cuộn dây","Đo điện trở cách điện","Chuẩn bị motor thay thế"]');

INSERT INTO alert_contributing_factors (alert_id, factor, impact)
VALUES
  ('ALT001', 'Bộ lọc dầu tắc nghẽn', 45), ('ALT001', 'Nhiệt độ môi trường', 25), ('ALT001', 'Tải trọng hoạt động', 20), ('ALT001', 'Tuổi thọ dầu', 10),
  ('ALT002', 'Ổ bi hao mòn', 55), ('ALT002', 'Mất cân bằng rotor', 30), ('ALT002', 'Lỏng chân đế', 15),
  ('ALT003', 'Mòn đầu hàn', 60), ('ALT003', 'Drift hiệu chuẩn', 30), ('ALT003', 'Chất lượng gas', 10),
  ('ALT004', 'Cách điện cuộn dây suy giảm', 40), ('ALT004', 'Rung động tăng', 35), ('ALT004', 'Nhiệt độ cao kéo dài', 25);
```

### 14.5. ml-service seeds

```sql
-- migrations/000004_seed_models.up.sql

INSERT INTO ai_models (id, name, version, type, status, accuracy, f1_score, precision_score, recall, deployed_at, trained_on, dataset_size, drift_score, confidence_score)
VALUES
  ('MDL001', 'Health Score Predictor',     'v3.2.1', 'health_score',       'active',     0.942, 0.935, 0.948, 0.922, '2026-02-01', '2026-01-25', 2450000, 0.08, 0.94),
  ('MDL002', 'RUL Estimator',             'v2.1.0', 'rul',                'active',     0.891, 0.878, 0.905, 0.853, '2026-01-15', '2026-01-10', 1800000, 0.12, 0.89),
  ('MDL003', 'Failure Mode Classifier',   'v1.5.3', 'failure_prediction', 'active',     0.918, 0.912, 0.925, 0.899, '2026-01-20', '2026-01-18', 890000,  0.15, 0.92),
  ('MDL004', 'Anomaly Detector LSTM',     'v4.0.0', 'anomaly_detection',  'staging',    0.956, 0.949, 0.962, 0.936, NULL,         '2026-02-20', 3200000, 0,    0.96),
  ('MDL005', 'Health Score Predictor (Old)','v3.1.0','health_score',       'deprecated', 0.921, 0.914, 0.928, 0.901, '2025-11-01', '2025-10-28', 2100000, 0.22, 0.88);

INSERT INTO model_features (model_id, feature_name, feature_order)
VALUES
  ('MDL001', 'temperature', 1), ('MDL001', 'vibration', 2), ('MDL001', 'current', 3), ('MDL001', 'pressure', 4), ('MDL001', 'runtime_hours', 5),
  ('MDL002', 'vibration_trend', 1), ('MDL002', 'temperature_trend', 2), ('MDL002', 'maintenance_history', 3), ('MDL002', 'age', 4), ('MDL002', 'load_factor', 5),
  ('MDL003', 'vibration_spectrum', 1), ('MDL003', 'temperature_pattern', 2), ('MDL003', 'acoustic_signature', 3),
  ('MDL004', 'multivariate_sensor_data', 1),
  ('MDL005', 'temperature', 1), ('MDL005', 'vibration', 2), ('MDL005', 'current', 3), ('MDL005', 'pressure', 4);

INSERT INTO pipelines (id, name, type, status, progress, started_at, completed_at, triggered_by, model_id)
VALUES
  ('PL001', 'Health Score Retraining',    'train',    'completed', 100, '2026-02-20 08:00:00', '2026-02-20 10:30:00', 'U005', 'MDL001'),
  ('PL002', 'Anomaly Detector Training',  'train',    'running',   72,  '2026-02-27 06:00:00', NULL,                  'auto',  'MDL004'),
  ('PL003', 'RUL Model Evaluation',       'evaluate', 'completed', 100, '2026-02-26 14:00:00', '2026-02-26 14:45:00', 'U005', 'MDL002'),
  ('PL004', 'Failure Classifier Deploy',  'deploy',   'completed', 100, '2026-02-25 09:00:00', '2026-02-25 09:15:00', 'U005', 'MDL003');

INSERT INTO pipeline_metrics (pipeline_id, metric_name, metric_value)
VALUES
  ('PL001', 'accuracy', 0.942), ('PL001', 'f1', 0.935), ('PL001', 'loss', 0.058),
  ('PL003', 'accuracy', 0.891), ('PL003', 'mae', 12.3),  ('PL003', 'rmse', 18.7);
```

### 14.6. Seed data chạy thế nào

```bash
# Development: chạy tự động khi service start
make seed-dev

# Manual: chạy từng service
cd services/auth-service && go run cmd/migrate/main.go up
cd services/equipment-service && go run cmd/migrate/main.go up
cd services/sensor-service && go run cmd/migrate/main.go up
cd services/alert-service && go run cmd/migrate/main.go up
cd services/workorder-service && go run cmd/migrate/main.go up
cd services/ml-service && go run cmd/migrate/main.go up

# Reset (rollback + re-seed)
make seed-reset

# Verify: đếm records
psql -h localhost -p 5432 -U maintenix -d maintenix_auth -c "SELECT COUNT(*) FROM users;"         -- Expected: 8
psql -h localhost -p 5432 -U maintenix -d maintenix_equipment -c "SELECT COUNT(*) FROM equipment;" -- Expected: 10
psql -h localhost -p 5432 -U maintenix -d maintenix_sensor -c "SELECT COUNT(*) FROM sensors;"      -- Expected: 12
psql -h localhost -p 5432 -U maintenix -d maintenix_alert -c "SELECT COUNT(*) FROM alerts;"        -- Expected: 8
psql -h localhost -p 5432 -U maintenix -d maintenix_ml -c "SELECT COUNT(*) FROM ai_models;"        -- Expected: 5
```

### 14.7. Frontend ↔ Backend data khớp nhau?

Checklist verify sau khi seed backend:

| Check | Frontend mock | Backend seed | Khớp? |
|-------|-------------|-------------|-------|
| User count | 8 (MOCK_USERS) | 8 (users table) | ✅ |
| User IDs | U001-U008 | U001-U008 | ✅ |
| Passwords | all "123456" | bcrypt("123456") | ✅ |
| Equipment count | 10 | 10 | ✅ |
| Equipment IDs | EQ001-EQ010 | EQ001-EQ010 | ✅ |
| Sensor count | 12 | 12 | ✅ |
| Sensor thresholds | warningHigh/criticalHigh in model | warning_high/critical_high columns | ✅ |
| Alert count | 8 | 8 | ✅ |
| Alert timestamps | Relative (Date.now() - offset) | Relative (NOW() - INTERVAL) | ✅ |
| AI analysis | Inline in Alert object | Separate alert_ai_analysis table | ⚠️ Structure differs |
| Work Order count | 6 | 6 (see workorder seed) | ✅ |
| Spare Part count | 7 | 7 | ✅ |
| AI Model count | 5 | 5 | ✅ |
| Pipeline count | 4 | 4 | ✅ |
| KPI data | Static MOCK_KPI | Aggregated at runtime | ⚠️ Values will differ |

**⚠️ Known differences:**
- Frontend alert có `aiExplanation` inline, backend tách bảng `alert_ai_analysis` + `alert_contributing_factors`
- Frontend KPI là static mock, backend KPI aggregated real-time từ nhiều service
- Frontend timestamps relative (Date.now()), backend dùng NOW() — values match logic nhưng absolute time khác
