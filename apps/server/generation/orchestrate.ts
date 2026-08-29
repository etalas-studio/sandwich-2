import type { DocumentType } from "../db/documents.js";

/**
 * Guided-pipeline state machine (model-driven). The backend owns the stage
 * transitions; the AI only produces content for the current stage.
 *
 *   intake → choosing_deliverable → clarifying → generating → awaiting_next
 *                                                      ↓ (feedback on existing doc)
 *                                                   refining → generating (refine)
 */
export type PipelineStage =
  | "intake"
  | "choosing_deliverable"
  | "clarifying"
  | "generating"
  | "refining"
  | "awaiting_next";

export const INITIAL_STAGE: PipelineStage = "intake";

/** Best-effort detection of which deliverable the user asked for. */
export function detectDeliverableType(message: string): DocumentType | null {
  const m = message.toLowerCase();
  if (
    /\bprd\b|\bproduct requirements?\b|\bdokumen kebutuhan\b|\brequirements? doc(?:ument)?\b|\bspesifikasi produk\b|\bbrief produk\b/.test(
      m,
    )
  )
    return "prd";
  if (
    /\bquot(?:e|ation)?\b|\bpenawaran\b|\bharga\b|\bpricing\b|\binvoice\b|\bestimasi\b|\brab\b|\bbudget\b|\bproposal harga\b|\brincian biaya\b/.test(
      m,
    )
  )
    return "quotation";
  if (
    /\bprototype\b|\bprototip\b|\bpurwarupa\b|\bmock-?up\b|\bwireframe\b|\bfigma\b|\bui\b|\bdesign\b|\blanding\b|\b(?:buat|bikin)(?:kan)? (?:aplikasi|website|web app|webapp)\b/.test(
      m,
    )
  )
    return "prototype";
  if (
    /\bspecs?\b|\btasks?\b|\bbreakdown\b|\bfeatures?\b|\bdaftar fitur\b|\bfeature list\b|\broadmap\b|\buser stor(?:y|ies)\b|\bmodul\b|\bspesifikasi teknis\b|\btechnical spec\b/.test(
      m,
    )
  )
    return "specs";
  return null;
}

/** "Show/give me the preview link" follow-up on an existing prototype. */
export function detectPreviewIntent(message: string): boolean {
  return /\b(preview|previewnya|link|linknya|url)\b|\btampilkan\b|\blihat hasil\b|\bliat hasil\b|\bcek hasil\b|\bshow (?:me|preview)\b/i.test(
    message,
  );
}

/** "Change/add/fix" follow-up that should revise the existing deliverable. */
export function detectRefineIntent(message: string): boolean {
  return /\b(ubah|ganti|edit|revisi|refine|update|perbaiki|fix|tambah|tambahkan|add|hilangkan|hapus|remove|change|modif|perbarui|sesuaikan|rapihin|rapikan|benerin|betulin|revise|adjust|tweak|improve|poles|feedback|masukan|saran|kurang|lebih|geser|pindah|pindahkan|taruh|letakkan|depan|belakang|atas|bawah|kiri|kanan|tengah|samping|posisi|layout|tata letak|marquee|navbar|hero|footer|section|bagian|tombol|button|warna|color|font|ukuran|besar|kecil|spacing|jarak)\b/i.test(
    message,
  );
}

/**
 * Explicit "never mind" — cancels a pending refine (or any follow-up) and
 * returns the conversation to awaiting_next. Keep this set narrow: the
 * refine-by-default design intentionally treats everything else as feedback.
 */
export function detectCancelIntent(message: string): boolean {
  return /\b(nggak (?:jadi|usah)|ga (?:jadi|usah)|tidak (?:jadi|usah)|batal|skip|cancel|gausah|nggausah|ga usah|lupakan|forget it|never mind|udah ga usah|udah nggak usah|jangan dulu|ntar aja|nanti aja)\b/i.test(
    message,
  );
}

/**
 * Hard gate for the prototype flow: has the client mentioned BOTH logo and
 * color/palette anywhere in the conversation yet? Backend-enforced so
 * generation can't proceed on a prompt instruction alone — if the model
 * forgets to ask (or the client skips answering), the stage stays in
 * `clarifying` instead of advancing to `generating`.
 */
export function hasLogoAndColorDetails(allUserText: string): boolean {
  const m = allUserText.toLowerCase();
  // Prefix-match (no trailing \b) so Indonesian suffixes still count:
  // "logonya", "warnanya", etc.
  const mentionsLogo = /\blogo/.test(m);
  const mentionsColor = /\bwarna|\bcolou?r|\bpalet|\bbrand colou?r/.test(m);
  return mentionsLogo && mentionsColor;
}

const DELIVERABLE_LABEL: Record<DocumentType, string> = {
  prd: "PRD",
  quotation: "Quotation",
  prototype: "Prototype",
  specs: "Specs",
  mom: "MOM",
};

/** The instruction injected into the system prompt for the current stage. */
export function stageInstruction(stage: PipelineStage, pendingType: DocumentType | null): string {
  switch (stage) {
    case "intake":
    case "choosing_deliverable":
      return "You are in intake. Acknowledge the brief and ask the user which deliverable they want to generate first: PRD, Quotation, Prototype, or Specs. Do NOT generate anything yet.";
    case "clarifying":
      if (pendingType === "prototype") {
        return "You are clarifying requirements for the Prototype. Ask focused clarifying questions covering: target users, scope, constraints (do NOT ask about timeline — it's not relevant for a prototype) — and you MUST also explicitly ask (a) whether the client has a logo to share (upload or URL) or wants a simple text-based placeholder, and (b) what color palette / brand colors to use (or a professional default if they have no preference). Do NOT generate the document yet.";
      }
      return `You are clarifying requirements for the ${DELIVERABLE_LABEL[pendingType ?? "prd"]}. Ask 3-5 focused clarifying questions (target users, scope, constraints, timeline). Do NOT generate the document yet.`;
    case "generating":
      return `Generate the full ${DELIVERABLE_LABEL[pendingType ?? "prd"]} document now. Output ONLY the document content — no preamble, no meta-commentary.`;
    case "refining":
      return "You are refining an existing deliverable. The user just gave feedback on the document that was generated. Acknowledge the feedback concisely, restate what you understood, and ask whether there are any other revisions before you regenerate. Do NOT generate the document yet — wait for the user's confirmation or more feedback. If the user instead asks a question or just says thanks, answer normally and do not push for revisions.";
    case "awaiting_next":
      return "A deliverable was just generated. Ask the user what they want next: generate another deliverable (PRD, Quotation, Prototype, Specs) or refine the one just created.";
  }
}
