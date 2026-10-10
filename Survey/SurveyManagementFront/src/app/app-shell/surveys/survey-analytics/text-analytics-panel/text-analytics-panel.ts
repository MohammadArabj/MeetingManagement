import { Component, ChangeDetectionStrategy, computed, input, signal } from '@angular/core';

import {
  KeywordDto,
  TextAnalyticsDto,
  TextAnswerItemDto,
  TextThemeDto,
  formatSigned,
  sentimentLabelFa
} from '../../../../core/models/survey-analytics.model';

type SentimentFilter = 'all' | 'positive' | 'negative' | 'neutral' | 'mixed' | 'empty';

interface HighlightPart {
  text: string;
  match: boolean;
}

interface AnswerRow {
  index: number;
  item: TextAnswerItemDto;
  /** متن نرمال‌شده برای جستجو (طول برابر با متن اصلی) */
  norm: string;
}

interface SentimentSegment {
  key: 'positive' | 'mixed' | 'neutral' | 'negative';
  label: string;
  count: number;
  percent: number;
}

const PAGE_SIZE = 20;

/**
 * نرمال‌سازی یک‌به‌یک کاراکترها (طول رشته تغییر نمی‌کند تا اندیس‌های هایلایت درست بمانند)
 */
function normalizeForSearch(text: string): string {
  return (text ?? '')
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

@Component({
  selector: 'app-text-analytics-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './text-analytics-panel.html',
  styleUrls: ['./text-analytics-panel.css']
})
export class TextAnalyticsPanelComponent {
  readonly data = input.required<TextAnalyticsDto>();
  /** تعداد پاسخ‌دهندگان به سوال (برای پشتیبانی از داده‌ی قدیمی) */
  readonly totalAnswered = input<number>(0);

  // ---------- وضعیت فیلتر جدول پاسخ‌ها ----------
  readonly searchTerm = signal('');
  readonly sentimentFilter = signal<SentimentFilter>('all');
  readonly themeFilter = signal<string>('all');
  readonly suggestionsOnly = signal(false);
  readonly page = signal(1);

  readonly expandedTheme = signal<string | null>(null);
  readonly showAllSuggestions = signal(false);
  readonly showAllKeywords = signal(false);

  readonly fmtSigned = formatSigned;
  readonly sentimentLabel = sentimentLabelFa;

  // ---------- شاخص‌ها ----------
  readonly themes = computed<TextThemeDto[]>(() => this.data().themes ?? []);
  readonly keywords = computed<KeywordDto[]>(() => {
    const k = this.data().keywords ?? [];
    if (k.length > 0) return k;
    // داده‌ی قدیمی: از topWords استفاده کن
    return (this.data().topWords ?? []).map(w => ({ term: w.word, count: w.count, documentCount: w.count, score: w.count }));
  });
  readonly visibleKeywords = computed(() =>
    this.showAllKeywords() ? this.keywords() : this.keywords().slice(0, 30)
  );
  readonly phrases = computed<KeywordDto[]>(() => this.data().phrases ?? []);
  readonly suggestions = computed<string[]>(() => this.data().suggestions ?? []);
  readonly visibleSuggestions = computed(() =>
    this.showAllSuggestions() ? this.suggestions() : this.suggestions().slice(0, 5)
  );
  readonly repeated = computed(() => this.data().repeatedAnswers ?? []);
  readonly lengthDist = computed(() => this.data().lengthDistribution ?? []);
  readonly lengthDistMax = computed(() => Math.max(1, ...this.lengthDist().map(b => b.count)));

  readonly themeTitleByKey = computed(() => {
    const map = new Map<string, string>();
    for (const t of this.themes()) map.set(t.key, t.title);
    return map;
  });

  readonly totalText = computed(() => {
    const d = this.data();
    return d.totalTextAnswers ?? (d.answers?.length || this.totalAnswered());
  });
  readonly meaningful = computed(() => this.data().meaningfulCount ?? this.totalText());
  readonly emptyLike = computed(() => this.data().emptyLikeCount ?? 0);
  readonly meaningfulPercent = computed(() => {
    const t = this.totalText();
    return t > 0 ? Math.round((this.meaningful() / t) * 100) : 0;
  });
  readonly netSentiment = computed<number | null>(() => {
    const s = this.data().sentiment;
    if (s.netSentiment !== undefined && s.netSentiment !== null) return Number(s.netSentiment);
    return Math.round((s.positivePercentage - s.negativePercentage) * 10) / 10;
  });
  readonly netTone = computed(() => {
    const n = this.netSentiment() ?? 0;
    return n >= 10 ? 'good' : n <= -10 ? 'bad' : 'flat';
  });
  readonly suggestionCount = computed(() => this.data().suggestionCount ?? this.suggestions().length);

  readonly sentimentSegments = computed<SentimentSegment[]>(() => {
    const s = this.data().sentiment;
    const segs: SentimentSegment[] = [
      { key: 'positive', label: 'مثبت', count: s.positiveCount, percent: Number(s.positivePercentage) || 0 },
      { key: 'mixed', label: 'دوگانه', count: s.mixedCount ?? 0, percent: Number(s.mixedPercentage ?? 0) },
      { key: 'neutral', label: 'خنثی', count: s.neutralCount, percent: Number(s.neutralPercentage) || 0 },
      { key: 'negative', label: 'منفی', count: s.negativeCount, percent: Number(s.negativePercentage) || 0 },
    ];
    return segs;
  });
  readonly sentimentTotal = computed(() => this.sentimentSegments().reduce((a, s) => a + s.count, 0));

  readonly themeMaxCount = computed(() => Math.max(1, ...this.themes().map(t => t.count)));

  // ---------- جدول پاسخ‌ها ----------
  private readonly allRows = computed<AnswerRow[]>(() => {
    const d = this.data();
    let items: TextAnswerItemDto[] = d.answers ?? [];
    if (items.length === 0) {
      // سازگاری با داده‌ی قدیمی
      const fromSamples = d.sentiment?.samples ?? [];
      items = fromSamples.length > 0
        ? fromSamples.map(s => ({ text: s.text, sentiment: s.sentiment, score: 0, wordCount: this.countWords(s.text), themes: [], isSuggestion: false }))
        : (d.sampleAnswers ?? []).map(t => ({ text: t, sentiment: 'neutral', score: 0, wordCount: this.countWords(t), themes: [], isSuggestion: false }));
    }
    return items.map((item, i) => ({ index: i + 1, item, norm: normalizeForSearch(item.text) }));
  });

  readonly hasRichAnswers = computed(() => (this.data().answers?.length ?? 0) > 0);

  private readonly normalizedTerm = computed(() => normalizeForSearch(this.searchTerm().trim()));

  readonly filteredRows = computed<AnswerRow[]>(() => {
    const term = this.normalizedTerm();
    const sf = this.sentimentFilter();
    const tf = this.themeFilter();
    const sugOnly = this.suggestionsOnly();
    return this.allRows().filter(r => {
      if (sf !== 'all' && r.item.sentiment !== sf) return false;
      if (tf !== 'all' && !(r.item.themes ?? []).includes(tf)) return false;
      if (sugOnly && !r.item.isSuggestion) return false;
      if (term && !r.norm.includes(term)) return false;
      return true;
    });
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredRows().length / PAGE_SIZE)));
  readonly currentPage = computed(() => Math.min(this.page(), this.totalPages()));
  readonly pageRows = computed(() => {
    const start = (this.currentPage() - 1) * PAGE_SIZE;
    return this.filteredRows().slice(start, start + PAGE_SIZE);
  });
  readonly pageStart = computed(() => this.filteredRows().length === 0 ? 0 : (this.currentPage() - 1) * PAGE_SIZE + 1);
  readonly pageEnd = computed(() => Math.min(this.currentPage() * PAGE_SIZE, this.filteredRows().length));
  readonly hasActiveFilter = computed(() =>
    !!this.searchTerm().trim() || this.sentimentFilter() !== 'all' || this.themeFilter() !== 'all' || this.suggestionsOnly()
  );

  // ---------- اکشن‌ها ----------
  setSearch(v: string): void { this.searchTerm.set(v); this.page.set(1); }
  setSentimentFilter(v: string): void { this.sentimentFilter.set(v as SentimentFilter); this.page.set(1); }
  setThemeFilter(v: string): void { this.themeFilter.set(v); this.page.set(1); }
  setSuggestionsOnly(v: boolean): void { this.suggestionsOnly.set(v); this.page.set(1); }
  clearFilters(): void {
    this.searchTerm.set('');
    this.sentimentFilter.set('all');
    this.themeFilter.set('all');
    this.suggestionsOnly.set(false);
    this.page.set(1);
  }
  goToPage(p: number): void { this.page.set(Math.min(Math.max(1, p), this.totalPages())); }

  toggleTheme(key: string): void {
    this.expandedTheme.set(this.expandedTheme() === key ? null : key);
  }
  filterByTheme(key: string): void {
    this.clearFilters();
    this.themeFilter.set(key);
  }
  filterByTerm(term: string): void {
    this.clearFilters();
    this.searchTerm.set(term);
  }
  filterBySentiment(key: string): void {
    this.clearFilters();
    this.sentimentFilter.set(key as SentimentFilter);
  }
  showSuggestionsInTable(): void {
    this.clearFilters();
    this.suggestionsOnly.set(true);
  }

  // ---------- کمک‌کننده‌های نمایش ----------
  /** تقسیم متن به بخش‌های عادی/منطبق برای هایلایت امن (بدون innerHTML) */
  highlight(row: AnswerRow): HighlightPart[] {
    const term = this.normalizedTerm();
    const text = row.item.text ?? '';
    if (!term || row.norm.length !== text.length) return [{ text, match: false }];
    const parts: HighlightPart[] = [];
    let from = 0;
    let idx = row.norm.indexOf(term, from);
    while (idx !== -1) {
      if (idx > from) parts.push({ text: text.slice(from, idx), match: false });
      parts.push({ text: text.slice(idx, idx + term.length), match: true });
      from = idx + term.length;
      idx = row.norm.indexOf(term, from);
    }
    if (from < text.length) parts.push({ text: text.slice(from), match: false });
    return parts;
  }

  themeTitle(key: string): string {
    return this.themeTitleByKey().get(key) ?? key;
  }

  keywordSize(k: KeywordDto): number {
    const list = this.keywords();
    const max = Math.max(...list.map(x => x.documentCount || x.count));
    const min = Math.min(...list.map(x => x.documentCount || x.count));
    const v = k.documentCount || k.count;
    if (max === min) return 0.95;
    return Math.round((0.8 + ((v - min) / (max - min)) * 0.75) * 100) / 100;
  }

  keywordWeight(k: KeywordDto): number {
    return this.keywordSize(k) >= 1.25 ? 800 : this.keywordSize(k) >= 1 ? 700 : 600;
  }

  themeNeutral(t: TextThemeDto): number {
    return Math.max(0, t.count - t.positiveCount - t.negativeCount);
  }

  pct(part: number, total: number): number {
    return total > 0 ? (part / total) * 100 : 0;
  }

  private countWords(t: string): number {
    return (t ?? '').trim().split(/\s+/).filter(Boolean).length;
  }
}
