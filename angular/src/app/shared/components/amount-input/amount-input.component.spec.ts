import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { AmountInputComponent } from './amount-input.component';

@Component({
  imports: [AmountInputComponent],
  template: `<app-amount-input [amountCents]="amountCents" (amountCentsChange)="onChange($event)" />`,
})
class Host {
  amountCents: number | null = null;
  onChange = vi.fn();
}

describe('AmountInputComponent', () => {
  it('formats integer cents to "22.50" on init', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.amountCents = 2250;
    fixture.detectChanges();
    const ac = fixture.debugElement.children[0].componentInstance as AmountInputComponent;
    expect(ac.display).toBe('22.50');
  });

  it('parses "22.50" to 2250 cents on input', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = '22.50';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.onChange).toHaveBeenCalledWith(2250);
  });

  it('emits null when cleared', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.amountCents = 1234;
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = '';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.onChange).toHaveBeenLastCalledWith(null);
  });

  it('reformats `display` on blur to two decimals', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = '5';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const ac = fixture.debugElement.children[0].componentInstance as AmountInputComponent;
    ac.onBlur();
    expect(ac.display).toBe('5.00');
  });

  it('does not reformat `display` mid-typing when the parent echoes the value back', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const ac = fixture.debugElement.children[0].componentInstance as AmountInputComponent;

    input.value = '3';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    // Simulate the parent's two-way echo: (amountCentsChange)="amountCents = $event".
    const emitted = fixture.componentInstance.onChange.mock.calls.at(-1)![0] as number;
    ac.amountCents = emitted;
    fixture.detectChanges();

    expect(ac.display).toBe('3'); // not "3.00" — typing must not be corrupted
  });
});
