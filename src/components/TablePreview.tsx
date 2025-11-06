'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';

type Table = string[][];

interface TablePreviewProps {
    tables: Table[];
}

export default function TablePreview({ tables }: TablePreviewProps) {
    const [selectedTables, setSelectedTables] = useState<number[]>([]);

    const handleCheckboxChange = (index: number) => {
        setSelectedTables(prev =>
            prev.includes(index)
                ? prev.filter(i => i !== index)
                : [...prev, index]
        );
    };

    const handleExport = () => {
        if (selectedTables.length === 0) {
            alert('Please select at least one table to export.');
            return;
        }

        const workbook = XLSX.utils.book_new();
        selectedTables.sort((a, b) => a - b).forEach(index => {
            const table = tables[index];
            const worksheet = XLSX.utils.aoa_to_sheet(table);
            XLSX.utils.book_append_sheet(workbook, worksheet, `Table ${index + 1}`);
        });

        XLSX.writeFile(workbook, 'tables.xlsx');
    };

    return (
        <div>
            <h2>Extracted Tables</h2>
            <button onClick={handleExport} disabled={selectedTables.length === 0}>
                Export Selected to Excel
            </button>
            <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #ccc', marginTop: '10px' }}>
                {tables.map((table, index) => (
                    <div key={index} style={{ marginBottom: '20px' }}>
                        <input
                            type="checkbox"
                            checked={selectedTables.includes(index)}
                            onChange={() => handleCheckboxChange(index)}
                        />
                        <strong>Table {index + 1}</strong>
                        <table border={1} style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <tbody>
                                {table.map((row, rowIndex) => (
                                    <tr key={rowIndex}>
                                        {row.map((cell, cellIndex) => (
                                            <td key={cellIndex} style={{ padding: '5px', border: '1px solid #ddd' }}>
                                                {cell}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))}
            </div>
        </div>
    );
}
