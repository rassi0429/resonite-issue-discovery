import { Octokit } from '@octokit/rest';
import { config } from '../config/config';
import { Issue, IIssue } from '../models/Issue';
import { OpenAI } from 'openai';

// Create Octokit instance with GitHub token
const octokit = new Octokit({
  auth: config.github.token
});

// Create OpenAI instance with API key
const openai = new OpenAI({ apiKey: config.openai.apiKey });

/**
 * Generate Japanese summaries for an issue using OpenAI API.
 * Returns { ja: { short, full, technical, general, generated_at } }
 */
export async function generateJapaneseSummary(issue: {
  title: string;
  body?: string;
  comments?: { body: string }[];
}): Promise<{
  ja: {
    short: string;
    full: string;
    technical: string;
    general: string;
    generated_at: Date;
  };
}> {
  const baseText = `タイトル: ${issue.title}\n本文: ${issue.body || ''}\nコメント: ${(issue.comments || []).map(c => c.body).join('\n')}`;

  // Prompts for each summary type
  const prompts = {
    short: `以下のGitHub Issue（英語）を日本語で10文字以内の短い見出しに要約してください。VR/AR専門用語は正確に訳し、一般ユーザーにも分かりやすく。:\n${baseText}`,
    full: `以下のGitHub Issue（英語）を日本語で200文字以内の詳細な要約にしてください。VR/AR専門用語は正確に訳し、一般ユーザーにも分かりやすく。:\n${baseText}`,
    technical: `以下のGitHub Issue（英語）を日本語で技術者向けに要点を簡潔にまとめてください。VR/AR専門用語は正確に訳し、技術的な詳細を重視してください。:\n${baseText}`,
    general: `以下のGitHub Issue（英語）を日本語で一般ユーザー向けに分かりやすく要約してください。VR/AR専門用語は簡単な説明を添えてください。:\n${baseText}`
  };

  // Helper to call OpenAI
  async function getSummary(prompt: string): Promise<string> {
    const res = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [{ role: "system", content: "あなたは優秀な日本語の要約AIです。" }, { role: "user", content: prompt }],
      max_tokens: 256,
      temperature: 0.3
    });
    return res.choices[0]?.message?.content?.trim() || "";
  }

  const [short, full, technical, general] = await Promise.all([
    getSummary(prompts.short),
    getSummary(prompts.full),
    getSummary(prompts.technical),
    getSummary(prompts.general)
  ]);

  return {
    ja: {
      short,
      full,
      technical,
      general,
      generated_at: new Date()
    }
  };
}

// Parse owner and repo from the target repo string
const [owner, repo] = config.github.targetRepo.split('/');

// Interface for GitHub issue data
interface GitHubIssue {
  id: number;
  node_id: string;
  number: number;
  title: string;
  user: {
    login: string;
  };
  state: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  body: string;
  comments: number;
  reactions: {
    total_count: number;
    '+1': number;
    '-1': number;
    laugh: number;
    hooray: number;
    confused: number;
    heart: number;
    rocket: number;
    eyes: number;
  };
  labels: {
    name: string;
  }[];
}

interface GitHubComment {
  id: number;
  node_id: string;
  user: {
    login: string;
  };
  created_at: string;
  updated_at: string;
  body: string;
  reactions: {
    total_count: number;
    '+1': number;
    '-1': number;
    laugh: number;
    hooray: number;
    confused: number;
    heart: number;
    rocket: number;
    eyes: number;
  };
}

// Check and handle GitHub API rate limits
async function checkRateLimit(response: any): Promise<void> {
  const rateLimit = response.headers['x-ratelimit-remaining'];
  const rateLimitReset = response.headers['x-ratelimit-reset'];
  
  if (rateLimit && parseInt(rateLimit) < 10) {
    console.log(`GitHub API rate limit is getting low: ${rateLimit} requests remaining`);
    
    if (parseInt(rateLimit) < 3) {
      const resetTime = new Date(parseInt(rateLimitReset) * 1000);
      const waitTime = Math.max(0, resetTime.getTime() - Date.now()) + 1000; // Add 1 second buffer
      
      if (waitTime > 0) {
        console.log(`Rate limit almost reached. Waiting until reset at ${resetTime.toLocaleString()} (${Math.ceil(waitTime / 1000)} seconds)`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        console.log('Continuing after rate limit reset');
      }
    }
  }
}

// Fetch issues from GitHub API
export async function fetchIssues(page = 1, perPage = 100): Promise<GitHubIssue[]> {
  try {
    const response = await octokit.issues.listForRepo({
      owner,
      repo,
      state: 'all',
      per_page: perPage,
      page,
      sort: 'updated',
      direction: 'desc'
    });
    
    // Check rate limits
    await checkRateLimit(response);

    return response.data as GitHubIssue[];
  } catch (error: any) {
    if (error.status === 403 && error.message && error.message.includes('API rate limit exceeded')) {
      console.log('Rate limit exceeded. Waiting for reset...');
      // Wait for 60 seconds and try again
      await new Promise(resolve => setTimeout(resolve, 60000));
      return fetchIssues(page, perPage);
    }
    
    console.error('Error fetching issues from GitHub:', error);
    throw error;
  }
}

// Fetch comments for a specific issue
export async function fetchComments(issueNumber: number): Promise<GitHubComment[]> {
  try {
    let allComments: GitHubComment[] = [];
    let page = 1;
    const perPage = 100;
    let hasMoreComments = true;
    
    while (hasMoreComments) {
      const response = await octokit.issues.listComments({
        owner,
        repo,
        issue_number: issueNumber,
        per_page: perPage,
        page: page
      });
      
      // Check rate limits
      await checkRateLimit(response);
      
      const comments = response.data as GitHubComment[];
      
      if (comments.length === 0) {
        hasMoreComments = false;
      } else {
        allComments = [...allComments, ...comments];
        page++;
        
        // Add a small delay to avoid hitting GitHub API rate limits
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    return allComments;
  } catch (error: any) {
    if (error.status === 403 && error.message && error.message.includes('API rate limit exceeded')) {
      console.log(`Rate limit exceeded while fetching comments for issue #${issueNumber}. Waiting for reset...`);
      // Wait for 60 seconds and try again
      await new Promise(resolve => setTimeout(resolve, 60000));
      return fetchComments(issueNumber);
    }
    
    console.error(`Error fetching comments for issue #${issueNumber}:`, error);
    throw error;
  }
}

// Transform GitHub issue data to our Issue model format
export function transformIssueData(
  githubIssue: GitHubIssue, 
  comments: GitHubComment[] = []
): Partial<IIssue> {
  // Extract label names
  const labels = githubIssue.labels.map(label => label.name);
  
  // Determine issue type based on labels
  const issueType = determineIssueType(labels, githubIssue.title, githubIssue.body || '');
  
  // Transform comments
  const commentsDetail = comments.map(comment => ({
    id: comment.node_id,
    author: comment.user.login,
    created_at: new Date(comment.created_at),
    updated_at: new Date(comment.updated_at),
    body: comment.body,
    reactions: {
      total: comment.reactions.total_count,
      '+1': comment.reactions['+1'],
      '-1': comment.reactions['-1'],
      laugh: comment.reactions.laugh,
      hooray: comment.reactions.hooray,
      confused: comment.reactions.confused,
      heart: comment.reactions.heart,
      rocket: comment.reactions.rocket,
      eyes: comment.reactions.eyes
    },
    replies: [],
    reply_count: 0
  }));
  
  // Get unique participants
  const participants = new Set<string>();
  participants.add(githubIssue.user.login);
  comments.forEach(comment => participants.add(comment.user.login));
  
  // Calculate total replies (仮: コメント数合計)
  const totalReplies = commentsDetail.reduce((sum, c) => sum + (c.reply_count || 0), 0);

  // 仮: reply_depth=1, reply_breadth=ユニーク返信者数, avg_reply_time=0
  const replyDepth = 1;
  const replyBreadth = 0;
  const avgReplyTime = 0;

  // 状態変更回数（open/closedの変化回数は現状0で仮実装）
  const stateChangeCount = 0;

  // engagement_metrics
  const engagementMetrics = {
    reply_depth: replyDepth,
    reply_breadth: replyBreadth,
    avg_reply_time: avgReplyTime
  };

  // Calculate activity score (spec 3.2対応)
  const activityScore = calculateActivityScore(githubIssue, comments, {
    totalReplies,
    replyDepth,
    stateChangeCount
  });

  return {
    id: githubIssue.node_id,
    repo: `${owner}/${repo}`,
    number: githubIssue.number,
    title: githubIssue.title,
    body: githubIssue.body || '',
    author: githubIssue.user.login,
    created_at: new Date(githubIssue.created_at),
    updated_at: new Date(githubIssue.updated_at),
    closed_at: githubIssue.closed_at ? new Date(githubIssue.closed_at) : undefined,
    state: githubIssue.state,
    comments: githubIssue.comments,
    comments_detail: commentsDetail,
    total_replies: totalReplies,
    reactions: {
      total: githubIssue.reactions.total_count,
      '+1': githubIssue.reactions['+1'],
      '-1': githubIssue.reactions['-1'],
      laugh: githubIssue.reactions.laugh,
      hooray: githubIssue.reactions.hooray,
      confused: githubIssue.reactions.confused,
      heart: githubIssue.reactions.heart,
      rocket: githubIssue.reactions.rocket,
      eyes: githubIssue.reactions.eyes
    },
    participants: Array.from(participants),
    labels,
    issue_type: issueType,
    activity_score: activityScore,
    engagement_metrics: engagementMetrics,
    history: [{
      date: new Date(),
      comments: githubIssue.comments,
      replies: totalReplies,
      reactions: {
        total: githubIssue.reactions.total_count,
        '+1': githubIssue.reactions['+1'],
        '-1': githubIssue.reactions['-1'],
        laugh: githubIssue.reactions.laugh,
        hooray: githubIssue.reactions.hooray,
        confused: githubIssue.reactions.confused,
        heart: githubIssue.reactions.heart,
        rocket: githubIssue.reactions.rocket,
        eyes: githubIssue.reactions.eyes
      },
      activity_score: activityScore
    }]
  };
}

// Determine issue type based on labels and content
function determineIssueType(labels: string[], title: string, body: string): string {
  // Convert to lowercase for case-insensitive matching
  const lowerLabels = labels.map(l => l.toLowerCase());
  const lowerTitle = title.toLowerCase();
  const lowerBody = body.toLowerCase();
  
  // Check for bug-related labels
  if (lowerLabels.some(l => ['bug', 'defect', 'error', 'crash'].includes(l))) {
    return 'bug';
  }
  
  // Check for feature-related labels
  if (lowerLabels.some(l => ['feature', 'enhancement', 'request', 'new feature'].includes(l))) {
    return 'feature';
  }
  
  // Check for content-related labels
  if (lowerLabels.some(l => ['content', 'asset', 'avatar', 'world', 'model'].includes(l))) {
    return 'content';
  }
  
  // Fallback to content analysis
  const text = `${lowerTitle} ${lowerBody}`;
  
  if (text.match(/bug|crash|error|broken|doesn't work|issue|problem|fail/)) {
    return 'bug';
  }
  
  if (text.match(/feature|add|enhance|improve|request|would be nice|suggestion/)) {
    return 'feature';
  }
  
  if (text.match(/content|asset|avatar|world|model|texture|material/)) {
    return 'content';
  }
  
  return 'other';
}

/**
 * Calculate activity score based on issue data and engagement metrics.
 * - comments, replies, reactions, participants, state changes, reply depth, etc.
 */
function calculateActivityScore(
  issue: GitHubIssue,
  comments: GitHubComment[],
  options?: {
    totalReplies?: number;
    replyDepth?: number;
    stateChangeCount?: number;
  }
): number {
  // Base score from issue age (newer issues get higher score)
  const ageInDays = (Date.now() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60 * 24);
  const ageScore = Math.max(0, 100 - ageInDays);

  // Comment score
  const commentScore = issue.comments * 5;

  // Reaction score
  const reactionScore = issue.reactions.total_count * 3;

  // Participant score
  const participants = new Set<string>();
  participants.add(issue.user.login);
  comments.forEach(comment => participants.add(comment.user.login));
  const participantScore = participants.size * 10;

  // Recent activity bonus
  const lastUpdateDays = (Date.now() - new Date(issue.updated_at).getTime()) / (1000 * 60 * 60 * 24);
  const recentActivityBonus = lastUpdateDays < 7 ? 50 : (lastUpdateDays < 30 ? 25 : 0);

  // Replies score
  const totalReplies = options?.totalReplies ?? 0;
  const replyScore = totalReplies * 3;

  // Reply depth score (会話の深さ)
  const replyDepth = options?.replyDepth ?? 1;
  const replyDepthScore = replyDepth * 10;

  // State change score
  const stateChangeCount = options?.stateChangeCount ?? 0;
  const stateChangeScore = stateChangeCount * 10;

  // Calculate total score
  const totalScore =
    ageScore +
    commentScore +
    reactionScore +
    participantScore +
    recentActivityBonus +
    replyScore +
    replyDepthScore +
    stateChangeScore;

  return Math.round(totalScore);
}

/**
 * Detect if a string is mostly English (simple heuristic).
 */
function isEnglish(text: string): boolean {
  if (!text) return false;
  // Count English letters vs. non-ASCII
  const en = (text.match(/[A-Za-z]/g) || []).length;
  const non = (text.match(/[^\x00-\x7F]/g) || []).length;
  return en > non;
}

// Save or update issue in the database
export async function saveIssue(issueData: Partial<IIssue>): Promise<void> {
  try {
    // Check if issue already exists
    const existingIssue = await Issue.findOne({ id: issueData.id });

    // If the issue is English, generate Japanese summary only if content changed
    let shouldCallOpenAI = false;
    if (
      issueData.title &&
      isEnglish(issueData.title + " " + (issueData.body || ""))
    ) {
      if (existingIssue) {
        // Compare title, body, and comments_detail
        const isTitleSame = existingIssue.title === issueData.title;
        const isBodySame = (existingIssue.body || "") === (issueData.body || "");
        // Compare comments_detail (array of {body: string})
        const oldComments = (existingIssue.comments_detail || []).map((c: any) => c.body).join("\n");
        const newComments = (issueData.comments_detail || []).map((c: any) => c.body).join("\n");
        const isCommentsSame = oldComments === newComments;

        if (!(isTitleSame && isBodySame && isCommentsSame)) {
          shouldCallOpenAI = true;
        }
      } else {
        shouldCallOpenAI = true;
      }

      if (shouldCallOpenAI) {
        const summary = await generateJapaneseSummary({
          title: issueData.title,
          body: issueData.body,
          comments: (issueData.comments_detail || []).map((c: any) => ({
            body: c.body,
          })),
        });
        issueData.summary = summary;
      }
    }

    if (existingIssue) {
      // Update existing issue
      await Issue.updateOne({ id: issueData.id }, { $set: issueData });
      console.log(`Updated issue #${issueData.number}`);
    } else {
      // Create new issue
      await Issue.create(issueData);
      console.log(`Created issue #${issueData.number}`);
    }
  } catch (error: any) {
    console.error(`Error saving issue #${issueData.number}:`, error);

    // If it's a MongoDB connection error, wait and retry
    if (error.name === "MongoNetworkError" || error.message?.includes("connection")) {
      console.log(`Database connection issue. Waiting 5 seconds before retrying...`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return saveIssue(issueData);
    }

    throw error;
  }
}
