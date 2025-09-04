// Renders hidden elements with classes used by streamed markdown/HTML so Tailwind generates them.
export function TailwindClassSafelist() {
  return (
    <div className="hidden">
      {/* Headings */}
      <div className="mt-6 mb-2 font-semibold text-3xl" />
      <div className="mt-5 mb-2 font-semibold text-2xl" />
      <div className="mt-4 mb-2 font-semibold text-xl" />
      {/* Paragraph spacing */}
      <div className="mt-3 mb-3 leading-relaxed" />
      {/* Lists */}
      <ul className="list-disc pl-6 space-y-2" />
      <ol className="list-decimal pl-6 space-y-2" />
      {/* Inline styles */}
      <span className="italic underline font-bold" />
      {/* Tables (just in case) */}
      <table className="w-full text-sm">
        <thead className="font-semibold">
          <tr><th className="text-left">Heading</th></tr>
        </thead>
        <tbody className="divide-y">
          <tr><td className="py-2">Cell</td></tr>
        </tbody>
      </table>
      {/* Code blocks */}
      <pre className="rounded-md bg-muted p-4 text-sm overflow-x-auto" />
      <code className="font-mono text-xs" />
    </div>
  );
}
