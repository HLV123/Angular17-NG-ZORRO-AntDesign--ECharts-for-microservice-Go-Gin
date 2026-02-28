import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { ApiService } from '../../core/services/api.service';
import { AuditLog } from '../../core/models';

@Component({
  selector: 'app-settings', standalone: true,
  imports: [CommonModule, FormsModule, NzCardModule, NzTabsModule, NzFormModule, NzInputModule, NzSelectModule, NzSwitchModule, NzButtonModule, NzTagModule, NzTableModule, NzBadgeModule, NzDescriptionsModule],
  template: `
    <div class="fade-in">
      <div class="page-header"><div><h1 class="page-title">Cấu hình Hệ thống</h1><p class="page-desc">System Configuration · Integration · Audit & Compliance</p></div></div>
      <nz-tabset nzType="card">
        <nz-tab nzTitle="Nhà máy">
          <nz-card nzTitle="Cấu trúc Tổ chức" style="border-radius:16px !important;">
            <nz-descriptions nzBordered nzSize="small" [nzColumn]="2">
              <nz-descriptions-item nzTitle="Tên nhà máy">Nhà máy Maintenix - HCM</nz-descriptions-item>
              <nz-descriptions-item nzTitle="Timezone">Asia/Ho_Chi_Minh (UTC+7)</nz-descriptions-item>
              <nz-descriptions-item nzTitle="Ngôn ngữ">Tiếng Việt</nz-descriptions-item>
              <nz-descriptions-item nzTitle="Tiền tệ">VNĐ</nz-descriptions-item>
              <nz-descriptions-item nzTitle="Tòa nhà">Nhà xưởng A, Nhà xưởng B, Nhà phụ trợ</nz-descriptions-item>
              <nz-descriptions-item nzTitle="Dây chuyền">Dây chuyền A, Dây chuyền B, Hạ tầng</nz-descriptions-item>
            </nz-descriptions>
            <div class="shift-box">
              <h4 class="text-sm font-semibold mt-4 mb-3">Ca làm việc</h4>
              <div class="shift-grid">
                <div class="shift-card"><span class="shift-name">Ca sáng</span><span class="shift-time">06:00 - 14:00</span></div>
                <div class="shift-card"><span class="shift-name">Ca chiều</span><span class="shift-time">14:00 - 22:00</span></div>
                <div class="shift-card"><span class="shift-name">Ca đêm</span><span class="shift-time">22:00 - 06:00</span></div>
              </div>
            </div>
          </nz-card>
        </nz-tab>
        <nz-tab nzTitle="Tích hợp">
          <div class="integ-grid">
            <nz-card *ngFor="let i of integrations" class="integ-card" style="border-radius:16px !important;">
              <div class="integ-header"><span class="integ-name">{{i.name}}</span><nz-badge [nzStatus]="i.connected?'success':'default'" [nzText]="i.connected?'Connected':'Disconnected'"></nz-badge></div>
              <p class="text-sm text-gray-500 my-2">{{i.description}}</p>
              <div class="integ-config" *ngIf="i.url"><span class="mono text-xs">{{i.url}}</span></div>
              <button nz-button nzSize="small" [nzType]="i.connected?'default':'primary'" class="mt-2">{{i.connected?'Test Connection':'Connect'}}</button>
            </nz-card>
          </div>
        </nz-tab>
        <nz-tab nzTitle="Notifications">
          <nz-card nzTitle="SLA Configuration" style="border-radius:16px !important;">
            <div class="sla-grid">
              <div *ngFor="let s of slaConfig" class="sla-item">
                <nz-tag [nzColor]="s.color" style="font-size:13px;">{{s.severity}}</nz-tag>
                <div class="sla-details"><span>Acknowledge: {{s.ackTime}}</span><span>Resolve: {{s.resolveTime}}</span></div>
              </div>
            </div>
          </nz-card>
        </nz-tab>
        <nz-tab nzTitle="Audit Log">
          <nz-card style="border-radius:16px !important;">
            <nz-table #auditTbl [nzData]="auditLogs" nzSize="small">
              <thead><tr><th>Thời gian</th><th>Người dùng</th><th>Hành động</th><th>Tài nguyên</th><th>Chi tiết</th><th>IP</th></tr></thead>
              <tbody><tr *ngFor="let a of auditTbl.data">
                <td class="text-xs mono">{{a.timestamp | date:'dd/MM HH:mm:ss'}}</td>
                <td class="font-medium text-sm">{{a.userName}}</td>
                <td><nz-tag>{{a.action}}</nz-tag></td>
                <td>{{a.resource}} #{{a.resourceId}}</td>
                <td class="text-xs text-gray-500">{{a.details | slice:0:50}}</td>
                <td class="mono text-xs">{{a.ipAddress}}</td>
              </tr></tbody>
            </nz-table>
          </nz-card>
        </nz-tab>
      </nz-tabset>
    </div>
  `,
  styles: [`
    .page-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}.page-title{font-size:24px;font-weight:700}.page-desc{font-size:13px;color:#64748b}.mono{font-family:'JetBrains Mono',monospace}.font-medium{font-weight:500}
    .shift-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    .shift-card{padding:12px 16px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0}
    .shift-name{font-weight:600;display:block}.shift-time{font-size:13px;color:#64748b;font-family:'JetBrains Mono',monospace}
    .integ-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
    .integ-card{transition:transform 0.2s}.integ-card:hover{transform:translateY(-2px)}
    .integ-header{display:flex;justify-content:space-between;align-items:center}.integ-name{font-size:15px;font-weight:600}
    .integ-config{padding:6px 10px;background:#f1f5f9;border-radius:6px;margin-top:8px}
    .sla-grid{display:flex;flex-direction:column;gap:12px}
    .sla-item{display:flex;align-items:center;gap:16px;padding:12px;border-radius:10px;background:#f8fafc}
    .sla-details{display:flex;gap:24px;font-size:13px;color:#475569}
    .my-2{margin:8px 0}.mt-2{margin-top:8px}.mt-4{margin-top:16px}.mb-3{margin-bottom:12px}
  `]
})
export class SettingsComponent implements OnInit {
  private api = inject(ApiService);
  auditLogs: AuditLog[] = [];
  integrations = [
    {name:'Apache Kafka',description:'Event streaming cho sensor data ingestion',url:'kafka-broker:9092',connected:true},
    {name:'TimescaleDB',description:'Time-series sensor data storage',url:'timescaledb:5432',connected:true},
    {name:'PostgreSQL',description:'Master data, work orders',url:'postgres:5432',connected:true},
    {name:'Redis',description:'Cache & real-time session',url:'redis:6379',connected:true},
    {name:'HashiCorp Vault',description:'Secret management',url:'vault:8200',connected:false},
    {name:'MinIO',description:'File storage (attachments, manuals)',url:'minio:9000',connected:false},
    {name:'Prometheus',description:'Metrics collection',url:'prometheus:9090',connected:true},
    {name:'Grafana',description:'Infrastructure monitoring',url:'grafana:3000',connected:true},
    {name:'Jaeger',description:'Distributed tracing',url:'jaeger:16686',connected:false},
    {name:'OPC-UA Bridge',description:'SCADA/DCS integration',url:'opcua-bridge:4840',connected:false},
  ];
  slaConfig = [
    {severity:'Critical',ackTime:'15 phút',resolveTime:'4 giờ',color:'red'},
    {severity:'High',ackTime:'1 giờ',resolveTime:'8 giờ',color:'orange'},
    {severity:'Medium',ackTime:'4 giờ',resolveTime:'24 giờ',color:'gold'},
    {severity:'Low',ackTime:'8 giờ',resolveTime:'72 giờ',color:'blue'},
  ];
  ngOnInit() { this.api.getAuditLogs().subscribe(d => this.auditLogs = d); }
}
