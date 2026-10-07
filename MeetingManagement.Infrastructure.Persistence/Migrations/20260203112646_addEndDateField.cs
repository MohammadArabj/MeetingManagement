using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MeetingManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class addEndDateField : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "EndDate",
                schema: "dbo",
                table: "Meetings",
                type: "date",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EndDate",
                schema: "dbo",
                table: "Meetings");
        }
    }
}
