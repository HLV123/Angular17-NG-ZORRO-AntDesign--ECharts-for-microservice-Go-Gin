import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NgxEchartsModule } from 'ngx-echarts';
import { ApiService } from '../../core/services/api.service';
import { Alert } from '../../core/models';
import { generateTimeSeriesData } from '../../core/mock/mock-data';

@Component({
  selector: 'app-alert-detail', standalone: true,
  imports: [CommonModule, RouterModule, NzCardModule, NzTagModule, NzButtonModule, NzTimelineModule, NzProgressModule, NzDescriptionsModule, NzStepsModule, NzBadgeModule, NzStatisticModule, NgxEchartsModule],
  template: `
    <div class="fade-in" *ngIf="alert">
      <div class="detail-header">
        <div class="flex items-center gap-4">
          <button class="back-btn" routerLink="/alerts"><i class="fa-solid fa-arrow-left"></i></button>
          <div><h1 class="text-xl font-bold">{{alert.title}}</h1><p class="text-sm text-gray-500">{{alert.equipmentName}} · {{alert.id}}</p></div>
        </div>
        <div class="flex gap-3">
          <nz-tag [nzColor]="alert.severity==='critical'?'red':alert.severity==='high'?'orange':'gold'" style="font-size:14px;padding:4px 16px;">{{alert.severity | uppercase}}</nz-tag>
          <nz-tag [nzColor]="statusColor(alert.status)" style="font-size:14px;padding:4px 16px;">{{alert.status | uppercase}}</nz-tag>
        </div>
      </div>

      <!-- Alert Status Steps -->
      <nz-card style="border-radius:16px !important;margin-bottom:20px;">
        <nz-steps [nzCurrent]="getStatusStep(alert.status)" nzSize="small">
          <nz-step nzTitle="Open"></nz-step><nz-step nzTitle="Acknowledged"></nz-step>
          <nz-step nzTitle="Assigned"></nz-step><nz-step nzTitle="In Progress"></nz-step>
          <nz-step nzTitle="Resolved"></nz-step><nz-step nzTitle="Closed"></nz-step>
        </nz-steps>
      </nz-card>

      <!-- SLA Countdown -->
      <div class="sla-bar" *ngIf="alert.slaDeadline && alert.status !== 'resolved' && alert.status !== 'closed'">
        <div class="sla-inner" [class.sla-danger]="slaMinutes < 30" [class.sla-warning]="slaMinutes >= 30 && slaMinutes < 120">
          <i class="fa-solid fa-clock"></i>
          <span>SLA Deadline: <strong>{{slaTimeStr}}</strong></span>
          <span class="sla-remaining">Còn lại: <strong>{{slaMinutes > 0 ? slaMinutes + ' phút' : 'ĐÃ QUÁ HẠN'}}</strong></span>
        </div>
      </div>

      <div class="grid-2">
        <!-- Left: Alert Info + Sensor Lookback -->
        <div class="left-col">
          <nz-card nzTitle="Thông tin cảnh báo" style="border-radius:16px !important;">
            <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
              <nz-descriptions-item nzTitle="Mô tả">{{alert.description}}</nz-descriptions-item>
              <nz-descriptions-item nzTitle="Loại"><nz-tag>{{alert.type}}</nz-tag></nz-descriptions-item>
              <nz-descriptions-item nzTitle="Dây chuyền">{{alert.productionLine}}</nz-descriptions-item>
              <nz-descriptions-item nzTitle="Thời gian">{{alert.createdAt | date:'dd/MM/yyyy HH:mm:ss'}}</nz-descriptions-item>
              <nz-descriptions-item nzTitle="Acknowledged">{{alert.acknowledgedAt ? (alert.acknowledgedAt | date:'dd/MM HH:mm') : 'Chưa'}} {{alert.acknowledgedBy ? '(' + alert.acknowledgedBy + ')' : ''}}</nz-descriptions-item>
              <nz-descriptions-item nzTitle="Người phụ trách">{{alert.assignedTo || 'Chưa assign'}}</nz-descriptions-item>
            </nz-descriptions>
            <div class="mt-4 flex gap-3">
              <button nz-button nzType="primary" *ngIf="alert.status==='open'" (click)="doAck()"><i class="fa-solid fa-check mr-2"></i>Acknowledge</button>
              <button nz-button nzType="default" routerLink="/work-orders"><i class="fa-solid fa-clipboard-list mr-2"></i>Tạo Work Order</button>
              <button nz-button nzType="default" [routerLink]="['/equipment', alert.equipmentId]"><i class="fa-solid fa-gears mr-2"></i>Xem thiết bị</button>
            </div>
          </nz-card>

          <!-- Sensor Lookback Chart -->
          <nz-card nzTitle="Sensor Data tại thời điểm cảnh báo (±1h)" style="border-radius:16px !important;margin-top:16px;" class="chart-card">
            <div echarts [options]="sensorLookbackOpts" style="height:280px;"></div>
          </nz-card>

          <!-- Alert Lifecycle Timeline -->
          <nz-card nzTitle="Lịch sử thay đổi trạng thái" style="border-radius:16px !important;margin-top:16px;">
            <nz-timeline>
              <nz-timeline-item *ngFor="let ev of alertTimeline" [nzColor]="ev.color">
                <p class="font-medium text-sm">{{ev.action}}</p>
                <p class="text-xs text-gray-500">{{ev.time}} · {{ev.user}}</p>
              </nz-timeline-item>
            </nz-timeline>
          </nz-card>
        </div>

        <!-- Right: AI Analysis + Contributing Factors + Recommended Actions + Related Alerts -->
        <div class="right-col">
          <nz-card nzTitle="AI Analysis" style="border-radius:16px !important;" *ngIf="alert.aiExplanation">
            <div class="ai-box"><i class="fa-solid fa-robot text-indigo-500 text-xl"></i><p>{{alert.aiExplanation}}</p></div>
            <div class="factors" *ngIf="alert.contributingFactors?.length">
              <h4 class="text-sm font-semibold mt-4 mb-2">Yếu tố ảnh hưởng (Top Contributing Factors)</h4>
              <div *ngFor="let f of alert.contributingFactors" class="factor-item">
                <span>{{f.factor}}</span>
                <nz-progress [nzPercent]="f.impact" nzSize="small" [nzShowInfo]="true" style="width:200px;" [nzStrokeColor]="f.impact > 30 ? '#ef4444' : '#f59e0b'"></nz-progress>
              </div>
            </div>
            <!-- SHAP Waterfall Chart -->
            <div echarts [options]="shapChartOpts" style="height:220px;margin-top:16px;" *ngIf="alert.contributingFactors?.length"></div>
          </nz-card>

          <nz-card nzTitle="Hành động khuyến nghị" style="border-radius:16px !important;margin-top:16px;" *ngIf="alert.recommendedActions?.length">
            <div *ngFor="let a of alert.recommendedActions; let i = index" class="action-item">
              <div class="action-left">
                <span class="action-num">{{i+1}}</span>
                <span>{{a}}</span>
              </div>
              <button nz-button nzSize="small" nzType="primary" nzGhost>Thực hiện</button>
            </div>
          </nz-card>

          <!-- Counterfactual -->
          <nz-card nzTitle="Counterfactual Analysis" style="border-radius:16px !important;margin-top:16px;" *ngIf="alert.contributingFactors?.length">
            <div class="counterfactual-box">
              <i class="fa-solid fa-lightbulb text-amber-500" style="font-size:20px;"></i>
              <div>
                <p class="text-sm"><strong>Nếu</strong> nhiệt độ giảm 10°C so với hiện tại:</p>
                <p class="text-sm text-emerald-600">→ Xác suất hỏng giảm <strong>45%</strong></p>
                <p class="text-sm mt-2"><strong>Nếu</strong> thay bộ lọc dầu ngay:</p>
                <p class="text-sm text-emerald-600">→ Tuổi thọ dự kiến tăng <strong>+30 ngày</strong></p>
              </div>
            </div>
          </nz-card>

          <!-- Related Alerts -->
          <nz-card nzTitle="Cảnh báo liên quan trước đó" style="border-radius:16px !important;margin-top:16px;">
            <div *ngFor="let ra of relatedAlerts" class="related-alert" [routerLink]="['/alerts', ra.id]">
              <nz-tag [nzColor]="ra.severity==='critical'?'red':ra.severity==='high'?'orange':'gold'" style="font-size:10px;">{{ra.severity}}</nz-tag>
              <div class="ra-info"><span class="ra-title">{{ra.title}}</span><span class="ra-time text-xs text-gray-400">{{ra.time}}</span></div>
            </div>
            <div *ngIf="!relatedAlerts.length" class="text-center text-gray-400 py-4 text-sm">Không có cảnh báo liên quan</div>
          </nz-card>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .detail-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px}
    .flex{display:flex}.items-center{align-items:center}.gap-4{gap:16px}.gap-3{gap:12px}.mr-2{margin-right:8px}.mt-4{margin-top:16px}.mt-2{margin-top:8px}.mb-2{margin-bottom:8px}.py-4{padding:8px 0}
    .back-btn{width:40px;height:40px;border-radius:10px;border:1px solid #e2e8f0;background:white;cursor:pointer;display:flex;align-items:center;justify-content:center}
    .back-btn:hover{background:#f1f5f9}
    .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:20px}
    .left-col,.right-col{display:flex;flex-direction:column}
    .sla-bar{margin-bottom:16px}
    .sla-inner{display:flex;align-items:center;gap:12px;padding:12px 20px;border-radius:12px;background:#eff6ff;color:#1e40af;font-size:14px}
    .sla-inner.sla-warning{background:#fffbeb;color:#92400e}
    .sla-inner.sla-danger{background:#fef2f2;color:#991b1b;animation:pulse 1.5s infinite}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.7}}
    .sla-remaining{margin-left:auto;font-size:13px}
    .ai-box{display:flex;gap:12px;padding:16px;background:#eff6ff;border-radius:12px;font-size:14px;color:#1e40af;align-items:flex-start}
    .factor-item{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px}
    .action-item{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-radius:8px;background:#f8fafc;margin-bottom:8px}
    .action-left{display:flex;align-items:center;gap:10px;font-size:13px}
    .action-num{width:24px;height:24px;border-radius:6px;background:#1e6fd9;color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700}
    .counterfactual-box{display:flex;gap:14px;padding:16px;background:#fffbeb;border-radius:12px;border:1px solid #fef3c7}
    .related-alert{display:flex;align-items:center;gap:10px;padding:8px;border-radius:8px;cursor:pointer;transition:background 0.15s;margin-bottom:4px}
    .related-alert:hover{background:#f8fafc}
    .ra-info{display:flex;flex-direction:column}.ra-title{font-size:13px;font-weight:500;color:#1e293b}
    .font-medium{font-weight:500}.text-sm{font-size:14px}.text-xs{font-size:12px}
    .chart-card :host ::ng-deep .ant-card-body{padding:12px !important}
    @media(max-width:1024px){.grid-2{grid-template-columns:1fr}}
  `]
})
export class AlertDetailComponent implements OnInit {
  private api = inject(ApiService); private route = inject(ActivatedRoute);
  alert: Alert | null = null;
  sensorLookbackOpts: any = {};
  shapChartOpts: any = {};
  slaMinutes = 0;
  slaTimeStr = '';
  alertTimeline: any[] = [];
  relatedAlerts: any[] = [];

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.api.getAlertById(id).subscribe(a => {
      if (a) {
        this.alert = a;
        this.initSensorLookback();
        this.initSHAPChart();
        this.computeSLA();
        this.buildTimeline();
        this.buildRelatedAlerts();
      }
    });
  }

  statusColor(s: string) { return s==='open'?'red':s==='acknowledged'?'orange':s==='in_progress'?'blue':s==='resolved'?'green':'default'; }

  getStatusStep(s: string): number {
    const map: Record<string,number> = {open:0,acknowledged:1,assigned:2,in_progress:3,resolved:4,closed:5,escalated:3};
    return map[s] ?? 0;
  }

  doAck() {
    if (this.alert) {
      this.api.acknowledgeAlert(this.alert.id, 'Current User').subscribe(a => {
        if (a && this.alert) { this.alert = a; this.buildTimeline(); }
      });
    }
  }

  computeSLA() {
    if (this.alert?.slaDeadline) {
      const deadline = new Date(this.alert.slaDeadline);
      this.slaTimeStr = deadline.toLocaleString('vi-VN');
      this.slaMinutes = Math.max(0, Math.floor((deadline.getTime() - Date.now()) / 60000));
    }
  }

  buildTimeline() {
    if (!this.alert) return;
    this.alertTimeline = [
      { action: 'Cảnh báo được tạo', time: new Date(this.alert.createdAt).toLocaleString('vi-VN'), user: 'System', color: 'red' },
    ];
    if (this.alert.acknowledgedAt) {
      this.alertTimeline.push({ action: 'Đã xác nhận (Acknowledged)', time: new Date(this.alert.acknowledgedAt).toLocaleString('vi-VN'), user: this.alert.acknowledgedBy || '', color: 'orange' });
    }
    if (this.alert.assignedTo) {
      this.alertTimeline.push({ action: 'Assign cho ' + this.alert.assignedTo, time: '', user: 'Maintenance Manager', color: 'blue' });
    }
    if (this.alert.status === 'in_progress') {
      this.alertTimeline.push({ action: 'Đang xử lý', time: '', user: this.alert.assignedTo || '', color: 'blue' });
    }
    if (this.alert.resolvedAt) {
      this.alertTimeline.push({ action: 'Đã giải quyết', time: new Date(this.alert.resolvedAt).toLocaleString('vi-VN'), user: '', color: 'green' });
    }
  }

  buildRelatedAlerts() {
    if (!this.alert) return;
    this.relatedAlerts = [
      { id: 'ALT_R1', severity: 'medium', title: 'Nhiệt độ tăng dần - ' + this.alert.equipmentName, time: '3 ngày trước' },
      { id: 'ALT_R2', severity: 'low', title: 'Rung động nhẹ - ' + this.alert.equipmentName, time: '7 ngày trước' },
    ];
  }

  initSensorLookback() {
    const data = generateTimeSeriesData(2, 78, 20);
    this.sensorLookbackOpts = {
      tooltip: { trigger: 'axis' },
      grid: { left: '8%', right: '3%', top: '10%', bottom: '10%' },
      xAxis: { type: 'category', data: data.map(d => d.time) },
      yAxis: { type: 'value', name: '°C' },
      series: [{
        type: 'line', data: data.map(d => d.value), smooth: true,
        itemStyle: { color: '#ef4444' }, areaStyle: { color: 'rgba(239,68,68,0.1)' },
        markLine: { data: [
          { yAxis: 85, lineStyle: { color: '#f59e0b', type: 'dashed' }, label: { formatter: 'Warning', position: 'end' } },
          { yAxis: 95, lineStyle: { color: '#ef4444', type: 'dashed' }, label: { formatter: 'Critical', position: 'end' } },
        ]},
        markPoint: { data: [{ type: 'max', name: 'Max' }], itemStyle: { color: '#ef4444' } }
      }]
    };
  }

  initSHAPChart() {
    if (!this.alert?.contributingFactors?.length) return;
    const factors = [...this.alert.contributingFactors].reverse();
    this.shapChartOpts = {
      title: { text: 'SHAP Feature Importance', textStyle: { fontSize: 13, color: '#64748b' } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '35%', right: '8%', top: '15%', bottom: '5%' },
      xAxis: { type: 'value', name: 'Impact %', axisLabel: { fontSize: 11 } },
      yAxis: { type: 'category', data: factors.map(f => f.factor), axisLabel: { fontSize: 11 } },
      series: [{ type: 'bar', data: factors.map(f => f.impact), itemStyle: { color: '#6366f1', borderRadius: [0, 6, 6, 0] }, barWidth: 20 }]
    };
  }
}
