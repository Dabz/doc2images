import { useState } from "react";
import "./App.css";
import JSZip from "jszip";
import R2Button from "./r2button";

export interface DocImagePage {
  image: string;
  filename: string;
  blob: Blob;
}
export interface DocImages {
  filename: string;
  images: DocImagePage[];
}

type Status = "Uploading" | "Converting" | "Done" | "Failed" |  "Pending";

function App() {
  const [isDragging, setIsDragging] = useState(false);
  const [images, setImages] = useState<DocImages[]>([]);
  const [status, setStatus] = useState<Status>("Pending");
  const handleDragEnter = () => setIsDragging(true);
  const handleDragLeave = () => setIsDragging(false);

  const handleZipResponse = async (blob: Blob, filename: string) => {
    const zip = new JSZip();
    const contents = await zip.loadAsync(blob);
    const docImages: DocImages = {
      filename: filename,
      images: [],
    };

    for (const filename of Object.keys(contents.files)) {
      const file = contents.files[filename];
      const fileBlob = await file.async("blob");
      const imageUrl = window.URL.createObjectURL(fileBlob);
      const imagePage: DocImagePage = {
        filename: filename,
        image: imageUrl,
        blob: fileBlob,
      };
      docImages.images.push(imagePage);
    }
    setImages([...images, docImages]);
  };

  const convertFilesToImages = (imageFiles: File[]) => {
    setStatus("Uploading")
    for (const file of imageFiles) {
      const data = new FormData();
      data.append("file", file);
      fetch("/api/doc2image", {
        method: "POST",
        body: data,
      }).then(async (res) => {
        if (!res.ok) {
          setStatus("Failed");
          setTimeout(() => setStatus("Pending"), 20_000)
          console.error("Conversion failed", res);
          alert("Docx conversion failed");
          throw new Error("Upload failed");
        }
        setStatus("Converting")
        const zipBlob = await res.blob();
        handleZipResponse(zipBlob, file.name);
        setStatus("Done")
        setTimeout(() => setStatus("Pending"), 20_000)
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    const imageFiles = droppedFiles.filter((file) =>
      file.name.endsWith("docx"),
    );
    convertFilesToImages(imageFiles);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <>
      <div className="document">
        <section
          className={`document-upload ${isDragging ? "document-upload-dragging" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
        >
          {status == "Pending" && (
            <h1>
              Drag & Drop <span className="code">docx</span> file here!
            </h1>
          )}
          {status == "Uploading" && (
            <h1>
              Uploading...
            </h1>
          )}
          {status == "Converting" && (
            <h1>
              Converting...
            </h1>
          )}
          {status == "Done" && (
            <h1>
              Document converted successfully! 
            </h1>
          )}
          {status == "Failed" && (
            <h1>
              Outch, something went wrong!
            </h1>
          )}
        </section>
        {images.length > 0 && (
          <section className="documents-render">
            {images.map((image) => (
              <section className="document-render" key={image.filename}>
                <div className="document-header">
                <h1>{image.filename}</h1>
                <R2Button docImages={image}></R2Button>
                </div>
                {image.images.map((page) => (
                  <div key={page.filename}>
                    <h2>{page.filename}</h2>
                    <img src={page.image} />
                  </div>
                ))}
              </section>
            ))}
          </section>
        )}
      </div>
    </>
  );
}

export default App;
