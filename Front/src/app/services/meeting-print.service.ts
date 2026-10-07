import { computed, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { environment } from "../../environments/environment";
import { MeetingBehaviorService } from "../app-shell/meetings/meeting-details/meeting-behavior-service";
import { MeetingDetails } from "../core/models/Meeting";
import { Resolution } from "../core/models/Resolution";
import { BoardMemberService } from "./board-member.service";
import { USER_ID_NAME } from "../core/types/configuration";
import { MeetingMemberService } from "./meeting-member.service";
import { LocalStorageService } from "./framework-services/local.storage.service";
import { MeetingRoles } from '../core/meeting-access/meeting-roles';

type PrintSingleArgs = {
  resolution: Resolution;
  meeting: MeetingDetails;
  index: number;
  isBoardMeeting: boolean;
  newDocument?: Window;
};

type PrintAllArgs = {
  meeting: MeetingDetails;
  resolutions: Resolution[];
  isBoardMeeting: boolean;
};

@Injectable({ providedIn: 'root' })
export class MeetingPrintService {
  constructor(
    private readonly boardMemberService: BoardMemberService,
    private readonly memberService: MeetingMemberService,
    private readonly localStorageService: LocalStorageService
  ) { }

  readonly siteUrl = computed(() => environment.selfEndpoint);

  printSingle(args: PrintSingleArgs): void {
    const newWin = args.newDocument ?? window.open('', '_blank', 'width=900,height=700');
    if (!newWin) return;
    void this.initAndPrintSingle(newWin, args);
  }

  printAll(args: PrintAllArgs): void {
    const newWin = window.open('', '_blank', 'width=900,height=700');
    if (!newWin) return;
    void this.initAndPrintAll(newWin, args);
  }

  // members رو خودمون fetch میکنیم با meetingGuid
  private async fetchMembers(meetingGuid: string): Promise<any[]> {
    const userGuid = this.localStorageService.getItem(USER_ID_NAME);
    return firstValueFrom(this.memberService.getUserList(meetingGuid, userGuid));
  }

  private async initAndPrintSingle(newWin: Window, args: PrintSingleArgs): Promise<void> {
    const members = await this.fetchMembers(args.meeting.guid!);

    if (args.isBoardMeeting) {
      await this.printBoardSingle(newWin, args, members);
      return;
    }
    this.printNormalSingle(newWin, args, members);
  }

  private async initAndPrintAll(newWin: Window, args: PrintAllArgs): Promise<void> {
    const members = await this.fetchMembers(args.meeting.guid!);

    if (args.isBoardMeeting) {
      await this.printBoardAll(newWin, args, members);
      return;
    }
    this.printNormalAll(newWin, args, members);
  }
  private renderSignedMembersSection(members: any[]): string {
    const signedMembers = members.filter((m: any) => m.isSign);

    if (!signedMembers.length) return '';

    const signaturesHtml = signedMembers.map((m: any) => {
      const userName = this.escapeHtml(m.userName ?? '');
      const name = this.escapeHtml(m.name ?? '');
      const sigUrl = `${environment.fileManagementEndpoint}/EpcSignature/${userName}.jpg`;

      return `
      <div class="sig-item">
        <img src="${sigUrl}" alt="امضا" />
        <span>${name}</span>
      </div>`;
    }).join('');

    return `
    <div class="meeting-signatures">
      <div class="sig-top">امضای اعضا</div>
      <div class="sig-body">${signaturesHtml}</div>
    </div>`;
  }
  private renderDescriptionSection(members: any[]): string {
    const memberDescriptions = members
      .filter((m: any) => m.comment)
      .map((m: any) => ({ name: m.name, comment: m.comment || '' }));

    if (!memberDescriptions.length) return '';

    const rows = memberDescriptions
      .map((m: any) => `
        <tr>
          <td>${this.escapeHtml(m.name || '')}</td>
          <td>${this.escapeHtml(m.comment || '')}</td>
        </tr>`)
      .join('');

    return `
      <div class="resolution-content">
        <div class="resolution-header">توضیحات اعضا</div>
        <table class="assignments-table">
          <thead>
            <tr>
              <th>نام عضو</th>
              <th>توضیح</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>`;
  }
  // -----------------------------
  // Normal meeting printing
  // -----------------------------
  private printNormalSingle(newWin: Window, args: PrintSingleArgs, members: any[]): void {
    const { resolution, meeting, index } = args;

    const assignmentRows = this.renderAssignmentsRows(resolution);
    const resolutionTitle = `مصوبه شماره ${index + 1} - ${meeting?.title || 'جلسه'}`;

    newWin.document.open();
    newWin.document.write(`
    <html>
      <head>
        <title>چاپ مصوبه شماره ${index + 1}</title>
        <meta charset="UTF-8">
        <style>
          body { direction: rtl; font-family: 'Tahoma', Arial, sans-serif; background-color: #f8f9fa; padding: 0; margin: 0; }
          .container { max-width: 26cm; margin: 0 auto; background-color: #fff; padding: 20px; border-radius: 15px; }
          header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
          .header-content { flex: 1; }
          .name-of-god { text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 10px; }
          .resolution-title { width: 95%; border: 2px solid #6d8dab; padding: 15px; border-radius: 20px; font-weight: 700; font-size: 17px; text-align: center; background: linear-gradient(to left, #e1d4cd, #f7ddd0, #e0e9f3); }
          .meeting-info { margin: 20px 0; border: 2px solid #6e6e6e; border-radius: 15px; overflow: hidden; }
          .meeting-info table { width: 100%; border-collapse: collapse; }
          .meeting-info th { background: #d9d9d9; border: 1px solid black; padding: 10px; font-weight: bold; text-align: center; font-size: 14px; }
          .meeting-info td { border: 1px solid black; padding: 10px; text-align: center; font-size: 13px; }
          .resolution-content { margin: 20px 0; border: 2px solid #6e6e6e; border-radius: 10px; }
          .resolution-header { background: #fbe5d5; padding: 12px; border-bottom: 1px solid #6e6e6e; font-weight: bold; text-align: center; font-size: 16px; }
          .resolution-text { padding: 20px; line-height: 1.8; font-size: 14px; text-align: justify; }
          .assignments-section { margin: 20px 0; border: 2px solid #6e6e6e; border-radius: 10px; }
          .assignments-header { background: #fbe5d5; padding: 12px; border-bottom: 1px solid #6e6e6e; font-weight: bold; text-align: center; font-size: 16px; }
          .assignments-table { width: 100%; border-collapse: collapse; }
          .assignments-table th { background: #d9d9d9; border: 1px solid black; padding: 10px; font-weight: bold; text-align: center; font-size: 14px; }
          .assignments-table td { border: 1px solid black; padding: 10px; text-align: center; font-size: 13px; }
          * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
          @media print { body { background-color: white; } .container { box-shadow: none; border: none; } }
          .meeting-signatures { margin: 20px 0; border: 2px solid #6e6e6e; border-radius: 10px; min-height: 100px; }
          .sig-top { background: #fbe5d5; padding: 12px; border-bottom: 1px solid #6e6e6e; font-weight: bold; text-align: center; font-size: 16px; }
          .sig-body { display: flex; flex-wrap: wrap; gap: 10px; padding: 15px; }
          .sig-item { display: flex; flex-direction: column; align-items: center; min-width: 120px; }
          .sig-item img { width: 125px; height: 65px; object-fit: contain; border: 1px solid #ddd; border-radius: 4px; }
          .sig-item span { font-size: 12px; margin-top: 5px; background: #fbe5d5; padding: 2px 8px; border-radius: 3px; text-align: center; }
        </style>
                  <link rel="stylesheet" href="${this.siteUrl()}/css/custom.css" />
      </head>
      <body>
        <div class="container">
          <header>
            <div class="header-content">
              <div class="name-of-god">به نام خدا</div>
              <div class="resolution-title">${resolutionTitle}</div>
            </div>
          </header>

          <div class="meeting-info">
            <table>
              <thead>
                <tr>
                  <th>موضوع جلسه</th>
                  <th>تاریخ</th>
                  <th>زمان</th>
                  <th>شماره جلسه</th>
                  <th>رئیس جلسه</th>
                  <th>دبیر جلسه</th>
                  <th>محل تشکیل</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${meeting?.title || '-'}</td>
                  <td>${meeting?.mtDate || '-'}</td>
                  <td>${(meeting as any)?.startTime || '-'}</td>
                  <td>${(meeting as any)?.number || '-'}</td>
                  <td>${(meeting as any)?.chairman || '-'}</td>
                  <td>${(meeting as any)?.secretary || '-'}</td>
                  <td>${(meeting as any)?.location || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="resolution-content">
            <div class="resolution-header">متن مصوبه</div>
            <div class="resolution-text">${resolution.description || (resolution as any).text || 'متن مصوبه در دسترس نیست'}</div>
          </div>

          <div class="assignments-section">
            <div class="assignments-header">تخصیص‌های مصوبه</div>
            <table class="assignments-table">
              <thead>
                <tr>
                  <th>ردیف</th>
                  <th>اقدام کننده</th>
                  <th>نوع تخصیص</th>
                  <th>پیگیری کننده</th>
                  <th>تاریخ سررسید</th>
                </tr>
              </thead>
              <tbody>
                ${assignmentRows}
              </tbody>
            </table>
          </div>

          ${this.renderDescriptionSection(members)}   <!-- ✅ اضافه شد -->
          ${this.renderSignedMembersSection(members)}   <!-- ✅ اضافه شد -->
        </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
            setTimeout(() => window.close(), 100);
          };
        </script>
      </body>
    </html>
    `);
    newWin.document.close();
  }

  private printNormalAll(newWin: Window, args: PrintAllArgs, members: any[]): void {
    const { meeting, resolutions } = args;

    let allResolutionsContent = '';

    resolutions.forEach((res, index) => {
      const assignmentRows = this.renderAssignmentsRows(res);
      const title = `مصوبه شماره ${index + 1}`;

      allResolutionsContent += `
      <div class="resolution-page" ${index < resolutions.length - 1 ? 'style="page-break-after: always;"' : ''}>
        <div class="resolution-title-header"><h2>${title}</h2></div>

        <div class="resolution-content">
          <div class="resolution-header">متن مصوبه</div>
          <div class="resolution-text">${res.description || (res as any).text || 'متن مصوبه در دسترس نیست'}</div>
        </div>
<div class="assignments-section">
        <div class="assignments-header">تخصیص‌های مصوبه</div>
        <table class="assignments-table">
          <thead>
            <tr>
              <th>ردیف</th>
              <th>اقدام کننده</th>
              <th>نوع تخصیص</th>
              <th>پیگیری کننده</th>
              <th>تاریخ سررسید</th>
            </tr>
          </thead>
          <tbody>${assignmentRows}</tbody>
        </table>
      </div>

      ${this.renderSignedMembersSection(members)}   <!-- ✅ اضافه شد -->
    </div>`;  // ← بسته شدن resolution-page
    });

    const meetingTypeTitle = 'مصوبات جلسه';

    newWin.document.open();
    newWin.document.write(`
    <html>
      <head>
        <title>چاپ همه ${meetingTypeTitle} - ${meeting?.title}</title>
        <meta charset="UTF-8">
        <style>
          body { direction: rtl; font-family: 'Tahoma', Arial, sans-serif; background-color: #f8f9fa; padding: 0; margin: 0; }
          .container { max-width: 26cm; margin: 0 auto; background-color: #fff; padding: 20px; }

          .main-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 3px solid #6d8dab; padding-bottom: 20px; }
          .header-content { flex: 1; text-align: center; }
          .name-of-god { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
          .main-title { border: 2px solid #6d8dab; padding: 15px; border-radius: 20px; font-weight: 700; font-size: 18px; text-align: center; background: linear-gradient(to left, #e1d4cd, #f7ddd0, #e0e9f3); }
          .summary-info { margin: 20px 0; text-align: center; font-size: 14px; color: #666; }

          .meeting-info { margin: 20px 0; border: 2px solid #6e6e6e; border-radius: 15px; overflow: hidden; }
          .meeting-info table { width: 100%; border-collapse: collapse; }
          .meeting-info th { background: #d9d9d9; border: 1px solid black; padding: 10px; font-weight: bold; text-align: center; font-size: 14px; }
          .meeting-info td { border: 1px solid black; padding: 10px; text-align: center; font-size: 13px; }

          .resolution-page { margin-bottom: 40px; }
          .resolution-title-header { text-align: center; margin-bottom: 20px; padding: 15px; background: linear-gradient(to left, #e8f4fd, #f0f9ff); border: 2px solid #2c5aa0; border-radius: 15px; }
          .resolution-title-header h2 { margin: 0; color: #2c5aa0; font-size: 20px; }

          .resolution-content { margin: 20px 0; border: 2px solid #6e6e6e; border-radius: 10px; }
          .resolution-header { background: #fbe5d5; padding: 12px; border-bottom: 1px solid #6e6e6e; font-weight: bold; text-align: center; font-size: 16px; }
          .resolution-text { padding: 20px; line-height: 1.8; font-size: 14px; text-align: justify; }

          .assignments-section { margin: 20px 0; border: 2px solid #6e6e6e; border-radius: 10px; }
          .assignments-header { background: #fbe5d5; padding: 12px; border-bottom: 1px solid #6e6e6e; font-weight: bold; text-align: center; font-size: 16px; }
          .assignments-table { width: 100%; border-collapse: collapse; }
          .assignments-table th { background: #d9d9d9; border: 1px solid black; padding: 10px; font-weight: bold; text-align: center; font-size: 14px; }
          .assignments-table td { border: 1px solid black; padding: 10px; text-align: center; font-size: 13px; }

          * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
          @media print { body { background-color: white; } .container { box-shadow: none; border: none; } }
        </style>
        <link rel="stylesheet" href="${environment.selfEndpoint}/css/custom.css"/>
      </head>
      <body>
        <div class="container">
          <div class="main-header">
            <div class="header-content">
              <div class="name-of-god">به نام خدا</div>
              <div class="main-title">گزارش کامل ${meetingTypeTitle} - ${meeting?.title || 'جلسه'}</div>
            </div>
          </div>

          <div class="summary-info"><strong>تعداد کل مصوبات: ${resolutions.length} مصوبه</strong></div>

          <div class="meeting-info">
            <table>
              <thead>
                <tr>
                  <th>موضوع جلسه</th>
                  <th>تاریخ</th>
                  <th>زمان</th>
                  <th>شماره جلسه</th>
                  <th>رئیس جلسه</th>
                  <th>دبیر جلسه</th>
                  <th>محل تشکیل</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${meeting?.title || '-'}</td>
                  <td>${meeting?.mtDate || '-'}</td>
                  <td>${(meeting as any)?.startTime || '-'}</td>
                  <td>${(meeting as any)?.number || '-'}</td>
                  <td>${(meeting as any)?.chairman || '-'}</td>
                  <td>${(meeting as any)?.secretary || '-'}</td>
                  <td>${(meeting as any)?.location || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          ${allResolutionsContent}
        </div>

        <script>
          window.onload = function() {
            window.print();
            setTimeout(() => window.close(), 100);
          };
        </script>
      </body>
    </html>
    `);
    newWin.document.close();
  }

  private renderAssignmentsRows(resolution: Resolution): string {
    const list = (resolution as any)?.assignments as any[] | undefined;

    if (!list?.length) {
      return `<tr><td colspan="5" style="text-align:center;padding:20px;">تخصیصی برای این مصوبه تعریف نشده است</td></tr>`;
    }

    return list
      .map(
        (a, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${a.actorName || '-'}</td>
          <td>${a.type || '-'}</td>
          <td>${a.followerName || '-'}</td>
          <td>${a.dueDate || '-'}</td>
        </tr>`
      )
      .join('');
  }

  // -----------------------------
  // Board meeting printing (NO guests + secretary separated)
  // -----------------------------
  private isSecretaryMember(m: any): boolean {
    const roleTitle = (m?.roleTitle ?? m?.roleName ?? m?.role ?? '').toString();
    const posTitle = (m?.positionTitle ?? m?.position ?? '').toString();
    return MeetingRoles.isAnySecretary(m?.roleId) || roleTitle.includes('دبیر') || posTitle.includes('دبیر');
  }

  private async printBoardSingle(newWin: Window, args: PrintSingleArgs, members: any[]): Promise<void> {
    const boardMembers = members.filter((m: any) => m.boardMemberGuid);

    // userMembers = مهمان‌ها (در هیئت مدیره چاپ نمی‌شوند)
    const userMembersAll = members.filter((m: any) => m.userGuid && !m.boardMemberGuid);
    const secretaryUser = userMembersAll.find((m: any) => this.isSecretaryMember(m)) ?? null;

    if (boardMembers.length) {
      const guids = boardMembers.map((m: any) => m.boardMemberGuid);
      const boardDetails = await firstValueFrom(this.boardMemberService.getByGuids(guids));

      const secretaryBoard = boardDetails.find((x: any) => ((x?.position ?? x?.positionTitle ?? '') as string).includes('دبیر')) ?? null;
      const attendees = secretaryBoard ? boardDetails.filter((x: any) => x !== secretaryBoard) : boardDetails;

      const secretaryFinal =
        secretaryBoard
          ? { ...secretaryBoard, isSecretary: true }
          : secretaryUser
            ? { fullName: secretaryUser.name, name: secretaryUser.name, position: 'دبیر جلسه', isSecretary: true }
            : ((args.meeting as any)?.secretary ? { fullName: (args.meeting as any).secretary, position: 'دبیر جلسه', isSecretary: true } : null);

      this.renderBoardSingleDocument(newWin, args, attendees, secretaryFinal);
      return;
    }

    // fallback بدون دیتای board
    const secretaryFallback = ((args.meeting as any)?.secretary ? { fullName: (args.meeting as any).secretary, position: 'دبیر جلسه', isSecretary: true } : null);
    this.renderBoardSingleDocument(newWin, args, [], secretaryFallback);
  }

  private async printBoardAll(newWin: Window, args: PrintAllArgs, members: any[]): Promise<void> {
    const boardMembers = members.filter((m: any) => m.boardMemberGuid);

    const userMembersAll = members.filter((m: any) => m.userGuid && !m.boardMemberGuid);
    const secretaryUser = userMembersAll.find((m: any) => this.isSecretaryMember(m)) ?? null;

    if (boardMembers.length) {
      const guids = boardMembers.map((m: any) => m.boardMemberGuid);
      const boardDetails = await firstValueFrom(this.boardMemberService.getByGuids(guids));

      const secretaryBoard = boardDetails.find((x: any) => ((x?.position ?? x?.positionTitle ?? '') as string).includes('دبیر')) ?? null;
      const attendees = secretaryBoard ? boardDetails.filter((x: any) => x !== secretaryBoard) : boardDetails;

      const secretaryFinal =
        secretaryBoard
          ? { ...secretaryBoard, isSecretary: true }
          : secretaryUser
            ? { fullName: secretaryUser.name, name: secretaryUser.name, position: 'دبیر جلسه', isSecretary: true }
            : ((args.meeting as any)?.secretary ? { fullName: (args.meeting as any).secretary, position: 'دبیر جلسه', isSecretary: true } : null);

      this.renderBoardAllDocument(newWin, args, attendees, secretaryFinal);
      return;
    }

    const secretaryFallback = ((args.meeting as any)?.secretary ? { fullName: (args.meeting as any).secretary, position: 'دبیر جلسه', isSecretary: true } : null);
    this.renderBoardAllDocument(newWin, args, [], secretaryFallback);
  }

  private escapeHtml(v: any): string {
    return (v ?? '')
      .toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private renderBoardSingleDocument(
    newWin: Window,
    args: PrintSingleArgs,
    attendees: any[],
    secretary: any | null
  ): void {
    const { resolution, meeting, index } = args;

    const attendeesHtml = attendees
      .map(
        (m) => `
        <div class="attendee">
          <div class="checkbox">✓</div>
          <span>${this.escapeHtml(m.fullName || m.name || '')}</span>
        </div>`
      )
      .join('');

    const secretaryName = secretary?.fullName || secretary?.name || (meeting as any)?.secretary || '';
    const secretaryHtml = secretaryName
      ? `
      <div class="row">
        <div class="attendees">
          <div class="attendee"><span style="font-family:'B Titr';font-weight:bold;">دبیر جلسه:</span></div>
          <div class="attendee"><div class="checkbox">✓</div><span>${this.escapeHtml(secretaryName)}</span></div>
        </div>
      </div>`
      : '';

    const signaturesHtml = this.renderSignaturesGrid(attendees, secretary);

    const documentationSection = (resolution as any)?.documentation?.trim()
      ? `
      <div class="row">
        <div class="row-title">سوابق و مستندات:</div>
        <div class="resolution-content">${(resolution as any).documentation}</div>
      </div>`
      : '';

    const descriptionSection = ((resolution as any)?.description?.trim() || (resolution as any)?.text?.trim())
      ? `
      <div class="row">
        <div class="row-title">توضیحات:</div>
        <div class="resolution-content">${(resolution as any).description || (resolution as any).text}</div>
      </div>`
      : '';

    const decisionsMadeSection = (resolution as any)?.decisionsMade?.trim()
      ? `
      <div class="row">
        <div class="row-title">تصمیمات متخذه:</div>
        <div class="resolution-content">${(resolution as any).decisionsMade}</div>
      </div>`
      : '';

    newWin.document.open();
    newWin.document.write(`
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>صورتجلسه هیئت مدیره - مصوبه ${resolution.number || index + 1}</title>
      <style>
        body { font-family: 'B Nazanin','Tahoma',sans-serif; margin:0; padding:20px; direction:rtl; text-align:right; background:#fff; font-size:14px; line-height:1.6; }
        .container { margin:0 auto; background:#fff; border:2px solid #000; }
        .header { text-align:center; }
        .logo { width:85px; height:65px; margin:0 auto 10px; border-radius:50%; display:flex; align-items:center; justify-content:center; }
        .company-name { font-size:18px; font-weight:bold; margin-bottom:20px; }
        .row1 { width:100%; border-bottom:1px solid #000; padding:15px 0; }
        .title { font-size:18px; font-weight:bold; text-align:center; }
        .info-group { display:flex; gap:30px; justify-content:space-between; padding:0 34px 0 14px; }
        .info-item { font-size:16px; white-space:nowrap; }
        .row { padding-bottom:5px; border-bottom:1px solid #000; }
        .row-title { font-family:'B Titr'; font-weight:bold; padding-right:5px; }
        .attendees { display:flex; gap:5px; padding-right:10px; font-weight:900; flex-wrap:wrap; }
        .attendee { display:flex; align-items:center; gap:5px; margin-bottom:10px;font-weight:900 }
        .checkbox { width:10px; height:10px; border:2px solid #000; display:flex; align-items:center; justify-content:center; font-size:12px; background:#fff; }
        .signatures { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; padding:20px 0; border-bottom:1px solid #000; }
        .signature { text-align:center; }
        .signature-name { font-weight:bold; font-size:14px; margin-top:25px; }
        .signature-position { font-size:12px; font-weight:bold; margin-top:5px; }
        .footer-note { font-size:12px; text-align:justify; line-height:1.5; padding:10px; }
        .underline { display:inline-block; width:100px; border-bottom:1px solid #000; margin:0 5px; }
        .resolution-content { padding:0 15px; text-align:justify; line-height:1.8; font-size:16px; font-weight:600; }
        * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo"><img src="${environment.selfEndpoint}/img/MainLogo.png" alt="لوگو" style="width:100%" /></div>
        <div class="company-name">شرکت پتروشیمی اصفهان</div>
      </div>

      <div class="container">
        <div class="row1">
          <div class="title">صورتجلسه هیئت مدیره</div>
          <div class="info-group">
            <div class="info-item">تاریخ جلسه: ${(meeting as any).mtDate || ''}</div>
            <div class="info-item">شماره صورتجلسه: ${(meeting as any).number || ''}</div>
            <div class="info-item">شماره مصوبه: ${resolution.number || (index + 1).toString().padStart(2, '0')}</div>
          </div>
        </div>

      

        <div class="row">
          <div class="attendees">
            <div class="row-title"><span>حاضرین:</span></div>
            ${attendeesHtml}
          </div>
        </div>
        ${secretaryHtml}
        <div class="row">
          <div class="row-title" style="display:inline">موضوع: </div><span>${this.escapeHtml((resolution as any).title || '')}</span>
        </div>

        ${documentationSection}
        ${descriptionSection}
        ${decisionsMadeSection}

        <div class="signatures">${signaturesHtml}</div>

        <div class="footer-note">
          در راستای رعایت مفاد ماده 129 اصلاحیه قانون تجارت، جناب آقای <span class="underline"></span> در تصمیم گیری
          بند <span class="underline"></span> مشارکت نداشته اند / امضاء
        </div>
      </div>

      <script>
        window.onload = function() {
          window.print();
          setTimeout(() => window.close(), 100);
        };
      </script>
    </body>
    </html>
    `);
    // newWin.document.close();
  }

  private renderBoardAllDocument(
    newWin: Window,
    args: PrintAllArgs,
    attendees: any[],
    secretary: any | null
  ): void {
    const { meeting, resolutions } = args;

    const attendeesHtml = attendees
      .map(
        (m) => `
        <div class="attendee">
          <div class="checkbox">✓</div>
          <span>${this.escapeHtml(m.fullName || m.name || '')}</span>
        </div>`
      )
      .join('');

    const secretaryName = secretary?.fullName || secretary?.name || (meeting as any)?.secretary || '';
    const secretaryHtml = secretaryName
      ? `
      <div class="row">
        <div class="attendees">
          <div class="attendee"><span style="font-weight:bold;">دبیر جلسه:</span></div>
          <div class="attendee"><div class="checkbox">✓</div><span>${this.escapeHtml(secretaryName)}</span></div>
        </div>
      </div>`
      : '';

    let allPages = '';
    resolutions.forEach((resolution, index) => {
      const signaturesHtml = this.renderSignaturesGrid(attendees, secretary);

      const documentationSection = (resolution as any)?.documentation?.trim()
        ? `
        <div class="row">
          <div class="row-title">سوابق و مستندات:</div>
          <div class="resolution-content">${(resolution as any).documentation}</div>
        </div>`
        : '';

      const descriptionSection = ((resolution as any)?.description?.trim() || (resolution as any)?.text?.trim())
        ? `
        <div class="row">
          <div class="row-title">توضیحات:</div>
          <div class="resolution-content">${(resolution as any).description || (resolution as any).text}</div>
        </div>`
        : '';

      const decisionsMadeSection = (resolution as any)?.decisionsMade?.trim()
        ? `
        <div class="row">
          <div class="row-title">تصمیمات متخذه:</div>
          <div class="resolution-content">${(resolution as any).decisionsMade}</div>
        </div>`
        : '';

      allPages += `
      <div class="resolution-page" ${index < resolutions.length - 1 ? 'style="page-break-after: always;"' : ''}>
        <div class="header">
          <div class="logo"><img src="${environment.selfEndpoint}/img/MainLogo.png" alt="لوگو" style="width:100%" /></div>
          <div class="company-name">شرکت پتروشیمی اصفهان</div>
        </div>

        <div class="container">
          <div class="row1">
            <div class="title">صورتجلسه هیئت مدیره</div>
            <div class="info-group">
              <div class="info-item">تاریخ جلسه: ${(meeting as any).mtDate || ''}</div>
              <div class="info-item">شماره صورتجلسه: ${(meeting as any).number || ''}</div>
              <div class="info-item">شماره مصوبه: ${resolution.number || (index + 1).toString().padStart(2, '0')}</div>
            </div>
          </div>

          
          <div class="row">
            <div class="attendees">
              <div class="row-title"><span>حاضرین:</span></div>
              ${attendeesHtml}
            </div>
          </div>
          ${secretaryHtml}

          <div class="row">
            <div class="row-title" style="display:inline">موضوع: </div><span>${this.escapeHtml((resolution as any).title || '')}</span>
          </div>

          ${documentationSection}
          ${descriptionSection}
          ${decisionsMadeSection}

          <div class="signatures">${signaturesHtml}</div>

          <div class="footer-note">
            در راستای رعایت مفاد ماده 129 اصلاحیه قانون تجارت، جناب آقای <span class="underline"></span> در تصمیم گیری
            بند <span class="underline"></span> مشارکت نداشته اند / امضاء
          </div>
        </div>
      </div>`;
    });

    newWin.document.open();
    newWin.document.write(`
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>صورتجلسه هیئت مدیره - تمام مصوبات</title>
      <style>
        body { font-family: 'B Nazanin','Tahoma',sans-serif; margin:0; padding:20px; direction:rtl; text-align:right; background:#fff; font-size:14px; line-height:1.6; }
        .container { margin:0 auto; background:#fff; border:2px solid #000; }
        .header { text-align:center; }
        .logo { width:85px; height:65px; margin:0 auto 10px; border-radius:50%; display:flex; align-items:center; justify-content:center; }
        .company-name { font-size:18px; font-weight:bold; margin-bottom:20px; }
        .row1 { width:100%; border-bottom:1px solid #000; padding:15px 0; }
        .title { font-size:18px; font-weight:bold; text-align:center; }
        .info-group { display:flex; gap:30px; justify-content:space-between; padding:0 34px 0 14px; }
        .info-item { font-size:16px; white-space:nowrap; }
        .row { padding-bottom:5px; border-bottom:1px solid #000; }
        .row-title { font-family:'B Titr'; font-weight:bold; padding-right:10px; }
        .attendees { display:flex; gap:5px; padding-right:10px; font-weight:900; flex-wrap:wrap; }
        .attendee { display:flex; align-items:center; gap:5px; margin-bottom:10px; }
        .checkbox { width:10px; height:10px; border:2px solid #000; display:flex; align-items:center; justify-content:center; font-size:12px; background:#fff; }
        .signatures { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; padding:20px 0; border-bottom:1px solid #000; }
        .signature { text-align:center; }
        .signature-name { font-weight:bold; font-size:14px; margin-top:25px; }
        .signature-position { font-size:12px; font-weight:bold; margin-top:5px; }
        .footer-note { font-size:12px; text-align:justify; line-height:1.5; padding:10px; }
        .underline { display:inline-block; width:100px; border-bottom:1px solid #000; margin:0 5px; }
        .resolution-content { padding:0 15px; text-align:justify; line-height:1.8; font-size:16px; font-weight:600; }
        * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
      </style>
    </head>
    <body>
      ${allPages}
      <script>
        window.onload = function() {
          window.print();
          setTimeout(() => window.close(), 100);
        };
      </script>
    </body>
    </html>
    `);
    newWin.document.close();
  }

  private renderSignaturesGrid(attendees: any[], secretary: any | null): string {
    const members = secretary ? [...attendees, secretary] : [...attendees];

    let html = '';
    for (let i = 0; i < 6; i++) {
      if (i < members.length) {
        const m = members[i];
        const name = this.escapeHtml(m.fullName || m.name || '');
        const pos = this.escapeHtml(m.position || m.positionTitle || (m.isSecretary ? 'دبیر جلسه' : 'عضو هیئت مدیره'));

        html += `
        <div class="signature">
          <div class="signature-name">${name}</div>
          <div class="signature-position">${pos}</div>
        </div>`;
      } else {
        html += `<div class="signature"></div>`;
      }
    }

    return html;
  }
}