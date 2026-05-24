# AuditMind OCR Pipeline

AuditMind's current OCR/document parsing path is the official PaddleOCR-VL pipeline, followed by Qwen3.6 multimodal document judgment.

## Current Product OCR Path

Active wrapper:

```txt
backend/ocr/paddleocr_vl_pipeline.py
```

Official pipeline shape:

```txt
PaddleOCRVL
-> PP-LCNet_x1_0_doc_ori
-> UVDoc
-> PP-DocLayoutV3
-> PaddleOCR-VL-1.5-0.9B through vllm-server
-> official JSON/Markdown artifacts
```

The PaddleOCR-VL `/v1/chat/completions` endpoint is only the VLM recognition backend. Do not call it directly as the product OCR path. The product path must go through `PaddleOCRVL` so orientation, unwarping, layout detection, element recognition, reading-order merge, and JSON/Markdown output are preserved.

## Local PaddleOCR Environment

```txt
Python: /Users/peseux7001/.local/bin/python3.12
Virtualenv: .venv-paddleocr
Install: .venv-paddleocr/bin/python -m pip install "paddleocr[doc-parser]" paddlepaddle
Cache: PADDLE_PDX_CACHE_HOME="$PWD/.paddlex-cache"
```

## Current PaddleOCR-VL Endpoint

```txt
VLM backend base: http://100.126.53.70:8118/v1
Model name: PaddleOCR-VL-1.5-0.9B
```

## Run

```sh
PADDLE_PDX_CACHE_HOME="$PWD/.paddlex-cache" \
  .venv-paddleocr/bin/python backend/ocr/paddleocr_vl_pipeline.py \
  ./sample.pdf \
  --output-dir ./ocr-output/sample \
  --vl-server-url http://100.126.53.70:8118/v1 \
  --vl-model-name PaddleOCR-VL-1.5-0.9B
```

The wrapper writes:

- PaddleOCR official JSON output
- PaddleOCR official Markdown output
- `auditmind_ocr_manifest.json`

Downstream AuditMind processing should pass the saved JSON/Markdown artifacts to Qwen3.6 together with the original page image or a layout-preserving rendered image.

Important: OCR text alone is not enough for final Qwen field judgment. For visual/layout-heavy Korean documents, Qwen must receive the original visual evidence together with OCR JSON/Markdown artifacts. OCR-only Qwen calls are diagnostic and may only explain extraction failure.

## Current PaddleOCR-VL Official Pipeline Result

Approved sample:

```txt
tmp/ocr-samples/1f9cf99418d811ebb30606f6a435f0e7.png
```

Output path:

```txt
tmp/ocr-output/bankbook-paddle-pipeline/
```

Observed result:

- The official pipeline executed successfully and saved JSON/Markdown artifacts.
- Core bankbook anchors were partially useful: account holder, account number, product name, branch clues, issue/open date, and phone number were detected.
- Some Korean labels and long notice/table text were still badly misrecognized.
- This result is better structured than a raw VLM call, but it is not sufficient by itself for automatic approval of Korean bankbook scans.
- AuditMind should treat this as candidate extraction and require Qwen plus required-field coverage plus human review for ambiguous or low-quality cases.

## Qwen3.6 Endpoint

```txt
Base: http://100.120.165.93:8090
Health: http://100.120.165.93:8090/health
Models: http://100.120.165.93:8090/v1/models
Chat: POST http://100.120.165.93:8090/v1/chat/completions
Model: Qwen3.6-35B-A3B-UD-Q8_K_XL.gguf
Checks: /health OK, /v1/models OK
```

Binding note:

- The Qwen service is currently bound only to `127.0.0.1` and Tailscale IP.
- LAN `192.168.0.11` is not opened.
