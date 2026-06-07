import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ButtonComponent } from './button.component';

describe('ButtonComponent', () => {
  function setup(template: string) {
    @Component({ imports: [ButtonComponent], template })
    class H {}
    const fixture = TestBed.configureTestingModule({ imports: [H] }).createComponent(H);
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  }

  it('applies the correct variant class', () => {
    const btn = setup(`<app-button variant="primary">OK</app-button>`);
    expect(btn.classList.contains('btn--primary')).toBe(true);
  });

  it('applies ghost variant class', () => {
    const btn = setup(`<app-button variant="ghost">Cancel</app-button>`);
    expect(btn.classList.contains('btn--ghost')).toBe(true);
  });

  it('defaults to primary variant', () => {
    const btn = setup(`<app-button>Default</app-button>`);
    expect(btn.classList.contains('btn--primary')).toBe(true);
  });

  it('reflects disabled state', () => {
    const btn = setup(`<app-button [disabled]="true">X</app-button>`);
    expect(btn.disabled).toBe(true);
  });

  it('defaults type to button', () => {
    const btn = setup(`<app-button>X</app-button>`);
    expect(btn.type).toBe('button');
  });

  it('projects content', () => {
    const btn = setup(`<app-button>Label Text</app-button>`);
    expect(btn.textContent?.trim()).toBe('Label Text');
  });
});
