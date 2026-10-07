import {
  Component,
  inject,
  DestroyRef,
  signal,
  computed,
  effect,
  input,
  output,
  OutputEmitterRef,
  ViewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FileService } from '../../../../services/file.service';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CodeFlowService } from '../../../../services/framework-services/code-flow.service';
import { CustomInputComponent } from "../../../../shared/custom-controls/custom-input";
import { AgendaService } from '../../../../services/agenda.service';
import { Modal } from 'bootstrap';
import { FileManagerModalComponent } from "../../../../shared/file-manager/file-manger-modal.component";
import { environment } from '../../../../../environments/environment';

declare var Swal: any;

// ═══════════════════════════════════════════════════════════
// Interfaces
// ═══════════════════════════════════════════════════════════

export interface AgendaFileDto {
  id: number;
  isRemoved: boolean;
  fileGuid: string;
}

export interface AgendaFormValue {
  id: number;
  text: string;
  files: AgendaFileDto[];
  isRemoved: boolean;
}

@Component({
  selector: 'app-meeting-agendas',
  imports: [
    CustomInputComponent,
    ReactiveFormsModule,
    FileManagerModalComponent
  ],
  templateUrl: './meeting-agendas.html',
  styleUrl: './meeting-agendas.css'
})
export class MeetingAgendasComponent {

  // ═══════════════════════════════════════════════════════════
  // ViewChild References
  // ═══════════════════════════════════════════════════════════
  @ViewChild('fileManagerAgenda') fileManagerAgenda!: FileManagerModalComponent;

  // ═══════════════════════════════════════════════════════════
  // Injected Services
  // ═══════════════════════════════════════════════════════════
  private readonly fb = inject(FormBuilder);
  private readonly fileService = inject(FileService);
  private readonly codeFlowService = inject(CodeFlowService);
  private readonly agendaService = inject(AgendaService);
  private readonly destroyRef = inject(DestroyRef);

  // ═══════════════════════════════════════════════════════════
  // Input/Output Signals
  // ═══════════════════════════════════════════════════════════
  readonly inputAgendas = input<FormArray | undefined>(undefined, { alias: 'agendas' });
  readonly meetingNumber = input<string>('');
  readonly agendasUpdate: OutputEmitterRef<FormArray> = output<FormArray>();

  // ═══════════════════════════════════════════════════════════
  // Private Signals
  // ═══════════════════════════════════════════════════════════
  private readonly _agendas = signal<FormArray>(new FormArray<FormGroup>([]));

  // File Manager State
  private readonly _currentEditingAgendaIndex = signal<number>(-1);
  private readonly _currentEditingFiles = signal<AgendaFileDto[]>([]);
  private readonly _originalFiles = signal<AgendaFileDto[]>([]);

  // ═══════════════════════════════════════════════════════════
  // Public Readonly Signals
  // ═══════════════════════════════════════════════════════════
  readonly agendas = this._agendas.asReadonly();
  readonly currentEditingAgendaIndex = this._currentEditingAgendaIndex.asReadonly();

  // ═══════════════════════════════════════════════════════════
  // Computed Signals
  // ═══════════════════════════════════════════════════════════
  readonly agendaControls = computed(() => {
    const allControls = this._agendas().controls as FormGroup[];
    return allControls.filter(control => !control.get('isRemoved')?.value);
  });

  readonly hasValidAgendas = computed(() => {
    return this.agendaControls().every(agenda =>
      agenda.get('text')?.value?.trim() && !agenda.get('isRemoved')?.value
    );
  });

  readonly uploadFolderPath = computed(() => {
    const number = this.meetingNumber();
    return number ? `Meeting{{Folder}}Agenda{{Folder}}${number}` : 'Meeting{{Folder}}Agenda{{Folder}}Temp';
  });

  // ═══════════════════════════════════════════════════════════
  // Constructor
  // ═══════════════════════════════════════════════════════════
  constructor() {
    this.setupEffects();
  }

  private setupEffects(): void {
    effect(() => {
      const inputAgendas = this.inputAgendas();
      if (inputAgendas) {
        this._agendas.set(inputAgendas);
      } else {
        this._agendas.set(new FormArray<FormGroup>([]));
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Form Group Creation
  // ═══════════════════════════════════════════════════════════
  private createAgendaFormGroup(initialData?: Partial<AgendaFormValue>): FormGroup {
    return this.fb.group({
      id: [initialData?.id || 0],
      text: [initialData?.text || '', Validators.required],
      files: [initialData?.files || []],
      isRemoved: [initialData?.isRemoved || false]
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Agenda CRUD Operations
  // ═══════════════════════════════════════════════════════════

  addAgendaItem(): void {
    const currentAgendas = this._agendas();
    const activeAgendas = this.agendaControls();

    // بررسی اینکه همه agenda های فعال متن دارند
    const hasEmptyAgenda = activeAgendas.some(agenda => {
      const text = agenda.get('text')?.value?.trim();
      return !text;
    });

    if (hasEmptyAgenda) {
      activeAgendas.forEach(agenda => {
        const textControl = agenda.get('text');
        if (!textControl?.value?.trim()) {
          textControl?.markAsTouched();
        }
      });
      return;
    }

    // ایجاد agenda جدید
    const newAgenda = this.createAgendaFormGroup();
    currentAgendas.insert(0, newAgenda);

    const updatedControls = [...currentAgendas.controls];
    this._agendas.set(new FormArray(updatedControls));
    this.emitAgendasUpdate();
  }

  removeAgendaItem(index: number): void {
    const currentAgendas = this._agendas();
    const activeAgendas = this.agendaControls();

    if (index < 0 || index >= activeAgendas.length) {
      return;
    }

    const agendaToRemove = activeAgendas[index];
    const agendaId = agendaToRemove.get('id')?.value ?? 0;

    // اگر قبلاً ذخیره شده
    if (agendaId > 0) {
      agendaToRemove.patchValue({
        isRemoved: true
      });
    } else {
      // اگر هنوز ذخیره نشده، کلاً حذف شود
      const realIndex = currentAgendas.controls.indexOf(agendaToRemove);

      if (realIndex > -1) {
        currentAgendas.removeAt(realIndex);
      }
    }

    const updatedControls = [...currentAgendas.controls];
    this._agendas.set(new FormArray(updatedControls));
    this.emitAgendasUpdate();
  }

  // ═══════════════════════════════════════════════════════════
  // File Manager Operations
  // ═══════════════════════════════════════════════════════════

  openFileManagerForAgenda(index: number): void {
    const activeAgendas = this.agendaControls();
    if (index < 0 || index >= activeAgendas.length) return;

    const agenda = activeAgendas[index];
    const currentFiles: AgendaFileDto[] = agenda.get('files')?.value || [];

    // ذخیره state فعلی
    this._currentEditingAgendaIndex.set(index);
    this._originalFiles.set(currentFiles.map(f => ({ ...f })));
    this._currentEditingFiles.set(currentFiles.map(f => ({ ...f })));

    // گرفتن GUID های فعال برای نمایش در file manager
    const activeGuids = currentFiles
      .filter(f => !f.isRemoved)
      .map(f => f.fileGuid);

    setTimeout(() => {
      this.fileManagerAgenda.open(activeGuids);
    }, 100);
  }

  onFilesConfirmed(guids: string[]): void {
    const index = this._currentEditingAgendaIndex();
    if (index < 0) return;

    const activeAgendas = this.agendaControls();
    if (index >= activeAgendas.length) return;

    const agenda = activeAgendas[index];
    const originalFiles = this._originalFiles();
    const newFiles: AgendaFileDto[] = [];
    const receivedGuids = new Set(guids.map(g => g.toLowerCase()));

    // 1️⃣ بررسی فایل‌های اولیه
    for (const original of originalFiles) {
      const guidLower = original.fileGuid.toLowerCase();

      if (receivedGuids.has(guidLower)) {
        // فایل هنوز وجود داره
        newFiles.push({
          id: original.id,
          isRemoved: false,
          fileGuid: original.fileGuid
        });
      } else {
        // فایل حذف شده
        newFiles.push({
          id: original.id,
          isRemoved: true,
          fileGuid: original.fileGuid
        });
      }
    }

    // 2️⃣ فایل‌های جدید
    const originalGuids = new Set(originalFiles.map(f => f.fileGuid.toLowerCase()));
    for (const guid of guids) {
      if (!originalGuids.has(guid.toLowerCase())) {
        newFiles.push({
          id: 0,
          isRemoved: false,
          fileGuid: guid
        });
      }
    }

    // به‌روزرسانی فرم
    agenda.patchValue({ files: newFiles });

    // Reset state
    this._currentEditingAgendaIndex.set(-1);
    this._originalFiles.set([]);
    this._currentEditingFiles.set([]);

    // Trigger update
    const updatedControls = [...this._agendas().controls];
    this._agendas.set(new FormArray(updatedControls));
    this.emitAgendasUpdate();
  }

  onFilesCancelled(): void {
    this._currentEditingAgendaIndex.set(-1);
    this._originalFiles.set([]);
    this._currentEditingFiles.set([]);
  }

  // ═══════════════════════════════════════════════════════════
  // Helper Methods
  // ═══════════════════════════════════════════════════════════

  getFileCount(agenda: FormGroup): number {
    const files: AgendaFileDto[] = agenda.get('files')?.value || [];
    return files.filter(f => !f.isRemoved).length;
  }

  getActiveFileGuids(agenda: FormGroup): string[] {
    const files: AgendaFileDto[] = agenda.get('files')?.value || [];
    return files.filter(f => !f.isRemoved).map(f => f.fileGuid);
  }

  hasFiles(agenda: FormGroup): boolean {
    return this.getFileCount(agenda) > 0;
  }

  // ═══════════════════════════════════════════════════════════
  // Restore & Utility Methods
  // ═══════════════════════════════════════════════════════════

  restoreAgendaItem(agendaId: number): void {
    const currentAgendas = this._agendas();
    const agenda = currentAgendas.controls.find(
      control => control.get('id')?.value === agendaId
    );

    if (agenda) {
      agenda.patchValue({ isRemoved: false });
      const updatedControls = [...currentAgendas.controls];
      this._agendas.set(new FormArray(updatedControls));
      this.emitAgendasUpdate();
    }
  }

  getAllAgendas(): FormGroup[] {
    return this._agendas().controls as FormGroup[];
  }

  getRemovedAgendas(): FormGroup[] {
    return this.getAllAgendas().filter(
      control => control.get('isRemoved')?.value === true
    );
  }

  getActiveAgendasCount(): number {
    return this.agendaControls().length;
  }

  hasAnyValidAgendas(): boolean {
    return this.agendaControls().length > 0;
  }

  // ═══════════════════════════════════════════════════════════
  // Validation Helpers
  // ═══════════════════════════════════════════════════════════

  isAgendaTextInvalid(index: number): boolean {
    const activeAgendas = this.agendaControls();
    if (index < 0 || index >= activeAgendas.length) return false;

    const agenda = activeAgendas[index];
    const textControl = agenda.get('text');
    return !!(textControl && textControl.invalid && textControl.touched);
  }

  getAgendaTextError(index: number): string {
    const activeAgendas = this.agendaControls();
    if (index < 0 || index >= activeAgendas.length) return '';

    const agenda = activeAgendas[index];
    const textControl = agenda.get('text');

    if (textControl && textControl.errors && textControl.touched) {
      if (textControl.errors['required']) {
        return 'متن دستور جلسه الزامی است';
      }
    }
    return '';
  }

  // ═══════════════════════════════════════════════════════════
  // Track Functions
  // ═══════════════════════════════════════════════════════════

  trackByIndex(index: number, item: any): number {
    return index;
  }

  trackById(index: number, item: FormGroup): number {
    return item.get('id')?.value || index;
  }

  // ═══════════════════════════════════════════════════════════
  // Emit Updates
  // ═══════════════════════════════════════════════════════════

  private emitAgendasUpdate(): void {
    this.agendasUpdate.emit(this._agendas());
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }
}