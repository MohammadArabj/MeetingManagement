using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SurveyManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class addcr : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "CriterionId",
                schema: "dbo",
                table: "Questions",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "SurveyCriteria",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Guid = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SurveyId = table.Column<long>(type: "bigint", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
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
                    table.PrimaryKey("PK_SurveyCriteria", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SurveyCriteria_Surveys_SurveyId",
                        column: x => x.SurveyId,
                        principalSchema: "dbo",
                        principalTable: "Surveys",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Questions_CriterionId",
                schema: "dbo",
                table: "Questions",
                column: "CriterionId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyCriteria_Guid",
                schema: "dbo",
                table: "SurveyCriteria",
                column: "Guid",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SurveyCriteria_SurveyId",
                schema: "dbo",
                table: "SurveyCriteria",
                column: "SurveyId");

            migrationBuilder.AddForeignKey(
                name: "FK_Questions_SurveyCriteria_CriterionId",
                schema: "dbo",
                table: "Questions",
                column: "CriterionId",
                principalSchema: "dbo",
                principalTable: "SurveyCriteria",
                principalColumn: "Id",
                onDelete: ReferentialAction.NoAction);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Questions_SurveyCriteria_CriterionId",
                schema: "dbo",
                table: "Questions");

            migrationBuilder.DropTable(
                name: "SurveyCriteria",
                schema: "dbo");

            migrationBuilder.DropIndex(
                name: "IX_Questions_CriterionId",
                schema: "dbo",
                table: "Questions");

            migrationBuilder.DropColumn(
                name: "CriterionId",
                schema: "dbo",
                table: "Questions");
        }
    }
}
