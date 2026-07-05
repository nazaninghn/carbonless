"""
Scope 3 Category Metadata Registry

Centralizes all 15 GHG Protocol Scope 3 emission categories plus water.
Used by the backend factor resolution, API endpoints, AI chat context,
frontend entry forms, and ISO 14064-1 PDF reporting.
"""

SCOPE3_CATEGORIES = {
    'purchased_goods': {
        'ghg_number': 1,
        'name_en': 'Purchased Goods & Services',
        'name_tr': 'Satın Alınan Mallar ve Hizmetler',
        'subtypes': {
            'electrical_large': {'unit': 'kg', 'slug': 'electrical-large', 'name_en': 'Large Electrical Items', 'name_tr': 'Büyük Elektrikli Ürünler'},
            'electrical_small': {'unit': 'kg', 'slug': 'electrical-small', 'name_en': 'Small Electrical Items', 'name_tr': 'Küçük Elektrikli Ürünler'},
            'electrical_it': {'unit': 'kg', 'slug': 'electrical-it', 'name_en': 'IT Equipment', 'name_tr': 'BT Ekipmanları'},
            'glass': {'unit': 'kg', 'slug': 'glass', 'name_en': 'Glass', 'name_tr': 'Cam'},
            'metal_aluminium': {'unit': 'kg', 'slug': 'metal-aluminium', 'name_en': 'Aluminium', 'name_tr': 'Alüminyum'},
            'metal_steel': {'unit': 'kg', 'slug': 'metal-steel-cans', 'name_en': 'Steel', 'name_tr': 'Çelik'},
            'paper_mixed': {'unit': 'kg', 'slug': 'paper-mixed', 'name_en': 'Mixed Paper', 'name_tr': 'Karışık Kağıt'},
            'plastic_average': {'unit': 'kg', 'slug': 'plastic-average', 'name_en': 'Plastic (Average)', 'name_tr': 'Plastik (Ortalama)'},
            'plastic_hdpe': {'unit': 'kg', 'slug': 'plastic-hdpe', 'name_en': 'HDPE Plastic', 'name_tr': 'HDPE Plastik'},
            'wood': {'unit': 'kg', 'slug': 'wood', 'name_en': 'Wood', 'name_tr': 'Ahşap'},
            'chemical': {'unit': 'kg', 'slug': 'chemical', 'name_en': 'Chemicals', 'name_tr': 'Kimyasallar'},
            'mineral_oil': {'unit': 'kg', 'slug': 'mineral-oil', 'name_en': 'Mineral Oil', 'name_tr': 'Mineral Yağ'},
        }
    },
    'capital_goods': {
        'ghg_number': 2,
        'name_en': 'Capital Goods',
        'name_tr': 'Sermaye Malları',
        'subtypes': {
            'machinery': {'unit': 'units', 'slug': 'machinery', 'name_en': 'Machinery', 'name_tr': 'Makineler'},
            'vehicles': {'unit': 'units', 'slug': 'vehicles', 'name_en': 'Vehicles', 'name_tr': 'Araçlar'},
            'buildings': {'unit': 'm2', 'slug': 'buildings', 'name_en': 'Buildings', 'name_tr': 'Binalar'},
            'it_equipment': {'unit': 'units', 'slug': 'it-equipment', 'name_en': 'IT Equipment', 'name_tr': 'BT Ekipmanları'},
        }
    },
    'fuel_energy': {
        'ghg_number': 3,
        'name_en': 'Fuel & Energy Related Activities',
        'name_tr': 'Yakıt ve Enerji İlişkili Faaliyetler',
        'subtypes': {
            'upstream_electricity': {'unit': 'kwh', 'slug': 'upstream-electricity', 'name_en': 'Upstream Electricity', 'name_tr': 'Üst Akış Elektrik'},
            'transmission_losses': {'unit': 'kwh', 'slug': 'transmission-losses', 'name_en': 'Transmission & Distribution Losses', 'name_tr': 'İletim ve Dağıtım Kayıpları'},
            'fuel_extraction': {'unit': 'liters', 'slug': 'fuel-extraction', 'name_en': 'Fuel Extraction', 'name_tr': 'Yakıt Çıkarma'},
        }
    },
    'upstream_transport': {
        'ghg_number': 4,
        'name_en': 'Upstream Transportation & Distribution',
        'name_tr': 'Üst Akış Taşımacılık ve Dağıtım',
        'subtypes': {
            'freight_road': {'unit': 'tonne-km', 'slug': 'freight-road', 'name_en': 'Road Freight', 'name_tr': 'Karayolu Taşımacılığı'},
            'freight_rail': {'unit': 'tonne-km', 'slug': 'freight-rail', 'name_en': 'Rail Freight', 'name_tr': 'Demiryolu Taşımacılığı'},
            'freight_sea': {'unit': 'tonne-km', 'slug': 'freight-sea', 'name_en': 'Sea Freight', 'name_tr': 'Deniz Taşımacılığı'},
        }
    },
    'waste': {
        'ghg_number': 5,
        'name_en': 'Waste Generated in Operations',
        'name_tr': 'Operasyonlarda Oluşan Atıklar',
        'subtypes': {
            'landfill': {'unit': 'kg', 'slug': 'general-landfill', 'name_en': 'Landfill', 'name_tr': 'Düzenli Depolama'},
            'recyclable': {'unit': 'kg', 'slug': 'recyclable', 'name_en': 'Recyclable Waste', 'name_tr': 'Geri Dönüştürülebilir Atık'},
            'organic_compost': {'unit': 'kg', 'slug': 'organic-compost', 'name_en': 'Organic Composting', 'name_tr': 'Organik Kompost'},
            'incineration': {'unit': 'kg', 'slug': 'incineration', 'name_en': 'Incineration', 'name_tr': 'Yakma'},
        }
    },
    'business_travel': {
        'ghg_number': 6,
        'name_en': 'Business Travel',
        'name_tr': 'İş Seyahatleri',
        'subtypes': {
            'flight_domestic': {'unit': 'km', 'slug': 'flight-domestic', 'name_en': 'Domestic Flights', 'name_tr': 'Yurtiçi Uçuşlar'},
            'flight_short': {'unit': 'km', 'slug': 'flight-short-haul', 'name_en': 'Short-Haul Flights', 'name_tr': 'Kısa Mesafe Uçuşlar'},
            'flight_long': {'unit': 'km', 'slug': 'flight-long-haul', 'name_en': 'Long-Haul Flights', 'name_tr': 'Uzun Mesafe Uçuşlar'},
            'train': {'unit': 'km', 'slug': 'train', 'name_en': 'Train', 'name_tr': 'Tren'},
            'car_rental': {'unit': 'km', 'slug': 'car-rental', 'name_en': 'Car Rental', 'name_tr': 'Araç Kiralama'},
        }
    },
    'employee_commuting': {
        'ghg_number': 7,
        'name_en': 'Employee Commuting',
        'name_tr': 'Çalışan Ulaşımı',
        'subtypes': {
            'car_commute': {'unit': 'km', 'slug': 'car-commute', 'name_en': 'Car', 'name_tr': 'Otomobil'},
            'bus_commute': {'unit': 'km', 'slug': 'bus-commute', 'name_en': 'Bus', 'name_tr': 'Otobüs'},
            'train_commute': {'unit': 'km', 'slug': 'train-commute', 'name_en': 'Train', 'name_tr': 'Tren'},
            'motorcycle_commute': {'unit': 'km', 'slug': 'motorcycle-commute', 'name_en': 'Motorcycle', 'name_tr': 'Motosiklet'},
            'bicycle_commute': {'unit': 'km', 'slug': 'bicycle-commute', 'name_en': 'Bicycle', 'name_tr': 'Bisiklet'},
        }
    },
    'upstream_leased': {
        'ghg_number': 8,
        'name_en': 'Upstream Leased Assets',
        'name_tr': 'Kiralanan Varlıklar (Üst Akış)',
        'subtypes': {
            'office_space': {'unit': 'm2', 'slug': 'office-space', 'name_en': 'Office Space', 'name_tr': 'Ofis Alanı'},
            'warehouse': {'unit': 'm2', 'slug': 'warehouse', 'name_en': 'Warehouse', 'name_tr': 'Depo'},
            'leased_vehicles': {'unit': 'units', 'slug': 'leased-vehicles', 'name_en': 'Leased Vehicles', 'name_tr': 'Kiralık Araçlar'},
        }
    },
    'downstream_transport': {
        'ghg_number': 9,
        'name_en': 'Downstream Transportation & Distribution',
        'name_tr': 'Alt Akış Taşımacılık ve Dağıtım',
        'subtypes': {
            'truck_delivery': {'unit': 'tonne-km', 'slug': 'truck-delivery', 'name_en': 'Truck Delivery', 'name_tr': 'Kamyon Teslimat'},
            'courier': {'unit': 'packages', 'slug': 'courier', 'name_en': 'Courier', 'name_tr': 'Kurye'},
            'postal': {'unit': 'packages', 'slug': 'postal', 'name_en': 'Postal Service', 'name_tr': 'Posta Hizmeti'},
        }
    },
    'processing_sold': {
        'ghg_number': 10,
        'name_en': 'Processing of Sold Products',
        'name_tr': 'Satılan Ürünlerin İşlenmesi',
        'subtypes': {
            'energy_intensive': {'unit': 'kg', 'slug': 'processing-energy-intensive', 'name_en': 'Energy Intensive Processing', 'name_tr': 'Enerji Yoğun İşleme'},
            'light': {'unit': 'kg', 'slug': 'processing-light', 'name_en': 'Light Processing', 'name_tr': 'Hafif İşleme'},
            'chemical': {'unit': 'kg', 'slug': 'processing-chemical', 'name_en': 'Chemical Processing', 'name_tr': 'Kimyasal İşleme'},
        }
    },
    'use_of_sold': {
        'ghg_number': 11,
        'name_en': 'Use of Sold Products',
        'name_tr': 'Satılan Ürünlerin Kullanımı',
        'subtypes': {
            'electricity': {'unit': 'kwh', 'slug': 'product-electricity-use', 'name_en': 'Electricity Use', 'name_tr': 'Elektrik Kullanımı'},
            'fuel': {'unit': 'liters', 'slug': 'product-fuel-use', 'name_en': 'Fuel Use', 'name_tr': 'Yakıt Kullanımı'},
            'gas': {'unit': 'gj', 'slug': 'product-gas-use', 'name_en': 'Gas Use', 'name_tr': 'Gaz Kullanımı'},
        }
    },
    'end_of_life': {
        'ghg_number': 12,
        'name_en': 'End-of-Life Treatment of Sold Products',
        'name_tr': 'Satılan Ürünlerin Ömür Sonu İşlemleri',
        'subtypes': {
            'product_recycling': {'unit': 'kg', 'slug': 'product-recycling', 'name_en': 'Product Recycling', 'name_tr': 'Ürün Geri Dönüşümü'},
            'product_landfill': {'unit': 'kg', 'slug': 'product-landfill', 'name_en': 'Product Landfill', 'name_tr': 'Ürün Düzenli Depolama'},
            'product_incineration': {'unit': 'kg', 'slug': 'product-incineration', 'name_en': 'Product Incineration', 'name_tr': 'Ürün Yakma'},
        }
    },
    'downstream_leased': {
        'ghg_number': 13,
        'name_en': 'Downstream Leased Assets',
        'name_tr': 'Kiralanan Varlıklar (Alt Akış)',
        'subtypes': {
            'leased_building': {'unit': 'm2', 'slug': 'leased-building-downstream', 'name_en': 'Leased Building', 'name_tr': 'Kiralık Bina'},
            'leased_equipment': {'unit': 'units', 'slug': 'leased-equipment-downstream', 'name_en': 'Leased Equipment', 'name_tr': 'Kiralık Ekipman'},
        }
    },
    'franchises': {
        'ghg_number': 14,
        'name_en': 'Franchises',
        'name_tr': 'Franchise İşletmeler',
        'subtypes': {
            'franchise_operations': {'unit': 'franchises', 'slug': 'franchise-operations', 'name_en': 'Franchise Operations', 'name_tr': 'Franchise Operasyonları'},
        }
    },
    'investments': {
        'ghg_number': 15,
        'name_en': 'Investments',
        'name_tr': 'Yatırımlar',
        'subtypes': {
            'equity_investments': {'unit': 'usd', 'slug': 'equity-investments', 'name_en': 'Equity Investments', 'name_tr': 'Özkaynak Yatırımları'},
            'debt_investments': {'unit': 'usd', 'slug': 'debt-investments', 'name_en': 'Debt Investments', 'name_tr': 'Borç Yatırımları'},
        }
    },
    'water': {
        'ghg_number': None,  # Not one of the 15 GHG Protocol categories
        'name_en': 'Water Supply & Treatment',
        'name_tr': 'Su Temini ve Arıtma',
        'subtypes': {
            'water_supply': {'unit': 'm3', 'slug': 'water-supply', 'name_en': 'Water Supply', 'name_tr': 'Su Temini'},
            'water_treatment': {'unit': 'm3', 'slug': 'water-treatment', 'name_en': 'Wastewater Treatment', 'name_tr': 'Atıksu Arıtma'},
        }
    },
}

# Mapping of Scope 3 category keys to their GHG Protocol category numbers (1-15).
# Water is excluded as it is not one of the 15 standard GHG Protocol categories.
SCOPE3_GHG_NUMBER = {
    'purchased_goods': 1,
    'capital_goods': 2,
    'fuel_energy': 3,
    'upstream_transport': 4,
    'waste': 5,
    'business_travel': 6,
    'employee_commuting': 7,
    'upstream_leased': 8,
    'downstream_transport': 9,
    'processing_sold': 10,
    'use_of_sold': 11,
    'end_of_life': 12,
    'downstream_leased': 13,
    'franchises': 14,
    'investments': 15,
}
