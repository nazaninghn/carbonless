'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useState } from 'react';
import { Mail, MapPin, Phone, Send, CheckCircle } from 'lucide-react';

export default function ContactPage() {
  const { t, language } = useLanguage();
  const tr = language === 'tr';
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="bg-white text-gray-900 antialiased overflow-x-hidden">
      <Header />
      <main>
        {/* Hero */}
        <section className="pt-24 lg:pt-40 pb-16 lg:pb-28 bg-gradient-to-b from-gray-50 to-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full mb-4">
                {tr ? 'İletişim' : 'Contact Us'}
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
                {tr ? "Hadi " : "Let's "}
                <span className="gradient-text">{tr ? 'Konuşalım' : 'Talk'}</span>
              </h1>
              <p className="text-lg text-gray-600">
                {tr ? 'Sorularınız mı var? Bize ulaşın, en kısa sürede yanıt verelim.' : "Have questions? We'd love to hear from you."}
              </p>
            </div>
          </div>
        </section>

        {/* Contact Info + Form */}
        <section className="py-20 lg:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              {/* Info Cards */}
              <div className="space-y-6">
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                    <Mail className="w-6 h-6 text-primary" />
                  </div>
                  <h4 className="text-lg font-semibold mb-2">{tr ? 'E-posta' : 'Email'}</h4>
                  <a href={`mailto:${t.company.email}`} className="text-primary font-medium hover:underline">{t.company.email}</a>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mb-4">
                    <MapPin className="w-6 h-6 text-accent" />
                  </div>
                  <h4 className="text-lg font-semibold mb-2">{tr ? 'Adres' : 'Address'}</h4>
                  <p className="text-gray-600 text-sm">{t.company.address}</p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                    <Phone className="w-6 h-6 text-green-600" />
                  </div>
                  <h4 className="text-lg font-semibold mb-2">{tr ? 'Telefon' : 'Phone'}</h4>
                  <a href={`tel:${t.company.phone}`} className="text-primary font-medium hover:underline">{t.company.phone}</a>
                </div>
              </div>

              {/* Form */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
                  <h3 className="text-2xl font-bold mb-6">{tr ? 'Bize Mesaj Gönderin' : 'Send us a Message'}</h3>
                  {submitted ? (
                    <div className="p-6 bg-green-50 border border-green-200 rounded-xl text-center">
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                      <p className="text-green-700 font-medium">{tr ? 'Teşekkürler! 24 saat içinde yanıt vereceğiz.' : 'Thank you! We will respond within 24 hours.'}</p>
                    </div>
                  ) : (
                    <form onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }} className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">{tr ? 'Ad Soyad' : 'Full Name'} *</label>
                          <input type="text" required className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">{tr ? 'E-posta' : 'Email'} *</label>
                          <input type="email" required className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{tr ? 'Konu' : 'Subject'}</label>
                        <input type="text" className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{tr ? 'Mesaj' : 'Message'} *</label>
                        <textarea rows={5} required className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent resize-none" />
                      </div>
                      <button type="submit" className="px-8 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-secondary transition-colors flex items-center gap-2">
                        <Send className="w-5 h-5" /> {tr ? 'Mesaj Gönder' : 'Send Message'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
