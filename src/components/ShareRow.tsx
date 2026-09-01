"use client";

import { useState } from "react";

/**
 * Share controls for one posted day.
 *
 * The WhatsApp button is an ordinary link to wa.me, which opens the app on a
 * phone and WhatsApp Web on a computer with the message already typed — no API,
 * no approval, no cost. The copy button is the fallback for anywhere else the
 * admin might want to paste it.
 */
export function ShareRow({
  shareLink,
  message,
}: {
  shareLink: string;
  message: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      // Clipboard is blocked outside a secure context; fall back to a prompt so
      // the admin can still get at the text.
      window.prompt("Copy this message:", message);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="btn-row">
      <a
        className="btn btn-primary"
        href={shareLink}
        target="_blank"
        rel="noopener noreferrer"
      >
        <span aria-hidden="true">💬</span> Share to WhatsApp
      </a>
      <button type="button" className="btn btn-quiet" onClick={copy}>
        {copied ? "✓ Copied" : "Copy message"}
      </button>
    </div>
  );
}
