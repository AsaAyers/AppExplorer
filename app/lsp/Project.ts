export type Project = {
  readonly name: string;
  readonly root: string;
  readonly remote: string;
  // readonly registrations?: Array<Registration>;
  plugins: Array<string>;
};
