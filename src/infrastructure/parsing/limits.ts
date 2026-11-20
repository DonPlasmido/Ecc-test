/** Tamaño máximo de archivo aceptado (20 MB). */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** Número máximo de filas de una tabla cruda (cabecera y preámbulo incluidos). */
export const MAX_ROWS = 200_000;

/** Máximo de columnas de una tabla cruda (CSV y XLSX). */
export const MAX_COLS = 200;

/** Longitud máxima, en caracteres, de una celda de CSV. */
export const MAX_CELL_CHARS = 2_000;

/** Máximo de hojas de un libro XLSX que se procesan. */
export const MAX_SHEETS = 10;

/** Suma máxima declarada de bytes descomprimidos de un XLSX (50 MB). */
export const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;

/** Máximo de entradas del ZIP de un XLSX. */
export const MAX_ZIP_ENTRIES = 100;

/** Ratio máximo descomprimido:comprimido de una entrada del ZIP. */
export const MAX_ZIP_RATIO = 100;
