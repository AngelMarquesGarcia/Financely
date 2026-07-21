import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { StatCardComponent } from './stat-card.component';

describe('StatCardComponent', () => {
  it('renders title and value', () => {
    const fixture = TestBed.createComponent(StatCardComponent);
    fixture.componentRef.setInput('title', 'Balance');
    fixture.componentRef.setInput('value', '€100');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Balance');
    expect(el.textContent).toContain('€100');
  });

  it('renders sublabel when provided', () => {
    const fixture = TestBed.createComponent(StatCardComponent);
    fixture.componentRef.setInput('title', 'T');
    fixture.componentRef.setInput('value', 'V');
    fixture.componentRef.setInput('sublabel', 'extra info');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('extra info');
  });

  it('applies positive tone class', () => {
    const fixture = TestBed.createComponent(StatCardComponent);
    fixture.componentRef.setInput('title', 'T');
    fixture.componentRef.setInput('value', 'V');
    fixture.componentRef.setInput('tone', 'positive');
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.stat-card--positive'),
    ).not.toBeNull();
  });
});
