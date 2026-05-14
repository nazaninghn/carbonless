'use client';

import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import {
  Bot,
  RotateCcw,
  Send,
  Sparkles,
  X,
  ChevronRight,
} from 'lucide-react';
import {
  CARBONIQ_STAGES,
  getInitialQuestionId,
  getNextQuestionId,
  getQuestionById,
  getQuestionWarning,
  getTriggeredAssumptions,
  validateCarbonIQAnswer,
} from '@/lib/carboniq/questions';
import { api } from '@/lib/utils/api';

// ─── Map frontend answer → backend payload ────────────────────────────────────
function mapAnswerForBackend(questionId, value, questionDef) {
  switch (questionId) {
    // ── Block A ──
    case 'A1': return { legal_name: value };
    case 'A2': return { tax_id: value };
    case 'A3': return { country: value?.country || '', city: value?.city || '' };
    case 'A4': return { reporting_year: parseInt(value, 10) };
    case 'A5': return { prepared_by: value };
    case 'A6': return { purposes: Array.isArray(value) ? value.filter(v => v !== 'skip') : [] };
    case 'A7': return { has_previous_report: value === 'yes' };
    case 'A7a': return { baseline_year: parseInt(value, 10) };

    // ── Block B ──
    case 'B3': {
      // sector — send NACE code + human-readable label
      const opt = questionDef?.options?.find(o => o.value === value);
      const label = opt?.label?.en || value;
      return { nace_code: value, nace_label: label };
    }
    case 'B1': return { employee_band: value };
    case 'B2': return { activity_description: value };
    case 'B4': return { number_of_facilities: parseInt(value, 10) || 1 };
    case 'B5': return { facility_types: Array.isArray(value) ? value : [value] };
    case 'B6': return { revenue_band: value || 'skip' };

    // ── Block C ──
    case 'C1': return { has_subsidiaries: value === 'yes' };
    case 'C2': return { has_international: value === 'yes' };
    case 'C3': return { has_jv_franchise: value === 'yes' };

    // ── Block D ──
    case 'D1': return { ef_database: value };
    case 'D3': return { boundary_approach: value };
    case 'D4': return { scope3_approach: value };

    default: return { answer: value };
  }
}

// ─── Stable message key counter ──────────────────────────────────────────────
let _keySeq = 0;
function mkMsg(obj) { return { ...obj, _key: ++_keySeq }; }

// ─── City data per country ────────────────────────────────────────────────────
const CITIES_BY_COUNTRY = {
  TR: [
    'Adana','Adıyaman','Afyonkarahisar','Ağrı','Aksaray','Amasya','Ankara','Antalya',
    'Ardahan','Artvin','Aydın','Balıkesir','Bartın','Batman','Bayburt','Bilecik',
    'Bingöl','Bitlis','Bolu','Burdur','Bursa','Çanakkale','Çankırı','Çorum',
    'Denizli','Diyarbakır','Düzce','Edirne','Elazığ','Erzincan','Erzurum','Eskişehir',
    'Gaziantep','Giresun','Gümüşhane','Hakkari','Hatay','Iğdır','Isparta','İstanbul',
    'İzmir','Kahramanmaraş','Karabük','Karaman','Kars','Kastamonu','Kayseri','Kilis',
    'Kırıkkale','Kırklareli','Kırşehir','Kocaeli','Konya','Kütahya','Malatya','Manisa',
    'Mardin','Mersin','Muğla','Muş','Nevşehir','Niğde','Ordu','Osmaniye','Rize',
    'Sakarya','Samsun','Siirt','Sinop','Sivas','Şanlıurfa','Şırnak','Tekirdağ',
    'Tokat','Trabzon','Tunceli','Uşak','Van','Yalova','Yozgat','Zonguldak',
  ],
  GB: [
    'London','Manchester','Birmingham','Leeds','Glasgow','Liverpool','Edinburgh',
    'Bristol','Sheffield','Cardiff','Belfast','Leicester','Bradford','Nottingham',
    'Newcastle upon Tyne','Southampton','Portsmouth','Oxford','Cambridge','York',
    'Brighton','Coventry','Derby','Plymouth','Stoke-on-Trent','Wolverhampton',
    'Aberdeen','Dundee','Inverness','Swansea','Newport','Bath','Exeter','Norwich',
    'Gloucester','Cheltenham','Worcester','Canterbury','Reading','Milton Keynes',
  ],
  DE: [
    'Berlin','Hamburg','Munich','Cologne','Frankfurt','Stuttgart','Düsseldorf',
    'Dortmund','Essen','Leipzig','Bremen','Dresden','Hanover','Nuremberg',
    'Duisburg','Bochum','Wuppertal','Bielefeld','Bonn','Münster','Karlsruhe',
    'Mannheim','Augsburg','Wiesbaden','Gelsenkirchen','Mönchengladbach','Braunschweig',
    'Kiel','Chemnitz','Aachen','Halle','Magdeburg','Freiburg','Krefeld','Lübeck',
    'Mainz','Erfurt','Oberhausen','Rostock','Kassel','Saarbrücken','Potsdam','Heidelberg',
  ],
  US: [
    'New York','Los Angeles','Chicago','Houston','Phoenix','Philadelphia','San Antonio',
    'San Diego','Dallas','San Jose','Austin','Jacksonville','Fort Worth','Columbus',
    'Charlotte','Indianapolis','San Francisco','Seattle','Denver','Nashville',
    'Oklahoma City','El Paso','Washington DC','Boston','Portland','Las Vegas',
    'Louisville','Memphis','Baltimore','Milwaukee','Albuquerque','Tucson','Fresno',
    'Sacramento','Atlanta','Kansas City','Miami','Minneapolis','New Orleans','Detroit',
    'Tampa','Orlando','Pittsburgh','Cincinnati','Cleveland','St. Louis','Raleigh',
  ],
  FR: [
    'Paris','Marseille','Lyon','Toulouse','Nice','Nantes','Montpellier','Strasbourg',
    'Bordeaux','Lille','Rennes','Reims','Saint-Étienne','Toulon','Le Havre',
    'Grenoble','Dijon','Angers','Nîmes','Villeurbanne','Clermont-Ferrand','Le Mans',
    'Aix-en-Provence','Brest','Tours','Amiens','Limoges','Annecy','Perpignan','Rouen',
  ],
  IT: [
    'Rome','Milan','Naples','Turin','Palermo','Genoa','Bologna','Florence','Bari',
    'Catania','Venice','Verona','Messina','Padova','Trieste','Brescia','Taranto',
    'Prato','Parma','Modena','Reggio Calabria','Reggio Emilia','Perugia','Livorno',
    'Ravenna','Cagliari','Foggia','Rimini','Salerno','Ferrara','Sassari','Latina',
  ],
  ES: [
    'Madrid','Barcelona','Valencia','Seville','Zaragoza','Málaga','Murcia','Palma',
    'Las Palmas','Bilbao','Alicante','Córdoba','Valladolid','Vigo','Gijón','Granada',
    'Vitoria-Gasteiz','A Coruña','Elche','Oviedo','Badalona','Terrassa','Cartagena',
    'Jerez de la Frontera','Sabadell','Móstoles','Santa Cruz de Tenerife','Pamplona',
  ],
  NL: [
    'Amsterdam','Rotterdam','The Hague','Utrecht','Eindhoven','Groningen','Tilburg',
    'Almere','Breda','Nijmegen','Enschede','Haarlem','Arnhem','Zaanstad','Amersfoort',
    'Apeldoorn','Delft','Leiden','Dordrecht','Zoetermeer','Zwolle','Maastricht',
  ],
  BE: [
    'Brussels','Antwerp','Ghent','Charleroi','Liège','Bruges','Namur','Leuven',
    'Mons','Aalst','Mechelen','La Louvière','Kortrijk','Hasselt','Ostend','Genk',
  ],
  AT: [
    'Vienna','Graz','Linz','Salzburg','Innsbruck','Klagenfurt','Villach','Wels',
    'Sankt Pölten','Dornbirn','Steyr','Wiener Neustadt','Feldkirch','Bregenz',
  ],
  CH: [
    'Zurich','Geneva','Basel','Bern','Lausanne','Winterthur','Lucerne','St. Gallen',
    'Lugano','Biel','Thun','Köniz','La Chaux-de-Fonds','Fribourg','Schaffhausen',
  ],
  SE: [
    'Stockholm','Gothenburg','Malmö','Uppsala','Linköping','Örebro','Västerås',
    'Helsingborg','Jönköping','Norrköping','Lund','Umeå','Gävle','Borås','Södertälje',
  ],
  NO: [
    'Oslo','Bergen','Stavanger','Trondheim','Drammen','Fredrikstad','Kristiansand',
    'Sandnes','Tromsø','Sarpsborg','Skien','Ålesund','Bodø','Sandefjord','Haugesund',
  ],
  DK: [
    'Copenhagen','Aarhus','Odense','Aalborg','Esbjerg','Randers','Kolding','Horsens',
    'Vejle','Roskilde','Helsingør','Herning','Silkeborg','Næstved','Fredericia',
  ],
  FI: [
    'Helsinki','Espoo','Tampere','Vantaa','Oulu','Turku','Jyväskylä','Lahti',
    'Kuopio','Pori','Joensuu','Lappeenranta','Hämeenlinna','Rovaniemi','Vaasa',
  ],
  PL: [
    'Warsaw','Kraków','Łódź','Wrocław','Poznań','Gdańsk','Szczecin','Bydgoszcz',
    'Lublin','Białystok','Katowice','Gdynia','Częstochowa','Radom','Sosnowiec',
  ],
  PT: [
    'Lisbon','Porto','Amadora','Braga','Setúbal','Coimbra','Funchal','Almada',
    'Aveiro','Agualva-Cacém','Viseu','Guimarães','Évora','Faro','Leiria',
  ],
  GR: [
    'Athens','Thessaloniki','Patras','Heraklion','Larissa','Volos','Ioannina',
    'Chania','Chalcis','Agrinio','Katerini','Trikala','Serres','Kavala','Kalamata',
  ],
  RU: [
    'Moscow','Saint Petersburg','Novosibirsk','Yekaterinburg','Kazan','Nizhny Novgorod',
    'Chelyabinsk','Samara','Omsk','Rostov-on-Don','Ufa','Krasnoyarsk','Perm',
    'Voronezh','Volgograd','Saratov','Krasnodar','Tyumen','Tolyatti','Izhevsk',
  ],
  UA: [
    'Kyiv','Kharkiv','Odessa','Dnipro','Donetsk','Zaporizhzhia','Lviv','Kryvyi Rih',
    'Mykolaiv','Mariupol','Luhansk','Vinnytsia','Chernivtsi','Kherson','Poltava',
  ],
  CN: [
    'Shanghai','Beijing','Guangzhou','Shenzhen','Chengdu','Chongqing','Tianjin',
    'Wuhan','Xi\'an','Hangzhou','Nanjing','Zhengzhou','Changsha','Qingdao','Shenyang',
    'Dongguan','Foshan','Kunming','Harbin','Dalian','Suzhou','Ningbo','Jinan','Hefei',
  ],
  JP: [
    'Tokyo','Yokohama','Osaka','Nagoya','Sapporo','Fukuoka','Kobe','Kawasaki',
    'Kyoto','Saitama','Hiroshima','Sendai','Kitakyushu','Chiba','Sakai',
    'Niigata','Hamamatsu','Okayama','Sagamihara','Shizuoka','Kumamoto','Matsuyama',
  ],
  KR: [
    'Seoul','Busan','Incheon','Daegu','Daejeon','Gwangju','Suwon','Ulsan',
    'Changwon','Seongnam','Goyang','Yongin','Bucheon','Cheongju','Ansan',
  ],
  IN: [
    'Mumbai','Delhi','Bangalore','Hyderabad','Ahmedabad','Chennai','Kolkata','Surat',
    'Pune','Jaipur','Lucknow','Kanpur','Nagpur','Indore','Thane','Bhopal',
    'Visakhapatnam','Pimpri-Chinchwad','Patna','Vadodara','Ghaziabad','Ludhiana',
  ],
  SA: [
    'Riyadh','Jeddah','Mecca','Medina','Dammam','Khobar','Tabuk','Buraidah',
    'Khamis Mushait','Abha','Najran','Hail','Jubail','Yanbu','Dhahran',
  ],
  AE: [
    'Dubai','Abu Dhabi','Sharjah','Al Ain','Ajman','Ras al-Khaimah','Fujairah',
    'Umm al-Quwain','Khor Fakkan','Kalba','Dibba al-Hisn',
  ],
  QA: ['Doha','Al Rayyan','Al Wakrah','Al Khor','Al Shamal','Madinat ash Shamal'],
  IL: [
    'Jerusalem','Tel Aviv','Haifa','Rishon LeZion','Petah Tikva','Ashdod','Netanya',
    'Beer Sheva','Bnei Brak','Holon','Ramat Gan','Rehovot','Ashkelon','Bat Yam',
  ],
  EG: [
    'Cairo','Alexandria','Giza','Shubra El Kheima','Port Said','Suez','Luxor',
    'Mansoura','Tanta','Asyut','Ismailia','Faiyum','Zagazig','Damietta',
  ],
  MA: [
    'Casablanca','Rabat','Fes','Marrakech','Agadir','Tangier','Meknes','Oujda',
    'Kenitra','Tetouan','Safi','El Jadida','Beni Mellal','Nador',
  ],
  BR: [
    'São Paulo','Rio de Janeiro','Brasília','Salvador','Fortaleza','Belo Horizonte',
    'Manaus','Curitiba','Recife','Porto Alegre','Belém','Goiânia','Guarulhos',
    'Campinas','São Luís','Maceió','Natal','Teresina','Campo Grande','João Pessoa',
  ],
  MX: [
    'Mexico City','Guadalajara','Monterrey','Puebla','Tijuana','León','Juárez',
    'Zapopan','Mérida','San Luis Potosí','Aguascalientes','Hermosillo','Mexicali',
    'Culiacán','Acapulco','Querétaro','Morelia','Cancún','Veracruz','Torreón',
  ],
  AR: [
    'Buenos Aires','Córdoba','Rosario','Mendoza','Tucumán','La Plata','Mar del Plata',
    'Salta','Santa Fe','San Juan','Resistencia','Neuquén','Santiago del Estero',
  ],
  CA: [
    'Toronto','Montreal','Vancouver','Calgary','Edmonton','Ottawa','Winnipeg',
    'Quebec City','Hamilton','Kitchener','London','Halifax','Victoria','Windsor',
    'Oshawa','Saskatoon','Regina','Barrie','Kelowna','Abbotsford',
  ],
  AU: [
    'Sydney','Melbourne','Brisbane','Perth','Adelaide','Gold Coast','Canberra',
    'Newcastle','Wollongong','Logan City','Geelong','Hobart','Townsville',
    'Cairns','Darwin','Toowoomba','Ballarat','Bendigo','Launceston',
  ],
  NZ: [
    'Auckland','Wellington','Christchurch','Hamilton','Tauranga','Napier-Hastings',
    'Dunedin','Palmerston North','Nelson','Rotorua','New Plymouth','Whangarei',
  ],
  SG: ['Singapore'],
  MY: [
    'Kuala Lumpur','Johor Bahru','Ipoh','Shah Alam','Petaling Jaya','Subang Jaya',
    'George Town','Kota Kinabalu','Kuching','Malacca','Alor Setar','Miri',
  ],
  TH: [
    'Bangkok','Chiang Mai','Pattaya','Khon Kaen','Hat Yai','Nonthaburi',
    'Pak Kret','Nakhon Ratchasima','Udon Thani','Chon Buri','Nakhon Si Thammarat',
  ],
  ID: [
    'Jakarta','Surabaya','Bandung','Medan','Semarang','Makassar','Palembang',
    'Tangerang','Depok','Bekasi','Batam','Pekanbaru','Denpasar','Banjarmasin',
  ],
  VN: [
    'Ho Chi Minh City','Hanoi','Da Nang','Haiphong','Can Tho','Bien Hoa',
    'Hue','Nha Trang','Vung Tau','Quy Nhon','Da Lat','Buon Ma Thuot',
  ],
  GE: ['Tbilisi','Kutaisi','Batumi','Rustavi','Gori','Zugdidi','Poti','Samtredia'],
  AZ: ['Baku','Ganja','Sumqayit','Mingachevir','Lankaran','Nakhchivan','Shirvan'],
  KZ: ['Almaty','Nur-Sultan','Shymkent','Karaganda','Aktobe','Taraz','Pavlodar','Ust-Kamenogorsk'],
  OTHER: [],
};

// ─── Country + City autocomplete ─────────────────────────────────────────────
function CountryCityInput({ question, value, setValue, lang }) {
  const current = value || { country: '', city: '' };
  const [cityInput, setCityInput] = useState(current.city || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => { setCityInput(current.city || ''); }, [current.city]);

  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target))
        setShowSuggestions(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const allCities = CITIES_BY_COUNTRY[current.country] || [];
  const filtered = cityInput.length === 0
    ? allCities                                                                        // show ALL cities when input is empty
    : allCities.filter(c => c.toLowerCase().includes(cityInput.toLowerCase()));        // show ALL matches while typing

  function handleCountryChange(e) {
    const c = e.target.value;
    setCityInput('');
    setValue({ country: c, city: '' });
    setShowSuggestions(c !== '' && c !== 'OTHER');
  }
  function handleCityChange(e) {
    const v = e.target.value;
    setCityInput(v);
    setValue({ ...current, city: v });
    setShowSuggestions(true);
  }
  function selectSuggestion(city) {
    setCityInput(city);
    setValue({ ...current, city });
    setShowSuggestions(false);
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <select
        value={current.country || ''}
        onChange={handleCountryChange}
        className="rounded-2xl border border-[#302817]/10 bg-white px-4 py-3 text-sm font-medium text-[#302817] outline-none shadow-sm"
      >
        <option value="">{lang === 'tr' ? 'Ülke seçin' : 'Select country'}</option>
        {question.options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label[lang]}</option>
        ))}
      </select>

      <div ref={wrapperRef} className="relative">
        <input
          value={cityInput}
          onChange={handleCityChange}
          onFocus={() => current.country && current.country !== 'OTHER' && setShowSuggestions(true)}
          placeholder={
            !current.country
              ? (lang === 'tr' ? 'Önce ülke seçin' : 'Select country first')
              : (lang === 'tr' ? 'Şehir girin veya seçin' : 'Type or select city')
          }
          autoComplete="off"
          className="w-full rounded-2xl border border-[#302817]/10 bg-white px-4 py-3 text-sm font-medium text-[#302817] outline-none shadow-sm placeholder:text-[#302817]/30"
        />
        {showSuggestions && filtered.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-2xl border border-[#302817]/10 bg-white shadow-[0_8px_24px_rgba(48,40,23,0.10)]">
            {filtered.map(city => (
              <li key={city}>
                <button
                  type="button"
                  onMouseDown={e => { e.preventDefault(); selectSuggestion(city); }}
                  className="w-full px-4 py-2.5 text-left text-sm font-medium text-[#302817] hover:bg-[#B4BE6A]/10 transition-colors"
                >
                  {city}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Typing Indicator Bubble ──────────────────────────────────────────────────
function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="rounded-[22px] bg-white border border-[#302817]/6 shadow-[0_2px_12px_rgba(48,40,23,0.06)] px-5 py-3.5">
        <span className="flex items-center gap-1.5">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="h-2 w-2 rounded-full bg-[#B4BE6A]"
              style={{ animation: `typingDot 1.2s ${i * 0.2}s ease-in-out infinite` }}
            />
          ))}
        </span>
      </div>
      <style>{`
        @keyframes typingDot {
          0%, 60%, 100% { opacity: 0.25; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}

// ─── Stage Breadcrumb ─────────────────────────────────────────────────────────
function StageBreadcrumb({ currentStage, lang }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2 px-3 border-b border-[#302817]/5 scrollbar-none sm:px-5">
      {CARBONIQ_STAGES.map((s, i) => {
        const done = s.id < currentStage;
        const active = s.id === currentStage;
        return (
          <div key={s.id} className="flex shrink-0 items-center gap-1">
            {i > 0 && <ChevronRight className="h-2.5 w-2.5 shrink-0 text-[#302817]/20" />}
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold whitespace-nowrap transition-all ${
                active
                  ? 'bg-[#302817] text-white shadow-sm'
                  : done
                  ? 'bg-[#B4BE6A]/20 text-[#75863B]'
                  : 'text-[#302817]/28'
              }`}
            >
              {active || done ? s.title[lang] : `${s.id}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Chat Bubble ─────────────────────────────────────────────────────────────
function ChatBubble({ message, lang, answers }) {
  const isUser    = message.role === 'user';
  const isWarning = message.type === 'warning';
  const isError   = message.type === 'error';
  const isInfo    = message.type === 'info';
  const isSuccess = message.type === 'success';
  const isAI      = message.type === 'ai';   // Grok response

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* Grok AI label */}
      {isAI && (
        <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#95A847] to-[#B4BE6A] shadow-sm">
          <span className="text-[10px] font-bold text-white">AI</span>
        </div>
      )}
      <div
        className={`max-w-[88%] rounded-[22px] px-5 py-3.5 text-[14px] leading-6 sm:max-w-[72%] ${
          isUser
            ? 'bg-[#302817] text-white'
            : isWarning
            ? 'border border-amber-200/60 bg-amber-50 text-amber-800'
            : isError
            ? 'border border-red-200/60 bg-red-50 text-red-600'
            : isInfo || isSuccess
            ? 'bg-[#B4BE6A]/8 text-[#302817]'
            : isAI
            ? 'border border-[#95A847]/25 bg-gradient-to-br from-[#F9EFE5] to-white text-[#302817] shadow-[0_2px_12px_rgba(149,168,71,0.10)]'
            : 'border border-[#302817]/6 bg-white text-[#302817] shadow-[0_2px_12px_rgba(48,40,23,0.06)]'
        }`}
      >
        {message.type === 'question' && (
          <div className="mb-2.5 inline-flex items-center gap-2 rounded-full bg-[#B4BE6A]/12 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#B4BE6A]">
            <span>
              {lang === 'tr' ? 'Soru' : 'Q'} {message.question.number} / 96
            </span>
            <span className="opacity-50">·</span>
            <span>
              {message.question.required || isConditionalRequired(message.question, answers)
                ? lang === 'tr' ? 'Zorunlu' : 'Required'
                : lang === 'tr' ? 'Opsiyonel' : 'Optional'}
            </span>
          </div>
        )}
        <p className={`font-semibold ${message.type === 'question' ? 'text-[18px] leading-7 tracking-[-0.02em] sm:text-[20px]' : ''}`}>
          {message.content}
        </p>
        {message.helper && (
          <p className="mt-2.5 text-[12px] leading-5 text-[#302817]/45">
            <span className="font-bold text-[#B4BE6A]">{lang === 'tr' ? 'İpucu:' : 'Hint:'}</span>{' '}
            {message.helper}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Answer Input ─────────────────────────────────────────────────────────────
function AnswerInput({ question, value, setValue, lang, onSubmit }) {
  if (!question) return null;

  // Info screens: just a styled "Continue" button — no text input needed
  if (question.type === 'info') {
    return (
      <button
        type="button"
        onClick={() => onSubmit()}
        className="w-full rounded-2xl border border-[#B4BE6A]/30 bg-[#B4BE6A]/8 px-4 py-3.5 text-sm font-bold text-[#75863B] transition hover:bg-[#B4BE6A]/18 active:scale-[0.98]"
      >
        {lang === 'tr' ? 'Anladım, devam et →' : "Got it, continue →"}
      </button>
    );
  }

  if (question.type === 'text') {
    if (question.subtype === 'multi_line') {
      return (
        <div className="rounded-[18px] border border-[#302817]/10 bg-white px-4 py-3 shadow-[0_4px_20px_rgba(48,40,23,0.05)]">
          <textarea
            rows={4}
            maxLength={question.maxLength || undefined}
            value={value || ''}
            onChange={e => setValue(e.target.value)}
            placeholder={question.placeholder?.[lang] || ''}
            autoFocus
            className="w-full resize-none bg-transparent text-sm font-medium text-[#302817] outline-none placeholder:text-[#302817]/30"
          />
          {question.maxLength && (
            <div className="mt-1 text-right text-[11px] font-bold text-[#302817]/25">
              {(value || '').length}/{question.maxLength}
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 rounded-[22px] border border-[#302817]/10 bg-white px-4 py-3 shadow-[0_4px_20px_rgba(48,40,23,0.05)]">
        <input
          type="text"
          inputMode={question.subtype === 'numeric' ? 'numeric' : 'text'}
          maxLength={question.maxLength || question.exactLength || undefined}
          value={value || ''}
          onChange={e => setValue(question.numericOnly ? e.target.value.replace(/\D/g, '') : e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSubmit(); }}
          placeholder={question.placeholder?.[lang] || ''}
          autoFocus
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#302817] outline-none placeholder:text-[#302817]/30"
        />
        {question.maxLength && (
          <span className="text-[11px] font-bold text-[#302817]/25">
            {(value || '').length}/{question.maxLength}
          </span>
        )}
      </div>
    );
  }

  if (question.type === 'country_city') {
    return (
      <CountryCityInput question={question} value={value} setValue={setValue} lang={lang} />
    );
  }

  // single_select & year_select: clicking a chip auto-submits
  if (question.type === 'year_select' || question.type === 'single_select') {
    // Large option sets (>8) → scrollable list for readability
    if (question.options.length > 8) {
      return (
        <div className="max-h-64 overflow-y-auto rounded-[18px] border border-[#302817]/10 bg-white shadow-[0_4px_20px_rgba(48,40,23,0.05)]">
          {question.options.map((opt, i) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { setValue(opt.value); setTimeout(() => onSubmit(opt.value), 0); }}
              className={[
                'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium transition',
                i !== 0 && 'border-t border-[#302817]/6',
                value === opt.value
                  ? 'bg-[#B4BE6A]/15 text-[#75863B]'
                  : 'text-[#302817] hover:bg-[#B4BE6A]/8',
              ].filter(Boolean).join(' ')}
            >
              <span className={[
                'h-4 w-4 shrink-0 rounded-full border-2 transition',
                value === opt.value ? 'border-[#95A847] bg-[#95A847]' : 'border-[#302817]/20',
              ].join(' ')} />
              {opt.label?.[lang] || opt.value}
            </button>
          ))}
        </div>
      );
    }
    return (
      <div className="flex flex-wrap gap-2">
        {question.options.map(opt => (
          <Chip
            key={opt.value}
            active={value === opt.value}
            onClick={() => {
              setValue(opt.value);
              // Slight delay so React batches the setValue before submitAnswer reads it
              setTimeout(() => onSubmit(opt.value), 0);
            }}
          >
            {opt.label?.[lang] || opt.value}
          </Chip>
        ))}
      </div>
    );
  }

  if (question.type === 'multi_select') {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="flex flex-wrap gap-2">
        {question.options.map(opt => {
          const active = selected.includes(opt.value);
          return (
            <Chip
              key={opt.value}
              active={active}
              onClick={() => {
                if (opt.value === 'skip') { setValue(active ? [] : ['skip']); return; }
                const cleaned = selected.filter(v => v !== 'skip');
                setValue(active ? cleaned.filter(v => v !== opt.value) : [...cleaned, opt.value]);
              }}
            >
              {opt.label[lang]}
            </Chip>
          );
        })}
      </div>
    );
  }

  return null;
}

// ─── Chip ─────────────────────────────────────────────────────────────────────
function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2.5 text-[13px] font-bold transition ${
        active
          ? 'border-[#B4BE6A]/50 bg-[#B4BE6A]/14 text-[#302817] scale-[0.97]'
          : 'border-[#302817]/8 bg-white text-[#302817]/60 hover:border-[#B4BE6A]/40 hover:bg-[#B4BE6A]/6'
      }`}
    >
      {children}
    </button>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function normalizeAnswerValue(question, value) {
  if (question.type === 'country_city') return value || { country: '', city: '' };
  if (question.type === 'multi_select') return Array.isArray(value) ? value : [];
  return value;
}

function getInitialValue(question) {
  if (!question) return '';
  if (question.type === 'country_city') return { country: '', city: '' };
  if (question.type === 'multi_select') return [];
  return '';
}

function getDisplayValue(question, value, lang) {
  if (!question) return '';
  if (question.type === 'info') return lang === 'tr' ? "Anladım, devam edelim." : "Got it, let's continue.";
  if (question.type === 'country_city') {
    const country = question.options?.find(o => o.value === value?.country)?.label?.[lang] || value?.country || '';
    return `${country}${value?.city ? `, ${value.city}` : ''}`;
  }
  if (question.type === 'single_select' || question.type === 'year_select')
    return question.options?.find(o => o.value === value)?.label?.[lang] || value;
  if (question.type === 'multi_select')
    return value.map(v => question.options?.find(o => o.value === v)?.label?.[lang] || v).join(', ');
  return String(value || '');
}

function isConditionalRequired(question, answers) {
  return Boolean(
    question?.conditionalRequired &&
    answers[question.conditionalRequired.questionId] === question.conditionalRequired.equals
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CarbonAIPage({ language = 'en' }) {
  const lang = language === 'tr' ? 'tr' : 'en';

  const [started, setStarted] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [currentId, setCurrentId] = useState(getInitialQuestionId());
  const [answers, setAnswers] = useState({});
  const [answerValue, setAnswerValue] = useState('');

  // history stores { questionId, msgCount } so Back can undo messages
  const [history, setHistory] = useState([]);

  const [messages, setMessages] = useState(() => [
    mkMsg({
      role: 'assistant',
      type: 'welcome',
      content: lang === 'tr'
        ? 'Merhaba, ben CarbonIQ 👋 ISO 14064-1 uyumlu karbon envanterinizi adım adım birlikte oluşturacağız.'
        : "Hi, I'm CarbonIQ 👋 I'll help you build your carbon inventory step by step.",
    }),
  ]);
  const [error, setError] = useState('');
  const [assumptions, setAssumptions] = useState([]);
  const [completed, setCompleted] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [reportId, setReportId] = useState(null);
  const [saveError, setSaveError] = useState(null);

  const scrollRef = useRef(null);
  const typingTimerRef = useRef(null);

  const question = getQuestionById(currentId);
  const stage = CARBONIQ_STAGES.find(s => s.id === question?.stage);
  const answeredCount = Object.keys(answers).length;
  const progress = Math.min(Math.round((answeredCount / 98) * 100), 100);

  // Smooth auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, error, currentId, isTyping]);

  const currentQuestionMessage = useMemo(() => {
    if (!question || completed || isTyping) return null;
    return mkMsg({
      role: 'assistant',
      type: 'question',
      question,
      content: question.text?.[lang],
      helper: question.helper?.[lang],
    });
  }, [question, completed, isTyping, lang]);

  // ─── Backend save (fire-and-forget) ──────────────────────────────────────
  const saveStepToBackend = useCallback(async (questionId, value, rid) => {
    const id = rid || reportId;
    if (!id) return;
    try {
      await api.submitReportStep(id, questionId, mapAnswerForBackend(questionId, value, getQuestionById(questionId)));
      setSaveError(null);
    } catch {
      setSaveError('sync');
    }
  }, [reportId]);

  // ─── Submit answer ────────────────────────────────────────────────────────
  // `overrideValue` is used by single_select chips to pass the selected value
  // directly, since React state update (setValue) is async.
  const submitAnswer = useCallback(async (overrideValue) => {
    if (!question || isTyping) return;

    const rawValue = overrideValue !== undefined ? overrideValue : answerValue;
    const normalizedValue = normalizeAnswerValue(question, rawValue);
    const validation = validateCarbonIQAnswer(question, normalizedValue, answers, lang);

    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    const userLabel = getDisplayValue(question, normalizedValue, lang);
    const nextWarning = getQuestionWarning(question, normalizedValue, lang);
    const triggeredAssumptions = getTriggeredAssumptions(question, normalizedValue, lang);
    const nextAnswers = { ...answers, [question.id]: normalizedValue };
    const nextId = getNextQuestionId(question, normalizedValue);

    setAnswers(nextAnswers);
    setError('');

    // Save to backend (non-blocking)
    saveStepToBackend(question.id, normalizedValue, reportId);

    // Build outgoing messages (user reply + optional warning/assumption)
    const outgoing = [mkMsg({ role: 'user', type: 'answer', content: userLabel })];
    if (nextWarning) outgoing.push(mkMsg({ role: 'assistant', type: 'warning', content: nextWarning }));
    if (triggeredAssumptions.length > 0) {
      setAssumptions(prev => [...prev, ...triggeredAssumptions]);
      outgoing.push(mkMsg({
        role: 'assistant', type: 'info',
        content: lang === 'tr'
          ? '💡 Bu yanıt için bir kabul kaydı oluşturdum. Aşama 6B\'de birlikte gözden geçireceğiz.'
          : "💡 I created an assumption record for this answer. We'll review it together in Stage 6B.",
      }));
    }

    // Store msg count for Back undo (Grok message also counted if it appears)
    setHistory(prev => [...prev, { questionId: question.id, msgCount: outgoing.length }]);
    setMessages(prev => [...prev, ...outgoing]);

    // ── Ask Grok for a contextual response ───────────────────────────────
    setIsTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

    let aiMessage = null;
    try {
      const aiRes = await Promise.race([
        api.aiChat({
          question_id:    question.id,
          question_text:  question.text?.[lang] || '',
          user_answer:    userLabel,
          language:       lang,
          company_name:   nextAnswers['A1'] || '',
          reporting_year: nextAnswers['A4'] || '',
        }).then(r => r.ok ? r.json() : null),
        // Hard timeout — never block more than 6 s
        new Promise(resolve => { typingTimerRef.current = setTimeout(() => resolve(null), 6000); }),
      ]);
      if (aiRes?.message) aiMessage = aiRes.message;
    } catch { /* Grok unavailable — use static flow */ }

    // Show Grok reply (or nothing if unavailable)
    if (aiMessage) {
      setMessages(prev => [
        ...prev,
        mkMsg({ role: 'assistant', type: 'ai', content: aiMessage }),
      ]);
    }

    // Brief pause before the next question appears
    await new Promise(resolve => {
      typingTimerRef.current = setTimeout(resolve, aiMessage ? 400 : 550);
    });

    setIsTyping(false);

    if (!nextId || !getQuestionById(nextId)) {
      setMessages(prev => [
        ...prev,
        mkMsg({
          role: 'assistant', type: 'success',
          content: lang === 'tr'
            ? '✅ Bu bölüm tamamlandı. Yanıtlarınızı kaydettim.'
            : '✅ This section is complete. I saved your answers.',
        }),
      ]);
      setCompleted(true);
      setAnswerValue('');
    } else {
      setCurrentId(nextId);
      setAnswerValue(getInitialValue(getQuestionById(nextId)));
    }
  }, [question, isTyping, answerValue, answers, lang, reportId, saveStepToBackend]);

  // ─── Go back ─────────────────────────────────────────────────────────────
  const goBack = useCallback(() => {
    if (history.length === 0 || isTyping) return;
    const { questionId: previous, msgCount } = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setCurrentId(previous);
    setAnswerValue(answers[previous] || getInitialValue(getQuestionById(previous)));
    setError('');
    setCompleted(false);
    setIsTyping(false);
    // Remove the messages that were added for this step
    setMessages(prev => prev.slice(0, -msgCount));
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
  }, [history, isTyping, answers]);

  // ─── Reset flow ───────────────────────────────────────────────────────────
  const resetFlow = useCallback(() => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    setCurrentId(getInitialQuestionId());
    setAnswers({});
    setAnswerValue('');
    setHistory([]);
    setError('');
    setAssumptions([]);
    setCompleted(false);
    setIsTyping(false);
    setReportId(null);
    setSaveError(null);
    setMessages([
      mkMsg({
        role: 'assistant', type: 'welcome',
        content: lang === 'tr'
          ? 'Merhaba, ben CarbonIQ 👋 ISO 14064-1 uyumlu karbon envanterinizi adım adım birlikte oluşturacağız.'
          : "Hi, I'm CarbonIQ 👋 I'll help you build your carbon inventory step by step.",
      }),
    ]);
  }, [lang]);

  // ─── Start + create/resume backend report ────────────────────────────────
  const handleStart = async () => {
    setStarted(true);
    try {
      const res = await api.startCarbonReport();
      if (res.ok) {
        const data = await res.json();
        if (data.report_id) setReportId(data.report_id);
      }
    } catch { /* non-blocking */ }
  };

  // Disable Send when typing or when a required question has an empty answer
  const isSendDisabled = isTyping || (() => {
    if (!question) return false;
    const req = question.required || isConditionalRequired(question, answers);
    if (!req) return false;
    if (question.type === 'multi_select') {
      const sel = Array.isArray(answerValue) ? answerValue : [];
      return sel.length === 0;
    }
    if (question.type === 'country_city') return !answerValue?.country;
    return false;
  })();

  // ─── Welcome Screen ───────────────────────────────────────────────────────
  if (!started) {
    return (
      <section className="relative mx-auto flex h-[calc(100svh-190px)] max-w-[1280px] flex-col items-center justify-center overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#F9EFE5] via-[#FDFCFA] to-[#EEF2D3]/40 px-4 text-center sm:h-[calc(100svh-150px)] sm:px-6 lg:h-[calc(100vh-120px)] lg:px-10">
        <div className="pointer-events-none absolute left-[5%] top-[10%] h-[220px] w-[220px] rounded-full bg-[#95A847]/15 blur-[90px]" />
        <div className="pointer-events-none absolute bottom-[10%] right-[8%] h-[180px] w-[180px] rounded-full bg-[#B4BE6A]/12 blur-[70px]" />

        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#95A847]/25 bg-white/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#75863B] shadow-sm backdrop-blur-xl">
          <Sparkles className="h-3 w-3 text-[#95A847]" />
          {lang === 'tr' ? 'AI destekli karbon raporlama' : 'AI-powered carbon reporting'}
        </div>

        <div className="relative mt-2 h-[140px] w-[140px] sm:h-[200px] sm:w-[200px] lg:h-[240px] lg:w-[240px]">
          <div className="absolute inset-[-70px] rounded-full bg-[#95A847]/18 blur-[90px]" />
          <img
            src="/chatbot.png"
            alt="CarbonIQ"
            className="relative h-full w-full object-contain drop-shadow-[0_20px_60px_rgba(48,40,23,0.08)] transition-transform duration-500 ease-out hover:scale-110 hover:rotate-[4deg] cursor-pointer"
            style={{ animation: 'float 5s ease-in-out infinite' }}
          />
        </div>

        <h1 className="mt-6 max-w-[580px] text-[26px] font-bold leading-[1.08] tracking-[-0.04em] text-[#302817] sm:text-[34px] lg:text-[40px]">
          {lang === 'tr' ? 'Karbon envanterinizi AI ile oluşturun' : 'Build your carbon inventory with AI'}
        </h1>

        <p className="mt-4 max-w-[440px] text-[13px] leading-5 text-[#302817]/50">
          {lang === 'tr'
            ? 'CarbonIQ, ISO 14064-1 raporlama sürecinizi akıllı iş akışları ile adım adım tamamlar.'
            : 'CarbonIQ helps you complete ISO 14064 reporting step by step with intelligent workflows.'}
        </p>

        <div className="mt-6 flex items-center gap-2.5">
          <button
            onClick={handleStart}
            className="inline-flex items-center gap-2 rounded-full bg-[#302817] px-6 py-3 text-sm font-bold text-white shadow-[0_8px_24px_rgba(48,40,23,0.2)] transition hover:-translate-y-0.5 hover:bg-black"
          >
            {lang === 'tr' ? 'Envanteri Başlat' : 'Start Inventory'}
            <Send className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setShowHowItWorks(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#95A847]/30 bg-white/60 px-4 py-3 text-sm font-bold text-[#75863B] backdrop-blur-sm transition hover:bg-[#95A847]/10"
          >
            <Bot className="h-3.5 w-3.5" />
            {lang === 'tr' ? 'Nasıl çalışır?' : 'How it works'}
          </button>
        </div>

        <div className="mt-6 grid w-full max-w-[640px] grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { icon: '📋', tr: 'Ankete Başla', en: 'Start Survey', sub: { tr: '133 soru · ISO 14064-1', en: '133 questions · ISO 14064-1' } },
            { icon: '📎', tr: 'Kanıt Yükle', en: 'Upload Evidence', sub: { tr: 'Fatura & belgeler', en: 'Invoices & docs' } },
            { icon: '📄', tr: 'Rapor Oluştur', en: 'Generate Report', sub: { tr: 'ISO 14064-1 PDF', en: 'ISO 14064-1 PDF' } },
            { icon: '💡', tr: 'AI Önerileri', en: 'AI Suggestions', sub: { tr: 'Azaltma fırsatları', en: 'Reduction tips' } },
          ].map((item, i) => (
            <button
              key={i}
              onClick={handleStart}
              className="group flex flex-col items-center gap-1.5 rounded-2xl border border-[#95A847]/14 bg-white/72 px-3 py-3.5 shadow-[0_10px_30px_rgba(48,40,23,0.06)] backdrop-blur-2xl transition hover:-translate-y-1 hover:bg-white hover:shadow-[0_14px_40px_rgba(48,40,23,0.1)]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#95A847]/12 to-[#B4BE6A]/8 text-lg">{item.icon}</span>
              <span className="text-[11px] font-bold text-[#302817]/70 group-hover:text-[#302817]">
                {lang === 'tr' ? item.tr : item.en}
              </span>
              <span className="text-[9px] font-medium text-[#302817]/35">
                {lang === 'tr' ? item.sub.tr : item.sub.en}
              </span>
            </button>
          ))}
        </div>

        {showHowItWorks && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/12 p-4 backdrop-blur-md">
            <div className="w-full max-w-sm rounded-[1.25rem] border border-[#302817]/10 bg-white/95 p-5 shadow-[0_20px_60px_rgba(48,40,23,0.15)] backdrop-blur-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#302817]">{lang === 'tr' ? 'Nasıl çalışır?' : 'How it works'}</h3>
                <button onClick={() => setShowHowItWorks(false)} className="flex h-6 w-6 items-center justify-center rounded-lg text-[#302817]/35 hover:bg-[#302817]/5">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-3">
                {[
                  { num: '1', tr: 'AI anketini tamamlayın', en: 'Complete AI questionnaire', sub: { tr: '133 adım adım soru', en: '133 step-by-step questions' } },
                  { num: '2', tr: 'Aktivite ve kanıt yükleyin', en: 'Upload activity & evidence', sub: { tr: 'Fatura ve belgeler', en: 'Invoices and documents' } },
                  { num: '3', tr: 'ISO-hazır rapor oluşturun', en: 'Generate ISO-ready reports', sub: { tr: 'Otomatik PDF', en: 'Automatic PDF' } },
                ].map(s => (
                  <div key={s.num} className="flex items-start gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#95A847]/12 text-[11px] font-bold text-[#75863B]">{s.num}</span>
                    <div className="text-left">
                      <p className="text-xs font-bold text-[#302817]">{lang === 'tr' ? s.tr : s.en}</p>
                      <p className="text-[10px] text-[#302817]/40">{lang === 'tr' ? s.sub.tr : s.sub.en}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => { setShowHowItWorks(false); handleStart(); }}
                className="mt-5 w-full rounded-full bg-[#302817] py-2.5 text-xs font-bold text-white shadow-lg shadow-[#302817]/15 transition hover:bg-black"
              >
                {lang === 'tr' ? 'Başla' : 'Start'}
              </button>
            </div>
          </div>
        )}

        <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-6px); }
          }
        `}</style>
      </section>
    );
  }

  // ─── Chat Interface ───────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100svh-190px)] min-h-[520px] flex-col rounded-[32px] border border-[#302817]/8 bg-white/80 shadow-[0_10px_40px_rgba(48,40,23,0.06)] backdrop-blur-2xl sm:h-[calc(100svh-150px)] lg:h-[calc(100vh-120px)]">

      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-[#302817]/6 px-5 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setStarted(false); resetFlow(); }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#302817]/40 transition hover:bg-[#302817]/5 hover:text-[#302817]"
            title={lang === 'tr' ? 'Geri' : 'Back'}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <img src="/carbon-hero.png" alt="CarbonIQ" className="h-9 w-9 rounded-xl object-cover" />
          <div>
            <h1 className="text-base font-bold tracking-[-0.02em]">CarbonIQ</h1>
            <p className="text-[11px] font-semibold text-[#302817]/45">
              {stage?.title?.[lang]} · {progress}%
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 sm:flex">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#302817]/8">
              <div className="h-full rounded-full bg-[#B4BE6A] transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[11px] font-bold text-[#302817]/40">{answeredCount}/133</span>
            {saveError && (
              <span
                title={lang === 'tr' ? 'Sunucuya kaydedilemedi' : 'Could not sync to server'}
                className="cursor-default select-none text-[11px] text-amber-500"
              >⚠</span>
            )}
          </div>
          <button
            type="button"
            onClick={resetFlow}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#302817]/40 transition hover:bg-[#302817]/6 hover:text-[#302817]"
            title={lang === 'tr' ? 'Yeniden başlat' : 'Restart'}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Stage breadcrumb */}
      <StageBreadcrumb currentStage={question?.stage ?? 1} lang={lang} />

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {messages.map(msg => (
            <ChatBubble key={msg._key} message={msg} lang={lang} answers={answers} />
          ))}

          {/* Typing indicator */}
          {isTyping && <TypingBubble />}

          {/* Current question (only when not typing) */}
          {currentQuestionMessage && !completed && (
            <ChatBubble key={currentQuestionMessage._key} message={currentQuestionMessage} lang={lang} answers={answers} />
          )}

          {error && (
            <ChatBubble
              key="error"
              message={{ role: 'assistant', type: 'error', content: error, _key: 'error' }}
              lang={lang}
              answers={answers}
            />
          )}
        </div>
      </div>

      {/* Input area */}
      {!completed ? (
        <div className="shrink-0 border-t border-[#302817]/6 px-4 py-3 sm:px-6">
          <div className="mx-auto w-full max-w-3xl">
            <AnswerInput
              question={question}
              value={answerValue}
              setValue={setAnswerValue}
              lang={lang}
              onSubmit={submitAnswer}
            />

            {/* Hide the Send/Back row for info type (Continue button handles it) and for single_select (auto-submits) */}
            {question?.type !== 'info' && question?.type !== 'single_select' && question?.type !== 'year_select' && (
              <div className="mt-2.5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={history.length === 0 || isTyping}
                  className="text-xs font-bold text-[#302817]/35 transition hover:text-[#302817] disabled:opacity-30"
                >
                  {lang === 'tr' ? '← Geri' : '← Back'}
                </button>
                <button
                  type="button"
                  onClick={() => submitAnswer()}
                  disabled={isSendDisabled}
                  className="inline-flex items-center gap-2 rounded-full bg-[#302817] px-5 py-2.5 text-xs font-bold text-white shadow-[0_8px_30px_rgba(48,40,23,0.12)] transition hover:-translate-y-0.5 hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0"
                >
                  {lang === 'tr' ? 'Gönder' : 'Send'}
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Back button only — for single_select & year_select */}
            {(question?.type === 'single_select' || question?.type === 'year_select') && (
              <div className="mt-2 flex justify-start">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={history.length === 0 || isTyping}
                  className="text-xs font-bold text-[#302817]/35 transition hover:text-[#302817] disabled:opacity-30"
                >
                  {lang === 'tr' ? '← Geri' : '← Back'}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="shrink-0 border-t border-[#302817]/6 px-4 py-4 sm:px-6">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between rounded-2xl bg-[#B4BE6A]/8 px-5 py-3">
            <p className="text-sm font-bold text-[#302817]">
              {lang === 'tr' ? 'Bölüm tamamlandı' : 'Section complete'}{' '}
              <span className="font-normal text-[#302817]/50">
                · {answeredCount} {lang === 'tr' ? 'yanıt' : 'answers'}
              </span>
            </p>
            <button
              type="button"
              onClick={resetFlow}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#302817] px-4 py-2 text-xs font-bold text-white transition hover:bg-black"
            >
              <RotateCcw className="h-3 w-3" />
              {lang === 'tr' ? 'Baştan' : 'Restart'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
