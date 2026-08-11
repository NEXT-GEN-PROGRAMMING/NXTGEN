import { z } from "zod";

const MAX_OWNER_LENGTH = 39;
const MAX_REPO_LENGTH = 100;

const repoFullNameSchema = z
  .string()
  .trim()
  .regex(/^[\w.-]+\/[\w.-]+$/)
  .refine(
    (value) => {
      const [owner, repo] = value.split("/");
      return (
        owner !== undefined &&
        repo !== undefined &&
        owner.length <= MAX_OWNER_LENGTH &&
        repo.length <= MAX_REPO_LENGTH
      );
    },
    { message: "Repository segments exceed GitHub length limits" },
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
