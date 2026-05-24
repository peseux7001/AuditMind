from __future__ import annotations

import tempfile
import unittest
import zipfile
import os
from pathlib import Path

from backend.document_processing import ProcessingOptions, process_upload_path


class FileProcessorTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.options = ProcessingOptions(max_file_bytes=1024 * 1024, text_sample_chars=4000)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def write(self, name: str, data: bytes | str) -> Path:
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(data, str):
            path.write_text(data, encoding="utf-8")
        else:
            path.write_bytes(data)
        return path

    def test_csv_is_extracted(self) -> None:
        path = self.write("카드매출.csv", "거래일,카드사,승인금액\n2025-01-03,국민카드,10000\n")
        result = process_upload_path(path, options=self.options)

        self.assertEqual(result["status"], "extracted")
        self.assertEqual(result["processor"], "csv")
        self.assertEqual(result["tables"][0]["headers"], ["거래일", "카드사", "승인금액"])

    def test_xlsx_is_extracted_without_macro_execution(self) -> None:
        path = self.root / "매출세금계산서합계표.xlsx"
        self.make_xlsx(path, sheet_name="매출", rows=[["거래처명", "공급가액", "세액"], ["A상사", "1000", "100"]])

        result = process_upload_path(path, options=self.options)

        self.assertEqual(result["status"], "extracted")
        self.assertEqual(result["processor"], "xlsx_xml")
        self.assertEqual(result["sheets"], ["매출"])
        self.assertEqual(result["tables"][0]["headers"], ["거래처명", "공급가액", "세액"])

    def test_docx_is_extracted(self) -> None:
        path = self.root / "주요매출계약서.docx"
        with zipfile.ZipFile(path, "w") as docx:
            docx.writestr(
                "word/document.xml",
                """<?xml version="1.0" encoding="UTF-8"?>
                <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
                  <w:body><w:p><w:r><w:t>주요 매출계약서</w:t></w:r></w:p></w:body>
                </w:document>""",
            )

        result = process_upload_path(path, options=self.options)

        self.assertEqual(result["status"], "extracted")
        self.assertEqual(result["processor"], "docx_xml")
        self.assertIn("주요 매출계약서", result["text"])

    def test_hwpx_is_extracted(self) -> None:
        path = self.root / "투자계약서.hwpx"
        with zipfile.ZipFile(path, "w") as hwpx:
            hwpx.writestr(
                "Contents/section0.xml",
                """<?xml version="1.0" encoding="UTF-8"?>
                <root><p><t>상환전환우선주 투자계약서</t></p><p><t>투자금액 100,000,000원</t></p></root>""",
            )

        result = process_upload_path(path, options=self.options)

        self.assertEqual(result["status"], "extracted")
        self.assertEqual(result["processor"], "hwpx_xml")
        self.assertIn("투자계약서", result["text"])

    def test_pdf_with_sparse_text_is_queued_for_ocr(self) -> None:
        path = self.write("스캔본.pdf", b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\n")
        result = process_upload_path(path, options=self.options)

        self.assertEqual(result["status"], "queued_ocr")
        self.assertEqual(result["processor"], "paddleocr_vl")

    def test_image_is_queued_for_ocr(self) -> None:
        path = self.write("영수증.heic", b"\x00\x00\x00\x18ftypheic")
        result = process_upload_path(path, options=self.options)

        self.assertEqual(result["status"], "queued_ocr")
        self.assertEqual(result["metadata"]["queueReason"], "image_ocr_required")

    def test_zip_expands_children_and_preserves_provenance(self) -> None:
        path = self.root / "자료모음.zip"
        with zipfile.ZipFile(path, "w") as archive:
            archive.writestr("매출/카드매출.csv", "거래일,승인금액\n2025-01-03,10000\n")
            archive.writestr("스캔/영수증.png", b"\x89PNG\r\n")
            archive.writestr("메모/readme.txt", "고객이 같이 넣은 설명 파일\n")

        result = process_upload_path(path, options=self.options)

        self.assertEqual(result["status"], "expanded")
        self.assertEqual(len(result["children"]), 2)
        self.assertEqual(result["metadata"]["ignoredMemberCount"], 1)
        self.assertEqual(result["children"][0]["container"], "자료모음.zip")
        self.assertEqual(result["children"][0]["internalPath"], "매출/카드매출.csv")
        self.assertEqual(result["children"][0]["status"], "extracted")
        self.assertEqual(result["children"][1]["status"], "queued_ocr")

    def test_zip_path_traversal_is_rejected(self) -> None:
        path = self.root / "unsafe.zip"
        with zipfile.ZipFile(path, "w") as archive:
            archive.writestr("../evil.csv", "a,b\n1,2\n")

        result = process_upload_path(path, options=self.options)

        self.assertEqual(result["status"], "rejected")
        self.assertEqual(result["error"]["code"], "unsafe_archive_path")

    def test_legacy_binary_formats_are_routed_to_conversion(self) -> None:
        for filename in ["장부.xls", "계약서.doc", "정관.hwp"]:
            with self.subTest(filename=filename):
                path = self.write(filename, b"\xd0\xcf\x11\xe0 legacy binary sample")
                result = process_upload_path(path, options=self.options)
                if result["status"] == "extracted":
                    self.assertIn(result["processor"], {"python_calamine", "antiword", "hwp5txt", "docx_xml", "pdf_text_probe"})
                else:
                    self.assertEqual(result["status"], "needs_conversion")
                    self.assertEqual(result["metadata"]["macroPolicy"], "ignore_never_execute")

    def test_doc_uses_antiword_when_available(self) -> None:
        path = self.write("구형계약서.doc", b"\xd0\xcf\x11\xe0 legacy doc sample")
        with self.fake_path_command("antiword", "printf '구형 워드 계약서 본문\\n'"):
            result = process_upload_path(path, options=self.options)

        self.assertEqual(result["status"], "extracted")
        self.assertEqual(result["processor"], "antiword")
        self.assertIn("구형 워드 계약서 본문", result["text"])

    def test_hwp_uses_hwp5txt_when_available(self) -> None:
        path = self.write("구형한글.hwp", b"\xd0\xcf\x11\xe0 legacy hwp sample")
        with self.fake_path_command("hwp5txt", "printf '구형 한글 정관 본문\\n'"):
            result = process_upload_path(path, options=self.options)

        self.assertEqual(result["status"], "extracted")
        self.assertEqual(result["processor"], "hwp5txt")
        self.assertIn("구형 한글 정관 본문", result["text"])

    def test_7z_is_not_a_customer_supported_archive(self) -> None:
        path = self.write("자료.7z", b"7z\xbc\xaf\x27\x1c")
        result = process_upload_path(path, options=self.options)

        self.assertEqual(result["status"], "rejected")
        self.assertEqual(result["error"]["code"], "unsupported_extension")

    def test_executable_is_rejected(self) -> None:
        path = self.write("악성.exe", b"MZ")
        result = process_upload_path(path, options=self.options)

        self.assertEqual(result["status"], "rejected")
        self.assertEqual(result["error"]["code"], "unsupported_executable")

    @staticmethod
    def make_xlsx(path: Path, *, sheet_name: str, rows: list[list[str]]) -> None:
        shared_strings = []
        shared_index = {}

        def shared(value: str) -> int:
            if value not in shared_index:
                shared_index[value] = len(shared_strings)
                shared_strings.append(value)
            return shared_index[value]

        row_xml = []
        for row_number, row in enumerate(rows, start=1):
            cells = []
            for col_index, value in enumerate(row):
                cell_ref = f"{chr(ord('A') + col_index)}{row_number}"
                cells.append(f'<c r="{cell_ref}" t="s"><v>{shared(value)}</v></c>')
            row_xml.append(f'<row r="{row_number}">{"".join(cells)}</row>')

        shared_xml = "".join(f"<si><t>{value}</t></si>" for value in shared_strings)
        with zipfile.ZipFile(path, "w") as xlsx:
            xlsx.writestr(
                "xl/workbook.xml",
                f"""<?xml version="1.0" encoding="UTF-8"?>
                <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
                  <sheets><sheet name="{sheet_name}" sheetId="1" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></sheets>
                </workbook>""",
            )
            xlsx.writestr(
                "xl/sharedStrings.xml",
                f"""<?xml version="1.0" encoding="UTF-8"?>
                <sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">{shared_xml}</sst>""",
            )
            xlsx.writestr(
                "xl/worksheets/sheet1.xml",
                f"""<?xml version="1.0" encoding="UTF-8"?>
                <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
                  <sheetData>{"".join(row_xml)}</sheetData>
                </worksheet>""",
            )

    class fake_path_command:
        def __init__(self, command_name: str, shell_body: str) -> None:
            self.command_name = command_name
            self.shell_body = shell_body
            self.temp_dir = tempfile.TemporaryDirectory()
            self.old_path = os.environ.get("PATH", "")

        def __enter__(self):
            command_path = Path(self.temp_dir.name) / self.command_name
            command_path.write_text(f"#!/usr/bin/env sh\n{self.shell_body}\n", encoding="utf-8")
            command_path.chmod(0o755)
            os.environ["PATH"] = f"{self.temp_dir.name}{os.pathsep}{self.old_path}"
            return command_path

        def __exit__(self, exc_type, exc, tb):
            os.environ["PATH"] = self.old_path
            self.temp_dir.cleanup()


if __name__ == "__main__":
    unittest.main()
