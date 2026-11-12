import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
export default function DocumentContent({ content }) {
  return (
    <div className="document-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          img: () => null,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
