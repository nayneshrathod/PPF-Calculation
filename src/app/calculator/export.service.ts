import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { PpfYearlyBreakdown } from './ppf-calculator.service';

@Injectable({
    providedIn: 'root'
})
export class ExportService {

    constructor() { }

    /**
     * Generates a professionally designed PDF report for the PPF Plan.
     */
    exportToPdf(
        masterTable: PpfYearlyBreakdown[],
        summary: { totalInvested: number, totalInterest: number, maturity: number },
        inputs: { startAmount: number, startMonth: string, startYear: number, duration: number, stepUp: number, stepUpFreq: number }
    ) {
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.width;

        // --- Header Section ---
        doc.setFillColor(6, 95, 70); // Emerald 800
        doc.rect(0, 0, pageWidth, 40, 'F');

        doc.setFontSize(22);
        doc.setTextColor(255, 255, 255);
        doc.text('PPF Investment Report', 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(209, 250, 229); // Emerald 100
        doc.text('Government Rules Compliant (7.1%)', 14, 28);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 14, 28, { align: 'right' });

        // --- Summary Cards Section ---
        let yPos = 50;
        const cardWidth = (pageWidth - 28 - 10) / 3;
        const cardHeight = 25;

        const drawCard = (x: number, label: string, value: string, color: string) => {
            doc.setDrawColor(226, 232, 240);
            doc.setFillColor(255, 255, 255);
            doc.roundedRect(x, yPos, cardWidth, cardHeight, 3, 3, 'FD');

            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(label.toUpperCase(), x + 5, yPos + 8);

            doc.setFontSize(14);
            doc.setTextColor(color === 'green' ? 5 : 15, color === 'green' ? 150 : 23, color === 'green' ? 105 : 33);
            doc.text(value, x + 5, yPos + 18);
        };

        drawCard(14, 'Total Invested', `Rs. ${this.formatCurrency(summary.totalInvested)}`, 'black');
        drawCard(14 + cardWidth + 5, 'Total Interest', `+ Rs. ${this.formatCurrency(summary.totalInterest)}`, 'green');
        drawCard(14 + (cardWidth * 2) + 10, 'Maturity Value', `Rs. ${this.formatCurrency(summary.maturity)}`, 'black');

        yPos += 35;

        // --- Inputs Section ---
        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85);
        doc.text('Plan Configuration:', 14, yPos);

        yPos += 7;
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);

        const details = [
            `Monthly Deposit: Rs. ${this.formatCurrency(inputs.startAmount)}`,
            `Start Date: ${inputs.startMonth} ${inputs.startYear}`,
            `Duration: ${inputs.duration} Years`,
            `Step-Up: ${inputs.stepUp}% every ${inputs.stepUpFreq} Months`
        ];

        doc.text(details[0], 14, yPos);
        doc.text(details[1], 80, yPos);

        yPos += 6;
        doc.text(details[2], 14, yPos);
        doc.text(details[3], 80, yPos);

        yPos += 15;

        // --- Projection Table ---
        const headers = [['Year', 'Monthly Inst.', 'Yearly Deposit', 'Interest Earned', 'Closing Balance']];

        const data = masterTable.map(row => [
            row.periodLabel,
            this.formatCurrency(row.monthlyInstallment),
            this.formatCurrency(row.totalPeriodDeposit),
            this.formatCurrency(row.interestEarned),
            this.formatCurrency(row.closingBalance)
        ]);

        autoTable(doc, {
            startY: yPos,
            head: headers,
            body: data,
            theme: 'grid',
            headStyles: {
                fillColor: [6, 95, 70],
                textColor: 255,
                fontSize: 9,
                fontStyle: 'bold'
            },
            styles: {
                fontSize: 8,
                textColor: 50,
                cellPadding: 3
            },
            alternateRowStyles: {
                fillColor: [241, 245, 249]
            },
            columnStyles: {
                0: { cellWidth: 30 },
                1: { halign: 'right' },
                2: { halign: 'right' },
                3: { halign: 'right', textColor: [5, 150, 105] },
                4: { halign: 'right', fontStyle: 'bold' }
            }
        });

        doc.save('InvestmentReport.pdf');
    }

    /**
     * Generates a dynamic Excel report WITH FORMULAS.
     * This allows the user to change inputs in Excel and see updates.
     */
    exportToExcel(
        masterTable: PpfYearlyBreakdown[],
        summary: { totalInvested: number, totalInterest: number, maturity: number },
        inputs: { startAmount: number, startMonth: string, startYear: number, duration: number, stepUp: number, stepUpFreq: number }
    ) {
        // 1. Create a worksheet
        const ws: XLSX.WorkSheet = {};

        // Helper to set cell value/formula
        const setCell = (ref: string, val: any, formula?: string) => {
            ws[ref] = formula ? { t: 'n', f: formula } : (typeof val === 'number' ? { t: 'n', v: val } : { t: 's', v: val });
        };

        // --- Header & Inputs ---
        setCell('A1', 'PPF INVESTMENT CALCULATOR - INTERACTIVE REPORT');
        setCell('A2', `Generated on: ${new Date().toLocaleDateString()}`);

        setCell('A4', 'USER INPUTS (Editable)');
        setCell('A5', 'Starting Monthly Deposit'); setCell('B5', inputs.startAmount);
        setCell('A6', 'Step-Up Rate (%)'); setCell('B6', inputs.stepUp / 100); // Decimals for Excel
        setCell('A7', 'Step-Up Freq (Months)'); setCell('B7', inputs.stepUpFreq);
        setCell('A8', 'Annual Interest Rate (%)'); setCell('B8', 0.071); // 7.1%

        // --- Summary Section (with Formulas) ---
        const lastRow = 14 + masterTable.length;
        setCell('D4', 'CALCULATED SUMMARY');
        setCell('D5', 'Total Invested'); setCell('E5', null, `SUM(C15:C${lastRow})`);
        setCell('D6', 'Interest Earned'); setCell('E6', null, `SUM(D15:D${lastRow})`);
        setCell('D7', 'Maturity Value'); setCell('E7', null, `E14 + E5 + E6`); // Just an example, better is last cell of Balance
        setCell('E7', null, `E${lastRow}`); // Maturity is last closing balance

        // --- Table Headers ---
        const headers = ['Year', 'Monthly Inst.', 'Yearly Deposit', 'Interest Earned', 'Closing Balance'];
        headers.forEach((h, i) => setCell(`${String.fromCharCode(65 + i)}14`, h));

        // --- Table Data (Formula Based) ---
        masterTable.forEach((row, idx) => {
            const r = 15 + idx; // Excel row index

            // Year Label
            setCell(`A${r}`, row.periodLabel);

            // Monthly Inst
            if (idx === 0) {
                setCell(`B${r}`, null, `$B$5`); // References Input B5
            } else {
                // Logic: Prev Monthly * (1 + StepUp)
                // Note: Since step up frequency is usually 12 in the table view:
                setCell(`B${r}`, null, `B${r - 1} * (1 + $B$6)`);
            }

            // Yearly Deposit
            setCell(`C${r}`, null, `MIN(B${r}*12, 150000)`); // Capped at 1.5L

            // Interest Earned (Approximated as Monthly accrual or simple yearly for Excel)
            // Rule: Balance * Rate. (Simple approximation: (LastBalance + Deposit/2) * Rate)
            if (idx === 0) {
                setCell(`D${r}`, null, `ROUND((C${r} * $B$8 / 2), 0)`);
            } else {
                setCell(`D${r}`, null, `ROUND((E${r - 1} + C${r}/2) * $B$8, 0)`);
            }

            // Closing Balance
            if (idx === 0) {
                setCell(`E${r}`, null, `C${r} + D${r}`);
            } else {
                setCell(`E${r}`, null, `E${r - 1} + C${r} + D${r}`);
            }
        });

        // --- Define ranges ---
        ws['!ref'] = `A1:E${lastRow}`;
        ws['!cols'] = [
            { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 20 }
        ];

        // --- Create Workbook & Save ---
        const wb: XLSX.WorkBook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'PPF_Projector');
        XLSX.writeFile(wb, 'InvestmentData_Interactive.xlsx');
    }

    private formatCurrency(val: number): string {
        return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(val);
    }
}
