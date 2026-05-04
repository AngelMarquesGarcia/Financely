import { TestBed } from '@angular/core/testing';
import { OperationsComponent } from './operations.component';
import { ElectronService } from '../../core/services/electron.service';
import { MockElectronService } from '../../../testing/mock-electron.service';

describe('OperationsComponent', () => {
  let component: OperationsComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OperationsComponent],
      providers: [{ provide: ElectronService, useClass: MockElectronService }],
    })
      .overrideComponent(OperationsComponent, {
        set: { template: '', styles: [] },
      })
      .compileComponents();

    component = TestBed.createComponent(OperationsComponent).componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have initial values', () => {
    expect(component.num1).toBe(0);
    expect(component.num2).toBe(0);
    expect(component.operator).toBe('+');
    expect(component.result).toBeNull();
  });

  it('should calculate operation', () => {
    component.num1 = 10;
    component.num2 = 5;
    component.operator = '+';
    component.calculate();
    expect(component.result).toBe(15);
  });
});
