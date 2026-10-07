export interface MenuItem {
    id: string;
    label: string;
    icon: string;          // FontAwesome class
    tone: 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'muted';
    visible: () => boolean;
    action: () => void;
    danger?: boolean;
    highlight?: boolean;    // ⭐ برای هایلایت کردن آیتم‌های مهم
}

export interface SurveyData {
    guid: string;
    statusEnum: number;
    status: string;
    totalQuestions?: number;  // ⭐ تعداد سوالات
}

export interface AgGridParams {
    data: SurveyData;
    context: {
        componentParent: {
            goToSurveyDetails: (guid: string) => void;
            changeStatus: (guid: string, action: string) => void;
            askForDelete: (guid: string) => void;
            viewStatistics: (guid: string) => void;
            viewResponses: (guid: string) => void;
            manageQuestions: (guid: string) => void;  // ⭐ جدید
            viewPublishResult: (guid: string) => void;
        };
    };
}