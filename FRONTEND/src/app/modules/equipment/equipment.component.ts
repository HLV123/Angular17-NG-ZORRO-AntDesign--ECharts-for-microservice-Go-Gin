import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { ApiService } from '../../core/services/api.service';
import { Equipment } from '../../core/models';

@Component({
  selector: 'app-equipment',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, NzTableModule, NzInputModule, NzSelectModule, NzButtonModule, NzTagModule, NzProgressModule, NzCardModule, NzBadgeModule, NzDropDownModule, NzIconModule],
  template: `
    <div class="fade-in">
      <div class="page-header">
        <div>
          <h1 class="page-title">Quản lý Thiết bị</h1>
          <p class="page-desc">Equipment Management · {{equipment.length}} thiết bị · REST API /api/equipment</p>
        </div>
        <div class="flex gap-3">
          <button nz-button nzType="default"><i class="fa-solid fa-file-export mr-2"></i>Export CSV</button>
          <button nz-button nzType="primary"><i class="fa-solid fa-plus mr-2"></i>Thêm thiết bị</button>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="stats-row">
        <div class="stat-card"><div class="stat-value text-emerald-600">{{countByStatus('running')}}</div><div class="stat-label">Đang chạy</div></div>
        <div class="stat-card"><div class="stat-value text-amber-500">{{countByStatus('warning')}}</div><div class="stat-label">Cảnh báo</div></div>
        <div class="stat-card"><div class="stat-value text-red-500">{{countByStatus('critical')}}</div><div class="stat-label">Nguy hiểm</div></div>
        <div class="stat-card"><div class="stat-value text-gray-400">{{countByStatus('maintenance') + countByStatus('offline') + countByStatus('idle')}}</div><div class="stat-label">Bảo trì/Offline</div></div>
      </div>

      <!-- Filters -->
      <div class="filter-bar">
        <nz-input-group nzSize="default" [nzPrefix]="searchIcon" class="search-box">
          <input nz-input [(ngModel)]="searchText" placeholder="Tìm kiếm thiết bị..." (ngModelChange)="filterData()" />
        </nz-input-group>
        <ng-template #searchIcon><i class="fa-solid fa-search text-gray-400"></i></ng-template>
        <nz-select [(ngModel)]="filterStatus" (ngModelChange)="filterData()" nzPlaceHolder="Trạng thái" nzAllowClear style="width:160px;">
          <nz-option nzValue="running" nzLabel="Đang chạy"></nz-option>
          <nz-option nzValue="warning" nzLabel="Cảnh báo"></nz-option>
          <nz-option nzValue="critical" nzLabel="Nguy hiểm"></nz-option>
          <nz-option nzValue="maintenance" nzLabel="Bảo trì"></nz-option>
        </nz-select>
        <nz-select [(ngModel)]="filterType" (ngModelChange)="filterData()" nzPlaceHolder="Loại thiết bị" nzAllowClear style="width:180px;">
          <nz-option nzValue="cnc_machine" nzLabel="CNC Machine"></nz-option>
          <nz-option nzValue="press" nzLabel="Máy ép"></nz-option>
          <nz-option nzValue="conveyor" nzLabel="Băng tải"></nz-option>
          <nz-option nzValue="robot" nzLabel="Robot"></nz-option>
          <nz-option nzValue="pump" nzLabel="Bơm"></nz-option>
          <nz-option nzValue="compressor" nzLabel="Máy nén"></nz-option>
        </nz-select>
      </div>

      <!-- Table -->
      <nz-card class="table-card">
        <nz-table #eqTable [nzData]="filtered" nzSize="middle" [nzPageSize]="10" nzShowSizeChanger [nzFrontPagination]="true">
          <thead>
            <tr>
              <th nzWidth="100px">Asset ID</th>
              <th>Tên thiết bị</th>
              <th>Loại</th>
              <th>Dây chuyền</th>
              <th nzWidth="100px">Trạng thái</th>
              <th nzWidth="130px">Health Score</th>
              <th>Bảo trì gần nhất</th>
              <th>Bảo trì tiếp theo</th>
              <th nzWidth="80px"></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let eq of eqTable.data" class="eq-row" [routerLink]="['/equipment', eq.id]" style="cursor:pointer;">
              <td><span class="mono text-xs">{{eq.assetId}}</span></td>
              <td><span class="font-medium">{{eq.name}}</span></td>
              <td><nz-tag>{{eq.type | titlecase}}</nz-tag></td>
              <td>{{eq.location.productionLine}}</td>
              <td>
                <nz-tag [nzColor]="getStatusColor(eq.status)">
                  <i class="fa-solid fa-circle text-xs mr-1"></i>{{getStatusLabel(eq.status)}}
                </nz-tag>
              </td>
              <td>
                <div class="flex items-center gap-2">
                  <nz-progress [nzPercent]="eq.healthScore" nzSize="small" [nzShowInfo]="false" [nzStrokeColor]="eq.healthScore > 70 ? '#10b981' : eq.healthScore > 40 ? '#f59e0b' : '#ef4444'" style="width:60px;"></nz-progress>
                  <span class="mono text-xs font-bold" [style.color]="eq.healthScore > 70 ? '#059669' : eq.healthScore > 40 ? '#d97706' : '#dc2626'">{{eq.healthScore}}%</span>
                </div>
              </td>
              <td class="text-xs text-gray-500">{{eq.lastMaintenanceDate}}</td>
              <td class="text-xs text-gray-500">{{eq.nextMaintenanceDate}}</td>
              <td><button nz-button nzSize="small" nzType="link"><i class="fa-solid fa-arrow-right"></i></button></td>
            </tr>
          </tbody>
        </nz-table>
      </nz-card>
    </div>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
    .page-title { font-size: 24px; font-weight: 700; color: #0f172a; }
    .page-desc { font-size: 13px; color: #64748b; }
    .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
    .stat-card { background: white; border-radius: 12px; padding: 16px 20px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .stat-value { font-size: 28px; font-weight: 700; }
    .stat-label { font-size: 12px; color: #64748b; margin-top: 2px; }
    .filter-bar { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .search-box { width: 300px; }
    .table-card { border-radius: 16px !important; }
    .flex { display: flex; }
    .gap-3 { gap: 12px; }
    .gap-2 { gap: 8px; }
    .items-center { align-items: center; }
    .mr-2 { margin-right: 8px; }
    .mono { font-family: 'JetBrains Mono', monospace; }
    .font-medium { font-weight: 500; }
    .eq-row:hover { background: #f8fafc; }
  `]
})
export class EquipmentComponent implements OnInit {
  private api = inject(ApiService);
  equipment: Equipment[] = [];
  filtered: Equipment[] = [];
  searchText = '';
  filterStatus: string | null = null;
  filterType: string | null = null;

  ngOnInit() {
    this.api.getEquipment().subscribe(d => { this.equipment = d; this.filtered = d; });
  }

  filterData() {
    this.filtered = this.equipment.filter(e => {
      const matchSearch = !this.searchText || e.name.toLowerCase().includes(this.searchText.toLowerCase()) || e.assetId.toLowerCase().includes(this.searchText.toLowerCase());
      const matchStatus = !this.filterStatus || e.status === this.filterStatus;
      const matchType = !this.filterType || e.type === this.filterType;
      return matchSearch && matchStatus && matchType;
    });
  }

  countByStatus(s: string): number { return this.equipment.filter(e => e.status === s).length; }

  getStatusColor(s: string): string {
    return s === 'running' ? 'green' : s === 'warning' ? 'gold' : s === 'critical' ? 'red' : 'default';
  }
  getStatusLabel(s: string): string {
    const m: Record<string,string> = { running: 'Đang chạy', warning: 'Cảnh báo', critical: 'Nguy hiểm', maintenance: 'Bảo trì', offline: 'Offline', idle: 'Chờ' };
    return m[s] || s;
  }
}
