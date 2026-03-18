import sqlite3
from pathlib import Path

import chardet
import pandas as pd
import yaml
import toml
from loguru import logger

from converters.base import BaseConverter, ProgressCallback
from converters.pdf_templates import generate_pdf_css


class DataConverter(BaseConverter):
    async def convert(
        self,
        input_path: Path,
        output_format: str,
        options: dict,
        on_progress: ProgressCallback | None = None,
    ) -> Path:
        ext = input_path.suffix.lower().lstrip(".")
        output_dir = input_path.parent.parent / "output"
        output_dir.mkdir(parents=True, exist_ok=True)
        stem = input_path.stem
        output_path = output_dir / f"{stem}.{output_format}"

        if on_progress:
            await on_progress(20)

        df = self._read_input(input_path, ext, options)

        if on_progress:
            await on_progress(60)

        self._write_output(df, output_path, output_format, options)

        if on_progress:
            await on_progress(95)

        logger.info(f"Data converted: {input_path.name} → {output_path.name}")
        return output_path

    def _detect_encoding(self, path: Path) -> str:
        raw = path.read_bytes()
        detected = chardet.detect(raw)
        return detected.get("encoding", "utf-8") or "utf-8"

    def _read_input(self, path: Path, ext: str, options: dict) -> pd.DataFrame:
        encoding = options.get("encoding", "auto")
        if encoding == "auto":
            encoding = self._detect_encoding(path)

        header_row = options.get("headerRow", True)
        header = 0 if header_row else None

        if ext in ("csv", "tsv"):
            delimiter = options.get("delimiter", "auto")
            if delimiter == "auto":
                delimiter = "\t" if ext == "tsv" else ","
            return pd.read_csv(path, sep=delimiter, encoding=encoding, header=header)

        if ext in ("xlsx", "xls"):
            sheet = options.get("sheet")
            return pd.read_excel(path, sheet_name=sheet or 0, header=header)

        if ext == "ods":
            sheet = options.get("sheet")
            return pd.read_excel(path, engine="odf", sheet_name=sheet or 0, header=header)

        if ext == "json":
            return pd.read_json(path, encoding=encoding)

        if ext == "xml":
            return pd.read_xml(path, encoding=encoding)

        if ext in ("yaml", "yml"):
            with open(path, encoding=encoding) as f:
                data = yaml.safe_load(f)
            if isinstance(data, list):
                return pd.DataFrame(data)
            if isinstance(data, dict):
                for v in data.values():
                    if isinstance(v, list):
                        return pd.DataFrame(v)
                return pd.DataFrame([data])
            return pd.DataFrame([{"value": data}])

        if ext == "toml":
            with open(path, encoding=encoding) as f:
                data = toml.load(f)
            for v in data.values():
                if isinstance(v, list):
                    return pd.DataFrame(v)
            return pd.DataFrame([data])

        if ext == "parquet":
            return pd.read_parquet(path)

        if ext in ("db", "sqlite"):
            conn = sqlite3.connect(str(path))
            try:
                tables = pd.read_sql(
                    "SELECT name FROM sqlite_master WHERE type='table'", conn
                )
                if tables.empty:
                    raise ValueError("No tables found in SQLite database")
                table_name = tables.iloc[0]["name"]
                return pd.read_sql(f'SELECT * FROM "{table_name}"', conn)
            finally:
                conn.close()

        raise ValueError(f"Unsupported input format: {ext}")

    def _write_output(
        self, df: pd.DataFrame, output_path: Path, fmt: str, options: dict
    ) -> None:
        if fmt == "csv":
            delimiter = options.get("delimiter", ",")
            if delimiter == "auto":
                delimiter = ","
            df.to_csv(output_path, sep=delimiter, index=False)

        elif fmt == "tsv":
            df.to_csv(output_path, sep="\t", index=False)

        elif fmt == "xlsx":
            df.to_excel(output_path, index=False, engine="openpyxl")

        elif fmt == "json":
            df.to_json(output_path, orient="records", indent=2, force_ascii=False)

        elif fmt == "xml":
            df.to_xml(output_path, index=False)

        elif fmt in ("yaml", "yml"):
            records = df.to_dict("records")
            with open(output_path, "w", encoding="utf-8") as f:
                yaml.dump(records, f, allow_unicode=True, default_flow_style=False)

        elif fmt == "toml":
            records = df.to_dict("records")
            with open(output_path, "w", encoding="utf-8") as f:
                toml.dump({"data": records}, f)

        elif fmt == "parquet":
            df.to_parquet(output_path, index=False)

        elif fmt == "md":
            md_table = df.to_markdown(index=False)
            output_path.write_text(md_table or "", encoding="utf-8")

        elif fmt == "html":
            html = df.to_html(index=False, classes="data-table", border=1)
            full_html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Data Table</title>
<style>
.data-table {{ border-collapse: collapse; width: 100%; }}
.data-table th, .data-table td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
.data-table th {{ background: #f5f5f5; }}
.data-table tr:nth-child(even) {{ background: #fafafa; }}
</style></head><body>{html}</body></html>"""
            output_path.write_text(full_html, encoding="utf-8")

        elif fmt == "sql":
            self._write_sql(df, output_path)

        elif fmt == "pdf":
            self._write_pdf_table(df, output_path, options)

        else:
            raise ValueError(f"Unsupported output format: {fmt}")

    def _write_sql(self, df: pd.DataFrame, output_path: Path) -> None:
        table_name = output_path.stem
        lines = []

        col_defs = []
        for col in df.columns:
            dtype = df[col].dtype
            if pd.api.types.is_integer_dtype(dtype):
                sql_type = "INTEGER"
            elif pd.api.types.is_float_dtype(dtype):
                sql_type = "REAL"
            else:
                sql_type = "TEXT"
            col_defs.append(f'  "{col}" {sql_type}')

        lines.append(f'CREATE TABLE "{table_name}" (')
        lines.append(",\n".join(col_defs))
        lines.append(");")
        lines.append("")

        for _, row in df.iterrows():
            values = []
            for val in row:
                if pd.isna(val):
                    values.append("NULL")
                elif isinstance(val, str):
                    values.append("'" + val.replace("'", "''") + "'")
                else:
                    values.append(str(val))
            cols = ", ".join(f'"{c}"' for c in df.columns)
            vals = ", ".join(values)
            lines.append(f'INSERT INTO "{table_name}" ({cols}) VALUES ({vals});')

        output_path.write_text("\n".join(lines), encoding="utf-8")

    def _write_pdf_table(
        self, df: pd.DataFrame, output_path: Path, options: dict
    ) -> None:
        from weasyprint import HTML, CSS

        html_table = df.to_html(index=False, classes="data-table", border=1)
        full_html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body>{html_table}</body></html>"""

        css_string = generate_pdf_css(options)
        css_string += """
.data-table { border-collapse: collapse; width: 100%; font-size: 10pt; }
.data-table th, .data-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
.data-table th { background: #f0f0f0; font-weight: bold; }
"""

        HTML(string=full_html).write_pdf(
            str(output_path), stylesheets=[CSS(string=css_string)]
        )

