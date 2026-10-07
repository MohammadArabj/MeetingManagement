import {
  Component,
  DestroyRef,
  ElementRef,
  SimpleChanges,
  computed,
  effect,
  inject,
  input,
  untracked,
  output,
  signal,
  viewChild,
  OutputEmitterRef,
  OnInit,
  OnChanges,
} from '@angular/core';
import { ReactiveFormsModule, FormsModule, FormArray, FormBuilder, FormControl, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import moment from 'jalali-moment';
import { NgOptionComponent, NgSelectComponent } from '@ng-select/ng-select';
import { NgStyle, SlicePipe } from '@angular/common';

import { Subject } from 'rxjs';

import { CustomInputComponent } from '../../../../../shared/custom-controls/custom-input';
import { CustomSelectComponent } from '../../../../../shared/custom-controls/custom-select';

import { Resolution } from '../../../../../core/models/Resolution';
import { SystemUser } from '../../../../../core/models/User';
import { ComboBase } from '../../../../../shared/combo-base';
import { base64ToArrayBuffer, fixPersianDigits, MeetingType, normalizePersian } from '../../../../../core/types/configuration';

import { environment } from '../../../../../../environments/environment';

import { ToastService } from '../../../../../services/framework-services/toast.service';
import { MeetingService } from '../../../../../services/meeting.service';
import { ResolutionService } from '../../../../../services/resolution.service';
import { FileMeetingService } from '../../../../../services/file-meeting.service';
import { AgendaService } from '../../../../../services/agenda.service';
import { FileService } from '../../../../../services/file.service';
import { MeetingBehaviorService } from '../../meeting-behavior-service';
import { TusUploadService, UploadStatus } from '../../../../../services/framework-services/tus-upload.service';
import { AppSettings } from '../../../../../services/system-setting.service';

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

type FileKind = 'pdf' | 'loading' | 'unknown';

type FileScope = 'agenda' | 'resolution';

interface FileItem {
  id: number;
  name: string;
  url: string;
  type: FileKind;

  size?: number;
  sizeFormatted?: string;
  uploadDate?: string;

  guid?: string;
  fileGuid?: string;

  isRemoved?: boolean;
  isLazyLoaded?: boolean;
  isUploading?: boolean;
  uploadProgress?: number;

  scope: FileScope;

  agendaText?: string;
  agendaIndex?: number;

  isBlobUrl?: boolean;
}

interface UserWithPosition {
  userGuid: string;
  userName: string;
  positionGuid: string | null;
  positionTitle: string;
  personalNo: string;
  uniqueKey: string;
}

interface ResolutionFileDto {
  id: number;
  isRemoved: boolean;
  fileGuid: string;
}

interface ActorItemDto {
  id: number;
  userGuid: string;
  positionGuid: string | null;
  isRemoved: boolean;
}

interface AssignmentItemDto {
  actors: ActorItemDto[];
  follower: ActorItemDto;
  type: string;
  dueDate: string;
}

interface BoardAssignmentItemDto {
  actors: ActorItemDto[];
  followerGuid: string;
  followerPositionGuid: string;
  dueDate: string;
  status?: string;
  result?: string;
  description?: string;
  isRemoved: boolean;
}

interface CreateResolutionDto {
  id?: number;
  description: string;
  meetingGuid: string;
  files: ResolutionFileDto[];
  assignments: AssignmentItemDto[];
}

interface CreateResolutionBoardMeetingDto {
  id?: number;
  title: string;
  number?: string;
  description?: string;
  decisionsMade?: string;
  documentation?: string;
  contractNumber?: string;
  approvedPrice?: number;
  meetingGuid: string;
  parentMeetingGuid?: string;
  parentResolutionId?: number;
  committeeMeetingGuid?: string;
  committeeResolutionId?: number;
  files: ResolutionFileDto[];
  items: BoardAssignmentItemDto[];
}

@Component({
  selector: 'app-resolution-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    CustomInputComponent,
    CustomSelectComponent,
    NgSelectComponent,
    NgOptionComponent,
    NgStyle,
    SlicePipe,
  ],
  templateUrl: './resolution-form.html',
  styleUrl: './resolution-form.css',
})
export class ResolutionFormComponent implements OnInit, OnChanges {
  private destroy$ = new Subject<void>();

  hasRemovedFiles(): boolean {
    return this._resolutionFiles().some(f => f.isRemoved === true);
  }

  // ═══════════════════════════════════════════════════════════
  // DI
  // ═══════════════════════════════════════════════════════════
  private readonly fb = inject(FormBuilder);
  // ✅ FIX: حذف duplicate injection - فقط یک سرویس toast نگه داشتیم
  private readonly toast = inject(ToastService);
  private readonly meetingService = inject(MeetingService);
  private readonly resolutionService = inject(ResolutionService);
  private readonly fileMeetingService = inject(FileMeetingService);
  private readonly meetingBehaviorService = inject(MeetingBehaviorService);
  private readonly agendaService = inject(AgendaService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly meetingBehavior = inject(MeetingBehaviorService);
  private readonly tus = inject(TusUploadService);

  // ═══════════════════════════════════════════════════════════
  // Inputs
  // ═══════════════════════════════════════════════════════════
  readonly isEditingResolution = input<boolean>(false);
  readonly selectedResolution = input<Resolution | null>(null);
  readonly meetingGuid = input<any>();
  readonly resolutionNumber = input<number>();
  readonly meetingDate = input<Date | string | null>(null);
  readonly meetingType = input<'regular' | 'board'>('regular');
  readonly users = input<ComboBase[]>([]);
  readonly positions = input<ComboBase[]>([]);
  readonly assignmentTypes = input<ComboBase[]>([]);
  readonly userList = input<SystemUser[]>([]);
  /**
   * ✅ FIX: شمارنده باز شدن مودال. والد در هر بار باز کردن آن را افزایش می‌دهد تا فرم
   * همیشه از حالت تمیز شروع شود. قبلاً اگر مودال با Esc بسته می‌شد، حالت ویرایش قبلی
   * (حتی id مصوبه!) در فرم «ثبت جدید» باقی می‌ماند و مصوبه اشتباهی ویرایش می‌شد.
   */
  readonly openToken = input<number>(0);

  /** ✅ FIX: جلوگیری از ارسال تکراری (دابل‌کلیک) و قفل دکمه تا پایان درخواست */
  private readonly _isSaving = signal(false);
  readonly isSaving = this._isSaving.asReadonly();

  // Outputs
  readonly resolutionSaved: OutputEmitterRef<void> = output<void>();
  readonly modalClosed: OutputEmitterRef<void> = output<void>();
  readonly filesUploaded = output<any>();

  // ViewChildren
  readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  readonly assignmentsContainer = viewChild<ElementRef>('assignmentsContainer');

  // ═══════════════════════════════════════════════════════════
  // UI lists
  // ═══════════════════════════════════════════════════════════
  readonly actionStatusList = [
    { guid: '1', title: 'در انتظار اقدام' },
    { guid: '2', title: 'در حال انجام' },
    { guid: '3', title: 'پایان یافته' },
  ];

  readonly assignmentResultList = [
    { guid: '1', title: 'انجام شده' },
    { guid: '2', title: 'انجام نشده' },
  ];

  // ═══════════════════════════════════════════════════════════
  // Forms
  // ═══════════════════════════════════════════════════════════
  regularResolutionForm!: FormGroup;
  boardResolutionForm!: FormGroup;

  previousMeetings: ComboBase[] = [];
  previousCommitteMeetings: ComboBase[] = [];

  // ═══════════════════════════════════════════════════════════
  // State (Signals)
  // ═══════════════════════════════════════════════════════════
  readonly _resolutionFiles = signal<FileItem[]>([]);
  private readonly _agendaFiles = signal<FileItem[]>([]);

  private readonly _selectedFileId = signal<number | null>(null);
  private readonly _pdfUrl = signal<SafeResourceUrl | null>(null);

  private readonly _loadingAgendaFiles = signal<boolean>(false);
  private readonly _isUploading = signal<boolean>(false);
  private readonly _uploadProgress = signal<number>(0);

  private readonly _isPastMeeting = signal<boolean>(false);

  private readonly _previousResolutions = signal<ComboBase[] | null>(null);
  private readonly _previousCommitteResolutions = signal<ComboBase[] | null>(null);

  private readonly _agendas = signal<any[]>([]);
  private readonly _actorGuidsControls = signal<FormControl[]>([]);
  private readonly _boardActorControls = signal<FormControl[]>([]);

  private _agendaLoadSeq = 0;

  // ═══════════════════════════════════════════════════════════
  // Readonly
  // ═══════════════════════════════════════════════════════════
  readonly selectedFileId = this._selectedFileId.asReadonly();
  readonly pdfUrl = this._pdfUrl.asReadonly();

  readonly loadingAgendaFiles = this._loadingAgendaFiles.asReadonly();
  readonly isUploading = this._isUploading.asReadonly();
  readonly uploadProgress = this._uploadProgress.asReadonly();

  readonly isPastMeeting = this._isPastMeeting.asReadonly();

  readonly previousResolutions = this._previousResolutions.asReadonly();
  readonly previousCommitteResolutions = this._previousCommitteResolutions.asReadonly();

  readonly agendas = this._agendas.asReadonly();
  readonly actorGuidsControls = this._actorGuidsControls.asReadonly();
  readonly boardActorControls = this._boardActorControls.asReadonly();

  // ═══════════════════════════════════════════════════════════
  // Computeds
  // ═══════════════════════════════════════════════════════════
  readonly isBoardMeeting = computed(() => this.meetingType() === 'board' || this.meetingType() === (MeetingType as any).BOARD);
  readonly isRegularMeeting = computed(() => this.meetingType() === 'regular' || this.meetingType() === (MeetingType as any).REGULAR);

  readonly currentMeeting = computed(() => this.meetingBehavior.meeting());
  readonly meetingNumber = computed(() => this.currentMeeting()?.number || '');

  readonly uploadFolder = computed(() => {
    const m = this.currentMeeting();
    return m?.number ? `${m.number}{{Folder}}مصوبات` : 'Meeting{{Folder}}Resolutions{{Folder}}Temp';
  });

  // ✅ FIX 1: شماره نمایشی مصوبه - در ویرایش از res.number استفاده می‌شود، در ثبت از input
  readonly displayResolutionNumber = computed(() => {
    if (this.isEditingResolution()) {
      const res = this.selectedResolution() as any;
      // اول از فیلد number مدل، در صورت نبود از input
      return res?.number ?? this.resolutionNumber();
    }
    return this.resolutionNumber();
  });

  readonly usersWithPositions = computed<UserWithPosition[]>(() => {
    const list = this.userList();
    const res: UserWithPosition[] = [];

    list.forEach(user => {
      if (user.positions?.length) {
        user.positions.forEach(p => {
          res.push({
            userGuid: user.guid,
            userName: user.name,
            positionGuid: p.positionGuid,
            positionTitle: p.positionTitle || '',
            personalNo: user.userName || '',
            uniqueKey: `${user.guid}_${p.positionGuid}`,
          });
        });
      } else {
        res.push({
          userGuid: user.guid,
          userName: user.name,
          positionGuid: '',
          positionTitle: 'بدون سمت',
          personalNo: user.userName || '',
          uniqueKey: `${user.guid}_empty`,
        });
      }
    });

    return res;
  });

  readonly agendaFiles = computed(() => this._agendaFiles().filter(f => !f.isRemoved && f.type !== 'loading'));
  readonly resolutionFiles = computed(() => this._resolutionFiles().filter(f => !f.isRemoved && f.type !== 'loading'));

  readonly hasAgendaFiles = computed(() => this.agendaFiles().length > 0);
  readonly fileCount = computed(() => this.agendaFiles().length + this.resolutionFiles().length);
  readonly allFiles = computed(() => [...this.agendaFiles(), ...this.resolutionFiles()]);

  // ═══════════════════════════════════════════════════════════
  // ctor
  // ═══════════════════════════════════════════════════════════
  constructor() {
    this.initForms();
    this.setupEffects();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Optional
  }

  ngOnInit(): void {
    const md = this.meetingDate();
    if (md) this.checkIfPastMeeting(md);

    if (this.isBoardMeeting()) {
      this.meetingService.getParentMeetings()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((data: any) => {
          this.previousMeetings = (data || [])
            .filter((m: any) => m.guid !== this.meetingGuid())
            .map((m: any) => ({ guid: m.guid, title: m.title }));
        });

      this.meetingService.getListByCategoryGuid(AppSettings.committeeCategoryGuid)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((data: any) => {
          this.previousCommitteMeetings = (data || [])
            .map((m: any) => ({ guid: m.guid, title: m.title }));
        });
    }

    if (!this.isEditingResolution() && this.isRegularMeeting()) {
      setTimeout(() => {
        if (this.regularAssignments().length === 0) this.addNewRegularAssignment(true);
      }, 0);
    }
  }

  selectAllMembersForAssignment(index: number): void {
    const members = this.meetingBehaviorService.members() || [];
    const usersWithPos = this.usersWithPositions();

    if (!members.length) {
      this.toast.warning('هیچ عضوی برای جلسه یافت نشد');
      return;
    }

    if (!usersWithPos.length) {
      this.toast.warning('هیچ کاربری با سمت برای انتخاب وجود ندارد');
      return;
    }

    const memberKeys = new Set<string>();

    members.forEach(member => {
      if (member.isRemoved) return;
      if (!member.userGuid) return;

      if (member.positionGuid) {
        const key = `${member.userGuid}_${member.positionGuid}`;
        const existsInUsers = usersWithPos.some(u => u.uniqueKey === key);
        if (existsInUsers) {
          memberKeys.add(key);
        }
      } else {
        usersWithPos
          .filter(u => u.userGuid === member.userGuid)
          .forEach(u => memberKeys.add(u.uniqueKey));
      }
    });

    if (memberKeys.size === 0) {
      this.toast.warning('هیچ عضو معتبری برای انتخاب در این جلسه یافت نشد');
      return;
    }

    const allKeys = Array.from(memberKeys);

    const actorControls = this._actorGuidsControls();
    if (actorControls[index]) {
      actorControls[index].setValue(allKeys);
    }

    this.onActorGuidsChange(allKeys, index);

    this.toast.success(`${allKeys.length} عضو جلسه انتخاب شد`);
  }

  // ═══════════════════════════════════════════════════════════
  // Forms init
  // ═══════════════════════════════════════════════════════════
  private initForms(): void {
    this.boardResolutionForm = this.fb.group({
      id: [''],
      number: [''], // جدید
      title: ['', Validators.required],
      description: [''],
      parentMeetingGuid: [''],
      parentResolutionId: [''],
      approvedPrice: [''],
      committeeMeetingGuid: [''],
      committeeResolutionId: [''],
      contractNumber: [''],
      documentation: [''],
      decisionsMade: [''],
      boardAssignments: this.fb.array([]),
    });

    this.regularResolutionForm = this.fb.group({
      id: [''],
      description: ['', Validators.required],
      regularAssignments: this.fb.array([]),
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Effects
  // ═══════════════════════════════════════════════════════════
  private setupEffects(): void {
    // ✅ بارگذاری agenda فقط در حالت create
    effect(() => {
      const mg = this.meetingGuid();
      const editing = this.isEditingResolution();

      if (mg && !editing) {
        this.loadAgendaFiles();
      }
    });

    // ✅ با هر بار باز شدن مودال (openToken) یا تغییر مصوبه انتخاب‌شده، فرم بازسازی می‌شود
    effect(() => {
      const token = this.openToken();
      const res = this.selectedResolution();
      const editing = this.isEditingResolution();

      untracked(() => {
        this._isSaving.set(false);
        if (editing && res) {
          queueMicrotask(() => this.patchFormForEdit());
        } else if (token > 0) {
          queueMicrotask(() => this.resetForm());
        }
      });
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════
  private checkIfPastMeeting(meetingDate: Date | string): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const m = new Date(meetingDate);
    m.setHours(0, 0, 0, 0);
    this._isPastMeeting.set(m < today);
  }

  private buildUniqueKey(userGuid: string, positionGuid?: string | null): string {
    const pg = (positionGuid ?? '').toString().trim();
    return `${userGuid}_${pg !== '' ? pg : 'empty'}`;
  }

  private normalizeValue(v: any): string {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') return (v.guid ?? v.value ?? v.id ?? '').toString();
    return v.toString();
  }

  private normalizeBoardResult(raw: any): string {
    const r = this.normalizeValue(raw);
    if (r === '1' || r === '2') return r;
    if (r === 'Done') return '1';
    if (r === 'NotDone') return '2';
    return '';
  }

  private normalizeBoardStatus(rawStatus: any, rawResult: any): { status: string; result: string } {
    const s = this.normalizeValue(rawStatus);
    const r = this.normalizeValue(rawResult);

    if (s === 'Done' || s === 'NotDone') {
      return { status: '3', result: s === 'Done' ? '1' : '2' };
    }

    if (['1', '2', '3'].includes(s)) {
      return { status: s, result: this.normalizeBoardResult(r) };
    }

    const sl = s.toLowerCase();
    if (sl === 'inprogress') return { status: '2', result: this.normalizeBoardResult(r) };
    if (sl === 'pending' || sl === 'waiting') return { status: '1', result: this.normalizeBoardResult(r) };
    if (sl === 'end' || sl === 'ended' || sl === 'completed') return { status: '3', result: this.normalizeBoardResult(r) };

    return { status: '1', result: this.normalizeBoardResult(r) };
  }

  formatFileSize(bytes: number): string {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // ═══════════════════════════════════════════════════════════
  // FormArray getters
  // ═══════════════════════════════════════════════════════════
  boardAssignments(): FormArray {
    return this.boardResolutionForm.get('boardAssignments') as FormArray;
  }

  regularAssignments(): FormArray {
    return this.regularResolutionForm.get('regularAssignments') as FormArray;
  }

  get boardAssignmentControls() {
    return (this.boardAssignments()?.controls as FormGroup[]) || [];
  }

  // ═══════════════════════════════════════════════════════════
  // Validators
  // ═══════════════════════════════════════════════════════════
  futureOrAfterMeetingDateValidator = (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;

    const fixed = fixPersianDigits(control.value);
    const g = moment(fixed, 'jYYYY/jMM/jDD').format('YYYY-MM-DD');
    const inputDate = new Date(g);

    const md = this.meetingDate();
    if (!md) return null;

    const mdStr = typeof md === 'string' ? md : md.toISOString();
    const mdFixed = fixPersianDigits(mdStr);
    const mdG = moment(mdFixed, 'jYYYY/jMM/jDD').format('YYYY-MM-DD');
    const meetingDateObj = new Date(mdG);

    return inputDate < meetingDateObj ? { beforeMeetingDate: true } : null;
  };

  // ═══════════════════════════════════════════════════════════
  // Agenda Loading
  // ═══════════════════════════════════════════════════════════
  private loadAgendaFiles(): void {
    const meetingGuid = this.meetingGuid();
    if (!meetingGuid) return;

    const seq = ++this._agendaLoadSeq;
    this._loadingAgendaFiles.set(true);

    this._agendaFiles.set([
      {
        id: -1,
        name: 'در حال بارگذاری فایل‌های دستور جلسه...',
        url: '',
        type: 'loading',
        scope: 'agenda',
      },
    ]);

    this.agendaService.getListBy(meetingGuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data: any[]) => {
          if (seq !== this._agendaLoadSeq) return;

          const agendas = data || [];
          this._agendas.set(agendas);

          const agendaFilesInfo: { agendaIndex: number; agendaText: string; fileGuid: string }[] = [];

          agendas.forEach((agenda: any, index: number) => {
            if (Array.isArray(agenda.files)) {
              agenda.files.forEach((f: any) => {
                const g = f.fileGuid;
                if (g && g !== '00000000-0000-0000-0000-000000000000') {
                  agendaFilesInfo.push({
                    agendaIndex: index + 1,
                    agendaText: agenda.text || `دستور جلسه ${index + 1}`,
                    fileGuid: g,
                  });
                }
              });
            } else if (agenda.fileGuid && agenda.fileGuid !== '00000000-0000-0000-0000-000000000000') {
              agendaFilesInfo.push({
                agendaIndex: index + 1,
                agendaText: agenda.text || `دستور جلسه ${index + 1}`,
                fileGuid: agenda.fileGuid,
              });
            }
          });

          if (agendaFilesInfo.length === 0) {
            this._agendaFiles.set([]);
            this._loadingAgendaFiles.set(false);
            return;
          }

          const fileGuids = agendaFilesInfo.map(x => x.fileGuid);

          this.tus.getMetas(fileGuids)
            .then((metas: any[]) => {
              if (seq !== this._agendaLoadSeq) return;

              const items: FileItem[] = agendaFilesInfo.map((info, idx) => {
                const meta = metas.find((m: any) => m?.guid?.toLowerCase() === info.fileGuid.toLowerCase());
                const previewUrl = meta?.path ? this.tus.buildFileUrl(meta.path) : '';

                return {
                  id: Number(`${Date.now()}${idx}`),
                  name: meta?.originalFileName || `فایل دستور ${info.agendaIndex}`,
                  url: previewUrl,
                  type: 'pdf',
                  scope: 'agenda',

                  size: meta?.fileSize || 0,
                  sizeFormatted: this.formatFileSize(meta?.fileSize || 0),
                  uploadDate: meta?.createdAt
                    ? new Date(meta.createdAt).toLocaleDateString('fa-IR')
                    : new Date().toLocaleDateString('fa-IR'),

                  guid: info.fileGuid,
                  fileGuid: info.fileGuid,
                  isLazyLoaded: !previewUrl,

                  agendaText: info.agendaText,
                  agendaIndex: info.agendaIndex,
                };
              });

              this._agendaFiles.set(items);
            })
            .catch(err => {
              console.error('Error loading agenda metas:', err);
              if (seq !== this._agendaLoadSeq) return;

              const fallback: FileItem[] = agendaFilesInfo.map((info, idx) => ({
                id: Number(`${Date.now()}${idx}`),
                name: `فایل دستور ${info.agendaIndex}`,
                url: '',
                type: 'pdf',
                scope: 'agenda',

                guid: info.fileGuid,
                fileGuid: info.fileGuid,
                isLazyLoaded: true,

                agendaText: info.agendaText,
                agendaIndex: info.agendaIndex,
              }));

              this._agendaFiles.set(fallback);
            })
            .finally(() => {
              if (seq === this._agendaLoadSeq) this._loadingAgendaFiles.set(false);
            });
        },
        error: (err) => {
          console.error('Error loading agendas:', err);
          if (seq !== this._agendaLoadSeq) return;
          this._agendaFiles.set([]);
          this._loadingAgendaFiles.set(false);
          this.toast.error('خطا در بارگذاری فایل‌های دستور جلسه');
        },
      });
  }

  private async loadAgendaFileOnDemand(file: FileItem): Promise<void> {
    const fileGuid = file.guid || file.fileGuid;
    if (!fileGuid) {
      this.toast.error('شناسه فایل یافت نشد');
      return;
    }

    if (file.url && !file.isLazyLoaded) {
      this.showPdfPreview(file.url, file.name);
      return;
    }

    this.toast.info('در حال بارگذاری فایل...');

    try {
      const metas = await this.tus.getMetas([fileGuid]);
      const meta = metas?.[0];

      if (!meta?.path) {
        this.toast.error('فایل یافت نشد');
        return;
      }

      const url = this.tus.buildFileUrl(meta.path);

      this._agendaFiles.update(list =>
        list.map(f => f.id === file.id
          ? {
            ...f,
            url,
            name: meta.originalFileName || f.name,
            size: meta.fileSize || f.size,
            sizeFormatted: this.formatFileSize(meta.fileSize || 0),
            isLazyLoaded: false,
          }
          : f
        )
      );

      this.showPdfPreview(url, meta.originalFileName || file.name);
    } catch (e) {
      console.error('Error loading agenda file on demand:', e);
      this.toast.error('خطا در بارگذاری فایل');
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Resolution files (TUS)
  // ═══════════════════════════════════════════════════════════
  triggerFileInput(): void {
    this.fileInput()?.nativeElement?.click();
  }

  handleDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement)?.classList.add('dragover');
  }

  handleDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement)?.classList.remove('dragover');
  }

  handleDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement)?.classList.remove('dragover');
    const files = Array.from(event.dataTransfer?.files || []);
    this.processFiles(files);
  }

  handleFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    this.processFiles(files);
    input.value = '';
  }

  async processFiles(files: File[]): Promise<void> {
    const pdfFiles = files.filter(f => f.type === 'application/pdf');
    const invalid = files.filter(f => f.type !== 'application/pdf');

    if (invalid.length) this.toast.error('فقط فایل‌های PDF پذیرفته می‌شوند');

    for (const f of pdfFiles) {
      await this.uploadFileWithTus(f);
    }
  }

  private async uploadFileWithTus(file: File): Promise<void> {
    const localId = Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`);
    const localUrl = URL.createObjectURL(file);

    const localItem: FileItem = {
      id: localId,
      name: file.name,
      url: localUrl,
      type: 'pdf',
      scope: 'resolution',

      size: file.size,
      sizeFormatted: this.formatFileSize(file.size),
      uploadDate: new Date().toLocaleDateString('fa-IR'),

      isUploading: true,
      uploadProgress: 0,

      isBlobUrl: true,
    };

    this._resolutionFiles.update(cur => [...cur, localItem]);
    this._isUploading.set(true);

    try {
      const added = this.tus.addFiles([file], {
        maxSizeMB: 50,
        acceptedTypes: ['application/pdf'],
        localPreview: false,
      });

      if (!added.length) throw new Error('فایل به صف آپلود اضافه نشد');

      const tusItem = added[0];

      const progressTimer = setInterval(() => {
        const current = this.tus.filesMap().get(tusItem.id);
        if (!current) return;

        this._resolutionFiles.update(list =>
          list.map(x => x.id === localId
            ? { ...x, uploadProgress: current.progress }
            : x
          )
        );

        if (current.status === UploadStatus.Completed || current.status === UploadStatus.Failed) {
          clearInterval(progressTimer);
        }
      }, 100);

      const guid = await this.tus.uploadFile(tusItem.id, {
        folderPath: this.uploadFolder(),
        description: 'فایل مصوبه',
      });

      clearInterval(progressTimer);

      if (!guid) throw new Error('آپلود ناموفق بود');

      this._resolutionFiles.update(list =>
        list.map(x => x.id === localId
          ? { ...x, fileGuid: guid, isUploading: false, uploadProgress: 100 }
          : x
        )
      );

      this.toast.success('فایل با موفقیت آپلود شد');

    } catch (e: any) {
      console.error('Error uploading file:', e);

      const item = this._resolutionFiles().find(x => x.id === localId);
      if (item?.isBlobUrl && item.url?.startsWith('blob:')) {
        URL.revokeObjectURL(item.url);
      }

      this._resolutionFiles.update(list => list.filter(x => x.id !== localId));
      this.toast.error(`خطا در آپلود فایل: ${e?.message || 'نامشخص'}`);

    } finally {
      const stillUploading = this._resolutionFiles().some(x => x.isUploading);
      this._isUploading.set(stillUploading);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PDF Preview
  // ═══════════════════════════════════════════════════════════
  showPdfPreview(url: string, name: string): void {
    const pdfPanel = document.getElementById('pdfPanel');
    const mainContainer = document.getElementById('mainContainer');

    this._pdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));

    const title = document.getElementById('pdf-title');
    if (title) title.innerHTML = name;

    pdfPanel?.classList.remove('hidden');
    mainContainer?.classList.remove('no-pdf');
  }

  hidePdfPreview(): void {
    const pdfPanel = document.getElementById('pdfPanel');
    const mainContainer = document.getElementById('mainContainer');

    this._pdfUrl.set(null);
    pdfPanel?.classList.add('hidden');
    mainContainer?.classList.add('no-pdf');
    this._selectedFileId.set(null);
  }

  removeRegularAssignment(index: number): void {
    const assignments = this.regularAssignments();
    if (index < 0 || index >= assignments.length) return;

    const isEditing = this.isEditingResolution();

    if (!isEditing) {
      assignments.removeAt(index);
      this._actorGuidsControls.update(controls => {
        const newControls = [...controls];
        if (newControls[index]) {
          newControls.splice(index, 1);
        }
        return newControls;
      });
    } else {
      const assignment = assignments.at(index);
      if (!assignment) return;

      const actors = assignment.get('actors')?.value || [];
      actors.forEach((actor: any) => {
        actor.isRemoved = true;
      });

      assignment.get('actors')?.setValue(actors);
      assignment.get('isRemoved')?.setValue(true);

      assignment.get('actors')?.clearValidators();
      assignment.get('type')?.clearValidators();
      assignment.get('followerGuid')?.clearValidators();
      assignment.get('followerUniqueKey')?.clearValidators();
      assignment.get('dueDate')?.clearValidators();

      assignment.get('actors')?.updateValueAndValidity();
      assignment.get('type')?.updateValueAndValidity();
      assignment.get('followerGuid')?.updateValueAndValidity();
      assignment.get('followerUniqueKey')?.updateValueAndValidity();
      assignment.get('dueDate')?.updateValueAndValidity();

      const actorControls = this._actorGuidsControls();
      if (actorControls[index]) {
        actorControls[index].setValue([]);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Select file
  // ═══════════════════════════════════════════════════════════
  selectFile(fileId: number): void {
    this._selectedFileId.set(fileId);

    const a = this._agendaFiles().find(x => x.id === fileId);
    if (a) {
      if (a.type === 'loading') return;
      if (a.isLazyLoaded || !a.url) {
        this.loadAgendaFileOnDemand(a);
      } else {
        this.showPdfPreview(a.url, a.name);
      }
      return;
    }

    const r = this._resolutionFiles().find(x => x.id === fileId);
    if (!r) return;

    if (r.url) this.showPdfPreview(r.url, r.name);
  }

  // ═══════════════════════════════════════════════════════════
  // Patch edit mode
  // ═══════════════════════════════════════════════════════════
  private patchFormForEdit(): void {
    const res = this.selectedResolution();
    if (!res) return;

    this.resetFormSilently();

    if (this.isBoardMeeting()) {
      this.boardResolutionForm.patchValue({
        id: res.id,
        title: res.title || '',
        number: res.number || '',
        description: res.text || '',
        parentResolutionId: res.parentResolutionId || '',
        committeeMeetingGuid: res.committeeMeetingGuid || '',
        committeeResolutionId: res.committeeResolutionId || '',
        approvedPrice: res.approvedPrice || '',
        contractNumber: res.contractNumber || '',
        documentation: res.documentation || '',
        decisionsMade: res.decisionsMade || '',
      });

      setTimeout(() => this.loadExistingBoardAssignments(), 0);
    } else {
      this.regularResolutionForm.patchValue({
        id: res.id,
        description: res.text || '',
      });

      setTimeout(() => this.loadExistingRegularAssignments(), 0);
    }

    setTimeout(() => this.loadExistingResolutionFiles(), 0);
  }

  private resetFormSilently(): void {
    this.boardResolutionForm.reset();
    this.regularResolutionForm.reset();

    this._resolutionFiles().forEach(f => {
      if (f.isBlobUrl && f.url?.startsWith('blob:')) URL.revokeObjectURL(f.url);
    });

    this.boardAssignments().clear();
    this.regularAssignments().clear();

    this._resolutionFiles.set([]);

    this._selectedFileId.set(null);
    this._pdfUrl.set(null);
    this._uploadProgress.set(0);
    this._actorGuidsControls.set([]);
    this._boardActorControls.set([]);

    this.hidePdfPreview();
  }

  // ═══════════════════════════════════════════════════════════
  // Existing resolution files (edit)
  // ═══════════════════════════════════════════════════════════
  private loadExistingResolutionFiles(): void {
    const res = this.selectedResolution();
    if (!res?.id) return;

    this._resolutionFiles.set([
      {
        id: -2,
        name: 'در حال بارگذاری فایل‌ها...',
        url: '',
        type: 'loading',
        scope: 'resolution',
      },
    ]);

    this.fileMeetingService.getFiles(res.id, 'Resolution')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (files: any) => {
          this._resolutionFiles.update(cur => cur.filter(x => x.id !== -2));

          if (!files?.length) return;

          const fileGuids = files
            .map((f: any) => f.fileGuid)
            .filter((g: string) => g && g !== '00000000-0000-0000-0000-000000000000');

          if (!fileGuids.length) return;

          this.tus.getMetas(fileGuids)
            .then((metas: any[]) => {
              const processed: FileItem[] = files.map((f: any, idx: number) => {
                const meta = metas.find((m: any) => m?.guid?.toLowerCase() === f.fileGuid?.toLowerCase());
                const previewUrl = meta?.path ? this.tus.buildFileUrl(meta.path) : '';

                return {
                  id: f.id || Number(`${Date.now()}${idx}`),
                  name: meta?.originalFileName || meta?.name || `فایل ${idx + 1}`,
                  url: previewUrl,
                  type: 'pdf',
                  scope: 'resolution',

                  size: meta?.fileSize || 0,
                  sizeFormatted: this.formatFileSize(meta?.fileSize || 0),
                  uploadDate: meta?.createdAt
                    ? new Date(meta.createdAt).toLocaleDateString('fa-IR')
                    : new Date().toLocaleDateString('fa-IR'),

                  guid: f.fileGuid,
                  fileGuid: f.fileGuid,
                  isLazyLoaded: !previewUrl,
                  isRemoved: false,
                };
              });

              this._resolutionFiles.update(cur => [...cur, ...processed]);
            })
            .catch(err => {
              console.error('Error loading file metas:', err);
              this.toast.warning('برخی اطلاعات فایل‌ها بارگذاری نشد');

              const fallback: FileItem[] = files.map((f: any, idx: number) => ({
                id: f.id || Number(`${Date.now()}${idx}`),
                name: `فایل ${idx + 1}`,
                url: '',
                type: 'pdf',
                scope: 'resolution',
                guid: f.fileGuid,
                fileGuid: f.fileGuid,
                isLazyLoaded: true,
                isRemoved: false,
              }));

              this._resolutionFiles.update(cur => [...cur, ...fallback]);
            });
        },
        error: (err) => {
          console.error('Error loading existing files:', err);
          this._resolutionFiles.update(cur => cur.filter(x => x.id !== -2));
          this.toast.error('خطا در بارگذاری فایل‌ها');
        },
      });
  }

  // ═══════════════════════════════════════════════════════════
  // Save
  // ═══════════════════════════════════════════════════════════
  saveResolution(): void {
    if (this._isSaving()) return;

    if (this._isUploading()) {
      this.toast.warning('لطفاً صبر کنید تا آپلود فایل‌ها تمام شود');
      return;
    }

    if (this.isBoardMeeting()) {
      if (this.boardResolutionForm.invalid) {
        this.boardResolutionForm.markAllAsTouched();
        this.boardAssignments().controls.forEach(c => c.markAllAsTouched());
        this.toast.error('لطفاً اطلاعات فرم را تکمیل کنید');
        return;
      }
      this.saveBoardResolution();
      return;
    }

    if (this.regularResolutionForm.invalid) {
      this.regularResolutionForm.markAllAsTouched();
      this.toast.error('لطفاً اطلاعات فرم را تکمیل کنید');
      return;
    }

    const hasValidAssignments = this.regularAssignments().controls.some(c => !c.get('isRemoved')?.value && c.valid);
    if (!hasValidAssignments) {
      this.regularAssignments().controls.forEach(c => c.markAllAsTouched());
      this.toast.error('حداقل یک تخصیص معتبر ضروری است');
      return;
    }

    this.saveRegularResolution();
  }

  private saveRegularResolution(): void {
    const form = this.regularResolutionForm;
    const id = form.get('id')?.value;

    const dto: CreateResolutionDto = {
      id: id || undefined,
      description: normalizePersian(form.get('description')?.value) || '',
      meetingGuid: this.meetingGuid(),
      files: this.buildFilesArray(),
      assignments: this.buildAssignmentsArray(),
    };

    this._isSaving.set(true);
    this.resolutionService.createOrEdit(dto)
      .pipe(finalize(() => this._isSaving.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.resolutionSaved.emit();
          this.resetForm();
        },
        // پیام خطا توسط HttpService/ErrorInterceptor نمایش داده شده؛ فرم دست‌نخورده می‌ماند تا کاربر اصلاح کند
        error: (err: any) => console.error('Error saving regular resolution:', err),
      });
  }

  private saveBoardResolution(): void {
    const v = this.boardResolutionForm.value;
    const dto: CreateResolutionBoardMeetingDto = {
      id: v.id || undefined,
      number: v.number || '',
      title: normalizePersian(v.title) || '',
      description: normalizePersian(v.description) || '',
      decisionsMade: normalizePersian(v.decisionsMade) || '',
      documentation: normalizePersian(v.documentation) || '',
      contractNumber: v.contractNumber || '',
      approvedPrice: v.approvedPrice ? parseFloat(v.approvedPrice) : undefined,
      meetingGuid: this.meetingGuid(),
      parentMeetingGuid: v.parentMeetingGuid || undefined,
      parentResolutionId: v.parentResolutionId || undefined,
      committeeMeetingGuid: v.committeeMeetingGuid || undefined,
      committeeResolutionId: v.committeeResolutionId || undefined,
      files: this.buildFilesArray(),
      items: this.buildBoardItemsArray(),
    };

    this._isSaving.set(true);
    this.resolutionService.createOrEditBoardMeeting(dto)
      .pipe(finalize(() => this._isSaving.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.resolutionSaved.emit();
          this.resetForm();
        },
        error: (err: any) => console.error('Error saving board resolution:', err),
      });
  }

  // ═══════════════════════════════════════════════════════════
  // Assignments - Regular
  // ═══════════════════════════════════════════════════════════
  addNewRegularAssignment(notCheck: boolean): void {
    if (!notCheck && this.regularAssignments().invalid) {
      this.regularAssignments().controls.forEach(c => c.markAllAsTouched());
      return;
    }

    const g = this.fb.group({
      actors: [[], Validators.required],
      type: ['', Validators.required],
      followerGuid: ['', Validators.required],
      followerPositionGuid: [''],
      followerUniqueKey: ['', Validators.required],
      dueDate: ['', [Validators.required, this.futureOrAfterMeetingDateValidator]],
      status: ['1'],
      result: [''],
      isRemoved: [false],
    });

    this.regularAssignments().push(g);
    this._actorGuidsControls.update(list => [...list, new FormControl([])]);
  }

  onActorGuidsChange(selectedItems: any[], index: number): void {
    const fa = this.regularAssignments();
    if (index < 0 || index >= fa.length) return;

    const fg = fa.at(index);
    if (!fg) return;

    const editing = this.isEditingResolution();

    const selectedKeys = new Set(
      (selectedItems || []).map((x: any) => typeof x === 'string' ? x : (x.uniqueKey || x))
    );

    const oldActors = fg.get('actors')?.value || [];

    if (selectedKeys.size === 0) {
      if (!editing) {
        fg.get('actors')?.setValue([]);
      } else {
        fg.get('actors')?.setValue(oldActors.map((a: any) => ({ ...a, isRemoved: true })));
      }
    } else {
      let newActors = oldActors.map((a: any) => {
        const key = `${a.actorGuid}_${a.actorPositionGuid}`;
        return { ...a, isRemoved: !selectedKeys.has(key) };
      });

      const usersWithPos = this.usersWithPositions();
      selectedKeys.forEach(key => {
        const exists = oldActors.some((a: any) => `${a.actorGuid}_${a.actorPositionGuid}` === key);
        if (exists) return;

        const u = usersWithPos.find(p => p.uniqueKey === key);
        if (!u) return;

        newActors.push({
          actorGuid: u.userGuid,
          actorPositionGuid: u.positionGuid,
          id: 0,
          isRemoved: false,
        });
      });

      fg.get('actors')?.setValue(newActors);
    }

    const activeKeys = (fg.get('actors')?.value || [])
      .filter((a: any) => !a.isRemoved)
      .map((a: any) => `${a.actorGuid}_${a.actorPositionGuid}`);

    const actorControls = this._actorGuidsControls();
    actorControls[index]?.setValue(activeKeys);

    fg.get('actors')?.markAsDirty();
    fg.get('actors')?.markAsTouched();
  }

  onFollowerChange(selectedItem: any, index: number): void {
    const fa = this.regularAssignments();
    if (index < 0 || index >= fa.length) return;

    const fg = fa.at(index);
    if (!fg) return;

    const key = typeof selectedItem === 'string' ? selectedItem : selectedItem.uniqueKey;
    const u = this.usersWithPositions().find(x => x.uniqueKey === key);

    if (!u) return;

    fg.patchValue({
      followerUniqueKey: key,
      followerGuid: u.userGuid,
      followerPositionGuid: u.positionGuid,
    });
  }

  private buildAssignmentsArray(): AssignmentItemDto[] {
    const arr = this.regularResolutionForm.get('regularAssignments')?.value || [];
    const result: AssignmentItemDto[] = [];

    arr.forEach((a: any) => {
      const validActors = (a.actors || []);
      if (!validActors.length) return;

      result.push({
        actors: validActors.map((x: any) => ({
          id: x.id || 0,
          userGuid: x.actorGuid,
          positionGuid: x.actorPositionGuid || null, // ✅ FIX: '' باعث خطای 400 در Guid سمت سرور می‌شد
          isRemoved: !!x.isRemoved,
        })),
        follower: {
          id: 0,
          userGuid: a.followerGuid,
          positionGuid: a.followerPositionGuid || null,
          isRemoved: false,
        },
        type: a.type,
        dueDate: a.dueDate,
      });
    });

    return result;
  }

  // ═══════════════════════════════════════════════════════════
  // Assignments - Board
  // ═══════════════════════════════════════════════════════════
  addBoardAssignment(notCheck: boolean): void {
    if (!notCheck && this.boardAssignments().invalid) {
      this.boardAssignments().controls.forEach(c => c.markAllAsTouched());
      return;
    }

    const g = this.fb.group({
      id: [0],
      actorUniqueKey: [[], Validators.required],
      actors: [[]],
      followerGuid: [AppSettings.boardSecretaryUserGuid || ''],
      followerPositionGuid: [AppSettings.boardPositionGuid || ''],
      dueDate: ['', Validators.required],
      status: ['1'],
      result: [''],
      description: [''],
      isRemoved: [false],
    });

    this.boardAssignments().insert(0, g);
    this.scrollToLatestAssignment();
  }

  onBoardActorsChange(assignmentIndex: number, selectedItems: any[]): void {
    const group = this.boardAssignments().at(assignmentIndex) as FormGroup;
    if (!group) return;

    const editing = this.isEditingResolution();
    const usersWithPos = this.usersWithPositions();

    const selectedKeys = new Set<string>((selectedItems || []).map(x => typeof x === 'string' ? x : (x.uniqueKey ?? x)));
    const oldActors: any[] = group.get('actors')?.value || [];

    let newActors = oldActors.map(a => {
      const key = this.buildUniqueKey(a.actorGuid, a.actorPositionGuid);
      return { ...a, isRemoved: !selectedKeys.has(key) };
    });

    selectedKeys.forEach(key => {
      const exists = oldActors.some(a => this.buildUniqueKey(a.actorGuid, a.actorPositionGuid) === key);
      if (exists) return;

      const u = usersWithPos.find(p => p.uniqueKey === key);
      if (!u) return;

      newActors.push({ id: 0, actorGuid: u.userGuid, actorPositionGuid: u.positionGuid, isRemoved: false });
    });

    if (!editing) newActors = newActors.filter(a => !a.isRemoved);

    group.get('actors')?.setValue(newActors, { emitEvent: false });

    const activeKeys = newActors.filter(a => !a.isRemoved).map(a => this.buildUniqueKey(a.actorGuid, a.actorPositionGuid));
    group.get('actorUniqueKey')?.setValue(activeKeys, { emitEvent: false });
  }

  private buildBoardItemsArray(): BoardAssignmentItemDto[] {
    const result: BoardAssignmentItemDto[] = [];

    this.boardAssignments().controls.forEach(ctrl => {
      const a = ctrl.value;
      if (!a.id && a.isRemoved) return;

      const actors = (a.actors || []).map((x: any) => ({
        id: x.id || 0,
        userGuid: x.actorGuid || '',
        positionGuid: x.actorPositionGuid || null, // ✅ FIX: '' باعث خطای 400 در Guid سمت سرور می‌شد
        isRemoved: !!x.isRemoved,
      }));

      result.push({
        actors,
        followerGuid: a.followerGuid || AppSettings.boardSecretaryUserGuid,
        followerPositionGuid: a.followerPositionGuid || AppSettings.boardPositionGuid,
        dueDate: a.dueDate || '',
        status: a.status || '1',
        result: a.result || '',
        description: a.description || '',
        isRemoved: !!a.isRemoved,
      });
    });

    return result;
  }

  private loadExistingBoardAssignments(): void {
    const res = this.selectedResolution();
    if (!res?.id || !res.assignments) return;

    const fa = this.boardAssignments();
    fa.clear();

    // ✅ FIX 3: کلید گروه‌بندی شامل follower هم میشه
    // قبلاً فقط dueDate+status+result+description بود - چند actor با همون dueDate
    // اما follower متفاوت، اشتباه گروه‌بندی می‌شدند.
    // حالا با اضافه کردن followerGuid+followerPositionGuid به کلید،
    // هر مجموعه‌ی actor که واقعاً یک assignment هستند درست گروه می‌شوند.
    const grouped = res.assignments.reduce((acc: any, a: any) => {
      const followerGuid = a.followerGuid || AppSettings.boardSecretaryUserGuid || '';
      const followerPositionGuid = a.followerPositionGuid || AppSettings.boardPositionGuid || '';

      const key = [
        followerGuid,
        followerPositionGuid,
        a.dueDate || '',
        a.status || '',
        a.result || '',
        a.description || '',
      ].join('|');

      if (!acc[key]) {
        acc[key] = {
          actors: [],
          dueDate: a.dueDate,
          status: a.status,
          result: a.result,
          description: a.description || '',
          followerGuid,
          followerPositionGuid,
        };
      }
      acc[key].actors.push({
        id: a.id,
        actorGuid: a.actorGuid || '',
        actorPositionGuid: a.actorPositionGuid || '',
        isRemoved: false,
      });
      return acc;
    }, {});

    Object.values(grouped).forEach((g: any) => {
      const actorKeys = (g.actors || [])
        .filter((x: any) => !x.isRemoved)
        .map((x: any) => this.buildUniqueKey(x.actorGuid, x.actorPositionGuid));

      const normalized = this.normalizeBoardStatus(g.status, g.result);

      const fg = this.fb.group({
        id: [g.actors?.[0]?.id || 0],
        actorUniqueKey: [actorKeys, Validators.required],
        actors: [g.actors, Validators.required],
        followerGuid: [g.followerGuid],
        followerPositionGuid: [g.followerPositionGuid],
        dueDate: [g.dueDate, Validators.required],
        status: [normalized.status],
        result: [normalized.result],
        description: [g.description],
        isRemoved: [false],
      });

      fa.push(fg);
      this.onBoardActorsChange(fa.length - 1, actorKeys);

      if (normalized.status !== '3') fg.get('result')?.setValue('', { emitEvent: false });
    });
  }

  private loadExistingRegularAssignments(): void {
    const res = this.selectedResolution();
    if (!res?.id || !Array.isArray((res as any).assignments)) return;

    const fa = this.regularAssignments();
    fa.clear();
    this._actorGuidsControls.set([]);

    const assignments: any[] = (res as any).assignments || [];

    const map = new Map<string, any>();

    for (const a of assignments) {
      const type = this.normalizeValue(a.assignmentType || '');
      const dueDate = this.normalizeValue(a.dueDate || a.due || '');
      const followerGuid = this.normalizeValue(a.followerGuid || a.followerUserGuid || '');
      const followerPositionGuid = this.normalizeValue(a.followerPositionGuid || a.followerPosGuid || '');
      const status = this.normalizeValue(a.status || '1') || '1';
      const result = this.normalizeValue(a.result || '');

      const key = `${type}|${dueDate}|${followerGuid}|${followerPositionGuid}|${status}|${result}`;

      if (!map.has(key)) {
        map.set(key, {
          type,
          dueDate,
          followerGuid,
          followerPositionGuid,
          status,
          result,
          actors: [],
        });
      }

      map.get(key).actors.push({
        id: a.id || 0,
        actorGuid: this.normalizeValue(a.actorGuid || a.userGuid || ''),
        actorPositionGuid: this.normalizeValue(a.actorPositionGuid || a.positionGuid || ''),
        isRemoved: false,
      });
    }

    if (map.size === 0) {
      this.addNewRegularAssignment(true);
      return;
    }

    for (const g of map.values()) {
      const followerUniqueKey = this.buildUniqueKey(g.followerGuid, g.followerPositionGuid);

      const fg = this.fb.group({
        actors: [g.actors, Validators.required],
        type: [g.type, Validators.required],
        followerGuid: [g.followerGuid, Validators.required],
        followerPositionGuid: [g.followerPositionGuid],
        followerUniqueKey: [followerUniqueKey, Validators.required],
        dueDate: [g.dueDate, [Validators.required, this.futureOrAfterMeetingDateValidator]],
        status: [g.status || '1'],
        result: [g.result || ''],
        isRemoved: [false],
      });

      fa.push(fg);

      const actorKeys = (g.actors || []).map((x: any) => this.buildUniqueKey(x.actorGuid, x.actorPositionGuid));
      this._actorGuidsControls.update(list => [...list, new FormControl(actorKeys)]);
    }
  }

  private scrollToLatestAssignment(): void {
    const el = this.assignmentsContainer()?.nativeElement;
    if (!el) return;
    setTimeout(() => { el.scrollTop = 0; }, 50);
  }

  // ═══════════════════════════════════════════════════════════
  // Utility UI for avatars
  // ═══════════════════════════════════════════════════════════
  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img && img.nextElementSibling instanceof HTMLElement) {
      img.style.display = 'none';
      img.nextElementSibling.style.display = 'flex';
    }
  }

  getUserPhotoUrl(personalNo: string): string {
    const photoUrl = encodeURIComponent(`photo/${personalNo}.jpg`);
    return `${environment.fileManagementEndpoint}/api/Image?url=${photoUrl}&w=48&q=75`;
  }

  getUserInitials(userName: string): string {
    if (!userName) return '';
    const words = userName.trim().split(' ');
    if (words.length === 1) return words[0].charAt(0).toUpperCase();
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  }

  // ═══════════════════════════════════════════════════════════
  // Related resolutions
  // ═══════════════════════════════════════════════════════════
  onMeetingChange(meetingGuid: any): void {
    this.resolutionService.getRelatedResolutions(meetingGuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data: any) => this._previousResolutions.set(data));
  }

  onCommitteeMeetingChange(meetingGuid: any): void {
    this.resolutionService.getRelatedResolutions(meetingGuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data: any) => this._previousCommitteResolutions.set(data));
  }

  // ═══════════════════════════════════════════════════════════
  // Files
  // ═══════════════════════════════════════════════════════════
  private buildFilesArray(): ResolutionFileDto[] {
    return this._resolutionFiles()
      .filter(f => !f.isUploading)
      .filter(f => f.type !== 'loading')
      .filter(f => f.guid || f.fileGuid)
      .map(f => {
        if (f.guid) {
          return {
            id: f.id,
            isRemoved: !!f.isRemoved,
            fileGuid: f.guid
          };
        }
        return {
          id: 0,
          isRemoved: !!f.isRemoved,
          fileGuid: f.fileGuid!
        };
      })
      .filter(x => !!x.fileGuid);
  }

  async deleteFile(fileId: number): Promise<void> {
    const file = this._resolutionFiles().find(x => x.id === fileId);
    if (!file) return;

    if (!confirm('آیا از حذف این فایل اطمینان دارید؟')) return;

    if (file.isBlobUrl && file.url?.startsWith('blob:')) {
      URL.revokeObjectURL(file.url);
    }

    if (file.fileGuid && !file.guid) {
      try {
        await this.tus.deleteAttachment(file.fileGuid);
        this.toast.success('فایل حذف شد');
      } catch (e) {
        console.warn('Failed to delete new file:', e);
        this.toast.warning('فایل از لیست حذف شد');
      }

      this._resolutionFiles.update(list => list.filter(x => x.id !== fileId));
    } else if (file.guid) {
      this._resolutionFiles.update(list =>
        list.map(x => x.id === fileId ? { ...x, isRemoved: true } : x)
      );
      this.toast.info('فایل برای حذف علامت‌گذاری شد. با ذخیره مصوبه، حذف نهایی می‌شود.');
    }

    if (this._selectedFileId() === fileId) {
      this.hidePdfPreview();
    }
  }

  async cancelForm(): Promise<void> {
    const newUploadedFiles = this._resolutionFiles()
      .filter(f => !f.guid && !!f.fileGuid && !f.isRemoved);

    if (newUploadedFiles.length > 0) {
      const guids = newUploadedFiles.map(x => x.fileGuid!);

      try {
        await this.tus.deleteAttachments(guids);
        console.log(`Deleted ${guids.length} uploaded files on cancel`);
      } catch (e) {
        console.warn('Failed to delete uploaded files on cancel:', e);
      }
    }

    this.resetForm();
    this.modalClosed.emit();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cleanupUnusedFiles();
  }

  private async cleanupUnusedFiles(): Promise<void> {
    const newUploadedFiles = this._resolutionFiles()
      .filter(f => !f.guid && !!f.fileGuid && !f.isRemoved);

    if (newUploadedFiles.length === 0) return;

    const guids = newUploadedFiles.map(x => x.fileGuid!);

    try {
      await this.tus.deleteAttachments(guids);
      console.log(`Cleanup: Deleted ${guids.length} unused uploaded files`);
    } catch (e) {
      console.warn('Cleanup failed:', e);
    }

    this._resolutionFiles().forEach(f => {
      if (f.isBlobUrl && f.url?.startsWith('blob:')) {
        URL.revokeObjectURL(f.url);
      }
    });
  }

  resetForm(): void {
    this.boardResolutionForm.reset();
    this.regularResolutionForm.reset();

    this._resolutionFiles().forEach(f => {
      if (f.isBlobUrl && f.url?.startsWith('blob:')) {
        URL.revokeObjectURL(f.url);
      }
    });

    this.boardAssignments().clear();
    this.regularAssignments().clear();

    this._resolutionFiles.set([]);
    this._selectedFileId.set(null);
    this._pdfUrl.set(null);
    this._uploadProgress.set(0);
    this._actorGuidsControls.set([]);
    this._boardActorControls.set([]);


    this.hidePdfPreview();

    if (!this.isEditingResolution() && this.meetingGuid() && this._agendaFiles().length === 0) {
      this.loadAgendaFiles();
    }

    if (this.isRegularMeeting() && !this.isEditingResolution()) {
      setTimeout(() => {
        if (this.regularAssignments().length === 0) this.addNewRegularAssignment(true);
      }, 0);
    }
  }

  restoreFile(fileId: number): void {
    this._resolutionFiles.update(list =>
      list.map(x => x.id === fileId ? { ...x, isRemoved: false } : x)
    );
    this.toast.success('فایل بازگردانی شد');
  }
}
