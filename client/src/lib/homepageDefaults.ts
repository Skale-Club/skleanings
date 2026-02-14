import type { HomepageContent } from '@shared/schema';

export const DEFAULT_HOMEPAGE_CONTENT: HomepageContent = {
  heroBadgeImageUrl: '',
  heroBadgeAlt: 'Trusted Experts',
  trustBadges: [
    { title: '100% Satisfaction Guarantee', description: 'Our quality is guaranteed.', icon: 'star' },
    { title: 'Fully-vetted Cleaning Crew', description: 'Trusted professionals only.', icon: 'shield' },
    { title: 'Upfront Pricing & Easy Booking', description: 'Book in under 60 seconds.', icon: 'clock' },
  ],
  categoriesSection: {
    title: 'Ready to Schedule?',
    subtitle: 'Select a category below to start your instant online booking.',
    ctaText: 'Book Now',
  },
  reviewsSection: {
    title: 'Customer Reviews',
    subtitle: 'See what our customers are saying about our 5-star services.',
    embedUrl: '',
  },
  blogSection: {
    title: 'Latest from Our Blog',
    subtitle: 'Tips and insights for a cleaner home',
    viewAllText: 'View All Posts',
    readMoreText: 'Read More',
  },
  areasServedSection: {
    label: 'Service Areas',
    heading: 'Areas We Serve',
    description: 'We provide professional cleaning services. Check the map to see if we cover your location.',
    ctaText: 'Book Now',
  },
};
