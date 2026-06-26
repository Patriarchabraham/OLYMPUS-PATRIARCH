/**
 * SWE-bench dataset sources.
 *
 * Provides URLs for each SWE-bench variant (Lite, Verified, Full, Pro).
 */

export const SWE_DATASETS: Record<string, string> = {
	lite: 'https://huggingface.co/datasets/princeton-nlp/SWE-bench_Lite/resolve/main/swe-bench-lite.jsonl',
	verified:
		'https://huggingface.co/datasets/princeton-nlp/SWE-bench_Verified/resolve/main/swe-bench-verified.jsonl',
	full: 'https://huggingface.co/datasets/princeton-nlp/SWE-bench/resolve/main/swe-bench.jsonl',
	pro: 'https://huggingface.co/datasets/swe-bench/SWE-bench_Pro/resolve/main/swe-bench-pro.jsonl',
}
