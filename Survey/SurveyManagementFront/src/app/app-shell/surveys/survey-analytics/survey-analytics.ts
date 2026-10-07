import {
  Component, OnInit, inject, input, signal, computed, effect, DestroyRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { ChartConfiguration } from 'chart.js';

import { ToastService } from '../../../services/framework-services/toast.service';
import { ResponseService } from '../../../services/response.service';
import {
  SurveyAnalyticsDto,
  QuestionAnalyticsDto,
  TrendPointDto,
  DemographicBucketDto
} from '../../../core/models/survey-analytics.model';
import { ChartCanvasComponent } from '../../../shared/chart-canvas/chart-canvas';
import { downloadAnalyticsExcel } from '../../../core/models/analytics-excel-export.util';
import { downloadAnalyticsHtml } from '../../../core/models/analytics-html-export.util';

const CHART_PALETTE = [
  '#1d4ed8', '#3b82f6', '#f59e0b', '#22c55e', '#ff4d6d',
  '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#ec4899'
];

const SENTIMENT_COLORS = {
  positive: '#22c55e',
  negative: '#ff4d6d',
  neutral: '#94a3b8'
};

@Component({
  selector: 'app-survey-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, ChartCanvasComponent],
  templateUrl: './survey-analytics.html',
  styleUrls: ['./survey-analytics.css']
})
export class SurveyAnalyticsComponent implements OnInit {
  readonly surveyGuid = input.required<string>();

  private readonly responseService = inject(ResponseService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(false);
  readonly analytics = signal<SurveyAnalyticsDto | null>(null);
  readonly questionSearchTerm = signal('');
  readonly expandedQuestionGuid = signal<string | null>(null);

  readonly hasData = computed(() => (this.analytics()?.overview.totalResponses ?? 0) > 0);

  readonly exportingExcel = signal(false);
  readonly exportingHtml = signal(false);
  readonly activeTab = signal<'overview' | 'questions' | 'dashboard'>('overview');
  readonly dashboardDensity = signal<'compact' | 'comfortable'>('compact');

  readonly averageAnswerRate = computed(() => {
    const questions = this.analytics()?.questions ?? [];
    if (questions.length === 0) return 0;
    const sum = questions.reduce((acc, q) => acc + q.answerRate, 0);
    return Math.round((sum / questions.length) * 10) / 10;
  });

  readonly requiredQuestionsCount = computed(() =>
    (this.analytics()?.questions ?? []).filter(q => q.isRequired).length
  );

  readonly lowestAnswerRateQuestion = computed(() => {
    const questions = this.analytics()?.questions ?? [];
    if (questions.length === 0) return null;
    return [...questions].sort((a, b) => a.answerRate - b.answerRate)[0];
  });

  readonly highestAnswerRateQuestion = computed(() => {
    const questions = this.analytics()?.questions ?? [];
    if (questions.length === 0) return null;
    return [...questions].sort((a, b) => b.answerRate - a.answerRate)[0];
  });

  readonly miniDoughnutOptions: ChartConfiguration['options'] = {
    plugins: { legend: { display: false } }
  };

  readonly miniBarOptions: ChartConfiguration['options'] = {
    scales: {
      y: { beginAtZero: true, ticks: { precision: 0, font: { size: 9 } } },
      x: { ticks: { font: { size: 9 } } }
    },
    plugins: { legend: { display: false } }
  };

  typeColorClass(q: QuestionAnalyticsDto): string {
    if (this.isChoiceQuestion(q)) return 'choice';
    if (this.isNumericQuestion(q)) return 'numeric';
    if (this.isTextQuestion(q)) return 'text';
    if (this.isDateQuestion(q)) return 'date';
    if (this.isRankingQuestion(q)) return 'ranking';
    if (this.isFileQuestion(q)) return 'file';
    return 'default';
  }

  typeIcon(q: QuestionAnalyticsDto): string {
    if (this.isChoiceQuestion(q)) return 'fa-chart-pie';
    if (this.isNumericQuestion(q)) return 'fa-hashtag';
    if (this.isTextQuestion(q)) return 'fa-align-right';
    if (this.isDateQuestion(q)) return 'fa-calendar-days';
    if (this.isRankingQuestion(q)) return 'fa-ranking-star';
    if (this.isFileQuestion(q)) return 'fa-file-arrow-up';
    return 'fa-circle-question';
  }

  setDensity(density: 'compact' | 'comfortable'): void {
    this.dashboardDensity.set(density);
  }

  exportToHtml(): void {
    const data = this.analytics();
    if (!data) return;
    this.exportingHtml.set(true);
    try {
      downloadAnalyticsHtml(data);
      this.toastService.success('فایل داشبورد HTML با موفقیت دانلود شد');
    } catch (err) {
      console.error('HTML export error:', err);
      this.toastService.error('خطا در تولید فایل HTML');
    } finally {
      this.exportingHtml.set(false);
    }
  }

  exportToExcel(): void {
    const data = this.analytics();
    if (!data) return;
    this.exportingExcel.set(true);
    try {
      downloadAnalyticsExcel(data);
      this.toastService.success('فایل Excel با موفقیت دانلود شد');
    } catch (err) {
      console.error('Analytics export error:', err);
      this.toastService.error('خطا در تولید فایل Excel');
    } finally {
      this.exportingExcel.set(false);
    }
  }

  readonly filteredQuestions = computed(() => {
    const data = this.analytics();
    if (!data) return [];
    const term = this.questionSearchTerm().trim().toLowerCase();
    if (term.length < 2) return data.questions;
    return data.questions.filter(q => q.questionText.toLowerCase().includes(term));
  });

  // ==================== نمودارهای نمای کلی (بازنویسی‌شده) ====================

  readonly ageChartData = computed(() => this.buildDemographicChartData(this.analytics()?.overview.responsesByAge));
  readonly genderChartData = computed(() => this.buildDemographicChartData(this.analytics()?.overview.responsesByGender));
  readonly officeChartData = computed(() => this.buildDemographicChartData(this.analytics()?.overview.responsesByOffice));
  readonly employmentTypeChartData = computed(() => this.buildDemographicChartData(this.analytics()?.overview.responsesByEmploymentType));
  readonly educationChartData = computed(() => this.buildDemographicChartData(this.analytics()?.overview.responsesByEducation));
  readonly shiftWorkerChartData = computed(() => this.buildDemographicChartData(this.analytics()?.overview.responsesByShiftWorker));
  readonly experienceChartData = computed(() => this.buildDemographicChartData(this.analytics()?.overview.responsesByExperienceYears));
  readonly gradeChartData = computed(() => this.buildDemographicChartData(this.analytics()?.overview.responsesByOrganizationalGrade));
  readonly groupChartData = computed(() => this.buildDemographicChartData(this.analytics()?.overview.responsesByOrganizationalGroup));

  private buildDemographicChartData(buckets?: DemographicBucketDto[]): ChartConfiguration['data'] | null {
    if (!buckets || buckets.length === 0) return null;
    return {
      labels: buckets.map(b => b.label),
      datasets: [{
        data: buckets.map(b => b.count),
        backgroundColor: CHART_PALETTE,
        borderWidth: 0
      }]
    };
  }

  readonly trendChartData = computed<ChartConfiguration['data'] | null>(() => {
    const trend = this.analytics()?.overview.responsesTrend;
    if (!trend || trend.length === 0) return null;
    return this.buildTrendLineData(trend, 'تعداد پاسخ‌ها');
  });

  readonly dayOfWeekChartData = computed<ChartConfiguration['data'] | null>(() => {
    const points = this.analytics()?.overview.responsesByDayOfWeek;
    if (!points || points.length === 0) return null;
    return {
      labels: points.map(p => p.label),
      datasets: [{
        label: 'تعداد پاسخ',
        data: points.map(p => p.count),
        backgroundColor: '#1d4ed8',
        borderRadius: 6
      }]
    };
  });

  readonly hourOfDayChartData = computed<ChartConfiguration['data'] | null>(() => {
    const points = this.analytics()?.overview.responsesByHourOfDay;
    if (!points || points.length === 0) return null;
    return {
      labels: points.map(p => p.label),
      datasets: [{
        label: 'تعداد پاسخ',
        data: points.map(p => p.count),
        backgroundColor: '#f59e0b',
        borderRadius: 6
      }]
    };
  });

  readonly barOptions: ChartConfiguration['options'] = {
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    plugins: { legend: { display: false } }
  };

  readonly doughnutOptions: ChartConfiguration['options'] = {
    plugins: { legend: { position: 'bottom' } }
  };

  constructor() {
    effect(() => {
      const guid = this.surveyGuid();
      if (guid) this.load();
    });
  }

  ngOnInit(): void { }

  private load(): void {
    this.loading.set(true);
    this.responseService.getAnalytics(this.surveyGuid())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => {
          this.toastService.error('خطا در بارگذاری تحلیل نظرسنجی');
          this.loading.set(false);
          return of(null);
        })
      )
      .subscribe(data => {
        this.analytics.set(data);
        this.loading.set(false);
      });
  }

  refresh(): void {
    this.load();
  }

  setTab(tab: 'overview' | 'questions' | 'dashboard'): void {
    this.activeTab.set(tab);
  }

  toggleQuestion(guid: string): void {
    this.expandedQuestionGuid.set(this.expandedQuestionGuid() === guid ? null : guid);
  }

  isExpanded(guid: string): boolean {
    return this.expandedQuestionGuid() === guid;
  }

  isChoiceQuestion(q: QuestionAnalyticsDto): boolean {
    return !!q.optionStats && q.optionStats.length > 0;
  }
  isNumericQuestion(q: QuestionAnalyticsDto): boolean {
    return !!q.numericStats;
  }
  isTextQuestion(q: QuestionAnalyticsDto): boolean {
    return !!q.textAnalytics;
  }
  isDateQuestion(q: QuestionAnalyticsDto): boolean {
    return !!q.dateDistribution;
  }
  isRankingQuestion(q: QuestionAnalyticsDto): boolean {
    return !!q.rankingStats && q.rankingStats.length > 0;
  }
  isFileQuestion(q: QuestionAnalyticsDto): boolean {
    return q.fileUploadCount !== undefined && q.fileUploadCount !== null;
  }

  optionChartData(q: QuestionAnalyticsDto): ChartConfiguration['data'] {
    const stats = q.optionStats ?? [];
    return {
      labels: stats.map(s => s.optionText),
      datasets: [{
        data: stats.map(s => s.count),
        backgroundColor: stats.map((s, i) => s.color || CHART_PALETTE[i % CHART_PALETTE.length]),
        borderWidth: 0
      }]
    };
  }

  numericHistogramData(q: QuestionAnalyticsDto): ChartConfiguration['data'] {
    const dist = q.numericStats?.distribution ?? [];
    return {
      labels: dist.map(d => d.label),
      datasets: [{
        label: 'تعداد',
        data: dist.map(d => d.count),
        backgroundColor: '#1d4ed8',
        borderRadius: 6
      }]
    };
  }

  sentimentChartData(q: QuestionAnalyticsDto): ChartConfiguration['data'] {
    const s = q.textAnalytics!.sentiment;
    return {
      labels: ['مثبت', 'منفی', 'خنثی'],
      datasets: [{
        data: [s.positiveCount, s.negativeCount, s.neutralCount],
        backgroundColor: [SENTIMENT_COLORS.positive, SENTIMENT_COLORS.negative, SENTIMENT_COLORS.neutral],
        borderWidth: 0
      }]
    };
  }

  rankingChartData(q: QuestionAnalyticsDto): ChartConfiguration['data'] {
    const stats = q.rankingStats ?? [];
    return {
      labels: stats.map(s => s.itemLabel),
      datasets: [{
        label: 'میانگین رتبه (کمتر = بهتر)',
        data: stats.map(s => s.averageRank),
        backgroundColor: '#8b5cf6',
        borderRadius: 6
      }]
    };
  }

  dateChartData(q: QuestionAnalyticsDto): ChartConfiguration['data'] {
    return this.buildTrendLineData(q.dateDistribution ?? [], 'تعداد پاسخ');
  }

  wordFontSize(count: number, q: QuestionAnalyticsDto): number {
    const words = q.textAnalytics?.topWords ?? [];
    if (words.length === 0) return 14;
    const max = Math.max(...words.map(w => w.count));
    const min = Math.min(...words.map(w => w.count));
    if (max === min) return 18;
    const ratio = (count - min) / (max - min);
    return Math.round(13 + ratio * 22);
  }

  sentimentLabel(sentiment: string): string {
    return sentiment === 'positive' ? 'مثبت' : sentiment === 'negative' ? 'منفی' : 'خنثی';
  }

  sentimentIcon(sentiment: string): string {
    return sentiment === 'positive' ? 'fa-smile' : sentiment === 'negative' ? 'fa-frown' : 'fa-meh';
  }

  private buildTrendLineData(points: TrendPointDto[], label: string): ChartConfiguration['data'] {
    return {
      labels: points.map(p => p.label),
      datasets: [{
        label,
        data: points.map(p => p.count),
        borderColor: '#1d4ed8',
        backgroundColor: 'rgba(29, 78, 216, 0.12)',
        fill: true,
        tension: 0.35,
        pointRadius: 3
      }]
    };
  }
}