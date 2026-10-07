

export interface ConflictItem {
  guid: string;
  type: 'Meeting' | 'Leave' | 'BlockedTime';
  description?: string;
  startTime?: string;
  endTime?: string;

  // جزئیات جلسه تداخل‌دار
  conflictMeetingGuid?: string;
  conflictMeetingTitle?: string;
  conflictMeetingNumber?: string;
  conflictMeetingStartTime?: string;
  conflictMeetingEndTime?: string;
  conflictMeetingCreatorName?: string;
  conflictMeetingCreatedDate?: string;
}

export interface RoomConflictMeeting {
  guid: string;
  title: string;
  number?: string;
  startTime: string;
  endTime: string;
  creatorName?: string;
  createdDate?: string;
}

export interface ConflictResult {
  roomConflict: boolean;
  usersWithConflict: ConflictItem[];
  roomConflictMeeting?: RoomConflictMeeting;
}

export interface SuggestedSlot {
  startTime: string;
  endTime: string;
}