//
// Copyright 2024 ST-ARK
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";

interface InfoViewContextType {
  isActive: boolean;
  toggle: () => void;
  setActive: (active: boolean) => void;
}

export const InfoViewContext = React.createContext<InfoViewContextType>({
  isActive: false,
  toggle: () => {},
  setActive: () => {},
});

export function InfoViewProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [clickedElement, setClickedElement] = useState<HTMLElement | null>(null);
  const [elementInfo, setElementInfo] = useState<string>("");
  const snapshotRef = useRef<string | null>(null);
  const snapshotContainerRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isMac, setIsMac] = useState(false);
  
  // Detektera operativsystem
  useEffect(() => {
    if (typeof window !== "undefined") {
      const platform = navigator.platform.toLowerCase();
      const userAgent = navigator.userAgent.toLowerCase();
      setIsMac(platform.includes("mac") || userAgent.includes("mac"));
    }
  }, []);
  
  // Memoize children to prevent re-renders when isActive changes
  const memoizedChildren = useMemo(() => children, [children]);
  
  const shortcutKey = isMac ? "Cmd" : "Ctrl";

  const toggle = useCallback(() => {
    setIsActive((prev) => {
      const newValue = !prev;
      if (!newValue) {
        setClickedElement(null);
        setElementInfo("");
        snapshotRef.current = null;
      } else {
        // Create a snapshot of the current page state
        // We'll use html2canvas or similar approach, but for now use a simpler method
        // by cloning the body content
        requestAnimationFrame(() => {
          try {
            // Create a snapshot by cloning the main content
            const mainContent = document.querySelector('main') || document.body;
            if (mainContent) {
              // Store scroll positions
              const scrollX = window.scrollX;
              const scrollY = window.scrollY;
              
              // Create a canvas-like snapshot using html2canvas if available, otherwise use a simpler approach
              // For now, we'll just use CSS to "freeze" the view
              snapshotRef.current = 'snapshot-ready';
            }
          } catch (e) {
            console.error('Error creating snapshot:', e);
          }
        });
      }
      return newValue;
    });
  }, []);

  const setActive = useCallback((active: boolean) => {
    setIsActive(active);
    if (!active) {
      setClickedElement(null);
      setElementInfo("");
    }
  }, []);

  // Keyboard shortcut: Ctrl/Cmd + I
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If info view is active, only allow Ctrl/Cmd+I to toggle it off
      // Block ALL other keyboard shortcuts including ESC
      if (isActive) {
        // Allow Ctrl/Cmd+I to toggle off
        if ((e.metaKey || e.ctrlKey) && e.key === "i") {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          toggle();
          return;
        }
        // Block everything else, especially ESC
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }
      
      // Only handle if not already in a modal dialog
      const target = e.target as HTMLElement;
      const isInModal = target?.closest('[data-modal-panel]') || target?.closest('[role="dialog"]');
      
      if ((e.metaKey || e.ctrlKey) && e.key === "i" && !isInModal) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        toggle();
      }
    };

    // Use capture phase with highest priority to block all other handlers
    window.addEventListener("keydown", handleKeyDown, { capture: true, passive: false });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [toggle, isActive]);

  // Handle clicks when info view is active - prevent all interactions but show info
  useEffect(() => {
    if (!isActive) return;

    const handleClick = (e: MouseEvent) => {
      // Check if click is on info view close button - allow it to work normally
      const target = e.target as HTMLElement;
      const isCloseButton = target?.closest('button[aria-label="Stäng informationsvy"]');
      
      if (isCloseButton) {
        // Allow close button to work normally
        return;
      }

      // For all other clicks, prevent default behavior but still find element for info
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // Find the element under the overlay at the click position
      const x = e.clientX;
      const y = e.clientY;
      
      // Temporarily disable pointer-events on overlay and all info view elements
      // to find the actual element underneath
      const overlays = document.querySelectorAll('[data-info-view]');
      const originalPointerEvents: string[] = [];
      
      overlays.forEach((el) => {
        const htmlEl = el as HTMLElement;
        // Skip the banner and close button
        if (htmlEl.classList.contains('bg-sky-700') || htmlEl.classList.contains('bg-emerald-700')) {
          return;
        }
        originalPointerEvents.push(htmlEl.style.pointerEvents);
        htmlEl.style.pointerEvents = 'none';
      });
      
      // Also temporarily disable the CSS rule that blocks pointer events
      const body = document.body;
      const originalClass = body.className;
      body.classList.remove('info-view-active');
      
      // Now find the element
      const elementUnder = document.elementFromPoint(x, y) as HTMLElement;
      
      // Restore everything
      overlays.forEach((el, index) => {
        const htmlEl = el as HTMLElement;
        if (htmlEl.classList.contains('bg-sky-700') || htmlEl.classList.contains('bg-emerald-700')) {
          return;
        }
        htmlEl.style.pointerEvents = originalPointerEvents[index] || 'auto';
      });
      body.className = originalClass;

      if (!elementUnder) return;

      // Don't show info for info view elements themselves (except we already handled close button)
      if (elementUnder.closest('[data-info-view]')) return;

      // Find the closest element with data-info attribute
      const infoElement = elementUnder.closest('[data-info]') as HTMLElement;
      
      if (infoElement) {
        const info = infoElement.getAttribute('data-info') || '';
        setClickedElement(infoElement);
        setElementInfo(info);
      } else {
        // Try to find meaningful text from the element
        // First, try to get text directly from the element
        let text = elementUnder.textContent?.trim() || '';
        
        // If no direct text, try to find text from child elements
        if (!text) {
          const firstTextChild = Array.from(elementUnder.childNodes).find(
            (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
          );
          if (firstTextChild) {
            text = firstTextChild.textContent?.trim() || '';
          }
        }
        
        // If still no text, try to get text from first child element
        if (!text && elementUnder.firstElementChild) {
          text = elementUnder.firstElementChild.textContent?.trim() || '';
        }
        
        // If we have text, use it (limit to 100 chars)
        let info = '';
        if (text) {
          info = text.substring(0, 100);
        } else {
          // No text found - try to get a meaningful label based on element type
          const tagName = elementUnder.tagName.toLowerCase();
          const role = elementUnder.getAttribute('role');
          const ariaLabel = elementUnder.getAttribute('aria-label');
          const title = elementUnder.getAttribute('title');
          const placeholder = (elementUnder as HTMLInputElement).placeholder;
          const value = (elementUnder as HTMLInputElement).value;
          
          // Prefer aria-label, title, placeholder, or value over tagName
          if (ariaLabel) {
            info = ariaLabel;
          } else if (title) {
            info = title;
          } else if (placeholder) {
            info = placeholder;
          } else if (value && tagName === 'input') {
            info = value;
          } else if (role) {
            // Map common roles to Swedish
            const roleMap: Record<string, string> = {
              'button': 'Knapp',
              'link': 'Länk',
              'textbox': 'Textfält',
              'checkbox': 'Kryssruta',
              'radio': 'Alternativknapp',
              'tab': 'Flik',
              'menuitem': 'Menyalternativ',
            };
            info = roleMap[role] || role;
          } else {
            // Fallback: map common tag names to Swedish
            const tagMap: Record<string, string> = {
              'button': 'Knapp',
              'a': 'Länk',
              'input': 'Fält',
              'textarea': 'Textområde',
              'select': 'Lista',
              'td': 'Cell',
              'th': 'Rubrik',
              'label': 'Etikett',
              'span': '',
              'div': '',
            };
            info = tagMap[tagName] || '';
          }
        }

        setClickedElement(elementUnder);
        setElementInfo(info);
      }
    };
    
    // Also prevent mousedown events to catch clicks even earlier
    const handleMouseDown = (e: MouseEvent) => {
      // Don't block if it's on info view elements themselves (especially buttons)
      const target = e.target as HTMLElement;
      if (target?.closest('[data-info-view]')) {
        // Allow clicks on info view elements, especially buttons
        return;
      }
      
      // Allow clicks on clickable elements with data-info (buttons, links, etc.)
      const clickableElement = target?.closest('button[data-info], a[data-info], [role="button"][data-info]');
      if (clickableElement) {
        // Don't block - let the click go through
        return;
      }
      
      // Block all other mousedown events to prevent any interactions
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Block ALL keyboard shortcuts when info view is active
      // Only allow Ctrl/Cmd+I to toggle it off
      if ((e.metaKey || e.ctrlKey) && e.key === "i") {
        // Allow Ctrl/Cmd+I to toggle off
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        toggle();
        return;
      }
      
      // Block everything else - ESC, Tab, Enter, Space, etc.
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };

    // Use capture phase to catch all events early
    // Click handler captures info and then blocks the click
    // MouseDown handler blocks interactions even earlier
    document.addEventListener("mousedown", handleMouseDown, { capture: true, passive: false });
    document.addEventListener("click", handleClick, { capture: true, passive: false });
    document.addEventListener("keydown", handleKeyDown, { capture: true, passive: false });
    
    return () => {
      document.removeEventListener("mousedown", handleMouseDown, { capture: true });
      document.removeEventListener("click", handleClick, { capture: true });
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [isActive]);

  // Set mounted state for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent scrolling when active and move header down
  useEffect(() => {
    if (isActive) {
      document.body.style.overflow = "hidden";
      // Add a class to body to disable pointer events on everything except info view
      document.body.classList.add('info-view-active');
      
      // Move header down slightly to show below banner
      const timeoutId = setTimeout(() => {
        const headerDiv = document.querySelector('div.flex.items-center.gap-3.mb-3') as HTMLElement;
        if (headerDiv) {
          headerDiv.style.marginTop = '48px';
          headerDiv.style.transition = 'margin-top 0.2s';
        }
      }, 50);
      
      return () => {
        clearTimeout(timeoutId);
        document.body.style.overflow = "";
        document.body.classList.remove('info-view-active');
        const headerDiv = document.querySelector('div.flex.items-center.gap-3.mb-3') as HTMLElement;
        if (headerDiv) {
          headerDiv.style.marginTop = '';
        }
      };
    } else {
      document.body.style.overflow = "";
      document.body.classList.remove('info-view-active');
      const headerDiv = document.querySelector('div.flex.items-center.gap-3.mb-3') as HTMLElement;
      if (headerDiv) {
        headerDiv.style.marginTop = '';
      }
    }
    return () => {
      document.body.style.overflow = "";
      document.body.classList.remove('info-view-active');
      const headerDiv = document.querySelector('div.flex.items-center.gap-3.mb-3') as HTMLElement;
      if (headerDiv) {
        headerDiv.style.marginTop = '';
      }
    };
  }, [isActive]);
  
  // Memoize context value to prevent re-renders
  const contextValue = useMemo(() => ({
    isActive,
    toggle,
    setActive,
  }), [isActive, toggle, setActive]);

  // Render overlay using portal to avoid re-rendering children
  const overlayContent = isActive && mounted ? (
    <>
      {/* Banner - smaller and positioned to show header */}
      <div data-info-view className="fixed top-0 left-0 right-0 bg-sky-700 text-white px-3 py-1.5 shadow-lg border-b border-sky-800 z-[10000]">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-extrabold">Informationsvy</h2>
            <p className="text-xs text-sky-50 leading-tight">
              Klicka på ett element för att se information om dess funktion. Tryck på {shortcutKey} + I eller stäng-knappen för att avsluta.
            </p>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggle();
            }}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 active:translate-y-px transition-colors pointer-events-auto text-xs z-[10001]"
            aria-label="Stäng informationsvy"
            data-info-view
          >
            ✕
          </button>
        </div>
      </div>

      {/* Snapshot overlay - creates a "frozen" view by blocking all interactions */}
      {/* This overlay sits on top of everything and blocks all interactions */}
      <div 
        ref={snapshotContainerRef}
        data-info-view
        className="fixed inset-0 bg-sky-500/10 z-[9999] pointer-events-auto"
        style={{ 
          top: '48px',
        }}
      />
      
      {/* CSS injection to disable pointer events on everything except info view */}
      {/* Also move modals down and constrain their height */}
      <style>{`
        body.info-view-active *:not([data-info-view]):not([data-info-view] *) {
          pointer-events: none !important;
        }
        body.info-view-active [data-info-view] {
          pointer-events: auto !important;
        }
        /* Don't move or modify modals at all - let them stay in their original position */
      `}</style>

      {/* Info popup */}
      {clickedElement && elementInfo && (
        <div
          data-info-view
          className="fixed bg-white rounded-lg shadow-2xl border-2 border-sky-600 p-5 max-w-sm z-[10001] pointer-events-auto"
          style={{
            top: `${(() => {
              const rect = clickedElement.getBoundingClientRect();
              const popupHeight = 200; // Estimated height
              const spaceBelow = window.innerHeight - rect.bottom;
              const spaceAbove = rect.top;
              const padding = 10;
              
              let top: number;
              if (spaceBelow >= popupHeight + padding) {
                // Show below element
                top = rect.bottom + padding;
              } else if (spaceAbove >= popupHeight + padding) {
                // Show above element
                top = rect.top - popupHeight - padding;
              } else {
                // Center vertically
                top = Math.max(padding, (window.innerHeight - popupHeight) / 2);
              }
              
              // Ensure popup doesn't go below viewport
              const maxTop = window.innerHeight - popupHeight - padding;
              top = Math.min(top, maxTop);
              
              // Ensure popup doesn't go above viewport
              top = Math.max(padding, top);
              
              return top;
            })()}px`,
            left: `${(() => {
              const rect = clickedElement.getBoundingClientRect();
              const popupWidth = 350;
              const spaceRight = window.innerWidth - rect.left;
              const spaceLeft = rect.left;
              const padding = 10;
              
              let left: number;
              if (spaceRight >= popupWidth + padding) {
                // Show to the right
                left = rect.left + padding;
              } else if (spaceLeft >= popupWidth + padding) {
                // Show to the left
                left = rect.left - popupWidth - padding;
              } else {
                // Center horizontally
                left = Math.max(padding, (window.innerWidth - popupWidth) / 2);
              }
              
              // Ensure popup doesn't go beyond right edge
              const maxLeft = window.innerWidth - popupWidth - padding;
              left = Math.min(left, maxLeft);
              
              // Ensure popup doesn't go beyond left edge
              left = Math.max(padding, left);
              
              return left;
            })()}px`,
          }}
        >
          <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {elementInfo}
          </div>
        </div>
      )}
    </>
  ) : null;

  return (
    <InfoViewContext.Provider value={contextValue}>
      {memoizedChildren}
      {mounted && createPortal(overlayContent, document.body)}
    </InfoViewContext.Provider>
  );
}

export function useInfoView() {
  return React.useContext(InfoViewContext);
}

