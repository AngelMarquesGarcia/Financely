import { TestBed } from '@angular/core/testing';
import { SentencesComponent } from './sentences.component';
import { ElectronService } from '../../core/services/electron.service';
import { MockElectronService } from '../../../testing/mock-electron.service';

describe('SentencesComponent', () => {
  let component: SentencesComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SentencesComponent],
      providers: [{ provide: ElectronService, useClass: MockElectronService }],
    })
      .overrideComponent(SentencesComponent, {
        set: { template: '', styles: [] },
      })
      .compileComponents();

    component = TestBed.createComponent(SentencesComponent).componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have initial values', () => {
    expect(component.sentence).toBe('');
    expect(component.wordCount).toBeNull();
    expect(component.charCount).toBeNull();
  });

  it('should calculate word and char count', () => {
    component.sentence = 'Hello world';
    component.calculate();
    expect(component.wordCount).toBe(2);
    expect(component.charCount).toBe(11);
  });
});
