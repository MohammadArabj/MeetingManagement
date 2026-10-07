using System.Security.Claims;
using System.Security.Principal;

namespace MeetingManagement.Common.Extensions;
public class IdentityUser(IPrincipal principal) : ClaimsPrincipal(principal)
{
    public bool IsSignedIn
    {
        get
        {
            if (Identity is { IsAuthenticated: true })
            {
                try
                {
                    int temp = UserId;
                    return true;
                }
                catch { return false; }
            }
            return false;
        }
    }

    public long TargetLinkId
    {
        get
        {
            var claim = FindFirst(ClaimTypes.PrimarySid);
            if (claim == null || string.IsNullOrWhiteSpace(claim.Value))
                return 0;
            //throw new Exception("TargetLink Exception: TargetLink Not Found!");
            return Convert.ToInt64(claim.Value);
        }
    }

    public int UserId
    {
        get
        {
            var claim = FindFirst(ClaimTypes.Sid);
            if (claim == null || string.IsNullOrWhiteSpace(claim.Value))
                throw new Exception("Identity Exception: UserId Not Found!");
            return Convert.ToInt32(claim.Value);
        }
    }

    public List<byte> Roles
    {
        get
        {
            var list = this.FindAll(ClaimTypes.Role);
            byte temp = 0;
            return (from item in list where byte.TryParse(item.Value, out temp) select temp).ToList();
        }
    }

    public List<string> StringRoles
    {
        get
        {
            var list = this.FindAll(ClaimTypes.Role);
            return list.Select(item => item.Value).ToList();
        }
    }

    public bool HasThisRole(int role)
    {
        return Roles.Any(a => a == role);
    }

    public bool HasThisRole(string role)
    {
        return StringRoles.Any(a => a == role);
    }

    public bool HasOneOfThisRoles(params int[] roles)
    {
        return Roles.Any(a => roles.Contains(a));
    }

    public bool HasOneOfThisRoles(params string[] roles)
    {
        return StringRoles.Any(roles.Contains);
    }

    public bool HasAllOfThisRoles(params byte[] roles)
    {
        return roles.All(a => Roles.Contains(a));
    }

    public bool HasAllOfThisRoles(params string[] roles)
    {
        return roles.All(a => StringRoles.Contains(a));
    }

}
public static class Ext
{
    public static int GetUserId(this IPrincipal user)
    {
        var userId = 0;
        if (user.Identity is not { IsAuthenticated: true }) return userId;
        var identityUser = new IdentityUser(user as ClaimsPrincipal);
        userId = identityUser.UserId;
        return userId;
    }
}