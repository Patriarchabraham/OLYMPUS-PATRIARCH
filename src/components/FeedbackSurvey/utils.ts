export type FeedbackSurveyType = 'session' | 'turn' | 'transcript'

export type FeedbackSurveyResponse = 1 | 2 | 3 | 4 | 5 | 'skip' | 'good' | 'bad' | 'dismissed' | 'fine'

export function isFeedbackResponse(value: unknown): value is FeedbackSurveyResponse {
  return (
    typeof value === 'number' ||
    value === 'skip'
  )
}
