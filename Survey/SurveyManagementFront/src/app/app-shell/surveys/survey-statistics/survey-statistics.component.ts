import {
  Component, OnInit, OnDestroy, inject, signal, computed,
  viewChild, viewChildren, ElementRef, DestroyRef
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { catchError, forkJoin, of } from 'rxjs';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

import {
  SurveyService,
  SurveyStatisticsDto,
  SurveyChangeLogDto
} from '../../../services/survey.service';

import { AppSharedDataComponent } from '../../../shared/app-shared-data/app-shared-data';
import { DemographicBucketDto } from '../../../core/models/survey-analytics.model';

Chart.register(...registerables);

type DemographicKey =
  'responsesByAge' | 'responsesByGender' | 'responsesByOffice' |
  'responsesByEmploymentType' | 'responsesByEducation' | 'responsesByShiftWorker' |
  'responsesByExperienceYears' | 'responsesByOrganizationalGrade' | 'responsesByOrganizationalGroup';

interface DemographicChartDef {
  key: DemographicKey;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-survey-statistics',
  templateUrl: './survey-statistics.component.html',
  styleUrls: ['./survey-statistics.component.css'],
  standalone: true,
  imports: [CommonModule]
})
export class SurveyStatisticsComponent extends AppSharedDataComponent implements OnInit, OnDestroy {
  private readonly surveyService = inject(SurveyService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly trendChartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('trendChart');
  // ✅ چون نمودارهای دموگرافیک در یک @for رندر می‌شن، از viewChildren استفاده می‌کنیم
  readonly demographicCanvases = viewChildren<ElementRef<HTMLCanvasElement>>('demoChart');

  private readonly _isLoading = signal<boolean>(false);
  public readonly statistics = signal<SurveyStatisticsDto | null>(null);
  public readonly changeLogs = signal<SurveyChangeLogDto[]>([]);

  readonly isLoading = this._isLoading.asReadonly();
  readonly hasStats = computed(() => !!this.statistics());
  readonly hasResponses = computed(() => (this.statistics()?.totalResponses ?? 0) > 0);

  readonly demographicDefs: DemographicChartDef[] = [
    { key: 'responsesByAge', label: 'سن', icon: 'fa-birthday-cake' },
    { key: 'responsesByGender', label: 'جنسیت', icon: 'fa-venus-mars' },
    { key: 'responsesByOffice', label: 'امور', icon: 'fa-building' },
    { key: 'responsesByEmploymentType', label: 'نوع استخدام', icon: 'fa-id-badge' },
    { key: 'responsesByEducation', label: 'مدرک تحصیلی', icon: 'fa-graduation-cap' },
    { key: 'responsesByShiftWorker', label: 'نوبت‌کاری', icon: 'fa-business-time' },
    { key: 'responsesByExperienceYears', label: 'سابقه (سال)', icon: 'fa-hourglass-half' },
    { key: 'responsesByOrganizationalGrade', label: 'گرید سازمانی', icon: 'fa-layer-group' },
    { key: 'responsesByOrganizationalGroup', label: 'گروه سازمانی', icon: 'fa-sitemap' },
  ];

  readonly hasAnyDemographicData = computed(() => {
    const s = this.statistics();
    if (!s) return false;
    return this.demographicDefs.some(d => (s[d.key]?.length ?? 0) > 0);
  });

  private demographicCharts: Chart[] = [];
  private trendChart: Chart | null = null;

  private readonly palette = [
    '#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444',
    '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#64748B'
  ];

  override ngOnInit(): void {
    super.ngOnInit();
    this.loadStatistics();
  }

  private loadStatistics(): void {
    const surveyGuid = this.route.snapshot.paramMap.get('guid') || '';
    if (!surveyGuid) {
      this.toastService.error('شناسه نظرسنجی یافت نشد');
      this.router.navigate(['/surveys/list']);
      return;
    }

    this._isLoading.set(true);

    forkJoin({
      statistics: this.surveyService.getStatistics(surveyGuid).pipe(
        catchError(err => { console.error('getStatistics error:', err); return of(null); })
      ),
      changeLogs: this.surveyService.getChangeLogs(surveyGuid).pipe(
        catchError(err => { console.error('getChangeLogs error:', err); return of([] as SurveyChangeLogDto[]); })
      )
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ statistics, changeLogs }) => {
          this.statistics.set(statistics);
          this.changeLogs.set(changeLogs ?? []);
          this._isLoading.set(false);
          setTimeout(() => this.renderCharts(), 0);
        },
        error: (error) => {
          console.error('Error loading survey statistics:', error);
          this.toastService.error('خطا در بارگذاری آمار');
          this._isLoading.set(false);
        }
      });
  }

  private cssVar(name: string, fallback: string): string {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name)?.trim();
    return v || fallback;
  }

  private renderCharts(): void {
    this.renderTrendChart();
    this.renderDemographicCharts();
  }

  private renderTrendChart(): void {
    const canvasRef = this.trendChartCanvas();
    const s = this.statistics();
    if (!canvasRef || !s) return;

    const ctx = canvasRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.trendChart?.destroy();

    const mapObj = s.responsesByDate || {};
    const labels = Object.keys(mapObj).sort();
    const data = labels.map(k => Number(mapObj[k] ?? 0));
    const lineColor = this.cssVar('--primary', '#4F46E5');

    this.trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{ label: 'تعداد پاسخ', data, borderColor: lineColor, backgroundColor: lineColor, tension: 0.25, fill: false }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, title: { display: true, text: 'روند پاسخ‌ها بر اساس تاریخ تکمیل' } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  }

  private renderDemographicCharts(): void {
    this.demographicCharts.forEach(c => c.destroy());
    this.demographicCharts = [];

    const s = this.statistics();
    if (!s) return;

    // ⚠️ فقط دفهایی که داده دارن در تمپلیت کانواس می‌سازن؛ پس باید فقط همون‌ها رو zip کنیم
    const defsWithData = this.demographicDefs.filter(d => (s[d.key]?.length ?? 0) > 0);
    const canvases = this.demographicCanvases();

    defsWithData.forEach((def, index) => {
      const canvasRef = canvases[index];
      if (!canvasRef) return;

      const buckets: DemographicBucketDto[] = s[def.key] ?? [];
      const ctx = canvasRef.nativeElement.getContext('2d');
      if (!ctx) return;

      this.demographicCharts.push(new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: buckets.map(b => b.label),
          datasets: [{
            data: buckets.map(b => b.count),
            backgroundColor: buckets.map((_, i) => this.palette[i % this.palette.length]),
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
            tooltip: {
              callbacks: {
                label: (item) => {
                  const b = buckets[item.dataIndex];
                  return `${b.label}: ${b.count} نفر (${b.percentage}%)`;
                }
              }
            }
          }
        }
      }));
    });
  }

  bucketsFor(def: DemographicChartDef): DemographicBucketDto[] {
    return this.statistics()?.[def.key] ?? [];
  }

  hasData(def: DemographicChartDef): boolean {
    return this.bucketsFor(def).length > 0;
  }

  backToList(): void {
    this.router.navigate(['/surveys/list']);
  }

  ngOnDestroy(): void {
    this.trendChart?.destroy();
    this.trendChart = null;
    this.demographicCharts.forEach(c => c.destroy());
    this.demographicCharts = [];
  }
}