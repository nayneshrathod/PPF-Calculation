import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrintDataService } from '../print-data.service';

@Component({
    selector: 'app-report-preview',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './report-preview.html',
    styleUrl: './report-preview.css'
})
export class ReportPreviewComponent {
    printService = inject(PrintDataService);
    data = this.printService.data;
    today: Date = new Date();

    formatCurrency(val: number): string {
        return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(val);
    }

    printReport() {
        window.print();
    }

    closePreview() {
        this.printService.data.set(null);
    }
}
