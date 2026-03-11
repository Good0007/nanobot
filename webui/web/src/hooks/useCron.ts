import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "../lib/api";

export interface CronSchedule {
  minute: string;
  hour: string;
  day: string;
  month: string;
  weekday: string;
}

export interface CronPayload {
  message: string;
  deliver: boolean;
  channel: string;
  to: string;
}

export interface CronJob {
  id: string;
  name: string;
  enabled: boolean;
  schedule: CronSchedule;
  payload: CronPayload;
  next_run: string | null;
  last_run: string | null;
}

export interface CronJobRequest {
  name: string;
  enabled?: boolean;
  schedule: CronSchedule;
  payload: CronPayload;
  delete_after_run?: boolean;
}

export function useCronJobs() {
  return useQuery<CronJob[]>({
    queryKey: ["cron", "jobs"],
    queryFn: () => api.get("/cron/jobs").then((r) => r.data),
    refetchInterval: 30000,
  });
}

export function useCreateCronJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CronJobRequest) =>
      api.post("/cron/jobs", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cron", "jobs"] });
      toast.success("Created");
    },
  });
}

export function useUpdateCronJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<CronJobRequest>) =>
      api.put(`/cron/jobs/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cron", "jobs"] });
      toast.success("Saved");
    },
  });
}

export function useDeleteCronJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/cron/jobs/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cron", "jobs"] });
      toast.success("Deleted");
    },
  });
}

export function useToggleCronJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.put(`/cron/jobs/${id}`, { enabled }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cron", "jobs"] });
    },
  });
}
