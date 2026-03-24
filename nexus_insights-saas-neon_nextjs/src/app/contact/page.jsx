'use client';

import Header from '@/components/Header';
import { useLanguage } from '@/lib/i18n/LanguageContext';

import { useState, useEffect } from 'react';
import { BookOpen } from 'lucide-react';
import { Briefcase } from 'lucide-react';
import { Button } from '@/components/Button';
import { CheckCircle } from 'lucide-react';
import { FileText } from 'lucide-react';
import { HelpCircle } from 'lucide-react';
import { Image } from '@/components/Image';
import { Input } from '@/components/Input';
import { Link } from '@/components/Link';
import { Mail } from 'lucide-react';
import { MapPin } from 'lucide-react';
import { Menu } from 'lucide-react';
import { MessageCircle } from 'lucide-react';
import { Phone } from 'lucide-react';
import { Send } from 'lucide-react';
import { Sparkles } from 'lucide-react';
import { Text } from '@/components/Text';
import { X } from 'lucide-react';
import { Youtube } from 'lucide-react';

export default function Page() {
  const { t } = useLanguage();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const handleFormdataSubjectChange = (e) => setFormdataSubject(e.target.value);
  const handleFormdataMessageChange = (e) => setFormdataMessage(e.target.value);  return (
    <div className="bg-white text-gray-900 antialiased overflow-x-hidden">
      <>
        <Header />
        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div onClick={() => { setMobileMenuOpen(false) }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"></div>
        )}
        {/* Mobile Menu Panel */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 bg-white z-50 lg:hidden h-[100vh]">
            <div className="flex flex-col h-full">
              {/* Mobile Menu Header */}
              <div className="flex items-center justify-between h-16 lg:h-20 px-6 border-b border-gray-200">
                <Link className="flex items-center gap-2" href="/"><div className="w-10 h-10 bg-gradient-to-br from-primary via-secondary to-accent rounded-xl flex items-center justify-center"><Sparkles className="w-6 h-6 text-white" /></div>
                <Text variant="bold" className="text-xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent"> CarbonTrack </Text></Link>
                <button onClick={() => { setMobileMenuOpen(false) }} aria-label="Close menu" className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"><X className="w-6 h-6 text-gray-600" /></button>
              </div>
              {/* Mobile Menu Links */}
              <nav className="flex-1 p-4 space-y-2">
                <Link contentKey="cta_34" className="block px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-xl font-medium transition-colors duration-200" href="/features"> Features </Link>
                <Link contentKey="cta_35" className="block px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-xl font-medium transition-colors duration-200" href="/register"> Pricing </Link>
                <Link contentKey="cta_36" className="block px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-xl font-medium transition-colors duration-200" href="/about"> About </Link>
                <Link contentKey="cta_37" className="block px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-xl font-medium transition-colors duration-200" href="/"> Blog </Link>
                <Link contentKey="cta_38" className="block px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-xl font-medium transition-colors duration-200" href="/contact"> Contact </Link>
              </nav>
              {/* Mobile Menu Footer */}
              <div className="p-4 border-t border-gray-200 space-y-3">
                <Link contentKey="cta_39" className="block w-full px-6 py-3 text-center text-gray-700 border border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition-colors duration-200" href="/register"> Login </Link>
                <Link contentKey="cta_40" className="block w-full px-6 py-3 text-center bg-gradient-to-r from-primary via-secondary to-accent text-white font-semibold rounded-xl hover:opacity-90 transition-opacity duration-200" href="/register"> Get Started </Link>
              </div>
            </div>
          </div>
        )}
        <main>
          {/* Lets Talk */}
          <section id="lets_talk" className="pt-24 lg:pt-[193px] pb-16 lg:pb-28 bg-gradient-to-b from-gray-50 to-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div data-aos="fade-up" className="text-center max-w-3xl mx-auto">
                <Text className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full mb-4"> Contact Us </Text>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 text-gray-900">
                   Let's 
                  <Text className="gradient-text"> Talk </Text>
                </h1>
                <p className="text-lg text-gray-600">
                   Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible. 
                </p>
              </div>
            </div>
          </section>
          {/* Send Us A Message */}
          <section id="send_us_a_message" className="py-20 lg:py-28">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* Contact Info Cards */}
                <div data-aos="fade-right" className="lg:col-span-1 space-y-6">
                  <div className="glass-card rounded-2xl p-6">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4"><Mail className="w-6 h-6 text-primary" /></div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2"> {t.footer.email} </h4>
                    <p className="text-gray-600 mb-2"> For general inquiries </p>
                    <Link className="text-primary font-medium hover:underline" href={`mailto:${t.company.email}`}> {t.company.email} </Link>
                  </div>
                  <div className="glass-card rounded-2xl p-6">
                    <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mb-4"><MapPin className="w-6 h-6 text-accent" /></div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2"> {t.footer.address} </h4>
                    <p className="text-gray-600">
                      {t.company.address}
                    </p>
                  </div>
                  <div className="glass-card rounded-2xl p-6">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                      <Phone className="w-6 h-6 text-green-600" />
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2"> {t.footer.phone} </h4>
                    <p className="text-gray-600 mb-2"> Mon-Fri 9am-6pm </p>
                    <Link className="text-primary font-medium hover:underline" href={`tel:${t.company.phone}`}> {t.company.phone} </Link>
                  </div>
                </div>
                {/* Contact Form */}
                <div data-aos="fade-left" className="lg:col-span-2">
                  <div className="glass-card rounded-2xl p-8 lg:p-10">
                    <h3 className="text-2xl font-bold text-gray-900 mb-6"> Send us a Message </h3>
                    <form onSubmit={(e) => { e.preventDefault(); submit }} className="space-y-6">
                      {/* Success Message */}
                      {submitted && (
                        <div className="p-4 bg-green-100 border border-green-200 rounded-xl text-green-700">
                          <div className="flex items-center gap-3">
                            <CheckCircle className="w-5 h-5" />
                            <Text> Thank you! We'll get back to you within 24 hours. </Text>
                          </div>
                        </div>
                      )}
                      {!submitted && (
                        <div className="space-y-6">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2"> Full Name * </label>
                              <Input variant="text" className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent transition-all" type="text" placeholder="John Doe" id="name" />
                              {errors.name && (
                                <p className="text-red-500 text-sm mt-1">{errors.name}</p>
                              )}
                            </div>
                            <div>
                              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2"> Email Address * </label>
                              <Input variant="text" className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent transition-all" type="email" placeholder="john@example.com" id="email" />
                              {errors.email && (
                                <p className="text-red-500 text-sm mt-1">{errors.email}</p>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                              <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-2"> Company </label>
                              <Input variant="text" className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent transition-all" type="text" placeholder="Your Company" id="company" />
                            </div>
                            <div>
                              <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2"> Subject * </label>
                              <select id="subject" value={formData.subject} onChange={handleFormdataSubjectChange} className={`w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent transition-all ${`${errors.subject ? 'border-red-500' : ''}`}`}>
                                <option value=""> Select a subject </option>
                                <option value="sales"> Sales Inquiry </option>
                                <option value="support"> Technical Support </option>
                                <option value="partnership"> Partnership </option>
                                <option value="press"> Press Inquiry </option>
                                <option value="other"> Other </option>
                              </select>
                              {errors.subject && (
                                <p className="text-red-500 text-sm mt-1">{errors.subject}</p>
                              )}
                            </div>
                          </div>
                          <div>
                            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2"> Message * </label>
                            <textarea id="message" placeholder="Tell us how we can help..." rows={5} value={formData.message} onChange={handleFormdataMessageChange} className={`w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none ${`${errors.message ? 'border-red-500' : ''}`}`}></textarea>
                            {errors.message && (
                              <p className="text-red-500 text-sm mt-1">{errors.message}</p>
                            )}
                          </div>
                          <Button variant="primary" contentKey="cta_41" className="w-full sm:w-auto px-8 py-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors flex items-center justify-center gap-2" type="submit"> Send Message 
                          <Send className="w-5 h-5" /></Button>
                        </div>
                      )}
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </section>
          {/* Looking For Quick Answers */}
          <section id="looking_for_quick_answers" className="py-20 lg:py-28 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div data-aos="fade-up" className="text-center max-w-3xl mx-auto mb-12">
                <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-gray-900"> Looking for Quick Answers? </h2>
                <p className="text-lg text-gray-600">
                   Check out our most common questions or browse our resources. 
                </p>
              </div>
              <div data-aos="fade-up" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <Link className="glass-card rounded-2xl p-6 text-center hover:shadow-xl transition-all group" href="index.html#faq"><div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform"><HelpCircle className="w-6 h-6 text-primary" /></div>
                <h4 className="font-semibold text-gray-900 mb-2"> FAQ </h4>
                <p className="text-sm text-gray-600"> Browse common questions </p></Link>
                <Link className="glass-card rounded-2xl p-6 text-center hover:shadow-xl transition-all group" href="features.html#api"><div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform"><BookOpen className="w-6 h-6 text-secondary" /></div>
                <h4 className="font-semibold text-gray-900 mb-2"> Documentation </h4>
                <p className="text-sm text-gray-600"> Technical guides & API </p></Link>
                <Link className="glass-card rounded-2xl p-6 text-center hover:shadow-xl transition-all group" href="/"><div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform"><FileText className="w-6 h-6 text-accent" /></div>
                <h4 className="font-semibold text-gray-900 mb-2"> Blog </h4>
                <p className="text-sm text-gray-600"> Tips & best practices </p></Link>
                <Link className="glass-card rounded-2xl p-6 text-center hover:shadow-xl transition-all group" href="about.html#careers"><div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Briefcase className="w-6 h-6 text-green-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2"> Careers </h4>
                <p className="text-sm text-gray-600"> Join our team </p></Link>
              </div>
            </div>
          </section>
          {/* Map Section */}
          <section id="map_section" className="py-20 lg:py-28">
            <div data-aos="fade-up" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="rounded-2xl overflow-hidden shadow-xl">
                <iframe allowfullscreen="" height="400" loading="lazy" src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3153.0869550752373!2d-122.40066128441554!3d37.78749397975738!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x808580627b5a8c7b%3A0x5e5c5b5b5b5b5b5b!2s548%20Market%20St%2C%20San%20Francisco%2C%20CA%2094104!5e0!3m2!1sen!2sus!4v1616000000000!5m2!1sen!2sus" style={{ border: "0" }} title="CarbonTrack Office Location" width="100%" className="grayscale"></iframe>
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
