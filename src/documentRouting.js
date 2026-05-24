const getExtension = (filename) => {
  const match = String(filename).match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : "";
};

export const documentRoutingSpec = {
  stages: [
    "upload_receipt",
    "security_scan",
    "archive_expansion",
    "file_normalization",
    "type_specific_extraction",
    "candidate_generation",
    "qwen_document_judgment",
    "conflict_resolution",
    "checklist_state_update",
    "evidence_trace_storage",
  ],
  qwenDecisionSchema: {
    isExpectedDocument: "boolean",
    targetChecklistItem: "string",
    confidence: "high | medium | low",
    coverage: "number",
    status: "approved | rejected | missing | needs_review",
    reason: "string",
    evidence: "array",
    customerMessage: "string",
  },
  decisionPolicy: {
    principle: "근거가 부족하면 승인하지 않는다.",
    approved: "Qwen이 요청 문서라고 판단하고, 필수 항목가 충분히 확인되며, OCR/필드 인식 품질이 수용 가능한 경우",
    rejected: "완전히 다른 문서이거나 요청 기간/필수 값/품질이 부족해 고객 재제출이 필요한 경우",
    needsReview: "문서가 맞을 가능성은 있으나 근거가 애매해 자동 승인하면 위험한 경우",
  },
};

const confidenceToScore = (confidence) => {
  if (typeof confidence === "number") return Math.max(0, Math.min(1, confidence));

  const normalized = String(confidence || "").toLowerCase();
  if (normalized === "high") return 0.92;
  if (normalized === "medium") return 0.68;
  if (normalized === "low") return 0.35;
  return 0.5;
};

const clamp01 = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

const toPercent = (value) => Math.round(clamp01(value) * 100);

const getFieldValue = (fields, key) => {
  if (!fields || !Object.prototype.hasOwnProperty.call(fields, key)) return null;
  const value = fields[key];

  if (value && typeof value === "object" && !Array.isArray(value)) {
    return {
      value: value.value ?? "",
      confidence: confidenceToScore(value.confidence ?? value.score ?? 0.8),
      evidence: value.evidence ?? value.source ?? "",
    };
  }

  return {
    value,
    confidence: value ? 0.8 : 0,
    evidence: "",
  };
};

const hasUsableValue = (field, minimumConfidence) => {
  if (!field) return false;
  if (field.value === null || field.value === undefined) return false;
  if (String(field.value).trim() === "") return false;
  return confidenceToScore(field.confidence) >= minimumConfidence;
};

const average = (numbers) => {
  const usable = numbers.filter((value) => Number.isFinite(value));
  if (!usable.length) return 0;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
};

export const evaluateDocumentJudgment = ({
  checklistItem,
  requiredFields,
  ocrResult,
  qwenJudgment,
  thresholds = {},
}) => {
  const policy = {
    minimumFieldConfidence: thresholds.minimumFieldConfidence ?? 0.45,
    approveIdentityScore: thresholds.approveIdentityScore ?? 0.75,
    approveRequiredCoverage: thresholds.approveRequiredCoverage ?? 0.7,
    approveQualityScore: thresholds.approveQualityScore ?? 0.55,
    reviewIdentityScore: thresholds.reviewIdentityScore ?? 0.55,
  };

  const required = (requiredFields || []).filter((field) => field.isRequired !== false);
  const optional = (requiredFields || []).filter((field) => field.isRequired === false);
  const ocrFields = ocrResult?.fields || {};
  const qwenFields = qwenJudgment?.fields || {};
  const mergedFields = { ...ocrFields, ...qwenFields };

  const fieldResults = required.map((field) => {
    const extracted = getFieldValue(mergedFields, field.key);
    const present = hasUsableValue(extracted, policy.minimumFieldConfidence);
    return {
      key: field.key,
      label: field.label,
      present,
      value: extracted?.value ?? "",
      confidence: toPercent(confidenceToScore(extracted?.confidence)),
      evidence: extracted?.evidence || "",
    };
  });

  const optionalResults = optional.map((field) => {
    const extracted = getFieldValue(mergedFields, field.key);
    return {
      key: field.key,
      label: field.label,
      present: hasUsableValue(extracted, policy.minimumFieldConfidence),
      value: extracted?.value ?? "",
      confidence: toPercent(confidenceToScore(extracted?.confidence)),
      evidence: extracted?.evidence || "",
    };
  });

  const presentRequired = fieldResults.filter((field) => field.present);
  const missingRequired = fieldResults.filter((field) => !field.present);
  const requiredCoverage = required.length ? presentRequired.length / required.length : 0;
  const fieldConfidenceAverage = average(
    fieldResults.filter((field) => field.present).map((field) => field.confidence / 100),
  );
  const ocrQualityScore = average([
    confidenceToScore(ocrResult?.textQuality ?? ocrResult?.text_quality ?? 0.75),
    confidenceToScore(ocrResult?.layoutQuality ?? ocrResult?.layout_quality ?? 0.75),
    fieldConfidenceAverage || 0,
  ]);
  const qwenConfidenceScore = confidenceToScore(qwenJudgment?.confidence);
  const qwenCoverageScore = clamp01((qwenJudgment?.coverage ?? toPercent(requiredCoverage)) / 100);
  const identityScore = qwenJudgment?.isExpectedDocument === false
    ? 0
    : average([qwenConfidenceScore, qwenCoverageScore]);
  const confidenceScore = Math.min(identityScore, requiredCoverage, ocrQualityScore);
  const confidencePercent = toPercent(confidenceScore);

  let status = "needs_review";
  let customerStatus = "rejected";
  let reason = qwenJudgment?.reason || "문서 판정 근거가 충분하지 않습니다.";

  if (qwenJudgment?.isExpectedDocument === false || qwenJudgment?.status === "rejected") {
    status = "rejected";
    customerStatus = "rejected";
    reason = qwenJudgment?.reason || "요청한 문서와 다른 자료로 판단되었습니다.";
  } else if (
    identityScore >= policy.approveIdentityScore &&
    requiredCoverage >= policy.approveRequiredCoverage &&
    ocrQualityScore >= policy.approveQualityScore &&
    qwenJudgment?.status !== "needs_review"
  ) {
    status = "approved";
    customerStatus = "approved";
    reason = qwenJudgment?.reason || "필수 항목과 문서 근거가 충분히 확인되었습니다.";
  } else if (identityScore < policy.reviewIdentityScore) {
    status = "rejected";
    customerStatus = "rejected";
    reason = qwenJudgment?.reason || "요청한 문서인지 확인할 근거가 부족합니다.";
  } else {
    status = "needs_review";
    customerStatus = "rejected";
    if (missingRequired.length) {
      reason = `필수 항목 ${missingRequired.map((field) => field.label).join(", ")}을(를) 충분히 확인하지 못했습니다.`;
    } else if (ocrQualityScore < policy.approveQualityScore) {
      reason = "문서 인식 품질이 낮아 자동 승인하기 어렵습니다.";
    }
  }

  return {
    checklistItemId: checklistItem?.id || checklistItem?.title || "",
    title: checklistItem?.title || "",
    status,
    customerStatus,
    reviewCompletionRate: confidencePercent,
    confidencePercent,
    identityScore: toPercent(identityScore),
    requiredFieldCoverage: toPercent(requiredCoverage),
    qualityScore: toPercent(ocrQualityScore),
    foundRequiredFields: presentRequired,
    missingRequiredFields: missingRequired,
    optionalFields: optionalResults,
    reviewMessage:
      status === "approved"
        ? `AI 검수 완료율 ${confidencePercent}%입니다. 제출 기준에 맞게 첨부되었습니다.`
        : `오류 사유: ${reason}`,
    rejectionReason: status === "approved" ? null : reason,
    reason,
    evidence: [
      ...(qwenJudgment?.evidence || []),
      ...presentRequired
        .filter((field) => field.evidence)
        .map((field) => ({
          field: field.key,
          basis: field.evidence,
        })),
    ],
  };
};

export const normalizeUploadedFiles = (fileList) =>
  Array.from(fileList || []).map((file) => ({
    name: file.name,
    type: file.type,
    size: file.size,
    extension: getExtension(file.name),
    source: "direct_upload",
    container: "",
  }));

export const createMockRoutingResult = (checklistItems) =>
  checklistItems.map((item) => ({
    ...item,
    note: "",
    routing: {
      matchedBy: "mock_backend_result",
      reason: "프론트엔드 시뮬레이션입니다. 실제 문서 적합성 판단은 백엔드와 Qwen 라우팅 엔진에서 수행합니다.",
    },
  }));

export const routeUploadedFilesToChecklist = (uploadedFiles, checklistItems) => {
  normalizeUploadedFiles(uploadedFiles);
  return createMockRoutingResult(checklistItems);
};
