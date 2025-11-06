# Note Generator

Note Generator is a web application that leverages AI to generate well-structured, lecture-style notes from various sources, including spreadsheets and user prompts. It is designed to align with Nigerian teaching and note-writing standards, making it an ideal tool for educators and students.

## Features

- **AI-Powered Note Generation:** Utilizes AI to create detailed and engaging lecture notes.
- **Multiple Input Sources:** Generate notes from uploaded spreadsheets (.xls, .xlsx, .csv) or direct text input.
- **Customizable Generation:**
    - **Standard Mode:** Select a specific column from a spreadsheet to generate notes.
    - **Custom Mode:** Configure a scheme of work by selecting topics for each week.
- **Class Level Selection:** Tailor the generated content to various educational levels, from Kindergarten to Senior Secondary.
- **PDF Table Extraction:** Upload a PDF file to extract tables and export them to an Excel file.
- **Export Options:**
    - Export generated notes as a DOCX file.
    - Export generated notes as a PDF file.
- **Responsive Design:** A user-friendly interface that works on both desktop and mobile devices.

## Technologies Used

- **Frontend:**
    - [Next.js](https://nextjs.org/) - React framework for building user interfaces.
    - [React](https://reactjs.org/) - A JavaScript library for building user interfaces.
    - [Tailwind CSS](https://tailwindcss.com/) - A utility-first CSS framework.
    - [shadcn/ui](https://ui.shadcn.com/) - A collection of re-usable UI components.
- **Backend:**
    - [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction) - Server-side logic for handling API requests.
    - [AI SDK](https://sdk.vercel.ai/) - A library for building AI-powered applications.
    - [Google Generative AI](https://ai.google/) - The AI model used for note generation.
- **Document Processing:**
    - [XLSX](https://github.com/SheetJS/sheetjs) - A library for reading and writing spreadsheets.
    - [pdfjs-dist](https://github.com/mozilla/pdf.js) - A library for parsing PDF files.
    - [html-to-docx](https://github.com/private-components/html-to-docx) - A library for converting HTML to DOCX.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20 or later)
- [Yarn](https://yarnpkg.com/) (or npm)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/note-generator.git
   ```
2. Navigate to the project directory:
   ```bash
   cd note-generator
   ```
3. Install the dependencies:
   ```bash
   yarn install
   ```

### Running the Application

1. Start the development server:
   ```bash
   yarn dev
   ```
2. Open your browser and navigate to `http://localhost:3000`.

## Usage

1. **Upload a File:**
   - Click on the "Upload Spreadsheet" button to upload an Excel or CSV file.
   - Alternatively, you can drag and drop a file into the designated area.
2. **Select Class Level:**
   - Choose the appropriate class level from the dropdown menu.
3. **Choose Generation Mode:**
   - **Standard Mode:** Select the column from your spreadsheet that contains the topics for note generation.
   - **Custom Mode:** Click on "Configure Scheme" to open a modal where you can select topics for each week.
4. **Generate Notes:**
   - Click the "Generate Notes" button to start the note generation process.
5. **Export Notes:**
   - Once the notes are generated, you can export them as a DOCX or PDF file.
