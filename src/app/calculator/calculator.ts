import { Component, inject, signal } from '@angular/core';
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

  // 1. Inputs (Standard properties for FormsModule)
  startAmount: number = 1000;
  startMonth: number = 3;
  startYear: number = 2026;
  durationYears: number = 60;

  stepUpPercent: number = 0;
  stepUpFrequencyMonths: number = 12;

  // 2. Outputs
  masterTable: { summary: PpfYearlyBreakdown; months: PpfYearlyBreakdown[]; isOpen: boolean }[] = [];
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

  // UI State: Signals (Modern Angular)
  isMobileSidebarOpen = signal<boolean>(false);
  isDesktopSidebarOpen = signal<boolean>(true);
  isComparisonOpen = signal<boolean>(true); // Default open
  isMonthlyView = signal<boolean>(false); // Toggle for Monthly/Yearly breakdown

  frequencyOptions: { val: number, label: string }[] = [];

  generateFrequencyOptions() {
    const maxMonths = this.durationYears * 12;
    const options = [];
    // Limit options to reasonable defaults for dropdown (e.g. every year, or months up to 5 years, then 5 year blocks?)
    // Listing 1 to 720 months is excessive for a UI dropdown.
    // Let's stick to the previous loop but aware it's large.
    for (let m = 1; m <= maxMonths; m++) {
      // optimization: only show relevant intervals? e.g. 1, 3, 6, 12, 24, 36...
      // For now, keep original logic but optimized execution.
      let label = `${m} Month${m > 1 ? 's' : ''}`;
      if (m % 12 === 0) {
        label += ` (${m / 12} Year${m / 12 > 1 ? 's' : ''})`;
      }
      options.push({ val: m, label });
    }
    this.frequencyOptions = options;
  }

  constructor() {
    this.generateFrequencyOptions();
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // 1-12

    // Set defaults to current date
    this.startMonth = currentMonth;
    this.startYear = currentYear;

    // Generate years from 1949 to Current + 70
    for (let i = 1949; i <= currentYear + 70; i++) {
      this.years.push(i);
    }
    this.calculate();
  }

  get endYear(): number {
    return this.startYear + this.durationYears;
  }

  updateDuration() {
    this.generateFrequencyOptions();
    this.calculate();
  }

  validateInputs() {
    if (this.startAmount > 12500) {
      this.startAmount = 12500;
    }
    if (this.startAmount === null || this.startAmount === undefined || this.startAmount === 0) {
      this.startAmount = 500;
    }
  }

  onAmountInput(event: any) {
    const val = event.target.value;
    const num = parseFloat(val);

    if (num > 12500) {
      this.startAmount = 12500;
      event.target.value = 12500;
    } else if (val === '' || num === 0) {
      this.startAmount = 500;
      event.target.value = 500;
    } else {
      this.startAmount = num;
    }
    this.calculate();
  }

  onBlur() {
    if (!this.startAmount || this.startAmount < 500) {
      this.startAmount = 500;
    }
    if (this.startAmount > 12500) {
      this.startAmount = 12500;
    }
    this.calculate();
  }

  get currentPpfRate() {
    return this.ppfService.PPF_RATE;
  }

  toggleMobileSidebar() {
    this.isMobileSidebarOpen.update(v => !v);
  }

  toggleDesktopSidebar() {
    this.isDesktopSidebarOpen.update(v => !v);
  }

  toggleComparison() {
    this.isComparisonOpen.update(v => !v);
  }



  calculate() {
    this.validateInputs();

    // Always fetch monthly data to build the accordion structure
    const rawData = this.ppfService.calculateDetailedBreakdown(
      this.startAmount,
      this.startMonth,
      this.startYear,
      this.durationYears,
      this.stepUpPercent,
      this.stepUpFrequencyMonths,
      'monthly'
    );

    // Group by Year Index
    const grouped: { [key: number]: PpfYearlyBreakdown[] } = {};
    rawData.forEach(record => {
      if (!grouped[record.yearIndex]) grouped[record.yearIndex] = [];
      grouped[record.yearIndex].push(record);
    });

    this.masterTable = Object.values(grouped).map((monthRecords, index) => {
      const lastRecord = monthRecords[monthRecords.length - 1];

      // Calculate Previous Year's Cumulative values to derive "Year Period" totals
      let prevCumDep = 0;
      let prevCumInt = 0;

      // Use the rawData array to find the record immediately preceding this year's block
      const firstRecordIndex = rawData.indexOf(monthRecords[0]);
      if (firstRecordIndex > 0) {
        prevCumDep = rawData[firstRecordIndex - 1].cumulativeDeposit;
        prevCumInt = rawData[firstRecordIndex - 1].cumulativeInterest;
      }

      // Create Summary Record
      const summaryRecord: PpfYearlyBreakdown = {
        ...lastRecord,
        periodLabel: `Year ${lastRecord.yearIndex}`,
        // Use the difference in Cumulative Deposit to get EXACT deposit for this year
        totalPeriodDeposit: lastRecord.cumulativeDeposit - prevCumDep,
        // Use difference in Cumulative Interest to get EXACT interest earned this year
        interestEarned: lastRecord.cumulativeInterest - prevCumInt,
        // closingBalance is naturally the closing balance of the year (last record)
      };

      return {
        summary: summaryRecord,
        months: monthRecords,
        isOpen: this.isMonthlyView() // Default state matches view mode
      };
    });

    // Update Totals
    if (this.masterTable.length > 0) {
      const finalGroup = this.masterTable[this.masterTable.length - 1];
      this.totalInvested = finalGroup.summary.cumulativeDeposit;
      this.totalInterest = finalGroup.summary.cumulativeInterest;
      this.finalMaturity = finalGroup.summary.closingBalance;
    } else {
      this.totalInvested = 0;
      this.totalInterest = 0;
      this.finalMaturity = 0;
    }

    // Comparison Table
    this.comparisonTable = [1, 2, 3, 4, 5, 8, 10, 12, 15, 18, 21, 25].map(p => {
      const rows = this.ppfService.calculateDetailedBreakdown(
        this.startAmount,
        this.startMonth,
        this.startYear,
        this.durationYears,
        p,
        this.stepUpFrequencyMonths,
        'yearly'
      );
      const maturity = rows.length > 0 ? rows[rows.length - 1].closingBalance : 0;
      return { percent: p, maturity: maturity };
    });
  }

  toggleViewMode() {
    this.isMonthlyView.update(v => !v);
    const newState = this.isMonthlyView();
    if (this.masterTable) {
      this.masterTable.forEach(g => g.isOpen = newState);
    }
  }

  toggleAccordion(index: number) {
    if (this.masterTable && this.masterTable[index]) {
      this.masterTable[index].isOpen = !this.masterTable[index].isOpen;
    }
  }

  openPrintPreview() {
    const monthName = this.months.find(m => m.val == this.startMonth)?.name || 'Apr';
    // Flatten grouped data for print (or send as is if print handles it? Assuming print expects flat)
    const flatData = this.masterTable.flatMap(g => g.months);

    this.printDataService.setData({
      masterTable: flatData,
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
    const flatData = this.masterTable.flatMap(g => g.months);

    this.exportService.exportToExcel(
      flatData,
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
