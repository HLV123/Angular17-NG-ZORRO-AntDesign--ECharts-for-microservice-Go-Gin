import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { AuthService } from '../../core/services/auth.service';
import { MOCK_USERS } from '../../core/mock/mock-data';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, NzInputModule, NzButtonModule, NzFormModule, NzCheckboxModule, NzAlertModule, NzIconModule],
  template: `
    <div class="login-container">
      <div class="login-bg"></div>
      <div class="login-content">
        <div class="login-brand">
          <div class="brand-inner">
            <img src="assets/logo.png" alt="Maintenix" class="brand-logo" />
            <h1 class="brand-title">Maintenix</h1>
            <p class="brand-subtitle">Smart Predictive Maintenance Warning System</p>
            <p class="brand-desc">Hệ thống Cảnh báo Bảo trì Máy móc Thông minh cho Nhà máy Sản xuất</p>
            <div class="brand-features">
              <div class="feat"><i class="fa-solid fa-chart-line"></i> Giám sát thời gian thực</div>
              <div class="feat"><i class="fa-solid fa-brain"></i> Dự đoán sự cố bằng AI/ML</div>
              <div class="feat"><i class="fa-solid fa-shield-halved"></i> Tối ưu hóa bảo trì</div>
              <div class="feat"><i class="fa-solid fa-gauge-high"></i> Tăng OEE lên 85%+</div>
            </div>
            <div class="brand-tech">
              <span>Angular 17</span><span>gRPC-Web</span><span>Kafka</span><span>TimescaleDB</span><span>AI/ML</span>
            </div>
          </div>
        </div>
        <div class="login-form-panel">
          <div class="login-form-inner">
            <h2 class="form-title">Đăng nhập</h2>
            <p class="form-subtitle">Sử dụng tài khoản mẫu để trải nghiệm hệ thống</p>

            <nz-alert *ngIf="error" nzType="error" [nzMessage]="error" nzShowIcon class="mb-4"></nz-alert>

            <div class="field">
              <label>Tên đăng nhập</label>
              <nz-input-group nzSize="large" [nzPrefix]="userIcon">
                <input nz-input [(ngModel)]="username" placeholder="Nhập tên đăng nhập" (keydown.enter)="login()" />
              </nz-input-group>
              <ng-template #userIcon><i class="fa-solid fa-user text-gray-400"></i></ng-template>
            </div>

            <div class="field">
              <label>Mật khẩu</label>
              <nz-input-group nzSize="large" [nzPrefix]="lockIcon" [nzSuffix]="eyeIcon">
                <input nz-input [(ngModel)]="password" [type]="showPw ? 'text' : 'password'" placeholder="Nhập mật khẩu" (keydown.enter)="login()" />
              </nz-input-group>
              <ng-template #lockIcon><i class="fa-solid fa-lock text-gray-400"></i></ng-template>
              <ng-template #eyeIcon><i class="fa-solid cursor-pointer text-gray-400" [class.fa-eye]="!showPw" [class.fa-eye-slash]="showPw" (click)="showPw=!showPw"></i></ng-template>
            </div>

            <button nz-button nzType="primary" nzSize="large" nzBlock [nzLoading]="loading" (click)="login()" class="login-btn">
              <i class="fa-solid fa-right-to-bracket mr-2" *ngIf="!loading"></i> Đăng nhập
            </button>

            <div class="demo-accounts">
              <p class="demo-title"><i class="fa-solid fa-circle-info"></i> Tài khoản mẫu (mật khẩu: <code>123456</code>)</p>
              <div class="account-grid">
                <button *ngFor="let u of demoUsers" class="account-btn" (click)="fillUser(u.username)" [class.active]="username === u.username">
                  <span class="acc-role">{{u.label}}</span>
                  <span class="acc-name">{{u.username}}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-container { min-height: 100vh; display: flex; position: relative; overflow: hidden; }
    .login-bg { position: absolute; inset: 0; background: linear-gradient(135deg, #0d1b2a 0%, #1b2838 50%, #0f2a5e 100%); z-index: 0; }
    .login-bg::before { content: ''; position: absolute; inset: 0; background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%231e6fd9' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E"); }
    .login-content { position: relative; z-index: 1; display: flex; width: 100%; min-height: 100vh; }
    .login-brand { flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px; }
    .brand-inner { max-width: 440px; color: white; }
    .brand-logo { width: 80px; height: 80px; border-radius: 16px; margin-bottom: 24px; box-shadow: 0 8px 32px rgba(30,111,217,0.3); }
    .brand-title { font-size: 42px; font-weight: 800; margin-bottom: 8px; background: linear-gradient(135deg, #60a5fa, #f07b21); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .brand-subtitle { font-size: 16px; color: #94a3b8; margin-bottom: 8px; }
    .brand-desc { font-size: 14px; color: #64748b; margin-bottom: 32px; }
    .brand-features { display: flex; flex-direction: column; gap: 12px; margin-bottom: 32px; }
    .feat { display: flex; align-items: center; gap: 12px; font-size: 14px; color: #cbd5e1; }
    .feat i { width: 32px; height: 32px; border-radius: 8px; background: rgba(30,111,217,0.15); display: flex; align-items: center; justify-content: center; color: #60a5fa; font-size: 14px; }
    .brand-tech { display: flex; flex-wrap: wrap; gap: 8px; }
    .brand-tech span { font-size: 11px; padding: 4px 10px; border-radius: 6px; background: rgba(255,255,255,0.06); color: #64748b; font-family: 'JetBrains Mono', monospace; border: 1px solid rgba(255,255,255,0.08); }
    .login-form-panel { width: 500px; display: flex; align-items: center; justify-content: center; padding: 40px; }
    .login-form-inner { width: 100%; max-width: 400px; background: white; border-radius: 24px; padding: 40px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
    .form-title { font-size: 24px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
    .form-subtitle { font-size: 13px; color: #64748b; margin-bottom: 24px; }
    .field { margin-bottom: 16px; }
    .field label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
    .login-btn { height: 48px !important; border-radius: 12px !important; font-size: 15px !important; font-weight: 600 !important; background: linear-gradient(135deg, #1e6fd9, #0f2a5e) !important; border: none !important; margin-top: 8px; }
    .login-btn:hover { opacity: 0.9; }
    .demo-accounts { margin-top: 24px; padding: 16px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; }
    .demo-title { font-size: 12px; color: #64748b; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; }
    .demo-title code { background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #1e6fd9; }
    .account-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .account-btn { padding: 8px 12px; border-radius: 8px; border: 1px solid #e2e8f0; background: white; cursor: pointer; text-align: left; transition: all 0.15s ease; }
    .account-btn:hover { border-color: #1e6fd9; background: #eff6ff; }
    .account-btn.active { border-color: #1e6fd9; background: #dbeafe; }
    .acc-role { display: block; font-size: 11px; color: #64748b; }
    .acc-name { font-size: 13px; font-weight: 600; color: #1e293b; }
    .mb-4 { margin-bottom: 16px; }
    .mr-2 { margin-right: 8px; }
    @media (max-width: 900px) { .login-brand { display: none; } .login-form-panel { width: 100%; } }
  `]
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  username = '';
  password = '';
  showPw = false;
  loading = false;
  error = '';

  demoUsers = [
    { username: 'admin', label: 'Super Admin' },
    { username: 'manager', label: 'Factory Manager' },
    { username: 'engineer', label: 'Maint. Engineer' },
    { username: 'technician', label: 'Technician' },
    { username: 'datascientist', label: 'Data Scientist' },
    { username: 'maint_mgr', label: 'Maint. Manager' },
    { username: 'inspector', label: 'QC Inspector' },
    { username: 'viewer', label: 'Viewer' },
  ];

  fillUser(u: string) {
    this.username = u;
    this.password = '123456';
    this.error = '';
  }

  login() {
    if (!this.username || !this.password) { this.error = 'Vui lòng nhập đầy đủ thông tin'; return; }
    this.loading = true;
    this.error = '';
    this.auth.login(this.username, this.password).subscribe({
      next: () => { this.router.navigate(['/dashboard']); },
      error: (e) => { this.error = e.message; this.loading = false; }
    });
  }
}
