import { Injectable } from '@angular/core';
import { Observable, of, delay, BehaviorSubject, interval, map } from 'rxjs';
import { Equipment, Alert, WorkOrder, Sensor, MaintenanceSchedule, SparePart, AIModel, Pipeline, KPIData, AuditLog, SensorReading, User } from '../models';
import { MOCK_EQUIPMENT, MOCK_ALERTS, MOCK_WORK_ORDERS, MOCK_SCHEDULES, MOCK_SPARE_PARTS, MOCK_AI_MODELS, MOCK_PIPELINES, MOCK_KPI, MOCK_AUDIT_LOGS, MOCK_SENSORS, MOCK_USERS, generateTimeSeriesData } from '../mock/mock-data';

@Injectable({ providedIn: 'root' })
export class ApiService {
  // Simulates REST, gRPC-Web, WebSocket (STOMP) connections
  // In production: REST → Go backend, gRPC-Web → Sensor/ML services, WebSocket → Alert broadcast

  private alertsSubject = new BehaviorSubject<Alert[]>([...MOCK_ALERTS]);

  // ===== DASHBOARD / KPI (REST GET /api/dashboard/kpi) =====
  getKPI(): Observable<KPIData> {
    return of(MOCK_KPI).pipe(delay(300));
  }

  // ===== EQUIPMENT (REST CRUD /api/equipment) =====
  getEquipment(): Observable<Equipment[]> {
    return of(MOCK_EQUIPMENT).pipe(delay(400));
  }

  getEquipmentById(id: string): Observable<Equipment | undefined> {
    return of(MOCK_EQUIPMENT.find(e => e.id === id)).pipe(delay(300));
  }

  // ===== SENSORS (gRPC-Web stream simulation) =====
  getSensors(): Observable<Sensor[]> {
    return of(MOCK_SENSORS).pipe(delay(200));
  }

  getSensorsByEquipment(equipmentId: string): Observable<Sensor[]> {
    return of(MOCK_SENSORS.filter(s => s.equipmentId === equipmentId)).pipe(delay(200));
  }

  // Simulates gRPC-Web StreamSensorData
  streamSensorData(sensorId: string): Observable<SensorReading> {
    return interval(2000).pipe(
      map(() => {
        const sensor = MOCK_SENSORS.find(s => s.id === sensorId);
        return {
          sensorId,
          equipmentId: sensor?.equipmentId || '',
          value: +(sensor?.currentValue || 0 + (Math.random() - 0.5) * 5).toFixed(1),
          unit: sensor?.unit || '',
          timestamp: new Date().toISOString(),
          qualityFlag: 'good' as const
        };
      })
    );
  }

  getSensorTimeSeries(sensorId: string, hours: number = 24): Observable<{ time: string; value: number }[]> {
    const sensor = MOCK_SENSORS.find(s => s.id === sensorId);
    const base = sensor?.currentValue || 50;
    return of(generateTimeSeriesData(hours, base, base * 0.15)).pipe(delay(300));
  }

  // ===== ALERTS (WebSocket STOMP + REST) =====
  getAlerts(): Observable<Alert[]> {
    return this.alertsSubject.asObservable();
  }

  getAlertById(id: string): Observable<Alert | undefined> {
    return of(MOCK_ALERTS.find(a => a.id === id)).pipe(delay(200));
  }

  acknowledgeAlert(id: string, userId: string): Observable<Alert> {
    const alerts = this.alertsSubject.value;
    const idx = alerts.findIndex(a => a.id === id);
    if (idx >= 0) {
      alerts[idx] = { ...alerts[idx], status: 'acknowledged', acknowledgedAt: new Date().toISOString(), acknowledgedBy: userId };
      this.alertsSubject.next([...alerts]);
    }
    return of(alerts[idx]).pipe(delay(300));
  }

  // Simulates WebSocket STOMP /topic/factory-alerts
  subscribeAlerts(): Observable<Alert> {
    return interval(15000).pipe(
      map(() => {
        const severities: Alert['severity'][] = ['critical', 'high', 'medium', 'low'];
        const equipment = MOCK_EQUIPMENT[Math.floor(Math.random() * MOCK_EQUIPMENT.length)];
        const newAlert: Alert = {
          id: 'ALT' + Date.now(),
          equipmentId: equipment.id,
          equipmentName: equipment.name,
          severity: severities[Math.floor(Math.random() * severities.length)],
          type: Math.random() > 0.5 ? 'sensor_threshold' : 'ml_prediction',
          title: 'Cảnh báo mới phát hiện',
          description: `Phát hiện bất thường trên ${equipment.name}`,
          status: 'open',
          createdAt: new Date().toISOString(),
          productionLine: equipment.location.productionLine
        };
        const current = this.alertsSubject.value;
        this.alertsSubject.next([newAlert, ...current.slice(0, 49)]);
        return newAlert;
      })
    );
  }

  // ===== WORK ORDERS (REST CRUD /api/work-orders) =====
  getWorkOrders(): Observable<WorkOrder[]> {
    return of(MOCK_WORK_ORDERS).pipe(delay(400));
  }

  getWorkOrderById(id: string): Observable<WorkOrder | undefined> {
    return of(MOCK_WORK_ORDERS.find(w => w.id === id)).pipe(delay(300));
  }

  // ===== MAINTENANCE SCHEDULE (REST + WebSocket) =====
  getMaintenanceSchedules(): Observable<MaintenanceSchedule[]> {
    return of(MOCK_SCHEDULES).pipe(delay(400));
  }

  // ===== SPARE PARTS (REST CRUD /api/spare-parts) =====
  getSpareParts(): Observable<SparePart[]> {
    return of(MOCK_SPARE_PARTS).pipe(delay(400));
  }

  // ===== AI MODELS (REST /api/models + gRPC for Kubeflow) =====
  getAIModels(): Observable<AIModel[]> {
    return of(MOCK_AI_MODELS).pipe(delay(400));
  }

  getPipelines(): Observable<Pipeline[]> {
    return of(MOCK_PIPELINES).pipe(delay(400));
  }

  // ===== USERS (REST CRUD /api/users) =====
  getUsers(): Observable<User[]> {
    return of(MOCK_USERS).pipe(delay(300));
  }

  // ===== AUDIT LOGS (REST /api/audit) =====
  getAuditLogs(): Observable<AuditLog[]> {
    return of(MOCK_AUDIT_LOGS).pipe(delay(400));
  }

  // ===== REPORTS DATA =====
  getOEEHistory(): Observable<{ date: string; availability: number; performance: number; quality: number; oee: number }[]> {
    const data = [];
    for (let i = 30; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const avail = 90 + Math.random() * 8;
      const perf = 85 + Math.random() * 10;
      const qual = 95 + Math.random() * 4;
      data.push({ date: d.toISOString().slice(0, 10), availability: +avail.toFixed(1), performance: +perf.toFixed(1), quality: +qual.toFixed(1), oee: +((avail * perf * qual) / 10000).toFixed(1) });
    }
    return of(data).pipe(delay(500));
  }

  getMaintenanceCostHistory(): Observable<{ month: string; preventive: number; corrective: number; predictive: number }[]> {
    return of([
      { month: '09/2025', preventive: 45000000, corrective: 78000000, predictive: 12000000 },
      { month: '10/2025', preventive: 48000000, corrective: 62000000, predictive: 18000000 },
      { month: '11/2025', preventive: 42000000, corrective: 55000000, predictive: 25000000 },
      { month: '12/2025', preventive: 50000000, corrective: 48000000, predictive: 30000000 },
      { month: '01/2026', preventive: 46000000, corrective: 42000000, predictive: 35000000 },
      { month: '02/2026', preventive: 44000000, corrective: 38000000, predictive: 32000000 },
    ]).pipe(delay(400));
  }
}
