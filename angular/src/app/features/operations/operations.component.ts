import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ElectronService } from '../../core/services/electron.service';
import { Operator } from '../../../../../shared/types';

@Component({
  selector: 'app-operations',
  imports: [FormsModule],
  templateUrl: './operations.component.html',
  styleUrl: './operations.component.scss',
})
export class OperationsComponent {
  private electronService = inject(ElectronService);

  num1: number = 0;
  num2: number = 0;
  operator: Operator = '+';
  result: number | null = null;

  calculate() {
    this.electronService
      .calcOperation(this.num1, this.num2, this.operator)
      .subscribe((result) => (this.result = result));
  }
}
