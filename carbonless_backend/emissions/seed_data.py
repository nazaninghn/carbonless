"""
Complete GHG Emission Factors Registry
Based on: Defra/DESNZ 2024, IPCC 2006/2019 + AR6 GWP, Turkey ISO 14064-1 verified inventory, Turkey national data
Formula: Emission (kg CO2e) = Activity Amount x Emission Factor
"""

# Official electricity consumption factors of the Turkish Ministry of Energy
# and Natural Resources (ETKB), data year 2023, by grid connection — the
# latest annual files published. Used for a 2024 / 2025 inventory too, with
# the reference year stated in the report.
TURKEY_GRID_2023 = [
    {'slug': 'turkey-grid-transmission', 'name': 'Turkey grid — transmission connection', 'name_tr': 'Türkiye şebekesi — iletim bağlantısı', 'scope': 'scope2', 'category': 'electricity', 'country': 'turkey', 'unit': 'kwh', 'factor_kg_co2e': 0.436, 'source': 'turkey_grid', 'reference': 'T.C. Enerji ve Tabii Kaynaklar Bakanlığı — elektrik tüketimi emisyon faktörü, iletim (İletim) bağlantısı, 2023 veri yılı', 'year': 2023, 'method': 'location_based'},
    {'slug': 'turkey-grid-distribution', 'name': 'Turkey grid — distribution connection', 'name_tr': 'Türkiye şebekesi — dağıtım bağlantısı', 'scope': 'scope2', 'category': 'electricity', 'country': 'turkey', 'unit': 'kwh', 'factor_kg_co2e': 0.469, 'source': 'turkey_grid', 'reference': 'T.C. Enerji ve Tabii Kaynaklar Bakanlığı — elektrik tüketimi emisyon faktörü, dağıtım (Dağıtım) bağlantısı, 2023 veri yılı', 'year': 2023, 'method': 'location_based'},
]

# DESNZ 2025 (UK government GHG conversion factors 2025) — UK reference set
# only; never a factor for electricity in Turkey.
DESNZ_2025_UK = [
    {'slug': 'uk-grid', 'name': 'UK grid', 'name_tr': 'İngiltere şebekesi', 'scope': 'scope2', 'category': 'electricity', 'country': 'global', 'unit': 'kwh', 'factor_kg_co2e': 0.17700, 'source': 'desnz_2025', 'reference': 'DESNZ 2025 – UK electricity (Scope 2)', 'year': 2025, 'method': 'location_based'},
    {'slug': 'uk-transmission-losses', 'name': 'UK T&D losses', 'name_tr': 'İngiltere iletim ve dağıtım kayıpları', 'scope': 'scope3', 'category': 'fuel_energy', 'country': 'global', 'unit': 'kwh', 'factor_kg_co2e': 0.01853, 'source': 'desnz_2025', 'reference': 'DESNZ 2025 – UK electricity T&D losses (Scope 3)', 'year': 2025},
]

EMISSION_FACTORS = [
    # ============================================
    # SCOPE 1 - STATIONARY COMBUSTION (Global)
    # ============================================
    {'slug': 'coal-industrial', 'name': 'Coal (industrial)', 'name_tr': 'Kömür (endüstriyel)', 'scope': 'scope1', 'category': 'stationary_combustion', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 2.40739, 'source': 'defra_2024', 'reference': 'Defra 2024 – UK GHG Conversion Factors (2,407.39 kg CO2e/tonne)'},
    {'slug': 'gas-diesel-oil-energy', 'name': 'Gas/Diesel Oil (energy basis)', 'name_tr': 'Gaz/Dizel Yağı (enerji bazlı)', 'scope': 'scope1', 'category': 'stationary_combustion', 'country': 'global', 'unit': 'gj', 'factor_kg_co2e': 74.1, 'source': 'ipcc_2019', 'reference': 'IPCC 2019 – default CO2 emission factor (74.1 kg CO2/GJ)'},
    {'slug': 'lpg', 'name': 'LPG', 'name_tr': 'LPG', 'scope': 'scope1', 'category': 'stationary_combustion', 'country': 'global', 'unit': 'liters', 'factor_kg_co2e': 1.51468, 'source': 'defra_2024', 'reference': 'DESNZ/Defra 2024 – UK GHG Conversion Factors'},
    {'slug': 'propane', 'name': 'Propane (mass)', 'name_tr': 'Propan (kütle)', 'scope': 'scope1', 'category': 'stationary_combustion', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 2.99763233, 'source': 'defra_2024', 'reference': 'Defra 2024 – Fuels, Propane (tonnes)'},
    {'slug': 'motor-gasoline', 'name': 'Motor Gasoline', 'name_tr': 'Motor Benzini', 'scope': 'scope1', 'category': 'stationary_combustion', 'country': 'global', 'unit': 'gj', 'factor_kg_co2e': 69.55587, 'source': 'ipcc_2019', 'reference': 'IPCC 2019 – Tier 1 + AR6 GWP (CO2+CH4+N2O)'},
    {'slug': 'natural-gas', 'name': 'Natural Gas', 'name_tr': 'Doğal Gaz', 'scope': 'scope1', 'category': 'stationary_combustion', 'country': 'global', 'unit': 'gj', 'factor_kg_co2e': 56.211, 'source': 'ipcc_2019', 'reference': 'IPCC 2019 – Tier 1 + AR6 GWP'},
    {'slug': 'diesel', 'name': 'Diesel (volume)', 'name_tr': 'Dizel (hacim)', 'scope': 'scope1', 'category': 'stationary_combustion', 'country': 'global', 'unit': 'liters', 'factor_kg_co2e': 2.68, 'source': 'ipcc_2006', 'reference': 'IPCC 2006'},
    {'slug': 'coal', 'name': 'Coal (generic)', 'name_tr': 'Kömür (genel)', 'scope': 'scope1', 'category': 'stationary_combustion', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 2.42, 'source': 'ipcc_2006', 'reference': 'IPCC 2006'},
    {'slug': 'fuel-oil', 'name': 'Fuel Oil (volume)', 'name_tr': 'Fuel Oil (hacim)', 'scope': 'scope1', 'category': 'stationary_combustion', 'country': 'global', 'unit': 'liters', 'factor_kg_co2e': 3.18, 'source': 'ipcc_2006', 'reference': 'IPCC 2006'},

    # SCOPE 1 - STATIONARY COMBUSTION (Turkey)
    {'slug': 'natural-gas', 'name': 'Natural Gas (Turkey)', 'name_tr': 'Doğal Gaz (Türkiye)', 'scope': 'scope1', 'category': 'stationary_combustion', 'country': 'turkey', 'unit': 'gj', 'factor_kg_co2e': 56.211, 'source': 'ipcc_2019', 'reference': 'IPCC 2019 – Tier 1 + AR6 GWP'},
    {'slug': 'diesel', 'name': 'Diesel (Turkey)', 'name_tr': 'Dizel (Türkiye)', 'scope': 'scope1', 'category': 'stationary_combustion', 'country': 'turkey', 'unit': 'liters', 'factor_kg_co2e': 2.68, 'source': 'ipcc_2006', 'reference': 'IPCC 2006'},
    {'slug': 'coal', 'name': 'Coal/Lignite (Turkey)', 'name_tr': 'Kömür/Linyit (Türkiye)', 'scope': 'scope1', 'category': 'stationary_combustion', 'country': 'turkey', 'unit': 'kg', 'factor_kg_co2e': 2.45, 'source': 'turkey_grid', 'reference': 'Turkish lignite – higher EF'},
    {'slug': 'coal-industrial', 'name': 'Coal (industrial) (Turkey)', 'name_tr': 'Kömür (endüstriyel) (Türkiye)', 'scope': 'scope1', 'category': 'stationary_combustion', 'country': 'turkey', 'unit': 'kg', 'factor_kg_co2e': 2.40739, 'source': 'defra_2024', 'reference': 'Defra 2024 – industrial coal factor'},
    {'slug': 'gas-diesel-oil-energy', 'name': 'Gas/Diesel Oil (Turkey)', 'name_tr': 'Gaz/Dizel Yağı (Türkiye)', 'scope': 'scope1', 'category': 'stationary_combustion', 'country': 'turkey', 'unit': 'gj', 'factor_kg_co2e': 74.1, 'source': 'ipcc_2019', 'reference': 'IPCC 2019'},
    {'slug': 'lpg', 'name': 'LPG (Turkey)', 'name_tr': 'LPG (Türkiye)', 'scope': 'scope1', 'category': 'stationary_combustion', 'country': 'turkey', 'unit': 'liters', 'factor_kg_co2e': 1.51468, 'source': 'defra_2024', 'reference': 'DESNZ/Defra 2024'},
    {'slug': 'motor-gasoline', 'name': 'Motor Gasoline (Turkey)', 'name_tr': 'Motor Benzini (Türkiye)', 'scope': 'scope1', 'category': 'stationary_combustion', 'country': 'turkey', 'unit': 'gj', 'factor_kg_co2e': 69.55587, 'source': 'ipcc_2019', 'reference': 'IPCC 2019 – with AR6 GWP'},
    {'slug': 'fuel-oil', 'name': 'Fuel Oil (Turkey)', 'name_tr': 'Fuel Oil (Türkiye)', 'scope': 'scope1', 'category': 'stationary_combustion', 'country': 'turkey', 'unit': 'liters', 'factor_kg_co2e': 3.18, 'source': 'ipcc_2006', 'reference': 'IPCC 2006'},
    {'slug': 'propane', 'name': 'Propane (Turkey)', 'name_tr': 'Propan (Türkiye)', 'scope': 'scope1', 'category': 'stationary_combustion', 'country': 'turkey', 'unit': 'kg', 'factor_kg_co2e': 2.99763233, 'source': 'defra_2024', 'reference': 'Defra 2024 – Fuels, Propane (tonnes)'},

    # ============================================
    # SCOPE 1 - MOBILE COMBUSTION (Global)
    # ============================================
    {'slug': 'off-road-ipcc', 'name': 'Off-Road (IPCC 2019)', 'name_tr': 'Arazi Dışı (IPCC 2019)', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'global', 'unit': 'gj', 'factor_kg_co2e': 74.39892, 'source': 'ipcc_2019', 'reference': 'IPCC 2019 – Off-road equipment, AR6 GWP'},
    {'slug': 'on-road-diesel', 'name': 'On-Road Diesel', 'name_tr': 'Karayolu Dizel', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'global', 'unit': 'gj', 'factor_kg_co2e': 74.39892, 'source': 'ipcc_2019', 'reference': 'IPCC 2019 – LDV/HDV diesel, AR6 GWP'},
    {'slug': 'on-road-gasoline', 'name': 'On-Road Gasoline', 'name_tr': 'Karayolu Benzin', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'global', 'unit': 'gj', 'factor_kg_co2e': 69.55587, 'source': 'ipcc_2019', 'reference': 'IPCC 2019 – Light duty, AR6 GWP'},
    {'slug': 'on-road-natural-gas', 'name': 'On-Road Natural Gas', 'name_tr': 'Karayolu Doğal Gaz', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'global', 'unit': 'gj', 'factor_kg_co2e': 56.211, 'source': 'ipcc_2019', 'reference': 'IPCC 2019 – AR6 GWP'},
    {'slug': 'on-road-lpg', 'name': 'On-Road LPG', 'name_tr': 'Karayolu LPG', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'global', 'unit': 'gj', 'factor_kg_co2e': 63.1, 'source': 'ipcc_2019', 'reference': 'IPCC 2019 – LPG vehicles'},
    {'slug': 'off-road-diesel-desnz', 'name': 'Off-Road Diesel (DESNZ)', 'name_tr': 'Arazi Dışı Dizel (DESNZ)', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'global', 'unit': 'liters', 'factor_kg_co2e': 3.17939, 'source': 'defra_2024', 'reference': 'DESNZ/Defra 2024'},
    {'slug': 'off-road-gasoline-desnz', 'name': 'Off-Road Gasoline (DESNZ)', 'name_tr': 'Arazi Dışı Benzin (DESNZ)', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'global', 'unit': 'liters', 'factor_kg_co2e': 2.30233, 'source': 'defra_2024', 'reference': 'Value 2.30233 is not a DESNZ 2024 row; it is within 0.21% of the off-road petrol factor 2.30724 derived by the IPCC method in the owner\'s calculation document / 2,30233 değeri bir DESNZ 2024 satırı değildir; sahibin hesap dokümanında IPCC yöntemiyle türetilen arazi dışı benzin faktörünün (2,30724) %0,21 içindedir'},
    {'slug': 'on-road-petrol-desnz', 'name': 'On-Road Petrol (DESNZ)', 'name_tr': 'Karayolu Benzin (DESNZ)', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'global', 'unit': 'liters', 'factor_kg_co2e': 2.30233, 'source': 'defra_2024', 'reference': 'Value 2.30233 is not a DESNZ 2024 row; it is 2.0% below the on-road petrol factor 2.35027 in the owner\'s calculation document / 2,30233 değeri bir DESNZ 2024 satırı değildir; sahibin hesap dokümanındaki karayolu benzin faktörünün (2,35027) %2,0 altındadır'},
    {'slug': 'on-road-diesel-desnz', 'name': 'On-Road Diesel (DESNZ)', 'name_tr': 'Karayolu Dizel (DESNZ)', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'global', 'unit': 'liters', 'factor_kg_co2e': 3.17939, 'source': 'defra_2024', 'reference': 'DESNZ/Defra 2024'},
    {'slug': 'gasoline-generic', 'name': 'Gasoline (generic)', 'name_tr': 'Benzin (genel)', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'global', 'unit': 'liters', 'factor_kg_co2e': 2.31, 'source': 'generic', 'reference': 'Platform generic default (2.31); 1.7% below the documented on-road petrol factor 2.35027; source not established / Platform genel varsayılan değeri (2,31); belgelenmiş karayolu benzin faktörünün (2,35027) %1,7 altında; kaynak belirlenemedi'},
    {'slug': 'diesel-generic', 'name': 'Diesel (generic)', 'name_tr': 'Dizel (genel)', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'global', 'unit': 'liters', 'factor_kg_co2e': 2.68, 'source': 'generic', 'reference': 'Platform generic default (2.68); within 0.7% of the documented diesel factor 2.66253; source not established / Platform genel varsayılan değeri (2,68); belgelenmiş dizel faktörünün (2,66253) %0,7 içinde; kaynak belirlenemedi'},
    {'slug': 'cng', 'name': 'CNG', 'name_tr': 'CNG', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 1.93, 'source': 'generic', 'reference': ''},
    {'slug': 'vehicle-km', 'name': 'Vehicle distance (avg car)', 'name_tr': 'Araç mesafesi (ort. otomobil)', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'global', 'unit': 'km', 'factor_kg_co2e': 0.171, 'source': 'generic', 'reference': 'Platform generic default (0.171 kg CO2e/km); within 0.7% of the documented average-car factor 0.16983; source not established / Platform genel varsayılan değeri (0,171 kg CO2e/km); belgelenmiş ortalama otomobil faktörünün (0,16983) %0,7 içinde; kaynak belirlenemedi'},

    # SCOPE 1 - MOBILE / TRANSPORTATION (Turkey)
    # Commercial flights are Scope 3, Category 6 (business travel) under the
    # GHG Protocol Scope 3 Standard, and ISO 14064-1:2018 Category 3 (transport):
    # the aircraft is owned and operated by the airline, not by the reporting
    # company (Scope 1 would only fit a company-owned aircraft). Migration
    # 0012 and upgrade_factors already moved them, but this seed ran on every
    # deploy and put them back in Scope 1.
    # Public transport (train, metro, bus, dolmuş) follows the same rule: the
    # vehicle belongs to a third party, so business trips on it are Scope 3
    # Cat. 6. (Commuting has its own *-commute factors in Scope 3 Cat. 7.)
    {'slug': 'flight-domestic', 'name': 'Domestic Flight (Turkey)', 'name_tr': 'Yurtiçi Uçuş (Türkiye)', 'scope': 'scope3', 'category': 'business_travel', 'country': 'turkey', 'unit': 'km', 'factor_kg_co2e': 0.232, 'source': 'turkey_fleet', 'reference': 'Turkish Airlines 2025 – new fleet'},
    {'slug': 'flight-international', 'name': 'International Flight', 'name_tr': 'Uluslararası Uçuş', 'scope': 'scope3', 'category': 'business_travel', 'country': 'turkey', 'unit': 'km', 'factor_kg_co2e': 0.148, 'source': 'icao', 'reference': 'ICAO 2025'},
    {'slug': 'train', 'name': 'Train (Turkey)', 'name_tr': 'Tren (Türkiye)', 'scope': 'scope3', 'category': 'business_travel', 'country': 'turkey', 'unit': 'km', 'factor_kg_co2e': 0.035, 'source': 'turkey_fleet', 'reference': 'TCDD – electrified lines'},
    {'slug': 'metro', 'name': 'Metro (Turkey)', 'name_tr': 'Metro (Türkiye)', 'scope': 'scope3', 'category': 'business_travel', 'country': 'turkey', 'unit': 'km', 'factor_kg_co2e': 0.028, 'source': 'turkey_fleet', 'reference': 'Istanbul/Ankara metro'},
    {'slug': 'bus', 'name': 'Bus (Turkey)', 'name_tr': 'Otobüs (Türkiye)', 'scope': 'scope3', 'category': 'business_travel', 'country': 'turkey', 'unit': 'km', 'factor_kg_co2e': 0.095, 'source': 'turkey_fleet', 'reference': 'Urban buses'},
    {'slug': 'dolmus', 'name': 'Dolmuş (shared minibus)', 'name_tr': 'Dolmuş', 'scope': 'scope3', 'category': 'business_travel', 'country': 'turkey', 'unit': 'km', 'factor_kg_co2e': 0.082, 'source': 'turkey_fleet', 'reference': 'Shared urban transport'},
    {'slug': 'car-gasoline', 'name': 'Car – Gasoline (Turkey)', 'name_tr': 'Otomobil – Benzin (Türkiye)', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'turkey', 'unit': 'km', 'factor_kg_co2e': 0.172, 'source': 'turkey_fleet', 'reference': 'Turkey fleet 2025 – Euro 6d'},
    {'slug': 'car-diesel', 'name': 'Car – Diesel (Turkey)', 'name_tr': 'Otomobil – Dizel (Türkiye)', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'turkey', 'unit': 'km', 'factor_kg_co2e': 0.156, 'source': 'turkey_fleet', 'reference': 'Turkey fleet 2025'},
    {'slug': 'car-lpg', 'name': 'Car – LPG (Turkey)', 'name_tr': 'Otomobil – LPG (Türkiye)', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'turkey', 'unit': 'km', 'factor_kg_co2e': 0.163, 'source': 'turkey_fleet', 'reference': 'Turkey LPG vehicles 2025'},
    {'slug': 'car-electric', 'name': 'Car – Electric (Turkey)', 'name_tr': 'Otomobil – Elektrikli (Türkiye)', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'turkey', 'unit': 'km', 'factor_kg_co2e': 0.045, 'source': 'turkey_fleet', 'reference': 'EVs on Turkey grid 2025'},
    {'slug': 'car-hybrid', 'name': 'Car – Hybrid (Turkey)', 'name_tr': 'Otomobil – Hibrit (Türkiye)', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'turkey', 'unit': 'km', 'factor_kg_co2e': 0.089, 'source': 'turkey_fleet', 'reference': 'Hybrid vehicles 2025'},
    {'slug': 'motorin-mobile', 'name': 'Diesel/Motorin – mobile (Turkey)', 'name_tr': 'Motorin – hareketli yanma (Türkiye)', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'turkey', 'unit': 'liters', 'factor_kg_co2e': 2.696, 'source': 'atom_kablo', 'reference': 'Turkey ISO 14064-1 verified inventory 2023 – Sheet 1.2 HAR. YANMA (NKD+density+EF)'},

    # ============================================
    # SCOPE 1 - FUGITIVE EMISSIONS
    # ============================================
    {'slug': 'r410a', 'name': 'R-410A', 'name_tr': 'R-410A Soğutucu Gaz', 'scope': 'scope1', 'category': 'fugitive_emissions', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 2088, 'source': 'defra_2024', 'reference': 'GWP100 2088 is the IPCC AR4 value (AR6, computed 50% R-32 + 50% R-125: 2255.5); the stored value is not an AR6 value / KIP100 2088 IPCC AR4 değeridir (AR6, %50 R-32 + %50 R-125 olarak hesaplanan: 2255,5); kayıtlı değer bir AR6 değeri değildir'},
    {'slug': 'r432a', 'name': 'R-432A', 'name_tr': 'R-432A Soğutucu Gaz', 'scope': 'scope1', 'category': 'fugitive_emissions', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 1940, 'source': 'defra_2024', 'reference': 'Defra 2024 – Refrigerant & other'},
    {'slug': 'r22', 'name': 'HCFC-22 / R-22', 'name_tr': 'HCFC-22 / R-22', 'scope': 'scope1', 'category': 'fugitive_emissions', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 1810, 'source': 'defra_2024', 'reference': 'GWP100 1810 is the IPCC AR4 value (AR6: 1960, IPCC AR6 WG1 Table 7.SM.7); the stored value is not an AR6 value / KIP100 1810 IPCC AR4 değeridir (AR6: 1960, IPCC AR6 WG1 Tablo 7.SM.7); kayıtlı değer bir AR6 değeri değildir'},
    {'slug': 'hfc-227ea', 'name': 'HFC-227ea', 'name_tr': 'HFC-227ea', 'scope': 'scope1', 'category': 'fugitive_emissions', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 3350, 'source': 'defra_2024', 'reference': 'GWP100 3350 is the IPCC AR5 value (AR6: 3600, IPCC AR6 WG1 Table 7.SM.7); the stored value is not an AR6 value / KIP100 3350 IPCC AR5 değeridir (AR6: 3600, IPCC AR6 WG1 Tablo 7.SM.7); kayıtlı değer bir AR6 değeri değildir'},
    {'slug': 'r600a', 'name': 'R-600a (Isobutane)', 'name_tr': 'R-600a (İzobütan)', 'scope': 'scope1', 'category': 'fugitive_emissions', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 3.0, 'source': 'defra_2024', 'reference': 'Defra 2024 – low-GWP'},
    {'slug': 'methane', 'name': 'Methane (CH4)', 'name_tr': 'Metan (CH4)', 'scope': 'scope1', 'category': 'fugitive_emissions', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 27.9, 'source': 'ipcc_2019', 'reference': 'IPCC AR6 GWP100'},

    # ============================================
    # SCOPE 2 - ELECTRICITY (Global)
    # ============================================
    {'slug': 'grid-average', 'name': 'Grid average', 'name_tr': 'Şebeke ortalaması', 'scope': 'scope2', 'category': 'electricity', 'country': 'global', 'unit': 'kwh', 'factor_kg_co2e': 0.475, 'source': 'generic', 'reference': ''},
    {'slug': 'us-grid', 'name': 'US grid', 'name_tr': 'ABD şebekesi', 'scope': 'scope2', 'category': 'electricity', 'country': 'global', 'unit': 'kwh', 'factor_kg_co2e': 0.417, 'source': 'generic', 'reference': ''},
    {'slug': 'eu-grid', 'name': 'EU grid', 'name_tr': 'AB şebekesi', 'scope': 'scope2', 'category': 'electricity', 'country': 'global', 'unit': 'kwh', 'factor_kg_co2e': 0.295, 'source': 'generic', 'reference': ''},
    {'slug': 'china-grid', 'name': 'China grid', 'name_tr': 'Çin şebekesi', 'scope': 'scope2', 'category': 'electricity', 'country': 'global', 'unit': 'kwh', 'factor_kg_co2e': 0.581, 'source': 'generic', 'reference': ''},
    # Market-based only (owner decision): a zero factor needs traceable proof
    # of renewable supply for that facility and period, so it is not offered
    # as a location-based choice — it comes in as a supplier declaration or
    # an approved market-based factor.
    {'slug': 'renewable', 'name': '100% renewable', 'name_tr': '%100 yenilenebilir', 'scope': 'scope2', 'category': 'electricity', 'country': 'global', 'unit': 'kwh', 'factor_kg_co2e': 0.0, 'source': 'generic', 'reference': '', 'method': 'market_based', 'is_active': False},

    # SCOPE 2 - ELECTRICITY (Turkey)
    # Replaced by the official consumption factors by grid connection (below);
    # kept inactive for the entries that were calculated with it.
    {'slug': 'turkey-grid', 'name': 'Turkey national grid', 'name_tr': 'Türkiye ulusal şebekesi', 'scope': 'scope2', 'category': 'electricity', 'country': 'turkey', 'unit': 'kwh', 'factor_kg_co2e': 0.4199, 'source': 'turkey_grid', 'reference': 'Turkey national grid electricity, ISO 14064-1 verified (CO2=0.4183 + CH4=0.0001 + N2O=0.0015)', 'is_active': False, 'is_default': False},
    *TURKEY_GRID_2023,

    # SCOPE 2 - STEAM, HEAT & COOLING (Global)
    {'slug': 'district-heating', 'name': 'District heating', 'name_tr': 'Bölgesel ısıtma', 'scope': 'scope2', 'category': 'steam_heat', 'country': 'global', 'unit': 'kwh', 'factor_kg_co2e': 0.233, 'source': 'generic', 'reference': ''},
    {'slug': 'district-cooling', 'name': 'District cooling', 'name_tr': 'Bölgesel soğutma', 'scope': 'scope2', 'category': 'steam_heat', 'country': 'global', 'unit': 'kwh', 'factor_kg_co2e': 0.088, 'source': 'generic', 'reference': ''},
    {'slug': 'steam', 'name': 'Steam', 'name_tr': 'Buhar', 'scope': 'scope2', 'category': 'steam_heat', 'country': 'global', 'unit': 'kwh', 'factor_kg_co2e': 0.195, 'source': 'generic', 'reference': ''},
    {'slug': 'chilled-water', 'name': 'Chilled water', 'name_tr': 'Soğutulmuş su', 'scope': 'scope2', 'category': 'steam_heat', 'country': 'global', 'unit': 'kwh', 'factor_kg_co2e': 0.092, 'source': 'generic', 'reference': ''},

    # SCOPE 2 - DISTRICT ENERGY (Turkey)
    {'slug': 'district-heating', 'name': 'District Heating (Turkey)', 'name_tr': 'Bölgesel Isıtma (Türkiye)', 'scope': 'scope2', 'category': 'steam_heat', 'country': 'turkey', 'unit': 'kwh', 'factor_kg_co2e': 0.232, 'source': 'turkey_grid', 'reference': 'Turkey district heating 2025'},
    {'slug': 'district-cooling', 'name': 'District Cooling (Turkey)', 'name_tr': 'Bölgesel Soğutma (Türkiye)', 'scope': 'scope2', 'category': 'steam_heat', 'country': 'turkey', 'unit': 'kwh', 'factor_kg_co2e': 0.089, 'source': 'turkey_grid', 'reference': 'Turkey district cooling 2025'},

    # ============================================
    # SCOPE 3 - WATER (Defra 2024)
    # ============================================
    {'slug': 'water-supply', 'name': 'Water supply', 'name_tr': 'Su temini', 'scope': 'scope3', 'category': 'water', 'country': 'global', 'unit': 'm3', 'factor_kg_co2e': 0.15311, 'source': 'defra_2024', 'reference': 'Defra 2024 – Water supply (cubic metres)'},
    {'slug': 'water-treatment', 'name': 'Wastewater treatment', 'name_tr': 'Atık su arıtma', 'scope': 'scope3', 'category': 'water', 'country': 'global', 'unit': 'm3', 'factor_kg_co2e': 0.18574, 'source': 'defra_2024', 'reference': 'Defra 2024 – Water treatment (cubic metres)'},

    # SCOPE 3 - WATER (Turkey / ISO 14064-1 verified inventory)
    {'slug': 'water-supply', 'name': 'Water supply (Turkey)', 'name_tr': 'Su temini (Türkiye)', 'scope': 'scope3', 'category': 'water', 'country': 'turkey', 'unit': 'm3', 'factor_kg_co2e': 0.1766845466, 'source': 'atom_kablo', 'reference': 'Turkey ISO 14064-1 verified inventory 2023 – Sheet 4.3.2 KULL.&ATIK SU'},
    {'slug': 'water-treatment', 'name': 'Wastewater treatment (Turkey)', 'name_tr': 'Atık su arıtma (Türkiye)', 'scope': 'scope3', 'category': 'water', 'country': 'turkey', 'unit': 'm3', 'factor_kg_co2e': 0.2013182917, 'source': 'atom_kablo', 'reference': 'Turkey ISO 14064-1 verified inventory 2023 – Sheet 4.3.2 KULL.&ATIK SU'},

    # ============================================
    # SCOPE 3 - PURCHASED GOODS (Global / Defra 2024)
    # ============================================
    {'slug': 'electrical-large', 'name': 'Electrical items – large', 'name_tr': 'Elektrikli ürünler – büyük', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 3.267, 'source': 'defra_2024', 'reference': 'Defra 2024 – Material use (tonnes)'},
    {'slug': 'electrical-small', 'name': 'Electrical items – small', 'name_tr': 'Elektrikli ürünler – küçük', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 5.64794563, 'source': 'defra_2024', 'reference': 'Defra 2024 – Material use'},
    {'slug': 'electrical-fridges', 'name': 'Electrical items – fridges & freezers', 'name_tr': 'Buzdolabı ve dondurucular', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 4.36333333, 'source': 'defra_2024', 'reference': 'Defra 2024 – Material use'},
    {'slug': 'electrical-it', 'name': 'Electrical items – IT', 'name_tr': 'BT ekipmanları', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 24.86547556, 'source': 'defra_2024', 'reference': 'Defra 2024 – Material use'},
    {'slug': 'glass', 'name': 'Glass', 'name_tr': 'Cam', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 1.40276667, 'source': 'defra_2024', 'reference': 'Defra 2024 – Material use'},
    {'slug': 'metal-aluminium', 'name': 'Metal: aluminium cans & foil', 'name_tr': 'Metal: alüminyum kutu ve folyo', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 9.10691851, 'source': 'defra_2024', 'reference': 'Defra 2024 – Material use'},
    {'slug': 'metal-mixed-cans', 'name': 'Metal: mixed cans', 'name_tr': 'Metal: karışık kutular', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 5.10563851, 'source': 'defra_2024', 'reference': 'Defra 2024 – Material use'},
    {'slug': 'metal-steel-cans', 'name': 'Metal: steel cans', 'name_tr': 'Metal: çelik kutular', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 2.85491851, 'source': 'defra_2024', 'reference': 'Defra 2024 – Material use'},
    {'slug': 'mineral-oil', 'name': 'Mineral oil', 'name_tr': 'Mineral yağ', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 1.401, 'source': 'defra_2024', 'reference': 'Defra 2024 – Material use'},
    {'slug': 'paper-mixed', 'name': 'Paper & board: mixed', 'name_tr': 'Kağıt ve karton: karışık', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 1.28274402, 'source': 'defra_2024', 'reference': 'Defra 2024 – Material use'},
    {'slug': 'plastic-average', 'name': 'Plastics: average', 'name_tr': 'Plastik: ortalama', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 3.16478049, 'source': 'defra_2024', 'reference': 'Defra 2024 – Material use'},
    {'slug': 'plastic-hdpe', 'name': 'Plastics: HDPE', 'name_tr': 'Plastik: HDPE', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 3.08639038, 'source': 'defra_2024', 'reference': 'Defra 2024 – Material use'},
    {'slug': 'wood', 'name': 'Wood', 'name_tr': 'Ahşap', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 0.26950416, 'source': 'defra_2024', 'reference': 'Defra 2024 – Material use'},

    # SCOPE 3 - PURCHASED GOODS (Turkey / ISO 14064-1 verified inventory)
    {'slug': 'chemical', 'name': 'Chemical (Turkey)', 'name_tr': 'Kimyasal (Türkiye)', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'turkey', 'unit': 'kg', 'factor_kg_co2e': 2.04, 'source': 'atom_kablo', 'reference': 'Turkey ISO 14064-1 verified inventory – 4.1 RAW MATERIALS'},
    {'slug': 'chemical-oil', 'name': 'Chemical oil (Turkey)', 'name_tr': 'Kimyasal yağ (Türkiye)', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'turkey', 'unit': 'kg', 'factor_kg_co2e': 2.04, 'source': 'atom_kablo', 'reference': 'Turkey ISO 14064-1 verified inventory – 4.1 RAW MATERIALS'},
    {'slug': 'plastic', 'name': 'Plastic (Turkey)', 'name_tr': 'Plastik (Türkiye)', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'turkey', 'unit': 'kg', 'factor_kg_co2e': 3.102448505, 'source': 'atom_kablo', 'reference': 'Turkey ISO 14064-1 verified inventory – E6 = 3102.448505 kg/t'},
    {'slug': 'carton', 'name': 'Carton (Turkey)', 'name_tr': 'Karton (Türkiye)', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'turkey', 'unit': 'kg', 'factor_kg_co2e': 0.868069945, 'source': 'atom_kablo', 'reference': 'Turkey ISO 14064-1 verified inventory – EF = 868.069945 kg/t'},
    {'slug': 'metal-primary', 'name': 'Metal (primary) (Turkey)', 'name_tr': 'Metal (birincil) (Türkiye)', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'turkey', 'unit': 'kg', 'factor_kg_co2e': 4.005137775, 'source': 'atom_kablo', 'reference': 'Turkey ISO 14064-1 verified inventory – EF = 4005.137775 kg/t'},
    {'slug': 'metal-recycled', 'name': 'Metal (recycled) (Turkey)', 'name_tr': 'Metal (geri dönüşüm) (Türkiye)', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'turkey', 'unit': 'kg', 'factor_kg_co2e': 1.55894894, 'source': 'atom_kablo', 'reference': 'Turkey ISO 14064-1 verified inventory – EF = 1558.94894 kg/t'},
    {'slug': 'wood', 'name': 'Wood (Turkey)', 'name_tr': 'Ahşap (Türkiye)', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'turkey', 'unit': 'kg', 'factor_kg_co2e': 0.31261178, 'source': 'atom_kablo', 'reference': 'Turkey ISO 14064-1 verified inventory – EF = 312.61178 kg/t'},
    {'slug': 'foam-tape', 'name': 'Foam tape (Turkey)', 'name_tr': 'Köpük bant (Türkiye)', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'turkey', 'unit': 'kg', 'factor_kg_co2e': 2.586727309, 'source': 'atom_kablo', 'reference': 'Turkey ISO 14064-1 verified inventory – EF = 2586.727309 kg/t'},

    # ============================================
    # SCOPE 3 - CAPITAL GOODS
    # ============================================
    {'slug': 'machinery', 'name': 'Machinery', 'name_tr': 'Makine', 'scope': 'scope3', 'category': 'capital_goods', 'country': 'global', 'unit': 'units', 'factor_kg_co2e': 8500.0, 'source': 'generic', 'reference': 'GHG Protocol – Scope 3 Cat 2 estimate', 'year': 2024},
    {'slug': 'vehicles', 'name': 'Vehicles', 'name_tr': 'Araçlar', 'scope': 'scope3', 'category': 'capital_goods', 'country': 'global', 'unit': 'units', 'factor_kg_co2e': 6000.0, 'source': 'generic', 'reference': 'GHG Protocol – Scope 3 Cat 2 estimate', 'year': 2024},
    {'slug': 'buildings', 'name': 'Buildings/construction', 'name_tr': 'Binalar/inşaat', 'scope': 'scope3', 'category': 'capital_goods', 'country': 'global', 'unit': 'm2', 'factor_kg_co2e': 500.0, 'source': 'generic', 'reference': 'GHG Protocol – Scope 3 Cat 2 estimate', 'year': 2024},
    {'slug': 'it-equipment', 'name': 'IT equipment', 'name_tr': 'BT ekipmanı', 'scope': 'scope3', 'category': 'capital_goods', 'country': 'global', 'unit': 'units', 'factor_kg_co2e': 350.0, 'source': 'generic', 'reference': 'GHG Protocol – Scope 3 Cat 2 estimate', 'year': 2024},

    # ============================================
    # SCOPE 3 - FUEL & ENERGY RELATED
    # ============================================
    {'slug': 'upstream-electricity', 'name': 'Upstream electricity', 'name_tr': 'Yukarı akış elektrik', 'scope': 'scope3', 'category': 'fuel_energy', 'country': 'global', 'unit': 'kwh', 'factor_kg_co2e': 0.025, 'source': 'generic', 'reference': 'GHG Protocol – Scope 3 Cat 3 estimate', 'year': 2024},
    {'slug': 'transmission-losses', 'name': 'T&D losses', 'name_tr': 'İletim ve dağıtım kayıpları', 'scope': 'scope3', 'category': 'fuel_energy', 'country': 'global', 'unit': 'kwh', 'factor_kg_co2e': 0.02, 'source': 'generic', 'reference': 'GHG Protocol – Scope 3 Cat 3 estimate', 'year': 2024},
    {'slug': 'fuel-extraction', 'name': 'Fuel extraction & processing', 'name_tr': 'Yakıt çıkarma ve işleme', 'scope': 'scope3', 'category': 'fuel_energy', 'country': 'global', 'unit': 'liters', 'factor_kg_co2e': 0.6, 'source': 'generic', 'reference': 'Scope 3 Cat 3 platform estimate (0.6), within 1.8% of the DEFRA well-to-tank diesel factor 0.61101 (DEFRA 2023 and DESNZ 2024); not a GHG Protocol factor, the Protocol publishes none / Kapsam 3 Kat. 3 platform tahmini (0,6); DEFRA kuyudan depoya dizel faktörünün (0,61101; DEFRA 2023 ve DESNZ 2024) %1,8 içinde; GHG Protocol faktörü değildir, Protokol faktör yayımlamaz', 'year': 2024},

    # ============================================
    # SCOPE 3 - UPSTREAM TRANSPORTATION
    # ============================================
    {'slug': 'truck-freight', 'name': 'Truck freight', 'name_tr': 'Kamyon taşımacılığı', 'scope': 'scope3', 'category': 'upstream_transport', 'country': 'global', 'unit': 'tonne-km', 'factor_kg_co2e': 0.112, 'source': 'generic', 'reference': ''},
    {'slug': 'rail-freight', 'name': 'Rail freight', 'name_tr': 'Demiryolu taşımacılığı', 'scope': 'scope3', 'category': 'upstream_transport', 'country': 'global', 'unit': 'tonne-km', 'factor_kg_co2e': 0.022, 'source': 'generic', 'reference': ''},
    {'slug': 'sea-freight', 'name': 'Sea freight', 'name_tr': 'Deniz taşımacılığı', 'scope': 'scope3', 'category': 'upstream_transport', 'country': 'global', 'unit': 'tonne-km', 'factor_kg_co2e': 0.011, 'source': 'generic', 'reference': ''},
    {'slug': 'air-freight', 'name': 'Air freight', 'name_tr': 'Hava taşımacılığı', 'scope': 'scope3', 'category': 'upstream_transport', 'country': 'global', 'unit': 'tonne-km', 'factor_kg_co2e': 0.602, 'source': 'generic', 'reference': ''},

    # SCOPE 3 - UPSTREAM TRANSPORTATION (Turkey / ISO 14064-1 verified inventory)
    {'slug': 'truck-freight', 'name': 'Truck freight (Turkey)', 'name_tr': 'Kamyon taşımacılığı (Türkiye)', 'scope': 'scope3', 'category': 'upstream_transport', 'country': 'turkey', 'unit': 'tonne-km', 'factor_kg_co2e': 0.823134, 'source': 'atom_kablo', 'reference': 'Turkey ISO 14064-1 verified inventory 2023 – Sheet 3.1 HAMMADDE NAK.'},
    {'slug': 'sea-freight', 'name': 'Sea freight (Turkey)', 'name_tr': 'Deniz taşımacılığı (Türkiye)', 'scope': 'scope3', 'category': 'upstream_transport', 'country': 'turkey', 'unit': 'tonne-km', 'factor_kg_co2e': 0.01611857, 'source': 'atom_kablo', 'reference': 'Turkey ISO 14064-1 verified inventory 2023 – Sheet 3.1 HAMMADDE NAK.'},

    # SCOPE 3 - UPSTREAM TRANSPORTATION — GLEC v3 / ISO 14083 TM catalog (K3C4-2, slug = TM code)
    # Load factor matters a lot here: TM-01 (full load) vs TM-02 (50% load) is a 2x EF
    # difference for the identical vehicle — this is why K3C4-2 asks for load_factor_pct.
    {'slug': 'tm-01', 'name': 'Road — HGV 40t full load', 'name_tr': 'Karayolu — HTC 40t tam dolu', 'scope': 'scope3', 'category': 'upstream_transport', 'country': 'global', 'unit': 'tonne-km', 'factor_kg_co2e': 0.062, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3T-001 — GLEC Framework v3 Tier 1, ISO 14083'},
    {'slug': 'tm-02', 'name': 'Road — HGV 40t 50% load', 'name_tr': 'Karayolu — HTC 40t %50 dolu', 'scope': 'scope3', 'category': 'upstream_transport', 'country': 'global', 'unit': 'tonne-km', 'factor_kg_co2e': 0.123, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3T-002 — GLEC v3 default load factor'},
    {'slug': 'tm-03', 'name': 'Road — Light commercial (≤3.5t)', 'name_tr': 'Karayolu — Hafif ticari (≤3.5t)', 'scope': 'scope3', 'category': 'upstream_transport', 'country': 'global', 'unit': 'tonne-km', 'factor_kg_co2e': 0.205, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3T-003'},
    {'slug': 'tm-04', 'name': 'Sea — Large container (>10,000 TEU)', 'name_tr': 'Denizyolu — Konteyner büyük (>10.000 TEU)', 'scope': 'scope3', 'category': 'upstream_transport', 'country': 'global', 'unit': 'tonne-km', 'factor_kg_co2e': 0.005, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3T-004 — GLEC v3'},
    {'slug': 'tm-05', 'name': 'Sea — Medium container (3,000–8,000 TEU)', 'name_tr': 'Denizyolu — Konteyner orta (3.000–8.000 TEU)', 'scope': 'scope3', 'category': 'upstream_transport', 'country': 'global', 'unit': 'tonne-km', 'factor_kg_co2e': 0.011, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3T-005 — GLEC v3'},
    {'slug': 'tm-06', 'name': 'Sea — Bulk cargo', 'name_tr': 'Denizyolu — Dökme yük', 'scope': 'scope3', 'category': 'upstream_transport', 'country': 'global', 'unit': 'tonne-km', 'factor_kg_co2e': 0.008, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3T-006 — GLEC v3'},
    {'slug': 'tm-07', 'name': 'Air — Cargo (long haul)', 'name_tr': 'Havayolu — Kargo uzun mesafe', 'scope': 'scope3', 'category': 'upstream_transport', 'country': 'global', 'unit': 'tonne-km', 'factor_kg_co2e': 0.602, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3T-007 — GLEC v3, RFI included'},
    {'slug': 'tm-07-short', 'name': 'Air — Cargo (short/medium haul)', 'name_tr': 'Havayolu — Kargo kısa/orta mesafe', 'scope': 'scope3', 'category': 'upstream_transport', 'country': 'global', 'unit': 'tonne-km', 'factor_kg_co2e': 0.853, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3T-008 — GLEC v3'},
    {'slug': 'tm-08', 'name': 'Rail (electric)', 'name_tr': 'Demiryolu (elektrikli)', 'scope': 'scope3', 'category': 'upstream_transport', 'country': 'global', 'unit': 'tonne-km', 'factor_kg_co2e': 0.028, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3T-009'},

    # ============================================
    # SCOPE 3 - BUSINESS TRAVEL (Global)
    # ============================================
    {'slug': 'flight-short', 'name': 'Short-haul flight (<500 km)', 'name_tr': 'Kısa mesafe uçuş (<500 km)', 'scope': 'scope3', 'category': 'business_travel', 'country': 'global', 'unit': 'km', 'factor_kg_co2e': 0.255, 'source': 'generic', 'reference': ''},
    {'slug': 'flight-medium', 'name': 'Medium-haul flight (500–3700 km)', 'name_tr': 'Orta mesafe uçuş (500–3700 km)', 'scope': 'scope3', 'category': 'business_travel', 'country': 'global', 'unit': 'km', 'factor_kg_co2e': 0.156, 'source': 'generic', 'reference': ''},
    {'slug': 'flight-long', 'name': 'Long-haul flight (>3700 km)', 'name_tr': 'Uzun mesafe uçuş (>3700 km)', 'scope': 'scope3', 'category': 'business_travel', 'country': 'global', 'unit': 'km', 'factor_kg_co2e': 0.150, 'source': 'generic', 'reference': ''},
    {'slug': 'train-travel', 'name': 'Train', 'name_tr': 'Tren', 'scope': 'scope3', 'category': 'business_travel', 'country': 'global', 'unit': 'km', 'factor_kg_co2e': 0.041, 'source': 'generic', 'reference': ''},
    {'slug': 'taxi', 'name': 'Taxi', 'name_tr': 'Taksi', 'scope': 'scope3', 'category': 'business_travel', 'country': 'global', 'unit': 'km', 'factor_kg_co2e': 0.171, 'source': 'generic', 'reference': 'Platform generic default (0.171 kg CO2e/km); within 0.7% of the documented average-car factor 0.16983; source not established / Platform genel varsayılan değeri (0,171 kg CO2e/km); belgelenmiş ortalama otomobil faktörünün (0,16983) %0,7 içinde; kaynak belirlenemedi'},
    {'slug': 'bus-travel', 'name': 'Bus', 'name_tr': 'Otobüs', 'scope': 'scope3', 'category': 'business_travel', 'country': 'global', 'unit': 'km', 'factor_kg_co2e': 0.089, 'source': 'generic', 'reference': ''},

    # SCOPE 3 - BUSINESS TRAVEL (Turkey / ISO 14064-1 verified inventory)
    {'slug': 'road-travel', 'name': 'Road travel (Turkey)', 'name_tr': 'Karayolu seyahati (Türkiye)', 'scope': 'scope3', 'category': 'business_travel', 'country': 'turkey', 'unit': 'km', 'factor_kg_co2e': 0.169826449, 'source': 'atom_kablo', 'reference': 'Turkey ISO 14064-1 verified inventory 2023 – Sheet 3.5 SEYAHAT (CO2+CH4+N2O)'},

    # SCOPE 3 - BUSINESS TRAVEL — CABIN CLASS (BT-01/02/03, K3C6) — CarbonIQ EF Katalogu EF-K3S-001..004
    # Cabin class changes the emission factor by a large multiple (Economy 1x baseline; if
    # cabin class is unknown, the Economy default applies — see K3C6-2's cabin_class field).
    {'slug': 'flight-short-economy', 'name': 'Flight — Short-haul Economy (<3h)', 'name_tr': 'Uçak — Kısa mesafe Economy (<3 saat)', 'scope': 'scope3', 'category': 'business_travel', 'country': 'global', 'unit': 'person-km', 'factor_kg_co2e': 0.2550, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3S-001 — RFI dahil (RFI included)'},
    {'slug': 'flight-long-economy', 'name': 'Flight — Long-haul Economy (>6h)', 'name_tr': 'Uçak — Uzun mesafe Economy (>6 saat)', 'scope': 'scope3', 'category': 'business_travel', 'country': 'global', 'unit': 'person-km', 'factor_kg_co2e': 0.1480, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3S-002 — RFI dahil (RFI included)'},
    {'slug': 'flight-long-business', 'name': 'Flight — Long-haul Business', 'name_tr': 'Uçak — Uzun mesafe Business', 'scope': 'scope3', 'category': 'business_travel', 'country': 'global', 'unit': 'person-km', 'factor_kg_co2e': 0.4290, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3S-003 — Economy x ~2.9'},
    {'slug': 'flight-long-first', 'name': 'Flight — Long-haul First Class', 'name_tr': 'Uçak — Uzun mesafe First Class', 'scope': 'scope3', 'category': 'business_travel', 'country': 'global', 'unit': 'person-km', 'factor_kg_co2e': 0.5920, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3S-004 — Economy x ~4.0'},
    {'slug': 'rfi-multiplier', 'name': 'Radiative Forcing Index (RFI) multiplier', 'name_tr': 'Radyatif Zorlama Faktörü (RFI) çarpanı', 'scope': 'scope3', 'category': 'business_travel', 'country': 'global', 'unit': 'multiplier', 'factor_kg_co2e': 1.9, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3S-012 — DEFRA recommends; GHG Protocol does not require it. Already included in the cabin-class EFs above unless applying to a base EF without RFI.'},
    {'slug': 'car-rental-diesel', 'name': 'Rental car — Diesel', 'name_tr': 'Kiralık araç — Motorin', 'scope': 'scope3', 'category': 'business_travel', 'country': 'global', 'unit': 'km', 'factor_kg_co2e': 0.1680, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3C-001'},
    {'slug': 'car-rental-petrol', 'name': 'Rental car — Petrol', 'name_tr': 'Kiralık araç — Benzin', 'scope': 'scope3', 'category': 'business_travel', 'country': 'global', 'unit': 'km', 'factor_kg_co2e': 0.1799, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3C-002'},
    {'slug': 'car-rental-electric', 'name': 'Rental car — Electric (Turkey grid)', 'name_tr': 'Kiralık araç — Elektrik (Türkiye şebekesi)', 'scope': 'scope3', 'category': 'business_travel', 'country': 'turkey', 'unit': 'km', 'factor_kg_co2e': 0.0630, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3C-003 — TR grid EF x avg consumption'},
    {'slug': 'ferry-travel', 'name': 'Ferry / Ship (passenger)', 'name_tr': 'Feribot / Gemi (yolcu)', 'scope': 'scope3', 'category': 'business_travel', 'country': 'global', 'unit': 'person-km', 'factor_kg_co2e': 0.0190, 'source': 'defra_2024', 'reference': 'DESNZ 2024 ferry, foot passenger (0.01871; stored 0.019 is within 1.6%); the all-passenger average is 0.1127 / DESNZ 2024 feribot, yaya yolcu (0,01871; kayıtlı 0,019 değeri %1,6 içinde); tüm yolcu ortalaması 0,1127'},
    {'slug': 'hotel-standard', 'name': 'Hotel — Standard', 'name_tr': 'Otel — Standart', 'scope': 'scope3', 'category': 'business_travel', 'country': 'global', 'unit': 'nights', 'factor_kg_co2e': 0.0820, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3S-010 — Cornell Hotel Sustainability Benchmarking'},
    # Hotel stay in Turkey, per room-night — DESNZ/DEFRA 2024 "Hotel stay" sheet, the
    # value the Turkey ISO 14064-1 verified inventory uses (3.5 SEYAHAT). K3C6-2 BT-10.
    {'slug': 'hotel-turkey', 'name': 'Hotel stay — Turkey (room per night)', 'name_tr': 'Otel konaklaması — Türkiye (oda/gece)', 'scope': 'scope3', 'category': 'business_travel', 'country': 'turkey', 'unit': 'nights', 'factor_kg_co2e': 32.1, 'source': 'defra_2024', 'reference': 'DESNZ/DEFRA 2024 GHG conversion factors — Hotel stay, Turkey, room per night'},
    {'slug': 'hotel-luxury-5star', 'name': 'Hotel — Luxury (5-star, Western Europe)', 'name_tr': 'Otel — Lüks (5 yıldız, Batı Avrupa)', 'scope': 'scope3', 'category': 'business_travel', 'country': 'global', 'unit': 'nights', 'factor_kg_co2e': 0.1640, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3S-011 — Cornell Hotel Sustainability Benchmarking'},

    # ============================================
    # SCOPE 3 - EMPLOYEE COMMUTING (Global)
    # ============================================
    {'slug': 'car-commute', 'name': 'Car', 'name_tr': 'Otomobil', 'scope': 'scope3', 'category': 'employee_commuting', 'country': 'global', 'unit': 'km', 'factor_kg_co2e': 0.171, 'source': 'generic', 'reference': 'Scope 3 Cat 7 platform estimate (0.171 kg CO2e/km), within 0.7% of the average-car value 0.16983 used in the owner\'s calculation document (DEFRA 2023); not a GHG Protocol factor / Kapsam 3 Kat. 7 platform tahmini (0,171 kg CO2e/km); sahibin hesap dokümanındaki ortalama otomobil değerinin (0,16983; DEFRA 2023) %0,7 içinde; GHG Protocol faktörü değildir', 'year': 2024},
    {'slug': 'bus-commute', 'name': 'Bus', 'name_tr': 'Otobüs', 'scope': 'scope3', 'category': 'employee_commuting', 'country': 'global', 'unit': 'km', 'factor_kg_co2e': 0.089, 'source': 'generic', 'reference': 'GHG Protocol – Scope 3 Cat 7 estimate', 'year': 2024},
    {'slug': 'train-commute', 'name': 'Train', 'name_tr': 'Tren', 'scope': 'scope3', 'category': 'employee_commuting', 'country': 'global', 'unit': 'km', 'factor_kg_co2e': 0.041, 'source': 'generic', 'reference': 'GHG Protocol – Scope 3 Cat 7 estimate', 'year': 2024},
    {'slug': 'motorcycle-commute', 'name': 'Motorcycle', 'name_tr': 'Motosiklet', 'scope': 'scope3', 'category': 'employee_commuting', 'country': 'global', 'unit': 'km', 'factor_kg_co2e': 0.113, 'source': 'generic', 'reference': 'GHG Protocol – Scope 3 Cat 7 estimate', 'year': 2024},
    {'slug': 'bicycle-commute', 'name': 'Bicycle', 'name_tr': 'Bisiklet', 'scope': 'scope3', 'category': 'employee_commuting', 'country': 'global', 'unit': 'km', 'factor_kg_co2e': 0.0, 'source': 'generic', 'reference': 'Zero emission transport mode', 'year': 2024},

    # SCOPE 3 - EMPLOYEE COMMUTING — K3C7 fields not previously covered
    {'slug': 'ev-commute-turkey', 'name': 'Electric vehicle commute (Turkey grid)', 'name_tr': 'Elektrikli araç commute (Türkiye şebekesi)', 'scope': 'scope3', 'category': 'employee_commuting', 'country': 'turkey', 'unit': 'km', 'factor_kg_co2e': 0.0630, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3C-003 — used for K3C7-5 EV employee count'},
    {'slug': 'metro-commute', 'name': 'Metro / light rail (electric)', 'name_tr': 'Metro / Hafif raylı (elektrik)', 'scope': 'scope3', 'category': 'employee_commuting', 'country': 'global', 'unit': 'person-km', 'factor_kg_co2e': 0.0280, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3C-004'},
    {'slug': 'shuttle-bus-commute', 'name': 'Shuttle bus (diesel)', 'name_tr': 'Servis aracı (dizel)', 'scope': 'scope3', 'category': 'employee_commuting', 'country': 'global', 'unit': 'person-km', 'factor_kg_co2e': 0.0890, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3C-005 — used when K3C7-6 shuttle ownership = third_party'},
    {'slug': 'home-office-day', 'name': 'Remote work day (home office)', 'name_tr': 'Uzaktan çalışma günü (ev ofisi)', 'scope': 'scope3', 'category': 'employee_commuting', 'country': 'global', 'unit': 'days', 'factor_kg_co2e': 2.490, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3C-007 — applied to hybrid employees\' remote days (K3C7-1/K3C7-2)'},

    # ============================================
    # SCOPE 3 - WASTE (Global)
    # ============================================
    {'slug': 'general-landfill', 'name': 'General waste (landfill)', 'name_tr': 'Genel atık (düzenli depolama)', 'scope': 'scope3', 'category': 'waste', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 0.57, 'source': 'generic', 'reference': ''},
    {'slug': 'recyclable', 'name': 'Recyclable waste', 'name_tr': 'Geri dönüştürülebilir atık', 'scope': 'scope3', 'category': 'waste', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 0.021, 'source': 'generic', 'reference': ''},
    {'slug': 'organic-compost', 'name': 'Organic compost', 'name_tr': 'Organik kompost', 'scope': 'scope3', 'category': 'waste', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 0.015, 'source': 'generic', 'reference': ''},
    {'slug': 'incineration', 'name': 'Waste incineration', 'name_tr': 'Atık yakma', 'scope': 'scope3', 'category': 'waste', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 0.91, 'source': 'generic', 'reference': ''},

    # SCOPE 3 - WASTE — WT catalog, type x disposal method (K3C5-2/K3C12-1, slug = WT code + method)
    # Metal recycling produces large NEGATIVE emissions (avoided primary production) — this is
    # intentional, not a data error; see the K3C5-2 systemMessage that warns about it.
    {'slug': 'wt-01-landfill', 'name': 'Paper/cardboard — landfill', 'name_tr': 'Kağıt/karton — depolama', 'scope': 'scope3', 'category': 'waste', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 1.2900, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3A-002'},
    {'slug': 'wt-01-recycling', 'name': 'Paper/cardboard — recycling', 'name_tr': 'Kağıt/karton — geri dönüşüm', 'scope': 'scope3', 'category': 'waste', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': -0.1250, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3A-003 — negative: recycling avoids virgin production'},
    {'slug': 'wt-02-landfill', 'name': 'Mixed plastic — landfill', 'name_tr': 'Plastik karışık — depolama', 'scope': 'scope3', 'category': 'waste', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 0.1070, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3A-004'},
    {'slug': 'wt-03-recycling', 'name': 'Steel — recycling', 'name_tr': 'Çelik — geri dönüşüm', 'scope': 'scope3', 'category': 'waste', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': -0.5060, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3A-006 — negative: avoids virgin steel production'},
    {'slug': 'wt-04-recycling', 'name': 'Aluminium — recycling', 'name_tr': 'Alüminyum — geri dönüşüm', 'scope': 'scope3', 'category': 'waste', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': -9.1000, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3A-005 — very high negative EF, avoids energy-intensive primary aluminium production'},
    {'slug': 'wt-06-compost', 'name': 'Organic/food — compost', 'name_tr': 'Organik/gıda — kompost', 'scope': 'scope3', 'category': 'waste', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 0.0820, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3A-007'},
    {'slug': 'wt-06-anaerobic', 'name': 'Organic/food — anaerobic digestion', 'name_tr': 'Organik/gıda — anaerobik çürütme', 'scope': 'scope3', 'category': 'waste', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 0.0110, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3A-008'},
    {'slug': 'wt-07-licensed', 'name': 'E-waste (WEEE) — licensed contractor', 'name_tr': 'Elektronik (WEEE) — lisanslı bertaraf firması', 'scope': 'scope3', 'category': 'waste', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 0.0230, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3A-009'},
    {'slug': 'wt-10-landfill', 'name': 'Mixed municipal waste — landfill (blended)', 'name_tr': 'Karma belediye atığı — depolama (karma)', 'scope': 'scope3', 'category': 'waste', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 0.4670, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3A-001 — default when composition unknown (K3C5-2b total-quantity fallback)'},
    {'slug': 'waste-per-employee-default', 'name': 'Waste per employee (sector default)', 'name_tr': 'Çalışan başına atık varsayılanı (sektörel)', 'scope': 'scope3', 'category': 'waste', 'country': 'global', 'unit': 'employees', 'factor_kg_co2e': 115.0, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3A-010 — kg/employee/year, used when no company-specific waste data is available (K3C5-1 level S3)'},

    # SCOPE 3 - WASTE (Turkey)
    {'slug': 'landfill', 'name': 'Landfill (Turkey)', 'name_tr': 'Düzenli depolama (Türkiye)', 'scope': 'scope3', 'category': 'waste', 'country': 'turkey', 'unit': 'kg', 'factor_kg_co2e': 0.54, 'source': 'turkey_grid', 'reference': ''},
    {'slug': 'recyclable', 'name': 'Recyclable (Turkey)', 'name_tr': 'Geri dönüşüm (Türkiye)', 'scope': 'scope3', 'category': 'waste', 'country': 'turkey', 'unit': 'kg', 'factor_kg_co2e': 0.017, 'source': 'turkey_grid', 'reference': ''},
    {'slug': 'organic-compost', 'name': 'Organic compost (Turkey)', 'name_tr': 'Organik kompost (Türkiye)', 'scope': 'scope3', 'category': 'waste', 'country': 'turkey', 'unit': 'kg', 'factor_kg_co2e': 0.014, 'source': 'turkey_grid', 'reference': ''},
    {'slug': 'incineration', 'name': 'Incineration (Turkey)', 'name_tr': 'Yakma (Türkiye)', 'scope': 'scope3', 'category': 'waste', 'country': 'turkey', 'unit': 'kg', 'factor_kg_co2e': 0.82, 'source': 'turkey_grid', 'reference': ''},

    # ============================================
    # SCOPE 3 - UPSTREAM LEASED ASSETS
    # ============================================
    {'slug': 'office-space', 'name': 'Leased office space', 'name_tr': 'Kiralık ofis alanı', 'scope': 'scope3', 'category': 'upstream_leased', 'country': 'global', 'unit': 'm2', 'factor_kg_co2e': 0.055, 'source': 'generic', 'reference': 'GHG Protocol – Scope 3 Cat 8 estimate (per m2/day annualized)', 'year': 2024},
    {'slug': 'warehouse', 'name': 'Leased warehouse', 'name_tr': 'Kiralık depo', 'scope': 'scope3', 'category': 'upstream_leased', 'country': 'global', 'unit': 'm2', 'factor_kg_co2e': 0.035, 'source': 'generic', 'reference': 'GHG Protocol – Scope 3 Cat 8 estimate (per m2/day annualized)', 'year': 2024},
    {'slug': 'leased-vehicles', 'name': 'Leased vehicles (per year)', 'name_tr': 'Kiralık araçlar (yıllık)', 'scope': 'scope3', 'category': 'upstream_leased', 'country': 'global', 'unit': 'units', 'factor_kg_co2e': 4500.0, 'source': 'generic', 'reference': 'GHG Protocol – Scope 3 Cat 8 estimate (per vehicle/year)', 'year': 2024},

    # ============================================
    # SCOPE 3 - DOWNSTREAM TRANSPORTATION
    # ============================================
    {'slug': 'truck-delivery', 'name': 'Truck delivery', 'name_tr': 'Kamyon teslimatı', 'scope': 'scope3', 'category': 'downstream_transport', 'country': 'global', 'unit': 'tonne-km', 'factor_kg_co2e': 0.107, 'source': 'generic', 'reference': 'GHG Protocol – Scope 3 Cat 9 estimate', 'year': 2024},
    {'slug': 'courier', 'name': 'Courier service', 'name_tr': 'Kurye hizmeti', 'scope': 'scope3', 'category': 'downstream_transport', 'country': 'global', 'unit': 'packages', 'factor_kg_co2e': 0.55, 'source': 'generic', 'reference': 'GHG Protocol – Scope 3 Cat 9 estimate', 'year': 2024},
    {'slug': 'postal', 'name': 'Postal service', 'name_tr': 'Posta hizmeti', 'scope': 'scope3', 'category': 'downstream_transport', 'country': 'global', 'unit': 'packages', 'factor_kg_co2e': 0.21, 'source': 'generic', 'reference': 'GHG Protocol – Scope 3 Cat 9 estimate', 'year': 2024},

    # SCOPE 3 - DOWNSTREAM TRANSPORTATION — GLEC v3 / ISO 14083 TM catalog (K3C9-1, slug = TM code)
    # Question Map: k3c9_transport_mode reuses the same TM catalog as K3C4. Slugs are suffixed
    # '-ds' because EmissionFactor's uniqueness is (slug, country, year) — NOT category — so an
    # identical slug here would silently overwrite the upstream_transport row above via
    # seed_factors.py's update_or_create instead of creating a second, distinct row.
    {'slug': 'tm-01-ds', 'name': 'Road — HGV 40t full load', 'name_tr': 'Karayolu — HTC 40t tam dolu', 'scope': 'scope3', 'category': 'downstream_transport', 'country': 'global', 'unit': 'tonne-km', 'factor_kg_co2e': 0.062, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3T-001 — GLEC Framework v3 Tier 1, ISO 14083'},
    {'slug': 'tm-02-ds', 'name': 'Road — HGV 40t 50% load', 'name_tr': 'Karayolu — HTC 40t %50 dolu', 'scope': 'scope3', 'category': 'downstream_transport', 'country': 'global', 'unit': 'tonne-km', 'factor_kg_co2e': 0.123, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3T-002 — GLEC v3 default load factor'},
    {'slug': 'tm-03-ds', 'name': 'Road — Light commercial (≤3.5t)', 'name_tr': 'Karayolu — Hafif ticari (≤3.5t)', 'scope': 'scope3', 'category': 'downstream_transport', 'country': 'global', 'unit': 'tonne-km', 'factor_kg_co2e': 0.205, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3T-003'},
    {'slug': 'tm-04-ds', 'name': 'Sea — Large container (>10,000 TEU)', 'name_tr': 'Denizyolu — Konteyner büyük (>10.000 TEU)', 'scope': 'scope3', 'category': 'downstream_transport', 'country': 'global', 'unit': 'tonne-km', 'factor_kg_co2e': 0.005, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3T-004 — GLEC v3'},
    {'slug': 'tm-05-ds', 'name': 'Sea — Medium container (3,000–8,000 TEU)', 'name_tr': 'Denizyolu — Konteyner orta (3.000–8.000 TEU)', 'scope': 'scope3', 'category': 'downstream_transport', 'country': 'global', 'unit': 'tonne-km', 'factor_kg_co2e': 0.011, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3T-005 — GLEC v3'},
    {'slug': 'tm-06-ds', 'name': 'Sea — Bulk cargo', 'name_tr': 'Denizyolu — Dökme yük', 'scope': 'scope3', 'category': 'downstream_transport', 'country': 'global', 'unit': 'tonne-km', 'factor_kg_co2e': 0.008, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3T-006 — GLEC v3'},
    {'slug': 'tm-07-ds', 'name': 'Air — Cargo (long haul)', 'name_tr': 'Havayolu — Kargo uzun mesafe', 'scope': 'scope3', 'category': 'downstream_transport', 'country': 'global', 'unit': 'tonne-km', 'factor_kg_co2e': 0.602, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3T-007 — GLEC v3, RFI included'},
    {'slug': 'tm-07-short-ds', 'name': 'Air — Cargo (short/medium haul)', 'name_tr': 'Havayolu — Kargo kısa/orta mesafe', 'scope': 'scope3', 'category': 'downstream_transport', 'country': 'global', 'unit': 'tonne-km', 'factor_kg_co2e': 0.853, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3T-008 — GLEC v3'},
    {'slug': 'tm-08-ds', 'name': 'Rail (electric)', 'name_tr': 'Demiryolu (elektrikli)', 'scope': 'scope3', 'category': 'downstream_transport', 'country': 'global', 'unit': 'tonne-km', 'factor_kg_co2e': 0.028, 'source': 'defra_2024', 'reference': 'CarbonIQ EF Katalogu EF-K3T-009'},

    # ============================================
    # SCOPE 3 - END OF LIFE
    # ============================================
    {'slug': 'product-recycling', 'name': 'Product recycling', 'name_tr': 'Ürün geri dönüşümü', 'scope': 'scope3', 'category': 'end_of_life', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 0.021, 'source': 'generic', 'reference': 'GHG Protocol – Scope 3 Cat 12 estimate', 'year': 2024},
    {'slug': 'product-landfill', 'name': 'Product landfill', 'name_tr': 'Ürün düzenli depolama', 'scope': 'scope3', 'category': 'end_of_life', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 0.586, 'source': 'generic', 'reference': 'GHG Protocol – Scope 3 Cat 12 estimate', 'year': 2024},
    {'slug': 'product-incineration', 'name': 'Product incineration', 'name_tr': 'Ürün yakma', 'scope': 'scope3', 'category': 'end_of_life', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 0.695, 'source': 'generic', 'reference': 'GHG Protocol – Scope 3 Cat 12 estimate', 'year': 2024},

    # ============================================
    # SCOPE 3 - FRANCHISES
    # ============================================
    {'slug': 'franchise-operations', 'name': 'Franchise operations (per franchise/year)', 'name_tr': 'Franchise operasyonları (yıllık)', 'scope': 'scope3', 'category': 'franchises', 'country': 'global', 'unit': 'franchises', 'factor_kg_co2e': 15000.0, 'source': 'generic', 'reference': 'GHG Protocol – Scope 3 Cat 14 estimate', 'year': 2024},

    # ============================================
    # SCOPE 3 - INVESTMENTS
    # ============================================
    {'slug': 'equity-investments', 'name': 'Equity investments', 'name_tr': 'Öz sermaye yatırımları', 'scope': 'scope3', 'category': 'investments', 'country': 'global', 'unit': 'usd', 'factor_kg_co2e': 0.00022, 'source': 'generic', 'reference': 'GHG Protocol – Scope 3 Cat 15 estimate', 'year': 2024},
    {'slug': 'debt-investments', 'name': 'Debt investments', 'name_tr': 'Borç yatırımları', 'scope': 'scope3', 'category': 'investments', 'country': 'global', 'unit': 'usd', 'factor_kg_co2e': 0.00015, 'source': 'generic', 'reference': 'GHG Protocol – Scope 3 Cat 15 estimate', 'year': 2024},

    # ============================================
    # SCOPE 1 - PROCESS EMISSIONS (GHG Protocol Cat)
    # ============================================
    {'slug': 'cement-clinker', 'name': 'Cement clinker production', 'name_tr': 'Çimento klinker üretimi', 'scope': 'scope1', 'category': 'process_emissions', 'country': 'global', 'unit': 'tonnes', 'factor_kg_co2e': 525.0, 'source': 'ipcc_2006', 'reference': '525 kg CO2/t clinker: cement-industry protocol default (secondary evidence; protocol text not reviewed); IPCC 2006 Vol 3 Ch 2 Eq. 2.4 gives 520 / 525 kg CO2/t klinker: çimento sektörü protokolü varsayılan değeri (ikincil kanıt; protokol metni incelenmedi); IPCC 2006 Cilt 3 Böl. 2 Denk. 2.4 değeri 520'},
    {'slug': 'lime-production', 'name': 'Lime production', 'name_tr': 'Kireç üretimi', 'scope': 'scope1', 'category': 'process_emissions', 'country': 'global', 'unit': 'tonnes', 'factor_kg_co2e': 750.0, 'source': 'ipcc_2006', 'reference': 'IPCC 2006 – Vol 3, Ch 2 (750 kg CO2/t lime)'},
    {'slug': 'steel-bof', 'name': 'Steel (BOF route)', 'name_tr': 'Çelik (BOF yöntemi)', 'scope': 'scope1', 'category': 'process_emissions', 'country': 'global', 'unit': 'tonnes', 'factor_kg_co2e': 1800.0, 'source': 'ipcc_2006', 'reference': 'IPCC 2006 – Vol 3, Ch 4 (1.8 t CO2/t steel)'},
    {'slug': 'steel-eaf', 'name': 'Steel (EAF route)', 'name_tr': 'Çelik (EAF yöntemi)', 'scope': 'scope1', 'category': 'process_emissions', 'country': 'global', 'unit': 'tonnes', 'factor_kg_co2e': 400.0, 'source': 'ipcc_2006', 'reference': 'IPCC 2006 – Vol 3, Ch 4 (0.4 t CO2/t steel)'},
    {'slug': 'aluminium-smelting', 'name': 'Aluminium smelting', 'name_tr': 'Alüminyum eritme', 'scope': 'scope1', 'category': 'process_emissions', 'country': 'global', 'unit': 'tonnes', 'factor_kg_co2e': 1650.0, 'source': 'ipcc_2006', 'reference': 'IPCC 2006 – Vol 3, Ch 4 (1.65 t CO2/t Al)'},
    {'slug': 'glass-production', 'name': 'Glass production', 'name_tr': 'Cam üretimi', 'scope': 'scope1', 'category': 'process_emissions', 'country': 'global', 'unit': 'tonnes', 'factor_kg_co2e': 200.0, 'source': 'ipcc_2006', 'reference': 'IPCC 2006 – Vol 3, Ch 2 (0.2 t CO2/t glass)'},
    {'slug': 'ammonia-production', 'name': 'Ammonia production', 'name_tr': 'Amonyak üretimi', 'scope': 'scope1', 'category': 'process_emissions', 'country': 'global', 'unit': 'tonnes', 'factor_kg_co2e': 1500.0, 'source': 'ipcc_2006', 'reference': 'IPCC 2006 – Vol 3, Ch 3 (1.5 t CO2/t NH3)'},
    {'slug': 'nitric-acid', 'name': 'Nitric acid production', 'name_tr': 'Nitrik asit üretimi', 'scope': 'scope1', 'category': 'process_emissions', 'country': 'global', 'unit': 'tonnes', 'factor_kg_co2e': 2050.0, 'source': 'ipcc_2006', 'reference': 'IPCC 2006 – Vol 3, Ch 3 (N2O → CO2e)'},

    # ============================================
    # SCOPE 3 - PROCESSING OF SOLD PRODUCTS (Cat 10)
    # ============================================
    {'slug': 'processing-energy-intensive', 'name': 'Energy-intensive processing', 'name_tr': 'Enerji yoğun işleme', 'scope': 'scope3', 'category': 'processing_sold', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 0.5, 'source': 'generic', 'reference': 'GHG Protocol – Scope 3 Cat 10 estimate', 'year': 2024},
    {'slug': 'processing-light', 'name': 'Light processing / assembly', 'name_tr': 'Hafif işleme / montaj', 'scope': 'scope3', 'category': 'processing_sold', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 0.15, 'source': 'generic', 'reference': 'GHG Protocol – Scope 3 Cat 10 estimate', 'year': 2024},
    {'slug': 'processing-chemical', 'name': 'Chemical processing', 'name_tr': 'Kimyasal işleme', 'scope': 'scope3', 'category': 'processing_sold', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 0.8, 'source': 'generic', 'reference': 'GHG Protocol – Scope 3 Cat 10 estimate', 'year': 2024},

    # ============================================
    # SCOPE 3 - USE OF SOLD PRODUCTS (Cat 11)
    # ============================================
    {'slug': 'product-electricity-use', 'name': 'Product electricity use (lifetime)', 'name_tr': 'Ürün elektrik tüketimi (ömür boyu)', 'scope': 'scope3', 'category': 'use_of_sold', 'country': 'global', 'unit': 'kwh', 'factor_kg_co2e': 0.5, 'source': 'generic', 'reference': 'GHG Protocol – Scope 3 Cat 11 (grid avg)', 'year': 2024},
    {'slug': 'product-fuel-use', 'name': 'Product fuel use (lifetime)', 'name_tr': 'Ürün yakıt tüketimi (ömür boyu)', 'scope': 'scope3', 'category': 'use_of_sold', 'country': 'global', 'unit': 'liters', 'factor_kg_co2e': 2.7, 'source': 'generic', 'reference': 'Scope 3 Cat 11 platform estimate (diesel equivalent, 2.7), within 1.4% of the documented diesel factor 2.66253; not a GHG Protocol factor / Kapsam 3 Kat. 11 platform tahmini (dizel eşdeğeri, 2,7); belgelenmiş dizel faktörünün (2,66253) %1,4 içinde; GHG Protocol faktörü değildir', 'year': 2024},
    {'slug': 'product-gas-use', 'name': 'Product gas use (lifetime)', 'name_tr': 'Ürün gaz tüketimi (ömür boyu)', 'scope': 'scope3', 'category': 'use_of_sold', 'country': 'global', 'unit': 'gj', 'factor_kg_co2e': 56.1, 'source': 'ipcc_2019', 'reference': 'IPCC 2019 – natural gas', 'year': 2024},

    # ============================================
    # SCOPE 3 - DOWNSTREAM LEASED ASSETS (Cat 13)
    # ============================================
    {'slug': 'leased-building-downstream', 'name': 'Leased building (downstream)', 'name_tr': 'Kiralanan bina (aşağı akış)', 'scope': 'scope3', 'category': 'downstream_leased', 'country': 'global', 'unit': 'm2', 'factor_kg_co2e': 0.06, 'source': 'generic', 'reference': 'GHG Protocol – Scope 3 Cat 13 estimate', 'year': 2024},
    {'slug': 'leased-vehicle-downstream', 'name': 'Leased vehicle (downstream)', 'name_tr': 'Kiralanan araç (aşağı akış)', 'scope': 'scope3', 'category': 'downstream_leased', 'country': 'global', 'unit': 'units', 'factor_kg_co2e': 2500.0, 'source': 'generic', 'reference': 'GHG Protocol – Scope 3 Cat 13 estimate', 'year': 2024},
    {'slug': 'leased-equipment-downstream', 'name': 'Leased equipment (downstream)', 'name_tr': 'Kiralanan ekipman (aşağı akış)', 'scope': 'scope3', 'category': 'downstream_leased', 'country': 'global', 'unit': 'units', 'factor_kg_co2e': 2500.0, 'source': 'generic', 'reference': 'GHG Protocol – Scope 3 Cat 13 estimate', 'year': 2024},

    # ============================================
    # SCOPE 3 - EMPLOYEE COMMUTING (Turkey)
    # ============================================
    {'slug': 'car-commute', 'name': 'Car commute (Turkey)', 'name_tr': 'Otomobil (Türkiye)', 'scope': 'scope3', 'category': 'employee_commuting', 'country': 'turkey', 'unit': 'km', 'factor_kg_co2e': 0.172, 'source': 'turkey_fleet', 'reference': 'Turkey fleet 2025 – avg car', 'year': 2024},
    {'slug': 'bus-commute', 'name': 'Bus commute (Turkey)', 'name_tr': 'Otobüs (Türkiye)', 'scope': 'scope3', 'category': 'employee_commuting', 'country': 'turkey', 'unit': 'km', 'factor_kg_co2e': 0.095, 'source': 'turkey_fleet', 'reference': 'Turkey urban bus', 'year': 2024},
    {'slug': 'metro-commute', 'name': 'Metro commute (Turkey)', 'name_tr': 'Metro (Türkiye)', 'scope': 'scope3', 'category': 'employee_commuting', 'country': 'turkey', 'unit': 'km', 'factor_kg_co2e': 0.028, 'source': 'turkey_fleet', 'reference': 'Istanbul/Ankara metro', 'year': 2024},
    {'slug': 'dolmus-commute', 'name': 'Dolmuş commute (Turkey)', 'name_tr': 'Dolmuş (Türkiye)', 'scope': 'scope3', 'category': 'employee_commuting', 'country': 'turkey', 'unit': 'km', 'factor_kg_co2e': 0.082, 'source': 'turkey_fleet', 'reference': 'Shared urban transport', 'year': 2024},

    # ============================================
    # SCOPE 1 - NATURAL GAS (volume & energy units) — DEFRA 2024
    # ============================================
    {'slug': 'natural-gas-kwh', 'name': 'Natural Gas (kWh)', 'name_tr': 'Doğal Gaz (kWh)', 'scope': 'scope1', 'category': 'stationary_combustion', 'country': 'global', 'unit': 'kWh', 'factor_kg_co2e': 0.18316, 'source': 'defra_2024', 'reference': 'DEFRA 2024 – Natural Gas, Gross CV (0.18316 kg CO2e/kWh)'},
    {'slug': 'natural-gas-m3', 'name': 'Natural Gas (m³)', 'name_tr': 'Doğal Gaz (m³)', 'scope': 'scope1', 'category': 'stationary_combustion', 'country': 'global', 'unit': 'm3', 'factor_kg_co2e': 2.02, 'source': 'defra_2024', 'reference': 'Fixed per-m³ value adopted by the platform (2.02; equals the DEFRA 2020 figure 2.02266, rounded); not a DEFRA 2024 factor (DESNZ 2024 gives 2.04542); owner approval pending / Platform tarafından benimsenen sabit m³ değeri (2,02; DEFRA 2020 değeri 2,02266\'nın yuvarlanmışı); DEFRA 2024 faktörü değildir (DESNZ 2024: 2,04542); sahip onayı beklemektedir'},
    {'slug': 'natural-gas-kwh', 'name': 'Natural Gas (kWh) (Turkey)', 'name_tr': 'Doğal Gaz (kWh) (Türkiye)', 'scope': 'scope1', 'category': 'stationary_combustion', 'country': 'turkey', 'unit': 'kWh', 'factor_kg_co2e': 0.18316, 'source': 'defra_2024', 'reference': 'DEFRA 2024 – Natural Gas'},
    {'slug': 'natural-gas-m3', 'name': 'Natural Gas (m³) (Turkey)', 'name_tr': 'Doğal Gaz (m³) (Türkiye)', 'scope': 'scope1', 'category': 'stationary_combustion', 'country': 'turkey', 'unit': 'm3', 'factor_kg_co2e': 2.02, 'source': 'defra_2024', 'reference': 'Fixed per-m³ value adopted by the platform (2.02; equals the DEFRA 2020 figure 2.02266, rounded); not a DEFRA 2024 factor (DESNZ 2024 gives 2.04542); owner approval pending / Platform tarafından benimsenen sabit m³ değeri (2,02; DEFRA 2020 değeri 2,02266\'nın yuvarlanmışı); DEFRA 2024 faktörü değildir (DESNZ 2024: 2,04542); sahip onayı beklemektedir'},

    # SCOPE 1 - DIESEL (kWh) — DEFRA 2024
    {'slug': 'diesel-kwh', 'name': 'Diesel (kWh)', 'name_tr': 'Dizel (kWh)', 'scope': 'scope1', 'category': 'stationary_combustion', 'country': 'global', 'unit': 'kWh', 'factor_kg_co2e': 0.24882, 'source': 'defra_2024', 'reference': 'DEFRA 2024 – Gas Oil, Gross CV (the cited row gives 0.25649; the stored 0.24882 is 3.0% lower and matches no DEFRA edition) / DEFRA 2024 – Gaz yağı, brüt kalorifik değer (atıf yapılan satır 0,25649; kayıtlı 0,24882 değeri %3,0 düşüktür ve hiçbir DEFRA baskısıyla eşleşmez)'},

    # SCOPE 1 - BIOFUELS — DEFRA 2024
    {'slug': 'biodiesel', 'name': 'Biodiesel', 'name_tr': 'Biyodizel', 'scope': 'scope1', 'category': 'stationary_combustion', 'country': 'global', 'unit': 'liters', 'factor_kg_co2e': 0.03639, 'source': 'defra_2024', 'reference': 'DEFRA 2024 – Bioenergy, Biodiesel (biogenic CO2 excluded)'},
    {'slug': 'bioethanol', 'name': 'Bioethanol', 'name_tr': 'Biyoetanol', 'scope': 'scope1', 'category': 'stationary_combustion', 'country': 'global', 'unit': 'liters', 'factor_kg_co2e': 0.02719, 'source': 'defra_2024', 'reference': 'DEFRA 2024 – Bioenergy, Bioethanol'},
    {'slug': 'wood-pellets', 'name': 'Wood pellets', 'name_tr': 'Odun peleti', 'scope': 'scope1', 'category': 'stationary_combustion', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 0.01553, 'source': 'defra_2024', 'reference': 'DEFRA 2024 – Bioenergy, Wood pellets'},
    {'slug': 'biogas', 'name': 'Biogas', 'name_tr': 'Biyogaz', 'scope': 'scope1', 'category': 'stationary_combustion', 'country': 'global', 'unit': 'kWh', 'factor_kg_co2e': 0.00022, 'source': 'defra_2024', 'reference': 'DEFRA 2024 – Bioenergy, Biogas'},

    # ============================================
    # SCOPE 2 - ELECTRICITY (More Countries) — IEA 2024
    # ============================================
    {'slug': 'uk-grid', 'name': 'UK grid', 'name_tr': 'İngiltere şebekesi', 'scope': 'scope2', 'category': 'electricity', 'country': 'global', 'unit': 'kwh', 'factor_kg_co2e': 0.207, 'source': 'defra_2024', 'reference': 'DEFRA 2024 – UK Electricity'},
    *DESNZ_2025_UK,
    {'slug': 'germany-grid', 'name': 'Germany grid', 'name_tr': 'Almanya şebekesi', 'scope': 'scope2', 'category': 'electricity', 'country': 'global', 'unit': 'kwh', 'factor_kg_co2e': 0.364, 'source': 'iea_2024', 'reference': 'IEA 2024 – Germany electricity mix'},
    {'slug': 'france-grid', 'name': 'France grid', 'name_tr': 'Fransa şebekesi', 'scope': 'scope2', 'category': 'electricity', 'country': 'global', 'unit': 'kwh', 'factor_kg_co2e': 0.052, 'source': 'iea_2024', 'reference': 'IEA 2024 – France (nuclear dominant)'},
    {'slug': 'india-grid', 'name': 'India grid', 'name_tr': 'Hindistan şebekesi', 'scope': 'scope2', 'category': 'electricity', 'country': 'global', 'unit': 'kwh', 'factor_kg_co2e': 0.708, 'source': 'iea_2024', 'reference': 'IEA 2024 – India electricity mix'},
    {'slug': 'japan-grid', 'name': 'Japan grid', 'name_tr': 'Japonya şebekesi', 'scope': 'scope2', 'category': 'electricity', 'country': 'global', 'unit': 'kwh', 'factor_kg_co2e': 0.457, 'source': 'iea_2024', 'reference': 'IEA 2024 – Japan electricity mix'},
    {'slug': 'brazil-grid', 'name': 'Brazil grid', 'name_tr': 'Brezilya şebekesi', 'scope': 'scope2', 'category': 'electricity', 'country': 'global', 'unit': 'kwh', 'factor_kg_co2e': 0.074, 'source': 'iea_2024', 'reference': 'IEA 2024 – Brazil (hydro dominant)'},
    {'slug': 'australia-grid', 'name': 'Australia grid', 'name_tr': 'Avustralya şebekesi', 'scope': 'scope2', 'category': 'electricity', 'country': 'global', 'unit': 'kwh', 'factor_kg_co2e': 0.656, 'source': 'iea_2024', 'reference': 'IEA 2024 – Australia electricity mix'},
    {'slug': 'canada-grid', 'name': 'Canada grid', 'name_tr': 'Kanada şebekesi', 'scope': 'scope2', 'category': 'electricity', 'country': 'global', 'unit': 'kwh', 'factor_kg_co2e': 0.120, 'source': 'iea_2024', 'reference': 'IEA 2024 – Canada (hydro dominant)'},
    {'slug': 'south-korea-grid', 'name': 'South Korea grid', 'name_tr': 'Güney Kore şebekesi', 'scope': 'scope2', 'category': 'electricity', 'country': 'global', 'unit': 'kwh', 'factor_kg_co2e': 0.415, 'source': 'iea_2024', 'reference': 'IEA 2024 – South Korea electricity mix'},
    {'slug': 'saudi-arabia-grid', 'name': 'Saudi Arabia grid', 'name_tr': 'Suudi Arabistan şebekesi', 'scope': 'scope2', 'category': 'electricity', 'country': 'global', 'unit': 'kwh', 'factor_kg_co2e': 0.579, 'source': 'iea_2024', 'reference': 'IEA 2024 – Saudi Arabia'},
    {'slug': 'uae-grid', 'name': 'UAE grid', 'name_tr': 'BAE şebekesi', 'scope': 'scope2', 'category': 'electricity', 'country': 'global', 'unit': 'kwh', 'factor_kg_co2e': 0.404, 'source': 'iea_2024', 'reference': 'IEA 2024 – UAE electricity mix'},

    # ============================================
    # SCOPE 3 - HOTEL ACCOMMODATION (Business Travel Cat 6) — DEFRA 2024
    # ============================================
    {'slug': 'hotel-uk', 'name': 'Hotel (UK)', 'name_tr': 'Otel (İngiltere)', 'scope': 'scope3', 'category': 'business_travel', 'country': 'global', 'unit': 'nights', 'factor_kg_co2e': 10.5, 'source': 'defra_2024', 'reference': 'DEFRA 2024 – Hotel stay, UK average'},
    {'slug': 'hotel-global-avg', 'name': 'Hotel (global average)', 'name_tr': 'Otel (dünya ortalaması)', 'scope': 'scope3', 'category': 'business_travel', 'country': 'global', 'unit': 'nights', 'factor_kg_co2e': 20.6, 'source': 'defra_2024', 'reference': 'DEFRA 2024 – Hotel stay, global average'},
    {'slug': 'hotel-luxury', 'name': 'Hotel (luxury/5-star)', 'name_tr': 'Otel (lüks/5 yıldız)', 'scope': 'scope3', 'category': 'business_travel', 'country': 'global', 'unit': 'nights', 'factor_kg_co2e': 33.4, 'source': 'defra_2024', 'reference': 'DEFRA 2024 – Hotel stay, luxury'},

    # ============================================
    # SCOPE 3 - WFH & REMOTE WORK (Cat 7) — DEFRA 2024
    # ============================================
    {'slug': 'wfh-day', 'name': 'Working from home (per day)', 'name_tr': 'Evden çalışma (günlük)', 'scope': 'scope3', 'category': 'employee_commuting', 'country': 'global', 'unit': 'days', 'factor_kg_co2e': 0.79, 'source': 'defra_2024', 'reference': 'DEFRA 2024 – Homeworking (heating + electricity)'},

    # ============================================
    # SCOPE 1 - REFRIGERANTS (additional) — DEFRA 2024
    # ============================================
    {'slug': 'r134a', 'name': 'R-134a (HFC-134a)', 'name_tr': 'R-134a', 'scope': 'scope1', 'category': 'fugitive_emissions', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 1430, 'source': 'defra_2024', 'reference': 'GWP100 1430 is the IPCC AR4 value (AR6: 1530, IPCC AR6 WG1 Table 7.SM.7); the stored value is not an AR6 value / KIP100 1430 IPCC AR4 değeridir (AR6: 1530, IPCC AR6 WG1 Tablo 7.SM.7); kayıtlı değer bir AR6 değeri değildir'},
    {'slug': 'r404a', 'name': 'R-404A', 'name_tr': 'R-404A', 'scope': 'scope1', 'category': 'fugitive_emissions', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 3922, 'source': 'defra_2024', 'reference': 'GWP100 3922 is the IPCC AR4 blend value; the owner\'s 2023 document uses the DEFRA 2023 blend value 3943; the AR6 components compute to about 4728; the stored value is not an AR6 value / KIP100 3922 IPCC AR4 karışım değeridir; sahibin 2023 dokümanı DEFRA 2023 karışım değerini (3943) kullanır; AR6 bileşenleri yaklaşık 4728 verir; kayıtlı değer bir AR6 değeri değildir'},
    {'slug': 'r407c', 'name': 'R-407C', 'name_tr': 'R-407C', 'scope': 'scope1', 'category': 'fugitive_emissions', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 1774, 'source': 'defra_2024', 'reference': 'DEFRA 2024 – AR6 GWP100'},
    {'slug': 'r32', 'name': 'R-32', 'name_tr': 'R-32', 'scope': 'scope1', 'category': 'fugitive_emissions', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 675, 'source': 'defra_2024', 'reference': 'GWP100 675 is the IPCC AR4 value (AR6: 771, IPCC AR6 WG1 Table 7.SM.7); the stored value is not an AR6 value / KIP100 675 IPCC AR4 değeridir (AR6: 771, IPCC AR6 WG1 Tablo 7.SM.7); kayıtlı değer bir AR6 değeri değildir'},
    {'slug': 'sf6', 'name': 'SF6 (Sulphur hexafluoride)', 'name_tr': 'SF6 (Kükürt heksaflorür)', 'scope': 'scope1', 'category': 'fugitive_emissions', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 25200, 'source': 'defra_2024', 'reference': 'GWP100 25,200 = IPCC AR6 WG1 Table 7.SM.7 (equals the owner\'s 2023 document); not a DEFRA 2024 value: DESNZ 2024 and the owner\'s 2024 file use 23,500 (the AR5 value) / KIP100 25.200 = IPCC AR6 WG1 Tablo 7.SM.7 (sahibin 2023 dokümanıyla aynı); DEFRA 2024 değeri değildir: DESNZ 2024 ve sahibin 2024 dosyası 23.500 (AR5 değeri) kullanır'},
    {'slug': 'co2-fire-suppression', 'name': 'CO2 fire suppression', 'name_tr': 'CO2 yangın söndürme', 'scope': 'scope1', 'category': 'fugitive_emissions', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 1.0, 'source': 'ipcc_2006', 'reference': 'IPCC 2006 – direct CO2'},
    {'slug': 'n2o', 'name': 'Nitrous Oxide (N2O)', 'name_tr': 'Azot Oksit (N2O)', 'scope': 'scope1', 'category': 'fugitive_emissions', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 273, 'source': 'ipcc_2019', 'reference': 'IPCC AR6 GWP100'},

    # ============================================
    # SCOPE 3 - PURCHASED SERVICES (Spend-based) — DEFRA 2024
    # ============================================
    {'slug': 'food-catering', 'name': 'Food & catering services', 'name_tr': 'Yemek ve catering hizmetleri', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'global', 'unit': 'usd', 'factor_kg_co2e': 0.52, 'source': 'defra_2024', 'reference': 'Unsourced platform estimate; not a DEFRA/DESNZ factor (the DESNZ 2024 workbook publishes no spend-based factors) / Kaynağı belirsiz platform tahmini; DEFRA/DESNZ faktörü değildir (DESNZ 2024 çalışma kitabında harcama bazlı faktör yoktur)'},
    {'slug': 'cleaning-services', 'name': 'Cleaning services', 'name_tr': 'Temizlik hizmetleri', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'global', 'unit': 'usd', 'factor_kg_co2e': 0.19, 'source': 'defra_2024', 'reference': 'Unsourced platform estimate; not a DEFRA/DESNZ factor (the DESNZ 2024 workbook publishes no spend-based factors) / Kaynağı belirsiz platform tahmini; DEFRA/DESNZ faktörü değildir (DESNZ 2024 çalışma kitabında harcama bazlı faktör yoktur)'},
    {'slug': 'legal-accounting', 'name': 'Legal & accounting services', 'name_tr': 'Hukuk ve muhasebe hizmetleri', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'global', 'unit': 'usd', 'factor_kg_co2e': 0.13, 'source': 'defra_2024', 'reference': 'Unsourced platform estimate; not a DEFRA/DESNZ factor (the DESNZ 2024 workbook publishes no spend-based factors) / Kaynağı belirsiz platform tahmini; DEFRA/DESNZ faktörü değildir (DESNZ 2024 çalışma kitabında harcama bazlı faktör yoktur)'},
    {'slug': 'it-telecom-services', 'name': 'IT & telecom services', 'name_tr': 'BT ve telekom hizmetleri', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'global', 'unit': 'usd', 'factor_kg_co2e': 0.15, 'source': 'defra_2024', 'reference': 'Unsourced platform estimate; not a DEFRA/DESNZ factor (the DESNZ 2024 workbook publishes no spend-based factors) / Kaynağı belirsiz platform tahmini; DEFRA/DESNZ faktörü değildir (DESNZ 2024 çalışma kitabında harcama bazlı faktör yoktur)'},
    {'slug': 'marketing-advertising', 'name': 'Marketing & advertising', 'name_tr': 'Pazarlama ve reklam', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'global', 'unit': 'usd', 'factor_kg_co2e': 0.17, 'source': 'defra_2024', 'reference': 'Unsourced platform estimate; not a DEFRA/DESNZ factor (the DESNZ 2024 workbook publishes no spend-based factors) / Kaynağı belirsiz platform tahmini; DEFRA/DESNZ faktörü değildir (DESNZ 2024 çalışma kitabında harcama bazlı faktör yoktur)'},
]
