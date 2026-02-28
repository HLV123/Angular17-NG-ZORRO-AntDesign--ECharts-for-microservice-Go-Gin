import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NgxEchartsModule } from 'ngx-echarts';
import { ApiService } from '../../core/services/api.service';
import { AIModel, Pipeline } from '../../core/models';

@Component({
  selector: 'app-ai-models', standalone: true,
  imports: [CommonModule, NzCardModule, NzTagModule, NzButtonModule, NzTabsModule, NzProgressModule, NzTableModule, NzBadgeModule, NzToolTipModule, NgxEchartsModule],
  template: `
    <div class="fade-in">
      <div class="page-header">
        <div><h1 class="page-title">Quản lý AI/ML Models</h1><p class="page-desc">Model Registry · SageMaker Monitor · Kubeflow Pipelines · SHAP Analysis</p></div>
        <div class="flex gap-3">
          <button nz-button nzType="default"><i class="fa-solid fa-upload mr-2"></i>Deploy Model</button>
          <button nz-button nzType="primary"><i class="fa-solid fa-plus mr-2"></i>Register Model</button>
        </div>
      </div>

      <!-- Stats -->
      <div class="stats-row">
        <div class="stat-card"><div class="stat-num text-green-600">{{countByStatus('active')}}</div><div class="stat-lab">Active Models</div></div>
        <div class="stat-card"><div class="stat-num text-blue-500">{{countByStatus('staging')}}</div><div class="stat-lab">Staging</div></div>
        <div class="stat-card"><div class="stat-num text-purple-600">{{countPipelinesByStatus('running')}}</div><div class="stat-lab">Running Pipelines</div></div>
        <div class="stat-card"><div class="stat-num text-amber-500">{{driftAlerts}}</div><div class="stat-lab">Drift Alerts</div></div>
      </div>

      <nz-tabset nzType="card">
        <!-- Tab 1: Model Registry -->
        <nz-tab nzTitle="Model Registry">
          <div class="model-grid">
            <nz-card *ngFor="let m of models" class="model-card" [class]="'status-' + m.status" (click)="selectModel(m)">
              <div class="m-header"><span class="m-name">{{m.name}}</span><nz-tag [nzColor]="m.status==='active'?'green':m.status==='staging'?'blue':'default'">{{m.status}}</nz-tag></div>
              <div class="m-version mono">{{m.version}} · {{m.framework || 'PyTorch'}}</div>
              <div class="m-type"><nz-tag>{{m.type}}</nz-tag></div>
              <div class="m-metrics">
                <div class="metric"><span class="metric-label">Accuracy</span><span class="metric-val">{{(m.accuracy*100).toFixed(1)}}%</span></div>
                <div class="metric"><span class="metric-label">F1 Score</span><span class="metric-val">{{(m.f1Score*100).toFixed(1)}}%</span></div>
                <div class="metric"><span class="metric-label">Precision</span><span class="metric-val">{{(m.precision*100).toFixed(1)}}%</span></div>
                <div class="metric"><span class="metric-label">Recall</span><span class="metric-val">{{(m.recall*100).toFixed(1)}}%</span></div>
              </div>
              <div class="m-drift" *ngIf="m.driftScore">
                <span class="text-xs text-gray-500">Data Drift (PSI)</span>
                <nz-progress [nzPercent]="m.driftScore!*100/0.3" nzSize="small" [nzStrokeColor]="m.driftScore!>0.2?'#ef4444':m.driftScore!>0.1?'#f59e0b':'#10b981'" [nzFormat]="driftFmt(m.driftScore!)"></nz-progress>
              </div>
              <div class="m-footer"><span class="text-xs text-gray-400">Dataset: {{m.datasetSize | number}} rows</span><span class="text-xs text-gray-400">Trained: {{m.trainedOn}}</span></div>
            </nz-card>
          </div>
        </nz-tab>

        <!-- Tab 2: Performance Monitor -->
        <nz-tab nzTitle="Performance Monitor">
          <div class="grid-2">
            <nz-card nzTitle="Accuracy Over Time" style="border-radius:16px !important;">
              <div echarts [options]="accChartOpts" style="height:280px;"></div>
            </nz-card>
            <nz-card nzTitle="Data Drift Monitor (PSI)" style="border-radius:16px !important;">
              <div echarts [options]="driftChartOpts" style="height:280px;"></div>
            </nz-card>
          </div>
          <div class="grid-2 mt-5">
            <nz-card nzTitle="Confusion Matrix – Health Score Model" style="border-radius:16px !important;">
              <div echarts [options]="confusionOpts" style="height:380px;"></div>
            </nz-card>
            <nz-card nzTitle="SHAP Feature Importance – RUL Model" style="border-radius:16px !important;">
              <div echarts [options]="shapOpts" style="height:380px;"></div>
            </nz-card>
          </div>
        </nz-tab>

        <!-- Tab 3: A/B Testing -->
        <nz-tab nzTitle="A/B Testing">
          <nz-card nzTitle="Active A/B Tests" style="border-radius:16px !important;">
            <div *ngFor="let test of abTests" class="ab-test-card">
              <div class="ab-header">
                <div><span class="ab-name">{{test.name}}</span><nz-tag [nzColor]="test.status==='running'?'blue':'green'">{{test.status}}</nz-tag></div>
                <span class="text-xs text-gray-500">{{test.startDate}} → {{test.endDate}}</span>
              </div>
              <div class="ab-compare">
                <div class="ab-variant" *ngFor="let v of test.variants" [class.ab-winner]="v.isWinner">
                  <div class="av-header"><span class="av-name">{{v.name}}</span><nz-tag *ngIf="v.isWinner" nzColor="green" style="font-size:10px;">Winner</nz-tag></div>
                  <div class="av-metrics">
                    <div class="av-metric"><span class="av-label">Accuracy</span><span class="av-val">{{v.accuracy}}%</span></div>
                    <div class="av-metric"><span class="av-label">Latency</span><span class="av-val">{{v.latency}}ms</span></div>
                    <div class="av-metric"><span class="av-label">F1</span><span class="av-val">{{v.f1}}%</span></div>
                    <div class="av-metric"><span class="av-label">P-value</span><span class="av-val" [class.text-green-600]="v.pValue < 0.05">{{v.pValue}}</span></div>
                  </div>
                  <nz-progress [nzPercent]="v.traffic" nzSize="small" [nzStrokeColor]="v.isWinner?'#10b981':'#3b82f6'" [nzFormat]="trafficFmt(v.traffic)"></nz-progress>
                </div>
              </div>
              <div class="ab-actions">
                <button nz-button nzSize="small" nzType="primary" *ngIf="test.status==='running'">Promote Winner</button>
                <button nz-button nzSize="small" *ngIf="test.status==='running'">Stop Test</button>
              </div>
            </div>
          </nz-card>
        </nz-tab>

        <!-- Tab 4: Pipelines -->
        <nz-tab nzTitle="Pipelines">
          <nz-card style="border-radius:16px !important;">
            <nz-table #plTbl [nzData]="pipelines" nzSize="middle">
              <thead><tr><th>Pipeline</th><th>Type</th><th>Status</th><th>Progress</th><th>Triggered By</th><th>Started</th><th>Duration</th><th>Actions</th></tr></thead>
              <tbody><tr *ngFor="let p of plTbl.data">
                <td class="font-medium">{{p.name}}</td>
                <td><nz-tag>{{p.type}}</nz-tag></td>
                <td><nz-tag [nzColor]="p.status==='completed'?'green':p.status==='running'?'blue':p.status==='failed'?'red':'default'">{{p.status}}</nz-tag></td>
                <td><nz-progress [nzPercent]="p.progress" nzSize="small" style="width:100px;" [nzStrokeColor]="p.status==='running'?'#3b82f6':'#10b981'"></nz-progress></td>
                <td>{{p.triggeredBy}}</td>
                <td class="text-xs">{{p.startedAt | date:'dd/MM HH:mm'}}</td>
                <td class="text-xs mono">{{p.completedAt ? getDuration(p.startedAt, p.completedAt) : 'Running...'}}</td>
                <td>
                  <button nz-button nzSize="small" *ngIf="p.status==='running'" nzDanger>Cancel</button>
                  <button nz-button nzSize="small" *ngIf="p.status==='completed'||p.status==='failed'">Rerun</button>
                </td>
              </tr></tbody>
            </nz-table>
          </nz-card>
        </nz-tab>
      </nz-tabset>
    </div>
  `,
  styles: [`
    .page-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:12px}.page-title{font-size:24px;font-weight:700}.page-desc{font-size:13px;color:#64748b}.mono{font-family:'JetBrains Mono',monospace}.font-medium{font-weight:500}.flex{display:flex}.gap-3{gap:12px}.mr-2{margin-right:8px}.mt-5{margin-top:20px}
    .stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
    .stat-card{background:white;border-radius:12px;padding:16px 20px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.06)}.stat-num{font-size:28px;font-weight:700}.stat-lab{font-size:12px;color:#64748b}
    .model-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
    .model-card{border-radius:16px !important;transition:transform 0.2s;cursor:pointer}.model-card:hover{transform:translateY(-3px)}
    .model-card.status-active{border-left:3px solid #10b981 !important}.model-card.status-staging{border-left:3px solid #3b82f6 !important}.model-card.status-deprecated{border-left:3px solid #94a3b8 !important}
    .m-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}.m-name{font-size:15px;font-weight:600}.m-version{font-size:13px;color:#64748b;margin-bottom:8px}.m-type{margin-bottom:12px}
    .m-metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
    .metric{padding:8px;background:#f8fafc;border-radius:8px}.metric-label{font-size:11px;color:#64748b;display:block}.metric-val{font-size:16px;font-weight:700;font-family:'JetBrains Mono',monospace}
    .m-drift{margin-bottom:12px}.m-footer{display:flex;justify-content:space-between}
    .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:20px}
    .ab-test-card{padding:20px;border-radius:16px;border:1px solid #e2e8f0;background:#f8fafc;margin-bottom:16px}
    .ab-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
    .ab-name{font-size:16px;font-weight:600;margin-right:8px}
    .ab-compare{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
    .ab-variant{padding:16px;border-radius:12px;border:1px solid #e2e8f0;background:white}
    .ab-variant.ab-winner{border-color:#10b981;background:#ecfdf5}
    .av-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
    .av-name{font-weight:600;font-size:14px}
    .av-metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
    .av-metric{}.av-label{font-size:11px;color:#64748b;display:block}.av-val{font-size:15px;font-weight:700;font-family:'JetBrains Mono',monospace}
    .ab-actions{display:flex;gap:8px}
    .text-xs{font-size:12px}
  `]
})
export class AIModelsComponent implements OnInit {
  private api = inject(ApiService);
  models: AIModel[] = []; pipelines: Pipeline[] = [];
  accChartOpts: any = {}; driftChartOpts: any = {}; confusionOpts: any = {}; shapOpts: any = {};
  selectedModel: AIModel | null = null;
  driftAlerts = 1;

  abTests = [
    {
      name: 'Health Score v3.2 vs v3.1',
      status: 'running',
      startDate: '15/02/2026', endDate: '15/03/2026',
      variants: [
        { name: 'Control (v3.1)', accuracy: 93.8, latency: 45, f1: 92.1, pValue: 0.12, traffic: 50, isWinner: false },
        { name: 'Treatment (v3.2)', accuracy: 94.5, latency: 38, f1: 93.4, pValue: 0.03, traffic: 50, isWinner: true },
      ]
    },
    {
      name: 'Failure Predictor: LSTM vs Transformer',
      status: 'completed',
      startDate: '01/01/2026', endDate: '01/02/2026',
      variants: [
        { name: 'LSTM (Current)', accuracy: 91.8, latency: 120, f1: 90.5, pValue: 0.08, traffic: 40, isWinner: false },
        { name: 'Transformer (New)', accuracy: 93.2, latency: 85, f1: 92.8, pValue: 0.01, traffic: 60, isWinner: true },
      ]
    }
  ];

  ngOnInit() {
    this.api.getAIModels().subscribe(d => { this.models = d; this.driftAlerts = d.filter(m => m.driftScore && m.driftScore > 0.15).length; });
    this.api.getPipelines().subscribe(d => this.pipelines = d);
    this.initCharts();
  }

  selectModel(m: AIModel) { this.selectedModel = m; }
  countByStatus(status: string): number { return this.models.filter(m => m.status === status).length; }
  countPipelinesByStatus(status: string): number { return this.pipelines.filter(p => p.status === status).length; }
  driftFmt(drift: number): (v: number) => string { return () => drift != null ? drift.toFixed(2) : '0'; }
  trafficFmt(traffic: number): (v: number) => string { return () => traffic + '% traffic'; }
  getDuration(start: string, end: string) {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const min = Math.floor(ms / 60000);
    return min > 60 ? Math.floor(min / 60) + 'h ' + (min % 60) + 'm' : min + 'm';
  }

  initCharts() {
    const months = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'];
    this.accChartOpts = {
      tooltip: { trigger: 'axis' }, legend: { data: ['Health Score', 'RUL', 'Failure'], bottom: 0 },
      grid: { left: '5%', right: '3%', top: '5%', bottom: '15%', containLabel: true },
      xAxis: { type: 'category', data: months }, yAxis: { type: 'value', min: 80, max: 100, name: '%' },
      series: [
        { name: 'Health Score', type: 'line', data: [92.1, 93.0, 93.5, 93.8, 94.0, 94.2], smooth: true, itemStyle: { color: '#3b82f6' } },
        { name: 'RUL', type: 'line', data: [86.5, 87.2, 88.0, 88.5, 89.0, 89.1], smooth: true, itemStyle: { color: '#10b981' } },
        { name: 'Failure', type: 'line', data: [89.8, 90.2, 91.0, 91.5, 91.8, 91.8], smooth: true, itemStyle: { color: '#f59e0b' } }
      ]
    };
    this.driftChartOpts = {
      tooltip: { trigger: 'axis' }, grid: { left: '5%', right: '3%', top: '10%', bottom: '10%', containLabel: true },
      xAxis: { type: 'category', data: months }, yAxis: { type: 'value', name: 'PSI', max: 0.3 },
      series: [{
        type: 'line', data: [0.05, 0.07, 0.08, 0.1, 0.12, 0.15], smooth: true, itemStyle: { color: '#ef4444' },
        areaStyle: { color: 'rgba(239,68,68,0.08)' },
        markLine: { data: [{ yAxis: 0.2, lineStyle: { color: '#ef4444', type: 'dashed' }, label: { formatter: 'Threshold' } }] }
      }]
    };

    // Confusion Matrix
    const labels = ['Healthy', 'Warning', 'Critical'];
    const confData: any[] = [];
    const matrix = [[850, 25, 5], [20, 180, 15], [3, 8, 95]];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) confData.push([j, i, matrix[i][j]]);
    this.confusionOpts = {
      tooltip: { formatter: (p: any) => `Actual: ${labels[p.data[1]]}<br>Predicted: ${labels[p.data[0]]}<br>Count: ${p.data[2]}` },
      grid: { left: '15%', right: '15%', top: '5%', bottom: '15%' },
      xAxis: { type: 'category', data: labels, name: 'Predicted', splitArea: { show: true } },
      yAxis: { type: 'category', data: labels, name: 'Actual', splitArea: { show: true } },
      visualMap: { min: 0, max: 850, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#eff6ff', '#3b82f6', '#1e3a8a'] } },
      series: [{ type: 'heatmap', data: confData, label: { show: true, fontSize: 14, fontWeight: 700 } }]
    };

    // SHAP Waterfall
    const features = ['Vibration RMS', 'Temperature', 'Operating Hours', 'Current', 'Pressure', 'Humidity', 'Ambient Temp'];
    const shapValues = [0.35, 0.28, 0.15, 0.12, 0.05, 0.03, 0.02];
    this.shapOpts = {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '30%', right: '8%', top: '5%', bottom: '5%' },
      xAxis: { type: 'value', name: 'SHAP Value' },
      yAxis: { type: 'category', data: features.reverse() },
      series: [{
        type: 'bar', data: shapValues.reverse(),
        itemStyle: { color: (p: any) => p.dataIndex < 3 ? '#ef4444' : p.dataIndex < 5 ? '#f59e0b' : '#10b981', borderRadius: [0, 6, 6, 0] },
        barWidth: 20
      }]
    };
  }
}
