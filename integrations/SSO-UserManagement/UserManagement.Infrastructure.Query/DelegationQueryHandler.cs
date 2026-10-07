using Epc.Application.Query;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Epc.Identity;
using UserManagement.Application.Contract.Commands.Role;
using UserManagement.Application.Contract.Delegation;
using UserManagement.Application.Contract.ViewModels;
using UserManagement.Infrastructure.Persistence;
using UserManagement.Infrastructure.Query.Contract.Delegation;
using Azure.Core;

namespace UserManagement.Infrastructure.Query
{
    public class DelegationQueryHandler(UserManagementQueryContext context, IClaimHelper claimHelper) :
       // IQueryHandlerAsync<EditDelegation, Guid>,
        IQueryHandlerAsync<List<DelegationViewModel>, DelegationGuidModel>,
       IQueryHandlerAsync<string,DelegationPermissionRequestDto>
    //IQueryHandlerAsync<List<DelegationViewModel>, Guid>,
        //IQueryHandlerAsync<DelegationViewModel, Guid>,
        //IQueryHandlerAsync<List<PermissionViewModel>, Guid>

    {
        //public async Task<EditDelegation> Handle(Guid condition)
        //{
        //    var result = await context.Delegations.Select(c => new EditDelegation()
        //    {
        //        Guid = c.Guid,
        //        DelegateeGuid = c.DelegateeGuid,
        //        DelegatorGuid = c.DelegatorGuid,
        //        EndDate = c.EndDate.ToString("yyyy/MM/dd"),
        //        StartDate = c.StartDate.ToString("yyyy/MM/dd"),
        //    }).FirstOrDefaultAsync(c => c.Guid == condition);
        //    return result;
        //}


        /// <summary>
        /// سمت‌های خود کاربر جاری + تفویض‌های فعالی که به او داده شده.
        /// قبلاً همه‌ی کاربران و سمت‌هایشان در هر درخواست در حافظه بارگذاری می‌شد؛ این متد در هر درخواست
        /// سامانه‌ی جلسات (برای راستی‌آزمایی سمت) صدا زده می‌شود، پس با چند Query هدفمند جایگزین شد.
        /// </summary>
        public async Task<List<DelegationViewModel>> Handle(DelegationGuidModel condition)
        {
            var now = DateTime.Now;
            var userGuid = claimHelper.GetCurrentUserGuid();
            var user = await context.Users.AsNoTracking()
                .Where(u => u.Guid == userGuid)
                .Select(u => new { u.Id, FullName = u.FirstName + " " + u.LastName })
                .FirstOrDefaultAsync();
            if (user is null) return [];

            var own = await context.UserPositions.AsNoTracking()
                .Where(up => up.UserId == user.Id)
                .Select(up => new DelegationViewModel
                {
                    Id = 0,
                    UserName = user.FullName,
                    UserGuid = userGuid,
                    Position = up.Position.Title,
                    PositionGuid = up.Position.Guid,
                    IsDelegate = false,
                    IsSuperAdmin = up.Position.IsSuperAdmin,
                })
                .ToListAsync();

            var delegated = await (
                    from d in context.Delegations.AsNoTracking()
                    where d.DelegatedUserId == user.Id && d.IsActive == 1 && d.StartDate <= now && d.EndDate >= now
                    join p in context.Positions on d.PositionId equals p.Id
                    join u in context.Users on d.UserId equals u.Id
                    select new DelegationViewModel
                    {
                        Id = d.Id,
                        UserName = (u.FirstName ?? "") + " " + (u.LastName ?? ""),
                        UserGuid = u.Guid,
                        Position = p.Title ?? "",
                        PositionGuid = p.Guid,
                        IsDelegate = true,
                    })
                .ToListAsync();

            return own.Concat(delegated).ToList();
        }

        //async Task<List<DelegationViewModel>> IQueryHandlerAsync<List<DelegationViewModel>, Guid>.Handle(Guid condition)
        //{
        //    var users = await context.Users.ToListAsync(); // دریافت لیست کاربران برای کاهش درخواست‌های دیتابیس


        //    var delegations = await context.Delegations
        //        .Where(c => c.DelegatorGuid == condition)
        //        .ToListAsync();
        //    return delegations.Select(item => new DelegationViewModel()
        //    {
        //        Guid = item.Guid,
        //        DelegateeGuid = item.DelegateeGuid,
        //        DelegatorGuid = item.DelegatorGuid,
        //        EndDate = item.EndDate.ToString("yyyy/MM/dd"),
        //        StartDate = item.StartDate.ToString("yyyy/MM/dd"),
        //        Delegatee = users.FirstOrDefault(u => u.Guid == item.DelegateeGuid).FirstName + " " + users.FirstOrDefault(u => u.Guid == item.DelegateeGuid).LastName,
        //        Delegator = users.FirstOrDefault(u => u.Guid == item.DelegatorGuid).FirstName + " " + users.FirstOrDefault(u => u.Guid == item.DelegatorGuid).LastName,
        //        IsActive = item.IsActive
        //    })
        //        .ToList();
        //}

        //async Task<DelegationViewModel> IQueryHandlerAsync<DelegationViewModel, Guid>.Handle(Guid condition)
        //{
        //    var result = await context.Delegations
        //        .Where(c => c.DelegatorGuid == condition)
        //        .Select(c => new DelegationViewModel
        //        {
        //            Guid = c.Guid,
        //            DelegateeGuid = c.DelegateeGuid,
        //            DelegatorGuid = c.DelegatorGuid,
        //            EndDate = c.EndDate.ToString("yyyy/MM/dd"),
        //            StartDate = c.StartDate.ToString("yyyy/MM/dd"),
        //        })
        //        .FirstOrDefaultAsync();

        //    return result;
        //}

        //async Task<List<PermissionViewModel>> IQueryHandlerAsync<List<PermissionViewModel>, Guid>.Handle(Guid condition)
        //{
        //    var permissions = await context.DelegationPermissions
        //        .Where(c => c.Delegation.Guid == condition)
        //        .Select(c => new PermissionViewModel()
        //        {
        //            Name = c.Permission.Name,
        //            Guid = c.Delegation.Guid,
        //            Text = c.Permission.Title
        //        })
        //        .ToListAsync();
        //    return permissions;
        //}
        public async Task<string> Handle(DelegationPermissionRequestDto request)
        {
            // فقط تفویض‌گیرنده‌ی همان تفویض (و در بازه‌ی فعال) دسترسی‌های آن را می‌بیند
            var now = DateTime.Now;
            var userGuid = claimHelper.GetCurrentUserGuid();
            var ownsDelegation = await (
                from d in context.Delegations.AsNoTracking()
                join u in context.Users on d.DelegatedUserId equals u.Id
                where d.Id == request.DelegationId && u.Guid == userGuid && d.IsActive == 1 && d.StartDate <= now && d.EndDate >= now
                select d.Id).AnyAsync();
            if (!ownsDelegation) return string.Empty;

            var system = context.Systems.FirstOrDefault(c => c.ClientId == request.ClientId);
            if (system is null) return string.Empty;
            var permissions =
                context.DelegationSystemPermissions
                    .Where(c=>c.DelegationSystem.SystemId==system.Id)
                    .Where(c => c.DelegationSystem.DelegationId == request.DelegationId)
                    .Select(c => c.Permission.Title).ToList();
            return string.Join(",", permissions);
        }
    }
}
