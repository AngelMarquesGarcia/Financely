import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ElectronService } from '../../core/services/electron.service';

@Component({
  selector: 'app-sentences',
  imports: [FormsModule],
  templateUrl: './sentences.component.html',
  styleUrl: './sentences.component.scss',
})
export class SentencesComponent {
  private electronService = inject(ElectronService);

  sentence: string = '';
  wordCount: number | null = null;
  charCount: number | null = null;

  calculate() {
    this.electronService.calcSentence(this.sentence).subscribe((charwords) => {
      const { chars, words } = charwords;
      this.charCount = chars;
      this.wordCount = words;
    });
  }
}
