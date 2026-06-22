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
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const setField = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));

  return (
    <div className="bg-white text-[#302817] antialiased overflow-x-hidden">
      <Header />
      <main>
        {/* Hero */}
        <section className="pt-24 lg:pt-40 pb-16 lg:pb-28 bg-gradient-to-b from-[#F9EFE5]/40 to-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full mb-4">
                {tr ? 'İletişim' : 'Contact Us'}
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
                {tr ? "Hadi " : "Let's "}
                <span className="gradient-text">{tr ? 'Konuşalım' : 'Talk'}</span>
              </h1>
              <p className="text-lg text-[#302817]/60">
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
                <div className="bg-white rounded-2xl p-6 border border-[#302817]/8 shadow-sm">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                    <Mail className="w-6 h-6 text-primary" />
                  </div>
                  <h4 className="text-lg font-semibold mb-2">{tr ? 'E-posta' : 'Email'}</h4>
                  <a href={`mailto:${t.company.email}`} className="text-primary font-medium hover:underline">{t.company.email}</a>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-[#302817]/8 shadow-sm">
                  <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mb-4">
                    <MapPin className="w-6 h-6 text-accent" />
                  </div>
                  <h4 className="text-lg font-semibold mb-2">{tr ? 'Adres' : 'Address'}</h4>
                  <p className="text-[#302817]/60 text-sm">{t.company.address}</p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-[#302817]/8 shadow-sm">
                  <div className="w-12 h-12 bg-secondary/15 rounded-xl flex items-center justify-center mb-4">
                    <Phone className="w-6 h-6 text-accent" />
                  </div>
                  <h4 className="text-lg font-semibold mb-2">{tr ? 'Telefon' : 'Phone'}</h4>
                  <a href={`tel:${t.company.phone}`} className="text-primary font-medium hover:underline">{t.company.phone}</a>
                </div>
              </div>

              {/* Form */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl p-8 border border-[#302817]/8 shadow-sm">
                  <h3 className="text-2xl font-bold mb-6">{tr ? 'Bize Mesaj Gönderin' : 'Send us a Message'}</h3>
                  {submitted ? (
                    <div className="p-6 bg-[#B4BE6A]/10 border border-[#B4BE6A]/30 rounded-xl text-center">
                      <CheckCircle className="w-12 h-12 text-primary mx-auto mb-3" />
                      <p className="text-[#75863B] font-medium">{tr ? 'Teşekkürler! 24 saat içinde yanıt vereceğiz.' : 'Thank you! We will respond within 24 hours.'}</p>
                    </div>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        // Open the user's email client pre-filled; backend integration can replace this later
                        const subject = encodeURIComponent(form.subject || (tr ? 'İletişim Formu' : 'Contact Form'));
                        const body = encodeURIComponent(
                          `${tr ? 'Ad Soyad' : 'Full Name'}: ${form.name}\n${tr ? 'E-posta' : 'Email'}: ${form.email}\n\n${form.message}`
                        );
                        window.location.href = `mailto:${t.company.email}?subject=${subject}&body=${body}`;
                        setSubmitted(true);
                      }}
                      className="space-y-6"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-[#302817]/70 mb-2">{tr ? 'Ad Soyad' : 'Full Name'} *</label>
                          <input
                            type="text"
                            required
                            value={form.name}
                            onChange={setField('name')}
                            className="w-full px-4 py-3 rounded-xl border border-[#302817]/20 focus:ring-2 focus:ring-[#95A847]/30 focus:border-[#95A847] outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[#302817]/70 mb-2">{tr ? 'E-posta' : 'Email'} *</label>
                          <input
                            type="email"
                            required
                            value={form.email}
                            onChange={setField('email')}
                            className="w-full px-4 py-3 rounded-xl border border-[#302817]/20 focus:ring-2 focus:ring-[#95A847]/30 focus:border-[#95A847] outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#302817]/70 mb-2">{tr ? 'Konu' : 'Subject'}</label>
                        <input
                          type="text"
                          value={form.subject}
                          onChange={setField('subject')}
                          className="w-full px-4 py-3 rounded-xl border border-[#302817]/20 focus:ring-2 focus:ring-[#95A847]/30 focus:border-[#95A847] outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#302817]/70 mb-2">{tr ? 'Mesaj' : 'Message'} *</label>
                        <textarea
                          rows={5}
                          required
                          value={form.message}
                          onChange={setField('message')}
                          className="w-full px-4 py-3 rounded-xl border border-[#302817]/20 focus:ring-2 focus:ring-[#95A847]/30 focus:border-[#95A847] outline-none resize-none"
                        />
                      </div>
                      <button type="submit" className="px-8 py-3 bg-[#75863B] text-[#F9EFE5] font-semibold rounded-xl hover:bg-[#5E6B2A] transition-colors flex items-center gap-2">
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
