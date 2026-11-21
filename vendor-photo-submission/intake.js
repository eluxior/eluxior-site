"use strict";

// Staging bridge to the one authoritative Photo Card v2 portal. This page
// never receives an upload, OTP, vendor identity or photo binary.
const PORTAL = "https://eluxior-vendor-api.marco-eluxior.workers.dev/photo-card";
// Default disabled: only enable after verified v2 Worker production cutover,
// email roster / OTP delivery, session and upload receipts have passed QA.
const READY = window.ELUXIOR_PHOTO_V2_READY === true;
const status = document.getElementById("intake-status");
const form = document.getElementById("photo-form");
const poInput = document.getElementById("po-entry");
const query = new URL(location.href).searchParams;
const poFromDigest = query.get("po");
const legacyToken = query.get("token") || "";

// Do not retain or forward legacy bearer links in the referrer or browser URL.
history.replaceState(null, "", location.pathname);

function canonicalPo(value) {
  const po = String(value || "").replace(/[\s-]/g, "");
  return /^[0-9]{6,8}$/.test(po) ? po : null;
}

function openPortal(po) {
  if (!READY) {
    status.textContent = "Secure Photo Card access is being updated. Please contact ELUXIOR with your PO number; do not send photographs or login codes by email.";
    return;
  }
  // Full-page navigation keeps OTP session cookies first-party. A PO number
  // is only an identifier, never permission to view another vendor's PO.
  location.assign(PORTAL + "?po=" + encodeURIComponent(po));
}

if (poFromDigest !== null) {
  const po = canonicalPo(poFromDigest);
  if (po) {
    poInput.value = po;
    openPortal(po);
  } else {
    status.textContent = "Invalid PO number in the link. Enter the 6 to 8 digit PO number below.";
  }
} else if (legacyToken) {
  // Never resolve signed v1 bearer links in client code: that would
  // expose reusable secrets to a URL endpoint and bypass the v2 whitelist.
  status.textContent = "This older link is no longer accepted on this page. Enter the Purchase Order number below and verify your registered email, or request access from ELUXIOR.";
}

form.addEventListener("submit", event => {
  event.preventDefault();
  const po = canonicalPo(poInput.value);
  if (!po) {
    status.textContent = "Enter the 6 to 8 digit PO number from your order.";
    poInput.focus();
    return;
  }
  openPortal(po);
});
