// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export type FileKind = 'pdf' | 'loading' | 'unknown';

export type FileScope = 'agenda' | 'resolution';

export interface FileItem {
  id: number;
  name: string;
  url: string;
  type: FileKind;

  size?: number;
  sizeFormatted?: string;
  uploadDate?: string;

  guid?: string;
  fileGuid?: string;

  isRemoved?: boolean;
  isLazyLoaded?: boolean;
  isUploading?: boolean;
  uploadProgress?: number;

  scope: FileScope;

  agendaText?: string;
  agendaIndex?: number;

  isBlobUrl?: boolean;
}

export interface UserWithPosition {
  userGuid: string;
  userName: string;
  positionGuid: string | null;
  positionTitle: string;
  personalNo: string;
  uniqueKey: string;
}

export interface ResolutionFileDto {
  id: number;
  isRemoved: boolean;
  fileGuid: string;
}

export interface ActorItemDto {
  id: number;
  userGuid: string;
  positionGuid: string | null;
  isRemoved: boolean;
}

export interface AssignmentItemDto {
  actors: ActorItemDto[];
  follower: ActorItemDto;
  type: string;
  dueDate: string;
}

export interface BoardAssignmentItemDto {
  actors: ActorItemDto[];
  followerGuid: string;
  followerPositionGuid: string;
  dueDate: string;
  status?: string;
  result?: string;
  description?: string;
  isRemoved: boolean;
}

export interface CreateResolutionDto {
  id?: number;
  description: string;
  meetingGuid: string;
  files: ResolutionFileDto[];
  assignments: AssignmentItemDto[];
}

export interface CreateResolutionBoardMeetingDto {
  id?: number;
  title: string;
  number?: string;
  description?: string;
  decisionsMade?: string;
  documentation?: string;
  contractNumber?: string;
  approvedPrice?: number;
  meetingGuid: string;
  parentMeetingGuid?: string;
  parentResolutionId?: number;
  committeeMeetingGuid?: string;
  committeeResolutionId?: number;
  files: ResolutionFileDto[];
  items: BoardAssignmentItemDto[];
}

/** اطلاعات فایل یک دستور جلسه (پیش از دریافت متادیتا) */
export interface AgendaFileInfo {
  agendaIndex: number;
  agendaText: string;
  fileGuid: string;
}

// ═══════════════════════════════════════════════════════════
// Constants / UI lists
// ═══════════════════════════════════════════════════════════

export const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

export const ACTION_STATUS_LIST = [
  { guid: '1', title: 'در انتظار اقدام' },
  { guid: '2', title: 'در حال انجام' },
  { guid: '3', title: 'پایان یافته' },
];

export const ASSIGNMENT_RESULT_LIST = [
  { guid: '1', title: 'انجام شده' },
  { guid: '2', title: 'انجام نشده' },
];
