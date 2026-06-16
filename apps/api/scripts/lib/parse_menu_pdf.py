#!/usr/bin/env python3
"""
Parse EATFIT tech-card PDF into menu.json + photos/.

Usage:
  python3 apps/api/scripts/lib/parse_menu_pdf.py [path/to/file.pdf] [output_dir]
"""

from __future__ import annotations

import io
import json
import os
import re
import sys
from pathlib import Path

try:
    import pypdf
    from PIL import Image
except ImportError as exc:
    print("Missing deps: pip3 install pypdf Pillow pymupdf", file=sys.stderr)
    raise SystemExit(1) from exc

DEFAULT_PDF = Path.home() / "Downloads" / "EATFIT_all_techcards_combined_full_nutrients.pdf"
BUSINESS_ID = "c12704d8-0e0d-4226-94b9-e84d43cb76dc"
PLACEHOLDER_PRICE = int(os.environ.get("MENU_SEED_PRICE", "50000"))
ALL_DAYS = [1, 2, 3, 4, 5, 6, 7]

HEADER_NOISE = re.compile(
    r"^EAT & FIT ·.*$|^Документ создан для внутреннего использования кухни$",
    re.M,
)
SECTION_SKIP = {
    "СОСТАВ И ГРАММОВКА",
    "ТЕХНОЛОГИЧЕСКИЙ ПРОЦЕСС",
    "ПИЩЕВАЯ ЦЕННОСТЬ",
    "ХРАНЕНИЕ И РАЗОГРЕВ",
    "АЛЛЕРГЕНЫ",
    "ХРАНЕНИЕ И РАЗОГРЕВ",
    "СОСТАВ И ГРАММОВКА",
}

NUTRIENT_MAP = {
    "энергетическая ценность": "calories",
    "калории": "calories",
    "белки": "protein",
    "жиры (всего)": "fat",
    "жиры": "fat",
    "углеводы": "carbs",
    "пищевые волокна": "fiber",
    "волокна": "fiber",
    "натрий": "sodium",
    "калий": "potassium",
    "кальций": "calcium",
    "магний": "magnesium",
    "железо": "iron",
    "витамин a": "vitaminA",
    "витамин c": "vitaminC",
    "витамин e": "vitaminE",
    "насыщенные": "saturatedFat",
    "сахара": "sugars",
}


def slugify(name: str) -> str:
    s = name.lower()
    tr = {
        "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
        "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
        "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
        "ф": "f", "х": "h", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "sch",
        "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
    }
    out = []
    for ch in s:
        if ch in tr:
            out.append(tr[ch])
        elif ch.isalnum():
            out.append(ch)
        else:
            out.append("-")
    slug = re.sub(r"-+", "-", "".join(out)).strip("-")
    return slug[:60] or "dish"


def clean_text(text: str) -> str:
    text = HEADER_NOISE.sub("", text)
    text = text.replace("\u00a0", " ").replace("\uf0b7", "•")
    return text.strip()


def lines(text: str) -> list[str]:
    return [ln.strip() for ln in text.splitlines() if ln.strip()]


def is_bowl_title(line: str) -> bool:
    m = re.match(r"^(\d{1,2})\.\s+(.+)$", line)
    if not m:
        return False
    title = m.group(2).strip()
    upper = title.upper()
    if upper in SECTION_SKIP or upper.startswith("СОСТАВ") or upper.startswith("ТЕХНОЛОГ"):
        return False
    if re.match(r"^\d+\.\s", title):
        return False
    letters = [c for c in title if c.isalpha()]
    if len(letters) < 8:
        return False
    cyr_upper = sum(1 for c in letters if "А" <= c <= "Я" or c in "Ё")
    return cyr_upper >= len(letters) * 0.7 and title == upper


def parse_weight(text: str) -> int | None:
    m = re.search(r"Выход:\s*~?(\d+)\s*г", text, re.I)
    return int(m.group(1)) if m else None


def parse_description(text: str) -> str | None:
    m = re.search(r"Краткое описание\s*\n(.+?)(?:\nКалории|\nПроверка:|\n1\.\s)", text, re.S)
    if not m:
        m = re.search(r"\[Фото блюда\]\s*Краткое описание\s*\n(.+?)(?:\nКалории|\n1\.\s)", text, re.S)
    if not m:
        return None
    desc = re.sub(r"\s+", " ", m.group(1)).strip()
    return desc or None


def parse_summary_nutrition(text: str) -> dict | None:
    nut = {"calories": None, "protein": None, "fat": None, "carbs": None}
    patterns = {
        "calories": r"Калории\s+(\d+(?:[.,]\d+)?)\s*ккал",
        "protein": r"Белки\s+(\d+(?:[.,]\d+)?)\s*г",
        "fat": r"Жиры\s+(\d+(?:[.,]\d+)?)\s*г",
        "carbs": r"Углеводы\s+(\d+(?:[.,]\d+)?)\s*г",
    }
    for key, pat in patterns.items():
        m = re.search(pat, text)
        if m:
            nut[key] = float(m.group(1).replace(",", "."))
    return nut if any(v is not None for v in nut.values()) else None


def empty_extended() -> dict:
    return {
        "calories": None, "protein": None, "fat": None, "carbs": None,
        "fiber": None, "saturatedFat": None, "sugars": None,
        "sodium": None, "potassium": None, "calcium": None,
        "magnesium": None, "iron": None,
        "vitaminA": None, "vitaminC": None, "vitaminE": None,
    }


def parse_number(raw: str) -> float | None:
    raw = raw.strip().replace(",", ".")
    if raw in ("", "—", "-"):
        return None
    m = re.search(r"([\d.]+)", raw)
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


def parse_calories_value(raw: str) -> float | None:
    raw = raw.strip()
    m = re.search(r"([\d.]+)\s*ккал", raw, re.I)
    if m:
        return float(m.group(1))
    return parse_number(raw)


def parse_nutrition_table(text: str) -> dict | None:
    section = re.search(
        r"(?:3\.\s*Пищевая ценность|3\.\s*ПИЩЕВАЯ ЦЕННОСТЬ)(.+?)(?:4\.\s*(?:Хранение|ХРАНЕНИЕ)|5\.\s*Аллерген|5\.\s*АЛЛЕРГЕН|$)",
        text,
        re.S | re.I,
    )
    if not section:
        return None

    per_portion = empty_extended()
    per_100g = empty_extended()
    in_table = False

    for raw_ln in lines(section.group(1)):
        ln = raw_ln.lower()
        if "нутриент" in ln and "порцию" in ln:
            in_table = True
            continue
        if not in_table:
            continue
        if ln.startswith("—"):
            key_part = ln.lstrip("— ").strip()
            parts = raw_ln.split()
            if len(parts) >= 3:
                field = NUTRIENT_MAP.get(key_part)
                if field:
                    per_portion[field] = parse_number(parts[-2])
                    per_100g[field] = parse_number(parts[-1])
            continue

        matched_key = None
        for label, field in NUTRIENT_MAP.items():
            if ln.startswith(label):
                matched_key = (label, field)
                break
        if not matched_key:
            continue

        label, field = matched_key
        rest = raw_ln[len(label) :].strip() if raw_ln.lower().startswith(label) else raw_ln
        nums = re.findall(r"([\d.,]+(?:\s*ккал)?(?:\s*мг|\s*мкг|\s*г)?|—|-)", rest)
        if len(nums) >= 2:
            v1 = parse_calories_value(nums[0]) if field == "calories" else parse_number(nums[0])
            v2 = parse_calories_value(nums[1]) if field == "calories" else parse_number(nums[1])
            per_portion[field] = v1
            per_100g[field] = v2
        elif len(nums) == 1:
            per_portion[field] = parse_calories_value(nums[0]) if field == "calories" else parse_number(nums[0])

    if not any(v is not None for v in per_portion.values()):
        return None
    return {"perPortion": per_portion, "per100g": per_100g}


def is_amount_line(line: str) -> bool:
    s = line.strip()
    if not s or s == "—":
        return False
    if "по вкусу" in s.lower():
        return True
    if re.match(r"^~?[\d.,]+\s*(?:г|мл)\b", s):
        return True
    if re.match(r"^~?[\d.,]+\s*г\s+~?[\d.,]+\s*г\s*$", s):
        return True
    if re.match(r"^~?[\d.,]+\s*мл\s+~?[\d.,]+\s*мл\s*$", s):
        return True
    return False


def is_section_header(line: str) -> bool:
    s = line.strip()
    if not s or len(s) > 60:
        return False
    if s.lower() in {"ингредиент", "количество", "на порцию", "на 100 г"}:
        return False
    if re.search(r"\d", s):
        return False
    if s.isupper():
        return True
    if s.endswith(("СЕЙТАН", "СОУС", "КАРРИ")):
        return True
    return s.lower() in {"основа", "специи и добавки"}


def normalize_section(line: str) -> str:
    s = line.strip()
    if s.isupper():
        return s.title()
    return s


def looks_like_ingredient_name(name: str) -> bool:
    s = name.strip()
    if len(s) < 2:
        return False
    if s.lower().startswith("ингредиент"):
        return False
    if re.match(r"^[\d~.,\s]+(?:г|мл)\b", s):
        return False
    if re.fullmatch(r"[\d.,\s~гмл]+", s):
        return False
    return True


def append_ingredient(
    result: list[dict],
    seen: set[tuple],
    name: str,
    amount: str,
    section: str | None,
) -> None:
    name = re.sub(r"\s+", " ", name).strip()
    amount = amount.strip()
    if not looks_like_ingredient_name(name):
        return
    key = (name, amount, section)
    if key in seen:
        return
    seen.add(key)
    gm = re.search(r"([\d.,]+)\s*г", amount)
    grams = parse_number(gm.group(1)) if gm else None
    result.append({
        "nameRu": name,
        "nameUz": name,
        "grams": int(grams) if grams is not None else None,
        "amountText": amount,
        "section": section,
    })


def parse_ingredients(text: str) -> list[dict]:
    section = re.search(
        r"(?:1\.\s*Состав и граммовка|1\.\s*СОСТАВ И ГРАММОВКА)(.+?)(?:2\.\s*(?:Технологический|ТЕХНОЛОГИЧЕСКИЙ)|3\.\s*(?:Пищевая|ПИЩЕВАЯ)|$)",
        text,
        re.S | re.I,
    )
    if not section:
        return []

    result: list[dict] = []
    seen: set[tuple] = set()
    current_section: str | None = None
    skip_headers = {"ингредиент", "количество", "на порцию", "на 100 г"}

    body_lines = lines(section.group(1))
    name_buf: list[str] = []
    i = 0
    while i < len(body_lines):
        raw_ln = body_lines[i]
        ln_lower = raw_ln.lower()

        if ln_lower in skip_headers:
            i += 1
            continue

        if is_section_header(raw_ln):
            current_section = normalize_section(raw_ln)
            name_buf = []
            i += 1
            continue

        # Packaged table: name ... portion ... per100g (single line)
        m_table = re.match(r"^(.+?)\s+~?([\d.,]+)\s*г\s+~?([\d.,]+)\s*г\s*$", raw_ln)
        if m_table and looks_like_ingredient_name(m_table.group(1)):
            name_buf = []
            append_ingredient(result, seen, m_table.group(1), f"{m_table.group(2).strip()} г", current_section)
            i += 1
            continue

        m_ml = re.match(r"^(.+?)\s+~?([\d.,]+)\s*мл\s+~?([\d.,]+)\s*мл\s*$", raw_ln)
        if m_ml and looks_like_ingredient_name(m_ml.group(1)):
            name_buf = []
            append_ingredient(result, seen, m_ml.group(1), f"{m_ml.group(2).strip()} мл", current_section)
            i += 1
            continue

        # Bowl inline: name + amount on same line
        m_inline = re.match(
            r"^(.+?)\s+(\d+(?:[.,]\d+)?\s*г|\d+(?:[.,]\d+)?\s*мл|.+?\([^)]+\)|по вкусу|щепотка.+)$",
            raw_ln,
        )
        if m_inline and looks_like_ingredient_name(m_inline.group(1)):
            name_buf = []
            append_ingredient(result, seen, m_inline.group(1), m_inline.group(2), current_section)
            i += 1
            continue

        if is_amount_line(raw_ln):
            if name_buf:
                append_ingredient(result, seen, " ".join(name_buf), raw_ln, current_section)
                name_buf = []
            i += 1
            continue

        if looks_like_ingredient_name(raw_ln):
            name_buf.append(raw_ln)
        else:
            name_buf = []
        i += 1

    return result


def parse_instructions(text: str) -> list[dict]:
    section = re.search(
        r"(?:2\.\s*Технологический процесс|2\.\s*ТЕХНОЛОГИЧЕСКИЙ ПРОЦЕСС)(.+?)(?:3\.\s*(?:Пищевая|ПИЩЕВАЯ)|4\.\s*(?:Хранение|ХРАНЕНИЕ)|$)",
        text,
        re.S | re.I,
    )
    if not section:
        return []

    steps: list[dict] = []
    buf: list[str] = []
    for raw_ln in lines(section.group(1)):
        if re.match(r"^\d+\.\s+", raw_ln) or raw_ln.startswith("•") or raw_ln.startswith("-"):
            if buf:
                step_text = " ".join(buf).strip()
                if step_text:
                    steps.append({"textRu": step_text, "textUz": step_text})
                buf = []
            buf.append(re.sub(r"^[\d]+\.\s*|^[•\-]\s*", "", raw_ln).strip())
        else:
            if buf:
                buf.append(raw_ln)
    if buf:
        step_text = " ".join(buf).strip()
        if step_text:
            steps.append({"textRu": step_text, "textUz": step_text})
    return steps


def parse_storage(text: str) -> dict | None:
    section = re.search(
        r"(?:4\.\s*Хранение и разогрев|4\.\s*ХРАНЕНИЕ И РАЗОГРЕВ)(.+?)(?:5\.\s*(?:Аллерген|АЛЛЕРГЕН)|ТЕХНОЛОГИЧЕСКАЯ КАРТА|$)",
        text,
        re.S | re.I,
    )
    if not section:
        return None

    body = section.group(1)
    storage_parts: list[str] = []
    reheat_parts: list[str] = []
    mode = None
    for raw_ln in lines(body):
        ln_lower = raw_ln.lower()
        if ln_lower.startswith("хранение"):
            mode = "storage"
            rest = re.sub(r"^хранение:?\s*", "", raw_ln, flags=re.I).strip()
            if rest:
                storage_parts.append(rest)
            continue
        if "разогрев" in ln_lower or "подача" in ln_lower:
            mode = "reheat"
            rest = re.sub(r"^(?:разогрев|подача)[^:]*:?\s*", "", raw_ln, flags=re.I).strip()
            if rest:
                reheat_parts.append(rest)
            continue
        if raw_ln.startswith("•"):
            chunk = raw_ln.lstrip("• ").strip()
            if mode == "storage":
                storage_parts.append(chunk)
            elif mode == "reheat":
                reheat_parts.append(chunk)
    storage = " ".join(storage_parts).strip() or None
    reheat = " ".join(reheat_parts).strip() or None
    if not storage and not reheat:
        return None
    return {
        "storageRu": storage,
        "reheatRu": reheat,
        "storageUz": storage,
        "reheatUz": reheat,
    }


def parse_allergens(text: str) -> dict | None:
    section = re.search(
        r"(?:5\.\s*Аллергены|5\.\s*АЛЛЕРГЕНЫ)(.+?)(?:ТЕХНОЛОГИЧЕСКАЯ КАРТА|Документ создан для|$)",
        text,
        re.S | re.I,
    )
    if not section:
        return None

    body = section.group(1)
    contains = None
    may_contain = None
    m1 = re.search(r"Содержит:\s*(.+?)(?:\.|Может содержать|$)", body, re.I | re.S)
    if m1:
        contains = re.sub(r"\s+", " ", m1.group(1)).strip(" .")
        if contains in ("—", "-", ""):
            contains = None
    m2 = re.search(r"Может содержать[^:]*:\s*(.+?)(?:\.|$)", body, re.I | re.S)
    if m2:
        may_contain = re.sub(r"\s+", " ", m2.group(1)).strip(" .")
    if not contains and not may_contain:
        return None
    return {
        "containsRu": contains,
        "containsUz": contains,
        "mayContainRu": may_contain,
        "mayContainUz": may_contain,
    }


def extract_photo(reader: pypdf.PdfReader, page_idx: int, out_path: Path, pdf_path: Path) -> bool:
    """Render and crop the dish photo region — embedded XObjects repeat on every page."""
    try:
        import fitz  # pymupdf
    except ImportError:
        fitz = None

    if fitz is not None:
        try:
            doc = fitz.open(str(pdf_path))
            page = doc[page_idx]
            rect = fitz.Rect(
                page.rect.width * 0.55,
                page.rect.height * 0.08,
                page.rect.width * 0.95,
                page.rect.height * 0.45,
            )
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), clip=rect)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            pix.save(str(out_path))
            doc.close()
            return True
        except Exception:
            pass

    # Fallback: largest non-template embedded image (often identical across pages).
    page = reader.pages[page_idx]
    best = None
    best_score = 0
    for _name, img in page.images.items():
        try:
            pil = Image.open(io.BytesIO(img.data))
        except Exception:
            continue
        w, h = pil.size
        if w < 200 or h < 200 or (w == 794 and h == 794):
            continue
        score = w * h + len(img.data)
        if score > best_score:
            best_score = score
            best = pil
    if not best:
        return False
    if best.mode not in ("RGB", "L"):
        best = best.convert("RGB")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    best.save(out_path, format="JPEG", quality=85)
    return True


def is_valid_tc_title(title: str) -> bool:
    if len(title) < 4:
        return False
    lower = title.lower()
    if "eat & fit" in lower or "технологические карты" in lower:
        return False
    if title.startswith("Документ создан"):
        return False
    return True


def join_wrapped_title(lines_list: list[str], idx: int) -> str:
    m = re.match(r"^(\d{1,2})\.\s+(.+)$", lines_list[idx])
    if not m:
        return lines_list[idx]
    num = m.group(1)
    parts = [m.group(2).strip()]
    j = idx + 1
    while j < len(lines_list):
        nxt = lines_list[j].strip()
        if not nxt or is_bowl_title(nxt) or nxt.lower().startswith("выход:"):
            break
        if re.match(r"^\d+\.\s+", nxt) or nxt.lower().startswith("краткое описание"):
            break
        if nxt == nxt.upper() and len(nxt) > 3:
            parts.append(nxt)
            j += 1
            continue
        break
    return f"{num}. {' '.join(parts)}"


def segment_dishes(reader: pypdf.PdfReader) -> list[dict]:
    segments: list[dict] = []

    # Bowl section: pages 3-26 (1-based) => indices 2-25, pairs
    bowl_end = min(26, len(reader.pages))
    for start in range(2, bowl_end, 2):
        end = min(start + 2, len(reader.pages))
        text = clean_text("\n".join(
            (reader.pages[i].extract_text() or "") for i in range(start, end)
        ))
        title = None
        raw_lines = lines(text)
        for i, ln in enumerate(raw_lines):
            joined = join_wrapped_title(raw_lines, i)
            if is_bowl_title(joined):
                title = re.sub(r"^\d{1,2}\.\s+", "", joined).strip()
                break
        if not title:
            continue
        segments.append({
            "kind": "bowl",
            "name": title,
            "text": text,
            "photo_page": start,
        })

    # Packaged section: split full text by TC markers (cards span page boundaries)
    combined_parts: list[str] = []
    page_offsets: list[tuple[int, int, int]] = []
    offset = 0
    for i in range(26, len(reader.pages)):
        chunk = reader.pages[i].extract_text() or ""
        combined_parts.append(chunk)
        page_offsets.append((i, offset, offset + len(chunk)))
        offset += len(chunk) + 1

    combined = "\n".join(combined_parts)
    markers = list(re.finditer(r"ТЕХНОЛОГИЧЕСКАЯ КАРТА\s*\n([^\n]+)", combined))
    for idx, m in enumerate(markers):
        title = m.group(1).strip()
        if not is_valid_tc_title(title):
            continue
        start_pos = m.start()
        end_pos = markers[idx + 1].start() if idx + 1 < len(markers) else len(combined)
        text = clean_text(combined[start_pos:end_pos])
        photo_page = 26
        for page_i, start_off, end_off in page_offsets:
            if start_off <= m.start() < end_off:
                photo_page = page_i
                break
        segments.append({
            "kind": "packaged",
            "name": title,
            "text": text,
            "photo_page": photo_page,
        })

    return segments


def parse_dish(segment: dict, index: int, photos_dir: Path, reader: pypdf.PdfReader, pdf_path: Path) -> dict:
    text = segment["text"]
    name = segment["name"]
    slug = slugify(name)
    photo_file = f"{index:02d}-{slug}.jpg"
    photo_path = photos_dir / photo_file
    has_photo = extract_photo(reader, segment["photo_page"], photo_path, pdf_path)
    if not has_photo:
        photo_file = None

    nutrition = parse_summary_nutrition(text)
    nutrition_detail = parse_nutrition_table(text)
    if nutrition_detail and nutrition:
        for k in ("calories", "protein", "fat", "carbs"):
            if nutrition.get(k) is not None:
                nutrition_detail["perPortion"][k] = nutrition[k]

    return {
        "category": "main",
        "nameRu": name,
        "nameUz": name,
        "descriptionRu": parse_description(text),
        "descriptionUz": parse_description(text),
        "price": PLACEHOLDER_PRICE,
        "isActive": True,
        "days": ALL_DAYS,
        "weightGrams": parse_weight(text),
        "price2": None,
        "weightGrams2": None,
        "orderDeadline": None,
        "nutrition": nutrition,
        "nutrition2": None,
        "nutritionDetail": nutrition_detail,
        "storageHandling": parse_storage(text),
        "ingredients": parse_ingredients(text) or None,
        "instructions": parse_instructions(text) or None,
        "allergens": parse_allergens(text),
        "tipRu": None,
        "tipUz": None,
        "photoFile": photo_file,
        "tags": [],
    }


def main() -> None:
    pdf_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PDF
    out_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parents[1] / "seed" / "eatfit-menu"
    photos_dir = out_dir / "photos"

    if not pdf_path.exists():
        print(f"PDF not found: {pdf_path}", file=sys.stderr)
        raise SystemExit(1)

    reader = pypdf.PdfReader(str(pdf_path))
    segments = segment_dishes(reader)
    print(f"Found {len(segments)} dish segments")

    photos_dir.mkdir(parents=True, exist_ok=True)
    items = []
    for i, seg in enumerate(segments, start=1):
        item = parse_dish(seg, i, photos_dir, reader, pdf_path)
        items.append(item)
        photo_status = item["photoFile"] or "no photo"
        print(f"  [{i:02d}] {item['nameRu']} ({photo_status})")

    payload = {"businessId": BUSINESS_ID, "items": items}
    out_dir.mkdir(parents=True, exist_ok=True)
    menu_json = out_dir / "menu.json"
    menu_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nWrote {menu_json} ({len(items)} items)")
    print(f"Photos: {photos_dir}")


if __name__ == "__main__":
    main()
