"""Phase 1: replace ONLY the 'reference' text of named seed rows. Asserts each target matches exactly one line
and that nothing else on the line changes. Writes the before/after list with the supporting evidence."""
import csv
import re

SEED = r'D:\ACADEMIA PROJECTS\CARBONLESS\carbonless\carbonless_backend\emissions\seed_data.py'
OUT = r'D:\ACADEMIA PROJECTS\CARBONLESS\carbonless\audit\stage6\label_changes.csv'

NG = ("Fixed per-m³ value adopted by the platform (2.02; equals the DEFRA 2020 figure 2.02266, rounded); "
      "not a DEFRA 2024 factor (DESNZ 2024 gives 2.04542); owner approval pending / "
      "Platform tarafından benimsenen sabit m³ değeri (2,02; DEFRA 2020 değeri 2,02266'nın yuvarlanmışı); "
      "DEFRA 2024 faktörü değildir (DESNZ 2024: 2,04542); sahip onayı beklemektedir")
USD = ("Unsourced platform estimate; not a DEFRA/DESNZ factor (the DESNZ 2024 workbook publishes no spend-based factors) / "
       "Kaynağı belirsiz platform tahmini; DEFRA/DESNZ faktörü değildir (DESNZ 2024 çalışma kitabında harcama bazlı faktör yoktur)")
E_USD = "Stage 5 reconciliation (factor_reconciliation.csv, DR-10): DESNZ 2024 workbook searched, no spend-based factor; documented spend factors come from a 'USD Emission Factors' table not provided."


def car(txt_en, txt_tr):
    return f"{txt_en} / {txt_tr}"


T = {
    ('natural-gas-m3', 'global'): (NG, "Stage 4 flat-file check: DEFRA 2020 natural gas 2.02266 kg CO2e/m3; DESNZ 2024 2.04542; Stage 5 DR-05 (owner's 2023/2024 workbooks give 2.14288 / 1.91242)."),
    ('natural-gas-m3', 'turkey'): (NG, "Same as above (Turkey row has the same value 2.02)."),
    ('cement-clinker', 'global'): (
        "525 kg CO2/t clinker: cement-industry protocol default (secondary evidence; protocol text not reviewed); "
        "IPCC 2006 Vol 3 Ch 2 Eq. 2.4 gives 520 / "
        "525 kg CO2/t klinker: çimento sektörü protokolü varsayılan değeri (ikincil kanıt; protokol metni incelenmedi); "
        "IPCC 2006 Cilt 3 Böl. 2 Denk. 2.4 değeri 520",
        "Stage 4: IPCC 2006 Vol.3 Ch.2 Eq. 2.4 retrieved, 0.52 t CO2/t clinker; 525 not found in the IPCC text. DR-08."),
    ('ferry-travel', 'global'): (
        "DESNZ 2024 ferry, foot passenger (0.01871; stored 0.019 is within 1.6%); the all-passenger average is 0.1127 / "
        "DESNZ 2024 feribot, yaya yolcu (0,01871; kayıtlı 0,019 değeri %1,6 içinde); tüm yolcu ortalaması 0,1127",
        "DESNZ 2024 workbook: foot passenger 0.01871, average (all passenger) 0.1127 (factor_reconciliation.csv, DR-18)."),
    ('fuel-extraction', 'global'): (
        "Scope 3 Cat 3 platform estimate (0.6), within 1.8% of the DEFRA well-to-tank diesel factor 0.61101 (DEFRA 2023 and DESNZ 2024); "
        "not a GHG Protocol factor, the Protocol publishes none / "
        "Kapsam 3 Kat. 3 platform tahmini (0,6); DEFRA kuyudan depoya dizel faktörünün (0,61101; DEFRA 2023 ve DESNZ 2024) %1,8 içinde; "
        "GHG Protocol faktörü değildir, Protokol faktör yayımlamaz",
        "Owner's 2023 calculation document uses WTT diesel 0.61101; GHG Protocol publishes no emission factors (Stage 4 manifest). DR-15."),
    ('car-commute', 'global'): (
        "Scope 3 Cat 7 platform estimate (0.171 kg CO2e/km), within 0.7% of the average-car value 0.16983 used in the owner's calculation document (DEFRA 2023); "
        "not a GHG Protocol factor / "
        "Kapsam 3 Kat. 7 platform tahmini (0,171 kg CO2e/km); sahibin hesap dokümanındaki ortalama otomobil değerinin (0,16983; DEFRA 2023) %0,7 içinde; "
        "GHG Protocol faktörü değildir",
        "Documented value 0.1698264 (calculation document, travel sheet); factor_reconciliation.csv DR-15."),
    ('product-fuel-use', 'global'): (
        "Scope 3 Cat 11 platform estimate (diesel equivalent, 2.7), within 1.4% of the documented diesel factor 2.66253; "
        "not a GHG Protocol factor / "
        "Kapsam 3 Kat. 11 platform tahmini (dizel eşdeğeri, 2,7); belgelenmiş dizel faktörünün (2,66253) %1,4 içinde; "
        "GHG Protocol faktörü değildir",
        "Documented diesel 2.66253 (calculation document); factor_reconciliation.csv DR-15."),
    ('gasoline-generic', 'global'): (
        "Platform generic default (2.31); 1.7% below the documented on-road petrol factor 2.35027; source not established / "
        "Platform genel varsayılan değeri (2,31); belgelenmiş karayolu benzin faktörünün (2,35027) %1,7 altında; kaynak belirlenemedi",
        "factor_reconciliation.csv DR-15 (documented 2.35027)."),
    ('diesel-generic', 'global'): (
        "Platform generic default (2.68); within 0.7% of the documented diesel factor 2.66253; source not established / "
        "Platform genel varsayılan değeri (2,68); belgelenmiş dizel faktörünün (2,66253) %0,7 içinde; kaynak belirlenemedi",
        "factor_reconciliation.csv DR-15 (documented 2.66253)."),
    ('vehicle-km', 'global'): (
        "Platform generic default (0.171 kg CO2e/km); within 0.7% of the documented average-car factor 0.16983; source not established / "
        "Platform genel varsayılan değeri (0,171 kg CO2e/km); belgelenmiş ortalama otomobil faktörünün (0,16983) %0,7 içinde; kaynak belirlenemedi",
        "factor_reconciliation.csv DR-15 (documented 0.1698264)."),
    ('taxi', 'global'): (
        "Platform generic default (0.171 kg CO2e/km); within 0.7% of the documented average-car factor 0.16983; source not established / "
        "Platform genel varsayılan değeri (0,171 kg CO2e/km); belgelenmiş ortalama otomobil faktörünün (0,16983) %0,7 içinde; kaynak belirlenemedi",
        "factor_reconciliation.csv DR-15 (documented 0.1698264)."),
    ('off-road-gasoline-desnz', 'global'): (
        "Value 2.30233 is not a DESNZ 2024 row; it is within 0.21% of the off-road petrol factor 2.30724 derived by the IPCC method in the owner's calculation document / "
        "2,30233 değeri bir DESNZ 2024 satırı değildir; sahibin hesap dokümanında IPCC yöntemiyle türetilen arazi dışı benzin faktörünün (2,30724) %0,21 içindedir",
        "factor_reconciliation.csv DR-15: stored -0.21% from documented 2.30724."),
    ('on-road-petrol-desnz', 'global'): (
        "Value 2.30233 is not a DESNZ 2024 row; it is 2.0% below the on-road petrol factor 2.35027 in the owner's calculation document / "
        "2,30233 değeri bir DESNZ 2024 satırı değildir; sahibin hesap dokümanındaki karayolu benzin faktörünün (2,35027) %2,0 altındadır",
        "factor_reconciliation.csv DR-16: documented 2.35027, stored -2.0%."),
    ('diesel-kwh', 'global'): (
        "DEFRA 2024 – Gas Oil, Gross CV (the cited row gives 0.25649; the stored 0.24882 is 3.0% lower and matches no DEFRA edition) / "
        "DEFRA 2024 – Gaz yağı, brüt kalorifik değer (atıf yapılan satır 0,25649; kayıtlı 0,24882 değeri %3,0 düşüktür ve hiçbir DEFRA baskısıyla eşleşmez)",
        "factor_reconciliation.csv DR-17: cited row 0.25649 (also the 2023 value), no edition matches."),
    ('cleaning-services', 'global'): (USD, E_USD),
    ('food-catering', 'global'): (USD, E_USD),
    ('it-telecom-services', 'global'): (USD, E_USD),
    ('legal-accounting', 'global'): (USD, E_USD),
    ('marketing-advertising', 'global'): (USD, E_USD),
    ('r134a', 'global'): (
        "GWP100 1430 is the IPCC AR4 value (AR6: 1530, IPCC AR6 WG1 Table 7.SM.7); the stored value is not an AR6 value / "
        "KIP100 1430 IPCC AR4 değeridir (AR6: 1530, IPCC AR6 WG1 Tablo 7.SM.7); kayıtlı değer bir AR6 değeri değildir",
        "AR6 Table 7.SM.7 (SHA-256 770db58c...0ba7) 1530; GHG Protocol AR4/AR5/AR6 table AR4 = 1430 (Stage 4 evidence). DR-02."),
    ('r32', 'global'): (
        "GWP100 675 is the IPCC AR4 value (AR6: 771, IPCC AR6 WG1 Table 7.SM.7); the stored value is not an AR6 value / "
        "KIP100 675 IPCC AR4 değeridir (AR6: 771, IPCC AR6 WG1 Tablo 7.SM.7); kayıtlı değer bir AR6 değeri değildir",
        "AR6 Table 7.SM.7 771; GHG Protocol table AR4 = 675. DR-02."),
    ('r22', 'global'): (
        "GWP100 1810 is the IPCC AR4 value (AR6: 1960, IPCC AR6 WG1 Table 7.SM.7); the stored value is not an AR6 value / "
        "KIP100 1810 IPCC AR4 değeridir (AR6: 1960, IPCC AR6 WG1 Tablo 7.SM.7); kayıtlı değer bir AR6 değeri değildir",
        "AR6 Table 7.SM.7 1960; GHG Protocol table AR4 = 1810. DR-02."),
    ('r410a', 'global'): (
        "GWP100 2088 is the IPCC AR4 value (AR6, computed 50% R-32 + 50% R-125: 2255.5); the stored value is not an AR6 value / "
        "KIP100 2088 IPCC AR4 değeridir (AR6, %50 R-32 + %50 R-125 olarak hesaplanan: 2255,5); kayıtlı değer bir AR6 değeri değildir",
        "AR6 Table 7.SM.7: 0.5*771 + 0.5*3740 = 2255.5 (matches the owner's documents); GHG Protocol table AR4 = 2088. DR-02."),
    ('r404a', 'global'): (
        "GWP100 3922 is the IPCC AR4 blend value; the owner's 2023 document uses the DEFRA 2023 blend value 3943; the AR6 components compute to about 4728; the stored value is not an AR6 value / "
        "KIP100 3922 IPCC AR4 karışım değeridir; sahibin 2023 dokümanı DEFRA 2023 karışım değerini (3943) kullanır; AR6 bileşenleri yaklaşık 4728 verir; kayıtlı değer bir AR6 değeri değildir",
        "Owner's calculation document R404A 3943 (DEFRA 2023); AR6 7.SM.7 components 0.44*3740 + 0.52*5810 + 0.04*1530 = 4728.0; GHG Protocol table AR4 = 3922. DR-02b."),
    ('hfc-227ea', 'global'): (
        "GWP100 3350 is the IPCC AR5 value (AR6: 3600, IPCC AR6 WG1 Table 7.SM.7); the stored value is not an AR6 value / "
        "KIP100 3350 IPCC AR5 değeridir (AR6: 3600, IPCC AR6 WG1 Tablo 7.SM.7); kayıtlı değer bir AR6 değeri değildir",
        "AR6 Table 7.SM.7 3600; owner's 2024 file lists 3600; DESNZ 2024 3350 (AR5). DR-02."),
    ('sf6', 'global'): (
        "GWP100 25,200 = IPCC AR6 WG1 Table 7.SM.7 (equals the owner's 2023 document); not a DEFRA 2024 value: DESNZ 2024 and the owner's 2024 file use 23,500 (the AR5 value) / "
        "KIP100 25.200 = IPCC AR6 WG1 Tablo 7.SM.7 (sahibin 2023 dokümanıyla aynı); DEFRA 2024 değeri değildir: DESNZ 2024 ve sahibin 2024 dosyası 23.500 (AR5 değeri) kullanır",
        "AR6 Table 7.SM.7 25,200 (primary); owner's 2023 doc 25,200; owner's 2024 file Referanslar-dogrudan!Q16 23,500. DR-02a."),
}

src = open(SEED, encoding='utf-8', newline='').read()      # keep the file's CRLF line endings untouched
lines = src.split('\n')
REF = re.compile(r"'reference': '((?:[^'\\]|\\.)*)'")
rows = []
for (slug, country), (new, evidence) in T.items():
    hits = [i for i, ln in enumerate(lines)
            if f"'slug': '{slug}'," in ln and f"'country': '{country}'," in ln and "'factor_kg_co2e'" in ln]
    assert len(hits) == 1, (slug, country, hits)
    i = hits[0]
    m = REF.search(lines[i])
    assert m, (slug, country)
    old = m.group(1)
    new_esc = new.replace('\\', '\\\\').replace("'", "\\'")
    assert new_esc.replace("\\'", "'") == new
    lines[i] = lines[i][:m.start(1)] + new_esc + lines[i][m.end(1):]
    val = re.search(r"'factor_kg_co2e': ([^,]+),", lines[i]).group(1)
    rows.append((slug, country, val, old, new, evidence, i + 1))
open(SEED, 'w', encoding='utf-8', newline='').write('\n'.join(lines))
with open(OUT, 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f)
    w.writerow(['slug', 'country', 'value_unchanged', 'seed_line', 'label_before', 'label_after', 'supporting_evidence'])
    for r in rows:
        w.writerow([r[0], r[1], r[2], r[6], r[3], r[4], r[5]])
print(len(rows), 'labels changed')
