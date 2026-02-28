import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { FormsModule } from '@angular/forms';
import { NgxEchartsModule } from 'ngx-echarts';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-reports', standalone: true,
  imports: [CommonModule, FormsModule, NzCardModule, NzTagModule, NzButtonModule, NzTabsModule, NzSelectModule, NzTableModule, NzProgressModule, NgxEchartsModule],
  template: `
    <div class="fade-in">
      <div class="page-header"><div><h1 class="page-title">Báo cáo & Phân tích</h1><p class="page-desc">Reports & Analytics · jsPDF + html2canvas · Export PDF/Excel</p></div>
        <div class="flex gap-3">
          <nz-select [(ngModel)]="dateRange" style="width:160px;">
            <nz-option nzValue="7d" nzLabel="7 ngày"></nz-option><nz-option nzValue="30d" nzLabel="30 ngày"></nz-option>
            <nz-option nzValue="90d" nzLabel="3 tháng"></nz-option><nz-option nzValue="1y" nzLabel="1 năm"></nz-option>
          </nz-select>
          <button nz-button nzType="default" (click)="exportPDF()"><i class="fa-solid fa-file-pdf mr-2"></i>Export PDF</button>
          <button nz-button nzType="default"><i class="fa-solid fa-file-excel mr-2"></i>Export Excel</button>
        </div>
      </div>
      <nz-tabset nzType="card">
        <!-- OEE Dashboard -->
        <nz-tab nzTitle="OEE Dashboard">
          <div class="kpi-row">
            <div class="kpi-big"><div class="kpi-val text-blue-600">83.4%</div><div class="kpi-lab">OEE Overall</div><nz-tag nzColor="green" style="margin-top:4px;">↑ 2.1%</nz-tag></div>
            <div class="kpi-big"><div class="kpi-val text-emerald-600">91.2%</div><div class="kpi-lab">Availability</div></div>
            <div class="kpi-big"><div class="kpi-val text-amber-500">93.5%</div><div class="kpi-lab">Performance</div></div>
            <div class="kpi-big"><div class="kpi-val text-purple-600">97.8%</div><div class="kpi-lab">Quality</div></div>
          </div>
          <div class="grid-2">
            <nz-card nzTitle="OEE Trend (30 ngày)" style="border-radius:16px !important;">
              <div echarts [options]="oeeChartOpts" style="height:300px;"></div>
            </nz-card>
            <nz-card nzTitle="OEE Breakdown" style="border-radius:16px !important;">
              <div echarts [options]="oeeBreakdownOpts" style="height:300px;"></div>
            </nz-card>
          </div>
        </nz-tab>

        <!-- Maintenance Cost -->
        <nz-tab nzTitle="Maintenance Cost">
          <div class="kpi-row">
            <div class="kpi-big"><div class="kpi-val text-blue-600">580M</div><div class="kpi-lab">Tổng chi phí (VNĐ)</div></div>
            <div class="kpi-big"><div class="kpi-val text-emerald-600">-18%</div><div class="kpi-lab">So với kỳ trước</div></div>
            <div class="kpi-big"><div class="kpi-val text-purple-600">62%</div><div class="kpi-lab">Tỷ lệ phòng ngừa</div></div>
            <div class="kpi-big"><div class="kpi-val text-red-500">12%</div><div class="kpi-lab">Sửa chữa khẩn cấp</div></div>
          </div>
          <nz-card nzTitle="Chi phí bảo trì theo tháng" style="border-radius:16px !important;">
            <div echarts [options]="costChartOpts" style="height:350px;"></div>
          </nz-card>
        </nz-tab>

        <!-- Equipment Reliability -->
        <nz-tab nzTitle="Equipment Reliability">
          <div class="grid-2">
            <nz-card nzTitle="MTBF theo thiết bị (Mean Time Between Failures)" style="border-radius:16px !important;">
              <div echarts [options]="mtbfChartOpts" style="height:300px;"></div>
            </nz-card>
            <nz-card nzTitle="MTTR Trend (Mean Time To Repair)" style="border-radius:16px !important;">
              <div echarts [options]="mttrChartOpts" style="height:300px;"></div>
            </nz-card>
          </div>
          <nz-card nzTitle="Asset Health Summary" class="mt-5" style="border-radius:16px !important;">
            <nz-table #healthTbl [nzData]="assetHealthData" nzSize="middle" [nzFrontPagination]="false">
              <thead><tr><th>Thiết bị</th><th>Health Score</th><th>MTBF (h)</th><th>MTTR (h)</th><th>Uptime</th><th>RUL (ngày)</th><th>Trend</th></tr></thead>
              <tbody><tr *ngFor="let h of healthTbl.data">
                <td class="font-medium">{{h.name}}</td>
                <td><nz-progress [nzPercent]="h.healthScore" nzSize="small" style="width:80px;"
                  [nzStrokeColor]="h.healthScore>80?'#10b981':h.healthScore>60?'#f59e0b':'#ef4444'"></nz-progress></td>
                <td class="mono">{{h.mtbf}}</td>
                <td class="mono">{{h.mttr}}</td>
                <td class="mono">{{h.uptime}}%</td>
                <td><nz-tag [nzColor]="h.rul<30?'red':h.rul<60?'gold':'green'">{{h.rul}} ngày</nz-tag></td>
                <td><nz-tag [nzColor]="h.trend==='improving'?'green':h.trend==='stable'?'blue':'red'">{{h.trend==='improving'?'↑ Tốt lên':h.trend==='stable'?'→ Ổn định':'↓ Xấu đi'}}</nz-tag></td>
              </tr></tbody>
            </nz-table>
          </nz-card>
        </nz-tab>

        <!-- PM Compliance -->
        <nz-tab nzTitle="PM Compliance">
          <div class="kpi-row">
            <div class="kpi-big"><div class="kpi-val text-emerald-600">92%</div><div class="kpi-lab">PM Compliance Rate</div></div>
            <div class="kpi-big"><div class="kpi-val text-blue-600">48</div><div class="kpi-lab">PM Completed</div></div>
            <div class="kpi-big"><div class="kpi-val text-amber-500">4</div><div class="kpi-lab">PM Overdue</div></div>
            <div class="kpi-big"><div class="kpi-val text-purple-600">8</div><div class="kpi-lab">PM Scheduled</div></div>
          </div>
          <nz-card nzTitle="PM Compliance by Equipment" style="border-radius:16px !important;">
            <div echarts [options]="pmComplianceOpts" style="height:350px;"></div>
          </nz-card>
        </nz-tab>

        <!-- AI Effectiveness -->
        <nz-tab nzTitle="AI Effectiveness">
          <div class="kpi-row">
            <div class="kpi-big"><div class="kpi-val text-purple-600">87%</div><div class="kpi-lab">Prediction Accuracy</div></div>
            <div class="kpi-big"><div class="kpi-val text-emerald-600">240M</div><div class="kpi-lab">Tiết kiệm (VNĐ)</div></div>
            <div class="kpi-big"><div class="kpi-val text-blue-600">73%</div><div class="kpi-lab">Alerts phát hiện sớm</div></div>
            <div class="kpi-big"><div class="kpi-val text-amber-500">-35%</div><div class="kpi-lab">Giảm downtime</div></div>
          </div>
          <nz-card nzTitle="Predictive Maintenance ROI" style="border-radius:16px !important;">
            <div echarts [options]="aiRoiOpts" style="height:350px;"></div>
          </nz-card>
        </nz-tab>
      </nz-tabset>
    </div>
  `,
  styles: [`
    .page-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:12px}.page-title{font-size:24px;font-weight:700}.page-desc{font-size:13px;color:#64748b}.mr-2{margin-right:8px}.flex{display:flex}.gap-3{gap:12px}
    .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:20px}.mt-5{margin-top:20px}.mono{font-family:'JetBrains Mono',monospace}.font-medium{font-weight:500}
    .kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
    .kpi-big{background:white;border-radius:16px;padding:20px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .kpi-val{font-size:32px;font-weight:800;font-family:'JetBrains Mono',monospace}.kpi-lab{font-size:12px;color:#64748b;margin-top:4px}
  `]
})
export class ReportsComponent implements OnInit {
  private api = inject(ApiService);
  oeeChartOpts: any = {}; oeeBreakdownOpts: any = {}; costChartOpts: any = {}; mtbfChartOpts: any = {}; mttrChartOpts: any = {}; aiRoiOpts: any = {}; pmComplianceOpts: any = {};
  dateRange = '30d';
  assetHealthData = [
    { name: 'Máy CNC #01', healthScore: 92, mtbf: 1200, mttr: 2.5, uptime: 98.2, rul: 180, trend: 'improving' as const },
    { name: 'Máy ép M09', healthScore: 65, mtbf: 450, mttr: 4.2, uptime: 91.5, rul: 23, trend: 'declining' as const },
    { name: 'Băng tải A3', healthScore: 78, mtbf: 800, mttr: 1.8, uptime: 95.3, rul: 45, trend: 'stable' as const },
    { name: 'Robot hàn #12', healthScore: 88, mtbf: 1500, mttr: 3.1, uptime: 97.1, rul: 90, trend: 'improving' as const },
    { name: 'Máy nén khí', healthScore: 71, mtbf: 680, mttr: 2.9, uptime: 93.8, rul: 35, trend: 'declining' as const },
    { name: 'Robot lắp ráp', healthScore: 95, mtbf: 2200, mttr: 1.5, uptime: 99.1, rul: 210, trend: 'improving' as const },
    { name: 'Bơm VP-3', healthScore: 83, mtbf: 900, mttr: 2.0, uptime: 96.5, rul: 60, trend: 'stable' as const },
  ];

  ngOnInit() {
    this.api.getOEEHistory().subscribe(data => {
      const dates = data.map(d => d.date.slice(5));
      this.oeeChartOpts = {
        tooltip: { trigger: 'axis' }, legend: { data: ['Availability', 'Performance', 'Quality', 'OEE'], bottom: 0 },
        grid: { left: '5%', right: '3%', top: '5%', bottom: '15%', containLabel: true },
        xAxis: { type: 'category', data: dates }, yAxis: { type: 'value', min: 70, max: 100 },
        series: [
          { name: 'Availability', type: 'line', data: data.map(d => d.availability), smooth: true, itemStyle: { color: '#3b82f6' } },
          { name: 'Performance', type: 'line', data: data.map(d => d.performance), smooth: true, itemStyle: { color: '#10b981' } },
          { name: 'Quality', type: 'line', data: data.map(d => d.quality), smooth: true, itemStyle: { color: '#f59e0b' } },
          { name: 'OEE', type: 'line', data: data.map(d => d.oee), smooth: true, lineStyle: { width: 3 }, itemStyle: { color: '#8b5cf6' } }
        ]
      };
    });
    this.oeeBreakdownOpts = {
      tooltip: { trigger: 'item' }, series: [{
        type: 'pie', radius: ['40%', '70%'], data: [
          { value: 91.2, name: 'Availability', itemStyle: { color: '#3b82f6' } },
          { value: 93.5, name: 'Performance', itemStyle: { color: '#10b981' } },
          { value: 97.8, name: 'Quality', itemStyle: { color: '#f59e0b' } }
        ], label: { formatter: '{b}\n{c}%' }
      }]
    };
    this.api.getMaintenanceCostHistory().subscribe(data => {
      this.costChartOpts = {
        tooltip: { trigger: 'axis' }, legend: { data: ['Preventive', 'Corrective', 'Predictive'], bottom: 0 },
        grid: { left: '8%', right: '3%', top: '5%', bottom: '15%', containLabel: true },
        xAxis: { type: 'category', data: data.map(d => d.month) }, yAxis: { type: 'value', axisLabel: { formatter: (v: number) => (v / 1000000) + 'M' } },
        series: [
          { name: 'Preventive', type: 'bar', stack: 'total', data: data.map(d => d.preventive), itemStyle: { color: '#3b82f6' } },
          { name: 'Corrective', type: 'bar', stack: 'total', data: data.map(d => d.corrective), itemStyle: { color: '#ef4444' } },
          { name: 'Predictive', type: 'bar', stack: 'total', data: data.map(d => d.predictive), itemStyle: { color: '#8b5cf6', borderRadius: [6, 6, 0, 0] } }
        ]
      };
    });
    this.mtbfChartOpts = {
      tooltip: { trigger: 'axis' }, grid: { left: '30%', right: '5%', top: '3%', bottom: '3%' },
      xAxis: { type: 'value', name: 'Giờ' }, yAxis: { type: 'category', data: ['Máy CNC', 'Máy ép', 'Băng tải', 'Robot hàn', 'Máy nén'].reverse() },
      series: [{ type: 'bar', data: [1200, 450, 800, 1500, 680], itemStyle: { color: '#3b82f6', borderRadius: [0, 6, 6, 0] } }]
    };
    this.mttrChartOpts = {
      tooltip: { trigger: 'axis' }, grid: { left: '5%', right: '3%', top: '5%', bottom: '10%', containLabel: true },
      xAxis: { type: 'category', data: ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'] }, yAxis: { type: 'value', name: 'Giờ' },
      series: [{ type: 'line', data: [3.2, 2.9, 2.8, 2.6, 2.5, 2.4], smooth: true, itemStyle: { color: '#10b981' }, areaStyle: { color: 'rgba(16,185,129,0.1)' } }]
    };
    this.aiRoiOpts = {
      tooltip: { trigger: 'axis' }, legend: { data: ['Chi phí không có AI', 'Chi phí với AI', 'Tiết kiệm'], bottom: 0 },
      grid: { left: '8%', right: '3%', top: '5%', bottom: '15%', containLabel: true },
      xAxis: { type: 'category', data: ['Q3/25', 'Q4/25', 'Q1/26'] }, yAxis: { type: 'value', axisLabel: { formatter: (v: number) => (v / 1000000) + 'M' } },
      series: [
        { name: 'Chi phí không có AI', type: 'bar', data: [250000000, 230000000, 220000000], itemStyle: { color: '#ef4444', borderRadius: [6, 6, 0, 0] } },
        { name: 'Chi phí với AI', type: 'bar', data: [180000000, 160000000, 140000000], itemStyle: { color: '#3b82f6', borderRadius: [6, 6, 0, 0] } },
        { name: 'Tiết kiệm', type: 'line', data: [70000000, 70000000, 80000000], itemStyle: { color: '#10b981' }, lineStyle: { width: 3 } }
      ]
    };
    const eqs = ['CNC #01', 'Máy ép M09', 'Băng tải A3', 'Robot hàn', 'Máy nén', 'Robot LR', 'Bơm VP-3'];
    this.pmComplianceOpts = {
      tooltip: { trigger: 'axis' }, legend: { data: ['Completed', 'Overdue', 'Scheduled'], bottom: 0 },
      grid: { left: '25%', right: '5%', top: '5%', bottom: '15%' },
      yAxis: { type: 'category', data: eqs.reverse() },
      xAxis: { type: 'value', max: 15 },
      series: [
        { name: 'Completed', type: 'bar', stack: 'total', data: [8, 6, 7, 5, 4, 9, 7], itemStyle: { color: '#10b981' } },
        { name: 'Overdue', type: 'bar', stack: 'total', data: [0, 1, 0, 1, 2, 0, 0], itemStyle: { color: '#ef4444' } },
        { name: 'Scheduled', type: 'bar', stack: 'total', data: [2, 1, 1, 2, 1, 1, 1], itemStyle: { color: '#dbeafe', borderRadius: [0, 6, 6, 0] } },
      ]
    };
  }

  exportPDF() {
    // Stub: would use jsPDF + html2canvas
    alert('📄 Xuất PDF thành công! (Mock)');
  }
}
