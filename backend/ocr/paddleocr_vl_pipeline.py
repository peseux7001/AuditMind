"""Official PaddleOCR-VL pipeline wrapper for AuditMind.

This module intentionally uses PaddleOCR's full `PaddleOCRVL` pipeline instead
of calling the PaddleOCR-VL VLM chat-completions endpoint directly.

Official pipeline shape:
input document -> optional orientation/unwarping -> layout detection ->
element crops -> VLM recognition -> reading-order merge -> JSON/Markdown.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any


DEFAULT_VL_SERVER_URL = os.environ.get(
    "AUDITMIND_PADDLEOCR_VL_SERVER_URL",
    "http://192.168.0.10:8118/v1",
)
DEFAULT_VL_MODEL_NAME = os.environ.get(
    "AUDITMIND_PADDLEOCR_VL_MODEL",
    "PaddleOCR-VL-1.5-0.9B",
)


def build_pipeline(
    *,
    vl_server_url: str = DEFAULT_VL_SERVER_URL,
    vl_model_name: str = DEFAULT_VL_MODEL_NAME,
    use_doc_orientation_classify: bool = True,
    use_doc_unwarping: bool = True,
    use_layout_detection: bool = True,
):
    """Create the official PaddleOCRVL pipeline.

    The import is lazy so the frontend-only development environment can still
    run without installing PaddleOCR's GPU-heavy dependencies.
    """

    try:
        from paddleocr import PaddleOCRVL
    except ImportError as exc:
        raise RuntimeError(
            "PaddleOCR is not installed. Install the official doc-parser package "
            'in a Python environment, for example: pip install "paddleocr[doc-parser]"'
        ) from exc

    return PaddleOCRVL(
        pipeline_version="v1.5",
        vl_rec_backend="vllm-server",
        vl_rec_server_url=vl_server_url,
        vl_rec_api_model_name=vl_model_name,
        use_doc_orientation_classify=use_doc_orientation_classify,
        use_doc_unwarping=use_doc_unwarping,
        use_layout_detection=use_layout_detection,
    )


def parse_document(
    input_path: str | Path,
    output_dir: str | Path,
    *,
    vl_server_url: str = DEFAULT_VL_SERVER_URL,
    vl_model_name: str = DEFAULT_VL_MODEL_NAME,
    restructure_pages: bool = True,
    merge_tables: bool = True,
    relevel_titles: bool = True,
) -> list[dict[str, Any]]:
    """Parse one file with the official PaddleOCR-VL pipeline.

    Returns a lightweight manifest that points at the saved structured outputs.
    PaddleOCR's result objects own their internal schema, so AuditMind stores the
    official JSON/Markdown outputs and lets downstream Qwen processing consume
    those canonical artifacts.
    """

    input_path = Path(input_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    pipeline = build_pipeline(
        vl_server_url=vl_server_url,
        vl_model_name=vl_model_name,
    )

    page_results = list(pipeline.predict(input=str(input_path)))
    if restructure_pages and input_path.suffix.lower() == ".pdf":
        results = list(
            pipeline.restructure_pages(
                page_results,
                merge_tables=merge_tables,
                relevel_titles=relevel_titles,
            )
        )
    else:
        results = page_results

    manifest: list[dict[str, Any]] = []
    for index, result in enumerate(results, start=1):
        result.save_to_json(save_path=output_dir)
        result.save_to_markdown(save_path=output_dir)

        manifest.append(
            {
                "index": index,
                "source_file": str(input_path),
                "output_dir": str(output_dir),
                "pipeline": "PaddleOCRVL",
                "pipeline_version": "v1.5",
                "vl_backend": "vllm-server",
                "vl_server_url": vl_server_url,
                "vl_model_name": vl_model_name,
                "official_pipeline": True,
            }
        )

    manifest_path = output_dir / "auditmind_ocr_manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run AuditMind document parsing through the official PaddleOCR-VL pipeline.",
    )
    parser.add_argument("input", help="Path to a PDF or image file.")
    parser.add_argument(
        "--output-dir",
        default="ocr-output",
        help="Directory where PaddleOCR JSON/Markdown outputs should be saved.",
    )
    parser.add_argument(
        "--vl-server-url",
        default=DEFAULT_VL_SERVER_URL,
        help="OpenAI-compatible PaddleOCR-VL VLM server URL.",
    )
    parser.add_argument(
        "--vl-model-name",
        default=DEFAULT_VL_MODEL_NAME,
        help="Model name exposed by the PaddleOCR-VL VLM server.",
    )
    parser.add_argument(
        "--no-restructure-pages",
        action="store_true",
        help="Disable official PDF page restructuring.",
    )
    args = parser.parse_args()

    manifest = parse_document(
        args.input,
        args.output_dir,
        vl_server_url=args.vl_server_url,
        vl_model_name=args.vl_model_name,
        restructure_pages=not args.no_restructure_pages,
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
