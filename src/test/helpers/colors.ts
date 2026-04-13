const colors = {
  reset: "\x1b[0m",
  error: "\x1b[31m",
  browserLog: "\x1b[34m",
  extensionLog: "\x1b[32m",
};

export function colorText(color: keyof typeof colors, text: string) {
  return `${colors[color]}${text}${colors.reset}`;
}
