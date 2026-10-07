import { Injectable, WritableSignal, inject, signal } from '@angular/core';

import { BoardMember } from '../../../../core/models/BoardMember';
import { TusUploadService } from '../../../../services/framework-services/tus-upload.service';
import { DEFAULT_AVATAR, ProcessedMember } from './meeting-participants.models';

/**
 * سرویس سطح کامپوننت برای لود تصاویر اعضا (مهمان‌های خارجی و اعضای هیئت مدیره) از TUS
 * و نگهداری cache آدرس تصاویر.
 * پیش از استفاده باید با bind به signal اعضای پردازش‌شده کامپوننت متصل شود.
 */
@Injectable()
export class MemberImagesService {
  private readonly tusUploadService = inject(TusUploadService);

  /** cache آدرس تصاویر (کلید: GUID فایل با حروف کوچک) */
  private readonly _fileUrls = signal<Map<string, string>>(new Map());

  private members!: WritableSignal<ProcessedMember[]>;
  private getBoardMembers: () => BoardMember[] = () => [];

  /** اتصال به state کامپوننت والد */
  bind(members: WritableSignal<ProcessedMember[]>, getBoardMembers: () => BoardMember[]): void {
    this.members = members;
    this.getBoardMembers = getBoardMembers;
  }

  /** آدرس cache شده تصویر (در صورت وجود) */
  getCachedUrl(profileImageGuid: string): string | undefined {
    return this._fileUrls().get(profileImageGuid.toLowerCase());
  }

  // ═══════════════════════════════════════════════════════════
  // لود تصویر پروفایل مهمان با TUS
  // ═══════════════════════════════════════════════════════════

  /**
   * لود URL تصویر پروفایل با استفاده از TusUploadService
   */
  private async loadGuestProfileImage(profileGuid: string): Promise<string> {
    if (!profileGuid) return DEFAULT_AVATAR;

    try {
      const url = await this.tusUploadService.getFilePreviewUrl(profileGuid);
      return url || DEFAULT_AVATAR;
    } catch (error) {
      console.warn('Failed to load guest profile image:', error);
      return DEFAULT_AVATAR;
    }
  }

  /**
   * لود async تصویر و آپدیت کردن member
   */
  async loadAndSetMemberImage(memberGuid: string, profileGuid: string): Promise<void> {
    try {
      const imageUrl = await this.loadGuestProfileImage(profileGuid);

      // پیدا کردن و آپدیت کردن member
      const currentMembers = this.members();
      const memberIndex = currentMembers.findIndex(m => m.guid === memberGuid);

      if (memberIndex !== -1) {
        const updatedMembers = [...currentMembers];
        updatedMembers[memberIndex] = {
          ...updatedMembers[memberIndex],
          image: imageUrl
        };
        this.members.set(updatedMembers);
      }
    } catch (error) {
      console.warn('Failed to load member image:', error);
    }
  }

  /**
   * لود batch تصاویر پروفایل مهمان‌های خارجی
   */
  async loadExternalGuestImages(members: ProcessedMember[]): Promise<void> {
    // جمع‌آوری همه profileGuid های مهمان‌های خارجی
    const guestProfileGuids: { memberGuid: string; profileGuid: string }[] = [];

    for (const member of members) {
      if (member.isExternal && member.profileGuid && !member.image?.startsWith('http')) {
        guestProfileGuids.push({
          memberGuid: member.guid,
          profileGuid: member.profileGuid
        });
      }
    }

    if (guestProfileGuids.length === 0) return;

    // گرفتن URL ها به صورت batch
    const guids = guestProfileGuids.map(g => g.profileGuid);
    const urlMap = await this.tusUploadService.getFilePreviewUrls(guids);

    // آپدیت کردن members با URL های جدید
    this.applyImageUrls(guestProfileGuids, urlMap);
  }

  /**
   * اعمال URL تصاویر روی اعضا (بر اساس memberGuid)؛ فقط در صورت تغییر، signal به‌روز می‌شود
   */
  private applyImageUrls(
    items: { memberGuid: string; profileGuid: string }[],
    urlMap: Map<string, string>
  ): void {
    const currentMembers = [...this.members()];
    let hasUpdates = false;

    for (const { memberGuid, profileGuid } of items) {
      const url = urlMap.get(profileGuid.toLowerCase());
      if (url) {
        const memberIndex = currentMembers.findIndex(m => m.guid === memberGuid);
        if (memberIndex !== -1 && currentMembers[memberIndex].image !== url) {
          currentMembers[memberIndex] = {
            ...currentMembers[memberIndex],
            image: url
          };
          hasUpdates = true;
        }
      }
    }

    if (hasUpdates) {
      this.members.set(currentMembers);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ جایگزین loadBoardMemberImage - استفاده از TUS
  // ═══════════════════════════════════════════════════════════

  async loadBoardMemberImageAsync(profileImageGuid: string): Promise<void> {
    if (!profileImageGuid) return;

    const normalizedGuid = profileImageGuid.toLowerCase();

    // اگر قبلاً در حال لود است، return کن
    const currentUrls = this._fileUrls();
    if (currentUrls.has(normalizedGuid)) return;

    try {
      const url = await this.tusUploadService.getFilePreviewUrl(profileImageGuid);

      if (url) {
        const newUrls = new Map(this._fileUrls());
        newUrls.set(normalizedGuid, url);
        this._fileUrls.set(newUrls);

        // آپدیت کردن members که این تصویر را دارند
        this.updateMembersWithImage(profileImageGuid, url);
      }
    } catch (error) {
      console.warn('خطا در بارگذاری تصویر:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ آپدیت members بعد از لود تصویر
  // ═══════════════════════════════════════════════════════════

  private updateMembersWithImage(profileImageGuid: string, imageUrl: string): void {
    const currentMembers = this.members();
    const boardMembers = this.getBoardMembers();

    let hasUpdates = false;
    const updatedMembers = currentMembers.map(member => {
      // پیدا کردن board member مربوطه
      if (member.boardMemberGuid) {
        const boardMember = boardMembers.find(bm =>
          bm.guid === member.boardMemberGuid || bm.id === member.boardMemberGuid
        );

        if (boardMember?.profileImageGuid?.toLowerCase() === profileImageGuid.toLowerCase()) {
          if (member.image !== imageUrl) {
            hasUpdates = true;
            return { ...member, image: imageUrl };
          }
        }
      }
      return member;
    });

    if (hasUpdates) {
      this.members.set(updatedMembers);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ Batch load تصاویر Board Members
  // ═══════════════════════════════════════════════════════════

  async loadBoardMemberImages(members: ProcessedMember[]): Promise<void> {
    const boardMembers = this.getBoardMembers();

    // جمع‌آوری همه profileGuid های board members
    const imageGuidsToLoad: { memberGuid: string; profileGuid: string }[] = [];

    for (const member of members) {
      if (member.boardMemberGuid) {
        const boardMember = boardMembers.find(bm =>
          bm.guid === member.boardMemberGuid || bm.id === member.boardMemberGuid
        );

        if (boardMember?.profileImageGuid) {
          const normalizedGuid = boardMember.profileImageGuid.toLowerCase();
          // فقط اگر در cache نیست
          if (!this._fileUrls().has(normalizedGuid)) {
            imageGuidsToLoad.push({
              memberGuid: member.guid,
              profileGuid: boardMember.profileImageGuid
            });
          }
        }
      }
    }

    if (imageGuidsToLoad.length === 0) return;

    // Batch load
    const guids = imageGuidsToLoad.map(g => g.profileGuid);
    const urlMap = await this.tusUploadService.getFilePreviewUrls(guids);

    // آپدیت cache
    const newFileUrls = new Map(this._fileUrls());
    urlMap.forEach((url, guid) => {
      newFileUrls.set(guid.toLowerCase(), url);
    });
    this._fileUrls.set(newFileUrls);

    // آپدیت members
    this.applyImageUrls(imageGuidsToLoad, urlMap);
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ cleanupBlobUrls - فقط blob URLs را پاک کن
  // ═══════════════════════════════════════════════════════════

  cleanupBlobUrls(): void {
    const fileUrls = this._fileUrls();
    fileUrls.forEach(url => {
      // ✅ فقط blob URLs را revoke کن (TUS URLs نباید revoke بشن)
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });

    const members = this.members();
    members.forEach(member => {
      if (member.image && member.image.startsWith('blob:')) {
        URL.revokeObjectURL(member.image);
      }
    });
  }
}
