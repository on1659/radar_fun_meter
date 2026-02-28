'use strict';

/**
 * @param {object} result  FunMeter.run()이 반환한 결과 객체
 * @returns {string}       완전한 HTML 문자열 (self-contained, CSS 인라인)
 */
function toHTML(result) {
  const { name, runs, zone, emoji, advice, mean, median, stddev,
          p25, p75, p90, p95, timeoutRate, scoreMean, scoreMax,
          levelStats, histogram } = result;

  const zoneColor = zone === 'FLOW' ? '#22c55e'
    : zone === 'TOO_HARD' ? '#ef4444' : '#f59e0b';

  const histRows = histogram.map(function(h) {
    const pct = Math.round((h.bar.length / 15) * 100);
    return [
      '      <div class="hist-row">',
      '        <span class="hist-label">' + h.from.toFixed(1) + '~' + h.to.toFixed(1) + 's</span>',
      '        <div class="hist-bar-wrap">',
      '          <div class="hist-bar" style="width:' + pct + '%"></div>',
      '        </div>',
      '        <span class="hist-count">' + h.count + '</span>',
      '      </div>',
    ].join('\n');
  }).join('\n');

  const levelSection = levelStats ? [
    '  <h2>레벨</h2>',
    '  <p>평균 ' + levelStats.mean.toFixed(1) + ' · 중앙값 ' + levelStats.median.toFixed(1) + ' · 최고 ' + levelStats.max + '</p>',
  ].join('\n') : '';

  const suggestionsSection = (result.suggestions?.length > 0) ? [
    '  <h2>제안</h2>',
    '  <ul>',
    '    ' + result.suggestions.map(function(s) { return '<li>' + s + '</li>'; }).join('\n    '),
    '  </ul>',
  ].join('\n') : '';

  const scoreCurveSection = result.scoreCurve ? (function() {
    var sc = result.scoreCurve;
    var maxBucket = Math.max.apply(null, sc.buckets.concat([1]));
    var bars = sc.buckets.map(function(v, i) {
      var pct = Math.round((v / maxBucket) * 100);
      return '<div class="curve-bar" style="height:' + pct + '%" title="구간 ' + (i + 1) + ': ' + v.toFixed(0) + '점"></div>';
    }).join('');
    return [
      '  <h2>점수 곡선 <small style="font-size:.75em;color:#64748b">' + sc.pattern + '</small></h2>',
      '  <div class="curve-chart">' + bars + '</div>',
      '  <p>전반 ' + sc.growth1H.toFixed(1) + '/s → 후반 ' + sc.growth2H.toFixed(1) + '/s</p>',
    ].join('\n');
  })() : '';

  const lines = [
    '<!DOCTYPE html>',
    '<html lang="ko">',
    '<head>',
    '  <meta charset="UTF-8">',
    '  <title>' + name + ' — Fun Meter 리포트</title>',
    '  <style>',
    '    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 16px; }',
    '    .badge { display:inline-block; padding:4px 12px; border-radius:9999px; color:#fff;',
    '             background:' + zoneColor + '; font-weight:700; font-size:1.1em; }',
    '    .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin:16px 0; }',
    '    .card { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; }',
    '    .card .label { font-size:.75em; color:#64748b; }',
    '    .card .value { font-size:1.4em; font-weight:700; }',
    '    .hist-row { display:flex; align-items:center; gap:8px; margin:4px 0; }',
    '    .hist-label { width:110px; font-size:.85em; color:#475569; flex-shrink:0; }',
    '    .hist-bar-wrap { flex:1; background:#e2e8f0; border-radius:4px; height:16px; }',
    '    .hist-bar { background:' + zoneColor + '; height:100%; border-radius:4px; min-width:2px; }',
    '    .hist-count { width:36px; text-align:right; font-size:.8em; color:#64748b; }',
    '    blockquote { border-left:4px solid ' + zoneColor + '; padding:8px 16px; margin:16px 0;',
    '                 background:#f8fafc; border-radius:0 8px 8px 0; }',
    '    .curve-chart { display:flex; align-items:flex-end; gap:3px; height:80px; margin:8px 0;',
    '                   background:#f8fafc; padding:4px; border-radius:6px; }',
    '    .curve-bar { flex:1; background:#6366f1; border-radius:2px 2px 0 0; min-height:2px; }',
    '  </style>',
    '</head>',
    '<body>',
    '  <h1>' + name + ' <span class="badge">' + emoji + ' ' + zone + '</span></h1>',
    '  <p>' + runs + '회 실행 · 생성: ' + new Date().toLocaleString('ko-KR') + '</p>',
    '',
    '  <h2>생존 시간 통계</h2>',
    '  <div class="grid">',
    '    <div class="card"><div class="label">평균</div><div class="value">' + mean.toFixed(1) + 's</div></div>',
    '    <div class="card"><div class="label">중앙값</div><div class="value">' + median.toFixed(1) + 's</div></div>',
    '    <div class="card"><div class="label">표준편차</div><div class="value">' + stddev.toFixed(1) + 's</div></div>',
    '    <div class="card"><div class="label">p25 / p75</div><div class="value">' + p25.toFixed(1) + ' / ' + p75.toFixed(1) + 's</div></div>',
    '    <div class="card"><div class="label">p90 / p95</div><div class="value">' + p90.toFixed(1) + ' / ' + p95.toFixed(1) + 's</div></div>',
    '    <div class="card"><div class="label">타임아웃</div><div class="value">' + (timeoutRate * 100).toFixed(0) + '%</div></div>',
    '  </div>',
    '',
    '  <h2>분포 히스토그램</h2>',
    histRows,
    '',
    '  <h2>점수</h2>',
    '  <p>평균 ' + Math.round(scoreMean) + ' · 최고 ' + scoreMax + '</p>',
    '',
    levelSection,
    suggestionsSection,
    scoreCurveSection,
    '  <blockquote>💡 ' + advice + '</blockquote>',
    '  <footer><small>Generated by <a href="https://github.com/on1659/radar_fun_meter">radar_fun_meter</a></small></footer>',
    '</body>',
    '</html>',
  ];

  return lines.join('\n');
}

module.exports = { toHTML };
