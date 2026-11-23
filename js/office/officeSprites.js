(function (Nexora) {
  'use strict';

  const S = Nexora.STATUS;
  const BG_CACHE_SCALE = 2;

  let staticBgCache = null;
  let staticBgWidth = 0;
  let staticBgHeight = 0;

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

  function ensureStaticBgCache(width, height) {
    if (staticBgCache && staticBgWidth === width && staticBgHeight === height) {
      return staticBgCache;
    }

    const offscreen = document.createElement('canvas');
    offscreen.width = width * BG_CACHE_SCALE;
    offscreen.height = height * BG_CACHE_SCALE;

    const octx = offscreen.getContext('2d');
    octx.scale(BG_CACHE_SCALE, BG_CACHE_SCALE);

    octx.fillStyle = '#EAF5FB';
    octx.fillRect(0, 0, width, height);

    octx.strokeStyle = 'rgba(14, 165, 233, 0.08)';
    octx.lineWidth = 1;
    const tileSize = 38;
    for (let x = 0; x < width; x += tileSize) {
      octx.beginPath();
      octx.moveTo(x, 0);
      octx.lineTo(x, height);
      octx.stroke();
    }
    for (let y = 0; y < height; y += tileSize) {
      octx.beginPath();
      octx.moveTo(0, y);
      octx.lineTo(width, y);
      octx.stroke();
    }

    octx.fillStyle = '#0F2942';
    octx.fillRect(0, 0, width, 68);
    octx.fillStyle = '#0284C7';
    octx.fillRect(0, 64, width, 5);

    for (let wx = 34; wx < width - 120; wx += 145) {
      drawRoundedRect(octx, wx, 14, 108, 42, 8);
      const skyGrad = octx.createLinearGradient(wx, 14, wx, 56);
      skyGrad.addColorStop(0, '#7DD3FC');
      skyGrad.addColorStop(1, '#E0F2FE');
      octx.fillStyle = skyGrad;
      octx.fill();
      octx.strokeStyle = '#38BDF8';
      octx.lineWidth = 2;
      octx.stroke();
    }

    const zones = [
      { x: 30, y: 105, w: 330, h: 175, label: 'ZONA RISET & IDE', color: '#E0F2FE', border: '#BAE6FD', tag: '#0369A1' },
      { x: 400, y: 105, w: 330, h: 175, label: 'ZONA KREATIF & KONSEP', color: '#CCFBF1', border: '#99F6E4', tag: '#0F766E' },
      { x: 30, y: 315, w: 330, h: 175, label: 'ZONA PENULISAN NASKAH', color: '#DBEAFE', border: '#BFDBFE', tag: '#1D4ED8' },
      { x: 400, y: 315, w: 330, h: 175, label: 'ZONA AUDIT NASKAH', color: '#E0E7FF', border: '#C7D2FE', tag: '#4338CA' },
      { x: 30, y: 525, w: 330, h: 175, label: 'STUDIO PRODUKSI VIDEO', color: '#CCFBF1', border: '#99F6E4', tag: '#0F766E' },
      { x: 400, y: 525, w: 330, h: 175, label: 'RUANG QUALITY CONTROL', color: '#CFFAFE', border: '#A5F3FC', tag: '#0E7490' },
      { x: 30, y: 735, w: 330, h: 175, label: 'HUB PUBLIKASI KONTEN', color: '#E0F2FE', border: '#BAE6FD', tag: '#0369A1' },
      { x: 400, y: 735, w: 330, h: 175, label: 'LAB ANALITIK PERFORMA', color: '#D1FAE5', border: '#A7F3D0', tag: '#047857' }
    ];

    zones.forEach((z) => {
      drawRoundedRect(octx, z.x, z.y, z.w, z.h, 18);
      octx.fillStyle = z.color;
      octx.fill();
      octx.strokeStyle = z.border;
      octx.lineWidth = 2;
      octx.stroke();

      octx.fillStyle = z.tag;
      octx.font = 'bold 10px Inter, sans-serif';
      octx.textAlign = 'left';
      octx.fillText(z.label, z.x + 14, z.y + 20);
    });

    octx.fillStyle = 'rgba(255,255,255,0.65)';
    octx.fillRect(365, 95, 30, 825);

    [
      { x: 48, y: 128 },
      { x: 712, y: 128 },
      { x: 48, y: 548 },
      { x: 712, y: 758 }
    ].forEach((p) => {
      octx.fillStyle = '#FFFFFF';
      octx.beginPath();
      octx.arc(p.x, p.y + 8, 9, 0, Math.PI * 2);
      octx.fill();
      octx.strokeStyle = '#94A3B8';
      octx.lineWidth = 1.5;
      octx.stroke();
    });

    drawRoundedRect(octx, 380 - 16, 300 - 16, 32, 32, 8);
    octx.fillStyle = '#1E293B';
    octx.fill();
    octx.fillStyle = '#38BDF8';
    octx.fillRect(380 - 10, 300 - 10, 20, 8);

    drawRoundedRect(octx, 380 - 15, 715 - 20, 30, 42, 6);
    octx.fillStyle = '#0F2942';
    octx.fill();
    octx.strokeStyle = '#0284C7';
    octx.lineWidth = 1.5;
    octx.stroke();

    staticBgCache = offscreen;
    staticBgWidth = width;
    staticBgHeight = height;
    return staticBgCache;
  }

  function drawOfficeEnvironment(ctx, width, height, tick) {
    const bgCanvas = ensureStaticBgCache(width, height);
    ctx.drawImage(bgCanvas, 0, 0, width, height);

    for (let wx = 34; wx < width - 120; wx += 145) {
      const cloudOffset = ((tick * 0.25 + wx) % 80) - 10;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(wx + 25 + cloudOffset * 0.4, 34, 8, 0, Math.PI * 2);
      ctx.arc(wx + 35 + cloudOffset * 0.4, 32, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    drawRoundedRect(ctx, width / 2 - 115, 16, 230, 34, 10);
    ctx.fillStyle = '#0B192C';
    ctx.fill();
    ctx.strokeStyle = '#2DD4BF';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NEXORA AI STUDIO • HQ', width / 2, 38);

    drawPlantLeaves(ctx, 48, 128, tick);
    drawPlantLeaves(ctx, 712, 128, tick);
    drawPlantLeaves(ctx, 48, 548, tick);
    drawPlantLeaves(ctx, 712, 758, tick);

    drawCoffeeSteam(ctx, 380, 300, tick);
    drawAIServerLEDs(ctx, 380, 715, tick);
  }

  function drawPlantLeaves(ctx, x, y, tick) {
    const sway = Math.sin(tick * 0.04 + x) * 1.5;
    ctx.fillStyle = '#14B8A6';
    ctx.beginPath();
    ctx.ellipse(x - 6 + sway, y - 2, 7, 4, -0.5, 0, Math.PI * 2);
    ctx.ellipse(x + 6 + sway, y - 2, 7, 4, 0.5, 0, Math.PI * 2);
    ctx.ellipse(x + sway * 0.5, y - 8, 5, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCoffeeSteam(ctx, x, y, tick) {
    const steamY = (tick * 0.4) % 10;
    ctx.strokeStyle = `rgba(148, 163, 184, ${1 - steamY / 10})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 3, y - 18 - steamY);
    ctx.lineTo(x - 1, y - 23 - steamY);
    ctx.moveTo(x + 4, y - 18 - steamY);
    ctx.lineTo(x + 2, y - 24 - steamY);
    ctx.stroke();
  }

  function drawAIServerLEDs(ctx, x, y, tick) {
    for (let i = 0; i < 4; i++) {
      const on = ((Math.floor(tick / 15) + i) % 2) === 0;
      ctx.fillStyle = on ? '#2DD4BF' : '#0369A1';
      ctx.fillRect(x - 9, y - 13 + i * 8, 18, 3);
    }
  }

  function drawEmployeeWorkstation(ctx, emp, tick, isSelected) {
    const app = emp.officeAppearance || emp;
    if (!app || !app.deskPos) return;
    const { x, y } = app.deskPos;
    const st = emp.status;
    const isWorking = st === S.WORKING || st === S.REVIEWING;
    const isWaiting = st === S.WAITING_APPROVAL;
    const isCompleted = st === S.COMPLETED;
    const isFailed = st === S.FAILED;

    ctx.save();

    if (isSelected) {
      const pulse = 2 + Math.sin(tick * 0.12) * 2;
      drawRoundedRect(ctx, x - 92 - pulse, y - 62 - pulse, 184 + pulse * 2, 128 + pulse * 2, 22);
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    drawRoundedRect(ctx, x - 72, y + 6, 144, 46, 12);
    ctx.fillStyle = 'rgba(15, 41, 66, 0.10)';
    ctx.fill();

    ctx.fillStyle = '#334155';
    drawRoundedRect(ctx, x - 20, y - 42, 40, 26, 10);
    ctx.fill();
    ctx.fillStyle = app.avatarColor;
    drawRoundedRect(ctx, x - 16, y - 39, 32, 18, 7);
    ctx.fill();

    let bobY = Math.sin(tick * 0.08 + x) * 1.5;
    let leanX = 0;

    if (isWorking) {
      bobY = Math.sin(tick * 0.25 + x) * 1.8;
      leanX = Math.sin(tick * 0.12) * 1.2;
    } else if (isCompleted) {
      bobY = -Math.abs(Math.sin(tick * 0.16)) * 6;
    } else if (isFailed) {
      leanX = Math.sin(tick * 0.6) * 1.8;
    }

    const cx = x + leanX;
    const cy = y - 18 + bobY;

    drawRoundedRect(ctx, cx - 17, cy + 4, 34, 22, 10);
    ctx.fillStyle = app.shirtColor;
    ctx.fill();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    const handOffsetL = isWorking ? Math.sin(tick * 0.45) * 3 : 0;
    const handOffsetR = isWorking ? Math.cos(tick * 0.45) * 3 : 0;
    ctx.fillStyle = app.skinColor;
    ctx.beginPath();
    ctx.arc(cx - 14, cy + 20 + handOffsetL, 4.5, 0, Math.PI * 2);
    ctx.arc(cx + 14, cy + 20 + handOffsetR, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = app.skinColor;
    ctx.beginPath();
    ctx.arc(cx, cy - 8, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.fillStyle = app.hairColor;
    ctx.beginPath();
    ctx.arc(cx, cy - 12, 16.5, Math.PI, Math.PI * 2);
    ctx.fill();

    if (app.accessory === 'cap') {
      ctx.fillStyle = '#0284C7';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 20, 17, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (app.accessory === 'headphones' || app.accessory === 'headset') {
      ctx.strokeStyle = '#14B8A6';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy - 11, 18, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(cx - 20, cy - 13, 5, 10);
      ctx.fillRect(cx + 15, cy - 13, 5, 10);
    } else if (app.accessory === 'beret') {
      ctx.fillStyle = '#14B8A6';
      ctx.beginPath();
      ctx.ellipse(cx + 3, cy - 22, 15, 6, -0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    const isBlinking = (Math.floor(tick) + Math.floor(x)) % 140 < 6;
    ctx.fillStyle = '#0F172A';
    if (isBlinking) {
      ctx.fillRect(cx - 7, cy - 7, 4, 1.5);
      ctx.fillRect(cx + 3, cy - 7, 4, 1.5);
    } else {
      ctx.beginPath();
      ctx.arc(cx - 5, cy - 7, 2.1, 0, Math.PI * 2);
      ctx.arc(cx + 5, cy - 7, 2.1, 0, Math.PI * 2);
      ctx.fill();
    }

    if (app.accessory === 'glasses' || app.accessory === 'visor') {
      ctx.strokeStyle = app.accessory === 'visor' ? '#38BDF8' : '#0F172A';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - 9, cy - 10, 7, 5);
      ctx.strokeRect(cx + 2, cy - 10, 7, 5);
      ctx.beginPath();
      ctx.moveTo(cx - 2, cy - 7.5);
      ctx.lineTo(cx + 2, cy - 7.5);
      ctx.stroke();
    }

    drawRoundedRect(ctx, x - 72, y, 144, 42, 10);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    drawRoundedRect(ctx, x - 72, y + 34, 144, 10, 5);
    ctx.fillStyle = '#CBD5E1';
    ctx.fill();

    drawRoundedRect(ctx, x - 26, y - 8, 52, 30, 5);
    ctx.fillStyle = '#0F172A';
    ctx.fill();

    let screenColor = '#1E293B';
    if (st === S.WORKING) screenColor = '#0EA5E9';
    else if (st === S.REVIEWING) screenColor = '#6366F1';
    else if (st === S.WAITING_APPROVAL) screenColor = '#F59E0B';
    else if (st === S.COMPLETED) screenColor = '#10B981';
    else if (st === S.FAILED) screenColor = '#F43F5E';

    drawRoundedRect(ctx, x - 22, y - 4, 44, 22, 3);
    ctx.fillStyle = screenColor;
    ctx.fill();

    if (isWorking) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const lineOffset = (tick * 0.4) % 12;
      for (let i = 0; i < 3; i++) {
        const lw = 14 + ((i * 9 + Math.floor(tick / 8)) % 18);
        ctx.fillRect(x - 18, y + ((i * 6 + lineOffset) % 16), lw, 2);
      }

      const pY = (tick * 0.8) % 24;
      ctx.fillStyle = `rgba(45, 212, 191, ${1 - pY / 24})`;
      ctx.beginPath();
      ctx.arc(x - 32, y - 18 - pY, 2.5, 0, Math.PI * 2);
      ctx.arc(x + 34, y - 14 - ((pY + 10) % 24), 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (st === S.STANDBY) {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.beginPath();
      ctx.arc(x + Math.sin(tick * 0.05) * 10, y + 7, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(x - 16, y + 26, 32, 6);

    drawDeskProp(ctx, app.deskItem, x + 46, y + 14);

    if (emp.progress > 0 && (isWorking || isWaiting)) {
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(x - 42, y + 36, 84, 5);
      ctx.fillStyle = isWaiting ? '#F59E0B' : '#14B8A6';
      ctx.fillRect(x - 42, y + 36, (84 * emp.progress) / 100, 5);
    }

    const statusStyle = Nexora.STATUS_STYLE[st] || Nexora.STATUS_STYLE['Standby'];

    drawRoundedRect(ctx, x - 64, cy - 58, 128, 32, 10);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
    ctx.fill();
    ctx.strokeStyle = statusStyle.border;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.fillStyle = statusStyle.dot;
    ctx.beginPath();
    ctx.arc(x - 52, cy - 46, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(emp.name, x - 43, cy - 42);

    ctx.fillStyle = statusStyle.text;
    ctx.font = 'bold 9px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(st === S.WAITING_APPROVAL ? 'ACC!' : st, x + 56, cy - 42);

    ctx.fillStyle = '#64748B';
    ctx.font = '600 9.5px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(emp.role, x, cy - 31);

    if (isWaiting) {
      const bounce = Math.sin(tick * 0.18) * 3;
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(x + 48, cy - 56 + bounce, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', x + 48, cy - 52 + bounce);
    } else if (isCompleted) {
      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.arc(x + 48, cy - 56, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✓', x + 48, cy - 52.5);
    } else if (isFailed) {
      ctx.fillStyle = '#F43F5E';
      ctx.beginPath();
      ctx.arc(x + 48, cy - 56, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✕', x + 48, cy - 52.5);
    }

    if (emp.speechBubble && emp.speechTimer > 0) {
      const bw = Math.min(132, Math.max(76, emp.speechBubble.length * 6.5));
      drawRoundedRect(ctx, x - bw / 2, cy - 84, bw, 20, 8);
      ctx.fillStyle = '#0F2942';
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 9.5px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(emp.speechBubble, x, cy - 71);
    }

    ctx.restore();
  }

  function drawDeskProp(ctx, propType, px, py) {
    ctx.save();
    if (propType === 'coffee') {
      ctx.fillStyle = '#0284C7';
      ctx.fillRect(px - 5, py - 4, 10, 10);
      ctx.fillStyle = '#78350F';
      ctx.fillRect(px - 3, py - 4, 6, 3);
    } else if (propType === 'camera') {
      ctx.fillStyle = '#334155';
      ctx.fillRect(px - 8, py - 4, 14, 9);
      ctx.fillStyle = '#2DD4BF';
      ctx.beginPath();
      ctx.arc(px - 1, py + 0.5, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (propType === 'lightbulb') {
      ctx.fillStyle = '#FBBF24';
      ctx.beginPath();
      ctx.arc(px, py - 2, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (propType === 'chart') {
      ctx.fillStyle = '#E0F2FE';
      ctx.fillRect(px - 7, py - 6, 14, 12);
      ctx.fillStyle = '#10B981';
      ctx.fillRect(px - 5, py, 3, 5);
      ctx.fillRect(px - 1, py - 3, 3, 8);
      ctx.fillRect(px + 3, py - 5, 3, 10);
    } else {
      ctx.fillStyle = '#99F6E4';
      ctx.fillRect(px - 6, py - 4, 12, 9);
    }
    ctx.restore();
  }

  Nexora.officeSprites = {
    drawOfficeEnvironment,
    drawEmployeeWorkstation
  };

})(window.Nexora = window.Nexora || {});