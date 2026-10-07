import { Component } from '@angular/core';
import { ITooltipAngularComp } from 'ag-grid-angular';
import { ITooltipParams } from 'ag-grid-community';


@Component({
  selector: 'custom-tooltip',
  standalone: true,
  imports: [],
  template: `
  @if(data){
   <div class="custom-tooltip">
      <div class="tooltip-header">
        <i class="fa fa-file-text-o"></i>
        {{ header }}
      </div>
      <div class="tooltip-content">
        {{ data }}
      </div>
      <div class="tooltip-footer">
        <div class="tooltip-hint">
          <i class="fa fa-info-circle"></i>
          برای کپی متن، دوبار کلیک کنید
        </div>
      </div>
    </div>
  }
 
  `,
  styles: [`
  .custom-tooltip{
    pointer-events: none; /* مهم: Tooltip نباید hover را از سلول بگیرد */
  }
    .custom-tooltip {
      background: linear-gradient(135deg, #1e3a5f 0%, #0d2137 100%);
      color: #fff;
      padding: 0;
      border-radius: 12px;
      max-width: 450px;
      min-width: 250px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1);
      direction: rtl;
      font-family: 'Sahel', Tahoma, sans-serif;
      font-size: 13px;
      line-height: 1.8;
      animation: tooltipFadeIn 0.25s ease-out;
      overflow: hidden;
    }
    
    .tooltip-header {
      font-weight: bold;
      padding: 12px 16px;
      background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
      color: #fff;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }
    
    .tooltip-header i {
      font-size: 16px;
      opacity: 0.9;
    }
    
    .tooltip-content {
      padding: 16px;
      white-space: pre-wrap;
      word-wrap: break-word;
      max-height: 350px;
      overflow-y: auto;
      background: rgba(255,255,255,0.03);
      color: #e3f2fd;
      font-size: 13px;
      line-height: 2;
    }
    
    .tooltip-content::-webkit-scrollbar {
      width: 6px;
    }
    
    .tooltip-content::-webkit-scrollbar-track {
      background: rgba(255,255,255,0.05);
      border-radius: 3px;
    }
    
    .tooltip-content::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.2);
      border-radius: 3px;
    }
    
    .tooltip-content::-webkit-scrollbar-thumb:hover {
      background: rgba(255,255,255,0.3);
    }
    
    .tooltip-footer {
      padding: 10px 16px;
      background: rgba(0,0,0,0.2);
      border-top: 1px solid rgba(255,255,255,0.1);
    }
    
    .tooltip-hint {
      font-size: 11px;
      color: #90caf9;
      opacity: 0.8;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .tooltip-hint i {
      font-size: 12px;
    }
    
    @keyframes tooltipFadeIn {
      from {
        opacity: 0;
        transform: translateY(-8px) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
  `]
})
export class CustomTooltipComponent implements ITooltipAngularComp {
  public data: string = '';
  public header: string = '';

  agInit(params: ITooltipParams): void {
    this.data = params.value || '';
    this.header = params.colDef?.headerName || 'محتوا';
  }
}
