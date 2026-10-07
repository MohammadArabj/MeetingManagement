using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SurveyManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class init : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "dbo");

            migrationBuilder.CreateTable(
                name: "Surveys",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Title = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    StartDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    AccessType = table.Column<int>(type: "int", nullable: false),
                    AllowAnonymous = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    AllowSaveDraft = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    ShowProgressBar = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    RandomizeQuestions = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    AllowMultipleResponses = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    WelcomeMessage = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    ThankYouMessage = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    MaxResponses = table.Column<int>(type: "int", nullable: true),
                    TotalResponses = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    RequireLogin = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    Version = table.Column<int>(type: "int", nullable: false, defaultValue: 1),
                    PublishedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    PublishedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ThemeColor = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    LogoUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    BackgroundImageUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<int>(type: "int", nullable: false),
                    Created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Guid = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IsLocked = table.Column<int>(type: "int", nullable: false),
                    IsRemoved = table.Column<bool>(type: "bit", nullable: false),
                    LastModified = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastModifiedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Surveys", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SurveySystemRoles",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Guid = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoleName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    RoleType = table.Column<int>(type: "int", nullable: false),
                    IsSystemRole = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    IsActive = table.Column<int>(type: "int", nullable: false),
                    Created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveySystemRoles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Questions",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Guid = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SurveyId = table.Column<long>(type: "bigint", nullable: false),
                    QuestionText = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    QuestionType = table.Column<int>(type: "int", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsRequired = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    HelpText = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Placeholder = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    RandomizeOptions = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    AllowOtherOption = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    OtherOptionText = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ImageUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    VideoUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ValidationType = table.Column<byte>(type: "tinyint", nullable: false),
                    ValidationErrorMessage = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CustomValidationRegex = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    MinLength = table.Column<int>(type: "int", nullable: true),
                    MaxLength = table.Column<int>(type: "int", nullable: true),
                    MinValue = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    MaxValue = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    MinSelections = table.Column<int>(type: "int", nullable: true),
                    MaxSelections = table.Column<int>(type: "int", nullable: true),
                    MaxFileSize = table.Column<int>(type: "int", nullable: true),
                    AllowedFileTypes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    MinScaleLabel = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    MaxScaleLabel = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    MatrixRows = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    MatrixColumns = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsActive = table.Column<int>(type: "int", nullable: false),
                    Created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IsLocked = table.Column<int>(type: "int", nullable: false),
                    IsRemoved = table.Column<bool>(type: "bit", nullable: false),
                    LastModified = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastModifiedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Questions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Questions_Surveys_SurveyId",
                        column: x => x.SurveyId,
                        principalSchema: "dbo",
                        principalTable: "Surveys",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Responses",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Guid = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SurveyId = table.Column<long>(type: "bigint", nullable: false),
                    RespondentUserGuid = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IsAnonymous = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IpAddress = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    UserAgent = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    TimeSpentSeconds = table.Column<int>(type: "int", nullable: true),
                    DeviceType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    OperatingSystem = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Browser = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Location = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ProgressPercentage = table.Column<decimal>(type: "decimal(5,2)", nullable: true),
                    InternalNotes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsActive = table.Column<int>(type: "int", nullable: false),
                    Created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IsLocked = table.Column<int>(type: "int", nullable: false),
                    IsRemoved = table.Column<bool>(type: "bit", nullable: false),
                    LastModified = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastModifiedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Responses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Responses_Surveys_SurveyId",
                        column: x => x.SurveyId,
                        principalSchema: "dbo",
                        principalTable: "Surveys",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SurveyAccess",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Guid = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SurveyId = table.Column<long>(type: "bigint", nullable: false),
                    TargetType = table.Column<int>(type: "int", nullable: false),
                    TargetGuid = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CanView = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CanRespond = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CanViewResults = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CanEdit = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CanDelete = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    ExpirationDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsActive = table.Column<int>(type: "int", nullable: false),
                    Created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyAccess", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SurveyAccess_Surveys_SurveyId",
                        column: x => x.SurveyId,
                        principalSchema: "dbo",
                        principalTable: "Surveys",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SurveyChangeLogs",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SurveyId = table.Column<long>(type: "bigint", nullable: false),
                    ChangeType = table.Column<int>(type: "int", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Version = table.Column<int>(type: "int", nullable: false),
                    ChangeDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    BeforeSnapshot = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    AfterSnapshot = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsActive = table.Column<int>(type: "int", nullable: false),
                    Created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyChangeLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SurveyChangeLogs_Surveys_SurveyId",
                        column: x => x.SurveyId,
                        principalSchema: "dbo",
                        principalTable: "Surveys",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserSurveyRoles",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserGuid = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoleId = table.Column<int>(type: "int", nullable: false),
                    AssignedDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ExpirationDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsActive = table.Column<int>(type: "int", nullable: false),
                    Created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserSurveyRoles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserSurveyRoles_SurveySystemRoles_RoleId",
                        column: x => x.RoleId,
                        principalSchema: "dbo",
                        principalTable: "SurveySystemRoles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "QuestionOptions",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Guid = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    QuestionId = table.Column<long>(type: "bigint", nullable: false),
                    OptionText = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    Value = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    ImageUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Color = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    IsActive = table.Column<int>(type: "int", nullable: false),
                    Created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuestionOptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QuestionOptions_Questions_QuestionId",
                        column: x => x.QuestionId,
                        principalSchema: "dbo",
                        principalTable: "Questions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ResponseAnswers",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Guid = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ResponseId = table.Column<long>(type: "bigint", nullable: false),
                    QuestionId = table.Column<long>(type: "bigint", nullable: false),
                    QuestionType = table.Column<int>(type: "int", nullable: false),
                    TextAnswer = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    NumericAnswer = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    DateAnswer = table.Column<DateTime>(type: "datetime2", nullable: true),
                    SelectedOptionId = table.Column<long>(type: "bigint", nullable: true),
                    SelectedOptionIds = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    OtherAnswer = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    FileUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    FileName = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    FileSize = table.Column<long>(type: "bigint", nullable: true),
                    MatrixAnswers = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RankingAnswers = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    AnsweredAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TimeSpentSeconds = table.Column<int>(type: "int", nullable: true),
                    IsSkipped = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    IsActive = table.Column<int>(type: "int", nullable: false),
                    Created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ResponseAnswers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ResponseAnswers_Questions_QuestionId",
                        column: x => x.QuestionId,
                        principalSchema: "dbo",
                        principalTable: "Questions",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ResponseAnswers_Responses_ResponseId",
                        column: x => x.ResponseId,
                        principalSchema: "dbo",
                        principalTable: "Responses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "QuestionLogics",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Guid = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SourceQuestionId = table.Column<long>(type: "bigint", nullable: false),
                    TargetQuestionId = table.Column<long>(type: "bigint", nullable: true),
                    LogicType = table.Column<int>(type: "int", nullable: false),
                    ConditionOperator = table.Column<int>(type: "int", nullable: false),
                    ConditionValue = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    OptionId = table.Column<long>(type: "bigint", nullable: true),
                    Priority = table.Column<int>(type: "int", nullable: false, defaultValue: 1),
                    IsActive = table.Column<int>(type: "int", nullable: false),
                    Created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuestionLogics", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QuestionLogics_QuestionOptions_OptionId",
                        column: x => x.OptionId,
                        principalSchema: "dbo",
                        principalTable: "QuestionOptions",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_QuestionLogics_Questions_SourceQuestionId",
                        column: x => x.SourceQuestionId,
                        principalSchema: "dbo",
                        principalTable: "Questions",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_QuestionLogics_Questions_TargetQuestionId",
                        column: x => x.TargetQuestionId,
                        principalSchema: "dbo",
                        principalTable: "Questions",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_QuestionLogics_Guid",
                schema: "dbo",
                table: "QuestionLogics",
                column: "Guid",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QuestionLogics_OptionId",
                schema: "dbo",
                table: "QuestionLogics",
                column: "OptionId");

            migrationBuilder.CreateIndex(
                name: "IX_QuestionLogics_Priority",
                schema: "dbo",
                table: "QuestionLogics",
                column: "Priority");

            migrationBuilder.CreateIndex(
                name: "IX_QuestionLogics_SourceQuestionId",
                schema: "dbo",
                table: "QuestionLogics",
                column: "SourceQuestionId");

            migrationBuilder.CreateIndex(
                name: "IX_QuestionLogics_TargetQuestionId",
                schema: "dbo",
                table: "QuestionLogics",
                column: "TargetQuestionId");

            migrationBuilder.CreateIndex(
                name: "IX_QuestionOptions_Guid",
                schema: "dbo",
                table: "QuestionOptions",
                column: "Guid",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QuestionOptions_QuestionId",
                schema: "dbo",
                table: "QuestionOptions",
                column: "QuestionId");

            migrationBuilder.CreateIndex(
                name: "IX_QuestionOptions_SortOrder",
                schema: "dbo",
                table: "QuestionOptions",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_Questions_Guid",
                schema: "dbo",
                table: "Questions",
                column: "Guid",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Questions_SortOrder",
                schema: "dbo",
                table: "Questions",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_Questions_SurveyId",
                schema: "dbo",
                table: "Questions",
                column: "SurveyId");

            migrationBuilder.CreateIndex(
                name: "IX_ResponseAnswers_Guid",
                schema: "dbo",
                table: "ResponseAnswers",
                column: "Guid",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ResponseAnswers_QuestionId",
                schema: "dbo",
                table: "ResponseAnswers",
                column: "QuestionId");

            migrationBuilder.CreateIndex(
                name: "IX_ResponseAnswers_QuestionType",
                schema: "dbo",
                table: "ResponseAnswers",
                column: "QuestionType");

            migrationBuilder.CreateIndex(
                name: "IX_ResponseAnswers_ResponseId",
                schema: "dbo",
                table: "ResponseAnswers",
                column: "ResponseId");

            migrationBuilder.CreateIndex(
                name: "IX_ResponseAnswers_ResponseId_QuestionId",
                schema: "dbo",
                table: "ResponseAnswers",
                columns: new[] { "ResponseId", "QuestionId" });

            migrationBuilder.CreateIndex(
                name: "IX_Responses_CompletedAt",
                schema: "dbo",
                table: "Responses",
                column: "CompletedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Responses_Guid",
                schema: "dbo",
                table: "Responses",
                column: "Guid",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Responses_IsAnonymous",
                schema: "dbo",
                table: "Responses",
                column: "IsAnonymous");

            migrationBuilder.CreateIndex(
                name: "IX_Responses_RespondentUserGuid",
                schema: "dbo",
                table: "Responses",
                column: "RespondentUserGuid");

            migrationBuilder.CreateIndex(
                name: "IX_Responses_Status",
                schema: "dbo",
                table: "Responses",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Responses_SurveyId",
                schema: "dbo",
                table: "Responses",
                column: "SurveyId");

            migrationBuilder.CreateIndex(
                name: "IX_Responses_SurveyId_RespondentUserGuid",
                schema: "dbo",
                table: "Responses",
                columns: new[] { "SurveyId", "RespondentUserGuid" });

            migrationBuilder.CreateIndex(
                name: "IX_SurveyAccess_ExpirationDate",
                schema: "dbo",
                table: "SurveyAccess",
                column: "ExpirationDate");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyAccess_Guid",
                schema: "dbo",
                table: "SurveyAccess",
                column: "Guid",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SurveyAccess_SurveyId",
                schema: "dbo",
                table: "SurveyAccess",
                column: "SurveyId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyAccess_TargetType_TargetGuid",
                schema: "dbo",
                table: "SurveyAccess",
                columns: new[] { "TargetType", "TargetGuid" });

            migrationBuilder.CreateIndex(
                name: "IX_SurveyChangeLogs_ChangeDate",
                schema: "dbo",
                table: "SurveyChangeLogs",
                column: "ChangeDate");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyChangeLogs_SurveyId",
                schema: "dbo",
                table: "SurveyChangeLogs",
                column: "SurveyId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyChangeLogs_Version",
                schema: "dbo",
                table: "SurveyChangeLogs",
                column: "Version");

            migrationBuilder.CreateIndex(
                name: "IX_Surveys_CreatedBy",
                schema: "dbo",
                table: "Surveys",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Surveys_Guid",
                schema: "dbo",
                table: "Surveys",
                column: "Guid",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Surveys_StartDate_EndDate",
                schema: "dbo",
                table: "Surveys",
                columns: new[] { "StartDate", "EndDate" });

            migrationBuilder.CreateIndex(
                name: "IX_Surveys_Status",
                schema: "dbo",
                table: "Surveys",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_SurveySystemRoles_Guid",
                schema: "dbo",
                table: "SurveySystemRoles",
                column: "Guid",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SurveySystemRoles_RoleName",
                schema: "dbo",
                table: "SurveySystemRoles",
                column: "RoleName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SurveySystemRoles_RoleType",
                schema: "dbo",
                table: "SurveySystemRoles",
                column: "RoleType");

            migrationBuilder.CreateIndex(
                name: "IX_UserSurveyRoles_RoleId",
                schema: "dbo",
                table: "UserSurveyRoles",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_UserSurveyRoles_UserGuid",
                schema: "dbo",
                table: "UserSurveyRoles",
                column: "UserGuid");

            migrationBuilder.CreateIndex(
                name: "IX_UserSurveyRoles_UserGuid_RoleId",
                schema: "dbo",
                table: "UserSurveyRoles",
                columns: new[] { "UserGuid", "RoleId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "QuestionLogics",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "ResponseAnswers",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "SurveyAccess",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "SurveyChangeLogs",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "UserSurveyRoles",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "QuestionOptions",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "Responses",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "SurveySystemRoles",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "Questions",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "Surveys",
                schema: "dbo");
        }
    }
}
