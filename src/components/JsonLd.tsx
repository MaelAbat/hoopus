/**
 * Renders a JSON-LD structured-data block. Server component — the script is
 * emitted as static HTML so search engines can read it without executing JS.
 */
export default function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // Structured data is trusted, server-built content — not user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
