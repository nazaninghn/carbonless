'use client';

import Header from '@/components/Header';
import { useLanguage } from '@/lib/i18n/LanguageContext';

import { useState, useEffect } from 'react';
import { Image } from '@/components/Image';
import { Link } from '@/components/Link';
import { Menu } from 'lucide-react';
import { Sparkles } from 'lucide-react';
import { Text } from '@/components/Text';
import { X } from 'lucide-react';
import { Youtube } from 'lucide-react';

export default function Page() {
  const { t } = useLanguage();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);  return (
    <div className="bg-white text-gray-900 antialiased overflow-x-hidden">
      <>
        <Header />
        <main>
          {/* Privacy Policy */}
          <section id="privacy_policy" className="pt-24 lg:pt-[193px] pb-16 lg:pb-28 bg-gradient-to-b from-gray-50 to-white">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <div data-aos="fade-up" className="text-center">
                <h1 className="text-4xl sm:text-5xl font-bold mb-6 text-gray-900"> Privacy Policy </h1>
                <p className="text-lg text-gray-600"> Last updated: December 15, 2024 </p>
              </div>
            </div>
          </section>
          {/* 1 Information We Collect */}
          <section id="1_information_we_collect" className="py-20 lg:py-28">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <div data-aos="fade-up" className="prose prose-lg max-w-none">
                {/* Introduction */}
                <div className="mb-12">
                  <p className="text-lg text-gray-600 leading-relaxed">
                     At CarbonTrack ("we," "our," or "us"), we are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website, services, and applications (collectively, the "Services"). 
                  </p>
                </div>
                {/* Section 1 */}
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4"> 1. Information We Collect </h2>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-6"> 1.1 Information You Provide </h3>
                  <p className="text-gray-600 mb-4">
                     We collect information you voluntarily provide, including: 
                  </p>
                  <ul className="list-disc pl-6 space-y-2 text-gray-600">
                    <li>
                      <strong> Account Information: </strong>
                       Name, email address, password, and company name when you create an account 
                    </li>
                    <li>
                      <strong> Payment Information: </strong>
                       Billing address and payment card details (processed securely by our payment provider) 
                    </li>
                    <li>
                      <strong> Profile Information: </strong>
                       Job title, profile photo, and preferences 
                    </li>
                    <li>
                      <strong> Communications: </strong>
                       Messages you send us through support channels or email 
                    </li>
                    <li>
                      <strong> User Content: </strong>
                       Data you upload or process through our Services 
                    </li>
                  </ul>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-6"> 1.2 Information Collected Automatically </h3>
                  <p className="text-gray-600 mb-4"> When you use our Services, we automatically collect: </p>
                  <ul className="list-disc pl-6 space-y-2 text-gray-600">
                    <li>
                      <strong> Usage Data: </strong>
                       Features used, actions taken, and time spent on the platform 
                    </li>
                    <li>
                      <strong> Device Information: </strong>
                       Browser type, operating system, device identifiers 
                    </li>
                    <li>
                      <strong> Log Data: </strong>
                       IP address, access times, pages viewed, and referring URLs 
                    </li>
                    <li>
                      <strong> Cookies: </strong>
                       See our Cookie Policy section below for details 
                    </li>
                  </ul>
                </div>
                {/* Section 2 */}
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4"> 2. How We Use Your Information </h2>
                  <p className="text-gray-600 mb-4"> We use the collected information to: </p>
                  <ul className="list-disc pl-6 space-y-2 text-gray-600">
                    <li> Provide, maintain, and improve our Services </li>
                    <li> Process transactions and send related information </li>
                    <li>
                       Send administrative messages, updates, and security alerts 
                    </li>
                    <li> Respond to your comments, questions, and support requests </li>
                    <li> Personalize your experience and deliver relevant content </li>
                    <li> Monitor and analyze usage trends and preferences </li>
                    <li> Detect, prevent, and address technical issues and fraud </li>
                    <li> Comply with legal obligations </li>
                  </ul>
                </div>
                {/* Section 3 */}
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4"> 3. Information Sharing </h2>
                  <p className="text-gray-600 mb-4">
                     We may share your information in the following situations: 
                  </p>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-6"> 3.1 Service Providers </h3>
                  <p className="text-gray-600 mb-4">
                     We share information with third-party vendors who perform services on our behalf, such as payment processing, data analysis, email delivery, hosting services, and customer support. 
                  </p>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-6"> 3.2 Business Transfers </h3>
                  <p className="text-gray-600 mb-4">
                     In connection with a merger, acquisition, or sale of assets, your information may be transferred. We will provide notice before your information becomes subject to a different privacy policy. 
                  </p>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-6"> 3.3 Legal Requirements </h3>
                  <p className="text-gray-600 mb-4">
                     We may disclose information if required by law or in response to valid legal requests by public authorities. 
                  </p>
                </div>
                {/* Section 4 */}
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4"> 4. Data Security </h2>
                  <p className="text-gray-600 mb-4">
                     We implement appropriate technical and organizational measures to protect your personal information, including: 
                  </p>
                  <ul className="list-disc pl-6 space-y-2 text-gray-600">
                    <li>
                       Encryption of data in transit (TLS 1.3) and at rest (AES-256) 
                    </li>
                    <li> Regular security assessments and penetration testing </li>
                    <li> SOC 2 Type II certified infrastructure </li>
                    <li> Access controls and authentication mechanisms </li>
                    <li> Employee security training and background checks </li>
                  </ul>
                </div>
                {/* Section 5 */}
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4"> 5. Your Rights </h2>
                  <p className="text-gray-600 mb-4">
                     Depending on your location, you may have certain rights regarding your personal information: 
                  </p>
                  <ul className="list-disc pl-6 space-y-2 text-gray-600">
                    <li>
                      <strong> Access: </strong>
                       Request a copy of your personal data 
                    </li>
                    <li>
                      <strong> Correction: </strong>
                       Request correction of inaccurate data 
                    </li>
                    <li>
                      <strong> Deletion: </strong>
                       Request deletion of your personal data 
                    </li>
                    <li>
                      <strong> Portability: </strong>
                       Receive your data in a structured, machine-readable format 
                    </li>
                    <li>
                      <strong> Objection: </strong>
                       Object to processing of your personal data 
                    </li>
                    <li>
                      <strong> Restriction: </strong>
                       Request restriction of processing 
                    </li>
                  </ul>
                  <p className="text-gray-600 mt-4">
                     To exercise these rights, please contact us at 
                    <Link className="text-primary hover:underline" href="mailto:privacy@CarbonTrack.com"> privacy@CarbonTrack.com </Link>
                     . 
                  </p>
                </div>
                {/* Section 6 */}
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4"> 6. Cookie Policy </h2>
                  <p className="text-gray-600 mb-4">
                     We use cookies and similar tracking technologies to track activity on our Services. Cookies are files with a small amount of data which may include an anonymous unique identifier. 
                  </p>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-6"> Types of Cookies We Use: </h3>
                  <ul className="list-disc pl-6 space-y-2 text-gray-600">
                    <li>
                      <strong> Essential Cookies: </strong>
                       Required for the website to function properly 
                    </li>
                    <li>
                      <strong> Analytics Cookies: </strong>
                       Help us understand how visitors interact with our website 
                    </li>
                    <li>
                      <strong> Functional Cookies: </strong>
                       Remember your preferences and settings 
                    </li>
                    <li>
                      <strong> Marketing Cookies: </strong>
                       Used to deliver relevant advertisements 
                    </li>
                  </ul>
                  <p className="text-gray-600 mt-4">
                     You can control cookies through your browser settings. Note that disabling certain cookies may affect the functionality of our Services. 
                  </p>
                </div>
                {/* Section 7 */}
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4"> 7. Data Retention </h2>
                  <p className="text-gray-600">
                     We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required by law. When you delete your account, we will delete your personal data within 30 days, except for data we are required to retain for legal or compliance purposes. 
                  </p>
                </div>
                {/* Section 8 */}
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4"> 8. International Data Transfers </h2>
                  <p className="text-gray-600">
                     Your information may be transferred to and processed in countries other than your country of residence. We ensure appropriate safeguards are in place to protect your information, including Standard Contractual Clauses approved by the European Commission. 
                  </p>
                </div>
                {/* Section 9 */}
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4"> 9. Children's Privacy </h2>
                  <p className="text-gray-600">
                     Our Services are not intended for individuals under 16 years of age. We do not knowingly collect personal information from children. If you become aware that a child has provided us with personal data, please contact us immediately. 
                  </p>
                </div>
                {/* Section 10 */}
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4"> 10. Changes to This Policy </h2>
                  <p className="text-gray-600">
                     We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. We encourage you to review this Privacy Policy periodically for any changes. 
                  </p>
                </div>
                {/* Contact Section */}
                <div className="glass-card rounded-2xl p-8 mt-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4"> Contact Us </h2>
                  <p className="text-gray-600 mb-4">
                     If you have any questions about this Privacy Policy, please contact us: 
                  </p>
                  <ul className="space-y-2 text-gray-600">
                    <li>
                      <strong> Email: </strong>
                      <Link className="text-primary hover:underline" href="mailto:privacy@CarbonTrack.com"> privacy@CarbonTrack.com </Link>
                    </li>
                    <li>
                      <strong> Address: </strong>
                       548 Market St, Suite 42, San Francisco, CA 94104 
                    </li>
                    <li>
                      <strong> Phone: </strong>
                       +1 (415) 555-1234 
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        </main>
        <footer className="bg-gray-50 border-t border-gray-200">
          {/* Main Footer */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 lg:gap-12">
              {/* Brand Column */}
              <div className="col-span-2 md:col-span-4 lg:col-span-1">
                <Link className="flex items-center gap-2 mb-4" href="/"><div className="w-10 h-10 bg-gradient-to-br from-primary via-secondary to-accent rounded-xl flex items-center justify-center"><Sparkles className="w-6 h-6 text-white" /></div>
                <Text variant="bold" className="text-xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent"> CarbonTrack </Text></Link>
                <p className="text-gray-600 text-sm mb-6">
                   Transform your data into actionable insights with our AI-powered analytics platform. Built for modern teams. 
                </p>
                {/* Social Links */}
                <div className="flex items-center gap-3">
                  <Link className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600 hover:bg-primary hover:text-white transition-all duration-200" href="https://twitter.com"><Image className="w-5 h-5" src="/assets/tech-icons/dark/twitter.svg" alt="Twitter" /></Link>
                  <Link className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600 hover:bg-primary hover:text-white transition-all duration-200" href="https://linkedin.com"><Image className="w-5 h-5" src="/assets/tech-icons/dark/linkedin.svg" alt="LinkedIn" /></Link>
                  <Link className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600 hover:bg-primary hover:text-white transition-all duration-200" href="https://github.com"><Image className="w-5 h-5" src="/assets/tech-icons/dark/github.svg" alt="GitHub" /></Link>
                  <Link className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600 hover:bg-primary hover:text-white transition-all duration-200" href="https://youtube.com"><Youtube className="w-5 h-5" /></Link>
                </div>
              </div>
              {/* Product Links */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-4"> Product </h4>
                <ul className="space-y-3">
                  <li>
                    <Link className="text-gray-600 hover:text-primary transition-colors duration-200 text-sm" href="/features"> Features </Link>
                  </li>
                  <li>
                    <Link className="text-gray-600 hover:text-primary transition-colors duration-200 text-sm" href="/register"> Pricing </Link>
                  </li>
                  <li>
                    <Link className="text-gray-600 hover:text-primary transition-colors duration-200 text-sm" href="features.html#integrations"> Integrations </Link>
                  </li>
                  <li>
                    <Link className="text-gray-600 hover:text-primary transition-colors duration-200 text-sm" href="features.html#api"> API </Link>
                  </li>
                  <li>
                    <Link className="text-gray-600 hover:text-primary transition-colors duration-200 text-sm" href="/"> Changelog </Link>
                  </li>
                </ul>
              </div>
              {/* Company Links */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-4"> Company </h4>
                <ul className="space-y-3">
                  <li>
                    <Link className="text-gray-600 hover:text-primary transition-colors duration-200 text-sm" href="/about"> About Us </Link>
                  </li>
                  <li>
                    <Link className="text-gray-600 hover:text-primary transition-colors duration-200 text-sm" href="/"> Blog </Link>
                  </li>
                  <li>
                    <Link className="text-gray-600 hover:text-primary transition-colors duration-200 text-sm" href="about.html#careers"> Careers </Link>
                  </li>
                  <li>
                    <Link className="text-gray-600 hover:text-primary transition-colors duration-200 text-sm" href="/contact"> Contact </Link>
                  </li>
                  <li>
                    <Link className="text-gray-600 hover:text-primary transition-colors duration-200 text-sm" href="about.html#press"> Press </Link>
                  </li>
                </ul>
              </div>
              {/* Resources Links */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-4"> Resources </h4>
                <ul className="space-y-3">
                  <li>
                    <Link className="text-gray-600 hover:text-primary transition-colors duration-200 text-sm" href="/"> Documentation </Link>
                  </li>
                  <li>
                    <Link className="text-gray-600 hover:text-primary transition-colors duration-200 text-sm" href="/"> Help Center </Link>
                  </li>
                  <li>
                    <Link className="text-gray-600 hover:text-primary transition-colors duration-200 text-sm" href="/"> Guides </Link>
                  </li>
                  <li>
                    <Link className="text-gray-600 hover:text-primary transition-colors duration-200 text-sm" href="/"> Webinars </Link>
                  </li>
                  <li>
                    <Link className="text-gray-600 hover:text-primary transition-colors duration-200 text-sm" href="/contact"> Support </Link>
                  </li>
                </ul>
              </div>
              {/* Legal Links */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-4"> Legal </h4>
                <ul className="space-y-3">
                  <li>
                    <Link className="text-gray-600 hover:text-primary transition-colors duration-200 text-sm" href="/privacy"> Privacy Policy </Link>
                  </li>
                  <li>
                    <Link className="text-gray-600 hover:text-primary transition-colors duration-200 text-sm" href="/terms"> Terms of Service </Link>
                  </li>
                  <li>
                    <Link className="text-gray-600 hover:text-primary transition-colors duration-200 text-sm" href="privacy.html#cookies"> Cookie Policy </Link>
                  </li>
                  <li>
                    <Link className="text-gray-600 hover:text-primary transition-colors duration-200 text-sm" href="privacy.html#gdpr"> GDPR </Link>
                  </li>
                  <li>
                    <Link className="text-gray-600 hover:text-primary transition-colors duration-200 text-sm" href="terms.html#security"> Security </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          {/* Footer Bottom */}
          <div className="border-t border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-gray-500 text-sm text-center md:text-left"> © 2024 CarbonTrack. All rights reserved. </p>
                <div className="flex items-center gap-6">
                  <Link className="text-gray-500 hover:text-primary text-sm transition-colors duration-200" href="/privacy"> Privacy </Link>
                  <Link className="text-gray-500 hover:text-primary text-sm transition-colors duration-200" href="/terms"> Terms </Link>
                  <Link className="text-gray-500 hover:text-primary text-sm transition-colors duration-200" href="/contact"> Contact </Link>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </>
    </div>
  );
}
