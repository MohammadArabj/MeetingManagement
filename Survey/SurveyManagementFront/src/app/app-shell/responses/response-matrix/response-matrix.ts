import {
  Component, OnInit, inject, input, signal, computed, effect, DestroyRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';

import { ToastService } from '../../../services/framework-services/toast.service';
import { ResponseMatrixDto } from '../../../core/models/response-report';
import { ResponseService } from '../../../services/response.service';

interface ExportColumnItem {
  key: string;
  label: string;
  type: 'meta' | 'question';
  selected: boolean;
}

// ✅ respondentName/participantType/status/progress/deviceType حذف شدن
// ageGroup/gender/shift/unitTitle جایگزین شدن
const META_COLUMNS: { key: string; label: string }[] = [
  { key: 'index', label: 'ردیف' },
  { key: 'age', label: 'سن' },
  { key: 'gender', label: 'جنسیت' },
  { key: 'office', label: 'امور' },
  { key: 'employmentType', label: 'نوع استخدام' },
  { key: 'education', label: 'مدرک تحصیلی' },
  { key: 'shiftWorker', label: 'نوبت‌کاری' },
  { key: 'experienceYears', label: 'سابقه' },
  { key: 'organizationalGrade', label: 'گرید سازمانی' },
  { key: 'organizationalGroup', label: 'گروه سازمانی' },
  { key: 'startedAt', label: 'تاریخ شروع' },
  { key: 'completedAt', label: 'تاریخ اتمام' },
  { key: 'timeSpent', label: 'زمان صرف‌شده' },
];

@Component({
  selector: 'app-response-matrix',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './response-matrix.html',
  styleUrls: ['./response-matrix.css']
})
export class ResponseMatrixComponent implements OnInit {
  readonly surveyGuid = input.required<string>();

  private readonly responseService = inject(ResponseService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(false);
  readonly exporting = signal(false);
  readonly matrix = signal<ResponseMatrixDto | null>(null);
  readonly searchTerm = signal('');

  readonly showExportDialog = signal(false);
  readonly exportColumns = signal<ExportColumnItem[]>([]);

  readonly hasData = computed(() => (this.matrix()?.rows.length ?? 0) > 0);

  readonly selectedColumnsCount = computed(() =>
    this.exportColumns().filter(c => c.selected).length
  );

  readonly allColumnsSelected = computed(() =>
    this.exportColumns().length > 0 && this.exportColumns().every(c => c.selected)
  );

  readonly filteredRows = computed(() => {
    const m = this.matrix();
    if (!m) return [];
    const term = this.searchTerm().trim().toLowerCase();
    if (term.length < 2) return m.rows;

    return m.rows.filter(row => {
      const demographicMatch = [
        row.age?.toString(), row.gender, row.office, row.employmentType,
        row.education, row.shiftWorker, row.experienceYears?.toString(),
        row.organizationalGrade, row.organizationalGroup
      ].some(v => v?.toLowerCase().includes(term));
      if (demographicMatch) return true;
      return Object.values(row.answers).some(v => v?.toLowerCase().includes(term));
    });
  });

  readonly questions = computed(() =>
    [...(this.matrix()?.questions ?? [])].sort((a, b) => a.orderIndex - b.orderIndex)
  );

  constructor() {
    effect(() => {
      const guid = this.surveyGuid();
      if (guid) this.loadMatrix();
    });
  }

  ngOnInit(): void { }

  private loadMatrix(): void {
    this.loading.set(true);
    this.responseService.getMatrix(this.surveyGuid())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => {
          this.toastService.error('خطا در بارگذاری ماتریس پاسخ‌ها');
          this.loading.set(false);
          return of(null);
        })
      )
      .subscribe(x => {
        this.matrix.set(x);
        this.loading.set(false);
        if (x && this.exportColumns().length === 0) {
          this.initExportColumns(x);
        }
      });
  }

  private initExportColumns(matrix: ResponseMatrixDto): void {
    const metaItems: ExportColumnItem[] = META_COLUMNS.map(c => ({
      key: c.key,
      label: c.label,
      type: 'meta',
      selected: true
    }));

    const questionItems: ExportColumnItem[] = [...matrix.questions]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map(q => ({
        key: q.questionGuid,
        label: q.questionText,
        type: 'question' as const,
        selected: true
      }));

    this.exportColumns.set([...metaItems, ...questionItems]);
  }

  answerFor(row: any, questionGuid: string): string {
    return row.answers?.[questionGuid] ?? '-';
  }

  refresh(): void {
    this.loadMatrix();
  }

  openExportDialog(): void {
    if (!this.hasData()) return;
    const m = this.matrix();
    if (m && this.exportColumns().length === 0) {
      this.initExportColumns(m);
    }
    this.showExportDialog.set(true);
  }

  closeExportDialog(): void {
    this.showExportDialog.set(false);
  }

  toggleColumn(key: string): void {
    this.exportColumns.update(cols =>
      cols.map(c => c.key === key ? { ...c, selected: !c.selected } : c)
    );
  }

  toggleSelectAll(): void {
    const shouldSelect = !this.allColumnsSelected();
    this.exportColumns.update(cols => cols.map(c => ({ ...c, selected: shouldSelect })));
  }

  resetToDefault(): void {
    const m = this.matrix();
    if (m) this.initExportColumns(m);
  }

  moveColumnUp(index: number): void {
    if (index <= 0) return;
    this.exportColumns.update(cols => {
      const updated = [...cols];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      return updated;
    });
  }

  moveColumnDown(index: number): void {
    this.exportColumns.update(cols => {
      if (index >= cols.length - 1) return cols;
      const updated = [...cols];
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
      return updated;
    });
  }

  confirmExport(): void {
    const selected = this.exportColumns().filter(c => c.selected);
    if (selected.length === 0) {
      this.toastService.error('حداقل یک ستون را انتخاب کنید');
      return;
    }

    const columnKeys = selected.map(c => c.key);
    this.showExportDialog.set(false);
    this.runExport(columnKeys);
  }

  private runExport(columns: string[]): void {
    if (this.exporting()) return;
    this.exporting.set(true);

    this.responseService.exportResponses(this.surveyGuid(), columns)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((err) => {
          console.error('Export error:', err);
          this.toastService.error('خطا در تولید فایل Excel');
          this.exporting.set(false);
          return of(null);
        })
      )
      .subscribe((blob: Blob | null) => {
        if (blob && blob.size > 0) {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          const title = this.matrix()?.surveyTitle || 'survey';
          link.download = `پاسخ‌های_${title}_${Date.now()}.xlsx`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);
          this.toastService.success('فایل Excel با موفقیت دانلود شد');
        } else {
          this.toastService.error('فایل خروجی خالی است');
        }
        this.exporting.set(false);
      });
  }
}