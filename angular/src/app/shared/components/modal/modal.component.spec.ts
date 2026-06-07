import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ModalComponent } from './modal.component';

function setup(open: boolean, title?: string) {
  @Component({
    imports: [ModalComponent],
    template: `<app-modal [open]="open" [title]="title" (closed)="onClose()">
      <p>Content</p>
      <div modalFooter>Footer</div>
    </app-modal>`,
  })
  class H {
    open = open;
    title = title;
    closed = vi.fn();
    onClose() { this.closed(); }
  }
  const fixture = TestBed.configureTestingModule({ imports: [H] }).createComponent(H);
  fixture.detectChanges();
  return fixture;
}

describe('ModalComponent', () => {
  it('renders nothing when open=false', () => {
    const fixture = setup(false);
    expect(fixture.nativeElement.querySelector('.modal-overlay')).toBeNull();
    expect(fixture.nativeElement.querySelector('.modal-panel')).toBeNull();
  });

  it('renders overlay and panel when open=true', () => {
    const fixture = setup(true);
    expect(fixture.nativeElement.querySelector('.modal-overlay')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.modal-panel')).not.toBeNull();
  });

  it('projects body content into the panel', () => {
    const fixture = setup(true);
    expect(fixture.nativeElement.querySelector('.modal-panel p')?.textContent).toBe('Content');
  });

  it('projects footer content via [modalFooter] slot', () => {
    const fixture = setup(true);
    expect(fixture.nativeElement.querySelector('.modal-panel [modalFooter]')?.textContent).toBe('Footer');
  });

  it('renders header with title and close button when title is set', () => {
    const fixture = setup(true, 'Edit item');
    const header = fixture.nativeElement.querySelector('.modal-header');
    expect(header).not.toBeNull();
    expect(header.querySelector('.modal-title')?.textContent?.trim()).toBe('Edit item');
    expect(header.querySelector('.modal-close')).not.toBeNull();
  });

  it('renders no header when title is not set', () => {
    const fixture = setup(true);
    expect(fixture.nativeElement.querySelector('.modal-header')).toBeNull();
  });

  it('emits closed when close button is clicked', () => {
    const fixture = setup(true, 'My Modal');
    const host = fixture.componentInstance;
    (fixture.nativeElement.querySelector('.modal-close') as HTMLElement).click();
    expect(host.closed).toHaveBeenCalledOnce();
  });

  it('emits closed when backdrop is clicked', () => {
    const fixture = setup(true);
    const host = fixture.componentInstance;
    (fixture.nativeElement.querySelector('.modal-overlay') as HTMLElement).click();
    expect(host.closed).toHaveBeenCalledOnce();
  });

  it('emits closed on ESC key when open', () => {
    const fixture = setup(true);
    const host = fixture.componentInstance;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(host.closed).toHaveBeenCalledOnce();
  });

  it('does not emit closed on ESC when not open', () => {
    const fixture = setup(false);
    const host = fixture.componentInstance;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(host.closed).not.toHaveBeenCalled();
  });
});
