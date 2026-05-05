/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@angular/core';
import { from } from 'rxjs';
import { Api, Ops, Sents } from '@shared/interfaces';
import { Operator } from '@shared/types';

@Injectable({
  providedIn: 'root',
})
export class ElectronService {
  private api: Api = (window as any).api;
  private ops: Ops = (window as any).ops;
  private sents: Sents = (window as any).sents;

  constructor() {}

  addOne(): void {
    const value = from(this.api.addOne());
    value.subscribe((val) => console.log('ElectronService - addOne called, new value: ' + val));
  }

  calcOperation(num1: number, num2: number, operator: Operator) {
    return from(this.ops.runOperation(num1, num2, operator));
  }

  calcSentence(sentence: string) {
    return from(this.sents.count(sentence));
  }
}
