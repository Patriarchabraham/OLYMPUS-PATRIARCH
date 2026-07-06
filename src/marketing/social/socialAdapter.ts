/**
 * Olympuz Marketing — Social adapter (multi-channel, no-op-when-unconfigured).
 *
 * Posts to / deletes from each configured social channel (X, Meta, LinkedIn,
 * TikTok, YouTube). Credentials are read per-channel from the environment.
 * When a channel's tokens are absent, operations against it return a clear
 * "not configured" result rather than throwing — so the Marketing department is
 * structurally complete and the deterministic core stays testable without tokens
 * or network. Mirrors the browserAdapter availability pattern.
 *
 * Permission + audit live at the TOOL layer: `post` / `uploadShort` are always
 * approval-gated and recorded to the published log; `deletePost` exists to honor
 * the user's "reverse what isn't right after seeing everything published."
 *
 * NOT executed in tests: the suite never sets channel tokens, so only the
 * no-op-when-unconfigured path is exercised. Live posting needs tokens + network.
 */

export type SocialChannel = 'x' | 'meta' | 'linkedin' | 'tiktok' | 'youtube'

export interface SocialPostInput {
	channel: SocialChannel
	text: string
	/** Optional media URL/path to attach (image or short video). */
	mediaUrl?: string
}

export interface SocialResult {
	ok: boolean
	/** The channel's post id on success (used by deletePost for reversal). */
	postId?: string
	output?: string
	error?: string
	channel?: SocialChannel
}

interface ChannelSpec {
	channel: SocialChannel
	tokens: string[] // env var names; channel is "configured" when ALL are set
	postUrlEnv: string
	label: string
}

const CHANNELS: ChannelSpec[] = [
	{
		channel: 'x',
		tokens: ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN'],
		postUrlEnv: 'X_API_URL',
		label: 'X',
	},
	{
		channel: 'meta',
		tokens: ['META_ACCESS_TOKEN', 'META_PAGE_ID'],
		postUrlEnv: 'META_API_URL',
		label: 'Meta',
	},
	{
		channel: 'linkedin',
		tokens: ['LINKEDIN_ACCESS_TOKEN', 'LINKEDIN_PERSON_URN'],
		postUrlEnv: 'LINKEDIN_API_URL',
		label: 'LinkedIn',
	},
	{
		channel: 'tiktok',
		tokens: ['TIKTOK_ACCESS_TOKEN'],
		postUrlEnv: 'TIKTOK_API_URL',
		label: 'TikTok',
	},
	{
		channel: 'youtube',
		tokens: ['YOUTUBE_ACCESS_TOKEN'],
		postUrlEnv: 'YOUTUBE_API_URL',
		label: 'YouTube',
	},
]

const SPEC_BY_CHANNEL: Record<SocialChannel, ChannelSpec> = Object.fromEntries(
	CHANNELS.map((c) => [c.channel, c]),
) as Record<SocialChannel, ChannelSpec>

/** True when the channel has ALL its required tokens configured. */
export function isChannelAvailable(channel: SocialChannel): boolean {
	const spec = SPEC_BY_CHANNEL[channel]
	return spec.tokens.every((t) => process.env[t])
}

/** All channels that are currently configured (for `/marketing status`). */
export function configuredChannels(): SocialChannel[] {
	return CHANNELS.filter((c) => c.tokens.every((t) => process.env[t])).map((c) => c.channel)
}

function notConfigured(channel: SocialChannel): SocialResult {
	const spec = SPEC_BY_CHANNEL[channel]
	return {
		ok: false,
		channel,
		error: `${spec.label} is not configured. Set ${spec.tokens.join(', ')}${spec.postUrlEnv ? ` (and ${spec.postUrlEnv})` : ''} to enable.`,
	}
}

/** Publish a text (+optional media) post. Real API call when configured; never throws. */
export async function post(input: SocialPostInput): Promise<SocialResult> {
	const spec = SPEC_BY_CHANNEL[input.channel]
	if (!isChannelAvailable(input.channel)) return notConfigured(input.channel)
	const endpoint = process.env[spec.postUrlEnv]
	if (!endpoint) {
		return {
			ok: false,
			channel: input.channel,
			error: `${spec.label}: set ${spec.postUrlEnv} to the publish endpoint to enable posting.`,
		}
	}
	const token = process.env[spec.tokens[0]]!
	try {
		const res = await fetch(endpoint, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({ text: input.text, mediaUrl: input.mediaUrl }),
		})
		const text = await res.text()
		if (!res.ok) {
			return {
				ok: false,
				channel: input.channel,
				error: `${spec.label} HTTP ${res.status}: ${text.slice(0, 200)}`,
			}
		}
		let postId: string | undefined
		try {
			postId = (JSON.parse(text) as { id?: string }).id ?? undefined
		} catch {
			/* some channels return non-JSON; postId stays undefined */
		}
		return { ok: true, channel: input.channel, postId, output: text.slice(0, 200) }
	} catch (e) {
		return {
			ok: false,
			channel: input.channel,
			error: `${spec.label} post failed: ${e instanceof Error ? e.message : String(e)}`,
		}
	}
}

/** Upload a short-form video. Same gating as `post`. */
export async function uploadShort(
	input: SocialPostInput & { videoUrl: string },
): Promise<SocialResult> {
	return post({ ...input, mediaUrl: input.videoUrl })
}

/** Delete/unlist a previously published post (the reversal path). Never throws. */
export async function deletePost(channel: SocialChannel, postId: string): Promise<SocialResult> {
	const spec = SPEC_BY_CHANNEL[channel]
	if (!isChannelAvailable(channel)) return notConfigured(channel)
	const endpoint = process.env[spec.postUrlEnv]
	if (!endpoint) {
		return {
			ok: false,
			channel,
			error: `${spec.label}: set ${spec.postUrlEnv} to enable deletion.`,
		}
	}
	const token = process.env[spec.tokens[0]]!
	try {
		const res = await fetch(`${endpoint.replace(/\/$/, '')}/${encodeURIComponent(postId)}`, {
			method: 'DELETE',
			headers: { authorization: `Bearer ${token}` },
		})
		if (!res.ok) {
			const text = await res.text()
			return {
				ok: false,
				channel,
				error: `${spec.label} HTTP ${res.status}: ${text.slice(0, 200)}`,
			}
		}
		return { ok: true, channel, postId, output: `deleted ${postId}` }
	} catch (e) {
		return {
			ok: false,
			channel,
			error: `${spec.label} delete failed: ${e instanceof Error ? e.message : String(e)}`,
		}
	}
}
