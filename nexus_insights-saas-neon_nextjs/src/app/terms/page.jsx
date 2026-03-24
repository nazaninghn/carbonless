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
          {/* Terms Of Service */}
          <section id="terms_of_service" className="pt-24 lg:pt-[193px] pb-16 lg:pb-28 bg-gradient-to-b from-gray-50 to-white">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <div data-aos="fade-up" className="text-center">
                <h1 className="text-4xl sm:text-5xl font-bold mb-6 text-gray-900"> Terms of Service </h1>
                <p className="text-lg text-gray-600"> Last updated: December 15, 2024 </p>
              </div>
            </div>
          </section>
          {/* 1 Acceptance Of Terms */}
          <section id="1_acceptance_of_terms" className="py-20 lg:py-28">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <div data-aos="fade-up" className="prose prose-lg max-w-none">
                {/* Introduction */}
                <div className="mb-12">
                  <p className="text-lg text-gray-600 leading-relaxed">
                     Welcome to CarbonTrack. These Terms of Service ("Terms") govern your access to and use of the CarbonTrack website, services, and applications (collectively, the "Services"). By accessing or using our Services, you agree to be bound by these Terms. 
                  </p>
                  <p className="text-gray-600 mt-4">
                     Please read these Terms carefully before using our Services. If you do not agree to these Terms, you may not access or use the Services. 
                  </p>
                </div>
                {/* Section 1 */}
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4"> 1. Acceptance of Terms </h2>
                  <p className="text-gray-600 mb-4">
                     By creating an account or using our Services, you represent that: 
                  </p>
                  <ul className="list-disc pl-6 space-y-2 text-gray-600">
                    <li>
                       You are at least 18 years old or the age of majority in your jurisdiction 
                    </li>
                    <li>
                       You have the legal capacity to enter into a binding agreement 
                    </li>
                    <li>
                       If using the Services on behalf of an organization, you have authority to bind that organization to these Terms 
                    </li>
                    <li> You will comply with all applicable laws and regulations </li>
                  </ul>
                </div>
                {/* Section 2 */}
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4"> 2. Description of Services </h2>
                  <p className="text-gray-600 mb-4">
                     CarbonTrack provides an AI-powered analytics platform that enables users to: 
                  </p>
                  <ul className="list-disc pl-6 space-y-2 text-gray-600">
                    <li> Connect and analyze data from various sources </li>
                    <li>
                       Generate insights using artificial intelligence and machine learning 
                    </li>
                    <li> Create dashboards and visualizations </li>
                    <li> Collaborate with team members </li>
                    <li> Access data through APIs and integrations </li>
                  </ul>
                  <p className="text-gray-600 mt-4">
                     We may modify, suspend, or discontinue any aspect of the Services at any time, with or without notice. 
                  </p>
                </div>
                {/* Section 3 */}
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4"> 3. Account Registration </h2>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-6"> 3.1 Account Creation </h3>
                  <p className="text-gray-600 mb-4">
                     To use certain features of the Services, you must register for an account. You agree to provide accurate, current, and complete information during registration and to update such information as necessary. 
                  </p>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-6"> 3.2 Account Security </h3>
                  <p className="text-gray-600 mb-4">
                     You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must immediately notify us of any unauthorized use of your account. 
                  </p>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-6"> 3.3 Account Termination </h3>
                  <p className="text-gray-600 mb-4">
                     We reserve the right to suspend or terminate your account at any time for violations of these Terms or for any other reason at our sole discretion. 
                  </p>
                </div>
                {/* Section 4 */}
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4"> 4. Payment Terms </h2>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-6"> 4.1 Subscription Plans </h3>
                  <p className="text-gray-600 mb-4">
                     Access to certain features requires a paid subscription. Subscription fees are billed in advance on a monthly or annual basis, depending on the plan selected. 
                  </p>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-6"> 4.2 Payment Methods </h3>
                  <p className="text-gray-600 mb-4">
                     You authorize us to charge your selected payment method for all fees due. You are responsible for providing valid payment information and ensuring sufficient funds are available. 
                  </p>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-6"> 4.3 Price Changes </h3>
                  <p className="text-gray-600 mb-4">
                     We may change our pricing at any time. Price changes will take effect at the start of the next billing cycle following notice of the change. 
                  </p>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-6"> 4.4 Refunds </h3>
                  <p className="text-gray-600 mb-4">
                     Subscription fees are non-refundable, except as required by law or as explicitly stated in these Terms. We may offer refunds at our discretion. 
                  </p>
                </div>
                {/* Section 5 */}
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4"> 5. User Content and Data </h2>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-6"> 5.1 Your Data </h3>
                  <p className="text-gray-600 mb-4">
                     You retain all rights to the data you upload, store, or process through our Services ("Your Data"). You grant us a limited license to use Your Data solely to provide and improve the Services. 
                  </p>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-6"> 5.2 Responsibility for Content </h3>
                  <p className="text-gray-600 mb-4">
                     You are solely responsible for Your Data and its compliance with applicable laws. You represent that you have all necessary rights to Your Data and that Your Data does not violate any third-party rights. 
                  </p>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-6"> 5.3 Data Processing </h3>
                  <p className="text-gray-600 mb-4">
                     We process Your Data in accordance with our 
                    <Link className="text-primary hover:underline" href="/privacy"> Privacy Policy </Link>
                     and applicable data protection laws. 
                  </p>
                </div>
                {/* Section 6 */}
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4"> 6. Acceptable Use </h2>
                  <p className="text-gray-600 mb-4"> You agree not to: </p>
                  <ul className="list-disc pl-6 space-y-2 text-gray-600">
                    <li> Use the Services for any illegal or unauthorized purpose </li>
                    <li> Violate any laws, regulations, or third-party rights </li>
                    <li> Interfere with or disrupt the Services or servers </li>
                    <li>
                       Attempt to gain unauthorized access to any part of the Services 
                    </li>
                    <li>
                       Use the Services to transmit malware, spam, or harmful code 
                    </li>
                    <li>
                       Reverse engineer, decompile, or disassemble any part of the Services 
                    </li>
                    <li> Copy, modify, or create derivative works of the Services </li>
                    <li> Share your account credentials with third parties </li>
                    <li> Exceed any rate limits or usage quotas </li>
                  </ul>
                </div>
                {/* Section 7 */}
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4"> 7. Intellectual Property </h2>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-6"> 7.1 Our Intellectual Property </h3>
                  <p className="text-gray-600 mb-4">
                     The Services, including all content, features, and functionality, are owned by CarbonTrack and are protected by copyright, trademark, and other intellectual property laws. 
                  </p>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-6"> 7.2 Limited License </h3>
                  <p className="text-gray-600 mb-4">
                     Subject to these Terms, we grant you a limited, non-exclusive, non-transferable license to access and use the Services for your internal business purposes. 
                  </p>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-6"> 7.3 Feedback </h3>
                  <p className="text-gray-600 mb-4">
                     If you provide us with feedback or suggestions about the Services, you grant us the right to use such feedback without restriction or compensation. 
                  </p>
                </div>
                {/* Section 8 */}
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4"> 8. Disclaimers </h2>
                  <p className="text-gray-600 mb-4 uppercase">
                     THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. 
                  </p>
                  <p className="text-gray-600">
                     We do not warrant that the Services will be uninterrupted, error-free, or secure, or that any defects will be corrected. AI-generated insights are provided for informational purposes only and should not be relied upon as the sole basis for business decisions. 
                  </p>
                </div>
                {/* Section 9 */}
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4"> 9. Limitation of Liability </h2>
                  <p className="text-gray-600 mb-4 uppercase">
                     TO THE MAXIMUM EXTENT PERMITTED BY LAW, CarbonTrack SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY. 
                  </p>
                  <p className="text-gray-600">
                     Our total liability for any claims arising out of or relating to these Terms or the Services shall not exceed the amount you paid us in the twelve (12) months preceding the claim. 
                  </p>
                </div>
                {/* Section 10 */}
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4"> 10. Indemnification </h2>
                  <p className="text-gray-600">
                     You agree to indemnify, defend, and hold harmless CarbonTrack and its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including attorneys' fees) arising out of your use of the Services, your violation of these Terms, or your violation of any third-party rights. 
                  </p>
                </div>
                {/* Section 11 */}
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4"> 11. Governing Law and Disputes </h2>
                  <p className="text-gray-600 mb-4">
                     These Terms are governed by the laws of the State of California, without regard to its conflict of law provisions. 
                  </p>
                  <p className="text-gray-600">
                     Any disputes arising from these Terms or the Services shall be resolved through binding arbitration in San Francisco, California, in accordance with the rules of the American Arbitration Association. 
                  </p>
                </div>
                {/* Section 12 */}
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4"> 12. Changes to Terms </h2>
                  <p className="text-gray-600">
                     We may revise these Terms at any time by posting the updated Terms on this page. By continuing to use the Services after revisions become effective, you agree to be bound by the revised Terms. If you do not agree to the new Terms, you must stop using the Services. 
                  </p>
                </div>
                {/* Section 13 */}
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4"> 13. General Provisions </h2>
                  <ul className="list-disc pl-6 space-y-2 text-gray-600">
                    <li>
                      <strong> Entire Agreement: </strong>
                       These Terms constitute the entire agreement between you and CarbonTrack regarding the Services. 
                    </li>
                    <li>
                      <strong> Severability: </strong>
                       If any provision of these Terms is found to be unenforceable, the remaining provisions will remain in effect. 
                    </li>
                    <li>
                      <strong> Waiver: </strong>
                       Our failure to enforce any right or provision of these Terms will not constitute a waiver of such right or provision. 
                    </li>
                    <li>
                      <strong> Assignment: </strong>
                       You may not assign or transfer these Terms without our prior written consent. We may assign these Terms without restriction. 
                    </li>
                  </ul>
                </div>
                {/* Contact Section */}
                <div className="glass-card rounded-2xl p-8 mt-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4"> Contact Us </h2>
                  <p className="text-gray-600 mb-4">
                     If you have any questions about these Terms, please contact us: 
                  </p>
                  <ul className="space-y-2 text-gray-600">
                    <li>
                      <strong> Email: </strong>
                      <Link className="text-primary hover:underline" href="mailto:legal@CarbonTrack.com"> legal@CarbonTrack.com </Link>
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
