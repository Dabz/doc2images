import { useState } from "react";
import "./App.css";
import JSZip from "jszip";

interface DocImagePage {
  image: string;
  filename: string;
  blob: Blob;
}
interface DocImages {
  filename: string;
  images: DocImagePage[];
}

function App() {
  const [isDragging, setIsDragging] = useState(false);
  const [images, setImages] = useState<DocImages[]>([]);
  const handleDragEnter = () => setIsDragging(true);
  const handleDragLeave = () => setIsDragging(false);

  const handleZipResponse = async (blob: Blob) => {
    const zip = new JSZip();
    const contents = await zip.loadAsync(blob);
    const docImages: DocImages = {
      filename: "doc",
      images: []
    }

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
    for (const file of imageFiles) {
      const data = new FormData();
      data.append("file", file);
      fetch("/api/doc2image", {
        method: "POST",
        body: data,
      }).then(async (res) => {
        if (!res.ok) {
          console.error("Conversion failed", res);
          alert("Docx conversion failed");
          throw new Error("Upload failed");
        }
        const zipBlob = await res.blob();
        handleZipResponse(zipBlob);
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
          <h1>
            Drag & Drop <span className="code">docx</span> file here!
          </h1>
        </section>
        {images.length > 0 && (
          <section className="documents-render">
            {images.map((image) => (
              <section className="document-render" key={image.filename}>
                <h1>{image.filename}</h1>
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
