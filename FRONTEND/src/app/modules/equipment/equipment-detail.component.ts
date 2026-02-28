import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NgxEchartsModule } from 'ngx-echarts';
import { ApiService } from '../../core/services/api.service';
import { Equipment, Sensor } from '../../core/models';

@Component({
  selector: 'app-equipment-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, NzTabsModule, NzCardModule, NzTagModule, NzProgressModule, NzDescriptionsModule, NzButtonModule, NzTimelineModule, NzBadgeModule, NgxEchartsModule],
  template: `
    <div class="fade-in" *ngIf="eq">
      <div class="detail-header">
        <div class="flex items-center gap-4">
          <button class="back-btn" routerLink="/equipment"><i class="fa-solid fa-arrow-left"></i></button>
          <div>
            <h1 class="page-title">{{eq.name}}</h1>
            <p class="page-desc">{{eq.assetId}} · {{eq.manufacturer}} {{eq.model}} · {{eq.location.productionLine}}</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <nz-tag [nzColor]="eq.status === 'running' ? 'green' : eq.status === 'critical' ? 'red' : eq.status === 'warning' ? 'gold' : 'default'" style="font-size:14px;padding:4px 16px;">
            {{eq.status | uppercase}}
          </nz-tag>
          <div class="health-badge" [class]="eq.healthScore > 70 ? 'good' : eq.healthScore > 40 ? 'warn' : 'bad'">
            <span class="health-num">{{eq.healthScore}}</span><span class="health-label">Health</span>
          </div>
        </div>
      </div>

      <nz-tabset nzType="card" nzSize="default">
        <!-- Tab 1: Basic Info -->
        <nz-tab nzTitle="Thông tin cơ bản">
          <div class="tab-grid">
            <nz-card nzTitle="Thông số kỹ thuật" class="info-card">
              <nz-descriptions nzBordered nzSize="small" [nzColumn]="2">
                <nz-descriptions-item nzTitle="Serial Number"><span class="mono">{{eq.serialNumber}}</span></nz-descriptions-item>
                <nz-descriptions-item nzTitle="Nhà sản xuất">{{eq.manufacturer}}</nz-descriptions-item>
                <nz-descriptions-item nzTitle="Model">{{eq.model}}</nz-descriptions-item>
                <nz-descriptions-item nzTitle="Năm SX">{{eq.yearManufactured}}</nz-descriptions-item>
                <nz-descriptions-item nzTitle="Công suất">{{eq.specs.power}}</nz-descriptions-item>
                <nz-descriptions-item nzTitle="Tốc độ định mức">{{eq.specs.ratedSpeed || 'N/A'}}</nz-descriptions-item>
                <nz-descriptions-item nzTitle="Nhiệt độ tối đa">{{eq.specs.maxTemperature || 'N/A'}}°C</nz-descriptions-item>
                <nz-descriptions-item nzTitle="Áp suất tối đa">{{eq.specs.maxPressure || 'N/A'}} bar</nz-descriptions-item>
              </nz-descriptions>
            </nz-card>
            <nz-card nzTitle="Vị trí" class="info-card">
              <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
                <nz-descriptions-item nzTitle="Tòa nhà">{{eq.location.building}}</nz-descriptions-item>
                <nz-descriptions-item nzTitle="Tầng">{{eq.location.floor}}</nz-descriptions-item>
                <nz-descriptions-item nzTitle="Dây chuyền">{{eq.location.productionLine}}</nz-descriptions-item>
                <nz-descriptions-item nzTitle="Trạm">{{eq.location.workstation}}</nz-descriptions-item>
              </nz-descriptions>
            </nz-card>
          </div>
        </nz-tab>

        <!-- Tab 2: Sensor Data -->
        <nz-tab nzTitle="Sensor & Real-time">
          <div class="sensor-grid">
            <nz-card *ngFor="let s of sensors" [nzTitle]="s.name" class="sensor-card" [class]="'sensor-' + s.status">
              <div class="sensor-value">
                <span class="val">{{s.currentValue}}</span><span class="unit">{{s.unit}}</span>
              </div>
              <nz-tag [nzColor]="s.status === 'normal' ? 'green' : s.status === 'warning' ? 'gold' : 'red'">{{s.status | uppercase}}</nz-tag>
              <div class="sensor-range">
                <span>Min: {{s.minThreshold}}</span><span>Max: {{s.maxThreshold}}</span>
              </div>
              <div echarts [options]="getSensorSparkline(s)" style="height:80px;width:100%;"></div>
            </nz-card>
          </div>
        </nz-tab>

        <!-- Tab 3: Health & Predictions -->
        <nz-tab nzTitle="Health & AI Predictions">
          <div class="predict-grid">
            <nz-card nzTitle="Health Score" class="info-card">
              <div echarts [options]="healthGaugeOpts" style="height:250px;"></div>
            </nz-card>
            <nz-card nzTitle="AI Predictions" class="info-card">
              <div class="predict-items">
                <div class="predict-item">
                  <span class="predict-label">Xác suất hỏng (7 ngày)</span>
                  <nz-progress [nzPercent]="failProb7" [nzStrokeColor]="failProb7 > 50 ? '#ef4444' : '#f59e0b'" nzSize="small"></nz-progress>
                </div>
                <div class="predict-item">
                  <span class="predict-label">Xác suất hỏng (14 ngày)</span>
                  <nz-progress [nzPercent]="failProb14" [nzStrokeColor]="failProb14 > 50 ? '#ef4444' : '#f59e0b'" nzSize="small"></nz-progress>
                </div>
                <div class="predict-item">
                  <span class="predict-label">Xác suất hỏng (30 ngày)</span>
                  <nz-progress [nzPercent]="failProb30" [nzStrokeColor]="failProb30 > 50 ? '#ef4444' : '#f59e0b'" nzSize="small"></nz-progress>
                </div>
                <div class="rul-display">
                  <span class="rul-label">Remaining Useful Life</span>
                  <span class="rul-value">{{rulDays}} ngày</span>
                  <nz-progress [nzPercent]="rulPercent" [nzStrokeColor]="{ '0%': '#ef4444', '50%': '#f59e0b', '100%': '#10b981' }" nzSize="small"></nz-progress>
                </div>
                <div class="ai-explain">
                  <i class="fa-solid fa-robot text-indigo-500"></i>
                  <span>{{aiExplanation}}</span>
                </div>
              </div>
            </nz-card>
          </div>
        </nz-tab>

        <!-- Tab 4: Maintenance History -->
        <nz-tab nzTitle="Lịch sử Bảo trì">
          <nz-card>
            <nz-timeline>
              <nz-timeline-item *ngFor="let h of maintenanceHistory" [nzColor]="h.color">
                <p class="font-medium">{{h.date}} — {{h.type}}</p>
                <p class="text-gray-500 text-sm">{{h.description}}</p>
                <p class="text-xs text-gray-400">Kỹ thuật viên: {{h.technician}} · Chi phí: {{h.cost | number}} VNĐ</p>
              </nz-timeline-item>
            </nz-timeline>
          </nz-card>
        </nz-tab>

        <!-- Tab 5: Spare Parts -->
        <nz-tab nzTitle="Linh kiện">
          <nz-card>
            <div class="parts-list">
              <div *ngFor="let p of spareParts" class="part-item">
                <div><span class="font-medium">{{p.name}}</span><span class="mono text-xs text-gray-400 ml-2">{{p.partNumber}}</span></div>
                <div class="flex items-center gap-3">
                  <span>Tồn: <strong [class]="p.quantity === 0 ? 'text-red-500' : p.quantity <= p.reorderPoint ? 'text-amber-500' : 'text-emerald-600'">{{p.quantity}}</strong> {{p.unit}}</span>
                  <nz-tag [nzColor]="p.status === 'ok' ? 'green' : p.status === 'low_stock' ? 'gold' : p.status === 'out_of_stock' ? 'red' : 'blue'">{{p.status}}</nz-tag>
                </div>
              </div>
            </div>
          </nz-card>
        </nz-tab>
      </nz-tabset>
    </div>
  `,
  styles: [`
    .detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
    .page-title { font-size: 24px; font-weight: 700; color: #0f172a; margin: 0; }
    .page-desc { font-size: 13px; color: #64748b; }
    .flex { display: flex; }
    .items-center { align-items: center; }
    .gap-4 { gap: 16px; }
    .gap-3 { gap: 12px; }
    .back-btn { width: 40px; height: 40px; border-radius: 10px; border: 1px solid #e2e8f0; background: white; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .back-btn:hover { background: #f1f5f9; }
    .health-badge { width: 64px; height: 64px; border-radius: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .health-badge.good { background: #ecfdf5; }
    .health-badge.warn { background: #fffbeb; }
    .health-badge.bad { background: #fef2f2; }
    .health-num { font-size: 22px; font-weight: 800; font-family: 'JetBrains Mono', monospace; }
    .health-badge.good .health-num { color: #059669; }
    .health-badge.warn .health-num { color: #d97706; }
    .health-badge.bad .health-num { color: #dc2626; }
    .health-label { font-size: 10px; color: #64748b; }
    .tab-grid, .predict-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .info-card { border-radius: 12px !important; }
    .sensor-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .sensor-card { border-radius: 12px !important; }
    .sensor-card.sensor-warning { border-left: 3px solid #f59e0b !important; }
    .sensor-card.sensor-critical { border-left: 3px solid #ef4444 !important; }
    .sensor-value { font-size: 32px; font-weight: 700; font-family: 'JetBrains Mono', monospace; margin-bottom: 8px; }
    .sensor-value .unit { font-size: 14px; color: #64748b; margin-left: 4px; }
    .sensor-range { display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; margin: 8px 0; }
    .predict-items { display: flex; flex-direction: column; gap: 16px; }
    .predict-item { }
    .predict-label { font-size: 13px; color: #475569; display: block; margin-bottom: 4px; }
    .rul-display { padding: 16px; background: #f8fafc; border-radius: 10px; }
    .rul-label { font-size: 12px; color: #64748b; }
    .rul-value { font-size: 28px; font-weight: 700; color: #0f172a; display: block; margin: 4px 0 8px; font-family: 'JetBrains Mono', monospace; }
    .ai-explain { display: flex; gap: 10px; padding: 12px; background: #eff6ff; border-radius: 10px; font-size: 13px; color: #1e40af; }
    .parts-list { display: flex; flex-direction: column; gap: 12px; }
    .part-item { display: flex; justify-content: space-between; align-items: center; padding: 12px; border-radius: 8px; background: #f8fafc; }
    .mono { font-family: 'JetBrains Mono', monospace; }
    .font-medium { font-weight: 500; }
    .ml-2 { margin-left: 8px; }
    .text-sm { font-size: 14px; }
    .text-xs { font-size: 12px; }
  `]
})
export class EquipmentDetailComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  eq: Equipment | null = null;
  sensors: Sensor[] = [];
  healthGaugeOpts: any = {};
  failProb7 = 0; failProb14 = 0; failProb30 = 0; rulDays = 0; rulPercent = 0;
  aiExplanation = '';
  maintenanceHistory = [
    { date: '2026-02-10', type: 'Preventive', description: 'Bảo trì định kỳ: kiểm tra, bôi trơn, thay lọc', technician: 'Phạm Anh Tuấn', cost: 4500000, color: 'blue' },
    { date: '2026-01-15', type: 'Corrective', description: 'Thay ổ bi do rung động bất thường', technician: 'Lê Minh Khoa', cost: 12000000, color: 'red' },
    { date: '2025-12-20', type: 'Predictive', description: 'Thay dầu theo khuyến nghị AI', technician: 'Phạm Anh Tuấn', cost: 3200000, color: 'purple' },
    { date: '2025-11-01', type: 'Preventive', description: 'Bảo trì định kỳ quý 4', technician: 'Phạm Anh Tuấn', cost: 5000000, color: 'blue' },
  ];
  spareParts: any[] = [];

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.api.getEquipmentById(id).subscribe(eq => {
      if (eq) {
        this.eq = eq;
        this.sensors = eq.sensors;
        this.failProb7 = eq.healthScore < 40 ? 78 : eq.healthScore < 70 ? 32 : 8;
        this.failProb14 = this.failProb7 + 12;
        this.failProb30 = this.failProb14 + 15;
        this.rulDays = eq.healthScore < 40 ? 14 : eq.healthScore < 70 ? 82 : 200;
        this.rulPercent = Math.min(100, Math.round(this.rulDays / 365 * 100));
        this.aiExplanation = eq.healthScore < 40 ? 'Phân tích cho thấy cách điện cuộn dây suy giảm kết hợp rung động tăng. Khuyến nghị dừng máy kiểm tra trong 7 ngày.' : 'Thiết bị hoạt động ổn định. Tiếp tục theo dõi theo lịch bảo trì định kỳ.';
        this.initGauge(eq.healthScore);
      }
    });
    this.api.getSpareParts().subscribe(p => this.spareParts = p.slice(0, 4));
  }

  initGauge(score: number) {
    this.healthGaugeOpts = {
      series: [{
        type: 'gauge', startAngle: 200, endAngle: -20, min: 0, max: 100,
        pointer: { show: true, length: '55%', width: 5, itemStyle: { color: score > 70 ? '#10b981' : score > 40 ? '#f59e0b' : '#ef4444' } },
        axisLine: { lineStyle: { width: 18, color: [[0.4, '#ef4444'], [0.7, '#f59e0b'], [1, '#10b981']] } },
        axisTick: { show: false }, splitLine: { show: false },
        axisLabel: { distance: 25, fontSize: 11, color: '#64748b' },
        detail: { valueAnimation: true, fontSize: 32, fontWeight: 700, offsetCenter: [0, '35%'], color: '#0f172a', formatter: '{value}' },
        title: { offsetCenter: [0, '65%'], fontSize: 13, color: '#64748b' },
        data: [{ value: score, name: 'Health Score' }]
      }]
    };
  }

  getSensorSparkline(s: Sensor): any {
    return {
      grid: { left: 0, right: 0, top: 0, bottom: 0 },
      xAxis: { show: false, data: s.sparklineData?.map((_, i) => i) || [] },
      yAxis: { show: false },
      series: [{ type: 'line', data: s.sparklineData || [], smooth: true, symbol: 'none', lineStyle: { width: 2, color: s.status === 'critical' ? '#ef4444' : s.status === 'warning' ? '#f59e0b' : '#10b981' }, areaStyle: { color: s.status === 'critical' ? 'rgba(239,68,68,0.1)' : s.status === 'warning' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)' } }]
    };
  }
}
