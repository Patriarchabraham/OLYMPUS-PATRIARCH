/**
 * Olympuz Ops — Browser automation adapter (Playwright).
 *
 * Lazy-loads `playwright` on first use; when the package is absent or browsers
 * aren't installed, every operation returns a clear "not configured" result
 * rather than throwing — so the Ops department is structurally complete and the
 * deterministic core stays testable without the heavy dependency. Mirrors the
 * ImageGenTool provider-availability pattern.
 *
 * Two usage modes: deterministic primitives (goto/click/fill/screenshot/
 * evaluate/submit) when selectors are known, and a vision-driven fallback
 * (screenshot → reason → act) handled by the caller via the Vision tool.
 */

export interface BrowserResult {
	ok: boolean
	output?: string
	imageBase64?: string
	error?: string
}

interface PlaywrightModule {
	chromium: { launch(opts?: { headless?: boolean }): Promise<Browser> }
}
interface Browser {
	close(): Promise<void>
	newPage(): Promise<Page>
}
interface Page {
	goto(url: string, opts?: { waitUntil?: string }): Promise<unknown>
	click(selector: string, opts?: { timeout?: number }): Promise<unknown>
	fill(selector: string, value: string, opts?: { timeout?: number }): Promise<unknown>
	screenshot(opts?: { type?: string }): Promise<Buffer>
	evaluate(fn: string): Promise<unknown>
	url(): string
	close(): Promise<void>
}

let _playwright: PlaywrightModule | null = null
let _triedLoad = false

/** Lazy-load playwright; memoize a miss so we don't retry every call. */
export async function loadPlaywright(): Promise<PlaywrightModule | null> {
	if (_triedLoad) return _playwright
	_triedLoad = true
	try {
		// @ts-expect-error optional dependency — loaded lazily; may be absent, in which
		// case loadPlaywright() returns null and callers report "not configured".
		const mod = (await import('playwright')) as PlaywrightModule
		_playwright = mod?.chromium ? mod : null
	} catch {
		_playwright = null
	}
	return _playwright
}

/** True when playwright is importable. */
export async function isBrowserAvailable(): Promise<boolean> {
	return Boolean(await loadPlaywright())
}

/** Reset the cached load state (tests). */
export function resetBrowserLoader(): void {
	_playwright = null
	_triedLoad = false
}

export interface BrowserSession {
	page: Page
	close: () => Promise<void>
}

/** Launch a chromium session. Returns ok:false with guidance when unavailable. */
export async function launchSession(opts?: {
	headless?: boolean
}): Promise<{ ok: boolean; session?: BrowserSession; error?: string }> {
	const pw = await loadPlaywright()
	if (!pw) {
		return {
			ok: false,
			error:
				'Playwright is not installed. Run `npm i playwright && npx playwright install chromium`, then retry.',
		}
	}
	try {
		const browser = await pw.chromium.launch({ headless: opts?.headless ?? true })
		const page = await browser.newPage()
		return {
			ok: true,
			session: {
				page,
				close: async () => {
					try {
						await page.close()
					} catch {
						/* ignore */
					}
					try {
						await browser.close()
					} catch {
						/* ignore */
					}
				},
			},
		}
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e)
		return { ok: false, error: `launch failed: ${msg}` }
	}
}

function notConfigured(label: string): BrowserResult {
	return {
		ok: false,
		error: `${label}: Playwright is not installed. Run \`npm i playwright && npx playwright install chromium\`.`,
	}
}

/** Run a single-page action against a fresh session. */
async function withSession<T>(
	url: string,
	fn: (page: Page) => Promise<T>,
	label: string,
): Promise<{ result?: T } & BrowserResult> {
	const launched = await launchSession({ headless: true })
	if (!launched.ok || !launched.session) {
		return { ...notConfigured(label) }
	}
	const { session } = launched
	try {
		await session.page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {})
		const result = await fn(session.page)
		return { ok: true, result }
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e)
		return { ok: false, error: `${label} failed: ${msg}` }
	} finally {
		await session.close()
	}
}

export async function goto(url: string): Promise<BrowserResult> {
	const launched = await launchSession({ headless: true })
	if (!launched.ok || !launched.session) return notConfigured('goto')
	const { session } = launched
	try {
		await session.page.goto(url, { waitUntil: 'domcontentloaded' })
		return { ok: true, output: `navigated to ${url}` }
	} catch (e) {
		return { ok: false, error: `goto failed: ${e instanceof Error ? e.message : String(e)}` }
	} finally {
		await session.close()
	}
}

export async function click(url: string, selector: string): Promise<BrowserResult> {
	return withSession(
		url,
		(page) => page.click(selector, { timeout: 5000 }),
		`click ${selector}`,
	).then((r) => (r.ok ? { ok: true, output: `clicked ${selector}` } : r))
}

export async function fill(url: string, selector: string, value: string): Promise<BrowserResult> {
	return withSession(
		url,
		(page) => page.fill(selector, value, { timeout: 5000 }),
		`fill ${selector}`,
	).then((r) => (r.ok ? { ok: true, output: `filled ${selector}` } : r))
}

export async function screenshotPage(url: string): Promise<BrowserResult> {
	return withSession(url, (page) => page.screenshot({ type: 'png' }), 'screenshot').then((r) =>
		r.ok && r.result
			? { ok: true, imageBase64: (r.result as Buffer).toString('base64') }
			: { ok: false, error: r.error ?? 'screenshot failed' },
	)
}

export async function evaluate(url: string, expression: string): Promise<BrowserResult> {
	return withSession(url, (page) => page.evaluate(expression), 'evaluate').then((r) =>
		r.ok
			? { ok: true, output: typeof r.result === 'string' ? r.result : JSON.stringify(r.result) }
			: r,
	)
}

/** Submit a form by selector (the approval gate is applied by the tool layer). */
export async function submit(url: string, selector: string): Promise<BrowserResult> {
	return withSession(
		url,
		(page) => page.click(selector, { timeout: 5000 }),
		`submit ${selector}`,
	).then((r) => (r.ok ? { ok: true, output: `submitted ${selector}` } : r))
}
