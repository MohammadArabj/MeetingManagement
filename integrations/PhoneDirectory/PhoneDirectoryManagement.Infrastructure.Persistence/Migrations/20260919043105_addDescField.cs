using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PhoneDirectoryManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class addDescField : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "PhoneDirectoryEntries",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Description",
                table: "PhoneDirectoryEntries");
        }
    }
}
