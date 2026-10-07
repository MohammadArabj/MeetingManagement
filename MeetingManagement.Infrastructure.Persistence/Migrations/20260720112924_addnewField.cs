using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MeetingManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class addnewField : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "ResetNumberYearly",
                schema: "dbo",
                table: "Categories",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ResetNumberYearly",
                schema: "dbo",
                table: "Categories");
        }
    }
}
