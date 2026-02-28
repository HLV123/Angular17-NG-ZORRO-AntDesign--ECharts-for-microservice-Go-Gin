import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NgxEchartsModule } from 'ngx-echarts';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { KPIData, Alert, Equipment, MaintenanceSchedule } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, NzCardModule, NzGridModule, NzTagModule, NzButtonModule, NzBadgeModule, NzToolTipModule, NzProgressModule, NzStatisticModule, NzEmptyModule, NzSelectModule, NgxEchartsModule],
  template: `
    <div class="dashboard fade-in">
      <!-- Page Title -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Dashboard Tổng quan Nhà máy</h1>
          <p class="page-desc">Factory Overview · Thời gian thực · Cập nhật qua WebSocket (STOMP)</p>
        </div>
        <div class="header-actions">
          <nz-select [(ngModel)]="timeRange" class="time-select" nzSize="default">
            <nz-option nzValue="1h" nzLabel="1 giờ"></nz-option>
            <nz-option nzValue="6h" nzLabel="6 giờ"></nz-option>
            <nz-option nzValue="24h" nzLabel="24 giờ"></nz-option>
            <nz-option nzValue="7d" nzLabel="7 ngày"></nz-option>
            <nz-option nzValue="30d" nzLabel="30 ngày"></nz-option>
          </nz-select>
        </div>
      </div>

      <!-- KPI BAR -->
      <div class="kpi-grid">
        <div class="kpi-card" style="border-left-color: #6366f1;">
          <div class="kpi-header"><span class="kpi-label">OEE Tổng thể</span><i class="fa-solid fa-gauge-high kpi-icon" style="color:#6366f1;background:rgba(99,102,241,0.1);"></i></div>
          <div class="kpi-value">{{kpi.oee}}%<span class="kpi-trend up">▲{{kpi.oeeTrend}}%</span></div>
          <div class="kpi-bar"><div class="kpi-bar-fill" [style.width.%]="kpi.oee" style="background:linear-gradient(90deg,#6366f1,#818cf8);"></div></div>
        </div>
        <div class="kpi-card" style="border-left-color: #f59e0b;">
          <div class="kpi-header"><span class="kpi-label">MTTR (30 ngày)</span><i class="fa-solid fa-clock kpi-icon" style="color:#f59e0b;background:rgba(245,158,11,0.1);"></i></div>
          <div class="kpi-value">{{kpi.mttr}}h<span class="kpi-trend down">▼{{-kpi.mttrTrend}}h</span></div>
        </div>
        <div class="kpi-card" style="border-left-color: #ef4444;">
          <div class="kpi-header"><span class="kpi-label">Cảnh báo đang mở</span><i class="fa-solid fa-triangle-exclamation kpi-icon" style="color:#ef4444;background:rgba(239,68,68,0.1);"></i></div>
          <div class="kpi-value text-red-600">{{kpi.openAlerts}}<span class="kpi-sub">· {{kpi.criticalAlerts}} critical</span></div>
        </div>
        <div class="kpi-card" style="border-left-color: #10b981;">
          <div class="kpi-header"><span class="kpi-label">Uptime Nhà máy</span><i class="fa-solid fa-server kpi-icon" style="color:#10b981;background:rgba(16,185,129,0.1);"></i></div>
          <div class="kpi-value">{{kpi.uptime}}%</div>
        </div>
        <div class="kpi-card" style="border-left-color: #8b5cf6;">
          <div class="kpi-header"><span class="kpi-label">Tiết kiệm (AI dự đoán)</span><i class="fa-solid fa-piggy-bank kpi-icon" style="color:#8b5cf6;background:rgba(139,92,246,0.1);"></i></div>
          <div class="kpi-value">\${{kpi.costSavings | number}}k</div>
        </div>
      </div>

      <!-- MAIN GRID: Floor Map + Alert Feed -->
      <div class="main-grid">
        <!-- Factory Floor Map -->
        <div class="card map-card">
          <div class="card-header">
            <h3><i class="fa-solid fa-map-marked-alt text-indigo-500 mr-2"></i>Sơ đồ Nhà máy (Thời gian thực)</h3>
            <span class="live-badge"><span class="live-dot"></span> WebSocket</span>
          </div>
          <div class="map-container">
            <div class="factory-grid">
              <div *ngFor="let eq of equipment" class="eq-marker"
                   [class]="'status-' + eq.status"
                   [nz-tooltip]="eq.name + ' · Health: ' + eq.healthScore + '%'"
                   [routerLink]="['/equipment', eq.id]">
                <i class="fa-solid" [class]="getEquipmentIcon(eq.type)"></i>
                <span class="eq-label">{{eq.name | slice:0:15}}</span>
                <span class="eq-score">{{eq.healthScore}}%</span>
              </div>
            </div>
          </div>
          <div class="map-legend">
            <span><i class="fa-solid fa-circle text-emerald-500"></i> Bình thường</span>
            <span><i class="fa-solid fa-circle text-amber-500"></i> Cảnh báo</span>
            <span><i class="fa-solid fa-circle text-red-500"></i> Nguy hiểm</span>
            <span><i class="fa-solid fa-circle text-gray-400"></i> Bảo trì/Offline</span>
          </div>
        </div>

        <!-- Alert Feed -->
        <div class="card alert-card">
          <div class="card-header">
            <h3><i class="fa-solid fa-bolt text-amber-500 mr-2"></i>Luồng Cảnh báo</h3>
            <span class="live-badge"><span class="live-dot"></span> live</span>
          </div>
          <div class="alert-filters">
            <button *ngFor="let f of alertFilters" class="filter-btn" [class.active]="activeFilter === f.value" (click)="activeFilter = f.value">
              {{f.label}} <span class="filter-count" *ngIf="f.count">({{f.count}})</span>
            </button>
          </div>
          <div class="alert-list">
            <div *ngFor="let a of filteredAlerts; trackBy: trackAlert" class="alert-item" [class]="'severity-' + a.severity" [routerLink]="['/alerts', a.id]">
              <div class="alert-icon">
                <i class="fa-solid" [class]="getSeverityIcon(a.severity)"></i>
              </div>
              <div class="alert-body">
                <span class="alert-equip">{{a.equipmentName}}</span>
                <span class="alert-title">{{a.title}}</span>
                <span class="alert-time">{{getTimeAgo(a.createdAt)}}</span>
              </div>
              <div class="alert-actions">
                <nz-tag [nzColor]="getSeverityColor(a.severity)">{{a.severity | uppercase}}</nz-tag>
                <button *ngIf="a.status === 'open'" class="ack-btn" (click)="acknowledgeAlert(a.id, $event)">Ack</button>
              </div>
            </div>
          </div>
          <button class="view-all-btn" routerLink="/alerts">Xem tất cả cảnh báo →</button>
        </div>
      </div>

      <!-- CHARTS ROW -->
      <div class="charts-grid">
        <!-- Health Score Timeline -->
        <div class="card chart-card">
          <div class="card-header">
            <h3><i class="fa-solid fa-heartbeat text-rose-500 mr-2"></i>Health Score Timeline</h3>
          </div>
          <div echarts [options]="healthChartOpts" class="echart-box" style="height:300px;"></div>
        </div>

        <!-- OEE Gauge -->
        <div class="card gauge-card">
          <div class="card-header">
            <h3><i class="fa-solid fa-bullseye text-violet-500 mr-2"></i>OEE Gauge</h3>
          </div>
          <div echarts [options]="oeeGaugeOpts" class="echart-box" style="height:300px;"></div>
        </div>
      </div>

      <!-- BOTTOM ROW: RUL + Gantt + Kanban -->
      <div class="bottom-grid">
        <!-- RUL Predictions -->
        <div class="card">
          <div class="card-header">
            <h3><i class="fa-solid fa-hourglass-half text-blue-500 mr-2"></i>Tuổi thọ còn lại (RUL)</h3>
            <span class="mono text-xs text-gray-400">Model confidence 94%</span>
          </div>
          <div class="rul-list">
            <div *ngFor="let r of rulData" class="rul-item">
              <div class="rul-info"><span class="rul-name">{{r.name}}</span><span class="rul-days" [class]="r.days < 30 ? 'text-red-500' : r.days < 90 ? 'text-amber-500' : 'text-emerald-600'">{{r.days}} ngày</span></div>
              <nz-progress [nzPercent]="r.percent" [nzStrokeColor]="r.days < 30 ? '#ef4444' : r.days < 90 ? '#f59e0b' : '#10b981'" [nzShowInfo]="false" nzSize="small"></nz-progress>
            </div>
          </div>
        </div>

        <!-- Gantt Mini -->
        <div class="card">
          <div class="card-header">
            <h3><i class="fa-solid fa-timeline text-indigo-500 mr-2"></i>Lịch Gantt Bảo trì</h3>
          </div>
          <div class="gantt-mini">
            <div *ngFor="let s of schedules" class="gantt-row">
              <span class="gantt-label">{{s.equipmentName | slice:0:18}}</span>
              <div class="gantt-bar-container">
                <div class="gantt-bar" [class]="'type-' + s.type" [style.width.%]="30 + Math.random() * 50">
                  <span>{{s.title | slice:0:25}}</span>
                </div>
              </div>
            </div>
          </div>
          <button class="view-all-btn" routerLink="/maintenance">Xem lịch đầy đủ →</button>
        </div>

        <!-- Active Work Orders -->
        <div class="card">
          <div class="card-header">
            <h3><i class="fa-solid fa-clipboard-list text-emerald-500 mr-2"></i>Công việc đang tiến hành</h3>
          </div>
          <div class="wo-list">
            <div *ngFor="let wo of activeWorkOrders" class="wo-item" [routerLink]="['/work-orders', wo.id]">
              <nz-tag [nzColor]="getPriorityColor(wo.priority)" class="wo-priority">{{wo.priority}}</nz-tag>
              <div class="wo-info">
                <span class="wo-title">{{wo.title | slice:0:30}}</span>
                <span class="wo-assigned">{{wo.assignedTo}}</span>
              </div>
              <nz-progress [nzPercent]="wo.completionRate" nzSize="small" [nzWidth]="40" nzType="circle" [nzStrokeColor]="wo.completionRate > 80 ? '#10b981' : '#1e6fd9'"></nz-progress>
            </div>
          </div>
          <button class="view-all-btn" routerLink="/work-orders">Xem tất cả WO →</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard { }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
    .page-title { font-size: 24px; font-weight: 700; color: #0f172a; }
    .page-desc { font-size: 13px; color: #64748b; margin-top: 2px; }
    .time-select { width: 120px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; margin-bottom: 24px; }
    .kpi-card { background: white; border-radius: 16px; padding: 20px; border-left: 4px solid; box-shadow: 0 1px 3px rgba(0,0,0,0.06); transition: transform 0.2s, box-shadow 0.2s; }
    .kpi-card:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.08); }
    .kpi-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .kpi-label { font-size: 12px; color: #64748b; font-weight: 500; }
    .kpi-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 16px; }
    .kpi-value { font-size: 28px; font-weight: 700; color: #0f172a; }
    .kpi-trend { font-size: 13px; margin-left: 8px; font-weight: 500; }
    .kpi-trend.up { color: #10b981; }
    .kpi-trend.down { color: #10b981; }
    .kpi-sub { font-size: 13px; color: #94a3b8; font-weight: 400; margin-left: 8px; }
    .kpi-bar { height: 4px; background: #f1f5f9; border-radius: 2px; margin-top: 12px; }
    .kpi-bar-fill { height: 4px; border-radius: 2px; transition: width 1s ease; }

    .main-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; margin-bottom: 24px; }
    .card { background: white; border-radius: 16px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .card-header h3 { font-size: 15px; font-weight: 600; color: #1e293b; margin: 0; display: flex; align-items: center; }
    .live-badge { font-size: 11px; padding: 4px 10px; border-radius: 20px; background: #ecfdf5; color: #059669; display: flex; align-items: center; gap: 6px; }
    .live-dot { width: 6px; height: 6px; border-radius: 50%; background: #10b981; animation: pulse-dot 1.5s infinite; }
    @keyframes pulse-dot { 0%,100% { opacity:1; } 50% { opacity:0.4; } }

    .factory-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; padding: 16px; background: #f8fafc; border-radius: 12px; min-height: 200px; }
    .eq-marker { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 8px; border-radius: 12px; cursor: pointer; transition: all 0.2s; border: 2px solid transparent; }
    .eq-marker:hover { transform: scale(1.05); }
    .eq-marker i { font-size: 24px; }
    .eq-label { font-size: 10px; color: #475569; text-align: center; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .eq-score { font-size: 11px; font-weight: 700; font-family: 'JetBrains Mono', monospace; }
    .status-running { background: #ecfdf5; border-color: #d1fae5; }
    .status-running i { color: #10b981; }
    .status-running .eq-score { color: #059669; }
    .status-warning { background: #fffbeb; border-color: #fef3c7; }
    .status-warning i { color: #f59e0b; }
    .status-warning .eq-score { color: #d97706; }
    .status-critical { background: #fef2f2; border-color: #fecaca; animation: pulse 2s infinite; }
    .status-critical i { color: #ef4444; }
    .status-critical .eq-score { color: #dc2626; }
    .status-maintenance, .status-offline, .status-idle { background: #f1f5f9; border-color: #e2e8f0; }
    .status-maintenance i, .status-offline i, .status-idle i { color: #94a3b8; }
    .status-maintenance .eq-score, .status-offline .eq-score, .status-idle .eq-score { color: #94a3b8; }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.7; } }
    .map-legend { display: flex; gap: 16px; padding-top: 12px; font-size: 12px; color: #64748b; }
    .map-legend i { font-size: 8px; margin-right: 4px; }

    .alert-card { display: flex; flex-direction: column; }
    .alert-filters { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
    .filter-btn { font-size: 12px; padding: 4px 12px; border-radius: 20px; border: 1px solid #e2e8f0; background: white; cursor: pointer; color: #64748b; transition: all 0.15s; }
    .filter-btn:hover { border-color: #1e6fd9; color: #1e6fd9; }
    .filter-btn.active { background: #1e6fd9; color: white; border-color: #1e6fd9; }
    .filter-count { font-weight: 600; }
    .alert-list { flex: 1; max-height: 360px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
    .alert-item { display: flex; gap: 12px; padding: 10px 12px; border-radius: 10px; cursor: pointer; transition: background 0.15s; align-items: center; }
    .alert-item:hover { background: #f8fafc; }
    .severity-critical { border-left: 3px solid #ef4444; }
    .severity-high { border-left: 3px solid #f97316; }
    .severity-medium { border-left: 3px solid #eab308; }
    .severity-low { border-left: 3px solid #3b82f6; }
    .severity-info { border-left: 3px solid #94a3b8; }
    .alert-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .severity-critical .alert-icon { background: #fef2f2; color: #ef4444; }
    .severity-high .alert-icon { background: #fff7ed; color: #f97316; }
    .severity-medium .alert-icon { background: #fffbeb; color: #eab308; }
    .severity-low .alert-icon { background: #eff6ff; color: #3b82f6; }
    .alert-body { flex: 1; min-width: 0; }
    .alert-equip { display: block; font-size: 13px; font-weight: 600; color: #1e293b; }
    .alert-title { display: block; font-size: 12px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .alert-time { font-size: 11px; color: #94a3b8; }
    .alert-actions { display: flex; flex-direction: column; gap: 4px; align-items: flex-end; }
    .ack-btn { font-size: 11px; padding: 2px 10px; border-radius: 6px; border: 1px solid #e2e8f0; background: white; cursor: pointer; color: #475569; }
    .ack-btn:hover { background: #eff6ff; border-color: #1e6fd9; color: #1e6fd9; }
    .view-all-btn { display: block; width: 100%; text-align: center; padding: 10px; font-size: 13px; color: #1e6fd9; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; margin-top: 12px; cursor: pointer; transition: background 0.15s; }
    .view-all-btn:hover { background: #eff6ff; }

    .charts-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; margin-bottom: 24px; }
    .chart-card, .gauge-card { min-height: 360px; }
    .echart-box { width: 100%; }

    .bottom-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
    .rul-list { display: flex; flex-direction: column; gap: 14px; }
    .rul-item { }
    .rul-info { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .rul-name { font-size: 13px; color: #374151; }
    .rul-days { font-size: 13px; font-weight: 700; font-family: 'JetBrains Mono', monospace; }

    .gantt-mini { display: flex; flex-direction: column; gap: 8px; }
    .gantt-row { display: flex; align-items: center; gap: 8px; }
    .gantt-label { width: 100px; font-size: 11px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0; }
    .gantt-bar-container { flex: 1; height: 28px; background: #f1f5f9; border-radius: 6px; overflow: hidden; }
    .gantt-bar { height: 100%; border-radius: 6px; display: flex; align-items: center; padding: 0 8px; font-size: 11px; color: white; white-space: nowrap; }
    .type-predictive { background: linear-gradient(90deg, #8b5cf6, #a78bfa); }
    .type-preventive { background: linear-gradient(90deg, #3b82f6, #60a5fa); }
    .type-corrective { background: linear-gradient(90deg, #ef4444, #f87171); }
    .type-emergency { background: linear-gradient(90deg, #f97316, #fb923c); }

    .wo-list { display: flex; flex-direction: column; gap: 10px; }
    .wo-item { display: flex; align-items: center; gap: 12px; padding: 8px; border-radius: 10px; cursor: pointer; transition: background 0.15s; }
    .wo-item:hover { background: #f8fafc; }
    .wo-priority { margin: 0; }
    .wo-info { flex: 1; min-width: 0; }
    .wo-title { display: block; font-size: 13px; font-weight: 500; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .wo-assigned { font-size: 11px; color: #94a3b8; }

    @media (max-width: 1200px) { .kpi-grid { grid-template-columns: repeat(3, 1fr); } .main-grid, .charts-grid { grid-template-columns: 1fr; } .bottom-grid { grid-template-columns: 1fr; } }
    @media (max-width: 768px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } .factory-grid { grid-template-columns: repeat(3, 1fr); } }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private subs = new Subscription();
  Math = Math;

  timeRange = '24h';
  activeFilter = 'all';
  kpi: KPIData = { oee: 0, oeeTrend: 0, mttr: 0, mttrTrend: 0, openAlerts: 0, criticalAlerts: 0, uptime: 0, costSavings: 0, totalEquipment: 0, onlineEquipment: 0 };
  equipment: Equipment[] = [];
  alerts: Alert[] = [];
  schedules: MaintenanceSchedule[] = [];
  activeWorkOrders: any[] = [];
  healthChartOpts: any = {};
  oeeGaugeOpts: any = {};
  rulData = [
    { name: 'Máy ép thủy lực M09', days: 23, percent: 15 },
    { name: 'Bơm chân không VP-3', days: 82, percent: 55 },
    { name: 'Máy nén khí Atlas', days: 231, percent: 85 },
    { name: 'Động cơ băng tải', days: 14, percent: 9 },
    { name: 'Robot hàn #12', days: 156, percent: 70 },
  ];

  alertFilters = [
    { label: 'Tất cả', value: 'all', count: 0 },
    { label: 'Critical', value: 'critical', count: 0 },
    { label: 'Chưa xử lý', value: 'open', count: 0 },
  ];

  get filteredAlerts(): Alert[] {
    if (this.activeFilter === 'all') return this.alerts.slice(0, 8);
    if (this.activeFilter === 'critical') return this.alerts.filter(a => a.severity === 'critical').slice(0, 8);
    return this.alerts.filter(a => a.status === 'open').slice(0, 8);
  }

  ngOnInit() {
    this.subs.add(this.api.getKPI().subscribe(d => this.kpi = d));
    this.subs.add(this.api.getEquipment().subscribe(d => this.equipment = d));
    this.subs.add(this.api.getAlerts().subscribe(d => {
      this.alerts = d;
      this.alertFilters[0].count = d.length;
      this.alertFilters[1].count = d.filter(a => a.severity === 'critical').length;
      this.alertFilters[2].count = d.filter(a => a.status === 'open').length;
    }));
    this.subs.add(this.api.getMaintenanceSchedules().subscribe(d => this.schedules = d));
    this.subs.add(this.api.getWorkOrders().subscribe(d => this.activeWorkOrders = d.filter(w => ['in_progress', 'assigned', 'scheduled'].includes(w.status))));
    this.subs.add(this.api.subscribeAlerts().subscribe());
    this.initCharts();
  }

  ngOnDestroy() { this.subs.unsubscribe(); }

  initCharts() {
    const hours = Array.from({ length: 25 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
    const genLine = (base: number, v: number, trend: number) => hours.map((_, i) => +(base + (Math.random() - 0.5) * v + Math.sin(i / 4) * v / 3 - i * trend).toFixed(1));

    this.healthChartOpts = {
      tooltip: { trigger: 'axis' },
      legend: { data: ['Máy CNC', 'Máy ép M09', 'Băng tải A3', 'Robot hàn', 'Động cơ BT'], bottom: 0, textStyle: { fontSize: 11 } },
      grid: { left: '3%', right: '3%', top: '8%', bottom: '15%', containLabel: true },
      xAxis: { type: 'category', data: hours, axisLabel: { fontSize: 10 } },
      yAxis: { type: 'value', min: 20, max: 100, name: 'Health Score', nameTextStyle: { fontSize: 11 } },
      series: [
        { name: 'Máy CNC', type: 'line', data: genLine(84, 6, 0), smooth: true, lineStyle: { width: 2 }, itemStyle: { color: '#3b82f6' } },
        { name: 'Máy ép M09', type: 'line', data: genLine(55, 10, 0.8), smooth: true, lineStyle: { width: 2 }, itemStyle: { color: '#ef4444' } },
        { name: 'Băng tải A3', type: 'line', data: genLine(68, 8, 0.2), smooth: true, lineStyle: { width: 2 }, itemStyle: { color: '#f59e0b' } },
        { name: 'Robot hàn', type: 'line', data: genLine(91, 4, 0), smooth: true, lineStyle: { width: 2 }, itemStyle: { color: '#10b981' } },
        { name: 'Động cơ BT', type: 'line', data: genLine(40, 12, 0.5), smooth: true, lineStyle: { width: 2 }, itemStyle: { color: '#8b5cf6' } },
      ]
    };

    this.oeeGaugeOpts = {
      series: [{
        type: 'gauge', startAngle: 200, endAngle: -20, min: 0, max: 100, splitNumber: 5,
        pointer: { show: true, length: '60%', width: 6, itemStyle: { color: '#1e6fd9' } },
        axisLine: { lineStyle: { width: 20, color: [[0.6, '#ef4444'], [0.8, '#f59e0b'], [1, '#10b981']] } },
        axisTick: { show: false }, splitLine: { length: 8, lineStyle: { width: 2, color: '#999' } },
        axisLabel: { distance: 25, fontSize: 11, color: '#64748b' },
        title: { offsetCenter: [0, '70%'], fontSize: 14, color: '#64748b' },
        detail: { valueAnimation: true, fontSize: 36, fontWeight: 700, offsetCenter: [0, '40%'], color: '#0f172a', formatter: '{value}%' },
        data: [{ value: 86.5, name: 'OEE' }]
      }]
    };
  }

  getEquipmentIcon(type: string): string {
    const map: Record<string, string> = {
      'cnc_machine': 'fa-cog', 'press': 'fa-compress', 'conveyor': 'fa-arrows-left-right',
      'pump': 'fa-water', 'compressor': 'fa-wind', 'robot': 'fa-robot',
      'motor': 'fa-fan', 'generator': 'fa-bolt', 'valve': 'fa-faucet', 'heat_exchanger': 'fa-temperature-half'
    };
    return map[type] || 'fa-gear';
  }

  getSeverityIcon(s: string): string {
    return s === 'critical' ? 'fa-circle-xmark' : s === 'high' ? 'fa-exclamation-triangle' : s === 'medium' ? 'fa-exclamation-circle' : 'fa-info-circle';
  }

  getSeverityColor(s: string): string {
    return s === 'critical' ? 'red' : s === 'high' ? 'orange' : s === 'medium' ? 'gold' : 'blue';
  }

  getPriorityColor(p: string): string {
    return p === 'P1' ? 'red' : p === 'P2' ? 'orange' : p === 'P3' ? 'gold' : 'blue';
  }

  getTimeAgo(d: string): string {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} phút trước`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} giờ trước`;
    return `${Math.floor(hrs / 24)} ngày trước`;
  }

  acknowledgeAlert(id: string, e: Event) {
    e.stopPropagation();
    this.api.acknowledgeAlert(id, this.auth.currentUser?.fullName || '').subscribe();
  }

  trackAlert(i: number, a: Alert) { return a.id; }
}
