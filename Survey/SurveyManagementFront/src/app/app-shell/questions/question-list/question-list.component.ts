import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  input
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { catchError, of } from 'rxjs';

import {
  QuestionService,
  QuestionListDto
} from '../../../services/question.service';
import { SwalService } from '../../../services/framework-services/swal.service';

import { QuestionOptionsCellComponent } from './question-options-cell.component';
import { AgGridBaseComponent } from '../../../shared/ag-grid-base/ag-grid-base';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';

@Component({
  selector: 'app-question-list',
  templateUrl: './question-list.component.html',
  styleUrls: ['./question-list.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    AgGridAngular
  ]
})
export class QuestionListComponent extends AgGridBaseComponent implements OnInit {
  // Injected services
  private readonly questionService = inject(QuestionService);
  private readonly swalService = inject(SwalService);
  private readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);

  /**
   * ورودی جدید: surveyGuid
   * برای سازگاری با کدهای قبلی، surveyId هم پذیرفته می‌شود (اگر parent هنوز surveyId پاس می‌دهد).
   */
  readonly surveyGuid = input<string>('');
  readonly surveyId = input<string>('');

  /**
   * مقدار نهایی که در همه جای کامپوننت استفاده می‌شود.
   * اولویت: surveyGuid -> surveyId (legacy) -> queryParams
   */
  readonly effectiveSurveyGuid = computed(() => {
    const fromInput = this.surveyGuid() || this.surveyId();
    if (fromInput) return fromInput;

    const qp = this.route.snapshot.queryParams;
    return qp['surveyGuid'] || qp['surveyId'] || '';
  });

  // Signals
  public questions = signal<QuestionListDto[]>([]);
  public loading = signal<boolean>(false);

  // Computed
  public hasQuestions = computed(() => this.questions().length > 0);

  constructor() {
    super();
    this.setupBreadcrumb();
  }

  private setupBreadcrumb(): void {
    // BreadcrumbService setup if needed
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.setupGridColumns();
    this.loadQuestions();
  }

  private setupGridColumns(): void {
    const options = this.gridOptions();
    if (!options) return;

    options.columnDefs = [
      {
        colId: 'actions',
        headerName: 'عملیات',
        filter: false,
        cellRenderer: QuestionOptionsCellComponent,
        cellStyle: { textAlign: 'center', overflow: 'unset' },
        width: 50,
        maxWidth: 50
      },
      {
        field: 'sortOrder',
        headerName: 'ترتیب',
        filter: 'agNumberColumnFilter',
        width: 50,
        type: 'numericColumn'
      },
      {
        field: 'questionText',
        headerName: 'متن سوال',
        filter: 'agTextColumnFilter',
        minWidth: 500
      },
      {
        field: 'questionType',
        headerName: 'نوع سوال',
        filter: 'agTextColumnFilter',
        minWidth: 250
      },
      {
        field: 'isRequired',
        headerName: 'الزامی',
        filter: 'agSetColumnFilter',
        cellRenderer: (params: any) =>
          params.value
            ? '<span class="badge bg-success">بله</span>'
            : '<span class="badge bg-secondary">خیر</span>',
        width: 50
      },
      {
        field: 'totalOptions',
        headerName: 'تعداد گزینه',
        filter: 'agNumberColumnFilter',
        width: 50,
        type: 'numericColumn'
      },
      {
        field: 'hasLogic',
        headerName: 'منطق شرطی',
        filter: 'agSetColumnFilter',
        cellRenderer: (params: any) =>
          params.value ? '<i class="fa fa-check text-success"></i>' : '',
        width: 110
      }
    ];

    options.pagination = false;
    options.domLayout = 'autoHeight';
    options.getRowNodeId = (data: any) => data.guid;

    this.setupGridInteractions(options);
  }

  private setupGridInteractions(options: any): void {
    options.rowStyle = { cursor: 'pointer' };
    options.rowDragManaged = true;

    options.onCellClicked = (event: any) => {
      if (event.colDef.colId !== 'actions' && event.data) {
        this.editQuestion(event.data.guid);
      }
    };

    options.onRowDragEnd = () => {
      this.reorderQuestions();
    };
  }

  loadQuestions(): void {
    const surveyGuid = this.effectiveSurveyGuid();
    if (!surveyGuid) {
      this.questions.set([]);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);

    this.questionService
      .getListBySurvey(surveyGuid)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Error loading questions:', error);
          this.toastService.error('خطا در بارگذاری سوالات');
          return of([] as QuestionListDto[]);
        })
      )
      .subscribe((data: QuestionListDto[]) => {
        this.questions.set(data);
        this.loading.set(false);
      });
  }

  private reorderQuestions(): void {
    const surveyGuid = this.effectiveSurveyGuid();
    const api = this.gridApi();

    if (!surveyGuid || !api) return;

    const reorderedData: { guid: string; sortOrder: number }[] = [];
    let sortOrder = 1;

    api.forEachNode((node: any) => {
      if (node.data) {
        reorderedData.push({
          guid: node.data.guid,
          sortOrder: sortOrder++
        });
      }
    });

    this.questionService
      .reorderQuestions({
        surveyGuid,
        questionOrders: reorderedData
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastService.success('ترتیب سوالات با موفقیت ذخیره شد');
          this.loadQuestions();
        },
        error: () => {
          this.toastService.error('خطا در ذخیره ترتیب سوالات');
          this.loadQuestions();
        }
      });
  }

  addNewQuestion(): void {
    const surveyGuid = this.effectiveSurveyGuid();
    this.router.navigate(['/questions/create'], {
      queryParams: surveyGuid ? { surveyGuid } : undefined
    });
  }

  editQuestion(questionGuid: string): void {
    const surveyGuid = this.effectiveSurveyGuid();
    this.router.navigate(['/questions/edit', questionGuid], {
      queryParams: surveyGuid ? { surveyGuid } : undefined
    });
  }

  async askForDelete(guid: string): Promise<void> {
    try {
      const result = await this.swalService.fireDeleteSwal({
        title: 'حذف سوال',
        text: 'آیا از حذف این سوال اطمینان دارید؟'
      });

      if (!result?.isConfirmed) return;

      this.questionService
        .deleteQuestion(guid)
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          catchError(error => {
            console.error('Error deleting question:', error);
            this.toastService.error('خطا در حذف سوال');
            return of(false);
          })
        )
        .subscribe(ok => {
          if (ok) {
            this.swalService.fireDeleteSucceededSwal({
              title: 'حذف شد',
              text: 'سوال با موفقیت حذف شد.'
            });
          }
          this.loadQuestions();
        });
    } catch (error) {
      console.error('Error in delete operation:', error);
    }
  }

  viewStatistics(questionGuid: string): void {
    this.router.navigate(['/questions/statistics', questionGuid]);
  }

  backToSurveys(): void {
    this.router.navigate(['/surveys/list']);
  }
}
