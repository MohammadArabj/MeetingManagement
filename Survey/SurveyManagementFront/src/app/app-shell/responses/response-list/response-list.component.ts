import {
  Component, OnInit, inject, signal, computed
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, ActivatedRoute } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { catchError, of } from 'rxjs';

import { ResponseService, ResponseListDto, ResponseSearchRequest, ParticipantsReportDto } from '../../../services/response.service';
import { ResponseOptionsCellComponent } from './response-options-cell.component';
import { PasswordFlowService } from '../../../services/framework-services/password-flow.service';
import { AgGridBaseComponent } from '../../../shared/ag-grid-base/ag-grid-base';
import { BreadcrumbService } from '../../../services/framework-services/breadcrumb.service';
import { ResponseMatrixComponent } from "../response-matrix/response-matrix";
import { SurveyAnalyticsComponent } from "../../surveys/survey-analytics/survey-analytics";

@Component({
  selector: 'app-response-list',
  templateUrl: './response-list.component.html',
  styleUrls: ['./response-list.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular, ResponseMatrixComponent, SurveyAnalyticsComponent]
})
export class ResponseListComponent extends AgGridBaseComponent implements OnInit {
  private readonly responseService = inject(ResponseService);
  private readonly route = inject(ActivatedRoute);
  private readonly passwordFlowService = inject(PasswordFlowService);
  readonly router = inject(Router);
  readonly breadCrumbService = inject(BreadcrumbService);

  readonly surveyGuid = signal<string>('');

  public responses = signal<ResponseListDto[]>([]);
  public loading = signal<boolean>(false);

  // ✅ فیلتر متنی سبک روی دموگرافیک (به‌جای فیلتر Status که دیگه معنی نداره)
  public searchTerm = signal<string>('');

  public canExport = signal<boolean>(false);
  public canDelete = signal<boolean>(false);
  public canView = signal<boolean>(false);

  public hasResponses = computed(() => this.responses().length > 0);

// داخل کلاس:

public participantsReport = signal<ParticipantsReportDto | null>(null);
public loadingParticipants = signal<boolean>(false);
public exportingParticipants = signal<boolean>(false);
public showParticipantsPanel = signal<boolean>(false);

toggleParticipantsPanel(): void {
  const willOpen = !this.showParticipantsPanel();
  this.showParticipantsPanel.set(willOpen);
  if(willOpen && !this.participantsReport()) {
  this.loadParticipants();
}
}

private loadParticipants(): void {
  this.loadingParticipants.set(true);
  this.responseService.getParticipants(this.surveyGuid())
    .pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(error => {
        console.error('Error loading participants:', error);
        this.toastService.error('خطا در بارگذاری فهرست شرکت‌کنندگان');
        this.loadingParticipants.set(false);
        return of(null);
      })
    )
    .subscribe(data => {
      if (data) this.participantsReport.set(data);
      this.loadingParticipants.set(false);
    });
}

exportParticipants(): void {
  const surveyGuid = this.surveyGuid();
  if(!surveyGuid) return;

  this.exportingParticipants.set(true);

  this.responseService.exportParticipants(surveyGuid)
    .pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError((error) => {
        console.error('Error exporting participants:', error);
        this.toastService.error('خطا در خروجی گرفتن فهرست شرکت‌کنندگان');
        this.exportingParticipants.set(false);
        return of(null as Blob | null);
      })
    )
    .subscribe((blob) => {
      const fileBlob = blob as Blob | null;
      if (fileBlob) {
        const url = window.URL.createObjectURL(fileBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `شرکت‌کنندگان_${surveyGuid}_${Date.now()}.xlsx`;
        link.click();
        window.URL.revokeObjectURL(url);
        this.toastService.success('فهرست شرکت‌کنندگان دانلود شد');
      }
      this.exportingParticipants.set(false);
    });
}

  readonly viewMode = signal<'grid' | 'matrix' | 'analytics'>('grid');
  setViewMode(mode: 'grid' | 'matrix' | 'analytics'): void {
    this.viewMode.set(mode);
  }

  constructor() {
    super();
    this.setupBreadcrumb();
  }

  private setupBreadcrumb(): void {
    this.breadCrumbService.setItems([
      { label: 'نظرسنجی‌ها', routerLink: '/surveys/list' },
      { label: 'پاسخ‌ها', routerLink: '/responses/list' }
    ]);
  }

  override async ngOnInit(): Promise<void> {
    super.ngOnInit();
    this.setupGridColumns();
    await this.loadPermissions();
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const guid = params.get('surveyGuid');
        if (guid) {
          this.surveyGuid.set(guid);
          this.loadResponses();
        }
      });
  }

  private async loadPermissions(): Promise<void> {
    try {
      const [canExport, canDelete, canView] = await Promise.all([
        this.passwordFlowService.checkPermission('SV_Responses_Export'),
        this.passwordFlowService.checkPermission('SV_Responses_Delete'),
        this.passwordFlowService.checkPermission('SV_Responses_View')
      ]);
      this.canExport.set(canExport);
      this.canDelete.set(canDelete);
      this.canView.set(canView);
    } catch (error) {
      console.error('Error loading permissions:', error);
    }
  }

  readonly filteredResponses = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const all = this.responses();
    if (term.length < 2) return all;
    return all.filter(r =>
      [
        r.gender, r.office, r.employmentType, r.education,
        r.shiftWorker, r.organizationalGrade, r.organizationalGroup,
        r.age?.toString(), r.experienceYears?.toString(), r.surveyTitle
      ].some(v => v?.toLowerCase().includes(term))
    );
  });

  private setupGridColumns(): void {
    const options = this.gridOptions();
    if (!options) return;

    options.columnDefs = [
      {
        colId: 'actions',
        headerName: 'عملیات',
        filter: false,
        cellRenderer: ResponseOptionsCellComponent,
        cellStyle: { textAlign: 'center', overflow: 'unset' },
        width: 100,
        maxWidth: 100
      },
      { field: 'surveyTitle', headerName: 'نظرسنجی', filter: 'agTextColumnFilter', minWidth: 200 },
      {
        field: 'age', headerName: 'سن', filter: 'agNumberColumnFilter', width: 90,
        valueGetter: (p: any) => p.data?.age ?? '-'
      },
      {
        field: 'gender', headerName: 'جنسیت', filter: 'agSetColumnFilter', width: 100,
        valueGetter: (p: any) => p.data?.gender || '-'
      },
      {
        field: 'office', headerName: 'امور', filter: 'agSetColumnFilter', width: 160,
        valueGetter: (p: any) => p.data?.office || '-'
      },
      {
        field: 'employmentType', headerName: 'نوع استخدام', filter: 'agSetColumnFilter', width: 130,
        valueGetter: (p: any) => p.data?.employmentType || '-'
      },
      {
        field: 'education', headerName: 'مدرک تحصیلی', filter: 'agSetColumnFilter', width: 130,
        valueGetter: (p: any) => p.data?.education || '-'
      },
      {
        field: 'shiftWorker', headerName: 'نوبت‌کاری', filter: 'agSetColumnFilter', width: 120,
        valueGetter: (p: any) => p.data?.shiftWorker || '-'
      },
      {
        field: 'experienceYears', headerName: 'سابقه (سال)', filter: 'agNumberColumnFilter', width: 110,
        valueGetter: (p: any) => p.data?.experienceYears ?? '-'
      },
      {
        field: 'organizationalGrade', headerName: 'گرید سازمانی', filter: 'agSetColumnFilter', width: 120,
        valueGetter: (p: any) => p.data?.organizationalGrade || '-'
      },
      {
        field: 'organizationalGroup', headerName: 'گروه سازمانی', filter: 'agSetColumnFilter', width: 150,
        valueGetter: (p: any) => p.data?.organizationalGroup || '-'
      },
      {
        field: 'timeSpentText', headerName: 'زمان صرف شده', filter: 'agTextColumnFilter', width: 140,
        valueGetter: (p: any) => p.data?.timeSpentText || '-'
      },
      { field: 'startedAt', headerName: 'تاریخ شروع', filter: 'agDateColumnFilter', width: 150 },
      { field: 'completedAt', headerName: 'تاریخ اتمام', filter: 'agDateColumnFilter', width: 150 }
    ];

    options.getRowNodeId = (data: any) => data.guid;
    this.setupGridInteractions(options);
  }

  private setupGridInteractions(options: any): void {
    options.rowStyle = { cursor: 'pointer' };
    options.onCellClicked = (event: any) => {
      if (event.colDef.colId !== 'actions' && event.data) {
        this.viewResponseDetail(event.data.guid);
      }
    };
    options.context = { componentParent: this };
  }

  private loadResponses(): void {
    this.loading.set(true);

    const searchRequest: ResponseSearchRequest = {
      surveyGuid: this.surveyGuid(),
      pageNumber: 1,
      pageSize: 1000
    };

    this.responseService.searchResponses(searchRequest)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Error loading responses:', error);
          this.toastService.error('خطا در بارگذاری پاسخ‌ها');
          return of([]);
        })
      )
      .subscribe((data: ResponseListDto[]) => {
        this.responses.set(data);
        this.loading.set(false);
      });
  }

  viewResponseDetail(responseGuid: string): void {
    this.router.navigate(['/responses/detail', responseGuid]);
  }

  async askForDelete(id: string): Promise<void> {
    try {
      const result = await this.fireDeleteSwal();
      if (result.value === true) {
        this.responseService.deleteResponse(id)
          .pipe(
            takeUntilDestroyed(this.destroyRef),
            catchError(() => {
              this.toastService.error('خطا در حذف پاسخ');
              return of(null);
            })
          )
          .subscribe(() => {
            this.fireDeleteSucceededSwal();
            this.loadResponses();
          });
      }
    } catch (error) {
      console.error('Error in delete operation:', error);
    }
  }

  async exportResponses(): Promise<void> {
    const surveyGuid = this.surveyGuid();
    if (!surveyGuid) {
      this.toastService.error('شناسه نظرسنجی مشخص نیست');
      return;
    }

    this.loading.set(true);

    try {
      this.responseService.exportResponses(surveyGuid)
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          catchError((error) => {
            console.error('Error exporting responses:', error);
            this.toastService.error('خطا در خروجی گرفتن');
            return of(null as Blob | null);
          })
        )
        .subscribe((blob) => {
          const fileBlob = blob as Blob | null;
          if (fileBlob) {
            const url = window.URL.createObjectURL(fileBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `responses_${surveyGuid}_${Date.now()}.xlsx`;
            link.click();
            window.URL.revokeObjectURL(url);
            this.toastService.success('خروجی با موفقیت دانلود شد');
          }
          this.loading.set(false);
        });
    } catch (error) {
      console.error('Error in export:', error);
      this.loading.set(false);
    }
  }

  backToSurveys(): void {
    this.router.navigate(['/surveys/list']);
  }
}