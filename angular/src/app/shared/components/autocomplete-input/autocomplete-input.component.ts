import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, debounceTime, switchMap, takeUntil } from 'rxjs';

/**
 * Text input with a dropdown of suggestions provided asynchronously by the caller.
 * The parent supplies a `(suggestFn)` that takes a prefix and returns an Observable
 * of string suggestions; this component handles debouncing, dropdown rendering,
 * keyboard nav (arrows, enter, escape) and dismissal on outside click.
 *
 * Stays display-agnostic: the value emitted (and accepted) is always a plain string.
 *
 * Usage:
 *   <app-autocomplete-input
 *     [value]="name"
 *     (valueChange)="name = $event"
 *     [suggestFn]="suggestNames"
 *     inputClass="form__input"
 *     placeholder="e.g. February rent"
 *   />
 */
@Component({
  selector: 'app-autocomplete-input',
  imports: [FormsModule],
  templateUrl: './autocomplete-input.component.html',
  styleUrl: './autocomplete-input.component.scss',
})
export class AutocompleteInputComponent implements OnDestroy {
  @Input() value = '';
  @Output() valueChange = new EventEmitter<string>();

  @Input() inputClass = '';
  @Input() inputId?: string;
  @Input() placeholder?: string;
  /** Minimum prefix length before the dropdown shows. */
  @Input() minLength = 2;
  /** Maximum number of suggestions rendered. */
  @Input() maxSuggestions = 10;
  /** Debounce window in ms before issuing a suggest call. */
  @Input() debounceMs = 150;
  /**
   * Async lookup. Caller's responsibility: filter/sort/dedupe and return strings.
   * If null/undefined, no dropdown is shown (the component degrades to a plain input).
   */
  @Input() suggestFn?: (prefix: string) => Observable<string[]>;

  @ViewChild('inputEl') inputEl?: ElementRef<HTMLInputElement>;

  suggestions: string[] = [];
  highlight = -1;
  open = false;

  private readonly hostEl = inject(ElementRef<HTMLElement>);

  private readonly query$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  constructor() {
    this.query$
      .pipe(
        debounceTime(this.debounceMs),
        switchMap((prefix) => {
          if (!this.suggestFn || prefix.length < this.minLength) {
            return [] as unknown as Observable<string[]>;
          }
          return this.suggestFn(prefix);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((list) => {
        this.suggestions = list.slice(0, this.maxSuggestions);
        this.open = this.suggestions.length > 0;
        this.highlight = this.open ? 0 : -1;
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onInput(value: string) {
    this.value = value;
    this.valueChange.emit(value);
    this.query$.next(value);
  }

  onFocus() {
    if (this.suggestions.length > 0 && this.value.length >= this.minLength) {
      this.open = true;
    }
  }

  onKeydown(event: KeyboardEvent) {
    if (!this.open || this.suggestions.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.highlight = (this.highlight + 1) % this.suggestions.length;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.highlight = (this.highlight - 1 + this.suggestions.length) % this.suggestions.length;
    } else if (event.key === 'Enter') {
      if (this.highlight >= 0) {
        event.preventDefault();
        this.select(this.suggestions[this.highlight]);
      }
    } else if (event.key === 'Escape') {
      this.open = false;
    }
  }

  select(suggestion: string) {
    this.value = suggestion;
    this.valueChange.emit(suggestion);
    this.open = false;
    this.suggestions = [];
    this.inputEl?.nativeElement.focus();
  }

  @HostListener('document:mousedown', ['$event.target'])
  onDocumentMouseDown(target: EventTarget | null) {
    if (target instanceof Node && !this.hostEl.nativeElement.contains(target)) {
      this.open = false;
    }
  }
}
