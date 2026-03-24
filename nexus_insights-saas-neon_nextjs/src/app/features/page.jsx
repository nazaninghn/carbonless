'use client';

import Header from '@/components/Header';
import { useLanguage } from '@/lib/i18n/LanguageContext';

import { useState, useEffect } from 'react';
import NextLink from 'next/link';
import { Activity } from 'lucide-react';
import { AlertTriangle } from 'lucide-react';
import { ArrowRight } from 'lucide-react';
import { BarChart3 } from 'lucide-react';
import { BellRing } from 'lucide-react';
import { Brain } from 'lucide-react';
import { CheckCircle } from 'lucide-react';
import { CreditCard } from 'lucide-react';
import { Database } from 'lucide-react';
import { Globe } from 'lucide-react';
import { Image } from '@/components/Image';
import { Link } from '@/components/Link';
import { Lock } from 'lucide-react';
import { Mail } from 'lucide-react';
import { Menu } from 'lucide-react';
import { MessageSquare } from 'lucide-react';
import { Plus } from 'lucide-react';
import { Server } from 'lucide-react';
import { ShieldCheck } from 'lucide-react';
import { ShoppingCart } from 'lucide-react';
import { Sparkles } from 'lucide-react';
import { Table } from 'lucide-react';
import { Text } from '@/components/Text';
import { TrendingUp } from 'lucide-react';
import { User } from 'lucide-react';
import { Users } from 'lucide-react';
import { X } from 'lucide-react';
import { Youtube } from 'lucide-react';
import { Zap } from 'lucide-react';

export default function Page() {
  const { t } = useLanguage();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);  return (
    <div className="bg-white text-gray-900 antialiased overflow-x-hidden">
      <>
        <Header />
        <main>
          {/* Powerful Features For Data Teams */}
          <section id="powerful_features_for_data_teams" className="pt-24 lg:pt-[193px] pb-16 lg:pb-28 bg-gradient-to-b from-gray-50 to-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div data-aos="fade-up" className="text-center max-w-3xl mx-auto">
                <Text className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full mb-4"> Features </Text>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
                   Powerful Features for 
                  <Text className="gradient-text"> Data Teams </Text>
                </h1>
                <p className="text-lg text-gray-600">
                   Everything you need to transform raw data into actionable insights that drive business growth. 
                </p>
              </div>
            </div>
          </section>
          {/* Intelligent Analytics That Think For You */}
          <section id="intelligent_analytics_that_think_for_you" className="py-20 lg:py-28">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                <div data-aos="fade-right">
                  <Text className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full mb-4"> AI-Powered </Text>
                  <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-gray-900"> Intelligent Analytics That Think For You </h2>
                  <p className="text-lg text-gray-600 mb-8">
                     Our advanced AI engine continuously analyzes your data, identifying patterns, anomalies, and opportunities that human analysts might miss. 
                  </p>
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0"><Brain className="w-5 h-5 text-primary" /></div>
                      <div>
                        <h4 className="font-semibold text-gray-900"> Auto-Discovery </h4>
                        <p className="text-gray-600">
                           AI automatically discovers insights from your data without manual queries. 
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center flex-shrink-0"><Zap className="w-5 h-5 text-secondary" /></div>
                      <div>
                        <h4 className="font-semibold text-gray-900"> Instant Answers </h4>
                        <p className="text-gray-600">
                           Ask questions in plain English and get instant, accurate answers. 
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0"><BellRing className="w-5 h-5 text-accent" /></div>
                      <div>
                        <h4 className="font-semibold text-gray-900"> Smart Alerts </h4>
                        <p className="text-gray-600">
                           Get notified when AI detects important changes or anomalies. 
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div data-aos="fade-left" className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-secondary/20 to-accent/20 rounded-3xl blur-3xl"></div>
                  {/* AI Analytics Component */}
                  <div className="relative glass-card rounded-2xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="bg-white px-5 py-4 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center"><Brain className="w-5 h-5 text-white" /></div>
                          <div>
                            <h4 className="font-semibold text-gray-900 text-sm"> AI Insights Engine </h4>
                            <p className="text-xs text-gray-500"> Processing 2.4M data points </p>
                          </div>
                        </div>
                        <Text className="px-2 py-1 bg-green-100 text-green-600 text-xs font-medium rounded-full flex items-center gap-1"><Text className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                         Active </Text>
                      </div>
                    </div>
                    {/* Content */}
                    <div className="bg-white p-5 space-y-4">
                      {/* AI Chat Interface */}
                      <div className="bg-gray-50 rounded-xl p-4">
                        <div className="flex items-start gap-3 mb-4">
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center"><User className="w-4 h-4 text-gray-500" /></div>
                          <div className="flex-1 bg-white rounded-lg p-3 shadow-sm">
                            <p className="text-sm text-gray-700"> What caused the revenue spike last Tuesday? </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center"><Sparkles className="w-4 h-4 text-white" /></div>
                          <div className="flex-1 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg p-3 border border-primary/20">
                            <p className="text-sm text-gray-700 mb-2"> The revenue spike was driven by: </p>
                            <ul className="text-xs space-y-1 text-gray-600">
                              <li className="flex items-center gap-2">
                                <Text className="w-1.5 h-1.5 bg-primary rounded-full" />
                                 Email campaign (42% of spike) 
                              </li>
                              <li className="flex items-center gap-2">
                                <Text className="w-1.5 h-1.5 bg-secondary rounded-full" />
                                 Social referrals (31% of spike) 
                              </li>
                              <li className="flex items-center gap-2">
                                <Text className="w-1.5 h-1.5 bg-accent rounded-full" />
                                 Organic search (27% of spike) 
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                      {/* Discovered Insights */}
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-3"> AUTO-DISCOVERED INSIGHTS </p>
                        <div className="space-y-2">
                          <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            <p className="text-xs text-gray-700">
                               Churn risk: 23 enterprise accounts showing reduced engagement 
                            </p>
                          </div>
                          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                            <TrendingUp className="w-4 h-4 text-green-500" />
                            <p className="text-xs text-gray-700"> Growth opportunity: APAC region up 47% MoM </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
          {/* Live Data Live Decisions */}
          <section id="live_data_live_decisions" className="py-20 lg:py-28 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                <div data-aos="fade-right" className="order-2 lg:order-1 relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-secondary/20 via-accent/20 to-primary/20 rounded-3xl blur-3xl"></div>
                  {/* Real-Time Monitoring Component */}
                  <div className="relative glass-card rounded-2xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="bg-white px-5 py-4 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-secondary to-accent rounded-xl flex items-center justify-center"><Activity className="w-5 h-5 text-white" /></div>
                          <div>
                            <h4 className="font-semibold text-gray-900 text-sm"> Live Monitor </h4>
                            <p className="text-xs text-gray-500"> Updated 0.3s ago </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Text className="flex items-center gap-1 text-xs text-gray-500"><Text className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                           LIVE </Text>
                        </div>
                      </div>
                    </div>
                    {/* Content */}
                    <div className="bg-white p-5 space-y-4">
                      {/* Live Metrics */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <Text className="text-xs text-gray-500"> Active Users </Text>
                            <Text className="text-xs text-green-500"> +12% </Text>
                          </div>
                          <p className="text-2xl font-bold text-gray-900"> 1,847 </p>
                          <div className="mt-2 h-16 flex items-end gap-1">
                            <div style={{ height: "50%" }} className="flex-1 bg-secondary/30 rounded-t"></div>
                            <div style={{ height: "65%" }} className="flex-1 bg-secondary/40 rounded-t"></div>
                            <div style={{ height: "40%" }} className="flex-1 bg-secondary/30 rounded-t"></div>
                            <div style={{ height: "75%" }} className="flex-1 bg-secondary/50 rounded-t"></div>
                            <div style={{ height: "55%" }} className="flex-1 bg-secondary/40 rounded-t"></div>
                            <div style={{ height: "85%" }} className="flex-1 bg-secondary/60 rounded-t"></div>
                            <div style={{ height: "70%" }} className="flex-1 bg-secondary/50 rounded-t"></div>
                            <div style={{ height: "100%" }} className="flex-1 bg-secondary rounded-t"></div>
                          </div>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <Text className="text-xs text-gray-500"> Requests/sec </Text>
                            <Text className="text-xs text-green-500"> +8% </Text>
                          </div>
                          <p className="text-2xl font-bold text-gray-900"> 24.3K </p>
                          <div className="mt-2 h-16 flex items-end gap-1">
                            <div style={{ height: "60%" }} className="flex-1 bg-accent/40 rounded-t"></div>
                            <div style={{ height: "45%" }} className="flex-1 bg-accent/30 rounded-t"></div>
                            <div style={{ height: "70%" }} className="flex-1 bg-accent/50 rounded-t"></div>
                            <div style={{ height: "55%" }} className="flex-1 bg-accent/40 rounded-t"></div>
                            <div style={{ height: "85%" }} className="flex-1 bg-accent/60 rounded-t"></div>
                            <div style={{ height: "65%" }} className="flex-1 bg-accent/50 rounded-t"></div>
                            <div style={{ height: "80%" }} className="flex-1 bg-accent/60 rounded-t"></div>
                            <div style={{ height: "95%" }} className="flex-1 bg-accent rounded-t"></div>
                          </div>
                        </div>
                      </div>
                      {/* Live Activity Feed */}
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-xs font-medium text-gray-500 mb-3"> LIVE ACTIVITY </p>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <p className="text-xs text-gray-600 flex-1">
                               New signup from 
                              <Text className="text-gray-900 font-medium"> enterprise@acme.co </Text>
                            </p>
                            <Text className="text-xs text-gray-400"> now </Text>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-secondary rounded-full"></div>
                            <p className="text-xs text-gray-600 flex-1">
                               Payment received 
                              <Text className="text-gray-900 font-medium"> $2,400 </Text>
                            </p>
                            <Text className="text-xs text-gray-400"> 2s </Text>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-primary rounded-full"></div>
                            <p className="text-xs text-gray-600 flex-1">
                               Dashboard export by 
                              <Text className="text-gray-900 font-medium"> sarah@... </Text>
                            </p>
                            <Text className="text-xs text-gray-400"> 5s </Text>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-accent rounded-full"></div>
                            <p className="text-xs text-gray-600 flex-1">
                               API call from 
                              <Text className="text-gray-900 font-medium"> webhook.stripe </Text>
                            </p>
                            <Text className="text-xs text-gray-400"> 8s </Text>
                          </div>
                        </div>
                      </div>
                      {/* System Health */}
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-green-500" />
                          <Text className="text-xs font-medium text-green-700"> All systems operational </Text>
                        </div>
                        <Text className="text-xs text-green-600"> 99.99% uptime </Text>
                      </div>
                    </div>
                  </div>
                </div>
                <div data-aos="fade-left" className="order-1 lg:order-2">
                  <Text className="inline-block px-4 py-1.5 bg-secondary/10 text-secondary text-sm font-medium rounded-full mb-4"> Real-Time </Text>
                  <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-gray-900"> Live Data, Live Decisions </h2>
                  <p className="text-lg text-gray-600 mb-8">
                     Watch your metrics update in real-time. No more waiting for reports or refreshing dashboards—see what's happening right now. 
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <Text className="text-gray-600"> Sub-second data refresh rates </Text>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <Text className="text-gray-600"> Live collaborative editing </Text>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <Text className="text-gray-600"> Streaming data pipelines </Text>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <Text className="text-gray-600"> Real-time anomaly detection </Text>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
          {/* Connect All Your Data Sources */}
          <section id="connect_all_your_data_sources" className="py-20 lg:py-28">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div data-aos="fade-up" className="text-center max-w-3xl mx-auto mb-16">
                <Text className="inline-block px-4 py-1.5 bg-accent/10 text-accent text-sm font-medium rounded-full mb-4"> Integrations </Text>
                <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-gray-900"> Connect All Your Data Sources </h2>
                <p className="text-lg text-gray-600">
                   100+ pre-built integrations to connect your entire tech stack in minutes. 
                </p>
              </div>
              <div data-aos="fade-up" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                <div className="glass-card rounded-xl p-6 flex flex-col items-center justify-center hover:shadow-lg transition-shadow">
                  <Database className="w-8 h-8 text-blue-500 mb-3" />
                  <Text className="text-sm font-medium text-gray-700"> PostgreSQL </Text>
                </div>
                <div className="glass-card rounded-xl p-6 flex flex-col items-center justify-center hover:shadow-lg transition-shadow">
                  <Image className="w-8 h-8" src="/assets/tech-icons/dark/aws.svg" alt="AWS" />
                  <Text className="text-sm font-medium text-gray-700"> AWS </Text>
                </div>
                <div className="glass-card rounded-xl p-6 flex flex-col items-center justify-center hover:shadow-lg transition-shadow">
                  <BarChart3 className="w-8 h-8 text-green-500 mb-3" />
                  <Text className="text-sm font-medium text-gray-700"> Salesforce </Text>
                </div>
                <div className="glass-card rounded-xl p-6 flex flex-col items-center justify-center hover:shadow-lg transition-shadow">
                  <CreditCard className="w-8 h-8 text-purple-500 mb-3" />
                  <Text className="text-sm font-medium text-gray-700"> Stripe </Text>
                </div>
                <div className="glass-card rounded-xl p-6 flex flex-col items-center justify-center hover:shadow-lg transition-shadow">
                  <MessageSquare className="w-8 h-8 text-pink-500 mb-3" />
                  <Text className="text-sm font-medium text-gray-700"> Slack </Text>
                </div>
                <div className="glass-card rounded-xl p-6 flex flex-col items-center justify-center hover:shadow-lg transition-shadow">
                  <Image className="w-8 h-8" src="/assets/tech-icons/dark/github.svg" alt="GitHub" />
                  <Text className="text-sm font-medium text-gray-700"> GitHub </Text>
                </div>
                <div className="glass-card rounded-xl p-6 flex flex-col items-center justify-center hover:shadow-lg transition-shadow">
                  <Mail className="w-8 h-8 text-red-500 mb-3" />
                  <Text className="text-sm font-medium text-gray-700"> Gmail </Text>
                </div>
                <div className="glass-card rounded-xl p-6 flex flex-col items-center justify-center hover:shadow-lg transition-shadow">
                  <Table className="w-8 h-8 text-emerald-500 mb-3" />
                  <Text className="text-sm font-medium text-gray-700"> Google Sheets </Text>
                </div>
                <div className="glass-card rounded-xl p-6 flex flex-col items-center justify-center hover:shadow-lg transition-shadow">
                  <ShoppingCart className="w-8 h-8 text-lime-500 mb-3" />
                  <Text className="text-sm font-medium text-gray-700"> Shopify </Text>
                </div>
                <div className="glass-card rounded-xl p-6 flex flex-col items-center justify-center hover:shadow-lg transition-shadow">
                  <Users className="w-8 h-8 text-orange-600 mb-3" />
                  <Text className="text-sm font-medium text-gray-700"> HubSpot </Text>
                </div>
                <div className="glass-card rounded-xl p-6 flex flex-col items-center justify-center hover:shadow-lg transition-shadow">
                  <Server className="w-8 h-8 text-blue-600 mb-3" />
                  <Text className="text-sm font-medium text-gray-700"> BigQuery </Text>
                </div>
                <div className="glass-card rounded-xl p-6 flex flex-col items-center justify-center hover:shadow-lg transition-shadow">
                  <Plus className="w-8 h-8 text-gray-400 mb-3" />
                  <Text className="text-sm font-medium text-gray-700"> 90+ More </Text>
                </div>
              </div>
            </div>
          </section>
          {/* Built For Developers */}
          <section id="built_for_developers" className="py-20 lg:py-28 bg-gray-50 text-gray-900">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                <div data-aos="fade-right">
                  <Text className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full mb-4"> Developer API </Text>
                  <h2 className="text-3xl sm:text-4xl font-bold mb-6"> Built for Developers </h2>
                  <p className="text-lg text-gray-600 mb-8">
                     Our RESTful API gives you full programmatic access to all CarbonTrack features. Build custom integrations, automate workflows, and embed analytics anywhere. 
                  </p>
                  <Link variant="inline" contentKey="cta_55" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors" href="/"> View Documentation 
                  <ArrowRight className="w-5 h-5" /></Link>
                </div>
                <div data-aos="fade-left">
                  <div className="bg-gray-900 rounded-xl p-6 font-mono text-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <pre className="text-gray-300 overflow-x-auto">
                      <code>
                        <Text className="text-purple-400">curl</Text>
                         -X POST https://api.CarbonTrack.com/v1/query \
                          -H 
                        <Text className="text-green-400">"Authorization: Bearer YOUR_API_KEY"</Text>
                         \
                          -H 
                        <Text className="text-green-400">"Content-Type: application/json"</Text>
                         \
                          -d 
                        <Text className="text-yellow-400">'{'{'}
                            "query": "SELECT * FROM analytics",
                            "format": "json"
                          {'}'}'</Text>
                      </code>
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </section>
          {/* Enterprise Grade Security */}
          <section id="enterprise_grade_security" className="py-20 lg:py-28">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div data-aos="fade-up" className="text-center max-w-3xl mx-auto mb-16">
                <Text className="inline-block px-4 py-1.5 bg-green-100 text-green-700 text-sm font-medium rounded-full mb-4"> Security </Text>
                <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-gray-900"> Enterprise-Grade Security </h2>
                <p className="text-lg text-gray-600">
                   Your data security is our top priority. We maintain the highest standards of protection. 
                </p>
              </div>
              <div data-aos="fade-up" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="glass-card rounded-2xl p-6 text-center">
                  <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck className="w-7 h-7 text-green-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2"> SOC 2 Type II </h4>
                  <p className="text-sm text-gray-600"> Certified compliant with industry standards </p>
                </div>
                <div className="glass-card rounded-2xl p-6 text-center">
                  <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-7 h-7 text-blue-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2"> End-to-End Encryption </h4>
                  <p className="text-sm text-gray-600"> AES-256 encryption at rest and in transit </p>
                </div>
                <div className="glass-card rounded-2xl p-6 text-center">
                  <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Globe className="w-7 h-7 text-purple-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2"> GDPR Compliant </h4>
                  <p className="text-sm text-gray-600"> Full compliance with EU data regulations </p>
                </div>
                <div className="glass-card rounded-2xl p-6 text-center">
                  <div className="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Server className="w-7 h-7 text-orange-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2"> 99.99% Uptime </h4>
                  <p className="text-sm text-gray-600"> Guaranteed SLA with redundant infrastructure </p>
                </div>
              </div>
            </div>
          </section>
          {/* Ready To Experience These Features */}
          <section id="ready_to_experience_these_features" className="py-20 lg:py-28 bg-gradient-to-r from-primary via-secondary to-accent">
            <div data-aos="fade-up" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6"> Ready to Experience These Features? </h2>
              <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
                 Start your free trial today and see how CarbonTrack can transform your data analytics. 
              </p>
              <NextLink href="/pricing" className="inline-block px-8 py-4 bg-white text-primary font-semibold rounded-xl hover:bg-gray-100 transition-colors shadow-lg"> Start Free Trial </NextLink>
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
