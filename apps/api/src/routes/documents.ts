import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { DocumentRow } from '../db/schema.js';
import type { IngestInput } from '../documents/service.js';
import { parseFile } from '../ingest/parse.js';

const textBody = z.object({
  text: z.string().min(1),
  sourceName: z.string().max(200).optional(),
});

const idParams = z.object({ id: z.uuid() });

async function readInput(req: FastifyRequest, fallbackName: string): Promise<IngestInput> {
  if (req.isMultipart()) {
    const file = await req.file();
    if (!file) throw req.server.httpErrors.badRequest('No file uploaded.');
    const buffer = await file.toBuffer();
    return { sourceName: file.filename, text: await parseFile(file.filename, buffer) };
  }
  const body = textBody.parse(req.body);
  return { sourceName: body.sourceName ?? fallbackName, text: body.text.trim() };
}

function summary(doc: DocumentRow) {
  return {
    id: doc.id,
    kind: doc.kind,
    number: doc.number,
    title: doc.title,
    company: doc.company,
    sourceName: doc.sourceName,
    profile: doc.profile,
    createdAt: doc.createdAt,
  };
}

export const documentRoutes: FastifyPluginAsync = async (base) => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const { documents, fits, metrics } = app.deps;

  app.get('/resume', async () => {
    const resume = await documents.getResume();
    return { resume: resume && summary(resume) };
  });

  app.post('/resume', async (req, reply) => {
    const input = await readInput(req, 'Pasted resume');
    const end = metrics.ingestDuration.startTimer({ kind: 'resume' });
    const doc = await documents.ingestResume(input);
    end();
    req.log.info({ documentId: doc.id, chars: input.text.length }, 'resume ingested');
    return reply.code(201).send({ resume: summary(doc) });
  });

  app.delete('/resume', async (_req, reply) => {
    const resume = await documents.getResume();
    if (resume) await documents.delete(resume.id);
    return reply.code(204).send();
  });

  app.get('/jobs', async () => {
    const [resume, jobs] = await Promise.all([documents.getResume(), documents.listJobs()]);
    const items = await Promise.all(
      jobs.map(async (job) => {
        const fit = resume ? await fits.fit(resume, job) : null;
        return { ...summary(job), fit: fit && { score: fit.score, verdict: fit.verdict } };
      }),
    );
    return { jobs: items };
  });

  app.post('/jobs', async (req, reply) => {
    const input = await readInput(req, 'Pasted job posting');
    const end = metrics.ingestDuration.startTimer({ kind: 'job' });
    const doc = await documents.ingestJob(input);
    end();
    req.log.info({ documentId: doc.id, number: doc.number }, 'job ingested');
    return reply.code(201).send({ job: summary(doc) });
  });

  app.get('/jobs/:id', { schema: { params: idParams } }, async (req) => {
    const job = await documents.getJob(req.params.id);
    if (!job) throw app.httpErrors.notFound('Job not found.');
    const resume = await documents.getResume();
    return {
      job: { ...summary(job), content: job.content },
      fit: resume ? await fits.fit(resume, job) : null,
    };
  });

  app.delete('/jobs/:id', { schema: { params: idParams } }, async (req, reply) => {
    const job = await documents.getJob(req.params.id);
    if (!job) throw app.httpErrors.notFound('Job not found.');
    await documents.delete(job.id);
    return reply.code(204).send();
  });
};
