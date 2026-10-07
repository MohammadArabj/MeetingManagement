using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SurveyManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ChangeResponseField : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Responses_IsAnonymous",
                schema: "dbo",
                table: "Responses");

            migrationBuilder.DropIndex(
                name: "IX_Responses_RespondentUserGuid",
                schema: "dbo",
                table: "Responses");

            migrationBuilder.DropIndex(
                name: "IX_Responses_Status",
                schema: "dbo",
                table: "Responses");

            migrationBuilder.DropIndex(
                name: "IX_Responses_SurveyId_RespondentUserGuid",
                schema: "dbo",
                table: "Responses");

            migrationBuilder.DropColumn(
                name: "Browser",
                schema: "dbo",
                table: "Responses");

            migrationBuilder.DropColumn(
                name: "Created",
                schema: "dbo",
                table: "Responses");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                schema: "dbo",
                table: "Responses");

            migrationBuilder.DropColumn(
                name: "InternalNotes",
                schema: "dbo",
                table: "Responses");

            migrationBuilder.DropColumn(
                name: "IsActive",
                schema: "dbo",
                table: "Responses");

            migrationBuilder.DropColumn(
                name: "IsAnonymous",
                schema: "dbo",
                table: "Responses");

            migrationBuilder.DropColumn(
                name: "IsLocked",
                schema: "dbo",
                table: "Responses");

            migrationBuilder.DropColumn(
                name: "IsRemoved",
                schema: "dbo",
                table: "Responses");

            migrationBuilder.DropColumn(
                name: "LastModified",
                schema: "dbo",
                table: "Responses");

            migrationBuilder.DropColumn(
                name: "LastModifiedBy",
                schema: "dbo",
                table: "Responses");

            migrationBuilder.DropColumn(
                name: "OperatingSystem",
                schema: "dbo",
                table: "Responses");

            migrationBuilder.DropColumn(
                name: "ProgressPercentage",
                schema: "dbo",
                table: "Responses");

            migrationBuilder.DropColumn(
                name: "RespondentUserGuid",
                schema: "dbo",
                table: "Responses");

            migrationBuilder.DropColumn(
                name: "UserAgent",
                schema: "dbo",
                table: "Responses");

            migrationBuilder.DropColumn(
                name: "Created",
                schema: "dbo",
                table: "ResponseAnswers");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                schema: "dbo",
                table: "ResponseAnswers");

            migrationBuilder.DropColumn(
                name: "IsActive",
                schema: "dbo",
                table: "ResponseAnswers");

            migrationBuilder.RenameColumn(
                name: "Location",
                schema: "dbo",
                table: "Responses",
                newName: "UnitTitle");

            migrationBuilder.RenameColumn(
                name: "IpAddress",
                schema: "dbo",
                table: "Responses",
                newName: "Shift");

            migrationBuilder.RenameColumn(
                name: "DeviceType",
                schema: "dbo",
                table: "Responses",
                newName: "Gender");

            migrationBuilder.AlterColumn<Guid>(
                name: "LogoGuid",
                schema: "dbo",
                table: "Surveys",
                type: "uniqueidentifier",
                maxLength: 500,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(500)",
                oldMaxLength: 500,
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "BackgroundImageGuid",
                schema: "dbo",
                table: "Surveys",
                type: "uniqueidentifier",
                maxLength: 500,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(500)",
                oldMaxLength: 500,
                oldNullable: true);


            migrationBuilder.AddColumn<string>(
                name: "AgeGroup",
                schema: "dbo",
                table: "Responses",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "SurveyParticipants",
                schema: "dbo",
                columns: table => new
                {
                    SurveyId = table.Column<long>(type: "bigint", nullable: false),
                    UserGuid = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ParticipatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyParticipants", x => new { x.SurveyId, x.UserGuid });
                });

            migrationBuilder.CreateIndex(
                name: "IX_Responses_SurveyId_AgeGroup",
                schema: "dbo",
                table: "Responses",
                columns: new[] { "SurveyId", "AgeGroup" });

            migrationBuilder.CreateIndex(
                name: "IX_Responses_SurveyId_Gender",
                schema: "dbo",
                table: "Responses",
                columns: new[] { "SurveyId", "Gender" });

            migrationBuilder.CreateIndex(
                name: "IX_Responses_SurveyId_Shift",
                schema: "dbo",
                table: "Responses",
                columns: new[] { "SurveyId", "Shift" });

            migrationBuilder.CreateIndex(
                name: "IX_Responses_SurveyId_UnitTitle",
                schema: "dbo",
                table: "Responses",
                columns: new[] { "SurveyId", "UnitTitle" });

            migrationBuilder.CreateIndex(
                name: "IX_SurveyParticipants_SurveyId",
                schema: "dbo",
                table: "SurveyParticipants",
                column: "SurveyId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SurveyParticipants",
                schema: "dbo");

            migrationBuilder.DropIndex(
                name: "IX_Responses_SurveyId_AgeGroup",
                schema: "dbo",
                table: "Responses");

            migrationBuilder.DropIndex(
                name: "IX_Responses_SurveyId_Gender",
                schema: "dbo",
                table: "Responses");

            migrationBuilder.DropIndex(
                name: "IX_Responses_SurveyId_Shift",
                schema: "dbo",
                table: "Responses");

            migrationBuilder.DropIndex(
                name: "IX_Responses_SurveyId_UnitTitle",
                schema: "dbo",
                table: "Responses");

            migrationBuilder.DropColumn(
                name: "ShowType",
                schema: "dbo",
                table: "Surveys");

            migrationBuilder.DropColumn(
                name: "AgeGroup",
                schema: "dbo",
                table: "Responses");

            migrationBuilder.RenameColumn(
                name: "UnitTitle",
                schema: "dbo",
                table: "Responses",
                newName: "Location");

            migrationBuilder.RenameColumn(
                name: "Shift",
                schema: "dbo",
                table: "Responses",
                newName: "IpAddress");

            migrationBuilder.RenameColumn(
                name: "Gender",
                schema: "dbo",
                table: "Responses",
                newName: "DeviceType");

            migrationBuilder.AlterColumn<string>(
                name: "LogoGuid",
                schema: "dbo",
                table: "Surveys",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldMaxLength: 500,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "BackgroundImageGuid",
                schema: "dbo",
                table: "Surveys",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldMaxLength: 500,
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Browser",
                schema: "dbo",
                table: "Responses",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "Created",
                schema: "dbo",
                table: "Responses",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<Guid>(
                name: "CreatedBy",
                schema: "dbo",
                table: "Responses",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<string>(
                name: "InternalNotes",
                schema: "dbo",
                table: "Responses",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "IsActive",
                schema: "dbo",
                table: "Responses",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "IsAnonymous",
                schema: "dbo",
                table: "Responses",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "IsLocked",
                schema: "dbo",
                table: "Responses",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "IsRemoved",
                schema: "dbo",
                table: "Responses",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastModified",
                schema: "dbo",
                table: "Responses",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "LastModifiedBy",
                schema: "dbo",
                table: "Responses",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OperatingSystem",
                schema: "dbo",
                table: "Responses",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ProgressPercentage",
                schema: "dbo",
                table: "Responses",
                type: "decimal(5,2)",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "RespondentUserGuid",
                schema: "dbo",
                table: "Responses",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UserAgent",
                schema: "dbo",
                table: "Responses",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "Created",
                schema: "dbo",
                table: "ResponseAnswers",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<Guid>(
                name: "CreatedBy",
                schema: "dbo",
                table: "ResponseAnswers",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<int>(
                name: "IsActive",
                schema: "dbo",
                table: "ResponseAnswers",
                type: "int",
                nullable: false,
                defaultValue: 0);

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
                name: "IX_Responses_SurveyId_RespondentUserGuid",
                schema: "dbo",
                table: "Responses",
                columns: new[] { "SurveyId", "RespondentUserGuid" });
        }
    }
}
