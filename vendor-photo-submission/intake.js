"use strict";

// Staging bridge to the one authoritative Photo Card v2 portal. This page
// never receives an upload, OTP, vendor identity or photo binary.
const PORTAL = "https://eluxior-vendor-api.marco-eluxior.workers.dev/photo-card";
const status = document.getElementById("intake-status");
const form = document.getElementById("photo-form");
const poInput = document.getElementById("po-entry");
const query = new URL(location.href).searchParams;
const poFromDigest = query.get("po");
const legacyToken = query.has("token");

// Do not retain or forward legacy bearer links in the referrer or browser URL.
history.replaceState(null, "", location.pathname);

function canonicalPo(value) {
  const po = String(value || "").replaceAll(" ", "");
  return /^[0-9]{6,8}$/.test(po) ? po : null;
}

function openPortal(po) {
  // Full-page navigation keeps the authenticated cookie first-party on the
  // Worker origin. The PO is an identifier, never an authorization token.
  location.assign(PORTAL + "?po=" + encodeURIComponent(po));
}

if (legacyToken) {
  status.textContent = "This older upload link cannot be used with the new secure portal. Enter the PO number and verify your authorized email, or contact ELUXIOR.";
}
if (poFromDigest !== null) {
  const po = canonicalPo(poFromDigest);
  if (po) {
    poInput.value = po;
    // A Digest B PO link enters the same portal as a manual PO selection.
    openPortal(po);
  } else {
    status.textContent = "Invalid PO number in the link. Enter the 6 to 8 digit PO number below.";
  }
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
