// core/types/conflict-result.ts

export interface ConflictItem {
    guid: string;
    type: 'Meeting' | 'Leave' | 'BlockedTime';
    description?: string;
    startTime?: string;
    endTime?: string;
}

export interface ConflictResult {
    roomConflict: boolean;
    usersWithConflict: ConflictItem[];
}