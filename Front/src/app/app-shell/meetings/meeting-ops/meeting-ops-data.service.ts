import { Injectable, inject } from '@angular/core';

import { MeetingMember } from '../../../core/models/Meeting';
import { SystemUser } from '../../../core/models/User';
import { BoardMember } from '../../../core/models/BoardMember';
import { ComboBase } from '../../../shared/combo-base';
import { POSITION_ID, USER_ID_NAME } from '../../../core/types/configuration';

import { CategoryService } from '../../../services/category.service';
import { MeetingService } from '../../../services/meeting.service';
import { RoomService } from '../../../services/room.service';
import { UserService } from '../../../services/user.service';
import { BoardMemberService } from '../../../services/board-member.service';
import { MeetingMemberService } from '../../../services/meeting-member.service';
import { LocalStorageService } from '../../../services/framework-services/local.storage.service';
import { PasswordFlowService } from '../../../services/framework-services/password-flow.service';
import { getClientSettings } from '../../../services/framework-services/code-flow.service';
import { LoadedMeetingData } from './meeting-ops.models';
import { processUsersForMultiPosition } from './meeting-ops.helpers';

/**
 * سرویس سطح کامپوننت برای بارگذاری داده‌های پایه فرم ثبت جلسه
 * (اتاق‌ها، دسته‌بندی‌ها، کاربران، اعضای هیئت مدیره، لیست جلسات و اطلاعات جلسه برای ویرایش/کپی).
 * خطاها همین‌جا لاگ می‌شوند و مقدار جایگزین برگردانده می‌شود.
 */
@Injectable()
export class MeetingOpsDataService {
  private readonly meetingService = inject(MeetingService);
  private readonly roomService = inject(RoomService);
  private readonly categoryService = inject(CategoryService);
  private readonly userService = inject(UserService);
  private readonly boardMemberService = inject(BoardMemberService);
  private readonly memberService = inject(MeetingMemberService);
  private readonly passwordFlowService = inject(PasswordFlowService);
  private readonly localStorageService = inject(LocalStorageService);

  async loadRooms(): Promise<ComboBase[]> {
    try {
      return await this.roomService.getForCombo<ComboBase[]>().toPromise() || [];
    } catch (error) {
      console.error('Error loading rooms:', error);
      return [];
    }
  }

  async loadCategories(): Promise<ComboBase[]> {
    try {
      const hasPermission = await this.passwordFlowService.checkPermission('MT_Meetings_ViewAllMeetings');
      return await this.categoryService.getForComboByCondition<ComboBase[]>(hasPermission).toPromise() || [];
    } catch (error) {
      console.error('Error loading categories:', error);
      return [];
    }
  }

  /** همه کاربران (پردازش‌شده بر اساس سمت)؛ در صورت خطا null */
  async loadAllUsers(): Promise<SystemUser[] | null> {
    try {
      const users = await this.userService.getAll<SystemUser[]>().toPromise() || [];

      return processUsersForMultiPosition(users);
    } catch (error) {
      console.error('Error loading users:', error);
      return null;
    }
  }

  /** کاربران سیستم جاری (پردازش‌شده بر اساس سمت)؛ در صورت خطا null */
  async loadSystemUsers(): Promise<SystemUser[] | null> {
    try {
      const clientId = getClientSettings().client_id ?? '';
      const users = await this.userService.getAllByClientId<SystemUser[]>(clientId).toPromise() || [];

      return processUsersForMultiPosition(users);
    } catch (error) {
      console.error('Error loading users:', error);
      return null;
    }
  }

  async loadBoardMembers(): Promise<BoardMember[]> {
    try {
      return await this.boardMemberService.getList<BoardMember[]>().toPromise() || [];
    } catch (error) {
      console.error('Error loading board members:', error);
      return [];
    }
  }

  /** لیست جلسات برای انتخاب «جلسه پیشین» (به جز جلسه جاری) */
  async loadMeetingsList(getCurrentMeetingGuid: () => string): Promise<ComboBase[]> {
    try {
      const userGuid = this.localStorageService.getItem(USER_ID_NAME);
      const positionGuid = this.localStorageService.getItem(POSITION_ID);
      const hasPermission = await this.passwordFlowService.checkPermission('MT_Meetings_ViewAllMeetings');

      const filter = {
        userGuid,
        positionGuid,
        filterType: 'All',
        canViewAll: hasPermission
      };

      const meetings = (await this.meetingService.getMeetings(filter).toPromise()) as any[] || [];
      return meetings
        .filter((meeting: any) => meeting.guid !== getCurrentMeetingGuid())
        .map((meeting: any) => ({
          guid: meeting.guid,
          title: `${meeting.number} - ${meeting.title}`
        }));
    } catch (error) {
      console.error('Error loading meetings list:', error);
      return [];
    }
  }

  /**
   * بارگذاری اطلاعات جلسه برای ویرایش یا کپی
   * @param isEdit حالت ویرایش (اعضا از editMembers خوانده می‌شوند)
   * @param isCloneOperation حالت کپی (اعضا از سرور خوانده می‌شوند)
   * @param editMembers تابع دریافت اعضای واقعی جلسه در حالت ویرایش
   * (حالت‌ها پس از دریافت جلسه از سرور ارزیابی می‌شوند)
   */
  async loadMeetingData(
    meetingGuid: string,
    isEdit: () => boolean,
    isCloneOperation: () => boolean,
    editMembers: () => MeetingMember[] | null | undefined
  ): Promise<LoadedMeetingData | null> {
    try {
      const meeting = await this.meetingService.getForEdit<any>(meetingGuid).toPromise();
      if (!meeting) return null;

      const userGuid = this.localStorageService.getItem(USER_ID_NAME);
      let members: MeetingMember[] = [];

      // بارگذاری اعضا بر اساس حالت عملیات
      const isClone = isCloneOperation();

      if (isEdit()) {
        // برای ویرایش: بارگذاری اعضای واقعی جلسه
        members = editMembers() || [];
        // members = await this.memberService.getUserList(meetingGuid, userGuid).toPromise() || [];

      } else if (isClone) {
        // برای کپی: بارگذاری اعضا برای کپی کردن
        members = await this.memberService.getUserList(meetingGuid, userGuid).toPromise() || [];
      }

      return {
        meeting,
        members,
        agendas: meeting?.agendas
      };
    } catch (error) {
      console.error('Error loading meeting data:', error);
      return null;
    }
  }
}
