using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SurveyManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSurveyCompletionEffect : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CompletionEffect",
                schema: "dbo",
                table: "Surveys",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CompletionEffect",
                schema: "dbo",
                table: "Surveys");
        }
    }
}
