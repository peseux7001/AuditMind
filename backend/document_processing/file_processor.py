"""Safe file normalization and lightweight extraction for AuditMind uploads.

This module is the first backend boundary after upload receipt. It does not try
to make final accounting judgments. Its job is to safely recognize every
accepted file type and produce a normalized object for downstream OCR/Qwen
classification.
"""

from __future__ import annotations

import csv
import hashlib
import html
import json
import mimetypes
import os
import re
import shutil
import subprocess
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any
from xml.etree import ElementTree


ACCEPTED_EXTENSIONS = {
    ".pdf",
    ".xls",
    ".xlsx",
    ".xlsm",
    ".csv",
    ".tsv",
    ".doc",
    ".docx",
    ".hwp",
    ".hwpx",
    ".jpg",
    ".jpeg",
    ".png",
    ".heic",
    ".heif",
    ".webp",
    ".tiff",
    ".tif",
    ".zip",
}

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp", ".tiff", ".tif"}
ARCHIVE_EXTENSIONS = {".zip"}
SPREADSHEET_EXTENSIONS = {".xls", ".xlsx", ".xlsm", ".csv", ".tsv"}
DOCUMENT_EXTENSIONS = {".pdf", ".doc", ".docx", ".hwp", ".hwpx"}
LEGACY_CONVERSION_EXTENSIONS = {".xls", ".doc", ".hwp"}
EXECUTABLE_EXTENSIONS = {
    ".app",
    ".bat",
    ".cmd",
    ".com",
    ".dll",
    ".dmg",
    ".exe",
    ".js",
    ".msi",
    ".ps1",
    ".scr",
    ".sh",
}


@dataclass(frozen=True)
class ProcessingOptions:
    max_file_bytes: int = 50 * 1024 * 1024
    max_archive_members: int = 200
    max_archive_expanded_bytes: int = 500 * 1024 * 1024
    text_sample_chars: int = 20_000
    table_sample_rows: int = 25
    converter_timeout_seconds: int = 60
    extract_dir: str = ""


def process_upload_path(
    path: str | Path,
    *,
    options: ProcessingOptions | None = None,
    source: str = "direct_upload",
    container: str = "",
    internal_path: str = "",
) -> dict[str, Any]:
    """Normalize one uploaded file or archive.

    Returns a JSON-serializable object. Archives return a container record with
    child records in `children`.
    """

    options = options or ProcessingOptions()
    path = Path(path)
    extension = path.suffix.lower()
    base = _base_record(path, source=source, container=container, internal_path=internal_path)

    if extension in EXECUTABLE_EXTENSIONS:
      return _reject(base, "unsupported_executable", "실행 파일은 처리할 수 없습니다.")

    if extension not in ACCEPTED_EXTENSIONS:
      return _reject(base, "unsupported_extension", "지원하지 않는 파일 형식입니다.")

    size = _safe_size(path)
    base["size"] = size
    base["sha256"] = _sha256(path) if path.is_file() else ""

    if size > options.max_file_bytes:
      return _reject(base, "file_too_large", "파일 용량 제한을 초과했습니다.")

    try:
      if extension == ".zip":
        return _process_zip(path, base, options)
      if extension in IMAGE_EXTENSIONS:
        return _queue_ocr(base, "image_ocr_required", "이미지 파일은 PaddleOCR-VL 분석 대상으로 보냅니다.")
      if extension == ".pdf":
        return _process_pdf(path, base, options)
      if extension in {".csv", ".tsv"}:
        return _process_delimited(path, base, options, delimiter="\t" if extension == ".tsv" else ",")
      if extension in {".xlsx", ".xlsm"}:
        return _process_xlsx_like(path, base, options)
      if extension == ".docx":
        return _process_docx(path, base, options)
      if extension == ".hwpx":
        return _process_hwpx(path, base, options)
      if extension in LEGACY_CONVERSION_EXTENSIONS:
        return _process_legacy_binary(path, base, options)
    except zipfile.BadZipFile:
      return _reject(base, "corrupted_or_invalid_zip", "압축 또는 문서 컨테이너가 손상되었거나 올바르지 않습니다.")
    except UnicodeDecodeError:
      return _reject(base, "text_decode_failed", "텍스트 인코딩을 확인할 수 없습니다.")
    except Exception as exc:  # Defensive boundary for upload processing.
      return _reject(base, "processing_error", f"파일 처리 중 오류가 발생했습니다: {type(exc).__name__}")

    return _reject(base, "unsupported_processing_path", "처리 경로가 정의되지 않은 파일입니다.")


def _base_record(path: Path, *, source: str, container: str, internal_path: str) -> dict[str, Any]:
    extension = path.suffix.lower()
    return {
        "filename": path.name,
        "extension": extension.lstrip("."),
        "mime": mimetypes.guess_type(path.name)[0] or "application/octet-stream",
        "size": 0,
        "sha256": "",
        "source": source,
        "container": container,
        "internalPath": internal_path,
        "status": "pending",
        "processor": "",
        "text": "",
        "tables": [],
        "sheets": [],
        "metadata": {},
        "children": [],
        "warnings": [],
        "error": None,
    }


def _safe_size(path: Path) -> int:
    try:
        return path.stat().st_size
    except FileNotFoundError:
        return 0


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _reject(record: dict[str, Any], code: str, message: str) -> dict[str, Any]:
    record.update(
        {
            "status": "rejected",
            "processor": "security_or_format_guard",
            "error": {"code": code, "message": message},
        }
    )
    return record


def _queue_ocr(record: dict[str, Any], code: str, message: str) -> dict[str, Any]:
    record.update(
        {
            "status": "queued_ocr",
            "processor": "paddleocr_vl",
            "metadata": {
                **record.get("metadata", {}),
                "queueReason": code,
                "message": message,
            },
        }
    )
    return record


def _needs_conversion(
    path: Path,
    record: dict[str, Any],
    options: ProcessingOptions,
    *,
    attempts: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    record.update(
        {
            "status": "needs_conversion",
            "processor": "external_converter_required",
            "text": _extract_binary_strings(path, options.text_sample_chars),
            "metadata": {
                "conversionCandidates": _conversion_candidates(record["extension"]),
                "conversionAttempts": attempts or [],
                "macroPolicy": "ignore_never_execute",
            },
        }
    )
    return record


def _process_legacy_binary(path: Path, record: dict[str, Any], options: ProcessingOptions) -> dict[str, Any]:
    extension = path.suffix.lower()
    attempts: list[dict[str, Any]] = []

    if extension == ".xls":
        calamine_result = _try_python_calamine(path, record, options)
        attempts.append(calamine_result["attempt"])
        if calamine_result["record"]:
            return calamine_result["record"]

        libreoffice_result = _try_libreoffice_conversion(path, record, options, output_extension="xlsx")
        attempts.append(libreoffice_result["attempt"])
        if libreoffice_result["record"]:
            return libreoffice_result["record"]

    if extension == ".doc":
        libreoffice_result = _try_libreoffice_conversion(path, record, options, output_extension="docx")
        attempts.append(libreoffice_result["attempt"])
        if libreoffice_result["record"]:
            return libreoffice_result["record"]

        antiword_result = _try_text_command(path, record, options, command_name="antiword", processor="antiword")
        attempts.append(antiword_result["attempt"])
        if antiword_result["record"]:
            return antiword_result["record"]

    if extension == ".hwp":
        hwp5txt_result = _try_text_command(path, record, options, command_name="hwp5txt", processor="hwp5txt")
        attempts.append(hwp5txt_result["attempt"])
        if hwp5txt_result["record"]:
            return hwp5txt_result["record"]

        libreoffice_result = _try_libreoffice_conversion(path, record, options, output_extension="docx")
        attempts.append(libreoffice_result["attempt"])
        if libreoffice_result["record"]:
            return libreoffice_result["record"]

        libreoffice_pdf_result = _try_libreoffice_conversion(path, record, options, output_extension="pdf")
        attempts.append(libreoffice_pdf_result["attempt"])
        if libreoffice_pdf_result["record"]:
            return libreoffice_pdf_result["record"]

    return _needs_conversion(path, record, options, attempts=attempts)


def _conversion_candidates(extension: str) -> list[str]:
    if extension == "xls":
        return ["libreoffice_headless_to_xlsx_or_csv", "python_calamine"]
    if extension == "doc":
        return ["libreoffice_headless_to_docx_or_pdf", "antiword_text_fallback"]
    if extension == "hwp":
        return ["hwp5txt_or_pyhwp", "libreoffice_headless_fallback", "extract_hwp_candidate"]
    return ["libreoffice_headless"]


def _try_python_calamine(path: Path, record: dict[str, Any], options: ProcessingOptions) -> dict[str, Any]:
    attempt = {"tool": "python_calamine", "status": "missing"}
    try:
        from python_calamine import load_workbook
    except ImportError:
        return {"attempt": attempt, "record": None}

    try:
        workbook = load_workbook(path)
        sheet_names = list(getattr(workbook, "sheet_names", []) or [])
        tables = []
        text_parts = []
        for sheet_name in sheet_names:
            sheet = workbook.get_sheet_by_name(sheet_name)
            rows = sheet.to_python()[: options.table_sample_rows]
            normalized_rows = [[_cell_to_text(cell) for cell in row] for row in rows]
            headers = normalized_rows[0] if normalized_rows else []
            tables.append({"name": sheet_name, "headers": headers, "rows": normalized_rows[1:]})
            text_parts.append(sheet_name)
            text_parts.extend("\t".join(row) for row in normalized_rows)

        converted = dict(record)
        converted.update(
            {
                "status": "extracted",
                "processor": "python_calamine",
                "text": "\n".join(text_parts)[: options.text_sample_chars],
                "tables": tables,
                "sheets": sheet_names,
                "metadata": {
                    "conversionAttempts": [{"tool": "python_calamine", "status": "success"}],
                    "macroPolicy": "ignore_never_execute",
                },
            }
        )
        return {"attempt": {"tool": "python_calamine", "status": "success"}, "record": converted}
    except Exception as exc:
        return {
            "attempt": {"tool": "python_calamine", "status": "failed", "error": type(exc).__name__},
            "record": None,
        }


def _try_libreoffice_conversion(
    path: Path,
    record: dict[str, Any],
    options: ProcessingOptions,
    *,
    output_extension: str,
) -> dict[str, Any]:
    command = _find_libreoffice()
    attempt = {"tool": "libreoffice_headless", "status": "missing", "target": output_extension}
    if not command:
        return {"attempt": attempt, "record": None}

    with tempfile.TemporaryDirectory(prefix="auditmind_convert_") as temp_dir:
        temp_path = Path(temp_dir)
        try:
            result = subprocess.run(
                [
                    command,
                    "--headless",
                    "--nologo",
                    "--nofirststartwizard",
                    "--convert-to",
                    output_extension,
                    "--outdir",
                    str(temp_path),
                    str(path),
                ],
                check=False,
                capture_output=True,
                text=True,
                timeout=options.converter_timeout_seconds,
            )
            if result.returncode != 0:
                return {
                    "attempt": {
                        "tool": "libreoffice_headless",
                        "status": "failed",
                        "target": output_extension,
                        "stderr": result.stderr[-500:],
                    },
                    "record": None,
                }

            converted_path = _find_converted_file(temp_path, path.stem, output_extension)
            if not converted_path:
                return {
                    "attempt": {
                        "tool": "libreoffice_headless",
                        "status": "failed",
                        "target": output_extension,
                        "stderr": "converted file not found",
                    },
                    "record": None,
                }

            converted_record = _base_record(
                converted_path,
                source=record["source"],
                container=record["container"],
                internal_path=record["internalPath"],
            )
            converted_record["size"] = _safe_size(converted_path)
            converted_record["sha256"] = _sha256(converted_path)

            if output_extension == "xlsx":
                extracted = _process_xlsx_like(converted_path, converted_record, options)
            elif output_extension == "docx":
                extracted = _process_docx(converted_path, converted_record, options)
            elif output_extension == "pdf":
                extracted = _process_pdf(converted_path, converted_record, options)
            else:
                return {
                    "attempt": {
                        "tool": "libreoffice_headless",
                        "status": "failed",
                        "target": output_extension,
                        "stderr": "unsupported conversion target",
                    },
                    "record": None,
                }

            return {
                "attempt": {"tool": "libreoffice_headless", "status": "success", "target": output_extension},
                "record": _merge_converted_record(record, extracted, "libreoffice_headless", output_extension),
            }
        except subprocess.TimeoutExpired:
            return {
                "attempt": {"tool": "libreoffice_headless", "status": "timeout", "target": output_extension},
                "record": None,
            }


def _try_text_command(
    path: Path,
    record: dict[str, Any],
    options: ProcessingOptions,
    *,
    command_name: str,
    processor: str,
) -> dict[str, Any]:
    command = shutil.which(command_name)
    attempt = {"tool": command_name, "status": "missing"}
    if not command:
        return {"attempt": attempt, "record": None}

    try:
        result = subprocess.run(
            [command, str(path)],
            check=False,
            capture_output=True,
            text=True,
            timeout=options.converter_timeout_seconds,
        )
        text = (result.stdout or "").strip()
        if result.returncode != 0 or not text:
            return {
                "attempt": {
                    "tool": command_name,
                    "status": "failed",
                    "stderr": (result.stderr or "")[-500:],
                },
                "record": None,
            }

        extracted = dict(record)
        extracted.update(
            {
                "status": "extracted",
                "processor": processor,
                "text": text[: options.text_sample_chars],
                "metadata": {
                    "conversionAttempts": [{"tool": command_name, "status": "success"}],
                    "macroPolicy": "ignore_never_execute",
                },
            }
        )
        return {"attempt": {"tool": command_name, "status": "success"}, "record": extracted}
    except subprocess.TimeoutExpired:
        return {"attempt": {"tool": command_name, "status": "timeout"}, "record": None}


def _find_libreoffice() -> str:
    candidates = [
        shutil.which("soffice"),
        shutil.which("libreoffice"),
        "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return candidate
    return ""


def _find_converted_file(directory: Path, stem: str, output_extension: str) -> Path | None:
    exact = directory / f"{stem}.{output_extension}"
    if exact.exists():
        return exact
    matches = list(directory.glob(f"*.{output_extension}"))
    return matches[0] if matches else None


def _merge_converted_record(
    original: dict[str, Any],
    converted: dict[str, Any],
    tool: str,
    target: str,
) -> dict[str, Any]:
    merged = dict(original)
    merged.update(
        {
            "status": converted["status"],
            "processor": converted["processor"],
            "text": converted.get("text", ""),
            "tables": converted.get("tables", []),
            "sheets": converted.get("sheets", []),
            "warnings": [*original.get("warnings", []), *converted.get("warnings", [])],
            "metadata": {
                **converted.get("metadata", {}),
                "convertedBy": tool,
                "convertedTo": target,
                "conversionAttempts": [{"tool": tool, "status": "success", "target": target}],
                "originalExtension": original["extension"],
                "macroPolicy": "ignore_never_execute",
            },
        }
    )
    return merged


def _cell_to_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value)


def _process_zip(path: Path, record: dict[str, Any], options: ProcessingOptions) -> dict[str, Any]:
    children: list[dict[str, Any]] = []
    ignored_children: list[dict[str, str]] = []
    total_uncompressed = 0
    extract_root = Path(options.extract_dir) if options.extract_dir else None
    if extract_root:
        extract_root.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(path) as archive:
        members = archive.infolist()
        if len(members) > options.max_archive_members:
            return _reject(record, "archive_too_many_members", "압축 파일 내부 항목 수가 제한을 초과했습니다.")

        for member in members:
            if member.is_dir():
                continue
            if member.flag_bits & 0x1:
                return _reject(record, "password_protected_archive", "암호가 걸린 압축 파일은 처리할 수 없습니다.")

            internal_path = _safe_internal_path(member.filename)
            if not internal_path:
                return _reject(record, "unsafe_archive_path", "압축 파일 내부 경로가 안전하지 않습니다.")

            child_extension = Path(PurePosixPath(internal_path).name).suffix.lower()
            if child_extension in EXECUTABLE_EXTENSIONS:
                ignored_children.append({"internalPath": internal_path, "reason": "executable_ignored"})
                continue
            if child_extension not in ACCEPTED_EXTENSIONS:
                ignored_children.append({"internalPath": internal_path, "reason": "unsupported_extension_ignored"})
                continue

            total_uncompressed += member.file_size
            if total_uncompressed > options.max_archive_expanded_bytes:
                return _reject(record, "archive_expanded_size_too_large", "압축 해제 후 전체 용량이 제한을 초과했습니다.")

            child_bytes = archive.read(member)
            if extract_root:
                child_name = PurePosixPath(internal_path).name
                child_hash = hashlib.sha256(internal_path.encode("utf-8")).hexdigest()[:12]
                child_path = extract_root / f"{child_hash}_{child_name}"
                child_path.write_bytes(child_bytes)
                child_record = process_upload_path(
                    child_path,
                    options=options,
                    source="archive_child",
                    container=path.name,
                    internal_path=internal_path,
                )
                child_record["extractedPath"] = str(child_path)
                children.append(child_record)
            else:
                with tempfile.TemporaryDirectory(prefix="auditmind_zip_") as temp_dir:
                    child_path = Path(temp_dir) / PurePosixPath(internal_path).name
                    child_path.write_bytes(child_bytes)
                    children.append(
                        process_upload_path(
                            child_path,
                            options=options,
                            source="archive_child",
                            container=path.name,
                            internal_path=internal_path,
                        )
                    )

    record.update(
        {
            "status": "expanded",
            "processor": "zipfile",
            "children": children,
            "metadata": {
                "memberCount": len(children),
                "ignoredMemberCount": len(ignored_children),
                "expandedBytes": total_uncompressed,
                "ignoredChildren": ignored_children,
            },
        }
    )
    return record


def _safe_internal_path(filename: str) -> str:
    normalized = PurePosixPath(filename.replace("\\", "/"))
    if normalized.is_absolute():
        return ""
    if any(part in {"", ".", ".."} for part in normalized.parts):
        return ""
    return normalized.as_posix()


def _process_pdf(path: Path, record: dict[str, Any], options: ProcessingOptions) -> dict[str, Any]:
    text = _extract_binary_strings(path, options.text_sample_chars)
    if len(text) < 80:
        queued = _queue_ocr(record, "pdf_text_layer_missing_or_sparse", "PDF 텍스트 레이어가 부족해 OCR 분석 대상으로 보냅니다.")
        queued["text"] = text
        return queued

    record.update(
        {
            "status": "extracted",
            "processor": "pdf_text_probe",
            "text": text,
            "metadata": {"textLayerLikelyPresent": True},
        }
    )
    return record


def _process_delimited(path: Path, record: dict[str, Any], options: ProcessingOptions, *, delimiter: str) -> dict[str, Any]:
    rows: list[list[str]] = []
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.reader(file, delimiter=delimiter)
        for index, row in enumerate(reader):
            if index >= options.table_sample_rows:
                break
            rows.append(row)

    headers = rows[0] if rows else []
    record.update(
        {
            "status": "extracted",
            "processor": "csv" if delimiter == "," else "tsv",
            "text": "\n".join(["\t".join(row) for row in rows])[: options.text_sample_chars],
            "tables": [{"name": "default", "headers": headers, "rows": rows[1:]}],
            "metadata": {"rowSampleCount": max(0, len(rows) - 1)},
        }
    )
    return record


def _process_xlsx_like(path: Path, record: dict[str, Any], options: ProcessingOptions) -> dict[str, Any]:
    with zipfile.ZipFile(path) as workbook:
        names = set(workbook.namelist())
        if any(name.startswith("xl/vbaProject") for name in names):
            record["warnings"].append("XLSM macro project detected and ignored.")

        shared_strings = _read_xlsx_shared_strings(workbook)
        sheet_names = _read_xlsx_sheet_names(workbook)
        tables = []
        text_parts = []

        for sheet_path in sorted(name for name in names if re.match(r"xl/worksheets/sheet\d+\.xml$", name)):
            rows = _read_xlsx_sheet_rows(workbook, sheet_path, shared_strings, options.table_sample_rows)
            sheet_index = len(tables)
            sheet_name = sheet_names[sheet_index] if sheet_index < len(sheet_names) else Path(sheet_path).stem
            headers = rows[0] if rows else []
            tables.append({"name": sheet_name, "headers": headers, "rows": rows[1:]})
            text_parts.append(sheet_name)
            text_parts.extend("\t".join(row) for row in rows[: options.table_sample_rows])

    record.update(
        {
            "status": "extracted",
            "processor": "xlsx_xml",
            "text": "\n".join(text_parts)[: options.text_sample_chars],
            "tables": tables,
            "sheets": sheet_names,
            "metadata": {"macroPolicy": "ignore_never_execute"},
        }
    )
    return record


def _read_xlsx_shared_strings(workbook: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in workbook.namelist():
        return []
    root = ElementTree.fromstring(workbook.read("xl/sharedStrings.xml"))
    strings = []
    for item in root.iter():
        if _local_name(item.tag) == "si":
            strings.append("".join(text.text or "" for text in item.iter() if _local_name(text.tag) == "t"))
    return strings


def _read_xlsx_sheet_names(workbook: zipfile.ZipFile) -> list[str]:
    if "xl/workbook.xml" not in workbook.namelist():
        return []
    root = ElementTree.fromstring(workbook.read("xl/workbook.xml"))
    return [
        sheet.attrib.get("name", "")
        for sheet in root.iter()
        if _local_name(sheet.tag) == "sheet" and sheet.attrib.get("name")
    ]


def _read_xlsx_sheet_rows(
    workbook: zipfile.ZipFile,
    sheet_path: str,
    shared_strings: list[str],
    max_rows: int,
) -> list[list[str]]:
    root = ElementTree.fromstring(workbook.read(sheet_path))
    rows: list[list[str]] = []
    for row in (node for node in root.iter() if _local_name(node.tag) == "row"):
        values = []
        for cell in (node for node in row if _local_name(node.tag) == "c"):
            cell_type = cell.attrib.get("t")
            value_node = next((node for node in cell if _local_name(node.tag) == "v"), None)
            inline_node = next((node for node in cell if _local_name(node.tag) == "is"), None)
            if inline_node is not None:
                values.append("".join(node.text or "" for node in inline_node.iter() if _local_name(node.tag) == "t"))
            elif value_node is not None:
                value = value_node.text or ""
                if cell_type == "s" and value.isdigit() and int(value) < len(shared_strings):
                    values.append(shared_strings[int(value)])
                else:
                    values.append(value)
            else:
                values.append("")
        rows.append(values)
        if len(rows) >= max_rows:
            break
    return rows


def _process_docx(path: Path, record: dict[str, Any], options: ProcessingOptions) -> dict[str, Any]:
    with zipfile.ZipFile(path) as document:
        if "word/document.xml" not in document.namelist():
            return _reject(record, "invalid_docx", "DOCX 본문 XML을 찾을 수 없습니다.")
        text = _extract_xml_text(document.read("word/document.xml"))[: options.text_sample_chars]

    record.update({"status": "extracted", "processor": "docx_xml", "text": text})
    return record


def _process_hwpx(path: Path, record: dict[str, Any], options: ProcessingOptions) -> dict[str, Any]:
    with zipfile.ZipFile(path) as document:
        xml_names = [
            name
            for name in document.namelist()
            if name.lower().endswith(".xml") and ("contents/" in name.lower() or "section" in name.lower())
        ]
        if not xml_names:
            return _reject(record, "invalid_hwpx", "HWPX 본문 XML을 찾을 수 없습니다.")

        text_parts = []
        for name in sorted(xml_names):
            text_parts.append(_extract_xml_text(document.read(name)))
            if sum(len(part) for part in text_parts) >= options.text_sample_chars:
                break

    record.update(
        {
            "status": "extracted",
            "processor": "hwpx_xml",
            "text": "\n".join(text_parts)[: options.text_sample_chars],
            "metadata": {"xmlPartCount": len(xml_names)},
        }
    )
    return record


def _extract_xml_text(raw_xml: bytes) -> str:
    root = ElementTree.fromstring(raw_xml)
    parts = []
    for node in root.iter():
        if node.text and node.text.strip():
            parts.append(html.unescape(node.text.strip()))
    return "\n".join(parts)


def _extract_binary_strings(path: Path, limit: int) -> str:
    raw = path.read_bytes()[: max(limit * 4, limit)]
    decoded = raw.decode("utf-8", errors="ignore")
    chunks = re.findall(r"[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ一-龥ㆍ\-\_\.\,\(\)\[\]\/:%\s]{4,}", decoded)
    return "\n".join(chunk.strip() for chunk in chunks if chunk.strip())[:limit]


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Normalize and lightly extract an AuditMind upload file.")
    parser.add_argument("path", help="File path to process.")
    parser.add_argument("--extract-dir", default="", help="Directory where ZIP children should be safely extracted.")
    args = parser.parse_args()
    print(
        json.dumps(
            process_upload_path(args.path, options=ProcessingOptions(extract_dir=args.extract_dir)),
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
