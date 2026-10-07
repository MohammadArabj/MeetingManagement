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
import { MemberListItem, SubstituteSaveEvent } from './meeting-members.models';
import {
  filterSubstituteCandidates,
  hideBootstrapModal,
  markFormTouched,
  showBootstrapModal
} from './meeting-members.helpers';

/**
 * مودال انتخاب جانشین برای یک عضو.
 * فراخوانی API در کامپوننت والد انجام می‌شود؛ والد پس از موفقیت hide() را صدا می‌زند.
 */
@Component({
  selector: 'app-substitute-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './substitute-modal.component.html',
  styleUrls: ['./member-modals.shared.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubstituteModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('substituteModal') substituteModalRef!: ElementRef;

  // Inputs / Outputs
  readonly users = input.required<SystemUser[]>();
  readonly members = input.required<MemberListItem[]>();
  readonly save = output<SubstituteSaveEvent>();

  // State
  readonly selectedMemberForSubstitute = signal<MemberListItem | null>(null);
  readonly substituteSearchQuery = signal<string>('');
  readonly substituteDropdownVisible = signal<boolean>(false);

  readonly substituteForm: FormGroup = this.fb.group({
    selectedUser: [null, Validators.required]
  });

  /** کاربران مجاز برای انتخاب به عنوان جانشین */
  readonly availableUsersForSubstitute = computed(() => {
    const query = this.substituteSearchQuery();
    const isVisible = this.substituteDropdownVisible();
    const users = this.users();
    const currentMembers = this.members();
    const selectedMember = this.selectedMemberForSubstitute();

    if (!isVisible || !users.length || !selectedMember) return [];
    return filterSubstituteCandidates(users, currentMembers, selectedMember, query);
  });

  // ═══════════════════════════════════════════════════════════════
  // Public API (called by parent)
  // ═══════════════════════════════════════════════════════════════

  open(member: MemberListItem): void {
    this.selectedMemberForSubstitute.set(member);
    this.substituteForm.reset();
    this.substituteSearchQuery.set('');
    this.substituteDropdownVisible.set(false);
    this.cdr.markForCheck();
    showBootstrapModal(this.substituteModalRef);
  }

  hide(): void {
    hideBootstrapModal(this.substituteModalRef);
  }

  // ═══════════════════════════════════════════════════════════════
  // Template handlers
  // ═══════════════════════════════════════════════════════════════

  onSubstituteSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.substituteSearchQuery.set(input.value);
    this.substituteDropdownVisible.set(true);
  }

  selectSubstituteUser(user: SystemUser): void {
    this.substituteForm.patchValue({ selectedUser: user });
    this.substituteDropdownVisible.set(false);
  }

  saveSubstitute(): void {
    if (this.substituteForm.invalid) {
      markFormTouched(this.substituteForm);
      return;
    }

    const member = this.selectedMemberForSubstitute();
    if (!member) return;

    this.save.emit({ member, selectedUser: this.substituteForm.value.selectedUser });
  }

  showSubstituteDropdown(): void { this.substituteDropdownVisible.set(true); }
  hideSubstituteDropdown(): void { setTimeout(() => this.substituteDropdownVisible.set(false), 200); }
}
