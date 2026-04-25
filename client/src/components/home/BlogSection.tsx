import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowRight, Calendar, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { DEFAULT_HOMEPAGE_CONTENT } from "@/lib/homepageDefaults";
import { fetchJsonOrThrow } from "@/lib/queryClient";
import type { BlogPost, HomepageContent } from "@shared/schema";

interface BlogSectionProps {
  content?: HomepageContent['blogSection'];
}

export function BlogSection({ content }: BlogSectionProps) {
  const sectionContent = {
    ...DEFAULT_HOMEPAGE_CONTENT.blogSection,
    ...(content || {}),
  };

  const { data: posts, isLoading } = useQuery<BlogPost[]>({
    queryKey: ['/api/blog', 'published', 3, 0],
    queryFn: () => fetchJsonOrThrow<BlogPost[]>('/api/blog?status=published&limit=3&offset=0'),
  });

  useEffect(() => {
    if (isLoading || !posts || posts.length === 0) return;
    if (window.location.hash === '#areas-served') {
      const element = document.getElementById('areas-served');
      if (element) {
        setTimeout(() => { element.scrollIntoView({ behavior: 'smooth' }); }, 50);
      }
    }
  }, [isLoading, posts]);

  if (isLoading || !posts || posts.length === 0) return null;

  const getExcerpt = (post: BlogPost) => {
    if (post.excerpt) return post.excerpt;
    const text = post.content.replace(/<[^>]*>/g, '');
    return text.length > 120 ? text.slice(0, 120) + '...' : text;
  };

  return (
    <section className="py-20 bg-[#F8FAFC]">
      <div className="container-custom mx-auto">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1D1D1D] mb-2" data-testid="text-blog-section-title">
              {sectionContent.title}
            </h2>
            <p className="text-slate-600 text-lg">{sectionContent.subtitle}</p>
          </div>
          <Link
            href="/blog"
            className="hidden md:flex items-center gap-2 text-primary font-semibold hover:underline"
            data-testid="link-view-all-blog"
          >
            {sectionContent.viewAllText}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map(post => (
            <Link key={post.id} href={`/blog/${post.slug}`} className="group" data-testid={`link-blog-card-${post.id}`}>
              <div className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 h-full flex flex-col">
                {post.featureImageUrl ? (
                  <div className="aspect-video overflow-hidden">
                    <img
                      src={post.featureImageUrl}
                      alt={post.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      data-testid={`img-blog-home-${post.id}`}
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                    <FileText className="w-12 h-12 text-blue-300" />
                  </div>
                )}
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
                    <Calendar className="w-4 h-4" />
                    <span data-testid={`text-blog-home-date-${post.id}`}>
                      {post.publishedAt ? format(new Date(post.publishedAt), 'MMMM d, yyyy') : ''}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-[#1D1D1D] mb-2 line-clamp-2 group-hover:text-primary transition-colors" data-testid={`text-blog-home-title-${post.id}`}>
                    {post.title}
                  </h3>
                  <p className="text-slate-600 text-sm line-clamp-3 flex-1" data-testid={`text-blog-home-excerpt-${post.id}`}>
                    {getExcerpt(post)}
                  </p>
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <span className="text-primary font-semibold text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                      {sectionContent.readMoreText}
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-10 text-center md:hidden">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-full hover:bg-primary/90 transition-colors"
            data-testid="link-view-all-blog-mobile"
          >
            {sectionContent.viewAllText}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
