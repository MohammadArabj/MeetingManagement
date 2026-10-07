using Epc.Application.Command;
using Epc.Company.Query;
using Epc.Identity;
using SurveyManagement.Application.Contract.Question;
using SurveyManagement.Common;
using SurveyManagement.Domain.QuestionAgg;
using SurveyManagement.Domain.Shared.Access;
using SurveyManagement.Domain.SurveyAgg;

namespace SurveyManagement.Application;

public class QuestionCommandHandler(
    IQuestionRepository questionRepository,
    ISurveyRepository surveyRepository,
    ISurveyAccessService access,
    IClaimHelper claimHelper) :
    ICommandHandlerAsync<CreateOrEditQuestionDto, Result<Guid>>,
    ICommandHandlerAsync<DeleteQuestionDto, Result<bool>>,
    ICommandHandlerAsync<ReorderQuestionsDto, Result<bool>>
{
    public async Task<Result<Guid>> Handle(CreateOrEditQuestionDto command)
    {
        var currentUserId = claimHelper.GetCurrentUserGuid();

        // دریافت Survey با Guid
        var surveyId = await surveyRepository.GetIdByAsync(command.SurveyGuid);
        if (surveyId == 0)
            return Result<Guid>.Failure(Guid.Empty, "نظرسنجی یافت نشد.");

        var survey = await surveyRepository.LoadAsync(surveyId);
        if (survey == null)
            return Result<Guid>.Failure(Guid.Empty, "نظرسنجی یافت نشد.");

        if (!((await access.GetAsync(survey.Id))?.CanManage ?? false))
            return Result<Guid>.Failure(Guid.Empty, "شما مجاز به ویرایش این نظرسنجی نیستید.");

        if (survey.Status != SurveyStatus.Draft)
            return Result<Guid>.Failure(Guid.Empty, "فقط نظرسنجی‌های پیش‌نویس قابل ویرایش هستند.");

        if (command.Guid.HasValue)
        {
            // ویرایش
            var questionId = await questionRepository.GetIdByAsync(command.Guid.Value);
            if (questionId == 0)
                return Result<Guid>.Failure(Guid.Empty, "سوال یافت نشد.");

            var question = await questionRepository.LoadAsync(questionId, "Options,QuestionLogics");
            if (question == null)
                return Result<Guid>.Failure(Guid.Empty, "سوال یافت نشد.");

            if (question.SurveyId != surveyId)
                return Result<Guid>.Failure(Guid.Empty, "سوال به این نظرسنجی تعلق ندارد.");

            question.Edit(
                currentUserId,
                command.QuestionText,
                command.QuestionType,
                command.SortOrder,
                command.IsRequired,
                command.HelpText,
                command.Placeholder);

            question.SetValidation(
                currentUserId,
                command.ValidationType,
                command.ValidationErrorMessage,
                command.CustomValidationRegex,
                command.MinLength,
                command.MaxLength,
                command.MinValue,
                command.MaxValue);

            question.SetSelectionLimits(currentUserId, command.MinSelections, command.MaxSelections);
            question.SetMedia(currentUserId, command.ImageUrl, command.VideoUrl);
            question.SetOtherOption(currentUserId, command.AllowOtherOption, command.OtherOptionText);
            question.SetRandomizeOptions(currentUserId, command.RandomizeOptions);
            question.SetFileConstraints(currentUserId, command.MaxFileSize, command.AllowedFileTypes);
            question.SetScaleLabels(currentUserId, command.MinScaleLabel, command.MaxScaleLabel);
            question.SetMatrix(currentUserId, command.MatrixRows, command.MatrixColumns);

            // پردازش Options
            await ProcessOptionsAsync(question, command.Options, currentUserId);

            // پردازش Logics
            await ProcessLogicsAsync(question, command.Logics, currentUserId);

            questionRepository.Update(question);
            await questionRepository.SaveChangesAsync();

            return Result<Guid>.Success(question.Guid, "سوال با موفقیت ویرایش شد.");
        }
        else
        {
            // ایجاد جدید
            var question = new Question(
                currentUserId,
                surveyId,
                command.QuestionText,
                command.QuestionType,
                command.SortOrder,
                command.IsRequired,
                command.HelpText,
                command.Placeholder);

            question.SetValidation(
                currentUserId,
                command.ValidationType,
                command.ValidationErrorMessage,
                command.CustomValidationRegex,
                command.MinLength,
                command.MaxLength,
                command.MinValue,
                command.MaxValue);

            question.SetSelectionLimits(currentUserId, command.MinSelections, command.MaxSelections);
            question.SetMedia(currentUserId, command.ImageUrl, command.VideoUrl);
            question.SetOtherOption(currentUserId, command.AllowOtherOption, command.OtherOptionText);
            question.SetRandomizeOptions(currentUserId, command.RandomizeOptions);
            question.SetFileConstraints(currentUserId, command.MaxFileSize, command.AllowedFileTypes);
            question.SetScaleLabels(currentUserId, command.MinScaleLabel, command.MaxScaleLabel);
            question.SetMatrix(currentUserId, command.MatrixRows, command.MatrixColumns);

            await questionRepository.CreateAsync(question);
            await questionRepository.SaveChangesAsync();

            // حالا Options و Logics را اضافه می‌کنیم (باید بعد از SaveChanges باشد تا Guid بگیرد)
            if (command.Options?.Any() == true || command.Logics?.Any() == true)
            {
                var loadedQuestion = await questionRepository.LoadAsync(question.Id, "Options,QuestionLogics");

                if (command.Options?.Any() == true)
                    await ProcessOptionsAsync(loadedQuestion, command.Options, currentUserId);

                if (command.Logics?.Any() == true)
                    await ProcessLogicsAsync(loadedQuestion, command.Logics, currentUserId);

                questionRepository.Update(loadedQuestion);
                await questionRepository.SaveChangesAsync();
            }

            return Result<Guid>.Success(question.Guid, "سوال با موفقیت ایجاد شد.");
        }
    }

    public async Task<Result<bool>> Handle(DeleteQuestionDto command)
    {
        var currentUserId = claimHelper.GetCurrentUserGuid();
        var questionId = await questionRepository.GetIdByAsync(command.Guid);

        if (questionId == 0)
            return Result<bool>.Failure(false, "سوال یافت نشد.");

        var question = await questionRepository.LoadAsync(questionId, "Survey");

        if (question == null)
            return Result<bool>.Failure(false, "سوال یافت نشد.");

        if (!((await access.GetAsync(question.SurveyId))?.CanManage ?? false))
            return Result<bool>.Failure(false, "شما مجاز به حذف این سوال نیستید.");

        if (question.Survey.Status != SurveyStatus.Draft)
            return Result<bool>.Failure(false, "فقط سوالات نظرسنجی‌های پیش‌نویس قابل حذف هستند.");

        question.Remove(currentUserId);
        questionRepository.Update(question);
        await questionRepository.SaveChangesAsync();

        return Result<bool>.Success(true, "سوال با موفقیت حذف شد.");
    }

    public async Task<Result<bool>> Handle(ReorderQuestionsDto command)
    {
        var currentUserId = claimHelper.GetCurrentUserGuid();
        var surveyId = await surveyRepository.GetIdByAsync(command.SurveyGuid);

        if (surveyId == 0)
            return Result<bool>.Failure(false, "نظرسنجی یافت نشد.");

        var survey = await surveyRepository.LoadAsync(surveyId);
        if (survey == null)
            return Result<bool>.Failure(false, "نظرسنجی یافت نشد.");

        if (!((await access.GetAsync(survey.Id))?.CanManage ?? false))
            return Result<bool>.Failure(false, "شما مجاز به تغییر ترتیب سوالات این نظرسنجی نیستید.");

        if (survey.Status != SurveyStatus.Draft)
            return Result<bool>.Failure(false, "فقط سوالات نظرسنجی‌های پیش‌نویس قابل تغییر ترتیب هستند.");

        foreach (var order in command.Orders)
        {
            var qId = await questionRepository.GetIdByAsync(order.QuestionGuid);
            if (qId > 0)
            {
                var question = await questionRepository.LoadAsync(qId);
                if (question != null && question.SurveyId == surveyId)
                {
                    question.ChangeSortOrder(currentUserId, order.NewSortOrder);
                    questionRepository.Update(question);
                }
            }
        }

        await questionRepository.SaveChangesAsync();
        return Result<bool>.Success(true, "ترتیب سوالات با موفقیت تغییر کرد.");
    }

    #region Private Methods

    private async Task ProcessOptionsAsync(Question question, List<QuestionOptionDto> optionDtos, Guid userId)
    {
        if (optionDtos == null || !optionDtos.Any())
            return;

        // حذف گزینه‌های mark شده
        var toRemove = optionDtos.Where(o => o.IsRemoved && o.Guid.HasValue).ToList();
        foreach (var dto in toRemove)
        {
            var optionId = await questionRepository.GetIdByAsync(dto.Guid.Value);
            if (optionId > 0)
            {
                var option = question.Options.FirstOrDefault(o => o.Id == optionId);
                if (option != null)
                {
                    option.Deactivate(); // استفاده از متد پایه
                }
            }
        }

        // ویرایش و افزودن گزینه‌ها
        var activeOptions = optionDtos.Where(o => !o.IsRemoved).ToList();
        foreach (var dto in activeOptions)
        {
            if (dto.Guid.HasValue)
            {
                // ویرایش
                var optionId = await questionRepository.GetIdByAsync(dto.Guid.Value);
                if (optionId > 0)
                {
                    var option = question.Options.FirstOrDefault(o => o.Id == optionId);
                    if (option != null)
                    {
                        //option.Edit(dto.OptionText, dto.SortOrder, dto.Value, dto.ImageUrl);
                        if (!string.IsNullOrEmpty(dto.Color))
                            option.SetColor(dto.Color);
                    }
                }
            }
            else
            {
                // افزودن - طبق امضای سازنده: creator, questionId, optionText, sortOrder, value, imageUrl
                //var newOption = new QuestionOption(
                //    userId,
                //    question.Id,
                //    dto.OptionText,
                //    dto.SortOrder,
                //    dto.Value,
                //    dto.ImageUrl);

                //if (!string.IsNullOrEmpty(dto.Color))
                //    newOption.SetColor(dto.Color);

                // Note: باید متد AddOption در Question Entity وجود داشته باشد
                // question.AddOption(newOption);
            }
        }
    }

    private async Task ProcessLogicsAsync(Question question, List<QuestionLogicDto> logicDtos, Guid userId)
    {
        if (logicDtos == null || !logicDtos.Any())
            return;

        // حذف منطق‌های mark شده
        var toRemove = logicDtos.Where(l => l.IsRemoved && l.Guid.HasValue).ToList();
        foreach (var dto in toRemove)
        {
            var logicId = await questionRepository.GetIdByAsync(dto.Guid.Value);
            if (logicId > 0)
            {
                var logic = question.QuestionLogics.FirstOrDefault(l => l.Id == logicId);
                if (logic != null)
                {
                    logic.Deactivate();
                }
            }
        }

        // ویرایش و افزودن منطق‌ها
        var activeLogics = logicDtos.Where(l => !l.IsRemoved).ToList();
        foreach (var dto in activeLogics)
        {
            if (dto.Guid.HasValue)
            {
                // ویرایش
                var logicId = await questionRepository.GetIdByAsync(dto.Guid.Value);
                if (logicId > 0)
                {
                    var logic = question.QuestionLogics.FirstOrDefault(l => l.Id == logicId);
                    if (logic != null)
                    {
                        var targetQuestionId = dto.TargetQuestionGuid.HasValue
                            ? await questionRepository.GetIdByAsync(dto.TargetQuestionGuid.Value)
                            : (long?)null;

                        var optionId = dto.OptionGuid.HasValue
                            ? await questionRepository.GetIdByAsync(dto.OptionGuid.Value)
                            : (long?)null;

                        logic.Edit(
                            targetQuestionId,
                            dto.LogicType,
                            dto.ConditionOperator,
                            dto.ConditionValue,
                            optionId,
                            dto.Priority);
                    }
                }
            }
            else
            {
                // افزودن - امضای سازنده: creator, sourceQuestionId, targetQuestionId, logicType, conditionOperator, conditionValue, optionId
                var targetQuestionId = dto.TargetQuestionGuid.HasValue
                    ? await questionRepository.GetIdByAsync(dto.TargetQuestionGuid.Value)
                    : (long?)null;

                var optionId = dto.OptionGuid.HasValue
                    ? await questionRepository.GetIdByAsync(dto.OptionGuid.Value)
                    : (long?)null;

                //var newLogic = new QuestionLogic(
                //    userId,
                //    question.Id,
                //    targetQuestionId,
                //    dto.LogicType,
                //    dto.ConditionOperator,
                //    dto.ConditionValue,
                //    optionId);

                // Note: Priority باید set شود چون در سازنده نیست
                // باید یک متد SetPriority در Entity وجود داشته باشد یا با reflection set شود
            }
        }
    }

    #endregion
}