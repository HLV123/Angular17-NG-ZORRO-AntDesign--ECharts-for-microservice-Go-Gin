import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzCalendarModule } from 'ng-zorro-antd/calendar';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NgxEchartsModule } from 'ngx-echarts';
import { ApiService } from '../../core/services/api.service';
import { MaintenanceSchedule } from '../../core/models';

@Component({
  selector: 'app-maintenance', standalone: true,
  imports: [CommonModule, FormsModule, NzCardModule, NzTagModule, NzButtonModule, NzTabsModule, NzProgressModule, NzTableModule, NzBadgeModule, NzSelectModule, NzCalendarModule, NzToolTipModule, NgxEchartsModule],
  template: `
    <div class="fade-in">
      <div class="page-header">
        <div><h1 class="page-title">Lập lịch Bảo trì</h1><p class="page-desc">Maintenance Scheduling · Gantt Chart · AI Recommendations · Calendar</p></div>
        <div class="flex gap-3">
          <nz-select [(ngModel)]="viewRange" style="width:140px;" (ngModelChange)="updateGantt()">
            <nz-option nzValue="week" nzLabel="Tuần này"></nz-option>
            <nz-option nzValue="2week" nzLabel="2 Tuần"></nz-option>
            <nz-option nzValue="month" nzLabel="Tháng"></nz-option>
          </nz-select>
          <button nz-button nzType="primary"><i class="fa-solid fa-plus mr-2"></i>Tạo lịch mới</button>
        </div>
      </div>

      <!-- Stats Row -->
      <div class="stats-row">
        <div class="stat-card"><div class="stat-num text-blue-600">{{countType('preventive')}}</div><div class="stat-lab">Preventive</div></div>
        <div class="stat-card"><div class="stat-num text-purple-600">{{countType('predictive')}}</div><div class="stat-lab">Predictive (AI)</div></div>
        <div class="stat-card"><div class="stat-num text-red-500">{{countType('emergency')}}</div><div class="stat-lab">Emergency</div></div>
        <div class="stat-card"><div class="stat-num text-emerald-600">{{schedules.length}}</div><div class="stat-lab">Tổng lịch trình</div></div>
      </div>

      <nz-tabset nzType="card">
        <!-- Tab 1: Gantt Chart -->
        <nz-tab nzTitle="Gantt Chart">
          <nz-card style="border-radius:16px !important;">
            <div class="gantt">
              <div class="gantt-header">
                <div class="gantt-label-h">Thiết bị</div>
                <div class="gantt-timeline">
                  <span *ngFor="let d of ganttDays" class="gantt-day" [class.today]="d.isToday">
                    <span class="day-name">{{d.dayName}}</span>
                    <span class="day-num">{{d.label}}</span>
                  </span>
                </div>
              </div>
              <div *ngFor="let s of schedules" class="gantt-row">
                <div class="gantt-label" [nz-tooltip]="s.title">
                  <span class="gantt-eq-name">{{s.equipmentName}}</span>
                </div>
                <div class="gantt-bars">
                  <div class="gantt-bar" [class]="'type-'+s.type"
                       [style.left.%]="getBarLeft(s)" [style.width.%]="getBarWidth(s)"
                       [nz-tooltip]="s.title + ' (' + s.startDate + ' → ' + s.endDate + ')'">
                    <span class="bar-text">{{getBarAbbr(s.title)}}</span>
                    <span class="bar-badge" *ngIf="s.isAiRecommended" nz-tooltip="AI đề xuất">🤖</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="gantt-legend">
              <span><span class="leg-dot prev"></span>Preventive</span>
              <span><span class="leg-dot pred"></span>Predictive (AI)</span>
              <span><span class="leg-dot corr"></span>Corrective</span>
              <span><span class="leg-dot emer"></span>Emergency</span>
            </div>
          </nz-card>
        </nz-tab>

        <!-- Tab 2: Calendar View -->
        <nz-tab nzTitle="Calendar View">
          <nz-card style="border-radius:16px !important;">
            <div class="cal-legend">
              <span><span class="leg-dot prev"></span>Preventive</span>
              <span><span class="leg-dot pred"></span>Predictive</span>
              <span><span class="leg-dot corr"></span>Corrective</span>
              <span><span class="leg-dot emer"></span>Emergency</span>
            </div>
            <div class="calendar-wrapper">
              <div class="cal-month-label">Tháng 3, 2026</div>
              <div class="cal-grid">
                <div class="cal-header-row">
                  <span *ngFor="let dn of ['T2','T3','T4','T5','T6','T7','CN']" class="cal-header-cell">{{dn}}</span>
                </div>
                <div class="cal-body">
                  <div *ngFor="let w of calWeeks" class="cal-week-row">
                    <div *ngFor="let d of w" class="cal-cell" [class.other-month]="d.otherMonth" [class.today]="d.isToday">
                      <span class="cal-day-num">{{d.day}}</span>
                      <div *ngFor="let ev of d.events" class="cal-event" [class]="'type-' + ev.type" [nz-tooltip]="ev.title">
                        {{getEventAbbr(ev.title)}}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </nz-card>
        </nz-tab>

        <!-- Tab 3: AI Recommendations -->
        <nz-tab nzTitle="AI Recommendations">
          <nz-card style="border-radius:16px !important;">
            <div class="ai-rec-header">
              <div class="ai-rec-info">
                <i class="fa-solid fa-brain text-purple-500" style="font-size:20px;"></i>
                <div><span class="font-semibold">Đề xuất bảo trì từ ML Models</span><br><span class="text-xs text-gray-500">Dựa trên SageMaker Health Score + RUL Estimator</span></div>
              </div>
              <button nz-button nzType="primary" nzSize="small"><i class="fa-solid fa-check-double mr-1"></i>Batch Approve</button>
            </div>
            <nz-table #aiTbl [nzData]="aiRecommendations" nzSize="middle" [nzFrontPagination]="false">
              <thead><tr><th>Thiết bị</th><th>Loại</th><th>Lý do AI</th><th>Deadline</th><th>Confidence</th><th>Chi phí dự kiến</th><th>Hành động</th></tr></thead>
              <tbody><tr *ngFor="let r of aiTbl.data">
                <td class="font-medium">{{r.equipmentName}}</td>
                <td><nz-tag nzColor="purple">Predictive</nz-tag></td>
                <td class="text-sm">{{r.reason}}</td>
                <td><nz-tag [nzColor]="r.urgent?'red':'default'">{{r.deadline}}</nz-tag></td>
                <td><nz-progress [nzPercent]="r.confidence" nzSize="small" [nzStrokeColor]="'#8b5cf6'" style="width:80px;"></nz-progress></td>
                <td>
                  <div class="cost-compare">
                    <span class="text-xs text-red-500">Không sửa: {{r.costIgnore}}</span>
                    <span class="text-xs text-emerald-600">Sửa ngay: {{r.costFix}}</span>
                  </div>
                </td>
                <td>
                  <div class="flex gap-2">
                    <button nz-button nzSize="small" nzType="primary">Chấp nhận</button>
                    <button nz-button nzSize="small">Dời lịch</button>
                    <button nz-button nzSize="small" nzDanger>Từ chối</button>
                  </div>
                </td>
              </tr></tbody>
            </nz-table>
          </nz-card>
        </nz-tab>

        <!-- Tab 4: PM Templates -->
        <nz-tab nzTitle="PM Templates">
          <nz-card style="border-radius:16px !important;">
            <div class="flex justify-between mb-4">
              <span class="font-semibold text-sm">Preventive Maintenance Templates</span>
              <button nz-button nzSize="small" nzType="primary"><i class="fa-solid fa-plus mr-1"></i>Tạo Template</button>
            </div>
            <div class="template-grid">
              <div *ngFor="let t of templates" class="template-card">
                <div class="template-header"><h4>{{t.name}}</h4><nz-tag nzColor="blue">Active</nz-tag></div>
                <p class="text-sm text-gray-500 my-2">{{t.description}}</p>
                <div class="template-meta">
                  <span><i class="fa-solid fa-calendar text-gray-400 mr-1"></i>Chu kỳ: {{t.cycle}}</span>
                  <span><i class="fa-solid fa-clock text-gray-400 mr-1"></i>~{{t.hours}}h</span>
                </div>
                <div class="template-checklist">
                  <span class="text-xs text-gray-500">Checklist:</span>
                  <div *ngFor="let c of t.checklist" class="check-mini"><i class="fa-solid fa-check-circle text-emerald-500 text-xs"></i> {{c}}</div>
                </div>
                <div class="template-skills">
                  <nz-tag *ngFor="let s of t.skills" style="font-size:10px;">{{s}}</nz-tag>
                </div>
              </div>
            </div>
          </nz-card>
        </nz-tab>
      </nz-tabset>
    </div>
  `,
  styles: [`
    .page-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:12px}.page-title{font-size:24px;font-weight:700}.page-desc{font-size:13px;color:#64748b}.mr-2{margin-right:8px}.mr-1{margin-right:4px}.font-medium{font-weight:500}.font-semibold{font-weight:600}.text-sm{font-size:14px}.text-xs{font-size:12px}.flex{display:flex}.gap-3{gap:12px}.gap-2{gap:8px}.my-2{margin:8px 0}.mb-4{margin-bottom:16px}.justify-between{justify-content:space-between}
    .stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
    .stat-card{background:white;border-radius:12px;padding:16px 20px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.06)}.stat-num{font-size:28px;font-weight:700}.stat-lab{font-size:12px;color:#64748b}
    .gantt{overflow-x:auto}.gantt-header{display:flex;border-bottom:2px solid #e2e8f0;padding:8px 0}
    .gantt-label-h{width:180px;flex-shrink:0;font-weight:600;font-size:13px;color:#374151}.gantt-timeline{flex:1;display:flex}
    .gantt-day{flex:1;text-align:center;display:flex;flex-direction:column;font-size:11px;color:#94a3b8;padding:4px 2px}
    .gantt-day.today{background:#eff6ff;border-radius:6px}.gantt-day .day-name{font-weight:600;color:#64748b}.gantt-day .day-num{font-weight:500}
    .gantt-row{display:flex;align-items:center;border-bottom:1px solid #f1f5f9;min-height:52px}
    .gantt-label{width:180px;flex-shrink:0;padding:4px 8px}.gantt-eq-name{font-size:13px;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
    .gantt-bars{flex:1;position:relative;height:36px}
    .gantt-bar{position:absolute;height:28px;border-radius:6px;display:flex;align-items:center;padding:0 8px;font-size:11px;color:white;gap:4px;top:4px;cursor:pointer;transition:opacity 0.15s}
    .gantt-bar:hover{opacity:0.85}
    .type-predictive{background:linear-gradient(90deg,#8b5cf6,#a78bfa)}.type-preventive{background:linear-gradient(90deg,#3b82f6,#60a5fa)}
    .type-corrective{background:linear-gradient(90deg,#ef4444,#f87171)}.type-emergency{background:linear-gradient(90deg,#f97316,#fb923c)}
    .gantt-legend,.cal-legend{display:flex;gap:16px;padding-top:12px;font-size:12px;color:#64748b;flex-wrap:wrap}
    .leg-dot{width:12px;height:12px;border-radius:4px;display:inline-block;margin-right:4px;vertical-align:middle}
    .leg-dot.prev{background:#3b82f6}.leg-dot.pred{background:#8b5cf6}.leg-dot.corr{background:#ef4444}.leg-dot.emer{background:#f97316}

    .calendar-wrapper{margin-top:16px}
    .cal-month-label{font-size:18px;font-weight:700;margin-bottom:12px;color:#0f172a}
    .cal-grid{border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}
    .cal-header-row{display:grid;grid-template-columns:repeat(7,1fr);background:#f8fafc}
    .cal-header-cell{padding:8px;text-align:center;font-size:12px;font-weight:600;color:#64748b;border-bottom:1px solid #e2e8f0}
    .cal-body{}
    .cal-week-row{display:grid;grid-template-columns:repeat(7,1fr)}
    .cal-cell{min-height:90px;padding:6px;border:1px solid #f1f5f9;transition:background 0.15s}
    .cal-cell:hover{background:#f8fafc}
    .cal-cell.other-month{background:#fafafa}.cal-cell.other-month .cal-day-num{color:#cbd5e1}
    .cal-cell.today{background:#eff6ff}
    .cal-day-num{font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:2px}
    .cal-event{font-size:10px;padding:2px 6px;border-radius:4px;margin-bottom:2px;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;font-weight:600;letter-spacing:1px;text-align:center}

    .ai-rec-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
    .ai-rec-info{display:flex;gap:12px;align-items:center}
    .cost-compare{display:flex;flex-direction:column;gap:2px}
    .template-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
    .template-card{padding:20px;border-radius:12px;border:1px solid #e2e8f0;background:#f8fafc;transition:transform 0.15s}
    .template-card:hover{transform:translateY(-2px)}
    .template-header{display:flex;justify-content:space-between;align-items:center}
    .template-card h4{font-size:15px;font-weight:600;margin:0}.template-meta{display:flex;justify-content:space-between;margin-top:12px;font-size:12px;color:#64748b}
    .template-checklist{margin-top:10px;display:flex;flex-direction:column;gap:2px}
    .check-mini{font-size:11px;color:#475569;display:flex;align-items:center;gap:4px}
    .template-skills{margin-top:8px;display:flex;gap:4px;flex-wrap:wrap}
  `]
})
export class MaintenanceComponent implements OnInit {
  private api = inject(ApiService);
  schedules: MaintenanceSchedule[] = [];
  viewRange = 'week';
  ganttDays: { label: string; dayName: string; date: Date; isToday: boolean }[] = [];
  ganttStart = new Date();
  ganttEnd = new Date();

  aiRecommendations = [
    { equipmentName: 'Máy ép thủy lực M09', reason: 'RUL còn 23 ngày, nhiệt độ dầu tăng liên tục', deadline: '05/03/2026', confidence: 94, urgent: true, costIgnore: '~120M VNĐ', costFix: '~8.5M VNĐ' },
    { equipmentName: 'Động cơ băng tải chính', reason: 'Cách điện suy giảm, xác suất hỏng 78% trong 7 ngày', deadline: '01/03/2026', confidence: 78, urgent: true, costIgnore: '~200M VNĐ', costFix: '~15M VNĐ' },
    { equipmentName: 'Băng tải A3', reason: 'Ổ bi motor hao mòn dự kiến, rung động tăng 20%', deadline: '10/03/2026', confidence: 85, urgent: false, costIgnore: '~45M VNĐ', costFix: '~5M VNĐ' },
    { equipmentName: 'Máy nén khí Atlas', reason: 'Nhiệt khí nén tăng dần, lọc gió cần thay', deadline: '20/03/2026', confidence: 72, urgent: false, costIgnore: '~30M VNĐ', costFix: '~3.2M VNĐ' },
  ];

  templates = [
    { name: 'PM Máy CNC hàng quý', description: 'Kiểm tra, bôi trơn, thay lọc, hiệu chuẩn trục XYZ', cycle: '3 tháng', hours: 5, checklist: ['Kiểm tra hệ truyền động', 'Bôi trơn guide rails', 'Thay lọc dầu', 'Hiệu chuẩn trục'], skills: ['CNC', 'Calibration'] },
    { name: 'PM Máy ép thủy lực', description: 'Thay dầu, lọc, kiểm tra van an toàn, đường ống', cycle: '6 tháng', hours: 8, checklist: ['Xả dầu cũ', 'Thay bộ lọc', 'Kiểm tra van', 'Kiểm tra ống dẫn', 'Đổ dầu mới'], skills: ['Hydraulics', 'Safety'] },
    { name: 'PM Robot hàn', description: 'Hiệu chuẩn, thay đầu hàn, kiểm tra servo motor', cycle: '3 tháng', hours: 4, checklist: ['Hiệu chuẩn TCP', 'Thay đầu hàn', 'Kiểm tra servo', 'Test program'], skills: ['Robotics', 'Welding'] },
    { name: 'PM Máy nén khí', description: 'Thay lọc gió, kiểm tra van an toàn, bôi trơn', cycle: '3 tháng', hours: 3, checklist: ['Thay lọc gió', 'Kiểm tra van xả', 'Kiểm tra bộ làm mát'], skills: ['Pneumatic'] },
  ];

  calWeeks: any[][] = [];

  ngOnInit() {
    this.api.getMaintenanceSchedules().subscribe(d => {
      this.schedules = d;
      this.updateGantt();
      this.buildCalendar();
    });
  }

  countType(t: string) { return this.schedules.filter(s => s.type === t).length; }

  updateGantt() {
    const today = new Date();
    const dayCount = this.viewRange === 'week' ? 7 : this.viewRange === '2week' ? 14 : 30;
    this.ganttStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    this.ganttEnd = new Date(this.ganttStart.getTime() + dayCount * 86400000);
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    this.ganttDays = [];
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(this.ganttStart.getTime() + i * 86400000);
      this.ganttDays.push({
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        dayName: dayNames[d.getDay()],
        date: d,
        isToday: d.toDateString() === today.toDateString()
      });
    }
  }

  getBarLeft(s: MaintenanceSchedule): number {
    const start = new Date(s.startDate).getTime();
    const range = this.ganttEnd.getTime() - this.ganttStart.getTime();
    const offset = Math.max(0, start - this.ganttStart.getTime());
    return Math.min(95, (offset / range) * 100);
  }

  getBarWidth(s: MaintenanceSchedule): number {
    const start = new Date(s.startDate).getTime();
    const end = new Date(s.endDate).getTime();
    const range = this.ganttEnd.getTime() - this.ganttStart.getTime();
    const duration = Math.max(end - start, 86400000); // min 1 day
    return Math.max(5, Math.min(80, (duration / range) * 100));
  }

  buildCalendar() {
    const year = 2026; const month = 2; // March 2026
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startOffset = (firstDay.getDay() + 6) % 7; // Monday-based
    const weeks: any[][] = [];
    let currentWeek: any[] = [];

    // Previous month days
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      currentWeek.push({ day: d.getDate(), otherMonth: true, isToday: false, events: [] });
    }

    // Current month days
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dateStr = `2026-03-${String(day).padStart(2, '0')}`;
      const events = this.schedules.filter(s => s.startDate <= dateStr && s.endDate >= dateStr).map(s => ({ title: s.title, type: s.type }));
      const today = new Date();
      currentWeek.push({ day, otherMonth: false, isToday: day === today.getDate() && month === today.getMonth(), events });
      if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = []; }
    }

    // Fill remaining
    let nextDay = 1;
    while (currentWeek.length < 7 && currentWeek.length > 0) {
      currentWeek.push({ day: nextDay++, otherMonth: true, isToday: false, events: [] });
    }
    if (currentWeek.length) weeks.push(currentWeek);
    this.calWeeks = weeks;
  }

  getBarAbbr(title: string): string {
    return title.split(/\s+/).slice(0, 5).map(w => w.charAt(0).toUpperCase()).join('');
  }

  getEventAbbr(title: string): string {
    return title.split(/\s+/).slice(0, 5).map(w => w.charAt(0).toUpperCase()).join('');
  }
}
