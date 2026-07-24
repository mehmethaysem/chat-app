# chat-app

## Docker ile Çalıştırma

1. **API anahtarını ayarla** (isteğe bağlı):
   - `backend/.env` dosyasındaki `OPENROUTER_API_KEY` değerini kendi anahtarınla değiştir.

2. **Oluştur ve başlat**:
   ```bash
   docker compose up --build
   ```

3. **Tarayıcıda aç**:
   - Frontend: `http://localhost:5555` (Flask statik dosyaları sunuyorsa)
   - Alternatif olarak frontend dosyalarını ayrı bir sunucu ile çalıştır.

4. **Durdur**:
   ```bash
   docker compose down
   ```

5. **Veritabanını sıfırla** (volume'u sil):
   ```bash
   docker compose down -v
   ```