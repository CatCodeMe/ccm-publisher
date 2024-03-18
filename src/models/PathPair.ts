class PathPair {
	constructor(
		public readonly localPath: string,
		public readonly remotePath: string,
		public readonly isImg: boolean,
		public readonly remoteHash?: string,
	) {}
}

export default PathPair;
