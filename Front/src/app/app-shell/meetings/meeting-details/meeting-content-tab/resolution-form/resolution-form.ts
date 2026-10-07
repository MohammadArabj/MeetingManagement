import {
  Component,
  DestroyRef,
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
import { ReactiveFormsModule, FormsModule, FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Subject } from 'rxjs';

import { CustomInputComponent } from '../../../../../shared/custom-controls/custom-input';

import { Resolution } from '../../../../../core/models/Resolution';
import { SystemUser } from '../../../../../core/models/User';
import { ComboBase } from '../../../../../shared/combo-base';
import { MeetingType, normalizePersian } from '../../../../../core/types/configuration';

import { ToastService } from '../../../../../services/framework-services/toast.service';
import { MeetingService } from '../../../../../services/meeting.service';
import { ResolutionService } from '../../../../../services/resolution.service';
import { MeetingBehaviorService } from '../../meeting-behavior-service';
import { AppSettings } from '../../../../../services/system-setting.service';

import { CreateResolutionBoardMeetingDto, CreateResolutionDto, UserWithPosition } from './resolution-form.models';
import {
  buildAssignmentsArray,
  buildBoardItemsArray,
  buildUniqueKey,
  buildUsersWithPositions,
  futureOrAfterMeetingDateValidator,
  groupBoardAssignments,
  groupRegularAssignments,
  isPastDate,
  normalizeBoardStatus,
} from './resolution-form.utils';
import { ResolutionFilesStore } from './resolution-files.store';
import { ResolutionFilesPanelComponent } from './resolution-files-panel/resolution-files-panel';
import { BoardResolutionFieldsComponent } from './board-resolution-fields/board-resolution-fields';
import { BoardAssignmentsEditorComponent } from './board-assignments-editor/board-assignments-editor';
import { RegularAssignmentsEditorComponent } from './regular-assignments-editor/regular-assignments-editor';

@Component({
  selector: 'app-resolution-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    CustomInputComponent,
    ResolutionFilesPanelComponent,
    BoardResolutionFieldsComponent,
    BoardAssignmentsEditorComponent,
    RegularAssignmentsEditorComponent,
  ],
  providers: [ResolutionFilesStore],
  templateUrl: './resolution-form.html',
  styleUrl: './resolution-form.css',
})
export class ResolutionFormComponent implements OnInit, OnChanges {
  private destroy$ = new Subject<void>();

  // ═══════════════════════════════════════════════════════════
  // DI
  // ═══════════════════════════════════════════════════════════
  private readonly fb = inject(FormBuilder);
  // ✅ FIX: حذف duplicate injection - فقط یک سرویس toast نگه داشتیم
  private readonly toast = inject(ToastService);
  private readonly meetingService = inject(MeetingService);
  private readonly resolutionService = inject(ResolutionService);
  private readonly meetingBehaviorService = inject(MeetingBehaviorService);
  private readonly destroyRef = inject(DestroyRef);
  /** وضعیت فایل‌ها، آپلود و پیش‌نمایش PDF (سرویس در سطح همین کامپوننت) */
  private readonly files = inject(ResolutionFilesStore);

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
  private readonly boardAssignmentsEditor = viewChild(BoardAssignmentsEditorComponent);

  // ═══════════════════════════════════════════════════════════
  // Forms
  // ═══════════════════════════════════════════════════════════
  regularResolutionForm!: FormGroup;
  boardResolutionForm!: FormGroup;

  previousMeetings: ComboBase[] = [];
  previousCommitteMeetings: ComboBase[] = [];

  /** ولیدیتور تاریخ سررسید؛ تاریخ جلسه هر بار از input فعلی خوانده می‌شود */
  private readonly futureOrAfterMeetingDateValidator = futureOrAfterMeetingDateValidator(() => this.meetingDate());

  // ═══════════════════════════════════════════════════════════
  // State (Signals)
  // ═══════════════════════════════════════════════════════════
  private readonly _isPastMeeting = signal<boolean>(false);

  private readonly _previousResolutions = signal<ComboBase[] | null>(null);
  private readonly _previousCommitteResolutions = signal<ComboBase[] | null>(null);

  private readonly _actorGuidsControls = signal<FormControl[]>([]);
  private readonly _boardActorControls = signal<FormControl[]>([]);

  // ═══════════════════════════════════════════════════════════
  // Readonly
  // ═══════════════════════════════════════════════════════════
  readonly _resolutionFiles = this.files._resolutionFiles;

  readonly selectedFileId = this.files.selectedFileId;
  readonly pdfUrl = this.files.pdfUrl;

  readonly loadingAgendaFiles = this.files.loadingAgendaFiles;
  readonly isUploading = this.files.isUploading;
  readonly uploadProgress = this.files.uploadProgress;

  readonly isPastMeeting = this._isPastMeeting.asReadonly();

  readonly previousResolutions = this._previousResolutions.asReadonly();
  readonly previousCommitteResolutions = this._previousCommitteResolutions.asReadonly();

  readonly actorGuidsControls = this._actorGuidsControls.asReadonly();
  readonly boardActorControls = this._boardActorControls.asReadonly();

  // ═══════════════════════════════════════════════════════════
  // Computeds
  // ═══════════════════════════════════════════════════════════
  readonly isBoardMeeting = computed(() => this.meetingType() === 'board' || this.meetingType() === (MeetingType as any).BOARD);
  readonly isRegularMeeting = computed(() => this.meetingType() === 'regular' || this.meetingType() === (MeetingType as any).REGULAR);

  readonly currentMeeting = computed(() => this.meetingBehaviorService.meeting());
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

  readonly usersWithPositions = computed<UserWithPosition[]>(() => buildUsersWithPositions(this.userList()));

  readonly agendaFiles = this.files.agendaFiles;
  readonly resolutionFiles = this.files.resolutionFiles;

  readonly hasAgendaFiles = this.files.hasAgendaFiles;
  readonly fileCount = this.files.fileCount;

  hasRemovedFiles(): boolean {
    return this.files.hasRemovedFiles();
  }

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
    if (md) this._isPastMeeting.set(isPastDate(md));

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
  // FormArray getters
  // ═══════════════════════════════════════════════════════════
  boardAssignments(): FormArray {
    return this.boardResolutionForm.get('boardAssignments') as FormArray;
  }

  regularAssignments(): FormArray {
    return this.regularResolutionForm.get('regularAssignments') as FormArray;
  }

  // ═══════════════════════════════════════════════════════════
  // Files (delegated to ResolutionFilesStore)
  // ═══════════════════════════════════════════════════════════
  private loadAgendaFiles(): void {
    this.files.loadAgendaFiles(this.meetingGuid());
  }

  processFiles(files: File[]): Promise<void> {
    return this.files.processFiles(files, () => this.uploadFolder());
  }

  selectFile(fileId: number): void {
    this.files.selectFile(fileId);
  }

  deleteFile(fileId: number): Promise<void> {
    return this.files.deleteFile(fileId);
  }

  restoreFile(fileId: number): void {
    this.files.restoreFile(fileId);
  }

  showPdfPreview(url: string, name: string): void {
    this.files.showPdfPreview(url, name);
  }

  hidePdfPreview(): void {
    this.files.hidePdfPreview();
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

    setTimeout(() => this.files.loadExistingResolutionFiles(this.selectedResolution()?.id), 0);
  }

  private resetFormSilently(): void {
    this.boardResolutionForm.reset();
    this.regularResolutionForm.reset();

    this.boardAssignments().clear();
    this.regularAssignments().clear();

    this.files.reset();

    this._actorGuidsControls.set([]);
    this._boardActorControls.set([]);

    this.hidePdfPreview();
  }

  // ═══════════════════════════════════════════════════════════
  // Save
  // ═══════════════════════════════════════════════════════════
  saveResolution(): void {
    if (this._isSaving()) return;

    if (this.isUploading()) {
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
      files: this.files.buildFilesArray(),
      assignments: buildAssignmentsArray(this.regularResolutionForm.get('regularAssignments')?.value || []),
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
      files: this.files.buildFilesArray(),
      items: buildBoardItemsArray(this.boardAssignments().controls.map(ctrl => ctrl.value)),
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
    this.boardAssignmentsEditor()?.scrollToLatestAssignment();
  }

  onBoardActorsChange(assignmentIndex: number, selectedItems: any[]): void {
    const group = this.boardAssignments().at(assignmentIndex) as FormGroup;
    if (!group) return;

    const editing = this.isEditingResolution();
    const usersWithPos = this.usersWithPositions();

    const selectedKeys = new Set<string>((selectedItems || []).map(x => typeof x === 'string' ? x : (x.uniqueKey ?? x)));
    const oldActors: any[] = group.get('actors')?.value || [];

    let newActors = oldActors.map(a => {
      const key = buildUniqueKey(a.actorGuid, a.actorPositionGuid);
      return { ...a, isRemoved: !selectedKeys.has(key) };
    });

    selectedKeys.forEach(key => {
      const exists = oldActors.some(a => buildUniqueKey(a.actorGuid, a.actorPositionGuid) === key);
      if (exists) return;

      const u = usersWithPos.find(p => p.uniqueKey === key);
      if (!u) return;

      newActors.push({ id: 0, actorGuid: u.userGuid, actorPositionGuid: u.positionGuid, isRemoved: false });
    });

    if (!editing) newActors = newActors.filter(a => !a.isRemoved);

    group.get('actors')?.setValue(newActors, { emitEvent: false });

    const activeKeys = newActors.filter(a => !a.isRemoved).map(a => buildUniqueKey(a.actorGuid, a.actorPositionGuid));
    group.get('actorUniqueKey')?.setValue(activeKeys, { emitEvent: false });
  }

  private loadExistingBoardAssignments(): void {
    const res = this.selectedResolution();
    if (!res?.id || !res.assignments) return;

    const fa = this.boardAssignments();
    fa.clear();

    groupBoardAssignments(res.assignments).forEach((g: any) => {
      const actorKeys = (g.actors || [])
        .filter((x: any) => !x.isRemoved)
        .map((x: any) => buildUniqueKey(x.actorGuid, x.actorPositionGuid));

      const normalized = normalizeBoardStatus(g.status, g.result);

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

    const groups = groupRegularAssignments((res as any).assignments || []);

    if (groups.length === 0) {
      this.addNewRegularAssignment(true);
      return;
    }

    for (const g of groups) {
      const followerUniqueKey = buildUniqueKey(g.followerGuid, g.followerPositionGuid);

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

      const actorKeys = (g.actors || []).map((x: any) => buildUniqueKey(x.actorGuid, x.actorPositionGuid));
      this._actorGuidsControls.update(list => [...list, new FormControl(actorKeys)]);
    }
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
  // Cancel / destroy / reset
  // ═══════════════════════════════════════════════════════════
  async cancelForm(): Promise<void> {
    await this.files.deleteNewUploadsOnCancel();

    this.resetForm();
    this.modalClosed.emit();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.files.cleanupUnusedFiles();
  }

  resetForm(): void {
    this.boardResolutionForm.reset();
    this.regularResolutionForm.reset();

    this.boardAssignments().clear();
    this.regularAssignments().clear();

    this.files.reset();

    this._actorGuidsControls.set([]);
    this._boardActorControls.set([]);

    this.hidePdfPreview();

    if (!this.isEditingResolution() && this.meetingGuid() && this.files.hasNoAgendaEntries()) {
      this.loadAgendaFiles();
    }

    if (this.isRegularMeeting() && !this.isEditingResolution()) {
      setTimeout(() => {
        if (this.regularAssignments().length === 0) this.addNewRegularAssignment(true);
      }, 0);
    }
  }
}
