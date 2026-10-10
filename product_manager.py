"""Tkinter GUI for adding products to the static_app catalog."""

from __future__ import annotations

import json
import math
import os
import re
import shutil
import tempfile
import tkinter as tk
import unicodedata
import copy
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

try:
    from PIL import Image, ImageTk
except ImportError:  # Image names and links still work without Pillow.
    Image = ImageTk = None


STATIC_DIR = Path(__file__).resolve().parent
DATA_DIR = STATIC_DIR / "data"
CATALOG_FILE = DATA_DIR / "catalog.json"
MATERIALS_FILE = DATA_DIR / "materials.json"
CATALOG_IMAGES_DIR = STATIC_DIR / "app" / "static" / "catalog"
MATERIAL_IMAGES_DIR = STATIC_DIR / "app" / "static" / "materials"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def read_json(path: Path):
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def slugify(value: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", ascii_value.lower()).strip("-")


def split_values(value: str) -> list[str]:
    result = []
    seen = set()
    for item in re.split(r"[,;\n]", value):
        item = item.strip()
        key = item.casefold()
        if item and key not in seen:
            result.append(item)
            seen.add(key)
    return result


def optional_price(value: str, label: str) -> float | None:
    value = value.strip().replace(",", ".")
    if not value:
        return None
    try:
        price = float(value)
    except ValueError as error:
        raise ValueError(f"Il campo '{label}' deve contenere un numero valido.") from error
    if not math.isfinite(price):
        raise ValueError(f"Il campo '{label}' deve contenere un numero finito.")
    if price < 0:
        raise ValueError(f"Il campo '{label}' non può essere negativo.")
    return price


def json_temp_file(target: Path, data) -> Path:
    target.parent.mkdir(parents=True, exist_ok=True)
    handle = tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        newline="\n",
        suffix=".tmp",
        prefix=f".{target.name}.",
        dir=target.parent,
        delete=False,
    )
    temp_path = Path(handle.name)
    try:
        with handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
    except Exception:
        temp_path.unlink(missing_ok=True)
        raise
    return temp_path


def atomic_write_json(target: Path, data) -> None:
    temp_path = json_temp_file(target, data)
    try:
        os.replace(temp_path, target)
    finally:
        temp_path.unlink(missing_ok=True)


class ProductManager(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Gestione prodotti - 3D__PrintHub")
        self.geometry("1180x820")
        self.minsize(900, 650)

        try:
            self.products = read_json(CATALOG_FILE)
            self.materials = read_json(MATERIALS_FILE)
            if not isinstance(self.products, list) or not isinstance(self.materials, list):
                raise ValueError("catalog.json e materials.json devono contenere una lista JSON.")
        except (OSError, json.JSONDecodeError, ValueError) as error:
            messagebox.showerror("Errore di lettura", f"Impossibile leggere i dati del sito:\n\n{error}")
            self.destroy()
            return

        self.image_rows: dict[str, dict] = {}
        self.variant_rows: dict[str, dict] = {}
        self.material_color_rows: dict[str, dict] = {}
        self.editing_slug: str | None = None
        self.editing_material_name: str | None = None
        self.image_counter = 0
        self.variant_counter = 0
        self.material_color_counter = 0
        self.preview_photo = None
        self.material_sample_source: Path | None = None

        self._build_window()
        self._refresh_catalog()
        self._refresh_quick_products()
        self._refresh_materials()
        self._refresh_reference_values()

    def _build_window(self):
        self.columnconfigure(0, weight=1)
        self.columnconfigure(1, weight=0)
        self.rowconfigure(1, weight=1)

        ttk.Label(
            self,
            text="Catalogo prodotti",
            font=("Segoe UI", 18, "bold"),
        ).grid(row=0, column=0, sticky="w", padx=14, pady=(12, 4))
        ttk.Button(self, text="Apri scheda nuova", command=self._start_new_product).grid(
            row=0, column=1, sticky="e", padx=14, pady=(12, 4)
        )

        self.tabs = ttk.Notebook(self)
        self.tabs.grid(row=1, column=0, columnspan=2, sticky="nsew", padx=10, pady=(4, 8))
        self.catalog_tab = ttk.Frame(self.tabs, padding=10)
        self.quick_tab = ttk.Frame(self.tabs, padding=10)
        self.materials_tab = ttk.Frame(self.tabs, padding=10)
        self.tabs.add(self.catalog_tab, text="Prodotti esistenti")
        self.tabs.add(self.quick_tab, text="Selezione rapida")
        self.tabs.add(self.materials_tab, text="Materiali")
        self._build_catalog_tab()
        self._build_quick_tab()
        self._build_materials_tab()
        self._build_product_editor_window()

        self.status_var = tk.StringVar(value="Pronto")
        ttk.Label(self, textvariable=self.status_var, relief="sunken", anchor="w").grid(
            row=2, column=0, columnspan=2, sticky="ew", padx=10, pady=(0, 8)
        )

    def _build_catalog_tab(self):
        self.catalog_tab.columnconfigure(0, weight=2)
        self.catalog_tab.columnconfigure(1, weight=3)
        self.catalog_tab.rowconfigure(2, weight=1)

        ttk.Label(self.catalog_tab, text="Cerca per nome, categoria o slug").grid(
            row=0, column=0, sticky="w", pady=(0, 4)
        )
        self.search_var = tk.StringVar()
        search = ttk.Entry(self.catalog_tab, textvariable=self.search_var)
        search.grid(row=1, column=0, sticky="ew", padx=(0, 10), pady=(0, 8))
        self.search_var.trace_add("write", lambda *_: self._refresh_catalog())

        self.product_tree = ttk.Treeview(
            self.catalog_tab,
            columns=("category", "price"),
            show="tree headings",
            selectmode="browse",
        )
        self.product_tree.heading("#0", text="Prodotto")
        self.product_tree.heading("category", text="Categoria")
        self.product_tree.heading("price", text="Prezzo")
        self.product_tree.column("#0", width=210, minwidth=130)
        self.product_tree.column("category", width=135, minwidth=100)
        self.product_tree.column("price", width=80, minwidth=65, anchor="e")
        self.product_tree.grid(row=2, column=0, sticky="nsew", padx=(0, 10))
        self.product_tree.bind("<<TreeviewSelect>>", self._show_product)
        ttk.Button(
            self.catalog_tab,
            text="Modifica prodotto selezionato",
            command=self._edit_selected_product,
        ).grid(row=3, column=0, sticky="ew", padx=(0, 10), pady=(8, 0))

        right = ttk.Frame(self.catalog_tab)
        right.grid(row=0, column=1, rowspan=4, sticky="nsew")
        right.columnconfigure(0, weight=1)
        right.rowconfigure(1, weight=1)
        ttk.Label(right, text="Dettagli prodotto", font=("Segoe UI", 12, "bold")).grid(
            row=0, column=0, sticky="w", pady=(0, 5)
        )
        self.details = tk.Text(right, wrap="word", height=17, state="disabled")
        self.details.grid(row=1, column=0, sticky="nsew")
        detail_scroll = ttk.Scrollbar(right, orient="vertical", command=self.details.yview)
        detail_scroll.grid(row=1, column=1, sticky="ns")
        self.details.configure(yscrollcommand=detail_scroll.set)

        image_frame = ttk.LabelFrame(right, text="Immagini collegate", padding=6)
        image_frame.grid(row=2, column=0, columnspan=2, sticky="ew", pady=(8, 0))
        image_frame.columnconfigure(0, weight=1)
        image_frame.columnconfigure(1, weight=0)
        self.existing_images = ttk.Treeview(
            image_frame,
            columns=("color", "material"),
            show="tree headings",
            height=5,
        )
        self.existing_images.heading("#0", text="File")
        self.existing_images.heading("color", text="Colore")
        self.existing_images.heading("material", text="Materiale")
        self.existing_images.column("#0", width=240, minwidth=140)
        self.existing_images.column("color", width=120, minwidth=80)
        self.existing_images.column("material", width=100, minwidth=70)
        self.existing_images.grid(row=0, column=0, sticky="ew")
        self.existing_images.bind("<<TreeviewSelect>>", self._preview_selected_image)
        self.preview_label = ttk.Label(image_frame, text="Seleziona un'immagine", anchor="center", width=24)
        self.preview_label.grid(row=0, column=1, sticky="nsew", padx=(8, 0))

    def _build_quick_tab(self):
        self.quick_tab.columnconfigure(0, weight=1)
        self.quick_tab.rowconfigure(1, weight=1)
        ttk.Label(
            self.quick_tab,
            text="Seleziona più prodotti con Ctrl o Shift, poi applica le modifiche in blocco.",
        ).grid(row=0, column=0, sticky="w", pady=(0, 8))

        self.quick_tree = ttk.Treeview(
            self.quick_tab,
            columns=("category", "new", "best", "featured"),
            show="tree headings",
            selectmode="extended",
        )
        for key, label, width in (
            ("#0", "Prodotto", 300),
            ("category", "Categoria", 190),
            ("new", "Nuovo arrivo", 120),
            ("best", "Best seller", 110),
            ("featured", "In evidenza", 110),
        ):
            self.quick_tree.heading(key, text=label)
            self.quick_tree.column(key, width=width, minwidth=80)
        self.quick_tree.grid(row=1, column=0, sticky="nsew")

        controls = ttk.LabelFrame(self.quick_tab, text="Applica alla selezione", padding=10)
        controls.grid(row=2, column=0, sticky="ew", pady=(10, 0))
        for column in range(3):
            controls.columnconfigure(column, weight=1)
        ttk.Button(controls, text="Segna come nuovo arrivo", command=lambda: self._bulk_set_flag("is_new", True)).grid(
            row=0, column=0, sticky="ew", padx=3, pady=3
        )
        ttk.Button(controls, text="Rimuovi dai nuovi arrivi", command=lambda: self._bulk_set_flag("is_new", False)).grid(
            row=0, column=1, sticky="ew", padx=3, pady=3
        )
        ttk.Button(controls, text="Segna best seller", command=lambda: self._bulk_set_flag("best_seller", True)).grid(
            row=0, column=2, sticky="ew", padx=3, pady=3
        )
        ttk.Button(controls, text="Rimuovi best seller", command=lambda: self._bulk_set_flag("best_seller", False)).grid(
            row=1, column=0, sticky="ew", padx=3, pady=3
        )
        ttk.Button(controls, text="Metti in evidenza", command=lambda: self._bulk_set_flag("featured", True)).grid(
            row=1, column=1, sticky="ew", padx=3, pady=3
        )
        ttk.Button(controls, text="Rimuovi evidenza", command=lambda: self._bulk_set_flag("featured", False)).grid(
            row=1, column=2, sticky="ew", padx=3, pady=3
        )

        category_row = ttk.Frame(controls)
        category_row.grid(row=2, column=0, columnspan=3, sticky="ew", pady=(8, 0))
        ttk.Label(category_row, text="Categoria").pack(side="left")
        self.bulk_category_var = tk.StringVar()
        self.bulk_category_combo = ttk.Combobox(category_row, textvariable=self.bulk_category_var, state="normal")
        self.bulk_category_combo.pack(side="left", fill="x", expand=True, padx=8)
        ttk.Button(category_row, text="Applica categoria", command=self._bulk_set_category).pack(side="right")
        ttk.Button(controls, text="Aggiorna elenco", command=self._refresh_quick_products).grid(
            row=3, column=2, sticky="e", padx=3, pady=(8, 0)
        )

    def _build_materials_tab(self):
        self.materials_tab.columnconfigure(0, weight=1)
        self.materials_tab.columnconfigure(1, weight=2)
        self.materials_tab.rowconfigure(1, weight=1)
        ttk.Label(self.materials_tab, text="Materiali presenti nel sito").grid(
            row=0, column=0, sticky="w", pady=(0, 5)
        )
        self.material_tree = ttk.Treeview(
            self.materials_tab,
            columns=("colors",),
            show="tree headings",
            selectmode="browse",
        )
        self.material_tree.heading("#0", text="Materiale")
        self.material_tree.heading("colors", text="Colori")
        self.material_tree.column("#0", width=190, minwidth=130)
        self.material_tree.column("colors", width=80, minwidth=60, anchor="center")
        self.material_tree.grid(row=1, column=0, sticky="nsew", padx=(0, 10))
        self.material_tree.bind("<<TreeviewSelect>>", self._load_material)

        editor = ttk.Frame(self.materials_tab)
        editor.grid(row=0, column=1, rowspan=2, sticky="nsew")
        editor.columnconfigure(1, weight=1)
        editor.rowconfigure(4, weight=1)
        ttk.Label(editor, text="Dettagli materiale", font=("Segoe UI", 12, "bold")).grid(
            row=0, column=0, columnspan=2, sticky="w", pady=(0, 6)
        )
        self.material_name_var = tk.StringVar()
        self.material_properties_var = tk.StringVar()
        ttk.Label(editor, text="Nome *").grid(row=1, column=0, sticky="w", padx=(0, 8), pady=4)
        ttk.Entry(editor, textvariable=self.material_name_var).grid(row=1, column=1, sticky="ew", pady=4)
        ttk.Label(editor, text="Proprietà (separate da virgola)").grid(
            row=2, column=0, sticky="w", padx=(0, 8), pady=4
        )
        ttk.Entry(editor, textvariable=self.material_properties_var).grid(row=2, column=1, sticky="ew", pady=4)
        ttk.Label(editor, text="Descrizione").grid(row=3, column=0, sticky="nw", padx=(0, 8), pady=4)
        self.material_description = tk.Text(editor, height=3, wrap="word")
        self.material_description.grid(row=3, column=1, sticky="ew", pady=4)

        colors_frame = ttk.LabelFrame(editor, text="Colori e immagini campione", padding=8)
        colors_frame.grid(row=4, column=0, columnspan=2, sticky="nsew", pady=(8, 6))
        colors_frame.columnconfigure(0, weight=1)
        colors_frame.rowconfigure(0, weight=1)
        self.material_colors_tree = ttk.Treeview(
            colors_frame,
            columns=("sample",),
            show="tree headings",
            height=7,
            selectmode="browse",
        )
        self.material_colors_tree.heading("#0", text="Colore")
        self.material_colors_tree.heading("sample", text="Immagine campione")
        self.material_colors_tree.column("#0", width=180, minwidth=120)
        self.material_colors_tree.column("sample", width=240, minwidth=140)
        self.material_colors_tree.grid(row=0, column=0, sticky="nsew")
        self.material_colors_tree.bind("<<TreeviewSelect>>", self._load_material_color)

        color_controls = ttk.Frame(colors_frame)
        color_controls.grid(row=1, column=0, sticky="ew", pady=(7, 0))
        self.material_color_name_var = tk.StringVar()
        self.material_sample_label_var = tk.StringVar(value="Nessuna immagine selezionata")
        ttk.Label(color_controls, text="Nome colore").grid(row=0, column=0, sticky="w", padx=(0, 5))
        ttk.Entry(color_controls, textvariable=self.material_color_name_var, width=20).grid(row=0, column=1, sticky="ew")
        ttk.Button(color_controls, text="Scegli immagine...", command=self._choose_material_sample).grid(
            row=0, column=2, padx=5
        )
        ttk.Label(color_controls, textvariable=self.material_sample_label_var).grid(
            row=0, column=3, sticky="w"
        )
        color_controls.columnconfigure(3, weight=1)
        ttk.Button(color_controls, text="Aggiungi / aggiorna colore", command=self._save_material_color_row).grid(
            row=1, column=1, sticky="w", pady=(5, 0)
        )
        ttk.Button(color_controls, text="Rimuovi colore", command=self._remove_material_color).grid(
            row=1, column=2, sticky="w", pady=(5, 0)
        )

        actions = ttk.Frame(editor)
        actions.grid(row=5, column=0, columnspan=2, sticky="ew", pady=(5, 0))
        ttk.Button(actions, text="Nuovo materiale", command=self._clear_material_form).pack(side="left")
        ttk.Button(actions, text="Salva materiale", command=self._save_material).pack(side="right")

    def _build_product_editor_window(self):
        self.product_editor_window = tk.Toplevel(self)
        self.product_editor_window.title("Nuovo prodotto")
        self.product_editor_window.geometry("1180x700")
        self.product_editor_window.minsize(960, 620)
        self.product_editor_window.transient(self)
        self.product_editor_window.protocol("WM_DELETE_WINDOW", self._close_product_editor)
        self.product_editor_window.columnconfigure(0, weight=1)
        self.product_editor_window.rowconfigure(0, weight=1)
        self.product_editor_window.withdraw()

        self.form = ttk.Frame(self.product_editor_window, padding=10)
        self.form.grid(row=0, column=0, sticky="nsew")
        self.form.columnconfigure(0, weight=1, uniform="product-column")
        self.form.columnconfigure(1, weight=1, uniform="product-column")
        self.form.rowconfigure(0, weight=1)
        self.form.rowconfigure(1, weight=1)

        self._build_information_section()
        self._build_tags_section()
        self._build_images_section()
        self._build_variants_section()

        actions = ttk.Frame(self.form)
        actions.grid(row=2, column=0, columnspan=2, sticky="ew", pady=(8, 0))
        ttk.Button(actions, text="Azzera / nuovo", command=self._start_new_product).pack(side="left")
        ttk.Button(actions, text="Chiudi", command=self._close_product_editor).pack(side="left", padx=(8, 0))
        self.save_product_button = ttk.Button(actions, text="Aggiungi al catalogo", command=self._save_product)
        self.save_product_button.pack(side="right")

    def _show_product_editor(self):
        self.product_editor_window.deiconify()
        self.product_editor_window.lift()
        self.product_editor_window.focus_set()

    def _form_has_content(self) -> bool:
        text_fields = (self.short_description, self.description, self.shipping_note)
        text_present = any(widget.get("1.0", "end-1c").strip() for widget in text_fields)
        value_fields = (
            self.title_var,
            self.slug_var,
            self.base_price_var,
            self.discount_price_var,
            self.dimensions_var,
            self.materials_var,
            self.colors_var,
        )
        values_present = any(variable.get().strip() for variable in value_fields)
        non_default_fields = (
            self.category_var.get().strip().casefold() != "varie",
            self.availability_var.get().strip().casefold() != "su ordinazione",
            self.shipping_time_var.get().strip() != "4-7 giorni lavorativi",
        )
        flags_present = (
            self.featured_var.get()
            or self.best_seller_var.get()
            or self.is_custom_var.get()
            or not self.is_new_var.get()
        )
        return bool(
            self.editing_slug
            or text_present
            or values_present
            or any(non_default_fields)
            or self.image_rows
            or self.variant_rows
            or flags_present
        )

    def _confirm_discard_product_draft(self, action: str) -> bool:
        if not self._form_has_content():
            return True
        return messagebox.askyesno(
            "Modifiche non salvate",
            f"Ci sono dati non salvati. Vuoi scartarli e {action}?",
            parent=self.product_editor_window,
        )

    def _start_new_product(self):
        if not self._confirm_discard_product_draft("iniziare un nuovo prodotto"):
            return
        self._clear_form()
        self._show_product_editor()

    def _close_product_editor(self):
        if not self._confirm_discard_product_draft("chiudere il modulo"):
            return
        self._clear_form()
        self.product_editor_window.withdraw()

    def _build_information_section(self):
        section = ttk.LabelFrame(self.form, text="Informazioni del prodotto", padding=10)
        section.grid(row=0, column=0, sticky="nsew", padx=(0, 5), pady=(0, 5))
        for column in (1, 3):
            section.columnconfigure(column, weight=1)

        self.title_var = tk.StringVar()
        self.slug_var = tk.StringVar()
        self.category_var = tk.StringVar(value="Varie")
        self.availability_var = tk.StringVar(value="Su ordinazione")
        self.base_price_var = tk.StringVar()
        self.discount_price_var = tk.StringVar()
        self.dimensions_var = tk.StringVar()
        self.shipping_time_var = tk.StringVar(value="4-7 giorni lavorativi")

        ttk.Label(section, text="Nome prodotto *").grid(row=0, column=0, sticky="w", padx=(0, 8), pady=4)
        ttk.Entry(section, textvariable=self.title_var).grid(row=0, column=1, columnspan=3, sticky="ew", pady=4)

        ttk.Label(section, text="Slug URL *").grid(row=1, column=0, sticky="w", padx=(0, 8), pady=4)
        ttk.Entry(section, textvariable=self.slug_var).grid(row=1, column=1, columnspan=2, sticky="ew", pady=4)
        ttk.Button(section, text="Genera dal nome", command=self._generate_slug).grid(
            row=1, column=3, sticky="ew", padx=(6, 0), pady=4
        )

        ttk.Label(section, text="Categoria *").grid(row=2, column=0, sticky="w", padx=(0, 8), pady=4)
        self.category_combo = ttk.Combobox(section, textvariable=self.category_var, state="normal")
        self.category_combo.grid(row=2, column=1, sticky="ew", pady=4)
        self.category_combo.bind("<<ComboboxSelected>>", self._category_changed)
        ttk.Label(section, text="Disponibilità").grid(row=2, column=2, sticky="w", padx=(12, 8), pady=4)
        ttk.Combobox(
            section,
            textvariable=self.availability_var,
            values=("Disponibile", "Su ordinazione"),
            state="readonly",
        ).grid(row=2, column=3, sticky="ew", pady=4)

        ttk.Label(section, text="Prezzo base (€)").grid(row=3, column=0, sticky="w", padx=(0, 8), pady=4)
        ttk.Entry(section, textvariable=self.base_price_var).grid(row=3, column=1, sticky="ew", pady=4)
        ttk.Label(section, text="Prezzo scontato (€)").grid(row=3, column=2, sticky="w", padx=(12, 8), pady=4)
        ttk.Entry(section, textvariable=self.discount_price_var).grid(row=3, column=3, sticky="ew", pady=4)

        ttk.Label(section, text="Dimensioni").grid(row=4, column=0, sticky="w", padx=(0, 8), pady=4)
        ttk.Entry(section, textvariable=self.dimensions_var).grid(row=4, column=1, sticky="ew", pady=4)
        ttk.Label(section, text="Tempi di spedizione").grid(row=4, column=2, sticky="w", padx=(12, 8), pady=4)
        ttk.Entry(section, textvariable=self.shipping_time_var).grid(row=4, column=3, sticky="ew", pady=4)

        self.short_description = self._add_text_field(section, 5, "Descrizione breve", height=2)
        self.description = self._add_text_field(section, 6, "Descrizione completa", height=4)
        self.shipping_note = self._add_text_field(section, 7, "Nota sulla spedizione", height=2)

    @staticmethod
    def _add_text_field(parent, row: int, label: str, height: int):
        ttk.Label(parent, text=label).grid(row=row, column=0, sticky="nw", padx=(0, 8), pady=4)
        text = tk.Text(parent, height=height, wrap="word")
        text.grid(row=row, column=1, columnspan=3, sticky="ew", pady=4)
        return text

    def _build_tags_section(self):
        section = ttk.LabelFrame(self.form, text="Categorie e tag di filtro", padding=10)
        section.grid(row=1, column=0, sticky="nsew", padx=(0, 5), pady=(5, 0))
        section.columnconfigure(1, weight=1)

        self.materials_var = tk.StringVar()
        self.colors_var = tk.StringVar()
        ttk.Label(section, text="Materiali * (separati da virgola)").grid(
            row=0, column=0, sticky="w", padx=(0, 8), pady=4
        )
        material_picker = ttk.Frame(section)
        material_picker.grid(row=0, column=1, sticky="ew", pady=4)
        material_picker.columnconfigure(0, weight=1)
        ttk.Entry(material_picker, textvariable=self.materials_var, state="readonly").grid(
            row=0, column=0, sticky="ew"
        )
        ttk.Button(material_picker, text="Scegli...", command=lambda: self._choose_tag_values("materials")).grid(
            row=0, column=1, padx=(6, 0)
        )
        ttk.Label(section, text="Colori * (separati da virgola)").grid(
            row=1, column=0, sticky="w", padx=(0, 8), pady=4
        )
        color_picker = ttk.Frame(section)
        color_picker.grid(row=1, column=1, sticky="ew", pady=4)
        color_picker.columnconfigure(0, weight=1)
        ttk.Entry(color_picker, textvariable=self.colors_var, state="readonly").grid(
            row=0, column=0, sticky="ew"
        )
        ttk.Button(color_picker, text="Scegli...", command=lambda: self._choose_tag_values("colors")).grid(
            row=0, column=1, padx=(6, 0)
        )

        flags = ttk.Frame(section)
        flags.grid(row=2, column=0, columnspan=2, sticky="w", pady=(6, 0))
        self.featured_var = tk.BooleanVar(value=False)
        self.best_seller_var = tk.BooleanVar(value=False)
        self.is_new_var = tk.BooleanVar(value=True)
        self.is_custom_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(flags, text="In evidenza", variable=self.featured_var).pack(side="left", padx=(0, 14))
        ttk.Checkbutton(flags, text="Best seller", variable=self.best_seller_var).pack(side="left", padx=(0, 14))
        ttk.Checkbutton(flags, text="Nuovo arrivo", variable=self.is_new_var).pack(side="left", padx=(0, 14))
        ttk.Checkbutton(
            flags,
            text="Lavoro personalizzato",
            variable=self.is_custom_var,
            command=self._custom_changed,
        ).pack(side="left")
        ttk.Label(
            section,
            text="Categoria, materiale e colore alimentano i filtri del sito. I nuovi materiali e colori vengono aggiunti anche alla pagina Materiali.",
            wraplength=520,
        ).grid(row=3, column=0, columnspan=2, sticky="w", pady=(8, 0))

        self.materials_var.trace_add("write", lambda *_: self._refresh_tag_choices())
        self.colors_var.trace_add("write", lambda *_: self._refresh_tag_choices())

    def _build_images_section(self):
        section = ttk.LabelFrame(self.form, text="Immagini del prodotto", padding=10)
        section.grid(row=0, column=1, sticky="nsew", padx=(5, 0), pady=(0, 5))
        section.columnconfigure(0, weight=1)
        section.rowconfigure(1, weight=1)

        toolbar = ttk.Frame(section)
        toolbar.grid(row=0, column=0, sticky="ew", pady=(0, 6))
        ttk.Button(toolbar, text="Allega immagini...", command=self._add_images).pack(side="left")
        ttk.Button(toolbar, text="Rimuovi selezionate", command=self._remove_images).pack(side="left", padx=(6, 0))

        self.image_tree = ttk.Treeview(
            section,
            columns=("color", "material"),
            show="tree headings",
            selectmode="extended",
            height=5,
        )
        self.image_tree.heading("#0", text="File immagine")
        self.image_tree.heading("color", text="Colore")
        self.image_tree.heading("material", text="Materiale")
        self.image_tree.column("#0", width=240, minwidth=120)
        self.image_tree.column("color", width=130, minwidth=90)
        self.image_tree.column("material", width=120, minwidth=90)
        self.image_tree.grid(row=1, column=0, sticky="ew")
        self.image_tree.bind("<<TreeviewSelect>>", self._image_selected)

        mapping = ttk.Frame(section)
        mapping.grid(row=2, column=0, sticky="ew", pady=(7, 0))
        self.image_color_var = tk.StringVar()
        self.image_material_var = tk.StringVar()
        mapping.columnconfigure(1, weight=1)
        mapping.columnconfigure(3, weight=1)
        ttk.Label(mapping, text="Colore foto").grid(row=0, column=0, sticky="w")
        self.image_color_combo = ttk.Combobox(mapping, textvariable=self.image_color_var, width=14)
        self.image_color_combo.grid(row=0, column=1, sticky="ew", padx=(5, 10))
        ttk.Label(mapping, text="Materiale").grid(row=0, column=2, sticky="w")
        self.image_material_combo = ttk.Combobox(mapping, textvariable=self.image_material_var, width=14)
        self.image_material_combo.grid(row=0, column=3, sticky="ew", padx=(5, 0))
        ttk.Button(mapping, text="Applica alle selezionate", command=self._apply_image_mapping).grid(
            row=1, column=0, columnspan=4, sticky="e", pady=(5, 0)
        )
        ttk.Label(
            section,
            text="Seleziona una o più foto e associa a ciascuna il colore e il materiale corrispondenti.",
            wraplength=500,
        ).grid(row=3, column=0, sticky="w", pady=(6, 0))

    def _build_variants_section(self):
        section = ttk.LabelFrame(self.form, text="Prezzi specifici per variante (facoltativo)", padding=10)
        section.grid(row=1, column=1, sticky="nsew", padx=(5, 0), pady=(5, 0))
        section.columnconfigure(0, weight=1)
        section.rowconfigure(1, weight=1)

        controls = ttk.Frame(section)
        controls.grid(row=0, column=0, sticky="ew", pady=(0, 6))
        for column in (1, 3):
            controls.columnconfigure(column, weight=1)
        self.variant_material_var = tk.StringVar()
        self.variant_color_var = tk.StringVar()
        self.variant_price_var = tk.StringVar()
        self.variant_discount_var = tk.StringVar()
        ttk.Label(controls, text="Materiale").grid(row=0, column=0, sticky="w", pady=2)
        self.variant_material_combo = ttk.Combobox(controls, textvariable=self.variant_material_var, width=13)
        self.variant_material_combo.grid(row=0, column=1, sticky="ew", padx=(4, 10), pady=2)
        ttk.Label(controls, text="Colore").grid(row=0, column=2, sticky="w", pady=2)
        self.variant_color_combo = ttk.Combobox(controls, textvariable=self.variant_color_var, width=14)
        self.variant_color_combo.grid(row=0, column=3, sticky="ew", padx=(4, 0), pady=2)
        ttk.Label(controls, text="Prezzo €").grid(row=1, column=0, sticky="w", pady=2)
        ttk.Entry(controls, textvariable=self.variant_price_var, width=9).grid(
            row=1, column=1, sticky="ew", padx=(4, 10), pady=2
        )
        ttk.Label(controls, text="Scontato €").grid(row=1, column=2, sticky="w", pady=2)
        ttk.Entry(controls, textvariable=self.variant_discount_var, width=9).grid(
            row=1, column=3, sticky="ew", padx=(4, 0), pady=2
        )
        ttk.Button(controls, text="Aggiungi variante", command=self._add_variant).grid(
            row=2, column=0, columnspan=2, sticky="w", pady=(4, 0)
        )
        ttk.Button(controls, text="Rimuovi", command=self._remove_variant).grid(
            row=2, column=3, sticky="e", pady=(4, 0)
        )

        self.variant_tree = ttk.Treeview(
            section,
            columns=("material", "color", "price", "discount"),
            show="headings",
            height=4,
            selectmode="extended",
        )
        for key, label, width in (
            ("material", "Materiale", 110),
            ("color", "Colore", 120),
            ("price", "Prezzo", 85),
            ("discount", "Scontato", 100),
        ):
            self.variant_tree.heading(key, text=label)
            self.variant_tree.column(key, width=width, anchor="w")
        self.variant_tree.grid(row=1, column=0, sticky="ew")

    def _refresh_reference_values(self):
        categories = {str(item.get("category", "")).strip() for item in self.products}
        categories.discard("")
        categories.add("Lavori Personalizzati")
        values = sorted(categories, key=str.casefold)
        self.category_combo.configure(values=values)
        self.bulk_category_combo.configure(values=values)
        self._refresh_tag_choices()

    def _refresh_quick_products(self):
        if not hasattr(self, "quick_tree"):
            return
        for row in self.quick_tree.get_children():
            self.quick_tree.delete(row)
        for product in self.products:
            self.quick_tree.insert(
                "",
                "end",
                iid=str(product.get("slug", "")),
                text=product.get("title", ""),
                values=(
                    product.get("category", ""),
                    "Sì" if product.get("is_new") else "No",
                    "Sì" if product.get("best_seller") else "No",
                    "Sì" if product.get("featured") else "No",
                ),
            )

    def _bulk_selected_slugs(self):
        selected = self.quick_tree.selection()
        if not selected:
            messagebox.showinfo("Seleziona i prodotti", "Seleziona uno o più prodotti nell'elenco.")
            return None
        return set(selected)

    def _bulk_update_products(self, updater, action_label: str):
        selected = self._bulk_selected_slugs()
        if selected is None:
            return
        original = self.products
        updated = copy.deepcopy(self.products)
        for product in updated:
            if product.get("slug") in selected:
                updater(product)
        try:
            atomic_write_json(CATALOG_FILE, updated)
        except OSError as error:
            self.products = original
            messagebox.showerror("Modifica non salvata", str(error))
            return
        self.products = updated
        self._refresh_catalog()
        self._refresh_quick_products()
        self._refresh_reference_values()
        self.status_var.set(f"{action_label} applicato a {len(selected)} prodotti.")

    def _bulk_set_flag(self, field: str, value: bool):
        labels = {
            ("is_new", True): "Nuovo arrivo",
            ("is_new", False): "Rimozione dai nuovi arrivi",
            ("best_seller", True): "Best seller",
            ("best_seller", False): "Rimozione best seller",
            ("featured", True): "Evidenza",
            ("featured", False): "Rimozione evidenza",
        }
        self._bulk_update_products(lambda product: product.__setitem__(field, value), labels[(field, value)])

    def _bulk_set_category(self):
        category = self.bulk_category_var.get().strip()
        if not category:
            messagebox.showwarning("Categoria mancante", "Scegli o scrivi la categoria da applicare.")
            return

        def update(product):
            product["category"] = category
            product["is_custom"] = category.casefold() == "lavori personalizzati"

        self._bulk_update_products(update, f"Categoria '{category}'")

    def _refresh_materials(self, select_name: str | None = None):
        if not hasattr(self, "material_tree"):
            return
        for row in self.material_tree.get_children():
            self.material_tree.delete(row)
        selected_iid = None
        for index, material in enumerate(self.materials):
            iid = f"material-{index}"
            self.material_tree.insert(
                "", "end", iid=iid, text=material.get("name", ""),
                values=(len(material.get("colors", [])),),
            )
            if select_name and material.get("name") == select_name:
                selected_iid = iid
        if selected_iid:
            self.material_tree.selection_set(selected_iid)
            self.material_tree.see(selected_iid)
            self._load_material()

    def _load_material(self, _event=None):
        selected = self.material_tree.selection()
        if not selected:
            return
        name = self.material_tree.item(selected[0], "text")
        material = next((item for item in self.materials if item.get("name") == name), None)
        if material is None:
            return
        self._clear_material_form()
        self.editing_material_name = name
        self.material_name_var.set(material.get("name", ""))
        self.material_properties_var.set(", ".join(material.get("properties", [])))
        self.material_description.insert("1.0", material.get("description", ""))
        for color in material.get("colors", []):
            self.material_color_counter += 1
            iid = f"material-color-{self.material_color_counter}"
            filename = color.get("sample_image", "")
            self.material_color_rows[iid] = {
                "name": color.get("name", ""),
                "original_name": color.get("name", ""),
                "filename": filename,
                "source": MATERIAL_IMAGES_DIR / filename if filename else None,
                "extra": {key: copy.deepcopy(value) for key, value in color.items() if key not in ("name", "sample_image")},
            }
            self.material_colors_tree.insert(
                "", "end", iid=iid, text=color.get("name", ""), values=(filename,)
            )

    def _clear_material_form(self):
        self.editing_material_name = None
        self.material_name_var.set("")
        self.material_properties_var.set("")
        self.material_description.delete("1.0", "end")
        self.material_sample_source = None
        self.material_sample_label_var.set("Nessuna immagine selezionata")
        for iid in self.material_colors_tree.get_children():
            self.material_colors_tree.delete(iid)
        self.material_color_rows.clear()
        self.material_color_name_var.set("")

    def _load_material_color(self, _event=None):
        selected = self.material_colors_tree.selection()
        if not selected:
            return
        row = self.material_color_rows.get(selected[0])
        if row is None:
            return
        self.material_color_name_var.set(row["name"])
        self.material_sample_source = None
        self.material_sample_label_var.set(row.get("filename") or "Nessuna immagine selezionata")

    def _choose_material_sample(self):
        filename = filedialog.askopenfilename(
            title="Scegli l'immagine campione del colore",
            filetypes=(("Immagini", "*.jpg *.jpeg *.png *.webp"), ("Tutti i file", "*.*")),
        )
        if not filename:
            return
        source = Path(filename)
        if source.suffix.lower() not in IMAGE_EXTENSIONS:
            messagebox.showwarning("Formato non supportato", "Scegli un'immagine JPG, JPEG, PNG o WEBP.")
            return
        self.material_sample_source = source
        self.material_sample_label_var.set(f"Nuovo: {source.name}")

    def _save_material_color_row(self):
        name = self.material_color_name_var.get().strip()
        if not name:
            messagebox.showwarning("Nome mancante", "Inserisci il nome del colore.")
            return
        selected = self.material_colors_tree.selection()
        selected_iid = selected[0] if selected else None
        if any(
            row["name"].casefold() == name.casefold() and iid != selected_iid
            for iid, row in self.material_color_rows.items()
        ):
            messagebox.showwarning("Colore già presente", "Questo colore è già nell'elenco del materiale.")
            return

        if selected_iid:
            row = copy.deepcopy(self.material_color_rows[selected_iid])
            row["name"] = name
            if self.material_sample_source:
                row["source"] = self.material_sample_source
                row["filename"] = None
                row["extra"] = {}
            self.material_color_rows[selected_iid] = row
            iid = selected_iid
        else:
            if self.material_sample_source is None:
                messagebox.showwarning("Immagine necessaria", "Scegli l'immagine campione per il nuovo colore.")
                return
            self.material_color_counter += 1
            iid = f"material-color-{self.material_color_counter}"
            self.material_color_rows[iid] = {
                "name": name,
                "original_name": None,
                "filename": None,
                "source": self.material_sample_source,
                "extra": {},
            }
            self.material_colors_tree.insert("", "end", iid=iid)

        row = self.material_color_rows[iid]
        sample_label = row.get("filename") or Path(row["source"]).name
        self.material_colors_tree.item(iid, text=name, values=(sample_label,))
        self.material_colors_tree.selection_set(iid)
        self.material_sample_source = None
        self.material_sample_label_var.set(sample_label)

    def _remove_material_color(self):
        for iid in self.material_colors_tree.selection():
            self.material_colors_tree.delete(iid)
            self.material_color_rows.pop(iid, None)
        self.material_color_name_var.set("")
        self.material_sample_source = None
        self.material_sample_label_var.set("Nessuna immagine selezionata")

    def _material_json_and_assets(self, name: str):
        colors = []
        assets = []
        occupied = {path.name.casefold() for path in MATERIAL_IMAGES_DIR.iterdir() if path.is_file()} if MATERIAL_IMAGES_DIR.exists() else set()
        for iid in self.material_colors_tree.get_children():
            row = self.material_color_rows[iid]
            filename = row.get("filename")
            source = row.get("source")
            if not filename:
                if source is None or not source.is_file():
                    raise ValueError(f"Scegli un'immagine campione per il colore '{row['name']}'.")
                base = f"{slugify(name)}-{slugify(row['name'])}-sample".strip("-") or "sample"
                suffix = source.suffix.lower()
                filename = f"{base}{suffix}"
                number = 2
                while filename.casefold() in occupied:
                    filename = f"{base}-{number}{suffix}"
                    number += 1
                occupied.add(filename.casefold())
                assets.append({"source": source, "target": MATERIAL_IMAGES_DIR / filename})
            color = copy.deepcopy(row.get("extra", {}))
            color["name"] = row["name"]
            color["sample_image"] = filename
            colors.append(color)
        return colors, assets

    @staticmethod
    def _rename_material_references(products, old_name: str, new_name: str, color_rows):
        old_key = old_name.casefold()
        new_key = new_name.casefold()
        color_renames = [
            (row["original_name"], row["name"])
            for row in color_rows
            if row.get("original_name") and row["original_name"] != row["name"]
        ]
        for product in products:
            names = product.get("materials", [])
            images = product.get("images", [])
            variants = product.get("price_variants", [])
            product_uses_material = (
                any(str(value).casefold() in (old_key, new_key) for value in names)
                or any(
                    str(entry.get("material", "")).casefold() in (old_key, new_key)
                    for entry in [*images, *variants]
                )
            )
            if old_name != new_name:
                product["materials"] = [new_name if str(value).casefold() == old_key else value for value in names]
            for image in images:
                if str(image.get("material", "")).casefold() == old_key and old_name != new_name:
                    image["material"] = new_name
            for variant in variants:
                if str(variant.get("material", "")).casefold() == old_key and old_name != new_name:
                    variant["material"] = new_name

            if not product_uses_material:
                continue
            for old_color, new_color in color_renames:
                changed = False
                for entry in [*images, *variants]:
                    if (
                        str(entry.get("material", "")).casefold() == new_key
                        and str(entry.get("color", "")).casefold() == old_color.casefold()
                    ):
                        entry["color"] = new_color
                        changed = True
                if not changed:
                    continue
                colors = product.get("colors", [])
                remaining_old = any(
                    str(entry.get("color", "")).casefold() == old_color.casefold()
                    for entry in [*images, *variants]
                )
                if not remaining_old:
                    product["colors"] = [
                        value for value in colors if str(value).casefold() != old_color.casefold()
                    ]
                if not any(str(value).casefold() == new_color.casefold() for value in product.get("colors", [])):
                    product.setdefault("colors", []).append(new_color)

    def _commit_json_updates(self, updates, originals, assets):
        copied = []
        staged = []
        replaced = []
        try:
            for asset in assets:
                asset["target"].parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(asset["source"], asset["target"])
                copied.append(asset["target"])
            for target, data in updates.items():
                staged.append((target, json_temp_file(target, data)))
            for target, temp in staged:
                os.replace(temp, target)
                replaced.append(target)
        except Exception:
            rollback_ok = True
            for target in reversed(replaced):
                try:
                    atomic_write_json(target, originals[target])
                except OSError:
                    rollback_ok = False
            for _target, temp in staged:
                temp.unlink(missing_ok=True)
            if rollback_ok:
                for path in copied:
                    path.unlink(missing_ok=True)
            raise

    def _save_material(self):
        name = self.material_name_var.get().strip()
        if not name:
            messagebox.showwarning("Nome mancante", "Inserisci il nome del materiale.")
            return
        old_name = self.editing_material_name
        for material in self.materials:
            if material.get("name", "").casefold() == name.casefold() and material.get("name") != old_name:
                messagebox.showwarning("Materiale già presente", "Esiste già un materiale con questo nome.")
                return
        try:
            colors, assets = self._material_json_and_assets(name)
            current = next((item for item in self.materials if item.get("name") == old_name), None) if old_name else None
            material = copy.deepcopy(current) if current else {}
            material.update({
                "name": name,
                "description": self.material_description.get("1.0", "end-1c").strip(),
                "properties": split_values(self.material_properties_var.get()),
                "colors": colors,
            })
            new_materials = copy.deepcopy(self.materials)
            if current:
                material_index = new_materials.index(current)
                new_materials[material_index] = material
            else:
                new_materials.append(material)

            new_products = copy.deepcopy(self.products)
            if old_name and old_name != name:
                self._rename_material_references(
                    new_products,
                    old_name,
                    name,
                    [self.material_color_rows[iid] for iid in self.material_colors_tree.get_children()],
                )
            updates = {MATERIALS_FILE: new_materials}
            originals = {MATERIALS_FILE: self.materials}
            if new_products != self.products:
                updates[CATALOG_FILE] = new_products
                originals[CATALOG_FILE] = self.products
            self._commit_json_updates(updates, originals, assets)
        except (OSError, ValueError) as error:
            messagebox.showerror("Materiale non salvato", str(error))
            return

        self.materials = new_materials
        self.products = new_products
        self._refresh_materials(select_name=name)
        self._refresh_catalog()
        self._refresh_quick_products()
        self._refresh_reference_values()
        self.status_var.set(f"Materiale '{name}' salvato.")

    def _known_materials(self) -> list[str]:
        values = {str(item.get("name", "")).strip() for item in self.materials}
        for product in self.products:
            values.update(str(value).strip() for value in product.get("materials", []))
        return sorted((value for value in values if value), key=str.casefold)

    def _known_colors(self) -> list[str]:
        values = set()
        for material in self.materials:
            values.update(str(color.get("name", "")).strip() for color in material.get("colors", []))
        for product in self.products:
            values.update(str(value).strip() for value in product.get("colors", []))
        return sorted((value for value in values if value), key=str.casefold)

    def _choose_tag_values(self, kind: str):
        is_material = kind == "materials"
        variable = self.materials_var if is_material else self.colors_var
        choices = self._known_materials() if is_material else self._known_colors()
        current = split_values(variable.get())
        for value in current:
            if value.casefold() not in {choice.casefold() for choice in choices}:
                choices.append(value)
        choices.sort(key=str.casefold)

        popup = tk.Toplevel(self)
        popup.title("Seleziona materiali" if is_material else "Seleziona colori")
        popup.transient(self)
        popup.geometry("380x520")
        popup.minsize(300, 300)
        popup.grab_set()
        frame = ttk.Frame(popup, padding=12)
        frame.pack(fill="both", expand=True)
        ttk.Label(
            frame,
            text="Seleziona quelli già presenti oppure aggiungi un nuovo valore.",
            wraplength=340,
        ).pack(anchor="w", pady=(0, 8))

        options = ttk.Frame(frame)
        options.pack(fill="both", expand=True)
        canvas = tk.Canvas(options, highlightthickness=0)
        scroll = ttk.Scrollbar(options, orient="vertical", command=canvas.yview)
        option_list = ttk.Frame(canvas)
        option_list.bind("<Configure>", lambda _event: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=option_list, anchor="nw")
        canvas.configure(yscrollcommand=scroll.set)
        canvas.pack(side="left", fill="both", expand=True)
        scroll.pack(side="right", fill="y")

        selected = {value.casefold() for value in current}
        checks = {}
        for value in choices:
            checked = tk.BooleanVar(value=value.casefold() in selected)
            checks[value] = checked
            ttk.Checkbutton(option_list, text=value, variable=checked).pack(anchor="w", pady=1)
        if not choices:
            ttk.Label(option_list, text="Non ci sono ancora valori salvati.").pack(anchor="w", pady=5)

        ttk.Label(frame, text="Nuovi valori (separati da virgola)").pack(anchor="w", pady=(10, 3))
        additional = tk.StringVar()
        ttk.Entry(frame, textvariable=additional).pack(fill="x")

        def apply():
            values = [value for value, checked in checks.items() if checked.get()]
            values.extend(split_values(additional.get()))
            deduplicated = []
            seen = set()
            for value in values:
                if value.casefold() not in seen:
                    deduplicated.append(value)
                    seen.add(value.casefold())
            variable.set(", ".join(deduplicated))
            self._refresh_tag_choices()
            popup.destroy()

        buttons = ttk.Frame(frame)
        buttons.pack(fill="x", pady=(10, 0))
        ttk.Button(buttons, text="Annulla", command=popup.destroy).pack(side="right", padx=(5, 0))
        ttk.Button(buttons, text="Applica", command=apply).pack(side="right")

    def _refresh_tag_choices(self):
        materials = set(self._known_materials())
        colors = set(self._known_colors())
        materials_var = getattr(self, "materials_var", None)
        colors_var = getattr(self, "colors_var", None)
        if materials_var:
            materials.update(split_values(materials_var.get()))
        if colors_var:
            colors.update(split_values(colors_var.get()))
        material_values = sorted(materials, key=str.casefold)
        color_values = sorted(colors, key=str.casefold)
        for name in ("image_material_combo", "variant_material_combo"):
            combo = getattr(self, name, None)
            if combo:
                combo.configure(values=material_values)
        for name in ("image_color_combo", "variant_color_combo"):
            combo = getattr(self, name, None)
            if combo:
                combo.configure(values=color_values)

    def _refresh_catalog(self, select_slug: str | None = None):
        if not hasattr(self, "product_tree"):
            return
        query = self.search_var.get().strip().casefold() if hasattr(self, "search_var") else ""
        for row in self.product_tree.get_children():
            self.product_tree.delete(row)
        visible = []
        for product in self.products:
            searchable = " ".join((
                str(product.get("title", "")),
                str(product.get("slug", "")),
                str(product.get("category", "")),
                " ".join(product.get("materials", [])),
                " ".join(product.get("colors", [])),
            )).casefold()
            if query and query not in searchable:
                continue
            slug = str(product.get("slug", ""))
            price = product.get("base_price")
            price_text = "Su richiesta" if price is None else f"€ {price:g}"
            self.product_tree.insert(
                "",
                "end",
                iid=slug,
                text=str(product.get("title", slug)),
                values=(product.get("category", ""), price_text),
            )
            visible.append(slug)
        if select_slug and select_slug in visible:
            self.product_tree.selection_set(select_slug)
            self.product_tree.see(select_slug)
            self._show_product()
        elif visible and not self.product_tree.selection():
            self.product_tree.selection_set(visible[0])
            self._show_product()

    def _edit_selected_product(self):
        selected = self.product_tree.selection()
        if not selected:
            messagebox.showinfo("Seleziona un prodotto", "Scegli prima un prodotto da modificare.")
            return
        product = next((item for item in self.products if item.get("slug") == selected[0]), None)
        if product is None:
            return
        if not self._confirm_discard_product_draft("aprire la modifica del prodotto selezionato"):
            return

        self._clear_form()
        self.editing_slug = str(product.get("slug", ""))
        self.title_var.set(product.get("title", ""))
        self.slug_var.set(product.get("slug", ""))
        self.category_var.set(product.get("category", "Varie"))
        self.availability_var.set(product.get("availability", "Su ordinazione"))
        self.base_price_var.set("" if product.get("base_price") is None else str(product.get("base_price")))
        self.discount_price_var.set(
            "" if product.get("base_discount_price") is None else str(product.get("base_discount_price"))
        )
        self.dimensions_var.set(product.get("dimensions", ""))
        self.shipping_time_var.set(product.get("shipping_time", ""))
        self.materials_var.set(", ".join(product.get("materials", [])))
        self.colors_var.set(", ".join(product.get("colors", [])))
        self.short_description.insert("1.0", product.get("short_description", ""))
        self.description.insert("1.0", product.get("description", ""))
        self.shipping_note.insert("1.0", product.get("shipping_note", ""))
        self.featured_var.set(bool(product.get("featured", False)))
        self.best_seller_var.set(bool(product.get("best_seller", False)))
        self.is_new_var.set(bool(product.get("is_new", False)))
        self.is_custom_var.set(bool(product.get("is_custom", False)))

        for image in product.get("images", []):
            filename = str(image.get("file", ""))
            if not filename:
                continue
            self.image_counter += 1
            iid = f"new-image-{self.image_counter}"
            source = CATALOG_IMAGES_DIR / filename
            self.image_rows[iid] = {
                "source": source,
                "filename": filename,
                "existing": True,
                "metadata": copy.deepcopy(image),
                "color": image.get("color", ""),
                "material": image.get("material", ""),
            }
            self.image_tree.insert(
                "", "end", iid=iid, text=filename,
                values=(image.get("color", ""), image.get("material", "")),
            )

        for variant in product.get("price_variants", []):
            self.variant_counter += 1
            iid = f"variant-{self.variant_counter}"
            record = copy.deepcopy(variant)
            self.variant_rows[iid] = record
            price = record.get("price")
            discount = record.get("discount_price")
            self.variant_tree.insert(
                "", "end", iid=iid,
                values=(
                    record.get("material", ""),
                    record.get("color", ""),
                    f"€ {price:g}" if isinstance(price, (int, float)) else str(price or "—"),
                    "—" if discount is None else f"€ {discount:g}" if isinstance(discount, (int, float)) else str(discount),
                ),
            )

        self.save_product_button.configure(text="Salva modifiche")
        self.product_editor_window.title(f"Modifica prodotto - {product.get('title', '')}")
        self._show_product_editor()
        self.status_var.set(f"Modifica in corso: {product.get('title', '')}")

    def _show_product(self, _event=None):
        selected = self.product_tree.selection()
        if not selected:
            return
        product = next((item for item in self.products if item.get("slug") == selected[0]), None)
        if not product:
            return

        def yes_no(value):
            return "Sì" if value else "No"

        fields = [
            ("Nome", product.get("title", "")),
            ("Slug", product.get("slug", "")),
            ("Categoria", product.get("category", "")),
            ("Prezzo base", product.get("base_price", "Su richiesta")),
            ("Prezzo scontato", product.get("base_discount_price") or "—"),
            ("Disponibilità", product.get("availability", "")),
            ("Dimensioni", product.get("dimensions", "")),
            ("Tempi spedizione", product.get("shipping_time", "")),
            ("Materiali", ", ".join(product.get("materials", []))),
            ("Colori", ", ".join(product.get("colors", []))),
            ("In evidenza", yes_no(product.get("featured"))),
            ("Best seller", yes_no(product.get("best_seller"))),
            ("Nuovo arrivo", yes_no(product.get("is_new"))),
            ("Personalizzato", yes_no(product.get("is_custom"))),
            ("Descrizione breve", product.get("short_description", "")),
            ("Descrizione", product.get("description", "")),
            ("Nota spedizione", product.get("shipping_note", "")),
        ]
        lines = [f"{label}: {value}" for label, value in fields]
        variants = product.get("price_variants", [])
        if variants:
            lines.append("Varianti prezzo:")
            for variant in variants:
                price = variant.get("price", "—")
                discount = variant.get("discount_price")
                suffix = f" (scontato: {discount})" if discount is not None else ""
                lines.append(f"  {variant.get('color', '')} / {variant.get('material', '')}: {price}{suffix}")
        self.details.configure(state="normal")
        self.details.delete("1.0", "end")
        self.details.insert("1.0", "\n".join(lines))
        self.details.configure(state="disabled")

        for row in self.existing_images.get_children():
            self.existing_images.delete(row)
        images = product.get("images", [])
        for index, image in enumerate(images):
            self.existing_images.insert(
                "",
                "end",
                iid=f"product-image-{index}",
                text=image.get("file", ""),
                values=(image.get("color", ""), image.get("material", "")),
            )
        if images:
            self.existing_images.selection_set("product-image-0")
            self._set_preview(CATALOG_IMAGES_DIR / images[0].get("file", ""))
        else:
            self._set_preview(None)

    def _preview_selected_image(self, _event=None):
        selected = self.product_tree.selection()
        image_selection = self.existing_images.selection()
        if not selected or not image_selection:
            return
        product = next((item for item in self.products if item.get("slug") == selected[0]), None)
        index = int(image_selection[0].rsplit("-", 1)[-1])
        if product and index < len(product.get("images", [])):
            self._set_preview(CATALOG_IMAGES_DIR / product["images"][index].get("file", ""))

    def _set_preview(self, image_path: Path | None):
        self.preview_photo = None
        if image_path is None or not image_path.is_file():
            self.preview_label.configure(image="", text="Anteprima non disponibile")
            return
        if Image is None or ImageTk is None:
            self.preview_label.configure(image="", text=image_path.name, wraplength=160)
            return
        try:
            image = Image.open(image_path)
            image.thumbnail((190, 145))
            self.preview_photo = ImageTk.PhotoImage(image)
            self.preview_label.configure(image=self.preview_photo, text="")
        except OSError:
            self.preview_label.configure(image="", text=image_path.name, wraplength=160)

    def _generate_slug(self):
        slug = slugify(self.title_var.get())
        if not slug:
            messagebox.showwarning("Nome mancante", "Inserisci prima il nome del prodotto.")
            return
        used = {
            str(product.get("slug", "")).casefold()
            for product in self.products
            if product.get("slug") != self.editing_slug
        }
        base = slug
        suffix = 2
        while slug.casefold() in used:
            slug = f"{base}-{suffix}"
            suffix += 1
        self.slug_var.set(slug)

    def _category_changed(self, _event=None):
        self.is_custom_var.set(self.category_var.get().strip().casefold() == "lavori personalizzati")

    def _custom_changed(self):
        if self.is_custom_var.get():
            self.category_var.set("Lavori Personalizzati")
        elif self.category_var.get().strip().casefold() == "lavori personalizzati":
            self.category_var.set("Varie")

    def _add_images(self):
        paths = filedialog.askopenfilenames(
            title="Seleziona una o più immagini",
            filetypes=(("Immagini", "*.jpg *.jpeg *.png *.webp"), ("Tutti i file", "*.*")),
        )
        if not paths:
            return
        colors = split_values(self.colors_var.get())
        materials = split_values(self.materials_var.get())
        default_color = colors[0] if len(colors) == 1 else ""
        default_material = materials[0] if len(materials) == 1 else ""
        existing_sources = {row["source"].resolve() for row in self.image_rows.values()}
        invalid = []
        for name in paths:
            source = Path(name)
            if source.suffix.lower() not in IMAGE_EXTENSIONS:
                invalid.append(source.name)
                continue
            if source.resolve() in existing_sources:
                continue
            self.image_counter += 1
            iid = f"new-image-{self.image_counter}"
            row = {"source": source, "color": default_color, "material": default_material}
            self.image_rows[iid] = row
            self.image_tree.insert(
                "", "end", iid=iid, text=source.name, values=(default_color, default_material)
            )
            existing_sources.add(source.resolve())
        if invalid:
            messagebox.showwarning(
                "Formato non supportato",
                "Sono accettate immagini JPG, JPEG, PNG e WEBP.\n\n" + "\n".join(invalid),
            )

    def _remove_images(self):
        for iid in self.image_tree.selection():
            self.image_tree.delete(iid)
            self.image_rows.pop(iid, None)

    def _image_selected(self, _event=None):
        selected = self.image_tree.selection()
        if not selected:
            return
        row = self.image_rows.get(selected[0])
        if row:
            self.image_color_var.set(row["color"])
            self.image_material_var.set(row["material"])

    def _apply_image_mapping(self):
        color = self.image_color_var.get().strip()
        material = self.image_material_var.get().strip()
        selected = self.image_tree.selection()
        if not selected:
            messagebox.showinfo("Selezione necessaria", "Seleziona prima una o più immagini.")
            return
        if not color or not material:
            messagebox.showwarning("Abbinamento incompleto", "Indica sia il colore sia il materiale.")
            return
        for iid in selected:
            if iid in self.image_rows:
                self.image_rows[iid]["color"] = color
                self.image_rows[iid]["material"] = material
                self.image_tree.item(iid, values=(color, material))

    def _add_variant(self):
        color = self.variant_color_var.get().strip()
        material = self.variant_material_var.get().strip()
        if color not in split_values(self.colors_var.get()) or material not in split_values(self.materials_var.get()):
            messagebox.showwarning(
                "Variante non valida",
                "Inserisci prima il colore e il materiale nei tag del prodotto, poi crea la variante.",
            )
            return
        try:
            price = optional_price(self.variant_price_var.get(), "Prezzo variante")
            discount = optional_price(self.variant_discount_var.get(), "Prezzo scontato variante")
            if price is None:
                raise ValueError("Inserisci il prezzo della variante.")
            if discount is not None and discount >= price:
                raise ValueError("Il prezzo scontato deve essere inferiore al prezzo della variante.")
        except ValueError as error:
            messagebox.showwarning("Prezzo non valido", str(error))
            return
        if any(
            item["color"].casefold() == color.casefold() and item["material"].casefold() == material.casefold()
            for item in self.variant_rows.values()
        ):
            messagebox.showwarning("Variante già presente", "Esiste già un prezzo per questa coppia colore/materiale.")
            return
        self.variant_counter += 1
        iid = f"variant-{self.variant_counter}"
        variant = {"price": price, "discount_price": discount, "color": color, "material": material}
        self.variant_rows[iid] = variant
        self.variant_tree.insert(
            "", "end", iid=iid,
            values=(material, color, f"€ {price:g}", "—" if discount is None else f"€ {discount:g}"),
        )
        self.variant_price_var.set("")
        self.variant_discount_var.set("")

    def _remove_variant(self):
        for iid in self.variant_tree.selection():
            self.variant_tree.delete(iid)
            self.variant_rows.pop(iid, None)

    def _collect_product(self):
        title = self.title_var.get().strip()
        slug = self.slug_var.get().strip().lower()
        category = self.category_var.get().strip()
        colors = split_values(self.colors_var.get())
        materials = split_values(self.materials_var.get())

        if not title:
            raise ValueError("Inserisci il nome del prodotto.")
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
            raise ValueError("Lo slug deve contenere solo lettere minuscole, numeri e trattini. Usa 'Genera dal nome'.")
        if any(
            str(item.get("slug", "")).casefold() == slug.casefold()
            and item.get("slug") != self.editing_slug
            for item in self.products
        ):
            raise ValueError(f"Lo slug '{slug}' è già usato da un altro prodotto.")
        if not category:
            raise ValueError("Scegli o scrivi una categoria.")
        if not colors or not materials:
            raise ValueError("Inserisci almeno un colore e un materiale.")

        base_price = optional_price(self.base_price_var.get(), "Prezzo base")
        discount_price = optional_price(self.discount_price_var.get(), "Prezzo scontato")
        if discount_price is not None and base_price is None:
            raise ValueError("Inserisci il prezzo base se indichi un prezzo scontato.")
        if discount_price is not None and discount_price >= base_price:
            raise ValueError("Il prezzo scontato deve essere inferiore al prezzo base.")

        image_entries = []
        for iid in self.image_tree.get_children():
            row = self.image_rows[iid]
            color = row["color"].strip()
            material = row["material"].strip()
            if color not in colors or material not in materials:
                raise ValueError(
                    f"Associa l'immagine '{row['source'].name}' a un colore e materiale presenti nei tag del prodotto."
                )
            image_entries.append({
                "source": row["source"],
                "color": color,
                "material": material,
                "filename": row.get("filename"),
                "existing": bool(row.get("existing", False)),
                "metadata": copy.deepcopy(row.get("metadata", {})),
            })
        if not image_entries:
            raise ValueError("Allega almeno un'immagine del prodotto.")

        variants = list(self.variant_rows.values())
        for variant in variants:
            if variant["color"] not in colors or variant["material"] not in materials:
                raise ValueError("Una variante prezzo usa un colore o materiale non presente nei tag del prodotto.")

        is_custom = self.is_custom_var.get() or category.casefold() == "lavori personalizzati"
        if is_custom:
            category = "Lavori Personalizzati"

        product = {
            "slug": slug,
            "title": title,
            "category": category,
            "base_price": base_price,
            "base_discount_price": discount_price,
            "short_description": self.short_description.get("1.0", "end-1c").strip(),
            "description": self.description.get("1.0", "end-1c").strip(),
            "availability": self.availability_var.get().strip() or "Su ordinazione",
            "dimensions": self.dimensions_var.get().strip(),
            "shipping_time": self.shipping_time_var.get().strip(),
            "shipping_note": self.shipping_note.get("1.0", "end-1c").strip(),
            "colors": colors,
            "materials": materials,
            "images": [],
            "price_variants": variants,
            "featured": bool(self.featured_var.get()),
            "best_seller": bool(self.best_seller_var.get()),
            "is_new": bool(self.is_new_var.get()),
            "is_custom": bool(is_custom),
        }
        return product, image_entries

    def _unique_catalog_name(self, slug: str, index: int, source: Path, reserved: set[str]) -> str:
        stem = slugify(source.stem)[:52] or "immagine"
        suffix = source.suffix.lower()
        base = f"{slug}-{index:02d}-{stem}"
        candidate = f"{base}{suffix}"
        number = 2
        while candidate.casefold() in reserved or (CATALOG_IMAGES_DIR / candidate).exists():
            candidate = f"{base}-{number}{suffix}"
            number += 1
        reserved.add(candidate.casefold())
        return candidate

    def _prepare_materials(self, product, prepared_images):
        materials = json.loads(json.dumps(self.materials, ensure_ascii=False))
        sample_assets = []
        occupied = {path.name.casefold() for path in MATERIAL_IMAGES_DIR.iterdir() if path.is_file()} if MATERIAL_IMAGES_DIR.exists() else set()
        material_index = {item.get("name", "").casefold(): item for item in materials}
        prepared_by_pair = {}
        for item in prepared_images:
            prepared_by_pair.setdefault((item["color"].casefold(), item["material"].casefold()), item)

        for material_name in product["materials"]:
            material = material_index.get(material_name.casefold())
            if material is None:
                material = {"name": material_name, "description": "", "properties": [], "colors": []}
                materials.append(material)
                material_index[material_name.casefold()] = material
            material.setdefault("description", "")
            material.setdefault("properties", [])
            material.setdefault("colors", [])
            known_colors = {color.get("name", "").casefold() for color in material["colors"]}

            for color_name in product["colors"]:
                if color_name.casefold() in known_colors:
                    continue
                image = prepared_by_pair.get((color_name.casefold(), material_name.casefold()))
                if image is None or not image["source"].is_file():
                    continue
                base = f"{slugify(material_name)}-{slugify(color_name)}-sample".strip("-") or "sample"
                suffix = image["source"].suffix.lower()
                filename = f"{base}{suffix}"
                number = 2
                while filename.casefold() in occupied:
                    filename = f"{base}-{number}{suffix}"
                    number += 1
                occupied.add(filename.casefold())
                material["colors"].append({"name": color_name, "sample_image": filename})
                known_colors.add(color_name.casefold())
                sample_assets.append({"source": image["source"], "target": MATERIAL_IMAGES_DIR / filename})
        return materials, sample_assets

    def _save_product(self):
        try:
            product, image_entries = self._collect_product()
            CATALOG_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
            reserved = set()
            prepared_images = []
            for index, item in enumerate(image_entries, start=1):
                filename = item.get("filename") if item.get("existing") else None
                if not filename:
                    filename = self._unique_catalog_name(product["slug"], index, item["source"], reserved)
                image_record = copy.deepcopy(item.get("metadata", {}))
                image_record.update({"file": filename, "color": item["color"], "material": item["material"]})
                product["images"].append(image_record)
                prepared_images.append({
                    **item,
                    "filename": filename,
                    "target": CATALOG_IMAGES_DIR / filename,
                })

            if self.editing_slug:
                product_index = next(
                    (index for index, item in enumerate(self.products) if item.get("slug") == self.editing_slug),
                    None,
                )
                if product_index is None:
                    raise ValueError("Il prodotto da modificare non è più presente nel catalogo.")
                new_products = copy.deepcopy(self.products)
                for key, value in new_products[product_index].items():
                    if key not in product:
                        product[key] = copy.deepcopy(value)
                new_products[product_index] = product
            else:
                new_products = [*self.products, product]
            new_materials, sample_assets = self._prepare_materials(product, prepared_images)
            asset_copies = [
                {"source": item["source"], "target": item["target"]}
                for item in prepared_images if not item.get("existing")
            ] + sample_assets

            temp_files = []
            copied_files = []
            replaced = []
            try:
                for asset in asset_copies:
                    asset["target"].parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(asset["source"], asset["target"])
                    copied_files.append(asset["target"])

                staged = []
                catalog_temp = json_temp_file(CATALOG_FILE, new_products)
                staged.append((CATALOG_FILE, catalog_temp))
                temp_files.append(catalog_temp)
                if new_materials != self.materials:
                    materials_temp = json_temp_file(MATERIALS_FILE, new_materials)
                    staged.append((MATERIALS_FILE, materials_temp))
                    temp_files.append(materials_temp)
                for target, temp in staged:
                    os.replace(temp, target)
                    replaced.append(target)
            except Exception:
                for target in reversed(replaced):
                    old_data = self.products if target == CATALOG_FILE else self.materials
                    try:
                        atomic_write_json(target, old_data)
                    except OSError:
                        pass
                for temp in temp_files:
                    temp.unlink(missing_ok=True)
                for path in copied_files:
                    path.unlink(missing_ok=True)
                raise
        except (OSError, ValueError) as error:
            messagebox.showerror("Prodotto non salvato", str(error))
            return

        materials_updated = new_materials != self.materials
        was_editing = self.editing_slug is not None
        self.products = new_products
        self.materials = new_materials
        self._refresh_catalog(select_slug=product["slug"])
        self._refresh_reference_values()
        self._clear_form()
        action = "aggiornato" if was_editing else "aggiunto"
        self.status_var.set(f"Prodotto '{product['title']}' {action} nel catalogo.")
        note = "\nMateriali e colori aggiornati nella pagina Materiali." if materials_updated else ""
        messagebox.showinfo(
            "Prodotto aggiornato" if was_editing else "Prodotto aggiunto",
            f"'{product['title']}' è stato {action} nel catalogo.{note}",
        )

    def _clear_form(self):
        self.editing_slug = None
        self.save_product_button.configure(text="Aggiungi al catalogo")
        if hasattr(self, "product_editor_window"):
            self.product_editor_window.title("Nuovo prodotto")
        for variable, value in (
            (self.title_var, ""),
            (self.slug_var, ""),
            (self.category_var, "Varie"),
            (self.availability_var, "Su ordinazione"),
            (self.base_price_var, ""),
            (self.discount_price_var, ""),
            (self.dimensions_var, ""),
            (self.shipping_time_var, "4-7 giorni lavorativi"),
            (self.materials_var, ""),
            (self.colors_var, ""),
        ):
            variable.set(value)
        for widget in (self.short_description, self.description, self.shipping_note):
            widget.delete("1.0", "end")
        self.featured_var.set(False)
        self.best_seller_var.set(False)
        self.is_new_var.set(True)
        self.is_custom_var.set(False)
        for iid in self.image_tree.get_children():
            self.image_tree.delete(iid)
        self.image_rows.clear()
        for iid in self.variant_tree.get_children():
            self.variant_tree.delete(iid)
        self.variant_rows.clear()
        self.image_color_var.set("")
        self.image_material_var.set("")
        self.variant_material_var.set("")
        self.variant_color_var.set("")
        self.variant_price_var.set("")
        self.variant_discount_var.set("")


if __name__ == "__main__":
    ProductManager().mainloop()
