class ExportService {
  /**
   * Helper to format seconds to Timecode HH:MM:SS:FF (at 25fps)
   */
  secondsToTC(sec, fps = 25) {
    if (isNaN(sec) || sec < 0) sec = 0;
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = Math.floor(sec % 60);
    const frames = Math.floor((sec - Math.floor(sec)) * fps);

    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`;
  }

  filterPromos(promos, approvedOnly, reviews = {}) {
    if (!approvedOnly) return promos;
    return promos.filter(p => {
      const rev = reviews[p.id] || p.review;
      return rev && rev.status === 'approved';
    });
  }

  exportCSV(promos, approvedOnly = false, reviews = {}) {
    const list = this.filterPromos(promos, approvedOnly, reviews);
    const escapeCsv = (str) => `"${String(str || '').replace(/"/g, '""')}"`;

    const headers = [
      'Rank',
      'Promo ID',
      'Review Status',
      'Review Notes',
      'Episodes',
      'Duration (s)',
      'Total Score',
      'Tier',
      'Funnel Phase',
      'Archetype',
      'Hook (0-3s)',
      'Cliffhanger Cut',
      'Why It Works',
      'Ordered Segments'
    ];

    const rows = [headers.join(',')];

    for (const p of list) {
      const rev = reviews[p.id] || p.review || {};
      const segSummary = (p.segments || []).map(s => `Ep${s.episode}:${s.start_sec}s-${s.end_sec}s(${s.duration}s)`).join(' | ');

      rows.push([
        p.rank || '',
        p.id || '',
        escapeCsv(rev.status || 'unreviewed'),
        escapeCsv(rev.notes || ''),
        escapeCsv((p.episodes || []).join(', ')),
        p.duration || 0,
        p.total_score || 0,
        p.tier || '',
        escapeCsv(p.funnel_phase || ''),
        escapeCsv(p.archetype || ''),
        escapeCsv(p.hook?.text || ''),
        escapeCsv(p.cliffhanger?.text || ''),
        escapeCsv(p.why_it_works || ''),
        escapeCsv(segSummary)
      ].join(','));
    }

    return rows.join('\n');
  }

  exportJSON(promos, approvedOnly = false, reviews = {}) {
    const list = this.filterPromos(promos, approvedOnly, reviews);
    const mapped = list.map(p => ({
      ...p,
      review: reviews[p.id] || p.review || { status: 'unreviewed' }
    }));
    return JSON.stringify(mapped, null, 2);
  }

  exportEDL(promos, approvedOnly = false, reviews = {}, showTitle = 'KUKU_MICRODRAMA') {
    const list = this.filterPromos(promos, approvedOnly, reviews);
    const lines = [
      `TITLE: ${showTitle.replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase()}_PROMOS_EDL`,
      `FCM: NON-DROP FRAME`,
      ``
    ];

    let eventNum = 1;
    let masterTimelineSec = 3600; // start timeline at 01:00:00:00 standard

    for (const p of list) {
      const rev = reviews[p.id] || p.review || {};
      const segs = p.segments || [];

      for (const seg of segs) {
        const segDur = seg.duration || (seg.end_sec - seg.start_sec);
        const srcInTC = this.secondsToTC(seg.start_sec);
        const srcOutTC = this.secondsToTC(seg.end_sec);
        const recInTC = this.secondsToTC(masterTimelineSec);
        const recOutTC = this.secondsToTC(masterTimelineSec + segDur);

        const evStr = String(eventNum).padStart(3, '0');
        const reelName = `EP_${String(seg.episode).padStart(2, '0')}`;

        lines.push(`${evStr}  ${reelName.padEnd(8, ' ')} V     C        ${srcInTC} ${srcOutTC} ${recInTC} ${recOutTC}`);
        lines.push(`* FROM CLIP: ${p.id} (Score: ${p.total_score || 0}, Tier: ${p.tier || 'B'}) [${p.archetype || 'Promo'}]`);
        lines.push(`* REVIEW: ${rev.status || 'unreviewed'}${rev.notes ? ` - ${rev.notes}` : ''}`);
        lines.push(`* HOOK: ${(p.hook?.text || '').substring(0, 60)}`);
        lines.push(``);

        masterTimelineSec += segDur;
        eventNum++;
      }
    }

    return lines.join('\n');
  }
}

module.exports = new ExportService();
