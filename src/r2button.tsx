import { useState } from "react";
import type { DocImages } from "./App";

type Status = "Uploading" | "Done" | "Failed" | "Pending";

function R2Button({ docImages }: { docImages: DocImages }) {
  const [status, setStatus] = useState<Status>("Pending");

  async function uploadToR2(docImages: DocImages) {
    setStatus("Uploading");
    await submitUpload(docImages, false);
  }

  async function submitUpload(docImages: DocImages, hasRetriedAfterLogin: boolean) {
    const data = new FormData();
    data.append("filename", docImages.filename);
    for (const page of docImages.images) {
      const file = new File([page.blob], page.filename);
      data.append(page.filename, file);
    }

    const res = await fetch("/api/upload", {
      method: "POST",
      body: data,
    });

    if (res.status === 401 && !hasRetriedAfterLogin) {
      const body = await res.json() as { loginUrl?: string };
      try {
        await waitForOAuthPopup(body.loginUrl ?? "/api/login");
        await submitUpload(docImages, true);
      } catch (err) {
        setStatus("Failed");
        setTimeout(() => setStatus("Pending"), 20_000);
        console.error("OAuth popup failed", err);
        alert("Log in to Cloudflare to upload to R2");
      }
      return;
    }

    if (!res.ok) {
      setStatus("Failed");
      setTimeout(() => setStatus("Pending"), 20_000);
      console.error("Error while uploading", res);
      alert("Error while uploading to R2");
      return;
    }

    setStatus("Done");
  }

  return (
    <>
      {status === "Pending"  && (
        <button className="r2-button" onClick={() => uploadToR2(docImages)}>
          Upload to R2
        </button>
      )}
      {status === "Uploading" && (
        <button className="r2-button" disabled>
          Uploading...
        </button>
      )}
      {status === "Done" && (
        <button className="r2-button" disabled>
           Uploaded!
        </button>
      )}
      {status === "Failed" && (
        <button className="r2-button" disabled>
          Error uploading
        </button>
      )}
    </>
  );
}

function waitForOAuthPopup(loginUrl: string) {
  const url = new URL(loginUrl, window.location.origin);
  url.searchParams.set("popup", "1");
  const popup = window.open(url.toString(), "doc2image-oauth", "popup,width=520,height=720");
  if (!popup) return Promise.reject(new Error("OAuth popup was blocked"));

  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      popup.close();
      reject(new Error("OAuth popup timed out"));
    }, 5 * 60_000);
    const closedCheck = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error("OAuth popup was closed"));
      }
    }, 500);

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "doc2image:oauth-complete") return;
      cleanup();
      resolve();
    };

    function cleanup() {
      window.clearTimeout(timeout);
      window.clearInterval(closedCheck);
      window.removeEventListener("message", onMessage);
    }

    window.addEventListener("message", onMessage);
    popup.focus();
  });
}

export default R2Button;
