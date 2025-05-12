let issues = [];

document.getElementById('jsonFileInput').addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (event) {
    try {
      issues = JSON.parse(event.target.result);
      showSummary();
      renderResults(issues);
    } catch (err) {
      alert('JSONの読み込みに失敗しました');
    }
  };
  reader.readAsText(file, 'utf-8');
});

function updateView() {
  if (!issues.length) return;
  const filtered = filterIssues();
  const sorted = sortIssues(filtered);
  renderResults(sorted);
}

document.getElementById('searchBtn').addEventListener('click', updateView);

document.getElementById('sortSelect').addEventListener('change', updateView);

// ソート関数
function sortIssues(list) {
  const sort = document.getElementById('sortSelect').value;
  if (sort === 'recent') {
    return [...list].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }
  if (sort === 'newest') {
    return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  if (sort === 'comments') {
    return [...list].sort((a, b) => (b.comments || 0) - (a.comments || 0));
  }
  if (sort === 'open') {
    // open優先、同じならupdated_at降順
    return [...list].sort((a, b) => {
      if (a.state === b.state) {
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
      return a.state === 'open' ? -1 : 1;
    });
  }
  return list;
}

function filterIssues() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const state = document.getElementById('stateFilter').value;

  return issues.filter(issue => {
    // 検索キーワード
    if (q) {
      const hit =
        (issue.title && issue.title.toLowerCase().includes(q)) ||
        (issue.body && issue.body.toLowerCase().includes(q)) ||
        (issue.author && issue.author.toLowerCase().includes(q)) ||
        (issue.repo && issue.repo.toLowerCase().includes(q));
      if (!hit) return false;
    }
    // 状態
    if (state && issue.state !== state) return false;
    return true;
  });
}

function renderResults(list) {
  const el = document.getElementById('results');
  if (!list.length) {
    el.innerHTML = '<p>該当するIssueがありません</p>';
    return;
  }
  el.innerHTML = list.map(issue => {
    // summary.ja の各フィールドを優先的に表示
    let summaryBlock = '';
    if (issue.summary && issue.summary.ja) {
      const s = issue.summary.ja;
      if (s.short) summaryBlock += `<div class="summary"><b>要約:</b> ${escapeHTML(s.short)}</div>`;
      if (s.full) summaryBlock += `<div class="summary"><b>詳細:</b> ${escapeHTML(s.full)}</div>`;
      if (s.technical) summaryBlock += `<div class="summary"><b>技術的:</b> ${escapeHTML(s.technical)}</div>`;
      if (s.general) summaryBlock += `<div class="summary"><b>一般向け:</b> ${escapeHTML(s.general)}</div>`;
    }
    return `
    <div class="issue">
      <div>
        <span class="number">#${issue.number}</span>
        <span class="title">${escapeHTML(issue.title)}</span>
      </div>
      ${summaryBlock}
      <div class="meta">
        <span>状態: ${issue.state}</span>
        <span>タイプ: ${escapeHTML(issue.issue_type)}</span>
        <span>優先度: ${typeof issue.priority_score === "number" ? issue.priority_score : ""}</span>
        <span>スコア: ${typeof issue.activity_score === "number" ? issue.activity_score : ""}</span>
        <span>作成者: ${escapeHTML(issue.author)}</span>
        <span>参加者: ${Array.isArray(issue.participants) ? issue.participants.length : 0}</span>
        <span>ラベル: ${(issue.labels || []).map(l => `<span class="label">${escapeHTML(l)}</span>`).join(' ')}</span>
        <span>実装状況: ${escapeHTML(issue.implementation_status || "")}</span>
        <span>作成日: ${escapeHTML(issue.created_at)}</span>
        <span>更新日: ${escapeHTML(issue.updated_at)}</span>
        <span>コメント: ${issue.comments}</span>
        <span>リアクション: 👍${issue.reactions?.["+1"] || 0} 👎${issue.reactions?.["-1"] || 0} 😄${issue.reactions?.laugh || 0}</span>
      </div>
      <div class="body">${escapeHTML(issue.body || '').slice(0, 200)}${issue.body && issue.body.length > 200 ? '…' : ''}</div>
    </div>
    `;
  }).join('');
}

function showSummary() {
  const el = document.getElementById('summary');
  el.innerHTML = `<p>読み込んだIssue数: ${issues.length}</p>`;
}

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;'
  }[s]));
}
