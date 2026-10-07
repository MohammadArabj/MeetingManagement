import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  DestroyRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { SurveyService } from '../../../services/survey.service';
import { AppSharedDataComponent } from '../../../shared/app-shared-data/app-shared-data';

// ==================== DTOs ====================

export interface MySurveyListDto {
  guid: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  totalQuestions: number;
  surveyStatus: string;
  isActive: boolean;
  isExpired: boolean;
  themeColor?: string;
  logoUrl?: string;
  allowAnonymous: boolean;
  allowSaveDraft: boolean;
  maxResponses?: number;
  totalResponses: number;
  isFull: boolean;
  responseStatus: MyResponseStatus;
  responseStatusText: string;
  progressPercentage: number;
  existingResponseGuid?: string;
  lastActivityDate?: string;
  createdBy: string;
  daysRemaining: number;
}

export enum MyResponseStatus {
  NotStarted = 0,
  InProgress = 1,
  Completed = 2,
  Expired = 3,
}

type FilterTab = 'all' | 'notStarted' | 'inProgress' | 'completed' | 'expired';

@Component({
  selector: 'app-my-surveys',
  templateUrl: './my-surveys.component.html',
  styleUrls: ['./my-surveys.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MySurveysComponent
  extends AppSharedDataComponent
  implements OnInit {
  private readonly surveyService = inject(SurveyService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // ==================== State ====================
  readonly surveys = signal<MySurveyListDto[]>([]);
  readonly loading = signal<boolean>(true);
  readonly activeFilter = signal<FilterTab>('all');
  readonly searchQuery = signal<string>('');

  // ==================== Enums (for template) ====================
  readonly ResponseStatus = MyResponseStatus;

  // ==================== Computed ====================

  readonly filteredSurveys = computed(() => {
    let list = this.surveys();
    const filter = this.activeFilter();
    const query = this.searchQuery().trim().toLowerCase();

    // فیلتر وضعیت
    if (filter !== 'all') {
      const statusMap: Record<FilterTab, MyResponseStatus> = {
        all: MyResponseStatus.NotStarted, // unused
        notStarted: MyResponseStatus.NotStarted,
        inProgress: MyResponseStatus.InProgress,
        completed: MyResponseStatus.Completed,
        expired: MyResponseStatus.Expired,
      };
      list = list.filter((s) => s.responseStatus === statusMap[filter]);
    }

    // جستجو
    if (query) {
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query) ||
          s.createdBy.toLowerCase().includes(query)
      );
    }

    return list;
  });

  readonly counts = computed(() => {
    const all = this.surveys();
    return {
      all: all.length,
      notStarted: all.filter(
        (s) => s.responseStatus === MyResponseStatus.NotStarted
      ).length,
      inProgress: all.filter(
        (s) => s.responseStatus === MyResponseStatus.InProgress
      ).length,
      completed: all.filter(
        (s) => s.responseStatus === MyResponseStatus.Completed
      ).length,
      expired: all.filter(
        (s) => s.responseStatus === MyResponseStatus.Expired
      ).length,
    };
  });

  readonly isEmpty = computed(() => this.filteredSurveys().length === 0);
  readonly hasAnySurveys = computed(() => this.surveys().length > 0);

  // ==================== Lifecycle ====================

  override async ngOnInit(): Promise<void> {
    super.ngOnInit();
    this.loadMySurveys();
  }

  // ==================== Data Loading ====================

  private loadMySurveys(): void {
    this.loading.set(true);

    this.surveyService
      .getMySurveys()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((error) => {
          console.error('Error loading surveys:', error);
          this.toastService.error('خطا در بارگذاری نظرسنجی‌ها');
          return of([]);
        })
      )
      .subscribe((data: MySurveyListDto[]) => {
        this.surveys.set(data);
        this.loading.set(false);
      });
  }

  // ==================== Actions ====================

  setFilter(filter: FilterTab): void {
    this.activeFilter.set(filter);
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
  }

  /** شرکت در نظرسنجی */
  participate(survey: MySurveyListDto): void {
    if (survey.isExpired) {
      this.toastService.error('مهلت پاسخ‌دهی به این نظرسنجی تمام شده است');
      return;
    }
    if (survey.isFull) {
      this.toastService.error('ظرفیت این نظرسنجی تکمیل شده است');
      return;
    }
    if (survey.responseStatus === MyResponseStatus.Completed) {
      this.toastService.info('شما قبلاً به این نظرسنجی پاسخ داده‌اید');
      return;
    }

    this.router.navigate(['/survey/take', survey.guid]);
  }

  /** مشاهده نتایج (اگه تکمیل شده) */
  viewResult(survey: MySurveyListDto): void {
    // TODO: اگه صفحه مشاهده نتایج دارید
    this.toastService.info('پاسخ شما با موفقیت ثبت شده است');
  }

  refresh(): void {
    this.loadMySurveys();
  }

  // ==================== Helpers ====================

  getStatusIcon(status: MyResponseStatus): string {
    switch (status) {
      case MyResponseStatus.NotStarted:
        return 'fa-circle';
      case MyResponseStatus.InProgress:
        return 'fa-clock';
      case MyResponseStatus.Completed:
        return 'fa-check-circle';
      case MyResponseStatus.Expired:
        return 'fa-times-circle';
      default:
        return 'fa-question-circle';
    }
  }

  getUrgencyClass(survey: MySurveyListDto): string {
    if (survey.isExpired || survey.responseStatus === MyResponseStatus.Expired)
      return 'expired';
    if (survey.responseStatus === MyResponseStatus.Completed) return 'completed';
    if (survey.daysRemaining <= 2) return 'urgent';
    if (survey.daysRemaining <= 7) return 'warning';
    return 'normal';
  }

  trackByGuid(_: number, item: MySurveyListDto): string {
    return item.guid;
  }
}
