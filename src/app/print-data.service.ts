import { Injectable, signal } from '@angular/core';
import { PpfYearlyBreakdown } from './calculator/ppf-calculator.service';

export interface PrintData {
    masterTable: PpfYearlyBreakdown[];
    summary: { totalInvested: number, totalInterest: number, maturity: number };
    inputs: {
        startAmount: number;
        startMonth: string;
        startYear: number;
        duration: number;
        stepUp: number;
        stepUpFreq: number;
    };
}

@Injectable({
    providedIn: 'root'
})
export class PrintDataService {
    data = signal<PrintData | null>(null);

    setData(data: PrintData) {
        this.data.set(data);
    }
}
