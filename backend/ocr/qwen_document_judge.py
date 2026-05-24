"""Qwen document judgment adapter for AuditMind OCR artifacts."""

from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import re
import urllib.request
from pathlib import Path


DEFAULT_QWEN_URL = "http://100.120.165.93:8090/v1/chat/completions"
DEFAULT_QWEN_MODEL = "Qwen3.6-35B-A3B-UD-Q8_K_XL.gguf"


def extract_json_object(text: str) -> dict:
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("qwen_response_json_not_found")
    return json.loads(cleaned[start : end + 1])


def judge_document(
    *,
    ocr_text: str,
    requested_document: str,
    source_file: str,
    required_fields: list[str],
    image_path: str | None = None,
    qwen_url: str = DEFAULT_QWEN_URL,
    model: str = DEFAULT_QWEN_MODEL,
) -> dict:
    system = (
        "당신은 한국 회계법인용 자료 제출 검수 보조자입니다. "
        "OCR 결과만 근거로 판단합니다. 값을 추측하거나 원문에 없는 값을 만들면 안 됩니다. "
        "어중간한데 맞다고 우기는 것이 가장 위험합니다. "
        "필수 항목가 OCR에 없거나 식별이 어려우면 status를 needs_review 또는 rejected로 두고 confidence를 낮게 주세요. "
        "반드시 JSON 객체만 출력하세요."
    )
    required_field_lines = "\n".join(f"- {field}" for field in required_fields)
    user = f"""
요청 문서명: {requested_document}
원본 파일: {source_file}

이 문서 검수에 필요한 최소 필드:
{required_field_lines}

OCR 결과:
{ocr_text}

아래 스키마로만 답하세요.
{{
  "documentName": "string",
  "status": "approved | needs_review | rejected",
  "isExpectedDocument": true,
  "confidencePercent": 0,
  "summary": "string",
  "reason": "string",
  "evidence": "string",
  "fields": [
    {{"label": "string", "value": "string", "confidence": "높음 | 중간 | 낮음 | 미확인"}}
  ],
  "reviewMemo": "string"
}}
"""
    user_content: str | list[dict[str, object]]
    if image_path:
        image_file = Path(image_path)
        mime = mimetypes.guess_type(image_file.name)[0] or "image/png"
        data_url = f"data:{mime};base64,{base64.b64encode(image_file.read_bytes()).decode('ascii')}"
        user_content = [
            {"type": "text", "text": user},
            {"type": "image_url", "image_url": {"url": data_url}},
        ]
    else:
        user_content = user

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_content},
        ],
        "temperature": 0.1,
        "stream": False,
        "enable_thinking": False,
        "chat_template_kwargs": {"enable_thinking": False},
    }
    request = urllib.request.Request(
        qwen_url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=180) as response:
        data = json.loads(response.read().decode("utf-8"))
    content = data["choices"][0]["message"]["content"]
    result = extract_json_object(content)
    result["sourceFile"] = source_file
    result["imageInputUsed"] = bool(image_path)
    result["requestedDocument"] = requested_document
    result["qwenModel"] = model
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Judge an OCR artifact with Qwen3.6.")
    parser.add_argument("--ocr-markdown", required=True)
    parser.add_argument("--requested-document", required=True)
    parser.add_argument("--source-file", required=True)
    parser.add_argument("--image-path")
    parser.add_argument(
        "--required-field",
        action="append",
        dest="required_fields",
        default=[],
        help="Required field label for this requested document. Can be passed multiple times.",
    )
    parser.add_argument("--output", required=True)
    parser.add_argument("--qwen-url", default=DEFAULT_QWEN_URL)
    parser.add_argument("--model", default=DEFAULT_QWEN_MODEL)
    args = parser.parse_args()

    ocr_text = Path(args.ocr_markdown).read_text(encoding="utf-8")
    result = judge_document(
        ocr_text=ocr_text,
        requested_document=args.requested_document,
        source_file=args.source_file,
        required_fields=args.required_fields
        or [
            "문서명/양식명",
            "주요 식별번호",
            "발행자 또는 금융기관",
            "대상자 또는 예금주",
            "일자",
            "금액 또는 계좌 정보",
        ],
        image_path=args.image_path,
        qwen_url=args.qwen_url,
        model=args.model,
    )
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
