'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/utils/api';
import { Plus, Trash2 } from 'lucide-react';

export default function FacilitySettings({ language }) {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [facilityType, setFacilityType] = useState('');

  const fetchFacilities = async () => {
    try {
      const res = await api.getFacilities();
      if (res.ok) {
        const data = await res.json();
        setFacilities(Array.isArray(data) ? data : data.results || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchFacilities(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    const res = await api.createFacility({ name, city, country, facility_type: facilityType });
    if (res.ok) {
      setShowForm(false);
      setName(''); setCity(''); setCountry(''); setFacilityType('');
      fetchFacilities();
    }
  };

  if (loading) return <p className="text-sm text-[#302817]/55">Loading...</p>;

  return (
    <div>
      {facilities.length === 0 && !showForm && (
        <p className="text-sm text-[#302817]/55 mb-3">{language === 'tr' ? 'Henüz tesis eklenmedi' : 'No facilities added yet'}</p>
      )}

      {facilities.length > 0 && (
        <div className="space-y-2 mb-4">
          {facilities.map(f => (
            <div key={f.id} className="flex items-center justify-between p-3 bg-[#F8F8F8] rounded-xl">
              <div>
                <p className="text-sm font-medium text-[#302817]">{f.name}</p>
                <p className="text-xs text-[#302817]/55">{[f.facility_type, f.city, f.country].filter(Boolean).join(' · ')}</p>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs ${f.is_active ? 'bg-green-100 text-green-700' : 'bg-[#F8F8F8] text-[#302817]/55'}`}>
                {f.is_active ? (language === 'tr' ? 'Aktif' : 'Active') : (language === 'tr' ? 'Pasif' : 'Inactive')}
              </span>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <form onSubmit={handleAdd} className="space-y-3 p-4 bg-[#F8F8F8] rounded-xl">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#302817]/55 mb-1">{language === 'tr' ? 'Tesis Adı' : 'Facility Name'} *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border border-[#302817]/10 rounded-xl text-sm" required />
            </div>
            <div>
              <label className="block text-xs text-[#302817]/55 mb-1">{language === 'tr' ? 'Tür' : 'Type'}</label>
              <select value={facilityType} onChange={e => setFacilityType(e.target.value)} className="w-full px-3 py-2 border border-[#302817]/10 rounded-xl text-sm">
                <option value="">{language === 'tr' ? 'Seçiniz' : 'Select'}</option>
                <option value="Office">{language === 'tr' ? 'Ofis' : 'Office'}</option>
                <option value="Factory">{language === 'tr' ? 'Fabrika' : 'Factory'}</option>
                <option value="Warehouse">{language === 'tr' ? 'Depo' : 'Warehouse'}</option>
                <option value="Store">{language === 'tr' ? 'Mağaza' : 'Store'}</option>
                <option value="Other">{language === 'tr' ? 'Diğer' : 'Other'}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#302817]/55 mb-1">{language === 'tr' ? 'Şehir' : 'City'}</label>
              <input type="text" value={city} onChange={e => setCity(e.target.value)} className="w-full px-3 py-2 border border-[#302817]/10 rounded-xl text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[#302817]/55 mb-1">{language === 'tr' ? 'Ülke' : 'Country'}</label>
              <input type="text" value={country} onChange={e => setCountry(e.target.value)} className="w-full px-3 py-2 border border-[#302817]/10 rounded-xl text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-[#302817] text-white rounded-xl text-sm hover:bg-black">
              {language === 'tr' ? 'Ekle' : 'Add'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-[#302817]/10 rounded-xl text-sm hover:bg-[#F8F8F8]">
              {language === 'tr' ? 'İptal' : 'Cancel'}
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowForm(true)} className="px-4 py-2 text-sm text-[#95A847] border border-[#95A847] rounded-xl hover:bg-[#302817]/10 flex items-center gap-2">
          <Plus className="w-4 h-4" /> {language === 'tr' ? 'Tesis Ekle' : 'Add Facility'}
        </button>
      )}
    </div>
  );
}
