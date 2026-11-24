(function (Nexora) {
  'use strict';

  const esc = (v) => (Nexora.utils && Nexora.utils.escapeHtml ? Nexora.utils.escapeHtml(v) : String(v ?? ''));

  let selectedProjectId = null;
  let initialized = false;
  let renderRequestActive = false;

  function getProducibleProjects(wf) {
    return wf.projects.filter((p) => {
      const arts = wf.getProjectArtifacts(p.id);
      return p.final_script || arts.some((a) => a.employee_id === 'bima');
    });
  }

  function getScriptForProject(wf, project) {
    if (!project) return null;
    const arts = wf.getProjectArtifacts(project.id);
    const bimaArt = arts.find((a) => a.employee_id === 'bima');
    return project.final_script || (bimaArt ? bimaArt.content : null);
  }

  function triggerDownload(urlOrText, filename, isText = false) {
    const a = document.createElement('a');
    if (isText) {
      const blob = new Blob([urlOrText], { type: 'text/plain;charset=utf-8' });
      a.href = URL.createObjectURL(blob);
    } else {
      a.href = urlOrText;
    }
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function parseScriptPayload(script) {
    if (!script) return null;
    if (typeof script === 'object') return script;
    if (typeof script === 'string') {
      const trimmed = script.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try { return JSON.parse(trimmed); } catch (_) { return null; }
      }
    }
    return null;
  }

  function buildAllTtsText(project) {
    const raw = getScriptForProject(Nexora.workflowEngine, project);
    const data = parseScriptPayload(raw);
    if (!data || !Array.isArray(data.scenes)) {
      return 'Naskah belum memiliki struktur scenes yang bisa dipisahkan otomatis. Periksa Naskah Final atau format JSON proyek.';
    }
    const blocks = data.scenes.map((scene, index) => {
      const sceneNo = scene.scene_no || index + 1;
      const speaker = scene.speaker || (scene.narration ? 'Narator' : 'Belum ditentukan');
      const lines = [];
      if (scene.dialogue) lines.push(String(scene.dialogue).trim());
      if (scene.narration) lines.push(String(scene.narration).trim());
      const spokenText = lines.filter(Boolean).join('\n');
      if (!spokenText) return '';
      const mood = scene.mood ? ` [${scene.mood}]` : '';
      return `SCENE ${String(sceneNo).padStart(2, '0')} — ${speaker}${mood}\n${spokenText}`;
    }).filter(Boolean);
    return blocks.length ? blocks.join('\n\n') : 'Tidak ditemukan dialog atau narasi pada naskah.';
  }

  function getSerialConfig(projectId) {
    const key = `nexora_serial_config_v1_${projectId}`;
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '{}');
      return {
        title: saved.title || '',
        episode: Math.max(1, Number(saved.episode) || 1),
        previousSummary: saved.previousSummary || '',
        continuityNotes: saved.continuityNotes || '',
        nextHook: saved.nextHook || ''
      };
    } catch (_) {
      return { title: '', episode: 1, previousSummary: '', continuityNotes: '', nextHook: '' };
    }
  }

  function buildClaudePrompt(project, audioFile, audioDurationSec) {
    const wf = Nexora.workflowEngine;
    const serial = getSerialConfig(project.id);
    const script = getScriptForProject(wf, project);
    const artifacts = wf.getProjectArtifacts(project.id);
    const laras = artifacts.find((a) => a.employee_id === 'laras');
    const characters = Nexora.characterLibrary ? Nexora.characterLibrary.list() : [];
    const sceneData = laras ? laras.content : null;
    return [
      'ANDA ADALAH SUTRADARA ANIMASI DAN PEMBUAT VIDEO. Buat video final sungguhan, bukan storyboard, bukan kumpulan gambar diam, dan bukan slideshow.',
      `JUDUL PROYEK: ${project.title}`,
      `NICHE: ${project.niche || '-'}`,
      `PLATFORM: ${project.target_platform || 'TikTok / Reels / Shorts'}`,
      'FORMAT SERIAL: produksi ini adalah satu episode dari serial animasi cerita bersambung, bukan video edukasi lepas. Gunakan gaya film pendek animasi 3D chibi sinematik seperti serial kartun pendek: karakter punya bentuk tubuh chibi, wajah ekspresif, gestur jelas, pencahayaan sinematik, latar konsisten, dan gerakan kamera dinamis. Jangan membuat presentasi, infografik statis, atau slideshow.',
      `JUDUL SERIAL: ${serial.title || project.title}`,
      `EPISODE / PART: ${serial.episode}`,
      `RINGKASAN PART SEBELUMNYA: ${serial.previousSummary || (serial.episode === 1 ? 'Ini Part 1. Perkenalkan dunia cerita dan tokoh secara alami.' : 'Belum diberikan. Jangan mengarang kejadian part sebelumnya; mulai dari informasi naskah episode ini.')}`,
      `CATATAN KESINAMBUNGAN: ${serial.continuityNotes || 'Pertahankan desain karakter, pakaian, warna, suara, lokasi, dan fakta cerita yang sudah ditetapkan.'}`,
      `PENGAIT PART BERIKUTNYA: ${serial.nextHook || 'Akhiri dengan penutup yang memuaskan sekaligus menyisakan rasa penasaran secara alami.'}`,
      'ATURAN SERIAL: episode ini harus terasa sebagai bagian dari satu cerita. Jangan mereset karakter atau memperkenalkan perubahan mendadak. Jika Part lebih dari 1, lanjutkan dari ringkasan sebelumnya. Jangan menyelesaikan seluruh konflik serial dalam satu episode kecuali naskah memerintahkannya.',
      'FORMAT: vertikal 9:16. DURASI FLEKSIBEL, jangan memaksakan video menjadi 15, 30, atau 45 detik jika isi membutuhkan waktu lebih panjang.',
      'ATURAN DURASI ADEGAN WAJIB: angka duration_sec di storyboard hanyalah perkiraan awal, bukan batas waktu. Hitung durasi final dari panjang audio TTS yang benar-benar dilampirkan. Setiap dialog/narasi harus selesai terdengar dengan kecepatan bicara natural. Beri ruang untuk jeda, ekspresi, gerakan karakter, dan transisi. Jangan mempercepat suara, memotong audio, atau memadatkan dialog agar cocok dengan durasi storyboard.',
      `DURASI AUDIO TERDETEKSI DI NEXORA: ${Number.isFinite(audioDurationSec) && audioDurationSec > 0 ? `${Math.round(audioDurationSec)} detik` : 'Belum diketahui; ukur langsung dari file audio terlampir di Claude'}. Durasi video final minimal harus mencakup seluruh audio utama dari awal sampai akhir, ditambah waktu visual/transisi yang diperlukan.`,
      'Jika satu file audio berisi seluruh adegan, dengarkan/analisis urutan ucapan dan tempatkan pergantian adegan mengikuti timing audio. Jika audio dipisah per adegan, gunakan durasi masing-masing file untuk menentukan panjang adegan. Jangan menganggap semua adegan berdurasi sama.',
      'ATURAN TOKOH: nama tokoh cerita harus orisinal. DILARANG memakai nama karyawan Nexora seperti RAKA, SARI, BIMA, DIMAS, LARAS, TIO, MEL, atau DINA sebagai nama tokoh cerita. Pertahankan wajah, pakaian, warna, proporsi, dan suara setiap tokoh secara konsisten di semua adegan.',
      'ATURAN PRODUKSI VISUAL: buat animasi bergerak yang berkelanjutan pada setiap adegan, dengan gestur tubuh, ekspresi wajah, gerakan kamera, dan transisi yang halus. Dilarang membuat slideshow, rangkaian gambar diam, atau adegan yang hanya diberi efek zoom.',
      'ATURAN AUDIO WAJIB: ikuti jenis suara yang tertulis di NASKAH FINAL. Jika naskah berisi narasi, hasilkan voice-over narator. Jika naskah berisi dialog tokoh, ucapkan dialog tersebut dengan suara tokohnya. Jika berisi keduanya, hasilkan keduanya sesuai urutan naskah. Tidak wajib menambahkan percakapan antartokoh jika naskah memang tidak memuat percakapan.',
      'JANGAN HILANGKAN SUARA: setiap bagian naskah yang ditandai sebagai narasi, dialog, atau ucapan harus benar-benar terdengar dalam audio video. Jangan mengganti suara dengan subtitle, teks layar, atau musik. Jangan menambahkan percakapan baru yang tidak ada di naskah dan jangan mengubah isi kalimat tanpa alasan.',
      'SUMBER AUDIO UTAMA: gunakan file audio TTS yang akan dilampirkan pengguna pada pesan Claude yang sama dengan prompt ini. Audio terlampir adalah sumber suara final dan wajib dipakai sebagai audio utama video. Jangan membuat ulang suara, jangan mengganti suara, jangan mengubah urutan, jangan memotong, dan jangan menambahkan dialog/narasi yang tidak ada di audio. Jika ada bagian naskah yang tidak cocok dengan audio, pertahankan audio dan laporkan perbedaannya.',
      `FILE AUDIO YANG DISIAPKAN DI NEXORA: ${audioFile ? audioFile.name : 'BELUM DIPILIH'}. PENTING: nama file ini hanya informasi. Pengguna tetap harus melampirkan file audio asli secara manual ke Claude bersama prompt.`,
      'PENYESUAIAN VISUAL: susun adegan mengikuti urutan dan timing audio terlampir. Tambahkan subtitle yang sesuai dengan ucapan audio. Sinkronkan gerakan mulut jika memungkinkan. Musik latar opsional, volumenya harus jauh lebih rendah daripada audio utama.',
      'PEMERIKSAAN SEBELUM EKSPOR: pastikan audio terlampir tetap utuh dari awal sampai akhir, tidak terpotong, dan seluruh visual mengikuti isi audio. Jika lingkungan tidak dapat mempertahankan atau memproses file audio, jelaskan keterbatasannya dan jangan mengklaim audio sudah terpasang.',
      'Jika lingkungan Claude tidak dapat merender atau mengekspor MP4 secara langsung, jelaskan keterbatasannya dan berikan artefak/kode produksi yang benar-benar dapat dijalankan. Jangan mengklaim MP4 selesai jika file belum dibuat.',
      'NASKAH FINAL:',
      typeof script === 'string' ? script : JSON.stringify(script, null, 2),
      'STORYBOARD / ARAHAN LARAS:',
      sceneData ? JSON.stringify(sceneData, null, 2) : 'Belum ada storyboard LARAS. Kembangkan storyboard dari naskah.',
      'CHARACTER BIBLE DARI CHARACTER LIBRARY:',
      JSON.stringify(characters, null, 2),
      'OUTPUT YANG DIMINTA: video MP4 final 9:16, seluruh adegan bergerak, audio dialog/narasi, musik, dan subtitle tertanam atau file subtitle terpisah. Berikan tautan/file hasil yang benar-benar dapat diunduh.'
    ].join('\n\n');
  }

  function render() {
    const wf = Nexora.workflowEngine;
    const vr = Nexora.videoRenderer;
    if (!wf || !vr) return;

    const projects = getProducibleProjects(wf);
    const selectEl = document.getElementById('select-video-project');
    const emptyEl = document.getElementById('video-empty-state');
    const workspaceEl = document.getElementById('video-workspace');
    const pillEl = document.getElementById('video-prod-status-pill');

    if (projects.length === 0) {
      if (selectEl) selectEl.classList.add('hidden');
      if (emptyEl) emptyEl.classList.remove('hidden');
      if (workspaceEl) workspaceEl.classList.add('hidden');
      if (pillEl) pillEl.textContent = 'Belum ada naskah';
      return;
    }

    const active = wf.getActiveProject();
    if (!selectedProjectId || !projects.some((p) => p.id === selectedProjectId)) {
      selectedProjectId = active && projects.some((p) => p.id === active.id) ? active.id : projects[0].id;
    }

    const project = projects.find((p) => p.id === selectedProjectId) || projects[0];
    if (selectEl) {
      selectEl.classList.remove('hidden');
      selectEl.innerHTML = projects
        .map((p) => `<option value="${esc(p.id)}" ${p.id === project.id ? 'selected' : ''}>${esc(p.title)}</option>`)
        .join('');
    }

    if (emptyEl) emptyEl.classList.add('hidden');
    if (workspaceEl) workspaceEl.classList.remove('hidden');

    const rendered = vr.getRenderedVideo(project.id);
    if (pillEl) {
      pillEl.textContent = vr.isRendering
        ? 'Sedang Render Video...'
        : rendered
          ? `Siap (${rendered.ext.toUpperCase()} • ${rendered.sizeKb} KB)`
          : 'Siap Render 9:16';
    }

    const sbCard = document.getElementById('video-storyboard-card');
    if (sbCard) {
      const arts = wf.getProjectArtifacts(project.id);
      const larasArt = arts.find((a) => a.employee_id === 'laras');
      const script = getScriptForProject(wf, project);
      const timeline = vr.buildTimeline(project, script);
      const estSec = Math.round(timeline[timeline.length - 1].end);

      sbCard.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div class="text-xs font-extrabold text-slate-900">🎬 Storyboard LARAS • ${esc(project.title)}</div>
          <span class="px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-bold">
            ${esc(timeline.length)} Segmen • ~${esc(estSec)} detik (9:16)
          </span>
        </div>
        ${
          larasArt
            ? `<div class="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 whitespace-pre-line mb-2">${esc(wf.formatPayloadText({ actor: 'laras' }, larasArt.content))}</div>`
            : '<p class="text-[11px] text-slate-500 mb-2">Naskah sudah siap dirender menjadi video 9:16 beserta tokoh animasi & subtitle otomatis.</p>'
        }
      `;
    }

    const btnRender = document.getElementById('btn-render-video');
    const btnCancel = document.getElementById('btn-cancel-render');
    if (btnRender) {
      btnRender.disabled = vr.isRendering;
      btnRender.classList.toggle('opacity-50', vr.isRendering);
      btnRender.textContent = vr.isRendering
        ? '⏳ Sedang Merender...'
        : rendered
          ? '🔄 Render Ulang Video 9:16'
          : '🎬 Render Video 9:16 Sekarang';
    }
    if (btnCancel) {
      btnCancel.classList.toggle('hidden', !vr.isRendering);
    }

    const previewWrap = document.getElementById('video-preview-wrap');
    const player = document.getElementById('video-preview-player');
    const metaEl = document.getElementById('video-file-meta');
    if (previewWrap && player && metaEl) {
      if (rendered) {
        previewWrap.classList.remove('hidden');
        if (player.src !== rendered.url) {
          player.src = rendered.url;
        }
        metaEl.textContent = `Format: ${rendered.ext.toUpperCase()} • Durasi: ~${rendered.durationSec}d • Ukuran: ${rendered.sizeKb} KB`;
      } else {
        previewWrap.classList.add('hidden');
      }
    }
  }

  function init() {
    // Prevent duplicate event listeners if navigation or boot code initializes this view again.
    if (initialized) {
      render();
      return;
    }
    initialized = true;

    const selectEl = document.getElementById('select-video-project');
    if (selectEl) {
      selectEl.addEventListener('change', (e) => {
        selectedProjectId = e.target.value;
        loadSerialFields();
        render();
      });
    }

    const btnRender = document.getElementById('btn-render-video');
    if (btnRender) {
      btnRender.addEventListener('click', async () => {
        if (renderRequestActive) return;
        renderRequestActive = true;
        const wf = Nexora.workflowEngine;
        const vr = Nexora.videoRenderer;
        const project = wf.projects.find((p) => p.id === selectedProjectId);
        const script = getScriptForProject(wf, project);
        if (!project || !script) {
          renderRequestActive = false;
          Nexora.notificationsUI?.showToast('Proyek atau naskah belum tersedia.', 'warning');
          return;
        }

        const progWrap = document.getElementById('video-render-progress-wrap');
        const progBar = document.getElementById('video-render-progress-bar');
        const progTxt = document.getElementById('video-render-progress-text');
        const canvas = document.getElementById('video-render-canvas');

        if (progWrap) progWrap.classList.remove('hidden');
        if (canvas) canvas.classList.remove('hidden');

        const larasEmp = Nexora.state.getEmployee('laras');
        if (larasEmp) {
          wf.syncEmployeeToCanvas(larasEmp, Nexora.STATUS.WORKING, 25, `[${project.title}] Rendering Video 9:16...`, 'Sedang merekam adegan, karakter & subtitle...');
        }

        try {
          render();
          const result = await vr.renderProjectVideo({
            project,
            script,
            previewCanvas: canvas,
            onProgress: (pct) => {
              if (progBar) progBar.style.width = `${pct}%`;
              if (progTxt) progTxt.textContent = `${pct}%`;
            }
          });

          if (larasEmp) {
            wf.syncEmployeeToCanvas(
              larasEmp,
              Nexora.STATUS.COMPLETED,
              100,
              `[${project.title}] Video Selesai (${result.ext.toUpperCase()})`,
              `Video 9:16 selesai dirender (${result.sizeKb} KB, ~${result.durationSec} detik). Siap dicek oleh TIO (QC) & didownload.`
            );
          }

          Nexora.state.addLog('LARAS', `Merender video "${project.title}" (${result.ext.toUpperCase()}, ${result.sizeKb} KB).`);
          Nexora.notificationsUI.showToast('Video 9:16 selesai dirender! Silakan preview & cek QC.', 'success', 'tio');
        } catch (err) {
          Nexora.notificationsUI.showToast(`Render video: ${err.message}`, 'warning');
        } finally {
          renderRequestActive = false;
          if (progWrap) progWrap.classList.add('hidden');
          if (canvas) canvas.classList.add('hidden');
          render();
          if (Nexora.qualityControlView) Nexora.qualityControlView.render();
          if (Nexora.contentCalendarView) Nexora.contentCalendarView.render();
        }
      });
    }

    const promptBox = document.getElementById('claude-video-prompt');
    const copyPromptBtn = document.getElementById('btn-copy-claude-prompt');
    const ttsBox = document.getElementById('all-scenes-tts-text');
    const copyTtsBtn = document.getElementById('btn-copy-all-tts');
    const openClaudeBtn = document.getElementById('btn-open-claude');
    const audioUploadInput = document.getElementById('manual-audio-upload');
    const audioPlayer = document.getElementById('manual-audio-player');
    const audioStatus = document.getElementById('manual-audio-status');
    const uploadInput = document.getElementById('manual-video-upload');
    const manualStatus = document.getElementById('manual-video-status');
    let manualVideoUrl = null;
    let manualAudioUrl = null;
    let selectedAudioFile = null;
    let selectedAudioDurationSec = null;

    const refreshClaudePrompt = () => {
      const project = Nexora.workflowEngine.projects.find((p) => p.id === selectedProjectId);
      if (project) {
        if (promptBox) promptBox.value = buildClaudePrompt(project, selectedAudioFile, selectedAudioDurationSec);
        if (ttsBox) ttsBox.value = buildAllTtsText(project);
      }
    };

    const serialFields = {
      title: document.getElementById('serial-title'),
      episode: document.getElementById('serial-episode'),
      previousSummary: document.getElementById('serial-previous-summary'),
      continuityNotes: document.getElementById('serial-continuity-notes'),
      nextHook: document.getElementById('serial-next-hook')
    };
    const serialStatus = document.getElementById('serial-save-status');
    const loadSerialFields = () => {
      const cfg = getSerialConfig(selectedProjectId);
      if (serialFields.title) serialFields.title.value = cfg.title;
      if (serialFields.episode) serialFields.episode.value = String(cfg.episode);
      if (serialFields.previousSummary) serialFields.previousSummary.value = cfg.previousSummary;
      if (serialFields.continuityNotes) serialFields.continuityNotes.value = cfg.continuityNotes;
      if (serialFields.nextHook) serialFields.nextHook.value = cfg.nextHook;
    };
    const saveSerialFields = () => {
      if (!selectedProjectId) return;
      const cfg = {
        title: serialFields.title?.value.trim() || '',
        episode: Math.max(1, Number(serialFields.episode?.value) || 1),
        previousSummary: serialFields.previousSummary?.value.trim() || '',
        continuityNotes: serialFields.continuityNotes?.value.trim() || '',
        nextHook: serialFields.nextHook?.value.trim() || ''
      };
      try {
        localStorage.setItem(`nexora_serial_config_v1_${selectedProjectId}`, JSON.stringify(cfg));
        if (serialStatus) serialStatus.textContent = `Pengaturan Part ${cfg.episode} tersimpan lokal di browser ini.`;
      } catch (_) {
        if (serialStatus) serialStatus.textContent = 'Penyimpanan lokal tidak tersedia. Isian tetap bisa dipakai selama halaman terbuka.';
      }
      refreshClaudePrompt();
    };
    Object.values(serialFields).forEach((el) => {
      if (!el) return;
      el.addEventListener('input', saveSerialFields);
      el.addEventListener('change', saveSerialFields);
    });
    loadSerialFields();

    if (copyTtsBtn) {
      copyTtsBtn.addEventListener('click', async () => {
        refreshClaudePrompt();
        if (!ttsBox || !ttsBox.value) return;
        try {
          await navigator.clipboard.writeText(ttsBox.value);
          Nexora.notificationsUI.showToast('Semua TTS adegan berhasil disalin.', 'success');
        } catch (_) {
          ttsBox.focus();
          ttsBox.select();
          Nexora.notificationsUI.showToast('Clipboard tidak tersedia. Tekan lama teks lalu salin.', 'warning');
        }
      });
    }

    if (audioUploadInput) {
      audioUploadInput.addEventListener('change', () => {
        const file = audioUploadInput.files && audioUploadInput.files[0];
        if (!file) return;
        if (!(file.type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg)$/i.test(file.name))) {
          Nexora.notificationsUI.showToast('Pilih file audio MP3/WAV/M4A yang valid.', 'warning');
          audioUploadInput.value = '';
          return;
        }
        if (manualAudioUrl) URL.revokeObjectURL(manualAudioUrl);
        selectedAudioFile = file;
        manualAudioUrl = URL.createObjectURL(file);
        selectedAudioDurationSec = null;
        if (audioPlayer) {
          audioPlayer.src = manualAudioUrl;
          audioPlayer.classList.remove('hidden');
          audioPlayer.onloadedmetadata = () => {
            selectedAudioDurationSec = Number.isFinite(audioPlayer.duration) ? audioPlayer.duration : null;
            refreshClaudePrompt();
            if (audioStatus && selectedAudioDurationSec) audioStatus.textContent = `Audio siap: ${file.name} • ${selectedAudioDurationSec.toFixed(1)} detik • ${(file.size / 1024 / 1024).toFixed(2)} MB. Salin prompt, lalu lampirkan file audio asli secara manual di Claude.`;
          };
        }
        if (audioStatus) audioStatus.textContent = `Audio siap: ${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB. Salin prompt, lalu lampirkan file audio asli secara manual di Claude.`;
        refreshClaudePrompt();
        Nexora.notificationsUI.showToast('Audio TTS dimuat. Prompt sudah diperbarui.', 'success');
      });
    }

    if (copyPromptBtn) {
      copyPromptBtn.addEventListener('click', async () => {
        refreshClaudePrompt();
        if (!promptBox || !promptBox.value) return;
        try {
          await navigator.clipboard.writeText(promptBox.value);
          Nexora.notificationsUI.showToast('Prompt produksi berhasil disalin.', 'success');
        } catch (_) {
          promptBox.focus();
          promptBox.select();
          Nexora.notificationsUI.showToast('Clipboard tidak tersedia. Tekan lama teks lalu salin.', 'warning');
        }
      });
    }

    if (openClaudeBtn) {
      openClaudeBtn.addEventListener('click', () => {
        refreshClaudePrompt();
        window.open('https://claude.ai/new', '_blank', 'noopener');
        if (selectedAudioFile) Nexora.notificationsUI.showToast('Di Claude, lampirkan file audio yang sama secara manual lalu tempel prompt.', 'info');
        else Nexora.notificationsUI.showToast('Pilih audio MP3 terlebih dahulu, lalu salin prompt.', 'warning');
      });
    }

    if (uploadInput) {
      uploadInput.addEventListener('change', () => {
        const file = uploadInput.files && uploadInput.files[0];
        if (!file) return;
        if (!file.type.startsWith('video/')) {
          Nexora.notificationsUI.showToast('Pilih file video yang valid.', 'warning');
          uploadInput.value = '';
          return;
        }
        if (manualVideoUrl) URL.revokeObjectURL(manualVideoUrl);
        manualVideoUrl = URL.createObjectURL(file);
        const player = document.getElementById('video-preview-player');
        const previewWrap = document.getElementById('video-preview-wrap');
        const meta = document.getElementById('video-file-meta');
        if (player) player.src = manualVideoUrl;
        if (previewWrap) previewWrap.classList.remove('hidden');
        if (meta) meta.textContent = `File lokal: ${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB • ${file.type || 'video'}`;
        if (manualStatus) manualStatus.textContent = `Video dipilih: ${file.name}. File hanya dipreview di browser ini dan belum tersimpan permanen ke cloud.`;
        Nexora.notificationsUI.showToast('Video berhasil dimuat untuk preview lokal.', 'success');
      });
    }

    refreshClaudePrompt();

    const btnCancel = document.getElementById('btn-cancel-render');
    if (btnCancel) {
      btnCancel.addEventListener('click', () => Nexora.videoRenderer.cancelRender());
    }

    const btnDownVideo = document.getElementById('btn-download-video');
    if (btnDownVideo) {
      btnDownVideo.addEventListener('click', () => {
        const rendered = Nexora.videoRenderer.getRenderedVideo(selectedProjectId);
        const proj = Nexora.workflowEngine.projects.find((p) => p.id === selectedProjectId);
        if (!rendered) return;
        const safeName = (proj ? proj.title : 'nexora-video').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32);
        triggerDownload(rendered.url, `${safeName}.${rendered.ext}`);
      });
    }

    const btnDownSrt = document.getElementById('btn-download-srt');
    if (btnDownSrt) {
      btnDownSrt.addEventListener('click', () => {
        const rendered = Nexora.videoRenderer.getRenderedVideo(selectedProjectId);
        const proj = Nexora.workflowEngine.projects.find((p) => p.id === selectedProjectId);
        if (!rendered) return;
        const safeName = (proj ? proj.title : 'nexora-sub').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32);
        triggerDownload(rendered.srtText, `${safeName}.srt`, true);
      });
    }

    const btnToQc = document.getElementById('btn-video-to-qc');
    if (btnToQc) {
      btnToQc.addEventListener('click', () => {
        if (selectedProjectId) Nexora.workflowEngine.setActiveProject(selectedProjectId);
        Nexora.navigation.navigateTo('quality-control');
      });
    }

    const btnToScripts = document.getElementById('btn-video-to-scripts');
    if (btnToScripts) {
      btnToScripts.addEventListener('click', () => Nexora.navigation.navigateTo('script-management'));
    }

    if (Nexora.workflowEngine) {
      Nexora.workflowEngine.subscribe(render);
    }
    render();
  }

  Nexora.videoProductionView = { init, render };

})(window.Nexora = window.Nexora || {});