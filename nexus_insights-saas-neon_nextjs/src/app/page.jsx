'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import Header from '@/components/Header';
import NextLink from 'next/link';
import { Activity } from 'lucide-react';
import { ArrowRight } from 'lucide-react';
import { BarChart3 } from 'lucide-react';
import { Brain } from 'lucide-react';
import { Check } from 'lucide-react';
import { ChevronDown } from 'lucide-react';
import { DollarSign } from 'lucide-react';
import { Globe } from 'lucide-react';
import { Hexagon } from 'lucide-react';
import { Icon } from '@/components/Icon';
import { Image } from '@/components/Image';
import { LayoutDashboard } from 'lucide-react';
import { LineChart } from 'lucide-react';
import { Link } from '@/components/Link';
import { Lock } from 'lucide-react';
import { Menu } from 'lucide-react';
import { PlayCircle } from 'lucide-react';
import { Puzzle } from 'lucide-react';
import { Rocket } from 'lucide-react';
import { Settings } from 'lucide-react';
import { ShieldCheck } from 'lucide-react';
import { Star } from 'lucide-react';
import { Text } from '@/components/Text';
import { TrendingUp } from 'lucide-react';
import { Users } from 'lucide-react';
import { X } from 'lucide-react';
import { Youtube } from 'lucide-react';

export default function Page() {
  const { language, changeLanguage, t } = useLanguage();
  const [activeAccordion, setActiveAccordion] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Remove any dark mode classes
    document.documentElement.classList.remove('dark');
  }, []);

  return (
    <div className="bg-white text-gray-900 antialiased overflow-x-hidden">
      <>
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 lg:h-20">
              {/* Logo */}
              <Link className="flex items-center gap-2" href="/"><img src="/carbonless.png" alt="Carbonless" className="h-10 w-auto" />
              <Text variant="bold" className="text-xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent"> {t.brandName} </Text></Link>
              {/* Desktop Navigation */}
              <nav className="hidden lg:flex items-center gap-8">
                <Link className="text-gray-600 hover:text-primary transition-colors duration-200 font-medium" href="/features"> {t.nav.features} </Link>
                <Link className="text-gray-600 hover:text-primary transition-colors duration-200 font-medium" href="/about"> {t.nav.about} </Link>
                <Link className="text-gray-600 hover:text-primary transition-colors duration-200 font-medium" href="/contact"> {t.nav.contact} </Link>
              </nav>
              {/* Desktop CTA & Dark Mode */}
              <div className="hidden lg:flex items-center gap-4">
                {/* Language Toggle */}
                <button onClick={() => changeLanguage(language === 'tr' ? 'en' : 'tr')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors duration-200 text-sm font-medium text-gray-600">
                  <Globe className="w-4 h-4" />
                  {language === 'tr' ? 'EN' : 'TR'}
                </button>
                <NextLink href="/login" className="text-gray-600 hover:text-primary transition-colors duration-200 font-medium"> {t.nav.login} </NextLink>
                <NextLink href="/register" className="relative group px-6 py-2.5 bg-gradient-to-r from-primary via-secondary to-accent text-white font-semibold rounded-xl overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-primary/25"><Text className="relative z-10"> {t.nav.register} </Text>
                <div className="absolute inset-0 bg-gradient-to-r from-accent via-primary to-secondary opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div></NextLink>
              </div>
              {/* Mobile Menu Button */}
              <div className="flex lg:hidden items-center gap-2">
                {/* Language Toggle (Mobile) */}
                <button onClick={() => changeLanguage(language === 'tr' ? 'en' : 'tr')} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors duration-200 text-sm font-medium text-gray-600">
                  <Globe className="w-4 h-4" />
                  {language === 'tr' ? 'EN' : 'TR'}
                </button>
                <button onClick={() => { setMobileMenuOpen(true) }} aria-label="Open menu" className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200">
                  <Menu className="w-6 h-6 text-gray-600" />
                </button>
              </div>
            </div>
          </div>
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
                  <Link className="flex items-center gap-2" href="/"><img src="/carbonless.png" alt="Carbonless" className="h-10 w-auto" />
                  <Text variant="bold" className="text-xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent"> {t.brandName} </Text></Link>
                  <button onClick={() => { setMobileMenuOpen(false) }} aria-label="Close menu" className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"><X className="w-6 h-6 text-gray-600" /></button>
                </div>
                {/* Mobile Menu Links */}
                <nav className="flex-1 p-4 space-y-2">
                  <Link contentKey="cta_56" className="block px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-xl font-medium transition-colors duration-200" href="/features"> {t.nav.features} </Link>
                  <Link contentKey="cta_58" className="block px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-xl font-medium transition-colors duration-200" href="/about"> {t.nav.about} </Link>
                  <Link contentKey="cta_60" className="block px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-xl font-medium transition-colors duration-200" href="/contact"> {t.nav.contact} </Link>
                </nav>
                {/* Mobile Menu Footer */}
                <div className="p-4 border-t border-gray-200 space-y-3">
                  <NextLink href="/login" className="block w-full px-6 py-3 text-center text-gray-700 border border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition-colors duration-200"> {t.nav.login} </NextLink>
                  <NextLink href="/register" className="block w-full px-6 py-3 text-center bg-gradient-to-r from-primary via-secondary to-accent text-white font-semibold rounded-xl hover:opacity-90 transition-opacity duration-200"> {t.nav.register} </NextLink>
                </div>
              </div>
            </div>
          )}
        </header>
        <main>
          {/* Hero Section */}
          <section id="hero" className="relative min-h-screen flex items-center overflow-hidden">
            {/* Animated Mesh Gradient Background */}
            <div className="absolute inset-0 mesh-gradient"></div>
            <div className="absolute inset-0 bg-white/50"></div>
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 lg:pt-[193px] pb-16 lg:pb-32">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                {/* Content */}
                <div data-aos="fade-right" className="text-center lg:text-left">
                  {/* Badge */}
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-6">
                    <Text className="text-sm font-medium text-primary"> {t.hero.badge} </Text>
                  </div>
                  {/* Headline */}
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                     {t.hero.title} 
                    <Text className="gradient-text"> {t.hero.titleHighlight} </Text>
                  </h1>
                  {/* Subheadline */}
                  <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-lg mx-auto lg:mx-0">
                     {t.hero.subtitle} 
                  </p>
                  {/* CTAs */}
                  <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                    <NextLink href="/register" className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-primary via-secondary to-accent text-white font-semibold rounded-xl hover:scale-105 transition-all duration-300 shadow-lg shadow-primary/25 shine-effect text-center"> {t.hero.ctaPrimary} </NextLink>
                    <Link contentKey="cta_64" className="w-full sm:w-auto px-8 py-4 bg-white border border-gray-200 font-semibold rounded-xl hover:bg-gray-50 transition-all duration-300 flex items-center justify-center gap-2" href="/about"><PlayCircle className="w-5 h-5 text-primary" />
                     {t.hero.ctaSecondary} </Link>
                  </div>
                </div>
                {/* Product Mockup - Dashboard Component */}
                <div data-aos="fade-left" className="relative">
                  <div className="relative float-animation">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/30 via-secondary/30 to-accent/30 rounded-3xl blur-3xl"></div>
                    {/* Dashboard UI Component */}
                    <div className="relative rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
                      {/* Browser Chrome */}
                      <div className="bg-gray-900 px-4 py-2.5 flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-red-500"></div>
                          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        </div>
                        <div className="flex-1 bg-gray-800 rounded-md px-3 py-1 flex items-center gap-2">
                          <Lock className="w-3 h-3 text-green-400" />
                          <Text className="text-gray-400 text-xs"> app.Carbonless.com/dashboard </Text>
                        </div>
                      </div>
                      {/* Dashboard Layout */}
                      <div className="flex bg-gray-100">
                        {/* Sidebar */}
                        <div className="w-14 bg-white border-r border-gray-200 py-4 flex flex-col items-center gap-4">
                          <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center"><Hexagon className="w-4 h-4 text-white" /></div>
                          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center"><LayoutDashboard className="w-4 h-4 text-primary" /></div>
                          <div className="w-8 h-8 hover:bg-gray-100 rounded-lg flex items-center justify-center"><BarChart3 className="w-4 h-4 text-gray-400" /></div>
                          <div className="w-8 h-8 hover:bg-gray-100 rounded-lg flex items-center justify-center"><Users className="w-4 h-4 text-gray-400" /></div>
                          <div className="w-8 h-8 hover:bg-gray-100 rounded-lg flex items-center justify-center"><Settings className="w-4 h-4 text-gray-400" /></div>
                        </div>
                        {/* Main Content */}
                        <div className="flex-1 p-4 space-y-4">
                          {/* Header */}
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold text-gray-900 text-sm"> {t.hero.dashboard} </h4>
                              <p className="text-xs text-gray-500"> {t.hero.welcomeBack}, Alex </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Text className="px-2 py-1 bg-green-100 text-green-600 text-xs font-medium rounded-full flex items-center gap-1"><Text className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                               {t.hero.live} </Text>
                            </div>
                          </div>
                          {/* Stats Grid */}
                          <div className="grid grid-cols-3 gap-3">
                            <div className="bg-white rounded-xl p-3 border border-gray-200">
                              <div className="flex items-center justify-between mb-2">
                                <Text className="text-xs text-gray-500"> {t.hero.carbonEmissions} </Text>
                                <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center"><Activity className="w-3 h-3 text-primary" /></div>
                              </div>
                              <p className="text-lg font-bold text-gray-900"> 284 t </p>
                              <p className="text-xs text-green-500 flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" />
                                 -15% 
                              </p>
                            </div>
                            <div className="bg-white rounded-xl p-3 border border-gray-200">
                              <div className="flex items-center justify-between mb-2">
                                <Text className="text-xs text-gray-500"> {t.hero.energyUsage} </Text>
                                <div className="w-6 h-6 bg-secondary/10 rounded-lg flex items-center justify-center"><BarChart3 className="w-3 h-3 text-secondary" /></div>
                              </div>
                              <p className="text-lg font-bold text-gray-900"> 12.8K </p>
                              <p className="text-xs text-green-500 flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" />
                                 -8.2% 
                              </p>
                            </div>
                            <div className="bg-white rounded-xl p-3 border border-gray-200">
                              <div className="flex items-center justify-between mb-2">
                                <Text className="text-xs text-gray-500"> {t.hero.reduction} </Text>
                                <div className="w-6 h-6 bg-accent/10 rounded-lg flex items-center justify-center"><TrendingUp className="w-3 h-3 text-accent" /></div>
                              </div>
                              <p className="text-lg font-bold text-gray-900"> -24% </p>
                              <p className="text-xs text-green-500 flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" />
                                 +5.1% 
                              </p>
                            </div>
                          </div>
                          {/* Chart Card */}
                          <div className="bg-white rounded-xl p-4 border border-gray-200">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-semibold text-gray-900"> {t.hero.performance} </h4>
                                <Text className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded"> AI </Text>
                              </div>
                              <div className="flex items-center gap-1 text-xs">
                                <Text className="px-2 py-1 bg-gray-100 text-gray-900 rounded font-medium"> 7D </Text>
                                <Text className="px-2 py-1 text-gray-400"> 30D </Text>
                                <Text className="px-2 py-1 text-gray-400"> 90D </Text>
                              </div>
                            </div>
                            {/* Area Chart SVG */}
                            <div className="h-28 relative">
                              <Icon className="w-full h-full" viewBox="0 0 400 100"><defs>
                                <linearGradient id="chartGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                                  <stop offset="0%" style={{ stopColor: "#7C3AED", stopOpacity: "0.3" }}></stop>
                                  <stop offset="100%" style={{ stopColor: "#7C3AED", stopOpacity: "0" }}></stop>
                                </linearGradient>
                                <linearGradient id="lineGradient" x1="0%" x2="100%" y1="0%" y2="0%">
                                  <stop offset="0%" style={{ stopColor: "#7C3AED" }}></stop>
                                  <stop offset="50%" style={{ stopColor: "#0EA5E9" }}></stop>
                                  <stop offset="100%" style={{ stopColor: "#EC4899" }}></stop>
                                </linearGradient>
                              </defs>
                              {/* Area fill */}
                              <path d="M0,80 Q50,70 100,50 T200,30 T300,45 T400,20 L400,100 L0,100 Z" fill="url(#chartGradient)"></path>
                              {/* Line */}
                              <path d="M0,80 Q50,70 100,50 T200,30 T300,45 T400,20" fill="none" stroke="url(#lineGradient)" strokeLinecap="round" strokeWidth="2.5"></path>
                              {/* Data points */}
                              <circle cx="0" cy="80" fill="#7C3AED" r="4"></circle>
                              <circle cx="100" cy="50" fill="#7C3AED" r="4"></circle>
                              <circle cx="200" cy="30" fill="#0EA5E9" r="4"></circle>
                              <circle cx="300" cy="45" fill="#0EA5E9" r="4"></circle>
                              <circle cx="400" cy="20" fill="#EC4899" r="5" stroke="white" strokeWidth="2"></circle></Icon>
                              {/* Current value tooltip */}
                              <div className="absolute top-0 right-0 bg-gray-900 text-white text-xs font-medium px-2 py-1 rounded shadow-lg"> $84.2K </div>
                            </div>
                            {/* Chart Labels */}
                            <div className="flex justify-between mt-2 text-xs text-gray-400">
                              <Text> Mon </Text>
                              <Text> Tue </Text>
                              <Text> Wed </Text>
                              <Text> Thu </Text>
                              <Text> Fri </Text>
                              <Text> Sat </Text>
                              <Text> Sun </Text>
                            </div>
                          </div>
                          {/* AI Insight */}
                          <div className="bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10 rounded-xl p-3 border border-primary/20">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center flex-shrink-0"></div>
                              <div>
                                <p className="text-xs font-medium text-gray-900"> AI Insight </p>
                                <p className="text-xs text-gray-600">
                                   {t.hero.aiInsight}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Floating Stats Card */}
                  <div data-aos="fade-up" data-aos-delay="200" className="absolute -bottom-6 -left-6 glass-card rounded-xl p-4 shadow-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900"> -24% </p>
                        <p className="text-sm text-gray-500"> {t.hero.carbonReduction} </p>
                      </div>
                    </div>
                  </div>
                  {/* Floating AI Card */}
                  <div data-aos="fade-down" data-aos-delay="400" className="absolute -top-6 -right-6 glass-card rounded-xl p-4 shadow-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center"><Brain className="w-6 h-6 text-primary" /></div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900"> {t.hero.aiAnalysis} </p>
                        <p className="text-xs text-gray-500"> {t.hero.realtimeTracking} </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
          {/* Everything You Need To Succeed */}
          <section id="everything_you_need_to_succeed" className="py-20 lg:py-28">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {/* Section Header */}
              <div data-aos="fade-up" className="text-center max-w-3xl mx-auto mb-16">
                <Text className="inline-block px-4 py-1.5 bg-secondary/10 text-secondary text-sm font-medium rounded-full mb-4"> Features </Text>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
                   Everything You Need to 
                  <Text className="gradient-text"> Succeed </Text>
                </h2>
                <p className="text-lg text-gray-600">
                   Powerful features designed to help you analyze, predict, and act on your data with confidence. 
                </p>
              </div>
              {/* Features Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                {/* Feature 1 */}
                <div data-aos="fade-up" data-aos-delay="0" className="glass-card rounded-2xl p-6 lg:p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                  <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300"><Brain className="w-7 h-7 text-primary" /></div>
                  <h3 className="text-xl font-semibold mb-3 text-gray-900"> AI-Powered Analytics </h3>
                  <p className="text-gray-600">
                     Advanced machine learning algorithms analyze your data and surface insights you'd never find manually. 
                  </p>
                </div>
                {/* Feature 2 */}
                <div data-aos="fade-up" data-aos-delay="100" className="glass-card rounded-2xl p-6 lg:p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                  <div className="w-14 h-14 bg-gradient-to-br from-secondary/20 to-secondary/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300"><Activity className="w-7 h-7 text-secondary" /></div>
                  <h3 className="text-xl font-semibold mb-3 text-gray-900"> Real-Time Monitoring </h3>
                  <p className="text-gray-600">
                     Track your metrics in real-time with live dashboards that update automatically as data flows in. 
                  </p>
                </div>
                {/* Feature 3 */}
                <div data-aos="fade-up" data-aos-delay="200" className="glass-card rounded-2xl p-6 lg:p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                  <div className="w-14 h-14 bg-gradient-to-br from-accent/20 to-accent/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300"><LineChart className="w-7 h-7 text-accent" /></div>
                  <h3 className="text-xl font-semibold mb-3 text-gray-900"> Predictive Forecasting </h3>
                  <p className="text-gray-600">
                     Forecast future trends with AI models trained on your historical data for accurate predictions. 
                  </p>
                </div>
                {/* Feature 4 */}
                <div data-aos="fade-up" data-aos-delay="300" className="glass-card rounded-2xl p-6 lg:p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                  <div className="w-14 h-14 bg-gradient-to-br from-green-500/20 to-green-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300"><ShieldCheck className="w-7 h-7 text-green-500" /></div>
                  <h3 className="text-xl font-semibold mb-3 text-gray-900"> Enterprise Security </h3>
                  <p className="text-gray-600">
                     SOC 2 Type II certified with end-to-end encryption. Your data is always protected. 
                  </p>
                </div>
                {/* Feature 5 */}
                <div data-aos="fade-up" data-aos-delay="400" className="glass-card rounded-2xl p-6 lg:p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                  <div className="w-14 h-14 bg-gradient-to-br from-orange-500/20 to-orange-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300"><Puzzle className="w-7 h-7 text-orange-500" /></div>
                  <h3 className="text-xl font-semibold mb-3 text-gray-900"> 100+ Integrations </h3>
                  <p className="text-gray-600">
                     Connect with your favorite tools seamlessly. From Salesforce to Slack, we've got you covered. 
                  </p>
                </div>
                {/* Feature 6 */}
                <div data-aos="fade-up" data-aos-delay="500" className="glass-card rounded-2xl p-6 lg:p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-500/20 to-purple-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300"><Users className="w-7 h-7 text-purple-500" /></div>
                  <h3 className="text-xl font-semibold mb-3 text-gray-900"> Team Collaboration </h3>
                  <p className="text-gray-600">
                     Share dashboards, annotate insights, and collaborate in real-time with your entire team. 
                  </p>
                </div>
              </div>
              {/* View All Features CTA */}
              <div data-aos="fade-up" className="text-center mt-12">
                <Link variant="inline" className="inline-flex items-center gap-2 text-primary hover:text-primary-700 font-semibold transition-colors duration-200" href="features.html"> Explore All Features 
                <ArrowRight className="w-5 h-5" /></Link>
              </div>
            </div>
          </section>
          {/* Make Data Driven Decisions With Confidence */}
          <section id="make_data_driven_decisions_with_confidence" className="py-20 lg:py-28 bg-gradient-to-b from-gray-50 to-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                {/* Analytics Component */}
                <div data-aos="fade-right" className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10 rounded-3xl blur-2xl"></div>
                  {/* Analytics Dashboard Component */}
                  <div className="relative glass-card rounded-2xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="bg-white px-6 py-4 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center"><BarChart3 className="w-5 h-5 text-white" /></div>
                          <div>
                            <h4 className="font-semibold text-gray-900 text-sm"> Performance Metrics </h4>
                            <p className="text-xs text-gray-500"> Last updated: Just now </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Text className="px-2 py-1 bg-green-100 text-green-600 text-xs font-medium rounded-full flex items-center gap-1"><Text className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                           Live </Text>
                        </div>
                      </div>
                    </div>
                    {/* Content */}
                    <div className="bg-white p-6">
                      {/* Main Metric */}
                      <div className="text-center mb-6">
                        <p className="text-4xl font-bold text-gray-900 mb-1"> 94.7% </p>
                        <p className="text-sm text-gray-500"> Overall Performance Score </p>
                      </div>
                      {/* Circular Progress Ring */}
                      <div className="flex justify-center mb-6">
                        <div className="relative w-40 h-40">
                          <Icon className="w-full h-full transform -rotate-90"><circle cx="80" cy="80" fill="none" r="70" stroke="currentColor" strokeWidth="8" className="text-gray-100"></circle>
                          <circle cx="80" cy="80" fill="none" r="70" stroke="url(#gradient1)" stroke-dasharray="440" stroke-dashoffset="23" strokeLinecap="round" strokeWidth="8" className="transition-all duration-1000"></circle>
                          <defs>
                            <linearGradient id="gradient1" x1="0%" x2="100%" y1="0%" y2="0%">
                              <stop offset="0%" style={{ stopColor: "#7C3AED" }}></stop>
                              <stop offset="50%" style={{ stopColor: "#0EA5E9" }}></stop>
                              <stop offset="100%" style={{ stopColor: "#EC4899" }}></stop>
                            </linearGradient>
                          </defs></Icon>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                              
                              <p className="text-xs text-gray-500"> AI Score </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Metric Bars */}
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <Text className="text-gray-600"> Data Accuracy </Text>
                            <Text className="font-medium text-gray-900"> 98% </Text>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div style={{ width: "98%" }} className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <Text className="text-gray-600"> Processing Speed </Text>
                            <Text className="font-medium text-gray-900"> 92% </Text>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div style={{ width: "92%" }} className="h-full bg-gradient-to-r from-secondary to-accent rounded-full"></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <Text className="text-gray-600"> Prediction Rate </Text>
                            <Text className="font-medium text-gray-900"> 89% </Text>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div style={{ width: "89%" }} className="h-full bg-gradient-to-r from-accent to-primary rounded-full"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Content */}
                <div data-aos="fade-left">
                  <Text className="inline-block px-4 py-1.5 bg-accent/10 text-accent text-sm font-medium rounded-full mb-4"> {t.features.whyUs}
                                  </Text>
                  <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-gray-900">
                     {t.features.whyTitle}
                  </h2>
                  <p className="text-lg text-gray-600 mb-8">
                     Our platform combines the power of artificial intelligence with intuitive design, making complex analytics
                                    accessible to everyone on your team. 
                  </p>
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900"> Instant Setup </h4>
                        <p className="text-gray-600">
                           Get started in minutes with our guided onboarding process. 
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900"> No Code Required </h4>
                        <p className="text-gray-600">
                           Build custom dashboards and reports without writing a
                                                single line of code. 
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900"> 24/7 Support </h4>
                        <p className="text-gray-600"> Our team is always available to help you succeed. </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-8">
                    <Link variant="inline" contentKey="cta_65" className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors duration-200" href="/features"> {t.features.learnMore} 
                    <ArrowRight className="w-5 h-5" /></Link>
                  </div>
                </div>
              </div>
            </div>
          </section>
          {/* Frequently Asked Questions */}
          <section id="frequently_asked_questions" className="py-20 lg:py-28 bg-gray-50">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              {/* Section Header */}
              <div data-aos="fade-up" className="text-center mb-16">
                <Text className="inline-block px-4 py-1.5 bg-secondary/10 text-secondary text-sm font-medium rounded-full mb-4"> {t.faq.badge} </Text>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
                   {t.faq.title} 
                  <Text className="gradient-text"> {t.faq.titleHighlight} </Text>
                </h2>
                <p className="text-lg text-gray-600"> {t.faq.subtitle} </p>
              </div>
              {/* FAQ Accordion */}
              <div data-aos="fade-up" className="space-y-4">
                {/* FAQ Item 1 */}
                <div className="glass-card rounded-xl overflow-hidden">
                  <button onClick={() => { setActiveAccordion(activeAccordion === 1 ? null : 1) }} className="w-full px-6 py-5 text-left flex items-center justify-between gap-4">
                    <Text variant="bold" className="font-semibold text-gray-900"> How does the free trial work? </Text>
                    <ChevronDown className="w-5 h-5 text-gray-500 transition-transform duration-200" />
                  </button>
                  {activeAccordion === 1 && (
                    <div className="px-6 pb-5">
                      <p className="text-gray-600">
                         Our 14-day free trial gives you full access to all Pro features. No credit card required to start. At
                                          the end of your trial, you can choose a plan that fits your needs or continue with our free tier. 
                      </p>
                    </div>
                  )}
                </div>
                {/* FAQ Item 2 */}
                <div className="glass-card rounded-xl overflow-hidden">
                  <button onClick={() => { setActiveAccordion(activeAccordion === 2 ? null : 2) }} className="w-full px-6 py-5 text-left flex items-center justify-between gap-4">
                    <Text variant="bold" className="font-semibold text-gray-900"> What data sources can I connect? </Text>
                    <ChevronDown className="w-5 h-5 text-gray-500 transition-transform duration-200" />
                  </button>
                  {activeAccordion === 2 && (
                    <div className="px-6 pb-5">
                      <p className="text-gray-600">
                         CarbonTrack supports 100+ integrations including databases (PostgreSQL, MySQL, BigQuery), SaaS tools
                                          (Salesforce, HubSpot, Stripe), and file uploads (CSV, Excel). Our API also allows custom integrations. 
                      </p>
                    </div>
                  )}
                </div>
                {/* FAQ Item 3 */}
                <div className="glass-card rounded-xl overflow-hidden">
                  <button onClick={() => { setActiveAccordion(activeAccordion === 3 ? null : 3) }} className="w-full px-6 py-5 text-left flex items-center justify-between gap-4">
                    <Text variant="bold" className="font-semibold text-gray-900"> Is my data secure? </Text>
                    <ChevronDown className="w-5 h-5 text-gray-500 transition-transform duration-200" />
                  </button>
                  {activeAccordion === 3 && (
                    <div className="px-6 pb-5">
                      <p className="text-gray-600">
                         Absolutely. We're SOC 2 Type II certified and use end-to-end encryption for all data. Your data is
                                          stored in secure, geographically distributed data centers with 99.99% uptime SLA. 
                      </p>
                    </div>
                  )}
                </div>
                {/* FAQ Item 4 */}
                <div className="glass-card rounded-xl overflow-hidden">
                  <button onClick={() => { setActiveAccordion(activeAccordion === 4 ? null : 4) }} className="w-full px-6 py-5 text-left flex items-center justify-between gap-4">
                    <Text variant="bold" className="font-semibold text-gray-900"> Can I cancel my subscription anytime? </Text>
                    <ChevronDown className="w-5 h-5 text-gray-500 transition-transform duration-200" />
                  </button>
                  {activeAccordion === 4 && (
                    <div className="px-6 pb-5">
                      <p className="text-gray-600">
                         Yes, you can cancel your subscription at any time. If you cancel, you'll retain access until the end of
                                          your billing period. We also offer a 30-day money-back guarantee for new customers. 
                      </p>
                    </div>
                  )}
                </div>
                {/* FAQ Item 5 */}
                <div className="glass-card rounded-xl overflow-hidden">
                  <button onClick={() => { setActiveAccordion(activeAccordion === 5 ? null : 5) }} className="w-full px-6 py-5 text-left flex items-center justify-between gap-4">
                    <Text variant="bold" className="font-semibold text-gray-900"> Do you offer custom enterprise plans? </Text>
                    <ChevronDown className="w-5 h-5 text-gray-500 transition-transform duration-200" />
                  </button>
                  {activeAccordion === 5 && (
                    <div className="px-6 pb-5">
                      <p className="text-gray-600">
                         Yes! Our Enterprise plan is fully customizable with dedicated support, custom integrations, on-premise
                                          deployment options, and volume discounts. Contact our sales team to discuss your specific needs. 
                      </p>
                    </div>
                  )}
                </div>
                {/* FAQ Item 6 */}
                <div className="glass-card rounded-xl overflow-hidden">
                  <button onClick={() => { setActiveAccordion(activeAccordion === 6 ? null : 6) }} className="w-full px-6 py-5 text-left flex items-center justify-between gap-4">
                    <Text variant="bold" className="font-semibold text-gray-900"> What kind of support do you offer? </Text>
                    <ChevronDown className="w-5 h-5 text-gray-500 transition-transform duration-200" />
                  </button>
                  {activeAccordion === 6 && (
                    <div className="px-6 pb-5">
                      <p className="text-gray-600">
                         All plans include email support and access to our documentation. Pro plans include priority chat
                                          support, while Enterprise plans get a dedicated account manager and 24/7 phone support. 
                      </p>
                    </div>
                  )}
                </div>
              </div>
              {/* Contact CTA */}
              <div data-aos="fade-up" className="text-center mt-12">
                <p className="text-gray-600 mb-4"> Still have questions? </p>
                <Link variant="inline" className="inline-flex items-center gap-2 text-primary hover:text-primary-700 font-semibold transition-colors duration-200" href="contact.html"> Contact our team 
                <ArrowRight className="w-5 h-5" /></Link>
              </div>
            </div>
          </section>
          {/* Ready To Transform Your Data */}
          <section id="ready_to_transform_your_data" className="py-20 lg:py-28 relative overflow-hidden">
            {/* Gradient Background */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary via-secondary to-accent opacity-90"></div>
            <div className="absolute inset-0 mesh-gradient opacity-30"></div>
            <div data-aos="fade-up" className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6"> {t.cta.title} </h2>
              <p className="text-lg sm:text-xl text-white/80 mb-10 max-w-2xl mx-auto">
                 {t.cta.subtitle} 
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <NextLink href="/register" className="w-full sm:w-auto px-8 py-4 bg-white text-primary font-semibold rounded-xl hover:bg-gray-100 transition-all duration-300 shadow-lg"> {t.cta.button} </NextLink>
                <Link contentKey="cta_67" className="w-full sm:w-auto px-8 py-4 bg-white/10 backdrop-blur text-white font-semibold rounded-xl border border-white/20 hover:bg-white/20 transition-all duration-300" href="/contact"> {t.nav.contact} </Link>
              </div>
              <p className="mt-6 text-sm text-white/60">
                 No credit card required · 14-day free trial · Cancel anytime 
              </p>
            </div>
          </section>
        </main>
        <footer className="bg-gray-50 border-t border-gray-200">
          {/* Main Footer */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 lg:gap-12">
              {/* Brand Column */}
              <div className="col-span-2 md:col-span-4 lg:col-span-1">
                <Link className="flex items-center gap-2 mb-4" href="/">
                  <img 
                    src="/carbonless.png" 
                    alt="Carbonless" 
                    className="h-10 w-auto"
                  />
                  <Text variant="bold" className="text-xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent"> 
                    {t.brandName} 
                  </Text>
                </Link>
                <p className="text-gray-600 text-sm mb-6">
                   {t.footer.description} 
                </p>
              </div>
              {/* Quick Links */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-4"> {t.footer.quickLinks} </h4>
                <ul className="space-y-3">
                  <li>
                    <Link className="text-gray-600 hover:text-primary transition-colors duration-200 text-sm" href="/features"> {t.nav.features} </Link>
                  </li>
                  <li>
                    <Link className="text-gray-600 hover:text-primary transition-colors duration-200 text-sm" href="/about"> {t.nav.about} </Link>
                  </li>
                  <li>
                    <Link className="text-gray-600 hover:text-primary transition-colors duration-200 text-sm" href="/contact"> {t.nav.contact} </Link>
                  </li>
                </ul>
              </div>
              {/* Legal Links */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-4"> {t.footer.legal} </h4>
                <ul className="space-y-3">
                  <li>
                    <Link className="text-gray-600 hover:text-primary transition-colors duration-200 text-sm" href="/privacy"> {t.footer.privacy} </Link>
                  </li>
                  <li>
                    <Link className="text-gray-600 hover:text-primary transition-colors duration-200 text-sm" href="/terms"> {t.footer.terms} </Link>
                  </li>
                </ul>
              </div>
              {/* Contact Info */}
              <div className="col-span-2">
                <h4 className="font-semibold text-gray-900 mb-4"> {t.footer.contact} </h4>
                <ul className="space-y-3">
                  <li className="text-gray-600 text-sm">
                    <span className="font-medium">{t.footer.address}:</span><br />
                    {t.company.address}
                  </li>
                  <li className="text-gray-600 text-sm">
                    <span className="font-medium">{t.footer.phone}:</span><br />
                    <a href={`tel:${t.company.phone}`} className="hover:text-primary transition-colors">
                      {t.company.phone}
                    </a>
                  </li>
                  <li className="text-gray-600 text-sm">
                    <span className="font-medium">{t.footer.email}:</span><br />
                    <a href={`mailto:${t.company.email}`} className="hover:text-primary transition-colors">
                      {t.company.email}
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          {/* Footer Bottom */}
          <div className="border-t border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-gray-500 text-sm text-center md:text-left">
                   {t.footer.copyright} 
                </p>
                <div className="flex items-center gap-6">
                  <Link className="text-gray-500 hover:text-primary text-sm transition-colors duration-200" href="/privacy"> {t.footer.privacy} </Link>
                  <Link className="text-gray-500 hover:text-primary text-sm transition-colors duration-200" href="/terms"> {t.footer.terms} </Link>
                  <Link className="text-gray-500 hover:text-primary text-sm transition-colors duration-200" href="/contact"> {t.footer.contact} </Link>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </>
    </div>
  );
}
