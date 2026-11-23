(function (Nexora) {
  'use strict';

  function create(idea, style, count) {
    const beats = [
      ['Pembuka', 'Perkenalkan lokasi, suasana, dan tokoh utama.'],
      ['Pemicu', 'Tampilkan masalah atau tujuan yang menggerakkan cerita.'],
      ['Perjalanan', 'Tokoh mulai bertindak dan menghadapi hambatan pertama.'],
      ['Konflik', 'Tingkatkan ketegangan dengan hambatan terbesar.'],
      ['Klimaks', 'Tokoh mengambil keputusan penting untuk menyelesaikan konflik.'],
      ['Penutup', 'Tunjukkan hasil tindakan dan akhir cerita yang terasa tuntas.'],
      ['Momen tambahan', 'Berikan detail emosional atau kejutan kecil yang relevan.'],
      ['Outro', 'Akhiri dengan visual penutup yang kuat dan mudah diingat.']
    ];
    const safeIdea = String(idea || '').trim();
    return beats.slice(0, count).map((beat, i) => ({
      number: i + 1,
      title: beat[0],
      direction: beat[1],
      prompt: `${style}. Scene ${i + 1}: ${beat[0]}. Story premise: ${safeIdea}. ${beat[1]} Maintain consistent characters, costume, color palette and environment. Cinematic composition, clear subject, expressive action, no text, no watermark.`
    }));
  }

  Nexora.storyboardService = { create };
})(window.Nexora = window.Nexora || {});
