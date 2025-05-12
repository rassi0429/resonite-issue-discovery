import express from 'express';
import { connectToDatabase } from './utils/database';
import { Issue } from './models/Issue';
import type { Request, Response } from 'express';
import { startLocalMongoDBServer, importMongoDBData } from './utils/setupLocalMongoDB';
import { distance as levenshteinDistance } from 'fastest-levenshtein';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// 検索API（全文検索＋曖昧検索の土台）
app.get('/api/search', (req: Request, res: Response) => {
  void (async () => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        res.status(400).json({ error: 'Missing query parameter: q' });
        return;
      }

      // MongoDB text indexによる全文検索
      // $text検索＋スコア順
      let results = await Issue.find(
        { $text: { $search: q } },
        { score: { $meta: 'textScore' } }
      )
        .sort({ score: { $meta: 'textScore' } })
        .limit(50)
        .lean();

      // 十分なヒットがなければLevenshtein距離で曖昧検索
      if (results.length < 10) {
        // 全件取得は重いので最大1000件まで
        const allIssues = await Issue.find({}, { title: 1, body: 1, comments_detail: 1 }).limit(1000).lean();
        // qとtitle/body/comments_detail.bodyのいずれかが近いものを抽出
        const fuzzyCandidates = allIssues
          .map(issue => {
            // comments_detail.bodyを連結
            const commentsText = (issue.comments_detail || [])
              .map((c: any) => c.body)
              .join(' ');
            // 最小距離
            const minDist = Math.min(
              levenshteinDistance(q, issue.title || ''),
              levenshteinDistance(q, issue.body || ''),
              levenshteinDistance(q, commentsText)
            );
            return { ...issue, fuzzyDistance: minDist };
          })
          .filter(issue => issue.fuzzyDistance <= 3) // 距離3以内を曖昧一致とみなす
          .sort((a, b) => a.fuzzyDistance - b.fuzzyDistance)
          .slice(0, 10);

        // 既存resultsに含まれていないものだけ追加
        const existingIds = new Set(results.map(r => r._id.toString()));
        const fuzzyResults = fuzzyCandidates.filter(f => !existingIds.has(f._id.toString()));
        results = results.concat(fuzzyResults);
      }

      res.json({ results });
    } catch (err) {
      res.status(500).json({ error: 'Search failed', details: err });
    }
  })();
});

// サーバー起動
async function start() {
  // MONGODB_URIがなければローカルMongoDBを起動
  const useLocalMongoDB = !process.env.MONGODB_URI || process.env.USE_LOCAL_MONGODB === 'true';
  if (useLocalMongoDB) {
    const mongoUri = await startLocalMongoDBServer();
    process.env.MONGODB_URI = mongoUri;
    await connectToDatabase();
    await importMongoDBData();
  } else {
    await connectToDatabase();
  }

  // text indexがなければ作成
  await Issue.collection.createIndex(
    { title: 'text', body: 'text', 'comments_detail.body': 'text' },
    { name: 'TextIndex', default_language: 'none' }
  );

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();
