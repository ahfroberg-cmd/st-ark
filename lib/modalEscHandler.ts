/**
 * Centraliserad ESC-hantering för modaler
 * Hittar det fönster med högst z-index och triggar dess stäng-knapp
 */

type ModalRegistryEntry = {
  element: HTMLElement;
  zIndex: number;
  onClose: () => void;
};

const modalRegistry: ModalRegistryEntry[] = [];

export function registerModal(element: HTMLElement, onClose: () => void) {
  // Ta bort gamla entries för samma element först
  const index = modalRegistry.findIndex((entry) => entry.element === element);
  if (index !== -1) {
    modalRegistry.splice(index, 1);
  }
  
  const zIndex = getZIndex(element);
  modalRegistry.push({ element, zIndex, onClose });
  // Sortera efter z-index (högst först)
  modalRegistry.sort((a, b) => b.zIndex - a.zIndex);
}

export function unregisterModal(element: HTMLElement) {
  const index = modalRegistry.findIndex((entry) => entry.element === element);
  if (index !== -1) {
    modalRegistry.splice(index, 1);
  }
}

function getZIndex(element: HTMLElement): number {
  const style = window.getComputedStyle(element);
  const zIndex = parseInt(style.zIndex, 10) || 0;
  
  // Extrahera z-index från Tailwind-klasser också
  const classZIndex = extractZIndexFromClasses(element.className);
  
  return Math.max(zIndex, classZIndex);
}

function extractZIndexFromClasses(className: string): number {
  // Matcha Tailwind z-index klasser som z-[100], z-[200], etc.
  const match = className.match(/z-\[(\d+)\]/);
  if (match) {
    return parseInt(match[1], 10);
  }
  // Matcha standard Tailwind z-index klasser
  const standardZ: Record<string, number> = {
    "z-0": 0,
    "z-10": 10,
    "z-20": 20,
    "z-30": 30,
    "z-40": 40,
    "z-50": 50,
    "z-auto": 0,
  };
  for (const [cls, val] of Object.entries(standardZ)) {
    if (className.includes(cls)) {
      return val;
    }
  }
  return 0;
}

export function triggerCloseOnTopmostModal(): boolean {
  // Ta bort modaler som inte längre finns i DOM
  const validEntries = modalRegistry.filter((entry) => 
    document.body.contains(entry.element)
  );
  modalRegistry.length = 0;
  modalRegistry.push(...validEntries);
  
  // Sortera efter z-index igen
  modalRegistry.sort((a, b) => b.zIndex - a.zIndex);
  
  if (modalRegistry.length === 0) return false;
  
  // Hitta den översta modalen som faktiskt är synlig
  for (const entry of modalRegistry) {
    const style = window.getComputedStyle(entry.element);
    if (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0"
    ) {
      // Spara referensen till onClose innan vi anropar den
      // (modalen kan avregistrera sig själv när den stängs)
      const onCloseHandler = entry.onClose;
      // Anropa alltid onClose direkt (som är handleRequestClose för modaler med dirty-state)
      // Detta säkerställer att varningsrutor visas korrekt
      onCloseHandler();
      return true;
    }
  }
  
  return false;
}

function findCloseButton(modalElement: HTMLElement): HTMLElement | null {
  // Leta efter knappar med specifik text eller aria-label
  const allButtons = modalElement.querySelectorAll<HTMLElement>("button");
  
  for (const btn of allButtons) {
    const text = btn.textContent?.trim() || "";
    const ariaLabel = btn.getAttribute("aria-label") || "";
    const className = btn.className || "";
    
    // Kolla om det är en stäng-knapp
    if (
      text === "Stäng" ||
      text === "✕" ||
      text === "×" ||
      text === "Close" ||
      ariaLabel.includes("Stäng") ||
      ariaLabel.includes("Close") ||
      className.includes("close") ||
      className.includes("stäng")
    ) {
      return btn;
    }
  }
  
  return null;
}

// Global ESC-hantering som körs först
let globalEscHandler: ((e: KeyboardEvent) => void) | null = null;

export function setupGlobalEscHandler() {
  if (globalEscHandler) return; // Redan satt upp
  
  globalEscHandler = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    
    // Don't close modals if info view is active
    // Check for info view banner (bg-sky-700) or any data-info-view element
    const infoViewBanner = document.querySelector('[data-info-view][class*="bg-sky-700"]');
    const infoViewActive = document.querySelector('[data-info-view]');
    const bodyHasInfoViewClass = document.body.classList.contains('info-view-active');
    
    if (infoViewBanner || (infoViewActive && bodyHasInfoViewClass)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return; // Block ESC completely when info view is active
    }
    
    // Om vi har en modal registrerad, trigga dess stäng-funktion
    if (triggerCloseOnTopmostModal()) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  };
  
  // Registrera med högsta prioritet (capture phase, passive: false)
  window.addEventListener("keydown", globalEscHandler, { capture: true, passive: false });
}

export function teardownGlobalEscHandler() {
  if (globalEscHandler) {
    window.removeEventListener("keydown", globalEscHandler, { capture: true });
    globalEscHandler = null;
  }
}
