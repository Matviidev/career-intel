import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export const keys = {
  resume: ['resume'] as const,
  jobs: ['jobs'] as const,
  job: (id: string) => ['jobs', id] as const,
  trace: (id: string) => ['trace', id] as const,
};

export const useResume = () => useQuery({ queryKey: keys.resume, queryFn: api.resume });
export const useJobs = () => useQuery({ queryKey: keys.jobs, queryFn: api.jobs });
export const useJob = (id: string | null) =>
  useQuery({ queryKey: keys.job(id ?? ''), queryFn: () => api.job(id!), enabled: !!id });
export const useTrace = (id: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: keys.trace(id ?? ''),
    queryFn: () => api.trace(id!),
    enabled: !!id && enabled,
  });

function useInvalidateAll() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: keys.resume }),
      qc.invalidateQueries({ queryKey: keys.jobs }),
    ]);
}

export function useUploadResume() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: api.uploadResume, onSuccess: invalidate });
}

export function useDeleteResume() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: api.deleteResume, onSuccess: invalidate });
}

export function useAddJob() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: api.addJob, onSuccess: invalidate });
}

export function useDeleteJob() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: api.deleteJob, onSuccess: invalidate });
}
