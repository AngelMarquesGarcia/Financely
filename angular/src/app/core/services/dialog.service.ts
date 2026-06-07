import { Injectable, Injector, Type, inject } from '@angular/core';
import { Overlay, OverlayConfig } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { DIALOG_DATA } from './dialog.tokens';
import { DialogRef } from './dialog-ref';

export interface DialogConfig<D = unknown> {
  data?: D;
  maxWidth?: string;
  panelClass?: string | string[];
}

/**
 * Imperative dialog opener built on CDK Overlay. Use for confirms, alerts, and
 * short-lived dialogs where the host doesn't want to declare the component in
 * its template (e.g. `confirm.confirm(...)`, `dialog.open(SettingsComponent)`).
 *
 * For windowed feature components hosted inside a parent template, prefer
 * `<app-modal [open]="...">` (see `ModalComponent`).
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly overlay = inject(Overlay);
  private readonly injector = inject(Injector);

  open<T, D = unknown, R = unknown>(component: Type<T>, config: DialogConfig<D> = {}): DialogRef<R> {
    const extraClasses = Array.isArray(config.panelClass)
      ? config.panelClass
      : config.panelClass
        ? [config.panelClass]
        : [];

    const overlayConfig: OverlayConfig = {
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      panelClass: ['dialog-panel', ...extraClasses],
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      scrollStrategy: this.overlay.scrollStrategies.block(),
      maxWidth: config.maxWidth ?? 'min(32rem, 92vw)',
    };

    const overlayRef = this.overlay.create(overlayConfig);
    const dialogRef = new DialogRef<R>(overlayRef);

    const childInjector = Injector.create({
      parent: this.injector,
      providers: [
        { provide: DialogRef, useValue: dialogRef },
        { provide: DIALOG_DATA, useValue: config.data ?? null },
      ],
    });

    overlayRef.attach(new ComponentPortal(component, null, childInjector));
    return dialogRef;
  }
}
