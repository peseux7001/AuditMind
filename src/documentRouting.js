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
