import { z } from "zod";

const nonEmpty = z.string().trim().min(1, "Wajib diisi");
const numStr = z
  .string()
  .trim()
  .refine((v) => v === "" || Number.isFinite(Number(v)), "Harus angka");

export const wizardStep1Schema = z.object({
  projectName: nonEmpty,
  contractDate: nonEmpty,
});

export const wizardStep2Schema = z.object({
  durationMonths: z.number().int().min(1).max(120),
  waccOverride: numStr,
  inflationOverride: numStr,
  kursUsdOverride: numStr,
  bcrMandatory: numStr,
  bcrMinimum: numStr,
});

export const wizardStep3Schema = z.object({
  capexCount: z.number().int().min(0),
});

export const wizardStep4Schema = z.object({
  opexCount: z.number().int().min(0),
});

export const wizardStep5Schema = z.object({
  revenueCount: z.number().int().min(0),
});

export function formatZodError(e: z.ZodError) {
  // show first few issues only
  const issues = e.issues.slice(0, 5).map((i) => i.message);
  return issues.join("; ");
}

