import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NgxEchartsModule } from 'ngx-echarts';
import { ApiService } from '../../core/services/api.service';
import { Sensor } from '../../core/models';

@Component({
  selector: 'app-sensors',
  standalone: true,
  imports: [CommonModule, FormsModule, NzCardModule, NzTagModule, NzSelectModule, NzGridModule, NzBadgeModule, NgxEchartsModule],
  template: `
    <div class="fade-in">
      <div class="page-header"><div><h1 class="page-title">Giám sát Sensor Thời gian thực</h1><p class="page-desc">Real-time Sensor Monitoring · gRPC-Web Stream · {{sensors.length}} sensors</p></div>
        <div class="flex gap-3">
          <nz-select [(ngModel)]="gridCols" style="width:100px;"><nz-option [nzValue]="2" nzLabel="2 cột"></nz-option><nz-option [nzValue]="3" nzLabel="3 cột"></nz-option><nz-option [nzValue]="4" nzLabel="4 cột"></nz-option></nz-select>
          <nz-select [(ngModel)]="filterType" nzPlaceHolder="Loại sensor" nzAllowClear (ngModelChange)="applyFilter()" style="width:160px;">
            <nz-option nzValue="temperature" nzLabel="Nhiệt độ"></nz-option><nz-option nzValue="vibration" nzLabel="Rung động"></nz-option>
            <nz-option nzValue="pressure" nzLabel="Áp suất"></nz-option><nz-option nzValue="current" nzLabel="Dòng điện"></nz-option>
          </nz-select>
        </div>
      </div>
      <div class="sensor-grid" [style.grid-template-columns]="'repeat(' + gridCols + ', 1fr)'">
        <nz-card *ngFor="let s of filtered" class="sensor-card" [class]="'border-' + s.status">
          <div class="sensor-header"><span class="sensor-equip">{{getEquipName(s.equipmentId)}}</span><nz-tag [nzColor]="s.status === 'normal' ? 'green' : s.status === 'warning' ? 'gold' : 'red'" class="status-tag">{{s.status}}</nz-tag></div>
          <div class="sensor-name">{{s.name}}</div>
          <div class="sensor-val"><span class="big-val">{{s.currentValue}}</span><span class="unit">{{s.unit}}</span></div>
          <div echarts [options]="getSparkOpts(s)" style="height:60px;width:100%;"></div>
          <div class="thresholds"><span>⚠ {{s.warningHigh || s.maxThreshold}} {{s.unit}}</span><span>🔴 {{s.criticalHigh || s.maxThreshold}} {{s.unit}}</span></div>
        </nz-card>
      </div>
      <nz-card nzTitle="Multi-Sensor Comparison" class="mt-6" style="border-radius:16px !important;">
        <div echarts [options]="multiChartOpts" style="height:350px;"></div>
      </nz-card>
      <nz-card nzTitle="Anomaly Heatmap (D3.js simulation)" class="mt-6" style="border-radius:16px !important;">
        <div echarts [options]="heatmapOpts" style="height:300px;"></div>
      </nz-card>
    </div>
  `,
  styles: [`
    .page-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:12px}.page-title{font-size:24px;font-weight:700;color:#0f172a}.page-desc{font-size:13px;color:#64748b}
    .flex{display:flex}.gap-3{gap:12px}.mt-6{margin-top:24px}
    .sensor-grid{display:grid;gap:16px}
    .sensor-card{border-radius:12px !important;transition:transform 0.2s}.sensor-card:hover{transform:translateY(-2px)}
    .border-warning{border-left:3px solid #f59e0b !important}.border-critical{border-left:3px solid #ef4444 !important}.border-normal{border-left:3px solid #10b981 !important}
    .sensor-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}.sensor-equip{font-size:11px;color:#64748b}
    .sensor-name{font-size:14px;font-weight:600;color:#1e293b;margin-bottom:8px}
    .sensor-val{margin-bottom:8px}.big-val{font-size:28px;font-weight:800;font-family:'JetBrains Mono',monospace;color:#0f172a}.unit{font-size:13px;color:#64748b;margin-left:4px}
    .thresholds{display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;margin-top:8px}
  `]
})
export class SensorsComponent implements OnInit {
  private api = inject(ApiService);
  sensors: Sensor[] = []; filtered: Sensor[] = [];
  gridCols = 3; filterType: string | null = null;
  multiChartOpts: any = {}; heatmapOpts: any = {};
  eqNames: Record<string,string> = { EQ001:'Máy CNC #01', EQ002:'Máy ép M09', EQ003:'Băng tải A3', EQ004:'Robot hàn #12', EQ005:'Máy nén khí', EQ006:'Robot lắp ráp', EQ007:'Bơm VP-3' };

  ngOnInit() {
    this.api.getSensors().subscribe(d => { this.sensors = d; this.filtered = d; this.initCharts(); });
  }
  applyFilter() { this.filtered = this.filterType ? this.sensors.filter(s => s.type === this.filterType) : this.sensors; }
  getEquipName(id: string) { return this.eqNames[id] || id; }
  getSparkOpts(s: Sensor): any {
    return { grid:{left:0,right:0,top:0,bottom:0}, xAxis:{show:false,data:s.sparklineData?.map((_:any,i:number)=>i)||[]}, yAxis:{show:false}, series:[{type:'line',data:s.sparklineData||[],smooth:true,symbol:'none',lineStyle:{width:2,color:s.status==='critical'?'#ef4444':s.status==='warning'?'#f59e0b':'#10b981'},areaStyle:{color:s.status==='critical'?'rgba(239,68,68,0.1)':s.status==='warning'?'rgba(245,158,11,0.1)':'rgba(16,185,129,0.1)'}}] };
  }
  initCharts() {
    const hrs = Array.from({length:13},(_,i)=>`${String(8+i).padStart(2,'0')}:00`);
    this.multiChartOpts = {
      tooltip:{trigger:'axis'}, legend:{data:['Rung (mm/s)','Nhiệt (°C)','Dòng (A)'],bottom:0},
      grid:{left:'5%',right:'5%',top:'8%',bottom:'15%',containLabel:true},
      xAxis:{type:'category',data:hrs}, yAxis:[{type:'value',name:'mm/s & A'},{type:'value',name:'°C'}],
      series:[
        {name:'Rung (mm/s)',type:'line',data:hrs.map(()=>+(1.2+Math.random()*2).toFixed(1)),smooth:true,itemStyle:{color:'#f97316'}},
        {name:'Nhiệt (°C)',type:'line',yAxisIndex:1,data:hrs.map(()=>+(75+Math.random()*15).toFixed(1)),smooth:true,itemStyle:{color:'#ef4444'}},
        {name:'Dòng (A)',type:'line',data:hrs.map(()=>+(14+Math.random()*4).toFixed(1)),smooth:true,itemStyle:{color:'#3b82f6'}}
      ]
    };
    const eqList = ['CNC #01','Máy ép M09','Băng tải A3','Robot hàn','Máy nén','Robot LR','Bơm VP-3'];
    const hData: any[] = [];
    for(let y=0;y<eqList.length;y++) for(let x=0;x<24;x++) hData.push([x,y,+(Math.random()*100).toFixed(0)]);
    this.heatmapOpts = {
      tooltip:{position:'top'}, grid:{left:'12%',right:'3%',top:'3%',bottom:'12%'},
      xAxis:{type:'category',data:Array.from({length:24},(_,i)=>`${i}h`),splitArea:{show:true}},
      yAxis:{type:'category',data:eqList,splitArea:{show:true}},
      visualMap:{min:0,max:100,calculable:true,orient:'horizontal',left:'center',bottom:0,inRange:{color:['#10b981','#f59e0b','#ef4444']}},
      series:[{type:'heatmap',data:hData,label:{show:false},emphasis:{itemStyle:{shadowBlur:10,shadowColor:'rgba(0,0,0,0.5)'}}}]
    };
  }
}
