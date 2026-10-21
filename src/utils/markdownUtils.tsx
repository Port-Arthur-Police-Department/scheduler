// src/utils/markdownUtils.tsx
import React from 'react';

export const renderMarkdown = (text: string) => {
  if (!text) return null;

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  let inUl = false;
  let inOl = false;
  let ulItems: React.ReactNode[] = [];
  let olItems: React.ReactNode[] = [];

  const parseInline = (str: string, keyPrefix: string): React.ReactNode => {
    const parts = str.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={`${keyPrefix}-b-${i}`} className="font-bold text-foreground">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={`${keyPrefix}-i-${i}`} className="italic">{part.slice(1, -1)}</em>;
      }
      return part;
    });
  };

  const flushLists = () => {
    if (inUl) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="list-disc pl-6 space-y-1 my-2">
          {ulItems}
        </ul>
      );
      ulItems = [];
      inUl = false;
    }
    if (inOl) {
      elements.push(
        <ol key={`ol-${elements.length}`} className="list-decimal pl-6 space-y-1 my-2">
          {olItems}
        </ol>
      );
      olItems = [];
      inOl = false;
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (trimmed.startsWith('### ')) {
      flushLists();
      elements.push(
        <h3 key={`h3-${index}`} className="text-lg font-bold text-foreground mt-4 mb-2">
          {parseInline(trimmed.slice(4), `h3-${index}`)}
        </h3>
      );
    } else if (trimmed.startsWith('- ')) {
      if (inOl) flushLists();
      inUl = true;
      ulItems.push(
        <li key={`li-${index}`}>
          {parseInline(trimmed.slice(2), `li-${index}`)}
        </li>
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      if (inUl) flushLists();
      inOl = true;
      const textWithoutNum = trimmed.replace(/^\d+\.\s/, '');
      olItems.push(
        <li key={`oli-${index}`}>
          {parseInline(textWithoutNum, `oli-${index}`)}
        </li>
      );
    } else {
      flushLists();
      if (trimmed === '') {
        elements.push(<div key={`space-${index}`} className="h-3" />);
      } else {
        elements.push(
          <p key={`p-${index}`} className="my-1.5 leading-relaxed">
            {parseInline(line, `p-${index}`)}
          </p>
        );
      }
    }
  });

  flushLists();
  return <div className="space-y-1">{elements}</div>;
};
