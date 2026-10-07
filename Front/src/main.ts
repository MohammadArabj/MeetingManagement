import { bootstrapApplication } from '@angular/platform-browser';
import { provideGlobalGridOptions } from 'ag-grid-enterprise';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { appGridTheme } from './app/shared/ag-grid-base/grid-theme';
import { applyStoredTheme } from './app/core/theme/theme.service';

// ظاهر یکسان همه‌ی جدول‌ها و اعمال حالت روشن/تیره پیش از اولین نمایش (بدون چشمک)
provideGlobalGridOptions({ theme: appGridTheme });
applyStoredTheme();

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
