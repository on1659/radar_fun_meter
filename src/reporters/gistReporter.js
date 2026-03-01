'use strict';

const https = require('https');
const { toMarkdown } = require('./mdReporter');

class GistAuthError extends Error {}
class GistUploadError extends Error {}
class GistNotFoundError extends Error {}
class GistFormatError extends Error {}

function maskToken(token, str) {
  if (!token || !str) return str;
  return str.split(token).join('***');
}

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function uploadGist(result, { token, description } = {}) {
  if (!token) throw new GistAuthError(
    'FUNMETER_GITHUB_TOKEN이 설정되지 않았습니다.\n' +
    '  export FUNMETER_GITHUB_TOKEN=<토큰>\n' +
    '  토큰 발급: https://github.com/settings/tokens/new (gist 권한 필요)'
  );

  const pkg = require('../../package.json');
  const files = {
    'funmeter-result.json': {
      content: JSON.stringify({ ...result, generatedAt: new Date().toISOString() }, null, 2)
    },
    'funmeter-report.md': {
      content: toMarkdown(result)
    },
  };

  const payload = JSON.stringify({
    description: description || `Fun Meter: ${result.name} (${result.zone})`,
    public: true,
    files,
  });

  const { status, body } = await httpsRequest({
    hostname: 'api.github.com',
    path: '/gists',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': `radar_fun_meter/${pkg.version}`,
      'Content-Length': Buffer.byteLength(payload),
    },
  }, payload);

  if (status !== 201) {
    const safeBody = maskToken(token, body);
    throw new GistUploadError(`Gist 업로드 실패 (HTTP ${status}): ${safeBody}`);
  }

  const data = JSON.parse(body);
  return { id: data.id, url: data.html_url };
}

async function viewGist(gistId, { token } = {}) {
  const pkg = require('../../package.json');
  const headers = { 'User-Agent': `radar_fun_meter/${pkg.version}` };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const { status, body } = await httpsRequest({
    hostname: 'api.github.com',
    path: `/gists/${gistId}`,
    method: 'GET',
    headers,
  });

  if (status === 404) throw new GistNotFoundError(`Gist ${gistId} 를 찾을 수 없습니다.`);
  if (status !== 200) throw new GistUploadError(`Gist 조회 실패 (HTTP ${status})`);

  const data = JSON.parse(body);
  const resultFile = data.files['funmeter-result.json'];
  if (!resultFile) throw new GistFormatError('funmeter-result.json 파일이 없는 Gist입니다.');

  const content = resultFile.content
    ? resultFile.content
    : await (async () => {
        // GitHub API는 대용량 파일을 truncate하고 raw_url 제공 → fallback fetch
        const { body: raw } = await httpsRequest({
          hostname: new URL(resultFile.raw_url).hostname,
          path: new URL(resultFile.raw_url).pathname,
        });
        return raw;
      })();

  return JSON.parse(content);
}

module.exports = {
  uploadGist, viewGist,
  GistAuthError, GistUploadError, GistNotFoundError, GistFormatError,
};
