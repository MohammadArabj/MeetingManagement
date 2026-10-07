export interface MatrixQuestionColumnDto {
    questionGuid: string;
    questionText: string;
    questionType: number;
    orderIndex: number;
    isRequired: boolean;
}
export interface MatrixResponseRowDto {
    responseGuid: string;
    age?: number | null;
    gender?: string | null;
    office?: string | null;
    employmentType?: string | null;
    education?: string | null;
    shiftWorker?: string | null;
    experienceYears?: number | null;
    organizationalGrade?: string | null;
    organizationalGroup?: string | null;
    startedAt: string;
    completedAt?: string | null;
    timeSpentText?: string | null;
    answers: Record<string, string>;
}

export interface ResponseMatrixDto {
    surveyGuid: string;
    surveyTitle: string;
    questions: MatrixQuestionColumnDto[];
    rows: MatrixResponseRowDto[];
}