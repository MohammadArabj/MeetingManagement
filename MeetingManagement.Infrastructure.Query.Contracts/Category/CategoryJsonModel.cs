using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.Category;

public class CategoryJsonModel
{
    public int Id { get; set; }
    public Guid Guid { get; set; }
    public string Title { get; set; }
    public int IsActive { get; set; }
    public string NumberFormat { get; set; }
    public int StartNumber { get; set; }
    public int Step { get; set; }
    public bool ViewAll { get; set; }
    public string Created { get; set; }
}