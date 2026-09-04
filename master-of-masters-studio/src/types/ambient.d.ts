interface AudioBuffer {
	copyToChannel(source: Float32Array<any>, channelNumber: number, startInChannel?: number): void
}

interface AnalyserNode {
	getFloatTimeDomainData(array: Float32Array<any>): void
	getFloatFrequencyData(array: Float32Array<any>): void
	getByteFrequencyData(array: Uint8Array<any>): void
	getByteTimeDomainData(array: Uint8Array<any>): void
}
