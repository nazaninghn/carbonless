"""
Complete GHG Emission Factors Registry
Based on: Defra/DESNZ 2024, IPCC 2006/2019 + AR6 GWP, ATOM KABLO ISO 14064-1, Turkey national data
Formula: Emission (kg CO2e) = Activity Amount x Emission Factor
"""

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
    {'slug': 'off-road-gasoline-desnz', 'name': 'Off-Road Gasoline (DESNZ)', 'name_tr': 'Arazi Dışı Benzin (DESNZ)', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'global', 'unit': 'liters', 'factor_kg_co2e': 2.30233, 'source': 'defra_2024', 'reference': 'DESNZ/Defra 2024'},
    {'slug': 'on-road-petrol-desnz', 'name': 'On-Road Petrol (DESNZ)', 'name_tr': 'Karayolu Benzin (DESNZ)', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'global', 'unit': 'liters', 'factor_kg_co2e': 2.30233, 'source': 'defra_2024', 'reference': 'DESNZ/Defra 2024'},
    {'slug': 'on-road-diesel-desnz', 'name': 'On-Road Diesel (DESNZ)', 'name_tr': 'Karayolu Dizel (DESNZ)', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'global', 'unit': 'liters', 'factor_kg_co2e': 3.17939, 'source': 'defra_2024', 'reference': 'DESNZ/Defra 2024'},
    {'slug': 'gasoline-generic', 'name': 'Gasoline (generic)', 'name_tr': 'Benzin (genel)', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'global', 'unit': 'liters', 'factor_kg_co2e': 2.31, 'source': 'generic', 'reference': ''},
    {'slug': 'diesel-generic', 'name': 'Diesel (generic)', 'name_tr': 'Dizel (genel)', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'global', 'unit': 'liters', 'factor_kg_co2e': 2.68, 'source': 'generic', 'reference': ''},
    {'slug': 'cng', 'name': 'CNG', 'name_tr': 'CNG', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 1.93, 'source': 'generic', 'reference': ''},
    {'slug': 'vehicle-km', 'name': 'Vehicle distance (avg car)', 'name_tr': 'Araç mesafesi (ort. otomobil)', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'global', 'unit': 'km', 'factor_kg_co2e': 0.171, 'source': 'generic', 'reference': ''},

    # SCOPE 1 - MOBILE / TRANSPORTATION (Turkey)
    {'slug': 'flight-domestic', 'name': 'Domestic Flight (Turkey)', 'name_tr': 'Yurtiçi Uçuş (Türkiye)', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'turkey', 'unit': 'km', 'factor_kg_co2e': 0.232, 'source': 'turkey_fleet', 'reference': 'Turkish Airlines 2025 – new fleet'},
    {'slug': 'flight-international', 'name': 'International Flight', 'name_tr': 'Uluslararası Uçuş', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'turkey', 'unit': 'km', 'factor_kg_co2e': 0.148, 'source': 'icao', 'reference': 'ICAO 2025'},
    {'slug': 'train', 'name': 'Train (Turkey)', 'name_tr': 'Tren (Türkiye)', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'turkey', 'unit': 'km', 'factor_kg_co2e': 0.035, 'source': 'turkey_fleet', 'reference': 'TCDD – electrified lines'},
    {'slug': 'metro', 'name': 'Metro (Turkey)', 'name_tr': 'Metro (Türkiye)', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'turkey', 'unit': 'km', 'factor_kg_co2e': 0.028, 'source': 'turkey_fleet', 'reference': 'Istanbul/Ankara metro'},
    {'slug': 'bus', 'name': 'Bus (Turkey)', 'name_tr': 'Otobüs (Türkiye)', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'turkey', 'unit': 'km', 'factor_kg_co2e': 0.095, 'source': 'turkey_fleet', 'reference': 'Urban buses'},
    {'slug': 'dolmus', 'name': 'Dolmuş (shared minibus)', 'name_tr': 'Dolmuş', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'turkey', 'unit': 'km', 'factor_kg_co2e': 0.082, 'source': 'turkey_fleet', 'reference': 'Shared urban transport'},
    {'slug': 'car-gasoline', 'name': 'Car – Gasoline (Turkey)', 'name_tr': 'Otomobil – Benzin (Türkiye)', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'turkey', 'unit': 'km', 'factor_kg_co2e': 0.172, 'source': 'turkey_fleet', 'reference': 'Turkey fleet 2025 – Euro 6d'},
    {'slug': 'car-diesel', 'name': 'Car – Diesel (Turkey)', 'name_tr': 'Otomobil – Dizel (Türkiye)', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'turkey', 'unit': 'km', 'factor_kg_co2e': 0.156, 'source': 'turkey_fleet', 'reference': 'Turkey fleet 2025'},
    {'slug': 'car-lpg', 'name': 'Car – LPG (Turkey)', 'name_tr': 'Otomobil – LPG (Türkiye)', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'turkey', 'unit': 'km', 'factor_kg_co2e': 0.163, 'source': 'turkey_fleet', 'reference': 'Turkey LPG vehicles 2025'},
    {'slug': 'car-electric', 'name': 'Car – Electric (Turkey)', 'name_tr': 'Otomobil – Elektrikli (Türkiye)', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'turkey', 'unit': 'km', 'factor_kg_co2e': 0.045, 'source': 'turkey_fleet', 'reference': 'EVs on Turkey grid 2025'},
    {'slug': 'car-hybrid', 'name': 'Car – Hybrid (Turkey)', 'name_tr': 'Otomobil – Hibrit (Türkiye)', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'turkey', 'unit': 'km', 'factor_kg_co2e': 0.089, 'source': 'turkey_fleet', 'reference': 'Hybrid vehicles 2025'},
    {'slug': 'motorin-mobile', 'name': 'Diesel/Motorin – mobile (Turkey)', 'name_tr': 'Motorin – hareketli yanma (Türkiye)', 'scope': 'scope1', 'category': 'mobile_combustion', 'country': 'turkey', 'unit': 'liters', 'factor_kg_co2e': 2.696, 'source': 'atom_kablo', 'reference': 'ATOM KABLO ISO 14064-1 2023 – Sheet 1.2 HAR. YANMA (NKD+density+EF)'},

    # ============================================
    # SCOPE 1 - FUGITIVE EMISSIONS
    # ============================================
    {'slug': 'r410a', 'name': 'R-410A', 'name_tr': 'R-410A Soğutucu Gaz', 'scope': 'scope1', 'category': 'fugitive_emissions', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 2088, 'source': 'defra_2024', 'reference': 'Defra 2024 – Refrigerant & other'},
    {'slug': 'r432a', 'name': 'R-432A', 'name_tr': 'R-432A Soğutucu Gaz', 'scope': 'scope1', 'category': 'fugitive_emissions', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 1940, 'source': 'defra_2024', 'reference': 'Defra 2024 – Refrigerant & other'},
    {'slug': 'r22', 'name': 'HCFC-22 / R-22', 'name_tr': 'HCFC-22 / R-22', 'scope': 'scope1', 'category': 'fugitive_emissions', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 1810, 'source': 'defra_2024', 'reference': 'Defra 2024 – Refrigerant & other'},
    {'slug': 'hfc-227ea', 'name': 'HFC-227ea', 'name_tr': 'HFC-227ea', 'scope': 'scope1', 'category': 'fugitive_emissions', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 3350, 'source': 'defra_2024', 'reference': 'Defra 2024 – Refrigerant & other (GWP 3350)'},
    {'slug': 'r600a', 'name': 'R-600a (Isobutane)', 'name_tr': 'R-600a (İzobütan)', 'scope': 'scope1', 'category': 'fugitive_emissions', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 3.0, 'source': 'defra_2024', 'reference': 'Defra 2024 – low-GWP'},
    {'slug': 'methane', 'name': 'Methane (CH4)', 'name_tr': 'Metan (CH4)', 'scope': 'scope1', 'category': 'fugitive_emissions', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 27.9, 'source': 'ipcc_2019', 'reference': 'IPCC AR6 GWP100'},

    # ============================================
    # SCOPE 2 - ELECTRICITY (Global)
    # ============================================
    {'slug': 'grid-average', 'name': 'Grid average', 'name_tr': 'Şebeke ortalaması', 'scope': 'scope2', 'category': 'electricity', 'country': 'global', 'unit': 'kwh', 'factor_kg_co2e': 0.475, 'source': 'generic', 'reference': ''},
    {'slug': 'us-grid', 'name': 'US grid', 'name_tr': 'ABD şebekesi', 'scope': 'scope2', 'category': 'electricity', 'country': 'global', 'unit': 'kwh', 'factor_kg_co2e': 0.417, 'source': 'generic', 'reference': ''},
    {'slug': 'eu-grid', 'name': 'EU grid', 'name_tr': 'AB şebekesi', 'scope': 'scope2', 'category': 'electricity', 'country': 'global', 'unit': 'kwh', 'factor_kg_co2e': 0.295, 'source': 'generic', 'reference': ''},
    {'slug': 'china-grid', 'name': 'China grid', 'name_tr': 'Çin şebekesi', 'scope': 'scope2', 'category': 'electricity', 'country': 'global', 'unit': 'kwh', 'factor_kg_co2e': 0.581, 'source': 'generic', 'reference': ''},
    {'slug': 'renewable', 'name': '100% renewable', 'name_tr': '%100 yenilenebilir', 'scope': 'scope2', 'category': 'electricity', 'country': 'global', 'unit': 'kwh', 'factor_kg_co2e': 0.0, 'source': 'generic', 'reference': ''},

    # SCOPE 2 - ELECTRICITY (Turkey)
    {'slug': 'turkey-grid', 'name': 'Turkey national grid', 'name_tr': 'Türkiye ulusal şebekesi', 'scope': 'scope2', 'category': 'electricity', 'country': 'turkey', 'unit': 'kwh', 'factor_kg_co2e': 0.4199, 'source': 'atom_kablo', 'reference': 'ATOM KABLO ISO 14064-1 2023 – Şıt 2 İTHAL ENERJİ (CO2=0.4183 + CH4=0.0001 + N2O=0.0015)'},

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

    # SCOPE 3 - WATER (Turkey / ATOM KABLO ISO 14064-1)
    {'slug': 'water-supply', 'name': 'Water supply (Turkey)', 'name_tr': 'Su temini (Türkiye)', 'scope': 'scope3', 'category': 'water', 'country': 'turkey', 'unit': 'm3', 'factor_kg_co2e': 0.1766845466, 'source': 'atom_kablo', 'reference': 'ATOM KABLO ISO 14064-1 2023 – Sheet 4.3.2 KULL.&ATIK SU'},
    {'slug': 'water-treatment', 'name': 'Wastewater treatment (Turkey)', 'name_tr': 'Atık su arıtma (Türkiye)', 'scope': 'scope3', 'category': 'water', 'country': 'turkey', 'unit': 'm3', 'factor_kg_co2e': 0.2013182917, 'source': 'atom_kablo', 'reference': 'ATOM KABLO ISO 14064-1 2023 – Sheet 4.3.2 KULL.&ATIK SU'},

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

    # SCOPE 3 - PURCHASED GOODS (Turkey / ATOM KABLO ISO 14064-1)
    {'slug': 'chemical', 'name': 'Chemical (Turkey)', 'name_tr': 'Kimyasal (Türkiye)', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'turkey', 'unit': 'kg', 'factor_kg_co2e': 2.04, 'source': 'atom_kablo', 'reference': 'ATOM KABLO ISO 14064-1 – 4.1 RAW MATERIALS'},
    {'slug': 'chemical-oil', 'name': 'Chemical oil (Turkey)', 'name_tr': 'Kimyasal yağ (Türkiye)', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'turkey', 'unit': 'kg', 'factor_kg_co2e': 2.04, 'source': 'atom_kablo', 'reference': 'ATOM KABLO ISO 14064-1 – 4.1 RAW MATERIALS'},
    {'slug': 'plastic', 'name': 'Plastic (Turkey)', 'name_tr': 'Plastik (Türkiye)', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'turkey', 'unit': 'kg', 'factor_kg_co2e': 3.102448505, 'source': 'atom_kablo', 'reference': 'ATOM KABLO ISO 14064-1 – E6 = 3102.448505 kg/t'},
    {'slug': 'carton', 'name': 'Carton (Turkey)', 'name_tr': 'Karton (Türkiye)', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'turkey', 'unit': 'kg', 'factor_kg_co2e': 0.868069945, 'source': 'atom_kablo', 'reference': 'ATOM KABLO ISO 14064-1 – EF = 868.069945 kg/t'},
    {'slug': 'metal-primary', 'name': 'Metal (primary) (Turkey)', 'name_tr': 'Metal (birincil) (Türkiye)', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'turkey', 'unit': 'kg', 'factor_kg_co2e': 4.005137775, 'source': 'atom_kablo', 'reference': 'ATOM KABLO ISO 14064-1 – EF = 4005.137775 kg/t'},
    {'slug': 'metal-recycled', 'name': 'Metal (recycled) (Turkey)', 'name_tr': 'Metal (geri dönüşüm) (Türkiye)', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'turkey', 'unit': 'kg', 'factor_kg_co2e': 1.55894894, 'source': 'atom_kablo', 'reference': 'ATOM KABLO ISO 14064-1 – EF = 1558.94894 kg/t'},
    {'slug': 'wood', 'name': 'Wood (Turkey)', 'name_tr': 'Ahşap (Türkiye)', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'turkey', 'unit': 'kg', 'factor_kg_co2e': 0.31261178, 'source': 'atom_kablo', 'reference': 'ATOM KABLO ISO 14064-1 – EF = 312.61178 kg/t'},
    {'slug': 'foam-tape', 'name': 'Foam tape (Turkey)', 'name_tr': 'Köpük bant (Türkiye)', 'scope': 'scope3', 'category': 'purchased_goods', 'country': 'turkey', 'unit': 'kg', 'factor_kg_co2e': 2.586727309, 'source': 'atom_kablo', 'reference': 'ATOM KABLO ISO 14064-1 – EF = 2586.727309 kg/t'},

    # ============================================
    # SCOPE 3 - CAPITAL GOODS
    # ============================================
    {'slug': 'machinery', 'name': 'Machinery', 'name_tr': 'Makine', 'scope': 'scope3', 'category': 'capital_goods', 'country': 'global', 'unit': 'units', 'factor_kg_co2e': 5000.0, 'source': 'generic', 'reference': ''},
    {'slug': 'vehicles', 'name': 'Vehicles', 'name_tr': 'Araçlar', 'scope': 'scope3', 'category': 'capital_goods', 'country': 'global', 'unit': 'units', 'factor_kg_co2e': 6000.0, 'source': 'generic', 'reference': ''},
    {'slug': 'buildings', 'name': 'Buildings/construction', 'name_tr': 'Binalar/inşaat', 'scope': 'scope3', 'category': 'capital_goods', 'country': 'global', 'unit': 'm2', 'factor_kg_co2e': 500.0, 'source': 'generic', 'reference': ''},
    {'slug': 'it-equipment', 'name': 'IT equipment', 'name_tr': 'BT ekipmanı', 'scope': 'scope3', 'category': 'capital_goods', 'country': 'global', 'unit': 'units', 'factor_kg_co2e': 300.0, 'source': 'generic', 'reference': ''},

    # ============================================
    # SCOPE 3 - FUEL & ENERGY RELATED
    # ============================================
    {'slug': 'upstream-electricity', 'name': 'Upstream electricity', 'name_tr': 'Yukarı akış elektrik', 'scope': 'scope3', 'category': 'fuel_energy', 'country': 'global', 'unit': 'kwh', 'factor_kg_co2e': 0.095, 'source': 'generic', 'reference': ''},
    {'slug': 'transmission-losses', 'name': 'T&D losses', 'name_tr': 'İletim ve dağıtım kayıpları', 'scope': 'scope3', 'category': 'fuel_energy', 'country': 'global', 'unit': 'kwh', 'factor_kg_co2e': 0.035, 'source': 'generic', 'reference': ''},
    {'slug': 'fuel-extraction', 'name': 'Fuel extraction & processing', 'name_tr': 'Yakıt çıkarma ve işleme', 'scope': 'scope3', 'category': 'fuel_energy', 'country': 'global', 'unit': 'liters', 'factor_kg_co2e': 0.52, 'source': 'generic', 'reference': ''},

    # ============================================
    # SCOPE 3 - UPSTREAM TRANSPORTATION
    # ============================================
    {'slug': 'truck-freight', 'name': 'Truck freight', 'name_tr': 'Kamyon taşımacılığı', 'scope': 'scope3', 'category': 'upstream_transport', 'country': 'global', 'unit': 'tonne-km', 'factor_kg_co2e': 0.112, 'source': 'generic', 'reference': ''},
    {'slug': 'rail-freight', 'name': 'Rail freight', 'name_tr': 'Demiryolu taşımacılığı', 'scope': 'scope3', 'category': 'upstream_transport', 'country': 'global', 'unit': 'tonne-km', 'factor_kg_co2e': 0.022, 'source': 'generic', 'reference': ''},
    {'slug': 'sea-freight', 'name': 'Sea freight', 'name_tr': 'Deniz taşımacılığı', 'scope': 'scope3', 'category': 'upstream_transport', 'country': 'global', 'unit': 'tonne-km', 'factor_kg_co2e': 0.011, 'source': 'generic', 'reference': ''},
    {'slug': 'air-freight', 'name': 'Air freight', 'name_tr': 'Hava taşımacılığı', 'scope': 'scope3', 'category': 'upstream_transport', 'country': 'global', 'unit': 'tonne-km', 'factor_kg_co2e': 0.602, 'source': 'generic', 'reference': ''},

    # SCOPE 3 - UPSTREAM TRANSPORTATION (Turkey / ATOM KABLO)
    {'slug': 'truck-freight', 'name': 'Truck freight (Turkey)', 'name_tr': 'Kamyon taşımacılığı (Türkiye)', 'scope': 'scope3', 'category': 'upstream_transport', 'country': 'turkey', 'unit': 'tonne-km', 'factor_kg_co2e': 0.823134, 'source': 'atom_kablo', 'reference': 'ATOM KABLO ISO 14064-1 2023 – Sheet 3.1 HAMMADDE NAK.'},
    {'slug': 'sea-freight', 'name': 'Sea freight (Turkey)', 'name_tr': 'Deniz taşımacılığı (Türkiye)', 'scope': 'scope3', 'category': 'upstream_transport', 'country': 'turkey', 'unit': 'tonne-km', 'factor_kg_co2e': 0.01611857, 'source': 'atom_kablo', 'reference': 'ATOM KABLO ISO 14064-1 2023 – Sheet 3.1 HAMMADDE NAK.'},

    # ============================================
    # SCOPE 3 - BUSINESS TRAVEL (Global)
    # ============================================
    {'slug': 'flight-short', 'name': 'Short-haul flight (<500 km)', 'name_tr': 'Kısa mesafe uçuş (<500 km)', 'scope': 'scope3', 'category': 'business_travel', 'country': 'global', 'unit': 'km', 'factor_kg_co2e': 0.255, 'source': 'generic', 'reference': ''},
    {'slug': 'flight-medium', 'name': 'Medium-haul flight (500–3700 km)', 'name_tr': 'Orta mesafe uçuş (500–3700 km)', 'scope': 'scope3', 'category': 'business_travel', 'country': 'global', 'unit': 'km', 'factor_kg_co2e': 0.156, 'source': 'generic', 'reference': ''},
    {'slug': 'flight-long', 'name': 'Long-haul flight (>3700 km)', 'name_tr': 'Uzun mesafe uçuş (>3700 km)', 'scope': 'scope3', 'category': 'business_travel', 'country': 'global', 'unit': 'km', 'factor_kg_co2e': 0.150, 'source': 'generic', 'reference': ''},
    {'slug': 'train-travel', 'name': 'Train', 'name_tr': 'Tren', 'scope': 'scope3', 'category': 'business_travel', 'country': 'global', 'unit': 'km', 'factor_kg_co2e': 0.041, 'source': 'generic', 'reference': ''},
    {'slug': 'taxi', 'name': 'Taxi', 'name_tr': 'Taksi', 'scope': 'scope3', 'category': 'business_travel', 'country': 'global', 'unit': 'km', 'factor_kg_co2e': 0.171, 'source': 'generic', 'reference': ''},
    {'slug': 'bus-travel', 'name': 'Bus', 'name_tr': 'Otobüs', 'scope': 'scope3', 'category': 'business_travel', 'country': 'global', 'unit': 'km', 'factor_kg_co2e': 0.089, 'source': 'generic', 'reference': ''},

    # SCOPE 3 - BUSINESS TRAVEL (Turkey / ATOM KABLO)
    {'slug': 'road-travel', 'name': 'Road travel (Turkey)', 'name_tr': 'Karayolu seyahati (Türkiye)', 'scope': 'scope3', 'category': 'business_travel', 'country': 'turkey', 'unit': 'km', 'factor_kg_co2e': 0.169826449, 'source': 'atom_kablo', 'reference': 'ATOM KABLO ISO 14064-1 2023 – Sheet 3.5 SEYAHAT (CO2+CH4+N2O)'},

    # ============================================
    # SCOPE 3 - EMPLOYEE COMMUTING (Global)
    # ============================================
    {'slug': 'car-commute', 'name': 'Car', 'name_tr': 'Otomobil', 'scope': 'scope3', 'category': 'employee_commuting', 'country': 'global', 'unit': 'km', 'factor_kg_co2e': 0.171, 'source': 'generic', 'reference': ''},
    {'slug': 'bus-commute', 'name': 'Bus', 'name_tr': 'Otobüs', 'scope': 'scope3', 'category': 'employee_commuting', 'country': 'global', 'unit': 'km', 'factor_kg_co2e': 0.089, 'source': 'generic', 'reference': ''},
    {'slug': 'train-commute', 'name': 'Train', 'name_tr': 'Tren', 'scope': 'scope3', 'category': 'employee_commuting', 'country': 'global', 'unit': 'km', 'factor_kg_co2e': 0.041, 'source': 'generic', 'reference': ''},
    {'slug': 'motorcycle-commute', 'name': 'Motorcycle', 'name_tr': 'Motosiklet', 'scope': 'scope3', 'category': 'employee_commuting', 'country': 'global', 'unit': 'km', 'factor_kg_co2e': 0.113, 'source': 'generic', 'reference': ''},
    {'slug': 'bicycle-commute', 'name': 'Bicycle', 'name_tr': 'Bisiklet', 'scope': 'scope3', 'category': 'employee_commuting', 'country': 'global', 'unit': 'km', 'factor_kg_co2e': 0.0, 'source': 'generic', 'reference': ''},

    # ============================================
    # SCOPE 3 - WASTE (Global)
    # ============================================
    {'slug': 'general-landfill', 'name': 'General waste (landfill)', 'name_tr': 'Genel atık (düzenli depolama)', 'scope': 'scope3', 'category': 'waste', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 0.57, 'source': 'generic', 'reference': ''},
    {'slug': 'recyclable', 'name': 'Recyclable waste', 'name_tr': 'Geri dönüştürülebilir atık', 'scope': 'scope3', 'category': 'waste', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 0.021, 'source': 'generic', 'reference': ''},
    {'slug': 'organic-compost', 'name': 'Organic compost', 'name_tr': 'Organik kompost', 'scope': 'scope3', 'category': 'waste', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 0.015, 'source': 'generic', 'reference': ''},
    {'slug': 'incineration', 'name': 'Waste incineration', 'name_tr': 'Atık yakma', 'scope': 'scope3', 'category': 'waste', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 0.91, 'source': 'generic', 'reference': ''},

    # SCOPE 3 - WASTE (Turkey)
    {'slug': 'landfill', 'name': 'Landfill (Turkey)', 'name_tr': 'Düzenli depolama (Türkiye)', 'scope': 'scope3', 'category': 'waste', 'country': 'turkey', 'unit': 'kg', 'factor_kg_co2e': 0.54, 'source': 'turkey_grid', 'reference': ''},
    {'slug': 'recyclable', 'name': 'Recyclable (Turkey)', 'name_tr': 'Geri dönüşüm (Türkiye)', 'scope': 'scope3', 'category': 'waste', 'country': 'turkey', 'unit': 'kg', 'factor_kg_co2e': 0.017, 'source': 'turkey_grid', 'reference': ''},
    {'slug': 'organic-compost', 'name': 'Organic compost (Turkey)', 'name_tr': 'Organik kompost (Türkiye)', 'scope': 'scope3', 'category': 'waste', 'country': 'turkey', 'unit': 'kg', 'factor_kg_co2e': 0.014, 'source': 'turkey_grid', 'reference': ''},
    {'slug': 'incineration', 'name': 'Incineration (Turkey)', 'name_tr': 'Yakma (Türkiye)', 'scope': 'scope3', 'category': 'waste', 'country': 'turkey', 'unit': 'kg', 'factor_kg_co2e': 0.82, 'source': 'turkey_grid', 'reference': ''},

    # ============================================
    # SCOPE 3 - UPSTREAM LEASED ASSETS
    # ============================================
    {'slug': 'office-space', 'name': 'Leased office space (per year)', 'name_tr': 'Kiralık ofis alanı (yıllık)', 'scope': 'scope3', 'category': 'upstream_leased', 'country': 'global', 'unit': 'm2', 'factor_kg_co2e': 45.0, 'source': 'generic', 'reference': ''},
    {'slug': 'warehouse', 'name': 'Leased warehouse (per year)', 'name_tr': 'Kiralık depo (yıllık)', 'scope': 'scope3', 'category': 'upstream_leased', 'country': 'global', 'unit': 'm2', 'factor_kg_co2e': 35.0, 'source': 'generic', 'reference': ''},
    {'slug': 'leased-vehicles', 'name': 'Leased vehicles (per year)', 'name_tr': 'Kiralık araçlar (yıllık)', 'scope': 'scope3', 'category': 'upstream_leased', 'country': 'global', 'unit': 'units', 'factor_kg_co2e': 2500.0, 'source': 'generic', 'reference': ''},

    # ============================================
    # SCOPE 3 - DOWNSTREAM TRANSPORTATION
    # ============================================
    {'slug': 'truck-delivery', 'name': 'Truck delivery', 'name_tr': 'Kamyon teslimatı', 'scope': 'scope3', 'category': 'downstream_transport', 'country': 'global', 'unit': 'tonne-km', 'factor_kg_co2e': 0.112, 'source': 'generic', 'reference': ''},
    {'slug': 'courier', 'name': 'Courier service', 'name_tr': 'Kurye hizmeti', 'scope': 'scope3', 'category': 'downstream_transport', 'country': 'global', 'unit': 'packages', 'factor_kg_co2e': 0.5, 'source': 'generic', 'reference': ''},
    {'slug': 'postal', 'name': 'Postal service', 'name_tr': 'Posta hizmeti', 'scope': 'scope3', 'category': 'downstream_transport', 'country': 'global', 'unit': 'packages', 'factor_kg_co2e': 0.3, 'source': 'generic', 'reference': ''},

    # ============================================
    # SCOPE 3 - END OF LIFE
    # ============================================
    {'slug': 'product-recycling', 'name': 'Product recycling', 'name_tr': 'Ürün geri dönüşümü', 'scope': 'scope3', 'category': 'end_of_life', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 0.021, 'source': 'generic', 'reference': ''},
    {'slug': 'product-landfill', 'name': 'Product landfill', 'name_tr': 'Ürün düzenli depolama', 'scope': 'scope3', 'category': 'end_of_life', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 0.57, 'source': 'generic', 'reference': ''},
    {'slug': 'product-incineration', 'name': 'Product incineration', 'name_tr': 'Ürün yakma', 'scope': 'scope3', 'category': 'end_of_life', 'country': 'global', 'unit': 'kg', 'factor_kg_co2e': 0.91, 'source': 'generic', 'reference': ''},

    # ============================================
    # SCOPE 3 - FRANCHISES
    # ============================================
    {'slug': 'franchise-operations', 'name': 'Franchise operations (per franchise/year)', 'name_tr': 'Franchise operasyonları (yıllık)', 'scope': 'scope3', 'category': 'franchises', 'country': 'global', 'unit': 'franchises', 'factor_kg_co2e': 15000.0, 'source': 'generic', 'reference': ''},

    # ============================================
    # SCOPE 3 - INVESTMENTS
    # ============================================
    {'slug': 'equity-investments', 'name': 'Equity investments', 'name_tr': 'Öz sermaye yatırımları', 'scope': 'scope3', 'category': 'investments', 'country': 'global', 'unit': 'usd', 'factor_kg_co2e': 0.185, 'source': 'generic', 'reference': ''},
    {'slug': 'debt-investments', 'name': 'Debt investments', 'name_tr': 'Borç yatırımları', 'scope': 'scope3', 'category': 'investments', 'country': 'global', 'unit': 'usd', 'factor_kg_co2e': 0.095, 'source': 'generic', 'reference': ''},
]
