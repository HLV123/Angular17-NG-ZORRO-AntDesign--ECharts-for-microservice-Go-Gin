import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, NzLayoutModule, NzMenuModule, NzIconModule, NzAvatarModule, NzBadgeModule, NzDropDownModule, NzToolTipModule, NzBreadCrumbModule, NzTagModule],
  template: `
    <nz-layout class="min-h-screen">
      <!-- SIDEBAR -->
      <nz-sider [nzWidth]="sidebarCollapsed ? 80 : 260" [nzCollapsible]="true" [(nzCollapsed)]="sidebarCollapsed"
                 [nzTrigger]="null" class="sidebar-custom">
        <div class="sidebar-logo" [class.collapsed]="sidebarCollapsed">
          <img src="assets/logo.png" alt="Maintenix" class="logo-img" [style.width]="sidebarCollapsed ? '36px' : '40px'" />
          <div *ngIf="!sidebarCollapsed" class="logo-text">
            <span class="brand-name">Maintenix</span>
            <span class="brand-version">v1.0</span>
          </div>
        </div>

        <ul nz-menu nzMode="inline" nzTheme="dark" class="sidebar-menu">
          <ng-container *ngFor="let item of menuItems">
            <li *ngIf="item.divider && hasAccess(item.roles)" class="menu-divider"></li>
            <li *ngIf="!item.divider && hasAccess(item.roles)" nz-menu-item nzMatchRouter [routerLink]="item.route"
                nz-tooltip [nzTooltipTitle]="sidebarCollapsed ? item.label : ''">
              <i [class]="item.icon + ' menu-icon'"></i>
              <span *ngIf="!sidebarCollapsed">{{item.label}}</span>
              <nz-badge *ngIf="!sidebarCollapsed && item.badge" [nzCount]="item.badge" nzSize="small" class="ml-auto" [nzStyle]="{ backgroundColor: '#ef4444' }"></nz-badge>
            </li>
          </ng-container>
        </ul>

        <div class="sidebar-footer" *ngIf="!sidebarCollapsed">
          <div class="tech-badges">
            <span class="tech-badge">Kafka</span>
            <span class="tech-badge">gRPC</span>
            <span class="tech-badge">TimescaleDB</span>
          </div>
        </div>
      </nz-sider>

      <nz-layout>
        <!-- HEADER -->
        <nz-header class="app-header" [style.left]="sidebarCollapsed ? '80px' : '260px'">
          <div class="header-left">
            <button class="collapse-btn" (click)="sidebarCollapsed = !sidebarCollapsed">
              <i class="fa-solid" [class.fa-bars]="sidebarCollapsed" [class.fa-bars-staggered]="!sidebarCollapsed"></i>
            </button>
            <div class="header-search">
              <i class="fa-solid fa-search text-gray-400"></i>
              <input type="text" placeholder="Tìm kiếm..." class="search-input" />
            </div>
          </div>

          <div class="header-right">
            <div class="header-status">
              <span class="status-indicator online"></span>
              <span class="text-sm font-medium text-emerald-700">{{currentUser?.role === 'super_admin' ? '57' : '57'}}/62 Online</span>
            </div>
            <button class="header-icon-btn" nz-dropdown [nzDropdownMenu]="alertMenu" nzTrigger="click">
              <nz-badge [nzCount]="4" nzSize="small" [nzStyle]="{ backgroundColor: '#ef4444' }">
                <i class="fa-solid fa-bell"></i>
              </nz-badge>
            </button>
            <nz-dropdown-menu #alertMenu>
              <div class="dropdown-panel">
                <div class="dropdown-title">Cảnh báo mới <nz-tag nzColor="red">4</nz-tag></div>
                <div class="dropdown-item crit"><i class="fa-solid fa-circle-xmark text-red-500 mr-2"></i><div><span class="di-title">Máy ép thủy lực M09</span><span class="di-desc">Quá nhiệt độ vòng bi</span></div><span class="di-time">5p</span></div>
                <div class="dropdown-item high"><i class="fa-solid fa-triangle-exclamation text-orange-500 mr-2"></i><div><span class="di-title">Băng tải A3</span><span class="di-desc">Rung động bất thường</span></div><span class="di-time">30p</span></div>
                <div class="dropdown-item"><i class="fa-solid fa-exclamation-circle text-yellow-500 mr-2"></i><div><span class="di-title">Robot hàn #12</span><span class="di-desc">Hiệu suất giảm dần</span></div><span class="di-time">2h</span></div>
                <div class="dropdown-item"><i class="fa-solid fa-circle-xmark text-red-500 mr-2"></i><div><span class="di-title">Động cơ băng tải</span><span class="di-desc">Dự đoán hỏng trong 7 ngày</span></div><span class="di-time">1d</span></div>
                <a class="dropdown-footer" routerLink="/alerts">Xem tất cả cảnh báo →</a>
              </div>
            </nz-dropdown-menu>
            <button class="header-icon-btn" nz-dropdown [nzDropdownMenu]="msgMenu" nzTrigger="click">
              <nz-badge [nzDot]="true" [nzStyle]="{ backgroundColor: '#3b82f6' }">
                <i class="fa-solid fa-envelope"></i>
              </nz-badge>
            </button>
            <nz-dropdown-menu #msgMenu>
              <div class="dropdown-panel">
                <div class="dropdown-title">Thông báo</div>
                <div class="dropdown-item"><i class="fa-solid fa-wrench text-blue-500 mr-2"></i><div><span class="di-title">WO-2026-0089 hoàn thành</span><span class="di-desc">Nguyễn Văn B đã đóng work order</span></div><span class="di-time">15p</span></div>
                <div class="dropdown-item"><i class="fa-solid fa-robot text-purple-500 mr-2"></i><div><span class="di-title">AI đề xuất bảo trì</span><span class="di-desc">Máy CNC Fanuc #01 - PM dự đoán</span></div><span class="di-time">1h</span></div>
                <div class="dropdown-item"><i class="fa-solid fa-box text-green-500 mr-2"></i><div><span class="di-title">Linh kiện hết hàng</span><span class="di-desc">Gioăng HEX cần đặt hàng</span></div><span class="di-time">3h</span></div>
                <a class="dropdown-footer" routerLink="/alerts">Xem tất cả →</a>
              </div>
            </nz-dropdown-menu>

            <div class="user-info" nz-dropdown [nzDropdownMenu]="userMenu" nzTrigger="click">
              <nz-avatar [nzText]="currentUser?.fullName?.charAt(0) || 'U'" nzSize="small"
                         style="background: linear-gradient(135deg, #1e6fd9, #f07b21);"></nz-avatar>
              <div class="user-details" *ngIf="currentUser">
                <span class="user-name">{{currentUser.fullName}}</span>
                <span class="user-role">{{getRoleLabel(currentUser.role)}}</span>
              </div>
              <i class="fa-solid fa-chevron-down text-xs text-gray-400"></i>
            </div>
            <nz-dropdown-menu #userMenu>
              <ul nz-menu>
                <li nz-menu-item routerLink="/profile"><i class="fa-solid fa-user mr-2"></i> Hồ sơ cá nhân</li>
                <li nz-menu-item routerLink="/settings"><i class="fa-solid fa-gear mr-2"></i> Cài đặt</li>
                <li nz-menu-divider></li>
                <li nz-menu-item (click)="logout()" class="text-red-500"><i class="fa-solid fa-right-from-bracket mr-2"></i> Đăng xuất</li>
              </ul>
            </nz-dropdown-menu>
          </div>
        </nz-header>

        <!-- CONTENT -->
        <nz-content class="app-content" [style.margin-left]="sidebarCollapsed ? '80px' : '260px'">
          <router-outlet></router-outlet>
        </nz-content>
      </nz-layout>
    </nz-layout>
  `,
  styles: [`
    .sidebar-custom {
      background: #0d1b2a !important;
      position: fixed;
      left: 0;
      top: 0;
      bottom: 0;
      z-index: 100;
      box-shadow: 2px 0 12px rgba(0,0,0,0.15);
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      overflow-x: hidden;
    }
    :host ::ng-deep .ant-layout-sider-children { display: flex; flex-direction: column; height: 100%; }
    .sidebar-logo {
      height: 64px;
      display: flex;
      align-items: center;
      padding: 0 20px;
      gap: 12px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      flex-shrink: 0;
    }
    .sidebar-logo.collapsed { justify-content: center; padding: 0; }
    .logo-img { border-radius: 8px; }
    .logo-text { display: flex; flex-direction: column; }
    .brand-name { font-size: 18px; font-weight: 700; color: white; letter-spacing: -0.5px;
      background: linear-gradient(135deg, #60a5fa, #f07b21);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .brand-version { font-size: 10px; color: #64748b; font-family: 'JetBrains Mono', monospace; }
    .sidebar-menu { flex: 1; padding: 12px 0; background: transparent !important; }
    .sidebar-menu .menu-icon { width: 20px; margin-right: 12px; font-size: 15px; text-align: center; }
    :host ::ng-deep .ant-menu-dark .ant-menu-item { margin: 2px 8px; border-radius: 8px; height: 44px; line-height: 44px; color: #94a3b8; }
    :host ::ng-deep .ant-menu-dark .ant-menu-item:hover { color: white; background: rgba(255,255,255,0.06); }
    :host ::ng-deep .ant-menu-dark .ant-menu-item-selected { color: white; background: linear-gradient(135deg, rgba(30,111,217,0.3), rgba(240,123,33,0.15)) !important; border-left: 3px solid #1e6fd9; }
    .menu-divider { height: 1px; margin: 12px 20px; background: rgba(255,255,255,0.06); }
    .sidebar-footer { padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.06); }
    .tech-badges { display: flex; flex-wrap: wrap; gap: 4px; }
    .tech-badge { font-size: 10px; padding: 2px 8px; border-radius: 4px; background: rgba(255,255,255,0.06); color: #64748b; font-family: 'JetBrains Mono', monospace; }

    .app-header {
      position: fixed;
      top: 0;
      right: 0;
      height: 64px;
      background: rgba(255,255,255,0.9) !important;
      backdrop-filter: blur(16px);
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px !important;
      z-index: 99;
      transition: left 0.2s ease;
    }

    .header-left { display: flex; align-items: center; gap: 16px; flex-shrink: 0; }
    .collapse-btn { background: none; border: none; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; color: #475569; font-size: 16px; display: flex; align-items: center; justify-content: center; }
    .collapse-btn:hover { background: #f1f5f9; }
    .header-search { display: flex; align-items: center; gap: 8px; background: #f1f5f9; border-radius: 8px; padding: 4px 16px; width: 320px; height: 36px; }
    .search-input { background: none; border: none; outline: none; width: 100%; font-size: 14px; color: #1e293b; }
    .header-right { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
    .header-status { display: flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 20px; background: #ecfdf5; }
    .status-indicator { width: 8px; height: 8px; border-radius: 50%; }
    .status-indicator.online { background: #10b981; box-shadow: 0 0 6px #10b981; }
    .header-icon-btn { background: none; border: none; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; font-size: 16px; color: #64748b; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .header-icon-btn:hover { background: #f1f5f9; color: #1e293b; }
    .user-info { display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 4px 8px; border-radius: 10px; }
    .user-info:hover { background: #f1f5f9; }
    .user-details { display: flex; flex-direction: column; }
    .user-name { font-size: 13px; font-weight: 600; color: #1e293b; white-space: nowrap; max-width: 140px; overflow: hidden; text-overflow: ellipsis; line-height: 1.3; }
    .user-role { font-size: 11px; color: #64748b; white-space: nowrap; line-height: 1.3; }

    .dropdown-panel { width: 340px; background: white; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); padding: 0; overflow: hidden; }
    .dropdown-title { padding: 14px 16px 8px; font-weight: 600; font-size: 14px; color: #0f172a; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #f1f5f9; }
    .dropdown-item { display: flex; align-items: flex-start; gap: 10px; padding: 10px 16px; cursor: pointer; transition: background 0.15s; }
    .dropdown-item:hover { background: #f8fafc; }
    .dropdown-item > div { flex: 1; min-width: 0; }
    .di-title { font-size: 13px; font-weight: 500; color: #1e293b; display: block; }
    .di-desc { font-size: 11px; color: #94a3b8; display: block; margin-top: 1px; }
    .di-time { font-size: 11px; color: #94a3b8; white-space: nowrap; flex-shrink: 0; }
    .mr-2 { margin-right: 8px; }
    .dropdown-footer { display: block; text-align: center; padding: 10px; font-size: 13px; color: #1e6fd9; font-weight: 500; border-top: 1px solid #f1f5f9; text-decoration: none; }

    .app-content {
      margin-left: 260px;
      margin-top: 64px;
      padding: 24px;
      min-height: calc(100vh - 64px);
      background: #f0f2f5;
      transition: margin-left 0.2s ease;
    }
  `]
})
export class MainLayoutComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  sidebarCollapsed = false;
  currentUser = this.authService.currentUser;

  readonly ALL_ROLES = ['super_admin', 'factory_manager', 'maintenance_manager', 'maintenance_engineer', 'technician', 'data_scientist', 'quality_inspector', 'viewer'];
  readonly OPS_ROLES = ['super_admin', 'factory_manager', 'maintenance_manager', 'maintenance_engineer', 'technician', 'quality_inspector', 'viewer'];
  readonly MAINT_ROLES = ['super_admin', 'factory_manager', 'maintenance_manager', 'maintenance_engineer', 'technician'];
  readonly WO_ROLES = ['super_admin', 'factory_manager', 'maintenance_manager', 'maintenance_engineer', 'technician', 'quality_inspector'];
  readonly REPORT_ROLES = ['super_admin', 'factory_manager', 'maintenance_manager', 'data_scientist', 'quality_inspector', 'viewer'];
  readonly AI_ROLES = ['super_admin', 'data_scientist'];
  readonly ADMIN_ROLES = ['super_admin'];

  menuItems: { route?: string; icon?: string; label?: string; badge?: number; roles: string[]; divider?: boolean }[] = [
    { route: '/dashboard', icon: 'fa-solid fa-gauge-high', label: 'Dashboard', roles: this.ALL_ROLES },
    { route: '/equipment', icon: 'fa-solid fa-gears', label: 'Quản lý Thiết bị', roles: this.OPS_ROLES },
    { route: '/sensors', icon: 'fa-solid fa-microchip', label: 'Giám sát Sensor', roles: this.ALL_ROLES },
    { route: '/alerts', icon: 'fa-solid fa-triangle-exclamation', label: 'Quản lý Cảnh báo', badge: 4, roles: this.OPS_ROLES },
    { route: '/maintenance', icon: 'fa-solid fa-calendar-check', label: 'Lập lịch Bảo trì', roles: this.MAINT_ROLES },
    { route: '/work-orders', icon: 'fa-solid fa-clipboard-list', label: 'Lệnh Công việc', roles: this.WO_ROLES },
    { route: '/spare-parts', icon: 'fa-solid fa-warehouse', label: 'Kho Linh kiện', roles: this.MAINT_ROLES },
    { route: '/ai-models', icon: 'fa-solid fa-brain', label: 'Quản lý AI/ML', roles: this.AI_ROLES },
    { route: '/reports', icon: 'fa-solid fa-chart-pie', label: 'Báo cáo & Phân tích', roles: this.REPORT_ROLES },
    { divider: true, roles: this.ADMIN_ROLES },
    { route: '/users', icon: 'fa-solid fa-users', label: 'Quản lý Người dùng', roles: this.ADMIN_ROLES },
    { route: '/settings', icon: 'fa-solid fa-sliders', label: 'Cấu hình Hệ thống', roles: this.ADMIN_ROLES },
  ];

  hasAccess(roles: string[]): boolean {
    return this.authService.hasRole(roles);
  }

  getRoleLabel(role: string): string {
    const labels: Record<string, string> = {
      'super_admin': 'Super Admin', 'factory_manager': 'Factory Manager',
      'maintenance_manager': 'Maintenance Manager', 'maintenance_engineer': 'Maintenance Engineer',
      'technician': 'Technician', 'data_scientist': 'Data Scientist',
      'quality_inspector': 'Quality Inspector', 'viewer': 'Viewer'
    };
    return labels[role] || role;
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
