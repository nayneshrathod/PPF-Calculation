import { Component, signal } from '@angular/core';
import { Calculator } from './calculator/calculator';
import { ReportPreviewComponent } from './report-preview/report-preview';

@Component({
  selector: 'app-root',
  imports: [Calculator, ReportPreviewComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('investment-calculator');
}
