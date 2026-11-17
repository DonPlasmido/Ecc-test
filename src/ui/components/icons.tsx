import type { ReactNode } from 'react';

/**
 * Iconos SVG inline propios (DESIGN.md §5): trazo 1.75, `currentColor`, decorativos
 * (`aria-hidden`); el nombre accesible lo da siempre el texto o el `aria-label` del control.
 */
type IconProps = {
  className?: string;
};

function Svg({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className ?? 'icon'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Panel: columnas de un libro de cuentas. */
export function IconDashboard(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </Svg>
  );
}

/** Movimientos: renglones con importe. */
export function IconLedger(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6h10M4 12h10M4 18h10M18 6h2M18 12h2M18 18h2" />
    </Svg>
  );
}

/** Importar: bandeja con flecha de entrada. */
export function IconImport(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3v11M7.5 9.5 12 14l4.5-4.5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
    </Svg>
  );
}

/** Presupuestos: indicador semicircular. */
export function IconBudget(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 17a8.5 8.5 0 1 1 17 0M12 17l4-5" />
      <circle cx="12" cy="17" r="1" />
    </Svg>
  );
}

/** Ajustes: deslizadores. */
export function IconSettings(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </Svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

/** Estado correcto: marca de verificación. */
export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Svg>
  );
}

/** Aviso: triángulo (forma distinta del error). */
export function IconWarning(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5 2.5 20h19L12 3.5ZM12 10v4M12 17.2v.1" />
    </Svg>
  );
}

/** Error / superado: octógono. */
export function IconError(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8.2 3h7.6L21 8.2v7.6L15.8 21H8.2L3 15.8V8.2L8.2 3ZM12 8v5M12 16.2v.1" />
    </Svg>
  );
}

/** Información: círculo con i. */
export function IconInfo(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.8v.1" />
    </Svg>
  );
}

/** Estado vacío: hoja de libro en blanco. */
export function IconEmpty(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 3h9l3 3v15H6V3ZM9 9h6M9 13h6M9 17h3" />
    </Svg>
  );
}
