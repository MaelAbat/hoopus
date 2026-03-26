import ReactMarkdown from "react-markdown";

export default function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children }) => (
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary mt-10 mb-4 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xl sm:text-2xl font-bold text-text-primary mt-8 mb-3 border-b border-border-t pb-2">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-lg font-bold text-text-primary mt-6 mb-2">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="text-base leading-relaxed text-text-secondary mb-4">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-bold text-text-primary">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-text-secondary">{children}</em>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-accent/40 pl-4 sm:pl-6 my-6 py-1 text-text-secondary italic bg-accent/5 rounded-r-lg pr-4">
            {children}
          </blockquote>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-outside pl-6 mb-4 space-y-1.5 text-text-secondary">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-outside pl-6 mb-4 space-y-1.5 text-text-secondary">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-base leading-relaxed">{children}</li>
        ),
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent font-medium underline decoration-accent/30 underline-offset-2 hover:decoration-accent transition-colors">
            {children}
          </a>
        ),
        hr: () => (
          <hr className="my-8 border-border-t" />
        ),
        img: ({ src, alt }) => (
          <span className="block my-6">
            <img src={src} alt={alt || ""} className="w-full rounded-xl border border-border-t" />
            {alt && <span className="block mt-2 text-center text-xs text-text-faint">{alt}</span>}
          </span>
        ),
        code: ({ className, children }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return (
              <pre className="my-4 overflow-x-auto rounded-xl bg-input border border-border-t p-4">
                <code className="text-sm text-text-primary">{children}</code>
              </pre>
            );
          }
          return (
            <code className="rounded bg-input px-1.5 py-0.5 text-sm font-mono text-accent">{children}</code>
          );
        },
        pre: ({ children }) => <>{children}</>,
        table: ({ children }) => (
          <div className="my-6 overflow-x-auto rounded-xl border border-border-t">
            <table className="w-full text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-input text-text-muted">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="px-4 py-2.5 text-left font-semibold text-text-primary">{children}</th>
        ),
        td: ({ children }) => (
          <td className="px-4 py-2.5 border-t border-border-t text-text-secondary">{children}</td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
