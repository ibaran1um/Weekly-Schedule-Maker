/*
 * 週間スケジュール画像メーカー
 * MIT License
 * すべての処理はブラウザ内で完結し、入力内容や画像を外部へ送信しません。
 */
(() => {
  'use strict';

  // ---------- 定数 ----------

  const THEMES = {
    night:  { name: 'ナイト',     bg1: '#1b1838', bg2: '#3a2a6b', surface: '#ffffff', alpha: 0.10, text: '#f5f3ff', accent: '#b9a4ff' },
    sakura: { name: 'さくら',     bg1: '#ffd9e6', bg2: '#fff6f9', surface: '#ffffff', alpha: 0.85, text: '#46202f', accent: '#d6457a' },
    mint:   { name: 'ミント',     bg1: '#cdf1e5', bg2: '#f3fffb', surface: '#ffffff', alpha: 0.85, text: '#123a30', accent: '#16825f' },
    sunset: { name: 'サンセット', bg1: '#ff8a5b', bg2: '#5b2a86', surface: '#1b1030', alpha: 0.55, text: '#fff6ee', accent: '#ffd166' },
    mono:   { name: 'モノクロ',   bg1: '#121212', bg2: '#2a2a2a', surface: '#ffffff', alpha: 0.08, text: '#f2f2f2', accent: '#ffffff' },
    paper:  { name: 'ペーパー',   bg1: '#f4efe6', bg2: '#e9dfcc', surface: '#fffdf8', alpha: 0.95, text: '#2b2622', accent: '#a8462f' },
  };
  const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];
  const WEEKDAYS_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const FONTS = {
    sans: '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", "Meiryo", "Noto Sans JP", "Noto Sans CJK JP", system-ui, sans-serif',
    serif: '"Hiragino Mincho ProN", "Yu Mincho", "YuMincho", "Noto Serif JP", "Noto Serif CJK JP", serif',
    custom: '"WSMUserFont", system-ui, sans-serif',
  };
  const MAX_ENTRIES = 3;
  const STORE_KEY = 'wsm.state.v1';

  // ---------- 日付 ----------

  function nextMonday(from) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const diff = (8 - d.getDay()) % 7; // 今日が月曜なら今日
    d.setDate(d.getDate() + diff);
    return d;
  }
  const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  function fromISO(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  function addDays(d, n) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() + n);
    return x;
  }

  // ---------- 状態 ----------

  function defaultState() {
    return {
      title: '今週の配信予定',
      name: '',
      weekStart: toISO(nextMonday(new Date())),
      days: Array.from({ length: 7 }, () => ({ off: false, entries: [{ time: '', title: '', tag: '' }] })),
      note: '',
      layout: 'cards',
      size: '1920x1080',
      theme: 'night',
      colors: { ...THEMES.night },
      font: 'sans',
      weekdayStyle: 'ja',
      weekendColor: true,
      charSide: 'right',
      bgDim: 0.35,
    };
  }

  function sanitize(raw) {
    const base = defaultState();
    if (!raw || typeof raw !== 'object') return base;
    const s = { ...base };
    const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
    s.title = typeof raw.title === 'string' ? raw.title.slice(0, 40) : base.title;
    s.name = str(raw.name, 40);
    s.weekStart = fromISO(raw.weekStart) ? raw.weekStart : base.weekStart;
    s.note = str(raw.note, 120);
    if (Array.isArray(raw.days) && raw.days.length === 7) {
      s.days = raw.days.map((d) => {
        const entries = Array.isArray(d && d.entries) ? d.entries.slice(0, MAX_ENTRIES).map((e) => ({
          time: str(e && e.time, 20), title: str(e && e.title, 60), tag: str(e && e.tag, 20),
        })) : [];
        return { off: !!(d && d.off), entries: entries.length ? entries : [{ time: '', title: '', tag: '' }] };
      });
    }
    if (['cards', 'list'].includes(raw.layout)) s.layout = raw.layout;
    if (['1920x1080', '1600x900', '1080x1080', '1080x1350', '1080x1920'].includes(raw.size)) s.size = raw.size;
    if (raw.theme in THEMES || raw.theme === 'custom') s.theme = raw.theme;
    const hex = (v, fb) => (/^#[0-9a-f]{6}$/i.test(v) ? v : fb);
    const c = raw.colors || {};
    s.colors = {
      bg1: hex(c.bg1, base.colors.bg1), bg2: hex(c.bg2, base.colors.bg2),
      surface: hex(c.surface, base.colors.surface), text: hex(c.text, base.colors.text),
      accent: hex(c.accent, base.colors.accent),
      alpha: Number.isFinite(c.alpha) ? Math.min(1, Math.max(0, c.alpha)) : base.colors.alpha,
    };
    if (['sans', 'serif'].includes(raw.font)) s.font = raw.font; // 読み込んだフォントは保存しない
    if (['ja', 'en'].includes(raw.weekdayStyle)) s.weekdayStyle = raw.weekdayStyle;
    s.weekendColor = raw.weekendColor !== false;
    if (['left', 'right'].includes(raw.charSide)) s.charSide = raw.charSide;
    if (Number.isFinite(raw.bgDim)) s.bgDim = Math.min(0.8, Math.max(0, raw.bgDim));
    return s;
  }

  function loadState() {
    try { return sanitize(JSON.parse(localStorage.getItem(STORE_KEY) || 'null')); }
    catch (e) { return defaultState(); }
  }
  let saveTimer = 0;
  function writeState() {
    clearTimeout(saveTimer);
    saveTimer = 0;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* 保存できない環境 */ }
  }
  function saveState() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(writeState, 300);
  }
  // ページを閉じる直前の変更も保存する
  window.addEventListener('pagehide', () => { if (saveTimer) writeState(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && saveTimer) writeState(); });

  const state = loadState();
  const images = { char: null, bg: null }; // 保存しない
  let customFontName = '';

  // ---------- 色 ----------

  function hexToRgb(h) { return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); }
  function rgba(h, a) { const [r, g, b] = hexToRgb(h); return `rgba(${r}, ${g}, ${b}, ${a})`; }
  function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function lum(rgb) { return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]); }
  function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function mix(a, b, t) { return a.map((v, i) => Math.round(v * (1 - t) + b[i] * t)); }

  // 枠の実際の色（背景の上に半透明で重ねた色）に対する文字のコントラスト。背景の上端・下端の悪い方を返す
  function worstTextContrast(colors) {
    const text = hexToRgb(colors.text), surf = hexToRgb(colors.surface);
    return Math.min(...[colors.bg1, colors.bg2].map((bg) => contrast(text, mix(hexToRgb(bg), surf, colors.alpha))));
  }

  // ---------- テキスト描画の補助 ----------

  function font(size, weight) {
    return `${weight || 400} ${Math.max(1, Math.round(size))}px ${FONTS[state.font] || FONTS.sans}`;
  }

  // 幅に収まるまで文字を小さくする
  function fitSize(ctx, text, maxW, size, weight, minSize) {
    let s = size;
    ctx.font = font(s, weight);
    while (s > minSize && ctx.measureText(text).width > maxW) {
      s -= Math.max(1, s * 0.05);
      ctx.font = font(s, weight);
    }
    return s;
  }

  // 1文字単位で折り返し（日本語向け）。行数を超えたら末尾を「…」にする
  function wrap(ctx, text, maxW, maxLines) {
    const chars = Array.from(text);
    const lines = [];
    let line = '';
    for (let i = 0; i < chars.length; i++) {
      const next = line + chars[i];
      if (ctx.measureText(next).width > maxW && line) {
        lines.push(line);
        line = chars[i];
        if (lines.length === maxLines) {
          let last = lines[maxLines - 1];
          while (last.length && ctx.measureText(last + '…').width > maxW) last = Array.from(last).slice(0, -1).join('');
          lines[maxLines - 1] = last + '…';
          return lines;
        }
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function pill(ctx, text, x, y, size, bg, fg, maxW) {
    ctx.font = font(size, 700);
    const padX = size * 0.55, h = size * 1.55;
    let t = text;
    const avail = maxW - padX * 2;
    if (ctx.measureText(t).width > avail) {
      while (t.length && ctx.measureText(t + '…').width > avail) t = Array.from(t).slice(0, -1).join('');
      t += '…';
    }
    const w = ctx.measureText(t).width + padX * 2;
    ctx.fillStyle = bg;
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.textBaseline = 'middle';
    ctx.fillText(t, x + padX, y + h / 2 + size * 0.04);
    ctx.textBaseline = 'alphabetic';
    return { w, h };
  }

  // 強調色の上に乗せる文字色（白か黒の読みやすい方）
  function onColor(hex) {
    const c = hexToRgb(hex);
    return contrast(c, [255, 255, 255]) >= contrast(c, [17, 17, 17]) ? '#ffffff' : '#111111';
  }

  // ---------- 描画 ----------

  function dayInfo(i) {
    const start = fromISO(state.weekStart) || nextMonday(new Date());
    const d = addDays(start, i);
    const wd = d.getDay();
    const names = state.weekdayStyle === 'en' ? WEEKDAYS_EN : WEEKDAYS_JA;
    let color = state.colors.accent;
    if (state.weekendColor && wd === 6) color = '#3b82f6';
    if (state.weekendColor && wd === 0) color = '#ef4444';
    return { date: d, label: names[wd], md: `${d.getMonth() + 1}/${d.getDate()}`, color };
  }

  function drawBackground(ctx, W, H) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, state.colors.bg1);
    g.addColorStop(1, state.colors.bg2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (images.bg) {
      const im = images.bg;
      const s = Math.max(W / im.width, H / im.height);
      const w = im.width * s, h = im.height * s;
      ctx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
      if (state.bgDim > 0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${state.bgDim})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
  }

  function drawCharacter(ctx, area) {
    const im = images.char;
    if (!im) return;
    const s = Math.min(area.w / im.width, area.h / im.height);
    const w = im.width * s, h = im.height * s;
    ctx.drawImage(im, area.x + (area.w - w) / 2, area.y + area.h - h, w, h);
  }

  function drawHeader(ctx, x, y, w, h) {
    const c = state.colors;
    const start = fromISO(state.weekStart) || nextMonday(new Date());
    const end = addDays(start, 6);
    const names = state.weekdayStyle === 'en' ? WEEKDAYS_EN : WEEKDAYS_JA;
    const range = `${start.getMonth() + 1}/${start.getDate()}（${names[start.getDay()]}）〜 ${end.getMonth() + 1}/${end.getDate()}（${names[end.getDay()]}）`;

    const titleSize = fitSize(ctx, state.title || ' ', w, h * 0.5, 800, h * 0.2);
    ctx.fillStyle = c.text;
    ctx.textBaseline = 'alphabetic';
    ctx.font = font(titleSize, 800);
    ctx.fillText(state.title, x, y + titleSize * 0.95);

    const subSize = h * 0.2;
    const sub = state.name ? `${state.name}　｜　${range}` : range;
    const s2 = fitSize(ctx, sub, w, subSize, 600, subSize * 0.5);
    ctx.font = font(s2, 600);
    ctx.fillStyle = c.accent;
    ctx.fillText(sub, x, y + titleSize * 0.95 + s2 * 1.6);
  }

  // 何列×何行にすると枠の形が目標の比率に近くなるか
  function bestGrid(n, w, h, gap, targetAspect) {
    let best = null;
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const cw = (w - gap * (cols - 1)) / cols, ch = (h - gap * (rows - 1)) / rows;
      if (cw <= 0 || ch <= 0) continue;
      const score = Math.abs(Math.log((cw / ch) / targetAspect)) + (cols * rows - n) * 0.08;
      if (!best || score < best.score) best = { cols, rows, cw, ch, score };
    }
    return best;
  }

  function drawCard(ctx, i, x, y, w, h, unit) {
    const c = state.colors;
    const info = dayInfo(i);
    const day = state.days[i];
    ctx.fillStyle = rgba(c.surface, c.alpha);
    roundRect(ctx, x, y, w, h, unit * 1.2);
    ctx.fill();

    const pad = Math.min(w, h) * 0.08;
    const fs = Math.min(w * 0.13, h * 0.11, unit * 2.6);
    // 曜日と日付
    const p = pill(ctx, info.label, x + pad, y + pad, fs * 0.8, info.color, onColor(info.color), w - pad * 2);
    ctx.fillStyle = c.text;
    ctx.font = font(fs * 1.05, 800);
    ctx.textBaseline = 'middle';
    const mdW = ctx.measureText(info.md).width;
    ctx.fillText(info.md, Math.max(x + pad + p.w + fs * 0.4, x + w - pad - mdW), y + pad + p.h / 2);
    ctx.textBaseline = 'alphabetic';

    const top = y + pad + p.h + fs * 0.7;
    const bottom = y + h - pad;
    const entries = day.entries.filter((e) => e.time || e.title || e.tag);
    if (day.off || !entries.length) {
      ctx.fillStyle = rgba(c.text, 0.6);
      const msg = day.off ? 'おやすみ' : '未定';
      const s = fitSize(ctx, msg, w - pad * 2, fs * 1.1, 700, fs * 0.5);
      ctx.font = font(s, 700);
      ctx.textAlign = 'center';
      ctx.fillText(msg, x + w / 2, top + (bottom - top) / 2 + s * 0.35);
      ctx.textAlign = 'left';
      return;
    }
    const maxW = w - pad * 2;
    const avail = bottom - top;
    const maxLines = entries.length === 1 ? 3 : 2;

    // 文字の大きさ f のときに、各枠の高さと行を計算する
    const measure = (f) => {
      const T = f * 1.2, t = f * 0.92, g = f * 0.66, gap = f * 0.7;
      let total = 0;
      const items = entries.map((e) => {
        const it = { e, T, t, g, lines: [], h: 0 };
        if (e.time) it.h += T * 1.15;
        if (e.title) {
          ctx.font = font(t, 700);
          it.lines = wrap(ctx, e.title, maxW, maxLines);
          it.h += it.lines.length * t * 1.3;
        }
        if (e.tag) it.h += f * 0.3 + g * 1.55;
        total += it.h;
        return it;
      });
      total += gap * (entries.length - 1);
      return { items, total, gap };
    };
    // 収まるまで少しずつ小さくする
    let f = fs, m = measure(f);
    while (m.total > avail && f > fs * 0.4) { f *= 0.94; m = measure(f); }

    let yy = top + Math.max(0, (avail - m.total) * 0.15);
    m.items.forEach((it, k) => {
      if (k > 0) {
        ctx.fillStyle = rgba(c.text, 0.18);
        ctx.fillRect(x + pad, yy + m.gap / 2 - m.gap, maxW, Math.max(1, unit * 0.08));
      }
      const { e } = it;
      if (e.time) {
        const ts = fitSize(ctx, e.time, maxW, it.T, 800, it.T * 0.5);
        ctx.font = font(ts, 800);
        ctx.fillStyle = c.accent;
        ctx.fillText(e.time, x + pad, yy + it.T * 0.92);
        yy += it.T * 1.15;
      }
      if (e.title) {
        ctx.font = font(it.t, 700);
        ctx.fillStyle = c.text;
        it.lines.forEach((ln, j) => ctx.fillText(ln, x + pad, yy + it.t * (1 + j * 1.3)));
        yy += it.lines.length * it.t * 1.3;
      }
      if (e.tag) {
        yy += f * 0.3;
        pill(ctx, e.tag, x + pad, yy, it.g, rgba(c.accent, 0.22), c.text, maxW);
        yy += it.g * 1.55;
      }
      yy += m.gap;
    });
  }

  function drawNoteCell(ctx, x, y, w, h, unit) {
    const c = state.colors;
    ctx.fillStyle = rgba(c.accent, 0.18);
    roundRect(ctx, x, y, w, h, unit * 1.2);
    ctx.fill();
    const pad = Math.min(w * 0.06, h * 0.2, unit * 2);
    const s = Math.min(w * 0.085, h * 0.4, unit * 2.2);
    ctx.font = font(s, 700);
    ctx.fillStyle = c.text;
    const lines = wrap(ctx, state.note, w - pad * 2, Math.max(1, Math.floor((h - pad * 0.5) / (s * 1.4))));
    const total = lines.length * s * 1.4;
    lines.forEach((ln, j) => ctx.fillText(ln, x + pad, y + (h - total) / 2 + s * (1.05 + j * 1.4)));
  }

  function drawCards(ctx, area, unit) {
    const gap = unit * 1.1;
    const hasNote = !!state.note.trim();
    const n = hasNote ? 8 : 7;
    const g = bestGrid(n, area.w, area.h, gap, 0.78);
    for (let i = 0; i < n; i++) {
      const col = i % g.cols, row = Math.floor(i / g.cols);
      const x = area.x + col * (g.cw + gap), y = area.y + row * (g.ch + gap);
      if (i < 7) drawCard(ctx, i, x, y, g.cw, g.ch, unit);
      else {
        // ひとことは最後の行の残りの幅を使う
        const remaining = g.cols - col;
        drawNoteCell(ctx, x, y, g.cw * remaining + gap * (remaining - 1), g.ch, unit);
      }
    }
  }

  // リストの1枠を横一列に描く（時間・内容・タグ）
  function drawListEntry(ctx, e, x, cy, w, fs) {
    const c = state.colors;
    const right = x + w;
    ctx.textBaseline = 'middle';
    if (e.time) {
      const ts = fitSize(ctx, e.time, w * 0.4, fs * 1.05, 800, fs * 0.5);
      ctx.font = font(ts, 800);
      ctx.fillStyle = c.accent;
      ctx.fillText(e.time, x, cy);
      x += ctx.measureText(e.time).width + fs * 0.55;
    }
    // タグは内容を優先し、場所が足りなければ省く
    let tagW = 0;
    if (e.tag) {
      ctx.font = font(fs * 0.6, 700);
      const need = ctx.measureText(e.tag).width + fs * 0.66;
      const roomForTag = (right - x) - fs * 5; // 内容に最低5文字ぶん残す
      tagW = roomForTag > fs * 2 ? Math.min(need, roomForTag) : 0;
    }
    if (e.title) {
      const room = right - x - (tagW ? tagW + fs * 0.4 : 0);
      const tsz = fitSize(ctx, e.title, room, fs * 0.92, 700, fs * 0.66);
      ctx.font = font(tsz, 700);
      ctx.fillStyle = c.text;
      const ln = wrap(ctx, e.title, room, 1)[0] || '';
      ctx.fillText(ln, x, cy);
      x += Math.min(room, ctx.measureText(ln).width) + fs * 0.4;
    }
    ctx.textBaseline = 'alphabetic';
    if (tagW) pill(ctx, e.tag, x, cy - fs * 0.6 * 0.78, fs * 0.6, rgba(c.accent, 0.22), c.text, tagW);
  }

  function drawList(ctx, area, unit) {
    const c = state.colors;
    const gap = unit * 0.7;
    const hasNote = !!state.note.trim();
    const noteH = hasNote ? Math.min(area.h * 0.13, unit * 6) : 0;
    const rowsH = area.h - noteH - (hasNote ? gap : 0);
    const rh = (rowsH - gap * 6) / 7;
    const fs = Math.min(rh * 0.42, unit * 2.4);
    const pad = Math.min(rh * 0.22, unit * 1.2);

    // 曜日欄の幅：1行で入らなければ日付と曜日を2行にする
    ctx.font = font(fs, 800);
    const oneLineW = Math.max(...Array.from({ length: 7 }, (_, i) => {
      const d = dayInfo(i);
      return ctx.measureText(`${d.md} ${d.label}`).width;
    })) + pad * 2;
    const twoLine = oneLineW > area.w * 0.24;
    const labelW = twoLine ? Math.min(area.w * 0.2, fs * 4.2) : oneLineW;

    for (let i = 0; i < 7; i++) {
      const info = dayInfo(i);
      const day = state.days[i];
      const y = area.y + i * (rh + gap);
      const r = Math.min(unit, rh / 3);
      ctx.fillStyle = rgba(c.surface, c.alpha);
      roundRect(ctx, area.x, y, area.w, rh, r);
      ctx.fill();

      ctx.fillStyle = info.color;
      roundRect(ctx, area.x, y, labelW, rh, r);
      ctx.fill();
      ctx.fillStyle = onColor(info.color);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (twoLine) {
        const s1 = fitSize(ctx, info.md, labelW - pad, Math.min(fs * 0.95, rh * 0.36), 800, fs * 0.4);
        ctx.font = font(s1, 800);
        ctx.fillText(info.md, area.x + labelW / 2, y + rh * 0.34);
        const s2 = fitSize(ctx, info.label, labelW - pad, Math.min(fs * 0.85, rh * 0.3), 800, fs * 0.4);
        ctx.font = font(s2, 800);
        ctx.fillText(info.label, area.x + labelW / 2, y + rh * 0.7);
      } else {
        ctx.font = font(fs, 800);
        ctx.fillText(`${info.md} ${info.label}`, area.x + labelW / 2, y + rh / 2);
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';

      const x0 = area.x + labelW + pad;
      const w0 = area.w - labelW - pad * 2;
      const entries = day.entries.filter((e) => e.time || e.title || e.tag);
      if (day.off || !entries.length) {
        ctx.font = font(fs * 0.9, 700);
        ctx.fillStyle = rgba(c.text, 0.6);
        ctx.textBaseline = 'middle';
        ctx.fillText(day.off ? 'おやすみ' : '未定', x0, y + rh / 2);
        ctx.textBaseline = 'alphabetic';
        continue;
      }
      // 横に並べて1枠あたり十分な幅があれば横並び、なければ縦に積む
      const side = entries.length === 1 || (w0 - pad * (entries.length - 1)) / entries.length >= fs * 11;
      if (side) {
        const ew = (w0 - pad * (entries.length - 1)) / entries.length;
        entries.forEach((e, k) => {
          const x = x0 + k * (ew + pad);
          if (k > 0) {
            ctx.fillStyle = rgba(c.text, 0.2);
            ctx.fillRect(x - pad / 2, y + rh * 0.2, Math.max(1, unit * 0.08), rh * 0.6);
          }
          drawListEntry(ctx, e, x, y + rh / 2, ew, fs);
        });
      } else {
        const sub = rh / entries.length;
        const sfs = Math.min(fs, sub * 0.62);
        entries.forEach((e, k) => {
          if (k > 0) {
            ctx.fillStyle = rgba(c.text, 0.16);
            ctx.fillRect(x0, y + sub * k, w0, Math.max(1, unit * 0.06));
          }
          drawListEntry(ctx, e, x0, y + sub * (k + 0.5), w0, sfs);
        });
      }
    }
    if (hasNote) {
      drawNoteCell(ctx, area.x, area.y + rowsH + gap, area.w, noteH, unit);
    }
  }

  function render(canvas) {
    const [W, H] = state.size.split('x').map(Number);
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const unit = Math.min(W, H) / 54; // 余白などの基準
    const margin = unit * 3;

    drawBackground(ctx, W, H);

    // 立ち絵の場所
    const portrait = H / W > 1.4; // 9:16 のような縦長だけ立ち絵を下に置く（4:5 は横に置く）
    let content = { x: margin, y: margin, w: W - margin * 2, h: H - margin * 2 };
    if (images.char) {
      if (portrait) {
        // 縦長は下側に立ち絵、上側に予定
        const ch = content.h * 0.3;
        const charArea = { x: state.charSide === 'left' ? 0 : W * 0.35, y: H - ch - margin * 0.5, w: W * 0.65, h: ch + margin * 0.5 };
        content.h -= ch;
        drawCharacter(ctx, charArea);
      } else {
        const cw = W * (W / H > 1.5 ? 0.27 : 0.32);
        const charArea = state.charSide === 'left' ? { x: 0, y: margin, w: cw, h: H - margin } : { x: W - cw, y: margin, w: cw, h: H - margin };
        if (state.charSide === 'left') content.x += cw - margin * 0.5;
        content.w -= cw - margin * 0.5;
        drawCharacter(ctx, charArea);
      }
    }

    const headerH = Math.min(content.h * 0.17, unit * 9);
    drawHeader(ctx, content.x, content.y, content.w, headerH);
    const body = { x: content.x, y: content.y + headerH + unit * 1.6, w: content.w, h: content.h - headerH - unit * 1.6 };
    if (state.layout === 'list') drawList(ctx, body, unit);
    else drawCards(ctx, body, unit);
  }

  // ---------- 画面の要素 ----------

  const $ = (id) => document.getElementById(id);
  const el = {
    title: $('title'), name: $('name'), weekStart: $('week-start'), weekPrev: $('week-prev'), weekNext: $('week-next'),
    days: $('days'), note: $('note'), clearAll: $('clear-all'),
    layout: $('layout'), size: $('size'), theme: $('theme'), font: $('font'), weekdayStyle: $('weekday-style'), weekendColor: $('weekend-color'),
    bg1: $('c-bg1'), bg2: $('c-bg2'), surface: $('c-surface'), alpha: $('c-alpha'), text: $('c-text'), accent: $('c-accent'),
    contrastWarn: $('contrast-warn'),
    charPick: $('char-pick'), charClear: $('char-clear'), charFile: $('char-file'), charSide: $('char-side'),
    bgPick: $('bg-pick'), bgClear: $('bg-clear'), bgFile: $('bg-file'), bgDim: $('bg-dim'),
    fontPick: $('font-pick'), fontFile: $('font-file'), fontName: $('font-name'),
    jsonSave: $('json-save'), jsonLoad: $('json-load'), jsonFile: $('json-file'),
    canvas: $('canvas'), download: $('download'), copy: $('copy'), status: $('status'),
  };

  let rafId = 0;
  function update() {
    saveState();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => render(el.canvas));
    updateContrastWarning();
  }

  function updateContrastWarning() {
    const r = worstTextContrast(state.colors);
    el.contrastWarn.textContent = `文字と枠のコントラスト比：${(Math.floor(r * 100) / 100).toFixed(2)} : 1` +
      (r < 4.5 ? '（4.5未満なので、小さく表示すると読みにくい可能性があります）' : '');
    el.contrastWarn.classList.toggle('warn', r < 4.5);
  }

  function setStatus(msg) {
    el.status.textContent = msg;
    clearTimeout(setStatus.t);
    setStatus.t = setTimeout(() => { el.status.textContent = ''; }, 3000);
  }

  // ---------- 予定の入力欄 ----------

  function renderDays() {
    el.days.textContent = '';
    state.days.forEach((day, i) => {
      const info = dayInfo(i);
      const box = document.createElement('div');
      box.className = 'day' + (day.off ? ' off' : '');

      const head = document.createElement('div');
      head.className = 'day-head';
      const label = document.createElement('span');
      label.className = 'day-label';
      label.textContent = `${info.md}（${WEEKDAYS_JA[info.date.getDay()]}）`;
      const offLabel = document.createElement('label');
      const off = document.createElement('input');
      off.type = 'checkbox';
      off.checked = day.off;
      off.addEventListener('change', () => { day.off = off.checked; renderDays(); update(); });
      offLabel.append(off, 'おやすみ');
      const spacer = document.createElement('span');
      spacer.className = 'spacer';
      head.append(label, offLabel, spacer);
      if (!day.off && day.entries.length < MAX_ENTRIES) {
        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'btn small';
        add.textContent = '枠を追加';
        add.addEventListener('click', () => { day.entries.push({ time: '', title: '', tag: '' }); renderDays(); update(); });
        head.append(add);
      }
      box.append(head);

      if (!day.off) {
        const list = document.createElement('div');
        list.className = 'entries';
        day.entries.forEach((e, k) => {
          const row = document.createElement('div');
          row.className = 'entry';
          const mk = (key, ph, max, cls, aria) => {
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.value = e[key];
            inp.placeholder = ph;
            inp.maxLength = max;
            if (cls) inp.className = cls;
            inp.setAttribute('aria-label', `${info.md} ${aria}`);
            inp.addEventListener('input', () => { e[key] = inp.value; update(); });
            return inp;
          };
          row.append(mk('time', '21:00', 20, '', '時間'), mk('title', '配信内容', 60, '', '内容'), mk('tag', 'タグ', 20, 'tag', 'タグ'));
          const del = document.createElement('button');
          del.type = 'button';
          del.className = 'icon-btn';
          del.textContent = '削除';
          del.setAttribute('aria-label', `${info.md}の枠${k + 1}を削除`);
          del.addEventListener('click', () => {
            day.entries.splice(k, 1);
            if (!day.entries.length) day.entries.push({ time: '', title: '', tag: '' });
            renderDays(); update();
          });
          row.append(del);
          list.append(row);
        });
        box.append(list);
      }
      el.days.append(box);
    });
  }

  // ---------- 入力と状態のつなぎ ----------

  function syncForm() {
    el.title.value = state.title;
    el.name.value = state.name;
    el.weekStart.value = state.weekStart;
    el.note.value = state.note;
    el.layout.value = state.layout;
    el.size.value = state.size;
    el.theme.value = state.theme;
    el.font.value = state.font;
    el.weekdayStyle.value = state.weekdayStyle;
    el.weekendColor.checked = state.weekendColor;
    el.charSide.value = state.charSide;
    el.bgDim.value = String(state.bgDim);
    syncColors();
    renderDays();
  }
  function syncColors() {
    el.bg1.value = state.colors.bg1;
    el.bg2.value = state.colors.bg2;
    el.surface.value = state.colors.surface;
    el.alpha.value = String(state.colors.alpha);
    el.text.value = state.colors.text;
    el.accent.value = state.colors.accent;
  }

  // 配色の選択肢
  Object.entries(THEMES).forEach(([k, t]) => {
    const o = document.createElement('option');
    o.value = k;
    o.textContent = t.name;
    el.theme.append(o);
  });
  const customOpt = document.createElement('option');
  customOpt.value = 'custom';
  customOpt.textContent = 'カスタム';
  el.theme.append(customOpt);

  el.title.addEventListener('input', () => { state.title = el.title.value; update(); });
  el.name.addEventListener('input', () => { state.name = el.name.value; update(); });
  el.note.addEventListener('input', () => { state.note = el.note.value; update(); });
  el.weekStart.addEventListener('change', () => {
    if (fromISO(el.weekStart.value)) { state.weekStart = el.weekStart.value; renderDays(); update(); }
  });
  function shiftWeek(n) {
    const d = fromISO(state.weekStart) || nextMonday(new Date());
    state.weekStart = toISO(addDays(d, n * 7));
    el.weekStart.value = state.weekStart;
    renderDays();
    update();
  }
  el.weekPrev.addEventListener('click', () => shiftWeek(-1));
  el.weekNext.addEventListener('click', () => shiftWeek(1));
  el.clearAll.addEventListener('click', () => {
    if (!confirm('すべての日の予定を消しますか？（見出しや配色は残ります）')) return;
    state.days = defaultState().days;
    state.note = '';
    el.note.value = '';
    renderDays();
    update();
  });

  el.layout.addEventListener('change', () => { state.layout = el.layout.value; update(); });
  el.size.addEventListener('change', () => { state.size = el.size.value; update(); });
  el.theme.addEventListener('change', () => {
    state.theme = el.theme.value;
    if (THEMES[state.theme]) {
      const { name, ...colors } = THEMES[state.theme];
      state.colors = colors;
      syncColors();
    }
    update();
  });
  el.font.addEventListener('change', () => { state.font = el.font.value; update(); });
  el.weekdayStyle.addEventListener('change', () => { state.weekdayStyle = el.weekdayStyle.value; update(); });
  el.weekendColor.addEventListener('change', () => { state.weekendColor = el.weekendColor.checked; update(); });
  el.charSide.addEventListener('change', () => { state.charSide = el.charSide.value; update(); });
  el.bgDim.addEventListener('input', () => { state.bgDim = Number(el.bgDim.value); update(); });

  [['bg1', 'bg1'], ['bg2', 'bg2'], ['surface', 'surface'], ['text', 'text'], ['accent', 'accent']].forEach(([id, key]) => {
    el[id].addEventListener('input', () => {
      state.colors[key] = el[id].value;
      state.theme = 'custom';
      el.theme.value = 'custom';
      update();
    });
  });
  el.alpha.addEventListener('input', () => {
    state.colors.alpha = Number(el.alpha.value);
    state.theme = 'custom';
    el.theme.value = 'custom';
    update();
  });

  // ---------- 画像・フォントの読み込み ----------

  function readImage(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('type')); return; }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }
  function bindImage(pick, file, clear, key) {
    pick.addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      try { images[key] = await readImage(file.files[0]); update(); }
      catch (e) { alert('画像を読み込めませんでした。PNG・JPEG・WebPなどでお試しください。'); }
      file.value = '';
    });
    clear.addEventListener('click', () => { images[key] = null; update(); });
  }
  bindImage(el.charPick, el.charFile, el.charClear, 'char');
  bindImage(el.bgPick, el.bgFile, el.bgClear, 'bg');

  el.fontPick.addEventListener('click', () => el.fontFile.click());
  el.fontFile.addEventListener('change', async () => {
    const f = el.fontFile.files[0];
    el.fontFile.value = '';
    if (!f) return;
    try {
      const face = new FontFace('WSMUserFont', await f.arrayBuffer());
      await face.load();
      document.fonts.add(face);
      customFontName = f.name;
      const opt = el.font.querySelector('option[value="custom"]');
      opt.disabled = false;
      opt.textContent = `読み込んだフォント（${f.name}）`;
      state.font = 'custom';
      el.font.value = 'custom';
      el.fontName.textContent = `使用中：${customFontName}`;
      update();
    } catch (e) {
      alert('このフォントファイルは読み込めませんでした。');
    }
  });

  // ---------- 保存 ----------

  function stamp() {
    const s = fromISO(state.weekStart) || new Date();
    return toISO(s).replace(/-/g, '');
  }
  function downloadBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function toBlob() {
    const c = document.createElement('canvas');
    render(c);
    return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
  }

  el.download.addEventListener('click', async () => {
    const blob = await toBlob();
    if (!blob) { alert('画像を作れませんでした。'); return; }
    downloadBlob(blob, `schedule_${stamp()}.png`);
    setStatus('保存しました');
  });

  el.copy.addEventListener('click', async () => {
    if (!(navigator.clipboard && window.ClipboardItem)) {
      setStatus('このブラウザでは画像のコピーに対応していません。PNGで保存してください。');
      return;
    }
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': toBlob() })]);
      setStatus('クリップボードにコピーしました');
    } catch (e) {
      setStatus('コピーできませんでした。PNGで保存してください。');
    }
  });

  el.jsonSave.addEventListener('click', () => {
    const data = { ...state, font: state.font === 'custom' ? 'sans' : state.font };
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `schedule-settings_${stamp()}.json`);
    setStatus('設定を保存しました');
  });
  el.jsonLoad.addEventListener('click', () => el.jsonFile.click());
  el.jsonFile.addEventListener('change', async () => {
    const f = el.jsonFile.files[0];
    el.jsonFile.value = '';
    if (!f) return;
    try {
      const loaded = sanitize(JSON.parse(await f.text()));
      Object.assign(state, loaded);
      syncForm();
      update();
      setStatus('設定を読み込みました');
    } catch (e) {
      alert('設定ファイルを読み込めませんでした。');
    }
  });

  // ---------- 初期化 ----------

  syncForm();
  update();
  // ブラウザのフォント準備ができたら描き直す
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => render(el.canvas));

  // テスト用
  window.WSM = { state, render, worstTextContrast, THEMES, images, sanitize };
})();
