import { Injectable, inject } from '@angular/core';

import { MeetingMember } from '../../../core/models/Meeting';
import { SystemUser } from '../../../core/models/User';
import { BoardMember } from '../../../core/models/BoardMember';
import { generateGuid } from '../../../core/types/configuration';
import { MeetingRoles } from '../../../core/meeting-access/meeting-roles';
import { UserService } from '../../../services/user.service';
import { CategoryPermissionService } from '../../../services/category-permission.service';
import { TusUploadService } from '../../../services/framework-services/tus-upload.service';
import { getClientSettings } from '../../../services/framework-services/code-flow.service';
import { DEFAULT_AVATAR } from './meeting-ops.models';
import {
  buildAllUsersIndexes,
  createFallbackExternalMember,
  getDefaultMemberImage,
  getSystemUserImage,
  pickPreferredEntry,
  processUsersForMultiPosition,
  resolveMeetingPositionTitle
} from './meeting-ops.helpers';

/** داده‌های لازم برای پردازش اعضای جلسه موجود (ویرایش) */
export interface ExistingMembersContext {
  allUsers: SystemUser[];
  boardMembers: BoardMember[];
  /** اعضای انتخاب‌شده فعلی (در لحظه پردازش هر عضو خوانده می‌شود) */
  getSelectedMembers: () => MeetingMember[];
  /** نوع جلسه (در لحظه پردازش هر عضو خوانده می‌شود) */
  isBoardMeeting: () => boolean;
}

/** داده‌های لازم برای به‌روزرسانی اعضا در حالت کپی جلسه */
export interface CloneMembersContext {
  systemUsers: SystemUser[];
  boardMembers: BoardMember[];
  allSystemUsers: SystemUser[];
  isBoardMeeting: boolean;
}

/**
 * سرویس سطح کامپوننت برای آماده‌سازی و نگاشت اعضای جلسه
 * (کاربران مجاز، اعضای هیئت مدیره، اعضای جلسه موجود و کپی جلسه).
 * هیچ state ای نگه نمی‌دارد؛ ورودی‌ها از کامپوننت ارسال می‌شوند.
 */
@Injectable()
export class MeetingOpsMembersService {
  private readonly userService = inject(UserService);
  private readonly categoryPermissionService = inject(CategoryPermissionService);
  private readonly tusUploadService = inject(TusUploadService);

  async loadAuthorizedUsers(categoryId: string): Promise<SystemUser[]> {
    try {
      const permissions = await this.categoryPermissionService.getByCategoryGuid(categoryId).toPromise();
      if (!permissions || permissions.length === 0) {
        return [];
      }
      const clientId = getClientSettings()?.client_id ?? '';
      const allUsers = await this.userService.getAllByClientId(clientId).toPromise() || [];
      if (!allUsers) {
        return [];
      }
      const processedUsers = processUsersForMultiPosition(allUsers as SystemUser[]);

      const authorizedPositionGuids = permissions.map(p => p.positionGuid);
      const authorizedUsers = processedUsers.filter(user => {
        const userPositionGuid = user.positionGuid ? user.positionGuid.toLowerCase() : '';
        const isAuthorized = authorizedPositionGuids
          .filter(posGuid => !!posGuid)
          .map(posGuid => posGuid.toLowerCase())
          .includes(userPositionGuid);
        return isAuthorized;
      });
      // Process به composite
      return authorizedUsers;
    } catch (error) {
      console.error('خطا در بارگذاری کاربران مجاز:', error);
      return [];
    }
  }

  async mergeSystemAndAuthorizedUsers(boardMembers: BoardMember[], authorizedUsers: SystemUser[]): Promise<SystemUser[]> {
    // ✅ جمع‌آوری همه profileGuid ها
    const profileGuidsToLoad: string[] = [];
    for (const bm of boardMembers) {
      if (bm.profileImageGuid) {
        profileGuidsToLoad.push(bm.profileImageGuid);
      }
    }

    // ✅ Batch load تصاویر
    const profileUrlMap = profileGuidsToLoad.length > 0
      ? await this.tusUploadService.getFilePreviewUrls(profileGuidsToLoad)
      : new Map<string, string>();

    // ✅ ساخت boardAsUsers با تصاویر از TUS
    const boardAsUsers: SystemUser[] = boardMembers.map(bm => {
      let imageUrl = DEFAULT_AVATAR;
      if (bm.profileImageGuid) {
        const url = profileUrlMap.get(bm.profileImageGuid.toLowerCase());
        imageUrl = url || DEFAULT_AVATAR;
      }

      return {
        guid: bm.guid || bm.id || generateGuid(),
        name: bm.fullName,
        userName: '',
        position: bm.position || '',
        positionGuid: '',
        image: imageUrl,
        isSystem: false,
        baseUserGuid: undefined
      };
    });

    // ترکیب: unique بر اساس guid
    const allUsers = [...boardAsUsers, ...authorizedUsers];
    const uniqueUsers = new Map<string, SystemUser>();

    allUsers.forEach(user => {
      if (!uniqueUsers.has(user.guid)) {
        uniqueUsers.set(user.guid, { ...user });
      } else {
        const existing = uniqueUsers.get(user.guid)!;
        uniqueUsers.set(user.guid, { ...existing, image: user.image || existing.image });
      }
    });

    return Array.from(uniqueUsers.values()).sort((a, b) => a.name.localeCompare(b.name, 'fa'));
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ processExistingMembers - کامل‌تر با پشتیبانی Board Members
  // هدف: وقتی member.userGuid + member.positionGuid ذخیره شده ولی کاربر سمتش عوض شده،
  // دیگر matchingEntry undefined نشود و «سمت زمان جلسه» درست نمایش داده شود.
  // همچنین اگر کاربر غیرفعال (isActive=0) باشد، در خروجی مشخص شود.
  //
  // نکته کلیدی برای سناریوی isActive=0:
  // اگر API شما در userService.getAll() فقط کاربران فعال را برمی‌گرداند، entries برای کاربر غیرفعال
  // خالی می‌شود و وارد شاخه userMissingInAllUsers می‌روید.
  // پس باید مطمئن شوید getAll() «کاربران غیرفعال» را هم برگرداند یا یک endpoint جدا برای includeInactive داشته باشید.
  // ═══════════════════════════════════════════════════════════
  async processExistingMembers(members: MeetingMember[], ctx: ExistingMembersContext): Promise<MeetingMember[]> {
    const processedMembers: MeetingMember[] = [];
    const allUsers = ctx.allUsers;
    const boardMembers = ctx.boardMembers;

    // ✅ ایندکس‌ها
    const { byBaseGuid, positionTitleByGuid } = buildAllUsersIndexes(allUsers);

    // ✅ جمع‌آوری GUID تصاویر (هم members و هم board members)
    const imageGuidsToLoad: string[] = [];
    for (const member of members) {
      if (member.profileGuid) imageGuidsToLoad.push(member.profileGuid);

      if (member.boardMemberGuid) {
        const bm = boardMembers.find(x => x.guid === member.boardMemberGuid || x.id === member.boardMemberGuid);
        if (bm?.profileImageGuid) imageGuidsToLoad.push(bm.profileImageGuid);
      }
    }

    // ✅ Batch load URL های تصاویر
    const imageUrlMap = imageGuidsToLoad.length > 0
      ? await this.tusUploadService.getFilePreviewUrls(imageGuidsToLoad)
      : new Map<string, string>();

    // نام جانشین از روی اعضای انتخاب‌شده فعلی
    const resolveSubstitute = (member: MeetingMember, m: any) => {
      if (member.replacementUserGuid) {
        const selectedMembers = ctx.getSelectedMembers();
        m.substitute = selectedMembers.find(x => x.userGuid === member.replacementUserGuid)?.name || '';
      }
    };

    for (const member of members) {
      // any فقط برای فیلدهای کمکی جهت UI (اختیاری)
      const m: any = { ...member };

      // -------------------------------------------------------------------------
      // Board Members
      // -------------------------------------------------------------------------
      if (member.boardMemberGuid) {
        const bm = boardMembers.find(x => x.guid === member.boardMemberGuid || x.id === member.boardMemberGuid);
        if (bm) {
          m.name = bm.fullName;
          m.position = bm.position || m.position || 'سمت نامشخص';

          if (bm.profileImageGuid) {
            const img = imageUrlMap.get(bm.profileImageGuid.toLowerCase());
            m.image = img || DEFAULT_AVATAR;
          } else {
            m.image = DEFAULT_AVATAR;
          }
        }

        // substitute (اختیاری)
        resolveSubstitute(member, m);

        processedMembers.push(m);
        continue;
      }

      // -------------------------------------------------------------------------
      // System Users
      // -------------------------------------------------------------------------
      if (member.userGuid && !member.isExternal) {
        const entries = byBaseGuid.get(member.userGuid) || [];

        // عنوان سمت زمان جلسه (حتی اگر سمت عوض شده باشد)
        const meetingPositionTitle = resolveMeetingPositionTitle(member, positionTitleByGuid);

        // 1) match دقیق: همان positionGuid ذخیره‌شده در جلسه
        const exact = member.positionGuid
          ? entries.find(u => u.positionGuid === member.positionGuid)
          : undefined;

        if (exact) {
          // سمت هنوز همان است
          m.guid = exact.guid;
          m.positionGuid = exact.positionGuid; // همان سمت جلسه
          m.position = meetingPositionTitle;   // نمایش سمت زمان جلسه
          m.currentPosition = exact.position || '';
          m.currentPositionGuid = exact.positionGuid || '';
          m.positionChanged = false;
          m.userIsActive = (exact as any).userIsActive ?? true;
        } else if (entries.length > 0) {
          // سمت تغییر کرده (کاربر هست ولی positionGuid قدیمی دیگر در رکوردهای current نیست)
          const preferred = pickPreferredEntry(entries);

          m.guid = preferred.guid; // برای اینکه در UI selectable باشد

          // مهم: positionGuid زمان جلسه را نگه داریم تا بتوانیم تاریخچه/سمت زمان جلسه را نمایش دهیم
          m.positionGuid = member.positionGuid || '';
          m.position = meetingPositionTitle; // نمایش سمت زمان جلسه

          // سمت فعلی را هم برای UI نگه می‌داریم
          m.currentPosition = preferred.position || '';
          m.currentPositionGuid = preferred.positionGuid || '';

          // فلگ‌ها
          m.positionChanged = !!member.positionGuid; // اگر قبلاً سمت داشته و الان exact پیدا نشده => تغییر کرده
          m.userIsActive = (preferred as any).userIsActive ?? true;
        } else {
          // حالت نادر: allUsers شما این کاربر را برنگردانده (مثلاً API فقط activeها را داده)
          // با این حال ما سمت زمان جلسه را با map یا snapshot نشان می‌دهیم تا undefined نشود.
          m.position = meetingPositionTitle;
          m.positionGuid = member.positionGuid || '';
          m.userMissingInAllUsers = true;
        }

        // تصویر
        if (member.profileGuid) {
          const img = imageUrlMap.get(member.profileGuid.toLowerCase());
          m.image = img || getDefaultMemberImage(member, ctx.isBoardMeeting());
        } else {
          // اگر userName داشته باشیم می‌توانیم عکس سیستم را نشان دهیم
          const fallbackUser = entries.length > 0 ? pickPreferredEntry(entries) : null;
          m.image = fallbackUser ? getSystemUserImage(fallbackUser) : getDefaultMemberImage(member, ctx.isBoardMeeting());
        }

        // substitute
        resolveSubstitute(member, m);

        processedMembers.push(m);
        continue;
      }

      // -------------------------------------------------------------------------
      // External Guests
      // -------------------------------------------------------------------------
      if (member.isExternal) {
        m.position = m.position || member.organization || 'مهمان';

        if (member.profileGuid) {
          const img = imageUrlMap.get(member.profileGuid.toLowerCase());
          m.image = img || DEFAULT_AVATAR;
        } else {
          m.image = DEFAULT_AVATAR;
        }

        // substitute
        resolveSubstitute(member, m);

        processedMembers.push(m);
        continue;
      }

      // -------------------------------------------------------------------------
      // Fallback
      // -------------------------------------------------------------------------
      m.position = m.position || 'سمت نامشخص';
      m.image = m.image || DEFAULT_AVATAR;

      resolveSubstitute(member, m);

      processedMembers.push(m);
    }

    return processedMembers;
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ updateMembersForClone - Batch load تصاویر
  // ═══════════════════════════════════════════════════════════
  async updateMembersForClone(originalMembers: MeetingMember[], ctx: CloneMembersContext): Promise<MeetingMember[]> {
    const { boardMembers, isBoardMeeting } = ctx;

    // ✅ جمع‌آوری همه GUID های تصاویر برای batch load
    const imageGuidsToLoad: string[] = [];

    for (const member of originalMembers) {
      if (member.profileGuid) {
        imageGuidsToLoad.push(member.profileGuid);
      }
      if (isBoardMeeting && member.boardMemberGuid) {
        const boardMember = boardMembers.find(bm =>
          bm.id === member.boardMemberGuid || bm.guid === member.boardMemberGuid
        );
        if (boardMember?.profileImageGuid) {
          imageGuidsToLoad.push(boardMember.profileImageGuid);
        }
      }
    }

    // ✅ Batch load تصاویر
    const imageUrlMap = imageGuidsToLoad.length > 0
      ? await this.tusUploadService.getFilePreviewUrls(imageGuidsToLoad)
      : new Map<string, string>();

    const updatedMembers: MeetingMember[] = [];

    for (const originalMember of originalMembers) {
      try {
        const updatedMember = await this.updateSingleMemberForCloneWithCache(originalMember, ctx, imageUrlMap);

        if (updatedMember) {
          updatedMembers.push(updatedMember);
        }
      } catch (error) {
        console.warn(`Failed to update member ${originalMember.name}:`, error);
        const fallbackMember = await createFallbackExternalMember(originalMember);
        if (fallbackMember) {
          updatedMembers.push(fallbackMember);
        }
      }
    }

    return updatedMembers;
  }

  // ✅ به‌روزرسانی یک عضو با استفاده از cache تصاویر
  private async updateSingleMemberForCloneWithCache(
    originalMember: MeetingMember,
    ctx: CloneMembersContext,
    imageUrlMap: Map<string, string>
  ): Promise<MeetingMember | null> {
    const { systemUsers, boardMembers, allSystemUsers, isBoardMeeting } = ctx;
    let updatedMember: MeetingMember = {
      ...originalMember,
      id: 0,
      guid: generateGuid()
    };

    if (isBoardMeeting && originalMember.boardMemberGuid) {
      const currentBoardMember = boardMembers.find(bm =>
        bm.id === originalMember.boardMemberGuid || bm.guid === originalMember.boardMemberGuid
      );

      if (currentBoardMember) {
        updatedMember = {
          ...updatedMember,
          name: currentBoardMember.fullName,
          position: currentBoardMember.position || '',
          boardMemberGuid: currentBoardMember.id || currentBoardMember.guid
        };

        // ✅ تصویر از cache
        if (currentBoardMember.profileImageGuid) {
          const imageUrl = imageUrlMap.get(currentBoardMember.profileImageGuid.toLowerCase());
          updatedMember.image = imageUrl || DEFAULT_AVATAR;
        } else {
          updatedMember.image = DEFAULT_AVATAR;
        }
      } else {
        return null;
      }
    } else if (originalMember.userGuid && !originalMember.isExternal) {
      let currentUser = systemUsers.find(u => u.baseUserGuid === originalMember.userGuid);

      if (!currentUser) {
        currentUser = allSystemUsers.find(u => u.baseUserGuid === originalMember.userGuid);
      }

      if (currentUser) {
        updatedMember = {
          ...updatedMember,
          name: currentUser.name,
          position: currentUser.position || '',
          positionGuid: currentUser.positionGuid || '',
          userName: currentUser.userName,
          userGuid: currentUser.baseUserGuid,
          image: getSystemUserImage(currentUser)
        };
      } else {
        return await createFallbackExternalMember(originalMember);
      }
    } else if (originalMember.isExternal) {
      // ✅ تصویر مهمان از cache
      if (originalMember.profileGuid) {
        const imageUrl = imageUrlMap.get(originalMember.profileGuid.toLowerCase());
        updatedMember.image = imageUrl || DEFAULT_AVATAR;
      } else if (!updatedMember.image) {
        updatedMember.image = DEFAULT_AVATAR;
      }
    }

    return updatedMember;
  }

  /**
   * ساخت لیست اعضای پیش‌فرض جلسه هیئت مدیره از کاربران در دسترس.
   * @returns null اگر کاربری در دسترس نباشد (در این حالت لیست اعضا نباید تغییر کند)
   */
  async buildAutoSelectedBoardMembers(
    availableUsers: SystemUser[],
    boardMembersData: BoardMember[]
  ): Promise<MeetingMember[] | null> {
    const boardMembers = availableUsers;
    if (boardMembers.length === 0) return null;

    // ✅ جمع‌آوری همه profileGuid های اعضای هیئت مدیره
    const profileGuidsToLoad: string[] = [];
    const guidToMemberMap = new Map<string, BoardMember>();

    for (const availableUser of boardMembers) {
      // فقط برای اعضای هیئت مدیره (غیر سیستمی)
      if (availableUser.isSystem === false) {
        const boardMember = boardMembersData.find(bm =>
          bm.guid === availableUser.guid
        );
        if (boardMember?.profileImageGuid) {
          profileGuidsToLoad.push(boardMember.profileImageGuid);
          guidToMemberMap.set(boardMember.profileImageGuid.toLowerCase(), boardMember);
        }
      }
    }

    // ✅ Batch load تصاویر
    const profileUrlMap = profileGuidsToLoad.length > 0
      ? await this.tusUploadService.getFilePreviewUrls(profileGuidsToLoad)
      : new Map<string, string>();

    const autoSelectedMembers: MeetingMember[] = [];

    for (const boardMember of boardMembers) {
      let memberImage = DEFAULT_AVATAR;

      // ✅ تنظیم تصویر
      if (boardMember.isSystem === false) {
        // عضو هیئت مدیره
        const originalBoardMember = boardMembersData.find(bm =>
          bm.guid === boardMember.guid
        );
        if (originalBoardMember?.profileImageGuid) {
          const url = profileUrlMap.get(originalBoardMember.profileImageGuid.toLowerCase());
          memberImage = url || DEFAULT_AVATAR;
        }
      } else if (boardMember.isSystem === true) {
        // کاربر سیستم
        memberImage = boardMember.image || getSystemUserImage(boardMember as SystemUser);
      }

      const memberData: MeetingMember = {
        id: 0,
        guid: generateGuid(),
        boardMemberGuid: boardMember.isSystem === false ? boardMember.guid : null,
        userGuid: boardMember.isSystem === true ? boardMember.baseUserGuid : undefined,
        positionGuid: boardMember.isSystem === true ? boardMember.positionGuid : null,
        name: boardMember.name,
        position: boardMember.position || '',
        roleId: MeetingRoles.member, // عضو عادی
        isExternal: false,
        isRemoved: false,
        image: memberImage,
        isSystem: boardMember.isSystem
      };

      autoSelectedMembers.push(memberData);
    }

    return autoSelectedMembers;
  }
}
