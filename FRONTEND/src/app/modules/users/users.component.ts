import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';

import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTabsModule } from 'ng-zorro-antd/tabs';

import { NgxEchartsModule } from 'ngx-echarts';
import { ApiService } from '../../core/services/api.service';
import { User } from '../../core/models';

@Component({
  selector: 'app-users', standalone: true,
  imports: [CommonModule, FormsModule, NzTableModule, NzTagModule, NzCardModule, NzButtonModule, NzAvatarModule, NzBadgeModule, NzInputModule, NzModalModule, NzSelectModule, NzTabsModule, NgxEchartsModule],
  template: `
    <div class="fade-in">
      <div class="page-header"><div><h1 class="page-title">Quản lý Người dùng & Phân quyền</h1><p class="page-desc">User Management · RBAC · OAuth 2.0 / OIDC · JWT</p></div>
        <div class="flex gap-3">
          <button nz-button nzType="default"><i class="fa-solid fa-file-import mr-2"></i>Import LDAP</button>
          <button nz-button nzType="primary" (click)="showAddUser()"><i class="fa-solid fa-plus mr-2"></i>Thêm người dùng</button>
        </div>
      </div>

      <!-- Stats -->
      <div class="stats-row">
        <div class="stat-card"><div class="stat-num text-blue-600">{{users.length}}</div><div class="stat-lab">Tổng người dùng</div></div>
        <div class="stat-card"><div class="stat-num text-green-600">{{countUsersByStatus('active')}}</div><div class="stat-lab">Đang hoạt động</div></div>
        <div class="stat-card"><div class="stat-num text-amber-500">{{countUsersByStatus('inactive')}}</div><div class="stat-lab">Không hoạt động</div></div>
        <div class="stat-card"><div class="stat-num text-purple-600">{{roleCount}}</div><div class="stat-lab">Vai trò</div></div>
      </div>

      <nz-tabset nzType="card">
        <!-- Tab 1: User List -->
        <nz-tab nzTitle="Danh sách">
          <nz-card style="border-radius:16px !important;">
            <div class="filter-row mb-3">
              <input nz-input placeholder="Tìm kiếm..." [(ngModel)]="searchText" (ngModelChange)="applyFilter()" style="width:220px;" />
              <nz-select [(ngModel)]="filterRole" nzPlaceHolder="Vai trò" nzAllowClear (ngModelChange)="applyFilter()" style="width:180px;">
                <nz-option *ngFor="let r of allRoles" [nzValue]="r.value" [nzLabel]="r.label"></nz-option>
              </nz-select>
              <nz-select [(ngModel)]="filterStatus" nzPlaceHolder="Trạng thái" nzAllowClear (ngModelChange)="applyFilter()" style="width:150px;">
                <nz-option nzValue="active" nzLabel="Active"></nz-option><nz-option nzValue="inactive" nzLabel="Inactive"></nz-option>
              </nz-select>
            </div>
            <nz-table #uTbl [nzData]="filtered" nzSize="middle" [nzPageSize]="10">
              <thead><tr><th></th><th>Họ tên</th><th>Username</th><th>Email</th><th>Vai trò</th><th>Phòng ban</th><th>Kỹ năng</th><th>Trạng thái</th><th>Đăng nhập gần nhất</th><th>Hành động</th></tr></thead>
              <tbody><tr *ngFor="let u of uTbl.data">
                <td><nz-avatar [nzText]="u.fullName.charAt(0)" nzSize="small" [nzStyle]="{background: getAvatarColor(u.role)}"></nz-avatar></td>
                <td class="font-medium">{{u.fullName}}</td>
                <td class="mono text-sm">{{u.username}}</td>
                <td>{{u.email}}</td>
                <td><nz-tag [nzColor]="roleColor(u.role)">{{roleLabel(u.role)}}</nz-tag></td>
                <td>{{u.department}}</td>
                <td>
                  <nz-tag *ngFor="let s of (u.skills || []).slice(0,2)" style="font-size:10px;">{{s}}</nz-tag>
                  <span *ngIf="(u.skills || []).length > 2" class="text-xs text-gray-400">+{{u.skills!.length - 2}}</span>
                </td>
                <td><nz-badge [nzStatus]="getBadgeStatus(u.status)" [nzText]="getBadgeText(u.status)"></nz-badge></td>
                <td class="text-xs text-gray-500">{{u.lastLogin | date:'dd/MM/yyyy HH:mm'}}</td>
                <td>
                  <button nz-button nzSize="small" nzType="link" (click)="editUser(u)"><i class="fa-solid fa-pen text-xs"></i></button>
                  <button nz-button nzSize="small" nzType="link" nzDanger><i class="fa-solid fa-ban text-xs"></i></button>
                </td>
              </tr></tbody>
            </nz-table>
          </nz-card>
        </nz-tab>

        <!-- Tab 2: RBAC Matrix -->
        <nz-tab nzTitle="Ma trận Phân quyền (RBAC)">
          <nz-card style="border-radius:16px !important;">
            <div class="rbac-table-wrap">
              <table class="rbac-table">
                <thead><tr><th>Module</th><th *ngFor="let r of roles">{{r}}</th></tr></thead>
                <tbody>
                  <tr *ngFor="let m of modules">
                    <td class="font-medium">{{m.name}}</td>
                    <td *ngFor="let r of roles" class="text-center">
                      <span [class]="m.perms[r]?'perm-yes':'perm-no'">{{m.perms[r]||'—'}}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </nz-card>
        </nz-tab>

        <!-- Tab 3: Login Activity -->
        <nz-tab nzTitle="Hoạt động Đăng nhập">
          <nz-card style="border-radius:16px !important;">
            <div echarts [options]="loginChartOpts" style="height:300px;"></div>
          </nz-card>
        </nz-tab>
      </nz-tabset>

      <nz-modal [(nzVisible)]="showModal" [nzTitle]="modalTitle" (nzOnOk)="saveUser()" (nzOnCancel)="closeModal()" nzWidth="500px">
        <ng-container *nzModalContent>
          <div class="modal-form" [innerHTML]="getFormHtml()"></div>
          <p class="text-sm text-gray-500" style="margin-top:16px;">Lưu ý: Tính năng form sẽ được tích hợp đầy đủ khi kết nối với backend API.</p>
        </ng-container>
      </nz-modal>
    </div>
  `,
  styles: [`
    .page-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:12px}.page-title{font-size:24px;font-weight:700}.page-desc{font-size:13px;color:#64748b}.mr-2{margin-right:8px}.mono{font-family:'JetBrains Mono',monospace}.font-medium{font-weight:500}.flex{display:flex}.gap-3{gap:12px}.text-xs{font-size:12px}.text-sm{font-size:14px}
    .stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
    .stat-card{background:white;border-radius:12px;padding:16px 20px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.06)}.stat-num{font-size:28px;font-weight:700}.stat-lab{font-size:12px;color:#64748b}
    .filter-row{display:flex;gap:12px;flex-wrap:wrap}.mb-3{margin-bottom:12px}
    .rbac-table-wrap{overflow-x:auto}
    .rbac-table{width:100%;border-collapse:collapse;font-size:13px}
    .rbac-table th,.rbac-table td{padding:8px 12px;border:1px solid #e2e8f0;text-align:left}
    .rbac-table th{background:#f8fafc;font-weight:600;font-size:11px}
    .perm-yes{color:#059669;font-weight:600}.perm-no{color:#cbd5e1}
    nz-form-item{margin-bottom:12px}
  `]
})
export class UsersComponent implements OnInit {
  private api = inject(ApiService);
  users: User[] = [];
  filtered: User[] = [];
  searchText = '';
  filterRole: string | null = null;
  filterStatus: string | null = null;
  showModal = false;
  isEditing = false;
  modalTitle = 'Thêm Người dùng';
  roleCount = 8;
  loginChartOpts: any = {};
  editForm = { fullName: '', username: '', email: '', role: '', department: '', status: 'active' };

  allRoles = [
    { value: 'super_admin', label: 'Super Admin' },
    { value: 'factory_manager', label: 'Factory Manager' },
    { value: 'maintenance_manager', label: 'Maint. Manager' },
    { value: 'maintenance_engineer', label: 'Engineer' },
    { value: 'technician', label: 'Technician' },
    { value: 'data_scientist', label: 'Data Scientist' },
    { value: 'quality_inspector', label: 'QC Inspector' },
    { value: 'viewer', label: 'Viewer' },
  ];

  roles = ['Super Admin', 'Factory Mgr', 'Maint. Mgr', 'Engineer', 'Technician', 'Data Sci.', 'QC', 'Viewer'];
  modules = [
    { name: 'Dashboard', perms: { 'Super Admin': 'Full', 'Factory Mgr': 'Full', 'Maint. Mgr': 'Full', 'Engineer': 'View', 'Technician': 'View', 'Data Sci.': 'View', 'QC': 'View', 'Viewer': 'View' } as Record<string, string> },
    { name: 'Equipment', perms: { 'Super Admin': 'Full', 'Factory Mgr': 'View', 'Maint. Mgr': 'Edit', 'Engineer': 'Edit', 'Technician': 'View', 'Data Sci.': 'View', 'QC': 'View', 'Viewer': '' } as Record<string, string> },
    { name: 'Sensors', perms: { 'Super Admin': 'Full', 'Factory Mgr': 'View', 'Maint. Mgr': 'View', 'Engineer': 'Full', 'Technician': 'View', 'Data Sci.': 'Full', 'QC': 'View', 'Viewer': '' } as Record<string, string> },
    { name: 'Alerts', perms: { 'Super Admin': 'Full', 'Factory Mgr': 'View', 'Maint. Mgr': 'Full', 'Engineer': 'Full', 'Technician': 'View', 'Data Sci.': 'View', 'QC': 'View', 'Viewer': '' } as Record<string, string> },
    { name: 'Work Orders', perms: { 'Super Admin': 'Full', 'Factory Mgr': 'Approve', 'Maint. Mgr': 'Full', 'Engineer': 'Edit', 'Technician': 'Own', 'Data Sci.': '', 'QC': 'View', 'Viewer': '' } as Record<string, string> },
    { name: 'Maintenance', perms: { 'Super Admin': 'Full', 'Factory Mgr': 'Approve', 'Maint. Mgr': 'Full', 'Engineer': 'Edit', 'Technician': 'View', 'Data Sci.': 'View', 'QC': '', 'Viewer': '' } as Record<string, string> },
    { name: 'Spare Parts', perms: { 'Super Admin': 'Full', 'Factory Mgr': 'View', 'Maint. Mgr': 'Full', 'Engineer': 'Edit', 'Technician': 'View', 'Data Sci.': '', 'QC': '', 'Viewer': '' } as Record<string, string> },
    { name: 'AI/ML Models', perms: { 'Super Admin': 'Full', 'Factory Mgr': 'View', 'Maint. Mgr': 'View', 'Engineer': 'View', 'Technician': '', 'Data Sci.': 'Full', 'QC': '', 'Viewer': '' } as Record<string, string> },
    { name: 'Reports', perms: { 'Super Admin': 'Full', 'Factory Mgr': 'Full', 'Maint. Mgr': 'Full', 'Engineer': 'View', 'Technician': '', 'Data Sci.': 'Full', 'QC': 'View', 'Viewer': 'View' } as Record<string, string> },
    { name: 'Settings', perms: { 'Super Admin': 'Full', 'Factory Mgr': '', 'Maint. Mgr': '', 'Engineer': '', 'Technician': '', 'Data Sci.': '', 'QC': '', 'Viewer': '' } as Record<string, string> },
  ];

  ngOnInit() {
    this.api.getUsers().subscribe(d => { this.users = d; this.filtered = d; });
    this.initChart();
  }
  countUsersByStatus(status: string): number { return this.users.filter(u => u.status === status).length; }

  applyFilter() {
    this.filtered = this.users.filter(u =>
      (!this.searchText || u.fullName.toLowerCase().includes(this.searchText.toLowerCase()) || u.username.toLowerCase().includes(this.searchText.toLowerCase())) &&
      (!this.filterRole || u.role === this.filterRole) &&
      (!this.filterStatus || u.status === this.filterStatus)
    );
  }

  roleColor(r: string) { const m: Record<string, string> = { super_admin: 'red', factory_manager: 'purple', maintenance_manager: 'blue', maintenance_engineer: 'cyan', technician: 'green', data_scientist: 'geekblue', quality_inspector: 'gold', viewer: 'default' }; return m[r] || 'default'; }
  roleLabel(r: string) { const m: Record<string, string> = { super_admin: 'Super Admin', factory_manager: 'Factory Manager', maintenance_manager: 'Maint. Manager', maintenance_engineer: 'Engineer', technician: 'Technician', data_scientist: 'Data Scientist', quality_inspector: 'QC Inspector', viewer: 'Viewer' }; return m[r] || r; }
  getAvatarColor(r: string) { const m: Record<string, string> = { super_admin: '#ef4444', factory_manager: '#8b5cf6', maintenance_manager: '#3b82f6', maintenance_engineer: '#06b6d4', technician: '#10b981', data_scientist: '#6366f1', quality_inspector: '#f59e0b', viewer: '#94a3b8' }; return m[r] || '#6366f1'; }

  showAddUser() { this.isEditing = false; this.modalTitle = 'Thêm Người dùng'; this.editForm = { fullName: '', username: '', email: '', role: 'technician', department: '', status: 'active' }; this.showModal = true; }
  editUser(u: User) { this.isEditing = true; this.modalTitle = 'Chỉnh sửa Người dùng'; this.editForm = { fullName: u.fullName, username: u.username, email: u.email, role: u.role, department: u.department, status: u.status }; this.showModal = true; }
  saveUser() { this.showModal = false; /* Mock save */ }
  setField(field: string, value: any) { (this.editForm as any)[field] = value; }
  getFormHtml(): string {
    const f = this.editForm;
    return `<div style="display:flex;flex-direction:column;gap:12px;">
      <div><strong>Họ tên:</strong> ${f.fullName || '(chưa nhập)'}</div>
      <div><strong>Username:</strong> ${f.username || '(chưa nhập)'}</div>
      <div><strong>Email:</strong> ${f.email || '(chưa nhập)'}</div>
      <div><strong>Vai trò:</strong> ${f.role}</div>
      <div><strong>Phòng ban:</strong> ${f.department || '(chưa nhập)'}</div>
      <div><strong>Trạng thái:</strong> ${f.status}</div>
    </div>`;
  }
  closeModal() { this.showModal = false; }
  getBadgeStatus(status: string): string { return status === 'active' ? 'success' : 'default'; }
  getBadgeText(status: string): string { return status === 'active' ? 'Active' : 'Inactive'; }

  initChart() {
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); return `${d.getDate()}/${d.getMonth() + 1}`; });
    this.loginChartOpts = {
      tooltip: { trigger: 'axis' }, legend: { data: ['Đăng nhập', 'Thất bại'], bottom: 0 },
      grid: { left: '5%', right: '3%', top: '8%', bottom: '15%', containLabel: true },
      xAxis: { type: 'category', data: days }, yAxis: { type: 'value' },
      series: [
        { name: 'Đăng nhập', type: 'bar', data: days.map(() => Math.floor(20 + Math.random() * 30)), itemStyle: { color: '#3b82f6', borderRadius: [6, 6, 0, 0] } },
        { name: 'Thất bại', type: 'bar', data: days.map(() => Math.floor(Math.random() * 5)), itemStyle: { color: '#ef4444', borderRadius: [6, 6, 0, 0] } },
      ]
    };
  }
}
