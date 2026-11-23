(function (Nexora) {
  'use strict';

  Nexora.WORKFLOW_STEPS = [
    {
      step: 1,
      actor: 'raka',
      type: 'agent_task',
      label: 'Riset Tren & Kompetitor',
      artifactType: 'trend_report',
      nextStep: 2
    },
    {
      step: 2,
      actor: 'sari',
      type: 'agent_task',
      label: 'Pembuatan Ide Konten',
      artifactType: 'idea_proposals',
      nextStep: 3
    },
    {
      step: 3,
      actor: 'director',
      sourceEmployeeId: 'sari',
      type: 'approval_gate',
      label: 'Direktur Memilih Ide Produksi',
      nextStep: 4,
      rejectStep: 2
    },
    {
      step: 4,
      actor: 'bima',
      type: 'agent_task',
      label: 'Penulisan Naskah, Hook & Adegan',
      artifactType: 'script_draft',
      nextStep: 5
    },
    {
      step: 5,
      actor: 'dimas',
      type: 'review_loop',
      label: 'Audit & Revisi Naskah',
      artifactType: 'script_review',
      nextStep: 6,
      revisionStep: 4
    },
    {
      step: 6,
      actor: 'director',
      sourceEmployeeId: 'dimas',
      type: 'approval_gate',
      label: 'Direktur Menyetujui Naskah Final',
      nextStep: 7,
      rejectStep: 4
    },
    {
      step: 7,
      actor: 'laras',
      type: 'agent_task',
      label: 'Storyboard & Produksi Video',
      artifactType: 'production_pack',
      nextStep: 8
    },
    {
      step: 8,
      actor: 'tio',
      type: 'review_loop',
      label: 'Quality Control Video',
      artifactType: 'video_qc',
      nextStep: 9,
      revisionStep: 7
    },
    {
      step: 9,
      actor: 'mel',
      type: 'agent_task',
      label: 'Persiapan Materi & Jadwal Publikasi',
      artifactType: 'publish_package',
      nextStep: 10
    },
    {
      step: 10,
      actor: 'director',
      sourceEmployeeId: 'mel',
      type: 'manual_publish',
      label: 'Publikasi Manual oleh Direktur',
      nextStep: 11,
      rejectStep: 9
    },
    {
      step: 11,
      actor: 'dina',
      type: 'agent_task',
      label: 'Analisis Performa Konten',
      artifactType: 'analytics_feedback',
      nextStep: 12
    },
    {
      step: 12,
      actor: 'dina',
      type: 'feedback_loop',
      label: 'Feedback Strategi ke RAKA & SARI',
      loopTargets: ['raka', 'sari'],
      nextStep: null
    }
  ];

  Nexora.AGENT_PROFILES = {
    raka: {
      agentType: 'researcher',
      isReviewer: false,
      requiresDirectorApproval: false,
      handoffTo: ['sari'],
      metricType: 'research',
      systemPrompt:
        'Anda adalah RAKA, Trend Researcher di Nexora AI Studio. Analisis tren niche, pola konten kompetitor, dan peluang topik bernilai tinggi dalam JSON terstruktur.',
      inputContract: 'niche_config + optional_dina_feedback',
      outputContract: 'trend_report_json { niche, trends[], competitors[], opportunities[] }'
    },
    sari: {
      agentType: 'ideator',
      isReviewer: false,
      requiresDirectorApproval: true,
      handoffTo: ['bima'],
      metricType: 'ideas',
      systemPrompt:
        'Anda adalah SARI, Idea Creator di Nexora AI Studio. Ubah laporan tren RAKA menjadi ide konten konkret dengan judul, angle, target audiens, dan skor potensi.',
      inputContract: 'trend_report_json + optional_dina_feedback',
      outputContract: 'idea_proposals_json { ideas[{ title, angle, audience, potential_score }] }'
    },
    bima: {
      agentType: 'writer',
      isReviewer: false,
      requiresDirectorApproval: false,
      handoffTo: ['dimas'],
      metricType: 'scripts',
      systemPrompt:
        'Anda adalah BIMA, Scriptwriter spesialis video vertikal 9:16 storytelling/dialog di Nexora AI Studio. Tulis naskah berstruktur Hook (0-3 detik), daftar adegan berdialog/narasi singkat, CTA/cliffhanger, dan caption. WAJIB ciptakan nama tokoh cerita yang 100% baru dan orisinal (dilarang memakai nama dari video referensi atau nama karyawan studio: Raka, Sari, Bima, Dimas, Laras, Tio, Mel, Dina).',
      inputContract: 'approved_idea_json + optional_dimas_revision_notes',
      outputContract: 'script_draft_json { version, hook, characters[], scenes[{ scene_no, duration_sec, speaker, dialogue, visual_direction }], cta, caption_draft }'
    },
    dimas: {
      agentType: 'reviewer',
      isReviewer: true,
      requiresDirectorApproval: true,
      handoffTo: ['laras', 'bima'],
      revisionTarget: 'bima',
      metricType: 'script_qc',
      systemPrompt:
        'Anda adalah DIMAS, Script Reviewer di Nexora AI Studio. Audit draf naskah BIMA dari aspek kekuatan hook 3 detik pertama, kelancaran dialog/pacing adegan, keorisinalan nama tokoh, dan akurasi klaim.',
      inputContract: 'script_draft_json',
      outputContract: 'script_review_json { verdict, hook_score, pacing_score, factual_issues[], revision_notes }'
    },
    laras: {
      agentType: 'producer',
      isReviewer: false,
      requiresDirectorApproval: false,
      handoffTo: ['tio'],
      metricType: 'videos',
      systemPrompt:
        'Anda adalah LARAS, Video Producer di Nexora AI Studio. Susun storyboard adegan per adegan, arahan visual bergaya konsisten, kebutuhan aset suara/gambar, dan panduan subtitle.',
      inputContract: 'approved_script_json + optional_tio_qc_notes',
      outputContract: 'production_pack_json { storyboard_scenes[], asset_prompts[], video_job_ref }'
    },
    tio: {
      agentType: 'qc',
      isReviewer: true,
      requiresDirectorApproval: true,
      handoffTo: ['mel', 'laras'],
      revisionTarget: 'laras',
      metricType: 'videos',
      systemPrompt:
        'Anda adalah TIO, Video Reviewer di Nexora AI Studio. Lakukan Quality Control hasil produksi LARAS terhadap kesesuaian naskah, audio, dan keterbacaan subtitle.',
      inputContract: 'production_pack_json + approved_script_json',
      outputContract: 'video_qc_json { verdict, audio_check, subtitle_check, revision_notes }'
    },
    mel: {
      agentType: 'publisher',
      isReviewer: false,
      requiresDirectorApproval: true,
      handoffTo: ['dina'],
      metricType: 'published',
      systemPrompt:
        'Anda adalah MEL, Publishing Assistant di Nexora AI Studio. Siapkan caption final, hashtag tertarget, metadata, dan jadwal prime-time untuk publikasi manual Direktur.',
      inputContract: 'qc_passed_production_json + approved_script_json',
      outputContract: 'publish_package_json { final_caption, hashtags[], recommended_slot, metadata }'
    },
    dina: {
      agentType: 'analyst',
      isReviewer: false,
      requiresDirectorApproval: false,
      handoffTo: ['raka', 'sari'],
      metricType: 'analytics',
      systemPrompt:
        'Anda adalah DINA, Performance Analyst di Nexora AI Studio. Evaluasi views, retensi, dan engagement lalu buat rekomendasi strategis bagi RAKA & SARI.',
      inputContract: 'published_metrics_json + content_project_context',
      outputContract: 'analytics_feedback_json { retention_eval, winning_patterns[], next_cycle_recommendations[] }'
    }
  };

  Nexora.getAgentProfile = function (empId) {
    return Nexora.AGENT_PROFILES[empId] || null;
  };

  Nexora.getWorkflowStep = function (stepNumber) {
    return Nexora.WORKFLOW_STEPS.find((s) => s.step === Number(stepNumber)) || null;
  };

})(window.Nexora = window.Nexora || {});