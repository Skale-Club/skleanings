import type { HomepageContent } from '@shared/schema';

export const DEFAULT_HOMEPAGE_CONTENT: HomepageContent = {
  brandColors: {
    primary: '#1C53A3',
    secondary: '#FFFF01',
  },
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
  aboutSection: {
    heading: 'About Us',
    intro: "We believe a clean home is a happy home. Founded with a passion for excellence, we've become the most trusted name in professional cleaning services.",
    features: [
      { title: 'Local Expertise', desc: 'Serving our community with pride and dedication.' },
      { title: 'Quality Guaranteed', desc: "We don't stop until your space is sparkling." },
      { title: 'Professional Team', desc: 'Background-checked and highly trained cleaners.' },
      { title: 'Premium Service', desc: 'Upfront pricing and easy online booking.' },
    ],
    missionTitle: 'Our Mission',
    missionText: 'To provide top-tier cleaning services that save you time and energy, allowing you to focus on what matters most. We use eco-friendly products and meticulous techniques to ensure a healthy environment for your family.',
  },
  teamSection: {
    heading: 'Our Team',
    intro: 'Meet the dedicated professionals who bring excellence to every cleaning service. Our team is background-checked, highly trained, and committed to delivering outstanding results.',
    features: [
      { title: 'Professional Staff', desc: 'Every team member undergoes thorough background checks and comprehensive training.' },
      { title: 'Certified Experts', desc: 'Our cleaners are certified in the latest cleaning techniques and safety protocols.' },
      { title: 'Passionate Service', desc: 'We take pride in our work and treat every home with care and respect.' },
      { title: 'Quality Focus', desc: 'Consistently delivering exceptional results that exceed expectations.' },
    ],
    whyChooseTitle: 'Why Choose Our Team',
    whyChooseText: "When you book with us, you're not just getting a cleaning service – you're getting a team of dedicated professionals who care about your home as much as you do. We invest in our people because we know that great service starts with great team members.",
    stats: [
      { value: '100%', label: 'Background Checked' },
      { value: '500+', label: 'Happy Customers' },
      { value: '5★', label: 'Average Rating' },
    ],
  },
  serviceAreasPageSection: {
    heading: 'Areas We Serve',
    intro: 'We proudly serve communities in your area. We bring our professional cleaning services to your doorstep with reliable, upfront pricing and easy online booking.',
    notFoundTitle: "Don't see your area?",
    notFoundText: "We're constantly expanding our service coverage. Contact us to check if we can serve your location.",
  },
  faqPageSection: {
    heading: 'Frequently Asked Questions',
    subtitle: 'Find answers to common questions about our cleaning services.',
  },
  blogPageSection: {
    heading: 'Our Blog',
    subtitle: 'Tips, guides, and insights about professional cleaning services',
  },
  confirmationSection: {
    paidMessage: "Your payment was successful and your booking is confirmed. We'll see you at the scheduled time.",
    sitePaymentMessage: "We've sent a confirmation email with all the details. Our team will arrive at the scheduled time.",
  },
  footerSection: {
    tagline: 'Professional cleaning services. We provide upfront pricing and easy online booking for your convenience.',
    companyLinks: [
      { label: 'About Us', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Our Team', href: '/team' },
    ],
    resourceLinks: [
      { label: 'Blog', href: '/blog' },
      { label: 'FAQ', href: '/faq' },
    ],
  },
};
