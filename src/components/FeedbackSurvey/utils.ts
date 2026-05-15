export type FeedbackSurveyResponse = 1 | 2 | 3 | 4 | 5 | 'skip'

export function isFeedbackResponse(value: unknown): value is FeedbackSurveyResponse {
  return (
    typeof value === 'number' ||
    value === 'skip'
  )
}
