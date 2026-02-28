import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { importProvidersFrom } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageModule } from 'ng-zorro-antd/message';
import { NgxEchartsModule } from 'ngx-echarts';
import { vi_VN, NZ_I18N } from 'ng-zorro-antd/i18n';
import { registerLocaleData } from '@angular/common';
import vi from '@angular/common/locales/vi';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';

registerLocaleData(vi);

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(),
    { provide: NZ_I18N, useValue: vi_VN },
    importProvidersFrom(
      NzIconModule,
      NzMessageModule,
      NgxEchartsModule.forRoot({ echarts: () => import('echarts') })
    )
  ]
}).catch(err => console.error(err));
