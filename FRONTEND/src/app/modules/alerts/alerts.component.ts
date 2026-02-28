import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { Alert } from '../../core/models';

@Component({
  selector: 'app-alerts', standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, NzTableModule, NzTagModule, NzButtonModule, NzSelectModule, NzInputModule, NzCardModule, NzBadgeModule],
  template: `
    <div class="fade-in">
      <div class="page-header"><div><h1 class="page-title">Quản lý Cảnh báo</h1><p class="page-desc">Alert Management · WebSocket STOMP · SLA Tracking</p></div>
        <div class="flex gap-3"><button nz-button nzType="default"><i class="fa-solid fa-file-export mr-2"></i>Export</button></div>
      </div>
      <div class="stats-row">
        <div class="stat-card critical"><div class="stat-num">{{countSev('critical')}}</div><div class="stat-lab">Critical</div></div>
        <div class="stat-card high"><div class="stat-num">{{countSev('high')}}</div><div class="stat-lab">High</div></div>
        <div class="stat-card medium"><div class="stat-num">{{countSev('medium')}}</div><div class="stat-lab">Medium</div></div>
        <div class="stat-card low"><div class="stat-num">{{countSev('low')}}</div><div class="stat-lab">Low</div></div>
      </div>
      <div class="filter-bar">
        <nz-select [(ngModel)]="fSev" nzPlaceHolder="Severity" nzAllowClear (ngModelChange)="filter()" style="width:130px;"><nz-option nzValue="critical" nzLabel="Critical"></nz-option><nz-option nzValue="high" nzLabel="High"></nz-option><nz-option nzValue="medium" nzLabel="Medium"></nz-option><nz-option nzValue="low" nzLabel="Low"></nz-option></nz-select>
        <nz-select [(ngModel)]="fStatus" nzPlaceHolder="Trạng thái" nzAllowClear (ngModelChange)="filter()" style="width:150px;"><nz-option nzValue="open" nzLabel="Open"></nz-option><nz-option nzValue="acknowledged" nzLabel="Acknowledged"></nz-option><nz-option nzValue="in_progress" nzLabel="In Progress"></nz-option><nz-option nzValue="resolved" nzLabel="Resolved"></nz-option></nz-select>
        <nz-select [(ngModel)]="fType" nzPlaceHolder="Loại" nzAllowClear (ngModelChange)="filter()" style="width:160px;"><nz-option nzValue="sensor_threshold" nzLabel="Sensor Threshold"></nz-option><nz-option nzValue="ml_prediction" nzLabel="ML Prediction"></nz-option><nz-option nzValue="system" nzLabel="System"></nz-option><nz-option nzValue="manual" nzLabel="Manual"></nz-option></nz-select>
      </div>
      <nz-card style="border-radius:16px !important;">
        <nz-table #tbl [nzData]="filtered" nzSize="middle" [nzPageSize]="10">
          <thead><tr>
            <th nzWidth="90px">Severity</th><th>Thiết bị</th><th>Tiêu đề</th><th>Loại</th><th>Trạng thái</th><th>Thời gian</th><th nzWidth="100px">Hành động</th>
          </tr></thead>
          <tbody><tr *ngFor="let a of tbl.data" [class]="'row-' + a.severity" style="cursor:pointer;" [routerLink]="['/alerts', a.id]">
            <td><nz-tag [nzColor]="sevColor(a.severity)">{{a.severity | uppercase}}</nz-tag></td>
            <td class="font-medium">{{a.equipmentName}}</td>
            <td>{{a.title}}</td>
            <td><nz-tag>{{a.type}}</nz-tag></td>
            <td><nz-tag [nzColor]="statusColor(a.status)">{{a.status}}</nz-tag></td>
            <td class="text-sm text-gray-500">{{timeAgo(a.createdAt)}}</td>
            <td><button *ngIf="a.status==='open'" nz-button nzSize="small" nzType="primary" (click)="ack(a.id,$event)">Ack</button></td>
          </tr></tbody>
        </nz-table>
      </nz-card>
    </div>
  `,
  styles: [`
    .page-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:12px}.page-title{font-size:24px;font-weight:700}.page-desc{font-size:13px;color:#64748b}
    .flex{display:flex}.gap-3{gap:12px}.mr-2{margin-right:8px}.font-medium{font-weight:500}.text-sm{font-size:14px}
    .stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
    .stat-card{background:white;border-radius:12px;padding:16px 20px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.06);border-top:3px solid}
    .stat-card.critical{border-top-color:#ef4444}.stat-card.high{border-top-color:#f97316}.stat-card.medium{border-top-color:#eab308}.stat-card.low{border-top-color:#3b82f6}
    .stat-num{font-size:28px;font-weight:700}.stat-lab{font-size:12px;color:#64748b}
    .filter-bar{display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap}
    .row-critical{border-left:3px solid #ef4444}.row-high{border-left:3px solid #f97316}.row-medium{border-left:3px solid #eab308}.row-low{border-left:3px solid #3b82f6}
  `]
})
export class AlertsComponent implements OnInit {
  private api = inject(ApiService); private auth = inject(AuthService);
  alerts: Alert[] = []; filtered: Alert[] = [];
  fSev: string|null = null; fStatus: string|null = null; fType: string|null = null;
  ngOnInit() { this.api.getAlerts().subscribe(d => { this.alerts = d; this.filtered = d; }); }
  filter() { this.filtered = this.alerts.filter(a => (!this.fSev || a.severity === this.fSev) && (!this.fStatus || a.status === this.fStatus) && (!this.fType || a.type === this.fType)); }
  countSev(s: string) { return this.alerts.filter(a => a.severity === s).length; }
  sevColor(s: string) { return s==='critical'?'red':s==='high'?'orange':s==='medium'?'gold':'blue'; }
  statusColor(s: string) { return s==='open'?'red':s==='acknowledged'?'orange':s==='in_progress'?'blue':s==='resolved'?'green':'default'; }
  timeAgo(d: string) { const m=Math.floor((Date.now()-new Date(d).getTime())/60000); return m<60?m+' phút trước':m<1440?Math.floor(m/60)+' giờ trước':Math.floor(m/1440)+' ngày trước'; }
  ack(id: string, e: Event) { e.stopPropagation(); this.api.acknowledgeAlert(id, this.auth.currentUser?.fullName || '').subscribe(); }
}
