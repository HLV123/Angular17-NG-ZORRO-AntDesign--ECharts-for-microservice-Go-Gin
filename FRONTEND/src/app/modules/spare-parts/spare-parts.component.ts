import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NgxEchartsModule } from 'ngx-echarts';
import { ApiService } from '../../core/services/api.service';
import { SparePart } from '../../core/models';

@Component({
  selector: 'app-spare-parts', standalone: true,
  imports: [CommonModule, FormsModule, NzTableModule, NzTagModule, NzCardModule, NzButtonModule, NzInputModule, NzProgressModule, NzBadgeModule, NzTabsModule, NzSelectModule, NzAlertModule, NzToolTipModule, NgxEchartsModule],
  template: `
    <div class="fade-in">
      <div class="page-header"><div><h1 class="page-title">Kho Linh kiện Dự phòng</h1><p class="page-desc">Spare Parts & Inventory · {{parts.length}} mục · Auto-Reorder · AI Demand Forecast</p></div>
        <div class="flex gap-3"><button nz-button nzType="default"><i class="fa-solid fa-file-export mr-2"></i>Export</button><button nz-button nzType="primary"><i class="fa-solid fa-plus mr-2"></i>Nhập linh kiện</button></div>
      </div>

      <!-- Low Stock Alert -->
      <nz-alert *ngIf="countSt('out_of_stock') > 0" nzType="error" [nzMessage]="'Có ' + countSt('out_of_stock') + ' linh kiện đã hết hàng!'" nzShowIcon style="margin-bottom:16px;border-radius:10px;"></nz-alert>
      <nz-alert *ngIf="countSt('low_stock') > 0 && !countSt('out_of_stock')" nzType="warning" [nzMessage]="countSt('low_stock') + ' linh kiện sắp hết. Cần đặt hàng bổ sung.'" nzShowIcon style="margin-bottom:16px;border-radius:10px;"></nz-alert>

      <!-- Stats -->
      <div class="stats-row">
        <div class="stat-card"><div class="stat-num text-green-600">{{countSt('ok')}}</div><div class="stat-lab">Đủ hàng</div></div>
        <div class="stat-card"><div class="stat-num text-amber-500">{{countSt('low_stock')}}</div><div class="stat-lab">Sắp hết</div></div>
        <div class="stat-card"><div class="stat-num text-red-500">{{countSt('out_of_stock')}}</div><div class="stat-lab">Hết hàng</div></div>
        <div class="stat-card"><div class="stat-num text-blue-500">{{totalValue | number:'1.0-0'}}</div><div class="stat-lab">Giá trị tồn kho (₫)</div></div>
      </div>

      <nz-tabset nzType="card">
        <!-- Tab 1: Inventory -->
        <nz-tab nzTitle="Kho hàng">
          <div class="grid-2 mb-5">
            <nz-card nzTitle="Giá trị tồn kho theo tháng" style="border-radius:16px !important;">
              <div echarts [options]="invChartOpts" style="height:600px;"></div>
            </nz-card>
            <nz-card nzTitle="Top linh kiện tiêu thụ (6 tháng)" style="border-radius:16px !important;">
              <div echarts [options]="topChartOpts" style="height:700px;"></div>
            </nz-card>
          </div>
          <nz-card style="border-radius:16px !important;">
            <div class="filter-row mb-3">
              <nz-select [(ngModel)]="filterStatus" nzPlaceHolder="Trạng thái" nzAllowClear (ngModelChange)="applyFilter()" style="width:150px;">
                <nz-option nzValue="ok" nzLabel="Đủ hàng"></nz-option><nz-option nzValue="low_stock" nzLabel="Sắp hết"></nz-option>
                <nz-option nzValue="out_of_stock" nzLabel="Hết hàng"></nz-option><nz-option nzValue="overstock" nzLabel="Dư thừa"></nz-option>
              </nz-select>
              <nz-select [(ngModel)]="filterAbc" nzPlaceHolder="ABC Class" nzAllowClear (ngModelChange)="applyFilter()" style="width:120px;">
                <nz-option nzValue="A" nzLabel="Class A"></nz-option><nz-option nzValue="B" nzLabel="Class B"></nz-option><nz-option nzValue="C" nzLabel="Class C"></nz-option>
              </nz-select>
              <input nz-input placeholder="Tìm kiếm..." [(ngModel)]="searchText" (ngModelChange)="applyFilter()" style="width:200px;" />
            </div>
            <nz-table #spTbl [nzData]="filtered" nzSize="middle" [nzPageSize]="10">
              <thead><tr><th>Part Number</th><th>Tên</th><th>Nhà SX</th><th>Tồn kho</th><th>Reorder Pt</th><th>Trạng thái</th><th>ABC</th><th>Đơn giá</th><th>Vị trí</th></tr></thead>
              <tbody><tr *ngFor="let p of spTbl.data" [class.row-danger]="p.status==='out_of_stock'" [class.row-warn]="p.status==='low_stock'">
                <td><span class="mono text-xs">{{p.partNumber}}</span></td>
                <td class="font-medium">{{p.name}}</td>
                <td>{{p.manufacturer}}</td>
                <td>
                  <div class="stock-cell">
                    <strong [class]="p.quantity===0?'text-red-500':p.quantity<=p.reorderPoint?'text-amber-500':'text-green-600'">{{p.quantity}}</strong>
                    <span class="text-xs text-gray-400">/{{p.maxStock || p.reorderPoint * 3}} {{p.unit}}</span>
                    <nz-progress [nzPercent]="getStockPercent(p)" nzSize="small" [nzShowInfo]="false" style="width:60px;"
                      [nzStrokeColor]="p.quantity===0?'#ef4444':p.quantity<=p.reorderPoint?'#f59e0b':'#10b981'"></nz-progress>
                  </div>
                </td>
                <td>{{p.reorderPoint}}</td>
                <td><nz-tag [nzColor]="stColor(p.status)">{{stLabel(p.status)}}</nz-tag></td>
                <td><nz-tag [nzColor]="p.abcClass==='A'?'red':p.abcClass==='B'?'orange':'default'">{{p.abcClass}}</nz-tag></td>
                <td class="mono text-sm">{{p.unitPrice | number}} ₫</td>
                <td class="text-xs text-gray-500">{{p.location || 'Kho A-' + (p.partNumber.slice(-2))}}</td>
              </tr></tbody>
            </nz-table>
          </nz-card>
        </nz-tab>

        <!-- Tab 2: AI Demand Forecast -->
        <nz-tab nzTitle="AI Demand Forecast">
          <nz-card style="border-radius:16px !important;">
            <div class="ai-header">
              <div class="flex items-center gap-3">
                <i class="fa-solid fa-brain text-purple-500" style="font-size:20px;"></i>
                <div><span class="font-semibold">Dự báo Nhu cầu Linh kiện (AI)</span><br><span class="text-xs text-gray-500">Dựa trên lịch sử tiêu thụ + lịch bảo trì sắp tới + dự đoán hỏng hóc</span></div>
              </div>
            </div>
            <div echarts [options]="forecastChartOpts" style="height:350px;margin:16px 0;"></div>
            <nz-table #fcTbl [nzData]="forecastData" nzSize="small" [nzFrontPagination]="false">
              <thead><tr><th>Linh kiện</th><th>Tồn hiện tại</th><th>Dự báo 30 ngày</th><th>Cần mua</th><th>Deadline đặt</th><th>Hành động</th></tr></thead>
              <tbody><tr *ngFor="let f of fcTbl.data">
                <td class="font-medium">{{f.name}}</td>
                <td>{{f.current}} {{f.unit}}</td>
                <td><nz-tag nzColor="purple">{{f.forecast}} {{f.unit}}</nz-tag></td>
                <td><strong [class]="f.needToBuy > 0 ? 'text-red-500' : 'text-green-600'">{{f.needToBuy > 0 ? f.needToBuy : 'Đủ'}}</strong></td>
                <td>{{f.orderBy}}</td>
                <td><button nz-button nzSize="small" nzType="primary" *ngIf="f.needToBuy > 0">Đặt hàng</button></td>
              </tr></tbody>
            </nz-table>
          </nz-card>
        </nz-tab>

        <!-- Tab 3: Auto-Reorder Rules -->
        <nz-tab nzTitle="Auto-Reorder">
          <nz-card nzTitle="Cấu hình Tự động Đặt hàng" style="border-radius:16px !important;">
            <div class="reorder-rules">
              <div *ngFor="let r of reorderRules" class="rule-card">
                <div class="rule-header">
                  <span class="rule-name">{{r.name}}</span>
                  <nz-badge [nzStatus]="r.enabled?'success':'default'" [nzText]="r.enabled?'Active':'Disabled'"></nz-badge>
                </div>
                <div class="rule-details">
                  <span><i class="fa-solid fa-arrow-down text-red-400 mr-1"></i>Trigger: Tồn kho ≤ {{r.triggerQty}} {{r.unit}}</span>
                  <span><i class="fa-solid fa-cube text-blue-400 mr-1"></i>Đặt: {{r.orderQty}} {{r.unit}}</span>
                  <span><i class="fa-solid fa-building text-gray-400 mr-1"></i>NCC: {{r.supplier}}</span>
                  <span><i class="fa-solid fa-truck text-emerald-400 mr-1"></i>Lead time: {{r.leadTime}}</span>
                </div>
              </div>
            </div>
          </nz-card>
        </nz-tab>

        <!-- Tab 4: Order Tracking -->
        <nz-tab nzTitle="Theo dõi Đơn hàng">
          <nz-card style="border-radius:16px !important;">
            <nz-table #otTbl [nzData]="orderTracking" nzSize="middle">
              <thead><tr><th>PO Number</th><th>Linh kiện</th><th>Số lượng</th><th>NCC</th><th>Ngày đặt</th><th>ETA</th><th>Trạng thái</th></tr></thead>
              <tbody><tr *ngFor="let o of otTbl.data">
                <td class="mono text-xs">{{o.poNumber}}</td>
                <td class="font-medium">{{o.partName}}</td>
                <td>{{o.quantity}} {{o.unit}}</td>
                <td>{{o.supplier}}</td>
                <td class="text-xs">{{o.orderDate}}</td>
                <td class="text-xs">{{o.eta}}</td>
                <td><nz-tag [nzColor]="o.status==='delivered'?'green':o.status==='in_transit'?'blue':o.status==='processing'?'gold':'default'">{{o.statusLabel}}</nz-tag></td>
              </tr></tbody>
            </nz-table>
          </nz-card>
        </nz-tab>
      </nz-tabset>
    </div>
  `,
  styles: [`
    .page-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:12px}.page-title{font-size:24px;font-weight:700}.page-desc{font-size:13px;color:#64748b}.mr-2{margin-right:8px}.mr-1{margin-right:4px}.mono{font-family:'JetBrains Mono',monospace}.font-medium{font-weight:500}.font-semibold{font-weight:600}.text-sm{font-size:14px}.text-xs{font-size:12px}.flex{display:flex}.gap-3{gap:12px}.items-center{align-items:center}
    .stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
    .stat-card{background:white;border-radius:12px;padding:16px 20px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.06)}.stat-num{font-size:24px;font-weight:700}.stat-lab{font-size:12px;color:#64748b}
    .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:20px}.mb-5{margin-bottom:20px}.mb-3{margin-bottom:12px}
    .filter-row{display:flex;gap:12px;flex-wrap:wrap}
    .stock-cell{display:flex;align-items:center;gap:6px}
    .row-danger{background:#fef2f2 !important}.row-warn{background:#fffbeb !important}
    .ai-header{display:flex;justify-content:space-between;align-items:center}
    .reorder-rules{display:grid;grid-template-columns:repeat(auto-fill,minmax(350px,1fr));gap:16px}
    .rule-card{padding:20px;border-radius:12px;border:1px solid #e2e8f0;background:#f8fafc}
    .rule-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.rule-name{font-size:15px;font-weight:600}
    .rule-details{display:flex;flex-direction:column;gap:6px;font-size:13px;color:#475569}
  `]
})
export class SparePartsComponent implements OnInit {
  private api = inject(ApiService);
  parts: SparePart[] = [];
  filtered: SparePart[] = [];
  filterStatus: string | null = null;
  filterAbc: string | null = null;
  searchText = '';
  totalValue = 0;
  invChartOpts: any = {}; topChartOpts: any = {}; forecastChartOpts: any = {};

  forecastData = [
    { name: 'Ổ bi 6208-2RS', current: 8, forecast: 12, needToBuy: 4, unit: 'cái', orderBy: '05/03/2026' },
    { name: 'Lọc gió GA37', current: 2, forecast: 5, needToBuy: 3, unit: 'cái', orderBy: '01/03/2026' },
    { name: 'Dầu thủy lực 46', current: 40, forecast: 60, needToBuy: 20, unit: 'lít', orderBy: '10/03/2026' },
    { name: 'Đầu hàn ABB', current: 15, forecast: 10, needToBuy: 0, unit: 'cái', orderBy: '-' },
    { name: 'Belt V-A68', current: 3, forecast: 6, needToBuy: 3, unit: 'sợi', orderBy: '08/03/2026' },
  ];

  reorderRules = [
    { name: 'Ổ bi 6208-2RS', triggerQty: 5, orderQty: 20, unit: 'cái', supplier: 'SKF Việt Nam', leadTime: '5 ngày', enabled: true },
    { name: 'Lọc dầu HF-35', triggerQty: 3, orderQty: 10, unit: 'cái', supplier: 'Parker Hannifin', leadTime: '7 ngày', enabled: true },
    { name: 'Dầu thủy lực 46', triggerQty: 20, orderQty: 200, unit: 'lít', supplier: 'Shell Vietnam', leadTime: '3 ngày', enabled: true },
    { name: 'Đầu hàn TIG 1.6mm', triggerQty: 5, orderQty: 50, unit: 'cái', supplier: 'ABB Vietnam', leadTime: '10 ngày', enabled: false },
  ];

  orderTracking = [
    { poNumber: 'PO-2026-0234', partName: 'Bộ lọc dầu HF-35', quantity: 10, unit: 'cái', supplier: 'Parker Hannifin', orderDate: '20/02/2026', eta: '27/02/2026', status: 'in_transit', statusLabel: 'Đang vận chuyển' },
    { poNumber: 'PO-2026-0231', partName: 'Dầu thủy lực ISO 46', quantity: 200, unit: 'lít', supplier: 'Shell Vietnam', orderDate: '18/02/2026', eta: '21/02/2026', status: 'delivered', statusLabel: 'Đã nhận' },
    { poNumber: 'PO-2026-0238', partName: 'Ổ bi 6208-2RS', quantity: 20, unit: 'cái', supplier: 'SKF Việt Nam', orderDate: '25/02/2026', eta: '02/03/2026', status: 'processing', statusLabel: 'Đang xử lý' },
    { poNumber: 'PO-2026-0240', partName: 'Lọc gió GA37', quantity: 8, unit: 'cái', supplier: 'Atlas Copco', orderDate: '26/02/2026', eta: '05/03/2026', status: 'processing', statusLabel: 'Đang xử lý' },
  ];

  ngOnInit() {
    this.api.getSpareParts().subscribe(d => { this.parts = d; this.filtered = d; this.totalValue = d.reduce((s, p) => s + p.unitPrice * p.quantity, 0); this.initCharts(); });
  }

  countSt(s: string) { return this.parts.filter(p => p.status === s).length; }
  stColor(s: string) { return s === 'ok' ? 'green' : s === 'low_stock' ? 'gold' : s === 'out_of_stock' ? 'red' : 'blue'; }
  stLabel(s: string) { return s === 'ok' ? 'Đủ hàng' : s === 'low_stock' ? 'Sắp hết' : s === 'out_of_stock' ? 'Hết hàng' : 'Dư thừa'; }
  getStockPercent(p: SparePart) { const max = (p as any).maxStock || p.reorderPoint * 3; return Math.min(100, Math.round((p.quantity / max) * 100)); }

  applyFilter() {
    this.filtered = this.parts.filter(p =>
      (!this.filterStatus || p.status === this.filterStatus) &&
      (!this.filterAbc || p.abcClass === this.filterAbc) &&
      (!this.searchText || p.name.toLowerCase().includes(this.searchText.toLowerCase()) || p.partNumber.toLowerCase().includes(this.searchText.toLowerCase()))
    );
  }

  initCharts() {
    this.invChartOpts = {
      tooltip: { trigger: 'axis' }, grid: { left: '8%', right: '3%', top: '8%', bottom: '10%' },
      xAxis: { type: 'category', data: ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'] },
      yAxis: { type: 'value', name: 'VNĐ', axisLabel: { formatter: (v: number) => (v / 1000000) + 'M' } },
      series: [
        { type: 'bar', data: [180000000, 195000000, 210000000, 185000000, 200000000, 192000000], itemStyle: { color: '#3b82f6', borderRadius: [6, 6, 0, 0] }, name: 'Giá trị tồn kho' },
        { type: 'line', data: [170000000, 185000000, 190000000, 180000000, 195000000, 188000000], itemStyle: { color: '#f59e0b' }, name: 'Tiêu thụ', smooth: true }
      ],
      legend: { bottom: 0 }
    };
    this.topChartOpts = {
      tooltip: { trigger: 'axis' }, grid: { left: '35%', right: '5%', top: '3%', bottom: '3%' },
      xAxis: { type: 'value' }, yAxis: { type: 'category', data: ['Gioăng HEX', 'Đầu hàn ABB', 'Ổ bi 6208', 'Lọc gió GA37', 'Dầu thủy lực'].reverse() },
      series: [{ type: 'bar', data: [8, 12, 15, 18, 25], itemStyle: { color: '#f59e0b', borderRadius: [0, 6, 6, 0] } }]
    };
    const months = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
    this.forecastChartOpts = {
      tooltip: { trigger: 'axis' }, legend: { data: ['Tiêu thụ lịch sử', 'Dự báo AI', 'Tồn kho dự kiến'], bottom: 0 },
      grid: { left: '5%', right: '3%', top: '8%', bottom: '15%', containLabel: true },
      xAxis: { type: 'category', data: months }, yAxis: { type: 'value', name: 'Triệu VNĐ' },
      series: [
        { name: 'Tiêu thụ lịch sử', type: 'bar', data: [35, 42, 38, null, null, null], itemStyle: { color: '#3b82f6', borderRadius: [6, 6, 0, 0] } },
        { name: 'Dự báo AI', type: 'bar', data: [null, null, null, 40, 45, 43], itemStyle: { color: '#8b5cf6', borderRadius: [6, 6, 0, 0] } },
        {
          name: 'Tồn kho dự kiến', type: 'line', data: [192, 155, 120, 82, 40, 0], smooth: true, itemStyle: { color: '#ef4444' }, lineStyle: { type: 'dashed' },
          markLine: { data: [{ yAxis: 50, lineStyle: { color: '#ef4444', type: 'dashed' }, label: { formatter: 'Reorder Point' } }] }
        }
      ]
    };
  }
}
