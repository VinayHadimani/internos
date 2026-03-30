-- Run this in Supabase SQL Editor to create the feedback table

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own feedback
CREATE POLICY "Users can submit feedback"
  ON feedback FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow anon users to submit feedback (no login required)
CREATE POLICY "Anyone can submit feedback"
  ON feedback FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow service role to read all feedback (for admin)
CREATE POLICY "Service role can read feedback"
  ON feedback FOR SELECT
  TO service_role
  USING (true);

-- Index for querying
CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX idx_feedback_rating ON feedback(rating);
