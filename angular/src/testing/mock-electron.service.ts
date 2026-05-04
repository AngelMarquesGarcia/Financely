import { Injectable } from '@angular/core';
import { of, Observable } from 'rxjs';
import { ElectronService } from '../app/core/services/electron.service';

@Injectable()
export class MockElectronService implements Partial<ElectronService> {
  addOne(): void {}

  calcOperation(num1: number, num2: number, operator: string): Observable<number> {
    let result = 0;
    switch (operator) {
      case '+':
        result = num1 + num2;
        break;
      case '-':
        result = num1 - num2;
        break;
      case '*':
        result = num1 * num2;
        break;
      case '/':
        result = num2 !== 0 ? num1 / num2 : 0;
        break;
    }
    return of(result);
  }

  calcSentence(sentence: string): Observable<{ chars: number; words: number }> {
    const words = sentence.split(' ').filter((w) => w.length > 0).length;
    const chars = sentence.length;
    return of({ chars, words });
  }
}
