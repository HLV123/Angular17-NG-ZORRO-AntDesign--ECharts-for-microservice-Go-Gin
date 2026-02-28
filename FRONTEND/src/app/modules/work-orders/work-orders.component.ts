import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { ApiService } from '../../core/services/api.service';
import { WorkOrder } from '../../core/models';

@Component({
  selector: 'app-work-orders', standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, NzCardModule, NzTagModule, NzButtonModule, NzTabsModule, NzProgressModule, NzTableModule, NzSelectModule, NzBadgeModule, DragDropModule],
  template: `
    <div class="fade-in">
      <div class="page-header"><div><h1 class="page-title">Quản lý Lệnh Công việc</h1><p class="page-desc">Work Order Management · Kanban Board · REST API</p></div>
        <button nz-button nzType="primary"><i class="fa-solid fa-plus mr-2"></i>Tạo Work Order</button>
      </div>
      <div class="stats-row">
        <div class="stat-card"><div class="stat-num text-blue-600">{{countStatus('draft','submitted','approved')}}</div><div class="stat-lab">Chờ xử lý</div></div>
        <div class="stat-card"><div class="stat-num text-amber-500">{{countStatus('in_progress','assigned','scheduled')}}</div><div class="stat-lab">Đang thực hiện</div></div>
        <div class="stat-card"><div class="stat-num text-green-600">{{countStatus('completed','verified','closed')}}</div><div class="stat-lab">Hoàn thành</div></div>
        <div class="stat-card"><div class="stat-num text-red-500">{{countOverdue()}}</div><div class="stat-lab">Quá hạn</div></div>
      </div>
      <nz-tabset nzType="card">
        <nz-tab nzTitle="Kanban Board">
          <div class="kanban-board">
            <div *ngFor="let col of kanbanCols" class="kanban-col">
              <div class="kanban-col-header" [style.border-top-color]="col.color">
                <span>{{col.label}}</span><nz-badge [nzCount]="getColItems(col.statuses).length" [nzStyle]="{backgroundColor: col.color}"></nz-badge>
              </div>
              <div class="kanban-items">
                <div *ngFor="let wo of getColItems(col.statuses)" class="kanban-card" [routerLink]="['/work-orders', wo.id]">
                  <div class="kc-header"><nz-tag [nzColor]="prioColor(wo.priority)">{{wo.priority}}</nz-tag><span class="kc-id mono">{{wo.woNumber}}</span></div>
                  <div class="kc-title">{{wo.title}}</div>
                  <div class="kc-meta"><span><i class="fa-solid fa-user text-gray-400"></i> {{wo.assignedTo}}</span>
                    <nz-progress [nzPercent]="wo.completionRate" nzSize="small" [nzShowInfo]="false" style="width:50px;" [nzStrokeColor]="wo.completionRate>80?'#10b981':'#1e6fd9'"></nz-progress>
                  </div>
                  <div class="kc-type"><nz-tag [nzColor]="typeColor(wo.type)" style="font-size:10px;">{{wo.type}}</nz-tag></div>
                </div>
              </div>
            </div>
          </div>
        </nz-tab>
        <nz-tab nzTitle="Danh sách">
          <nz-card style="border-radius:16px !important;">
            <nz-table #woTbl [nzData]="workOrders" nzSize="middle" [nzPageSize]="10">
              <thead><tr><th>WO#</th><th>Tiêu đề</th><th>Priority</th><th>Loại</th><th>Thiết bị</th><th>Assigned</th><th>Trạng thái</th><th>Tiến độ</th><th>Deadline</th></tr></thead>
              <tbody><tr *ngFor="let wo of woTbl.data" [routerLink]="['/work-orders', wo.id]" style="cursor:pointer;">
                <td><span class="mono text-xs">{{wo.woNumber}}</span></td>
                <td class="font-medium">{{wo.title}}</td>
                <td><nz-tag [nzColor]="prioColor(wo.priority)">{{wo.priority}}</nz-tag></td>
                <td><nz-tag [nzColor]="typeColor(wo.type)">{{wo.type}}</nz-tag></td>
                <td>{{wo.equipmentName}}</td>
                <td>{{wo.assignedTo}}</td>
                <td><nz-tag>{{wo.status}}</nz-tag></td>
                <td><nz-progress [nzPercent]="wo.completionRate" nzSize="small" style="width:80px;"></nz-progress></td>
                <td class="text-xs text-gray-500">{{wo.deadline | date:'dd/MM/yyyy'}}</td>
              </tr></tbody>
            </nz-table>
          </nz-card>
        </nz-tab>
      </nz-tabset>
    </div>
  `,
  styles: [`
    .page-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:12px}.page-title{font-size:24px;font-weight:700}.page-desc{font-size:13px;color:#64748b}.mr-2{margin-right:8px}.mono{font-family:'JetBrains Mono',monospace}.font-medium{font-weight:500}
    .stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
    .stat-card{background:white;border-radius:12px;padding:16px 20px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.06)}.stat-num{font-size:28px;font-weight:700}.stat-lab{font-size:12px;color:#64748b}
    .kanban-board{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;min-height:400px}
    .kanban-col{background:#f8fafc;border-radius:12px;padding:12px;border-top:3px solid}
    .kanban-col-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;font-size:14px;font-weight:600;color:#374151}
    .kanban-items{display:flex;flex-direction:column;gap:10px}
    .kanban-card{background:white;border-radius:10px;padding:12px;box-shadow:0 1px 3px rgba(0,0,0,0.06);cursor:pointer;transition:transform 0.15s,box-shadow 0.15s}
    .kanban-card:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,0.08)}
    .kc-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}.kc-id{font-size:10px;color:#94a3b8}
    .kc-title{font-size:13px;font-weight:500;color:#1e293b;margin-bottom:8px}
    .kc-meta{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#64748b}
    .kc-type{margin-top:6px}
  `]
})
export class WorkOrdersComponent implements OnInit {
  private api = inject(ApiService);
  workOrders: WorkOrder[] = [];
  kanbanCols = [
    {label:'Chờ xử lý',statuses:['draft','submitted','approved'],color:'#3b82f6'},
    {label:'Đã lên lịch',statuses:['scheduled','assigned'],color:'#8b5cf6'},
    {label:'Đang thực hiện',statuses:['in_progress','pending_parts'],color:'#f59e0b'},
    {label:'Hoàn thành',statuses:['completed','verified','closed'],color:'#10b981'}
  ];
  ngOnInit() { this.api.getWorkOrders().subscribe(d => this.workOrders = d); }
  getColItems(statuses: string[]) { return this.workOrders.filter(w => statuses.includes(w.status)); }
  countStatus(...s: string[]) { return this.workOrders.filter(w => s.includes(w.status)).length; }
  countOverdue() { return this.workOrders.filter(w => new Date(w.deadline) < new Date() && !['completed','verified','closed'].includes(w.status)).length; }
  prioColor(p: string) { return p==='P1'?'red':p==='P2'?'orange':p==='P3'?'gold':'blue'; }
  typeColor(t: string) { return t==='predictive'?'purple':t==='preventive'?'blue':t==='corrective'?'red':'orange'; }
}
