/**
 * وضعیت‌های جلسه (هم‌نام با MeetingStatusIds در سرور) — تنها محل تعریف این اعداد در فرانت.
 *   1 پیش‌نویس • 2 ثبت اولیه • 3 برگزار شده • 4 ثبت نهایی • 5 لغو شده • 6 اتمام یافته • 7 تعیین تکلیف نشده
 */
export const MeetingStatus = {
  Draft: 1,
  Registered: 2,
  Held: 3,
  Finalized: 4,
  Cancelled: 5,
  Completed: 6,
  Undetermined: 7,
} as const;

export type MeetingStatusId = (typeof MeetingStatus)[keyof typeof MeetingStatus];

export const MEETING_STATUS_TITLES: Record<MeetingStatusId, string> = {
  1: 'پیش‌نویس',
  2: 'ثبت اولیه',
  3: 'برگزار شده',
  4: 'ثبت نهایی',
  5: 'لغو شده',
  6: 'اتمام یافته',
  7: 'تعیین تکلیف نشده',
};

const S = MeetingStatus;

export const MeetingStatuses = {
  title(statusId: number | null | undefined): string {
    return MEETING_STATUS_TITLES[statusId as MeetingStatusId] ?? '';
  },

  is(statusId: number | null | undefined, ...statuses: MeetingStatusId[]): boolean {
    return statusId != null && statuses.includes(Number(statusId) as MeetingStatusId);
  },

  /** جلسه بسته است (لغو یا اتمام) و محتوایش تغییر نمی‌کند */
  isClosed(statusId: number | null | undefined): boolean {
    return this.is(statusId, S.Cancelled, S.Completed);
  },

  /** صورتجلسه نهایی شده (ثبت نهایی یا اتمام): محتوای مصوبات فقط با دسترسی ویژه قابل تغییر است */
  isMinutesLocked(statusId: number | null | undefined): boolean {
    return this.is(statusId, S.Finalized, S.Completed);
  },

  /** جلسه برگزار شده است (محتوا، مصوبات و صورتجلسه معنا دارند) */
  isHeldOrLater(statusId: number | null | undefined): boolean {
    return this.is(statusId, S.Held, S.Finalized, S.Completed);
  },

  /** هم‌راستا با MeetingStatusIds.CanTransition در سرور (سرور مرجع نهایی است) */
  canTransition(from: number | null | undefined, to: MeetingStatusId): boolean {
    switch (Number(from)) {
      case S.Draft: return to === S.Registered || to === S.Cancelled;
      case S.Registered: return to === S.Held || to === S.Cancelled || to === S.Undetermined || to === S.Completed;
      case S.Held: return to === S.Finalized || to === S.Undetermined || to === S.Completed;
      case S.Finalized: return to === S.Held || to === S.Completed;
      case S.Undetermined: return to === S.Held || to === S.Cancelled;
      case S.Cancelled: return to === S.Registered;
      default: return false;
    }
  },
};
