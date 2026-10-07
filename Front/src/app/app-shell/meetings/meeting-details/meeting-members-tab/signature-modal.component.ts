import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  ViewChild,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { MeetingRoles } from '../../../../core/meeting-access/meeting-roles';
import { MemberListItem, SignatureSaveEvent } from './meeting-members.models';
import { hideBootstrapModal, showBootstrapModal, userSignatureUrl } from './meeting-members.helpers';

/**
 * مودال ثبت نظر و امضا.
 * بررسی‌های مجاز بودن باز شدن مودال (ردیف خود کاربر، جلسه نهایی و ...) در والد (openSignatureModal) انجام می‌شود.
 * قوانین تغییر امضا (رئیس اول امضا می‌کند، امضای رئیس قطعی است) در toggleSign اعمال می‌شود.
 */
@Component({
  selector: 'app-signature-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './signature-modal.component.html',
  styleUrls: ['./member-modals.shared.css', './signature-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SignatureModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('signatureModal') signatureModalRef!: ElementRef;

  // Inputs / Outputs
  /** آیا رئیس جلسه صورتجلسه را امضا کرده است */
  readonly chairmanSigned = input.required<boolean>();
  readonly save = output<SignatureSaveEvent>();

  // State
  readonly selectedMemberForSignature = signal<MemberListItem | null>(null);
  readonly signatureImage = signal<string>('');

  readonly signatureForm: FormGroup = this.fb.group({
    comment: [''],
    isSign: [false]
  });

  // ═══════════════════════════════════════════════════════════════
  // Public API (called by parent)
  // ═══════════════════════════════════════════════════════════════

  open(member: MemberListItem): void {
    this.selectedMemberForSignature.set(member);
    this.signatureForm.patchValue({
      comment: member.comment || '',
      isSign: member.isSign
    });

    // Load signature image
    this.signatureImage.set(userSignatureUrl(member));

    this.cdr.markForCheck();
    showBootstrapModal(this.signatureModalRef);
  }

  hide(): void {
    hideBootstrapModal(this.signatureModalRef);
  }

  // ═══════════════════════════════════════════════════════════════
  // Template handlers
  // ═══════════════════════════════════════════════════════════════

  toggleSign(): void {
    const member = this.selectedMemberForSignature();
    if (!member) return;
    const current = this.signatureForm.get('isSign')?.value;
    const isChairman = MeetingRoles.isChairman(member.roleId);
    const chairmanSigned = this.chairmanSigned();
    if (current && isChairman && member.isSign) return;          // امضای رئیس قطعی است
    if (!current && !isChairman && !chairmanSigned) return;      // پیش از امضای رئیس

    this.signatureForm.patchValue({ isSign: !current });
  }

  saveSignature(): void {
    const member = this.selectedMemberForSignature();
    if (!member) return;

    const formValue = this.signatureForm.value;
    this.save.emit({ member, isSign: formValue.isSign, comment: formValue.comment });
  }
}
