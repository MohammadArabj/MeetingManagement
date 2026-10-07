using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SurveyManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class addManyField : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "UnitTitle",
                schema: "dbo",
                table: "Responses",
                newName: "Office");

            migrationBuilder.RenameColumn(
                name: "Shift",
                schema: "dbo",
                table: "Responses",
                newName: "ShiftWorker");

            migrationBuilder.RenameColumn(
                name: "AgeGroup",
                schema: "dbo",
                table: "Responses",
                newName: "OrganizationalGrade");

            migrationBuilder.RenameIndex(
                name: "IX_Responses_SurveyId_UnitTitle",
                schema: "dbo",
                table: "Responses",
                newName: "IX_Responses_SurveyId_Office");

            migrationBuilder.RenameIndex(
                name: "IX_Responses_SurveyId_Shift",
                schema: "dbo",
                table: "Responses",
                newName: "IX_Responses_SurveyId_ShiftWorker");

            migrationBuilder.RenameIndex(
                name: "IX_Responses_SurveyId_AgeGroup",
                schema: "dbo",
                table: "Responses",
                newName: "IX_Responses_SurveyId_OrganizationalGrade");

            migrationBuilder.AddColumn<int>(
                name: "Age",
                schema: "dbo",
                table: "Responses",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Education",
                schema: "dbo",
                table: "Responses",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmploymentType",
                schema: "dbo",
                table: "Responses",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ExperienceYears",
                schema: "dbo",
                table: "Responses",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OrganizationalGroup",
                schema: "dbo",
                table: "Responses",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Responses_SurveyId_Education",
                schema: "dbo",
                table: "Responses",
                columns: new[] { "SurveyId", "Education" });

            migrationBuilder.CreateIndex(
                name: "IX_Responses_SurveyId_EmploymentType",
                schema: "dbo",
                table: "Responses",
                columns: new[] { "SurveyId", "EmploymentType" });

            migrationBuilder.CreateIndex(
                name: "IX_Responses_SurveyId_OrganizationalGroup",
                schema: "dbo",
                table: "Responses",
                columns: new[] { "SurveyId", "OrganizationalGroup" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Responses_SurveyId_Education",
                schema: "dbo",
                table: "Responses");

            migrationBuilder.DropIndex(
                name: "IX_Responses_SurveyId_EmploymentType",
                schema: "dbo",
                table: "Responses");

            migrationBuilder.DropIndex(
                name: "IX_Responses_SurveyId_OrganizationalGroup",
                schema: "dbo",
                table: "Responses");

            migrationBuilder.DropColumn(
                name: "Age",
                schema: "dbo",
                table: "Responses");

            migrationBuilder.DropColumn(
                name: "Education",
                schema: "dbo",
                table: "Responses");

            migrationBuilder.DropColumn(
                name: "EmploymentType",
                schema: "dbo",
                table: "Responses");

            migrationBuilder.DropColumn(
                name: "ExperienceYears",
                schema: "dbo",
                table: "Responses");

            migrationBuilder.DropColumn(
                name: "OrganizationalGroup",
                schema: "dbo",
                table: "Responses");

            migrationBuilder.RenameColumn(
                name: "ShiftWorker",
                schema: "dbo",
                table: "Responses",
                newName: "Shift");

            migrationBuilder.RenameColumn(
                name: "OrganizationalGrade",
                schema: "dbo",
                table: "Responses",
                newName: "AgeGroup");

            migrationBuilder.RenameColumn(
                name: "Office",
                schema: "dbo",
                table: "Responses",
                newName: "UnitTitle");

            migrationBuilder.RenameIndex(
                name: "IX_Responses_SurveyId_ShiftWorker",
                schema: "dbo",
                table: "Responses",
                newName: "IX_Responses_SurveyId_Shift");

            migrationBuilder.RenameIndex(
                name: "IX_Responses_SurveyId_OrganizationalGrade",
                schema: "dbo",
                table: "Responses",
                newName: "IX_Responses_SurveyId_AgeGroup");

            migrationBuilder.RenameIndex(
                name: "IX_Responses_SurveyId_Office",
                schema: "dbo",
                table: "Responses",
                newName: "IX_Responses_SurveyId_UnitTitle");
        }
    }
}
