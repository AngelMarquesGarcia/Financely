import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { EmptyStateComponent } from './empty-state.component';

@Component({
  imports: [EmptyStateComponent],
  template: `<app-empty-state message="Nothing here." />`,
})
class HostComponent {}

@Component({
  imports: [EmptyStateComponent],
  template: `<app-empty-state message="Empty." icon="📭" />`,
})
class HostWithIconComponent {}

describe('EmptyStateComponent', () => {
  it('renders the message text', () => {
    const fixture = TestBed.configureTestingModule({ imports: [HostComponent] }).createComponent(
      HostComponent,
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nothing here.');
  });

  it('applies the empty class to the paragraph', () => {
    const fixture = TestBed.configureTestingModule({ imports: [HostComponent] }).createComponent(
      HostComponent,
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.empty')).not.toBeNull();
  });

  it('renders icon inside .empty__icon when icon is set', () => {
    const fixture = TestBed.configureTestingModule({
      imports: [HostWithIconComponent],
    }).createComponent(HostWithIconComponent);
    fixture.detectChanges();
    const span = fixture.nativeElement.querySelector('.empty__icon');
    expect(span).not.toBeNull();
    expect(span.textContent).toContain('📭');
  });

  it('renders no .empty__icon span when icon is not set', () => {
    const fixture = TestBed.configureTestingModule({ imports: [HostComponent] }).createComponent(
      HostComponent,
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.empty__icon')).toBeNull();
  });
});
