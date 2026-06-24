import { useState } from "react";
import type { DocImages } from "./App";

type Status = "Uploading" | "Done" | "Failed" | "Pending";

function R2Button({ docImages }: { docImages: DocImages }) {
  const [status, setStatus] = useState<Status>("Pending");

  function uploadToR2(docImages: DocImages) {
    setStatus("Uploading");
    const data = new FormData();
    data.append("filename", docImages.filename);
    for (const page of docImages.images) {
      const file = new File([page.blob], page.filename);
      data.append(page.filename, file);
    }

    fetch("/api/upload", {
      method: "POST",
      body: data,
    }).then(async (res) => {
      if (!res.ok) {
        setStatus("Failed");
        setTimeout(() => setStatus("Pending"), 20_000);
        console.error("Error while uploading", res);
        alert("Error while uploading to R2");
        return;
      }
      setStatus("Done");
    });
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

export default R2Button;
