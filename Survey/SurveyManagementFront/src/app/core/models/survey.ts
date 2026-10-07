export interface MySurveyListDto {
    guid: string;
    title: string;
    description: string;
    startDate: string;
    endDate: string;
    totalQuestions: number;
    surveyStatus: string;
    isActive: boolean;
    isExpired: boolean;
    themeColor?: string;
    logoUrl?: string;
    allowAnonymous: boolean;
    allowSaveDraft: boolean;
    maxResponses?: number;
    totalResponses: number;
    isFull: boolean;
    responseStatus: number;
    responseStatusText: string;
    progressPercentage: number;
    existingResponseGuid?: string;
    lastActivityDate?: string;
    createdBy: string;
    daysRemaining: number;
}