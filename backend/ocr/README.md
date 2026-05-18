# AuditMind OCR Pipeline

AuditMind uses the official PaddleOCR-VL pipeline for document parsing.

Do not call the PaddleOCR-VL `/v1/chat/completions` endpoint directly for the product OCR path. The VLM endpoint is only the recognition backend. The official pipeline adds the required document parsing steps:

1. Optional document orientation classification
2. Optional document unwarping
3. Layout detection
4. Element crop generation
5. VLM recognition through PaddleOCR-VL
6. Reading-order merge
7. JSON and Markdown output
8. Optional PDF page restructuring

## Default Local Endpoints

```txt
PaddleOCR-VL VLM server: http://192.168.0.10:8118/v1
Model name: PaddleOCR-VL-1.5-0.9B
```

These can be overridden:

```sh
export AUDITMIND_PADDLEOCR_VL_SERVER_URL="http://gx10-f0e1:8118/v1"
export AUDITMIND_PADDLEOCR_VL_MODEL="PaddleOCR-VL-1.5-0.9B"
```

## Python Environment

Install PaddleOCR's official document parser package in a Python environment that can reach the PaddleOCR-VL VLM server:

```sh
python -m venv .venv_ocr
source .venv_ocr/bin/activate
pip install "paddleocr[doc-parser]"
```

The official docs recommend keeping inference acceleration dependencies in a separate virtual environment because they can conflict with PaddlePaddle dependencies.

## Run

```sh
python backend/ocr/paddleocr_vl_pipeline.py ./sample.pdf --output-dir ./ocr-output/sample
```

The wrapper writes:

- PaddleOCR official JSON output
- PaddleOCR official Markdown output
- `auditmind_ocr_manifest.json`

Downstream AuditMind processing should pass the saved JSON/Markdown artifacts to Qwen3.6 for document classification, checklist matching, and evidence reasoning.

## Product Rule

Product OCR path:

```txt
uploaded file
-> official PaddleOCRVL pipeline
-> official JSON/Markdown artifacts
-> Qwen3.6 reasoning
-> customer checklist matching
```

Direct VLM chat-completions calls are allowed only for experiments or fallback debugging, not as the default product path.
