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
  if (sort === 'score') {
    return [...list].sort((a, b) => (b.activity_score || 0) - (a.activity_score || 0));
  }
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
  if (sort === 'priority') {
    // priority_score降順、なければactivity_score
    return [...list].sort((a, b) => {
      const pa = typeof a.priority_score === 'number' ? a.priority_score : (a.activity_score || 0);
      const pb = typeof b.priority_score === 'number' ? b.priority_score : (b.activity_score || 0);
      return pb - pa;
    });
  }
  if (sort === 'participants') {
    return [...list].sort((a, b) => ((b.participants?.length || 0) - (a.participants?.length || 0)));
  }
  return list;
}

function filterIssues() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const state = document.getElementById('stateFilter').value;
  const type = document.getElementById('typeFilter').value;
  const scoreMin = parseInt(document.getElementById('scoreMin').value, 10);
  const scoreMax = parseInt(document.getElementById('scoreMax').value, 10);
  const labelStr = document.getElementById('labelFilter').value.trim().toLowerCase();
  const labelArr = labelStr ? labelStr.split(',').map(s => s.trim()).filter(Boolean) : [];

  return issues.filter(issue => {
    // 検索キーワード
    if (q) {
      const hit =
        (issue.title && issue.title.toLowerCase().includes(q)) ||
        (issue.body && issue.body.toLowerCase().includes(q)) ||
        (issue.labels && issue.labels.some(l => l.toLowerCase().includes(q))) ||
        (issue.issue_type && issue.issue_type.toLowerCase().includes(q));
      if (!hit) return false;
    }
    // 状態
    if (state && issue.state !== state) return false;
    // タイプ
    if (type && issue.issue_type !== type) return false;
    // スコア範囲
    if (!isNaN(scoreMin) && (issue.activity_score ?? -Infinity) < scoreMin) return false;
    if (!isNaN(scoreMax) && (issue.activity_score ?? Infinity) > scoreMax) return false;
    // ラベル
    if (labelArr.length > 0) {
      const labels = (issue.labels || []).map(l => l.toLowerCase());
      if (!labelArr.every(lab => labels.includes(lab))) return false;
    }
    return true;
  });
}

function renderResults(list) {
  const el = document.getElementById('results');
  if (!list.length) {
    el.innerHTML = '<p>該当するIssueがありません</p>';
    return;
  }
  el.innerHTML = list.map(issue => `
    <div class="issue">
      <div>
        <span class="number">#${issue.number}</span>
        <span class="title">${escapeHTML(issue.title)}</span>
        <span class="labels">${(issue.labels || []).map(l => `<span class="label">${escapeHTML(l)}</span>`).join(' ')}</span>
      </div>
      <div class="meta">
        <span>状態: ${issue.state}</span>
        <span>タイプ: ${issue.issue_type}</span>
        <span>スコア: ${issue.activity_score}</span>
        <span>作成者: ${escapeHTML(issue.author)}</span>
        <span>コメント: ${issue.comments}</span>
      </div>
      <div class="body">${escapeHTML(issue.body || '').slice(0, 200)}${issue.body && issue.body.length > 200 ? '…' : ''}</div>
    </div>
  `).join('');
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
