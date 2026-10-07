import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  computed,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { SystemUser } from '../../../../core/models/User';
import { MeetingRoles } from '../../../../core/meeting-access/meeting-roles';
import { TusUploadService } from '../../../../services/framework-services/tus-upload.service';
import { ToastService } from '../../../../services/framework-services/toast.service';
import { AddGuestSaveEvent, MemberListItem } from './meeting-members.models';
import {
  filterUsersNotInMeeting,
  hideBootstrapModal,
  markFormTouched,
  showBootstrapModal
} from './meeting-members.helpers';

type GuestFileType = 'profile' | 'signature';

/**
 * مودال افزودن مهمان (داخلی/خارجی) به همراه آپلود تصویر پروفایل و امضا.
 * فراخوانی API ثبت در کامپوننت والد انجام می‌شود؛ والد پس از موفقیت hide() را صدا می‌زند.
 */
@Component({
  selector: 'app-add-guest-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './add-guest-modal.component.html',
  styleUrls: ['./member-modals.shared.css', './add-guest-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddGuestModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly tusUploadService = inject(TusUploadService);
  private readonly toastService = inject(ToastService);

  @ViewChild('addGuestModal') addGuestModalRef!: ElementRef;

  // Inputs / Outputs
  readonly users = input.required<SystemUser[]>();
  readonly members = input.required<MemberListItem[]>();
  readonly save = output<AddGuestSaveEvent>();

  // Search
  readonly guestSearchQuery = signal<string>('');
  readonly guestDropdownVisible = signal<boolean>(false);
  readonly selectedInternalUser = signal<SystemUser | null>(null);

  // Upload
  readonly profileFileGuid = signal<string | null>(null);
  readonly signatureFileGuid = signal<string | null>(null);
  readonly profileUploadProgress = signal<number>(0);
  readonly signatureUploadProgress = signal<number>(0);
  readonly isProfileUploading = signal<boolean>(false);
  readonly isSignatureUploading = signal<boolean>(false);
  readonly previewImage = signal<string | null>(null);

  readonly addGuestForm: FormGroup = this.fb.group({
    guestType: ['external', Validators.required],
    // Internal
    selectedUser: [null],
    // External
    name: [''],
    mobile: [''],
    email: ['', Validators.email],
    organization: [''],
    gender: ['Male']
  });

  /** کاربران مجاز برای افزودن به عنوان مهمان داخلی */
  readonly availableUsersForGuest = computed(() => {
    const query = this.guestSearchQuery();
    const isVisible = this.guestDropdownVisible();
    const users = this.users();
    const currentMembers = this.members();

    if (!isVisible || !users.length) return [];
    return filterUsersNotInMeeting(users, currentMembers, query);
  });

  constructor() {
    this.setupGuestFormValidators();
  }

  private setupGuestFormValidators(): void {
    this.addGuestForm.get('guestType')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(guestType => {
        const controls = this.addGuestForm.controls;

        // Reset validators
        Object.keys(controls).forEach(key => {
          if (key !== 'guestType') {
            controls[key].clearValidators();
            controls[key].updateValueAndValidity();
          }
        });

        if (guestType === 'external') {
          controls['name'].setValidators([Validators.required, Validators.minLength(2)]);
          controls['mobile'].setValidators([Validators.required, Validators.pattern(/^09\d{9}$/)]);
          controls['organization'].setValidators([Validators.required]);
        } else {
          controls['selectedUser'].setValidators([Validators.required]);
        }

        Object.keys(controls).forEach(key => controls[key].updateValueAndValidity());
      });
  }

  // ═══════════════════════════════════════════════════════════════
  // Public API (called by parent)
  // ═══════════════════════════════════════════════════════════════

  open(): void {
    this.addGuestForm.reset({ guestType: 'external', gender: 'Male' });
    this.guestSearchQuery.set('');
    this.guestDropdownVisible.set(false);
    this.selectedInternalUser.set(null);
    this.profileFileGuid.set(null);
    this.signatureFileGuid.set(null);
    this.previewImage.set(null);
    this.cdr.markForCheck();
    showBootstrapModal(this.addGuestModalRef);
  }

  hide(): void {
    hideBootstrapModal(this.addGuestModalRef);
  }

  // ═══════════════════════════════════════════════════════════════
  // Template handlers
  // ═══════════════════════════════════════════════════════════════

  onGuestTypeChange(guestType: string): void {
    // Reset related fields
    this.addGuestForm.patchValue({
      name: '',
      mobile: '',
      email: '',
      organization: '',
      selectedUser: null
    });
    this.selectedInternalUser.set(null);
    this.guestSearchQuery.set('');
    this.profileFileGuid.set(null);
    this.signatureFileGuid.set(null);
    this.previewImage.set(null);
  }

  onGuestSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.guestSearchQuery.set(input.value);
    this.guestDropdownVisible.set(true);
  }

  selectGuestUser(user: SystemUser): void {
    this.selectedInternalUser.set(user);
    this.addGuestForm.patchValue({ selectedUser: user });
    this.guestDropdownVisible.set(false);
  }

  async onGuestFileSelected(event: Event, fileType: GuestFileType): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // Validation
    if (!file.type.startsWith('image/')) {
      this.toastService.error('لطفاً فقط فایل تصویری انتخاب کنید');
      input.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      this.toastService.error('حجم فایل نباید از 2 مگابایت بیشتر باشد');
      input.value = '';
      return;
    }

    if (fileType === 'profile') {
      this.isProfileUploading.set(true);
      this.profileUploadProgress.set(0);
    } else {
      this.isSignatureUploading.set(true);
      this.signatureUploadProgress.set(0);
    }

    try {
      const added = this.tusUploadService.addFiles([file], {
        maxSizeMB: 2,
        acceptedTypes: ['image/*'],
        localPreview: true
      });

      if (added.length === 0) throw new Error('فایل اضافه نشد');

      const fileItem = added[0];

      if (fileType === 'profile' && fileItem.previewUrl) {
        this.previewImage.set(fileItem.previewUrl);
      }

      const guid = await this.tusUploadService.uploadFile(fileItem.id, {
        folderPath: 'Meeting{{Folder}}Guests{{Folder}}Temp',
        description: fileType === 'profile' ? 'تصویر پروفایل مهمان' : 'تصویر امضای مهمان'
      });

      if (guid) {
        if (fileType === 'profile') {
          this.profileFileGuid.set(guid);
          this.profileUploadProgress.set(100);
        } else {
          this.signatureFileGuid.set(guid);
          this.signatureUploadProgress.set(100);
        }
      }

    } catch (error: any) {
      console.error(`Error uploading ${fileType}:`, error);
      this.toastService.error(`خطا در آپلود فایل: ${error?.message || 'خطای نامشخص'}`);

      if (fileType === 'profile') {
        this.profileFileGuid.set(null);
        this.previewImage.set(null);
      } else {
        this.signatureFileGuid.set(null);
      }
    } finally {
      if (fileType === 'profile') {
        this.isProfileUploading.set(false);
      } else {
        this.isSignatureUploading.set(false);
      }
      input.value = '';
    }
  }

  async removeGuestFile(fileType: GuestFileType): Promise<void> {
    const guid = fileType === 'profile' ? this.profileFileGuid() : this.signatureFileGuid();

    if (guid) {
      try {
        await this.tusUploadService.deleteAttachment(guid);
      } catch (e) {
        console.warn('Failed to delete file:', e);
      }
    }

    if (fileType === 'profile') {
      this.profileFileGuid.set(null);
      this.previewImage.set(null);
    } else {
      this.signatureFileGuid.set(null);
    }
  }

  saveGuest(): void {
    if (this.addGuestForm.invalid) {
      markFormTouched(this.addGuestForm);
      return;
    }

    if (this.isProfileUploading() || this.isSignatureUploading()) {
      this.toastService.warning('لطفاً صبر کنید تا آپلود فایل‌ها تمام شود');
      return;
    }

    const formValue = this.addGuestForm.value;
    const guestType = formValue.guestType;

    const body: AddGuestSaveEvent = {
      roleId: MeetingRoles.guest, // مهمان
      isExternal: guestType === 'external'
    };

    if (guestType === 'internal') {
      const user = this.selectedInternalUser();
      if (!user) return;

      body.userGuid = user.baseUserGuid || user.guid;
      body.positionGuid = user.positionGuid;
      body.name = user.name;
      body.persNo = (user as any).persNo;
    } else {
      body.name = formValue.name;
      body.mobile = formValue.mobile;
      body.email = formValue.email;
      body.organization = formValue.organization;
      body.gender = formValue.gender;
      body.profileGuid = this.profileFileGuid();
      body.signatureGuid = this.signatureFileGuid();
    }

    this.save.emit(body);
  }

  async cancelGuestModal(): Promise<void> {
    // Delete uploaded files
    const guidsToDelete = [this.profileFileGuid(), this.signatureFileGuid()].filter(Boolean) as string[];

    if (guidsToDelete.length > 0) {
      try {
        await this.tusUploadService.deleteAttachments(guidsToDelete);
      } catch (e) {
        console.warn('Failed to delete uploaded files:', e);
      }
    }

    this.hide();
  }

  showGuestDropdown(): void { this.guestDropdownVisible.set(true); }
  hideGuestDropdown(): void { setTimeout(() => this.guestDropdownVisible.set(false), 200); }
}
