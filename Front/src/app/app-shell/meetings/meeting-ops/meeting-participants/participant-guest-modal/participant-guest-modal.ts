import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

import { SystemUser } from '../../../../../core/models/User';
import { generateGuid } from '../../../../../core/types/configuration';
import { MeetingRoles } from '../../../../../core/meeting-access/meeting-roles';
import { TusUploadService, UploadStatus } from '../../../../../services/framework-services/tus-upload.service';
import {
  DEFAULT_AVATAR,
  GUEST_UPLOAD_FOLDER,
  GuestFileType,
  MemberIdentity,
  ProcessedMember
} from '../meeting-participants.models';
import {
  clearGuestFileInputs,
  filterSelectableUsers,
  getSystemUserImage,
  getUserCompositeKey,
  markFormGroupTouched
} from '../meeting-participants.helpers';

/**
 * مودال افزودن/ویرایش مهمان (خارج از سازمان یا عضو سازمان) همراه با آپلود TUS
 * تصویر پروفایل و امضا. مهمان ساخته‌شده از طریق خروجی guestSaved به والد ارسال می‌شود.
 */
@Component({
  selector: 'app-participant-guest-modal',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, CommonModule],
  templateUrl: './participant-guest-modal.html',
  styleUrls: ['./participant-guest-modal.css']
})
export class ParticipantGuestModalComponent {
  // ===== DEPENDENCY INJECTION =====
  private readonly fb = inject(FormBuilder);
  private readonly tusUploadService = inject(TusUploadService);

  // ===== INPUT SIGNALS =====
  /** همه کاربران (برای جستجوی عضو سازمان) */
  readonly allSystemUsers = input<SystemUser[]>([]);
  /** کاربران سیستم جاری */
  readonly allUsesrs = input<SystemUser[]>([]);
  /** کاربران در دسترس (برای یافتن عضو داخلی در حالت ویرایش) */
  readonly availableSystemUsers = input<SystemUser[]>([]);
  /** sourceId اعضای فعال فعلی (برای حذف از نتایج جستجو) */
  readonly activeSourceIds = input<Set<string>>(new Set());

  // ===== OUTPUT SIGNALS =====
  readonly guestSaved = output<ProcessedMember>();

  // ===== PRIVATE SIGNALS =====
  private readonly _previewImage = signal<string | null>(null);
  readonly previewImage = this._previewImage.asReadonly();

  // Guest form specific signals
  private readonly _selectedInternalMember = signal<SystemUser | null>(null);
  private readonly _internalMemberSearchQuery = signal<string>('');
  private readonly _internalMemberDropdownVisible = signal<boolean>(false);
  readonly selectedInternalMember = this._selectedInternalMember.asReadonly();

  // ===== Guest File Upload State =====
  private readonly _profileFileGuid = signal<string | null>(null);
  private readonly _signatureFileGuid = signal<string | null>(null);
  private readonly _profileUploadProgress = signal<number>(0);
  private readonly _signatureUploadProgress = signal<number>(0);
  private readonly _isProfileUploading = signal<boolean>(false);
  private readonly _isSignatureUploading = signal<boolean>(false);

  // Public readonly
  readonly profileFileGuid = this._profileFileGuid.asReadonly();
  readonly signatureFileGuid = this._signatureFileGuid.asReadonly();
  readonly profileUploadProgress = this._profileUploadProgress.asReadonly();
  readonly signatureUploadProgress = this._signatureUploadProgress.asReadonly();
  readonly isProfileUploading = this._isProfileUploading.asReadonly();
  readonly isSignatureUploading = this._isSignatureUploading.asReadonly();

  // ===== Computed for upload folder =====
  readonly guestUploadFolder = computed(() => {
    return GUEST_UPLOAD_FOLDER;
  });

  // filteredInternalMembers (activeIds بر اساس sourceId composite، فیلتر بر اساس compositeKey)
  readonly filteredInternalMembers = computed(() => {
    const query = this._internalMemberSearchQuery().toLowerCase().trim();
    const isVisible = this._internalMemberDropdownVisible();
    const systemUsers = this.allUsesrs(); // raw

    if (!isVisible || !systemUsers?.length) return [];

    // activeIds بر اساس sourceId (composite)
    return filterSelectableUsers(systemUsers, this.activeSourceIds(), query, getUserCompositeKey);
  });

  readonly filteredAllUserInternalMembers = computed(() => {
    const query = this._internalMemberSearchQuery().toLowerCase().trim();
    const isVisible = this._internalMemberDropdownVisible();
    const systemUsers = this.allSystemUsers(); // raw

    if (!isVisible || !systemUsers?.length) return [];

    // activeIds بر اساس sourceId (composite)
    return filterSelectableUsers(systemUsers, this.activeSourceIds(), query, getUserCompositeKey);
  });

  // ===== FORM MANAGEMENT =====
  participantsForm!: FormGroup;

  get guestForm(): FormGroup {
    return this.participantsForm.get('guestForm') as FormGroup;
  }

  constructor() {
    this.initializeForm();
  }

  // ===== INITIALIZATION METHODS =====
  private initializeForm(): void {
    this.participantsForm = this.fb.group({
      guestForm: this.fb.group({
        guid: [generateGuid()],
        guestType: ['external', Validators.required],
        selectedMember: [''],
        memberSearch: [''],
        name: [''],
        mobile: [''],
        email: ['', [Validators.email]],
        organization: [''],
        gender: ['Male']
      })
    });

    this.setupDynamicValidators();
  }

  private setupDynamicValidators(): void {
    const guestTypeControl = this.guestForm.get('guestType');

    guestTypeControl?.valueChanges.subscribe(guestType => {
      this.updateValidators(guestType);
    });

    this.updateValidators(guestTypeControl?.value);
  }

  private updateValidators(guestType: string): void {
    const controls = {
      name: this.guestForm.get('name'),
      mobile: this.guestForm.get('mobile'),
      organization: this.guestForm.get('organization'),
      selectedMember: this.guestForm.get('selectedMember'),
      gender: this.guestForm.get('gender') // اضافه شده
    };

    // پاک کردن validators قبلی
    Object.values(controls).forEach(control => control?.clearValidators());

    if (guestType === 'external') {
      controls.name?.setValidators([Validators.required, Validators.minLength(2)]);
      controls.mobile?.setValidators([Validators.required, Validators.pattern(/^09\d{9}$/)]);
      controls.organization?.setValidators([Validators.required]);
      controls.gender?.setValidators([Validators.required]); // اضافه شده

    } else if (guestType === 'internal') {
      controls.selectedMember?.setValidators([Validators.required]);
    }

    // بروزرسانی وضعیت validation
    Object.values(controls).forEach(control => control?.updateValueAndValidity());
  }

  // ===== PUBLIC API FOR PARENT COMPONENT =====

  /** پر کردن فرم با اطلاعات مهمان موجود و نمایش مودال */
  editGuest(member: ProcessedMember): void {
    const guestType = member.isExternal ? 'external' : 'internal';

    this.guestForm.patchValue({
      guid: member.guid,
      guestType: guestType
    });

    if (guestType === 'external') {
      this.guestForm.patchValue({
        name: member.name,
        mobile: member.mobile || '',
        email: member.email || '',
        organization: member.organization || member.position,
        gender: member.gender || 'Male' // اضافه شده
      });
      this._previewImage.set(member.image || null);
    } else {
      const systemUsers = this.availableSystemUsers();
      const internalMember = systemUsers.find(u => u.guid === member.identity.sourceId);
      if (internalMember) {
        this._selectedInternalMember.set(internalMember);
        this.guestForm.patchValue({
          selectedMember: internalMember.guid,
          memberSearch: internalMember.name
        });
      }
    }

    this.show();
  }

  // ===== MODAL MANAGEMENT =====
  show(): void {
    try {
      const modalElement = document.getElementById('guestModal');
      if (modalElement) {
        const modal = new (window as any).bootstrap.Modal(modalElement);
        modal.show();
      }
    } catch (error) {
      console.error('Error showing guest modal:', error);
    }
  }

  private hide(): void {
    try {
      const modalElement = document.getElementById('guestModal');
      if (modalElement) {
        const modal = (window as any).bootstrap.Modal.getInstance(modalElement);
        if (modal) {
          modal.hide();
        }
      }
    } catch (error) {
      console.error('Error hiding guest modal:', error);
    }
  }

  // ===== SAVE / CANCEL =====
  addGuest(): void {
    if (!this.isGuestFormValid()) {
      markFormGroupTouched(this.guestForm);
      return;
    }

    // بررسی آپلود در حال انجام
    if (this._isProfileUploading() || this._isSignatureUploading()) {
      alert('لطفاً صبر کنید تا آپلود فایل‌ها تمام شود');
      return;
    }

    const guestFormValue = this.guestForm.value;
    const guestType = guestFormValue.guestType;
    const newGuest = this.createGuestMember(guestType, guestFormValue);

    this.guestSaved.emit(newGuest);

    // ✅ بعد از اضافه شدن موفق، فقط reset کن (فایل‌ها نباید حذف شوند چون به member اضافه شدند)
    this._profileFileGuid.set(null);
    this._signatureFileGuid.set(null);
    this._profileUploadProgress.set(0);
    this._signatureUploadProgress.set(0);
    this._previewImage.set(null);

    this.guestForm.reset({
      guid: generateGuid(),
      guestType: 'external',
      gender: 'Male'
    });
    this._selectedInternalMember.set(null);
    this._internalMemberSearchQuery.set('');

    this.hide();
  }

  // حذف فایل‌های آپلود شده در صورت کنسل
  async cancelGuestForm(): Promise<void> {
    // حذف فایل‌های آپلود شده
    const profileGuid = this._profileFileGuid();
    const signatureGuid = this._signatureFileGuid();

    const guidsToDelete = [profileGuid, signatureGuid].filter(Boolean) as string[];

    if (guidsToDelete.length > 0) {
      try {
        await this.tusUploadService.deleteAttachments(guidsToDelete);
      } catch (e) {
        console.warn('Failed to delete uploaded files on cancel:', e);
      }
    }

    this.resetGuestForm();
    this.hide();
  }

  private resetGuestForm(): void {
    this.guestForm.reset({
      guid: generateGuid(),
      guestType: 'external',
      gender: 'Male'
    });

    // Reset file states (بدون حذف - فقط reset)
    this._profileFileGuid.set(null);
    this._signatureFileGuid.set(null);
    this._profileUploadProgress.set(0);
    this._signatureUploadProgress.set(0);
    this._previewImage.set(null);
    this._selectedInternalMember.set(null);
    this._internalMemberSearchQuery.set('');

    // Clear file inputs
    clearGuestFileInputs();
  }

  private isGuestFormValid(): boolean {
    const guestType = this.guestForm.get('guestType')?.value;

    if (guestType === 'external') {
      return this.guestForm.valid;
    } else if (guestType === 'internal') {
      return !!(this.guestForm.get('guestType')?.valid &&
        this.guestForm.get('selectedMember')?.valid);
    }

    return false;
  }

  private createGuestMember(guestType: string, formValue: any): ProcessedMember {
    const guestGuid = formValue.guid || generateGuid();

    if (guestType === 'internal') {
      // ... کد قبلی بدون تغییر ...
      const selectedMember = this._selectedInternalMember();
      if (!selectedMember) throw new Error('No internal member selected');

      const compositeKey = getUserCompositeKey(selectedMember);
      const relevantPos = selectedMember.positions?.find((p: any) =>
        p.positionGuid === selectedMember.positionGuid) || selectedMember.positions?.[0];
      const positionTitle = relevantPos ? relevantPos.positionTitle : selectedMember.position;
      const positionGuid = relevantPos ? relevantPos.positionGuid : selectedMember.positionGuid || '';

      const identity: MemberIdentity = {
        id: guestGuid,
        type: 'system',
        sourceId: compositeKey,
        userKey: selectedMember.guid,
        displayName: selectedMember.name,
        position: positionTitle
      };

      return {
        id: 0,
        guid: guestGuid,
        userGuid: selectedMember.baseUserGuid,
        positionGuid: positionGuid,
        name: selectedMember.name,
        position: positionTitle,
        userName: selectedMember.userName,
        roleId: MeetingRoles.guest,
        isExternal: false,
        isRemoved: false,
        image: getSystemUserImage(selectedMember),
        identity,
        isValidated: true
      };
    } else {
      // External guest - ✅ استفاده از GUID های آپلود شده
      const identity: MemberIdentity = {
        id: guestGuid,
        type: 'external',
        sourceId: guestGuid,
        userKey: guestGuid,
        displayName: formValue.name,
        position: formValue.organization
      };

      // ✅ گرفتن GUID های فایل آپلود شده
      const profileGuid = this._profileFileGuid();
      const signatureGuid = this._signatureFileGuid();

      return {
        id: 0,
        guid: guestGuid,
        name: formValue.name,
        position: formValue.organization,
        mobile: formValue.mobile,
        email: formValue.email,
        organization: formValue.organization,
        gender: formValue.gender,
        roleId: MeetingRoles.guest,
        isExternal: true,
        isRemoved: false,
        image: this._previewImage() || DEFAULT_AVATAR,
        // ✅ GUID های فایل
        profileGuid: profileGuid || undefined,
        signatureGuid: signatureGuid || undefined,
        identity,
        isValidated: true
      };
    }
  }

  // ===== INTERNAL MEMBER SEARCH =====
  onInternalMemberSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this._internalMemberSearchQuery.set(input.value);
    this._internalMemberDropdownVisible.set(true);
  }

  selectInternalMember(member: SystemUser): void {
    this._selectedInternalMember.set(member);
    this.guestForm.patchValue({
      selectedMember: member.guid,
      memberSearch: member.name
    });
    this._internalMemberDropdownVisible.set(false);
  }

  showInternalMemberDropdown(): void {
    this._internalMemberDropdownVisible.set(true);
  }

  hideInternalMemberDropdown(): void {
    setTimeout(() => this._internalMemberDropdownVisible.set(false), 200);
  }

  shouldShowInternalMemberDropdown(): boolean {
    return this._internalMemberDropdownVisible() &&
      this.guestForm.get('guestType')?.value === 'internal';
  }

  // ═══════════════════════════════════════════════════════════
  // اصلاح onGuestTypeChange
  // ═══════════════════════════════════════════════════════════

  async onGuestTypeChange(guestType: string): Promise<void> {
    // حذف فایل‌های آپلود شده قبلی
    const guidsToDelete = [this._profileFileGuid(), this._signatureFileGuid()].filter(Boolean) as string[];
    if (guidsToDelete.length > 0) {
      try {
        await this.tusUploadService.deleteAttachments(guidsToDelete);
      } catch (e) {
        console.warn('Failed to delete files on guest type change:', e);
      }
    }

    this.guestForm.patchValue({
      name: '',
      mobile: '',
      email: '',
      organization: '',
      selectedMember: '',
      memberSearch: '',
      gender: 'Male'
    });

    this._selectedInternalMember.set(null);
    this._internalMemberSearchQuery.set('');
    this._previewImage.set(null);
    this._profileFileGuid.set(null);
    this._signatureFileGuid.set(null);
    this._profileUploadProgress.set(0);
    this._signatureUploadProgress.set(0);

    clearGuestFileInputs();
  }

  // ═══════════════════════════════════════════════════════════
  // File Upload Methods - TUS Based
  // ═══════════════════════════════════════════════════════════

  async onFileSelected(event: Event, fileType: GuestFileType): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // Validation
    if (!file.type.startsWith('image/')) {
      alert('لطفاً فقط فایل تصویری انتخاب کنید');
      input.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('حجم فایل نباید از 2 مگابایت بیشتر باشد');
      input.value = '';
      return;
    }

    // Set uploading state
    if (fileType === 'profile') {
      this._isProfileUploading.set(true);
      this._profileUploadProgress.set(0);
    } else {
      this._isSignatureUploading.set(true);
      this._signatureUploadProgress.set(0);
    }

    try {
      // Add file to TUS service
      const added = this.tusUploadService.addFiles([file], {
        maxSizeMB: 2,
        acceptedTypes: ['image/*'],
        localPreview: true
      });

      if (added.length === 0) {
        throw new Error('فایل اضافه نشد');
      }

      const fileItem = added[0];

      // Set preview immediately
      if (fileType === 'profile' && fileItem.previewUrl) {
        this._previewImage.set(fileItem.previewUrl);
      }

      // Subscribe to progress
      const progressInterval = setInterval(() => {
        const current = this.tusUploadService.filesMap().get(fileItem.id);
        if (current) {
          if (fileType === 'profile') {
            this._profileUploadProgress.set(current.progress);
          } else {
            this._signatureUploadProgress.set(current.progress);
          }

          if (current.status === UploadStatus.Completed || current.status === UploadStatus.Failed) {
            clearInterval(progressInterval);
          }
        }
      }, 100);

      // Upload file
      const guid = await this.tusUploadService.uploadFile(fileItem.id, {
        folderPath: this.guestUploadFolder(),
        description: fileType === 'profile' ? 'تصویر پروفایل مهمان' : 'تصویر امضای مهمان'
      });

      clearInterval(progressInterval);

      if (guid) {
        if (fileType === 'profile') {
          // حذف فایل قبلی اگر وجود داشت
          await this.deleteOldFile(this._profileFileGuid());
          this._profileFileGuid.set(guid);
          this._profileUploadProgress.set(100);
        } else {
          await this.deleteOldFile(this._signatureFileGuid());
          this._signatureFileGuid.set(guid);
          this._signatureUploadProgress.set(100);
        }
      } else {
        throw new Error('آپلود ناموفق بود');
      }

    } catch (error: any) {
      console.error(`Error uploading ${fileType}:`, error);
      alert(`خطا در آپلود فایل: ${error?.message || 'خطای نامشخص'}`);

      if (fileType === 'profile') {
        this._profileFileGuid.set(null);
        this._previewImage.set(null);
      } else {
        this._signatureFileGuid.set(null);
      }
    } finally {
      if (fileType === 'profile') {
        this._isProfileUploading.set(false);
      } else {
        this._isSignatureUploading.set(false);
      }
      input.value = '';
    }
  }

  // حذف فایل قدیمی
  private async deleteOldFile(guid: string | null): Promise<void> {
    if (guid) {
      try {
        await this.tusUploadService.deleteAttachment(guid);
      } catch (e) {
        console.warn('Failed to delete old file:', e);
      }
    }
  }

  // حذف دستی فایل توسط کاربر
  async removeUploadedFile(fileType: GuestFileType): Promise<void> {
    if (fileType === 'profile') {
      const guid = this._profileFileGuid();
      if (guid) {
        await this.tusUploadService.deleteAttachment(guid);
      }
      this._profileFileGuid.set(null);
      this._previewImage.set(null);
      this._profileUploadProgress.set(0);
    } else {
      const guid = this._signatureFileGuid();
      if (guid) {
        await this.tusUploadService.deleteAttachment(guid);
      }
      this._signatureFileGuid.set(null);
      this._signatureUploadProgress.set(0);
    }
  }

  // ===== FORM VALIDATION HELPERS =====
  isFormFieldInvalid(fieldName: string): boolean {
    const field = this.guestForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  getFieldErrorMessage(fieldName: string): string {
    const field = this.guestForm.get(fieldName);
    if (field && field.errors && field.touched) {
      if (field.errors['required']) return `${fieldName} الزامی است`;
      if (field.errors['email']) return 'فرمت ایمیل صحیح نیست';
      if (field.errors['pattern']) return 'فرمت شماره موبایل صحیح نیست';
      if (field.errors['minlength']) return `حداقل ${field.errors['minlength'].requiredLength} کاراکتر مجاز است`;
    }
    return '';
  }
}
