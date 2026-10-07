import { Injectable } from '@angular/core';
import { ServiceBase } from './framework-services/service.base';
import { RequestConfig } from './framework-services/http.service';
import { Observable } from 'rxjs';
import { FollowerActorsActionCounts } from '../core/models/followersActorCounts';
import { POSITION_ID } from '../core/types/configuration';
export interface AssignmentTreeNode {
  id: number;
  actorGuid: string;
  followerGuid: string;
  actorName: string;
  referrerName: string;
  referralDate: string;
  referralNote: string;
  actionStatus: string;
  followStatus: string;
  isReferral: boolean;
  assignmentDate?: string;   // yyyy/MM/dd  (تاریخ ابلاغ/مبنای جلسه)
  level: number;
  dueDate: string;
  actorPersonalNo: string;
  canAddAction: boolean;
  canAddFollowup: boolean;
  canRefer: boolean;
  canEditAssignment: boolean;
  actions: ActionItem[];
  followups: ActionItem[];
  children: AssignmentTreeNode[];
  totalActions: number;
  totalFollowups: number;
  completedActions: number;
  pendingActions: number;
  actorPositionTitle?: string;
  isFollower: boolean
}

export interface ActionItem {
  id: number;
  description: string;
  type: 'Action' | 'Follow';
  status: string;
  date: string;
  statusStr?: string;
  followStatus?: string;
  followStatusStr?: string;

  userName: string;
  userGuid: string;
  canEdit: boolean;
  canDelete: boolean;
}

export interface CompleteAssignmentInfo {
  mainAssignment: any;
  referralTree: AssignmentTreeNode;
  summary: AssignmentTreeSummary;
  allActions: ActionItem[];
  allFollowups: ActionItem[];
  resolutionTitle: string;
  resolutionText: string;
  meetingTitle: string;
  meetingDate: string;
  meetingNumber: string;
  currentUserPermissions: UserPermissions;
}

export interface AssignmentTreeSummary {
  totalNodes: number;
  totalActions: number;
  totalFollowups: number;
  completedAssignments: number;
  pendingAssignments: number;
  overdueAssignments: number;
  involvedUsers: string[];
}

export interface UserPermissions {
  canViewAllNodes: boolean;
  canEditAnyAction: boolean;
  canDeleteAnyAction: boolean;
  canCreateReferrals: boolean;
  canViewPrivateNotes: boolean;
  editableNodeIds: number[];
}
export interface AssignmentActorDto {
  actorPositionGuid: string;
  actorName: string;
}
@Injectable({
  providedIn: 'root'
})
export class AssignmentService extends ServiceBase {

  constructor() {
    super("Assignment");
  }

  override getBy<T>(id: string | number) {
    const positionGuid = localStorage.getItem(POSITION_ID);
    const model = {
      id: id,
      positionGuid: positionGuid
    };
    const path = `${this.baseUrl}/GetBy`
    return this.httpService.post<T>(path, model, new RequestConfig({ submitted: false }), false);
  }

  getBoardActors(): Observable< AssignmentActorDto[] > {
    return this.httpService.get<any>(`${this.baseUrl}/GetBoardActors`);
  }
  getAssignmentResolutionDetails(assignmentId: number): Observable<any> {
    return this.httpService.get<any>(`${this.baseUrl}/GetAssignmentResolutionDetails/${assignmentId}`);
  }

  getAll(body: any): Observable<any> {
    let path = `${this.baseUrl}/GetList`;
    return this.httpService.post(path, body, new RequestConfig({ submitted: false }), false);
  }

  getCounts(positionGuid: string): Observable<any> {
    let path = `${this.baseUrl}/GetCounts/${positionGuid}`;
    return this.httpService.getAll<any>(path);
  }

  saveAssignment(body: any): Observable<any> {
    const path = `${this.baseUrl}/CreateOrEditAssignment`;
    return this.httpService.post(path, body, new RequestConfig({ submitted: true, formId: "assignForm" }), true);
  }

  getAssignmentDetails(id: any): Observable<any> {
    const path = `${this.baseUrl}/GetAssignmentResolutionDetails`;
    return this.httpService.get(path, id, new RequestConfig({}), false);
  }

  createReferral(data: any): Observable<any> {
    return this.httpService.post(`${this.baseUrl}/CreateReferral`, data, new RequestConfig({ noValidate: true }));
  }

  /** بازگشت ارجاع به ارجاع‌دهنده (توسط ارجاع‌گیرنده) همراه با شرح نتیجه */
  returnReferral(assignmentId: number, description: string, result?: number | null): Observable<any> {
    return this.httpService.post(`${this.baseUrl}/ReturnReferral`, { assignmentId, description, result: result ?? null },
      new RequestConfig({ noValidate: true }));
  }

  /** فراخوانی (پس‌گرفتن) ارجاع توسط ارجاع‌دهنده */
  recallReferral(assignmentId: number, reason?: string): Observable<any> {
    return this.httpService.post(`${this.baseUrl}/RecallReferral`, { assignmentId, reason: reason ?? null },
      new RequestConfig({ noValidate: true }));
  }

  getReferrals(assignmentId: number): Observable<any> {
    return this.httpService.get(`${this.baseUrl}/GetReferrals/${assignmentId}`);
  }

  getAssignmentTree(assignmentId: number): Observable<AssignmentTreeNode> {
    return this.httpService.get(`${this.baseUrl}/GetAssignmentTree/${assignmentId}`);
  }

  getMyReferrals(userGuid: string): Observable<any> {
    return this.httpService.get(`${this.baseUrl}/GetMyReferrals/${userGuid}`);
  }

  getReferralsGivenByMe(userGuid: string): Observable<any> {
    return this.httpService.get(`${this.baseUrl}/GetReferralsGivenByMe/${userGuid}`);
  }

  // New methods for enhanced dashboard functionality

  /**
   * Get counts for original assignments (not referrals) assigned directly to the user
   */
  getOriginalAssignmentCounts(positionGuid: string): Observable<OriginalAssignmentCounts> {
    return this.httpService.get<OriginalAssignmentCounts>(`${this.baseUrl}/GetOriginalAssignmentCounts/${positionGuid}`);
  }

  /**
   * Get counts for referrals received by the user
   */
  getReceivedReferralCounts(positionGuid: string): Observable<ReferralCounts> {
    return this.httpService.get<ReferralCounts>(`${this.baseUrl}/GetReceivedReferralCounts/${positionGuid}`);
  }

  /**
   * Get counts for referrals sent by the user to others
   */
  getSentReferralCounts(positionGuid: string): Observable<ReferralCounts> {
    return this.httpService.get<ReferralCounts>(`${this.baseUrl}/GetSentReferralCounts/${positionGuid}`);
  }

  /**
   * Get counts of pending actions that the user needs to follow up on
   * (for assignments where user is the follower)
   */
  getPendingActionCounts(positionGuid: string): Observable<PendingActionCounts> {
    return this.httpService.get<PendingActionCounts>(`${this.baseUrl}/GetPendingActionCounts/${positionGuid}`);
  }

  createActionResult(actionData: any): Observable<unknown> {
    const path = `${this.baseUrl}/CreateActionResult`;
    return this.httpService.post(path, actionData, new RequestConfig({ noValidate: true }));
  }

  getFollowerActorsActionCounts(positionGuid: string) {
    return this.httpService.get<FollowerActorsActionCounts>(
      `${this.baseUrl}/GetFollowerActorsActionCounts/${positionGuid}`
    );
  }
}

export interface AssignmentTreeNode {
  id: number;
  actorGuid: string;
  followerGuid: string;
  actorName: string;
  referrerName: string;
  referralDate: string;
  referralNote: string;
  actionStatus: string;
  followStatus: string;
  isReferral: boolean;
  level: number;
  dueDate: string;
  actorPersonalNo: string;
  canAddAction: boolean;
  canAddFollowup: boolean;
  canRefer: boolean;
  canEditAssignment: boolean;
  actions: ActionItem[];
  followups: ActionItem[];
  children: AssignmentTreeNode[];
  totalActions: number;
  totalFollowups: number;
  completedActions: number;
  pendingActions: number;
  actorPositionTitle?: string;
  isFollower: boolean;
}

export interface ActionItem {
  id: number;
  description: string;
  type: 'Action' | 'Follow';
  status: string;
  date: string;
  statusStr?: string;
  followStatus?: string;
  followStatusStr?: string;
  userName: string;
  userGuid: string;
  canEdit: boolean;
  canDelete: boolean;
}

export interface CompleteAssignmentInfo {
  mainAssignment: any;
  referralTree: AssignmentTreeNode;
  summary: AssignmentTreeSummary;
  allActions: ActionItem[];
  allFollowups: ActionItem[];
  resolutionTitle: string;
  resolutionText: string;
  meetingTitle: string;
  meetingDate: string;
  meetingNumber: string;
  currentUserPermissions: UserPermissions;
}

export interface AssignmentTreeSummary {
  totalNodes: number;
  totalActions: number;
  totalFollowups: number;
  completedAssignments: number;
  pendingAssignments: number;
  overdueAssignments: number;
  involvedUsers: string[];
}

export interface UserPermissions {
  canViewAllNodes: boolean;
  canEditAnyAction: boolean;
  canDeleteAnyAction: boolean;
  canCreateReferrals: boolean;
  canViewPrivateNotes: boolean;
  editableNodeIds: number[];
}

// New interfaces for enhanced dashboard functionality
export interface OriginalAssignmentCounts {
  totalOriginal: number;
  actionInProgress: number;
  actionDone: number;
  actionNotDone: number;
  actionEnd: number;
  followingUp: number;
  followUpEnd: number;
  notFollowedUp: number;
}

export interface ReferralCounts {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

export interface PendingActionCounts {
  total: number;
  inProgress: number;
  notDone: number;
  overdue: number;
  byActor: { [actorName: string]: number };
}

