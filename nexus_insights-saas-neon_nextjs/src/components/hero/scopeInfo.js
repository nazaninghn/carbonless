/* -- What each Scope means (shown in the card's panel; EN / TR) --
   Plain-language summaries consistent with the GHG Protocol Corporate Standard, its Scope 2 Guidance and its Corporate
   Value Chain (Scope 3) Standard, and with ISO 14064-1. They are general explanations only: nothing here describes
   Carbonless features, calculations or certifications. */
export const SCOPE_INFO = {
  en: {
    s1: {
      heading: 'Direct emissions from operations',
      meaning: 'Greenhouse gases released directly from sources the company owns or controls: the stack and tailpipe emissions of its own sites and vehicles.',
      includes: [
        'Stationary combustion: boilers, furnaces, kilns, ovens and on-site generators that burn fuel',
        'Mobile combustion: company-owned or controlled vehicles, forklifts and machinery',
        'Process emissions: gases released by the production process itself, for example in cement, lime, steel or chemicals manufacturing',
        'Fugitive emissions: leaks from refrigeration and air-conditioning equipment or from gas systems',
      ],
      examples: [
        'Natural gas burned in a boiler or furnace to heat a plant or run a process',
        "Diesel used by forklifts, yard trucks and the company's own delivery vehicles",
        'Refrigerant top-ups for chillers and cold rooms',
        'CO₂ released by the chemical reaction in a production line, such as calcination',
      ],
      why: 'These are the emissions a company controls most directly, so they are the first place to look for reductions such as fuel switching, efficiency and equipment upgrades. They are the core of an inventory under the GHG Protocol Corporate Standard and ISO 14064-1.',
      ref: 'Reference: GHG Protocol Corporate Standard; ISO 14064-1 (direct emissions).',
    },
    s2: {
      heading: 'Indirect emissions from purchased energy',
      meaning: 'Emissions that occur at the power plant or utility, not on site, when a company buys and uses electricity, steam, heating or cooling. Fuel burned on site belongs to Scope 1.',
      includes: [
        'Purchased electricity',
        'Purchased steam',
        'Purchased heating',
        'Purchased cooling, for example district cooling',
      ],
      examples: [
        'Grid electricity for motors, compressors, pumps, lighting and ventilation',
        'Electricity for electric furnaces, welding lines or charging forklift batteries',
        'Steam bought from a neighbouring plant or a district heating network for process heat',
        'Chilled water supplied by a district cooling system',
      ],
      why: 'For electricity-intensive manufacturing, purchased energy is often one of the largest parts of the footprint, and it can be reduced by saving energy or by changing how it is sourced. The GHG Protocol Scope 2 Guidance describes two ways to report it: location-based (average grid emissions) and market-based (reflecting the supplier or contract chosen).',
      ref: 'Reference: GHG Protocol Scope 2 Guidance; ISO 14064-1 (indirect emissions from imported energy).',
    },
    s3: {
      heading: 'Value chain emissions',
      meaning: "All other indirect emissions in the company's value chain, upstream (suppliers) and downstream (customers and the end of a product's life), that are not part of Scope 2.",
      includes: [
        'Purchased goods and services, and capital goods',
        'Fuel- and energy-related activities not included in Scope 1 or 2',
        'Upstream and downstream transportation and distribution',
        'Waste generated in operations',
        'Business travel and employee commuting',
        'Processing, use and end-of-life treatment of sold products',
        'Leased assets, franchises and investments',
      ],
      examples: [
        'Steel, plastics, chemicals or components bought from suppliers, including the emissions of making them',
        'Trucks, ships and aircraft operated by others that bring raw materials in and take finished goods out',
        'Disposal or recycling of production waste and scrap',
        'Energy used by customers when they run the machines or products the factory sells',
      ],
      why: 'For many industrial companies Scope 3 is the largest share of the total footprint. It shows where emissions sit in the supply chain, helps with choices about suppliers and product design, and is often requested by customers, investors and regulators. It is also the hardest scope to measure, so it is usually built up step by step, starting with the most significant categories.',
      ref: 'Reference: GHG Protocol Corporate Value Chain (Scope 3) Standard, 15 categories; ISO 14064-1 (other indirect emissions).',
    },
  },
  tr: {
    s1: {
      heading: 'Operasyonlardan doğrudan emisyonlar',
      meaning: 'Şirketin sahibi olduğu veya kontrol ettiği kaynaklardan doğrudan salınan sera gazları; yani kendi tesislerinin ve araçlarının bacasından ve egzozundan çıkan emisyonlar.',
      includes: [
        'Sabit yanma: yakıt yakan kazanlar, fırınlar, kurutucular ve tesis içi jeneratörler',
        'Hareketli yanma: şirkete ait veya şirketin kontrolündeki araçlar, forkliftler ve iş makineleri',
        'Proses emisyonları: çimento, kireç, çelik veya kimya üretimi gibi üretim sürecinin kendisinden kaynaklanan gazlar',
        'Kaçak emisyonlar: soğutma ve klima ekipmanlarından ya da gaz hatlarından olan sızıntılar',
      ],
      examples: [
        'Tesisi ısıtmak veya bir prosesi yürütmek için kazanda ya da fırında yakılan doğal gaz',
        'Forkliftlerin, saha kamyonlarının ve şirketin kendi dağıtım araçlarının kullandığı dizel',
        'Soğutucular ve soğuk hava depoları için yapılan soğutucu akışkan tamamlamaları',
        'Üretim hattındaki kimyasal reaksiyonla açığa çıkan CO₂ (örneğin kalsinasyon)',
      ],
      why: 'Bunlar şirketin en doğrudan kontrol edebildiği emisyonlardır; bu yüzden yakıt değişimi, verimlilik ve ekipman yenileme gibi azaltım çalışmalarına ilk buradan başlanır. GHG Protocol Kurumsal Standardı ve ISO 14064-1 kapsamındaki bir envanterin çekirdeğini oluştururlar.',
      ref: 'Kaynak: GHG Protocol Kurumsal Standardı; ISO 14064-1 (doğrudan emisyonlar).',
    },
    s2: {
      heading: 'Satın alınan enerjiden dolaylı emisyonlar',
      meaning: "Şirket elektrik, buhar, ısıtma veya soğutma satın alıp kullandığında, bu enerjinin üretildiği santralde ya da tesiste (şirketin sahası dışında) oluşan emisyonlar. Tesiste yakılan yakıt Kapsam 1'e girer.",
      includes: [
        'Satın alınan elektrik',
        'Satın alınan buhar',
        'Satın alınan ısıtma',
        'Satın alınan soğutma, örneğin bölgesel soğutma',
      ],
      examples: [
        'Motorlar, kompresörler, pompalar, aydınlatma ve havalandırma için şebekeden çekilen elektrik',
        'Elektrikli fırınlar, kaynak hatları veya forklift akülerinin şarjı için kullanılan elektrik',
        'Proses ısısı için komşu bir tesisten ya da bölgesel ısıtma şebekesinden satın alınan buhar',
        'Bölgesel soğutma sisteminden sağlanan soğuk su',
      ],
      why: 'Elektrik yoğun üretimde satın alınan enerji çoğunlukla ayak izinin en büyük bölümlerinden biridir; enerji tasarrufuyla ya da enerjinin nasıl tedarik edildiğini değiştirerek azaltılabilir. GHG Protocol Kapsam 2 Rehberi iki raporlama yöntemi tanımlar: konum bazlı (ortalama şebeke emisyonu) ve piyasa bazlı (seçilen tedarikçiyi veya sözleşmeyi yansıtır).',
      ref: 'Kaynak: GHG Protocol Kapsam 2 Rehberi; ISO 14064-1 (ithal enerjiden kaynaklanan dolaylı emisyonlar).',
    },
    s3: {
      heading: 'Değer zinciri emisyonları',
      meaning: "Şirketin değer zincirinde, hem yukarı akışta (tedarikçiler) hem aşağı akışta (müşteriler ve ürünün ömür sonu) oluşan ve Kapsam 2'de yer almayan diğer tüm dolaylı emisyonlar.",
      includes: [
        'Satın alınan mal ve hizmetler ile sermaye malları',
        "Kapsam 1 veya 2'ye dahil olmayan yakıt ve enerji ile ilgili faaliyetler",
        'Yukarı ve aşağı akış taşıma ve dağıtım',
        'Faaliyetlerde oluşan atıklar',
        'İş seyahatleri ve çalışanların işe gidiş gelişleri',
        'Satılan ürünlerin işlenmesi, kullanımı ve ömür sonu bertarafı',
        "Kiralanan varlıklar, franchise'lar ve yatırımlar",
      ],
      examples: [
        'Tedarikçilerden alınan çelik, plastik, kimyasal veya parçalar (üretimlerinden doğan emisyonlarla birlikte)',
        'Hammaddeyi getiren ve mamulü götüren, başkalarınca işletilen kamyon, gemi ve uçaklar',
        'Üretim atıklarının ve hurdanın bertarafı veya geri dönüşümü',
        'Müşterilerin fabrikanın sattığı makineleri veya ürünleri çalıştırırken harcadığı enerji',
      ],
      why: 'Birçok sanayi şirketi için Kapsam 3, toplam ayak izinin en büyük payıdır. Emisyonların tedarik zincirinde nerede olduğunu gösterir, tedarikçi ve ürün tasarımı kararlarına yardımcı olur ve çoğu zaman müşteriler, yatırımcılar ve düzenleyiciler tarafından talep edilir. Ölçmesi de en zor kapsamdır; bu yüzden genellikle en önemli kategorilerden başlanarak adım adım oluşturulur.',
      ref: 'Kaynak: GHG Protocol Kurumsal Değer Zinciri (Kapsam 3) Standardı, 15 kategori; ISO 14064-1 (diğer dolaylı emisyonlar).',
    },
  },
};
