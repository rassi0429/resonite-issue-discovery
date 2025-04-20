import { Octokit } from '@octokit/rest';
import { config } from '../config/config';
import { Issue, IIssue } from '../models/Issue';

// Create Octokit instance with GitHub token
const octokit = new Octokit({
  auth: config.github.token
});

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

    return response.data as GitHubIssue[];
  } catch (error) {
    console.error('Error fetching issues from GitHub:', error);
    throw error;
  }
}

// Fetch comments for a specific issue
export async function fetchComments(issueNumber: number): Promise<GitHubComment[]> {
  try {
    const response = await octokit.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100
    });

    return response.data as GitHubComment[];
  } catch (error) {
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
  
  // Calculate activity score
  const activityScore = calculateActivityScore(githubIssue, comments);
  
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
    total_replies: 0, // We don't have reply data yet
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
    history: [{
      date: new Date(),
      comments: githubIssue.comments,
      replies: 0,
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

// Calculate activity score based on issue data
function calculateActivityScore(issue: GitHubIssue, comments: GitHubComment[]): number {
  // Base score from issue age (newer issues get higher score)
  const ageInDays = (Date.now() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60 * 24);
  const ageScore = Math.max(0, 100 - ageInDays); // Newer issues get higher score
  
  // Comment score (more comments = higher score)
  const commentScore = issue.comments * 5;
  
  // Reaction score (more reactions = higher score)
  const reactionScore = issue.reactions.total_count * 3;
  
  // Participant score (more unique participants = higher score)
  const participants = new Set<string>();
  participants.add(issue.user.login);
  comments.forEach(comment => participants.add(comment.user.login));
  const participantScore = participants.size * 10;
  
  // Recent activity bonus
  const lastUpdateDays = (Date.now() - new Date(issue.updated_at).getTime()) / (1000 * 60 * 60 * 24);
  const recentActivityBonus = lastUpdateDays < 7 ? 50 : (lastUpdateDays < 30 ? 25 : 0);
  
  // Calculate total score
  const totalScore = ageScore + commentScore + reactionScore + participantScore + recentActivityBonus;
  
  return Math.round(totalScore);
}

// Save or update issue in the database
export async function saveIssue(issueData: Partial<IIssue>): Promise<void> {
  try {
    // Check if issue already exists
    const existingIssue = await Issue.findOne({ id: issueData.id });
    
    if (existingIssue) {
      // Update existing issue
      await Issue.updateOne({ id: issueData.id }, { $set: issueData });
      console.log(`Updated issue #${issueData.number}`);
    } else {
      // Create new issue
      await Issue.create(issueData);
      console.log(`Created issue #${issueData.number}`);
    }
  } catch (error) {
    console.error(`Error saving issue #${issueData.number}:`, error);
    throw error;
  }
}
