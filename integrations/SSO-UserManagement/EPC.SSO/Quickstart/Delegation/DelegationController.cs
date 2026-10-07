
using Epc.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using UserManagement.Domain.DelegationAgg;
using UserManagement.Domain.PermissionAgg;
using UserManagement.Infrastructure.Persistence;
using DomainUser = UserManagement.Domain.UserAgg.User;

namespace EPC.SSO.Quickstart.Delegation
{
    /// <summary>
    /// تفویض اختیار کاربر جاری.
    /// همه‌ی عملیات فقط روی تفویض‌های خود کاربر انجام می‌شود و دسترسی‌های قابل تفویض در سرور دوباره بررسی می‌شوند
    /// (کاربر فقط دسترسی‌هایی را می‌تواند تفویض کند که خودش دارد + والدهای آن‌ها برای نمایش منو).
    /// </summary>
    [Authorize]
    public class DelegationController(UserManagementCommandContext context) : Controller
    {
        public async Task<IActionResult> Index()
        {
            var user = await CurrentUserAsync();
            if (user == null) return Unauthorized();

            var delegations = await context.Delegations
                .AsNoTracking()
                .Where(c => c.UserId == user.Id)
                .Select(d => new DelegationListItemViewModel
                {
                    Id = d.Id,
                    UserName = context.Users.Where(c => c.Id == d.DelegatedUserId)
                        .Select(c => c.FirstName + " " + c.LastName).FirstOrDefault(),
                    UserId = d.UserId,
                    DelegatedUserId = d.DelegatedUserId,
                    StartDate = d.StartDate,
                    EndDate = d.EndDate,
                    Systems = d.DelegationSystems.Select(ds => new SystemItemViewModel
                    {
                        SystemName = ds.System.Title,
                        Rights = ds.DelegationSystemPermissions.Select(dsp => dsp.Permission.Name).ToList()
                    }).ToList()
                }).ToListAsync();

            return View(delegations);
        }

        public async Task<IActionResult> Create(int? id)
        {
            var user = await CurrentUserAsync();
            if (user == null) return Unauthorized();

            CreateDelegationViewModel model;
            Dictionary<int, List<int>> selected = new();

            if (id.HasValue)
            {
                var delegation = await context.Delegations
                    .AsNoTracking()
                    .Include(d => d.DelegationSystems)
                    .ThenInclude(ds => ds.DelegationSystemPermissions)
                    .FirstOrDefaultAsync(d => d.Id == id.Value && d.UserId == user.Id);
                if (delegation == null) return NotFound();

                selected = delegation.DelegationSystems
                    .GroupBy(ds => ds.SystemId)
                    .ToDictionary(g => g.Key, g => g.SelectMany(ds => ds.DelegationSystemPermissions.Select(p => p.PermissionId)).ToList());

                model = new CreateDelegationViewModel
                {
                    Id = delegation.Id,
                    UserId = delegation.UserId,
                    PositionId = delegation.PositionId,
                    DelegatedUserId = delegation.DelegatedUserId,
                    DelegatedPositionId = delegation.DelegatedPositionId,
                    StartDate = delegation.StartDate.ToString("yyyy/MM/dd"),
                    EndDate = delegation.EndDate.ToString("yyyy/MM/dd"),
                    SelectedSystems = delegation.DelegationSystems.Select(ds => new SelectedSystemViewModel
                    {
                        SystemId = ds.SystemId,
                        IsSelected = true,
                        SelectedPermissions = ds.DelegationSystemPermissions.Select(dsp => dsp.PermissionId).ToList()
                    }).ToList()
                };
            }
            else
            {
                model = new CreateDelegationViewModel();
            }

            var scope = await LoadDelegableScopeAsync(user);
            model.Systems = BuildSystems(scope, selected);
            model.Users = await LoadUsersAsync(user.Id);
            return View(model);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(CreateDelegationViewModel model)
        {
            var user = await CurrentUserAsync();
            if (user == null) return Unauthorized();

            var scope = await LoadDelegableScopeAsync(user);
            model.SelectedSystems ??= new List<SelectedSystemViewModel>();

            if (model.DelegatedUserId == user.Id)
                ModelState.AddModelError(nameof(model.DelegatedUserId), "تفویض به خود امکان‌پذیر نیست");
            else if (!await context.Users.AnyAsync(u => u.Id == model.DelegatedUserId && u.IsActive == 1))
                ModelState.AddModelError(nameof(model.DelegatedUserId), "کاربر انتخاب‌شده معتبر نیست");

            if (!string.IsNullOrWhiteSpace(model.StartDate) && !string.IsNullOrWhiteSpace(model.EndDate))
            {
                try
                {
                    if (model.EndDate.ToGeorgianDateTime() < model.StartDate.ToGeorgianDateTime())
                        ModelState.AddModelError(nameof(model.EndDate), "تاریخ پایان نباید قبل از تاریخ شروع باشد");
                }
                catch
                {
                    ModelState.AddModelError(nameof(model.StartDate), "فرمت تاریخ نامعتبر است");
                }
            }

            // فقط سامانه‌ها و دسترسی‌هایی که کاربر واقعاً دارد (ورودی فرم قابل اعتماد نیست)
            var delegationSystems = new List<DelegationSystem>();
            foreach (var system in model.SelectedSystems.Where(c => c.IsSelected))
            {
                if (!scope.Delegable.TryGetValue(system.SystemId, out var allowed))
                {
                    ModelState.AddModelError(string.Empty, "سامانه‌ی انتخاب‌شده در دسترس شما نیست");
                    break;
                }

                var permissionIds = (system.SelectedPermissions ?? new List<int>()).Distinct().ToList();
                if (permissionIds.Any(p => !allowed.Contains(p)))
                {
                    ModelState.AddModelError(string.Empty, "فقط دسترسی‌هایی را می‌توانید تفویض کنید که خودتان دارید");
                    break;
                }

                delegationSystems.Add(new DelegationSystem
                {
                    SystemId = system.SystemId,
                    DelegationSystemPermissions = permissionIds
                        .Select(permissionId => new DelegationSystemPermission { PermissionId = permissionId })
                        .ToList()
                });
            }

            if (!ModelState.IsValid)
            {
                var selected = model.SelectedSystems
                    .Where(s => s.IsSelected)
                    .GroupBy(s => s.SystemId)
                    .ToDictionary(g => g.Key, g => g.SelectMany(s => s.SelectedPermissions ?? new List<int>()).ToList());
                model.Systems = BuildSystems(scope, selected);
                model.Users = await LoadUsersAsync(user.Id);
                return View(model);
            }

            var delegatedPosition = await context.UserPositions
                .Where(c => c.UserId == model.DelegatedUserId)
                .Select(c => c.PositionId)
                .FirstOrDefaultAsync();

            if (model.Id.HasValue)
            {
                var delegation = await context.Delegations
                    .Include(d => d.DelegationSystems)
                    .ThenInclude(ds => ds.DelegationSystemPermissions)
                    .FirstOrDefaultAsync(d => d.Id == model.Id.Value && d.UserId == user.Id);
                if (delegation == null) return NotFound();

                delegation.Edit(user.Guid, model.DelegatedUserId, delegatedPosition ?? 0, model.StartDate, model.EndDate, delegationSystems);
                context.Delegations.Update(delegation);
            }
            else
            {
                var delegation = new UserManagement.Domain.DelegationAgg.Delegation(
                    creator: user.Guid,
                    userId: user.Id,
                    positionId: scope.PositionId ?? 0,
                    delegatedUserId: model.DelegatedUserId,
                    delegatedPositionId: delegatedPosition ?? 0,
                    startDate: model.StartDate,
                    endDate: model.EndDate,
                    systems: delegationSystems
                );

                context.Delegations.Add(delegation);
            }

            await context.SaveChangesAsync();
            return RedirectToAction("Index", "Delegation");
        }

        // ───────────────────────────── Helpers ─────────────────────────────

        private sealed record DelegableScope(
            int? PositionId,
            List<UserManagement.Domain.SystemAgg.System> Systems,
            List<Permission> Permissions,
            HashSet<int> Owned,
            Dictionary<int, HashSet<int>> Delegable);

        private async Task<DomainUser?> CurrentUserAsync()
        {
            if (!Guid.TryParse(User.FindFirst("sub")?.Value, out var userGuid)) return null;
            return await context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Guid == userGuid);
        }

        /// <summary>
        /// سامانه‌ها و دسترسی‌های قابل تفویض کاربر با چند کوئری ثابت (به جای کوئری برای هر سامانه/دسترسی/والد).
        /// دسترسی‌ها از اولین سمت کاربر (همان سمتی که تفویض با آن ثبت می‌شود) خوانده می‌شوند.
        /// </summary>
        private async Task<DelegableScope> LoadDelegableScopeAsync(DomainUser user)
        {
            var systemIds = await context.Users
                .Where(u => u.Id == user.Id)
                .SelectMany(u => u.Systems.Select(us => us.SystemId)
                    .Union(u.Positions.SelectMany(up => up.Position.PositionSystems.Select(ps => ps.SystemId))))
                .Distinct()
                .ToListAsync();

            var positionId = await context.UserPositions
                .Where(up => up.UserId == user.Id)
                .Select(up => up.PositionId)
                .FirstOrDefaultAsync();

            var owned = new HashSet<int>();
            if (positionId is > 0)
            {
                owned.UnionWith(await context.PositionPermissions
                    .Where(pp => pp.PositionId == positionId)
                    .Select(pp => pp.PermissionId)
                    .ToListAsync());
                owned.UnionWith(await context.PositionGroups
                    .Where(pg => pg.PositionId == positionId)
                    .SelectMany(pg => pg.Group.GroupPermissions.Select(gp => gp.PermissionId))
                    .ToListAsync());
            }

            var systems = await context.Systems.AsNoTracking()
                .Where(s => systemIds.Contains(s.Id))
                .ToListAsync();
            var permissions = await context.Permissions.AsNoTracking()
                .Where(p => systemIds.Contains(p.SystemId))
                .ToListAsync();

            var byId = permissions.ToDictionary(p => p.Id);
            var delegable = systemIds.ToDictionary(s => s, _ => new HashSet<int>());
            foreach (var permission in permissions.Where(p => owned.Contains(p.Id)))
            {
                var set = delegable[permission.SystemId];
                set.Add(permission.Id);

                // والدها فقط برای ساخت درخت (منو) قابل انتخاب‌اند
                var parentId = permission.ParentId;
                while (parentId.HasValue
                       && byId.TryGetValue(parentId.Value, out var parent)
                       && parent.SystemId == permission.SystemId
                       && set.Add(parent.Id))
                {
                    parentId = parent.ParentId;
                }
            }

            return new DelegableScope(positionId, systems, permissions, owned, delegable);
        }

        private List<SystemViewModel> BuildSystems(DelegableScope scope, Dictionary<int, List<int>> selected)
        {
            return scope.Systems.Select(system =>
            {
                var visible = scope.Delegable.TryGetValue(system.Id, out var ids) ? ids : new HashSet<int>();
                var permissions = scope.Permissions.Where(p => p.SystemId == system.Id && visible.Contains(p.Id)).ToList();
                return new SystemViewModel
                {
                    SystemId = system.Id,
                    SystemName = system.Title,
                    Permissions = BuildPermissionTree(permissions, selected.GetValueOrDefault(system.Id))
                };
            }).ToList();
        }

        private Task<List<UserViewModel>> LoadUsersAsync(int currentUserId) =>
            context.Users.AsNoTracking()
                .Where(c => c.IsActive == 1 && c.Id != currentUserId)
                .Select(c => new UserViewModel
                {
                    FullName = c.FirstName.Replace('ي', 'ی') + " " + (!string.IsNullOrEmpty(c.LastName) ? c.LastName.Replace('ي', 'ی') : ""),
                    Id = c.Id
                }).ToListAsync();

        private static List<PermissionViewModel> BuildPermissionTree(List<Permission> permissions, List<int>? selectedPermissions = null)
        {
            selectedPermissions ??= new List<int>();

            var permissionViewModels = permissions.Select(p => new PermissionViewModel
            {
                PermissionId = p.Id,
                PermissionName = p.Name,
                Title = p.Title,
                ParentId = p.ParentId,
                IsSelected = selectedPermissions.Contains(p.Id)
            }).ToList();

            // ریشه‌ها: بدون والد یا والدی که در لیست نیست
            var ids = permissionViewModels.Select(p => p.PermissionId).ToHashSet();
            var tree = permissionViewModels.Where(p => p.ParentId == null || !ids.Contains(p.ParentId.Value)).ToList();

            var children = permissionViewModels.Where(p => p.ParentId.HasValue)
                .ToLookup(p => p.ParentId!.Value);
            foreach (var parent in tree)
                AddChildren(parent, children);

            return tree;
        }

        private static void AddChildren(PermissionViewModel parent, ILookup<int, PermissionViewModel> children)
        {
            foreach (var child in children[parent.PermissionId])
            {
                parent.Children.Add(child);
                AddChildren(child, children);
            }
        }
    }
}
