import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { ToastHostComponent } from './shared/components/toast-host/toast-host.component';
import { ElectronService } from './core/services/electron.service';
import { NotificationService } from './core/services/notification.service';
import { ErrorReporter } from './core/services/error-reporter.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent, ToastHostComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  title = 'Financely';

  private electron = inject(ElectronService);
  private notify = inject(NotificationService);
  private errors = inject(ErrorReporter);
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    // Generate any due periodic-movement instances on startup. Frontend-triggered so it can later
    // run at other times or gate on user review.
    this.electron
      .runDuePeriodicMovements()
      .pipe(this.errors.toast(), takeUntilDestroyed(this.destroyRef))
      .subscribe((created) => {
        if (created > 0) {
          this.notify.info(
            `${created} periodic movement${created === 1 ? '' : 's'} added for review.`,
          );
        }
      });
  }
}
