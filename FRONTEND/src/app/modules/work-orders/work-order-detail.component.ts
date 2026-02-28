import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzInputModule } from 'ng-zorro-antd/input';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { WorkOrder } from '../../core/models';

@Component({
  selector: 'app-work-order-detail', standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, NzCardModule, NzTagModule, NzButtonModule, NzProgressModule, NzDescriptionsModule, NzCheckboxModule, NzTimelineModule, NzStepsModule, NzTabsModule, NzAvatarModule, NzAlertModule, NzInputModule],
  template: `
    <div class="fade-in" *ngIf="wo">
      <div class="det-header">
        <div class="flex items-center gap-4">
          <button class="back-btn" routerLink="/work-orders"><i class="fa-solid fa-arrow-left"></i></button>
          <div>
            <h1 class="title-main">{{wo.woNumber}} — {{wo.title}}</h1>
            <p class="text-sm text-gray-500">
              <span [routerLink]="['/equipment', wo.equipmentId]" class="link-blue">{{wo.equipmentName}}</span> · {{wo.type | titlecase}}
              <span *ngIf="wo.alertId"> · Alert: <span class="link-blue" [routerLink]="['/alerts', wo.alertId]">{{wo.alertId}}</span></span>
            </p>
          </div>
        </div>
        <div class="flex gap-3 items-center">
          <nz-tag [nzColor]="prioColor(wo.priority)" style="font-size:14px;padding:4px 16px;">{{wo.priority}}</nz-tag>
          <nz-tag [nzColor]="statusColor(wo.status)" style="font-size:14px;padding:4px 16px;">{{wo.status | uppercase}}</nz-tag>
        </div>
      </div>

      <!-- Status Steps -->
      <nz-card style="border-radius:16px !important;margin-bottom:20px;">
        <nz-steps [nzCurrent]="getStepIndex(wo.status)" nzSize="small">
          <nz-step nzTitle="Draft"></nz-step><nz-step nzTitle="Approved"></nz-step><nz-step nzTitle="Scheduled"></nz-step>
          <nz-step nzTitle="In Progress"></nz-step><nz-step nzTitle="Completed"></nz-step><nz-step nzTitle="Verified"></nz-step>
        </nz-steps>
      </nz-card>

      <!-- Deadline Warning -->
      <nz-alert *ngIf="isOverdue" nzType="error" [nzMessage]="'Công việc đã quá hạn! Deadline: ' + (wo.deadline | date:'dd/MM/yyyy HH:mm')" nzShowIcon style="margin-bottom:16px;border-radius:10px;"></nz-alert>

      <nz-tabset nzType="card">
        <!-- Tab 1: Info + Checklist -->
        <nz-tab nzTitle="Thông tin & Checklist">
          <div class="grid-2">
            <nz-card nzTitle="Thông tin Work Order" style="border-radius:16px !important;">
              <nz-descriptions nzBordered nzSize="small" [nzColumn]="2">
                <nz-descriptions-item nzTitle="Mô tả" [nzSpan]="2">{{wo.description}}</nz-descriptions-item>
                <nz-descriptions-item nzTitle="Assigned">
                  <div class="flex items-center gap-2">
                    <nz-avatar [nzText]="wo.assignedTo.charAt(0)" nzSize="small" style="background:linear-gradient(135deg,#1e6fd9,#f07b21);"></nz-avatar>
                    {{wo.assignedTo}}
                  </div>
                </nz-descriptions-item>
                <nz-descriptions-item nzTitle="Team">{{wo.assignedTeam || 'N/A'}}</nz-descriptions-item>
                <nz-descriptions-item nzTitle="Created by">{{wo.createdBy}}</nz-descriptions-item>
                <nz-descriptions-item nzTitle="Ngày tạo">{{wo.createdAt | date:'dd/MM/yyyy HH:mm'}}</nz-descriptions-item>
                <nz-descriptions-item nzTitle="Deadline">
                  <span [class]="isOverdue ? 'text-red-600 font-bold' : ''">{{wo.deadline | date:'dd/MM/yyyy HH:mm'}}</span>
                </nz-descriptions-item>
                <nz-descriptions-item nzTitle="Loại"><nz-tag [nzColor]="typeColor(wo.type)">{{wo.type | titlecase}}</nz-tag></nz-descriptions-item>
                <nz-descriptions-item nzTitle="Ước tính">{{wo.estimatedHours}}h</nz-descriptions-item>
                <nz-descriptions-item nzTitle="Thực tế">{{wo.actualHours || 'N/A'}}h</nz-descriptions-item>
              </nz-descriptions>

              <!-- Cost Tracking -->
              <div class="cost-box" *ngIf="wo.totalCost">
                <h4 class="cost-title"><i class="fa-solid fa-coins text-amber-500 mr-2"></i>Chi phí</h4>
                <div class="cost-row"><span>Chi phí nhân công</span><span class="mono">{{wo.laborCost | number}} VNĐ</span></div>
                <div class="cost-row"><span>Chi phí linh kiện</span><span class="mono">{{wo.partsCost | number}} VNĐ</span></div>
                <div class="cost-total"><span>Tổng cộng</span><span class="mono font-bold">{{wo.totalCost | number}} VNĐ</span></div>
              </div>
            </nz-card>

            <nz-card nzTitle="Checklist công việc" style="border-radius:16px !important;">
              <div class="checklist" *ngIf="wo.checklist?.length">
                <div *ngFor="let c of wo.checklist; let i = index" class="check-item" [class.done]="c.completed">
                  <div class="check-left">
                    <label nz-checkbox [(ngModel)]="c.completed">
                      <span [class.line-through]="c.completed">{{c.description}}</span>
                    </label>
                  </div>
                  <span class="check-by" *ngIf="c.completedBy">
                    <i class="fa-solid fa-check text-xs"></i> {{c.completedBy}}
                    <span *ngIf="c.completedAt" class="text-xs text-gray-400"> · {{c.completedAt | date:'dd/MM HH:mm'}}</span>
                  </span>
                </div>
              </div>
              <div *ngIf="!wo.checklist?.length" class="empty-state"><i class="fa-solid fa-clipboard-list text-gray-300" style="font-size:40px;"></i><p>Chưa có checklist</p></div>
              <div class="progress-box">
                <div class="progress-header"><span class="text-sm font-medium">Tiến độ tổng thể</span><span class="mono text-sm">{{wo.completionRate}}%</span></div>
                <nz-progress [nzPercent]="wo.completionRate" [nzStrokeColor]="wo.completionRate>80?'#10b981':'#1e6fd9'"></nz-progress>
              </div>
            </nz-card>
          </div>
        </nz-tab>

        <!-- Tab 2: Work Log -->
        <nz-tab nzTitle="Nhật ký thực hiện">
          <nz-card style="border-radius:16px !important;">
            <div class="log-input">
              <nz-input-group nzSize="default" [nzSuffix]="logSuffix">
                <input nz-input [(ngModel)]="newLog" placeholder="Thêm ghi chú vào nhật ký..." (keydown.enter)="addLog()" />
              </nz-input-group>
              <ng-template #logSuffix>
                <button nz-button nzType="primary" nzSize="small" (click)="addLog()"><i class="fa-solid fa-paper-plane"></i></button>
              </ng-template>
            </div>
            <nz-timeline class="mt-4">
              <nz-timeline-item *ngFor="let log of workLogs" [nzColor]="log.type==='status_change'?'blue':log.type==='photo'?'green':'gray'">
                <div class="log-item">
                  <div class="log-header">
                    <nz-avatar [nzText]="log.author.charAt(0)" nzSize="small" style="background:#6366f1;font-size:11px;"></nz-avatar>
                    <span class="log-author">{{log.author}}</span>
                    <nz-tag *ngIf="log.type==='status_change'" nzColor="blue" style="font-size:10px;">Status</nz-tag>
                    <nz-tag *ngIf="log.type==='photo'" nzColor="green" style="font-size:10px;">Photo</nz-tag>
                    <nz-tag *ngIf="log.type==='measurement'" nzColor="purple" style="font-size:10px;">Measurement</nz-tag>
                    <span class="log-time">{{log.timestamp | date:'dd/MM HH:mm'}}</span>
                  </div>
                  <p class="log-desc">{{log.description}}</p>
                </div>
              </nz-timeline-item>
            </nz-timeline>
          </nz-card>
        </nz-tab>

        <!-- Tab 3: Safety -->
        <nz-tab nzTitle="An toàn & Yêu cầu">
          <div class="grid-2">
            <nz-card nzTitle="An toàn Lao động (LOTO)" style="border-radius:16px !important;">
              <nz-alert nzType="warning" nzMessage="⚠️ Yêu cầu Lock Out Tag Out (LOTO) trước khi thực hiện" nzShowIcon style="border-radius:8px;margin-bottom:16px;"></nz-alert>
              <div class="safety-list">
                <div *ngFor="let s of safetyItems" class="safety-item">
                  <label nz-checkbox [(ngModel)]="s.checked"><span [class]="s.checked ? 'text-gray-400 line-through' : ''">{{s.label}}</span></label>
                </div>
              </div>
            </nz-card>
            <nz-card nzTitle="Trang bị Bảo hộ (PPE)" style="border-radius:16px !important;">
              <div class="ppe-grid">
                <div *ngFor="let p of ppeItems" class="ppe-item" [class.active]="p.required">
                  <i class="fa-solid" [class]="p.icon" [style.color]="p.required ? '#1e6fd9' : '#cbd5e1'" style="font-size:28px;"></i>
                  <span [style.color]="p.required ? '#1e293b' : '#94a3b8'">{{p.name}}</span>
                  <nz-tag *ngIf="p.required" nzColor="blue" style="font-size:10px;">Bắt buộc</nz-tag>
                </div>
              </div>
            </nz-card>
          </div>
        </nz-tab>
      </nz-tabset>
    </div>
  `,
  styles: [`
    .det-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px}
    .title-main{font-size:20px;font-weight:700;color:#0f172a;margin:0}
    .flex{display:flex}.items-center{align-items:center}.gap-4{gap:16px}.gap-3{gap:12px}.gap-2{gap:8px}
    .back-btn{width:40px;height:40px;border-radius:10px;border:1px solid #e2e8f0;background:white;cursor:pointer;display:flex;align-items:center;justify-content:center}
    .back-btn:hover{background:#f1f5f9}
    .link-blue{color:#1e6fd9;cursor:pointer}.link-blue:hover{text-decoration:underline}
    .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:20px}
    .mono{font-family:'JetBrains Mono',monospace}.font-bold{font-weight:700}.font-medium{font-weight:500}.text-sm{font-size:14px}.text-xs{font-size:12px}.mr-2{margin-right:8px}.mt-4{margin-top:16px}
    .line-through{text-decoration:line-through}
    .cost-box{margin-top:16px;padding:16px;background:#f8fafc;border-radius:12px}
    .cost-title{font-size:14px;font-weight:600;margin-bottom:12px}
    .cost-row{display:flex;justify-content:space-between;padding:8px 0;font-size:13px;border-bottom:1px solid #e2e8f0}
    .cost-total{display:flex;justify-content:space-between;padding:12px 0 0;font-size:15px;font-weight:600}
    .checklist{display:flex;flex-direction:column;gap:6px}
    .check-item{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-radius:10px;background:#f8fafc;transition:background 0.15s}
    .check-item.done{background:#ecfdf5}
    .check-item:hover{background:#f1f5f9}
    .check-left{display:flex;align-items:center}
    .check-by{font-size:11px;color:#059669;display:flex;align-items:center;gap:4px}
    .empty-state{text-align:center;padding:32px;color:#94a3b8}
    .progress-box{margin-top:20px;padding:16px;background:#f8fafc;border-radius:12px}
    .progress-header{display:flex;justify-content:space-between;margin-bottom:8px}
    .log-input{margin-bottom:16px}
    .log-item{}
    .log-header{display:flex;align-items:center;gap:8px;margin-bottom:4px}
    .log-author{font-size:13px;font-weight:600;color:#1e293b}
    .log-time{font-size:11px;color:#94a3b8;margin-left:auto}
    .log-desc{font-size:13px;color:#475569;padding-left:40px}
    .safety-list{display:flex;flex-direction:column;gap:8px}
    .safety-item{padding:10px 14px;border-radius:8px;background:#f8fafc}
    .ppe-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    .ppe-item{display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px;border-radius:12px;border:1px solid #e2e8f0;text-align:center;font-size:12px}
    .ppe-item.active{border-color:#dbeafe;background:#eff6ff}
    @media(max-width:1024px){.grid-2{grid-template-columns:1fr}}
  `]
})
export class WorkOrderDetailComponent implements OnInit {
  private api = inject(ApiService); private route = inject(ActivatedRoute);
  wo: WorkOrder | null = null;
  isOverdue = false;
  newLog = '';

  workLogs = [
    { id: '1', timestamp: new Date(Date.now() - 7200000).toISOString(), author: 'Lê Minh Khoa', description: 'Bắt đầu công việc. Đã tắt máy và thực hiện LOTO.', type: 'status_change' as const },
    { id: '2', timestamp: new Date(Date.now() - 5400000).toISOString(), author: 'Lê Minh Khoa', description: 'Đã xả dầu cũ hoàn tất. Quan sát: dầu bị đen, có mùi cháy. Cho thấy dấu hiệu quá nhiệt.', type: 'note' as const },
    { id: '3', timestamp: new Date(Date.now() - 3600000).toISOString(), author: 'Lê Minh Khoa', description: 'Chụp ảnh bộ lọc cũ - bị tắc nghẽn 60% (xác nhận phân tích AI).', type: 'photo' as const },
    { id: '4', timestamp: new Date(Date.now() - 1800000).toISOString(), author: 'Lê Minh Khoa', description: 'Thay bộ lọc mới. Đang đổ dầu mới.', type: 'note' as const },
    { id: '5', timestamp: new Date(Date.now() - 600000).toISOString(), author: 'Lê Minh Khoa', description: 'Đo nhiệt độ sau thay dầu: 65°C (giảm từ 92°C). Đo áp suất: 160 bar (giảm từ 185 bar).', type: 'measurement' as const },
  ];

  safetyItems = [
    { label: 'Tắt nguồn điện chính của thiết bị', checked: true },
    { label: 'Gắn khóa LOTO tại bảng điện', checked: true },
    { label: 'Treo thẻ cảnh báo "ĐANG BẢO TRÌ"', checked: true },
    { label: 'Xả áp suất dư trong hệ thống', checked: false },
    { label: 'Kiểm tra không còn năng lượng tích trữ', checked: false },
    { label: 'Thông báo cho tất cả nhân viên liên quan', checked: true },
  ];

  ppeItems = [
    { name: 'Nón bảo hộ', icon: 'fa-hard-hat', required: true },
    { name: 'Kính bảo hộ', icon: 'fa-glasses', required: true },
    { name: 'Găng tay', icon: 'fa-mitten', required: true },
    { name: 'Giày bảo hộ', icon: 'fa-shoe-prints', required: true },
    { name: 'Áo phản quang', icon: 'fa-vest', required: false },
    { name: 'Bảo vệ tai', icon: 'fa-headphones', required: false },
  ];

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.api.getWorkOrderById(id).subscribe(w => {
      if (w) {
        this.wo = w;
        this.isOverdue = new Date(w.deadline) < new Date() && !['completed', 'verified', 'closed'].includes(w.status);
      }
    });
  }

  getStepIndex(s: string): number {
    const map: Record<string, number> = { draft: 0, submitted: 0, approved: 1, scheduled: 2, assigned: 2, in_progress: 3, pending_parts: 3, completed: 4, verified: 5, closed: 5 };
    return map[s] ?? 0;
  }

  prioColor(p: string) { return p === 'P1' ? 'red' : p === 'P2' ? 'orange' : p === 'P3' ? 'gold' : 'blue'; }
  typeColor(t: string) { return t === 'predictive' ? 'purple' : t === 'preventive' ? 'blue' : t === 'corrective' ? 'red' : 'orange'; }
  statusColor(s: string) { return s === 'in_progress' ? 'blue' : s === 'completed' ? 'green' : s === 'verified' ? 'green' : 'default'; }

  addLog() {
    if (!this.newLog.trim()) return;
    this.workLogs.unshift({
      id: 'L' + Date.now(),
      timestamp: new Date().toISOString(),
      author: 'Current User',
      description: this.newLog,
      type: 'note'
    });
    this.newLog = '';
  }
}
