using Epc.Application.Command;
using Epc.Company.Query;
using Epc.Identity;
using MeetingManagement.Common.Extensions;
using SurveyManagement.Application.Contract.Survey;
using SurveyManagement.Common;
using SurveyManagement.Common.Extensions;
using SurveyManagement.Domain.QuestionAgg;
using SurveyManagement.Domain.ResponseAgg;
using SurveyManagement.Domain.SurveyAccessAgg;
using SurveyManagement.Domain.SurveyAgg;
using SurveyManagement.Domain.SurveyAgg.Services;
using SurveyManagement.Domain.SurveyCriterionAgg;
using System.Text.Json;

namespace SurveyManagement.Application;

public class SurveyCommandHandler(
    ISurveyRepository repository,
    IQuestionRepository questionRepository,
    IQuestionOptionRepository questionOptionRepository,
    IQuestionLogicRepository questionLogicRepository,
    ISurveyAccessRepository accessRepository,
    ISurveyCriterionRepository criterionRepository, // ✅ جدید
    IResponseAnswerRepository responseAnswerRepository, // ✅ جدید
    ISurveyService service,
    IClaimHelper claimHelper) :
    ICommandHandlerAsync<CreateOrEditSurveyDto, Result<Guid>>,
    ICommandHandlerAsync<DeleteSurveyDto, Result<bool>>,
    ICommandHandlerAsync<PublishSurveyDto, Result<bool>>,
    ICommandHandlerAsync<ActivateSurveyDto, Result<bool>>,
    ICommandHandlerAsync<CloseSurveyDto, Result<bool>>,
    ICommandHandlerAsync<PauseSurveyDto, Result<bool>>,
    ICommandHandlerAsync<ArchiveSurveyDto, Result<bool>>,
    ICommandHandlerAsync<CreateSurveyWithQuestionsDto, Result<CreateSurveyWithQuestionsResponse>>
{
    #region CreateOrEditSurveyDto (بدون سوالات)

    public async Task<Result<Guid>> Handle(CreateOrEditSurveyDto command)
    {
        var currentUserId = claimHelper.GetCurrentUserGuid();
        var startDate = command.StartDate.ToDateTime();
        var endDate = command.EndDate.ToDateTime();

        if (startDate >= endDate)
            return Result<Guid>.Failure(Guid.Empty, "تاریخ شروع باید قبل از تاریخ پایان باشد.");

        if (command.Guid.HasValue)
        {
            var survey = await repository.LoadAsync(command.Guid.Value);
            if (survey == null)
                return Result<Guid>.Failure(Guid.Empty, "نظرسنجی یافت نشد.");

            if (survey.CreatedBy != currentUserId)
                return Result<Guid>.Failure(Guid.Empty, "شما مجاز به ویرایش این نظرسنجی نیستید.");

            if (survey.Status == SurveyStatus.Archived)
                return Result<Guid>.Failure(Guid.Empty, "نظرسنجی آرشیو شده را نمی‌توان ویرایش کرد.");

            await service.ThrowWhenDuplicated(command.Title, survey.Id);

            survey.Edit(
                currentUserId, command.Title, command.Description, startDate, endDate,
                command.AccessType, command.ShowType, command.AllowAnonymous, command.AllowSaveDraft,
                command.ShowProgressBar, command.RandomizeQuestions, command.AllowMultipleResponses,
                command.WelcomeMessage, command.ThankYouMessage, command.MaxResponses, command.RequireLogin);

            if (command.ThemeColor.HasValue() || command.LogoGuid.HasValue() || command.BackgroundImageGuid.HasValue())
                survey.SetTheme(currentUserId, command.ThemeColor, command.LogoGuid, command.BackgroundImageGuid);

            repository.Update(survey);
            await repository.SaveChangesAsync();
            return Result<Guid>.Success(survey.Guid);
        }
        else
        {
            await service.ThrowWhenDuplicated(command.Title);

            var survey = new Survey(
                currentUserId, command.Title, command.Description, startDate, endDate,
                command.AccessType, command.ShowType, command.AllowAnonymous, command.AllowSaveDraft,
                command.ShowProgressBar, command.RandomizeQuestions, command.AllowMultipleResponses,
                command.WelcomeMessage, command.ThankYouMessage, command.MaxResponses, command.RequireLogin);

            if (command.ThemeColor.HasValue() || command.LogoGuid.HasValue() || command.BackgroundImageGuid.HasValue())
                survey.SetTheme(currentUserId, command.ThemeColor, command.LogoGuid, command.BackgroundImageGuid);

            await repository.CreateAsync(survey);
            await repository.SaveChangesAsync();
            return Result<Guid>.Success(survey.Guid, "نظرسنجی با موفقیت ایجاد شد.");
        }
    }

    public async Task<Result<bool>> Handle(DeleteSurveyDto command)
    {
        var currentUserId = claimHelper.GetCurrentUserGuid();
        var survey = await repository.LoadAsync(command.Guid);

        if (survey == null)
            return Result<bool>.Failure(false, "نظرسنجی یافت نشد.");
        if (survey.CreatedBy != currentUserId)
            return Result<bool>.Failure(false, "شما مجاز به حذف این نظرسنجی نیستید.");
        if (survey.Status != SurveyStatus.Draft)
            return Result<bool>.Failure(false, "فقط نظرسنجی‌های پیش‌نویس قابل حذف هستند.");

        survey.Remove(currentUserId);
        repository.Update(survey);
        await repository.SaveChangesAsync();
        return Result<bool>.Success(true, "نظرسنجی با موفقیت حذف شد.");
    }

    public async Task<Result<bool>> Handle(PublishSurveyDto command)
    {
        var currentUserId = claimHelper.GetCurrentUserGuid();
        var survey = await repository.LoadAsync(command.Guid, "Questions");

        if (survey == null)
            return Result<bool>.Failure(false, "نظرسنجی یافت نشد.");
        if (survey.CreatedBy != currentUserId)
            return Result<bool>.Failure(false, "شما مجاز به انتشار این نظرسنجی نیستید.");
        if (survey.Status != SurveyStatus.Draft)
            return Result<bool>.Failure(false, "نظرسنجی قبلاً منتشر شده است.");
        if (!survey.Questions.Any())
            return Result<bool>.Failure(false, "نظرسنجی باید حداقل یک سوال داشته باشد.");

        survey.Publish(currentUserId);
        repository.Update(survey);
        await repository.SaveChangesAsync();
        return Result<bool>.Success(true, "نظرسنجی با موفقیت منتشر شد.");
    }

    public async Task<Result<bool>> Handle(ActivateSurveyDto command)
    {
        var currentUserId = claimHelper.GetCurrentUserGuid();
        var survey = await repository.LoadAsync(command.Guid);

        if (survey == null)
            return Result<bool>.Failure(false, "نظرسنجی یافت نشد.");
        if (survey.Status != SurveyStatus.Published && survey.Status != SurveyStatus.Paused)
            return Result<bool>.Failure(false, "فقط نظرسنجی‌های منتشر شده یا متوقف شده قابل فعال‌سازی هستند.");

        survey.Activate(currentUserId);
        repository.Update(survey);
        await repository.SaveChangesAsync();
        return Result<bool>.Success(true, "نظرسنجی با موفقیت فعال شد.");
    }

    public async Task<Result<bool>> Handle(CloseSurveyDto command)
    {
        var currentUserId = claimHelper.GetCurrentUserGuid();
        var survey = await repository.LoadAsync(command.Guid);

        if (survey == null)
            return Result<bool>.Failure(false, "نظرسنجی یافت نشد.");

        survey.Close(currentUserId);
        repository.Update(survey);
        await repository.SaveChangesAsync();
        return Result<bool>.Success(true, "نظرسنجی با موفقیت بسته شد.");
    }

    public async Task<Result<bool>> Handle(PauseSurveyDto command)
    {
        var currentUserId = claimHelper.GetCurrentUserGuid();
        var survey = await repository.LoadAsync(command.Guid);

        if (survey == null)
            return Result<bool>.Failure(false, "نظرسنجی یافت نشد.");
        if (survey.Status != SurveyStatus.Active)
            return Result<bool>.Failure(false, "فقط نظرسنجی‌های فعال قابل متوقف کردن هستند.");

        survey.Pause(currentUserId);
        repository.Update(survey);
        await repository.SaveChangesAsync();
        return Result<bool>.Success(true, "نظرسنجی با موفقیت متوقف شد.");
    }

    public async Task<Result<bool>> Handle(ArchiveSurveyDto command)
    {
        var currentUserId = claimHelper.GetCurrentUserGuid();
        var survey = await repository.LoadAsync(command.Guid);

        if (survey == null)
            return Result<bool>.Failure(false, "نظرسنجی یافت نشد.");

        survey.Archive(currentUserId);
        repository.Update(survey);
        await repository.SaveChangesAsync();
        return Result<bool>.Success(true, "نظرسنجی با موفقیت آرشیو شد.");
    }

    #endregion

    #region CreateSurveyWithQuestionsDto (Wizard — ایجاد/ویرایش کامل)

    public async Task<Result<CreateSurveyWithQuestionsResponse>> Handle(CreateSurveyWithQuestionsDto command)
    {
        var currentUserId = claimHelper.GetCurrentUserGuid();
        var startDate = command.Survey.StartDate.ToDateTime();
        var endDate = command.Survey.EndDate.ToDateTime();

        if (startDate >= endDate)
            return Result<CreateSurveyWithQuestionsResponse>.Failure(null, "تاریخ شروع باید قبل از تاریخ پایان باشد.");

        var incomingQuestions = (command.Questions ?? new()).Where(q => !q.IsRemoved).ToList();
        if (!incomingQuestions.Any())
            return Result<CreateSurveyWithQuestionsResponse>.Failure(null, "حداقل یک سوال الزامی است.");

        Survey survey;

        // ===== ایجاد یا ویرایش نظرسنجی =====
        if (command.Survey.Guid.HasValue)
        {
            survey = await repository.LoadAsync(
                command.Survey.Guid.Value,"Questions");
            var claims = claimHelper.GetCurrentUserPermissions();    
            var canEdit = survey.CreatedBy == currentUserId
                          || claimHelper.HasPermission("MT_Surveys_Create");
            if (survey == null)
                return Result<CreateSurveyWithQuestionsResponse>.Failure(null, "نظرسنجی یافت نشد.");

            if (!canEdit)
                return Result<CreateSurveyWithQuestionsResponse>.Failure(null, "شما مجاز به ویرایش این نظرسنجی نیستید.");
            if (survey.Status == SurveyStatus.Published&& !claimHelper.HasPermission("SV_Surveys_Edit"))
                return Result<CreateSurveyWithQuestionsResponse>.Failure(null, "نظرسنجی منتشر شده را نمی‌توان ویرایش کرد.");
            // ✅ محدودیت «فقط پیش‌نویس قابل ویرایش است» برداشته شد
            if (survey.Status == SurveyStatus.Archived)
                return Result<CreateSurveyWithQuestionsResponse>.Failure(null, "نظرسنجی آرشیو شده را نمی‌توان ویرایش کرد.");

            await service.ThrowWhenDuplicated(command.Survey.Title, survey.Id);

            survey.Edit(
                currentUserId, command.Survey.Title, command.Survey.Description, startDate, endDate,
                command.Survey.AccessType, command.Survey.ShowType, command.Survey.AllowAnonymous,
                command.Survey.AllowSaveDraft, command.Survey.ShowProgressBar, command.Survey.RandomizeQuestions,
                command.Survey.AllowMultipleResponses, command.Survey.WelcomeMessage, command.Survey.ThankYouMessage,
                command.Survey.MaxResponses, command.Survey.RequireLogin);

            if (command.Survey.ThemeColor.HasValue() || command.Survey.LogoGuid.HasValue() || command.Survey.BackgroundImageGuid.HasValue())
                survey.SetTheme(currentUserId, command.Survey.ThemeColor, command.Survey.LogoGuid, command.Survey.BackgroundImageGuid);

            repository.Update(survey);
        }
        else
        {
            await service.ThrowWhenDuplicated(command.Survey.Title);

            survey = new Survey(
                currentUserId, command.Survey.Title, command.Survey.Description, startDate, endDate,
                command.Survey.AccessType, command.Survey.ShowType, command.Survey.AllowAnonymous,
                command.Survey.AllowSaveDraft, command.Survey.ShowProgressBar, command.Survey.RandomizeQuestions,
                command.Survey.AllowMultipleResponses, command.Survey.WelcomeMessage, command.Survey.ThankYouMessage,
                command.Survey.MaxResponses, command.Survey.RequireLogin);

            if (command.Survey.ThemeColor.HasValue() || command.Survey.LogoGuid.HasValue() || command.Survey.BackgroundImageGuid.HasValue())
                survey.SetTheme(currentUserId, command.Survey.ThemeColor, command.Survey.LogoGuid, command.Survey.BackgroundImageGuid);

            await repository.CreateAsync(survey);
            await repository.SaveChangesAsync(); // نیاز به Id برای سوالات
        }

        var existingQuestionsByGuid = survey.Questions.ToDictionary(q => q.Guid, q => q);

        // ===== 1) حذف سوالات علامت‌خورده (IsRemoved=true) به همراه پاسخ‌ها و رفرنس‌ها =====
        var questionGuidsToRemove = (command.Questions ?? new())
            .Where(q => q.Guid.HasValue && q.IsRemoved)
            .Select(q => q.Guid!.Value)
            .Distinct()
            .ToList();

        foreach (var qGuid in questionGuidsToRemove)
        {
            if (!existingQuestionsByGuid.TryGetValue(qGuid, out var questionToRemove))
                continue;

            // 🔴 اول پاسخ‌های ثبت‌شده برای این سوال حذف شوند
            var answers = await responseAnswerRepository.GetByQuestionIdAsync(questionToRemove.Id);
            foreach (var answer in answers)
                responseAnswerRepository.Delete(answer);

            // منطق‌هایی از سایر سوالات که به این سوال ارجاع می‌دهند (جلوگیری از رفرنس آویزان)
            var referencingLogics = await questionLogicRepository.GetByTargetQuestionIdAsync(questionToRemove.Id);
            foreach (var logic in referencingLogics)
                questionLogicRepository.Delete(logic);

            var oldOptions = await questionOptionRepository.GetByQuestionIdAsync(questionToRemove.Id);
            foreach (var opt in oldOptions)
                questionOptionRepository.Delete(opt);

            var oldLogics = await questionLogicRepository.GetByQuestionIdAsync(questionToRemove.Id);
            foreach (var logic in oldLogics)
                questionLogicRepository.Delete(logic);

            questionRepository.Delete(questionToRemove);
        }

        if (questionGuidsToRemove.Any())
        {
            await responseAnswerRepository.SaveChangesAsync();
            await questionLogicRepository.SaveChangesAsync();
            await questionOptionRepository.SaveChangesAsync();
            await questionRepository.SaveChangesAsync();
        }

        // ===== 2) ویرایش سوالات موجود / افزودن سوالات جدید =====
        var questionGuids = new List<Guid>();
        // ===== همگام‌سازی معیارها (باید قبل از سوالات باشد تا CriterionId موجود باشد) =====
        var criterionGuidToId = await SyncCriteriaAsync(currentUserId, survey, command.Criteria);
        foreach (var questionDto in incomingQuestions.OrderBy(q => q.SortOrder))
        {
            Question question;
            var isExisting = questionDto.Guid.HasValue && existingQuestionsByGuid.ContainsKey(questionDto.Guid.Value);

            if (isExisting)
            {
                question = existingQuestionsByGuid[questionDto.Guid!.Value];

                question.Edit(
                    currentUserId,
                    questionDto.QuestionText,
                    (QuestionType)questionDto.QuestionType,
                    questionDto.SortOrder,
                    questionDto.IsRequired,
                    questionDto.HelpText,
                    questionDto.Placeholder);

                questionRepository.Update(question);
            }
            else
            {
                question = new Question(
                    currentUserId,
                    survey.Id,
                    questionDto.QuestionText,
                    (QuestionType)questionDto.QuestionType,
                    questionDto.SortOrder,
                    questionDto.IsRequired,
                    questionDto.HelpText,
                    questionDto.Placeholder);

                await questionRepository.CreateAsync(question);
            }

            question.SetRandomizeOptions(currentUserId, questionDto.RandomizeOptions ?? false);
            question.SetOtherOption(currentUserId, questionDto.AllowOtherOption ?? false, questionDto.OtherOptionText);
            question.SetMedia(currentUserId, questionDto.ImageGuid, questionDto.VideoGuid);
            long? criterionId = questionDto.CriterionGuid.HasValue
                            && criterionGuidToId.TryGetValue(questionDto.CriterionGuid.Value, out var cId)
                            ? cId
                            : null;
            question.SetCriterion(currentUserId, criterionId);
            question.SetValidation(
                currentUserId,
                questionDto.ValidationType.HasValue ? (ValidationType)questionDto.ValidationType.Value : ValidationType.None,
                questionDto.ValidationErrorMessage,
                questionDto.CustomValidationRegex,
                questionDto.MinLength,
                questionDto.MaxLength,
                questionDto.MinValue,
                questionDto.MaxValue);

            question.SetSelectionLimits(currentUserId, questionDto.MinSelections, questionDto.MaxSelections);
            question.SetFileConstraints(currentUserId, questionDto.MaxFileSize, questionDto.AllowedFileTypes);
            question.SetScaleLabels(currentUserId, questionDto.MinScaleLabel, questionDto.MaxScaleLabel);

            if (questionDto.MatrixRows?.Any() == true && questionDto.MatrixColumns?.Any() == true)
            {
                question.SetMatrix(
                    currentUserId,
                    JsonSerializer.Serialize(questionDto.MatrixRows),
                    JsonSerializer.Serialize(questionDto.MatrixColumns));
            }

            await questionRepository.SaveChangesAsync(); // نیاز به Id برای گزینه‌های سوال جدید

            // پاسخ‌های این سوال (برای پاکسازی احتمالی گزینه‌های حذف‌شده)
            var questionAnswers = (await responseAnswerRepository.GetByQuestionIdAsync(question.Id)).ToList();

            await SyncOptionsAsync(currentUserId, question, questionDto.Options, questionAnswers);
            await SyncLogicsAsync(currentUserId, question, questionDto.Logics);

            questionGuids.Add(question.Guid);
        }

        await responseAnswerRepository.SaveChangesAsync();
        await questionOptionRepository.SaveChangesAsync();
        await questionLogicRepository.SaveChangesAsync();

        // ===== 3) همگام‌سازی دسترسی‌ها =====
        await SyncAccessItemsAsync(currentUserId, survey, command.AccessItems);

        await repository.SaveChangesAsync();

        var response = new CreateSurveyWithQuestionsResponse
        {
            SurveyGuid = survey.Guid,
            QuestionGuids = questionGuids,
            Message = command.Survey.Guid.HasValue
                ? "نظرسنجی و سوالات با موفقیت ویرایش شدند."
                : "نظرسنجی و سوالات با موفقیت ایجاد شدند."
        };

        return Result<CreateSurveyWithQuestionsResponse>.Success(response);
    }

    // ================= Helper: همگام‌سازی گزینه‌های یک سوال =================
    private async Task SyncOptionsAsync(
        Guid currentUserId,
        Question question,
        List<QuestionOptionDto>? incomingOptions,
        List<ResponseAnswer> questionAnswers)
    {
        var existingOptions = (await questionOptionRepository.GetByQuestionIdAsync(question.Id))
            .ToDictionary(o => o.Guid, o => o);

        var options = incomingOptions ?? new();

        // حذف گزینه‌های علامت‌خورده (IsRemoved=true) + پاسخ‌هایی که به آن‌ها ارجاع داده‌اند
        foreach (var toRemove in options.Where(o => o.Guid.HasValue && o.IsRemoved))
        {
            if (!existingOptions.TryGetValue(toRemove.Guid!.Value, out var opt))
                continue;

            var affectedAnswers = questionAnswers.Where(a =>
                a.SelectedOptionId == opt.Id ||
                (a.SelectedOptionIds != null && a.SelectedOptionIds.Contains(opt.Id.ToString())));

            foreach (var answer in affectedAnswers)
                responseAnswerRepository.Delete(answer);

            questionOptionRepository.Delete(opt);
        }

        var sortOrder = 1;
        foreach (var optionDto in options.Where(o => !o.IsRemoved).OrderBy(o => o.SortOrder))
        {
            var isExisting = optionDto.Guid.HasValue && existingOptions.ContainsKey(optionDto.Guid.Value);

            if (isExisting)
            {
                var option = existingOptions[optionDto.Guid!.Value];
                option.Edit(optionDto.OptionText, sortOrder, optionDto.Value, optionDto.ImageGuid, optionDto.Color);
                questionOptionRepository.Update(option);
            }
            else
            {
                var option = new QuestionOption(
                    currentUserId, question.Id, optionDto.OptionText, sortOrder,
                    optionDto.Value, optionDto.ImageGuid, optionDto.Color);

                await questionOptionRepository.CreateAsync(option);
            }

            sortOrder++;
        }
    }
    // ================= Helper: همگام‌سازی معیارها =================
    // خروجی: دیکشنری Guid معیار -> Id واقعی آن در دیتابیس (چه موجود، چه تازه ساخته‌شده)
    private async Task<Dictionary<Guid, long>> SyncCriteriaAsync(
        Guid currentUserId,
        Survey survey,
        List<SurveyCriterionDto>? incomingCriteria)
    {
        var existingCriteria = (await criterionRepository.GetBySurveyIdAsync(survey.Id))
            .ToDictionary(c => c.Guid, c => c);

        var items = incomingCriteria ?? new();
        var result = new Dictionary<Guid, long>();

        // حذف معیارهای علامت‌خورده
        foreach (var toRemove in items.Where(c => c.IsRemoved))
        {
            if (existingCriteria.TryGetValue(toRemove.Guid, out var criterion))
            {
                criterionRepository.Delete(criterion);
                existingCriteria.Remove(toRemove.Guid);
                // توجه: چون FK روی Question با SetNull تعریف شده، سوالات این معیار
                // به‌صورت خودکار در دیتابیس بدون معیار می‌شوند و حذف نمی‌شوند.
            }
        }

        foreach (var dto in items.Where(c => !c.IsRemoved))
        {
            if (existingCriteria.TryGetValue(dto.Guid, out var criterion))
            {
                criterion.Edit(currentUserId, dto.Title, dto.Description, dto.SortOrder);
                criterionRepository.Update(criterion);
                result[dto.Guid] = criterion.Id;
            }
            else
            {
                var newCriterion = new SurveyCriterion(
                    currentUserId, survey.Id, dto.Guid, dto.Title, dto.Description, dto.SortOrder);

                await criterionRepository.CreateAsync(newCriterion);
                await criterionRepository.SaveChangesAsync(); // نیاز به Id واقعی داریم
                result[dto.Guid] = newCriterion.Id;
            }
        }

        await criterionRepository.SaveChangesAsync();
        return result;
    }
    // ================= Helper: همگام‌سازی منطق‌های یک سوال =================
    private async Task SyncLogicsAsync(Guid currentUserId, Question question, List<QuestionLogicDto>? incomingLogics)
    {
        var existingLogics = (await questionLogicRepository.GetByQuestionIdAsync(question.Id))
            .ToDictionary(l => l.Guid, l => l);

        var logics = incomingLogics ?? new();

        foreach (var toRemove in logics.Where(l => l.Guid.HasValue && l.IsRemoved))
        {
            if (existingLogics.TryGetValue(toRemove.Guid!.Value, out var logic))
                questionLogicRepository.Delete(logic);
        }

        foreach (var logicDto in logics.Where(l => !l.IsRemoved))
        {
            long? optionId = logicDto.OptionGuid.HasValue
                ? await questionOptionRepository.GetIdByAsync(logicDto.OptionGuid.Value)
                : null;

            long? targetQuestionId = logicDto.TargetQuestionGuid.HasValue
                ? await questionRepository.GetIdByAsync(logicDto.TargetQuestionGuid.Value)
                : null;

            var isExisting = logicDto.Guid.HasValue && existingLogics.ContainsKey(logicDto.Guid.Value);

            if (isExisting)
            {
                var logic = existingLogics[logicDto.Guid!.Value];
                logic.Edit(
                    targetQuestionId,
                    (LogicType)logicDto.LogicType,
                    (ConditionOperator)logicDto.ConditionOperator,
                    logicDto.ConditionValue,
                    optionId,
                    logicDto.Priority);

                questionLogicRepository.Update(logic);
            }
            else
            {
                var logic = new QuestionLogic(
                    currentUserId, question.Id, targetQuestionId,
                    (LogicType)logicDto.LogicType, (ConditionOperator)logicDto.ConditionOperator,
                    logicDto.ConditionValue, optionId, logicDto.Priority);

                await questionLogicRepository.CreateAsync(logic);
            }
        }
    }

    // ================= Helper: همگام‌سازی دسترسی‌ها =================
    private async Task SyncAccessItemsAsync(Guid currentUserId, Survey survey, List<SurveyAccessItemDto>? incomingAccessItems)
    {
        var existingAccesses = (await accessRepository.GetBySurveyIdAsync(survey.Id))
            .ToDictionary(a => a.Guid, a => a);

        var items = incomingAccessItems ?? new();

        foreach (var toRemove in items.Where(a => a.Guid.HasValue && a.IsRemoved))
        {
            if (existingAccesses.TryGetValue(toRemove.Guid!.Value, out var access))
                accessRepository.Delete(access);
        }

        foreach (var accessDto in items.Where(a => !a.IsRemoved))
        {
            DateTime? expDate = string.IsNullOrEmpty(accessDto.ExpirationDate)
                ? null
                : accessDto.ExpirationDate.ToDateTimeNull();

            var isExisting = accessDto.Guid.HasValue && existingAccesses.ContainsKey(accessDto.Guid.Value);

            if (isExisting)
            {
                var access = existingAccesses[accessDto.Guid!.Value];
                access.Edit(
                    accessDto.CanView, accessDto.CanRespond, accessDto.CanViewResults,
                    accessDto.CanEdit, accessDto.CanDelete, expDate);

                accessRepository.Update(access);
            }
            else
            {
                var access = new SurveyAccess(
                    currentUserId, survey.Id, accessDto.TargetType, accessDto.TargetGuid,
                    accessDto.CanView, accessDto.CanRespond, accessDto.CanViewResults,
                    accessDto.CanEdit, accessDto.CanDelete);

                if (expDate.HasValue)
                {
                    access.Edit(
                        accessDto.CanView, accessDto.CanRespond, accessDto.CanViewResults,
                        accessDto.CanEdit, accessDto.CanDelete, expDate);
                }

                await accessRepository.CreateAsync(access);
            }
        }

        await accessRepository.SaveChangesAsync();
    }

    #endregion
}