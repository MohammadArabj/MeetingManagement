import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { MeetingDetails } from '../core/models/Meeting';
import { Resolution } from '../core/models/Resolution';
import { MeetingRoles } from '../core/meeting-access/meeting-roles';
import { USER_ID_NAME } from '../core/types/configuration';
import { PrintService } from '../core/print/print.service';
import { BoardMemberService } from './board-member.service';
import { MeetingMemberService } from './meeting-member.service';
import { LocalStorageService } from './framework-services/local.storage.service';
import { ToastService } from './framework-services/toast.service';
import { signatureImageUrl } from '../core/media/media-token';

type PrintSingleArgs = {
  resolution: Resolution;
  meeting: MeetingDetails;
  index: number;
  isBoardMeeting: boolean;
  /** پنجره‌ای که فراخوان از قبل باز کرده است (اختیاری) */
  newDocument?: Window;
};

type PrintAllArgs = {
  meeting: MeetingDetails;
  resolutions: Resolution[];
  isBoardMeeting: boolean;
};

interface Person { name: string; position?: string }

const BOARD_SIGNATURE_SLOTS = 6;

/**
 * چاپ مصوبات (تکی/همه) برای جلسات عادی و هیئت مدیره، با قالب‌های «resolution» ، «resolutions» و «board-resolutions».
 * داده‌ها اینجا آماده می‌شوند و ظاهر کاملاً از قالب می‌آید (صفحه‌ی «تنظیمات › چاپ و قالب‌ها»).
 */
@Injectable({ providedIn: 'root' })
export class MeetingPrintService {
  private readonly print = inject(PrintService);
  private readonly boardMemberService = inject(BoardMemberService);
  private readonly memberService = inject(MeetingMemberService);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly toast = inject(ToastService);

  printSingle(args: PrintSingleArgs): void {
    const target = args.newDocument ?? this.print.openWindow();
    void this.run(target, async () => {
      const members = await this.fetchMembers(args.meeting.guid!);
      const meeting = this.meetingData(args.meeting);
      const number = this.resolutionNumber(args.resolution, args.index, args.isBoardMeeting);

      if (args.isBoardMeeting) {
        const board = await this.boardData(args.meeting, members);
        await this.print.print('board-resolutions',
          { meeting, ...board, resolutions: [this.boardResolution(args.resolution, number)] },
          { title: `صورتجلسه هیئت مدیره - مصوبه ${number}`, target });
        return;
      }

      await this.print.print('resolution', {
        meeting,
        resolution: this.normalResolution(args.resolution, number),
        comments: this.comments(members),
        signatures: this.signatures(members),
      }, { title: `مصوبه شماره ${number} - ${args.meeting.title || 'جلسه'}`, target });
    });
  }

  printAll(args: PrintAllArgs): void {
    const target = this.print.openWindow();
    void this.run(target, async () => {
      const members = await this.fetchMembers(args.meeting.guid!);
      const meeting = this.meetingData(args.meeting);

      if (args.isBoardMeeting) {
        const board = await this.boardData(args.meeting, members);
        await this.print.print('board-resolutions', {
          meeting,
          ...board,
          resolutions: args.resolutions.map((r, i) => this.boardResolution(r, this.resolutionNumber(r, i, true))),
        }, { title: `صورتجلسه هیئت مدیره - ${args.meeting.title || ''}`, target });
        return;
      }

      await this.print.print('resolutions', {
        meeting,
        resolutions: args.resolutions.map((r, i) => this.normalResolution(r, this.resolutionNumber(r, i, false))),
        signatures: this.signatures(members),
      }, { title: `مصوبات جلسه - ${args.meeting.title || ''}`, target });
    });
  }

  // ───────────────────────── داده‌ها ─────────────────────────

  private async run(target: Window | null, job: () => Promise<void>): Promise<void> {
    if (!target) {
      this.toast.error('پنجره‌ی چاپ باز نشد؛ لطفاً اجازه‌ی باز شدن پنجره‌ی جدید (Pop-up) را بدهید.');
      return;
    }
    try {
      await job();
    } catch (e: any) {
      if (!target.closed) target.close();
      this.toast.error(e?.message || 'خطا در آماده‌سازی چاپ');
    }
  }

  private fetchMembers(meetingGuid: string): Promise<any[]> {
    const userGuid = this.localStorageService.getItem(USER_ID_NAME);
    return firstValueFrom(this.memberService.getUserList(meetingGuid, userGuid)).then(list => list ?? []);
  }

  private meetingData(m: MeetingDetails): Record<string, unknown> {
    const x = m as any;
    return {
      title: m.title ?? '',
      number: x.number ?? '',
      date: x.mtDate ?? '',
      startTime: x.startTime ?? '',
      endTime: x.endTime ?? '',
      location: x.location ?? x.roomTitle ?? '',
      category: x.categoryTitle ?? x.category ?? '',
      chairman: x.chairman ?? '',
      secretary: x.secretary ?? '',
    };
  }

  private resolutionNumber(r: Resolution, index: number, board: boolean): string {
    const n = (r as any).number;
    if (n !== null && n !== undefined && `${n}`.trim()) return `${n}`;
    return board ? `${index + 1}`.padStart(2, '0') : `${index + 1}`;
  }

  private normalResolution(r: Resolution, number: string): Record<string, unknown> {
    const x = r as any;
    return {
      number,
      title: x.title ?? '',
      text: x.description || x.text || '',
      assignments: ((x.assignments ?? []) as any[]).map(a => ({
        actor: a.actorName ?? '',
        type: a.type ?? '',
        follower: a.followerName ?? '',
        dueDate: a.dueDate ?? '',
      })),
    };
  }

  private boardResolution(r: Resolution, number: string): Record<string, unknown> {
    const x = r as any;
    return {
      number,
      title: x.title ?? '',
      documentation: x.documentation ?? '',
      description: x.description || x.text || '',
      decisionsMade: x.decisionsMade ?? '',
    };
  }

  private comments(members: any[]): { name: string; comment: string }[] {
    return members
      .filter(m => (m.comment ?? '').toString().trim())
      .map(m => ({ name: m.name ?? '', comment: m.comment }));
  }

  /** امضاهای ثبت‌شده (تصویر امضای شخص در سامانه مدیریت فایل) */
  private signatures(members: any[]): { name: string; signatureUrl: string }[] {
    return members
      .filter(m => m.isSign)
      .map(m => ({ name: m.name ?? '', signatureUrl: signatureImageUrl(m.signatureUrl) }));
  }

  /** حاضرین، دبیر و خانه‌های امضای صورتجلسه هیئت مدیره (مهمان‌ها چاپ نمی‌شوند) */
  private async boardData(meeting: MeetingDetails, members: any[]): Promise<Record<string, unknown>> {
    const boardGuids = members.filter(m => m.boardMemberGuid).map(m => m.boardMemberGuid as string);
    const details: any[] = boardGuids.length ? (await firstValueFrom(this.boardMemberService.getByGuids(boardGuids))) ?? [] : [];

    const isSecretaryTitle = (x: any) => `${x?.position ?? x?.positionTitle ?? ''}`.includes('دبیر');
    const boardSecretary = details.find(isSecretaryTitle) ?? null;
    const attendees: Person[] = details
      .filter(d => d !== boardSecretary)
      .map(d => ({ name: d.fullName || d.name || '', position: d.position || d.positionTitle || 'عضو هیئت مدیره' }));

    const userSecretary = members.find(m => m.userGuid && !m.boardMemberGuid && this.isSecretaryMember(m));
    const secretaryName: string = boardSecretary?.fullName || boardSecretary?.name || userSecretary?.name || (meeting as any).secretary || '';

    const signers: Person[] = [...attendees];
    if (secretaryName) signers.push({ name: secretaryName, position: boardSecretary?.position || 'دبیر جلسه' });
    while (signers.length < BOARD_SIGNATURE_SLOTS) signers.push({ name: '', position: '' });

    return {
      attendees: attendees.map(a => ({ name: a.name })),
      secretary: secretaryName,
      signers,
    };
  }

  private isSecretaryMember(m: any): boolean {
    const roleTitle = `${m?.roleTitle ?? m?.roleName ?? m?.role ?? ''}`;
    const posTitle = `${m?.positionTitle ?? m?.position ?? ''}`;
    return MeetingRoles.isAnySecretary(m?.roleId) || roleTitle.includes('دبیر') || posTitle.includes('دبیر');
  }
}
