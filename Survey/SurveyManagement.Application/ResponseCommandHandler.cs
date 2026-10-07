using Epc.Application.Command;
using Epc.Company.Query;
using Epc.Identity;
using MeetingManagement.Common.Extensions;
using Microsoft.AspNetCore.Http;
using SurveyManagement.Application.Contract.Response;
using SurveyManagement.Common;
using SurveyManagement.Common.Extensions;
using SurveyManagement.Domain.ParticipantAgg;
using SurveyManagement.Domain.QuestionAgg;
using SurveyManagement.Domain.ResponseAgg;
using SurveyManagement.Domain.Shared.Acls.UserManagement;
using SurveyManagement.Domain.SurveyAgg;
using SurveyManagement.Infrastructure.Persistence.Views;
using System.Text.Json;

namespace SurveyManagement.Application;

public class ResponseCommandHandler(
    IResponseRepository responseRepository,
    ISurveyRepository surveyRepository,
    IQuestionRepository questionRepository,
    IQuestionOptionRepository questionOptionRepository,
    IQuestionLogicRepository questionLogicRepository,
    IUserManagementAclService userManagementAclService,   // فقط برای گرفتن PersonnelCode
    IPersonelInfoQueryService personelInfoQueryService,    // ✅ جدید — خواندن مستقیم دموگرافیک
    ISurveyParticipantRepository participantRepository,
    IClaimHelper claimHelper,
    IHttpContextAccessor httpContextAccessor) :
    ICommandHandlerAsync<SubmitResponseDto, Result<Guid>>,
    ICommandHandlerAsync<DeleteResponseDto, Result<bool>>,
    ICommandHandlerAsync<AddResponseNoteDto, Result<bool>>
{
    public async Task<Result<Guid>> Handle(SubmitResponseDto command)
    {
        var surveyId = await surveyRepository.GetIdByAsync(command.SurveyGuid);
        if (surveyId == 0)
            return Result<Guid>.Failure(Guid.Empty, "نظرسنجی یافت نشد.");

        var survey = await surveyRepository.LoadAsync(surveyId);
        if (survey == null)
            return Result<Guid>.Failure(Guid.Empty, "نظرسنجی یافت نشد.");

        var validation = ValidateSurveyAccess(survey, command.IsAnonymous);
        if (!validation.IsValid)
            return Result<Guid>.Failure(Guid.Empty, validation.ErrorMessage!);

        Guid currentUserId = claimHelper.GetCurrentUserGuid();
        bool isIdentified = !command.IsAnonymous && currentUserId != Guid.Empty;

        if (isIdentified)
        {
            if (survey.RequireLogin == false && currentUserId == Guid.Empty)
                return Result<Guid>.Failure(Guid.Empty, "برای پاسخ به این نظرسنجی باید وارد شوید.");

            if (!survey.AllowMultipleResponses)
            {
                var already = await participantRepository.ExistsAsync(surveyId, currentUserId);
                if (already)
                    return Result<Guid>.Failure(Guid.Empty, "شما قبلاً به این نظرسنجی پاسخ داده‌اید.");
            }
        }

        var questions = await questionRepository.GetBySurveyIdAsync(surveyId);
        var requiredGuids = questions.Where(q => q.IsRequired).Select(q => q.Guid).ToList();
        var answeredGuids = command.Answers.Where(a => !a.IsSkipped).Select(a => a.QuestionGuid).ToList();
        var unanswered = requiredGuids.Except(answeredGuids).ToList();
        if (unanswered.Count != 0)
            return Result<Guid>.Failure(Guid.Empty,
                $"لطفاً به تمام سوالات اجباری پاسخ دهید. {unanswered.Count} سوال اجباری بدون پاسخ است.");

        // ✅ دموگرافیک — خوانده‌شده مستقیم از vwPersonelInfo روی همون دیتابیس، بدون هیچ HTTP call
        int? age = null, experienceYears = null;
        string? gender = null, office = null, employmentType = null,
            education = null, shiftWorker = null,
            organizationalGrade = null, organizationalGroup = null;

        if (isIdentified)
        {
            // فقط برای گرفتن کد پرسنلی از UserGuid — این تنها فراخوانی سبک باقی‌مانده به UserManagement است
            var basicUser = await userManagementAclService.GetUserByAsync(currentUserId);
            var personnelCode = basicUser?.UserName;

            if (!string.IsNullOrEmpty(personnelCode))
            {
                var info = await personelInfoQueryService.GetByPersonnelCodeAsync(personnelCode);
                if (info != null)
                {
                    age = info.age;
                    gender = info.Sgender;
                    office = info.OfficeCode;
                    employmentType = info.EmployKindpers;
                    education = info.MadrakTypeNameHs;
                    shiftWorker = info.Nobatkar;
                    experienceYears = info.sabeghe;
                    organizationalGrade = info.PostBase;
                    organizationalGroup = info.GroupDesc;
                }
            }
        }

        var response = new Response(
            surveyId,
            age,
            gender,
            office,
            employmentType,
            education,
            shiftWorker,
            experienceYears,
            organizationalGrade,
            organizationalGroup);

        foreach (var answerDto in command.Answers)
        {
            var questionId = await questionRepository.GetIdByAsync(answerDto.QuestionGuid);
            if (questionId == 0) continue;

            var answer = new ResponseAnswer(response.Id, questionId, answerDto.QuestionType);
            await SetAnswerValueAsync(answer, answerDto);
            response.Answers.Add(answer);
        }

        response.Complete();
        survey.IncrementResponseCount();

        await responseRepository.CreateAsync(response);
        surveyRepository.Update(survey);

        if (isIdentified)
            await participantRepository.CreateAsync(new SurveyParticipant(surveyId, currentUserId));

        await responseRepository.SaveChangesAsync();

        return Result<Guid>.Success(response.Guid, "پاسخ شما با موفقیت ثبت شد. از شرکت شما متشکریم!");
    }
    public async Task<Result<bool>> Handle(DeleteResponseDto command)
    {
        var responseId = await responseRepository.GetIdByAsync(command.Guid);
        if (responseId == 0)
            return Result<bool>.Failure(false, "پاسخ یافت نشد.");

        var response = await responseRepository.LoadAsync(responseId, "Survey");
        if (response == null)
            return Result<bool>.Failure(false, "پاسخ یافت نشد.");

        if (response.Status != ResponseStatus.InProgress)
            return Result<bool>.Failure(false, "فقط پیش‌نویس‌ها قابل حذف هستند.");


        responseRepository.Delete(response);
        await responseRepository.SaveChangesAsync();

        return Result<bool>.Success(true, "پیش‌نویس با موفقیت حذف شد.");
    }

    public async Task<Result<bool>> Handle(AddResponseNoteDto command)
    {
        var currentUserId = claimHelper.GetCurrentUserGuid();
        var responseId = await responseRepository.GetIdByAsync(command.ResponseGuid);

        if (responseId == 0)
            return Result<bool>.Failure(false, "پاسخ یافت نشد.");

        var response = await responseRepository.LoadAsync(responseId, "Survey");
        if (response == null)
            return Result<bool>.Failure(false, "پاسخ یافت نشد.");

        responseRepository.Update(response);
        await responseRepository.SaveChangesAsync();

        return Result<bool>.Success(true, "یادداشت با موفقیت افزوده شد.");
    }

    #region Private Methods


    

    /// <summary>
    /// بررسی شرایط دسترسی به نظرسنجی
    /// </summary>
    private (bool IsValid, string? ErrorMessage) ValidateSurveyAccess(Survey survey, bool isAnonymous)
    {
        if (survey.Status != SurveyStatus.Published && survey.Status != SurveyStatus.Active)
            return (false, "نظرسنجی مورد نظر فعال نمی‌باشد.");

        var now = DateTime.Now.Date;
        if (now < survey.StartDate.Date)
            return (false, "نظرسنجی هنوز شروع نشده است.");

        if (now > survey.EndDate.Date)
            return (false, "مهلت پاسخ‌دهی به نظرسنجی تمام شده است.");

        if (survey.MaxResponses.HasValue && survey.TotalResponses >= survey.MaxResponses.Value)
            return (false, "ظرفیت نظرسنجی تکمیل شده است.");

        if (isAnonymous && !survey.AllowAnonymous)
            return (false, "این نظرسنجی پاسخ ناشناس نمی‌پذیرد.");

        return (true, null);
    }

    /// <summary>
    /// ✅ مقداردهی پاسخ — async بدون .Result
    /// </summary>
    private async Task SetAnswerValueAsync(ResponseAnswer answer, ResponseAnswerDto dto)
    {
        if (dto.IsSkipped)
        {
            answer.Skip();
            return;
        }

        switch (dto.QuestionType)
        {
            case QuestionType.ShortText:
            case QuestionType.LongText:
            case QuestionType.Email:
            case QuestionType.Phone:
            case QuestionType.Address:
                if (!string.IsNullOrEmpty(dto.TextAnswer))
                    answer.SetTextAnswer(dto.TextAnswer, dto.TimeSpentSeconds);
                break;

            case QuestionType.Number:
            case QuestionType.Rating:
            case QuestionType.LinearScale:
            case QuestionType.NPS:
                if (dto.NumericAnswer.HasValue)
                    answer.SetNumericAnswer(dto.NumericAnswer.Value, dto.TimeSpentSeconds);
                break;

            case QuestionType.Date:
            case QuestionType.Time:
                if (!string.IsNullOrEmpty(dto.DateAnswer))
                {
                    var dateValue = dto.DateAnswer.ToDateTimeNull();
                    if (dateValue.HasValue)
                        answer.SetDateAnswer(dateValue.Value, dto.TimeSpentSeconds);
                }
                break;

            case QuestionType.SingleChoice:
            case QuestionType.Dropdown:
            case QuestionType.YesNo:
                if (dto.SelectedOptionGuid.HasValue)
                {
                    var optionId = await questionOptionRepository.GetIdByAsync(dto.SelectedOptionGuid.Value);
                    if (optionId > 0)
                        answer.SetSelectedOption(optionId, dto.OtherAnswer, dto.TimeSpentSeconds);
                }
                break;

            case QuestionType.MultipleChoice:
                if (dto.SelectedOptionGuids?.Any() == true)
                {
                    var optionIds = new List<long>();
                    foreach (var guid in dto.SelectedOptionGuids)
                    {
                        var id = await questionOptionRepository.GetIdByAsync(guid);
                        if (id > 0)
                            optionIds.Add(id);
                    }

                    if (optionIds.Count != 0)
                    {
                        var optionsJson = JsonSerializer.Serialize(optionIds);
                        answer.SetSelectedOptions(optionsJson, dto.OtherAnswer, dto.TimeSpentSeconds);
                    }
                }
                break;

            case QuestionType.FileUpload:
                if (!string.IsNullOrEmpty(dto.FileUrl) && !string.IsNullOrEmpty(dto.FileName) && dto.FileSize.HasValue)
                    answer.SetFileAnswer(dto.FileUrl, dto.FileName, dto.FileSize.Value, dto.TimeSpentSeconds);
                break;

            case QuestionType.MatrixSingle:
            case QuestionType.MatrixMultiple:
                if (dto.MatrixAnswers?.Any() == true)
                {
                    var matrixJson = JsonSerializer.Serialize(dto.MatrixAnswers);
                    answer.SetMatrixAnswers(matrixJson, dto.TimeSpentSeconds);
                }
                break;

            case QuestionType.Ranking:
                if (dto.RankingAnswers?.Any() == true)
                {
                    var rankingJson = JsonSerializer.Serialize(dto.RankingAnswers);
                    answer.SetRankingAnswers(rankingJson, dto.TimeSpentSeconds);
                }
                break;
        }
    }

    private (string DeviceType, string OS, string Browser) ParseUserAgent(string userAgent)
    {
        var deviceType = "Desktop";
        var os = "Unknown";
        var browser = "Unknown";

        if (string.IsNullOrEmpty(userAgent))
            return (deviceType, os, browser);

        var ua = userAgent.ToLower();

        if (ua.Contains("mobile") || ua.Contains("android") || ua.Contains("iphone"))
            deviceType = "Mobile";
        else if (ua.Contains("tablet") || ua.Contains("ipad"))
            deviceType = "Tablet";

        if (ua.Contains("windows")) os = "Windows";
        else if (ua.Contains("mac")) os = "macOS";
        else if (ua.Contains("linux")) os = "Linux";
        else if (ua.Contains("android")) os = "Android";
        else if (ua.Contains("ios") || ua.Contains("iphone") || ua.Contains("ipad")) os = "iOS";

        if (ua.Contains("edg")) browser = "Edge";
        else if (ua.Contains("chrome")) browser = "Chrome";
        else if (ua.Contains("firefox")) browser = "Firefox";
        else if (ua.Contains("safari")) browser = "Safari";
        else if (ua.Contains("opera")) browser = "Opera";

        return (deviceType, os, browser);
    }

    #endregion
}