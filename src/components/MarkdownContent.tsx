import ReactMarkdown from "react-markdown";

export default function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children }) => (
          <h1 className="font-display text-3xl sm:text-4xl text-text-primary mt-10 mb-4 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="font-display text-2xl sm:text-3xl text-text-primary mt-8 mb-3 border-b border-rule pb-2">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="font-display text-xl sm:text-2xl text-text-primary mt-6 mb-2">{children}</h3>
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
          <blockquote className="border-l-4 border-accent pl-4 sm:pl-6 my-6 py-1 pr-4 text-text-secondary italic bg-accent-light">
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
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent-text font-medium underline decoration-accent/40 underline-offset-2 hover:decoration-accent transition-colors">
            {children}
          </a>
        ),
        hr: () => (
          <hr className="my-8 border-rule" />
        ),
        img: ({ src, alt }) => (
          <span className="block my-6">
            <img src={src} alt={alt || ""} className="w-full border border-rule grayscale" />
            {alt && <span className="block mt-2 text-center font-mono text-[11px] uppercase tracking-wider text-text-faint">{alt}</span>}
          </span>
        ),
        code: ({ className, children }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return (
              <pre className="my-4 overflow-x-auto bg-input border border-rule p-4">
                <code className="text-sm text-text-primary">{children}</code>
              </pre>
            );
          }
          return (
            <code className="bg-input px-1.5 py-0.5 text-sm font-mono text-accent-text">{children}</code>
          );
        },
        pre: ({ children }) => <>{children}</>,
        table: ({ children }) => (
          <div className="my-6 overflow-x-auto border border-rule">
            <table className="w-full text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-input">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="kicker px-4 py-2.5 text-left text-text-faint">{children}</th>
        ),
        td: ({ children }) => (
          <td className="px-4 py-2.5 border-t border-rule text-text-secondary">{children}</td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
