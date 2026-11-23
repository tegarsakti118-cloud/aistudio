NEXORA AGNES STORY PRODUCTION PATCH
==================================

Patch ini menambahkan integrasi Nexora ke Agnes Video Generator mode Multi-shot Story.
Hanya tiga file proyek yang berubah/ditambahkan:
- index.html
- js/ui/videoProductionView.js
- js/services/agnesProductionService.js (baru)

YANG DILAKUKAN
- Menambah panel koneksi server Agnes di Video Production.
- Tombol Periksa Koneksi membaca GET /api/models.
- Tombol Generate Story mengirim naskah ke POST /api/tasks/creative.
- Nexora memantau GET /api/tasks/{task_id} sampai selesai.
- Preview dan unduh MP4 dari GET /api/video/{task_id}.
- Prompt meminta video vertikal 9:16, cerita 90-110 detik, karakter konsisten, animasi 3D, dialog, musik, dan subtitle.

PENTING: PERSYARATAN SERVER
Patch ini TIDAK menyertakan server Agnes. Agnes Video Generator adalah layanan Python yang perlu dijalankan/di-host terpisah.
Dokumentasi resmi proyek:
https://github.com/lcy362/agnes-video-generator
API:
https://github.com/lcy362/agnes-video-generator/blob/master/docs/public/api.md

Menurut dokumentasi Agnes, server memerlukan Python 3.10+; FFmpeg dibutuhkan untuk setup manual (opsi Docker/npm membundel FFmpeg).
Server perlu bisa diakses dari browser Nexora melalui HTTPS. URL server dimasukkan pada panel AI Story Production.

CORS
Jika Nexora dan Agnes berada di domain berbeda, server Agnes harus mengizinkan origin domain Nexora.
Dokumentasi Agnes menggunakan AGNES_CORS_ORIGINS, contoh:
AGNES_CORS_ORIGINS=https://DOMAIN-NEXORA-KAMU
AGNES_CORS_ENABLED=auto

Jangan masukkan API key Agnes ke JavaScript Nexora. API key disimpan di konfigurasi server Agnes melalui Web UI atau environment variable AGNES_API_KEY.

LANGKAH PASANG
1. Ekstrak ZIP patch.
2. Salin folder/file sesuai struktur ke root proyek Nexora.
3. Timpa index.html dan js/ui/videoProductionView.js.
4. Tambahkan js/services/agnesProductionService.js.
5. Deploy ulang website Nexora.
6. Setelah server Agnes aktif dan CORS benar, masukkan URL HTTPS server Agnes di Video Production.
7. Tekan Periksa Koneksi, lalu Generate Story.

BATASAN
- Kode ini sudah diperiksa sintaks JavaScript dan struktur file, tetapi belum dapat diuji end-to-end tanpa server Agnes aktif dan kredensial Agnes di server tersebut.
- API kreatif Agnes dapat berubah antarversi. Jika endpoint /api/tasks/creative menolak parameter prompt/content_lang atau task tidak mengembalikan task_id, server perlu disesuaikan dengan versi API yang dipasang.
- Durasi 90-110 detik adalah target prompt, bukan jaminan provider. Hasil tergantung model, antrean, dan batas layanan.
- Model gratis Agnes memakai antrean bersama; antrean dapat padat dan proses dapat lama.
- Integrasi ini bukan jaminan hasil identik dengan video referensi. Perlu uji hasil dan penyesuaian prompt.
