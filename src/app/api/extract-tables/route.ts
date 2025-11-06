import { NextRequest, NextResponse } from 'next/server';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { TextItem } from 'pdfjs-dist/types/src/display/api';
import path from 'path';

// Set the workerSrc to avoid issues with server-side rendering
pdfjs.GlobalWorkerOptions.workerSrc = path.resolve('./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');

// Define the type for our extracted table data
type Table = string[][];

// Helper function to detect tables from text
const detectTables = (text: string): Table[] => {
    const lines = text.split('\n');
    const tables: Table[] = [];
    let currentTable: Table = [];
    let inTable = false;

    // A simple heuristic to detect tables: look for lines with multiple words separated by 2+ spaces
    const tableRowRegex = /(.+?)\s{2,}(.+)/;

    for (const line of lines) {
        if (tableRowRegex.test(line)) {
            if (!inTable) {
                inTable = true;
            }
            // Split row by multiple spaces
            const row = line.split(/\s{2,}/).map(cell => cell.trim());
            currentTable.push(row);
        } else {
            if (inTable) {
                // End of the current table
                if (currentTable.length > 1) { // Only consider tables with more than one row
                    tables.push(currentTable);
                }
                currentTable = [];
                inTable = false;
            }
        }
    }

    // Add the last table if the document ends while in a table
    if (inTable && currentTable.length > 1) {
        tables.push(currentTable);
    }

    return tables;
};

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
        }

        const fileBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(fileBuffer);

        const loadingTask = pdfjs.getDocument(uint8Array);
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;
        let allTables: Table[] = [];

        for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => (item as TextItem).str).join('\n');
            
            const tablesOnPage = detectTables(pageText);
            if (tablesOnPage.length > 0) {
                allTables = allTables.concat(tablesOnPage);
            }
        }

        return NextResponse.json({ tables: allTables });

    } catch (error) {
        console.error('Error processing PDF:', error);
        return NextResponse.json({ error: 'Failed to process PDF.' }, { status: 500 });
    }
}
