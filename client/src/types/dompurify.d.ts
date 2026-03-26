declare module "dompurify" {
  const DOMPurify: {
    sanitize(dirty: string, config?: Record<string, unknown>): string;
  };

  export default DOMPurify;
}
