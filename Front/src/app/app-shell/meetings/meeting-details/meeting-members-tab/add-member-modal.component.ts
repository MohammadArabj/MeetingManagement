import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { SystemUser } from '../../../../core/models/User';
import { ComboBase } from '../../../../shared/combo-base';
import { MeetingRoles } from '../../../../core/meeting-access/meeting-roles';
import { AddMemberSaveEvent, MemberListItem } from './meeting-members.models';
import {
  filterAvailableRoles,
  filterUsersNotInMeeting,
  hideBootstrapModal,
  markFormTouched,
  showBootstrapModal
} from './meeting-members.helpers';

/**
 * مودال افزودن عضو.
 * فراخوانی API در کامپوننت والد انجام می‌شود؛ والد پس از موفقیت hide() را صدا می‌زند.
 */
@Component({
  selector: 'app-add-member-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './add-member-modal.component.html',
  styleUrls: ['./member-modals.shared.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddMemberModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('addMemberModal') addMemberModalRef!: ElementRef;

  // Inputs / Outputs
  readonly users = input.required<SystemUser[]>();
  readonly members = input.required<MemberListItem[]>();
  readonly roles = input.required<ComboBase[]>();
  readonly save = output<AddMemberSaveEvent>();

  // State
  readonly memberSearchQuery = signal<string>('');
  readonly memberDropdownVisible = signal<boolean>(false);

  readonly addMemberForm: FormGroup = this.fb.group({
    selectedUser: [null, Validators.required],
    roleId: [5, Validators.required]
  });

  /** کاربران مجاز برای افزودن به عنوان عضو */
  readonly availableUsersForMember = computed(() => {
    const query = this.memberSearchQuery();
    const isVisible = this.memberDropdownVisible();
    const users = this.users();
    const currentMembers = this.members();

    if (!isVisible || !users.length) return [];
    return filterUsersNotInMeeting(users, currentMembers, query);
  });

  /** نقش‌های مجاز برای افزودن (بررسی یکتایی) */
  readonly availableRoles = computed(() => filterAvailableRoles(this.roles(), this.members()));

  // ═══════════════════════════════════════════════════════════════
  // Public API (called by parent)
  // ═══════════════════════════════════════════════════════════════

  open(): void {
    this.addMemberForm.reset({ roleId: MeetingRoles.member });
    this.memberSearchQuery.set('');
    this.memberDropdownVisible.set(false);
    this.cdr.markForCheck();
    showBootstrapModal(this.addMemberModalRef);
  }

  hide(): void {
    hideBootstrapModal(this.addMemberModalRef);
  }

  // ═══════════════════════════════════════════════════════════════
  // Template handlers
  // ═══════════════════════════════════════════════════════════════

  onMemberSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.memberSearchQuery.set(input.value);
    this.memberDropdownVisible.set(true);
  }

  selectMemberUser(user: SystemUser): void {
    this.addMemberForm.patchValue({ selectedUser: user });
    this.memberDropdownVisible.set(false);
  }

  saveMember(): void {
    if (this.addMemberForm.invalid) {
      markFormTouched(this.addMemberForm);
      return;
    }

    const formValue = this.addMemberForm.value;
    this.save.emit({ selectedUser: formValue.selectedUser, roleId: formValue.roleId });
  }

  showMemberDropdown(): void { this.memberDropdownVisible.set(true); }
  hideMemberDropdown(): void { setTimeout(() => this.memberDropdownVisible.set(false), 200); }
}
