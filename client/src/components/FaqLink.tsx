import { Link } from 'wouter';
import { ReactNode } from 'react';

interface FaqLinkProps {
  faqId: number | string;
  children?: ReactNode;
  text?: string;
  className?: string;
}

/**
 * React component for creating links to specific FAQ items
 * Usage: <FaqLink faqId={1} text="Learn more" />
 * Or: <FaqLink faqId={1}>Learn more about our pricing</FaqLink>
 */
export function FaqLink({
  faqId,
  children,
  text = "Learn more",
  className = "text-primary hover:underline",
}: FaqLinkProps) {
  const displayText = children || text;

  return (
    <Link href={`/faq#faq-${faqId}`} className={className}>
      {displayText}
    </Link>
  );
}
