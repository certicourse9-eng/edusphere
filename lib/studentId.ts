export function deriveStudentId(fileName: string): string {
  const digitsMatch = fileName.match(/\d+/);
  if (digitsMatch) return digitsMatch[0];
  const withoutExtension = fileName.replace(/\.[^./]+$/, '');
  return withoutExtension || fileName;
}
