import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PpfCalculatorService, PpfYearlyBreakdown } from './ppf-calculator.service';
import { ExportService } from './export.service';
import { PrintDataService } from '../print-data.service';
import { ThemeService } from '../theme.service';

interface ComparisonRow {
  percent: number;
  maturity: number;
}

@Component({
  selector: 'app-calculator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calculator.html',
  styleUrl: './calculator.css',
})
export class Calculator {
  private ppfService = inject(PpfCalculatorService);
  private exportService = inject(ExportService);
  private printDataService = inject(PrintDataService);
  protected themeService = inject(ThemeService);

  // 1. Inputs
  startAmount: number = 1000;
  startMonth: number = 3; // March (One month in first FY)
  startYear: number = 2026;
  durationYears: number = 60;

  stepUpPercent: number = 0;
  stepUpFrequencyMonths: number = 12;

  // 2. Outputs
  masterTable: PpfYearlyBreakdown[] = [];
  comparisonTable: ComparisonRow[] = [];

  // Summary Card Vars
  totalInvested: number = 0;
  totalInterest: number = 0;
  finalMaturity: number = 0;

  months = [
    { val: 1, name: 'January' }, { val: 2, name: 'February' }, { val: 3, name: 'March' },
    { val: 4, name: 'April' }, { val: 5, name: 'May' }, { val: 6, name: 'June' },
    { val: 7, name: 'July' }, { val: 8, name: 'August' }, { val: 9, name: 'September' },
    { val: 10, name: 'October' }, { val: 11, name: 'November' }, { val: 12, name: 'December' },
  ];

  years: number[] = [];
  stepUpOptions = Array.from({ length: 100 }, (_, i) => i + 1); // 1-100%

  // Mobile Sidebar State
  isMobileSidebarOpen: boolean = false;
  isDesktopSidebarOpen: boolean = true; // Default open on desktop

  get stepUpFrequencyOptions() {
    const maxMonths = this.durationYears * 12;
    const options = [];
    for (let m = 1; m <= maxMonths; m++) {
      let label = `${m} Month${m > 1 ? 's' : ''}`;
      if (m % 12 === 0) {
        label += ` (${m / 12} Year${m / 12 > 1 ? 's' : ''})`;
      }
      options.push({ val: m, label });
    }
    return options;
  }

  constructor() {
    const currentYear = new Date().getFullYear();
    for (let i = currentYear; i <= currentYear + 70; i++) {
      this.years.push(i);
    }
    this.calculate();
  }

  get endYear(): number {
    return this.startYear + this.durationYears;
  }

  updateDuration() {
    this.calculate();
  }

  validateInputs() {
    // Max cap is strictly immediate
    if (this.startAmount > 12500) {
      this.startAmount = 12500;
    }
    // If empty/null/0, snap to 500
    if (this.startAmount === null || this.startAmount === undefined || this.startAmount === 0) {
      this.startAmount = 500;
    }
  }

  onAmountInput(event: any) {
    const val = event.target.value;
    const num = parseFloat(val);

    // If typing results in > 12500, cap it immediately in the DOM too
    if (num > 12500) {
      this.startAmount = 12500;
      event.target.value = 12500;
    } else if (val === '' || num === 0) {
      // If cleared, snap to 500
      this.startAmount = 500;
      event.target.value = 500;
    } else {
      this.startAmount = num;
    }
    this.calculate();
  }

  onBlur() {
    // Final check for minimum when user leaves the field
    if (!this.startAmount || this.startAmount < 500) {
      this.startAmount = 500;
    }
    if (this.startAmount > 12500) {
      this.startAmount = 12500;
    }
    this.calculate();
  }

  toggleMobileSidebar() {
    this.isMobileSidebarOpen = !this.isMobileSidebarOpen;
  }

  toggleDesktopSidebar() {
    this.isDesktopSidebarOpen = !this.isDesktopSidebarOpen;
  }

  calculate() {
    this.validateInputs();
    // 1. Master Table -> Strict Financial Year Logic (User Requests FY based)
    this.masterTable = this.ppfService.calculateDetailedBreakdown(
      this.startAmount,
      this.startMonth,
      this.startYear,
      this.durationYears,
      this.stepUpPercent,
      this.stepUpFrequencyMonths
    );

    console.log(`[Calculator] Calculated masterTable:`, this.masterTable.length, 'records');
    console.log('[Calculator] Current params:', {
      amount: this.startAmount,
      month: this.startMonth,
      year: this.startYear,
      duration: this.durationYears,
      stepUp: this.stepUpPercent,
      freq: this.stepUpFrequencyMonths
    });

    // Summary
    if (this.masterTable.length > 0) {
      const lastRec = this.masterTable[this.masterTable.length - 1];
      this.finalMaturity = lastRec.closingBalance;

      this.totalInvested = this.masterTable.reduce((sum, row) => sum + row.totalPeriodDeposit, 0);
      this.totalInterest = this.finalMaturity - this.totalInvested;
    } else {
      this.finalMaturity = 0;
      this.totalInvested = 0;
      this.totalInterest = 0;
    }

    // 2. Comparison Table
    this.comparisonTable = [1, 2, 3, 4, 5, 8, 10, 12, 15, 18, 21, 25].map(p => {
      const rows = this.ppfService.calculateDetailedBreakdown(
        this.startAmount,
        this.startMonth,
        this.startYear,
        this.durationYears,
        p,
        this.stepUpFrequencyMonths
      );
      const maturity = rows.length > 0 ? rows[rows.length - 1].closingBalance : 0;
      return { percent: p, maturity: maturity };
    });
  }

  openPrintPreview() {
    const monthName = this.months.find(m => m.val == this.startMonth)?.name || 'Apr';
    this.printDataService.setData({
      masterTable: this.masterTable,
      summary: {
        totalInvested: this.totalInvested,
        totalInterest: this.totalInterest,
        maturity: this.finalMaturity
      },
      inputs: {
        startAmount: this.startAmount,
        startMonth: monthName,
        startYear: this.startYear,
        duration: this.durationYears,
        stepUp: this.stepUpPercent,
        stepUpFreq: this.stepUpFrequencyMonths
      }
    });
  }

  downloadExcel() {
    const monthName = this.months.find(m => m.val == this.startMonth)?.name || 'Apr';
    this.exportService.exportToExcel(
      this.masterTable,
      {
        totalInvested: this.totalInvested,
        totalInterest: this.totalInterest,
        maturity: this.finalMaturity
      },
      {
        startAmount: this.startAmount,
        startMonth: monthName,
        startYear: this.startYear,
        duration: this.durationYears,
        stepUp: this.stepUpPercent,
        stepUpFreq: this.stepUpFrequencyMonths
      }
    );
  }
}
