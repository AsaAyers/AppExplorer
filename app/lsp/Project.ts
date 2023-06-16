export type Project = {
  readonly name: string;
  readonly root: string;
  readonly remotes: string[];
  // readonly registrations?: Array<Registration>;
  plugins: Array<string>;
};
