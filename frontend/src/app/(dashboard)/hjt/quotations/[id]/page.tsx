"use client";

import { use } from "react";
import { HjtQuotationWizard } from "@/components/hjt/HjtQuotationWizard";

export default function HjtQuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <HjtQuotationWizard mode="edit" quotationId={id} />;
}
