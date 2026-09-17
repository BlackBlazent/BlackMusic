import type { ReactNode } from "react";
import "./PagePlaceholder.css";

interface PagePlaceholderProps {
  title: string;
  purpose: string;
  upNext: string[];
  children?: ReactNode;
}

export function PagePlaceholder({ title, purpose, upNext, children }: PagePlaceholderProps) {
  return (
    <div className="page-placeholder">
      <div className="page-placeholder__intro">
        <h1>{title}</h1>
        <p>{purpose}</p>
      </div>

      {children}

      <div className="page-placeholder__upnext">
        <h2>Up next on this page</h2>
        <ul>
          {upNext.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
