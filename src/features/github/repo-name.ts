import { z } from "zod";

const repoFullNameSchema = z
  .string()
  .trim()
  .regex(
    /^(?!.*\.\.)[A-Za-z0-9](?:[\w.-]{0,37}[A-Za-z0-9])?\/[A-Za-z0-9](?:[\w.-]{0,98}[A-Za-z0-9])?$/,
    "Repository segments exceed GitHub length limits",
  );

export interface ParsedRepoFullName {
  owner: string;
  repo: string;
}

export function parseRepoFullName(input: string): ParsedRepoFullName | null {
  const parsed = repoFullNameSchema.safeParse(input);
  if (!parsed.success) return null;

  const [owner, repo] = parsed.data.split("/");
  return { owner, repo };
}
