// Toolbar popovers: one open at a time, closed by an outside click or Escape.

const open = new Set();

export function createPopover(button, panel) {
  const popover = {
    get isOpen() {
      return !panel.hidden;
    },
    show() {
      for (const other of open) if (other !== popover) other.hide();
      panel.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      open.add(popover);
    },
    hide({ focus = false } = {}) {
      panel.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      open.delete(popover);
      if (focus) button.focus();
    },
  };

  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', () => (popover.isOpen ? popover.hide() : popover.show()));
  document.addEventListener('click', (event) => {
    if (popover.isOpen && !panel.contains(event.target) && !button.contains(event.target)) popover.hide();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && popover.isOpen) popover.hide({ focus: true });
  });
  return popover;
}
