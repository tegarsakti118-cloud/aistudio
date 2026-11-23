(function (Nexora) {
  'use strict';

  const VIDEO_W = 540;
  const VIDEO_H = 960;
  const FPS = 25;

  const CHAR_PALETTES = [
    { shirt: '#0284C7', hair: '#1E293B', skin: '#FDBA74', accent: '#38BDF8' },
    { shirt: '#0D9488', hair: '#451A03', skin: '#FED7AA', accent: '#2DD4BF' },
    { shirt: '#4F46E5', hair: '#0F172A', skin: '#FDBA74', accent: '#818CF8' },
    { shirt: '#D97706', hair: '#3B0764', skin: '#FED7AA', accent: '#FBBF24' }
  ];

  const BG_THEMES = [
    { top: '#0F2942', bottom: '#1E3A5F', floor: '#E2E8F0', wallAccent: '#38BDF8' },
    { top: '#134E4A', bottom: '#115E59', floor: '#CCFBF1', wallAccent: '#2DD4BF' },
    { top: '#1E1B4B', bottom: '#312E81', floor: '#E0E7FF', wallAccent: '#818CF8' }
  ];

  function hashString(str) {
    let h = 0;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  function pickSupportedMimeType() {
    if (typeof MediaRecorder === 'undefined') return '';
    const candidates = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];
    for (const type of candidates) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return '';
  }

  function wrapLines(ctx, text, maxWidth) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';
    for (const w of words) {
      const test = current ? `${current} ${w}` : w;
      if (ctx.measureText(test).width <= maxWidth) {
        current = test;
      } else {
        if (current) lines.push(current);
        current = w;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  function drawRoundedRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function formatSrtTime(sec) {
    const ms = Math.max(0, Math.round(sec * 1000));
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const rem = ms % 1000;
    const pad = (n, l = 2) => String(n).padStart(l, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)},${pad(rem, 3)}`;
  }

  class VideoRendererService {
    constructor() {
      this.renderedByProject = {};
      this.isRendering = false;
      this.cancelRequested = false;
    }

    getRenderedVideo(projectId) {
      return this.renderedByProject[projectId] || null;
    }

    cancelRender() {
      this.cancelRequested = true;
    }

    buildTimeline(project, script) {
      const s = script || {};
      const items = [];

      const hookText = s.hook || project.title || 'Cerita Baru Hari Ini';
      items.push({
        kind: 'hook',
        speaker: 'HOOK',
        text: hookText,
        visual: 'Judul Pembuka Menarik Perhatian',
        durationSec: 3.5
      });

      const scenes = Array.isArray(s.scenes) ? s.scenes : [];
      scenes.forEach((sc, idx) => {
        if (typeof sc === 'string') {
          items.push({
            kind: 'scene',
            sceneNo: idx + 1,
            speaker: 'Narator',
            text: sc,
            visual: '',
            durationSec: 4.5
          });
        } else {
          const dlg = sc.dialogue || sc.narration || sc.text || '';
          const dur = Math.max(2.5, Math.min(10, Number(sc.duration_sec || 4.5)));
          items.push({
            kind: 'scene',
            sceneNo: sc.scene_no || idx + 1,
            speaker: sc.speaker || 'Tokoh',
            text: dlg,
            visual: sc.visual_direction || '',
            durationSec: dur
          });
        }
      });

      if (s.cta) {
        items.push({
          kind: 'cta',
          speaker: 'BERSAMBUNG / CTA',
          text: s.cta,
          visual: 'Layar Penutup & Ajakan Komentar',
          durationSec: 3.5
        });
      }

      let cursor = 0;
      return items.map((item) => {
        const start = cursor;
        const end = cursor + item.durationSec;
        cursor = end;
        return { ...item, start, end };
      });
    }

    buildSrt(project, script) {
      const timeline = this.buildTimeline(project, script);
      return timeline
        .map((seg, idx) => `${idx + 1}\n${formatSrtTime(seg.start)} --> ${formatSrtTime(seg.end)}\n[${seg.speaker}] ${seg.text}\n`)
        .join('\n');
    }

    drawStylizedScene(ctx, project, segment, elapsedInSeg, totalElapsed) {
      const theme = BG_THEMES[(segment.sceneNo || 0) % BG_THEMES.length];
      const segProgress = Math.min(1, elapsedInSeg / segment.durationSec);

      const grad = ctx.createLinearGradient(0, 0, 0, VIDEO_H);
      grad.addColorStop(0, theme.top);
      grad.addColorStop(0.68, theme.bottom);
      grad.addColorStop(1, '#09111E');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);

      // Subtle animated light rays / ambient circles
      ctx.save();
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = theme.wallAccent;
      ctx.beginPath();
      ctx.arc(VIDEO_W * 0.25 + Math.sin(totalElapsed * 0.6) * 20, 220, 140, 0, Math.PI * 2);
      ctx.arc(VIDEO_W * 0.8, 360 + Math.cos(totalElapsed * 0.5) * 18, 110, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Room window / backdrop frame
      ctx.save();
      const camScale = 1 + segProgress * 0.045;
      ctx.translate(VIDEO_W / 2, VIDEO_H * 0.44);
      ctx.scale(camScale, camScale);
      ctx.translate(-VIDEO_W / 2, -VIDEO_H * 0.44);

      if (segment.kind === 'hook') {
        drawRoundedRect(ctx, 48, 230, VIDEO_W - 96, 310, 28);
        ctx.fillStyle = 'rgba(15, 41, 66, 0.85)';
        ctx.fill();
        ctx.strokeStyle = theme.wallAccent;
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.fillStyle = '#38BDF8';
        ctx.font = 'bold 20px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(project.niche || 'KONTEN DIGITAL').toUpperCase(), VIDEO_W / 2, 285);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 28px Inter, sans-serif';
        const titleLines = wrapLines(ctx, project.title || 'Cerita Baru', VIDEO_W - 140).slice(0, 4);
        titleLines.forEach((line, i) => {
          ctx.fillText(line, VIDEO_W / 2, 345 + i * 38);
        });
      } else if (segment.kind === 'cta') {
        drawRoundedRect(ctx, 48, 250, VIDEO_W - 96, 260, 28);
        ctx.fillStyle = 'rgba(20, 184, 166, 0.18)';
        ctx.fill();
        ctx.strokeStyle = '#2DD4BF';
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.fillStyle = '#2DD4BF';
        ctx.font = 'bold 34px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SIMPAN & KOMEN!', VIDEO_W / 2, 355);

        ctx.fillStyle = '#E2E8F0';
        ctx.font = 'bold 20px Inter, sans-serif';
        ctx.fillText('Ikuti kelanjutan ceritanya →', VIDEO_W / 2, 410);
      } else {
        // Stylized floor & desk props
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(0, 520, VIDEO_W, 180);

        drawRoundedRect(ctx, 70, 155, VIDEO_W - 140, 160, 18);
        ctx.fillStyle = 'rgba(255,255,255,0.09)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw stylized character speaking
        const pal = CHAR_PALETTES[hashString(segment.speaker) % CHAR_PALETTES.length];
        const bob = Math.sin(totalElapsed * 4.5) * 4;
        const cx = VIDEO_W / 2;
        const cy = 415 + bob;

        // Body
        drawRoundedRect(ctx, cx - 72, cy + 36, 144, 120, 34);
        ctx.fillStyle = pal.shirt;
        ctx.fill();
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Head
        drawRoundedRect(ctx, cx - 58, cy - 86, 116, 116, 32);
        ctx.fillStyle = pal.skin;
        ctx.fill();
        ctx.stroke();

        // Hair
        drawRoundedRect(ctx, cx - 62, cy - 100, 124, 42, 18);
        ctx.fillStyle = pal.hair;
        ctx.fill();
        ctx.stroke();

        // Eyes (blink periodically)
        const blink = Math.floor(totalElapsed * 10) % 35 === 0;
        ctx.fillStyle = '#0F172A';
        if (blink) {
          ctx.fillRect(cx - 32, cy - 32, 18, 4);
          ctx.fillRect(cx + 14, cy - 32, 18, 4);
        } else {
          ctx.beginPath();
          ctx.arc(cx - 23, cy - 30, 7, 0, Math.PI * 2);
          ctx.arc(cx + 23, cy - 30, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(cx - 25, cy - 32, 2.5, 0, Math.PI * 2);
          ctx.arc(cx + 21, cy - 32, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Animated talking mouth
        const mouthOpen = 4 + Math.abs(Math.sin(totalElapsed * 13)) * 11;
        drawRoundedRect(ctx, cx - 14, cy - 4, 28, mouthOpen, 6);
        ctx.fillStyle = '#7F1D1D';
        ctx.fill();

        // Desk / foreground prop
        drawRoundedRect(ctx, 45, 535, VIDEO_W - 90, 90, 18);
        ctx.fillStyle = '#F8FAFC';
        ctx.fill();
        ctx.strokeStyle = '#64748B';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.restore();

      // Top Watermark / Studio Pill
      drawRoundedRect(ctx, 24, 28, 178, 34, 17);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
      ctx.fill();
      ctx.fillStyle = '#2DD4BF';
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('NEXORA STUDIO', 42, 50);

      // Speaker Badge Pill
      const spkText = String(segment.speaker || 'NARATOR').toUpperCase();
      ctx.font = 'bold 17px Inter, sans-serif';
      const pillW = Math.min(VIDEO_W - 60, Math.max(120, ctx.measureText(spkText).width + 36));
      drawRoundedRect(ctx, VIDEO_W / 2 - pillW / 2, 650, pillW, 36, 18);
      ctx.fillStyle = '#0284C7';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText(spkText, VIDEO_W / 2, 674);

      // TikTok-style Bold White Subtitles with Black Stroke
      ctx.font = 'bold 26px Inter, sans-serif';
      const subLines = wrapLines(ctx, segment.text, VIDEO_W - 68).slice(0, 4);
      const startY = 730;
      subLines.forEach((line, i) => {
        const ly = startY + i * 36;
        ctx.lineWidth = 7;
        ctx.strokeStyle = '#0F172A';
        ctx.strokeText(line, VIDEO_W / 2, ly);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(line, VIDEO_W / 2, ly);
      });
    }

    async renderProjectVideo({ project, script, previewCanvas, onProgress }) {
      if (this.isRendering) {
        throw new Error('Sedang ada proses render video yang berjalan.');
      }

      const mimeType = pickSupportedMimeType();
      if (!mimeType) {
        throw new Error('Browser ini tidak mendukung perekaman MediaRecorder Video.');
      }

      const timeline = this.buildTimeline(project, script);
      const totalDurationSec = timeline[timeline.length - 1].end;

      const canvas = previewCanvas || document.createElement('canvas');
      canvas.width = VIDEO_W;
      canvas.height = VIDEO_H;
      const ctx = canvas.getContext('2d');

      this.isRendering = true;
      this.cancelRequested = false;

      let audioCtx = null;
      let beatTimer = null;
      let renderTimer = null;

      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioCtx();
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }
        const audioDest = audioCtx.createMediaStreamDestination();

        // Ambient soft synth pad + subtle scene chime into MediaRecorder audio track
        const masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.14;
        masterGain.connect(audioDest);

        const playNote = (freq, duration = 0.35) => {
          if (!audioCtx || audioCtx.state === 'closed') return;
          const osc = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          g.gain.setValueAtTime(0.001, audioCtx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.04);
          g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
          osc.connect(g);
          g.connect(masterGain);
          osc.start();
          osc.stop(audioCtx.currentTime + duration + 0.02);
        };

        const notes = [261.63, 329.63, 392.0, 440.0];
        let stepIdx = 0;
        playNote(notes[0], 0.5);
        beatTimer = setInterval(() => {
          stepIdx = (stepIdx + 1) % notes.length;
          playNote(notes[stepIdx], 0.45);
        }, 900);

        const canvasStream = canvas.captureStream(FPS);
        const combinedStream = new MediaStream([
          ...canvasStream.getVideoTracks(),
          ...audioDest.stream.getAudioTracks()
        ]);

        const chunks = [];
        const recorder = new MediaRecorder(combinedStream, {
          mimeType,
          videoBitsPerSecond: 1800000
        });

        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) chunks.push(ev.data);
        };

        const stoppedPromise = new Promise((resolve, reject) => {
          recorder.onstop = () => resolve();
          recorder.onerror = (err) => reject(err.error || new Error('MediaRecorder error'));
        });

        recorder.start(250);
        const startedAt = performance.now();

        await new Promise((resolve, reject) => {
          renderTimer = setInterval(() => {
            if (this.cancelRequested) {
              clearInterval(renderTimer);
              reject(new Error('Render dibatalkan oleh Direktur.'));
              return;
            }

            const elapsed = (performance.now() - startedAt) / 1000;
            if (elapsed >= totalDurationSec) {
              clearInterval(renderTimer);
              resolve();
              return;
            }

            const seg = timeline.find((t) => elapsed >= t.start && elapsed < t.end) || timeline[timeline.length - 1];
            this.drawStylizedScene(ctx, project, seg, elapsed - seg.start, elapsed);
            if (onProgress) {
              onProgress(Math.min(99, Math.round((elapsed / totalDurationSec) * 100)));
            }
          }, 1000 / FPS);
        });

        if (recorder.state === 'recording') {
          recorder.stop();
        }
        await stoppedPromise;

        const blob = new Blob(chunks, { type: mimeType });
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const prev = this.renderedByProject[project.id];
        if (prev && prev.url) {
          URL.revokeObjectURL(prev.url);
        }

        const record = {
          projectId: project.id,
          url: URL.createObjectURL(blob),
          blob,
          mimeType,
          ext,
          sizeKb: Math.max(1, Math.round(blob.size / 1024)),
          durationSec: Math.round(totalDurationSec),
          sceneCount: timeline.length,
          srtText: this.buildSrt(project, script),
          createdAt: new Date().toISOString()
        };

        this.renderedByProject[project.id] = record;
        if (onProgress) onProgress(100);
        return record;
      } finally {
        if (renderTimer) clearInterval(renderTimer);
        if (beatTimer) clearInterval(beatTimer);
        if (audioCtx && audioCtx.state !== 'closed') {
          audioCtx.close().catch(() => {});
        }
        this.isRendering = false;
      }
    }
  }

  Nexora.videoRenderer = new VideoRendererService();

})(window.Nexora = window.Nexora || {});