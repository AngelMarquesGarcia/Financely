import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { ElectronService } from './core/services/electron.service';
import { MockElectronService } from '../testing/mock-electron.service';

describe('AppComponent', () => {
  let component: AppComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [{ provide: ElectronService, useClass: MockElectronService }],
    })
      .overrideComponent(AppComponent, {
        set: { template: '', styles: [] },
      })
      .compileComponents();

    component = TestBed.createComponent(AppComponent).componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have the correct title', () => {
    expect(component.title).toBe('Financely');
  });
});
