/**
 * Seeds privacyPolicyContent and termsOfServiceContent in the DB
 * from the original hardcoded JSX pages (converted to HTML).
 *
 * Run: node scripts/seed-legal-content.mjs
 */

import postgres from "postgres";
import "dotenv/config";

const privacy = `<div class="space-y-12">

<section>
  <h2 class="text-2xl font-bold text-gray-900 mb-4">1. Introduction</h2>
  <div class="space-y-4 text-gray-600">
    <p>Welcome to Skleanings ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our cleaning services.</p>
    <p>By using our services, you agree to the collection and use of information in accordance with this policy. If you do not agree with our policies and practices, please do not use our services.</p>
  </div>
</section>

<section>
  <h2 class="text-2xl font-bold text-gray-900 mb-4">2. Information We Collect</h2>
  <div class="space-y-4 text-gray-600">
    <p>We collect information that you provide directly to us and information collected automatically when you use our services.</p>
    <h4 class="font-semibold text-gray-900 mt-6 mb-3">Personal Information You Provide</h4>
    <ul class="list-disc pl-6 space-y-2">
      <li><strong>Contact Information:</strong> Name, email address, phone number, and mailing address</li>
      <li><strong>Booking Details:</strong> Service preferences, appointment dates and times, property information</li>
      <li><strong>Payment Information:</strong> Credit card numbers, billing address (processed securely through our payment providers)</li>
      <li><strong>Communications:</strong> Messages, feedback, and correspondence you send to us</li>
      <li><strong>Account Information:</strong> Username, password, and profile preferences</li>
    </ul>
    <h4 class="font-semibold text-gray-900 mt-6 mb-3">Information Collected Automatically</h4>
    <ul class="list-disc pl-6 space-y-2">
      <li><strong>Device Information:</strong> IP address, browser type, operating system, and device identifiers</li>
      <li><strong>Usage Data:</strong> Pages visited, time spent on pages, click patterns, and referring URLs</li>
      <li><strong>Location Data:</strong> General geographic location based on IP address</li>
    </ul>
  </div>
</section>

<section>
  <h2 class="text-2xl font-bold text-gray-900 mb-4">3. How We Use Your Information</h2>
  <div class="space-y-4 text-gray-600">
    <p>We use the information we collect for various purposes, including:</p>
    <ul class="list-disc pl-6 space-y-2 mt-4">
      <li><strong>Service Delivery:</strong> To schedule, provide, and manage your cleaning services</li>
      <li><strong>Communication:</strong> To send booking confirmations, reminders, and service updates</li>
      <li><strong>Customer Support:</strong> To respond to your inquiries and resolve issues</li>
      <li><strong>Payment Processing:</strong> To process transactions and send invoices</li>
      <li><strong>Improvement:</strong> To analyze usage patterns and improve our services</li>
      <li><strong>Marketing:</strong> To send promotional offers and newsletters (with your consent)</li>
      <li><strong>Legal Compliance:</strong> To comply with legal obligations and protect our rights</li>
    </ul>
  </div>
</section>

<section>
  <h2 class="text-2xl font-bold text-gray-900 mb-4">4. Information Sharing and Disclosure</h2>
  <div class="space-y-4 text-gray-600">
    <p>We do not sell your personal information. We may share your information in the following circumstances:</p>
    <ul class="list-disc pl-6 space-y-2 mt-4">
      <li><strong>Service Providers:</strong> With trusted third parties who assist in operating our business (payment processors, scheduling software, email services)</li>
      <li><strong>Cleaning Professionals:</strong> With our cleaning staff to the extent necessary to provide services at your location</li>
      <li><strong>Legal Requirements:</strong> When required by law, court order, or government request</li>
      <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
      <li><strong>With Your Consent:</strong> When you have given us permission to share your information</li>
    </ul>
  </div>
</section>

<section>
  <h2 class="text-2xl font-bold text-gray-900 mb-4">5. Data Security</h2>
  <div class="space-y-4 text-gray-600">
    <p>We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. These measures include:</p>
    <ul class="list-disc pl-6 space-y-2 mt-4">
      <li>Encryption of data in transit using SSL/TLS technology</li>
      <li>Secure storage of sensitive information</li>
      <li>Regular security assessments and updates</li>
      <li>Access controls limiting who can view your information</li>
      <li>Employee training on data protection practices</li>
    </ul>
    <p class="mt-4">However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.</p>
  </div>
</section>

<section>
  <h2 class="text-2xl font-bold text-gray-900 mb-4">6. Cookies and Tracking Technologies</h2>
  <div class="space-y-4 text-gray-600">
    <p>We use cookies and similar tracking technologies to enhance your experience on our website:</p>
    <h4 class="font-semibold text-gray-900 mt-6 mb-3">Types of Cookies We Use</h4>
    <ul class="list-disc pl-6 space-y-2">
      <li><strong>Essential Cookies:</strong> Required for the website to function properly</li>
      <li><strong>Analytics Cookies:</strong> Help us understand how visitors interact with our website (e.g., Google Analytics)</li>
      <li><strong>Marketing Cookies:</strong> Used to deliver relevant advertisements and track campaign effectiveness</li>
    </ul>
    <p class="mt-4">You can control cookie preferences through your browser settings. Note that disabling certain cookies may affect website functionality.</p>
  </div>
</section>

<section>
  <h2 class="text-2xl font-bold text-gray-900 mb-4">7. Your Privacy Rights</h2>
  <div class="space-y-4 text-gray-600">
    <p>Depending on your location, you may have the following rights regarding your personal information:</p>
    <ul class="list-disc pl-6 space-y-2 mt-4">
      <li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
      <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information</li>
      <li><strong>Deletion:</strong> Request deletion of your personal information (subject to legal retention requirements)</li>
      <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications at any time</li>
      <li><strong>Data Portability:</strong> Request your data in a structured, commonly used format</li>
      <li><strong>Withdraw Consent:</strong> Withdraw previously given consent for data processing</li>
    </ul>
    <p class="mt-4">To exercise any of these rights, please contact us using the information provided below.</p>
  </div>
</section>

<section>
  <h2 class="text-2xl font-bold text-gray-900 mb-4">8. Data Retention</h2>
  <div class="space-y-4 text-gray-600">
    <p>We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required by law. Specifically:</p>
    <ul class="list-disc pl-6 space-y-2 mt-4">
      <li>Account information is retained while your account remains active</li>
      <li>Booking records are retained for 7 years for tax and legal purposes</li>
      <li>Marketing preferences are retained until you opt out</li>
      <li>Analytics data is retained in anonymized form indefinitely</li>
    </ul>
  </div>
</section>

<section>
  <h2 class="text-2xl font-bold text-gray-900 mb-4">9. Children's Privacy</h2>
  <div class="space-y-4 text-gray-600">
    <p>Our services are not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately, and we will take steps to delete such information.</p>
  </div>
</section>

<section>
  <h2 class="text-2xl font-bold text-gray-900 mb-4">10. Changes to This Privacy Policy</h2>
  <div class="space-y-4 text-gray-600">
    <p>We may update this Privacy Policy from time to time to reflect changes in our practices or for legal, operational, or regulatory reasons. We will notify you of any material changes by:</p>
    <ul class="list-disc pl-6 space-y-2 mt-4">
      <li>Posting the updated policy on our website</li>
      <li>Updating the "Last updated" date at the top of this page</li>
      <li>Sending an email notification for significant changes (if you have an account)</li>
    </ul>
    <p class="mt-4">We encourage you to review this Privacy Policy periodically to stay informed about how we protect your information.</p>
  </div>
</section>

<section>
  <h2 class="text-2xl font-bold text-gray-900 mb-4">11. Contact Us</h2>
  <div class="space-y-4 text-gray-600">
    <p>If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:</p>
    <div class="mt-4 p-6 bg-gray-50 rounded-lg">
      <p class="font-semibold text-gray-900">Skleanings</p>
      <p class="text-gray-600 mt-2">Email: <a href="mailto:contact@skleanings.com" class="text-primary hover:underline">contact@skleanings.com</a></p>
      <p class="text-gray-600">Phone: <a href="tel:5085006625" class="text-primary hover:underline">508 500 6625</a></p>
      <p class="text-gray-600">Address: 36 South St. Framingham MA</p>
    </div>
    <p class="mt-4">We will respond to your inquiry within 30 days.</p>
  </div>
</section>

</div>`;

const terms = `<div class="space-y-12">

<section>
  <h2 class="text-2xl font-bold text-gray-900 mb-4">1. Acceptance of Terms</h2>
  <div class="space-y-4 text-gray-600">
    <p>By accessing the site, creating an account, or booking services with Skleanings, you agree to these Terms of Service and our Privacy Policy. If you do not agree, do not use our services.</p>
  </div>
</section>

<section>
  <h2 class="text-2xl font-bold text-gray-900 mb-4">2. Services and Scope</h2>
  <div class="space-y-4 text-gray-600">
    <p>We provide residential and commercial cleaning and related offerings as described on the site. Service details, checklists, and exclusions may vary by package and location.</p>
  </div>
</section>

<section>
  <h2 class="text-2xl font-bold text-gray-900 mb-4">3. Eligibility and Accounts</h2>
  <div class="space-y-4 text-gray-600">
    <ul class="list-disc pl-6 space-y-2">
      <li>You must be at least 18 years old and legally able to enter binding contracts.</li>
      <li>You agree to provide accurate contact, access, and billing information and to keep it updated.</li>
      <li>You are responsible for safeguarding account credentials and all activity under your account.</li>
    </ul>
  </div>
</section>

<section>
  <h2 class="text-2xl font-bold text-gray-900 mb-4">4. Quotes, Pricing, and Payments</h2>
  <div class="space-y-4 text-gray-600">
    <ul class="list-disc pl-6 space-y-2">
      <li>Prices, estimates, and promotions are shown at checkout and may adjust based on property size, condition, add-ons, or special requests.</li>
      <li>Taxes and fees may apply. We may place an authorization hold or charge your payment method per the booking terms.</li>
      <li>If on-site conditions differ materially from the booking details, we may adjust the scope or pricing with your consent before proceeding.</li>
    </ul>
  </div>
</section>

<section>
  <h2 class="text-2xl font-bold text-gray-900 mb-4">5. Scheduling, Rescheduling, and Cancellations</h2>
  <div class="space-y-4 text-gray-600">
    <ul class="list-disc pl-6 space-y-2">
      <li>Appointments are subject to availability. Arrival times may include a service window to account for traffic and prior jobs.</li>
      <li>Reschedules or cancellations should be requested as early as possible. Late changes may incur a fee if notice is shorter than the policy shown at booking.</li>
      <li>We may reschedule or cancel due to unsafe conditions, severe weather, or events outside our control; in such cases we will work with you to find a new time.</li>
    </ul>
  </div>
</section>

<section>
  <h2 class="text-2xl font-bold text-gray-900 mb-4">6. Access, Safety, and Preparation</h2>
  <div class="space-y-4 text-gray-600">
    <ul class="list-disc pl-6 space-y-2">
      <li>You agree to provide safe, timely access (keys, codes, parking, gate instructions) for the scheduled appointment.</li>
      <li>Please secure valuables, inform us of pets, and disclose hazards (fragile items, infestations, biohazards, sharp objects).</li>
      <li>We may decline or pause service if conditions are unsafe for our team or could damage your property.</li>
    </ul>
  </div>
</section>

<section>
  <h2 class="text-2xl font-bold text-gray-900 mb-4">7. Service Quality and Re-Cleans</h2>
  <div class="space-y-4 text-gray-600">
    <ul class="list-disc pl-6 space-y-2">
      <li>Services follow the checklist for your selected package. Certain items (e.g., mold remediation, extreme clutter) may be excluded unless agreed in writing.</li>
      <li>If something was missed, contact us within 24 hours with details and photos. We may offer a re-clean of the affected areas at our discretion.</li>
      <li>Re-cleans do not cover new messes, wear and tear, or issues unrelated to the original visit.</li>
    </ul>
  </div>
</section>

<section>
  <h2 class="text-2xl font-bold text-gray-900 mb-4">8. Customer Responsibilities and Conduct</h2>
  <div class="space-y-4 text-gray-600">
    <ul class="list-disc pl-6 space-y-2">
      <li>Treat staff respectfully and provide a safe working environment free from harassment, discrimination, or threats.</li>
      <li>Advise us of any special surface requirements (e.g., marble, specialty finishes) before service begins.</li>
      <li>We are not responsible for pre-existing damage or instability (loose fixtures, broken blinds, unsecured shelves).</li>
    </ul>
  </div>
</section>

<section>
  <h2 class="text-2xl font-bold text-gray-900 mb-4">9. Supplies, Equipment, and Property Care</h2>
  <div class="space-y-4 text-gray-600">
    <ul class="list-disc pl-6 space-y-2">
      <li>We supply standard cleaning products and tools unless otherwise noted. If you request specific products or equipment, you may need to provide them.</li>
      <li>Certain delicate or high-value items may be cleaned only with your explicit permission or may be excluded to prevent damage.</li>
    </ul>
  </div>
</section>

<section>
  <h2 class="text-2xl font-bold text-gray-900 mb-4">10. Recurring Services and Subscriptions</h2>
  <div class="space-y-4 text-gray-600">
    <ul class="list-disc pl-6 space-y-2">
      <li>Recurring schedules (weekly, biweekly, monthly) are subject to calendar availability and may shift around holidays.</li>
      <li>Pricing may change if the scope, frequency, or property condition changes. We will notify you of adjustments before charging.</li>
      <li>You may pause or cancel recurring services with notice as described during booking.</li>
    </ul>
  </div>
</section>

<section>
  <h2 class="text-2xl font-bold text-gray-900 mb-4">11. Limitations of Liability</h2>
  <div class="space-y-4 text-gray-600">
    <ul class="list-disc pl-6 space-y-2">
      <li>To the fullest extent permitted by law, we are not liable for indirect, incidental, or consequential damages.</li>
      <li>Our aggregate liability for any claim is limited to the amount you paid for the service giving rise to the claim.</li>
      <li>We are not responsible for losses arising from undisclosed hazards, improper installations, or normal wear and tear.</li>
    </ul>
  </div>
</section>

<section>
  <h2 class="text-2xl font-bold text-gray-900 mb-4">12. Intellectual Property and Acceptable Use</h2>
  <div class="space-y-4 text-gray-600">
    <ul class="list-disc pl-6 space-y-2">
      <li>All site content, trademarks, and materials are owned by Skleanings or its licensors and may not be copied or used without permission.</li>
      <li>You agree not to misuse the site (including scraping, reverse engineering, or interfering with security features) or use our brand without consent.</li>
    </ul>
  </div>
</section>

<section>
  <h2 class="text-2xl font-bold text-gray-900 mb-4">13. Third-Party Services and Links</h2>
  <div class="space-y-4 text-gray-600">
    <p>We may reference or integrate third-party services (e.g., payments, scheduling). Those providers' terms and privacy policies apply to their services; we are not responsible for their content or practices.</p>
  </div>
</section>

<section>
  <h2 class="text-2xl font-bold text-gray-900 mb-4">14. Changes and Termination</h2>
  <div class="space-y-4 text-gray-600">
    <ul class="list-disc pl-6 space-y-2">
      <li>We may update these terms periodically. The "Last updated" date reflects the latest version. Continued use after changes means you accept the revised terms.</li>
      <li>We may suspend or terminate access if you violate these terms, create unsafe conditions, or engage in fraud or abuse.</li>
    </ul>
  </div>
</section>

<section>
  <h2 class="text-2xl font-bold text-gray-900 mb-4">15. Governing Law and Dispute Resolution</h2>
  <div class="space-y-4 text-gray-600">
    <p>These terms are governed by the laws of the jurisdiction where Skleanings operates, without regard to conflict-of-law principles. Please contact us first to try to resolve any issue informally.</p>
  </div>
</section>

<section>
  <h2 class="text-2xl font-bold text-gray-900 mb-4">16. Contact</h2>
  <div class="space-y-4 text-gray-600">
    <p>If you have questions or concerns about these Terms of Service, contact us:</p>
    <div class="mt-4 p-6 bg-gray-50 rounded-lg">
      <p class="font-semibold text-gray-900">Skleanings</p>
      <p class="text-gray-600 mt-2">Email: <a href="mailto:contact@skleanings.com" class="text-primary hover:underline">contact@skleanings.com</a></p>
      <p class="text-gray-600">Phone: <a href="tel:5085006625" class="text-primary hover:underline">508 500 6625</a></p>
      <p class="text-gray-600">Address: 36 South St. Framingham MA</p>
    </div>
    <p class="mt-4">We aim to respond to inquiries within 30 days.</p>
  </div>
</section>

</div>`;

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

await sql`
  UPDATE company_settings
  SET
    privacy_policy_content = ${privacy},
    terms_of_service_content = ${terms}
  WHERE id = 1
`;

await sql.end();

console.log("✓ privacy_policy_content and terms_of_service_content saved to DB");
console.log("  Visit http://localhost:5000/privacy-policy");
console.log("  Visit http://localhost:5000/terms-of-service");
