import http from "node:http";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { Pool } from "pg";

const port = Number(process.env.AUDITMIND_API_PORT || 4174);
const currentUserId = process.env.AUDITMIND_CURRENT_USER_ID || "system";
const uploadRoot = process.env.AUDITMIND_UPLOAD_ROOT || path.resolve(process.cwd(), "public/uploads");
const publicUploadBaseUrl = process.env.AUDITMIND_PUBLIC_UPLOAD_BASE_URL || "/uploads";
const qwenChatUrl = process.env.AUDITMIND_QWEN_CHAT_URL || "http://100.120.165.93:8090/v1/chat/completions";
const qwenModel = process.env.AUDITMIND_QWEN_MODEL || "Qwen3.6-35B-A3B-UD-Q8_K_XL.gguf";
const paddleOcrChatUrl = process.env.AUDITMIND_PADDLE_OCR_CHAT_URL || "http://100.126.53.70:8118/v1/chat/completions";
const paddleOcrModel = process.env.AUDITMIND_PADDLE_OCR_MODEL || "PaddleOCR-VL-1.5-0.9B";
const maxUploadFileBytes = Number(process.env.AUDITMIND_MAX_UPLOAD_FILE_BYTES || 50 * 1024 * 1024);
const fileProcessorPath = path.resolve(process.cwd(), "backend/document_processing/file_processor.py");
const pythonCommand = process.env.AUDITMIND_PYTHON || "python3";

const execFileAsync = promisify(execFile);

const pool = new Pool({
  host: process.env.AUDITMIND_DB_HOST || "127.0.0.1",
  port: Number(process.env.AUDITMIND_DB_PORT || 5432),
  database: process.env.AUDITMIND_DB_NAME || "auditmind",
  user: process.env.AUDITMIND_DB_USER || "auditmind",
  password: process.env.AUDITMIND_DB_PASSWORD || "auditmind_dev_password",
  max: 10,
});

const sendJson = (res, status, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
};

const sendBuffer = (res, status, buffer, contentType = "application/octet-stream") => {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": buffer.length,
    "Cache-Control": "no-store",
  });
  res.end(buffer);
};

const readJsonBody = async (req) =>
  new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });

const readRequestBuffer = async (req, maxBytes = 50 * 1024 * 1024) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

const parseMultipartFormData = async (req) => {
  const contentType = req.headers["content-type"] || "";
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) {
    const error = new Error("multipart/form-data boundary가 없습니다.");
    error.status = 400;
    throw error;
  }

  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const body = await readRequestBuffer(req);
  const files = [];
  const fields = {};
  let cursor = 0;

  while (cursor < body.length) {
    const partStart = body.indexOf(boundaryBuffer, cursor);
    if (partStart === -1) break;
    const nextPartStart = body.indexOf(boundaryBuffer, partStart + boundaryBuffer.length);
    if (nextPartStart === -1) break;

    let contentStart = partStart + boundaryBuffer.length;
    if (body.slice(contentStart, contentStart + 2).toString() === "--") break;
    if (body.slice(contentStart, contentStart + 2).toString() === "\r\n") contentStart += 2;

    const headerEnd = body.indexOf(Buffer.from("\r\n\r\n"), contentStart);
    if (headerEnd === -1 || headerEnd > nextPartStart) {
      cursor = nextPartStart;
      continue;
    }

    const headerText = body.slice(contentStart, headerEnd).toString("utf8");
    let content = body.slice(headerEnd + 4, nextPartStart);
    if (content.slice(-2).toString() === "\r\n") content = content.slice(0, -2);

    const disposition = headerText.match(/content-disposition:\s*form-data;([^\r\n]+)/i)?.[1] || "";
    const name = disposition.match(/name="([^"]+)"/i)?.[1] || "";
    const filename = disposition.match(/filename="([^"]*)"/i)?.[1] || "";
    const partContentType = headerText.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || "";

    if (filename) {
      files.push({ fieldName: name, filename, contentType: partContentType, buffer: content });
    } else if (name) {
      fields[name] = content.toString("utf8");
    }

    cursor = nextPartStart;
  }

  return { fields, files };
};

const mapContactRow = (row) => ({
  id: row.id,
  name: row.name,
  title: row.title,
  phone: row.phone,
  email: row.email,
  primary: row.is_primary,
});

const mapCustomerRow = (row, contacts = []) => ({
  id: row.id,
  company: row.name,
  businessNumber: row.business_registration_number,
  ceoName: row.ceo_name,
  businessType: row.business_type,
  businessItem: row.business_item,
  address: row.business_address,
  memo: "",
  contacts,
  aiAnalysis: row.ai_analysis || "",
  aiAnalysisSourceSnapshot: normalizeMetadata(row.ai_analysis_source_snapshot),
  submissionSummary: normalizeMetadata(row.submission_summary),
});

const mapRequestTemplateRow = (row) => ({
  id: row.id,
  code: row.code,
  name: row.name,
  serviceArea: row.service_area,
  description: row.description || "",
  sortOrder: Number(row.sort_order || 0),
  documentCodes: Array.isArray(row.document_codes) ? row.document_codes.filter(Boolean) : [],
});

const mapDocumentTypeRow = (row) => ({
  id: row.id,
  code: row.code,
  name: row.name,
  sortOrder: Number(row.sort_order || 0),
  requiredFieldLabels: Array.isArray(row.required_field_labels)
    ? row.required_field_labels.filter(Boolean)
    : [],
});

const readAppSetting = async (key, fallback = {}) => {
  try {
    const { rows } = await pool.query("SELECT value FROM app_settings WHERE key = $1", [key]);
    return normalizeMetadata(rows[0]?.value) || fallback;
  } catch {
    return fallback;
  }
};

const fetchShellRuntime = async () => {
  const brand = await readAppSetting("shell.brand", {
    eyebrow: "AuditMind",
    title: "자료 검토 콘솔",
    firmName: "AuditMind 파트너스",
    userName: "데모 계정",
    logoImage: "/brand/auditmind-logo.png",
    logoAlt: "AuditMind",
  });
  const { rows } = await pool.query(`
    SELECT id, type, title, detail, kind, received_at
    FROM accountant_notifications
    ORDER BY received_at DESC
    LIMIT 30
  `);
  return {
    brand,
    notifications: rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      detail: row.detail,
      kind: row.kind,
      receivedAt: row.received_at,
    })),
  };
};

const mapReviewStatus = (status) => {
  if (status === "approved") return { status: "검수완료", tone: "success" };
  if (status === "submitted") return { status: "접수완료", tone: "success" };
  if (status === "rejected") return { status: "미제출", tone: "neutral" };
  if (status === "not_received") return { status: "미제출", tone: "neutral" };
  return { status: "검토 필요", tone: "warning" };
};

const mapUiReviewStatusToDb = (status) => {
  if (status === "approved" || status === "검수완료") return "approved";
  if (status === "submitted" || status === "접수완료" || status === "최종 접수") return "submitted";
  if (status === "rejected" || status === "오류" || status === "재요청") return "rejected";
  if (status === "not_received" || status === "미접수") return "not_received";
  return "processing";
};

const normalizeMetadata = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});
const normalizeRawOutput = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

const normalizeReviewSourceRegion = (value) => {
  if (!value || typeof value !== "object") return null;
  const regionSource = Array.isArray(value.bbox) && !value.sourceRegion ? value.bbox : value.sourceRegion || value.region || value;
  if (Array.isArray(regionSource)) {
    const [x, y, width, height] = regionSource.map((part) => Number(part));
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
    return { page: 1, x, y, width, height };
  }

  const x = Number(regionSource.x ?? regionSource.left);
  const y = Number(regionSource.y ?? regionSource.top);
  const width = Number(regionSource.width ?? regionSource.w);
  const height = Number(regionSource.height ?? regionSource.h);
  const page = Number(regionSource.page || 1);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  return {
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    x: Math.max(0, Math.min(100, x)),
    y: Math.max(0, Math.min(100, y)),
    width: Math.max(0, Math.min(100, width)),
    height: Math.max(0, Math.min(100, height)),
  };
};

const normalizeReviewFields = (rawOutput) => {
  const sourceFields = Array.isArray(rawOutput.fields)
    ? rawOutput.fields
    : Array.isArray(rawOutput.rawJudgment?.fields)
      ? rawOutput.rawJudgment.fields
      : [];

  return sourceFields
    .map((field) => {
      const label = String(field?.label || "").trim();
      if (!label) return null;
      const normalized = {
        label,
        value: String(field?.value || "").trim(),
        confidence: ["높음", "중간", "낮음", "미확인"].includes(field?.confidence) ? field.confidence : "미확인",
      };
      const sourceRegion = normalizeReviewSourceRegion(field?.sourceRegion || field?.region || field?.bbox);
      if (sourceRegion) normalized.sourceRegion = sourceRegion;
      return normalized;
    })
    .filter(Boolean);
};

const sha256Hex = (value) => crypto.createHash("sha256").update(value).digest("hex");

const generateSubmissionToken = () => crypto.randomBytes(32).toString("base64url");

const toStableCode = (value, fallbackPrefix = "custom") => {
  const base = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return `${base || fallbackPrefix}_${Date.now().toString(36)}`;
};

const toFieldKey = (label, index) => {
  const normalized = String(label || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return normalized || `required_item_${index + 1}`;
};

const sanitizeFilename = (filename) =>
  path
    .basename(String(filename || "upload.bin"))
    .replace(/[^\p{L}\p{N}._ -]+/gu, "_")
    .replace(/\s+/g, "_")
    .slice(0, 180) || "upload.bin";

const getFileExtension = (filename) => {
  const extension = path.extname(filename || "").replace(/^\./, "").toLowerCase();
  return extension || "bin";
};

const acceptedUploadExtensions = new Set([
  "pdf",
  "xls",
  "xlsx",
  "xlsm",
  "csv",
  "tsv",
  "doc",
  "docx",
  "hwp",
  "hwpx",
  "jpg",
  "jpeg",
  "png",
  "heic",
  "heif",
  "webp",
  "tiff",
  "tif",
  "zip",
]);

const executableUploadExtensions = new Set(["app", "bat", "cmd", "com", "dll", "dmg", "exe", "js", "msi", "ps1", "scr", "sh"]);
const businessLicenseUploadExtensions = new Set(["pdf", "jpg", "jpeg", "png", "heic", "heif", "webp"]);

const assertSupportedUploadFile = (file) => {
  const filename = sanitizeFilename(file.filename);
  const extension = getFileExtension(filename);
  if (executableUploadExtensions.has(extension)) {
    const error = new Error("실행 파일은 업로드할 수 없습니다.");
    error.status = 400;
    throw error;
  }
  if (!acceptedUploadExtensions.has(extension)) {
    const error = new Error("지원하지 않는 파일 형식입니다.");
    error.status = 400;
    throw error;
  }
  if ((file.buffer?.length || 0) > maxUploadFileBytes) {
    const error = new Error("파일 용량 제한을 초과했습니다.");
    error.status = 400;
    throw error;
  }
  return { filename, extension };
};

const assertSupportedBusinessLicenseFile = (file) => {
  const { filename, extension } = assertSupportedUploadFile(file);
  if (!businessLicenseUploadExtensions.has(extension)) {
    const error = new Error("사업자등록증은 PDF, JPG, PNG, HEIF, WEBP 파일만 업로드할 수 있습니다.");
    error.status = 400;
    throw error;
  }
  return { filename, extension };
};

const extensionToMimeType = (extension) => {
  const map = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    tif: "image/tiff",
    tiff: "image/tiff",
    heic: "image/heic",
    heif: "image/heif",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    hwp: "application/x-hwp",
    hwpx: "application/hwp+zip",
    zip: "application/zip",
  };
  return map[extension] || "application/octet-stream";
};

const parseProcessorJson = (stdout) => {
  try {
    return JSON.parse(stdout || "{}");
  } catch {
    const error = new Error("파일 전처리 결과를 읽지 못했습니다.");
    error.status = 400;
    throw error;
  }
};

const runUploadProcessor = async (filePath, extractDir = "") => {
  const args = [fileProcessorPath, filePath];
  if (extractDir) args.push("--extract-dir", extractDir);
  try {
    const { stdout } = await execFileAsync(pythonCommand, args, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 90_000,
    });
    return parseProcessorJson(stdout);
  } catch (error) {
    const wrapped = new Error(`파일 전처리에 실패했습니다: ${error.message || "processor_failed"}`);
    wrapped.status = 400;
    throw wrapped;
  }
};

const assertProcessorAccepted = (record) => {
  if (record?.status !== "rejected") return;
  const error = new Error(record.error?.message || "처리할 수 없는 파일입니다.");
  error.status = 400;
  throw error;
};

const flattenProcessableRecords = (record) => {
  if (record?.status === "expanded") {
    return (record.children || []).flatMap((child) => flattenProcessableRecords(child));
  }
  return [record].filter(Boolean);
};

const buildOcrTextFromProcessorRecord = (record) => {
  const parts = [];
  if (record?.text) parts.push(record.text);
  if (Array.isArray(record?.sheets) && record.sheets.length) parts.push(`시트: ${record.sheets.join(", ")}`);
  if (Array.isArray(record?.tables)) {
    for (const table of record.tables.slice(0, 4)) {
      if (Array.isArray(table.headers) && table.headers.length) parts.push(`표 헤더: ${table.headers.join("\t")}`);
      if (Array.isArray(table.rows)) {
        parts.push(...table.rows.slice(0, 8).map((row) => (Array.isArray(row) ? row.join("\t") : String(row || ""))));
      }
    }
  }
  return parts.filter(Boolean).join("\n").slice(0, 20_000);
};

const dbStatusToCustomerTone = (status) => {
  if (status === "approved") return { status: "검수완료", statusTone: "success" };
  if (status === "submitted") return { status: "접수완료", statusTone: "submitted" };
  if (status === "rejected") return { status: "오류", statusTone: "danger" };
  if (status === "processing") return { status: "분석 중", statusTone: "processing" };
  return { status: "미접수", statusTone: "neutral" };
};

const getItemReviewMessage = (row) => {
  if (row.review_message) return row.review_message;
  if (row.status === "approved") return "AI 검수 완료율 100%입니다. 제출 기준에 맞게 첨부되었습니다.";
  if (row.status === "submitted") return "최종 접수가 완료되었습니다.";
  if (row.status === "rejected") return "오류 사유를 확인한 뒤 파일을 다시 업로드해 주세요.";
  if (row.status === "processing") return "AI가 문서를 분석 중입니다.";
  return "아직 접수되지 않았습니다. 자료를 찾아 업로드해 주세요.";
};

const normalizeDateString = (value) => {
  if (!value) return "";
  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
};

const formatKoreanDate = (value) => {
  const dateString = normalizeDateString(value);
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-").map((part) => Number(part));
  if (!year || !month || !day) return dateString;
  return `${year}년 ${month}월 ${day}일`;
};

const getUploadedFilePath = (storageKey = "") => {
  const relativePath = String(storageKey || "").replace(/^\/?uploads\/?/, "");
  return path.join(uploadRoot, relativePath);
};

const uploadedFileExists = async (row) => {
  if (!row.file_id) return false;
  const metadata = normalizeMetadata(row.file_metadata);
  if (metadata.fileUrl && !String(metadata.fileUrl).startsWith("/api/submission-files/")) return true;
  try {
    await fs.access(getUploadedFilePath(row.storage_key));
    return true;
  } catch {
    return false;
  }
};

const mapReviewRow = (row, fileAvailable = true) => {
  const metadata = normalizeMetadata(row.file_metadata);
  const rawOutput = normalizeRawOutput(row.raw_output);
  const status = mapReviewStatus(row.item_status);
  const isAccountantMissing = row.item_status === "not_received" || row.item_status === "rejected";
  const canShowFile = !isAccountantMissing && fileAvailable;
  const confidencePercent = Math.round(Number(row.confidence || 0) * 100);

  return {
    id: row.item_id,
    company: row.customer_name,
    serviceName: row.request_title,
    documentName: row.requested_name,
    fileName: isAccountantMissing ? "" : row.original_filename || row.requested_name,
    fileType: isAccountantMissing ? "" : row.file_extension || "pdf",
    renderMode: canShowFile ? metadata.renderMode || "" : "",
    fileUrl: canShowFile ? metadata.fileUrl || (row.file_id ? `/api/submission-files/${row.file_id}` : "") : "",
    pageCount: canShowFile ? metadata.pageCount || 1 : 0,
    evidencePage: canShowFile ? metadata.evidencePage || 1 : 0,
    pageTitle: canShowFile ? metadata.pageTitle || row.requested_name : "",
    pageSubtitle: canShowFile ? metadata.pageSubtitle || "" : "",
    status: status.status,
    tone: status.tone,
    confidence: isAccountantMissing ? "-" : `${confidencePercent}%`,
    receivedAt: isAccountantMissing ? "" : row.uploaded_at_label || "",
    requestedAt: row.requested_at_label || "",
    deadline: row.due_date_label || "",
    aiJudgment: isAccountantMissing ? "" : row.review_message || "",
    reason: isAccountantMissing ? "" : row.reason || "",
    evidence: isAccountantMissing
      ? ""
      : Array.isArray(row.evidence)
        ? row.evidence.map((entry) => entry.reason || entry.text || "").filter(Boolean).join(", ")
        : "",
    fields: isAccountantMissing ? [] : normalizeReviewFields(rawOutput),
    internalMemo: row.internal_memo || "",
    customerComment: row.customer_comment || "",
    customerRequestMessage: row.customer_request_message || "",
    customerRequestStatus: row.customer_request_status || "draft",
    processingResultPath: row.processing_result_path || "",
  };
};

const fetchCustomers = async () => {
  const { rows: customerRows } = await pool.query(`
    SELECT
      c.id,
      c.name,
      c.business_registration_number,
      c.ceo_name,
      c.business_type,
      c.business_item,
      c.business_address,
      COALESCE(caa.analysis_text, '') AS ai_analysis,
      caa.source_snapshot AS ai_analysis_source_snapshot
    FROM customers c
    LEFT JOIN customer_ai_analyses caa ON caa.customer_id = c.id
    ORDER BY c.created_at ASC, c.name ASC
  `);
  const { rows: contactRows } = await pool.query(`
    SELECT id, customer_id, name, title, phone, email, is_primary
    FROM customer_contacts
    ORDER BY is_primary DESC, name ASC
  `);
  const contactsByCustomerId = new Map();
  for (const row of contactRows) {
    const contacts = contactsByCustomerId.get(row.customer_id) || [];
    contacts.push(mapContactRow(row));
    contactsByCustomerId.set(row.customer_id, contacts);
  }

  const { rows: summaryRows } = await pool.query(`
    SELECT
      c.id AS customer_id,
      jsonb_build_object(
        'requestCount', COUNT(DISTINCT csr.id)::int,
        'openRequestCount', COUNT(DISTINCT csr.id) FILTER (WHERE csr.status = 'open')::int,
        'requestedItemCount', COUNT(csi.id)::int,
        'acceptedItemCount', COUNT(csi.id) FILTER (WHERE csi.status IN ('approved', 'submitted'))::int,
        'finalSubmittedItemCount', COUNT(csi.id) FILTER (WHERE csi.status = 'submitted')::int,
        'failedItemCount', COUNT(csi.id) FILTER (WHERE csi.status = 'rejected')::int,
        'processingItemCount', COUNT(csi.id) FILTER (WHERE csi.status = 'processing')::int,
        'missingItemCount', COUNT(csi.id) FILTER (WHERE csi.status = 'not_received')::int,
        'recentRequests', COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'title', recent.request_title,
                'createdAt', to_char(recent.created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI'),
                'dueDate', COALESCE(to_char(recent.due_date, 'YYYY-MM-DD'), ''),
                'status', recent.status,
                'total', recent.total_count,
                'accepted', recent.accepted_count,
                'failed', recent.failed_count,
                'missing', recent.missing_count
              )
              ORDER BY recent.created_at DESC
            )
            FROM (
              SELECT
                csr_recent.id,
                csr_recent.request_title,
                csr_recent.created_at,
                csr_recent.due_date,
                csr_recent.status,
                COUNT(csi_recent.id)::int AS total_count,
                COUNT(csi_recent.id) FILTER (WHERE csi_recent.status IN ('approved', 'submitted'))::int AS accepted_count,
                COUNT(csi_recent.id) FILTER (WHERE csi_recent.status = 'rejected')::int AS failed_count,
                COUNT(csi_recent.id) FILTER (WHERE csi_recent.status = 'not_received')::int AS missing_count
              FROM customer_submission_requests csr_recent
              LEFT JOIN customer_submission_items csi_recent ON csi_recent.request_id = csr_recent.id
              WHERE csr_recent.customer_name = c.name
              GROUP BY csr_recent.id
              ORDER BY csr_recent.created_at DESC
              LIMIT 3
            ) recent
          ),
          '[]'::jsonb
        ),
        'recentFailedItems', COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'requestTitle', failed.request_title,
                'documentName', failed.requested_name,
                'message', COALESCE(failed.review_message, '')
              )
              ORDER BY failed.updated_at DESC
            )
            FROM (
              SELECT csr_failed.request_title, csi_failed.requested_name, csi_failed.review_message, csi_failed.updated_at
              FROM customer_submission_requests csr_failed
              JOIN customer_submission_items csi_failed ON csi_failed.request_id = csr_failed.id
              WHERE csr_failed.customer_name = c.name
                AND csi_failed.status = 'rejected'
              ORDER BY csi_failed.updated_at DESC
              LIMIT 5
            ) failed
          ),
          '[]'::jsonb
        )
      ) AS submission_summary
    FROM customers c
    LEFT JOIN customer_submission_requests csr ON csr.customer_name = c.name
    LEFT JOIN customer_submission_items csi ON csi.request_id = csr.id
    GROUP BY c.id, c.name
  `);
  const summariesByCustomerId = new Map(summaryRows.map((row) => [row.customer_id, row.submission_summary || {}]));

  return customerRows.map((row) =>
    mapCustomerRow(
      {
        ...row,
        submission_summary: summariesByCustomerId.get(row.id) || {},
      },
      contactsByCustomerId.get(row.id) || [],
    ),
  );
};

const deriveReviewStatusLabel = (row) => {
  const rawOutput = normalizeRawOutput(row.raw_output);
  const fields = normalizeReviewFields(rawOutput);
  const hasWeakField = fields.some((field) => ["낮음", "미확인"].includes(field.confidence));
  const confidence = Number(row.confidence || 0);
  return hasWeakField || confidence < 0.82 ? "검토 주의" : "검토 대기";
};

const fetchDashboardRuntime = async () => {
  const dueSetting = await readAppSetting("dashboard.due_alert", { alertDays: 5 });
  const alertDays = Math.max(1, Math.min(30, Number(dueSetting.alertDays || 5)));
  const { rows: queueRows } = await pool.query(`
    SELECT
      csr.customer_name,
      csr.request_title,
      csr.due_date,
      csi.requested_name,
      csi.status,
      uf.uploaded_at,
      dcr.confidence,
      dcr.raw_output
    FROM customer_submission_items csi
    JOIN customer_submission_requests csr ON csr.id = csi.request_id
    LEFT JOIN LATERAL (
      SELECT uploaded_at
      FROM uploaded_files uf
      WHERE uf.submission_item_id = csi.id
      ORDER BY uploaded_at DESC
      LIMIT 1
    ) uf ON true
    LEFT JOIN LATERAL (
      SELECT confidence, raw_output
      FROM document_classification_results dcr
      WHERE dcr.matched_submission_item_id = csi.id
      ORDER BY created_at DESC
      LIMIT 1
    ) dcr ON true
    WHERE csi.status IN ('approved', 'submitted')
    ORDER BY COALESCE(uf.uploaded_at, csi.updated_at) DESC
    LIMIT 50
  `);

  const { rows: dueRows } = await pool.query(
    `
      SELECT csr.customer_name
      FROM customer_submission_requests csr
      WHERE csr.status = 'open'
        AND csr.due_date IS NOT NULL
        AND csr.due_date <= (CURRENT_DATE + ($1::int * INTERVAL '1 day'))::date
        AND EXISTS (
          SELECT 1
          FROM customer_submission_items csi
          WHERE csi.request_id = csr.id
            AND csi.status IN ('not_received', 'processing', 'rejected')
        )
      GROUP BY csr.customer_name
      ORDER BY csr.customer_name ASC
    `,
    [alertDays],
  );

  const { rows: requestRows } = await pool.query(`
    SELECT csr.customer_name
    FROM customer_submission_requests csr
    WHERE csr.customer_request_status = 'submitted'
    GROUP BY csr.customer_name
    ORDER BY csr.customer_name ASC
  `);

  const midnightKstQuery = `
    COALESCE(uf.uploaded_at, csi.updated_at) >= (
      date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'
    )
  `;
  const { rows: newRows } = await pool.query(`
    SELECT COUNT(*)::int AS count
    FROM customer_submission_items csi
    JOIN customer_submission_requests csr ON csr.id = csi.request_id
    LEFT JOIN LATERAL (
      SELECT uploaded_at
      FROM uploaded_files uf
      WHERE uf.submission_item_id = csi.id
      ORDER BY uploaded_at DESC
      LIMIT 1
    ) uf ON true
    WHERE csi.status IN ('approved', 'submitted')
      AND ${midnightKstQuery}
  `);

  const queue = queueRows.map((row) => {
    const receivedAt = row.uploaded_at || new Date().toISOString();
    const dueDate = row.due_date ? normalizeDateString(row.due_date) : "";
    return {
      company: row.customer_name,
      request: row.request_title,
      document: row.requested_name,
      status: deriveReviewStatusLabel(row),
      deadline: dueDate || "-",
      deadlineSort: dueDate ? `${dueDate}T18:00:00+09:00` : "2999-12-31T00:00:00+09:00",
      receivedAt,
    };
  });

  const queueCustomers = [...new Set(queue.map((item) => item.company))];
  const dueCustomers = dueRows.map((row) => row.customer_name);
  const requestCustomers = requestRows.map((row) => row.customer_name);

  return {
    summary: [
      {
        label: "검토 대기 자료",
        value: String(queue.length),
        helper: `신규 ${Number(newRows[0]?.count || 0)}건`,
        hoverTitle: "신규 제출 고객사",
        customers: queueCustomers,
        tone: "primary",
      },
      {
        label: "자료 미제출 고객사",
        value: String(dueCustomers.length),
        alertDays,
        dueCustomers,
        tone: "warning",
      },
      {
        label: "고객사 요청사항",
        value: String(requestCustomers.length),
        helper: `신규 ${requestCustomers.length}건`,
        hoverTitle: "요청사항 입력 고객사",
        customers: requestCustomers,
        tone: "danger",
      },
    ],
    queue,
  };
};

const fetchReviewItems = async () => {
  const { rows } = await pool.query(`
    SELECT
      csi.id AS item_id,
      csi.requested_name,
      csi.status AS item_status,
      csi.review_message,
      csi.internal_memo,
      csi.customer_comment,
      csr.customer_name,
      csr.request_title,
      csr.customer_request_message,
      csr.customer_request_status,
      COALESCE(to_char(csr.created_at, 'YYYY-MM-DD'), '') AS requested_at_label,
      COALESCE(to_char(csr.due_date, 'YYYY-MM-DD'), '') AS due_date_label,
      uf.id AS file_id,
      uf.original_filename,
      uf.file_extension,
      uf.storage_key,
      uf.uploaded_at::text AS uploaded_at_label,
      uf.metadata AS file_metadata,
      dcr.confidence,
      dcr.reason,
      dcr.evidence,
      dcr.raw_output,
      COALESCE(dcr.raw_output->>'processingResultPath', '') AS processing_result_path
    FROM customer_submission_items csi
    JOIN customer_submission_requests csr ON csr.id = csi.request_id
    LEFT JOIN LATERAL (
      SELECT *
      FROM uploaded_files uf
      WHERE uf.submission_item_id = csi.id
      ORDER BY uf.uploaded_at DESC
      LIMIT 1
    ) uf ON true
    LEFT JOIN LATERAL (
      SELECT *
      FROM document_classification_results dcr
      WHERE dcr.matched_submission_item_id = csi.id
      ORDER BY dcr.created_at DESC
      LIMIT 1
    ) dcr ON true
    WHERE csi.status IN ('not_received', 'processing', 'approved', 'submitted', 'rejected')
    ORDER BY csi.sort_order ASC, csr.customer_name ASC, csr.request_title ASC, csi.created_at ASC
  `);
  return Promise.all(rows.map(async (row) => mapReviewRow(row, await uploadedFileExists(row))));
};

const fetchRequestTemplateWorkspace = async () => {
  const { rows: templateRows } = await pool.query(`
    SELECT
      rt.id,
      rt.code,
      rt.name,
      rt.service_area,
      rt.description,
      rt.sort_order,
      COALESCE(
        array_agg(dt.code ORDER BY rtd.sort_order ASC, dt.name ASC) FILTER (WHERE dt.code IS NOT NULL),
        ARRAY[]::text[]
      ) AS document_codes
    FROM request_templates rt
    LEFT JOIN request_template_documents rtd ON rtd.request_template_id = rt.id
    LEFT JOIN document_types dt ON dt.id = rtd.document_type_id
    WHERE rt.is_active = true
    GROUP BY rt.id
    ORDER BY rt.sort_order ASC, rt.name ASC
  `);

  const { rows: documentRows } = await pool.query(`
    SELECT
      dt.id,
      dt.code,
      dt.name,
      dt.sort_order,
      dc.sort_order AS category_sort_order,
      COALESCE(
        array_agg(dtrf.field_label ORDER BY dtrf.sort_order ASC, dtrf.field_label ASC)
          FILTER (WHERE dtrf.is_required = true AND dtrf.field_label IS NOT NULL),
        ARRAY[]::text[]
      ) AS required_field_labels
    FROM document_types dt
    JOIN document_categories dc ON dc.id = dt.category_id
    LEFT JOIN document_type_required_fields dtrf ON dtrf.document_type_id = dt.id
    WHERE dt.is_active = true
    GROUP BY dt.id, dc.sort_order
    ORDER BY dc.sort_order ASC, dt.sort_order ASC, dt.name ASC
  `);

  return {
    templates: templateRows.map(mapRequestTemplateRow),
    documents: documentRows.map(mapDocumentTypeRow),
  };
};

const replaceRequestTemplateDocuments = async (client, templateId, documentCodes) => {
  const uniqueDocumentCodes = [...new Set((documentCodes || []).map((code) => String(code || "").trim()).filter(Boolean))];
  await client.query("DELETE FROM request_template_documents WHERE request_template_id = $1", [templateId]);
  if (!uniqueDocumentCodes.length) return;

  await client.query(
    `
      INSERT INTO request_template_documents (
        request_template_id,
        document_type_id,
        is_default,
        is_required_default,
        sort_order
      )
      SELECT
        $1,
        dt.id,
        true,
        false,
        selected.sort_order
      FROM unnest($2::text[]) WITH ORDINALITY AS selected(code, sort_order)
      JOIN document_types dt ON dt.code = selected.code
      ON CONFLICT (request_template_id, document_type_id)
      DO UPDATE SET
        sort_order = EXCLUDED.sort_order,
        updated_at = now()
    `,
    [templateId, uniqueDocumentCodes],
  );
};

const createRequestTemplate = async (payload) => {
  const name = String(payload.name || "").trim();
  if (!name) {
    const error = new Error("서비스명을 입력해 주세요.");
    error.status = 400;
    throw error;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `
        INSERT INTO request_templates (
          code,
          name,
          service_area,
          description,
          sort_order
        )
        VALUES ($1, $2, $3, $4, COALESCE((SELECT MAX(sort_order) + 1 FROM request_templates), 1))
        RETURNING id
      `,
      [
        toStableCode(name, "service"),
        name,
        String(payload.serviceArea || "").trim(),
        String(payload.description || "").trim(),
      ],
    );
    await replaceRequestTemplateDocuments(client, rows[0].id, payload.documentCodes || []);
    await client.query("COMMIT");
    return (await fetchRequestTemplateWorkspace()).templates.find((template) => template.id === rows[0].id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const updateRequestTemplate = async (templateCode, payload) => {
  const name = String(payload.name || "").trim();
  if (!name) {
    const error = new Error("서비스명을 입력해 주세요.");
    error.status = 400;
    throw error;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `
        UPDATE request_templates
        SET
          name = $2,
          service_area = $3,
          description = $4,
          updated_at = now()
        WHERE code = $1
        RETURNING id
      `,
      [
        templateCode,
        name,
        String(payload.serviceArea || "").trim(),
        String(payload.description || "").trim(),
      ],
    );
    if (!rows[0]) {
      const error = new Error("서비스를 찾을 수 없습니다.");
      error.status = 404;
      throw error;
    }
    if (Array.isArray(payload.documentCodes)) {
      await replaceRequestTemplateDocuments(client, rows[0].id, payload.documentCodes);
    }
    await client.query("COMMIT");
    return (await fetchRequestTemplateWorkspace()).templates.find((template) => template.id === rows[0].id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const deleteRequestTemplate = async (templateCode) => {
  const result = await pool.query("DELETE FROM request_templates WHERE code = $1", [templateCode]);
  if (!result.rowCount) {
    const error = new Error("서비스를 찾을 수 없습니다.");
    error.status = 404;
    throw error;
  }
};

const updateDocumentTypeRequiredFields = async (documentCode, payload) => {
  const labels = [...new Set((payload.labels || []).map((label) => String(label || "").trim()).filter(Boolean))];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT id FROM document_types WHERE code = $1", [documentCode]);
    if (!rows[0]) {
      const error = new Error("자료를 찾을 수 없습니다.");
      error.status = 404;
      throw error;
    }
    const documentTypeId = rows[0].id;
    await client.query("DELETE FROM document_type_required_fields WHERE document_type_id = $1 AND is_required = true", [
      documentTypeId,
    ]);
    for (const [index, label] of labels.entries()) {
      await client.query(
        `
          INSERT INTO document_type_required_fields (
            document_type_id,
            field_key,
            field_label,
            value_type,
            is_required,
            extraction_hint,
            sort_order
          )
          VALUES ($1, $2, $3, 'text', true, '', $4)
          ON CONFLICT (document_type_id, field_key)
          DO UPDATE SET
            field_label = EXCLUDED.field_label,
            is_required = true,
            sort_order = EXCLUDED.sort_order,
            updated_at = now()
        `,
        [documentTypeId, toFieldKey(label, index), label, (index + 1) * 10],
      );
    }
    await client.query("COMMIT");
    return (await fetchRequestTemplateWorkspace()).documents.find((document) => document.code === documentCode);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const resolveSubmissionToken = async (rawToken) => {
  const tokenHash = sha256Hex(rawToken || "");
  const { rows } = await pool.query(
    `
      UPDATE customer_submission_access_tokens
      SET last_accessed_at = now(), access_count = access_count + 1, updated_at = now()
      WHERE token_hash = $1
        AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > now())
      RETURNING request_id
    `,
    [tokenHash],
  );

  if (!rows[0]) {
    const error = new Error("접근할 수 없는 제출 페이지입니다.");
    error.status = 404;
    throw error;
  }

  return rows[0].request_id;
};

const fetchPortalRequestByToken = async (rawToken) => {
  const requestId = await resolveSubmissionToken(rawToken);
  const { rows: requestRows } = await pool.query(
    `
      SELECT
        id,
        customer_name,
        request_title,
        request_period,
        due_date,
        COALESCE(to_char(due_date, 'YYYY-MM-DD'), '') AS due_date_label,
        created_at,
        status,
        customer_request_message,
        customer_request_status
      FROM customer_submission_requests
      WHERE id = $1
    `,
    [requestId],
  );

  if (!requestRows[0]) {
    const error = new Error("요청서를 찾을 수 없습니다.");
    error.status = 404;
    throw error;
  }

  const { rows: itemRows } = await pool.query(
    `
      SELECT
        csi.id,
        csi.requested_name,
        csi.status,
        csi.review_message,
        csi.customer_comment,
        csi.sort_order,
        uf.id AS file_id,
        uf.original_filename,
        uf.storage_key,
        uf.uploaded_at,
        dcr.confidence
      FROM customer_submission_items csi
      LEFT JOIN LATERAL (
        SELECT *
        FROM uploaded_files uf
        WHERE uf.submission_item_id = csi.id
        ORDER BY uf.uploaded_at DESC
        LIMIT 1
      ) uf ON true
      LEFT JOIN LATERAL (
        SELECT *
        FROM document_classification_results dcr
        WHERE dcr.matched_submission_item_id = csi.id
        ORDER BY dcr.created_at DESC
        LIMIT 1
      ) dcr ON true
      WHERE csi.request_id = $1
      ORDER BY csi.sort_order ASC, csi.created_at ASC
    `,
    [requestId],
  );

  const request = requestRows[0];
  const total = itemRows.length;
  const readyCount = itemRows.filter((item) => item.status === "approved" || item.status === "submitted").length;
  const progress = total ? Math.round((readyCount / total) * 100) : 0;
  const today = new Date();
  const dueDateString = request.due_date_label || normalizeDateString(request.due_date);
  const dueDate = dueDateString ? new Date(`${dueDateString}T00:00:00+09:00`) : null;
  const createdAt = request.created_at ? new Date(request.created_at) : null;
  const remainingDays = dueDate ? Math.max(0, Math.ceil((dueDate.getTime() - today.getTime()) / 86_400_000)) : null;
  const totalDeadlineMs = dueDate && createdAt ? Math.max(1, dueDate.getTime() - createdAt.getTime()) : null;
  const elapsedDeadlineMs = createdAt ? Math.max(0, today.getTime() - createdAt.getTime()) : null;
  const deadlinePercent =
    totalDeadlineMs && elapsedDeadlineMs !== null
      ? Math.min(100, Math.max(0, Math.round((elapsedDeadlineMs / totalDeadlineMs) * 100)))
      : 0;

  return {
    request: {
      id: request.id,
      customerName: request.customer_name,
      title: request.request_title,
      period: request.request_period,
      dueDate: formatKoreanDate(dueDateString),
      progressValue: `${progress}%`,
      progressDetail: `총 ${total}개 자료 중 ${readyCount}개 접수 완료`,
      deadlineDetail: remainingDays === null ? "" : `마감까지 ${remainingDays}일 남았습니다.`,
      deadlinePercent: `${deadlinePercent}%`,
      customerRequestMessage: request.customer_request_message || "",
      customerRequestStatus: request.customer_request_status || "draft",
    },
    items: itemRows.map((row) => {
      const status = dbStatusToCustomerTone(row.status);
      const attachment = row.original_filename
        ? {
            name: row.original_filename,
            submittedAt: row.uploaded_at
              ? new Date(row.uploaded_at).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
              : "첨부 완료",
            href: row.file_id ? `/api/submission-files/${row.file_id}` : "",
          }
        : null;

      return {
        id: row.id,
        ...status,
        title: row.requested_name,
        reviewMessage: getItemReviewMessage(row),
        accountantComment: row.customer_comment || "",
        attachment,
        action: "파일 업로드",
        primaryAction: row.status === "not_received" || row.status === "rejected",
      };
    }),
  };
};

const addDaysKstDateString = (days) => {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kst.setUTCDate(kst.getUTCDate() + days);
  return kst.toISOString().slice(0, 10);
};

const createSubmissionRequests = async (payload = {}) => {
  const customerIds = [...new Set((payload.customerIds || []).map((id) => String(id || "").trim()).filter(Boolean))];
  const contactIds = [...new Set((payload.contactIds || []).map((id) => String(id || "").trim()).filter(Boolean))];
  const templateCodes = [...new Set((payload.templateCodes || []).map((code) => String(code || "").trim()).filter(Boolean))];
  const documentCodes = [...new Set((payload.documentCodes || []).map((code) => String(code || "").trim()).filter(Boolean))];
  const sendMethods = [...new Set((payload.sendMethods || []).map((method) => String(method || "").trim()).filter(Boolean))];
  const dueDate = normalizeDateString(payload.dueDate) || addDaysKstDateString(7);

  if (!customerIds.length) {
    const error = new Error("고객사를 선택해 주세요.");
    error.status = 400;
    throw error;
  }
  if (!documentCodes.length) {
    const error = new Error("요청 자료를 선택해 주세요.");
    error.status = 400;
    throw error;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: customers } = await client.query(
      `
        SELECT
          c.id,
          c.name
        FROM customers c
        WHERE c.id = ANY($1::uuid[])
        ORDER BY array_position($1::uuid[], c.id)
      `,
      [customerIds],
    );

    if (customers.length !== customerIds.length) {
      const error = new Error("선택한 고객사를 찾을 수 없습니다.");
      error.status = 400;
      throw error;
    }

    const { rows: contactRows } = contactIds.length
      ? await client.query(
          `
            SELECT id, customer_id, name, email, phone, is_primary
            FROM customer_contacts
            WHERE customer_id = ANY($1::uuid[]) AND id = ANY($2::uuid[])
            ORDER BY array_position($2::uuid[], id)
          `,
          [customerIds, contactIds],
        )
      : await client.query(
          `
            SELECT DISTINCT ON (customer_id) id, customer_id, name, email, phone, is_primary
            FROM customer_contacts
            WHERE customer_id = ANY($1::uuid[])
            ORDER BY customer_id, is_primary DESC, name ASC
          `,
          [customerIds],
        );

    const contactsByCustomerId = new Map();
    for (const contact of contactRows) {
      const contacts = contactsByCustomerId.get(contact.customer_id) || [];
      contacts.push(contact);
      contactsByCustomerId.set(contact.customer_id, contacts);
    }

    const missingRecipientCustomer = customers.find((customer) => !(contactsByCustomerId.get(customer.id) || []).length);
    if (missingRecipientCustomer) {
      const error = new Error(`${missingRecipientCustomer.name}의 발송 담당자를 선택해 주세요.`);
      error.status = 400;
      throw error;
    }

    const { rows: templates } = templateCodes.length
      ? await client.query(
          `
            SELECT id, code, name
            FROM request_templates
            WHERE code = ANY($1::text[]) AND is_active = true
            ORDER BY array_position($1::text[], code)
          `,
          [templateCodes],
        )
      : { rows: [] };

    const { rows: documents } = await client.query(
      `
        SELECT id, code, name
        FROM document_types
        WHERE code = ANY($1::text[]) AND is_active = true
        ORDER BY array_position($1::text[], code)
      `,
      [documentCodes],
    );

    if (!documents.length) {
      const error = new Error("요청 자료를 찾을 수 없습니다.");
      error.status = 400;
      throw error;
    }

    const serviceNames = templates.map((template) => template.name);
    const requestTitle = serviceNames.length ? `${serviceNames.join(", ")} 자료 제출 요청` : "자료 제출 요청";
    const requestPeriod = String(payload.requestPeriod || "").trim();
    const createdRequests = [];

    for (const customer of customers) {
      const { rows: requestRows } = await client.query(
        `
          INSERT INTO customer_submission_requests (
            customer_name,
            request_title,
            request_period,
            due_date,
            status,
            request_template_id
          )
          VALUES ($1, $2, $3, $4::date, 'open', $5)
          RETURNING id
        `,
        [
          customer.name,
          requestTitle,
          requestPeriod,
          dueDate,
          templates.length === 1 ? templates[0].id : null,
        ],
      );
      const requestId = requestRows[0].id;
      const customerContacts = contactsByCustomerId.get(customer.id) || [];
      const recipientLinks = [];

      for (const [contactIndex, contact] of customerContacts.entries()) {
        const rawToken = generateSubmissionToken();
        await client.query(
          `
            INSERT INTO customer_submission_access_tokens (
              request_id,
              recipient_name,
              recipient_email,
              recipient_phone,
              token_hash,
              token_label,
              expires_at,
              metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
          `,
          [
            requestId,
            contact.name || "",
            contact.email || "",
            contact.phone || "",
            sha256Hex(rawToken),
            contact.is_primary ? "primary" : `recipient-${contactIndex + 1}`,
            `${dueDate}T23:59:59+09:00`,
            JSON.stringify({
              customerId: customer.id,
              contactId: contact.id,
              templateCodes,
              serviceNames,
              sendMethods,
            }),
          ],
        );
        recipientLinks.push({
          recipientName: contact.name || "",
          recipientEmail: contact.email || "",
          recipientPhone: contact.phone || "",
          token: rawToken,
          url: `/submit/${rawToken}`,
        });
      }

      for (const [index, document] of documents.entries()) {
        await client.query(
          `
            INSERT INTO customer_submission_items (
              request_id,
              document_type_id,
              requested_name,
              status,
              review_message,
              sort_order
            )
            VALUES ($1, $2, $3, 'not_received', '아직 접수되지 않았습니다. 자료를 찾아 업로드해 주세요.', $4)
          `,
          [requestId, document.id, document.name, (index + 1) * 10],
        );
      }

      createdRequests.push({
        requestId,
        customerId: customer.id,
        customerName: customer.name,
        recipientName: recipientLinks[0]?.recipientName || "",
        recipientEmail: recipientLinks[0]?.recipientEmail || "",
        recipientPhone: recipientLinks[0]?.recipientPhone || "",
        recipientCount: recipientLinks.length,
        recipients: recipientLinks,
        token: recipientLinks[0]?.token || "",
        url: recipientLinks[0]?.url || "",
        requestTitle,
        dueDate,
        serviceNames,
        documentCount: documents.length,
        sendMethods,
      });
    }

    await client.query("COMMIT");
    return { requests: createdRequests };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const getRequestedItemsForRequest = async (requestId) => {
  const { rows } = await pool.query(
    `
      SELECT
        csi.id,
        csi.requested_name,
        csi.document_type_id,
        dt.code AS document_type_code,
        COALESCE(
          json_agg(
            json_build_object(
              'key', dtrf.field_key,
              'label', dtrf.field_label,
              'required', dtrf.is_required,
              'hint', dtrf.extraction_hint
            )
            ORDER BY dtrf.sort_order ASC
          ) FILTER (WHERE dtrf.id IS NOT NULL),
          '[]'::json
        ) AS required_fields
      FROM customer_submission_items csi
      LEFT JOIN document_types dt ON dt.id = csi.document_type_id
      LEFT JOIN document_type_required_fields dtrf ON dtrf.document_type_id = csi.document_type_id
      WHERE csi.request_id = $1
      GROUP BY csi.id, dt.code
      ORDER BY csi.sort_order ASC
    `,
    [requestId],
  );
  return rows;
};

const callChatCompletion = async (url, payload, timeoutMs = 45_000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`chat_completion_failed_${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
};

const extractAssistantText = (payload) => {
  const content = payload?.choices?.[0]?.message?.content;
  if (Array.isArray(content)) {
    return content.map((part) => part.text || part.content || "").join("\n");
  }
  return String(content || "");
};

const stripThinkingMarkup = (value) =>
  String(value || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\/?think>/gi, "")
    .trim();

const sanitizeChatCompletionPayload = (payload) => {
  if (!Array.isArray(payload?.choices)) return payload;
  return {
    ...payload,
    choices: payload.choices.map((choice) => {
      const content = choice?.message?.content;
      if (typeof content === "string") {
        return { ...choice, message: { ...choice.message, content: stripThinkingMarkup(content) } };
      }
      if (Array.isArray(content)) {
        return {
          ...choice,
          message: {
            ...choice.message,
            content: content.map((part) =>
              typeof part?.text === "string" ? { ...part, text: stripThinkingMarkup(part.text) } : part,
            ),
          },
        };
      }
      return choice;
    }),
  };
};

const extractJsonObject = (value) => {
  const source = String(value || "").replace(/```json|```/g, "").trim();
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(source.slice(start, end + 1));
  } catch {
    return null;
  }
};

const buildCustomerRetryMessage = (decision, confidence) => {
  if (decision === "match" && confidence < 0.78) {
    return "자료 일부를 확인했지만 필수 항목을 충분히 읽지 못했습니다. 원본 파일이나 더 선명한 자료로 다시 업로드해 주세요.";
  }
  if (decision === "reject") {
    return "요청한 자료와 다른 파일로 보입니다. 해당 항목에 맞는 자료를 다시 업로드해 주세요.";
  }
  if (decision === "undecided") {
    return "파일 내용을 충분히 확인하기 어렵습니다. 원본 파일이나 더 선명한 자료로 다시 업로드해 주세요.";
  }
  return "요청한 자료로 보이지만 접수에 필요한 내용이 부족합니다. 원본 파일이나 전체 문서를 다시 업로드해 주세요.";
};

const normalizeFieldLabel = (value) =>
  String(value || "")
    .replace(/\s+/g, "")
    .replace(/[()［］\[\]{}]/g, "")
    .trim();

const isWeakFieldValue = (field) => {
    const value = String(field?.value || "").trim();
    const confidence = String(field?.confidence || "").trim();
    return !value || value === "미확인" || confidence === "낮음" || confidence === "미확인";
};

const getWeakIdentityFields = (fields = [], requiredFields = []) => {
  const identityFields = requiredFields.filter((field) => field.required !== false);
  if (!identityFields.length) return [];

  const returnedFieldsByLabel = new Map(
    fields
      .filter((field) => field?.label)
      .map((field) => [normalizeFieldLabel(field.label), field]),
  );

  return identityFields
    .map((identityField) => {
      const label = identityField.label || identityField.key;
      const returnedField = returnedFieldsByLabel.get(normalizeFieldLabel(label));
      if (!returnedField) {
        return { label, value: "미확인", confidence: "미확인" };
      }
      return isWeakFieldValue(returnedField) ? { ...returnedField, label } : null;
    })
    .filter(Boolean);
};

const buildRequiredFieldRetryMessage = (weakFields) => {
  const labels = weakFields
    .map((field) => field.label)
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");
  return labels
    ? `${labels} 항목을 충분히 확인하지 못했습니다. 해당 내용이 보이는 원본 파일이나 전체 문서를 다시 업로드해 주세요.`
    : "접수에 필요한 주요 항목을 충분히 확인하지 못했습니다. 원본 파일이나 전체 문서를 다시 업로드해 주세요.";
};

const sanitizeCustomerReviewMessage = ({ message, decision, confidence }) => {
  const source = String(message || "").trim();
  const hasInternalTerm = /(possible_match|undecided|reject|match|confidence|OCR|Qwen|JSON|uuid|필수\s*필드)/i.test(source);
  if (!source) return "";
  if (hasInternalTerm) return buildCustomerRetryMessage(decision, confidence);
  return source;
};

const clampPercent = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, number));
};

const normalizeSourceRegion = (value) => {
  if (!value || typeof value !== "object") return null;
  const regionSource = Array.isArray(value.bbox) && !value.sourceRegion ? value.bbox : value.sourceRegion || value;
  if (Array.isArray(regionSource)) {
    const [x, y, width, height] = regionSource.map(clampPercent);
    if ([x, y, width, height].some((part) => part === null) || width <= 0 || height <= 0) return null;
    return { page: 1, x, y, width, height };
  }

  const x = clampPercent(regionSource.x ?? regionSource.left);
  const y = clampPercent(regionSource.y ?? regionSource.top);
  const width = clampPercent(regionSource.width ?? regionSource.w);
  const height = clampPercent(regionSource.height ?? regionSource.h);
  const page = Number(regionSource.page || 1);
  if ([x, y, width, height].some((part) => part === null) || width <= 0 || height <= 0) return null;
  return {
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    x,
    y,
    width,
    height,
  };
};

const normalizeJudgmentFields = (fields) =>
  (Array.isArray(fields) ? fields : [])
    .map((field) => {
      const label = String(field?.label || "").trim();
      if (!label) return null;
      const normalized = {
        label,
        value: String(field?.value || "").trim(),
        confidence: ["높음", "중간", "낮음", "미확인"].includes(field?.confidence) ? field.confidence : "미확인",
      };
      const sourceRegion = normalizeSourceRegion(field?.sourceRegion || field?.region || field?.bbox);
      if (sourceRegion) normalized.sourceRegion = sourceRegion;
      return normalized;
    })
    .filter(Boolean);

const callPaddleOcrCandidate = async ({ fileBuffer, mimeType }) => {
  if (!mimeType.startsWith("image/")) return "";
  const dataUrl = `data:${mimeType};base64,${fileBuffer.toString("base64")}`;
  const payload = {
    model: paddleOcrModel,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "이 한국 회계/세무 문서 이미지의 텍스트를 가능한 한 원문 순서대로 OCR해 주세요." },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    temperature: 0,
    stream: false,
  };
  const result = await callChatCompletion(paddleOcrChatUrl, payload, 60_000);
  return extractAssistantText(result);
};

const callQwenDocumentJudgment = async ({ fileBuffer, mimeType, originalFilename, requestedItems, ocrText }) => {
  const dataUrl = mimeType.startsWith("image/") ? `data:${mimeType};base64,${fileBuffer.toString("base64")}` : "";
  const requestedSummary = requestedItems
    .map(
      (item) =>
        `- id=${item.id}, requestedName=${item.requested_name}, requiredFields=${JSON.stringify(item.required_fields || [])}`,
    )
    .join("\n");
  const prompt = [
    "한국 회계법인 자료제출 포털에 업로드된 파일을 검토하세요.",
    "요청자료 중 어떤 항목에 해당하는지 보수적으로 판단하세요. 애매한데 맞다고 우기면 안 됩니다.",
    "가장 먼저 요청자료명과 실제 문서명/서식명을 비교하세요. 큰 범주가 비슷해도 서식이 다르면 reject 또는 possible_match입니다.",
    "특히 '합계표', '집계표', '명세', '내역', '신고서', '계약서', '사본' 같은 단어는 문서 종류를 구분하는 핵심 단어입니다.",
    "예: 요청자료가 '매출 세금계산서 합계표' 또는 '매출처별 세금계산서합계표'인데 업로드 파일이 개별 '세금계산서' 1장이라면 match가 아닙니다. 합계표/집계표 형식 또는 여러 거래처를 합산한 표가 확인되어야 합니다.",
    "예: 요청자료가 '통장 입금 내역'인데 업로드 파일이 통장 사본 앞면이면 match가 아닙니다. 입출금 거래내역 행이 확인되어야 합니다.",
    "예: 요청자료가 '카드매출 내역'인데 카드 승인 행만 있고 대상 회사명/기간/출처가 없으면 possible_match 또는 reject로 두세요.",
    "requiredFields의 required=true 항목은 문서 식별에 필요한 핵심 항목입니다. 이 항목이 비어 있거나 읽기 어렵다면 match로 단정하지 마세요.",
    "requiredFields의 required=false 항목은 참고 항목입니다. 참고 항목이 없거나 흐려도 그것만으로 reject하지 마세요.",
    "띄어쓰기, 괄호, 약간 다른 표현은 엄격하게 비교하지 말고 같은 의미와 사용 가능한 값인지 기준으로 판단하세요.",
    "fields 배열에는 requiredFields에 포함된 항목을 가능한 한 같은 label로 반환하세요.",
    "원본 이미지가 제공된 경우 각 필드마다 사람이 눈으로 확인할 수 있는 위치를 sourceRegion에 넣으세요.",
    "sourceRegion은 원본 표시 페이지 기준 퍼센트 좌표입니다. 형식은 {\"page\":1,\"x\":0,\"y\":0,\"width\":10,\"height\":5}입니다.",
    "sourceRegion을 확신할 수 없으면 억지로 만들지 말고 생략하세요. 그러나 값이 보이는 경우에는 가능한 한 넣어야 합니다.",
    "decision은 내부 시스템용 값입니다. reviewMessage에는 match, possible_match, reject, undecided, confidence, OCR, Qwen, JSON, 필수 항목 같은 내부 용어를 절대 쓰지 마세요.",
    "reviewMessage는 고객이 보는 안내문입니다. 정중하고 짧은 한국어 문장으로, 왜 다시 업로드해야 하는지와 어떤 자료를 올리면 되는지만 안내하세요.",
    "자료가 충분히 확인되면 reviewMessage에는 접수 가능한 상태임을 자연스럽게 안내하세요.",
    "자료가 애매하거나 부족하면 reviewMessage에는 원본 파일, 전체 문서, 더 선명한 자료 중 무엇을 다시 올리면 되는지 안내하세요.",
    "반드시 JSON만 반환하세요.",
    "스키마:",
    '{"matchedItemId":"uuid 또는 빈 문자열","decision":"match|possible_match|reject|undecided","confidence":0.0,"reviewMessage":"고객에게 보여줄 한국어 문장","reason":"판정 근거","fields":[{"label":"필드명","value":"값 또는 미확인","confidence":"높음|중간|낮음|미확인","sourceRegion":{"page":1,"x":0,"y":0,"width":10,"height":5}}]}',
    `파일명: ${originalFilename}`,
    "요청자료 후보:",
    requestedSummary,
    "OCR 후보 텍스트:",
    ocrText || "(없음)",
  ].join("\n");

  const content = dataUrl
    ? [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: dataUrl } },
      ]
    : prompt;

  const result = await callChatCompletion(
    qwenChatUrl,
    {
      model: qwenModel,
      messages: [{ role: "user", content }],
      temperature: 0,
      stream: false,
      enable_thinking: false,
      chat_template_kwargs: { enable_thinking: false },
    },
    90_000,
  );
  return extractJsonObject(extractAssistantText(result));
};

const normalizeBusinessLicenseExtraction = (value) => {
  const fields = value?.fields && typeof value.fields === "object" && !Array.isArray(value.fields) ? value.fields : {};
  const normalized = {
    company: String(fields.company || fields.companyName || fields.name || "").trim(),
    businessNumber: String(fields.businessNumber || fields.businessRegistrationNumber || fields.registrationNumber || "").trim(),
    ceoName: String(fields.ceoName || fields.representativeName || fields.representative || "").trim(),
    businessType: String(fields.businessType || fields.type || "").trim(),
    businessItem: String(fields.businessItem || fields.item || "").trim(),
    address: String(fields.address || fields.businessAddress || "").trim(),
  };
  if (!normalized.businessNumber) {
    const text = [value?.reason, value?.ocrText, JSON.stringify(fields)].filter(Boolean).join("\n");
    normalized.businessNumber = text.match(/\d{3}-\d{2}-\d{5}/)?.[0] || "";
  }
  return {
    isBusinessRegistrationCertificate: Boolean(value?.isBusinessRegistrationCertificate),
    confidence: Number.isFinite(Number(value?.confidence)) ? Math.max(0, Math.min(1, Number(value.confidence))) : 0,
    fields: normalized,
    warnings: Array.isArray(value?.warnings) ? value.warnings.map((item) => String(item)).filter(Boolean).slice(0, 5) : [],
    reason: String(value?.reason || "").trim(),
  };
};

const callQwenBusinessLicenseExtraction = async ({ fileBuffer, mimeType, originalFilename, ocrText, warnings = [] }) => {
  const dataUrl = mimeType.startsWith("image/") ? `data:${mimeType};base64,${fileBuffer.toString("base64")}` : "";
  const prompt = [
    "한국 사업자등록증 또는 사업자등록증명 문서를 읽고 고객사 등록 입력값을 추출하세요.",
    "회계법인 내부 고객사 관리 화면의 입력칸을 채우기 위한 용도입니다.",
    "사업자등록증/사업자등록증명이 아닌 문서라면 isBusinessRegistrationCertificate=false로 두세요.",
    "애매한 값은 빈 문자열로 두고 warnings에 사람이 확인해야 할 내용을 한국어로 적으세요.",
    "사업자등록번호는 000-00-00000 형식으로 정규화하세요.",
    "업태와 종목은 문서에 구분되어 있으면 각각 businessType, businessItem에 넣으세요.",
    "상호 또는 법인명은 company, 대표자 성명은 ceoName, 사업장 소재지는 address에 넣으세요.",
    "반드시 JSON만 반환하세요.",
    "스키마:",
    '{"isBusinessRegistrationCertificate":true,"confidence":0.0,"fields":{"company":"","businessNumber":"","ceoName":"","businessType":"","businessItem":"","address":""},"warnings":[],"reason":""}',
    `파일명: ${originalFilename}`,
    warnings.length ? `전처리 경고: ${warnings.join(" / ")}` : "",
    "OCR/텍스트 후보:",
    ocrText || "(없음)",
  ].join("\n");

  const content = dataUrl
    ? [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: dataUrl } },
      ]
    : prompt;

  const result = await callChatCompletion(
    qwenChatUrl,
    {
      model: qwenModel,
      messages: [{ role: "user", content }],
      temperature: 0,
      stream: false,
      enable_thinking: false,
      chat_template_kwargs: { enable_thinking: false },
    },
    90_000,
  );
  const parsed = extractJsonObject(extractAssistantText(result)) || {};
  return normalizeBusinessLicenseExtraction({ ...parsed, ocrText });
};

const tryRenderPdfFirstPageToPng = async (pdfPath, outputDir) => {
  const outputPrefix = path.join(outputDir, "business_license_page_1");
  try {
    await execFileAsync("pdftoppm", ["-png", "-singlefile", "-f", "1", "-l", "1", pdfPath, outputPrefix], {
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    });
    const pngPath = `${outputPrefix}.png`;
    await fs.access(pngPath);
    return pngPath;
  } catch {
    return "";
  }
};

const parseBusinessLicenseUpload = async (req) => {
  const { files } = await parseMultipartFormData(req);
  const file = files.find((item) => item.fieldName === "file") || files[0];
  if (!file) {
    const error = new Error("업로드된 사업자등록증 파일이 없습니다.");
    error.status = 400;
    throw error;
  }

  const { filename, extension } = assertSupportedBusinessLicenseFile(file);
  const tempDir = path.join(uploadRoot, "_tmp_business_license", crypto.randomUUID());
  await fs.mkdir(tempDir, { recursive: true });

  try {
    const absolutePath = path.join(tempDir, filename);
    await fs.writeFile(absolutePath, file.buffer);
    const mimeType = file.contentType || extensionToMimeType(extension);
    const warnings = [];
    let ocrText = "";
    let qwenBuffer = file.buffer;
    let qwenMimeType = mimeType;

    const processorRecord = await runUploadProcessor(absolutePath);
    ocrText = buildOcrTextFromProcessorRecord(processorRecord);

    if (mimeType.startsWith("image/")) {
      try {
        const imageOcrText = await callPaddleOcrCandidate({ fileBuffer: file.buffer, mimeType });
        ocrText = [ocrText, imageOcrText].filter(Boolean).join("\n").slice(0, 20_000);
      } catch {
        warnings.push("PaddleOCR-VL에 연결하지 못해 Qwen 이미지 판단으로 계속 진행했습니다.");
      }
    } else if (extension === "pdf") {
      const renderedPath = await tryRenderPdfFirstPageToPng(absolutePath, tempDir);
      if (renderedPath) {
        qwenBuffer = await fs.readFile(renderedPath);
        qwenMimeType = "image/png";
        try {
          const pdfImageOcrText = await callPaddleOcrCandidate({ fileBuffer: qwenBuffer, mimeType: qwenMimeType });
          ocrText = [ocrText, pdfImageOcrText].filter(Boolean).join("\n").slice(0, 20_000);
        } catch {
          warnings.push("PaddleOCR-VL에 연결하지 못해 렌더링 이미지와 PDF 텍스트만으로 계속 진행했습니다.");
        }
      } else if (processorRecord?.status === "queued_ocr") {
        warnings.push("스캔 PDF의 첫 페이지 이미지 변환기를 찾지 못해 PDF 텍스트 후보만 사용했습니다.");
      }
    }

    const extraction = await callQwenBusinessLicenseExtraction({
      fileBuffer: qwenBuffer,
      mimeType: qwenMimeType,
      originalFilename: filename,
      ocrText,
      warnings,
    });

    return {
      filename,
      mimeType,
      extraction,
      warnings,
      ocrTextPreview: ocrText.slice(0, 1200),
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};

const chooseFallbackItem = (filename, requestedItems) => {
  const normalized = String(filename || "").toLowerCase();
  return (
    requestedItems.find((item) => normalized.includes(String(item.requested_name || "").replace(/\s+/g, "").toLowerCase())) ||
    requestedItems.find((item) => item.id && item.document_type_code && normalized.includes(String(item.document_type_code).replaceAll("_", ""))) ||
    requestedItems.find((item) => item.id)
  );
};

const persistClassificationResult = async ({ uploadedFileId, item, judgment, modelName, fallbackReason = "" }) => {
  const confidence = Number.isFinite(Number(judgment?.confidence)) ? Math.max(0, Math.min(1, Number(judgment.confidence))) : 0.35;
  const decision = ["match", "possible_match", "reject", "undecided"].includes(judgment?.decision) ? judgment.decision : "possible_match";
  const fields = normalizeJudgmentFields(judgment?.fields);
  const weakIdentityFields = getWeakIdentityFields(fields, item.required_fields || []);
  const identityFieldsPassed = weakIdentityFields.length === 0;
  const reviewMessage =
    (decision === "match" && confidence >= 0.78 && identityFieldsPassed
      ? sanitizeCustomerReviewMessage({ message: judgment?.reviewMessage, decision, confidence }) ||
        `AI 검수 완료율 ${Math.round(confidence * 100)}%입니다. 제출 기준에 맞게 첨부되었습니다.`
      : decision === "match" && confidence >= 0.78 && !identityFieldsPassed
        ? buildRequiredFieldRetryMessage(weakIdentityFields)
      : sanitizeCustomerReviewMessage({ message: judgment?.reviewMessage, decision, confidence })) ||
    (decision === "match" && confidence >= 0.78 && identityFieldsPassed
      ? `AI 검수 완료율 ${Math.round(confidence * 100)}%입니다. 제출 기준에 맞게 첨부되었습니다.`
      : buildCustomerRetryMessage(decision, confidence));
  const nextStatus = decision === "match" && confidence >= 0.78 && identityFieldsPassed ? "approved" : "rejected";

  await pool.query(
    `
      UPDATE customer_submission_items
      SET status = $2, review_message = $3, updated_at = now()
      WHERE id = $1
    `,
    [item.id, nextStatus, reviewMessage],
  );

  await pool.query("UPDATE uploaded_files SET submission_item_id = $2, processing_status = $3 WHERE id = $1", [
    uploadedFileId,
    item.id,
    nextStatus === "approved" ? "approved" : "rejected",
  ]);

  await pool.query(
    `
      INSERT INTO document_classification_results (
        uploaded_file_id,
        document_type_id,
        matched_submission_item_id,
        model_name,
        confidence,
        decision,
        reason,
        evidence,
        raw_output
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)
    `,
    [
      uploadedFileId,
      item.document_type_id,
      item.id,
      modelName,
      confidence,
      decision,
      judgment?.reason || fallbackReason || "",
      JSON.stringify([{ reason: judgment?.reason || fallbackReason || "업로드 직후 자동 분석 결과" }]),
      JSON.stringify({ fields, rawJudgment: judgment || {}, generatedAt: new Date().toISOString() }),
    ],
  );
};

const analyzeUploadedFile = async ({ uploadedFileId, requestId, fileBuffer, mimeType, originalFilename, targetItemId = "", preExtractedText = "" }) => {
  let requestedItems = await getRequestedItemsForRequest(requestId);
  if (targetItemId) {
    requestedItems = requestedItems.filter((item) => item.id === targetItemId);
  }
  if (!requestedItems.length) return;

  let ocrText = preExtractedText || "";
  if (!ocrText) {
    try {
      ocrText = await callPaddleOcrCandidate({ fileBuffer, mimeType });
    } catch (error) {
      ocrText = "";
    }
  }

  let judgment = null;
  try {
    judgment = await callQwenDocumentJudgment({ fileBuffer, mimeType, originalFilename, requestedItems, ocrText });
  } catch (error) {
    judgment = null;
  }

  const matchedItem =
    requestedItems.find((item) => item.id === judgment?.matchedItemId) ||
    chooseFallbackItem(originalFilename, requestedItems);
  if (!matchedItem) return;

  if (!judgment) {
    judgment = {
      matchedItemId: matchedItem.id,
      decision: "possible_match",
      confidence: 0.42,
      reviewMessage: "AI 분석 연결이 불안정하여 원본 대조가 필요합니다.",
      reason: "PaddleOCR 또는 Qwen 응답을 받지 못했습니다.",
      fields: (matchedItem.required_fields || []).map((field) => ({
        label: field.label,
        value: "미확인",
        confidence: "미확인",
      })),
    };
  }

  await persistClassificationResult({
    uploadedFileId,
    item: matchedItem,
    judgment,
    modelName: judgment ? `${paddleOcrModel} + ${qwenModel}` : "fallback",
    fallbackReason: "업로드 파일명과 요청자료 후보를 기준으로 임시 매칭했습니다.",
  });
};

const storeUploadedPortalFiles = async (rawToken, req) => {
  const requestId = await resolveSubmissionToken(rawToken);
  const { fields, files } = await parseMultipartFormData(req);
  if (!files.length) {
    const error = new Error("업로드할 파일이 없습니다.");
    error.status = 400;
    throw error;
  }

  const targetItemId = String(fields.targetItemId || "").trim();
  if (targetItemId) {
    const { rows } = await pool.query(
      "SELECT id FROM customer_submission_items WHERE request_id = $1 AND id = $2",
      [requestId, targetItemId],
    );
    if (!rows[0]) {
      const error = new Error("요청자료 항목을 찾을 수 없습니다.");
      error.status = 400;
      throw error;
    }
  }

  const storedFiles = [];
  const requestDir = path.join(uploadRoot, requestId);
  await fs.mkdir(requestDir, { recursive: true });
  const preparedFiles = [];

  for (const file of files) {
    const { filename: originalFilename, extension } = assertSupportedUploadFile(file);
    const fileId = crypto.randomUUID();
    const storedFilename = `${fileId}.${extension}`;
    const relativeStorageKey = `/uploads/${requestId}/${storedFilename}`;
    const absolutePath = path.join(requestDir, storedFilename);
    const mimeType = file.contentType || extensionToMimeType(extension);

    await fs.writeFile(absolutePath, file.buffer);

    const extractDir = extension === "zip" ? path.join(requestDir, `extracted-${fileId}`) : "";
    const processorRecord = await runUploadProcessor(absolutePath, extractDir);
    assertProcessorAccepted(processorRecord);

    if (processorRecord.status === "expanded") {
      for (const record of flattenProcessableRecords(processorRecord)) {
        if (record.status === "rejected") continue;
        if (!record.extractedPath) continue;
        const childBuffer = await fs.readFile(record.extractedPath);
        const childExtension = record.extension || getFileExtension(record.filename);
        const childMimeType = record.mime || extensionToMimeType(childExtension);
        const childFileId = crypto.randomUUID();
        const storedChildFilename = `${childFileId}.${childExtension}`;
        const childRelativeStorageKey = `/uploads/${requestId}/extracted-${fileId}/${storedChildFilename}`;
        const childAbsolutePath = path.join(requestDir, `extracted-${fileId}`, storedChildFilename);
        await fs.rename(record.extractedPath, childAbsolutePath);
        preparedFiles.push({
          fileId: childFileId,
          originalFilename: `${originalFilename} / ${record.internalPath || record.filename}`,
          extension: childExtension,
          mimeType: childMimeType,
          byteSize: childBuffer.length,
          sha256: sha256Hex(childBuffer),
          storageKey: childRelativeStorageKey,
          absolutePath: childAbsolutePath,
          buffer: childBuffer,
          processorRecord: record,
        });
      }
    } else {
      assertProcessorAccepted(processorRecord);
      preparedFiles.push({
        fileId,
        originalFilename,
        extension,
        mimeType,
        byteSize: file.buffer.length,
        sha256: sha256Hex(file.buffer),
        storageKey: relativeStorageKey,
        absolutePath,
        buffer: file.buffer,
        processorRecord,
      });
    }
  }

  if (!preparedFiles.length) {
    const error = new Error("분석할 수 있는 지원 파일이 없습니다.");
    error.status = 400;
    throw error;
  }

  if (targetItemId) {
    await pool.query(
      `
        UPDATE customer_submission_items
        SET status = 'processing', review_message = $3, updated_at = now()
        WHERE request_id = $1 AND id = $2 AND status IN ('not_received', 'rejected', 'approved')
      `,
      [requestId, targetItemId, "AI가 문서를 분석 중입니다."],
    );
  } else {
    await pool.query(
      "UPDATE customer_submission_items SET status = 'processing', review_message = $2, updated_at = now() WHERE request_id = $1 AND status IN ('not_received', 'rejected')",
      [
        requestId,
        "AI가 문서를 분석 중입니다.",
      ],
    );
  }

  for (const file of preparedFiles) {
    await pool.query(
      `
        INSERT INTO uploaded_files (
          id,
          request_id,
          submission_item_id,
          original_filename,
          storage_key,
          mime_type,
          file_extension,
          byte_size,
          sha256,
          processing_status,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'queued', $10::jsonb)
      `,
      [
        file.fileId,
        requestId,
        targetItemId || null,
        file.originalFilename,
        file.storageKey,
        file.mimeType,
        file.extension,
        file.byteSize,
        file.sha256,
        JSON.stringify({
          renderMode: file.mimeType.startsWith("image/") ? "direct-image" : file.extension === "pdf" ? "direct-pdf" : "display-pdf",
          fileUrl: `/api/submission-files/${file.fileId}`,
          pageCount: 1,
          evidencePage: 1,
          pageTitle: file.originalFilename,
          pageSubtitle: "고객 업로드 원본",
          uploadMode: "customer-portal",
          processor: file.processorRecord?.processor || "",
          processorStatus: file.processorRecord?.status || "",
          container: file.processorRecord?.container || "",
          internalPath: file.processorRecord?.internalPath || "",
        }),
      ],
    );

    storedFiles.push({ id: file.fileId, originalFilename: file.originalFilename, mimeType: file.mimeType, byteSize: file.byteSize });
    analyzeUploadedFile({
      uploadedFileId: file.fileId,
      requestId,
      fileBuffer: file.buffer,
      mimeType: file.mimeType,
      originalFilename: file.originalFilename,
      targetItemId,
      preExtractedText: buildOcrTextFromProcessorRecord(file.processorRecord),
    }).catch(async (error) => {
      await pool.query("UPDATE uploaded_files SET processing_status = 'failed', processing_error = $2 WHERE id = $1", [
        file.fileId,
        error.message || "analysis_failed",
      ]);
    });
  }

  return { requestId, files: storedFiles };
};

const fetchUploadedFile = async (fileId) => {
  const { rows } = await pool.query("SELECT storage_key, mime_type FROM uploaded_files WHERE id = $1", [fileId]);
  if (!rows[0]) {
    const error = new Error("파일을 찾을 수 없습니다.");
    error.status = 404;
    throw error;
  }

  const filePath = getUploadedFilePath(rows[0].storage_key);
  const buffer = await fs.readFile(filePath);
  return { buffer, mimeType: rows[0].mime_type || "application/octet-stream" };
};

const updatePortalCustomerRequest = async (rawToken, payload) => {
  const requestId = await resolveSubmissionToken(rawToken);
  const submitted = payload.status === "submitted";
  const { rows } = await pool.query(
    `
      UPDATE customer_submission_requests
      SET
        customer_request_message = $2,
        customer_request_status = $3,
        customer_request_submitted_at = CASE WHEN $3 = 'submitted' THEN now() ELSE customer_request_submitted_at END,
        updated_at = now()
      WHERE id = $1
      RETURNING customer_request_message, customer_request_status
    `,
    [requestId, String(payload.message || ""), submitted ? "submitted" : "draft"],
  );
  return {
    message: rows[0]?.customer_request_message || "",
    status: rows[0]?.customer_request_status || "draft",
  };
};

const submitPortalItem = async (rawToken, itemId) => {
  const requestId = await resolveSubmissionToken(rawToken);
  const { rows } = await pool.query(
    `
      UPDATE customer_submission_items
      SET status = 'submitted', review_message = '최종 접수가 완료되었습니다.', updated_at = now()
      WHERE id = $1 AND request_id = $2 AND status = 'approved'
      RETURNING id
    `,
    [itemId, requestId],
  );
  if (!rows[0]) {
    const error = new Error("최종 접수할 수 있는 자료가 아닙니다.");
    error.status = 400;
    throw error;
  }
  return fetchPortalRequestByToken(rawToken);
};

const updateReviewItem = async (itemId, payload) => {
  const status = payload.status ? mapUiReviewStatusToDb(payload.status) : null;
  const { rows } = await pool.query(
    `
      UPDATE customer_submission_items
      SET
        status = COALESCE($2, status),
        internal_memo = COALESCE($3, internal_memo),
        customer_comment = COALESCE($4, customer_comment),
        reviewed_at = now(),
        reviewed_by_user_id = $5,
        updated_at = now()
      WHERE id = $1
      RETURNING id
    `,
    [
      itemId,
      status,
      payload.internalMemo === undefined ? null : String(payload.internalMemo || ""),
      payload.customerComment === undefined ? null : String(payload.customerComment || ""),
      currentUserId,
    ],
  );

  if (!rows[0]) {
    const error = new Error("검토 항목을 찾을 수 없습니다.");
    error.status = 404;
    throw error;
  }

  return (await fetchReviewItems()).find((item) => item.id === itemId);
};

const createCustomer = async (payload) => {
  const name = String(payload.company || "").trim();
  const businessNumber = String(payload.businessNumber || "").trim();
  if (!name) {
    const error = new Error("고객사명을 입력해 주세요.");
    error.status = 400;
    throw error;
  }

  const { rows } = await pool.query(
    `
      INSERT INTO customers (
        name,
        business_registration_number,
        ceo_name,
        business_type,
        business_item,
        business_address,
        created_by_user_id,
        updated_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
      ON CONFLICT (business_registration_number)
      WHERE business_registration_number <> ''
      DO UPDATE SET
        name = EXCLUDED.name,
        ceo_name = EXCLUDED.ceo_name,
        business_type = EXCLUDED.business_type,
        business_item = EXCLUDED.business_item,
        business_address = EXCLUDED.business_address,
        updated_at = now(),
        updated_by_user_id = EXCLUDED.updated_by_user_id
      RETURNING id, name, business_registration_number, ceo_name, business_type, business_item, business_address
    `,
    [
      name,
      businessNumber,
      String(payload.ceoName || "").trim(),
      String(payload.businessType || "").trim(),
      String(payload.businessItem || "").trim(),
      String(payload.address || "").trim(),
      currentUserId,
    ],
  );

  return mapCustomerRow(rows[0], []);
};

const updateCustomer = async (customerId, payload) => {
  const name = String(payload.company || "").trim();
  if (!name) {
    const error = new Error("고객사명을 입력해 주세요.");
    error.status = 400;
    throw error;
  }

  const { rows } = await pool.query(
    `
      UPDATE customers
      SET
        name = $2,
        business_registration_number = $3,
        ceo_name = $4,
        business_type = $5,
        business_item = $6,
        business_address = $7,
        updated_at = now(),
        updated_by_user_id = $8
      WHERE id = $1
      RETURNING id, name, business_registration_number, ceo_name, business_type, business_item, business_address
    `,
    [
      customerId,
      name,
      String(payload.businessNumber || "").trim(),
      String(payload.ceoName || "").trim(),
      String(payload.businessType || "").trim(),
      String(payload.businessItem || "").trim(),
      String(payload.address || "").trim(),
      currentUserId,
    ],
  );

  if (!rows[0]) {
    const error = new Error("고객사를 찾을 수 없습니다.");
    error.status = 404;
    throw error;
  }

  const { rows: contactRows } = await pool.query(
    `
      SELECT id, name, title, phone, email, is_primary
      FROM customer_contacts
      WHERE customer_id = $1
      ORDER BY is_primary DESC, name ASC
    `,
    [customerId],
  );

  return mapCustomerRow(rows[0], contactRows.map(mapContactRow));
};

const deleteCustomer = async (customerId) => {
  const result = await pool.query("DELETE FROM customers WHERE id = $1", [customerId]);
  if (!result.rowCount) {
    const error = new Error("고객사를 찾을 수 없습니다.");
    error.status = 404;
    throw error;
  }
};

const createContact = async (customerId, payload) => {
  const name = String(payload.name || "").trim();
  const phone = String(payload.phone || "").trim();
  const email = String(payload.email || "").trim();
  if (!name || !phone || !email) {
    const error = new Error("이름, 연락처, 이메일을 입력해 주세요.");
    error.status = 400;
    throw error;
  }

  const { rows: existingContactRows } = await pool.query("SELECT COUNT(*)::int AS count FROM customer_contacts WHERE customer_id = $1", [
    customerId,
  ]);
  const isPrimary = existingContactRows[0]?.count === 0;

  const { rows } = await pool.query(
    `
      INSERT INTO customer_contacts (
        customer_id,
        name,
        title,
        phone,
        email,
        is_primary,
        created_by_user_id,
        updated_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
      RETURNING id, name, title, phone, email, is_primary
    `,
    [customerId, name, String(payload.title || "").trim(), phone, email, isPrimary, currentUserId],
  );

  return mapContactRow(rows[0]);
};

const deleteContacts = async (customerId, payload) => {
  const contactIds = [...new Set((payload.contactIds || []).map((id) => String(id || "").trim()).filter(Boolean))];
  if (!contactIds.length) {
    const error = new Error("삭제할 담당자를 선택해 주세요.");
    error.status = 400;
    throw error;
  }

  const { rows: deletedRows } = await pool.query(
    `
      DELETE FROM customer_contacts
      WHERE customer_id = $1
        AND id = ANY($2::uuid[])
      RETURNING id
    `,
    [customerId, contactIds],
  );

  if (deletedRows.length !== contactIds.length) {
    const error = new Error("삭제할 담당자를 찾을 수 없습니다.");
    error.status = 404;
    throw error;
  }

  const { rows: primaryRows } = await pool.query(
    "SELECT COUNT(*)::int AS count FROM customer_contacts WHERE customer_id = $1 AND is_primary = true",
    [customerId],
  );

  if (!primaryRows[0]?.count) {
    await pool.query(
      `
        UPDATE customer_contacts
        SET is_primary = true, updated_at = now(), updated_by_user_id = $2
        WHERE id = (
          SELECT id
          FROM customer_contacts
          WHERE customer_id = $1
          ORDER BY created_at ASC, name ASC
          LIMIT 1
        )
      `,
      [customerId, currentUserId],
    );
  }

  const { rows } = await pool.query(
    `
      SELECT id, name, title, phone, email, is_primary
      FROM customer_contacts
      WHERE customer_id = $1
      ORDER BY is_primary DESC, name ASC
    `,
    [customerId],
  );

  return rows.map(mapContactRow);
};

const saveCustomerAiAnalysis = async (customerId, payload) => {
  const analysisText = String(payload.analysisText || "").trim();
  if (!analysisText) {
    const error = new Error("저장할 AI 고객사 분석 내용이 없습니다.");
    error.status = 400;
    throw error;
  }

  const { rows: customerRows } = await pool.query("SELECT id FROM customers WHERE id = $1", [customerId]);
  if (!customerRows[0]) {
    const error = new Error("고객사를 찾을 수 없습니다.");
    error.status = 404;
    throw error;
  }

  await pool.query(
    `
      INSERT INTO customer_ai_analyses (
        customer_id,
        analysis_text,
        source_snapshot,
        model_name,
        updated_by_user_id
      )
      VALUES ($1, $2, $3::jsonb, $4, $5)
      ON CONFLICT (customer_id)
      DO UPDATE SET
        analysis_text = EXCLUDED.analysis_text,
        source_snapshot = EXCLUDED.source_snapshot,
        model_name = EXCLUDED.model_name,
        generated_at = now(),
        updated_at = now(),
        updated_by_user_id = EXCLUDED.updated_by_user_id
    `,
    [
      customerId,
      analysisText,
      JSON.stringify(normalizeMetadata(payload.sourceSnapshot)),
      String(payload.modelName || qwenModel),
      currentUserId,
    ],
  );

  return { customerId, analysisText };
};

const routeRequest = async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (url.pathname === "/api/shell" && req.method === "GET") {
    sendJson(res, 200, await fetchShellRuntime());
    return;
  }

  if (url.pathname === "/api/dashboard" && req.method === "GET") {
    sendJson(res, 200, await fetchDashboardRuntime());
    return;
  }

  if (url.pathname === "/api/customers" && req.method === "GET") {
    sendJson(res, 200, { customers: await fetchCustomers() });
    return;
  }

  if (url.pathname === "/api/customers/business-license/parse" && req.method === "POST") {
    sendJson(res, 200, { ok: true, ...(await parseBusinessLicenseUpload(req)) });
    return;
  }

  if (url.pathname === "/api/review-items" && req.method === "GET") {
    sendJson(res, 200, { items: await fetchReviewItems() });
    return;
  }

  if (url.pathname === "/api/request-templates" && req.method === "GET") {
    sendJson(res, 200, await fetchRequestTemplateWorkspace());
    return;
  }

  if (url.pathname === "/api/request-templates" && req.method === "POST") {
    const payload = await readJsonBody(req);
    sendJson(res, 201, { template: await createRequestTemplate(payload) });
    return;
  }

  if (url.pathname === "/api/submission-requests" && req.method === "POST") {
    const payload = await readJsonBody(req);
    sendJson(res, 201, await createSubmissionRequests(payload));
    return;
  }

  if (url.pathname === "/api/qwen/chat/completions" && req.method === "POST") {
    const payload = await readJsonBody(req);
    sendJson(
      res,
      200,
      sanitizeChatCompletionPayload(
        await callChatCompletion(
          qwenChatUrl,
          {
            ...payload,
            model: qwenModel,
            stream: false,
            enable_thinking: false,
            chat_template_kwargs: {
              ...(payload.chat_template_kwargs || {}),
              enable_thinking: false,
            },
          },
          30_000,
        ),
      ),
    );
    return;
  }

  const portalMatch = url.pathname.match(/^\/api\/submission-portal\/([^/]+)$/);
  if (portalMatch && req.method === "GET") {
    sendJson(res, 200, await fetchPortalRequestByToken(decodeURIComponent(portalMatch[1])));
    return;
  }

  const portalUploadMatch = url.pathname.match(/^\/api\/submission-portal\/([^/]+)\/upload$/);
  if (portalUploadMatch && req.method === "POST") {
    const uploadResult = await storeUploadedPortalFiles(decodeURIComponent(portalUploadMatch[1]), req);
    sendJson(res, 202, {
      ok: true,
      files: uploadResult.files,
      portal: await fetchPortalRequestByToken(decodeURIComponent(portalUploadMatch[1])),
    });
    return;
  }

  const portalCustomerRequestMatch = url.pathname.match(/^\/api\/submission-portal\/([^/]+)\/customer-request$/);
  if (portalCustomerRequestMatch && req.method === "PUT") {
    const payload = await readJsonBody(req);
    sendJson(res, 200, {
      customerRequest: await updatePortalCustomerRequest(decodeURIComponent(portalCustomerRequestMatch[1]), payload),
    });
    return;
  }

  const portalFinalSubmitMatch = url.pathname.match(/^\/api\/submission-portal\/([^/]+)\/items\/([0-9a-f-]+)\/final-submit$/i);
  if (portalFinalSubmitMatch && req.method === "PUT") {
    sendJson(res, 200, await submitPortalItem(decodeURIComponent(portalFinalSubmitMatch[1]), portalFinalSubmitMatch[2]));
    return;
  }

  const submissionFileMatch = url.pathname.match(/^\/api\/submission-files\/([0-9a-f-]+)$/i);
  if (submissionFileMatch && req.method === "GET") {
    const file = await fetchUploadedFile(submissionFileMatch[1]);
    sendBuffer(res, 200, file.buffer, file.mimeType);
    return;
  }

  if (url.pathname === "/api/customers" && req.method === "POST") {
    const payload = await readJsonBody(req);
    sendJson(res, 201, { customer: await createCustomer(payload) });
    return;
  }

  const customerMatch = url.pathname.match(/^\/api\/customers\/([0-9a-f-]+)$/i);
  if (customerMatch && req.method === "PUT") {
    const payload = await readJsonBody(req);
    sendJson(res, 200, { customer: await updateCustomer(customerMatch[1], payload) });
    return;
  }

  if (customerMatch && req.method === "DELETE") {
    await deleteCustomer(customerMatch[1]);
    sendJson(res, 200, { ok: true });
    return;
  }

  const contactMatch = url.pathname.match(/^\/api\/customers\/([0-9a-f-]+)\/contacts$/i);
  if (contactMatch && req.method === "POST") {
    const payload = await readJsonBody(req);
    sendJson(res, 201, { contact: await createContact(contactMatch[1], payload) });
    return;
  }

  if (contactMatch && req.method === "DELETE") {
    const payload = await readJsonBody(req);
    sendJson(res, 200, { contacts: await deleteContacts(contactMatch[1], payload) });
    return;
  }

  const customerAiAnalysisMatch = url.pathname.match(/^\/api\/customers\/([0-9a-f-]+)\/ai-analysis$/i);
  if (customerAiAnalysisMatch && req.method === "PUT") {
    const payload = await readJsonBody(req);
    sendJson(res, 200, { aiAnalysis: await saveCustomerAiAnalysis(customerAiAnalysisMatch[1], payload) });
    return;
  }

  const requestTemplateMatch = url.pathname.match(/^\/api\/request-templates\/([^/]+)$/);
  if (requestTemplateMatch && req.method === "PUT") {
    const payload = await readJsonBody(req);
    sendJson(res, 200, { template: await updateRequestTemplate(decodeURIComponent(requestTemplateMatch[1]), payload) });
    return;
  }

  if (requestTemplateMatch && req.method === "DELETE") {
    await deleteRequestTemplate(decodeURIComponent(requestTemplateMatch[1]));
    sendJson(res, 200, { ok: true });
    return;
  }

  const documentRequiredFieldsMatch = url.pathname.match(/^\/api\/document-types\/([^/]+)\/required-fields$/);
  if (documentRequiredFieldsMatch && req.method === "PUT") {
    const payload = await readJsonBody(req);
    sendJson(res, 200, {
      document: await updateDocumentTypeRequiredFields(decodeURIComponent(documentRequiredFieldsMatch[1]), payload),
    });
    return;
  }

  const reviewItemMatch = url.pathname.match(/^\/api\/review-items\/([0-9a-f-]+)$/i);
  if (reviewItemMatch && req.method === "PUT") {
    const payload = await readJsonBody(req);
    sendJson(res, 200, { item: await updateReviewItem(reviewItemMatch[1], payload) });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
};

const server = http.createServer(async (req, res) => {
  try {
    await routeRequest(req, res);
  } catch (error) {
    const status = error.status || 500;
    sendJson(res, status, { error: error.message || "Internal server error" });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`AuditMind API listening on ${port}`);
});
