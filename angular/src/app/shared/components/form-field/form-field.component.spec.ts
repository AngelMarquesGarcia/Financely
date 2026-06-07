import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { FormFieldComponent } from './form-field.component';

@Component({
  imports: [FormFieldComponent],
  template: `
    <app-form-field [label]="label" [error]="error" [optional]="optional">
      <input id="x" />
    </app-form-field>
  `,
})
class Host {
  label = 'Name';
  error: string | null = null;
  optional = false;
}

describe('FormFieldComponent', () => {
  it('renders the label and projects the input', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.form__label')?.textContent).toContain('Name');
    expect(el.querySelector('input#x')).not.toBeNull();
  });

  it('shows error text when error input is truthy', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.error = 'Required.';
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.form__error')?.textContent).toContain('Required.');
  });

  it('marks optional with "(optional)" suffix', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.optional = true;
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.form__label-optional')?.textContent).toContain('optional');
  });
});
