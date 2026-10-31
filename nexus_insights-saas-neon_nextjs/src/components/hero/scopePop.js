/* -- The short texts of the Scope popover (EN / TR) --
   The popover reuses the existing Scope content in scopeInfo.js (the meaning and the factory examples) and adds a
   one-line title and a brief "why it matters"; the long form stays in scopeInfo.js. Consistent with the GHG Protocol
   Corporate Standard, its Scope 2 Guidance and Corporate Value Chain (Scope 3) Standard, and ISO 14064-1. */
export const SCOPE_POP = {
  en: {
    s1: {
      title: 'Direct emissions from operations',
      why: 'The emissions a company controls most directly, so the first place to look for reductions. They are the core of a GHG Protocol and ISO 14064-1 inventory.',
    },
    s2: {
      title: 'Indirect emissions from purchased electricity, steam, heating and cooling',
      why: "Often a large part of a manufacturer's footprint, and it can be cut by saving energy or changing how it is sourced. The GHG Protocol asks for location-based and market-based reporting.",
    },
    s3: {
      title: 'Other indirect value-chain emissions',
      why: 'Often the largest share for industrial companies: it shows where emissions sit in the supply chain. It is also the hardest to measure, so it is built up step by step.',
    },
  },
  tr: {
    s1: {
      title: 'Operasyonlardan doğrudan emisyonlar',
      why: "Şirketin en doğrudan kontrol ettiği emisyonlardır; azaltım çalışmalarına ilk buradan başlanır. GHG Protocol ve ISO 14064-1 envanterinin çekirdeğidir.",
    },
    s2: {
      title: 'Satın alınan elektrik, buhar, ısıtma ve soğutmadan kaynaklanan dolaylı emisyonlar',
      why: 'Üreticinin ayak izinin çoğunlukla büyük bir bölümüdür; enerji tasarrufuyla ya da tedarik şeklini değiştirerek azaltılabilir. GHG Protocol konum bazlı ve piyasa bazlı raporlama ister.',
    },
    s3: {
      title: 'Değer zincirindeki diğer dolaylı emisyonlar',
      why: 'Sanayi şirketleri için çoğunlukla en büyük paydır; emisyonların tedarik zincirinde nerede olduğunu gösterir. Ölçmesi de en zor kapsamdır, bu yüzden adım adım oluşturulur.',
    },
  },
};
