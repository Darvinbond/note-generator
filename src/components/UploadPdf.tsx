'use client';

import { useState, FormEvent } from 'react';
// Define the type for our extracted table data
type Table = string[][];

interface UploadPdfProps {
    onTablesExtracted: (tables: Table[]) => void;
}

export default function UploadPdf({ onTablesExtracted }: UploadPdfProps) {
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!file) {
            setError('Please select a file to upload.');
            return;
        }

        setIsLoading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/extract-tables', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Failed to extract tables.');
            }

            const data = await response.json();
            onTablesExtracted(data.tables);
        } catch (error) {
            if (error instanceof Error) {
                setError(error.message);
            } else {
                setError('An unknown error occurred.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            <form onSubmit={handleSubmit}>
                <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                />
                <button type="submit" disabled={isLoading}>
                    {isLoading ? 'Processing...' : 'Extract Tables'}
                </button>
            </form>
            {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
    );
}
