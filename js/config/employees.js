(function (Nexora) {
  'use strict';

  Nexora.utils = {
    escapeHtml(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
  };

  Nexora.STATUS = {
    STANDBY: 'Standby',
    WORKING: 'Working',
    REVIEWING: 'Reviewing',
    WAITING_APPROVAL: 'Waiting Approval',
    COMPLETED: 'Completed',
    FAILED: 'Failed'
  };

  Nexora.STATUS_STYLE = {
    'Standby': {
      bg: '#F1F5F9',
      text: '#475569',
      border: '#CBD5E1',
      dot: '#94A3B8',
      badgeClass: 'bg-slate-100 text-slate-600 border border-slate-200'
    },
    'Working': {
      bg: '#E0F2FE',
      text: '#0369A1',
      border: '#7DD3FC',
      dot: '#0284C7',
      badgeClass: 'bg-sky-100 text-sky-700 border border-sky-200'
    },
    'Reviewing': {
      bg: '#E0E7FF',
      text: '#4338CA',
      border: '#A5B4FC',
      dot: '#6366F1',
      badgeClass: 'bg-indigo-100 text-indigo-700 border border-indigo-200'
    },
    'Waiting Approval': {
      bg: '#FEF3C7',
      text: '#B45309',
      border: '#FCD34D',
      dot: '#F59E0B',
      badgeClass: 'bg-amber-100 text-amber-800 border border-amber-300'
    },
    'Completed': {
      bg: '#D1FAE5',
      text: '#047857',
      border: '#6EE7B7',
      dot: '#10B981',
      badgeClass: 'bg-emerald-100 text-emerald-700 border border-emerald-200'
    },
    'Failed': {
      bg: '#FFE4E6',
      text: '#BE123C',
      border: '#FDA4AF',
      dot: '#F43F5E',
      badgeClass: 'bg-rose-100 text-rose-700 border border-rose-200'
    }
  };

  Nexora.EMPLOYEES = [
    {
      id: 'raka',
      name: 'RAKA',
      role: 'Trend Researcher',
      zone: 'Riset & Ide',
      avatarColor: '#0284C7',
      hairColor: '#1E293B',
      skinColor: '#FDBA74',
      shirtColor: '#0EA5E9',
      accessory: 'glasses',
      deskItem: 'radar',
      deskPos: { x: 185, y: 215 },
      personality: 'Analitis, cepat tanggap terhadap sinyal viral, dan selalu memantau pergerakan kompetitor.',
      skills: [
        'Mencari tren konten yang sedang naik',
        'Meneliti strategi dan performa kompetitor',
        'Menganalisis topik potensial bernilai tinggi'
      ],
      defaultTask: 'Memindai 15 topik viral niche AI & produktivitas minggu ini',
      sampleOutput: '[Simulasi - Output Riset]\n• Tren #1: Workflow Automasi AI di HP (+142% minat pencarian)\n• Tren #2: Perbandingan Tools Gratis Kreator 2026\n• Peluang: Konten 45 detik dengan studi kasus nyata.'
    },
    {
      id: 'sari',
      name: 'SARI',
      role: 'Idea Creator',
      zone: 'Riset & Ide',
      avatarColor: '#14B8A6',
      hairColor: '#451A03',
      skinColor: '#FED7AA',
      shirtColor: '#14B8A6',
      accessory: 'headphones',
      deskItem: 'lightbulb',
      deskPos: { x: 575, y: 215 },
      personality: 'Kreatif, imajinatif, dan mahir mengubah data mentah menjadi sudut pandang konten yang menarik.',
      skills: [
        'Membuat konsep dan ide konten segar',
        'Merumuskan judul yang memancing klik',
        'Menentukan target audiens dan skor potensi ide'
      ],
      defaultTask: 'Meracik 5 konsep video pendek dari laporan tren RAKA',
      sampleOutput: '[Simulasi - Bank Ide]\nJudul: "Bangun Studio Konten AI Cuma Pakai HP Android!"\nTarget: Kreator pemula & solopreneur\nSkor Potensi Ide: 92/100'
    },
    {
      id: 'bima',
      name: 'BIMA',
      role: 'Scriptwriter',
      zone: 'Editorial Naskah',
      avatarColor: '#2563EB',
      hairColor: '#0F172A',
      skinColor: '#FDBA74',
      shirtColor: '#3B82F6',
      accessory: 'cap',
      deskItem: 'coffee',
      deskPos: { x: 185, y: 425 },
      personality: 'Ekspresif, persuasif, dan terobsesi dengan 3 detik pertama (hook) yang menghentikan scroll.',
      skills: [
        'Membuat hook pembuka berdaya tarik tinggi',
        'Menulis naskah terstruktur dan mengalir',
        'Menyusun storytelling, CTA, dan caption'
      ],
      defaultTask: 'Menulis naskah 60 detik dengan struktur Hook-Story-CTA',
      sampleOutput: '[Simulasi - Draf Naskah]\nHOOK: "Banyak orang kira bikin studio AI harus pakai laptop mahal..."\nISI: Tunjukkan alur kerja 8 agen AI dalam satu aplikasi ringan.\nCTA: "Simpan video ini dan ikuti progresnya!"'
    },
    {
      id: 'dimas',
      name: 'DIMAS',
      role: 'Script Reviewer',
      zone: 'Editorial Naskah',
      avatarColor: '#0369A1',
      hairColor: '#334155',
      skinColor: '#FED7AA',
      shirtColor: '#6366F1',
      accessory: 'visor',
      deskItem: 'checklist',
      deskPos: { x: 575, y: 425 },
      personality: 'Teliti, objektif, dan berstandar tinggi dalam validasi fakta maupun kekuatan alur cerita.',
      skills: [
        'Memeriksa kejelasan dan logika naskah',
        'Memverifikasi akurasi fakta dan klaim',
        'Mengevaluasi hook serta memberi skor kualitas'
      ],
      defaultTask: 'Mengaudit akurasi fakta & kekuatan hook naskah BIMA',
      sampleOutput: '[Simulasi - Hasil Review]\nSkor Hook: 9.0/10\nFakta: Valid, tidak ada klaim berlebihan.\nCatatan Revisi: Persingkat kalimat transisi di detik ke-18.'
    },
    {
      id: 'laras',
      name: 'LARAS',
      role: 'Video Producer',
      zone: 'Produksi & QC',
      avatarColor: '#0D9488',
      hairColor: '#3B0764',
      skinColor: '#FED7AA',
      shirtColor: '#0D9488',
      accessory: 'beret',
      deskItem: 'camera',
      deskPos: { x: 185, y: 635 },
      personality: 'Visual-minded, terorganisir, dan detail pada tempo adegan serta komposisi layar.',
      skills: [
        'Membuat storyboard adegan per adegan',
        'Menentukan transisi dan pacing visual',
        'Menyiapkan arahan aset & kebutuhan produksi'
      ],
      defaultTask: 'Menyusun storyboard 6 adegan & arahan visual animasi',
      sampleOutput: '[Simulasi - Storyboard]\nScene 1 (0-3s): Zoom-in karakter kantor 2D\nScene 2 (4-15s): Highlight status Working & animasi mengetik\nArahan Visual: Dominasi biru-turquoise, subtitle bold putih.'
    },
    {
      id: 'tio',
      name: 'TIO',
      role: 'Video Reviewer',
      zone: 'Produksi & QC',
      avatarColor: '#0891B2',
      hairColor: '#172554',
      skinColor: '#FDBA74',
      shirtColor: '#0891B2',
      accessory: 'headset',
      deskItem: 'waveform',
      deskPos: { x: 575, y: 635 },
      personality: 'Perfeksionis pada sinkronisasi audio, ketepatan subtitle, dan kenyamanan visual penonton.',
      skills: [
        'Memeriksa kesesuaian video dengan naskah',
        'Mengevaluasi kejelasan subtitle dan audio',
        'Memberikan laporan kelayakan Quality Control'
      ],
      defaultTask: 'Melakukan inspeksi QC audio, subtitle, dan frame rate',
      sampleOutput: '[Simulasi - Laporan QC]\nAudio Mix: Jernih (-14 LUFS)\nSubtitle: Sinkron 100%, tidak menabrak area aman UI\nStatus QC: Layak Terbit.'
    },
    {
      id: 'mel',
      name: 'MEL',
      role: 'Publishing Assistant',
      zone: 'Publikasi & Analitik',
      avatarColor: '#0284C7',
      hairColor: '#7C2D12',
      skinColor: '#FED7AA',
      shirtColor: '#0284C7',
      accessory: 'ribbon',
      deskItem: 'calendar',
      deskPos: { x: 185, y: 845 },
      personality: 'Disiplin pada jadwal prime-time, rapi menata metadata, dan memahami algoritma distribusi.',
      skills: [
        'Menyiapkan caption ramah pembaca',
        'Memilih kombinasi hashtag tertarget',
        'Menyusun jadwal dan metadata publikasi'
      ],
      defaultTask: 'Menyiapkan paket posting & slot jam tayang optimal 19:00 WIB',
      sampleOutput: '[Simulasi - Paket Publikasi]\nJadwal: Hari ini, 19:00 WIB\nHashtag: #NexoraAIStudio #KontenKreator #ProduksiKonten\nMetadata: Kategori Teknologi & Produktivitas.'
    },
    {
      id: 'dina',
      name: 'DINA',
      role: 'Performance Analyst',
      zone: 'Publikasi & Analitik',
      avatarColor: '#0F766E',
      hairColor: '#1E1B4B',
      skinColor: '#FED7AA',
      shirtColor: '#10B981',
      accessory: 'glasses',
      deskItem: 'chart',
      deskPos: { x: 575, y: 845 },
      personality: 'Berbasis data, tajam membaca pola retensi audiens, dan selalu memberi umpan balik strategis.',
      skills: [
        'Menganalisis views, retensi, dan engagement',
        'Mengidentifikasi format konten terbaik',
        'Memberikan rekomendasi siklus riset berikutnya'
      ],
      defaultTask: 'Mengevaluasi metrik engagement & membuat rekomendasi konten lanjutan',
      sampleOutput: '[Simulasi - Insight Analitik]\nRetensi 3 detik pertama: 78%\nEngagement Rate: 6.4%\nRekomendasi ke RAKA & SARI: Perbanyak seri demo fitur kantor virtual.'
    }
  ];

})(window.Nexora = window.Nexora || {});