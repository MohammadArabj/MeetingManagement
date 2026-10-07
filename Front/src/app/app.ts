import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { WhatsNewComponent } from './app-shell/whats-new/whats-new.component';
import { LoadingBarComponent } from './core/loading/loading-bar.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, WhatsNewComponent, LoadingBarComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App { }
