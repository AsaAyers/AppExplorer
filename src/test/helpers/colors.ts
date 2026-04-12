const colors = {
  error: "\x1b[31m",
  reset: "\x1b[0m",
  blue: "\x1b[34m",
  browserLog: "\x1b[34m",
  extensionLog: "\x1b[32m",
  yellow: "\x1b[33m",
};
// if (!process.env.FORCE_COLOR) {
//   colors = {
//     red: "",
//     reset: "",
//     blue: "",
//     cyan: "",
//     magenta: "",
//     yellow: "",
//   };
// }

export function colorText(color: keyof typeof colors, text: string) {
  return `${colors[color]}${text}${colors.reset}`;
}
