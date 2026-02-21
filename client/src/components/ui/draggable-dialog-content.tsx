"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { DialogOverlay } from "@/components/ui/dialog";

const DialogPortal = DialogPrimitive.Portal;

const DRAG_HANDLE_CLASS = "dialog-drag-handle";

export const DraggableDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const dragRef = React.useRef({ isDragging: false, startX: 0, startY: 0, startLeft: 0, startTop: 0 });

  const setRefs = React.useCallback(
    (el: HTMLDivElement | null) => {
      (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
    },
    [ref]
  );

  const handlePointerDown = React.useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest(`.${DRAG_HANDLE_CLASS}`)) return;
    e.preventDefault();
    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: position.x,
      startTop: position.y,
    };
    contentRef.current?.setPointerCapture?.(e.pointerId);
  }, [position.x, position.y]);

  const handlePointerMove = React.useCallback((e: PointerEvent) => {
    if (!dragRef.current.isDragging) return;
    setPosition({
      x: dragRef.current.startLeft + (e.clientX - dragRef.current.startX),
      y: dragRef.current.startTop + (e.clientY - dragRef.current.startY),
    });
  }, []);

  const handlePointerUp = React.useCallback((e: React.PointerEvent) => {
    if (dragRef.current.isDragging) {
      contentRef.current?.releasePointerCapture?.(e.pointerId);
      dragRef.current.isDragging = false;
    }
  }, []);

  React.useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [handlePointerMove]);

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={setRefs}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
          className
        )}
        style={{
          left: "50%",
          top: "50%",
          transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        {...props}
      >
        {React.Children.map(children, (child, index) => {
          if (index === 0 && React.isValidElement(child)) {
            return (
              <div className={cn(DRAG_HANDLE_CLASS, "cursor-grab active:cursor-grabbing")}>
                {child}
              </div>
            );
          }
          return child;
        })}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DraggableDialogContent.displayName = "DraggableDialogContent";
