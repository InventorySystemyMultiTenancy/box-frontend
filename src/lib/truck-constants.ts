// Opções fixas em vez de texto livre ("Ex.: 3/4") — mais rápido de preencher no
// celular e sem risco de digitar algo ambíguo. Mesma escala do ponteiro do
// marcador de combustível, e mesmo vocabulário que a IA já usa ao ler o painel
// por foto (ver PUMP_PROMPT/PANEL_PROMPT em truck-vision.service.ts no backend).
export const FUEL_LEVEL_OPTIONS = ["Reserva", "1/4", "1/2", "3/4", "Cheio"] as const;
