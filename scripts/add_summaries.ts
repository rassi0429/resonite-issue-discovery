import fs from "fs";
import path from "path";
import { generateJapaneseSummary } from "../src/services/githubService";
import { IIssue } from "../src/models/Issue";

// 簡易英語判定
function isEnglish(text: string): boolean {
  if (!text) return false;
  const en = (text.match(/[A-Za-z]/g) || []).length;
  const non = (text.match(/[^\x00-\x7F]/g) || []).length;
  return en > non;
}

async function main() {
  const inputPath = path.resolve(__dirname, "../data/exports/issues.json");
  const outputPath = path.resolve(__dirname, "../data/exports/issues_with_summaries.json");

  // ファイル読み込み
  const raw = fs.readFileSync(inputPath, "utf-8");
  const issues: any[] = JSON.parse(raw);

  // 既存のsummary付きファイルが存在する場合は比較
  let skip = false;
  if (fs.existsSync(outputPath)) {
    try {
      const prevRaw = fs.readFileSync(outputPath, "utf-8");
      const prevIssues: any[] = JSON.parse(prevRaw);

      // 比較用: title/body/commentsだけ抽出
      const extractCore = (arr: any[]) =>
        arr.map((issue) => ({
          number: issue.number,
          title: issue.title,
          body: issue.body,
          comments: (issue.comments_detail || []).map((c: any) => ({ body: c.body })),
        }));

      const currCore = JSON.stringify(extractCore(issues));
      const prevCore = JSON.stringify(extractCore(prevIssues));

      if (currCore === prevCore) {
        // 内容が同じならスキップ
        fs.writeFileSync(outputPath, prevRaw, "utf-8");
        console.log("No changes detected. Skipped summarization. Output:", outputPath);
        return;
      }
    } catch (e) {
      // 何かあれば通常処理
      console.error("Error comparing previous summaries:", e);
    }
  }

  // 前回の summary 付き issues を number でマッピング
  let prevSummaryMap: Record<number, any> = {};
  if (fs.existsSync(outputPath)) {
    try {
      const prevRaw = fs.readFileSync(outputPath, "utf-8");
      const prevIssues: any[] = JSON.parse(prevRaw);
      for (const prevIssue of prevIssues) {
        prevSummaryMap[prevIssue.number] = prevIssue;
      }
    } catch (e) {
      console.error("Error loading previous summaries for per-issue diff:", e);
    }
  }

  for (let i = 0; i < issues.length; i++) {
    const issue = issues[i];
    const prev = prevSummaryMap[issue.number];
    // 比較用: title/body/commentsだけ抽出
    const extractCore = (iss: any) => ({
      title: iss?.title,
      body: iss?.body,
      comments: (iss?.comments_detail || []).map((c: any) => ({ body: c.body })),
    });
    let needsSummarize = true;
    if (prev) {
      const currCore = JSON.stringify(extractCore(issue));
      const prevCore = JSON.stringify(extractCore(prev));
      if (currCore === prevCore && prev.summary && prev.summary.ja) {
        // 変更なければ summary を流用
        issue.summary = prev.summary;
        needsSummarize = false;
        console.log(`Skipped summarization for issue #${issue.number}`);
      }
    }
    if (
      needsSummarize &&
      isEnglish((issue.title || "") + " " + (issue.body || ""))
    ) {
      try {
        const summary = await generateJapaneseSummary({
          title: issue.title,
          body: issue.body,
          comments: (issue.comments_detail || []).map((c: any) => ({ body: c.body })),
        });
        issue.summary = summary;
        console.log(`Summarized issue #${issue.number}`);
      } catch (e) {
        console.error(`Error summarizing issue #${issue.number}:`, e);
      }
    }
  }

  // 保存
  fs.writeFileSync(outputPath, JSON.stringify(issues, null, 2), "utf-8");
  console.log("Done. Output:", outputPath);
}

main();
