using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SurveyManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class changeDb : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ImageUrl",
                schema: "dbo",
                table: "QuestionOptions");

            migrationBuilder.AlterColumn<Guid>(
                name: "ImageUrl",
                schema: "dbo",
                table: "Questions",
                type: "uniqueidentifier",
                maxLength: 500,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(500)",
                oldMaxLength: 500,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Value",
                schema: "dbo",
                table: "QuestionOptions",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "decimal(18,2)",
                oldNullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ImageFile",
                schema: "dbo",
                table: "QuestionOptions",
                type: "uniqueidentifier",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ImageFile",
                schema: "dbo",
                table: "QuestionOptions");

            migrationBuilder.AlterColumn<string>(
                name: "ImageUrl",
                schema: "dbo",
                table: "Questions",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldMaxLength: 500,
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "Value",
                schema: "dbo",
                table: "QuestionOptions",
                type: "decimal(18,2)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ImageUrl",
                schema: "dbo",
                table: "QuestionOptions",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);
        }
    }
}
