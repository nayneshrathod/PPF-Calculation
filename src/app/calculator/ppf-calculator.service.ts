import { Injectable } from '@angular/core';

export interface PpfCalculationResult {
    stepUpPercentage: number;
    totalInvested: number;
    maturityAmount: number;
    interestEarned: number;
    isMaxLimitReached: boolean; // Flag if any cap was applied
}

export interface PpfYearlyBreakdown {
    periodLabel: string; // e.g. "Year 1 (2026-27)" or "Month 1 (Apr 2026)"
    yearIndex: number; // For sorting/logic
    monthlyInstallment: number;
    totalPeriodDeposit: number;
    interestEarned: number;
    closingBalance: number;
    isCapped: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class PpfCalculatorService {

    private readonly PPF_RATE = 7.1;
    private readonly MAX_ANNUAL_DEPOSIT = 150000;
    private readonly MAX_MONTHLY_DEPOSIT = 12500; // 150000 / 12

    constructor() { }

    /**
     * STANDARD PPF RULE (Annual Compounding):
     * - Interest calculated monthly on min balance (approximated here as balance after deposit).
     * - Interest CREDITED ANNUALLY. This results in lower maturity matching benchmarks.
     */
    calculateDetailedBreakdown(
        startAmount: number,
        startMonth: number,
        startYear: number,
        durationYears: number,
        stepUpPercent: number,
        stepUpFreqMonths: number = 12
    ): PpfYearlyBreakdown[] {
        if (startAmount < 1) startAmount = 1;

        let currentMonthlyAmount = startAmount;
        if (currentMonthlyAmount > this.MAX_MONTHLY_DEPOSIT) currentMonthlyAmount = this.MAX_MONTHLY_DEPOSIT;

        let currentBalance = 0;
        const records: PpfYearlyBreakdown[] = [];

        // Trackers for interest (Credited annually in March)
        let totalInterestAccruedInYear = 0;
        let totalDepositInFY = 0;

        // Bucket for the current display period
        let periodDeposit = 0;
        let periodInterestToShow = 0;

        const totalMonths = durationYears * 12;

        for (let m = 0; m < totalMonths; m++) {
            const absoluteMonth = m + 1;

            // 1. Current Month Info
            const currentMonthObj = this.getMonthInfo(startMonth, startYear, m);

            // 2. Step Up (Every X months)
            if (stepUpPercent > 0 && m > 0 && m % stepUpFreqMonths === 0) {
                currentMonthlyAmount += (currentMonthlyAmount * stepUpPercent / 100);
                if (currentMonthlyAmount > this.MAX_MONTHLY_DEPOSIT) currentMonthlyAmount = this.MAX_MONTHLY_DEPOSIT;
            }

            // 3. Deposit logic with Financial Year Capping
            let deposit = currentMonthlyAmount;
            if (totalDepositInFY + deposit > this.MAX_ANNUAL_DEPOSIT) {
                deposit = Math.max(0, this.MAX_ANNUAL_DEPOSIT - totalDepositInFY);
            }

            currentBalance += deposit;
            totalDepositInFY += deposit;
            periodDeposit += deposit;

            // 4. Accrue interest (PPF Rule: Monthly compounding, yearly credit)
            const monthlyInterest = (currentBalance * this.PPF_RATE) / 100 / 12;
            totalInterestAccruedInYear += monthlyInterest;
            periodInterestToShow += monthlyInterest;

            // 5. Check if it's the end of Financial Year (March)
            // Note: startMonth is 1-based.
            if (currentMonthObj.month === 3) {
                currentBalance += totalInterestAccruedInYear;
                totalInterestAccruedInYear = 0;
                totalDepositInFY = 0;
            }

            // 6. Push period record
            if (absoluteMonth % stepUpFreqMonths === 0 || m === totalMonths - 1) {
                records.push({
                    periodLabel: this.formatPeriodLabel(absoluteMonth, startMonth, startYear, stepUpFreqMonths),
                    yearIndex: Math.ceil(absoluteMonth / 12),
                    monthlyInstallment: Math.round(currentMonthlyAmount),
                    totalPeriodDeposit: Math.round(periodDeposit),
                    interestEarned: Math.round(periodInterestToShow),
                    closingBalance: Math.round(currentBalance),
                    isCapped: currentMonthlyAmount >= (this.MAX_MONTHLY_DEPOSIT - 1)
                });
                periodDeposit = 0;
                periodInterestToShow = 0;
            }
        }

        console.log(`[PPF Service] Generated ${records.length} records for ${durationYears} years with ${stepUpFreqMonths}-month frequency`);
        if (records.length > 0) {
            console.log('[PPF Service] First record:', records[0]);
            console.log('[PPF Service] Last record:', records[records.length - 1]);
        }
        return records;
    }

    private getMonthInfo(startMonth: number, startYear: number, monthsToAdd: number) {
        let m = startMonth + monthsToAdd;
        let y = startYear + Math.floor((m - 1) / 12);
        m = ((m - 1) % 12) + 1;
        return { month: m, year: y };
    }

    private formatPeriodLabel(absoluteMonth: number, startMonth: number, startYear: number, interval: number): string {
        const info = this.getMonthInfo(startMonth, startYear, absoluteMonth - 1);
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        if (interval >= 12 && interval % 12 === 0) {
            const yearNum = absoluteMonth / 12;
            const fyStart = startYear + yearNum - 1;
            const fyEnd = (fyStart + 1) % 100;
            return `Year ${yearNum} (${fyStart}-${fyEnd < 10 ? '0' + fyEnd : fyEnd})`;
        }

        return `Month ${absoluteMonth} (${monthNames[info.month - 1]} ${info.year})`;
    }

    /**
     * Generates a breakdown based on 'Investment Years' with Monthly Compounding.
     * matches generic investment calculators (User Benchmark).
     */
    calculateClassicBreakdown(
        startAmount: number,
        durationYears: number,
        stepUpPercent: number,
        stepUpFreqMonths: number = 12
    ): PpfYearlyBreakdown[] {

        // Safety check
        if (startAmount < 1) startAmount = 1;

        // Buckets
        const yearlyRecords: PpfYearlyBreakdown[] = [];

        let currentBalance = 0;
        let currentMonthlyAmount = startAmount;

        // Check initial cap
        if (currentMonthlyAmount > this.MAX_MONTHLY_DEPOSIT) currentMonthlyAmount = this.MAX_MONTHLY_DEPOSIT;

        // Trackers for the current "Year" (1-12 bucket)
        let yearDeposit = 0;
        let yearInterest = 0;

        const totalMonths = durationYears * 12;

        for (let m = 0; m < totalMonths; m++) {
            const monthIndex = m + 1; // 1-based total index

            // Step Up Application
            // Increase after 'freq' months.
            if (stepUpPercent > 0 && m > 0 && m % stepUpFreqMonths === 0) {
                const increase = currentMonthlyAmount * (stepUpPercent / 100);
                currentMonthlyAmount += increase;

                // Cap
                if (currentMonthlyAmount > this.MAX_MONTHLY_DEPOSIT) {
                    currentMonthlyAmount = this.MAX_MONTHLY_DEPOSIT;
                }
            }

            // 1. Deposit
            let deposit = currentMonthlyAmount;
            // In this mode, we enforce Annual Limit loosely as 1.5L per Investment Year?
            // Or just enforce Monthly Cap * 12. 
            // User benchmark showed "Yearly Deposit 12,000" for 1000/mo.
            // We'll stick to monthly cap logic mostly.

            // Check Year Cap
            if (yearDeposit + deposit > this.MAX_ANNUAL_DEPOSIT) {
                deposit = this.MAX_ANNUAL_DEPOSIT - yearDeposit;
                if (deposit < 0) deposit = 0;
            }

            currentBalance += deposit;
            yearDeposit += deposit;

            // 2. Interest (Monthly Compounding for Benchmark Matching)
            // Interest = Balance * (7.1%) / 12
            const interest = (currentBalance * this.PPF_RATE) / 100 / 12;

            // Add IMMEDIATELY to balance (Monthly Compounding)
            currentBalance += interest;
            yearInterest += interest;

            // 3. Year End (Every 12 months)
            if (monthIndex % 12 === 0) {
                const yearNum = monthIndex / 12;
                // For classic breakdown, we don't have startYear easily, 
                // but we can assume the same logic if we pass it or just use Year X.
                // However, to keep it consistent, let's assume we want the range if possible.
                // I'll add a startYear parameter to this method too.
                const fyStart = (arguments[4] || 2026) + yearNum - 1;
                const fyEnd = (fyStart + 1) % 100;
                const fyString = `${fyStart}-${fyEnd < 10 ? '0' + fyEnd : fyEnd}`;

                yearlyRecords.push({
                    periodLabel: `Year ${yearNum}`,
                    yearIndex: yearNum,
                    monthlyInstallment: Math.round(currentMonthlyAmount),
                    totalPeriodDeposit: Math.round(yearDeposit),
                    interestEarned: Math.round(yearInterest),
                    closingBalance: Math.round(currentBalance),
                    isCapped: currentMonthlyAmount >= (this.MAX_MONTHLY_DEPOSIT - 1)
                });

                // Reset Year Buckets
                yearDeposit = 0;
                yearInterest = 0;
            }
        }

        return yearlyRecords;
    }
}
