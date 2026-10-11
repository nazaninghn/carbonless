import { api } from '@/lib/utils/api';

// Downloads an entry's proof document through the ownership-checked
// endpoint (the serializer's proof_document is a raw /media/ URL, not
// served in production). Used by Emisyon Yönetimi and Onay Bekleyenler.
export async function downloadProofDocument(entryId, toast, tr) {
  try {
    const res = await api.downloadProofDocument(entryId);
    if (!res.ok) {
      // 410: the record has a proof but the file is no longer on the server.
      toast?.error(res.status === 410
        ? (tr ? 'Kanıt dosyası sunucuda bulunamadı. Lütfen kaydı düzenleyip dosyayı yeniden yükleyin.'
              : 'The proof file is no longer on the server. Please edit the entry and upload it again.')
        : (tr ? 'Kanıt indirilemedi.' : 'Could not download the proof.'));
      return false;
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] || 'proof';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return true;
  } catch {
    toast?.error(tr ? 'Bağlantı hatası' : 'Connection error');
    return false;
  }
}
