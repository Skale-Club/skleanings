/**
 * Utility functions for working with FAQ links and anchors
 */

/**
 * Generates a FAQ anchor link
 * @param faqId - The ID of the FAQ item
 * @returns The anchor URL for the FAQ (e.g., "/faq#faq-1")
 */
export function getFaqLink(faqId: number | string): string {
  return `/faq#faq-${faqId}`;
}

/**
 * Creates a markdown link to a specific FAQ
 * @param faqId - The ID of the FAQ item
 * @param text - The display text for the link (defaults to "Learn more")
 * @returns The markdown link syntax
 */
export function getFaqMarkdownLink(
  faqId: number | string,
  text: string = "Learn more"
): string {
  return `[${text}](/faq#faq-${faqId})`;
}

/**
 * Creates an HTML anchor tag for a FAQ link
 * @param faqId - The ID of the FAQ item
 * @param text - The display text for the link (defaults to "Learn more")
 * @param className - Optional CSS classes to apply
 * @returns The HTML anchor tag
 */
export function getFaqAnchorHTML(
  faqId: number | string,
  text: string = "Learn more",
  className: string = ""
): string {
  return `<a href="/faq#faq-${faqId}" class="${className}">${text}</a>`;
}
