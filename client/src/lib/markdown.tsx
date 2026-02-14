import type React from "react";

export function parseInlineMarkdown(text: string, keyPrefix: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  // Match **bold**, *italic*, and `code`
  const inlineRegex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = inlineRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // **bold**
      result.push(<strong key={`${keyPrefix}-b-${match.index}`}>{match[2]}</strong>);
    } else if (match[3]) {
      // *italic*
      result.push(<em key={`${keyPrefix}-i-${match.index}`}>{match[3]}</em>);
    } else if (match[4]) {
      // `code`
      result.push(
        <code key={`${keyPrefix}-c-${match.index}`} className="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono">
          {match[4]}
        </code>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result;
}

export function renderMarkdown(text: string, onInternalNav?: (path: string) => void): React.ReactNode[] {
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)|https?:\/\/[^\s]+|\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=-]+/g;

  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      const ListTag = listType === "ol" ? "ol" : "ul";
      result.push(
        <ListTag key={`list-${result.length}`} className={`${listType === "ol" ? "list-decimal" : "list-disc"} ml-4 my-1 space-y-0.5`}>
          {listItems}
        </ListTag>
      );
      listItems = [];
      listType = null;
    }
  };

  lines.forEach((line, lineIdx) => {
    // Check for list items - ONLY match lines that start with list markers
    const ulMatch = line.match(/^[\s]*[-*]\s+(.+)$/);
    const olMatch = line.match(/^[\s]*\d+\.\s+(.+)$/);

    if (ulMatch) {
      if (listType !== "ul") {
        flushList();
        listType = "ul";
      }
      listItems.push(<li key={`li-${lineIdx}`}>{processLine(ulMatch[1], lineIdx)}</li>);
      return;
    }

    if (olMatch) {
      if (listType !== "ol") {
        flushList();
        listType = "ol";
      }
      listItems.push(<li key={`li-${lineIdx}`} value={parseInt(line.match(/^[\s]*(\d+)/)![1])}>{processLine(olMatch[1], lineIdx)}</li>);
      return;
    }

    // Not a list item, flush any pending list
    flushList();

    // Process regular line
    const processedLine = processLine(line, lineIdx);
    result.push(...(Array.isArray(processedLine) ? processedLine : [processedLine]));

    if (lineIdx < lines.length - 1) {
      result.push(<br key={`br-${lineIdx}`} />);
    }
  });

  flushList();
  return result;

  function processLine(line: string, lineIdx: number): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    // Reset regex
    linkRegex.lastIndex = 0;

    while ((match = linkRegex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        const textBefore = line.slice(lastIndex, match.index);
        parts.push(...parseInlineMarkdown(textBefore, `${lineIdx}-${lastIndex}`));
      }

      const url = match[2] || match[0];
      const label = match[1] || match[0];

      const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        const targetUrl = (() => {
          try {
            return new URL(url, window.location.origin);
          } catch {
            return null;
          }
        })();

        const isInternal =
          !!targetUrl && targetUrl.origin === window.location.origin && targetUrl.pathname.startsWith("/");

        if (isInternal && onInternalNav) {
          onInternalNav(`${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`);
          return;
        }

        window.open(url, "_blank", "noopener");
      };

      parts.push(
        <a
          key={`${url}-${match.index}`}
          href={url}
          onClick={handleClick}
          rel="noopener noreferrer"
          className="text-blue-600 underline underline-offset-2"
        >
          {label}
        </a>
      );

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < line.length) {
      const textAfter = line.slice(lastIndex);
      parts.push(...parseInlineMarkdown(textAfter, `${lineIdx}-${lastIndex}`));
    }

    return parts;
  }
}

/**
 * Converts Markdown text to HTML string
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';
  
  const lines = markdown.split('\n');
  const htmlLines: string[] = [];
  let inList = false;
  let listType: 'ul' | 'ol' | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Empty line
    if (!trimmed) {
      if (inList) {
        htmlLines.push(listType === 'ol' ? '</ol>' : '</ul>');
        inList = false;
        listType = null;
      }
      htmlLines.push('<br>');
      continue;
    }
    
    // Headings
    const h1Match = trimmed.match(/^#\s+(.+)$/);
    const h2Match = trimmed.match(/^##\s+(.+)$/);
    const h3Match = trimmed.match(/^###\s+(.+)$/);
    const h4Match = trimmed.match(/^####\s+(.+)$/);
    
    if (h1Match) {
      if (inList) {
        htmlLines.push(listType === 'ol' ? '</ol>' : '</ul>');
        inList = false;
        listType = null;
      }
      htmlLines.push(`<h1>${processInlineMarkdown(h1Match[1])}</h1>`);
      continue;
    }
    if (h2Match) {
      if (inList) {
        htmlLines.push(listType === 'ol' ? '</ol>' : '</ul>');
        inList = false;
        listType = null;
      }
      htmlLines.push(`<h2>${processInlineMarkdown(h2Match[1])}</h2>`);
      continue;
    }
    if (h3Match) {
      if (inList) {
        htmlLines.push(listType === 'ol' ? '</ol>' : '</ul>');
        inList = false;
        listType = null;
      }
      htmlLines.push(`<h3>${processInlineMarkdown(h3Match[1])}</h3>`);
      continue;
    }
    if (h4Match) {
      if (inList) {
        htmlLines.push(listType === 'ol' ? '</ol>' : '</ul>');
        inList = false;
        listType = null;
      }
      htmlLines.push(`<h4>${processInlineMarkdown(h4Match[1])}</h4>`);
      continue;
    }
    
    // Unordered list
    const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        if (inList && listType === 'ol') {
          htmlLines.push('</ol>');
        }
        if (!inList) {
          htmlLines.push('<ul>');
        } else {
          htmlLines.push('</ol><ul>');
        }
        inList = true;
        listType = 'ul';
      }
      htmlLines.push(`<li>${processInlineMarkdown(ulMatch[1])}</li>`);
      continue;
    }
    
    // Ordered list
    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        if (inList && listType === 'ul') {
          htmlLines.push('</ul>');
        }
        if (!inList) {
          htmlLines.push('<ol>');
        } else {
          htmlLines.push('</ul><ol>');
        }
        inList = true;
        listType = 'ol';
      }
      htmlLines.push(`<li>${processInlineMarkdown(olMatch[1])}</li>`);
      continue;
    }
    
    // Regular paragraph
    if (inList) {
      htmlLines.push(listType === 'ol' ? '</ol>' : '</ul>');
      inList = false;
      listType = null;
    }
    htmlLines.push(`<p>${processInlineMarkdown(trimmed)}</p>`);
  }
  
  // Close any open lists
  if (inList) {
    htmlLines.push(listType === 'ol' ? '</ol>' : '</ul>');
  }
  
  return htmlLines.join('');
}

/**
 * Process inline markdown formatting (bold, italic, code, links)
 */
function processInlineMarkdown(text: string): string {
  // Links [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  
  // Bold **text** or __text__
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
  
  // Italic *text* or _text_
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  text = text.replace(/_(.+?)_/g, '<em>$1</em>');
  
  // Code `text`
  text = text.replace(/`(.+?)`/g, '<code>$1</code>');
  
  return text;
}

/**
 * Converts HTML to simplified Markdown
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  
  let markdown = html;
  
  // Remove empty tags
  markdown = markdown.replace(/<(p|div|span)[^>]*>\s*<\/(p|div|span)>/gi, '');
  
  // Headings
  markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
  markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
  markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');
  
  // Bold
  markdown = markdown.replace(/<(strong|b)[^>]*>(.*?)<\/(strong|b)>/gi, '**$2**');
  
  // Italic
  markdown = markdown.replace(/<(em|i)[^>]*>(.*?)<\/(em|i)>/gi, '*$2*');
  
  // Code
  markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
  
  // Links
  markdown = markdown.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)');
  
  // Lists
  markdown = markdown.replace(/<ul[^>]*>(.*?)<\/ul>/gis, (match, content) => {
    const items = content.match(/<li[^>]*>(.*?)<\/li>/gis) || [];
    return items.map((item: string) => {
      const text = item.replace(/<\/?li[^>]*>/gi, '').trim();
      return `- ${text}`;
    }).join('\n') + '\n\n';
  });
  
  markdown = markdown.replace(/<ol[^>]*>(.*?)<\/ol>/gis, (match, content) => {
    const items = content.match(/<li[^>]*>(.*?)<\/li>/gis) || [];
    return items.map((item: string, index: number) => {
      const text = item.replace(/<\/?li[^>]*>/gi, '').trim();
      return `${index + 1}. ${text}`;
    }).join('\n') + '\n\n';
  });
  
  // Paragraphs
  markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
  
  // Line breaks
  markdown = markdown.replace(/<br\s*\/?>/gi, '\n');
  
  // Remove remaining HTML tags
  markdown = markdown.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities
  markdown = markdown.replace(/&nbsp;/g, ' ');
  markdown = markdown.replace(/&amp;/g, '&');
  markdown = markdown.replace(/&lt;/g, '<');
  markdown = markdown.replace(/&gt;/g, '>');
  markdown = markdown.replace(/&quot;/g, '"');
  
  // Clean up extra whitespace
  markdown = markdown.replace(/\n{3,}/g, '\n\n');
  markdown = markdown.trim();
  
  return markdown;
}
