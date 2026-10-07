// Copyright (c) Brock Allen & Dominick Baier. All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.


using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EPC.SSO.Quickstart.Diagnostics
{
    [SecurityHeaders]
    [Authorize]
    public class DiagnosticsController : Controller
    {
        public async Task<IActionResult> Index()
        {
            // فقط از خود سرور و فقط وقتی صریحاً فعال شده باشد؛ پشت Reverse Proxy همه‌ی درخواست‌ها
            // از 127.0.0.1 می‌آیند و بررسی IP به‌تنهایی کافی نیست.
            var remote = HttpContext.Connection.RemoteIpAddress;
            var enabled = HttpContext.RequestServices.GetRequiredService<IConfiguration>().GetValue("Diagnostics:Enabled", false);
            if (!enabled || remote is null || !System.Net.IPAddress.IsLoopback(remote))
            {
                return NotFound();
            }

            var model = new DiagnosticsViewModel(await HttpContext.AuthenticateAsync());
            return View(model);
        }
    }
}