// shared/chart-canvas/chart-canvas.component.ts

import {
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  AfterViewInit,
  ChangeDetectionStrategy
} from '@angular/core';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-chart-canvas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chartCanvasWrap" [style.height.px]="height">
      <canvas #canvasRef></canvas>
    </div>
  `,
  styles: [`
    .chartCanvasWrap {
      position: relative;
      width: 100%;
    }
  `]
})
export class ChartCanvasComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvasRef', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() type: ChartType = 'bar';
  @Input() data!: ChartConfiguration['data'];
  @Input() options?: ChartConfiguration['options'];
  @Input() height = 260;

  private chart?: Chart;
  private viewReady = false;

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.viewReady) return;
    if (changes['data'] || changes['type'] || changes['options']) {
      this.render();
    }
  }

  private render(): void {
    if (!this.data) return;

    this.chart?.destroy();

    this.chart = new Chart(this.canvasRef.nativeElement, {
      type: this.type,
      data: this.data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { font: { family: 'Sahel, Vazir, sans-serif' } } }
        },
        ...this.options,
      }
    });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }
}