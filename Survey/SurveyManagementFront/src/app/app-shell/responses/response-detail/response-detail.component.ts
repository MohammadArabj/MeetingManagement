import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  DestroyRef,
  HostListener,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { catchError, of } from 'rxjs';

import { ResponseService, ResponseDetailDto, ResponseAnswerDetailDto } from '../../../services/response.service';
import { PasswordFlowService } from '../../../services/framework-services/password-flow.service';
import { AppSharedDataComponent } from '../../../shared/app-shared-data/app-shared-data';
import { SwalService } from '../../../services/framework-services/swal.service';

@Component({
  selector: 'app-response-detail',
  templateUrl: './response-detail.component.html',
  styleUrls: ['./response-detail.component.css'],
  standalone: true,
  imports: [CommonModule]
})
export class ResponseDetailComponent extends AppSharedDataComponent implements OnInit {
  // Injected services
  private readonly responseService = inject(ResponseService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly passwordFlowService = inject(PasswordFlowService);
  private readonly swalService = inject(SwalService);

  // Signals
  private readonly _responseId = signal<string>('');
  private readonly _responseDetail = signal<ResponseDetailDto | null>(null);
  private readonly _isLoading = signal<boolean>(false);

  // Permission signal
  public canDelete = signal<boolean>(false);

  // ✅ FAB scroll state
  readonly showFab = signal<boolean>(false);
  readonly isNearBottom = signal<boolean>(false);

  // Public computed
  readonly responseId = this._responseId.asReadonly();
  readonly responseDetail = this._responseDetail.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();

  readonly hasResponse = computed(() => this._responseDetail() !== null);
  readonly answers = computed(() => this._responseDetail()?.answers || []);
  readonly answeredCount = computed(() =>
    this.answers().filter(a => !this.isAnswerEmpty(a)).length
  );
  readonly completedAt = computed(() => {
    const date = this._responseDetail()?.completedAt;
    return date ;
  });
  readonly startedAt = computed(() => {
    const date = this._responseDetail()?.startedAt;
    return date ;
  });

  constructor() {
    super();
    this.setupBreadcrumb();
  }

  private setupBreadcrumb(): void {
    // BreadcrumbService setup if needed
  }

  override async ngOnInit(): Promise<void> {
    super.ngOnInit();

    await this.loadPermissions();

    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const id = params.get('id');
        if (id) {
          this._responseId.set(id);
          this.loadResponseDetail();
        }
      });
  }

  private async loadPermissions(): Promise<void> {
    try {
      const canDelete = await this.passwordFlowService.checkPermission('SV_Responses_Delete');
      this.canDelete.set(canDelete);
    } catch (error) {
      console.error('Error loading permissions:', error);
    }
  }

  private loadResponseDetail(): void {
    const id = this._responseId();
    if (!id) return;

    this._isLoading.set(true);

    this.responseService.getDetail(id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Error loading response detail:', error);
          this.toastService.error('خطا در بارگذاری جزئیات پاسخ');
          this._isLoading.set(false);
          return of(null);
        })
      )
      .subscribe((detail: ResponseDetailDto | null) => {
        if (detail) {
          this._responseDetail.set(detail);
        }
        this._isLoading.set(false);
      });
  }

  getQuestionTypeLabel(type: number): string {
    const typeMap: { [key: number]: string } = {
      3: 'متن کوتاه',
      4: 'متن بلند',
      1: 'چند گزینه‌ای (تک انتخابی)',
      2: 'چند گزینه‌ای (چند انتخابی)',
      10: 'لیست کشویی',
      5: 'امتیازدهی',
      8: 'تاریخ',
      9: 'آپلود فایل',
      11: 'ماتریس'
    };
    return typeMap[type] || 'نامشخص';
  }

  getQuestionTypeIcon(type: number): string {
    const iconMap: { [key: number]: string } = {
      3: 'fa-font',
      4: 'fa-align-right',
      1: 'fa-dot-circle',
      2: 'fa-check-square',
      10: 'fa-caret-square-down',
      5: 'fa-star',
      8: 'fa-calendar',
      9: 'fa-paperclip',
      11: 'fa-table'
    };
    return iconMap[type] || 'fa-question-circle';
  }

  formatAnswerValue(answer: ResponseAnswerDetailDto): string {
    if (answer.textAnswer) return answer.textAnswer;

    if (answer.numericAnswer !== undefined && answer.numericAnswer !== null) {
      return answer.numericAnswer.toString();
    }

    if (answer.dateAnswer) {
      return new Date(answer.dateAnswer).toLocaleDateString('fa-IR');
    }

    if (answer.selectedOption) return answer.selectedOption;

    if (answer.selectedOptions && answer.selectedOptions.length > 0) {
      return answer.selectedOptions.join(', ');
    }

    if (answer.fileUrl && answer.fileName) {
      return answer.fileName;
    }

    if (answer.otherAnswer) return answer.otherAnswer;

    return '-';
  }

  hasMatrixAnswers(answer: ResponseAnswerDetailDto): boolean {
    return !!answer.matrixAnswers && Object.keys(answer.matrixAnswers).length > 0;
  }

  getMatrixAnswersArray(answer: ResponseAnswerDetailDto): Array<{ row: string, column: string }> {
    if (!answer.matrixAnswers) return [];
    return Object.entries(answer.matrixAnswers).map(([row, column]) => ({ row, column }));
  }

  isAnswerEmpty(answer: ResponseAnswerDetailDto): boolean {
    return !!answer.isSkipped ||
      (!answer.textAnswer &&
        answer.numericAnswer === undefined &&
        !answer.dateAnswer &&
        !answer.selectedOption &&
        (!answer.selectedOptions || answer.selectedOptions.length === 0) &&
        !answer.fileUrl &&
        !this.hasMatrixAnswers(answer) &&
        (!answer.rankingAnswers || answer.rankingAnswers.length === 0));
  }

  backToList(): void {
    const detail = this._responseDetail();
    if (detail?.surveyGuid) {
      this.router.navigate(['/responses/list'], {
        queryParams: { surveyId: detail.surveyGuid }
      });
    } else {
      this.router.navigate(['/surveys/list']);
    }
  }

  async deleteResponse(): Promise<void> {
    const id = this._responseId();
    if (!id) return;

    try {
      const result = await this.swalService.fireDeleteSwal();
      if (result.value === true) {
        this.responseService.deleteResponse(id)
          .pipe(
            takeUntilDestroyed(this.destroyRef),
            catchError(error => {
              this.toastService.error('خطا در حذف پاسخ');
              return of(null);
            })
          )
          .subscribe(() => {
            this.swalService.fireDeleteSucceededSwal();
            this.backToList();
          });
      }
    } catch (error) {
      console.error('Error deleting response:', error);
    }
  }

  printResponse(): void {
    window.print();
  }

  // ==================== ✅ FAB Scroll ====================

  private getScrollContainer(): HTMLElement | Window {
    // اگر شل برنامه container خودش رو اسکرول می‌کنه (app-shell-main)، همون رو پیدا کن
    const shellMain = document.querySelector('.app-shell-main') as HTMLElement | null;
    return shellMain ?? window;
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.updateFabState();
  }

  private updateFabState(): void {
    const container = this.getScrollContainer();
    const scrollTop = container instanceof Window
      ? window.scrollY
      : container.scrollTop;
    const scrollHeight = container instanceof Window
      ? document.documentElement.scrollHeight
      : container.scrollHeight;
    const clientHeight = container instanceof Window
      ? window.innerHeight
      : container.clientHeight;

    this.showFab.set(scrollHeight > clientHeight + 200);
    this.isNearBottom.set(scrollTop + clientHeight >= scrollHeight - 80);
  }

  scrollToTop(): void {
    const container = this.getScrollContainer();
    if (container instanceof Window) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  scrollToBottom(): void {
    const container = this.getScrollContainer();
    if (container instanceof Window) {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    } else {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }

  onFabClick(): void {
    if (this.isNearBottom()) {
      this.scrollToTop();
    } else {
      this.scrollToBottom();
    }
  }
}