/**
 * OAuth type definitions used across the OAuth service layer.
 * Extracted from the original client module for shared access.
 */

export type SubscriptionType = 'pro' | 'max' | 'enterprise' | 'team'

export type RateLimitTier = string

export type BillingType = string

export interface OAuthTokenAccount {
  uuid: string
  emailAddress: string
  organizationUuid?: string
}

export interface OAuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
  scopes: string[]
  subscriptionType: SubscriptionType | null
  rateLimitTier: RateLimitTier | null
  profile?: OAuthProfileResponse
  tokenAccount?: OAuthTokenAccount
}

export interface OAuthTokenExchangeResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  scope: string
  account?: {
    uuid: string
    email_address: string
  }
  organization?: {
    uuid: string
  }
}

export interface OAuthProfileResponse {
  account: {
    uuid: string
    email: string
    display_name?: string
    created_at?: string
    has_claude_max?: boolean
    has_claude_pro?: boolean
  }
  organization: {
    uuid: string
    organization_type?: string
    rate_limit_tier?: string
    has_extra_usage_enabled?: boolean
    billing_type?: string
    subscription_created_at?: string
    organization_name?: string
  }
}

export interface UserRolesResponse {
  organization_role: string
  workspace_role?: string
  organization_name?: string
}

export type ReferralCampaign = string

export interface ReferralEligibilityResponse {
  eligible: boolean
  reason?: string
  campaignId?: string
  referral_code_details?: {
    referral_link?: string
    campaign?: string
  }
  referrer_reward?: ReferrerRewardInfo
  remaining_passes?: number
}

export interface ReferrerRewardInfo {
  type: string
  amount?: number
  description?: string
  claimedAt?: string
  currency?: string
  amount_minor_units?: number
}

export interface ReferralRedemptionsResponse {
  redemptions: Array<{
    referralCode: string
    redeemedAt: string
    campaignId?: string
  }>
  totalCount: number
  limit?: number
}
