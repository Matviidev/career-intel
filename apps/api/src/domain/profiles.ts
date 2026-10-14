import { z } from 'zod';

export const resumeProfileSchema = z.object({
  name: z.string().describe('Candidate full name, or empty string if not present'),
  headline: z.string().describe('One-line professional summary, e.g. "Senior backend engineer"'),
  totalYearsExperience: z.number().describe('Total years of professional experience'),
  skills: z
    .array(
      z.object({
        name: z.string().describe('Canonical skill name, e.g. "TypeScript", "PostgreSQL"'),
        years: z.number().nullable().describe('Years of hands-on use if inferable, else null'),
      }),
    )
    .describe('Technical and domain skills evidenced in the resume'),
  roles: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      start: z.string().describe('Start date as written, e.g. "2021-03" or "2021"'),
      end: z.string().describe('End date as written, or "present"'),
      highlights: z.array(z.string()).describe('Up to 3 key achievements'),
    }),
  ),
  education: z.array(z.string()),
});

export const jobProfileSchema = z.object({
  title: z.string(),
  company: z.string().describe('Hiring company, or empty string if not present'),
  seniority: z.enum(['intern', 'junior', 'mid', 'senior', 'staff', 'principal', 'unknown']),
  minYearsExperience: z.number().nullable().describe('Minimum years required, null if unstated'),
  mustHaveSkills: z.array(z.string()).describe('Required skills, canonical names'),
  niceToHaveSkills: z.array(z.string()).describe('Preferred / bonus skills, canonical names'),
  responsibilities: z.array(z.string()).describe('Up to 6 main responsibilities'),
  summary: z.string().describe('Two-sentence summary of the role'),
});

export type ResumeProfile = z.infer<typeof resumeProfileSchema>;
export type JobProfile = z.infer<typeof jobProfileSchema>;
