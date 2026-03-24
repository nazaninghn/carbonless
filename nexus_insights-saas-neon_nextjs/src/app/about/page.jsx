'use client';

import Header from '@/components/Header';
import { useLanguage } from '@/lib/i18n/LanguageContext';

import { useState, useEffect } from 'react';
import NextLink from 'next/link';
import { ArrowRight } from 'lucide-react';
import { CheckCircle } from 'lucide-react';
import { Heart } from 'lucide-react';
import { Image } from '@/components/Image';
import { Lightbulb } from 'lucide-react';
import { Link } from '@/components/Link';
import { Linkedin } from 'lucide-react';
import { Menu } from 'lucide-react';
import { Newspaper } from 'lucide-react';
import { Sparkles } from 'lucide-react';
import { Text } from '@/components/Text';
import { Twitter } from 'lucide-react';
import { Users } from 'lucide-react';
import { X } from 'lucide-react';
import { Youtube } from 'lucide-react';

export default function Page() {
  const { t } = useLanguage();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);  return (
    <div className="bg-white text-gray-900 antialiased overflow-x-hidden">
      <>
        <Header />
        <main>
          {/* Making Data Accessible To Everyone */}
          <section id="making_data_accessible_to_everyone" className="pt-24 lg:pt-[193px] pb-16 lg:pb-28 bg-gradient-to-b from-gray-50 to-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div data-aos="fade-up" className="text-center max-w-3xl mx-auto">
                <Text className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full mb-4"> About Us </Text>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
                   Making Data 
                  <Text className="gradient-text"> Accessible to Everyone </Text>
                </h1>
                <p className="text-lg text-gray-600">
                   We believe every team deserves powerful analytics tools. Our mission is to democratize data intelligence through AI. 
                </p>
              </div>
            </div>
          </section>
          {/* Our Story */}
          <section id="our_story" className="py-20 lg:py-28">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                <div data-aos="fade-right">
                  <Image className="rounded-2xl shadow-2xl" src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=600&fit=crop" alt="Team collaboration" />
                </div>
                <div data-aos="fade-left">
                  <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-gray-900"> Our Story </h2>
                  <p className="text-lg text-gray-600 mb-6">
                     CarbonTrack was founded in 2021 by a team of data scientists and engineers who were frustrated by the complexity of traditional analytics tools. 
                  </p>
                  <p className="text-lg text-gray-600 mb-6">
                     We saw teams struggling with expensive, complicated software that required dedicated analysts to operate. Small and medium businesses were left behind, unable to compete with data-driven enterprises. 
                  </p>
                  <p className="text-lg text-gray-600">
                     Our solution: build an AI-powered platform that does the heavy lifting, making advanced analytics accessible to everyone—not just data experts. 
                  </p>
                </div>
              </div>
            </div>
          </section>
          {/* Stats Section */}
          <section id="stats_section" className="py-20 lg:py-28 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div data-aos="fade-up" className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="text-center">
                  <p className="text-4xl sm:text-5xl font-bold gradient-text mb-2"> 2,500+ </p>
                  <p className="text-gray-600"> Teams using CarbonTrack </p>
                </div>
                <div className="text-center">
                  <p className="text-4xl sm:text-5xl font-bold gradient-text mb-2"> 50M+ </p>
                  <p className="text-gray-600"> Queries processed daily </p>
                </div>
                <div className="text-center">
                  <p className="text-4xl sm:text-5xl font-bold gradient-text mb-2"> 99.99% </p>
                  <p className="text-gray-600"> Platform uptime </p>
                </div>
                <div className="text-center">
                  <p className="text-4xl sm:text-5xl font-bold gradient-text mb-2"> 35+ </p>
                  <p className="text-gray-600"> Countries served </p>
                </div>
              </div>
            </div>
          </section>
          {/* Meet The People Behind CarbonTrack */}
          <section id="meet_the_people_behind_CarbonTrack" className="py-20 lg:py-28">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div data-aos="fade-up" className="text-center max-w-3xl mx-auto mb-16">
                <Text className="inline-block px-4 py-1.5 bg-secondary/10 text-secondary text-sm font-medium rounded-full mb-4"> Our Team </Text>
                <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-gray-900"> Meet the People Behind CarbonTrack </h2>
                <p className="text-lg text-gray-600">
                   A diverse team of experts passionate about making data accessible. 
                </p>
              </div>
              <div data-aos="fade-up" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {/* Team Member 1 */}
                <div className="glass-card rounded-2xl p-6 text-center hover:shadow-xl transition-shadow">
                  <Image variant="cover" className="w-24 h-24 rounded-full mx-auto mb-4 object-cover" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=face" alt="James Chen" />
                  <h4 className="text-lg font-semibold text-gray-900"> James Chen </h4>
                  <p className="text-primary font-medium text-sm mb-3"> CEO & Co-Founder </p>
                  <p className="text-gray-600 text-sm mb-4">
                     Former Google AI researcher with 15+ years in machine learning. 
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <Link className="text-gray-400 hover:text-primary transition-colors" href="https://twitter.com"><Twitter className="w-5 h-5" /></Link>
                    <Link className="text-gray-400 hover:text-primary transition-colors" href="https://linkedin.com"><Linkedin className="w-5 h-5" /></Link>
                  </div>
                </div>
                {/* Team Member 2 */}
                <div className="glass-card rounded-2xl p-6 text-center hover:shadow-xl transition-shadow">
                  <Image variant="cover" className="w-24 h-24 rounded-full mx-auto mb-4 object-cover" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&h=300&fit=crop&crop=face" alt="Sarah Rodriguez" />
                  <h4 className="text-lg font-semibold text-gray-900"> Sarah Rodriguez </h4>
                  <p className="text-primary font-medium text-sm mb-3"> CTO & Co-Founder </p>
                  <p className="text-gray-600 text-sm mb-4"> Ex-Meta engineer who built data infrastructure at scale. </p>
                  <div className="flex items-center justify-center gap-3">
                    <Link className="text-gray-400 hover:text-primary transition-colors" href="https://twitter.com"><Twitter className="w-5 h-5" /></Link>
                    <Link className="text-gray-400 hover:text-primary transition-colors" href="https://linkedin.com"><Linkedin className="w-5 h-5" /></Link>
                  </div>
                </div>
                {/* Team Member 3 */}
                <div className="glass-card rounded-2xl p-6 text-center hover:shadow-xl transition-shadow">
                  <Image variant="cover" className="w-24 h-24 rounded-full mx-auto mb-4 object-cover" src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&h=300&fit=crop&crop=face" alt="Michael Park" />
                  <h4 className="text-lg font-semibold text-gray-900"> Michael Park </h4>
                  <p className="text-primary font-medium text-sm mb-3"> VP of Product </p>
                  <p className="text-gray-600 text-sm mb-4"> Product leader with experience at Stripe and Figma. </p>
                  <div className="flex items-center justify-center gap-3">
                    <Link className="text-gray-400 hover:text-primary transition-colors" href="https://twitter.com"><Twitter className="w-5 h-5" /></Link>
                    <Link className="text-gray-400 hover:text-primary transition-colors" href="https://linkedin.com"><Linkedin className="w-5 h-5" /></Link>
                  </div>
                </div>
                {/* Team Member 4 */}
                <div className="glass-card rounded-2xl p-6 text-center hover:shadow-xl transition-shadow">
                  <Image variant="cover" className="w-24 h-24 rounded-full mx-auto mb-4 object-cover" src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300&h=300&fit=crop&crop=face" alt="Emily Watson" />
                  <h4 className="text-lg font-semibold text-gray-900"> Emily Watson </h4>
                  <p className="text-primary font-medium text-sm mb-3"> VP of Customer Success </p>
                  <p className="text-gray-600 text-sm mb-4"> 10+ years helping enterprise teams succeed with data. </p>
                  <div className="flex items-center justify-center gap-3">
                    <Link className="text-gray-400 hover:text-primary transition-colors" href="https://twitter.com"><Twitter className="w-5 h-5" /></Link>
                    <Link className="text-gray-400 hover:text-primary transition-colors" href="https://linkedin.com"><Linkedin className="w-5 h-5" /></Link>
                  </div>
                </div>
              </div>
            </div>
          </section>
          {/* What We Stand For */}
          <section id="what_we_stand_for" className="py-20 lg:py-28 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div data-aos="fade-up" className="text-center max-w-3xl mx-auto mb-16">
                <Text className="inline-block px-4 py-1.5 bg-accent/10 text-accent text-sm font-medium rounded-full mb-4"> Our Values </Text>
                <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-gray-900"> What We Stand For </h2>
              </div>
              <div data-aos="fade-up" className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="glass-card rounded-2xl p-8">
                  <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-6"><Heart className="w-7 h-7 text-primary" /></div>
                  <h4 className="text-xl font-semibold text-gray-900 mb-3"> Customer Obsession </h4>
                  <p className="text-gray-600">
                     We start with our customers and work backwards. Every feature we build is designed to solve real problems. 
                  </p>
                </div>
                <div className="glass-card rounded-2xl p-8">
                  <div className="w-14 h-14 bg-secondary/10 rounded-xl flex items-center justify-center mb-6"><Lightbulb className="w-7 h-7 text-secondary" /></div>
                  <h4 className="text-xl font-semibold text-gray-900 mb-3"> Innovation First </h4>
                  <p className="text-gray-600">
                     We push boundaries and challenge the status quo. If there's a better way, we'll find it. 
                  </p>
                </div>
                <div className="glass-card rounded-2xl p-8">
                  <div className="w-14 h-14 bg-accent/10 rounded-xl flex items-center justify-center mb-6"><Users className="w-7 h-7 text-accent" /></div>
                  <h4 className="text-xl font-semibold text-gray-900 mb-3"> Inclusive by Design </h4>
                  <p className="text-gray-600">
                     We believe analytics should be accessible to everyone, not just technical experts. 
                  </p>
                </div>
              </div>
            </div>
          </section>
          {/* Join Our Team */}
          <section id="join_our_team" className="py-20 lg:py-28">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                <div data-aos="fade-right">
                  <Text className="inline-block px-4 py-1.5 bg-green-100 text-green-700 text-sm font-medium rounded-full mb-4"> We're Hiring </Text>
                  <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-gray-900"> Join Our Team </h2>
                  <p className="text-lg text-gray-600 mb-8">
                     We're always looking for talented people who are passionate about data, AI, and building great products. Check out our open positions. 
                  </p>
                  <ul className="space-y-4 mb-8">
                    <li className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <Text className="text-gray-600"> Competitive salary & equity </Text>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <Text className="text-gray-600"> Remote-first culture </Text>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <Text className="text-gray-600"> Unlimited PTO </Text>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <Text className="text-gray-600"> Health, dental & vision </Text>
                    </li>
                  </ul>
                  <Link variant="inline" contentKey="cta_49" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors" href="/contact"> View Open Positions 
                  <ArrowRight className="w-5 h-5" /></Link>
                </div>
                <div data-aos="fade-left">
                  <Image className="rounded-2xl shadow-2xl" src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&h=600&fit=crop" alt="Team working together" />
                </div>
              </div>
            </div>
          </section>
          {/* In The Press */}
          <section id="in_the_press" className="py-20 lg:py-28 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div data-aos="fade-up" className="text-center max-w-3xl mx-auto mb-16">
                <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-gray-900"> In the Press </h2>
                <p className="text-lg text-gray-600"> See what others are saying about CarbonTrack </p>
              </div>
              <div data-aos="fade-up" className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="glass-card rounded-2xl p-6">
                  <div className="flex items-center gap-2 text-gray-400 mb-4">
                    <Newspaper className="w-5 h-5" />
                    <Text className="font-medium"> TechCrunch </Text>
                  </div>
                  <p className="text-gray-700 mb-4">
                     "CarbonTrack is democratizing data analytics in a way we haven't seen before." 
                  </p>
                  <Link className="text-primary font-medium text-sm hover:underline" href="/"> Read Article → </Link>
                </div>
                <div className="glass-card rounded-2xl p-6">
                  <div className="flex items-center gap-2 text-gray-400 mb-4">
                    <Newspaper className="w-5 h-5" />
                    <Text className="font-medium"> Forbes </Text>
                  </div>
                  <p className="text-gray-700 mb-4"> "One of the most promising AI startups to watch in 2024." </p>
                  <Link className="text-primary font-medium text-sm hover:underline" href="/"> Read Article → </Link>
                </div>
                <div className="glass-card rounded-2xl p-6">
                  <div className="flex items-center gap-2 text-gray-400 mb-4">
                    <Newspaper className="w-5 h-5" />
                    <Text className="font-medium"> Wired </Text>
                  </div>
                  <p className="text-gray-700 mb-4">
                     "Finally, AI-powered analytics that actually delivers on its promise." 
                  </p>
                  <Link className="text-primary font-medium text-sm hover:underline" href="/"> Read Article → </Link>
                </div>
              </div>
            </div>
          </section>
          {/* Ready To Transform Your Data Strategy */}
          <section id="ready_to_transform_your_data_strategy" className="py-20 lg:py-28 bg-gradient-to-r from-primary via-secondary to-accent">
            <div data-aos="fade-up" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6"> Ready to Transform Your Data Strategy? </h2>
              <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
                 Join thousands of teams using CarbonTrack to make better decisions. 
              </p>
              <NextLink href="/pricing" className="inline-block px-8 py-4 bg-white text-primary font-semibold rounded-xl hover:bg-gray-100 transition-colors shadow-lg"> Get Started Free </NextLink>
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
