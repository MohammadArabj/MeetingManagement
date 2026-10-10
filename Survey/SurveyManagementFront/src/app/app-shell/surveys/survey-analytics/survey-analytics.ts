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
  DemographicBucketDto,
  CriterionAnalyticsDto,
  QuestionStepGroup,
  groupQuestionsByStep,
  surveyHasSteps,
  stepDisplayTitle,
  formatSigned,
  sentimentLabelFa
} from '../../../core/models/survey-analytics.model';
import { ChartCanvasComponent } from '../../../shared/chart-canvas/chart-canvas';
import { TextAnalyticsPanelComponent } from './text-analytics-panel/text-analytics-panel';
import { downloadAnalyticsExcel } from '../../../core/models/analytics-excel-export.util';
import { downloadAnalyticsHtml } from '../../../core/models/analytics-html-export.util';

const CHART_PALETTE = [
  '#1d4ed8', '#3b82f6', '#f59e0b', '#22c55e', '#ff4d6d',
  '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#ec4899'
];

const SENTIMENT_COLORS = {
  positive: '#16a34a',
  negative: '#e11d48',
  mixed: '#d97706',
  neutral: '#94a3b8'
};

@Component({
  selector: 'app-survey-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, ChartCanvasComponent, TextAnalyticsPanelComponent],
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

  // ==================== گام‌ها ====================

  /** آیا نظرسنجی گام‌بندی شده است؟ (در غیر این صورت چیدمان تخت قبلی) */
  readonly hasSteps = computed(() => surveyHasSteps(this.analytics()));

  /** گروه‌های گام (بدون فیلتر جستجو) برای خلاصه‌ی گام‌ها */
  readonly allStepGroups = computed<QuestionStepGroup[]>(() => {
    const data = this.analytics();
    if (!data || !this.hasSteps()) return [];
    return groupQuestionsByStep(data);
  });

  /** گروه‌های نمایشی سوال‌ها (با اعمال جستجو). بدون گام = یک گروه بدون سرتیتر */
  readonly stepGroups = computed<QuestionStepGroup[]>(() => {
    const data = this.analytics();
    if (!data) return [];
    return groupQuestionsByStep(data, this.filteredQuestions());
  });

  readonly collapsedSteps = signal<ReadonlySet<string>>(new Set());

  readonly fmtSigned = formatSigned;
  readonly stepTitle = stepDisplayTitle;

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

  async exportToExcel(): Promise<void> {
    const data = this.analytics();
    if (!data) return;
    this.exportingExcel.set(true);
    try {
      await downloadAnalyticsExcel(data);
      this.toastService.success('فایل Excel با موفقیت دانلود شد');
    } catch (err) {
      console.error('Analytics export error:', err);
      this.toastService.error('خطا در تولید فایل Excel');
    } finally {
      this.exportingExcel.set(false);
    }
  }

  // ==================== اکشن‌های گام ====================

  stepAnchor(key: string): string {
    return 'step-' + key;
  }

  isStepCollapsed(key: string): boolean {
    return this.collapsedSteps().has(key);
  }

  toggleStep(key: string): void {
    const next = new Set(this.collapsedSteps());
    if (next.has(key)) next.delete(key); else next.add(key);
    this.collapsedSteps.set(next);
  }

  setAllStepsCollapsed(collapsed: boolean): void {
    this.collapsedSteps.set(collapsed ? new Set(this.allStepGroups().map(g => g.key)) : new Set());
  }

  readonly allStepsCollapsed = computed(() =>
    this.allStepGroups().length > 0 && this.allStepGroups().every(g => this.collapsedSteps().has(g.key))
  );

  /** پرش به یک گام (در صورت نیاز تب را هم عوض می‌کند و گام را باز می‌کند) */
  jumpToStep(key: string, tab?: 'questions' | 'dashboard'): void {
    if (tab && this.activeTab() !== tab) this.activeTab.set(tab);
    if (this.collapsedSteps().has(key)) {
      const next = new Set(this.collapsedSteps());
      next.delete(key);
      this.collapsedSteps.set(next);
    }
    const reduceMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => {
      document.getElementById(this.stepAnchor(key))
        ?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }, 30);
  }

  /** رنگ‌بندی درصد امتیاز گام */
  scoreTone(value: number | null | undefined): 'good' | 'mid' | 'bad' | 'none' {
    if (value === null || value === undefined) return 'none';
    return value >= 70 ? 'good' : value >= 50 ? 'mid' : 'bad';
  }

  /** رنگ‌بندی شاخص خالص احساس */
  sentimentTone(value: number | null | undefined): 'good' | 'mid' | 'bad' | 'none' {
    if (value === null || value === undefined) return 'none';
    return value >= 10 ? 'good' : value <= -10 ? 'bad' : 'mid';
  }

  stepSummary(g: QuestionStepGroup): CriterionAnalyticsDto | null {
    return g.criterion;
  }

  /** شاخص خالص احساس یک سوال متنی */
  questionNetSentiment(q: QuestionAnalyticsDto): number {
    const s = q.textAnalytics?.sentiment;
    if (!s) return 0;
    if (s.netSentiment !== undefined && s.netSentiment !== null) return Number(s.netSentiment);
    return Math.round((s.positivePercentage - s.negativePercentage) * 10) / 10;
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

  // ✅ کش داده‌ی نمودارها تا با هر change detection نمودار از نو ساخته نشود
  private readonly chartCache = new WeakMap<QuestionAnalyticsDto, Record<string, ChartConfiguration['data']>>();

  private cached(q: QuestionAnalyticsDto, kind: string, build: () => ChartConfiguration['data']): ChartConfiguration['data'] {
    let entry = this.chartCache.get(q);
    if (!entry) { entry = {}; this.chartCache.set(q, entry); }
    return entry[kind] ??= build();
  }

  optionChartData(q: QuestionAnalyticsDto): ChartConfiguration['data'] {
    return this.cached(q, 'option', () => this.buildOptionChartData(q));
  }

  private buildOptionChartData(q: QuestionAnalyticsDto): ChartConfiguration['data'] {
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
    return this.cached(q, 'numeric', () => this.buildNumericHistogramData(q));
  }

  private buildNumericHistogramData(q: QuestionAnalyticsDto): ChartConfiguration['data'] {
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

  rankingChartData(q: QuestionAnalyticsDto): ChartConfiguration['data'] {
    return this.cached(q, 'ranking', () => this.buildRankingChartData(q));
  }

  private buildRankingChartData(q: QuestionAnalyticsDto): ChartConfiguration['data'] {
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
    return this.cached(q, 'date', () => this.buildTrendLineData(q.dateDistribution ?? [], 'تعداد پاسخ'));
  }

  /** کلیدواژه‌های مختصر برای کارت داشبورد (با پشتیبانی از داده‌ی قدیمی) */
  topTerms(q: QuestionAnalyticsDto, n = 8): string[] {
    const t = q.textAnalytics;
    if (!t) return [];
    if (t.keywords && t.keywords.length > 0) return t.keywords.slice(0, n).map(k => k.term);
    return (t.topWords ?? []).slice(0, n).map(w => w.word);
  }

  sentimentLabel(sentiment: string): string {
    return sentimentLabelFa(sentiment);
  }

  readonly sentimentColors = SENTIMENT_COLORS;

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