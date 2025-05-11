import mongoose, { Document, Schema } from 'mongoose';

// Define interfaces for nested objects
interface Reaction {
  total: number;
  '+1': number;
  '-1': number;
  laugh: number;
  hooray: number;
  confused: number;
  heart: number;
  rocket: number;
  eyes: number;
}

interface Reply {
  id: string;
  author: string;
  created_at: Date;
}

interface Comment {
  id: string;
  author: string;
  created_at: Date;
  updated_at: Date;
  body: string;
  reactions: Reaction;
  replies: Reply[];
  reply_count: number;
}

interface Summary {
  ja: {
    short: string;
    full: string;
    technical: string;
    general: string;
    generated_at: Date;
  };
}

interface HistoryEntry {
  date: Date;
  comments: number;
  replies: number;
  reactions: Reaction;
  activity_score: number;
}

interface EngagementMetrics {
  reply_depth: number;
  reply_breadth: number;
  avg_reply_time: number;
}

interface RelatedIssue {
  number: number;
  similarity: number;
  relation_type: string;
}

// Define the main Issue interface
export interface IIssue extends Document {
  id: string;
  repo: string;
  number: number;
  title: string;
  body?: string;
  author: string;
  created_at: Date;
  updated_at: Date;
  closed_at?: Date;
  state: string;
  comments: number;
  comments_detail: Comment[];
  total_replies: number;
  reactions: Reaction;
  participants: string[];
  labels: string[];
  issue_type: string;
  activity_score: number;
  embedding?: any; // Vector type
  summary?: Summary;
  history: HistoryEntry[];
  engagement_metrics?: EngagementMetrics;
  related_issues?: RelatedIssue[];
  priority_score?: number;
  implementation_status?: string;
}

// Define the schema
const ReactionSchema = new Schema<Reaction>({
  total: { type: Number, default: 0 },
  '+1': { type: Number, default: 0 },
  '-1': { type: Number, default: 0 },
  laugh: { type: Number, default: 0 },
  hooray: { type: Number, default: 0 },
  confused: { type: Number, default: 0 },
  heart: { type: Number, default: 0 },
  rocket: { type: Number, default: 0 },
  eyes: { type: Number, default: 0 }
}, { _id: false });

const ReplySchema = new Schema<Reply>({
  id: { type: String, required: true },
  author: { type: String, required: true },
  created_at: { type: Date, required: true }
}, { _id: false });

const CommentSchema = new Schema<Comment>({
  id: { type: String, required: true },
  author: { type: String, required: true },
  created_at: { type: Date, required: true },
  updated_at: { type: Date, required: true },
  body: { type: String, default: '' },
  reactions: { type: ReactionSchema, default: {} },
  replies: { type: [ReplySchema], default: [] },
  reply_count: { type: Number, default: 0 }
}, { _id: false });

const SummarySchema = new Schema<Summary>({
  ja: {
    short: String,
    full: String,
    technical: String,
    general: String,
    generated_at: Date
  }
}, { _id: false });

const HistoryEntrySchema = new Schema<HistoryEntry>({
  date: { type: Date, required: true },
  comments: { type: Number, required: true },
  replies: { type: Number, required: true },
  reactions: { type: ReactionSchema, required: true },
  activity_score: { type: Number, required: true }
}, { _id: false });

const EngagementMetricsSchema = new Schema<EngagementMetrics>({
  reply_depth: Number,
  reply_breadth: Number,
  avg_reply_time: Number
}, { _id: false });

const RelatedIssueSchema = new Schema<RelatedIssue>({
  number: { type: Number, required: true },
  similarity: { type: Number, required: true },
  relation_type: { type: String, required: true }
}, { _id: false });

const IssueSchema = new Schema<IIssue>({
  id: { type: String, required: true, unique: true },
  repo: { type: String, required: true },
  number: { type: Number, required: true },
  title: { type: String, required: true },
  body: { type: String, default: '' },
  author: { type: String, required: true },
  created_at: { type: Date, required: true },
  updated_at: { type: Date, required: true },
  closed_at: { type: Date },
  state: { type: String, required: true, enum: ['open', 'closed'] },
  comments: { type: Number, default: 0 },
  comments_detail: { type: [CommentSchema], default: [] },
  total_replies: { type: Number, default: 0 },
  reactions: { type: ReactionSchema, default: {} },
  participants: { type: [String], default: [] },
  labels: { type: [String], default: [] },
  issue_type: { 
    type: String, 
    required: true, 
    enum: ['bug', 'feature', 'content', 'other'],
    default: 'other'
  },
  activity_score: { type: Number, default: 0 },
  embedding: Schema.Types.Mixed,
  summary: SummarySchema,
  history: { type: [HistoryEntrySchema], default: [] },
  engagement_metrics: EngagementMetricsSchema,
  related_issues: { type: [RelatedIssueSchema], default: [] },
  priority_score: Number,
  implementation_status: { 
    type: String, 
    enum: ['未対応', '検討中', '実装中', '実装済み'] 
  }
}, {
  timestamps: true,
  collection: 'issues'
});

// Create indexes
IssueSchema.index({ repo: 1, number: 1 }, { unique: true });
IssueSchema.index({ issue_type: 1 });
IssueSchema.index({ activity_score: -1 });
IssueSchema.index({ created_at: -1 });
IssueSchema.index({ updated_at: -1 });

// Create and export the model
export const Issue = mongoose.model<IIssue>('Issue', IssueSchema);
