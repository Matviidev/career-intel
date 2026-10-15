import type { DocumentRow } from '../db/schema.js';
import type { JobProfile, ResumeProfile } from '../domain/profiles.js';
import type { Embedder } from '../embeddings/embedder.js';
import { computeFit, type FitReport } from './fit.js';

type Resume = DocumentRow & { profile: ResumeProfile };
type Job = DocumentRow & { profile: JobProfile };

export class FitService {
  private readonly cache = new Map<string, Promise<FitReport>>();

  constructor(private readonly embedder: Embedder) {}

  fit(resume: Resume, job: Job): Promise<FitReport> {
    const key = `${resume.id}:${job.id}`;
    let report = this.cache.get(key);
    if (!report) {
      report = computeFit(resume.profile, job.profile, this.embedder);
      report.catch(() => this.cache.delete(key));
      this.cache.set(key, report);
    }
    return report;
  }
}
