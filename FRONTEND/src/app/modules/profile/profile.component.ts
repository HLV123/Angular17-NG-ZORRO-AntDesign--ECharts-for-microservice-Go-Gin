import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, NzCardModule, NzAvatarModule, NzDescriptionsModule, NzTagModule, NzButtonModule, NzTabsModule, NzSwitchModule, NzSelectModule, NzInputModule, NzTimelineModule],
  template: `
    <div class="fade-in">
      <div class="profile-banner">
        <div class="banner-bg"></div>
        <div class="profile-header-info">
          <nz-avatar class="avatar-large"
            [nzText]="user?.fullName?.charAt(0) || 'U'"
            [nzSize]="80"
            style="background: linear-gradient(135deg, #1e6fd9, #f07b21); font-size: 32px; font-weight: 700;">
          </nz-avatar>
          <div class="profile-meta">
            <h1 class="profile-name">{{user?.fullName || 'Người dùng'}}</h1>
            <div class="profile-badges">
              <nz-tag [nzColor]="roleColor">{{roleLabel}}</nz-tag>
              <nz-tag nzColor="green">Active</nz-tag>
              <span class="profile-dept"><i class="fa-solid fa-building mr-1"></i>{{user?.department || 'Engineering'}}</span>
            </div>
          </div>
          <button nz-button nzType="primary" class="edit-profile-btn"><i class="fa-solid fa-pen mr-2"></i>Chỉnh sửa</button>
        </div>
      </div>

      <nz-tabset nzType="card" class="profile-tabs">
        <!-- Tab 1: Thông tin cá nhân -->
        <nz-tab nzTitle="Thông tin cá nhân">
          <div class="grid-2">
            <nz-card nzTitle="Thông tin tài khoản" style="border-radius:16px !important;">
              <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
                <nz-descriptions-item nzTitle="Họ tên">{{user?.fullName}}</nz-descriptions-item>
                <nz-descriptions-item nzTitle="Username">{{user?.username}}</nz-descriptions-item>
                <nz-descriptions-item nzTitle="Email">{{user?.email}}</nz-descriptions-item>
                <nz-descriptions-item nzTitle="Vai trò"><nz-tag [nzColor]="roleColor">{{roleLabel}}</nz-tag></nz-descriptions-item>
                <nz-descriptions-item nzTitle="Phòng ban">{{user?.department || 'Engineering'}}</nz-descriptions-item>
                <nz-descriptions-item nzTitle="Số điện thoại">0912 345 678</nz-descriptions-item>
                <nz-descriptions-item nzTitle="Ngày tham gia">01/06/2025</nz-descriptions-item>
                <nz-descriptions-item nzTitle="Đăng nhập gần nhất">{{user?.lastLogin | date:'dd/MM/yyyy HH:mm'}}</nz-descriptions-item>
              </nz-descriptions>
            </nz-card>

            <nz-card nzTitle="Kỹ năng & Chứng chỉ" style="border-radius:16px !important;">
              <div class="skills-section">
                <h4 class="section-label">Kỹ năng chuyên môn</h4>
                <div class="skill-tags">
                  <nz-tag *ngFor="let s of skills" nzColor="blue">{{s}}</nz-tag>
                </div>
              </div>
              <div class="skills-section">
                <h4 class="section-label">Chứng chỉ</h4>
                <div class="cert-list">
                  <div *ngFor="let c of certifications" class="cert-item">
                    <i class="fa-solid fa-certificate text-amber-500"></i>
                    <div><span class="cert-name">{{c.name}}</span><span class="cert-date">{{c.date}}</span></div>
                  </div>
                </div>
              </div>
              <div class="skills-section">
                <h4 class="section-label">Thiết bị phụ trách</h4>
                <div class="eq-list">
                  <div *ngFor="let e of assignedEquipment" class="eq-chip">
                    <i class="fa-solid fa-gears text-blue-400"></i> {{e}}
                  </div>
                </div>
              </div>
            </nz-card>
          </div>
        </nz-tab>

        <!-- Tab 2: Hoạt động gần đây -->
        <nz-tab nzTitle="Hoạt động gần đây">
          <nz-card nzTitle="Lịch sử hoạt động" style="border-radius:16px !important;">
            <nz-timeline>
              <nz-timeline-item *ngFor="let a of activities" [nzColor]="a.color">
                <p class="activity-action">{{a.action}}</p>
                <p class="activity-time">{{a.time}} · {{a.module}}</p>
              </nz-timeline-item>
            </nz-timeline>
          </nz-card>
        </nz-tab>

        <!-- Tab 3: Cài đặt -->
        <nz-tab nzTitle="Cài đặt">
          <div class="grid-2">
            <nz-card nzTitle="Cài đặt Thông báo" style="border-radius:16px !important;">
              <div class="setting-row">
                <div class="setting-info"><span class="setting-label">Cảnh báo Critical</span><span class="setting-desc">Nhận thông báo cho cảnh báo mức Critical</span></div>
                <nz-switch [(ngModel)]="notifCritical"></nz-switch>
              </div>
              <div class="setting-row">
                <div class="setting-info"><span class="setting-label">Cảnh báo High</span><span class="setting-desc">Nhận thông báo cho cảnh báo mức High</span></div>
                <nz-switch [(ngModel)]="notifHigh"></nz-switch>
              </div>
              <div class="setting-row">
                <div class="setting-info"><span class="setting-label">Work Order được giao</span><span class="setting-desc">Thông báo khi có WO mới được giao</span></div>
                <nz-switch [(ngModel)]="notifWO"></nz-switch>
              </div>
              <div class="setting-row">
                <div class="setting-info"><span class="setting-label">Bảo trì sắp đến hạn</span><span class="setting-desc">Nhắc nhở trước 24h khi có PM schedule</span></div>
                <nz-switch [(ngModel)]="notifPM"></nz-switch>
              </div>
              <div class="setting-row">
                <div class="setting-info"><span class="setting-label">Email tổng hợp hàng ngày</span><span class="setting-desc">Tóm tắt hoạt động ngày qua qua email</span></div>
                <nz-switch [(ngModel)]="notifDaily"></nz-switch>
              </div>
            </nz-card>

            <nz-card nzTitle="Cài đặt Giao diện" style="border-radius:16px !important;">
              <div class="setting-row">
                <div class="setting-info"><span class="setting-label">Ngôn ngữ</span><span class="setting-desc">Ngôn ngữ hiển thị</span></div>
                <nz-select [(ngModel)]="lang" style="width:140px;">
                  <nz-option nzValue="vi" nzLabel="Tiếng Việt"></nz-option>
                  <nz-option nzValue="en" nzLabel="English"></nz-option>
                </nz-select>
              </div>
              <div class="setting-row">
                <div class="setting-info"><span class="setting-label">Múi giờ</span><span class="setting-desc">Timezone hiển thị</span></div>
                <nz-select [(ngModel)]="timezone" style="width:180px;">
                  <nz-option nzValue="Asia/Ho_Chi_Minh" nzLabel="UTC+7 (Việt Nam)"></nz-option>
                  <nz-option nzValue="Asia/Tokyo" nzLabel="UTC+9 (Tokyo)"></nz-option>
                </nz-select>
              </div>
              <div class="setting-row">
                <div class="setting-info"><span class="setting-label">Dark Mode</span><span class="setting-desc">Chế độ tối (sắp ra mắt)</span></div>
                <nz-switch [ngModel]="false" nzDisabled></nz-switch>
              </div>
              <div class="setting-row">
                <div class="setting-info"><span class="setting-label">Compact Mode</span><span class="setting-desc">Thu gọn giao diện</span></div>
                <nz-switch [(ngModel)]="compact"></nz-switch>
              </div>
            </nz-card>
          </div>

          <nz-card nzTitle="Bảo mật" style="border-radius:16px !important;margin-top:20px;">
            <div class="setting-row">
              <div class="setting-info"><span class="setting-label">Đổi mật khẩu</span><span class="setting-desc">Thay đổi mật khẩu đăng nhập</span></div>
              <button nz-button nzType="default"><i class="fa-solid fa-key mr-2"></i>Đổi mật khẩu</button>
            </div>
            <div class="setting-row">
              <div class="setting-info"><span class="setting-label">Xác thực hai bước (2FA)</span><span class="setting-desc">Bảo mật tài khoản bằng OTP</span></div>
              <nz-switch [(ngModel)]="twoFA"></nz-switch>
            </div>
            <div class="setting-row">
              <div class="setting-info"><span class="setting-label">Phiên đăng nhập</span><span class="setting-desc">Xem và quản lý các phiên đang hoạt động</span></div>
              <button nz-button nzType="default">Xem phiên (3)</button>
            </div>
          </nz-card>
        </nz-tab>
      </nz-tabset>
    </div>
  `,
  styles: [`
    .profile-banner{position:relative;margin:-24px -24px 24px;overflow:hidden}
    .banner-bg{height:180px;background:linear-gradient(135deg,#0d1b2a 0%,#1e3a5f 50%,#1e6fd9 100%)}
    .profile-header-info{display:flex;align-items:flex-end;gap:20px;padding:0 32px;margin-top:-120px;position:relative;z-index:1;padding-bottom:28px}
    .profile-meta{flex:1}
    .profile-name{font-size:24px;font-weight:700;color:#0f172a;margin:10px 0 6px}
    .profile-badges{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .profile-dept{font-size:13px;color:#64748b}
    .edit-profile-btn{align-self:flex-start;margin-top:48px}
    .mr-1{margin-right:4px}.mr-2{margin-right:8px}
    .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:20px}
    .profile-tabs{margin-top:0}
    .skills-section{margin-bottom:20px}
    .section-label{font-size:13px;font-weight:600;color:#374151;margin-bottom:8px}
    .skill-tags{display:flex;flex-wrap:wrap;gap:6px}
    .cert-list{display:flex;flex-direction:column;gap:8px}
    .cert-item{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;background:#f8fafc}
    .cert-name{font-size:13px;font-weight:500;display:block}.cert-date{font-size:11px;color:#94a3b8}
    .eq-list{display:flex;flex-wrap:wrap;gap:8px}
    .eq-chip{font-size:12px;padding:6px 12px;border-radius:8px;background:#eff6ff;color:#1e40af;display:flex;align-items:center;gap:6px}
    .activity-action{font-size:13px;font-weight:500;margin:0}.activity-time{font-size:11px;color:#94a3b8;margin:0}
    .setting-row{display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid #f1f5f9}
    .setting-row:last-child{border-bottom:none}
    .setting-info{display:flex;flex-direction:column}
    .setting-label{font-size:14px;font-weight:500;color:#1e293b}.setting-desc{font-size:12px;color:#94a3b8;margin-top:2px}
    :host ::ng-deep .avatar-large{border:3px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.15)}
    @media(max-width:1024px){.grid-2{grid-template-columns:1fr}}
  `]
})
export class ProfileComponent {
  private auth = inject(AuthService);
  user = this.auth.currentUser;

  get roleLabel(): string {
    const m: Record<string, string> = { super_admin: 'Super Admin', factory_manager: 'Factory Manager', maintenance_manager: 'Maint. Manager', maintenance_engineer: 'Engineer', technician: 'Technician', data_scientist: 'Data Scientist', quality_inspector: 'QC Inspector', viewer: 'Viewer' };
    return m[this.user?.role || ''] || this.user?.role || '';
  }
  get roleColor(): string {
    const m: Record<string, string> = { super_admin: 'red', factory_manager: 'purple', maintenance_manager: 'blue', maintenance_engineer: 'cyan', technician: 'green', data_scientist: 'geekblue', quality_inspector: 'gold', viewer: 'default' };
    return m[this.user?.role || ''] || 'default';
  }

  skills = ['CNC Programming', 'PLC Siemens', 'Hydraulics', 'Predictive Maintenance', 'Vibration Analysis', 'Thermography'];
  certifications = [
    { name: 'Certified Maintenance Reliability Professional (CMRP)', date: 'Tháng 3/2024' },
    { name: 'Siemens PLC S7-1500 Level 2', date: 'Tháng 8/2023' },
    { name: 'ISO 55001 Asset Management', date: 'Tháng 1/2023' },
  ];
  assignedEquipment = ['Máy CNC Fanuc #01', 'Máy ép thủy lực M09', 'Robot hàn #12', 'Máy nén khí Atlas'];

  activities = [
    { action: 'Xác nhận cảnh báo ALT-003 (Máy ép M09)', time: '10 phút trước', module: 'Alerts', color: 'red' as const },
    { action: 'Hoàn thành checklist WO-2026-0089', time: '30 phút trước', module: 'Work Orders', color: 'green' as const },
    { action: 'Cập nhật PM template: PM Máy CNC hàng quý', time: '2 giờ trước', module: 'Maintenance', color: 'blue' as const },
    { action: 'Xem báo cáo OEE tháng 2', time: '3 giờ trước', module: 'Reports', color: 'gray' as const },
    { action: 'Duyệt đề xuất bảo trì từ AI cho Băng tải A3', time: '5 giờ trước', module: 'Maintenance', color: 'purple' as const },
    { action: 'Đặt hàng linh kiện PO-2026-0238', time: 'Hôm qua', module: 'Spare Parts', color: 'blue' as const },
    { action: 'Đăng nhập từ 192.168.1.45', time: 'Hôm qua 08:02', module: 'Auth', color: 'gray' as const },
  ];

  notifCritical = true;
  notifHigh = true;
  notifWO = true;
  notifPM = true;
  notifDaily = false;
  lang = 'vi';
  timezone = 'Asia/Ho_Chi_Minh';
  compact = false;
  twoFA = false;
}
