export type Project = {
  readonly name: string;
  readonly root: string;
  readonly projectRoot: string;
  // readonly registrations?: Array<Registration>;
  plugins: Array<string>;
};
